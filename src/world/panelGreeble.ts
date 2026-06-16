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
import type { PanelArchetype, PanelComponentKind } from './wrecks.ts';
import { createMetalMaterial } from './metalMaterial.ts';
import { Tuning } from '../config/tuning.ts';
import { applyPortalInterior } from './panelPortal.ts';   // ACAX — stencil-portal interior

// ── Shared singleton materials (one set for ALL panels — no per-panel alloc) ──
// ACAX Tier B — DECADES-DERELICT palette. Everything desaturated + darkened +
// shifted toward the uniform brown-orange-grey of a rusted panel that's sat in
// the desert for years (reference: corroded breaker boxes). The old palette was
// too saturated/clean ("too colourful"); these read faded + grimy. Structural
// metals route through the rust shader (createMetalMaterial) for real surface
// mottling so they don't read flat. Insulation/ceramic/board keep just enough
// hue to be legible but are dusted toward grey.
const matCopper   = new THREE.MeshLambertMaterial({ color: 0x6e4a30, flatShading: true });   // tarnished copper coil
const matWireRed  = new THREE.MeshLambertMaterial({ color: 0x643730, flatShading: true });   // faded oxblood insulation
const matWireYel  = new THREE.MeshLambertMaterial({ color: 0x806a3c, flatShading: true });   // dull dusty ochre
const matBrass    = new THREE.MeshLambertMaterial({ color: 0x7c6c44, flatShading: true });   // tarnished brass posts / bolts
const matCeramic  = new THREE.MeshLambertMaterial({ color: 0x9c8e70, flatShading: true });   // grimy ceramic fuse
const matPCB      = new THREE.MeshLambertMaterial({ color: 0x36402e, flatShading: true });   // corroded board, faded green
const matChip     = new THREE.MeshLambertMaterial({ color: 0x2a241b, flatShading: true });   // dead chip — grimy brown-black (legible vs cavity)
const matDial     = new THREE.MeshLambertMaterial({ color: 0x938869, flatShading: true });   // grimy, sun-bleached gauge face
const matGlass    = new THREE.MeshLambertMaterial({ color: 0x1c1812, flatShading: true });   // dust-caked dark glass
const matScreen   = new THREE.MeshLambertMaterial({ color: 0x242018, flatShading: true });   // dead display, no glow
const matNeedle   = new THREE.MeshLambertMaterial({ color: 0x7a3a2c, flatShading: true });   // rusted gauge needle
const matDark     = new THREE.MeshLambertMaterial({ color: 0x30281d, flatShading: true });   // grimy dark machinery / bezel
// Rusted steel for pipes/conduit/manifolds/valves/terminals — heavy rust + localSpace
// so the weathering doesn't crawl on the moving/merged wreck (D109). Higher rustLevel
// than ACAV: these are the structural pieces the eye reads as "old metal". Warm
// orange-brown rust base so the mottling reads as corrosion, not mud.
const matSteel    = createMetalMaterial(0x6e5e44, { rustLevel: 0.60, localSpace: true });
const matPipe     = createMetalMaterial(0x665740, { rustLevel: 0.42, localSpace: true });   // cool grey-brown base shows (rust patchy, no salmon)
const matRust     = createMetalMaterial(0x744e30, { rustLevel: 0.82, localSpace: true });   // heaviest — valve wheels / corroded blocks
// Indicator dots — a decades-dead panel has mostly-dead indicators. Desaturated +
// darkened so they read as corroded lenses, not powered LEDs (the in-world pry-glow
// supplies the only real "live" light). MeshBasic (self-lit, no PointLight).
const matIndGreen = new THREE.MeshBasicMaterial({ color: 0x4a5a44 });   // dead green lens
const matIndAmber = new THREE.MeshBasicMaterial({ color: 0x8a6a34 });   // dim amber lens
const matIndRed   = new THREE.MeshBasicMaterial({ color: 0x6a3a30 });   // dead red lens
// ACAX — small loose lootables reuse the greeble palette; cloth is the only kind
// the greeble didn't already have a material for (the bandage/med-pack model was
// removed per feedback, so its yellowed-gauze + red-cross materials are gone too).
const matCloth    = new THREE.MeshLambertMaterial({ color: 0x9c8862, flatShading: true });   // dust-caked linen scrap

