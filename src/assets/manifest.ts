// Asset manifest: declarative list of GLB models we want to load.
//
// To use real low-poly models, download a CC0 pack (e.g. Kenney "Survival Kit"
// from https://kenney.nl/assets/survival-kit) and drop the .glb files into
// public/models/kenney/, renamed to match the URLs below.
//
// Until those files exist the loader silently falls back to the primitive
// geometry baked into landmarks.ts / pickups.ts — gameplay still works.

import type * as THREE from 'three';

export type ColliderHint = 'box' | 'convex' | 'capsule' | 'cylinder' | 'none';
export type LandmarkKind = 'rock' | 'dead_tree' | 'wreckage' | 'mesa';

export interface AssetDef {
  id: string;
  url: string;            // path under /public
  scale?: number;         // uniform scale applied at clone time
  yOffset?: number;       // additive Y shift after placement (model origin fix)
  colliderHint: ColliderHint;
  /** Optional tag so landmark scatter can pull a variant pool. */
  kind?: LandmarkKind | 'pickup_canteen';
  /** Whether this asset is rigged + animated (use SkeletonUtils.clone). */
  animated?: boolean;
}

export const ASSET_MANIFEST: AssetDef[] = [
  // Rocks — Kenney "Survival Kit" has several rock variants
  { id: 'rock_small_a', url: '/models/kenney/rock_small_a.glb', colliderHint: 'convex', kind: 'rock' },
  { id: 'rock_small_b', url: '/models/kenney/rock_small_b.glb', colliderHint: 'convex', kind: 'rock' },
  { id: 'rock_large_a', url: '/models/kenney/rock_large_a.glb', colliderHint: 'convex', kind: 'rock' },
  { id: 'rock_large_b', url: '/models/kenney/rock_large_b.glb', colliderHint: 'convex', kind: 'rock' },

  // Dead trees / cacti
  { id: 'dead_tree_a', url: '/models/kenney/dead_tree_a.glb', colliderHint: 'cylinder', kind: 'dead_tree' },
  { id: 'dead_tree_b', url: '/models/kenney/dead_tree_b.glb', colliderHint: 'cylinder', kind: 'dead_tree' },

  // Wreckage
  { id: 'wreckage_car_a', url: '/models/kenney/wreckage_car_a.glb', colliderHint: 'box', kind: 'wreckage' },
  { id: 'wreckage_barrel', url: '/models/kenney/wreckage_barrel.glb', colliderHint: 'cylinder', kind: 'wreckage' },

  // Mesa-like silhouettes
  { id: 'mesa_a', url: '/models/kenney/mesa_a.glb', colliderHint: 'convex', kind: 'mesa' },

  // Pickups
  { id: 'canteen', url: '/models/kenney/canteen.glb', colliderHint: 'box', kind: 'pickup_canteen' },
];

export interface LoadedAsset {
  def: AssetDef;
  /** The root group from the GLB. Null if the file failed to load. */
  scene: THREE.Group | null;
  /** Optional animations. */
  animations: THREE.AnimationClip[];
}
