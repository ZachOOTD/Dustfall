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
import { attachAabbCollider } from '../physics/bodies.ts';

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

// ────────────────────────────────────────────────────────────────
// 1. Engine cluster — bundle of nozzles + small thrust frame.
// Tilted leeward; reads as a propulsion module ripped from a ship.
// ────────────────────────────────────────────────────────────────
export function makeEngineCluster(rand: Rng, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const nozzleCount = 3 + Math.floor(rand() * 3); // 3-5
  const baseR = (0.6 + rand() * 0.25) * scale;
  const nozzleH = (1.2 + rand() * 0.3) * scale;
  // Tight ring layout
  for (let i = 0; i < nozzleCount; i++) {
    const a = (i / nozzleCount) * Math.PI * 2;
    const r = baseR * 1.05;
    const cx = Math.cos(a) * r * 0.6;
    const cz = Math.sin(a) * r * 0.6;
    // Outer rim
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(baseR * 0.55, baseR * 0.5, nozzleH, 12, 1, true),
      _nozzleRimMat,
    );
    rim.position.set(cx, nozzleH / 2, cz);
    g.add(rim);
    // Inner dark cone (interior of the bell — pure dark)
    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(baseR * 0.5, baseR * 0.42, nozzleH * 0.95, 10, 1, true),
      _nozzleInteriorMat,
    );
    inner.position.set(cx, nozzleH / 2, cz);
    g.add(inner);
    // Closed disc at the back of each nozzle
    const cap = new THREE.Mesh(
      new THREE.CircleGeometry(baseR * 0.5, 12),
      _hullMat,
    );
    cap.rotation.x = Math.PI / 2;
    cap.position.set(cx, nozzleH - 0.01, cz);
    g.add(cap);
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
  return g;
}

// ────────────────────────────────────────────────────────────────
// 6. Engine-bell ring — single huge engine bell torus, half-buried.
// Striking solo silhouette; reads instantly as "spaceship."
// ────────────────────────────────────────────────────────────────
export function makeEngineBell(rand: Rng, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const R = (1.6 + rand() * 0.4) * scale;
  const tube = R * 0.18;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(R, tube, 8, 18),
    _hullMat,
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = R * 0.65; // tilted so the bell mouth faces up-and-out
  ring.rotation.z = (rand() - 0.5) * 0.4;
  g.add(ring);
  // Dark inner disc — the inside of the bell
  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(R - tube * 1.1, 18),
    _nozzleInteriorMat,
  );
  inner.position.copy(ring.position);
  inner.rotation.copy(ring.rotation);
  inner.rotation.x += Math.PI / 2;
  g.add(inner);
  // A few struts off the rim, evoking the broken mount
  for (let i = 0; i < 3; i++) {
    const a = rand() * Math.PI * 2;
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, R * 0.9, 6),
      _antennaMat,
    );
    strut.position.set(Math.cos(a) * R, ring.position.y + (rand() - 0.5) * 0.3, Math.sin(a) * R);
    strut.rotation.z = (rand() - 0.5) * 1.3;
    g.add(strut);
  }
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
  /** Shrink collider faces inward by N meters (e.g., 0.15 to allow walking
   *  close to antenna struts without snagging on their thin volume). */
  colliderShrink?: number;
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
    // Snug AABB collider — auto-fits the irregular shape regardless of how
    // it was tilted, scaled, or composed. Slight shrink keeps the player
    // from snagging on thin antennas / dish edges.
    attachAabbCollider(world, group, opts.colliderShrink ?? 0.1);
  }
  return group;
}
