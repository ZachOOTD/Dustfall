// Desert vulture — a rare scavenger bird that PERCHES atop the salt-flats dead
// trees, flees when the player approaches, and can be shot out of the air for
// meat. Mirrors the shrew/lizard pipeline (procedural model + Rapier kinematic
// body + interface + spawn/update entry points) but the behaviour is a perched
// bird, not a ground critter.
//
// References (ACAH): lappet-faced / white-backed vulture perched on a Deadvlei
// dead tree — hunched broad-shouldered silhouette, bald pink head on an S-neck
// tucked into the shoulders, heavy hooked beak, dark folded wings draped down
// the sides, a feather ruff at the neck base, strong gripping talons.
//
// States: perched | flee | dead.
//   - perched: sits on a tree crown with a subtle idle (head bob / wing shift).
//   - flee:    on player proximity (< VULTURE_SPOT_RADIUS) launches off the
//              perch and climbs away — the kill window (needs a gun + a shot).
//   - dead:    a hit drops it; it falls under gravity, lands, flops on its side,
//              and retags as a 'take' yielding raw_vulture_meat.
//
// Self-contained like shrew.ts: the module owns the live list; spawn populates +
// returns it, update iterates it. The integrator wires ctx.vultures = { list }.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { createSkinMaterial } from '../world/skinMaterial.ts';
import { Tuning } from '../config/tuning.ts';
import { getPlayerPos } from '../util/playerPos.ts';
import type { TreePerch } from '../world/deadTree.ts';

export type VultureState = 'perched' | 'flying' | 'landing' | 'dead';

/** ACAI — animatable joint pivots on the vulture mesh (stored in
 *  `mesh.userData.rig`). Each is a Group positioned AT its joint with its child
 *  meshes offset, so rotating the group articulates about the joint (mirrors the
 *  lizard/shrew leg-pivot convention). At rest (all rotations 0) the bird reads
 *  identically to the ACAH static model. */
export interface VultureRig {
  wingL: THREE.Group; wingR: THREE.Group;
  neck: THREE.Group; tail: THREE.Group;
  legL: THREE.Group; legR: THREE.Group;
}

export interface Vulture {
  id: number;
  state: VultureState;
  looted: boolean;
  mesh: THREE.Group;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  /** Current world position of the bird (body centre). */
  pos: THREE.Vector3;
  /** The crown point it perches on (world). */
  perch: THREE.Vector3;
  velocity: THREE.Vector3;
  /** Unit flight direction while fleeing. */
  fleeDir: THREE.Vector3;
  /** Heading (radians, atan2(dirX,dirZ)) the mesh yaws toward. */
  heading: number;
  /** idle phase accumulator (perched bob). */
  bob: number;
  hovered: boolean;
  /** true once landed dead (lootable on the ground). */
  landed: boolean;
}

let _nextId = 1;
const _colliderToVulture = new Map<number, Vulture>();
const _vultures: Vulture[] = [];
/** Full world-space branch-perch pool (set at spawn) — used by the relocate FSM
 *  to pick a landing target on a DIFFERENT tree. */
let _perchPool: ReadonlyArray<TreePerch> = [];

/** All known branch perches in the world (for the relocate-and-land FSM). */
export function getPerchPool(): ReadonlyArray<TreePerch> {
  return _perchPool;
}

export function getVultureForCollider(handle: number): Vulture | undefined {
  return _colliderToVulture.get(handle);
}
export function findVultureById(id: number): Vulture | undefined {
  return _vultures.find((v) => v.id === id);
}

// ── Materials (shared; localSpace per D109 — the bird moves). ──
const _plumage = createSkinMaterial(0x2b2620, { localSpace: true, sheen: 0.18 });   // dark sooty brown
const _plumageEdge = createSkinMaterial(0x3c352b, { localSpace: true, sheen: 0.15 }); // lighter feather edges
const _bareSkin = createSkinMaterial(0x9c6f60, { localSpace: true, sheen: 0.32 });   // pink-grey bald head/neck
const _beakMat = createSkinMaterial(0x4a4133, { localSpace: true, sheen: 0.4 });     // dark horn beak
const _eyeMat = new THREE.MeshBasicMaterial({ color: 0x140f0a });

