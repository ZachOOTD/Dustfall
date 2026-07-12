// M7 SKYFALL — the enterable hero freighter wreck (Sharpen & Deepen, plan:
// docs/feature-skyfall.md). A ~38m crashed HEAVY FREIGHTER shipped as a rare
// S4 far-field landmark kind ('skyfall_freighter', FEATURES.skyfall-gated).
//
// S1 (this file's first life): EXTERIOR BLOCKOUT — the crashed silhouette at
// intro-ship-or-larger scale, built silhouette-first from 3-5 read-defining
// masses (fore hull, snapped stern, bridge castle, engine block, cargo
// frames), in a crashed pose (list + bow-bury + a hull SNAP with exposed
// formers). Interior is S2 (a void for now — the breach mouth is visible but
// leads nowhere yet). Hero-detail passes are S3-S5.
//
// STREAMED-LIFECYCLE RULES (Infinite Sands reconciliation — binding):
// - Deterministic from the passed rng ONLY (descriptor purity, D290).
// - Every rigid body is returned for the chunk's teardown list (D292/rule 9);
//   geometry is per-call (callers tag meshes chunkGeo); materials are SHARED
//   module-level singletons (the _treeMat precedent — never disposed).
// - NO horizon-silhouette registration (module-global registry has no
//   removal path — backlogged; a streamed landmark must fully unload).
// - Colliders match the visible masses (rule 9): rotated cuboids aligned
//   with each posed hull piece. The S2 walk-probe is the real-motion gate.

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Terrain } from './terrain.ts';
import type { Rng } from '../core/rng.ts';
import { makeLoftedHull, makeFormerRings, mergeStaticByMaterial, type LoftStation } from './wreckForms.ts';
import { createRustedHullMaterial } from './hullMaterial.ts';
import { createMetalMaterial } from './metalMaterial.ts';
import { makeStaticBox } from '../physics/bodies.ts';

// ── Shared materials (module singletons — one shader program set for every
//    streamed Skyfall; meshes get chunkGeo so geometry unloads, materials stay).
const _hullMat = createRustedHullMaterial({ baseColor: 0x4a4238, streakIntensity: 0.7, chalkStrength: 0.22 });
const _hullDarkMat = createRustedHullMaterial({ baseColor: 0x3a332c, streakIntensity: 0.55, chalkStrength: 0.14 });
const _frameMat = createMetalMaterial(0x51493d, { wornScale: 4.0, scratchStrength: 0.12 });
// Near-black interior baffle — sits recessed inside torn/open mouths so a
// sightline into the fracture hits DARK structure, not a lit pale inner skin
// (the S1 first-visit nit). DoubleSide so it reads from any grazing angle.
const _voidMat = new THREE.MeshLambertMaterial({ color: 0x0a0805, side: THREE.DoubleSide, flatShading: true });

export interface SkyfallResult {
  group: THREE.Group;
  bodies: RAPIER.RigidBody[];
}

/** Place the Skyfall freighter wreck at (x, z), crashed pose derived from
 *  `rand`. Returns the root group (parented under `parent`) + every rigid
 *  body created, for the streamed chunk's teardown list. */
