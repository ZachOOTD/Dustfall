// Generalized rope endpoint vocabulary (B1 Phase 2).
//
// History:
//   QQ — Sled introduced; rope was sled-internal (Sled.tether: SledTether)
//        encoding ONLY the "other end" of the rope. Implicit: the sled
//        was always the second endpoint.
//   ABZ — Added 'companion' SledTether kind.
//   ACA — Added 'static-pos' SledTether kind (sled tied to a world XZ point).
//   ACC — B1 Phase 2: lifted the rope vocabulary to a general Tether {a, b}
//        shape so any two endpoint kinds can be wired up symmetrically.
//        Sled is still currently always one of the two endpoints in the
//        existing game flows; this refactor positions for future kinds
//        (raider corpse, sandworm carcass, world anchor stake, free
//        pickup) without re-architecting then.
//
// Convention (sled cases): when a Sled is tethered, by convention `b` is
// the sled endpoint and `a` is the other ("anchor") end. updateSleds
// resolves `a` to a world point and applies the inextensible-rope
// constraint to keep the sled within SLED_TOW_DISTANCE of `a`.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { getPlayerPos } from '../util/playerPos.ts';

/** All endpoint kinds a rope can attach to.
 *
 *  ACE (B1 Phase 3) added: `stake` (craftable persistent anchor).
 *  ACF (B1 Phase 3 follow-up) added: `raider_corpse`, `sandworm_carcass`
 *  (lasso a kill and drag it on foot or behind a sled). Unlike the anchor
 *  kinds above, these reference TOWED bodies — the rope drags them rather
 *  than being anchored by them. The constraint owner picks which end is
 *  driven (see ropeConstraint.ts). */
export type RopeEndpoint =
  | { kind: 'none' }
  | { kind: 'player' }
  | { kind: 'speeder' }
  | { kind: 'companion' }
  | { kind: 'sled'; sledId: number }
  | { kind: 'static-pos'; x: number; z: number }
  | { kind: 'stake'; stakeId: number }
  | { kind: 'raider_corpse'; raiderId: number }
  | { kind: 'sandworm_carcass'; wormId: number };

/** A rope: two endpoints + the implicit physics behavior (inextensible
 *  constraint enforced by updateSleds for any tether where at least one
 *  end is a sled). For purely non-sled tethers (future: corpse-to-stake,
 *  pickup-to-pickup), a different system will own the constraint — the
 *  Tether structure itself is data-only. */
export interface Tether {
  a: RopeEndpoint;
  b: RopeEndpoint;
}

/** Convenience constructor — { kind: 'none' } pair, used as the default
 *  "untethered" state on the sled. */
export const NO_TETHER: Tether = {
  a: { kind: 'none' },
  b: { kind: 'none' },
};

/** Resolve the world-space position of a rope endpoint. Returns null if
 *  the endpoint's resource is gone (e.g., 'sled' kind references a sled
 *  id that's no longer in ctx.sleds.list, or 'companion' kind when
 *  ctx.companion is null because the player picked it back into a pod).
 *  Caller (typically updateSleds) treats null as a signal to auto-detach
 *  the rope. */
