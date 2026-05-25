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
import type { SalvageableRegistry } from './salvage.ts';
import { registerSalvageable } from './salvage.ts';
import { Tuning } from '../config/tuning.ts';
import { addAccessPanel, makeEngineBellMesh } from './wrecks.ts';
import { createRustedHullMaterial } from './hullMaterial.ts';
import { attachCompoundCollider } from '../physics/bodies.ts';
import { alignToTerrain } from '../util/terrainAlign.ts';

// ── Local materials (procedural rust shader matches the hand-modeled
//    wrecks.ts palette so composites blend visually). ────────────────
const _hullMat = createRustedHullMaterial({
  baseColor: Tuning.WRECK_HULL_HEX,
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
): void {
  for (let i = 0; i < count; i++) {
    const w = 0.5 + rand() * 0.7;          // 0.5–1.2m wide
    const h = 0.3 + rand() * 0.5;          // 0.3–0.8m tall
    const d = 0.10 + rand() * 0.05;        // 10–15cm depth (rule 7)
    const patch = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      _breachMat,
    );
    // Position on +Z flank, biased to upper half (0.4–0.95 of radius for Y).
    const px = partLength * (0.15 + rand() * 0.7);
    const py = radius * (0.40 + rand() * 0.55);
    const pz = radius * 0.92 + d * 0.5;     // pull patch outward so it pokes through hull skin
    patch.position.set(px, py, pz);
    // Slight random rotation in all 3 axes so the patch reads "torn open"
    // rather than a perfectly-aligned rectangle.
    patch.rotation.set(
      (rand() - 0.5) * 0.35,
      (rand() - 0.5) * 0.45,
      (rand() - 0.5) * 0.30,
    );
    g.add(patch);
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
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, len, 14),
        _hullMat,
      );
      tube.rotation.z = Math.PI / 2;
      tube.position.set(len * 0.5, r * 0.55, 0);
      g.add(tube);
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
      // Session ABD — 50% → 70% (was reading as ~15% of hulls breached in
      // a 10-composite seed sweep — too few to sell "scavenged battle
      // damage" feel). Now ~40% of all ribbed-cylinder hulls show a patch.
      if (rand() < 0.7) addBreachPatches(g, len, r, rand, 1);
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
        g.add(plate);
      }
      // Session ABD — 40% → 60% (see ribbed-cyl rationale). Plated_rect
      // already supports 1-2 patches per call, so this pushes plate-and-
      // breach-bearing hulls to ~60% of plated hulls.
      if (rand() < 0.6) addBreachPatches(g, len, r, rand, 1 + Math.floor(rand() * 2));
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
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(rEnd, rStart, len, 12),
        _hullMat,
      );
      tube.rotation.z = -Math.PI / 2;     // taper FROM +X start TO -X end
      tube.position.set(len * 0.5, ((rStart + rEnd) / 2) * 0.55, 0);
      g.add(tube);
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

/** Session ABJ — biome-specific hullSegment weights (indices: 0=RIBBED_CYLINDER,
 *  1=PLATED_RECTANGULAR, 2=PANELED_TAPERED, 3=OPEN_TRUSS, 4=FUEL_BARRELS).
 *  Salt: +30% PLATED (corrosion-resistant plates fit salt-flat lore).
 *  Rocky: +20% OPEN_TRUSS (mining-mod / skeletal frame feel).
 *  Dune: +20% FUEL_BARRELS (caravan tanker silhouette in the dunes). */
const HULL_SEGMENT_BIOME_WEIGHTS: Record<BiomeId, ReadonlyArray<number>> = {
  salt:  [1.0, 1.3, 1.0, 1.0, 1.0],
  rocky: [1.0, 1.0, 1.0, 1.2, 1.0],
  dune:  [1.0, 1.0, 1.0, 1.0, 1.2],
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

export type ProcgenWreckClass = 'corvette' | 'freighter' | 'gunship' | 'science_vessel' | 'bulk_hauler';

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
  // (medical bay flavor), corvettes get more engine kit.
  const panelKindPool = cls === 'corvette'
    ? ['fuselage', 'engine_cluster'] as const
    : ['fuselage', 'cargo_container'] as const;
  for (let i = 0; i < wantPanels; i++) {
    const slot = panelEligible[indices[i]];
    const anchor = slot.built.panelAnchor!;
    // Panel position in WRECK-root frame: slot.startX + anchor.x (then
    // shifted by -totalLength/2 above, but that shift applied to the
    // PART mesh's position — the anchor coords are PART-local). Since
    // we want the panel in WRECK-root frame and we've already shifted
    // each part's position by -totalLength/2, the panel sits in the
    // part's local frame. addAccessPanel takes a parent + LOCAL coords,
    // so we'll add it to the PART mesh as the parent.
    const panelKind = panelKindPool[Math.floor(rand() * panelKindPool.length)];
    addAccessPanel(
      slot.built.mesh,
      anchor.x,
      anchor.y,
      anchor.z,
      1,                                  // scale
      anchor.faceYaw,
      panelKind,
    );
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
  const cls: ProcgenWreckClass = opts.cls ?? (() => {
    const r = rand();
    if (r < 0.35) return 'corvette';
    if (r < 0.55) return 'gunship';
    if (r < 0.73) return 'freighter';
    if (r < 0.85) return 'science_vessel';
    return 'bulk_hauler';
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
  group.position.y -= opts.buryY ?? 0.4;
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
  scene.add(group);

  // Compound collider matching the part shapes.
  attachCompoundCollider(world, group);

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
      cls === 'corvette' ? 'fuselage' :
      cls === 'gunship' ? 'engine_cluster' :
      cls === 'science_vessel' ? 'fuselage' :     // ABJ — observation hull → fuselage palette (mixed loot, no engine-cabling skew)
      cls === 'bulk_hauler' ? 'cargo_container' : // ABN — cargo-heavy frame → cargo lottery palette
      'cargo_container';
    const seen = new Set<THREE.Object3D>();
    group.traverse((o) => {
      const panel = o.userData.accessPanel;
      if (panel && !seen.has(o)) {
        seen.add(o);
        o.updateWorldMatrix(true, false);
        const wp = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
        registerSalvageable(salvageables, o, salvageKind, wp, rand);
      }
    });
  }

  return group;
}
