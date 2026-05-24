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
import { createRustedHullMaterial } from './hullMaterial.ts';

// ────────────────────────────────────────────────────────────────
// Shared materials. Same materials reused across wrecks so we don't
// hammer the scene with redundant material objects. OO-4 — main
// hull + rust materials now use the procedural rust-streak shader
// (see hullMaterial.ts) so every procgen wreck gets vertical drip
// streaks + panel wear + sun bleach without bundle bloat. Hull-
// dark uses a quieter streak intensity since darker base needs
// less contrast to read. Nozzle interior + rim + antenna keep
// their plain materials (small accent pieces don't benefit much).
// ────────────────────────────────────────────────────────────────
const _hullMat = createRustedHullMaterial({
  baseColor: Tuning.WRECK_HULL_HEX,
});
const _hullDarkMat = createRustedHullMaterial({
  baseColor: Tuning.WRECK_HULL_DARK_HEX,
  streakIntensity: 0.35,
});
const _rustMat = createRustedHullMaterial({
  baseColor: Tuning.WRECK_RUST_HEX,
  rustHex: 0x0e0603,         // deeper rust on already-rust surfaces (saturate)
  streakIntensity: 0.45,
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
// allocate per-panel. AAR — new tactile design adds a hinged door + visible
// interior detail. Material count expanded: body (rusted dark plate),
// rim (brass frame), door (slightly weathered metal), interior backplate
// (deep cavity black), wire (insulated red), chip (silicon green-black),
// fuse (ceramic pale).
const _panelBodyMat = new THREE.MeshLambertMaterial({
  color: Tuning.SALVAGE_PANEL_BODY_HEX,
  flatShading: true,
});
// Session ABG bugfix — body BoxGeometry's front face was occluding the
// cavity interior (backplate + 5 components) even when the door pried
// open. Intent per the addAccessPanel comment was for `body` to be a
// "rusted RECESSED CAVITY box" — i.e. an open-front shell viewable
// from outside once the door swings away. Render the body's material
// with side: BackSide so only the INSIDE faces (back wall + 4 side
// walls) draw from a player-outside POV. The front face becomes
// invisible — the closed door (FrontSide) still reads as the surface
// when shut, and the opened door reveals the cavity interior. Shadows
// stay on FrontSide via shadowSide to avoid the BackSide self-shadow
// artifacts on a small box. Cached so all panels share one material.
const _panelBodyMatBackSide = (() => {
  const m = _panelBodyMat.clone();
  m.side = THREE.BackSide;
  m.shadowSide = THREE.FrontSide;
  return m;
})();
const _panelRimMat = new THREE.MeshLambertMaterial({
  color: Tuning.SALVAGE_PANEL_RIM_HEX,
  flatShading: true,
});
const _panelDoorMat = new THREE.MeshLambertMaterial({
  color: 0x5a4a3a,             // weathered iron, lighter than the body
  flatShading: true,
});
const _panelInteriorMat = new THREE.MeshLambertMaterial({
  color: 0x0a0805,             // deep cavity — almost black
  flatShading: true,
});
const _panelWireMat = new THREE.MeshLambertMaterial({
  color: 0xa83a2a,             // insulated red wiring
  flatShading: true,
});
const _panelChipMat = new THREE.MeshLambertMaterial({
  color: 0x1a3a1e,             // PCB green-black
  flatShading: true,
  emissive: 0x080a06,           // faint glow when light hits
});
const _panelFuseMat = new THREE.MeshLambertMaterial({
  color: 0xb8a880,             // ceramic pale
  flatShading: true,
});
// AAS — variant component materials. cloth_scrap = folded fabric;
// bandage_pack = small white medical kit. Each maps deterministically
// to a single loot item via COMPONENT_LOOT (see interaction.ts).
const _panelClothScrapMat = new THREE.MeshLambertMaterial({
  color: 0xc4ad88,             // weathered linen
  flatShading: true,
});
const _panelBandagePackMat = new THREE.MeshLambertMaterial({
  color: 0xe8dcc0,             // off-white gauze
  flatShading: true,
});
const _panelBandageCrossMat = new THREE.MeshLambertMaterial({
  color: 0xa83a2a,             // red cross stripe
  flatShading: true,
});

/** AAS — per-component kind discriminator. Each interior detail mesh
 *  is tagged with one of these on `userData.panelComponentKind`; the
 *  interaction system reads it to look up the exact loot item via
 *  COMPONENT_LOOT. The 5 entries cover the visual + loot vocabulary;
 *  per-kind palettes pick 5 of them in PANEL_COMPONENT_PALETTES. */
export type PanelComponentKind =
  | 'red_wire'        // → rope
  | 'yellow_wire'     // → cloth
  | 'chip'            // → scrap_bullet (rarer: scrap)
  | 'fuse'            // → scrap_bullet
  | 'scrap_chunk'     // → scrap×2
  | 'cloth_scrap'     // → cloth×2
  | 'bandage_pack';   // → bandage

/** AAS — kind hint for variant interior layouts. Mirrors SalvageKind
 *  (WreckKind | 'massive') from salvage.ts, redeclared here to avoid
 *  circular imports (salvage.ts imports WreckKind from this file). */
export type PanelKind = WreckKind | 'massive';

/** AAS — per-wreck-kind 5-component palettes. The interior of a
 *  fuselage panel looks different from a cargo-container panel; the
 *  loot it yields differs accordingly (red_wire→rope; bandage_pack→
 *  bandage). Each palette has exactly 5 entries to match the fixed
 *  5-component-mesh layout. */
const PANEL_COMPONENT_PALETTES: Record<PanelKind, ReadonlyArray<PanelComponentKind>> = {
  // Engine kinds — heavy on cabling + ammo. No medical, no cloth.
  engine_cluster: ['red_wire', 'red_wire', 'yellow_wire', 'fuse', 'scrap_chunk'],
  engine_bell:    ['red_wire', 'yellow_wire', 'fuse', 'fuse', 'scrap_chunk'],
  // Fuselage — interior cabling + textiles.
  fuselage:       ['red_wire', 'yellow_wire', 'chip', 'cloth_scrap', 'scrap_chunk'],
  // Escape pod — medical leaning.
  escape_pod:     ['bandage_pack', 'bandage_pack', 'cloth_scrap', 'chip', 'fuse'],
  // Cargo container — lottery mix.
  cargo_container:['chip', 'cloth_scrap', 'fuse', 'scrap_chunk', 'red_wire'],
  // Massive flagships — full mix incl medical + ammo.
  massive:        ['red_wire', 'yellow_wire', 'chip', 'fuse', 'bandage_pack'],
};

/** AAS — build one interior component mesh for the given kind at the
 *  given panel slot index (0..4). The 5 slots map to fixed positions
 *  inside the cavity so the layout reads consistently across kind
 *  variants (a fuselage panel and a cargo panel both have "something
 *  in the top-right slot" — they just look different). */
function makePanelComponent(
  kind: PanelComponentKind,
  slot: number,
  sx: number, sy: number, sz: number,
): THREE.Mesh {
  // 5 slot positions inside the cavity. The slot picks WHERE the
  // component lives; the kind picks WHAT it looks like. Some slot/kind
  // pairings need geometric overrides (e.g. a wire in the top-right
  // slot reads as horizontal not vertical) but the simplest first pass
  // is "kind dictates geometry, slot dictates position."
  const slotPositions: ReadonlyArray<{ x: number; y: number; z: number }> = [
    { x: -sx * 0.30, y:  sy * 0.05, z: sz * 0.32 },  // slot 0: top-left wire-bay
    { x: -sx * 0.18, y: -sy * 0.18, z: sz * 0.32 },  // slot 1: lower-left wire-bay
    { x:  sx * 0.18, y:  sy * 0.20, z: sz * 0.32 },  // slot 2: top-right chip-bay
    { x:  sx * 0.18, y: -sy * 0.18, z: sz * 0.34 },  // slot 3: lower-right fuse-bay
    { x: -sx * 0.02, y: -sy * 0.05, z: sz * 0.30 },  // slot 4: lower-center misc
  ];
  const p = slotPositions[slot];
  switch (kind) {
    case 'red_wire': {
      // Vertical-ish red insulated cable bundle.
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.06, sy * 0.40, sz * 0.08),
        _panelWireMat,
      );
      m.position.set(p.x, p.y, p.z);
      m.rotation.z = (slot % 2 === 0) ? 0.15 : -0.20;
      return m;
    }
    case 'yellow_wire': {
      // Slightly thinner yellow cable bundle.
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.05, sy * 0.30, sz * 0.06),
        new THREE.MeshLambertMaterial({ color: 0xc8a830, flatShading: true }),
      );
      m.position.set(p.x, p.y, p.z);
      m.rotation.z = (slot % 2 === 0) ? -0.25 : 0.18;
      return m;
    }
    case 'chip': {
      // Flat PCB rectangle.
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.25, sy * 0.18, sz * 0.06),
        _panelChipMat,
      );
      m.position.set(p.x, p.y, p.z);
      return m;
    }
    case 'fuse': {
      // Horizontal ceramic cylinder.
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(sy * 0.06, sy * 0.06, sx * 0.22, 8),
        _panelFuseMat,
      );
      m.rotation.z = Math.PI / 2;
      m.position.set(p.x, p.y, p.z);
      return m;
    }
    case 'scrap_chunk': {
      // Irregular plate of bare metal.
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.18, sy * 0.12, sz * 0.10),
        new THREE.MeshLambertMaterial({ color: 0x6e5a4a, flatShading: true }),
      );
      m.rotation.z = 0.3;
      m.position.set(p.x, p.y, p.z);
      return m;
    }
    case 'cloth_scrap': {
      // Folded fabric square.
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.20, sy * 0.20, sz * 0.05),
        _panelClothScrapMat,
      );
      m.rotation.z = (slot % 2 === 0) ? 0.12 : -0.18;
      m.position.set(p.x, p.y, p.z);
      return m;
    }
    case 'bandage_pack': {
      // Small white medical kit with a red cross stripe.
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.18, sy * 0.14, sz * 0.10),
        _panelBandagePackMat,
      );
      m.position.set(p.x, p.y, p.z);
      // Red cross stripe on the face.
      const crossH = new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.16, sy * 0.03, sz * 0.005),
        _panelBandageCrossMat,
      );
      crossH.position.set(0, 0, sz * 0.055);
      crossH.userData.noCollider = true;
      m.add(crossH);
      const crossV = new THREE.Mesh(
        new THREE.BoxGeometry(sx * 0.03, sy * 0.12, sz * 0.005),
        _panelBandageCrossMat,
      );
      crossV.position.set(0, 0, sz * 0.055);
      crossV.userData.noCollider = true;
      m.add(crossV);
      return m;
    }
  }
}