const _resolveTmp = new THREE.Vector3();
export function resolveEndpointWorldPos(
  ctx: GameContext, endpoint: RopeEndpoint,
): { x: number; y: number; z: number } | null {
  switch (endpoint.kind) {
    case 'none':
      return null;
    case 'player': {
      // Hip-height behind the capsule (-0.2m down so rope drops to belt
      // height, not the eye-level the camera lives at). Mounted-aware
      // via the shared getPlayerPos helper (returns speeder body when
      // the player is riding).
      const p = getPlayerPos(ctx);
      return { x: p.x, y: p.y - 0.2, z: p.z };
    }
    case 'speeder': {
      const s = ctx.speeder;
      if (!s) return null;
      s.towBar.getWorldPosition(_resolveTmp);
      return { x: _resolveTmp.x, y: _resolveTmp.y, z: _resolveTmp.z };
    }
    case 'companion': {
      const c = ctx.companion;
      if (!c) return null;
      // Companion's pos is at ground level; tether anchor is +0.3m for
      // a natural back-top attachment.
      return { x: c.pos.x, y: c.pos.y + 0.3, z: c.pos.z };
    }
    case 'sled': {
      const sled = ctx.sleds.list.find((s) => s.id === endpoint.sledId);
      if (!sled) return null;
      // Sled's rope-stub attach point is at the FRONT (local -Z) of the
      // body, lifted to the welded yoke crossbar height. Same math as
      // updateSleds' sled-attach computation so both ends of the rope
      // agree on where the sled-side endpoint lives.
      const yaw = sled.group.rotation.y;
      const fwdX = -Math.sin(yaw);
      const fwdZ = -Math.cos(yaw);
      const tr = sled.body.translation();
      return {
        x: tr.x + fwdX * Tuning.SLED_HALF_EXTENTS_Z,
        y: tr.y + 0.20,
        z: tr.z + fwdZ * Tuning.SLED_HALF_EXTENTS_Z,
      };
    }
    case 'static-pos': {
      // Sand-staked endpoint. Sit on terrain + 0.4m so the rope reads
      // as draped over a knee-high stake rather than buried in sand.
      const sy = ctx.terrain.heightAt(endpoint.x, endpoint.z);
      return { x: endpoint.x, y: sy + 0.4, z: endpoint.z };
    }
    case 'stake': {
      // ACE — craftable iron stake. The rope-loop on the stake visual
      // sits ~55cm above terrain after Round-2 polish (taller shaft).
      // Caller doesn't need to know the exact rope-loop offset — we
      // resolve it from the stake's pos.
      const stake = ctx.stakes.list.find((s) => s.id === endpoint.stakeId);
      if (!stake) return null;
      return { x: stake.pos.x, y: stake.pos.y + 0.55, z: stake.pos.z };
    }
    case 'raider_corpse': {
      // ACF — a downed raider. Attach at the body center, lifted to
      // belt height so the rope reads as cinched around the torso of a
      // body lying on the sand. Returns null if the raider is gone
      // (despawned), signalling the caller to auto-detach.
      const r = ctx.raiders.find((rr) => rr.id === endpoint.raiderId);
      if (!r) return null;
      const tr = r.body.translation();
      return { x: tr.x, y: tr.y + 0.2, z: tr.z };
    }
    case 'sandworm_carcass': {
      // ACF — a slain worm carcass. basePos is the body center (mid-point
      // along its length); the carcass lies on the surface after the
      // death pose, so a modest lift puts the rope on top of the hide
      // rather than buried in it. Returns null if the worm is gone.
      const w = ctx.sandWorms.list.find((ww) => ww.id === endpoint.wormId);
      if (!w) return null;
      return { x: w.basePos.x, y: w.basePos.y + 1.0, z: w.basePos.z };
    }
  }
}

/** For a Tether where one endpoint is a Sled, return the OTHER endpoint
 *  (the "anchor"). Returns null if neither side is a sled or both are. */
export function otherEndOfSledTether(
  tether: Tether, sledId: number,
): RopeEndpoint | null {
  const aIsSled = tether.a.kind === 'sled' && tether.a.sledId === sledId;
  const bIsSled = tether.b.kind === 'sled' && tether.b.sledId === sledId;
  if (aIsSled && !bIsSled) return tether.b;
  if (bIsSled && !aIsSled) return tether.a;
  return null;
}

/** True if a tether has a 'none' on either side (i.e., it's not fully
 *  attached at both ends — typically because the sled tether was cleared). */
export function tetherIsDetached(tether: Tether): boolean {
  return tether.a.kind === 'none' || tether.b.kind === 'none';
}
