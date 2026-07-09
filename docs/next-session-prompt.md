# Campaign cycle 3 — Kickoff Brief (Sharpen & Deepen · after cycle 2: M3 shipped)

**A campaign is ACTIVE** — boot from `docs/campaign/campaign-state.json` + `campaign.md` (charter: ladder, locked constraints, sanctioned pauses). This brief is the cycle-3 hint; charter/roadmap win on conflict.

## Read these first
1. `CLAUDE.md` (auto-loaded) + `docs/campaign/campaign.md` + `campaign-state.json` + `steering.md` (inbox).
2. `docs/campaign/campaign-log.md` cycles 1-2.

## Cycle 3 focus: M4 — Ambient life beds
The desert is near-silent: `public/audio/` is EMPTY, so `soundscape.ts`'s sample stems (`day-bed`/`night-bed`/`music-*`) play silence, and the procedural wind is deliberately MUTED (`WIND_BODY_MASTER=0`, user's call — KEEP IT MUTED). Build **procedural** (zero-asset, D3 ethos) day + night ambient life beds synthesized in `src/audio/soundscape.ts` / `src/audio/audio.ts`:

- **Night bed** — sparse desert insects (filtered-noise chirps/trills, randomized intervals + pan; think lone cricket, not a chorus).
- **Day bed** — faint heat-shimmer texture + occasional distant bird call (a thin lonely cry fits the tone; sparse).
- **Crossfade by time-of-day** (`ctx.time`), duck under storms (`weather.intensity` — the existing stem-mixer logic may already provide the mix scaffolding — reuse `makeStem`/mixer gains if sensible).
- **Tone constraint**: melancholy, sparse, lonely — "audible loneliness" (GDD §9/§15). No wall-of-sound.

**Verify** (headless): `getAudioStateSnapshot()` / `__game.audioState()` — assert the new bed gains > 0 at day and night respectively, crossfade flips with `setTime`, storm ducks them; wind masters STAY 0. Consider a small rig-shot scenario (`ambient-beds`) asserting those gain states so it joins the permanent gate suite. AUDIO FEEL (does it read lonely vs annoying) = end-review human item — but keep density conservative by construction (long silences).

## Gates (every cycle)
`npm run verify:all` + `smoke-intro` + `smoke-pod-tutorial` + `pickup-take-sweep` + `survival-probe` (now asserts shade + coverage). rig-shot `--port=52xx`.

## Constraints
No endgame · no tone change · additive-save-only (bump ⇒ PAUSE) · no new pillars · **wind stays muted** · Phase-A feel-pile excluded.

## Footguns
- Audio autoplay: headless pages need the gesture-init pattern — the harness's `enterGame(true)` path handles it; assert via the state snapshot, not by "listening".
- `ctx.player.body` is REBUILT by `enterGame(dev)` — read live in harness code.
- Keep new gains wired through the existing mixer/master graph so the pause/menu mute paths still gate them.

## On stop
Session-end docs → cycle commit on `campaign/2026-07-09` → verdict → ScheduleWakeup if CONTINUE.
