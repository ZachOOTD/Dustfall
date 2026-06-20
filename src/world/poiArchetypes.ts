// POI archetype grammar (ACBA — POI variety overhaul).
//
// An Archetype mate()s components into a POI of a given TOPOLOGY (radial satellite,
// vertical tank farm, …) — the thing that breaks the old "everything is a long tube"
// read. Each archetype draws a SMALL FIXED number of rand() (counts + the per-POI
// seed) and hashes that seed into per-component variation via phash() (the components
// themselves never touch the shared rand stream — D208/D221). So the rand budget is a
// pure function of (archetype, part-count) and the salvage-panel stream stays stable.

import * as THREE from 'three';
import type { Rng } from '../core/rng.ts';
import type { BiomeId } from './biomes.ts';
import type { HullBucket } from './procgenWreck.ts';
import type { ColliderSpec } from '../physics/bodies.ts';
import {
  type BuiltComponent, type PanelMount, mate, transformCollider, transformPanelMount, phash,
  busBody, solarWing, dishAntenna, wreckedTank, debrisPiece, huskShell,
  noseCone, hullBarrel, engineNozzle, splayedEngineCluster, dorsalMast, watchtower,
} from './poiComponents.ts';

export interface ArchetypeParams {
  bucket: HullBucket;
  burySink: boolean;     // false → standing structures rest ON the surface (no half-bury clamp)
  bury: number;          // metres to sink when burySink (pre-clamp)
  list: number;          // crash-list magnitude (rad); 0 = stands level
  panelMin: number;
  panelMax: number;
  sandMound: boolean;    // drift a windward dune around the base?
  salvageKind: PanelMount['kind'];   // fallback registry flavour if a mount omits it
  /** Fixed sink (m) for a non-burySink archetype. Omit → derived from the footprint
   *  width (right for a wide slab); set small for scattered debris that already rests. */
  seatSink?: number;
  /** burySink: sink this FRACTION of the height (scale-invariant) instead of `bury` m —
   *  for a deeply-swallowed wreck whose sand line crosses the hull axis at any size. */
  buryFrac?: number;
  /** burySink: max sink as a fraction of height (default 0.5 = keep ≥50% proud). */
  buryClampFrac?: number;
}

export interface AssembleResult {
  group: THREE.Group;
  colliders: ColliderSpec[];
  panelMounts: PanelMount[];
  bbox: THREE.Box3;
}

export interface Archetype {
  id: string;
  params: ArchetypeParams;
  assemble(rand: Rng, biome?: BiomeId): AssembleResult;
}

// ── Assembly accumulator: tracks placements + collects colliders/mounts ──
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _ONE_SCALE = new THREE.Vector3(1, 1, 1);
class Assembly {
  group = new THREE.Group();
  colliders: ColliderSpec[] = [];
  panelMounts: PanelMount[] = [];
  /** Place a component at a root-frame placement; accumulate its colliders + mounts. */
  place(c: BuiltComponent, placement: THREE.Matrix4): THREE.Matrix4 {
    placement.decompose(_p, _q, _s);
    c.mesh.position.copy(_p);
    c.mesh.quaternion.copy(_q);
    this.group.add(c.mesh);
    for (const col of c.colliders) this.colliders.push(transformCollider(col, placement));
    for (const pm of c.panelMounts) this.panelMounts.push(transformPanelMount(pm, placement));
    return placement;
  }
  result(): AssembleResult {
    this.group.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(this.group);
    return { group: this.group, colliders: this.colliders, panelMounts: this.panelMounts, bbox };
  }
}
/** Lift a root component so its lowest point rests on the ground plane (y=0). */
const liftToGround = (c: BuiltComponent) => new THREE.Matrix4().makeTranslation(0, -c.bbox.min.y, 0);
const socket = (c: BuiltComponent, name: string) => c.sockets.find((x) => x.name === name)!;
const seedOf = (rand: Rng) => Math.floor(rand() * 100000);
/** Lowest world-Y of a bbox AFTER applying a rotation — so a tumbled piece can rest its
 *  TRUE low point on the sand (seating by the un-rotated bbox floats/spears tilted pieces). */
