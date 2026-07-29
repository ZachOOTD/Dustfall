# Next session — campaign DEEPER is PAUSED after cycle 11 (Zach's call, 2026-07-28 evening)

**State:** `campaign/2026-07-24-deeper`, tree clean, push HELD. 11/20 cycles, ~11.2M/14M.
`status: paused`. Boot from `docs/campaign/campaign-state.json` (its `paused_note` is the resume
brief) + `steering.md`. **The gate runner, the STALL RULE and EFFICIENCY WATCH are all in force —
read steering.md §EFFICIENCY WATCH before dispatching anything.**

## Resume order

**1. ⚠ FIX THE OPEN REGRESSION — `cave-kinds` warren march. This blocks cycle 12.**

The owed legs ran. **`cave-streamed` 1337+7 now PASS** (no longer owed). **`cave-kinds` FAILS,
warren only**: `could not reach node 7 (pocket) from 3 … fwdClear@[.3/1/1.7]=[1.0 1.1 0.8]`,
reached 8/12, cascading to 6/7/9/11. fungal/flooded/shaft all pass, ascent=OUT.

**Established: it is a REGRESSION, not a flake.** Warren marched 12/12 in **twelve consecutive
runs** across 07-27/28 including cycle 10's own gate, and 8/12 on the first cycle-11 run — **solo
on a quiet machine**, so D311's dt-coupling does not explain it.

**Prime suspect, UNPROVEN:** cycle 11's placement sampler (`d645f88`). Warren alone has
`rubblePerChamber > 0` + `salvagePlates` + `scrapPerCave`; rubble/plates are **collider-bearing**
(baked into the cave trimesh), and their seating moved from the analytic plane to the real cave
floor — which can narrow a corridor.

Order: (a) reproduce cheap — `npm run rig -- --scenario=cave-kinds --kinds=warren --void=0
--port=52xx`; (b) **A/B by zeroing warren's rubble/plate placement** to confirm attribution;
(c) then fix **by construction** (clearance-aware seating), never by relaxing the gate. **Do not
dispatch a multi-hour fix agent before (b)** — the 4242 lesson. Logs:
`verification/gate-logs/20260728T235212Z-*.txt`.

Everything else is green: the other 22 legs (`20260728T231336Z-*`), tsc/loot/placement/colliders,
and cycle 11's own LANTERN-RT + CAVE-COLD sub-gates on both seeds.

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

**3. Cycle 13 — integration.** [cycle-13-plan.md](campaign/cycle-13-plan.md) is written and
verified. Tor slicing is a **GO but DIGEST-FIRST**: `caveDigest` hashes cave meshes only, so
**the tor is in no digest today** and a slicing bug would ship green — add `torDigest` + baseline,
then refactor, then assert sync-built == sliced-built. If scope shrinks, cut the refactor and keep
the digest, never the reverse. Honest target ~50-70ms (not <16ms: a 45k-tri Rapier bake can't be
chopped). Plus the docs sweep (changelog's last entry is 2026-07-13 — five campaigns owed;
architecture's cave block lists 6 of 10 files and describes a 4-leg suite against a real 24) and
the framework backflow (17 pending drafts, none from this campaign, all code/rendering while
DEEPER produced mostly PROCESS lessons — draining needs Zach, it's interactive). **D308-D314 are
already written** (`6b7f6d7`). One-line source fix owed: `caveKinds.ts:19` names the
pre-lattice-snap origin digests as "a hard campaign gate."

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
