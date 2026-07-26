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
import { addItem, countItems } from '../inventory/inventory.ts';
import { despawnPickup, findPickupById, spawnDroppedPickup, getPickupInstancedMeshes } from '../pickups/pickups.ts';
import { findWaterSourceById } from '../world/waterSources.ts';
import { findCactusById, harvestCactus } from '../world/cactus.ts';
import { findLizardById, lootLizard } from '../enemies/lizard.ts';
import { spawnCompanionAt } from '../enemies/companion.ts';   // M8 ⑩ (C52) — egg hatch
import { findShrewById, lootShrew } from '../enemies/shrew.ts';
import { findVultureById, lootVulture } from '../enemies/vulture.ts';  // ACAH
import { lootSandWorm } from '../enemies/sandWorm.ts';
import { findLootContainerById } from '../world/lootContainers.ts';
import { findFireById, addFuel, relightFire, attachGrillToFire } from '../world/fire.ts';
import { findTentById } from '../world/tent.ts';
import { findLargeTentById, toggleLargeTentDoor } from '../world/largeTent.ts';
import { findBedrollById } from '../world/bedroll.ts';
import { findLockerById } from '../world/locker.ts';
import { findSledById, attachRopeToSled, detachRope, attachLockerToSled, applyTether } from '../world/sled.ts';
import { findStakeById } from '../world/stake.ts';
import { popPanelDoor } from '../world/panelDebris.ts';   // ACAX — door pop-off physics
import type { RopeEndpoint } from '../world/rope.ts';
import { claimLight, releaseLight } from '../core/lightPool.ts';
import {
  findSalvageableById,
  markSalvageStripped,
  rollWreckLoot,
  shortNameFor,
  conditionAdjective,
  type SalvageCondition,
} from '../world/salvage.ts';
import {
  COMPONENT_LOOT,
  COMPONENT_LOOT_CORRODED,
  COMPONENT_LOOT_PRISTINE_BONUS,
} from '../config/lootRegistry.ts';
import { getItemDef } from '../inventory/items.ts';
import {
  playPickup,
  playPour,
  playJerrycanFill,
  playHarvest,
  playCookSizzle,
  playFireCrackle,
  playPryCreak,
  playComponentExtract,
} from '../audio/audio.ts';
import { maybeShowEventHint } from '../ui/tutorial.ts';
import { showSalvageProgress, hideSalvageProgress, showCookProgresses, hideCookProgresses } from '../ui/interactPrompt.ts';
import { openLootMenu, isLootMenuOpen } from '../ui/lootMenu.ts';
import { openSleepOverlay, isSleepOverlayOpen } from '../ui/sleepOverlay.ts';
import { isCraftingMenuOpen } from '../ui/craftingMenu.ts';
import { isInventoryOverlayOpen } from '../ui/inventoryOverlay.ts';
import { isControlsPanelOpen } from '../ui/tutorial.ts';
import { isJournalPanelOpen } from '../ui/journalPanel.ts';
import { findJournalById, type JournalKind } from '../world/journal.ts';   // ACBE (D1) — crash black-box per-instance content
import type { InteractType, ItemId, Slot } from '../inventory/types.ts';
import { Tuning } from '../config/tuning.ts';
import { FEATURES } from '../config/features.ts';   // Deep-Desert cycle 5 (D257) — rideableSled prompt gate

const RAYCAST_DISTANCE = 2.5;
const _ray = new THREE.Raycaster();
const _dir = new THREE.Vector3();
const _rayFrom = new THREE.Vector3();

// ACW F (#149) — world position of the current frame's interactable hit (the
// raycast's closest hit point). The 3P interact-prompt projects this to screen
// so the prompt sits ON the hovered object instead of at crosshair-center
// (which reads detached in 3P, where the object is off the screen center).
// Transient; null when nothing is hovered. interactPrompt.ts reads via the getter.
const _hoverWorldPos = new THREE.Vector3();
let _hoverWorldValid = false;
export function getHoverWorldPos(): THREE.Vector3 | null {
  return _hoverWorldValid ? _hoverWorldPos : null;
}

interface InteractHit {
  type: InteractType;
  id: number;
  registry: 'pickups' | 'waterSources' | 'cacti' | 'lizards' | 'shrews' | 'vultures' | 'sandWorms' | 'lootContainers' | 'fires' | 'tents' | 'largeTents' | 'bedrolls' | 'lanterns' | 'lockers' | 'salvageables' | 'journals' | 'speeder' | 'sleds' | 'companion' | 'stakes' | 'raiders' | 'eggs' | 'caveFungi';
  distance: number;
  /** AAZ — optional sub-mesh discriminator. When the hit object's
   *  userData.interactSubKind is set, it's captured here so case handlers
   *  can branch within the same registry — e.g. large-tent door vs body. */
  subKind?: string;
}

const SALVAGE_DURATION = 1.5;        // legacy fallback; AAR pry uses Tuning.SALVAGE_PANEL_PRY_DURATION_S

// Map raw → cooked ItemIds (only items the player can actually cook here).
const COOK_MAP: Partial<Record<ItemId, ItemId>> = {
  'raw_lizard_meat': 'cooked_lizard_meat',
  'raw_shrew_meat': 'cooked_shrew_meat',
  'raw_vulture_meat': 'cooked_vulture_meat',
  // Scavenger's Economy (build 2) — cactus_pulp cook mapping removed (it is
  // unobtainable: only ALIEN cacti spawn since CC-4 → alien_fruit).
  'raw_worm_meat': 'cooked_worm_meat',
  'lizard_on_a_stick_raw': 'lizard_on_a_stick_cooked',
};

// II — extended from 0.6s to give the cook animation time to read.
// Items define `playCookAnim` to drive their viewmodel during this window
// (see viewModel.ts step 5).
const COOK_DURATION = 3.5;

// AAM — cooking state is now a LIST so a grilled fire can run multiple
// parallel cooks. Pre-AAM was a single `_cooking` singleton (one cook
// in the world). Each entry tracks its own slot + fire + completion.
// Cancel condition: slot.item changes (item consumed / swapped out) —
// slot-switch no longer cancels because that was a single-cook UX
// limitation that the grill UX needs to bypass.
interface CookState {
  slot: Slot;
  fromId: ItemId;
  toId: ItemId;
  fireId: number;
  completeAt: number;
}
const _cooks: CookState[] = [];

/** AAR — is the player currently prying a salvage panel? sandWorm reads
 *  this to amplify detection radius during a pry (loud metal scraping
 *  attracts the worm). Multiplier lives in Tuning.SALVAGE_NOISE_MULTIPLIER_DURING_PRY. */
export function isPryingActive(): boolean {
  return _salvaging?.mode === 'pry';
}

// Module-level salvage state — set when the player starts an E hold on a
// salvageable. AAR — modal: 'pry' (open the door, requires scrap_bar)
// vs no in-progress timer for 'extract' (extracts are instant per-press).
// Cleared on completion, on hover loss, or on player death.
let _salvaging: {
  salvageableId: number;
  startedAt: number;     // ctx.time.elapsed when started
  completeAt: number;
  mode: 'pry';           // AAR — extracts are instant, no held timer
} | null = null;

// AAG — pickup-swap-on-hold-E state. Started when player presses E on a
// pickup but bag is full (and selected slot is non-empty). After
// Tuning.PICKUP_SWAP_DURATION_S of held-E, the selected slot is dropped
// at the player's feet and the pickup goes into that slot. Cancels on E
// release, hover loss, slot change, or player death.
// (AAH: PICKUP_SWAP_DURATION constant lifted to Tuning.)
let _pickupSwap: {
  pickupId: number;
  startedAt: number;
  completeAt: number;
} | null = null;