/** Build a perched-vulture mesh. Local convention: head faces +X, tail at -X,
 *  wings on ±Z, up = +Y, FEET at the origin (so placing the group at a perch
 *  seats the talons on the branch). Hunched, broad-shouldered silhouette. */
export function makeVultureVisual(): THREE.Group {
  const g = new THREE.Group();
  const box = (w: number, h: number, d: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  // A joint pivot Group placed at (x,y,z); children are added at offsets so the
  // group rotates ABOUT this joint. Returns the group (added to g).
  const pivot = (x: number, y: number, z: number): THREE.Group => {
    const p = new THREE.Group();
    p.position.set(x, y, z);
    g.add(p);
    return p;
  };

  // ── Body — plump hunched ovoid + shoulder hump. Stays on the root. ──
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), _plumage);
  body.scale.set(1.35, 1.05, 1.0);
  body.position.set(-0.02, 0.26, 0);
  g.add(body);
  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 8), _plumage);
  hump.scale.set(1.2, 0.9, 1.0);
  hump.position.set(-0.08, 0.36, 0);
  g.add(hump);
  // Feather ruff at the neck base — stays on the root (the collar the neck rises from).
  const ruff = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.03, 8, 14), _plumageEdge);
  ruff.position.set(0.06, 0.34, 0);
  ruff.rotation.set(0, 0, Math.PI / 2);
  ruff.scale.set(1.0, 1.0, 0.7);
  g.add(ruff);

  // ── Legs — hip pivots at the leg tops (tuck up in flight). ──
  const legs: THREE.Group[] = [];
  for (const sz of [-1, 1]) {
    const hip = pivot(-0.02, 0.14, sz * 0.05);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.13, 6), _bareSkin);
    leg.position.set(0, -0.07, 0); leg.rotation.z = sz * 0.12;
    hip.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.03, 6), _bareSkin);
    foot.position.set(0, -0.128, 0);
    hip.add(foot);
    for (const ta of [-0.5, 0, 0.5]) {
      const claw = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.009, 0.05, 4), _beakMat);
      claw.position.set(Math.cos(ta) * 0.03, -0.134, Math.sin(ta) * 0.03);
      claw.rotation.set(Math.PI / 2.2, 0, ta);
      hip.add(claw);
    }
    legs.push(hip);
  }

  // ── Wings — shoulder pivots; the folded slab + primaries hang off the joint so
  //    rotating the pivot flaps the whole wing about the shoulder. ──
  const wings: THREE.Group[] = [];
  for (const sz of [-1, 1]) {
    const shoulder = pivot(-0.05, 0.30, sz * 0.06);
    const wing = box(0.33, 0.02, 0.19, _plumage);
    wing.position.set(0, -0.05, sz * 0.105); wing.rotation.set(sz * 0.66, 0.0, 0.04);
    shoulder.add(wing);
    const prim = box(0.18, 0.016, 0.085, _plumageEdge);
    prim.position.set(-0.12, -0.13, sz * 0.10); prim.rotation.set(sz * 0.8, 0.3, 0.12);
    shoulder.add(prim);
    wings.push(shoulder);
  }

  // ── Tail — root pivot (tilt/fan for steering + landing flare). ──
  const tail = pivot(-0.13, 0.22, 0);
  const tailFan = box(0.10, 0.016, 0.14, _plumageEdge);
  tailFan.position.set(-0.08, -0.01, 0); tailFan.rotation.set(0, 0, 0.25);
  tail.add(tailFan);

  // ── Neck — base pivot at the shoulders; the S-neck + head + beak + eyes ride it
  //    so the whole head bobs/turns/extends about the neck base. ──
  const neck = pivot(0.06, 0.34, 0);
  const neck1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.10, 7), _bareSkin);
  neck1.position.set(0.02, 0.05, 0); neck1.rotation.z = -0.6;
  neck.add(neck1);
  const neck2 = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.08, 7), _bareSkin);
  neck2.position.set(0.09, 0.08, 0); neck2.rotation.z = -1.1;
  neck.add(neck2);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), _bareSkin);
  head.position.set(0.14, 0.10, 0);
  neck.add(head);
  const beakBase = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.07, 7), _beakMat);
  beakBase.position.set(0.185, 0.095, 0); beakBase.rotation.z = -Math.PI / 2;
  neck.add(beakBase);
  const hook = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.035, 6), _beakMat);
  hook.position.set(0.225, 0.078, 0); hook.rotation.z = -Math.PI / 1.5;
  neck.add(hook);
  for (const sz of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6), _eyeMat);
    eye.position.set(0.165, 0.112, sz * 0.03);
    neck.add(eye);
  }

  const rig: VultureRig = { wingL: wings[0], wingR: wings[1], neck, tail, legL: legs[0], legR: legs[1] };
  g.userData.rig = rig;
  return g;
}

