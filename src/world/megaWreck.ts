// Mega-wreck POI — a sleek ~120m crashed DAGGER warship (ACAJ from-scratch
// rebuild, per docs/research/megawreck-concept.md). Narrow blade (~5:1), snapped
// in two at an amidships fracture, driven nose-first into a dune — entered through
// a bow hull breach and walked via a single spinal corridor through 6 chambers to
// the elevated bridge payoff.
//
// Architecture:
//   • INTERIOR = a list of `Cell` descriptors (corridor segments + rooms), each
//     expanded by `cellWallBoxes()` into axis-aligned boxes. BOTH the visual walls
//     (makeMegaWreck) and the cuboid colliders (placeMegaWreck) consume the SAME
//     descriptors, so geometry + collision never drift. Built LEVEL at y≈0.
//   • EXTERIOR = the `shell` group — a lofted faceted dagger hull (two masses +
//     fracture cross-section + command island + engines + breaches + plating),
//     ALL FrontSide + noCollider, TILTED into a list + sunk into the dune. The
//     hull generously ENVELOPS the level interior boxes so none poke through.
//
// Local space: +Z = aft/engine end, -Z = bow tip; y=0 = walkable floor; walls
// bury WALL_BURY below. Hull long-axis = Z (~123m: local Z -47..+76).

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import { Tuning } from '../config/tuning.ts';
import { addAccessPanel, placeDebrisField, makeEngineBellMesh } from './wrecks.ts';
import { makeLoftedHull, makeFormerRings, makeBreach, tagWreckDecoration, makeCable, makeSandMound } from './wreckForms.ts';
import { addShelterZone, type ShelterRegistry } from '../shelter/shelterZones.ts';
import { registerSalvageable, type SalvageableRegistry } from './salvage.ts';
import { placeJournal, type Journal } from './journal.ts';
import { createMetalMaterial } from './metalMaterial.ts';
import { createPaintedMetalMaterial } from './paintMaterial.ts';
import { createRustedHullMaterial } from './hullMaterial.ts';

// ── Shared materials (ABH procedural shader vocabulary).
// DoubleSide so the open lofted-hull belly/keel/nose never shows through to the
// interior or sky on the listed hull (interior box walls hold the inner surface).
const _hullMat = createRustedHullMaterial({ baseColor: Tuning.WRECK_HULL_HEX, streakIntensity: 0.85 });
_hullMat.side = THREE.DoubleSide;
const _hullDarkMat = createRustedHullMaterial({ baseColor: Tuning.WRECK_HULL_DARK_HEX, streakIntensity: 0.6 });
const _rustMat = createPaintedMetalMaterial(Tuning.WRECK_RUST_HEX, { wearLevel: 0.65 });
// DoubleSide so the recessed combustion disc never culls to invisible.
const _nozzleInteriorMat = new THREE.MeshBasicMaterial({ color: Tuning.WRECK_NOZZLE_INTERIOR_HEX, side: THREE.DoubleSide });
const _antennaMat = createMetalMaterial(Tuning.WRECK_ANTENNA_HEX, { wornScale: 6.0, scratchStrength: 0.04 });
const _pipeMat = createMetalMaterial(0x3a3028, { wornScale: 5.0, scratchStrength: 0.04 });
const _viewportMat = new THREE.MeshBasicMaterial({ color: 0x14181c, side: THREE.DoubleSide });
// Open-cone dishes are single-sided → DoubleSide so they don't vanish edge-on.
const _dishMat = createMetalMaterial(Tuning.WRECK_ANTENNA_HEX, { wornScale: 4.0, scratchStrength: 0.05 });
_dishMat.side = THREE.DoubleSide;
// Fresh oxidized torn metal (brighter orange) for fracture + breach rims so the
// cut reads distinct from the weathered skin.
const _tornMat = createPaintedMetalMaterial(0x8f5230, { wearLevel: 0.6 });
// Translucent rust-streak decal (hangs DOWN from features; +X-flank biased).
// DoubleSide so the flank streaks read from both viewing sides.
const _streakMat = new THREE.MeshBasicMaterial({ color: 0x6e3a22, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
void _rustMat;

// ── Exterior dagger masses (lofted). Bow mass -60..-5, aft mass +18..+76.
const FRACTURE_Z = 6;        // fracture center
const BOW_FACE_Z = -5;       // bow hull torn face
const AFT_FACE_Z = 18;       // aft hull torn face
const ISLAND_Z = 68;         // command island Z (over the bridge)
const TRANSOM_Z = 76;        // engine transom

// Loft stations (z, halfW, halfH, cy) shared by the hull geometry AND the surface
// sampler so flank decorations sit ON the hull (no floating/clipping).
type Station = { z: number; halfW: number; halfH: number; cy: number };
const BOW_STATIONS: Station[] = [
  { z: -60, halfW: 1.3, halfH: 2.0, cy: -1.0 },
  { z: -50, halfW: 5.0, halfH: 5.6, cy: 2.5 },
  { z: -32, halfW: 9.6, halfH: 9.0, cy: 4.5 },
  { z: -18, halfW: 11.2, halfH: 8.5, cy: 4.0 },
  { z: BOW_FACE_Z, halfW: 10.5, halfH: 7.0, cy: 2.0 },
];
const AFT_STATIONS: Station[] = [
  { z: AFT_FACE_Z, halfW: 11.5, halfH: 11.5, cy: 8.5 },
  { z: 36, halfW: 13.5, halfH: 14.0, cy: 9.5 },
  { z: 56, halfW: 13.0, halfH: 12.5, cy: 8.5 },
  { z: ISLAND_Z, halfW: 11.5, halfH: 10.5, cy: 7.5 },
  { z: TRANSOM_Z, halfW: 9.8, halfH: 8.0, cy: 6.0 },
];
/** Interpolate the hull cross-section at local Z (picks the right mass). Returns
 *  the flank half-width, dorsal/keel Y, and section centre — so a decoration can
 *  sit exactly ON the curved/tapered hull instead of at a fixed X/Y. */
function hullAt(z: number): { halfW: number; halfH: number; cy: number; dorsalY: number; keelY: number } {
  const st = z < (BOW_FACE_Z + AFT_FACE_Z) / 2 ? BOW_STATIONS : AFT_STATIONS;
  let a = st[0], b = st[st.length - 1];
  for (let i = 0; i < st.length - 1; i++) { if (z >= st[i].z && z <= st[i + 1].z) { a = st[i]; b = st[i + 1]; break; } }
  const t = b.z === a.z ? 0 : Math.max(0, Math.min(1, (z - a.z) / (b.z - a.z)));
  const halfW = a.halfW + (b.halfW - a.halfW) * t;
  const halfH = a.halfH + (b.halfH - a.halfH) * t;
  const cy = a.cy + (b.cy - a.cy) * t;
  return { halfW, halfH, cy, dorsalY: cy + halfH, keelY: cy - halfH };
}

// Shell tilt — roll + nose-down pitch + sink, but PIVOTED about a low aft-mid
// ground-contact point so the listing hull KISSES the ground instead of levering
// the aft up (pitching about the origin floated the aft ~10m). Shared by the mesh
// (makeMegaWreck) AND the exterior colliders (placeMegaWreck) so they stay locked.
const SHELL_ROLL = -0.30;    // ~17° roll toward +X impact flank
const SHELL_PITCH = -0.07;   // ~4° nose-down
const SHELL_SINK = -2.6;
const SHELL_PIVOT = new THREE.Vector3(0, -1, 40);   // low, aft-of-amidships keel
function shellQuat(): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(SHELL_PITCH, 0, SHELL_ROLL, 'XYZ'));
}
function shellPos(): THREE.Vector3 {
  const o = SHELL_PIVOT.clone().sub(SHELL_PIVOT.clone().applyQuaternion(shellQuat()));
  o.y += SHELL_SINK;
  return o;
}

