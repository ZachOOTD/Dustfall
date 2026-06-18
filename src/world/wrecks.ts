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
import { mergeStaticByMaterial } from './wreckForms.ts';
import { buildSalvageComponents, makeBreakerBoard, makeLootComponent } from './panelGreeble.ts';   // breaker-board skeleton + salvageable modules
import { makeRng } from '../core/rng.ts';
import { createRustedHullMaterial } from './hullMaterial.ts';
import { createMetalMaterial } from './metalMaterial.ts';   // ACAX — rusted panel exterior
import { makePanelMask, applyPortalInterior } from './panelPortal.ts';   // ACAX — stencil-portal interior

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
// ACAX — the panel EXTERIOR (body cavity shell, rim, door) now uses the rust
// shader (createMetalMaterial, localSpace so the weathering doesn't crawl as the
// door swings) so the panel reads as OLD + RUSTED like the hull, not a flat plate.
//
// ACAX — body is DOUBLE-SIDED (was BackSide). The old BackSide trick culled the
// front face so it didn't occlude the open cavity (ABG) — but it ALSO culled the
// box's OUTER side walls, so from an oblique angle you saw THROUGH the recess
// (the panel looked like it floated, unconnected to the hull). DoubleSide renders
// the side walls from both sides → the recess reads as a solid box cut into the
// hull. The front face occluding the cavity is no longer a problem: the stencil-
// portal interior (depthTest off) draws OVER it within the opening, and the rim
// hides the thin edge ring. shadowSide FrontSide avoids small-box self-shadowing.
// The door + body use the HULL rust shader (createRustedHullMaterial): its
// oxidation patchwork + drip streaks + plate-wear + bare-metal flecks read as a
// DYNAMIC rusted surface even on a flat plate (the plain metal shader read flat).
// Pushed harder than the hull (more wear/ox/flecks) so a salvage panel looks like
// the most beaten part of the wreck. World-space weathering crawls slightly while
// the door SWINGS, but closed doors (the common state) + settled-open doors are
// static, so it's not noticeable.
const _panelBodyMat = createRustedHullMaterial({
  baseColor: 0x2c2116, streakIntensity: 0.55, wearAmplitude: 0.34, oxStrength: 0.55, fleckStrength: 0.8,
});
_panelBodyMat.side = THREE.DoubleSide;
_panelBodyMat.shadowSide = THREE.FrontSide;
// ACAX — the body is recessed FLUSH, so its front face is coplanar with the hull
// surface; with DoubleSide that front face z-FIGHTS the hull (the "wreck flickering
// through" the open cavity edge). polygonOffset biases the body's depth BACK so the
// hull consistently wins at the shared plane — no flicker — while the proud rim/door
// + the portal interior (depthTest off) still draw over it fine.
_panelBodyMat.polygonOffset = true;
_panelBodyMat.polygonOffsetFactor = 1.0;
_panelBodyMat.polygonOffsetUnits = 2.0;
// ACAX — was a tarnished-brass "spot the panel" affordance, but the gold read too
// clean/flat. Now a rusted weathered-iron frame (rim bars, rivets, bolt studs,
// handle): a dark steel-brown base + heavy rust + fine wornScale so the orange
// corrosion patches + scratches read as OLD METAL, not a flat colour. Kept a touch
// lighter than the door so the frame still reads. localSpace (the door rivets swing).
const _panelRimMat = createMetalMaterial(0x6a563c, { rustLevel: 0.72, wornScale: 1.5, scratchStrength: 0.1, localSpace: true });
// The door is SMALL (~0.5m), so the hull shader's low-frequency oxidation patchwork
// (~7m features) covers it in one flat zone — it read uniform. createMetalMaterial's
// weathering is tuned for CLOSE-RANGE fine detail; a small `wornScale` (fine rust/wear
// blotches) + strong rust + visible scratches gives the door real high-frequency
// variation. localSpace so the weathering doesn't crawl while the door swings.
const _panelDoorMat = createMetalMaterial(0x40301f, {
  rustLevel: 0.88, wornScale: 1.4, scratchStrength: 0.12, localSpace: true,
});
// The cavity backplate. ACAX — the 5 lootable extractables no longer use their own
// per-kind materials here; `makeLootComponent` (panelGreeble.ts) builds them from
// the shared greeble palette so they match the new interior, so only the backplate
// material lives here now.
const _panelInteriorMat = new THREE.MeshLambertMaterial({
  color: 0x161009,             // deep cavity — dark warm brown (not a black void)
  flatShading: true,
});

