// The approaching DUSTWALL (review 2026-07-14) — a Dune / Mad-Max sandstorm FRONT
// you SEE coming: a towering, curved wall of billowing dust rendered at the storm
// wall's leading edge, tinted dust-brown, ground-to-high-sky. It advances toward the
// player as the storm ramps, then hands off to the whiteout fog as it engulfs you.
//
// Built as 2 concentric curved shells (a partial vertical cylinder each) sharing a
// scrolling turbulent fbm shader — the outer shell reads as the far mass, the inner as
// the churning near billows, so the front has depth instead of reading as one flat
// sheet. Each frame the group is repositioned at the wall's leading edge and yawed to
// face the player; opacity is driven by how far ahead of the player that edge is.
//
// Determinism: no RNG (pure geometry + a time uniform driven by ctx.time.elapsed, which
// freezes on pause). Nothing here touches the seeded chunk/scatter stream.

import * as THREE from 'three';
import { Tuning } from '../config/tuning.ts';

interface Shell {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
}

export interface DustWall {
  group: THREE.Group;
  shells: Shell[];
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uScroll;
  uniform float uWind;
  uniform float uUvX;      // horizontal uv scale (billow count across)
  uniform float uSeed;
  uniform vec3  uColorLo;
  uniform vec3  uColorHi;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    // 4 octaves — the 5th was sub-pixel-fine at wall scale; trimmed for GPU cost
    // (the wall covers up to ~half-screen at mid-ramp, x2 shells of overdraw).
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    // Churn coordinates: billows rise (scroll up) and drift sideways with the wind.
    vec2 p = vec2(uv.x * uUvX + uSeed + uTime * uWind * 0.12,
                  uv.y * 4.6 - uTime * uScroll);
    float n  = fbm(p);
    float n2 = fbm(p * 2.4 + n * 1.6 + vec2(0.0, uTime * uScroll * 0.7));
    float billow = clamp(n * 0.62 + n2 * 0.6, 0.0, 1.0);
    // Sharpen into defined cauliflower lumps (punchier holes + crests → reads as
    // churning mass, not a flat gradient).
    billow = smoothstep(0.18, 0.86, billow);

    // BOILING top: big low-frequency rolls (the classic haboob rolling crest) modulate
    // the wall height so the silhouette heaves, not a flat line.
    float roll = fbm(vec2(uv.x * 3.4 + uSeed + uTime * uWind * 0.05, 7.3));
    float topEdge = 0.50 + 0.46 * roll;
    float vShape = smoothstep(topEdge, topEdge - 0.30, uv.y); // 1 below crest → 0 above
    // Ground the base into the fog/terrain (a hair of translucency at the very bottom).
    float baseFade = smoothstep(0.0, 0.04, uv.y);
    // Sides dissolve into the horizon haze so the wall wraps, not hard-cuts.
    float hEdge = smoothstep(0.0, 0.12, uv.x) * smoothstep(1.0, 0.88, uv.x);
    // Billow density holes — see-through in the shadowed gaps between lumps.
    float density = vShape * baseFade * hEdge * (0.14 + 0.86 * pow(billow, 1.3));

    float alpha = density * uOpacity;
    if (alpha < 0.004) discard;
    // Lit crests are bright ochre; undersides fall to shadow — the wall CATCHES the light
    // so it pops against the darkened storm sky. Extra top-lift brightens the rolling crown.
    float lit = smoothstep(0.1, 0.9, billow);
    lit = clamp(lit + uv.y * 0.25, 0.0, 1.0);
    vec3 col = mix(uColorLo, uColorHi, lit);
    gl_FragColor = vec4(col, alpha);
  }
