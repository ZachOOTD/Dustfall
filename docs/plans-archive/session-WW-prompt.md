# Session WW — Kickoff Brief

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded) — project manual, current state, architecture rules
2. `docs/session-end-report.md` — cumulative state through Session UU-2
3. `docs/decisions.md` — D1-D77. Critical for WW: none directly (palette-cleanser scope). Pay attention to D62 (terrain shader vNormal is VIEW space) ONLY if you touch shaders (you shouldn't).
4. `docs/roadmap.md` — "Overnight queue" — WW is up next
5. `docs/backlog.md` — open items

## What's already built

Dustfall is 23 sessions past start, post-MVP. UU shipped LMB-leaning
control scheme; VV shipped tuning lifts + crosshair feedback +
zero-`as any`; UU-2 shipped RMB context verbs (pack tent / release
sled rope) + controls panel refresh. Codebase is clean.

## Session WW focus

**HUD micro-polish — three visible-at-first-boot wins** (~1.5h).
Zero novel architecture; all three either clone an existing pattern
or extend an existing system. Low risk.

- **Low-stat warning vignettes** (cold = blue, thirst = brown) —
  clone `src/world/stormVignette.ts` pattern.
- **Low-stamina screen wobble** — mirror the sandworm-tremor camera
  jitter pattern.
- **Interact-prompt fade refinement** — opacity transition over
  ~120ms instead of hard-toggle.

## Priority items (in order)

1. **Low-stat warning vignettes** (~50 min — largest item).
   - Read `src/world/stormVignette.ts` to understand the existing
     architecture (it's a screen-edge tint at peak storm intensity).
   - Create `src/ui/statVignette.ts` (new module) that clones the
     pattern. Two simultaneous vignettes — cold (blue) when
     `ctx.stats.temperature < Tuning.COLD_VIGNETTE_THRESHOLD`
     (suggest 0.3), and thirst (brown/sepia) when `ctx.stats.thirst
     < Tuning.THIRST_VIGNETTE_THRESHOLD` (suggest 0.25). Both
     intensity-scaled by `(threshold - value) / threshold` so they
     ramp gradually as the stat worsens.
   - Suppress during stormVignette peak (intensity > 0.7?) so the
     three vignettes don't triple-tint the screen.
   - Hook into main.ts tick after `updateStormVignette`.
   - New Tuning constants: `COLD_VIGNETTE_THRESHOLD = 0.3`,
     `THIRST_VIGNETTE_THRESHOLD = 0.25`,
     `COLD_VIGNETTE_COLOR_HEX = 0x4060a0`,
     `THIRST_VIGNETTE_COLOR_HEX = 0x8a6038`,
     `STAT_VIGNETTE_MAX_OPACITY = 0.35`.
   - Acceptance: force-set ctx.stats.temperature = 0.1 → blue tint
     appears; reset → fades. Same for thirst (brown). Both
     simultaneously → layered.

2. **Low-stamina screen wobble** (~30 min).
   - Read the sandworm tremor logic in `src/enemies/sandWorm.ts`
     (search for "tremor" or "camera jitter" — it modulates
     `ctx.three.camera.position` with ±0.06m noise at proximity).
   - Add a new function `updateStaminaWobble(ctx, dt)` somewhere
     appropriate (could live in `src/player/controller.ts` or a
     new `src/player/wobble.ts`).
   - When `ctx.stats.stamina < Tuning.STAMINA_WOBBLE_THRESHOLD`
     (suggest 0.2), apply camera-position jitter scaled by
     `(threshold - stamina) / threshold`, capped at
     `Tuning.STAMINA_WOBBLE_MAX_M = 0.04`. Frequency ~6-8Hz via
     `sin(t*ω)`.
   - Suppress when paused or mounted (don't shake the camera while
     stationary).
   - Acceptance: sprint until stamina < 0.2 → subtle wobble visible.

3. **Interact-prompt fade refinement** (~20 min).
   - `src/ui/interactPrompt.ts` currently toggles a CSS class
     (`.show`) which gives an opacity transition via the existing
     `transition: opacity 0.15s` on `#interact-prompt` in
     `src/style.css`. Already faded! Audit the actual feel — if it
     already fades well, this priority is effectively a no-op.
     If the prompt feels too abrupt, increase the transition to
     ~120ms and add `transition: opacity 120ms ease-out` explicitly.
   - Also check `hover.passive` prompts fade at the same rate.

## Stretch goals (if budget allows)

- Add an HUD shake intensity setting to the settings panel (so
  players can disable stamina wobble if it bothers them).
- Vignette opacity could also pulse subtly during the warning state
  (sin envelope, +/- 10%) — adds urgency without being annoying.

## Autonomy contract

- When ambiguous: pick the option closest to GDD pillars + existing
  patterns. Clone stormVignette.ts shape; mirror sandworm-tremor
  pattern. Don't unify all three vignettes into a "warning manager"
  abstraction — explicit modules are cheaper than a registry for 3
  callers.
- Footgun: do NOT touch `src/persistence/save.ts` (WW keeps
  SAVE_VERSION at 6).
- Footgun: stamina wobble must respect pause + mount gates. Don't
  shake the camera while the player isn't moving.
- Never ask the human mid-session.

## Stop conditions (overnight mode)

- All 3 priority items shipped + verify passes → `/session-end`.
- 3-strike wall → `/scope-cut` against pre-committed list in
  `.claude/plans/i-want-to-set-floating-dusk.md` Session WW section.
- Catastrophic block → halt + write CAUTION in next-session-prompt.
- Destructive action attempt → halt unconditionally.

## Pre-committed scope cuts (cut top-first)

1. **Stamina wobble entirely**. Cut means WW ships vignettes + prompt
   fade only. Wobble is least essential — vignettes communicate state
   more clearly than wobble does.
2. **Brown thirst vignette**. Cut means only blue cold vignette ships.
   Cold is the more dramatic stat in this game's tone.
3. **Interact-prompt fade refinement**. 20-min win, low blast radius
   if dropped. (If the prompt already fades acceptably, this naturally
   becomes a no-op — no cut needed.)
4. **Both vignettes**. Last cut — only do if everything above already
   failed AND main work is broken. WW becomes ~30-min job of prompt
   fade + stamina wobble.

## Notable footguns

- **D62 (terrain shader vNormal is VIEW space)** — only applies if
  you touch terrain shader. WW shouldn't.
- **stormVignette.ts is the reference architecture** — do NOT
  re-invent the screen-tint pattern from scratch.
- **Camera position jitter** — must `set()` back to the original
  position each frame, NOT additively offset (otherwise the camera
  drifts). The sandworm-tremor pattern does this correctly — match it.

## Verification protocol

```
npm run verify  # = tsc --noEmit
```

Plus eval-driven preview verification:
1. tsc clean.
2. `__game.ctx.stats.temperature = 0.1` → blue vignette appears.
   Reset to 1.0 → fades. Same for thirst (brown).
3. Force-low stamina (`__game.ctx.stats.stamina = 0.1`) → camera
   wobbles subtly. Reset → wobble stops.
4. Look at any interactable → prompt fades in.
5. Save + reload → save schema unchanged (still v6).

## Begin block

Read CLAUDE.md → `docs/session-end-report.md` → `docs/decisions.md`
(skim, no critical D-entries for WW). Create TaskCreate top-level
list with the 3 priority items. Mark item 1 (`stat vignettes`) as
`in_progress`. Read `src/world/stormVignette.ts` to learn the
clone target, then create `src/ui/statVignette.ts`.
