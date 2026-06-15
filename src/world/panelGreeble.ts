// Salvage-panel interior greeble (ACAV Tier 4).
//
// The DECORATIVE component library for the scrappy "derelict-ship salvage panel"
// interior overhaul: old pipes, fuses, machinery, exposed/frayed wires, gauges,
// valves, terminal blocks, circuit boards, cracked screens, a glowing indicator.
// These pieces are PURE SET-DRESSING — none are tagged `panelComponentIndex`, so
// they're not lootable; `wrecks.ts` populateInterior MERGES them per-panel (the
// merge skips accessPanel subtrees, so it runs before the greeble is parented
// under the body) while the 5 EXTRACTABLE loot components stay live.
//
// Everything is low-poly + flat/Lambert-or-rust material so it reads richly with
// NO textures (depth-layered geometry + brass/copper/steel/ceramic colour contrast
// is what sells it). Dimensions are relative to the cavity `u` unit so a piece
// scales with the panel. All meshes carry userData.noCollider.

import * as THREE from 'three';
import type { Rng } from '../core/rng.ts';
import type { PanelArchetype } from './wrecks.ts';
import { createMetalMaterial } from './metalMaterial.ts';

// ── Shared singleton materials (one set for ALL panels — no per-panel alloc) ──
const matCopper   = new THREE.MeshLambertMaterial({ color: 0xb06a3a, flatShading: true });   // copper wire / coil
const matWireRed  = new THREE.MeshLambertMaterial({ color: 0xa8392a, flatShading: true });   // insulated red
const matWireYel  = new THREE.MeshLambertMaterial({ color: 0xc6a634, flatShading: true });   // insulated yellow
const matBrass    = new THREE.MeshLambertMaterial({ color: 0xb89a52, flatShading: true });   // brass posts / caps / bolts
const matCeramic  = new THREE.MeshLambertMaterial({ color: 0xd8c8a4, flatShading: true });   // fuse bodies
const matPCB      = new THREE.MeshLambertMaterial({ color: 0x2c4a30, flatShading: true });   // circuit board green
const matChip     = new THREE.MeshLambertMaterial({ color: 0x14181a, flatShading: true, emissive: 0x060a08, emissiveIntensity: 1 });
const matDial     = new THREE.MeshLambertMaterial({ color: 0xd8d2c0, flatShading: true });   // gauge face
const matGlass    = new THREE.MeshLambertMaterial({ color: 0x10161c, flatShading: true });   // dark screen / gauge glass
const matScreen   = new THREE.MeshLambertMaterial({ color: 0x16252e, emissive: 0x0a2230, emissiveIntensity: 0.5, flatShading: true });   // dim CRT display
const matNeedle   = new THREE.MeshLambertMaterial({ color: 0xb02a20, flatShading: true });   // gauge needle
const matValveRed = new THREE.MeshLambertMaterial({ color: 0x9c4030, flatShading: true });   // rusted valve wheel
const matDark     = new THREE.MeshLambertMaterial({ color: 0x2a2622, flatShading: true });   // dark machinery / bezel
// Rusted steel for pipes/conduit/manifolds — localSpace so weathering doesn't
// crawl on the moving/merged wreck (D109).
const matSteel    = createMetalMaterial(0x8a7a64, { rustLevel: 0.5, localSpace: true });
const matPipe     = createMetalMaterial(0x96846a, { rustLevel: 0.4, localSpace: true });
// Emissive indicator dot — NOT a PointLight (the ABL ~68-panel light-pool trap);
// emissive is free and reads as a powered light.
const matIndGreen = new THREE.MeshBasicMaterial({ color: 0x5dff8a });
const matIndAmber = new THREE.MeshBasicMaterial({ color: 0xffb648 });
const matIndRed   = new THREE.MeshBasicMaterial({ color: 0xff5a44 });

function noColl(o: THREE.Object3D): THREE.Object3D {
  o.traverse((n) => { n.userData.noCollider = true; });
  return o;
}
const jitter = (rand: Rng, a: number) => (rand() - 0.5) * 2 * a;

