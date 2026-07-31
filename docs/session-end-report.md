# Dustfall — Session-end report

Cumulative state. Rewritten at each `/session-end`. Per-session detail: `docs/changelog.md`;
campaign detail: `docs/campaign/campaign-log.md`.

## Current state (2026-07-30)

**Campaign "DEEPER" is COMPLETE and its content is LIVE on master** (branch
`campaign/2026-07-24-deeper`; two master deploys at Zach's request during the close). This caps a
five-campaign run since the last full report (2026-07-11): **Sharpen & Deepen** (Skyfall hero
freighter + far-field deepening, M7-R→M12) · **Scavenger's Economy** (identity materials +
unified lootRegistry, SAVE_VERSION 18) · **The Deep Desert** (multi-km ergs + the ridable sled) ·
**Underworld** (the first cave system, D307 architecture) · **DEEPER** (the cave system rebuilt
as watertight SDF surface-nets interiors, caves as a regular rocky-terrain feature, the
crevice-tor entrance, wadeable pool basins, cave-as-storm-shelter, the dead-explorer story beat,
loot-only-beside-bodies, and the process-reflection close: rule 10 + the verify:solid cave
enrollment, D320).

## What works end-to-end

Boot → escape-pod intro → wake in the desert → tutorial → infinite streamed persistent world
(save/reload with far-field diffs, saves ≤v17 migrate) → hero landmarks (Skyfall enterable
freighter, leviathan interior, bone-field ribcage, erg dune seas, the ridable sled) → caves:
find a crevice tor in rocky terrain, squeeze in, descend in true darkness on carried light, wade
pools, meet the dead salvager + journal + rifled cache, reach the egg dais, climb out — storms
rage on the surface while the cave shelters you (and stays cold, never damaging). The DEEPER
deltas: every warren carries the story beat; loot containers exist ONLY beside bodies; the
entrance reads as a small organic desert crevice (Zach: "ok looks decent now").

## Known issues / partials (full list: docs/backlog.md §PENDING)

- ⚑ **`CAVE_BEAT_CACHE` contents await Zach** (economy gate — hand-authored array, flagged).
- **Loot-beside-bodies is deployed but unwalked** by Zach.
- Tor build ~236ms at spawn (cycle-13 slicing candidate; its plan carries a FALSE premise —
  the mouth sill IS digest-coupled via the descent line — re-read before executing).
- Rim dark line at extreme grazing + broadly-quad overhead outline at largest scale (accepted
  W-4 residuals, on record with their failed-fix proofs).
- Cave SHELL not enrolled in verify:solid (tor + dais are; shell needs weld-ring accounting —
  interim coverage: POOL-BASIN / cave-walk / cave-void gates).
- Desktop exe still pre-procgen.

## Constants worth tuning (new this stretch)

All in `src/config/tuning.ts`: `CAVE_*` feel dials (darkness depth, torch/lantern/flashlight
strength, mushroom glow, drip rate) · `CREVICE_*` entrance family (mouth/pinch/deep half-widths,
apron ramp/feather/fall, edge lobes — ⚠ `CREVICE_APRON_RISE` is LOAD-BEARING: it feeds every
chamber floor via the descent line, see the W-4 commit) · `CAVE_POOL_DEPTH_M` /
`CAVE_POOL_BASIN_*` · `CAVE_BEAT_*` (⚑ cache contents = Zach's call) · economy: lootRegistry
drop tables + recipe costs (data edits behind `verify:loot`).

## Suggested next session (priority order — Zach picks; menu in roadmap.md §Up next)

1. **Owed taste passes** (attended, cheap): cave feel / economy feel / Deep-Desert tweaks —
   pure tuning + data edits, walk-verified live.
2. **Cycle-13 tor slicing** (perf, gate-first) or **character/MP re-anchor** (needs the GDD
   multiplayer interview before any build).
3. **Audio listen session** (attended) · desktop exe rebuild when wanted.

## State at session end

Branch `campaign/2026-07-24-deeper`, tree clean after the closeout commit; master carries the
full DEEPER content (deployed + live). Gates of record: the 20260729T214916Z 22-leg suite (all
green, every new sub-gate red-proven) + verify:solid 6/6 assets + selftest PASS (2026-07-30).
Origin digests ec2ebf98 / 876749d6. Framework repo (`~/projects/gamedev-framework`):
consolidation current (88 canon files), pending-drafts folder EMPTY, **local-only — no remote
backup** (worth creating a private one; the stranded-commit episode shows the repo carries
unrecoverable value).

## Token spend

Not metered this stretch (attended, multi-day, model switches). The DEEPER ceiling was REMOVED
by Zach on 2026-07-29 ("my claude subscription covers everything") — see memory
`budget-ceilings-advisory`; wall-clock and his-call items are the only gates now.

## Iteration-discipline self-check (rule 8)

PASS for the stretch: W-4 ran EIGHT screenshot-critiqued rounds to Zach's live verdict; W-1/2/3
each shipped with red-proven behavior gates + shots. The closeout portion (reflection, rule 10,
enrollment, docs) has no visual surface — harness + process work only.
