# Session ACAB — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now" (ACZ last-shipped + the foreground-owed list).
2. `docs/session-end-report.md` — cumulative state (ACZ at top).
3. `docs/backlog.md` — open items (✓/🟡 markers).
4. `docs/decisions.md` — tail D165-D170 (D168 panel sampler, D169 itemStudio harness, D170 two-pass FP viewmodel render).
5. `docs/roadmap.md` — "Up next" + the (empty) Scope-cut section.
6. `docs/architecture.md` — read before touching terrain/collision (lane a needs it).

## What's already built
Post-MVP survival sandbox: terrain/biomes, weather (sweeping sandstorm wall), day/night, procedural audio,
inventory/crafting/cooking, fire/tent/sled/locker/stake/speeder, lizard/shrew/sandworm/raider/companion, a rigged 3P
player, salvage POIs (hand-modeled flagships + composite procgen wrecks with dynamic panel placement). **The item-model
arc is now COMPLETE** — ACY (12 hero held items + the `item-studio` harness + dynamic salvage-panel placer) and ACZ
(the remaining ~22 kits/foods/materials) mean **every item has a detailed/verified mesh**. **ACAA** then fixed three
playtest issues: see-through FP rings (the viewmodel now renders in its own scene in a 2nd depth-cleared pass — D170),
branch cleanup + held/world unification, and a real layered torch fire (only when lit). New `fp-item` rig-shot scenario
renders the REAL first-person viewmodel.

## Session ACAA focus — pick ONE lane (surface to the user if ambiguous; default (a))

### (a) DEEP CAVE SYSTEM — design pass + first build (the standing vision, deferred since ACV) — DEFAULT
A genuine underground cave SYSTEM: procedural sprawl + branching passages you can get lost in, **sub-terrain walkable
collision below the heightfield**, a surface DESCENT opening, and dark-navigation lighting. **DESIGN FIRST** — write it
up (`docs/feature-deep-cave.md`): generation approach (cellular-automata vs tunnel-carving vs hand-authored modules);
how passages get walkable collision BELOW the terrain heightfield (the hard architectural question — see
`docs/architecture.md` for the current terrain/KCC setup); the torch/dark lighting model; the "getting lost" feel. Then
build a first cut. Then cherry-pick the egg-acquisition spine from commit `2d4035b` once the real cave exists (the gated
pattern is intact there + in `shared-memory/save-schema-migration.md`, D158). Highest-value, highest-risk; a design pass
+ first build is a full session. **If a save bump is needed for cave state, surface it (D81).**

### (b) FOREGROUND FEEL-TUNE PLAYTEST — the owed ACW/ACX in-motion pile (needs a human at the keyboard)
Not autonomous-doable. Boot `npm run dev`, play, tune constants in `src/config/tuning.ts`: seated-speeder riding feel +
feet-on-pegs, in-motion creature gaits (`LIZARD_GAIT_*`/`SHREW_GAIT_*`), shrew burrow timing, speeder FX in motion
(`SPEEDER_DUST_*`/`SPEEDER_GLOW_*`), storm wind/sway/muffle (`STORM_*`), use-anim reads. The D150 loop the headless
harness can't run. Best done WITH the user present.

### Smaller interleavables (if a lane finishes early)
- amban_rifle balance playtest (foreground); the hand-modeled curved engine_bell/escape_pod panels still flag the bury
  audit (could be re-mounted via the `findPanelMount` sampler if extended to those parts); individual hero item models
  could go deeper (optional).

## Autonomy contract
Ambiguous → pick the option closest to the GDD pillars + decisions.md realism dial, append a D-entry, continue. Don't
pre-emptively scope-cut: plan deeply, execute fully, screenshot-iterate visual work (rule 8). Batch genuine D150 feel
items for the user's playtest rather than skipping.

## Stop conditions
Wall-clock ceiling · all-planned-shipped + budget · 3 consecutive fix walls on one element (log + move on) · catastrophic
block · destructive-git attempt · a save bump turning out necessary (surface it — likely for cave state in lane a).

## Notable footguns
- **Lane (a) collision-below-heightfield is the crux** — Rapier KCC + the terrain heightfield assume a single ground
  surface; carving walkable sub-terrain needs a separate collision strategy (trimesh tunnel colliders? a second
  heightfield? sensor-bounded volumes?). Spike this before committing to a generation approach.
- **D169** — iterate any mesh/material against the isolated `item-studio` / studio view, not an in-context shot.
- **D168** — `findPanelMount` consumes variable `rand()`; verify procgen panel changes on NEW seeds (`--scenario=panels`,
  fresh seed each boot, `panelBuryAudit` gives pass/fail). **D150** — in-motion feel is foreground-only.
- **Rule 7** ≥10cm box decorations · **D109** moving meshes need `localSpace` materials (item `vm*` wrappers force it;
  `createStoneMaterial` does NOT support localSpace — don't use it on viewmodels) · **D81** save fields additive only.
- **Windows harness** — `dev.kill()` can orphan vite; kill the leftover node listener on a strict-port conflict.

## Verification
`npm run verify` (tsc) — must stay clean. Visual: `npm run rig-shot --scenario=<name>` (item-studio / panels / a new
cave scenario). Feel/in-motion: foreground playtest.

## On stop
Run the gamedev-framework `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap → D-entries → backlog →
report → next-prompt → post-mortem → commit + tag `session-ACAA` + push).

## Pending from prior sessions
Two framework post-mortem drafts from ACY sit in `~/projects/gamedev-framework/.post-mortem-pending/`
(isolated-asset-studio-view, raycast-surface-sampler-placement) — run `/consolidate-shared-memory` (needs the user) to
merge or reject them.

## Begin
Read the order above → confirm tsc clean → pick the lane (default (a): start with the `docs/feature-deep-cave.md` design
write-up + a collision-below-heightfield spike before any big build) → TaskCreate the plan → start.
