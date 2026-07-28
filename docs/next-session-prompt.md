# Next session — campaign DEEPER is PAUSED after cycle 11 (Zach's call, 2026-07-28 evening)

**State:** `campaign/2026-07-24-deeper`, tree clean, push HELD. 11/20 cycles, ~11.2M/14M.
`status: paused`. Boot from `docs/campaign/campaign-state.json` (its `paused_note` is the resume
brief) + `steering.md`. **The gate runner, the STALL RULE and EFFICIENCY WATCH are all in force —
read steering.md §EFFICIENCY WATCH before dispatching anything.**

## Resume order

**1. Finish cycle 11's gate of record (~30 min).**
```
node scripts/verify-chunks.mjs --legs=cave-kinds,cave-streamed
```
The full run was stopped at the pause with **22 of 24 legs GREEN** (salvaged verdicts:
`verification/gate-logs/20260728T231336Z-*.txt`), including `pool-fill` ×2 which carries cycle
11's own new **LANTERN-RT** and **CAVE-COLD** sub-gates, and `cave-walk-7a`. `cave-kinds` never
started and `cave-streamed-7` was mid-flight — unrun, not known-bad. Run it under the
ORCHESTRATOR'S own tracked shell (stall rule), and do disjoint work in the window.

**2. Cycle 12 — the dead-explorer beat.** [cycle-12-plan.md](campaign/cycle-12-plan.md) is written
and symbol-verified: `makeSkeleton()` already poses a human skeleton *"slumped against the back
wall, died writing"* with an arm reaching toward a journal; `placeJournal` gives the read UI and
persistence free; `spawnLootContainerAt` already serves the origin cave's caches. So it is
composition + lifecycle, **plus one rule-8 close-read pass on the skeleton** (it has a genuine
rule-7 violation today — zero-thickness eye sockets). Host: the **warren** kind. Digests provably
unaffected (the digest is computed before any resident sink attaches; anchors aren't hashed).
It also fixes a found bug: streamed-cave loot doesn't persist as taken → an infinite battery farm
(additive `caveBeats` record, SAVE_VERSION stays 18).

**TWO ITEMS ARE ZACH'S** — hold as flagged one-liners, do not bake:
- **Q4, the loot-cache contents.** Proposed: `lantern_kit` + 2 `metal_pipe` + 2 `wiring` +
  1 `battery` + 3-4 `scrap`. Hand-authored, `lootRegistry` untouched.
- **Q9, the journal text** (plan §6, 5 entries). Defaults are safe if he doesn't answer, but the
  economy-gate rule says loot is his.

**3. Cycle 13 — integration:** the ~160-175ms tor arrival hitch (slicing lever named), docs +
D-entries + backlog sweep, then the final descent walk-test (charter checkpoint 3).

## Owed to Zach / pending from him

- **More tuning feedback** he hasn't given yet — capture same-day; it may reorder 12/13.
- **The process reflection he asked for**, once the cave work lands. Evidence gathered:
  the framework loop is one-directional (**16 undrained post-mortems**, `shared-memory/`
  untouched since **Jul 17**, before this campaign); **`rig-shot.mjs` is 19,651 lines** against
  94k of `src/`; the fixed cost per change no longer scales with the change; this chat is long
  and a fresh file-booted session would be sharper. Worth comparing deliberately against Odyssey.
- Parked decisions: shaft skylight · warren history props · corridor differentiation · canonical
  speleothem tips + egg-dais read (digest re-baselines) · pocket-9 wedge trap · taste dials
  (density, kind weights, darkness, light strengths, jerrycan/scrap numbers, `CAVE_COLD_FLOOR`).

## Standing rules

Fable plans / Opus executes · one code-writing agent at a time · never `git stash` · push HELD ·
**agents END at "report and stop" — the orchestrator runs every long gate under its own tracked
shell and never idles through one** · `--legs=` for iteration, `--serial` for march legs ·
rule 8 for visual/feel · trust the playtest · **NO creature and NO damage mechanics underground** ·
determinism D290 · origin digests `d8f15005` / `99e0015b`.