// ACAX Tier A — every greeble material is a stencil-portal interior material so
// the merged greeble draws THROUGH a clipping hull, confined to the panel mouth,
// sorted back-to-front. Applied ONCE at module load to the shared singletons.
if (Tuning.SALVAGE_PANEL_PORTAL_ENABLED) {
  applyPortalInterior([
    matCopper, matWireRed, matWireYel, matBrass, matCeramic, matPCB, matChip,
    matDial, matGlass, matScreen, matNeedle, matDark, matSteel,
    matPipe, matRust, matIndGreen, matIndAmber, matIndRed, matCloth,
  ]);
}

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

/** ACAX Tier C — a CHUNKY breaker bank: a grid of deep 3D breaker boxes on a
 *  backing plate, each with a toggle switch flipped up/down at random. The
 *  dominant element of the rusted-electrical-panel references; its real depth +
 *  the staggered toggles break the old flat read. */
export function makeBreakerBank(w: number, h: number, rand: Rng): THREE.Object3D {
  const g = new THREE.Group();
  const cols = 2;
  const rows = 3 + Math.floor(rand() * 2);     // 3-4 rows of breakers
  const cellW = w / cols, cellH = h / rows;
  const bw = cellW * 0.84, bh = cellH * 0.78;
  const bd = w * 0.18;                          // real depth — the chunky read
  const plate = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.05), matDark);
  g.add(plate);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c - (cols - 1) / 2) * cellW;
      const y = (r - (rows - 1) / 2) * cellH;
      // Breaker BODY in rusted steel (lighter than the dark plate) so each reads
      // as a distinct raised box with a shadow gap, not a flat grid.
      const breaker = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), matSteel);
      breaker.position.set(x, y, bd * 0.5);
      g.add(breaker);
      // Toggle switch — flipped up (on) or down (off) at random, tilted so it
      // catches light. Chunky tarnished-brass lever standing proud of the body.
      const on = rand() < 0.5;
      const sw = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.34, bh * 0.42, bd * 0.7), matBrass);
      sw.position.set(x, y + (on ? bh * 0.18 : -bh * 0.18), bd + bd * 0.30);
      sw.rotation.x = on ? -0.5 : 0.5;
      g.add(sw);
      // A dark recessed slot the toggle sits in (reads as the breaker face).
      const slot = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.5, bh * 0.62, bd * 0.12), matDark);
      slot.position.set(x, y, bd + bd * 0.06);
      g.add(slot);
    }
  }
  return noColl(g);
}

/** ACAX Tier C — a loom of 3D wires DRAPING between anchors (real sag via a
 *  tube along a CatmullRom curve), replacing the old flat hanging cones. Reads
 *  as the tangled cable runs of the references. */
export function makeWireLoom(u: number, n: number, rand: Rng): THREE.Object3D {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const span = u * (0.34 + rand() * 0.30);
    const sag = u * (0.12 + rand() * 0.18);
    const start = new THREE.Vector3(-span * 0.5, jitter(rand, u * 0.05), jitter(rand, u * 0.05));
    const mid   = new THREE.Vector3(jitter(rand, u * 0.08), -sag, jitter(rand, u * 0.07));
    const end   = new THREE.Vector3(span * 0.5, jitter(rand, u * 0.05), jitter(rand, u * 0.05));
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    const m = [matWireRed, matWireYel, matCopper][Math.floor(rand() * 3)];
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, u * 0.017, 5, false), m);
    tube.rotation.z = jitter(rand, 0.3);
    g.add(tube);
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
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.14, 6, 14), matRust);
  g.add(rim);
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(r * 0.1, r * 1.9, r * 0.1), matRust);
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
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, w * 0.26, w * 0.18), matRust);
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

/** ACAX — the visual for ONE of the 5 LOOTABLE extractables, built in the same
 *  scrappy greeble style (coils, fuses, boards, rusted plates) so the lootable
 *  parts no longer read as the OLD crude flat boxes mixed into the new interior.
 *  Returns a Group sized to `u`; the caller (wrecks.ts makePanelComponent) tags
 *  it with panelComponentIndex/Kind + positions it at a cavity slot. The loot
 *  economy keys off the tag, NOT the look, so the visuals are free to elaborate. */
