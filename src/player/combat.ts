// Player combat (Session PP — generalized for weapon variants).
//
// LMB swings/fires the equipped weapon. Three weapon kinds supported:
//   - 'melee'   — sweeps a small capsule from camera N meters forward
//                 (machete, pipe staff). First enemy collider hit takes
//                 damage. Pipe staff also applies knockback.
//   - 'ranged'  — raycasts from camera up to N meters. First enemy hit
//                 takes a single big damage. Uses ammo from
//                 slot.meta.ammoRemaining.
//
// New weapon? Add an entry to `_WEAPON_SPECS` keyed by ItemId. The
// ItemDef in items.ts handles visuals + use-anim; this file owns the
// hit-detection + damage application.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import type { ItemId } from '../inventory/types.ts';
import { damageRaider, getRaiderForCollider } from '../enemies/raider.ts';
import { damageLizard, getLizardForCollider, knockbackLizard } from '../enemies/lizard.ts';
import { damageShrew, getShrewForCollider } from '../enemies/shrew.ts';
import { damageSandWorm, getSandWormForCollider } from '../enemies/sandWorm.ts';
import { playSwing, playHit, playLizardSquish, playReloadGun } from '../audio/audio.ts';

type WeaponKind = 'melee' | 'ranged' | 'charged';

interface WeaponSpec {
  kind: WeaponKind;
  range: number;        // meters (sweep/raycast distance)
  /** Melee/ranged: flat damage. Charged: unused (uses minDamage/maxDamage). */
  damage: number;
  cooldown: number;     // seconds between uses (post-fire for charged)
  /** Melee only — push hit lizard back this many meters along the
   *  swing direction. 0 = no knockback (machete). */
  knockbackM?: number;
  /** Ranged only — if set, uses slot.meta.ammoRemaining and skips
   *  the shot when 0. Max capacity for reload bookkeeping. */
  maxAmmo?: number;
  /** Charged only — damage at tap-fire (t=0) and at fully charged (t=1). */
  minDamage?: number;
  maxDamage?: number;
  /** Charged only — seconds to fully charge from idle. */
  chargeTime?: number;
}

// ACL ITEMS — amban rifle tuning. Long-barreled ranged weapon: longer
// reach + harder hit than the scrap gun, slower cadence, larger magazine.
// Promoted to Tuning (integration); combat.ts references Tuning.* like the others.
const WEAPON_AMBAN_RIFLE_RANGE = Tuning.WEAPON_AMBAN_RIFLE_RANGE;     // meters (long-range marksman rifle)
const WEAPON_AMBAN_RIFLE_DAMAGE = Tuning.WEAPON_AMBAN_RIFLE_DAMAGE;     // flat per-shot damage (2x scrap gun)
const WEAPON_AMBAN_RIFLE_COOLDOWN = Tuning.WEAPON_AMBAN_RIFLE_COOLDOWN;   // seconds between shots (heavier than scrap gun)
const WEAPON_AMBAN_RIFLE_MAX_AMMO = Tuning.WEAPON_AMBAN_RIFLE_MAX_AMMO;     // magazine capacity

