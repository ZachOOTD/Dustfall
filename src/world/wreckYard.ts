// Wreck-yard graveyard POI (Cycle 8 / Session ACAQ).
//
// The dense crashed-fleet graveyard that fills the rare `wreck_yard` biome
// region (one per seed; the anchor comes from ctx.biomes.wreckYardAnchor). A
// packed field of deeply-buried corroded procgen wrecks + a few big tilted hand-
// wreck silhouettes + ribcage bone-fields (carcass anchors for the vulture
// ecology) + heavy scattered debris. The Sarlacc pit (Y4) is placed separately
// at the center. Every wreck self-merges (placeProcgenComposite/placeWreck), so
// the field stays draw-call-sane despite the density (perf-probe gate in Y6).

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { SalvageableRegistry } from './salvage.ts';
import { placeProcgenComposite } from './procgenWreck.ts';
import { placeWreck, placeDebrisField, type WreckKind } from './wrecks.ts';
import { placeRibcage } from './heroLandmarks.ts';
import { Tuning } from '../config/tuning.ts';

const BIG_KINDS: ReadonlyArray<WreckKind> = ['engine_cluster', 'fuselage', 'cargo_container'];

/** Place the dense wreck-yard graveyard centered on `anchor` within `radius`.
 *  Returns the ribcage carcass positions (for the vulture ecology, Y5). */
export function placeWreckYard(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  rand: Rng,
  anchor: { x: number; z: number },
  radius: number,
  salvageables: SalvageableRegistry | undefined,
): THREE.Vector3[] {
  const cx = anchor.x, cz = anchor.z;
  const placed: Array<{ x: number; z: number }> = [];
  const carcasses: THREE.Vector3[] = [];

  // Loose min-separation so the field reads as a packed-but-distinct pile of
  // hulks (a little overlap is characterful; too much z-fights).
  const tryPos = (maxR: number, minSep: number, centerBias: number, minR = 0): { x: number; z: number } | null => {
    for (let t = 0; t < 12; t++) {
      // centerBias>0 packs toward the middle (rand^bias); 0.5 = even-area.
      // minR keeps a central clearing (for the Sarlacc pit centerpiece, Y4).
      const r = minR + (maxR - minR) * Math.pow(rand(), centerBias);
      const a = rand() * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      let ok = true;
      for (const p of placed) {
        const dx = x - p.x, dz = z - p.z;
        if (dx * dx + dz * dz < minSep * minSep) { ok = false; break; }
      }
      if (ok) { placed.push({ x, z }); return { x, z }; }
    }
    return null;   // saturated — skip this one
  };

  // ── 1. Dense procgen wreck field — deeply buried, corroded/skeletal hulks. ──
  const wreckN = Tuning.WRECK_YARD_WRECK_COUNT_MIN
    + Math.floor(rand() * (Tuning.WRECK_YARD_WRECK_COUNT_MAX - Tuning.WRECK_YARD_WRECK_COUNT_MIN + 1));
  for (let i = 0; i < wreckN; i++) {
    const pos = tryPos(radius * 0.92, 5.0, 0.7, Tuning.WRECK_YARD_PIT_CLEARING);   // pack toward center, clear the pit
    if (!pos) continue;
    const y = terrain.heightAt(pos.x, pos.z);
    placeProcgenComposite(scene, world, terrain, new THREE.Vector3(pos.x, y, pos.z), rand, salvageables, {
      buryY: 0.5 + rand() * 0.55,        // deep ancient burial
      biome: 'wreck_yard',
    });
  }

  // ── 2. A few BIG tilted hand-wreck silhouettes (the graveyard's skyline). ──
  const bigN = Tuning.WRECK_YARD_BIG_COUNT_MIN
    + Math.floor(rand() * (Tuning.WRECK_YARD_BIG_COUNT_MAX - Tuning.WRECK_YARD_BIG_COUNT_MIN + 1));
  for (let i = 0; i < bigN; i++) {
    const pos = tryPos(radius * 0.7, 14.0, 0.5, Tuning.WRECK_YARD_PIT_CLEARING + 6);
    if (!pos) continue;
    const y = terrain.heightAt(pos.x, pos.z);
    const kind = BIG_KINDS[Math.floor(rand() * BIG_KINDS.length)];
    const group = placeWreck(scene, world, terrain, new THREE.Vector3(pos.x, y, pos.z), kind, rand, {
      scale: 1.3 + rand() * 0.6,
      buryY: 0.4 + rand() * 0.5,
      tiltZ: (rand() - 0.5) * 0.6,        // heavy crash tilt — keeled over
      tiltX: (rand() - 0.5) * 0.35,
    });
    if (salvageables) {
      // registered by the caller via the group's panels (placeWreck builds them);
      // wreck-yard exclusive loot wiring lands in Y3.
      void group;
    }
  }

  // ── 3. Bone-fields — ribcages scattered as carcass anchors. ──
  const boneN = Tuning.WRECK_YARD_BONE_COUNT_MIN
    + Math.floor(rand() * (Tuning.WRECK_YARD_BONE_COUNT_MAX - Tuning.WRECK_YARD_BONE_COUNT_MIN + 1));
  for (let i = 0; i < boneN; i++) {
    const pos = tryPos(radius * 0.85, 6.0, 0.5, Tuning.WRECK_YARD_PIT_CLEARING * 0.7);
    if (!pos) continue;
    const y = terrain.heightAt(pos.x, pos.z);
    placeRibcage(scene, world, new THREE.Vector3(pos.x, y, pos.z), rand);
    carcasses.push(new THREE.Vector3(pos.x, y, pos.z));
  }

  // ── 4. Heavy debris scatter across the floor. ──
  placeDebrisField(scene, terrain, new THREE.Vector3(cx, 0, cz), radius * 0.8, rand, 36 + Math.floor(rand() * 16));

  return carcasses;
}
