// Single shared context object passed to every system's init/update.
// Adding new slots is how features land — each session extends this.

import type * as THREE from 'three';
import type { InputBundle } from './core/input.ts';
import type { PhysicsBundle } from './physics/world.ts';
import type { PlayerBody } from './physics/bodies.ts';
import type { Terrain } from './world/terrain.ts';
import type { AssetRegistry } from './assets/loader.ts';
import type { Pickup } from './pickups/pickups.ts';
import type { InventoryState } from './inventory/types.ts';
import type { ShelterRegistry } from './shelter/shelterZones.ts';
import type { Raider } from './enemies/raider.ts';
import type { Weather } from './world/weather.ts';

export interface GameContext {
  three: {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    clock: THREE.Clock;
  };
  lights: {
    sun: THREE.DirectionalLight;
    moon: THREE.DirectionalLight;
    ambient: THREE.AmbientLight;
  };
  time: {
    dayTime: number;     // 0..1, 0.25=dawn, 0.5=noon, 0.75=dusk
    sunHeight: number;   // -1..1, refreshed each frame by lighting.update
    sunDir: THREE.Vector3; // unit vector from world origin TOWARD the sun
    elapsed: number;     // wall-clock seconds since boot, for animation phase
  };
  stats: {
    thirst: number;  // 0..1
    heat: number;    // 0..1
    health: number;  // 0..1
    dead: boolean;
  };
  input: InputBundle;
  player: {
    eyeOffset: number;     // camera Y above body center (m)
    body: PlayerBody;
    velocityY: number;     // vertical velocity for gravity (m/s)
    onGround: boolean;
    inShelter: boolean;    // set each frame by shelter system
  };
  pickups: {
    list: Pickup[];
  };
  inventory: InventoryState;
  ui: {
    showToast: (text: string) => void;
    setDeathCause: (cause: string) => void;
  };
  physics: PhysicsBundle;
  terrain: Terrain;
  assets: AssetRegistry;
  shelter: ShelterRegistry;
  raiders: Raider[];
  weather: Weather;
  flags: {
    started: boolean;     // true once the player has clicked into the game
    paused: boolean;      // true while the pause overlay is visible
  };
}

/** True only when the player is actively in the game (pointer locked + alive). */
export function isPlaying(ctx: GameContext): boolean {
  return ctx.input.controls.isLocked && !ctx.stats.dead;
}
