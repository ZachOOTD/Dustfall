// Salvage-panel placement + validation (ACAV panel overhaul).
//
// One source of truth for "is this access panel correctly placed?" — replacing
// the three near-identical raycast copies that had already drifted (D210):
//   - procgenWreck.ts `pruneBuriedPanels` (per-wreck occlusion cull at gen)
//   - debugPanel.ts `panelBuryAudit`       (read-only headless audit)
//   - wreckYard.ts cluster pass            (cross-wreck occlusion after the yard merge)
//
// Tier 0 implements ONLY the occlusion check (byte-for-byte the old behavior) so
// the refactor is provably inert; later tiers add terrain-clearance, footprint
// clearance, door-swing and reachability checks to the same `validatePanels` pass.
//
// This module imports only THREE + Tuning — never salvage.ts — so it stays free of
// the salvage circular-dep (wreckYard.ts already flags it). Callers that own a
// registry pass an `onCull`-style callback per entry instead.

import * as THREE from 'three';
import type { Rng } from '../core/rng.ts';
import { Tuning } from '../config/tuning.ts';

/** A panel under validation: `body` is the access-panel mesh (the `accessPanel`,
 *  which carries `userData.panelDoor`). `kind` labels it for audit output. `cull`
 *  removes it from whatever registry it lives in + makes it inert; omitted in
 *  audit mode. */
export interface PanelEntry {
  body: THREE.Object3D;
  kind?: string;
  cull?: () => void;
}

/** Minimal terrain sampler (the game's Terrain satisfies this structurally). */
export interface TerrainLike {
  heightAt(x: number, z: number): number;
}

export interface ValidatePanelsOpts {
  /** Raycast scope for ALL panels (the wreck group, or the merged wreck-yard
   *  group for cross-wreck checks). If omitted, each panel walks UP to its
   *  scene-root individually (the audit's behavior). */
  root?: THREE.Object3D;
  /** Walk-up stop when `root` is omitted (pass `ctx.three.scene`). */
  scene?: THREE.Object3D;
  /** Read-only: accumulate failures + return the report, never call `cull`. */
  audit?: boolean;
  /** When set, also cull panels whose front-face corners dip below terrain. */
  terrain?: TerrainLike;
  /** Override the default terrain clearance margin (m). */
  terrainMargin?: number;
}

export interface PanelFail {
  idx: number;
  kind: string;
  /** Which check failed. */
  criterion: 'occlusion' | 'terrain';
  detail: string;
}

export interface PanelValidationReport {
  tested: number;
  pass: number;
  failCount: number;
  fails: PanelFail[];
}

/** True if `anc` is `node` or an ancestor of it. */
function isAncestor(anc: THREE.Object3D, node: THREE.Object3D | null): boolean {
  let n: THREE.Object3D | null = node;
  while (n) { if (n === anc) return true; n = n.parent; }
  return false;
}

// ── Shape-agnostic mount finder (ACAV Tier 2) ────────────────────────

const GOLDEN_ANGLE = 2.399963229728653;   // π(3−√5)
const _WORLD_UP = new THREE.Vector3(0, 1, 0);

/** A candidate panel mount in PART-LOCAL space. `localQuat` orients the panel so
 *  its local +Z = the real surface normal (sits flush on any hull); `faceYaw` is
 *  the yaw-only fallback for the legacy `addAccessPanel` signature. */
export interface MountCandidate {
  localPos: THREE.Vector3;
  localQuat: THREE.Quaternion;
  faceYaw: number;
  score: number;
}

/** Find the best panel mount on ANY hull shape. Casts bounding-sphere inward rays
 *  at the REAL part surface (not the ±Z bounding-box flanks the old findPanelMount
 *  assumed — those failed on cockpits/bells/boxes/future models), scores each
 *  candidate over the panel FOOTPRINT (flatness + clearance, which subsumes
 *  decoration avoidance), and returns the best-scoring mount with a FULL quaternion
 *  so the panel sits flush on angled/curved surfaces (no cardinal-yaw snap).
 *
 *  Consumes EXACTLY ONE `rand` (the Fibonacci-sphere rotation offset) so the
 *  per-panel RNG budget is fixed regardless of how many directions are tried
 *  (D208). Returns part-LOCAL coords (parts are pure-translation at assembly time,
 *  so the world basis IS the part-local basis). `null` if no acceptable mount. */
