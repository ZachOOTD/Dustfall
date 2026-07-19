// Desert shrew wildlife — small skittish ambient critter (a muad'dib-ish
// kangaroo-rat / desert-mouse). ACL DESERT SHREW.
//
// Mirrors the lizard pipeline (src/enemies/lizard.ts): a procedural low-poly
// model (Lathe/box body + ears + tail, skinMaterial), a Rapier kinematic
// body, an interface Shrew, and the spawn/update entry points.
//
// States: idle | wander | flee.
//   - idle:   sits still with a tiny breathing bob; occasionally rolls into
//             a short wander to a nearby spot.
//   - wander: ambles slowly to a randomly-chosen nearby target, then idles.
//   - flee:   on player proximity (< SPOT_DISTANCE) bolts away fast for a
//             few seconds, then settles back to idle.
//
// Self-contained: the module owns the live shrew array. `spawnShrewsProcgen`
// populates + returns it; `updateShrews` iterates the module-owned list so
// the file compiles standalone WITHOUT a `ctx.shrews` slot (the integrator
// wires `ctx.shrews = { list }` to the same array — see manifest). The only
// GameContext use is as a *type* for the fields update reads (camera, terrain,
// biomes, time, isPlaying).

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { createSkinMaterial } from '../world/skinMaterial.ts';
import type { Terrain } from '../world/terrain.ts';
import { Tuning } from '../config/tuning.ts';
import { gaitPhase, legPose } from './creatureGait.ts';
import { diurnalActivity01 } from './diurnal.ts';   // M5 — shrews are CREPUSCULAR
import {
  createParticleTrail, emitBurst, updateParticleTrail, disposeParticleTrail,
  type ParticleTrail,
} from '../world/particleTrail.ts';

// ACW B5 — burrow now part of the FSM. 'burrow' = diving into / hiding under
// the sand when the player closes within SHREW_BURROW_RADIUS.
export type ShrewState = 'idle' | 'wander' | 'flee' | 'dead' | 'burrow';

export interface Shrew {
  id: number;
  state: ShrewState;
  /** ACR — true once the player has cut the meat (dead body removed). */
  looted: boolean;
  mesh: THREE.Group;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  pos: THREE.Vector3;
  velocity: THREE.Vector3;
  /** elapsed-time stamp the current flee burst ends. */
  fleeUntil: number;
  /** Unit horizontal direction the shrew is currently bolting. */
  fleeDir: THREE.Vector3;
  /** elapsed-time stamp the current idle rest ends (then it picks a wander). */
  idleUntil: number;
  /** Wander destination (world XZ; y ignored). */
  wanderTarget: THREE.Vector3;
  hovered: boolean;
  /** ACW B5 — burrow descent progress 0 (on surface) → 1 (fully under the
   *  sand). Eases toward 1 while the player is near in 'burrow' state, back
   *  toward 0 when they leave. Transient (not persisted). */
  burrowT: number;
  /** Infinite Sands S3 — TRUE for chunk-STREAMED shrews: excluded from
   *  save serialization (visit-order ids — the D292 rule) and despawned
   *  with their chunk. Boot-spawned shrews leave this unset. */
  transient?: boolean;
  /** S5 — descriptor-derived within-chunk id ("s0") keying this creature
   *  in the chunk's save diff (looted persistence). Runtime-only. */
  chunkContentId?: string;
  /** ACAI f/u — seconds the shrew stays burrowed after a vulture scare, even
   *  with no player nearby (a vulture-triggered dive-for-cover). */
  burrowHold: number;
}

// ── Tuning — promoted to Tuning (integration). ──
const SPOT_DISTANCE = Tuning.SHREW_SPOT_DISTANCE;
const FLEE_SPEED = Tuning.SHREW_FLEE_SPEED;
const FLEE_DURATION = Tuning.SHREW_FLEE_DURATION;
const WANDER_SPEED = Tuning.SHREW_WANDER_SPEED;
const WANDER_RADIUS = Tuning.SHREW_WANDER_RADIUS;
const IDLE_MIN = Tuning.SHREW_IDLE_MIN;
const IDLE_MAX = Tuning.SHREW_IDLE_MAX;
const ARRIVE_EPS = Tuning.SHREW_ARRIVE_EPS;
const TERRAIN_OFFSET = Tuning.SHREW_TERRAIN_OFFSET;
const SHREW_TARGET_COUNT = Tuning.SHREW_TARGET_COUNT;
const SHREW_SPAWN_BUFFER_FROM_ORIGIN = Tuning.SHREW_SPAWN_BUFFER_FROM_ORIGIN;
const SHREW_CLUSTER_RADIUS_MIN = Tuning.SHREW_CLUSTER_RADIUS_MIN;
const SHREW_CLUSTER_RADIUS_MAX = Tuning.SHREW_CLUSTER_RADIUS_MAX;
const SHREW_SCATTER_RADIUS_MAX = Tuning.SHREW_SCATTER_RADIUS_MAX;
const SHREW_PER_POI_AVG = Tuning.SHREW_PER_POI_AVG;