// ── Interior cell model ────────────────────────────────────────────────
// A walkable box (corridor segment or room). Consecutive cells share OPEN Z
// faces (no wall between) → one connected interior. Side openings (the bow
// breach entrance, the shelter spur) cut a gap in an X wall.
// ── Interior v2 — the broken GUTS of the dagger, built in the SAME shell frame as
// the exterior (one rigid listed object; the floor carries the full ~17° list per
// the user's call). A walkable element is one DECK descriptor in SHELL-LOCAL space,
// consumed by BOTH the mesh builder (added to the tilted `shell` group) and the
// collider builder (pushed through the same shellQuat/shellPos). The cavity floor
// is inset UP from the keel of the hull cross-section (hullAt) so it's the literal
// inside of the skin — no poke-through by construction. The hull (DoubleSide) is
// the walls + ceiling; flank breaches + the open fracture admit light + are entries.
interface Deck { x: number; y: number; z: number; hx: number; hy: number; hz: number; rx?: number; ry?: number; rz?: number; collide: boolean; }

// Floor Y at a given Z: a fixed height up from the keel of the (shell-local) hull
// section, so the deck rides the lower-mid hull + tapers with it.
function deckY(z: number): number { return hullAt(z).keelY + 5.5; }

// The walkable floor: a continuous deck spine bow→aft (skipping the OPEN fracture
// gap -5..+17), plus the fracture-crossing fallen-beam bridge. Offset toward the
// down-rolled +X flank where the sheared decks settled. Shell-local; the shell
// supplies the list, so the floor is genuinely canted ~17° (authentic wreckage).
function interiorDecks(): Deck[] {
  const D: Deck[] = [];
  for (const [z0, z1] of [[-44, -6], [17, 72]] as const) {
    for (let z = z0; z < z1; z += 5) {
      const s = hullAt(z + 2.5);
      // The deck spans most of the lower-hull width so the flank decor rests ON it
      // (was 0.6 → a narrow strip that left the lee belly unfloored = floating decor).
      D.push({ x: 0.4, y: deckY(z + 2.5), z: z + 2.5, hx: s.halfW * 0.74, hy: 0.35, hz: 2.7, collide: true });
    }
  }
  // Fracture crossing — a WIDE fallen-bulkhead deck bridging the open break, rising
  // to meet the higher aft deck (no fall-off-the-plank, no big step).
  D.push({ x: 0.4, y: deckY(6) + 0.3, z: 8, hx: 4.5, hy: 0.45, hz: 13, rx: -0.06, rz: 0.04, collide: true });
  return D;
}

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}
function cyl(rTop: number, rBot: number, h: number, mat: THREE.Material, seg = 8): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
}

