# Session ACM — Kickoff Brief: /visual-triage the ACL features (close the rule-8 debt), then breadth

> The ACL overnight shipped 8 backlog features (tsc PASS + boot-clean) but the new VISUAL ones
> shipped UN-iterated (rule 8 debt). This session: **visually verify + iterate the ACL visuals**,
> then optionally continue breadth (another fanned-out overnight) or a player-model follow-up.

## Read these now (in order)
1. **CLAUDE.md** (auto-loaded) — rules; note the updated tick order (now includes `updateShrews`).
2. **docs/session-end-report.md** — full state through ACL.
3. **docs/decisions.md** tail — **D143** (file-ownership-lane overnight orchestration), **D144** (SAVE_VERSION 13→14 shrew+storm-wall), **D145** (sweeping storm = directional wall deriving the intensity carrier), D141 (player PBR+bump+baked-AO), D107 (zero-asset), D81 (additive save).
4. **docs/backlog.md** — the ACL block (shipped + the visual-triage / shrew-determinism / rifle-balance follow-ups) + the rest of the backlog for further breadth.
5. `shared-memory/iterative-polish-discipline.md` (the realism impact-order + "verify under form lighting") + `preview-screenshot-tips.md`.

## What's already built
A full singleplayer desert-survival loop + a believable stylized procedural player rig (skinned, dressed, PBR). ACL added: aim twist-IK, speeder angular damping, worm twilight-breach audio attenuation, megaWreck ground panels, night-sky star twinkle/drift, a Dune sweeping sandstorm WALL, in-storm movement penalty, the amban rifle (ranged weapon), and the desert shrew (ambient creature). SAVE_VERSION 14.

## Session ACM focus — VISUAL-TRIAGE the ACL features (rule 8)
These compiled + boot clean but were never looked at. Verify each renders as intended, then iterate (3-5 rounds for tuning). Use `npm run rig-shot --lit=form` + the preview MCP / `__game` evals. Iterate the constants in the `tuning.ts` "ACL" block.

## Priority items (in order)
1. **Night-sky stars** (`sky.ts`, STAR_* consts) — set night time, screenshot the sky. Confirm twinkle reads (not strobing/static), drift is slow/natural, cloud occlusion fades stars during storms. Tune STAR_TWINKLE_SPEED/DEPTH, STAR_DRIFT_RATE, STAR_STORM_STATE_FLOOR.
2. **Dune sweeping sandstorm** (`weather.ts`, STORM_WALL_* consts) — trigger a storm (`__game` debug / `triggerStorm`), watch the wall approach → engulf → pass. Confirm the intensity ramp feels like a wall (not a global fade), dust biases along travel dir, timing isn't too fast/slow. Tune STORM_WALL_WIDTH/SPEED/SPAWN_DIST/FALLOFF. (This is the riskiest — it reworked weather; watch for visual regressions in fog/sky/vignette.)
3. **Desert shrew** (`enemies/shrew.ts`, SHREW_* consts) — frame a shrew in-world (they procgen-spawn; find one or add a temporary dev-spawn). Confirm the procedural model reads as a small critter (not broken/inside-out), and the flee AI looks skittish (not jittery/stuck). Tune model + SHREW_FLEE_SPEED/DURATION.
4. **3P aim-twist** (`playerRig.ts` `_aimTwist`) — in 3P, confirm the upper body leads toward the camera naturally when turning/aiming (subtle, no clobbering the walk swing, no snap). Tune AIM_TWIST_BIAS/LERP.
5. **amban rifle** (`items.ts`/`combat.ts`) — equip it, confirm the viewmodel reads as a rifle + it fires/reloads through the ranged path; sanity-check balance vs scrap_gun.

## Stretch / then
- Another **fanned-out breadth overnight** (the D143 lane+integrator pattern) on more backlog (procgen/POI/biome, more creatures, audio, polish).
- Player-model: PM-D cloth physics; or the in-game **lighting mood** (D142 — biggest in-game realism lever, whole-game aesthetic, surface first).

## Autonomy contract
Ambiguous → GDD pillars + decisions realism dial → D-entry → continue. Surface only on: D107 (asset), save bumps (D81), destructive git, whole-game aesthetic shifts (lighting mood).

## Stop conditions
Wall-clock / budget · 3 fix-walls on one feature (cut/log) · catastrophic block · destructive attempt.

## Notable footguns
- **D145**: don't make downstream systems read storm-wall geometry — they read `weather.intensity`; the wall only produces it. **D144**: SAVE_VERSION is 14; further save changes are additive + bump to 15. **Tick order** now has `updateShrews` after `updateLizards`.
- Preview-MCP wedges mid-session (use `npm run rig-shot` / restart if it hangs). Storm has a multi-second timeline — be patient when capturing it.
- D107 procedural-only; rule 2 magic-numbers→tuning.ts; rule 6 no innerHTML; rule 7 box depth ≥10cm.

## Verification protocol
`npm run verify` (= `tsc --noEmit`) = type gate. QUALITY gate for the visuals = screenshot + honest critique + iterate (3-5 rounds each), per rule 8.

## Begin block
1. Read CLAUDE.md, session-end-report, decisions tail (D143-D145), backlog ACL block, the discipline docs.
2. `npm run verify` baseline.
3. TaskCreate one task per ACL visual feature (stars, storm, shrew, aim-twist, rifle).
4. Visual-triage each: capture → critique → tune the ACL `tuning.ts` consts → re-capture, 3-5 rounds.