export function findSurfaceMounts(
  partMesh: THREE.Object3D,
  rand: Rng,
  prior: ReadonlyArray<{ x: number; y: number; z: number }>,
  halfX: number,
  halfY: number,
): MountCandidate | null {
  partMesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(partMesh);
  if (box.isEmpty()) return null;
  const center = box.getCenter(new THREE.Vector3());
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(0.25, sphere.radius);
  const offset = partMesh.position;        // world→part-local = subtract (pure translation)

  const dirs = Tuning.SALVAGE_PANEL_SAMPLE_DIRS;
  const rot = rand() * Math.PI * 2;        // the ONE seeded draw — fixed RNG budget
  const clearance = Tuning.SALVAGE_PANEL_FOOTPRINT_CLEARANCE;
  const flatTol = Tuning.SALVAGE_PANEL_FLATNESS_DEPTH_TOL;
  const normalAgree = Tuning.SALVAGE_PANEL_NORMAL_AGREEMENT;
  const eps = Tuning.SALVAGE_PANEL_SURFACE_EPS;
  const minSep = Tuning.SALVAGE_PANEL_MIN_SEPARATION;

  const rc = new THREE.Raycaster();
  const normalMat = new THREE.Matrix3();
  const _d = new THREE.Vector3();
  const _orig = new THREE.Vector3();
  const _nrm = new THREE.Vector3();
  const _outDir = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _pp = new THREE.Vector3();
  const _pd = new THREE.Vector3();
  const _pnrm = new THREE.Vector3();
  // Footprint probe offsets: 4 edge midpoints + 4 corners of the panel rectangle.
  const fp: ReadonlyArray<readonly [number, number]> = [
    [halfX, 0], [-halfX, 0], [0, halfY], [0, -halfY],
    [halfX, halfY], [-halfX, halfY], [halfX, -halfY], [-halfX, -halfY],
  ];

  let best: MountCandidate | null = null;
  let bestScore = -Infinity;

  for (let i = 0; i < dirs; i++) {
    // Fibonacci-sphere direction + the seeded rotation.
    const yy = 1 - (2 * i + 1) / dirs;
    const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
    const phi = i * GOLDEN_ANGLE + rot;
    _d.set(Math.cos(phi) * rr, yy, Math.sin(phi) * rr);
    _orig.copy(center).addScaledVector(_d, radius * 1.15);
    rc.far = radius * 1.4;
    rc.set(_orig, _pd.copy(_d).multiplyScalar(-1));
    const hit = rc.intersectObject(partMesh, true)[0];
    if (!hit || !hit.face || hit.object.userData?.isWreckDecoration) continue;
    _nrm.copy(hit.face.normal).applyNormalMatrix(normalMat.getNormalMatrix(hit.object.matrixWorld)).normalize();
    if (Math.abs(_nrm.y) > Tuning.SALVAGE_PANEL_MAX_NORMAL_Y) continue;   // not near-horizontal
    _outDir.copy(hit.point).sub(center); _outDir.y *= 0.3;               // de-weight vertical
    if (_outDir.lengthSq() < 1e-6) continue;
    _outDir.normalize();
    const outDot = _nrm.dot(_outDir);
    if (outDot < Tuning.SALVAGE_PANEL_OUTWARD_MIN) continue;             // faces into the hull

    // Tangent frame from the real normal (panel up ≈ world up, no random roll).
    _right.copy(_WORLD_UP).cross(_nrm);
    if (_right.lengthSq() < 1e-4) _right.set(1, 0, 0);
    _right.normalize();
    _up.copy(_nrm).cross(_right).normalize();

    // FOOTPRINT flatness + clearance: push each footprint point out by `clearance`
    // and cast back. Flat+clear ⇒ d ≈ clearance with an agreeing normal; a closer
    // hit ⇒ geometry pokes into the panel's front volume (decoration/strut/window);
    // a farther/no hit ⇒ the surface falls away (edge/gap).
    let ok = true;
    for (const [ox, oy] of fp) {
      _pp.copy(hit.point).addScaledVector(_right, ox).addScaledVector(_up, oy).addScaledVector(_nrm, clearance);
      rc.far = clearance * 2;
      rc.set(_pp, _pd.copy(_nrm).multiplyScalar(-1));
      const ph = rc.intersectObject(partMesh, true)[0];
      if (!ph || !ph.face || ph.object.userData?.isWreckDecoration || Math.abs(ph.distance - clearance) > flatTol) { ok = false; break; }
      _pnrm.copy(ph.face.normal).applyNormalMatrix(normalMat.getNormalMatrix(ph.object.matrixWorld)).normalize();
      if (_pnrm.dot(_nrm) < normalAgree) { ok = false; break; }
    }
    if (!ok) continue;

    // Part-local mount (push proud by eps to avoid z-fighting the hull skin).
    const lx = hit.point.x + _nrm.x * eps - offset.x;
    const ly = hit.point.y + _nrm.y * eps - offset.y;
    const lz = hit.point.z + _nrm.z * eps - offset.z;
    let clash = false;
    for (const p of prior) {
      if (Math.hypot(p.x - lx, p.y - ly, p.z - lz) < minSep) { clash = true; break; }
    }
    if (clash) continue;

    if (outDot > bestScore) {
      bestScore = outDot;
      const q = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(_right.clone(), _up.clone(), _nrm.clone()),
      );
      best = {
        localPos: new THREE.Vector3(lx, ly, lz),
        localQuat: q,
        faceYaw: Math.atan2(_nrm.x, _nrm.z),
        score: outDot,
      };
      // Early-exit on a clearly-good mount (very outward-facing + flat-passed) so
      // most panels don't scan all directions (boot perf). RNG budget already spent
      // (the one `rand` is before the loop), so this doesn't desync.
      if (bestScore >= Tuning.SALVAGE_PANEL_MOUNT_EARLY_ACCEPT) break;
    }
  }
  return best;
}

