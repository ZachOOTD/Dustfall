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
  /** ACAA — the viewmodel lives in its OWN scene, rendered in a second
   *  depth-cleared pass (see core/loop.ts) so it (a) never clips through world
   *  walls AND (b) depth-sorts correctly within itself. The old single-scene
   *  approach disabled depthTest to avoid wall-clip, which broke self-sorting
   *  (the far side of rings/toruses drew over the near side → "see-through"). */
  scene: THREE.Scene;
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

/** Apply viewmodel material conventions. The viewmodel renders in its own
 *  depth-cleared pass (loop.ts), so depthTest STAYS ON — that's what makes the
 *  item self-sort correctly (closed shapes like grip-rings/toruses no longer
 *  show their far side through the near side). The depth clear before the pass
 *  is what prevents world walls from clipping the held item.
 *  Opaque materials write depth (so they occlude each other correctly);
 *  AUTHORED-transparent ones (flame / lens / glow) keep `transparent` + skip
 *  depth-write so they blend over the item rather than punching a hole.
 *  (The old single-scene path force-set transparent=false, which silently broke
 *  the torch flame fade — ACAA.) */
export function configureViewModelMaterial(mat: THREE.Material): void {
  mat.depthTest = true;
  mat.depthWrite = !mat.transparent;
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

export function createViewModel(_ctx: GameContext): ViewModel {
  // ACAA — dedicated scene for the depth-cleared second pass (loop.ts). The
  // held item no longer receives the WORLD lights, so this scene carries its
  // own: a soft ambient + a key/fill rig parented to `group` (camera-relative)
  // so the item is lit consistently as the player turns. Trade-off: the item
  // no longer dims at night — a readability win for the detailed meshes; the
  // torch flame is emissive so it still reads as the dominant light source.
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  group.name = 'viewmodel';
  scene.add(group);

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const key = new THREE.DirectionalLight(0xfff4e6, 1.7);
  key.position.set(0.6, 1.0, 0.8);
  key.target.position.set(0, -0.15, -0.35);
  group.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xbfd2ff, 0.45);
  fill.position.set(-0.8, 0.2, 0.6);
  fill.target.position.set(0, 0, -0.3);
  group.add(fill, fill.target);

  // FP viewmodel hands REMOVED (Session ACJ). ABP added forearm-wrap meshes
  // here for FP↔3P outfit continuity, but they're parented to the
  // camera-anchored `hands` group (not the real hand), so they read as
  // floating/oddly-rotated geometry in front of the camera rather than
  // wrapping the hand. Kept as an empty group so the visibility toggles in
  // swapEquippedMesh stay valid; repopulate only if/when FP hands are
  // rebuilt properly (camera-relative posing, not the rig wraps).
  const hands = new THREE.Group();
  hands.visible = false;
  group.add(hands);

  const itemRoot = new THREE.Group();
  itemRoot.name = 'viewmodel_item';
  group.add(itemRoot);

  const vm: ViewModel = {
    scene,
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

function swapEquippedMesh(vm: ViewModel, newId: ItemId | null, ctx: GameContext): void {
  // Clear current item meshes (FP viewmodel)
  while (vm.itemRoot.children.length > 0) {
    const c = vm.itemRoot.children[0];
    vm.itemRoot.remove(c);
    if ((c as THREE.Mesh).isMesh) {
      const mesh = c as THREE.Mesh;
      mesh.geometry?.dispose();
    }
  }
  vm.itemRoot.position.set(0, 0, 0);
  vm.itemRoot.rotation.set(0, 0, 0);
  vm.itemRoot.scale.set(1, 1, 1);

  // ABP Tier 4 — clear 3P hand-attach mesh as well. The rig's
  // rightHandAttach Group hosts a separate instance of the same
  // makeViewModel mesh; gets swapped in lockstep with the FP viewmodel.
  const rig = ctx.player.rig;
  if (rig) {
    while (rig.rightHandAttach.children.length > 0) {
      const c = rig.rightHandAttach.children[0];
      rig.rightHandAttach.remove(c);
      if ((c as THREE.Mesh).isMesh) {
        (c as THREE.Mesh).geometry?.dispose();
      }
    }
  }

  if (newId === null) {
    vm.hands.visible = false;
    vm.currentItem = null;
    return;
  }

  const def = getItemDef(newId);
  if (def.makeViewModel) {
    // FP instance — camera-relative, viewmodel material conventions
    const fpMesh = def.makeViewModel();
    configureViewModelObject(fpMesh);
    vm.itemRoot.add(fpMesh);

    // 3P instance — second copy of the same mesh attached to the rig's
    // right hand. NOT configured with viewmodel conventions (depthTest
    // stays on, renderOrder default, fog enabled, shadows cast) so it
    // reads as a real world-space item.
    if (rig) {
      const tpMesh = def.makeViewModel();
      // Walk the mesh + enable shadows (viewmodel meshes had them off)
      tpMesh.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      // ABY P3 — apply per-item 3P scale boost for visibility at distance.
      // FP viewmodel mesh (fpMesh) stays at original scale; only the 3P
      // hand-attach mesh is scaled.
      const tpScale = def.thirdPersonScale ?? 1.0;
      if (tpScale !== 1.0) {
        tpMesh.scale.multiplyScalar(tpScale);
      }
      // ACW Phase A — per-item 3P hand placement. Applied AFTER scale; pos
      // is in unscaled rightHandAttach-local meters, rot in radians (XYZ).
      // Default (no field) = mesh sits at the hand-attach origin unrotated
      // (legacy behavior).
      const hat = def.handAttachTransform;
      if (hat) {
        tpMesh.position.set(hat.pos[0], hat.pos[1], hat.pos[2]);
        tpMesh.rotation.set(hat.rot[0], hat.rot[1], hat.rot[2]);
      }
      rig.rightHandAttach.add(tpMesh);
    }
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
    swapEquippedMesh(vm, equippedId, ctx);
    // Don't fire equip sound on the very first observation.
    if (_lastEquippedId !== undefined && equippedId !== null) playEquip();
    _lastEquippedId = equippedId;
  }

  // ABP Tier 4 — dual-mesh visibility gate. FP viewmodel visible only
  // when 3P is OFF; 3P hand-attach mesh visible only when 3P is ON. The
  // F-key handler in input.ts also flips vm.group.visible directly, but
  // per-frame is the authoritative reset (handles save-load + initial boot).
  const tp = ctx.flags.thirdPerson;
  if (vm.group.visible !== (visible && !tp)) {
    vm.group.visible = visible && !tp;
  }
  if (ctx.player.rig) {
    ctx.player.rig.rightHandAttach.visible = tp;
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