let _nextId = 1;
const _colliderToShrew = new Map<number, Shrew>();
// ACL DESERT SHREW — module-owned live list. spawn populates, update iterates.
const _shrews: Shrew[] = [];

export function getShrewForCollider(handle: number): Shrew | undefined {
  return _colliderToShrew.get(handle);
}

/** Build a fresh shrew mesh group. ACL DESERT SHREW.
 *
 *  Procedural low-poly desert critter, ~9cm body. Local forward is +X
 *  (head/nose at +X) to match the lizard convention so the flee-yaw math is
 *  identical. Lathe-based body (rump → ribcage → neck → snout) + a separate
 *  little head sphere, two big upright ears (BoxGeometry, >=1cm deep per the
 *  thin-decoration rule), bead eyes, four stubby legs, and a long tapered
 *  Lathe tail. All skin materials use localSpace=true (D109/ABN — the shrew
 *  moves, so world-space sampling would crawl). */
export function makeShrewVisual(): THREE.Group {
  const g = new THREE.Group();

  // Sandy fur tones. Small scaleSize (50) because the shrew is tiny; lower
  // sheen than the lizard (fur, not scales).
  const furMat = createSkinMaterial(0xc4a878, {
    accentColor: 0x8a6f48,
    scaleSize: 50.0,
    sheen: 0.25,
    localSpace: true,
  });
  const bellyMat = createSkinMaterial(0xd8c8a4, {
    accentColor: 0xb09870,
    scaleSize: 50.0,
    sheen: 0.2,
    localSpace: true,
  });
  const darkMat = createSkinMaterial(0x9a7e54, {
    accentColor: 0x60492c,
    scaleSize: 50.0,
    sheen: 0.2,
    localSpace: true,
  });

  // ── Body — Lathe profile rotated so its axis runs along +X (nose forward).
  // Plump rodent torso: narrow rump → wide ribcage → pinched neck.
  const bodyProfile = [
    new THREE.Vector2(0.012, 0.000), // rump joint (tail attaches)
    new THREE.Vector2(0.024, 0.018), // haunch
    new THREE.Vector2(0.030, 0.040), // ribcage peak (widest)
    new THREE.Vector2(0.028, 0.060), // front ribcage
    new THREE.Vector2(0.020, 0.078), // shoulder
    new THREE.Vector2(0.015, 0.090), // neck joint
  ];
  const body = new THREE.Mesh(new THREE.LatheGeometry(bodyProfile, 12), furMat);
  body.rotation.z = -Math.PI / 2; // axis → +X
  body.position.set(-0.04, 0.034, 0);
  // Slight Y-squash for a grounded belly + wider-than-tall cross-section.
  body.scale.set(1.0, 0.92, 0.96);
  g.add(body);

  // Belly underside — a flattened sphere tucked under the ribcage, paler.
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), bellyMat);
  belly.position.set(0.0, 0.024, 0);
  belly.scale.set(1.4, 0.6, 0.95);
  g.add(belly);

  // ── Head — sphere just forward of the body's neck joint.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), furMat);
  head.position.set(0.062, 0.040, 0);
  head.scale.set(1.05, 0.95, 0.95);
  g.add(head);

  // Snout — small tapered cone poking forward (rodent muzzle).
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.024, 8), furMat);
  snout.rotation.z = -Math.PI / 2; // tip toward +X
  snout.position.set(0.086, 0.036, 0);
  g.add(snout);

  // Nose bead.
  const noseMat = new THREE.MeshLambertMaterial({ color: 0x2a1810 });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 5), noseMat);
  nose.position.set(0.099, 0.036, 0);
  g.add(nose);

  // ── Ears — big upright rounded "spoons". BoxGeometry would read paper-thin
  // edge-on, so use a flattened SphereGeometry scaled into an ear paddle
  // (inherently rounded volume, no <10cm thin-box concern). Tilted outward.
  for (const sz of [-1, 1] as const) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), furMat);
    ear.scale.set(0.35, 1.25, 0.85); // thin front-to-back, tall, medium wide
    ear.position.set(0.052, 0.066, sz * 0.014);
    ear.rotation.x = sz * 0.35; // splay outward
    ear.rotation.z = -0.15; // lean slightly forward
    g.add(ear);
  }

  // ── Eyes — dark beads on the sides of the head.
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
  for (const sz of [-1, 1] as const) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 5), eyeMat);
    eye.position.set(0.072, 0.044, sz * 0.016);
    g.add(eye);
  }

  // ── Legs — four stubby cylinders + tiny foot pads. Rear pair a touch
  // longer (kangaroo-rat hop posture). Tucked under the body.
  function buildLeg(sideX: 1 | -1, pair: 'front' | 'rear'): THREE.Group {
    const leg = new THREE.Group();
    const isFront = pair === 'front';
    const len = isFront ? 0.020 : 0.026;
    const r = isFront ? 0.006 : 0.007;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, len, 6), darkMat);
    seg.position.y = -len / 2;
    seg.rotation.x = sideX * 0.2; // slight outward splay
    leg.add(seg);
    // Foot pad — small box. Kept >=1cm in its smallest meaningful dimension
    // (height 0.005 is fine: it's a horizontal pad viewed from above, not a
    // thin outer-hull decoration the camera sees edge-on).
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.005, 0.010), darkMat);
    foot.position.set(0, -len + 0.0025, sideX * 0.002);
    leg.add(foot);
    return leg;
  }
  const legAttach: Array<{ x: number; sz: 1 | -1; pair: 'front' | 'rear' }> = [
    { x: 0.034, sz: 1, pair: 'front' },
    { x: 0.034, sz: -1, pair: 'front' },
    { x: -0.026, sz: 1, pair: 'rear' },
    { x: -0.026, sz: -1, pair: 'rear' },
  ];
  // ACW B5 — collect leg pivots for the walk gait (diagonal trot, like the
  // lizard): the (front-left, rear-right) pair steps opposite (front-right,
  // rear-left). `baseY` is the rest attach height the lift rides on.
  const gaitLegs: Array<{ grp: THREE.Group; offset: number; baseY: number }> = [];
  const LEG_BASE_Y = 0.028;
  for (const att of legAttach) {
    const leg = buildLeg(att.sz, att.pair);
    leg.position.set(att.x, LEG_BASE_Y, att.sz * 0.018);
    g.add(leg);
    const diag = att.pair === 'front' ? att.sz : -att.sz;
    gaitLegs.push({ grp: leg, offset: diag === 1 ? 0 : Math.PI, baseY: LEG_BASE_Y });
  }
  g.userData.gaitLegs = gaitLegs;

  // ── Tail — long tapered Lathe extending in -X, with a darker tip tuft via
  // the dark material. Kangaroo-rat tails are nearly body-length.
  const tailProfile = [
    new THREE.Vector2(0.008, 0.000),
    new THREE.Vector2(0.006, 0.040),
    new THREE.Vector2(0.004, 0.090),
    new THREE.Vector2(0.003, 0.130),
    new THREE.Vector2(0.000, 0.160), // tip
  ];
  const tail = new THREE.Mesh(new THREE.LatheGeometry(tailProfile, 8), darkMat);
  tail.rotation.z = Math.PI / 2; // extends toward -X
  tail.position.set(-0.04, 0.044, 0);
  // Curve the tail upward a touch by tilting it.
  tail.rotation.y = 0;
  tail.scale.set(1.0, 0.95, 0.95);
  g.add(tail);

  return g;
}

