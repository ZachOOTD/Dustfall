// Hover speeder bike (Session CC). Dynamic Rapier rigid body with
// pitch+roll locked (only yaw rotates) so the chassis stays upright
// after collisions; PD hover controller keeps it floating ~1.2m above
// terrain via a Y-axis force each frame; W/S = throttle, A/D = steer
// torque, Shift = boost, Space = hop, E = mount/dismount.
//
// Mounted-rider model:
//   - ctx.speeder.mounted gates updatePlayer (player WASD ignored).
//   - updateSpeeder teleports the player's kinematic capsule to the
//     bike's rider seat each frame so the camera (sourced from the
//     player body) ends up at the rider's eyes.
//   - Mouse-look still works because PointerLockControls writes camera
//     rotation directly, not via the player body.
//
// Dismount: player capsule teleports 1.8m to the right of the bike's
// heading so they're standing alongside it, ready to re-mount.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import { Tuning } from '../config/tuning.ts';
import { makeEngineBellMesh } from './wrecks.ts';
import { mergeStaticByMaterial } from './wreckForms.ts';   // ACAS A2 — static-merge the speeder body
import { createMetalMaterial } from './metalMaterial.ts';
import { createPaintedMetalMaterial } from './paintMaterial.ts';
import {
  createParticleTrail, emitParticle, updateParticleTrail, disposeParticleTrail,
  type ParticleTrail,
} from './particleTrail.ts';
import {
  startSpeederThrust,
  setSpeederThrustSpeed,
  stopSpeederThrust,
} from '../audio/audio.ts';
import { transferTetherOnMount, transferTetherOnDismount } from './sled.ts';
import { stormWindAccel } from './weather.ts';

export interface SpeederState {
  body: RAPIER.RigidBody;
  group: THREE.Group;
  mounted: boolean;
  /** Last-frame yaw of the bike (radians around Y). Cached so we can
   *  rotate rider-seat offsets without re-extracting from quaternion. */
  yaw: number;
  /** Current speed (m/s, horizontal). Useful for camera shake, audio. */
  speed: number;
  /** CC-2 — visual-only pitch + roll on top of the body's yaw quaternion.
   *  Lerped toward target each frame; gives tactile body language under
   *  input. Physics body itself is X+Z-locked (D34). */
  visualPitch: number;
  visualRoll: number;
  /** CC-2 — 2-phase jump state. */
  jumpPhase: 'idle' | 'pulse' | 'recover';
  jumpTimer: number;
  /** CC-2.1 — last roll applied to camera, so we can undo it before
   *  applying the new roll each frame. Otherwise multiply accumulates
   *  and the camera spins indefinitely under steady strafe. */
  lastCamRoll: number;
  /** CC-2.2 — toggleable headlight. L key flips it; persists across
   *  mount/dismount so the bike can light its surroundings while parked. */
  headlampOn: boolean;
  headlamp: THREE.SpotLight;
  headlampDisc: THREE.Mesh;
  /** CC-3.1 — seat mesh, tagged as interactable so the interaction
   *  system shows a "[E] mount speeder" prompt when looked at. */
  seat: THREE.Mesh;
  /** QQ-2 — small horizontal bar behind the seat used as the rope
   *  anchor when towing a sled. Mesh ref kept so updateSleds can
   *  read its world position each frame. */
  towBar: THREE.Mesh;
}

// ── Materials — same palette as the wrecks so the bike feels in-universe.
// ABH — speeder hull is the PAINTED industrial archetype the paint shader
// was designed for. Hull + dark variants get painted-corroded; rust patches
// stay raw rust (they're already the substrate exposed); antenna gets
// weathered metal (small accent, no paint).
// ABN — localSpace anchors the chip + drip pattern to the speeder hull
// so paint streaks don't crawl as the player drives. Static painted
// surfaces (locker, megaWreck panels) leave this false for coherent
// world-aligned weathering.
const _hullMat = createPaintedMetalMaterial(Tuning.WRECK_HULL_HEX, { wearLevel: 0.55, localSpace: true });
const _hullDarkMat = createPaintedMetalMaterial(Tuning.WRECK_HULL_DARK_HEX, { wearLevel: 0.55, localSpace: true });
const _rustMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_RUST_HEX,
  flatShading: true,
});
const _rustDarkMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_RUST_DARK_HEX,
  flatShading: true,
});
// ACT — localSpace: true (D109). The speeder MOVES, so world-space noise
// sampling made the antenna's brushed-metal scratches crawl across the
// surface as the bike drove (the reported "texture shifts when the bike
// moves" bug). The hull mats above already pass localSpace; the antenna was
// the lone holdout. localSpace anchors the grain to the object frame.
const _antennaMat = createMetalMaterial(Tuning.WRECK_ANTENNA_HEX, { wornScale: 12.0, rustLevel: 0.4, localSpace: true });   // ACAD
const _nozzleInteriorMat = new THREE.MeshBasicMaterial({
  color: Tuning.WRECK_NOZZLE_INTERIOR_HEX,
});
const _nozzleRimMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_NOZZLE_RIM_HEX,
  flatShading: true,
});
// Emissive accents — headlamp glow (on/off variants) + antenna tip light.
const _headlampOnMat = new THREE.MeshBasicMaterial({ color: 0xfff3c8 });
const _headlampOffMat = new THREE.MeshBasicMaterial({ color: 0x3a2818 });
const _antennaTipMat = new THREE.MeshBasicMaterial({ color: 0xff6644 });
// ACAH — antenna beacon: a small PointLight parented to the tip, pulsed slowly by
// updateSpeederFX (with the tip material color) so a parked bike is locatable.
let _antennaBeacon: THREE.PointLight | null = null;
const _beaconBright = new THREE.Color(Tuning.SPEEDER_ANTENNA_TIP_BRIGHT_HEX);
const _beaconDim = new THREE.Color(Tuning.SPEEDER_ANTENNA_TIP_DIM_HEX);
const _beaconScratch = new THREE.Color();

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function cyl(rTop: number, rBot: number, h: number, mat: THREE.Material, seg = 8): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
}

/**
 * Build the speeder bike geometry — CC-2 rebuild. Salvaged-scoutbike
 * silhouette: long forward arm with a headlamp, sunken cockpit with
 * windshield cowl, asymmetric rear engines (big primary on +X, smaller
 * rust-painted secondary on -X), side-mounted fuel canister, foot pegs,
 * exposed cables underneath, vent louvers, patched rust panels.
 *
 * Local-space convention: bike points along -Z (forward = -Z), rider
 * seat at (0, 0.22, 0.50). All detail meshes overlap their anchor by
 * at least 0.04m so nothing visibly floats.
 */
