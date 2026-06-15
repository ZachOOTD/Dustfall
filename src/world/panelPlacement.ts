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
