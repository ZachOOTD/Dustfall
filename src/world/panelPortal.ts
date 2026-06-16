// ACAX — salvage-panel "stencil portal" interior visibility.
//
// THE PROBLEM: a recessed salvage-panel cavity can clip INTO the wreck hull, so
// a hull fragment ends up in FRONT of the cavity and occludes the interior —
// the player pries the panel and sees solid hull, not the guts. THE FIX: render
// the interior as a stencil-confined "window into the hull" that draws THROUGH
// the hull but ONLY inside the panel mouth ("hide the wreck model, but only
// within the panel opening"). The stencil buffer is what bounds it to the
// opening so the interior can't bleed across the rest of the hull; conceptually
// it's the depth-independent-overlay idea of the D170 viewmodel pass, but
// confined by stencil instead of run as a separate cleared-depth pass.
//
// MECHANISM (single main render pass — needs renderer { stencil: true }):
//   1. Hull + panel body + closed door render normally (opaque, renderOrder 0).
//   2. A MASK mesh at the opening plane writes stencil = REF over the opening
//      footprint. colorWrite/depthWrite OFF + depthTest OFF (so it writes its
//      window even when the hull clips in FRONT of the recessed mouth), and
//      FrontSide (a panel whose mouth faces away from the camera punches no
//      window — no bleed-through from the far side). Visible only while open.
//   3. The interior materials draw with stencilFunc EQUAL (confined to the
//      window) + depthTest OFF (over the hull-in-front). They are transparent so
//      they sort back-to-front for correct near-over-far layering; renderOrder
//      bands (backplate < greeble < extractables) order the depth layers.
//
// ONE shared stencil ref across ALL panels: two panel interiors never overlap
// the same screen window in practice, and a panel's interior geometry only ever
// lands in its own opening, so a single ref is safe AND keeps the interior
// materials shared singletons (bounded program count).

import * as THREE from 'three';
import { Tuning } from '../config/tuning.ts';

const REF = Tuning.SALVAGE_PANEL_STENCIL_REF;

// Shared mask material — writes stencil = REF, no colour/depth, ignores depth so
// a clipped (recessed) opening still punches its window. FrontSide so a panel
// whose mouth faces away from the camera writes nothing (no far-side bleed).
const _maskMat = new THREE.MeshBasicMaterial();
_maskMat.colorWrite = false;
_maskMat.depthWrite = false;
// ACAX — the mask RESPECTS depth: it writes its stencil window only where the
// opening MOUTH is genuinely visible (nothing nearer in front of it). So terrain /
// dunes / other geometry in front of a panel — and the panel's own side walls at
// oblique angles — BLOCK the window → the interior no longer bleeds through the
// world (the user-reported glitch). A small negative polygonOffset pulls the mask
// fractionally toward the camera so it still WINS against the coplanar hull surface
// it's mounted flush on (no z-fight), while genuinely-nearer terrain still occludes
// it. The INTERIOR materials stay depthTest:false so they still draw over the
// RECESSED hull behind the mouth — i.e. visible through the wreck hull, but only the
// wreck hull, never the world.
_maskMat.depthTest = true;
_maskMat.polygonOffset = true;
_maskMat.polygonOffsetFactor = -1;
_maskMat.polygonOffsetUnits = -4;
_maskMat.side = THREE.FrontSide;
_maskMat.stencilWrite = true;
_maskMat.stencilRef = REF;
_maskMat.stencilFunc = THREE.AlwaysStencilFunc;
_maskMat.stencilZPass = THREE.ReplaceStencilOp;   // depth PASS (mouth visible) → write window
_maskMat.stencilFail = THREE.KeepStencilOp;
_maskMat.stencilZFail = THREE.KeepStencilOp;       // depth FAIL (occluded by world) → no window

/** Build the per-panel stencil MASK mesh sized to the opening MOUTH (a touch
 *  inside the rim so the interior can't spill over the frame). rect/square = a
 *  plane (w×h); circle = a disc (radius). Placed at the opening plane, facing
 *  +Z (out of the cavity). Starts hidden — the closed door covers the mouth. */
export function makePanelMask(isCircle: boolean, w: number, h: number, radius: number, z: number): THREE.Mesh {
  const geo = isCircle
    ? new THREE.CircleGeometry(radius, 24)
    : new THREE.PlaneGeometry(w, h);
  const m = new THREE.Mesh(geo, _maskMat);
  m.position.set(0, 0, z);
  m.renderOrder = Tuning.SALVAGE_PANEL_MASK_RENDER_ORDER;
  m.visible = false;
  m.userData.noCollider = true;
  return m;
}

/** Turn a shared interior material into a stencil-portal material: it draws only
 *  inside the panel window, over any hull clipping in front, sorted back-to-front.
 *  Idempotent + safe to call on shared singletons at module load. */
export function applyPortalInterior(mat: THREE.Material | ReadonlyArray<THREE.Material>): void {
  const list = Array.isArray(mat) ? mat : [mat as THREE.Material];
  for (const m of list) {
    m.stencilWrite = true;
    m.stencilRef = REF;
    m.stencilFunc = THREE.EqualStencilFunc;
    m.stencilFail = THREE.KeepStencilOp;
    m.stencilZFail = THREE.KeepStencilOp;
    m.stencilZPass = THREE.KeepStencilOp;
    m.depthTest = false;
    m.depthWrite = false;
    m.transparent = true;
    m.needsUpdate = true;
  }
}