export function spawnShrew(
  scene: THREE.Scene,
  physicsWorld: RAPIER.World,
  terrain: Terrain,
  pos: { x: number; z: number },
): Shrew {
  const groundY = terrain.heightAt(pos.x, pos.z);
  const mesh = makeShrewVisual();
  mesh.position.set(pos.x, groundY + TERRAIN_OFFSET, pos.z);
  mesh.rotation.y = Math.random() * Math.PI * 2;
  scene.add(mesh);

  // Kinematic body, driven by our own AI (matches the lizard).
  const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
    pos.x,
    groundY + 0.04,
    pos.z,
  );
  const body = physicsWorld.createRigidBody(bodyDesc);
  // Small capsule around the body.
  const colliderDesc = RAPIER.ColliderDesc.capsule(0.03, 0.04);
  const collider = physicsWorld.createCollider(colliderDesc, body);

  const id = _nextId++;
  const shrew: Shrew = {
    id,
    state: 'idle',
    looted: false,
    mesh,
    body,
    collider,
    pos: new THREE.Vector3(pos.x, groundY + TERRAIN_OFFSET, pos.z),
    velocity: new THREE.Vector3(),
    fleeUntil: 0,
    fleeDir: new THREE.Vector3(),
    idleUntil: 0,
    wanderTarget: new THREE.Vector3(pos.x, 0, pos.z),
    hovered: false,
    burrowT: 0,
    burrowHold: 0,
  };
  _colliderToShrew.set(collider.handle, shrew);
  _shrews.push(shrew);
  return shrew;
}

