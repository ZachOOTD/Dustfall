// Sci-fi wreckage registry (Session S). Hand-coded composites of THREE.js
// primitives — flat-shaded, rust-grey palette, evocative of Jakku-era
// derelict spacecraft half-buried in the dunes.
//
// Each `makeXxx` returns a Group positioned so its base sits at local y=0
// (ready for the caller to set position.y to a terrain sample, possibly
// adjusted by a burial depth). The caller handles world position +
// rotation + collider. A few wrecks accept a `scale` argument so the same
// primitive serves both small ambient landmarks AND large hero POIs.

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import { Tuning } from '../config/tuning.ts';
import { perturbOutward } from './sculpt.ts';
import { attachCompoundCollider } from '../physics/bodies.ts';

// ────────────────────────────────────────────────────────────────
// Shared materials. Same materials reused across wrecks so we don't
// hammer the scene with redundant material objects.
// ────────────────────────────────────────────────────────────────
const _hullMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_HULL_HEX,
  flatShading: true,
});
const _hullDarkMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_HULL_DARK_HEX,
  flatShading: true,
});
const _rustMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_RUST_HEX,
  flatShading: true,
});
const _nozzleInteriorMat = new THREE.MeshBasicMaterial({
  color: Tuning.WRECK_NOZZLE_INTERIOR_HEX,
});
const _nozzleRimMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_NOZZLE_RIM_HEX,
  flatShading: true,
});
const _antennaMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_ANTENNA_HEX,
  flatShading: true,
});

// Salvage-panel materials (Session Z) — shared across every wreck so we don't
// allocate per-panel.
const _panelBodyMat = new THREE.MeshLambertMaterial({
  color: Tuning.SALVAGE_PANEL_BODY_HEX,
  flatShading: true,
});
const _panelRimMat = new THREE.MeshLambertMaterial({
  color: Tuning.SALVAGE_PANEL_RIM_HEX,
  flatShading: true,
});

/**
 * Build a salvage access panel — small dark plate with a brass rim ring and a
 * raised stub for tactile affordance — and attach it as a child of `group` at
 * the given local position. The panel mesh is stashed on `group.userData.accessPanel`
 * so `registerSalvageable` can find it and tag it as the only interactable
 * surface for this wreck (Session Z — replaces "raycast hits any mesh on the
 * wreck" with "raycast hits THIS panel"). Scales with the wreck.
 *
 * `faceYaw` rotates the panel around Y so it presents face-out from the wreck
 * (raycasts hit the rim, not the back). Optional — defaults to 0.
 */
export function addAccessPanel(
  group: THREE.Group,
  localX: number, localY: number, localZ: number,
  scale = 1,
  faceYaw = 0,
): THREE.Mesh {
  const sx = Tuning.SALVAGE_PANEL_SIZE_X * scale;
  const sy = Tuning.SALVAGE_PANEL_SIZE_Y * scale;
  const sz = Tuning.SALVAGE_PANEL_SIZE_Z * scale;

  // Panel root mesh — the body. Used as the interact target.
  const body = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), _panelBodyMat);
  body.position.set(localX, localY, localZ);
  body.rotation.y = faceYaw;
  // Panel sits on a wreck hull that already has compound colliders. Don't add
  // a redundant collider for the small bump — `attachCompoundCollider` skips
  // children flagged `noCollider`.
  body.userData.noCollider = true;

  // Brass rim — thin frame slightly larger than the body, sticking forward.
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(sx * 1.12, sy * 1.12, sz * 0.45),
    _panelRimMat,
  );
  rim.position.set(0, 0, sz * 0.35);
  rim.userData.noCollider = true;
  body.add(rim);

  // Center stub — a tiny cylinder = handle / dial. Lives in front so it's
  // unmissable when you look at the panel.
  const stub = new THREE.Mesh(
    new THREE.CylinderGeometry(sy * 0.22, sy * 0.22, sz * 0.7, 8),
    _panelRimMat,
  );
  stub.rotation.x = Math.PI / 2;
  stub.position.set(0, 0, sz * 0.65);
  stub.userData.noCollider = true;
  body.add(stub);

  group.add(body);
  group.userData.accessPanel = body;
  return body;
}

