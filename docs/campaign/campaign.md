# Campaign — Dustfall "Sharpen & Deepen"

**Goal:** Deepen the EXISTING game so its content bites, breathes, and rewards exploration — no new content pillars, no tone change, no endgame. "Done enough" = the 7-milestone ladder below is built + green, ready for one end review.
**Started:** 2026-07-09
**Branch:** `campaign/2026-07-12-skyfall` for the M7 resume (M1-M6 shipped on `campaign/2026-07-09`, merged to master 2026-07-12 with Infinite Sands; every cycle commits here; merged at end review)
**Budget:** max-cycles **50** (hard stop) · soft ceiling ~10M output tokens (self-estimate; cycle count is the real bound)
**Checkpoint policy:** `none` (unattended run-to-completion) — **with two sanctioned exceptions that DO pause** (below)
**Self-author policy:** `propose` (if the ladder empties before max-cycles, propose more from the GDD and wait — do NOT auto-add)
**Verify gate (per cycle):** `npm run verify:all` (tsc + placement + colliders) **plus** the intro/tutorial smoke suite (`smoke-intro` / `smoke-pod-tutorial`) — a cycle that breaks the released opening does NOT pass. Visual/feel cycles also run the adversarial appearance gate (`--visual-gate=auto`).
**Status:** active

## Locked design constraints (do NOT violate autonomously)
- **No endgame / no Long-Storm finale** — forbidden by the 2026-06-18 user directive; the game stays open-ended "days survived." (The stale "endgame finale" candidate line is scrubbed from CLAUDE.md/roadmap/next-session-prompt in M1.)
- **No tone change / no pruning** — the user confirmed the current spectacle, 6 flagship journals, and combat/weapon surface are INTENDED. Do not treat them as debt; do not quarantine the raider/combat surface. GDD stays as-is.
- **Additive-save-only (D81)** — if a unit genuinely needs a `SAVE_VERSION` bump, **PAUSE and surface it** (sanctioned exception below); never cut around it, never ship an unreviewed migration.
- **No new content pillars** — this campaign sharpens/deepens what exists (plus the ONE new hero wreck, M7). The Phase-A feel-pile (worm/vulture/speeder/atmosphere feel-tunes) is EXCLUDED — reserved for attended sessions.

## Sanctioned pauses (the only two things that stop the unattended run before max-cycles)
1. **Skyfall pre-detail (M7 `[feel-critical]`)** — build the blockout (scale, shell, interior layout, colliders, enterability) autonomously, then **PAUSE** for the human to walk it (enter it; verify collision + intro-ship scale) before the hero-detail pass.
2. **Any `SAVE_VERSION` bump** (D81) — surface for approval, do not proceed.

Otherwise: no mid-checkpoints. Review async via `campaign-log.md`; redirect via `steering.md`.

## The milestone ladder (authoritative queue — traverse in order)

