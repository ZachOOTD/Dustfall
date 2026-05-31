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
  /** ACH (Cycle 2) — DEV-only: enter gameplay HEADLESS, bypassing the title
   *  button + pointer-lock. The normal handoff only clears `flags.paused` via
   *  the pointer-lock 'lock' event (input.ts), which never fires for an
   *  agent/preview click → the game renders the title-gone scene but never
   *  ticks. This runs the handoff side-effects + sets paused=false directly so
   *  the rAF loop ticks + renders. Pass dev=true to apply the DEV loadout
   *  first. Enables autonomous build→screenshot→critique on visual work. */
  enterGame: (dev?: boolean) => void;
  /** ACI (PM-Cycle A) — visual-audit "studio" for the player model. One call
   *  ensures headless gameplay (enterGame) + a 900×1100 canvas + 3P + EVEN
   *  studio lighting (ambient/key boosted + exposure ~2 — the in-game dusk
   *  hides rig detail). With no `angle`: enters + lights, leaves UNPAUSED so
   *  the rig settles at the body (call again with an angle after a beat).
   *  With an `angle`: pauses + frames that canonical view for a screenshot.
   *  The MVP-check verification loop (docs/feature-player-model.md) drives this. */
  rigStudio: (angle?: 'front' | 'back' | 'left' | 'right' | '3q' | 'head') => unknown;
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

/** Hooks main.ts supplies for actions that need its boot-scope closures
 *  (handoffToGame, applyDevLoadout, the title scene) which aren't reachable
 *  from here. */
export interface DebugHooks {
  enterGame?: (dev?: boolean) => void;
}

export function installDebugPanel(ctx: GameContext, hooks: DebugHooks = {}): void {
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
    enterGame(dev) {
      if (hooks.enterGame) hooks.enterGame(dev);
      else { ctx.flags.titleActive = false; ctx.flags.paused = false; }  // fallback
    },
    rigStudio(angle) {
      // enter + studio setup (idempotent)
      if (hooks.enterGame) hooks.enterGame(true);
      else { ctx.flags.titleActive = false; ctx.flags.paused = false; }
      const three = ctx.three;
      three.renderer.setSize(900, 1100, false);
      const cam = three.camera as THREE.PerspectiveCamera;
      if (cam.isPerspectiveCamera) { cam.aspect = 900 / 1100; cam.updateProjectionMatrix(); }
      ctx.flags.thirdPerson = true;
      three.scene.traverse((o) => {
        const l = o as THREE.Light;
        if (!l.isLight) return;
        if (l.type === 'AmbientLight') l.intensity = 2.2;
        else if (l.type === 'DirectionalLight' && l.intensity > 0) l.intensity = 2.4;
      });
      three.renderer.toneMappingExposure = 2.0;
      if (!angle) {
        return 'studio entered + lit (UNPAUSED to settle the rig — call rigStudio(angle) after a beat to frame)';
      }
      // frame a canonical angle (pause so the 3P sync stops overwriting the camera)
      ctx.flags.paused = true;
      const rig = ctx.player.rig;
      if (!rig) return { angle, framed: false, reason: 'no rig' };
      rig.group.updateMatrixWorld(true);
      const bp = ctx.player.body.body.translation();
      const fwd = new THREE.Vector3();
      rig.headGroup.getWorldPosition(new THREE.Vector3()); // ensure matrices fresh
      rig.headGroup.getWorldDirection(fwd);
      fwd.y = 0;
      if (fwd.lengthSq() < 1e-4) fwd.set(1, 0, 0);
      fwd.normalize();
      const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const body = new THREE.Vector3(bp.x, bp.y - 0.05, bp.z);
      const D = 2.6, UP = 0.35;
      let camPos = new THREE.Vector3();
      let tgt = body.clone();
      if (angle === 'head') {
        const hp = new THREE.Vector3();
        rig.headGroup.getWorldPosition(hp);
        camPos = hp.clone().addScaledVector(fwd, 0.55).addScaledVector(side, 0.22);
        camPos.y += 0.05;
        tgt = new THREE.Vector3(hp.x, hp.y - 0.05, hp.z);
      } else if (angle === 'back') {
        camPos = body.clone().addScaledVector(fwd, -D); camPos.y += UP;
      } else if (angle === 'left') {
        camPos = body.clone().addScaledVector(side, D); camPos.y += UP;
      } else if (angle === 'right') {
        camPos = body.clone().addScaledVector(side, -D); camPos.y += UP;
      } else if (angle === '3q') {
        camPos = body.clone().addScaledVector(fwd, D * 0.8).addScaledVector(side, D * 0.6); camPos.y += UP;
      } else { // 'front'
        camPos = body.clone().addScaledVector(fwd, D); camPos.y += UP;
      }
      cam.position.copy(camPos);
      cam.lookAt(tgt);
      return { angle, framed: true };
    },
    resetTutorial,
    showControls() { showControlsPanel(ctx); },
    audioState: () => getAudioStateSnapshot(ctx),
    musicState: () => getMusicStateSnapshot(),
  };
}