export function makeLootComponent(kind: PanelComponentKind, u: number, rand: Rng): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case 'red_wire':
    case 'yellow_wire': {
      // A SMALL bundle of short cut wires — a few thin bent cylinders (NOT a coil).
      const mat = kind === 'red_wire' ? matWireRed : matWireYel;
      const n = 3 + Math.floor(rand() * 2);
      for (let i = 0; i < n; i++) {
        const len = u * (0.16 + rand() * 0.10);
        const w = new THREE.Mesh(new THREE.CylinderGeometry(u * 0.018, u * 0.015, len, 5), mat);
        w.position.set(jitter(rand, u * 0.05), jitter(rand, u * 0.04), jitter(rand, u * 0.03));
        w.rotation.set(jitter(rand, 0.6), jitter(rand, 0.4), Math.PI / 2 + jitter(rand, 0.5));
        g.add(w);
      }
      break;
    }
    case 'chip': {
      // A small chip on a scrap of board.
      const board = new THREE.Mesh(new THREE.BoxGeometry(u * 0.22, u * 0.16, u * 0.03), matPCB);
      g.add(board);
      const chip = new THREE.Mesh(new THREE.BoxGeometry(u * 0.12, u * 0.09, u * 0.05), matChip);
      chip.position.z = u * 0.04; g.add(chip);
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(u * 0.015, u * 0.015, u * 0.06, 6), matBrass);
      pin.position.set(jitter(rand, u * 0.07), jitter(rand, u * 0.05), u * 0.04); g.add(pin);
      break;
    }
    case 'fuse': {
      // A single small ceramic fuse with brass caps.
      const fr = u * 0.05, fl = u * 0.26;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(fr, fr, fl, 7), matCeramic);
      body.rotation.z = Math.PI / 2; g.add(body);
      for (const s of [-1, 1]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(fr * 1.2, fr * 1.2, fl * 0.2, 7), matBrass);
        cap.rotation.z = Math.PI / 2; cap.position.x = s * fl * 0.5; g.add(cap);
      }
      break;
    }
    case 'scrap_chunk': {
      // A small twisted scrap of metal — a couple of offset rusted plates.
      for (let i = 0; i < 2; i++) {
        const plate = new THREE.Mesh(
          new THREE.BoxGeometry(u * 0.20 * (1 - i * 0.3), u * 0.14 * (1 - i * 0.2), u * 0.05),
          i ? matSteel : matRust,
        );
        plate.position.set(jitter(rand, u * 0.04), jitter(rand, u * 0.04), i * u * 0.05);
        plate.rotation.z = jitter(rand, 0.5);
        g.add(plate);
      }
      break;
    }
    case 'cloth_scrap': {
      // A small folded rag.
      for (let i = 0; i < 2; i++) {
        const fold = new THREE.Mesh(new THREE.BoxGeometry(u * 0.20, u * 0.15, u * 0.03), matCloth);
        fold.position.set(jitter(rand, u * 0.03), jitter(rand, u * 0.03), i * u * 0.035);
        fold.rotation.z = jitter(rand, 0.3);
        g.add(fold);
      }
      break;
    }
    case 'bandage_pack': {
      // ACAX — the bandage/med-pack MODEL was removed per feedback. The kind only
      // survives in the legacy fallback palettes; render it as a small scrap so it's
      // still a valid loose part (no med-pack model appears in any panel).
      const plate = new THREE.Mesh(new THREE.BoxGeometry(u * 0.18, u * 0.13, u * 0.06), matRust);
      plate.rotation.z = jitter(rand, 0.4);
      g.add(plate);
      break;
    }
  }
  return noColl(g) as THREE.Group;
}

// ── Per-archetype greeble recipe ─────────────────────────────────────
// Composes the library into a depth-layered Group sized to the cavity. `u` is the
// cavity half-width-ish unit; pieces sit in front of the backplate (z 0.15..0.5 of
// the cavity depth) so they read with shadow gradients under the studio key.

interface Dims { hw: number; hh: number; depth: number; isCircle: boolean; }

/** ACAX — one removable salvage component: the object + its loot kind (one of the
 *  7 PanelComponentKinds, so COMPONENT_LOOT is unchanged). */
export interface SalvageComp { obj: THREE.Object3D; kind: PanelComponentKind; }

