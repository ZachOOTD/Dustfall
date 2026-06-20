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
import { claimLight, releaseLight } from '../core/lightPool.ts';
import { createMetalMaterial } from './metalMaterial.ts';
import { createWoodGrainMaterial } from './woodGrainMaterial.ts';   // M6 ③ (C39) — logs read as real aged wood, not flat brown

/** M4 (C21) — one billowing puff in a fire's rising signal plume (pooled). */
interface SmokePuff {
  sprite: THREE.Sprite;
  age: number;
  ttl: number;
  rise: number;     // m/s upward (randomized per puff)
  active: boolean;
}

// Soft round smoke sprite (grey radial falloff). One shared texture across all fires.
let _smokeTex: THREE.CanvasTexture | null = null;
function smokeTexture(): THREE.CanvasTexture {
  if (_smokeTex) return _smokeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2d unavailable');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.38)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return (_smokeTex = tex);
}

/** Build a hidden pool of smoke sprites parented to the fire group (local space:
 *  they rise in +Y + drift in XZ off the flame top). */
function buildSmokePool(group: THREE.Group): SmokePuff[] {
  const pool: SmokePuff[] = [];
  for (let i = 0; i < Tuning.FIRE_SMOKE_POOL; i++) {
    const mat = new THREE.SpriteMaterial({
      map: smokeTexture(),
      color: Tuning.FIRE_SMOKE_COLOR,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,        // a signal beacon punches through haze; also stops the brown storm-fog from tinting the grey smoke
    });
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(Tuning.FIRE_SMOKE_SCALE_START);
    s.position.set(0, 0.55, 0);
    s.visible = false;
    s.raycast = () => {};   // decorative — never an interaction target (and avoids the sprite-raycast camera warning)
    group.add(s);
    pool.push({ sprite: s, age: 0, ttl: 0, rise: 0, active: false });
  }
  return pool;
}

export interface Fire {
  id: number;
  mesh: THREE.Group;
  /** AAY-fix — claimed from ctx.lightPool. `null` only if the pool was
   *  exhausted at spawn time (graceful fallback — fire still works,
   *  just no illumination contribution to the scene). */
  light: THREE.PointLight | null;
  flameGroup: THREE.Group;     // hide/show on death
  emberMesh: THREE.Mesh;       // glows red when dead
  shelterZone: ShelterZone | null;
  fuelSeconds: number;
  alive: boolean;
  hovered: boolean;
  pos: THREE.Vector3;
  /** Wall-clock timestamp of next random crackle sound. */
  _nextCrackleAt: number;
  /** Session AAM — true when a grill_kit has been attached. Allows
   *  multiple parallel cooks instead of the single-cook default. The
   *  grill mesh is added when hasGrill flips false→true (see
   *  attachGrillToFire). Persists in save schema v10+. */
  hasGrill: boolean;
  /** AAM — the visible grate group, lazily created when grill attaches. */
  grillMesh: THREE.Group | null;
  /** M4 (C21) — signal-plume smoke puffs (pooled, parented to mesh). Built at spawn
   *  for alive fires, lazily on relight. Transient — re-created for alive fires on
   *  load, so no save bump. */
  smoke: SmokePuff[] | null;
  /** Elapsed time of the next smoke-puff emission. */
  _nextSmokeAt: number;
}

let _nextId = 1;

// VV — local constants lifted to Tuning.FIRE_* (per CLAUDE.md "magic
// numbers → tuning.ts ONLY" rule). Values unchanged.

function tag(root: THREE.Object3D, id: number, type: 'cook' | 'relight'): void {
  root.traverse((o) => {
    o.userData.interactType = type;
    o.userData.interactId = id;
    o.userData.interactRegistry = 'fires';
  });
}

