// Look-at + E interaction. One raycast against every interactable entity
// in the world (pickups, water sources, cacti, lizards, loot containers);
// dispatch to the right handler based on the userData.interactType tag the
// entity's spawn function attached.
//
// Each frame:
//   1. Reset hover flags on every entity registry.
//   2. Raycast 2.5m forward from the camera against the union mesh list.
//   3. Walk parent chain to find userData.interactType + interactId.
//   4. Set ctx.inventory.hover with type + promptNoun + distance.
//   5. On E press, dispatch by type.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { addItem } from '../inventory/inventory.ts';
import { despawnPickup, findPickupById } from '../pickups/pickups.ts';
import { findWaterSourceById } from '../world/waterSources.ts';
import { findCactusById, harvestCactus } from '../world/cactus.ts';
import { findLizardById, lootLizard } from '../enemies/lizard.ts';
import { lootSandWorm } from '../enemies/sandWorm.ts';
import { findLootContainerById } from '../world/lootContainers.ts';
import { findFireById, addFuel, relightFire } from '../world/fire.ts';
import { findTentById } from '../world/tent.ts';
import {
  findSalvageableById,
  markSalvageStripped,
  rollWreckLoot,
  shortNameFor,
} from '../world/salvage.ts';
import { getItemDef } from '../inventory/items.ts';
import {
  playPickup,
  playPour,
  playHarvest,
  playCookSizzle,
  playFireCrackle,
  playSalvage,
} from '../audio/audio.ts';
import { maybeShowEventHint } from '../ui/tutorial.ts';
import { showSalvageProgress, hideSalvageProgress } from '../ui/interactPrompt.ts';
import { openLootMenu, isLootMenuOpen } from '../ui/lootMenu.ts';
import { openSleepOverlay, isSleepOverlayOpen } from '../ui/sleepOverlay.ts';
import { isCraftingMenuOpen } from '../ui/craftingMenu.ts';
import { isInventoryOverlayOpen } from '../ui/inventoryOverlay.ts';
import { isControlsPanelOpen } from '../ui/tutorial.ts';
import { isJournalPanelOpen } from '../ui/journalPanel.ts';
import type { InteractType, ItemId, Slot } from '../inventory/types.ts';

const RAYCAST_DISTANCE = 2.5;
const _ray = new THREE.Raycaster();
const _dir = new THREE.Vector3();

interface InteractHit {
  type: InteractType;
  id: number;
  registry: 'pickups' | 'waterSources' | 'cacti' | 'lizards' | 'sandWorms' | 'lootContainers' | 'fires' | 'tents' | 'salvageables' | 'journals' | 'speeder';
  distance: number;
}

const SALVAGE_DURATION = 1.5;

// Map raw → cooked ItemIds (only items the player can actually cook here).
const COOK_MAP: Partial<Record<ItemId, ItemId>> = {
  'raw_lizard_meat': 'cooked_lizard_meat',
  'cactus_pulp': 'cooked_cactus_pulp',
  'raw_worm_meat': 'cooked_worm_meat',
  'lizard_on_a_stick_raw': 'lizard_on_a_stick_cooked',
};

// II — extended from 0.6s to give the cook animation time to read.
// Items define `playCookAnim` to drive their viewmodel during this window
// (see viewModel.ts step 5).
const COOK_DURATION = 3.5;

// Module-level cooking state — null when no cook in progress.
let _cooking: {
  slot: Slot;
  fromId: ItemId;
  toId: ItemId;
  fireId: number;
  completeAt: number;
} | null = null;

// Module-level salvage state — set when the player starts an E hold on a
// salvageable. Cleared on completion, on hover loss, or on player death.
let _salvaging: {
  salvageableId: number;
  startedAt: number;     // ctx.time.elapsed when started
  completeAt: number;
} | null = null;

function resolveInteractable(obj: THREE.Object3D): InteractHit | null {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    const t = cur.userData.interactType as InteractType | undefined;
    const id = cur.userData.interactId as number | undefined;
    const reg = cur.userData.interactRegistry as InteractHit['registry'] | undefined;
    if (t !== undefined && id !== undefined && reg !== undefined) {
      return { type: t, id, registry: reg, distance: 0 };
    }
    // Legacy pickup tagging
    const pickupId = cur.userData.pickupId as number | undefined;
    if (pickupId !== undefined) {
      return { type: 'take', id: pickupId, registry: 'pickups', distance: 0 };
    }
    cur = cur.parent;
  }
  return null;
}

