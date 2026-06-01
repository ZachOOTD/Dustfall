// Stylized "Long Dark"-leaning sky:
//   1) Inverted sphere with a 2-color gradient + sun halo (custom shader).
//   2) Billboarded sun disc that follows the sun direction from camera.
//   3) Session V — moon sprite (opposite the sun), star field, shooting-star
//      pool, and a distant planet sprite. All anchored to the camera so they
//      feel infinite.
//
// Visibility logic:
//   - sun:       above horizon, fades just before set
//   - moon:      below sun (i.e. -sunDir is above horizon), fades just after
//                rise, dims during sandstorm
//   - stars:     opacity = nightMix * (1 - storm), so they hide on bright days
//                and during dust
//   - shooting:  spawn rate scales with nightMix * (1 - storm), pool of N
//   - planet:    fixed world direction; faint always-on visibility, slightly
//                more saturated near dusk; storm dims it

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning, SkyColors, SunColors } from '../config/tuning.ts';

interface ShootingStar {
  line: THREE.Line;
  // start direction (unit vec from camera at spawn) and an orthogonal travel dir
  origin: THREE.Vector3;
  travel: THREE.Vector3;
  lifetime: number;       // total seconds
  elapsed: number;        // 0..lifetime, then recycled
  active: boolean;
}

interface SkyBundle {
  sphere: THREE.Mesh;
  sphereMat: THREE.ShaderMaterial;
  sun: THREE.Sprite;
  sunMat: THREE.SpriteMaterial;
  moon: THREE.Sprite;
  moonMat: THREE.SpriteMaterial;
  stars: THREE.Points;
  // ACL SKY+WEATHER — stars are now a ShaderMaterial (was PointsMaterial)
  // so each star can twinkle (per-vertex phase + uTime) and the whole
  // field can drift. uOpacity carries the night/storm fade (replaces the
  // old material.opacity).
  starsMat: THREE.ShaderMaterial;
  planet: THREE.Sprite;
  planetMat: THREE.SpriteMaterial;
  shooters: ShootingStar[];
  nextShooterAt: number;  // seconds (ctx.time.elapsed) when we try to spawn the next
}

let bundle: SkyBundle | null = null;

const _topColor = new THREE.Color();
const _horizonColor = new THREE.Color();
const _sunColor = new THREE.Color();
const _sunPos = new THREE.Vector3();
const _moonDir = new THREE.Vector3();
const _moonPos = new THREE.Vector3();
const _planetDir = new THREE.Vector3(
  Tuning.PLANET_DIR_X, Tuning.PLANET_DIR_Y, Tuning.PLANET_DIR_Z,
).normalize();
const _planetPos = new THREE.Vector3();
const _tmpOrigin = new THREE.Vector3();
const _tmpTravel = new THREE.Vector3();

// ACL SKY+WEATHER — star twinkle/drift tuning. Promoted to Tuning (integration).
const STAR_TWINKLE_SPEED = Tuning.STAR_TWINKLE_SPEED;       // radians/sec base rate of the twinkle sine
const STAR_TWINKLE_DEPTH = Tuning.STAR_TWINKLE_DEPTH;       // 0..1 — how much opacity dips at the trough
const STAR_TWINKLE_SIZE_DEPTH = Tuning.STAR_TWINKLE_SIZE_DEPTH; // 0..1 — how much point size pulses with twinkle
const STAR_DRIFT_RATE = Tuning.STAR_DRIFT_RATE;            // radians/sec — slow celestial rotation of the field
const STAR_BASE_SIZE = Tuning.STAR_BASE_SIZE;             // px — base point size (was PointsMaterial.size)
// Storm states suppress stars earlier than the bare intensity ramp: even a
// building/settling storm has enough high dust to wash out the night sky.
const STAR_STORM_STATE_FLOOR = Tuning.STAR_STORM_STATE_FLOOR;  // extra star-kill applied while building/storm/settling