// ── Component builders ───────────────────────────────────────────────
// Each returns a Group sized in metres for a `u` ≈ panel-width unit.

/** A coil of copper wire — a few stacked torus rings, slightly skewed. */
export function makeCoiledWire(u: number, rand: Rng): THREE.Object3D {
  const g = new THREE.Group();
  const r = u * 0.10;
  const tube = u * 0.022;
  const rings = 3 + Math.floor(rand() * 2);
  for (let i = 0; i < rings; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * (1 - i * 0.08), tube, 5, 10), matCopper);
    ring.position.z = i * tube * 1.6;
    ring.rotation.set(jitter(rand, 0.25), jitter(rand, 0.25), jitter(rand, 0.4));
    g.add(ring);
  }
  return noColl(g);
}

/** A bank of N cylindrical fuses with brass end-caps. */
export function makeFuseBank(u: number, n: number, rand: Rng): THREE.Object3D {
  const g = new THREE.Group();
  const fr = u * 0.030;
  const fl = u * 0.16;
  const gap = fr * 2.5;
  for (let i = 0; i < n; i++) {
    const f = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(fr, fr, fl, 8), matCeramic);
    body.rotation.z = Math.PI / 2;
    f.add(body);
    for (const s of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(fr * 1.15, fr * 1.15, fl * 0.16, 8), matBrass);
      cap.rotation.z = Math.PI / 2;
      cap.position.x = s * fl * 0.5;
      f.add(cap);
    }
    f.position.set((i - (n - 1) / 2) * gap, jitter(rand, fr * 0.3), 0);
    f.rotation.z = jitter(rand, 0.06);
    g.add(f);
  }
  return noColl(g);
}

/** A circuit board: a thin PCB plate scattered with chips + capacitors. */
export function makeCircuitBoard(w: number, h: number, rand: Rng): THREE.Object3D {
  const g = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.04), matPCB);
  g.add(board);
  const chips = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < chips; i++) {
    const cw = w * (0.12 + rand() * 0.12);
    const chip = new THREE.Mesh(new THREE.BoxGeometry(cw, cw * 0.7, w * 0.05), matChip);
    chip.position.set(jitter(rand, w * 0.32), jitter(rand, h * 0.32), w * 0.04);
    chip.rotation.z = rand() < 0.5 ? 0 : Math.PI / 2;
    g.add(chip);
  }
  const caps = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < caps; i++) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.04, w * 0.04, w * 0.1, 7), i % 2 ? matBrass : matDark);
    cap.position.set(jitter(rand, w * 0.34), jitter(rand, h * 0.3), w * 0.06);
    g.add(cap);
  }
  return noColl(g);
}

/** A pressure gauge: case + pale dial + red needle behind dark glass. */
export function makePressureGauge(r: number, rand: Rng): THREE.Object3D {
  const g = new THREE.Group();
  const depth = r * 0.5;
  const caseM = new THREE.Mesh(new THREE.CylinderGeometry(r, r, depth, 14), matSteel);
  caseM.rotation.x = Math.PI / 2;
  g.add(caseM);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r * 0.82, depth * 0.1, 14), matDial);
  dial.rotation.x = Math.PI / 2;
  dial.position.z = depth * 0.45;
  g.add(dial);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(r * 0.06, r * 0.72, depth * 0.08), matNeedle);
  needle.position.z = depth * 0.52;
  needle.rotation.z = jitter(rand, 1.6);
  needle.geometry.translate(0, r * 0.3, 0);   // pivot at the dial centre
  g.add(needle);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.86, depth * 0.04, 14), matGlass);
  glass.rotation.x = Math.PI / 2;
  glass.position.z = depth * 0.56;   // opaque dark face (no shared-material mutation)
  g.add(glass);
  return noColl(g);
}