`;

/** Build a single curved shell — a partial vertical cylinder (arc) concave toward
 *  local +Z, base at y=0, top at y=height. `radius`/`height` size it; `uvX` sets how
 *  many billows read across its width. */
function buildShell(radius: number, height: number, uvX: number, seed: number, scroll: number): Shell {
  const arc = Tuning.STORM_DUSTWALL_ARC;
  const segW = Tuning.STORM_DUSTWALL_SEG_W;
  const segH = Tuning.STORM_DUSTWALL_SEG_H;
  const cols = segW + 1;
  const rows = segH + 1;
  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);
  for (let r = 0; r < rows; r++) {
    const vy = r / segH;
    const y = vy * height;
    for (let c = 0; c < cols; c++) {
      const u = c / segW;
      const a = (u - 0.5) * arc;             // -arc/2 .. +arc/2
      // Concave toward +Z: center (a=0) at z=0, edges advance toward +Z (wrap the player).
      const x = Math.sin(a) * radius;
      const z = (1 - Math.cos(a)) * radius;
      const idx = r * cols + c;
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;
      uvs[idx * 2] = u;
      uvs[idx * 2 + 1] = vy;
    }
  }
  const indices: number[] = [];
  for (let r = 0; r < segH; r++) {
    for (let c = 0; c < segW; c++) {
      const i0 = r * cols + c;
      const i1 = i0 + 1;
      const i2 = i0 + cols;
      const i3 = i2 + 1;
      indices.push(i0, i2, i1, i1, i2, i3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uScroll: { value: scroll },
      uWind: { value: 1 },
      uUvX: { value: uvX },
      uSeed: { value: seed },
      uColorLo: { value: new THREE.Color(Tuning.STORM_DUSTWALL_COLOR_LO) },
      uColorHi: { value: new THREE.Color(Tuning.STORM_DUSTWALL_COLOR_HI) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,   // a genuinely thin, open dust sheet — DoubleSide is correct (rule 7)
    fog: false,               // the dust wall is its own atmosphere, above the FogExp2 layer
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -2;      // draw behind the dust motes + vignette
  mesh.visible = false;
  return { mesh, mat };
}

export function createDustWall(scene: THREE.Scene): DustWall {
  const group = new THREE.Group();
  group.name = 'stormDustWall';
  const H = Tuning.STORM_DUSTWALL_HEIGHT;
  const R = Tuning.STORM_DUSTWALL_RADIUS;
  // Outer mass (bigger, slower, coarser billows) + inner churn (closer, faster, finer).
  const outer = buildShell(R * 1.18, H * 1.12, 11.0, 11.3, Tuning.STORM_DUSTWALL_SCROLL * 0.8);
  const inner = buildShell(R, H, 17.0, 47.9, Tuning.STORM_DUSTWALL_SCROLL * 1.25);
  const shells = [outer, inner];
  for (const s of shells) group.add(s.mesh);
  scene.add(group);
  return { group, shells };
}

const _toPlayer = new THREE.Vector3();

export interface DustWallUpdate {
  visible: boolean;
  edgeX: number;
  edgeZ: number;
  baseY: number;
  playerX: number;
  playerZ: number;
  opacity: number;   // 0..1 ramp (already includes the max-opacity scale)
  elapsed: number;
  wind: number;      // wind magnitude for the sideways churn drift
}

export function updateDustWall(dw: DustWall, p: DustWallUpdate): void {
  const vis = p.visible && p.opacity > 0.002;
  if (dw.group.visible !== vis) dw.group.visible = vis;
  for (const s of dw.shells) {
    if (s.mesh.visible !== vis) s.mesh.visible = vis;
  }
  if (!vis) return;
  // Seat the group at the leading edge, yawed so its concave (+Z) face embraces the player.
  dw.group.position.set(p.edgeX, p.baseY, p.edgeZ);
  _toPlayer.set(p.playerX - p.edgeX, 0, p.playerZ - p.edgeZ);
  const yaw = Math.atan2(_toPlayer.x, _toPlayer.z);   // local +Z → toward player
  dw.group.rotation.y = yaw;
  for (const s of dw.shells) {
    s.mat.uniforms.uTime.value = p.elapsed;
    s.mat.uniforms.uOpacity.value = p.opacity * Tuning.STORM_DUSTWALL_MAX_OPACITY;
    s.mat.uniforms.uWind.value = 0.6 + p.wind;
  }
}
