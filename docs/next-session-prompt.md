# ▶ CAMPAIGN cycle 48 — Kickoff Brief — `campaign/2026-06-18`

**Phase B building unattended (M6→M10). M6 ✓ · M7 ✓ · M8 underway (⑧ spike ✓ · ⑨ FUNNEL ✓ C47). Now ⑨ continued — the enclosed interior.**
Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next" (the AUTHORITATIVE queue) — NOT this file's hints. The loop
commits every cycle and pauses only at `### Milestone: Phase B — Build-out complete` (after M10). Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. **`docs/feature-deep-cave.md`** — THE SPEC. The funnel (the descent) is done; this cycle builds the ENCLOSED INTERIOR per the spec.
3. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` + `docs/campaign/campaign-log.md` (the C47 entry — what the funnel already does).
4. `docs/decisions.md` tail — **D254 (the topology)**, D253 (the hollow-shell `auditExempt` doorway idiom), D252 (dead/decayed read), D125 (≤37° KCC), D226 (phash), **D81 (NEVER bump SAVE_VERSION autonomously)**.

## What C47 already shipped (the funnel — DON'T rebuild it)
`world/biomes.ts`: `caveAnchor` (seeded, far, clear of spawn/graveyard/Sarlacc) + `caveAt()`. `world/terrain.ts`: the funnel CARVE (a ~39° walk-down
funnel, dark cave-mouth coloring) — the mesh + heightfield + `heightAt()` all dip, so the player physically walks down to the funnel FLOOR
(`ctx.terrain.heightAt(caveAnchor.x, caveAnchor.z)` ≈ the floor Y). `Tuning.CAVE_PIT_*`. A `cave` rig scenario (`--scenario=cave --angle=aerial|approach`).

## Cycle 48 focus — **M8 ⑨ continued: the ENCLOSED INTERIOR + dark-nav**
Build the roofed, walkable interior at the funnel floor, per `feature-deep-cave.md`. This is what turns "a dark pit" into "a cave you walk INTO".

### Priority items (in order)
1. **A new module `world/deepCave.ts`** (mirror `spawnSarlaccPit`'s shape — a fixed placed feature, ONE per world, spawned from `main.ts` at
   `biomes.caveAnchor`, NOT an `ARCH_WEIGHTS` archetype). It builds the enclosed interior at the funnel floor: 4-8 chambers from **declared box +
   cylinder colliders** — walls + a real **ROOF collider** + connecting **≤37° ramps** (D125) — with a **doorway gap** at the funnel-floor end (the
   hollow-shell `auditExempt` idiom, D253). Procedural from ONE `seedOf`/phash (D226), merged by material. Dressed decayed/dead (D252 — reuse the
   `aged` interior idiom from D253; NO powered/maintained/lit props). Deepest chamber reserved for the M8 ⑩ companion-egg.
2. **Dark-nav:** a cheap **ambient-darken-below-Y** (drop ambient when the player's Y is under the funnel-rim threshold) + an emissive torch glow.
   Avoid a dynamic point light (per-frame shadow cost); if unavoidable, gate behind `FEATURES`. Torch-only, **no-horror** (dark = isolation tension).
3. **Roof × snap-to-ground:** keep ceilings ≥ ~2.5 m and validate (a quick rig/eval) that the roof collider doesn't cause capsule jitter under the
   0.3 m snap-to-ground (a spec open question).
4. **COLLIDER AUDIT NUANCE (important):** the cave interior is a FIXED placed module (like the Sarlacc maw), NOT an `ARCH_WEIGHTS` archetype — so
   `verify:colliders` (which sweeps archetypes) will NOT auto-audit it. Either (a) add a dedicated cave-collider sanity check, or (b) carefully verify
   the interior's colliders by eye + a targeted eval (walls/roof/ramps all declared; the doorway gap intentional). Don't assume the archetype audit covers it.
5. **Verify** — `npm run verify:all` must stay green (tsc + placement 0/0 ×5 + colliders 0/40 — the interior shouldn't perturb the POI scatter since
   the biome rng is isolated). Confirm the funnel + interior still place deterministically.
6. **Visual gate** — extend the `cave` rig scenario with an INTERIOR camera (inside a chamber + at the doorway). Render: the descent → the doorway →
   inside (dark but navigable with the torch). Fan adversarial critics. The reads to nail: "I can walk into an enclosed roofed space", "it's dark but
   navigable", "it reads as a long-dead, no-horror, solitary place" (D252). (Watch the heavy-world screenshot flake — the `cave` scenario already logs
   numbers before the screenshot + try/catches it; reuse that idiom for new shots.)

### CRITICAL — the STOP condition
- **D81 SAVE-SCHEMA:** the interior is seed-derived → should need NO save change. Only ⑩'s companion-egg adds an additive `companionEggTaken?` flag.
  **If ⑨'s interior needs to persist anything (visited / state), STOP the loop and surface it — do NOT bump `SAVE_VERSION`.**
- **D125:** if the interior traversal needs a NEW movement mode and 2 approaches fail, re-table; the ≤37° ramp is the safe path.

### After ⑨ (when the interior lands)
⑩ companion-egg-cherry-pick (M — re-apply the `2d4035b` spine at the deepest chamber; the additive `companionEggTaken?` flag). Then M9. The loop does
NOT pause (only the Phase-B milestone after M10).

## Autonomy contract
Build to `feature-deep-cave.md`. Ambiguous call → fit the Dune/Mad-Max tone + D252 (decayed, solitary, no-horror), log a D-entry, continue.
**D81 save-bump STOPs the loop.** **D125: no forced 3rd movement-mode attempt.** Still XL → another `[partial]` (e.g. shell this cycle, dressing/
dark-nav next) is allowed.

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify break · 3 fix-walls on one gate · save-version bump (STOP) · destructive attempt. Pause:
steering "pause" · the Phase-B milestone (after M10 — M8 units don't pause).

## Notable footguns
- **The cave interior is NOT an `ARCH_WEIGHTS` archetype** — it's a fixed module spawned from `main.ts` (like `spawnSarlaccPit`); `verify:colliders`
  won't auto-cover it (see item 4).
- **Roof collider × snap-to-ground (0.3 m):** keep ceilings tall; validate no jitter.
- **Determinism (D226):** the interior phashes from the seed; the biome rng is isolated from the POI scatter (C47 proved it) — keep it that way.
- **Heavy-world screenshot flake:** the `cave` scenario logs numbers before the screenshot + try/catches it — reuse for any new interior shots.
- `verify:placement` buffers output to the END + is slow; don't kill it early. Rig renders use `--scenario=<name>` (a bare positional name times out).

## Verification protocol
`npm run verify:all` (tsc + `verify:placement` ×5 + `verify:colliders`) + a dedicated cave-collider check (item 4) + the adversarial interior visual gate.

## Begin
Read the order above (esp. `feature-deep-cave.md` + the C47 funnel) → `TaskCreate` the interior build → `world/deepCave.ts` (room-kit + roof + ramps +
doorway, dead dressing) + spawn from `main.ts` at `caveAnchor` + dark-nav → verify the colliders (item 4) → `verify:all` + the interior visual gate
(iterate) → `/session-end`. **Watch D81 — STOP + surface if a save bump is needed.** `[partial]` is allowed. Boot fresh from FILES.
