// Debug handles attached to window.__game so MCP preview tools can poke state.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import { spawnRaider as spawnRaiderEntity, damageRaider } from '../enemies/raider.ts';
import { damageVulture } from '../enemies/vulture.ts';
import { makeLatheHull, fuselageProfile, makeFormerRings, makeBreach, makeSandMound } from '../world/wreckForms.ts';
import { createRustedHullMaterial } from '../world/hullMaterial.ts';
import { placeProcgenComposite, type ProcgenWreckClass } from '../world/procgenWreck.ts';
import { makeRng } from '../core/rng.ts';
import { Tuning } from '../config/tuning.ts';
import { resetTutorial, showControlsPanel } from '../ui/tutorial.ts';
import { getAudioStateSnapshot, type AudioStateSnapshot } from '../audio/soundscape.ts';
import { getMusicStateSnapshot, type MusicStateSnapshot } from '../audio/music.ts';
import { triggerStorm as triggerStormWeather } from '../world/weather.ts';
import { getItemDef } from '../inventory/items.ts';
import type { ItemId } from '../inventory/types.ts';
import { spawnDroppedPickup } from '../pickups/pickups.ts';   // ACAS B2 — dropTestItem dev hook
import { __craftChooserTest } from '../ui/craftingMenu.ts';   // ACAS B3 — chooser verification hook
import { __registerTestRecipe } from '../inventory/recipeDiscovery.ts';   // ACAS B3 — transient test-recipe injector

declare global {
  interface Window {
    __game?: DebugApi;
  }
}