// ────────────────────────────────────────────────────────────────
// Shared 3D engine-bell mesh (Session CC-3). Replaces the prior
// torus-ring + flat-CircleGeometry pattern with a flared open-ended
// cone + recessed solid interior cylinder, so the bell has depth
// from every viewing angle. Caller positions + rotates the returned
// group; the bell's mouth opens at LOCAL +Y by default.
// ────────────────────────────────────────────────────────────────
const _bellOuterMatCache = new WeakMap<THREE.Material, THREE.Material>();
function _bellOuterMat(src: THREE.Material): THREE.Material {
  // Clone the source material with `side: DoubleSide` so the inside-
  // the-mouth view of the flare isn't transparent (open-ended
  // cylinder is single-sided by default). Cached so we only allocate
  // one clone per source material across all bells in the world.
  let cached = _bellOuterMatCache.get(src);
  if (cached) return cached;
  cached = src.clone();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (cached as any).side = THREE.DoubleSide;
  _bellOuterMatCache.set(src, cached);
  return cached;
}

export function makeEngineBellMesh(
  radius: number,
  depth: number,
  outerMat: THREE.Material,
  interiorMat: THREE.Material,
): THREE.Group {
  const g = new THREE.Group();
  // Outer flared cone — open-ended cylinder, big radius at +Y (mouth),
  // small radius at -Y (base / combustion-chamber end).
  const flare = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.55, depth, 16, 1, true),
    _bellOuterMat(outerMat),
  );
  flare.position.y = depth / 2;
  g.add(flare);
  // Inner darkness cylinder — solid (has caps); slightly smaller than
  // flare so it sits inside the flare's wall, slightly recessed so the
  // mouth shows a ring of flare metal before the dark interior. The
  // -Y cap closes the back so the bell isn't see-through from behind.
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.75, radius * 0.45, depth * 0.95, 16, 1, false),
    interiorMat,
  );
  inner.position.y = depth / 2 - 0.02 * depth;
  g.add(inner);
  // Rim torus — thin band at the mouth edge for silhouette readability.
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.02, radius * 0.06, 6, 18),
    outerMat,
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = depth;
  g.add(rim);
  return g;
}

// ────────────────────────────────────────────────────────────────
// 1. Engine cluster — bundle of nozzles + small thrust frame.
// Tilted leeward; reads as a propulsion module ripped from a ship.
// ────────────────────────────────────────────────────────────────
export function makeEngineCluster(rand: Rng, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const nozzleCount = 3 + Math.floor(rand() * 3); // 3-5
  const baseR = (0.6 + rand() * 0.25) * scale;
  const nozzleH = (1.2 + rand() * 0.3) * scale;
  // Tight ring layout — each nozzle is a shared 3D bell mesh
  // (flared cone + dark interior; replaces the prior open-cylinder +
  // flat-disc pattern that read as fake from oblique angles).
  for (let i = 0; i < nozzleCount; i++) {
    const a = (i / nozzleCount) * Math.PI * 2;
    const r = baseR * 1.05;
    const cx = Math.cos(a) * r * 0.6;
    const cz = Math.sin(a) * r * 0.6;
    const bell = makeEngineBellMesh(baseR * 0.55, nozzleH, _nozzleRimMat, _nozzleInteriorMat);
    bell.position.set(cx, 0, cz);   // bell mouth opens +Y (matches the prior orientation)
    g.add(bell);
  }
  // Thrust frame box behind the nozzles
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(baseR * 2.4, baseR * 0.9, baseR * 2.0),
    _hullMat,
  );
  frame.position.set(0, nozzleH + baseR * 0.45, 0);
  g.add(frame);
  // Rusty side panel
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(baseR * 2.2, baseR * 0.7, 0.06),
    _rustMat,
  );
  panel.position.set(0, nozzleH + baseR * 0.45, baseR * 1.05);
  panel.rotation.y = (rand() - 0.5) * 0.2;
  g.add(panel);
  // Salvage access panel — on the rusty side panel face, off-center.
  addAccessPanel(
    g,
    baseR * 0.55, nozzleH + baseR * 0.45, baseR * 1.12,
    scale,
    0,
  );
  return g;
}