const _WEAPON_SPECS: Partial<Record<ItemId, WeaponSpec>> = {
  machete: {
    kind: 'melee',
    range: Tuning.WEAPON_MACHETE_RANGE,
    damage: Tuning.WEAPON_MACHETE_DAMAGE,
    cooldown: Tuning.WEAPON_MACHETE_COOLDOWN,
  },
  pipe_staff: {
    kind: 'melee',
    range: Tuning.WEAPON_PIPE_STAFF_RANGE,
    damage: Tuning.WEAPON_PIPE_STAFF_DAMAGE,
    cooldown: Tuning.WEAPON_PIPE_STAFF_COOLDOWN,
    knockbackM: Tuning.WEAPON_PIPE_STAFF_KNOCKBACK_M,
  },
  scrap_gun: {
    kind: 'ranged',
    range: Tuning.WEAPON_SCRAP_GUN_RANGE,
    damage: Tuning.WEAPON_SCRAP_GUN_DAMAGE,
    cooldown: Tuning.WEAPON_SCRAP_GUN_COOLDOWN,
    maxAmmo: Tuning.WEAPON_SCRAP_GUN_MAX_AMMO,
  },
  // ACL ITEMS — amban rifle (ranged). Fires through the existing
  // updateCombat ranged path (raycast → dispatchHit → lizard/raider/
  // sandWorm). Uses slot.meta.ammoRemaining + R-reload like the scrap gun.
  amban_rifle: {
    kind: 'ranged',
    range: WEAPON_AMBAN_RIFLE_RANGE,
    damage: WEAPON_AMBAN_RIFLE_DAMAGE,
    cooldown: WEAPON_AMBAN_RIFLE_COOLDOWN,
    maxAmmo: WEAPON_AMBAN_RIFLE_MAX_AMMO,
  },
  energy_pistol: {
    kind: 'charged',
    range: Tuning.WEAPON_ENERGY_PISTOL_RANGE,
    damage: 0,            // unused for charged — see minDamage/maxDamage
    cooldown: Tuning.WEAPON_ENERGY_PISTOL_COOLDOWN,
    minDamage: Tuning.WEAPON_ENERGY_PISTOL_MIN_DAMAGE,
    maxDamage: Tuning.WEAPON_ENERGY_PISTOL_MAX_DAMAGE,
    chargeTime: Tuning.WEAPON_ENERGY_PISTOL_CHARGE_TIME,
  },
};

// Module-level charge state for charged weapons. Tracks how long the
// player has been holding LMB. Resets on release or weapon swap.
let _chargeStartedAt: number | null = null;
let _chargingItemId: ItemId | null = null;

/** Charge progress for the equipped charged weapon (0..1). Exposed to
 *  the viewmodel system so it can drive a chamber-glow effect. */
export function chargeProgress(ctx: GameContext): number {
  const slot = ctx.inventory.slots[ctx.inventory.selectedIdx];
  if (!slot.item || slot.item !== _chargingItemId) return 0;
  const spec = _WEAPON_SPECS[slot.item];
  if (!spec || spec.kind !== 'charged' || _chargeStartedAt === null) return 0;
  const t = (ctx.time.elapsed - _chargeStartedAt) / (spec.chargeTime ?? 1.0);
  return Math.max(0, Math.min(1, t));
}

// Expose chargeProgress on window for the energy-pistol viewmodel's
// updateHeld hook. Reading it via window avoids a static cycle between
// items.ts (the ItemDef registry) and combat.ts (which imports
// damageLizard which comes from a module items.ts already touches).
(window as unknown as { __chargeProgress: typeof chargeProgress }).__chargeProgress = chargeProgress;

let _nextSwingAt = 0;
let _swingViewKick = 0;       // crosshair feedback intensity, 0..1
const _fwd = new THREE.Vector3();
const _startPos = { x: 0, y: 0, z: 0 };
const _startRot = { x: 0, y: 0, z: 0, w: 1 };
const _shapeVel = { x: 0, y: 0, z: 0 };
const _rayOrig = { x: 0, y: 0, z: 0 };
const _rayDir = { x: 0, y: 0, z: 0 };

