// Escape-pod intro — the greybox SHIP interior (Phase 0 / T0.2).
// ─────────────────────────────────────────────────────────────────────────────
// Placeholder box geometry the player walks during the cockpit → corridor beats.
// Built LAZILY when the intro reaches the ship, disposed at the desert handoff. It
// lives at a far OFFSET from the desert (R2 — the desert world is boot-built + sits
// ready) so the two never interact. Unlit MeshBasicMaterial = obviously-greybox +
// zero lighting/shader-recompile dependency; the HERO ship is Phase 3 (the
// procedural-modeler). The KCC walks these static box colliders unchanged (R4 — the
// controller is collision-general, no terrain coupling). This is BLOCKOUT: the goal is
// a legible, walkable SPACE + correct flow, not beauty.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../../GameContext.ts';
import { makeStaticBox } from '../../physics/bodies.ts';

/** Far offset — high "in orbit", enclosed so the desert far below is not seen. */
const SHIP_ORIGIN = new THREE.Vector3(0, 3000, 0);

/** World-Z beat triggers (the corridor runs +Z from SHIP_ORIGIN; mouth ≈ z 2.6,
 *  dead-end ≈ z 14.6). Crossing ENTER_Z = "stepped into the corridor"; passing
 *  DEAD_END_Z = "reached the engine bay" (the disaster trigger). */
export const SHIP_CORRIDOR_ENTER_Z = SHIP_ORIGIN.z + 3.2;
export const SHIP_DEAD_END_Z = SHIP_ORIGIN.z + 13.6;

// Greybox palette (flat / unlit). Distinct tones so faces read at oblique angles.
const C_FLOOR = 0x484c54;
const C_WALL = 0x676c74;
const C_CEIL = 0x383c42;
const C_CORR_FLOOR = 0x52565d;
const C_CORR_WALL = 0x5e636b;
const C_FRAME = 0x26292d;
const C_PLANET = 0xc98a5a;

/** A greybox box's dimensions + centre: [w, h, d, centerX, centerY, centerZ]. Coords are
 *  LOCAL to SHIP_ORIGIN (cockpit floor-top sits at local y=0). Paired with a color in
 *  SPECS; each entry becomes a mesh + a matched static box collider (WYSIWYG collision). */
type BoxSpec = [number, number, number, number, number, number];

// Cockpit: 6w (x −3..3) × 3h (y 0..3) × 5d (z −2.5..2.5). The WINDOW is in the −Z
// wall (the camera faces −Z at spawn → looks straight out at the planet). The
// CORRIDOR opening is in the +Z wall, leading aft 12m to a dead-end (the disaster
// trigger lands there in T0.2b).
const SPECS: ReadonlyArray<readonly [BoxSpec, number]> = [
  // ── Cockpit shell ──
  [[6, 0.2, 5, 0, -0.1, 0], C_FLOOR],        // floor (top at y=0)
  [[6, 0.2, 5, 0, 3.1, 0], C_CEIL],          // ceiling (bottom at y=3)
  [[0.2, 3, 5, 3.1, 1.5, 0], C_WALL],        // +X wall
  [[0.2, 3, 5, -3.1, 1.5, 0], C_WALL],       // −X wall
  // Front (−Z) window wall, built around a 3w × 1.6h gap (x −1.5..1.5, y 0.9..2.5):
  [[6, 0.9, 0.2, 0, 0.45, -2.6], C_FRAME],   // below window
  [[6, 0.5, 0.2, 0, 2.75, -2.6], C_FRAME],   // above window
  [[1.5, 1.6, 0.2, -2.25, 1.7, -2.6], C_FRAME], // left of window
  [[1.5, 1.6, 0.2, 2.25, 1.7, -2.6], C_FRAME],  // right of window
  // Back (+Z) wall, built around a 2w × 2.4h corridor opening (x −1..1, y 0..2.4):
  [[2, 3, 0.2, -2, 1.5, 2.6], C_WALL],       // left of opening
  [[2, 3, 0.2, 2, 1.5, 2.6], C_WALL],        // right of opening
  [[2, 0.6, 0.2, 0, 2.7, 2.6], C_WALL],      // above opening
  // ── Corridor: z 2.6 → 14.6 (12m), 2w (x −1..1) × 2.4h (y 0..2.4) ──
  [[2, 0.2, 12, 0, -0.1, 8.6], C_CORR_FLOOR],   // corridor floor
  [[2, 0.2, 12, 0, 2.5, 8.6], C_CEIL],          // corridor ceiling
  [[0.2, 2.4, 12, 1.1, 1.2, 8.6], C_CORR_WALL], // corridor +X wall
  [[0.2, 2.4, 12, -1.1, 1.2, 8.6], C_CORR_WALL],// corridor −X wall
  [[2, 2.4, 0.2, 0, 1.2, 14.7], C_FRAME],       // corridor dead-end (disaster trigger — T0.2b)
];

let shipGroup: THREE.Group | null = null;
const shipBodies: RAPIER.RigidBody[] = [];

/** Is the greybox ship currently built? */
export function shipBuilt(): boolean {
  return shipGroup !== null;
}

/** World-space spawn point: cockpit centre, on the floor, set slightly aft of centre
 *  so the window fills the view ahead. The player capsule's centre sits at
 *  floor-top + halfHeight + radius. */
export function getShipSpawn(ctx: GameContext): THREE.Vector3 {
  const pb = ctx.player.body;
  return new THREE.Vector3(
    SHIP_ORIGIN.x,
    SHIP_ORIGIN.y + pb.halfHeight + pb.radius,
    SHIP_ORIGIN.z + 1.4,
  );
}

/** Build the greybox ship (mesh group + matched static colliders) at SHIP_ORIGIN.
 *  Idempotent — a second call while built is a no-op. */
export function buildShipScene(ctx: GameContext): void {
  if (shipGroup) return;
  const group = new THREE.Group();
  group.position.copy(SHIP_ORIGIN);

  for (const [spec, color] of SPECS) {
    const [w, h, d, cx, cy, cz] = spec;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ color }),
    );
    mesh.position.set(cx, cy, cz);
    group.add(mesh);
    // Matched static collider in WORLD space (SHIP_ORIGIN + local centre).
    const col = makeStaticBox(
      ctx.physics.world,
      { x: w / 2, y: h / 2, z: d / 2 },
      { x: SHIP_ORIGIN.x + cx, y: SHIP_ORIGIN.y + cy, z: SHIP_ORIGIN.z + cz },
    );
    const body = col.parent();
    if (body) shipBodies.push(body);
  }

  // The planet, seen through the front window — a flat unlit disc, ahead + below the
  // eye line so it reads as "the world you're falling toward". No collider (it's
  // outside the hull). Greybox stand-in; the real space backdrop is Phase 2/3.
  const planet = new THREE.Mesh(
    new THREE.CircleGeometry(6, 48),
    new THREE.MeshBasicMaterial({ color: C_PLANET }),
  );
  planet.position.set(0, -3.5, -16);   // local: down + well ahead of the window
  group.add(planet);

  ctx.three.scene.add(group);
  shipGroup = group;
}

/** Tear down the greybox ship (meshes + geometry + colliders). Called at the desert
 *  handoff (endEscapePodIntro) so the ship never lingers in the normal game. */
export function disposeShipScene(ctx: GameContext): void {
  if (shipGroup) {
    shipGroup.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    ctx.three.scene.remove(shipGroup);
    shipGroup = null;
  }
  for (const body of shipBodies) ctx.physics.world.removeRigidBody(body);
  shipBodies.length = 0;
}
