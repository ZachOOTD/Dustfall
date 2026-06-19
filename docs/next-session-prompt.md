# Campaign cycle-31 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D241).

## Where we are
- ✓ M1 · ✓ M2 · ✓ M3 · ✓ M4 · ✓ M5 · **M5a IN PROGRESS (C28-):** ◑ horizon-landmark-silhouettes `[partial]` (C28) · ✓ salvaged-spyglass (C29) · ✓ vista-crest-reveal (C30).
- **→ M5a LAST unit: `sun-shade-exposure` (cycle 31).** Then M5b → **the Phase-A milestone PAUSE** (the run pauses for the user's walk-test + Phase-B design review).

## Cycle 31 picks up: **M5a → `sun-shade-exposure`** (the last M5a unit)
- **sun-shade-exposure** — make **direct sun vs shade matter** for survival: standing in open sun raises heat/exposure faster; shade (under a wreck, a tent, a dune's lee, night) relieves it. Rewards using the world's cover + the time of day. **ASSESS FIRST what already exists** — grep `heat`/`exposure`/`shade`/`inShelter`/`sunExposure`/`updateStats`/`updateShelter` across `src/player/`, `src/world/shelter.ts`, `src/config/tuning.ts`. The game ALREADY has a heat stat + `updateShelter` (sets `inShelter` before `updateStats` so the heat path sees it — see CLAUDE.md tick order) + day/night sun. **So this may be largely a TUNING + extension of the existing heat/shelter path, NOT net-new** — verify current state before building. Likely scope: (a) a continuous **sun-exposure factor** (is the player in direct sun? — raycast to the sun / check `inShelter` + overhead occlusion + sun height) that modulates the heat drain; (b) maybe a subtle UI/feedback cue (a "you're exposed" hint, or the existing heat bar reacting). Watch determinism + the tick order (`updateShelter` → `updateStats`).
- **Buildable vs feel:** the exposure DETECTION + the heat-rate hook are buildable/objective; the exact rates/curve are FEEL → defer to the walk-test. If it's mostly tuning an existing system, run lean (cite "verified the existing heat/shelter path", like C23/C25).

## Rig-shot (reuse): `vista [--dist=] [--fogmult=]` (C28 silhouettes + C30 fog-lift preview) · `spyglass-view [--raw]` (C29) · `item-studio --item=<id>` · `rig3p --item=<id> [--lit]` · `storm` · `smoke-plume`. Debug: `__game.setTime`, `__game.setCloudiness`, `__game.triggerStorm`, `__game.spawnFire`. Dev-start inventory: `spyglass` + `worm_lure`.

## Verify gotcha (C18-30 — keeps biting; C29 self-inflicted an EXIT=1)
`npm run verify:all` → `verify:placement` runs **5 seeds via spawnSync** + **buffers ALL output to the END** (~5-7 min; empty mid-run ≠ hung; a seed can FLAKE → re-run once). **NEVER `taskkill node.exe` while a verify is running** (C29 killed its seeds mid-run → EXIT=1; the clean re-run passed). **Don't run renders (port 5173) concurrently with verify:placement.** Sequence: all renders → clean node → ONE verify. A code-auditor/Workflow agent (reads files, no node) CAN run concurrently with verify. Docs-only → skip (tsc + byte-identical).

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gate on a NEW VISUAL ASSET; **code-auditor** on logic/audio/atmosphere (C30 vista-reveal: code-auditor CLEAN — the right gate for a non-asset feel system, not a heavy visual hunt). **Rule 8** for new visuals. **Save (D81)** additive (a new item / recipe-id / transient runtime state = no bump). **Don't re-do already-done — verify current state first** (sun-shade may be mostly tuning the existing heat/shelter path). **Build the buildable/objective scope, defer feel to the walk-test.**
- **Pauses at the Phase-A milestone** — after **M5b** (so: sun-shade-exposure finishes M5a, then M5b, then the PAUSE). Getting close. Backstop **max-cycles=50** (now at 30).

## Stop conditions
Phase A milestone (pause, after M5b) · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries (a single-seed FLAKE re-run is NOT a regression) · SAVE_VERSION bump (do it, surface only) · destructive-git attempt.

## Open backlog of note
- **C30:** vista-reveal FEEL (prominence threshold/cooldown/envelope/fog amount/swell) → walk-test. **C29:** spyglass model end-on lens + studio-material polish; spyglass FEEL (zoom curve, vignette timing, no ADS pose) → walk-test. **C28:** horizon-silhouette POLISH (per-model impostor / ground-tuck / far-boldness — §A). **C27/C26:** 3P torch flicker + sleep-fade → walk-test. **C24:** attach_rope LMB double-fires. **C22:** amban economy → milestone. yard-cross-poi-merge (D240). Full list: `docs/backlog.md`. **The walk-test backlog is growing — flag it at the Phase-A pause.**
