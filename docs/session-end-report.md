# Dustfall — Session-end report

Cumulative state. Rewritten (and pruned) at each `/session-end`. Per-session detail lives in
`docs/changelog.md` (append-only); per-cycle campaign detail in `docs/campaign/campaign-log.md`.

## Current state (2026-07-08)

**The game is a complete, playable, shippable browser + desktop survival game.** The escape-pod
intro is the **released opening** (2026-07-05, LIVE at https://zachootd.github.io/Dustfall/). This
session shipped two standalone features:

1. **Crafting rework — pickup-gated discovery (D277).** Replaced the Session-TT combine-to-discover
   input slots with a model where a recipe unlocks once the player has collected all its ingredient
   TYPES. NEW `InventoryState.collectedItemTypes` (SAVE_VERSION 15→**16**, additive + a pre-v16 seed
   migration), `recipeCardState`/`unlockNewlyEligible` in `recipeDiscovery.ts` hooked into `addItem`,
   a category CARD-GRID `craftingMenu.ts` (deleted the input slots + chooser + partial-hints + the TAB
   `recipeBookPanel.ts`). Net −723 LOC. Verified: tsc, a NEW `craft-unlock` rig gate, `smoke-pod-tutorial`,
   and a save v16 round-trip + tampered-pre-v16 migration (no card regresses).
2. **Desktop packaging — Tauri v2 (D278).** `npm run tauri:build` → **Dustfall.exe (9.3 MB)** + an NSIS
   installer. NEW `src-tauri/` (`csp:null` for Rapier WASM/blob, `mainBinaryName Dustfall`, 1280×800
   window, on-brand icon); `build:desktop`=`cross-env VITE_BASE=/ vite build` (GH-Pages build
   byte-identical). Toolchain installed on this machine (Rust `stable-msvc` + VS 2022 Build Tools).
   Launch-tested: native window renders the WebGL title, 13 WebView2 procs, per-app localStorage saves.

**Verify baseline:** `npm run verify` (tsc) — Dustfall opts out of the tier-ladder. `verify:all` adds
placement + colliders for world work. Save schema at **v16**.

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
This session added no gameplay tuning constants. Desktop window size lives in `src-tauri/tauri.conf.json`
(1280×800). Crafting knob (D277): if the 19-card `?` grid reads as a grind-checklist, dim far-off cold cards.

## Suggested next (user picks — no mandated direction)
1. A net-new arc the user chooses: endgame goal (Long-Storm finale + ledger), a new enterable hero wreck,
   or the cave multi-chamber expansion.
2. Pickup instancing (perf, human-attended) or ambient life beds (audio) — both verified-open + buildable.
3. Desktop shipping polish (code signing → itch/Steam) if distribution is the goal.

## State at session end
- **Git:** two features uncommitted at report time → committed at session-end (crafting rework; desktop
  packaging) as two commits on `master`. Prior escape-pod work already on `master`.
- **Artifacts:** `src-tauri/target/release/Dustfall.exe` + `.../bundle/nsis/Dustfall_0.1.0_x64-setup.exe`
  (target/ gitignored, 1.3 GB).
- **Save:** localStorage v16; the localhost test save was cleared post-verification.
- **Docs:** `decisions.md` at 58 entries — archival due (>50 threshold); deferred to a dedicated pass
  (backlog `[debt]`).

## Time + token spend
~One attended session (crafting rework + full desktop toolchain install + build). Token spend elevated
vs a polish session — the crafting rework was a multi-phase build+verify, and the desktop packaging
included two multi-GB toolchain installs (waited-on, not token-heavy) + two Rust builds. Roughly within
1–1.5× a normal feature session on output tokens (the toolchain waits were wall-clock, not tokens).

## Iteration-discipline self-check (rule 8)
The crafting card grid (visual) WAS iterated: build → screenshot → critique → fix across ~3 rounds
(layout/scrollbar/chips, then real cold/warm/unlocked/craftable states verified via a non-dev inventory,
then the detail footer + a real craft), plus DOM-level state verification. Not shipped on tsc-clean alone.
The desktop app's title render was screen-captured (native window). No shallow-ship flags.
