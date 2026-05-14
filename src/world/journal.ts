// Journal interactable (Session W). A small leather-bound book primitive
// that lies on the floor at the skeleton's outstretched right hand inside
// the opening wreck. Re-readable in place — tagged with
// interactType='read', interactRegistry='journals'.
//
// Only one journal exists in the world right now (placed by openingScene),
// but the registry pattern matches cacti/lizards/etc. so a future content
// pass can scatter more.

import * as THREE from 'three';

export interface Journal {
  id: number;
  mesh: THREE.Group;
  pos: THREE.Vector3;
}

let _nextId = 1;

function tag(root: THREE.Object3D, id: number): void {
  root.traverse((o) => {
    o.userData.interactType = 'read';
    o.userData.interactId = id;
    o.userData.interactRegistry = 'journals';
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

export function placeJournal(scene: THREE.Scene, pos: THREE.Vector3, yaw = 0): Journal {
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
  tag(mesh, id);
  scene.add(mesh);

  return {
    id,
    mesh,
    pos: pos.clone(),
  };
}

export function findJournalById(list: Journal[], id: number | undefined): Journal | null {
  if (id === undefined) return null;
  for (const j of list) if (j.id === id) return j;
  return null;
}
