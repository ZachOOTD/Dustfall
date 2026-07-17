// Wordless prop scenes (M5b, C32).
//
// Environmental storytelling with NO text: a handful of hand-composed prop tableaux
// scattered in the mid-field that imply a story — someone sat down by a dying fire
// and never got up; a watcher who faced the horizon to the end. The desert remembers.
// Composed from existing meshes (the slumped seated skeleton + scrap) plus simple
// set-dressing props. Discovered while exploring (pairs with the M5a arc: crest →
// glass a wreck → reach it → and find who died here).
//
// Determinism: placed from a DEDICATED seeded RNG (independent of the scatter stream),
// so the seeded placement of everything else is untouched. Pure decorations — no
// colliders, not salvage panels — so the placement + collider audits are unaffected.

import * as THREE from 'three';
import type { Terrain } from './terrain.ts';
import { makeRng, type Rng } from '../core/rng.ts';
import { makeSkeleton } from './skeleton.ts';
import { buildScrapMesh } from './scrapMesh.ts';
import { Tuning } from '../config/tuning.ts';

// Shared materials (module-level → no per-instance shader programs).
// Lighter stone (C32 r2) so the cairn/fire stones separate from cast shadow + the
// figure, not merge into one dark blob.
const STONE = new THREE.MeshStandardMaterial({ color: 0x978c79, roughness: 0.95, metalness: 0.0, flatShading: true });
const STONE_D = new THREE.MeshStandardMaterial({ color: 0x736857, roughness: 0.96, metalness: 0.0, flatShading: true });
const ASH = new THREE.MeshStandardMaterial({ color: 0x3a342d, roughness: 1.0, metalness: 0.0 });
const CHAR = new THREE.MeshStandardMaterial({ color: 0x14110e, roughness: 0.9, metalness: 0.0 });
const METAL = new THREE.MeshStandardMaterial({ color: 0xa3936b, roughness: 0.55, metalness: 0.55 });
const METAL_D = new THREE.MeshStandardMaterial({ color: 0x6a5538, roughness: 0.7, metalness: 0.4 });
const FABRIC = new THREE.MeshStandardMaterial({ color: 0x8a7350, roughness: 0.95, metalness: 0.0 });

// ── Prop builders ─────────────────────────────────────────────────────────

/** A cold fire pit: a ring of stones around an ash bed with a few charred sticks. */
function makeColdFirePit(rand: () => number): THREE.Group {
  // C32 r2 — small, low, clearly-a-campfire: a tight ring of SMALL stones around a
  // dark charred ash center crossed by burnt logs. Kept well under the figure's mass
  // so the skeleton stays the focal point (was an oversized rubble mound).
  const g = new THREE.Group();
  const ringR = 0.30;
  const stones = 8 + Math.floor(rand() * 3);
  for (let i = 0; i < stones; i++) {
    const a = (i / stones) * Math.PI * 2 + (rand() - 0.5) * 0.25;
    const r = ringR + (rand() - 0.5) * 0.04;
    const s = 0.06 + rand() * 0.04;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rand() < 0.5 ? STONE : STONE_D);
    stone.position.set(Math.cos(a) * r, s * 0.5, Math.sin(a) * r);
    stone.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    g.add(stone);
  }
  // Ash bed + a darker charred core so it reads as a SPENT fire.
  const ash = new THREE.Mesh(new THREE.CylinderGeometry(ringR * 0.78, ringR * 0.88, 0.03, 16), ASH);
  ash.position.y = 0.015; g.add(ash);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(ringR * 0.42, ringR * 0.5, 0.02, 14), CHAR);
  core.position.y = 0.03; g.add(core);
  // Two burnt logs crossing the center.
  for (let i = 0; i < 2; i++) {
    const len = 0.34 + rand() * 0.12;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, len, 6), CHAR);
    log.position.set((rand() - 0.5) * 0.1, 0.045, (rand() - 0.5) * 0.1);
    log.rotation.set(Math.PI / 2, (i * 1.1) + rand() * 0.5, (rand() - 0.5) * 0.3);
    g.add(log);
  }
  return g;
}