/**
 * Build a salvage access panel — AAR + AAS: rusted fuse-box with a
 * hinged door that swings open on player pry, revealing kind-specific
 * interior detail (wires + chips + fuse + cloth + bandages varying
 * per wreck kind). The panel body is the interaction target. The door
 * + interior live as children:
 *   - body.userData.accessPanel       = body (interaction target — Session Z)
 *   - body.userData.panelDoor         = door Group (hinged, animated)
 *   - body.userData.panelInterior     = interior Group (revealed when door opens)
 *   - body.userData.panelComponents   = array of 5 interior detail meshes,
 *     each tagged with `panelComponentIndex` (0..4) and `panelComponentKind`
 *     (the AAS PanelComponentKind for loot lookup).
 *
 * Animation state lives in `body.userData.panelDoorAngle` (current rad) and
 * `body.userData.panelDoorTarget` (rad — 0 closed, OPEN_ANGLE open). Per-
 * frame lerp happens in interaction.ts updatePanelDoors.
 *
 * `faceYaw` rotates the panel around Y so it presents face-out from the wreck.
 * `kind` selects the AAS variant palette; defaults to 'fuselage' for
 *   pre-AAS callers that haven't been updated.
 */
export function addAccessPanel(
  group: THREE.Group,
  localX: number, localY: number, localZ: number,
  scale = 1,
  faceYaw = 0,
  kind: PanelKind = 'fuselage',
): THREE.Mesh {
  const sx = Tuning.SALVAGE_PANEL_SIZE_X * scale;
  const sy = Tuning.SALVAGE_PANEL_SIZE_Y * scale;
  const sz = Tuning.SALVAGE_PANEL_SIZE_Z * scale;

  // Panel root mesh — the body. Used as the interact target.
  // The body itself is the rusted RECESSED CAVITY box; the door covers
  // it. From the front-on view the door reads as "the panel" until pried.
  //
  // AAU — body shifted BACK along local Z by sz/2 so its FRONT face is
  // flush with the hull surface (callers position `localZ` at the hull
  // surface). The rim + closed door sit just proud of the hull; the
  // body cavity recesses INTO the hull. Reads as "integrated, not
  // stuck on" rather than the AAR/AAS protrusion. All children of body
  // stay at their unchanged body-local positions and move with it.
  // ABG bugfix — use the BackSide-cloned body material so the box's
  // front face doesn't occlude the cavity interior. See material
  // comment above. The box geometry itself is unchanged so colliders,
  // raycast bounds, and child positions (door / rim / interior / glow)
  // all keep their existing wrapper-local layouts.
  const body = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), _panelBodyMatBackSide);
  // Build a small offset vector in panel-LOCAL Z and rotate it by
  // faceYaw so the "back" direction matches the panel's facing.
  const recessZ = -sz / 2;
  const cosY = Math.cos(faceYaw);
  const sinY = Math.sin(faceYaw);
  body.position.set(
    localX + recessZ * sinY,    // local +Z direction after yaw rotation
    localY,
    localZ + recessZ * cosY,
  );
  body.rotation.y = faceYaw;
  body.userData.noCollider = true;

  // Brass rim — thin frame around the panel face, sticking forward like
  // a fuse-box mounting ring.
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(sx * 1.10, sy * 1.10, sz * 0.20),
    _panelRimMat,
  );
  rim.position.set(0, 0, sz * 0.55);
  rim.userData.noCollider = true;
  body.add(rim);

  // ── Interior cavity (visible when door is open) ──────────────────
  // A dark backplate set deep inside the body. Sits at -Z (back face)
  // so when the door swings open the cavity reads as a real hollow.
  const interior = new THREE.Group();
  interior.position.set(0, 0, 0);
  interior.userData.noCollider = true;
  const backplate = new THREE.Mesh(
    new THREE.BoxGeometry(sx * 0.85, sy * 0.85, sz * 0.05),
    _panelInteriorMat,
  );
  backplate.position.set(0, 0, sz * 0.25);   // recessed into the body
  backplate.userData.noCollider = true;
  interior.add(backplate);

  // AAS — interior detail components driven by per-kind palette. Each
  // component is built by `makePanelComponent(kind, idx, slot, dims)`
  // which picks one of 5 fixed cavity slots (top-left wire, lower-left
  // wire, top-right chip, lower-right fuse, lower-center scrap) and
  // emits the appropriate mesh for the requested PanelComponentKind.
  // Both `panelComponentIndex` and `panelComponentKind` are tagged on
  // each mesh; the latter drives loot mapping in interaction.ts via
  // COMPONENT_LOOT.
  const palette = PANEL_COMPONENT_PALETTES[kind];
  const components: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const compKind = palette[i];
    const comp = makePanelComponent(compKind, i, sx, sy, sz);
    comp.userData.noCollider = true;
    comp.userData.panelComponentIndex = i;
    comp.userData.panelComponentKind = compKind;
    interior.add(comp);
    components.push(comp);
  }

  body.add(interior);

  // ── Hinged door (covers the cavity when closed) ──────────────────
  // The door is parented to a HINGE group offset to the LEFT edge of
  // the panel (body local -X), following real fuse-box convention
  // (hinge LEFT, handle RIGHT looking at the panel from outside).
  // Door thickness = sz * 0.30 so it reads as a real iron plate, not
  // paper-thin (rule 7).
  //
  // Session ABA — hinge convention. The hinge axis is +Y; the door
  // extends to body's +X (handle side). With three.js's right-hand
  // rule on +Y, a positive Y rotation around the hinge swings the
  // door's free edge from +X toward -Z (i.e. INTO the hull body).
  // We want OUTWARD swing (toward +Z, away from the hull surface),
  // so updatePanelDoors in interaction.ts applies the NEGATIVE of
  // `panelDoorAngle` to the hinge's `rotation.y`. The state field
  // stays positive (it's a magnitude); the sign is encoded once at
  // the application site. Don't change the rotation axis here.
  const hinge = new THREE.Group();
  hinge.position.set(-sx * 0.5, 0, sz * 0.60);   // hinge axis = left edge, slightly proud
  hinge.userData.noCollider = true;
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy * 0.96, sz * 0.30),
    _panelDoorMat,
  );
  // Door's local origin is centered; offset so the LEFT edge sits at hinge.
  door.position.set(sx * 0.5, 0, 0);
  door.userData.noCollider = true;
  hinge.add(door);
  // Door surface detail: 4 rivet bumps near corners + a handle on the right.
  for (const [rx, ry] of [
    [0.08, 0.40],
    [0.92, 0.40],
    [0.08, -0.40],
    [0.92, -0.40],
  ] as const) {
    const rivet = new THREE.Mesh(
      new THREE.CylinderGeometry(sx * 0.025, sx * 0.025, sz * 0.10, 6),
      _panelRimMat,
    );
    rivet.rotation.x = Math.PI / 2;
    rivet.position.set(sx * rx, sy * ry, sz * 0.20);
    rivet.userData.noCollider = true;
    hinge.add(rivet);
  }
  // Handle — small recessed grip on the right edge of the door.
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(sx * 0.05, sy * 0.20, sz * 0.12),
    _panelRimMat,
  );
  handle.position.set(sx * 0.92, 0, sz * 0.22);
  handle.userData.noCollider = true;
  hinge.add(handle);

  body.add(hinge);

  // AAS — electrical-flicker glow PointLight. Lives inside the cavity,
  // ignites on pry-complete, flickers + fades over ~3s. Shadows OFF
  // for perf (50+ panels with shadow lights would be expensive).
  // Starts at intensity=0 — interaction.ts flips panelGlowStartedAt
  // to ctx.time.elapsed on pry-complete; updatePanelDoors ticks the
  // intensity envelope from there.
  const glow = new THREE.PointLight(
    Tuning.SALVAGE_PANEL_GLOW_COLOR_HEX,
    0,
    Tuning.SALVAGE_PANEL_GLOW_RANGE_M,
    2.0,    // decay
  );
  glow.position.set(0, 0, sz * 0.45);   // near the front of the cavity
  glow.castShadow = false;
  body.add(glow);

  // Stash refs + animation state on body.userData so interaction.ts
  // can drive the door + hide components as they're extracted.
  body.userData.panelDoor = hinge;
  body.userData.panelInterior = interior;
  body.userData.panelGlow = glow;
  body.userData.panelGlowStartedAt = -1;        // -1 = not yet ignited
  body.userData.panelComponents = components;
  body.userData.panelDoorAngle = 0;            // current angle (rad)
  body.userData.panelDoorTarget = 0;           // target angle (0 closed, OPEN_ANGLE open)
  body.userData.panelOpened = false;           // false until pry completes

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
  cached.side = THREE.DoubleSide;
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
  // Rusty side panel. AAN: depth bumped 0.06 → 0.15 per CLAUDE.md rule 7
  // (sub-10cm decorations read paper-thin at oblique angles).
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(baseR * 2.2, baseR * 0.7, 0.15),
    _rustMat,
  );
  panel.position.set(0, nozzleH + baseR * 0.45, baseR * 1.02);
  panel.rotation.y = (rand() - 0.5) * 0.2;
  g.add(panel);
  // Salvage access panel — on the rusty side panel face, off-center.
  addAccessPanel(
    g,
    baseR * 0.55, nozzleH + baseR * 0.45, baseR * 1.12,
    scale,
    0,
    'engine_cluster',
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
  // End-cap on the open end (other end implied buried). AAN: was a
  // CircleGeometry (zero depth — paper-thin disc visible from edge
  // angles). Replaced with a short cylinder so the cap reads as
  // metal-with-thickness from any angle.
  const capDepth = 0.10;
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.92, radius * 0.92, capDepth, 14),
    _hullDarkMat,
  );
  cap.rotation.z = Math.PI / 2;
  cap.position.set(-length / 2 + capDepth / 2, radius * 0.55, 0);
  g.add(cap);
  // Salvage access panel — on the side of the tube, near the rust band.
  addAccessPanel(
    g,
    length * 0.32, radius * 1.05, radius * 0.05,
    scale,
    0,
    'fuselage',
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
  // Open hatch — a small rotated box punched out the front. AAN:
  // depth bumped 0.04 → 0.12 (CLAUDE.md rule 7).
  const hatch = new THREE.Mesh(
    new THREE.BoxGeometry(r * 0.7, r * 0.7, 0.12),
    _hullDarkMat,
  );
  hatch.position.set(r * 0.82, r * 0.5, 0);
  hatch.rotation.y = -0.4;
  g.add(hatch);
  // Rust patch. AAN: depth bumped 0.05 → 0.12.
  const patch = new THREE.Mesh(
    new THREE.BoxGeometry(r * 0.5, r * 0.4, 0.12),
    _rustMat,
  );
  patch.position.set(-r * 0.5, r * 0.65, r * 0.28);
  patch.rotation.set(0.3, -0.4, 0.1);
  g.add(patch);
  // Salvage access panel — opposite side from the broken hatch so both ends
  // of the pod feel utilized.
  addAccessPanel(
    g,
    -r * 0.75, r * 0.45, -r * 0.15,
    scale,
    Math.PI,
    'escape_pod',
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
  // Hinge door rectangle on one face. AAN: width bumped 0.04 → 0.10
  // so the door reads as solid metal from oblique angles.
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, h * 0.78, d * 0.7),
    _hullDarkMat,
  );
  door.position.set(w / 2 + 0.05, h * 0.45, 0);
  g.add(door);
  // Salvage access panel — beside the door, lower on the box so you crouch
  // a touch to align (reads as "scavenger-modified access point").
  addAccessPanel(
    g,
    w / 2 + 0.08, h * 0.30, d * 0.30,
    scale,
    Math.PI / 2,
    'cargo_container',
  );
  return g;
}

// KK — the small `makeSatelliteDish` factory that used to live here
// was superseded by the dedicated `placeSatelliteDish` module
// (src/world/satelliteDish.ts), which builds a flagship-scale POI
// with a walkable base, hollow interior + shelter zone, and detailed
// rusted/patchwork panels. The small variant was deleted: procgen /
// hero-landmark rotations don't use satellite dishes, so there's
// no remaining caller.

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
  addAccessPanel(g, R * 1.05, midY, 0, scale, Math.PI / 2, 'engine_bell');
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
      // Hull plate fragment. AAN: thickness bumped 0.04 → 0.10 so it
      // reads as a real piece of metal at oblique angles (rule 7).
      const w = 0.4 + rand() * 0.4;
      const d = 0.3 + rand() * 0.3;
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.10, d),
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
