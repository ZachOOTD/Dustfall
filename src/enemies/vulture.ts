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
  /** Elbow sub-pivots (at the wrist) — fold the forearm+primaries for perching,
   *  open them for the broad flight span. Children of wingL/wingR. */
  elbowL: THREE.Group; elbowR: THREE.Group;
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
  /** ACAI (T4) — relocation target perch (world) when flying to another tree. */
  target: THREE.Vector3;
  /** ACAI (T4) — the target branch direction (for the across-limb landing yaw). */
  targetDir: THREE.Vector3;
  /** ACAI (T4) — true while flying to a relocation perch; false = flee+despawn. */
  relocating: boolean;
  /** Heading (radians, atan2(dirX,dirZ)) the mesh yaws toward. */
  heading: number;
  /** ACAI f/u — previous-frame heading + smoothed roll, for banking into turns. */
  prevHeading: number;
  bank: number;
  /** idle phase accumulator (perched bob). */
  bob: number;
  hovered: boolean;
  /** true once landed dead (lootable on the ground). */
  landed: boolean;
  /** ACAI (T5) — low-motion settle timer + total time since death (s), used to
   *  decide when a dynamic-body corpse has come to rest. */
  settleT: number;
  deathAge: number;
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

  // ── Wings — broad TWO-segment wings (vulture-proportioned). Each shoulder pivot
  //    carries an upper-arm bone that extends spanwise (±Z); an elbow sub-pivot at
  //    the wrist carries the forearm + a fan of slotted primary feathers. Folding
  //    the elbow + drooping the shoulder gives the tucked perched silhouette;
  //    opening them spreads a wingspan ~3× the body width. Chord runs along X
  //    (front↔back), span along Z (shoulder→tip). animateVulture poses both. ──
  const wings: THREE.Group[] = [];
  const elbows: THREE.Group[] = [];
  for (const sz of [-1, 1]) {
    const shoulder = pivot(-0.04, 0.30, sz * 0.06);
    // Upper-arm (humerus+secondaries): broad slab extending outward in +sz*Z.
    const arm = box(0.19, 0.022, 0.20, _plumage);
    arm.position.set(-0.02, 0, sz * 0.10);
    shoulder.add(arm);
    // Elbow/wrist pivot at the arm's outboard end.
    const elbow = new THREE.Group();
    elbow.position.set(-0.02, 0, sz * 0.20);
    shoulder.add(elbow);
    // Forearm — narrower chord, continues the span.
    const fore = box(0.15, 0.02, 0.18, _plumage);
    fore.position.set(-0.015, 0, sz * 0.085);
    elbow.add(fore);
    // Slotted primary feathers — long fingers continuing the span, only slightly
    // separated (a tight blade folded, a slotted tip when spread). A big rake here
    // fans them into a spiky crest, so keep it subtle.
    for (let i = 0; i < 4; i++) {
      const prim = box(0.055, 0.014, 0.19, _plumageEdge);
      const rake = 0.05 + i * 0.05;                 // gentle finger separation
      prim.position.set(-0.04 - i * 0.018, 0, sz * (0.17 + i * 0.012));
      prim.rotation.set(0, sz * rake, 0);
      elbow.add(prim);
    }
    wings.push(shoulder);
    elbows.push(elbow);
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

  const rig: VultureRig = {
    wingL: wings[0], wingR: wings[1],
    elbowL: elbows[0], elbowR: elbows[1],
    neck, tail, legL: legs[0], legR: legs[1],
  };
  g.userData.rig = rig;
  return g;
}

/** ACAI — pose the rig per state each frame. At rest the bird is the perched
 *  silhouette; this articulates wings/neck/legs/tail for idle / flap / landing /
 *  death. Driven by `elapsed` (sinusoids) — see VULTURE_* tuning. */
