import * as THREE from 'three';
import { Tuning, SkyColors } from '../config/tuning.ts';
import { createGpuTimer, type GpuTimer } from './gpuTimer.ts';

export interface SceneBundle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  clock: THREE.Clock;
  gpuTimer: GpuTimer;
}

export function createScene(): SceneBundle {
  const scene = new THREE.Scene();
  scene.background = SkyColors.DAY.clone();
  scene.fog = new THREE.Fog(SkyColors.DAY.clone(), Tuning.FOG_NEAR, Tuning.FOG_FAR);

  const camera = new THREE.PerspectiveCamera(
    Tuning.FOV,
    window.innerWidth / window.innerHeight,
    Tuning.NEAR_PLANE,
    Tuning.FAR_PLANE,
  );
  camera.position.set(0, Tuning.PLAYER_HEIGHT, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Real-time shadows from the sun. PCFSoft is a good price/quality default.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Mild tone mapping so the brighter sun + ambient don't clip to white.
  renderer.toneMapping = THREE.ReinhardToneMapping;
  renderer.toneMappingExposure = 1.05;

  document.body.appendChild(renderer.domElement);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const gpuTimer = createGpuTimer(renderer);

  return { scene, camera, renderer, clock: new THREE.Clock(), gpuTimer };
}
