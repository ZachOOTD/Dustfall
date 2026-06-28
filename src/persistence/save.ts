// Session M — single-slot save/load via localStorage.
//
// Strategy: the world boots normally (deterministic from Tuning.RNG_SEED).
// On Continue, we patch ctx in place — restore stats / inventory / time /
// player pose, remove pickups + entities that were consumed at save time,
// re-spawn placed fires + tents, and re-apply visual state for stripped
// wrecks / harvested cacti / dead lizards / dead raiders.
//
// Save key: dustfall.save.v1 — single slot. Death does NOT auto-save.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import type { Slot } from '../inventory/types.ts';
import { ALL_RECIPE_IDS } from '../inventory/recipeDiscovery.ts';
import type { LootEntry } from '../world/lootContainers.ts';

import { despawnPickup, spawnDroppedPickup } from '../pickups/pickups.ts';
import { harvestCactus } from '../world/cactus.ts';
import { markSalvageStripped } from '../world/salvage.ts';
import { serializeCrashes, setPendingCrashRestore, type SavedCrash } from '../world/meteorCrash.ts';   // ACBE (D1) — crash-site persistence
import {
  applyDeadPose,
  lootLizard,
  type LizardState,
} from '../enemies/lizard.ts';
import {
  applyDeadShrewPose,
  lootShrew,
  type ShrewState,
} from '../enemies/shrew.ts';
import {
  applyDeadVulturePose,
  lootVulture,
  type VultureState,
} from '../enemies/vulture.ts';
import {
  applyRaiderDeadPose,
  type RaiderState,
} from '../enemies/raider.ts';
import {
  applySandWormDeadPose,
  type SandWormState,
} from '../enemies/sandWorm.ts';
import type { JournalKind } from '../world/journal.ts';
import { spawnFireAt, attachGrillToFire, releaseFireLight } from '../world/fire.ts';
import { spawnTentAt } from '../world/tent.ts';
import { spawnSledAt, setNextSledId, type SledTether } from '../world/sled.ts';
import { spawnLargeTentAt, setNextLargeTentId } from '../world/largeTent.ts';
import { spawnBedrollAt, setNextBedrollId } from '../world/bedroll.ts';
import { spawnLanternAt, setNextLanternId, releaseLanternLight } from '../world/lantern.ts';
import { spawnLockerAt, setNextLockerId } from '../world/locker.ts';
import { spawnStakeAt, setNextStakeId } from '../world/stake.ts';
import type { CompanionState } from '../enemies/companion.ts';
import { removeShelterZone } from '../shelter/shelterZones.ts';

export const SAVE_KEY = 'dustfall.save.v1';
// EE/FF — v2 marked the world-rework chunked-terrain layout.
// GG — v3 marks the biome-rescale + scatter-retune.
// HH — v4 marks the procgen-POI + biome-aware-lizard layout. Schema is
// unchanged across all four versions; bumps exist so future tooling can
// tell pre- vs post-rework saves apart.
// QQ — v5 adds the `sleds` array (placed sled entities + their tether
// state + cargo). Pre-v5 saves load fine (sleds field is optional and
// just stays empty).
// TT — v6 adds `inventory.discoveredRecipes: number[]` for the
// combine-to-discover crafting rework. Pre-v6 saves get the FULL
// recipe set as discovered on load so existing playtesters don't
// lose their accumulated recipe knowledge.
// XX — v7 adds `largeTents?: Array<...>` (D81 — additive only).
// AAC — v8 adds `bedrolls?` + `lanterns?` + `lockers?` (additive only,
// D81 discipline preserved). Pre-v8 saves load with empty arrays for
// each.
// AAE — v9 adds `companion?: { pos, state }` for the Rocky-inspired
// pocketable creature (singleton per save). When the player has the
// pod in inventory, the field is undefined; the companion_pod ItemId
// in the inventory serialization captures that state.
// AAM — v10 adds optional `hasGrill?: boolean` to each fire entry
// (grill attachment for multi-cook). Pre-v10 saves omit the field;
// loader defaults to false. Additive change per D81. Loader accepts v1-v10.
// ABJ — v11 adds 3 optional fields in one combined bump (D108):
//   - `companion?.huddleState?: boolean` — was the companion actively
//     huddled at save time? On load, forces the companion back into
//     huddle state so a storm-saved game doesn't lose the pose.
//   - `inventory.journalReadKinds?: JournalKind[]` — compact set of
//     journal kinds the player has read at least once. Used by HUD
//     to dim the interact prompt for already-read journals (per-kind
//     not per-id since ids regenerate per-seed).
//   - `bornInDevMode?: boolean` — was this save written from a dev-
//     mode run? Carries the DEV badge across save/load.
// Loader accepts v1-v11.
// ABZ — v12: extended SledTether union with 'companion' kind. Pre-v12
// saves load unchanged (their tether field stays 'none' | 'player' |
// 'speeder' which is still valid in the v12 union).
// ACE Tier 2 — v13: multi-worm population. `sandWorm` (singleton-or-null)
// → `sandWorms` (array). Pre-v13 saves migrate at load time by lifting
// the legacy singleton into sandWorms[0].
// ACL — v14: additive. (1) `shrews[]` — desert-shrew prey (id + XZ + state).
// (2) `weather.wall` — sweeping sandstorm-wall state. Both optional fields;
// pre-v14 saves load with them absent (shrews rebuild from procgen; the wall
// defaults to the dormant struct from createWeather and re-derives intensity
// on the first updateWeather tick).
export const SAVE_VERSION = 15;

type V3 = { x: number; y: number; z: number };

export interface SaveV1 {
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
  seed: number;
  savedAt: number;
  /** ABJ — v11: persist the dev-mode flag so a Continue from a
   *  dev-saved game keeps the DEV badge + behavior. Pre-v11 saves
   *  omit the field; loader defaults to false (regular game). */
  bornInDevMode?: boolean;

  player: {
    pos: V3;
    cameraQuat: { x: number; y: number; z: number; w: number };
    velocityY: number;
    eyeOffset: number;
  };

  stats: {
    thirst: number;
    temperature: number;
    hunger: number;
    stamina: number;
    health: number;
  };

  inventory: {
    slots: Slot[];
    backpack: Slot[];
    selectedIdx: number;
    /** Session TT — Recipe.id ledger for the combine-to-discover
     *  system. Pre-v6 saves arrive without this field; loader seeds
     *  it with ALL_RECIPE_IDS so existing playtesters keep their
     *  recipe knowledge across the migration. */
    discoveredRecipes?: number[];
    /** ABJ — v11: set of journal kinds the player has read at least
     *  once. Compact per-kind (not per-id since ids regenerate per-
     *  seed). Pre-v11 saves arrive without this field; loader seeds
     *  it as an empty set (all journals read as unread). */
    journalReadKinds?: JournalKind[];
  };

  time: {
    dayTime: number;
    daysSurvived: number;
    elapsed: number;
  };

