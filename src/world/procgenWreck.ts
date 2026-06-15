// Session ABA — procgen wreck composition system.
//
// Backlog: "procedural wreck-POI modelling system — composable
// vocabulary (hull segments + engine bells + breach patches + tail
// stubs + salvage panels) with per-seed assembly rules so 100s of
// wreck variations share a structural pattern".
//
// This is the FIRST CUT. Scope:
//   - Part vocabulary: cockpit (3 variants), hullSegment (3 variants),
//     engineModule (2 variants), tailStub (2 variants).
//   - Composable recipe type: ordered list of part-kind picks; the
//     assembler chooses a variant per-pick from the seeded RNG, builds
//     each, lays them out along the wreck's long axis, and welds
//     salvage panels where the recipe requested them.
//   - 2 sample wreck classes: 'corvette' (3-5 parts, 6-12m long) and
//     'freighter' (5-9 parts, 14-22m long).
//   - Integration: `placeProcgenComposite()` is wired into procgenPoi
//     for a SUBSET of procgen slots (composite share = ~35%, rest stay
//     hand-modeled engine_cluster / fuselage / escape_pod). Both
//     classes register as salvageables with kind 'fuselage' (matches
//     the silhouette: mostly hull). Future expansion: more part
//     variants, more wreck classes, biome-bias on recipe pick, replace
//     existing hand-modeled procgen kinds.
//
// Convention:
//   - Wreck's long axis is local +X. Parts are built in their own
//     local frames assuming their LONG axis runs along +X with their
//     anchor point at local X = 0 (the part extends from x=0 to
//     x=part.length). The assembler positions each part at a cursor
//     X that advances by part.length.
//   - Hull "radius" in part-local frame extends in the Y/Z plane.
//     Local +Y = up (when wreck is upright), +Z = side panel face.
//   - The wreck root is centered: after assembly, the group is shifted
//     -totalLength/2 in X so its center is at the wreck's anchor
//     position. The caller then sets group.position to the world spot
//     + applies terrain alignment + bury Y + yaw.
//
// Architecture rules followed:
//   - Magic numbers → Tuning.* OR locally-scoped const at top of this
//     module (system-internal not feel-tuning). Per D90, system
//     internals that the player can't feel stay in-module.
//   - addAccessPanel from wrecks.ts owns panels (inherits P2 hinge fix
//     + AAR/AAS/AAT pipeline + AAU recess uniformly).
//   - alignToTerrain from util/terrainAlign.ts seats each wreck on
//     the slope.

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { BiomeId } from './biomes.ts';
import type { SalvageableRegistry, Salvageable } from './salvage.ts';
import { registerSalvageable } from './salvage.ts';
import { validatePanels, findSurfaceMounts, type PanelEntry } from './panelPlacement.ts';
import { Tuning } from '../config/tuning.ts';
import { addAccessPanel, addAccessPanelOriented, makeEngineBellMesh } from './wrecks.ts';
import { mergeStaticByMaterial, makeSandMound, makeLoftedHull } from './wreckForms.ts';
import { createRustedHullMaterial } from './hullMaterial.ts';
import { attachCompoundCollider } from '../physics/bodies.ts';
import { alignToTerrain } from '../util/terrainAlign.ts';
import { placeJournal, type Journal } from './journal.ts';

// ── Local materials (procedural rust shader matches the hand-modeled
//    wrecks.ts palette so composites blend visually). ────────────────
const _hullMat = createRustedHullMaterial({
  baseColor: Tuning.WRECK_HULL_HEX,
  streakIntensity: 0.40,   // ACAT W5 — was the 0.55 default; lower so dark rust streaks stop swallowing the greeble/seam detail
  aoStrength: 0.24,        // ACAT W5 — was the 0.34 default; less underside crushing so the lower hull + flank greebles read
});
const _hullDarkMat = createRustedHullMaterial({
  baseColor: Tuning.WRECK_HULL_DARK_HEX,
  streakIntensity: 0.35,
});
const _rustMat = createRustedHullMaterial({
  baseColor: Tuning.WRECK_RUST_HEX,
  rustHex: 0x0e0603,
  streakIntensity: 0.45,
});
const _antennaMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_ANTENNA_HEX,
  flatShading: true,
});
const _nozzleInteriorMat = new THREE.MeshBasicMaterial({
  color: Tuning.WRECK_NOZZLE_INTERIOR_HEX,
});
const _nozzleRimMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_NOZZLE_RIM_HEX,
  flatShading: true,
});
const _windowMat = new THREE.MeshBasicMaterial({
  color: 0x0a0d10,             // dark broken cockpit glass
});

// ── Part type signatures ─────────────────────────────────────────────
//
// Every part builder returns a group whose +X axis points "downstream"
// (toward the tail of the wreck) and whose origin sits at the +X-most
// face of the previous part (or x=0 if this is the first part). The
// assembler positions the part at a cursor X and advances by
// `partLength`.
//
// `radius` is the visual half-height/depth of the part in the YZ plane
// (used for downstream parts to size their attach interfaces).
// `attachPanelHere` is optional — a part can offer a +Z surface
// position where a salvage panel can be welded; the recipe picks which
// part(s) get the wreck's salvage panels.

interface BuiltPart {
  mesh: THREE.Group;
  partLength: number;
  /** Approximate radius at the +X face (used for tail/hull-segment
   *  size matching). */
  radius: number;
  /** Where a salvage panel COULD sit on this part. World-y of the panel
   *  on the +Z flank, X is part-local (will be added to the part's
   *  assembly X position). Null if this part has no suitable surface. */
  panelAnchor: { x: number; y: number; z: number; faceYaw: number } | null;
}

type PartKind = 'cockpit' | 'hullSegment' | 'engineModule' | 'tailStub';

interface PartBuilder {
  build(rand: Rng, prevRadius: number): BuiltPart;
}

// ── Cockpit variants ─────────────────────────────────────────────────
//
// All cockpit parts have their NOSE at part-local x = partLength (the
// downstream-most face) and their hull-interface (back of cockpit) at
// x = 0. So the cockpit faces "forward" along +X… but wait, the
// convention says parts grow into +X. To keep the visual reading
// "nose forward", we instead make cockpit parts so that the NOSE is at
// x=0 (the assembler places the cockpit first, so x=0 is the wreck's
// nose end). Subsequent parts extend toward +X. The wreck's tail-most
// part has its tail-most face at x = totalLength.

