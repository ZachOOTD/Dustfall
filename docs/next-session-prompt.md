# ▶ CAMPAIGN cycle 40 — Kickoff Brief — `campaign/2026-06-18`

**Phase B is building unattended (M6→M10).** Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next"
(the AUTHORITATIVE queue) — NOT this file's hints. The loop commits every cycle and pauses only at
`### Milestone: Phase B — Build-out complete` (after M10). Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` (your inbox) + `docs/campaign/campaign-log.md` (recent cycles).
3. `docs/roadmap.md` "Up next" → Phase B unit list (M6 ④ is the LAST M6 unit).
4. `docs/decisions.md` tail (D245 chooser, D246 survival, D247 flat-audit) + `docs/backlog.md` §A.

## What's already built (one paragraph)
M6 is 3/4 done: ① the crafting chooser (signal_kit flare), ② survival is REAL + forgiving (GOD_MODE off, a Long-Dark curve + health
regen, gated by `survival-probe`), ③ 8 flat surfaces upgraded to procedural shaders. The HUD stat bars live in `src/ui/hud.ts`
(`updateHud` sets `refs.thirst/hunger/stamina/health/tempHeat/tempCold .style.width`). A feature-flag scaffold exists at
`src/config/features.ts` (created C5 / M2). Some diegetic tells ALREADY exist: a thirst brown-vignette (`THIRST_VIGNETTE_THRESHOLD`),
a low-stamina screen wobble (`STAMINA_WOBBLE_*`), and procedural audio (`src/audio/audio.ts`).

## Cycle 40 focus — **M6 ④ remove-hud-stat-bars (L) — COMPLETES M6**
Replace the always-on HUD stat bars with DIEGETIC survival feedback, behind a flag + a player opt-in. This is the payoff of C38's real
survival. **Design calls (from proposal-cycle-37, locked):** behind `FEATURES.diegeticSurvival` (default OFF) + a **pause-menu toggle**
(default-ON when the feature is enabled; the bars stay the floor a player can always switch back to). FLIP-AUTHORITY is AUTONOMOUS — the
loop MAY flip `FEATURES.diegeticSurvival` ON once the headless + visual gates pass (reversible; the user vetoes FEEL at the Phase-B review).

### Priority items (in order)
1. **Add `FEATURES.diegeticSurvival`** to `src/config/features.ts` (default false). Confirm how FEATURES is read elsewhere (the C5 infra).
2. **Gate the HUD bars** in `src/ui/hud.ts`: when diegetic mode is ON, hide the stat-bar DOM (thirst/hunger/stamina/health/temperature)
   — keep the day/time + any non-stat HUD. Wire a **pause-menu toggle** (`src/ui/menus.ts`) that flips a persisted setting
   (`src/core/settings.ts`) so the player opts in/out; default-ON-when-enabled.
3. **Diegetic tells per stat** (reuse + extend existing systems — screen effects + procedural audio + viewmodel, NO new shader programs):
   thirst → the existing brown vignette + a dry/parched audio cue + maybe a slower drink-crave; hunger → a periodic stomach-growl
   (procedural, `audio.ts`); temperature → heat-shimmer / cold-breath vignette tint + audio (hot pant / cold shiver); stamina → the
   existing wobble + heavier breathing; health (low) → a red pulse vignette + a heartbeat thud. Make each tell scale with how bad the
   stat is, and make sure the player can still READ their state without the bars (that's the whole bar — pun intended).
4. **A headless gate for the wiring** — extend the dev hooks (you have `survivalProbe`): assert that with `diegeticSurvival` ON the bar
   DOM is hidden + the diegetic effect intensities track the stat values (a `diegetic-probe` style check). The FELT read ("can I survive
   without bars?") is walk-test-pending.

### Stretch
- If M6 ④ ships with budget left, this COMPLETES M6 — the next cycle starts **M7 ⑤ procedural-wreck-overhaul**. Scout the socket grammar
  (`world/poiArchetypes.ts`, `poiComponents.ts`) for where new structure axes would slot.

## Autonomy contract
Ambiguous diegetic-design call → pick the tell that fits the moody Dune/Long-Dark tone, log a D-entry, continue — never ask the human.
Flipping `FEATURES.diegeticSurvival` ON is AUTHORIZED once gates pass (reversible; user vetoes FEEL at review). **D81 SAVE-VERSION bump
still STOPs the loop** — a settings-flag addition shouldn't need one (settings aren't the save schema), but watch it.

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify break · 3 fix-walls on one gate · a needed save-version bump (STOP+surface) · destructive
attempt. Pause: steering "pause" · the Phase-B milestone (after M10 — M6 completing does NOT pause, per checkpoint=milestone).

## Notable footguns
- This is a UI + screen-FX + audio + feel unit — the diegetic VISUAL tells get the appearance gate + Rule-8 iteration; the FEEL ("legible
  without bars") is walk-test-only — flag it honestly.
- DOM ownership (CLAUDE.md rule 5): each UI module owns its DOM; toggle visibility, don't rebuild. No `innerHTML` string concat (rule 6).
- Keep screen-FX as existing-program overlays (vignette is a DOM/CSS layer, not a new shader) to honor "no new programs".
- `verify:placement` buffers output to the END + is slow; don't kill it early (C18 zombie footgun).

## Verification protocol
`npm run verify:all` (tsc + `verify:placement` ×5 + `verify:colliders`). Diegetic VISUAL tells → the adversarial appearance gate +
Rule-8 iteration. The wiring → a dev-hook probe (bars hidden + effect intensities track stats). FELT legibility → the Phase-B walk-test.

## Begin
Read the order above → `TaskCreate` the items → add the flag → gate the bars + wire the toggle → build the diegetic tells with screenshot
iteration → probe + `verify:all` → `/session-end`. Boot fresh from FILES; don't trust chat memory.
