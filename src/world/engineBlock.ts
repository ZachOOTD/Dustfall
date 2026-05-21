// Engine Block — flagship POI (Session LL — Wreck POI rework #1).
// Massive 5-nozzle engine cluster tipped into a dune at (95, -8).
// Replaces the boxy `placeEngineBlock` in `poi.ts` which composed a
// shared `makeEngineCluster` (straight-cylinder bells + box frame +
// auto-AABB collider) with a dedicated module modelled on the
// satellite-dish template: LatheGeometry-tapered bells with recessed
// emissive throats (D48 sandworm-maw trick), curved cooling-shroud
// tori sleeving the frame, a dangling Lathe heat-shield, two droopy
// TubeGeometry fuel hoses, per-piece tilted box colliders, 2 salvage
// panels (frame face + recessed inside center bell throat).
//
// D60 — angled cylinders anchored via `geometry.translate(0, halfL, 0)`
// before rotation, so the foot/mount stays fixed. Applies here to the
// bell `LatheGeometry` (throat anchor) and the fuel-hose root stubs
// where present. Cables / TubeGeometry over splines do NOT need this —
// curve endpoints handle orientation naturally.
//
// No interior + no shelter zone — engine_block is an open landmark,
// not an enclosed survival space. Shelter affordance is the dish's
// identity; doubling it on every POI dilutes that. Walkable top of
// the thrust frame gives a small lookout perch.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { SalvageableRegistry } from './salvage.ts';
import { registerSalvageable } from './salvage.ts';
import { makeStaticBox } from '../physics/bodies.ts';
import { Tuning } from '../config/tuning.ts';
import { placeDebrisField } from './wrecks.ts';
import { createRustedHullMaterial } from './hullMaterial.ts';

// ── Materials — local copies so this module's palette can drift from
// the generic wrecks.ts hulls (e.g., deeper charring on the bells)
// without touching the shared pack. ──────────────────────────────────
// Session OO — procedural rust shader on the thrust frame body.
// Frame box + cooling shroud tori inherit panel wear + side rust
// streaks; the upper face gets sun bleach since it's the walkable
// lookout perch.
const _hullMat = createRustedHullMaterial({
  baseColor: Tuning.WRECK_HULL_HEX,
});
const _hullDarkMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_HULL_DARK_HEX,
  flatShading: true,
});
const _charredMat = new THREE.MeshLambertMaterial({
  color: 0x1a1410,           // near-black with a touch of warmth — bell exterior near throat
  flatShading: true,
});
// Session OO — bell exteriors get the rust shader too, with a darker
// rust hue (heat scoring deepens the rust near nozzles) and minimal
// bleach (bells are face-down once the cluster tilts).
const _bellOuterMat = createRustedHullMaterial({
  baseColor: 0x3a2820,       // weathered bell exterior — rust over carbon scoring
  rustHex: 0x0a0402,         // near-black for deep heat-burn streaks
});
const _nozzleInteriorMat = new THREE.MeshBasicMaterial({
  color: 0x180a06,           // dark interior, slight warmth (carbon + faint rust glow)
  side: THREE.BackSide,      // we view the inside of the cylinder
});
const _nozzleBackstopMat = new THREE.MeshBasicMaterial({
  color: 0x080403,           // pitch-dark throat cap so bells aren't see-through
});
const _nozzleRimMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_NOZZLE_RIM_HEX,
  flatShading: true,
});
const _scarRingMat = new THREE.MeshBasicMaterial({
  color: 0x2a1208,           // heat-scarring ring just past the rim
});
const _heatShieldMat = new THREE.MeshLambertMaterial({
  color: 0x6b3520,           // warm rust-orange ablative plate
  flatShading: true,
  // AAL — was DoubleSide; the shield is mostly occluded by other engine
  // geometry from behind, so FrontSide alone reads correctly from
  // approachable angles + no longer looks paper-thin from oblique views.
  side: THREE.FrontSide,
});
const _hoseMat = new THREE.MeshLambertMaterial({
  color: 0x141210,           // matte black rubber-coated fuel line
  flatShading: true,
});
const _frameRibMat = new THREE.MeshLambertMaterial({
  color: 0x2a2520,           // dark steel ribs sleeving the frame
  flatShading: true,
});
const _panelBodyMat = new THREE.MeshLambertMaterial({
  color: Tuning.SALVAGE_PANEL_BODY_HEX,
});
const _panelRimMat = new THREE.MeshLambertMaterial({
  color: Tuning.SALVAGE_PANEL_RIM_HEX,
});

