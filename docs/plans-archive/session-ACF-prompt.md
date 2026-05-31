# Session ACF — Kickoff Brief

## Read these now (in order)

1. **CLAUDE.md** (auto-loaded) — project manual.
2. **docs/session-end-report.md** — cumulative state through ACE (still on the ACD-era report at session-start; update to ACE shape on session-end if /session-end skipped).
3. **docs/backlog.md** — open items.
4. **docs/decisions.md** — D-entries through D130. ACE added D126 (ropeConstraint extracted), D127 (sandWorms v13 migration), D128 (procedural-character pipeline applied to lizard), D129 (footstep audio from rig.stepCount), D130 (stake = craftable persistent RopeEndpoint).
5. **docs/roadmap.md** — "Up next" lists ACF candidates.
6. **docs/architecture.md** — only if touching a system you don't already know.

## What's already built (one paragraph)

ACE shipped a comprehensive overnight bundle across 5 tiers. **B1 Phase 3
rope vocab**: `src/world/ropeConstraint.ts` (shared inextensible-rope helper,
extracted from `updateSleds`) + `src/world/stake.ts` (craftable iron-stake
world-anchor, recipe 16). New `stake` kind on RopeEndpoint union. Stake mesh
visually iterated to 3 rounds. **Multi-worm v12→v13**: ctx.sandWorms array,
per-worm rejection sampling (2 worms / world, 400m min separation), backward-
compat verified (singleton → sandWorms[0]). **Lizard pipeline lift**: 5
iteration rounds applying D115 Lathe vocabulary — anatomical body + tapered
head + asymmetric sprawl legs vs pre-ACE Box brick. **Rig polish**: footstep
audio + dust now driven from `rig.stepCount` (phase-locked to visible
heel-strikes), 9 items tagged with `thirdPersonScale`. **Procgen POI**:
orbital_pod_cluster 6th wreck class + BRISTLE_ANTENNA 6th hullSegment variant.
Three items deferred per pre-committed scope cuts: raider_corpse +
sandworm_carcass endpoint kinds (Cut #3), aim twist-IK (Cut #2),
dune_drill_site POI (Cut #1).

## Session ACF — pick at session-start

User has not pre-directed ACF. Top candidates:

**Option A — B1 Phase 3 follow-up (~3-4h)**. Finish the deferred endpoint
kinds. The shared `ropeConstraint.ts` helper is in place; each new kind
needs (1) the body-side scaffolding (kinematic body promotion on raider
death; tagging the sandworm corpse for drag), (2) interaction routing
(RMB-on-corpse with rope wielded), (3) save schema (additive — tetherCorpseId
+ tetherCarcassId), (4) playtest verification (does dragging actually feel
correct). Acceptance: kill raider → wield rope → RMB-on-corpse → drag it
on foot or attach to sled. Same for sandworm carcass.

**Option B — Sled riding mechanic, second attempt (~3-5h)**. Tabled in
ACD per D125 with two next-attempt directions: full Option C parenting
(override `setNextKinematicTranslation` on the player entirely while
riding — skip KCC) OR synthetic "ride peg" dynamic body (mirror the
branch-on-sled trick). The slope-slide + body-tilts-to-terrain from ACD
makes this a meaningfully different second attempt.

**Option C — Apply procedural-character pipeline to companion + raider
(~5-7h)**. Companion (currently primitive body with 5 radial legs) +
raider (currently uses a Quaternius GLB from Session N, predating D107
zero-asset) both stand to benefit from the same Lathe / sub-pivot stack
the player rig + lizard now use. Raider in particular would retroactively
align with D107.

**Option D — A1 infinite chunk streaming (~6-10h, multi-session arc)**.
Strategically the right time per the ACE plan's analysis (multi-worm
array-ified the schema in that direction). But this is properly a
multi-session arc — scoping pass + chunked load + save migration + POI
lifecycle + playtest hardening. Single overnight may not finish.

## Autonomy contract

When ambiguous mid-session → pick the option closest to GDD pillars +
decisions.md realism dial, append a new D-entry, keep going. Surface only on:
- Procedural-vs-asset question (D107 — stay procedural unless explicit user approval).
- Save-schema bumps (D81 — additive only; flag if you need to bump SAVE_VERSION).
- Destructive git operations.
- Catastrophic block (a critical system breaks and the fix > 1h).

## Stop conditions

- Wall-clock 4-6h for focused, 8-14h for overnight.
- 3 consecutive fix walls on the same gate → invoke `/scope-cutter`.
- Catastrophic block / destructive-action attempt → STOP and surface.

## Notable footguns (carried forward)

- **D107 zero-asset**: No GLB / no PBR / no asset files. Everything procedural.
- **D109 localSpace=true on moving entities**: any shader applied to a moving
  body MUST pass `localSpace: true` or texture detail crawls.
- **D81 additive save discipline**: try additive; bump only if genuinely
  incompatible.
- **D125 KCC moving platforms**: Rapier KCC has no built-in moving-platform
  support. Direct delta application via setLinvel or friction is fundamentally
  incompatible.
- **D126 ropeConstraint helper**: new tetherable kinds populate the constraint
  target shape (attach point + managed velocity scalars + terrain + hy +
  clearance) — don't re-implement the math.
- **D127 multi-worm**: `ctx.sandWorms.list` is an array. Use `.find(...)` to
  match by id at runtime; in save/load, match by INDEX not id (boot allocates
  fresh ids each session).
- **D128 procedural-character pipeline**: when applying Lathe geometry to a
  body-along-X-axis entity, `rotation.z = ±π/2` controls profile axis
  direction; verify orientation early (snout at +X, neck-joint at body's
  front-end x).

## Verification protocol

Single command: `npm run verify` (= `tsc --noEmit`). Dustfall is post-MVP
and opted out of the framework's tier-ladder verification model.

For visual/feel work: honor the iteration discipline
(`shared-memory/iterative-polish-discipline.md`). Build → screenshot →
critique → iterate, 5-8 rounds for new visual elements, 3-5 for tuning.
tsc clean is the type-check gate, not the quality gate.

## Begin block

1. Read CLAUDE.md (auto-loaded), backlog.md, decisions.md (D126-D130
   especially), roadmap.md.
2. Confirm `npm run verify` baseline passes.
3. Decide ACF direction (A/B/C/D above, or surface a different priority
   the user wants).
4. TaskCreate covering priority items.
5. Begin coding.
