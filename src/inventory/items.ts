// Item registry: every item the player can hold + its onUse behavior.

import type { ItemDef, ItemId } from './types.ts';
import { playDrink } from '../audio/audio.ts';

const _DEFS: Record<ItemId, ItemDef> = {
  canteen: {
    id: 'canteen',
    name: 'CANTEEN',
    glyph: '◇',
    description: 'a half-empty canteen',
    stackable: true,
    maxStack: 4,
    onUse(ctx) {
      const before = ctx.stats.thirst;
      ctx.stats.thirst = Math.min(1, before + 0.32);
      playDrink();
      return { consumed: true, message: 'you drink — the water is warm' };
    },
  },

  bandage: {
    id: 'bandage',
    name: 'BANDAGE',
    glyph: '+',
    description: 'a strip of clean cloth',
    stackable: true,
    maxStack: 4,
    onUse(ctx) {
      ctx.stats.health = Math.min(1, ctx.stats.health + 0.25);
      return { consumed: true, message: 'you bind a wound' };
    },
  },

  scrap: {
    id: 'scrap',
    name: 'SCRAP',
    glyph: '#',
    description: 'rust-pitted metal scrap',
    stackable: true,
    maxStack: 8,
    onUse(_ctx) {
      return { consumed: false, message: 'no use for it yet' };
    },
  },

  machete: {
    id: 'machete',
    name: 'MACHETE',
    glyph: '|',
    description: 'a notched, weighted blade',
    stackable: false,
    maxStack: 1,
    onUse(_ctx) {
      // Combat handled by the combat system in Session D; this is a no-op
      // (the swing fires from LMB, not the use key).
      return { consumed: false };
    },
  },
};

export function getItemDef(id: ItemId): ItemDef {
  return _DEFS[id];
}

export const ALL_ITEM_IDS: ReadonlyArray<ItemId> =
  ['canteen', 'scrap', 'bandage', 'machete'];
