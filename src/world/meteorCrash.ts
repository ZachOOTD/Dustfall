// ACBE (D1) — SKYFALL: the crashing-wreck hero event. A burning wreck streaks across
// the sky on a descending arc, then CRASHES into the desert — flash, shockwave, dust
// plume, ejecta, camera shake, and a flash-then-delayed sonic boom — leaving a fire +
// smoke column. (Replaces the C34 sky-only fireball.)
//
// Tier 1 = the SPECTACLE (this file): flight → impact FX → a placeholder fire/smoke at
// the landing. Tier 2 swaps the placeholder for the full crater + enterable wreck + a
// persistent beacon + loot; Tier 4 persists it. The wreck-model + role drive later tiers
// (the role is rolled + stored now so save/replay is deterministic).
//
// Reuses: particleTrail.ts (fire/smoke/ejecta pools), fx/cameraShake + fx/screenFlash,
// fire.ts spawnFireAt, player/effectivePos getPlayerWorldPos, audio.ts crash synth.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { getPlayerWorldPos } from '../player/effectivePos.ts';
import { spawnFireAt } from './fire.ts';
import { addTrauma } from '../fx/cameraShake.ts';
import { flashScreen, updateScreenFlash } from '../fx/screenFlash.ts';
import { playCrashImpact } from '../audio/audio.ts';
import {
  createParticleTrail, emitParticle, emitBurst, updateParticleTrail,
  type ParticleTrail,
} from './particleTrail.ts';
import { placeProcgenPOI } from './poiAssembler.ts';   // Tier 2/3 — the enterable crash_husk wreck
import { setCrashDressRole } from './poiArchetypes.ts';   // Tier 3 — role-driven interior dressing
import { generateCrashLog } from './crashLog.ts';          // Tier 3 — procedural black-box log
import { placeJournal, type Journal } from './journal.ts';
import { spawnScrapAt, spawnRelicAt, type Pickup } from '../pickups/pickups.ts';   // Tier 3 — fresh-crash spilled loot
import { markSalvageStripped, type Salvageable } from './salvage.ts';   // Tier 4 — restore stripped salvage state
import type RAPIER from '@dimforge/rapier3d-compat';
import { makeRng } from '../core/rng.ts';

export type CrashRole = 'freighter' | 'liner' | 'military' | 'science' | 'mining';
const ROLES: CrashRole[] = ['freighter', 'liner', 'military', 'science', 'mining'];

interface ActiveCrash {
  seed: number;
  role: CrashRole;
  origin: THREE.Vector3;
  impact: THREE.Vector3;
  t: number;             // 0..1 flight progress
  flightS: number;
  impacted: boolean;
  boomDelay: number;     // s after impact the sound arrives (dist / speed-of-sound)
  boomTimer: number;
  ringT: number;         // shockwave ring progress (>=0 once impacted)
  finished: boolean;     // FSM fully done (FX faded) — ready to clear
}

let _scene: THREE.Scene | null = null;
let _crash: ActiveCrash | null = null;
let _nextAt: number = Tuning.CRASH_MIN_INTERVAL;

// Visual assets (built once, reused).
let _glowTex: THREE.Texture | null = null;
let _headGroup: THREE.Group | null = null;
let _headCore: THREE.Sprite | null = null;
let _headHalo: THREE.Sprite | null = null;
let _chunk: THREE.Mesh | null = null;         // the dark burning wreck silhouette at the head
let _ring: THREE.Mesh | null = null;          // ground shockwave ring
let _fireTrail: ParticleTrail | null = null;  // additive orange fire
let _smokeTrail: ParticleTrail | null = null; // alpha dark smoke (rises)
let _ejecta: ParticleTrail | null = null;     // debris/dust thrown at impact (falls)

