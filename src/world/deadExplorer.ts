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

/** Compose the tableau. `rand` is the caller's per-cave stream — the same seed always
 *  produces the same scene, so a re-streamed cave's body is identical on re-entry (D290). */
export function buildDeadExplorer(rand: Rng): DeadExplorer {
  const group = new THREE.Group();
  group.name = 'deadExplorer';

  // ── The figure. Its authored pose IS this beat; nothing here re-poses it.
  const skel = makeSkeleton();
  group.add(skel);

  // ── The spent lantern, on its side just past the reaching hand.
  const lantern = spentLanternClone();
  lantern.position.set(
    Tuning.CAVE_BEAT_LANTERN_SIDE,
    0.0,
    Tuning.CAVE_BEAT_LANTERN_FWD,
  );
  // Tipped over onto its side — a lantern that was set down and then fell, not one placed.
  lantern.rotation.set(0, rand() * Math.PI * 2, Math.PI * 0.5 + (rand() - 0.5) * 0.2);
  lantern.position.y = 0.17;                          // the tipped cage rests on the floor
  group.add(lantern);

  // ── The canteen at the hip.
  const canteen = makeFallenCanteen(rand);
  canteen.position.x += Tuning.CAVE_BEAT_CANTEEN_SIDE;
  canteen.position.z += Tuning.CAVE_BEAT_CANTEEN_FWD;
  group.add(canteen);

  // ── A little gear spilled between the crate and the body.
  const crateLocal = new THREE.Vector3(
    Tuning.CAVE_BEAT_CRATE_SIDE,
    0,
    Tuning.CAVE_BEAT_CRATE_FWD,
  );
  const flakes = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < flakes; i++) {
    const f = makeSpilledFlake(rand);
    const a = rand() * Math.PI * 2;
    const r = 0.28 + rand() * 0.26;
    f.position.x += crateLocal.x + Math.cos(a) * r;
    f.position.z += crateLocal.z + Math.sin(a) * r;
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
      0.0,
      Tuning.CAVE_BEAT_JOURNAL_FWD,
    ),
    journalYaw: (rand() - 0.5) * 0.9,                 // askew, as dropped
    crateLocal,
  };
}
