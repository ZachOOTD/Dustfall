// Look-at + E to pick up. Replaces the old proximity-pickup loop.
//
// Each frame: raycast 2.5m forward from the camera against the pickup-mesh
// list only (NOT the entire scene — that would ray-test against every rock).
// The first hit becomes the hover target. E consumes it into the inventory.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { addItem } from '../inventory/inventory.ts';
import { despawnPickup, findPickupById, type Pickup } from '../pickups/pickups.ts';
import { getItemDef } from '../inventory/items.ts';
import { playPickup } from '../audio/audio.ts';

const RAYCAST_DISTANCE = 2.5;
const _ray = new THREE.Raycaster();
const _dir = new THREE.Vector3();

export function updateInteraction(ctx: GameContext, _dt: number): void {
  // Always reset hover so a missed frame clears the prompt.
  for (const p of ctx.pickups.list) p.hovered = false;
  ctx.inventory.hover = null;
  if (!isPlaying(ctx)) return;
  if (ctx.pickups.list.length === 0) return;

  const cam = ctx.three.camera;
  cam.getWorldDirection(_dir);
  _ray.set(cam.position, _dir);
  _ray.far = RAYCAST_DISTANCE;

  // Targets: only pickup root meshes (recursive=true catches sub-meshes).
  const targets = ctx.pickups.list.map((p) => p.mesh);
  const hits = _ray.intersectObjects(targets, true);
  if (hits.length === 0) return;

  const hit = hits[0];
  const pickup = resolvePickupFromHit(hit.object, ctx.pickups.list);
  if (!pickup) return;

  pickup.hovered = true;
  ctx.inventory.hover = {
    itemId: pickup.itemId,
    distance: hit.distance,
  };

  // E takes
  if (ctx.input.pressed.has('KeyE')) {
    tryTake(ctx, pickup);
  }
}

function resolvePickupFromHit(
  obj: THREE.Object3D,
  list: Pickup[],
): Pickup | null {
  // Walk up the parent chain looking for a userData.pickupId tag.
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    const id = cur.userData.pickupId as number | undefined;
    const p = findPickupById(list, id);
    if (p) return p;
    cur = cur.parent;
  }
  return null;
}

function tryTake(ctx: GameContext, pickup: Pickup): void {
  const slotIdx = addItem(ctx.inventory, pickup.itemId);
  if (slotIdx < 0) {
    ctx.ui.showToast('your bag is full');
    return;
  }
  const def = getItemDef(pickup.itemId);
  ctx.ui.showToast(`taken — ${def.description}`);
  playPickup();
  despawnPickup(ctx, pickup);
}