// ── Dimensions — flagship-scale, deliberate (no per-cluster rand).
// All sizes already pre-multiplied by the CLUSTER_SCALE the prior
// `makeEngineCluster(rand, 4.2)` was applying.
const CLUSTER_SCALE = 4.2;
const NOZZLE_COUNT = 5;
const BASE_R = 0.72 * CLUSTER_SCALE;            // mid of 0.6-0.85 — was random; flagship fixed
const NOZZLE_H = 1.35 * CLUSTER_SCALE;          // mid of 1.2-1.5
const BELL_THROAT_R = BASE_R * 0.42;            // narrow end (combustion chamber side)
const BELL_RIM_R = BASE_R * 0.62;               // wide end (exhaust mouth)
const FRAME_W = BASE_R * 2.4;                   // matches old box-frame footprint
const FRAME_H = BASE_R * 0.95;
const FRAME_D = BASE_R * 2.0;
const FRAME_Y = NOZZLE_H + BASE_R * 0.45;       // sits behind/above the bell mouths (matches prior anatomy)
const BURY_Y = 1.4;                             // matches prior placeEngineBlock — deep one-side bury
const PITCH = -0.55;                            // tip leeward, nozzles up-and-out (matches prior)
const ROLL = -0.18;
const YAW = -0.6;

// ── Sub-builders ─────────────────────────────────────────────────────

/** Build one tapered exhaust bell — LatheGeometry profile walks from a
 *  narrow throat at y=0 up to a wide flared rim at y=NOZZLE_H, with a
 *  bulged combustion-chamber shoulder and a slight pinch before the
 *  flare. Inner BackSide cylinder + dark backstop cap give the
 *  "recessed maw" read so the bell isn't a hollow tube. Rim torus +
 *  scar ring at the mouth sell the heat scoring. Anchor pre-translated
 *  so the throat (y=0) is the mount point — D60. */
function makeNozzleBell(): THREE.Group {
  const g = new THREE.Group();
  // Outer profile — 9 control points from throat → shoulder → pinch →
  // flared rim. Each Vector2(radius, y).
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(BELL_THROAT_R,        0.00 * NOZZLE_H),
    new THREE.Vector2(BELL_THROAT_R * 1.05, 0.10 * NOZZLE_H),
    new THREE.Vector2(BELL_THROAT_R * 1.30, 0.22 * NOZZLE_H),  // shoulder begins
    new THREE.Vector2(BELL_THROAT_R * 1.55, 0.36 * NOZZLE_H),  // shoulder peak (combustion chamber)
    new THREE.Vector2(BELL_THROAT_R * 1.35, 0.50 * NOZZLE_H),  // pinch (post-shoulder narrow)
    new THREE.Vector2(BELL_THROAT_R * 1.45, 0.62 * NOZZLE_H),
    new THREE.Vector2(BELL_THROAT_R * 1.75, 0.76 * NOZZLE_H),
    new THREE.Vector2(BELL_RIM_R * 0.88,    0.90 * NOZZLE_H),
    new THREE.Vector2(BELL_RIM_R,           1.00 * NOZZLE_H),  // mouth rim
  ];
  const outer = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 14),
    _bellOuterMat,
  );
  g.add(outer);
  // Inner darkness — open BackSide cylinder slightly inside the outer
  // profile, recessed 0.10m past the rim so the player sees "down the
  // throat" past a ring of bell exterior. Use averaged inner radii to
  // approximate the curved profile cheaply.
  const innerR = BELL_THROAT_R * 1.15;
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(BELL_RIM_R * 0.85, innerR, NOZZLE_H * 0.95, 14, 1, true),
    _nozzleInteriorMat,
  );
  inner.position.y = NOZZLE_H * 0.5 - 0.05;
  g.add(inner);
  // Backstop disc — pitch-dark cap at the throat end so the bell isn't
  // see-through from oblique angles below the mouth.
  const backstop = new THREE.Mesh(
    new THREE.CircleGeometry(innerR * 0.95, 14),
    _nozzleBackstopMat,
  );
  backstop.position.y = 0.05;
  backstop.rotation.x = -Math.PI / 2;       // disc lies horizontal, facing +Y
  g.add(backstop);
  // Rim torus — thin band wrapping the mouth, reads as a structural
  // welded rim for silhouette legibility from distance.
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(BELL_RIM_R * 1.02, BELL_RIM_R * 0.05, 6, 18),
    _nozzleRimMat,
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = NOZZLE_H;
  g.add(rim);
  // Heat-scarring ring — slightly darker torus just inside the rim,
  // suggests scorch from the last firing.
  const scar = new THREE.Mesh(
    new THREE.TorusGeometry(BELL_RIM_R * 0.95, BELL_RIM_R * 0.03, 4, 16),
    _scarRingMat,
  );
  scar.rotation.x = Math.PI / 2;
  scar.position.y = NOZZLE_H * 0.93;
  g.add(scar);
  // Char ring near the throat — extra carbon detail at the combustion-
  // chamber end where wear would be heaviest.
  const char = new THREE.Mesh(
    new THREE.TorusGeometry(BELL_THROAT_R * 1.10, BELL_THROAT_R * 0.07, 4, 14),
    _charredMat,
  );
  char.rotation.x = Math.PI / 2;
  char.position.y = NOZZLE_H * 0.08;
  g.add(char);
  return g;
}