const _rc = new THREE.Vector3();
function rotatedMinY(bbox: THREE.Box3, q: THREE.Quaternion): number {
  let minY = Infinity;
  for (const x of [bbox.min.x, bbox.max.x])
    for (const y of [bbox.min.y, bbox.max.y])
      for (const z of [bbox.min.z, bbox.max.z]) {
        _rc.set(x, y, z).applyQuaternion(q);
        if (_rc.y < minY) minY = _rc.y;
      }
  return minY;
}

// ════════════════════════════════════════════════════════════════════
// SATELLITE — a fallen relay: foil-wrapped bus + mirrored solar wings + dishes.
// Radial topology; sits upright where it landed. The canonical "not a ship".
// ════════════════════════════════════════════════════════════════════
function assembleSatellite(rand: Rng): AssembleResult {
  const a = new Assembly();
  const s = seedOf(rand);
  const bus = busBody(s);
  const busPl = a.place(bus, liftToGround(bus));
  // Mirrored solar wings on ±X (same seed → symmetric array), each CRASH-ROLLED about its
  // shoulder so the pair BANKS (one tip lifts, one sinks) — kills the "two floating planes".
  const roll = 0.16 + phash(s, 8) * 0.22;   // ~9-22°, same sign both → asymmetric pose
  for (const name of ['wingL', 'wingR'] as const) {
    const wing = solarWing(s);
    const wpl = mate(busPl, socket(bus, name), wing.sockets[0]);
    const sh = socket(bus, name).pos.clone().applyMatrix4(busPl);   // world shoulder point
    const tilt = new THREE.Matrix4().makeTranslation(sh.x, sh.y, sh.z)
      .multiply(new THREE.Matrix4().makeRotationZ(roll))
      .multiply(new THREE.Matrix4().makeTranslation(-sh.x, -sh.y, -sh.z));
    a.place(wing, tilt.multiply(wpl));
  }
  // 1-2 dishes clustered on the TOP deck (clear of the +Z salvage panel + the -Z hatch).
  const dishCount = 1 + Math.floor(phash(s, 7) * 2);
  const dishSocks = ['dishT', 'dishT2'];
  for (let i = 0; i < dishCount && i < dishSocks.length; i++) {
    const dish = dishAntenna(s + 700 + i * 137);   // namespaced seed (no sibling aliasing)
    a.place(dish, mate(busPl, socket(bus, dishSocks[i]), dish.sockets[0]));
  }
  return a.result();
}

// ════════════════════════════════════════════════════════════════════
// WRECKED TANK — one big storage tank ripped open, toppled on its side, half-buried.
// Reads as desert wreckage (the neat upright "tank farm" read as an intact depot, D233).
// ════════════════════════════════════════════════════════════════════
function assembleWreckedTank(rand: Rng): AssembleResult {
  const a = new Assembly();
  const tank = wreckedTank(seedOf(rand));
  a.place(tank, liftToGround(tank));
  return a.result();
}

// ACBB Tier 2 — disturbed/scorched sand under a debris scatter (an impact footprint).
// Dark warm-grey scorched tan; polygon-offset so the flat decal sits ON the sand without
// z-fighting. A shared singleton (merges across every debris field in the yard).
const _scorchMat = new THREE.MeshLambertMaterial({ color: 0x564738, flatShading: true });
_scorchMat.polygonOffset = true; _scorchMat.polygonOffsetFactor = -1; _scorchMat.polygonOffsetUnits = -1;

