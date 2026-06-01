# Session ACO — Kickoff Brief: foreground feel-tune of dynamic aim-twist, then breadth

> ACN closed the ACL rule-8 visual-triage debt: it fixed the Playwright cursor-trap, built a ticking
> `--scenario` harness, made aim-twist DYNAMIC, and verified shrew-flee / aim-twist / rifle-fire all
> PASS. What remains is a light FEEL pass on the new dynamic aim-twist (the harness underestimates the
> real continuous-turn peak), then the project is open for breadth or a player-model follow-up.

## Read these now (in order)
1. **CLAUDE.md** (auto-loaded) — rules; note rule 8 (visual iteration), the tick order.
2. **docs/session-end-report.md** — cumulative state through ACN (top "Current state" + "ACN scope" + "Suggested next").
3. **docs/decisions.md** tail — **D149** (live-feel harness recipe: Node-driven sampling + pre-clear LMB-gating overlays), **D148** (dynamic aim-twist), **D147** (automated entry must deterministically skip PointerLock), **D146** (preview MCP can't tick — use the harness or foreground), D142 (lighting mood = the big realism lever), D107 (zero-asset).
4. **docs/backlog.md** — the aim-twist feel-tune item + the rest of the backlog for breadth.
5. `shared-memory/iterative-polish-discipline.md` + `preview-screenshot-tips.md` (now documents the hidden-tab rAF freeze + the harness recipe).

## What's already built
A full singleplayer desert-survival loop + a believable stylized procedural player rig (skinned, dressed, PBR, with dynamic aim-twist). ACL's 8 features are shipped + now fully triaged (ACM static + ACN live): night-sky stars, sweeping sandstorm wall, in-storm penalty, amban rifle, desert shrew, speeder damping, worm-audio attenuation, megaWreck panels. SAVE_VERSION 14. A Playwright `rig-shot` harness with static pose/closeup shots + live `--scenario` mode (shrew-flee/aim-twist/rifle).

## Session ACO focus — feel-tune dynamic aim-twist (foreground), then pick a breadth/polish direction
The aim-twist mechanic is correct (turn-rate lead, D148) but its magnitude wants a human feel-judgment that the headless harness can't give (Node-side sampling is bursty/underestimates). This is a short top item; the bulk of ACO is whatever breadth/polish you pick after.

## Priority items (in order)
1. **Foreground aim-twist feel-tune** (`tuning.ts` AIM_TWIST_* + `playerRig.ts`) — run `npm run dev` in a real browser tab, go 3P, turn/strafe, and judge: does the upper body lead into turns naturally (not too stiff, not whippy, no snap, doesn't fight the walk swing)? Tune `AIM_TWIST_TURN_GAIN` (0.10 — likely bump toward 0.15-0.25), `AIM_TWIST_BIAS` (0.18 resting), `AIM_TWIST_LERP` (0.12 smoothing). Acceptance: reads as an aim-ready torso lead in motion.
2. **Pick a breadth/polish direction** (choose one, or fan out an overnight):
   - Another **fanned-out breadth overnight** (D143 lane+integrator pattern) — more procgen/POI/biome, creatures, audio, polish.
   - **In-game lighting mood** (D142 — the biggest remaining in-game realism lever; whole-game aesthetic, so surface the direction before committing).
   - **PM-D cloth physics** or **PM-S.3 torso skinning** (player-model depth).
3. **(Optional) extend the `--scenario` harness** for star-twinkle/storm-sweep in-motion feel if you want those verified without a foreground watch (the recipe is in D149 — Node-driven, shrink canvas for tick-only sampling).

## Stretch / then
- The continuous-polish + non-cycle backlog (chunk streaming A1, flagship→composite procgen, item-viewmodel fidelity remainder, per-item colliders).

## Autonomy contract
Ambiguous → GDD pillars + decisions realism dial → D-entry → continue. Surface only on: D107 (asset), save bumps (D81), destructive git, whole-game aesthetic shifts (lighting mood — D142).

## Stop conditions
Wall-clock / budget · 3 fix-walls on one feature (cut/log) · catastrophic block · destructive attempt.

## Notable footguns (verification)
- **D149**: to verify LIVE behavior, use `npm run rig-shot --scenario=<name>` (ticking) or a foreground tab — NOT the preview MCP (D146, hidden-tab rAF freeze). In the harness: drive/sample from Node (in-page rAF is throttled), and the tutorial overlay is auto-dismissed (else it gates LMB).
- **D147**: the harness no longer traps the cursor (`enterGame` skips PointerLock). Don't re-introduce a lock on any automated-entry path.
- **D148**: aim-twist is dynamic now — `_aimTwist` is driven by turn-rate, not a constant. Don't revert to a static bias.
- D107 procedural-only; rule 2 magic-numbers→tuning.ts; rule 6 no innerHTML; rule 7 box depth ≥10cm. SAVE_VERSION 14 (additive + bump to 15 for any save change).

## Verification protocol
`npm run verify` (= `tsc --noEmit`) = type gate. FEEL gate for aim-twist = a foreground 3P playtest + honest critique + iterate (rule 8). Live behavior elsewhere = the `--scenario` harness.

## Begin block
1. Read CLAUDE.md, session-end-report, decisions tail (D146-D149), backlog, the discipline docs.
2. `npm run verify` baseline.
3. Foreground `npm run dev`, feel-tune aim-twist (priority 1).
4. TaskCreate the chosen breadth/polish direction; execute (fan out if independent — D143).
