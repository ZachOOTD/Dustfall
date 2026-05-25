# Research: Third-Person Camera Systems in Games

**Researched**: 2026-05-25  
**Trigger**: Dustfall shipped a basic F-key 3P camera toggle (Tier 2 ABO); next session dedicated to polishing 3P feel and integration with existing FP pipeline.  
**Depth**: medium

## Summary

Third-person camera design hinges on four interconnected systems: **placement** (2.5–4m behind, 1.5–2.5m above), **collision** (raycast from player head to intended position; clamp on hit + 0.3m pushback buffer), **crosshair behavior** (center-screen + camera direction for aiming; optional character-forward twist for physical aim alignment), and **rig rotation** (hard follow on turn, optional 6–12/s lag lerp for smoothness). Dustfall's survival-game context (melee combat + scrap_gun ranged + foot exploration) recommends a center-behind medium-distance setup with raycast collision and instant F-key transition; held items use a dual-mesh pattern (viewmodel hidden in 3P, world-mesh visible on rig).

## Key findings

1. **Over-shoulder vs. center-behind trade-off** — Over-shoulder (TLOU2, Gears 5) creates tactical visibility of the character's weapon-hand and reads as more cinematic; center-behind (Souls, Genshin, most modern 3P) provides symmetric view, simpler aiming math, and no camera drift when the player rotates. For a survival game combining exploration + combat, center-behind is the default recommendation unless shoulder-specific weapon visibility is a design goal. — Source: [Little Polygon: Tech Breakdown: Third Person Cameras](https://blog.littlepolygon.com/posts/cameras/)

2. **Optimal camera distance for visibility + combat** — Souls games typically place the camera 3–4m behind and 1.5–2.5m above the character. Dustfall's current 2.5m back / 1.5m above sits at the conservative (closer) end; 3–3.5m back is safer for seeing obstacles ahead during exploration, while tighter 2–2.5m works for melee-focused combat. Increasing to 3–4m is standard across most modern TPS games. — Source: [Little Polygon: Tech Breakdown: Third Person Cameras](https://blog.littlepolygon.com/posts/cameras/), [Eric Martel: Tips and Tricks for a Robust Third-Person Camera System](http://www.gameaipro.com/GameAIPro/GameAIPro_Chapter47_Tips_and_Tricks_for_a_Robust_Third-Person_Camera_System.pdf)

3. **Raycast-based spring-arm collision is standard** — Most TPS games use a raycast from the player's head to the intended camera position; if the ray hits an obstacle within the safe distance, clamp the camera forward (closer to the player) by the hit distance minus a small pushback buffer (~0.2–0.5m). This prevents clipping through walls while keeping the player visible. Sweep tests (casting a volume along the path) are more conservative but add compute cost; raycasts are sufficient for typical indoor/outdoor exploration. — Source: [Complete camera collision detection (Third person games) - Unity Discussions](https://forum.unity.com/threads/complete-camera-collision-detection-third-person-games.347233/), [A 3rd Person Camera in a Complex Voxel World - Medium](https://bonsairobo.medium.com/a-3rd-person-camera-in-complex-voxel-world-523944d5335c)

4. **Rapier physics engine supports raycasting natively** — Rapier's `world.castRay()` method with optional filters allows per-frame queries from player head to camera position; filtering out sensors (via `exclude_collider`) and the player's own body prevents false hits. For Three.js + Rapier in Dustfall, using Rapier's native raycast (not THREE.Raycaster) ensures physics-world accuracy and avoids duplicate collision queries. — Source: [Rapier Scene Queries Documentation](https://rapier.rs/docs/user_guides/javascript/scene_queries/)

5. **Center-screen crosshair + camera direction is the consensus for TPS shooters** — The crosshair stays centered on screen; projectiles/bullets are traced from the camera's forward direction (world direction player is looking) rather than the character's forward. This feels responsive and matches player intent. Optional upper-body IK that rotates the character's torso toward the camera target is more complex but reads as "character physically aiming"—this is a post-MVP polish feature. — Source: [Third Person Shooter - Aiming at Crosshair - UE5 Forums](https://forums.unrealengine.com/t/third-person-shooter-aiming-at-crosshair/129180/)

