// Escape-pod intro — the greybox ESCAPE POD interior (Phase 0 / T0.3).
// ─────────────────────────────────────────────────────────────────────────────
// A tight enclosed capsule the player rides during eject → ship-explode → descent.
// Built lazily when the intro reaches the pod, disposed at the desert handoff. Same
// blockout discipline as shipScene.ts (box meshes + matched static colliders, unlit
// MeshBasicMaterial, far offset), at its OWN offset above the ship so both can coexist
// briefly (you watch the ship explode from the pod). The HERO pod (industrial modular
// box, the chosen identity) is Phase 1; this is just the volume + the viewport.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../../GameContext.ts';
import { makeStaticBox } from '../../physics/bodies.ts';

/** The pod offset — above the ship (which is at y=3000) so you watch it blow up below. */
const POD_ORIGIN = new THREE.Vector3(0, 3200, 0);

// Greybox palette — warmer/darker than the ship so the pod reads as a different space.
const C_FLOOR = 0x40444b;
const C_WALL = 0x595e66;
const C_CEIL = 0x32363b;
const C_FRAME = 0x232529;
const C_SEAT = 0x4d5258;
const C_PLANET = 0xc98a5a;

type BoxSpec = [number, number, number, number, number, number];

// A tight capsule: ~2.6w (x −1.3..1.3) × 2.2h (y 0..2.2) × 2.8d (z −1.4..1.4). The
// VIEWPORT is in the −Z wall (the camera faces −Z when seated → looks straight out).
const SPECS: ReadonlyArray<readonly [BoxSpec, number]> = [
  [[2.6, 0.2, 2.8, 0, -0.1, 0], C_FLOOR],     // floor (top at y=0)
  [[2.6, 0.2, 2.8, 0, 2.3, 0], C_CEIL],       // ceiling
  [[0.2, 2.2, 2.8, 1.3, 1.1, 0], C_WALL],     // +X wall
  [[0.2, 2.2, 2.8, -1.3, 1.1, 0], C_WALL],    // −X wall
  [[2.6, 2.2, 0.2, 0, 1.1, 1.4], C_WALL],     // back (+Z) wall
  // Front (−Z) viewport wall, around a 1.6w × 1.2h gap (x −0.8..0.8, y 0.7..1.9):
  [[2.6, 0.7, 0.2, 0, 0.35, -1.4], C_FRAME],  // below viewport
  [[2.6, 0.3, 0.2, 0, 2.05, -1.4], C_FRAME],  // above viewport
  [[0.5, 1.2, 0.2, -1.05, 1.3, -1.4], C_FRAME], // left of viewport
  [[0.5, 1.2, 0.2, 1.05, 1.3, -1.4], C_FRAME],  // right of viewport
  // A blocky seat the player rides in (greybox flavour; no collider needed but cheap).
  [[0.8, 0.5, 0.7, 0, 0.25, 0.5], C_SEAT],
];

let podGroup: THREE.Group | null = null;
const podBodies: RAPIER.RigidBody[] = [];

/** Is the greybox pod currently built? */
export function podBuilt(): boolean {
  return podGroup !== null;
}

/** World-space seated spawn: pod centre, on the floor, slightly aft so the viewport
 *  fills the view ahead. Capsule centre = floor-top + halfHeight + radius. */
export function getPodSpawn(ctx: GameContext): THREE.Vector3 {
  const pb = ctx.player.body;
  return new THREE.Vector3(
    POD_ORIGIN.x,
    POD_ORIGIN.y + pb.halfHeight + pb.radius,
    POD_ORIGIN.z + 0.45,
  );
}

/** Build the greybox pod (mesh group + matched static colliders) at POD_ORIGIN.
 *  Idempotent. */
export function buildPodScene(ctx: GameContext): void {
  if (podGroup) return;
  const group = new THREE.Group();
  group.position.copy(POD_ORIGIN);

  for (const [spec, color] of SPECS) {
    const [w, h, d, cx, cy, cz] = spec;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ color }),
    );
    mesh.position.set(cx, cy, cz);
    group.add(mesh);
    const col = makeStaticBox(
      ctx.physics.world,
      { x: w / 2, y: h / 2, z: d / 2 },
      { x: POD_ORIGIN.x + cx, y: POD_ORIGIN.y + cy, z: POD_ORIGIN.z + cz },
    );
    const body = col.parent();
    if (body) podBodies.push(body);
  }

  // The planet, seen through the viewport — a flat unlit disc, ahead + below. During the
  // descent (T0.3b) it grows; here it's a static stand-in.
  const planet = new THREE.Mesh(
    new THREE.CircleGeometry(5, 48),
    new THREE.MeshBasicMaterial({ color: C_PLANET }),
  );
  planet.position.set(0, -2.5, -12);
  group.add(planet);

  ctx.three.scene.add(group);
  podGroup = group;
}

/** Tear down the greybox pod (meshes + geometry + colliders). */
export function disposePodScene(ctx: GameContext): void {
  if (podGroup) {
    podGroup.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    ctx.three.scene.remove(podGroup);
    podGroup = null;
  }
  for (const body of podBodies) ctx.physics.world.removeRigidBody(body);
  podBodies.length = 0;
}
