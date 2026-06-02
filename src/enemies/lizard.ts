// Lizard wildlife — small flee-AI critter.
//
// States: idle | flee | dead.
// On player proximity (< 8m, line-of-sight not enforced — they have wide eyes),
// transitions to flee. Runs away from the player for 3s, then back to idle.
// Hit with the machete → dies (one-hit, it's a lizard).
// Once dead, the body becomes a 'take' interactable yielding raw_lizard_meat.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { createSkinMaterial } from '../world/skinMaterial.ts';
import { gaitPhase, legPose } from './creatureGait.ts';
import type { Terrain } from '../world/terrain.ts';

export type LizardState = 'idle' | 'flee' | 'dead';

export interface Lizard {
  id: number;
  state: LizardState;
  mesh: THREE.Group;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  pos: THREE.Vector3;
  velocity: THREE.Vector3;
  fleeUntil: number;
  fleeDir: THREE.Vector3;
  hovered: boolean;
  /** True once the player has taken the meat from the corpse. */
  looted: boolean;
  /** Distance accumulator (m) for footprint cadence — flee state only. */
  trackAccum: number;
}

let _nextId = 1;
const _colliderToLizard = new Map<number, Lizard>();

export function getLizardForCollider(handle: number): Lizard | undefined {
  return _colliderToLizard.get(handle);
}

const SPOT_DISTANCE = 8;
// Session U — was 3.0; lowered so a sprinting player can actually catch one.
// CC-4 — bumped down again (2.5 → 1.8) per playtest feedback: 2.5 m/s
// was still too fast vs sprint 7.1 m/s once you factor in initial distance
// + lizard's first-step rotation. Walk 4.2 / sprint 7.1 / lizard 1.8.
const FLEE_SPEED = 1.8;
const FLEE_DURATION = 3.0;
const TERRAIN_OFFSET = 0.06;

function tag(root: THREE.Object3D, id: number, type: 'kill' | 'take'): void {
  root.traverse((o) => {
    o.userData.interactType = type;
    o.userData.interactId = id;
    o.userData.interactRegistry = 'lizards';
  });
}

function untag(root: THREE.Object3D): void {
  root.traverse((o) => {
    delete o.userData.interactType;
    delete o.userData.interactId;
    delete o.userData.interactRegistry;
  });
}

/** Build a fresh lizard mesh group. Exported (Session II) so the
 *  inventory pickup item + lizard-on-a-stick viewmodel can show the
 *  actual lizard model instead of an abstract meat slab.
 *
 *  ACE Tier 3 — procedural-character pipeline lift. Pre-ACE was a
 *  BoxGeometry body + SphereGeometry head + BoxGeometry tail (flat
 *  brick silhouette). Now: Lathe-based anatomical body (snout → eyes
 *  → neck → shoulders → ribcage → hip → tail-base) + tapered Lathe
 *  tail + asymmetric legs with knee bumps. D115 vocabulary applied
 *  scaled to the lizard's ~32cm body length. Lathe geometry is
 *  rotated 90° around Z so the rotational axis aligns with +X
 *  (lizard's local forward, head at +X). All materials use
 *  createSkinMaterial localSpace=true per D109 (lizard moves —
 *  world-space sampling would crawl). */
