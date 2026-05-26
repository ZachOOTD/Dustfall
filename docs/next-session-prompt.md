# Session ACD — Kickoff Brief (post-ACC)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded; ACC Last-shipped — throw items on sled +
   sandworm twilight breach + B1 Phase 2 RopeEndpoint refactor)
2. `docs/session-end-report.md` — cumulative through ACC
3. `docs/changelog.md` — ACC + ACB + ACA at top
4. `docs/decisions.md` — D119-D121 latest (kinematic-rider, RopeEndpoint
   vocabulary, twilight-breach flag bypass)
5. `docs/roadmap.md`
6. `docs/backlog.md` — ACC followup at top

## What's already built (post-ACC snapshot)

84 sessions. Tactile sled mechanics fully realized across ACA-ACC:
- ACA: sled visual rework (warped scrap metal sheet) + B1 Phase 2 lite
  (static-pos tether kind)
- ACB: locker-on-sled (parented mobile storage) + static-pos LMB stake UX
- ACC: throw items on sled (kinematic-rider promotion) + ambient
  sandworm twilight breach + B1 Phase 2 architectural refactor

The "tow a flatbed full of loot back to camp" gameplay loop is complete.
You can: deploy a sled, attach a locker on top, tow it via rope by hand
or speeder or companion, stake it down anywhere, throw items onto its
deck and have them ride along, pick them back up.

SAVE_VERSION still v12 (ACC was additive only — no v13).

## Session ACD focus — pick one direction

ACD doesn't have a predetermined focus. Pick at session-start from the
ACD candidates list in `docs/roadmap.md`. Recommended order of
consideration:

### Option A — B1 Phase 3: non-sled tethers (~6-10h)

The Phase 2 architectural lift positions for this but the actual
constraint physics for non-sled towed bodies hasn't shipped. To make
"drag a raider corpse" or "lasso a lizard" work:

1. Lift the inextensible-rope position-snap from `updateSleds` into a
   shared `updateTetherConstraints(ctx)` system that owns physics for
   any towed-end body (not just sleds).
2. Add new endpoint kinds (`raider_corpse`, `lizard`, `sandworm_carcass`,
   `world_anchor` stake item) — each ~30 LOC per the D120 pattern.
3. Gameplay around each: raider corpses spawn on death + can be dragged
   to camp; world-anchor stake is a craftable item that creates a
   `static-pos` endpoint anywhere.

Big-ticket continuation. Lots of touch points but each one is mechanical.

### Option B — A1 infinite chunk streaming (~6-10h)

The 2400m world (3×3 chunks) feels small after 80+ sessions. Streaming
new chunks at the world edge as the player walks would make the world
truly explorable. Per-seed determinism preserved via the existing seed
infrastructure.

Risks: chunk lifecycle (loading + unloading meshes/bodies), POI
distribution across newly-streamed chunks, save schema for current
chunk grid.

### Option C — Procedural pipeline applied to NPCs (~4-8h)

The D115+D117+D118 stack (Lathe primitives + cloth drape +
sub-pivots) currently only powers the player rig. Apply it to:
- Raider variants (3-4 silhouettes with different clothing layers)
- Companion (currently simple radial creature)
- Lizards (currently simple body+head primitives)

Visible payoff: world reads more populated + each creature has
characterful animation.

### Option D — Multi-worm population (~3-4h)

Currently 1 worm per world. Extending to N (say 2-3) needs:
- Save schema: `sandWorm: {...} | null` → `sandWorms: [...]`
- Per-worm spawn separation (min 400m)
- Detection radius shouldn't compound (already independent per worm)
- Playtest: N>1 might ruin early game — start with N=2.

### Option E — RMB-on-rope UX (was scope-cut from ACC) (~1-2h)

If you want a focused small session, revisit the D77 metaphor conflict.
Either (a) re-bind RMB-on-rope to a new button (Tab? Q?), (b) make RMB
context-sensitive (release if attached, attach if not — but that's
already what LMB does), or (c) decide it's not worth the disruption
and remove from the backlog permanently.

### Option F — Item viewmodel fidelity pass remainder (~3-5h)

19 ItemDefs still at primitive/basic-shader complexity. List from
ABO and ACC backlog: large_tent_kit, bedroll_kit, lantern_kit, torch,
flashlight, etc. Apply procedural shader vocab (D107+D109+ABH) per
item. Mechanical work.

## Priority items (if Option A picked)

### B1 Phase 3 P1 — Lift constraint to shared system (~2-3h)
Move the inextensible-rope position-snap from `updateSleds` into a new
`src/world/tetherConstraints.ts` module + `updateTetherConstraints(ctx)`
tick. New `Tether {a, b}` records on a per-rope list (separate from
sled.tether for now; sled.tether stays for current behavior). Each
tick:
- For each Tether, resolve a + b world positions via
  `resolveEndpointWorldPos`.
- If neither is the player or a sled (i.e., both endpoints are
  non-locomotion-capable), apply the position-snap to the side
  designated as "towed" — likely the one with a Rapier dynamic body.

### B1 Phase 3 P2 — World anchor stake item (~1-2h)
New craftable: `stake_kit` (recipe: scrap×1 + branch×1). On placement,
creates a `world_anchor` Pickup-like entity at the placement position.
Rope can be tied to a stake. Replaces / complements the ACB
`maybeStakeSledAtFloor` UX with a tangible item.

### B1 Phase 3 P3 — Raider corpse drag (~2-3h)
On raider death, spawn a `raider_corpse` entity (procedural rig
re-used from raider, scaled + rotated to face-up). Pickup-like
hover detection; rope can tie to it. Towed via the new Phase 3
constraint system. Use case: drag corpse off the road, to a pile,
into a sled cargo deck for storage (corpse-as-pickup?).

### B1 Phase 3 P4 — Save migration v12 → v13 (~30min)
Per-rope tether persistence (separate from sled.tether). Schema
addition: `tethers: [{ a: RopeEndpoint, b: RopeEndpoint }, ...]` for
non-sled ropes. Bump version if needed.

## Autonomy contract

Iteration discipline applies if visual/feel work (B1 Phase 3 raider
corpse rig is visual). Pure data-model + save schema can verify via
tsc + boot test.

## Notable footguns

- **D81 save migration**: schema at v12 (additive). Phase 3 may want
  v13 bump if adding `tethers: [...]` field for per-rope persistence.
- **Constraint lift risk**: the inextensible-rope position-snap in
  `updateSleds` is finely tuned for sled physics (locked rotations,
  CCD, body damping). Lifting to a shared system needs to preserve
  these properties or each per-tether type needs its own body
  configuration.
- **Kinematic-rider doesn't apply to towed bodies** — D119 is for
  STATIONARY (resting-on-something) items. Towed bodies (like a
  raider corpse) need to remain dynamic (collide with terrain,
  bounce, tumble). Don't accidentally promote a corpse to
  kinematic-rider.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For physics work, verify via boot test: place a sled, throw items
onto deck, attach rope, walk → items follow sled. After Phase 3:
kill a raider, tie rope to corpse, drag to a sled, deposit corpse,
walk away pulling sled with corpse inside.

## Begin block

Read CLAUDE.md (auto) + recent changelog + decisions. Pick an
option from the ACD candidates. TaskCreate sub-tasks. Start.
