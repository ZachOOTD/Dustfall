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
import { makeRng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { BiomeId } from './biomes.ts';
import type { SalvageableRegistry, Salvageable } from './salvage.ts';
import { registerSalvageable } from './salvage.ts';
import { validatePanels, findSurfaceMounts, type PanelEntry } from './panelPlacement.ts';
import { Tuning } from '../config/tuning.ts';
import { addAccessPanel, addAccessPanelOriented, makeEngineBellMesh, _bellOuterMat, type PanelShape, type PanelArchetype } from './wrecks.ts';
import { mergeStaticByMaterial, makeSandMound, makeLoftedHull, dentGeometry } from './wreckForms.ts';
import { createRustedHullMaterial, HULL_WEATHERING_ACAY, type RustedHullOptions } from './hullMaterial.ts';
import { attachCompoundCollider } from '../physics/bodies.ts';
import { alignToTerrain } from '../util/terrainAlign.ts';
import { placeJournal, type Journal } from './journal.ts';

// ── Local materials (procedural rust shader matches the hand-modeled
//    wrecks.ts palette so composites blend visually). ────────────────
export const _hullMat = createRustedHullMaterial({
  baseColor: Tuning.WRECK_HULL_HEX,
  streakIntensity: 0.38,   // ACAY — lowered; the new directional seam-rust (ch.11) now carries the rust read
  // ACAY — full surface-orientation weathering profile (saturated hues + strengths),
  // shared with the wreck-form studio so the studio is a faithful preview. aoStrength
  // + every weathering hue live in the profile (tune in hullMaterial.ts).
  ...HULL_WEATHERING_ACAY,
});
export const _hullDarkMat = createRustedHullMaterial({
  baseColor: Tuning.WRECK_HULL_DARK_HEX,
  streakIntensity: 0.35,
  // ACAY — lighter (already dark); dust + underside ox for cohesion.
  dustStrength: 0.22,
  oxDeepStrength: 0.45,
  seamRustStrength: 0.25,
  abrasionStrength: 0.22,
});
export const _rustMat = createRustedHullMaterial({
  baseColor: Tuning.WRECK_RUST_HEX,
  rustHex: 0x0e0603,
  streakIntensity: 0.45,
  // ACAY — already rust-toned; a little dust + abrasion to break it up.
  dustStrength: 0.18,
  abrasionStrength: 0.20,
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

// ── ACAY 1B — per-CLASS hull palette. Each wreck class reads as a distinct colour
// identity (a corvette is cool steel-grey, a gunship dark gunmetal, a freighter warm
// tan-rust…) so the fleet stops reading as one brown. The shared weathering PROFILE
// (HULL_WEATHERING_ACAY) is spread into every variant → the dust/rust/scour realism
// stays consistent across classes while only the BASE paint differs. Memoised by
// class → a fleet of N corvettes shares ONE material set (0 extra shader programs —
// identical onBeforeCompile source; only uniform values differ). dark/rust accents
// are DERIVED from the class base so greebles harmonise. Keyed off `cls` (no rand →
// D208-safe). flagship_engineBlock is omitted → falls back to the default look (don't
// regress the ABO B6 POC).
// ACAZ T3 — palette BUCKETS (not per-class). The 8 classes snap to 3 genuinely-distinct
// material families: (a) the desert tint can't crush them back to one brown (the old 8
// hexes sat in a ~19° warm-brown wedge → no real identity at fleet scale), and (b)
// mergeStaticByMaterial folds a whole wreck-yard into ~3 hull buckets, not ~24 — the fix
// for the 1499-drawcall dense yard. Memoised by BUCKET key, so a fleet shares ≤9 hull mats.
export type HullBucket = 'cool' | 'warm' | 'dark';
const CLASS_BUCKET: Record<ProcgenWreckClass, HullBucket> = {
  corvette: 'cool', gunship: 'cool', science_vessel: 'cool',      // military / observation → cool steel-grey
  freighter: 'warm', orbital_pod_cluster: 'warm',                 // working / civilian → warm tan
  bulk_hauler: 'dark', mega_freighter: 'dark',                    // heavy industrial → dark rust-brown
  flagship_engineBlock: 'warm',                                   // unused (re-skin skips it); type completeness
};
// Separated by LIGHTNESS as well as temperature — under the warm desert tint + the warm
// weathering channels, a pure-hue split washes out, but three distinct lightness tiers
// (light-cool / mid-warm / dark) stay legible across the fleet: a pale ship beside a dark
// one always reads as two different classes.
const BUCKET_HEX: Record<HullBucket, number> = {
  cool: 0x70767f,   // LIGHT cool blue-grey steel — military/observation (ACBB: lifted from 0x6b7079 so the cool tier stays light)
  warm: 0x6e5c42,   // MID warm tan — working/civilian
  dark: 0x3a3d43,   // DARK cool-steel — heavy haulers (ACBB: was 0x382e24 warm-brown → read as terracotta mud; cool-steel reads as dark METAL under reduced pale weathering)
};
// ── ACBB Tier 1 — per-BUCKET weathering rebalance (the §F debt + the cohesion fix).
// The shared HULL_WEATHERING_ACAY profile applied UNIFORMLY collapsed all three buckets
// toward one warm-rust value (the desert tint + the warm ox/dust channels washed cool→rust
// and dark→pale-ceramic — see the ACBB baseline shots). Each bucket now overrides a few
// channel STRENGTHS so its identity survives as a distinct lightness/temperature TIER while
// staying in one believable weather-system (D224 — distinct by lightness, not clashing hue):
//   cool  → warm-rust channels pulled DOWN (ox/seam/oxTop) so it stays cool-grey steel.
//   warm  → the full HULL_WEATHERING_ACAY (the warm tan-rust reference look). No override.
//   dark  → the PALE channels pulled down (dust/chalk/oxTop) so the heavy hull stays DARK
//           steel instead of washing to powder-pale; rust still pools low (oxDeep/seam kept).
// Strengths only (hues stay shared) → zero new shader programs (identical onBeforeCompile).
const BUCKET_WEATHERING: Record<HullBucket, Partial<RustedHullOptions>> = {
  // wearAmplitude bumped on cool/dark (ACBB iter3): the critique read the smooth low-poly
  // tank/derelict flanks as "CGI-flat" — more plate-to-plate brightness break-up adds tonal
  // variation even where the geometry is too smooth for the orientation channels to fire.
  cool: { oxStrength: 0.30, oxTopStrength: 0.18, seamRustStrength: 0.32, oxDeepStrength: 0.38, wearAmplitude: 0.34 },
  warm: {},
  dark: { dustStrength: 0.26, chalkStrength: 0.10, oxTopStrength: 0.24, oxDeepStrength: 0.62, seamRustStrength: 0.50, wearAmplitude: 0.38 },
};
// ACAZ T3 — per-class GIRTH (hull-radius multiplier). The size ladder was length-only
// (every class seeded prevRadius=0.9), so a 33m mega had the same ~1m girth as a 4m scout
// and read as a buried pipeline. Seeding prevRadius from this fattens the heavy classes
// (a fat-bodied freighter), while the human-CONSTANT scale-anchor door (clamped ≤1.7m)
// then reads proportionally TINY on the mega — selling its mass. Faceted hulls scale at a
// fixed vertex count → zero triangle / draw-call cost.
const CLASS_GIRTH: Partial<Record<ProcgenWreckClass, number>> = {
  corvette: 1.0, gunship: 1.05, science_vessel: 1.15,
  freighter: 1.5, bulk_hauler: 1.8, mega_freighter: 2.4, orbital_pod_cluster: 1.2,
};
// ACAZ T2D/T3 — crash burial by class (absolute metres, RE-TUNED to the now-fatter T3
// hulls): the dramatic-size classes bed DEEP into the dune (a 33m mega half-swallowed
// reads its mass), scouts sit nearly upright. Burial is additionally clamped at placement
// to keep ≥50% of the wreck (and its top-aligned scale anchors) proud. flagship exempt.
const CLASS_BURY: Partial<Record<ProcgenWreckClass, number>> = {
  corvette: 0.42, gunship: 0.48, science_vessel: 0.55,
  freighter: 0.90, bulk_hauler: 1.20, mega_freighter: 1.55, orbital_pod_cluster: 0.45,
};
// ACAZ T2D/T3 — crash LIST (roll, radians) by class — floors RAISED so the "not parked"
// roll actually reads across the fleet (the old sin()-gated version zeroed most wrecks).
const CLASS_LIST: Partial<Record<ProcgenWreckClass, number>> = {
  corvette: 0.14, gunship: 0.20, science_vessel: 0.16,
  freighter: 0.24, bulk_hauler: 0.30, mega_freighter: 0.34, orbital_pod_cluster: 0.16,
};
export interface ClassHullMats { hull: THREE.MeshLambertMaterial; dark: THREE.MeshLambertMaterial; rust: THREE.MeshLambertMaterial; }
const _bucketMatCache = new Map<HullBucket, ClassHullMats>();
/** ACBA — bucket→materials, shared by ship classes AND the new POI archetypes so the
 *  whole field collapses into ≤3 hull buckets at merge (the draw-call win). Memoised. */
export function getBucketMats(bucket: HullBucket): ClassHullMats {
  const cached = _bucketMatCache.get(bucket);
  if (cached) return cached;
  const base = new THREE.Color(BUCKET_HEX[bucket]);
  const dark = base.clone().multiplyScalar(0.80);
  const rust = base.clone().lerp(new THREE.Color(Tuning.WRECK_RUST_HEX), 0.5);
  const wx = BUCKET_WEATHERING[bucket];   // ACBB — per-bucket strength overrides (tier separation)
  const mats: ClassHullMats = {
    hull: createRustedHullMaterial({ baseColor: base.getHex(), ...HULL_WEATHERING_ACAY, ...wx, streakIntensity: 0.42 }),
    dark: createRustedHullMaterial({ baseColor: dark.getHex(), ...HULL_WEATHERING_ACAY, ...wx, streakIntensity: 0.34 }),
    rust: createRustedHullMaterial({ baseColor: rust.getHex(), ...HULL_WEATHERING_ACAY, ...wx, streakIntensity: 0.46 }),
  };
  // ACBD — DoubleSide across the wreck hull/POI archetypes: the ACBA archetypes
  // (tank, satellite, husk, derelict) showed one-sided faces that vanished when
  // viewed from behind/inside (user-reported, esp. the fuel tank). One shared lever.
  mats.hull.side = THREE.DoubleSide;
  mats.dark.side = THREE.DoubleSide;
  mats.rust.side = THREE.DoubleSide;
  _bucketMatCache.set(bucket, mats);
  return mats;
}
function getClassHullMats(cls: ProcgenWreckClass): ClassHullMats {
  return getBucketMats(CLASS_BUCKET[cls] ?? 'warm');
}
/** ACBA — remap a group's shared base hull mats to a bucket's palette (by singleton
 *  identity). Runs BEFORE mergeStaticByMaterial. Shared by the ship + POI pipelines. */
export function reskinToBucket(root: THREE.Object3D, mats: ClassHullMats): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.material === _hullMat) m.material = mats.hull;
    else if (m.material === _hullDarkMat) m.material = mats.dark;
    else if (m.material === _rustMat) m.material = mats.rust;
    else if (m.material === _bellOuterMat(_hullMat)) m.material = _bellOuterMat(mats.hull);
  });
}

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
  /** ACAZ T2A — set ONLY by solid-hull variants that can host a scale-anchor
   *  hatch: the part's REAL +Z flank z (so the anchor seats flush on the actual
   *  surface, not a guessed 0.92·r). `anchorLeeSide` = the clean flank (−impactSide)
   *  reusing the segment's already-rolled impact side (no new rand). assembleWreck
   *  picks 1-2 of these per WRECK (not per segment) so the door reads as a single
   *  trusted human reference, not a repeating band. */
  anchorSurfZ?: number;
  anchorLeeSide?: number;
  /** ACAZ T2A r3 — the part-local Y range over which the +Z flank stays ~flat at
   *  `anchorSurfZ` (so the door/ladder seat flush, no float off a chining hull). The
   *  door is sized to fit INSIDE this band. Plated box = nearly the whole face;
   *  lofted cylinder = a narrower mid-band before the chines pull in. */
  anchorBandLo?: number;
  anchorBandHi?: number;
}

