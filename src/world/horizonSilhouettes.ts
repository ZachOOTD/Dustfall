// Horizon landmark silhouettes (M5a, C28).
//
// Hero landmarks ring the player out to ~1km, but the world's FogExp2 fades distant
// geometry toward the SKY color — so a far landmark blends INTO the sky and can't
// serve as a navigation cue ("that wreck on the skyline → camp is that way"). This
// adds a fog-RESISTANT dark silhouette billboard at each major landmark, distance-
// gated so it fades IN exactly as the real 3D model fogs OUT — leaving a dark
// landmark mass standing on the horizon you can steer by.
//
// Determinism: built from a landmark's position + bounding box (no rand draw), so
// the seeded scatter stream is untouched. The billboards are pure decorations (no
// collider / not a salvage panel), so the placement + collider audits are unaffected.

import * as THREE from 'three';
import { Tuning } from '../config/tuning.ts';

interface HorizonSilhouette {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  x: number;
  z: number;
}

const _silhouettes: HorizonSilhouette[] = [];

// C28 r2 — a STRUCTURED wreck silhouette (a broad hull mass + an off-centre tower +
// a mast spike + a bridge bump), drawn as a near-OPAQUE alpha so the part standing
// against the SKY stays dark (the r1 top-fade made the silhouette vanish exactly
// where it must read). The mesh sits with its base BELOW the dune line, so the lower
// hull is occluded by foreground terrain → it reads as rising from the horizon. The
// material color tints this; this is the alpha mask only. (The per-model impostor —
// the EXACT landmark outline — is the queued polish; this generic profile reads as a
// deliberate built structure, not a blob.)
let _tex: THREE.CanvasTexture | null = null;
function silhouetteTexture(): THREE.CanvasTexture {
  if (_tex) return _tex;
  const W = 128, H = 128;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2d unavailable');
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#ffffff';
  // Main hull mass — a long low body, irregular deck line (base at y=H = the footing).
  g.beginPath();
  g.moveTo(8, H); g.lineTo(120, H);
  g.lineTo(112, 78); g.lineTo(92, 70); g.lineTo(74, 80); g.lineTo(58, 72);
  g.lineTo(40, 82); g.lineTo(24, 74); g.lineTo(14, 84);
  g.closePath(); g.fill();
  // Off-centre tower + a mast spike (the strongest "built structure" tell).
  g.beginPath();
  g.moveTo(44, 80); g.lineTo(62, 80); g.lineTo(60, 30); g.lineTo(48, 24); g.closePath(); g.fill();
  g.fillRect(52, 8, 5, 18);                         // mast
  // A lower bridge/engine bump on the far side.
  g.beginPath();
  g.moveTo(82, 76); g.lineTo(104, 76); g.lineTo(100, 50); g.lineTo(88, 46); g.closePath(); g.fill();
  // Feather the very edges a touch (avoid a razor cardboard rim) without hollowing it.
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return (_tex = tex);
}

/** Register a major landmark for a horizon silhouette. `box` is the landmark's
 *  world-space bounding box (used for the silhouette size + base anchor). Small
 *  landmarks (below HORIZON_SILHOUETTE_MIN_HEIGHT) are skipped — only the tall
 *  ones read as skyline cues. */
export function addHorizonSilhouette(scene: THREE.Scene, box: THREE.Box3): void {
  const size = new THREE.Vector3();
  box.getSize(size);
  const h = size.y;
  if (h < Tuning.HORIZON_SILHOUETTE_MIN_HEIGHT) return;
  const w = Math.max(size.x, size.z) * Tuning.HORIZON_SILHOUETTE_WIDTH_MULT;
  const cx = (box.min.x + box.max.x) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;
  const mat = new THREE.MeshBasicMaterial({
    map: silhouetteTexture(),
    color: Tuning.HORIZON_SILHOUETTE_COLOR,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,                    // the whole point — survives the FogExp2 that hides the real model
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  // Anchored at the landmark footing, full structured height. (C28 [partial]: a
  // cleaner ground-tuck — extend below + occlude via depthTest — + a per-model
  // impostor outline are the queued follow-ups; see backlog §A.)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h * 1.15), mat);
  mesh.position.set(cx, box.min.y + h * 0.575, cz);
  mesh.renderOrder = 1;
  scene.add(mesh);
  _silhouettes.push({ mesh, mat, x: cx, z: cz });
}

/** Find each scene group whose name is in `names` (the hand-modeled flagships) and
 *  give it a horizon silhouette. Call AFTER the POIs/flagships are placed. */
export function addHorizonSilhouettesByName(scene: THREE.Scene, names: ReadonlyArray<string>): void {
  const set = new Set(names);
  const hits: THREE.Object3D[] = [];
  scene.traverse((o) => { if (o.name && set.has(o.name)) hits.push(o); });
  for (const o of hits) addHorizonSilhouette(scene, new THREE.Box3().setFromObject(o));
}

const _camPos = new THREE.Vector3();

/** Per-frame: distance-gate each silhouette (fade IN as the real model fogs OUT)
 *  + Y-billboard it to face the camera. Cheap (a handful of landmarks). */
export function updateHorizonSilhouettes(camera: THREE.Camera): void {
  if (_silhouettes.length === 0) return;
  camera.getWorldPosition(_camPos);
  const start = Tuning.HORIZON_SILHOUETTE_FADE_START;
  const span = Math.max(1, Tuning.HORIZON_SILHOUETTE_FADE_FULL - start);
  const peak = Tuning.HORIZON_SILHOUETTE_OPACITY;
  for (const s of _silhouettes) {
    const dx = s.x - _camPos.x;
    const dz = s.z - _camPos.z;
    const dist = Math.hypot(dx, dz);
    const t = Math.max(0, Math.min(1, (dist - start) / span));
    const o = t * peak;
    s.mat.opacity = o;
    s.mesh.visible = o > 0.002;
    if (s.mesh.visible) s.mesh.rotation.y = Math.atan2(_camPos.x - s.x, _camPos.z - s.z);
  }
}

/** Clear on world rebuild (Continue / new game) so silhouettes don't accumulate. */
export function clearHorizonSilhouettes(scene: THREE.Scene): void {
  for (const s of _silhouettes) {
    scene.remove(s.mesh);
    s.mesh.geometry.dispose();
  }
  _silhouettes.length = 0;
}