// ────────────────────────────────────────────────────────────────
// 2. Fuselage section — large cylinder lying horizontal, partly buried.
// Antenna stub off the top. The workhorse small wreck.
// ────────────────────────────────────────────────────────────────
export function makeFuselage(rand: Rng, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const length = (4 + rand() * 2) * scale;
  const radius = (0.85 + rand() * 0.25) * scale;
  // Main tube — cylinder along X (rotate Z)
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 14),
    _hullMat,
  );
  tube.rotation.z = Math.PI / 2;
  tube.position.y = radius * 0.55; // partly buried
  g.add(tube);
  // Rust band wrap near one end
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, length * 0.15, 14),
    _rustMat,
  );
  band.rotation.z = Math.PI / 2;
  band.position.set(length * 0.32, radius * 0.55, 0);
  g.add(band);
  // Antenna stub from the top
  if (rand() < 0.85) {
    const stub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05 * scale, 0.07 * scale, (1.4 + rand() * 0.6) * scale, 6),
      _antennaMat,
    );
    stub.position.set(-length * 0.2 + rand() * length * 0.4, radius * 1.3, 0);
    stub.rotation.z = (rand() - 0.5) * 0.4;
    g.add(stub);
  }
  // End-cap disc on the open end (other end implied buried)
  const cap = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.92, 14),
    _hullDarkMat,
  );
  cap.rotation.y = -Math.PI / 2;
  cap.position.set(-length / 2 + 0.01, radius * 0.55, 0);
  g.add(cap);
  // Salvage access panel — on the side of the tube, near the rust band.
  addAccessPanel(
    g,
    length * 0.32, radius * 1.05, radius * 0.05,
    scale,
    0,
  );
  return g;
}

// ────────────────────────────────────────────────────────────────
// 3. Crashed escape pod — small icosahedron, partly buried, hatch open.
// ────────────────────────────────────────────────────────────────
export function makeEscapePod(rand: Rng, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const r = (0.85 + rand() * 0.25) * scale;
  // Hull (icosahedron, slightly perturbed)
  const hullGeo = new THREE.IcosahedronGeometry(r, 1);
  perturbOutward(hullGeo, 0.07, 17);
  const hull = new THREE.Mesh(hullGeo, _hullMat);
  hull.position.y = r * 0.42; // partly buried
  g.add(hull);
  // Open hatch — a small rotated box punched out the front
  const hatch = new THREE.Mesh(
    new THREE.BoxGeometry(r * 0.7, r * 0.7, 0.04),
    _hullDarkMat,
  );
  hatch.position.set(r * 0.85, r * 0.5, 0);
  hatch.rotation.y = -0.4;
  g.add(hatch);
  // Rust patch
  const patch = new THREE.Mesh(
    new THREE.BoxGeometry(r * 0.5, r * 0.4, 0.05),
    _rustMat,
  );
  patch.position.set(-r * 0.5, r * 0.65, r * 0.3);
  patch.rotation.set(0.3, -0.4, 0.1);
  g.add(patch);
  // Salvage access panel — opposite side from the broken hatch so both ends
  // of the pod feel utilized.
  addAccessPanel(
    g,
    -r * 0.75, r * 0.45, -r * 0.15,
    scale,
    Math.PI,
  );
  return g;
}

// ────────────────────────────────────────────────────────────────
// 4. Cargo container — box with framing struts, tilted half-buried.
// ────────────────────────────────────────────────────────────────
export function makeCargoContainer(rand: Rng, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const w = (2.2 + rand() * 0.6) * scale;
  const h = (1.2 + rand() * 0.3) * scale;
  const d = (1.4 + rand() * 0.3) * scale;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), _rustMat);
  body.position.y = h * 0.45; // partly buried
  g.add(body);
  // 4 corner struts
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sz = -1; sz <= 1; sz += 2) {
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.08 * scale, h, 0.08 * scale),
        _hullDarkMat,
      );
      strut.position.set(sx * (w / 2 - 0.05), h * 0.45, sz * (d / 2 - 0.05));
      g.add(strut);
    }
  }
  // Hinge door rectangle on one face
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, h * 0.78, d * 0.7),
    _hullDarkMat,
  );
  door.position.set(w / 2 + 0.02, h * 0.45, 0);
  g.add(door);
  // Salvage access panel — beside the door, lower on the box so you crouch
  // a touch to align (reads as "scavenger-modified access point").
  addAccessPanel(
    g,
    w / 2 + 0.08, h * 0.30, d * 0.30,
    scale,
    Math.PI / 2,
  );
  return g;
}