export function makeSpeeder(_rand: Rng): THREE.Group {
  const g = new THREE.Group();

  // ────────────────────────────────────────────────────────────────────
  // CENTRAL FUSELAGE — long narrow chassis. Y range [-0.16, +0.16].
  // ────────────────────────────────────────────────────────────────────
  const fuselage = box(0.45, 0.32, 2.8, _hullMat);
  fuselage.position.set(0, 0, 0);
  g.add(fuselage);

  // ────────────────────────────────────────────────────────────────────
  // FORWARD ARM — 2-stage taper + cone tip. 74-Z scoutbike nose.
  // ────────────────────────────────────────────────────────────────────
  {
    // Stage 1: connects to fuselage front (overlaps by 0.2m).
    const arm1 = box(0.32, 0.24, 1.0, _hullDarkMat);
    arm1.position.set(0, 0, -1.7);
    g.add(arm1);
    // Stage 2: narrower forward extension (overlaps arm1 by 0.15m).
    const arm2 = box(0.20, 0.18, 0.7, _hullDarkMat);
    arm2.position.set(0, 0, -2.4);
    g.add(arm2);
    // Tapered tip (cylinder along Z).
    const tip = cyl(0.02, 0.10, 0.5, _hullDarkMat, 6);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, 0, -2.85);
    g.add(tip);
  }

  // ────────────────────────────────────────────────────────────────────
  // FRONT HEADLAMP — fixture on top of arm2 + actual SpotLight as
  // a child of the bike group so it moves with the bike. Disc material
  // and light intensity both toggle via L key (handled in updateSpeeder).
  // ────────────────────────────────────────────────────────────────────
  {
    const housing = cyl(0.08, 0.09, 0.12, _hullDarkMat, 8);
    housing.rotation.x = Math.PI / 2;
    housing.position.set(0, 0.10, -2.18);
    g.add(housing);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.062, 12),
      _headlampOffMat,                       // starts dim (off)
    );
    disc.position.set(0, 0.10, -2.245);
    disc.rotation.y = Math.PI;
    disc.userData.noShadow = true;
    disc.name = 'headlampDisc';              // looked up in placeSpeeder
    disc.userData.noMerge = true;            // ACAS A2 — material swapped on/off; keep live
    g.add(disc);
    // SpotLight + target. Cone narrow (Math.PI/5 ≈ 36° total), reaches
    // 30m. castShadow off — moving shadow maps on a fast vehicle are
    // expensive and add little. The light is OFF by default
    // (intensity 0); placeSpeeder reads ref and updateSpeeder toggles.
    const lamp = new THREE.SpotLight(0xfff3c8, 0, 30, Math.PI / 5, 0.4, 1.5);
    lamp.position.set(0, 0.10, -2.245);      // at the disc
    lamp.castShadow = false;
    lamp.name = 'headlamp';
    g.add(lamp);
    const lampTarget = new THREE.Object3D();
    lampTarget.position.set(0, -0.5, -15);    // 15m forward, slight downward angle
    g.add(lampTarget);
    lamp.target = lampTarget;
  }

  // ────────────────────────────────────────────────────────────────────
  // COCKPIT — sunken seat + windshield cowl. Sits IN the fuselage so
  // it reads as recessed rather than perched on top.
  // ────────────────────────────────────────────────────────────────────
  {
    // Seat block — Y range [0.09, 0.35], overlaps fuselage top (at 0.16) by 0.07m.
    // Tagged interactable so the look-at "[E] mount" prompt fires (CC-3.1).
    const seat = box(0.40, 0.26, 0.60, _hullDarkMat);
    seat.position.set(0, 0.22, 0.50);
    seat.name = 'speederSeat';
    seat.userData.interactType = 'mount';
    seat.userData.interactId = 0;
    seat.userData.interactRegistry = 'speeder';
    g.add(seat);
    // Backrest — short raised wedge behind seat.
    const back = box(0.36, 0.30, 0.10, _hullDarkMat);
    back.position.set(0, 0.40, 0.78);
    g.add(back);
    // Seat cushion (small rust pad on top of seat).
    const cushion = box(0.34, 0.04, 0.50, _rustDarkMat);
    cushion.position.set(0, 0.37, 0.50);
    g.add(cushion);
    // QQ-2 — tow-bar: small horizontal crossbar behind the backrest,
    // bolted to two short uprights. Used as the rope-attach point when
    // towing a sled. Sits just above the fuselage between the backrest
    // and the engine pods so it reads as a deliberate tow rig.
    {
      // Two vertical posts. ACAH — lengthened 0.16→0.28 + lowered the centre so
      // the post BOTTOMS embed into the fuselage deck (~0.16) instead of floating
      // ~6cm above it (the previous y=0.30/len=0.16 left the bottoms at 0.22).
      for (const sx of [-1, 1]) {
        const post = cyl(0.025, 0.025, 0.28, _nozzleRimMat, 6);
        post.position.set(sx * 0.13, 0.24, 0.95);
        g.add(post);
      }
      // Horizontal cross-bar — runs left-right at the top of the posts (kept at
      // y=0.38 so the rope-anchor height is unchanged).
      const bar = cyl(0.030, 0.030, 0.34, _nozzleRimMat, 8);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 0.38, 0.95);
      bar.name = 'speederTowBar';
      bar.userData.noMerge = true;           // ACAS A2 — sled rope-anchor ref; keep live
      // M5 (C24) — the tow-bar is a rope-ATTACH interactable: LMB ties/unties a
      // player-tethered sled to the speeder. Works while PARKED (no mounting needed)
      // — an explicit alternative to the mount auto-transfer; mirrors the stake's
      // rope-attach (interaction.ts case 'speeder' → 'attach_rope'). Both tags so
      // resolveInteractable picks the bar (not the seat's 'mount').
      bar.userData.interactType = 'attach_rope';
      bar.userData.interactRegistry = 'speeder';
      g.add(bar);
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // HANDLEBARS — anchored to an ANGLED STEM (slight back-lean toward
  // rider, ~10°) that connects them to the fuselage top.
  // ────────────────────────────────────────────────────────────────────
  {
    // Stem — angled (rotation.x = +0.18 rad ≈ 10°). Top stays at the
    // handlebar position; bottom is slightly forward of top, anchored
    // into the fuselage. Position math: stem local +Y world direction
    // is (0, cos(0.18), sin(0.18)); half-length 0.15; for top at
    // (0, 0.42, 0): center = (0, 0.42 - 0.148, 0 - 0.027) = (0, 0.272, -0.027).
    const stem = box(0.10, 0.30, 0.10, _hullDarkMat);
    stem.position.set(0, 0.272, -0.027);
    stem.rotation.x = 0.18;
    g.add(stem);
    // Handlebar crossbar.
    const bars = cyl(0.045, 0.045, 0.7, _nozzleRimMat, 6);
    bars.rotation.z = Math.PI / 2;
    bars.position.set(0, 0.42, 0.00);
    g.add(bars);
    for (const x of [-0.34, 0.34]) {
      const grip = cyl(0.055, 0.06, 0.14, _rustMat, 6);
      grip.rotation.z = Math.PI / 2;
      grip.position.set(x, 0.42, 0.00);
      g.add(grip);
    }
    // Dashboard nub centered between grips, mounted on the stem top.
    const dash = box(0.16, 0.10, 0.10, _hullDarkMat);
    dash.position.set(0, 0.44, 0.02);
    g.add(dash);
    // Tiny gauge disc.
    const gauge = new THREE.Mesh(
      new THREE.CircleGeometry(0.025, 10),
      new THREE.MeshBasicMaterial({ color: 0x88aaff }),
    );
    gauge.position.set(0, 0.46, -0.04);
    gauge.userData.noShadow = true;
    g.add(gauge);
  }

  // ────────────────────────────────────────────────────────────────────
  // WINDSHIELD COWL — IN FRONT of the handlebars, tilted back-up so it
  // deflects wind over the rider. Lowered (Y=0.24) so the front-lower
  // edge anchors INTO the fuselage top (~0.04m overlap), no float.
  // ────────────────────────────────────────────────────────────────────
  {
    const cowl = box(0.42, 0.04, 0.45, _hullDarkMat);
    cowl.position.set(0, 0.24, -0.30);
    cowl.rotation.x = -0.55;
    g.add(cowl);
    // Cowl edge trim — thin rust stripe along the leading (lower) edge.
    const trim = box(0.42, 0.02, 0.05, _rustMat);
    trim.position.set(0, 0.12, -0.49);
    trim.rotation.x = -0.55;
    g.add(trim);
  }

  // ────────────────────────────────────────────────────────────────────
  // ASYMMETRIC REAR ENGINES — primary (+X, big) + secondary (-X, salvaged).
  // Bells use the shared 3D mesh helper (CC-3) — flared cone + recessed
  // interior; no more flat single-sided discs.
  // ────────────────────────────────────────────────────────────────────
  // PRIMARY — big pod, hull-colored. Pod's -X end (X=0.07..0.225) is
  // buried inside the fuselage (-0.225..0.225), so the visual "weld"
  // is implicit at that junction — no separate strut needed.
  {
    const pod = box(0.50, 0.45, 0.90, _hullMat);
    pod.position.set(0.32, 0, 1.55);
    g.add(pod);
    // 3D bell — mouth opens +Z (rotation.x = +π/2 maps local +Y → world +Z).
    const bell = makeEngineBellMesh(0.22, 0.45, _hullDarkMat, _nozzleInteriorMat);
    bell.rotation.x = Math.PI / 2;
    bell.position.set(0.32, 0, 1.85);
    g.add(bell);
  }
  // SECONDARY — smaller, rust-painted, looks salvaged from another wreck.
  // Same implicit-weld pattern as primary; pod embeds into fuselage.
  {
    const pod = box(0.34, 0.30, 0.70, _rustMat);
    pod.position.set(-0.30, -0.02, 1.45);
    g.add(pod);
    const bell = makeEngineBellMesh(0.14, 0.32, _hullDarkMat, _nozzleInteriorMat);
    bell.rotation.x = Math.PI / 2;
    bell.position.set(-0.30, -0.02, 1.65);
    g.add(bell);
  }

  // ────────────────────────────────────────────────────────────────────
  // SIDE SADDLEBAG (CC-3.1) — single bag mounted on the primary engine's
  // +X face. Uses the chunky top-rack box shape. Two straps wrap fully
  // around the bag + engine assembly (4-piece ring per strap) so the
  // bag reads as actually lashed to the bike, not stuck on.
  // ────────────────────────────────────────────────────────────────────
  {
    // Bag — 0.20 wide × 0.35 tall × 0.55 long, on +X face of primary pod.
    // Engine pod outer +X face at X = 0.57; bag center X = 0.63 (inner
    // edge at 0.53 → 0.04m overlap into pod).
    const bag = box(0.20, 0.35, 0.55, _rustMat);
    bag.position.set(0.63, 0, 1.55);
    g.add(bag);
    // Two wrap-around straps. Each strap is an 8-piece ring that HUGS
    // the surface contour: runs along pod top/bottom at Y=±0.245, steps
    // down to bag top/bottom at Y=±0.195 at the bag's inner edge
    // (X=0.53), then wraps around the bag's outer face (X=0.75). The
    // step-pieces sell "strap drops over the bag's lip" — no more
    // floating corners above/below the shorter bag.
    //
    //   Pod: X[0.07, 0.57], Y[±0.225] (taller)
    //   Bag: X[0.53, 0.73], Y[±0.175] (shorter, sticks out +X)
    //   Strap offset: 0.02m above each surface, thickness 0.04m, Z-depth 0.04m.
    for (const z of [1.30, 1.80]) {
      // All strap pieces share consistent 0.04 thickness and 0.04 depth.
      // 1) Pod top — X=0.05 to 0.53.
      const podTop = box(0.48, 0.04, 0.04, _hullDarkMat);
      podTop.position.set(0.29, 0.245, z);
      g.add(podTop);
      // 2) Step-down at bag's inner edge — vertical strap segment.
      const stepTop = box(0.04, 0.05, 0.04, _hullDarkMat);
      stepTop.position.set(0.53, 0.220, z);
      g.add(stepTop);
      // 3) Bag top — X=0.53 to 0.75.
      const bagTop = box(0.22, 0.04, 0.04, _hullDarkMat);
      bagTop.position.set(0.64, 0.195, z);
      g.add(bagTop);
      // 4) Bag outer side — wraps the bag's +X face top to bottom.
      const bagOuter = box(0.04, 0.39, 0.04, _hullDarkMat);
      bagOuter.position.set(0.75, 0, z);
      g.add(bagOuter);
      // 5) Bag bottom — mirror of bag top.
      const bagBot = box(0.22, 0.04, 0.04, _hullDarkMat);
      bagBot.position.set(0.64, -0.195, z);
      g.add(bagBot);
      // 6) Step-up at bag-pod junction — mirror of step-down.
      const stepBot = box(0.04, 0.05, 0.04, _hullDarkMat);
      stepBot.position.set(0.53, -0.220, z);
      g.add(stepBot);
      // 7) Pod bottom — mirror of pod top.
      const podBot = box(0.48, 0.04, 0.04, _hullDarkMat);
      podBot.position.set(0.29, -0.245, z);
      g.add(podBot);
      // 8) Pod inner side — wraps the pod's -X face top to bottom.
      const podInner = box(0.04, 0.49, 0.04, _hullDarkMat);
      podInner.position.set(0.05, 0, z);
      g.add(podInner);
      // 9) Junction buckle — sits ON the bag-top strap at the engine
      //    end, bridging step-down and bag-top so the bend reads as
      //    one connected wrap. Cross-section matches the strap
      //    (0.04 × 0.04); only the length along X varies.
      const buckle = box(0.05, 0.04, 0.04, _hullDarkMat);
      buckle.position.set(0.56, 0.215, z);
      g.add(buckle);
    }
    // Buckle on the bag's outer face, between the two straps.
    const buckle = box(0.05, 0.07, 0.04, _antennaMat);
    buckle.position.set(0.74, -0.05, 1.55);
    g.add(buckle);
  }

  // ────────────────────────────────────────────────────────────────────
  // FUEL CANISTER on +X side — cylindrical tank with 2 metal bands.
  // ────────────────────────────────────────────────────────────────────
  {
    const tank = cyl(0.13, 0.13, 0.65, _rustMat, 10);
    tank.rotation.x = Math.PI / 2;
    tank.position.set(0.32, 0.04, 0.70);    // overlaps fuselage by ~0.005m + sits up against it
    g.add(tank);
    // 2 banding straps.
    for (const z of [0.48, 0.92]) {
      const band = cyl(0.135, 0.135, 0.03, _hullDarkMat, 10);
      band.rotation.x = Math.PI / 2;
      band.position.set(0.32, 0.04, z);
      g.add(band);
    }
    // Cap on the back end.
    const cap = cyl(0.06, 0.08, 0.05, _hullDarkMat, 8);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(0.32, 0.04, 1.05);
    g.add(cap);
  }

  // ────────────────────────────────────────────────────────────────────
  // FOOT PEGS — cylindrical projections at cockpit for the rider's feet.
  // Moved forward to Z=0.15 (was 0.40) so they clear the +X fuel canister
  // which spans Z=[0.375, 1.025].
  // ────────────────────────────────────────────────────────────────────
  for (const side of [-1, 1] as const) {
    const peg = cyl(0.03, 0.03, 0.22, _nozzleRimMat, 6);
    peg.rotation.z = Math.PI / 2;
    peg.position.set(side * 0.30, -0.08, 0.15);   // peg root inside fuselage by 0.075m
    g.add(peg);
    // Peg foot pad (flat box at the end).
    const pad = box(0.08, 0.02, 0.10, _hullDarkMat);
    pad.position.set(side * 0.43, -0.08, 0.15);
    g.add(pad);
  }

  // ────────────────────────────────────────────────────────────────────
  // EXPOSED CABLES underneath — 4 thin cylinders connecting fore/aft.
  // ────────────────────────────────────────────────────────────────────
  for (const [xOff, length, zCenter] of [
    [-0.12, 2.4, 0.0],
    [-0.04, 2.5, 0.05],
    [0.04, 2.5, -0.05],
    [0.12, 2.4, 0.0],
  ] as const) {
    const cable = cyl(0.020, 0.020, length, _antennaMat, 5);
    cable.rotation.x = Math.PI / 2;
    cable.position.set(xOff, -0.14, zCenter);     // overlaps fuselage bottom (Y=-0.16) by 0.02m
    g.add(cable);
  }
  // Vertical cable junction near the primary engine (drops from fuselage to strut area).
  {
    const drop = cyl(0.018, 0.018, 0.22, _antennaMat, 5);
    drop.position.set(0.14, -0.05, 1.25);
    g.add(drop);
  }

  // ────────────────────────────────────────────────────────────────────
  // VENT LOUVERS on +X side fuselage panel — 4 horizontal slats.
  // ────────────────────────────────────────────────────────────────────
  for (let i = 0; i < 4; i++) {
    const slat = box(0.025, 0.035, 0.28, _hullDarkMat);
    slat.position.set(0.232, -0.06 + i * 0.06, -0.5);   // intersects fuselage side (X=0.225) by 0.007m
    g.add(slat);
  }
  // Symmetric smaller vent on -X side (3 slats).
  for (let i = 0; i < 3; i++) {
    const slat = box(0.025, 0.030, 0.22, _hullDarkMat);
    slat.position.set(-0.232, -0.04 + i * 0.05, -0.7);
    g.add(slat);
  }

  // ────────────────────────────────────────────────────────────────────
  // PATCHED RUST PANELS — small welded-on plates. Each overlaps the
  // fuselage by ≥0.04m so it can't visibly float.
  // ────────────────────────────────────────────────────────────────────
  for (const [x, y, z, w, h, d, mat] of [
    [-0.225, 0.04, -0.3, 0.04, 0.18, 0.32, _rustMat],
    [-0.225, -0.04, 0.5, 0.04, 0.10, 0.20, _rustDarkMat],
    [0, -0.16, 0.0, 0.18, 0.04, 0.30, _rustMat],
    [0, 0.16, -0.6, 0.16, 0.04, 0.22, _rustDarkMat],
    [0.225, -0.02, 0.2, 0.04, 0.14, 0.18, _rustMat],
    [-0.18, 0.16, 0.30, 0.10, 0.04, 0.12, _rustDarkMat],
  ] as const) {
    const patch = box(w, h, d, mat);
    patch.position.set(x, y, z);
    g.add(patch);
  }

  // ────────────────────────────────────────────────────────────────────
  // RUST STREAKS on side panels — thin vertical drips.
  // ────────────────────────────────────────────────────────────────────
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const z = -0.9 + (i % 3) * 0.6;
    const h = 0.10 + (i % 2) * 0.05;
    const streak = box(0.02, h, 0.05, _rustDarkMat);
    streak.position.set(side * 0.237, -0.02, z);
    g.add(streak);
  }

  // ────────────────────────────────────────────────────────────────────
  // ANTENNA WHIP — back-right for asymmetric silhouette. Tip light is a
  // CHILD of the antenna mesh so it tracks any antenna rotation/position
  // without drifting (was floating ~0.15m off previously due to manual
  // world-space placement vs. the antenna's compound rotation).
  // ────────────────────────────────────────────────────────────────────
  {
    const antenna = cyl(0.018, 0.028, 0.85, _antennaMat, 5);
    antenna.position.set(0.15, 0.58, 1.0);
    // Forward = -Z (see "Local-space convention" above). +rotation.x leans the
    // whip's tip toward +Z = the REAR. Flipped from -0.18 (leaned forward) on
    // user feedback that the antenna should angle rearward.
    antenna.rotation.x = 0.18;
    antenna.rotation.z = 0.10;
    antenna.userData.noMerge = true;         // ACAS A2 — carries the tip-light + pulsed beacon; keep the subtree live
    g.add(antenna);
    // Tip light at the antenna's local +Y top (cylinder length 0.85 →
    // half = 0.425). Slightly inset (0.41) so the sphere overlaps the
    // antenna tip rather than sitting just past it.
    const tipLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.030, 6, 6),
      _antennaTipMat,
    );
    tipLight.position.set(0, 0.41, 0);   // local to antenna
    tipLight.userData.noShadow = true;
    antenna.add(tipLight);
    // ACAH — beacon PointLight parented to the tip (tracks the antenna's compound
    // rotation for free); intensity pulsed in updateSpeederFX.
    const beacon = new THREE.PointLight(
      Tuning.SPEEDER_ANTENNA_TIP_BRIGHT_HEX, 0, Tuning.SPEEDER_ANTENNA_BEACON_RANGE, 2.0);
    beacon.castShadow = false;
    tipLight.add(beacon);
    _antennaBeacon = beacon;
  }

  // ────────────────────────────────────────────────────────────────────
  // SIDE FINS — raised so they overlap fuselage bottom (no gap).
  // ────────────────────────────────────────────────────────────────────
  for (const side of [-1, 1] as const) {
    const fin = box(0.04, 0.22, 1.7, _hullDarkMat);
    fin.position.set(side * 0.24, -0.18, 0);     // top at Y=-0.07, fuselage bottom at -0.16 → 0.09m overlap
    g.add(fin);
    // Down-tilted forward extension.
    const tipBox = box(0.04, 0.14, 0.35, _hullDarkMat);
    tipBox.position.set(side * 0.24, -0.26, -0.9);
    g.add(tipBox);
  }

  // ── Shadow flags. Respect userData.noShadow for emissive bits.
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = !m.userData.noShadow;
      m.receiveShadow = true;
    }
  });

  // ACAS A2 — static-merge the body. The collider is hand-defined cuboids in
  // placeSpeeder (independent of these meshes), so collapsing the visual hull is
  // collider-safe. The merge SKIPS the seat (interactType='mount'), the headlamp
  // disc + tow-bar + antenna (userData.noMerge), and leaves the headlamp/beacon
  // lights (direct children of g, not meshes) untouched — so mount, headlamp
  // toggle, sled tow, and the antenna beacon all keep working. placeSpeeder's
  // getObjectByName('headlampDisc'|'speederTowBar'|'speederSeat'|'headlamp')
  // still resolves because those parts survive.
  mergeStaticByMaterial(g);

  return g;
}