/** ACAI — pose the rig per state each frame. At rest the bird is the perched
 *  silhouette; this articulates wings/neck/legs/tail for idle / flap / landing /
 *  death. Driven by `elapsed` (sinusoids) — see VULTURE_* tuning. */
export function animateVulture(v: Vulture, elapsed: number): void {
  const rig = v.mesh.userData.rig as VultureRig | undefined;
  if (!rig) return;
  const { wingL, wingR, neck, tail, legL, legR } = rig;
  const ph = elapsed + v.id * 1.7;   // de-sync birds

  switch (v.state) {
    case 'perched': {
      // Idle: slow head bob + occasional look-around + a faint wing settle.
      neck.rotation.z = Math.sin(ph * Tuning.VULTURE_IDLE_BOB_HZ * Math.PI * 2) * Tuning.VULTURE_IDLE_BOB_AMP;
      neck.rotation.y = Math.sin(ph * 0.23) * 0.12;
      const settle = Math.sin(ph * 0.7) * 0.03;
      wingL.rotation.set(-settle, 0, 0); wingR.rotation.set(settle, 0, 0);
      legL.rotation.set(0, 0, 0); legR.rotation.set(0, 0, 0);
      tail.rotation.set(0, 0, 0);
      break;
    }
    case 'flying': {
      // Wings extend OUT and flap (mirrored); legs tuck up; neck extends; tail trails.
      const f = Math.sin(elapsed * Tuning.VULTURE_FLAP_HZ * Math.PI * 2);
      const w = Tuning.VULTURE_WING_EXTEND + f * Tuning.VULTURE_FLAP_AMP;
      wingL.rotation.set(w, 0, 0); wingR.rotation.set(-w, 0, 0);
      neck.rotation.set(0, 0, Tuning.VULTURE_NECK_EXTEND);
      legL.rotation.set(0, 0, -Tuning.VULTURE_LEG_TUCK); legR.rotation.set(0, 0, Tuning.VULTURE_LEG_TUCK);
      tail.rotation.set(0, 0, -0.3);
      break;
    }
    case 'landing': {
      // Flare: wings spread + cupped forward, fluttering; legs reach DOWN; neck up; tail fans as an airbrake.
      const flutter = Math.sin(elapsed * Tuning.VULTURE_FLAP_HZ * 1.6 * Math.PI * 2) * 0.18;
      const w = Tuning.VULTURE_WING_EXTEND * 0.6 + flutter;
      wingL.rotation.set(w, -0.4, 0); wingR.rotation.set(-w, 0.4, 0);   // cupped forward
      neck.rotation.set(0, 0, -0.25);
      legL.rotation.set(0, 0, 0.15); legR.rotation.set(0, 0, -0.15);    // reaching for the perch
      tail.rotation.set(0, 0, 0.5);                                     // fanned down
      break;
    }
    case 'dead': {
      // Limp — wings splayed, head drooped, legs slack. Static (the body tumbles).
      wingL.rotation.set(-0.9, 0, 0); wingR.rotation.set(0.9, 0, 0);
      neck.rotation.set(0, 0, 0.9);
      legL.rotation.set(0, 0, 0.4); legR.rotation.set(0, 0, -0.4);
      tail.rotation.set(0, 0, 0.1);
      break;
    }
  }
}

/** Tag the dead vulture's mesh as a 'take' interactable yielding meat. */
function tagVultureTake(root: THREE.Object3D, id: number): void {
  root.traverse((o) => {
    o.userData.interactType = 'take';
    o.userData.interactId = id;
    o.userData.interactRegistry = 'vultures';
  });
}

