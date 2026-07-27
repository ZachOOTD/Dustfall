// DEEPER cycle 9 — CAVE KINDS. Distinct parameter sets over the SAME generator, so two caves read
// as different PLACES rather than as two rolls of one place.
//
//   "Cave kinds — distinct parameter sets over the same generator so caves read as different
//    places: a tight salvage warren, a vaulted fungal cavern, a flooded cave (leans on cycle 6),
//    a collapsed shaft. Not new code paths — a kind table."          — the DEEPER charter, row 8
//
// ── WHAT THIS FILE IS, AND WHAT IT DELIBERATELY IS NOT ──────────────────────────────────────────
// It is ONE table of numbers and one seed-pure assignment hash. It is NOT a set of generator
// branches: `caveGen.ts` still runs exactly one algorithm (descending trunk → forced hall → egg at
// the end → side pockets → cover/slope passes → SDF → dressing), and every kind is that algorithm
// fed different constants. Two capabilities are genuinely NEW (rubble heaps, scrap scatter) and both
// are built as GENERAL capabilities with a per-kind density whose CANONICAL VALUE IS ZERO — so the
// code path is shared and the canonical cave is bit-identical to what shipped in cycle 8.
//
// ── THE CANONICAL CAVE IS NOT A KIND ────────────────────────────────────────────────────────────
// `canonical` is the parameter set that IS `tuning.ts` — every field reads straight off `Tuning`,
// with an EMPTY override object. That is not decoration: the origin/egg cave builds with it, and the
// origin-parity digests (108af91c / ff8309a8) are a hard campaign gate. If a canonical field ever
// stops being a literal Tuning read, the origin cave moves and the gate goes red — which is exactly
// the alarm we want. `canonical` also stays in the weighted MIX, so the cave a player already knows
// keeps appearing in the world beside the four new reads.
//
// ── THE SAFETY FLOORS ARE NOT NEGOTIABLE, AND THEY ARE MACHINE-CHECKED ──────────────────────────
// Three numbers in here are scar tissue and a kind may not spend them (`assertCaveKindTable` throws
// in dev if one does):
//   · CORRIDOR HALF-WIDTHS. `CAVE_GEN_SQUEEZE_HALF_W` went 1.55 → 1.85 and `CAVE_GEN_GALLERY_HALF_W`
//     went 2.3 → 2.8 in UNDERWORLD cycle 3 because the KCC WEDGED against a corridor wall on a
//     climbing backtrack at the old values. "A tight warren" is bought with corridor LENGTH, corridor
//     HEIGHT, chamber size and squeeze frequency — never by re-spending the wedge margin.
//   · THE CORRIDOR GRADE. `CAVE_GEN_MAX_SLOPE` 26° sits under the march gate's 32° ceiling with the
//     displacement margin already eaten. The "collapsed shaft" is vertical because it is DEEP and
//     its rooms are TALL over a LONG trunk — not because its ramps are steeper. Every kind holds 26.
//   · HEADROOM. Corridor clear height ≥ 2.5m and chamber height ≥ corridor height + 1.0m (the mouth
//     must fit inside the chamber's dome), against a 2.0m gate floor.
//
// Determinism (D290): the kind is a pure function of the site descriptor's own per-cell RNG stream,
// drawn inside `caveSiteInCell`'s FIXED DRAW BUDGET and AFTER the site's generation seed, so adding
// it moved no site by a millimetre and the cycle-8 placement digests are unchanged.

import { Tuning } from '../config/tuning.ts';

export type CaveKind = 'canonical' | 'warren' | 'fungal' | 'flooded' | 'shaft';

/** Declaration order is the WEIGHTED-PICK ORDER — changing it re-rolls every cave in the world. */
export const CAVE_KIND_LIST: readonly CaveKind[] = ['canonical', 'warren', 'fungal', 'flooded', 'shaft'] as const;

/** Every generator constant a kind is allowed to move. Anything NOT here is world-physics or scar
 *  tissue and is shared by every cave (displacement amplitudes, SDF voxel, sibling-angle rejection,
 *  corridor clearance, min cover, the entrance hall — which is welded to the crevice hand-off). */
