// Session CC-3 — Animated main menu (title screen).
// A self-contained THREE.Scene that opens on a wide stretch of desert
// dunes: camera atop a hero dune, peering across the basin under a tall
// sky (horizon sits in the bottom-third of the frame). A tiny pod streaks
// in from the distance like a shooting star and impacts far out, where a
// big pyre engulfs it. Day/night cycles in the background — the sky uses
// the same shader-dome + sun/moon/stars/planet/shooters setup as the
// in-game sky (sky.ts) so the title reads consistent with the game world.
// Decoupled from game state (game ticks are frozen with ctx.flags.paused).

import * as THREE from 'three';
import { Tuning, SkyColors, SunColors } from '../config/tuning.ts';
import { makeRng } from '../core/rng.ts';
import { easeOutQuad } from '../core/ease.ts';
import { makeEscapePod } from './wrecks.ts';
import {
  SKY_VERTEX, SKY_FRAGMENT,
  makeSunTexture, makeMoonTexture, makePlanetTexture,
  buildStarGeometry,
} from './sky.ts';
import { playFireIgnite, playFireCrackle } from '../audio/audio.ts';

type Phase = 'flyIn' | 'impact' | 'settle' | 'idle';

interface SmokePuff {
  sprite: THREE.Sprite;
  age: number;
  ttl: number;
  vx: number;
  vy: number;
}

interface Ember {
  sprite: THREE.Sprite;
  age: number;
  ttl: number;
  vy: number;
  vx: number;
}

interface ShootingStar {
  line: THREE.Line;
  origin: THREE.Vector3;
  travel: THREE.Vector3;
  lifetime: number;
  elapsed: number;
  active: boolean;
}

export interface TitleScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update(dt: number): void;
  dispose(): void;
}

/** Layered sine-wave dunes + a tall Gaussian "hero dune" centered on origin
 *  so the camera position can perch on top of it. */
function duneHeight(x: number, z: number): number {
  return (
    Math.sin(x * 0.04) * 2.5 +
    Math.sin(z * 0.03 + 1.2) * 3.0 +
    Math.sin((x + z) * 0.015) * 4.5 +
    Math.sin(x * 0.07 + z * 0.05 + 2.7) * 1.2
  );
}

function heroDune(x: number, z: number): number {
  const d2 = x * x + z * z;
  const sigma = Tuning.TITLE_HERO_DUNE_WIDTH;
  return Tuning.TITLE_HERO_DUNE_HEIGHT * Math.exp(-d2 / (sigma * sigma));
}

function terrainY(x: number, z: number): number {
  return duneHeight(x, z) + heroDune(x, z);
}

function makePuffTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.65)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.22)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

