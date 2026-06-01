# Session ACN — Kickoff Brief: finish the ACL live-feel triage in a TICKING environment

> ACM verified the STATIC layer of the ACL visual features (geometry, wiring, viewmodels — all
> read correctly) but the headless preview MCP **cannot exercise per-frame behavior**: its tab is
> `document.visibilityState:"hidden"`, so the browser throttles `requestAnimationFrame` to zero and
> the game tick is FROZEN (D146). This session closes the remaining rule-8 debt — the *live feel* of
> the ACL features — in an environment where the tick actually advances.

## Read these now (in order)
1. **CLAUDE.md** (auto-loaded) — rules; note rule 8 (visual iteration) + the tick order.
2. **docs/session-end-report.md** — cumulative state through ACM (top "Current state" + "ACM scope" + "Suggested next").
3. **docs/decisions.md** tail — **D146** (headless-preview rAF freeze blocks live verification — the load-bearing constraint for THIS session), D145 (sweeping storm = wall deriving intensity), D144 (SAVE_VERSION 14), D143 (lane orchestration), D138 (Playwright `rig-shot` harness), D107 (zero-asset).
4. **docs/backlog.md** — the ACL block (🟡 visual-triage partial + the live-feel remainder, shrew-determinism, rifle-balance follow-ups).
5. `shared-memory/iterative-polish-discipline.md` + `preview-screenshot-tips.md` + the project memory `dustfall_preview_gotchas.md`.

## What's already built
A full singleplayer desert-survival loop + a believable stylized procedural player rig (skinned, dressed, PBR). ACL added (all tsc+boot-clean, statically triaged in ACM): aim twist-IK, speeder angular damping, worm twilight-breach audio attenuation, megaWreck ground panels, night-sky star twinkle/drift, a Dune sweeping sandstorm WALL, in-storm movement penalty, the amban rifle (ranged weapon), and the desert shrew (ambient creature). SAVE_VERSION 14.

## ⚠ THE critical constraint (D146) — read before picking a verification path
The preview MCP tab is hidden → **rAF is throttled to zero → the game tick does not advance** (`ctx.time.elapsed` is frozen; an rAF callback never fires). You worked around the `isPlaying` pointer-lock gate last session (`ctx.input.controls.isLocked = true`) but the rAF freeze is a hard browser-level block with no page-script override. **Static screenshots + sync state-evals still work** (that's how ACM verified geometry). **For anything that needs the tick — motion, feel, timed state machines, combat — DO NOT use the preview MCP.** Use one of:
- **(A) Foreground `npm run dev`** in a real browser tab the human drives, then playtest + capture. (Simplest; needs a human at the keyboard for pointer-lock + input.)
- **(B) Extend the Playwright `rig-shot` harness** (`scripts/rig-shot.mjs`) — its Chromium page is `visible`, so rAF runs. Add affordances to: equip the amban rifle + fire/reload, set `rig._aimTwist` / drive aim, and let a shrew flee. This is the autonomous path and the higher-value investment (reusable verification engine).

## Session ACN focus — live-FEEL verification + tuning of the ACL features (rule 8)
For each item: get it ticking (path A or B), observe the live behavior, critique honestly, iterate the `tuning.ts` ACL constants 3-5 rounds.

## Priority items (in order)
1. **Decide + set up the ticking environment** — pick path A or B above. If B, extend `rig-shot.mjs` first (equip-item + aim-state + a creature-flee scenario). This unblocks everything else.
2. **Shrew flee AI + feel** (`enemies/shrew.ts`; SHREW_FLEE_SPEED 3.2 / FLEE_DURATION 2.4 / SPOT_DISTANCE 7) — with the tick running + player within 7m, confirm idle/wander→flee fires, the bolt looks skittish (not jittery/stuck/teleporting), and it settles back. The logic reads correct + mirrors the lizard; this is feel-tuning, not a bug hunt (but watch for a real bug now that it can actually run).
3. **3P aim-twist sweep** (`playerRig.ts` `_aimTwist`; AIM_TWIST_BIAS 0.35 / CLAMP 0.5 / LERP 0.12) — in 3P, confirm the upper body leads toward the camera naturally when turning/aiming; subtle, no clobbering the walk swing, no snap.
4. **amban rifle fire/reload** (`combat.ts` ranged path; `items.ts`) — equip it, confirm the viewmodel reads as a rifle in-hand, it fires through the ranged path + reloads on R from scrap_bullet; sanity-check balance vs scrap_gun (range 60 / dmg 3 / cd 1.6 / mag 8).
5. **Star twinkle/drift + storm-wall sweep in motion** (`sky.ts` STAR_* / `weather.ts` STORM_WALL_*) — static shots can't show animation. Confirm twinkle reads (not strobing/static), drift is slow, cloud occlusion fades stars in storms; trigger a storm (`__game.triggerStorm()` now arms the wall correctly) and watch the wall approach→engulf→pass.

## Stretch / then
- Another **fanned-out breadth overnight** (the D143 lane+integrator pattern) on more backlog (procgen/POI/biome, more creatures, audio, polish).
- Player-model: PM-D cloth physics; or the in-game **lighting mood** (D142 — biggest in-game realism lever, whole-game aesthetic, surface first).

## Autonomy contract
Ambiguous → GDD pillars + decisions realism dial → D-entry → continue. Surface only on: D107 (asset), save bumps (D81), destructive git, whole-game aesthetic shifts (lighting mood).

## Stop conditions
Wall-clock / budget · 3 fix-walls on one feature (cut/log) · catastrophic block · destructive attempt · **if no ticking environment can be established (path A needs a human; B walls), STOP and surface — do not fake live verification through the frozen preview (D146).**

## Notable footguns
- **D146**: the preview MCP tab is hidden → rAF frozen → no live behavior. This is THE gotcha this session must route around.
- **D145**: don't make downstream systems read storm-wall geometry — they read `weather.intensity`; the wall only produces it. **D144**: SAVE_VERSION is 14; further save changes are additive + bump to 15. **Tick order** has `updateShrews` after `updateLizards`.
- D107 procedural-only; rule 2 magic-numbers→tuning.ts; rule 6 no innerHTML; rule 7 box depth ≥10cm.

## Verification protocol
`npm run verify` (= `tsc --noEmit`) = type gate. QUALITY gate for the live feel = observe under a TICKING env + honest critique + iterate (3-5 rounds each), per rule 8. **Not the preview MCP** (D146).

## Begin block
1. Read CLAUDE.md, session-end-report, decisions tail (esp. D146), backlog ACL block, the discipline + preview-gotcha docs.
2. `npm run verify` baseline.
3. Establish the ticking environment (path A or B) — this is priority item 1.
4. TaskCreate one task per live-feel item (env-setup, shrew-flee, aim-twist, rifle, stars/storm-in-motion).
5. Triage each in the ticking env: observe → critique → tune the ACL `tuning.ts` consts → re-observe, 3-5 rounds.