6. **Dual-mesh pattern for FP viewmodel + 3P world-mesh** — Modern TPS/hybrid games (Tarkov, most online shooters) maintain two render layers: (1) a camera-relative, hand-sized viewmodel (current Dustfall setup) visible only in FP, (2) a rig-attached world-mesh (same item, scaled normally) visible only in 3P. Toggling between perspectives hides the viewmodel and shows the world-mesh on the rig's hand bone; visibility is gated per render layer. For Dustfall's mode toggle, this means: FP = viewmodel only; 3P = world-mesh only. — Source: [Render First-Person Meshes with a Separate FOV - Sahil Dhanju](https://sahildhanju.com/posts/render-first-person-fov/), [A Guide to First and Third Person Cameras - GameDev Academy](https://gamedevacademy.org/unity-3d-first-and-third-person-view-tutorial/)

7. **Instant camera snap on toggle is appropriate for a mode switch** — When the player presses F to toggle FP↔3P, the camera snaps to the new position and orientation instantly (next frame). Smooth lerps over 0.2–0.4s are used when the player transitions between camera *states* during gameplay (e.g., aiming down sights in a shooter), but FP/3P mode is a player-facing settings toggle, not a gameplay state change. Yaw should be preserved (FP yaw == 3P yaw) so the mouse direction doesn't reset. — Source: [Game Dev Mechanics: Third-Person Camera Systems](https://moonjump.com/game-dev-mechanics-third-person-camera-systems-how-it-works/), [UE5 Toggle Between Third and First Person Views](https://dev.epicgames.com/community/learning/tutorials/wd8X/unreal-engine-toggle-between-third-and-first-person-views)

8. **Hard-follow (instant) rig rotation with optional lag lerp for camera** — When the player turns, the character's body (rig) should follow the camera yaw immediately (hard-follow), so the character faces the direction the player is looking. Camera rotation lag (6–12/s lerp toward rig yaw) can be applied optionally for a softer feel, but it's independent of rig rotation. Souls games use this pattern: instant rig follow, smooth camera lag. For a survival game with melee combat, instant rig follow is standard; camera lag is cosmetic polish. — Source: [UE4 Dark Souls Camera System - Ronan Doherty](https://www.ronandoherty.com/projects/ue4-dark-souls-camera-system), [GitHub: UE4_DarkSoulsCamera](https://github.com/donanroherty/UE4_DarkSoulsCamera)

## Actionable takeaways

For Dustfall's 3P polish session (Tier 1–4 implementation):

- **Set camera offset to 3.2m back, 1.8m above, 0m lateral** (center-behind). This is slightly further than the current 2.5m back / 1.5m above, improving sightlines during exploration while keeping melee combat visible. No lateral offset (symmetric, not over-shoulder).

- **Implement spring-arm collision via Rapier `castRay()`** from player capsule head position to intended camera position. If hit: clamp camera forward by `hitDistance - 0.3m` (0.3m pushback buffer to prevent edge-hugging). Query filters should exclude the player's own body + sensor colliders. Update per frame in `updateCamera` after player movement.

- **Crosshair stays centered; aim from camera direction.** For melee (machete, pipe_staff): aim ray is camera-forward (character's sword swings toward where player looks). For ranged (scrap_gun): bullet trace from camera-forward. Character IK upper-body twist deferred to a future "aim-assist" polish session.

- **Held items: dual-mesh + visibility gating.** Keep existing FP viewmodel (camera-relative, hand-sized). Add a 3P "world-mesh" version of each wieldable item (scaled to rig hand size, attached to rig hand bone). In 3P mode: hide viewmodel, show world-mesh. In FP mode: hide world-mesh, show viewmodel. No per-item logic changes; toggle at the camera-mode level.

- **F-key toggle: instant snap, preserve yaw.** When player presses F: `ctx.flags.thirdPerson = !ctx.flags.thirdPerson`. Camera position snaps to new offset next frame. Yaw is preserved (don't reset mouse direction). Both FP and 3P should have the same head-height (`PLAYER_CAPSULE_EYE_HEIGHT`) for yaw consistency.

- **Character rotation: hard-follow rig yaw to camera yaw immediately.** Each frame in 3P, set `ctx.player.rig.rotation.y = cameraYaw` (or lerp at 60/s if you want fast-but-not-instant; most combat games prefer instant). Camera can optionally lag behind (lerp at 8/s) for visual smoothness, independent of rig rotation. Start with instant rig follow; add camera lag in a future session if it reads as "stiff."

## Contrarian or surprising

- **Center-behind is *more* difficult to aim with than over-shoulder** — The character's body can block camera sightlines when aiming downward (looking at feet to check ammo, for example). Over-shoulder solves this by offsetting the view to one side. However, center-behind is simpler to implement, more commonly used in modern games, and the "blocked sightline" issue rarely surfaces in survival games (which prioritize exploration over precision gunplay). Dustfall's scrap_gun is not a twitch-aim mechanic, so center-behind is the right call.

- **Souls-style soft-lock (auto-lock to nearby enemies) is orthogonal to camera distance/collision.** The search results emphasize soft-lock as a camera design feature, but it's actually a separate targeting system. Dustfall doesn't have soft-lock (no traditional boss patterns), so this isn't relevant; include it only if a future melee-boss fight demands it.

- **Raycast vs. sweep: the trade-off is not "accuracy."** Both methods work equally well for camera collision. Sweep (volume cast) is more conservative—it catches narrow gaps between geometry that a ray might slip through—but adds ~10–20% more compute per frame. For a 2400m world with typical POI interiors, raycast is sufficient and faster. Upgrade to sweep only if playtesters report camera clipping through thin walls.

## Sources

- [Little Polygon: Tech Breakdown: Third Person Cameras](https://blog.littlepolygon.com/posts/cameras/) — mathematical framework and parameter tuning for camera placement and framing.
- [Eric Martel: Tips and Tricks for a Robust Third-Person Camera System](http://www.gameaipro.com/GameAIPro/GameAIPro_Chapter47_Tips_and_Tricks_for_a_Robust_Third-Person_Camera_System.pdf) — GDC-adjacent comprehensive guide on camera robustness and collision handling.
- [Complete camera collision detection (Third person games) - Unity Discussions](https://forum.unity.com/threads/complete-camera-collision-detection-third-person-games.347233/) — practical raycast-based collision implementation patterns.
- [A 3rd Person Camera in a Complex Voxel World - Medium](https://bonsairobo.medium.com/a-3rd-person-camera-in-complex-voxel-world-523944d5335c) — detailed collision detection strategies for complex terrain.
- [Third Person Shooter - Aiming at Crosshair - UE5 Forums](https://forums.unrealengine.com/t/third-person-shooter-aiming-at-crosshair/129180/) — TPS crosshair + aiming direction patterns.
- [Render First-Person Meshes with a Separate FOV - Sahil Dhanju](https://sahildhanju.com/posts/render-first-person-fov/) — dual-mesh rendering architecture for FP viewmodel + world-mesh.
- [A Guide to First and Third Person Cameras - GameDev Academy](https://gamedevacademy.org/unity-3d-first-and-third-person-view-tutorial/) — comprehensive tutorial on camera architecture and mesh visibility.
- [Game Dev Mechanics: Third-Person Camera Systems](https://moonjump.com/game-dev-mechanics-third-person-camera-systems-how-it-works/) — camera transition mechanics and lerping strategies.
- [UE5 Toggle Between Third and First Person Views](https://dev.epicgames.com/community/learning/tutorials/wd8X/unreal-engine-toggle-between-third-and-first-person-views) — engine-specific mode toggle implementation.
- [UE4 Dark Souls Camera System - Ronan Doherty](https://www.ronandoherty.com/projects/ue4-dark-souls-camera-system) — detailed Souls-style camera with rig rotation and lag.
- [GitHub: UE4_DarkSoulsCamera](https://github.com/donanroherty/UE4_DarkSoulsCamera) — open-source Souls camera implementation reference.
- [Rapier Scene Queries Documentation](https://rapier.rs/docs/user_guides/javascript/scene_queries/) — raycast and collision filtering API for Rapier physics engine.