/** Bright-core gradient for the shooting-star pod glow + embers. */
function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,240,200,0.85)');
    grad.addColorStop(0.6, 'rgba(255,160,90,0.30)');
    grad.addColorStop(1, 'rgba(255,80,30,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

/** Build a tall procedural pyre — nested cones with bright emissive
 *  materials so it reads as a column of flame, then a PointLight for
 *  ground bounce. Cones are animated each frame in update() to flicker. */
interface Pyre {
  group: THREE.Group;
  light: THREE.PointLight;
  layers: { mesh: THREE.Mesh; phase: number; freq: number }[];
  emberPool: Ember[];
  smokePool: SmokePuff[];
}

function makePyre(rand: () => number, glowTex: THREE.CanvasTexture, puffTex: THREE.CanvasTexture): Pyre {
  const group = new THREE.Group();
  const baseR = Tuning.TITLE_PYRE_BASE_RADIUS;
  const h = Tuning.TITLE_PYRE_HEIGHT;
  const layers: Pyre['layers'] = [];
  const specs = [
    { r: baseR,        ht: h * 0.95, color: 0xc8401c, opacity: 0.85, freq: 7,  segs: 18, blend: THREE.NormalBlending },
    { r: baseR * 0.72, ht: h * 0.95, color: 0xff7028, opacity: 0.90, freq: 11, segs: 16, blend: THREE.NormalBlending },
    { r: baseR * 0.45, ht: h * 0.90, color: 0xffd070, opacity: 0.92, freq: 14, segs: 12, blend: THREE.AdditiveBlending },
    { r: baseR * 0.22, ht: h * 0.78, color: 0xfff0c8, opacity: 0.95, freq: 19, segs: 10, blend: THREE.AdditiveBlending },
  ];
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    const geo = new THREE.ConeGeometry(s.r, s.ht, s.segs, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: s.color,
      transparent: true,
      opacity: s.opacity,
      depthWrite: false,
      blending: s.blend,
      side: THREE.DoubleSide,
      fog: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = s.ht / 2;
    mesh.renderOrder = 10 + i;
    group.add(mesh);
    layers.push({ mesh, phase: rand() * Math.PI * 2, freq: s.freq });
  }

  // Glowing coal bed at base.
  const coalGeo = new THREE.SphereGeometry(baseR * 0.9, 16, 8);
  const coalMat = new THREE.MeshBasicMaterial({
    color: 0xff5018,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const coal = new THREE.Mesh(coalGeo, coalMat);
  coal.scale.set(1, 0.35, 1);
  coal.position.y = baseR * 0.15;
  coal.renderOrder = 9;
  group.add(coal);

  // 5 chaotic "tongues" at random angles around the base.
  for (let i = 0; i < 5; i++) {
    const ang = rand() * Math.PI * 2;
    const dist = baseR * (0.4 + rand() * 0.45);
    const th = h * (0.4 + rand() * 0.35);
    const geo = new THREE.ConeGeometry(baseR * 0.22, th, 8, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffb040,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(Math.cos(ang) * dist, th / 2, Math.sin(ang) * dist);
    mesh.rotation.z = (rand() - 0.5) * 0.35;
    mesh.renderOrder = 11;
    group.add(mesh);
    layers.push({ mesh, phase: rand() * Math.PI * 2, freq: 9 + rand() * 12 });
  }

  const light = new THREE.PointLight(0xff8040, 6.0, Tuning.TITLE_PYRE_LIGHT_RANGE, 1.6);
  light.position.set(0, 1.0, 0);
  light.castShadow = false;
  group.add(light);

  const emberPool: Ember[] = [];
  for (let i = 0; i < 16; i++) {
    const mat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffe0a0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(0.45);
    s.visible = false;
    group.add(s);
    emberPool.push({ sprite: s, age: 0, ttl: 0, vy: 0, vx: 0 });
  }

  const smokePool: SmokePuff[] = [];
  for (let i = 0; i < 14; i++) {
    const mat = new THREE.SpriteMaterial({
      map: puffTex,
      color: 0x2a221a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: true,
    });
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(2.0);
    s.visible = false;
    group.add(s);
    smokePool.push({ sprite: s, age: 0, ttl: 0, vx: 0, vy: 0 });
  }

  return { group, light, layers, emberPool, smokePool };
}

/** Build the same sky package the in-game world uses: inverted sphere
 *  with a 2-color shader gradient + sun-halo, billboarded sun/moon
 *  sprites that orbit the camera in opposite directions, star field
 *  + a fixed-direction planet, and a small shooting-star pool. */
interface SkyBundle {
  sphere: THREE.Mesh;
  sphereMat: THREE.ShaderMaterial;
  sun: THREE.Sprite;
  sunMat: THREE.SpriteMaterial;
  moon: THREE.Sprite;
  moonMat: THREE.SpriteMaterial;
  stars: THREE.Points;
  starsMat: THREE.PointsMaterial;
  planet: THREE.Sprite;
  planetMat: THREE.SpriteMaterial;
  shooters: ShootingStar[];
  nextShooterAt: number;
}

function makeSkyBundle(scene: THREE.Scene): SkyBundle {
  const sphereGeo = new THREE.SphereGeometry(Tuning.SKY_SPHERE_RADIUS, 32, 18);
  const sphereMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false,
    uniforms: {
      uTopColor:     { value: SkyColors.TOP_DAY.clone() },
      uHorizonColor: { value: SkyColors.HORIZON_DAY.clone() },
      uSunDir:       { value: new THREE.Vector3(0, 1, 0) },
      uSunColor:     { value: SunColors.NOON.clone() },
      uSunGlow:      { value: 1.0 },
    },
  });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.renderOrder = -1;
  sphere.frustumCulled = false;
  scene.add(sphere);

  const sunMat = new THREE.SpriteMaterial({
    map: makeSunTexture(),
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  });
  const sun = new THREE.Sprite(sunMat);
  sun.scale.setScalar(Tuning.SUN_DISC_SIZE);
  sun.renderOrder = 0;
  sun.frustumCulled = false;
  scene.add(sun);

  const moonMat = new THREE.SpriteMaterial({
    map: makeMoonTexture(),
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,    // dunes occlude the moon when it passes behind them
    fog: false,
    toneMapped: false,
    blending: THREE.NormalBlending,
  });
  const moon = new THREE.Sprite(moonMat);
  moon.scale.setScalar(Tuning.MOON_DISC_SIZE);
  moon.renderOrder = 0;
  moon.frustumCulled = false;
  scene.add(moon);

  const starsMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(buildStarGeometry(), starsMat);
  stars.renderOrder = -0.5;
  stars.frustumCulled = false;
  scene.add(stars);

  const planetMat = new THREE.SpriteMaterial({
    map: makePlanetTexture(),
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
    blending: THREE.NormalBlending,
  });
  const planet = new THREE.Sprite(planetMat);
  planet.scale.setScalar(Tuning.PLANET_SIZE);
  planet.renderOrder = 0;
  planet.frustumCulled = false;
  scene.add(planet);

  const shooters: ShootingStar[] = [];
  for (let i = 0; i < Tuning.SHOOTING_STAR_POOL; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(
      new Float32Array([1, 1, 1, 1, 1, 1]), 3,
    ));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
      fog: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 0.5;
    line.frustumCulled = false;
    line.visible = false;
    scene.add(line);
    shooters.push({
      line,
      origin: new THREE.Vector3(),
      travel: new THREE.Vector3(),
      lifetime: 0,
      elapsed: 0,
      active: false,
    });
  }

  return {
    sphere, sphereMat, sun, sunMat,
    moon, moonMat, stars, starsMat,
    planet, planetMat,
    shooters,
    nextShooterAt: Tuning.SHOOTING_STAR_MIN_INTERVAL,
  };
}

export function createTitleScene(): TitleScene {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(SkyColors.HORIZON_DAY.clone(), Tuning.TITLE_FOG_DENSITY);
  // No scene.background — the sky sphere paints the dome via shader.

  const camera = new THREE.PerspectiveCamera(
    Tuning.TITLE_FOV,
    window.innerWidth / window.innerHeight,
    0.5,
    Tuning.TITLE_FAR,
  );
  const camBaseX = Tuning.TITLE_CAMERA_POS_X;
  const camBaseZ = Tuning.TITLE_CAMERA_POS_Z;
  const groundAtCam = terrainY(camBaseX, camBaseZ);
  const camBaseY = groundAtCam + Tuning.TITLE_CAMERA_POS_Y;
  camera.position.set(camBaseX, camBaseY, camBaseZ);
  const lookTarget = new THREE.Vector3(
    Tuning.TITLE_CAMERA_LOOKAT_X,
    camBaseY + Tuning.TITLE_CAMERA_LOOKAT_Y,
    Tuning.TITLE_CAMERA_LOOKAT_Z,
  );
  camera.lookAt(lookTarget);

  const resize = (): void => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);

  // ── Lights ────────────────────────────────────────────────────────────
  // The sun directional light follows the sun direction so dunes shade
  // realistically through the cycle. Intensity ramps with sun height.
  const sunLight = new THREE.DirectionalLight(0xffe2ad, 0.0);
  sunLight.position.set(40, 60, 20);
  scene.add(sunLight);
  // Moon light (subtle, blue) — comes up at night.
  const moonLight = new THREE.DirectionalLight(0x6a7ea0, 0.0);
  moonLight.position.set(-30, 50, -20);
  scene.add(moonLight);
  const ambient = new THREE.AmbientLight(0x4a3a2a, Tuning.AMBIENT_BASE);
  scene.add(ambient);

  // ── Sky package (sphere + sun + moon + stars + planet + shooters) ────
  const sky = makeSkyBundle(scene);

  // ── Dune terrain ──────────────────────────────────────────────────────
  const groundGeo = new THREE.PlaneGeometry(
    Tuning.TITLE_GROUND_SIZE,
    Tuning.TITLE_GROUND_SIZE,
    Tuning.TITLE_GROUND_SEGMENTS,
    Tuning.TITLE_GROUND_SEGMENTS,
  );
  groundGeo.rotateX(-Math.PI / 2);
  const groundPos = groundGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < groundPos.count; i++) {
    const x = groundPos.getX(i);
    const z = groundPos.getZ(i);
    groundPos.setY(i, terrainY(x, z));
  }
  groundGeo.computeVertexNormals();
  const groundMat = new THREE.MeshLambertMaterial({
    color: 0x8b6a44,
    fog: true,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = false;
  scene.add(ground);

  // Silhouette rocks for scale anchors.
  const rand = makeRng(424242);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x4a3a2a, fog: true });
  for (let i = 0; i < 32; i++) {
    const ang = rand() * Math.PI * 2;
    const dist = 25 + rand() * 240;
    const rx = Math.cos(ang) * dist;
    const rz = Math.sin(ang) * dist;
    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.5 + rand() * 1.4, 0),
      rockMat,
    );
    rock.position.set(rx, terrainY(rx, rz) + 0.1, rz);
    rock.rotation.set(rand() * 0.8, rand() * 6, rand() * 0.6);
    rock.scale.set(1, 0.55 + rand() * 0.4, 1);
    scene.add(rock);
  }

  // ── Shooting-star pod ────────────────────────────────────────────────
  const podGroup = new THREE.Group();
  const podMesh = makeEscapePod(makeRng(1337), Tuning.TITLE_POD_SCALE);
  podGroup.add(podMesh);
  const glowTex = makeGlowTexture();
  const podGlowMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xfff4d0,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const podGlow = new THREE.Sprite(podGlowMat);
  podGlow.scale.setScalar(2.8);
  podGroup.add(podGlow);
  podGroup.position.set(
    Tuning.TITLE_POD_START_X,
    Tuning.TITLE_POD_START_Y,
    Tuning.TITLE_POD_START_Z,
  );
  scene.add(podGroup);

  // Glow trail behind the pod.
  const trailLen = Tuning.TITLE_POD_TRAIL_LEN;
  const trailPosArr = new Float32Array(trailLen * 3);
  const trailColArr = new Float32Array(trailLen * 3);
  for (let i = 0; i < trailLen; i++) {
    trailPosArr[i * 3 + 0] = Tuning.TITLE_POD_START_X;
    trailPosArr[i * 3 + 1] = Tuning.TITLE_POD_START_Y;
    trailPosArr[i * 3 + 2] = Tuning.TITLE_POD_START_Z;
    const tt = i / (trailLen - 1);
    trailColArr[i * 3 + 0] = 1.0 * (1 - tt) + 0.4 * tt;
    trailColArr[i * 3 + 1] = 0.9 * (1 - tt) + 0.2 * tt;
    trailColArr[i * 3 + 2] = 0.7 * (1 - tt) + 0.1 * tt;
  }
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPosArr, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColArr, 3));
  const trailMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const trail = new THREE.Line(trailGeo, trailMat);
  scene.add(trail);

  // ── Pyre ──────────────────────────────────────────────────────────────
  const puffTex = makePuffTexture();
  const pyre = makePyre(makeRng(99999), glowTex, puffTex);
  pyre.group.visible = false;
  pyre.group.scale.setScalar(0.001);
  scene.add(pyre.group);

  // ── Atmospheric dust ──────────────────────────────────────────────────
  const dustGeo = new THREE.BufferGeometry();
  const dustCount = Tuning.TITLE_DUST_COUNT;
  const dustPos = new Float32Array(dustCount * 3);
  const dustVel = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3 + 0] = camBaseX + (rand() - 0.5) * 60;
    dustPos[i * 3 + 1] = camBaseY - 6 + rand() * 12;
    dustPos[i * 3 + 2] = camBaseZ + (rand() - 0.5) * 60;
    dustVel[i * 3 + 0] = 0.08 + rand() * 0.18;
    dustVel[i * 3 + 1] = -0.04 - rand() * 0.10;
    dustVel[i * 3 + 2] = 0.03 + rand() * 0.10;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xc9a888,
    size: 0.18,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    sizeAttenuation: true,
    fog: true,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  // ── Pre-compute impact site terrain Y ────────────────────────────────
  const impactY = terrainY(Tuning.TITLE_POD_IMPACT_X, Tuning.TITLE_POD_IMPACT_Z);

  // ── State ────────────────────────────────────────────────────────────
  let elapsed = 0;
  let phase: Phase = 'flyIn';
  let firePlayed = false;
  let burstFiredAt = -1;
  let shakeAmt = 0;
  let nextCrackleAt = 0;
  let nextEmberAt = 0;
  let nextSmokeAt = 0;
  let emberCursor = 0;
  let smokeCursor = 0;
  // Start the day cycle just after sunrise (morning). cyc=0.25 is sunrise;
  // 0.28 means sun is ~5° above horizon — golden warm angled light without
  // being too dim.
  // Start the cycle well before sunrise (cyc=0.25 is the horizon crossing).
  // At 0.19, sun is ~18° below horizon — astronomical twilight, no sun
  // visible above the dunes yet, just a deep red bloom on the horizon. Sun
  // rises ~15s into the 240s cycle.
  const cycleOffset = 0.19;
  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();
  // The in-game sun sweeps (cos, sin, 0.18) — works because the player can
  // look any direction. The title camera is fixed-forward, so we rebuild
  // the sun's arc so DAWN points along an axis well LEFT of camera-forward.
  // Sun + moon both trace this arc, so both bodies appear in the upper-left
  // area of the frame at their visible times.
  const camFwd = new THREE.Vector3(0.273, 0.182, -0.945);
  const camRight = new THREE.Vector3(0.945, 0, 0.273);
  const LEFT_SHIFT = 0.50;   // 0 = sun rises dead-center; larger = more left
  const dawnAxis = camFwd.clone().addScaledVector(camRight, -LEFT_SHIFT).normalize();
  const upPerp = new THREE.Vector3(0, 1, 0)
    .sub(dawnAxis.clone().multiplyScalar(dawnAxis.dot(new THREE.Vector3(0, 1, 0))))
    .normalize();
  const sunPosTmp = new THREE.Vector3();
  const moonPosTmp = new THREE.Vector3();
  const planetDir = new THREE.Vector3(
    Tuning.PLANET_DIR_X, Tuning.PLANET_DIR_Y, Tuning.PLANET_DIR_Z,
  ).normalize();
  const planetPos = new THREE.Vector3();
  const horizonColor = new THREE.Color();
  const topColor = new THREE.Color();
  const sunDiscColor = new THREE.Color();
  const tmpOrigin = new THREE.Vector3();
  const tmpTravel = new THREE.Vector3();

  const burstMat = new THREE.MeshBasicMaterial({
    color: 0xc9a888,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: true,
  });
  const burst = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), burstMat);
  burst.visible = false;
  burst.position.set(Tuning.TITLE_POD_IMPACT_X, impactY + 0.3, Tuning.TITLE_POD_IMPACT_Z);
  scene.add(burst);

  function spawnEmber(): void {
    const e = pyre.emberPool[emberCursor];
    emberCursor = (emberCursor + 1) % pyre.emberPool.length;
    const ang = Math.random() * Math.PI * 2;
    const r = Tuning.TITLE_PYRE_BASE_RADIUS * 0.6 * Math.random();
    e.sprite.position.set(Math.cos(ang) * r, 0.4, Math.sin(ang) * r);
    e.sprite.visible = true;
    (e.sprite.material as THREE.SpriteMaterial).opacity = 0.95;
    (e.sprite.material as THREE.SpriteMaterial).color.setHex(0xffd070);
    e.sprite.scale.setScalar(0.35 + Math.random() * 0.2);
    e.age = 0;
    e.ttl = 1.4 + Math.random() * 1.0;
    e.vy = 2.5 + Math.random() * 1.5;
    e.vx = (Math.random() - 0.5) * 0.8;
  }

  function spawnSmoke(): void {
    const s = pyre.smokePool[smokeCursor];
    smokeCursor = (smokeCursor + 1) % pyre.smokePool.length;
    s.sprite.position.set(
      (Math.random() - 0.5) * 0.6,
      Tuning.TITLE_PYRE_HEIGHT * 0.95,
      (Math.random() - 0.5) * 0.6,
    );
    s.sprite.visible = true;
    (s.sprite.material as THREE.SpriteMaterial).opacity = 0.55;
    s.sprite.scale.setScalar(2.0 + Math.random() * 0.8);
    s.age = 0;
    s.ttl = 4.5 + Math.random() * 1.5;
    s.vy = 0.55 + Math.random() * 0.35;
    s.vx = 0.20 + Math.random() * 0.15;
  }

  function trySpawnShooter(camPos: THREE.Vector3): void {
    const free = sky.shooters.find((s) => !s.active);
    if (!free) return;
    const phi = Math.random() * Math.PI * 2;
    const u = 0.15 + Math.random() * 0.7;
    const sn = Math.sqrt(1 - u * u);
    tmpOrigin.set(sn * Math.cos(phi), u, sn * Math.sin(phi));
    const tx = -Math.sin(phi);
    const tz = Math.cos(phi);
    tmpTravel.set(tx, -0.08 - Math.random() * 0.18, tz)
      .normalize()
      .multiplyScalar(0.55 + Math.random() * 0.25);
    free.origin.copy(tmpOrigin);
    free.travel.copy(tmpTravel);
    free.lifetime = Tuning.SHOOTING_STAR_LIFETIME_MIN +
      Math.random() * (Tuning.SHOOTING_STAR_LIFETIME_MAX - Tuning.SHOOTING_STAR_LIFETIME_MIN);
    free.elapsed = 0;
    free.active = true;
    free.line.visible = true;
    const posAttr = free.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const distance = Tuning.STAR_SPHERE_RADIUS;
    const ox = camPos.x + tmpOrigin.x * distance;
    const oy = camPos.y + tmpOrigin.y * distance;
    const oz = camPos.z + tmpOrigin.z * distance;
    arr[0] = ox; arr[1] = oy; arr[2] = oz;
    arr[3] = ox; arr[4] = oy; arr[5] = oz;
    posAttr.needsUpdate = true;
  }

  function updateShooter(s: ShootingStar, dt: number, camPos: THREE.Vector3, opacityScale: number): void {
    s.elapsed += dt;
    const tt = s.elapsed / s.lifetime;
    if (tt >= 1) { s.active = false; s.line.visible = false; return; }
    const distance = Tuning.STAR_SPHERE_RADIUS;
    const headDir = tmpOrigin.copy(s.origin).addScaledVector(s.travel, tt);
    const tailT = Math.max(0, tt - 0.3);
    const tailDir = tmpTravel.copy(s.origin).addScaledVector(s.travel, tailT);
    const posAttr = s.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    arr[0] = camPos.x + tailDir.x * distance;
    arr[1] = camPos.y + tailDir.y * distance;
    arr[2] = camPos.z + tailDir.z * distance;
    arr[3] = camPos.x + headDir.x * distance;
    arr[4] = camPos.y + headDir.y * distance;
    arr[5] = camPos.z + headDir.z * distance;
    posAttr.needsUpdate = true;
    const env = tt < 0.15 ? tt / 0.15 : 1 - (tt - 0.15) / 0.85;
    (s.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, env) * opacityScale;
  }

  function update(dt: number): void {
    elapsed += dt;

    // ── Phase transitions ──────────────────────────────────────────────
    if (phase === 'flyIn' && elapsed >= Tuning.TITLE_FLY_IN_SEC) {
      phase = 'impact';
      podGlow.visible = false;
      trail.visible = false;
      burst.visible = true;
      burstFiredAt = elapsed;
      shakeAmt = 0.06;
    } else if (
      phase === 'impact' &&
      elapsed >= Tuning.TITLE_FLY_IN_SEC + Tuning.TITLE_IMPACT_SEC
    ) {
      phase = 'settle';
      podGroup.position.set(
        Tuning.TITLE_POD_IMPACT_X,
        impactY - Tuning.TITLE_POD_SCALE * 0.3,
        Tuning.TITLE_POD_IMPACT_Z,
      );
      podGroup.rotation.set(0.2, 0.6, -0.05);
      pyre.group.visible = true;
      pyre.group.position.set(
        Tuning.TITLE_POD_IMPACT_X,
        impactY,
        Tuning.TITLE_POD_IMPACT_Z,
      );
      if (!firePlayed) { playFireIgnite(); firePlayed = true; }
      nextCrackleAt = elapsed + 0.8 + Math.random() * 1.2;
      nextEmberAt = elapsed + 0.1;
      nextSmokeAt = elapsed + 0.3;
    } else if (
      phase === 'settle' &&
      elapsed >= Tuning.TITLE_FLY_IN_SEC + Tuning.TITLE_IMPACT_SEC + Tuning.TITLE_SETTLE_SEC
    ) {
      phase = 'idle';
    }

    // ── Pod position + trail ──────────────────────────────────────────
    if (phase === 'flyIn') {
      const tt = Math.min(1, elapsed / Tuning.TITLE_FLY_IN_SEC);
      const eased = tt * tt * tt;
      podGroup.position.x = THREE.MathUtils.lerp(
        Tuning.TITLE_POD_START_X, Tuning.TITLE_POD_IMPACT_X, eased,
      );
      podGroup.position.y = THREE.MathUtils.lerp(
        Tuning.TITLE_POD_START_Y, impactY, eased,
      );
      podGroup.position.z = THREE.MathUtils.lerp(
        Tuning.TITLE_POD_START_Z, Tuning.TITLE_POD_IMPACT_Z, eased,
      );
      podGroup.rotation.x = elapsed * 0.6;
      podGroup.rotation.y = elapsed * 0.9;
      podGlowMat.opacity = 0.7 + eased * 0.3;
      // Shift trail head.
      for (let i = trailLen - 1; i > 0; i--) {
        trailPosArr[i * 3 + 0] = trailPosArr[(i - 1) * 3 + 0];
        trailPosArr[i * 3 + 1] = trailPosArr[(i - 1) * 3 + 1];
        trailPosArr[i * 3 + 2] = trailPosArr[(i - 1) * 3 + 2];
      }
      trailPosArr[0] = podGroup.position.x;
      trailPosArr[1] = podGroup.position.y;
      trailPosArr[2] = podGroup.position.z;
      (trailGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // ── Impact burst ──────────────────────────────────────────────────
    if (burstFiredAt >= 0) {
      const since = elapsed - burstFiredAt;
      const tt = Math.min(1, since / 1.0);
      burst.scale.setScalar(0.8 + tt * 5.0);
      burstMat.opacity = (1 - tt) * 0.55;
      if (tt >= 1) { burst.visible = false; burstFiredAt = -1; }
    }

    // ── Pyre scale-in + flicker ───────────────────────────────────────
    if (phase === 'settle') {
      const tt = Math.min(
        1,
        (elapsed - (Tuning.TITLE_FLY_IN_SEC + Tuning.TITLE_IMPACT_SEC)) /
          Tuning.TITLE_SETTLE_SEC,
      );
      pyre.group.scale.setScalar(easeOutQuad(tt));
    } else if (phase === 'idle') {
      pyre.group.scale.setScalar(1);
    }
    if (pyre.group.visible) {
      for (const l of pyre.layers) {
        const wobble = 1 + Math.sin(elapsed * l.freq + l.phase) * 0.16;
        const lateral = 1 + Math.sin(elapsed * (l.freq * 0.4) + l.phase * 1.3) * 0.07;
        l.mesh.scale.set(lateral, wobble, lateral);
      }
      const lightFlicker = 1 + Math.sin(elapsed * 9) * 0.18 + Math.sin(elapsed * 23.7) * 0.07;
      pyre.light.intensity = 6.0 * lightFlicker;
      if (elapsed >= nextEmberAt) { spawnEmber(); nextEmberAt = elapsed + 0.08 + Math.random() * 0.12; }
      if (elapsed >= nextSmokeAt) { spawnSmoke(); nextSmokeAt = elapsed + 0.55 + Math.random() * 0.45; }
      if (phase === 'idle' && elapsed > nextCrackleAt) {
        playFireCrackle();
        nextCrackleAt = elapsed + 1.2 + Math.random() * 1.4;
      }
    }

    // ── Tick embers + smoke ───────────────────────────────────────────
    for (const e of pyre.emberPool) {
      if (!e.sprite.visible) continue;
      e.age += dt;
      const lifeT = e.age / e.ttl;
      if (lifeT >= 1) { e.sprite.visible = false; continue; }
      e.sprite.position.x += e.vx * dt;
      e.sprite.position.y += e.vy * dt;
      e.vy = Math.max(0.2, e.vy - dt * 0.5);
      (e.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.95 * (1 - lifeT));
    }
    for (const s of pyre.smokePool) {
      if (!s.sprite.visible) continue;
      s.age += dt;
      const lifeT = s.age / s.ttl;
      if (lifeT >= 1) { s.sprite.visible = false; continue; }
      s.sprite.position.x += s.vx * dt;
      s.sprite.position.y += s.vy * dt;
      (s.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.55 * (1 - lifeT));
      s.sprite.scale.multiplyScalar(1 + dt * 0.25);
    }

    // ── Day/night cycle ────────────────────────────────────────────────
    const cyc = ((elapsed / Tuning.TITLE_DAY_CYCLE_SEC) + cycleOffset) % 1;
    const sunAngle = (cyc - 0.25) * Math.PI * 2;
    // Sun's visual direction sweeps an arc anchored on the camera-forward
    // axis. The day/night brightness math still uses sin(sunAngle) so the
    // cycle has full -1..+1 swing — only the VISUAL position changes here.
    sunDir
      .copy(dawnAxis).multiplyScalar(Math.cos(sunAngle))
      .addScaledVector(upPerp, Math.sin(sunAngle));
    const sy = Math.sin(sunAngle);
    const aboveHorizon = Math.max(0, sy);
    const dayMix = aboveHorizon;
    const nightMix = Math.max(0, -sy);

    // Drive directional lights. The title scene boosts night brightness
    // over the in-game tuning so the dunes stay legible under moonlight —
    // the menu is meant to look beautiful, not pitch-black-survival.
    sunLight.position.set(camera.position.x, camera.position.y, camera.position.z)
      .addScaledVector(sunDir, Tuning.SUN_DISTANCE);
    sunLight.intensity = aboveHorizon * Tuning.SUN_INTENSITY_MAX;
    moonLight.position.set(camera.position.x, camera.position.y, camera.position.z)
      .addScaledVector(sunDir, -Tuning.SUN_DISTANCE);
    // Title-only night-light boosts: 3× moon directional + 4× ambient night
    // gain so the desert reads silvery rather than black.
    moonLight.intensity = nightMix * Tuning.MOON_INTENSITY_MAX * 3.0;
    ambient.intensity = (
      Tuning.AMBIENT_BASE * 1.6
      + aboveHorizon * Tuning.AMBIENT_DAY_GAIN
      + nightMix * Tuning.AMBIENT_NIGHT_GAIN * 4.0
    );

    // Horizon + top color (same blend bands as the in-game sky).
    if (sy > 0.25) {
      horizonColor.copy(SkyColors.HORIZON_DAY);
      topColor.copy(SkyColors.TOP_DAY);
    } else if (sy > -0.1) {
      const t = (sy + 0.1) / 0.35;
      horizonColor.copy(SkyColors.HORIZON_DUSK).lerp(SkyColors.HORIZON_DAY, t);
      topColor.copy(SkyColors.TOP_DUSK).lerp(SkyColors.TOP_DAY, t);
    } else if (sy > -0.3) {
      const t = (sy + 0.3) / 0.2;
      horizonColor.copy(SkyColors.HORIZON_NIGHT).lerp(SkyColors.HORIZON_DUSK, t);
      topColor.copy(SkyColors.TOP_NIGHT).lerp(SkyColors.TOP_DUSK, t);
    } else {
      horizonColor.copy(SkyColors.HORIZON_NIGHT);
      topColor.copy(SkyColors.TOP_NIGHT);
    }
    // Sun disc color: white at noon → golden at low angle → orange at horizon.
    if (aboveHorizon > 0.5) sunDiscColor.copy(SunColors.NOON);
    else if (aboveHorizon > 0.05) {
      const t = (aboveHorizon - 0.05) / 0.45;
      sunDiscColor.copy(SunColors.GOLDEN).lerp(SunColors.NOON, t);
    } else {
      const t = Math.max(0, aboveHorizon) / 0.05;
      sunDiscColor.copy(SunColors.HORIZON).lerp(SunColors.GOLDEN, t);
    }

    // Push sphere uniforms — keep dome anchored to camera so it feels infinite.
    sky.sphere.position.copy(camera.position);
    sky.sphereMat.uniforms.uTopColor.value.copy(topColor);
    sky.sphereMat.uniforms.uHorizonColor.value.copy(horizonColor);
    sky.sphereMat.uniforms.uSunDir.value.copy(sunDir);
    sky.sphereMat.uniforms.uSunColor.value.copy(sunDiscColor);
    sky.sphereMat.uniforms.uSunGlow.value = 0.4 + dayMix * 0.6;

    // Sun disc sprite.
    sunPosTmp.copy(camera.position).addScaledVector(sunDir, Tuning.SUN_DISC_DISTANCE);
    sky.sun.position.copy(sunPosTmp);
    sky.sunMat.color.copy(sunDiscColor);
    sky.sunMat.opacity = Math.min(1, Math.max(0, sy * 5 + 0.1));
    sky.sun.visible = aboveHorizon > -0.05;

    // Moon: opposite the sun.
    moonDir.copy(sunDir).multiplyScalar(-1);
    moonPosTmp.copy(camera.position).addScaledVector(moonDir, Tuning.MOON_DISC_DISTANCE);
    sky.moon.position.copy(moonPosTmp);
    const moonAbove = Math.max(0, moonDir.y);
    sky.moonMat.opacity = Math.min(1, moonAbove * 4 + 0.05);
    sky.moon.visible = moonAbove > -0.02;

    // Stars.
    sky.stars.position.copy(camera.position);
    sky.starsMat.opacity = Math.max(0, nightMix - dayMix * 0.4);

    // Planet.
    planetPos.copy(camera.position).addScaledVector(planetDir, Tuning.PLANET_DISTANCE);
    sky.planet.position.copy(planetPos);
    sky.planetMat.opacity = 0.45 + Math.max(0, 0.55 - aboveHorizon) * 0.6;

    // Shooting stars.
    const nightVisibility = Math.max(0, nightMix - dayMix * 0.4);
    for (const s of sky.shooters) {
      if (s.active) updateShooter(s, dt, camera.position, nightVisibility);
    }
    if (elapsed >= sky.nextShooterAt && nightVisibility > 0.02) {
      trySpawnShooter(camera.position);
      const minI = Tuning.SHOOTING_STAR_MIN_INTERVAL;
      const maxI = Tuning.SHOOTING_STAR_MAX_INTERVAL;
      const scale = 1 / Math.max(0.2, nightVisibility);
      sky.nextShooterAt = elapsed + (minI + Math.random() * (maxI - minI)) * scale;
    } else if (nightVisibility <= 0.02) {
      sky.nextShooterAt = elapsed + Tuning.SHOOTING_STAR_MIN_INTERVAL;
    }

    // Fog color follows horizon so distance fades to the same hue as the dome.
    if (scene.fog && scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(horizonColor);
    }
    // Ground tint warms during day; stays visible (not pitch black) at night
    // so dunes still read in the menu.
    groundMat.color.setHex(0x8b6a44).multiplyScalar(0.55 + dayMix * 0.60);
    dustMat.opacity = 0.22 + dayMix * 0.36;

    // ── Camera shake + lookAt ─────────────────────────────────────────
    if (shakeAmt > 0.001) {
      shakeAmt *= Math.exp(-Tuning.TITLE_SHAKE_DECAY * dt);
      camera.position.set(
        camBaseX + (Math.random() - 0.5) * shakeAmt,
        camBaseY + (Math.random() - 0.5) * shakeAmt,
        camBaseZ + (Math.random() - 0.5) * shakeAmt,
      );
    } else {
      camera.position.set(camBaseX, camBaseY, camBaseZ);
    }
    camera.lookAt(lookTarget);

    // ── Drift atmospheric dust ────────────────────────────────────────
    const dpos = dust.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < dustCount; i++) {
      let x = dpos.getX(i) + dustVel[i * 3 + 0] * dt;
      let y = dpos.getY(i) + dustVel[i * 3 + 1] * dt;
      let z = dpos.getZ(i) + dustVel[i * 3 + 2] * dt;
      if (y < camBaseY - 8) y += 18;
      if (Math.abs(x - camBaseX) > 36) x -= Math.sign(x - camBaseX) * 60;
      if (Math.abs(z - camBaseZ) > 36) z -= Math.sign(z - camBaseZ) * 60;
      dpos.setXYZ(i, x, y, z);
    }
    dpos.needsUpdate = true;
  }

  function dispose(): void {
    window.removeEventListener('resize', resize);
    scene.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
        else mat?.dispose();
      }
      const s = obj as unknown as THREE.Sprite;
      if (s.isSprite) {
        (s.material as THREE.SpriteMaterial).dispose();
      }
    });
    puffTex.dispose();
    glowTex.dispose();
    dustGeo.dispose();
    dustMat.dispose();
    burstMat.dispose();
    groundMat.dispose();
    trailGeo.dispose();
    trailMat.dispose();
    // Sky textures (sun/moon/planet) are owned by spriteMat which
    // already gets disposed in the traverse above.
  }

  return { scene, camera, update, dispose };
}
