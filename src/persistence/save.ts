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
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import type { Slot } from '../inventory/types.ts';
import { ALL_RECIPE_IDS } from '../inventory/recipeDiscovery.ts';
import type { LootEntry } from '../world/lootContainers.ts';

import { despawnPickup } from '../pickups/pickups.ts';
import { harvestCactus } from '../world/cactus.ts';
import { markSalvageStripped } from '../world/salvage.ts';
import {
  applyDeadPose,
  lootLizard,
  type LizardState,
} from '../enemies/lizard.ts';
import {
  applyRaiderDeadPose,
  type RaiderState,
} from '../enemies/raider.ts';
import {
  applySandWormDeadPose,
  type SandWormState,
} from '../enemies/sandWorm.ts';
import { spawnFireAt } from '../world/fire.ts';
import { spawnTentAt } from '../world/tent.ts';
import { spawnSledAt, setNextSledId } from '../world/sled.ts';
import { spawnLargeTentAt, setNextLargeTentId } from '../world/largeTent.ts';
import { spawnBedrollAt, setNextBedrollId } from '../world/bedroll.ts';
import { spawnLanternAt, setNextLanternId } from '../world/lantern.ts';
import { spawnLockerAt, setNextLockerId } from '../world/locker.ts';
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
// in the inventory serialization captures that state. Loader accepts
// v1-v9.
export const SAVE_VERSION = 9;

type V3 = { x: number; y: number; z: number };

