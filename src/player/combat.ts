// Player melee combat — LMB swings the equipped machete.
//
// We sweep a small capsule from the camera 1.8m forward (Rapier castShape).
// First enemy collider hit takes damage. Cooldown gates the swing rate.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { damageRaider, getRaiderForCollider } from '../enemies/raider.ts';
import { damageLizard, getLizardForCollider } from '../enemies/lizard.ts';
import { playSwing, playHit, playLizardSquish } from '../audio/audio.ts';

const SWING_RANGE = 1.8;
const SWING_DAMAGE = 0.45;
const SWING_COOLDOWN = 0.5;

let _nextSwingAt = 0;
let _swingViewKick = 0;       // crosshair feedback intensity, 0..1
const _fwd = new THREE.Vector3();
const _startPos = { x: 0, y: 0, z: 0 };
const _startRot = { x: 0, y: 0, z: 0, w: 1 };
const _shapeVel = { x: 0, y: 0, z: 0 };

export function updateCombat(ctx: GameContext, dt: number): void {
  // Decay view kick so feedback fades
  _swingViewKick = Math.max(0, _swingViewKick - dt * 5);

  if (!isPlaying(ctx)) return;
  // Equipped weapon check
  const slot = ctx.inventory.slots[ctx.inventory.selectedIdx];
  if (slot.item !== 'machete') return;
  // Cooldown
  if (ctx.time.elapsed < _nextSwingAt) return;
  // LMB press (mousePressed has 0 = left button)
  if (!ctx.input.mousePressed.has(0)) return;

  _nextSwingAt = ctx.time.elapsed + SWING_COOLDOWN;
  _swingViewKick = 1.0;
  playSwing();
  ctx.player.viewModel?.triggerUse();

  // Sweep a small capsule from camera forward
  const cam = ctx.three.camera;
  cam.getWorldDirection(_fwd);
  _startPos.x = cam.position.x;
  _startPos.y = cam.position.y;
  _startPos.z = cam.position.z;
  _shapeVel.x = _fwd.x * SWING_RANGE;
  _shapeVel.y = _fwd.y * SWING_RANGE;
  _shapeVel.z = _fwd.z * SWING_RANGE;

  const shape = new RAPIER.Capsule(0.12, 0.20); // halfHeight, radius
  const hit = ctx.physics.world.castShape(
    _startPos,
    _startRot,
    _shapeVel,
    shape,
    0,                              // target time
    1.0,                            // max time-of-impact (vel is full range, so 1.0 = SWING_RANGE)
    true,                           // stopAtPenetration
    undefined,
    undefined,
    ctx.player.body.collider,       // exclude player
  );
  if (!hit) return;

  // Dispatch hit by entity type
  const r = getRaiderForCollider(hit.collider.handle);
  if (r) {
    playHit(1.0);
    damageRaider(r, SWING_DAMAGE, ctx);
    return;
  }
  const l = getLizardForCollider(hit.collider.handle);
  if (l) {
    playLizardSquish();
    damageLizard(l, 1.0, ctx);
    return;
  }
}

/** Returns current crosshair pulse intensity (0..1) — used by HUD/crosshair. */
export function swingViewKick(): number {
  return _swingViewKick;
}
