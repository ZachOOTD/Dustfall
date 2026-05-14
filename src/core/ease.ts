// Easing functions. Each takes t ∈ [0,1] and returns a curved value, used
// by viewmodel use-anims (Session Q) so motions feel weighted instead of
// symmetric. Input outside [0,1] still evaluates; callers should clamp
// upstream if they want strict bounds.

/** Decelerating overshoot. Returns slightly > 1 near t≈0.7 before settling
 *  at 1. Right for a "snap into pose" motion (canteen up to lips, machete
 *  strike forward). */
export function easeOutBack(t: number, s = 1.70158): number {
  return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
}

/** Smooth ease at both ends. Right for deliberate, "felt" motions like
 *  applying a bandage. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Soft decelerate. Right for relaxed returns (release / settle phases). */
export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