/** A fallen canteen lying on its side (a dry, dropped vessel). */
function makeFallenCanteen(): THREE.Group {
  // C32 r2 — bigger + lighter metal so it reads as a dropped man-made vessel, not a
  // pebble. A flask on its side: disc body + a neck/cap + a shoulder strap.
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 16), METAL);
  body.rotation.x = Math.PI / 2;            // lay it flat (disc-shaped canteen on its side)
  g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.04, 10), METAL_D);
  neck.position.set(0, 0.125, 0); g.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.022, 10), METAL_D);
  cap.position.set(0, 0.155, 0); g.add(cap);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.012, 6, 16), FABRIC);
  g.add(strap);
  g.position.y = 0.11;                       // rest on its rim
  g.rotation.set(0, 0, Math.PI / 2);
  return g;
}

/** A small stacked-stone cairn (a marker / a back-rest). */
function makeCairn(rand: () => number): THREE.Group {
  // C32 r2 — slimmer + shorter (was a big dark mass that swallowed the seated figure).
  // A low knee-height stack the skeleton can lean against without disappearing into it.
  const g = new THREE.Group();
  let y = 0;
  const n = 4;
  for (let i = 0; i < n; i++) {
    const s = (0.21 - i * 0.035) * (0.95 + rand() * 0.12);   // clearly graduated, largest at base
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), i % 2 ? STONE_D : STONE);
    stone.position.set((rand() - 0.5) * 0.02, y + s * 0.55, (rand() - 0.5) * 0.02);  // tight centre stack
    stone.rotation.set(rand() * 0.5, rand() * Math.PI, rand() * 0.5);                 // settled, not tumbled
    g.add(stone);
    y += s * 0.92;
  }
  return g;
}

function scrapBit(): THREE.Group {
  return buildScrapMesh(METAL_D, CHAR);
}

// M10 (2026-07-13) — a few more simple props for the "what was left behind"
// vignettes (no body — someone camped/broke-down/sorted-a-haul and walked on).
// All solid geometry (rule 7 — no paper-thin cards) on the shared materials.
const CRATE = new THREE.MeshStandardMaterial({ color: 0x8f7a52, roughness: 0.9, metalness: 0.05, flatShading: true });

/** An unrolled bedroll — a flat padded mat + a rolled pillow at one end. */
function makeBedroll(rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 1.5), FABRIC);   // thick padded mat (rule 7)
  mat.position.y = 0.03; g.add(mat);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.58, 10), FABRIC);
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, 0.09, -0.72); g.add(roll);   // pillow at the head
  // a rumpled fold across the mat
  const fold = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.34), FABRIC);
  fold.position.set((rand() - 0.5) * 0.06, 0.075, 0.3); fold.rotation.x = (rand() - 0.5) * 0.2; g.add(fold);
  return g;
}

/** A supply crate — a thick-walled box with corner posts + plank lines. Optionally open. */
function makeCrate(rand: () => number, open = false): THREE.Group {
  const g = new THREE.Group();
  const w = 0.44, h = 0.40, d = 0.44;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), CRATE);
  body.position.y = h / 2; g.add(body);
  // corner posts (real depth — rule 7)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, h + 0.02, 0.05), METAL_D);
    post.position.set(sx * (w / 2 - 0.01), h / 2, sz * (d / 2 - 0.01)); g.add(post);
  }
  if (open) {
    // lid ajar, leaning off one edge
    const lid = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), CRATE);
    lid.position.set(w * 0.55, h + 0.12, 0); lid.rotation.z = -0.7; g.add(lid);
  } else {
    const lid = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), CRATE);
    lid.position.y = h + 0.025; g.add(lid);
  }
  g.rotation.y = (rand() - 0.5) * 0.4;
  return g;
}