/** Thrust-frame core: a `BoxGeometry` (matches the prior anatomy +
 *  serves as the walkable + collider host) sleeved with cooling-ring
 *  tori and structural ribs so the silhouette reads as machinery
 *  instead of a featureless cube. */
function makeThrustFrameCore(): THREE.Group {
  const g = new THREE.Group();
  // Core box — the structural element (same dims as prior).
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(FRAME_W, FRAME_H, FRAME_D),
    _hullMat,
  );
  g.add(core);
  // 3 nested cooling-ring tori wrapping the box along its long axis (X).
  // Tori lie in the X-Z plane and slide along X.
  for (let i = 0; i < 3; i++) {
    const t = (i - 1) * 0.30;                // X positions -0.30, 0, +0.30 (× frame width)
    const ringR = FRAME_H * 0.58 + (i % 2) * 0.05;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(ringR, FRAME_H * 0.08, 4, 14),
      _hullDarkMat,
    );
    ring.position.set(FRAME_W * t, 0, 0);
    ring.rotation.z = Math.PI / 2;           // torus normal → X axis
    g.add(ring);
  }
  // 4 lengthwise ribs running along the frame's X axis at the corners
  // of its top-and-bottom faces. Reads as structural reinforcement.
  for (const dz of [-FRAME_D * 0.45, FRAME_D * 0.45]) {
    for (const dy of [-FRAME_H * 0.45, FRAME_H * 0.45]) {
      const rib = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06 * CLUSTER_SCALE, 0.06 * CLUSTER_SCALE, FRAME_W * 1.02, 5),
        _frameRibMat,
      );
      rib.rotation.z = Math.PI / 2;          // align cylinder Y → frame X
      rib.position.set(0, dy, dz);
      g.add(rib);
    }
  }
  return g;
}

/** Ablative heat-shield plate — shallow LatheGeometry cone wedged on
 *  the visible side, reading as "the shield bank that protected the
 *  combustion chamber, half torn away." */
function makeHeatShield(): THREE.Mesh {
  const profile: THREE.Vector2[] = [];
  const SHIELD_R = BASE_R * 1.05;
  const SHIELD_DEPTH = BASE_R * 0.45;
  const segs = 6;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    profile.push(new THREE.Vector2(t * SHIELD_R, t * t * SHIELD_DEPTH * 0.6));
  }
  // phiLength = 0.7 * 2π — leaves a ~30% wedge missing ("torn off").
  return new THREE.Mesh(
    new THREE.LatheGeometry(profile, 12, 0, Math.PI * 2 * 0.7),
    _heatShieldMat,
  );
}

/** Droopy fuel hose — TubeGeometry over a CatmullRomCurve3 from start
 *  to end with intermediate sag. Curve endpoints handle orientation
 *  naturally (no anchor-cylinder math needed). */
function makeFuelHose(
  start: THREE.Vector3,
  end: THREE.Vector3,
  sagDepth: number,
): THREE.Mesh {
  const mid1 = start.clone().lerp(end, 0.35).add(new THREE.Vector3(0, -sagDepth * 0.7, 0));
  const mid2 = start.clone().lerp(end, 0.70).add(new THREE.Vector3(0, -sagDepth, 0));
  const curve = new THREE.CatmullRomCurve3([start.clone(), mid1, mid2, end.clone()]);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, 16, 0.07 * CLUSTER_SCALE, 5, false),
    _hoseMat,
  );
}

/** Salvage access panel — local copy of the dish's pattern so the
 *  module is self-contained. */