const COCKPIT_VARIANTS: ReadonlyArray<PartBuilder> = [
  // Variant 1 — TAPERED NOSE. A tapered cylinder with a small cockpit
  // bubble inset on top. Reads as a sleek interceptor.
  {
    build(rand: Rng, prevRadius: number): BuiltPart {
      const g = new THREE.Group();
      const len = 1.4 + rand() * 0.6;
      const noseR = 0.35 + rand() * 0.15;        // small tip
      const baseR = Math.max(prevRadius * 0.85, 0.7 + rand() * 0.25);
      // Tapered nose body (cone-cylinder hybrid via CylinderGeometry).
      const nose = new THREE.Mesh(
        new THREE.CylinderGeometry(noseR, baseR, len, 12),
        _hullMat,
      );
      nose.rotation.z = Math.PI / 2;             // cylinder long axis along world X
      nose.position.x = len * 0.5;
      g.add(nose);
      // Cockpit bubble — a half-sphere on top of the nose, slightly
      // forward of center.
      const bubbleR = baseR * 0.45;
      const bubble = new THREE.Mesh(
        new THREE.SphereGeometry(bubbleR, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        _hullDarkMat,
      );
      bubble.position.set(len * 0.55, baseR * 0.55, 0);
      g.add(bubble);
      // Window strip inside the bubble (dark).
      const window = new THREE.Mesh(
        new THREE.BoxGeometry(bubbleR * 1.3, bubbleR * 0.4, 0.10),
        _windowMat,
      );
      window.position.set(len * 0.55, baseR * 0.55 + bubbleR * 0.5, bubbleR * 0.85);
      g.add(window);
      return {
        mesh: g,
        partLength: len,
        radius: baseR,
        panelAnchor: {
          x: len * 0.55,
          y: baseR * 0.15,
          z: baseR * 0.95,         // on the +Z flank, mid-height
          faceYaw: Math.PI / 2,    // panel faces world +Z when wreck is at yaw=0
        },
      };
    },
  },
  // Variant 2 — BLOCKY PILOT BUBBLE. A boxy cockpit module with a
  // rectangular forward window. Reads as a utility hauler.
  {
    build(rand: Rng, prevRadius: number): BuiltPart {
      const g = new THREE.Group();
      const len = 1.6 + rand() * 0.4;
      const baseR = Math.max(prevRadius * 0.92, 0.9 + rand() * 0.2);
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(len, baseR * 1.4, baseR * 1.7),
        _hullMat,
      );
      body.position.set(len * 0.5, baseR * 0.55, 0);
      g.add(body);
      // Big front window — a tilted box on the forward face.
      const winW = baseR * 1.4;
      const winH = baseR * 0.5;
      const window = new THREE.Mesh(
        new THREE.BoxGeometry(0.10, winH, winW),
        _windowMat,
      );
      window.position.set(0.06, baseR * 0.95, 0);
      window.rotation.z = -0.15;       // slight forward rake
      g.add(window);
      // Rust streak. AAN/CLAUDE.md rule 7 — 10cm depth, not paper-thin.
      const streak = new THREE.Mesh(
        new THREE.BoxGeometry(len * 0.7, baseR * 0.15, 0.10),
        _rustMat,
      );
      streak.position.set(len * 0.55, baseR * 0.30, baseR * 0.85 + 0.06);
      g.add(streak);
      return {
        mesh: g,
        partLength: len,
        radius: baseR,
        panelAnchor: {
          x: len * 0.7,
          y: baseR * 0.30,
          z: baseR * 0.85,
          faceYaw: Math.PI / 2,
        },
      };
    },
  },
  // Variant 3 — BULBOUS ESCAPE CAPSULE. An icosahedron with a hatch
  // and antenna stub. Reads as an emergency lifeboat.
  {
    build(rand: Rng, prevRadius: number): BuiltPart {
      const g = new THREE.Group();
      const r = 0.85 + rand() * 0.20;
      // Force interface radius to be small enough that the next part
      // can extend smoothly from the capsule's tail.
      const baseR = Math.max(prevRadius * 0.7, r * 0.85);
      const hull = new THREE.Mesh(
        new THREE.IcosahedronGeometry(r, 1),
        _hullMat,
      );
      hull.position.set(r, r * 0.55, 0);    // x-center is r so capsule extends 0..2r
      g.add(hull);
      // Open hatch on the +X (forward) face. CLAUDE.md rule 7 — 12cm.
      const hatch = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, r * 0.70, r * 0.55),
        _hullDarkMat,
      );
      hatch.position.set(0.06, r * 0.55, 0);
      hatch.rotation.y = -0.3;
      g.add(hatch);
      // Antenna stub up top.
      if (rand() < 0.85) {
        const stub = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.07, 1.2 + rand() * 0.5, 6),
          _antennaMat,
        );
        stub.position.set(r * 0.8, r * 1.6, 0);
        stub.rotation.z = (rand() - 0.5) * 0.4;
        g.add(stub);
      }
      return {
        mesh: g,
        partLength: 2 * r,
        radius: baseR,
        panelAnchor: {
          x: r * 1.1,
          y: r * 0.50,
          z: r * 0.95,
          faceYaw: Math.PI / 2,
        },
      };
    },
  },
];

// ── Breach-patch decoration helper ───────────────────────────────────
//
// Session ABC — adds 1-2 ragged dark patches on the +Z visible flank of a
// part suggesting impact / battle damage. Each patch is a real-depth box
// (≥10cm per CLAUDE.md rule 7) tilted at a slight random yaw so it doesn't
// read as a rectangular sticker. No collider impact (cosmetic only). Called
// from inside select hullSegment + cockpit variants to add per-seed visual
// variety without growing the variant count.
const _breachMat = _hullDarkMat;
function addBreachPatches(
  g: THREE.Group,
  partLength: number,
  radius: number,
  rand: Rng,
  count: number,
  side: number = 1,   // which flank (+1=+Z, -1=-Z) — clustered with greebles for impact asymmetry
): void {
  for (let i = 0; i < count; i++) {
    const w = 0.5 + rand() * 0.7;          // 0.5–1.2m wide
    const h = 0.3 + rand() * 0.5;          // 0.3–0.8m tall
    const d = 0.10 + rand() * 0.05;        // 10–15cm depth (rule 7)
    const patch = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      _breachMat,
    );
    // Position on the impact flank, biased to upper half (0.4–0.95 of radius for Y).
    const px = partLength * (0.15 + rand() * 0.7);
    const py = radius * (0.40 + rand() * 0.55);
    const pz = (radius * 0.92 + d * 0.5) * side;   // pull patch outward so it pokes through hull skin
    patch.position.set(px, py, pz);
    // Slight random rotation in all 3 axes so the patch reads "torn open"
    // rather than a perfectly-aligned rectangle.
    patch.rotation.set(
      (rand() - 0.5) * 0.35,
      (rand() - 0.5) * 0.45,
      (rand() - 0.5) * 0.30,
    );
    // ACY — tag so findPanelMount rejects a panel that would land on a proud
    // breach patch (the depth probe is the backstop if a tag is ever missed).
    patch.userData.isWreckDecoration = true;
    g.add(patch);
  }
}

// ── ACY — small hull greebles (panel-line seams, rivet strips, vent boxes)
// scattered on the flanks to break up bare hull. All ≥10cm deep (rule 7)
// and tagged isWreckDecoration so findPanelMount won't weld a panel on top.
function addHullGreebles(
  g: THREE.Group,
  partLength: number,
  radius: number,
  rand: Rng,
  count: number,
  impactSide: number = 0,   // 0 = random flanks; ±1 = bias greebles to that flank (impact asymmetry)
): void {
  for (let i = 0; i < count; i++) {
    // Impact asymmetry: when an impact side is given, ~78% of greebles cluster on
    // that flank so the side that took the hit reads busier/more torn (the other
    // flank stays cleaner — negative-space contrast).
    const zside = impactSide === 0
      ? (rand() < 0.5 ? 1 : -1)
      : (rand() < 0.78 ? impactSide : -impactSide);
    const px = partLength * (0.12 + rand() * 0.76);
    const py = radius * (0.30 + rand() * 0.62);
    const pz = radius * 0.93 * zside;
    const roll = rand();
    let node: THREE.Object3D;
    if (roll < 0.20) {
      // Panel-line seam strip (thin long box).
      node = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28 + rand() * 0.45, 0.10), _hullDarkMat);
    } else if (roll < 0.40) {
      // Rivet strip — a backing plate with a row of studs.
      const grp = new THREE.Group();
      const w = 0.4 + rand() * 0.35;
      grp.add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.10), _hullDarkMat));
      const n = 4 + Math.floor(rand() * 4);
      for (let k = 0; k < n; k++) {
        const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 6), _rustMat);
        rivet.rotation.x = Math.PI / 2;
        rivet.position.x = (n > 1 ? k / (n - 1) - 0.5 : 0) * w * 0.85;
        grp.add(rivet);
      }
      node = grp;
    } else if (roll < 0.58) {
      // Louvered vent — a dark recessed frame with angled horizontal slats
      // (intake/exhaust). Negative space: the dark gaps read as depth.
      const grp = new THREE.Group();
      const w = 0.30 + rand() * 0.24, hgt = 0.22 + rand() * 0.16;
      grp.add(new THREE.Mesh(new THREE.BoxGeometry(w, hgt, 0.10), _hullDarkMat));
      const slats = 3 + Math.floor(rand() * 2);
      for (let k = 0; k < slats; k++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.03, 0.12), _rustMat);
        slat.position.y = (slats > 1 ? k / (slats - 1) - 0.5 : 0) * hgt * 0.72;
        slat.position.z = 0.02;
        slat.rotation.x = 0.5;   // angled louver
        grp.add(slat);
      }
      node = grp;
    } else if (roll < 0.74) {
      // Circular port — a rim ring + a darker recessed inner disc (porthole/sensor).
      const grp = new THREE.Group();
      const rad = 0.12 + rand() * 0.09;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 0.12, 12), _rustMat);
      ring.rotation.x = Math.PI / 2;
      grp.add(ring);
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.66, rad * 0.66, 0.10, 12), _hullDarkMat);
      inner.rotation.x = Math.PI / 2; inner.position.z = -0.03;   // recessed center
      grp.add(inner);
      node = grp;
    } else if (roll < 0.88) {
      // Fin / strake — a thin blade jutting outward off the flank (heat fin /
      // stabiliser). One prominent fin beats uniform clutter.
      const finL = 0.28 + rand() * 0.30, finOut = 0.18 + rand() * 0.18;
      node = new THREE.Mesh(new THREE.BoxGeometry(finL, 0.05, finOut), _hullDarkMat);
      node.position.set(px, py, pz + finOut * 0.5 * zside);   // juts outward from the flank
      node.rotation.y = zside > 0 ? 0 : Math.PI;
      node.userData.isWreckDecoration = true;
      g.add(node);
      continue;   // custom outward offset handled above
    } else {
      // Antenna stub — a short whip on a small base box.
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.10), _hullDarkMat));
      const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.5 + rand() * 0.4, 6), _rustMat);
      whip.position.z = 0.28; whip.rotation.x = Math.PI / 2;
      grp.add(whip);
      node = grp;
    }
    node.position.set(px, py, pz);
    node.rotation.y = zside > 0 ? 0 : Math.PI;
    node.traverse((o) => { o.userData.isWreckDecoration = true; });
    g.add(node);
  }
}

