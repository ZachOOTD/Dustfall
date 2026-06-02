# Session ACX — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now" (ACW last-shipped + the foreground-owed list).
2. `docs/session-end-report.md` — cumulative state.
3. `docs/backlog.md` — open items (the ACW ✓/🟡 markers show what's done vs remaining).
4. `docs/decisions.md` — tail D160-D164 (this session's calls).
5. `docs/roadmap.md` — "Up next" + the (now-empty) Scope-cut section.
6. `docs/architecture.md` — only if touching an unfamiliar system.

## What's already built
Post-MVP survival sandbox: terrain/biomes, weather (sweeping sandstorm wall), day/night, procedural
audio, inventory/crafting/cooking, fire/tent/sled/locker/stake/speeder, lizard/shrew/sandworm/raider/
companion, a rigged 3P player (skinned limbs, layered outfit), salvage POIs. **ACW** just executed the
full deferred art/animation + storm-feel pile: creature gaits + shrew burrow, speeder dust/engine FX,
3P hand-placement + machete use-anim hooks, storm wind on bodies + camera sway + audio muffle, 3P
interact-prompt projection, and fixed the broken shrew-meat models. All tsc-clean, no save change.

## Session ACX focus — FOREGROUND FEEL-TUNE FIRST, then pick a breadth lane
ACW built a large pile of **feel/kinematic** work that is genuinely foreground-only to verify (D150 —
the headless harness can't read in-motion gait/wind/sway). **Step 1 is a real playtest** of it; only
then add new work.

### Priority 1 — Foreground feel-tune playtest of the ACW pile (the owed verification)
Boot `npm run dev`, play, and tune (all constants in `src/config/tuning.ts` unless noted):
- **Creature gaits in motion** — lizard `LIZARD_GAIT_*` (consts in `enemies/lizard.ts`) + shrew `SHREW_GAIT_*`:
  do the legs read as a believable skitter while fleeing, or too fast/mechanical?
- **Shrew burrow** — get close to a shrew: does it dive into the sand convincingly? `SHREW_BURROW_RADIUS`
  (trigger distance), `SHREW_BURROW_DEPTH`, `SHREW_BURROW_TRANSIT_S` (dive speed), + the sand-puff size/count.
- **Speeder FX** — ride the bike: `SPEEDER_DUST_*` (trail density/offset) + `SPEEDER_GLOW_*` (nozzle heat).
- **Storm wind** — trigger a storm: does it shove dropped items / the parked bike / a slack sled the right
  amount? `STORM_WIND_PUSH_ACCEL`.
- **In-storm sensory** — stand in a storm: camera sway (`STORM_CAM_SWAY_AMP/FREQ`) + audio muffle
  (`STORM_AUDIO_LP_MIN_HZ`) — subtle-but-present, or nauseating/too-muffled?
- **Machete 3P chop** — swing the machete in 3P (F to toggle): does `playUseAnim3P` read as a chop?
- **3P interact-prompt** — in 3P, hover a pickup/fire/wreck: does the prompt sit ON the object now?
- **Per-item 3P grips** — equip machete/scrap_bar/pipe_staff in 3P: grips seated in the fist?

Log what felt off; tune; re-confirm. This is the rule-8 loop ACW couldn't run headless.

### Priority 2 — pick ONE breadth lane (after P1)
- **(a) Finish the 3P item pass** (smallest; closes the ACW thread): author `handAttachTransform` +
  `playUseAnim3P` for the remaining held items (scrap_gun/energy_pistol/amban_rifle recoil, canteen drink,
  scrap_bar pry, bandage apply). Author grips with the `held-item` rig-shot scenario (`--item=<id>`).
- **(b) DEEP CAVE SYSTEM design pass** (the user's vision, deferred since ACV): procedural sprawl + sub-terrain
  walkable collision + a surface descent opening + dark-navigation lighting. DESIGN first (write it up), then
  build; re-apply the egg-acquisition spine from commit `2d4035b` once the real cave exists.
- **(c) Salvage-panel variety + dynamic placement** (#189/#190) + POI art detail.

Surface the choice to the user if ambiguous; else default to (a).

## Autonomy contract
Ambiguous → pick the option closest to the GDD pillars + decisions.md realism dial, append a D-entry, continue.
Don't pre-emptively scope-cut (ACW recalibration): plan deeply, execute fully, screenshot-iterate visual work
(rule 8), batch genuine D150 feel items for the user's playtest rather than skipping them.

## Stop conditions
Wall-clock ceiling · all-planned-shipped + budget · 3 consecutive fix walls on one element (log + move on,
don't blind-fix — D150) · catastrophic block · destructive-git attempt · a save bump turning out necessary
(surface it — none expected).

## Notable footguns
- **D164** — headless creature/item screenshots MUST use the paused free-camera path; the live FP/3P camera +
  KCC body-teleport fights placement. Scenarios live in `scripts/rig-shot.mjs`.
- **D161** — `particleTrail` `size` is a WORLD diameter (~0.4–1.2), not pixels.
- **D109** — moving meshes need `localSpace:true` materials (texture-swim).
- **D81** — save fields additive only; surface any SAVE_VERSION bump.

## Verification
`npm run verify` (tsc) — must stay clean. Visual: `npm run rig-shot --scenario=<name>` (paused free-camera).
Feel/kinematic: foreground playtest (this session's P1).

## On stop
Run the gamedev-framework `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap → D-entries →
backlog → report → next-prompt → post-mortem → commit + tag `session-ACX` + push).

## Begin
Read the order above → `npm run dev` → start the P1 feel-tune playtest. TaskCreate the P1 tune items +
the chosen P2 lane.
