# ▶ CAMPAIGN cycle 49 — Kickoff Brief — `campaign/2026-06-18`

**Phase B building unattended (M6→M10). M6 ✓ · M7 ✓ · M8 underway (⑧ ✓ · ⑨ FUNNEL ✓ C47 · ⑨ CHAMBER shell ✓ C48). Now ⑨'s dark-nav + dressing.**
Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next" (the AUTHORITATIVE queue). The loop commits every cycle and pauses only at
`### Milestone: Phase B — Build-out complete` (after M10). Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. **`docs/feature-deep-cave.md`** — THE SPEC. The funnel + the chamber shell exist; this cycle adds dark-nav + dressing (+ optionally multi-chamber).
3. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` + `docs/campaign/campaign-log.md` (the C47+C48 entries — what the cave already is).
4. `docs/decisions.md` tail — **D254 (topology)**, D252 (dead/decayed read, no-horror), D125 (≤37° KCC), D226 (phash), **D81 (NEVER bump SAVE_VERSION autonomously)**.

## What C47+C48 already shipped (DON'T rebuild)
- **C47 the FUNNEL:** `biomes.caveAnchor` + `caveAt()`; a Sarlacc-style funnel carve in `terrain.ts` (the player walks down to `terrain.heightAt(caveAnchor)`); dark cave-mouth coloring; `Tuning.CAVE_PIT_*`; a `cave` rig scenario (`--scenario=cave --angle=aerial|approach|interior|inside`).
- **C48 the CHAMBER shell:** `world/deepCave.ts` → `spawnDeepCave(scene, world, terrain, caveAnchor)` builds a roofed box room (4 walls + roof + a doorway gap + a lintel; 7 declared box colliders) on the funnel floor; wired into `main.ts` as a fixed feature. `Tuning.CAVE_ROOM_*`. The player walks the continuous funnel terrain inside (no floor slab).

## Cycle 49 focus — **M8 ⑨ continued: dark-nav + decayed dressing** (then multi-chamber + the ⑩ site)
The interior shell is built but renders too dark to fully gate — **dark-nav is the priority** (it makes the cave navigable AND visually verifiable).

### Priority items (in order)
1. **Dark-nav (FIRST — it unblocks the interior visual gate).** A cheap **ambient-darken-below-Y**: drop the scene ambient (and/or sun contribution)
   when the player's Y is below a threshold (≈ the funnel rim, `terrain.heightAt(caveAnchor)` + a few m) so the cave reads DARK; pair with an emissive
   **torch glow** (the player's held torch / a warm emissive) so the immediate surroundings are navigable. AVOID a dynamic point light + shadow map
   (per-frame cost) unless the cheap path fails — then gate behind `FEATURES`. Torch-only, **no-horror** (dark = isolation, not jump-scares). Tune so it's
   dark but you can SEE walls/floor a few metres out. This needs a per-frame hook in `main.ts` (player-Y → ambient lerp) — keep it pause-safe.
2. **Decayed dressing (D252).** Sparse long-dead props inside the chamber (reuse the `aged`/wreck idiom — dust, collapsed scrap, NO powered/lit/maintained
   objects). Mark them `isWreckDecoration`. Keep it sparse + dark.
3. **(Stretch) multi-chamber depth + the ⑩ site.** If budget allows, extend `deepCave.ts` to 2-3 connected chambers (more box rooms + ≤37° connecting
   ramps + doorways) per the spec's "4-8 chambers", reserving the DEEPEST chamber for the M8 ⑩ companion-egg. Otherwise ship dark-nav + dressing and
   leave multi-chamber for a `[partial]` continuation.
4. **Verify** — `npm run verify:all` (tsc + placement 0/0 ×5 + colliders 0/40). The dark-nav ambient hook must be pause-safe + must not affect placement.
   The cave's colliders are declared in `deepCave.ts` (not in the archetype sweep) — re-confirm via the `cave` scenario's `caveMeshes` count if you add walls.
5. **Visual gate** — NOW the interior should gate properly: render `--scenario=cave --angle=interior` (+ `inside`) WITH the dark-nav active (drop the
   exposure boost in those angles once real lighting exists). Fan adversarial critics: "dark but navigable", "reads as a dead solitary cave (D252)",
   "no-horror". Iterate to PASS.

### CRITICAL — the STOP condition
- **D81:** dark-nav + dressing are render/scene-only → NO save change. Only ⑩'s companion-egg adds an additive `companionEggTaken?` flag. **If anything
  here needs to persist, STOP + surface — do NOT bump `SAVE_VERSION`.**
- **D125:** any new connecting ramps stay ≤37°; no new movement mode.

### After ⑨ (when dark-nav + the interior land)
⑩ companion-egg-cherry-pick (M — re-apply the `2d4035b` spine at the deepest chamber; the additive `companionEggTaken?` flag). Then M9. The loop does
NOT pause (only the Phase-B milestone after M10).

## Autonomy contract
Build to `feature-deep-cave.md`. Ambiguous call → D252 (decayed, solitary, no-horror), log a D-entry, continue. **D81 save-bump STOPs the loop.**
`[partial]` is fine (dark-nav + dressing this cycle, multi-chamber next).

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify break · 3 fix-walls on one gate · save-version bump (STOP) · destructive attempt. Pause:
steering "pause" · the Phase-B milestone (after M10 — M8 units don't pause).

## Notable footguns
- **The cave interior is NOT an archetype** — `verify:colliders` won't auto-cover `deepCave.ts`; confirm its colliders via the `cave` scenario's count.
- **Dark-nav must be pause-safe** + must not bleed into the surface scene (only darken below the cave-rim Y; restore on exit/ascent).
- **Heavy-world screenshot flake:** the `cave` scenario logs numbers before the screenshot + try/catches it — reuse for new shots.
- **Determinism (D226):** any new cave geometry phashes from the seed; don't desync the POI scatter (the biome rng is isolated — keep it so).
- `verify:placement` buffers output to the END + is slow; don't kill it early. Rig renders use `--scenario=<name>` (a bare positional name times out).

## Verification protocol
`npm run verify:all` + the adversarial INTERIOR visual gate (now lit by the dark-nav) + a `cave`-scenario collider-count sanity if walls were added.

## Begin
Read the order (esp. `feature-deep-cave.md` + the C48 `deepCave.ts`) → `TaskCreate` dark-nav + dressing → add the ambient-darken-below-Y hook in
`main.ts` + a torch glow → dress the chamber (D252) → `verify:all` + the interior visual gate (iterate) → `/session-end`. **Watch D81.** `[partial]` ok.
Boot fresh from FILES.
