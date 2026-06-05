# Session ACAI — Vulture: rigged animations + branch-perch + death physics + tree collision

## Context

The rare vulture shipped in ACAH (perch → flee → shoot-for-meat) but is a STATIC mesh: it
floats at a computed crown height (not on an actual branch), has no real animation (a tiny
idle bob + a crude scripted death fall), and the dead trees have no colliders (you walk
through trunks). This session makes the vulture a believable living creature and fixes the
tree pass-through.

User-confirmed design forks:
- **Death** = single Rapier **dynamic-body tumble** (real physics — bounces/rolls on the
  dunes, settles where it lands; mesh goes limp). NOT articulated ragdoll.
- **Flee** = **relocate + land**: a disturbed vulture flaps away, flies to ANOTHER salt-flat
  tree, and LANDS (stays alive + re-perchable). So the FSM gains `flying` + `landing` states
  and all four requested anims (idle / flapping / landing / death-fall) are used.

All additive — no `SAVE_VERSION` bump (the `vultures[]` save is already additive; flight/land
states are transient → restore to perched; tree colliders rebuild from seed).

---

## Tier 1 — Vulture rig (restructure the mesh into animatable sub-pivots)

Today `makeVultureVisual` (`src/enemies/vulture.ts:76-172`) is a FLAT group of ~20 meshes.
Restructure into joint pivots, mirroring the lizard/shrew leg-pivot convention
(`enemies/lizard.ts:196-255` `buildLeg` + `g.userData.gaitLegs`): a sub-`Group` positioned at
the JOINT, with its child meshes offset so the group rotates about that joint.

- **Pivots** (each a `Group` at its joint, children offset): `wingL` / `wingR` (at the
  shoulders; wing slab + primaries hang off the pivot), `neck` (at the body front; neck
  segments + head + beak + eyes ride it so the whole head bobs/turns about the neck base),
  `tail` (at the tail root), `legL` / `legR` (for tuck/extend). Body + hump stay on the root
  (optional `body` pivot for a breathing micro-scale).
- Store them: `g.userData.rig = { wingL, wingR, neck, tail, legL, legR }` (typed `VultureRig`).
- **Model faces +X** (head at +X) — keep that; flight yaw already uses `heading + π/2`.
- **Verify**: `vulture` rig-shot (3q + side) — the static silhouette must read IDENTICAL to
  ACAH's (the pivot restructure is a refactor, not a redesign). Iterate until it matches.

## Tier 2 — Animation driver (idle / flap / landing / death poses)

NEW `animateVulture(v, elapsed, dt)` called each frame from `updateVultures`, reading
`v.mesh.userData.rig`. Pose per state (sinusoidal drivers like `creatureGait.ts` but
hand-written per joint; new `VULTURE_*` tuning consts, rule 2):
- **perched (idle)**: slow neck bob + occasional wing shuffle + faint breathing. (Replaces the
  current `position.y` bob.)
- **flying**: wings FLAP (sin at `VULTURE_FLAP_HZ`, large `rotation.z` amplitude, L/R mirrored),
  legs tucked, neck extended forward, tail fanned, slight body pitch into the climb.
- **landing**: wings spread + cupped forward (decel flare) + flutter, legs extended DOWN, neck
  up, body pitched up — a brief timed pose easing into perched.
- **dead**: rig set LIMP once (wings splay out/down, neck droops, legs slack); the dynamic body
  (Tier 5) tumbles the whole mesh, so DO NOT drive rotation here.
- **Verify (rule 8)**: `vulture` rig-shot strips for the flap cycle + the landing flare pose +
  the dead limp pose (the static POSES are screenshot-verifiable; the in-MOTION flap CADENCE is
  partly foreground-owed, D150 — note it). 5-8 iteration rounds on the flap (new motion).

## Tier 3 — Branch-accurate perch (sit cleanly ON a branch)

The tree merges to ONE geometry, so branch meshes don't survive — capture perch points DURING
generation. In `deadTree.ts makeDeadTree`'s recursive `grow()`: when emitting a STURDY limb
(e.g. `depth ∈ {1,2}` — thick enough to bear a bird, not the thin twigs), record a point ~70%
along the segment + the segment direction → `g.userData.branchPerches: Array<{pos, dir}>`
(tree-LOCAL). In `spawnDeadTrees` `placeTreeAt`, transform each to WORLD (apply `tree.rotation.y`
+ `tree.position`) and collect; **return the branch perches** (replacing the single-`perchY`
`perchPoints`). The vulture spawner seats the bird with **feet (group origin, y=0 local) at the
branch point**, a tiny downward bias so talons contact, yaw so it perches across the limb.
- **Verify**: `vulture` rig-shot — feet visibly gripping a real branch (not floating in a gap),
  across several seeds. Iterate the "~70% along / depth band" until perches read clean.

## Tier 4 — Relocate-and-land FSM (flee → fly to another tree → land)

Extend the FSM `perched | flying | landing | dead` (`updateVultures`, `vulture.ts:287-361`).
Pass the full branch-perch list into the vulture module (from `spawnDeadTrees` via `main.ts`)
so a fleeing bird can pick a relocation target.
- **perched → flying**: player within `VULTURE_SPOT_RADIUS` → launch; **pick a target perch on a
  DIFFERENT tree**, far from the player (min distance), reachable.
