// Debug handles attached to window.__game so MCP preview tools can poke state.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import { spawnRaider as spawnRaiderEntity, damageRaider } from '../enemies/raider.ts';
import { resetTutorial, showControlsPanel } from '../ui/tutorial.ts';
import { getAudioStateSnapshot, type AudioStateSnapshot } from '../audio/soundscape.ts';
import { getMusicStateSnapshot, type MusicStateSnapshot } from '../audio/music.ts';

declare global {
  interface Window {
    __game?: DebugApi;
  }
}

interface DebugApi {
  setTime: (t: number) => void;
  setStats: (s: {
    thirst?: number;
    temperature?: number;
    hunger?: number;
    stamina?: number;
    health?: number;
  }) => void;
  state: () => {
    thirst: number;
    temperature: number;
    hunger: number;
    stamina: number;
    health: number;
    dayTime: number;
    playerDead: boolean;
  };
  ctx: GameContext;
  RAPIER: typeof RAPIER;
  castDown: (x: number, z: number, fromY?: number) => null | {
    hitY: number;
    timeOfImpact: number;
    colliderHandle: number;
    shape: number;
  };
  /** Trigger a sandstorm immediately for testing. */
  triggerStorm: () => void;
  /** ACG (Cycle 1) — DEV-only: spawn a raider at world XZ (terrain Y
   *  auto-sampled) and register it in ctx.raiders. Raiders are dormant by
   *  design (D13 / Pillar 1) — this is a test affordance for exercising the
   *  ACF corpse-drag path, NOT a return of raiders as a world threat.
   *  Returns the new raider's id. */
  spawnRaider: (x: number, z: number) => number;
  /** ACG (Cycle 1) — DEV-only: kill a raider by id (drives the real death
   *  path → dead pose + corpse interaction tag), so the corpse-drag flow is
   *  testable without melee aiming. Returns true if a live raider matched. */
  killRaider: (id: number) => boolean;
  /** Clear the tutorial localStorage flags so the controls panel + all
   *  pickup hints fire again. Refresh to see the first-boot overlay. */
  resetTutorial: () => void;
  /** Open the controls panel from the console — handy for screenshotting. */
  showControls: () => void;
  /** Per-stem audio gains + signal derivations. Null until first click unlocks
   *  audio. Use to tune sample-pack mix levels without re-running. */
  audioState: () => AudioStateSnapshot | null;
  /** AAP — per-track procedural music gains (day / storm / night).
   *  Null until first click unlocks audio. */
  musicState: () => MusicStateSnapshot | null;
}

export function installDebugPanel(ctx: GameContext): void {
  window.__game = {
    setTime: (t) => { ctx.time.dayTime = t; },
    setStats: (s) => {
      if (s.thirst !== undefined) ctx.stats.thirst = s.thirst;
      if (s.temperature !== undefined) ctx.stats.temperature = s.temperature;
      if (s.hunger !== undefined) ctx.stats.hunger = s.hunger;
      if (s.stamina !== undefined) ctx.stats.stamina = s.stamina;
      if (s.health !== undefined) ctx.stats.health = s.health;
    },
    state: () => ({
      thirst: ctx.stats.thirst,
      temperature: ctx.stats.temperature,
      hunger: ctx.stats.hunger,
      stamina: ctx.stats.stamina,
      health: ctx.stats.health,
      dayTime: ctx.time.dayTime,
      playerDead: ctx.stats.dead,
    }),
    ctx,
    RAPIER,
    castDown(x, z, fromY = 100) {
      const ray = new RAPIER.Ray({ x, y: fromY, z }, { x: 0, y: -1, z: 0 });
      const hit = ctx.physics.world.castRay(ray, 500, true);
      if (!hit) return null;
      const hitY = fromY - hit.timeOfImpact;
      return {
        hitY,
        timeOfImpact: hit.timeOfImpact,
        colliderHandle: hit.collider.handle,
        shape: hit.collider.shape.type,
      };
    },
    triggerStorm() {
      ctx.weather.state = 'building';
      ctx.weather.stateTimer = 0;
    },
    spawnRaider(x, z) {
      const r = spawnRaiderEntity(
        ctx.three.scene, ctx.physics.world, ctx.terrain, ctx.assets,
        new THREE.Vector3(x, 0, z),
      );
      ctx.raiders.push(r);
      return r.id;
    },
    killRaider(id) {
      const r = ctx.raiders.find((rr) => rr.id === id);
      if (!r || r.bb.state === 'dead') return false;
      damageRaider(r, 9999, ctx);  // drives transitionTo('dead') + applyRaiderDeadPose
      return true;
    },
    resetTutorial,
    showControls() { showControlsPanel(ctx); },
    audioState: () => getAudioStateSnapshot(ctx),
    musicState: () => getMusicStateSnapshot(),
  };
}
