# Next session — Infinite procedural generation (chunk-streamed open world)

**⚙ A CAMPAIGN IS ACTIVE for this work** — "Infinite Sands", overnight, branch `campaign/2026-07-10-procgen`. Boot `/campaign-cycle` from `docs/campaign/campaign-state.json` + `campaign.md` (the design questions below are ANSWERED there). The paused Skyfall campaign is parked at `docs/campaign/*-2026-07-09-sharpen-deepen.*`.

**Focus this session:** begin the infinite-procgen work. **Read `docs/feature-infinite-procgen.md` first** — it has the DoD, the current finite-vs-infinite architecture map (with file:line refs), the sub-task breakdown (S1 research/spike → S2 POI streaming → S3 scatter/creatures → S4 landmarks/biomes → S5 save → S6 perf), the open design questions, and the invariants to preserve.

## Start here
1. Read `docs/feature-infinite-procgen.md`.
2. Answer the 5 open design questions (chunk size + load radius, deterministic-vs-random, landmark distribution, keep-the-intro-as-start, save-scope-for-v1) — or confirm the recommended defaults.
3. Do **S1** (research + architecture spike): design the ChunkManager + per-chunk deterministic seed `hash(worldSeed, cx, cz)`, and spike load/unload/determinism with a trivial per-chunk marker before wiring real content.

## Key facts (from the codebase)
- Terrain (`terrain.ts` heightAt) is already infinite (simplex noise); biomes are noise-based. The whole rest of the world is placed ONCE at boot around the origin in `src/main.ts` (POIs :246, hero landmarks :194, rocks :207, wordless scenes :210, Leviathan :232, creatures :301-315, opening scene :575) — that's what becomes chunk-streamed.
- `FogExp2` (~1.8e-3) is the natural view horizon → set the chunk load radius to ~the fog cull distance.
- Determinism law (D208/D226) — components are `phash`-only, dedicated RNG streams, `verify:placement` gates it. Per-chunk seeding is the natural extension; keep the gate green.

## Two things saved for later (do NOT lose these)
- **The campaign is PAUSED at M7 Skyfall plan-review.** The Skyfall plan is in `docs/feature-skyfall.md` (enterable hero wreck at intro-ship scale) and `docs/campaign/` (state = paused, awaiting `/campaign-approve`). Come back to it after procgen — it plugs into the per-region landmark system (S4). Leave the campaign state as-is.
- The rest of the campaign work (M1-M6) is shipped + live on `master`.

## Working state
- Branch `master`, clean, live-deployed + desktop rebuilt at the start of this session's work. Consider branching for the procgen work (it's a large multi-cycle feature): `git checkout -b feature/infinite-procgen`.
- Gates: `npm run verify:all` + `smoke-intro` / `smoke-pod-tutorial` + `pickup-take-sweep` + `survival-probe` + `diurnal-probe` (rig-shot). Add the new determinism + streaming probes as you build S1/S2.

## Constraints
Preserve: determinism law, rule-9 collision (dispose Rapier bodies on unload — no leaks), the released escape-pod intro + near-origin spawn, save compatibility (a SAVE_VERSION bump is a sanctioned pause — surface it, D81), and the banked perf wins (pickup instancing D281 + static merge).
