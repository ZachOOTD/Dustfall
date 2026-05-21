// Session AAC — placeable lantern. Standing light source the player
// crafts + deploys. Unlike torch (consumable, burns out) and flashlight
// (held, drains), the lantern is a permanent world entity — never
// burns out, gives soft flickering light at night, packable on RMB.
//
// Architecture (D80 — clone-not-parameterize): mirrors tent.ts shape;
// separate module since the per-frame flicker logic + PointLight
// management doesn't generalize cleanly to the other placeables.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { addItem } from '../inventory/inventory.ts';

export interface Lantern {
  id: number;
  mesh: THREE.Group;
  light: THREE.PointLight;
  globeMat: THREE.MeshBasicMaterial;
  pos: THREE.Vector3;
  rotationY: number;
  hovered: boolean;
  /** Per-instance phase offset so multiple lanterns in view don't
   *  flicker in lockstep. */
  flickerSeed: number;
}

let _nextId = 1;

function tag(root: THREE.Object3D, id: number): void {
  root.traverse((o) => {
    // Lantern has no E-interaction (it's purely a light source). We
    // tag for HOVER detection only so the prompt can show "lantern"
    // and so RMB pack-up can find it. Use 'sleep' as a placeholder
    // hover type — the interaction.ts case 'lanterns' will set the
    // hover state itself and NOT register an E-action.
    // Actually simpler: use a passive hover via a generic type. We'll
    // pick 'take' here since interaction.ts case 'lanterns' will
    // override the hover state. Cleanest: introduce no new InteractType;
    // use 'sleep' since it visually communicates "you'd interact with
    // this" while letting the interaction case set passive=true.
    o.userData.interactType = 'sleep';
    o.userData.interactId = id;
    o.userData.interactRegistry = 'lanterns';
  });
}

function makeLanternVisual(): {
  group: THREE.Group;
  light: THREE.PointLight;
  globeMat: THREE.MeshBasicMaterial;
} {
  const g = new THREE.Group();
  const H = Tuning.LANTERN_HEIGHT_M;

  // Base — small wooden disc
  const baseMat = new THREE.MeshLambertMaterial({ color: 0x4a3220 });
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.12, 0.04, 8),
    baseMat,
  );
  base.position.y = 0.02;
  g.add(base);

  // Vertical post
  const postMat = new THREE.MeshLambertMaterial({ color: 0x5a4030 });
  const postH = H - 0.30;
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, postH, 6),
    postMat,
  );
  post.position.y = 0.04 + postH * 0.5;
  g.add(post);

  // Crossbar at top (rest the globe on it)
  const crossbar = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 0.025, 0.025),
    postMat,
  );
  crossbar.position.y = 0.04 + postH;
  g.add(crossbar);

  // Glass globe — slightly translucent additive sphere
  const globeMat = new THREE.MeshBasicMaterial({
    color: Tuning.LANTERN_LIGHT_COLOR_HEX,
    transparent: true,
    opacity: 0.85,
    toneMapped: false,
    fog: false,
  });
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 12, 10),
    globeMat,
  );
  globe.position.y = 0.04 + postH - 0.10;
  g.add(globe);

  // Top cap above the globe
  const capMat = new THREE.MeshLambertMaterial({ color: 0x4a3a26 });
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.10, 0.035, 6),
    capMat,
  );
  cap.position.y = 0.04 + postH + 0.025;
  g.add(cap);

  // PointLight at the globe center
  const light = new THREE.PointLight(
    Tuning.LANTERN_LIGHT_COLOR_HEX,
    Tuning.LANTERN_LIGHT_INTENSITY,
    Tuning.LANTERN_LIGHT_DISTANCE,
    1.8,
  );
  light.position.copy(globe.position);
  light.castShadow = false;
  g.add(light);

  return { group: g, light, globeMat };
}

/** Deploy a lantern PLACEMENT_DISTANCE_M ahead. Returns null if too
 *  close to an existing lantern. */
export function deployLantern(ctx: GameContext): Lantern | null {
  const cam = ctx.three.camera;
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  dir.y = 0;
  if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
  dir.normalize();
  const pos = new THREE.Vector3()
    .copy(cam.position)
    .addScaledVector(dir, Tuning.PLACEMENT_DISTANCE_M);
  pos.y = ctx.terrain.heightAt(pos.x, pos.z);

  for (const existing of ctx.lanterns.list) {
    if (existing.pos.distanceToSquared(pos) < Tuning.LANTERN_NEAR_DISTANCE_SQ) {
      return null;
    }
  }

  const rotationY = Math.atan2(dir.x, dir.z);
  return spawnLanternAt(ctx, pos, rotationY);
}

export function spawnLanternAt(
  ctx: GameContext,
  pos: THREE.Vector3,
  rotationY: number,
): Lantern {
  const visual = makeLanternVisual();
  visual.group.position.copy(pos);
  visual.group.rotation.y = rotationY;
  visual.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  ctx.three.scene.add(visual.group);

  const id = _nextId++;
  tag(visual.group, id);

  const lantern: Lantern = {
    id,
    mesh: visual.group,
    light: visual.light,
    globeMat: visual.globeMat,
    pos: pos.clone(),
    rotationY,
    hovered: false,
    flickerSeed: Math.random() * 1000,
  };
  ctx.lanterns.list.push(lantern);
  return lantern;
}

export function setNextLanternId(n: number): void {
  if (n > _nextId) _nextId = n;
}

export function findLanternById(list: Lantern[], id: number | undefined): Lantern | undefined {
  if (id === undefined) return undefined;
  return list.find((l) => l.id === id);
}

export function packUpLantern(ctx: GameContext, lantern: Lantern): boolean {
  const slotIdx = addItem(ctx.inventory, 'lantern_kit', undefined, ctx);
  if (slotIdx < 0) {
    ctx.ui.showToast('no room in your bag');
    return false;
  }
  ctx.three.scene.remove(lantern.mesh);
  const i = ctx.lanterns.list.indexOf(lantern);
  if (i >= 0) ctx.lanterns.list.splice(i, 1);
  ctx.ui.showToast('lantern packed');
  return true;
}

/** Per-frame: sin-driven flicker on intensity + globe opacity. Two
 *  desynced sines per lantern (using flickerSeed offset) so multiple
 *  lanterns don't pulse in lockstep. Cheap pattern — no allocations
 *  in the hot loop. */
export function updateLanterns(ctx: GameContext): void {
  const t = ctx.time.elapsed;
  const baseInt = Tuning.LANTERN_LIGHT_INTENSITY;
  const amp = Tuning.LANTERN_FLICKER_AMP;
  for (const l of ctx.lanterns.list) {
    const phase = l.flickerSeed;
    const wobble = Math.sin(t * 13.7 + phase) * 0.5 + Math.sin(t * 21.3 + phase * 0.7) * 0.5;
    const factor = 1 + wobble * amp;
    l.light.intensity = baseInt * factor;
    l.globeMat.opacity = 0.78 + wobble * amp * 0.5;
  }
}