// ACL SKY+WEATHER — star field shader. Per-vertex `phase` decorrelates each
// star's twinkle; `size` is the existing magnitude jitter. uTime drives the
// twinkle sine; uOpacity is the night/storm fade (replaces material.opacity).
export const STAR_VERTEX = /* glsl */ `
attribute float size;
attribute float phase;
uniform float uTime;
uniform float uOpacity;
uniform float uTwinkleSpeed;
uniform float uTwinkleDepth;
uniform float uSizeDepth;
uniform float uBaseSize;
varying float vAlpha;
void main() {
  // Twinkle: a per-star sine in [-1,1], folded to [0,1].
  float tw = 0.5 + 0.5 * sin(uTime * uTwinkleSpeed + phase);
  // Opacity dips toward the trough; brighter stars (bigger size) twinkle
  // a touch less so the field doesn't all blink in unison.
  float dip = mix(1.0 - uTwinkleDepth, 1.0, tw);
  vAlpha = uOpacity * dip;
  // Size pulses subtly with the same phase.
  float sizePulse = mix(1.0 - uSizeDepth, 1.0 + uSizeDepth, tw);
  gl_PointSize = uBaseSize * size * sizePulse;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Round, soft-edged star point (gl_PointCoord disc) so points aren't squares.
export const STAR_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);
  // Soft falloff from center→edge.
  float a = smoothstep(0.5, 0.05, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

export const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SKY_FRAGMENT = /* glsl */ `
varying vec3 vDir;
uniform vec3 uTopColor;
uniform vec3 uHorizonColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunGlow;

