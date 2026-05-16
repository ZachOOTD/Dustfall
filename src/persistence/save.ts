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
import { spawnFireAt } from '../world/fire.ts';
import { spawnTentAt } from '../world/tent.ts';
import { removeShelterZone } from '../shelter/shelterZones.ts';

export const SAVE_KEY = 'dustfall.save.v1';
export const SAVE_VERSION = 1;

type V3 = { x: number; y: number; z: number };

export interface SaveV1 {
  version: 1;
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

  /** Hover speeder pose. Optional so v1 saves written before this field
   *  was added still load cleanly (the speeder just stays at the default
   *  position from setupOpeningScene). */
  speeder?: {
    pos: V3;
    rotationQuat: { x: number; y: number; z: number; w: number };
    mounted: boolean;
    headlampOn: boolean;
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
  if (s.meta) out.meta = { ...s.meta };
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

  if (save.version !== SAVE_VERSION) {
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

  // ── Cacti: apply harvested visual + untag where saved.harvested is true. ──
  for (const saved of save.cacti) {
    if (!saved.harvested) continue;
    const cactus = ctx.cacti.list.find((c) => c.id === saved.id);
    if (cactus) harvestCactus(cactus);
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