// ════════════════════════════════════════════════════════════════════
// DEBRIS FIELD — no hull: torn plates, bent struts + a lootable chunk strewn over
// a disc. The "blast-scatter / fallen-apart" graveyard texture between bigger POIs.
// ════════════════════════════════════════════════════════════════════
function assembleDebris(rand: Rng): AssembleResult {
  const a = new Assembly();
  const s = seedOf(rand);
  const n = 6 + Math.floor(rand() * 5);   // 6-10 pieces (ONE rand draw)
  // Impact footprint: a disturbed-sand DISC under the scatter centre so the field reads as
  // "something came down and broke apart HERE", not as scattered rocks. Flat ground decal
  // (decoration, no collider); rides the group's terrain-align like the rest of the POI.
  const discR = 3.4 + phash(s, 5) * 1.6;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(discR, 24), _scorchMat);
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.06;
  disc.userData.isWreckDecoration = true;
  a.group.add(disc);
  for (let i = 0; i < n; i++) {
    const isChunk0 = i === 0;
    const kindIdx = isChunk0 ? 2 : Math.floor(phash(s, 200 + i) * 3);
    const piece = debrisPiece(s + i * 311, kindIdx, isChunk0);   // only the centre chunk is lootable
    const q = new THREE.Quaternion();
    let x: number, z: number, sink: number;
    if (isChunk0) {
      // Heavy lootable chunk: UPRIGHT focal mass at the field centre (top hatch faces sky).
      q.setFromEuler(new THREE.Euler(0, phash(s, 400) * Math.PI * 2, 0));
      x = 0; z = 0; sink = 0.10;
    } else {
      const ang = phash(s, i) * Math.PI * 2;
      const dist = 1.2 + phash(s, 100 + i) * 2.8;   // flung OUTWARD → separate fragments, not a knot
      const tiltMax = kindIdx === 0 ? 0.16 : 0.5;    // plates lie FLAT; struts/chunks tumble
      q.setFromEuler(new THREE.Euler(
        (phash(s, 300 + i) - 0.5) * 2 * tiltMax,
        phash(s, 410 + i) * Math.PI * 2,
        (phash(s, 500 + i) - 0.5) * 2 * tiltMax,
      ));
      x = Math.cos(ang) * dist; z = Math.sin(ang) * dist;
      sink = 0.06 + phash(s, 600 + i) * 0.34;   // ACBB Tier 2 — deeper bias so pieces nestle into the sand, not perch/float
    }
    // Seat by the POST-ROTATION lowest vertex (the un-rotated bbox floated/speared tilts).
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, -rotatedMinY(piece.bbox, q) - sink, z), q, _ONE_SCALE,
    );
    a.place(piece, m);
  }
  return a.result();
}

// ════════════════════════════════════════════════════════════════════
// HOLLOW HUSK — a single large gutted hull shell, half-buried + listed (crashed).
// ════════════════════════════════════════════════════════════════════
function assembleHusk(rand: Rng): AssembleResult {
  const a = new Assembly();
  const husk = huskShell(seedOf(rand));
  a.place(husk, liftToGround(husk));
  return a.result();
}

// ════════════════════════════════════════════════════════════════════
// CRASH HUSK (ACBE D1 Tier 3) — the enterable husk DRESSED for a fresh crash: role-driven
// cargo/fixtures + an aftermath read (empty flight-suits — NO bodies, scorch marks, scatter)
// + a dead console. Only the crash event uses it (forced archetype; NOT in ARCH_WEIGHTS). The
// role is set by landCrashAt right before placement so the interior matches the crash's lore.
// Props are added in the husk's LOCAL frame (trough along X, floor at y≈0) so they ride the
// placement transform + merge with the hull.
// ════════════════════════════════════════════════════════════════════
let _crashRole = 'freighter';
export function setCrashDressRole(role: string): void { _crashRole = role; }

const _crateMat = new THREE.MeshLambertMaterial({ color: 0x5a4a33, flatShading: true });
const _crateDark = new THREE.MeshLambertMaterial({ color: 0x33291d, flatShading: true });
const _suitMat = new THREE.MeshLambertMaterial({ color: 0x6e6657, flatShading: true });        // faded empty flight-suit
const _screenMat = new THREE.MeshLambertMaterial({ color: 0x0a0e12, emissive: 0x12303a, emissiveIntensity: 0.45, flatShading: true });
const _scorchInner = new THREE.MeshLambertMaterial({ color: 0x0e0906, transparent: true, opacity: 0.9, flatShading: true });
const _oreMat = new THREE.MeshLambertMaterial({ color: 0x473827, flatShading: true });