// ── ACAP W4 — crash-debris fan ───────────────────────────────────────
// A few fragments (hull plates / pipes / struts) shed onto a random impact
// flank. Added to the wreck GROUP before the static-merge so they fold in
// (≈0 extra draw calls — the W1 perf goal). Placed at local-y = buryY so that
// AFTER the group sinks by buryY (half-burial, T4) the debris rests on the sand
// surface; the slight terrain-align tilt is inherited (fine — crash-site slope).
// All `isWreckDecoration` so findPanelMount avoids them + the merge folds them.
function addDebrisFan(
  g: THREE.Group, lenX: number, sizeZ: number, buryY: number, rand: Rng, side: number,
): void {
  const count = 2 + Math.floor(rand() * 3);   // 2-4 fragments
  const flank = sizeZ * 0.5;
  for (let i = 0; i < count; i++) {
    const px = (rand() - 0.5) * lenX * 1.15;                 // spread along the wreck length
    const pz = side * (flank + 0.5 + rand() * (flank * 0.9 + 0.5));  // just beyond the flank, outward
    const py = buryY + 0.04 + rand() * 0.05;                 // rests on the sand after the sink
    const roll = rand();
    let mesh: THREE.Mesh;
    if (roll < 0.45) {
      const w = 0.4 + rand() * 0.5, d = 0.3 + rand() * 0.4;
      mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.10, d), _hullMat);          // hull plate (rule 7 depth)
    } else if (roll < 0.78) {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4 + rand() * 0.5, 6), _rustMat);  // pipe
      mesh.rotation.z = Math.PI / 2;
    } else {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.6 + rand() * 0.4, 5), _hullDarkMat); // strut
      mesh.rotation.z = Math.PI / 2;
    }
    mesh.position.set(px, py, pz);
    mesh.rotation.y = rand() * Math.PI * 2;
    mesh.userData.isWreckDecoration = true;
    g.add(mesh);
  }
}

// ── Hull-segment variants ────────────────────────────────────────────