/** A manual valve handwheel — torus rim + spokes + shaft. */
export function makeValveWheel(r: number, rand: Rng): THREE.Object3D {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.14, 6, 14), matValveRed);
  g.add(rim);
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(r * 0.1, r * 1.9, r * 0.1), matValveRed);
    spoke.rotation.z = (i / 4) * Math.PI;
    g.add(spoke);
  }
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.18, r * 0.7, 8), matSteel);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = -r * 0.3;
  g.add(shaft);
  g.rotation.z = jitter(rand, 0.5);
  return noColl(g);
}

/** A bent conduit pipe (elbow) joined to a small manifold block. */
export function makeConduitElbow(u: number, rand: Rng): THREE.Object3D {
  const g = new THREE.Group();
  const pr = u * 0.05;
  const len = u * 0.30;
  const a = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, len, 9), matPipe);
  a.position.y = len * 0.5;
  g.add(a);
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(pr * 1.2, 8, 6), matPipe);
  elbow.position.y = len;
  g.add(elbow);
  const b = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, len * 0.8, 9), matPipe);
  b.position.set(len * 0.4, len, 0);
  b.rotation.z = Math.PI / 2;
  g.add(b);
  const manifold = new THREE.Mesh(new THREE.BoxGeometry(u * 0.14, u * 0.14, u * 0.12), matSteel);
  manifold.position.y = -len * 0.1;
  g.add(manifold);
  g.rotation.z = jitter(rand, 0.3);
  return noColl(g);
}

/** A terminal / bus-bar block: a base with a row of brass posts. */
export function makeTerminalBlock(w: number, rand: Rng): THREE.Object3D {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, w * 0.26, w * 0.18), matDark);
  g.add(base);
  const posts = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < posts; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.03, w * 0.03, w * 0.14, 6), matBrass);
    post.position.set((i - (posts - 1) / 2) * (w * 0.85 / posts), 0, w * 0.12);
    g.add(post);
  }
  return noColl(g);
}

/** A clump of frayed/dangling wires splaying from a root. */
export function makeFrayedWires(u: number, n: number, rand: Rng): THREE.Object3D {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const len = u * (0.12 + rand() * 0.12);
    const m = [matWireRed, matWireYel, matCopper][Math.floor(rand() * 3)];
    const w = new THREE.Mesh(new THREE.CylinderGeometry(u * 0.012, u * 0.006, len, 5), m);
    w.geometry.translate(0, -len * 0.5, 0);   // hang from the top
    w.rotation.set(jitter(rand, 0.5), jitter(rand, 0.5), jitter(rand, 0.6));
    g.add(w);
  }
  return noColl(g);
}

/** A cracked display screen — dark glass in a bezel, faint emissive. */
export function makeCrackedScreen(w: number, h: number, rand: Rng): THREE.Object3D {
  const g = new THREE.Group();
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(w * 1.12, h * 1.12, w * 0.06), matDark);
  g.add(bezel);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.04), matScreen);
  screen.position.z = w * 0.04;
  g.add(screen);
  // a couple of crack lines (thin dark bars across the glass)
  for (let i = 0; i < 2; i++) {
    const crack = new THREE.Mesh(new THREE.BoxGeometry(w * (0.5 + rand() * 0.5), w * 0.01, w * 0.01), matDark);
    crack.position.set(jitter(rand, w * 0.2), jitter(rand, h * 0.3), w * 0.07);
    crack.rotation.z = jitter(rand, 1.2);
    g.add(crack);
  }
  return noColl(g);
}

/** A small glowing indicator dot (emissive, not a light). */
export function makeIndicatorLight(u: number, rand: Rng): THREE.Object3D {
  const m = [matIndGreen, matIndAmber, matIndRed][Math.floor(rand() * 3)];
  const dot = new THREE.Mesh(new THREE.SphereGeometry(u * 0.022, 7, 6), m);
  return noColl(dot);
}

// ── Per-archetype greeble recipe ─────────────────────────────────────
// Composes the library into a depth-layered Group sized to the cavity. `u` is the
// cavity half-width-ish unit; pieces sit in front of the backplate (z 0.15..0.5 of
// the cavity depth) so they read with shadow gradients under the studio key.

