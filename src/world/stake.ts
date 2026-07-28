// Session ACE B1 Phase 3 — craftable world-anchor stake.
//
// A short iron stake the player drives into the sand. Tetherable from the
// rope: RMB-on-stake with rope wielded ties one end of the rope here.
// Persistent across save/load. Functionally a craftable + persistent
// upgrade of the ACA `static-pos` tether kind, which used the player's
// foot XZ at the moment they dropped the rope.
//
// Architecture: mirrors bedroll.ts / lantern.ts shape (registry list,
// _nextId allocator, deploy + spawnAt + setNextStakeId + findById).
// No shelter zone; no per-frame tick. Stakes just sit in the world.
//
// Visual (D107 zero-asset — no GLB, no textures): a short iron post
// driven into the sand with a rope-loop at the top. Built from primitive
// geometry + the procedural metalMaterial shader (ABH vocabulary).

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { placementGroundYOrFeet } from './placementGround.ts';
import { createMetalMaterial } from './metalMaterial.ts';
import { addItem } from '../inventory/inventory.ts';

export interface Stake {
  id: number;
  mesh: THREE.Group;
  pos: THREE.Vector3;
  rotationY: number;
  hovered: boolean;
}

let _nextId = 1;

function tag(root: THREE.Object3D, id: number): void {
  root.traverse((o) => {
    o.userData.interactType = 'attach_rope';
    o.userData.interactId = id;
    o.userData.interactRegistry = 'stakes';
  });
}

// Shared materials — instantiated once, reused across every stake spawn.
// Static surface (the stake doesn't move once placed) so default world-
// space sampling is fine (no localSpace needed per D109).
//
// ACE Round-2 polish: shaft color lightened from 0x4a4038 → 0x5e5048
// (warmer iron undertone reads against sand silhouette at distance);
// scratch strength bumped so wear catches more light.
const _ironMat = createMetalMaterial(0x5e5048, {
  wornScale: 12.0,
  scratchStrength: 0.45,
  rustLevel: 0.58,   // ACAD — iron driven into sand corrodes heavily
});


/** Build the stake visual. Origin sits at GROUND LEVEL — the body
 *  protrudes upward and the pointed tip extends downward into the sand.
 *  Caller positions `group.position.y = terrainHeight`. */
function makeStakeVisual(): THREE.Group {
  const g = new THREE.Group();

  // ACE Round-2: stake taller + thicker so it reads at typical 3-5m
  // playtest distances. Knee-height (~50cm above ground) was too small
  // to register against the sand.
  const shaftH = 0.85;            // was 0.70
  const shaftR_top = 0.032;       // was 0.022 — chunkier silhouette
  const shaftR_bot = 0.026;       // was 0.018
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(shaftR_top, shaftR_bot, shaftH, 12),
    _ironMat,
  );
  shaft.position.y = shaftH / 2 - 0.20;  // 20cm in sand, 65cm above
  g.add(shaft);

  // Flared driven cap at the top — the mushroomed-over end where a
  // hammer struck it. Bumped wider in Round 2 for visibility; Round 3
  // adds a slightly darker, more weathered material so it reads as
  // "this end was hammered repeatedly" (gunmetal vs the shaft's iron).
  const capMat = createMetalMaterial(0x4a3f38, {
    wornScale: 9.0,
    scratchStrength: 0.55,
    rustLevel: 0.6,   // ACAD — hammered end, heavily corroded
  });
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.040, 0.030, 14),
    capMat,
  );
  cap.position.y = shaftH / 2 - 0.20 + shaftH / 2 - 0.005;
  g.add(cap);

  // Rope-loop torus — large enough that the rope visibly fits through.
  // Welded to the side of the shaft just below the cap. Vertical orient
  // so the rope can pass through naturally when pulled taut in any
  // horizontal direction. Bumped major + minor radii in Round 2 so the
  // loop reads at distance.
  const loopMat = createMetalMaterial(0x3a3028, {
    wornScale: 18.0,
    scratchStrength: 0.30,
    rustLevel: 0.55,   // ACAD
  });
  const loop = new THREE.Mesh(
    new THREE.TorusGeometry(0.058, 0.012, 6, 16),
    loopMat,
  );
  // ACQ — seat the loop near the TOP, just under the cap, and bring it in
  // so its tube touches the shaft (was X=0.072 → a 4cm floating gap; now
  // ~0.044 so the −X tube edge meets the shaft +X surface at radius 0.032).
  // Offset shared with rope.ts resolveEndpointWorldPos via Tuning so the rope
  // connects to the actual ring (rule 2: magic numbers → tuning.ts).
  loop.position.set(Tuning.STAKE_LOOP_OFFSET_X, Tuning.STAKE_LOOP_OFFSET_Y, 0);
  loop.rotation.y = Math.PI / 2;
  g.add(loop);

  // ACQ — sand-disturbance mound REMOVED (read as a manufactured disc/dome
  // at the base rather than displaced sand; cleaner without it).

  // Pointed tip — angled cone below the buried portion. Cosmetic only
  // (lives below the visible surface), but if the stake is placed on a
  // sloped surface the tip reads correctly when partially exposed.
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.026, 0.12, 8),
    _ironMat,
  );
  tip.position.y = -0.28;
  tip.rotation.x = Math.PI;  // point down
  g.add(tip);

  return g;
}