// ── Tier 2: landed crash SITES (the explorable destinations) + a persistent beacon. ──
interface CrashSite { pos: THREE.Vector3; seed: number; role: CrashRole; wreck: THREE.Group; decor: THREE.Group; journal: Journal; cache: Pickup[]; body: RAPIER.RigidBody | null; salvage: Salvageable | null; age: number; }
interface CrashRestore { ageS: number; salvageStripped: boolean; salvageRemaining: number; }
/** Save record for one landed crash — enough to reproduce it deterministically on load (Tier 4). */
export interface SavedCrash { seed: number; role: CrashRole; pos: { x: number; y: number; z: number }; ageS: number; salvageStripped: boolean; salvageRemaining: number; }
const _sites: CrashSite[] = [];
let _beacon: ParticleTrail | null = null;     // shared persistent smoke-column beacon (outlives the fires)
let _embers: ParticleTrail | null = null;     // Tier 4 (E) — warm rising embers off a FRESH burning site (fade with the fires)
const _scorchMat = new THREE.MeshLambertMaterial({ color: 0x130d09, transparent: true, opacity: 0.85, depthWrite: false });
const _ejectaMat = new THREE.MeshLambertMaterial({ color: 0x271d14, flatShading: true });

function glowTexture(): THREE.Texture {
  if (_glowTex) return _glowTex;
  const W = 64;
  const c = document.createElement('canvas');
  c.width = W; c.height = W;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,238,205,0.92)');
  grd.addColorStop(0.7, 'rgba(255,150,70,0.4)');
  grd.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, W);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return (_glowTex = tex);
}

export function initMeteorCrash(scene: THREE.Scene): void {
  _scene = scene;
  const tex = glowTexture();

  _headHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color: 0xffae6a, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, fog: false,
  }));
  _headCore = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color: 0xfff4e6, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, fog: false,
  }));
  // The burning wreck silhouette — a small dark chunk inside the glow that tumbles, so
  // the head reads as a falling WRECK, not just a meteor.
  _chunk = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshBasicMaterial({ color: 0x140d08, fog: false }),
  );
  _chunk.scale.set(2.0, 1.3, 2.6);
  _headGroup = new THREE.Group();
  _headGroup.add(_headHalo, _headCore, _chunk);
  _headGroup.visible = false;
  _headGroup.renderOrder = 4;
  scene.add(_headGroup);

  // Ground shockwave ring — flat, expands + fades at impact.
  _ring = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 1.0, 48),
    new THREE.MeshBasicMaterial({
      color: 0xbfa37a, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, fog: false,
    }),
  );
  _ring.rotation.x = -Math.PI / 2;
  _ring.visible = false;
  _ring.renderOrder = 2;
  scene.add(_ring);

  _fireTrail = createParticleTrail(scene, { count: 220, color: 0xff8c1a, opacity: 0.95, gravity: 0, renderOrder: 3 });
  (_fireTrail.points.material as THREE.ShaderMaterial).blending = THREE.AdditiveBlending;
  _smokeTrail = createParticleTrail(scene, { count: 340, color: 0x35302b, opacity: 0.5, gravity: -0.35, renderOrder: 2 });
  _ejecta = createParticleTrail(scene, { count: 90, color: 0x6a5a46, opacity: 0.7, gravity: 9.0, renderOrder: 2 });
  _beacon = createParticleTrail(scene, { count: 300, color: 0x47423a, opacity: 0.5, gravity: -0.45, renderOrder: 2 });
  _embers = createParticleTrail(scene, { count: 180, color: 0xff7e2e, opacity: 0.95, gravity: -0.5, renderOrder: 3 });
  (_embers.points.material as THREE.ShaderMaterial).blending = THREE.AdditiveBlending;
}

/** Roll an impact point in the band around the player + a high-sky origin behind it. */
function planArc(ctx: GameContext, x?: number, z?: number): ActiveCrash {
  const p = getPlayerWorldPos(ctx);
  const ang = Math.random() * Math.PI * 2;
  const dist = Tuning.CRASH_IMPACT_DIST_MIN + Math.random() * (Tuning.CRASH_IMPACT_DIST_MAX - Tuning.CRASH_IMPACT_DIST_MIN);
  const ix = x ?? p.x + Math.cos(ang) * dist;
  const iz = z ?? p.z + Math.sin(ang) * dist;
  const iy = ctx.terrain.heightAt(ix, iz);
  const impact = new THREE.Vector3(ix, iy, iz);
  // The wreck enters from a random heading, descending ~34° (horizRun ≈ 1.5×alt).
  const heading = Math.random() * Math.PI * 2;
  const alt = Tuning.CRASH_START_ALT;
  const horizRun = alt * 1.5;
  const origin = new THREE.Vector3(
    ix - Math.cos(heading) * horizRun,
    iy + alt,
    iz - Math.sin(heading) * horizRun,
  );
  const seed = Math.floor(Math.random() * 1e9);
  return {
    seed, role: ROLES[seed % ROLES.length],
    origin, impact, t: 0, flightS: Tuning.CRASH_FLIGHT_S,
    impacted: false, boomDelay: 0, boomTimer: 0, ringT: -1, finished: false,
  };
}