// ────────────────────────────────────────────────────────────────
// 5. Antenna spire — tall comm tower built on a buried wreck base.
// Replaces the old radio-tower hero landmark; ship-themed now.
// ────────────────────────────────────────────────────────────────
export function makeAntennaSpire(rand: Rng, scale = 1): THREE.Group {
  const g = new THREE.Group();
  // Buried base (chunk of hull)
  const baseW = (2.2 + rand() * 0.4) * scale;
  const baseH = (0.9 + rand() * 0.3) * scale;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(baseW, baseH, baseW * 0.85),
    _hullMat,
  );
  base.position.y = baseH * 0.35; // mostly buried
  base.rotation.y = rand() * Math.PI;
  g.add(base);
  // Vertical mast
  const mastH = (8 + rand() * 4) * scale;
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10 * scale, 0.14 * scale, mastH, 8),
    _antennaMat,
  );
  mast.position.set(0, baseH * 0.5 + mastH / 2, 0);
  mast.rotation.z = (rand() - 0.5) * 0.08; // slight lean
  g.add(mast);
  // Cross-bracing slats
  for (const t of [0.25, 0.55, 0.82]) {
    const y = baseH * 0.5 + mastH * t;
    const len = (0.7 - t * 0.45) * scale;
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(len * 2, 0.05 * scale, 0.05 * scale),
      _antennaMat,
    );
    slat.position.set(0, y, 0);
    slat.rotation.y = rand() * Math.PI;
    g.add(slat);
  }
  // Dish at the top — wide flat disc tilted toward horizon
  const dish = new THREE.Mesh(
    new THREE.ConeGeometry((1.1 + rand() * 0.3) * scale, 0.25 * scale, 16, 1, true),
    _hullDarkMat,
  );
  dish.position.set(0, baseH * 0.5 + mastH + 0.1, 0);
  dish.rotation.z = -0.6 + rand() * 0.4;
  g.add(dish);
  // Salvage access panel — on the buried base box, player-eye height.
  // Scale is already baked into baseW/baseH so the panel `scale` arg is 1.
  addAccessPanel(
    g,
    baseW * 0.42, baseH * 0.5, baseW * 0.30,
    scale,
    0,
  );
  return g;
}

// ────────────────────────────────────────────────────────────────
// 6. Engine-bell ring — single huge engine bell torus, half-buried.
// Striking solo silhouette; reads instantly as "spaceship."
// ────────────────────────────────────────────────────────────────
export function makeEngineBell(rand: Rng, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const R = (1.6 + rand() * 0.4) * scale;
  // 3D flared bell mesh — replaces the torus+flat-disc pattern. The
  // helper returns a group with mouth opening at local +Y; here we
  // keep the bell pointing roughly up (matching the prior pose) but
  // give it a small Z-tilt to suggest a crash-tipped engine.
  const bellY = R * 0.10;   // base anchor: helper draws bell from base to base+depth
  const bell = makeEngineBellMesh(R, R * 1.1, _hullMat, _nozzleInteriorMat);
  bell.position.y = bellY;
  bell.rotation.z = (rand() - 0.5) * 0.4;
  g.add(bell);
  // The bell's "ring-midline" world Y (used for strut placement +
  // access panel) ≈ base + half_depth, with the slight z-tilt ignored.
  const midY = bellY + (R * 1.1) * 0.5;
  // A few struts off the rim — broken-mount character.
  for (let i = 0; i < 3; i++) {
    const a = rand() * Math.PI * 2;
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, R * 0.9, 6),
      _antennaMat,
    );
    strut.position.set(Math.cos(a) * R, midY + (rand() - 0.5) * 0.3, Math.sin(a) * R);
    strut.rotation.z = (rand() - 0.5) * 1.3;
    g.add(strut);
  }
  // Salvage access panel — on the outer rim, midline.
  addAccessPanel(g, R * 1.05, midY, 0, scale, Math.PI / 2);
  return g;
}