// ACAX Tier A — the backplate is a stencil-portal material (draws only inside the
// panel window, over a clipping hull, sorted back-to-front). Applied ONCE at module
// load; the greeble library does the same to its own materials in panelGreeble.ts.
// The body/rim/door stay normal (they're the hull-side surface, not interior).
if (Tuning.SALVAGE_PANEL_PORTAL_ENABLED) {
  applyPortalInterior([_panelInteriorMat]);
}

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

// ── ACAV Tier 3+ — panel shape / size / archetype ───────────────────
/** Panel silhouette. `'square'` is `'rect'` with aspect 1 (one geometry path);
 *  `'circle'` is a round inspection port with a bolted lift-off cover. */
export type PanelShape = 'rect' | 'square' | 'circle';
/** Drives the interior generator (Tier 4). Each archetype = a 5-slot extractable
 *  palette + a decorative-greeble recipe + a default shape/size. */
export type PanelArchetype = 'electrical' | 'plumbing' | 'avionics' | 'mechanical' | 'junction';
/** Trailing options for addAccessPanel. Absent ⇒ today's exact rectangular panel
 *  (zero new behaviour) so existing callers + the regression baseline are unchanged. */
export interface AccessPanelOpts {
  /** Full part-local orientation (the Tier-2 sampler passes this for a flush mount). */
  orientQuat?: THREE.Quaternion;
  /** Silhouette. Default 'rect'. */
  shape?: PanelShape;
  /** Height:width ratio (sy/sx). Default = SIZE_Y/SIZE_X (≈1.55). Ignored for circle. */
  aspect?: number;
  /** Interior archetype (Tier 4). */
  archetype?: PanelArchetype;
  /** Deterministic RNG for greeble jitter (Tier 4); position-seeded by the caller. */
  rand?: Rng;
}

/** ACAV Tier 4 — the 5 LOOTABLE components per archetype. Reuses the existing 7
 *  PanelComponentKinds so COMPONENT_LOOT + the loot economy are untouched; the
 *  archetype only varies WHICH 5 + the decorative greeble around them. */
export const ARCHETYPE_EXTRACTABLES: Record<PanelArchetype, readonly PanelComponentKind[]> = {
  electrical: ['red_wire', 'red_wire', 'yellow_wire', 'fuse', 'chip'],
  plumbing:   ['scrap_chunk', 'red_wire', 'fuse', 'cloth_scrap', 'scrap_chunk'],
  avionics:   ['chip', 'chip', 'yellow_wire', 'fuse', 'scrap_chunk'],
  mechanical: ['scrap_chunk', 'scrap_chunk', 'fuse', 'red_wire', 'chip'],
  junction:   ['red_wire', 'yellow_wire', 'fuse', 'cloth_scrap', 'scrap_chunk'],
};

/** ACAX — derive a default interior archetype from the panel's wreck-kind. Used
 *  by addAccessPanel as a FALLBACK when a caller doesn't pass `opts.archetype`:
 *  14 of the 16 hand-modeled-wreck + POI callsites (megaShip, megaWreck, crashed-
 *  hull, satelliteDish, engineBlock, saltOutpost, rockyEntrance, poi) omitted it,
 *  so they were stuck on the OLD legacy interior while only procgen got the new
 *  scrappy greeble. Deriving here makes EVERY panel get the V2 interior in one
 *  place (no need to touch all 8 files). Hand-modeled wrecks aren't part of the
 *  seeded procgen rand stream, so the position-seeded greeble rand is D208-safe. */