/** Begin an ambient crash (random impact near the player). */
export function spawnCrash(ctx: GameContext): { x: number; z: number; role: CrashRole } | null {
  if (!_scene || _crash) return null;
  _crash = planArc(ctx);
  if (_headGroup) _headGroup.visible = true;
  return { x: _crash.impact.x, z: _crash.impact.z, role: _crash.role };
}

/** DEV — force a crash, optionally at (x,z). */
export function triggerCrash(ctx: GameContext, x?: number, z?: number): { x: number; z: number; role: CrashRole } | null {
  if (!_scene) return null;
  _crash = planArc(ctx, x, z);
  if (_headGroup) _headGroup.visible = true;
  return { x: _crash.impact.x, z: _crash.impact.z, role: _crash.role };
}

/** DEV/headless — step the active crash FSM deterministically by `seconds` (in `substeps`
 *  sub-steps so the trail builds + ages like the live sim, which runs slow headless). Pair
 *  with ctx.flags.paused = true so the main tick doesn't ALSO advance it. Decays the screen
 *  flash alongside so a captured post-impact frame isn't washed white. */
export function advanceCrash(ctx: GameContext, seconds: number, substeps = 40): void {
  const dt = seconds / Math.max(1, substeps);
  // No _crash guard: keep ticking past the FSM's end so the settled-site beacon builds too.
  for (let i = 0; i < substeps; i++) {
    updateMeteorCrash(ctx, dt);
    updateScreenFlash(ctx, dt);
  }
}

export function crashState(): { active: boolean; t: number; impacted: boolean; role: CrashRole | null; headPos: [number, number, number] | null } {
  const hp = (_crash && !_crash.impacted && _headGroup) ? _headGroup.position : null;
  return {
    active: !!_crash, t: _crash?.t ?? 0, impacted: _crash?.impacted ?? false,
    role: _crash?.role ?? null,
    headPos: hp ? [hp.x, hp.y, hp.z] : null,
  };
}

export function resetMeteorCrash(ctx: GameContext): void {
  _crash = null;
  _nextAt = Tuning.CRASH_MIN_INTERVAL;
  if (_headGroup) _headGroup.visible = false;
  if (_ring) { _ring.visible = false; (_ring.material as THREE.MeshBasicMaterial).opacity = 0; }
  // Fully tear down every runtime crash site — visuals, the Rapier body, and the journal /
  // cache / salvage REGISTRY entries — so a new-game or a load (which re-spawns saved crashes)
  // starts clean with no leaked colliders or stale interactables.
  const splice = <T>(list: T[], item: T | null) => { if (!item) return; const i = list.indexOf(item); if (i >= 0) list.splice(i, 1); };
  for (const s of _sites) {
    ctx.three.scene.remove(s.wreck); ctx.three.scene.remove(s.decor); ctx.three.scene.remove(s.journal.mesh);
    for (const p of s.cache) ctx.three.scene.remove(p.mesh);
    if (s.body) ctx.physics.world.removeRigidBody(s.body);
    splice(ctx.journals.list, s.journal);
    splice(ctx.salvageables.list, s.salvage);
    for (const p of s.cache) splice(ctx.pickups.list, p);
  }
  _sites.length = 0;
  for (const trail of [_beacon, _embers]) {
    if (!trail) continue;
    for (let i = 0; i < trail.count; i++) {
      trail.particles[i].active = false;
      trail.positions[i * 3 + 1] = -10000;
      trail.alphas[i] = 0;
    }
    trail.geo.attributes.position.needsUpdate = true;
    trail.geo.attributes.alpha.needsUpdate = true;
  }
}

const _v = new THREE.Vector3();

/** Build the full crash SITE at `pos` (deterministic from `seed`): the role-dressed enterable
 *  wreck, a scorch disc + ejecta, fires, the black-box log, and (fresh only) spilled loot.
 *  `restore` (set on a save-load re-spawn) ages the fires, re-applies the saved salvage state,
 *  and skips the one-time spilled cache. The rng stream is consumed identically fresh-vs-restore
 *  up to the black box so its position is stable across reloads. */