export function makeLizardVisual(): THREE.Group {
  const g = new THREE.Group();
  // ABH — lizard body gets the organic-skin shader. Small scale (40)
  // because the lizard is tiny (~18cm long) — large cells would read
  // as one cell per side. Higher sheen because lizards naturally
  // have shiny scales.
  // ABN — localSpace so scale pattern stays anchored to the lizard body
  // as it scuttles. Same root cause as companion + sandworm — world-space
  // sampling causes the texture detail to slide across the surface.
  const bodyMat = createSkinMaterial(0xa89878, {
    accentColor: 0x6a5638,
    scaleSize: 40.0,
    sheen: 0.7,
    localSpace: true,
  });
  const darkMat = createSkinMaterial(0x7a6a4a, {
    accentColor: 0x4a3a26,
    scaleSize: 40.0,
    sheen: 0.5,
    localSpace: true,
  });

  // ── Body — Lathe profile rotated so axis is along +X (head forward).
  // ACE R3: minor slim — ribcage peak 0.038 → 0.034 (less chunky vs the
  // long thin snout from R2). Body Y raised 0.042 → 0.058 so the
  // feet at the bottom of the legs (~5.6cm below body center) make
  // ground contact at the mesh's terrain-offset origin.
  const bodyProfile = [
    new THREE.Vector2(0.016, 0.00),  // tail-end joint
    new THREE.Vector2(0.025, 0.04),  // hip
    new THREE.Vector2(0.031, 0.09),  // rear-ribcage
    new THREE.Vector2(0.034, 0.14),  // ribcage peak (widest)
    new THREE.Vector2(0.032, 0.18),  // front-ribcage
    new THREE.Vector2(0.027, 0.22),  // shoulder
    new THREE.Vector2(0.022, 0.26),  // neck pinch
    new THREE.Vector2(0.018, 0.28),  // neck-to-head joint
  ];
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(bodyProfile, 14),
    bodyMat,
  );
  body.rotation.z = -Math.PI / 2;
  body.position.set(-0.14, 0.054, 0);   // R4: slightly lower (Y-squash compensates)
  // R4: Y-squash on body (0.78) gives a flatter "belly-on-ground" reptile
  // silhouette vs R3's torpedo-fish round cross-section. Z-squash 0.95
  // keeps the body wider than tall (proper reptile proportion). After
  // rotation.z = -π/2, body-local Y maps to world Z, body-local Z maps
  // to world Y — so scale (X=1, Y=0.95, Z=0.78) lands as world-X=1
  // (length unchanged), world-Y=0.78 (flattened spine), world-Z=0.95
  // (slight wider-than-tall).
  body.scale.set(1.0, 0.95, 0.78);
  g.add(body);

  // ── Head — Lathe wedge. R2: oriented correctly (snout at FAR-FORWARD,
  // neck-joint at body's front). rotation.z = +π/2 (not -π/2 like body)
  // reverses the profile h-axis so neck-joint (h=0.13) lands BEHIND
  // snout (h=0). Position.x = body's-front + head-length puts snout
  // at +0.27 and neck-joint at +0.14 (meets body's neck).
  // Also extended head length 0.10 → 0.13 for a longer snout.
  const headProfile = [
    new THREE.Vector2(0.000, 0.000),  // snout tip
    new THREE.Vector2(0.012, 0.020),  // nose ridge
    new THREE.Vector2(0.020, 0.045),  // upper jaw
    new THREE.Vector2(0.025, 0.075),  // eye area
    new THREE.Vector2(0.024, 0.105),  // behind eyes
    new THREE.Vector2(0.020, 0.130),  // neck joint
  ];
  const head = new THREE.Mesh(
    new THREE.LatheGeometry(headProfile, 12),
    bodyMat,
  );
  head.rotation.z = Math.PI / 2;     // FLIPPED: profile h-axis goes -X
  // R5: overlap head into body by 0.025m so the neck-joint sits inside
  // the body's shoulder area (rather than perfectly butted against the
  // narrow neck-end). Smooths the visual transition; the head's lower
  // half is hidden inside the body, creating a continuous neck-to-head
  // silhouette without the pinched gap visible from top-down.
  head.position.set(0.245, 0.060, 0);
  head.scale.set(1.0, 0.95, 0.80);
  g.add(head);

  // Eyes — small dark beads on the sides of the head behind the snout.
  // R5: x adjusted -0.025 to match head's overlap shift.
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
  for (const sz of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 6, 5), eyeMat);
    eye.position.set(0.170, 0.078, sz * 0.018);
    g.add(eye);
  }

  // ── Tail — tapered Lathe. R2: base matches body's tail-end radius
  // 0.018 (was 0.020 — body shrank by R2 also). Position adjusted for
  // body's new tail-end location (x = -0.14).
  const tailProfile = [
    new THREE.Vector2(0.018, 0.000),
    new THREE.Vector2(0.014, 0.045),
    new THREE.Vector2(0.010, 0.095),
    new THREE.Vector2(0.005, 0.150),
    new THREE.Vector2(0.000, 0.200),  // tip
  ];
  const tail = new THREE.Mesh(
    new THREE.LatheGeometry(tailProfile, 10),
    darkMat,
  );
  tail.rotation.z = Math.PI / 2;       // tail extends in -X
  tail.position.set(-0.14, 0.048, 0);   // R4: matched body Y squash
  tail.scale.set(1.0, 0.90, 0.85);     // R4: slight Y-squash on tail too
  g.add(tail);

  // ── Legs — asymmetric, sprawl posture. Front legs short (locomotor
  // weight forward of CoG), rear legs longer + more powerful for the
  // push. Each leg has an upper segment + knee bump + lower segment
  // + flat foot disc.
  function buildLeg(opts: { sideX: 1 | -1; pair: 'front' | 'rear' }): THREE.Group {
    const leg = new THREE.Group();
    const isFront = opts.pair === 'front';
    const upperLen = isFront ? 0.026 : 0.032;
    const upperR  = isFront ? 0.010 : 0.012;
    const lowerLen = isFront ? 0.022 : 0.026;
    const lowerR  = isFront ? 0.0085 : 0.0095;
    // Upper segment — tilted outward at the shoulder/hip
    const upperGeo = new THREE.CylinderGeometry(upperR * 0.9, upperR, upperLen, 6);
    const upper = new THREE.Mesh(upperGeo, darkMat);
    upper.position.y = -upperLen / 2;
    upper.rotation.x = opts.sideX * 0.5;    // splay outward (reptilian sprawl)
    leg.add(upper);
    // Knee bump
    const knee = new THREE.Mesh(new THREE.SphereGeometry(upperR * 1.05, 6, 4), darkMat);
    knee.position.y = -upperLen;
    knee.position.z = opts.sideX * upperLen * 0.45;  // sprawl offset
    leg.add(knee);
    // Lower segment — tilts inward + downward to the foot
    const lowerGeo = new THREE.CylinderGeometry(lowerR, lowerR * 0.85, lowerLen, 6);
    const lower = new THREE.Mesh(lowerGeo, darkMat);
    lower.position.set(0, -upperLen - lowerLen / 2, opts.sideX * upperLen * 0.45);
    leg.add(lower);
    // Foot — flat box disc
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.005, 0.014),
      darkMat,
    );
    foot.position.set(0, -upperLen - lowerLen + 0.0025, opts.sideX * (upperLen * 0.45 + 0.005));
    leg.add(foot);
    return leg;
  }
  // Leg attachment points — front legs at shoulder area (x~+0.08),
  // rear legs at hip area (x~-0.10). Y at body-bottom. R2: positions
  // updated for the stretched 0.28m body (was 0.22m in R1).
  const legAttach: Array<{ x: number; sz: 1 | -1; pair: 'front' | 'rear' }> = [
    { x: 0.080, sz: 1, pair: 'front' },
    { x: 0.080, sz: -1, pair: 'front' },
    { x: -0.100, sz: 1, pair: 'rear' },
    { x: -0.100, sz: -1, pair: 'rear' },
  ];
  // ACW B4 — collect leg pivots + their base transforms so updateLizards
  // can drive a sprawl-gait. Diagonal trot: the (front-left, rear-right)
  // pair steps in phase, opposite the (front-right, rear-left) pair — so
  // the body always has a diagonal of planted feet. `offset` spaces the
  // two diagonals by π; `baseY` is the rest attach height the lift rides on.
  const gaitLegs: Array<{ grp: THREE.Group; offset: number; baseY: number }> = [];
  const LEG_BASE_Y = 0.054;
  for (const att of legAttach) {
    const leg = buildLeg({ sideX: att.sz, pair: att.pair });
    // R3: leg attach Y bumped 0.038 → 0.054 (matches body lift) so the
    // legs hang from the new body height. With body raised 16cm + leg
    // total length ~5.6cm, the foot-disc sits very near the mesh
    // origin (terrain + TERRAIN_OFFSET=0.06 → feet ~touch ground).
    leg.position.set(att.x, LEG_BASE_Y, att.sz * 0.030);
    g.add(leg);
    const diag = att.pair === 'front' ? att.sz : -att.sz; // +1 = diagonal A, -1 = diagonal B
    gaitLegs.push({ grp: leg, offset: diag === 1 ? 0 : Math.PI, baseY: LEG_BASE_Y });
  }
  g.userData.gaitLegs = gaitLegs;
  return g;
}