/** Combat hit kills the vulture. It drops dead — the update loop falls it to the
 *  ground (gravity), then it flops + becomes lootable. */
export function damageVulture(vulture: Vulture, _dmg: number, _ctx: GameContext): void {
  if (vulture.state === 'dead') return;
  vulture.state = 'dead';
  vulture.landed = false;
  // Carry any flee momentum into the fall + a downward kick.
  vulture.velocity.y = Math.min(vulture.velocity.y, -0.5);
}

/** Apply the landed-dead visual + 'take' retag. Safe on a fresh restore. */
export function applyDeadVulturePose(vulture: Vulture): void {
  vulture.mesh.rotation.set(0, vulture.heading, Math.PI / 2);   // flop on its side
  vulture.landed = true;
  tagVultureTake(vulture.mesh, vulture.id);
}

/** Player cut the meat: remove the dead vulture from world + registry. */
export function lootVulture(vulture: Vulture, ctx: GameContext): void {
  vulture.looted = true;
  ctx.three.scene.remove(vulture.mesh);
  _colliderToVulture.delete(vulture.collider.handle);
  ctx.physics.world.removeRigidBody(vulture.body);
  const idx = _vultures.indexOf(vulture);
  if (idx >= 0) _vultures.splice(idx, 1);
}

/** Spawn a single vulture perched at a crown point (world). */
export function spawnVulture(
  scene: THREE.Scene,
  world: RAPIER.World,
  perch: { x: number; y: number; z: number },
  dir?: { x: number; z: number },
): Vulture {
  // Seat the feet (group origin, y=0 local) on TOP of the limb: the perch point
  // is the branch centreline, so lift by ~the branch radius so talons grip.
  const SEAT_BIAS = 0.03;
  const py = perch.y + SEAT_BIAS;
  const mesh = makeVultureVisual();
  mesh.position.set(perch.x, py, perch.z);
  // Perch ACROSS the limb (perpendicular to the branch direction) when known.
  const heading = dir
    ? Math.atan2(dir.x, dir.z) + Math.PI / 2
    : Math.random() * Math.PI * 2;
  mesh.rotation.y = heading;
  scene.add(mesh);

  // Kinematic body + capsule around the body centre (~0.26 above the feet).
  const cy = py + 0.26;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(perch.x, cy, perch.z),
  );
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.1, 0.14), body);

  const id = _nextId++;
  const v: Vulture = {
    id,
    state: 'perched',
    looted: false,
    mesh,
    body,
    collider,
    pos: new THREE.Vector3(perch.x, py, perch.z),
    perch: new THREE.Vector3(perch.x, py, perch.z),
    velocity: new THREE.Vector3(),
    fleeDir: new THREE.Vector3(1, 0, 0),
    heading,
    bob: Math.random() * Math.PI * 2,
    hovered: false,
    landed: false,
  };
  _colliderToVulture.set(collider.handle, v);
  _vultures.push(v);
  return v;
}

/** Rare procgen scatter: ~VULTURE_TARGET_COUNT vultures on distinct, well-
 *  separated tree-crown perches (salt flats only — that's where the trees are).
 *  Deterministic from scatterRand. Populates + returns the module-owned list. */