interface DebugApi {
  setTime: (t: number) => void;
  setStats: (s: {
    thirst?: number;
    temperature?: number;
    hunger?: number;
    stamina?: number;
    health?: number;
  }) => void;
  state: () => {
    thirst: number;
    temperature: number;
    hunger: number;
    stamina: number;
    health: number;
    dayTime: number;
    playerDead: boolean;
  };
  ctx: GameContext;
  RAPIER: typeof RAPIER;
  castDown: (x: number, z: number, fromY?: number) => null | {
    hitY: number;
    timeOfImpact: number;
    colliderHandle: number;
    shape: number;
  };
  /** Trigger a sandstorm immediately for testing. */
  triggerStorm: () => void;
  /** ACAB (Cycle 6) — force the daytime cloud cover (0 clear … 1 overcast) for
   *  sky-shader iteration + the `sky` rig-shot scenario. Sets a hold that
   *  overrides the auto cloud-cover easing until cleared (pass < 0 to release). */
  setCloudiness: (v: number) => void;
  /** ACG (Cycle 1) — DEV-only: spawn a raider at world XZ (terrain Y
   *  auto-sampled) and register it in ctx.raiders. Raiders are dormant by
   *  design (D13 / Pillar 1) — this is a test affordance for exercising the
   *  ACF corpse-drag path, NOT a return of raiders as a world threat.
   *  Returns the new raider's id. */
  spawnRaider: (x: number, z: number) => number;
  /** ACG (Cycle 1) — DEV-only: kill a raider by id (drives the real death
   *  path → dead pose + corpse interaction tag), so the corpse-drag flow is
   *  testable without melee aiming. Returns true if a live raider matched. */
  killRaider: (id: number) => boolean;
  /** ACAI (T5) — DEV-only: kill a vulture by id (drives the real death path →
   *  dynamic-body tumble + lootable tag), so the death physics is testable
   *  without aiming. Returns true if a live (non-dead) vulture matched. */
  killVulture: (id: number) => boolean;
  /** ACAS (B2) — DEV-only: drop a dynamic-body pickup of `itemId` in front of the
   *  player so the per-item collider SHAPE (capsule/sphere/box) can be smoke-tested.
   *  Returns the new pickup id. */
  dropTestItem: (itemId: string) => number;
  /** ACAS (B3) — DEV-only: force the crafting input slots to a multiset + report the
   *  multi-match chooser state (button labels, craft-enabled). Verifies the chooser. */
  craftChooserTest: (items: Array<{ id: string; count: number }>) => { buttons: string[]; craftDisabled: boolean; label: string } | null;
  /** ACAS (B3) — DEV/TEST-only: inject a transient recipe colliding with scrap_bar
   *  so the multi-match chooser path can be exercised end-to-end. */
  injectTestRecipe: () => void;
  /** ACH (Cycle 2) — DEV-only: enter gameplay HEADLESS, bypassing the title
   *  button + pointer-lock. The normal handoff only clears `flags.paused` via
   *  the pointer-lock 'lock' event (input.ts), which never fires for an
   *  agent/preview click → the game renders the title-gone scene but never
   *  ticks. This runs the handoff side-effects + sets paused=false directly so
   *  the rAF loop ticks + renders. Pass dev=true to apply the DEV loadout
   *  first. Enables autonomous build→screenshot→critique on visual work. */
  enterGame: (dev?: boolean) => void;
  /** ACI (PM-Cycle A) — visual-audit "studio" for the player model. One call
   *  ensures headless gameplay (enterGame) + a 900×1100 canvas + 3P + EVEN
   *  studio lighting (ambient/key boosted + exposure ~2 — the in-game dusk
   *  hides rig detail). With no `angle`: enters + lights, leaves UNPAUSED so
   *  the rig settles at the body (call again with an angle after a beat).
   *  With an `angle`: pauses + frames that canonical view for a screenshot.
   *  The MVP-check verification loop (docs/feature-player-model.md) drives this. */
  rigStudio: (angle?: 'front' | 'back' | 'left' | 'right' | '3q' | 'head') => unknown;
  /** ACY — visual-audit "studio" for ITEM viewmodels. Builds the item's
   *  makeViewModel() mesh in ISOLATION (no rig/world clutter), suspends it high
   *  against the clean sky gradient, lights it for form (key/fill/ambient), and
   *  frames the chosen angle close enough to fill the frame. The item-detail
   *  pass (Lane 1) drives this via the `item-studio` rig-shot scenario. Pass an
   *  ItemId + angle; re-call to swap items/angles (prior mesh is removed). */
  itemStudio: (id: ItemId, angle?: 'front' | 'back' | 'left' | 'right' | 'top' | '3q') => unknown;
  /** ACAJ — visual-audit "studio" for the shared wreck-form toolkit primitives
   *  (`wreckForms.ts`). Builds a single form (lathe hull / former rings / breach /
   *  sand mound) in ISOLATION, suspends it against the clean sky, and frames the
   *  angle. Drives the `wreck-form` rig-shot scenario. */
  wreckFormStudio: (form: 'lathe' | 'formers' | 'breach' | 'mound', angle?: 'front' | 'side' | '3q' | 'top') => unknown;
  /** ACAO — DEV: spawn a procgen wreck of a chosen CLASS at a fixed clear
   *  anchor with a DETERMINISTIC seeded rng, named 'procgenWreckRig' so the
   *  headless framer (the `procgen-wreck` rig-shot scenario) can find + frame
   *  it. THE unblock for screenshot-verifying procgen visual work — procgen
   *  wrecks are otherwise unnamed + random-positioned, so no rig-shot could
   *  frame one (rule 8 killed the ACAN T5 breach attempt). Re-callable: removes
   *  the prior subject first. Deterministic (cls, seed) → the same wreck every
   *  run, so a before/after A/B of a visual change is comparable. Returns the
   *  spawned descendant mesh count (built-in before/after merge metric). */
  spawnProcgenWreckRig: (cls?: ProcgenWreckClass, seed?: number) => {
    cls: ProcgenWreckClass; seed: number; ok: boolean; meshes: number; pos: number[];
  };
  /** ACY — headless bury/occlusion audit for salvage panels. For each
   *  registered salvageable, raycasts inward along the panel's own outward
   *  axis against its wreck root; if the nearest hit is NOT the panel body
   *  (i.e. hull occludes it), the panel is buried inside the model → fail.
   *  Drives the `panels` rig-shot scenario's pass/fail assertion. */
  panelBuryAudit: () => { tested: number; pass: number; failCount: number; fails: Array<{ idx: number; kind: string; hit: string }> };
  /** Clear the tutorial localStorage flags so the controls panel + all
   *  pickup hints fire again. Refresh to see the first-boot overlay. */
  resetTutorial: () => void;
  /** Open the controls panel from the console — handy for screenshotting. */
  showControls: () => void;
  /** Per-stem audio gains + signal derivations. Null until first click unlocks
   *  audio. Use to tune sample-pack mix levels without re-running. */
  audioState: () => AudioStateSnapshot | null;
  /** AAP — per-track procedural music gains (day / storm / night).
   *  Null until first click unlocks audio. */
  musicState: () => MusicStateSnapshot | null;
}