function dressCrashInterior(husk: BuiltComponent, rand: Rng, role: string): void {
  const g = husk.mesh;
  const len = husk.bbox.max.x - husk.bbox.min.x;
  const r = husk.bbox.max.z;
  const mark = (m: THREE.Object3D) => { m.traverse((o) => { o.userData.isWreckDecoration = true; const mm = o as THREE.Mesh; if (mm.isMesh) { mm.castShadow = true; mm.receiveShadow = true; } }); g.add(m); };
  const spot = (frac: number, zf: number) => ({ x: (frac - 0.5) * len * 0.74, z: zf * r * 0.5 });

  // ── Role-driven cargo / fixtures along the floor ──
  if (role === 'freighter' || role === 'mining') {
    const n = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const p = spot(rand(), rand() * 2 - 1);
      const s = 0.5 + rand() * 0.5;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s * (0.7 + rand() * 0.5), s * (0.8 + rand() * 0.4)), rand() < 0.5 ? _crateMat : _crateDark);
      crate.position.set(p.x, s * 0.4, p.z);
      crate.rotation.set((rand() - 0.5) * 0.3, rand() * Math.PI, (rand() - 0.5) * 0.35);   // toppled
      mark(crate);
      if (role === 'mining' && rand() < 0.6) {
        const ore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + rand() * 0.18, 0), _oreMat);
        ore.position.set(p.x + (rand() - 0.5) * 0.7, 0.16, p.z + (rand() - 0.5) * 0.7);
        mark(ore);
      }
    }
  } else if (role === 'liner') {
    for (let i = 0; i < 3; i++) {
      for (const zf of [-0.62, 0.62]) {
        const p = spot((i + 0.7) / 4, zf);
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), _crateDark);
        base.position.set(p.x, 0.2, p.z); base.rotation.y = (rand() - 0.5) * 0.4;
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.12), _suitMat);
        back.position.set(p.x, 0.45, p.z - zf * 0.2);
        mark(base); mark(back);
      }
    }
    for (let i = 0; i < 3; i++) {
      const p = spot(rand(), rand() * 2 - 1);
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.3), _crateMat);
      bag.position.set(p.x, 0.14, p.z); bag.rotation.set((rand() - 0.5) * 0.6, rand() * Math.PI, (rand() - 0.5) * 0.6);
      mark(bag);
    }
  } else if (role === 'military') {
    for (let i = 0; i < 2; i++) {
      const p = spot(0.3 + i * 0.4, i % 2 === 0 ? -0.82 : 0.82);
      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 0.18), _crateDark);
      rack.position.set(p.x, 0.5, p.z); rack.rotation.y = (rand() - 0.5) * 0.2;
      mark(rack);
    }
    for (let i = 0; i < 3; i++) {
      const p = spot(rand(), rand() * 2 - 1);
      const ammo = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.5), _crateDark);
      ammo.position.set(p.x, 0.15, p.z); ammo.rotation.y = rand() * Math.PI;
      mark(ammo);
    }
  } else { // science
    for (let i = 0; i < 3; i++) {
      const p = spot(0.25 + i * 0.25, (i % 2 === 0 ? -1 : 1) * 0.66);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.4), _crateMat);
      box.position.set(p.x, 0.18, p.z); box.rotation.y = (rand() - 0.5) * 0.5;
      mark(box);
    }
  }

  // ── A dead/flickering console near one end ──
  {
    const p = spot(0.12, 0.0);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.4), _crateDark);
    body.position.set(p.x, 0.35, p.z);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.05), _screenMat);
    screen.position.set(p.x, 0.55, p.z + 0.22); screen.rotation.x = -0.3;
    mark(body); mark(screen);
  }

  // ── Aftermath: 1-2 EMPTY flight-suits slumped against a wall (no bodies — deflated) ──
  const suits = 1 + Math.floor(rand() * 2);
  for (let i = 0; i < suits; i++) {
    const zf = rand() < 0.5 ? -1 : 1;
    const p = spot(0.3 + rand() * 0.4, zf * 0.78);
    const suit = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.5, 7), _suitMat);
    torso.rotation.z = zf * 1.15; torso.position.y = 0.22;
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), _crateDark);
    helm.position.set(zf * -0.34, 0.14, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 6), _suitMat);
    arm.rotation.z = zf * 0.4; arm.position.set(zf * 0.1, 0.16, 0.16);
    suit.add(torso, helm, arm);
    suit.position.set(p.x, 0, p.z); suit.rotation.y = rand() * Math.PI;
    mark(suit);
  }

  // ── Scorch marks on the floor (dark blast patches) ──
  for (let i = 0; i < 3; i++) {
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(0.4 + rand() * 0.6, 12), _scorchInner);
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.set((rand() - 0.5) * len * 0.7, 0.03, (rand() - 0.5) * r * 1.0);
    scorch.renderOrder = 1; scorch.userData.isWreckDecoration = true;
    g.add(scorch);
  }
}

