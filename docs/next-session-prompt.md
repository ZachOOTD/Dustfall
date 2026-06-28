# ▶ RESUME — Escape-pod intro · Phase 0 · T0.1 (new-game flow + save marker) — `campaign/escape-pod-intro`

**Cycle 2 of the escape-pod-intro campaign.** Phase 0 (the greybox spine). T0.0 (the sequence
framework scaffold) shipped C1. Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md`
(NOT chat memory).

## Read first
1. `CLAUDE.md` (auto-loaded) — "Where we are now"
2. `docs/campaign/campaign-state.json` — cycle 1/150, current_tier (T0.1)
3. `docs/feature-escape-pod-intro.md` — the BUILD PLAN (Phase 0) + the "Pre-build review" (R1-R10)
4. `docs/decisions.md` (tail) — **D269** (the intro architecture contract)
5. `src/world/escapePodIntro/sequence.ts` — the framework you're wiring into (read the contract comment)

## What's built (T0.0)
The inert sequence framework: `FEATURES.escapePodIntro` (off), `ctx.intro?: IntroState`, the beat
state machine (`BeatId`/`BEAT_ORDER`/`IntroState`/`IntroControlMode`), the manager
(`startEscapePodIntro`/`advanceBeat`/`jumpToBeat`/`endEscapePodIntro`/`updateEscapePodIntro`/`introActive`),
and `updateEscapePodIntro` inserted in the main tick before `updatePlayer`. Nothing starts the intro yet.

## Cycle 2 focus — T0.1: new-game flow + save marker + entry point + dev hooks
Wire the framework into the boot/new-game path so a NEW game (with the flag on) enters the intro,
without breaking the existing game (flag off / dev mode = current spawn). Still **greybox** (no art).
- **New-game branch** (`main.ts` — `handoffToGame` / the `createTitleOverlay` `onNewGame` callback ~782; `setupOpeningScene` ~553): when `FEATURES.escapePodIntro` && a fresh new game (not Continue, not devMode) → `startEscapePodIntro(ctx)` instead of the normal spawn. Dev mode + Continue → the current path, untouched.
- **`introComplete` save marker (R1):** additive field on the save (default **true** for legacy → never replay); a post-intro save → no replay; mid-intro = unsaved; the first save is at the desert handoff. **No SAVE_VERSION bump** (additive). Disable the save action while `introActive(ctx)`.
- **Entry point (R6):** decide how "new game" reaches the intro vs the current "click to begin" overlay (the intro should start cleanly on new game).
- **Dev hooks (`debugPanel.ts`):** `__game.startIntro()` (force-start for testing), `__game.skipIntro()` (→ `endEscapePodIntro` → desert handoff), `__game.jumpToBeat(beatId)`. These make T0.2-T0.4 iterable fast.
- **Gating stub:** add the `introActive(ctx)` guard where it's needed at this stage (at minimum, the save-block; full system suppression comes as beats need it in T0.2+). Keep the flag OFF by default so the live game is unchanged.

### Acceptance
- Flag OFF (default) + dev mode → the game boots exactly as today (`verify:all` green). Flag ON + new game → `ctx.intro.active` true, beat `cockpit` (even if no beat content yet — T0.2 adds it); `__game.skipIntro()` returns to a normal desert spawn; a save made post-handoff does NOT replay the intro. No SAVE_VERSION bump.

## Then (rest of Phase 0)
T0.2 greybox ship · T0.3 greybox descent + seated pod + the parachute-gag fallback · T0.4 greybox
wake → desert handoff (the pod-as-spawn-wreck seam) → tutorial scaffold + the `feature-escape-pod-intro`
smoke check. **Phase 0 milestone → PAUSE** for the user's first walk-test (the whole flow + pacing).

## Campaign rules
ENRICH-NOT-CUT · hero work → procedural-modeler + real FP-view gate (not yet — T0.1 is logic) ·
anti-punt · behind the flag · no save bump · `verify:all` each cycle · commit each cycle · checkpoint
= per phase. Steer via `docs/campaign/steering.md`. Build-until-done (max-cycles 150 guardrail).

## Footguns
- Keep the flag OFF by default — the live game (on master) must stay byte-identical when the intro isn't active.
- The intro/GameContext type import is circular but type-only (fine). Don't add a runtime cycle.
- `introActive` gating ≠ pause (D269) — don't freeze the intro's own tick.

## Verify
`npm run verify:all` (tsc + placement 0/0 ×5 + colliders 0/40). Plus, once `__game.startIntro` exists, a quick live-preview eval that flips the flag + starts the intro + confirms `ctx.intro.active` + `skipIntro` hands back cleanly.