export function updateCombat(ctx: GameContext, dt: number): void {
  // Decay view kick so feedback fades
  _swingViewKick = Math.max(0, _swingViewKick - dt * 5);

  if (!isPlaying(ctx)) return;
  const slot = ctx.inventory.slots[ctx.inventory.selectedIdx];
  const itemId = slot.item;
  if (!itemId) {
    // No equipped item — abort any pending charge.
    _chargeStartedAt = null;
    _chargingItemId = null;
    return;
  }
  const spec = _WEAPON_SPECS[itemId];
  if (!spec) {
    _chargeStartedAt = null;
    _chargingItemId = null;
    return;
  }

  // ── Charged-weapon hold/release logic (energy pistol) ────────────
  // Begin charging on LMB press, fire on release with damage scaled
  // by hold time. Pressing → mousePressed.has(0) is true on the first
  // tick of the press; subsequent ticks the mouse "is down" but not
  // "pressed" — we track release by inverse-checking each frame.
  if (spec.kind === 'charged') {
    const holding = ctx.input.mouseHeld?.has(0) ?? ctx.input.mousePressed.has(0);
    if (holding) {
      // Begin charge if not already charging this weapon.
      if (_chargeStartedAt === null || _chargingItemId !== itemId) {
        if (ctx.time.elapsed < _nextSwingAt) return;
        _chargeStartedAt = ctx.time.elapsed;
        _chargingItemId = itemId;
      }
      return;
    }
    // Not holding — fire if a charge is in progress.
    if (_chargeStartedAt !== null && _chargingItemId === itemId) {
      const chargeDuration = ctx.time.elapsed - _chargeStartedAt;
      const t = Math.max(0, Math.min(1, chargeDuration / (spec.chargeTime ?? 1.0)));
      const damage = (spec.minDamage ?? 0) + ((spec.maxDamage ?? 0) - (spec.minDamage ?? 0)) * t;
      _chargeStartedAt = null;
      _chargingItemId = null;
      fireRanged(ctx, spec, damage);
      return;
    }
    return;
  }

  // ── Non-charged weapons — single press triggers single swing/shot ──
  if (ctx.time.elapsed < _nextSwingAt) return;
  if (!ctx.input.mousePressed.has(0)) return;

  // Ammo check for ranged weapons. Click while empty still triggers the
  // anim + cooldown but produces no shot.
  if (spec.kind === 'ranged' && spec.maxAmmo !== undefined) {
    const ammo = slot.meta?.ammoRemaining ?? 0;
    if (ammo <= 0) {
      _nextSwingAt = ctx.time.elapsed + spec.cooldown * 0.5;
      ctx.ui.showToast('out of ammo');
      return;
    }
    if (!slot.meta) slot.meta = {};
    slot.meta.ammoRemaining = ammo - 1;
  }

  if (spec.kind === 'melee') {
    fireMelee(ctx, spec);
  } else {
    fireRanged(ctx, spec, spec.damage);
  }
}

/** Common pre-fire setup: cooldown, swing kick, sound, viewmodel anim,
 *  camera forward capture. Called by both melee + ranged paths. */
function preFire(ctx: GameContext, spec: WeaponSpec): void {
  _nextSwingAt = ctx.time.elapsed + spec.cooldown;
  _swingViewKick = 1.0;
  playSwing();
  ctx.player.viewModel?.triggerUse();
  const cam = ctx.three.camera;
  cam.getWorldDirection(_fwd);
  _startPos.x = cam.position.x;
  _startPos.y = cam.position.y;
  _startPos.z = cam.position.z;
}

/** Melee swing — capsule sweep from camera N meters forward. */
function fireMelee(ctx: GameContext, spec: WeaponSpec): void {
  preFire(ctx, spec);
  _shapeVel.x = _fwd.x * spec.range;
  _shapeVel.y = _fwd.y * spec.range;
  _shapeVel.z = _fwd.z * spec.range;
  const shape = new RAPIER.Capsule(0.12, 0.20);
  // Include sensors (sandworm collider is a sensor — see DD-2 note).
  const hit = ctx.physics.world.castShape(
    _startPos, _startRot, _shapeVel, shape,
    0, 1.0, true,
    0 as unknown as RAPIER.QueryFilterFlags,
    undefined,
    ctx.player.body.collider,
  );
  if (!hit) return;
  dispatchHit(ctx, hit.collider, spec, spec.damage);
}

/** Ranged shot — raycast from camera N meters forward. Charged
 *  weapons pass a computed damageOverride; flat-ranged passes spec.damage. */
function fireRanged(ctx: GameContext, spec: WeaponSpec, damage: number): void {
  preFire(ctx, spec);
  _rayOrig.x = _startPos.x;
  _rayOrig.y = _startPos.y;
  _rayOrig.z = _startPos.z;
  _rayDir.x = _fwd.x;
  _rayDir.y = _fwd.y;
  _rayDir.z = _fwd.z;
  const ray = new RAPIER.Ray(_rayOrig, _rayDir);
  const hit = ctx.physics.world.castRay(
    ray, spec.range, true,
    0 as unknown as RAPIER.QueryFilterFlags,
    undefined,
    undefined,
    ctx.player.body.body,
  );
  if (!hit) return;
  dispatchHit(ctx, hit.collider, spec, damage);
}

/** Dispatch a successful hit to the correct enemy module. Damage +
 *  optional knockback applied. */
