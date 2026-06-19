// Giant sand worm (Session DD-2) — roaming Dune-style underground predator.
//
// Behavior loop:
//   patrol → alert → charging → lunge → retreat → (alert | stationaryBreach) → ...
//   Every Nth retreat cycles into stationaryBreach instead of another lunge so
//   the player gets a different read on the threat.
//
// Mesh: long horizontal body along local +X (head at +X tip, tail at -X).
// 12 tapered ring segments, lamprey-style toothed maw at the head. No
// weak-point ring. Hits only count during lunge or stationaryBreach (the
// player can't damage the worm while it's underground or charging).
//
// Movement: kinematic body with cuboid collider (rotated to match the
// worm's yaw + pitch). Worm Y is set to (groundY - UNDERGROUND_DEPTH) while
// submerged; arcs above ground during lunge / rises vertically during
// stationaryBreach.
//
// Tuning lives in tuning.ts under "// Sand worm".

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import type { Terrain } from '../world/terrain.ts';
import { createSkinMaterial } from '../world/skinMaterial.ts';
import {
  playWormRoar,
  playWormRoarAttenuated,
  playWormChomp,
  playHit,
  playPlayerHurt,
  startWormRumble,
  setWormRumbleLevel,
  stopWormRumble,
} from '../audio/audio.ts';
import { die } from '../stats/survival.ts';
import type { BiomeSampler } from '../world/biomes.ts';
import { findBiomeCentroid } from '../world/biomes.ts';
import type { Rng } from '../core/rng.ts';
import { isPryingActive } from '../player/interaction.ts';
import { getPlayerPos } from '../util/playerPos.ts';
import type { RopeEndpoint } from '../world/rope.ts';

export type SandWormState =
  | 'patrol'
  | 'alert'
  | 'charging'
  | 'lunge'
  | 'stationaryBreach'
  | 'retreat'
  | 'feeding'         // ABJ — B12: bait-and-strike loop; worm surfaces at a meat pickup
  | 'ambush'          // ABO — B3: lurking submerged, skips alert+charging; snaps to lunge when player closes
  | 'dead';

const SEGMENT_COUNT = 12;
// Local +X is the worm's length axis. World position = body center.
// HALF_LEN = LENGTH/2 — head at +HALF_LEN, tail at -HALF_LEN.
const HALF_LEN_FALLBACK = 12;

export interface SandWorm {
  /** ACE Tier 2 — stable per-spawn identifier so interaction.ts can
   *  resolve the right worm from a raycast hit + save/load can match
   *  saved worms back to their in-world instances. Allocated by the
   *  module-level _nextWormId counter on spawn. */
  id: number;
  state: SandWormState;
  health: number;
  /** World position of the worm's body center (mid-point along its length). */
  basePos: THREE.Vector3;
  /** Anchor point around which patrol orbits. */
  home: THREE.Vector3;
  /** Local-ground height at the worm's current XZ — sampled on entry to
   *  surface states (lunge/stationaryBreach) so the arc references the
   *  terrain at the breach location, not the home anchor. */
  surfaceGroundY: number;
  mesh: THREE.Group;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  hovered: boolean;
  looted: boolean;
  /** Patrol orbit angle, radians. Increments each frame in patrol. */
  patrolTheta: number;
  /** Wall-clock elapsed time the current phase started — drives arc anim. */
  phaseStartedAt: number;
  /** XZ destination the worm is steering toward. For 'charging', this is
   *  the player's position SNAPSHOTTED at enterCharging — the charge is
   *  committed and the player can dodge by sidestepping before the worm
   *  arrives. For alert/retreat, it's a live target. */
  target: THREE.Vector3;
  /** Lunge arc start XZ + end XZ — set when entering lunge. */
  lungeStart: THREE.Vector3;
  lungeEnd: THREE.Vector3;
  /** Counter incremented per completed attack — every Nth attack is a
   *  stationaryBreach instead of a lunge. */
  attackCount: number;
  /** Internal flag — damage applied this lunge pass. */
  _biteDealt: boolean;
  /** Current yaw (rad) — rotation around world Y. */
  yaw: number;
  /** Current pitch (rad) — rotation around the worm's local Z (head up/down). */
  pitch: number;
  /** Side-to-side sway (rad) — additional tilt around the worm's lateral
   *  world axis. Used by stationaryBreach for the cobra-rearing wiggle. */
  sway: number;
  /** Per-frame body bend amplitude (m) — how much the middle of the worm
   *  arches above its base line. Lunge cranks this up to make the body
   *  look curved through the air; other states leave it at 0. */
  bend: number;
  particles: SandPuff[];
  /** Smoothed wake-puff cadence. */
  nextWakePuffAt: number;
  /** Next time to emit tremor dust at the player's feet. */
  nextTremorDustAt: number;
  /** ABJ — B12: pickup id of the meat bait the worm is currently
   *  feeding on. Cleared on consume (mid-descent). Undefined outside
   *  the feeding state. */
  _feedBaitPickupId?: number;
  /** ABO — B3: wall-clock seconds before which the worm cannot enter
   *  ambush again. Set on ambush trigger (consume → retreat) so the
   *  worm doesn't lock into a constant pop-up pattern. */
  _ambushCooldownUntil: number;
  /** ACC — twilight breach cooldown. Set on entering an ambient
   *  twilight stationaryBreach (from patrol) so the worm doesn't
   *  pop up repeatedly during a single dawn/dusk window. */
  _twilightBreachCooldownUntil: number;
  /** ACC — flag set on entering a twilight breach; checked at
   *  breach exit so the worm returns straight to patrol instead of
   *  the retreat→alert combat loop. */
  _isTwilightBreach: boolean;
  /** ACF — B1 Phase 3 follow-up: when this carcass is being towed behind
   *  the speeder, the rope's anchor end (speeder only — too massive to drag
   *  on foot). The carcass is the TOWED body; updateKillDrag enforces the
   *  rope constraint. { kind: 'none' } / undefined = not being towed. Only
   *  meaningful when state === 'dead'. */
  dragAnchor?: RopeEndpoint;
}

interface SandPuff {
  sprite: THREE.Sprite;
  age: number;
  ttl: number;
  vx: number;
  vy: number;
  vz: number;
  baseScale: number;
}

// ACE Tier 2 — multi-worm. Pre-ACE was a singleton; now a Map so combat.ts
// can look up which worm an LMB-cast hit belongs to. Populated in
// spawnSandWorm; entries linger for the life of the program (worms aren't
// destroyed, only state-transitioned to 'dead').
const _colliderToWorm: Map<number, SandWorm> = new Map();

export function getSandWormForCollider(handle: number): SandWorm | undefined {
  return _colliderToWorm.get(handle);
}

// ─────────────────────────────────────────────────────────────────────────
// Mesh assembly — horizontal worm along local +X
// ─────────────────────────────────────────────────────────────────────────

function makePuffTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0.0, 'rgba(200,180,140,0.9)');
  grad.addColorStop(0.5, 'rgba(170,150,110,0.5)');
  grad.addColorStop(1.0, 'rgba(140,120,90,0.0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

const _puffTexture = makePuffTexture();

function tag(root: THREE.Object3D, type: 'kill' | 'take', id: number): void {
  root.traverse((o) => {
    o.userData.interactType = type;
    o.userData.interactId = id;
    o.userData.interactRegistry = 'sandWorms';
  });
}

// ACE Tier 2 — module-level id allocator. Mirrors sled.ts / stake.ts.
let _nextWormId = 1;

export function setNextSandWormId(n: number): void {
  if (n >= _nextWormId) _nextWormId = n + 1;
}

export function findSandWormById(list: SandWorm[], id: number | undefined): SandWorm | undefined {
  if (id === undefined) return undefined;
  return list.find((w) => w.id === id);
}

function untag(root: THREE.Object3D): void {
  root.traverse((o) => {
    delete o.userData.interactType;
    delete o.userData.interactId;
    delete o.userData.interactRegistry;
  });
}

/** Per-segment radius profile: narrow tail, peak ~70% along, taper to head.
 *  idx 0 = tail tip, idx SEGMENT_COUNT = head face. */
function segmentRadius(idx: number): number {
  const t = idx / SEGMENT_COUNT;
  // Piecewise linear: 0.28 @ tail → 1.0 @ t=0.65 → 0.62 @ head.
  // Wider toward the front (where the maw is) than the tail.
  const peakT = 0.65;
  const ramp = t <= peakT
    ? 0.28 + (1.0 - 0.28) * (t / peakT)
    : 1.0 - (1.0 - 0.62) * ((t - peakT) / (1 - peakT));
  return ramp * Tuning.SANDWORM_MAX_RADIUS;
}

function makeWormMesh(): { group: THREE.Group } {
  const group = new THREE.Group();
  // AAL — split body material: closed segments use FrontSide (cheaper +
  // doesn't look paper-thin on the visible body taper); openEnded head
  // segments use DoubleSide so the inside of the maw cavity renders
  // when looking down the throat. Pre-AAL the whole body was DoubleSide.
  // ABH — sandworm body gets the organic-skin procedural shader
  // (scale-cell pattern + pigment blotches + faint veins + sheen).
  // The accent color shifts toward the ridge-band brown so the
  // pigment blotches read as natural skin variation, not random.
  // Large scale size (12) suits the worm's massive radius — scales
  // visible from medium distance without becoming a graphic pattern.
  // ABN — localSpace so scale-cell pattern stays anchored to the worm
  // body as it patrols / lunges. Without it the FBM noise re-samples in
  // world coords each frame, making the texture detail crawl along the
  // length of the worm as it moves.
  const bodyMat = createSkinMaterial(0xa89878, {
    accentColor: 0x6a5232,
    scaleSize: 12.0,
    sheen: 0.35,
    localSpace: true,
  });
  const bodyMatOpen = createSkinMaterial(0xa89878, {
    accentColor: 0x6a5232,
    scaleSize: 12.0,
    sheen: 0.35,
    doubleSide: true,
    localSpace: true,
  });
  const ridgeMat = new THREE.MeshLambertMaterial({ color: 0x5c4a32, flatShading: true });
  const throatMat = new THREE.MeshLambertMaterial({
    color: 0x0a0805,
    emissive: 0x4a1808,
    emissiveIntensity: 0.45,
    side: THREE.BackSide, // visible looking down the throat from outside
  });
  const throatBackMat = new THREE.MeshLambertMaterial({
    color: 0x040303,
    emissive: 0x2a0c04,
    emissiveIntensity: 0.35,
  });
  const toothMat = new THREE.MeshLambertMaterial({ color: 0xd8c9a8, flatShading: true });

  const length = Tuning.SANDWORM_LENGTH;
  const segmentLen = length / SEGMENT_COUNT;
  const halfLen = length / 2;

  // Build SEGMENT_COUNT body segments along +X. Worm origin = body center,
  // head face at +halfLen, tail at -halfLen. Segment i tapers from
  // radii[i] (tail-side) to radii[i+1] (head-side) so the body forms a
  // single continuous taper.
  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const xStart = -halfLen + i * segmentLen;
    const xCenter = xStart + segmentLen / 2;
    const rTail = segmentRadius(i);
    const rHead = segmentRadius(i + 1);
    // The last 2 head-end segments are open so the maw cavity is visible
    // looking into the front of the worm. Earlier segments are closed cylinders.
    const openEnded = i >= SEGMENT_COUNT - 2;
    // After rotation.z = π/2: cylinder's +Y (radiusTop) rotates to +X (head side).
    // AAL — use the open-mat variant for the 2 openEnded head segments so
    // their inner surface is visible from inside the maw.
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(rHead, rTail, segmentLen, 14, 1, openEnded),
      openEnded ? bodyMatOpen : bodyMat,
    );
    cyl.rotation.z = Math.PI / 2;
    cyl.position.x = xCenter;
    group.add(cyl);
  }

  // Ridge rings at every internal joint. Each ring sits at xStart of
  // segment i (for i > 0), with radius matching radii[i] so it hugs the
  // body surface continuously. Tube radius is chosen so the outer torus
  // edge slightly overhangs the body — reads as a chitinous rib, not a
  // floating loop.
  for (let i = 1; i < SEGMENT_COUNT; i++) {
    const xJoint = -halfLen + i * segmentLen;
    const r = segmentRadius(i);
    const tubeR = Math.max(0.10, r * 0.10);
    const ridge = new THREE.Mesh(
      // Major radius slightly less than body radius so the ring is half-
      // embedded in the body — it pokes out as a continuous rib, not a
      // separate hoop.
      new THREE.TorusGeometry(r * 0.94, tubeR, 8, 24),
      ridgeMat,
    );
    ridge.position.x = xJoint;
    ridge.rotation.y = Math.PI / 2;
    group.add(ridge);
  }

  // ─── Dorsal armor (C13) — overlapping keeled SCUTES along the spine. Breaks the uniform
  //     ribbed-tube silhouette into an ancient ARMORED leviathan read (awe, not horror). Each
  //     scute is a low 4-sided keel sitting on the dorsal surface, scaled to the body radius there
  //     + elongated along the body so neighbours overlap. Hand-model → no rand. ───
  const plateMat = new THREE.MeshLambertMaterial({ color: 0x46382a, flatShading: true });
  const PLATE_COUNT = 13;
  for (let i = 0; i < PLATE_COUNT; i++) {
    const t = 0.26 + (0.90 - 0.26) * (i / (PLATE_COUNT - 1));   // behind the head taper → near the tail
    const xPos = -halfLen + t * length;
    const r = segmentRadius(t * SEGMENT_COUNT);
    // C13 r2 (gate cohesion fix): broad LOW OVERLAPPING keeled plates — NOT tall gappy pyramids (those
    // read as a stegosaurus sawback). Bases now exceed the centre spacing so they interlock into one
    // ridge of layered armour; height peaks mid-body + a small per-plate wobble = organic grown armour
    // that undulates rather than marching in a perfect identical row. Hand-authored → no rand.
    const hFactor = 0.74 + 0.40 * Math.sin(t * Math.PI) + 0.12 * Math.sin(i * 2.3);  // harder mid-body swell + wobble
    const scuteH = r * 0.36 * hFactor;                       // LOW keel (was r*0.6 spike)
    const lenFactor = 0.9 + 0.18 * Math.sin(i * 1.7);        // more per-plate length variation
    // C13 r3 (gate 3q fix): FLAT-TOPPED frustum, not a sharp cone — a blunt plate apex reads as armour,
    // not a sawtooth point along the spine. More base overlap fills the V-notches into one rolled crest.
    const scute = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 1, 1, 4), plateMat);
    scute.rotation.y = Math.PI / 4;                          // square base edges → X (length) / Z (width)
    scute.scale.set(segmentLen * 0.95 * lenFactor, scuteH, r * 0.92);  // strong OVERLAP · low · broad back
    scute.position.set(xPos, r + scuteH * 0.1, 0);
    group.add(scute);
  }

  // Tail tip — narrow cone capping the -halfLen end.
  const tailR = segmentRadius(0);
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(tailR, segmentLen * 1.4, 10),
    bodyMat,
  );
  tail.rotation.z = Math.PI / 2; // cone tip points -X (away from body)
  tail.position.x = -halfLen - segmentLen * 0.5;
  group.add(tail);

  // ─── Maw — recessed cavity carved INTO the head, no external protrusion ───
  // Visible through the open ends of the last 2 head segments.
  const headFaceR = segmentRadius(SEGMENT_COUNT);
  const mawDepth = segmentLen * 1.8; // ~3.6m — extends into the last ~2 segments

  // Throat — open cylinder narrowing inward. Rendered BackSide so the
  // interior walls are visible from outside (looking down the throat).
  // CylinderGeometry(radiusTop, radiusBottom, height, ..., openEnded).
  // Default cylinder length is along +Y; rotation.z = π/2 maps +Y → -X.
  // We want the WIDE end at the head face (+X) and the narrow end deep
  // inside (-X), so radiusTop (which becomes -X) is the narrow one.
  //
  // Wide rim radius is set FLUSH with the body radius at the head face so
  // there's no see-through gap between the throat rim and the body wall.
  const throat = new THREE.Mesh(
    new THREE.CylinderGeometry(
      headFaceR * 0.42, // top — narrow, ends up at -X (deep inside)
      headFaceR * 1.0,  // bottom — exactly the body radius at +X (maw rim)
      mawDepth, 18, 1, true,
    ),
    throatMat,
  );
  throat.rotation.z = Math.PI / 2;
  throat.position.x = halfLen - mawDepth / 2;
  group.add(throat);

  // Throat back-cap — small dark disk at the rear of the cavity, gives a
  // definite "you're looking at something solid back there" terminus.
  const backCap = new THREE.Mesh(
    new THREE.CircleGeometry(headFaceR * 0.45, 16),
    throatBackMat,
  );
  backCap.rotation.y = -Math.PI / 2; // disc plane perpendicular to X, normal pointing -X→+X
  backCap.position.x = halfLen - mawDepth + 0.02;
  group.add(backCap);

  // Two concentric tooth rings — outer at the maw rim, inner deeper inside.
  // Teeth point INWARD (cone tip toward -X / toward the throat center).
  const placeTooth = (
    xPos: number, a: number, ringR: number, scale: number, inwardX: number,
  ): void => {
    const tooth = new THREE.Mesh(
      // C12 — real FANGS. The old 0.13×0.7m cones read as invisible dots on the ~12m maw;
      // base 0.34 / length 1.9 (× scale) gives fangs that read as a toothed gullet.
      new THREE.ConeGeometry(0.34 * scale, 1.9 * scale, 5),
      toothMat,
    );
    tooth.position.set(xPos, Math.cos(a) * ringR, Math.sin(a) * ringR);
    // Rotate the cone so its +Y axis (tip direction) points INWARD.
    // Target direction: from this position toward (xPos - inwardX, 0, 0)
    // (a point on the worm's central axis slightly deeper into the throat).
    const tipDir = new THREE.Vector3(-inwardX, -Math.cos(a) * ringR, -Math.sin(a) * ringR).normalize();
    tooth.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipDir);
    group.add(tooth);
  };

  // C12 — fang ring: alternate LONG fangs + shorter fillers around the rim for an organic,
  // menacing read (uniform teeth read mechanical). A second deeper ring keeps the gullet toothed.
  const outerCount = 16;
  for (let i = 0; i < outerCount; i++) {
    const a = (i / outerCount) * Math.PI * 2;
    const fang = i % 2 === 0 ? 1.25 : 0.82;          // interleaved long/short
    // C12 gate r2: recess the bases INSIDE the rim (was flush at halfLen-0.10) + pull radius in +
    // tip further inward, so no top fang crosses the lit rim band onto the outer wall.
    placeTooth(halfLen - mawDepth * 0.10, a, headFaceR * 0.80, fang, 1.7);
  }
  const innerCount = 11;
  for (let i = 0; i < innerCount; i++) {
    const a = (i / innerCount + 0.5 / innerCount) * Math.PI * 2; // interleave with outer
    placeTooth(halfLen - mawDepth * 0.5, a, headFaceR * 0.56, 0.95, 0.8);
  }

  return { group };
}

