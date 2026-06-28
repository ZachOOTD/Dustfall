# ▶ RESUME — Escape-pod intro · Phase 0 · T0.2b (Beats 0-2 flow + HUD suppression) — `campaign/escape-pod-intro`

**Cycle 4 of the escape-pod-intro campaign.** Phase 0 (the greybox spine). T0.0 framework + T0.1
new-game/save wiring + **T0.2a greybox SHIP (walkable cockpit + corridor)** shipped. Boot from
`docs/campaign/campaign-state.json` + `docs/roadmap.md` (NOT chat memory).

## Read first
1. `CLAUDE.md` (auto-loaded) — "Where we are now"
2. `docs/campaign/campaign-state.json` — cycle 3/150, current_tier (T0.2b)
3. `docs/feature-escape-pod-intro.md` — the vision (Beats 0-2) + BUILD PLAN (Phase 0)
4. `docs/decisions.md` (tail) — **D269** (architecture) + **D270** (T0.1 wiring)
5. `src/world/escapePodIntro/sequence.ts` (the dispatch + `tickCockpit`) + `shipScene.ts` (the greybox + `getShipSpawn`)

## What's built (T0.0 → T0.2a)
- Framework + new-game/save wiring + dev hooks (`__game.startIntro()` force-starts; `skipIntro()`; `jumpToBeat(beat)`).
- Greybox ship (cockpit + corridor + window/planet) built on the cockpit beat; capsule placed facing the window, mode `walk`; ship torn down on `endEscapePodIntro`.
- Locomotion mode-gating (`controller.ts` reads `ctx.intro.mode`); survival drain suppressed during the intro (`survival.ts`).
- **Verified walkable** from cockpit/window, corridor mouth, corridor interior. Capsule stands on the colliders.

## Cycle 4 focus — T0.2b: the Beat 0-2 FLOW + HUD suppression
Make the cockpit→corridor section actually PLAY as a sequence (still greybox).
- **Beat controllers** (`sequence.ts` — add `tickCheckEngines`, `tickCorridor`; refine `tickCockpit`):
  - `cockpit` — open **seated** (mode `seated`: look-only, no WASD) looking out the window; after a short beat (timer or a keypress/click), a diegetic **"check engines"** prompt appears + the mode flips to `walk` → `advanceBeat()` to `checkEngines`. (The seated-open is the vision; T0.2a used walk for inspection.)
  - `checkEngines` (mode `walk`) — the player walks toward/through the corridor opening; crossing into the corridor (a Z-threshold check on the capsule) → `advanceBeat()` to `corridor`.
  - `corridor` (mode `walk`) — walk to the far dead-end; reaching it (Z-threshold near the dead-end) triggers the disaster → for greybox, `advanceBeat()` to `enterPod`, which can be a **stub** that calls `endEscapePodIntro` (hand to the desert) until T0.3 builds the pod/descent.
  - Triggers read the capsule world Z (corridor runs +Z from `SHIP_ORIGIN`; mouth ≈ z 2.6, dead-end ≈ z 14.6). Keep it simple + robust.
- **Diegetic prompts** — reuse the interact-prompt / a small centered hint (see `updateInteractPrompt` / tutorial hint patterns) for "check engines" + (optionally) "go to the engine bay". Greybox text is fine.
- **HUD suppression during the intro (the T0.2a-noted gap)** — hide the game HUD (clock, storm-warning, hotbar) while `introActive`. Cleanest: toggle the in-game HUD DOM container(s) hidden on intro start + restored at handoff (or gate `updateHud`/`updateHotbar` to also hide their elements). Do NOT hide the diegetic beat prompts. Verify the intro view is clean (no clock/hotbar) in the preview.
- **Broader system suppression (optional, if cheap)** — if desert AI/weather visibly interfere, add `introActive` early-outs (raiders/lizards/worm/weather-vignette). Lower priority — the player is offset far away.

### Acceptance
- `__game.startIntro()` (or flag ON + new game) → you open seated in the cockpit looking at the planet → "check engines" prompt → you can walk → through the corridor → at the dead-end it advances (→ enterPod stub → desert, until T0.3). **No game HUD visible during the intro.** `__game.jumpToBeat('corridor')` drops you in the corridor. `__game.skipIntro()` still hands back cleanly. `verify:all` green; no SAVE_VERSION bump.

## Visual/feel gate (greybox, routine bar)
Drive `__game.startIntro` + screenshot the real FP view at each beat (seated cockpit, mid-corridor, dead-end). Confirm: HUD hidden, prompt readable, the flow advances. Routine bar (no sev≥2). Hero art is Phase 3.

## Then (rest of Phase 0)
T0.3 greybox descent + seated pod + the parachute-gag fallback · T0.4 greybox wake → desert handoff
(pod-as-spawn seam) → tutorial scaffold + smoke check. **Phase 0 milestone → PAUSE** for the user's
first walk-test (whole flow + pacing).

## Campaign rules
ENRICH-NOT-CUT · greybox now / hero art (procedural-modeler + real FP-view gate) in Phases 1-5 ·
anti-punt · behind the flag · no save bump · `verify:all` + a live check each cycle · commit each
cycle · checkpoint = per phase. Steer via `docs/campaign/steering.md`.

## Footguns
- Keep the flag OFF by default — live game byte-identical when the intro isn't active.
- **Don't pipe `verify:all` through `tail`** — `tail`'s exit code (0) masks a tsc failure. Capture the real exit (`... > out 2>&1; echo EXIT=$?`).
- `introActive` gating ≠ pause (D269). Restore the HUD on handoff so the normal game isn't left HUD-less.
- Beat triggers on capsule Z must use WORLD coords (`SHIP_ORIGIN` offset). The KCC walks box colliders (R4).

## Verify
`npm run verify:all` (capture the real exit code) + a live preview: `__game.startIntro()` → screenshot the seated cockpit (HUD hidden) → `jumpToBeat('corridor')` → walk/teleport to the dead-end → confirm advance + no errors.