export function makeFireVisual(): { group: THREE.Group; flameGroup: THREE.Group; ember: THREE.Mesh } {
  const g = new THREE.Group();

  // 3-4 short logs arranged in a tee-pee. M6 ③ (C39) — wood-grain + bark
  // striations on the aged deadwood (world-space, static) instead of flat brown;
  // reuses the same factory as world branches/posts so no new shader program.
  const logMat = createWoodGrainMaterial(0x4a2e1a, { weatherLevel: 0.6, ringDensity: 7.0, bark: 0.2 });
  const charMat = createWoodGrainMaterial(0x1a0e08, { weatherLevel: 0.85, ringDensity: 7.0, bark: 0.22 });
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

  // AAY-fix — PointLight no longer created here. Claimed from
  // ctx.lightPool inside spawnFireAt and positioned in WORLD space (the
  // pool light is a scene-direct child, not a member of this fire group,
  // so add/remove of the group doesn't change the scene's lightsHash).

  return { group: g, flameGroup, ember };
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
    if (f.alive && f.pos.distanceToSquared(pos) < Tuning.FIRE_NEAR_DISTANCE_SQ) {
      return null;
    }
  }

  const fire = spawnFireAt(ctx, pos, Tuning.FIRE_INITIAL_FUEL_S, true);
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

  // AAY-fix — claim a pool light + configure for fire (warm color,
  // 8m range, 1.6 decay = inverse-square). Positioned in WORLD space
  // at the flame center (pos + ~0.4m up). Fires don't move, so set
  // once at spawn. If the pool is exhausted, `light` stays null —
  // visual still works, just no illumination contribution.
  const light = claimLight(ctx.lightPool);
  if (light) {
    light.color.set(0xff9040);
    light.distance = 8;
    light.decay = 1.6;
    light.intensity = alive ? 1.3 : 0.2;
    if (!alive) light.color.set(0x5a1810);
    light.position.set(pos.x, pos.y + 0.4, pos.z);
  }

  let shelterZone: ShelterZone | null = null;
  if (alive) {
    shelterZone = addShelterZone(
      ctx.shelter,
      { x: pos.x, y: pos.y + Tuning.FIRE_SHELTER_HEIGHT_M / 2, z: pos.z },
      { x: Tuning.FIRE_SHELTER_RADIUS_M, y: Tuning.FIRE_SHELTER_HEIGHT_M, z: Tuning.FIRE_SHELTER_RADIUS_M },
    );
  } else {
    // Dead fire visual — match the burn-out path in updateFires.
    visual.flameGroup.visible = false;
    (visual.ember.material as THREE.MeshBasicMaterial).opacity = 0.45;
    (visual.ember.material as THREE.MeshBasicMaterial).color.set(0x4a1810);
  }

  const fire: Fire = {
    id,
    mesh: visual.group,
    flameGroup: visual.flameGroup,
    light,
    emberMesh: visual.ember,
    shelterZone,
    fuelSeconds,
    alive,
    hovered: false,
    pos: pos.clone(),
    _nextCrackleAt: ctx.time.elapsed + 0.5 + Math.random() * 2,
    hasGrill: false,       // AAM — grill attached later via attachGrillToFire
    grillMesh: null,
    // M4 (C21) — alive fires emit a signal plume; dead fires build it on relight.
    smoke: alive ? buildSmokePool(visual.group) : null,
    _nextSmokeAt: ctx.time.elapsed,
  };
  ctx.fires.list.push(fire);
  return fire;
}

/** Bump the module-level id counter past `n` so future spawns don't collide
 *  with restored ids. Used by save/load. */
export function setNextFireId(n: number): void {
  if (n > _nextId) _nextId = n;
}

/** AAY-fix — release the fire's pool light. Called from save.ts's
 *  "clear before re-spawn" path so the pool doesn't leak slots across
 *  Continue. Safe to call even if the light is null. */
export function releaseFireLight(ctx: GameContext, fire: Fire): void {
  if (fire.light) {
    releaseLight(ctx.lightPool, fire.light);
    fire.light = null;
  }
}

/** Add fuel (a branch worth = 30s). */
export function addFuel(fire: Fire, seconds: number = Tuning.FIRE_FUEL_PER_BRANCH_S): void {
  if (!fire.alive) return;
  fire.fuelSeconds += seconds;
  playFireCrackle();
}

/** Relight a dead fire — costs a branch. Restores 30s fuel, the shelter zone,
 *  flame visuals, and re-tags the mesh as cook-interactable. */
