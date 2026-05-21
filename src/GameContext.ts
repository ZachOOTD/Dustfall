// Single shared context object passed to every system's init/update.
// Adding new slots is how features land — each session extends this.

import type * as THREE from 'three';
import type { InputBundle } from './core/input.ts';
import type { GpuTimer } from './core/gpuTimer.ts';
import type { PhysicsBundle } from './physics/world.ts';
import type { PlayerBody } from './physics/bodies.ts';
import type { Terrain } from './world/terrain.ts';
import type { AssetRegistry } from './assets/loader.ts';
import type { Pickup } from './pickups/pickups.ts';
import type { InventoryState } from './inventory/types.ts';
import type { ShelterRegistry } from './shelter/shelterZones.ts';
import type { Raider } from './enemies/raider.ts';
import type { Weather } from './world/weather.ts';
import type { AmbientDust } from './world/ambientDust.ts';
import type { StormVignette } from './world/stormVignette.ts';
import type { SpeederState } from './world/speeder.ts';
import type { Journal } from './world/journal.ts';
import type { ViewModel } from './player/viewModel.ts';
import type { WaterSource } from './world/waterSources.ts';
import type { Cactus } from './world/cactus.ts';
import type { Lizard } from './enemies/lizard.ts';
import type { SandWorm } from './enemies/sandWorm.ts';
import type { LootContainer } from './world/lootContainers.ts';
import type { Fire } from './world/fire.ts';
import type { Tent } from './world/tent.ts';
import type { Sled } from './world/sled.ts';
import type { LargeTent } from './world/largeTent.ts';
import type { BiomeSampler } from './world/biomes.ts';
import type { SalvageableRegistry } from './world/salvage.ts';
import type { FootprintRegistry } from './world/footprints.ts';

export interface GameContext {
  three: {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    clock: THREE.Clock;
    gpuTimer: GpuTimer;
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
    daysSurvived: number; // increments when dayTime wraps past 1.0 → 0
  };
  stats: {
    thirst: number;        // 0..1
    temperature: number;   // -1..+1, 0 = comfortable, +1 = heatstroke, -1 = freezing
    hunger: number;        // 0..1
    stamina: number;       // 0..1
    health: number;        // 0..1
    dead: boolean;
  };
  input: InputBundle;
  player: {
    eyeOffset: number;     // camera Y above body center (m) — adjusted by crouch
    body: PlayerBody;
    velocityY: number;     // vertical velocity for gravity (m/s)
    onGround: boolean;
    crouching: boolean;    // set each frame from LeftControl
    inShelter: boolean;    // set each frame by shelter system
    viewModel: ViewModel | null;
  };
  pickups: {
    list: Pickup[];
  };
  inventory: InventoryState;
  ui: {
    showToast: (text: string) => void;
    setDeathCause: (cause: string, daysSurvived?: number) => void;
  };
  physics: PhysicsBundle;
  terrain: Terrain;
  biomes: BiomeSampler;
  assets: AssetRegistry;
  shelter: ShelterRegistry;
  raiders: Raider[];
  lizards: Lizard[];
  /** Session DD — single boss-tier sand worm. Null on boots where the worm
   *  hasn't been spawned (shouldn't normally happen — main.ts spawns one). */
  sandWorm: SandWorm | null;
  waterSources: { list: WaterSource[] };
  cacti: { list: Cactus[] };
  lootContainers: { list: LootContainer[]; open: LootContainer | null };
  fires: { list: Fire[] };
  tents: { list: Tent[] };
  /** Session QQ — placed sleds. `open` is the one currently shown in the
   *  loot menu overlay (parallel to lootContainers.open). */
  sleds: { list: Sled[]; open: Sled | null };
  /** Session XX — placed large enterable tents (walk-in shelter). Separate
   *  list from `tents` since they have distinct geometry + interaction
   *  semantics (D80). */
  largeTents: { list: LargeTent[] };
  salvageables: SalvageableRegistry;
  weather: Weather;
  ambientDust: AmbientDust;
  stormVignette: StormVignette;
  speeder: SpeederState | null;       // null until the opening scene spawns it
  footprints: FootprintRegistry;
  journals: { list: Journal[] };
  flags: {
    started: boolean;     // true once the player has clicked into the game
    paused: boolean;      // true while the pause overlay is visible
    /** Wall-clock-elapsed timestamp until which the damage vignette is shown.
     *  Raider hits set this to `ctx.time.elapsed + 0.33`. HUD reads it. */
    damageFlashUntil: number;
    /** Session-CC-3 (animated main menu) — true while the title screen is up.
     *  Render loop routes through a separate title scene + camera; game tick
     *  short-circuits before the pause check. Cleared when NEW GAME pressed. */
    titleActive: boolean;
  };
}

/** True only when the player is actively in the game (pointer locked + alive). */
export function isPlaying(ctx: GameContext): boolean {
  return ctx.input.controls.isLocked && !ctx.stats.dead;
}
