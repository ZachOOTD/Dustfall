# Session ACP — Kickoff Brief: foreground repro+fix of the velocity-dependent bugs, then the larger deferred bugs

> ACO took in 5 user-reported bugs, shipped the night ambient-dust gate (headless-verifiable), and
> established that two of them — speeder-dismount footprints + the random speed spike — are
> velocity/real-rate-dependent and CANNOT be reproduced in the headless harness (D150). Those, plus
> the deferred dynamic-aim-twist feel-tune (D148), are FOREGROUND work this session.

## Read these now (in order)
1. **CLAUDE.md** (auto-loaded) — rules; note the tick order + rule 8.
2. **docs/session-end-report.md** — cumulative state through ACO (top "Current state" + "ACO scope" + "Suggested next").
3. **docs/decisions.md** tail — **D150** (kinematic-velocity behavior is foreground-only to verify), **D148** (dynamic aim-twist), D147 (skipLock), D149 (live-feel harness recipe), D146 (preview MCP can't tick).
4. **docs/backlog.md** — the "ACN user-reported bugs" block (footprints + speed-spike flagged foreground-repro; sled-POI + panel-clipping deferred-larger).
5. `shared-memory/iterative-polish-discipline.md` + `preview-screenshot-tips.md`.

## What's already built
A full singleplayer desert-survival loop + a believable stylized procedural player rig (skinned, dressed, PBR, dynamic aim-twist). Night sky now reads clean (ambient dust gated off at night). A Playwright `rig-shot` harness with static pose/closeup shots + live `--scenario` mode (shrew-flee/aim-twist/rifle/night-sky/footprints). SAVE_VERSION 14.

## Session ACP focus — FOREGROUND repro+fix the velocity-dependent bugs + feel-tune aim-twist
These need a real-rate `npm run dev` session with a human (you) at the keyboard — the headless harness can't exercise kinematic `linvel` (D150). Drive each, observe, fix, re-observe.

## Priority items (in order)
1. **Speeder-dismount footprints** (`controller.ts` footstep block + `speeder.ts` mount/dismount + `playerRig.ts` gait). Repro: `npm run dev`, 3P, walk (footprints appear) → mount speeder (E) → ride → dismount (E) → walk again. If footprints/`rig.stepCount` don't resume, the gait wedged on dismount. Static analysis found no obvious fault (controller resyncs `_lastSeenStepCount` each frame; gait phase is absolute-time; `velocityY` reset on dismount) — so observe what actually breaks. Likely candidates: rig `speedMag` reading 0 post-dismount, or a state/parity desync.
2. **Random dramatic speed spike** (`controller.ts` on-foot `speed*dt` is bounded — dt clamped 0.1 in `loop.ts`; so suspect the SPEEDER, a dynamic body — `speeder.ts` `setLinvel` lerp / collision penetration). Repro: play on-foot AND on-bike; note when the spike happens (after collision? after dismount? during boost?) to localize. Fix the unbounded path (clamp linvel, or fix the state-leak).
3. **Dynamic aim-twist feel-tune** (`tuning.ts` AIM_TWIST_*) — 3P turn/strafe; tune `AIM_TWIST_TURN_GAIN` (0.10, likely bump toward 0.15-0.25) / `AIM_TWIST_BIAS` (0.18) / `AIM_TWIST_LERP` (0.12) until the upper-body lead reads natural in continuous turns.

## Stretch / then (larger deferred bugs)
- **Sled-vs-POI collision** — the sled (KinematicPositionBased) passes through POI/wreck static colliders. Needs an explicit shapecast against POI colliders before the kinematic slide moves (non-trivial). `sled.ts`.
- **Salvage-panel interior clipping** — sweep ALL panel kinds across ALL POIs; ensure interior components are visible (not buried in the hull) when the panel is open. A per-POI visual pass (the harness can screenshot POIs statically — drive the camera to each open panel).

## Autonomy contract
Ambiguous → GDD pillars + decisions realism dial → D-entry → continue. Surface only on: D107 (asset), save bumps (D81), destructive git, whole-game aesthetic shifts (lighting mood — D142).

## Stop conditions
Wall-clock / budget · 3 fix-walls on one bug (cut/log) · catastrophic block · destructive attempt · **if a bug can't be reproduced foreground either, log the finding + move on (don't blind-fix — D150 discipline).**

## Notable footguns
- **D150**: footprint/speed/gait/feel bugs are FOREGROUND-only — the headless harness's kinematic `linvel` reads 0 (`speedMag=0`). Don't try to repro or fix-and-claim them via the harness.
- **D149**: for AI/weapon-state live checks (position/event-based), the `--scenario` harness works — drive from Node, not in-page rAF; pre-dismiss the tutorial overlay (gates LMB). **D146**: preview MCP can't tick at all.
- **D147**: the harness no longer traps the cursor (`enterGame` skips PointerLock) — don't re-add a lock on automated entry.
- D107 procedural-only; rule 2 magic-numbers→tuning.ts; rule 6 no innerHTML; rule 7 box depth ≥10cm. SAVE_VERSION 14 (additive + bump to 15 for any save change).

## Verification protocol
`npm run verify` (= `tsc --noEmit`) = type gate. The velocity/feel bugs' QUALITY gate = a foreground `npm run dev` repro + observe + iterate (rule 8). The night-dust-style render-state changes can still use the `--scenario` harness.

## Begin block
1. Read CLAUDE.md, session-end-report, decisions tail (esp. D150), backlog bug block, the discipline docs.
2. `npm run verify` baseline.
3. Foreground `npm run dev`; repro the footprint bug (priority 1) → fix → re-observe.
4. TaskCreate one task per priority item; work them in order.