// ─────────────────────────────────────────────────────────────────────────
// Particle pool — sand bursts on breach + wake puffs during charge
// ─────────────────────────────────────────────────────────────────────────

function makePuffPool(scene: THREE.Scene, count: number): SandPuff[] {
  const puffs: SandPuff[] = [];
  const mat = new THREE.SpriteMaterial({
    map: _puffTexture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: true,
  });
  for (let i = 0; i < count; i++) {
    const sprite = new THREE.Sprite(mat.clone());
    sprite.visible = false;
    sprite.scale.set(1, 1, 1);
    scene.add(sprite);
    puffs.push({
      sprite,
      age: 0, ttl: 0, vx: 0, vy: 0, vz: 0,
      baseScale: 1,
    });
  }
  return puffs;
}

function burstPuffs(
  puffs: SandPuff[],
  origin: THREE.Vector3,
  count: number,
  baseVelY: number,
  spread: number = 1.2,
): void {
  let fired = 0;
  for (const p of puffs) {
    if (fired >= count) break;
    if (p.age < p.ttl) continue;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 2.5;
    p.vx = Math.cos(angle) * speed;
    p.vz = Math.sin(angle) * speed;
    p.vy = baseVelY + Math.random() * 2.0;
    p.age = 0;
    p.ttl = 0.9 + Math.random() * 0.6;
    p.baseScale = 1.4 + Math.random() * 1.6;
    p.sprite.position.set(
      origin.x + (Math.random() - 0.5) * spread,
      origin.y + 0.2,
      origin.z + (Math.random() - 0.5) * spread,
    );
    p.sprite.scale.setScalar(p.baseScale);
    (p.sprite.material as THREE.SpriteMaterial).opacity = 0.9;
    p.sprite.visible = true;
    fired++;
  }
}

