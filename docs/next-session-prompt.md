# Session ACAI — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now" (ACAH last-shipped + the ACAI lane options).
2. `docs/session-end-report.md` — cumulative state (ACAH at top).
3. `docs/backlog.md` — open items (the ACAH-shipped block is marked ✓; the deferred big features remain).
4. `docs/decisions.md` — tail D177-D180 (D177 game-wide shader-cache fix, D178 loot bootstrap, D179 vulture creature, D180 mounted-player-at-y=-2000 gotcha).
5. `docs/roadmap.md` — "Recently shipped" (ACAH) + "Up next".
6. `docs/architecture.md` — read before touching terrain/collision (cave lane) or wreck/salvage (mega-wreck lane).

## What's already built
Post-MVP survival sandbox (100+ sessions): terrain/biomes, weather (sandstorm wall + procedural clouds + clear↔overcast
+ NEW cloud shadows), day/night, procedural audio, inventory/crafting/cooking, fire/tent/sled/locker/stake/speeder,
lizard/shrew/sandworm/raider/companion + NEW rare **vulture**, a rigged 3P player, salvage POIs (flagships + composite
procgen wrecks with dynamic panels), pulse rifle, a rust pass, a dev item-spawner panel (Backquote toggle). The
**item-model arc is complete**; the **dead-tree** is a recursive camelthorn model with bark grain; the **early-game loot
deadlock is fixed** (scrap scatters around wrecks). All 7 procedural-material factories now honor their per-instance
params (the D177 cache-key fix).

## Session ACAI focus — pick ONE lane (surface to the user if ambiguous; default (a))

### (a) CYCLE 5 — Raider proc-character (DEFAULT; strong autonomous fit)
Rebuild the dormant raider as a proper proc-character wielding the **pulse_rifle**, so the death→corpse→drag path (Cycle
1) reads as a recognizable body. Pure character VISUAL work, fully `rig-shot`-verifiable. **The NEW `enemies/vulture.ts`
is a fresh, clean template** for a proc-creature with model + FSM + combat/loot/save wiring (mirrors the shrew). Borrow
the player-rig vocabulary (sub-pivot rig, D115/D117/D118). Raiders stay dormant (D13) except DEV spawn/kill hooks.

### (b) MEGA-WRECK REBUILD FROM SCRATCH (standing triage)
Remove the boxy mega-wreck + rebuild with references + leveled-up modelling (the camelthorn-tree and vulture rebuilds are
the proof this pays off). Pairs with the standing "overhaul procgen wrecks + salvage-panel system" backlog item. Large.

### (c) DEEP CAVE SYSTEM — design pass + first build
Procedural sprawl + sub-terrain walkable collision below the heightfield (spike this FIRST — the crux), descent opening,
dark-nav. Then cherry-pick the egg spine from `2d4035b`. Highest-value, highest-risk.

### (d) FOREGROUND FEEL-TUNE PLAYTEST (needs a human)
The owed ACW/ACX in-motion pile (D150) + the NEW ACAH owed feel items: the **vulture in-flight flee** arc
(`VULTURE_FLEE_SPEED`/`CLIMB_RATE`/`SPOT_RADIUS`/`DESPAWN_DIST`) and the **cloud-shadow strength**
(`CLOUD_SHADOW_SCALE`/`DARKEN`). Also the painted-metal rust gap (speeder/sled top — `paintMaterial` has `wearLevel` but
no rust layer).

## Autonomy contract
Ambiguous → pick the option closest to the GDD pillars + decisions.md realism dial, append a D-entry, continue. Research
real refs before authoring new geometry (the camelthorn + vulture refs paid off). Screenshot-iterate visual work (rule 8
— 5-8 rounds new, 3-5 tuning). Batch genuine D150/feel items for the user's playtest rather than faking verification.

## Stop conditions
Wall-clock ceiling · all-planned-shipped + budget · 3 consecutive fix-walls on one element (log + move on) · catastrophic
block · destructive-git attempt · a save bump turning out necessary (surface it — likely for cave state in lane c).

## Notable footguns
- **D177** — every onBeforeCompile material factory now has a `customProgramCacheKey`; any NEW one MUST too, or it
  silently shares one program. Verify a shader-source change renders (inject a debug fill) before trusting it.
- **D180** — the player capsule parks at **y=-2000 while mounted**; reading `ctx.player.body.body.translation()` while
  mounted gives garbage. Prefer the `getPlayerPos` util (resolves the speeder pos). Audit raw readers if a mounted bug appears.
- **D175/D109** moving meshes need `localSpace` materials · **Rule 7** ≥10cm box decorations · **D81** save fields additive only.
- **Headless harness runs the game clock ~5× slow** (D172) — cadence/flight/timing tests must wait long in wall-clock or
  assert on game-time; in-motion FEEL is foreground-only (D150).
- **Windows harness** — `dev.kill()` can orphan vite; kill the leftover node listener on a strict-port conflict.

## Verification
`npm run verify` (tsc) — must stay clean. Visual: `npm run rig-shot -- --scenario=<name>` (item-studio / vulture / tree /
panels / a new scenario for the lane). Logic: headless evals (see scrap-loot/worm-shelter/vulture-kill for the pattern).
Feel/in-motion: foreground playtest.

## On stop
Run the gamedev-framework `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap → D-entries → backlog →
report → next-prompt → post-mortem → commit + tag `session-ACAI` + push to master).

## Pending from prior sessions
Framework post-mortem drafts may sit in `~/projects/gamedev-framework/.post-mortem-pending/` — `/consolidate-shared-memory`
(needs the user) to merge/reject. The D177 "audit ALL onBeforeCompile factories, not just the one you noticed" lesson is a
strong post-mortem candidate (extends the D175 canon).

## Begin
Read the order above → confirm tsc clean → pick the lane (default (a): the raider proc-character — the vulture is a fresh
template + it closes the Cycle-5 'other half') → TaskCreate the plan → start.
