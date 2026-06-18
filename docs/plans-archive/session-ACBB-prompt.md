# Session ACBB — Kickoff Brief: FINISH THE WRECK ARC (long overnight)

> Planned 2026-06-18 with the user. Lane chosen: **finish the ACBA 5-archetype
> wreck system** (cohesion + safety + seating + perf), autonomous. Scope locked at
> **Tiers 1–5 + a polish bucket** — the SAFE finish: **keep BOTH the legacy linear
> ship AND the socket `derelict`** (zero regression). Legacy-ship retirement / share
> → 1.0 was explicitly DEFERRED (the architectural-risk Tier 6 — do NOT attempt it).

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now" (the POI variety overhaul).
2. `src/world/poiArchetypes.ts` — the grammar + the 5 archetypes + biome weights (the
   thing you're finishing). **Note:** D233 already replaced the upright "tank farm" with
   a single toppled `wrecked_tank`; `assembleTankCluster`/`pipeStrut` are GONE — backlog
   §G's "wire pipeStrut" + "tank_cluster terracotta" items are STALE, re-grounded below.
3. `src/world/poiAssembler.ts` (`placeProcgenPOI` pipeline) + `poiComponents.ts`
   (components + `mate()` + declared `ColliderSpec` — `phash`-only) + `src/physics/bodies.ts`
   `attachDeclaredColliders`.
4. `docs/backlog.md` §F + §G (the deferred sev-2/3 — the source list for these tiers).
5. `docs/decisions.md` tail — D221-D233 (materials buckets, declared colliders, terrain
   cull, the tank rework).

## Housekeeping FIRST
- **Resolve the uncommitted WIP** (`tuning.ts`, `raider.ts`, `decisions.md`,
  `decisions-archive.md`, `package.json`) — commit or stash so the overnight starts clean.

## What's already built (the thing you're finishing)
5 archetypes + the legacy ship, pervasive at `PROCGEN_COMPOSITE_SHARE`=0.85 across ALL
biomes: **satellite** (foil bus + crash-banked solar wings + dishes + hatch),
**wrecked_tank** (one tank toppled + ripped open + half-buried, buryFrac 0.57, D233),
**debris_field** (scattered plates/struts + lootable chunk), **hollow_husk** (gutted
open-top shell + ribs), **derelict** (socket-mated nose+barrel+engine → linear /
wide-body-outrigger / stacked-tower). Collision is DECLARED (exact primitives +
convex-hull). Baseline: tsc clean, `verify:placement` 0 occlusion + 0 terrain ×5 seeds,
field drawCalls 839 / programs 67, no save bump.

## The owed thing (NOT overnight-able — leave it for an attended session)
The in-world WALK-TEST of felt collision/variety/seating (`npm run dev`, eyes-only) is
still owed and CANNOT be claimed from a headless run. Don't mark it done; everything
below is headless / rig-shot verifiable instead.

## Tiers (scope-cut from the BOTTOM; each independently shippable)

### Tier 1 — Weathering cohesion (biggest visual lever, lowest risk — material only)
- Per-bucket HUE-identity rebalance so identity survives the desert tint (D224 = identity
  via LIGHTNESS, not clashing hue).
- **Fleet palette cohesion**: pull the saturated accents (satellite navy-slate wings,
  tank terracotta) toward the warm hull mid-value band → reads as ONE weather-system.
- **Tank steel gradient** (re-grounded §G): a vertical cylinder fires the ox channels
  everywhere → terracotta/ceramic; give the tank a lower-ox / more-dust-chalk profile so
  the flank shows a top→bottom steel value gradient (cooler up top).
- **Up-close chroma** (§F): oxide more orange, seam-rust lifted out of shadow, gravity
  drips rust-coloured + seam-gated.
- **Satellite** (§G): wings read dark at distance; bus (cool) vs gold foil incoherent →
  warmer bus bucket or more foil coverage; status-LED sub-pixel (enlarge / add a bezel).
- Verify: `rig-shot --archetype=satellite|wrecked_tank|debris_field` + `wreck-yard` framing.

### Tier 2 — Sand integration ("swallowed by a living dune") — seating realism
- **Banking drift**: `makeSandMound` for the tank pad / satellite base doesn't visibly
  bank (lands BESIDE the structure) → raise mound height + radius ≥ footprint + ~1.5m so
  every base meets the sand as a drift, not a clean seam. Apply to tank/satellite/husk/derelict.
- **wrecked_tank** (§G): bank sand UP the lower flank (assembler-seated drift — a
  component-baked drift sinks with the burial) + sand TONGUES through the torn mouth/breaches
  + spilled-debris fragments seated on `terrain.heightAt` IN THE ASSEMBLER (component-baked
  chunks drag under after the deep sink/list).
- **debris_field** (§G): scorch-ring / disturbed-sand disc under the scatter centre (one
  impact footprint readable at yard distance).
- DETERMINISM: any new variation must be `phash`-derived, NOT `rand` (D221). Re-run
  `verify:placement` (0 occlusion + 0 terrain ×5 seeds) after.

### Tier 3 — Collision safety net + the §E dish bug (deterministic, can't-fail fodder)
- Build the formal **COLLIDER-AUDIT** harness (§G): a headless gate asserting each POI's
  declared collider-union ⊇ its visual bbox, ×seeds ×archetypes. Model on
  `scripts/verify-placement.mjs` + add an `npm run verify:colliders` (and fold into
  `verify:all`). The ACBA critique found 3 author-error mismatches BY EYE — this catches
  them by gate.
- Fix what it catches. Known: **satellite dish full collider** (§E bug — currently
  partial/walkthrough).

### Tier 4 — Per-archetype detail + silhouette (protected by Tier 3's audit)
- **Husk** (§G): more exterior detail + clearer hollow read from low SIDE angles + true
  enterability (floor plane + remove the bore obstruction) in a dedicated pass.
- **Derelict** (§G): refine the wide-body outriggers (currently perpendicular barrels →
  try parallel twin-hulls or angled sponsons) + exterior detail.
- **Break the "sausage"** (§F): one non-axial mass on the heavy ship/derelict (dorsal
  superstructure / sponsons / bridge tower) to break the length-axis silhouette.
- **Engine droop** (§F): sign-randomize + widen (currently always down-and-one-way);
  ~15% fully detach the nozzle off its mount.
- Re-run `verify:placement` + the new `verify:colliders` after geometry/collider changes.

### Tier 5 — Perf (field is fine at 839; this is the YARD edge case) — scope-cut-first of the keepers
- **Yard cluster-merge** (§F/§G): yard ground-view worst-case ~3215 draw calls — merge
  across the ~38 already-merged POI sub-groups. Precedent: `mergeStaticByMaterial`. Must
  preserve live salvage-panel parts + colliders.
- Cap concurrent open-panel interiors / LOD distant open panels (the live salvage panels,
  not hull mats, drive the yard count).

## Polish bucket (fill gaps BETWEEN tiers — the §E non-wreck quick-bugs)
- Brighter stars in the night sky.
- Speeder antenna tilt toward the REAR (not the front).
- Dev/debug mode keybind (can't click to open it under pointer-lock).
- Scrap-pickup model → rusted sheet-of-metal look (current model disliked).

## Scope-cut order (if budget runs short — cut from the BOTTOM)
Tier 5 → Tier 4's "break-the-sausage"/engine-droop nice-to-haves → Tier 4 detail.
NEVER cut: Tiers 1-3 (cohesion + seating + the collider gate are the core "finish").
Do NOT add Tier 6 (legacy retirement) — out of scope this session.

## Autonomy contract
- `phash`-determinism law: components NEVER draw `rand`; assemblers draw a small FIXED
  budget (a function of archetype + part/panel count). A new `rand()` in a component
  desyncs the salvage-panel stream → use `phash(seed, k)`.
- Re-run `verify:placement` after ANY POI/panel/seating/geometry change. A buried panel at
  a fixed seed = STOP (the determinism tripwire).
- Rule 8: visual work is NOT done when tsc passes — build → screenshot → critique →
  iterate (5-8 rounds new visual elements, 3-5 tuning). Hold the ACBA adversarial-critique
  bar for the weathering + husk work.
- Ambiguous → GDD pillars + the realism dial; append a D-entry; continue.
- Additive-save discipline (D81): a `SAVE_VERSION` bump should NOT be needed here — if one
  turns out necessary, surface it.

## Stop conditions
3 fix-walls on one element (log + move on / cut) · a buried-panel gate regression you can't
clear in 2 tries · a `SAVE_VERSION` bump turning out necessary (surface it) ·
destructive-git attempt.

## Verification protocol
`npm run verify` (= tsc) clean. `npm run verify:placement` (0 occlusion + 0 terrain ×5
seeds). NEW `npm run verify:colliders` (Tier 3) green. Headless framing: `rig-shot
--archetype=<id>`, `wreck-yard --angle=ground` (field variety + perf), `perf-probe`
(field drawCalls <1000, programs ≤72). **Collision/feel/seating sign-off → the attended
`npm run dev` walk-test (still owed — do not claim it headless).**
