// DEEPER cycle 12 — THE DEAD EXPLORER.
//
// Zach's brief, verbatim: *"there should be a journal and a skeleton in one of the caves
// with some loot."* This module is the composition of that beat — every load-bearing part
// already shipped (`makeSkeleton`, `placeJournal`, `spawnLootContainerAt`, the lantern
// visual), so this is a staging job, not a new system.
//
// THE STAGING, and why each piece is where it is:
//
//   Slumped against a chamber wall, off the walk line. The right arm reaches out — the
//   skeleton was authored in exactly this pose, its own header reads "slumped against the
//   back wall, died writing" — with the JOURNAL at the fingertips. A SPENT LANTERN on its
//   side just past the hand: the light that ran out, and the same lantern the player
//   deploys, so cycle 11's cave tool is recognisable at a glance. A FALLEN CANTEEN at the
//   hip. The LOOT CACHE against the wall beside them, gear half spilled out.
//
// The arrangement tells the story with no text at all: they got to this wall, they sat
// down, they wrote, the light went out. The journal is the REWARD for having read the
// scene, not the delivery mechanism for it.
//
// TONE — this is a survival game, not a horror game (cycle-12 plan R6). Sad and quiet, not
// a scare: no blood, no rictus, no contortion, no staging for shock. A cold, dead thing
// somebody left behind. It is lit by the player's own torch and nothing else.
//
// COLLIDER: NONE, deliberately. A ~0.9m slumped figure out by the wall is exactly the
// "step over / walk between" case the shipped scatter rule covers (`boneScatter.ts:27-33`),
// and a collider here would put decoration into the march gate's floor-grid margin business
// for zero gameplay gain. The whole subtree is tagged `isWreckDecoration`, which
// `bodies.ts` honours.
//
// LOCAL SPACE: everything is built at the group's local origin with the figure facing +Z,
// matching the skeleton's own convention (origin on the floor between the feet, back wall
// behind on -Z). The caller positions and yaws the GROUP, then converts the published
// anchors with `localToWorld` — so the props and their anchors can never disagree.

import * as THREE from 'three';
import type { Rng } from '../core/rng.ts';
import { Tuning } from '../config/tuning.ts';
import { makeSkeleton } from './skeleton.ts';
import { makeSpentLanternProp } from './lantern.ts';
import { createMetalMaterial } from './metalMaterial.ts';
import { createFabricMaterial } from './fabricMaterial.ts';

export interface DeadExplorer {
  /** The whole tableau at local origin, figure facing +Z. Decoration only — no colliders. */
  group: THREE.Group;
  /** LOCAL position for the journal (the caller `placeJournal`s it in world space). */
  journalLocal: THREE.Vector3;
  /** LOCAL yaw for the journal, so it lies askew rather than square to the body. */
  journalYaw: number;
  /** LOCAL position for the loot container (the caller `spawnLootContainerAt`s it). */
  crateLocal: THREE.Vector3;
}

// ── MATERIALS ARE MODULE-SHARED, DELIBERATELY ────────────────────────────────────────────────
// The beat is spawned and DISPOSED per cave (the sink tears it down on eviction), and the cave
// teardown idiom disposes GEOMETRY ONLY because "materials here are module-shared and must NEVER
// be disposed" (`caveStream.disposeResident`). Per-instance materials would therefore leak one
// material — and its compiled program — for every warren the player ever streams past. So these
// live at module scope like `wordlessScenes`' and `skeleton`'s do, and the sink's teardown needs
// no bookkeeping at all: dispose geometry, touch nothing else.
const METAL = createMetalMaterial(0x6b6055, { wornScale: 7.0, rustLevel: 0.35 });
const METAL_D = createMetalMaterial(0x3e372e, { wornScale: 7.0, rustLevel: 0.4 });
const STRAP = createFabricMaterial(0x4a3b28);
const FLAKE = createMetalMaterial(0x7a6a55, { wornScale: 9.0, rustLevel: 0.55 });

// The spent lantern is built ONCE and cloned per cave: `makeLanternVisual` allocates its whole
// material set per call, so building it fresh for every warren would leak exactly what the note
// above is about. `Object3D.clone()` shares geometry AND materials with the prototype — which is
// why every clone is tagged `sharedAsset`, so the sink's teardown skips it. Disposing a clone's
// geometry would destroy the prototype for every cave after it.
let _spentLanternProto: THREE.Group | null = null;
function spentLanternClone(): THREE.Group {
  if (!_spentLanternProto) _spentLanternProto = makeSpentLanternProp();
  const c = _spentLanternProto.clone(true);
  c.traverse((o) => { o.userData.sharedAsset = true; });
  return c;
}

/** A dropped flask lying on its side — a dry, spent vessel at the hip.
 *  (`wordlessScenes.ts` has a sibling of this, module-private to that file; this one is
 *  built on the weathered-metal shader instead of a flat Lambert because it is read at
 *  torch range, 1-2m, rather than at a wreck's 2-4m.) */