/**
 * Spawn the speeder at the given world position. Creates a dynamic
 * rigid body with locked X+Z rotations (so the bike stays upright),
 * a single cuboid collider, and the meshes from makeSpeeder.
 */
export function placeSpeeder(
  scene: THREE.Scene,
  world: RAPIER.World,
  _terrain: Terrain,
  pos: THREE.Vector3,
  yaw: number,
  rand: Rng,
): SpeederState {
  const group = makeSpeeder(rand);
  group.position.copy(pos);
  group.rotation.y = yaw;
  scene.add(group);

  // ── Dynamic body. Lock X+Z rotations (pitch + roll); allow Y (yaw)
  // freely so steering torque can rotate the bike. Pre-yaw the body so
  // it spawns facing the desired direction.
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(pos.x, pos.y, pos.z)
    .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
    .setLinearDamping(Tuning.SPEEDER_LINEAR_DAMP)
    .setAngularDamping(Tuning.SPEEDER_ANGULAR_DAMP);
  const body = world.createRigidBody(bodyDesc);
  // setEnabledRotations(x, y, z, wakeUp) — only Y free, so the chassis
  // stays upright after collisions but still steers via yaw torque.
  body.setEnabledRotations(false, true, false, true);
  // Disable gravity for the bike — we drive Y entirely via velocity
  // control in updateSpeeder. Rapier's Euler-integrated gravity
  // re-applied per step otherwise cancels our hover velocity and the
  // bike settles below the target.
  body.setGravityScale(0, true);

  // ── Collider — single cuboid matching the fuselage (plus a little
  // margin for the cockpit + pods).
  const colDesc = RAPIER.ColliderDesc.cuboid(0.55, 0.45, 1.5)
    .setDensity(Tuning.SPEEDER_DENSITY)
    .setRestitution(0.1)
    .setFriction(0.4);
  world.createCollider(colDesc, body);
  // CC-3.2 — additional compound colliders so the bike's collision shape
  // matches its visible silhouette: forward arm/nose (extends -Z past the
  // main cuboid) and the two engine bells (extend +Z past the cuboid).
  // All attached to the same dynamic body — mass + inertia adjust
  // automatically from each collider's density.
  // Quaternion for rotating the bell cylinders so their axis points along
  // world Z (cylinder default axis is local Y).
  const bellRotQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const bellRot = { x: bellRotQ.x, y: bellRotQ.y, z: bellRotQ.z, w: bellRotQ.w };
  // Forward arm + nose: covers arm1 (Z=-2.2 to -1.2), arm2 (-2.75 to -2.05),
  // tip (-3.10 to -2.60) and headlamp housing. Single cuboid is enough —
  // ~0.32 wide × 0.24 tall × 1.85 long, centered at Z=-2.025.
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.16, 0.12, 0.93)
      .setTranslation(0, 0, -2.025)
      .setDensity(Tuning.SPEEDER_DENSITY * 0.6),    // lighter than main pod
    body,
  );
  // Primary engine bell — cylinder axis along Z, radius 0.20.
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(0.225, 0.20)
      .setTranslation(0.32, 0, 2.075)
      .setRotation(bellRot)
      .setDensity(Tuning.SPEEDER_DENSITY * 0.5),
    body,
  );
  // Secondary engine bell — smaller cylinder.
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(0.16, 0.13)
      .setTranslation(-0.30, -0.02, 1.81)
      .setRotation(bellRot)
      .setDensity(Tuning.SPEEDER_DENSITY * 0.5),
    body,
  );

  // CC-2.2 — pull out the headlamp refs from the geometry so we can
  // toggle them from updateSpeeder.
  const headlamp = group.getObjectByName('headlamp') as THREE.SpotLight;
  const headlampDisc = group.getObjectByName('headlampDisc') as THREE.Mesh;
  // CC-3.1 — seat ref for the interaction system to raycast against.
  const seat = group.getObjectByName('speederSeat') as THREE.Mesh;
  // QQ-2 — tow-bar ref for the rope anchor when towing a sled.
  const towBar = group.getObjectByName('speederTowBar') as THREE.Mesh;

  return {
    body,
    group,
    mounted: false,
    yaw,
    speed: 0,
    visualPitch: 0,
    visualRoll: 0,
    jumpPhase: 'idle',
    jumpTimer: 0,
    lastCamRoll: 0,
    headlampOn: false,
    headlamp,
    headlampDisc,
    seat,
    towBar,
  };
}

