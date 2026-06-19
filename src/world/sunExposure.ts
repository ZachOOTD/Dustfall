// Sun-shade exposure (M5a, C31).
//
// Direct sun vs SHADE should matter for survival. The game already heats the player
// in the sun + cools in a registered shelter zone, but standing in real SHADE — a
// dune's lee, a low-sun shadow — did nothing. This raymarches the heightfield TOWARD
// the sun from the player's head: if a dune crest rises above the ray, the sun is
// occluded → the player is shaded. The result, `ctx.player.sunExposure01` (1 = full
// direct sun, 0 = fully shaded), is read by survival.ts to scale heat gain + gently
// cool a hot player who's found shade. Low sun (dawn/dusk) casts long dune shadows,
// so seeking the lee as the sun moves becomes a real tactic.
//
// Cheap (throttled, ~tens of heightAt samples) + deterministic (heightAt + sunDir,
// no rand) + transient (recomputed each frame, no save). Smoothed so stepping in/out
// of shade eases rather than popping the temperature.

import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { getSunOccluders } from './horizonSilhouettes.ts';   // big wreck boxes = sun occluders

let _accum = 0;
let _target = 1;

/** Reset on world rebuild (Continue / new game). */
export function resetSunExposure(): void {
  _accum = 0;
  _target = 1;
}

/** Slab test: does the ray (origin o, unit dir d) pass through the AABB (center c,
 *  half-extents h) within (0.5, maxD)? Used to read a wreck's shadow off its
 *  shelter-zone AABB. The 0.5 near-start skips the player's immediate vicinity. */
function rayHitsAABB(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  cx: number, cy: number, cz: number,
  hx: number, hy: number, hz: number,
  maxD: number,
): boolean {
  let tmin = 0.5, tmax = maxD;
  if (Math.abs(dx) < 1e-6) { if (ox < cx - hx || ox > cx + hx) return false; }
  else { let t1 = (cx - hx - ox) / dx, t2 = (cx + hx - ox) / dx; if (t1 > t2) { const m = t1; t1 = t2; t2 = m; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return false; }
  if (Math.abs(dy) < 1e-6) { if (oy < cy - hy || oy > cy + hy) return false; }
  else { let t1 = (cy - hy - oy) / dy, t2 = (cy + hy - oy) / dy; if (t1 > t2) { const m = t1; t1 = t2; t2 = m; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return false; }
  if (Math.abs(dz) < 1e-6) { if (oz < cz - hz || oz > cz + hz) return false; }
  else { let t1 = (cz - hz - oz) / dz, t2 = (cz + hz - oz) / dz; if (t1 > t2) { const m = t1; t1 = t2; t2 = m; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return false; }
  return true;
}

export function updateSunExposure(ctx: GameContext, dt: number): void {
  _accum += dt;
  if (_accum >= Tuning.SUN_EXPOSURE_INTERVAL_S) {
    _accum = 0;
    const sd = ctx.time.sunDir;
    if (ctx.time.sunHeight <= 0.08 || sd.y <= 0.02) {
      // Sun at/below the horizon — exposure is moot (night/twilight heat is handled
      // by survival.ts directly); treat as "full sun" so it doesn't suppress the
      // already-weak low-sun heating.
      _target = 1;
    } else {
      const tr = ctx.player.body.body.translation();
      const headY = tr.y + 0.6;
      const maxD = Tuning.SUN_EXPOSURE_MAX_M;
      let blocked = false;
      // (1) Terrain (dune) occlusion — long dune shadows at low sun. March toward the
      //     sun; a dune crest rising above the ray blocks it.
      const step = Tuning.SUN_EXPOSURE_STEP_M;
      for (let d = step; d <= maxD; d += step) {
        const ry = headY + sd.y * d;            // the sun ray rises as it goes
        const th = ctx.terrain.heightAt(tr.x + sd.x * d, tr.z + sd.z * d);
        if (th > ry + 0.3) { blocked = true; break; }          // a dune crest occludes the sun
        if (ry - th > Tuning.SUN_EXPOSURE_CLEAR_M) break;       // ray well above terrain → clear sky ahead
      }
      // (2) Structure occlusion — a TALL wreck casts a real ground shadow even at
      //     midday (terrain shade is low-sun only). Slab-test the sun ray against the
      //     big wreck bounding boxes (registered by the C28 horizon-silhouette pass)
      //     + the shelter-zone AABBs (deployables: tents/fires). Standing in a wreck's
      //     shadow (outside any shelter) now reads as shade. Cheap (~25 boxes, throttled).
      if (!blocked) {
        for (const o of getSunOccluders()) {
          if (rayHitsAABB(tr.x, headY, tr.z, sd.x, sd.y, sd.z,
                          o.cx, o.cy, o.cz, o.hx, o.hy, o.hz, maxD)) { blocked = true; break; }
        }
      }
      if (!blocked) {
        for (const z of ctx.shelter.zones) {
          if (rayHitsAABB(tr.x, headY, tr.z, sd.x, sd.y, sd.z,
                          z.cx, z.cy, z.cz, z.hx, z.hy, z.hz, maxD)) { blocked = true; break; }
        }
      }
      _target = blocked ? 0 : 1;
    }
  }
  // Smooth toward the target (no temperature pop when stepping in/out of shade).
  const k = Math.min(1, dt * Tuning.SUN_EXPOSURE_LERP);
  ctx.player.sunExposure01 += (_target - ctx.player.sunExposure01) * k;
}