export function placeSkyfallWreck(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  x: number,
  z: number,
  rand: Rng,
  parent?: THREE.Group,
): SkyfallResult {
  const bodies: RAPIER.RigidBody[] = [];
  const root = new THREE.Group();
  root.name = 'skyfallWreck';
  (parent ?? scene).add(root);
  root.userData.skyfallCenter = { x, z };

  // ── Crash pose (drawn up front — fixed rand budget). The freighter came in
  //    shallow, belly-first: hull sunk + listing, the stern SNAPPED off and
  //    settled behind with its own lean, gap showing daylight. Pitch/list are
  //    kept SHALLOW so the long hull lies IN the sand (a steep pose floats a
  //    26m rigid body over near-flat terrain — the R1 float bug).
  const yaw = rand() * Math.PI * 2;
  root.userData.skyfallYaw = yaw;
  const listSign = rand() < 0.5 ? 1 : -1;
  const list = (0.07 + rand() * 0.05) * listSign;                 // 4-7° roll
  const pitch = -(0.01 + rand() * 0.02);                          // ~0.5-1.7° bow-settle (near-flat = no float)
  const sternYawOff = (0.22 + rand() * 0.28) * (rand() < 0.5 ? 1 : -1);
  const sternListSign = rand() < 0.5 ? 1 : -1;
  const sternList = (0.16 + rand() * 0.16) * sternListSign;
  const sternGap = 5.0 + rand() * 3.0;                            // the SNAP daylight (wider = reads)
  const groundY = terrain.heightAt(x, z);

  // ── FORE HULL — the main mass: ~30m of boxy freighter loft, long-dominant
  //    (L:H ≈ 5:1). Local +Z = forward. Stations: blunt working bow → long
  //    full midbody → the fracture. Slimmer/taller-ratio than R1 so length
  //    reads at 70m instead of a stubby tank blob.
  const FORE_LEN = 30;
  const HALF_W = 3.8;
  const HALF_H = 2.9;
  const foreStations: LoftStation[] = [
    { z: 0, halfW: HALF_W * 0.58, halfH: HALF_H * 0.60, cy: HALF_H * 0.12 },   // blunt working bow face
    { z: 2.5, halfW: HALF_W * 0.82, halfH: HALF_H * 0.86, cy: HALF_H * 0.04 },
    { z: 6, halfW: HALF_W, halfH: HALF_H },                                     // full section (short blunt bow taper)
    { z: FORE_LEN - 4, halfW: HALF_W, halfH: HALF_H },                          // long constant cargo body
    { z: FORE_LEN, halfW: HALF_W * 0.97, halfH: HALF_H * 0.97 },                // fracture face (open)
  ];
  const fore = new THREE.Group();
  fore.add(makeLoftedHull(foreStations, _hullMat, 0.35));
  // Exposed formers at the fracture mouth (the snap shows structure) + a dark
  // baffle recessed behind it so the torn mouth reads DARK, not a lit pale
  // inner skin (the S1 first-visit nit).
  const foreRings = makeFormerRings(HALF_H * 0.9, 3, 0.9);
  foreRings.rotation.y = Math.PI / 2;   // rings space along +X → along the hull's +Z
  foreRings.position.set(0, 0, FORE_LEN - 1.4);
  fore.add(foreRings);
  const foreBaffle = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 1.7, HALF_H * 1.7, 0.4), _voidMat);
  foreBaffle.position.set(0, 0, FORE_LEN - 2.4);
  fore.add(foreBaffle);
  // Bridge castle — FORWARD superstructure, offset to starboard (freighter
  // grammar: crew tower fore-starboard, cargo spine behind it). A distinct
  // 2-tier tower rising clear of the deck so it reads separately from cargo.
  const BR_X = HALF_W * 0.34;   // starboard offset (breaks symmetry)
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 0.9, 3.0, 3.6), _hullDarkMat);
  bridge.position.set(BR_X, HALF_H + 1.5, 7.0);
  fore.add(bridge);
  const bridgeCap = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 0.58, 1.5, 2.2), _hullDarkMat);
  bridgeCap.position.set(BR_X, HALF_H + 3.7, 6.6);
  fore.add(bridgeCap);
  // A dark forward window band on the bridge front (thin recessed inset — depth
  // reads at the sill graze, >10cm per rule 7).
  const bridgeWin = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 0.72, 0.9, 0.25), _voidMat);
  bridgeWin.position.set(BR_X, HALF_H + 2.2, 7.0 + 1.9);
  fore.add(bridgeWin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.4, 6), _frameMat);
  mast.position.set(BR_X + 1.0, HALF_H + 5.1, 6.4);
  fore.add(mast);
  // ── Dorsal CARGO row — a proper spaced spine of containers down the deck
  //    centerline (R1's bunched lump → a legible modular row that subdivides
  //    the hull + reads "cargo hauler"). Alternating tones; a couple knocked
  //    askew for the crash. Fixed 6-draw jitter budget.
  const CN_W = 2.5, CN_H = 2.3, CN_L = 3.2;
  const rowZ0 = 11.5, rowStep = CN_L + 0.7;
  for (let i = 0; i < 6; i++) {
    const j = rand();                                    // fixed per-container jitter draw
    const cz = rowZ0 + i * rowStep;
    const box = new THREE.Mesh(new THREE.BoxGeometry(CN_W, CN_H, CN_L), i % 2 === 0 ? _frameMat : _hullDarkMat);
    box.position.set((j - 0.5) * 0.5, HALF_H + CN_H * 0.5 - 0.25, cz);
    box.rotation.set((j - 0.5) * 0.10, (j - 0.5) * 0.22, (j - 0.5) * 0.14);
    fore.add(box);
  }
  // A crane GANTRY rail on posts running the cargo length (a strong freighter
  // silhouette cue; also draws the eye down the LENGTH). Breaks before the
  // fracture. Box beam >10cm deep (rule 7).
  const gantryLen = rowStep * 5 + CN_L;
  const gantryZ = rowZ0 - CN_L * 0.5 + gantryLen * 0.5;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, gantryLen), _frameMat);
  beam.position.set(-BR_X, HALF_H + CN_H + 1.3, gantryZ);
  fore.add(beam);
  for (let i = 0; i < 4; i++) {
    const pz = rowZ0 - CN_L * 0.4 + (gantryLen - 1.0) * (i / 3);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, CN_H + 1.5, 0.28), _frameMat);
    post.position.set(-BR_X, HALF_H + (CN_H + 1.5) * 0.5 - 0.25, pz);
    fore.add(post);
  }
  // Pose the fore hull: shallow bow-settle + list, sunk so the keel rides well
  // UNDER the sand (foreBury = center-keel depth below ground). The long body
  // lying low + the flank drift below kills the R1 float.
  const foreBury = 2.8 + rand() * 0.4;    // sink ~half the 5.8m hull — buried-landmark read; carries the
                                          // no-float read ALONE now (mounds retired per user steering)
  fore.rotation.set(pitch, yaw, list, 'YXZ');
  fore.position.set(x, groundY + HALF_H - foreBury, z);
  root.add(fore);

  // World-space frame helpers (yaw only — camera/drift framing, list/pitch are
  // small). fwd = hull +Z; lateral = +X (starboard).
  const fwd = new THREE.Vector2(Math.sin(yaw), Math.cos(yaw));
  const lat = new THREE.Vector2(Math.cos(yaw), -Math.sin(yaw));

  // ── STERN PIECE — snapped off, ~10m: engine block + nozzles, settled with
  //    its own lean behind the fracture, gap showing daylight. Front mouth
  //    dark-baffled + former-ringed to match the fore fracture.
  const STERN_LEN = 10;
  const sternStations: LoftStation[] = [
    { z: 0, halfW: HALF_W * 0.96, halfH: HALF_H * 0.96 },                      // fracture face (open)
    { z: STERN_LEN - 3, halfW: HALF_W * 0.92, halfH: HALF_H * 0.92 },
    { z: STERN_LEN, halfW: HALF_W * 0.72, halfH: HALF_H * 0.76, cy: HALF_H * 0.05 },  // transom
  ];
  const stern = new THREE.Group();
  stern.add(makeLoftedHull(sternStations, _hullMat, 0.35));
  const sternRings = makeFormerRings(HALF_H * 0.86, 2, 0.9);
  sternRings.rotation.y = Math.PI / 2;
  sternRings.position.set(0, 0, 1.2);
  stern.add(sternRings);
  const sternBaffle = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 1.7, HALF_H * 1.7, 0.4), _voidMat);
  sternBaffle.position.set(0, 0, 2.2);
  stern.add(sternBaffle);
  // Engine block + three nozzles off the transom (cylinders are inherently thick).
  const engBlock = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 1.7, HALF_H * 1.6, 2.6), _hullDarkMat);
  engBlock.position.set(0, 0.1, STERN_LEN - 0.4);
  stern.add(engBlock);
  for (const [nx, ny] of [[-2.0, 0.7], [2.0, 0.7], [0, -1.1]] as const) {
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.4, 2.0, 12), _frameMat);
    noz.rotation.x = Math.PI / 2;
    noz.position.set(nx, ny, STERN_LEN + 1.0);
    stern.add(noz);
  }
  // Pose the stern behind the fore hull's fracture, along the crashed axis,
  // sunk + tilted so it reads as a broken-off chunk (settled lower than the fore).
  const aftDist = FORE_LEN * 0.5 + sternGap + STERN_LEN * 0.5;
  const sternBase = new THREE.Vector3(x + fwd.x * aftDist, 0, z + fwd.y * aftDist);
  const sternGroundY = terrain.heightAt(sternBase.x, sternBase.z);
  const sternBury = 2.65 + rand() * 0.4;   // deeper settle — no-float without mounds (user steering)
  stern.rotation.set(pitch * 0.5 + 0.03, yaw + sternYawOff, sternList, 'YXZ');
  stern.position.set(sternBase.x, sternGroundY + HALF_H - sternBury, sternBase.z);
  root.add(stern);

  // ── Spilled ground containers — two crash-strewn boxes on the sand off the
  //    low-list flank (breaks the neat row read; crash language). Each gets a
  //    collider (reachable, rule 9).
  const spillCols: { hx: number; hy: number; hz: number; pos: THREE.Vector3; quat: THREE.Quaternion }[] = [];
  for (let i = 0; i < 2; i++) {
    const j = rand();
    const along = FORE_LEN * (0.4 + i * 0.35);
    const outward = (HALF_W + 3.0 + j * 2.0) * listSign;
    const sx = x + fwd.x * along + lat.x * outward;
    const sz = z + fwd.y * along + lat.y * outward;
    const sgy = terrain.heightAt(sx, sz);
    const cbox = new THREE.Mesh(new THREE.BoxGeometry(CN_W, CN_H, CN_L), i % 2 === 0 ? _hullDarkMat : _frameMat);
    const cyaw = yaw + (j - 0.5) * 1.4;
    const croll = (j - 0.5) * 0.6;
    cbox.rotation.set(0.1 * (j - 0.5), cyaw, croll, 'YXZ');
    cbox.position.set(sx, sgy + CN_H * 0.32, sz);
    root.add(cbox);
    spillCols.push({
      hx: CN_W / 2, hy: CN_H / 2, hz: CN_L / 2,
      pos: cbox.position.clone(),
      quat: new THREE.Quaternion().setFromEuler(cbox.rotation),
    });
  }

  // ── NO SAND MOUNDS (user steering, 2026-07-12): the drift banks/mounds read
  //    as geometric orange piles and are retired for Skyfall. The no-float read
  //    is carried by the deep keel bury alone (foreBury/sternBury sink ~half
  //    the hull below the pan; terrain here is near-flat salt by the landmark
  //    site roll, so the buried waterline holds on every flank without berms).
  //    NOTE the rand draws the mounds consumed are gone — this generator has
  //    no cross-version determinism obligation (no save coupling), draw budget
  //    stays fixed WITHIN a build, which is all D290 requires.

  // PERF — one draw per material.
  mergeStaticByMaterial(root);

  // ── COLLIDERS (rule 9 — match the posed visible masses). Rotated cuboids
  //    aligned with each piece; the buried fraction sits below ground.
  const foreQuat = new THREE.Quaternion().setFromEuler(fore.rotation);
  const foreCol = makeStaticBox(
    world,
    { x: HALF_W, y: HALF_H, z: FORE_LEN / 2 },
    fore.position.clone().add(new THREE.Vector3(0, 0, FORE_LEN / 2).applyQuaternion(foreQuat)),
    foreQuat,
  );
  {
    const b = foreCol.parent();
    if (b) bodies.push(b);
  }
  // Bridge castle stands proud of the hull box — its own collider.
  const bridgeCol = makeStaticBox(
    world,
    { x: HALF_W * 0.45, y: 1.5, z: 1.8 },
    fore.position.clone().add(new THREE.Vector3(BR_X, HALF_H + 1.5, 7.0).applyQuaternion(foreQuat)),
    foreQuat,
  );
  {
    const b = bridgeCol.parent();
    if (b) bodies.push(b);
  }
  const sternQuat = new THREE.Quaternion().setFromEuler(stern.rotation);
  const sternCol = makeStaticBox(
    world,
    { x: HALF_W * 0.96, y: HALF_H * 0.96, z: STERN_LEN / 2 + 1.5 },   // +nozzles
    stern.position.clone().add(new THREE.Vector3(0, 0, STERN_LEN / 2).applyQuaternion(sternQuat)),
    sternQuat,
  );
  {
    const b = sternCol.parent();
    if (b) bodies.push(b);
  }
  // Spilled ground containers — a collider each (walk-into-able, rule 9).
  for (const s of spillCols) {
    const c = makeStaticBox(world, { x: s.hx, y: s.hy, z: s.hz }, s.pos, s.quat);
    const b = c.parent();
    if (b) bodies.push(b);
  }

  return { group: root, bodies };
}