/** A stripped wheel/tyre lying half-sunk (a broke-down vehicle's cannibalised part). */
function makeStrippedWheel(): THREE.Group {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.1, 8, 18), CHAR);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 12), METAL_D);
  hub.rotation.x = Math.PI / 2; g.add(tyre); g.add(hub);
  g.rotation.set(Math.PI / 2 - 0.35, 0, 0);   // canted, resting partly on its side
  g.position.y = 0.12;
  return g;
}

/** A dropped wrench-like tool (two crossed bars). */
function makeTool(): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.05), METAL);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.11), METAL_D);
  head.position.x = 0.18; g.add(shaft); g.add(head);
  g.position.y = 0.02; g.rotation.y = Math.PI * 0.3;
  return g;
}

// ── Scene composers — each returns a group with the skeleton facing +Z. ─────

/** "The last fire" — slumped by a dead fire, a dropped canteen at hand. */
function sceneLastFire(rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const skel = makeSkeleton();
  skel.position.set(0, 0, 0);                // seated, facing +Z (toward the fire)
  g.add(skel);
  const fire = makeColdFirePit(rand);
  fire.position.set(0, 0, 0.9);              // the fire in front of them
  g.add(fire);
  const canteen = makeFallenCanteen();
  canteen.position.set(0.42, 0, 0.35);       // dropped at the right hand
  canteen.rotation.y = rand() * Math.PI;
  g.add(canteen);
  if (rand() < 0.6) { const s = scrapBit(); s.scale.setScalar(0.5); s.position.set(-0.5, 0.05, 0.5); g.add(s); }
  return g;
}

/** "The watcher" — slumped against a cairn, facing out toward the horizon. */
function sceneWatcher(rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const skel = makeSkeleton();               // faces +Z (out toward the horizon)
  g.add(skel);
  const cairn = makeCairn(rand);
  cairn.position.set(0, 0, -0.5);            // a stone back-rest behind them
  g.add(cairn);
  const canteen = makeFallenCanteen();
  canteen.position.set(-0.4, 0, 0.1);
  canteen.rotation.y = rand() * Math.PI;
  g.add(canteen);
  return g;
}

// ("The pair" — two skeletons slumped toward a shared dead fire — REMOVED 2026-07-09
// per user request. The single-figure vignettes below remain.)

// ── M10 (2026-07-13) — NO-BODY "what was left behind" vignettes. The crew is
//    GONE (walked off, moved on) — implied by what remains, never a figure. Adds
//    variety to the two skeleton vignettes above (the desert isn't only death). ──

/** "Cold camp" — a bedroll, a spent fire, a dropped canteen. Someone slept here + moved on. */
function sceneColdCamp(rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const bed = makeBedroll(rand);
  bed.position.set(-0.35, 0, 0); bed.rotation.y = 0.15; g.add(bed);
  const fire = makeColdFirePit(rand);
  fire.position.set(0.55, 0, 0.5); g.add(fire);               // the fire beside the bed
  const canteen = makeFallenCanteen();
  canteen.position.set(0.15, 0, -0.5); canteen.rotation.y = rand() * Math.PI; g.add(canteen);
  if (rand() < 0.6) { const s = scrapBit(); s.scale.setScalar(0.5); s.position.set(0.9, 0.05, -0.2); g.add(s); }
  return g;
}

/** "Stripped" — a broke-down vehicle cannibalised for parts: a half-sunk wheel, a
 *  torn panel, a dropped tool, scattered scrap. Someone salvaged it + carried on. */
function sceneStripped(rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const wheel = makeStrippedWheel();
  wheel.position.set(0, 0, 0.2); wheel.rotation.z = rand() * Math.PI; g.add(wheel);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.09, 0.5), METAL_D);   // a torn hull/body panel (thick)
  panel.position.set(-0.7, 0.06, -0.3); panel.rotation.set(0.2, rand() * Math.PI, 0.15); g.add(panel);
  const tool = makeTool(); tool.position.set(0.5, 0, -0.35); g.add(tool);
  for (let i = 0; i < 2 + Math.floor(rand() * 2); i++) {
    const s = scrapBit(); s.scale.setScalar(0.45 + rand() * 0.2);
    s.position.set((rand() - 0.5) * 1.4, 0.05, (rand() - 0.5) * 1.2); g.add(s);
  }
  return g;
}