function assembleCrashHusk(rand: Rng): AssembleResult {
  const a = new Assembly();
  const husk = huskShell(seedOf(rand));
  dressCrashInterior(husk, rand, _crashRole);
  a.place(husk, liftToGround(husk));
  return a.result();
}

// ════════════════════════════════════════════════════════════════════
// DERELICT — an intact-ish ship built from socket-mated hull parts in a NON-tube form:
// wide-body (outrigger hull pods) / stacked (superstructure) / linear. The new system's
// answer to the user's "wider/weirder ships" (additive — the refined legacy ship stays).
// ════════════════════════════════════════════════════════════════════
function assembleDerelict(rand: Rng): AssembleResult {
  const a = new Assembly();
  const s = seedOf(rand);                  // the ONLY rand draw — everything below is phash (D208/D221)
  const form = phash(s, 0);
  const splayEngine = phash(s, 1) < 0.6;   // C41 r2 — show the SPLAYED cluster more often (was 0.45)
  const spine = hullBarrel(s);
  const spinePl = a.place(spine, liftToGround(spine));
  const nose = noseCone(s + 100);
  a.place(nose, mate(spinePl, socket(spine, 'fwd'), socket(nose, 'base')));
  // Stern: a single bell OR a SPLAYED multi-engine cluster (M7 ⑤ — a wider/weirder stern).
  if (splayEngine) {
    const cluster = splayedEngineCluster(s + 200);
    a.place(cluster, mate(spinePl, socket(spine, 'aft'), socket(cluster, 'mount')));
  } else {
    const engine = engineNozzle(s + 200);
    a.place(engine, mate(spinePl, socket(spine, 'aft'), socket(engine, 'mount')));
  }
  // Superstructure form. M7 ⑤ (C41 r2) — 5 forms, and EVERY form now carries a secondary
  // feature (the bare-linear branch is gone → no "all tubes" regression).
  if (form < 0.24) {
    // WIDE-BODY trimaran — twin outrigger HULLS (pod + its own nose so it reads as a hull
    // section, not an open barrel) PARALLEL to the spine + a beefier cross-strut.
    const spoX = socket(spine, 'spoL').pos.x;          // = r·0.85
    const offX = spoX * 1.7;                            // C41 r2 — pods closer (cohesion)
    for (const sgn of [1, -1]) {
      const pod = hullBarrel(s + 300 + (sgn > 0 ? 7 : 17), 0.72);
      const podPl = a.place(pod, spinePl.clone().multiply(new THREE.Matrix4().makeTranslation(sgn * offX, -0.1, -0.2)));
      const podNose = noseCone(s + 340 + (sgn > 0 ? 1 : 2));
      a.place(podNose, mate(podPl, socket(pod, 'fwd'), socket(podNose, 'base')));
    }
    const strut = hullBarrel(s + 360, 0.42);
    const strutPl = spinePl.clone()
      .multiply(new THREE.Matrix4().makeTranslation(0, spoX * 0.45, 0))
      .multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));   // lie across ±X
    a.place(strut, strutPl);
  } else if (form < 0.46) {
    // STACKED — a dorsal superstructure barrel (a conning-tower silhouette) (ACBB).
    const tower = hullBarrel(s + 400, 0.55);
    a.place(tower, mate(spinePl, socket(spine, 'top'), socket(tower, 'aft')));
  } else if (form < 0.66) {
    // MASTED (NEW) — a tall sensor mast (now a housing + thicker spike) off the spine top.
    const mast = dorsalMast(s + 500);
    a.place(mast, mate(spinePl, socket(spine, 'top'), socket(mast, 'base')));
  } else if (form < 0.84) {
    // ASYMMETRIC (NEW) — a BIG single outrigger HULL (pod + its own nose) on one (phash-chosen)
    // flank + a mast: an off-balance "welded from salvage" read instead of mirror-symmetry.
    const sgn = phash(s, 7) < 0.5 ? 1 : -1;
    const spoX = socket(spine, 'spoL').pos.x;
    const pod = hullBarrel(s + 320, 0.85);             // C41 r2 — bigger (was 0.62, read as a blob+stick)
    const podPl = a.place(pod, spinePl.clone()
      .multiply(new THREE.Matrix4().makeTranslation(sgn * spoX * 2.0, -0.08, phash(s, 8) * 0.8 - 0.4)));
    const podNose = noseCone(s + 348);
    a.place(podNose, mate(podPl, socket(pod, 'fwd'), socket(podNose, 'base')));
    const mast = dorsalMast(s + 520);
    a.place(mast, mate(spinePl, socket(spine, 'top'), socket(mast, 'base')));
  } else {
    // LAYERED (NEW, replaces the bare-tube linear) — a stacked tower with a mast on its top:
    // a tall layered superstructure so even the simplest roll carries vertical mass.
    const tower = hullBarrel(s + 400, 0.5);
    const towerPl = a.place(tower, mate(spinePl, socket(spine, 'top'), socket(tower, 'aft')));
    const mast = dorsalMast(s + 540);
    a.place(mast, mate(towerPl, socket(tower, 'top'), socket(mast, 'base')));
  }
  return a.result();
}