function updatePuffs(puffs: SandPuff[], dt: number): void {
  const GRAVITY = 6.5;
  for (const p of puffs) {
    if (p.age >= p.ttl) {
      if (p.sprite.visible) p.sprite.visible = false;
      continue;
    }
    p.age += dt;
    p.vy -= GRAVITY * dt;
    p.sprite.position.x += p.vx * dt;
    p.sprite.position.y += p.vy * dt;
    p.sprite.position.z += p.vz * dt;
    const t = p.age / p.ttl;
    const scale = p.baseScale * (1 + t * 1.2);
    p.sprite.scale.setScalar(scale);
    (p.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.9 * (1 - t));
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Spawn
// ─────────────────────────────────────────────────────────────────────────

/** AAP — sample a procgen home position for the sandworm. Mirrors the
 *  wells-in-salt pattern (D55 era): use `findBiomeCentroid` on the
 *  dune biome with player-spawn exclusion. Falls back to the legacy
 *  Tuning.SANDWORM_HOME_POS (world-edge test fix from AAL) if no dune
 *  centroid is reachable within the search radius — defensive but rare
 *  given the world is mostly dunes.
 *
 *  Player-spawn exclusion is set wider than for flagship POIs (D82):
 *  the player should not encounter the worm in their first ~20s of
 *  unmounted movement. SANDWORM_SPAWN_EXCLUSION_RADIUS = 350m ≈
 *  detection radius (150m) + ~200m walking buffer.
 */
export function sampleSandwormHome(
  rand: Rng,
  biomes: BiomeSampler,
  terrain: Terrain,
  opts?: { excludeOtherWorms?: Array<{ x: number; z: number; radius: number }> },
): { x: number; z: number } {
  // Use a wider scatter band than flagships (200-800m) — sandworm should
  // be reachable but never in initial viewshed.
  const excludeR = Tuning.SANDWORM_SPAWN_EXCLUSION_RADIUS;
  const exclude: Array<{ x: number; z: number; radius: number }> = [{
    x: Tuning.OPENING_SCENE_ANCHOR_X,
    z: Tuning.OPENING_SCENE_ANCHOR_Z,
    radius: excludeR,
  }];
  // ACE Tier 2 — multi-worm: caller passes already-placed worm homes so
  // the rejection sampler avoids bunching. Each prior worm contributes
  // its own exclusion ring.
  if (opts?.excludeOtherWorms) {
    for (const w of opts.excludeOtherWorms) exclude.push(w);
  }
  // Phase 1: dune centroid (deepest into dune biome, outside spawn exclusion).
  // Run a few attempts perturbing the search via random offsets, since
  // findBiomeCentroid is deterministic per its grid — small jitter via
  // pre-rolled offsets surfaces different cells across seeds.
  for (let attempt = 0; attempt < 6; attempt++) {
    const c = findBiomeCentroid(biomes, 'dune', { excludeCenters: exclude });
    if (c) {
      // Verify the chosen centroid is actually a dune cell (defensive —
      // findBiomeCentroid already enforces this, but cheap to re-check).
      if (biomes.biomeAt(c.x, c.z) === 'dune') {
        // Jitter by a small amount per-seed so different worlds get
        // visibly-different homes even when the centroid cell is the same.
        // ACE Tier 2 — bumped jitter from 60→120m so multi-worm placements
        // diverge further from each other even when both want the same
        // centroid.
        const jitter = 120;
        const jx = c.x + (rand() - 0.5) * jitter;
        const jz = c.z + (rand() - 0.5) * jitter;
        // Confirm the jittered position is still in dune biome AND outside
        // ALL exclusion rings (player spawn + every prior worm).
        if (biomes.biomeAt(jx, jz) !== 'dune') {
          return { x: c.x, z: c.z };
        }
        let exclusionViolated = false;
        for (const ex of exclude) {
          const dx = jx - ex.x;
          const dz = jz - ex.z;
          if ((dx * dx + dz * dz) <= ex.radius * ex.radius) {
            exclusionViolated = true;
            break;
          }
        }
        if (!exclusionViolated) {
          return { x: jx, z: jz };
        }
        return { x: c.x, z: c.z };
      }
    }
    break; // findBiomeCentroid is deterministic; retrying won't help
  }
  // Fallback — Tuning.SANDWORM_HOME_POS (world-edge test fix). Better
  // than crashing; the warning at main.ts boot will surface this case.
  void terrain;
  return { x: Tuning.SANDWORM_HOME_POS.x, z: Tuning.SANDWORM_HOME_POS.z };
}

export function spawnSandWorm(
  scene: THREE.Scene,
  physicsWorld: RAPIER.World,
  terrain: Terrain,
  homeXZ?: { x: number; z: number },
  idOverride?: number,
): SandWorm {
  // AAP — accepts an explicit home XZ. Backward-compatible: if omitted,
  // falls back to Tuning.SANDWORM_HOME_POS (legacy callers / tests).
  // Production caller (main.ts) computes home via sampleSandwormHome.
  // ACE Tier 2 — `idOverride` lets save/load restore worms with their
  // saved ids preserved; otherwise a fresh id is allocated.
  const homePos = homeXZ ?? Tuning.SANDWORM_HOME_POS;
  const home = new THREE.Vector3(
    homePos.x,
    terrain.heightAt(homePos.x, homePos.z),
    homePos.z,
  );
  const id = idOverride !== undefined ? idOverride : _nextWormId++;
  if (idOverride !== undefined) setNextSandWormId(idOverride);

  // Start patrol at the orbit's "east" point so the worm has somewhere
  // sensible to drift from on first tick.
  const orbitR = Tuning.SANDWORM_PATROL_RADIUS * 0.7;
  const startX = home.x + orbitR;
  const startZ = home.z;
  const groundAtStart = terrain.heightAt(startX, startZ);
  const startY = groundAtStart - Tuning.SANDWORM_UNDERGROUND_DEPTH;

  const { group } = makeWormMesh();
  group.position.set(startX, startY, startZ);
  group.visible = false;
  scene.add(group);
  tag(group, 'kill', id);

  // Cuboid collider sized to the worm's length × max diameter. The body's
  // rotation drives the cuboid's orientation in world space.
  const halfLen = Tuning.SANDWORM_LENGTH / 2;
  const halfR = Tuning.SANDWORM_MAX_RADIUS;
  const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(startX, startY - 50, startZ); // park collider far below ground at boot
  const body = physicsWorld.createRigidBody(bodyDesc);
  const colliderDesc = RAPIER.ColliderDesc.cuboid(halfLen, halfR, halfR);
  const collider = physicsWorld.createCollider(colliderDesc, body);
  // Sensor mode — the worm passes through the player + speeder without
  // applying contact forces. Otherwise the kinematic worm body would
  // shove the kinematic player capsule (launching them skyward) and
  // ragdoll the dynamic speeder during lunges. Bite damage is handled by
  // an explicit distance check in tickLunge — we don't rely on physics
  // contact. The machete capsule sweep (combat.ts) explicitly includes
  // sensors via its query filter so this collider still registers hits.
  collider.setSensor(true);

  const worm: SandWorm = {
    id,
    state: 'patrol',
    health: Tuning.SANDWORM_MAX_HEALTH,
    basePos: new THREE.Vector3(startX, startY, startZ),
    home,
    surfaceGroundY: groundAtStart,
    mesh: group,
    body,
    collider,
    hovered: false,
    looted: false,
    patrolTheta: 0,
    phaseStartedAt: 0,
    target: new THREE.Vector3(),
    lungeStart: new THREE.Vector3(),
    lungeEnd: new THREE.Vector3(),
    attackCount: 0,
    _biteDealt: false,
    yaw: 0,
    pitch: 0,
    sway: 0,
    bend: 0,
    particles: makePuffPool(scene, 140),     // bumped 56 → 140 for boss-tier bursts (Session MM rescale)
    nextWakePuffAt: 0,
    nextTremorDustAt: 0,
    _ambushCooldownUntil: 0,                  // ABO B3
    _twilightBreachCooldownUntil: 0,          // ACC — ambient twilight breach
    _isTwilightBreach: false,                 // ACC
  };
  _colliderToWorm.set(worm.collider.handle, worm);
  return worm;
}

// ─────────────────────────────────────────────────────────────────────────
// Combat — flat 1.0 dmg, only during lunge or stationaryBreach
// ─────────────────────────────────────────────────────────────────────────

export function damageSandWorm(
  worm: SandWorm,
  _hitWorldY: number,
  ctx: GameContext,
): void {
  // ABJ — B12: feeding state is the new "vulnerable window" — worm has
  // its head out + is distracted by the meat. Hits land here at 2x
  // damage to reward the bait-and-strike play loop. Lunge + breach
  // still hit at 1x (the pre-ABJ damage gates).
  const damage =
    worm.state === 'feeding' ? 2.0 :
    (worm.state === 'lunge' || worm.state === 'stationaryBreach') ? 1.0 :
    0;
  if (damage === 0) return;
  worm.health -= damage;
  if (worm.health <= 0) {
    worm.health = 0;
    transitionToDead(worm, ctx);
    return;
  }
  ctx.ui.showToast(
    damage === 2.0 ? 'the blade bites deep — it didn\'t see you' : 'the blade bites into chitin',
  );
}

function transitionToDead(worm: SandWorm, ctx: GameContext): void {
  worm.state = 'dead';
  stopWormRumble();   // C16 — defensive: kill the charge rumble if the worm dies/despawns (no dangling drone)
  // Lay the worm on its side at the breach surface position.
  worm.pitch = 0;
  applySandWormDeadPose(worm);
  // Death burst — scaled for boss-tier body (Session MM): 28→70 particles,
  // velY 2.5→5, spread 3.0→6 so the cloud reads proportional to the 240m corpse.
  burstPuffs(
    worm.particles,
    new THREE.Vector3(worm.basePos.x, worm.surfaceGroundY + 0.4, worm.basePos.z),
    70, 5.0, 6.0,
  );
  playWormRoar();
  ctx.ui.showToast('the worm shudders and goes still');
}

/** Apply the dead-pose. Idempotent — used by transitionToDead and save/load. */
export function applySandWormDeadPose(worm: SandWorm): void {
  worm.state = 'dead';
  // Position: worm partially buried at the surface. Mesh laid on its side
  // (no pitch; small roll so it doesn't look stiff).
  worm.basePos.y = worm.surfaceGroundY - Tuning.SANDWORM_MAX_RADIUS * 0.5;
  worm.mesh.position.copy(worm.basePos);
  worm.mesh.rotation.set(0, worm.yaw, 0);
  // Move physics body well below ground so machete sweeps can't hit it.
  worm.body.setNextKinematicTranslation({
    x: worm.basePos.x, y: worm.surfaceGroundY - 50, z: worm.basePos.z,
  });
  worm.mesh.visible = true;
  untag(worm.mesh);
  tag(worm.mesh, 'take', worm.id);
}

/** Called when the player loots the corpse — mark looted + untag.
 *  ACS bugfix (ACF carcass-tow): if the carcass is currently being TOWED,
 *  KEEP the interact tag so the player can still cut the rope loose (the
 *  interaction's `towed` branch shows "cut carcass loose" regardless of
 *  looted). Without this, looting an in-tow carcass left it moving with no
 *  way to detach until the rope tore. Once cut loose (dragAnchor → none) the
 *  target-push filter stops raycasting it, so the stale tag is harmless. */
export function lootSandWorm(worm: SandWorm, ctx: GameContext): void {
  worm.looted = true;
  const towed = worm.dragAnchor !== undefined && worm.dragAnchor.kind !== 'none';
  if (!towed) untag(worm.mesh);
  ctx.ui.showToast('you carve a slab of worm-flesh from the carcass');
}

// ─────────────────────────────────────────────────────────────────────────
// Per-frame update — state machine + movement
// ─────────────────────────────────────────────────────────────────────────

const _toPlayer = new THREE.Vector3();
const _heading = new THREE.Vector3();
// B1 Phase 2 — getPlayerPos lifted to src/util/playerPos.ts (3rd consumer
// triggered the lift; previous in-file copy here + companion.ts + new
// rope endpoint resolver). Import from the shared util.

/** ACE Tier 2 — multi-worm. Iterates every worm in ctx.sandWorms.list,
 *  ticking each independently. Particle pools, state machines, and
 *  cooldowns are per-worm. Tremor effects + audio cues query the
 *  CLOSEST threatening worm so the player's experience tracks the
 *  immediate danger, not the sum of all worms. */
export function updateSandWorm(ctx: GameContext, dt: number): void {
  for (const worm of ctx.sandWorms.list) {
    updatePuffs(worm.particles, dt);
  }
  if (!isPlaying(ctx)) return;

  const playerTr = getPlayerPos(ctx);
  const elapsed = ctx.time.elapsed;

  for (const worm of ctx.sandWorms.list) {
    if (worm.state === 'dead') continue;
    _toPlayer.set(
      playerTr.x - worm.basePos.x,
      0,
      playerTr.z - worm.basePos.z,
    );
    const distToPlayer = _toPlayer.length();

    switch (worm.state) {
      case 'patrol':
        tickPatrol(worm, ctx, dt, distToPlayer);
        break;
      case 'alert':
        tickAlert(worm, ctx, dt, distToPlayer, playerTr);
        break;
      case 'charging':
        tickCharging(worm, ctx, dt, distToPlayer, playerTr);
        break;
      case 'lunge':
        tickLunge(worm, ctx, elapsed, distToPlayer);
        break;
      case 'stationaryBreach':
        tickStationaryBreach(worm, ctx, elapsed);
        break;
      case 'retreat':
        tickRetreat(worm, ctx, dt, distToPlayer);
        break;
      case 'feeding':
        tickFeeding(worm, ctx, elapsed);
        break;
      case 'ambush':
        tickAmbush(worm, ctx, distToPlayer, playerTr);
        break;
    }

    applyMeshTransform(worm);
    syncBodyToMesh(worm, ctx);
  }
  // Tremor effects run once per frame against the closest threatening
  // worm (multi-worm tremor stacking would feel chaotic — pick a single
  // canonical source).
  applyClosestTremorEffect(ctx, playerTr);
}

/** ACE Tier 2 — multi-worm tremor selection. Pick the worm in a threat
 *  state with the smallest distance to the player and run the standard
 *  applyTremorEffects against it. If no worm is in threat range, the
 *  caller skips the tremor (no-op). */
function applyClosestTremorEffect(
  ctx: GameContext,
  playerTr: { x: number; y: number; z: number },
): void {
  let closest: SandWorm | null = null;
  let closestDistSq = Infinity;
  for (const worm of ctx.sandWorms.list) {
    if (worm.state !== 'alert' && worm.state !== 'charging' && worm.state !== 'retreat') {
      continue;
    }
    const dx = playerTr.x - worm.basePos.x;
    const dz = playerTr.z - worm.basePos.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < closestDistSq) {
      closestDistSq = dSq;
      closest = worm;
    }
  }
  if (closest) applyTremorEffects(closest, ctx);
}

/** Player-facing warning effect — camera shake + dust at the player's feet
 *  whenever the worm is in a threat phase (alert/charging/retreat) AND
 *  close enough. Intensity ramps with proximity. Patrol and breach states
 *  don't trigger this (patrol is distant ambient; breach states already
 *  have their own dramatic feedback). */
function applyTremorEffects(worm: SandWorm, ctx: GameContext): void {
  const isThreat =
    worm.state === 'alert' || worm.state === 'charging' || worm.state === 'retreat';
  if (!isThreat) return;
  const playerTr = getPlayerPos(ctx);
  const dx = playerTr.x - worm.basePos.x;
  const dz = playerTr.z - worm.basePos.z;
  const dist = Math.hypot(dx, dz);
  // Scaled with the body geometry rescale (Session MM, body 24→240m).
  // FAR matches detection radius (150m) so the player feels the boss the
  // moment it commits to threat states. NEAR matches the bite range (25m)
  // so peak shake hits in the danger zone.
  const TREMOR_FAR = 150;
  const TREMOR_NEAR = 25;
  if (dist > TREMOR_FAR) return;
  // Intensity 0..1, 0 at TREMOR_FAR, 1 at TREMOR_NEAR.
  const intensity = Math.max(0, Math.min(1,
    1 - (dist - TREMOR_NEAR) / (TREMOR_FAR - TREMOR_NEAR),
  ));
  // Camera position jitter — bumped for boss-tier presence (0.06→0.10).
  const shakeAmt = 0.10 * intensity;
  const cam = ctx.three.camera;
  cam.position.x += (Math.random() - 0.5) * shakeAmt;
  cam.position.y += (Math.random() - 0.5) * shakeAmt;
  cam.position.z += (Math.random() - 0.5) * shakeAmt;
  // Dust puffs at the player's feet — cadence scales with intensity.
  if (ctx.time.elapsed >= worm.nextTremorDustAt) {
    const cadence = 0.35 - intensity * 0.25; // 0.35s far → 0.10s near
    worm.nextTremorDustAt = ctx.time.elapsed + cadence;
    const footY = ctx.terrain.heightAt(playerTr.x, playerTr.z) + 0.05;
    const count = 1 + Math.floor(intensity * 3);
    burstPuffs(
      worm.particles,
      new THREE.Vector3(playerTr.x, footY, playerTr.z),
      count, 0.4, 0.7,
    );
  }
}

// ── State tick functions ───────────────────────────────────────────────

/** AAP — derive the player's current "noise level" multiplier for the
 *  sandworm's detection radius. Mounted on the speeder is loudest;
 *  sprinting is loud; walking is baseline; standing still or crouching
 *  without moving shrinks the detection radius. */
function playerNoiseMultiplier(ctx: GameContext): number {
  // AAR — prying a salvage panel is LOUD (metal scrape). Multiplies the
  // base movement noise so a player prying near a worm is heard from
  // farther than a player walking. The multiplier composes with the
  // movement multiplier below.
  const pryBoost = isPryingActive() ? Tuning.SALVAGE_NOISE_MULTIPLIER_DURING_PRY : 1.0;
  // Mounted on the speeder — loudest signal, dominates other modes.
  if (ctx.speeder?.mounted) return Tuning.SANDWORM_DETECTION_MULT_MOUNTED * pryBoost;
  const keys = ctx.input.keys;
  const moving = !!(keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD']);
  if (!moving) {
    // Standing still or crouching-and-still — quieter regardless of
    // whether the player is crouched (the crouch is a UX modifier; the
    // signal here is "is the player making footstep noise right now?").
    return Tuning.SANDWORM_DETECTION_MULT_STILL * pryBoost;
  }
  const sprinting =
    !ctx.player.crouching &&
    (keys['ShiftLeft'] || keys['ShiftRight']) &&
    ctx.stats.stamina > Tuning.STAMINA_SPRINT_THRESHOLD;
  if (sprinting) return Tuning.SANDWORM_DETECTION_MULT_SPRINTING * pryBoost;
  return Tuning.SANDWORM_DETECTION_MULT_WALKING * pryBoost;
}

/** ABO B3 — dawn/dusk surfacing modifier. Returns a multiplier applied
 *  to base detection radius + patrol speed during the dawn (sunrise) +
 *  dusk (sunset) windows. Worm is "more active" near transitions — sells
 *  the dawn/dusk feeding pattern many real desert predators follow. */
function twilightActivityMultiplier(ctx: GameContext): number {
  const t = ctx.time.dayTime;
  const inDawn = t >= 0.18 && t <= 0.22;
  const inDusk = t >= 0.78 && t <= 0.82;
  return (inDawn || inDusk) ? 1.30 : 1.0;
}

function tickPatrol(worm: SandWorm, ctx: GameContext, dt: number, distToPlayer: number): void {
  // ABJ — B12: scan for nearby meat pickups (player bait). If one is
  // within FEED_DETECT_RADIUS the worm surfaces to feed, opening a
  // 2x-damage vulnerability window. Meat items: raw/cooked lizard +
  // raw/cooked worm + lizard_on_a_stick raw/cooked. Player detection
  // still takes precedence (alert beats feeding) — a player closing
  // in while the worm is already feeding can interrupt the bait play.
  const meatPickup = findNearbyMeat(worm, ctx);
  if (meatPickup) {
    enterFeeding(worm, ctx, meatPickup.x, meatPickup.z, meatPickup.id);
    return;
  }
  // ABO B3 — dawn/dusk modifier scales detection radius for the worm
  // being more active near twilight transitions.
  const twilightMult = twilightActivityMultiplier(ctx);
  // ACC — ambient twilight breach. Pure threat-display: the worm rears
  // up on the horizon at dawn/dusk where the player can see it, then
  // descends back into the sand. Gates: in a twilight window, player
  // in the visibility band (outside even the mounted detection ring
  // but within sight), cooldown expired, low per-frame probability.
  // Bypasses the retreat→alert loop on exit so this is purely cosmetic.
  if (
    twilightMult > 1.0 &&
    ctx.time.elapsed >= worm._twilightBreachCooldownUntil &&
    distToPlayer >= Tuning.SANDWORM_TWILIGHT_BREACH_MIN_DIST &&
    distToPlayer <= Tuning.SANDWORM_TWILIGHT_BREACH_MAX_DIST &&
    Math.random() < Tuning.SANDWORM_TWILIGHT_BREACH_PROB_PER_S * dt
  ) {
    worm._twilightBreachCooldownUntil =
      ctx.time.elapsed + Tuning.SANDWORM_TWILIGHT_BREACH_COOLDOWN_S;
    worm._isTwilightBreach = true;
    enterStationaryBreach(worm, ctx);
    return;
  }
  // AAP — detection radius now scales with player movement noise. A
  // standing-still player can sit ~80m from a patrolling worm without
  // alerting it (DETECTION_RADIUS=150 * STILL=0.55 ≈ 82m); a mounted
  // player triggers alert from ~280m (150 * MOUNTED=1.85).
  const effectiveR = Tuning.SANDWORM_DETECTION_RADIUS * playerNoiseMultiplier(ctx) * twilightMult;
  // ABO B3 — ambush trigger. When player is within AMBUSH_TRIGGER_RADIUS
  // (smaller than detection radius — so ambush fires CLOSER than alert)
  // + noise multiplier is low (still / walking, not sprinting / mounted)
  // + cooldown not active + a small per-frame probability fires, the
  // worm enters ambush instead of alert. Ambush is silent: skips the
  // alert+charging telegraph, snaps to lunge when player closes further.
  // ACAH — a player who has reached SHELTER can't be acquired: the worm can't
  // sense them through cover. Skip both the ambush and alert acquisitions while
  // sheltered (the worm keeps patrolling below). Reuses ctx.player.inShelter,
  // written each frame by updateShelter (tent/locker/large-tent/etc zones).
  const sheltered = ctx.player.inShelter;
  const noiseMult = playerNoiseMultiplier(ctx);
  const ambushTriggerR = 25;       // metres
  const ambushPerSecondChance = 0.05;
  if (
    !sheltered &&
    distToPlayer < ambushTriggerR &&
    noiseMult < 0.7 &&
    ctx.time.elapsed >= worm._ambushCooldownUntil &&
    Math.random() < ambushPerSecondChance * dt
  ) {
    enterAmbush(worm, ctx);
    return;
  }
  if (!sheltered && distToPlayer < effectiveR) {
    enterAlert(worm, ctx);
    return;
  }
  // Orbit around home anchor.
  const r = Tuning.SANDWORM_PATROL_RADIUS * 0.7;
  const omega = Tuning.SANDWORM_PATROL_SPEED / r; // angular speed for arclength rate
  worm.patrolTheta += omega * dt;
  const tx = worm.home.x + Math.cos(worm.patrolTheta) * r;
  const tz = worm.home.z + Math.sin(worm.patrolTheta) * r;
  const groundY = ctx.terrain.heightAt(tx, tz);
  worm.basePos.set(tx, groundY - Tuning.SANDWORM_UNDERGROUND_DEPTH, tz);
  // Face along orbit tangent (next-step direction).
  const tangentX = -Math.sin(worm.patrolTheta);
  const tangentZ = Math.cos(worm.patrolTheta);
  worm.yaw = Math.atan2(-tangentZ, tangentX);
  worm.pitch = 0;
  worm.mesh.visible = false;
}

function enterAlert(worm: SandWorm, ctx: GameContext): void {
  worm.state = 'alert';
  worm.phaseStartedAt = ctx.time.elapsed;
  const playerTr = getPlayerPos(ctx);
  worm.target.set(playerTr.x, 0, playerTr.z);
  playWormRoar();
}

/** ABO B3 — ambush. Worm enters this state from patrol when the player
 *  is approaching quietly + within close range. Worm freezes at current
 *  basePos (already submerged) + waits. If player closes further (within
 *  ambush_lunge_radius) the worm transitions DIRECTLY to lunge — skipping
 *  alert + charging. If player retreats past ambush_cancel_radius, return
 *  to patrol. On lunge OR cancel, set the cooldown so the worm doesn't
 *  immediately re-ambush. */
function enterAmbush(worm: SandWorm, ctx: GameContext): void {
  worm.state = 'ambush';
  worm.phaseStartedAt = ctx.time.elapsed;
  worm.mesh.visible = false;
  worm.pitch = 0;
  // basePos stays where the worm was patrolling — that becomes the
  // ambush position. Submerged depth keeps it hidden from above.
}

function tickAmbush(
  worm: SandWorm,
  ctx: GameContext,
  distToPlayer: number,
  playerTr: { x: number; y: number; z: number },
): void {
  // Worm stays submerged + invisible.
  worm.mesh.visible = false;

  const AMBUSH_LUNGE_RADIUS = 12;   // metres — player closes inside this → snap to lunge
  const AMBUSH_CANCEL_RADIUS = 40;  // metres — player escapes outside this → back to patrol
  const AMBUSH_COOLDOWN_S = 90;     // seconds — minimum gap before another ambush

  if (distToPlayer < AMBUSH_LUNGE_RADIUS) {
    // Snap to lunge. Set the lunge target to the player's current XZ
    // (no commitment-snapshot like charging — ambush is meant to land).
    worm.target.set(playerTr.x, 0, playerTr.z);
    worm._ambushCooldownUntil = ctx.time.elapsed + AMBUSH_COOLDOWN_S;
    enterLunge(worm, ctx);
    return;
  }
  if (distToPlayer > AMBUSH_CANCEL_RADIUS) {
    // Player escaped — release back to patrol + apply cooldown.
    worm._ambushCooldownUntil = ctx.time.elapsed + AMBUSH_COOLDOWN_S;
    worm.state = 'patrol';
    return;
  }
  // Hold position quietly — no movement, no sound, no telegraph.
}

function tickAlert(
  worm: SandWorm, ctx: GameContext, dt: number, distToPlayer: number, playerTr: { x: number; y: number; z: number },
): void {
  // ACAH — disengage on distance OR if the player reaches shelter mid-alert.
  if (distToPlayer > Tuning.SANDWORM_DISENGAGE_RADIUS || ctx.player.inShelter) {
    worm.state = 'patrol';
    return;
  }
  // Update target to the player's current XZ, but only every 0.3s to feel less twitchy.
  worm.target.set(playerTr.x, 0, playerTr.z);
  moveTowardTarget(worm, ctx, dt, Tuning.SANDWORM_ALERT_SPEED);
  worm.pitch = 0;
  worm.mesh.visible = false;
  if (ctx.time.elapsed - worm.phaseStartedAt >= Tuning.SANDWORM_ALERT_DURATION) {
    enterCharging(worm, ctx);
  }
}

function enterCharging(worm: SandWorm, ctx: GameContext): void {
  worm.state = 'charging';
  worm.phaseStartedAt = ctx.time.elapsed;
  // Commit to the player's CURRENT position at charge start — no leading,
  // no refresh. The player gets a dodgeable attack: if they step aside
  // before the worm reaches this point, the lunge misses.
  const playerTr = getPlayerPos(ctx);
  worm.target.set(playerTr.x, 0, playerTr.z);
  worm.nextWakePuffAt = ctx.time.elapsed;
  startWormRumble();   // C16 — the underground approach rumble begins on the committed charge
}

function tickCharging(
  worm: SandWorm, ctx: GameContext, dt: number, distToPlayer: number, _playerTr: { x: number; y: number; z: number },
): void {
  // ACAH — abort the charge to a retreat if the player escaped OR reached shelter.
  if (distToPlayer > Tuning.SANDWORM_DISENGAGE_RADIUS || ctx.player.inShelter) {
    worm.state = 'retreat';
    worm.phaseStartedAt = ctx.time.elapsed;
    stopWormRumble();   // C16 — charge aborted (player escaped/sheltered) → rumble fades out
    pickRetreatTarget(worm, ctx);
    return;
  }
  // No target refresh — the charge is committed. Move toward the
  // snapshotted player position taken at enterCharging().
  moveTowardTarget(worm, ctx, dt, Tuning.SANDWORM_CHARGE_SPEED);
  // Half-body above sand during the rush — Y = groundY puts the worm's
  // center at ground level so the top half of the cylindrical body is
  // exposed (with MAX_RADIUS=2m, that's ~2m of back visible above the dunes).
  // Collider stays parked deep below per syncBodyToMesh, so the charge is
  // still untouchable per the damage-gating contract.
  // C15 — ride LOWER during the charge so only the armored back-RIDGE (the C13 dorsal crest) breaks the
  // surface: a Dune submerged-tracking tell, not a fully-surfaced rush. The lunge (dive) is then the full
  // reveal/eruption. Damage stays gated — the collider is parked deep per syncBodyToMesh.
  worm.basePos.y = ctx.terrain.heightAt(worm.basePos.x, worm.basePos.z)
    - Tuning.SANDWORM_MAX_RADIUS * Tuning.SANDWORM_CHARGE_SUBMERGE;
  worm.pitch = 0;
  worm.mesh.visible = true;
  // C16 — rumble intensity ramps with the worm's proximity to the player (dread builds as it closes).
  const prox = 1 - Math.min(1, distToPlayer / Tuning.SANDWORM_DISENGAGE_RADIUS);
  setWormRumbleLevel(0.25 + prox * 0.75);
  // Wake puffs — every ~0.15s pop puffs along the visible spine.
  if (ctx.time.elapsed >= worm.nextWakePuffAt) {
    worm.nextWakePuffAt = ctx.time.elapsed + 0.15;
    const surfaceY = worm.basePos.y + Tuning.SANDWORM_MAX_RADIUS * 0.6;
    // Wake puff during charge — bumped 3→8, spread 1.2→3.5 for the
    // bigger boss kicking up more sand as it tracks underground.
    burstPuffs(
      worm.particles,
      new THREE.Vector3(worm.basePos.x, surfaceY, worm.basePos.z),
      8, 1.6, 3.5,
    );
  }
  // Trigger lunge when the worm reaches its committed target (not the
  // player's current position). A dodging player will see the lunge fire
  // at empty sand.
  const dxT = worm.basePos.x - worm.target.x;
  const dzT = worm.basePos.z - worm.target.z;
  const distToTarget = Math.hypot(dxT, dzT);
  if (distToTarget < Tuning.SANDWORM_LUNGE_RANGE) {
    enterLunge(worm, ctx);
  }
}

function enterLunge(worm: SandWorm, ctx: GameContext): void {
  worm.state = 'lunge';
  worm.phaseStartedAt = ctx.time.elapsed;
  worm._biteDealt = false;
  stopWormRumble();   // C16 — the worm surfaces/erupts; the underground rumble gives way to the roar+chomp
  // Arc along the committed target direction (set at enterCharging) — the
  // worm doesn't track the player into the lunge. If the player dodged,
  // the lunge passes through empty sand.
  _heading.set(
    worm.target.x - worm.basePos.x, 0,
    worm.target.z - worm.basePos.z,
  );
  if (_heading.lengthSq() < 1e-4) {
    // Failsafe: worm already at the target — pick last yaw direction.
    _heading.set(Math.cos(worm.yaw), 0, -Math.sin(worm.yaw));
  }
  _heading.normalize();
  worm.lungeStart.copy(worm.basePos);
  worm.lungeEnd.set(
    worm.target.x + _heading.x * 12,
    0,
    worm.target.z + _heading.z * 12,
  );
  worm.yaw = Math.atan2(-_heading.z, _heading.x);
  worm.mesh.visible = true;
  worm.surfaceGroundY = ctx.terrain.heightAt(worm.target.x, worm.target.z);
  // Big sand burst at the breach point.
  // Lunge burst at breach-start — bumped 24→65 particles, velY 3.5→7, spread
  // 2.0→4.5 so the eruption matches the 240m boss bursting from the dunes.
  burstPuffs(
    worm.particles,
    new THREE.Vector3(worm.lungeStart.x, worm.surfaceGroundY + 0.3, worm.lungeStart.z),
    65, 7.0, 4.5,
  );
  playWormRoar();
}

function tickLunge(worm: SandWorm, ctx: GameContext, elapsed: number, distToPlayer: number): void {
  const t = (elapsed - worm.phaseStartedAt) / Tuning.SANDWORM_LUNGE_DURATION;
  if (t >= 1) {
    finishAttack(worm, ctx);
    return;
  }
  // XZ interpolates linearly start → end.
  const xz = Math.min(1, t);
  worm.basePos.x = worm.lungeStart.x + (worm.lungeEnd.x - worm.lungeStart.x) * xz;
  worm.basePos.z = worm.lungeStart.z + (worm.lungeEnd.z - worm.lungeStart.z) * xz;
  // Y curve: start at surfaceGroundY (continues smoothly from the half-
  // exposed charge), arc up to peak height, sink to underground at the end.
  // Compose: baseLine = lerp(groundY, groundY - UNDERGROUND_DEPTH, t) +
  //          arcBump = sin(t*π) * BREACH_ARC_PEAK
  const baseY = worm.surfaceGroundY * (1 - t)
    + (worm.surfaceGroundY - Tuning.SANDWORM_UNDERGROUND_DEPTH) * t;
  const arc = Math.sin(t * Math.PI);
  worm.basePos.y = baseY + arc * Tuning.SANDWORM_BREACH_ARC_PEAK;
  // Pitch: head tilts up on the rise (+0.6 rad), level at peak, down on descent.
  worm.pitch = Math.cos(t * Math.PI) * 0.6;
  // Body bend — arches through the air. Amplitude ramps with sin(t·π) so
  // the worm is straight at start/end and most curved at peak.
  worm.bend = Math.sin(t * Math.PI) * 2.5;
  worm.mesh.visible = true;
  // Damage tick at arc midpoint.
  if (t >= 0.45 && t <= 0.55 && !worm._biteDealt) {
    worm._biteDealt = true;
    if (distToPlayer <= Tuning.SANDWORM_BITE_RANGE) {
      ctx.stats.health = Math.max(0, ctx.stats.health - Tuning.SANDWORM_BITE_DAMAGE);
      ctx.flags.damageFlashUntil = ctx.time.elapsed + 0.4;
      playHit(1.0);
      playWormChomp();
      playPlayerHurt();
      ctx.ui.showToast('the maw passes over you');
      if (ctx.stats.health <= 0) die(ctx, 'the worm took you under');
    }
  }
}

function finishAttack(worm: SandWorm, ctx: GameContext): void {
  worm.attackCount++;
  worm.state = 'retreat';
  worm.phaseStartedAt = ctx.time.elapsed;
  worm.mesh.visible = false;
  worm.bend = 0;
  worm.pitch = 0;
  pickRetreatTarget(worm, ctx);
}

function pickRetreatTarget(worm: SandWorm, ctx: GameContext): void {
  // Move away from the player by RETREAT_DISTANCE meters from the worm's current pos.
  const playerTr = getPlayerPos(ctx);
  const awayX = worm.basePos.x - playerTr.x;
  const awayZ = worm.basePos.z - playerTr.z;
  const awayLen = Math.hypot(awayX, awayZ) || 1;
  const nx = awayX / awayLen;
  const nz = awayZ / awayLen;
  worm.target.set(
    worm.basePos.x + nx * Tuning.SANDWORM_RETREAT_DISTANCE,
    0,
    worm.basePos.z + nz * Tuning.SANDWORM_RETREAT_DISTANCE,
  );
}

function tickRetreat(worm: SandWorm, ctx: GameContext, dt: number, distToPlayer: number): void {
  if (distToPlayer > Tuning.SANDWORM_DISENGAGE_RADIUS) {
    worm.state = 'patrol';
    return;
  }
  worm.pitch = 0;
  worm.mesh.visible = false;
  const reached = moveTowardTarget(worm, ctx, dt, Tuning.SANDWORM_RETREAT_SPEED);
  if (reached) {
    // Decide next attack: every Nth attack is a stationary breach.
    if (worm.attackCount % Tuning.SANDWORM_STATIONARY_BREACH_EVERY === 0) {
      enterStationaryBreach(worm, ctx);
    } else {
      enterAlert(worm, ctx);
    }
  }
}

function enterStationaryBreach(worm: SandWorm, ctx: GameContext): void {
  worm.state = 'stationaryBreach';
  worm.phaseStartedAt = ctx.time.elapsed;
  worm.surfaceGroundY = ctx.terrain.heightAt(worm.basePos.x, worm.basePos.z);
  worm.mesh.visible = true;
  worm._biteDealt = false;
  // Stationary-breach burst — bumped 30→85 particles, velY 4.5→9, spread
  // 2.5→5.5 for the cobra-rear erupting from the dunes.
  burstPuffs(
    worm.particles,
    new THREE.Vector3(worm.basePos.x, worm.surfaceGroundY + 0.3, worm.basePos.z),
    85, 9.0, 5.5,
  );
  // ACL WORM TWILIGHT-BREACH AUDIO ATTENUATION — ambient twilight breaches
  // erupt 180-400m off; attenuate the roar by player distance so it doesn't
  // blast at full volume. Combat (non-twilight) breaches stay full-volume.
  if (worm._isTwilightBreach) {
    const playerTr = getPlayerPos(ctx);
    const dist = Math.hypot(worm.basePos.x - playerTr.x, worm.basePos.z - playerTr.z);
    playWormRoarAttenuated(dist);
  } else {
    playWormRoar();
  }
}

function tickStationaryBreach(worm: SandWorm, ctx: GameContext, elapsed: number): void {
  const dur = Tuning.SANDWORM_STATIONARY_BREACH_DURATION;
  const t = (elapsed - worm.phaseStartedAt) / dur;
  if (t >= 1) {
    worm.mesh.visible = false;
    worm.sway = 0;
    if (worm._isTwilightBreach) {
      // ACC — ambient threat-display, no engagement to wind down.
      // Drop back into patrol at current position; cooldown already
      // gates the next twilight breach.
      worm._isTwilightBreach = false;
      worm.state = 'patrol';
      worm.phaseStartedAt = elapsed;
      worm.pitch = 0;
      return;
    }
    worm.state = 'retreat';
    worm.phaseStartedAt = elapsed;
    worm.attackCount++;
    pickRetreatTarget(worm, ctx);
    return;
  }
  // Three phases:
  //   t in [0, 0.15]:  rise + pitch up to +π/2     (~0.83s @ 5.5s total)
  //   t in [0.15, 0.85]: hold vertical + sway      (~3.85s)
  //   t in [0.85, 1.0]: descend + pitch back       (~0.83s)
  let pitchTarget = 0;
  let yTarget = worm.surfaceGroundY - Tuning.SANDWORM_MAX_RADIUS;
  const peakY = worm.surfaceGroundY + Tuning.SANDWORM_STATIONARY_BREACH_HEIGHT - Tuning.SANDWORM_LENGTH / 2;
  if (t < 0.15) {
    const p = t / 0.15;
    pitchTarget = (Math.PI / 2) * p;
    yTarget = worm.surfaceGroundY - Tuning.SANDWORM_MAX_RADIUS + p * (peakY - (worm.surfaceGroundY - Tuning.SANDWORM_MAX_RADIUS));
    worm.sway = 0;
  } else if (t < 0.85) {
    pitchTarget = Math.PI / 2;
    yTarget = peakY;
    // Side-to-side cobra rear during the hold. Ease in/out so the sway
    // doesn't start abruptly when the hold begins or end abruptly.
    const holdT = (t - 0.15) / 0.70;
    const easeIn = Math.min(1, holdT / 0.15);          // first 15% of hold ramps in
    const easeOut = Math.min(1, (1 - holdT) / 0.15);    // last 15% ramps out
    const envelope = Math.min(easeIn, easeOut);
    // Two layered sines for a more organic, less metronomic wiggle.
    const holdElapsed = (elapsed - worm.phaseStartedAt) - 0.15 * dur;
    const sway = (Math.sin(holdElapsed * 2.0) * 0.20
                + Math.sin(holdElapsed * 0.9 + 1.4) * 0.12) * envelope;
    worm.sway = sway;
  } else {
    const p = (t - 0.85) / 0.15;
    pitchTarget = (Math.PI / 2) * (1 - p);
    yTarget = peakY - p * (Tuning.SANDWORM_STATIONARY_BREACH_HEIGHT - Tuning.SANDWORM_MAX_RADIUS);
    worm.sway = 0;
  }
  worm.pitch = pitchTarget;
  worm.basePos.y = yTarget;
}

// ── ABJ — B12: feeding state (bait-and-strike loop) ─────────────────

/** Scan ctx.pickups.list for the nearest meat pickup within FEED_DETECT_RADIUS
 *  of the worm. Returns {x, z, id} of the nearest one, or null if none. */
function findNearbyMeat(worm: SandWorm, ctx: GameContext): { x: number; z: number; id: number } | null {
  const meatItems = new Set([
    'raw_lizard_meat',
    'cooked_lizard_meat',
    'raw_worm_meat',
    'cooked_worm_meat',
    'lizard_on_a_stick_raw',
    'lizard_on_a_stick_cooked',
  ]);
  const detectR = Tuning.SANDWORM_FEED_DETECT_RADIUS_M;
  let best: { x: number; z: number; id: number; distSq: number } | null = null;
  for (const p of ctx.pickups.list) {
    if (!meatItems.has(p.itemId)) continue;
    const dx = p.pos.x - worm.basePos.x;
    const dz = p.pos.z - worm.basePos.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > detectR * detectR) continue;
    if (best === null || distSq < best.distSq) {
      best = { x: p.pos.x, z: p.pos.z, id: p.id, distSq };
    }
  }
  return best ? { x: best.x, z: best.z, id: best.id } : null;
}

function enterFeeding(worm: SandWorm, ctx: GameContext, x: number, z: number, pickupId: number): void {
  worm.state = 'feeding';
  worm.phaseStartedAt = ctx.time.elapsed;
  // Snap basePos to the meat XZ so the surface emergence is at the bait.
  worm.basePos.x = x;
  worm.basePos.z = z;
  worm.surfaceGroundY = ctx.terrain.heightAt(x, z);
  // Stash the pickup id on attackCount slot (re-using an existing field
  // for the consume-on-end check; cleaner than adding a field for a
  // single state). Use _biteDealt as a "consumed-on-this-cycle" gate.
  worm._biteDealt = false;
  worm.target.set(x, 0, z);
  worm.mesh.visible = true;
  // Burst on emergence — smaller than stationaryBreach (the worm is
  // distracted, not aggressive). ~30 particles vs 85 for breach.
  burstPuffs(
    worm.particles,
    new THREE.Vector3(x, worm.surfaceGroundY + 0.3, z),
    30, 4.0, 4.0,
  );
  playWormChomp();
  // Store the bait pickup id on a dedicated field — see SandWorm interface
  // additions below (_feedBaitPickupId).
  worm._feedBaitPickupId = pickupId;
}

function tickFeeding(worm: SandWorm, ctx: GameContext, elapsed: number): void {
  const dur = Tuning.SANDWORM_FEED_DURATION_S;
  const t = (elapsed - worm.phaseStartedAt) / dur;
  // Three phases:
  //   t in [0, 0.20]:  rise — pitch up to +π/4, basePos.y → near surface
  //   t in [0.20, 0.80]: hold — head partially raised, slow sway
  //   t in [0.80, 1.0]: descend — pitch back to 0, basePos.y → underground
  let pitchTarget = 0;
  let yTarget = worm.surfaceGroundY - Tuning.SANDWORM_UNDERGROUND_DEPTH;
  // Feeding peak: ~40% of stationaryBreach height (worm is partly exposed,
  // not fully vertical).
  const peakY = worm.surfaceGroundY + Tuning.SANDWORM_STATIONARY_BREACH_HEIGHT * 0.40
                - Tuning.SANDWORM_LENGTH / 2;
  if (t < 0.20) {
    const p = t / 0.20;
    pitchTarget = (Math.PI / 4) * p;
    yTarget = (worm.surfaceGroundY - Tuning.SANDWORM_UNDERGROUND_DEPTH)
              + p * (peakY - (worm.surfaceGroundY - Tuning.SANDWORM_UNDERGROUND_DEPTH));
  } else if (t < 0.80) {
    pitchTarget = Math.PI / 4;
    yTarget = peakY;
    // Slow sway — half the rate of stationaryBreach (worm is feeding,
    // not threatening). Sway period ~3s.
    worm.sway = Math.sin((elapsed - worm.phaseStartedAt) * 1.5) * 0.15;
  } else if (t < 1.0) {
    const p = (t - 0.80) / 0.20;
    pitchTarget = (Math.PI / 4) * (1 - p);
    yTarget = peakY - p * (peakY - (worm.surfaceGroundY - Tuning.SANDWORM_UNDERGROUND_DEPTH));
    worm.sway = 0;
    // Despawn the meat pickup mid-descent (around t=0.85). Worm
    // "consumed" the bait. Guard with _biteDealt so it only fires once.
    if (!worm._biteDealt && t >= 0.85) {
      worm._biteDealt = true;
      const baitId = worm._feedBaitPickupId;
      if (baitId !== undefined) {
        const idx = ctx.pickups.list.findIndex((p) => p.id === baitId);
        if (idx >= 0) {
          const p = ctx.pickups.list[idx];
          ctx.three.scene.remove(p.mesh);
          ctx.pickups.list.splice(idx, 1);
        }
        worm._feedBaitPickupId = undefined;
      }
      ctx.ui.showToast('the worm takes the bait');
    }
  } else {
    // Done — return to patrol (NOT retreat; feeding is non-hostile).
    worm.state = 'patrol';
    worm.phaseStartedAt = elapsed;
    worm.mesh.visible = false;
    worm.sway = 0;
    worm.pitch = 0;
    return;
  }
  worm.pitch = pitchTarget;
  worm.basePos.y = yTarget;
}

// ── Movement helpers ───────────────────────────────────────────────────

function moveTowardTarget(
  worm: SandWorm, ctx: GameContext, dt: number, speed: number,
): boolean {
  const dx = worm.target.x - worm.basePos.x;
  const dz = worm.target.z - worm.basePos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < speed * dt) {
    // Reached target this frame.
    worm.basePos.x = worm.target.x;
    worm.basePos.z = worm.target.z;
    const groundY = ctx.terrain.heightAt(worm.basePos.x, worm.basePos.z);
    worm.basePos.y = groundY - Tuning.SANDWORM_UNDERGROUND_DEPTH;
    return true;
  }
  const nx = dx / dist;
  const nz = dz / dist;
  worm.basePos.x += nx * speed * dt;
  worm.basePos.z += nz * speed * dt;
  const groundY = ctx.terrain.heightAt(worm.basePos.x, worm.basePos.z);
  worm.basePos.y = groundY - Tuning.SANDWORM_UNDERGROUND_DEPTH;
  worm.yaw = Math.atan2(-nz, nx);
  return false;
}