export interface CaveKindParams {
  // ── the room graph ──
  chambersMin: number;
  chambersMax: number;
  trunkStepsMin: number;
  trunkStepsMax: number;
  /** m below the surface the egg-chamber floor targets. */
  depthMin: number;
  depthMax: number;
  /** ° — corridor floor-grade ceiling. SAFETY FLOOR: every kind holds Tuning.CAVE_GEN_MAX_SLOPE. */
  maxSlope: number;
  /** m — minimum horizontal CLEAR span of a corridor (shell-to-shell). Longer = a real walk between
   *  rooms; it only binds when it exceeds drop/tan(grade), which is how the warren gets its tunnels. */
  corridorRunMin: number;
  /** m — max descent on a side-branch corridor. */
  branchDropMax: number;
  /** side-pocket placement attempts before the generator settles for fewer chambers. Kinds that ask
   *  for MORE rooms need more tries against the same rejection ladder; canonical keeps 120 so its
   *  loop is bit-identical. */
  pocketAttempts: number;

  // ── room sizes ──
  hallRx: number;
  hallH: number;
  pocketRxMin: number;
  pocketRxMax: number;
  pocketHMin: number;
  pocketHMax: number;
  eggRx: number;
  eggH: number;

  // ── corridors ──
  squeezeHalfW: number;
  squeezeH: number;
  galleryHalfW: number;
  galleryH: number;
  squeezeChance: number;

  // ── dressing ──
  /** × on the speleothem counts (stalagmites / columns / stalactites / nubbins). */
  speleoDensity: number;
  fungiChambersMin: number;
  fungiChambersMax: number;
  fungiClusterMin: number;
  fungiClusterMax: number;
  fungiWallChance: number;
  /** Rubble heaps per chamber (a GENERAL capability — canonical 0). Collider-bearing, placed on the
   *  speleothem clearance discipline, so they behave exactly like a stalagmite to the KCC. */
  rubblePerChamber: number;
  /** Loose `scrap` PICKUPS scattered on cave floors (a general capability — canonical 0). No loot
   *  table, no new ItemId, no drop rate: the plain scrap pickup the whole world already uses. */
  scrapPerCave: number;

  // ── water (cycle 6) ──
  poolChambersMin: number;
  poolChambersMax: number;
  poolRFrac: number;
  poolRMin: number;
  poolRMax: number;
  poolCenterFracMin: number;
  poolCenterFracMax: number;

  // ── audio ──
  /** × on the drip interval — <1 is a WETTER cave (drips more often). */
  dripIntervalScale: number;

  // ── what the WALK GATE is allowed to expect ──
  //  The march asserts topology against these, not against a hardcoded 8-11 / 25-40m. They are
  //  declared per kind (not derived) so the gate is asserting an INTENT, and `assertCaveKindTable`
  //  proves the intent actually contains the generator's own range — a kind cannot widen its gate
  //  without widening it honestly.
  gateChambersMin: number;
  gateChambersMax: number;
  gateDepthMin: number;
  gateDepthMax: number;
}

/** The canonical parameter set — every field a literal `Tuning` read. See the header: if this stops
 *  being true, the origin cave moves and the origin-parity digest gate goes red. */
export function canonicalCaveParams(): CaveKindParams {
  const T = Tuning;
  return {
    chambersMin: T.CAVE_GEN_CHAMBERS_MIN,
    chambersMax: T.CAVE_GEN_CHAMBERS_MAX,
    trunkStepsMin: T.CAVE_GEN_TRUNK_STEPS_MIN,
    trunkStepsMax: T.CAVE_GEN_TRUNK_STEPS_MAX,
    depthMin: T.CAVE_GEN_DEPTH_MIN,
    depthMax: T.CAVE_GEN_DEPTH_MAX,
    maxSlope: T.CAVE_GEN_MAX_SLOPE,
    corridorRunMin: T.CAVE_GEN_CORRIDOR_RUN_MIN,
    branchDropMax: T.CAVE_GEN_BRANCH_DROP_MAX,
    pocketAttempts: T.CAVE_GEN_POCKET_ATTEMPTS,
    hallRx: T.CAVE_GEN_HALL_RX,
    hallH: T.CAVE_GEN_HALL_H,
    pocketRxMin: T.CAVE_GEN_POCKET_RX_MIN,
    pocketRxMax: T.CAVE_GEN_POCKET_RX_MAX,
    pocketHMin: T.CAVE_GEN_POCKET_H_MIN,
    pocketHMax: T.CAVE_GEN_POCKET_H_MAX,
    eggRx: T.CAVE_GEN_EGG_RX,
    eggH: T.CAVE_GEN_EGG_H,
    squeezeHalfW: T.CAVE_GEN_SQUEEZE_HALF_W,
    squeezeH: T.CAVE_GEN_SQUEEZE_H,
    galleryHalfW: T.CAVE_GEN_GALLERY_HALF_W,
    galleryH: T.CAVE_GEN_GALLERY_H,
    squeezeChance: T.CAVE_GEN_SQUEEZE_CHANCE,
    speleoDensity: 1,
    fungiChambersMin: T.CAVE_FUNGI_CHAMBERS_MIN,
    fungiChambersMax: T.CAVE_FUNGI_CHAMBERS_MAX,
    fungiClusterMin: T.CAVE_FUNGI_CLUSTER_MIN,
    fungiClusterMax: T.CAVE_FUNGI_CLUSTER_MAX,
    fungiWallChance: T.CAVE_FUNGI_WALL_CHANCE,
    rubblePerChamber: 0,
    scrapPerCave: 0,
    poolChambersMin: T.CAVE_POOL_CHAMBERS_MIN,
    poolChambersMax: T.CAVE_POOL_CHAMBERS_MAX,
    poolRFrac: T.CAVE_POOL_R_FRAC,
    poolRMin: T.CAVE_POOL_R_MIN,
    poolRMax: T.CAVE_POOL_R_MAX,
    poolCenterFracMin: T.CAVE_POOL_CENTER_FRAC_MIN,
    poolCenterFracMax: T.CAVE_POOL_CENTER_FRAC_MAX,
    dripIntervalScale: 1,
    gateChambersMin: 8,
    gateChambersMax: 11,
    gateDepthMin: 25,
    gateDepthMax: 40,
  };
}