// ════════════════════════════════════════════════════════════════════
// WATCHTOWER (M7 ⑥, C42) — a scavenged-metal lookout: legs + a railed deck + a slanted roof +
// a WALKABLE ramp up to the vantage. A BUILT human landmark (someone raised this), not a wreck —
// adds non-ship variety to the scatter. Stands ~level on the surface; the ramp slope (~30°) is
// under the KCC climb limit so the player can walk up to the deck (feel → walk-test).
// ════════════════════════════════════════════════════════════════════
function assembleWatchtower(rand: Rng): AssembleResult {
  const a = new Assembly();
  const s = seedOf(rand);
  const tower = watchtower(s);
  a.place(tower, liftToGround(tower));
  return a.result();
}

// ── Archetype registry + biome-weighted roulette ─────────────────────
export const ARCHETYPES: Record<string, Archetype> = {
  watchtower: {
    id: 'watchtower',
    // A standing BUILT structure — rests ~level on the surface (no crash-list to speak of, so the
    // ramp stays walkable; a shallow seat beds the legs), a salvage panel on a leg, a windward drift.
    params: { bucket: 'dark', burySink: false, bury: 0, list: 0.04, panelMin: 1, panelMax: 1, sandMound: true, seatSink: 0.12, salvageKind: 'fuselage' },
    assemble: assembleWatchtower,
  },
  satellite: {
    id: 'satellite',
    // ACBB Tier 2 — read as CRASH-LANDED, not a showroom display (the critique's #1
    // immersion break): a real hard-landing LEAN (0.15→0.30) + a deeper base SEAT
    // (0.12→0.38) so it beds into the dune instead of floating; the proud sand drift now
    // banks up its windward base. Still burySink:false (stands — distinct from the toppled tank).
    params: { bucket: 'cool', burySink: false, bury: 0, list: 0.30, panelMin: 1, panelMax: 1, sandMound: true, seatSink: 0.38, salvageKind: 'escape_pod' },
    assemble: assembleSatellite,
  },
  wrecked_tank: {
    id: 'wrecked_tank',
    // Toppled + RIPPED OPEN + HALF-SWALLOWED by sand (D233 critique): sink ~57% of the
    // height so the sand line crosses the hull axis (clamp 0.68 lets it bite), a roll-list,
    // a windward drift. The component also banks its own sand drift up the lower flank.
    params: { bucket: 'dark', burySink: true, bury: 1.7, buryFrac: 0.57, buryClampFrac: 0.68, list: 0.24, panelMin: 1, panelMax: 1, sandMound: true, salvageKind: 'cargo_container' },
    assemble: assembleWreckedTank,
  },
  debris_field: {
    id: 'debris_field',
    params: { bucket: 'warm', burySink: false, bury: 0, list: 0, panelMin: 1, panelMax: 2, sandMound: false, salvageKind: 'fuselage', seatSink: 0.05 },
    assemble: assembleDebris,
  },
  hollow_husk: {
    id: 'hollow_husk',
    params: { bucket: 'dark', burySink: true, bury: 0.6, list: 0.12, panelMin: 1, panelMax: 1, sandMound: true, salvageKind: 'massive' },
    assemble: assembleHusk,
  },
  // ACBE (D1 Tier 3) — the dressed, enterable CRASH wreck. Forced by landCrashAt only
  // (deliberately absent from ARCH_WEIGHTS so it never appears in the world-gen scatter).
  crash_husk: {
    id: 'crash_husk',
    params: { bucket: 'dark', burySink: true, bury: 0.55, list: 0.14, panelMin: 1, panelMax: 1, sandMound: true, salvageKind: 'massive' },
    assemble: assembleCrashHusk,
  },
  derelict: {
    id: 'derelict',
    // ACBB Tier 2 — the derelict rested ON the sand like a prop (critique sev2); give it a
    // real settle + crash-list so it reads CRASHED + bedded. C41 r2: list 0.20→0.26. C41 r3:
    // bury 0.55→0.45 so the nose/stern show + a short-fat hull doesn't read as a buried blob+mast.
    params: { bucket: 'cool', burySink: true, bury: 0.45, list: 0.26, panelMin: 1, panelMax: 1, sandMound: true, salvageKind: 'fuselage' },
    assemble: assembleDerelict,
  },
};