// ACW B4 — lizard sprawl-gait tuning. Skittery quadruped cadence; the foot
// swings fore/aft (leg.rotation.z) and lifts (leg.position.y) during the
// forward-recovery half-stride. Reset to rest when not moving.
const LIZARD_GAIT_FREQ_HZ = 3.4;
const LIZARD_GAIT_SWING = 0.72;   // rad fore/aft — lively skitter while fleeing
const LIZARD_GAIT_LIFT = 0.022;   // m foot lift at mid-swing

interface GaitLeg { grp: THREE.Group; offset: number; baseY: number; }

function animateLizardLegs(l: Lizard, elapsed: number, moving: boolean): void {
  const legs = l.mesh.userData.gaitLegs as GaitLeg[] | undefined;
  if (!legs) return;
  if (!moving) {
    for (const leg of legs) {
      leg.grp.rotation.z = 0;
      leg.grp.position.y = leg.baseY;
    }
    return;
  }
  // +l.id desyncs each lizard's stride so a cluster doesn't march in lockstep.
  const phase = gaitPhase(elapsed + l.id * 0.37, LIZARD_GAIT_FREQ_HZ);
  for (const leg of legs) {
    const p = legPose(phase, leg.offset, LIZARD_GAIT_SWING, LIZARD_GAIT_LIFT, 0);
    leg.grp.rotation.z = p.swing;
    leg.grp.position.y = leg.baseY + p.lift;
  }
}

