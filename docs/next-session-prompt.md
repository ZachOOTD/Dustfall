# ▶ RESUME — Escape-pod intro · Phase 0 · T0.4 (impact → wake → desert handoff) — `campaign/escape-pod-intro`

**Cycle 7 of the escape-pod-intro campaign.** Phase 0 (the greybox spine). T0.2 (ship) + T0.3 (pod +
descent + chute gag) COMPLETE — the intro plays cockpit → corridor → pod → eject → ship-explode →
descent → parachute-gag → **impact stub**. **T0.4 is the LAST Phase 0 unit** — it completes the spine,
then the Phase 0 milestone PAUSES for the user's walk-test. Boot from `docs/campaign/campaign-state.json`
+ `docs/roadmap.md` (NOT chat memory).

## Read first
1. `CLAUDE.md` (auto-loaded) — "Where we are now"
2. `docs/campaign/campaign-state.json` — cycle 6/150, current_tier (T0.4)
3. `docs/roadmap.md` — **find the `### Milestone: escape-pod Phase 0` marker** — confirm exactly what completes Phase 0 (does it include the tutorial scaffold, or is the desert handoff enough?). The marker decides whether T0.4 splits (T0.4a handoff / T0.4b tutorial) before the pause.
4. `docs/feature-escape-pod-intro.md` — the vision (Beats 7-11: impact → wake → stepOut → tutorial → payoff)
5. `src/world/escapePodIntro/sequence.ts` (the beat ticks, `endEscapePodIntro`, `ensureInPod`) + `docs/decisions.md` D269/D270

## What's built (T0.0 → T0.3)
- The full ship + pod + descent + chute-gag flow (greybox), HUD suppression, diegetic prompts, locomotion mode-gating, survival suppressed, camera shake + screen flash reused, dev hooks (`startIntro`/`skipIntro`/`jumpToBeat`).
- `endEscapePodIntro` already: clears `intro.active`, restores HUD, hides prompt, disposes ship + pod. **R2/R3:** the desert world is boot-built + sits ready; the handoff is a TELEPORT to the spawn.

## Cycle 7 focus — T0.4: impact → blackout → wake → THE DESERT HANDOFF
Complete the spine: the crash hands the player into the real desert game. Greybox.
- **`impact` beat** — replace the stub: the hard flash + max trauma are there; add a **fade to black** (a full-screen black overlay via `introHud` — add `fadeToBlack(opacity)` / a black div) held briefly (the blackout). → `wake`.
- **`wake` beat** — come to: fade FROM black slowly (the vision: muffled/ringing — greybox can skip audio, just the visual fade), a "[ wake ]" beat. Mode `scripted`/`seated`. After a beat (or a click) → `stepOut`.
- **`stepOut` beat — THE HANDOFF (the critical completion):** teleport the player capsule to the **real desert spawn** (the normal new-game spawn — find where `setupOpeningScene`/the default spawn position is set in `main.ts`; reuse that XZ + terrain height), restore normal play, then call `endEscapePodIntro(ctx)` (clears `intro.active` → locomotion ungated, HUD restored, survival resumes, ship/pod disposed) + **mark `introComplete`** so a save won't replay it. The player is now standing in the dunes, playing the real game. **This is the R3 handoff seam — verify the camera/position transition is clean (use `cameraSnapNextFrame`).**
- **`introComplete` on handoff** — `ctx.intro` is cleared by endEscapePodIntro; ensure a subsequent `saveGameState` records `introComplete: true` (it already derives from `ctx.intro` → with intro gone it writes true; confirm). The first real save is now valid.
- **Tutorial scaffold (Beats 10-11)** — likely **T0.4b** (check the milestone marker). If Phase 0's milestone requires it: scaffold the crashed pod as a spawn-side **salvageable wreck** + a "craft a machete" hint (the real craft→pry→chute-payoff is enrichment, Phases 1/4). If the milestone is just "the spine plays + hands off," DEFER the tutorial to a later phase + note it.

### Acceptance (T0.4 / the spine)
- A full play (real new game with the flag on, OR `__game.startIntro()` then play through) runs cockpit → … → parachute-gag → impact → blackout → wake → **stepOut teleports you into the desert, you're playing the normal game** (can walk, HUD back, stats resume). `__game.skipIntro()` at any beat also lands you cleanly in the desert. A save after handoff has `introComplete: true` + does NOT replay. `verify:all` green; no SAVE_VERSION bump; flag OFF → live game byte-unchanged.

## Visual/feel gate (greybox, routine bar)
Drive the full chain (or `jumpToBeat` each) + screenshot impact (black), wake (fade), and **the desert after handoff** (you're in the real world, HUD back). Confirm the handoff is seamless (no fall-through, camera snaps), geometry disposed, no console errors. Routine bar.

## After this: the Phase 0 milestone PAUSE
When Phase 0's tiers are all Shipped (per the `### Milestone` marker), `/session-end` moves them and the
cycle **pauses** (`milestone-review`) for the **user's first full greybox-spine walk-test** (flow +
pacing — the feel the user cares about). The loop will STOP and wait for `/campaign-approve`.

## Campaign rules
ENRICH-NOT-CUT · greybox now / hero art (procedural-modeler) in Phases 1-5 · anti-punt (decompose, don't
hollow) · behind the flag · no save bump · `verify:all` (capture the real exit — don't pipe through `tail`)
+ a live check · commit each cycle · checkpoint = per phase.

## Footguns
- Keep the flag OFF by default — live game byte-identical when the intro isn't active.
- The desert spawn position: REUSE the real new-game spawn (don't hardcode a guess) so the player lands on valid terrain.
- `endEscapePodIntro` must fully restore: locomotion (mode → not-seated/clear intro), HUD, survival, and dispose ALL geometry. Verify `scene.children` round-trips.
- New body-appended HUD/overlay (the black fade) → add to `introHud.ts` `GAME_HUD_IDS` handling or ensure it's removed on end (don't leave a black overlay over the real game!).
- `introActive` gating ≠ pause. Beat state in `ctx.intro.scratch` (reset per beat).

## Verify
`npm run verify:all` (capture the real exit) + a live preview: play/`jumpToBeat` through impact→wake→stepOut → confirm you land in the desert playing (walk, HUD back, on terrain) → `skipIntro` round-trips → a post-handoff save has `introComplete:true` → 0 console errors.
