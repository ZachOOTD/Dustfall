# ▶ CAMPAIGN cycle 46 — Kickoff Brief — `campaign/2026-06-18`

**Phase B is building unattended (M6→M10). M6 ✓ · M7 ✓ COMPLETE (C45). Now starting M8 (deep cave & companion).**
Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next" (the AUTHORITATIVE queue) — NOT this file's hints. The loop
commits every cycle and pauses only at `### Milestone: Phase B — Build-out complete` (after M10). Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` (your inbox) + `docs/campaign/campaign-log.md` (recent cycles).
3. `docs/roadmap.md` "Up next" → Phase B → **M8** (the whole tier: ⑧ spike → ⑨ build → ⑩ companion).
4. `docs/decisions.md` tail — **D252 (the solitude principle — applies to the cave too)**, D253 (enterable_wreck), D125 (the KCC/riding wall — relevant to cave traversal/slope limits), D226 (phash determinism), D81 (NEVER bump SAVE_VERSION autonomously) — + `docs/GDD.md` (the cave's place in the vision) + `docs/architecture.md` (terrain/physics/KCC).

## Cycle 46 focus — **M8 ⑧ deep-cave-design-spike (A/B worktree — collision topology)**
The DESIGN SPIKE that de-risks the cave before the XL build (⑨). **Deliverable: `docs/feature-deep-cave.md`** — a decision doc that picks the
cave's collision-topology approach, NOT shipped gameplay. The hard problem: the world terrain is a **heightfield** (one Y per XZ — it physically
cannot represent an overhang or an enclosed underground volume). A walkable cave needs real 3D enclosure (a roof over your head). So the spike must
answer: **how does the player get below the heightfield into an enclosed, collidable space, and back out?**

### Priority items (in order)
1. **Recon FIRST.** Map how terrain + physics + the KCC work today: `src/world/terrain*`, the Rapier heightfield collider, the character controller
   (grep `KinematicCharacterController`/`KCC`/`moveCharacter`), and how `crash_husk`/`huskShell` made an *enclosed walkable shell above ground*
   (C45/D253 — that hollow-shell + side-wall-collider trick may be the cheapest cave too). Also read D125 (the riding/KCC slope wall — the cave's
   ramps/descent must stay under the KCC climb limit) and the "cave = ONE + ramp + no-horror" Phase-B design call (`proposal-cycle-37.md`).
2. **Spike 2-3 candidate approaches CONCURRENTLY (worktrees — `isolation: worktree`).** Candidates to consider (pick the real ones after recon):
   - **(A) A pit + a placed enclosed mesh module:** carve/lower a terrain bowl, drop a trimesh/box-kit cave room with a roof + a walk-down ramp
     (reuses the heightfield for the descent, a separate collider for the enclosure — closest to the proven `huskShell` trick).
   - **(B) Trimesh tunnel segments:** author a tunnel as a trimesh collider (full 3D), stitched into a pit entrance. Most flexible, heaviest.
   - **(C) Box-collider room kit:** compose the cave from oriented box colliders (cheap, robust, but blocky — may suffice for ONE location).
   Each spike: a throwaway prototype proving the player can descend in, walk an enclosed space (roof collides), and climb out — under the KCC limits.
3. **Decide + write `docs/feature-deep-cave.md`** — the chosen approach, why, the collision/determinism/perf trade-offs, the dark-nav plan (lighting),
   the no-horror + solitude (D252) tone, and the sub-task breakdown for ⑨ (the XL build) + ⑩ (companion-egg cherry-pick at the deepest chamber).
   **Log a D-entry** for the topology choice.
4. **Verify** — `npm run verify:all` must stay green (the spike likely adds little/no shipped code; if a prototype lands behind a flag, keep the
   audits clean). A spike that ships only a design doc + a flagged prototype is fine.
5. **Visual gate** — only if the spike ships a visible prototype; otherwise the deliverable is the doc (no appearance gate needed this cycle).

### CRITICAL — STOP conditions for this tier
- **D81 SAVE-SCHEMA (the real risk for M8):** ⑧ is just a design spike (a doc) → should NOT touch the save. But the cave BUILD (⑨) and the companion
  (⑩) will likely want to persist "cave discovered / companion state / egg taken". **If THIS cycle's spike concludes the cave needs a SAVE_VERSION
  bump, DO NOT bump it** — record the requirement in `feature-deep-cave.md` and let the build cycle surface it; never bump autonomously.
- **D125 (the KCC wall):** if the spike finds the descent/traversal needs a NEW movement mode (climbing, crouch, a non-KCC controller) and 2 approaches
  fail, **re-table rather than force a 3rd** (the D125 precedent). A ramp under the KCC limit is the safe path (the watchtower ramp / cave-ramp pattern).

### After ⑧
⑨ deep-cave-build (XL — seeded tunnel-carving, ONE rare location, dark-nav, no-horror) then ⑩ companion-egg-cherry-pick (re-apply the `2d4035b`
spine at the deepest chamber). The loop does NOT pause (only the Phase-B milestone after M10 pauses).

## Autonomy contract
Ambiguous design call → pick the approach that fits the Dune/Mad-Max tone + D252 (decayed, solitary, no-horror), log a D-entry, continue.
A spike is allowed to ship a design doc + a flagged throwaway prototype rather than finished gameplay — that's the point of de-risking ⑨ first.
**D81 save-bump STOPs the loop.** **D125: don't force a 3rd movement-mode attempt.**

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify break · 3 fix-walls on one gate · save-version bump (STOP) · destructive attempt. Pause:
steering "pause" · the Phase-B milestone (after M10 — M8 units don't pause).

## Notable footguns
- **Heightfield ≠ caves:** a Rapier heightfield can't enclose a volume; the cave needs a separate 3D collider (mesh/box kit) — that's the whole spike.
- **The hollow-shell trick (C45/D253):** `huskShell` proves an enclosed walkable space = a shell mesh + side-wall colliders + `auditExempt`; the cave
  may reuse exactly this pattern (a roof + walls collider, the player walks the floor). Cheapest candidate — evaluate it first.
- **Determinism (D226):** any procedural cave placement uses `phash`/one `seedOf` draw; don't desync the world stream.
- **Worktree spikes auto-clean** if unchanged — use `isolation: worktree` so concurrent prototypes don't collide on the same files.
- `verify:placement` buffers output to the END + is slow; don't kill it early. Rig renders use `--scenario=<name>` (a bare positional name falls
  through to the default rig-studio path and times out — C44 footgun). The multi-seed render can flake on one screenshot; re-run the single seed.

## Verification protocol
`npm run verify:all` (tsc + `verify:placement` ×5 + `verify:colliders`). A design-spike cycle's primary deliverable is `docs/feature-deep-cave.md`
+ a D-entry; only run the visual gate if a visible prototype ships.

## Begin
Read the order above → `TaskCreate` the M8 ⑧ recon + the A/B/C spike → recon terrain/physics/KCC + the huskShell trick → spike 2-3 candidates in
worktrees → pick one + write `docs/feature-deep-cave.md` + a D-entry → `verify:all` → `/session-end`. Boot fresh from FILES; don't trust chat memory.
