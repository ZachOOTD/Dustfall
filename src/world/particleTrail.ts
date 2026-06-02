// ACW Phase A — reusable pooled particle-trail system.
//
// Generalizes the footprintPuffs.ts pool (round-robin recycle, park-offscreen
// recycling, HMR-dispose guard) into a configurable instance so multiple
// effects (speeder dust trail, shrew burrow puff, future smoke) can each own
// a pool without copy-pasting the buffer plumbing.
//
// Improvement over footprintPuffs: a tiny ShaderMaterial gives PER-PARTICLE
// alpha + size fade over life (soft round sprites that shrink and dissolve)
// rather than a hard pop-out at life=0 — which reads far better for lingering
// dust. Pure additive-free alpha blend, depthWrite off, no fog (trails are
// short-lived and local to the emitter).
//
// Each ParticleTrail is independent; the CALLER owns the instance (store it
// on a module singleton in the effect file and guard HMR there, mirroring
// footprintPuffs). updateParticleTrail integrates + fades; emitParticle adds
// one; emitBurst is a convenience for N at once.

import * as THREE from 'three';

interface TrailParticle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;        // remaining seconds
  initialLife: number; // for alpha/size falloff
  size: number;        // base point size (px at unit attenuation)
}

export interface ParticleTrail {
  points: THREE.Points;
  geo: THREE.BufferGeometry;
  positions: Float32Array;
  alphas: Float32Array;
  sizes: Float32Array;
  particles: TrailParticle[];
  nextIdx: number;
  count: number;
  gravity: number;
  drag: number;
}

export interface ParticleTrailOptions {
  /** Pool capacity. Size to peak in-flight count (emission rate × life). */
  count: number;
  /** Base sprite tint. */
  color: number;
  /** Peak opacity (at full life). */
  opacity?: number;
  /** Gravity (m/s²) applied to vy each frame. Sand dust settles slowly. */
  gravity?: number;
  /** Per-second velocity damping (0 = none, 1 = full stop per sec). */
  drag?: number;
  /** Render order — keep above world but below the FP viewmodel (999). */
  renderOrder?: number;
}

const _vert = /* glsl */ `
  attribute float alpha;
  attribute float psize;
  varying float vAlpha;
  uniform float uScale;
  void main() {
    vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = psize * (uScale / max(0.001, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

const _frag = /* glsl */ `
  precision mediump float;
  varying float vAlpha;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d);
    if (r > 0.5) discard;
    // Soft round falloff toward the edge.
    float soft = smoothstep(0.5, 0.12, r);
    gl_FragColor = vec4(uColor, vAlpha * uOpacity * soft);
  }
`;

export function createParticleTrail(
  scene: THREE.Scene,
  opts: ParticleTrailOptions,
): ParticleTrail {
  const count = opts.count;
  const positions = new Float32Array(count * 3);
  const alphas = new Float32Array(count);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = 0;
    positions[i * 3 + 1] = -10000; // park offscreen
    positions[i * 3 + 2] = 0;
    alphas[i] = 0;
    sizes[i] = 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
  geo.setAttribute('psize', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(opts.color) },
      uOpacity: { value: opts.opacity ?? 0.6 },
      // ~screen-height-scaled point attenuation; tuned to read like
      // PointsMaterial sizeAttenuation at our typical FOV.
      uScale: { value: 300.0 },
    },
    vertexShader: _vert,
    fragmentShader: _frag,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = opts.renderOrder ?? 1;
  scene.add(points);

  const particles: TrailParticle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      active: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      life: 0,
      initialLife: 1,
      size: 1,
    });
  }

  return {
    points, geo, positions, alphas, sizes, particles,
    nextIdx: 0, count,
    gravity: opts.gravity ?? 1.2,
    drag: opts.drag ?? 0.0,
  };
}

export interface EmitSpec {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;
  /** Sprite size ≈ world-space diameter. The shader renders
   *  gl_PointSize = size * uScale(300) / cameraDist, so ~0.4-1.2 reads as a
   *  small mote; values in the tens fill the screen. */
  size: number;
}

/** Emit one particle into the pool (round-robin recycle). */
export function emitParticle(trail: ParticleTrail, spec: EmitSpec): void {
  const idx = trail.nextIdx;
  trail.nextIdx = (trail.nextIdx + 1) % trail.count;
  const p = trail.particles[idx];
  p.active = true;
  p.life = spec.life;
  p.initialLife = spec.life;
  p.size = spec.size;
  p.pos.set(spec.x, spec.y, spec.z);
  p.vel.set(spec.vx, spec.vy, spec.vz);
}

/** Emit `n` particles around a point with randomized velocity spread. */
export function emitBurst(
  trail: ParticleTrail,
  x: number, y: number, z: number,
  n: number,
  base: { speed: number; up: number; life: number; size: number; posJitter?: number },
): void {
  const jitter = base.posJitter ?? 0.1;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = base.speed * (0.4 + Math.random() * 0.6);
    emitParticle(trail, {
      x: x + (Math.random() - 0.5) * jitter,
      y: y + (Math.random() - 0.5) * jitter * 0.5,
      z: z + (Math.random() - 0.5) * jitter,
      vx: Math.cos(a) * sp,
      vy: base.up * (0.6 + Math.random() * 0.8),
      vz: Math.sin(a) * sp,
      life: base.life * (0.7 + Math.random() * 0.6),
      size: base.size * (0.7 + Math.random() * 0.6),
    });
  }
}

/** Per-frame integrate + fade. Call every frame the effect is alive. */
export function updateParticleTrail(trail: ParticleTrail, dt: number): void {
  const { particles, count, positions, alphas, sizes } = trail;
  const dragFactor = trail.drag > 0 ? Math.max(0, 1 - trail.drag * dt) : 1;
  let anyActive = false;
  for (let i = 0; i < count; i++) {
    const p = particles[i];
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -10000;
      positions[i * 3 + 2] = 0;
      alphas[i] = 0;
      continue;
    }
    p.vel.y -= trail.gravity * dt;
    if (dragFactor !== 1) {
      p.vel.x *= dragFactor;
      p.vel.z *= dragFactor;
    }
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.pos.z += p.vel.z * dt;
    positions[i * 3] = p.pos.x;
    positions[i * 3 + 1] = p.pos.y;
    positions[i * 3 + 2] = p.pos.z;
    // Fade: alpha ramps 0→1 quickly on birth then down to 0; size grows
    // slightly as dust diffuses.
    const lifeFrac = p.life / p.initialLife;          // 1 at birth → 0 at death
    const birth = Math.min(1, (p.initialLife - p.life) / (p.initialLife * 0.15));
    alphas[i] = birth * lifeFrac;
    sizes[i] = p.size * (1.0 + (1.0 - lifeFrac) * 0.8);
    anyActive = true;
  }
  trail.geo.attributes.position.needsUpdate = true;
  trail.geo.attributes.alpha.needsUpdate = true;
  trail.geo.attributes.psize.needsUpdate = true;
  trail.points.visible = anyActive;
}

/** Tear down (HMR / scene swap). */
export function disposeParticleTrail(trail: ParticleTrail, scene: THREE.Scene): void {
  scene.remove(trail.points);
  trail.geo.dispose();
  (trail.points.material as THREE.Material).dispose();
}