- **M1 — Perf + housekeeping** `[auto]` — ✅ SHIPPED cycle 1 (2026-07-09, D281)
  - `pickup-instancing` — `InstancedMesh` in `src/pickups/pickups.ts` + an `instanceId→pickupId` resolver in the interaction raycast (`src/player/interaction.ts`); precedent `src/world/footprints.ts`. Verify: perf-probe drawcalls before/after + an eval take-loop confirms every pickup still collects. (Scope-cut #1 if it regresses: revert to merged-mesh pooling.)
  - `decisions-archival` — roll the oldest ~15 (D207→) into `docs/decisions-archive.md` verbatim, never renumber, update both headers; conserve the count (C43 precedent).
  - `panel-deadcode-cleanup` — strip superseded panel/greeble builders + dead fields (ACAX list). tsc/build-verifiable.
  - `survival-probe-crashheat-guard` — one-line determinism assert in the survival probe.
  - `doc-scrub` — remove the stale "endgame/Long-Storm finale" candidate from CLAUDE.md + `docs/roadmap.md` + `docs/next-session-prompt.md`.
- **M2 — Survival curve** `[auto + evidence]` — ✅ ALREADY SHIPPED pre-campaign (C38/D246; probe re-verified green cycle 1; the FEEL walk-test stays an end-review item; the "enable in new-game" premise was stale — survival IS live post-intro) — build a headless time-to-death sim harness (minutes-to-death under {open-midday / shade / sheltered / watered}); tune drain/damage/regen bands in `src/config/tuning.ts` to a defensible curve; **enable survival in the REAL new-game path** (currently suspended by the intro) **behind a `FEATURES` flag** so it's one-line reversible at end review. Verify: the evidence table + the flag path.
- **M3 — Survival depth** `[auto]` — ✅ SHIPPED cycle 2 (2026-07-09, D282: occluders 3→51 via SUN_OCCLUDER_MIN_HEIGHT 2.5m + POI registration; THIRST_SHADE_RELIEF 0.8; heat-shade probe env; C38 bands byte-identical). Was RE-SCOPED cycle 1: sun-shade-exposure ALREADY SHIPPED (C31); remaining = (a) decouple the sun-occluder height threshold from the C28 silhouette threshold + register more occluders (procgen POIs / rocks — coverage is sparse), (b) water-scarcity/exposure (the deferred Arc C1 half). Verify via survival-probe + __game.sunInfo().
- **M4 — Ambient life beds** `[auto]` — ✅ SHIPPED cycle 3 (2026-07-09, D283: procedural sources on the existing stems; ambient-beds gate) — procedural day + night ambient beds synthesized in `src/audio/soundscape.ts` (zero-asset per D3). **Wind STAYS muted** (user). Verify: audio-state gains > 0 across day/night/storm.
- **M5 — Living world (diurnal-cycle)** `[auto]` — ✅ SHIPPED cycle 4 (2026-07-09, D284; diurnal-probe gate) — bind lizards/shrews/vultures/worms to day/night activity (iteration-plan M5b). Verify: assert creature activity by time-of-day.
- **M6 — POI breadth** `[gate-verified]` — COMPLETE (cycles 5-7: `relay_mast` D285 / `buried_pipeline` D286 / `cargo_crawler` D287 — 3 distinct archetypes) — 2-3 new procgen wreck/POI archetypes via the `src/world/poiComponents.ts` socket grammar (+ `poiArchetypes.ts` biome weighting). Verify: `verify:placement` (0 occlusion/terrain fails ×5 seeds) + `verify:colliders`.
- **M7 — Skyfall enterable hero wreck** `[feel-critical]` — a NEW enterable hero wreck at intro-ship scale (exterior) with an enterable interior of similar-or-larger scale. **Build ON the intro-ship interior tech** (`src/world/escapePodIntro/shipScene.ts`: D-section hull, room colliders, doorways, rule-9 collider discipline) — reuse guarantees the scale-match + de-risks collision. Research-first → blockout → **PAUSE for human walk-test** → hero-detail via the procedural-modeler loop + adversarial-visual gate.

## Scope-cut order (if verify fails 3× or budget pressure trips)
Per GDD §12 + this ladder: `pickup-instancing` raycast (→ merged-mesh fallback) → optional M6 archetype count (3→2→1) → M3 water-scarcity breadth → M5 per-species diurnal nuance. **Never cut:** any save-touching change (pause instead, D81); the M2 curve *evidence* (surface it, don't guess); M7 collision correctness (revert to last-green, don't half-ship).

## How to steer this campaign
- **Watch progress:** read `campaign-log.md` or run `/campaign-status`.
- **Redirect:** write a note in `steering.md` — picked up at the next cycle boundary.
- **At a sanctioned pause:** review + (for M7) walk the build, then `/campaign-approve` to release the next unit.
- **Stop:** `/campaign-status --stop`, or delete `.gamedev-framework/overnight.lock`, or write "pause" in `steering.md`.
