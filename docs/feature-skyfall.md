# Feature slice — M7 Skyfall (enterable hero wreck) `[feel-critical]`

**Campaign:** Sharpen & Deepen · milestone M7 · **AWAITING HUMAN PLAN-REVIEW** (this doc). Approve with `/campaign-approve` to release S1.
**Authored:** cycle 8 (2026-07-09), grounded in a 2-agent code map of `shipScene.ts` + `leviathanLandmark.ts` / `huskShell` / `save.ts`.

## The spec (user, verbatim + backlog)
- "the scale to be **similar to the size of the ship you start on in the intro** and have an **enterable interior of a similar scale as well or larger**."
- Backlog: a **NEW unique high-quality enterable wreck (larger, never-before-modeled)** — **research crashed-sci-fi-ship design FIRST**; must NOT read as a copy of the enterable tank; **no floating pieces, no one-sided see-through** surfaces. (Also: the existing Skyfall landing-fire bug — fire should emit from the WRECK, not ground camp-fire placements — folds in here.)

## Definition of Done (the feature actually working — not a scaffold)
A **new, unique, enterable hero wreck** that:
1. Reads as a distinct crashed sci-fi ship (its own silhouette — NOT the intro ship, NOT the husk/tank), researched-first.
2. Is **intro-ship scale or larger**: a walkable D-section fuselage ≥ ~17m long, ≥2.4m interior ceiling (the intro ship is cockpit 6×3×5m + a 12m corridor; match or exceed).
3. Has an **enterable interior** the player walks into through a real breach/ramp/airlock, with multiple compartments + story dressing.
4. Is **collision-correct** (rule 9): every wall/floor/ceiling collider matches the visible geometry; the player can't fall through the floor or walk through hull, and the doorways are real gaps — **verified by verify:colliders + a NEW real-motion walk-probe**, not clearance numbers.
5. Is **hero-detailed to released-game quality** (adversarial-visual gate, HERO bar) — no floating pieces, no one-sided see-through, cohesive weathering.
6. Is placed as a **fixed hero landmark** (not procgen scatter), with salvage loot + a journal inside, registered as a sun occluder.
7. **No `SAVE_VERSION` bump** (confirmed additive — fixed landmark rebuilds from seed; salvageables/journals auto-persist via the v16 arrays). If the build discovers a genuine need for a new save field → that is the OTHER sanctioned pause (D81): STOP and surface it.

## Reuse map (from the code investigation — build ON this, don't reinvent)
- **Exterior hull**: `makeLoftedHull(stations, mat)` (`wreckForms.ts`) + a bespoke station generator modeled on `shipScene.ts` `hullProfile(z)` (lines 1037-1060) — a D-section that tapers/crowns. The mega-wreck (ACAK/D186, `megaWreck`) is the precedent for a hero crashed hull with a list/bury pose + `hullAt(z)` sampler.
- **Interior collision**: the `shipScene.ts` `BoxSpec = [w,h,d,cx,cy,cz]` + `makeStaticBox` pattern (colliders declared as box arrays, instantiated post-build). **Threshold sills** at every z-seam between compartments (line 1161 — the "stars through the floor" fix) and **doorway jamb/lintel sealing** (airlock lines 646-648 — the proven anti-space-leak model).
- **Interior shell + dressing**: `huskShell()` gives the hollow-shell + side-wall-collider + `auditExempt` mechanism; `dressCrashInterior()` (poiArchetypes 227-324) gives role-driven cargo/console/flight-suit/scorch dressing on an **isolated RNG** (determinism-safe). Reuse the MECHANISM; author a NEW form (backlog: not a tank-copy).
- **Placement**: clone `leviathanLandmark.ts` → `skyfallLandmark.ts` — fixed `LANDMARK_X/Z`, own seeded RNG (`makeRng(<fixed>)`), terrain height-sink + crash-tilt, static collider(s), `addHorizonSilhouette()` (tall enough for the skyline), `registerSalvageable()` for loot, wire into `main.ts` ~line 232. Optionally behind a `FEATURES.skyfall` flag for one-line reversibility at review.
- **Save**: additive — no new fields (agent-confirmed against `save.ts` v16).