export function archetypeForKind(kind: PanelKind): PanelArchetype {
  switch (kind) {
    case 'engine_cluster': return 'mechanical';
    case 'engine_bell':    return 'mechanical';
    case 'cargo_container': return 'junction';
    case 'escape_pod':     return 'avionics';
    case 'fuselage':       return 'electrical';
    case 'massive':        return 'junction';
    default:               return 'electrical';
  }
}

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
  rand: Rng,
): THREE.Object3D {
  // 5 slot positions inside the cavity. The slot picks WHERE the
  // component lives; the kind picks WHAT it looks like. Some slot/kind
  // pairings need geometric overrides (e.g. a wire in the top-right
  // slot reads as horizontal not vertical) but the simplest first pass
  // is "kind dictates geometry, slot dictates position."
  // Small loose lootable parts tucked into the FRONT of the cavity (in front of the
  // greeble structure), in tidy slots so they read as "loose bits to grab", not
  // scattered junk. Extraction fills slot 0 first, so a corroded panel (few parts)
  // shows the lower-front slots populated, the rest empty — a picked-over read.
  const slotPositions: ReadonlyArray<{ x: number; y: number; z: number }> = [
    { x: -sx * 0.24, y: -sy * 0.30, z: sz * 0.36 },  // slot 0: lower-left
    { x:  sx * 0.06, y: -sy * 0.32, z: sz * 0.36 },  // slot 1: lower-centre
    { x:  sx * 0.26, y: -sy * 0.26, z: sz * 0.36 },  // slot 2: lower-right
    { x: -sx * 0.20, y:  sy * 0.10, z: sz * 0.36 },  // slot 3: mid-left
    { x:  sx * 0.22, y:  sy * 0.12, z: sz * 0.36 },  // slot 4: mid-right
  ];
  const p = slotPositions[slot];
  // ACAX — delegate the visual to makeLootComponent (the greeble-style builder) so
  // the lootable parts match the rest of the new interior instead of reading as the
  // OLD crude flat boxes mixed in. The slot fixes WHERE it sits; kind picks WHAT.
  const comp = makeLootComponent(kind, sx * 0.92, rand);
  comp.position.set(p.x, p.y, p.z);
  comp.rotation.z = (rand() - 0.5) * 0.5;
  return comp;
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
  opts: AccessPanelOpts = {},
): THREE.Mesh {
  // ACAV Tier 3 — shape + size. 'square' = rect with aspect 1; 'circle' = a round
  // port (width == height, bore radius sx/2). Absent opts ⇒ today's exact rect, so
  // every existing caller + the regression baseline is byte-unchanged.
  const shape = opts.shape ?? 'rect';
  const isCircle = shape === 'circle';
  const aspectRatio = (isCircle || shape === 'square')
    ? 1
    : (opts.aspect ?? (Tuning.SALVAGE_PANEL_SIZE_Y / Tuning.SALVAGE_PANEL_SIZE_X));
  const sx = Tuning.SALVAGE_PANEL_SIZE_X * scale;
  const sy = Tuning.SALVAGE_PANEL_SIZE_X * scale * aspectRatio;
  const sz = Tuning.SALVAGE_PANEL_SIZE_Z * scale;
  const radius = sx * 0.5;

  // ACAX — resolve the interior archetype: a caller's explicit `opts.archetype`
  // (procgen) wins; otherwise derive one from `kind` so the 14 hand-modeled/POI
  // callsites that omit it still get the V2 scrappy interior (not the old legacy
  // one). `greebleRand` falls back to a STABLE position-seeded stream (these
  // hand-modeled wrecks aren't in the seeded procgen rand stream → D208-safe, and
  // a position seed keeps each panel's greeble stable + varied across panels).
  const archetype: PanelArchetype | undefined = opts.archetype
    ?? (Tuning.SALVAGE_PANEL_INTERIOR_V2 ? archetypeForKind(kind) : undefined);
  const greebleRand = opts.rand
    ?? makeRng((Math.abs(Math.round(localX * 137.1 + localY * 311.7 + localZ * 547.3)) % 0x7fffffff) || 1);

  // Panel root mesh — the body, the interact target + the rusted RECESSED CAVITY.
  // AAU — shifted BACK by sz/2 so its FRONT face is flush with the hull; the rim +
  // closed door/cover sit just proud, the cavity recesses in. ABG — BackSide-cloned
  // material so the front face doesn't occlude the cavity interior when open.
  // ACAV Tier 3 — circle uses a CylinderGeometry BORE (axis rotated to +Z) so the
  // round cavity wall reads when the cover lifts off; rect/square stay a box.
  const bodyGeo = isCircle
    ? new THREE.CylinderGeometry(radius, radius, sz, 22).rotateX(Math.PI / 2)
    : new THREE.BoxGeometry(sx, sy, sz);
  const body = new THREE.Mesh(bodyGeo, _panelBodyMat);
  body.userData.panelShape = shape;
  // ACAV Tier 2 — orient from a FULL quaternion (the shape-agnostic sampler passes
  // one for a flush mount) else a yaw-only quaternion from faceYaw. The recess runs
  // along local −Z so it composes with any orientation; yaw-only reproduces the old
  // `recessZ*sin(yaw), 0, recessZ*cos(yaw)` exactly.
  const recessZ = -sz / 2;
  const q = opts.orientQuat ?? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), faceYaw);
  const recessOff = new THREE.Vector3(0, 0, recessZ).applyQuaternion(q);
  body.position.set(localX + recessOff.x, localY + recessOff.y, localZ + recessOff.z);
  body.quaternion.copy(q);
  body.userData.noCollider = true;

  // Brass rim — thin frame around the panel face, sticking forward like
  // a fuse-box mounting ring. ABI bugfix — pre-ABI implementation was a
  // single SOLID BoxGeometry covering the entire panel face area which,
  // combined with ABG's BackSide body fix, occluded the cavity even
  // when the door was swung open (the rim mesh stayed in front of the
  // cavity as an opaque brass plate). Rebuilt here as 4 separate thin
  // bars (top / bottom / left / right) forming an actual hollow
  // rectangular frame so the door-opening interior is unobstructed
  // when the door swings out of the way. Outer extent matches the
  // pre-ABI footprint (sx*1.10 × sy*1.10) so silhouette + closed-door
  // appearance are unchanged from outside.
  const rimDepth = sz * 0.20;
  const rimZ = sz * 0.55;
  if (!isCircle) {
    const rimBorderX = sx * 0.10;   // left/right bar thickness
    const rimBorderY = sy * 0.10;   // top/bottom bar thickness
    const rimOuterX = sx * 1.10;
    const rimOuterY = sy * 1.10;
    // Top + bottom bars span the full outer width.
    for (const yy of [rimOuterY * 0.5 - rimBorderY * 0.5,
                      -(rimOuterY * 0.5 - rimBorderY * 0.5)]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(rimOuterX, rimBorderY, rimDepth), _panelRimMat);
      bar.position.set(0, yy, rimZ);
      bar.userData.noCollider = true;
      body.add(bar);
    }
    // Left + right bars span only the interior height (no corner double-stack).
    const sideBarH = rimOuterY - 2 * rimBorderY;
    for (const xx of [rimOuterX * 0.5 - rimBorderX * 0.5,
                      -(rimOuterX * 0.5 - rimBorderX * 0.5)]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(rimBorderX, sideBarH, rimDepth), _panelRimMat);
      bar.position.set(xx, 0, rimZ);
      bar.userData.noCollider = true;
      body.add(bar);
    }
  } else {
    // ACAV Tier 3 — circle: a bolted ring rim. A thick torus (inherently NOT
    // paper-thin — rule 7) + brass bolt-head studs evenly around it.
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.99, sz * 0.16, 8, 30), _panelRimMat);
    ring.position.set(0, 0, rimZ * 0.7);
    ring.userData.noCollider = true;
    body.add(ring);
    const bolts = 8;
    for (let b = 0; b < bolts; b++) {
      const a = (b / bolts) * Math.PI * 2 + Math.PI / bolts;
      const stud = new THREE.Mesh(new THREE.CylinderGeometry(sx * 0.045, sx * 0.045, sz * 0.22, 6), _panelRimMat);
      stud.rotation.x = Math.PI / 2;
      stud.position.set(Math.cos(a) * radius * 0.99, Math.sin(a) * radius * 0.99, rimZ * 0.85);
      stud.userData.noCollider = true;
      body.add(stud);
    }
  }

  // ── Interior cavity (visible when door is open) ──────────────────
  // A dark backplate set deep inside the body. Sits at -Z (back face)
  // so when the door swings open the cavity reads as a real hollow.
  const interior = new THREE.Group();
  interior.position.set(0, 0, 0);
  interior.userData.noCollider = true;
  // ACAX perf — the cavity interior is only ever VISIBLE through the stencil
  // portal while the door is OPEN; updatePanelDoors gates this group's visibility
  // on the open state so a closed panel's ~10 merged greeble draw calls are
  // skipped entirely (the common case — most panels stay shut).
  interior.visible = false;
  // ACAX — backplate sized to fully BACK the stencil-portal window (mask is *INSET
  // ≈0.88) so the hull can't peek through gaps at the cavity edges. A touch of depth
  // (a shallow box, not a paper plate) so oblique angles still see dark cavity, not
  // the hull behind.
  const backplate = new THREE.Mesh(
    isCircle
      ? new THREE.CylinderGeometry(radius * 0.99, radius * 0.99, sz * 0.16, 22).rotateX(Math.PI / 2)
      : new THREE.BoxGeometry(sx * 0.99, sy * 0.99, sz * 0.16),
    _panelInteriorMat,
  );
  // ACAV Tier 4 — push the backplate to the body BACK for V2 so the rich greeble
  // has real cavity depth to layer in (V1's shallow mid-cavity plate read flat).
  backplate.position.set(0, 0, (Tuning.SALVAGE_PANEL_INTERIOR_V2 && archetype) ? -sz * 0.34 : sz * 0.25);
  backplate.userData.noCollider = true;
  // ACAX — portal depth bands: backplate is the deepest layer (drawn first among
  // the transparent, depthTest-off interior); greeble = +1, extractables = +2.
  backplate.renderOrder = Tuning.SALVAGE_PANEL_INTERIOR_RENDER_ORDER;
  interior.add(backplate);

  // AAS — interior detail components driven by per-kind palette. Each
  // component is built by `makePanelComponent(kind, idx, slot, dims)`
  // which picks one of 5 fixed cavity slots (top-left wire, lower-left
  // wire, top-right chip, lower-right fuse, lower-center scrap) and
  // emits the appropriate mesh for the requested PanelComponentKind.
  // Both `panelComponentIndex` and `panelComponentKind` are tagged on
  // each mesh; the latter drives loot mapping in interaction.ts via
  // COMPONENT_LOOT.
  // ACAX — REALISTIC breaker-board interior: a FIXED skeleton (mounting board + a 3x4
  // grid of empty bay-sockets + DIN rails + bus bar + wiring trough + terminal + labels)
  // that is ALWAYS present (merged, NOT salvageable), with 5 salvageable BREAKER modules
  // clipped onto the first 5 bays at the same slot/depth. Pulling a module (extraction
  // only hides) reveals its fixed socket → the panel reads as a real engineered board
  // at full, half-stripped (clean left/right boundary), and fully-gutted. registerSalvageable
  // hides the surplus modules past the condition count. The realism is in the fixed
  // skeleton — alignment + repetition, ZERO jitter.
  const components: THREE.Object3D[] = [];
  if (Tuning.SALVAGE_PANEL_INTERIOR_V2 && archetype) {
    const dims = {
      hw: (isCircle ? radius : sx * 0.5) * 0.82,
      hh: (isCircle ? radius : sy * 0.5) * 0.82,
      depth: sz,
      isCircle,
    };
    // Fixed board skeleton (always there) — merged (the wreck-level merge skips
    // accessPanel subtrees) into a small handful of meshes, behind the modules.
    const skeleton = makeBreakerBoard(dims, archetype, greebleRand);
    // includeTransparent: the portal materials are transparent; the board is built
    // back-to-front so the merged buffer order is the correct draw order. Collapses
    // the ~100 bay/rail/socket sub-meshes to ~1 per material.
    mergeStaticByMaterial(skeleton, { includeTransparent: true });
    skeleton.traverse((n) => { n.renderOrder = Tuning.SALVAGE_PANEL_INTERIOR_RENDER_ORDER + 1; });
    interior.add(skeleton);
    // 5 salvageable breaker modules — separate + tagged, in FRONT (+2) so each occludes
    // its bay until salvaged.
    const comps = buildSalvageComponents(archetype, dims, greebleRand);
    comps.forEach((c, i) => {
      mergeStaticByMaterial(c.obj, { includeTransparent: true });
      c.obj.userData.noCollider = true;
      c.obj.userData.panelComponentIndex = i;
      c.obj.userData.panelComponentKind = c.kind;
      c.obj.traverse((n) => { n.renderOrder = Tuning.SALVAGE_PANEL_INTERIOR_RENDER_ORDER + 2; });
      interior.add(c.obj);
      components.push(c.obj);
    });
  } else {
    // Legacy fallback (no archetype): the per-kind 5-component palette.
    const palette = PANEL_COMPONENT_PALETTES[kind];
    for (let i = 0; i < 5; i++) {
      const compKind = palette[i];
      const comp = makePanelComponent(compKind, i, sx, sy, sz, greebleRand);
      comp.userData.noCollider = true;
      comp.userData.panelComponentIndex = i;
      comp.userData.panelComponentKind = compKind;
      comp.traverse((n) => { n.renderOrder = Tuning.SALVAGE_PANEL_INTERIOR_RENDER_ORDER + 1; });
      interior.add(comp);
      components.push(comp);
    }
  }

  body.add(interior);

  // ── Door / cover (covers the cavity when closed) ─────────────────
  // Rect/square: a HINGED door, hinge at the LEFT edge (+Y axis). ABA — a positive
  // Y rotation swings the free edge INTO the hull, so updatePanelDoors applies the
  // NEGATIVE of panelDoorAngle for OUTWARD swing; the state field stays a positive
  // magnitude. Circle: a bolted LIFT-OFF cover that slides out + tumbles ajar.
  // BOTH pivots are named `body.userData.panelDoor` so the bury-audit/prune door-
  // exclusion + completePry drive them unchanged. Thickness sz*0.30 = a real plate
  // (rule 7).
  let panelDoorPivot: THREE.Group;
  if (!isCircle) {
    const hinge = new THREE.Group();
    hinge.position.set(-sx * 0.5, 0, sz * 0.60);   // hinge axis = left edge, slightly proud
    hinge.userData.noCollider = true;
    // ACAX — a riveted hatch with GEOMETRIC relief, not a flat plate. A flat
    // ~0.5m door reads flat in any light (material alone can't fix it); a raised
    // stamped inner panel + reinforcement ridges throw real shadow lines so it
    // reads as a beaten, dynamic hatch. Built centred then offset so its LEFT edge
    // sits at the hinge. The same-material parts are merged (plate+inset+ridges →
    // 1 mesh, rivets+handle → 1 mesh) so the richer door is actually CHEAPER than
    // the old 6-mesh door.
    const doorVisual = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(sx, sy * 0.96, sz * 0.30), _panelDoorMat);
    doorVisual.add(plate);
    const inset = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.70, sy * 0.66, sz * 0.40), _panelDoorMat);
    inset.position.z = sz * 0.05;                  // raised stamped panel → border groove
    doorVisual.add(inset);
    for (const ry of [0.30, -0.30]) {              // 2 reinforcement ridges
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.92, sy * 0.055, sz * 0.46), _panelDoorMat);
      ridge.position.set(0, sy * ry, sz * 0.03);
      doorVisual.add(ridge);
    }
    for (const [rx, ry] of [[-0.42, 0.42], [0.42, 0.42], [-0.42, -0.42], [0.42, -0.42]] as const) {
      const rivet = new THREE.Mesh(new THREE.CylinderGeometry(sx * 0.025, sx * 0.025, sz * 0.10, 6), _panelRimMat);
      rivet.rotation.x = Math.PI / 2;
      rivet.position.set(sx * rx, sy * ry, sz * 0.24);
      doorVisual.add(rivet);
    }
    const handle = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.05, sy * 0.20, sz * 0.12), _panelRimMat);
    handle.position.set(sx * 0.40, 0, sz * 0.26);
    doorVisual.add(handle);
    mergeStaticByMaterial(doorVisual);
    doorVisual.position.set(sx * 0.5, 0, 0);       // local origin centred; LEFT edge at the hinge
    doorVisual.traverse((n) => { n.userData.noCollider = true; });
    hinge.add(doorVisual);
    body.add(hinge);
    panelDoorPivot = hinge;
    // ACAX — refs for the 50%-chance pop-off (panelDebris.ts detaches this visual
    // + spawns a physics body sized to these local half-extents).
    body.userData.panelDoorVisual = doorVisual;
    body.userData.panelDoorExtents = { hx: sx * 0.5, hy: sy * 0.48, hz: sz * 0.25 };
  } else {
    // ACAV Tier 3 — circle: a bolted disc cover on a pivot at the bore mouth.
    const coverPivot = new THREE.Group();
    coverPivot.position.set(0, 0, sz * 0.55);
    coverPivot.userData.noCollider = true;
    // updatePanelDoors reads these to slide the cover out + tumble it ajar (its
    // local +Z base + how far it travels at full open).
    coverPivot.userData.panelCoverBaseZ = sz * 0.55;
    coverPivot.userData.panelCoverSlide = sz * 1.6;
    const cover = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.04, radius * 1.04, sz * 0.30, 22).rotateX(Math.PI / 2),
      _panelDoorMat,
    );
    cover.userData.noCollider = true;
    coverPivot.add(cover);
    // 6 brass bolt-heads in a ring + a centre grip nub.
    for (let b = 0; b < 6; b++) {
      const a = (b / 6) * Math.PI * 2;
      const stud = new THREE.Mesh(new THREE.CylinderGeometry(sx * 0.04, sx * 0.04, sz * 0.14, 6), _panelRimMat);
      stud.rotation.x = Math.PI / 2;
      stud.position.set(Math.cos(a) * radius * 0.62, Math.sin(a) * radius * 0.62, sz * 0.17);
      stud.userData.noCollider = true;
      coverPivot.add(stud);
    }
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(sx * 0.07, sx * 0.07, sz * 0.20, 8), _panelRimMat);
    grip.rotation.x = Math.PI / 2;
    grip.position.set(0, 0, sz * 0.22);
    grip.userData.noCollider = true;
    coverPivot.add(grip);
    body.add(coverPivot);
    panelDoorPivot = coverPivot;
    // ACAX — pop-off refs (the cover + studs + grip all ride the pivot).
    body.userData.panelDoorVisual = coverPivot;
    body.userData.panelDoorExtents = { hx: radius, hy: radius, hz: sz * 0.20 };
  }

  // ACAX Tier A — stencil-portal MASK. A quad/disc at the opening mouth that
  // writes stencil=REF so the interior renders THROUGH a clipping hull but stays
  // confined to the mouth. Sized a touch inside the rim (INSET) so the interior
  // can't spill over the frame; placed at the mouth plane (+sz/2). Starts hidden
  // — the closed door covers the mouth; updatePanelDoors reveals it as the door
  // swings clear (and spawnPanelStudio's force-open sets it directly).
  if (Tuning.SALVAGE_PANEL_PORTAL_ENABLED) {
    const inset = Tuning.SALVAGE_PANEL_MASK_INSET;
    const mask = makePanelMask(isCircle, sx * inset, sy * inset, radius * inset, sz * 0.5);
    body.add(mask);
    body.userData.panelMask = mask;
  }

  // AAS — electrical-flicker glow. Pre-ABL each panel got its own
  // PointLight parented here (intensity=0 until pry). With ~68 panels
  // in-world that drove total scene PointLights to ~96, inflating
  // every lit fragment shader by 68 always-evaluated lights. ABL —
  // perf: lights now claimed from the shared lightPool on pry-complete
  // and released on fade-complete (mirrors fires + lanterns). The
  // cavity ANCHOR position (in body-local) is stashed here; the glow
  // tick in interaction.ts uses it to position the claimed light each
  // ignite. Shadows still OFF when claimed (interaction sets this).
  body.userData.panelGlow = null;               // ABL — pool light when active, null when idle
  // ACAV Tier 4 — for the deep V2 cavity, sit the pry-glow more CENTRALLY (sz*0.10)
  // so it lights the layered greeble at the back, not just the mouth; V1's shallow
  // cavity keeps the near-mouth anchor.
  body.userData.panelGlowAnchorLocal = new THREE.Vector3(0, 0,
    (Tuning.SALVAGE_PANEL_INTERIOR_V2 && archetype) ? sz * 0.10 : sz * 0.45);

  // Stash refs + animation state on body.userData so interaction.ts
  // can drive the door + hide components as they're extracted.
  body.userData.panelDoor = panelDoorPivot;
  body.userData.panelInterior = interior;
  body.userData.panelGlowStartedAt = -1;        // -1 = not yet ignited
  body.userData.panelComponents = components;
  body.userData.panelDoorAngle = 0;            // current angle (rad)
  body.userData.panelDoorTarget = 0;           // target angle (0 closed, OPEN_ANGLE open)
  body.userData.panelOpened = false;           // false until pry completes

  group.add(body);
  group.userData.accessPanel = body;
  return body;
}