export function updateInteraction(ctx: GameContext, _dt: number): void {
  // Reset hover flags on every registry each frame.
  for (const p of ctx.pickups.list) p.hovered = false;
  for (const w of ctx.waterSources.list) w.hovered = false;
  for (const c of ctx.cacti.list) c.hovered = false;
  for (const l of ctx.lizards) l.hovered = false;
  if (ctx.sandWorm) ctx.sandWorm.hovered = false;
  for (const f of ctx.fires.list) f.hovered = false;
  for (const t of ctx.tents.list) t.hovered = false;
  for (const s of ctx.salvageables.list) s.hovered = false;
  ctx.inventory.hover = null;

  // Drive any in-progress cooking forward.
  tickCooking(ctx);
  // Drive any in-progress salvage forward (cancelled later if hover drops).
  tickSalvage(ctx);

  if (!isPlaying(ctx)) {
    if (_salvaging) cancelSalvage();
    return;
  }
  // Overlay menus suppress interaction (pointer is unlocked anyway).
  if (isLootMenuOpen() || isSleepOverlayOpen() || isCraftingMenuOpen() || isInventoryOverlayOpen() || isControlsPanelOpen() || isJournalPanelOpen()) {
    if (_salvaging) cancelSalvage();
    return;
  }

  const cam = ctx.three.camera;
  cam.getWorldDirection(_dir);
  _ray.set(cam.position, _dir);
  _ray.far = RAYCAST_DISTANCE;

  // Union target list — only meshes we tagged as interactable.
  const targets: THREE.Object3D[] = [];
  for (const p of ctx.pickups.list) targets.push(p.mesh);
  for (const w of ctx.waterSources.list) targets.push(w.mesh);
  for (const c of ctx.cacti.list) if (!c.harvested) targets.push(c.mesh);
  for (const l of ctx.lizards) targets.push(l.mesh);
  // Sand worm — only target the corpse when visible (dead state). The
  // mesh stays in the scene throughout but is invisible while dormant,
  // and the live worm is taken via LMB (machete), not [E].
  if (ctx.sandWorm && ctx.sandWorm.mesh.visible && ctx.sandWorm.state === 'dead' && !ctx.sandWorm.looted) {
    targets.push(ctx.sandWorm.mesh);
  }
  for (const lc of ctx.lootContainers.list) targets.push(lc.mesh);
  // Both alive (cook/add_fuel) and dead (relight) fires are interactable.
  for (const f of ctx.fires.list) targets.push(f.mesh);
  for (const t of ctx.tents.list) targets.push(t.mesh);
  for (const s of ctx.salvageables.list) targets.push(s.panel);
  for (const j of ctx.journals.list) targets.push(j.mesh);
  // CC-3.1 — speeder seat is interactable when not already mounted; the
  // seat mesh is tagged with userData.interactType='mount' inside
  // makeSpeeder so resolveInteractable picks it up on raycast hit.
  if (ctx.speeder && !ctx.speeder.mounted) targets.push(ctx.speeder.seat);
  if (targets.length === 0) {
    if (_salvaging) cancelSalvage();
    return;
  }

  const hits = _ray.intersectObjects(targets, true);
  if (hits.length === 0) {
    if (_salvaging) cancelSalvage();
    return;
  }

  const hit = hits[0];
  const info = resolveInteractable(hit.object);
  if (!info) {
    if (_salvaging) cancelSalvage();
    return;
  }
  info.distance = hit.distance;
  // If we're salvaging but the hovered thing is no longer the same wreck, cancel.
  if (_salvaging && (info.registry !== 'salvageables' || info.id !== _salvaging.salvageableId)) {
    cancelSalvage();
  }

  // Dispatch to set hover state + prompt + handle E
  switch (info.registry) {
    case 'pickups': {
      const p = findPickupById(ctx.pickups.list, info.id);
      if (!p) return;
      p.hovered = true;
      const def = getItemDef(p.itemId);
      ctx.inventory.hover = {
        type: 'take',
        distance: info.distance,
        itemId: p.itemId,
        promptNoun: def.name.toLowerCase(),
      };
      if (ctx.input.pressed.has('KeyE')) {
        const slotIdx = addItem(ctx.inventory, p.itemId, p.meta, ctx);
        if (slotIdx < 0) {
          ctx.ui.showToast('your bag is full');
          return;
        }
        const where = slotIdx >= 100 ? 'stowed' : 'taken';
        ctx.ui.showToast(`${where} — ${def.description}`);
        playPickup();
        despawnPickup(ctx, p);
      }
      return;
    }

    case 'waterSources': {
      const w = findWaterSourceById(ctx.waterSources.list, info.id);
      if (!w) return;
      w.hovered = true;
      // Find a canteen slot the player can refill
      const slot = findRefillableCanteen(ctx);
      const noun = 'well';
      if (slot) {
        ctx.inventory.hover = { type: 'refill', distance: info.distance, promptNoun: noun };
        if (ctx.input.pressed.has('KeyE')) {
          if (!slot.meta) slot.meta = { fillLevel: 1 };
          slot.meta.fillLevel = 1;
          playPour();
          ctx.ui.showToast('canteen refilled');
        }
      } else {
        // No canteen — still show the water but with a different prompt
        ctx.inventory.hover = { type: 'refill', distance: info.distance, promptNoun: `${noun} (need canteen)` };
      }
      return;
    }

    case 'cacti': {
      const c = findCactusById(ctx.cacti.list, info.id);
      if (!c || c.harvested) return;
      c.hovered = true;
      const isAlien = c.kind === 'alien';
      ctx.inventory.hover = {
        type: 'harvest',
        distance: info.distance,
        promptNoun: isAlien ? 'alien cactus' : 'cactus',
      };
      if (ctx.input.pressed.has('KeyE')) {
        const got = 1 + Math.floor(Math.random() * 2); // 1-2 yields
        const yieldId: ItemId = isAlien ? 'alien_fruit' : 'cactus_pulp';
        let added = 0;
        for (let i = 0; i < got; i++) {
          if (addItem(ctx.inventory, yieldId, undefined, ctx) >= 0) added++;
        }
        if (added === 0) {
          ctx.ui.showToast('your bag is full');
          return;
        }
        harvestCactus(c, ctx.time.elapsed);
        playHarvest();
        if (isAlien) {
          ctx.ui.showToast(`you pluck ${added} alien fruit${added > 1 ? 's' : ''}`);
        } else {
          ctx.ui.showToast(`you carve out ${added} piece${added > 1 ? 's' : ''} of pulp`);
        }
      }
      return;
    }

    case 'lizards': {
      const l = findLizardById(ctx.lizards, info.id);
      if (!l) return;
      l.hovered = true;
      if (l.state === 'dead') {
        ctx.inventory.hover = { type: 'take', distance: info.distance, promptNoun: 'dead lizard', itemId: 'raw_lizard_meat' };
        if (ctx.input.pressed.has('KeyE')) {
          const slotIdx = addItem(ctx.inventory, 'raw_lizard_meat', undefined, ctx);
          if (slotIdx < 0) {
            ctx.ui.showToast('your bag is full');
            return;
          }
          ctx.ui.showToast('you cut the meat from the lizard');
          playPickup();
          lootLizard(l, ctx);
        }
      } else {
        // Living lizard — no prompt for "attack" since LMB handles it; show
        // a passive "lizard" prompt as flavor.
        ctx.inventory.hover = { type: 'kill', distance: info.distance, promptNoun: 'lizard' };
      }
      return;
    }

    case 'sandWorms': {
      const worm = ctx.sandWorm;
      if (!worm || worm.state !== 'dead' || worm.looted) return;
      worm.hovered = true;
      ctx.inventory.hover = {
        type: 'take',
        distance: info.distance,
        promptNoun: 'worm-flesh',
        itemId: 'raw_worm_meat',
      };
      if (ctx.input.pressed.has('KeyE')) {
        // Yield 2-3 slabs — it's a giant worm.
        const yieldN = 2 + Math.floor(Math.random() * 2);
        let added = 0;
        for (let i = 0; i < yieldN; i++) {
          if (addItem(ctx.inventory, 'raw_worm_meat', undefined, ctx) >= 0) added++;
        }
        if (added === 0) {
          ctx.ui.showToast('your bag is full');
          return;
        }
        playPickup();
        lootSandWorm(worm, ctx);
      }
      return;
    }

    case 'lootContainers': {
      const lc = findLootContainerById(ctx.lootContainers.list, info.id);
      if (!lc) return;
      const empty = lc.contents.length === 0;
      ctx.inventory.hover = {
        type: 'search',
        distance: info.distance,
        promptNoun: empty ? 'wreckage (empty)' : 'wreckage',
      };
      if (ctx.input.pressed.has('KeyE')) {
        if (empty) {
          ctx.ui.showToast('nothing left to find');
          return;
        }
        ctx.lootContainers.open = lc;
        openLootMenu(ctx, lc);
      }
      return;
    }

    case 'fires': {
      const f = findFireById(ctx.fires.list, info.id);
      if (!f) return;
      f.hovered = true;
      // Dead fire — show relight prompt (requires branch).
      if (!f.alive) {
        const selSlot = ctx.inventory.slots[ctx.inventory.selectedIdx];
        if (selSlot.item === 'branch') {
          ctx.inventory.hover = { type: 'relight', distance: info.distance, promptNoun: 'fire' };
          if (ctx.input.pressed.has('KeyE')) {
            if (relightFire(f, ctx)) {
              selSlot.count--;
              if (selSlot.count <= 0) {
                selSlot.item = null;
                selSlot.count = 0;
              }
              ctx.ui.showToast('the fire catches');
            }
          }
        } else {
          ctx.inventory.hover = { type: 'relight', distance: info.distance, promptNoun: 'fire (cold — need a branch)' };
        }
        return;
      }
      // Inspect equipped slot to decide what action this fire offers.
      const selSlot = ctx.inventory.slots[ctx.inventory.selectedIdx];
      const selItem = selSlot.item;
      if (selItem && COOK_MAP[selItem]) {
        // Raw food selected → cook prompt
        ctx.inventory.hover = { type: 'cook', distance: info.distance, promptNoun: 'fire' };
        if (ctx.input.pressed.has('KeyE') && !_cooking) {
          _cooking = {
            slot: selSlot,
            fromId: selItem,
            toId: COOK_MAP[selItem]!,
            fireId: f.id,
            completeAt: ctx.time.elapsed + COOK_DURATION,
          };
          // Seed cook progress on the slot so viewModel.ts can drive
          // the per-frame cook animation against it.
          if (!selSlot.meta) selSlot.meta = {};
          selSlot.meta.cookProgress = 0;
          playCookSizzle();
          ctx.ui.showToast('cooking...');
        }
      } else if (selItem === 'branch') {
        // Branch selected → add fuel prompt
        ctx.inventory.hover = { type: 'add_fuel', distance: info.distance, promptNoun: 'fire' };
        if (ctx.input.pressed.has('KeyE')) {
          addFuel(f);
          // Decrement the branch slot
          selSlot.count--;
          if (selSlot.count <= 0) {
            selSlot.item = null;
            selSlot.count = 0;
          }
          ctx.ui.showToast('fuel added');
        }
      } else {
        // No usable item — show passive prompt
        ctx.inventory.hover = { type: 'cook', distance: info.distance, promptNoun: 'fire (hold raw food)' };
      }
      return;
    }

    case 'tents': {
      const t = findTentById(ctx.tents.list, info.id);
      if (!t) return;
      t.hovered = true;
      ctx.inventory.hover = { type: 'sleep', distance: info.distance, promptNoun: 'tent' };
      if (ctx.input.pressed.has('KeyE')) {
        openSleepOverlay(ctx);
      }
      return;
    }

    case 'salvageables': {
      const s = findSalvageableById(ctx.salvageables.list, info.id);
      if (!s) return;
      s.hovered = true;
      const name = shortNameFor(s.kind);
      if (s.salvageRemaining <= 0) {
        ctx.inventory.hover = {
          type: 'salvage',
          distance: info.distance,
          promptNoun: `${name} (stripped)`,
          passive: true,
        };
        return;
      }
      ctx.inventory.hover = { type: 'salvage', distance: info.distance, promptNoun: name };
      if (ctx.input.pressed.has('KeyE') && !_salvaging) {
        _salvaging = {
          salvageableId: s.id,
          startedAt: ctx.time.elapsed,
          completeAt: ctx.time.elapsed + SALVAGE_DURATION,
        };
        playSalvage();
      }
      return;
    }

    case 'journals': {
      // Re-readable journal (Session W). E opens the modal lore panel.
      ctx.inventory.hover = { type: 'read', distance: info.distance, promptNoun: 'journal' };
      if (ctx.input.pressed.has('KeyE')) {
        void import('../ui/journalPanel.ts').then((m) => m.openJournalPanel(ctx));
      }
      return;
    }

    case 'speeder': {
      // CC-3.1 — looking at the speeder seat (and not mounted). Show
      // the "[E] mount speeder" prompt. The actual mount action is
      // handled by updateSpeeder earlier in the tick (which also
      // checks SPEEDER_MOUNT_RANGE), so we don't dispatch E here.
      ctx.inventory.hover = {
        type: 'mount',
        distance: info.distance,
        promptNoun: 'speeder',
      };
      return;
    }
  }
}