function dispatchHit(
  ctx: GameContext,
  collider: RAPIER.Collider,
  spec: WeaponSpec,
  damage: number,
): void {
  const r = getRaiderForCollider(collider.handle);
  if (r) {
    playHit(1.0);
    damageRaider(r, damage, ctx);
    if (spec.knockbackM && spec.knockbackM > 0) {
      // Raider knockback hook (Session PP) — see raider.ts.
      // Imported here to avoid circular dep / top-level cost.
      import('../enemies/raider.ts').then(m => m.knockbackRaider?.(r, _fwd, spec.knockbackM!, ctx));
    }
    return;
  }
  const l = getLizardForCollider(collider.handle);
  if (l) {
    playLizardSquish();
    // Lizards 1-shot from any non-zero damage (lizard HP = 1.0).
    damageLizard(l, Math.max(1.0, damage), ctx);
    if (spec.knockbackM && spec.knockbackM > 0) {
      knockbackLizard(l, _fwd, spec.knockbackM, ctx);
    }
    return;
  }
  const shrew = getShrewForCollider(collider.handle);
  if (shrew) {
    playLizardSquish();   // ACR — reuse the small-critter squish for the shrew
    // 1-HP critter like the lizard — any non-zero damage kills.
    damageShrew(shrew, Math.max(1.0, damage), ctx);
    return;
  }
  const worm = getSandWormForCollider(collider.handle);
  if (worm) {
    // DD-2 — flat damage, no hit-zone classification. The damage handler
    // gates itself on the worm's state so only lunge/stationaryBreach hits
    // actually land.
    playHit(1.0);
    damageSandWorm(worm, 0, ctx);
    // Sandworm knockback is symbolic — a 240m boss doesn't budge
    // visibly. Skip even if spec.knockbackM is set.
  }
}

/** Returns current crosshair pulse intensity (0..1) — used by HUD/crosshair. */
export function swingViewKick(): number {
  return _swingViewKick;
}

/** Session ABE — scrap_gun reload action. Press R while scrap_gun is the
 *  equipped slot to drain scrap_bullet stacks from the bag and refill
 *  the gun's slot.meta.ammoRemaining up to maxAmmo. Closes the AAN
 *  no_ammo-crosshair loop (which signalled empty but offered no bulk
 *  reload — players had to E-press each bullet individually).
 *
 *  Gated on isPlaying — no reload while paused/overlay-open. Runs in
 *  the main tick after updateCombat; safe to invoke per-frame because
 *  it short-circuits when R isn't pressed. */
export function updateReload(ctx: GameContext): void {
  if (!isPlaying(ctx)) return;
  if (!ctx.input.pressed.has('KeyR')) return;
  const slot = ctx.inventory.slots[ctx.inventory.selectedIdx];
  // ACL ITEMS — generalized so any equipped scrap_bullet-fed ranged
  // weapon reloads on R (was scrap_gun-only). Covers the amban rifle.
  if (slot.item !== 'scrap_gun' && slot.item !== 'amban_rifle') return;
  const spec = _WEAPON_SPECS[slot.item];
  if (!spec || spec.maxAmmo === undefined) return;
  const maxAmmo = spec.maxAmmo;
  const cur = slot.meta?.ammoRemaining ?? 0;
  if (cur >= maxAmmo) {
    ctx.ui.showToast('gun is full');
    return;
  }
  // Drain scrap_bullet stacks across the bag (hotbar slots 0-3, then
  // backpack 4+) until either the gun is full or no bullets remain.
  let need = maxAmmo - cur;
  let loaded = 0;
  for (const s of ctx.inventory.slots) {
    if (need <= 0) break;
    if (s.item !== 'scrap_bullet') continue;
    const take = Math.min(s.count, need);
    s.count -= take;
    if (s.count <= 0) {
      // Empty stack — clear the slot.
      s.item = null;
      s.count = 0;
      if (s.meta) delete (s as { meta?: unknown }).meta;
    }
    loaded += take;
    need -= take;
  }
  if (loaded === 0) {
    ctx.ui.showToast('no scrap bullets');
    return;
  }
  if (!slot.meta) slot.meta = {};
  slot.meta.ammoRemaining = cur + loaded;
  playReloadGun();
  ctx.ui.showToast(`reloaded (${cur + loaded}/${maxAmmo})`);
}