/** ACAX — the ORDERED set of removable salvage components for an archetype. Small
 *  LOOSE parts come FIRST (low index → extracted first; a low-condition panel that
 *  only shows a couple reads as picked-over loose bits), then the bigger STRUCTURAL
 *  fixtures (breaker banks, fuse banks, terminals, gauges — the dense rusted-panel
 *  reference look) LAST. registerSalvageable hides everything past the condition's
 *  count, so a panel is exactly as full as it is salvageable AND thins from the front
 *  as you strip it (fully stripped → gutted). Each obj is positioned in the cavity;
 *  the caller merges + tags it. Loot keys off `kind`. */
// ── ACAX — REALISTIC DIN-rail breaker-board interior (adversarial redesign) ──
// The realism lives in a FIXED skeleton: a mounting board with a 3x4 grid of empty
// bay-sockets, DIN rails, a brass bus bar (right), a wiring trough (left), a terminal
// block (foot) + labels. 5 salvageable BREAKER modules clip onto the first 5 bays at
// the SAME slot/depth, so pulling a module (extraction only hides) simply reveals the
// fixed socket underneath — WYSIWYG with zero new logic. ZERO position/rotation jitter:
// alignment is what sells "engineered panel", decay comes from materials only.
// Shared SLOT TABLE (one source of truth so bays + modules are guaranteed co-located):
const BOARD_COLS = 4, BOARD_ROWS = 3;
const breakerSlotX = (col: number, hw: number) => (-0.50 + col * 0.34) * hw;
const breakerSlotY = (row: number, hh: number) => (0.52 - row * 0.47) * hh;
// Depth bands (fraction of cavity depth) — board deepest → toggle proud-est, ≥0.02
// apart so the depthTest-off portal sorts cleanly + the cavity light rakes shadow.
const ZB = { board: -0.30, socket: -0.27, bay: -0.26, rail: -0.22, mod: -0.06, toggle: 0.05 };
// Reading-order slots for the 5 salvageable bays: r0c0,r0c1,r0c2,r0c3,r1c0.
const MODULE_SLOTS: ReadonlyArray<readonly [number, number]> = [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0]];

/** ONE breaker module (the repeated salvageable unit). `variant`: 0 blank, 1 dead
 *  lens, 2 louvers, 3 avionics screen-face. Geometry baked at the module's own depth;
 *  the caller only sets X/Y to the slot. */
function makeBreaker(d: Dims, on: boolean, variant: number): THREE.Group {
  const g = new THREE.Group();
  const { hw, hh, depth: dp } = d;
  const body = new THREE.Mesh(new THREE.BoxGeometry(hw * 0.26, hh * 0.40, dp * 0.16), matSteel);
  body.position.z = ZB.mod * dp - dp * 0.08;   // recedes toward its socket
  g.add(body);
  if (variant === 3) {
    // avionics card face — a dim screen + a lens, no toggle.
    const screen = new THREE.Mesh(new THREE.BoxGeometry(hw * 0.17, hh * 0.26, dp * 0.03), matScreen);
    screen.position.z = ZB.mod * dp + dp * 0.02;
    g.add(screen);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(hw * 0.03, 7, 6), matIndAmber);
    lens.position.set(0, hh * 0.16, ZB.mod * dp + dp * 0.03);
    g.add(lens);
  } else {
    const face = new THREE.Mesh(new THREE.BoxGeometry(hw * 0.12, hh * 0.30, dp * 0.04), matDark);
    face.position.z = ZB.mod * dp + dp * 0.01;
    g.add(face);
    const toggle = new THREE.Mesh(new THREE.BoxGeometry(hw * 0.09, hh * 0.16, dp * 0.10), matBrass);
    toggle.position.set(0, on ? hh * 0.10 : -hh * 0.10, ZB.toggle * dp);
    toggle.rotation.x = on ? -0.5 : 0.5;
    g.add(toggle);
    if (variant === 1) {
      const lens = new THREE.Mesh(new THREE.SphereGeometry(hw * 0.025, 7, 6), matIndAmber);
      lens.position.set(hw * 0.08, hh * 0.15, ZB.mod * dp + dp * 0.03);
      g.add(lens);
    } else if (variant === 2) {
      for (let i = 0; i < 2; i++) {
        const louver = new THREE.Mesh(new THREE.BoxGeometry(hw * 0.13, hh * 0.025, dp * 0.02), matDark);
        louver.position.set(0, hh * (0.04 - i * 0.09), ZB.mod * dp + dp * 0.03);
        g.add(louver);
      }
    }
  }
  return noColl(g) as THREE.Group;
}