/** ── THE TABLE. Each kind is a set of OVERRIDES over `canonicalCaveParams()`. ───────────────────
 *
 *  What a player should notice in five seconds, per kind — the design target every number below is
 *  aimed at. If a shipped kind does not read this way in a torch-lit frame, the numbers are wrong,
 *  not the intent:
 *
 *   · warren  — "this place is a WARREN": the ceiling is close, the tunnels are long and mostly
 *               squeezes, there are doorways everywhere, and there is man-made SCRAP on the floor.
 *   · fungal  — "this is a CATHEDRAL, and it is alive": one huge vaulted room after another, the
 *               torch never reaches the ceiling, and teal bioluminescence is everywhere you look.
 *   · flooded — "this cave is DROWNED": black standing water in nearly every room, you wade through
 *               the middle of it, and the drips never stop.
 *   · shaft   — "this goes DOWN": rooms that are tall and narrow instead of wide, a trunk that keeps
 *               descending long past where a normal cave stops, and rubble heaps under the ceilings.
 */
export const CAVE_KIND_OVERRIDES: Record<CaveKind, Partial<CaveKindParams>> = {
  // The origin/egg cave. EMPTY BY CONTRACT — see the header.
  canonical: {},

  // ── 1. TIGHT SALVAGE WARREN ────────────────────────────────────────────────────────────────
  //   MANY small rooms strung on LONG, mostly-squeeze corridors with low ceilings. The corridor
  //   HALF-WIDTHS are untouched (the wedge margin, see the header) — the tightness is vertical and
  //   longitudinal, which is what a player actually reads as "tight" anyway: a 2.6m ceiling over a
  //   22m tunnel feels far more cramped than 30cm off the width.
  warren: {
    chambersMin: 12, chambersMax: 15,
    pocketAttempts: 300,                 // 15 small rooms against the same rejection ladder needs tries
    depthMin: 24, depthMax: 32,          // a shallow salvage layer, not a descent
    corridorRunMin: 14.0,                // BINDS (canonical 8.0 is below drop/tan and almost never does)
    branchDropMax: 3.0,
    hallRx: 5.6, hallH: 5.0,             // no cathedral in a warren
    pocketRxMin: 2.6, pocketRxMax: 3.5,
    pocketHMin: 4.0, pocketHMax: 4.8,
    eggRx: 6.6, eggH: 6.0,               // still the biggest room (the gate asserts it), but modest
    squeezeH: 2.6, galleryH: 3.0,        // cramped ceilings (gate floor 2.0m; assert floor 2.5m)
    squeezeChance: 0.88,                 // nearly every corridor is a squeeze
    speleoDensity: 0.7,                  // less dripstone: this is a dry, broken-up rock
    fungiChambersMin: 1, fungiChambersMax: 2,
    fungiClusterMin: 1, fungiClusterMax: 2,
    fungiWallChance: 0.15,
    scrapPerCave: 6,                     // ⚑ FLAGGED FOR ZACH — the only loot number this cycle sets
    poolChambersMin: 1, poolChambersMax: 1,
    poolRFrac: 0.24, poolRMax: 3.4,
    dripIntervalScale: 1.25,             // drier
    gateChambersMin: 10, gateChambersMax: 16,
    gateDepthMin: 20, gateDepthMax: 38,
  },

  // ── 2. VAULTED FUNGAL CAVERN ───────────────────────────────────────────────────────────────
  //   FEWER, far LARGER, far TALLER rooms joined by wide galleries, and fungi in every one of them.
  //   The egg chamber goes from a 19m dome to a 24m one; a pocket here is bigger than the canonical
  //   cave's great hall.
  fungal: {
    chambersMin: 6, chambersMax: 8,
    trunkStepsMin: 3, trunkStepsMax: 4,
    pocketAttempts: 200,
    depthMin: 30, depthMax: 40,
    corridorRunMin: 9.0,
    branchDropMax: 3.5,
    hallRx: 10.5, hallH: 9.5,
    pocketRxMin: 5.0, pocketRxMax: 6.8,
    pocketHMin: 7.0, pocketHMax: 9.0,
    eggRx: 12.0, eggH: 11.5,
    squeezeH: 3.0,
    galleryHalfW: 3.3, galleryH: 4.4,    // ≥ canonical: wider is always safe for the KCC
    squeezeChance: 0.15,                 // galleries, not crawls
    speleoDensity: 1.15,
    fungiChambersMin: 6, fungiChambersMax: 8,   // clamped to the chamber count → effectively ALL of them
    fungiClusterMin: 4, fungiClusterMax: 7,
    fungiWallChance: 0.9,
    poolChambersMin: 2, poolChambersMax: 3,
    poolRFrac: 0.34, poolRMax: 6.0,
    gateChambersMin: 5, gateChambersMax: 9,
    gateDepthMin: 25, gateDepthMax: 46,
  },

  // ── 3. FLOODED CAVE ────────────────────────────────────────────────────────────────────────
  //   Cycle 6's water, at maximum coverage: a pool in every room that can hold one, each roughly
  //   1.7× the canonical radius. STILL SHALLOW-WALKABLE — `CAVE_POOL_DEPTH_M` is NOT a kind
  //   parameter, so the water surface stays 26cm over a floor the collider still is (rule 9), the
  //   march wades straight through it, and there is no swimming in this campaign.
  //   Rooms are slightly wider and flatter than canonical (water pools in broad floors, not in
  //   vertical shafts) and the drip bed runs at double rate.
  flooded: {
    depthMin: 30, depthMax: 40,
    hallRx: 8.5, hallH: 6.0,
    pocketRxMin: 3.4, pocketRxMax: 5.0,
    pocketHMin: 4.6, pocketHMax: 5.6,
    eggH: 8.0,
    squeezeChance: 0.32,
    poolChambersMin: 5, poolChambersMax: 9,     // clamped to the rooms that qualify → nearly all of them
    poolRFrac: 0.52, poolRMin: 2.2, poolRMax: 7.2,
    poolCenterFracMin: 0.20,                    // a bigger pool needs to sit nearer the centre to fit
    poolCenterFracMax: 0.56,
    fungiChambersMin: 3, fungiChambersMax: 4,   // wet rock grows things
    fungiWallChance: 0.55,
    dripIntervalScale: 0.5,                     // the wet-audio bias: twice the drips, and cycle 6's
    gateDepthMin: 26, gateDepthMax: 46,         //   pool-proximity bed does the rest on its own
  },

  // ── 4. COLLAPSED SHAFT ─────────────────────────────────────────────────────────────────────
  //   DEPTH, not grade. A 6-7 step trunk descending to 42-52m (canonical: 4-5 steps to 28-38m) with
  //   few side rooms, and every room TALL and NARROW instead of wide and domed — the silhouette of
  //   a collapsed shaft rather than a chamber. Rubble heaps under the ceilings finish the read.
  //   ⚠ `maxSlope` is NOT raised. See the header: the ramps are already at the KCC margin, so
  //     verticality is bought with depth and room proportions, by construction.
  shaft: {
    chambersMin: 6, chambersMax: 8,
    trunkStepsMin: 6, trunkStepsMax: 7,
    pocketAttempts: 200,
    depthMin: 42, depthMax: 52,
    branchDropMax: 6.0,
    hallRx: 6.5, hallH: 8.5,
    pocketRxMin: 3.0, pocketRxMax: 4.0,
    pocketHMin: 6.5, pocketHMax: 8.5,           // tall + narrow = a shaft, not a room
    eggRx: 8.0, eggH: 10.5,
    squeezeH: 3.0,
    galleryHalfW: 2.8, galleryH: 3.6,
    squeezeChance: 0.5,
    speleoDensity: 0.75,                        // the ceiling collapsed; the dripstone went with it
    rubblePerChamber: 2,
    fungiChambersMin: 1, fungiChambersMax: 2,
    fungiClusterMin: 1, fungiClusterMax: 3,
    fungiWallChance: 0.2,
    poolChambersMin: 1, poolChambersMax: 2,
    dripIntervalScale: 0.85,
    gateChambersMin: 5, gateChambersMax: 9,
    gateDepthMin: 36, gateDepthMax: 60,
  },
};

