// Saguaro-style cacti scattered across the desert. Player aims + E to harvest
// → cactus_pulp item. Once harvested, the visual changes and the prompt
// disappears (the cactus is filtered out of interactable targets).

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from '../world/terrain.ts';

export interface Cactus {
  id: number;
  mesh: THREE.Group;
  pos: THREE.Vector3;
  harvested: boolean;
  hovered: boolean;
  /** Mesh shown when harvested (cap with cut showing exposed pulp). */
  _capMesh: THREE.Object3D | null;
}

let _nextId = 1;

function tag(root: THREE.Object3D, id: number): void {
  root.traverse((o) => {
    o.userData.interactType = 'harvest';
    o.userData.interactId = id;
    o.userData.interactRegistry = 'cacti';
  });
}

function untag(root: THREE.Object3D): void {
  root.traverse((o) => {
    delete o.userData.interactType;
    delete o.userData.interactId;
    delete o.userData.interactRegistry;
  });
}

function makeCactus(rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x3a5a2a });

  const trunkH = 1.5 + rand() * 1.0;
  const trunkR = 0.16 + rand() * 0.05;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkR * 0.85, trunkR, trunkH, 8),
    trunkMat,
  );
  trunk.position.y = trunkH / 2;
  g.add(trunk);

  // Cap (dome on top)
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(trunkR * 0.85, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    trunkMat,
  );
  cap.position.y = trunkH;
  g.add(cap);

  // 1-3 arm branches
  const armCount = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < armCount; i++) {
    const armH = 0.5 + rand() * 0.5;
    const armR = trunkR * (0.65 + rand() * 0.2);
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(armR * 0.85, armR, armH, 6),
      trunkMat,
    );
    // L-shaped arms: horizontal segment + vertical stub
    const heightUpTrunk = trunkH * (0.45 + rand() * 0.35);
    const side = (rand() < 0.5 ? -1 : 1);
    const horizontalLen = trunkR + 0.18;
    // Vertical "elbow" piece
    arm.geometry.translate(0, armH / 2, 0);
    arm.position.set(side * horizontalLen, heightUpTrunk, 0);
    g.add(arm);
  }
  return g;
}

export function spawnCacti(
  scene: THREE.Scene,
  physicsWorld: RAPIER.World,
  terrain: Terrain,
  rand: Rng,
): Cactus[] {
  const list: Cactus[] = [];
  const total = 25;
  for (let i = 0; i < total; i++) {
    const radius = 12 + rand() * 240;
    const angle = rand() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = terrain.heightAt(x, z);

    const mesh = makeCactus(rand);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rand() * Math.PI * 2;
    mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });

    // Static collider — single cylinder approximating the trunk.
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y + 1, z);
    const body = physicsWorld.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cylinder(1, 0.20);
    physicsWorld.createCollider(colliderDesc, body);

    const id = _nextId++;
    tag(mesh, id);
    scene.add(mesh);

    list.push({
      id,
      mesh,
      pos: new THREE.Vector3(x, y, z),
      harvested: false,
      hovered: false,
      _capMesh: null,
    });
  }
  return list;
}

/** Mark a cactus as harvested — change visual + remove interaction tag. */
export function harvestCactus(cactus: Cactus): void {
  if (cactus.harvested) return;
  cactus.harvested = true;
  // Remove the top dome cap (find by Y position) — simulate "cut off the top"
  // Instead, we just darken the top with a small overlay disc.
  const cutMat = new THREE.MeshLambertMaterial({ color: 0x6a8a4a, emissive: 0x10180a });
  const cut = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 8), cutMat);
  // Compute cap position: trunk top is the y of the first sphere mesh inside the group.
  const trunk = cactus.mesh.children[0] as THREE.Mesh;
  cut.position.y = trunk.position.y + (trunk.geometry as THREE.CylinderGeometry).parameters.height / 2;
  cactus.mesh.add(cut);
  cactus._capMesh = cut;
  // Untag so the interaction raycast no longer surfaces this cactus.
  untag(cactus.mesh);
}

export function findCactusById(list: Cactus[], id: number | undefined): Cactus | null {
  if (id === undefined) return null;
  for (const c of list) if (c.id === id) return c;
  return null;
}
