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
  noseCone, hullBarrel, engineNozzle,
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

// ════════════════════════════════════════════════════════════════════
// DEBRIS FIELD — no hull: torn plates, bent struts + a lootable chunk strewn over
// a disc. The "blast-scatter / fallen-apart" graveyard texture between bigger POIs.
// ════════════════════════════════════════════════════════════════════
function assembleDebris(rand: Rng): AssembleResult {
  const a = new Assembly();
  const s = seedOf(rand);
  const n = 6 + Math.floor(rand() * 5);   // 6-10 pieces (ONE rand draw)
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
      sink = phash(s, 600 + i) * 0.3;
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
// DERELICT — an intact-ish ship built from socket-mated hull parts in a NON-tube form:
// wide-body (outrigger hull pods) / stacked (superstructure) / linear. The new system's
// answer to the user's "wider/weirder ships" (additive — the refined legacy ship stays).
// ════════════════════════════════════════════════════════════════════
function assembleDerelict(rand: Rng): AssembleResult {
  const a = new Assembly();
  const s = seedOf(rand);
  const form = phash(s, 0);
  const spine = hullBarrel(s);
  const spinePl = a.place(spine, liftToGround(spine));
  const nose = noseCone(s + 100);
  a.place(nose, mate(spinePl, socket(spine, 'fwd'), socket(nose, 'base')));
  const engine = engineNozzle(s + 200);
  a.place(engine, mate(spinePl, socket(spine, 'aft'), socket(engine, 'mount')));
  if (form < 0.45) {
    // WIDE-BODY — outrigger hull pods grafted onto both flanks (a catamaran-ish hauler).
    for (const sock of ['spoL', 'spoR'] as const) {
      const spon = hullBarrel(s + 300 + (sock === 'spoL' ? 7 : 17), 0.62);
      a.place(spon, mate(spinePl, socket(spine, sock), socket(spon, 'aft')));
    }
  } else if (form < 0.75) {
    // STACKED — a dorsal superstructure barrel (a conning-tower silhouette).
    const tower = hullBarrel(s + 400, 0.55);
    a.place(tower, mate(spinePl, socket(spine, 'top'), socket(tower, 'aft')));
  }
  // else: a clean LINEAR ship (nose + spine + engine).
  return a.result();
}

// ── Archetype registry + biome-weighted roulette ─────────────────────
export const ARCHETYPES: Record<string, Archetype> = {
  satellite: {
    id: 'satellite',
    params: { bucket: 'cool', burySink: false, bury: 0, list: 0.15, panelMin: 1, panelMax: 1, sandMound: true, seatSink: 0.12, salvageKind: 'escape_pod' },
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
  derelict: {
    id: 'derelict',
    params: { bucket: 'cool', burySink: true, bury: 0.25, list: 0.14, panelMin: 1, panelMax: 1, sandMound: true, salvageKind: 'fuselage' },
    assemble: assembleDerelict,
  },
};

export type ArchetypeId = 'ship' | keyof typeof ARCHETYPES;

// Biome-weighted: dune favours tank/satellite (industrial relics half-sunk in sand),
// salt favours ships (freight routes), wreck_yard mixes everything. `ship` delegates to
// the legacy linear assembler (placeProcgenComposite) so today's hulls still appear.
const ARCH_WEIGHTS: Record<BiomeId, Array<[ArchetypeId, number]>> = {
  salt:       [['ship', 0.38], ['derelict', 0.14], ['satellite', 0.16], ['wrecked_tank', 0.12], ['debris_field', 0.10], ['hollow_husk', 0.10]],
  rocky:      [['ship', 0.30], ['derelict', 0.14], ['satellite', 0.14], ['wrecked_tank', 0.20], ['debris_field', 0.10], ['hollow_husk', 0.12]],
  dune:       [['ship', 0.28], ['derelict', 0.14], ['satellite', 0.18], ['wrecked_tank', 0.18], ['debris_field', 0.08], ['hollow_husk', 0.14]],
  wreck_yard: [['ship', 0.26], ['derelict', 0.14], ['satellite', 0.13], ['wrecked_tank', 0.18], ['debris_field', 0.16], ['hollow_husk', 0.13]],
};

export function pickArchetype(rand: Rng, biome?: BiomeId): ArchetypeId {
  const table = ARCH_WEIGHTS[biome ?? 'dune'] ?? ARCH_WEIGHTS.dune;
  const r = rand();
  let acc = 0;
  for (const [id, w] of table) { acc += w; if (r < acc) return id; }
  return 'ship';
}
