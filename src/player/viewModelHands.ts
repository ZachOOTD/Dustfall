// Session ABP Tier 4 — first-person viewmodel hand wraps.
//
// The 3P rig (playerRig.ts) was overhauled with mismatched-scavenger
// clothing layers (poncho + bandolier + pauldron + forearm wraps + face
// bandana + hood). When the player flips back to FP, the existing
// viewmodel only renders the held ITEM — bare item floating in front of
// the camera with no hand context. This module provides forearm wrap
// meshes that get added alongside the item in the viewmodel hierarchy,
// so FP feels continuous with the rig's outfit.
//
// Pattern: createForearmWraps(side) returns a THREE.Group with 2-3
// torus rings + a small palm bulge in the viewmodel-scale (~10-15cm).
// Material is fabricMaterial with disableShimmer=true per ABN D109
// sibling — viewmodel meshes are camera-relative, world-space shimmer
// would crawl as the camera moves.

import * as THREE from 'three';
import { createFabricMaterial } from '../world/fabricMaterial.ts';
import { createSkinMaterial } from '../world/skinMaterial.ts';

const WRAP_COLOR = 0x7a7a7a;       // matches rig forearm wraps
const PALM_SKIN = 0xc9a876;        // matches rig skin

// Module-level cached materials — every viewmodel hand uses the same
// material instance (cheap, identical look across all items).
let _wrapMat: THREE.MeshLambertMaterial | null = null;
let _palmMat: THREE.MeshLambertMaterial | null = null;

function getWrapMat(): THREE.MeshLambertMaterial {
  if (!_wrapMat) {
    _wrapMat = createFabricMaterial(WRAP_COLOR, undefined, { disableShimmer: true });
  }
  return _wrapMat;
}
function getPalmMat(): THREE.MeshLambertMaterial {
  if (!_palmMat) {
    _palmMat = createSkinMaterial(PALM_SKIN, {
      accentColor: 0x8a7048,
      scaleSize: 28.0,
      sheen: 0.5,
      localSpace: true,
    });
  }
  return _palmMat;
}

/** Build forearm wraps + a small palm bulge for the FP viewmodel.
 *  Sized for viewmodel scale (~10-15cm; held items are tiny since they
 *  render at camera-close distance). Side picks which forearm angle to
 *  bias (the viewmodel is offset to the right of the camera by default,
 *  so 'right' is the typical caller; 'left' is reserved for future
 *  dual-hand viewmodels). */
export function createForearmWraps(side: 'left' | 'right' = 'right'): THREE.Group {
  const g = new THREE.Group();
  const wrapMat = getWrapMat();
  const palmMat = getPalmMat();

  // Forearm stub — short cylinder behind the item, partially visible
  // around the item's edges + the cuff edge gives a "hand poking out
  // of a sleeve" silhouette.
  const forearmStub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.030, 0.026, 0.12, 8),
    palmMat,
  );
  forearmStub.rotation.z = Math.PI / 2;       // align with camera-forward (camera looks -Z; viewmodel Y is toward camera; rotate around Z to lay flat)
  forearmStub.position.set(-0.06, -0.02, -0.04);   // behind + below the item root
  g.add(forearmStub);

  // 3 fabric wrap tori along the forearm — the cuff at the wrist + 2
  // stacked back toward the elbow.
  for (let i = 0; i < 3; i++) {
    const wrap = new THREE.Mesh(
      new THREE.TorusGeometry(0.032, 0.008, 4, 12),
      wrapMat,
    );
    // Lay flat across the forearm. Same rotation as the forearm stub.
    wrap.rotation.y = Math.PI / 2;
    wrap.position.set(-0.10 - i * 0.025, -0.02, -0.04);
    g.add(wrap);
  }

  // Palm bulge — small ellipsoid where the hand would be, near the item.
  // This is the "thing the item is being gripped by" silhouette.
  const palm = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 10, 8),
    palmMat,
  );
  palm.scale.set(1.0, 0.7, 0.85);
  palm.position.set(-0.02, -0.025, -0.03);
  g.add(palm);

  // Side biasing — flip across X for left-hand variant
  if (side === 'left') {
    g.scale.x = -1;
  }
  return g;
}
