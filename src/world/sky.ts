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

// ── REBUILD v2 R1a — SPACE MODE state (intro-only; 0 = normal sky, untouched).
interface SpacePlanet {
  group: THREE.Group;       // camera-anchored; holds the planet body + atmo limb
  planet: THREE.Mesh;
  planetMat: THREE.ShaderMaterial;
  atmoMat: THREE.ShaderMaterial;
}
let _space01 = 0;                          // 0 normal → 1 full space
let _spacePlanet: SpacePlanet | null = null;
let _spaceScene: THREE.Scene | null = null;  // remembered so we can lazily attach the planet
// A fixed WORLD direction for the orbit planet (off to one side + below the
// forward sightline so it reads "below you" out the window). Normalized below.
const _SPACE_PLANET_DIR = new THREE.Vector3(0.24, -0.04, -1).normalize();
const _SPACE_PLANET_DISTANCE = 380;        // < SKY_SPHERE_RADIUS (480): sits inside the dome, in front of the stars
const _SPACE_PLANET_RADIUS = 82;           // a large distant world framed IN the window (ang. radius ~12°)
// Fixed orbit sun-light dir (side-on so the terminator curves across the crown).
const _SPACE_LIGHT = new THREE.Vector3(-0.78, 0.40, 0.30).normalize();
// Near-black space dome colors (the cloud-free orbit void).
const _SPACE_TOP = new THREE.Color(0x01020a);
const _SPACE_HORIZON = new THREE.Color(0x03050f);
const _spacePlanetPos = new THREE.Vector3();

