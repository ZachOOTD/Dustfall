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
import { claimLight, releaseLight } from '../core/lightPool.ts';
import { createMetalMaterial } from './metalMaterial.ts';

export interface Lantern {
  id: number;
  mesh: THREE.Group;
  /** AAY-fix — claimed from ctx.lightPool. `null` only if the pool was
   *  exhausted at spawn (graceful fallback — lantern still visible,
   *  just no scene illumination contribution). */
  light: THREE.PointLight | null;
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
  globeMat: THREE.MeshBasicMaterial;
} {
  const g = new THREE.Group();
  const H = Tuning.LANTERN_HEIGHT_M;

  // AAZ-fix — salvaged-tech power-cell lantern. Reads as both rustic
  // (hand-forged tripod, weathered iron, exposed cables, rivets) and
  // sci-fi (glowing crystalline core in a metal cage, visible
  // conduits). Replaces the pre-AAZ-fix wooden-post-with-bulb design,
  // which read as "renaissance fair garden lamp" against Dustfall's
  // post-apocalyptic palette.
  //
  // Stack (bottom-up):
  //   1. Tripod (3 splayed iron legs meeting at a junction node)
  //   2. Junction rivets (small metal detail)
  //   3. Vertical post connecting junction to lantern head
  //   4. Side conduit cables (red + yellow wire pair, salvage-themed)
  //   5. Cage assembly (4 bars + top/bottom rings holding the core)
  //   6. Glowing crystalline core (vertical capsule, MeshBasic)
  //   7. Top cap + carry hook ring

  // Materials. Weathered iron for the structural pieces, slightly
  // brighter rivet color for accents, salvage cable colors carried
  // over from the AAR fuse-box wires for material consistency.
  // ABH — iron + rivet get the weathered-metal procedural shader for
  // scratches + worn highlights + grain. Wires stay flat colored.
  const ironMat = createMetalMaterial(0x4a4238, { wornScale: 5.0 });
  const rivetMat = createMetalMaterial(0x726658, { wornScale: 5.0, scratchStrength: 0.03 });
  const wireRedMat = new THREE.MeshLambertMaterial({ color: 0x8a3a26 });
  const wireYellowMat = new THREE.MeshLambertMaterial({ color: 0xb89028 });
  const glowColor = Tuning.LANTERN_LIGHT_COLOR_HEX;
  const globeMat = new THREE.MeshBasicMaterial({
    color: glowColor,
    transparent: true,
    opacity: 0.92,
    toneMapped: false,
    fog: false,
  });

  // Geometry constants (lifted locally for readability; can be promoted
  // to Tuning later if the design wants knobs).
  const TRIPOD_H = 0.42;
  const TRIPOD_SPLAY = 0.16;      // outward radius at the ground
  const JUNCTION_Y = TRIPOD_H;
  const HEAD_Y = H - 0.08;        // bottom of the cage
  const CAGE_H = 0.18;
  const CORE_H = 0.13;
  const CORE_R = 0.034;

  // ── 1. Tripod: 3 legs at 120° spacing, splayed outward to
  // TRIPOD_SPLAY at the ground, converging at the junction node.
  for (let i = 0; i < 3; i++) {
    const theta = (i / 3) * Math.PI * 2;
    const groundX = Math.cos(theta) * TRIPOD_SPLAY;
    const groundZ = Math.sin(theta) * TRIPOD_SPLAY;
    const legLen = Math.hypot(TRIPOD_SPLAY, TRIPOD_H);
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.018, legLen, 5),
      ironMat,
    );
    // Mid-point of the leg in world space.
    leg.position.set(groundX * 0.5, TRIPOD_H * 0.5, groundZ * 0.5);
    // Align cylinder's local +Y with the (ground → junction) vector.
    const dir = new THREE.Vector3(-groundX, TRIPOD_H, -groundZ).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    leg.quaternion.copy(q);
    g.add(leg);
  }

  // ── 2. Junction node + rivets where the legs meet the post.
  const junction = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 8, 6),
    ironMat,
  );
  junction.position.y = JUNCTION_Y;
  g.add(junction);
  // Three rivet accents around the junction equator.
  for (let i = 0; i < 3; i++) {
    const theta = (i / 3) * Math.PI * 2 + 0.4;
    const rivet = new THREE.Mesh(
      new THREE.SphereGeometry(0.0085, 5, 4),
      rivetMat,
    );
    rivet.position.set(
      Math.cos(theta) * 0.042,
      JUNCTION_Y,
      Math.sin(theta) * 0.042,
    );
    g.add(rivet);
  }

  // ── 3. Vertical post: junction up to the cage base.
  const postH = HEAD_Y - JUNCTION_Y;
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, postH, 6),
    ironMat,
  );
  post.position.y = JUNCTION_Y + postH * 0.5;
  g.add(post);

  // ── 4. Side conduit cables — a red + yellow wire pair running
  // alongside the post from junction up to the cage base. Slight stagger
  // so they don't look identical. Reads as "salvaged power leads
  // wired to the core" — same visual language as the AAR fuse-box
  // interior cables.
  for (const [matRef, offX, offZ] of [
    [wireRedMat, 0.028, 0.012],
    [wireYellowMat, -0.024, 0.018],
  ] as const) {
    const wire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, postH * 0.92, 5),
      matRef,
    );
    wire.position.set(offX, JUNCTION_Y + postH * 0.5 + 0.02, offZ);
    g.add(wire);
  }

  // ── 5. Cage assembly: bottom + top rings (open torus shapes) holding
  // 4 vertical bars at the corners. The bars + open sides let the core
  // light spill out radially.
  const ringMat = ironMat;
  const ringBottom = new THREE.Mesh(
    new THREE.TorusGeometry(0.072, 0.008, 4, 12),
    ringMat,
  );
  ringBottom.rotation.x = Math.PI / 2;
  ringBottom.position.y = HEAD_Y;
  g.add(ringBottom);
  const ringTop = new THREE.Mesh(
    new THREE.TorusGeometry(0.072, 0.008, 4, 12),
    ringMat,
  );
  ringTop.rotation.x = Math.PI / 2;
  ringTop.position.y = HEAD_Y + CAGE_H;
  g.add(ringTop);
  for (let i = 0; i < 4; i++) {
    const theta = (i / 4) * Math.PI * 2 + Math.PI / 4;   // 45° offset → bars at corners
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.007, CAGE_H, 4),
      ringMat,
    );
    bar.position.set(
      Math.cos(theta) * 0.072,
      HEAD_Y + CAGE_H * 0.5,
      Math.sin(theta) * 0.072,
    );
    g.add(bar);
  }

  // ── 6. Glowing crystalline core inside the cage. Vertical capsule;
  // the MeshBasicMaterial keeps it bright regardless of scene lighting,
  // toneMapped:false stops the renderer from darkening it. Width +
  // height tuned so the cage bars frame it without occluding it.
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(CORE_R, CORE_R * 0.85, CORE_H, 8),
    globeMat,
  );
  core.position.y = HEAD_Y + CAGE_H * 0.5;
  g.add(core);
  // Hemispherical end caps on the core so it doesn't read as a chopped-
  // off can. Cheap — two spheres flattened slightly.
  for (const sy of [-1, 1]) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(CORE_R, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5),
      globeMat,
    );
    cap.position.y = HEAD_Y + CAGE_H * 0.5 + sy * CORE_H * 0.5;
    if (sy < 0) cap.rotation.x = Math.PI;   // flip the bottom cap
    g.add(cap);
  }

  // ── 7. Top cap + carry hook. Truncated cone over the top ring, plus
  // a small torus ring suggesting the lantern could be hung from a
  // beam. Pure rustic accent — no light function.
  const topCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.075, 0.04, 6),
    ironMat,
  );
  topCap.position.y = HEAD_Y + CAGE_H + 0.02;
  g.add(topCap);
  const hook = new THREE.Mesh(
    new THREE.TorusGeometry(0.024, 0.006, 4, 8),
    ironMat,
  );
  hook.rotation.x = Math.PI / 2;
  hook.position.y = HEAD_Y + CAGE_H + 0.06;
  g.add(hook);

  // AAY-fix — PointLight no longer created here. Claimed from
  // ctx.lightPool in spawnLanternAt and positioned in WORLD space (the
  // pool light is a scene-direct child, not a member of this lantern
  // group, so add/remove of the group doesn't change the scene's
  // lightsHash and trigger shader recompilation).
  void glowColor;

  return { group: g, globeMat };
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
  // AAY-fix — receiveShadow on everything is cheap, but blanket
  // castShadow=true on 20+ small meshes (cage bars, rivets, hook torus,
  // glowing core caps) bloats the shadow-map render pass. Set
  // castShadow only on the silhouette-defining members. The cage,
  // rivets, conduit wires, and core hemispheres don't need to cast
  // shadows — they're tiny / inside the cage / glowing.
  visual.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.receiveShadow = true;
  });
  ctx.three.scene.add(visual.group);

  const id = _nextId++;
  tag(visual.group, id);

  // AAY-fix — claim a pool light + configure for the lantern.
  // Positioned at the world location of the core (lantern world position
  // + the core's local y offset).
  const light = claimLight(ctx.lightPool);
  if (light) {
    light.color.setHex(Tuning.LANTERN_LIGHT_COLOR_HEX);
    light.distance = Tuning.LANTERN_LIGHT_DISTANCE;
    light.decay = 1.8;
    light.intensity = Tuning.LANTERN_LIGHT_INTENSITY;
    // Core position inside the lantern: HEAD_Y + CAGE_H * 0.5 (see
    // makeLanternVisual). Recomputed here to avoid leaking the local
    // layout constants into this scope; HEAD_Y is LANTERN_HEIGHT_M -
    // 0.08, CAGE_H is 0.18 → core Y ≈ LANTERN_HEIGHT_M + 0.01.
    light.position.set(
      pos.x,
      pos.y + Tuning.LANTERN_HEIGHT_M - 0.08 + 0.09,
      pos.z,
    );
  }

  const lantern: Lantern = {
    id,
    mesh: visual.group,
    light,
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
  // AAY-fix — release the pool light back so the next lantern can use it.
  if (lantern.light) {
    releaseLight(ctx.lightPool, lantern.light);
    lantern.light = null;
  }
  ctx.three.scene.remove(lantern.mesh);
  const i = ctx.lanterns.list.indexOf(lantern);
  if (i >= 0) ctx.lanterns.list.splice(i, 1);
  ctx.ui.showToast('lantern packed');
  return true;
}

/** AAY-fix — release a lantern's pool light without consuming a kit. Used
 *  by save.ts's "clear before re-spawn" path so Continue doesn't leak
 *  pool slots. */
export function releaseLanternLight(ctx: GameContext, lantern: Lantern): void {
  if (lantern.light) {
    releaseLight(ctx.lightPool, lantern.light);
    lantern.light = null;
  }
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
    if (l.light) l.light.intensity = baseInt * factor;
    l.globeMat.opacity = 0.78 + wobble * amp * 0.5;
  }
}