const HULL_SEGMENT_VARIANTS: ReadonlyArray<PartBuilder> = [
  // Variant 1 — RIBBED CYLINDER. A horizontal cylinder with 2-3 rust
  // bands (looks like a fuselage section with reinforcement rings).
  {
    build(rand: Rng, prevRadius: number): BuiltPart {
      const g = new THREE.Group();
      const len = 2.5 + rand() * 1.2;
      const r = Math.max(prevRadius * 0.95, 0.8 + rand() * 0.25);
      // ACAM T3 — faceted ship-hull section (flat keel + hard chines + flat dorsal
      // deck via makeLoftedHull) instead of a smooth pipe, so procgen hulls read like
      // the hero. Lofted along Z then rotated to the part's +X long axis; ~0.1m plate.
      const hull = makeLoftedHull(
        [{ z: 0, halfW: r, halfH: r }, { z: len, halfW: r, halfH: r }],
        _hullMat, 0.09,
      );
      hull.rotation.y = Math.PI / 2;
      hull.position.set(0, r * 0.55, 0);
      g.add(hull);
      // Reinforcement rings: 2 thin cylinders slightly larger radius.
      const ringCount = 2 + Math.floor(rand() * 2);
      for (let i = 0; i < ringCount; i++) {
        const t = (i + 0.5) / ringCount;       // 0.25..0.75 etc
        const ring = new THREE.Mesh(
          new THREE.CylinderGeometry(r * 1.04, r * 1.04, len * 0.06, 14),
          _rustMat,
        );
        ring.rotation.z = Math.PI / 2;
        ring.position.set(len * t, r * 0.55, 0);
        g.add(ring);
      }
      // ACAO T5 — real makeBreach holes were trialled here + REVERTED: makeBreach
      // does no boolean cut, so on a small intact procgen hull (~1m radius) the
      // recessed void is OCCLUDED by the skin in front of it (no hole reads) and
      // pushing it proud reads as a crusty bump, not a hole. Only the 136m hero
      // has the scale to sell it. Kept the flat dark battle-damage patch (reads
      // reliably at this scale); T5's value goes into the richer greeble
      // vocabulary + impact-flank asymmetry below. (decisions.md D197.)
      // ACAO T5 — impact-flank asymmetry: pick the side that "took the hit" and
      // cluster the battle-damage patch + most greebles there; the lee flank stays
      // cleaner (negative-space contrast).
      const impactSide = rand() < 0.5 ? 1 : -1;
      if (rand() < 0.7) addBreachPatches(g, len, r, rand, 1, impactSide);
      addHullGreebles(g, len, r, rand, 2 + Math.floor(rand() * 3), impactSide);   // ACAO richer vocab + asymmetry
      return {
        mesh: g,
        partLength: len,
        radius: r,
        panelAnchor: {
          x: len * 0.45,
          y: r * 0.55,
          z: r * 1.02,
          faceYaw: Math.PI / 2,
        },
      };
    },
  },
  // Variant 2 — PLATED RECTANGULAR. A boxy hull section with welded
  // plate decorations. Reads as a cargo or barracks compartment.
  {
    build(rand: Rng, prevRadius: number): BuiltPart {
      const g = new THREE.Group();
      const len = 2.2 + rand() * 1.0;
      const r = Math.max(prevRadius * 0.95, 0.9 + rand() * 0.20);
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(len, r * 1.5, r * 1.8),
        _hullMat,
      );
      body.position.set(len * 0.5, r * 0.6, 0);
      g.add(body);
      // 2-3 welded plates on the +Z face (10cm thickness — rule 7).
      const plateCount = 2 + Math.floor(rand() * 2);
      for (let i = 0; i < plateCount; i++) {
        const t = (i + 0.5) / plateCount;
        const plate = new THREE.Mesh(
          new THREE.BoxGeometry(len * 0.25, r * 0.4, 0.10),
          _rustMat,
        );
        plate.position.set(len * t, r * 0.7 + (rand() - 0.5) * r * 0.3, r * 0.9 + 0.06);
        plate.userData.isWreckDecoration = true;   // ACY — keep panels off welded plates
        g.add(plate);
      }
      // Session ABD — 40% → 60% (see ribbed-cyl rationale). Plated_rect
      // already supports 1-2 patches per call, so this pushes plate-and-
      // breach-bearing hulls to ~60% of plated hulls. ACAO — impact asymmetry.
      const impactSide = rand() < 0.5 ? 1 : -1;
      if (rand() < 0.6) addBreachPatches(g, len, r, rand, 1 + Math.floor(rand() * 2), impactSide);
      addHullGreebles(g, len, r, rand, 2 + Math.floor(rand() * 3), impactSide);   // ACAO richer vocab + asymmetry
      return {
        mesh: g,
        partLength: len,
        radius: r,
        panelAnchor: {
          x: len * 0.5,
          y: r * 0.40,
          z: r * 0.9,
          faceYaw: Math.PI / 2,
        },
      };
    },
  },
  // Variant 3 — PANELED TAPERED. A taper section that reduces hull
  // radius — useful between two segments of different sizes.
  {
    build(rand: Rng, prevRadius: number): BuiltPart {
      const g = new THREE.Group();
      const len = 1.8 + rand() * 0.8;
      const rStart = Math.max(prevRadius, 0.8);
      const rEnd = rStart * (0.7 + rand() * 0.2);
      // ACAM T3 — faceted tapered ship-hull section (hard chines) instead of a smooth
      // cone; lofted rStart→rEnd along Z then rotated to +X.
      const hull = makeLoftedHull(
        [{ z: 0, halfW: rStart, halfH: rStart }, { z: len, halfW: rEnd, halfH: rEnd }],
        _hullMat, 0.08,
      );
      hull.rotation.y = Math.PI / 2;
      hull.position.set(0, ((rStart + rEnd) / 2) * 0.55, 0);
      g.add(hull);
      // One large rusted plate on top
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(len * 0.7, 0.10, rEnd * 1.4),
        _rustMat,
      );
      plate.position.set(len * 0.5, ((rStart + rEnd) / 2) * 1.05, 0);
      g.add(plate);
      return {
        mesh: g,
        partLength: len,
        radius: rEnd,
        panelAnchor: null,                  // taper looks too narrow for a panel
      };
    },
  },
  // Variant 4 — OPEN TRUSS. Session ABC. Exposed structural frame with
  // no skin — 4 longitudinal struts at the corners + 3 transverse rings.
  // Reads as a gutted hull section, the kind of thing that has been
  // stripped of panels by previous scavengers. No panel anchor (no skin
  // to weld one to); panel-bearing parts elsewhere on the wreck still
  // host loot.
  {
    build(rand: Rng, prevRadius: number): BuiltPart {
      const g = new THREE.Group();
      const len = 2.4 + rand() * 1.0;
      const r = Math.max(prevRadius * 0.95, 0.85 + rand() * 0.15);
      const strutR = 0.10;                 // 10cm structural strut radius
      // 4 longitudinal struts at the corners of a square frame (in YZ).
      // Y offset shifts the frame up so the bottom struts clear y=0
      // (matches the cylinder-hull convention of body center at y = r*0.55).
      const cy = r * 0.55;
      for (const [sy, sz] of [
        [+r * 0.55, +r * 0.85],
        [+r * 0.55, -r * 0.85],
        [-r * 0.55, +r * 0.85],
        [-r * 0.55, -r * 0.85],
      ] as const) {
        const strut = new THREE.Mesh(
          new THREE.CylinderGeometry(strutR, strutR, len, 6),
          _hullDarkMat,
        );
        strut.rotation.z = Math.PI / 2;
        strut.position.set(len * 0.5, cy + sy, sz);
        g.add(strut);
      }
      // 3 transverse rings (square frames in YZ at evenly-spaced X positions).
      const ringCount = 3;
      for (let i = 0; i < ringCount; i++) {
        const t = (i + 0.5) / ringCount;
        const rx = len * t;
        // Build the ring from 4 short cross-beams; torus would round-feel
        // wrong for a square truss frame.
        for (const [a, b, axis] of [
          [[+r * 0.55, +r * 0.85], [+r * 0.55, -r * 0.85], 'z'] as const,
          [[-r * 0.55, +r * 0.85], [-r * 0.55, -r * 0.85], 'z'] as const,
          [[+r * 0.55, +r * 0.85], [-r * 0.55, +r * 0.85], 'y'] as const,
          [[+r * 0.55, -r * 0.85], [-r * 0.55, -r * 0.85], 'y'] as const,
        ]) {
          const beamLen = axis === 'z' ? Math.abs(a[1] - b[1]) : Math.abs(a[0] - b[0]);
          const beam = new THREE.Mesh(
            new THREE.CylinderGeometry(strutR * 0.7, strutR * 0.7, beamLen, 6),
            _hullDarkMat,
          );
          if (axis === 'z') {
            // Beam runs along Z direction; cylinder long axis defaults to Y,
            // so rotate it by π/2 around X.
            beam.rotation.x = Math.PI / 2;
            beam.position.set(rx, cy + a[0], (a[1] + b[1]) / 2);
          } else {
            // Beam runs along Y direction; cylinder already long-axis Y.
            beam.position.set(rx, cy + (a[0] + b[0]) / 2, a[1]);
          }
          g.add(beam);
        }
      }
      // One diagonal cross-brace across the +Z visible face for character.
      const diagLen = Math.hypot(len, r * 1.1);
      const diag = new THREE.Mesh(
        new THREE.CylinderGeometry(strutR * 0.55, strutR * 0.55, diagLen, 6),
        _rustMat,
      );
      diag.position.set(len * 0.5, cy, r * 0.85);
      diag.rotation.x = Math.PI / 2;
      diag.rotation.y = Math.atan2(r * 1.1, len);
      g.add(diag);
      return {
        mesh: g,
        partLength: len,
        radius: r,
        panelAnchor: null,                  // no skin = no panel weld site
      };
    },
  },
  // Variant 5 — FUEL BARRELS. Session ABC. A cluster of 2-3 large
  // cylindrical tanks strapped on top of a low base, suggesting external
  // fuel/water/cryo storage. Each tank has a rim torus + one has an
  // open dark hatch (already-scavenged tank). Tank sides offer a flat
  // panel anchor.
  {
    build(rand: Rng, prevRadius: number): BuiltPart {
      const g = new THREE.Group();
      const len = 2.6 + rand() * 1.0;
      const r = Math.max(prevRadius * 0.95, 0.95 + rand() * 0.15);
      // Low base plate carrying the tanks.
      const baseW = len;
      const baseH = r * 0.30;
      const baseD = r * 1.6;
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(baseW, baseH, baseD),
        _hullMat,
      );
      base.position.set(len * 0.5, baseH * 0.5, 0);
      g.add(base);
      // 2-3 tanks along +X.
      const tankCount = 2 + Math.floor(rand() * 2);
      const tankR = r * 0.42;
      const tankH = r * 1.20;
      const tankSpacing = (len - tankR * 2 * tankCount) / (tankCount + 1) + tankR * 2;
      let opened = false;                     // ensure exactly one open hatch
      for (let i = 0; i < tankCount; i++) {
        const tx = tankR + (i + 0.5) * tankSpacing - tankR;
        // Tank body — vertical cylinder.
        const tank = new THREE.Mesh(
          new THREE.CylinderGeometry(tankR, tankR, tankH, 12),
          _hullMat,
        );
        tank.position.set(tx, baseH + tankH * 0.5, 0);
        g.add(tank);
        // Rim torus at top for "tank cap" detail.
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(tankR * 0.95, 0.08, 4, 14),
          _rustMat,
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.set(tx, baseH + tankH + 0.04, 0);
        g.add(rim);
        // Open hatch on top of one tank (already scavenged).
        if (!opened && (i === tankCount - 1 || rand() < 0.5)) {
          opened = true;
          const hatch = new THREE.Mesh(
            new THREE.CylinderGeometry(tankR * 0.6, tankR * 0.6, 0.12, 10),
            _hullDarkMat,
          );
          hatch.position.set(tx, baseH + tankH + 0.06, 0);
          g.add(hatch);
        }
      }
      return {
        mesh: g,
        partLength: len,
        radius: r,
        panelAnchor: {
          // Anchor on the base side panel (+Z face of base plate), between tanks.
          x: len * 0.5,
          y: baseH * 0.5,
          z: baseD * 0.5,
          faceYaw: Math.PI / 2,
        },
      };
    },
  },
  // Variant 6 — BRISTLE ANTENNA. Session ACE. A hull cylinder bristling
  // with 3-5 sensor antennas + 1-2 comms dish stubs. Reads as a
  // surveillance / sensor module from a scout or science vessel. Antennas
  // are thin metal rods with small bulb tips; dish stubs are short
  // mounting posts with shallow parabolic discs. Adds variety beyond
  // the smooth + cargo + open + tank silhouettes.
  {
    build(rand: Rng, prevRadius: number): BuiltPart {
      const g = new THREE.Group();
      const len = 2.4 + rand() * 1.0;
      const r = Math.max(prevRadius * 0.95, 0.85 + rand() * 0.22);
      // Main hull cylinder — slightly thicker than the ribbed variant
      // to compensate for the protruding antennas (silhouette stays
      // chunky despite the bristly profile).
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, len, 14),
        _hullMat,
      );
      tube.rotation.z = Math.PI / 2;
      tube.position.set(len * 0.5, r * 0.55, 0);
      g.add(tube);
      // 3-5 antennas distributed along the length, alternating sides.
      const antennaCount = 3 + Math.floor(rand() * 3);
      for (let i = 0; i < antennaCount; i++) {
        const t = (i + 0.5) / antennaCount;
        const antennaX = len * t;
        const tilt = (rand() - 0.5) * 0.3;          // ±0.15 rad sway
        const lenAnt = 0.7 + rand() * 0.6;          // 0.7-1.3m tall
        // Mast — thin cylinder. Rust material for weathering contrast.
        const mast = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.030, lenAnt, 6),
          _rustMat,
        );
        // Alternate sides: even i = top (+Y), odd i = +Z side
        const topSide = i % 2 === 0;
        if (topSide) {
          mast.position.set(antennaX, r * 0.55 + r + lenAnt * 0.5, 0);
          mast.rotation.z = tilt;
        } else {
          mast.position.set(antennaX, r * 0.55 + r * 0.3, r + lenAnt * 0.5);
          mast.rotation.x = -Math.PI / 2 + tilt;
        }
        g.add(mast);
        // Bulb tip at end of antenna — small sphere for the "sensor".
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.045, 6, 5),
          _hullDarkMat,
        );
        if (topSide) {
          bulb.position.set(antennaX, r * 0.55 + r + lenAnt, 0);
        } else {
          bulb.position.set(antennaX, r * 0.55 + r * 0.3, r + lenAnt);
        }
        g.add(bulb);
        // Crossbar near mid-mast for some antennas (signal-array look)
        if (rand() < 0.5) {
          const bar = new THREE.Mesh(
            new THREE.BoxGeometry(0.012, 0.40, 0.012),
            _rustMat,
          );
          if (topSide) {
            bar.position.set(antennaX, r * 0.55 + r + lenAnt * 0.6, 0);
            bar.rotation.x = Math.PI / 2;
          } else {
            bar.position.set(antennaX, r * 0.55 + r * 0.3, r + lenAnt * 0.6);
            bar.rotation.y = Math.PI / 2;
          }
          g.add(bar);
        }
      }
      // 1-2 dish stubs — short mast + shallow disc. Mounted on the -Z
      // side so they don't overlap the panel-anchor +Z face.
      const dishCount = 1 + Math.floor(rand() * 2);
      for (let i = 0; i < dishCount; i++) {
        const t = (i + 0.5) / dishCount;
        const dishX = len * (0.2 + t * 0.6);
        // Mounting post
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.05, 0.30, 8),
          _hullMat,
        );
        post.position.set(dishX, r * 0.55 + r * 0.3, -r - 0.15);
        post.rotation.x = -Math.PI / 2;
        g.add(post);
        // Shallow parabolic disc — open cylinder with one closed end.
        const dishR = 0.22 + rand() * 0.08;
        const dish = new THREE.Mesh(
          new THREE.CylinderGeometry(dishR, dishR * 0.6, 0.12, 10, 1, true),
          _rustMat,
        );
        dish.position.set(dishX, r * 0.55 + r * 0.3, -r - 0.30 - 0.06);
        dish.rotation.x = -Math.PI / 2;
        g.add(dish);
      }
      // Breach patches less common on this variant (the antennas + dishes
      // already provide visual interest).
      if (rand() < 0.35) addBreachPatches(g, len, r, rand, 1);
      return {
        mesh: g,
        partLength: len,
        radius: r,
        panelAnchor: {
          x: len * 0.45,
          y: r * 0.55,
          z: r * 1.02,
          faceYaw: Math.PI / 2,
        },
      };
    },
  },
];