function makeFallenCanteen(rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const metal = METAL;
  const capMat = METAL_D;
  const strapMat = STRAP;

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.075, 20), metal);
  body.rotation.x = Math.PI / 2;                       // a disc flask laid flat
  g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.04, 12), capMat);
  neck.position.y = 0.125; g.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.022, 12), capMat);
  cap.position.y = 0.155; g.add(cap);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.013, 8, 20), strapMat);
  g.add(strap);

  g.position.y = 0.105;                                // resting on its rim
  g.rotation.set(0, rand() * Math.PI * 2, Math.PI / 2);
  return g;
}

/** A couple of flakes of salvage spilled out of the crate — the "half spilled out" read.
 *  Deliberately tiny and few: the warren's ambient scrap caches are the bulk dressing, and
 *  this is only the seam between the cache and the body. */
function makeSpilledFlake(rand: Rng): THREE.Mesh {
  const metal = FLAKE;
  const w = 0.10 + rand() * 0.07;
  const h = 0.018 + rand() * 0.014;                    // real thickness (rule 7) — never a card
  const d = 0.07 + rand() * 0.06;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), metal);
  m.position.y = h * 0.5;
  m.rotation.set((rand() - 0.5) * 0.25, rand() * Math.PI * 2, (rand() - 0.5) * 0.25);
  return m;
}

/** WALK-TEST 2026-07-30 (Zach): *"lets make it so those loot boxes only spawn next to skeletons in
 *  caves. doesn't really make sense for them to be on their own if the world is supposed to be
 *  empty. at least beside the skeletons the loot has a story/purpose."*
 *
 *  ONE placement path for every tableau in the game — the boot-time origin caches and the streamed
 *  warren beat both come through here. They used to be two copies of the seating maths (drop the
 *  rigid figure to the LOWEST rock under its footprint, hand each loose prop its own ground), and
 *  two copies is how the cave-12 bedding work would quietly rot on one side.
 *
 *  The JOURNAL is deliberately NOT placed here: it is what separates the authored beat (a named
 *  survivor with a story, warrens only) from an anonymous salvager who did not make it back. The
 *  caller places one or does not. */
export function placeDeadExplorer(
  scene: THREE.Scene,
  anchor: { pos: THREE.Vector3; yaw: number; floor: { x0: number; z0: number; cell: number; n: number; h: number[] } },
  rand: Rng,
  sampleFloor: (f: { x0: number; z0: number; cell: number; n: number; h: number[] }, x: number, z: number) => number,
): { group: THREE.Group; journalPos: THREE.Vector3; journalYaw: number; cratePos: THREE.Vector3 } {
  const cy = Math.cos(anchor.yaw), sy = Math.sin(anchor.yaw);
  const rockAtLocal = (lx: number, lz: number): number =>
    sampleFloor(anchor.floor, anchor.pos.x + lx * cy + lz * sy, anchor.pos.z - lx * sy + lz * cy);
  // The FIGURE is one rigid body and cannot follow the ground, so it drops to the LOWEST rock under
  // its own footprint — bedding the high side into stone rather than floating the low side over it.
  let groupY = Infinity;
  for (const [lx, lz] of [[0, 0], [-0.16, 0.52], [0.16, 0.52], [0.1, 0.3]] as const) {
    groupY = Math.min(groupY, rockAtLocal(lx, lz));
  }
  const de = buildDeadExplorer(rand, (lx, lz) => rockAtLocal(lx, lz) - groupY);
  de.group.position.set(anchor.pos.x, groupY, anchor.pos.z);
  de.group.rotation.y = anchor.yaw;
  scene.add(de.group);
  // World anchors derived from the group's own transform, so props and anchors cannot disagree.
  de.group.updateMatrixWorld(true);
  return {
    group: de.group,
    journalPos: de.group.localToWorld(de.journalLocal.clone()),
    journalYaw: anchor.yaw + de.journalYaw,
    cratePos: de.group.localToWorld(de.crateLocal.clone()),
  };
}

/** Compose the tableau. `rand` is the caller's per-cave stream — the same seed always
 *  produces the same scene, so a re-streamed cave's body is identical on re-entry (D290).
 *
 *  `groundY(lx, lz)` returns the real rock height in the GROUP'S OWN LOCAL Y at a local (x, z).
 *  Every loose prop is seated with it, because the tableau is rigid and ~2.4m wide while the
 *  displaced cave floor is not flat: seating everything at y=0 floated the lantern a measured 10cm
 *  while the seat sat at 0.4cm. Defaults to a flat floor so the composer stays usable (and
 *  screenshot-able) without a cave under it. */