/** Hooks main.ts supplies for actions that need its boot-scope closures
 *  (handoffToGame, applyDevLoadout, the title scene) which aren't reachable
 *  from here. */
export interface DebugHooks {
  enterGame?: (dev?: boolean) => void;
}

export function installDebugPanel(ctx: GameContext, hooks: DebugHooks = {}): void {
  // ACY item-studio state (lazily built on first itemStudio call).
  let studioGroup: THREE.Group | null = null;
  let studioMesh: THREE.Object3D | null = null;
  // ACAO — the live procgen-wreck framer subject (re-spawned per call).
  let procgenRigGroup: THREE.Group | null = null;

  window.__game = {
    setTime: (t) => { ctx.time.dayTime = t; },
    setStats: (s) => {
      if (s.thirst !== undefined) ctx.stats.thirst = s.thirst;
      if (s.temperature !== undefined) ctx.stats.temperature = s.temperature;
      if (s.hunger !== undefined) ctx.stats.hunger = s.hunger;
      if (s.stamina !== undefined) ctx.stats.stamina = s.stamina;
      if (s.health !== undefined) ctx.stats.health = s.health;
    },
    state: () => ({
      thirst: ctx.stats.thirst,
      temperature: ctx.stats.temperature,
      hunger: ctx.stats.hunger,
      stamina: ctx.stats.stamina,
      health: ctx.stats.health,
      dayTime: ctx.time.dayTime,
      playerDead: ctx.stats.dead,
    }),
    ctx,
    RAPIER,
    castDown(x, z, fromY = 100) {
      const ray = new RAPIER.Ray({ x, y: fromY, z }, { x: 0, y: -1, z: 0 });
      const hit = ctx.physics.world.castRay(ray, 500, true);
      if (!hit) return null;
      const hitY = fromY - hit.timeOfImpact;
      return {
        hitY,
        timeOfImpact: hit.timeOfImpact,
        colliderHandle: hit.collider.handle,
        shape: hit.collider.shape.type,
      };
    },
    setCloudiness(v) {
      if (v < 0) { ctx.weather.cloudinessHold = null; return; }
      ctx.weather.cloudinessHold = Math.max(0, Math.min(1, v));
      ctx.weather.cloudiness = ctx.weather.cloudinessHold;
    },
    triggerStorm() {
      // ACM fix: delegate to the real weather.triggerStorm, which ARMS the
      // sweeping wall (ACL D145 — intensity is wall-derived; the old inline
      // state-set left the wall dormant so a debug storm produced 0 intensity).
      triggerStormWeather(ctx);
    },
    spawnRaider(x, z) {
      const r = spawnRaiderEntity(
        ctx.three.scene, ctx.physics.world, ctx.terrain, ctx.assets,
        new THREE.Vector3(x, 0, z),
      );
      ctx.raiders.push(r);
      return r.id;
    },
    killRaider(id) {
      const r = ctx.raiders.find((rr) => rr.id === id);
      if (!r || r.bb.state === 'dead') return false;
      damageRaider(r, 9999, ctx);  // drives transitionTo('dead') + applyRaiderDeadPose
      return true;
    },
    killVulture(id) {
      const v = ctx.vultures.list.find((vv) => vv.id === id);
      if (!v || v.state === 'dead') return false;
      damageVulture(v, 9999, ctx);  // drives the dynamic-body tumble death (T5)
      return true;
    },
    dropTestItem(itemId) {
      // ACAS B2 — drop a dynamic-body pickup in front of the player to smoke-test
      // the per-item collider shape (capsule/sphere). Returns the new pickup id.
      const tr = ctx.player.body.body.translation();
      const p = spawnDroppedPickup(
        ctx.three.scene, ctx.terrain, { x: tr.x + 1.2, z: tr.z + 1.2 }, itemId as ItemId,
        undefined, { world: ctx.physics.world, initialVel: { x: 0, y: 1.0, z: 0 } },
      );
      ctx.pickups.list.push(p);
      return p.id;
    },
    craftChooserTest(items) {
      return __craftChooserTest(ctx, items as Array<{ id: ItemId; count: number }>);
    },
    injectTestRecipe() {
      // Register a transient recipe colliding with scrap_bar (scrap×2+branch×1) so
      // the multi-match chooser can be verified end-to-end.
      __registerTestRecipe({
        id: 9001, displayName: 'test alt', category: 'tool',
        inputs: [{ id: 'scrap', count: 2 }, { id: 'branch', count: 1 }],
        output: { id: 'scrap_bullet', count: 1 },
      });
    },
    enterGame(dev) {
      if (hooks.enterGame) hooks.enterGame(dev);
      else { ctx.flags.titleActive = false; ctx.flags.paused = false; }  // fallback
    },
    rigStudio(angle) {
      // enter + studio setup (idempotent)
      if (hooks.enterGame) hooks.enterGame(true);
      else { ctx.flags.titleActive = false; ctx.flags.paused = false; }
      const three = ctx.three;
      three.renderer.setSize(900, 1100, false);
      const cam = three.camera as THREE.PerspectiveCamera;
      if (cam.isPerspectiveCamera) { cam.aspect = 900 / 1100; cam.updateProjectionMatrix(); }
      ctx.flags.thirdPerson = true;
      three.scene.traverse((o) => {
        const l = o as THREE.Light;
        if (!l.isLight) return;
        if (l.type === 'AmbientLight') l.intensity = 2.2;
        else if (l.type === 'DirectionalLight' && l.intensity > 0) l.intensity = 2.4;
      });
      three.renderer.toneMappingExposure = 2.0;
      if (!angle) {
        return 'studio entered + lit (UNPAUSED to settle the rig — call rigStudio(angle) after a beat to frame)';
      }
      // frame a canonical angle (pause so the 3P sync stops overwriting the camera)
      ctx.flags.paused = true;
      const rig = ctx.player.rig;
      if (!rig) return { angle, framed: false, reason: 'no rig' };
      rig.group.updateMatrixWorld(true);
      const bp = ctx.player.body.body.translation();
      const fwd = new THREE.Vector3();
      rig.headGroup.getWorldDirection(fwd);
      fwd.y = 0;
      if (fwd.lengthSq() < 1e-4) fwd.set(1, 0, 0);
      fwd.normalize();
      // The head's +Z (getWorldDirection) now points TOWARD the face: PM-B.1
      // (ACI) rebuilt the hood with its opening + the bandana on +Z, flipping
      // the face from -Z to +Z. So we frame the +Z side directly (NO negate).
      // (D135 added a negate when the face was at -Z; PM-B.1 silently inverted
      // that, so every 'head'/'front' shot from ACI→ACJ showed the BACK until
      // PM-B.2 caught it empirically — the head is symmetric, so it didn't error.)
      const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const body = new THREE.Vector3(bp.x, bp.y - 0.05, bp.z);
      const D = 2.6, UP = 0.35;
      let camPos = new THREE.Vector3();
      let tgt = body.clone();
      if (angle === 'head') {
        const hp = new THREE.Vector3();
        rig.headGroup.getWorldPosition(hp);
        camPos = hp.clone().addScaledVector(fwd, 0.55).addScaledVector(side, 0.22);
        camPos.y += 0.05;
        tgt = new THREE.Vector3(hp.x, hp.y - 0.05, hp.z);
      } else if (angle === 'back') {
        camPos = body.clone().addScaledVector(fwd, -D); camPos.y += UP;
      } else if (angle === 'left') {
        camPos = body.clone().addScaledVector(side, D); camPos.y += UP;
      } else if (angle === 'right') {
        camPos = body.clone().addScaledVector(side, -D); camPos.y += UP;
      } else if (angle === '3q') {
        camPos = body.clone().addScaledVector(fwd, D * 0.8).addScaledVector(side, D * 0.6); camPos.y += UP;
      } else { // 'front'
        camPos = body.clone().addScaledVector(fwd, D); camPos.y += UP;
      }
      cam.position.copy(camPos);
      cam.lookAt(tgt);
      return { angle, framed: true };
    },
    itemStudio(id, angle) {
      // enter + headless render (idempotent), then suspend the item alone.
      if (hooks.enterGame) hooks.enterGame(true);
      else { ctx.flags.titleActive = false; ctx.flags.paused = false; }
      const three = ctx.three;
      three.renderer.setSize(900, 900, false);
      const cam = three.camera as THREE.PerspectiveCamera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1; cam.updateProjectionMatrix(); }
      three.renderer.toneMappingExposure = 1.45;
      ctx.flags.paused = true;
      // Hide the player rig so it never intrudes on the isolated item framing.
      if (ctx.player.rig) ctx.player.rig.group.visible = false;

      // Build the studio rig once (adding lights triggers one lightsHash
      // recompile — acceptable on this debug-only path).
      if (!studioGroup) {
        studioGroup = new THREE.Group();
        studioGroup.name = '__itemStudio';
        const key = new THREE.DirectionalLight(0xfff1dc, 2.6);
        key.position.set(2.5, 3.5, 2.0);       // raking top-right key for greebles
        const fill = new THREE.DirectionalLight(0xaec6ff, 0.85);
        fill.position.set(-2.2, 1.0, -1.4);    // cool back-fill
        const amb = new THREE.AmbientLight(0xffffff, 0.85);
        studioGroup.add(key, fill, amb);
        three.scene.add(studioGroup);
      }
      if (studioMesh) { studioGroup.remove(studioMesh); studioMesh = null; }

      const def = getItemDef(id);
      if (!def.makeViewModel) return { id, ok: false, reason: 'no makeViewModel' };
      const mesh = def.makeViewModel();

      // Anchor high above the player so the backdrop is pure sky gradient — no
      // terrain/wrecks behind the item.
      const bp = ctx.player.body.body.translation();
      // Suspend high in the sky so terrain/wrecks fall far outside the narrow
      // (≈0.6m) framing → pure sky-gradient backdrop on every angle.
      const anchor = new THREE.Vector3(bp.x, bp.y + 40, bp.z);
      mesh.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z, 0.04) * 0.5;
      mesh.position.sub(center).add(anchor);   // bbox center → anchor
      studioGroup.add(mesh);
      studioMesh = mesh;
      studioGroup.updateMatrixWorld(true);

      const dist = radius * 3.0 + 0.06;
      // Slightly-below-level eye on the side/3q angles → the framing cone behind
      // the item is sky, not distant ground. 'top' looks down by design.
      const dir = new THREE.Vector3(0, -0.06, 1);
      if (angle === 'back') dir.set(0, -0.06, -1);
      else if (angle === 'left') dir.set(-1, -0.06, 0);
      else if (angle === 'right') dir.set(1, -0.06, 0);
      else if (angle === 'top') dir.set(0.12, 1, 0.18);
      else if (angle === '3q') dir.set(0.8, 0.10, 0.8);
      dir.normalize();
      cam.position.copy(anchor).addScaledVector(dir, dist);
      cam.lookAt(anchor);
      cam.updateMatrixWorld(true);
      return { id, angle: angle ?? 'front', ok: true, radius: +radius.toFixed(3) };
    },
    wreckFormStudio(form, angle) {
      if (hooks.enterGame) hooks.enterGame(true);
      else { ctx.flags.titleActive = false; ctx.flags.paused = false; }
      const three = ctx.three;
      three.renderer.setSize(900, 900, false);
      const cam = three.camera as THREE.PerspectiveCamera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1; cam.updateProjectionMatrix(); }
      three.renderer.toneMappingExposure = 1.4;
      ctx.flags.paused = true;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (!studioGroup) {
        studioGroup = new THREE.Group();
        studioGroup.name = '__itemStudio';
        const key = new THREE.DirectionalLight(0xfff1dc, 2.6);
        key.position.set(2.5, 3.5, 2.0);
        const fill = new THREE.DirectionalLight(0xaec6ff, 0.85);
        fill.position.set(-2.2, 1.0, -1.4);
        const amb = new THREE.AmbientLight(0xffffff, 0.85);
        studioGroup.add(key, fill, amb);
        three.scene.add(studioGroup);
      }
      if (studioMesh) { studioGroup.remove(studioMesh); studioMesh = null; }

      const rand = Math.random;
      const hullMat = createRustedHullMaterial({ baseColor: 0x5f5b54 });
      let node: THREE.Object3D;
      if (form === 'lathe') {
        node = makeLatheHull(fuselageProfile(6, 1.4, 0.3, 0.9, rand), { material: hullMat });
      } else if (form === 'formers') {
        const g = new THREE.Group();
        g.add(makeLatheHull(fuselageProfile(4, 1.3, 0.3, 1.1, rand), { material: hullMat, phiLength: Math.PI * 1.3 }));
        g.add(makeFormerRings(1.2, 4, 0.5, { startX: 0.3 }));
        node = g;
      } else if (form === 'breach') {
        const g = new THREE.Group();
        const hull = makeLatheHull(fuselageProfile(5, 1.3, 0.3, 1.0, rand), { material: hullMat });
        g.add(hull);
        const breach = makeBreach(0.7, rand);
        breach.position.set(2.6, 0, 1.25);   // on the +Z flank
        breach.rotation.y = 0;               // +Z outward
        g.add(breach);
        node = g;
      } else {
        node = makeSandMound(ctx.terrain, 0, 0, new THREE.Vector2(1, 0), 3, rand);
        node.position.set(0, 0, 0);          // reframed below
      }

      const bp = ctx.player.body.body.translation();
      const anchor = new THREE.Vector3(bp.x, bp.y + 60, bp.z);
      node.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(node);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z, 0.1) * 0.5;
      node.position.sub(center).add(anchor);
      studioGroup.add(node);
      studioMesh = node;
      studioGroup.updateMatrixWorld(true);

      const dist = radius * 2.6 + 0.5;
      const dir = new THREE.Vector3(0.2, 0.12, 1);
      if (angle === 'side') dir.set(0, 0.08, 1);
      else if (angle === '3q') dir.set(0.85, 0.18, 0.85);
      else if (angle === 'top') dir.set(0.1, 1, 0.2);
      else if (angle === 'front') dir.set(1, 0.12, 0.15);   // down the +X nose
      dir.normalize();
      cam.position.copy(anchor).addScaledVector(dir, dist);
      cam.lookAt(anchor);
      cam.updateMatrixWorld(true);
      return { form, angle: angle ?? 'side', ok: true, radius: +radius.toFixed(2) };
    },
    spawnProcgenWreckRig(cls = 'corvette', seed = 1337) {
      // Ensure the world is live (idempotent) — same enter path the studios use.
      if (hooks.enterGame) hooks.enterGame(true);
      else { ctx.flags.titleActive = false; ctx.flags.paused = false; }
      // Remove + dispose a prior subject so re-calls (swap class/seed) don't leak.
      if (procgenRigGroup) {
        ctx.three.scene.remove(procgenRigGroup);
        procgenRigGroup.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry?.dispose(); });
        procgenRigGroup = null;
      }
      // Deterministic stream: same (cls, seed) reproduces the same wreck, so a
      // before/after A/B of a visual change is comparable (unlike the random
      // world-seed, which makes cross-boot snapshots incomparable).
      const rand = makeRng(seed);
      // Spawn inside the player-spawn exclusion ring (procgenPoi keeps other
      // procgen wrecks ≥80m from the anchor), offset from the anchor so the
      // subject isn't on top of the hidden player body → an isolated subject.
      const px = Tuning.OPENING_SCENE_ANCHOR_X + 30;
      const pz = Tuning.OPENING_SCENE_ANCHOR_Z + 30;
      const py = ctx.terrain.heightAt(px, pz);
      const pos = new THREE.Vector3(px, py, pz);
      const group = placeProcgenComposite(
        ctx.three.scene, ctx.physics.world, ctx.terrain, pos, rand, undefined, { cls },
      );
      // placeProcgenComposite applies a RANDOM yaw (+ terrain tilt) so the detail
      // flank (+Z: breaches + salvage panels) faces an arbitrary world direction.
      // For a verification framer that's no good — PIN the subject to a known
      // orientation (long-axis +X, detail flank +Z) so the framer's broadside
      // angle reliably sees the breach/greeble flank (shared-memory: "pin
      // ambiguous world axes"). A slight forward tilt keeps the crashed feel.
      group.rotation.set(0, 0, -0.06);
      group.updateMatrixWorld(true);
      group.name = 'procgenWreckRig';
      procgenRigGroup = group;
      let meshes = 0;
      group.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
      return { cls, seed, ok: true, meshes, pos: [px, +py.toFixed(1), pz] };
    },
    panelBuryAudit() {
      const reg = (ctx as unknown as { salvageables?: { list: Array<{ panel: THREE.Object3D; kind?: string; wreckKind?: string }> } }).salvageables;
      const scene = ctx.three.scene;
      const rc = new THREE.Raycaster();
      const fails: Array<{ idx: number; kind: string; hit: string }> = [];
      let pass = 0, tested = 0;
      const isAncestor = (anc: THREE.Object3D, node: THREE.Object3D | null): boolean => {
        let n: THREE.Object3D | null = node;
        while (n) { if (n === anc) return true; n = n.parent; }
        return false;
      };
      const updatedRoots = new Set<THREE.Object3D>();
      (reg?.list ?? []).forEach((s, idx) => {
        const body = s.panel;
        // Force a full world-matrix update of the wreck subtree so the door /
        // rim / interior (descendants) aren't raycast at stale transforms.
        let r0: THREE.Object3D = body;
        while (r0.parent && r0.parent !== scene) r0 = r0.parent;
        if (!updatedRoots.has(r0)) { r0.updateWorldMatrix(false, true); updatedRoots.add(r0); }
        const wp = body.getWorldPosition(new THREE.Vector3());
        const wq = body.getWorldQuaternion(new THREE.Quaternion());
        const outward = new THREE.Vector3(0, 0, 1).applyQuaternion(wq).normalize();
        let root: THREE.Object3D = body;
        while (root.parent && root.parent !== scene) root = root.parent;
        rc.far = 1.6;
        rc.set(wp.clone().addScaledVector(outward, 0.8), outward.clone().multiplyScalar(-1));
        const hits = rc.intersectObject(root, true);
        tested++;
        // Compare depths: the panel is exposed iff its nearest surface (rim /
        // door / cavity) is reached BEFORE any non-panel hull mesh. Hull BEHIND
        // the panel (e.g. the far wall past an open cavity) is fine.
        let dPanel = Infinity, dHull = Infinity;
        for (const h of hits) {
          if (isAncestor(body, h.object)) dPanel = Math.min(dPanel, h.distance);
          else dHull = Math.min(dHull, h.distance);
        }
        if (dPanel === Infinity) { pass++; return; }     // panel not on this axis — skip (no occlusion claim)
        // Panels recess by design (RECESS_DEPTH), so the hull lip sits a little
        // in front of the recessed cavity legitimately. Only flag GROSS
        // occlusion — hull well in front of the panel beyond the recess.
        if (dHull < dPanel - 0.22) {
          fails.push({ idx, kind: s.kind || s.wreckKind || '?', hit: `hull@${dHull.toFixed(2)}<panel@${dPanel.toFixed(2)}` });
        } else pass++;
      });
      return { tested, pass, failCount: fails.length, fails: fails.slice(0, 12) };
    },
    resetTutorial,
    showControls() { showControlsPanel(ctx); },
    audioState: () => getAudioStateSnapshot(ctx),
    musicState: () => getMusicStateSnapshot(),
  };
}