/** Validate a batch of salvage panels. Returns a report; in non-audit mode also
 *  calls `entry.cull()` on each failing panel.
 *
 *  OCCLUSION (the only Tier-0 check): cast a short ray inward along the panel's
 *  own outward normal from 0.8m proud; if a non-panel hull surface is reached
 *  well in front (> SLACK) of the panel's own nearest surface, the panel is
 *  buried behind hull the player can't reach. The panel's hinged DOOR subtree is
 *  excluded so a (closed-at-gen-time) proud door doesn't mask the occluder —
 *  reproducing the audit's force-open-door state. */
export function validatePanels(
  panels: PanelEntry[],
  opts: ValidatePanelsOpts = {},
): PanelValidationReport {
  const report: PanelValidationReport = { tested: 0, pass: 0, failCount: 0, fails: [] };
  if (panels.length === 0) return report;

  const scene = opts.scene;
  const far = Tuning.SALVAGE_PANEL_OCCLUSION_FAR;
  const slack = Tuning.SALVAGE_PANEL_OCCLUSION_SLACK;
  const rc = new THREE.Raycaster();
  rc.far = far;
  // Update each unique raycast root's world matrices ONCE. When an explicit root
  // is given (cull passes), update its parent chain too (matches the old
  // pruneBuriedPanels `(true,true)`); when walking up per-panel (audit), only the
  // subtree (matches the old audit `(false,true)`).
  const updatedRoots = new Set<THREE.Object3D>();
  const terrain = opts.terrain;
  const margin = opts.terrainMargin ?? Tuning.SALVAGE_PANEL_TERRAIN_MARGIN;
  const _wp = new THREE.Vector3();
  const _wq = new THREE.Quaternion();
  const _out = new THREE.Vector3();
  const _origin = new THREE.Vector3();
  const _dir = new THREE.Vector3();

  panels.forEach((entry, idx) => {
    const body = entry.body;
    let root: THREE.Object3D = opts.root ?? body;
    if (!opts.root && scene) {
      while (root.parent && root.parent !== scene) root = root.parent;
    }
    if (!updatedRoots.has(root)) {
      root.updateWorldMatrix(opts.root ? true : false, true);
      updatedRoots.add(root);
    }

    const door = body.userData.panelDoor as THREE.Object3D | undefined;
    body.getWorldPosition(_wp);
    body.getWorldQuaternion(_wq);
    _out.set(0, 0, 1).applyQuaternion(_wq).normalize();
    report.tested++;
    let fail: { criterion: 'occlusion' | 'terrain'; detail: string } | null = null;

    // CHECK 1 — OCCLUSION. Inward ray from 0.8m proud; hull well in front of the
    // panel's own nearest surface (door excluded) = buried.
    _origin.copy(_wp).addScaledVector(_out, 0.8);
    _dir.copy(_out).multiplyScalar(-1);
    rc.set(_origin, _dir);
    const hits = rc.intersectObject(root, true);
    let dPanel = Infinity;
    let dHull = Infinity;
    for (const h of hits) {
      if (door && isAncestor(door, h.object)) continue;       // skip the closed door (open-door parity)
      if (isAncestor(body, h.object)) dPanel = Math.min(dPanel, h.distance);
      else dHull = Math.min(dHull, h.distance);
    }
    if (dPanel !== Infinity && dHull < dPanel - slack) {
      fail = { criterion: 'occlusion', detail: `hull@${dHull.toFixed(2)}<panel@${dPanel.toFixed(2)}` };
    }

    // CHECK 2 — TERRAIN CLEARANCE. The panel CENTER must clear terrain by `margin`.
    // A center below the sand = the panel is substantially submerged (the
    // phase-through bug). Center (NOT the bottom corners) because a 0.7m-tall panel
    // on a near-buried hull naturally has its lower edge dip toward the sand line —
    // testing corners over-culls those normal cases. `_wp` is the current world
    // center (getWorldPosition forced an update above), so gen-cull == audit.
    if (!fail && terrain) {
      const clear = _wp.y - terrain.heightAt(_wp.x, _wp.z);
      if (clear < margin) {
        fail = { criterion: 'terrain', detail: `clear@${clear.toFixed(2)}<${margin.toFixed(2)}` };
      }
    }

    if (fail) {
      report.failCount++;
      report.fails.push({ idx, kind: entry.kind ?? '?', criterion: fail.criterion, detail: fail.detail });
      if (!opts.audit) entry.cull?.();
    } else {
      report.pass++;
    }
  });

  return report;
}