export interface SaveV1 {
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  seed: number;
  savedAt: number;

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
  };

  time: {
    dayTime: number;
    daysSurvived: number;
    elapsed: number;
  };

  // Seeded entities — list current state by id. Missing ids = consumed/looted.
  pickupSurvivors: number[];
  cacti: Array<{ id: number; harvested: boolean }>;
  lizards: Array<{ id: number; pos: V3; state: LizardState; looted: boolean }>;
  raiders: Array<{ id: number; pos: V3; state: RaiderState; health: number }>;
  salvageables: Array<{ id: number; salvageRemaining: number; stripped: boolean }>;
  lootContainers: Array<{ id: number; opened: boolean; contents: LootEntry[] }>;

  // Player-placed — recreated from scratch on load.
  fires: Array<{ id: number; pos: V3; fuelSeconds: number; alive: boolean }>;
  tents: Array<{ id: number; pos: V3; rotationY: number }>;
  /** Session QQ — placed sleds with their cargo + tether state. Optional
   *  so pre-v5 saves still load (sleds field is just absent). */
  sleds?: Array<{
    id: number;
    pos: V3;
    rotationY: number;
    contents: LootEntry[];
    tether: 'none' | 'player' | 'speeder';
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
  };

  /** Hover speeder pose. Optional so v1 saves written before this field
   *  was added still load cleanly (the speeder just stays at the default
   *  position from setupOpeningScene). */
  speeder?: {
    pos: V3;
    rotationQuat: { x: number; y: number; z: number; w: number };
    mounted: boolean;
    headlampOn: boolean;
  };

  /** Sand worm — DD-2 (roaming). `pos` is the worm's current basePos at
   *  save time. Mid-encounter sub-states collapse to `patrol` on load
   *  (too brittle to restore mid-arc). If saved state is `dead`, the
   *  corpse is restored at that exact pos.
   *
   *  Pre-DD-2 saves lack `pos` — handled in loadGameState by falling
   *  back to the home anchor. */
  sandWorm?: {
    state: SandWormState;
    health: number;
    looted: boolean;
    pos?: V3;
  };
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
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
      seed: Tuning.RNG_SEED,
      savedAt: Date.now(),
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
      },
      time: {
        dayTime: ctx.time.dayTime,
        daysSurvived: ctx.time.daysSurvived,
        elapsed: ctx.time.elapsed,
      },
      pickupSurvivors: ctx.pickups.list.map((p) => p.id),
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
      raiders: ctx.raiders.map((r) => {
        const tr = r.body.translation();
        return {
          id: r.id,
          pos: { x: tr.x, y: tr.y, z: tr.z },
          state: r.bb.state,
          health: r.health,
        };
      }),
      salvageables: ctx.salvageables.list.map((s) => ({
        id: s.id,
        salvageRemaining: s.salvageRemaining,
        stripped: s.stripped,
      })),
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
      })),
      tents: ctx.tents.list.map((t) => ({
        id: t.id,
        pos: { x: t.pos.x, y: t.pos.y, z: t.pos.z },
        rotationY: t.mesh.rotation.y,
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
      } : undefined,
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
          rotationY: s.group.rotation.y,
          contents: s.contents.map((e) => ({ ...e })),
          tether: s.tether.kind,
        };
      }),
      speeder: ctx.speeder ? (() => {
        const tr = ctx.speeder!.body.translation();
        const rt = ctx.speeder!.body.rotation();
        return {
          pos: { x: tr.x, y: tr.y, z: tr.z },
          rotationQuat: { x: rt.x, y: rt.y, z: rt.z, w: rt.w },
          mounted: ctx.speeder!.mounted,
          headlampOn: ctx.speeder!.headlampOn,
        };
      })() : undefined,
      sandWorm: ctx.sandWorm ? {
        state: ctx.sandWorm.state,
        health: ctx.sandWorm.health,
        looted: ctx.sandWorm.looted,
        pos: {
          x: ctx.sandWorm.basePos.x,
          y: ctx.sandWorm.basePos.y,
          z: ctx.sandWorm.basePos.z,
        },
      } : undefined,
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
  if (save.version !== 1 && save.version !== 2 && save.version !== 3 && save.version !== 4 && save.version !== 5 && save.version !== 6 && save.version !== 7 && save.version !== 8 && save.version !== 9) {
    return { ok: false, error: `unsupported save version ${save.version}` };
  }
  if (save.seed !== Tuning.RNG_SEED) {
    return {
      ok: false,
      error: `save was built for a different world (seed ${save.seed}, current ${Tuning.RNG_SEED}) — start a new game`,
    };
  }

  // ── Player body + camera ──
  ctx.player.body.body.setTranslation(save.player.pos, true);
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

  // ── Raiders ──
  for (const saved of save.raiders) {
    const raider = ctx.raiders.find((r) => r.id === saved.id);
    if (!raider) continue;
    raider.bb.state = saved.state;
    raider.health = saved.health;
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
  }
  ctx.fires.list.length = 0;
  for (const t of ctx.tents.list) {
    ctx.three.scene.remove(t.mesh);
    removeShelterZone(ctx.shelter, t.shelterZone);
  }
  ctx.tents.list.length = 0;

  for (const saved of save.fires) {
    const pos = new THREE.Vector3(saved.pos.x, saved.pos.y, saved.pos.z);
    spawnFireAt(ctx, pos, saved.fuelSeconds, saved.alive);
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
      ctx.companion.stateTimer = 0;
    }
  }
  // Pre-v9 saves: keep the default-spawned companion at the
  // opening-scene location. Player encounters the creature for the
  // first time on this load.

  ctx.sleds.list.length = 0;
  ctx.sleds.open = null;
  if (save.sleds) {
    let maxId = 0;
    for (const saved of save.sleds) {
      const pos = new THREE.Vector3(saved.pos.x, saved.pos.y, saved.pos.z);
      spawnSledAt(
        ctx,
        pos,
        saved.rotationY,
        saved.contents.map((e) => ({ ...e })),
        { kind: saved.tether },
        saved.id,
      );
      if (saved.id > maxId) maxId = saved.id;
    }
    if (maxId > 0) setNextSledId(maxId);
  }

  // ── Sand worm (DD-2): worm now roams, so we restore its saved XZ.
  //    Mid-encounter sub-states (alert/charging/lunge/stationaryBreach/
  //    retreat) collapse to `patrol` at the saved pos. Dead state
  //    restores the corpse pose at the exact death location. ──
  if (save.sandWorm && ctx.sandWorm) {
    const worm = ctx.sandWorm;
    const savedState = save.sandWorm.state;
    worm.health = save.sandWorm.health;
    worm.looted = save.sandWorm.looted;
    // Restore XZ — falls back to home anchor for pre-DD-2 saves missing pos.
    if (save.sandWorm.pos) {
      worm.basePos.set(save.sandWorm.pos.x, save.sandWorm.pos.y, save.sandWorm.pos.z);
    } else {
      worm.basePos.set(worm.home.x, worm.home.y, worm.home.z);
    }
    if (savedState === 'dead') {
      worm.surfaceGroundY = ctx.terrain.heightAt(worm.basePos.x, worm.basePos.z);
      applySandWormDeadPose(worm);
      if (worm.looted) {
        // Untag — corpse stays in world but no longer offers an [E] prompt.
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
      // Snap Y to under-sand level at the restored XZ.
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
    // Headlamp visual sync — updateSpeeder reads .headlampOn each frame
    // and toggles the SpotLight + emissive disc, so just setting the flag
    // is enough. Same for mounted: the next updateSpeeder applies.
  }

  // ── Reset transients ──
  ctx.flags.damageFlashUntil = 0;

  return { ok: true };
}
