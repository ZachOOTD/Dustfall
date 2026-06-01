# Session ACL — Kickoff Brief: long OVERNIGHT, backlog/roadmap breadth (plan-mode + fan-out)

> The player-model arc is at its in-pipeline ceiling (ACK). This session pivots to
> **breadth**: knock out a large batch of INDEPENDENT backlog/roadmap items in one
> long overnight, using **plan mode** to scope + **fanned-out agents** to execute in
> parallel. NOT more player-model work (it's deprioritized; optional follow-ups in backlog).

## Read these now (in order)
1. **CLAUDE.md** (auto-loaded) — architecture rules, tick order, sub-agent policy (parallel-by-default).
2. **docs/session-end-report.md** — full state through ACK.
3. **docs/backlog.md** — THE source of work items for this session.
4. **docs/roadmap.md** — "Up next" + the Phase-2 iteration plan context.
5. **docs/decisions.md** tail (D130-D142) + grep `friction-score: [3-5]` for live risks.
6. `~/projects/gamedev-framework/shared-memory/orchestration-policy.md` — the fan-out dispatch table.

## What's already built
A full singleplayer desert-survival loop (survival stats, procgen 2400m world + POIs, combat, salvage, crafting, placement, mounts + sled tow, sandworm boss, companion, save v13, procedural audio + 3 music tracks) + a believable stylized procedural player rig (skinned limbs, dressed, PBR surfaces). See session-end-report "What works".

## Session ACL focus — breadth via parallel fan-out
Pick a batch of **independent** backlog items (no shared files / no ordering), classify each by shape (orchestration-policy.md), and **fan out one agent per item** (or per small cluster). Solo+sequential ONLY for dependency-ordered or observation-dependent (visual-feel) items. Govern cost with per-agent `effort`, not by avoiding fan-out.

## Candidate items (independent — good for fan-out; pick by budget)
Quick wins (~30min–1h each, mostly isolated files):
- **[polish] sandworm twilight-breach audio attenuation** — `enterStationaryBreach` plays `playWormRoar()` full-volume at 180-400m; skip it on twilight breaches or play a distance-attenuated variant. (`sandWorm.ts` + `audio.ts`)
- **[polish] footstep dust at foot contact** — move dust emit from player-center to foot mid-stance world pos (foot IK). (`playerRig.ts`/controller + dust)
- **[polish] 3P camera teleport-snap wiring** — set `ctx.player.cameraSnapNextFrame` on mount/dismount/save-load (flag exists, only boot consumes it).
- **[bug] speeder spin angular-damping playtest** — confirm worldspace tilt recovery after bumps.
- **[polish] megaWreck catwalk panel reachability** — add 1-2 ground-level panels.
Medium (~1-3h):
- **[polish] item viewmodel fidelity pass** — ~19 ItemDefs at primitive complexity (batch: large_tent_kit/bedroll_kit/lantern_kit, etc.). Visual-triage loop via `npm run rig-shot`-style capture or preview.
- **[polish] 3P upper-body aim twist-IK** — rotate `rig.shoulders[1]` toward camera on aim (clamped ±0.5).
- **[polish] 3P walk-cycle ↔ footstep cadence sync** — lock gait phase to footstep distance accumulator.
- **[feat] multi-worm population follow-ups / [feat] in-storm movement penalty** (disable sprint + slow walk while storm overhead).
Larger (scope carefully; may be 1 item alone):
- **[feat] Dune-style sweeping sandstorm** (storm wall approaches/sweeps/passes) — reworks ambient intensity-ramp; bigger, save-aware. Consider spiking design first.
- Triaged ideas in backlog: night-sky stars (twinkle/drift), wreck-yard biome, sarlacc pit, amban rifle, desert-shrew creature, cave→egg→"Pebble" companion, lie-down-to-sleep, iron-stake model, speeder rope-pull.

## Overnight preconditions (verify BEFORE going wide; else fall back to gated)
- `npm run verify` baseline PASS.
- **Token-budget ceiling set** (fan-out is default-on — an unattended run needs a spend bound; the user passes e.g. `+500k`). If none set, ask or stay gated.
- **Scope-cut list**: per-item, the cut order is "drop the item entirely, log a D-entry, move on" — don't half-ship. Capture cuts in the changelog.
- Destructive-action guard active (no `reset --hard`/`push --force`).

## Execution shape
1. Plan-mode: read backlog, select the batch that fits the budget, classify each item's shape + strategy.
2. Fan out: issue concurrent Agent calls (or a Workflow pipeline) — `isolation: worktree` for any that mutate the same files. One agent per independent item.
3. Each agent: implement + `npm run verify` (tsc) + (visual items) capture-critique-iterate. Returns a structured result.
4. Synthesize: collect results, resolve any file conflicts, run a final `npm run verify`, batch-verify save round-trip if any schema changed (bump SAVE_VERSION additively per D81).

## Autonomy contract
Ambiguous → GDD pillars + decisions.md realism dial; append a D-entry; continue. Surface only on: procedural-vs-asset (D107), save-schema bumps (D81), destructive git, or a whole-game aesthetic change (e.g. lighting mood).

## Stop conditions
Token budget reached · 3 consecutive fix-walls on one item (cut it, log, continue) · catastrophic block · destructive-action attempt · all selected items shipped.

## On stop
Invoke `/session-end` (verify-all, changelog, CLAUDE.md, roadmap, decisions, backlog, this report, next brief, post-mortem + consolidate, auto-commit+tag+push per CLAUDE.md git policy).

## Notable footguns
- **Per-frame tick order** in `main.ts` matters (CLAUDE.md rule 3); new systems hook at the right point + respect the pause gate (rule 4).
- **Magic numbers → `tuning.ts` only** (rule 2). **No innerHTML string-concat** (rule 6). **Box decorations ≥10cm depth** (rule 7).
- **D107 zero-asset** (procedural shaders only) — don't add texture files without surfacing.
- Save changes are additive + version-bumped (D81); 2-pass load for cross-entity refs.
- Verify = `npm run verify` (= `tsc --noEmit`); Dustfall opts out of the tier-ladder.

## Begin block
1. Read CLAUDE.md, session-end-report, backlog, roadmap, decisions tail, orchestration-policy.
2. `npm run verify` baseline. Confirm token-budget ceiling (else gated).
3. Plan-mode: select batch + per-item strategy. TaskCreate one task per item.
4. Fan out; each agent verifies; synthesize + final verify; `/session-end`.