// ── Per-frame update --------------------------------------------------------

const _bikeWorld = new THREE.Vector3();
const _bikeQuat = new THREE.Quaternion();
const _bikeEuler = new THREE.Euler();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _riderOffset = new THREE.Vector3();
const _ridePos = new THREE.Vector3();
// CC-2 — quaternion scratch for visual tilt composition.
const _axisX = new THREE.Vector3(1, 0, 0);
const _axisY = new THREE.Vector3(0, 1, 0);
const _axisZ = new THREE.Vector3(0, 0, 1);
const _yawQ = new THREE.Quaternion();
const _pitchQ = new THREE.Quaternion();
const _rollQ = new THREE.Quaternion();
const _visualQ = new THREE.Quaternion();
const _camRollQ = new THREE.Quaternion();

// ACL SPEEDER ANGULAR DAMPING — passive yaw-rate damping while mounted.
// Tuning.SPEEDER_ANGULAR_DAMP (the body-level Rapier damping) is 0, so a
// post-collision yaw spin would persist until the steering lerp alone
// bled it off. This exp-decay rate bleeds residual yaw rate per second
// (Y-axis only; X+Z stay locked by setEnabledRotations, so upright
// recovery is untouched). Kept gentle so it composes with steering
// without feeling sluggish — at ~1.2/s, a 1 rad/s free spin drops to
// ~0.3 rad/s after 1s; over a 60fps frame steady steering loses ~2%,
// imperceptible. Promoted to Tuning (integration).
const SPEEDER_MOUNTED_ANGULAR_DAMP_RATE_PER_S = Tuning.SPEEDER_MOUNTED_ANGULAR_DAMP_RATE_PER_S;

