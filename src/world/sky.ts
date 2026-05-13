// Stylized "Long Dark"-leaning sky:
//   1) Inverted sphere with a 2-color gradient + sun halo (custom shader).
//   2) Billboarded sun disc that follows the sun direction from camera.
//
// Both follow the camera each frame so they feel infinitely far away.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning, SkyColors, SunColors } from '../config/tuning.ts';

interface SkyBundle {
  sphere: THREE.Mesh;
  sphereMat: THREE.ShaderMaterial;
  sun: THREE.Sprite;
  sunMat: THREE.SpriteMaterial;
}

let bundle: SkyBundle | null = null;

const _topColor = new THREE.Color();
const _horizonColor = new THREE.Color();
const _sunColor = new THREE.Color();
const _sunPos = new THREE.Vector3();

const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAGMENT = /* glsl */ `
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

function makeSunTexture(): THREE.CanvasTexture {
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

  bundle = { sphere, sphereMat, sun, sunMat };
}

/** Per-frame sky update: follow camera, blend gradient, animate sun disc. */
export function updateSky(ctx: GameContext, _dt: number): void {
  if (!bundle) return;
  const cam = ctx.three.camera.position;

  // Sky sphere & sun stay anchored to the camera so they read as infinite.
  bundle.sphere.position.copy(cam);

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

  // Sandstorm tint: pull both horizon and top toward dust-red.
  const storm = ctx.weather.intensity;
  if (storm > 0.001) {
    _horizonColor.lerp(new THREE.Color(0x803020), storm * 0.7);
    _topColor.lerp(new THREE.Color(0x402018), storm * 0.7);
  }

  // Push uniforms.
  bundle.sphereMat.uniforms.uTopColor.value.copy(_topColor);
  bundle.sphereMat.uniforms.uHorizonColor.value.copy(_horizonColor);
  bundle.sphereMat.uniforms.uSunDir.value.copy(ctx.time.sunDir);
  bundle.sphereMat.uniforms.uSunColor.value.copy(_sunColor);
  bundle.sphereMat.uniforms.uSunGlow.value = (0.4 + dayMix * 0.6) * (1 - storm * 0.6);

  // Sun disc: position along sun dir from camera, hide below horizon.
  _sunPos.copy(cam).addScaledVector(ctx.time.sunDir, Tuning.SUN_DISC_DISTANCE);
  bundle.sun.position.copy(_sunPos);
  bundle.sunMat.color.copy(_sunColor);
  bundle.sunMat.opacity = Math.min(1, Math.max(0, sy * 5 + 0.1)); // fade out a bit before horizon
  bundle.sun.visible = aboveHorizon > -0.05;

  // Suppress unused warning (nightMix would drive moon disc later if added).
  void nightMix;
}