/** ACAV Tier 2 — mount a panel with a FULL part-local quaternion (from the
 *  shape-agnostic `findSurfaceMounts` sampler) so it sits flush on any hull
 *  surface. Thin wrapper over addAccessPanel; the faceYaw arg is unused because
 *  orientation comes entirely from `localQuat`. */
export function addAccessPanelOriented(
  group: THREE.Group,
  localPos: THREE.Vector3,
  localQuat: THREE.Quaternion,
  scale = 1,
  kind: PanelKind = 'fuselage',
  panelOpts: Omit<AccessPanelOpts, 'orientQuat'> = {},
): THREE.Mesh {
  return addAccessPanel(group, localPos.x, localPos.y, localPos.z, scale, 0, kind, { orientQuat: localQuat, ...panelOpts });
}

// ────────────────────────────────────────────────────────────────
// Shared 3D engine-bell mesh (Session CC-3). Replaces the prior
// torus-ring + flat-CircleGeometry pattern with a flared open-ended
// cone + recessed solid interior cylinder, so the bell has depth
// from every viewing angle. Caller positions + rotates the returned
// group; the bell's mouth opens at LOCAL +Y by default.
// ────────────────────────────────────────────────────────────────
const _bellOuterMatCache = new WeakMap<THREE.Material, THREE.Material>();
/** ACAZ T3 — exported so the procgen per-class re-skin can remap the bell's cloned
 *  DoubleSide flare material (which a `=== _hullMat` identity test would otherwise miss). */