- **flying**: flap (Tier 2) + climb then glide along an arc toward the target; kinematic body
  follows the mesh (so a gun can still hit it mid-air). If the player gets within spot radius of
  the chosen target before arrival, pick a new farther target.
- **flying → landing**: near the target + player beyond spot radius → descend + landing flare.
- **landing → perched**: on touchdown, re-seat `v.perch`/`v.pos` at the target, reset heading.
- **Verify**: a flight `--scenario` strip (launch → arc → land) + an eval asserting the state
  cycle perched→flying→landing→perched and that the target perch is on another tree. In-motion
  FEEL (arc/cadence) is foreground-owed (D150) — flag, don't fake.

## Tier 5 — Death = dynamic-body tumble

On `damageVulture` (`vulture.ts:185`): remove the kinematic body+collider (and its
`_colliderToVulture` map entry), create a **DYNAMIC** body at the current mesh transform, mirror
the dropped-item physics (`pickups.ts:467-506`): cuboid collider from the mesh bbox, `CCD
enabled` (no heightfield tunneling on a fast fall), `linearDamping 0.6 / angularDamping 0.8 /
friction 0.85 / restitution 0.15`, seed `setLinvel` from flee/fall momentum + a downward kick
and `setAngvel` for tumble. Set the LIMP rig pose once. In `updateVultures` `dead`: sync the
mesh from the body each frame (`pickups.ts:521-551` pattern); when it settles (low lin/ang vel
for ~0.3s, or body sleeping), mark `landed = true` + tag `'take'` (keep the body sleeping so it
rests on the dune). The terrain heightfield collider (`terrain.ts:196`) is what it lands on.
- **Verify**: `vulture-kill` eval extended — shot → tumbles → settles (`landed=true`, `'take'`
  tag, mesh at rest on terrain). A fall strip for the visual.

## Tier 6 — Dead-tree collision

Trees are visual-only today (`deadTree.ts:1-8`). Add a **static cylinder collider per trunk**
via `makeStaticCylinder(world, halfHeight, radius, pos)` (`physics/bodies.ts:159`), mirroring
the cactus pattern (`cactus.ts:196`). `makeDeadTree` exposes the trunk radius + collidable
height (≈ `baseR*1.1` × the bole/lower-crown height — enough that a ground player can't walk
through the trunk; high branches don't need collision). `spawnDeadTrees` gains a `world: RAPIER.World`
param (thread it from `main.ts:173`) and adds the collider at each tree in `placeTreeAt`.
- **Verify**: eval — a horizontal raycast / shape query at trunk height hits the collider; the
  KCC can't pass through (spot-check by translating the player into a trunk and confirming the
  collider exists). No save/cleanup needed (rebuilt from seed).

---

## Critical files
- `src/enemies/vulture.ts` — rig restructure (T1), `animateVulture` (T2), perch seating (T3),
  relocate/land FSM (T4), dynamic-death (T5). The bulk of the work.
- `src/world/deadTree.ts` — capture `branchPerches` in `grow()` + return them (T3); expose trunk
  dims + add the trunk collider (T6); `spawnDeadTrees` gains a `world` param.
- `src/main.ts` — pass `physics.world` to `spawnDeadTrees`; thread the branch-perch list into the
  vulture spawner (`spawnVulturesProcgen`).
- `src/config/tuning.ts` — `VULTURE_FLAP_*`, idle/landing/relocate consts (rule 2).
- `src/physics/bodies.ts` (`makeStaticCylinder`), `src/pickups/pickups.ts` (dynamic-body ref),
  `src/enemies/lizard.ts`/`creatureGait.ts` (rig/anim reference) — READ-ONLY templates.
- `scripts/rig-shot.mjs` — extend the `vulture` scenario (flap/landing/dead pose strips) +
  `vulture-kill` (settle assertion) + a flight strip.

## Verification
- `npm run verify` (tsc) clean throughout. Visual (rule 8): `npm run rig-shot -- --scenario=vulture`
  (perched-on-branch, flap cycle, landing flare, dead limp) — iterate. Logic: extend
  `vulture-kill` (death tumble → settle → tag) + a state-cycle eval (perched→flying→landing) +
  a tree-collision eval. In-motion flap/flight FEEL → foreground-owed (D150), flagged not faked.

## Scope-cut order (pre-committed, if time/quality pressure)
1. **Relocate-and-land (T4)** → fall back to "flee → fly off + despawn" (current) but KEEP the
   flap animation; landing anim then only shows on spawn. (Biggest scope; cut first.)
2. Idle wing-shuffle / breathing micro-details (keep the neck bob + flap + landing + death).
3. Branch-perch "~70% along sturdy limb" refinement → simplest: perch at the first major fork
   point (still a real branch point, less selective).
**Never cut**: tree collision (T6 — small + high-value), the dynamic-death (T5 — user-chosen),
finishing any animation mid-iteration to a shippable pose.

## Autonomy + stop conditions
Ambiguous → GDD pillars + decisions.md realism dial, append a D-entry, continue. Screenshot-
iterate every pose (rule 8). Stop on: 3 fix-walls on one element (log + move on) · a save bump
turning out necessary (surface it) · destructive-git attempt. Batch in-motion FEEL for the
user's playtest (D150) — the headless clock can't judge flight cadence.

## On stop
Run gamedev-framework `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap →
D-entries → backlog → report → next-prompt → post-mortem → commit + tag `session-ACAI` + push).