// ── ACW C7/C8 — speeder dust trail + engine-ignition glow ────────────────
// Pooled sandy dust kicked up behind/under the bike (speed-gated), plus a
// nozzle emissive ramp + a glow PointLight that brightens with speed (so the
// engines "ignite" under throttle and die when parked). Lazily created on the
// first update (needs the scene); HMR-disposed so a tuning reload rebuilds.
let _dust: ParticleTrail | null = null;
let _glowLight: THREE.PointLight | null = null;
let _fxScene: THREE.Scene | null = null;
const _nozzleBaseColor = new THREE.Color(Tuning.WRECK_NOZZLE_INTERIOR_HEX);
const _nozzleHotColor = new THREE.Color(Tuning.SPEEDER_GLOW_HOT_HEX);
const _fxScratchColor = new THREE.Color();
if ((import.meta as { hot?: { dispose: (cb: () => void) => void } }).hot) {
  (import.meta as { hot: { dispose: (cb: () => void) => void } }).hot.dispose(() => {
    if (_dust && _fxScene) disposeParticleTrail(_dust, _fxScene);
    if (_glowLight && _fxScene) _fxScene.remove(_glowLight);
    _dust = null; _glowLight = null; _fxScene = null;
  });
}

function updateSpeederFX(ctx: GameContext, s: SpeederState, dt: number): void {
  const scene = ctx.three.scene;
  if (!_dust || !_glowLight) {
    _dust = createParticleTrail(scene, {
      count: 200, color: 0xc2a37c, opacity: 0.5, gravity: 1.4, drag: 1.1,
    });
    _glowLight = new THREE.PointLight(0xff6a22, 0, 4.5, 2.0);
    scene.add(_glowLight);
    _fxScene = scene;
  }
  const pos = s.body.translation();
  const cos = Math.cos(s.yaw), sin = Math.sin(s.yaw);
  const speedNorm = Math.min(1.3, s.speed / Tuning.SPEEDER_MAX_SPEED);

  // ENGINE GLOW — nozzle interior emissive ramps base→hot with speed; a
  // PointLight at the primary nozzle pools warm light behind the bike. Both
  // saturate at full forward speed and keep glowing on boost; die when parked.
  const glow = Math.min(1, speedNorm);
  _fxScratchColor.copy(_nozzleBaseColor).lerp(_nozzleHotColor, glow);
  _nozzleInteriorMat.color.copy(_fxScratchColor);
  // Primary nozzle world position: local (0.32, 0, 1.85) rear (+Z), rotated
  // by yaw (same rotation convention as the rider-seat offset).
  const nlx = 0.32, nlz = 1.85;
  const nx = pos.x + (nlx * cos + nlz * sin);
  const nz = pos.z + (-nlx * sin + nlz * cos);
  _glowLight.position.set(nx, pos.y, nz);
  _glowLight.intensity = glow * Tuning.SPEEDER_GLOW_MAX_INTENSITY;

  // DUST TRAIL — kicked up behind + below the bike while moving. Forward is
  // (-sin, -cos); behind is the negation. Emission scales with speed; boost
  // throws roughly 2× as much.
  if (s.speed >= Tuning.SPEEDER_DUST_MIN_SPEED) {
    const back = Tuning.SPEEDER_DUST_BACK_OFFSET;
    const bx = sin, bz = cos;          // behind (= -forward)
    const ex = pos.x + bx * back;
    const ey = pos.y - Tuning.SPEEDER_DUST_DOWN_OFFSET;
    const ez = pos.z + bz * back;
    const n = Math.round(Tuning.SPEEDER_DUST_PER_FRAME * (1 + speedNorm));
    for (let i = 0; i < n; i++) {
      emitParticle(_dust, {
        x: ex + (Math.random() - 0.5) * 0.5,
        y: ey + (Math.random() - 0.5) * 0.2,
        z: ez + (Math.random() - 0.5) * 0.5,
        // drift further back + a little lateral spread + a soft upward billow
        vx: bx * (1.2 + Math.random() * 1.6) + (Math.random() - 0.5) * 1.0,
        vy: 0.5 + Math.random() * 0.9,
        vz: bz * (1.2 + Math.random() * 1.6) + (Math.random() - 0.5) * 1.0,
        life: 0.7 + Math.random() * 0.7,
        // psize is ~world-diameter (shader: gl_PointSize = psize*uScale/dist);
        // ~0.5-1.1 reads as a dust mote, not a screen-filling blob.
        size: 0.5 + Math.random() * 0.6,
      });
    }
  }
  updateParticleTrail(_dust, dt);

  // ANTENNA BEACON — slow pulse on the tip (material color + a parented PointLight)
  // so a parked bike is findable at dusk/night. Deterministic on elapsed time;
  // squared sine so it spends more of the cycle near "off" (reads as a blink, not
  // a steady breathe). Runs always (mounted or parked).
  {
    const s01 = 0.5 + 0.5 * Math.sin(ctx.time.elapsed * Tuning.SPEEDER_ANTENNA_BLINK_HZ * Math.PI * 2);
    const blink = s01 * s01;
    _beaconScratch.copy(_beaconDim).lerp(_beaconBright, blink);
    _antennaTipMat.color.copy(_beaconScratch);
    if (_antennaBeacon) _antennaBeacon.intensity = blink * Tuning.SPEEDER_ANTENNA_BEACON_INTENSITY;
  }
}

