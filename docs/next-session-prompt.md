# ▶ CAMPAIGN cycle 47 — Kickoff Brief — `campaign/2026-06-18`

**Phase B is building unattended (M6→M10). M6 ✓ · M7 ✓ · M8 underway (⑧ spike done C46). Now ⑨ deep-cave-build — the XL.**
Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next" (the AUTHORITATIVE queue) — NOT this file's hints. The loop
commits every cycle and pauses only at `### Milestone: Phase B — Build-out complete` (after M10). Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. **`docs/feature-deep-cave.md`** — THE SPEC for this cycle (the C46 spike's decision + architecture + sub-tasks + success criteria). Build to it.
3. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` (your inbox) + `docs/campaign/campaign-log.md` (recent cycles).
4. `docs/decisions.md` tail — **D254 (the cave topology — Sarlacc funnel + box/cylinder room-kit)**, D253 (the hollow-shell `auditExempt` doorway idiom), D252 (solitude/dead read), D125 (the ≤37° KCC slope limit, no new movement mode), D226 (phash determinism), **D81 (NEVER bump SAVE_VERSION autonomously)**.

## Cycle 47 focus — **M8 ⑨ deep-cave-build (XL — the biggest single net-new build of the campaign)**
Build the cave per `feature-deep-cave.md` (Option A, D254): a seeded `caveAnchor` + a **Sarlacc-style terrain FUNNEL descent** + a **box/cylinder
room-kit enclosed interior** (walls + a real **roof collider** + ≤37° ramps + a doorway gap) + decayed dressing (D252) + **dark-nav** (ambient-darken-
below-Y + torch glow). One cave, distance-gated, 4-8 chambers, the deepest chamber reserved for the M8 ⑩ companion-egg. **It's XL — if it can't all fit
one cycle, ship `[partial]` (e.g. the carve + entrance this cycle, the interior next) rather than a rushed whole.**

### Priority items (in order)
1. **The seeded anchor + the funnel carve FIRST (the foundation).** Add a `caveAnchor` (seed-derived, distance-gated — mirror `sarlaccPitAnchor` in
   `world/biomes.ts`) and carve the heightfield+mesh into a walk-down funnel at boot (the `terrain.ts:163-173` Sarlacc carve path — bit-identical mesh+
   collider, deterministic, no save). Clamp the descent slope ≤ ~37° (D125). Verify the player can walk down (a rig render + the descent profile).
2. **The enclosed interior (the room-kit).** At the funnel base, a doorway gap into chambers built from declared **box + cylinder colliders** (walls +
   a **roof collider** + connecting ≤37° ramps), procedurally assembled (ONE `seedOf` draw + phash — D226), merged by material (the wreck-yard draw-call
   pattern). Dressed dead/decayed (D252 — reuse the `aged` interior idiom from D253; no powered/maintained reads). **Roof × snap-to-ground:** keep ceilings
   ≥ ~2.5 m and validate no capsule jitter (a spec open question).
3. **Dark-nav.** A cheap **ambient-darken-below-Y** (drop ambient when the player's Y is under the cave threshold) + an emissive torch glow. Avoid a
   dynamic point light (per-frame shadow cost); if you must, gate it behind `FEATURES`. Torch-only, **no-horror** (dark = isolation, not jump-scares).
4. **HARD conventions:** phash determinism (one `seedOf` draw); declare a collider per structural mesh; the doorway gap uses the hollow-shell
   `auditExempt` idiom (D253); **add the cave to the `collider-audit` default list** (`scripts/rig-shot.mjs` — the audit count rises from 40).
5. **Verify** — `npm run verify:all` (tsc + placement 0/0 ×5 + colliders 0/4X incl. the cave). The funnel carve must not break placement (panels near
   the anchor must still pass the bury audit — the Sarlacc carve clears a radius; mirror that).
6. **Visual gate** — render the descent (from above + from inside), the interior chambers (entrance / mid / deepest), and the dark-nav read (is it dark
   but navigable with the torch?). Fan adversarial critics; iterate. The reads to nail: "I can tell I descend into an enclosed space", "it's dark but I
   can navigate", "it reads as a long-dead, no-horror, solitary place" (D252).

### CRITICAL — the STOP condition for this cycle
- **D81 SAVE-SCHEMA:** the build should need NO save change (the cave is seed-derived; only ⑩'s companion-egg adds an additive `companionEggTaken?`
  flag). **If ⑨ discovers it needs to persist cave state (visited / geometry / carve), STOP the loop and surface it — do NOT bump `SAVE_VERSION`.**
- **D125 (the KCC wall):** if the descent/interior needs a NEW movement mode (climb/crouch/non-KCC) and 2 approaches fail, re-table rather than force
  a 3rd. The ≤37° ramp is the safe path — stay on it.

### After ⑨
⑩ companion-egg-cherry-pick (M — re-apply the `2d4035b` spine at the deepest chamber; the additive `companionEggTaken?` field). Then M9. The loop does
NOT pause (only the Phase-B milestone after M10).

## Autonomy contract
Build to `feature-deep-cave.md`. Ambiguous call → fit the Dune/Mad-Max tone + D252 (decayed, solitary, no-horror), log a D-entry, continue.
**D81 save-bump STOPs the loop.** **D125: no forced 3rd movement-mode attempt.** XL unit → `[partial]` is allowed (don't rush the whole).

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify break · 3 fix-walls on one gate · save-version bump (STOP) · destructive attempt. Pause:
steering "pause" · the Phase-B milestone (after M10 — M8 units don't pause).

## Notable footguns
- **Heightfield ≠ enclosure:** the descent is a walkable FUNNEL (Sarlacc-proven), NOT a sheer vertical shaft (not representable). The roof/walls are a
  SEPARATE collider module (box/cylinder kit), not the heightfield.
- **The carve × placement gate:** lowering terrain at the anchor can bury/expose nearby salvage panels — the Sarlacc carve clears a radius; do the same
  so `verify:placement` stays 0/0.
- **Roof collider × snap-to-ground (0.3 m):** keep ceilings tall; validate no capsule jitter under a low roof.
- **Determinism (D226):** the anchor + the layout are phashed from the seed; one `seedOf` draw; never desync the world stream.
- `verify:placement` buffers output to the END + is slow; don't kill it early. Rig renders use `--scenario=<name>` (a bare positional name times out —
  C44 footgun); the multi-seed render can flake on one screenshot — re-run the single seed.

## Verification protocol
`npm run verify:all` (tsc + `verify:placement` ×5 + `verify:colliders` — add the cave to the audit). New cave → the adversarial appearance gate
(descent + interior + dark-nav renders) + Rule-8 iteration.

## Begin
Read the order above (esp. `feature-deep-cave.md`) → `TaskCreate` the ⑨ build (anchor+carve → interior → dark-nav) → build to the spec (phash +
declared colliders w/ a doorway gap + audit-list, dead dressing per D252, ≤37° ramps per D125) → `verify:all` + the adversarial visual gate (iterate)
→ `/session-end`. If it can't all fit, ship `[partial]`. **Watch D81 — STOP + surface if a save bump is needed.** Boot fresh from FILES.