## Sub-tasks (one per cycle, to depth — anti-punt)
- [ ] **S1 — Research + exterior blockout.** `/research-topic crashed sci-fi ship hull silhouettes` (or reuse the `megawreck-research` workflow). Author the NEW hull (loft stations + profile) as a distinct crashed silhouette at intro-ship-or-larger scale, in a crashed pose (list/bury/tilt), placed as a fixed landmark (Leviathan clone), **exterior only** (greybox/void interior). Gate: verify:all + a rig-shot exterior framer (multi-angle) + a LIGHT visual pass (silhouette reads as a unique crashed ship, scale-matches the intro ship).
- [ ] **S2 — Enterable interior + colliders.** Build the walkable interior in the hull frame: compartments, floor/ceiling/wall box colliders, doorway gaps + threshold sills + jamb/lintel sealing, a real breach/ramp entry. Hollow shell `auditExempt`; declared side-wall/floor colliders. Gate: **verify:colliders** (0 fails) + a **NEW `skyfall-walk` rig-shot probe** (spawn the player inside, walk floor + push every wall + exit + re-enter → assert no fall-through / no wall-clip / exits reachable — the rule-9 real-motion probe).
- [ ] **⏸ SANCTIONED PAUSE — post-blockout walk-test** (charter pause #1, `pause_before: hero-detail`). After S1+S2 the wreck is enterable + collision-correct at greybox. **STOP for the human to walk it in-app** (enter it; confirm the scale-match to the intro ship + that collision feels right) BEFORE any hero-detail spend. Resume with `/campaign-approve`.
- [ ] **S3-S5 — Hero-detail passes** (via the `procedural-modeler` agent + the adversarial-visual gate, HERO bar: 5-8 rounds, positive quality target, defining quality may NOT be routed to backlog). Exterior plating/weathering/greebles; interior dressing + story (console, cargo, remains, a journal); lighting. Fix the backlog nits: no floating pieces, no one-sided see-through, weathering-bucket cohesion. Fold in the **Skyfall landing-fire fix** (fire from the WRECK, not camp-fire placements).
- [ ] **S6 — Integration + loot.** Salvage panels + a journal placed inside; sun-occluder registration; final pass of all 7 permanent gates + a full walk-test. Optional `FEATURES.skyfall` flag documented.

## Scope-cut order (if a sub-task walls 3× or budget trips)
Per charter: cut interior compartment COUNT (multi-room → single grand hall) before cutting collision correctness; cut hero-detail ROUNDS before cutting the enterable interior; **never** half-ship collision (revert to last-green + pause). Never cut a save-touching change (pause instead, D81).

## Verify gates
Every cycle: `verify:all` + the 6 rig gates (smoke-intro/pod, pickup-take-sweep, survival-probe, ambient-beds, diurnal-probe). S2+ add: verify:colliders coverage for the new wreck + the new `skyfall-walk` probe. Hero cycles add the adversarial-visual gate (HERO bar).

## Open questions for the human (answer at plan-review if you like)
1. **Placement**: a fixed location near spawn (discoverable early) or far out (a destination, like the wreck-yard 620-1000m)? Default proposal: a mid-distance fixed landmark (~200-350m) so it's a visible skyline goal.
2. **Interior scale**: "similar" (~17m, one deck) or "larger" (~25m, a taller multi-deck hall)? Default: larger single grand interior with 2-3 compartments.
3. **Ship archetype/silhouette**: freighter / liner / military / science? (Drives the dressing role.) Default: a broken heavy freighter (fits the salvage/survival tone).
4. **FEATURES flag**: gate Skyfall behind `FEATURES.skyfall` for reversibility, or always-on? Default: flag it (one-line kill-switch at review).