/** ACR — tag the dead shrew's mesh as a 'take' interactable yielding meat. */
function tagShrewTake(root: THREE.Object3D, id: number): void {
  root.traverse((o) => {
    o.userData.interactType = 'take';
    o.userData.interactId = id;
    o.userData.interactRegistry = 'shrews';
  });
}

/** ACR — apply the dead-shrew visual + 'take' retag. Safe to call on a fresh
 *  restore where state is already 'dead' (save/load). */
export function applyDeadShrewPose(shrew: Shrew): void {
  shrew.mesh.rotation.z = Math.PI / 2;   // flop on its side
  tagShrewTake(shrew.mesh, shrew.id);
}

/** ACAI f/u — a vulture is swooping at this shrew; it may dive for cover. Rolls
 *  `chance`; on success flips to 'burrow' + holds under for SHREW_BURROW_HOLD_S
 *  (so it escapes the grab). Returns true if it bolted underground. No-op if the
 *  shrew is dead or already burrowing. */
export function alertShrewToSwoop(shrew: Shrew, chance: number): boolean {
  if (shrew.state === 'dead' || shrew.state === 'burrow') return false;
  if (Math.random() >= chance) return false;
  shrew.state = 'burrow';
  shrew.burrowHold = Tuning.SHREW_BURROW_HOLD_S;
  return true;
}

/** ACR — combat hit kills the shrew (1-HP critter, like the lizard). Flops the
 *  body on its side + retags it as a 'take' yielding raw_shrew_meat. */
export function damageShrew(shrew: Shrew, _dmg: number, _ctx: GameContext): void {
  if (shrew.state === 'dead') return;
  shrew.state = 'dead';
  applyDeadShrewPose(shrew);
}

/** ACR — player cut the meat: remove the dead shrew from world + registry. */
export function lootShrew(shrew: Shrew, ctx: GameContext): void {
  shrew.looted = true;
  ctx.three.scene.remove(shrew.mesh);
  _colliderToShrew.delete(shrew.collider.handle);
  ctx.physics.world.removeRigidBody(shrew.body);
  const idx = _shrews.indexOf(shrew);
  if (idx >= 0) _shrews.splice(idx, 1);
}

/** ACL DESERT SHREW — biome-aware procgen scatter, mirroring
 *  `spawnLizardsProcgen`. Clusters ~SHREW_PER_POI_AVG shrews near each POI,
 *  fills the remainder with sparse global density. Salt biome rejected
 *  (nothing to forage on the flats). Buffer around the player spawn so the
 *  opening scene is calm. Deterministic from the passed `scatterRand` stream,
 *  so ids are stable across reloads. Populates + returns the module-owned
 *  live list (also accessible via the update loop). */