export function _bellOuterMat(src: THREE.Material): THREE.Material {
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
  // Salvage access panel — ABI bugfix: pre-fix at (length*0.32, radius*1.05,
  // radius*0.05) the panel face sat INSIDE the cylinder body (at y=1.05r
  // the cylinder cross-section extends to z=±0.866r, so z=0.05r is well
  // inside). Cylinder's opaque FrontSide outer surface hid the panel face
  // entirely from outside angles. Moved to the +Z side surface at cylinder
  // midline height; pushed face out to z=radius*1.05 so it clears the rust
  // band (which sits at radius*1.02 ± panel sz/2 = 0.10) without sticking
  // proud of the band by more than 0.03m.
  addAccessPanel(
    g,
    length * 0.32, radius * 0.55, radius * 1.05,
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
  // of the pod feel utilized. ABI bugfix: pre-fix x position -r*0.75 sat
  // INSIDE the icosahedron hull (centered at y=r*0.42, radius r — distance
  // from hull center to (-0.75r, 0.03r, -0.15r) was ~0.77r, inside the r
  // hull surface). Hull's opaque FrontSide rendering hid the panel face.
  // Pushed face out to ~1.05r distance so it sits flush with the hull
  // surface on the -X side.
  addAccessPanel(
    g,
    -r * 1.05, r * 0.45, -r * 0.15,
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
  // Salvage access panel — ABI bugfix: previously sat on the +X face at
  // z=d*0.30 which overlapped the door decoration (centered z=0, depth
  // d*0.7 → spans ±d*0.35). With the door's box poking into the panel
  // cavity, ABG's BackSide body left the door visible through the
  // opened panel. Moved to the front +Z face which has no decorations
  // (only thin 0.08m corner struts at ±(w/2-0.05)), so the panel sits
  // flush + unobstructed. Off-center X reads as "scavenger-modified
  // access point" rather than centered factory door.
  addAccessPanel(
    g,
    w * 0.20, h * 0.40, d / 2,
    scale,
    0,
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
  // ACAS A1 — re-parent each debris mesh into this object instead of the scene
  // (default: scene), so a dense field can collect + static-merge them.
  parent?: THREE.Object3D,
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
    (parent ?? scene).add(mesh);
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
  // T6 — merge the static meshes by material (draw-call win); panels stay live.
  // Colliders (above) captured the per-part shapes first, so collision is intact.
  mergeStaticByMaterial(group);
  return group;
}
