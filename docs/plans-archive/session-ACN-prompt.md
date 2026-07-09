# Next session — Kickoff Brief (after 2026-07-08: crafting rework + desktop packaging)

## Read these first (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now".
2. `docs/session-end-report.md` — cumulative state.
3. `docs/backlog.md` — **⚠ known-stale** (it even lists "full roadmap refresh" as an open item); many 2026-06 triage items already shipped. **Verify each candidate against the actual code before proposing it** — the last session found the worm overhaul, reload SFX, and the cave rework all already shipped.
4. `docs/decisions.md` (recent tail + friction-grep) + `docs/roadmap.md` + `docs/architecture.md`.

## What's built
The full game loop ships: procedural 2400m seeded desert, survival stats + the 7-day Long-Storm countdown, wrecks/salvage/POIs (socket-grammar procgen fleet + hand flagships + the wreck-yard biome + Sarlacc pit), creatures (lizard/shrew/vulture/sandworm/companion), sled+rope, hover speeder, procedural audio (wind + music) + weather/sky. The **escape-pod intro is the released opening** (2026-07-05, live). Crafting is now **pickup-gated** (collect ingredient TYPES → a card unlocks; card-grid UI). The game is also an **installable Tauri desktop app** (`npm run tauri:build` → Dustfall.exe + NSIS installer).

## This session's focus: the user picks the direction
There is no single mandated next thing — the escape-pod campaign is complete and the backlog is thin/stale. Surface a curated set and let the user steer. **Verified-open** (checked in code 2026-07-08):
- `[perf]` **Pickup instancing** — no `InstancedMesh` in `src/pickups/pickups.ts`; ~382 world pickups ≈ 75% of draw calls. Measured plan in backlog §A. Build human-attended (the interaction raycast needs an `instanceId` resolver — confirm every pickup still collects).
- `[polish]` **Ambient life beds are silent** — `soundscape.ts` loads `day-bed`/`night-bed` from an empty `/audio/*.ogg` → silence. Synthesize procedural day-bird / night-insect beds (the project's no-sample ethos; wind + music already sound).

Bigger net-new (scope first): **endgame goal arc** (turn the Long-Storm countdown into a real finale + days-lasted ledger); a **new enterable hero wreck** (Skyfall — research-first); the **deep-cave multi-chamber expansion** (gated on a sub-heightfield-collision walk-test).

**Desktop follow-ups** (from D278, if shipping-polish is wanted): Windows code signing (kills the SmartScreen warning), file-based saves via the Tauri `fs` API (localStorage is wiped on uninstall), tighten `csp: null` → a scoped policy, re-profile under WebView2.

## Owed human walk-tests (yours, headless can't judge)
The big pile in backlog §A (survival-curve feel, diegetic-HUD, salvage pry-feel, sandworm attack feel, speeder handling, 3P camera, the wreck-yard/Sarlacc/mega-wreck reads). Plus this session's: the desktop app's NEW GAME → intro → play click-through in the native window (the runtime is proven — title renders, WASM boots — but the full play pass wants a human).

## Autonomy contract
When a call is ambiguous and reversible, pick the sensible default, log a D-entry with a friction-score, and continue — don't block on the user for low-stakes choices. Surface only genuine forks (a save-schema change, a destructive action, a direction the user must own).

## Stop conditions
All-picked-work shipped · 3 consecutive fix walls on one gate · a destructive-action need · a catastrophic block. On stop: run `/session-end` (verify → changelog → CLAUDE.md → roadmap → decisions → backlog → report → this file → commit hand-off).

## Verification protocol
Dustfall opts out of the tier-ladder. `npm run verify` (= `tsc --noEmit`) is the baseline; add `npm run verify:all` (placement + colliders) for world/POI work. Visual/feel work: `npm run dev` + the preview MCP (DOM overlays) or the rig-shot / ship-shot / model-stage harnesses — NEVER ship visual work on `tsc`-clean alone (CLAUDE.md rule 8). Desktop: `npm run tauri:build` (needs cargo on PATH: `export PATH="$HOME/.cargo/bin:$PATH"`).

## Notable footguns
- `vite.config.ts` reads `process.env.VITE_BASE` directly (no `loadEnv`) — a `.env.<mode>` file does NOT reach `base`; use a real shell env var (D278).
- SAVE_VERSION is **16** now; any save touch is additive-only (D81) + needs a pre-v16-style migration.
- `src-tauri/target/` (1.3 GB) is gitignored — never stage it.
- The crafting `?`-card grid reveals the total recipe count; if it reads as a grind-checklist, dim far-off cold cards (D277 knob).
