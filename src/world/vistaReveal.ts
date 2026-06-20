// Vista-crest reveal (M5a, C30).
//
// The pull of exploration: cresting a ridge should be REWARDED. When the player
// climbs onto a local high point (standing notably above the surrounding dune field),
// the air briefly clears — the fog LIFTS so the vista opens up and the distant
// landmark silhouettes (C28) sharpen — under a soft warm audio swell. Reach a height,
// see further, spot a wreck on the skyline, glass it (C29), steer toward it.
//
// Detection: throttled terrain sampling → "prominence" = how far the player stands
// above a ring of surrounding samples. The reveal fires on the RISING EDGE of
// prominence crossing the threshold (the crest MOMENT), gated by a cooldown and
// suppressed in a storm. Deterministic (terrain.heightAt + fixed ring offsets, no
// rand draw) and transient (no save state). The fog multiply is re-applied each
// frame AFTER updateWeather sets the base density, so it never compounds.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { playVistaReveal } from '../audio/audio.ts';
import { getPlayerWorldPos } from '../player/effectivePos.ts';   // ACBD — effective player pos (speeder seat while mounted)

const RING_DIRS = 8;
const RING_RADII = [34, 68];   // m — sample the surroundings at two rings

let _sampleAccum = 0;
let _prevProminence = 0;
let _cooldown = 999;           // seconds since last reveal (start ready)
let _revealAge = Infinity;     // seconds since the active reveal fired (Infinity = none)

/** Reset on world rebuild (Continue / new game). */
export function resetVistaReveal(): void {
  _sampleAccum = 0;
  _prevProminence = 0;
  _cooldown = 999;
  _revealAge = Infinity;
}

/** The fog-lift envelope: 0 → 1 over the attack, hold, then 1 → 0 over the release. */
function envelope(age: number): number {
  const A = Tuning.VISTA_ATTACK_S;
  const S = Tuning.VISTA_SUSTAIN_S;
  const R = Tuning.VISTA_RELEASE_S;
  if (age < A) return age / A;
  if (age < A + S) return 1;
  if (age < A + S + R) return 1 - (age - A - S) / R;
  return 0;
}

export function updateVistaReveal(ctx: GameContext, dt: number): void {
  _cooldown += dt;

  // Throttled crest detection.
  _sampleAccum += dt;
  if (_sampleAccum >= Tuning.VISTA_SAMPLE_INTERVAL_S) {
    _sampleAccum = 0;
    const tr = getPlayerWorldPos(ctx);
    const ph = ctx.terrain.heightAt(tr.x, tr.z);
    let sum = 0, n = 0;
    for (let d = 0; d < RING_DIRS; d++) {
      const ang = (d / RING_DIRS) * Math.PI * 2;
      const cx = Math.cos(ang), sz = Math.sin(ang);
      for (const r of RING_RADII) {
        sum += ctx.terrain.heightAt(tr.x + cx * r, tr.z + sz * r);
        n++;
      }
    }
    const prominence = ph - sum / n;
    // Rising edge over the threshold + off-cooldown + not in a storm = a crest.
    if (prominence > Tuning.VISTA_PROMINENCE_M
        && _prevProminence <= Tuning.VISTA_PROMINENCE_M
        && _cooldown >= Tuning.VISTA_COOLDOWN_S
        && ctx.weather.intensity < 0.4) {
      _revealAge = 0;
      _cooldown = 0;
      const over = (prominence - Tuning.VISTA_PROMINENCE_M) / Tuning.VISTA_PROMINENCE_M;
      playVistaReveal(Math.min(1, 0.5 + over));
    }
    _prevProminence = prominence;
  }

  // Apply the active fog-lift.
  if (_revealAge !== Infinity) {
    _revealAge += dt;
    const e = envelope(_revealAge);
    if (e <= 0 && _revealAge > Tuning.VISTA_ATTACK_S) {
      _revealAge = Infinity;     // reveal finished → stop touching the fog
    } else {
      const fog = ctx.three.scene.fog as THREE.FogExp2 | null;
      if (fog) fog.density *= 1 - (1 - Tuning.VISTA_FOG_MULT) * e;
    }
  }
}
