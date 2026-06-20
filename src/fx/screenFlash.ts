// ACBE — a brief fullscreen flash. No post-processing/bloom pipeline exists; this is
// the cheap shader-quad approach (mirrors stormVignette.ts): a clip-space fullscreen
// quad whose vertex shader writes gl_Position directly (ignoring the camera), drawn
// last (renderOrder 10000, above the storm vignette's 9999), depth-test off. Callers
// pulse it on an impact; it decays each frame. Used by the crash event's impact flash;
// reusable for any "the world went white for a moment" beat.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';

let _mesh: THREE.Mesh | null = null;
let _mat: THREE.ShaderMaterial | null = null;
let _opacity = 0;

const _vert = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const _frag = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() { gl_FragColor = vec4(uColor, uOpacity); }
`;

export function initScreenFlash(scene: THREE.Scene): void {
  if (_mesh) return;
  _mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xfff2e0) },
      uOpacity: { value: 0 },
    },
    vertexShader: _vert,
    fragmentShader: _frag,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  _mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), _mat);
  _mesh.frustumCulled = false;
  _mesh.renderOrder = 10000;
  _mesh.visible = false;
  scene.add(_mesh);
}

/** Pulse the flash to `strength` (0..1) in `color`. Takes the max with any in-flight
 *  flash so a stronger pulse always wins. */
export function flashScreen(color: number, strength: number): void {
  if (!_mat) return;
  (_mat.uniforms.uColor.value as THREE.Color).setHex(color);
  _opacity = Math.max(_opacity, Math.min(1, strength));
}

export function resetScreenFlash(): void {
  _opacity = 0;
  if (_mat) _mat.uniforms.uOpacity.value = 0;
  if (_mesh) _mesh.visible = false;
}

/** Per-frame decay. Cheap no-op when idle. */
export function updateScreenFlash(_ctx: GameContext, dt: number): void {
  if (!_mat || !_mesh) return;
  if (_opacity > 0) _opacity = Math.max(0, _opacity - dt / Tuning.SCREEN_FLASH_DECAY_S);
  _mat.uniforms.uOpacity.value = _opacity;
  _mesh.visible = _opacity > 0.002;
}