// ── Engine module variants ───────────────────────────────────────────

const ENGINE_MODULE_VARIANTS: ReadonlyArray<PartBuilder> = [
  // Variant 1 — SINGLE BELL. One big engine bell oriented along +X.
  {
    build(rand: Rng, prevRadius: number): BuiltPart {
      const g = new THREE.Group();
      const r = Math.max(prevRadius * 1.0, 0.9 + rand() * 0.20);
      const depth = r * 1.4;
      // Bell mouth opens +X (toward the wreck's tail end). makeEngineBellMesh
      // creates the bell with its mouth at local +Y, so we rotate the bell
      // -π/2 around Z to make the +Y direction become +X.
      const bell = makeEngineBellMesh(r * 1.05, depth, _hullMat, _nozzleInteriorMat);
      bell.rotation.z = -Math.PI / 2;
      bell.position.set(0, r * 0.55, 0);   // bell extends 0..depth in local X
      g.add(bell);
      return {
        mesh: g,
        partLength: depth,
        radius: r,
        panelAnchor: null,                  // bell exterior is too curved for a flat panel
      };
    },
  },
  // Variant 2 — TWIN BELL. Two smaller bells side-by-side.
  {
    build(rand: Rng, prevRadius: number): BuiltPart {
      const g = new THREE.Group();
      const r = Math.max(prevRadius * 1.0, 0.85 + rand() * 0.15);
      const depth = r * 1.2;
      const bellR = r * 0.55;
      for (const side of [-1, 1] as const) {
        const bell = makeEngineBellMesh(bellR, depth, _hullMat, _nozzleInteriorMat);
        bell.rotation.z = -Math.PI / 2;
        bell.position.set(0, r * 0.55, side * bellR * 0.95);
        g.add(bell);
      }
      // Central rim plate so the twin bells don't read as floating
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(depth * 0.5, bellR * 0.9, 0.12),
        _nozzleRimMat,
      );
      plate.position.set(depth * 0.5, r * 0.55, 0);
      plate.rotation.y = Math.PI / 2;
      g.add(plate);
      return {
        mesh: g,
        partLength: depth,
        radius: r,
        panelAnchor: null,
      };
    },
  },
];

// ── Tail stub variants ───────────────────────────────────────────────

const TAIL_STUB_VARIANTS: ReadonlyArray<PartBuilder> = [
  // Variant 1 — TORN RAGGED. A short cylinder with a half-rusted ring
  // suggesting the hull broke off.
  {
    build(rand: Rng, prevRadius: number): BuiltPart {
      const g = new THREE.Group();
      const len = 0.5 + rand() * 0.4;
      const r = Math.max(prevRadius * 0.92, 0.7);
      const stub = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.95, r * 1.05, len, 14),
        _hullDarkMat,
      );
      stub.rotation.z = Math.PI / 2;
      stub.position.set(len * 0.5, r * 0.55, 0);
      g.add(stub);
      // 3-4 torn fragments around the +X rim
      const fragCount = 3 + Math.floor(rand() * 2);
      for (let i = 0; i < fragCount; i++) {
        const a = (i / fragCount) * Math.PI * 2 + rand() * 0.3;
        const frag = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.10, r * 0.45),
          _rustMat,
        );
        frag.position.set(
          len + 0.08,
          r * 0.55 + Math.sin(a) * r * 0.85,
          Math.cos(a) * r * 0.85,
        );
        frag.rotation.set((rand() - 0.5) * 0.5, (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.4);
        g.add(frag);
      }
      return {
        mesh: g,
        partLength: len,
        radius: r,
        panelAnchor: null,
      };
    },
  },
  // Variant 2 — SEALED CAP. A flat closed cap; reads as a half-buried
  // sealed compartment.
  {
    build(rand: Rng, prevRadius: number): BuiltPart {
      const g = new THREE.Group();
      const len = 0.30 + rand() * 0.20;
      const r = Math.max(prevRadius * 0.95, 0.75);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, len, 14),
        _hullDarkMat,
      );
      cap.rotation.z = Math.PI / 2;
      cap.position.set(len * 0.5, r * 0.55, 0);
      g.add(cap);
      // Sealed-cover ring on the +X face — torus stops the cap reading
      // as a paper-thin disc.
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r * 0.85, 0.07, 4, 14),
        _rustMat,
      );
      ring.position.set(len + 0.04, r * 0.55, 0);
      ring.rotation.y = Math.PI / 2;
      g.add(ring);
      return {
        mesh: g,
        partLength: len,
        radius: r,
        panelAnchor: null,
      };
    },
  },
];

// ── Variant pool dispatch ────────────────────────────────────────────

function pickVariant(rand: Rng, pool: ReadonlyArray<PartBuilder>): PartBuilder {
  return pool[Math.floor(rand() * pool.length)];
}