export function spawnVulturesProcgen(
  scene: THREE.Scene,
  world: RAPIER.World,
  perches: ReadonlyArray<TreePerch>,
  scatterRand: () => number,
): Vulture[] {
  _perchPool = perches;
  const target = Tuning.VULTURE_TARGET_COUNT;
  const minSep = Tuning.VULTURE_MIN_SEPARATION;
  const minSepSq = minSep * minSep;
  const chosen: THREE.Vector3[] = [];
  // Shuffle perch indices deterministically, then greedily pick separated ones.
  const idx = perches.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(scatterRand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  for (const i of idx) {
    if (chosen.length >= target) break;
    const p = perches[i].pos;
    if (chosen.some((c) => (c.x - p.x) ** 2 + (c.z - p.z) ** 2 < minSepSq)) continue;
    chosen.push(p);
    spawnVulture(scene, world, p, perches[i].dir);
  }
  return _vultures;
}

/** Bump the id counter past `n` so restored ids don't collide. */
export function setNextVultureId(n: number): void {
  if (n >= _nextId) _nextId = n + 1;
}

const _toPlayer = new THREE.Vector3();

export function updateVultures(ctx: GameContext, dt: number): void {
  if (!isPlaying(ctx)) return;
  const playerTr = getPlayerPos(ctx);
  const spotR = Tuning.VULTURE_SPOT_RADIUS;
  const spotRSq = spotR * spotR;

  for (let k = _vultures.length - 1; k >= 0; k--) {
    const v = _vultures[k];
    _toPlayer.set(playerTr.x - v.pos.x, 0, playerTr.z - v.pos.z);
    const horizDistSq = _toPlayer.lengthSq();

    switch (v.state) {
      case 'perched': {
        v.mesh.position.y = v.perch.y;   // seated; idle motion is the rig neck-bob (animateVulture)
        // Player got close → launch.
        if (horizDistSq < spotRSq) {
          v.state = 'flying';
          // Flee AWAY from the player, horizontally, with a strong climb.
          _toPlayer.normalize();
          v.fleeDir.set(-_toPlayer.x, 0, -_toPlayer.z);
          if (v.fleeDir.lengthSq() < 1e-4) v.fleeDir.set(1, 0, 0);
          v.fleeDir.normalize();
          v.heading = Math.atan2(v.fleeDir.x, v.fleeDir.z);
          v.velocity.set(0, Tuning.VULTURE_CLIMB_RATE, 0);
        }
        break;
      }
      case 'flying': {
        // Climb + accelerate along the flee direction (an ascending arc away).
        const sp = Tuning.VULTURE_FLEE_SPEED;
        v.pos.x += v.fleeDir.x * sp * dt;
        v.pos.z += v.fleeDir.z * sp * dt;
        v.pos.y += v.velocity.y * dt;
        // Ease the climb rate down as it levels into a glide.
        v.velocity.y = Math.max(Tuning.VULTURE_GLIDE_CLIMB, v.velocity.y - 2.0 * dt);
        v.mesh.rotation.set(0, v.heading + Math.PI / 2, -0.12);   // banked, +π/2 since model faces +X
        // Despawn once it's flown far away (out of sight).
        const dx = v.pos.x - v.perch.x, dz = v.pos.z - v.perch.z;
        if (dx * dx + dz * dz > Tuning.VULTURE_DESPAWN_DIST * Tuning.VULTURE_DESPAWN_DIST) {
          ctx.three.scene.remove(v.mesh);
          _colliderToVulture.delete(v.collider.handle);
          ctx.physics.world.removeRigidBody(v.body);
          _vultures.splice(k, 1);
          continue;
        }
        break;
      }
      case 'dead': {
        if (!v.landed) {
          // Fall under gravity until the ground, then flop + tag.
          v.velocity.y -= Tuning.VULTURE_GRAVITY * dt;
          v.pos.x += v.fleeDir.x * 1.0 * dt;   // a little forward drift as it tumbles
          v.pos.z += v.fleeDir.z * 1.0 * dt;
          v.pos.y += v.velocity.y * dt;
          // tumble while falling
          v.mesh.rotation.x += dt * 5.0;
          const groundY = ctx.terrain.heightAt(v.pos.x, v.pos.z);
          if (v.pos.y <= groundY + 0.06) {
            v.pos.y = groundY + 0.06;
            applyDeadVulturePose(v);
          }
        }
        break;
      }
    }

    // Articulate the rig for this state (idle bob / flap / landing flare / limp).
    animateVulture(v, ctx.time.elapsed);

    // Sync mesh + kinematic body to pos (perched sets its own Y above).
    if (v.state !== 'perched') {
      v.mesh.position.set(v.pos.x, v.pos.y, v.pos.z);
    }
    v.body.setNextKinematicTranslation({ x: v.pos.x, y: v.pos.y + 0.26, z: v.pos.z });
  }
}

/** Read-only access for save/restore + ctx wiring. */
export function getVultures(): Vulture[] {
  return _vultures;
}