/** The FIXED breaker-board skeleton — always present, NOT salvageable, merged by the
 *  caller. Board + bus + trough + 3 DIN rails + terminal + labels + 12 empty bay-
 *  sockets + channelled wiring. The bays at slots 0..4 sit UNDER the 5 modules. */
export function makeBreakerBoard(d: Dims, _archetype: PanelArchetype, rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const { hw, hh, depth: dp } = d;
  const u = hw * 2;
  // 1. mounting board (deepest)
  const board = new THREE.Mesh(new THREE.BoxGeometry(2 * hw * 0.98, 2 * hh * 0.98, dp * 0.16), matDark);
  board.position.z = ZB.board * dp;
  g.add(board);
  // 2. brass BUS BAR (right) + per-row tap bolts
  const bus = new THREE.Mesh(new THREE.BoxGeometry(hw * 0.10, 2 * hh * 0.86, dp * 0.07), matBrass);
  bus.position.set(0.66 * hw, 0, ZB.rail * dp);
  g.add(bus);
  for (let row = 0; row < BOARD_ROWS; row++) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(hw * 0.03, hw * 0.03, dp * 0.05, 6), matBrass);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(0.60 * hw, breakerSlotY(row, hh), ZB.rail * dp + dp * 0.03);
    g.add(bolt);
  }
  // 3. wiring TROUGH (left) + 2 clamps
  const trough = new THREE.Mesh(new THREE.BoxGeometry(hw * 0.14, 2 * hh * 0.86, dp * 0.10), matDark);
  trough.position.set(-0.60 * hw, 0, ZB.board * dp);
  g.add(trough);
  for (const cy of [0.45, -0.45]) {
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(hw * 0.18, hh * 0.04, dp * 0.05), matBrass);
    clamp.position.set(-0.60 * hw, cy * hh, ZB.rail * dp);
    g.add(clamp);
  }
  // 4. three DIN rails (the visual grid lines)
  for (let row = 0; row < BOARD_ROWS; row++) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.26 * hw, hh * 0.10, dp * 0.05), matSteel);
    rail.position.set(0.02 * hw, breakerSlotY(row, hh), ZB.rail * dp);
    g.add(rail);
  }
  // 5. terminal block (load exit, foot)
  const term = makeTerminalBlock(u * 0.7, rand);
  term.position.set(0, -0.78 * hh, ZB.rail * dp);
  g.add(term);
  // 6. labels — ID plate + per-row circuit strips (geometry only, no text)
  const idPlate = new THREE.Mesh(new THREE.BoxGeometry(hw * 0.22, hh * 0.06, dp * 0.03), matBrass);
  idPlate.position.set(-0.46 * hw, 0.84 * hh, ZB.rail * dp);
  g.add(idPlate);
  // 7. empty-bay art at ALL 12 slots — recess + socket + contact stubs + screws
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const sx = breakerSlotX(col, hw), sy = breakerSlotY(row, hh);
      const recess = new THREE.Mesh(new THREE.BoxGeometry(hw * 0.28, hh * 0.44, dp * 0.06), matDark);
      recess.position.set(sx, sy, ZB.bay * dp);
      g.add(recess);
      const socket = new THREE.Mesh(new THREE.BoxGeometry(hw * 0.14, hh * 0.12, dp * 0.04), matChip);
      socket.position.set(sx, sy, ZB.socket * dp);
      g.add(socket);
      for (const s of [-1, 1]) {
        const stub = new THREE.Mesh(new THREE.CylinderGeometry(hw * 0.02, hw * 0.02, dp * 0.04, 6), matBrass);
        stub.rotation.x = Math.PI / 2;
        stub.position.set(sx + s * 0.06 * hw, sy, ZB.socket * dp + dp * 0.02);
        g.add(stub);
      }
      for (const [ddx, ddy] of [[-0.10, 0.16], [0.10, -0.16]] as const) {
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(hw * 0.018, hw * 0.018, dp * 0.04, 6), matBrass);
        screw.rotation.x = Math.PI / 2;
        screw.position.set(sx + ddx * hw, sy + ddy * hh, ZB.bay * dp);
        g.add(screw);
      }
    }
  }
  // 8. channelled wiring — per-row copper feed (bus→row) + a stub (row→trough)
  for (let row = 0; row < BOARD_ROWS; row++) {
    const sy = breakerSlotY(row, hh);
    const feed = new THREE.Mesh(new THREE.CylinderGeometry(hw * 0.014, hw * 0.014, hw * 0.5, 5), matCopper);
    feed.rotation.z = Math.PI / 2;
    feed.position.set(0.40 * hw, sy - 0.12 * hh, ZB.rail * dp - dp * 0.005);
    g.add(feed);
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(hw * 0.013, hw * 0.013, hw * 0.34, 5), row % 2 ? matWireYel : matWireRed);
    stub.rotation.z = Math.PI / 2;
    stub.position.set(-0.42 * hw, sy - 0.14 * hh, ZB.rail * dp - dp * 0.005);
    g.add(stub);
  }
  // trough vertical bundle (straight, channelled — NOT draped)
  for (let i = 0; i < 3; i++) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(hw * 0.013, hw * 0.013, hh * 1.5, 5), i % 2 ? matWireYel : matWireRed);
    w.position.set(-0.60 * hw + (i - 1) * hw * 0.03, -0.05 * hh, ZB.board * dp + dp * 0.035);
    g.add(w);
  }
  // 1 short frayed stub at a bottom-row empty bay (the only loose wire)
  const fray = makeFrayedWires(u, 2, rand);
  fray.position.set(breakerSlotX(3, hw), breakerSlotY(2, hh), ZB.mod * dp);
  g.add(fray);
  return noColl(g) as THREE.Group;
}