/** Session ABJ — biased variant pick. `weights[i]` is the relative weight
 *  for `pool[i]` (default 1.0). Used by hullSegment picks to bias per-biome
 *  toward thematic variants (salt → corrosion-resistant plates, rocky →
 *  open trusses, dune → fuel barrels). Weights are multiplicative on a
 *  uniform baseline, so passing `[1, 1.3, 1, 1, 1]` makes index 1 about
 *  30% more likely vs uniform. */
function pickVariantBiased(
  rand: Rng,
  pool: ReadonlyArray<PartBuilder>,
  weights: ReadonlyArray<number>,
): PartBuilder {
  let total = 0;
  for (let i = 0; i < pool.length; i++) total += weights[i] ?? 1.0;
  let r = rand() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i] ?? 1.0;
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];   // numerical-precision fallback
}

/** Session ABJ + ACE — biome-specific hullSegment weights (indices:
 *  0=RIBBED_CYLINDER, 1=PLATED_RECTANGULAR, 2=PANELED_TAPERED,
 *  3=OPEN_TRUSS, 4=FUEL_BARRELS, 5=BRISTLE_ANTENNA — added ACE).
 *  Salt: +30% PLATED (corrosion-resistant plates fit salt-flat lore).
 *  Rocky: +20% OPEN_TRUSS (mining-mod / skeletal frame feel).
 *  Dune: +20% FUEL_BARRELS (caravan tanker silhouette in the dunes).
 *  BRISTLE_ANTENNA: no biome bias — appears uniformly across all biomes
 *  as a "scout / science vessel" silhouette wherever wrecks crash. */
const HULL_SEGMENT_BIOME_WEIGHTS: Record<BiomeId, ReadonlyArray<number>> = {
  salt:  [1.0, 1.3, 1.0, 1.0, 1.0, 1.0],
  rocky: [1.0, 1.0, 1.0, 1.2, 1.0, 1.0],
  dune:  [1.0, 1.0, 1.0, 1.0, 1.2, 1.0],
  // Cycle 8 — wreck-yard graveyard: ancient corroded + stripped-to-frame hulks
  // (PLATED corrosion + OPEN_TRUSS skeletal both boosted).
  wreck_yard: [1.0, 1.3, 1.0, 1.3, 1.0, 1.0],
};

function pickPart(rand: Rng, kind: PartKind, biome?: BiomeId): PartBuilder {
  switch (kind) {
    case 'cockpit':       return pickVariant(rand, COCKPIT_VARIANTS);
    case 'hullSegment': {
      if (biome) {
        return pickVariantBiased(rand, HULL_SEGMENT_VARIANTS, HULL_SEGMENT_BIOME_WEIGHTS[biome]);
      }
      return pickVariant(rand, HULL_SEGMENT_VARIANTS);
    }
    case 'engineModule':  return pickVariant(rand, ENGINE_MODULE_VARIANTS);
    case 'tailStub':      return pickVariant(rand, TAIL_STUB_VARIANTS);
  }
}

// ── Wreck classes (recipes) ──────────────────────────────────────────

export type ProcgenWreckClass = 'corvette' | 'freighter' | 'gunship' | 'science_vessel' | 'bulk_hauler' | 'orbital_pod_cluster' | 'flagship_engineBlock';

interface WreckRecipe {
  /** Ordered part kinds. Cockpit goes first (nose end at x=0), tail
   *  stub last. */
  parts: ReadonlyArray<PartKind>;
  /** Min/max count of salvage panels welded onto the wreck. Capped by
   *  how many parts had a panelAnchor in their builder output. */
  panelCountMin: number;
  panelCountMax: number;
}

function recipeFor(rand: Rng, cls: ProcgenWreckClass): WreckRecipe {
  if (cls === 'corvette') {
    // 1 cockpit + 1-2 hull + 0-1 engine + 1 tail = 3-5 parts, 6-12m
    const hullCount = 1 + Math.floor(rand() * 2);     // 1-2
    const hasEngine = rand() < 0.7;
    const parts: PartKind[] = ['cockpit'];
    for (let i = 0; i < hullCount; i++) parts.push('hullSegment');
    if (hasEngine) parts.push('engineModule');
    parts.push('tailStub');
    return { parts, panelCountMin: 1, panelCountMax: 2 };
  }
  if (cls === 'gunship') {
    // Session ABC. 1 cockpit + 1-2 hull + 1-2 engine + 1 tail = 4-6 parts,
    // 8-14m. Sits between corvette and freighter in scale; distinguished
    // by GUARANTEED engine cluster (corvette has 70% engine, gunship has
    // 100% + can stack 2) — reads as a small, engine-heavy fighter.
    const hullCount = 1 + Math.floor(rand() * 2);     // 1-2
    const engineCount = 1 + Math.floor(rand() * 2);   // 1-2
    const parts: PartKind[] = ['cockpit'];
    for (let i = 0; i < hullCount; i++) parts.push('hullSegment');
    for (let i = 0; i < engineCount; i++) parts.push('engineModule');
    parts.push('tailStub');
    return { parts, panelCountMin: 1, panelCountMax: 2 };
  }
  if (cls === 'science_vessel') {
    // Session ABJ — B6. 1 cockpit + 2-3 hull + 1 engine + 1 tail =
    // 5-7 parts, ~10-16m. Sits between corvette and freighter; longer
    // body than corvette but lighter on engines than gunship. Reads as
    // a research/scientific frame (long observation hull, modest
    // propulsion). 2-3 panels for the higher loot density.
    const hullCount = 2 + Math.floor(rand() * 2);     // 2-3
    const parts: PartKind[] = ['cockpit'];
    for (let i = 0; i < hullCount; i++) parts.push('hullSegment');
    parts.push('engineModule');
    parts.push('tailStub');
    return { parts, panelCountMin: 2, panelCountMax: 3 };
  }
  if (cls === 'flagship_engineBlock') {
    // ABO B6 — POC migration of engineBlock flagship into the composite
    // system. Fixed recipe: 1 cockpit + 2 hullSegment + 1 engineModule
    // (twin-bell pref) + 1 tailStub = 5 parts, ~9-13m. Closer to a
    // "tipped engine cluster" silhouette than any of the random classes.
    // 3 panels for the rich-loot engine_cluster palette.
    const parts: PartKind[] = ['cockpit', 'hullSegment', 'hullSegment', 'engineModule', 'tailStub'];
    return { parts, panelCountMin: 3, panelCountMax: 3 };
  }
  if (cls === 'orbital_pod_cluster') {
    // Session ACE — 6th class. Crashed cluster of escape pods + scattered
    // hull debris. Different silhouette than the linear "fuselage" classes:
    // 1 cockpit (acting as the lead pod) + 1-2 hullSegment (the pod
    // cluster body) + NO engine + 1 tail = 3-4 parts, shorter overall
    // (~6-10m). Reads as "rescue pods crashed together" rather than a
    // single hull. 2 panels for medical-leaning escape_pod loot palette.
    const hullCount = 1 + Math.floor(rand() * 2);     // 1-2
    const parts: PartKind[] = ['cockpit'];
    for (let i = 0; i < hullCount; i++) parts.push('hullSegment');
    parts.push('tailStub');
    return { parts, panelCountMin: 2, panelCountMax: 2 };
  }
  if (cls === 'bulk_hauler') {
    // Session ABN — B6 (5th class). 1 cockpit + 4-5 hull + 1 engine +
    // 1 tail = 7-8 parts, ~14-21m. Longest silhouette in the procgen
    // pool — reads as a freight train / cargo hauler with extra hull
    // segments where freighter would have engines. Cargo-heavy flavor
    // comes from the high hullSegment count + biome bias (salt→PLATED
    // corrosion-resistant plates, dune→FUEL_BARRELS tanker tanks) +
    // 'cargo_container' salvage palette (lottery loot mix). 3-4 panels
    // for the richest loot density of any procgen wreck class.
    const hullCount = 4 + Math.floor(rand() * 2);     // 4-5
    const parts: PartKind[] = ['cockpit'];
    for (let i = 0; i < hullCount; i++) parts.push('hullSegment');
    parts.push('engineModule');
    parts.push('tailStub');
    return { parts, panelCountMin: 3, panelCountMax: 4 };
  }
  // freighter
  const hullCount = 3 + Math.floor(rand() * 3);       // 3-5
  const engineCount = 1 + Math.floor(rand() * 2);     // 1-2
  const parts: PartKind[] = ['cockpit'];
  for (let i = 0; i < hullCount; i++) parts.push('hullSegment');
  for (let i = 0; i < engineCount; i++) parts.push('engineModule');
  parts.push('tailStub');
  return { parts, panelCountMin: 2, panelCountMax: 3 };
}

