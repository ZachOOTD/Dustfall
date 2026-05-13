// GLTF preloader. Loads everything in the manifest in parallel and returns a
// registry that landmarks/pickups can query by id. Missing files are tolerated
// — their entry resolves with scene: null and consumers can fall back to a
// primitive.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  ASSET_MANIFEST,
  type AssetDef,
  type LoadedAsset,
  type LandmarkKind,
} from './manifest.ts';

export type AssetRegistry = {
  /** Lookup by id. Returns undefined if unknown. */
  get: (id: string) => LoadedAsset | undefined;
  /** All loaded variants for a given landmark kind (filters out failed loads). */
  pool: (kind: LandmarkKind | 'pickup_canteen') => LoadedAsset[];
  /** True if at least one asset successfully loaded. */
  anyLoaded: boolean;
};

/**
 * Preloads every asset in the manifest. Resolves to a registry even if some
 * (or all) files are missing — caller decides whether to fall back to
 * primitives per-spawn.
 *
 * @param onProgress called with (loaded, total) as each asset settles.
 */
export async function preloadAssets(
  manifest: AssetDef[] = ASSET_MANIFEST,
  onProgress?: (loaded: number, total: number) => void,
): Promise<AssetRegistry> {
  const loader = new GLTFLoader();
  const byId = new Map<string, LoadedAsset>();
  let loaded = 0;

  await Promise.all(
    manifest.map(async (def) => {
      let entry: LoadedAsset;
      try {
        const gltf = await loader.loadAsync(def.url);
        entry = { def, scene: gltf.scene, animations: gltf.animations };
      } catch {
        // Silently fall back — primitive geometry will be used for this kind.
        entry = { def, scene: null, animations: [] };
      }
      byId.set(def.id, entry);
      loaded++;
      onProgress?.(loaded, manifest.length);
    }),
  );

  const anyLoaded = [...byId.values()].some((e) => e.scene !== null);

  return {
    get: (id) => byId.get(id),
    pool: (kind) => [...byId.values()].filter((e) => e.def.kind === kind && e.scene !== null),
    anyLoaded,
  };
}

/**
 * Clone a loaded asset's scene for placement. Use SkeletonUtils.clone for
 * rigged/animated assets so each instance has its own skeleton (essential
 * for the raider in Session D).
 */
export function cloneAsset(asset: LoadedAsset): THREE.Group | null {
  if (!asset.scene) return null;
  const clone = asset.def.animated
    ? (SkeletonUtils.clone(asset.scene) as THREE.Group)
    : (asset.scene.clone(true) as THREE.Group);
  if (asset.def.scale !== undefined) {
    clone.scale.setScalar(asset.def.scale);
  }
  if (asset.def.yOffset !== undefined) {
    clone.position.y += asset.def.yOffset;
  }
  return clone;
}