function land(ctx: GameContext, seed: number, role: CrashRole, pos: THREE.Vector3, restore?: CrashRestore): void {
  const rng = makeRng(seed);   // independent stream — never perturbs the seeded world scatter
  setCrashDressRole(role);

  const nSalvBefore = ctx.salvageables.list.length;
  const wreck = placeProcgenPOI(
    ctx.three.scene, ctx.physics.world, ctx.terrain, pos, rng, ctx.salvageables,
    { archetype: 'crash_husk', buryY: Tuning.CRASH_WRECK_BURY },
  );
  const body = (wreck.userData.poiBody as RAPIER.RigidBody | undefined) ?? null;
  const salvage = ctx.salvageables.list[nSalvBefore] ?? null;   // the crash's salvage panel
  if (restore && salvage) {   // re-apply the saved loot state to the freshly-registered panel
    salvage.salvageRemaining = restore.salvageRemaining;
    if (restore.salvageStripped) markSalvageStripped(salvage);
  }

  // Scorch + ejecta in their own group (so reset can drop the whole site's decor cleanly).
  const decor = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(Tuning.CRASH_SCORCH_RADIUS, 32), _scorchMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(pos.x, pos.y + 0.05, pos.z);
  disc.renderOrder = 1;
  decor.add(disc);
  for (let i = 0; i < Tuning.CRASH_EJECTA_CHUNKS; i++) {
    const a = rng() * Math.PI * 2;
    const rr = Tuning.CRASH_SCORCH_RADIUS * (0.55 + rng() * 1.05);
    const fx = pos.x + Math.cos(a) * rr, fz = pos.z + Math.sin(a) * rr;
    const fy = ctx.terrain.heightAt(fx, fz);
    const s = 0.45 + rng() * 0.8;
    const chunk = new THREE.Mesh(new THREE.BoxGeometry(s * (1 + rng() * 0.8), s * 0.5, s * (1 + rng() * 0.8)), _ejectaMat);
    chunk.position.set(fx, fy + s * 0.1, fz);
    chunk.rotation.set(rng() * 3, rng() * 6, rng() * 3);
    chunk.castShadow = true; chunk.receiveShadow = true;
    decor.add(chunk);
  }
  ctx.three.scene.add(decor);

  // Fires — FRESH only. The crash's fires live in ctx.fires, which the generic fire system
  // saves + restores (with their real burned-down fuel). So a RESTORE must NOT re-spawn them —
  // that would duplicate the already-restored save.fires. The rng draws (a/rr/fuel) are consumed
  // identically either way so the black-box position (rolled AFTER, below) is stable across reloads.
  for (let i = 0; i < Tuning.CRASH_FIRES; i++) {
    const a = rng() * Math.PI * 2;
    const rr = i === 0 ? 0 : Tuning.CRASH_SCORCH_RADIUS * 0.32 * rng();
    const fuel = Tuning.CRASH_FIRE_FUEL_S * (0.7 + rng() * 0.6);
    if (!restore) {
      const fx = pos.x + Math.cos(a) * rr, fz = pos.z + Math.sin(a) * rr;
      spawnFireAt(ctx, new THREE.Vector3(fx, ctx.terrain.heightAt(fx, fz), fz), fuel, true);
    }
  }

  // The black-box recorder inside the wreck — a procedural final log (kept OUT of the merge so
  // it stays interactable). Its position uses rng AFTER the fires — hence the alignment above.
  const bx = pos.x + (rng() - 0.5) * 2.2, bz = pos.z + (rng() - 0.5) * 2.2;
  const journal = placeJournal(
    ctx.three.scene, new THREE.Vector3(bx, ctx.terrain.heightAt(bx, bz) + 0.04, bz),
    rng() * Math.PI * 2, 'crash_log', generateCrashLog(seed, role),
  );
  ctx.journals.list.push(journal);

  // Fresh-crash SPILLED LOOT — the one-time grab reward (the rich 'massive' salvage PANEL is the
  // bulk reward). Only on a FRESH crash; a restored site doesn't re-scatter it. It's the LAST rng
  // consumer, so skipping it on restore desyncs nothing above. Static (body=null) → save ignores.
  const cache: Pickup[] = [];
  if (!restore) {
    const nScrap = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < nScrap; i++) {
      const a = rng() * Math.PI * 2, rr = 1.5 + rng() * (Tuning.CRASH_SCORCH_RADIUS - 1.5);
      cache.push(spawnScrapAt(ctx.three.scene, ctx.terrain, pos.x + Math.cos(a) * rr, pos.z + Math.sin(a) * rr, rng, ctx.pickups.list));
    }
    if (role === 'science' || rng() < 0.25) {
      const a = rng() * Math.PI * 2;
      cache.push(spawnRelicAt(ctx.three.scene, ctx.terrain, pos.x + Math.cos(a) * 1.6, pos.z + Math.sin(a) * 1.6, rng, ctx.pickups.list));
    }
  }

  _sites.push({ pos: pos.clone(), seed, role, wreck, decor, journal, cache, body, salvage, age: restore?.ageS ?? 0 });
}