// ── Per-frame transform sync ────────────────────────────────────────────

const _qYaw = new THREE.Quaternion();
const _qPitch = new THREE.Quaternion();
const _qSway = new THREE.Quaternion();
const _swayAxis = new THREE.Vector3();
const _AXIS_Y = new THREE.Vector3(0, 1, 0);
const _AXIS_Z = new THREE.Vector3(0, 0, 1);

function composeWormQuat(worm: SandWorm, out: THREE.Quaternion): void {
  _qYaw.setFromAxisAngle(_AXIS_Y, worm.yaw);
  _qPitch.setFromAxisAngle(_AXIS_Z, worm.pitch);
  out.multiplyQuaternions(_qYaw, _qPitch);
  if (worm.sway !== 0) {
    // Sway axis is the world horizontal axis perpendicular to the worm's
    // facing direction. For a vertical worm during stationaryBreach this
    // gives a side-to-side lateral lean (cobra rearing).
    _swayAxis.set(-Math.sin(worm.yaw), 0, -Math.cos(worm.yaw));
    _qSway.setFromAxisAngle(_swayAxis, worm.sway);
    out.premultiply(_qSway);
  }
}

function applyMeshTransform(worm: SandWorm): void {
  worm.mesh.position.copy(worm.basePos);
  composeWormQuat(worm, worm.mesh.quaternion);
  // Apply per-child body bend so the worm looks curved through the air
  // during the lunge. For other states bend is 0 and children sit at
  // their nominal Y offsets.
  applyBodyBend(worm);
}

