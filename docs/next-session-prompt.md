# ▶ RESUME — M12 ⓗ sand-worm alert audio (last M12 unit → milestone pause) — `campaign/2026-06-18`

**Picking up where C66 left off.** Campaign ACTIVE, Phase-B review-fix pass (M11→M13). **M11 COMPLETE.** **M12 sand-worm:** ✅ ⓕ dorsal ridges removed (C65) · ✅ ⓖ attack breach-and-dive (C66). **ⓗ is the LAST M12 unit — after it ships, the cycle PAUSES at the M12 milestone** for the user's worm-attack-FEEL walk-test + alert-rumble LISTEN. Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` (NOT chat memory).

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded)
2. `docs/campaign/campaign-state.json` — cycle 66/75, status, current_tier, the framework-upgrade directives in `resume_note`
3. `docs/campaign/campaign-log.md` (tail) — C66 + the worm-system recon (Cycle 65 entry has the audio file/line map)
4. `docs/decisions.md` (tail) — D266 (the breach-dive)

## Cycle 67 focus — M12 ⓗ: alert audio → a quiet low rumble + screen-shake buildup (mysterious — "you don't know what it is")
The user: the worm's alert/approach should be a **subtle, mysterious dread buildup** — a quiet low rumble + a gentle screen-shake that grows — NOT a loud roar/growl tell. AUDIO can't be self-verified → the user LISTENS at the M12 pause; your job is to wire it sensibly + confirm the graph compiles/doesn't error.

### The code (from the C65 recon — verify line numbers, they shift):
- **`playWormRoar()`** (`src/audio/audio.ts` ~657) — a LOUD one-shot sawtooth roar, currently played on `enterAlert` (sandWorm.ts ~1033) + `enterLunge` + combat `enterStationaryBreach`. For the mysterious alert: either make the ALERT call much quieter/lower (a felt sub-rumble, not a roar) OR drop the roar on `enterAlert` and rely on the sustained rumble (below) starting quietly. Keep a roar on the actual lunge/breach STRIKE (that's the payoff moment — the quiet buildup → the strike). Decide + note for the walk-test.
- **`startWormRumble()` / `setWormRumbleLevel()` / `stopWormRumble()`** (audio.ts ~717-742) — the sustained sub-bass rumble (two detuned low sines + lowpassed noise + a tremolo LFO). Currently started/leveled in the main worm update loop (sandWorm.ts ~829-832) driven by proximity, and (per the recon) it may only ramp during charge. For ⓗ: **start it quietly on ALERT** (the moment the worm detects the player) and RAMP the level as the worm approaches/charges → a growing dread. It already has `setWormRumbleLevel(0..1)`; drive it from the alert→charge proximity. Keep it LOW/quiet at alert (the "you don't know what it is" — a felt sub-bass, not an obvious monster sound).
- **`applyTremorEffects()`** (sandWorm.ts ~860-900) — the camera shake (currently `shakeAmt = 0.10 * intensity` while `state === alert|charging|retreat`, intensity from distance). For ⓗ: make the shake a smooth BUILDUP — ramp it from near-zero at alert up as the worm nears, so the screen-shake grows with the rumble. Maybe scale the shake by the same alert→charge progress as the rumble so they build together. Keep it subtle at first (a faint tremor) growing to a clear shake near the strike.

### Acceptance
- The alert is a quiet low rumble + a subtle growing screen-shake (a mysterious buildup), not a loud roar. The Web Audio graph compiles + has no lifecycle bugs (a code-auditor pass on the node graph is the right gate here — see C16's `worm-audio-rumble` which caught node-lifecycle bugs: detach LFOs, disconnect on stop, pause-safe). Headless `verify:all` PASS.
- The SOUND quality + the buildup FEEL → the user's M12 LISTEN at the milestone pause. Don't self-certify audio.

## Stop / pause — THIS CYCLE COMPLETES M12 → PAUSE
ⓗ is the last M12 unit. When it ships, M12 is complete (all units up to the `### Milestone: M12 sand-worm` marker are Shipped) → **PAUSE** (`status: paused`, `awaiting_approval: true`, `stop_reasons: ["milestone-review"]`). The user walk-tests the worm attack FEEL (the C66 breach-dive) + LISTENS to the alert rumble (this cycle), then `/campaign-approve` → M13 (weapon + vehicle audio). **Headroom: 66/75 (~9 left)** — M13 (ⓘ gunshot+reload all guns, ⓙ speeder hum) ≈ 2 cycles after the pause.

## Autonomy contract
Autonomous; ambiguous → realism-forward + a D-entry + continue. The audio is a code-auditor gate (graph correctness) + the user's LISTEN (quality). PAUSE at the M12 milestone after this cycle.

## NOT in the loop (dedicated solo sessions)
The **Skyfall crashed-ship** + the **CAVE rework** — `docs/backlog.md` §A. Do NOT start them.

## Footguns
- **Worm = creature, not a placement POI** → tsc + a code-auditor pass on the Web Audio graph are the gates; the user LISTENS for quality.
- **Web Audio lifecycle** (C16 lesson): detach LFOs, `disconnect()` on stop, no tail-clicks, pause-safe (don't leak oscillators). Run a code-auditor over the node graph.
- **Determinism / save:** audio + camera-shake are runtime-only; no scatter-stream or save impact (no D81 bump).

## Verify protocol
`npm run verify:all` (tsc + placement 0/0 ×5 + colliders 0/40). Audio: a code-auditor review of the Web Audio graph (lifecycle correctness) — the SOUND itself is the user's LISTEN at the pause.
