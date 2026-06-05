# Session ACAH — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now" (ACAG last-shipped + the ACAH lane options).
2. `docs/session-end-report.md` — cumulative state (ACAG at top).
3. `docs/backlog.md` — open items, esp. the ACAG-triage block at the bottom (2026-06-05).
4. `docs/decisions.md` — tail D174-D176 (D174 viewmodel mirrors world lighting, D175 wood shader-cache collision fix, D176 recursive dead tree).
5. `docs/roadmap.md` — "Up next" + the new "Near-term priority (ACAG triage)" block.
6. `docs/architecture.md` — read before touching terrain/collision (cave lane) or the wreck/salvage systems (loot lane).

## What's already built
Post-MVP survival sandbox (100+ sessions): terrain/biomes, weather (sweeping sandstorm wall + procedural clouds /
clear↔overcast), day/night, procedural audio, inventory/crafting/cooking, fire/tent/sled/locker/stake/speeder,
lizard/shrew/sandworm/raider/companion, a rigged 3P player, salvage POIs (hand-modeled flagships + composite procgen
wrecks with dynamic panel placement), pulse rifle (Cycle 5 weapon), a global rust pass, a dev item-spawner panel. The
**item-model arc is complete** (every item has a detailed mesh). **ACAG** rebuilt the deadwood family: held items now lit
identically to their world copies (the FP viewmodel scene mirrors world lighting — D174), the dead tree is a recursive
camelthorn-style forking generator merged to one geometry/tree (D176), and wood has real bark grain after fixing a latent
shader-program-cache collision that had been silently sharing one compiled program across ALL wood materials (D175).

## Session ACAH focus — pick ONE lane (surface to the user if ambiguous; default (a))

### (a) LOOT-SOURCE BOOTSTRAP FIX — DEFAULT (gates the early game)
Salvage panels are currently the only loot source, but opening a panel needs a `scrap_bar`, and a `scrap_bar` can't be
crafted without loot → **bootstrap deadlock**. Add a no-tools loot source. Proposed (per backlog): **scrap pickups scatter
around wrecks**, mirroring how branches spawn around dead trees. Template: `world/deadTree.ts:spawnDeadTrees` (ring-scatter
around an anchor) + `pickups.ts:spawnBranchAt` (the per-item world-pickup spawner). Place scrap pickups in a ring around
each wreck/POI anchor. Headless-verifiable (count + placement via a rig-shot/eval). **If a save field is needed for
collected-scrap state, surface it (D81)** — but scatter is likely transient/seed-derived like branches (no bump).

### (b) CYCLE 5 — Raider proc-character (strong AUTONOMOUS fit)
Rebuild the raider as a proper proc-character (borrow the player-rig vocabulary — sub-pivot rig per D115/D117/D118), give
it the **pulse_rifle**, verify the death→corpse→drag path reads as a recognizable body. Pure character VISUAL work, fully
`rig-shot`-verifiable like the item/tree overnights. Raiders stay dormant (D13) except DEV spawn/kill hooks.

### (c) MEGA-WRECK REBUILD FROM SCRATCH (ACAG triage)
The current mega-wreck reads too boxy/unrealistic. Remove it + rebuild: gather references, level up the modelling
techniques (the recursive-tree rework is the proof this pays off). Pairs naturally with the standing wreck/salvage-panel
overhaul backlog item. Large; a full session.

### (d) DEEP CAVE SYSTEM — design pass + first build
Procedural sprawl + sub-terrain walkable collision below the heightfield (the hard architectural question — spike it
first) + descent opening + dark-nav. Then cherry-pick the egg spine from `2d4035b`. Highest-value, highest-risk.

### (e) FOREGROUND FEEL-TUNE PLAYTEST + quick wins (needs a human)
The owed ACW/ACX in-motion pile (D150) + ACAG-triage quick wins: devmode-toggle fix (badge unclickable), night-dust
ground clamp, speeder antenna slow-blink, floating rear-bar fix, mounted-vs-onfoot lighting mismatch.

## Autonomy contract
Ambiguous → pick the option closest to the GDD pillars + decisions.md realism dial, append a D-entry, continue. Don't
pre-emptively scope-cut: plan deeply, execute fully, **screenshot-iterate visual work (rule 8 — 5-8 rounds new, 3-5
tuning; ACAG is the model: the user's "look closer" loops each surfaced a real defect).** Batch genuine D150 feel items
for the user's playtest rather than skipping.

## Stop conditions
Wall-clock ceiling · all-planned-shipped + budget · 3 consecutive fix walls on one element (log + move on) · catastrophic
block · destructive-git attempt · a save bump turning out necessary (surface it — possible for cave state in lane d).

## Notable footguns
- **D175** — wood/metal/fabric shader factories inject per-instance constants via `onBeforeCompile`; any new variant MUST
  have a distinguishing `customProgramCacheKey` or Three silently shares ONE compiled program. Verify a shader-source
  change actually renders (inject a debug fill) before trusting it.
- **D174** — the FP viewmodel scene mirrors world lighting now; held items darken at night (intended). Don't "fix" it.
- **D109** moving meshes need `localSpace` materials · **Rule 7** ≥10cm box decorations · **D81** save fields additive only.
- **Headless harness runs the game clock ~5× slow** (D172) — cadence/timing tests must wait long in wall-clock.
- **Windows harness** — `dev.kill()` can orphan vite; kill the leftover node listener on a strict-port conflict.

## Verification
`npm run verify` (tsc) — must stay clean. Visual: `npm run rig-shot -- --scenario=<name>` (item-studio / tree /
branch-match / branches / panels / a new scenario for the lane). Feel/in-motion: foreground playtest.

## On stop
Run the gamedev-framework `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap → D-entries → backlog →
report → next-prompt → post-mortem → commit + tag `session-ACAH` + push).

## Pending from prior sessions
Two framework post-mortem drafts from ACY sit in `~/projects/gamedev-framework/.post-mortem-pending/`
(isolated-asset-studio-view, raycast-surface-sampler-placement) — `/consolidate-shared-memory` (needs the user) to
merge or reject. The shader-program-cache lesson (D175) is a strong new post-mortem candidate.

## Begin
Read the order above → confirm tsc clean → pick the lane (default (a): the loot bootstrap deadlock — it gates the whole
early game and is cheap + headless-verifiable) → TaskCreate the plan → start.
