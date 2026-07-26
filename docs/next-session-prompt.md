# Next session — campaign DEEPER, cycle 7: the D-3 visual reassess + cave taste pass

**State:** campaign DEEPER **active** on `campaign/2026-07-24-deeper` (6/20 cycles, ~3.65M/10M,
push HELD). Cycle 6 (underground water, VOLUME tier — pools + jerrycan) SHIPPED at `d717a9a` +
`f388194`, all gates green. Boot from `docs/campaign/campaign-state.json` + `steering.md` as
always; this file is the hint, the state file is the truth.

## Cycle 7 — the displaced D-3 reassess (charter cycle 5, moved by two resumes)

Full adversarial player-eye visual audit across the WHOLE cave tree by fresh critics (not the
builders), + `CAVE_*` taste tuning. Named residuals to carry in:

- Cave ceilings ~80% quality — dark smoky band at 8-15m.
- Global value contrast still below the old shell kit.
- The entrance tor marginal at 78m (reads as a small dark bump).
- Sawtooth spikes on the fissure's upper walls.
- `CAVE_ROCK_BUMP` perf unmeasured on low-end GPUs; its leopard-print mottle is now the loudest
  texture in every pool frame and competes with the water for attention (critic finding).
- Rock 8-bit contour banding under amplification (the water got dither; the rock didn't).
- Pool taste dials if the darkness read needs lifting: `CAVE_POOL_GLINT_STRENGTH` (2.2) then
  `CAVE_POOL_ALPHA_MIN` (0.16). pool2-rim is the weakest pool framing — recheck it.
- Dither crosshatch: one look in MOTION (screen-space pattern; invisible in stills at 1×).

## Owed to Zach (surface at every checkpoint)

- **The repair descent walk-test (D-1..D-4) is STILL OWED** — cycles 6+ build on a gate-green but
  human-unwalked base (his 2026-07-25 "run the remaining ladder" directive covers this).
- **Pool motion** (ripple/glint crawl while walking) is untestable in stills — walk-test item.
- **Balance flags, not baked:** jerrycan recipe (scrap ×3 + metal_pipe ×1 + cloth ×1), capacity
  4× canteen, pools 1-3/cave ~0.3m deep.
- Milestone ahead: **hazard-spec-review before cycle 9 is built** (a doc review, not a walk-test).

## Standing rules (unchanged)

Fable plans / Opus executes · one code-writing agent at a time · never `git stash` · push HELD ·
SPEED RULES (probes via `npm run rig -- --scenario=… --port=52xx`; full gate suite ONCE per
batch; no watchers; wall-clock budgets stated honestly — visual loops are ~2h+) · rule 8 for
anything visual · trust the playtest over a green gate · NO creature underground · determinism
D290 · the pool pixel gate now lives inside `verify:chunks` and throws unconditionally.