// ────────────────────────────────────────────────────────────────
// 7. Debris field — small ambient debris around a wreck.
// Single batch of 6-12 pieces in a radius. All tilted to terrain.
// ────────────────────────────────────────────────────────────────
const _alignUp = new THREE.Vector3(0, 1, 0);
const _alignQ = new THREE.Quaternion();
const _alignN = new THREE.Vector3();

export function placeDebrisField(
  scene: THREE.Scene,
  terrain: Terrain,
  center: THREE.Vector3,
  radius: number,
  rand: Rng,
  count?: number,
): void {
  const total = count ?? (6 + Math.floor(rand() * 7));
  for (let i = 0; i < total; i++) {
    const a = rand() * Math.PI * 2;
    const r = radius * (0.3 + rand() * 0.7);
    const x = center.x + Math.cos(a) * r;
    const z = center.z + Math.sin(a) * r;
    const y = terrain.heightAt(x, z);

    const kind = rand();
    let mesh: THREE.Mesh;
    if (kind < 0.35) {
      // Pipe segment
      const len = 0.4 + rand() * 0.5;
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, len, 6),
        _rustMat,
      );
      mesh.rotation.z = Math.PI / 2;
    } else if (kind < 0.70) {
      // Hull plate fragment
      const w = 0.4 + rand() * 0.4;
      const d = 0.3 + rand() * 0.3;
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.04, d),
        _hullMat,
      );
    } else {
      // Strut bundle (small cylinder + side stubs)
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.05, 0.7, 5),
        _antennaMat,
      );
      mesh.rotation.z = Math.PI / 2;
    }
    mesh.position.set(x, y + 0.02, z);
    mesh.rotation.y = rand() * Math.PI * 2;
    // Tilt to terrain normal so debris sits flush on slopes.
    _alignN.copy(terrain.normalAt(x, z));
    if (Math.abs(_alignN.y - 1) > 1e-4) {
      _alignQ.setFromUnitVectors(_alignUp, _alignN);
      mesh.quaternion.premultiply(_alignQ);
    }
    mesh.userData.noShadow = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

// ────────────────────────────────────────────────────────────────
// Public: place + collider for a hero-size wreck of a given kind.
// ────────────────────────────────────────────────────────────────
export type WreckKind =
  | 'engine_cluster'
  | 'fuselage'
  | 'escape_pod'
  | 'cargo_container'
  | 'antenna_spire'
  | 'engine_bell';

interface PlaceWreckOpts {
  scale?: number;
  buryY?: number;          // additional Y offset downward
  tiltZ?: number;          // additional Z-tilt in radians
  tiltX?: number;          // additional X-tilt in radians
  yaw?: number;            // explicit yaw (else random)
  /** When true, omit collider entirely (e.g., small ambient props). */
  noCollider?: boolean;
}

export function placeWreck(
  scene: THREE.Scene,
  world: RAPIER.World,
  _terrain: Terrain,
  pos: THREE.Vector3,
  kind: WreckKind,
  rand: Rng,
  opts: PlaceWreckOpts = {},
): THREE.Group {
  const scale = opts.scale ?? 1;
  let group: THREE.Group;
  switch (kind) {
    case 'engine_cluster':  group = makeEngineCluster(rand, scale); break;
    case 'fuselage':        group = makeFuselage(rand, scale); break;
    case 'escape_pod':      group = makeEscapePod(rand, scale); break;
    case 'cargo_container': group = makeCargoContainer(rand, scale); break;
    case 'antenna_spire':   group = makeAntennaSpire(rand, scale); break;
    case 'engine_bell':     group = makeEngineBell(rand, scale); break;
  }

  group.position.copy(pos);
  group.position.y -= opts.buryY ?? 0.25;
  group.rotation.y = opts.yaw ?? rand() * Math.PI * 2;
  if (opts.tiltZ !== undefined) group.rotation.z = opts.tiltZ;
  else group.rotation.z = (rand() - 0.5) * 0.18;
  if (opts.tiltX !== undefined) group.rotation.x = opts.tiltX;

  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  scene.add(group);

  if (!opts.noCollider) {
    // Per-primitive shape-accurate colliders. Each child mesh gets a
    // matching cuboid / cylinder / ball / cone; torus + custom geometry
    // fall back to a per-mesh AABB. Far better silhouette match than a
    // single bounding box around the whole tilted composite.
    attachCompoundCollider(world, group);
  }
  return group;
}
