// First-person viewmodel — a small Group tracking the camera each frame,
// holding two stylized "hands" + the currently-equipped item mesh. Items
// supply their own meshes + use animations via `ItemDef.makeViewModel` /
// `playUseAnim`. Renders on top of world geometry (depthTest off + high
// renderOrder) so walls can't clip through the hand.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import type { ItemId } from '../inventory/types.ts';
import { Tuning } from '../config/tuning.ts';
import { getItemDef } from '../inventory/items.ts';
import { playInventorySelect, playEquip } from '../audio/audio.ts';

export interface ViewModel {
  group: THREE.Group;
  hands: THREE.Group;
  itemRoot: THREE.Group;
  currentItem: ItemId | null;
  anim: {
    active: boolean;
    startTime: number;
    itemId: ItemId | null;
    duration: number;
  };
  triggerUse: () => void;
}

// Module-level observer state (compared on each updateViewModel call).
let _lastSelectedIdx = -1;
// `undefined` = boot state; first selection won't fire playEquip.
let _lastEquippedId: ItemId | null | undefined = undefined;

// Session Q — idle breath phase accumulator (advances by wall time).
let _breathPhase = 0;

// Reusable scratch vectors so we don't allocate every frame.
const _offset = new THREE.Vector3();

/** Apply viewmodel material conventions: always draw on top + no fog. */
export function configureViewModelMaterial(mat: THREE.Material): void {
  mat.depthTest = false;
  mat.depthWrite = false;
  mat.transparent = false;
  // `fog` exists on most material types we use; guard for the type narrowing.
  if ('fog' in mat) (mat as unknown as { fog: boolean }).fog = false;
}

/** Walk a mesh tree and apply viewmodel material conventions + renderOrder. */
export function configureViewModelObject(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.renderOrder = 999;
      m.castShadow = false;
      m.receiveShadow = false;
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach(configureViewModelMaterial);
      else configureViewModelMaterial(mat);
    }
  });
}

export function createViewModel(ctx: GameContext): ViewModel {
  const group = new THREE.Group();
  group.name = 'viewmodel';
  ctx.three.scene.add(group);

  // Hands group kept for future rigged-hand work (Session Q2). For now it's
  // empty — the held item alone reads cleanly. The visibility toggle in
  // swapEquippedMesh still flips this group so re-enabling later is trivial.
  const hands = new THREE.Group();
  hands.visible = false;
  group.add(hands);

  const itemRoot = new THREE.Group();
  itemRoot.name = 'viewmodel_item';
  group.add(itemRoot);

  const vm: ViewModel = {
    group,
    hands,
    itemRoot,
    currentItem: null,
    anim: { active: false, startTime: 0, itemId: null, duration: 0 },
    triggerUse() {
      if (vm.currentItem === null) return;
      const def = getItemDef(vm.currentItem);
      const duration = def.useAnimDuration ?? 0;
      if (duration <= 0 || !def.playUseAnim) return;
      vm.anim.active = true;
      vm.anim.startTime = performance.now() / 1000;
      vm.anim.itemId = vm.currentItem;
      vm.anim.duration = duration;
    },
  };

  return vm;
}

function swapEquippedMesh(vm: ViewModel, newId: ItemId | null): void {
  // Clear current item meshes
  while (vm.itemRoot.children.length > 0) {
    const c = vm.itemRoot.children[0];
    vm.itemRoot.remove(c);
    if ((c as THREE.Mesh).isMesh) {
      const mesh = c as THREE.Mesh;
      mesh.geometry?.dispose();
      // Material may be shared — don't dispose here. Each makeViewModel
      // creates fresh materials, so disposing would be safe; skipping is
      // also safe and avoids accidental shared-material disposal later.
    }
  }
  vm.itemRoot.position.set(0, 0, 0);
  vm.itemRoot.rotation.set(0, 0, 0);
  vm.itemRoot.scale.set(1, 1, 1);

  if (newId === null) {
    vm.hands.visible = false;
    vm.currentItem = null;
    return;
  }

  const def = getItemDef(newId);
  if (def.makeViewModel) {
    const mesh = def.makeViewModel();
    configureViewModelObject(mesh);
    vm.itemRoot.add(mesh);
  }
  vm.hands.visible = true;
  vm.currentItem = newId;
}

