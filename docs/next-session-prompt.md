# Session ACY — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now" (ACX last-shipped + the foreground-owed list).
2. `docs/session-end-report.md` — cumulative state (ACX scope at top).
3. `docs/backlog.md` — open items (the ✓/🟡 markers show what's done vs remaining).
4. `docs/decisions.md` — tail D160-D167 (esp. D165-D167, this session's calls).
5. `docs/roadmap.md` — "Up next" + the (empty) Scope-cut section.
6. `docs/architecture.md` — only if touching an unfamiliar system.

## What's already built
Post-MVP survival sandbox: terrain/biomes, weather (sweeping sandstorm wall), day/night, procedural
audio, inventory/crafting/cooking, fire/tent/sled/locker/stake/speeder, lizard/shrew/sandworm/raider/
companion, a rigged 3P player (skinned limbs, layered outfit), salvage POIs. **ACW** shipped the full
art/animation + storm-feel pile (creature gaits + shrew burrow, speeder dust/engine FX, 3P hand-placement
hooks, storm wind + camera sway + audio muffle, 3P interact-prompt). **ACX** then did a 3P fix pass on
user feedback: held items in the real RIGHT hand + facing forward + palms-in, real speeder 3P chase cam,
footsteps-through-items depth fix, and a numeric-IK re-solve of the seated speeder pose (hands on the
bars, butt back, torso no longer disconnected). All tsc-clean, no save change.

## Session ACY focus — FOREGROUND FEEL-TUNE FIRST, then pick a breadth lane
ACW+ACX built a large pile of **feel/kinematic** work that is genuinely foreground-only to verify (D150 —
the headless harness can't read in-motion gait/wind/sway/riding). **Step 1 is a real playtest**; only then
add new work.

### Priority 1 — Foreground feel-tune playtest (the owed verification)
Boot `npm run dev`, play, tune (constants in `src/config/tuning.ts` unless noted):
- **Seated speeder riding (ACX)** — mount (E) in 3P (F): does the rider read as gripping the bars + feet
  on the pegs while riding + turning? Pose angles are in the `if (sp && sp.mounted)` branch of
  `playerRig.ts`; seat position is `SPEEDER_RIG_SEAT_Y/Z`. Known: hands ~5cm off the bars (good), feet
  ~22cm from the pegs (reads astride, not pad-perfect — nudge the leg `hipZ`/`knee`/`SEAT_Y` if it bugs you).
- **Creature gaits in motion** — lizard `LIZARD_GAIT_*` (in `enemies/lizard.ts`) + shrew `SHREW_GAIT_*`:
  believable skitter, or too fast/mechanical?
- **Shrew burrow** — approach a shrew: convincing dive? `SHREW_BURROW_RADIUS/DEPTH/TRANSIT_S` + puff.
- **Speeder FX** — ride: `SPEEDER_DUST_*` (trail) + `SPEEDER_GLOW_*` (nozzle heat).
- **Storm wind** — trigger a storm: right shove on dropped items / parked bike / slack sled? `STORM_WIND_PUSH_ACCEL`.
- **In-storm sensory** — camera sway (`STORM_CAM_SWAY_AMP/FREQ`) + audio muffle (`STORM_AUDIO_LP_MIN_HZ`).
- **Machete 3P chop** — swing in 3P: does `playUseAnim3P` read as a chop?
- **3P interact-prompt** — hover a pickup/fire/wreck in 3P: prompt sits ON the object?

Log what felt off; tune; re-confirm. This is the rule-8 loop the headless harness couldn't run.

### Priority 2 — pick ONE breadth lane (after P1)
- **(a) Finish the 3P item USE-ANIM pass** (smallest; closes the ACW/ACX thread): per-item grips are DONE;
  remaining is `playUseAnim3P` for scrap_gun/energy_pistol/amban_rifle recoil, canteen drink, scrap_bar pry,
  bandage apply. Mirror the machete chop. Verify the arm read with the `held-item` rig-shot scenario.
- **(b) DEEP CAVE SYSTEM design pass** (the user's vision, deferred since ACV): procedural sprawl + sub-terrain
  walkable collision + a surface descent opening + dark-navigation lighting. DESIGN first (write it up), then
  build; re-apply the egg-acquisition spine from commit `2d4035b` once the real cave exists.
- **(c) Salvage-panel variety + dynamic placement** (#189/#190) + POI art detail.

Surface the choice to the user if ambiguous; else default to (a).

## Autonomy contract
Ambiguous → pick the option closest to the GDD pillars + decisions.md realism dial, append a D-entry, continue.
Don't pre-emptively scope-cut: plan deeply, execute fully, screenshot-iterate visual work (rule 8), batch
genuine D150 feel items for the user's playtest rather than skipping them.

## Stop conditions
Wall-clock ceiling · all-planned-shipped + budget · 3 consecutive fix walls on one element (log + move on,
don't blind-fix — D150) · catastrophic block · destructive-git attempt · a save bump turning out necessary
(surface it — none expected).

## Notable footguns
- **D165** — a verification harness MUST render the REAL game camera. A harness that overrides the camera (or
  assumes a facing convention) can mask a live-view bug for multiple rounds. The `bike-truth` scenario in
  `scripts/rig-shot.mjs` is the template (real chase-cam + fixed world angles + numeric-IK sweep).
- **D166** — pose a rig to world targets with a numeric IK sweep (minimize joint-world-pos→target distance),
  not by eyeballing low-res frames.
- **D167** — `spineBend` is parented at the rig origin (y=0, feet); a big lean must compensate `spineBend.position`
  to pivot at the waist or the torso slides off the pelvis. Reset it on any non-seated path.
- **D164** — headless creature/item screenshots use the paused free-camera path; the live FP/3P camera + KCC
  body-teleport fights placement.
- **D161** — `particleTrail` `size` is a WORLD diameter (~0.4–1.2), not pixels. **D109** — moving meshes need
  `localSpace:true` materials. **D81** — save fields additive only; surface any SAVE_VERSION bump.
- **Windows harness cleanup** — `dev.kill()` can orphan the vite child; if a rig-shot run hits a strict-port
  conflict, kill the leftover node listener on that port first.

## Verification
`npm run verify` (tsc) — must stay clean. Visual/pose: `npm run rig-shot --scenario=<name>` (paused free-camera
or `bike-truth` for on-bike). Feel/kinematic: foreground playtest (this session's P1).

## On stop
Run the gamedev-framework `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap → D-entries →
backlog → report → next-prompt → post-mortem → commit + tag `session-ACY` + push).

## Begin
Read the order above → `npm run dev` → start the P1 feel-tune playtest (lead with the seated-speeder riding
check). TaskCreate the P1 tune items + the chosen P2 lane.