/** Fresh crash from the impact. */
function landCrashAt(ctx: GameContext, c: ActiveCrash): void {
  land(ctx, c.seed, c.role, c.impact.clone());
}

/** Tier 4 — serialize landed sites for the save (enough to reproduce each deterministically). */
export function serializeCrashes(): SavedCrash[] {
  return _sites.map((s) => ({
    seed: s.seed, role: s.role,
    pos: { x: s.pos.x, y: s.pos.y, z: s.pos.z },
    ageS: s.age,
    salvageStripped: s.salvage?.stripped ?? false,
    salvageRemaining: s.salvage?.salvageRemaining ?? 0,
  }));
}

/** Tier 4 — re-spawn saved crash sites on load (call AFTER resetMeteorCrash cleared any
 *  in-session sites + the world-gen salvage was restored). Deterministic from each seed. */
export function restoreCrashes(ctx: GameContext, saved: ReadonlyArray<SavedCrash>): void {
  for (const sc of saved) {
    land(ctx, sc.seed, sc.role, new THREE.Vector3(sc.pos.x, sc.pos.y, sc.pos.z),
      { ageS: sc.ageS, salvageStripped: sc.salvageStripped, salvageRemaining: sc.salvageRemaining });
  }
}

// Tier 4 — load order: onContinue runs loadGameState (stash here) THEN handoffToGame (whose
// resetMeteorCrash clears in-session sites). So we CAN'T restore inside loadGameState — it'd be
// wiped. loadGameState stashes the saved crashes; main.ts applies them right AFTER the handoff.
let _pendingRestore: SavedCrash[] = [];
export function setPendingCrashRestore(saved: SavedCrash[]): void { _pendingRestore = saved; }
export function applyPendingCrashRestore(ctx: GameContext): void {
  const p = _pendingRestore;
  _pendingRestore = [];
  if (p.length) restoreCrashes(ctx, p);
}

/** Tier 4 (C) — how hard the player is being BAKED by nearby still-burning crash wreck(s):
 *  0 = clear, 1 = standing in the heart of a FRESH blaze. Falls off with horizontal distance to
 *  the wreck centre and as the fires gutter out over CRASH_FIRE_FUEL_S. survival.ts turns this
 *  into a temperature push toward heatstroke. Site-based (not per-fire) so it survives save/load. */
export function crashHeatAt(ctx: GameContext): number {
  if (!_sites.length) return 0;
  const p = getPlayerWorldPos(ctx);
  let best = 0;
  for (const s of _sites) {
    const burn = 1 - s.age / Tuning.CRASH_FIRE_FUEL_S;   // fires gutter out over the fuel window
    if (burn <= 0) continue;
    const dx = p.x - s.pos.x, dz = p.z - s.pos.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= Tuning.CRASH_HEAT_RADIUS) continue;
    const h = (1 - d / Tuning.CRASH_HEAT_RADIUS) * burn;   // prox (1 at centre) × burn
    if (h > best) best = h;
  }
  return best;
}

/** Per-frame: emit the tall smoke-column beacon from each active site (thins over its life,
 *  but outlives the fires so the site stays findable). Runs whether or not a crash is in the
 *  air. */
