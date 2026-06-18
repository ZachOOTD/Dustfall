// Shared salvage-scrap model — the held item viewmodel (inventory/items.ts) and
// the world pickups scattered around wrecks (pickups.ts) both build their scrap
// from THIS function so they read as the same object (mirrors branchMesh.ts).
// The caller supplies the materials: the held item passes localSpace `vmMetal`
// variants; world pickups pass cheaper shared world-space metal.
//
// A single carried SCRAP is ONE torn, bent sheet of rusted hull plating — the
// kind you'd peel off a wrecked fuselage. Not a busy debris pile (that was the
// disliked ACAH model). The silhouette is dominated by one buckled rectangular
// plate with a rolled-up curling edge, a couple of jagged bitten-out corners,
// a fold crease running across it, and a riveted seam. Heavily rusted.
//
// ACBC — replaces the ACAH "torn plate + flap + crumpled plate + bracket +
// rivets + rebar + wire coil" chunk (user-disliked "pile") with one clear,
// readable rusted sheet.

import * as THREE from 'three';

// Sheet footprint (metres, held-item scale — matches the old ~0.11 × 0.085 plate).
const SHEET_W = 0.125;   // along local X
const SHEET_L = 0.115;   // along local Z — closer to square so it reads as a SHEET, not a fin
const SHEET_T = 0.006;   // plate thickness (thin sheet metal, but not paper)
const SEG_W = 6;         // subdivisions — enough for buckle + tears, still low-poly
const SEG_L = 5;

// Deterministic hash (no RNG — callers expect a stable, poolable geometry).
function h(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** A torn rectangular sheet: a subdivided box whose TOP/BOTTOM vertices are
 *  warped to buckle + bow the plate, with the perimeter cut into a ragged
 *  torn edge and two corners bitten out entirely. Built as a BoxGeometry so
 *  it has real (thin) thickness — sheet metal viewed edge-on must not vanish. */
function buildTornSheet(mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.BoxGeometry(SHEET_W, SHEET_T, SHEET_L, SEG_W, 1, SEG_L);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const hw = SHEET_W / 2;
  const hl = SHEET_L / 2;

  // A diagonal fold crease line: y is lifted along a ridge so the sheet bends
  // like creased card. Plus a gentle bow and a per-vertex buckle ripple.
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = (x + hw) / SHEET_W; // 0..1 across width
    const v = (z + hl) / SHEET_L; // 0..1 across length

    // 1. Overall bow — the sheet is dished/cupped (parabola in both axes).
    //    Enough to read as a bent slab, but not so deep it pinches the outline
    //    into a fin (the round-2/3 over-curl problem).
    const bow = -(Math.pow(u - 0.5, 2) + Math.pow(v - 0.5, 2)) * 0.07;

    // 2. Fold crease — a sharp ridge along a diagonal; |distance to line| gives
    //    a tent shape that kinks the metal along one line. Subtle amplitude so
    //    it reads as a crease in a flat-ish sheet, not a folded-in-half tent.
    const crease = -Math.abs(u - v - 0.05) * 0.05 + 0.018;

    // 3. Buckle ripple — low-freq sinusoidal warp for a hand-crumpled feel.
    const ripple =
      Math.sin(u * 7.0 + 1.3) * 0.009 + Math.cos(v * 6.0 - 0.7) * 0.008;

    // Apply vertical displacement to BOTH faces so the plate keeps thickness.
    const disp = bow + crease + ripple;
    pos.setY(i, y + disp);

    // 4. Curl the far +X edge UP into a rolled lip (the classic torn-sheet curl).
    //    A clear roll, but moderated so the plate keeps a rectangular read.
    if (u > 0.74) {
      const curlAmt = (u - 0.74) / 0.26; // 0..1 toward the edge
      pos.setY(i, pos.getY(i) + curlAmt * curlAmt * 0.055);
      pos.setX(i, x - curlAmt * curlAmt * 0.02); // pull edge back as it rolls
    }
  }

  // Ragged TORN perimeter — nudge edge vertices in/out along their plane so the
  // outline is jagged, not a clean rectangle. Corner vertices get pulled inward
  // hard to read as bitten-off corners.
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const onXEdge = Math.abs(Math.abs(x) - hw) < 0.001;
    const onZEdge = Math.abs(Math.abs(z) - hl) < 0.001;
    if (!onXEdge && !onZEdge) continue;

    const seed = h(i * 1.7 + 4.0);
    const jag = (seed - 0.5) * 0.024; // ±12mm ragged in/out

    if (onXEdge) pos.setX(i, x + Math.sign(x) * jag);
    if (onZEdge) pos.setZ(i, z + Math.sign(z) * jag);

    // Bite two opposite corners clean off (pull both edge coords inward a lot).
    const corner = onXEdge && onZEdge;
    if (corner) {
      // -X/-Z and +X/+Z corners get the deepest bites.
      const biteA = x < 0 && z < 0;
      const biteB = x > 0 && z > 0;
      if (biteA) {
        // A deep torn bite out of one corner (the dominant tear).
        pos.setX(i, x + 0.034);
        pos.setZ(i, z + 0.03);
      } else if (biteB) {
        // A smaller nibble out of the opposite corner.
        pos.setX(i, x - 0.022);
        pos.setZ(i, z - 0.026);
      }
    }
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

export function buildScrapMesh(mat: THREE.Material, accentMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();

  // The dominant mass: the torn, buckled, curling rusted sheet. The flap + rivet
  // seam are CHILDREN of the sheet so they ride its warp + tilt as one panel.
  const sheet = buildTornSheet(mat);

  // A small folded-back flap of sheet peeled off one torn edge — a thin bent
  // tab that catches the light and reinforces the "ripped metal" read.
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.005, 0.044, 1, 1, 1), mat);
  flap.position.set(-0.052, 0.03, 0.03); // hinged at the -X torn edge of the sheet
  flap.rotation.set(-1.05, 0.22, -0.28); // peeled sharply up off the surface
  sheet.add(flap);

  // A riveted seam: a short line of low-poly rivet studs across the plate. Reads
  // as a real fabricated panel rather than raw shapeless metal. Y sits just
  // above the warped top face (top surface ≈ +0.02..0.04 after the buckle).
  const rivetMat = accentMat;
  const rivets: Array<[number, number, number]> = [
    [-0.03, 0.035, -0.03],
    [-0.006, 0.035, -0.018],
    [0.018, 0.034, -0.006],
    [0.042, 0.033, 0.006],
  ];
  for (const [x, y, z] of rivets) {
    const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.007, 0.008, 6), rivetMat);
    rivet.position.set(x, y, z);
    rivet.rotation.x = Math.PI / 2; // domed head facing up out of the sheet
    sheet.add(rivet);
  }

  // Tilt the whole panel so the broad face presents to the camera (so the 3q
  // angle shows the plate, not its edge).
  sheet.rotation.set(-0.5, 0.4, 0.08);
  g.add(sheet);

  return g;
}