export function spawnShrewsProcgen(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  biomes: { biomeAt: (x: number, z: number) => 'dune' | 'rocky' | 'salt' | 'wreck_yard' | 'bone_field' | 'erg' },
  scatterRand: () => number,
  poiPositions: ReadonlyArray<THREE.Vector3>,
): Shrew[] {
  const out: Shrew[] = [];
  const target = SHREW_TARGET_COUNT;
  const buffer = SHREW_SPAWN_BUFFER_FROM_ORIGIN;
  const bufferSq = buffer * buffer;
  const clusterMin = SHREW_CLUSTER_RADIUS_MIN;
  const clusterSpan = SHREW_CLUSTER_RADIUS_MAX - clusterMin;
  const scatterMax = SHREW_SCATTER_RADIUS_MAX;
  const perPoi = SHREW_PER_POI_AVG;

  // Cluster pass — 1 or 2 shrews per POI averaging perPoi.
  for (const p of poiPositions) {
    if (out.length >= target) break;
    const n = scatterRand() < perPoi - 1 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      if (out.length >= target) break;
      for (let tries = 0; tries < 5; tries++) {
        const a = scatterRand() * Math.PI * 2;
        const r = clusterMin + scatterRand() * clusterSpan;
        const x = p.x + Math.cos(a) * r;
        const z = p.z + Math.sin(a) * r;
        if (biomes.biomeAt(x, z) === 'salt') continue;
        if (x * x + z * z < bufferSq) continue;
        out.push(spawnShrew(scene, world, terrain, { x, z }));
        break;
      }
    }
  }

  // Global pass — top up to target with sparse scatter across the world.
  const MAX_GLOBAL_TRIES = (target - out.length) * 20;
  let tries = 0;
  while (out.length < target && tries < MAX_GLOBAL_TRIES) {
    tries++;
    const r = buffer + scatterRand() * (scatterMax - buffer);
    const a = scatterRand() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (biomes.biomeAt(x, z) === 'salt') continue;
    out.push(spawnShrew(scene, world, terrain, { x, z }));
  }

  return out;
}

/** Bump the module-level id counter past `n` so future spawns don't collide
 *  with restored ids. Used by save/load. ACL DESERT SHREW. */
export function setNextShrewId(n: number): void {
  if (n > _nextId) _nextId = n;
}

/** Remove a shrew from the world + module registry. ACL DESERT SHREW. */
export function removeShrew(shrew: Shrew, scene: THREE.Scene, world: RAPIER.World): void {
  scene.remove(shrew.mesh);
  _colliderToShrew.delete(shrew.collider.handle);
  world.removeRigidBody(shrew.body);
  const idx = _shrews.indexOf(shrew);
  if (idx >= 0) _shrews.splice(idx, 1);
}

export function findShrewById(list: Shrew[], id: number | undefined): Shrew | undefined {
  if (id === undefined) return undefined;
  return list.find((s) => s.id === id);
}

const _toPlayer = new THREE.Vector3();
const _toTarget = new THREE.Vector3();

// ── ACW B5 — shrew leg gait ──────────────────────────────────────────────
interface ShrewGaitLeg { grp: THREE.Group; offset: number; baseY: number; }

function animateShrewLegs(s: Shrew, elapsed: number, moving: boolean): void {
  const legs = s.mesh.userData.gaitLegs as ShrewGaitLeg[] | undefined;
  if (!legs) return;
  if (!moving) {
    for (const leg of legs) { leg.grp.rotation.z = 0; leg.grp.position.y = leg.baseY; }
    return;
  }
  const phase = gaitPhase(elapsed + s.id * 0.41, Tuning.SHREW_GAIT_FREQ_HZ);
  for (const leg of legs) {
    const p = legPose(phase, leg.offset, Tuning.SHREW_GAIT_SWING, Tuning.SHREW_GAIT_LIFT, 0);
    leg.grp.rotation.z = p.swing;
    leg.grp.position.y = leg.baseY + p.lift;
  }
}

// ── ACW B5 — shared burrow sand-puff (pooled particle trail) ─────────────
// Lazily created on first burrow (needs the scene); HMR-disposed so a tuning
// reload rebuilds it. Sandy tone, light gravity so it lingers like kicked-up
// dust.
let _burrowPuff: ParticleTrail | null = null;
let _burrowPuffScene: THREE.Scene | null = null;
if ((import.meta as { hot?: { dispose: (cb: () => void) => void } }).hot) {
  (import.meta as { hot: { dispose: (cb: () => void) => void } }).hot.dispose(() => {
    if (_burrowPuff && _burrowPuffScene) disposeParticleTrail(_burrowPuff, _burrowPuffScene);
    _burrowPuff = null; _burrowPuffScene = null;
  });
}
function burstBurrowPuff(scene: THREE.Scene, x: number, y: number, z: number): void {
  if (!_burrowPuff) {
    _burrowPuff = createParticleTrail(scene, {
      count: 90, color: 0xc4a878, opacity: 0.6, gravity: 2.4, drag: 1.6,
    });
    _burrowPuffScene = scene;
  }
  emitBurst(_burrowPuff, x, y, z, 14, { speed: 0.6, up: 0.5, life: 0.7, size: 0.4, posJitter: 0.12 });
}
/** Per-frame integrate for the burrow puff (called from updateShrews). */
export function updateShrewBurrowPuff(dt: number): void {
  if (_burrowPuff) updateParticleTrail(_burrowPuff, dt);
}

