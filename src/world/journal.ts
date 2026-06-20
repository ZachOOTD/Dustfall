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
import { createFabricMaterial } from './fabricMaterial.ts';   // M6 ③ (C39) — leather-grain cover/spine (was flat Lambert)
import { createMetalMaterial } from './metalMaterial.ts';     // M6 ③ (C39) — salvaged-metal black-box body

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
  | 'engine_block'
  | 'crash_log';   // ACBE (D1) — a crashed ship's recovered black-box; PROCEDURAL per-instance text

/** A rendered lore document (journalPanel.ts). Flagship `kind`s map to a fixed one, but a
 *  per-instance `content` on the Journal (e.g. a procedural crash black-box) overrides it. */
export type JournalEntry = readonly [string, string];
export interface JournalContent {
  title: string;
  subtitle: string;
  entries: ReadonlyArray<JournalEntry>;
}

export interface Journal {
  id: number;
  mesh: THREE.Group;
  pos: THREE.Vector3;
  /** Session ABF — picks the entries array in journalPanel.ts. */
  kind: JournalKind;
  /** ACBE (D1) — optional per-instance content; overrides the fixed per-kind entries. */
  content?: JournalContent;
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
  // M6 ③ (C39) — leather grain on the cover + spine (read at reading distance);
  // the fabric factory's wear/weave reads as aged bound leather. Pages stay flat (printed-page intent).
  const coverMat = createFabricMaterial(0x3a2818);
  const spineMat = createFabricMaterial(0x1f140a);
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

// ACBE (D1) — a recovered flight RECORDER ("black box"): a small dark armoured box with
// the hazard-orange band + a dim status light. Reads as salvaged ship tech, not a survivor's
// leather diary — the right object to carry a crashed ship's final log.
function makeBlackBox(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = createMetalMaterial(0x1a1410, { wornScale: 6.0, rustLevel: 0.15, scratchStrength: 0.05 });   // M6 ③ (C39) — salvaged ship tech reads as scratched dark metal
  const stripeMat = new THREE.MeshLambertMaterial({ color: 0xc2521a, flatShading: true });   // hazard orange
  const screenMat = new THREE.MeshLambertMaterial({ color: 0x0a1014, emissive: 0x163e48, emissiveIntensity: 0.6, flatShading: true });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.11, 0.14), bodyMat);
  body.position.y = 0.055; g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.032, 0.145), stripeMat);
  stripe.position.y = 0.058; g.add(stripe);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.012), screenMat);
  screen.position.set(0.03, 0.075, 0.072); g.add(screen);
  // a stubby antenna nub
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.09, 6), bodyMat);
  ant.position.set(-0.07, 0.13, -0.04); g.add(ant);
  return g;
}

export function placeJournal(
  scene: THREE.Scene,
  pos: THREE.Vector3,
  yaw = 0,
  kind: JournalKind = 'opening',
  content?: JournalContent,
): Journal {
  const mesh = kind === 'crash_log' ? makeBlackBox() : makeJournal();
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
    content,
  };
}

export function findJournalById(list: Journal[], id: number | undefined): Journal | null {
  if (id === undefined) return null;
  for (const j of list) if (j.id === id) return j;
  return null;
}
