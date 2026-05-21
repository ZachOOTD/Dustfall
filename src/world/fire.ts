// Placeable fire entity — created when a fire_kit is used.
// Provides: visible flame mesh + warm flickering PointLight + shelter zone.
// Consumes: fuelSeconds (default 90, +30s per branch added). When fuel
// hits 0, the fire dies — flame hides, light dims, shelter zone removed.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import {
  addShelterZone,
  removeShelterZone,
  type ShelterZone,
} from '../shelter/shelterZones.ts';
import { playFireIgnite, playFireCrackle } from '../audio/audio.ts';

export interface Fire {
  id: number;
  mesh: THREE.Group;
  light: THREE.PointLight;
  flameGroup: THREE.Group;     // hide/show on death
  emberMesh: THREE.Mesh;       // glows red when dead
  shelterZone: ShelterZone | null;
  fuelSeconds: number;
  alive: boolean;
  hovered: boolean;
  pos: THREE.Vector3;
  /** Wall-clock timestamp of next random crackle sound. */
  _nextCrackleAt: number;
}

let _nextId = 1;

const FIRE_INITIAL_FUEL = 90;          // seconds
const FIRE_FUEL_PER_BRANCH = 30;
const SHELTER_RADIUS = 2.2;
const SHELTER_HEIGHT = 1.5;
const NEAR_FIRE_DISTANCE_SQ = 1.5 * 1.5; // can't deploy another fire within 1.5m

function tag(root: THREE.Object3D, id: number, type: 'cook' | 'relight'): void {
  root.traverse((o) => {
    o.userData.interactType = type;
    o.userData.interactId = id;
    o.userData.interactRegistry = 'fires';
  });
}

export function makeFireVisual(): { group: THREE.Group; flameGroup: THREE.Group; light: THREE.PointLight; ember: THREE.Mesh } {
  const g = new THREE.Group();

  // 3-4 short logs arranged in a tee-pee
  const logMat = new THREE.MeshLambertMaterial({ color: 0x4a2e1a });
  const charMat = new THREE.MeshLambertMaterial({ color: 0x1a0e08 });
  const logCount = 4;
  for (let i = 0; i < logCount; i++) {
    const ang = (i / logCount) * Math.PI * 2;
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.06, 0.42, 6),
      i % 2 === 0 ? logMat : charMat,
    );
    log.position.set(Math.cos(ang) * 0.10, 0.16, Math.sin(ang) * 0.10);
    // Tilt logs inward (tee-pee style)
    log.rotation.x = Math.cos(ang) * 0.4;
    log.rotation.z = Math.sin(ang) * 0.4;
    log.castShadow = true;
    log.receiveShadow = true;
    g.add(log);
  }

  // Glowing ember disk at the base — visible even when dead
  const emberMat = new THREE.MeshBasicMaterial({
    color: 0xb84020, transparent: true, opacity: 0.85,
  });
  const ember = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), emberMat);
  ember.rotation.x = -Math.PI / 2;
  ember.position.y = 0.02;
  g.add(ember);

  // Flame group: 3 stacked cones with emissive material
  const flameGroup = new THREE.Group();
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xffaa44, transparent: true, opacity: 0.85,
  });
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xfff0a0, transparent: true, opacity: 0.92,
  });
  for (let i = 0; i < 3; i++) {
    const y = 0.15 + i * 0.13;
    const r = 0.13 - i * 0.03;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(r, 0.24 - i * 0.05, 7),
      i === 0 ? flameMat : innerMat,
    );
    cone.position.y = y + 0.12;
    flameGroup.add(cone);
  }
  g.add(flameGroup);

  // Warm flickering PointLight
  const light = new THREE.PointLight(0xff9040, 1.3, 8, 1.6);
  light.position.set(0, 0.4, 0);
  light.castShadow = false; // perf
  g.add(light);

  return { group: g, flameGroup, light, ember };
}

/** Deploy a fire `Tuning.PLACEMENT_DISTANCE_M` in front of the player (D75 — 2.2m,
 *  was 1.5m pre-UU). Returns null if too close to an existing fire or if the player
 *  isn't ready. */
export function deployFire(ctx: GameContext): Fire | null {
  const cam = ctx.three.camera;
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  dir.y = 0;
  if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
  dir.normalize();
  const pos = new THREE.Vector3()
    .copy(cam.position)
    .addScaledVector(dir, Tuning.PLACEMENT_DISTANCE_M);
  pos.y = ctx.terrain.heightAt(pos.x, pos.z);

  // Reject if too close to an existing fire
  for (const f of ctx.fires.list) {
    if (f.alive && f.pos.distanceToSquared(pos) < NEAR_FIRE_DISTANCE_SQ) {
      return null;
    }
  }

  const fire = spawnFireAt(ctx, pos, FIRE_INITIAL_FUEL, true);
  playFireIgnite();
  return fire;
}

/** Materialise a fire at the given world position, regardless of whether the
 *  player is placing it (deployFire) or save/load is restoring it. Does NOT
 *  check proximity, consume inventory, or play audio — that's the caller's job. */