/** "The cache" — a sorted haul, abandoned: a couple of crates (one open + spilling),
 *  a canteen. Someone triaged their salvage + left what they couldn't carry. */
function sceneCache(rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const c1 = makeCrate(rand, false); c1.position.set(-0.3, 0, 0); g.add(c1);
  const c2 = makeCrate(rand, true); c2.position.set(0.45, 0, 0.25); g.add(c2);   // open, rifled
  if (rand() < 0.7) { const c3 = makeCrate(rand, false); c3.position.set(0.1, 0.44, -0.05); c3.rotation.y = 0.3; g.add(c3); }  // stacked
  // scrap spilling from the open crate
  for (let i = 0; i < 2; i++) { const s = scrapBit(); s.scale.setScalar(0.4); s.position.set(0.65 + rand() * 0.3, 0.05, 0.45 + (rand() - 0.5) * 0.3); g.add(s); }
  const canteen = makeFallenCanteen(); canteen.position.set(-0.1, 0, 0.7); canteen.rotation.y = rand() * Math.PI; g.add(canteen);
  return g;
}

const ARCHETYPES = [sceneLastFire, sceneWatcher, sceneColdCamp, sceneStripped, sceneCache];

/** Infinite Sands S3 — build ONE tableau (unpositioned) for the chunk
 *  streamer. `index` cycles the archetype list; `rand` should be a
 *  per-chunk stream (decoration-only, no colliders/registries — the same
 *  contract as the boot ring). */
export function buildWordlessTableau(index: number, rand: Rng): THREE.Group {
  const tableau = ARCHETYPES[((index % ARCHETYPES.length) + ARCHETYPES.length) % ARCHETYPES.length](rand);
  tableau.name = 'wordlessScene';
  return tableau;
}

// ── Placement ───────────────────────────────────────────────────────────────

/** Scatter a few wordless prop scenes across the mid-field. Deterministic +
 *  decoration-only. Call once at world build. */
export function placeWordlessScenes(
  scene: THREE.Scene,
  terrain: Terrain,
  worldSeed: number,
  rocks?: THREE.Object3D[],
): void {
  const rand = makeRng((worldSeed ^ 0x5ce7e5) >>> 0);
  const count = Tuning.WORDLESS_SCENE_COUNT;
  const clearSq = Tuning.WORDLESS_SCENE_CLEAR_M * Tuning.WORDLESS_SCENE_CLEAR_M;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.9;
    const dist = Tuning.WORDLESS_SCENE_RADIUS_MIN
      + rand() * (Tuning.WORDLESS_SCENE_RADIUS_MAX - Tuning.WORDLESS_SCENE_RADIUS_MIN);
    const x = Math.cos(ang) * dist;
    const z = Math.sin(ang) * dist;
    const y = terrain.heightAt(x, z);
    // Clear any scatter rocks sitting on the tableau so it gets a clean stage (a
    // boulder in the middle of a death scene reads as clutter). No rand draw.
    if (rocks) {
      for (let r = rocks.length - 1; r >= 0; r--) {
        const p = rocks[r].position;
        const dx = p.x - x, dz = p.z - z;
        if (dx * dx + dz * dz < clearSq) {
          scene.remove(rocks[r]);
          rocks.splice(r, 1);
        }
      }
    }
    // Cycle archetypes so consecutive scenes alternate (one of each) before repeating.
    const tableau = ARCHETYPES[i % ARCHETYPES.length](rand);
    tableau.name = 'wordlessScene';
    tableau.position.set(x, y, z);
    tableau.rotation.y = rand() * Math.PI * 2;
    scene.add(tableau);
  }
}