function updateBeacons(_ctx: GameContext, dt: number): void {
  if (!_beacon) return;
  for (const s of _sites) {
    s.age += dt;
    const fade = 1 - s.age / Tuning.CRASH_BEACON_LIFE_S;
    if (fade <= 0) continue;
    const n = Math.max(1, Math.round(Tuning.CRASH_BEACON_RATE * dt));
    for (let i = 0; i < n; i++) {
      const sway = (Math.random() - 0.5) * 1.4;
      emitParticle(_beacon, {
        x: s.pos.x + (Math.random() - 0.5) * 1.5, y: s.pos.y + 2.0, z: s.pos.z + (Math.random() - 0.5) * 1.5,
        vx: sway, vy: Tuning.CRASH_BEACON_RISE * (0.8 + Math.random() * 0.5), vz: sway,
        life: 6.5 * (0.7 + Math.random() * 0.6), size: (5 + Math.random() * 5) * (0.5 + fade * 0.5),
      });
    }
    // Tier 4 (E) — warm rising EMBERS while the wreck still burns (fade out with the fires over
    // CRASH_FIRE_FUEL_S) — sells a FRESH, still-hot crash + telegraphs the interior heat hazard.
    const burn = 1 - s.age / Tuning.CRASH_FIRE_FUEL_S;
    if (_embers && burn > 0) {
      const want = Tuning.CRASH_EMBER_RATE * dt * burn;
      let en = Math.floor(want);
      if (Math.random() < want - en) en++;
      for (let i = 0; i < en; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 2.2;
        emitParticle(_embers, {
          x: s.pos.x + Math.cos(a) * r, y: s.pos.y + 0.4 + Math.random() * 1.4, z: s.pos.z + Math.sin(a) * r,
          vx: (Math.random() - 0.5) * 0.9, vy: 1.6 + Math.random() * 2.8, vz: (Math.random() - 0.5) * 0.9,
          life: 1.0 + Math.random() * 1.3, size: (0.3 + Math.random() * 0.45) * (0.6 + burn * 0.6),
        });
      }
    }
  }
  updateParticleTrail(_beacon, dt);
  if (_embers) updateParticleTrail(_embers, dt);
}

/** Landed crash sites (for the dev panel + Tier-4 save). */
export function crashSites(): ReadonlyArray<{ x: number; z: number; role: CrashRole; ageS: number }> {
  return _sites.map((s) => ({ x: s.pos.x, z: s.pos.z, role: s.role, ageS: s.age }));
}

function onImpact(ctx: GameContext, c: ActiveCrash): void {
  c.impacted = true;
  c.ringT = 0;
  const p = getPlayerWorldPos(ctx);
  const dist = Math.hypot(c.impact.x - p.x, c.impact.z - p.z);
  // Proximity 1 at the near edge of the band → ~0.25 at the far edge.
  const prox = THREE.MathUtils.clamp(1 - (dist - Tuning.CRASH_IMPACT_DIST_MIN) /
    (Tuning.CRASH_IMPACT_DIST_MAX - Tuning.CRASH_IMPACT_DIST_MIN), 0.2, 1);

  flashScreen(0xfff0dc, Tuning.CRASH_FLASH_STRENGTH * prox);
  addTrauma(Tuning.CRASH_SHAKE_TRAUMA * prox);

  // Dust mushroom plume (slow, rises) + debris ejecta (fast, radial, falls).
  if (_smokeTrail) emitBurst(_smokeTrail, c.impact.x, c.impact.y + 1, c.impact.z, Tuning.CRASH_PLUME_COUNT,
    { speed: 5, up: 8.5, life: 3.6, size: 7, posJitter: 3.2 });   // Tier 4 E — taller, fuller mushroom
  if (_ejecta) emitBurst(_ejecta, c.impact.x, c.impact.y + 0.5, c.impact.z, Tuning.CRASH_EJECTA_COUNT,
    { speed: 18, up: 11, life: 1.7, size: 1.3, posJitter: 1.5 });   // Tier 4 E — more violent fan

  // Build the full crash SITE (wreck + scorch + ejecta + fires + a persistent beacon).
  landCrashAt(ctx, c);

  // Flash-then-boom: the sound arrives after dist / speed-of-sound.
  c.boomDelay = dist / Tuning.CRASH_SOUND_SPEED;
  c.boomTimer = 0;
}

