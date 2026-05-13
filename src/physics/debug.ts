// Wireframe overlay of Rapier colliders, toggled with Backquote (`).
// Essential for trusting collider placement during development.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';

let lines: THREE.LineSegments | null = null;
let enabled = false;

export function installPhysicsDebug(ctx: GameContext): void {
  const geo = new THREE.BufferGeometry();
  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    depthTest: false,
  });
  lines = new THREE.LineSegments(geo, mat);
  lines.visible = false;
  lines.renderOrder = 999;
  ctx.three.scene.add(lines);

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') {
      enabled = !enabled;
      if (lines) lines.visible = enabled;
    }
  });
}

export function updatePhysicsDebug(ctx: GameContext, _dt: number): void {
  if (!enabled || !lines) return;
  const { vertices, colors } = ctx.physics.world.debugRender();
  lines.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  lines.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
}