export function updateSpeeder(ctx: GameContext, dt: number): void {
  const s = ctx.speeder;
  if (!s) return;
  const body = s.body;
  const pos = body.translation();
  const lv = body.linvel();

  // ── Read body yaw from quaternion (X+Z are locked, so it's effectively
  // just a rotation around Y).
  const rot = body.rotation();
  _bikeQuat.set(rot.x, rot.y, rot.z, rot.w);
  _bikeEuler.setFromQuaternion(_bikeQuat, 'YXZ');
  s.yaw = _bikeEuler.y;

  // ── CC-2 — update visual tilt from input. Target=0 if not mounted so
  // the parked bike sits flat. While mounted, W/S pitch nose-down/up and
  // A/D roll. Lerped toward target so transitions are smooth.
  const keys = ctx.input.keys;
  const fwdInputForTilt = s.mounted ? ((keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0)) : 0;
  const strafeInputForTilt = s.mounted ? ((keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0)) : 0;
  // Pitch: W (fwd) → nose down. Three.js's positive X-axis rotation
  // lifts -Z toward +Y (nose UP for a bike with forward=-Z), so negate.
  const targetPitch = -fwdInputForTilt * Tuning.SPEEDER_TILT_PITCH_MAX;
  const targetRoll = -strafeInputForTilt * Tuning.SPEEDER_TILT_ROLL_MAX;
  s.visualPitch += (targetPitch - s.visualPitch) * Tuning.SPEEDER_TILT_LERP;
  s.visualRoll += (targetRoll - s.visualRoll) * Tuning.SPEEDER_TILT_LERP;

  // Compose visual quaternion = yaw × pitch × roll (intrinsic order).
  _yawQ.setFromAxisAngle(_axisY, s.yaw);
  _pitchQ.setFromAxisAngle(_axisX, s.visualPitch);
  _rollQ.setFromAxisAngle(_axisZ, s.visualRoll);
  _visualQ.multiplyQuaternions(_yawQ, _pitchQ).multiply(_rollQ);

  // ── Sync visual mesh to body position + composed quaternion.
  s.group.position.set(pos.x, pos.y, pos.z);
  s.group.quaternion.copy(_visualQ);

  // ── CC-2.2 — headlight toggle. L while mounted flips the lamp on/off
  // (persists across mount/dismount so the bike can light surroundings
  // while parked). Disc material + SpotLight intensity update together.
  if (s.mounted && ctx.input.pressed.has('KeyL')) {
    s.headlampOn = !s.headlampOn;
    ctx.ui.showToast?.(s.headlampOn ? 'headlight on' : 'headlight off');
  }
  s.headlamp.intensity = s.headlampOn ? 8 : 0;
  if (s.headlampDisc.material !== (s.headlampOn ? _headlampOnMat : _headlampOffMat)) {
    s.headlampDisc.material = s.headlampOn ? _headlampOnMat : _headlampOffMat;
  }

  // ── CC-2 — tick jump phase state machine + Space-to-start.
  if (s.jumpPhase !== 'idle') {
    s.jumpTimer -= dt;
    if (s.jumpTimer <= 0) {
      if (s.jumpPhase === 'pulse') {
        s.jumpPhase = 'recover';
        s.jumpTimer = Tuning.SPEEDER_JUMP_RECOVER_DUR;
      } else {
        s.jumpPhase = 'idle';
        s.jumpTimer = 0;
      }
    }
  }
  if (s.mounted && ctx.input.pressed.has('Space') && s.jumpPhase === 'idle') {
    s.jumpPhase = 'pulse';
    s.jumpTimer = Tuning.SPEEDER_JUMP_PULSE_DUR;
  }

  // ── Hover — velocity-controlled toward (max terrain ahead +
  // HOVER_HEIGHT). MAX over a short look-ahead window so the bike
  // anticipates upcoming dunes. At rest, samples collapse to current
  // position.
  let groundY = ctx.terrain.heightAt(pos.x, pos.z);
  const samples = Tuning.SPEEDER_HOVER_LOOKAHEAD_SAMPLES;
  const lookT = Tuning.SPEEDER_HOVER_LOOKAHEAD_T;
  for (let i = 1; i < samples; i++) {
    const t = (i / (samples - 1)) * lookT;
    const sx = pos.x + lv.x * t;
    const sz = pos.z + lv.z * t;
    const sy = ctx.terrain.heightAt(sx, sz);
    if (sy > groundY) groundY = sy;
  }
  const targetY = groundY + Tuning.SPEEDER_HOVER_HEIGHT;
  const yErr = targetY - pos.y;
  let targetVy = yErr * Tuning.SPEEDER_HOVER_K_P * 0.1;
  if (targetVy > Tuning.SPEEDER_HOVER_VY_MAX) targetVy = Tuning.SPEEDER_HOVER_VY_MAX;
  // Jump 'recover' phase — clamp the DESCENT side so the bike comes
  // down slowly (emphasizing the hover). Normal phase uses the full
  // -HOVER_VY_MAX clamp.
  const minTargetVy = s.jumpPhase === 'recover'
    ? Tuning.SPEEDER_JUMP_RECOVER_VY_MIN
    : -Tuning.SPEEDER_HOVER_VY_MAX;
  if (targetVy < minTargetVy) targetVy = minTargetVy;
  // CC-2.3 — softer lerp during recover so the transition from "rising"
  // to "falling at clamp" is gentle, not a hard pivot at the peak.
  const lerp = s.jumpPhase === 'recover'
    ? Tuning.SPEEDER_JUMP_RECOVER_LERP
    : 0.25;
  let newVy = lv.y + (targetVy - lv.y) * lerp;
  // CC-2.3 — jump 'pulse' phase: decay the upward floor LINEARLY from
  // JUMP_PULSE_VY to 0 over the pulse duration. Each frame the floor is
  // (remaining_time / total_duration) × JUMP_PULSE_VY. Result: the bike
  // accelerates upward at the start, decelerates smoothly through the
  // pulse, and reaches the peak without a hard cap.
  if (s.jumpPhase === 'pulse') {
    const tNorm = s.jumpTimer / Tuning.SPEEDER_JUMP_PULSE_DUR;   // 1 at start → 0 at end
    const pulseFloor = Tuning.SPEEDER_JUMP_PULSE_VY * tNorm;
    if (newVy < pulseFloor) newVy = pulseFloor;
  }
  // Session ABA — damp horizontal velocity when not mounted. Without
  // this, a player-capsule collision (or any external push) gives the
  // bike a one-way velocity it keeps forever — no friction, no
  // ground-contact (hover), no rider input to brake. Frame-rate-
  // independent exponential decay: vNew = v * exp(-rate*dt). At rate
  // 1.8/s a 3 m/s nudge decays to ~0.4 m/s in 1s and to ~0.05 m/s in
  // 2s. When mounted, the input-driven setLinvel at line ~874 fully
  // overrides this anyway, so skip the damping cost.
  let unmountedDampedVx = lv.x;
  let unmountedDampedVz = lv.z;
  if (!s.mounted) {
    const damp = Math.exp(-Tuning.SPEEDER_UNMOUNTED_LINEAR_DAMP_RATE_PER_S * dt);
    unmountedDampedVx *= damp;
    unmountedDampedVz *= damp;
    // ACW E (#146) — storm wind shoves the parked bike downwind (the damping
    // above bleeds it back off once the gust eases).
    const wind = stormWindAccel(ctx.weather);
    unmountedDampedVx += wind.x * dt;
    unmountedDampedVz += wind.z * dt;
  }
  body.setLinvel({ x: unmountedDampedVx, y: newVy, z: unmountedDampedVz }, true);

  // ── Cache horizontal speed for HUD / audio.
  s.speed = Math.hypot(unmountedDampedVx, unmountedDampedVz);

  // ── ACW C7/C8 — dust trail + engine glow. Runs every frame (mounted or
  // not) so a coasting/parked bike still settles its FX; keyed to s.speed.
  updateSpeederFX(ctx, s, dt);

  // ── If not mounted, nothing else to do beyond damping ang/lin
  //    velocity + checking for a mount key-press.
  if (!s.mounted) {
    // Session ABA — also damp angular velocity (Y-axis only; X+Z are
    // locked by setEnabledRotations(false, true, false, ...) earlier
    // in placeSpeeder). A bumped bike that started spinning would
    // otherwise spin forever. Angular damps faster than linear since
    // a spinning hover bike looks especially wrong.
    const angDamp = Math.exp(-Tuning.SPEEDER_UNMOUNTED_ANGULAR_DAMP_RATE_PER_S * dt);
    const av = body.angvel();
    body.setAngvel({ x: 0, y: av.y * angDamp, z: 0 }, true);

    // Allow mount via E within range AND while looking at the bike.
    const playerPos = ctx.player.body.body.translation();
    const dx = playerPos.x - pos.x;
    const dz = playerPos.z - pos.z;
    const distSq = dx * dx + dz * dz;
    // ACQ — gate mount on the camera roughly facing the bike, so E near the
    // speeder (but looking away) no longer mounts unexpectedly. dot of the
    // horizontal camera-forward with the horizontal dir from the eye to the
    // bike must clear SPEEDER_MOUNT_LOOK_DOT. (camera.getWorldDirection is the
    // forward look dir in this codebase — see controller.ts movement.)
    const _cam = ctx.three.camera;
    _cam.getWorldDirection(_forward);
    const toBx = pos.x - _cam.position.x;
    const toBz = pos.z - _cam.position.z;
    const _toBLen = Math.hypot(toBx, toBz);
    const _fLen = Math.hypot(_forward.x, _forward.z);
    const lookDot = (_toBLen > 1e-4 && _fLen > 1e-4)
      ? (_forward.x * toBx + _forward.z * toBz) / (_toBLen * _fLen)
      : 1;
    if (
      ctx.input.pressed.has('KeyE') &&
      distSq <= Tuning.SPEEDER_MOUNT_RANGE * Tuning.SPEEDER_MOUNT_RANGE &&
      lookDot >= Tuning.SPEEDER_MOUNT_LOOK_DOT
    ) {
      s.mounted = true;
      ctx.ui.showToast?.('mounted speeder — E to dismount');
      // Park the player body far below the world so it can't collide
      // with the bike collider. We'll teleport it back on dismount.
      ctx.player.body.body.setNextKinematicTranslation({ x: 0, y: -2000, z: 0 });
      startSpeederThrust();
      // QQ — promote any 'player'-tethered sled to follow the speeder.
      transferTetherOnMount(ctx);
      // ABR P2 — snap 3P camera (no lerp across mount teleport).
      ctx.player.cameraSnapNextFrame = true;
    }
    return;
  }

  // ── Mounted — read input + apply forces. `keys` is already in scope
  // from the tilt computation at the top.
  const pressed = ctx.input.pressed;
  if (pressed.has('KeyE')) {
    s.mounted = false;
    // Teleport player to bike's right side. Use setTranslation (instant)
    // because updatePlayer runs LATER in the tick and would clobber a
    // setNextKinematicTranslation by reading the stale current position
    // (still parked at y=-2000) and rewriting it.
    _right.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
    const offX = pos.x + _right.x * Tuning.SPEEDER_DISMOUNT_OFFSET;
    const offZ = pos.z + _right.z * Tuning.SPEEDER_DISMOUNT_OFFSET;
    const offGround = ctx.terrain.heightAt(offX, offZ);
    const offY = offGround +
      ctx.player.body.halfHeight + ctx.player.body.radius + 0.05;
    ctx.player.body.body.setTranslation({ x: offX, y: offY, z: offZ }, true);
    // ABR P2 — snap 3P camera (no lerp across dismount teleport).
    ctx.player.cameraSnapNextFrame = true;
    ctx.ui.showToast?.('dismounted');
    stopSpeederThrust();
    // CC-2.1 — undo any residual camera roll so the player on foot
    // doesn't inherit a banked horizon.
    if (s.lastCamRoll !== 0) {
      _camRollQ.setFromAxisAngle(_axisZ, -s.lastCamRoll);
      ctx.three.camera.quaternion.multiply(_camRollQ);
      s.lastCamRoll = 0;
    }
    s.visualPitch = 0;
    s.visualRoll = 0;
    // QQ — demote any 'speeder'-tethered sled back to the player.
    transferTetherOnDismount(ctx);
    return;
  }

  // ── Steering — bike yaw lerps toward camera yaw. The player steers
  // by looking with the mouse; bike visually follows. This is much
  // smoother than torque-based input and never spins out.
  const cam = ctx.three.camera;
  cam.getWorldDirection(_forward);
  _forward.y = 0;
  if (_forward.lengthSq() < 1e-6) _forward.set(0, 0, -1);
  _forward.normalize();
  // Camera yaw: world direction (fx, fz) where bike's local -Z aligns
  // with this direction. -sin(yaw) = fx, -cos(yaw) = fz → yaw = atan2(-fx, -fz).
  const camYaw = Math.atan2(-_forward.x, -_forward.z);
  let yawErr = camYaw - s.yaw;
  // Wrap to [-π, π] so we always turn the short way around.
  if (yawErr > Math.PI) yawErr -= 2 * Math.PI;
  if (yawErr < -Math.PI) yawErr += 2 * Math.PI;
  let targetAngVel = yawErr * Tuning.SPEEDER_TURN_RESPONSE;
  if (targetAngVel > Tuning.SPEEDER_TURN_RATE_MAX) targetAngVel = Tuning.SPEEDER_TURN_RATE_MAX;
  if (targetAngVel < -Tuning.SPEEDER_TURN_RATE_MAX) targetAngVel = -Tuning.SPEEDER_TURN_RATE_MAX;
  // ACL SPEEDER ANGULAR DAMPING — small passive Y-axis damping on the
  // mounted body. Tuning.SPEEDER_ANGULAR_DAMP is 0 (body-level damping
  // disabled), and setEnabledRotations already locks X+Z, so a post-
  // collision yaw spin would otherwise persist until the steering lerp
  // alone bled it off. We bleed the residual yaw rate first, THEN let
  // steering lerp toward target — so the two compose: a free spin
  // settles, while steady steering (where current already tracks the
  // target) is effectively unaffected and never feels sluggish. Frame-
  // rate independent via exp(-rate*dt), mirroring the unmounted damp.
  const mountedAngDamp = Math.exp(-SPEEDER_MOUNTED_ANGULAR_DAMP_RATE_PER_S * dt);
  const currentAngVel = body.angvel().y * mountedAngDamp;
  const lerpedAngVel = currentAngVel + (targetAngVel - currentAngVel) * Tuning.SPEEDER_TURN_LERP;
  body.setAngvel({ x: 0, y: lerpedAngVel, z: 0 }, true);

  // ── Movement — velocity control toward a target XZ velocity computed
  // from W/S (forward/back along bike heading) and A/D (strafe lateral).
  // Lerp toward the target produces smooth accel + decel, no force
  // accumulation, no oscillation.
  const fwdInput = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  const strafeInput = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
  const boosting = !!(keys['ShiftLeft'] || keys['ShiftRight']);
  // Bike forward in world space (using bike's actual yaw, which is
  // lerping toward camera yaw — feels right because velocity tracks
  // the chassis, not the camera).
  const bfx = -Math.sin(s.yaw);
  const bfz = -Math.cos(s.yaw);
  // Bike right (perpendicular, 90° clockwise from forward in world XZ).
  const brx = -bfz;
  const brz = bfx;
  const fwdSpeedCap = (fwdInput > 0 && boosting) ? Tuning.SPEEDER_MAX_SPEED * Tuning.SPEEDER_BOOST_MULT : Tuning.SPEEDER_MAX_SPEED;
  const fwdSpeed = fwdInput > 0
    ? fwdInput * fwdSpeedCap
    : fwdInput * Tuning.SPEEDER_MAX_SPEED * Tuning.SPEEDER_REVERSE_MULT;
  const strSpeed = strafeInput * Tuning.SPEEDER_STRAFE_SPEED;
  const targetVx = bfx * fwdSpeed + brx * strSpeed;
  const targetVz = bfz * fwdSpeed + brz * strSpeed;
  const lerpedVx = lv.x + (targetVx - lv.x) * Tuning.SPEEDER_ACCEL_LERP;
  const lerpedVz = lv.z + (targetVz - lv.z) * Tuning.SPEEDER_ACCEL_LERP;
  body.setLinvel({ x: lerpedVx, y: newVy, z: lerpedVz }, true);

  // Note: Space-to-jump is handled by the jump-phase state machine
  // at the top of updateSpeeder (CC-2). No applyImpulse here.

  // Thrust audio — modulate pitch + noise with current horizontal speed.
  setSpeederThrustSpeed(s.speed, Tuning.SPEEDER_MAX_SPEED * Tuning.SPEEDER_BOOST_MULT);

  // ── Drive the camera while mounted. PointerLockControls keeps writing the
  // camera ROTATION (mouse-look), and the bike yaw lerps toward it — so the
  // camera always "faces forward" along where the player looks. We only set the
  // camera POSITION here.
  if (ctx.flags.thirdPerson) {
    // ACX FIX — 3P CHASE CAM: behind the rider, looking forward. Pre-ACX the
    // mounted camera always sat at the rider SEAT (a 1P position), so in 3P it
    // ended up at/ahead of the rig facing the wrong way. Now pull back along
    // the camera's own horizontal forward (`_forward`, computed above) from a
    // shoulder-height anchor over the bike, mirroring the on-foot 3P chase.
    const anchorY = pos.y + Tuning.SPEEDER_RIG_SEAT_Y + Tuning.SPEEDER_3P_CAM_ANCHOR_UP;
    const back = Tuning.SPEEDER_3P_CAM_BACK;
    ctx.three.camera.position.set(
      pos.x - _forward.x * back,
      anchorY + Tuning.SPEEDER_3P_CAM_ABOVE,
      pos.z - _forward.z * back,
    );
  } else {
    // FP — camera at the rider seat (bike-local offset rotated by yaw).
    _riderOffset.set(
      Tuning.SPEEDER_RIDER_SEAT_X,
      Tuning.SPEEDER_RIDER_SEAT_Y,
      Tuning.SPEEDER_RIDER_SEAT_Z,
    );
    const cos = Math.cos(s.yaw);
    const sin = Math.sin(s.yaw);
    const rx = _riderOffset.x * cos + _riderOffset.z * sin;
    const rz = -_riderOffset.x * sin + _riderOffset.z * cos;
    _ridePos.set(pos.x + rx, pos.y + _riderOffset.y, pos.z + rz);
    ctx.three.camera.position.set(_ridePos.x, _ridePos.y, _ridePos.z);
  }
  // CC-2.1 — apply camera roll in camera-local Z. PointerLockControls
  // does NOT reset camera.quaternion between mouse events, so naively
  // post-multiplying by the roll quaternion each frame accumulates
  // (12°/frame at 60fps = 720°/s spin). Fix: undo the previous frame's
  // roll first, then apply the new roll.
  const camRoll = s.visualRoll * Tuning.SPEEDER_CAM_ROLL_RATIO;
  _camRollQ.setFromAxisAngle(_axisZ, -s.lastCamRoll);
  ctx.three.camera.quaternion.multiply(_camRollQ);
  _camRollQ.setFromAxisAngle(_axisZ, camRoll);
  ctx.three.camera.quaternion.multiply(_camRollQ);
  s.lastCamRoll = camRoll;
  // Player body stays where it was at mount time; reset gravity so it
  // doesn't accumulate while parked.
  ctx.player.velocityY = 0;
  ctx.player.onGround = true;

  // Avoid unused warning if dt isn't used elsewhere (forces are dt-agnostic).
  void dt;
  void _bikeWorld;
}