export function buildDeadExplorer(rand: Rng, groundY: (lx: number, lz: number) => number = () => 0): DeadExplorer {
  const group = new THREE.Group();
  group.name = 'deadExplorer';
  // Bed props slightly INTO the stone. Hovering never reads as resting; a little penetration always
  // does — the same bias `makeRockFloorSampler` applies for the same reason.
  const seat = (lx: number, lz: number, bed: number = Tuning.CAVE_BEAT_BED_M): number => groundY(lx, lz) - bed;
  /** Drop `obj` until its LOWEST VERTEX rests at the floor under it. Props are laid on their sides
   *  at random rotations, so how far their geometry reaches below their origin is not a constant —
   *  the spent lantern's hand-tuned "+0.17 so the tipped cage rests" measured 8.7cm of daylight
   *  under it. Measured, never guessed: the same rule the rock samplers follow. */
  const restOnFloor = (obj: THREE.Object3D, lx: number, lz: number): void => {
    obj.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(obj);
    if (!isFinite(bb.min.y)) return;
    // Sample the rock under where the prop's MASS actually is, not under its nominal anchor point.
    // These props are laid on their sides at a random yaw, so a flask's footprint can sit 10-20cm
    // from the point it was placed at; over a displaced floor that offset is worth centimetres, and
    // it was the whole of the canteen's residual 5.4cm.
    void lx; void lz;
    obj.position.y += seat((bb.min.x + bb.max.x) / 2, (bb.min.z + bb.max.z) / 2, Tuning.CAVE_BEAT_BED_PROP_M) - bb.min.y;
  };

  // ── The figure. Its authored STAGING is this beat — slumped against the wall, head fallen, right
  //    arm out where the book slipped from it — and nothing here re-poses it. There is now ONE
  //    skeleton build for the whole game; `tone: 'cave'` only picks the DARK dried-bone palette,
  //    because at 1m a torch sits half a metre off the bone and inverse-square blows a mid-tone out
  //    to near-white — the "bright white bone" D252 forbids. The surface call sites take the
  //    sun-bleached palette instead. Same vertices either way.
  const skel = makeSkeleton({ tone: 'cave' });
  skel.userData.beatProp = 'figure';
  group.add(skel);

  // ── The spent lantern, on its side just past the reaching hand.
  const lantern = spentLanternClone();
  lantern.position.set(
    Tuning.CAVE_BEAT_LANTERN_SIDE,
    0.0,
    Tuning.CAVE_BEAT_LANTERN_FWD,
  );
  // Tipped over onto its side — a lantern that was set down and then fell, not one placed. Yawed
  // so the tripod legs point back at the body rather than lying along the view line: at torch range
  // a full-length lantern laid broadside reads unmistakably as a staff or a rifle on the floor,
  // which is the wrong object and the wrong genre. Angled, the cage and the tripod both read.
  lantern.rotation.set(0, Math.PI * 0.62 + (rand() - 0.5) * 0.3, Math.PI * 0.5 + (rand() - 0.5) * 0.2);
  restOnFloor(lantern, Tuning.CAVE_BEAT_LANTERN_SIDE, Tuning.CAVE_BEAT_LANTERN_FWD);
  lantern.userData.beatProp = 'lantern';   // the bedding probe measures the REAL prop, not a plane
  group.add(lantern);

  // ── The canteen at the hip.
  const canteen = makeFallenCanteen(rand);
  canteen.position.x += Tuning.CAVE_BEAT_CANTEEN_SIDE;
  canteen.position.z += Tuning.CAVE_BEAT_CANTEEN_FWD;
  restOnFloor(canteen, Tuning.CAVE_BEAT_CANTEEN_SIDE, Tuning.CAVE_BEAT_CANTEEN_FWD);
  canteen.userData.beatProp = 'canteen';
  group.add(canteen);

  // ── A little gear spilled between the crate and the body.
  // The crate and the journal are spawned by the CALLER (they are interactables and need a
  // GameContext), so their bedding is baked into the published local anchors — `localToWorld` then
  // puts them on the right stone without the caller knowing anything about the floor.
  const crateLocal = new THREE.Vector3(
    Tuning.CAVE_BEAT_CRATE_SIDE,
    seat(Tuning.CAVE_BEAT_CRATE_SIDE, Tuning.CAVE_BEAT_CRATE_FWD),
    Tuning.CAVE_BEAT_CRATE_FWD,
  );
  const flakes = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < flakes; i++) {
    const f = makeSpilledFlake(rand);
    const a = rand() * Math.PI * 2;
    const r = 0.28 + rand() * 0.26;
    f.position.x += crateLocal.x + Math.cos(a) * r;
    f.position.z += crateLocal.z + Math.sin(a) * r;
    f.position.y += seat(f.position.x, f.position.z, Tuning.CAVE_BEAT_BED_PROP_M);
    group.add(f);
  }

  // ── Shadows + the decoration tag (bodies.ts honours `isWreckDecoration`; nothing in this
  //    subtree may ever become a collider or an interaction target — the crate and the
  //    journal are separate objects the caller registers.)
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
    o.userData.isWreckDecoration = true;
  });

  return {
    group,
    journalLocal: new THREE.Vector3(
      Tuning.CAVE_BEAT_JOURNAL_SIDE,
      seat(Tuning.CAVE_BEAT_JOURNAL_SIDE, Tuning.CAVE_BEAT_JOURNAL_FWD),
      Tuning.CAVE_BEAT_JOURNAL_FWD,
    ),
    journalYaw: (rand() - 0.5) * 0.9,                 // askew, as dropped
    crateLocal,
  };
}