/** Per-frame cook timer. Completes when elapsed > completeAt; cancels if
 *  the player switches slots or the slot's item changes. */
function tickCooking(ctx: GameContext): void {
  if (!_cooking) return;
  const c = _cooking;
  // Cancel conditions
  const stillSelected = ctx.inventory.slots[ctx.inventory.selectedIdx] === c.slot;
  if (!stillSelected || c.slot.item !== c.fromId) {
    if (c.slot.meta) c.slot.meta.cookProgress = undefined;
    _cooking = null;
    return;
  }
  // Update cook progress on the slot so the viewmodel animation can read it.
  const remaining = c.completeAt - ctx.time.elapsed;
  const progress = Math.max(0, Math.min(1, 1 - remaining / COOK_DURATION));
  if (!c.slot.meta) c.slot.meta = {};
  c.slot.meta.cookProgress = progress;
  if (ctx.time.elapsed >= c.completeAt) {
    c.slot.item = c.toId;
    if (c.slot.meta) c.slot.meta.cookProgress = undefined;
    const def = getItemDef(c.toId);
    ctx.ui.showToast(`you cook the ${def.name.toLowerCase()}`);
    playFireCrackle();
    _cooking = null;
  }
}

function findRefillableCanteen(ctx: GameContext): import('../inventory/types.ts').Slot | null {
  for (const slot of ctx.inventory.slots) {
    if (slot.item === 'canteen' && (slot.meta?.fillLevel ?? 1) < 1) {
      return slot;
    }
  }
  return null;
}

