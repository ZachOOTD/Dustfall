# Campaign cycle-17 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D240).

## Where we are
- ✓ M1 · ✓ M2 content (yard-merge deferred D240) · **M3 IN PROGRESS:** ✓ model (C12-13) · ✓ tail-buried (C14) · ✓ charge-dive (C15) · ✓ audio-rumble (C16).
- **M3 order:** model ✓ · tail ✓ · charge ✓ · audio ✓ → **multi-worm-population (cycle 17)** → sarlacc-lure-ambush. *(Per the roadmap: model+tail before population — done.)*

## Cycle 17 picks up: **M3 → `multi-worm-population`**
More than one worm roaming the world (the desert has several territorial leviathans, not one). Likely: spawn N
worms across the map (per-biome / spacing), each with its own AI instance + home anchor.
- Where: `src/enemies/sandWorm.ts` — `ctx.sandWorms.list[]` is already an array; check the spawn (`spawnSandWorm`/
  the boot spawn ~L607) + `updateSandWorm`/the multi-worm tremor-selection (the ACE Tier-2 code ~L807-844 already
  picks ONE worm for the tremor — multi-worm aware). Check `tuning.ts` SANDWORM_* for a count/spacing constant
  (may need a new SANDWORM_COUNT). Save: worms are saved individually (check `save.ts` worm fields) — **adding
  worms is additive but may need a SAVE_VERSION surface-bump if the saved list schema changes (D81).**
- **⚠ THE C16 RUMBLE IS A SINGLE GLOBAL HANDLE** — with multiple worms charging, only the first gets the rumble
  (the rest masked). For multi-worm, either (a) make the rumble per-worm (a handle on each worm) driven by the
  NEAREST charging worm, or (b) keep one global rumble but drive it from the nearest/most-threatening charging worm
  (simpler). Note it; the audio code-auditor flagged this as the multi-worm follow-up.
- **Determinism:** worm spawn may use a seed — if it draws from the procgen rand stream, re-run verify:placement.
  More likely the worm has its OWN rng (per `worm` fields). Verify = tsc + placement/colliders + (if visual) a gate.
- **Perf:** N worms × particle pools + meshes — check the draw-call/particle budget (perf-probe). Cap N sensibly.

## Worm rig-shot (reuse): `--scenario=worm-model --angle=head|side|3q|arc|charge`

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gate on VISUAL work; code-auditor on AUDIO/logic
  (the C16 rumble audit caught 3 real sev2 node-lifecycle bugs). **Rule 8** for visual. **Save (D81)** additive + surface bumps.
- Pauses at the **Phase A milestone** (after M5b). Backstop **max-cycles=50**.

## Stop conditions
Phase A milestone (pause) · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries ·
SAVE_VERSION bump needed (do it, surface only) · destructive-git attempt.

## Open backlog of note
- worm: per-worm rumble (multi-worm) · dorsal-crest contrast · head-beef · charge sand-bank · breach/charge/sound FEEL walk-test.
- yard-cross-poi-merge (D240). Full list: `docs/backlog.md`.