/** Build the mega-wreck meshes (interior walls + exterior dagger shell). */
export function makeMegaWreck(rand: Rng): THREE.Group {
  const _rand = rand;
  const g = new THREE.Group();
  const dark = _hullDarkMat;

  // ════════════════════════════════════════════════════════════════════
  // The whole wreck (exterior shell + interior guts) lives in ONE tilted+sunk
  // `shell` group so inside + outside are a single rigid listed object. The
  // exterior hull is DoubleSide → from inside you see the hull as the walls +
  // ceiling. The interior floor + wreckage are added to this same group.
  // ════════════════════════════════════════════════════════════════════
  const shell = new THREE.Group();
  shell.name = 'shell';
  const add = (m: THREE.Object3D) => { m.userData.noCollider = true; shell.add(m); };

  // ── INTERIOR GUTS (in the tilted shell frame). ──
  // Walkable floor decks (the colliders are built from the same interiorDecks() in
  // placeMegaWreck → mesh + collision locked).
  for (const d of interiorDecks()) {
    const m = box(d.hx * 2, d.hy * 2, d.hz * 2, dark);
    m.position.set(d.x, d.y, d.z); m.rotation.set(d.rx ?? 0, d.ry ?? 0, d.rz ?? 0); add(m);
  }
  // Wreckage decoration — peeled bulkheads, debris piles flowed to the down-+X
  // flank, exposed ribs where plating tore, hanging cables. Visual only.
  {
    // Frame ribs every ~10m along the walkable length — the ship's internal skeleton
    // showing where the plating peeled, exposed inside the hull (catches the fill).
    for (let z = -42; z < 70; z += 9) {
      if (Math.abs(z - 6) < 12) continue;     // skip the open fracture
      const s = hullAt(z);
      const rib = makeFormerRings(s.halfW * 0.94, 1, 1, { tube: 0.35 });
      rib.rotation.y = -Math.PI / 2; rib.position.set(0, s.cy, z); rib.scale.set(1, s.halfH / s.halfW, 1); add(rib);
    }
    // Peeled-inward bulkheads (from the +X impact side) — torn partial walls.
    for (const [z, h] of [[-26, 7], [34, 9], [56, 6]] as const) {
      const s = hullAt(z);
      const w = box(0.5, h, 4.5, dark); w.position.set(s.halfW * 0.5, deckY(z) + h / 2, z); w.rotation.set(0, 0, -0.32 - _rand() * 0.15); add(w);
      // a bent torn flap off its edge
      const fl = box(0.3, 2.5, 3, _tornMat); fl.position.set(s.halfW * 0.5 - 1, deckY(z) + h - 1, z); fl.rotation.set(0.3, 0.2, -0.6); add(fl);
    }
    // Varied wreckage debris flowed down toward the down-+X flank (torn plates, drums,
    // pipe fragments — NOT uniform cubes), half-settled on the canted floor.
    const debris = (z: number, n: number) => {
      const s = hullAt(z);
      for (let i = 0; i < n; i++) {
        const fx = s.halfW * (0.15 + _rand() * 0.5), fy = deckY(z) + 0.25 + _rand() * 0.5, fz = z + (_rand() - 0.5) * 6;
        const kind = _rand();
        let m: THREE.Mesh;
        if (kind < 0.45) { m = box(0.8 + _rand() * 2.2, 0.1 + _rand() * 0.3, 0.6 + _rand() * 2.0, dark); }   // torn plate
        else if (kind < 0.72) { m = cyl(0.5 + _rand() * 0.5, 0.5 + _rand() * 0.5, 1.4 + _rand(), dark, 8); }  // drum
        else if (kind < 0.9) { m = cyl(0.12, 0.12, 2 + _rand() * 3, _pipeMat, 6); }                            // pipe fragment
        else { m = box(0.5 + _rand(), 0.5 + _rand(), 0.5 + _rand(), dark); }                                   // chunk
        m.position.set(fx, fy, fz); m.rotation.set(_rand() * 3, _rand() * 3, _rand() * 3); add(m);
      }
    };
    for (const [z, n] of [[-38, 4], [-30, 5], [-12, 4], [22, 5], [30, 6], [40, 5], [58, 4], [66, 3]] as const) debris(z, n);
    // Overhead structure — collapsed deck beams + hanging duct runs across the upper
    // hull (gives the ceiling void mass + shadow, and reads as a torn-open deck).
    for (const [z, ang] of [[-28, 0.5], [24, -0.4], [44, 0.55], [62, -0.35]] as const) {
      const s = hullAt(z);
      // COLLAPSED beams — one end dropped (big tilt) + a torn cap, so they dangle from
      // the torn deck rather than spanning intact.
      const beam = box(s.halfW * 1.0, 0.5, 0.6, dark); beam.position.set(s.halfW * 0.25, s.dorsalY - 3 - _rand() * 1.5, z); beam.rotation.set(0.1, 0, ang); add(beam);
      const duct = cyl(0.4, 0.4, 4 + _rand() * 2, _pipeMat, 8); duct.rotation.x = Math.PI / 2 + 0.15; duct.position.set(s.halfW * 0.3, s.dorsalY - 4, z + 2); duct.rotation.z = 0.1; add(duct);
    }
    // Hanging cables from the torn upper deck-edges down to the floor, each with a
    // junction-box bracket at the top so it reads as anchored (not a floating wire).
    for (const [x, z, topY] of [[-3, -24, 8], [4, 32, 11], [-2, 38, 9], [2, -10, 7], [5, 48, 8], [-4, 60, 7]] as const) {
      const from = new THREE.Vector3(x, deckY(z) + topY, z);
      add(makeCable(from, new THREE.Vector3(x + 1.5, deckY(z) + 0.4, z + 2), 2.6, _pipeMat, 0.12));
      const br = box(0.5, 0.5, 0.5, dark); br.position.copy(from); add(br);
    }
    // Wall consoles / panels on the lee (-X) flank — seated ON the widened deck edge.
    for (const [z, h] of [[-20, 1.6], [28, 1.8], [50, 1.6]] as const) {
      const s = hullAt(z), cx = -s.halfW * 0.6;
      const housing = box(0.6, h + 0.3, 2.4, dark); housing.position.set(cx, deckY(z) + (h + 0.3) / 2, z); housing.rotation.set(0, 0, 0.22); add(housing);
      const scr = box(0.2, 0.8, 1.3, _viewportMat); scr.position.set(cx + 0.35, deckY(z) + h * 0.65, z); scr.rotation.set(0, 0, 0.22); scr.userData.noShadow = true; add(scr);
      const glow = new THREE.PointLight(0x3a6a8a, 0.4, 5, 2); glow.position.set(cx + 0.6, deckY(z) + h * 0.65, z); add(glow);
    }
    // Sand-fan intrusion pouring in through the bow-entry breach.
    const sandMat = new THREE.MeshLambertMaterial({ color: 0xb89968, flatShading: true });
    for (let i = 0; i < 4; i++) {
      const sd = cyl(0, 2 + i, 1.2, sandMat, 8);   // flattened sand cones
      sd.position.set(-hullAt(-40).halfW * 0.5 + i * 0.8, deckY(-40) + 0.3, -40 + i * 1.5);
      sd.scale.set(1, 0.4, 1); add(sd);
    }
  }

  // ── INTERIOR LIGHT (I4) — shafts of DAYLIGHT stab in through the breaches + the
  // open fracture (sun streaming into the wreck), each a visible god-ray cone + a
  // PointLight pooling on the floor; a dim cool fill so the upper hull/ceiling isn't
  // a black void; warm emergency lamps for contrast.
  {
    // Dim HEMISPHERE ambient locked to the wreck so the dark steel never crushes to
    // pure black (a warm sand-bounce floor + a cool sky from the breaches above).
    add(new THREE.HemisphereLight(0x8a93a0, 0x4a3a28, 0.5));
    const shaftMat = new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    // 3 daylight shafts at real openings (one dominant = the fracture sun).
    const shafts: Array<[number, number, number, number, number]> = [
      [0, 6, 0xfff1d6, 4.2, 44],            // the open fracture — dominant daylight flood
      [hullAt(30).halfW * 0.8, 30, 0xffe6c2, 2.4, 26],   // +X engineering breach
      [-hullAt(-40).halfW * 0.8, -40, 0xffe6c2, 2.2, 24], // bow-entry breach
    ];
    for (const [sx, sz, color, inten, dist] of shafts) {
      const top = hullAt(sz).dorsalY + 1, floorY = deckY(sz);
      const len = top - floorY;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(3.4, len, 14, 1, true), shaftMat);
      cone.position.set(sx * 0.5, (top + floorY) / 2, sz); cone.rotation.z = sx > 0 ? 0.25 : -0.25;
      cone.userData.noShadow = true; add(cone);
      const pl = new THREE.PointLight(color, inten, dist, 2);
      pl.position.set(sx * 0.4, floorY + 2.5, sz); add(pl);
    }
    // 2 cool fill lights at mid-height to read the canted upper hull (drop z=0 — it
    // pooled in the empty fracture gap).
    for (const z of [-30, 45]) {
      const s = hullAt(z);
      const f = new THREE.PointLight(0x9fb4cc, 0.6, 36, 1.5);
      f.position.set(0, s.cy + s.halfH * 0.3, z); add(f);
    }
    // Warm emergency lamp on the bridge (one focal point).
    const lamp1 = new THREE.PointLight(0xff9a4a, 1.3, 18, 2); lamp1.position.set(2.5, deckY(70) + 2.5, 70); add(lamp1);
  }


  // (A1) Bow mass — a sharp tapered wedge driving nose-first into the dune, riding
  // LOWER than the aft (snapped back) so the fracture reads as a hard notch.
  add(makeLoftedHull(BOW_STATIONS, _hullMat));

  // (A2) Aft mass — a fat-bellied wedge, widest + tallest amidships (height ~1/4
  // length so it reads as a dagger-wedge, not a plate), raking to a blunt transom.
  add(makeLoftedHull(AFT_STATIONS, _hullMat));

  // (A3) Mid-hull FRACTURE cross-section — the money shot. Cut-open guts in the
  // ~23m gap: backboard + former rings + countable staggered deck slabs + bent
  // spine stub + dangling cables + torn rim flaps. Aft mass rides ~2m higher.
  {
    const aS = hullAt(AFT_FACE_Z), bS = hullAt(BOW_FACE_Z);
    // Backboards sized to FULLY cover each torn cross-section (no see-through into
    // the hollow hull at the fracture mouth), centred on the station cy.
    // Lit dark hull backboards RECESSED ~4m into each mass (parallax depth so the
    // break reads as a recessed interior, not a flat black hole to the sky), with
    // the former rings + decks layered in front. A couple of interior bulkhead
    // silhouettes add depth.
    const aBack = box(aS.halfW * 2 + 1, aS.halfH * 2 + 1, 0.4, _hullDarkMat); aBack.position.set(0, aS.cy, AFT_FACE_Z + 4); add(aBack);
    const bBack = box(bS.halfW * 2 + 1, bS.halfH * 2 + 1, 0.4, _hullDarkMat); bBack.position.set(0, bS.cy, BOW_FACE_Z - 4); add(bBack);
    for (const [bz, s] of [[AFT_FACE_Z + 2.5, aS], [BOW_FACE_Z - 2.5, bS]] as const) {
      const bulk = box(s.halfW * 1.3, s.halfH * 1.6, 0.3, _viewportMat); bulk.position.set((bz > 0 ? -2 : 2), s.cy, bz); add(bulk);
    }
    // Exposed former rings (ribs) on each torn face.
    const af = makeFormerRings(aS.halfW, 3, 1.5, { tube: 0.55 });
    af.rotation.y = -Math.PI / 2; af.position.set(0, aS.cy, AFT_FACE_Z); af.scale.set(1, aS.halfH / aS.halfW, 1); add(af);
    const bf = makeFormerRings(bS.halfW, 3, 1.5, { tube: 0.55 });
    bf.rotation.y = -Math.PI / 2; bf.position.set(0, bS.cy, BOW_FACE_Z - 3); bf.scale.set(1, bS.halfH / bS.halfW, 1); add(bf);
    // Deck-edge slabs — THICK floors RECEDING into each mass (depth, not paper) with
    // a dark torn-edge fascia, staggered in Y between faces so decks read countable.
    const mkDeck = (y: number, faceZ: number, into: number, w: number) => {
      const depth = 4 + _rand() * 1.5;                // capped depth (no 10:1 paper tongues)
      const th = 0.5 + _rand() * 0.4;                 // thicker, varied (not card-uniform)
      const yj = y + (_rand() - 0.5) * 0.6;           // Y jitter
      const wj = w * (0.7 + _rand() * 0.28);          // ALWAYS ≤ w → never pokes past the hull flank
      const xj = (_rand() - 0.5) * 1.2;
      const rz = (_rand() - 0.5) * 0.14, rx = (_rand() - 0.5) * 0.1;   // not parallel; one corner sags
      const s = box(wj * 2, th, depth, dark); s.position.set(xj, yj, faceZ + into * depth / 2); s.rotation.set(rx, 0, rz); add(s);
      // Thick torn-edge fascia/riser on the outboard (torn) edge so decks read as floors.
      const fascia = box(wj * 2, 0.8, 0.35, _tornMat); fascia.position.set(xj, yj - 0.1, faceZ); fascia.rotation.z = rz; add(fascia);
      // A couple of vertical stanchions between decks.
      for (const sx of [-wj * 0.5, wj * 0.45]) { const st = box(0.28, 2.4 + _rand(), 0.28, dark); st.position.set(xj + sx, yj + 1.3, faceZ + into * (1.2 + _rand())); add(st); }
    };
    for (const y of [3.5, 7.0, 10.5, 14.0]) mkDeck(y, AFT_FACE_Z, 1, aS.halfW - 1.5);     // aft decks recede +Z
    for (const y of [1.5, 5.0, 8.5]) mkDeck(y, BOW_FACE_Z, -1, bS.halfW - 1.5);           // bow decks (offset Y)
    // Snapped keel-stub beam — tapered, anchored INTO the aft backboard (torn-but-rooted).
    const spineGeo = new THREE.CylinderGeometry(0.7, 1.0, 13, 6); spineGeo.rotateX(Math.PI / 2);
    const spine = new THREE.Mesh(spineGeo, dark); spine.position.set(-1.5, 2.5, AFT_FACE_Z - 5.5); spine.rotation.y = 0.16; add(spine);
    const spine2Geo = new THREE.CylinderGeometry(0.5, 0.7, 7, 6); spine2Geo.rotateX(Math.PI / 2);
    const spine2 = new THREE.Mesh(spine2Geo, dark); spine2.position.set(1.0, 3.2, BOW_FACE_Z + 3.5); spine2.rotation.set(0, 0.2, 0.06); add(spine2);
    // Dangling cables — drooping from upper deck-edges DOWN to a lower deck slab
    // (land on structure, not mid-air), with a junction-box foot.
    // Cables droop from an UPPER deck-edge down to a LOWER deck slab on the SAME torn
    // face (everything is in the tilted shell frame, so they stay attached + rest on
    // structure — NOT the level interior floor, which is a different frame).
    for (const [x, fromY, toY] of [[-5, 13, 4], [4, 10.5, 3.8], [-2, 14, 4.2], [6, 11.5, 3.6]] as const) {
      const from = new THREE.Vector3(x, fromY, AFT_FACE_Z + 1.4);
      const to = new THREE.Vector3(x + (_rand() - 0.5) * 2, toY, AFT_FACE_Z + 2.6);
      add(makeCable(from, to, 3.0, _pipeMat, 0.1));
      const jb = box(0.6, 0.4, 0.6, dark); jb.position.set(to.x, to.y + 0.2, to.z); add(jb);
    }
  }

  // (A4+A5) Command island — a TAPERED ANGULAR tower (not a stacked crate),
  // leaning forward, growing from a fitted dorsal shoulder, with a windowed bridge
  // band + raked windscreen, and the sensor mast/dishes built AS CHILDREN so they
  // ride the lean + connect to the crown (nothing floats). Everything is in the
  // `island` Group, positioned + leaned about its base on the sampled dorsal deck.
  {
    const cz = ISLAND_Z, cx = 3.0;
    const dorsal = hullAt(cz).dorsalY;
    // Fitted shoulder: an octagonal frustum wider at the base, seated INTO the deck.
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 7.6, 3.2, 8), _hullMat);
    shoulder.rotation.y = Math.PI / 8; shoulder.position.set(cx, dorsal - 1.4, cz); add(shoulder);   // sunk into the deck (no clamped-drum seam)
    const island = new THREE.Group(); island.position.set(cx, dorsal + 0.6, cz); island.rotation.x = -0.13;
    const addI = (m: THREE.Object3D) => { m.userData.noCollider = true; island.add(m); };
    const strut = (from: THREE.Vector3, to: THREE.Vector3, r: number, mat: THREE.Material) => {
      const dir = to.clone().sub(from); const dist = dir.length();
      const m = box(r * 2, r * 2, dist, mat); m.position.copy(from).addScaledVector(dir, 0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize()); addI(m);
    };
    // Tapered 8-sided tower body (angular faceted faces, NOT a box).
    const towerH = 11;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 5.4, towerH, 8), _hullMat);
    tower.rotation.y = Math.PI / 8; tower.position.set(0, towerH / 2, 0); addI(tower);
    // Window bands on the forward face, 2 levels, framed ≥12cm relief.
    for (const ly of [towerH * 0.34, towerH * 0.6]) {
      const lw = 4.4 * (1 - (ly / towerH) * 0.35);
      for (let k = -2; k <= 2; k++) {
        const wx = k * (lw * 0.62 / 2);
        const fr = box(0.95, 1.2, 0.22, dark); fr.position.set(wx, ly, -lw - 0.02); addI(fr);
        const wn = box(0.74, 1.0, 0.42, _viewportMat); wn.position.set(wx, ly, -lw - 0.16); wn.userData.noShadow = true; addI(wn);
      }
    }
    // Raked windscreen wedge on the forward face, backed by a dark hull box so it
    // never culls to see-through.
    const wsBack = box(7.2, 2.6, 0.3, dark); wsBack.position.set(0, towerH * 0.5, -4.0); wsBack.rotation.x = -0.5; addI(wsBack);
    const screen = box(7.0, 2.5, 0.2, _viewportMat); screen.position.set(0, towerH * 0.5, -4.18); screen.rotation.x = -0.5; screen.userData.noShadow = true; addI(screen);
    // Tapered cap.
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.6, 1.6, 8), _hullMat); cap.rotation.y = Math.PI / 8; cap.position.set(0, towerH + 0.8, 0); addI(cap);
    // Sensor mast + dish cluster — SHORT + THICK, sitting just above the cap (no
    // tall bare pole), braced to the cap, dishes on thick yokes facing outward.
    const capTop = towerH + 1.6, crownY = towerH + 5.0;
    const mast = cyl(0.5, 0.85, crownY - capTop, _antennaMat, 8); mast.position.set(0.3, (capTop + crownY) / 2, 0); mast.rotation.z = 0.05; addI(mast);
    // Cross-braces from the mast down to the cap (so it's clearly rooted).
    for (const bx of [-1.6, 1.6]) strut(new THREE.Vector3(0.3, crownY - 0.8, 0), new THREE.Vector3(bx, capTop + 0.3, 0), 0.2, _antennaMat);
    const crown = new THREE.Vector3(0.3, crownY, 0);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 9), _antennaMat); globe.position.copy(crown); addI(globe);
    // 3 distinct-size shallow dish bowls (open, concave) on thick yokes + collars,
    // each tilted to face up-and-out so the camera sees the bowl, not the rim.
    for (const [r, ox, oy, oz, rx, rz] of [[2.0, 1.7, -0.2, 1.1, -1.1, 0.3], [1.3, -1.7, 0.8, 0.9, -1.0, -0.4], [0.85, 0.3, 1.4, 1.2, -1.4, 0.1]] as const) {
      const dpos = new THREE.Vector3(crown.x + ox, crown.y + oy, oz);
      strut(crown, dpos, 0.2, _antennaMat);
      const collar = box(0.45, 0.45, 0.45, dark); collar.position.copy(crown).lerp(dpos, 0.35); addI(collar);
      const d = new THREE.Mesh(new THREE.ConeGeometry(r, r * 0.45, 16, 1, false), _dishMat);  // closed → no see-through
      d.position.copy(dpos); d.rotation.set(rx, 0, rz); addI(d);
      const horn = cyl(0.08, 0.08, r * 0.5, dark, 6); horn.position.copy(dpos); horn.rotation.set(rx, 0, rz); addI(horn);
    }
    // 2 whip antennas emerging from the crown.
    for (const ox of [-0.6, 0.8]) { const whip = cyl(0.05, 0.08, 3.0, _antennaMat, 5); whip.position.set(crown.x + ox, crown.y + 1.5, 0); whip.rotation.z = ox * 0.1; addI(whip); }
    add(island);
  }

  // (A6) Engine bank — TWO big flared bells PROJECTING ~5m off the transom (capital
  // ships read as 2 or 4, never 3), hollow mouths with a recessed combustion void,
  // on an exposed torn mount cage; asymmetric (one offset + shrunk = impact damage).
  {
    // Solid transom/engine-deck plate — CAPS the open lofted hull end (no see-through
    // into the hollow hull) AND gives the bells + thrusters + struts a real surface
    // to grow from.
    const tp = hullAt(TRANSOM_Z);
    const plate = box(tp.halfW * 2 - 0.4, tp.halfH * 2 - 0.4, 0.6, _hullDarkMat);
    plate.position.set(0, tp.cy, TRANSOM_Z); add(plate);
    const ez = TRANSOM_Z + 1.0, ey = 7;     // bells project less, rooted on the plate
    const slots: Array<[number, number, number, number]> = [
      [-5.0, ey + 0.5, 4.2, 0.0],   // [x, y, mouthR, tilt]
      [5.0, ey - 1.2, 3.7, 0.14],   // offset + shrunk + twisted (damage)
    ];
    for (const [sx, sy, mouthR, tilt] of slots) {
      const bell = makeEngineBellMesh(mouthR, mouthR * 1.4, _hullMat, _nozzleInteriorMat);
      bell.rotation.x = Math.PI / 2 + tilt; bell.position.set(sx, sy, ez); add(bell);
      // Recessed dark throat cone so the mouth reads hollow at any angle.
      const throat = new THREE.Mesh(new THREE.ConeGeometry(mouthR * 0.7, mouthR * 1.1, 14, 1, true), _nozzleInteriorMat);
      throat.rotation.x = -Math.PI / 2; throat.position.set(sx, sy, ez - mouthR * 0.5); add(throat);
      // Exposed mount cage ring + radial CYLINDER struts anchored ON the transom plate.
      const ring = new THREE.Mesh(new THREE.TorusGeometry(mouthR * 1.08, 0.35, 6, 16), dark);
      ring.rotation.y = Math.PI / 2; ring.position.set(sx, sy, ez - mouthR * 0.9); add(ring);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.3;
        const rx = sx + Math.cos(a) * mouthR * 0.95, ry = sy + Math.sin(a) * mouthR * 0.7;
        const from = new THREE.Vector3(rx, ry, ez - mouthR * 0.9), to = new THREE.Vector3(sx * 0.85, sy * 0.9 + tp.cy * 0.1, TRANSOM_Z + 0.3);
        const dir = to.clone().sub(from), st = cyl(0.16, 0.16, dir.length(), dark, 5);
        st.position.copy(from).addScaledVector(dir, 0.5); st.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); add(st);
      }
    }
    // 2 maneuvering-thruster pods recessed into the plate (within the transom face).
    for (const sx of [-3, 3]) {
      const pad = box(1.8, 1.8, 0.4, dark); pad.position.set(sx, tp.cy + 1.5, TRANSOM_Z + 0.2); add(pad);
      const t = makeEngineBellMesh(1.1, 1.5, _hullMat, _nozzleInteriorMat); t.rotation.x = Math.PI / 2; t.position.set(sx, tp.cy + 1.5, TRANSOM_Z + 0.8); add(t);
    }
  }

  // (A7) Hull plating — a dorsal spine keel that FOLLOWS the dorsal curve + fore-aft
  // flank strakes + transverse butt-joint frames, all sampled ONTO the hull surface
  // (hullAt) so nothing floats off the taper or clips the belly. Seam ridges sit
  // ~10cm proud (rule 7).
  {
    // Dorsal spine: short segments tracking the dorsal Y so it never floats/clips.
    for (let z = AFT_FACE_Z + 2; z < TRANSOM_Z - 3; z += 6) {
      if (Math.abs(z + 3 - ISLAND_Z) < 8) continue;   // skip under the island (no z-fight)
      const s = hullAt(z), s2 = hullAt(z + 6);
      const seg = box(0.9, 0.5, 6.2, _hullMat);
      seg.position.set(0, (s.dorsalY + s2.dorsalY) / 2 - 0.1, z + 3);
      add(seg);
    }
    // Fore-aft flank strakes at fractions of the section height, riding the surface.
    for (const side of [-1, 1]) for (const hf of [0.3, 0.55, 0.78]) {
      for (let z = AFT_FACE_Z + 1; z < TRANSOM_Z - 2; z += 9) {
        const s = hullAt(z), s2 = hullAt(z + 9);
        const x = side * (s.halfW + 0.04), y = s.keelY + (s.dorsalY - s.keelY) * hf;
        const st = box(0.24, 0.34, 9.0, hf < 0.5 ? dark : _hullMat);
        st.position.set((x + side * (s2.halfW + 0.04)) / 2, y, z + 4.5);
        st.rotation.y = side > 0 ? -0.04 : 0.04; add(st);
      }
    }
    // Transverse butt-joint frame ribs every ~12m → reads as bulkhead stations.
    for (let z = AFT_FACE_Z + 6; z < TRANSOM_Z - 4; z += 13) {
      const s = hullAt(z);
      const rib = new THREE.Mesh(new THREE.TorusGeometry(s.halfW + 0.05, 0.22, 5, 18), _hullMat);
      rib.rotation.y = Math.PI / 2; rib.position.set(0, s.cy, z); rib.scale.set(1, s.halfH / s.halfW, 1); add(rib);
    }
  }

  // (A8) Asymmetric impact breaches — +X impact flank shattered (2), -X lee tear (1).
  // Each seated ON the sampled flank (no float/clip), backed by a rib + deck-edge so
  // the void shows structure, with a fresh-torn-metal rim.
  const breachSites: Array<[number, number, number]> = [[1, 30, 3.6], [1, 52, 2.4], [-1, 40, 1.8]];
  {
    for (const [side, z, r] of breachSites) {
      const s = hullAt(z), y = s.cy + (side > 0 ? 1.5 : 0.5);
      const fx = side * (s.halfW - 0.1);
      const b = makeBreach(r, _rand); tagWreckDecoration(b);
      b.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.material === _hullDarkMat) m.material = _tornMat; });
      b.position.set(fx, y, z); b.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; b.scale.set(1, 0.95, 1.2); add(b);
      const rib = makeFormerRings(r * 0.85, 1, 1, { tube: 0.3 }); rib.rotation.y = side > 0 ? 0 : Math.PI;
      rib.position.set(side * (s.halfW - 0.8), y, z); rib.scale.set(0.5, 0.9, 0.9); add(rib);
      const ledge = box(0.5, 0.2, r * 1.4, _tornMat); ledge.position.set(side * (s.halfW - 0.9), y - r * 0.4, z); add(ledge);
    }
  }

  // (A9) Directional weathering — translucent rust streaks hanging DOWN from the
  // breach rims + fracture, seated ON the sampled flank, concentrated on the +X
  // impact flank, near-clean on the -X lee (directional = story + scale).
  {
    const streak = (side: number, z: number, yTop: number, w: number, hgt: number) => {
      const s = hullAt(z);
      const q = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), _streakMat);
      q.position.set(side * (s.halfW + 0.05), yTop - hgt / 2, z); q.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      q.userData.noShadow = true; add(q);
    };
    for (const [side, z, r] of breachSites) {
      const n = side > 0 ? 4 : 1;
      for (let i = 0; i < n; i++) streak(side, z + (i - n / 2) * r * 0.5, hullAt(z).cy + (side > 0 ? 1.5 : 0.5) - r * 0.7, 0.5 + (i % 2) * 0.4, 3 + (i % 3));
    }
    for (let i = 0; i < 5; i++) { const z = FRACTURE_Z - 6 + i * 3; streak(1, z, hullAt(z).cy + 2 - i * 0.4, 0.6, 4 + (i % 2) * 2); }
    for (let i = 0; i < 2; i++) { const z = 20 + i * 22; streak(-1, z, hullAt(z).cy, 0.5, 3); }
  }

  // Tilt the shell into a STRONG list + sink it deep. Interior boxes stay LEVEL
  // (D185); the narrow dagger hull has ample margin over the narrow interior so
  // even a hard roll keeps the level box corners enveloped.
  shell.rotation.set(SHELL_PITCH, 0, SHELL_ROLL);
  shell.position.copy(shellPos());   // pivot-compensated → the hull stays grounded
  g.add(shell);

  // Shadow flags.
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = !m.userData.noShadow; m.receiveShadow = true; } });
  return g;
}

