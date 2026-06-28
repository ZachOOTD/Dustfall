# ▶ RESUME — M13 ⓙ speeder hum (the LAST review-fix unit → M13 milestone pause) — `campaign/2026-06-18`

**Picking up where C68 left off.** Campaign ACTIVE, Phase-B review-fix pass (M11→M13). **M11 + M12 COMPLETE + approved.** **M13 weapon & vehicle audio:** ✅ ⓘ gunshot + reload SFX (C68). **ⓙ is the LAST unit of the whole M11→M13 pass — after it ships, the cycle PAUSES at the M13 milestone** for the user's audio LISTEN (gunshots/reload/speeder hum), which ENDS the review-fix pass. Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` (NOT chat memory).

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded)
2. `docs/campaign/campaign-state.json` — cycle 68/75, status, current_tier
3. `docs/campaign/campaign-log.md` (tail) — C68 (gun audio) + the audio file map
4. `docs/decisions.md` (tail) — D268 (gun SFX)

## Cycle 69 focus — M13 ⓙ: speeder engine → a lower-pitched, smoother hum
The user: the speeder engine hum is too high/harsh — make it lower-pitched + smoother.
- **Find the speeder engine audio** in `src/audio/audio.ts` (grep `speeder` / `hum` / `engine` / `startSpeeder` / a sustained engine voice). It's likely a SUSTAINED voice (a looping/oscillator hum with a level driven by speed) — so unlike the gun one-shots, it has C16-style lifecycle (start/setLevel/stop, an LFO maybe). `src/world/speeder.ts` drives it (start on mount, level by speed, stop on dismount).
- **Lower + smooth it:** drop the base oscillator frequency (lower pitch); soften the timbre (a gentler low-pass, fewer/weaker high harmonics, less aggressive LFO/tremolo) so it's a smooth low hum rather than a harsh whine. Keep the speed→pitch/level coupling (faster = a bit higher/louder) but over a lower, smoother range.
- **Lifecycle (C16):** if it's a sustained voice, honor the discipline — detach LFOs + `disconnect()` on stop, no tail-click, pause-safe (the speeder hum should stop/duck when paused or dismounted). Check the existing stop path.

### Acceptance
- The speeder hum is lower-pitched + smoother (a low engine thrum, not a harsh whine). `verify:all` PASS. Code-auditor the sustained-voice lifecycle (no leak, pause/dismount-safe). **SOUND quality → the user's M13 LISTEN.**

## Stop / pause — THIS CYCLE COMPLETES M13 → PAUSE (ends the review-fix pass)
ⓙ is the last M13 unit AND the last unit of the M11→M13 review-fix pass. When it ships, M13 is complete → **PAUSE** at the M13 milestone (`status: paused`, `awaiting_approval: true`, `stop_reasons: ["milestone-review"]`). The user LISTENS to the whole audio batch (gunshots per weapon, reload, the new speeder hum) + has the worm from M12. Then the user sequences the NEXT block — the **Skyfall hero wreck** + the **cave rework** are dedicated solo sessions (NOT the loop); also queued: ⑯ drop-pod-intro, ⑰ pickup-instancing (human-attended), + the §A walk-tests/flag-flips. **Headroom: 68/75 (~7 left).**

## Autonomy contract
Autonomous; ambiguous → realism-forward + a D-entry + continue. Audio gate = a code-auditor pass on the Web Audio graph (lifecycle correctness) + the user's LISTEN. PAUSE at the M13 milestone after ⓙ ships.

## NOT in the loop (dedicated solo sessions)
The **Skyfall crashed-ship** + the **CAVE rework** — `docs/backlog.md` §A. Do NOT start them.

## Footguns
- The speeder hum is likely a SUSTAINED voice (unlike the C68 gun one-shots) → C16 lifecycle applies (detach LFOs, disconnect on stop, pause/dismount-safe). Confirm the stop path doesn't leak or click.
- Audio can't be self-verified → tsc + a graph review are the gates; the SOUND is the user's LISTEN.
- Determinism/save: audio is runtime-only — no scatter/save impact (no D81 bump).

## Verify protocol
`npm run verify:all` (tsc + placement 0/0 ×5 + colliders 0/40). Audio: a code-auditor review of the Web Audio graph — the SOUND is the user's LISTEN at the M13 pause.
