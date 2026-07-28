// Session AAY-fix — pre-allocated PointLight pool.
//
// Problem: Three.js recompiles every lit material's shader program
// when the count of lights in the scene changes — the renderer's
// `lightsHash` bumps whenever a light is added or removed, and every
// material with lighting (terrain shader, fabric shader, wrecks, sand,
// rocks, tents, sand worm, etc.) gets marked needsUpdate. For Dustfall
// post-AAY this caused a multi-hundred-ms freeze every time the player
// placed a fire or a lantern, with ~30 unique materials in view.
//
// Fix: pre-allocate a fixed pool of PointLights at boot, parked
// invisible (intensity=0, position below the world). Dynamic light
// consumers (fires, lanterns, future torches) claim a free light from
// the pool and configure its color / distance / decay / position /
// intensity. Release returns it to the parked state. The scene's
// light count NEVER changes after boot → no shader recompile on
// placement.
//
// Pool size budget: cover the worst-case simultaneous-active count
// across all consumers. For Dustfall:
//   - Fires: ~6-8 placed simultaneously (active + dead embers)
//   - Lanterns: ~4-6 placed simultaneously
//   - Future torches / muzzle flashes / etc.: ~2-4
//   - Buffer: round up
// Total: ~20-24. Pool size 24 leaves comfortable headroom.
//
// Pool lights are SCENE-DIRECT children (not parented to consumer
// entity groups). Reason: removing a light from the scene reduces
// lightsHash too — same recompile bug. By keeping pool lights
// permanently in the scene, the count is fixed forever after the pool
// is built.

import * as THREE from 'three';

export interface LightPool {
  readonly lights: THREE.PointLight[];
  readonly inUse: boolean[];
}

const PARK_Y = -10000;

/** Create the pool. Call ONCE at boot, BEFORE any consumer might want
 *  to claim a light (fires, lanterns). Lights are added to the scene
 *  immediately so they participate in the initial shader compile;
 *  subsequent claims don't change the scene's light count. */
export function createLightPool(scene: THREE.Scene, size: number): LightPool {
  const lights: THREE.PointLight[] = [];
  const inUse: boolean[] = [];
  for (let i = 0; i < size; i++) {
    // Default constructor args are placeholders — claimers reset them.
    // Intensity=0 keeps the parked light from contributing to lighting.
    const light = new THREE.PointLight(0xffffff, 0, 1, 1);
    light.position.set(0, PARK_Y, 0);
    light.castShadow = false;
    scene.add(light);
    lights.push(light);
    inUse.push(false);
  }
  return { lights, inUse };
}

/** Claim a free light. Returns null if the pool is exhausted; callers
 *  should fall back gracefully (the visual effect simply has no
 *  illumination contribution, not a hard error). The caller is
 *  responsible for setting color / distance / decay / position /
 *  intensity after claiming — pool just hands off ownership.
 *
 *  Pool growth: if `null` returns become frequent, bump the size in
 *  main.ts. There's no automatic grow path because that would defeat
 *  the purpose (each grow = lights-hash bump = shader recompile). */
export function claimLight(pool: LightPool): THREE.PointLight | null {
  for (let i = 0; i < pool.lights.length; i++) {
    if (!pool.inUse[i]) {
      pool.inUse[i] = true;
      return pool.lights[i];
    }
  }
  // eslint-disable-next-line no-console
  console.warn('[lightPool] exhausted — increase pool size in main.ts');
  return null;
}

/** DEEPER cycle 11 — is a slot available WITHOUT taking it? Lets a consumer refuse up front and
 *  tell the player why, instead of claiming, getting `null`, and materialising something that looks
 *  like a light but isn't one. */
export function hasFreeLight(pool: LightPool): boolean {
  for (let i = 0; i < pool.inUse.length; i++) if (!pool.inUse[i]) return true;
  return false;
}

/** Release a previously-claimed light back to the pool. Resets
 *  intensity to 0 + parks below the world. Safe to call with `null`
 *  (no-op) so callers don't need to guard the optional-light case. */
export function releaseLight(pool: LightPool, light: THREE.PointLight | null): void {
  if (!light) return;
  for (let i = 0; i < pool.lights.length; i++) {
    if (pool.lights[i] === light) {
      pool.inUse[i] = false;
      light.intensity = 0;
      light.position.set(0, PARK_Y, 0);
      return;
    }
  }
}