// ── Assembler ────────────────────────────────────────────────────────

interface AssembleResult {
  group: THREE.Group;
  totalLength: number;
}

// ACAV Tier 2 — the per-part panel sampler `findPanelMount` (ACY: a jittered grid
// of rays against the ±Z bounding-box flanks + cardinal-yaw snap) was replaced by
// the shape-agnostic `findSurfaceMounts` in world/panelPlacement.ts (bounding-
// sphere inward rays read the REAL hull surface — any shape — + a full quaternion
// so the panel sits flush). The old SALVAGE_PANEL_SAMPLE_GRID_*/FACE_INSET tuning
// is retired with it.

function assembleWreck(
  rand: Rng,
  recipe: WreckRecipe,
  cls: ProcgenWreckClass,
  biome?: BiomeId,
): AssembleResult {
  const root = new THREE.Group();

  // Build each part sequentially; collect part metadata for panel
  // placement after the layout is finalized.
  interface PlacedPart {
    built: BuiltPart;
    startX: number;
  }
  const placed: PlacedPart[] = [];
  let cursor = 0;
  let prevRadius = 0.9;                  // seed for the first part's interface
  for (const kind of recipe.parts) {
    const builder = pickPart(rand, kind, biome);
    const built = builder.build(rand, prevRadius);
    built.mesh.position.x = cursor;
    root.add(built.mesh);
    placed.push({ built, startX: cursor });
    cursor += built.partLength;
    prevRadius = built.radius;
  }
  const totalLength = cursor;

  // Center the wreck on its position by shifting all parts -totalLength/2.
  root.position.x = 0;
  for (const child of root.children) child.position.x -= totalLength / 2;

  // ── Salvage panels — pick from parts that offered a panelAnchor.
  const panelEligible = placed.filter((p) => p.built.panelAnchor !== null);
  const wantPanels = Math.min(
    panelEligible.length,
    recipe.panelCountMin + Math.floor(rand() * (recipe.panelCountMax - recipe.panelCountMin + 1)),
  );
  // Shuffle indices and take the first `wantPanels`.
  const indices = panelEligible.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  // Pick panel kind by wreck class — freighters get more bandages
  // (medical bay flavor), corvettes get more engine kit. ABO B6 — the
  // flagship_engineBlock POC class registers all panels as engine_cluster
  // so the engineBlock palette flavor is preserved post-migration.
  const panelKindPool = cls === 'flagship_engineBlock'
    ? ['engine_cluster'] as const
    : cls === 'corvette'
    ? ['fuselage', 'engine_cluster'] as const
    : ['fuselage', 'cargo_container'] as const;
  // Track panels already placed per part so the sampler can avoid overlap.
  const placedOnPart = new Map<THREE.Group, Array<{ x: number; y: number; z: number }>>();
  for (let i = 0; i < wantPanels; i++) {
    const slot = panelEligible[indices[i]];
    const partMesh = slot.built.mesh;
    // ACAV Tier 2 — roll SIZE first so the shape-agnostic sampler tests the panel's
    // REAL footprint (the old order tested base size, then built at up to 1.32×).
    const sr = rand();
    const scale = sr < Tuning.SALVAGE_PANEL_SCALE_SMALL_THRESHOLD ? Tuning.SALVAGE_PANEL_SCALE_SMALL
      : sr >= Tuning.SALVAGE_PANEL_SCALE_LARGE_THRESHOLD ? Tuning.SALVAGE_PANEL_SCALE_LARGE
      : 1;
    const panelKind = panelKindPool[Math.floor(rand() * panelKindPool.length)];
    const prior = placedOnPart.get(partMesh) ?? [];
    const halfX = Tuning.SALVAGE_PANEL_SIZE_X * scale * 0.5;
    const halfY = Tuning.SALVAGE_PANEL_SIZE_Y * scale * 0.5;
    // findSurfaceMounts reads the REAL hull surface (any shape) + a full quaternion
    // so the panel sits flush; it consumes exactly ONE rand (fixed budget, D208).
    // On a miss, fall back to the authored per-part anchor (yaw-based).
    const cand = findSurfaceMounts(partMesh, rand, prior, halfX, halfY);
    if (cand) {
      addAccessPanelOriented(partMesh, cand.localPos, cand.localQuat, scale, panelKind);
      prior.push({ x: cand.localPos.x, y: cand.localPos.y, z: cand.localPos.z });
    } else {
      const a = slot.built.panelAnchor;
      if (a) {
        addAccessPanel(partMesh, a.x, a.y, a.z, scale, a.faceYaw, panelKind);
        prior.push({ x: a.x, y: a.y, z: a.z });
      }
    }
    placedOnPart.set(partMesh, prior);
  }

  return { group: root, totalLength };
}

// ── Public entry ─────────────────────────────────────────────────────

interface PlaceProcgenOpts {
  /** Override the wreck class — else random per call. */
  cls?: ProcgenWreckClass;
  /** Bury offset (subtracted from terrain y). Default 0.4. */
  buryY?: number;
  /** ABJ — biome at the placement position. When set, the hullSegment
   *  variant pick is biased per `HULL_SEGMENT_BIOME_WEIGHTS` so different
   *  biomes ship visually distinct procgen wrecks (corrosion-resistant
   *  plates in salt, skeletal trusses in rocky, fuel barrels in dune). */
  biome?: BiomeId;
  /** ACAS A1 — re-parent the wreck group + its sand mound into this object
   *  instead of the scene (default: scene). Lets a dense field (the wreck-yard)
   *  collect everything under one group for a cluster-level static merge. */
  parent?: THREE.Object3D;
}

/** Place a procgen composite wreck at the given world position.
 *  Picks a class (corvette/freighter), generates a recipe, assembles
 *  parts, applies terrain alignment, attaches colliders, registers
 *  ONE Salvageable (the wreck root — registerSalvageable reads
 *  `group.userData.accessPanel` which addAccessPanel set for the
 *  first panel added). Returns the placed group.
 *
 *  Note: multi-panel wrecks register only the LAST `userData.accessPanel`
 *  (overwritten each addAccessPanel call on the same parent). To get
 *  proper multi-panel registration, we register each panel-bearing
 *  part separately via a traversal after assembly. */
