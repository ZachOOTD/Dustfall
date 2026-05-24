// Journal interactable (Session W). A small leather-bound book primitive
// that lies on the floor at the skeleton's outstretched right hand inside
// the opening wreck. Re-readable in place — tagged with
// interactType='read', interactRegistry='journals'.
//
// Session ABF — extended to support per-POI journal kinds. The W-era
// "opening" wreck journal stays the default; flagship modules pass their
// own kind so the panel can render different entries per landmark. The
// kind is encoded both on the Journal object (for ctx.journals.list
// consumers) AND on the mesh's userData.interactSubKind (so the
// interaction system surfaces it via info.subKind without a registry
// lookup, matching the salvage-panel sub-kind pattern).

import * as THREE from 'three';

/** Session ABF — discriminator for which journal entries to render in
 *  the modal panel. `'opening'` is the legacy W-era survivor journal
 *  inside the opening wreck; the rest tag the corresponding hand-modeled
 *  flagship's narrator voice. */
export type JournalKind =
  | 'opening'
  | 'mega_ship'
  | 'mega_wreck'
  | 'satellite_dish'
  | 'crashed_hull'
  | 'engine_block';

export interface Journal {
  id: number;
  mesh: THREE.Group;
  pos: THREE.Vector3;
  /** Session ABF — picks the entries array in journalPanel.ts. */
  kind: JournalKind;
}

let _nextId = 1;

function tag(root: THREE.Object3D, id: number, kind: JournalKind): void {
  root.traverse((o) => {
    o.userData.interactType = 'read';
    o.userData.interactId = id;
    o.userData.interactRegistry = 'journals';
    o.userData.interactSubKind = kind;
  });
}

function makeJournal(): THREE.Group {
  const g = new THREE.Group();
  const coverMat = new THREE.MeshLambertMaterial({
    color: 0x3a2818,
    flatShading: true,
  });
  const spineMat = new THREE.MeshLambertMaterial({
    color: 0x1f140a,
    flatShading: true,
  });
  const pageMat = new THREE.MeshLambertMaterial({
    color: 0xc8b896,
    flatShading: true,
  });

  // Body: flat box ~12cm × 3cm × 16cm — small book lying on its back.
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.03, 0.16),
    coverMat,
  );
  body.position.y = 0.015;
  g.add(body);

  // Page block — thin slab inset slightly inside the cover.
  const pages = new THREE.Mesh(
    new THREE.BoxGeometry(0.115, 0.024, 0.152),
    pageMat,
  );
  pages.position.y = 0.018;
  g.add(pages);

  // Spine — thin darker strip down one long edge.
  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(0.015, 0.034, 0.165),
    spineMat,
  );
  spine.position.set(-0.06, 0.017, 0);
  g.add(spine);

  return g;
}

export function placeJournal(
  scene: THREE.Scene,
  pos: THREE.Vector3,
  yaw = 0,
  kind: JournalKind = 'opening',
): Journal {
  const mesh = makeJournal();
  mesh.position.copy(pos);
  mesh.rotation.y = yaw;
  mesh.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  const id = _nextId++;
  tag(mesh, id, kind);
  scene.add(mesh);

  return {
    id,
    mesh,
    pos: pos.clone(),
    kind,
  };
}

export function findJournalById(list: Journal[], id: number | undefined): Journal | null {
  if (id === undefined) return null;
  for (const j of list) if (j.id === id) return j;
  return null;
}