export function animateVulture(v: Vulture, elapsed: number): void {
  const rig = v.mesh.userData.rig as VultureRig | undefined;
  if (!rig) return;
  const { wingL, wingR, elbowL, elbowR, neck, tail, legL, legR } = rig;
  const ph = elapsed + v.id * 1.7;   // de-sync birds

  // Mirrored wing pose: (shoulder rot.x = dihedral/flap, shoulder rot.y = sweep,
  // elbow rot.x = wrist tilt, elbow rot.y = forearm FOLD toward the tail). The R
  // wing mirrors the L across the body, so a single call drives both symmetrically.
  const poseWings = (sx: number, sy: number, ex: number, ey: number): void => {
    wingL.rotation.set(sx, sy, 0); wingR.rotation.set(-sx, -sy, 0);
    elbowL.rotation.set(ex, ey, 0); elbowR.rotation.set(-ex, -ey, 0);
  };

  switch (v.state) {
    case 'perched': {
      // Idle: slow head bob + look-around; wings DROOPED down the flanks + elbows
      // FOLDED back so the long wings tuck into the hunched perched silhouette.
      neck.rotation.z = Math.sin(ph * Tuning.VULTURE_IDLE_BOB_HZ * Math.PI * 2) * Tuning.VULTURE_IDLE_BOB_AMP;
      neck.rotation.y = Math.sin(ph * 0.23) * 0.12;
      const settle = Math.sin(ph * 0.7) * 0.04;   // faint wing shuffle
      poseWings(Tuning.VULTURE_PERCH_WING_DROOP + settle, 0, 0, Tuning.VULTURE_ELBOW_FOLD);
      legL.rotation.set(0, 0, 0); legR.rotation.set(0, 0, 0);
      tail.rotation.set(0, 0, 0);
      break;
    }
    case 'flying': {
      // Broad wings held out (dihedral) with the elbows OPEN; flap comes in BURSTS
      // gated by a slow glide-cycle envelope (flap a few beats, then glide).
      const glide = Math.sin(elapsed * Tuning.VULTURE_GLIDE_CYCLE_HZ * Math.PI * 2 + v.id * 2.1);
      const flapEnv = Math.max(0, glide);                 // 0 = gliding, →1 = flapping hard
      const beat = Math.sin(elapsed * Tuning.VULTURE_FLAP_HZ * Math.PI * 2);
      const passive = Math.sin(elapsed * 1.4 + v.id) * 0.05 * (1 - flapEnv);   // soft glide bob
      const sx = Tuning.VULTURE_DIHEDRAL + beat * Tuning.VULTURE_FLAP_AMP * flapEnv + passive;
      const elbowFlex = beat * 0.12 * flapEnv;            // wrist follows the beat slightly
      poseWings(sx, 0, elbowFlex, -0.08);
      neck.rotation.set(0, 0, Tuning.VULTURE_NECK_EXTEND);
      legL.rotation.set(0, 0, -Tuning.VULTURE_LEG_TUCK); legR.rotation.set(0, 0, Tuning.VULTURE_LEG_TUCK);
      tail.rotation.set(0, 0, -0.3);
      break;
    }
    case 'landing': {
      // Flare: wings cupped forward + spread wide as an airbrake, fluttering; elbows
      // mostly open; legs reach DOWN; neck up; tail fans.
      const flutter = Math.sin(elapsed * Tuning.VULTURE_FLAP_HZ * 1.6 * Math.PI * 2) * 0.16;
      poseWings(0.5 + flutter, -0.32, 0, -0.1);   // wings raised + spread + cupped forward (airbrake)
      neck.rotation.set(0, 0, -0.25);
      legL.rotation.set(0, 0, 0.15); legR.rotation.set(0, 0, -0.15);    // reaching for the perch
      tail.rotation.set(0, 0, 0.5);                                     // fanned down
      break;
    }
    case 'dead': {
      // Limp — wings splayed half-open, head drooped, legs slack. Static (body tumbles).
      poseWings(-0.6, 0, 0, -0.5);
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

const _deadBox = new THREE.Box3();
const _deadSize = new THREE.Vector3();
const _deadCenter = new THREE.Vector3();
const _deadOrigin = new THREE.Vector3();
const _deadLocalOff = new THREE.Vector3();
const _deadQ = new THREE.Quaternion();

/** Combat hit kills the vulture: swap the kinematic body for a DYNAMIC one that
 *  tumbles to the ground (mirrors the dropped-item physics) and set the limp
 *  rig pose once. The update loop syncs the mesh from the body until it settles,
 *  then tags it lootable. */
export function damageVulture(vulture: Vulture, _dmg: number, ctx: GameContext): void {
  if (vulture.state === 'dead') return;
  const wasFlying = vulture.state === 'flying' || vulture.state === 'landing';
  vulture.state = 'dead';
  vulture.landed = false;
  vulture.settleT = 0;
  vulture.deathAge = 0;

  const mesh = vulture.mesh;
  // Limp pose once; bake it into the world matrices before measuring the AABB.
  animateVulture(vulture, 0);
  mesh.updateMatrixWorld(true);

  const world = ctx.physics.world;
  // Tear down the kinematic body + its combat collider.
  _colliderToVulture.delete(vulture.collider.handle);
  world.removeRigidBody(vulture.body);

  // Cuboid from the posed mesh AABB. The body origin stays at the mesh origin
  // (the feet), with the collider OFFSET to the body centre in local space — so
  // the body spins about its centre of mass while body.translation() still maps
  // straight onto mesh.position.
  _deadBox.setFromObject(mesh);
  _deadBox.getSize(_deadSize);
  _deadBox.getCenter(_deadCenter);
  mesh.getWorldPosition(_deadOrigin);
  _deadLocalOff.copy(_deadCenter).sub(_deadOrigin)
    .applyQuaternion(_deadQ.copy(mesh.quaternion).invert());
  const hx = Math.max(0.05, _deadSize.x * 0.5);
  const hy = Math.max(0.05, _deadSize.y * 0.5);
  const hz = Math.max(0.05, _deadSize.z * 0.5);

  const bd = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(_deadOrigin.x, _deadOrigin.y, _deadOrigin.z)
    .setRotation({ x: mesh.quaternion.x, y: mesh.quaternion.y, z: mesh.quaternion.z, w: mesh.quaternion.w })
    .setLinearDamping(0.6)
    .setAngularDamping(0.8)
    .setCcdEnabled(true);   // fast fall → CCD prevents heightfield tunneling
  // Seed momentum: carry horizontal flee drift (if airborne) + a downward kick.
  const drift = wasFlying ? Tuning.VULTURE_FLEE_SPEED * 0.5 : 0;
  bd.setLinvel(
    vulture.fleeDir.x * drift,
    Math.min(vulture.velocity.y, -0.8),
    vulture.fleeDir.z * drift,
  );
  const body = world.createRigidBody(bd);
  // Tumble spin (deterministic-ish per bird; game code → Math.random OK).
  const spin = Tuning.VULTURE_DEATH_SPIN;
  body.setAngvel(
    { x: (Math.random() - 0.5) * spin, y: (Math.random() - 0.5) * spin, z: (Math.random() - 0.5) * spin },
    true,
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setTranslation(_deadLocalOff.x, _deadLocalOff.y, _deadLocalOff.z)
      .setFriction(0.85)
      .setRestitution(0.15)
      .setDensity(0.5),
    body,
  );
  vulture.body = body;
  vulture.collider = collider;
}

/** Apply the landed-dead visual + 'take' retag. Safe on a fresh restore (no
 *  dynamic body — used by save-load to re-flop a saved dead bird statically). */
export function applyDeadVulturePose(vulture: Vulture): void {
  vulture.state = 'dead';
  animateVulture(vulture, 0);                                   // limp wings/neck/legs
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
  mesh.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
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
    target: new THREE.Vector3(perch.x, py, perch.z),
    targetDir: new THREE.Vector3(1, 0, 0),
    relocating: false,
    heading,
    prevHeading: heading,
    bank: 0,
    bob: Math.random() * Math.PI * 2,
    hovered: false,
    landed: false,
    settleT: 0,
    deathAge: 0,
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

/** ACAI (T4) — pick a relocation perch on a DIFFERENT tree, far from the player.
 *  Returns null if none qualifies (caller then falls back to flee + despawn). */
function pickRelocateTarget(
  v: Vulture,
  playerX: number,
  playerZ: number,
): TreePerch | null {
  const minTreeSq = Tuning.VULTURE_RELOCATE_MIN_DIST * Tuning.VULTURE_RELOCATE_MIN_DIST;
  const safePlayerSq = (Tuning.VULTURE_SPOT_RADIUS * 2.5) ** 2;
  let best: TreePerch | null = null;
  let bestScore = -Infinity;
  for (const p of _perchPool) {
    const dTreeSq = (p.pos.x - v.perch.x) ** 2 + (p.pos.z - v.perch.z) ** 2;
    if (dTreeSq < minTreeSq) continue;                 // must be a different, distant tree
    const dPlayerSq = (p.pos.x - playerX) ** 2 + (p.pos.z - playerZ) ** 2;
    if (dPlayerSq < safePlayerSq) continue;            // not near the player
    // Prefer perches far from the player but not absurdly distant from here.
    const score = dPlayerSq - dTreeSq * 0.15;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

/** ACAI f/u — yaw to the flight heading + roll-bank INTO the turn (the inside wing
 *  dips when steering). Smooths a per-frame heading delta into `v.bank`. */
function applyFlightOrientation(v: Vulture, dt: number): void {
  let dH = v.heading - v.prevHeading;
  while (dH > Math.PI) dH -= Math.PI * 2;
  while (dH < -Math.PI) dH += Math.PI * 2;
  const turnRate = dt > 1e-4 ? dH / dt : 0;
  const targetBank = Math.max(-Tuning.VULTURE_BANK_ANGLE, Math.min(Tuning.VULTURE_BANK_ANGLE, turnRate * 0.25));
  v.bank += (targetBank - v.bank) * Math.min(1, dt * 5);
  v.prevHeading = v.heading;
  v.mesh.rotation.set(0, v.heading + Math.PI / 2, v.bank);
}

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
        // Player got close → launch off the perch.
        if (horizDistSq < spotRSq) {
          v.state = 'flying';
          v.velocity.set(0, Tuning.VULTURE_CLIMB_RATE, 0);
          // Prefer relocating to another tree; fall back to a straight flee if
          // no distant, player-safe perch exists.
          const tgt = pickRelocateTarget(v, playerTr.x, playerTr.z);
          if (tgt) {
            v.relocating = true;
            v.target.copy(tgt.pos);
            v.targetDir.copy(tgt.dir);
            v.heading = Math.atan2(tgt.pos.x - v.pos.x, tgt.pos.z - v.pos.z);
          } else {
            v.relocating = false;
            _toPlayer.normalize();
            v.fleeDir.set(-_toPlayer.x, 0, -_toPlayer.z);
            if (v.fleeDir.lengthSq() < 1e-4) v.fleeDir.set(1, 0, 0);
            v.fleeDir.normalize();
            v.heading = Math.atan2(v.fleeDir.x, v.fleeDir.z);
          }
          v.prevHeading = v.heading;   // fresh bank reference (no stale-heading lurch)
          v.bank = 0;
        }
        break;
      }
      case 'flying': {
        const sp = Tuning.VULTURE_FLEE_SPEED;
        if (v.relocating) {
          // Steer horizontally toward the target perch; climb toward a cruise
          // altitude above it (ascending arc), banked into the heading.
          const hx = v.target.x - v.pos.x, hz = v.target.z - v.pos.z;
          const hd = Math.sqrt(hx * hx + hz * hz);
          const dirx = hd > 1e-3 ? hx / hd : 0;
          const dirz = hd > 1e-3 ? hz / hd : 0;
          v.pos.x += dirx * sp * dt;
          v.pos.z += dirz * sp * dt;
          const cruiseY = v.target.y + Tuning.VULTURE_CRUISE_HEIGHT;
          const dy = cruiseY - v.pos.y;
          v.pos.y += Math.max(-Tuning.VULTURE_CLIMB_RATE * dt, Math.min(Tuning.VULTURE_CLIMB_RATE * dt, dy));
          // Never sink through the dunes between trees — the cruise altitude is
          // relative to the DESTINATION, so clamp to the terrain right here.
          const minY = ctx.terrain.heightAt(v.pos.x, v.pos.z) + Tuning.VULTURE_MIN_FLIGHT_CLEARANCE;
          if (v.pos.y < minY) v.pos.y = minY;
          v.heading = Math.atan2(dirx, dirz);
          applyFlightOrientation(v, dt);
          // If the player drifts near the chosen target, re-pick a safer one.
          const pdx = v.target.x - playerTr.x, pdz = v.target.z - playerTr.z;
          if (pdx * pdx + pdz * pdz < spotRSq) {
            const nt = pickRelocateTarget(v, playerTr.x, playerTr.z);
            if (nt) { v.target.copy(nt.pos); v.targetDir.copy(nt.dir); }
          }
          // Arrived overhead + player not near the target → begin the landing flare.
          if (hd < Tuning.VULTURE_LAND_ARRIVE_DIST) {
            const ppx = v.pos.x - playerTr.x, ppz = v.pos.z - playerTr.z;
            if (ppx * ppx + ppz * ppz > spotRSq) v.state = 'landing';
          }
        } else {
          // Fallback: ascending flee arc away from the perch, then despawn.
          v.pos.x += v.fleeDir.x * sp * dt;
          v.pos.z += v.fleeDir.z * sp * dt;
          v.pos.y += v.velocity.y * dt;
          v.velocity.y = Math.max(Tuning.VULTURE_GLIDE_CLIMB, v.velocity.y - 2.0 * dt);
          // Stay above the terrain as it flees across biomes (no dune clipping).
          const minY = ctx.terrain.heightAt(v.pos.x, v.pos.z) + Tuning.VULTURE_MIN_FLIGHT_CLEARANCE;
          if (v.pos.y < minY) v.pos.y = minY;
          v.heading = Math.atan2(v.fleeDir.x, v.fleeDir.z);
          applyFlightOrientation(v, dt);
          const dx = v.pos.x - v.perch.x, dz = v.pos.z - v.perch.z;
          if (dx * dx + dz * dz > Tuning.VULTURE_DESPAWN_DIST * Tuning.VULTURE_DESPAWN_DIST) {
            ctx.three.scene.remove(v.mesh);
            _colliderToVulture.delete(v.collider.handle);
            ctx.physics.world.removeRigidBody(v.body);
            _vultures.splice(k, 1);
            continue;
          }
        }
        break;
      }
      case 'landing': {
        // Descend to the target perch, easing horizontally onto it; the flare
        // pose comes from animateVulture('landing'). Player re-approach → re-launch.
        if (horizDistSq < spotRSq) {
          v.state = 'flying';
          v.relocating = false;
          _toPlayer.normalize();
          v.fleeDir.set(-_toPlayer.x, 0, -_toPlayer.z);
          if (v.fleeDir.lengthSq() < 1e-4) v.fleeDir.set(1, 0, 0);
          v.fleeDir.normalize();
          v.heading = Math.atan2(v.fleeDir.x, v.fleeDir.z);
          v.velocity.set(0, Tuning.VULTURE_CLIMB_RATE, 0);
          v.prevHeading = v.heading; v.bank = 0;
          break;
        }
        const hx = v.target.x - v.pos.x, hz = v.target.z - v.pos.z;
        const hd = Math.sqrt(hx * hx + hz * hz);
        const step = Math.min(hd, Tuning.VULTURE_FLEE_SPEED * Tuning.VULTURE_LAND_SPEED_FACTOR * dt);
        if (hd > 1e-3) { v.pos.x += (hx / hd) * step; v.pos.z += (hz / hd) * step; }
        const dy = v.target.y - v.pos.y;
        v.pos.y += Math.max(-Tuning.VULTURE_LAND_DESCENT * dt, Math.min(Tuning.VULTURE_LAND_DESCENT * dt, dy));
        const landHeading = Math.atan2(v.targetDir.x, v.targetDir.z) + Math.PI / 2;
        v.mesh.rotation.set(0, landHeading, 0);
        // Touchdown → re-perch on the new tree.
        if (hd < 0.25 && Math.abs(dy) < 0.1) {
          v.perch.copy(v.target);
          v.pos.copy(v.target);
          v.heading = landHeading;
          v.relocating = false;
          v.mesh.rotation.set(0, landHeading, 0);
          v.body.setNextKinematicTranslation({ x: v.pos.x, y: v.pos.y + 0.26, z: v.pos.z });
          v.state = 'perched';
        }
        break;
      }
      case 'dead': {
        if (!v.landed) {
          // Dynamic body (built in damageVulture) tumbles to the dunes; copy its
          // transform onto the mesh until it settles, then tag it lootable.
          const t = v.body.translation();
          const r = v.body.rotation();
          v.mesh.position.set(t.x, t.y, t.z);
          v.mesh.quaternion.set(r.x, r.y, r.z, r.w);
          v.pos.set(t.x, t.y, t.z);
          v.deathAge += dt;
          // Key the settle on LINEAR velocity only — a corpse resting on the
          // heightfield keeps spurious angular jitter from mesh-vs-triangle
          // contact, which would otherwise never let it "settle".
          const lv = v.body.linvel();
          const linMotion = lv.x * lv.x + lv.y * lv.y + lv.z * lv.z;
          if (linMotion < Tuning.VULTURE_SETTLE_VEL * Tuning.VULTURE_SETTLE_VEL) {
            v.settleT += dt;
          } else {
            v.settleT = 0;
          }
          // Land when it has rested for a beat, the body has slept (auto on the
          // heightfield), or a hard age cap elapses (heightfield micro-jitter can
          // otherwise keep a near-stationary corpse from ever sleeping).
          if (v.settleT > 0.3 || v.body.isSleeping() || v.deathAge > Tuning.VULTURE_SETTLE_MAX_AGE) {
            v.landed = true;
            v.body.sleep();             // rest on the dune
            tagVultureTake(v.mesh, v.id);
          }
        }
        // Dead birds drive the mesh from the body — skip the rig pose + kinematic
        // sync below (the limp pose was baked once at death).
        continue;
      }
    }

    // Articulate the rig for this state (idle bob / flap / landing flare).
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
