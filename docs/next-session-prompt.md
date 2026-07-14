# Next cycle (16) — M7-R part 3: broken cockpit glass + small cabin-visibility lift

**State:** campaign "Sharpen & Deepen" `active` on `campaign/2026-07-12-skyfall` (15 cycles, ~5.25M/8.75M
spent; +4M overnight cap → ~3.5M left). Checkpoint none. Queue: **M7-R (in progress) → M8 → M9 → M10 → M11 → M12**.

## M7-R progress
- ✅ part 1 (c14, D304): real hull thickness (paper-thin fix) + 100% exterior collision.
- ✅ part 2 (c15): interior floating-model audit (8 floaters grounded flush) + more interior detail.
- **REMAINING** (spec = `docs/feature-skyfall.md` M7-R section):
  1. **Broken cockpit glass** (cycle 16) — add a canopy/windscreen to the bridge (fore-starboard
     superstructure; `bridge`/`bridgeCap` blocks, BR_X ≈ HALF_W*0.34) like the intro ship's
     `shipScene.ts` `_glass`/dome vocabulary, SHATTERED to fit the crash (cracked panes, a hole,
     missing shards, maybe a few fallen shard bits). Hero read from the bridge. Give it real
     thickness per rule 7 (glass panes are thin but framed; no zero-thickness double-sided card).
  2. **+ Small cabin-visibility lift** (fold into cycle 16) — the CABIN reads too dark (flagged 3×);
     the loot/journal/new detail are flush but barely visible. Add a SMALL, tasteful, REVERSIBLE
     interior fill (a modest ambient/hemisphere term or a low cabin lamp) that lifts the floor/walls
     just enough to read the detail WITHOUT killing the "power's out / sun through the tear" mood.
     Document it as flagged for Zach's moody-vs-lit call (revert = one line). Do NOT over-brighten.
  3. **Captain's-log story** (cycle 17) — the crew EJECTED IN THE DROP PODS before/at the crash;
     bespoke journal content in `crashLog.ts` (a short melancholy log — the captain ordering the
     pod evac, the freighter going down — NOT generic freighter lore). This ties the empty wreck to
     the world (and a future drop-pod feature).

Gates every cycle: verify:all + skyfall-walk (PASS) + verify-chunks (det stable per seed) + the
adversarial visual gate for the glass (hero). GPU probes ~26s.

## After M7-R → the world queue
M8 far-field vultures → M9 new POI archetypes → M10 story vignettes → M11 retire legacy tube-wrecks
(ship→socket, D227/D249) → M12 new far-field biome. Each its own `/feature-slice` when reached.

## Standing constraints (steering.md)
- **models-need-thickness** (rule 7) · **100% collision** (rule 9, swept) · determinism (D290) +
  streamed-teardown (D292/rule 9) · no save-schema change without the D81 pause · GPU probe default.
- Cleanup owed (guard-blocked): remove the stray untracked `scratch-baseline/` dir in the morning.
