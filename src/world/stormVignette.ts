// Storm vignette (Session BB-4). A clip-space full-screen quad with a
// radial alpha gradient, tinted dust-rust. Fades in with storm intensity
// to push the player's eye toward the center of the screen and sell
// "I cannot see anything but this storm." Lives in-scene (not CSS) so
// it composites with the rendered world and tone-maps with the renderer.
//
// Implementation: a small PlaneGeometry rendered via a ShaderMaterial
// that writes its own clip-space position from vertex IDs — independent
// of model + view matrices. depthTest off + high renderOrder so it
// always draws on top of the world.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';

export interface StormVignette {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
}

const VIGN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  // Force fullscreen-quad in clip space regardless of camera/model.
  // position is already in [-1,1] from PlaneGeometry(2,2).
  gl_Position = vec4(position.xy, 0.999, 1.0);
}
`;

const VIGN_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uInner;
uniform float uOuter;
uniform float uAspect;

void main() {
  // Center-relative UV with aspect correction so the vignette is
  // round-circular, not stretched on widescreen aspect ratios.
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  float d = length(p);
  // Normalize so corners ≈ 1.0 (diagonal of unit square × aspect/2 ≈ 0.56*sqrt(1+a^2)).
  // Simpler: divide by the half-diagonal length.
  float halfDiag = 0.5 * sqrt(uAspect * uAspect + 1.0);
  float r = d / halfDiag;
  float a = smoothstep(uInner, uOuter, r) * uOpacity;
  gl_FragColor = vec4(uColor, a);
}
`;

export function createStormVignette(scene: THREE.Scene): StormVignette {
  const geo = new THREE.PlaneGeometry(2, 2);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VIGN_VERTEX,
    fragmentShader: VIGN_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    uniforms: {
      uColor:   { value: new THREE.Color(Tuning.STORM_VIGNETTE_HEX) },
      uOpacity: { value: 0 },
      uInner:   { value: Tuning.STORM_VIGNETTE_INNER },
      uOuter:   { value: Tuning.STORM_VIGNETTE_OUTER },
      uAspect:  { value: window.innerWidth / window.innerHeight },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 9999;        // last in the scene
  scene.add(mesh);

  // Keep aspect uniform fresh on resize so the vignette stays circular.
  window.addEventListener('resize', () => {
    mat.uniforms.uAspect.value = window.innerWidth / window.innerHeight;
  });

  return { mesh, mat };
}

export function updateStormVignette(ctx: GameContext): void {
  const v = ctx.stormVignette;
  if (!v) return;
  // YY — read `perceivedIntensity` instead of `intensity`. The
  // shelter handling (full-kill for small tent / fire; partial
  // dampening for large tent's open-front cabin) is now baked into
  // perceivedIntensity itself; the prior `inShelter ? 0 : ...`
  // branch is redundant.
  const pi = ctx.weather.perceivedIntensity;
  // Smoothstep ramp so the vignette only really shows in the upper half
  // of the storm intensity range — feels like "the storm is overwhelming
  // me", not "any storm pulls a tint."
  const t = Math.max(0, (pi - 0.4) / 0.6);
  const eased = t * t * (3 - 2 * t);
  const targetOp = eased * Tuning.STORM_VIGNETTE_MAX_OPACITY;
  v.mat.uniforms.uOpacity.value = targetOp;
  v.mesh.visible = targetOp > 0.001;
}
