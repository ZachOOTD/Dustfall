# ▶ CAMPAIGN cycle 50 — Kickoff Brief — `campaign/2026-06-18`

**Phase B building unattended (M6→M10). M6 ✓ · M7 ✓ · M8 underway (⑧ ✓ · ⑨ funnel ✓ C47 · chamber ✓ C48 · DARK-NAV ✓ C49). Now ⑨'s dressing.**
Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next" (the AUTHORITATIVE queue). The loop commits every cycle and pauses only at
`### Milestone: Phase B — Build-out complete` (after M10). Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. **`docs/feature-deep-cave.md`** — THE SPEC. The funnel + chamber + dark-nav exist; this cycle adds dressing (+ optionally multi-chamber + the ⑩ site).
3. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` + `docs/campaign/campaign-log.md` (the C47/C48/C49 entries — what the cave already is).
4. `docs/decisions.md` tail — **D254 (topology)**, D252 (dead/decayed read, no-horror), D125 (≤37° KCC), D226 (phash), **D81 (NEVER bump SAVE_VERSION autonomously)**.

## What C47+C48+C49 already shipped (DON'T rebuild)
- **C47 FUNNEL:** `biomes.caveAnchor` + a Sarlacc-style funnel carve in `terrain.ts` + dark coloring; `Tuning.CAVE_PIT_*`; a `cave` rig scenario.
- **C48 CHAMBER shell:** `world/deepCave.ts` → `spawnDeepCave` (4 walls + roof + a doorway gap; 7 box colliders) on the funnel floor, wired into `main.ts`; `ctx.deepCave`. `Tuning.CAVE_ROOM_*`.
- **C49 DARK-NAV:** `updateDeepCave(ctx, cave)` (in the tick) darkens ambient/sun by depth×proximity + a no-shadow torch `PointLight` following the player; `Tuning.CAVE_*_FLOOR/TORCH_*`. The `cave` rig scenario's `interior`/`inside` angles render the real dark-nav.

## Cycle 50 focus — **M8 ⑨ continued: decayed dressing** (then multi-chamber + the ⑩ site)
The cave is dark + navigable but EMPTY. Dress it as a long-dead place (D252) so it reads as somewhere, not a bare box.

### Priority items (in order)
1. **Decayed dressing (D252).** Add SPARSE, dark, long-dead props to the chamber in `deepCave.ts` (e.g. collapsed scrap, rubble piles, a dead/dry
   skeleton or two, fallen rock chunks, dust) — reuse existing dark/wreck materials + the `aged` idiom; mark them `isWreckDecoration`. **NO powered/lit/
   maintained objects** (no working lights, no fresh supplies). Keep it sparse + readable under the torch. Render `--scenario=cave --angle=inside` to check.
2. **(Stretch) multi-chamber depth + the ⑩ site.** If budget allows, extend `deepCave.ts` to 2-3 connected chambers (more box rooms + ≤37° connecting
   ramps + doorways, all colliders declared) toward the spec's "4-8 chambers", reserving the DEEPEST chamber as the M8 ⑩ companion-egg site (leave a clear
   spot/marker). Otherwise ship dressing and leave multi-chamber for a `[partial]` continuation.
3. **Verify** — `npm run verify:all` (tsc + placement 0/0 ×5 + colliders 0/40). If you add walls/structural meshes, declare their colliders + re-confirm
   via the `cave` scenario's `caveMeshes` count (the cave is NOT in the archetype sweep). Dressing props are `isWreckDecoration` (no colliders needed).
4. **Visual gate** — `--scenario=cave --angle=inside` (+ `interior`): the dressing reads as a dead, decayed, solitary place under the torch (D252, no-horror).
   Fan adversarial critics; iterate. (The heavy-world screenshot flake is handled — the `cave` scenario logs numbers before the screenshot + try/catches.)

### CRITICAL — the STOP condition
- **D81:** dressing is decoration → NO save change. Even the ⑩ companion-egg should be additive (`companionEggTaken?`). **If anything needs to persist,
  STOP + surface — do NOT bump `SAVE_VERSION`.**
- **D125:** any new connecting ramps stay ≤37°; no new movement mode.

### After ⑨ (when dressing [+ multi-chamber] land)
⑩ companion-egg-cherry-pick (M — re-apply the `2d4035b` spine at the deepest chamber; the additive `companionEggTaken?` flag). Then M9. The loop does
NOT pause (only the Phase-B milestone after M10).

## Autonomy contract
Build to `feature-deep-cave.md`. Ambiguous call → D252 (decayed, solitary, no-horror), log a D-entry, continue. **D81 save-bump STOPs the loop.**
`[partial]` is fine (dressing this cycle, multi-chamber + the ⑩ site next).

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify break · 3 fix-walls on one gate · save-version bump (STOP) · destructive attempt. Pause:
steering "pause" · the Phase-B milestone (after M10 — M8 units don't pause).

## Notable footguns
- **The cave interior is NOT an archetype** — `verify:colliders` won't auto-cover `deepCave.ts`; confirm any new structural colliders via the `cave` scenario count.
- **Dressing props must be `isWreckDecoration`** (and need no colliders) so they don't trip audits / block the player.
- **Determinism (D226):** any new cave geometry phashes from the seed; the biome rng is isolated from the POI scatter — keep it so.
- **Heavy-world screenshot flake:** the `cave` scenario logs numbers before the screenshot + try/catches it — reuse for new shots.
- `verify:placement` buffers output to the END + is slow; don't kill it early. Rig renders use `--scenario=<name>` (a bare positional name times out).

## Verification protocol
`npm run verify:all` + the adversarial INTERIOR visual gate (`--scenario=cave --angle=inside`, lit by the dark-nav) + a `cave`-scenario collider count if walls were added.

## Begin
Read the order (esp. `feature-deep-cave.md` + the C49 `deepCave.ts`) → `TaskCreate` the dressing → add sparse dead props to `deepCave.ts` (D252) →
`verify:all` + the interior visual gate (iterate) → `/session-end`. **Watch D81.** `[partial]` ok. Boot fresh from FILES.
