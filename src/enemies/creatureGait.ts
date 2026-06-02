// ACW Phase A — reusable creature-gait helper.
//
// Mirrors the player-rig gait math (playerRig.ts ~L1044-1196): an
// absolute-time sin-phase, a per-limb phase offset, and sin/clamped-cos
// curves for swing/lift/bend. Creatures (lizard, shrew, companion) each
// own their own leg pivots; this module just supplies the phase + curve
// values so the per-limb posing stays consistent across creatures and we
// don't re-derive the trig in every enemy file.
//
// Convention: a leg pivot points DOWN (-Y) from its attach point. `swing`
// rotates it fore/aft (around the lateral axis); `lift`/`bend` peak during
// the forward (recovery) half-stride so the foot clears the ground while
// it's moving forward, and plants while it's pushing back.

const PI2 = Math.PI * 2;

/** Global gait phase (radians) from absolute elapsed time + cadence (Hz). */
export function gaitPhase(elapsed: number, freqHz: number): number {
  return elapsed * freqHz * PI2;
}

export interface LegPose {
  /** Fore/aft swing (rad), sin-driven — peaks forward at +amp, back at -amp. */
  swing: number;
  /** Vertical foot lift (rad or m, caller's choice), peaks at mid-swing
   *  (forward-moving half-stride); 0 during the planted/stance half. */
  lift: number;
  /** Joint bend (rad), same phase as lift — knee/elbow flex during recovery. */
  bend: number;
}

/** Per-leg gait sample. `offset` spaces the limbs (e.g. opposite pairs use
 *  π); `swingAmp` is the fore/aft amplitude; `liftAmp`/`bendAmp` default 0. */
export function legPose(
  phase: number,
  offset: number,
  swingAmp: number,
  liftAmp = 0,
  bendAmp = 0,
): LegPose {
  const p = phase + offset;
  const recovery = Math.max(0, Math.cos(p)); // >0 during the forward half-stride
  return {
    swing: Math.sin(p) * swingAmp,
    lift: recovery * liftAmp,
    bend: recovery * bendAmp,
  };
}

/** Smoothly approach a target with a per-frame lerp factor (frame-rate
 *  -naive but fine for short feel work; mirrors the rig's aim-twist lerp).
 *  Used to ease gait amplitude in/out as a creature starts/stops moving so
 *  legs don't snap between idle and full stride. */
export function approach(current: number, target: number, lerp: number): number {
  return current + (target - current) * lerp;
}
