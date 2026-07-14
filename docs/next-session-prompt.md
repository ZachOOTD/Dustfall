# Next cycle (22) — M10: more story vignettes (wordless environmental storytelling)

**State:** campaign "Sharpen & Deepen" `active` on `campaign/2026-07-12-skyfall` (21 cycles, ~6.6M/8.75M
spent; ~2.15M left of the +4M cap). Checkpoint none. **M7-R + M8 + M9 COMPLETE.** Queue: **M10 → M11 → M12.**

## Cycle 22 = M10 — more story vignettes
Expand the wordless "what happened here" TABLEAUS scattered in the world — environmental storytelling,
NO text (the GDD's "the world tells you what happened by what's left"; fits the Skyfall captain's-log
spirit). Study `src/world/wordlessScenes.ts` (`buildWordlessTableau` / the existing scene compositions)
+ how the chunk manager streams them (the `scene` descriptor roll, `CHUNK_SCENE_CHANCE`; a scene is a
small deterministic staged clearing). The existing set is sparse + one vignette was removed (the
two-skeletons-by-a-fire — user); ADD 2-4 NEW distinct tableaus that read a short story from arranged
props (all existing/simple props; melancholy Long-Dark/Dune tone, NO bodies — the GDD rule; the crew
is GONE, implied). 

**`/feature-slice` it** if the scene system needs new prop-authoring; otherwise it's a contained
content cycle (new tableau compositions in wordlessScenes.ts + wire into the scene roll). Candidate
vignettes (invent better if you can): a stalled campsite with a cold fire + a dropped canteen + tracks
leading away; a broken-down speeder/cart half-stripped for parts; a cairn / grave-marker rock stack
with a helmet on top; a scatter of cargo where someone sorted + abandoned it; a lone chair facing the
horizon. Each: deterministic (D290), streamed-teardown-safe (D292/rule 9), real thickness (rule 7),
no sand mounds (steering).

Gate: verify:all + verify-chunks (det stable per seed, no leak) + the chunk-vista/scene rig visual
(the tableau reads its story). GPU probes ~26s.

## The rest of the queue (likely a future session — budget)
M11 retire legacy tube-wrecks (ship->socket, D227/D249) → M12 new far-field biome.
(~2.15M left → M10 fits; M11/M12 probably carry to a future /campaign-cycle run past the 8.75M cap.
When the cap hits, the campaign stops cleanly at `budget`; resume via /campaign-start --resume with a
raised ceiling.)

## Standing constraints (steering.md)
- **models-need-thickness** (rule 7) · **100% collision** (rule 9, swept) · determinism (D290) +
  streamed-teardown (D292/rule 9, NO body leaks) · no save-schema change without the D81 pause · GPU probe default.
- Cleanup owed (guard-blocked): remove the stray untracked `scratch-baseline/` dir AND `scripts/_vultcheck.mjs`
  in the morning.
