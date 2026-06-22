# ▶ RESUME — M13 weapon & vehicle audio (final review-fix tier) — `campaign/2026-06-18`

**The campaign is ⏸ PAUSED at the M12 milestone** (`status: paused`, `awaiting_approval: true`). M12 sand-worm is COMPLETE (ⓕ ridges · ⓖ breach-dive · ⓗ alert audio). **The user must `/campaign-approve` to continue** — after validating the worm-attack FEEL (the C66 breach-dive) + LISTENING to the alert rumble/shake buildup (C67). On approval, the loop resumes into **M13** (the LAST review-fix tier). Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` (NOT chat memory).

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded)
2. `docs/campaign/campaign-state.json` — cycle 67/75, status (paused→active on approve), current_tier, the framework-upgrade directives in `resume_note`
3. `docs/campaign/campaign-log.md` (tail) — C65-C67 (M12) + the worm-system recon (Cycle 65 entry has the audio file/line map)
4. `docs/roadmap.md` — the M13 block (line ~180)

## What the user validates at THIS pause (M12)
- **Worm attack FEEL** (C66/D266): the lunge is now a charge → breach-and-dive (head rears to strike, then drives head-first down — no high airborne jump). Does it feel like a menacing ambush dive? (Known limit: the rigid pose see-saws the tail up on a steep dive; `SANDWORM_LUNGE_DIVE_PITCH` is the lever; a path-following dive is the deeper fix if wanted.)
- **Alert audio + shake** (C67/D267): the alert is now a quiet rumble + a growing screen-shake (no loud roar). Is the dread buildup right / mysterious? Levers: `SANDWORM_ALERT_RUMBLE_MAX`, `SANDWORM_TREMOR_SHAKE`, `SANDWORM_ALERT_DURATION`.
- Also: ⓕ removed the dorsal ridges (C65) — confirm the smoother worm reads ok, and whether the circumferential segmentation rings should also go.

## Cycle 68+ focus (after /campaign-approve) — M13 weapon & vehicle audio (the FINAL review-fix tier)
Two units; both need the user's EARS at the M13 milestone pause (audio can't be self-verified — code-auditor the graph, user LISTENS):
- **ⓘ gunshot + reload SFX for ALL guns** [feat] — the guns (`scrap_gun`, `amban_rifle`, `pulse_rifle`, `energy_pistol`) need a fire SFX + a reload SFX. Check `src/audio/audio.ts` for existing weapon sounds (grep `playHit`/`playShot`/`gun`/`fire`) + `src/player/combat.ts` for where fire/reload happen (the fire path + the R-reload). Synthesize per-weapon-flavored Web Audio shots (a sharp transient + a tail; the pulse/energy guns get a zappier synth, the scrap_gun/amban a punchier crack) + a reload click/clack. Honor the C16 Web-Audio lifecycle discipline (no leaked nodes). Likely 1 cycle (or split shots/reload across 2 if deep).
- **ⓙ speeder engine → a lower-pitched, smoother hum** [polish] — the speeder hum is currently too high/harsh. Find the speeder engine audio (grep `speeder`/`hum`/`engine` in `audio.ts`); lower the pitch + smooth it (gentler filter, less harsh harmonics). `src/world/speeder.ts` drives it. Likely 1 cycle.

## Stop / pause
M13 has a milestone marker after it (`### Milestone: M13 audio + Phase-B review fixes complete`). When ⓘ + ⓙ ship, the cycle PAUSES at the M13 milestone — the user LISTENS (gunshots/reload/speeder hum). **That is the end of the M11→M13 review-fix pass** — the user then sequences the next block (the Skyfall hero wreck + the cave rework are dedicated solo sessions, NOT the loop). **Headroom: 67/75 (~8 left)** — M13 ≈ 2-3 cycles; pauses ~cycle 69-70, comfortably within the cap.

## Autonomy contract
Autonomous; ambiguous → realism-forward + a D-entry + continue. Audio gates = a code-auditor pass on the Web Audio graph (lifecycle correctness) + the user's LISTEN. PAUSE at the M13 milestone after both units ship.

## NOT in the loop (dedicated solo sessions)
The **Skyfall crashed-ship** (new hero wreck + fire-from-wreck) and the **CAVE rework** — `docs/backlog.md` §A. Do NOT start them in the loop. Also queued for the user: ⑯ drop-pod-intro, ⑰ pickup-instancing (human-attended).

## Footguns
- **Audio can't be self-verified** → code-auditor the Web Audio graph (C16 lesson: detach LFOs, `disconnect()` on stop, no tail-clicks, pause-safe, no leaked oscillators); the SOUND is the user's LISTEN.
- **Determinism/save:** audio is runtime-only — no scatter-stream or save impact (no D81 bump).
- **Reuse the existing audio patterns** in `audio.ts` (the synth helpers, the `sfx` bus, the noiseBuffer) rather than inventing a new pipeline.

## Verify protocol
`npm run verify:all` (tsc + placement 0/0 ×5 + colliders 0/40). Audio: a code-auditor review of the Web Audio graph — the SOUND is the user's LISTEN at the M13 pause.