/** ACAX — the 5 salvageable BREAKER modules, at reading-order slots 0..4. NO jitter
 *  (alignment is the point). Each sits at the same slot+depth as its fixed bay, so
 *  hiding it on salvage reveals the socket underneath. Loot keys off `kind`. */
export function buildSalvageComponents(archetype: PanelArchetype, d: Dims, rand: Rng): SalvageComp[] {
  const { hw, hh, depth: dp } = d;
  const kinds: PanelComponentKind[] = ['red_wire', 'chip', 'fuse', 'yellow_wire', 'scrap_chunk'];
  // plumbing/mechanical: slot 3 holds a gauge/valve accent module instead of a breaker.
  const accentSlot = (archetype === 'plumbing' || archetype === 'mechanical') ? 3 : -1;
  const out: SalvageComp[] = [];
  for (let i = 0; i < 5; i++) {
    const [row, col] = MODULE_SLOTS[i];
    const sx = breakerSlotX(col, hw), sy = breakerSlotY(row, hh);
    let obj: THREE.Object3D;
    if (i === accentSlot) {
      obj = archetype === 'plumbing' ? makeValveWheel(hw * 0.18, rand) : makePressureGauge(hw * 0.16, rand);
      obj.position.set(sx, sy, ZB.mod * dp);
    } else {
      const variant = archetype === 'avionics' ? 3 : (i % 3);
      obj = makeBreaker(d, i % 2 === 0, variant);
      obj.position.set(sx, sy, 0);   // makeBreaker bakes its own Z
    }
    out.push({ obj, kind: kinds[i] });
  }
  return out;
}

