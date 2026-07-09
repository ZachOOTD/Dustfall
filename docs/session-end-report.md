# Dustfall — Session-end report

Cumulative state. Rewritten (and pruned) at each `/session-end`. Per-session detail lives in
`docs/changelog.md` (append-only); per-cycle campaign detail in `docs/campaign/campaign-log.md`.

## Current state (2026-07-08)

**The game is a complete, playable, shippable browser + desktop survival game.** The escape-pod
intro is the **released opening** (2026-07-05, LIVE at https://zachootd.github.io/Dustfall/).

**This session (round ACN, attended) — cockpit-glass playtest fixes** (D279-D280; one commit `07a818d`,
all in `src/world/escapePodIntro/shipScene.ts`). A rapid live-feedback round sealing + cleaning the
intro cockpit dome glass:
1. Removed a floating hazard placard on the port collar foot (out-of-place yellow rectangle).
2. **Side-closure glass now connects to the hull** — its collar-side edge lands on the collar/shell
   forward ring with a small overlap (`CLOSURE_OUT`/`CLOSURE_AFT`), and it's `DoubleSide` so it never
   back-face-culls to a see-through hole from the back-of-cockpit vantage.
3. **Crown ROOF CAP added** — the dome was open above the crown ring (looking up showed space); glass
   panes now loft from the crown ring to the shell forward ring (sampled by x → meet the ceiling exactly,
   no top-corner slivers), framed by new roof meridian ribs so every pane edge sits on a mullion.
4. **All "wrap" glass (side closures + roof) → a flat unlit tint** (`_glassRoof`) so it reads uniform;
   the sheen-tuned `_glass` is now front-window-only (fixes the view-dependent bright-triangle artifacts).

tsc clean; every fix render-verified via `scripts/ship-shot.mjs` (seated / back-left / look-up, plus
cranked-opacity coverage checks) — the preview MCP wedges on this scene, so ship-shot is the gate.

**Prior 2026-07-08 features** (see changelog): crafting rework — pickup-gated card grid (D277,
SAVE_VERSION **16**); Tauri v2 desktop packaging → Dustfall.exe (D278); display-mode settings.

**Verify baseline:** `npm run verify` (tsc) — Dustfall opts out of the tier-ladder. `verify:all` adds
placement + colliders for world work. Save schema at **v16** (untouched this session).

## What works end-to-end
Single-player: New Game → the escape-pod intro (cockpit → eject → descent → crash → wake → step out →
craft-a-machete tutorial) → the open desert loop — survive (thirst/heat/cold/hunger/stamina, the 7-day
Long Storm), scavenge wrecks (tactile pry+extract salvage), craft via the new pickup-gated card grid,
build camp (fire/tent/bedroll/lantern/locker/grill), hunt/cook creatures, tow a sled / ride the speeder,
explore the wreck-yard biome + Sarlacc pit. Continue restores a real save (no intro replay). Runs
identically in-browser and as the Tauri desktop app.

## Known issues / partials
See `docs/backlog.md` (⚠ stale — verify candidates against code before acting). The large owed pile is
the §A human walk-tests / in-motion feel-tunes (survival curve, diegetic HUD, salvage/sandworm/speeder/3P
feel) — headless can't judge these. Verified-open buildable: pickup instancing (perf), ambient life beds
(silent audio). Desktop follow-ups: code signing, file-based saves, CSP tighten, WebView2 re-profile.

## Constants / knobs worth tuning
This session added no gameplay tuning constants. New cockpit-glass tunables live in `shipScene.ts`:
`CLOSURE_OUT`/`CLOSURE_AFT` (side-glass-to-hull overlap) and the `_glassRoof` material (flat wrap-glass
tint). Desktop window size in `src-tauri/tauri.conf.json` (1280×800).

## Suggested next (user picks — no mandated direction)
1. A net-new arc the user chooses: endgame goal (Long-Storm finale + ledger), a new enterable hero wreck,
   or the cave multi-chamber expansion.
2. Pickup instancing (perf, human-attended) or ambient life beds (audio) — both verified-open + buildable.
3. Desktop shipping polish (code signing → itch/Steam) if distribution is the goal.
   (More cockpit/world playtest-fix rounds if the user keeps walk-testing — this session was one such round.)

## State at session end
- **Git:** clean — this session's fixes committed `07a818d` + pushed to `master` mid-session (user asked).
  The session-end doc updates are the only uncommitted change (commit-handoff below).
- **Save:** localStorage v16 (untouched this session).
- **Dev server:** a Vite dev server was left running on **port 5180** (`preview_start` "dustfall") for the
  user's live playtest; ship-shot harness servers self-reap.
- **Docs:** `decisions.md` at 60 entries — archival due (>50-entry threshold, ~30K tokens, under the 40K
  hard threshold); deferred again to a dedicated pass (backlog `[debt]`).

## Time + token spend
~One attended live-feedback session (a single file, `shipScene.ts`). Output-token cost was elevated for a
"polish" session because it was render-heavy: ~30+ `ship-shot.mjs` captures across many diagnostic +
verification rounds (each screenshot is read back into context). Roughly ~1× a normal feature session on
output tokens despite touching one file — the cost was in the iterate→screenshot→critique loop, not code volume.

## Iteration-discipline self-check (rule 8)
STRONG PASS. This was a pure visual/feel session and it was iterated far beyond the rule-8 bar — the
build→screenshot→critique→iterate loop ran the full length of the session with the user in the loop:
placard → side-gap → roof-open → top-slivers → sheen-artifacts, each DIAGNOSED first (cyan/magenta pane
tagging, opacity-crank coverage checks, glass-hidden structure shots) before the fix, then re-verified
from multiple vantages. Zero ship-after-one-edit; no shallow-ship flags.
