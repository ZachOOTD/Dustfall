# Session ACZ — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now" (ACY last-shipped + the foreground-owed list).
2. `docs/session-end-report.md` — cumulative state (ACY scope at top).
3. `docs/backlog.md` — open items (✓/🟡 markers show done vs remaining).
4. `docs/decisions.md` — tail D165-D169 (esp. D168 panel sampler, D169 itemStudio harness, this session's calls).
5. `docs/roadmap.md` — "Up next" + the (empty) Scope-cut section.
6. `docs/architecture.md` — only if touching an unfamiliar system.

## What's already built
Post-MVP survival sandbox: terrain/biomes, weather (sweeping sandstorm wall), day/night, procedural audio,
inventory/crafting/cooking, fire/tent/sled/locker/stake/speeder, lizard/shrew/sandworm/raider/companion, a rigged 3P
player, salvage POIs (hand-modeled flagships + a composite procgen wreck system). **ACY** deep-polished the **12
high-visibility held item models** (machete/pipe_staff/scrap_bar/scrap_gun/energy_pistol/amban_rifle+scope/scrap_bullet/
torch/flashlight/rope/canteen/bandage) against a new isolated `itemStudio` view, shipped a **dynamic salvage-panel
placer** (`findPanelMount` raycast surface-sampler — D168) with size variants + a numeric bury audit, added POI hull
greebles, and made the amban a `massive`-wreck loot drop. All tsc-clean, no save change.

## Session ACZ focus — pick ONE lane (surface to the user if ambiguous; else default to (b))

### (a) DEEP CAVE SYSTEM — design pass + first build (the standing vision, deferred since ACV)
A genuine underground cave SYSTEM: procedural sprawl + branching passages you can get lost in, **sub-terrain walkable
collision below the heightfield**, a surface DESCENT opening, and dark-navigation lighting. **DESIGN FIRST** (write it up:
generation approach — cellular-automata vs tunnel-carving vs modules; collision for passages below the heightfield;
torch/dark model), then build a first cut. Then cherry-pick the egg-acquisition spine from commit `2d4035b` once the real
cave exists (the gated-acquisition pattern is intact there + in `shared-memory/save-schema-migration.md`, D158). Biggest,
highest-risk, highest-value item. One deep build fills the night.

### (b) FINISH THE ITEM-MODEL PASS — the remaining ~22 models (DEFAULT — closes the ACY thread)
Bring the **kits/foods/materials** up to parity with the 12 hero items, same discipline + same tool:
`npm run rig-shot --scenario=item-studio --items=<a,b,c> --angles=front,3q,left,top`. Targets: **kits** (tent_kit,
sled_kit, fire_kit, large_tent_kit, bedroll_kit, lantern_kit, locker_kit, grill_kit, stake_kit, companion_pod), **foods**
(cactus_pulp, cooked_cactus_pulp, raw/cooked lizard/worm/shrew meat, lizard-on-a-stick raw/cooked, alien_fruit),
**materials** (branch, cloth, scrap). Several already-decent (lantern_kit/bedroll_kit/large_tent_kit) → 3-5 rounds;
the plain-Lambert primitives (tent_kit/sled_kit/cactus_pulp/alien_fruit) → 5-8. All in `src/inventory/items.ts`.

### (c) FOREGROUND FEEL-TUNE PLAYTEST — the owed ACW/ACX pile (needs a human at the keyboard)
Not overnight-doable. Boot `npm run dev`, play, tune constants in `src/config/tuning.ts`: seated-speeder riding feel +
feet-on-pegs, in-motion creature gaits (`LIZARD_GAIT_*`/`SHREW_GAIT_*`), shrew burrow timing, speeder FX in motion
(`SPEEDER_DUST_*`/`SPEEDER_GLOW_*`), storm wind/sway/muffle (`STORM_*`), use-anim reads. This is the D150 loop the
headless harness can't run.

## Autonomy contract
Ambiguous → pick the option closest to the GDD pillars + decisions.md realism dial, append a D-entry, continue. Don't
pre-emptively scope-cut: plan deeply, execute fully, screenshot-iterate every visual element (rule 8 — build→shot→
critique→iterate, 5-8 rounds new / 3-5 tuning), batch genuine D150 feel items for the user's playtest.

## Stop conditions
Wall-clock ceiling · all-planned-shipped + budget · 3 consecutive fix walls on one element (log + move on, don't
blind-fix) · catastrophic block · destructive-git attempt · a save bump turning out necessary (surface it — none expected).

## Notable footguns
- **D169** — iterate item meshes against the isolated `itemStudio` view, not the in-hand `held-item` shot (the rig torso
  buries small items). `npm run rig-shot --scenario=item-studio --items=… --angles=…`.
- **D168** — `findPanelMount` consumes a variable number of `rand()` calls, so existing saved seeds render panels
  differently (additive, no save bump). Verify panel changes on NEW seeds via `--scenario=panels` (each boot rolls a
  fresh random seed; the `panelBuryAudit` gives pass/fail).
- **D165** — a verification harness must render the REAL game camera; for FEEL/in-motion work the studio/free-camera
  paths lie. **D150** — in-motion gait/wind/riding feel is foreground-only; don't claim it from a headless run.
- **Rule 7** — box decorations on hull exteriors need ≥10cm depth. **D109** — moving meshes need `localSpace:true`
  materials (the `vm*` wrappers in items.ts force it). **D81** — save fields additive only; surface any version bump.
- **Windows harness cleanup** — `dev.kill()` can orphan the vite child; on a strict-port conflict, kill the leftover
  node listener on that port first.

## Verification
`npm run verify` (tsc) — must stay clean. Item meshes: `npm run rig-shot --scenario=item-studio --item=<id>` (build→
shot→critique→iterate). Panels: `npm run rig-shot --scenario=panels` (bury audit + shots, 2-3 fresh seeds). Feel/
kinematic: foreground playtest (lane c).

## On stop
Run the gamedev-framework `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap → D-entries → backlog →
report → next-prompt → post-mortem → commit + tag `session-ACZ` + push).

## Begin
Read the order above → confirm tsc clean → pick the lane (default (b)) → TaskCreate the lane's sub-tasks → start. For
(b)/(a), lead with one element fully iterated end-to-end before scaling.