  // Seeded entities — list current state by id. Missing ids = consumed/looted.
  pickupSurvivors: number[];
  /** ABM (B7) — v11 additive: dropped-item pickups that have a physics
   *  body (and therefore a runtime-mutable position). Each entry is
   *  re-spawned via spawnDroppedPickup on load at the saved transform.
   *  Seed-spawned pickups (no body) are NOT in this list — they're
   *  recreated from the world build per `pickupSurvivors`. Pre-ABM
   *  saves arrive without this field; loader defaults to empty array
   *  (no dropped items restored). */
  droppedPickups?: Array<{
    itemId: string;
    pos: V3;
    quat: { x: number; y: number; z: number; w: number };
    meta?: import('../inventory/types.ts').ItemMeta;
    /** ACC P3 — when set, this pickup was riding a sled at save time.
     *  Loader re-promotes the pickup to kinematic + applies the saved
     *  local pose AFTER the sled load pass populates ctx.sleds.list.
     *  Optional + additive per D81 — pre-ACC saves omit these fields
     *  and the pickup loads as a normal dynamic body. If the referenced
     *  sled is gone on load, the rider falls back to dynamic and the
     *  natural friction/settle path catches it. */
    ridingSledId?: number;
    ridingLocalPos?: V3;
    ridingLocalQuat?: { x: number; y: number; z: number; w: number };
  }>;
  cacti: Array<{ id: number; harvested: boolean }>;
  lizards: Array<{ id: number; pos: V3; state: LizardState; looted: boolean }>;
  /** ACL — v14: desert shrews. Optional + additive (absent on pre-v14 saves,
   *  where shrews rebuild from procgen). y is re-derived from terrain on load;
   *  transient flee/wander needn't persist (state restores as-is). */
  shrews?: Array<{ id: number; x: number; z: number; state: ShrewState }>;
  /** ACAH — v14 additive: rare perched vultures (id + world pos + state).
   *  Absent on pre-ACAH saves → boot procgen stands. */
  vultures?: Array<{ id: number; x: number; y: number; z: number; state: VultureState }>;
  /** ACL — v14: sweeping sandstorm-wall state (plain data struct; no THREE
   *  objects). Optional + additive — absent on pre-v14 saves, which default
   *  to the dormant wall from createWeather and re-derive intensity on the
   *  first updateWeather tick. Restored verbatim onto ctx.weather.wall. */
  weatherWall?: {
    active: boolean; posX: number; posZ: number; dirX: number; dirZ: number;
    width: number; speed: number; age: number; approaching: boolean;
  };
  raiders: Array<{ id: number; pos: V3; state: RaiderState; health: number; dragAnchor?: SledTether }>;
  salvageables: Array<{ id: number; salvageRemaining: number; stripped: boolean; extractedIndices?: number[] }>;
  lootContainers: Array<{ id: number; opened: boolean; contents: LootEntry[] }>;

  // Player-placed — recreated from scratch on load.
  // AAM (v10) — optional hasGrill boolean per fire. Pre-v10 saves omit the
  // field; loader defaults to false. Additive change per D81.
  fires: Array<{ id: number; pos: V3; fuelSeconds: number; alive: boolean; hasGrill?: boolean }>;
  /** ACBE (D1) — v15: landed crash sites, re-spawned deterministically from each seed on load
   *  (the wreck + colliders + salvage + black box reappear, aged). Pre-v15 saves omit it → no
   *  crashes (D81 additive — no migration). */
  crashes?: SavedCrash[];
  tents: Array<{ id: number; pos: V3; rotationY: number }>;
  /** Session QQ — placed sleds with their cargo + tether state. Optional
   *  so pre-v5 saves still load (sleds field is just absent).
   *  ABZ — 'companion' kind (v12). ACA — 'static-pos' kind + tetherX/Z.
   *  ACB — `attachedLockerId?` field for locker-on-sled (additive).
   *  ACC — B1 Phase 2: 'sled' kind included in the discriminator for
   *  type-compatibility with the shared RopeEndpoint union (sled-tethered-
   *  to-sled is logically impossible for the sled's own tether and is
   *  never serialized in practice — but TS needs the union to match). */
  sleds?: Array<{
    id: number;
    pos: V3;
    rotationY: number;
    contents: LootEntry[];
    /** ACE — extended to include 'stake' kind (B1 Phase 3). ACF — extended
     *  to include 'raider_corpse' | 'sandworm_carcass' (B1 Phase 3 follow-up).
     *  Pre-ACF saves load unchanged (their tether value remains in the older
     *  subset). */
    tether: 'none' | 'player' | 'speeder' | 'companion' | 'static-pos' | 'sled' | 'stake'
      | 'raider_corpse' | 'sandworm_carcass';
    tetherX?: number;
    tetherZ?: number;
    /** ACC — B1 Phase 2: sled-id payload when tether === 'sled'. Optional;
     *  defaults undefined for non-sled-kind tethers. */
    tetherSledId?: number;
    /** ACE — B1 Phase 3: stake-id payload when tether === 'stake'.
     *  Optional; absent for non-stake tether kinds. */
    tetherStakeId?: number;
    /** ACF — B1 Phase 3 follow-up: raider-id payload when
     *  tether === 'raider_corpse'. Additive; absent for other kinds. */
    tetherRaiderId?: number;
    /** ACF — B1 Phase 3 follow-up: worm-id payload when
     *  tether === 'sandworm_carcass'. Additive; absent for other kinds. */
    tetherWormId?: number;
    attachedLockerId?: number;
  }>;

  /** Session ACE — placed iron stakes (B1 Phase 3 world-anchor endpoint).
   *  Pre-ACE saves arrive empty. D81 additive — no version bump. */
  stakes?: Array<{
    id: number;
    pos: V3;
    rotationY: number;
  }>;

  /** Session XX — placed large enterable tents. Optional so pre-v7
   *  saves still load (largeTents field is just absent, defaults to
   *  empty array on load). D81: additive only — never remove. */
  largeTents?: Array<{
    id: number;
    pos: V3;
    rotationY: number;
  }>;

  /** Session AAC — placed bedrolls. Pre-v8 saves arrive with empty
   *  array. D81 additive. */
  bedrolls?: Array<{
    id: number;
    pos: V3;
    rotationY: number;
  }>;

  /** Session AAC — placed lanterns. Pre-v8 saves arrive empty. */
  lanterns?: Array<{
    id: number;
    pos: V3;
    rotationY: number;
  }>;

  /** Session AAC — placed lockers + their contents. Pre-v8 saves
   *  arrive empty. Contents persisted by-value so a chest's stored
   *  items survive save/load. */
  lockers?: Array<{
    id: number;
    pos: V3;
    rotationY: number;
    contents: LootEntry[];
  }>;

  /** Session AAE — Rocky-inspired creature companion. Singleton.
   *  Present iff the creature is currently deployed in the world.
   *  When the player has the companion_pod in inventory, this field
   *  is undefined and the pod's ItemId is captured in the inventory
   *  serialization instead. Pre-v9 saves have undefined here →
   *  setupOpeningScene's default spawn stays (player encounters the
   *  creature for the first time on load). */
  companion?: {
    pos: V3;
    state: CompanionState;
    /** ABJ — v11: was the companion actively in huddle state at save
     *  time? Restored verbatim on load; weather-gated huddle logic
     *  re-validates next tick (if storm has passed, the state will
     *  transition back to idle/walking naturally). */
    huddleState?: boolean;
  };

  /** M8 ⑩ (C52) — has the player hatched the cave egg (acquired the companion)?
   *  Additive, NO version bump (D81/D254). ABSENT on pre-feature saves → the loader
   *  defaults TRUE so existing players keep their companion. New-era saves store the
   *  real value (false until the egg is hatched). When false, the cave egg is present
   *  + the boot-spawned companion is despawned. */
  companionAcquired?: boolean;

  /** Escape-pod intro (T0.1) — has this save completed (or never run) the crash intro?
   *  Additive, NO version bump (D81). ABSENT on pre-feature saves → loader treats as
   *  TRUE (legacy games never had the intro). A new game sets the intro running, then the
   *  desert handoff (T0.4) marks it done; the intro is never saved mid-sequence (the menu
   *  Save is blocked while it runs), so a written save always records true. Continue never
   *  replays the intro regardless — this field documents + future-proofs that invariant. */
  introComplete?: boolean;

