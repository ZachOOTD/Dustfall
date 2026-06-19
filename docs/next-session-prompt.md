# Campaign cycle-16 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D240).

## Where we are
- ✓ M1 · ✓ M2 content (yard-merge deferred D240) · **M3 IN PROGRESS:** ✓ model-overhaul (C12-13) · ✓ tail-buried (C14) · ✓ charge-dive (C15).
- **M3 order:** model ✓ · tail ✓ · charge ✓ → **worm-audio-rumble (cycle 16)** → multi-worm-population → sarlacc-lure-ambush.

## Cycle 16 picks up: **M3 → `worm-audio-rumble`** · AUDIO (no visual gate)
A low approach RUMBLE — the sub-bass tremor the player hears (and feels) as the worm charges underground toward
them, building toward the strike. Deepens the dread + reinforces the charge tell (pairs with C15's back-ridge).
- Where: `src/audio/audio.ts` — procedural Web Audio (NO sample files). There are already `playWormRoar`,
  `playWormRoarAttenuated`, `playWormChomp`. Add a sustained low rumble (e.g. layered low-freq oscillators / filtered
  noise, slow LFO) that starts on `enterCharging` + ramps with proximity/charge progress, stops on lunge/retreat.
  Wire it in `sandWorm.ts` (the charging state — see `enterCharging` ~L1077 + the charging update ~L1100). There's a
  `nextWakePuffAt`-style cadence pattern to follow; the soundscape tick is `updateSoundscape` in main.ts order.
- **NO visual gate** (audio has no rendered output). Verify = **tsc + a code-auditor review of the synth graph**
  (oscillators/gain/filter wiring, no clicks/dangling nodes, stops cleanly, respects a master/SFX gain + pause).
  The actual SOUND is **feel-pending walk-test** (headless can't listen). Mark it so.
- **Determinism:** audio doesn't touch the procgen rand stream → verify:placement/colliders unaffected. Check the
  worm doesn't already start/stop a charge sound (avoid double-playing); respect mute/pause (`ctx.flags.paused`).

## Worm rig-shot (reuse): `--scenario=worm-model --angle=head|side|3q|arc|charge`

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial gates on VISUAL work; for AUDIO/logic use a code-auditor
  agent (no renders to critique) + tsc. **Feel/sound → feel-pending walk-test.** **Rule 8** for visual. **Save (D81)** additive.
- Pauses at the **Phase A milestone** (after M5b). Backstop **max-cycles=50**.

## Stop conditions
Phase A milestone (pause) · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries ·
SAVE_VERSION bump · destructive-git attempt.

## Open backlog of note
- worm: dorsal-crest contrast/separation · head-beef · charge sand-bank against the ridge · breach+charge FEEL walk-test.
- yard-cross-poi-merge (D240). Full list: `docs/backlog.md`.
