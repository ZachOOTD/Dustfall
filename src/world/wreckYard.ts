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
import { registerSalvageable, type SalvageableRegistry } from './salvage.ts';   // ACAS A4 — register big-wreck panels as loot
import { pruneBuriedPanels } from './procgenWreck.ts';
import { placeProcgenPOI } from './poiAssembler.ts';
import { addHorizonSilhouette } from './horizonSilhouettes.ts';   // M3 — yard hulks register as sun occluders (shade)
import { placeWreck, placeDebrisField, type WreckKind } from './wrecks.ts';
import { placeRibcage } from './heroLandmarks.ts';
import { mergeStaticByMaterial } from './wreckForms.ts';
import { Tuning } from '../config/tuning.ts';

// 2026-07-09 (user request) — 'engine_cluster' dropped (thruster-on-a-box read the user disliked).
const BIG_KINDS: ReadonlyArray<WreckKind> = ['fuselage', 'cargo_container'];

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
  // ACAU (D208) — mark where this yard's salvageables begin so we can cluster-
  // prune just them after the yard-level merge (below). Per-wreck self-pruning
  // inside placeProcgenComposite can't see a panel buried behind a NEIGHBOURING
  // wreck — only a raycast against the whole merged yard can.
  const startIdx = salvageables ? salvageables.list.length : 0;
  // Y6 perf — all wreck groups are re-parented into ONE yard group + merged at the
  // end (the D198 cluster-merge), collapsing ~30 already-merged wrecks → a handful
  // of draw calls. Panels (accessPanel) stay live (the merge skips them).
  const yardGroup = new THREE.Group();
  yardGroup.name = 'wreckYard';
  scene.add(yardGroup);

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
    const pos = tryPos(radius * 0.92, 5.0, 0.7);   // pack toward center (the pit moved to its own dune anchor)
    if (!pos) continue;
    const y = terrain.heightAt(pos.x, pos.z);
    const hulk = placeProcgenPOI(scene, world, terrain, new THREE.Vector3(pos.x, y, pos.z), rand, salvageables, {
      buryY: 0.5 + rand() * 0.55,        // deep ancient burial (ship delegate only)
      biome: 'wreck_yard',
      parent: yardGroup,   // ACAS A1 — the POI AND its sand mound land in the yard merge
    });
    addHorizonSilhouette(scene, new THREE.Box3().setFromObject(hulk));   // M3 — yard hulks cast shade (post-placement bbox, no rand)
  }

  // ── 2. A few BIG tilted hand-wreck silhouettes (the graveyard's skyline). ──
  const bigN = Tuning.WRECK_YARD_BIG_COUNT_MIN
    + Math.floor(rand() * (Tuning.WRECK_YARD_BIG_COUNT_MAX - Tuning.WRECK_YARD_BIG_COUNT_MIN + 1));
  for (let i = 0; i < bigN; i++) {
    const pos = tryPos(radius * 0.7, 14.0, 0.5);
    if (!pos) continue;
    const y = terrain.heightAt(pos.x, pos.z);
    const kind = BIG_KINDS[Math.floor(rand() * BIG_KINDS.length)];
    const group = placeWreck(scene, world, terrain, new THREE.Vector3(pos.x, y, pos.z), kind, rand, {
      scale: 1.3 + rand() * 0.6,
      buryY: 0.4 + rand() * 0.5,
      tiltZ: (rand() - 0.5) * 0.6,        // heavy crash tilt — keeled over
      tiltX: (rand() - 0.5) * 0.35,
    });
    yardGroup.attach(group);   // re-parent for the yard-level merge
    // ACAS A4 — make the big hand-wrecks LOOTABLE. Their make* builders already add
    // access panels (the merge keeps them live); placeWreck just doesn't register
    // them (it can't import salvage.ts — circular). ACAV Tier 1 — register EVERY
    // panel UNCONDITIONALLY: the old `if (wp.y > terrain+0.2)` gate conditionally
    // skipped registerSalvageable, which consumes `rand`, desyncing the yard's
    // downstream RNG (bones/debris) based on terrain — the D208 hazard. Panels that
    // ended up below the sand are dropped by the cluster validatePanels pass (with
    // `terrain`) after the merge instead. Register-all-then-prune.
    if (salvageables) {
      const seen = new Set<THREE.Object3D>();
      group.traverse((o) => {
        if (!o.userData.accessPanel || seen.has(o)) return;
        seen.add(o);
        o.updateWorldMatrix(true, false);
        const wp = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
        registerSalvageable(salvageables, o, kind, wp, rand);
      });
    }
  }

  // ── 3. Bone-fields — ribcages scattered as carcass anchors. ──
  const boneN = Tuning.WRECK_YARD_BONE_COUNT_MIN
    + Math.floor(rand() * (Tuning.WRECK_YARD_BONE_COUNT_MAX - Tuning.WRECK_YARD_BONE_COUNT_MIN + 1));
  for (let i = 0; i < boneN; i++) {
    const pos = tryPos(radius * 0.85, 6.0, 0.5);
    if (!pos) continue;
    const y = terrain.heightAt(pos.x, pos.z);
    placeRibcage(scene, world, new THREE.Vector3(pos.x, y, pos.z), rand, yardGroup);   // ACAS A1 — into the yard merge
    carcasses.push(new THREE.Vector3(pos.x, y, pos.z));
  }

  // ── 4. Heavy debris scatter across the floor. ──
  placeDebrisField(scene, terrain, new THREE.Vector3(cx, 0, cz), radius * 0.8, rand, 36 + Math.floor(rand() * 16), yardGroup);   // ACAS A1 — into the yard merge

  // Y6 perf — collapse the whole graveyard's static geometry into a handful of
  // draw calls (~30 already-merged wrecks → per-material meshes). Salvage panels
  // (accessPanel) + interactables stay live (the merge skips them). Per-part
  // colliders were already built inside each placeProcgenComposite/placeWreck.
  mergeStaticByMaterial(yardGroup);

  // ACAU (D208) — cluster-level bury prune: now that the whole yard is merged,
  // raycast every panel registered in this yard against the FULL yardGroup so a
  // panel buried behind a neighbouring hulk (not just its own wreck) is dropped.
  // ACAV Tier 1 — also pass `terrain` so panels that sank below the sand under a
  // heavy crash-tilt are culled here too. RNG-safe (no `rand`).
  if (salvageables) {
    pruneBuriedPanels(yardGroup, salvageables.list.slice(startIdx), salvageables, terrain);
  }

  return carcasses;
}