/** Per-frame AI. ACL DESERT SHREW. Iterates the module-owned live list so it
 *  compiles standalone WITHOUT a `ctx.shrews` slot. The integrator wires
 *  `ctx.shrews = { list }` to the SAME array `spawnShrewsProcgen` returns, so
 *  both views stay in sync; this loop does not read `ctx.shrews`. */
export function updateShrews(ctx: GameContext, dt: number): void {
  if (!isPlaying(ctx)) return;
  const camera = ctx.three.camera;
  const elapsed = ctx.time.elapsed;

  for (const s of _shrews) {
    if (s.state === 'dead') {
      // ACR — dead body rests on the ground; no AI. (Looted bodies are
      // already removed from _shrews by lootShrew.)
      const gy = ctx.terrain.heightAt(s.pos.x, s.pos.z);
      s.pos.y = gy + TERRAIN_OFFSET;
      s.mesh.position.copy(s.pos);
      continue;
    }
    _toPlayer.copy(camera.position).sub(s.pos);
    _toPlayer.y = 0;
    const distSq = _toPlayer.lengthSq();

    // ACW B5 — burrow pre-empts flee when the player gets VERY close. The
    // shrew bolts at SPOT_DISTANCE; if the player closes inside the (smaller)
    // burrow radius, it dives into the sand instead of continuing to run.
    const burrowR = Tuning.SHREW_BURROW_RADIUS;
    if (s.state !== 'burrow' && distSq < burrowR * burrowR) {
      s.state = 'burrow';
    }

    // Player proximity pre-empts into flee (from any non-flee, non-burrow state).
    if (s.state !== 'flee' && s.state !== 'burrow' && distSq < SPOT_DISTANCE * SPOT_DISTANCE) {
      s.fleeDir.copy(_toPlayer).normalize().multiplyScalar(-1);
      const jitter = (Math.random() - 0.5) * 0.7;
      const c = Math.cos(jitter);
      const sn = Math.sin(jitter);
      const dx = s.fleeDir.x * c - s.fleeDir.z * sn;
      const dz = s.fleeDir.x * sn + s.fleeDir.z * c;
      s.fleeDir.set(dx, 0, dz).normalize();
      s.state = 'flee';
      s.fleeUntil = elapsed + FLEE_DURATION;
    }

    if (s.state === 'idle') {
      // Tiny breathing bob — mesh only, not AI position.
      s.mesh.position.y = s.pos.y + Math.sin(elapsed * 3 + s.id) * 0.004;
      animateShrewLegs(s, elapsed, false); // ACW B5 — legs at rest

      if (s.idleUntil === 0) {
        // M5 diurnal-cycle — shrews are CREPUSCULAR: idle stretches lengthen outside
        // the dawn/dusk bands (activity divides the idle time → fewer wanders at
        // midday/midnight, a flurry at twilight). Transient; same single rand draw.
        const act = diurnalActivity01(ctx, 'crepuscular');
        s.idleUntil = elapsed + (IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN)) / Math.max(0.2, act);
      }
      if (elapsed > s.idleUntil) {
        // Pick a nearby wander target.
        const a = Math.random() * Math.PI * 2;
        const r = 0.8 + Math.random() * (WANDER_RADIUS - 0.8);
        s.wanderTarget.set(s.pos.x + Math.cos(a) * r, 0, s.pos.z + Math.sin(a) * r);
        s.state = 'wander';
        s.idleUntil = 0;
      }
    } else if (s.state === 'wander') {
      _toTarget.set(s.wanderTarget.x - s.pos.x, 0, s.wanderTarget.z - s.pos.z);
      const distTarget = _toTarget.length();
      if (distTarget < ARRIVE_EPS) {
        s.state = 'idle';
      } else {
        _toTarget.divideScalar(distTarget); // normalize
        // M5 — wander pace eases outside the twilight bands (0.6..1.0 × by activity).
        const wanderV = WANDER_SPEED * (0.6 + 0.4 * diurnalActivity01(ctx, 'crepuscular'));
        const step = Math.min(wanderV * dt, distTarget);
        s.pos.x += _toTarget.x * step;
        s.pos.z += _toTarget.z * step;
        const groundY = ctx.terrain.heightAt(s.pos.x, s.pos.z);
        s.pos.y = groundY + TERRAIN_OFFSET;
        s.mesh.position.copy(s.pos);
        // Local forward is +X → yaw = atan2(-z, x) (same as the lizard).
        s.mesh.rotation.y = Math.atan2(-_toTarget.z, _toTarget.x);
        s.body.setNextKinematicTranslation({ x: s.pos.x, y: s.pos.y + 0.04, z: s.pos.z });
        animateShrewLegs(s, elapsed, true); // ACW B5 — walk gait
      }
    } else if (s.state === 'flee') {
      const stepX = s.fleeDir.x * FLEE_SPEED * dt;
      const stepZ = s.fleeDir.z * FLEE_SPEED * dt;
      s.pos.x += stepX;
      s.pos.z += stepZ;
      const groundY = ctx.terrain.heightAt(s.pos.x, s.pos.z);
      s.pos.y = groundY + TERRAIN_OFFSET;
      // Skittery vertical hop while bolting.
      s.mesh.position.set(
        s.pos.x,
        s.pos.y + Math.abs(Math.sin(elapsed * 18 + s.id)) * 0.02,
        s.pos.z,
      );
      s.mesh.rotation.y = Math.atan2(-s.fleeDir.z, s.fleeDir.x);
      s.body.setNextKinematicTranslation({ x: s.pos.x, y: s.pos.y + 0.04, z: s.pos.z });
      animateShrewLegs(s, elapsed, true); // ACW B5 — scrabbling gait (layers under the hop)
      // Settle back to idle after the burst OR if the player is far away.
      if (elapsed > s.fleeUntil || distSq > SPOT_DISTANCE * 2 * (SPOT_DISTANCE * 2)) {
        s.state = 'idle';
        s.idleUntil = 0;
      }
    } else if (s.state === 'burrow') {
      // ACW B5 — dive into / hide under the sand. burrowT eases toward 1
      // while the player is near, back toward 0 when they leave; the mesh
      // sinks below the surface, tilts nose-down, and vanishes once mostly
      // under. A sand puff bursts when crossing the surface (in or out).
      const gy = ctx.terrain.heightAt(s.pos.x, s.pos.z);
      const surfaceY = gy + TERRAIN_OFFSET;
      const stayR = Tuning.SHREW_BURROW_RADIUS * 1.6; // hysteresis to stay buried
      // ACAI f/u — a vulture-scared shrew holds underground for a beat even with
      // no player around (else burrowT would immediately ease back out).
      if (s.burrowHold > 0) s.burrowHold = Math.max(0, s.burrowHold - dt);
      const playerNear = distSq < stayR * stayR || s.burrowHold > 0;
      const prevT = s.burrowT;
      const dir = playerNear ? 1 : -1;
      s.burrowT = Math.max(0, Math.min(1,
        s.burrowT + (dir * dt) / Tuning.SHREW_BURROW_TRANSIT_S));
      if ((prevT < 0.5) !== (s.burrowT < 0.5)) {
        burstBurrowPuff(ctx.three.scene, s.pos.x, surfaceY + 0.02, s.pos.z);
      }
      const sinkY = surfaceY - s.burrowT * Tuning.SHREW_BURROW_DEPTH;
      s.pos.y = sinkY;
      s.mesh.position.set(s.pos.x, sinkY, s.pos.z);
      s.mesh.rotation.z = -s.burrowT * 0.6;     // nose-down dive tilt
      s.mesh.visible = s.burrowT < 0.85;
      s.body.setNextKinematicTranslation({ x: s.pos.x, y: sinkY + 0.04, z: s.pos.z });
      animateShrewLegs(s, elapsed, false);      // legs tucked while diving
      if (s.burrowT <= 0 && !playerNear) {
        s.mesh.rotation.z = 0;
        s.mesh.visible = true;
        s.state = 'idle';
        s.idleUntil = 0;
      }
    }
  }
  // ACW B5 — advance the shared burrow sand-puff particles once per frame.
  updateShrewBurrowPuff(dt);
}