/** Per-frame salvage timer. Drives the progress bar, completes on time-up,
 *  cancels if the target vanishes from the registry. */
function tickSalvage(ctx: GameContext): void {
  if (!_salvaging) return;
  const c = _salvaging;
  const s = findSalvageableById(ctx.salvageables.list, c.salvageableId);
  if (!s || s.salvageRemaining <= 0) {
    cancelSalvage();
    return;
  }
  const elapsed = ctx.time.elapsed - c.startedAt;
  const t01 = Math.min(1, elapsed / SALVAGE_DURATION);
  showSalvageProgress(t01);
  if (ctx.time.elapsed >= c.completeAt) {
    completeSalvage(ctx, s);
  }
}

function completeSalvage(ctx: GameContext, s: import('../world/salvage.ts').Salvageable): void {
  const loot = rollWreckLoot(s.kind, Math.random);
  const got: string[] = [];
  for (const entry of loot) {
    const n = entry.count ?? 1;
    let added = 0;
    for (let i = 0; i < n; i++) {
      const idx = addItem(ctx.inventory, entry.id, entry.meta, ctx);
      if (idx < 0) break;
      added++;
    }
    if (added > 0) {
      const def = getItemDef(entry.id);
      got.push(added > 1 ? `${added} ${def.name.toLowerCase()}` : def.name.toLowerCase());
    }
  }
  s.salvageRemaining--;
  if (got.length === 0) {
    ctx.ui.showToast('your bag is full');
  } else {
    ctx.ui.showToast(`salvaged: ${got.join(', ')}`);
  }
  playSalvage();
  if (s.salvageRemaining <= 0) {
    markSalvageStripped(s);
  }
  maybeShowEventHint(ctx, 'first_salvage', 'wrecks can be stripped — press E to salvage them');
  _salvaging = null;
  hideSalvageProgress();
}

function cancelSalvage(): void {
  if (!_salvaging) return;
  _salvaging = null;
  hideSalvageProgress();
}