const _topColor = new THREE.Color();
const _horizonColor = new THREE.Color();
const _sunColor = new THREE.Color();
// ACAB (Cycle 6) — cloud shading scratch + base colors.
const _cloudCol = new THREE.Color();
const _cloudDark = new THREE.Color();
const _cloudColBase = new THREE.Color(Tuning.CLOUD_COLOR_HEX);
const _cloudDarkBase = new THREE.Color(Tuning.CLOUD_DARK_HEX);
// ACAB — ominous storm-cloud colors (gathering dark dust-clouds before a storm).
const _stormCloudCol = new THREE.Color(0x6a4c3c);
const _stormCloudDark = new THREE.Color(0x2c2017);
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
uniform float uBrightness;
varying float vAlpha;
void main() {
  // Twinkle: a per-star sine in [-1,1], folded to [0,1].
  float tw = 0.5 + 0.5 * sin(uTime * uTwinkleSpeed + phase);
  // Opacity dips toward the trough; brighter stars (bigger size) twinkle
  // a touch less so the field doesn't all blink in unison.
  float dip = mix(1.0 - uTwinkleDepth, 1.0, tw);
  // uBrightness (>1) lifts the soft-disc mid-tones so stars read clearly on a
  // clear night; the saturated core still clamps in the fragment so we don't
  // get blown-out white blobs. Capped just above 1 to keep the ceiling sane.
  vAlpha = min(uOpacity * dip * uBrightness, 1.15);
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

// ── REBUILD v2 R1a — SPACE MODE (intro-only). A "space mode" drives the SAME
// real sky into an in-orbit look: a near-black dome, clouds killed, stars at full
// brightness, + a LARGE camera-relative planet with a Fresnel atmosphere limb.
// setSkyIntroMode(space01) blends 0 (the normal game sky, byte-unchanged) → 1
// (full space). The intro turns it on for the orbit/cockpit beats and back to 0
// at re-entry. Nothing here runs unless space01 > 0 — the default sky is untouched.
//
// The planet/atmosphere shaders reuse the proven shipScene orbit idiom (a banded
// desert planet + a soft blue limb), but built as a camera-relative celestial body
// in the real wrapping sky (NOT a flat plane in the cockpit). Light dir is fixed so
// the day/night terminator curves across the crown.
const SPACE_PLANET_VS = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vONrm;
  varying vec3 vVNrm;
  varying vec3 vView;
  void main(){
    vPos = normalize(position);
    vONrm = normalize(normal);
    vVNrm = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const SPACE_PLANET_FS = /* glsl */ `
  precision highp float;
  varying vec3 vPos;
  varying vec3 vONrm;
  varying vec3 vVNrm;
  varying vec3 vView;
  uniform vec3 uLightDir;
  uniform float uOpacity;
  float hash(vec3 p){ p = fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float vnoise(vec3 x){
    vec3 p=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(p+vec3(0,0,0)),hash(p+vec3(1,0,0)),f.x),
                   mix(hash(p+vec3(0,1,0)),hash(p+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(p+vec3(0,0,1)),hash(p+vec3(1,0,1)),f.x),
                   mix(hash(p+vec3(0,1,1)),hash(p+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5; } return s; }
  float terrain(vec3 d){
    float bands = sin(d.y*8.0 + fbm(d*1.8)*3.4)*0.5+0.5;
    float cont  = fbm(d*1.7 + 2.0);
    float mott  = fbm(d*3.6 + 5.0);
    float fine  = fbm(d*8.5 + 11.0);
    cont = smoothstep(0.28, 0.74, cont);
    float h = cont*0.52 + bands*0.26 + mott*0.24;
    h = mix(h, h*0.60 + fine*0.40, 0.66);
    return h;
  }
  void main(){
    vec3 n = normalize(vONrm);
    vec3 d = normalize(vPos);
    vec3 L = normalize(uLightDir);
    float lat = d.y;
    float h = terrain(d);
    vec3 t1 = normalize(cross(n, vec3(0.0,1.0,0.0)) + vec3(1e-4));
    vec3 t2 = normalize(cross(n, t1));
    float e = 0.010;
    float hx = terrain(normalize(d + t1*e)) - h;
    float hy = terrain(normalize(d + t2*e)) - h;
    vec3 rn = normalize(n - (t1*hx + t2*hy) * 2.6 * 26.0);
    vec3 cRust = vec3(0.34,0.15,0.08);
    vec3 cBody = vec3(0.70,0.43,0.23);
    vec3 cTan  = vec3(0.94,0.74,0.50);
    vec3 cPolar= vec3(0.91,0.84,0.73);
    vec3 albedo = mix(cRust, cBody, smoothstep(0.14,0.50,h));
    albedo = mix(albedo, cTan, smoothstep(0.50,0.88,h));
    albedo = mix(albedo, cPolar, smoothstep(0.74,0.98,abs(lat))*0.55);
    float ndlGeo = dot(n, L);
    float day = smoothstep(-0.10, 0.34, ndlGeo);
    float ndlSurf = max(dot(rn, L), 0.0);
    // Softer lit-side gain so the day hemisphere doesn't blow out to flat white at
    // exposure (the round-1 "glowing egg" read) — keep the curve readable.
    float shade = 0.16 + 0.92*pow(ndlSurf, 0.85);
    float ao = mix(1.0, 0.60 + 0.40*smoothstep(0.25, 0.65, h), 0.55);
    vec3 sun = vec3(1.02,0.93,0.80);
    vec3 lit = albedo * shade * ao * sun;
    vec3 dark = albedo * 0.045 + vec3(0.010,0.016,0.028);
    vec3 col = mix(dark, lit, day);
    float term = day*(1.0-day)*4.0;
    col += vec3(0.66,0.30,0.11) * term * 0.7;
    float vrim = pow(1.0 - max(dot(normalize(vVNrm), normalize(vView)), 0.0), 2.6);
    vec3 air = vec3(0.30,0.52,0.92);
    col += air * vrim * day * 0.42;
    gl_FragColor = vec4(col, uOpacity);
  }
`;
const SPACE_ATMO_VS = /* glsl */ `
  varying vec3 vNrm;
  varying vec3 vView;
  varying float vNdl;
  uniform vec3 uLightDir;
  void main(){
    vNrm = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    vNdl = dot(normalize(normal), normalize(uLightDir));
    gl_Position = projectionMatrix * mv;
  }
`;
const SPACE_ATMO_FS = /* glsl */ `
  precision highp float;
  varying vec3 vNrm;
  varying vec3 vView;
  varying float vNdl;
  uniform float uOpacity;
  void main(){
    vec3 n = normalize(vNrm);
    vec3 v = normalize(vView);
    float rim = clamp(1.0 - max(dot(n, v), 0.0), 0.0, 1.0);
    float halo  = pow(rim, 1.05);
    float core  = pow(rim, 3.5) * 0.55;
    float outer = pow(rim, 0.45) * 0.45;
    float fres = halo + core + outer;
    float day = smoothstep(-0.55, 0.10, vNdl);
    float k = clamp(vNdl, 0.0, 1.0);
    // Bluer, less white-hot limb so it reads as an AIR halo, not a glowing rim.
    vec3 blue  = vec3(0.30, 0.58, 1.10);
    vec3 white = vec3(0.62, 0.74, 0.92);
    vec3 warm  = vec3(0.95, 0.44, 0.18);
    vec3 tint = mix(warm, white, smoothstep(0.0, 0.30, k));
    tint = mix(tint, blue, smoothstep(0.18, 0.55, k));
    float glow = fres * day * 0.55;
    float twilight = smoothstep(-0.55, -0.20, vNdl) * (1.0 - day) * core;
    vec3 col = tint * glow + vec3(0.18, 0.30, 0.55) * twilight * 0.5;
    float alpha = (glow + twilight * 0.5) * uOpacity;
    gl_FragColor = vec4(col, alpha);
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
// ACAB (Cycle 6) — procedural cloud layer. Clouds are projected onto a virtual
// horizontal plane (d.xz / d.y) so they recede to the horizon, sampled with FBM
// value-noise (zero-asset), thresholded by uCloudiness (0 clear → 1 overcast),
// and drifted by uTime. Lit tops + shaded undersides + a sun-tinted edge.
uniform float uTime;
uniform float uCloudiness;     // 0 clear … 1 overcast
uniform vec3  uCloudColor;     // lit top
uniform vec3  uCloudDark;      // shaded underside
uniform float uCloudScale;     // cloud feature size (smaller = bigger puffs)
uniform vec2  uCloudDrift;     // plane drift per second
uniform float uCloudAlpha;     // max cloud opacity

float skyHash(vec2 p){ p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
float skyVNoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = skyHash(i), b = skyHash(i + vec2(1.0, 0.0));
  float c = skyHash(i + vec2(0.0, 1.0)), dd = skyHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, dd, u.x), u.y);
}
float skyFbm(vec2 p){
  float v = 0.0, amp = 0.55;
  for (int i = 0; i < 5; i++) { v += amp * skyVNoise(p); p = p * 2.02 + 7.3; amp *= 0.5; }
  return v;
}

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

  // ── Clouds ──
  if (uCloudiness > 0.001 && d.y > 0.0) {
    float dy = max(d.y, 0.045);
    vec2 cuv = (d.xz / dy) * uCloudScale + uTime * uCloudDrift;
    // Domain warp — offset the sample by a low-freq noise so the radial
    // projection streaks break into rounder, more organic billows.
    vec2 warp = vec2(skyFbm(cuv * 0.5 + 3.0), skyFbm(cuv * 0.5 + 9.0)) - 0.5;
    cuv += warp * 0.9;
    float n = skyFbm(cuv);
    // Coverage threshold drops as cloudiness rises (more sky fills in). A coarser
    // second tap clumps the cover so it isn't uniform.
    float base = n * 0.68 + skyFbm(cuv * 0.4 + 11.0) * 0.32;
    float lo = mix(0.74, 0.28, uCloudiness);
    float cov = smoothstep(lo, lo + 0.27, base);    // wider band = softer edges
    cov *= smoothstep(0.015, 0.18, d.y);            // thin out toward the horizon
    // Shade: bright lit tops where the noise is high, dark undersides where low.
    vec3 cloudCol = mix(uCloudDark, uCloudColor, smoothstep(0.3, 0.92, n));
    cloudCol += uSunColor * smoothstep(0.55, 1.0, sd) * 0.3 * uSunGlow;  // sun-tinted edge
    sky = mix(sky, cloudCol, cov * uCloudAlpha);
  }

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
  _spaceScene = scene;   // REBUILD v2 R1a — remembered so space-mode can lazily attach its planet
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
      // ACAB (Cycle 6) — cloud layer.
      uTime:         { value: 0 },
      uCloudiness:   { value: 0 },
      uCloudColor:   { value: new THREE.Color(Tuning.CLOUD_COLOR_HEX) },
      uCloudDark:    { value: new THREE.Color(Tuning.CLOUD_DARK_HEX) },
      uCloudScale:   { value: Tuning.CLOUD_SCALE },
      uCloudDrift:   { value: new THREE.Vector2(Tuning.CLOUD_DRIFT_X, Tuning.CLOUD_DRIFT_Z) },
      uCloudAlpha:   { value: Tuning.CLOUD_MAX_ALPHA },
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
      uBrightness:   { value: Tuning.STAR_BRIGHTNESS },
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

// ── REBUILD v2 R1a — SPACE MODE planet (lazy). A LARGE camera-relative celestial
// body in the real sky: a banded desert planet body + a soft Fresnel atmosphere
// limb. Built once on first space-mode use; depthTest off + renderOrder ordered so
// it draws OVER the stars (the body fills, occluding stars behind it) but behind the
// sun/moon sprites. Faded by uOpacity = space01 so it cross-blends in/out cleanly.
function buildSpacePlanet(scene: THREE.Scene): SpacePlanet {
  const group = new THREE.Group();
  group.frustumCulled = false;

  const planetGeo = new THREE.SphereGeometry(_SPACE_PLANET_RADIUS, 96, 64);
  const planetMat = new THREE.ShaderMaterial({
    vertexShader: SPACE_PLANET_VS,
    fragmentShader: SPACE_PLANET_FS,
    uniforms: {
      uLightDir: { value: _SPACE_LIGHT.clone() },
      uOpacity: { value: 0 },
    },
    transparent: true,    // so uOpacity can cross-fade the body in/out
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: true,
  });
  const planet = new THREE.Mesh(planetGeo, planetMat);
  planet.renderOrder = -0.4;   // after stars (-0.5), before sun/moon (0)
  planet.frustumCulled = false;
  group.add(planet);

  // Atmosphere limb — a slightly larger back-side shell, additive blue rim.
  const atmoGeo = new THREE.SphereGeometry(_SPACE_PLANET_RADIUS * 1.06, 80, 56);
  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: SPACE_ATMO_VS,
    fragmentShader: SPACE_ATMO_FS,
    uniforms: {
      uLightDir: { value: _SPACE_LIGHT.clone() },
      uOpacity: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false,
  });
  const atmo = new THREE.Mesh(atmoGeo, atmoMat);
  atmo.renderOrder = -0.39;    // just after the body, before sprites
  atmo.frustumCulled = false;
  group.add(atmo);

  scene.add(group);
  return { group, planet, planetMat, atmoMat };
}

/**
 * REBUILD v2 R1a — drive the real sky into a "space mode" for the intro.
 * @param space01 0 = the normal game sky (BYTE-UNCHANGED — the default), 1 = full
 *   in-orbit space: a near-black dome, clouds killed, stars at full brightness, +
 *   a large camera-relative planet with an atmosphere limb. Intermediate values
 *   cross-blend (re-entry eases space01 → 0 to dissolve into the real dawn sky).
 *   Intro-ONLY: call setSkyIntroMode(0) to fully restore the normal sky.
 * The effect is applied at the END of updateSky each frame, so it overrides the
 * day/night gradient cleanly while space-mode is on and leaves zero residue at 0.
 */
export function setSkyIntroMode(space01: number): void {
  _space01 = Math.max(0, Math.min(1, space01));
  // Lazily build the planet the first time we actually enter space.
  if (_space01 > 0.001 && !_spacePlanet && _spaceScene) {
    _spacePlanet = buildSpacePlanet(_spaceScene);
  }
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

  // ACAB (Cycle 6) — cloud uniforms. Drift via elapsed time; cloudiness from
  // the weather model (storms already overwrite the sky tint above, so we ease
  // clouds OUT under heavy dust to avoid double-darkening). Cloud colors are
  // shaded by time-of-day: bright by day, dim blue-grey at night (with a small
  // floor so a moonlit edge survives), warmed slightly toward dusk.
  const sphU = bundle.sphereMat.uniforms;
  sphU.uTime.value = ctx.time.elapsed;
  const cloudiness = ctx.weather.cloudiness ?? 0;
  sphU.uCloudiness.value = cloudiness * (1 - storm * 0.85);
  const cloudLit = 0.16 + dayMix * 0.84;                 // night floor 0.16 → 1 at noon
  _cloudCol.copy(_cloudColBase).multiplyScalar(cloudLit);
  _cloudDark.copy(_cloudDarkBase).multiplyScalar(cloudLit);
  // Dusk warmth: lerp a touch toward the sun color when the sun is low + up.
  const duskWarm = Math.max(0, 0.5 - aboveHorizon) * dayMix * 0.6;
  _cloudCol.lerp(_sunColor, duskWarm);
  // ACAB — gathering-storm clouds darken to an ominous dust hue while a storm
  // builds/rages (the overcast telegraph turns menacing before the dust wall).
  if (ctx.weather.state !== 'clear') {
    const k = 0.6 * (0.45 + 0.55 * storm);
    _cloudCol.lerp(_stormCloudCol, k);
    _cloudDark.lerp(_stormCloudDark, k);
  }
  sphU.uCloudColor.value.copy(_cloudCol);
  sphU.uCloudDark.value.copy(_cloudDark);

  // Sun disc: position along sun dir from camera, hide below horizon.
  _sunPos.copy(cam).addScaledVector(ctx.time.sunDir, Tuning.SUN_DISC_DISTANCE);
  bundle.sun.position.copy(_sunPos);
  bundle.sunMat.color.copy(_sunColor);
  // ACAB — clouds dim the sun disc (overcast veils it).
  bundle.sunMat.opacity = Math.min(1, Math.max(0, sy * 5 + 0.1)) * (1 - cloudiness * 0.82);
  bundle.sun.visible = aboveHorizon > -0.05;

  // ── Moon: opposite the sun, faded by nightMix and the storm. ──
  _moonDir.copy(ctx.time.sunDir).multiplyScalar(-1);
  _moonPos.copy(cam).addScaledVector(_moonDir, Tuning.MOON_DISC_DISTANCE);
  bundle.moon.position.copy(_moonPos);
  // Visible when the moon is above the horizon (moonDir.y > 0).
  const moonAbove = Math.max(0, _moonDir.y);
  bundle.moonMat.opacity = Math.min(1, moonAbove * 4 + 0.05) * (1 - storm * 0.85) * (1 - cloudiness * 0.8);
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
    Math.max(0, nightMix - dayMix * 0.4) * (1 - storm * 0.9) * Math.max(0, stormStateKill)
    * (1 - cloudiness * 0.92);   // ACAB — overcast veils the stars

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

  // ── REBUILD v2 R1a — SPACE MODE override (intro-only). Applied LAST so it
  // cleanly overrides the day/night gradient while on, and leaves zero residue at
  // space01=0 (the normal sky is byte-unchanged). Blends by _space01.
  applySpaceMode(cam);
}

/** Blend the real sky toward the in-orbit "space mode" by _space01 (0..1). At 0
 *  this is a pure no-op except hiding the (already-hidden) planet. */
function applySpaceMode(cam: THREE.Vector3): void {
  if (!bundle) return;
  const s = _space01;
  const planetVisible = !!_spacePlanet && s > 0.001;
  if (_spacePlanet) _spacePlanet.group.visible = planetVisible;
  if (s <= 0.001) {
    // Fully restore any uniform space-mode lifts so the normal sky is byte-unchanged.
    bundle.starsMat.uniforms.uBrightness.value = Tuning.STAR_BRIGHTNESS;
    return;
  }

  const sphU = bundle.sphereMat.uniforms;
  // Dome → near-black space void (lerp from whatever the day/night pass set).
  sphU.uTopColor.value.lerp(_SPACE_TOP, s);
  sphU.uHorizonColor.value.lerp(_SPACE_HORIZON, s);
  // Kill the desert clouds bleeding through the window.
  sphU.uCloudiness.value *= (1 - s);
  // Drop the atmospheric sun halo in vacuum (no air to scatter it).
  sphU.uSunGlow.value *= (1 - s * 0.9);

  // Stars at full brightness in space (they may be dimmed/killed by daylight), and
  // lift the per-star gain so the field reads richly against the black orbit void.
  const starsU = bundle.starsMat.uniforms;
  starsU.uOpacity.value = Math.max(starsU.uOpacity.value, s);
  starsU.uBrightness.value = THREE.MathUtils.lerp(Tuning.STAR_BRIGHTNESS, 2.1, s);

  // The small distant-planet SPRITE is replaced by the big celestial body — fade it out.
  bundle.planetMat.opacity *= (1 - s);

  // Position + light the large camera-relative planet.
  if (_spacePlanet) {
    _spacePlanetPos.copy(cam).addScaledVector(_SPACE_PLANET_DIR, _SPACE_PLANET_DISTANCE);
    _spacePlanet.group.position.copy(_spacePlanetPos);
    _spacePlanet.planetMat.uniforms.uOpacity.value = s;
    _spacePlanet.atmoMat.uniforms.uOpacity.value = s;
  }
}
