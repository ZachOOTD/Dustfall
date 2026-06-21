# ▶ CAMPAIGN cycle 51 — Kickoff Brief — `campaign/2026-06-18`

**Phase B building unattended (M6→M10). M6 ✓ · M7 ✓ · M8 underway (⑧ ✓ · ⑨ funnel+chamber+dark-nav+dressing ✓ C47-C50). Now ⑨'s multi-chamber.**
Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next" (the AUTHORITATIVE queue). The loop commits every cycle and pauses only at
`### Milestone: Phase B — Build-out complete` (after M10). Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. **`docs/feature-deep-cave.md`** — THE SPEC (the cave wants "4-8 chambers"; one dressed chamber exists — this cycle adds depth).
3. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` + `docs/campaign/campaign-log.md` (the C47-C50 entries — the cave so far).
4. `docs/decisions.md` tail — **D254 (topology)**, D252 (dead/decayed, no-horror), D125 (≤37° KCC, no new movement mode), D226 (phash), **D81 (NEVER bump SAVE_VERSION autonomously)**.

## What C47-C50 already shipped (DON'T rebuild)
A complete single-chamber enterable cave at `biomes.caveAnchor`: a Sarlacc-style **descent funnel** (`terrain.ts` carve) → an enclosed **roofed chamber** (`world/deepCave.ts` `spawnDeepCave`: walls + roof + a doorway gap, declared box colliders) → **dark-nav** (`updateDeepCave` in the tick: ambient/sun darken by depth×proximity + a no-shadow torch following the player) → **decayed dressing** (rubble, fallen rock, a dry skeleton, slabs). `Tuning.CAVE_*`. `ctx.deepCave`. The `cave` rig scenario (`--angle=aerial|approach|interior|inside`) renders it.

## Cycle 51 focus — **M8 ⑨ continued: multi-chamber depth + the ⑩ site** (completes ⑨)
Extend `deepCave.ts` from ONE chamber toward the spec's 4-8: add 2-3 MORE connected chambers, deeper, so the cave reads as a place you descend INTO,
reserving the DEEPEST chamber as the M8 ⑩ companion-egg site.

### Priority items (in order)
1. **Generalize the chamber builder in `deepCave.ts`.** Refactor the single inline chamber into a reusable `addChamber(center, half, height, doorways)`
   helper (box walls + roof + a doorway gap per connection, declared colliders), then place 2-3 chambers stepping DOWN and along (e.g. -X / -Z),
   connected by short **≤37° ramps** (D125) through the doorways. Keep ceilings ≥ ~2.5 m (roof × KCC snap). Dress each sparsely (D252 — reuse the C50
   props). The connecting geometry must form a continuous walkable path from the funnel doorway to the deepest chamber.
2. **The ⑩ site.** In the DEEPEST chamber, leave a clear marked spot (e.g. a low plinth / a cleared circle) for the M8 ⑩ companion-egg — don't place the
   egg itself (that's ⑩), just prep the site.
3. **Colliders.** Every wall/roof/ramp is a declared box collider (the cave is NOT in the archetype sweep — confirm the total via the `cave` scenario's
   `caveMeshes`/collider count). Doorway gaps + the dark interior are intentional (no audit coverage needed for the gaps). Ramps ≤37°.
4. **Verify** — `npm run verify:all` (tsc + placement 0/0 ×5 + colliders 0/40). The cave is a fixed module (no scatter impact); placement must stay 0/0.
5. **Visual gate** — render `--scenario=cave --angle=inside` (+ add an angle deeper in if useful): the chambers read as a connected dark descending
   cave (dark-but-navigable, dead, no-horror, D252). Watch the doorway/ramp transitions read as passable. Iterate to PASS.

### CRITICAL — the STOP condition
- **D81:** more chambers = more geometry, seed-derived → NO save change. Only ⑩'s companion-egg adds an additive `companionEggTaken?` flag. **If
  anything needs to persist, STOP + surface — do NOT bump `SAVE_VERSION`.**
- **D125:** ramps stay ≤37°; no new movement mode. If a connection can't be made walkable, re-scope (fewer/shallower chambers) rather than add a
  climb/crouch mode.

### After ⑨ (when multi-chamber lands → ⑨ COMPLETE)
⑩ companion-egg-cherry-pick (M — re-apply the `2d4035b` spine at the deepest-chamber site; the additive `companionEggTaken?` flag). Then M9. The loop
does NOT pause (only the Phase-B milestone after M10).

## Autonomy contract
Build to `feature-deep-cave.md`. Ambiguous call → D252 (decayed, solitary, no-horror) + D125 (walkable), log a D-entry, continue. **D81 save-bump STOPs
the loop.** `[partial]` is fine (e.g. 2 chambers this cycle, more next) — but aim to mark ⑨ COMPLETE when the cave reads as a real multi-room descent.

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify break · 3 fix-walls on one gate · save-version bump (STOP) · destructive attempt. Pause:
steering "pause" · the Phase-B milestone (after M10 — M8 units don't pause).

## Notable footguns
- **The cave interior is NOT an archetype** — `verify:colliders` won't auto-cover `deepCave.ts`; confirm new colliders via the `cave` scenario count.
- **Walkability:** the funnel floor is bowl-shaped + each chamber's terrain may differ — mind steps at doorways (>0.3 m autostep = unclimbable). The C48
  approach (walls seal into terrain, no separate floor slab) avoided this for chamber 1; deeper chambers below the bowl may need their OWN floor +
  a ramp DOWN to them — validate the player can walk down AND back up (≤37°). This is the trickiest part; if a chamber can't be made walkable headless,
  ship what's walkable `[partial]` + flag the rest for walk-test.
- **Determinism (D226):** any phash use seeds from the anchor; the biome rng is isolated from the POI scatter — keep it so.
- **Heavy-world screenshot flake:** the `cave` scenario logs numbers before the screenshot + try/catches it — reuse for new shots.
- `verify:placement` buffers output to the END + is slow; don't kill it early. Rig renders use `--scenario=<name>` (a bare positional name times out).

## Verification protocol
`npm run verify:all` + the adversarial INTERIOR visual gate (`--scenario=cave --angle=inside`, lit by the dark-nav) + a `cave`-scenario collider count.

## Begin
Read the order (esp. `feature-deep-cave.md` + the C50 `deepCave.ts`) → `TaskCreate` the multi-chamber → refactor to `addChamber` + place 2-3 connected
chambers + ramps + the ⑩ site → `verify:all` + the interior visual gate (iterate) → `/session-end`. **Watch D81 + D125.** `[partial]` ok. Boot fresh from FILES.
