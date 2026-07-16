// The approaching DUSTWALL — a Dune / Mad-Max sandstorm FRONT you SEE coming: a
// towering wall of billowing dust, tinted dust-brown, ground-to-high-sky. It grows
// on the horizon and ADVANCES toward the player along the storm's FIXED wind
// direction, then hands off to the whiteout fog as it engulfs you.
//
// review 2026-07-15 — DE-SPIN REWORK. The old wall was a curved cylinder re-yawed to
// FACE the player every frame (a per-frame lookAt), so as you moved/turned it read as
// spinning/wrapping around you. Now the wall's orientation is LOCKED to the wind vector
// (yaw derived from wall.dir, which is fixed for the whole storm) — it TRANSLATES toward
// the player along that heading, it never rotates. The geometry is a wide, gently
// convex front (the centre bulges toward you and the flanks curve AWAY into the horizon
// haze), so from any player yaw it reads as one flat advancing wall, NOT a cylinder
// hugging the player.
//
// Built as 2 concentric shells sharing a scrolling turbulent fbm shader — the outer
// reads as the far mass, the inner as the churning near billows, so the front has depth
// instead of a flat sheet. Each frame the group is repositioned at the wall's leading
// edge and yawed to the wind heading; opacity is driven by how far ahead of the player
// that edge still is.
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
    float roll = fbm(vec2(uv.x * 9.0 + uSeed + uTime * uWind * 0.05, 7.3));
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

/** Build a single wall shell — a WIDE, near-FLAT front with only a gentle bow, base at
 *  y=0, top at y=height. Local +Z is the wind heading (toward the player as the wall
 *  advances). Width + bow are DECOUPLED (linear width, an independent quadratic bow) so
 *  the wall can span the whole horizon while staying nearly flat — unlike a circular arc,
 *  where widening forces the flanks to wrap forward and read as a cylinder. The centre
 *  (u=0.5) is the leading bulge at z=0 (closest to the player); the flanks recede a small
 *  `bow` fraction of the width toward local -Z into the horizon haze. With the wind-locked
 *  yaw (never a lookAt to the player) this reads as one advancing Dune wall, never a
 *  wrapping cylinder. `width`/`height` size it; `uvX` sets how many billows read across. */
function buildShell(width: number, height: number, bow: number, uvX: number, seed: number, scroll: number): Shell {
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
      const s = u - 0.5;                       // -0.5 .. +0.5 across the width
      // Linear width (full span control) + a gentle quadratic bow: centre (s=0) bulges to
      // z=0 (leading edge, closest), flanks (|s|=0.5) recede by bow·width into -Z (the
      // haze). Because width is independent of the bow, we get a horizon-spanning FLAT
      // front with only a whisper of depth — never the arc's forward-wrapping flanks.
      const x = s * width;
      const z = -bow * width * (2 * s) * (2 * s);   // 0 at centre, -bow·width at the flanks
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
  const W = Tuning.STORM_DUSTWALL_WIDTH;
  const B = Tuning.STORM_DUSTWALL_BOW;
  // Outer mass (bigger, slower, coarser billows, sits a touch further back) + inner churn
  // (closer, faster, finer). Both are the same wide near-flat wind-locked front.
  const outer = buildShell(W * 1.12, H * 1.12, B, 24.0, 11.3, Tuning.STORM_DUSTWALL_SCROLL * 0.8);
  const inner = buildShell(W, H, B, 36.0, 47.9, Tuning.STORM_DUSTWALL_SCROLL * 1.25);
  const shells = [outer, inner];
  for (const s of shells) group.add(s.mesh);
  scene.add(group);
  return { group, shells };
}

export interface DustWallUpdate {
  visible: boolean;
  edgeX: number;
  edgeZ: number;
  baseY: number;
  /** Storm wind / travel heading (unit XZ). The wall's yaw is LOCKED to this —
   *  fixed for the whole storm — so it never re-yaws to the player (no spin). */
  dirX: number;
  dirZ: number;
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
  // Seat the group at the leading edge, yawed to the WIND HEADING (not a lookAt to the
  // player). local +Z → wall.dir, which is fixed for the storm, so the wall only
  // TRANSLATES toward the player as edgeX/edgeZ advance — it never rotates/spins.
  dw.group.position.set(p.edgeX, p.baseY, p.edgeZ);
  const yaw = Math.atan2(p.dirX, p.dirZ);   // local +Z → wind travel direction (toward player)
  dw.group.rotation.y = yaw;
  for (const s of dw.shells) {
    s.mat.uniforms.uTime.value = p.elapsed;
    s.mat.uniforms.uOpacity.value = p.opacity * Tuning.STORM_DUSTWALL_MAX_OPACITY;
    s.mat.uniforms.uWind.value = 0.6 + p.wind;
  }
}