const _qBody = new THREE.Quaternion();

function syncBodyToMesh(worm: SandWorm, ctx: GameContext): void {
  // While submerged, park the collider far below ground so capsule sweeps miss it.
  const submerged = worm.state === 'patrol' || worm.state === 'alert'
    || worm.state === 'charging' || worm.state === 'retreat';
  if (submerged) {
    worm.body.setNextKinematicTranslation({
      x: worm.basePos.x, y: ctx.terrain.heightAt(worm.basePos.x, worm.basePos.z) - 50, z: worm.basePos.z,
    });
    return;
  }
  // Above ground — collider follows mesh transform.
  worm.body.setNextKinematicTranslation({
    x: worm.basePos.x, y: worm.basePos.y, z: worm.basePos.z,
  });
  // Rapier kinematic body rotation matches the composed worm quaternion.
  composeWormQuat(worm, _qBody);
  worm.body.setNextKinematicRotation({
    x: _qBody.x, y: _qBody.y, z: _qBody.z, w: _qBody.w,
  });
}

/** Per-frame body bend — adds a Y offset to each worm-mesh child based on
 *  its local X position. Creates a parabolic arch shape across the body,
 *  amplitude controlled by worm.bend. Children store their nominal Y in
 *  userData.baseY on first call so we can restore + re-apply. */