/** The full parameter set for a kind. Computed fresh each call (never memoized — several gates set
 *  `Tuning` fields at runtime, and a cached canonical would then be a lie). */
export function caveKindParams(kind: CaveKind): CaveKindParams {
  return { ...canonicalCaveParams(), ...CAVE_KIND_OVERRIDES[kind] };
}

/** The weight table, normalized. Weights live in `tuning.ts` because they are the dial Zach turns. */
export function caveKindWeights(): Record<CaveKind, number> {
  const w = Tuning.CAVE_KIND_WEIGHTS as Record<CaveKind, number>;
  return { canonical: w.canonical, warren: w.warren, fungal: w.fungal, flooded: w.flooded, shaft: w.shaft };
}

/** Weighted pick from a uniform roll in [0,1). Pure, total, and stable in `CAVE_KIND_LIST` order —
 *  reordering that list or changing a weight re-rolls every cave in the world, which is intended
 *  (it is a world-generation dial) and is why both live in exactly one place. */
export function pickCaveKind(u: number): CaveKind {
  const w = caveKindWeights();
  let total = 0;
  for (const k of CAVE_KIND_LIST) total += Math.max(0, w[k]);
  if (!(total > 0)) return 'canonical';
  let acc = 0;
  const t = Math.min(0.999999, Math.max(0, u)) * total;
  for (const k of CAVE_KIND_LIST) {
    acc += Math.max(0, w[k]);
    if (t < acc) return k;
  }
  return CAVE_KIND_LIST[CAVE_KIND_LIST.length - 1];
}

