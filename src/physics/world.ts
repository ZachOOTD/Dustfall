// Rapier physics world wrapper.
// `await initPhysics()` must complete before any RAPIER API call.

import RAPIER from '@dimforge/rapier3d-compat';

export interface PhysicsBundle {
  world: RAPIER.World;
  /** Steps the world at a fixed timestep using an accumulator. */
  step: (dt: number) => void;
}

const FIXED_STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;

export async function createPhysicsWorld(): Promise<PhysicsBundle> {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -25, z: 0 });
  world.timestep = FIXED_STEP;

  let accumulator = 0;

  return {
    world,
    step(dt: number): void {
      accumulator += dt;
      let steps = 0;
      while (accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
        world.step();
        accumulator -= FIXED_STEP;
        steps++;
      }
      // Spiral-of-death guard: if we hit the cap, drop residual time.
      if (steps === MAX_STEPS_PER_FRAME) accumulator = 0;
    },
  };
}

export { RAPIER };