/**
 * Place the mega-wreck at a world position with yaw + tilt. Single fixed body;
 * cuboid colliders from the shared cell descriptors; registers shelter zone (the
 * pocket), 2 salvage panels (engine room + bridge), the captain's-log journal.
 */
export function placeMegaWreck(
  scene: THREE.Scene,
  world: RAPIER.World,
  _terrain: Terrain,
  pos: THREE.Vector3,
  yaw: number,
  tilt: THREE.Quaternion,
  rand: Rng,
  shelter: ShelterRegistry,
  salvageables: SalvageableRegistry,
  journals?: { list: Journal[] },
): THREE.Group {
  const group = makeMegaWreck(rand);
  group.name = 'megaWreck';
  group.position.copy(pos);
  const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const finalQ = new THREE.Quaternion().multiplyQuaternions(tilt, yawQ);
  group.quaternion.copy(finalQ);
  scene.add(group);

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z).setRotation({ x: finalQ.x, y: finalQ.y, z: finalQ.z, w: finalQ.w }),
  );
  // The whole wreck (interior floor + exterior hull) lives in the tilted+sunk shell
  // frame; colliders replicate that transform so physics matches the visuals. A
  // collider can carry a small extra local tilt (ramps). Both inside + outside use
  // this — inside and outside are ONE listed rigid body.
  const shellQ = shellQuat();
  const shellOff = shellPos();
  const extCuboid = (px: number, py: number, pz: number, hx: number, hy: number, hz: number, tilt?: [number, number, number]) => {
    const q = tilt ? shellQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt[0], tilt[1], tilt[2], 'XYZ'))) : shellQ;
    const p = new THREE.Vector3(px, py, pz).applyQuaternion(shellQ).add(shellOff);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
      body,
    );
  };

  // ── INTERIOR floor colliders — the SAME interiorDecks() as the meshes, through
  // the same shell transform → mesh + collision locked, both canted with the hull.
  for (const d of interiorDecks()) if (d.collide) extCuboid(d.x, d.y, d.z, d.hx, d.hy, d.hz, [d.rx ?? 0, d.ry ?? 0, d.rz ?? 0]);

  // ── Exterior collision — flank slabs + caps + island + engines (same transform).
  // Exposed hull flanks (both masses) — thin vertical slabs at the sampled surface.
  for (const z of [-46, -32, -16, 24, 38, 52, 66, 73]) {
    const s = hullAt(z);
    for (const side of [-1, 1]) extCuboid(side * s.halfW, s.cy, z, 0.4, s.halfH, 7);
  }
  // Bow nose cap + transom cap (Z end blockers).
  { const s = hullAt(-58); extCuboid(0, s.cy, -59, s.halfW + 0.5, s.halfH, 0.5); }
  { const s = hullAt(75); extCuboid(0, s.cy, 76.5, s.halfW + 0.5, s.halfH, 0.5); }
  // Command-island blocker — tall enough to cover the whole tower (the bridge
  // journal/panel payoff is here; the player must not walk through it).
  extCuboid(3.0, 24, ISLAND_Z, 4.5, 7.0, 4.5);
  // Engine bells (two big projecting nozzles).
  for (const [sx, sy, mr] of [[-5.0, 7.5, 4.2], [5.0, 5.8, 3.7]] as const) extCuboid(sx, sy, TRANSOM_Z + 2.5, mr, mr, mr * 1.3);

  // Shell-local → world helpers (so interactables sit on the TILTED decks).
  const shellToG = (l: THREE.Vector3) => l.clone().applyQuaternion(shellQ).add(shellOff);
  const shellWorld = (l: THREE.Vector3) => shellToG(l).applyQuaternion(finalQ).add(pos);
  const addPanel = (shellLocal: THREE.Vector3, faceYaw: number) => {
    const p = new THREE.Group();
    p.position.copy(shellToG(shellLocal));
    p.quaternion.copy(shellQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), faceYaw)));
    addAccessPanel(p, 0, 0, 0, 1, 0, 'massive');
    group.add(p); p.updateWorldMatrix(true, false);
    const wp = new THREE.Vector3().setFromMatrixPosition(p.matrixWorld);
    registerSalvageable(salvageables, p, 'massive', wp, rand);
  };
  // Panel #1 — canted bulkhead in collapsed engineering (+X flank), facing inboard.
  addPanel(new THREE.Vector3(hullAt(40).halfW * 0.7, deckY(40) + 1.6, 40), -Math.PI / 2);
  // Panel #2 — bridge console wall (+X), the near-intact payoff space.
  addPanel(new THREE.Vector3(4.0, deckY(70) + 1.6, 70), -Math.PI / 2);

  // ── Shelter zone — the sheltered settled nook against the lee (-X) flank of the
  // aft/engineering space (the one compartment that didn't breach).
  const shCenter = shellWorld(new THREE.Vector3(-4, deckY(54) + 1.5, 54));
  addShelterZone(shelter, shCenter, { x: 6.5, y: 3.0, z: 7.0 });

  // ── Captain's log — on the bridge console, met on arrival at the end of the path.
  if (journals) {
    const jw = shellWorld(new THREE.Vector3(2.0, deckY(70) + 1.0, 71));
    journals.list.push(placeJournal(scene, jw, yaw + Math.PI, 'mega_wreck'));
  }

  // ── Half-burial: low drift mounds that meet the LISTING hull (sampled through the
  // SHELL tilt, not the level frame) — denser on the down-rolled +X impact flank +
  // over the buried bow, lighter on the lee. Small sizes → drifts, not landforms.
  {
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const wd = new THREE.Vector2(-cos, -sin);
    // shell-local belly point → world (apply the shell tilt, then yaw + position).
    const bellyWorld = (side: number, z: number) => {
      const s = hullAt(z);
      const local = new THREE.Vector3(side * (s.halfW - 1), s.keelY + 1.5, z).applyQuaternion(shellQ).add(shellOff);
      return local.applyQuaternion(finalQ).add(pos);
    };
    // [side, z, size] — the +X (down-rolled) flank gets the heavy drift.
    const drifts: Array<[number, number, number]> = [
      [1, -8, 9], [1, 18, 10], [1, 42, 9], [1, 60, 7],     // +X buried impact flank
      [-1, 10, 6], [-1, 46, 6],                            // -X lee (lighter)
      [1, -36, 9], [-1, -40, 7], [0, -56, 9],              // round the buried bow
    ];
    for (const [side, z, sz] of drifts) {
      const w = bellyWorld(side, z);
      scene.add(makeSandMound(_terrain, w.x, w.z, wd, sz, rand));
    }
    const noseW = bellyWorld(0, -58);
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(6, 16), new THREE.MeshLambertMaterial({ color: 0x3a2c20 }));
    scorch.rotation.x = -Math.PI / 2; scorch.position.set(noseW.x, _terrain.heightAt(noseW.x, noseW.z) + 0.04, noseW.z);
    scorch.userData.noCollider = true; scorch.userData.noShadow = true; scene.add(scorch);
  }

  // ── Surrounding debris field.
  placeDebrisField(scene, _terrain, pos, 50, rand, 40);

  return group;
}
