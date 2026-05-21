// Session UU (D73) — sole LMB-while-wielded dispatcher.
//
// Replaces scattered LMB handling across combat.ts + interaction.ts +
// per-item onUse with a single centralized dispatch. Reads the equipped
// item's `wieldLmb` (D74; ItemDef.wieldLmb in inventory/types.ts) to
// pick a behavior; all overlay/mount/isPlaying gates live here in ONE
// place.
//
// Tick order (see main.ts): runs AFTER updateInteraction (so
// ctx.inventory.hover is current) and REPLACES the direct updateCombat
// call — combat is invoked from here when wieldLmb === 'attack'.
//
// Behaviors:
//   attack    → updateCombat(ctx, dt)
//   place     → on mousePressed: invoke def.onUse + handle consumed/anim
//   hold_use  → on mouseHeld: bump slot.meta.holdProgress; call onHoldTick
//   click_use → no LMB action on the wielded item (Q still calls onUse via inventory.ts)
//   none      → same as click_use; items where LMB has special hover-state
//               semantics (rope→sled-stub) handle their case directly in interaction.ts.
//
// AAA — pickup-take is back on E (interaction.ts case 'pickups'). LMB's
// role is "use the wielded item" only; LMB no longer takes pickups.
//
// Footgun pre-empts:
//   - Crafting menu's CRAFT button is a DOM LMB, NOT in-world LMB. The
//     overlay-open gate short-circuits before any dispatch reads
//     mousePressed.
//   - HMR-stale module singletons: hold-state lives in slot.meta
//     (mirrors D58 cookProgress), NOT in module-level vars.
//   - While mounted on the speeder, combat owns LMB unconditionally
//     (weapons still fire while riding; place/drink/take do not).

import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { updateCombat } from './combat.ts';
import { getItemDef } from '../inventory/items.ts';
import { packUpTent } from '../world/tent.ts';
import { packUpLargeTent } from '../world/largeTent.ts';
import { detachRope } from '../world/sled.ts';
import { isLootMenuOpen } from '../ui/lootMenu.ts';
import { isSleepOverlayOpen } from '../ui/sleepOverlay.ts';
import { isCraftingMenuOpen } from '../ui/craftingMenu.ts';
import { isInventoryOverlayOpen } from '../ui/inventoryOverlay.ts';
import { isControlsPanelOpen } from '../ui/tutorial.ts';
import { isJournalPanelOpen } from '../ui/journalPanel.ts';
import { isRecipeBookPanelOpen } from '../ui/recipeBookPanel.ts';

function overlayOpen(): boolean {
  return isLootMenuOpen()
    || isSleepOverlayOpen()
    || isCraftingMenuOpen()
    || isInventoryOverlayOpen()
    || isControlsPanelOpen()
    || isJournalPanelOpen()
    || isRecipeBookPanelOpen();
}

export function updateWieldAction(ctx: GameContext, dt: number): void {
  if (!isPlaying(ctx)) return;
  if (overlayOpen()) return;

  // While mounted on the speeder, combat owns LMB. Other LMB actions
  // (place/drink/take) are intentionally suppressed — you don't pitch
  // tents from horseback. updateCombat early-returns for non-weapon
  // items so wielding a kit while mounted is just a no-op.
  if (ctx.speeder?.mounted) {
    updateCombat(ctx, dt);
    return;
  }

  // UU-2 — RMB context action (additive verb; independent of wielded item).
  // Inherits all gates above. Runs BEFORE the LMB dispatch so RMB-on-tent
  // never collides with LMB-place (different mouse button).
  handleContextAction(ctx);

  const slot = ctx.inventory.slots[ctx.inventory.selectedIdx];
  if (!slot.item) return;  // AAA — no item equipped = no LMB action. Pickups go to E.

  const def = getItemDef(slot.item);
  const wield = def.wieldLmb ?? 'click_use';

  switch (wield) {
    case 'attack':
      updateCombat(ctx, dt);
      return;

    case 'place': {
      // Single-click to deploy. Reuse the existing onUse path so each
      // kit's deployFire/deployTent/deploySled handles proximity +
      // toast + consumed.
      if (!ctx.input.mousePressed.has(0)) return;
      const result = def.onUse(ctx, slot);
      if (result.message) ctx.ui.showToast(result.message);
      ctx.player.viewModel?.triggerUse();
      if (result.consumed) {
        slot.count--;
        if (slot.count <= 0) {
          slot.item = null;
          slot.count = 0;
          delete slot.meta;
        }
      }
      return;
    }

    case 'hold_use':
      if (ctx.input.mouseHeld.has(0)) {
        if (!slot.meta) slot.meta = {};
        slot.meta.holdProgress = (slot.meta.holdProgress ?? 0) + dt;
        def.onHoldTick?.(ctx, slot, slot.meta.holdProgress, dt);
      } else if (slot.meta?.holdProgress !== undefined) {
        // Released: clear hold progress so the next press starts fresh.
        slot.meta.holdProgress = undefined;
      }
      return;

    case 'click_use':
    case 'none':
      // AAA — LMB does nothing for these wieldLmb values. Q still
      // drives def.onUse via inventory.ts (bandage etc. still works).
      // Pickups are taken via E (interaction.ts case 'pickups').
      return;
  }
}

/** Session UU-2 — RMB context action. Independent of wielded item:
 *  power-user verb for tent pack-up + sled rope release. Reads
 *  `ctx.inventory.hover` (set by interaction.ts the same way LMB-take
 *  reads it). Gates already applied by `updateWieldAction`. */
function handleContextAction(ctx: GameContext): void {
  if (!ctx.input.mousePressed.has(2)) return;
  const hover = ctx.inventory.hover;
  if (!hover) return;

  // RMB on a tent (small or large) → pack it up (refuses if inventory full).
  if (hover.type === 'sleep') {
    for (const t of ctx.tents.list) {
      if (t.hovered) {
        packUpTent(ctx, t);
        return;
      }
    }
    // XX — also check large tents (same 'sleep' hover type)
    for (const t of ctx.largeTents.list) {
      if (t.hovered) {
        packUpLargeTent(ctx, t);
        return;
      }
    }
  }

  // RMB on a sled (cargo or rope-stub) → release rope if tethered
  // to the speeder. No-op if untethered or player-tethered (those use
  // the existing LMB-on-rope-stub detach path from QQ-2 / D67).
  if (hover.type === 'open_sled' || hover.type === 'attach_rope') {
    for (const sled of ctx.sleds.list) {
      if (sled.hovered && sled.tether.kind === 'speeder') {
        detachRope(ctx, sled, 'rope released');
        return;
      }
    }
  }
}