export function updateViewModel(ctx: GameContext, dt: number): void {
  const vm = ctx.player.viewModel;
  if (!vm) return;

  // 1. Track camera pose. Position = camera + offset*cameraQuat.
  const cam = ctx.three.camera;
  vm.group.quaternion.copy(cam.quaternion);
  _offset.set(
    Tuning.VIEWMODEL_OFFSET_X,
    Tuning.VIEWMODEL_OFFSET_Y,
    Tuning.VIEWMODEL_OFFSET_Z,
  );
  _offset.applyQuaternion(cam.quaternion);
  vm.group.position.copy(cam.position).add(_offset);

  // 1b. Idle breath (Session Q). Slow vertical sine on the viewmodel Y so
  // the held item gently rises and falls when the player is still. (Walking
  // bob was tried and removed — read too fast on a first-person camera.)
  _breathPhase += Tuning.BREATH_FREQUENCY * dt;
  vm.group.position.y += Tuning.BREATH_AMPLITUDE * Math.sin(_breathPhase * Math.PI * 2);

  // Hide entirely when not in game (start overlay or dead).
  const visible = ctx.flags.started && !ctx.stats.dead;
  if (vm.group.visible !== visible) vm.group.visible = visible;

  // 2. Observe inventory selection change.
  const inv = ctx.inventory;
  if (inv.selectedIdx !== _lastSelectedIdx) {
    // Don't fire on the very first observation (boot).
    if (_lastSelectedIdx !== -1) playInventorySelect();
    _lastSelectedIdx = inv.selectedIdx;
  }

  // 3. Observe equipped-item change.
  const equippedId = inv.slots[inv.selectedIdx]?.item ?? null;
  if (equippedId !== vm.currentItem) {
    swapEquippedMesh(vm, equippedId);
    // Don't fire equip sound on the very first observation.
    if (_lastEquippedId !== undefined && equippedId !== null) playEquip();
    _lastEquippedId = equippedId;
  }

  // 4. Per-frame hook for held items (torch/flashlight react to slot.meta).
  const heldSlot = inv.slots[inv.selectedIdx];
  if (heldSlot.item !== null) {
    const def = getItemDef(heldSlot.item);
    if (def.updateHeld) def.updateHeld(vm.itemRoot, heldSlot, ctx, dt);
  }

  // 4b. Cook animation (Session II). When the player is cooking the
  // held item over a fire, interaction.ts writes a 0..1 progress value
  // to slot.meta.cookProgress. Drive the item's playCookAnim against it.
  // Skipped when a use-anim is active to avoid pose fights.
  if (heldSlot.item !== null && !vm.anim.active) {
    const def = getItemDef(heldSlot.item);
    const progress = heldSlot.meta?.cookProgress;
    if (def.playCookAnim && progress !== undefined && progress > 0 && progress < 1) {
      vm.itemRoot.position.set(0, 0, 0);
      vm.itemRoot.rotation.set(0, 0, 0);
      def.playCookAnim(vm.itemRoot, progress);
    }
  }

  // 5. Drive active animation.
  if (vm.anim.active) {
    const now = performance.now() / 1000;
    const t = (now - vm.anim.startTime) / vm.anim.duration;
    if (t >= 1) {
      vm.anim.active = false;
      // Reset pose
      vm.itemRoot.position.set(0, 0, 0);
      vm.itemRoot.rotation.set(0, 0, 0);
    } else if (vm.anim.itemId !== null) {
      const def = getItemDef(vm.anim.itemId);
      if (def.playUseAnim) {
        // Reset before applying so animations can be additive from identity.
        vm.itemRoot.position.set(0, 0, 0);
        vm.itemRoot.rotation.set(0, 0, 0);
        def.playUseAnim(vm.itemRoot, t);
      }
    }
  }
}