  /** Hover speeder pose. Optional so v1 saves written before this field
   *  was added still load cleanly (the speeder just stays at the default
   *  position from setupOpeningScene). */
  speeder?: {
    pos: V3;
    rotationQuat: { x: number; y: number; z: number; w: number };
    mounted: boolean;
    headlampOn: boolean;
    /** M10 ⑮ (C58) — repairable-speeder broken state. Optional + additive: saves written
     *  before this field load with the speeder NOT broken (current rideable behaviour). */
    broken?: boolean;
  };

  /** Sand worm — DD-2 (roaming). LEGACY singleton field — present in
   *  pre-v13 saves only. v13+ uses `sandWorms` (array) below. At load
   *  time the loader checks both fields: v13+ → use sandWorms; pre-v13
   *  with a sandWorm singleton → lift it into sandWorms[0]; neither →
   *  no worm in this world (don't spawn a default — the boot path
   *  already spawned the per-seed worms before load runs).
   *
   *  Mid-encounter sub-states collapse to `patrol` on load (too brittle
   *  to restore mid-arc). If saved state is `dead`, the corpse is
   *  restored at that exact pos. Pre-DD-2 saves lack `pos` — handled
   *  in loadGameState by falling back to the home anchor. */
  sandWorm?: {
    state: SandWormState;
    health: number;
    looted: boolean;
    pos?: V3;
  };