export type ArchetypeId = 'ship' | keyof typeof ARCHETYPES;

// Biome-weighted: dune favours tank/satellite (industrial relics half-sunk in sand),
// salt favours ships (freight routes), wreck_yard mixes everything. `ship` delegates to
// the legacy linear assembler (placeProcgenComposite) so today's hulls still appear.
// M7 ⑤ (C41) — the socket-grammar `derelict` (now 5 silhouette forms × 2 stern types) is
// the answer to "all long tubes"; shifted ~0.08 from the legacy linear `ship` → `derelict`
// in every biome so the wider/weirder hulls appear roughly as often as the tube hulls.
// M7 ⑥ (C42) — the `watchtower` (a BUILT human landmark) joins at ~0.07 per biome; it's
// rarest in the wreck_yard (a ship graveyard, not a settlement) and slightly more common on the
// open salt/dune flats where a lookout makes sense.
const ARCH_WEIGHTS: Record<BiomeId, Array<[ArchetypeId, number]>> = {
  salt:       [['ship', 0.26], ['derelict', 0.22], ['satellite', 0.15], ['wrecked_tank', 0.12], ['debris_field', 0.10], ['hollow_husk', 0.08], ['watchtower', 0.08]],
  rocky:      [['ship', 0.20], ['derelict', 0.21], ['satellite', 0.13], ['wrecked_tank', 0.19], ['debris_field', 0.10], ['hollow_husk', 0.11], ['watchtower', 0.07]],
  dune:       [['ship', 0.18], ['derelict', 0.23], ['satellite', 0.17], ['wrecked_tank', 0.15], ['debris_field', 0.08], ['hollow_husk', 0.13], ['watchtower', 0.08]],
  wreck_yard: [['ship', 0.18], ['derelict', 0.22], ['satellite', 0.13], ['wrecked_tank', 0.17], ['debris_field', 0.16], ['hollow_husk', 0.12], ['watchtower', 0.04]],
};

export function pickArchetype(rand: Rng, biome?: BiomeId): ArchetypeId {
  const table = ARCH_WEIGHTS[biome ?? 'dune'] ?? ARCH_WEIGHTS.dune;
  const r = rand();
  let acc = 0;
  for (const [id, w] of table) { acc += w; if (r < acc) return id; }
  return 'ship';
}