export function relightFire(fire: Fire, ctx: GameContext): boolean {
  if (fire.alive) return false;
  fire.alive = true;
  fire.fuelSeconds = Tuning.FIRE_FUEL_PER_BRANCH_S;
  fire.flameGroup.visible = true;
  if (fire.light) {
    fire.light.intensity = 1.3;
    fire.light.color.set(0xff9040);
  }
  (fire.emberMesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
  (fire.emberMesh.material as THREE.MeshBasicMaterial).color.set(0xb84020);
  // Re-register shelter zone.
  fire.shelterZone = addShelterZone(
    ctx.shelter,
    { x: fire.pos.x, y: fire.pos.y + Tuning.FIRE_SHELTER_HEIGHT_M / 2, z: fire.pos.z },
    { x: Tuning.FIRE_SHELTER_RADIUS_M, y: Tuning.FIRE_SHELTER_HEIGHT_M, z: Tuning.FIRE_SHELTER_RADIUS_M },
  );
  // Switch tag back to cook (alive fire is cookable).
  tag(fire.mesh, fire.id, 'cook');
  fire._nextCrackleAt = ctx.time.elapsed + 0.5 + Math.random() * 2;
  // M4 (C21) — resume the signal plume (build the pool if this fire spawned dead).
  if (!fire.smoke) fire.smoke = buildSmokePool(fire.mesh);
  fire._nextSmokeAt = ctx.time.elapsed;
  playFireIgnite();
  return true;
}

export function findFireById(list: Fire[], id: number | undefined): Fire | undefined {
  if (id === undefined) return undefined;
  return list.find((f) => f.id === id);
}

/** AAM — build the visible grate that sits above the fire ring once a
 *  grill_kit has been attached. 4 horizontal iron bars + 2 side rails
 *  forming a small grate, hovering ~0.45m above the fire base so it sits
 *  over the flames without poking out of the silhouette. */
function makeGrillMesh(): THREE.Group {
  const g = new THREE.Group();
  // ABH — grill iron gets the weathered-metal procedural shader.
  // Heavy worn scale (10) — grill bars take a lot of use, lots of
  // worn-highlight spots where pots and meat sat.
  const ironMat = createMetalMaterial(0x2a241c, { wornScale: 10.0, scratchStrength: 0.05 });
  const W = Tuning.FIRE_GRILL_WIDTH_M;
  const D = Tuning.FIRE_GRILL_DEPTH_M;
  const BAR_R = Tuning.FIRE_GRILL_BAR_RADIUS_M;
  const Y = Tuning.FIRE_GRILL_HEIGHT_M;
  // 4 cross-bars spanning W (along X), spaced evenly along Z.
  for (let i = 0; i < 4; i++) {
    const z = -D / 2 + (i + 0.5) * (D / 4);
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(BAR_R, BAR_R, W, 6),
      ironMat,
    );
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, Y, z);
    bar.castShadow = true;
    g.add(bar);
  }
  // 2 side rails (along Z) at the edges of W — frame the grate.
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(BAR_R * 1.1, BAR_R * 1.1, D + BAR_R * 4, 6),
      ironMat,
    );
    rail.rotation.x = Math.PI / 2;
    rail.position.set(sx * (W / 2), Y, 0);
    rail.castShadow = true;
    g.add(rail);
  }
  return g;
}

/** AAM — attach a grill to a fire. Builds the grate mesh, parents it to
 *  the fire group so it inherits the fire's world position, and flips
 *  `hasGrill` so the cook system allows parallel cooks. No-op if already
 *  attached. Survives save/load via the hasGrill field on Fire +
 *  loadGameState's call to attachGrillToFire on flagged fires. */
export function attachGrillToFire(ctx: GameContext, fire: Fire): void {
  void ctx;
  if (fire.hasGrill) return;
  const grill = makeGrillMesh();
  fire.mesh.add(grill);
  fire.grillMesh = grill;
  fire.hasGrill = true;
}

/** M4 (C21) — spawn + advance a fire's rising signal plume. Spawns new puffs only
 *  while the fire is alive; always ticks the live puffs so a just-died fire's column
 *  drifts up + fades out instead of snapping off. Puffs rise, billow (grow), lean
 *  along the prevailing dune wind (torn flat in a storm), and fade in→out over life. */