function applyBodyBend(worm: SandWorm): void {
  const halfLen = Tuning.SANDWORM_LENGTH / 2;
  const amp = worm.bend;
  // C14 — TAIL-BURIED: when the body arcs ABOVE the sand (lunge/breach), pull the REAR of the worm back
  // down to/under the sand line so it reads as EMERGING from the earth (Dune), not a free-floating tube.
  // Auto-scales to the arc height (the tail lands ~at the surface + a small bury margin) and only fires
  // while above ground; the head/front arch + the bite-arc reference (basePos) are untouched. Quadratic
  // rear ramp → mid-body unaffected, only the back ~third dives.
  const aboveGround = Math.max(0, worm.basePos.y - worm.surfaceGroundY);
  // Bury margin ~1.2 radii (C14 gate: a 0.5-radius dip read as the tail RESTING on the sand, not plunging
  // INTO it) so the rear emphatically disappears below the surface.
  const tailSink = aboveGround > 0.5 ? aboveGround + Tuning.SANDWORM_MAX_RADIUS * 1.2 : 0;
  // C15 — during the CHARGE the worm rides submerged; taper the REAR down into the dune so the back-ridge
  // reads as a body continuing UNDER the sand, not a hump ending in a flat vertical face (gate sev2).
  const chargeDip = worm.state === 'charging' ? Tuning.SANDWORM_MAX_RADIUS * 1.0 : 0;
  const rearSink = tailSink + chargeDip;
  for (const child of worm.mesh.children) {
    if (child.userData.baseY === undefined) {
      child.userData.baseY = child.position.y;
    }
    if (amp === 0 && rearSink === 0) {
      child.position.y = child.userData.baseY;
      continue;
    }
    const s = child.position.x / halfLen;               // −1 tail … +1 head
    // Arch (existing): parabola, peak biased toward the head so the front raises more.
    const sBias = s - 0.15;
    const arch = amp === 0 ? 0 : Math.max(0, 1 - sBias * sBias) * amp;
    // Rear-sink: 0 from mid-body forward, ramps DOWN at the tail (quadratic) — tail-buried during the
    // arc (tailSink) AND tapering the rear into the dune during the charge (chargeDip).
    const rear = Math.max(0, -s);
    const sink = rear * rear * rearSink;
    child.position.y = child.userData.baseY + arch - sink;
  }
}

// ── Misc ────────────────────────────────────────────────────────────────

/** For external code: used by save.ts to look up the home position when
 *  a save lacks the `pos` field. */
export function sandWormHomeFallback(): { x: number; z: number } {
  return Tuning.SANDWORM_HOME_POS;
}

// Re-export an empty function shape that older callers may import. Kept
// only so an `import { wormHitZone }` somewhere wouldn't crash — the
// updated combat.ts doesn't call this. Safe to delete in a follow-up
// session once we've confirmed nothing else imports it.
// (Intentionally not exported — drop entirely.)
void HALF_LEN_FALLBACK; // silence unused-var noise; reserved for future helpers