void main() {
  vec3 d = normalize(vDir);
  float upness = max(0.0, d.y);
  // Steep falloff near the horizon → most of the dome is the top color, with a
  // narrow horizon band in the warm horizon color.
  float t = pow(upness, 0.45);
  vec3 sky = mix(uHorizonColor, uTopColor, t);

  // Sun halo: a tight inner glow plus a wider, fainter outer glow.
  float sd = max(0.0, dot(d, normalize(uSunDir)));
  float inner = smoothstep(0.984, 1.0, sd);
  float outer = smoothstep(0.93, 0.984, sd) * 0.35;
  sky += uSunColor * (inner + outer) * uSunGlow;

  gl_FragColor = vec4(sky, 1.0);
}
`;

export function makeSunTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2d context unavailable');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,240,200,0.95)');
  grad.addColorStop(0.55, 'rgba(255,200,140,0.55)');
  grad.addColorStop(0.85, 'rgba(255,170,90,0.10)');
  grad.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Cool, slightly bluish CRESCENT moon — pale lit-side body with a soft halo,
// and a darker "shadowed" inner crescent erased from the disc. Larger than
// the old full-disc moon so the silhouette reads at SUN_DISC_DISTANCE.
export function makeMoonTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2d context unavailable');
  // Outer halo first (so the erase step at the end carves through it
  // too — the dark side of the crescent has no halo bloom, which reads
  // more lunar than a full halo with a bite missing). Halo is kept tight
  // (radius 28→56) so the erase disk can swallow it entirely on the
  // shadowed side without needing to span the whole texture.
  const halo = g.createRadialGradient(64, 64, 28, 64, 64, 56);
  halo.addColorStop(0, 'rgba(220,228,240,0.55)');
  halo.addColorStop(0.55, 'rgba(180,200,224,0.18)');
  halo.addColorStop(1, 'rgba(180,200,224,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, 128, 128);
  // Solid disc body — pale, with slightly off-center radial highlight.
  g.beginPath();
  g.arc(64, 64, 34, 0, Math.PI * 2);
  const body = g.createRadialGradient(54, 56, 6, 64, 64, 36);
  body.addColorStop(0, 'rgba(248,250,255,1)');
  body.addColorStop(0.7, 'rgba(214,222,236,1)');
  body.addColorStop(1, 'rgba(176,188,208,0.95)');
  g.fillStyle = body;
  g.fill();
  // A couple of subtle maria on the LIT (left) side so the crescent isn't
  // a perfectly clean shape — gives a hint of surface texture.
  g.fillStyle = 'rgba(160,172,196,0.30)';
  for (const [x, y, r] of [[52, 58, 4], [50, 70, 3.5], [56, 78, 3]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // Carve the crescent. Erase disk is bigger and offset further right
  // than the body radius so it swallows both the body's right edge AND
  // the halo bleed on that side — otherwise a thin glow ring leaks past
  // the shadowed side of the crescent.
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.arc(86, 62, 40, 0, Math.PI * 2);
  g.fillStyle = 'rgba(0,0,0,1)';
  g.fill();
  g.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Distant planet — rust-tinged, banded radial gradient. Reads as a small
// reddish dot on the horizon by day; warmer + slightly more visible at dusk.
export function makePlanetTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2d context unavailable');
  // Soft halo
  const halo = g.createRadialGradient(64, 64, 22, 64, 64, 60);
  halo.addColorStop(0, 'rgba(200,90,60,0.35)');
  halo.addColorStop(1, 'rgba(200,90,60,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, 128, 128);
  // Body — banded reds
  g.beginPath();
  g.arc(64, 64, 22, 0, Math.PI * 2);
  const body = g.createRadialGradient(60, 58, 4, 64, 64, 24);
  body.addColorStop(0, 'rgba(238,160,112,1)');
  body.addColorStop(0.5, 'rgba(200,90,55,1)');
  body.addColorStop(1, 'rgba(126,50,30,1)');
  g.fillStyle = body;
  g.fill();
  // A faint horizontal band suggesting rotation
  g.fillStyle = 'rgba(110,42,22,0.45)';
  g.fillRect(44, 66, 40, 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Build a sphere of star positions with magnitude jitter. Points are placed
// just inside the sky sphere so they sit behind everything else.
export function buildStarGeometry(): THREE.BufferGeometry {
  const count = Tuning.STAR_COUNT;
  const radius = Tuning.STAR_SPHERE_RADIUS;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  // ACL SKY+WEATHER — per-star twinkle phase so they blink independently.
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // Uniform-on-sphere via cos-z rejection-free formula.
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    positions[i * 3]     = radius * s * Math.cos(phi);
    positions[i * 3 + 1] = radius * u;
    positions[i * 3 + 2] = radius * s * Math.sin(phi);
    // Brightness jitter — 80% are small/dim, 20% noticeably brighter. This is
    // now a SIZE MULTIPLIER (× uBaseSize in the shader), centered near ~0.8–1.4
    // for the common stars and ~1.4–2.4 for the bright ones.
    sizes[i] = Math.random() < 0.2 ? 1.4 + Math.random() * 1.0 : 0.55 + Math.random() * 0.45;
    // Random starting phase across a full period.
    phases[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  return geo;
}

export function createSky(scene: THREE.Scene): void {
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
  sphere.renderOrder = -1;        // draw before everything else
  sphere.frustumCulled = false;   // we move it every frame; keep it always rendered
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

  // Moon — same sprite pattern, opposite the sun. depthTest:true so
  // dunes/wrecks properly occlude it when the moon's direction passes
  // behind nearby terrain (without this, the sprite punched through any
  // ground it crossed). depthWrite stays off so the moon doesn't write
  // into the depth buffer itself — keeps far-distance sprite-on-sprite
  // ordering clean (stars + planet behind it still render correctly).
  const moonMat = new THREE.SpriteMaterial({
    map: makeMoonTexture(),
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
    blending: THREE.NormalBlending,
  });
  const moon = new THREE.Sprite(moonMat);
  moon.scale.setScalar(Tuning.MOON_DISC_SIZE);
  moon.renderOrder = 0;
  moon.frustumCulled = false;
  scene.add(moon);

  // Star field — additive points via a custom ShaderMaterial so each star
  // can twinkle (per-vertex phase + uTime) and the whole field can slowly
  // drift. uOpacity carries the night/storm fade. depthTest stays ON so
  // terrain in the lower hemisphere occludes the stars beneath your feet
  // (without it, transparent-pass ordering paints them over the terrain).
  // ACL SKY+WEATHER.
  const starsMat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor:        { value: new THREE.Color(0xffffff) },
      uTime:         { value: 0 },
      uOpacity:      { value: 0 },
      uTwinkleSpeed: { value: STAR_TWINKLE_SPEED },
      uTwinkleDepth: { value: STAR_TWINKLE_DEPTH },
      uSizeDepth:    { value: STAR_TWINKLE_SIZE_DEPTH },
      uBaseSize:     { value: STAR_BASE_SIZE },
    },
  });
  const stars = new THREE.Points(buildStarGeometry(), starsMat);
  stars.renderOrder = -0.5;   // after sky sphere, before sun/moon
  stars.frustumCulled = false;
  scene.add(stars);

  // Distant planet — fixed-direction sprite, always visible (faint).
  // depthTest on so mountains in the planet's direction occlude it (no
  // showing through terrain).
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

  // Shooting-star pool — each is a 2-vertex line; vertex colors fade tail→head.
  const shooters: ShootingStar[] = [];
  for (let i = 0; i < Tuning.SHOOTING_STAR_POOL; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    // Vertex colors so the tail fades out; head at color [1] stays bright.
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
    line.renderOrder = 0.5;     // above sun/moon
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

  bundle = {
    sphere, sphereMat, sun, sunMat,
    moon, moonMat, stars, starsMat,
    planet, planetMat, shooters,
    nextShooterAt: Tuning.SHOOTING_STAR_MIN_INTERVAL,
  };
}

/** Pick an unused shooter and arm it with a random origin + travel arc. */
function trySpawnShooter(b: SkyBundle, cam: THREE.Vector3): void {
  const free = b.shooters.find((s) => !s.active);
  if (!free) return;
  // Origin: random direction in the upper sky. Floor at y=0.15 so shooters
  // can streak through the lower sky too — players looking ahead at the
  // horizon will see them, not just players who happen to look straight up.
  const phi = Math.random() * Math.PI * 2;
  const u = 0.15 + Math.random() * 0.7;      // y component, 0.15..0.85
  const s = Math.sqrt(1 - u * u);
  _tmpOrigin.set(s * Math.cos(phi), u, s * Math.sin(phi));
  // Travel: tangent in the sky plane + slight downward bias. ~0.55 unit-sphere
  // distance translates to a streak across roughly 30° of arc — visible
  // enough that even peripheral attention catches them.
  const tx = -Math.sin(phi);
  const tz = Math.cos(phi);
  _tmpTravel.set(tx, -0.08 - Math.random() * 0.18, tz)
    .normalize()
    .multiplyScalar(0.55 + Math.random() * 0.25);

  free.origin.copy(_tmpOrigin);
  free.travel.copy(_tmpTravel);
  free.lifetime = Tuning.SHOOTING_STAR_LIFETIME_MIN +
    Math.random() * (Tuning.SHOOTING_STAR_LIFETIME_MAX - Tuning.SHOOTING_STAR_LIFETIME_MIN);
  free.elapsed = 0;
  free.active = true;
  free.line.visible = true;

  // Seed initial line endpoints — both at origin; head will advance over time.
  const posAttr = free.line.geometry.getAttribute('position') as THREE.BufferAttribute;
  const arr = posAttr.array as Float32Array;
  const distance = Tuning.STAR_SPHERE_RADIUS;
  const ox = cam.x + _tmpOrigin.x * distance;
  const oy = cam.y + _tmpOrigin.y * distance;
  const oz = cam.z + _tmpOrigin.z * distance;
  arr[0] = ox; arr[1] = oy; arr[2] = oz;
  arr[3] = ox; arr[4] = oy; arr[5] = oz;
  posAttr.needsUpdate = true;
}

/** Advance a single shooting star; mark inactive when its lifetime ends. */
function updateShooter(s: ShootingStar, dt: number, cam: THREE.Vector3, opacityScale: number): void {
  s.elapsed += dt;
  const t = s.elapsed / s.lifetime;
  if (t >= 1) {
    s.active = false;
    s.line.visible = false;
    return;
  }
  // Head moves along travel; tail trails behind ~30% of the way.
  const distance = Tuning.STAR_SPHERE_RADIUS;
  const headDir = _tmpOrigin.copy(s.origin).addScaledVector(s.travel, t);
  const tailT = Math.max(0, t - 0.3);
  const tailDir = _tmpTravel.copy(s.origin).addScaledVector(s.travel, tailT);

  const posAttr = s.line.geometry.getAttribute('position') as THREE.BufferAttribute;
  const arr = posAttr.array as Float32Array;
  arr[0] = cam.x + tailDir.x * distance;
  arr[1] = cam.y + tailDir.y * distance;
  arr[2] = cam.z + tailDir.z * distance;
  arr[3] = cam.x + headDir.x * distance;
  arr[4] = cam.y + headDir.y * distance;
  arr[5] = cam.z + headDir.z * distance;
  posAttr.needsUpdate = true;

  // Brightness envelope: ramp up fast, fade out slowly.
  const env = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
  const mat = s.line.material as THREE.LineBasicMaterial;
  mat.opacity = Math.max(0, env) * opacityScale;
}

/** Per-frame sky update: follow camera, blend gradient, animate sun disc. */
export function updateSky(ctx: GameContext, dt: number): void {
  if (!bundle) return;
  const cam = ctx.three.camera.position;

  // Sky sphere & sun & moon & stars & planet stay anchored to the camera.
  bundle.sphere.position.copy(cam);
  bundle.stars.position.copy(cam);
  // ACL SKY+WEATHER — slow deterministic celestial DRIFT: rotate the whole
  // star field about a tilted axis as a function of elapsed time. Deterministic
  // (purely a function of ctx.time.elapsed) so it's identical across reloads.
  bundle.stars.rotation.set(
    ctx.time.elapsed * STAR_DRIFT_RATE * 0.18,
    ctx.time.elapsed * STAR_DRIFT_RATE,
    0,
  );

  const sy = ctx.time.sunHeight;
  const aboveHorizon = Math.max(0, sy);
  const dayMix = aboveHorizon;             // 0 night → 1 noon
  const nightMix = Math.max(0, -sy);       // 0 day   → 1 midnight

  // Horizon color: blend NIGHT → DUSK → DAY
  if (sy > 0.25) {
    _horizonColor.copy(SkyColors.HORIZON_DAY);
  } else if (sy > -0.1) {
    const t = (sy + 0.1) / 0.35;
    _horizonColor.copy(SkyColors.HORIZON_DUSK).lerp(SkyColors.HORIZON_DAY, t);
  } else if (sy > -0.3) {
    const t = (sy + 0.3) / 0.2;
    _horizonColor.copy(SkyColors.HORIZON_NIGHT).lerp(SkyColors.HORIZON_DUSK, t);
  } else {
    _horizonColor.copy(SkyColors.HORIZON_NIGHT);
  }

  // Top color: similar bands but a different palette (cooler).
  if (sy > 0.25) {
    _topColor.copy(SkyColors.TOP_DAY);
  } else if (sy > -0.1) {
    const t = (sy + 0.1) / 0.35;
    _topColor.copy(SkyColors.TOP_DUSK).lerp(SkyColors.TOP_DAY, t);
  } else if (sy > -0.3) {
    const t = (sy + 0.3) / 0.2;
    _topColor.copy(SkyColors.TOP_NIGHT).lerp(SkyColors.TOP_DUSK, t);
  } else {
    _topColor.copy(SkyColors.TOP_NIGHT);
  }

  // Sun color: white-pale at noon, golden mid, deep orange near horizon.
  if (aboveHorizon > 0.5) {
    _sunColor.copy(SunColors.NOON);
  } else if (aboveHorizon > 0.05) {
    const t = (aboveHorizon - 0.05) / 0.45;
    _sunColor.copy(SunColors.GOLDEN).lerp(SunColors.NOON, t);
  } else {
    const t = Math.max(0, aboveHorizon) / 0.05;
    _sunColor.copy(SunColors.HORIZON).lerp(SunColors.GOLDEN, t);
  }

  // Sandstorm tint: pull the entire sky (both horizon AND zenith) toward
  // a uniform dust-rust color, almost completely overwriting the gradient
  // at peak intensity. This is what makes the sky look "blocked by dust"
  // rather than a clear sky behind a wall of fog.
  const storm = ctx.weather.intensity;
  if (storm > 0.001) {
    _horizonColor.lerp(new THREE.Color(0x6e3a22), storm * 0.95);
    _topColor.lerp(new THREE.Color(0x4a2614), storm * 0.95);
  }

  // Push uniforms.
  bundle.sphereMat.uniforms.uTopColor.value.copy(_topColor);
  bundle.sphereMat.uniforms.uHorizonColor.value.copy(_horizonColor);
  bundle.sphereMat.uniforms.uSunDir.value.copy(ctx.time.sunDir);
  bundle.sphereMat.uniforms.uSunColor.value.copy(_sunColor);
  bundle.sphereMat.uniforms.uSunGlow.value = (0.4 + dayMix * 0.6) * (1 - storm * 0.92);

  // Sun disc: position along sun dir from camera, hide below horizon.
  _sunPos.copy(cam).addScaledVector(ctx.time.sunDir, Tuning.SUN_DISC_DISTANCE);
  bundle.sun.position.copy(_sunPos);
  bundle.sunMat.color.copy(_sunColor);
  bundle.sunMat.opacity = Math.min(1, Math.max(0, sy * 5 + 0.1)); // fade out a bit before horizon
  bundle.sun.visible = aboveHorizon > -0.05;

  // ── Moon: opposite the sun, faded by nightMix and the storm. ──
  _moonDir.copy(ctx.time.sunDir).multiplyScalar(-1);
  _moonPos.copy(cam).addScaledVector(_moonDir, Tuning.MOON_DISC_DISTANCE);
  bundle.moon.position.copy(_moonPos);
  // Visible when the moon is above the horizon (moonDir.y > 0).
  const moonAbove = Math.max(0, _moonDir.y);
  bundle.moonMat.opacity = Math.min(1, moonAbove * 4 + 0.05) * (1 - storm * 0.85);
  bundle.moon.visible = moonAbove > -0.02;

  // ── Stars: opacity rides nightMix, killed by sandstorm and twilight glow. ──
  // The 0.4 floor of dayMix knocks them out before they show in daylight.
  // ACL SKY+WEATHER — opacity now flows through the shader's uOpacity uniform
  // (not material.opacity). uTime drives the twinkle sine. CLOUD OCCLUSION:
  // building/storm/settling states suppress stars harder than the bare
  // intensity ramp (high dust washes the sky out before peak intensity).
  bundle.starsMat.uniforms.uTime.value = ctx.time.elapsed;
  const stormStateKill =
    ctx.weather.state === 'clear'
      ? 1
      : 1 - STAR_STORM_STATE_FLOOR * (0.35 + 0.65 * storm);
  bundle.starsMat.uniforms.uOpacity.value =
    Math.max(0, nightMix - dayMix * 0.4) * (1 - storm * 0.9) * Math.max(0, stormStateKill);

  // ── Distant planet: fixed direction in world, always-on faint visibility. ──
  _planetPos.copy(cam).addScaledVector(_planetDir, Tuning.PLANET_DISTANCE);
  bundle.planet.position.copy(_planetPos);
  // Slightly brighter at dusk (1 - aboveHorizon), pretty muted at midnight.
  const planetGlow = 0.45 + Math.max(0, 0.55 - aboveHorizon) * 0.6;
  bundle.planetMat.opacity = planetGlow * (1 - storm * 0.7);

  // ── Shooting stars: tick active ones, occasionally arm a new one. ──
  const nightVisibility = Math.max(0, nightMix - dayMix * 0.4) * (1 - storm * 0.9);
  for (const s of bundle.shooters) {
    if (s.active) updateShooter(s, dt, cam, nightVisibility);
  }
  // Fire earlier (threshold 0.02 vs 0.05) so dusk gets a few faint streaks
  // before full dark — opacity scales with nightVisibility so they'll be
  // subtle when the sky is still bright.
  if (ctx.time.elapsed >= bundle.nextShooterAt && nightVisibility > 0.02) {
    trySpawnShooter(bundle, cam);
    // Next interval scales inversely with night strength (longer between
    // shooters when the sky is barely dark).
    const minI = Tuning.SHOOTING_STAR_MIN_INTERVAL;
    const maxI = Tuning.SHOOTING_STAR_MAX_INTERVAL;
    const scale = 1 / Math.max(0.2, nightVisibility);
    bundle.nextShooterAt =
      ctx.time.elapsed + (minI + Math.random() * (maxI - minI)) * scale;
  } else if (nightVisibility <= 0.02) {
    // Reset the timer when fully bright so we don't fire 4 in a row at dusk.
    bundle.nextShooterAt = ctx.time.elapsed + Tuning.SHOOTING_STAR_MIN_INTERVAL;
  }
}