function updateFireSmoke(ctx: GameContext, fire: Fire, dt: number, t: number): void {
  const pool = fire.smoke;
  if (!pool) return;
  // Wind: a gentle prevailing lean, plus a hard storm lean (the plume tears flat).
  const stormI = ctx.weather ? ctx.weather.intensity : 0;
  const windSpeed = Tuning.FIRE_SMOKE_DRIFT + Tuning.FIRE_SMOKE_STORM_DRIFT * stormI;
  const wx = Math.cos(Tuning.DUNE_WIND_DIR_RAD) * windSpeed;
  const wz = Math.sin(Tuning.DUNE_WIND_DIR_RAD) * windSpeed;

  if (fire.alive && t >= fire._nextSmokeAt) {
    fire._nextSmokeAt = t + Tuning.FIRE_SMOKE_SPAWN_INTERVAL_S;
    const p = pool.find((q) => !q.active);
    if (p) {
      p.active = true;
      p.age = 0;
      p.ttl = Tuning.FIRE_SMOKE_TTL_S;
      p.rise = Tuning.FIRE_SMOKE_RISE_MIN + Math.random() * (Tuning.FIRE_SMOKE_RISE_MAX - Tuning.FIRE_SMOKE_RISE_MIN);
      p.sprite.visible = true;
      p.sprite.position.set((Math.random() - 0.5) * 0.3, 0.55, (Math.random() - 0.5) * 0.3);
      p.sprite.scale.setScalar(Tuning.FIRE_SMOKE_SCALE_START);
    }
  }

  for (const p of pool) {
    if (!p.active) continue;
    p.age += dt;
    if (p.age >= p.ttl) { p.active = false; p.sprite.visible = false; continue; }
    const f = p.age / p.ttl;                 // 0..1 life fraction
    const pos = p.sprite.position;
    // A strong storm flattens the vertical reach (the plume is pushed over, not lofted)
    // so it tilts toward horizontal — "torn flat" — instead of standing taller than calm.
    pos.y += p.rise * (1 - 0.4 * stormI) * dt;
    // Drift ramps with height (f^1.5): the root stays anchored at the fire while the
    // mid+upper column leans/shears progressively downwind — a continuous diagonal tear
    // in a storm, not a vertical stack that kinks only at the very top.
    const lean = f * Math.sqrt(f);
    pos.x += wx * lean * dt;
    pos.z += wz * lean * dt;
    p.sprite.scale.setScalar(
      Tuning.FIRE_SMOKE_SCALE_START + (Tuning.FIRE_SMOKE_SCALE_END - Tuning.FIRE_SMOKE_SCALE_START) * f,
    );
    // Fade in fast, hold the column OPAQUE through its mid-height (a solid signal),
    // then ease out only over the top ~45% so the plume thins into the sky.
    const fadeIn = Math.min(1, f / 0.08);
    const fadeOut = f < 0.65 ? 1 : (1 - f) / 0.35;   // hold opaque higher up the column (a bolder beacon), then taper the top
    (p.sprite.material as THREE.SpriteMaterial).opacity = Tuning.FIRE_SMOKE_OPACITY * fadeIn * fadeOut;
  }
}

/** TEST/render helper — fast-forward every alive fire's smoke column by `seconds`
 *  of deterministic simulation. rig-shot uses this because headless rAF throttling
 *  starves the real-time accumulation needed to build the full column. */
export function warmFireSmoke(ctx: GameContext, seconds: number): void {
  const dt = 1 / 30;
  for (const fire of ctx.fires.list) {
    if (!fire.smoke || !fire.alive) continue;
    let t = ctx.time.elapsed;
    fire._nextSmokeAt = t;
    for (let s = 0; s < seconds; s += dt) {
      t += dt;
      updateFireSmoke(ctx, fire, dt, t);
    }
    fire._nextSmokeAt = ctx.time.elapsed;   // resume the normal cadence in-game
  }
}

export function updateFires(ctx: GameContext, dt: number): void {
  const t = ctx.time.elapsed;
  for (const fire of ctx.fires.list) {
    if (fire.smoke) updateFireSmoke(ctx, fire, dt, t);
    if (fire.alive) {
      fire.fuelSeconds -= dt;
      if (fire.fuelSeconds <= 0) {
        // Burn out
        fire.alive = false;
        fire.flameGroup.visible = false;
        if (fire.light) {
          fire.light.intensity = 0.2;       // a faint ember glow
          fire.light.color.set(0x5a1810);
        }
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
      if (fire.light) fire.light.intensity = 1.3 * flicker;
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