export function spawnFireAt(
  ctx: GameContext,
  pos: THREE.Vector3,
  fuelSeconds: number,
  alive: boolean,
): Fire {
  const visual = makeFireVisual();
  visual.group.position.copy(pos);
  ctx.three.scene.add(visual.group);

  const id = _nextId++;
  tag(visual.group, id, alive ? 'cook' : 'relight');

  let shelterZone: ShelterZone | null = null;
  if (alive) {
    shelterZone = addShelterZone(
      ctx.shelter,
      { x: pos.x, y: pos.y + SHELTER_HEIGHT / 2, z: pos.z },
      { x: SHELTER_RADIUS, y: SHELTER_HEIGHT, z: SHELTER_RADIUS },
    );
  } else {
    // Dead fire visual — match the burn-out path in updateFires.
    visual.flameGroup.visible = false;
    visual.light.intensity = 0.2;
    visual.light.color.set(0x5a1810);
    (visual.ember.material as THREE.MeshBasicMaterial).opacity = 0.45;
    (visual.ember.material as THREE.MeshBasicMaterial).color.set(0x4a1810);
  }

  const fire: Fire = {
    id,
    mesh: visual.group,
    flameGroup: visual.flameGroup,
    light: visual.light,
    emberMesh: visual.ember,
    shelterZone,
    fuelSeconds,
    alive,
    hovered: false,
    pos: pos.clone(),
    _nextCrackleAt: ctx.time.elapsed + 0.5 + Math.random() * 2,
  };
  ctx.fires.list.push(fire);
  return fire;
}

/** Bump the module-level id counter past `n` so future spawns don't collide
 *  with restored ids. Used by save/load. */
export function setNextFireId(n: number): void {
  if (n > _nextId) _nextId = n;
}

/** Add fuel (a branch worth = 30s). */
export function addFuel(fire: Fire, seconds: number = FIRE_FUEL_PER_BRANCH): void {
  if (!fire.alive) return;
  fire.fuelSeconds += seconds;
  playFireCrackle();
}

/** Relight a dead fire — costs a branch. Restores 30s fuel, the shelter zone,
 *  flame visuals, and re-tags the mesh as cook-interactable. */
export function relightFire(fire: Fire, ctx: GameContext): boolean {
  if (fire.alive) return false;
  fire.alive = true;
  fire.fuelSeconds = FIRE_FUEL_PER_BRANCH;
  fire.flameGroup.visible = true;
  fire.light.intensity = 1.3;
  fire.light.color.set(0xff9040);
  (fire.emberMesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
  (fire.emberMesh.material as THREE.MeshBasicMaterial).color.set(0xb84020);
  // Re-register shelter zone.
  fire.shelterZone = addShelterZone(
    ctx.shelter,
    { x: fire.pos.x, y: fire.pos.y + SHELTER_HEIGHT / 2, z: fire.pos.z },
    { x: SHELTER_RADIUS, y: SHELTER_HEIGHT, z: SHELTER_RADIUS },
  );
  // Switch tag back to cook (alive fire is cookable).
  tag(fire.mesh, fire.id, 'cook');
  fire._nextCrackleAt = ctx.time.elapsed + 0.5 + Math.random() * 2;
  playFireIgnite();
  return true;
}

export function findFireById(list: Fire[], id: number | undefined): Fire | undefined {
  if (id === undefined) return undefined;
  return list.find((f) => f.id === id);
}

export function updateFires(ctx: GameContext, dt: number): void {
  const t = ctx.time.elapsed;
  for (const fire of ctx.fires.list) {
    if (fire.alive) {
      fire.fuelSeconds -= dt;
      if (fire.fuelSeconds <= 0) {
        // Burn out
        fire.alive = false;
        fire.flameGroup.visible = false;
        fire.light.intensity = 0.2;       // a faint ember glow
        fire.light.color.set(0x5a1810);
        (fire.emberMesh.material as THREE.MeshBasicMaterial).opacity = 0.45;
        (fire.emberMesh.material as THREE.MeshBasicMaterial).color.set(0x4a1810);
        if (fire.shelterZone) {
          removeShelterZone(ctx.shelter, fire.shelterZone);
          fire.shelterZone = null;
        }
        // Re-tag for the relight interaction. Dead fires can be revived with
        // a branch — keeps placed fires meaningful long after their first fuel.
        tag(fire.mesh, fire.id, 'relight');
        continue;
      }
      // Flicker: combine two sine waves for organic motion
      const flicker = 1 + Math.sin(t * 9) * 0.18 + Math.sin(t * 23.7) * 0.07;
      fire.light.intensity = 1.3 * flicker;
      // Slight flame scale wobble
      const sc = 1 + Math.sin(t * 12) * 0.08;
      fire.flameGroup.scale.set(sc, 1 + Math.sin(t * 8.5) * 0.10, sc);
      // Random crackle sound
      if (t > fire._nextCrackleAt) {
        playFireCrackle();
        fire._nextCrackleAt = t + 1.5 + Math.random() * 3;
      }
    }
  }
}
