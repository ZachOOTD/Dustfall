// Shared procedural meshes for the four Scavenger's-Economy salvage MATERIALS
// (build 2, 2026-07-18). The held-item viewmodel (inventory/items.ts) and the
// world pickups scattered around POIs (pickups.ts) both build from THESE
// functions so a dropped pipe/gear/coil/cell reads as the same object it does in
// the hotbar (mirrors branchMesh.ts / scrapMesh.ts).
//
// Each silhouette is DISTINCT at a glance (the drop-identity read): pipe = an
// open tube, machine_part = a toothed gear + coil-spring cluster, wiring = a
// looped cable coil, battery = a capped power cell. Kept CHEAP (these scatter
// widely) — a handful of primitives each. The caller supplies materials; world
// pickups pass ONE shared world-space material for both slots (the merge path
// renders a single material), the held item passes localSpace vm variants.
//
// Rule 7 (thickness): every solid part has real depth. The pipe's ends are
// GENUINELY open + thin (rule 7 permits DoubleSide there); its bore is walled by
// an inner sleeve + rounded rim tori so the open end still shows a real cross-
// section from a grazing angle rather than a paper edge.

import * as THREE from 'three';

// ── metal_pipe ── a short length of salvaged tube. Open ends (rule 7: genuinely
//    open + thin), but with a real wall: an inner sleeve + rounded rim rings give
//    the bore a cross-section, and a coupling band + two bolt studs add solid mass.
export function buildMetalPipeMesh(mat: THREE.Material, bandMat: THREE.Material = mat): THREE.Group {
  const g = new THREE.Group();
  const R = 0.036;          // outer radius
  const wall = 0.009;       // wall thickness
  const len = 0.21;         // along local Y
  // Outer + inner walls (open-ended → the bore shows through). DoubleSide so the
  // inner surface renders when the camera looks into an open end.
  const outerMat = mat.clone(); outerMat.side = THREE.DoubleSide;
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(R, R, len, 16, 1, true), outerMat);
  g.add(outer);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(R - wall, R - wall, len, 16, 1, true), outerMat);
  g.add(inner);
  // Rounded rim rings cap the annulus at each end (real thickness, not a flat lip).
  for (const s of [1, -1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R - wall * 0.5, wall * 0.5, 6, 16), mat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = s * len * 0.5;
    g.add(rim);
  }
  // A coupling band + two bolt studs ~40% along (identity + solid mass).
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.006, R + 0.006, 0.026, 16), bandMat);
  band.position.y = len * 0.12;
  g.add(band);
  for (const a of [0.5, Math.PI + 0.5]) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.014, 6), bandMat);
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(Math.cos(a) * (R + 0.008), len * 0.12, Math.sin(a) * (R + 0.008));
    // point the stud radially outward (cylinder axis is local Y after the z-rot)
    bolt.lookAt(new THREE.Vector3(Math.cos(a) * 2, len * 0.12, Math.sin(a) * 2));
    g.add(bolt);
  }
  g.rotation.z = 0.14;   // slight lean for the FP read
  return g;
}

// ── machine_part ── gears/springs/actuators pulled from a dead machine. A toothed
//    gear disc + a coil spring (stacked tori) + a hex bolt. Reads as "mechanism".
export function buildMachinePartMesh(mat: THREE.Material, accentMat: THREE.Material = mat): THREE.Group {
  const g = new THREE.Group();
  // Gear: a thick disc with radial teeth.
  const gearR = 0.05, gearH = 0.022;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(gearR, gearR, gearH, 20), mat);
  g.add(disc);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, gearH + 0.006, 12), accentMat);
  g.add(hub);
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, gearH + 0.01, 8), accentMat);
  g.add(bore);
  const teeth = 10;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.014, gearH, 0.012), mat);
    tooth.position.set(Math.cos(a) * (gearR + 0.004), 0, Math.sin(a) * (gearR + 0.004));
    tooth.rotation.y = -a;
    g.add(tooth);
  }
  // Coil spring off to one side (stacked tori climbing in Y).
  const spring = new THREE.Group();
  const coils = 5;
  for (let i = 0; i < coils; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.004, 5, 12), accentMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.03 + i * 0.016;
    spring.add(ring);
  }
  spring.position.set(0.06, 0.01, 0.02);
  spring.rotation.z = 0.4;
  g.add(spring);
  // A stubby actuator rod + hex nut crossing the gear.
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 8), mat);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(-0.02, 0.02, -0.03);
  g.add(rod);
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 6), accentMat);
  nut.rotation.z = Math.PI / 2;
  nut.position.set(-0.055, 0.02, -0.03);
  g.add(nut);
  g.rotation.set(-0.5, 0.3, 0.1);   // lay the gear face toward the camera for the FP read
  return g;
}

// ── wiring ── a coil of stripped cabling. A main looped torus + two offset loops
//    (reads as coiled cable) + a small connector plug stub.
export function buildWiringMesh(mat: THREE.Material, accentMat: THREE.Material = mat): THREE.Group {
  const g = new THREE.Group();
  const R = 0.052, tube = 0.011;
  const main = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 8, 22), mat);
  g.add(main);
  const loop2 = new THREE.Mesh(new THREE.TorusGeometry(R * 0.86, tube, 8, 20), mat);
  loop2.position.set(0.012, 0.006, 0.014);
  loop2.rotation.set(0.25, 0.15, 0);
  g.add(loop2);
  const loop3 = new THREE.Mesh(new THREE.TorusGeometry(R * 0.72, tube * 0.9, 8, 18), mat);
  loop3.position.set(-0.01, -0.004, -0.012);
  loop3.rotation.set(-0.2, -0.1, 0);
  g.add(loop3);
  // A connector plug where the cable ends (a small barrel + pins).
  const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.013, 0.026, 8), accentMat);
  plug.rotation.x = Math.PI / 2;
  plug.position.set(R * 0.9, 0.0, R * 0.35);
  g.add(plug);
  for (const dx of [-0.005, 0.005]) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.014, 6), accentMat);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(R * 0.9 + dx, 0.0, R * 0.35 + 0.018);
    g.add(pin);
  }
  g.rotation.set(-0.9, 0.2, 0.1);   // face the coil toward the camera
  return g;
}

// ── battery ── a small salvaged power cell. A capped cylinder body + a positive
//    terminal stud + a label band ring + a base rim.
export function buildBatteryMesh(mat: THREE.Material, accentMat: THREE.Material = mat): THREE.Group {
  const g = new THREE.Group();
  const R = 0.03, h = 0.12;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, h, 16), mat);
  g.add(body);
  // Positive terminal stud on top.
  const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.016, 12), accentMat);
  stud.position.y = h * 0.5 + 0.008;
  g.add(stud);
  const studCap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.005, 12), accentMat);
  studCap.position.y = h * 0.5 + 0.003;
  g.add(studCap);
  // Label band + a contact rim at the base.
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.002, R + 0.002, 0.03, 16), accentMat);
  band.position.y = 0.01;
  g.add(band);
  const baseRim = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.003, R, 0.01, 16), accentMat);
  baseRim.position.y = -h * 0.5 + 0.004;
  g.add(baseRim);
  g.rotation.set(0.1, 0, 0.35);   // tip it so it reads as a cell, not a coin, at FP
  return g;
}