interface Dims { hw: number; hh: number; depth: number; isCircle: boolean; }

/** Build the decorative greeble Group for an archetype (NOT lootable; merged). */
export function buildGreeble(archetype: PanelArchetype, d: Dims, rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const u = d.hw * 2;                       // ≈ cavity width
  // Cavity-local Z (0 = body centre). With the V2 backplate pushed to ~-0.34*depth
  // and the closed-door back at ~+0.45*depth, spread the greeble across the now-deep
  // cavity for REAL depth layering: a back band near the plate, a front band toward
  // the mouth. (The shallow old bands sat ON the mid-cavity backplate → flat read.)
  const zBack = -d.depth * 0.22, zMid = d.depth * 0.04, zFront = d.depth * 0.30;
  // Place helper: drop a piece at (fx,fy) of the cavity at depth z, with jitter rot.
  const place = (o: THREE.Object3D, fx: number, fy: number, z: number, rot = 0.18) => {
    o.position.set(fx * d.hw, fy * d.hh, z);
    o.rotation.z += jitter(rand, rot);
    g.add(o);
  };
  switch (archetype) {
    case 'electrical':
      place(makeFuseBank(u, 4, rand), -0.18, 0.55, zMid, 0.05);
      place(makeTerminalBlock(u * 0.6, rand), 0.0, 0.05, zBack, 0.05);
      place(makeCoiledWire(u, rand), 0.5, -0.4, zFront);
      place(makeFrayedWires(u, 4, rand), -0.55, 0.35, zFront, 0.0);
      place(makeIndicatorLight(u, rand), 0.55, 0.55, zFront, 0);
      break;
    case 'plumbing':
      place(makeConduitElbow(u, rand), -0.45, -0.5, zMid);
      place(makeValveWheel(d.hw * 0.5, rand), 0.18, 0.1, zFront, 0.0);
      place(makePressureGauge(d.hw * 0.34, rand), -0.45, 0.5, zMid, 0.0);
      place(makePressureGauge(d.hw * 0.28, rand), 0.55, 0.55, zMid, 0.0);
      place(makeFrayedWires(u, 2, rand), 0.5, -0.5, zFront, 0.0);
      break;
    case 'avionics':
      place(makeCrackedScreen(d.hw * 0.9, d.hh * 0.55, rand), 0.0, 0.4, zMid, 0.0);
      place(makeCircuitBoard(d.hw * 0.8, d.hh * 0.5, rand), -0.35, -0.4, zBack, 0.06);
      place(makeCircuitBoard(d.hw * 0.5, d.hh * 0.4, rand), 0.5, -0.45, zBack, 0.1);
      place(makeIndicatorLight(u, rand), -0.55, 0.55, zFront, 0);
      place(makeIndicatorLight(u, rand), 0.55, 0.55, zFront, 0);
      break;
    case 'mechanical':
      place(makeValveWheel(d.hw * 0.55, rand), -0.3, 0.3, zFront, 0.0);
      place(makeConduitElbow(u, rand), 0.45, -0.35, zMid);
      place(makePressureGauge(d.hw * 0.34, rand), 0.35, 0.55, zMid, 0.0);
      place(makeTerminalBlock(u * 0.5, rand), -0.4, -0.5, zBack, 0.05);
      place(makeCoiledWire(u, rand), 0.55, 0.15, zFront);
      break;
    case 'junction':
      place(makeFuseBank(u, 3, rand), 0.0, 0.5, zMid, 0.05);
      place(makeCoiledWire(u, rand), -0.4, -0.3, zFront);
      place(makeTerminalBlock(u * 0.5, rand), 0.35, -0.35, zBack, 0.06);
      place(makeFrayedWires(u, 3, rand), 0.4, 0.45, zFront, 0.0);
      place(makeIndicatorLight(u, rand), -0.5, 0.5, zFront, 0);
      break;
  }
  return noColl(g) as THREE.Group;
}
