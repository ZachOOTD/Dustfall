# Campaign cycle-32 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D242).

## Where we are
- ✓ M1 · ✓ M2 · ✓ M3 · ✓ M4 · ✓ M5 · ✓ **M5a COMPLETE (C28-31)** (silhouettes `[partial]` · spyglass · vista-crest · sun-shade).
- **→ M5b — Living world & tone (cycle 32) — the LAST Phase-A tier.** After M5b ships → **the Phase-A milestone PAUSE** (the loop stops for the user's walk-test + Phase-B design review).

## Cycle 32 picks up: **M5b → `wordless-prop-scenes`** (first M5b unit)
M5b units (in order): **wordless-prop-scenes** · wind-mood-soundscape · rare-sky-phenomena · diurnal-cycle · worm-far-horizon-crossing.
- **wordless-prop-scenes** — environmental storytelling with NO text: a few hand-placed prop tableaux that imply a story (a skeleton slumped against a wreck beside a dry canteen; two bedrolls + a burnt-out fire + a single boot; a child's toy half-buried by a crashed pod). The desert remembers. **ASSESS FIRST:** what props/meshes already exist to compose from (grep `skeleton`/`ribcage`/`bedroll`/`canteen`/`boot`/`corpse` + the POI/scatter placers + `carcasses`); is there a hand-placement hook near `placePOIs` / `placeHeroLandmarks` (the C28 silhouette + C31 occluder pass shows the pattern)? Likely **net-new placement** (compose existing meshes into 2-4 scenes at fixed/seeded spots) — VISUAL → render + adversarial gate (Rule 8); watch **determinism** (no new scatter-rand draw — use fixed offsets or a dedicated sub-stream like the hero-landmarks) + the **placement/collider audits** (props are decorations — no colliders, exempt; but if a scene sits on a salvage panel area, mind the bury-audit).
- Pairs with the whole M5a exploration arc: you crest a ridge (C30), glass a wreck (C29) via its silhouette (C28), reach it, shelter in its shade (C31) — and find a wordless scene that tells you who died here.

## Rig-shot (reuse): `vista [--dist=] [--fogmult=]` · `spyglass-view [--raw]` · **`sun-probe`** (C31 occlusion check) · `item-studio --item=<id>` · `rig3p --item=<id> [--lit]` · `storm` · `smoke-plume`. Debug: `__game.setTime`, `__game.sunInfo()` (C31 — exposure + occluder boxes), `__game.spawnFire`. Dev-start inventory: `spyglass` + `worm_lure`.

## Verify gotcha (C18-31)
`npm run verify:all` → `verify:placement` runs **5 seeds via spawnSync** + **buffers ALL output to the END** (~5-7 min; a seed can FLAKE → re-run once). **NEVER `taskkill node.exe` while a verify is running** (C29 footgun). **Don't run renders (port 5173) concurrently with verify:placement.** Sequence: all renders → clean node → ONE verify. A code-auditor/Workflow agent (no node) CAN run concurrently with verify. **`setTime` in a headless probe does NOT propagate to `sunDir`/`sunHeight` synchronously** (the lighting tick + rAF throttling — C31); compute the sun from dayTime directly (`ang=(dayTime-0.25)·2π`, `cos/sin`) if you need it in a probe.

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gate on a NEW VISUAL ASSET (Rule 8 — prop tableaux are visual → render + critique); **code-auditor** on logic/audio/systems (C30 vista + C31 sun-shade both went code-auditor → CLEAN — the right gate for non-asset systems). **Save (D81)** additive. **Don't re-do already-done — verify current state first** (C31's lesson: the heat/shelter path already existed; the unit EXTENDED it). **Build the buildable/objective scope, defer feel to the walk-test.** **Reuse, don't rebuild** (C31 reused the C28 silhouette boxes as sun-occluders — DRY win).
- **⚠ M5b is the LAST Phase-A tier. When M5b's final unit ships, the cycle PAUSES at `### Milestone: Phase A — Build-out complete`** (checkpoint=milestone) — set `status:paused`, `awaiting_approval:true`, `stop_reasons:["milestone-review"]`, and STOP (no ScheduleWakeup). Backstop **max-cycles=50** (now at 31).

## Stop conditions
**Phase A milestone (PAUSE — after M5b's last unit)** · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries (a single-seed FLAKE re-run is NOT a regression) · SAVE_VERSION bump (do it, surface only) · destructive-git attempt.

## Open backlog of note (the WALK-TEST batch is large — surface at the Phase-A pause)
- **C31:** sun-shade FEEL (heat floor/cool rate/raymarch thresholds) + the coverage gap (wrecks <8m don't cast shade — decouple from the silhouette MIN_HEIGHT or lower it). **C30:** vista-reveal FEEL. **C29:** spyglass model end-on lens + studio-material; spyglass FEEL (zoom curve, no ADS pose). **C28:** horizon-silhouette POLISH (impostor/ground-tuck/far-boldness — §A). **C26/C27:** sleep-fade + 3P torch flicker. **C24:** attach_rope LMB double-fires. **C22:** amban economy. yard-cross-poi-merge (D240). Full list: `docs/backlog.md`.