export function placeProcgenComposite(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  pos: THREE.Vector3,
  rand: Rng,
  salvageables: SalvageableRegistry | undefined,
  opts: PlaceProcgenOpts = {},
): THREE.Group {
  // Session ABN — class roulette is now 5-way: 35% corvette, 20% gunship,
  // 18% freighter, 12% science_vessel, 15% bulk_hauler. Still skews
  // toward small silhouettes (cheaper per-mesh) but distributes ~15% to
  // the new bulk_hauler (longest hull, richest loot). Pre-ABN split was
  // 40/25/20/15 (ABJ); pre-ABJ was 45/30/25 (ABC).
  // Session ACE — 6-way roulette: 30% corvette, 18% gunship, 16% freighter,
  // 11% science_vessel, 13% bulk_hauler, 12% orbital_pod_cluster. The new
  // pod-cluster variant offers a distinct silhouette (rescue pods clumped
  // together) at modest frequency.
  const cls: ProcgenWreckClass = opts.cls ?? (() => {
    const r = rand();
    if (r < 0.30) return 'corvette';
    if (r < 0.48) return 'gunship';
    if (r < 0.64) return 'freighter';
    if (r < 0.75) return 'science_vessel';
    if (r < 0.88) return 'bulk_hauler';
    return 'orbital_pod_cluster';
  })();
  const recipe = recipeFor(rand, cls);
  // Session ABJ — B4: query biome at the wreck position and thread to
  // assembler. assembleWreck → pickPart → pickVariantBiased weights
  // hullSegment variant selection per biome (salt→PLATED corrosion,
  // rocky→OPEN_TRUSS skeletal, dune→FUEL_BARRELS tanker).
  const biome = opts.biome;
  const { group } = assembleWreck(rand, recipe, cls, biome);

  // Position + terrain-align + bury + yaw.
  group.position.copy(pos);
  const buryY = opts.buryY ?? 0.4;
  group.position.y -= buryY;
  const yaw = rand() * Math.PI * 2;
  alignToTerrain(group, terrain, pos.x, pos.z, yaw, 1.5);
  // alignToTerrain sets quaternion directly; the yaw component is
  // already encoded. Composing further euler.z = 0 isn't needed —
  // tilt is purely from terrain.

  // Shadow flags.
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  (opts.parent ?? scene).add(group);

  // Compound collider matching the part shapes. MUST run BEFORE the merge —
  // it builds one collider per part mesh by geometry type; merging first would
  // collapse the wreck to a single giant AABB. The Rapier colliders are
  // independent of the meshes, so removing the visual meshes afterward is safe.
  attachCompoundCollider(world, group);

  // ACAP W4 — shed a crash-debris fan onto a random impact flank, added to the
  // group BEFORE the merge so it folds in (≈0 draw cost). Debris is cosmetic →
  // added after the collider pass (no collider). Placed at local-y = buryY so it
  // rests on the sand after the half-burial sink.
  if (rand() < 0.6) {
    const dsz = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
    addDebrisFan(group, dsz.x, dsz.z, buryY, rand, rand() < 0.5 ? 1 : -1);
  }

  // T6 — merge the static, non-interactive meshes by material into 1-few meshes
  // (the draw-call win). Salvage panels stay live (animated doors). Per-part
  // collision already captured above.
  mergeStaticByMaterial(group);

  // T4 — half-burial: a windward sand drift bedding the wreck into the dune
  // (visual-only, no collider). Sized to the wreck; consistent prevailing-wind
  // direction so all drifts read as the same weather.
  {
    const sz = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
    const radius = Math.min(9, Math.max(2.5, Math.max(sz.x, sz.z) * 0.5));
    const windDir = new THREE.Vector2(0.85, 0.52).normalize();
    (opts.parent ?? scene).add(makeSandMound(terrain, pos.x, pos.z, windDir, radius, rand));
  }

  // Register every part that got a salvage panel. We walk all
  // descendants looking for userData.accessPanel; each PART mesh that
  // has one (its own panel from addAccessPanel) becomes its own
  // Salvageable entry. Use the wreck class to pick a thematic
  // SalvageKind. Session ABC — gunships are engine-heavy so map to
  // 'engine_cluster' (cabling + chip + bullet interior per AAS palette);
  // corvettes stay 'fuselage' (medium-mix interior); freighters stay
  // 'cargo_container' (lottery interior).
  if (salvageables) {
    const salvageKind =
      cls === 'flagship_engineBlock' ? 'massive' : // ABO B6 — POC migration: keep engineBlock's rich-loot 'massive' palette
      cls === 'corvette' ? 'fuselage' :
      cls === 'gunship' ? 'engine_cluster' :
      cls === 'science_vessel' ? 'fuselage' :     // ABJ — observation hull → fuselage palette (mixed loot, no engine-cabling skew)
      cls === 'bulk_hauler' ? 'cargo_container' : // ABN — cargo-heavy frame → cargo lottery palette
      cls === 'orbital_pod_cluster' ? 'escape_pod' : // ACE — pod cluster: medical-heavy palette
      'cargo_container';
    const seen = new Set<THREE.Object3D>();
    const registered: Salvageable[] = [];
    group.traverse((o) => {
      const panel = o.userData.accessPanel;
      if (panel && !seen.has(o)) {
        seen.add(o);
        o.updateWorldMatrix(true, false);
        const wp = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
        // ACAU (D208) — register EVERY panel-bearing part, unconditionally.
        // registerSalvageable consumes `rand`; conditionally skipping it here
        // (the obvious "don't register buried panels" shortcut) desyncs the one
        // seeded `rand` stream and regenerates the whole world. Register all,
        // then prune below.
        registered.push(registerSalvageable(salvageables, o, salvageKind, wp, rand));
      }
    });
    // ACAU (D208) — 2nd pass: drop any panel the assembled+merged wreck grossly
    // occludes (a sibling part welded in front of it post-assembly), or (ACAV
    // Tier 1) whose front face dipped below the terrain after bury + crash-tilt.
    // Phantom salvageables the player can never reach. RNG-safe: no `rand` calls.
    pruneBuriedPanels(group, registered, salvageables, terrain);
  }

  return group;
}

/** ACAU (D208) — remove registered salvageables whose access panel is buried
 *  behind hull geometry under `wreckRoot`. Mirrors debugPanel.ts panelBuryAudit:
 *  for each panel, cast a short ray inward along the panel's own outward normal;
 *  if a non-panel (hull) surface is reached well in front of the panel's own
 *  nearest surface, the panel is occluded → prune it (remove the record + make
 *  the panel inert so interaction.ts ignores it). Run AFTER mergeStaticByMaterial
 *  so the merged hull is the occluder we test against.
 *
 *  `wreckRoot` is the raycast scope: pass the single wreck `group` to catch a
 *  part welded over its own panel (standalone desert wrecks), or the whole
 *  cluster group (the wreck-yard) to ALSO catch a panel buried behind a
 *  NEIGHBOURING wreck — exactly what the audit's walk-up-to-root raycast sees. */
export function pruneBuriedPanels(
  wreckRoot: THREE.Object3D,
  registered: Salvageable[],
  registry: SalvageableRegistry,
  terrain?: Terrain,
): void {
  if (registered.length === 0) return;
  // ACAV — thin wrapper over the unified validatePanels (world/panelPlacement.ts).
  // Each entry's `cull` removes the record from the registry + inerts the panel
  // mesh. validatePanels raycasts for occlusion against `wreckRoot` (door subtree
  // excluded for open-door parity) and, when `terrain` is given, also culls panels
  // whose front-face corners dipped below the sand (Tier 1). Shared with the audit
  // + the cluster pass — one source of truth.
  const entries: PanelEntry[] = registered.map((s) => ({
    body: s.panel,
    kind: s.kind,
    cull: () => {
      const i = registry.list.indexOf(s);
      if (i >= 0) registry.list.splice(i, 1);
      delete s.panel.userData.interactType;
      delete s.panel.userData.interactId;
      delete s.panel.userData.interactRegistry;
    },
  }));
  validatePanels(entries, { root: wreckRoot, terrain });
}

// ── ABO B6 — flagship POC migration entry ───────────────────────────
//
// Drop-in replacement for one hand-modeled flagship (engineBlock per
// user direction). Calls placeProcgenComposite with the fixed
// flagship_engineBlock class + attaches the engineBlock journal at a
// hand-curated anchor relative to the wreck. Other flagships
// (megaShip / megaWreck / satelliteDish / crashedHull) stay hand-
// modeled — if this POC proves out visually, future session can sweep
// the remaining 4 using the same pattern (adding flagship_megaShip
// etc. classes with appropriate fixed recipes).

interface FlagshipPocOpts {
  /** Override class for the migration target. Currently only
   *  'flagship_engineBlock' is wired. */
  flagshipKind: 'engineBlock';
  /** Journals list to push the migrated journal onto (matches
   *  engineBlock.ts's existing journals?: { list: Journal[] } pattern). */
  journals?: { list: Journal[] };
}

export function placeProcgenCompositeForFlagship(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  pos: THREE.Vector3,
  rand: Rng,
  salvageables: SalvageableRegistry | undefined,
  opts: FlagshipPocOpts,
): THREE.Group {
  // Currently only engineBlock is migrated; switch when more flagships
  // get their own POC class.
  void opts.flagshipKind;
  const group = placeProcgenComposite(scene, world, terrain, pos, rand, salvageables, {
    cls: 'flagship_engineBlock',
    buryY: 1.0,                  // tipped-into-dune feel (engineBlock had heavy bury)
  });

  // Attach the engineBlock journal at a curated position relative to
  // the wreck root. The wreck centers itself in X (assembleWreck shifts
  // children -totalLength/2); place the journal near the cockpit end
  // (-X direction) at ground level so the player finds it near the
  // exposed cockpit / "pilot seat" implication.
  if (opts.journals) {
    group.updateMatrixWorld(true);
    const localOffset = new THREE.Vector3(-2.0, 0.4, 0.8);
    const worldOffset = localOffset.clone().applyMatrix4(group.matrixWorld);
    const journalYaw = group.rotation.y + Math.PI / 2;
    opts.journals.list.push(placeJournal(scene, worldOffset, journalYaw, 'engine_block'));
  }

  return group;
}