function resolveInteractable(obj: THREE.Object3D): InteractHit | null {
  let cur: THREE.Object3D | null = obj;
  // AAZ — track sub-kind on the way up so a sub-mesh's discriminator wins
  // over the parent's defaults. The first non-undefined subKind we see
  // along the walk-up belongs to the leaf-most marker.
  let subKind: string | undefined;
  while (cur) {
    if (subKind === undefined) {
      const sk = cur.userData.interactSubKind as string | undefined;
      if (sk !== undefined) subKind = sk;
    }
    const t = cur.userData.interactType as InteractType | undefined;
    const id = cur.userData.interactId as number | undefined;
    const reg = cur.userData.interactRegistry as InteractHit['registry'] | undefined;
    if (t !== undefined && id !== undefined && reg !== undefined) {
      return { type: t, id, registry: reg, distance: 0, subKind };
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

// ACU #50 tuning — the LMB-on-empty-ground "drop rope at feet" (static-pos
// floor-stake) was REMOVED. Anchoring a towed sled in place is now done by
// tying it to an iron stake; releasing the sled is done by dropping the rope
// item (G), handled in updateSleds. (Was: maybeStakeSledAtFloor.)

export function updateInteraction(ctx: GameContext, _dt: number): void {
  // AAR — animate all salvage-panel doors toward their targets regardless
  // of hover state. Cheap iteration (~50 panels), one float compare per
  // panel for the no-op case.
  updatePanelDoors(ctx, _dt);

  // Reset hover flags on every registry each frame.
  for (const p of ctx.pickups.list) p.hovered = false;
  for (const w of ctx.waterSources.list) w.hovered = false;
  for (const c of ctx.cacti.list) c.hovered = false;
  for (const l of ctx.lizards) l.hovered = false;
  for (const s of ctx.shrews.list) s.hovered = false;
  for (const v of ctx.vultures.list) v.hovered = false;
  for (const w of ctx.sandWorms.list) w.hovered = false;
  for (const f of ctx.fires.list) f.hovered = false;
  for (const t of ctx.tents.list) t.hovered = false;
  for (const t of ctx.largeTents.list) t.hovered = false;
  for (const b of ctx.bedrolls.list) b.hovered = false;
  for (const l of ctx.lanterns.list) l.hovered = false;
  for (const l of ctx.lockers.list) l.hovered = false;
  if (ctx.companion) ctx.companion.hovered = false;
  for (const s of ctx.salvageables.list) s.hovered = false;
  for (const sl of ctx.sleds.list) sl.hovered = false;
  for (const st of ctx.stakes.list) st.hovered = false;
  if (ctx.egg) ctx.egg.hovered = false;   // M8 ⑩ (C52)
  for (const f of ctx.caveFungi.list) f.hovered = false;   // UNDERWORLD cycle 3
  ctx.inventory.hover = null;
  _hoverWorldValid = false;   // ACW F — invalidated until this frame's raycast resolves a hit
  // AAO — default cook bars to hidden each frame; re-shown inside the
  // 'fires' hover branch below when the player is looking at a fire
  // with active cooks. (Cooks themselves keep ticking regardless of
  // hover; this just controls the per-fire HUD visibility.)
  hideCookProgresses();

  // Drive any in-progress cooking forward.
  tickCooking(ctx);
  // Drive any in-progress salvage forward (cancelled later if hover drops).
  tickSalvage(ctx);
  // AAG — drive any in-progress pickup-swap forward (similarly cancelled
  // later if hover/key drops or completes).
  tickPickupSwap(ctx);

  if (!isPlaying(ctx)) {
    if (_salvaging) cancelSalvage();
    if (_pickupSwap) cancelPickupSwap();
    return;
  }
  // Overlay menus suppress interaction (pointer is unlocked anyway).
  if (isLootMenuOpen() || isSleepOverlayOpen() || isCraftingMenuOpen() || isInventoryOverlayOpen() || isControlsPanelOpen() || isJournalPanelOpen()) {
    if (_salvaging) cancelSalvage();
    if (_pickupSwap) cancelPickupSwap();
    return;
  }

  const cam = ctx.three.camera;
  cam.getWorldDirection(_dir);
  // ACT — interaction ray origin. In 3P the camera sits ~1.8m behind the
  // player (controller.ts _3P_BACK_DIST), which would eat most of the 2.5m
  // interaction reach (effective ~0.7m) and stop hover prompts from EVER
  // appearing in third person. Originate the ray from the player's eye along
  // the camera look direction (= screen-center reticle) so reach is identical
  // in both camera modes. In FP cam.position already IS the eye, so this is
  // a no-op there.
  if (ctx.flags.thirdPerson) {
    const tr = ctx.player.body.body.translation();
    _rayFrom.set(tr.x, tr.y + ctx.player.eyeOffset, tr.z);
  } else {
    _rayFrom.copy(cam.position);
  }
  _ray.set(_rayFrom, _dir);
  _ray.far = RAYCAST_DISTANCE;

  // Union target list — only meshes we tagged as interactable.
  const targets: THREE.Object3D[] = [];
  // M1 pickup-instancing — instanced pickups share ONE InstancedMesh per pool;
  // push each pool once (not once per pickup — that would raycast the same imesh
  // hundreds of times). Hits on a pool resolve via intersection.instanceId below.
  for (const p of ctx.pickups.list) if (!p.inst) targets.push(p.mesh);
  for (const im of getPickupInstancedMeshes()) targets.push(im);
  for (const w of ctx.waterSources.list) targets.push(w.mesh);
  for (const c of ctx.cacti.list) if (!c.harvested) targets.push(c.mesh);
  for (const l of ctx.lizards) targets.push(l.mesh);
  // ACR — dead (unlooted) shrews are E-take targets; live ones are LMB combat
  // targets via the collider raycast in combat.ts, not [E] interactions.
  for (const s of ctx.shrews.list) if (s.state === 'dead' && !s.looted) targets.push(s.mesh);
  // ACAH — dead (landed, unlooted) vultures are E-take targets; live/flying ones
  // are LMB gun targets via the collider raycast in combat.ts.
  for (const v of ctx.vultures.list) if (v.state === 'dead' && v.landed && !v.looted) targets.push(v.mesh);
  // Sand worm corpses — target dead, visible worm meshes that are still
  // unlooted (tie/harvest) OR currently towed (so a looted-in-tow carcass can
  // still be CUT LOOSE — ACS fix for the ACF carcass-tow bug). Live worms are
  // LMB targets via combat.ts, not [E] interactions.
  for (const w of ctx.sandWorms.list) {
    const towed = w.dragAnchor !== undefined && w.dragAnchor.kind !== 'none';
    if (w.mesh.visible && w.state === 'dead' && (!w.looted || towed)) {
      targets.push(w.mesh);
    }
  }
  for (const lc of ctx.lootContainers.list) targets.push(lc.mesh);
  // Both alive (cook/add_fuel) and dead (relight) fires are interactable.
  for (const f of ctx.fires.list) targets.push(f.mesh);
  for (const t of ctx.tents.list) targets.push(t.mesh);
  for (const t of ctx.largeTents.list) targets.push(t.mesh);
  for (const b of ctx.bedrolls.list) targets.push(b.mesh);
  for (const l of ctx.lanterns.list) targets.push(l.mesh);
  for (const l of ctx.lockers.list) targets.push(l.mesh);
  if (ctx.companion) targets.push(ctx.companion.group);
  for (const sl of ctx.sleds.list) targets.push(sl.group);
  for (const st of ctx.stakes.list) targets.push(st.mesh);
  // ACF — dead raiders are rope-draggable corpses. Only push corpses (live
  // raiders are combat targets, not interactables). The mesh tag (registry
  // 'raiders', type 'attach_rope') is applied in raider.ts on death.
  for (const r of ctx.raiders) if (r.bb.state === 'dead') targets.push(r.group);
  for (const s of ctx.salvageables.list) targets.push(s.panel);
  for (const j of ctx.journals.list) targets.push(j.mesh);
  // M8 ⑩ (C52) — the cave egg is interactable only while the companion isn't acquired.
  if (ctx.egg && !ctx.flags.companionAcquired) targets.push(ctx.egg.group);
  // UNDERWORLD cycle 3 — harvestable cave fungi (unharvested clusters only).
  for (const f of ctx.caveFungi.list) if (!f.harvested) targets.push(f.group);
  // CC-3.1 — speeder seat is interactable when not already mounted; the
  // seat mesh is tagged with userData.interactType='mount' inside
  // makeSpeeder so resolveInteractable picks it up on raycast hit.
  if (ctx.speeder && !ctx.speeder.mounted) targets.push(ctx.speeder.seat);
  // M5 (C24) — the rear tow-bar is a rope-attach interactable (tie/untie a sled
  // to the speeder), available whether parked or mounted.
  if (ctx.speeder) targets.push(ctx.speeder.towBar);
  if (targets.length === 0) {
    if (_salvaging) cancelSalvage();
    return;
  }

  const hits = _ray.intersectObjects(targets, true);
  // Harness-only debug tap (pickup-take-sweep): dump this frame's raw hits when the
  // page sets __interactionDebug. Gated → zero cost in normal play.
  if ((window as unknown as { __interactionDebug?: boolean }).__interactionDebug) {
    (window as unknown as { __lastHits?: unknown }).__lastHits = {
      hits: hits.slice(0, 4).map((h) => ({
        d: +h.distance.toFixed(2),
        inst: h.instanceId,
        name: h.object.name || h.object.type,
        pk: h.object.userData.pickupId,
        map: !!h.object.userData.instanceToPickupId,
      })),
      nTargets: targets.length,
      nPools: targets.filter((t) => !!t.userData.instanceToPickupId).length,
      from: [+_rayFrom.x.toFixed(2), +_rayFrom.y.toFixed(2), +_rayFrom.z.toFixed(2)],
      dir: [+_dir.x.toFixed(3), +_dir.y.toFixed(3), +_dir.z.toFixed(3)],
      far: _ray.far,
    };
  }
  if (hits.length === 0) {
    if (_salvaging) cancelSalvage();
    // ACU #50 tuning — the old LMB-on-empty-ground "drop rope at feet"
    // (static-pos floor-stake) was removed; anchoring a towed sled is now done
    // by tying it to an iron STAKE. (Dropping the rope item with G releases the
    // sled — see updateSleds.)
    return;
  }

  const hit = hits[0];
  // M1 pickup-instancing — an instanced-pool hit carries an instanceId; the shared
  // imesh has NO per-pickup userData.pickupId (it would alias every instance), so
  // resolve via the pool's instance→pickupId map instead of the parent-chain walk.
  let info: InteractHit | null = null;
  if (hit.instanceId !== undefined) {
    const instMap = hit.object.userData.instanceToPickupId as number[] | undefined;
    if (instMap) {
      const pid = instMap[hit.instanceId];
      if (pid !== undefined) info = { type: 'take', id: pid, registry: 'pickups', distance: 0 };
    }
  }
  if (!info) info = resolveInteractable(hit.object);
  if (!info) {
    if (_salvaging) cancelSalvage();
    return;
  }
  info.distance = hit.distance;
  // ACW F (#149) — record the hit point so the 3P prompt can sit on the object.
  _hoverWorldPos.copy(hit.point);
  _hoverWorldValid = true;
  // If we're salvaging but the hovered thing is no longer the same wreck, cancel.
  if (_salvaging && (info.registry !== 'salvageables' || info.id !== _salvaging.salvageableId)) {
    cancelSalvage();
  }

  // Dispatch to set hover state + prompt + handle E
  switch (info.registry) {
    case 'eggs': {
      // M8 ⑩ (C52) — the cave egg. E hatches the companion at the egg, sets the
      // acquired flag, and removes the egg. Guarded on !companionAcquired (the boot
      // reconcile also removes a hatched/already-had egg, but guard defensively).
      const egg = ctx.egg;
      if (!egg || ctx.flags.companionAcquired) return;
      egg.hovered = true;
      ctx.inventory.hover = { type: 'hatch', distance: info.distance, promptNoun: 'egg — something stirs inside' };
      if (ctx.input.pressed.has('KeyE')) {
        spawnCompanionAt(ctx, egg.pos, 'idle');
        ctx.flags.companionAcquired = true;
        egg.group.removeFromParent();
        ctx.egg = null;
        ctx.ui.showToast('the egg cracks open — Pebble uncurls');
      }
      return;
    }

    case 'pickups': {
      // AAA — E is the take/pickup button (UU's LMB-take reverted).
      // LMB stays for "use the wielded item" (attack/place/hold_use);
      // pickups go back to E so LMB never collides with the natural
      // "I want to grab this thing" muscle memory.
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
      if (ctx.input.pressed.has('KeyE') && !_pickupSwap) {
        const slotIdx = addItem(ctx.inventory, p.itemId, p.meta, ctx);
        if (slotIdx < 0) {
          // AAG — bag is full. If the selected slot has something to
          // drop, start a hold-E swap timer instead of giving up.
          // (If selected is empty, addItem would have succeeded, so
          // this branch implies sel.item !== null.)
          const sel = ctx.inventory.slots[ctx.inventory.selectedIdx];
          if (sel.item !== null) {
            _pickupSwap = {
              pickupId: p.id,
              startedAt: ctx.time.elapsed,
              completeAt: ctx.time.elapsed + Tuning.PICKUP_SWAP_DURATION_S,
            };
            ctx.ui.showToast('hold E to swap with selected slot');
          } else {
            ctx.ui.showToast('your bag is full');
          }
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
      // DEEPER cycle 6 — the prompt noun comes from the SOURCE now ('well' / 'pool'), and which
      // vessels a source can fill depends on whether it is a real body of water.
      const noun = w.noun;
      const found = findRefillableContainer(ctx, w.deepEnoughForLargeVessel);
      if (found) {
        ctx.inventory.hover = { type: 'refill', distance: info.distance, promptNoun: noun };
        if (ctx.input.pressed.has('KeyE')) {
          if (!found.slot.meta) found.slot.meta = { fillLevel: 1 };
          found.slot.meta.fillLevel = 1;
          if (found.slot.item === 'jerrycan') {
            playJerrycanFill();
            ctx.ui.showToast('jerrycan filled — it drags at your shoulder');
          } else {
            playPour();
            ctx.ui.showToast('canteen refilled');
          }
        }
      } else if (!w.deepEnoughForLargeVessel && findRefillableContainer(ctx, true)) {
        // The player is carrying a jerrycan that needs water, but this source can't submerge it.
        // Say so DIEGETICALLY rather than silently doing nothing (cycle-6 spec).
        ctx.inventory.hover = { type: 'refill', distance: info.distance, promptNoun: `${noun} — too shallow to fill the jerrycan` };
      } else {
        // Nothing to fill — the water is still worth showing, with the actual reason.
        const carrying = hasWaterContainer(ctx);
        ctx.inventory.hover = {
          type: 'refill', distance: info.distance,
          promptNoun: carrying ? `${noun} (your water is full)` : `${noun} (need canteen)`,
        };
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
        // Scavenger's Economy (build 2) — only ALIEN cacti spawn (CC-4), so the
        // harvest always yields alien_fruit; the dead `cactus_pulp` else-branch
        // was removed (the id is deprecated-unobtainable, kept only for load-compat).
        let added = 0;
        for (let i = 0; i < got; i++) {
          if (addItem(ctx.inventory, 'alien_fruit', undefined, ctx) >= 0) added++;
        }
        if (added === 0) {
          ctx.ui.showToast('your bag is full');
          return;
        }
        harvestCactus(c, ctx.time.elapsed);
        playHarvest();
        ctx.ui.showToast(`you pluck ${added} alien fruit${added > 1 ? 's' : ''}`);
      }
      return;
    }

    case 'caveFungi': {
      // UNDERWORLD cycle 3 — harvest a glowing cave fungi cluster → 1-2 alien_fruit (the
      // established weird-flora food; no new craftable output). The cluster hides on harvest.
      const f = ctx.caveFungi.list.find((c) => c.id === info.id);
      if (!f || f.harvested) return;
      f.hovered = true;
      ctx.inventory.hover = { type: 'harvest', distance: info.distance, promptNoun: 'glowing fungus' };
      if (ctx.input.pressed.has('KeyE')) {
        const got = 1 + Math.floor(Math.random() * 2);   // 1-2 yields
        let added = 0;
        for (let i = 0; i < got; i++) if (addItem(ctx.inventory, 'alien_fruit', undefined, ctx) >= 0) added++;
        if (added === 0) { ctx.ui.showToast('your bag is full'); return; }
        f.harvested = true;
        f.group.visible = false;
        f.group.traverse((o) => { delete o.userData.interactType; delete o.userData.interactRegistry; });
        playHarvest();
        ctx.ui.showToast(`you pluck ${added} glowing fruit${added > 1 ? 's' : ''}`);
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

    case 'shrews': {
      // ACR — dead desert shrew → cut the meat (mirror the lizard take).
      // Only dead shrews are raycast targets, so this only fires when dead.
      const s = findShrewById(ctx.shrews.list, info.id);
      if (!s || s.state !== 'dead') return;
      s.hovered = true;
      ctx.inventory.hover = { type: 'take', distance: info.distance, promptNoun: 'dead shrew', itemId: 'raw_shrew_meat' };
      if (ctx.input.pressed.has('KeyE')) {
        const slotIdx = addItem(ctx.inventory, 'raw_shrew_meat', undefined, ctx);
        if (slotIdx < 0) {
          ctx.ui.showToast('your bag is full');
          return;
        }
        ctx.ui.showToast('you cut the meat from the shrew');
        playPickup();
        lootShrew(s, ctx);
      }
      return;
    }

    case 'vultures': {
      // ACAH — dead vulture on the ground → cut the meat (mirror the shrew take).
      const v = findVultureById(info.id);
      if (!v || v.state !== 'dead' || !v.landed) return;
      v.hovered = true;
      ctx.inventory.hover = { type: 'take', distance: info.distance, promptNoun: 'dead vulture', itemId: 'raw_vulture_meat' };
      if (ctx.input.pressed.has('KeyE')) {
        const slotIdx = addItem(ctx.inventory, 'raw_vulture_meat', undefined, ctx);
        if (slotIdx < 0) {
          ctx.ui.showToast('your bag is full');
          return;
        }
        ctx.ui.showToast('you cut the meat from the vulture');
        playPickup();
        lootVulture(v, ctx);
      }
      return;
    }

    case 'sandWorms': {
      // ACE Tier 2 — multi-worm. Resolve which worm was hit via the
      // tagged interactId (set by sandWorm.ts/tag with worm.id).
      const worm = ctx.sandWorms.list.find((w) => w.id === info.id);
      if (!worm || worm.state !== 'dead') return;
      worm.hovered = true;
      // ACS — shared harvest (used by both the towed branch + the on-foot loot
      // branch). Yields 2-3 slabs from the giant carcass, then marks it looted.
      const harvestWorm = (): void => {
        const yieldN = 2 + Math.floor(Math.random() * 2);
        let added = 0;
        for (let i = 0; i < yieldN; i++) {
          if (addItem(ctx.inventory, 'raw_worm_meat', undefined, ctx) >= 0) added++;
        }
        if (added === 0) { ctx.ui.showToast('your bag is full'); return; }
        playPickup();
        lootSandWorm(worm, ctx);
      };
      // ACF — B1 Phase 3 follow-up: tow the carcass behind the SPEEDER only
      // (a 24m carcass is far too massive to drag on foot). Requires rope
      // wielded + mounted. LMB ties/cuts. Takes priority over the loot
      // prompt while the player is set up to tow.
      {
        const ropeEq = ctx.inventory.slots[ctx.inventory.selectedIdx].item === 'rope';
        const towed = worm.dragAnchor?.kind === 'speeder';
        const mounted = !!ctx.speeder?.mounted;
        if (towed) {
          // ACS — while towing: LMB cuts the rope, E carves meat (if any is
          // left). Harvesting no longer requires cutting loose first (closes
          // the ACF gap where a towed carcass couldn't be carved + a carved
          // carcass couldn't be cut loose — lootSandWorm keeps the tag while
          // towed + the raycast still targets a towed-looted carcass).
          ctx.inventory.hover = {
            type: 'attach_rope',
            distance: info.distance,
            promptNoun: worm.looted ? 'cut carcass loose' : 'cut loose  ·  [E] carve meat',
          };
          if (ctx.input.mousePressed.has(0)) {
            worm.dragAnchor = { kind: 'none' };
            ctx.ui.showToast('carcass cut loose');
            return;
          }
          if (!worm.looted && ctx.input.pressed.has('KeyE')) harvestWorm();
          return;
        }
        if (ropeEq && mounted) {
          ctx.inventory.hover = {
            type: 'attach_rope',
            distance: info.distance,
            promptNoun: 'tie carcass to speeder',
          };
          if (ctx.input.mousePressed.has(0)) {
            worm.dragAnchor = { kind: 'speeder' };
            ctx.ui.showToast('carcass roped to the speeder');
          }
          return;
        }
        if (ropeEq && !mounted) {
          // Soft hint — rope is wielded but they're on foot.
          ctx.inventory.hover = {
            type: 'attach_rope',
            distance: info.distance,
            promptNoun: 'too heavy to drag on foot — tow from the speeder',
          };
          return;
        }
      }
      if (worm.looted) return;
      ctx.inventory.hover = {
        type: 'take',
        distance: info.distance,
        promptNoun: 'worm-flesh',
        itemId: 'raw_worm_meat',
      };
      if (ctx.input.pressed.has('KeyE')) harvestWorm();
      return;
    }

    case 'raiders': {
      // ACF — B1 Phase 3 follow-up: drag a downed raider corpse. Rope
      // wielded → LMB ties the corpse to a player-tethered sled (so it
      // trails the sled) if one is in hand, otherwise straight to the
      // player (drag on foot). LMB again on a dragged corpse drops it.
      const r = ctx.raiders.find((rr) => rr.id === info.id);
      if (!r || r.bb.state !== 'dead') return;
      const ropeEq = ctx.inventory.slots[ctx.inventory.selectedIdx].item === 'rope';
      const dragging = !!r.dragAnchor && r.dragAnchor.kind !== 'none';
      if (dragging) {
        ctx.inventory.hover = {
          type: 'attach_rope',
          distance: info.distance,
          promptNoun: 'drop the corpse',
        };
        if (ctx.input.mousePressed.has(0)) {
          r.dragAnchor = { kind: 'none' };
          ctx.ui.showToast('corpse dropped');
        }
        return;
      }
      if (!ropeEq) {
        ctx.inventory.hover = {
          type: 'attach_rope',
          distance: info.distance,
          promptNoun: 'corpse (equip rope to drag)',
        };
        return;
      }
      const playerSled = ctx.sleds.list.find((s) => s.tether.kind === 'player');
      ctx.inventory.hover = {
        type: 'attach_rope',
        distance: info.distance,
        promptNoun: playerSled ? 'tie corpse to sled' : 'drag corpse',
      };
      if (ctx.input.mousePressed.has(0)) {
        r.dragAnchor = playerSled
          ? { kind: 'sled', sledId: playerSled.id }
          : { kind: 'player' };
        ctx.ui.showToast(playerSled ? 'corpse roped to the sled' : 'dragging the corpse');
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
      // AAO — surface per-cook progress bars for this fire, if any cooks
      // are running on it. AAM's grilled fires can have up to 4 parallel
      // cooks; the salvage-progress bar pattern was a single-cook UI hangover.
      // Pre-AAM saw only "the currently-driven cook's progress"; now the
      // player sees all of them at once.
      const cooksHere = _cooks.filter((c) => c.fireId === f.id);
      if (cooksHere.length > 0) {
        showCookProgresses(cooksHere.map((c) => c.slot.meta?.cookProgress ?? 0));
      }
      // Dead fire — show relight prompt (requires branch).
      if (!f.alive) {
        const selSlot = ctx.inventory.slots[ctx.inventory.selectedIdx];
        if (selSlot.item === 'branch') {
          ctx.inventory.hover = { type: 'relight', distance: info.distance, promptNoun: 'fire', entityId: f.id };
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
          ctx.inventory.hover = { type: 'relight', distance: info.distance, promptNoun: 'fire (cold — need a branch)', entityId: f.id };
        }
        return;
      }
      // Inspect equipped slot to decide what action this fire offers.
      const selSlot = ctx.inventory.slots[ctx.inventory.selectedIdx];
      const selItem = selSlot.item;
      // AAZ-fix — grill_kit selected → attach grill prompt. Pre-AAZ-fix
      // this fell into the "no usable item" branch (passive 'cook' prompt),
      // and grill_kit.onUse failed to find the fire via a missing
      // HoverState.entityId. Now the E-key path works directly + the
      // LMB-click path (wieldAction → onUse) works via hover.entityId.
      if (selItem === 'grill_kit') {
        if (f.hasGrill) {
          ctx.inventory.hover = {
            type: 'cook',
            distance: info.distance,
            promptNoun: 'fire (already has a grill)',
            entityId: f.id,
            passive: true,
          };
        } else {
          ctx.inventory.hover = {
            type: 'cook',
            distance: info.distance,
            promptNoun: 'fire',
            verb: 'attach grill to',
            entityId: f.id,
          };
          if (ctx.input.pressed.has('KeyE')) {
            attachGrillToFire(ctx, f);
            // Consume the grill_kit slot — one kit per attachment.
            selSlot.count--;
            if (selSlot.count <= 0) {
              selSlot.item = null;
              selSlot.count = 0;
            }
            ctx.ui.showToast('grill attached');
          }
        }
        return;
      }
      if (selItem && COOK_MAP[selItem]) {
        // Raw food selected → cook prompt
        ctx.inventory.hover = { type: 'cook', distance: info.distance, promptNoun: 'fire', entityId: f.id };
        if (ctx.input.pressed.has('KeyE')) {
          // AAM — multi-cook gate. Without grill: max 1 cook on this fire.
          // With grill: max FIRE_GRILL_MAX_PARALLEL_COOKS on this fire.
          // Also reject if this exact slot is already being cooked
          // (don't double-stack on the same item).
          const cooksOnThisFire = _cooks.filter((c) => c.fireId === f.id);
          const cap = f.hasGrill ? Tuning.FIRE_GRILL_MAX_PARALLEL_COOKS : 1;
          const alreadyCookingThisSlot = _cooks.some((c) => c.slot === selSlot);
          if (alreadyCookingThisSlot) {
            ctx.ui.showToast('this item is already cooking');
          } else if (cooksOnThisFire.length >= cap) {
            ctx.ui.showToast(f.hasGrill ? 'grill is full' : 'a cook is already running here');
          } else {
            _cooks.push({
              slot: selSlot,
              fromId: selItem,
              toId: COOK_MAP[selItem]!,
              fireId: f.id,
              completeAt: ctx.time.elapsed + COOK_DURATION,
            });
            // Seed cook progress on the slot so viewModel.ts can drive
            // the per-frame cook animation against it.
            if (!selSlot.meta) selSlot.meta = {};
            selSlot.meta.cookProgress = 0;
            playCookSizzle();
            ctx.ui.showToast(f.hasGrill && cooksOnThisFire.length > 0 ? 'added to grill' : 'cooking...');
          }
        }
      } else if (selItem === 'branch') {
        // Branch selected → add fuel prompt
        ctx.inventory.hover = { type: 'add_fuel', distance: info.distance, promptNoun: 'fire', entityId: f.id };
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
        ctx.inventory.hover = { type: 'cook', distance: info.distance, promptNoun: 'fire (hold raw food)', entityId: f.id };
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

    case 'largeTents': {
      // XX — walk-in shelter tent. Reuses 'sleep' verb so E opens the
      // sleep overlay (identical UX to small tent). RMB pack-up is
      // handled by wieldAction.ts/handleContextAction.
      //
      // AAZ — when the hover lands on the door sub-mesh (interactSubKind
      // === 'door'), branch into the toggle path: prompt shows "open" or
      // "close" depending on doorOpen state, E flips it. The HoverState
      // gets a `verb` override since both states share the same
      // InteractType ('sleep'); the override lets the prompt show the
      // state-dependent verb instead of the static VERBS['sleep'].
      const t = findLargeTentById(ctx.largeTents.list, info.id);
      if (!t) return;
      t.hovered = true;
      if (info.subKind === 'door') {
        ctx.inventory.hover = {
          type: 'sleep',
          distance: info.distance,
          promptNoun: 'doorway',
          verb: t.doorOpen ? 'close' : 'open',
        };
        if (ctx.input.pressed.has('KeyE')) {
          toggleLargeTentDoor(ctx, t);
        }
        return;
      }
      ctx.inventory.hover = { type: 'sleep', distance: info.distance, promptNoun: 'shelter' };
      if (ctx.input.pressed.has('KeyE')) {
        openSleepOverlay(ctx);
      }
      return;
    }

    case 'bedrolls': {
      // AAC — bedroll. Same 'sleep' verb as tents; E opens the sleep overlay.
      const b = findBedrollById(ctx.bedrolls.list, info.id);
      if (!b) return;
      b.hovered = true;
      ctx.inventory.hover = { type: 'sleep', distance: info.distance, promptNoun: 'bedroll' };
      if (ctx.input.pressed.has('KeyE')) {
        openSleepOverlay(ctx);
      }
      return;
    }

    case 'lanterns': {
      // AAC — lantern. Passive hover (no E action). RMB pack-up via
      // wieldAction.ts/handleContextAction. Tagged 'sleep' type in the
      // module for hover discovery, but here we set the actual hover
      // to a passive sleep prompt with empty verb (so the [E] chip
      // hides — the controls panel's RMB-pack-up row is enough hint).
      const l = ctx.lanterns.list.find((x) => x.id === info.id);
      if (!l) return;
      l.hovered = true;
      ctx.inventory.hover = {
        type: 'sleep',
        distance: info.distance,
        promptNoun: 'lantern',
        passive: true,
      };
      // No E-action — lantern is purely a light source.
      return;
    }

    case 'companion': {
      // AAE — pocketable creature. Passive hover (no E action; just
      // shows the prompt noun so the player knows it's interactable).
      // RMB pack-up via wieldAction.ts/handleContextAction.
      const c = ctx.companion;
      if (!c) return;
      c.hovered = true;
      // ABZ — B1 rope-to-companion: if player wields rope + has a sled
      // currently player-tethered, LMB on companion transfers the
      // tether. Sled then follows the companion instead of the player.
      const eqRope = ctx.inventory.slots[ctx.inventory.selectedIdx].item === 'rope';
      const playerTetheredSled = eqRope
        ? ctx.sleds.list.find((s) => s.tether.kind === 'player')
        : undefined;
      if (eqRope && playerTetheredSled) {
        ctx.inventory.hover = {
          type: 'pet_companion',
          distance: info.distance,
          promptNoun: 'tie rope to Pebble',
        };
        if (ctx.input.mousePressed.has(0)) {
          applyTether(ctx, playerTetheredSled, { kind: 'companion' }); // player→deployed → stow rope
          ctx.ui.showToast('rope tied to Pebble');
        }
        return;
      }
      ctx.inventory.hover = {
        type: 'pet_companion',
        distance: info.distance,
        promptNoun: '(Pebble)',
        passive: true,
      };
      return;
    }

    case 'lockers': {
      // AAC — locker chest. E opens the loot menu with allowDeposit:true
      // (same shape as sled cargo from QQ-2 — bidirectional).
      const l = findLockerById(ctx.lockers.list, info.id);
      if (!l) return;
      l.hovered = true;
      const empty = l.contents.length === 0;
      ctx.inventory.hover = {
        type: 'open_locker',
        distance: info.distance,
        promptNoun: empty ? 'locker (empty)' : 'locker',
      };
      if (ctx.input.pressed.has('KeyE')) {
        ctx.lockers.open = l;
        openLootMenu(ctx, {
          id: l.id,
          contents: l.contents,
          opened: true,
          title: 'LOCKER',
          allowDeposit: true,
        });
      }
      return;
    }

    case 'sleds': {
      const sled = findSledById(ctx.sleds.list, info.id);
      if (!sled) return;
      sled.hovered = true;
      // Sub-dispatch by the tagged interactType — info.type is either
      // 'open_sled' (cargo deck) or 'attach_rope' (front yoke).
      if (info.type === 'attach_rope') {
        const attached = sled.tether.kind !== 'none';
        // ACU #50 — untie this end from the sled:
        //   • tether === player → the rope is in your hand; detaching just frees
        //     the sled (rope was never removed, so nothing returns).
        //   • tether is a deployed anchor (stake/companion/speeder/static-pos) →
        //     the rope was stowed; detaching returns it to your bag.
        // Either way detachRope does the right thing (it checks deployment).
        if (attached) {
          const deployed = sled.tether.kind !== 'player';
          ctx.inventory.hover = {
            type: 'attach_rope',
            distance: info.distance,
            promptNoun: deployed ? 'take rope' : 'untie rope',
          };
          if (ctx.input.mousePressed.has(0)) {
            detachRope(ctx, sled, deployed ? 'rope coiled back up' : 'rope untied');
          }
          return;
        }
        const ropeEquipped = ctx.inventory.slots[ctx.inventory.selectedIdx].item === 'rope';
        if (!ropeEquipped) {
          ctx.inventory.hover = {
            type: 'attach_rope',
            distance: info.distance,
            promptNoun: 'sled towrope (equip rope)',
            passive: true,
          };
          return;
        }
        ctx.inventory.hover = {
          type: 'attach_rope',
          distance: info.distance,
          promptNoun: 'attach rope',
        };
        if (ctx.input.mousePressed.has(0)) {
          const endpoint: RopeEndpoint =
            ctx.speeder && ctx.speeder.mounted ? { kind: 'speeder' } : { kind: 'player' };
          attachRopeToSled(ctx, sled, endpoint);
        }
        return;
      }
      // ACB P1 — locker-on-sled. If player wields locker_kit + hovers
      // the sled cargo deck (not the rope stub), LMB attaches a fresh
      // locker on top of the sled. The locker mesh parents to sled.group
      // so it travels with the sled visually + physically.
      // (info.type === 'attach_rope' branch already returned above, so
      // we know we're on the cargo-deck hover from here.)
      const eqLockerKit = ctx.inventory.slots[ctx.inventory.selectedIdx].item === 'locker_kit';
      if (eqLockerKit && sled.attachedLockerId === null) {
        ctx.inventory.hover = {
          type: 'open_sled',
          distance: info.distance,
          promptNoun: 'place locker on sled',
        };
        if (ctx.input.mousePressed.has(0)) {
          attachLockerToSled(ctx, sled);
        }
        return;
      }

      // Deep-Desert cycle 5 (D257, behind FEATURES.rideableSled) — the deck's
      // primary E action becomes RIDE (E is polled + consumed in updateSleds's
      // mount path, which runs earlier this tick). Show a ride prompt instead of
      // the cargo prompt so the [E] chip reads true. OFF path unchanged.
      // Deep-Desert — pack-up hint suffix. Shown only when packing would
      // actually succeed (empty deck + no locker), so the RMB affordance
      // never advertises an action that would just toast a refusal.
      const packable = sled.contents.length === 0 && sled.attachedLockerId === null;
      const packHint = packable ? '  ·  pack up [RMB]' : '';

      if (FEATURES.rideableSled && ctx.player.ridingSledId === null) {
        ctx.inventory.hover = {
          type: 'open_sled',
          distance: info.distance,
          promptNoun: 'sled' + packHint,
          verb: 'ride',
        };
        return;
      }

      // Default: cargo-deck open. QQ-2 — sled is bidirectional storage
      // (deposit + take), so empty sleds also open the menu so the
      // player can stash items into them.
      const empty = sled.contents.length === 0;
      ctx.inventory.hover = {
        type: 'open_sled',
        distance: info.distance,
        promptNoun: (empty ? 'sled (empty)' : 'sled cargo') + packHint,
      };
      if (ctx.input.pressed.has('KeyE')) {
        sled.opened = true;
        ctx.sleds.open = sled;
        // Pass an explicit OpenContainer wrapper so the menu reads the
        // sled's contents BY REFERENCE (item takes mutate sled.contents
        // directly). `allowDeposit: true` enables the second column
        // showing the player's inventory for deposits.
        openLootMenu(ctx, {
          id: sled.id,
          contents: sled.contents,
          opened: sled.opened,
          title: 'SLED CARGO',
          allowDeposit: true,
        });
      }
      return;
    }

    case 'stakes': {
      // Session ACE B1 Phase 3 — RopeEndpoint stake. Player needs rope
      // wielded + a player-tethered sled to tie one end to the stake.
      // Subtle UX choice: LMB attaches (mirrors the LMB-on-sled-stub
      // metaphor for "engage the rope here"). RMB pack-up handled by
      // wieldAction.ts/handleContextAction.
      const stake = findStakeById(ctx.stakes.list, info.id);
      if (!stake) return;
      stake.hovered = true;
      // Find a sled currently tethered to the player (the one we'd
      // re-anchor to the stake).
      const playerSled = ctx.sleds.list.find((s) => s.tether.kind === 'player');
      // Is some sled ALREADY tethered to this stake?
      const stakedSled = ctx.sleds.list.find(
        (s) => s.tether.kind === 'stake' && s.tether.stakeId === stake.id,
      );
      // ACU #50 — the rope DEPLOYS (out of inventory) while tied, so these are
      // pure tether re-anchors that no longer require a wielded rope:
      //   • staked sled → LMB takes the line in hand (tether→player); the rope
      //     stays deployed — fully coil it back at the sled's rope stub.
      //   • player-towed sled → LMB re-anchors it onto this stake.
      if (stakedSled) {
        ctx.inventory.hover = {
          type: 'attach_rope',
          distance: info.distance,
          promptNoun: 'take rope from stake',
        };
        if (ctx.input.mousePressed.has(0)) {
          applyTether(ctx, stakedSled, { kind: 'player' }); // deployed→player → rope back in hand
          ctx.ui.showToast('rope in hand — sled follows');
        }
        return;
      }
      if (playerSled) {
        ctx.inventory.hover = {
          type: 'attach_rope',
          distance: info.distance,
          promptNoun: 'tie sled to stake',
        };
        if (ctx.input.mousePressed.has(0)) {
          applyTether(ctx, playerSled, { kind: 'stake', stakeId: stake.id }); // player→deployed → stow rope
          ctx.ui.showToast('sled tied to stake');
        }
        return;
      }
      // Passive hover — stake is here but no sled to tie/untie.
      ctx.inventory.hover = {
        type: 'attach_rope',
        distance: info.distance,
        promptNoun: 'iron stake',
        passive: true,
      };
      return;
    }

    case 'salvageables': {
      const s = findSalvageableById(ctx.salvageables.list, info.id);
      if (!s) return;
      s.hovered = true;
      // AAT — annotate the prompt noun with condition adjective so
      // the player can read the pry cost at a glance. Empty for
      // standard panels (no decoration); "rusted" / "pristine" else.
      const baseName = shortNameFor(s.kind);
      const adj = conditionAdjective(s.condition);
      const name = adj ? `${baseName} (${adj})` : baseName;
      if (s.salvageRemaining <= 0) {
        ctx.inventory.hover = {
          type: 'salvage',
          distance: info.distance,
          promptNoun: `${name} — stripped`,
          passive: true,
        };
        return;
      }
      // AAR — two-stage flow: door must be pried open before components
      // can be extracted. Pry requires a pry tool equipped (gates the
      // entire salvage loop behind tool acquisition). M10 ⑭ (C57): the
      // craftable scrap_machete pries too, alongside scrap_bar. Once open,
      // any E-press extracts a single component until panel is stripped.
      const panelBody = s.panel as THREE.Object3D;
      const isOpen = panelBody.userData.panelOpened === true;
      if (!isOpen) {
        const sel = ctx.inventory.slots[ctx.inventory.selectedIdx];
        if (sel.item !== 'scrap_bar' && sel.item !== 'scrap_machete') {
          ctx.inventory.hover = {
            type: 'salvage',
            distance: info.distance,
            promptNoun: `${name} — need a pry tool`,
            passive: true,
          };
          return;
        }
        ctx.inventory.hover = {
          type: 'salvage',
          distance: info.distance,
          promptNoun: `${name} — pry open`,
        };
        if (ctx.input.pressed.has('KeyE') && !_salvaging) {
          // AAT — per-condition pry duration multiplier. Corroded
          // panels open faster (rusty hinges); pristine resist.
          const pryMul = pryDurationMultiplier(s.condition);
          _salvaging = {
            salvageableId: s.id,
            startedAt: ctx.time.elapsed,
            completeAt: ctx.time.elapsed + Tuning.SALVAGE_PANEL_PRY_DURATION_S * pryMul,
            mode: 'pry',
          };
          // AAR — metal pry creak. Plays once at pry start; the
          // ~0.85s envelope aligns with SALVAGE_PANEL_PRY_DURATION_S.
          playPryCreak();
        }
        return;
      }
      // Door open — extract a component per E-press.
      ctx.inventory.hover = { type: 'salvage', distance: info.distance, promptNoun: `${name} — search` };
      if (ctx.input.pressed.has('KeyE')) {
        extractOneComponent(ctx, s);
      }
      return;
    }

    case 'journals': {
      // Re-readable journal (Session W). E opens the modal lore panel.
      // Session ABF — journal kind is encoded as the interactable's
      // subKind (set by placeJournal); pass it to openJournalPanel so
      // each flagship's journal renders its own narrator voice.
      // ABJ — C2 (v11): suffix " (read)" to the prompt noun when this
      // kind has been read at least once on this save. journalReadKinds
      // is a Set<JournalKind> on ctx.inventory (persisted v11+).
      const journalKind = (info.subKind ?? 'opening') as JournalKind;
      const isBlackBox = journalKind === 'crash_log';   // ACBE — recovered flight recorder; unique per crash
      const alreadyRead = !isBlackBox && ctx.inventory.journalReadKinds.has(journalKind);
      ctx.inventory.hover = {
        type: 'read',
        distance: info.distance,
        promptNoun: isBlackBox ? 'black box' : alreadyRead ? 'journal (read)' : 'journal',
      };
      if (ctx.input.pressed.has('KeyE')) {
        const content = findJournalById(ctx.journals.list, info.id)?.content;
        void import('../ui/journalPanel.ts').then((m) => m.openJournalPanel(ctx, journalKind, content));
      }
      return;
    }

    case 'speeder': {
      // M5 (C24) — sub-dispatch by the tagged interactType: the rear TOW-BAR
      // ('attach_rope') ties/unties a sled; the SEAT ('mount') shows the mount prompt.
      if (info.type === 'attach_rope') {
        // Rope-attach to the speeder's rear tow-bar — parallels the stake case
        // (ACU #50: the rope is DEPLOYED while tied, so no wielded-rope check).
        // LMB ties a player-tethered sled to the speeder, or unties a
        // speeder-tethered one back into hand. Works PARKED (no mounting needed) —
        // an explicit alternative to the mount auto-transfer (which still works).
        const playerSled = ctx.sleds.list.find((s) => s.tether.kind === 'player');
        const speederSled = ctx.sleds.list.find((s) => s.tether.kind === 'speeder');
        if (speederSled) {
          ctx.inventory.hover = { type: 'attach_rope', distance: info.distance, promptNoun: 'take rope from speeder' };
          if (ctx.input.mousePressed.has(0)) {
            applyTether(ctx, speederSled, { kind: 'player' });   // speeder→player → rope back in hand
            ctx.ui.showToast('rope in hand — sled follows');
          }
          return;
        }
        if (playerSled) {
          ctx.inventory.hover = { type: 'attach_rope', distance: info.distance, promptNoun: 'tie sled to speeder' };
          if (ctx.input.mousePressed.has(0)) {
            applyTether(ctx, playerSled, { kind: 'speeder' });   // player→speeder → stow rope on the bar
            ctx.ui.showToast('sled tied to the speeder');
          }
          return;
        }
        // Nothing to tie — passive hover so the bar still reads as the tow point.
        ctx.inventory.hover = { type: 'attach_rope', distance: info.distance, promptNoun: 'tow-bar', passive: true };
        return;
      }
      // CC-3.1 — the SEAT: "[E] mount speeder". The mount action is handled by
      // updateSpeeder earlier in the tick (SPEEDER_MOUNT_RANGE), so no E here.
      // M10 ⑮ (C58): a BROKEN speeder shows "[E] repair" instead (handled by
      // updateBrokenSpeeder); a passive prompt notes the scrap cost if short.
      if (ctx.speeder?.broken) {
        const haveScrap = countItems(ctx.inventory, 'scrap') >= Tuning.SPEEDER_REPAIR_SCRAP;
        ctx.inventory.hover = {
          type: 'repair',
          distance: info.distance,
          promptNoun: haveScrap ? 'speeder' : `speeder — need ${Tuning.SPEEDER_REPAIR_SCRAP} scrap`,
          passive: !haveScrap,
        };
        return;
      }
      ctx.inventory.hover = {
        type: 'mount',
        distance: info.distance,
        promptNoun: 'speeder',
      };
      return;
    }
  }
}

/** Per-frame cook timer. AAM — iterates the _cooks list and ticks each.
 *  Each cook cancels when its slot.item changes (item swapped/consumed)
 *  OR when its fire dies or vanishes; completes when elapsed > completeAt.
 *  AAM dropped the slot-switch cancel: when a grilled fire is running 4
 *  parallel cooks, the player will switch slots to load more raw items —
 *  that shouldn't kill the in-progress cooks. */
function tickCooking(ctx: GameContext): void {
  for (let i = _cooks.length - 1; i >= 0; i--) {
    const c = _cooks[i];
    // Cancel: item was swapped out or consumed.
    if (c.slot.item !== c.fromId) {
      if (c.slot.meta) c.slot.meta.cookProgress = undefined;
      _cooks.splice(i, 1);
      continue;
    }
    // Cancel: the fire died or was removed (e.g. ran out of fuel).
    const fire = findFireById(ctx.fires.list, c.fireId);
    if (!fire || !fire.alive) {
      if (c.slot.meta) c.slot.meta.cookProgress = undefined;
      _cooks.splice(i, 1);
      continue;
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
      _cooks.splice(i, 1);
    }
  }
}

/** DEEPER cycle 6 — which container this water source can top up, or null.
 *
 *  `allowLarge` is the source's `deepEnoughForLargeVessel`: a cave POOL can submerge a jerrycan, a
 *  WELL cannot (only the canteen fits down a shaft on a cord). ORDER: the WIELDED container wins if
 *  it needs water — you fill what is in your hands — otherwise the first fillable hotbar slot, then
 *  the backpack. Backpack inclusion is new here and deliberate: a jerrycan is a stowed bulk item,
 *  and requiring the player to hotbar it just to fill it would be busywork, not a decision. */
function findRefillableContainer(
  ctx: GameContext,
  allowLarge: boolean,
): { slot: import('../inventory/types.ts').Slot } | null {
  const fillable = (slot: import('../inventory/types.ts').Slot): boolean => {
    if (slot.item !== 'canteen' && slot.item !== 'jerrycan') return false;
    if (slot.item === 'jerrycan' && !allowLarge) return false;
    return (slot.meta?.fillLevel ?? 1) < 1;
  };
  const held = ctx.inventory.slots[ctx.inventory.selectedIdx];
  if (held && fillable(held)) return { slot: held };
  for (const slot of ctx.inventory.slots) if (fillable(slot)) return { slot };
  for (const slot of ctx.inventory.backpack) if (fillable(slot)) return { slot };
  return null;
}

/** Does the player carry any water container at all (full or not)? Separates "you own nothing that
 *  holds water" from "everything you carry is already full" in the refill prompt. */
function hasWaterContainer(ctx: GameContext): boolean {
  const isContainer = (slot: import('../inventory/types.ts').Slot): boolean =>
    slot.item === 'canteen' || slot.item === 'jerrycan';
  return ctx.inventory.slots.some(isContainer) || ctx.inventory.backpack.some(isContainer);
}

/** Per-frame salvage timer. AAR — drives the PRY animation. Extracts
 *  are instant per-press (no timer), so this only ticks when mode='pry'.
 *  Drives the progress bar, completes on time-up, cancels if the target
 *  vanishes from the registry. */
function tickSalvage(ctx: GameContext): void {
  if (!_salvaging) return;
  const c = _salvaging;
  const s = findSalvageableById(ctx.salvageables.list, c.salvageableId);
  if (!s || s.salvageRemaining <= 0) {
    cancelSalvage();
    return;
  }
  // AAR — cancel pry if a pry tool is no longer equipped (player swapped slots).
  // M10 ⑭ (C57): scrap_machete pries too.
  if (c.mode === 'pry') {
    const sel = ctx.inventory.slots[ctx.inventory.selectedIdx];
    if (sel.item !== 'scrap_bar' && sel.item !== 'scrap_machete') {
      cancelSalvage();
      return;
    }
  }
  const elapsed = ctx.time.elapsed - c.startedAt;
  // AAT — pry duration scales by condition; compute the same duration
  // we used to set completeAt so the progress bar fills smoothly to
  // 100% regardless of condition.
  const baseDur = c.mode === 'pry' ? Tuning.SALVAGE_PANEL_PRY_DURATION_S : SALVAGE_DURATION;
  const dur = c.mode === 'pry' ? baseDur * pryDurationMultiplier(s.condition) : baseDur;
  const t01 = Math.min(1, elapsed / dur);
  showSalvageProgress(t01);
  if (ctx.time.elapsed >= c.completeAt) {
    if (c.mode === 'pry') {
      completePry(ctx, s);
    }
  }
}

/** AAR — pry complete: flip the panel's door to "opening" state.
 *  Per-frame door angle lerp happens in updatePanelDoors (separate
 *  from _salvaging — the door keeps animating even if the player
 *  walks away from the panel after the pry). */
function completePry(ctx: GameContext, s: import('../world/salvage.ts').Salvageable): void {
  const panel = s.panel as THREE.Object3D;
  panel.userData.panelOpened = true;
  // AAS — ignite the electrical-flicker glow. updatePanelDoors ticks
  // the intensity envelope (peak → flicker → fade to 0 over
  // SALVAGE_PANEL_GLOW_FADE_DURATION_S).
  panel.userData.panelGlowStartedAt = ctx.time.elapsed;
  // ACAX — 50% chance the pry shears the door/cover LOOSE so it tumbles to the
  // ground with real physics (popPanelDoor), instead of swinging open on the hinge.
  if (Math.random() < Tuning.SALVAGE_PANEL_POP_CHANCE && popPanelDoor(ctx, panel)) {
    // The door is gone — there's no hinge left to animate. Snap the open-state to
    // fully open so the cavity interior + portal mask reveal immediately
    // (updatePanelDoors gates both on the door angle).
    panel.userData.panelDoorAngle = Tuning.SALVAGE_PANEL_DOOR_OPEN_ANGLE;
    panel.userData.panelDoorTarget = Tuning.SALVAGE_PANEL_DOOR_OPEN_ANGLE;
    ctx.ui.showToast('the cover shears loose — search inside');
  } else {
    // AAU — the default: hinge swing. Explicit toast so the player recognizes the
    // two-stage flow (pry opens stage 1, E-press extracts stage 2).
    panel.userData.panelDoorTarget = Tuning.SALVAGE_PANEL_DOOR_OPEN_ANGLE;
    ctx.ui.showToast('the panel pries open — search inside');
  }
  _salvaging = null;
  hideSalvageProgress();
}

/** AAS — per-component loot mapping. Each interior detail mesh's
 *  PanelComponentKind tag (set in wrecks.ts addAccessPanel) maps
 *  deterministically to a specific loot item. Replaces the AAR
 *  rollWreckLoot-once-per-extract path which was random + opaque to
 *  the player. Now: "I see a red wire — I get rope. I see a chip — I
 *  get a bullet." */
/** AAT — per-condition pry duration multiplier. Composed against
 *  the baseline SALVAGE_PANEL_PRY_DURATION_S. */
function pryDurationMultiplier(c: SalvageCondition): number {
  switch (c) {
    case 'corroded': return Tuning.SALVAGE_CONDITION_PRY_MUL_CORRODED;
    case 'pristine': return Tuning.SALVAGE_CONDITION_PRY_MUL_PRISTINE;
    case 'standard': return Tuning.SALVAGE_CONDITION_PRY_MUL_STANDARD;
  }
}

// Scavenger's Economy build 1 — the component (panel) loot maps now live in the
// unified loot registry (config/lootRegistry.ts): COMPONENT_LOOT (standard),
// COMPONENT_LOOT_CORRODED (degraded), COMPONENT_LOOT_PRISTINE_BONUS (last-extract
// premium). Imported at the top of this module; the extraction logic below is
// unchanged (deterministic per-component-kind lookup, not a roll).

/** AAR + AAS — extract one component from an already-open panel.
 *  Hides the next un-extracted component mesh, looks up its loot via
 *  COMPONENT_LOOT (deterministic per kind, not a roll), adds to
 *  inventory. Decrements salvageRemaining; strips panel at zero. */
function extractOneComponent(ctx: GameContext, s: import('../world/salvage.ts').Salvageable): void {
  const panel = s.panel as THREE.Object3D;
  const components = (panel.userData.panelComponents as THREE.Mesh[] | undefined) ?? [];
  // Find next visible (not-yet-extracted) component, ordered by index.
  let nextIdx = -1;
  for (let i = 0; i < components.length; i++) {
    if (components[i].visible) { nextIdx = i; break; }
  }
  if (nextIdx < 0) {
    // No visible components — shouldn't happen if salvageRemaining > 0,
    // but defensive: force-strip.
    s.salvageRemaining = 0;
    markSalvageStripped(s);
    return;
  }
  // AAS — look up the component's deterministic loot mapping via its
  // panelComponentKind tag. Fallback for pre-AAS panels (saves loaded
  // from older formats with the AAR-era generic palette): roll the
  // kind-table once and grab the first entry, then scrap.
  const compMesh = components[nextIdx];
  const compKind = compMesh.userData.panelComponentKind as string | undefined;
  let entry: { id: ItemId; count?: number };
  if (compKind) {
    // AAT — pick the loot table by condition. Pristine + last-component
    // gets the bonus upgrade for the "find the rare wreck" beat.
    const isLastExtract = s.salvageRemaining === 1;
    if (s.condition === 'pristine' && isLastExtract) {
      entry = COMPONENT_LOOT_PRISTINE_BONUS;
    } else if (s.condition === 'corroded' && COMPONENT_LOOT_CORRODED[compKind]) {
      entry = COMPONENT_LOOT_CORRODED[compKind];
    } else if (COMPONENT_LOOT[compKind]) {
      entry = COMPONENT_LOOT[compKind];
    } else {
      const fallback = rollWreckLoot(s.kind, Math.random);
      entry = fallback.length > 0 ? fallback[0] : { id: 'scrap' as const, count: 1 };
    }
  } else {
    const fallback = rollWreckLoot(s.kind, Math.random);
    entry = fallback.length > 0 ? fallback[0] : { id: 'scrap' as const, count: 1 };
  }
  const count = entry.count ?? 1;
  let added = 0;
  // AAS — the deterministic COMPONENT_LOOT entries don't carry meta;
  // fallback rollWreckLoot entries might. Pass-through if present.
  const entryMeta = (entry as { meta?: import('../inventory/types.ts').ItemMeta }).meta;
  for (let i = 0; i < count; i++) {
    const idx = addItem(ctx.inventory, entry.id, entryMeta, ctx);
    if (idx < 0) break;
    added++;
  }
  if (added === 0) {
    ctx.ui.showToast('your bag is full');
    return;            // don't hide the component or decrement; player can retry after dropping
  }
  // Hide the extracted component visually.
  components[nextIdx].visible = false;
  s.salvageRemaining--;
  const def = getItemDef(entry.id);
  const got = added > 1 ? `${added} ${def.name.toLowerCase()}` : def.name.toLowerCase();
  ctx.ui.showToast(`salvaged: ${got}`);
  // AAR — small metallic clink rather than the heavy playSalvage scrape;
  // matches the "tweezed a part out" feel for single-component extracts.
  playComponentExtract();
  if (s.salvageRemaining <= 0) {
    markSalvageStripped(s);
  }
  maybeShowEventHint(ctx, 'first_salvage', 'wrecks can be stripped — pry open + search');
}

/** AAR — per-frame animation lerp on all salvageable panel doors.
 *  Iterates `ctx.salvageables.list` and steps each door's angle toward
 *  its target. Exponential lerp gives a satisfying decel as the door
 *  reaches the open position. Skipped doors (already at target) are
 *  near-free (one float compare). */
function updatePanelDoors(ctx: GameContext, dt: number): void {
  const k = Tuning.SALVAGE_PANEL_DOOR_OPEN_LERP;
  const glowPeak = Tuning.SALVAGE_PANEL_GLOW_PEAK_INTENSITY;
  const glowFade = Tuning.SALVAGE_PANEL_GLOW_FADE_DURATION_S;
  for (const s of ctx.salvageables.list) {
    const panel = s.panel as THREE.Object3D;
    // Door angle lerp (cheap no-op when target reached).
    const target = (panel.userData.panelDoorTarget as number | undefined) ?? 0;
    const current = (panel.userData.panelDoorAngle as number | undefined) ?? 0;
    if (Math.abs(target - current) >= 0.001) {
      // Exponential decay toward target: angle += (target - angle) * (1 - exp(-k*dt))
      const next = current + (target - current) * (1 - Math.exp(-k * dt));
      panel.userData.panelDoorAngle = next;
      const door = panel.userData.panelDoor as THREE.Object3D | undefined;
      // Session ABA — bugfix. The hinge in addAccessPanel is at the
      // panel's LEFT edge (body local -X) following real fuse-box
      // convention; the door extends to body's +X with the handle on
      // the right. Three.js's Y-rotation right-hand-rule means a
      // positive Y rotation around that hinge axis swings the door's
      // free (handle) edge from +X toward -Z — i.e. INTO the hull.
      // We want OUTWARD swing (toward +Z, away from the hull surface)
      // so apply the negative sign here. `panelDoorAngle` /
      // `panelDoorTarget` stay positive magnitudes; the convention
      // (positive = outward open) is encoded once at this application
      // site. All callsites of addAccessPanel inherit the fix.
      if (door) {
        if (panel.userData.panelShape === 'circle') {
          // ACAV Tier 3 — circle lift-off cover: slide it out along +Z + tumble it
          // ajar, normalised by the open-angle so it tracks the same 0..1 lerp the
          // hinge does (reuses panelDoorAngle/Target + completePry untouched).
          const t = next / Tuning.SALVAGE_PANEL_DOOR_OPEN_ANGLE;
          const baseZ = (door.userData.panelCoverBaseZ as number | undefined) ?? 0;
          const slide = (door.userData.panelCoverSlide as number | undefined) ?? 0.3;
          door.position.z = baseZ + t * slide;
          door.rotation.x = t * 1.0;
        } else {
          door.rotation.y = -next;
        }
      }
    }
    // ACAX — gate the stencil-portal MASK + the cavity INTERIOR group on the open
    // state EVERY frame (not just while animating, so a save loaded already-open
    // is handled too). The interior only reads through the portal once the door is
    // >45% clear of the mouth; gating it also SKIPS the closed panel's greeble draw
    // calls (the common case). Cheap: two boolean sets per panel, only on change.
    const openFrac = ((panel.userData.panelDoorAngle as number | undefined) ?? 0) / Tuning.SALVAGE_PANEL_DOOR_OPEN_ANGLE;
    const showInterior = openFrac > 0.45;
    const mask = panel.userData.panelMask as THREE.Object3D | undefined;
    if (mask && mask.visible !== showInterior) mask.visible = showInterior;
    const interior = panel.userData.panelInterior as THREE.Object3D | undefined;
    if (interior && interior.visible !== showInterior) interior.visible = showInterior;
    // AAS — electrical-flicker glow envelope. While glowElapsed < fade,
    // intensity = peak × fadeFactor × flicker. The flicker is two
    // detuned high-frequency sines so it never settles into a pattern;
    // fadeFactor linearly drops peak → 0 over the fade duration.
    // ABL — perf: glow PointLights now claimed from the shared
    // lightPool on first ignite tick (was per-panel before; ~68
    // always-in-scene-lights drove fragment cost). Released on fade
    // complete. Panel's `panelGlowAnchorLocal` stores the cavity
    // offset; we transform to world coords at claim time.
    const startedAt = (panel.userData.panelGlowStartedAt as number | undefined) ?? -1;
    if (startedAt < 0) continue;
    const glowElapsed = ctx.time.elapsed - startedAt;
    if (glowElapsed > glowFade) {
      // Fade complete — release the claimed pool light, if any.
      const glow = panel.userData.panelGlow as THREE.PointLight | null;
      if (glow) {
        releaseLight(ctx.lightPool, glow);
        panel.userData.panelGlow = null;
      }
      panel.userData.panelGlowStartedAt = -1;    // mark spent so we stop ticking
      continue;
    }
    // First tick of this glow → claim from pool + position at cavity.
    let glow = panel.userData.panelGlow as THREE.PointLight | null;
    if (!glow) {
      glow = claimLight(ctx.lightPool);
      if (glow) {
        glow.color.setHex(Tuning.SALVAGE_PANEL_GLOW_COLOR_HEX);
        glow.distance = Tuning.SALVAGE_PANEL_GLOW_RANGE_M;
        glow.decay = 2.0;
        glow.castShadow = false;
        // Transform the cavity-local anchor into world space.
        const anchorLocal = panel.userData.panelGlowAnchorLocal as THREE.Vector3 | undefined;
        if (anchorLocal) {
          panel.updateWorldMatrix(true, false);
          const worldPos = anchorLocal.clone().applyMatrix4(panel.matrixWorld);
          glow.position.copy(worldPos);
        }
        panel.userData.panelGlow = glow;
      }
    }
    const fadeFactor = Math.max(0, 1 - glowElapsed / glowFade);
    const flicker = 0.7 + 0.30 * Math.sin(glowElapsed * 23) * Math.sin(glowElapsed * 7.3);
    if (glow) glow.intensity = glowPeak * fadeFactor * Math.max(0.2, flicker);
  }
}

function cancelSalvage(): void {
  if (!_salvaging) return;
  _salvaging = null;
  hideSalvageProgress();
}

// ─────────────────────────────────────────────────────────────────────
// AAG — pickup-swap-on-hold-E
// ─────────────────────────────────────────────────────────────────────

const _dropDir = new THREE.Vector3();

function cancelPickupSwap(): void {
  if (!_pickupSwap) return;
  _pickupSwap = null;
  hideSalvageProgress();
}

/** Per-frame: advance the swap timer, cancel on key/hover/slot change,
 *  complete on timer hit. */
function tickPickupSwap(ctx: GameContext): void {
  if (!_pickupSwap) return;
  const s = _pickupSwap;
  // Cancel if key released. We use the held-state `keys` map (not
  // `pressed` which only fires on the initial press frame).
  if (!ctx.input.keys['KeyE']) { cancelPickupSwap(); return; }
  // Cancel if the target pickup is gone (taken by another path, despawned).
  const p = findPickupById(ctx.pickups.list, s.pickupId);
  if (!p) { cancelPickupSwap(); return; }
  // Cancel if selected slot is now empty (player changed slots or used
  // the selected item) — there'd be nothing to swap.
  const sel = ctx.inventory.slots[ctx.inventory.selectedIdx];
  if (sel.item === null) { cancelPickupSwap(); return; }
  const elapsed = ctx.time.elapsed - s.startedAt;
  const t01 = Math.min(1, elapsed / Tuning.PICKUP_SWAP_DURATION_S);
  showSalvageProgress(t01);
  if (ctx.time.elapsed >= s.completeAt) {
    completePickupSwap(ctx, p);
  }
}

function completePickupSwap(
  ctx: GameContext,
  p: import('../pickups/pickups.ts').Pickup,
): void {
  const slot = ctx.inventory.slots[ctx.inventory.selectedIdx];
  if (!slot.item) { cancelPickupSwap(); return; }
  const droppedId = slot.item;
  const droppedMeta = slot.meta ? { ...slot.meta } : undefined;
  const droppedCount = slot.count;
  const droppedDef = getItemDef(droppedId);
  // Compute drop position — same aimable-toss math as
  // inventory.ts dropSelected. Project to terrain Y.
  // ACC Stretch — drop velocity uses the full camera direction so the
  // player can aim a throw (look at sled deck → toss onto it).
  const cam = ctx.three.camera;
  cam.getWorldDirection(_dropDir);
  const horizX = _dropDir.x, horizZ = _dropDir.z;
  const horizLenSq = horizX * horizX + horizZ * horizZ;
  const horizLen = horizLenSq < 1e-4 ? 1 : Math.sqrt(horizLenSq);
  const hx = horizLenSq < 1e-4 ? 0 : horizX / horizLen;
  const hz = horizLenSq < 1e-4 ? -1 : horizZ / horizLen;
  const dx = cam.position.x + hx * 0.8;
  const dz = cam.position.z + hz * 0.8;
  const TOSS = Tuning.ITEM_TOSS_SPEED;
  const initialVel = {
    x: _dropDir.x * TOSS,
    y: _dropDir.y * TOSS + Tuning.ITEM_TOSS_BASE_UP,
    z: _dropDir.z * TOSS,
  };
  // Spawn one dropped pickup per stack unit (matches dropSelected's
  // per-unit-spawn pattern; stacks of N items appear as N pickups
  // clustered at the drop spot).
  for (let i = 0; i < droppedCount; i++) {
    // ABM (B7) — pickup-swap drops with physics so the dropped items
    // tumble naturally rather than stacking at the cursor.
    const dropped = spawnDroppedPickup(
      ctx.three.scene, ctx.terrain, { x: dx, z: dz }, droppedId, droppedMeta,
      {
        world: ctx.physics.world,
        initialVel,
      },
    );
    ctx.pickups.list.push(dropped);
  }
  // Clear the slot.
  slot.item = null;
  slot.count = 0;
  delete slot.meta;
  // Take the world pickup into the now-empty slot (addItem will pick
  // the first empty slot, which is the one we just cleared).
  const slotIdx = addItem(ctx.inventory, p.itemId, p.meta, ctx);
  if (slotIdx < 0) {
    // Should be impossible — we just freed the selected slot. Defensive.
    ctx.ui.showToast('the swap failed somehow');
  } else {
    const pickedDef = getItemDef(p.itemId);
    ctx.ui.showToast(`swapped — dropped ${droppedDef.name.toLowerCase()} for ${pickedDef.name.toLowerCase()}`);
    playPickup();
    despawnPickup(ctx, p);
  }
  cancelPickupSwap();
}