/** ── THE MACHINE CHECK ON THE TABLE ITSELF (dev-only, runs at module load). ──────────────────────
 *
 *  Every rule here is a failure this project has already paid for once. A kind that violates one
 *  would produce a cave that BUILDS, renders, and passes every cheap check — and then wedges a
 *  player in a corridor 4km from spawn where nobody is looking. The alternative to this function is
 *  a paragraph of prose asking the next author to be careful, and the campaign's own lesson is that
 *  prose rules recur and machine gates do not. */
export function assertCaveKindTable(): void {
  const T = Tuning;
  const bad: string[] = [];
  for (const kind of CAVE_KIND_LIST) {
    const p = caveKindParams(kind);
    const at = (m: string): void => { bad.push(`${kind}: ${m}`); };
    // — the three scar-tissue floors —
    if (p.maxSlope > T.CAVE_GEN_MAX_SLOPE)
      at(`maxSlope ${p.maxSlope}° > the proven ceiling ${T.CAVE_GEN_MAX_SLOPE}° — the corridor grade already sits at the KCC margin under the march gate's 32°; buy verticality with depth and room height instead`);
    if (p.squeezeHalfW < T.CAVE_GEN_SQUEEZE_HALF_W)
      at(`squeezeHalfW ${p.squeezeHalfW} < ${T.CAVE_GEN_SQUEEZE_HALF_W} — UNDERWORLD cycle 3 raised this from 1.55 because the KCC wedged on a climbing backtrack`);
    if (p.galleryHalfW < T.CAVE_GEN_GALLERY_HALF_W)
      at(`galleryHalfW ${p.galleryHalfW} < ${T.CAVE_GEN_GALLERY_HALF_W} — UNDERWORLD cycle 3 raised this from 2.3 for the same wedge`);
    // — headroom, against the gate's 2.0m floor with a real margin —
    if (p.squeezeH < 2.5) at(`squeezeH ${p.squeezeH}m < 2.5m (the march fails under 2.0m and displacement eats the rest)`);
    if (p.galleryH < 2.5) at(`galleryH ${p.galleryH}m < 2.5m`);
    // — a corridor mouth has to fit inside the chamber it opens into —
    const tallestCorridor = Math.max(p.squeezeH, p.galleryH);
    if (p.pocketHMin < tallestCorridor + 1.0)
      at(`pocketHMin ${p.pocketHMin}m < tallest corridor ${tallestCorridor}m + 1.0m — corridor mouths would not clear the chamber dome`);
    if (p.hallH < tallestCorridor + 1.0) at(`hallH ${p.hallH}m < tallest corridor + 1.0m`);
    if (p.eggH < tallestCorridor + 1.0) at(`eggH ${p.eggH}m < tallest corridor + 1.0m`);
    // — the egg chamber is the largest room, which the march asserts on EVERY kind. The trunk's
    //   ordinary chambers reach pocketRxMax + 1.2 (see generateCaveGraph), so that is the real bar.
    if (!(p.eggRx > p.hallRx)) at(`eggRx ${p.eggRx} must exceed hallRx ${p.hallRx} (the march asserts the egg is the largest chamber)`);
    if (!(p.eggRx > p.pocketRxMax + 1.2)) at(`eggRx ${p.eggRx} must exceed the largest trunk pocket (pocketRxMax + 1.2 = ${(p.pocketRxMax + 1.2).toFixed(1)})`);
    if (!(p.pocketRxMax > p.pocketRxMin)) at('pocketRxMax must exceed pocketRxMin');
    if (!(p.pocketHMax >= p.pocketHMin)) at('pocketHMax must be ≥ pocketHMin');
    if (!(p.chambersMax >= p.chambersMin)) at('chambersMax must be ≥ chambersMin');
    if (!(p.depthMax > p.depthMin)) at('depthMax must exceed depthMin');
    // — the trunk must fit the depth: every trunk corridor still has to satisfy the grade, and the
    //   entrance junction is ~CREVICE_DEPTH down, so the remaining descent is split over the steps —
    if (p.trunkStepsMin < 2) at('trunkStepsMin < 2 — the tree needs a hall and an egg chamber');
    // — the declared GATE ENVELOPE must actually contain what the generator can emit —
    if (p.gateChambersMin > p.chambersMin) at(`gateChambersMin ${p.gateChambersMin} > chambersMin ${p.chambersMin} — the gate would fail its own generator`);
    if (p.gateChambersMax < p.chambersMax) at(`gateChambersMax ${p.gateChambersMax} < chambersMax ${p.chambersMax}`);
    if (p.gateDepthMin > p.depthMin) at(`gateDepthMin ${p.gateDepthMin} > depthMin ${p.depthMin}`);
    if (p.gateDepthMax < p.depthMax) at(`gateDepthMax ${p.gateDepthMax} < depthMax ${p.depthMax}`);
    // — water stays wadeable: the depth is not a kind parameter, but a kind CAN starve the placer —
    if (p.poolChambersMin < 1) at('poolChambersMin < 1 — every cave has water somewhere (cycle 6)');
    if (p.poolCenterFracMin >= p.poolCenterFracMax) at('poolCenterFracMin must be < poolCenterFracMax');
    if (p.scrapPerCave < 0 || p.rubblePerChamber < 0) at('negative dressing density');
  }
  // — canonical must be EXACTLY tuning, or the origin cave has silently moved —
  if (Object.keys(CAVE_KIND_OVERRIDES.canonical).length !== 0)
    bad.push('canonical: the override object must stay EMPTY — the origin/egg cave builds with it and origin parity (108af91c/ff8309a8) is a hard campaign gate');
  // — the mix: no kind may be unreachable, and none may dominate —
  const w = caveKindWeights();
  let tot = 0;
  for (const k of CAVE_KIND_LIST) {
    if (!(w[k] > 0)) bad.push(`weights: '${k}' has weight ${w[k]} — a kind nobody can meet is dead code, not a rare find`);
    tot += Math.max(0, w[k]);
  }
  for (const k of CAVE_KIND_LIST) {
    if (w[k] / tot > 0.5) bad.push(`weights: '${k}' takes ${(100 * w[k] / tot).toFixed(0)}% of the mix — the world would read as one kind`);
  }
  if (bad.length) {
    throw new Error('[caveKinds] THE KIND TABLE VIOLATES ITS OWN SAFETY CONTRACT:\n  ' + bad.join('\n  '));
  }
}

if (import.meta.env?.DEV) assertCaveKindTable();
