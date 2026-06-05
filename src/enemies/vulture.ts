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

export type VultureState = 'perched' | 'flee' | 'dead';

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

  // ── Legs + talons (feet at y≈0, gripping the perch). Short, stout. ──
  for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.13, 6), _bareSkin);
    leg.position.set(-0.02, 0.07, sz * 0.05);
    leg.rotation.z = sz * 0.12;
    g.add(leg);
    // foot + 3 forward talons gripping the branch
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.03, 6), _bareSkin);
    foot.position.set(-0.02, 0.012, sz * 0.05);
    g.add(foot);
    for (const ta of [-0.5, 0, 0.5]) {
      const claw = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.009, 0.05, 4), _beakMat);
      claw.position.set(-0.02 + Math.cos(ta) * 0.03, 0.006, sz * 0.05 + Math.sin(ta) * 0.03);
      claw.rotation.set(Math.PI / 2.2, 0, ta);
      g.add(claw);
    }
  }

  // ── Body — a plump, hunched ovoid (broad at the shoulders, tapering to the
  //    tail). Slightly flattened. Sits above the legs. ──
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), _plumage);
  body.scale.set(1.35, 1.05, 1.0);   // long (X) + a touch tall
  body.position.set(-0.02, 0.26, 0);
  g.add(body);
  // Hunched upper-back hump (broad shoulders).
  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 8), _plumage);
  hump.scale.set(1.2, 0.9, 1.0);
  hump.position.set(-0.08, 0.36, 0);
  g.add(hump);

  // ── Folded wings — large flattened slabs draped down each side, angled so the
  //    primaries hang toward the tail. Layered (under + over) for depth (rule 7). ──
  for (const sz of [-1, 1]) {
    // Folded wing draped down the side — large, angled so it hangs along the body.
    const wing = box(0.33, 0.02, 0.19, _plumage);
    wing.position.set(-0.05, 0.25, sz * 0.165);
    wing.rotation.set(sz * 0.66, 0.0, 0.04);
    g.add(wing);
    // Primaries (lighter feather tips) jutting back past the tail — the folded
    // wingtip a perched vulture shows.
    const prim = box(0.18, 0.016, 0.085, _plumageEdge);
    prim.position.set(-0.17, 0.17, sz * 0.16);
    prim.rotation.set(sz * 0.8, 0.3, 0.12);
    g.add(prim);
  }

  // ── Tail — short stiff fan angled down/back. ──
  const tail = box(0.10, 0.016, 0.14, _plumageEdge);
  tail.position.set(-0.21, 0.21, 0);
  tail.rotation.set(0, 0, 0.25);
  g.add(tail);

  // ── Feather ruff at the neck base (collar of feathers the bald neck rises
  //    from). A flattened torus around the shoulders/front. ──
  const ruff = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.03, 8, 14), _plumageEdge);
  ruff.position.set(0.06, 0.34, 0);
  ruff.rotation.set(0, 0, Math.PI / 2);
  ruff.scale.set(1.0, 1.0, 0.7);
  g.add(ruff);

  // ── Neck — bald, an S-curve hunched into the shoulders then forward to the
  //    head. Two tapered segments. ──
  const neck1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.10, 7), _bareSkin);
  neck1.position.set(0.08, 0.39, 0);
  neck1.rotation.z = -0.6;
  g.add(neck1);
  const neck2 = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.08, 7), _bareSkin);
  neck2.position.set(0.15, 0.42, 0);
  neck2.rotation.z = -1.1;
  g.add(neck2);

  // ── Head — small bald dome at the neck top. ──
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), _bareSkin);
  head.position.set(0.20, 0.44, 0);
  g.add(head);
  // Heavy hooked beak — a base cone + a down-curved tip.
  const beakBase = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.07, 7), _beakMat);
  beakBase.position.set(0.245, 0.435, 0);
  beakBase.rotation.z = -Math.PI / 2;
  g.add(beakBase);
  const hook = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.035, 6), _beakMat);
  hook.position.set(0.285, 0.418, 0);
  hook.rotation.z = -Math.PI / 1.5;
  g.add(hook);
  // Eyes — tiny dark beads on the head sides.
  for (const sz of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6), _eyeMat);
    eye.position.set(0.225, 0.452, sz * 0.03);
    g.add(eye);
  }

  return g;
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
): Vulture {
  const mesh = makeVultureVisual();
  mesh.position.set(perch.x, perch.y, perch.z);
  const heading = Math.random() * Math.PI * 2;
  mesh.rotation.y = heading;
  scene.add(mesh);

  // Kinematic body + capsule around the body centre (~0.26 above the feet).
  const cy = perch.y + 0.26;
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
    pos: new THREE.Vector3(perch.x, perch.y, perch.z),
    perch: new THREE.Vector3(perch.x, perch.y, perch.z),
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
  perches: ReadonlyArray<THREE.Vector3>,
  scatterRand: () => number,
): Vulture[] {
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
    const p = perches[i];
    if (chosen.some((c) => (c.x - p.x) ** 2 + (c.z - p.z) ** 2 < minSepSq)) continue;
    chosen.push(p);
    spawnVulture(scene, world, p);
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
        // Subtle idle: gentle head/body bob.
        v.bob += dt * 1.4;
        v.mesh.position.y = v.perch.y + Math.sin(v.bob) * 0.01;
        // Player got close → launch.
        if (horizDistSq < spotRSq) {
          v.state = 'flee';
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
      case 'flee': {
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

    // Sync mesh + kinematic body to pos (perched handled its own bob Y above).
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