/** Per-frame FSM. Cheap no-op when idle (just the ambient timer). */
export function updateMeteorCrash(ctx: GameContext, dt: number): void {
  if (!_scene) return;
  updateBeacons(ctx, dt);   // landed-site beacons persist independent of any in-flight crash

  // Ambient cadence — arm a rare crash when none is active.
  if (!_crash) {
    if (ctx.time.elapsed >= _nextAt) {
      spawnCrash(ctx);
      _nextAt = ctx.time.elapsed + Tuning.CRASH_MIN_INTERVAL +
        Math.random() * (Tuning.CRASH_MAX_INTERVAL - Tuning.CRASH_MIN_INTERVAL);
    }
    return;
  }
  const c = _crash;
  const dayCore = (ctx.time.sunHeight ?? 0) > 0;

  // ── Flight ──
  if (!c.impacted) {
    c.t = Math.min(1, c.t + dt / c.flightS);
    const e = c.t * c.t;   // ease-in: accelerates toward the ground (gravity feel)
    _v.lerpVectors(c.origin, c.impact, e);
    if (_headGroup) {
      _headGroup.position.copy(_v);
      // Brighten as it nears + a fast flicker.
      const flick = 0.85 + 0.15 * Math.sin(ctx.time.elapsed * 47);
      const near = 0.6 + 0.4 * c.t;
      const hs = Tuning.CRASH_HEAD_SCALE;
      if (_headCore) {
        _headCore.scale.setScalar(hs * 0.5 * near);
        (_headCore.material as THREE.SpriteMaterial).color.setHex(dayCore ? 0xfffceb : 0xffe6cc);
        (_headCore.material as THREE.SpriteMaterial).opacity = flick;
      }
      if (_headHalo) {
        _headHalo.scale.setScalar(hs * near);
        (_headHalo.material as THREE.SpriteMaterial).opacity = 0.8 * flick;
      }
      if (_chunk) {
        _chunk.rotation.x += dt * 5; _chunk.rotation.z += dt * 3.3;
        _chunk.scale.setScalar(hs * 0.06 * near);
      }
    }
    // Emit the 3-layer trail at the head along the arc.
    const n = Math.max(1, Math.round(Tuning.CRASH_TRAIL_EMIT_HZ * dt));
    for (let i = 0; i < n; i++) {
      if (_fireTrail) emitParticle(_fireTrail, {
        x: _v.x, y: _v.y, z: _v.z,
        vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, vz: (Math.random() - 0.5) * 5,
        life: Tuning.CRASH_TRAIL_FIRE_LIFE * (0.6 + Math.random() * 0.6), size: 8 + Math.random() * 10,
      });
      if (_smokeTrail) emitParticle(_smokeTrail, {
        x: _v.x, y: _v.y, z: _v.z,
        vx: (Math.random() - 0.5) * 2.5, vy: 0.5 + Math.random(), vz: (Math.random() - 0.5) * 2.5,
        life: Tuning.CRASH_TRAIL_SMOKE_LIFE * (0.6 + Math.random() * 0.7), size: 11 + Math.random() * 12,
      });
    }
    if (c.t >= 1) onImpact(ctx, c);
  } else {
    // ── Settling: boom timer + shockwave ring; hide the head. ──
    if (_headGroup) _headGroup.visible = false;
    c.boomTimer += dt;
    if (c.boomTimer >= c.boomDelay && c.boomDelay >= 0) {
      const p = getPlayerWorldPos(ctx);
      playCrashImpact(Math.hypot(c.impact.x - p.x, c.impact.z - p.z));
      c.boomDelay = -1;   // fired
    }
    if (c.ringT >= 0 && _ring) {
      c.ringT += dt / Tuning.CRASH_SHOCKWAVE_S;
      if (c.ringT >= 1) {
        _ring.visible = false;
        (_ring.material as THREE.MeshBasicMaterial).opacity = 0;
        if (c.boomDelay < 0) c.finished = true;
      } else {
        const r = 1 + c.ringT * Tuning.CRASH_SHOCKWAVE_R;
        _ring.position.set(c.impact.x, c.impact.y + 0.1, c.impact.z);
        _ring.scale.set(r, r, r);
        _ring.visible = true;
        (_ring.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - c.ringT);
      }
    } else if (c.boomDelay < 0) {
      c.finished = true;
    }
  }

  if (_fireTrail) updateParticleTrail(_fireTrail, dt);
  if (_smokeTrail) updateParticleTrail(_smokeTrail, dt);
  if (_ejecta) updateParticleTrail(_ejecta, dt);

  if (c.finished) {
    _crash = null;
    _nextAt = Math.max(_nextAt, ctx.time.elapsed + Tuning.CRASH_MIN_INTERVAL);
  }
}