/** Deploy a stake at the placement distance in front of the player.
 *  Returns null if too close to an existing stake. Mirrors deployBedroll. */
export function deployStake(ctx: GameContext): Stake | null {
  const cam = ctx.three.camera;
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  dir.y = 0;
  if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
  dir.normalize();
  const pos = new THREE.Vector3()
    .copy(cam.position)
    .addScaledVector(dir, Tuning.PLACEMENT_DISTANCE_M);
  pos.y = placementGroundYOrFeet(ctx, pos.x, pos.z);   // DEEPER cycle 11 (G1) — the live-collider floor, so this works underground

  for (const existing of ctx.stakes.list) {
    if (existing.pos.distanceToSquared(pos) < Tuning.STAKE_NEAR_DISTANCE_SQ) {
      return null;
    }
  }

  const rotationY = Math.atan2(dir.x, dir.z);  // not load-bearing — stake is rotationally symmetric
  return spawnStakeAt(ctx, pos, rotationY);
}

/** Materialize a stake. Used by deployStake (player action) + save/load
 *  (with saved pose). */
export function spawnStakeAt(
  ctx: GameContext,
  pos: THREE.Vector3,
  rotationY: number,
  idOverride?: number,
): Stake {
  const mesh = makeStakeVisual();
  mesh.position.copy(pos);
  mesh.rotation.y = rotationY;
  mesh.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  ctx.three.scene.add(mesh);

  const id = idOverride !== undefined ? idOverride : _nextId++;
  if (idOverride !== undefined) setNextStakeId(idOverride);
  tag(mesh, id);

  const stake: Stake = {
    id,
    mesh,
    pos: pos.clone(),
    rotationY,
    hovered: false,
  };
  ctx.stakes.list.push(stake);
  return stake;
}

/** Bump the module-level id counter past `n` so save/load restored stakes
 *  don't collide with new ones. Mirrors setNextSledId/setNextBedrollId. */
export function setNextStakeId(n: number): void {
  if (n >= _nextId) _nextId = n + 1;
}

export function findStakeById(list: Stake[], id: number | undefined): Stake | undefined {
  if (id === undefined) return undefined;
  return list.find((s) => s.id === id);
}

/** Pull the stake from the ground. Atomic: tries addItem first; if full,
 *  refuses + the stake stays placed. Mirrors packUpBedroll.
 *  Auto-detaches any sled rope currently tethered to this stake. */
export function packUpStake(ctx: GameContext, stake: Stake): boolean {
  // Refuse if anything is currently tethered to this stake (would be
  // confusing to silently sever a tow line). Caller can detach first.
  for (const sled of ctx.sleds.list) {
    if (sled.tether.kind === 'stake' && sled.tether.stakeId === stake.id) {
      ctx.ui.showToast('untie the rope first');
      return false;
    }
  }
  const slotIdx = addItem(ctx.inventory, 'stake_kit', undefined, ctx);
  if (slotIdx < 0) {
    ctx.ui.showToast('no room in your bag');
    return false;
  }
  ctx.three.scene.remove(stake.mesh);
  const i = ctx.stakes.list.indexOf(stake);
  if (i >= 0) ctx.stakes.list.splice(i, 1);
  ctx.ui.showToast('stake pulled up');
  return true;
}