  /** ACE Tier 2 — multi-worm population (v13+). Each worm carries its
   *  own state + position + loot status + stable id. The boot path
   *  spawns N worms before load runs; the loader matches saved ids
   *  back to the boot-spawned instances. If saved count > spawned count,
   *  extras are ignored; if spawned count > saved count, the extras
   *  retain their default boot state (patrol). */
  sandWorms?: Array<{
    id: number;
    state: SandWormState;
    health: number;
    looted: boolean;
    pos: V3;
    /** ACF — B1 Phase 3 follow-up: speeder-tow state, if the carcass was
     *  roped behind the speeder at save time. Additive. */
    dragAnchor?: SledTether;
  }>;
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

/** AAI — peek the seed field of the saved game without doing a full
 *  load. Used by main.ts at boot to seed the procgen world BEFORE
 *  the title-overlay's Continue path runs (since systems like terrain
 *  and POI placement need the seed up-front, not after Continue). */
export function peekSavedSeed(): number | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw === null) return null;
  try {
    const obj = JSON.parse(raw) as Partial<SaveV1>;
    if (typeof obj.seed === 'number' && Number.isFinite(obj.seed)) {
      return obj.seed >>> 0;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

function cloneSlot(s: Slot): Slot {
  const out: Slot = { item: s.item, count: s.count };
  if (s.meta) {
    // UU — holdProgress is transient input state (resets on LMB release).
    // Strip it on save so a reload doesn't resume mid-hold with stale
    // accumulated time. Other meta fields (fillLevel, ammoRemaining,
    // cookProgress, etc.) ARE persisted.
    const { holdProgress: _hp, ...metaToSave } = s.meta;
    out.meta = metaToSave;
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
// Save
// ────────────────────────────────────────────────────────────────
export function saveGameState(ctx: GameContext): { ok: boolean; error?: string } {
  try {
    const playerTr = ctx.player.body.body.translation();
    const cq = ctx.three.camera.quaternion;

    const save: SaveV1 = {
      version: SAVE_VERSION,
      seed: ctx.seed,    // AAI — was hardcoded Tuning.RNG_SEED; now ctx.seed (per-game)
      savedAt: Date.now(),
      bornInDevMode: ctx.flags.devMode,   // ABJ — v11
      player: {
        pos: { x: playerTr.x, y: playerTr.y, z: playerTr.z },
        cameraQuat: { x: cq.x, y: cq.y, z: cq.z, w: cq.w },
        velocityY: ctx.player.velocityY,
        eyeOffset: ctx.player.eyeOffset,
      },
      stats: {
        thirst: ctx.stats.thirst,
        temperature: ctx.stats.temperature,
        hunger: ctx.stats.hunger,
        stamina: ctx.stats.stamina,
        health: ctx.stats.health,
      },
      inventory: {
        slots: ctx.inventory.slots.map(cloneSlot),
        backpack: ctx.inventory.backpack.map(cloneSlot),
        selectedIdx: ctx.inventory.selectedIdx,
        // TT — copy the array so subsequent in-game discoveries can
        // mutate ctx.inventory.discoveredRecipes without affecting
        // the just-written save.
        discoveredRecipes: ctx.inventory.discoveredRecipes.slice(),
        // ABJ — v11: serialize the per-kind journal-read set as an
        // array. Empty array if no journals have been opened.
        journalReadKinds: Array.from(ctx.inventory.journalReadKinds),
      },
      time: {
        dayTime: ctx.time.dayTime,
        daysSurvived: ctx.time.daysSurvived,
        elapsed: ctx.time.elapsed,
      },
      pickupSurvivors: ctx.pickups.list.map((p) => p.id),
      // ABM (B7) — serialize only physics-bodied (= dropped) pickups.
      // Seed-spawned ones (no body) restore from world build naturally.
      droppedPickups: ctx.pickups.list
        .filter((p) => p.body !== null)
        .map((p) => {
          const t = p.body!.translation();
          const r = p.body!.rotation();
          const entry: NonNullable<SaveV1['droppedPickups']>[number] = {
            itemId: p.itemId,
            pos: { x: t.x, y: t.y, z: t.z },
            quat: { x: r.x, y: r.y, z: r.z, w: r.w },
            meta: p.meta ? { ...p.meta } : undefined,
          };
          // ACC P3 — riders: persist sled id + sled-local pose so we
          // can re-promote to kinematic on load without depending on
          // gravity/settle/auto-promote (which would cause a 1-2s
          // visual jitter on each load).
          if (
            p.ridingSledId !== null &&
            p.ridingLocalPos !== undefined &&
            p.ridingLocalQuat !== undefined
          ) {
            entry.ridingSledId = p.ridingSledId;
            entry.ridingLocalPos = {
              x: p.ridingLocalPos.x, y: p.ridingLocalPos.y, z: p.ridingLocalPos.z,
            };
            entry.ridingLocalQuat = {
              x: p.ridingLocalQuat.x, y: p.ridingLocalQuat.y,
              z: p.ridingLocalQuat.z, w: p.ridingLocalQuat.w,
            };
          }
          return entry;
        }),
      cacti: ctx.cacti.list.map((c) => ({ id: c.id, harvested: c.harvested })),
      lizards: ctx.lizards.map((l) => {
        const tr = l.body.translation();
        return {
          id: l.id,
          pos: { x: tr.x, y: tr.y, z: tr.z },
          state: l.state,
          looted: l.looted,
        };
      }),
      // ACL — v14: persist desert shrews (id + world XZ + state). y is
      // re-derived from terrain on load.
      shrews: ctx.shrews.list.map((s) => ({
        id: s.id,
        x: s.pos.x,
        z: s.pos.z,
        state: s.state,
      })),
      // ACAH — v14 additive: rare perched vultures (id + current world pos +
      // state). Looted ones are absent (removed from the list) → on load the
      // boot-spawned twin is removed, mirroring the shrew reconcile.
      vultures: ctx.vultures.list.map((v) => ({
        id: v.id,
        x: v.pos.x,
        y: v.pos.y,
        z: v.pos.z,
        state: v.state,
      })),
      // ACL — v14: persist the sweeping sandstorm-wall state verbatim (plain
      // data; no THREE objects). intensity re-derives from it on first tick.
      weatherWall: { ...ctx.weather.wall },
      raiders: ctx.raiders.map((r) => {
        const tr = r.body.translation();
        return {
          id: r.id,
          pos: { x: tr.x, y: tr.y, z: tr.z },
          state: r.bb.state,
          health: r.health,
          // ACF — persist an in-progress corpse drag (additive).
          ...(r.dragAnchor && r.dragAnchor.kind !== 'none'
            ? { dragAnchor: r.dragAnchor }
            : {}),
        };
      }),
      salvageables: ctx.salvageables.list.map((s) => {
        // ACAX — persist WHICH components are gone (extracted OR condition-surplus)
        // so a reload restores the exact visible set (WYSIWYG), not all of them.
        const comps = (s.panel.userData.panelComponents as Array<{ visible: boolean }> | undefined) ?? [];
        const extractedIndices = comps.flatMap((c, i) => (c.visible ? [] : [i]));
        return { id: s.id, salvageRemaining: s.salvageRemaining, stripped: s.stripped, extractedIndices };
      }),
      lootContainers: ctx.lootContainers.list.map((c) => ({
        id: c.id,
        opened: c.opened,
        contents: c.contents.map((e) => ({ ...e })),
      })),
      fires: ctx.fires.list.map((f) => ({
        id: f.id,
        pos: { x: f.pos.x, y: f.pos.y, z: f.pos.z },
        fuelSeconds: f.fuelSeconds,
        alive: f.alive,
        hasGrill: f.hasGrill,    // AAM — v10 additive
      })),
      crashes: serializeCrashes(),   // ACBE (D1) — v15: landed crash sites

      tents: ctx.tents.list.map((t) => ({
        id: t.id,
        pos: { x: t.pos.x, y: t.pos.y, z: t.pos.z },
        // AAZ-fix — was t.mesh.rotation.y; mesh quaternion now carries
        // terrain-tilt as well, so the decomposed Euler.y no longer
        // matches the pure yaw input. Tent.rotationY is the original
        // yaw passed into spawnTentAt; round-tripping through it
        // preserves the exact deploy orientation across save/load.
        rotationY: t.rotationY,
      })),
      largeTents: ctx.largeTents.list.map((t) => ({
        id: t.id,
        pos: { x: t.pos.x, y: t.pos.y, z: t.pos.z },
        rotationY: t.rotationY,
      })),
      bedrolls: ctx.bedrolls.list.map((b) => ({
        id: b.id,
        pos: { x: b.pos.x, y: b.pos.y, z: b.pos.z },
        rotationY: b.rotationY,
      })),
      lanterns: ctx.lanterns.list.map((l) => ({
        id: l.id,
        pos: { x: l.pos.x, y: l.pos.y, z: l.pos.z },
        rotationY: l.rotationY,
      })),
      lockers: ctx.lockers.list.map((l) => ({
        id: l.id,
        pos: { x: l.pos.x, y: l.pos.y, z: l.pos.z },
        rotationY: l.rotationY,
        contents: l.contents.map((e) => ({ ...e })),
      })),
      companion: ctx.companion ? {
        pos: { x: ctx.companion.pos.x, y: ctx.companion.pos.y, z: ctx.companion.pos.z },
        state: ctx.companion.state,
        // ABJ — v11: persist huddle so a storm-saved game reloads
        // with the companion still tucked. If weather has cleared,
        // huddle re-validates within the first tick and transitions
        // to idle/walking naturally.
        huddleState: ctx.companion.state === 'huddle',
      } : undefined,
      companionAcquired: ctx.flags.companionAcquired,   // M8 ⑩ (C52) — additive, no version bump
      // Escape-pod intro (T0.1) — additive, no version bump. True unless mid-intro (and the
      // menu Save is blocked mid-intro, so a written save always records true).
      introComplete: ctx.intro ? ctx.intro.beat === 'done' : true,
      sleds: ctx.sleds.list.map((s) => {
        const tr = s.body.translation();
        return {
          id: s.id,
          // pos = ground position (subtract the body Y offset back out).
          pos: {
            x: tr.x,
            y: tr.y - 0.08 - Tuning.SLED_HALF_EXTENTS_Y,
            z: tr.z,
          },
          // ACC playtest — read sled.yaw scalar (not group.rotation.y;
          // group quaternion now composes terrain-tilt with yaw, so its
          // Euler.y is no longer a pure yaw).
          rotationY: s.yaw,
          contents: s.contents.map((e) => ({ ...e })),
          tether: s.tether.kind,
          // ACA — round-trip static-pos x/z payload. Only set when kind=static-pos.
          ...(s.tether.kind === 'static-pos'
            ? { tetherX: s.tether.x, tetherZ: s.tether.z }
            : {}),
          // ACC — B1 Phase 2: sledId payload when tether kind === 'sled'.
          // Won't fire under current gameplay (no sled-to-sled tether
          // creation paths), but the union allows it so we round-trip
          // defensively.
          ...(s.tether.kind === 'sled'
            ? { tetherSledId: s.tether.sledId }
            : {}),
          // ACE — B1 Phase 3: stakeId payload when tether kind === 'stake'.
          ...(s.tether.kind === 'stake'
            ? { tetherStakeId: s.tether.stakeId }
            : {}),
          // ACF — B1 Phase 3 follow-up: corpse/carcass id payloads.
          ...(s.tether.kind === 'raider_corpse'
            ? { tetherRaiderId: s.tether.raiderId }
            : {}),
          ...(s.tether.kind === 'sandworm_carcass'
            ? { tetherWormId: s.tether.wormId }
            : {}),
          // ACB P1 — attached locker (mobile storage on sled deck)
          ...(s.attachedLockerId !== null
            ? { attachedLockerId: s.attachedLockerId }
            : {}),
        };
      }),
      // Session ACE — placed iron stakes (B1 Phase 3). Additive field;
      // pre-ACE saves arrive without it and load with an empty list.
      stakes: ctx.stakes.list.map((st) => ({
        id: st.id,
        pos: { x: st.pos.x, y: st.pos.y, z: st.pos.z },
        rotationY: st.rotationY,
      })),
      speeder: ctx.speeder ? (() => {
        const tr = ctx.speeder!.body.translation();
        const rt = ctx.speeder!.body.rotation();
        return {
          pos: { x: tr.x, y: tr.y, z: tr.z },
          rotationQuat: { x: rt.x, y: rt.y, z: rt.z, w: rt.w },
          mounted: ctx.speeder!.mounted,
          headlampOn: ctx.speeder!.headlampOn,
          broken: ctx.speeder!.broken,
        };
      })() : undefined,
      // ACE Tier 2 — v13 multi-worm. Each worm serialized independently
      // with its stable id. Legacy `sandWorm` field is intentionally NOT
      // written (v13 fully migrates); loader is backward-compatible.
      sandWorms: ctx.sandWorms.list.map((w) => ({
        id: w.id,
        state: w.state,
        health: w.health,
        looted: w.looted,
        pos: { x: w.basePos.x, y: w.basePos.y, z: w.basePos.z },
        // ACF — persist an in-progress speeder tow (additive).
        ...(w.dragAnchor && w.dragAnchor.kind !== 'none'
          ? { dragAnchor: w.dragAnchor }
          : {}),
      })),
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `save failed: ${msg}` };
  }
}

// ────────────────────────────────────────────────────────────────
// Load
// ────────────────────────────────────────────────────────────────
export function loadGameState(ctx: GameContext): { ok: boolean; error?: string } {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return { ok: false, error: 'no save to load' };

  let save: SaveV1;
  try {
    save = JSON.parse(raw) as SaveV1;
  } catch {
    return { ok: false, error: 'save file is corrupt' };
  }

  // EE/FF/GG/HH/QQ/TT/XX — accept v1-v7 saves. Schema is forward-only:
  // each new version adds optional fields, so pre-v7 saves load
  // cleanly (missing `sleds` / `largeTents` treated as empty; missing
  // `inventory.discoveredRecipes` seeded with ALL_RECIPE_IDS so
  // pre-TT playtesters keep their recipe knowledge).
  // ABJ — v11 adds 3 optional fields (bornInDevMode + journalReadKinds + companion.huddleState).
  // ACBE — a RANGE check (replaces the explicit chain that stopped at 13 and would have
  // rejected the then-current v14): accept any 1..SAVE_VERSION; reject only garbage / a future
  // version this build doesn't know. Every version is forward-only/additive, so old saves load.
  if (!(save.version >= 1 && save.version <= SAVE_VERSION)) {
    return { ok: false, error: `unsupported save version ${save.version}` };
  }
  // AAM — was `Tuning.RNG_SEED` (legacy from pre-AAI); should be `ctx.seed`
  // (the per-game seed resolved at boot from save.seed via peekSavedSeed,
  // or from pendingSeed, or inline-rolled). Pre-AAM this check almost
  // always failed for any non-1337 saved world.
  if (save.seed !== ctx.seed) {
    return {
      ok: false,
      error: `save was built for a different world (seed ${save.seed}, current ${ctx.seed}) — start a new game`,
    };
  }

  // ── Player body + camera ──
  ctx.player.body.body.setTranslation(save.player.pos, true);
  // ABR P2 — snap 3P camera (no lerp from default boot position to
  // restored player position).
  ctx.player.cameraSnapNextFrame = true;
  ctx.three.camera.position.set(
    save.player.pos.x,
    save.player.pos.y + save.player.eyeOffset,
    save.player.pos.z,
  );
  ctx.three.camera.quaternion.set(
    save.player.cameraQuat.x,
    save.player.cameraQuat.y,
    save.player.cameraQuat.z,
    save.player.cameraQuat.w,
  );
  ctx.player.velocityY = save.player.velocityY;
  ctx.player.eyeOffset = save.player.eyeOffset;
  ctx.player.onGround = false;

  // ── Stats ──
  ctx.stats.thirst = save.stats.thirst;
  ctx.stats.temperature = save.stats.temperature;
  ctx.stats.hunger = save.stats.hunger;
  ctx.stats.stamina = save.stats.stamina;
  ctx.stats.health = save.stats.health;
  ctx.stats.dead = false;

  // ── Inventory (mutate slots in place so cached refs stay valid) ──
  for (let i = 0; i < ctx.inventory.slots.length; i++) {
    const src = save.inventory.slots[i];
    const dst = ctx.inventory.slots[i];
    dst.item = src?.item ?? null;
    dst.count = src?.count ?? 0;
    if (src?.meta) dst.meta = { ...src.meta };
    else delete dst.meta;
  }
  for (let i = 0; i < ctx.inventory.backpack.length; i++) {
    const src = save.inventory.backpack[i];
    const dst = ctx.inventory.backpack[i];
    dst.item = src?.item ?? null;
    dst.count = src?.count ?? 0;
    if (src?.meta) dst.meta = { ...src.meta };
    else delete dst.meta;
  }
  ctx.inventory.selectedIdx = save.inventory.selectedIdx;
  ctx.inventory.hover = null;
  // TT — discoveredRecipes restore. v6+ persists the array. Pre-v6
  // saves (no field) get the full seed set so existing playtesters
  // keep their recipe knowledge.
  if (save.inventory.discoveredRecipes !== undefined) {
    ctx.inventory.discoveredRecipes = save.inventory.discoveredRecipes.slice();
  } else {
    ctx.inventory.discoveredRecipes = ALL_RECIPE_IDS.slice();
  }
  // ABJ — v11: journalReadKinds. Pre-v11 saves arrive without this
  // field; seed an empty set so all journals read as unread.
  ctx.inventory.journalReadKinds.clear();
  if (save.inventory.journalReadKinds) {
    for (const k of save.inventory.journalReadKinds) {
      ctx.inventory.journalReadKinds.add(k);
    }
  }
  // ABJ — v11: bornInDevMode. Restored before any UI badge ticks.
  // Pre-v11 → false (regular game).
  ctx.flags.devMode = save.bornInDevMode === true;

  // ── Time ──
  ctx.time.dayTime = save.time.dayTime;
  ctx.time.daysSurvived = save.time.daysSurvived;
  ctx.time.elapsed = save.time.elapsed;

  // ── Pickups: remove any in the current list whose id is NOT in the
  //    save's survivor set. Captures both "taken since boot" (id is a
  //    seeded id missing from survivors) and "dropped since save"
  //    (id is greater than any seeded id and not in survivors). ──
  const survivorSet = new Set(save.pickupSurvivors);
  // Slice because despawnPickup mutates ctx.pickups.list while we iterate.
  for (const p of ctx.pickups.list.slice()) {
    if (!survivorSet.has(p.id)) {
      despawnPickup(ctx, p);
    }
  }

  // ABM (B7) — restore dropped-item pickups with their physics bodies
  // at the saved transforms. Pre-ABM saves arrive without the field;
  // skip silently in that case. Each entry is re-spawned via
  // spawnDroppedPickup with opts.world so the body is recreated; the
  // initial fall-from-above is overridden by the saved Y so items
  // appear exactly where they settled, not from above.
  if (save.droppedPickups) {
    for (const saved of save.droppedPickups) {
      const p = spawnDroppedPickup(
        ctx.three.scene, ctx.terrain,
        { x: saved.pos.x, z: saved.pos.z },
        saved.itemId as import('../inventory/types.ts').ItemId,
        saved.meta,
        {
          world: ctx.physics.world,
          yOverride: saved.pos.y,
        },
      );
      // Restore exact rotation from save (spawnDroppedPickup's body
      // starts with the spawn position's identity rotation; overwrite).
      if (p.body) {
        p.body.setRotation({ x: saved.quat.x, y: saved.quat.y, z: saved.quat.z, w: saved.quat.w }, true);
        p.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        p.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      // ACC P3 — stash saved riding info on the pickup so the post-sled
      // re-promote pass below can convert it to kinematic. Done as a
      // 2nd pass because sleds aren't loaded yet at this point and
      // promoteSledRider needs a real Sled reference.
      if (
        saved.ridingSledId !== undefined &&
        saved.ridingLocalPos !== undefined &&
        saved.ridingLocalQuat !== undefined
      ) {
        p.ridingSledId = saved.ridingSledId;
        p.ridingLocalPos = new THREE.Vector3(
          saved.ridingLocalPos.x, saved.ridingLocalPos.y, saved.ridingLocalPos.z,
        );
        p.ridingLocalQuat = new THREE.Quaternion(
          saved.ridingLocalQuat.x, saved.ridingLocalQuat.y,
          saved.ridingLocalQuat.z, saved.ridingLocalQuat.w,
        );
      }
      ctx.pickups.list.push(p);
    }
  }

  // ── Cacti: apply harvested visual + untag where saved.harvested is
  //    true. We re-arm the regrowth clock from current elapsed (which is
  //    0 right after a load), so the player gets a fresh DAY_LENGTH_SECONDS
  //    wait before the fruit reappears — they don't get a free
  //    instant-regrow by saving and reloading. ──
  for (const saved of save.cacti) {
    if (!saved.harvested) continue;
    const cactus = ctx.cacti.list.find((c) => c.id === saved.id);
    if (cactus) harvestCactus(cactus, ctx.time.elapsed);
  }

  // ── Lizards: for matched ids restore pos/state/looted. Any lizard
  //    present in ctx but ABSENT from save.lizards was looted before
  //    save and removed from the list — match that by lootLizard'ing
  //    them now. ──
  const savedLizardIds = new Set(save.lizards.map((l) => l.id));
  for (const l of ctx.lizards.slice()) {
    if (!savedLizardIds.has(l.id)) {
      lootLizard(l, ctx);
    }
  }
  for (const saved of save.lizards) {
    const lizard = ctx.lizards.find((l) => l.id === saved.id);
    if (!lizard) continue;
    if (saved.looted) {
      lootLizard(lizard, ctx);
      continue;
    }
    lizard.state = saved.state;
    lizard.pos.set(saved.pos.x, saved.pos.y, saved.pos.z);
    lizard.mesh.position.copy(lizard.pos);
    lizard.body.setNextKinematicTranslation({
      x: saved.pos.x,
      y: saved.pos.y + 0.05,
      z: saved.pos.z,
    });
    if (saved.state === 'dead') applyDeadPose(lizard);
  }

  // ── ACL — Shrews (v14+): match boot-spawned shrews by id and restore
  //    pos/state. Procgen is deterministic from the seeded scatterRand stream,
  //    so the boot list ids/positions already match the same-seed save; this
  //    just snaps any that had wandered + restores state. Pre-v14 saves have
  //    no `shrews` field — boot procgen stands as-is. y re-derives from
  //    terrain (shrews are not persisted with y). ──
  if (save.shrews) {
    // ACR — shrews looted (killed + meat taken) before save were removed from
    // the list, so they're ABSENT from save.shrews → lootShrew them now so boot
    // procgen doesn't respawn them alive (mirrors the lizard restore above).
    const savedShrewIds = new Set(save.shrews.map((s) => s.id));
    for (const s of ctx.shrews.list.slice()) {
      if (!savedShrewIds.has(s.id)) lootShrew(s, ctx);
    }
    for (const saved of save.shrews) {
      const shrew = ctx.shrews.list.find((s) => s.id === saved.id);
      if (!shrew) continue;
      shrew.state = saved.state;
      const gy = ctx.terrain.heightAt(saved.x, saved.z);
      shrew.pos.set(saved.x, gy + 0.04, saved.z);
      shrew.mesh.position.copy(shrew.pos);
      shrew.body.setNextKinematicTranslation({ x: saved.x, y: gy + 0.04, z: saved.z });
      if (saved.state === 'dead') applyDeadShrewPose(shrew);   // ACR — restore dead flop + 'take' tag
    }
  }

  // ── ACAH — Vultures (ACAH+): mirror the shrew reconcile. Boot procgen spawns
  //    the vultures (deterministic ids); apply saved states. Vultures looted/
  //    despawned before save are absent → remove the boot twin. Dead ones
  //    restore at their landed pos + flop/tag; perched/flee re-derive from boot. ──
  if (save.vultures) {
    const savedVultureIds = new Set(save.vultures.map((v) => v.id));
    for (const v of ctx.vultures.list.slice()) {
      if (!savedVultureIds.has(v.id)) lootVulture(v, ctx);
    }
    for (const saved of save.vultures) {
      const v = ctx.vultures.list.find((x) => x.id === saved.id);
      if (!v) continue;
      if (saved.state === 'dead') {
        v.state = 'dead';
        v.pos.set(saved.x, saved.y, saved.z);
        v.mesh.position.copy(v.pos);
        v.body.setNextKinematicTranslation({ x: saved.x, y: saved.y + 0.26, z: saved.z });
        applyDeadVulturePose(v);   // sets landed + side-flop + 'take' tag
      }
      // perched / flee → leave as the boot-spawned perched bird (re-derives).
    }
  }

  // ── ACL — Storm wall (v14+): restore the sweeping sandstorm-wall state
  //    verbatim onto ctx.weather.wall (plain data; no re-derivation needed).
  //    intensity recomputes from the wall on the first updateWeather tick.
  //    Pre-v14 saves keep the dormant wall from createWeather. ──
  if (save.weatherWall) {
    ctx.weather.wall = { ...save.weatherWall };
  }

  // ── Raiders ──
  for (const saved of save.raiders) {
    const raider = ctx.raiders.find((r) => r.id === saved.id);
    if (!raider) continue;
    raider.bb.state = saved.state;
    raider.health = saved.health;
    // ACF — restore an in-progress corpse drag. killDrag resolves the
    // anchor (player / sled) at tick time, so restore order vs sleds
    // doesn't matter.
    if (saved.dragAnchor) raider.dragAnchor = saved.dragAnchor;
    raider.group.position.set(saved.pos.x, saved.pos.y, saved.pos.z);
    raider.body.setTranslation(
      { x: saved.pos.x, y: saved.pos.y, z: saved.pos.z },
      true,
    );
    if (saved.state === 'dead') applyRaiderDeadPose(raider, ctx);
  }

  // ── Salvageables: patch remaining + apply dim if stripped. ──
  for (const saved of save.salvageables) {
    const s = ctx.salvageables.list.find((x) => x.id === saved.id);
    if (!s) continue;
    s.salvageRemaining = saved.salvageRemaining;
    if (saved.stripped) markSalvageStripped(s);
    // ACAX — re-hide the components that were gone at save time (extracted +
    // condition-surplus) so the visible set matches salvageRemaining on reload.
    if (saved.extractedIndices) {
      const comps = (s.panel.userData.panelComponents as Array<{ visible: boolean }> | undefined) ?? [];
      for (const idx of saved.extractedIndices) { if (comps[idx]) comps[idx].visible = false; }
    }
  }

  // ── Loot containers ──
  for (const saved of save.lootContainers) {
    const c = ctx.lootContainers.list.find((x) => x.id === saved.id);
    if (!c) continue;
    c.opened = saved.opened;
    c.contents = saved.contents.map((e) => ({ ...e }));
  }
  ctx.lootContainers.open = null;

  // ── Fires + tents: clear anything placed in this play session, then
  //    re-spawn from the save. Necessary because Continue can be hit
  //    from the death overlay AFTER the player placed more fires/tents
  //    in the playthrough that just ended. ──
  for (const f of ctx.fires.list) {
    ctx.three.scene.remove(f.mesh);
    if (f.shelterZone) removeShelterZone(ctx.shelter, f.shelterZone);
    // AAY-fix — release the pool light so the next spawn can claim it.
    releaseFireLight(ctx, f);
  }
  ctx.fires.list.length = 0;
  for (const t of ctx.tents.list) {
    ctx.three.scene.remove(t.mesh);
    removeShelterZone(ctx.shelter, t.shelterZone);
  }
  ctx.tents.list.length = 0;

  for (const saved of save.fires) {
    const pos = new THREE.Vector3(saved.pos.x, saved.pos.y, saved.pos.z);
    const fire = spawnFireAt(ctx, pos, saved.fuelSeconds, saved.alive);
    // AAM (v10) — re-attach grill if the saved fire had one. Pre-v10
    // saves omit the field; defaults to false (no-op).
    if (saved.hasGrill) {
      attachGrillToFire(ctx, fire);
    }
  }
  for (const saved of save.tents) {
    const pos = new THREE.Vector3(saved.pos.x, saved.pos.y, saved.pos.z);
    spawnTentAt(ctx, pos, saved.rotationY);
  }

  // ── Sleds (Session QQ): clear anything placed in this session, then
  //    re-spawn from the save. Optional field — pre-v5 saves arrive with
  //    `sleds === undefined`. ──
  for (const s of ctx.sleds.list) {
    ctx.three.scene.remove(s.group);
    ctx.physics.world.removeRigidBody(s.body);
    if (s.ropeMesh) {
      ctx.three.scene.remove(s.ropeMesh);
      s.ropeMesh.geometry.dispose();
      // Material is shared (module-level _ropeMaterial in sled.ts) —
      // don't dispose here. Same convention as detachRope.
    }
  }
  // XX — large tents: clear anything placed this session, then re-spawn
  // from the save. Optional field — pre-v7 saves arrive with
  // `largeTents === undefined`.
  for (const lt of ctx.largeTents.list) {
    ctx.three.scene.remove(lt.mesh);
    removeShelterZone(ctx.shelter, lt.shelterZone);
  }
  ctx.largeTents.list.length = 0;
  if (save.largeTents) {
    let maxLargeTentId = 0;
    for (const saved of save.largeTents) {
      const pos = new THREE.Vector3(saved.pos.x, saved.pos.y, saved.pos.z);
      spawnLargeTentAt(ctx, pos, saved.rotationY);
      if (saved.id > maxLargeTentId) maxLargeTentId = saved.id;
    }
    if (maxLargeTentId > 0) setNextLargeTentId(maxLargeTentId);
  }

  // AAC — bedrolls / lanterns / lockers: clear then re-spawn from save.
  // Pre-v8 saves arrive with these fields undefined → default empty.
  for (const b of ctx.bedrolls.list) {
    ctx.three.scene.remove(b.mesh);
    removeShelterZone(ctx.shelter, b.shelterZone);
  }
  ctx.bedrolls.list.length = 0;
  if (save.bedrolls) {
    let maxId = 0;
    for (const saved of save.bedrolls) {
      const pos = new THREE.Vector3(saved.pos.x, saved.pos.y, saved.pos.z);
      spawnBedrollAt(ctx, pos, saved.rotationY);
      if (saved.id > maxId) maxId = saved.id;
    }
    if (maxId > 0) setNextBedrollId(maxId);
  }

  for (const l of ctx.lanterns.list) {
    ctx.three.scene.remove(l.mesh);
    // AAY-fix — release the pool light so the next spawn can claim it.
    releaseLanternLight(ctx, l);
  }
  ctx.lanterns.list.length = 0;
  if (save.lanterns) {
    let maxId = 0;
    for (const saved of save.lanterns) {
      const pos = new THREE.Vector3(saved.pos.x, saved.pos.y, saved.pos.z);
      spawnLanternAt(ctx, pos, saved.rotationY);
      if (saved.id > maxId) maxId = saved.id;
    }
    if (maxId > 0) setNextLanternId(maxId);
  }

  for (const l of ctx.lockers.list) {
    ctx.three.scene.remove(l.mesh);
  }
  ctx.lockers.list.length = 0;
  ctx.lockers.open = null;
  if (save.lockers) {
    let maxId = 0;
    for (const saved of save.lockers) {
      const pos = new THREE.Vector3(saved.pos.x, saved.pos.y, saved.pos.z);
      spawnLockerAt(ctx, pos, saved.rotationY, saved.contents.map((e) => ({ ...e })));
      if (saved.id > maxId) maxId = saved.id;
    }
    if (maxId > 0) setNextLockerId(maxId);
  }

  // AAE — companion. setupOpeningScene's default spawn already placed
  // the companion in the world (singleton). If the save says the player
  // had the pod in inventory (save.companion === undefined for a v9+
  // save AND the inventory already has companion_pod from the slot
  // load above), despawn the default companion. Otherwise (v9+ with
  // companion field, or pre-v9), restore/keep it at the saved position
  // and state.
  const playerHasPod = ctx.inventory.slots.some(s => s.item === 'companion_pod')
                    || ctx.inventory.backpack.some(s => s.item === 'companion_pod');
  if (save.version >= 9 && playerHasPod && save.companion === undefined) {
    // v9+ save with no companion field + pod in inventory → player picked
    // it up before saving. Despawn the just-spawned default companion.
    if (ctx.companion) {
      ctx.three.scene.remove(ctx.companion.group);
      ctx.companion = null;
    }
  } else if (save.version >= 9 && save.companion) {
    // v9+ with companion field → restore exact pos + state.
    if (ctx.companion) {
      ctx.companion.pos.set(save.companion.pos.x, save.companion.pos.y, save.companion.pos.z);
      ctx.companion.group.position.copy(ctx.companion.pos);
      ctx.companion.state = save.companion.state;
      // ABJ — v11: if huddleState was set true at save, force the
      // companion back into 'huddle' even if `state` field would say
      // otherwise (defensive — `state` should already be 'huddle' but
      // we double-confirm). Weather-gated logic re-validates next tick.
      if (save.version >= 11 && save.companion.huddleState === true) {
        ctx.companion.state = 'huddle';
      }
      ctx.companion.stateTimer = 0;
    }
  }
  // Pre-v9 saves: keep the default-spawned companion at the
  // opening-scene location. Player encounters the creature for the
  // first time on this load.

  // M8 ⑩ (C52) — companion-acquired flag. Pre-feature saves omit it → default TRUE
  // so existing players keep their companion (the egg path only gates NEW games). The
  // boot reconcile in main.ts (handoffToGame) uses this to remove the cave egg
  // (acquired) or despawn the boot companion (not yet hatched).
  ctx.flags.companionAcquired = save.companionAcquired ?? true;

  // Session ACE — restore stakes BEFORE sleds, so any sled with a 'stake'
  // tether finds its anchor in ctx.stakes.list when updateSleds runs.
  for (const st of ctx.stakes.list) {
    ctx.three.scene.remove(st.mesh);
  }
  ctx.stakes.list.length = 0;
  if (save.stakes) {
    let maxId = 0;
    for (const saved of save.stakes) {
      const pos = new THREE.Vector3(saved.pos.x, saved.pos.y, saved.pos.z);
      spawnStakeAt(ctx, pos, saved.rotationY, saved.id);
      if (saved.id > maxId) maxId = saved.id;
    }
    if (maxId > 0) setNextStakeId(maxId);
  }

  ctx.sleds.list.length = 0;
  ctx.sleds.open = null;
  if (save.sleds) {
    let maxId = 0;
    for (const saved of save.sleds) {
      const pos = new THREE.Vector3(saved.pos.x, saved.pos.y, saved.pos.z);
      // ACA — reconstruct full SledTether (incl. static-pos x/z payload).
      // ACC — B1 Phase 2: tether is now a RopeEndpoint (sled.ts re-exports
      // it as SledTether for back-compat). 'sled' kind carries a sledId
      // payload; defaults to 'none' if a save somehow recorded a sled-tether
      // without a sledId (shouldn't happen in practice).
      let tether: SledTether;
      if (saved.tether === 'static-pos') {
        tether = { kind: 'static-pos', x: saved.tetherX ?? 0, z: saved.tetherZ ?? 0 };
      } else if (saved.tether === 'sled') {
        tether = saved.tetherSledId !== undefined
          ? { kind: 'sled', sledId: saved.tetherSledId }
          : { kind: 'none' };
      } else if (saved.tether === 'stake') {
        // ACE — B1 Phase 3 stake-tether. Defensive: if the stake-id is
        // missing or the stake was removed before save (shouldn't happen,
        // but guard anyway), fall back to 'none' so the sled survives
        // load without a dangling reference.
        tether = saved.tetherStakeId !== undefined
          ? { kind: 'stake', stakeId: saved.tetherStakeId }
          : { kind: 'none' };
      } else if (saved.tether === 'raider_corpse') {
        // ACF — B1 Phase 3 follow-up. Defensive: if the raider-id is
        // missing, fall back to 'none'. The corpse itself is restored by
        // the raider load path; here we only re-link the sled's tether.
        tether = saved.tetherRaiderId !== undefined
          ? { kind: 'raider_corpse', raiderId: saved.tetherRaiderId }
          : { kind: 'none' };
      } else if (saved.tether === 'sandworm_carcass') {
        tether = saved.tetherWormId !== undefined
          ? { kind: 'sandworm_carcass', wormId: saved.tetherWormId }
          : { kind: 'none' };
      } else {
        tether = { kind: saved.tether };
      }
      const newSled = spawnSledAt(
        ctx,
        pos,
        saved.rotationY,
        saved.contents.map((e) => ({ ...e })),
        tether,
        saved.id,
      );
      // ACB P1 — restore attachedLockerId reference. Re-parenting the
      // locker mesh under sled.group happens in a SECOND pass below,
      // after the lockers list has been populated by the locker-load
      // section (which runs before this one — order matters).
      if (saved.attachedLockerId !== undefined && newSled) {
        newSled.attachedLockerId = saved.attachedLockerId;
      }
      if (saved.id > maxId) maxId = saved.id;
    }
    if (maxId > 0) setNextSledId(maxId);
    // ACB P1 — second pass: re-parent each attached locker under its
    // host sled.group. Done after both sleds + lockers are spawned.
    for (const sled of ctx.sleds.list) {
      if (sled.attachedLockerId === null) continue;
      const lk = ctx.lockers.list.find((l) => l.id === sled.attachedLockerId);
      if (!lk) {
        sled.attachedLockerId = null;   // dangling ref — clear
        continue;
      }
      // Re-parent locker.mesh → sled.group with local-position on deck.
      ctx.three.scene.remove(lk.mesh);
      sled.group.add(lk.mesh);
      const deckTopLocal = 0.06 + Tuning.SLED_HALF_EXTENTS_Y * 2 + 0.04;
      lk.mesh.position.set(0, deckTopLocal, 0);
      lk.mesh.rotation.y = 0;
    }
  }

  // ACC P3 — re-promote saved sled-riding pickups. Done AFTER sleds are
  // loaded so the rider's host sled exists. For each rider:
  //   - find the sled by id; if missing, leave the pickup as dynamic
  //     (it'll fall + settle naturally next frame; auto-promote may
  //     catch it later, or it just becomes a ground pickup);
  //   - if found, switch body to KinematicPositionBased + leave
  //     ridingLocalPos/Quat in place (already restored above) so the
  //     first updateSledRiders tick drives the world transform.
  for (const p of ctx.pickups.list) {
    if (p.ridingSledId === null || p.ridingSledId === undefined) continue;
    if (!p.body) continue;
    const sled = ctx.sleds.list.find((s) => s.id === p.ridingSledId);
    if (!sled) {
      // Dangling reference (host sled was somehow lost). Clear riding
      // state and leave the pickup as dynamic — it'll fall + settle.
      p.ridingSledId = null;
      p.ridingLocalPos = undefined;
      p.ridingLocalQuat = undefined;
      continue;
    }
    p.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
  }

  // ── Sand worms (DD-2 + ACE Tier 2 multi-worm): each worm's saved
  //    state is matched back to its boot-spawned instance. Mid-encounter
  //    sub-states (alert/charging/lunge/stationaryBreach/retreat) collapse
  //    to `patrol` at the saved pos. Dead state restores the corpse pose
  //    at the exact death location.
  //
  //    Save schema migration: v13+ uses `save.sandWorms` (array); pre-v13
  //    saves used `save.sandWorm` (singleton). At this point ctx.sandWorms.list
  //    holds the boot-spawned worms (count from Tuning.SANDWORM_COUNT).
  //    The loader walks the saved entries IN ORDER and applies state to
  //    `ctx.sandWorms.list[i]` (boot-spawn order). Saved id is NOT used
  //    to match — boot ids start from 1 each session and matching by
  //    index keeps the migration simple. If saved count > spawned count,
  //    extras are ignored; if spawned count > saved count, the extras
  //    retain their default boot 'patrol' state.
  type WormRestore = {
    state: SandWormState;
    health: number;
    looted: boolean;
    pos: V3;
    dragAnchor?: SledTether;
  };
  const restoreEntries: WormRestore[] = [];
  if (save.sandWorms) {
    // v13+ canonical path.
    for (const sw of save.sandWorms) {
      restoreEntries.push({
        state: sw.state,
        health: sw.health,
        looted: sw.looted,
        pos: sw.pos,
        dragAnchor: sw.dragAnchor,
      });
    }
  } else if (save.sandWorm) {
    // Pre-v13 singleton — lift into the first slot. Missing `pos` falls
    // back to the boot worm's home anchor.
    const boot0 = ctx.sandWorms.list[0];
    restoreEntries.push({
      state: save.sandWorm.state,
      health: save.sandWorm.health,
      looted: save.sandWorm.looted,
      pos: save.sandWorm.pos ?? (boot0
        ? { x: boot0.home.x, y: boot0.home.y, z: boot0.home.z }
        : { x: 0, y: 0, z: 0 }),
    });
  }
  for (let i = 0; i < restoreEntries.length && i < ctx.sandWorms.list.length; i++) {
    const worm = ctx.sandWorms.list[i];
    const saved = restoreEntries[i];
    worm.health = saved.health;
    worm.looted = saved.looted;
    worm.basePos.set(saved.pos.x, saved.pos.y, saved.pos.z);
    // ACF — restore an in-progress speeder tow (speeder resolved at tick).
    if (saved.dragAnchor) worm.dragAnchor = saved.dragAnchor;
    if (saved.state === 'dead') {
      worm.surfaceGroundY = ctx.terrain.heightAt(worm.basePos.x, worm.basePos.z);
      applySandWormDeadPose(worm);
      if (worm.looted) {
        // Untag — corpse stays but no longer offers an [E] prompt.
        worm.mesh.traverse((o) => {
          delete o.userData.interactType;
          delete o.userData.interactId;
          delete o.userData.interactRegistry;
        });
      }
    } else {
      // Collapse to patrol — neutral state. Mesh hidden, collider parked.
      worm.state = 'patrol';
      worm.pitch = 0;
      worm.mesh.visible = false;
      worm.patrolTheta = Math.atan2(
        worm.basePos.z - worm.home.z,
        worm.basePos.x - worm.home.x,
      );
      worm.basePos.y =
        ctx.terrain.heightAt(worm.basePos.x, worm.basePos.z)
        - Tuning.SANDWORM_UNDERGROUND_DEPTH;
    }
  }

  // ── Speeder: patch position / rotation / mount state from save. The
  //    bike was placed by setupOpeningScene at the default opening spot
  //    on boot — we now move it to where the player parked it. Zero out
  //    velocity so it doesn't drift from whatever physics state was at
  //    save time. ──
  if (save.speeder && ctx.speeder) {
    ctx.speeder.body.setTranslation(save.speeder.pos, true);
    ctx.speeder.body.setRotation(save.speeder.rotationQuat, true);
    ctx.speeder.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    ctx.speeder.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    ctx.speeder.mounted = save.speeder.mounted;
    ctx.speeder.headlampOn = save.speeder.headlampOn;
    // M10 ⑮ (C58) — restore broken state (additive; absent in pre-⑮ saves → not broken,
    // i.e. the proven rideable speeder). updateBrokenSpeeder re-applies the grounded pose.
    ctx.speeder.broken = save.speeder.broken ?? false;
    // Headlamp visual sync — updateSpeeder reads .headlampOn each frame
    // and toggles the SpotLight + emissive disc, so just setting the flag
    // is enough. Same for mounted: the next updateSpeeder applies.
  }

  // Escape-pod intro (T0.1) — defensive: a save is never written mid-intro (the menu Save
  // is blocked while it runs) and Continue never starts the intro, so this is normally a
  // no-op. If a stale save somehow recorded introComplete=false, ensure the loaded game
  // runs normally (no intro). Pre-feature saves omit the field → treated as complete.
  if (save.introComplete === false && ctx.intro) ctx.intro.active = false;

  // ── Reset transients ──
  ctx.flags.damageFlashUntil = 0;

  // ACBE (D1) — STASH the saved crash sites; main.ts onContinue applies them right AFTER
  // handoffToGame (whose resetMeteorCrash clears in-session sites; load runs before that, so
  // restoring here would be wiped). Pre-v15 saves have no `crashes` → an empty stash.
  setPendingCrashRestore(save.crashes ?? []);

  return { ok: true };
}
