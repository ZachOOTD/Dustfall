# Next session — Kickoff Brief (after 2026-07-08 round ACN: cockpit-glass fixes)

## Read these first (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now".
2. `docs/session-end-report.md` — cumulative state.
3. `docs/backlog.md` — **⚠ known-stale**; many 2026-06 triage items already shipped. **Verify each candidate against the actual code before proposing it.**
4. `docs/decisions.md` (recent tail + friction-grep) + `docs/roadmap.md` + `docs/architecture.md`.

## What's built
The full game loop ships: procedural 2400m seeded desert, survival stats + the 7-day Long-Storm countdown, wrecks/salvage/POIs (socket-grammar procgen fleet + hand flagships + the wreck-yard biome + Sarlacc pit), creatures (lizard/shrew/vulture/sandworm/companion), sled+rope, hover speeder, procedural audio + weather/sky. The **escape-pod intro is the released opening** (2026-07-05, live). Crafting is **pickup-gated** (card grid, SAVE_VERSION 16). The game is an **installable Tauri desktop app**. The intro **cockpit dome glass is now sealed + clean** (round ACN: side glass connects to the hull, roof glassed + framed, all wrap glass reads uniform).

## This session's focus: the user picks the direction
No single mandated next thing — the escape-pod campaign is complete; the backlog is thin/stale. Surface a curated set and let the user steer. If the user keeps walk-testing the intro/world, expect more **playtest-fix rounds** (like ACN) — treat each as: reproduce via the right harness (`ship-shot.mjs` / `pod-*` / `rig-shot`), diagnose before editing, iterate with screenshots, verify from multiple vantages. **Verified-open buildables** (checked in code 2026-07-08):
- `[perf]` **Pickup instancing** — no `InstancedMesh` in `src/pickups/pickups.ts`; ~382 world pickups ≈ 75% of draw calls. Human-attended (the interaction raycast needs an `instanceId` resolver).
- `[polish]` **Ambient life beds are silent** — `soundscape.ts` loads empty `/audio/*.ogg`; synthesize procedural day-bird / night-insect beds (no-sample ethos).

Bigger net-new (scope first): **endgame goal arc** (Long-Storm finale + days-lasted ledger); a **new enterable hero wreck** (Skyfall — research-first); the **deep-cave multi-chamber expansion** (gated on a sub-heightfield-collision walk-test).

**Desktop follow-ups** (from D278): Windows code signing (kills SmartScreen), file-based saves via the Tauri `fs` API, tighten `csp:null` → a scoped policy, re-profile under WebView2.

**Housekeeping** (`[debt]`): `decisions.md` is at 60 entries (>50) — roll the oldest ~15 (D207→) into `docs/decisions-archive.md` in a dedicated pass (verbatim, never renumber, update both headers; conserve the count — as done at C43).

## Owed human walk-tests (yours, headless can't judge)
The big pile in backlog §A (survival-curve feel, diegetic-HUD, salvage pry-feel, sandworm attack feel, speeder handling, 3P camera, the wreck-yard/Sarlacc/mega-wreck reads). Plus the desktop app's full NEW GAME → intro → play click-through in the native window.

## Autonomy contract
When a call is ambiguous and reversible, pick the sensible default, log a D-entry with a friction-score, and continue — don't block on the user for low-stakes choices. Surface only genuine forks (a save-schema change, a destructive action, a direction the user must own).

## Stop conditions
All-picked-work shipped · 3 consecutive fix walls on one gate · a destructive-action need · a catastrophic block. On stop: run `/session-end`.

## Verification protocol
Dustfall opts out of the tier-ladder. `npm run verify` (= `tsc --noEmit`) is the baseline; add `npm run verify:all` (placement + colliders) for world/POI work. Visual/feel work: `npm run dev` + the preview MCP (DOM overlays) OR the rig-shot / **ship-shot** / model-stage harnesses — the preview MCP WEDGES on the escape-pod intro scene, so use `scripts/ship-shot.mjs` for cockpit/pod visual verification. NEVER ship visual work on `tsc`-clean alone (CLAUDE.md rule 8). Desktop: `npm run tauri:build` (needs cargo on PATH).

## Notable footguns
- Escape-pod intro cockpit interior lives in `src/world/escapePodIntro/shipScene.ts` (a large file — grep, don't slurp). The dome glass now has TWO materials: `_glass` (sheen, FRONT window only) + `_glassRoof` (flat, wrap = side closures + roof). Keep dome-edge geometry landing on the collar/shell forward ring or gaps return (D280); keep tilted/peripheral glass on `_glassRoof` or sheen artifacts return (D279).
- `vite.config.ts` reads `process.env.VITE_BASE` directly (no `loadEnv`) — a `.env.<mode>` file does NOT reach `base`; use a real shell env var (D278).
- SAVE_VERSION is **16**; any save touch is additive-only (D81) + needs a pre-v16-style migration.
- `src-tauri/target/` (1.3 GB) is gitignored — never stage it.

## Begin
Read the order above → `TaskCreate` for the picked work items → classify each (solo / parallel fan-out / visual-triage / research swarm) per the session-start dispatcher → start coding.