type PartKind = 'cockpit' | 'hullSegment' | 'engineModule' | 'tailStub';

interface PartBuilder {
  // `cls` (ACAZ T2A) lets a builder scale human-scale anchors by class (a hatch
  // is the same real size on every ship — that's what sells scale). Optional, so
  // builders that don't care keep their 2-arg signature (TS allows fewer params).
  build(rand: Rng, prevRadius: number, cls?: ProcgenWreckClass): BuiltPart;
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
      // ACBA — removed the cockpit "bubble + window": it read as a fake cartoon
      // canopy (user feedback: unrealistic). The nose is now a clean tapered hull
      // cone; Phase A re-skins the cockpit component without glass.
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
      // ACBA — removed the big forward "window" (user feedback: the glass insets
      // read as unrealistic). The boxy cockpit keeps only its rust-streak greeble.
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
  flankZ: number = radius,  // ACBA — real surface Z of THIS variant's flank; greebles seat ON the skin
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
    const pz = flankZ * zside;   // ACBA — was radius*0.93 (buried 10cm greebles INSIDE the skin)
    const roll = rand();
    let node: THREE.Object3D;
    if (roll < 0.20) {
      // ACAZ T2A — Panel-line seam NETWORK: a longitudinal crease plus two cross
      // seams reading as a riveted plate boundary (a system, not one stray line).
      // Flat-shading makes the crease boxes read as sharp recessed grooves. Same
      // single rand() the old one-seam branch spent (D208 — rand-budget neutral).
      const seamGrp = new THREE.Group();
      const seamLen = 0.55 + rand() * 0.75;
      // +z = 0.07 keeps the crease PROUD of the real flank (greebles now seat at pz=flankZ,
      // i.e. ON the skin → a 10cm box is half-proud; the seam reads as a raised weld line).
      const lng = new THREE.Mesh(new THREE.BoxGeometry(seamLen, 0.05, 0.10), _hullDarkMat);   // longitudinal
      lng.position.z = 0.07; seamGrp.add(lng);
      for (let k = -1; k <= 1; k += 2) {
        const cross = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.10), _hullDarkMat);    // cross-ties
        cross.position.set(seamLen * 0.4 * k, 0, 0.07);
        seamGrp.add(cross);
      }
      node = seamGrp;
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
        const slat = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.05, 0.12), _rustMat);   // ACBA rule-7 thin-axis 0.03→0.05
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