export function spawnLizard(
  scene: THREE.Scene,
  physicsWorld: RAPIER.World,
  terrain: Terrain,
  pos: { x: number; z: number },
): Lizard {
  const groundY = terrain.heightAt(pos.x, pos.z);
  const mesh = makeLizardVisual();
  mesh.position.set(pos.x, groundY + TERRAIN_OFFSET, pos.z);
  mesh.rotation.y = Math.random() * Math.PI * 2;
  scene.add(mesh);

  // Kinematic body so we can translate via our own AI.
  const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(pos.x, groundY + 0.05, pos.z);
  const body = physicsWorld.createRigidBody(bodyDesc);
  const colliderDesc = RAPIER.ColliderDesc.capsule(0.05, 0.06);
  const collider = physicsWorld.createCollider(colliderDesc, body);

  const id = _nextId++;
  tag(mesh, id, 'kill');

  const lizard: Lizard = {
    id,
    state: 'idle',
    mesh,
    body,
    collider,
    pos: new THREE.Vector3(pos.x, groundY + TERRAIN_OFFSET, pos.z),
    velocity: new THREE.Vector3(),
    fleeUntil: 0,
    fleeDir: new THREE.Vector3(),
    hovered: false,
    looted: false,
    trackAccum: 0,
  };
  _colliderToLizard.set(collider.handle, lizard);
  return lizard;
}

/** HH (world rework #3) — replaces the 4 hard-coded lizard spawns with
 *  biome-aware procgen scatter. Clusters 1-2 lizards near each POI, fills
 *  the remainder with sparse global density. Salt biome rejected (lizards
 *  don't live on featureless flats). 25m buffer around player spawn so
 *  the opening scene isn't ambushy. Deterministic from the passed `rand`
 *  stream, so ids are stable across reloads. */
