# Research: Multi-chamber cave system feasibility

**Researched**: 2026-07-17  
**Trigger**: D254 open decision — heightfield collider one-sidedness unknown; need spike design + architecture fallback ladder  
**Depth**: medium

## Summary

Rapier heightfields are **one-sided and fragile**: three public GitHub issues (rapier.js #61, react-three-rapier #564, #730) document TriMesh and ball colliders failing to interact with static heightfields. Character controller docs don't address underground behavior. **A 10-minute spike should immediately test capsule positioning below the sheet before committing to architecture.** Four progressively complex options exist: (1) naive hole + separate trimesh (risky—collider gaps), (2) portal/teleport to far-coordinate cave island (proven, seamless), (3) chunk-local heightfield→trimesh swap at cave entrance (fits Dustfall's per-chunk streaming), (4) hand-authored trimesh caves bolted to terrain (safest, labor-intensive). Cave generation via cellular automata + marching cubes is feasible for deterministic seeding.

## Key findings

1. **Heightfield one-sidedness confirmed via GitHub issues** — TriMesh collider does not collide with static heightfield collider ([rapier.js #61](https://github.com/dimforge/rapier.js/issues/61), unresolved); ball colliders pass through heightfield ([react-three-rapier #564](https://github.com/pmndrs/react-three-rapier/issues/564)); heightfield collider interaction difficulties reported March 2025 ([react-three-rapier #730](https://github.com/pmndrs/react-three-rapier/issues/730)).

2. **Character controller documentation does not address underground** — [Rapier character controller guide](https://rapier.rs/docs/user_guides/javascript/character_controller/) covers slopes, stairs, collision events, but has no documentation for capsules positioned below or inside colliders; offset/margin behavior is designed for surface collision, not interpenetration resolution.

3. **Heightmap fundamental limitation** — A heightfield stores one Z value per XY cell, so terrain cannot fold back over itself ([Unreal Engine 5.8 Mesh Terrain guide](https://www.strayspark.studio/blog/mesh-terrain-ue5-8-caves-overhangs-guide)): "A heightmap stores exactly one elevation value per XY grid cell, so terrain can never fold back over itself."

4. **Portal teleportation is production-proven** — [Medium article on portal teleportation in Unity](https://medium.com/@limdingwen_66715/multiple-recursive-portals-and-ai-in-unity-part-2-portal-teleportation-e66da381221d) documents the standard pattern: detect crossing via dot product, buffer input across `Update()/FixedUpdate()` boundary, call `Physics.SyncTransforms()` after teleport to notify physics engine of new position. No frame flashing when timed correctly.

5. **Cellular automata + marching cubes is standard for hobby caves** — [GitHub project Procedural-2D-3D-caves](https://github.com/Lutwidge/Procedural-2D-3D-caves) implements two-stage generation: (1) random map with walls/empty spaces, smoothed by local density; (2) marching squares (2D) or marching cubes (3D) to convert grid to continuous mesh. Deterministic seeding possible, vertices subdivided to respect engine limits.

6. **The Long Dark cave design: torch economy + landmark pacing** — [Long Dark cave wiki](https://thelongdark.fandom.com/wiki/Cave_(Transition_Zone)) + community forums document the dread pattern: limited light sources (matches, storm lanterns, flares) force resource rationing; day/night cycle creates optical switching (day = static sphere darkness, night = blue shadow visibility); bedroll placement as navigation anchor; tunnels described as "long and winding," recommending light for safe navigation.

## Actionable takeaways

For Dustfall's spike + architecture decision:

- **Spike test (10 min attended):**
  1. Spawn player capsule at origin with Y = -50 (below current heightfield sheet, above floor).
  2. Attempt walk forward/backward; check if capsule is ejected upward or stays below.
  3. Ramp from Y=0 down to Y=-50 via shallow slope, walk it; does character slide off the underside of the sheet?
  4. Jump from Y=-50 back toward Y=0 through the sheet; does character tunnel through or collide top-side?
  5. **Expected outcomes:** Ejection = heightfield is one-sided (expect this); free movement below = surprising, use it; tunneling = collision is broken (fallback to portal).

- **Architecture ladder (if naive approach fails):**
  1. **First try:** Chunk-local heightfield→trimesh replacement. At cave entrance chunk, replace the streaming chunk's HeightfieldCollider with a trimesh collider carved to match the visual mesh (already exists per chunk in `terrain.ts`). Requires: disable heightfield for this chunk, add trimesh with pre-carved opening. **Effort:** 2–4 hours (verify no z-fight, edge sealing).
  2. **Proven fallback:** Portal teleport to far-coordinate cave island (e.g., X=100k, Y=-1000). Render seamlessly by attaching camera to a proxy body and keeping world-space position synchronized. **Effort:** ~6 hours (portal trigger, input buffering, camera sync, Physics.SyncTransforms equivalent in Rapier).
  3. **Safest (if above fail):** Hand-authored trimesh caves as separate static meshes, bolted to the terrain surface at procedural POI spawn (like current wreck placement). **Effort:** O(caves) modeling + placement code.

- **Cave generation approach:** Cellular automata (room topology) → marching cubes (mesh extraction) matches Dustfall's deterministic, seed-based world. Use simplex-noise seeding (already available via `simplex-noise`) for room density fields. Keep cave mesh local to chunk for streaming parity.

- **Dark navigation:** Implement "deep cave" ambient ambience (silence → low-frequency drone) + shadow-only rendering at depth < threshold (no torches needed for gameplay, but torch light becomes high-value once present). Spawn navigable nodes (bones) at room centers as invisible breadcrumbs for AI + player mental model. Avoid maze-like loops; prefer branching tree topology (easier to backtrack without compass/map).

## Contrarian or surprising

- **TriMesh collider does NOT collide with static heightfield** — this is surprising because both are Rapier primitives. It's an open, unresolved GitHub issue, not documented as a limitation. **Implication:** Option A (hole + separate trimesh) may not work; don't assume it bridges the gap.

- **Character controller docs have zero guidance on underground** — the offset/margin design assumes the character is *above* surfaces, not *below*. Underground behavior is undefined by Rapier's public guidance.

- **Portal teleportation requires `Physics.SyncTransforms()`** — a non-obvious step that must happen *after* position update in the same frame, or the character controller ignores the teleport. Frame timing is load-bearing.

- **The Long Dark uses static-day/dynamic-night visibility** — caves are harder to navigate during day (artificial darkness sphere) than night (blue ambient). This inverts typical outdoor play; day/night switching creates emergent exploration strategy (wait for night to navigate, sleep in cave).

## Architecture decision tree

**Spike outcome:**
- Capsule stays below sheet → **Use Option 1 (chunk-local trimesh swap)**
- Capsule ejected upward → **Use Option 2 (portal island)** (proven fallback)
- Capsule tunnels through → **Use Option 3 (hand-authored trimesh cave)** (collision broken, separate the geometry entirely)

**Time-to-playable estimate:**
- Option 1: ~8–10 hours (spike + trimesh swap + two cave modules to prove collision sealing + test save/load persistence)
- Option 2: ~12–14 hours (portal + camera sync + invisible trigger zones + test frame timing, input buffering)
- Option 3: ~20+ hours (hand model 1–2 cave modules, integrate as POI spawnable, test no z-fight, test dynamic lighting inside)

## Spike script (concrete steps)

**Setup:**
1. Create a temporary scene file `src/world/test-cave-spike.ts` with a simple descending ramp (Y=0 → Y=-50) and flat floor at Y=-50.
2. Disable the main terrain (or set it far away).
3. Spawn player capsule at origin; heightfield collider should be present at Y≈0.

**Test sequence:**
```
Test 1: Capsule at rest
  pos = {x: 0, y: -50, z: 0}
  → Wait 1 sec, check if capsule moved (ejected upward?)

Test 2: Walk down ramp
  playerPos = {x: 0, y: 0, z: 0} (top of ramp)
  → Walk forward 5 seconds down a 10° ramp (Y should drop to -5)
  → Check if character slides off invisible wall at ramp edge

Test 3: Jump from below
  playerPos = {x: 0, y: -50, z: 0} (below sheet)
  → Press jump (upward velocity +10 m/s)
  → Walk forward 5 seconds; does character tunnel through Y=0 or collide?
  → If collision, check if it's from top or bottom of sheet

Test 4: Collider inspect
  → Log `body.colliders()` for the heightfield and capsule
  → Check contact pairs in physics debug to see if any collision is being computed
```

**Acceptance criteria:**
- Test 1 fails (capsule ejected) → "Heightfield is one-sided, ejection confirmed"
- Test 2 succeeds (walk down ramp) → "Collider is intact below sheet; Option 1 viable"
- Test 3 succeeds (jump through from below) → "Character can traverse between above/below; Option 1 is safe"
- Test 3 fails (tunnel/pass-through) → "Collision is broken; Option 2 or 3 required"

## Sources

- [Rapier.js GitHub Issue #61: TriMesh collider does not collide with heightfield](https://github.com/dimforge/rapier.js/issues/61) — core collision interaction problem
- [React Three Rapier Issue #564: BallCollider passes through HeightfieldCollider](https://github.com/pmndrs/react-three-rapier/issues/564) — another collision failure
- [React Three Rapier Issue #730: Not able to work with Height Field collider](https://github.com/pmndrs/react-three-rapier/issues/730) — recent (Mar 2025) issues
- [Rapier Character Controller Documentation](https://rapier.rs/docs/user_guides/javascript/character_controller/) — official behavior guide (notes absence of underground guidance)
- [Unreal Engine 5.8 Mesh Terrain Guide](https://www.strayspark.studio/blog/mesh-terrain-ue5-8-caves-overhangs-guide) — heightmap limitation explanation + mesh terrain alternative
- [Procedural-2D-3D-Caves GitHub Repository](https://github.com/Lutwidge/Procedural-2D-3D-caves) — cellular automata + marching cubes implementation
- [Portal Teleportation Tutorial (Medium)](https://medium.com/@limdingwen_66715/multiple-recursive-portals-and-ai-in-unity-part-2-portal-teleportation-e66da381221d) — physics synchronization + input buffering for seamless portals
- [The Long Dark Cave Wiki](https://thelongdark.fandom.com/wiki/Cave_(Transition_Zone)) — torch economy + navigation design reference