/** Build the decorative greeble Group for an archetype (NOT lootable; merged). */
export function buildGreeble(archetype: PanelArchetype, d: Dims, rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const u = d.hw * 2;                       // ≈ cavity width
  // Cavity-local Z (0 = body centre). With the V2 backplate pushed to ~-0.34*depth
  // and the closed-door back at ~+0.45*depth, spread the greeble across the now-deep
  // cavity for REAL depth layering: a back band near the plate, a front band toward
  // the mouth. (The shallow old bands sat ON the mid-cavity backplate → flat read.)
  // ACAX Tier C — push the bands wider apart for STRONG front-to-back layering:
  // chunky machinery sits deep (zBack, near the backplate at ~-0.34*depth), mid
  // gear at zMid, and wires/coils/looms DRAPE toward the mouth (zFront) so the
  // front layer overlaps the back machinery → real depth shadows from the cavity
  // light. (The old shallow bands sat almost on the backplate → flat read.)
  const zBack = -d.depth * 0.26, zMid = d.depth * 0.02, zFront = d.depth * 0.36;
  // Place helper: drop a piece at (fx,fy) of the cavity at depth z, with jitter rot.
  const place = (o: THREE.Object3D, fx: number, fy: number, z: number, rot = 0.18) => {
    o.position.set(fx * d.hw, fy * d.hh, z);
    o.rotation.z += jitter(rand, rot);
    g.add(o);
  };
  switch (archetype) {
    case 'electrical':
      // Hero: a chunky breaker bank deep at back-left; fuses + terminal + wire loom
      // + coil layer in front of it toward the mouth.
      place(makeBreakerBank(u * 0.52, d.hh * 1.5, rand), -0.34, 0.0, zBack, 0.0);
      place(makeFuseBank(u, 4, rand), 0.42, 0.6, zMid, 0.05);
      place(makeTerminalBlock(u * 0.5, rand), 0.42, -0.02, zMid, 0.05);
      place(makeWireLoom(u, 3, rand), -0.1, 0.2, zFront, 0.0);
      place(makeCoiledWire(u, rand), 0.5, -0.5, zFront);
      place(makeFrayedWires(u, 3, rand), -0.55, -0.5, zFront, 0.0);
      place(makeIndicatorLight(u, rand), 0.6, 0.6, zFront, 0);
      break;
    case 'plumbing':
      place(makeConduitElbow(u, rand), -0.45, -0.5, zMid);
      place(makeValveWheel(d.hw * 0.52, rand), 0.1, 0.05, zMid, 0.0);
      place(makePressureGauge(d.hw * 0.34, rand), -0.5, 0.5, zMid, 0.0);
      place(makePressureGauge(d.hw * 0.28, rand), 0.55, 0.55, zMid, 0.0);
      place(makeTerminalBlock(u * 0.5, rand), 0.4, -0.5, zBack, 0.05);
      place(makeWireLoom(u, 3, rand), 0.0, -0.15, zFront, 0.0);
      place(makeFrayedWires(u, 2, rand), 0.55, -0.15, zFront, 0.0);
      break;
    case 'avionics':
      place(makeCrackedScreen(d.hw * 0.86, d.hh * 0.5, rand), -0.05, 0.45, zMid, 0.0);
      place(makeBreakerBank(u * 0.4, d.hh * 0.7, rand), 0.45, 0.5, zBack, 0.0);
      place(makeCircuitBoard(d.hw * 0.8, d.hh * 0.5, rand), -0.4, -0.42, zBack, 0.06);
      place(makeCircuitBoard(d.hw * 0.5, d.hh * 0.4, rand), 0.5, -0.45, zBack, 0.1);
      place(makeWireLoom(u, 3, rand), 0.0, -0.05, zFront, 0.0);
      place(makeIndicatorLight(u, rand), -0.55, 0.55, zFront, 0);
      place(makeIndicatorLight(u, rand), 0.6, -0.05, zFront, 0);
      break;
    case 'mechanical':
      place(makeValveWheel(d.hw * 0.56, rand), -0.3, 0.32, zMid, 0.0);
      place(makeConduitElbow(u, rand), 0.45, -0.35, zMid);
      place(makePressureGauge(d.hw * 0.34, rand), 0.38, 0.55, zMid, 0.0);
      place(makeTerminalBlock(u * 0.5, rand), -0.4, -0.52, zBack, 0.05);
      place(makeCoiledWire(u, rand), 0.55, 0.1, zFront);
      place(makeWireLoom(u, 2, rand), -0.1, -0.2, zFront, 0.0);
      place(makeFrayedWires(u, 3, rand), -0.55, 0.5, zFront, 0.0);
      break;
    case 'junction':
      // The "everything" box — the densest archetype.
      place(makeBreakerBank(u * 0.46, d.hh * 1.1, rand), 0.36, 0.1, zBack, 0.0);
      place(makeFuseBank(u, 3, rand), -0.4, 0.6, zMid, 0.05);
      place(makeTerminalBlock(u * 0.5, rand), -0.4, -0.3, zMid, 0.06);
      place(makeCoiledWire(u, rand), -0.45, 0.2, zFront);
      place(makeWireLoom(u, 3, rand), 0.05, -0.25, zFront, 0.0);
      place(makeFrayedWires(u, 3, rand), 0.5, -0.55, zFront, 0.0);
      place(makeIndicatorLight(u, rand), -0.55, -0.55, zFront, 0);
      break;
  }
  return noColl(g) as THREE.Group;
}