export function spawnLizardsProcgen(
  scene: THREE.Scene,
  physicsWorld: RAPIER.World,
  terrain: Terrain,
  biomes: { biomeAt: (x: number, z: number) => 'dune' | 'rocky' | 'salt' },
  rand: () => number,
  poiPositions: ReadonlyArray<THREE.Vector3>,
): Lizard[] {
  const lizards: Lizard[] = [];
  const target = Tuning.LIZARD_TARGET_COUNT;
  const buffer = Tuning.LIZARD_SPAWN_BUFFER_FROM_ORIGIN;
  const bufferSq = buffer * buffer;
  const clusterMin = Tuning.LIZARD_CLUSTER_RADIUS_MIN;
  const clusterSpan = Tuning.LIZARD_CLUSTER_RADIUS_MAX - clusterMin;
  const scatterMax = Tuning.LIZARD_SCATTER_RADIUS_MAX;
  const perPoi = Tuning.LIZARD_PER_POI_AVG;

  // Cluster pass — 1 or 2 lizards per POI averaging perPoi.
  for (const p of poiPositions) {
    if (lizards.length >= target) break;
    const n = rand() < (perPoi - 1) ? 2 : 1;
    for (let i = 0; i < n; i++) {
      if (lizards.length >= target) break;
      let placed = false;
      for (let tries = 0; tries < 5; tries++) {
        const a = rand() * Math.PI * 2;
        const r = clusterMin + rand() * clusterSpan;
        const x = p.x + Math.cos(a) * r;
        const z = p.z + Math.sin(a) * r;
        if (biomes.biomeAt(x, z) === 'salt') continue;
        if (x * x + z * z < bufferSq) continue;
        lizards.push(spawnLizard(scene, physicsWorld, terrain, { x, z }));
        placed = true;
        break;
      }
      // If we couldn't place near this POI, skip — the global pass will
      // top up the count.
      if (!placed) continue;
    }
  }

  // Global pass — top up to target with sparse scatter across the world.
  const MAX_GLOBAL_TRIES = (target - lizards.length) * 20;
  let tries = 0;
  while (lizards.length < target && tries < MAX_GLOBAL_TRIES) {
    tries++;
    const r = buffer + rand() * (scatterMax - buffer);
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (biomes.biomeAt(x, z) === 'salt') continue;
    lizards.push(spawnLizard(scene, physicsWorld, terrain, { x, z }));
  }

  return lizards;
}

export function damageLizard(lizard: Lizard, _dmg: number, _ctx: GameContext): void {
  if (lizard.state === 'dead') return;
  lizard.state = 'dead';
  lizard.mesh.position.y += 0.02;
  applyDeadPose(lizard);
}

/** Session PP — pipe-staff knockback. Shoves the lizard `distance` meters
 *  along the horizontal projection of `dir`. Applied alongside damageLizard.
 *  Works on both live + dead lizards; dead ones get visually flung when
 *  struck. */
export function knockbackLizard(
  lizard: Lizard,
  dir: THREE.Vector3,
  distance: number,
  _ctx: GameContext,
): void {
  const horizLen = Math.hypot(dir.x, dir.z) || 1;
  const dx = (dir.x / horizLen) * distance;
  const dz = (dir.z / horizLen) * distance;
  const cur = lizard.body.translation();
  // Translate body + mesh together. setTranslation(true) wakes any
  // sleeping body so the new position takes effect immediately.
  lizard.body.setTranslation({ x: cur.x + dx, y: cur.y, z: cur.z + dz }, true);
  lizard.mesh.position.x += dx;
  lizard.mesh.position.z += dz;
}

/** Apply the dead-lizard visual + interaction retag. Safe to call from a
 *  fresh restore where state is already 'dead' — does not bump position.y. */
export function applyDeadPose(lizard: Lizard): void {
  lizard.mesh.rotation.z = Math.PI / 2;
  untag(lizard.mesh);
  tag(lizard.mesh, lizard.id, 'take');
}

/** Bump the module-level id counter past `n` so future spawns don't collide
 *  with restored ids. Used by save/load. */
export function setNextLizardId(n: number): void {
  if (n > _nextId) _nextId = n;
}

/** Called when the player takes the meat — removes from world + registry. */
export function lootLizard(lizard: Lizard, ctx: GameContext): void {
  lizard.looted = true;
  ctx.three.scene.remove(lizard.mesh);
  _colliderToLizard.delete(lizard.collider.handle);
  // Remove physics body
  ctx.physics.world.removeRigidBody(lizard.body);
  const idx = ctx.lizards.indexOf(lizard);
  if (idx >= 0) ctx.lizards.splice(idx, 1);
}