// Deterministic 0..1 hash of two floats (no rand draw). Lets addScaleAnchor vary
// per segment from the part's already-rolled len/radius WITHOUT touching the rand
// stream — so panel placement stays byte-identical to pre-anchor (verify:placement
// 0 fails). IEEE754 Math.sin is deterministic across runs (seeded-build safe).
function hash2(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ── ACAZ T2A — human-scale ACCESS HATCH + LADDER (the scale-read anchor) ──
// The single highest-leverage feature for reading wreck SIZE: a man-sized door
// and a climbing ladder are objects the eye knows the real dimensions of, so the
// SAME feature anchors a 4m scout AND makes a 33m freighter read 33m (the non-
// linear-detail rule — repeat a constant human anchor; don't resize one shape).
// Placed on the CLEAN lee flank (negative-space contrast to the battle-scarred
// impact flank, where addHullGreebles clusters). Shared materials so the static
// merge folds it (≈0 draw cost) and the per-class re-skin remaps it. Every box
// ≥10cm deep (rule 7); the wheel/rungs are cylinders/torus (inherently thick).
function addScaleAnchor(
  g: THREE.Group,
  partLength: number,
  radius: number,
  surfZ: number,                   // the part's REAL +Z flank z (variant-specific)
  bandLo: number,                  // part-local Y range where the flank stays flat at surfZ
  bandHi: number,
  leeSide: number,                 // flank to sit on (−impactSide → the clean side)
): void {
  // Consumes ZERO rand() — variation is hash2() of the part's already-rolled len/radius,
  // so the rand STREAM is byte-identical to pre-anchor (verify:placement 0 fails, D208).
  // Inspection override (rig-shot --forceanchor) pins the hatch to the +Z camera flank
  // for the headless studio; no in-game effect (the flag is never set at runtime).
  const lee = (globalThis as { __FORCE_ANCHOR_NEAR?: boolean }).__FORCE_ANCHOR_NEAR ? 1 : leeSide;
  const flankZ = surfZ * lee;                          // group origin sits ON the real skin
  // Size the door to the FLAT band so it can never float off a chining hull, as tall as
  // the band allows (a believable bulkhead door), top-aligned so the threshold mostly
  // clears the post-sink sand line. Width follows a door-ish aspect.
  const band = bandHi - bandLo;
  const hatchH = Math.min(1.7, band * 0.72);
  const hatchW = Math.min(0.92, Math.max(0.58, hatchH * 0.6));
  const px = partLength * (0.32 + hash2(partLength, radius) * 0.36);
  const py = bandHi - hatchH * 0.5 - 0.15;             // top-aligned in the band (least burial)

  // ── wreck-polish delta 5 (campaign C10) — scale-anchor EXCLUSION POCKET. The hatch+ladder is the
  // game's ONE human-constant scale reference; a hull greeble/seam punching through right beside it
  // corrupts that read. Greebles were scattered during the PART build (before this host was chosen) and
  // ~22% bias to the lee flank (addHullGreebles) — exactly where the anchor sits. Carve a clean pocket:
  // remove any isWreckDecoration greeble already on THIS part that falls inside the anchor footprint on
  // the lee flank. Pure scene-graph filter → ZERO rand (panel stream byte-identical) + greebles are
  // collider-exempt (no COLLIDER-AUDIT impact). Runs BEFORE the door/ladder are added so it can't hit them.
  {
    const leeSign = Math.sign(flankZ) || 1;
    const exclHalfX = hatchW * 0.5 + 0.55;            // covers the door slab + the jamb ladder + margin
    const exclLoY = bandLo - 0.12, exclHiY = bandHi + 0.12;
    const doomed: THREE.Object3D[] = [];
    for (const child of g.children) {
      if (child.userData?.isWreckDecoration !== true) continue;        // never touch the structural hull
      const cz = child.position.z;
      if (Math.abs(cz) < 0.01 || Math.sign(cz) !== leeSign) continue;  // lee flank only (skip dorsal/top)
      if (Math.abs(child.position.x - px) > exclHalfX) continue;
      if (child.position.y < exclLoY || child.position.y > exclHiY) continue;
      doomed.push(child);
    }
    for (const d of doomed) g.remove(d);
  }

  // All local +z = PROUD outward; the group's rotation.y resolves the flank sign.
  const grp = new THREE.Group();
  // Recessed mounting flange — the door slab stands ~12cm proud of it so the slab throws
  // its own shadow step (reads set-IN, not bolted-on).
  const flange = new THREE.Mesh(new THREE.BoxGeometry(hatchW + 0.22, hatchH + 0.22, 0.10), _hullDarkMat);
  flange.position.z = 0.04; grp.add(flange);
  const door = new THREE.Mesh(new THREE.BoxGeometry(hatchW, hatchH, 0.16), _rustMat);
  door.position.z = 0.13; grp.add(door);              // front ≈0.21, ~12cm proud of the flange
  // Two horizontal reinforcing straps — reads as a heavy sealed door.
  for (let b = -1; b <= 1; b += 2) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(hatchW * 0.92, 0.06, 0.10), _hullDarkMat);
    bar.position.set(0, b * 0.27 * hatchH, 0.19); grp.add(bar);
  }
  // Lock HANDWHEEL on the latch (free) edge (−x): dark ring + 3 spokes + hub, sized so the
  // outer edge stays ON the slab (no overhang onto the flange).
  const wheelR = hatchW * 0.24, wx = -hatchW * 0.22, wy = -hatchH * 0.04, wz = 0.23;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(wheelR, 0.036, 8, 16), _hullDarkMat);
  ring.position.set(wx, wy, wz); grp.add(ring);
  for (let sp = 0; sp < 3; sp++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, wheelR * 2, 6), _hullDarkMat);
    spoke.rotation.z = Math.PI / 2 + sp * (Math.PI * 2 / 3);
    spoke.position.set(wx, wy, wz); grp.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 8), _hullDarkMat);
  hub.rotation.x = Math.PI / 2; hub.position.set(wx, wy, wz); grp.add(hub);
  // Two hinges on the latch-OPPOSITE edge (+x): a vertical pivot barrel + a DARK strap leaf,
  // both proud of the slab front so the hinge silhouette isn't swallowed by the slab.
  for (let k = -1; k <= 1; k += 2) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.20, 6), _hullDarkMat);
    barrel.position.set(hatchW * 0.5 + 0.07, hatchH * 0.30 * k, 0.25); grp.add(barrel);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.10, 0.10), _hullDarkMat);
    strap.position.set(hatchW * 0.30, hatchH * 0.30 * k, 0.23); grp.add(strap);
  }
  grp.position.set(px, py, flankZ);
  grp.rotation.y = lee > 0 ? 0 : Math.PI;
  grp.traverse((o) => { o.userData.isWreckDecoration = true; });
  grp.name = '__scaleAnchor';   // pre-merge tag so the inspection harness can aim at it
  g.add(grp);

  // Climbing LADDER hugging the door jamb (~70%), seated in the SAME flat band so it can't
  // float off a chining hull; biased toward the segment centre so it always stays on hull.
  if (hash2(partLength + 3.3, radius + 1.1) < 0.70) {
    const lad = new THREE.Group();
    const ladH = band - 0.12;                          // fills the flat band (a boarding climb)
    const rungs = Math.max(4, Math.round(ladH / 0.30));   // ~0.3m human rung pitch
    const railSep = 0.18;
    for (let k = -1; k <= 1; k += 2) {                 // two thick side rails (back on skin)
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.055, ladH + 0.12, 0.12), _hullDarkMat);
      rail.position.set(k * railSep, 0, 0.06); lad.add(rail);
    }
    for (let r2 = 0; r2 < rungs; r2++) {               // 6cm-dia horizontal rungs, proud
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, railSep * 2 + 0.05, 8), _rustMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, (rungs > 1 ? r2 / (rungs - 1) - 0.5 : 0) * ladH, 0.12);
      lad.add(rung);
    }
    const ladSide = px < partLength * 0.5 ? 1 : -1;    // toward segment centre → stays on hull
    const ladX = px + (hatchW * 0.5 + 0.22) * ladSide;
    lad.position.set(ladX, (bandLo + bandHi) * 0.5, flankZ);   // centred in the band
    lad.rotation.y = lee > 0 ? 0 : Math.PI;
    lad.traverse((o) => { o.userData.isWreckDecoration = true; });
    g.add(lad);
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
      addHullGreebles(g, len, r, rand, 2 + Math.floor(rand() * 3), impactSide, r);   // ACAO richer vocab + asymmetry; seat on flank r
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
        // ACAZ T2A — lofted ship-section flank reaches z = r; clean lee = −impactSide.
        // The SHIP_SECTION holds full half-width only mid-flank (chines pull in above);
        // hull sits at y=r*0.55, so the flat band is part-local y∈[0.25r, 1.0r].
        anchorSurfZ: r,
        anchorLeeSide: -impactSide,
        anchorBandLo: r * 0.25,
        anchorBandHi: r * 1.0,
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
      addHullGreebles(g, len, r, rand, 2 + Math.floor(rand() * 3), impactSide, r * 0.9);   // ACAO richer vocab + asymmetry; seat on plated flank 0.9r
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
        // ACAZ T2A — box body half-depth (r*1.8)/2 → +Z face at 0.9·r; lee = −impactSide.
        // The whole flat box face hosts the door — band = base to just under the crown
        // (box spans y∈[-0.15r, 1.35r]); this flat host gets the tallest doors.
        anchorSurfZ: r * 0.9,
        anchorLeeSide: -impactSide,
        anchorBandLo: 0.05,
        anchorBandHi: r * 1.30,
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
  // Variant 7 — SHEARED_HULL (ACAZ T2B). A hull section BLASTED open on one flank
  // mid-ship: a charred breach patch with exposed bent frame ribs + torn-metal flaps
  // bursting outward (built proud — recessed voids don't read at procgen scale, D197).
  // The strongest "crashed, not parked" silhouette; the intact lee flank still hosts a
  // salvage panel + a scale-anchor hatch.
  {
    build(rand: Rng, prevRadius: number): BuiltPart {
      const g = new THREE.Group();
      const len = 2.4 + rand() * 0.9;
      const r = Math.max(prevRadius * 0.95, 0.95 + rand() * 0.2);
      const hull = makeLoftedHull(
        [{ z: 0, halfW: r, halfH: r }, { z: len, halfW: r, halfH: r }], _hullMat, 0.09,
      );
      // A subtle local crumple by the tear (the angular low-poly dent reads on-brand).
      const gashSide = rand() < 0.5 ? 1 : -1;
      const gx = len * (0.42 + rand() * 0.2);
      dentGeometry(hull.geometry, new THREE.Vector3(gashSide * r, 0, gx),
        r * 0.9, new THREE.Vector3(-gashSide * r * 0.28, -r * 0.08, 0));
      hull.geometry.computeVertexNormals();
      hull.rotation.y = Math.PI / 2;
      hull.position.set(0, r * 0.55, 0);
      g.add(hull);
      // The torn-open section is built PROUD of the skin on the gash flank — recessed
      // voids DON'T read on ~1m procgen hulls (D197), so the damage bursts OUTWARD: a
      // dark charred breach patch + exposed bent frame ribs + splayed torn-metal flaps.
      const fz = gashSide * (r + 0.06);
      const patch = new THREE.Mesh(new THREE.BoxGeometry(r * 0.95, r * 1.05, 0.15), _hullDarkMat);   // ACBA rule-7 0.06→0.15 (hull-substantial)
      patch.position.set(gx, r * 0.6, gashSide * (r + 0.05));   // seated mostly proud of the skin
      patch.userData.isWreckDecoration = true;
      g.add(patch);
      for (let i = -1; i <= 1; i++) {                  // 3 exposed bent frame ribs
        const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, r * (0.95 - Math.abs(i) * 0.14), 6), _rustMat);
        rib.position.set(gx + i * r * 0.3, r * 0.6, fz);
        rib.rotation.x = i * 0.14;                      // bowed outward
        rib.userData.isWreckDecoration = true;
        g.add(rib);
      }
      const flapN = 4 + Math.floor(rand() * 3);         // torn-metal flaps around the rim
      for (let i = 0; i < flapN; i++) {
        const ang = (i / flapN) * Math.PI * 2 + (rand() - 0.5) * 0.4;
        const flap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.15, r * 0.46, 3), _rustMat);
        flap.position.set(gx + Math.cos(ang) * r * 0.5, r * 0.6 + Math.sin(ang) * r * 0.5, fz);
        flap.rotation.z = ang - Math.PI / 2;            // splay radially out from the rim
        flap.rotation.x = gashSide * (0.5 + rand() * 0.4);
        flap.userData.isWreckDecoration = true;
        g.add(flap);
      }
      addHullGreebles(g, len, r, rand, 1 + Math.floor(rand() * 2), -gashSide, r);   // intact lee detail; seat on flank r
      return {
        mesh: g,
        partLength: len,
        radius: r,
        panelAnchor: { x: len * 0.2, y: r * 0.5, z: r * 1.02, faceYaw: Math.PI / 2 },
        // Scale-anchor on the INTACT lee flank (−gashSide); same flat band as the cylinder.
        anchorSurfZ: r,
        anchorLeeSide: -gashSide,
        anchorBandLo: r * 0.25,
        anchorBandHi: r * 1.0,
      };
    },
  },
  // Variant 8 — CARGO_POD_ROW (ACAZ T2B). A freight spine carrying 3-4 shipping-
  // container pods, some torn off (only the bare clamp saddle remains). The containers
  // are themselves human-known scale references, so this is a freight-train silhouette
  // that reads its own size — no hatch anchor needed.
  {
    build(rand: Rng, prevRadius: number): BuiltPart {
      const g = new THREE.Group();
      const len = 2.8 + rand() * 1.0;
      const r = Math.max(prevRadius * 0.95, 0.95 + rand() * 0.15);
      const spine = new THREE.Mesh(new THREE.BoxGeometry(len, r * 0.5, r * 0.55), _hullDarkMat);
      spine.position.set(len * 0.5, r * 0.5, 0);
      g.add(spine);
      const podCount = 3 + Math.floor(rand() * 2);     // 3-4 freight pods
      const podLen = (len * 0.94) / podCount;
      for (let i = 0; i < podCount; i++) {
        const cx = (i + 0.5) * (len / podCount);
        // Clamp saddle — present even where the pod was torn off (a bare freight cradle).
        const clamp = new THREE.Mesh(new THREE.BoxGeometry(podLen * 0.28, r * 0.62, r * 1.18), _rustMat);
        clamp.position.set(cx, r * 0.55, 0);
        clamp.userData.isWreckDecoration = true;
        g.add(clamp);
        if (i > 0 && rand() < 0.25) continue;          // ~torn-off pod (only the clamp remains)
        const pod = new THREE.Mesh(new THREE.BoxGeometry(podLen * 0.86, r * 0.95, r * 1.05), _hullMat);
        pod.position.set(cx, r * 0.78, 0);
        g.add(pod);
        for (let k = -1; k <= 1; k += 2) {             // corrugation ribs on the +Z face
          const rib = new THREE.Mesh(new THREE.BoxGeometry(podLen * 0.86, r * 0.10, 0.10), _hullDarkMat);
          rib.position.set(cx, r * 0.78 + k * r * 0.28, r * 0.55);
          rib.userData.isWreckDecoration = true;
          g.add(rib);
        }
      }
      return {
        mesh: g,
        partLength: len,
        radius: r,
        panelAnchor: { x: podLen * 0.5, y: r * 0.78, z: r * 0.55, faceYaw: Math.PI / 2 },
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

/** Session ABJ + ACE + ACAZ — biome-specific hullSegment weights (indices:
 *  0=RIBBED_CYLINDER, 1=PLATED_RECTANGULAR, 2=PANELED_TAPERED, 3=OPEN_TRUSS,
 *  4=FUEL_BARRELS, 5=BRISTLE_ANTENNA, 6=SHEARED_HULL, 7=CARGO_POD_ROW — last two ACAZ T2B).
 *  Salt: +30% PLATED + cargo pods (freight-route lore).
 *  Rocky: +20% OPEN_TRUSS + SHEARED (hard-impact crashes split hulls open).
 *  Dune: +20% FUEL_BARRELS + cargo pods (caravan/freight silhouette in the dunes).
 *  Wreck-yard: PLATED + OPEN_TRUSS + SHEARED boosted (a graveyard of violently-wrecked hulks).
 *  ⚠ EVERY row MUST list all 8 weights — `pickVariantBiased`'s `?? 1.0` fallback silently
 *  mis-weights a forgotten index. */
const HULL_SEGMENT_BIOME_WEIGHTS: Record<BiomeId, ReadonlyArray<number>> = {
  salt:  [1.0, 1.3, 1.0, 1.0, 1.0, 1.0, 1.0, 1.2],
  rocky: [1.0, 1.0, 1.0, 1.2, 1.0, 1.0, 1.3, 1.0],
  dune:  [1.0, 1.0, 1.0, 1.0, 1.2, 1.0, 1.0, 1.3],
  // Cycle 8 — wreck-yard graveyard: ancient corroded + stripped-to-frame + torn-open hulks.
  wreck_yard: [1.0, 1.3, 1.0, 1.3, 1.0, 1.0, 1.4, 1.0],
};

function pickPart(rand: Rng, kind: PartKind, biome?: BiomeId): PartBuilder {
  switch (kind) {
    case 'cockpit':
      return pickVariant(rand, COCKPIT_VARIANTS);
    case 'hullSegment': {
      // Inspection override (rig-shot --variant=N) forces every hull segment to one
      // variant so the studio can frame it; consumes the selection rand to keep the
      // budget stable. No in-game effect (the flag is never set at runtime).
      const forced = (globalThis as { __FORCE_HULL_VARIANT?: number }).__FORCE_HULL_VARIANT;
      if (forced !== undefined && HULL_SEGMENT_VARIANTS[forced]) { rand(); return HULL_SEGMENT_VARIANTS[forced]; }
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

export type ProcgenWreckClass = 'corvette' | 'freighter' | 'gunship' | 'science_vessel' | 'bulk_hauler' | 'mega_freighter' | 'orbital_pod_cluster' | 'flagship_engineBlock';

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
  if (cls === 'mega_freighter') {
    // ACAY — mega-freighter (~25-40m): cockpit + 7-10 hull + 2-3 engine + tail,
    // 4-5 panels. The dramatic-scale piece (squat/blocky, deeply buried). Roulette-
    // RARE so the field isn't all giants. The merge collapses the many segments by
    // material, so draw calls stay bounded — but watch the triangle budget.
    const hullCount = 7 + Math.floor(rand() * 4);     // 7-10
    const engineCount = 2 + Math.floor(rand() * 2);   // 2-3
    const parts: PartKind[] = ['cockpit'];
    for (let i = 0; i < hullCount; i++) parts.push('hullSegment');
    for (let i = 0; i < engineCount; i++) parts.push('engineModule');
    parts.push('tailStub');
    return { parts, panelCountMin: 4, panelCountMax: 5 };
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

// ── wreck-polish-bundle delta 1 (campaign 2026-06-18) — NON-AXIAL DORSAL MASS ──
// The §F/§G "sausage" fix: heavy classes are a chain of co-axial hull tubes, so the
// silhouette reads as one long pipe. A dorsal SUPERSTRUCTURE (bridge tower + a tapered
// bridge cap + an offset deckhouse + window strip + antenna whips) rising off the TOP of
// a mid hull body breaks the length-axis read with a vertical mass. Consumes ZERO rand()
// (hash2 of the part's len/radius → the panel rand stream is byte-identical,
// verify:placement unchanged, D208/D221). Shared materials (folds into the static merge +
// the per-class re-skin). Tagged isWreckDecoration → COLLIDER-AUDIT-exempt (D235): it sits
// high on the dorsal, above the walkable ground around the half-buried hull. Every box
// ≥12cm on its thin axis (rule 7); whips are cylinders (inherently thick).
function addDorsalMass(g: THREE.Group, partLength: number, partRadius: number, maxR: number): void {
  const grp = new THREE.Group();
  const h = hash2(partLength * 1.7, maxR * 2.3);
  const h2 = hash2(maxR * 3.1, partLength * 0.7);
  // round-3 (silhouette fix): the tower must read as real MASS, not a sliver. Scale its HEIGHT off
  // the wreck's BULK (maxR = the fattest part) so it's tall even when the mid-span host part is slim;
  // scale the BASE off the host partRadius so it stays seated on the part (no overhang). A chunky,
  // tall bridge block — not a thin mast — is what breaks the horizontal pipe read.
  // round-4 (proportion fix): build the tower TALLER-THAN-WIDE so it reads as a vertical
  // superstructure on EVERY heavy class — the fat bulk_hauler made a squat wide-as-tall slab.
  // Height scales off the wreck BULK (maxR); the base is capped to ≤~0.55× the height (and to the
  // host part width) so the proportion is always vertical, never a flush slab.
  const towerH = maxR * (1.7 + h * 0.5);              // TALL vertical mass from the wreck bulk
  const baseW = Math.min(partRadius * 1.35, towerH * 0.52);   // along X (length)
  const baseD = Math.min(partRadius * 1.45, towerH * 0.55);   // along Z (beam) — capped → stays vertical
  const tower = new THREE.Mesh(new THREE.BoxGeometry(baseW, towerH, baseD), _rustMat);
  tower.position.y = towerH * 0.5;
  grp.add(tower);
  // Tapered bridge CAP (reads as a superstructure, not a slab).
  const capW = baseW * 0.68, capD = baseD * 0.72, capH = maxR * (0.4 + h2 * 0.22);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(capW, capH, capD), _hullDarkMat);
  cap.position.set(-baseW * 0.05, towerH + capH * 0.5, 0);
  grp.add(cap);
  // Offset DECKHOUSE block — asymmetry so it isn't a centred monolith.
  const dkW = baseW * 0.55, dkH = maxR * (0.5 + h * 0.2), dkD = baseD * 0.8;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(dkW, dkH, dkD), _rustMat);
  deck.position.set(baseW * (0.45 + h2 * 0.2), dkH * 0.5, baseD * (h - 0.5) * 0.25);
  grp.add(deck);
  // Window strip on the tower's forward face (a dark recessed band).
  const win = new THREE.Mesh(new THREE.BoxGeometry(baseW * 0.78, towerH * 0.16, 0.12), _hullDarkMat);
  win.position.set(0, towerH * 0.6, baseD * 0.5 + 0.02);
  grp.add(win);
  // Two tall antenna MASTS off the cap — now that the block reads as solid mass, tall masts add
  // commanding vertical SILHOUETTE height (esp. on the long-low freighter) without being mistaken
  // for the whole superstructure (round-5 — the silhouette critic asked for more whip presence).
  for (let k = -1; k <= 1; k += 2) {
    const mastH = maxR * (1.0 + hash2(maxR + k, partLength) * 0.7);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, mastH, 6), _hullDarkMat);
    mast.position.set(capW * 0.26 * k - baseW * 0.05, towerH + capH + mastH * 0.5, 0);
    grp.add(mast);
  }
  // Seat on the dorsal (top) of the part: X mid-ish, base embedded ~0.28r into the upper skin.
  const px = partLength * (0.34 + h * 0.30);
  grp.position.set(px, partRadius * 0.72, 0);
  grp.traverse((o) => { o.userData.isWreckDecoration = true; });
  grp.name = '__dorsalMass';
  g.add(grp);
}

// ── wreck-polish delta 4 (campaign 2026-06-18) — GUARANTEED visible trauma on corvette + gunship ──
// These small military ships sit nearly upright (barely buried) + are the most-scrutinised, but the
// per-part breach gate is probabilistic so one can roll up clean/intact. This adds ONE deterministic
// breach on a hull body of every corvette/gunship: a torn-open GASH poking through the flank + a bent
// sheared-loose hull-plate FLAP beside it. hash2-only (ZERO rand → the panel rand stream is
// byte-identical, verify:placement unchanged, D208/D221); isWreckDecoration-tagged (findPanelMount
// rejects a panel on it, COLLIDER-AUDIT-exempt); shared materials (folds into the merge + re-skin).
function addForcedTrauma(g: THREE.Group, partLength: number, radius: number): void {
  const h = hash2(partLength * 2.1, radius * 1.7);
  const h2 = hash2(radius * 2.9, partLength * 1.3);
  const side = hash2(partLength * 0.7, radius * 3.3) < 0.5 ? 1 : -1;
  // Seat everything against the part's REAL geometry frame. C10 gate root-cause: addForcedTrauma had
  // assumed local y=0 was the hull AXIS, but every hull variant seats the body CENTRE at y≈r*0.55
  // (crown ≈ r*1.55; y=0 is the underside that burial sinks). So the roof/flap floated ~0.5m off the
  // hull and read as debris on the sand. Anchor to the real centre/crown/flank instead.
  const cy = radius * 0.55;                            // real hull centreline
  const skinZ = radius * 0.92;                         // real +Z flank surface (matches addBreachPatches)
  const w = radius * (0.8 + h * 0.5);
  const ht = radius * (0.5 + h2 * 0.32);
  const d = 0.16;                                      // rule 7
  const px = partLength * (0.30 + h * 0.40);
  const py = cy + radius * (0.10 + h2 * 0.26);         // UPPER flank, above the real centreline
  const pz = (skinZ + d * 0.3) * side;                 // pokes just through the real flank skin
  // Torn-open GASH — UNLIT pure-black void (nozzle-interior mat) reads as a HOLE, not a lit greeble.
  const gash = new THREE.Mesh(new THREE.BoxGeometry(w, ht, d), _nozzleInteriorMat);
  gash.position.set(px, py, pz);
  gash.rotation.set((h - 0.5) * 0.4, (h2 - 0.5) * 0.5, (h - 0.5) * 0.35);
  gash.userData.isWreckDecoration = true; g.add(gash);
  // An offset sub-void breaks the clean rectangle into a jagged blast outline (not a pasted panel).
  const sub = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, ht * 0.52, d), _nozzleInteriorMat);
  sub.position.set(px + w * 0.34 * (h - 0.5), py + ht * 0.5 * (h2 - 0.5), pz);
  sub.rotation.z = (h2 - 0.5) * 0.7;
  sub.userData.isWreckDecoration = true; g.add(sub);
  // A second sub-void on the opposite rim so the jagged blast outline wraps the WHOLE perimeter (the
  // void's right/bottom edges were reading too clean/rectangular — C10 gate r2 sev1).
  const sub2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, ht * 0.42, d), _nozzleInteriorMat);
  sub2.position.set(px + w * (0.18 + h * 0.16), py - ht * (0.28 + h2 * 0.16), pz);
  sub2.rotation.z = (h - 0.5) * 0.7;
  sub2.userData.isWreckDecoration = true; g.add(sub2);
  // Thin rust scorch RING around the rim — gradates skin→hole so the edge isn't a hard pasted line.
  const ring = new THREE.Mesh(new THREE.BoxGeometry(w + 0.20, ht + 0.20, 0.07), _rustMat);
  ring.position.set(px, py, (skinZ - 0.02) * side);
  ring.rotation.copy(gash.rotation);
  ring.userData.isWreckDecoration = true; g.add(ring);
  // PEELED flap — inboard edge WELDED to the gash rim, gentle ~18° hinge so the far edge lifts off the
  // flank but never reaches sand. On a TINY wreck a lone flap reads as a dropped sheet → skip it (the
  // gash + ring + sub-voids + lip carry the breach).
  const tiny = radius < 0.85 || radius * partLength < 2.0;
  if (!tiny) {
    const flap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, ht * 0.6, 0.12), _rustMat);
    flap.position.set(px + w * 0.12, py - ht * 0.04, (skinZ + 0.05) * side);
    flap.rotation.set((h - 0.5) * 0.3, (h2 - 0.5) * 0.4, -0.32 * side);     // small hinge → stays attached
    flap.userData.isWreckDecoration = true; g.add(flap);
  }
  // NOTE — a dorsal "roof tear" plate was tried (C9 + C10 gate rounds 1-3) for an all-angle silhouette
  // break, but it persistently FLOATED above the crown on the corvette: a y≈r*1.55 cylinder estimate
  // overshoots the domed-corvette hull (it seated fine on the gunship cylinder), and it sat laterally
  // decoupled from the flank gash → a hovering slab no reseat could weld without a real per-variant Box3
  // crown. DROPPED: the flank breach (gash + ring + 2 sub-voids + flap + lip) reads as a strong ATTACHED
  // hole on every angle the adversarial gate checked, and the player circles the proud wreck in-world so
  // the flank breach is always seen.
  // Jagged torn-metal LIP at the gash rim — thick (rule 7), flush to the real flank, framing the hole.
  // Biased inboard (C10 gate r2 sev1) so its tip terminates within the gash silhouette, not over sand.
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.13, ht * 0.5, 0.13), _rustMat);
  lip.position.set(px - w * 0.38, py + ht * 0.12 * side, (skinZ + 0.05) * side);
  lip.rotation.set((h2 - 0.5) * 0.8, 0, (h - 0.5) * 0.9);
  lip.userData.isWreckDecoration = true; g.add(lip);
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
  // ACAZ T3 — seed the hull girth from the class so heavy classes are FAT (the size
  // ladder, not length-only). prevRadius carries the girth down the part chain; the 0.95
  // per-segment taper still applies so a long mega narrows toward the tail (fat-bodied
  // freighter read). Faceted hulls scale at fixed vertex count → no tri/draw cost.
  let prevRadius = 0.9 * (CLASS_GIRTH[cls] ?? 1.0);   // seed for the first part's interface
  for (const kind of recipe.parts) {
    const builder = pickPart(rand, kind, biome);
    const built = builder.build(rand, prevRadius, cls);
    built.mesh.position.x = cursor;
    // ACAZ T2D — crash-shear ENGINES: a drooped/canted engine module hanging off its
    // mount reads "torn loose in the crash" (not a parked 90° nozzle). Rotated about the
    // attach (local x=0); the small gap to the tail reads as battle damage. Gentle so
    // multi-engine clusters don't fly apart. Deterministic from cursor → no new rand.
    if (kind === 'engineModule') {
      // wreck-polish delta 3 (campaign 2026-06-18): SIGN-RANDOMIZE the droop (was always DOWN →
      // repetitive) + WIDEN it, so engines tear loose in varied directions; ~15% droop DRAMATICALLY
      // (a near-torn-off hang) with a wider cant. hash2-derived → ZERO rand (D208/D221-safe). Pure
      // rotation about the mount (local x=0) — no position offset, so the part layout can't overlap.
      const sign = hash2(cursor * 1.7, prevRadius * 0.6) < 0.5 ? -1 : 1;     // tears down OR up
      const torn = hash2(cursor * 2.9, prevRadius * 1.4) < 0.15;            // ~15% nearly torn off
      built.mesh.rotation.z = sign * (0.10 + hash2(cursor, prevRadius) * 0.26 + (torn ? 0.34 : 0)); // 6-21°, torn ~+20° more
      built.mesh.rotation.y = (hash2(prevRadius * 1.3, cursor) - 0.5) * (torn ? 1.0 : 0.5);          // wider cant when torn
    }
    root.add(built.mesh);
    placed.push({ built, startX: cursor });
    cursor += built.partLength;
    prevRadius = built.radius;
  }
  const totalLength = cursor;

  // Center the wreck on its position by shifting all parts -totalLength/2.
  root.position.x = 0;
  for (const child of root.children) child.position.x -= totalLength / 2;

  // ── ACAZ T2A — scale-anchor hatch+ladder: ONE per wreck (2 on heavy freighters),
  // on a SOLID-hull segment's clean lee flank. A per-WRECK gate (NOT per-segment) so
  // the human door reads as a single trusted size reference instead of a repeating
  // band (the adversarial-critique ship-blocker). Added BEFORE panel placement so
  // findSurfaceMounts treats it as an obstacle. Deterministic target pick + reused
  // lee side → ZERO new rand (panel stream unchanged, verify:placement stays 0 fails).
  // Eligible hosts: a solid flank, a FAT segment (≥0.7r — never a thin tail), and a flat
  // band tall enough to seat a door (≥0.7m). Prefer the host with the TALLEST band so the
  // flat plated box (band 1.3r → walk-up door) beats the chining cylinder (band 0.75r →
  // a lower access hatch); cylinders still host for broad fleet coverage, just shorter.
  const anchorable = placed.filter((p) =>
    p.built.anchorSurfZ !== undefined && p.built.radius >= 0.7 &&
    (p.built.anchorBandHi! - p.built.anchorBandLo!) >= 0.7,
  );
  if (anchorable.length > 0) {
    const ranked = [...anchorable].sort((a, b) => {
      const ba = a.built.anchorBandHi! - a.built.anchorBandLo!;
      const bb = b.built.anchorBandHi! - b.built.anchorBandLo!;
      return (bb - ba) || (b.built.partLength - a.built.partLength);
    });
    // Anchor count scales with hull LENGTH on the big freight classes so a 33m mega
    // gets 2-3 repeated human references (sells the length); everyone else gets 1.
    const nWant = (cls === 'mega_freighter' || cls === 'bulk_hauler')
      ? Math.max(1, Math.min(3, Math.round(totalLength / 9))) : 1;
    const targets: PlacedPart[] = [];
    for (const p of ranked) {
      if (targets.length >= nWant) break;
      // Keep anchors >4m apart so the doors don't cluster (count-legibility).
      if (targets.every((t) => Math.abs(p.startX - t.startX) > 4)) targets.push(p);
    }
    for (const t of targets) {
      addScaleAnchor(t.built.mesh, t.built.partLength, t.built.radius, t.built.anchorSurfZ!,
        t.built.anchorBandLo!, t.built.anchorBandHi!, t.built.anchorLeeSide ?? 1);
    }
  }

  // ── wreck-polish-bundle delta 1 (campaign 2026-06-18) — NON-AXIAL DORSAL MASS on the heavy
  // classes to break the length-axis "sausage" silhouette (§F/§G). ONE per wreck, on the FATTEST
  // mid hull body. Deterministic pick + addDorsalMass uses hash2 only → ZERO new rand, so the
  // panel stream below is byte-identical (verify:placement unchanged). Added BEFORE panels so
  // findSurfaceMounts sees it as an obstacle — but it sits dorsal; panels mount on the flanks.
  if (cls === 'mega_freighter' || cls === 'bulk_hauler' || cls === 'freighter') {
    const body = placed.slice(1, Math.max(1, placed.length - 1));   // skip cockpit + tail/engine
    const fat = body.filter((p) => p.built.radius >= 0.9);
    const pool = fat.length ? fat : body;
    if (pool.length) {
      // Seat the tower MID-HULL (not at an end) so the vertical mass crosses the length axis and
      // genuinely breaks the sausage — not a cap on one tip (round-2 silhouette fix). Among the fat
      // body parts, pick the one whose CENTRE is closest to the hull mid-span.
      const mid = totalLength / 2;
      const target = [...pool].sort((a, b) =>
        Math.abs((a.startX + a.built.partLength / 2) - mid) -
        Math.abs((b.startX + b.built.partLength / 2) - mid))[0];
      const maxR = Math.max(...placed.map((p) => p.built.radius));   // size the tower off the wreck BULK
      addDorsalMass(target.built.mesh, target.built.partLength, target.built.radius, maxR);
    }
  }

  // wreck-polish delta 4 — GUARANTEED visible trauma on the small proud military ships (corvette +
  // gunship sit nearly upright per the burial table + are the most-scrutinised, but the per-part breach
  // gate is probabilistic → one can roll up clean). ONE forced breach gash + sheared flap on a hull body
  // part. hash2-only → the panel rand stream is byte-identical (verify:placement unchanged). Added BEFORE
  // panels so findSurfaceMounts treats the proud gash as an obstacle (no panel welds over the hole).
  if (cls === 'corvette' || cls === 'gunship') {
    const body = placed.slice(1).filter((p) => p.built.radius >= 0.7);
    const pool = body.length ? body : placed.slice(1);
    if (pool.length) {
      // C9 read-polish (campaign C10): pick the LARGEST visible hull mass (radius × length), tie-break
      // toward mid-span — so the breach lands on the MAIN hull, not a forward/minor part (the C9
      // scattered-debris read). Deterministic (no rand).
      const mid = totalLength / 2;
      const target = [...pool].sort((a, b) => {
        const va = a.built.radius * a.built.partLength, vb = b.built.radius * b.built.partLength;
        return (vb - va) ||
          (Math.abs((a.startX + a.built.partLength / 2) - mid) - Math.abs((b.startX + b.built.partLength / 2) - mid));
      })[0];
      addForcedTrauma(target.built.mesh, target.built.partLength, target.built.radius);
    }
  }

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
    // ACAV Tier 3 — derive SHAPE from already-rolled values (zero new world-rand,
    // D208): engine hardware gets round bolted ports; small panels read as square
    // junction boxes; the rest stay rect hatches.
    const panelShape: PanelShape = !Tuning.SALVAGE_PANEL_SHAPES_ENABLED ? 'rect'
      : panelKind === 'engine_cluster' ? 'circle'
      : sr < Tuning.SALVAGE_PANEL_SCALE_SMALL_THRESHOLD ? 'square'
      : 'rect';
    // ACAV Tier 4 — derive the interior ARCHETYPE from already-rolled values (engine
    // hardware → mechanical/plumbing, cargo → junction, fuselage → electrical/avionics)
    // + a per-panel greeble seed (one fixed rand draw → still a fixed budget, D208).
    const greebleSeed = (rand() * 0x7fffffff) | 0;
    const panelArchetype: PanelArchetype | undefined = !Tuning.SALVAGE_PANEL_INTERIOR_V2 ? undefined
      : panelKind === 'engine_cluster' ? (sr < 0.5 ? 'mechanical' : 'plumbing')
      : panelKind === 'cargo_container' ? 'junction'
      : (sr < 0.5 ? 'electrical' : 'avionics');
    const panelOpts = { shape: panelShape, archetype: panelArchetype, rand: makeRng(greebleSeed) };
    const prior = placedOnPart.get(partMesh) ?? [];
    const halfX = Tuning.SALVAGE_PANEL_SIZE_X * scale * 0.5;
    const halfY = Tuning.SALVAGE_PANEL_SIZE_Y * scale * 0.5;
    // findSurfaceMounts reads the REAL hull surface (any shape) + a full quaternion
    // so the panel sits flush; it consumes exactly ONE rand (fixed budget, D208).
    // On a miss, fall back to the authored per-part anchor (yaw-based).
    const cand = findSurfaceMounts(partMesh, rand, prior, halfX, halfY);
    if (cand) {
      addAccessPanelOriented(partMesh, cand.localPos, cand.localQuat, scale, panelKind, panelOpts);
      prior.push({ x: cand.localPos.x, y: cand.localPos.y, z: cand.localPos.z });
    } else {
      const a = slot.built.panelAnchor;
      if (a) {
        addAccessPanel(partMesh, a.x, a.y, a.z, scale, a.faceYaw, panelKind, panelOpts);
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
    // ACBA — 7-way (scout removed per user feedback: read as lame/unrealistic). The
    // mid classes carry the bulk; mega_freighter (~25-40m) stays RARE so the field
    // isn't all giants. Scout's old 12% share folded mostly into corvette.
    if (r < 0.30) return 'corvette';
    if (r < 0.46) return 'gunship';
    if (r < 0.61) return 'freighter';
    if (r < 0.72) return 'science_vessel';
    if (r < 0.85) return 'bulk_hauler';
    if (r < 0.94) return 'orbital_pod_cluster';
    return 'mega_freighter';
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
  // ACAZ T2D/T3 — class-scaled half-burial, CLAMPED so ≥~50% of the wreck (and its top-
  // aligned scale anchors) stays proud — deeper burial would bury all the loot. Derived
  // from cls + a position hash → no new rand. flagship keeps its caller-authored buryY.
  let buryY: number;
  if (cls === 'flagship_engineBlock') {
    buryY = opts.buryY ?? 0.4;
  } else {
    group.updateMatrixWorld(true);
    const topY = new THREE.Box3().setFromObject(group).max.y;   // wreck height (base ≈ 0)
    const raw = (CLASS_BURY[cls] ?? (opts.buryY ?? 0.5)) * (0.9 + hash2(pos.x, pos.z) * 0.25);
    buryY = Math.min(raw, 0.5 * Math.max(0.4, topY));
  }
  group.position.y -= buryY;
  const yaw = rand() * Math.PI * 2;
  alignToTerrain(group, terrain, pos.x, pos.z, yaw, 1.5);
  // alignToTerrain sets the quaternion from terrain normal + yaw. ACAZ T2D/T3 — compose a
  // class crash LIST (roll about the wreck's local long axis +X) on top. ALWAYS fires at
  // ≥55% of the class max (the old sin() gate zeroed most wrecks); deterministic per site
  // (hash → no new rand). flagship_engineBlock stays level (authored hero pose).
  if (cls !== 'flagship_engineBlock') {
    const listMax = CLASS_LIST[cls] ?? 0.1;
    const listMag = listMax * (0.55 + 0.45 * hash2(pos.x, pos.z));
    group.rotateX(hash2(pos.z, pos.x) < 0.5 ? listMag : -listMag);
  }

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
  // Infinite Sands S2 — stash the body (mirrors poiAssembler) so a RUNTIME
  // caller (chunk streaming) can remove it on unload; boot callers ignore it.
  group.userData.poiBody = attachCompoundCollider(world, group);

  // ACAP W4 — shed a crash-debris fan onto a random impact flank, added to the
  // group BEFORE the merge so it folds in (≈0 draw cost). Debris is cosmetic →
  // added after the collider pass (no collider). Placed at local-y = buryY so it
  // rests on the sand after the half-burial sink.
  if (rand() < 0.6) {
    const dsz = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
    addDebrisFan(group, dsz.x, dsz.z, buryY, rand, rand() < 0.5 ? 1 : -1);
  }

  // ACAY 1B — re-skin the wreck to its CLASS palette (distinct colour identity per
  // class). MUST run before the merge (which groups by material) + after debris (so
  // shed plates re-skin too). Keyed off `cls` (no rand → D208-safe). Memoised, so a
  // whole fleet of one class shares one material set (0 extra shader programs).
  if (cls !== 'flagship_engineBlock') {
    // ACBA — the swap (incl. the cloned DoubleSide bell-flare remap) now lives in the
    // shared reskinToBucket so the POI archetypes re-skin identically.
    reskinToBucket(group, getClassHullMats(cls));
  }

  // ACAZ T2A — record scale-anchor positions in GROUP-LOCAL coords BEFORE the merge
  // folds the named groups away, so the inspection harness (rig-shot --forceanchor) can
  // aim the camera straight at a hatch. Local (not world) so it survives the rig's
  // later re-orientation. Cheap metadata; harmless/unused in production.
  const anchorLocal: number[] = [];
  group.updateMatrixWorld(true);
  group.traverse((o) => {
    if (o.name === '__scaleAnchor') {
      const p = new THREE.Vector3(); o.getWorldPosition(p);
      group.worldToLocal(p);   // group-local → stable under later re-rotation
      anchorLocal.push(p.x, p.y, p.z);
    }
  });
  if (anchorLocal.length) group.userData.anchorLocalPositions = anchorLocal;

  // T6 — merge the static, non-interactive meshes by material into 1-few meshes
  // (the draw-call win). Salvage panels stay live (animated doors). Per-part
  // collision already captured above.
  mergeStaticByMaterial(group);

  // T4 sand drift REMOVED (user 2026-06-18 — bare terrain). The makeSandMound CALL is kept
  // (mesh discarded) to preserve the seeded `rand` stream byte-for-byte — panel registration
  // BELOW draws rand, so dropping these draws would desync it + regress the bury audit
  // (D208/D221). Reversible: re-wrap in `(opts.parent ?? scene).add(...)`.
  {
    const sz = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
    const radius = Math.min(9, Math.max(2.5, Math.max(sz.x, sz.z) * 0.5));
    const windDir = new THREE.Vector2(0.85, 0.52).normalize();
    makeSandMound(terrain, pos.x, pos.z, windDir, radius, rand);   // rand-preserving no-op (mesh discarded)
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
      cls === 'mega_freighter' ? 'cargo_container' : // ACAY — heavy hauler → cargo lottery palette
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
      // M11 ⓐ (C61) — a culled panel (buried below sand or occluded by its own hull)
      // was left VISIBLE but untagged → it read as a panel that won't open (the user's
      // "some panels not openable" bug). Hide the whole panel subtree so a culled panel
      // is simply not there, never a dead tease. (visible=false propagates to the door +
      // interior children at render; also hidden explicitly in case they're siblings.)
      s.panel.visible = false;
      const door = s.panel.userData.panelDoor as THREE.Object3D | undefined;
      if (door) door.visible = false;
      const interior = s.panel.userData.panelInterior as THREE.Object3D | undefined;
      if (interior) interior.visible = false;
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