function makeEBAccessPanel(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(
      Tuning.SALVAGE_PANEL_SIZE_X,
      Tuning.SALVAGE_PANEL_SIZE_Y,
      Tuning.SALVAGE_PANEL_SIZE_Z,
    ),
    _panelBodyMat,
  );
  g.add(body);
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(
      Tuning.SALVAGE_PANEL_SIZE_X * 1.1,
      Tuning.SALVAGE_PANEL_SIZE_Y * 0.18,
      Tuning.SALVAGE_PANEL_SIZE_Z * 0.4,
    ),
    _panelRimMat,
  );
  rim.position.set(0, -Tuning.SALVAGE_PANEL_SIZE_Y * 0.42, Tuning.SALVAGE_PANEL_SIZE_Z * 0.35);
  g.add(rim);
  return g;
}

// ── Main entry ───────────────────────────────────────────────────────

export function placeEngineBlock(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  pos: THREE.Vector3,
  rand: Rng,
  salvageables?: SalvageableRegistry,
): THREE.Group {
  const group = new THREE.Group();

  // ── 1. Bell ring: 1 center + 4 outer in a tight 2D pattern at the
  // thrust end. Mouth opens +Y (matches prior cluster convention).
  // Outer bells fan ~5° outward so the cluster reads as a slight cone,
  // not a flat panel. ──
  // Center bell at origin.
  const centerBell = makeNozzleBell();
  group.add(centerBell);
  // 4 outer bells around the center, each tilted slightly outward.
  for (let i = 0; i < NOZZLE_COUNT - 1; i++) {
    const a = (i / (NOZZLE_COUNT - 1)) * Math.PI * 2;
    const ringR = BASE_R * 0.95;
    const cx = Math.cos(a) * ringR;
    const cz = Math.sin(a) * ringR;
    const bell = makeNozzleBell();
    bell.position.set(cx, 0, cz);
    // Lean each outer bell ~5° away from center. Rotate around the
    // axis tangent to the ring at this angle.
    const leanAngle = 0.09;                  // ~5°
    const tangent = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    bell.quaternion.setFromAxisAngle(tangent, leanAngle);
    group.add(bell);
  }

  // ── 2. Thrust frame core — box + cooling tori + ribs. Sits above the
  // bell mouths (matches prior anatomy where the cluster's "back" is on
  // the +Y side of the bell mouths). ──
  const frame = makeThrustFrameCore();
  frame.position.y = FRAME_Y;
  group.add(frame);

  // ── 3. Heat-shield plate — wedged just below the frame on the front
  // (visible) side, with its torn-away wedge facing -X for camera-side
  // legibility. ──
  const shield = makeHeatShield();
  shield.position.set(0, FRAME_Y - FRAME_H * 0.5 - 0.1 * CLUSTER_SCALE, 0);
  shield.rotation.y = Math.PI * 0.85;        // rotate the missing wedge toward camera
  group.add(shield);

  // ── 4. Fuel hoses — 2 droopy lines anchored on the frame side,
  // ending at the ground-buried side. After the cluster tilts, the
  // hose ends sit near the buried face so they read as "ground-out
  // fuel lines half submerged in sand." Both hoses live in the local
  // frame here — coords pre-tilt. ──
  // Hose 1: from front-side of frame down toward -Y (which becomes
  // ground after tilt).
  const hose1Start = new THREE.Vector3(FRAME_W * 0.35, FRAME_Y - FRAME_H * 0.5, FRAME_D * 0.40);
  const hose1End   = new THREE.Vector3(FRAME_W * 0.55, -BASE_R * 0.9, FRAME_D * 0.80);
  group.add(makeFuelHose(hose1Start, hose1End, 1.2));
  // Hose 2: from back-side of frame, longer droop in the other direction.
  const hose2Start = new THREE.Vector3(-FRAME_W * 0.30, FRAME_Y - FRAME_H * 0.5, -FRAME_D * 0.35);
  const hose2End   = new THREE.Vector3(-FRAME_W * 0.55, -BASE_R * 0.7, -FRAME_D * 0.70);
  group.add(makeFuelHose(hose2Start, hose2End, 1.4));

  // ── 5. Salvage panels (2) ────────────────────────────────────────
  // Panel A — on the +Z (frame's "visible" long-edge) face of the
  // thrust frame, off-center toward +X. Eye-level once the player walks
  // up the dune ramp onto the upturned frame.
  const panelA = makeEBAccessPanel();
  panelA.position.set(
    FRAME_W * 0.18,
    FRAME_Y,
    FRAME_D * 0.5 + Tuning.SALVAGE_PANEL_SIZE_Z * 0.5,
  );
  panelA.userData.accessPanel = panelA;
  group.add(panelA);
  // Panel B — recessed inside the center bell's mouth, ~0.5m below the
  // rim, facing outward (mounted on the inner wall). Player has to
  // climb up and peer down into the bell to find this one.
  const panelB = makeEBAccessPanel();
  panelB.position.set(
    0,
    NOZZLE_H - 0.5,                          // 0.5m below mouth rim
    BELL_RIM_R * 0.70,                       // pinned to the inner wall on the +Z side
  );
  panelB.rotation.x = -Math.PI / 2;          // face panel outward through the throat
  panelB.userData.accessPanel = panelB;
  group.add(panelB);

  // ── 6. Position, tilt, add to scene ──────────────────────────────
  group.position.copy(pos);
  group.position.y -= BURY_Y;                // deep one-side bury (matches prior)
  group.rotation.y = YAW;
  group.rotation.x = PITCH;
  group.rotation.z = ROLL;
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  scene.add(group);

  // ── 7. Colliders — per-piece tilted boxes via the dish's quaternion-
  // compose pattern. addEBCollider closes over the group's world quat
  // + position. ──
  const groupWorldQuat = new THREE.Quaternion();
  group.getWorldQuaternion(groupWorldQuat);
  const groupWorldPos = group.position.clone();

  const addEBCollider = (localPos: THREE.Vector3, halfExtents: { x: number; y: number; z: number }): void => {
    const worldCenter = localPos.clone()
      .applyQuaternion(groupWorldQuat)
      .add(groupWorldPos);
    makeStaticBox(world, halfExtents, worldCenter, {
      x: groupWorldQuat.x, y: groupWorldQuat.y, z: groupWorldQuat.z, w: groupWorldQuat.w,
    });
  };

  // (a) Thrust-frame core — matches the frame box; serves as the
  // walkable lookout surface after the cluster tilts.
  addEBCollider(
    new THREE.Vector3(0, FRAME_Y, 0),
    { x: FRAME_W * 0.5, y: FRAME_H * 0.5, z: FRAME_D * 0.5 },
  );
  // (b) Bell array — single fitted cuboid covering all 5 nozzles so the
  // player doesn't wedge between bells. Spans 2*BASE_R*0.95 + BELL_RIM_R
  // on each side; height = NOZZLE_H from bell throat (y=0) to mouth (y=NOZZLE_H).
  addEBCollider(
    new THREE.Vector3(0, NOZZLE_H * 0.5, 0),
    { x: BASE_R * 0.95 + BELL_RIM_R, y: NOZZLE_H * 0.5, z: BASE_R * 0.95 + BELL_RIM_R },
  );
  // (c) Heat-shield plate — thin cuboid co-located with the shield mesh.
  addEBCollider(
    new THREE.Vector3(0, FRAME_Y - FRAME_H * 0.5 - 0.1 * CLUSTER_SCALE, 0),
    { x: BASE_R * 1.05, y: 0.05 * CLUSTER_SCALE, z: BASE_R * 1.05 },
  );
  // (d) Underside wedge — large mostly-underground block stopping the
  // player from crawling under the upturned engine on the buried side.
  // After PITCH=-0.55 around X, the buried side is local -Z; place the
  // wedge there. Centered ~1.5m below local origin so it's mostly
  // beneath the terrain at the bury depth.
  addEBCollider(
    new THREE.Vector3(0, -BASE_R * 0.8, -FRAME_D * 0.3),
    { x: FRAME_W * 0.55, y: BASE_R * 0.9, z: FRAME_D * 0.5 },
  );

  // ── 8. Register both salvageables ────────────────────────────────
  if (salvageables) {
    panelA.updateWorldMatrix(true, false);
    const panelAWorld = new THREE.Vector3().setFromMatrixPosition(panelA.matrixWorld);
    registerSalvageable(salvageables, panelA, 'massive', panelAWorld, rand);

    panelB.updateWorldMatrix(true, false);
    const panelBWorld = new THREE.Vector3().setFromMatrixPosition(panelB.matrixWorld);
    registerSalvageable(salvageables, panelB, 'massive', panelBWorld, rand);
  }

  // ── 9. Debris field — preserve the original 14m / 10-piece debris
  // apron around the impact site. ──
  placeDebrisField(scene, terrain, pos, 14, rand, 10);

  return group;
}