export function findLizardById(list: Lizard[], id: number | undefined): Lizard | undefined {
  if (id === undefined) return undefined;
  return list.find((l) => l.id === id);
}

const _toPlayer = new THREE.Vector3();

export function updateLizards(ctx: GameContext, dt: number): void {
  if (!isPlaying(ctx)) return;
  const camera = ctx.three.camera;
  const elapsed = ctx.time.elapsed;
  for (const l of ctx.lizards) {
    if (l.state === 'dead') {
      // Idle on the ground — clamp to terrain.
      const groundY = ctx.terrain.heightAt(l.pos.x, l.pos.z);
      l.pos.y = groundY + TERRAIN_OFFSET;
      l.mesh.position.copy(l.pos);
      continue;
    }
    _toPlayer.copy(camera.position).sub(l.pos);
    _toPlayer.y = 0;
    const distSq = _toPlayer.lengthSq();

    if (l.state === 'idle') {
      // Idle bob — vertical sin wave on mesh only, not on AI position.
      l.mesh.position.y = l.pos.y + Math.sin(elapsed * 2 + l.id) * 0.005;
      // ACW B4 — legs at rest (subtle settle); gait only runs while fleeing.
      animateLizardLegs(l, elapsed, false);
      if (distSq < SPOT_DISTANCE * SPOT_DISTANCE) {
        // Flee — pick a direction opposite the player + small jitter.
        l.fleeDir.copy(_toPlayer).normalize().multiplyScalar(-1);
        const jitter = (Math.random() - 0.5) * 0.6;
        const c = Math.cos(jitter); const s = Math.sin(jitter);
        const dx = l.fleeDir.x * c - l.fleeDir.z * s;
        const dz = l.fleeDir.x * s + l.fleeDir.z * c;
        l.fleeDir.set(dx, 0, dz);
        l.state = 'flee';
        l.fleeUntil = elapsed + FLEE_DURATION;
        // (mesh.rotation.y is updated each frame in the flee branch below)
      }
    } else if (l.state === 'flee') {
      // Move
      const stepX = l.fleeDir.x * FLEE_SPEED * dt;
      const stepZ = l.fleeDir.z * FLEE_SPEED * dt;
      l.pos.x += stepX;
      l.pos.z += stepZ;
      const groundY = ctx.terrain.heightAt(l.pos.x, l.pos.z);
      l.pos.y = groundY + TERRAIN_OFFSET;
      l.mesh.position.copy(l.pos);
      // ACW B4 — sprawl-gait drives the legs while fleeing.
      animateLizardLegs(l, elapsed, true);
      // Always orient the head toward the direction of motion. The lizard
      // mesh's local "forward" is +X (head at +X=0.11), so the correct yaw
      // to map local +X onto world (fleeDir.x, _, fleeDir.z) is
      // atan2(-z, x) — NOT atan2(x, z) (that's the -Z-forward convention
      // and was leaving the head 90° off the direction of travel).
      l.mesh.rotation.y = Math.atan2(-l.fleeDir.z, l.fleeDir.x);
      // Update kinematic body so the collider follows.
      l.body.setNextKinematicTranslation({ x: l.pos.x, y: l.pos.y + 0.05, z: l.pos.z });
      // Track decals — only during flee. Skip on rocky biome (no impression).
      l.trackAccum += Math.hypot(stepX, stepZ);
      if (l.trackAccum >= Tuning.FOOTPRINT_LIZARD_CADENCE_M) {
        l.trackAccum = 0;
        const biome = ctx.biomes.biomeAt(l.pos.x, l.pos.z);
        if (biome !== 'rocky') {
          const yaw = Math.atan2(l.fleeDir.x, l.fleeDir.z);
          ctx.footprints.spawn('lizard', l.pos.x, l.pos.z, yaw, elapsed);
        }
      }
      // Return to idle after duration OR if player far away
      if (elapsed > l.fleeUntil || distSq > (SPOT_DISTANCE * 2) * (SPOT_DISTANCE * 2)) {
        l.state = 'idle';
        l.trackAccum = 0;
      }
    }
  }
}
