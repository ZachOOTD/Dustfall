// Session AAA — ghost preview for LMB-place kits. Originally scope-cut
// from UU; restored here so the LMB-click "thing will land where you
// point" feedback loop closes visually instead of only on toast.
//
// Implementation: a single reusable ring + vertical-marker mesh group,
// positioned each frame at the kit's deploy position (camera + forward
// × PLACEMENT_DISTANCE_M, Y projected to terrain). The ring is sized
// per kit type — small for fire_kit, larger for tents — communicating
// the footprint size to the player.
//
// Cheaper than cloning the world deploy visual (would need per-kit
// makePreview() exports + the deploy visuals carry physics + light
// nodes that don't belong in a preview). A simple ring is enough:
// players see WHERE + HOW BIG. The actual mesh materializes post-LMB.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { isLootMenuOpen } from '../ui/lootMenu.ts';
import { isSleepOverlayOpen } from '../ui/sleepOverlay.ts';
import { isCraftingMenuOpen } from '../ui/craftingMenu.ts';
import { isInventoryOverlayOpen } from '../ui/inventoryOverlay.ts';
import { isControlsPanelOpen } from '../ui/tutorial.ts';
import { isJournalPanelOpen } from '../ui/journalPanel.ts';
import { getItemDef } from '../inventory/items.ts';
import { placementGroundY } from '../world/placementGround.ts';
import type { ItemId } from '../inventory/types.ts';

interface GhostPreview {
  group: THREE.Group;
  ring: THREE.Mesh;
  marker: THREE.Mesh;
  currentKit: ItemId | null;
}

let _preview: GhostPreview | null = null;

// Per-kit preview footprint radius (meters). Loosely matches each
// kit's deploy footprint so the player can see "this thing this big
// will land here."
const KIT_PREVIEW_RADIUS: Partial<Record<ItemId, number>> = {
  fire_kit: 0.35,
  tent_kit: 1.0,           // small tent footprint
  large_tent_kit: 1.6,     // larger walk-in shelter
  sled_kit: 0.9,           // sled flatbed
  // Session AAD — AAC kits' preview radii (polish pass).
  bedroll_kit: 0.95,       // long axis of 1.6m pad → half-length ≈ 0.8, ring ≈ 0.95 to include pillow
  lantern_kit: 0.30,       // small footprint (just the base disc)
  locker_kit: 0.65,        // chest footprint ~1.0 × 0.6
};

function makePreviewMesh(): GhostPreview {
  const group = new THREE.Group();
  group.name = 'ghost-preview';
  group.visible = false;

  // Ground ring — RingGeometry on its side (XZ plane).
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xc8a868,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const ringGeo = new THREE.RingGeometry(0.8, 1.0, 32);
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;   // float just above ground to avoid z-fighting
  ring.renderOrder = 998;
  group.add(ring);

  // Vertical marker — small thin pole going up ~0.4m so the ring is
  // visible from a distance + at oblique angles. Same gold color.
  const markerMat = new THREE.MeshBasicMaterial({
    color: 0xc8a868,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const markerGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6);
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.position.y = 0.25;
  marker.renderOrder = 998;
  group.add(marker);

  return { group, ring, marker, currentKit: null };
}

export function createGhostPreview(ctx: GameContext): void {
  if (_preview) return;
  _preview = makePreviewMesh();
  ctx.three.scene.add(_preview.group);
}

function overlayOpen(): boolean {
  return isLootMenuOpen()
    || isSleepOverlayOpen()
    || isCraftingMenuOpen()
    || isInventoryOverlayOpen()
    || isControlsPanelOpen()
    || isJournalPanelOpen();
}

const _fwd = new THREE.Vector3();

export function updateGhostPreview(ctx: GameContext): void {
  if (!_preview) return;
  const g = _preview;

  // Hide when not gameplay-active or in overlay or mounted.
  if (!isPlaying(ctx) || overlayOpen() || ctx.speeder?.mounted) {
    if (g.group.visible) g.group.visible = false;
    return;
  }

  const slot = ctx.inventory.slots[ctx.inventory.selectedIdx];
  if (!slot.item) {
    if (g.group.visible) g.group.visible = false;
    return;
  }
  const def = getItemDef(slot.item);
  // Only show for wieldLmb='place' kits. signal_kit also uses 'place' (LMB fires it),
  // but it's launched SKYWARD — a ground footprint ring would mislead, so exempt it.
  if (def.wieldLmb !== 'place' || slot.item === 'signal_kit') {
    if (g.group.visible) g.group.visible = false;
    return;
  }

  // Rescale the ring if the wielded kit changed.
  if (g.currentKit !== slot.item) {
    const radius = KIT_PREVIEW_RADIUS[slot.item] ?? 0.8;
    // RingGeometry baked at radius 0.8-1.0; scale the mesh to match
    // (cheaper than rebuilding geometry per kit swap).
    g.ring.scale.set(radius, radius, radius);
    g.currentKit = slot.item;
  }

  // Compute the deploy position — same math as deployFire/deployTent/etc.
  // Camera-forward XZ × PLACEMENT_DISTANCE_M, Y from the SHARED placement sampler.
  const cam = ctx.three.camera;
  cam.getWorldDirection(_fwd);
  _fwd.y = 0;
  if (_fwd.lengthSq() < 1e-4) _fwd.set(0, 0, -1);
  _fwd.normalize();
  const x = cam.position.x + _fwd.x * Tuning.PLACEMENT_DISTANCE_M;
  const z = cam.position.z + _fwd.z * Tuning.PLACEMENT_DISTANCE_M;
  // DEEPER cycle 11 (G1) — was `ctx.terrain.heightAt(x, z)`, the SURFACE sampler. Underground that
  // put the ring tens of metres overhead inside solid rock, so the preview promised a landing spot
  // that the deploy then did not honour. Sharing `placementGroundY` with the deploy path is what
  // makes preview and outcome agree BY CONSTRUCTION rather than by two copies of the same formula.
  const y = placementGroundY(ctx, x, z);
  if (y === null) {
    // No ground under the aim point (a pit, a drop) — the honest preview is no ring at all rather
    // than a ring hovering over nothing. The lantern's deploy refuses for the same reason.
    if (g.group.visible) g.group.visible = false;
    return;
  }
  g.group.position.set(x, y, z);
  if (!g.group.visible) g.group.visible = true;
}
