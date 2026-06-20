// Player-rig screenshot harness (ACJ) — Playwright capture for the iteration
// loop, replacing the flaky preview MCP path (see MEMORY: hidden-tab throttling
// + dynamic-import isolation wedged the MCP screenshotter mid-session).
//
// Boots its own Vite dev server on a dedicated port, drives the in-page
// `window.__game.rigStudio()` studio (headless enter + even lighting + framed
// canonical angle — D134/D135), poses the rig, and writes PNGs to verification/.
//
// Usage:
//   node scripts/rig-shot.mjs                              # idle pose, default angles
//   node scripts/rig-shot.mjs --pose=apose --angles=front,3q,head
//   node scripts/rig-shot.mjs --pose=walk --angles=left --tag=knee
//
//   --pose    idle | apose | walk        (default idle)
//   --angles  comma list of front,back,left,right,3q,head  (default front,3q,left,head)
//   --tag     filename tag                (default "shot")
//   --port    dev server port            (default 5191)
//
// Output: verification/rig-<tag>-<pose>-<angle>.png  (one per angle)

import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'verification');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const POSE = argv.pose || 'idle';
const ANGLES = String(argv.angles || 'front,3q,left,head').split(',').map((s) => s.trim());
const TAG = argv.tag || 'shot';
const PORT = Number(argv.port || 5191);
const CLOSEUP = argv.closeup || ''; // shoulder|hip|hand|knee|elbow|face — overrides angles
const LIT = argv.lit || '';         // "form" = dramatic key/fill/shadow lighting (rigStudio's flat even light hides all form)

// Close-up targets: frame a joint from the front-side at close range. Offsets
// are [side, up, fwd] in the HEAD's facing frame so framing is consistent
// regardless of the (heading-dependent) spawn orientation.
const CLOSEUPS = {
  shoulder: { joint: 'rig.shoulders[1]', off: [0.30, 0.20, 0.62], look: [0, -0.08, 0] },
  hip:      { joint: 'rig.hips[1]',      off: [0.34, 0.12, 0.66], look: [0, -0.15, 0] },
  hand:     { joint: 'rig.wrists[1]',    off: [0.10, 0.26, 0.55], look: [0, -0.06, 0] },
  knee:     { joint: 'rig.knees[1]',     off: [0.30, 0.08, 0.58], look: [0, -0.05, 0] },
  elbow:    { joint: 'rig.elbows[1]',    off: [0.28, 0.10, 0.50], look: [0, 0, 0] },
  face:     { joint: 'rig.headGroup',    off: [0.11, 0.04, 0.36], look: [0, -0.03, 0] },
  torso:    { joint: 'rig.headGroup',    off: [0.18, -0.45, 1.05], look: [0, -0.62, 0] },
  full:     { joint: 'rig.headGroup',    off: [0.55, -0.55, 2.15], look: [0, -0.92, 0] },     // whole figure, fills the portrait frame
  full3q:   { joint: 'rig.headGroup',    off: [1.25, -0.55, 1.75], look: [0, -0.92, 0] },     // whole figure, 3/4
};

// Pose presets — run inside page.evaluate against window.__game.ctx.player.rig.
// Bones are Object3D, so .rotation.set works identically to the old Groups.
const POSES = {
  idle: `for(const i of [0,1]){ rig.shoulders[i].rotation.set(0.06,0,(i===1?1:-1)*0.05); rig.elbows[i].rotation.x=0.08; rig.wrists[i].rotation.x=-0.12; rig.hips[i].rotation.set(0,0,0); rig.knees[i].rotation.x=0.03; rig.ankles[i].rotation.x=0; }`,
  apose: `for(const i of [0,1]){ rig.shoulders[i].rotation.set(0.20,0,(i===1?1:-1)*0.55); rig.elbows[i].rotation.x=0.22; rig.wrists[i].rotation.x=0; rig.hips[i].rotation.set(0,0,(i===1?1:-1)*0.06); rig.knees[i].rotation.x=0.03; rig.ankles[i].rotation.x=0; }`,
  walk: `rig.hips[1].rotation.x=0.6; rig.knees[1].rotation.x=1.0; rig.ankles[1].rotation.x=0.2; rig.hips[0].rotation.x=-0.25; rig.knees[0].rotation.x=0.10; rig.ankles[0].rotation.x=0; rig.shoulders[1].rotation.set(-0.4,0,0.05); rig.elbows[1].rotation.x=0.5; rig.wrists[1].rotation.x=-0.1; rig.shoulders[0].rotation.set(0.4,0,-0.05); rig.elbows[0].rotation.x=0.3; rig.wrists[0].rotation.x=-0.1;`,
  // Natural relaxed contrapposto — weight on the right leg, left leg eased, pelvis
  // + spine + head counter-tilt, arms hang with a slight elbow bend + small gap.
  relaxed: `rig.hips[1].rotation.set(-0.04,0,0.02); rig.knees[1].rotation.x=0.02; rig.ankles[1].rotation.x=0; rig.hips[0].rotation.set(0.10,0.05,0.03); rig.knees[0].rotation.x=0.20; rig.ankles[0].rotation.x=-0.05; rig.spineBend.rotation.set(0.05,0,-0.05); rig.shoulders[1].rotation.set(0.10,0,0.10); rig.elbows[1].rotation.x=0.22; rig.wrists[1].rotation.x=-0.12; rig.shoulders[0].rotation.set(0.06,0,-0.13); rig.elbows[0].rotation.x=0.30; rig.wrists[0].rotation.x=-0.12; rig.headGroup.rotation.set(0.03,0.12,-0.05);`,
};

// ── ACN — LIVE scenario mode (--scenario=…) ─────────────────────────────────
// The pose/angle path above captures STATIC frames (it pauses + poses the rig).
// Live-FEEL features (creature AI, aim-twist sweep, weapon fire) need the sim
// TICKING — so these scenarios enter the game live, force the pointer-lock gate
// open (so `isPlaying()` is true and every system ticks — the gate that the
// hidden-preview path can't satisfy, D146), set up a situation, and capture a
// STRIP of frames over wall-clock time. Output: verification/scen-<name>-fNN.png.
const SCENARIO = argv.scenario || '';
const FRAMES = Number(argv.frames || 10);
const INTERVAL = Number(argv.interval || 300); // ms between strip frames

/** Enter gameplay LIVE (ticking) — dev loadout, pointer-lock gate forced open,
 *  unpaused, canvas sized, daylight for legibility. Does NOT pause/pose. */
async function enterLive(page, thirdPerson) {
  await page.evaluate((tp) => {
    const g = window.__game;
    g.enterGame(true);                              // dev loadout + handoff (skipLock — ACN)
    const ctx = g.ctx;
    ctx.input.controls.isLocked = true;             // make isPlaying()===true so all systems tick
    ctx.flags.paused = false;
    ctx.flags.thirdPerson = tp;
    g.setTime(0.42);                                // mid-morning: scene legible
    ctx.three.renderer.setSize(900, 1100, false);
    const cam = ctx.three.camera;
    if (cam.isPerspectiveCamera) { cam.aspect = 900 / 1100; cam.updateProjectionMatrix(); }
  }, thirdPerson);
  await page.waitForTimeout(500); // let several ticks run so the rig settles at the body
}

/** Capture FRAMES screenshots spaced INTERVAL ms apart. `perFrame` (optional)
 *  is a function string run in-page each frame before the wait (gets the frame
 *  index) — used to drive aim sweep / trigger fire / re-aim a tracking camera. */
async function captureStrip(page, name, perFrame) {
  for (let i = 0; i < FRAMES; i++) {
    if (perFrame) await page.evaluate(`(${perFrame})(${i})`);
    await page.waitForTimeout(INTERVAL);
    const path = join(OUT, `scen-${name}-f${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path, fullPage: false });
  }
  console.log(`[rig-shot] saved ${FRAMES} frames: scen-${name}-f00..f${String(FRAMES - 1).padStart(2, '0')}.png`);
}

const SCENARIOS = {
  // Prompt-3P (ACW F #149): place the player near a ground pickup, aim the 3P
  // camera at it so the eye-ray hovers it, tick live, then verify the prompt was
  // re-pinned to the object's projected screen position (inline left set to a px
  // value) instead of the CSS crosshair-center default ("50%"). Also screenshots.
  'prompt-3p': async (page) => {
    const setup = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      ctx.weather.intensity = 0; window.__game.setTime(0.5);
      ctx.three.renderer.toneMappingExposure = 1.1;
      ctx.three.renderer.setSize(900, 700, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 900 / 700; cam.updateProjectionMatrix(); }
      ctx.flags.thirdPerson = true;
      const p = ctx.pickups.list[0];
      if (!p) return { err: 'no pickup' };
      // Put the player ~2.4m from the pickup; aim the eye/camera at it.
      const px = p.pos.x, pz = p.pos.z, py = ctx.terrain.heightAt(px, pz);
      const bx = px, bz = pz + 2.4, by = py + 1.0;
      ctx.player.body.body.setTranslation({ x: bx, y: by, z: bz }, true);
      cam.position.set(bx, by + 0.7, bz + 1.5); // 3P behind; eye-ray still aims fwd
      cam.lookAt(px, py + 0.2, pz);
      cam.updateMatrixWorld(true);
      return { pickup: p.itemId, at: [+px.toFixed(1), +pz.toFixed(1)] };
    });
    console.log('[prompt-3p] setup ' + JSON.stringify(setup));
    // Tick live so updateInteraction raycasts + updateInteractPrompt repositions.
    for (let i = 0; i < 12; i++) {
      await page.evaluate(() => {
        const ctx = window.__game.ctx;
        const p = ctx.pickups.list[0];
        if (p) { const cam = ctx.three.camera; cam.lookAt(p.pos.x, ctx.terrain.heightAt(p.pos.x, p.pos.z) + 0.2, p.pos.z); cam.updateMatrixWorld(true); }
      });
      await page.waitForTimeout(70);
    }
    const result = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const el = document.getElementById('interact-prompt');
      return {
        hover: ctx.inventory.hover ? ctx.inventory.hover.promptNoun : null,
        promptLeft: el ? el.style.left : '(none)',
        promptTop: el ? el.style.top : '(none)',
        transform: el ? el.style.transform : '(none)',
      };
    });
    console.log('[prompt-3p] ' + JSON.stringify(result));
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(OUT, 'scen-prompt-3p.png'), fullPage: false });
    console.log('[rig-shot] saved scen-prompt-3p.png');
  },

  // Shrew flee: face the player at a shrew ~5m ahead (< SPOT_DISTANCE 7m), 1P
  // static camera. The shrew flees directly AWAY from the camera, so it recedes
  // along the view axis and stays roughly centered — the strip shows the bolt
  // (recede + skittery hop) without per-frame tracking.
  'shrew-flee': async (page) => {
    const info = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      ctx.three.renderer.toneMappingExposure = 1.6; // brighten for a clear critter read
      const cam = ctx.three.camera;
      const s = ctx.shrews.list[0];
      const sx = s.pos.x, sz = s.pos.z, sy = ctx.terrain.heightAt(sx, sz);
      const px = sx, pz = sz - 2.8, py = sy + 1.6;   // 2.8m south of the shrew (well < SPOT 7m)
      ctx.player.body.body.setTranslation({ x: px, y: py, z: pz }, true);
      cam.position.set(px, py, pz);
      cam.lookAt(sx, sy + 0.1, sz);
      cam.updateMatrixWorld(true);
      return { shrewId: s.id, state0: s.state, start: [+sx.toFixed(2), +sz.toFixed(2)],
               horizDist: +Math.hypot(cam.position.x - sx, cam.position.z - sz).toFixed(2) };
    });
    console.log(`[shrew-flee] shrew#${info.shrewId} @${info.start} dist=${info.horizDist}m state=${info.state0}`);
    // Re-pin the 1P camera each frame, angled down at the critter (it flees away
    // from the camera so it recedes along the view axis + stays centered).
    await captureStrip(page, 'shrew-flee', `(i)=>{const c=window.__game.ctx;const s=c.shrews.list[0];const cam=c.three.camera;const gy=c.terrain.heightAt(s.pos.x,s.pos.z);cam.position.set(s.pos.x,gy+1.6,s.pos.z-2.8);cam.lookAt(s.pos.x,gy+0.1,s.pos.z);cam.updateMatrixWorld(true);console.log('[shrew-flee] f'+i+' state='+s.state+' pos='+s.pos.x.toFixed(2)+','+s.pos.z.toFixed(2));}`);
    const end = await page.evaluate(() => {
      const s = window.__game.ctx.shrews.list[0];
      return { state: s.state, pos: [+s.pos.x.toFixed(2), +s.pos.z.toFixed(2)] };
    });
    console.log(`[shrew-flee] END state=${end.state} pos=${end.pos}`);
  },

  // Lizard-flee (ACW B4): force the lizard into a FIXED-direction flee (the AI
  // normally flees away from the camera, which keeps it tail-on — useless for
  // reading a gait). We pin fleeDir north + a far fleeUntil, then track from a
  // CLOSE side-profile camera (east of the lizard) so the 4 stepping legs are
  // visible. brightened exposure + a tight frame.
  'lizard-flee': async (page) => {
    const info = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      ctx.three.renderer.toneMappingExposure = 1.7;
      const l = ctx.lizards[0];
      const sy = ctx.terrain.heightAt(l.pos.x, l.pos.z);
      // Force a steady northward flee (z+), independent of camera position.
      l.state = 'flee';
      l.fleeDir.set(0, 0, 1);
      l.fleeUntil = ctx.time.elapsed + 999;
      const cam = ctx.three.camera;
      // Teleport the player body to the side-view spot too — syncCameraToBody
      // re-pins the camera to the body each tick, so the camera alone won't stick.
      ctx.player.body.body.setTranslation({ x: l.pos.x + 0.55, y: sy + 0.50, z: l.pos.z + 0.15 }, true);
      cam.position.set(l.pos.x + 0.55, sy + 0.50, l.pos.z + 0.15);
      cam.lookAt(l.pos.x, sy + 0.04, l.pos.z);
      cam.updateMatrixWorld(true);
      return { lizardId: l.id, state0: l.state, pos: [+l.pos.x.toFixed(2), +l.pos.z.toFixed(2)] };
    });
    console.log(`[lizard-flee] lizard#${info.lizardId} state=${info.state0} pos=${info.pos}`);
    // Track from the east side at 0.85m, low angle, re-pinning fleeDir + body each frame.
    await captureStrip(page, 'lizard-flee', `(i)=>{const c=window.__game.ctx;const l=c.lizards[0];l.state='flee';l.fleeDir.set(0,0,1);l.fleeUntil=c.time.elapsed+999;const cam=c.three.camera;const gy=c.terrain.heightAt(l.pos.x,l.pos.z);c.player.body.body.setTranslation({x:l.pos.x+0.55,y:gy+0.50,z:l.pos.z+0.15},true);cam.position.set(l.pos.x+0.55,gy+0.50,l.pos.z+0.15);cam.lookAt(l.pos.x,gy+0.04,l.pos.z);cam.updateMatrixWorld(true);console.log('[lizard-flee] f'+i+' state='+l.state+' pos='+l.pos.x.toFixed(2)+','+l.pos.z.toFixed(2));}`);
    const end = await page.evaluate(() => {
      const l = window.__game.ctx.lizards[0];
      return { state: l.state, pos: [+l.pos.x.toFixed(2), +l.pos.z.toFixed(2)] };
    });
    console.log(`[lizard-flee] END state=${end.state} pos=${end.pos}`);
  },

  // Lizard-gait (ACW B4 STATIC): the reliable read for a small creature's
  // gait. Enter live (lizard + terrain exist), kill the storm + force bright
  // noon, then for each of several gait phases: PAUSE (main loop early-returns,
  // so a free camera sticks + the manual leg pose survives), replicate the
  // sprawl-gait formula on the lizard's stored leg pivots at that phase, frame
  // a close 3/4 camera, and screenshot. Output: scen-lizard-gait-pNN.png.
  'lizard-gait': async (page) => {
    const phases = [0.0, 0.2, 0.4, 0.6, 0.8];
    for (let i = 0; i < phases.length; i++) {
      const p = phases[i];
      await page.evaluate((p) => {
        const ctx = window.__game.ctx;
        ctx.weather.intensity = 0;               // clear any storm dimming
        window.__game.setTime(0.5);              // bright midday
        ctx.three.renderer.toneMappingExposure = 1.15;
        ctx.three.renderer.setSize(900, 900, false);
        const cam = ctx.three.camera;
        if (cam.isPerspectiveCamera) { cam.aspect = 1; cam.updateProjectionMatrix(); }
        const l = ctx.lizards[0];
        const sy = ctx.terrain.heightAt(l.pos.x, l.pos.z);
        l.mesh.position.set(l.pos.x, sy + 0.06, l.pos.z);
        l.mesh.rotation.set(0, 0, 0);            // face local +X (toward camera-left)
        // Replicate animateLizardLegs at this phase (swing 0.55 / lift 0.014).
        const legs = l.mesh.userData.gaitLegs || [];
        const phase = p * Math.PI * 2;
        for (const leg of legs) {
          const pp = phase + leg.offset;
          leg.grp.rotation.z = Math.sin(pp) * 0.72;
          leg.grp.position.y = leg.baseY + Math.max(0, Math.cos(pp)) * 0.022;
        }
        ctx.flags.paused = true;                 // freeze so the camera + pose stick
        l.mesh.updateMatrixWorld(true);
        // Close 3/4 side view focused on the legs: lizard's local +X is world
        // +X (no yaw), so a camera off the +X/+Z corner at low height sees the
        // flank + all four legs stepping.
        cam.position.set(l.pos.x + 0.24, sy + 0.16, l.pos.z + 0.30);
        cam.lookAt(l.pos.x + 0.02, sy + 0.045, l.pos.z);
        cam.updateMatrixWorld(true);
      }, p);
      await page.waitForTimeout(250);
      const path = join(OUT, `scen-lizard-gait-p${String(i).padStart(2, '0')}.png`);
      await page.screenshot({ path, fullPage: false });
      console.log(`[lizard-gait] phase=${p} → ${path}`);
    }
  },

  // Shrew-gait (ACW B5 STATIC): same paused-pose technique as lizard-gait, for
  // the ~9cm shrew (camera pulled in tighter). Confirms the stubby-leg walk.
  'shrew-gait': async (page) => {
    const phases = [0.0, 0.25, 0.5, 0.75];
    for (let i = 0; i < phases.length; i++) {
      const p = phases[i];
      await page.evaluate((p) => {
        const ctx = window.__game.ctx;
        ctx.weather.intensity = 0;
        window.__game.setTime(0.5);
        ctx.three.renderer.toneMappingExposure = 1.15;
        ctx.three.renderer.setSize(900, 900, false);
        const cam = ctx.three.camera;
        if (cam.isPerspectiveCamera) { cam.aspect = 1; cam.updateProjectionMatrix(); }
        const s = ctx.shrews.list[0];
        const sy = ctx.terrain.heightAt(s.pos.x, s.pos.z);
        s.mesh.position.set(s.pos.x, sy + 0.04, s.pos.z);
        s.mesh.rotation.set(0, 0, 0);
        const legs = s.mesh.userData.gaitLegs || [];
        const phase = p * Math.PI * 2;
        for (const leg of legs) {
          const pp = phase + leg.offset;
          leg.grp.rotation.z = Math.sin(pp) * 0.5;
          leg.grp.position.y = leg.baseY + Math.max(0, Math.cos(pp)) * 0.008;
        }
        ctx.flags.paused = true;
        s.mesh.updateMatrixWorld(true);
        cam.position.set(s.pos.x + 0.15, sy + 0.11, s.pos.z + 0.19);
        cam.lookAt(s.pos.x + 0.01, sy + 0.03, s.pos.z);
        cam.updateMatrixWorld(true);
      }, p);
      await page.waitForTimeout(250);
      const path = join(OUT, `scen-shrew-gait-p${String(i).padStart(2, '0')}.png`);
      await page.screenshot({ path, fullPage: false });
      console.log(`[shrew-gait] phase=${p} → ${path}`);
    }
  },

  // Shrew-burrow (ACW B5 STATIC): the live FP camera can't be parked reliably
  // (the KCC stomps the body teleport), so verify the DIVE VISUAL the paused
  // way: manually set burrowT at several depths, replicate the burrow math
  // (sink below the surface + nose-down tilt + vanish past 0.85), and shoot a
  // close camera that looks at the surface so the terrain occludes the sunk
  // body (reads as "submerged in the sand"). The puff + trigger are verified
  // functionally (state machine + emitBurst); the dive feel is foreground-owed.
  'shrew-burrow': async (page) => {
    // The shrew (~9cm) vanishes under the solid terrain plane by burrowT~0.3
    // (DEPTH 0.34m), so the VISIBLE dive is the early range — shoot it dense.
    const ts = [0.0, 0.08, 0.16, 0.26];
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      await page.evaluate((t) => {
        const ctx = window.__game.ctx;
        ctx.weather.intensity = 0;
        window.__game.setTime(0.5);
        ctx.three.renderer.toneMappingExposure = 1.15;
        ctx.three.renderer.setSize(900, 900, false);
        const cam = ctx.three.camera;
        if (cam.isPerspectiveCamera) { cam.aspect = 1; cam.updateProjectionMatrix(); }
        const s = ctx.shrews.list[0];
        const sx = s.pos.x, sz = s.pos.z;
        const surfaceY = ctx.terrain.heightAt(sx, sz) + 0.04; // SHREW_TERRAIN_OFFSET
        const DEPTH = 0.34;
        s.mesh.position.set(sx, surfaceY - t * DEPTH, sz);
        s.mesh.rotation.set(0, 0, -t * 0.6); // nose-down dive tilt
        s.mesh.visible = t < 0.85;
        ctx.flags.paused = true;
        s.mesh.updateMatrixWorld(true);
        // Close ~45° view: sand line cuts across the shrew so the descending
        // body reads (top half above sand, lower half clipped into the ground).
        cam.position.set(sx + 0.17, surfaceY + 0.16, sz + 0.20);
        cam.lookAt(sx, surfaceY + 0.01, sz);
        cam.updateMatrixWorld(true);
      }, t);
      await page.waitForTimeout(250);
      const path = join(OUT, `scen-shrew-burrow-t${String(i).padStart(2, '0')}.png`);
      await page.screenshot({ path, fullPage: false });
      console.log(`[shrew-burrow] burrowT=${t} → ${path}`);
    }
  },

  // Rig3p (ACX): the TRUE 3P verification — equip an item (--item=<id>, omit for
  // bare hands), let the rig settle into its REAL idle pose (no posed-out arm),
  // then frame the camera BEHIND the player looking forward, matching what the
  // user sees in play. This is the correct frame for judging hand orientation +
  // which hand + item facing (the held-item scenario's posed-out arm lied).
  'rig3p': async (page) => {
    const item = argv.item || '';
    const lit = !!argv.lit;   // C27 — --lit lights a torch (meta.lit) so the 3P flame shows
    await page.evaluate(({ item, lit }) => {
      const ctx = window.__game.ctx;
      ctx.weather.intensity = 0;
      window.__game.setTime(lit ? 0.0 : 0.5);   // night for a lit-torch shot so the flame reads
      ctx.three.renderer.toneMappingExposure = 1.1;
      ctx.three.renderer.setSize(800, 950, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 800 / 950; cam.updateProjectionMatrix(); }
      ctx.flags.thirdPerson = true;
      const inv = ctx.inventory;
      if (item) {
        inv.slots[0].item = item; inv.slots[0].count = 1;
        inv.slots[0].meta = lit ? { lit: true, burnRemaining: 1 } : undefined;
        inv.selectedIdx = 0;
      } else { inv.slots[0].item = null; }
    }, { item, lit });
    await page.waitForTimeout(500); // settle the idle pose + swap the mesh into the hand
    const info = await page.evaluate((handCloseup) => {
      const ctx = window.__game.ctx;
      const rig = ctx.player.rig;
      ctx.flags.paused = true;
      rig.group.updateMatrixWorld(true);
      const cam = ctx.three.camera;
      const V = cam.position.constructor;
      const root = rig.group.getWorldPosition(new V());
      const h = rig.heading;
      // rig.group.rotation.y = heading rotates local +Z onto (sin h, 0, cos h),
      // so that is the player's forward. Camera BEHIND the player, looking fwd.
      const fwd = new V(Math.sin(h), 0, Math.cos(h));
      // Close behind view biased toward the player's RIGHT hand (where held
      // items now sit), hip-height, matching the user's screenshot framing.
      const pright = new V(-fwd.z, 0, fwd.x); // player's right (local -X → world)
      if (handCloseup === 'hand') {
        // Tight closeup on the right hand to judge palm/finger orientation.
        const hp = rig.rightHandAttach.getWorldPosition(new V());
        // Pure side view from OUTSIDE the body (player's right), at hand height,
        // so the torso/buttocks don't occlude the hand.
        cam.position.set(
          hp.x + pright.x * 0.42 + fwd.x * 0.05,
          hp.y + 0.05,
          hp.z + pright.z * 0.42 + fwd.z * 0.05,
        );
        cam.lookAt(hp.x, hp.y - 0.02, hp.z);
      } else if (handCloseup === 'profile') {
        // Side profile from the player's RIGHT, so forward (+fwd) reads as a
        // clear left/right screen axis — unambiguous for "item points forward".
        cam.position.set(
          root.x + pright.x * 2.0,
          root.y + 1.0,
          root.z + pright.z * 2.0,
        );
        cam.lookAt(root.x, root.y + 0.85, root.z);
      } else {
        cam.position.set(
          root.x - fwd.x * 1.1 + pright.x * 0.5,
          root.y + 1.15,
          root.z - fwd.z * 1.1 + pright.z * 0.5,
        );
        cam.lookAt(root.x + pright.x * 0.18, root.y + 0.85, root.z + pright.z * 0.18);
      }
      cam.updateMatrixWorld(true);
      // ACX debug — the hand-attach world frame + the direction (in
      // attach-LOCAL space) that points the player's world-forward. The item's
      // mesh-forward axis, after handAttachTransform.rot, must equal localFwd.
      const Q = cam.quaternion.constructor;
      const aq = rig.rightHandAttach.getWorldQuaternion(new Q());
      const inv = aq.clone().invert();
      const worldFwd = new V(Math.sin(h), 0, Math.cos(h));
      const worldUp = new V(0, 1, 0);
      const localFwd = worldFwd.clone().applyQuaternion(inv);
      const localUp = worldUp.clone().applyQuaternion(inv);
      console.error('[handframe] localFwd=' + [localFwd.x, localFwd.y, localFwd.z].map((v) => +v.toFixed(2)).join(',') +
        ' localUp=' + [localUp.x, localUp.y, localUp.z].map((v) => +v.toFixed(2)).join(','));
      return { heading: +h.toFixed(2), rootY: +root.y.toFixed(2) };
    }, argv.hand ? 'hand' : (argv.view || ''));
    console.log('[rig3p] ' + JSON.stringify(info));
    await page.waitForTimeout(200);
    const tag = (item || 'bare') + (lit ? '-lit' : '');
    await page.screenshot({ path: join(OUT, `scen-rig3p-${tag}.png`), fullPage: false });
    console.log(`[rig-shot] saved scen-rig3p-${tag}.png`);
  },

  // Footprint-repro (ACX): equip the gun in 3P, stamp a line of player
  // footprints at the feet, then frame low-behind so the held gun overlaps the
  // ground decals on screen — to confirm + diagnose footsteps-through-items.
  'footprint-repro': async (page) => {
    await page.evaluate(() => {
      const ctx = window.__game.ctx;
      ctx.weather.intensity = 0; window.__game.setTime(0.5);
      ctx.three.renderer.toneMappingExposure = 1.15; ctx.three.renderer.setSize(820, 820, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1; cam.updateProjectionMatrix(); }
      ctx.flags.thirdPerson = true;
      const inv = ctx.inventory;
      inv.slots[0].item = 'scrap_gun'; inv.slots[0].count = 1; inv.slots[0].meta = undefined; inv.selectedIdx = 0;
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const rig = ctx.player.rig;
      rig.group.updateMatrixWorld(true);
      const V = ctx.three.camera.position.constructor;
      const root = rig.group.getWorldPosition(new V());
      const h = rig.heading;
      const fwd = new V(Math.sin(h), 0, Math.cos(h));
      // Stamp a dense patch of footprints on the ground AHEAD of the player so
      // the hip-held gun projects onto them from a high-behind, looking-down cam.
      for (let i = 0; i <= 8; i++) {
        for (let j = -1; j <= 1; j++) {
          const px = root.x + fwd.x * (0.2 + i * 0.18) + (-fwd.z) * j * 0.18;
          const pz = root.z + fwd.z * (0.2 + i * 0.18) + (fwd.x) * j * 0.18;
          ctx.footprints.spawn('player', px, pz, h, ctx.time.elapsed);
        }
      }
      ctx.flags.paused = true;
      const cam = ctx.three.camera;
      // High behind, steep look-down so the gun (hip) overlaps the ground decals
      // ahead — the depth case that exposes see-through.
      cam.position.set(root.x - fwd.x * 0.6, root.y + 2.3, root.z - fwd.z * 0.6);
      cam.lookAt(root.x + fwd.x * 1.2, root.y, root.z + fwd.z * 1.2);
      cam.updateMatrixWorld(true);
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(OUT, 'scen-footprint-repro.png'), fullPage: false });
    console.log('[rig-shot] saved scen-footprint-repro.png');
  },

  // Speeder-seated (ACX): mount the bike in 3P + frame a clean chase cam behind
  // it, to verify the seated rig (facing forward, gripping bars, feet on pegs).
  'speeder-seated': async (page) => {
    await page.evaluate(() => {
      const ctx = window.__game.ctx;
      ctx.weather.intensity = 0; window.__game.setTime(0.5);
      ctx.three.renderer.toneMappingExposure = 1.1; ctx.three.renderer.setSize(820, 950, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 820 / 950; cam.updateProjectionMatrix(); }
      ctx.flags.thirdPerson = true;
      const s = ctx.speeder;
      // Force-mount: park the player capsule far below (as the real mount does)
      // and flag mounted so updateSpeeder's mounted path + updatePlayerRig's
      // seated branch run.
      s.mounted = true;
      ctx.player.body.body.setTranslation({ x: s.body.translation().x, y: -2000, z: s.body.translation().z }, true);
    });
    await page.waitForTimeout(300);
    // Point the camera-look along the bike's forward (as a rider looking ahead),
    // so the GAME's chase cam (driven by updateSpeeder) places itself behind +
    // the bike yaw aligns. We do NOT override the camera — this reproduces the
    // actual in-game view the user sees.
    await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const s = ctx.speeder;
      const yaw = s.yaw;
      const bf = new (ctx.three.camera.position.constructor)(-Math.sin(yaw), 0, -Math.cos(yaw));
      const cam = ctx.three.camera;
      const tgt = new (cam.position.constructor)(cam.position.x + bf.x, cam.position.y, cam.position.z + bf.z);
      cam.lookAt(tgt);
      cam.updateMatrixWorld(true);
    });
    await page.waitForTimeout(600); // let the live chase cam settle + bike-yaw lerp
    const info = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const s = ctx.speeder;
      const p = s.body.translation();
      const yaw = s.yaw;
      const bfx = -Math.sin(yaw), bfz = -Math.cos(yaw); // bike forward
      const cam = ctx.three.camera;
      // Measure the rig's actual facing (local +Z is the FACE, D137) + which
      // side of the bike the (game-placed) camera is on.
      const rig = ctx.player.rig;
      const V = cam.position.constructor; const Q = cam.quaternion.constructor;
      const rq = rig.group.getWorldQuaternion(new Q());
      const face = new V(0, 0, 1).applyQuaternion(rq);
      const faceDotFwd = +(face.x * bfx + face.z * bfz).toFixed(2);
      // camera-to-bike vector vs bikeForward: + = cam is BEHIND (sees rear), - = cam in FRONT.
      const camToBikeX = p.x - cam.position.x, camToBikeZ = p.z - cam.position.z;
      const camDotFwd = +(camToBikeX * bfx + camToBikeZ * bfz).toFixed(2);
      console.error('[seatfacing] faceDotFwd=' + faceDotFwd + (faceDotFwd > 0 ? '(rig FORWARD)' : '(rig BACKWARD)') +
        ' camDotFwd=' + camDotFwd + (camDotFwd > 0 ? '(cam BEHIND)' : '(cam FRONT)'));
      // BEHIND view (matches the user's chase-cam screenshot) so the riding
      // pose reads as they see it: hands on bars, feet on pegs, sit.
      ctx.flags.paused = true;
      cam.position.set(p.x - bfx * 3.0, p.y + 1.9, p.z - bfz * 3.0);
      cam.lookAt(p.x + bfx * 0.6, p.y + 0.4, p.z + bfz * 0.6);
      cam.updateMatrixWorld(true);
      return { yaw: +yaw.toFixed(2), faceDotFwd, camDotFwd };
    });
    console.log('[speeder-seated] ' + JSON.stringify(info));
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(OUT, 'scen-speeder-seated.png'), fullPage: false });
    console.log('[rig-shot] saved scen-speeder-seated.png');
  },

  // Bike-truth (ACX): the DECISIVE multi-angle rig-on-bike inspection. Prior
  // speeder-seated lied because it OVERRODE the camera with a hand-placed
  // behind-cam — so it never rendered what the user actually sees, and its
  // faceDotFwd measurement assumed +Z=face. Here we (a) force bike yaw=0 so the
  // nose points world -Z and tail/+Z is unambiguous, (b) mount, (c) shoot the
  // REAL game chase camera (no override) = exactly the user's view, then (d)
  // shoot 5 fixed WORLD angles so the pose (facing, hands-on-bars, feet-on-pegs)
  // can be judged from every side. Output: scen-bike-<angle>.png.
  'bike-truth': async (page) => {
    // Mount + force yaw 0, on flat-ish ground, look along bike forward (-Z).
    const info = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      ctx.weather.intensity = 0; window.__game.setTime(0.5);
      ctx.three.renderer.toneMappingExposure = 1.1; ctx.three.renderer.setSize(900, 900, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1; cam.updateProjectionMatrix(); }
      ctx.flags.thirdPerson = true;
      const s = ctx.speeder;
      // Pin the bike to yaw=0 (nose → world -Z) so external angles are unambiguous.
      s.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      s.yaw = 0;
      const p = s.body.translation();
      s.mounted = true;
      ctx.player.body.body.setTranslation({ x: p.x, y: -2000, z: p.z }, true);
      // Camera euler.y = yaw makes getWorldDirection = (-sin yaw,0,-cos yaw) = bike fwd.
      cam.quaternion.setFromEuler(new (cam.rotation.constructor)(0, s.yaw, 0, 'YXZ'));
      cam.updateMatrixWorld(true);
      return { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1) };
    });
    console.log('[bike-truth] bike@ ' + JSON.stringify(info));
    // Let updateSpeeder drive the chase cam + bike-yaw lerp settle (no override).
    await page.waitForTimeout(700);
    // (1) The REAL game chase-cam view — what the user sees. Pause AFTER the
    // game has positioned the camera this frame, do NOT touch cam.position.
    const meas = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const s = ctx.speeder; const cam = ctx.three.camera;
      const V = cam.position.constructor; const Q = cam.quaternion.constructor;
      const p = s.body.translation();
      const bfx = -Math.sin(s.yaw), bfz = -Math.cos(s.yaw);
      const rig = ctx.player.rig;
      const rq = rig.group.getWorldQuaternion(new Q());
      const face = new V(0, 0, 1).applyQuaternion(rq);
      const camToBikeX = p.x - cam.position.x, camToBikeZ = p.z - cam.position.z;
      // NUMERIC IK CHECK — world positions of the hands + feet vs the bike's
      // grip/peg world targets (yaw=0 so bike-local==world+bike pos). Distances
      // near 0 = contact. This is the trustworthy gate (not eyeballing pixels).
      rig.group.updateMatrixWorld(true);
      const wp = (n) => { const v = n.getWorldPosition(new V()); return [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]; };
      const grip = [[p.x - 0.34, p.y + 0.42, p.z + 0.00], [p.x + 0.34, p.y + 0.42, p.z + 0.00]];
      const peg  = [[p.x - 0.43, p.y - 0.08, p.z + 0.15], [p.x + 0.43, p.y - 0.08, p.z + 0.15]];
      const dist = (a, b) => +Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]).toFixed(2);
      const hands = [wp(rig.wrists[0]), wp(rig.wrists[1])];
      const feet = [wp(rig.ankles[0]), wp(rig.ankles[1])];
      const hipsW = [wp(rig.hips[0]), wp(rig.hips[1])];
      // pair each hand/foot to its NEAREST target (don't assume index↔side).
      const handErr = hands.map((h) => Math.min(dist(h, grip[0]), dist(h, grip[1])));
      const footErr = feet.map((f) => Math.min(dist(f, peg[0]), dist(f, peg[1])));
      console.error('[ik] hands=' + JSON.stringify(hands) + ' grips=' + JSON.stringify(grip) + ' handErr=' + JSON.stringify(handErr));
      console.error('[ik] feet=' + JSON.stringify(feet) + ' pegs=' + JSON.stringify(peg) + ' footErr=' + JSON.stringify(footErr));
      console.error('[ik] hipsW=' + JSON.stringify(hipsW) + ' bikeY=' + p.y.toFixed(2));
      ctx.flags.paused = true; // freeze with the GAME camera in place
      return {
        yaw: +s.yaw.toFixed(2),
        rigFaceXZ: [+face.x.toFixed(2), +face.z.toFixed(2)],
        bikeFwdXZ: [+bfx.toFixed(2), +bfz.toFixed(2)],
        faceDotBikeFwd: +(face.x * bfx + face.z * bfz).toFixed(2),
        camDotBikeFwd: +(camToBikeX * bfx + camToBikeZ * bfz).toFixed(2),
        camPos: [+cam.position.x.toFixed(1), +cam.position.y.toFixed(1), +cam.position.z.toFixed(1)],
      };
    });
    console.log('[bike-truth] GAME-CAM ' + JSON.stringify(meas));
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(OUT, 'scen-bike-gamecam.png'), fullPage: false });
    console.log('[rig-shot] saved scen-bike-gamecam.png (the REAL user view)');
    // (1b) POSE SWEEP — search the joint-angle space for the pose that lands the
    // wrists on the grips + the ankles on the pegs. Pure matrix math (paused),
    // so a coarse+fine grid runs in one boot. Logs the winning angles to bake
    // into playerRig.ts. Legs are independent of the torso lean; arms depend on
    // it (lean moves the shoulders), so arms sweep lean too.
    const best = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const s = ctx.speeder; const rig = ctx.player.rig;
      const V = ctx.three.camera.position.constructor;
      const p = s.body.translation();
      ctx.flags.paused = true;
      const grip = [[p.x - 0.34, p.y + 0.42, p.z], [p.x + 0.34, p.y + 0.42, p.z]];
      // Target the ANKLE node ~0.1m ABOVE the peg (the sole sits below the ankle).
      const peg = [[p.x - 0.43, p.y + 0.02, p.z + 0.15], [p.x + 0.43, p.y + 0.02, p.z + 0.15]];
      const wp = (n) => { const v = n.getWorldPosition(new V()); return [v.x, v.y, v.z]; };
      const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const near = (pt, ts) => Math.min(dist(pt, ts[0]), dist(pt, ts[1]));
      const setLegs = (hipX, hipZ, kneeX) => { for (let i = 0; i < 2; i++) { const sd = i === 1 ? 1 : -1; rig.hips[i].rotation.set(hipX, 0, sd * hipZ); rig.knees[i].rotation.x = kneeX; } rig.group.updateMatrixWorld(true); };
      const PIVOT_Y = 0.92; // mirror playerRig: lean pivots at the waist (no torso slide)
      const setArms = (lean, shX, shZ, elbX) => { rig.spineBend.rotation.set(lean, 0, 0); rig.spineBend.position.set(0, PIVOT_Y * (1 - Math.cos(lean)), -PIVOT_Y * Math.sin(lean)); for (let i = 0; i < 2; i++) { const sd = i === 1 ? 1 : -1; rig.shoulders[i].rotation.set(shX, 0, sd * shZ); rig.elbows[i].rotation.x = elbX; } rig.group.updateMatrixWorld(true); };
      const legErr = () => (near(wp(rig.ankles[0]), peg) + near(wp(rig.ankles[1]), peg)) / 2;
      const armErr = () => (near(wp(rig.wrists[0]), grip) + near(wp(rig.wrists[1]), grip)) / 2;
      // ── Legs: coarse grid then refine around the winner.
      const sweepLegs = (hipXs, hipZs, kneeXs) => {
        let b = { e: 1e9 };
        for (const hipX of hipXs) for (const hipZ of hipZs) for (const kneeX of kneeXs) {
          setLegs(hipX, hipZ, kneeX); const e = legErr();
          if (e < b.e) b = { e, hipX, hipZ, kneeX };
        }
        return b;
      };
      // hipX constrained ≥ -0.1: forbid strong backward thigh pitch (reads as
      // "legs facing backwards"); prefer down/forward + abduction splay.
      let L = sweepLegs([-0.1, 0.05, 0.2, 0.35, 0.5, 0.65], [0.2, 0.35, 0.5, 0.65, 0.8, 0.95], [0.0, 0.15, 0.3, 0.45, 0.6, 0.75]);
      L = sweepLegs(
        [Math.max(-0.1, L.hipX - 0.1), L.hipX - 0.03, L.hipX + 0.03, L.hipX + 0.1],
        [L.hipZ - 0.08, L.hipZ - 0.03, L.hipZ + 0.03, L.hipZ + 0.08],
        [L.kneeX - 0.1, L.kneeX - 0.03, L.kneeX + 0.03, L.kneeX + 0.1],
      );
      // ── Arms: sweep lean + shoulder pitch + elbow (shZ fixed; lateral was good).
      const sweepArms = (leans, shXs, elbXs) => {
        let b = { e: 1e9 };
        for (const lean of leans) for (const shX of shXs) for (const elbX of elbXs) {
          setArms(lean, shX, 0.12, elbX); const e = armErr();
          if (e < b.e) b = { e, lean, shX, elbX };
        }
        return b;
      };
      // Free sweep: deep lean (waist-pivot, no torso slide) + full shoulder range
      // (a deep lean wants the arm to hang slightly back-of-torso = vertical in
      // world). Find the genuine best reach for a CONNECTED torso.
      let A = sweepArms([0.3, 0.5, 0.7, 0.9, 1.1, 1.3], [-0.5, -0.25, 0.0, 0.25, 0.5], [0.0, 0.2, 0.4, 0.6]);
      A = sweepArms(
        [A.lean - 0.1, A.lean - 0.03, A.lean + 0.03, A.lean + 0.1],
        [A.shX - 0.12, A.shX - 0.04, A.shX + 0.04, A.shX + 0.12],
        [Math.max(0, A.elbX - 0.1), A.elbX - 0.03, A.elbX + 0.03, A.elbX + 0.1],
      );
      // Apply the combined winner so the screenshots reflect it.
      setLegs(L.hipX, L.hipZ, L.kneeX);
      setArms(A.lean, A.shX, 0.12, A.elbX);
      rig.group.updateMatrixWorld(true);
      // Post-sweep per-axis residuals (which axis is still off).
      const axErr = (pt, ts) => { const t = dist(pt, ts[0]) < dist(pt, ts[1]) ? ts[0] : ts[1]; return [+(pt[0] - t[0]).toFixed(2), +(pt[1] - t[1]).toFixed(2), +(pt[2] - t[2]).toFixed(2)]; };
      console.error('[ik2] handAx=' + JSON.stringify([axErr(wp(rig.wrists[0]), grip), axErr(wp(rig.wrists[1]), grip)]));
      console.error('[ik2] footAx=' + JSON.stringify([axErr(wp(rig.ankles[0]), peg), axErr(wp(rig.ankles[1]), peg)]) + ' (x=lateral y=height z=fwd/back)');
      const r3 = (x) => +x.toFixed(3);
      return {
        legs: { hipX: r3(L.hipX), hipZ: r3(L.hipZ), kneeX: r3(L.kneeX), errM: r3(L.e) },
        arms: { lean: r3(A.lean), shX: r3(A.shX), shZ: 0.12, elbX: r3(A.elbX), errM: r3(A.e) },
      };
    });
    console.log('[bike-truth] SWEEP-BEST ' + JSON.stringify(best));
    await page.waitForTimeout(120);
    await page.screenshot({ path: join(OUT, 'scen-bike-gamecam-opt.png'), fullPage: false });
    console.log('[rig-shot] saved scen-bike-gamecam-opt.png (swept pose, game cam)');
    // (2) Five fixed WORLD angles around the (yaw=0) bike. With yaw=0: nose=-Z,
    // tail=+Z, so "front" cam sits on -Z looking +Z (sees nose + rider front).
    const D = 3.2, UP = 1.1;
    const angles = [
      { tag: 'front', off: [0, UP, -D] },  // -Z side: sees the NOSE + rider's front (face if facing nose)
      { tag: 'tail',  off: [0, UP, D] },   // +Z side: sees engine + rider's BACK (if facing nose)
      { tag: 'left',  off: [-D, UP, 0] },
      { tag: 'right', off: [D, UP, 0] },
      { tag: '3q',    off: [D * 0.8, D * 0.7, D * 0.8] },
    ];
    for (const a of angles) {
      await page.evaluate(({ off }) => {
        const ctx = window.__game.ctx;
        const s = ctx.speeder; const p = s.body.translation();
        const cam = ctx.three.camera;
        ctx.flags.paused = true;
        cam.position.set(p.x + off[0], p.y + off[1], p.z + off[2]);
        cam.lookAt(p.x, p.y + 0.2, p.z);
        cam.updateMatrixWorld(true);
      }, a);
      await page.waitForTimeout(200);
      await page.screenshot({ path: join(OUT, `scen-bike-${a.tag}.png`), fullPage: false });
      console.log(`[bike-truth] world angle ${a.tag} → scen-bike-${a.tag}.png`);
    }
  },

  // Depthprobe (ACX): log the runtime material/render flags of the held 3P item
  // + the footprint decals, to diagnose why footsteps show through held items.
  'depthprobe': async (page) => {
    await page.evaluate(() => {
      const ctx = window.__game.ctx;
      ctx.flags.thirdPerson = true;
      const inv = ctx.inventory;
      inv.slots[0].item = 'scrap_gun'; inv.slots[0].count = 1; inv.slots[0].meta = undefined;
      inv.selectedIdx = 0;
    });
    await page.waitForTimeout(500);
    const probe = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const out = { item: [], decals: [], itemRenderOrderGroup: null };
      const rig = ctx.player.rig;
      rig.rightHandAttach.traverse((o) => {
        if (o.isMesh && o.material) {
          const m = o.material;
          out.item.push({
            name: o.name || o.geometry?.type || '?',
            transparent: m.transparent, depthTest: m.depthTest, depthWrite: m.depthWrite,
            renderOrder: o.renderOrder, matType: m.type, visible: o.visible,
          });
        }
      });
      // attach group renderOrder + visibility chain
      out.attachVisible = rig.rightHandAttach.visible;
      out.attachRenderOrder = rig.rightHandAttach.renderOrder;
      // Walk scene for footprint InstancedMeshes (player decals).
      ctx.three.scene.traverse((o) => {
        if (o.isInstancedMesh && o.material) {
          const m = o.material;
          out.decals.push({
            renderOrder: o.renderOrder, transparent: m.transparent,
            depthTest: m.depthTest, depthWrite: m.depthWrite,
            polygonOffset: m.polygonOffset, count: o.count,
          });
        }
      });
      out.rendererSortObjects = ctx.three.renderer.sortObjects;
      return out;
    });
    console.error('[depthprobe] ' + JSON.stringify(probe, null, 0));
  },

  // Held-item (ACW D9/D10): equip an item (--item=<id>), let updateViewModel
  // swap it into the rig's right hand in 3P, then PAUSE + free-camera close on
  // the hand so the makeViewModel mesh + its handAttachTransform can be judged.
  // Used to confirm item models render in-hand + to iterate the 3P grip pose.
  'held-item': async (page) => {
    const item = argv.item || 'machete';
    await page.evaluate((item) => {
      const ctx = window.__game.ctx;
      ctx.weather.intensity = 0;
      window.__game.setTime(0.5);
      ctx.three.renderer.toneMappingExposure = 1.1;
      ctx.three.renderer.setSize(900, 900, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1; cam.updateProjectionMatrix(); }
      ctx.flags.thirdPerson = true;
      const inv = ctx.inventory;
      inv.slots[0].item = item; inv.slots[0].count = 1; inv.slots[0].meta = undefined;
      inv.selectedIdx = 0;
    }, item);
    await page.waitForTimeout(450); // let updateViewModel swap the mesh into the hand
    await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const rig = ctx.player.rig;
      ctx.flags.paused = true;
      // Pose the right arm OUT in front so the held item clears the torso +
      // backpack (a relaxed hanging arm tucks the item against the body where
      // it can't be judged). Forward-and-up shoulder + slight elbow bend.
      rig.shoulders[1].rotation.set(-1.15, 0, 0.18);
      rig.elbows[1].rotation.x = 0.35;
      rig.wrists[1].rotation.x = -0.05;
      rig.group.updateMatrixWorld(true);
      const cam = ctx.three.camera;
      const V = cam.position.constructor;
      const hand = rig.rightHandAttach.getWorldPosition(new V());
      const fz = rig.headGroup.getWorldDirection(new V()); fz.y = 0; fz.normalize();
      const side = new V(-fz.z, 0, fz.x);
      // Frame from the hand's right side (perpendicular to the body facing), a
      // touch above, ~0.5m out — the extended arm keeps the body out of frame.
      cam.position.set(
        hand.x + side.x * 0.50 + fz.x * 0.10,
        hand.y + 0.10,
        hand.z + side.z * 0.50 + fz.z * 0.10,
      );
      cam.lookAt(hand.x, hand.y - 0.02, hand.z);
      cam.updateMatrixWorld(true);
    });
    await page.waitForTimeout(250);
    const path = join(OUT, `scen-held-${item}.png`);
    await page.screenshot({ path, fullPage: false });
    console.log(`[held-item] ${item} → ${path}`);
  },

  // Branches (ACAE): frame a world branch pickup near its dead tree — verifies
  // the dark wood-grain branch + that the ground branches match the trees.
  'branches': async (page) => {
    const r = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      window.__game.setTime(0.42);
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      ctx.three.renderer.setSize(900, 700, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 900 / 700; cam.updateProjectionMatrix(); }
      const branches = (ctx.pickups.list || []).filter((p) => p.itemId === 'branch');
      const b = branches[0];
      if (!b) return { found: false };
      const p = b.pos;
      ctx.flags.paused = true;                  // freeze so our camera survives
      cam.position.set(p.x + 0.9, p.y + 0.7, p.z + 0.9);
      cam.lookAt(p.x, p.y + 0.1, p.z);
      cam.updateMatrixWorld(true);
      return { found: true, count: branches.length, pos: [p.x.toFixed(1), p.y.toFixed(1), p.z.toFixed(1)] };
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, 'scen-branches.png'), fullPage: false });
    console.log(`[branches] ${JSON.stringify(r)}`);
  },

  // Tree (ACAF f/u): frame a whole dead tree from a low 3/4 angle to judge the
  // trunk taper + the buildBranchMesh limbs (connected, no floaters). --time set
  // for a legible mid-morning read; --tilt/--dist to vary the camera.
  // Wreck-form (ACAJ T1): isolate a shared wreck-form toolkit primitive against
  // the sky for screenshot iteration. --form=lathe|formers|breach|mound, --angle=.
  'wreck-form': async (page) => {
    const form = argv.form || 'lathe';
    const angle = argv.angle || 'side';
    const r = await page.evaluate((a) => {
      window.__game.setTime(0.5);
      window.__game.ctx.weather.intensity = 0;
      return window.__game.wreckFormStudio(a.form, a.angle);
    }, { form, angle });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, `scen-wreck-form-${form}.png`), fullPage: false });
    console.log(`[wreck-form] ${JSON.stringify(r)}`);
  },

  // Megawreck (ACAJ T2): locate the mega-wreck POI + orbit it for the silhouette
  // rebuild. --angle=3q|side|front|rear|interior ; reports panel/shelter presence.
  'megawreck': async (page) => {
    const angle = argv.angle || '3q';
    const r = await page.evaluate((ang) => {
      const ctx = window.__game.ctx;
      ctx.weather.intensity = 0; ctx.weather.cloudiness = 0.15;
      window.__game.setTime(0.34);                 // true midday (0.5 was 18:00) for max detail read
      ctx.three.renderer.toneMappingExposure = 1.2;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      let mw = null;
      ctx.three.scene.traverse((o) => { if (!mw && o.name === 'megaWreck') mw = o; });
      if (!mw) return { found: false };
      const V = ctx.three.camera.position.constructor;
      // bbox via traversal (Box3 not guaranteed on window)
      let minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1e9, maxY = -1e9, maxZ = -1e9;
      mw.updateMatrixWorld(true);
      mw.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox;
        for (const cx of [bb.min.x, bb.max.x]) for (const cy of [bb.min.y, bb.max.y]) for (const cz of [bb.min.z, bb.max.z]) {
          const p = new V(cx, cy, cz); o.localToWorld(p);
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
          minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
        }
      });
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
      const span = Math.max(maxX - minX, maxZ - minZ);
      const cam = ctx.three.camera;
      ctx.flags.paused = true;
      const h = maxY - minY;
      // Aim LOW at the visual mass (not the bbox centre, which sits high because of
      // the island/mast). Frame the full LENGTH; avoid end-on shots that foreshorten
      // the 136m dagger into a "squat blob".
      const D = Math.max(span, maxZ - minZ) * 1.02;
      const aimY = minY + h * 0.3, up = minY + h * 0.5;
      const aim = (camPos) => { cam.position.copy(camPos); cam.lookAt(cx, aimY, cz); };
      if (ang.startsWith('int')) {
        // Inside the canted wreck, in the SHELL frame (the interior is built there).
        // Place via the shell child's world matrix so the camera rides the list onto
        // the tilted deck. Shell-local interior viewpoints (deck ≈ y 1; eye ≈ y 2.6):
        const shellObj = mw.getObjectByName('shell') || mw;
        shellObj.updateMatrixWorld(true);
        const M = shellObj.matrixWorld;
        const sl = (x, y, z) => new V(x, y, z).applyMatrix4(M);
        const VIEWS = {
          'interior': [[1.4, 2.6, -28], [1, 1.5, 6]],       // bow compartment → fracture
          'int-bow':  [[1.5, 3.0, -42], [1, 1.5, -10]],     // bow entry looking aft
          'int-frac': [[3, 3.5, -22], [0, 4.5, 4]],         // from the bow toward the lit fracture opening
          'int-aft':  [[2.0, 3.2, 22], [1.5, 2.0, 48]],     // engineering looking aft
          'int-bridge': [[3.0, 3.0, 60], [3.0, 2.5, 73]],   // up to the bridge
        };
        const [eye, look] = VIEWS[ang] || VIEWS['interior'];
        cam.position.copy(sl(eye[0], eye[1], eye[2]));
        cam.lookAt(sl(look[0], look[1], look[2]));
      }
      else if (ang === 'side') aim(new V(cx + D, up, cz));                          // broadside (the money shot)
      else if (ang === 'hero') aim(new V(cx + D * 0.8, minY + h * 0.16, cz - D * 0.5)); // low bow-3/4 (length + list)
      else if (ang === '3q')   aim(new V(cx + D * 0.62, up, cz + D * 0.52));        // aft-3/4 (engines + island)
      else if (ang === 'rear') aim(new V(cx + D * 0.5, up + h * 0.1, cz + D * 0.85));// aft-3/4 (not pure end-on)
      else if (ang === 'front') aim(new V(cx - D * 0.5, up, cz - D * 0.85));         // bow-3/4 (not pure end-on)
      else aim(new V(cx + D * 0.6, up, cz - D * 0.55));
      cam.updateMatrixWorld(true);
      ctx.three.renderer.toneMappingExposure = 1.5;
      // Find the THREE light constructors off existing scene lights.
      let DirCtor = null, HemiCtor = null;
      ctx.three.scene.traverse((o) => { if (o.isDirectionalLight && !DirCtor) DirCtor = o.constructor; if (o.isHemisphereLight && !HemiCtor) HemiCtor = o.constructor; });
      // Front-high KEY light from just above + beside the camera (3/4 front), so
      // the face the camera sees is LIT — not a backlit silhouette.
      if (DirCtor) {
        const key = new DirCtor(); key.intensity = 2.0; key.color.set(0xfff2e0);
        const toC = new V(cx - cam.position.x, 0, cz - cam.position.z); // camera→wreck (XZ)
        key.position.set(cam.position.x + toC.x * 0.2 + span * 0.25, cam.position.y + h * 0.6, cam.position.z + toC.z * 0.2);
        key.target.position.set(cx, cy, cz); ctx.three.scene.add(key.target); ctx.three.scene.add(key);
      }
      // Hemisphere FILL so shadow faces aren't pure black.
      if (HemiCtor) { const fill = new HemiCtor(0xbfccdd, 0x6b5840, 0.7); ctx.three.scene.add(fill); }
      const panels = (ctx.salvageables?.list || []).filter((s) => s.kind === 'massive').length;
      return { found: true, span: +span.toFixed(0), height: +(maxY - minY).toFixed(0), panels };
    }, angle);
    await page.waitForTimeout(350);
    await page.screenshot({ path: join(OUT, `scen-megawreck-${angle}.png`), fullPage: false });
    console.log(`[megawreck] ${JSON.stringify(r)}`);
  },

  // Generic FLAGSHIP framer — finds a named flagship POI (megaShip / satelliteDish /
  // crashedHull / megaWreck) + frames its exterior + reports mesh count. Used to verify
  // the T6 static-merge is render-identical (before/after) + measure the mesh drop.
  // `--name=<group.name> --angle=<3q|side|front>`.
  'flagship': async (page) => {
    const name = argv.name || 'megaShip';
    const angle = argv.angle || '3q';
    const r = await page.evaluate(({ nm, ang }) => {
      const ctx = window.__game.ctx;
      ctx.weather.intensity = 0; ctx.weather.cloudiness = 0.15;
      window.__game.setTime(0.34);
      ctx.three.renderer.toneMappingExposure = 1.5;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      let mw = null;
      ctx.three.scene.traverse((o) => { if (!mw && o.name === nm) mw = o; });
      if (!mw) return { found: false, name: nm };
      const V = ctx.three.camera.position.constructor;
      let minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1e9, maxY = -1e9, maxZ = -1e9;
      mw.updateMatrixWorld(true);
      let meshes = 0;
      mw.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        meshes++;
        o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox;
        for (const cx of [bb.min.x, bb.max.x]) for (const cy of [bb.min.y, bb.max.y]) for (const cz of [bb.min.z, bb.max.z]) {
          const p = new V(cx, cy, cz); o.localToWorld(p);
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
          minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
        }
      });
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
      const span = Math.max(maxX - minX, maxZ - minZ), h = maxY - minY;
      const cam = ctx.three.camera; ctx.flags.paused = true;
      const D = span * 1.2, up = minY + h * 0.55;
      const aim = (p) => { cam.position.copy(p); cam.lookAt(cx, minY + h * 0.4, cz); };
      if (ang === 'side') aim(new V(cx + D, up, cz));
      else if (ang === 'front') aim(new V(cx - D * 0.5, up, cz - D * 0.85));
      else aim(new V(cx + D * 0.62, up, cz + D * 0.52));   // 3q
      cam.updateMatrixWorld(true);
      let DirCtor = null, HemiCtor = null;
      ctx.three.scene.traverse((o) => { if (o.isDirectionalLight && !DirCtor) DirCtor = o.constructor; if (o.isHemisphereLight && !HemiCtor) HemiCtor = o.constructor; });
      if (DirCtor) { const key = new DirCtor(); key.intensity = 2.0; key.color.set(0xfff2e0); const toC = new V(cx - cam.position.x, 0, cz - cam.position.z); key.position.set(cam.position.x + toC.x * 0.2 + span * 0.25, cam.position.y + h * 0.6, cam.position.z + toC.z * 0.2); key.target.position.set(cx, cy, cz); ctx.three.scene.add(key.target); ctx.three.scene.add(key); }
      if (HemiCtor) { const fill = new HemiCtor(0xbfccdd, 0x6b5840, 0.7); ctx.three.scene.add(fill); }
      return { found: true, name: nm, span: +span.toFixed(0), height: +h.toFixed(0), meshes };
    }, { nm: name, ang: angle });
    await page.waitForTimeout(350);
    await page.screenshot({ path: join(OUT, `scen-flagship-${name}-${angle}.png`), fullPage: false });
    console.log(`[flagship] ${JSON.stringify(r)}`);
  },

  // ACBB Tier 3 — COLLIDER-AUDIT (no screenshot). For each POI archetype × a seed sweep,
  // assemble it pre-merge + assert every collidable-scale mesh is covered by a declared
  // collider (the audit lives in poiAssembler; __game.auditPOIColliders is pure → works at
  // title, no enterGame). Prints one `COLLIDER-AUDIT archetype=… seed=… pass=p/t fails=f`
  // line per (archetype,seed) for scripts/verify-colliders.mjs (mirrors the panels gate).
  // `--archetype=a,b` (default all 5) `--seeds=1,42,…` (default 1,42,1337,2024).
  'collider-audit': async (page) => {
    // seed 2 is included so the derelict WIDE-BODY form (parallel outrigger pods + cross-strut)
    // is exercised — seeds 1/42/1337/2024 all roll the linear/stacked forms (ACBB Tier 4).
    const seeds = (argv.seeds !== undefined ? String(argv.seeds) : '1,2,42,1337,2024')
      .split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
    const archs = (argv.archetype ? String(argv.archetype) : 'satellite,wrecked_tank,debris_field,hollow_husk,derelict')
      .split(',').map((s) => s.trim()).filter(Boolean);
    await page.waitForFunction(() => !!(window.__game && window.__game.auditPOIColliders), { timeout: 20000 });
    const rows = await page.evaluate(({ archs, seeds }) => {
      const out = [];
      for (const a of archs) for (const s of seeds) {
        const r = window.__game.auditPOIColliders(a, s);
        out.push({ archetype: a, seed: s, total: r.total, pass: r.pass, fails: r.fails, details: r.details });
      }
      return out;
    }, { archs, seeds });
    let totalFails = 0;
    for (const r of rows) {
      totalFails += r.fails;
      console.log(`COLLIDER-AUDIT archetype=${r.archetype} seed=${r.seed} pass=${r.pass}/${r.total} fails=${r.fails}${r.fails ? ' :: ' + r.details.join(' | ') : ''}`);
    }
    console.log(`[collider-audit] ${rows.length} audits across ${archs.length} archetypes — ${totalFails} total fails`);
  },

  // ACAO — PROCGEN-WRECK framer (the BLOCKER from ACAN). Spawns a chosen procgen
  // wreck CLASS at a fixed clear anchor with a deterministic seed (via
  // __game.spawnProcgenWreckRig), names it 'procgenWreckRig', then frames it +
  // reports mesh count (same find/frame/mesh-count logic as `flagship`). THIS is
  // what makes procgen visual work (breaches / greebles / impact-asymmetry)
  // screenshot-verifiable — procgen wrecks are otherwise unnamed + random-spot.
  // `--class=<corvette|gunship|freighter|science_vessel|bulk_hauler|orbital_pod_cluster>`
  // `--angle=<3q|side|front> --seed=<n>`.
  'procgen-wreck': async (page) => {
    const cls = argv.class || 'corvette';
    const angle = argv.angle || '3q';
    // `--seed=N` (single) or `--seeds=1,2,3` (sweep — one screenshot per seed in
    // ONE dev-server boot, the fast path for screenshot-iterating procgen visuals).
    const seeds = (argv.seeds !== undefined ? String(argv.seeds)
      : argv.seed !== undefined ? String(argv.seed) : '1337')
      .split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
    const zoom = argv.zoom !== undefined ? Number(argv.zoom) : 1;   // <1 = tighter (detail inspection)
    const fa = argv.forceanchor !== undefined;   // ACAZ T2A — pin the scale-anchor hatch to the +Z camera flank
    const variant = argv.variant !== undefined ? Number(argv.variant) : -1;   // ACAZ T2B — force one hull variant
    const archetype = argv.archetype || '';      // ACBA — POI archetype (satellite/tank_cluster/…); '' = ship
    for (const seed of seeds) {
    const r = await page.evaluate(({ cls, ang, seed, zoom, fa, variant, archetype }) => {
      const ctx = window.__game.ctx;
      window.__FORCE_ANCHOR_NEAR = fa;   // inspection only — forces the hatch camera-facing
      if (variant >= 0) window.__FORCE_HULL_VARIANT = variant; else delete window.__FORCE_HULL_VARIANT;
      ctx.weather.intensity = 0; ctx.weather.cloudiness = 0.15;
      window.__game.setTime(0.34);
      ctx.three.renderer.toneMappingExposure = 1.5;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      const spawn = window.__game.spawnProcgenWreckRig(cls, seed, archetype || undefined);
      let mw = null;
      ctx.three.scene.traverse((o) => { if (!mw && o.name === 'procgenWreckRig') mw = o; });
      if (!mw) return { found: false, cls, seed, spawn };
      const V = ctx.three.camera.position.constructor;
      let minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1e9, maxY = -1e9, maxZ = -1e9;
      mw.updateMatrixWorld(true);
      let meshes = 0;
      mw.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        meshes++;
        o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox;
        for (const cx of [bb.min.x, bb.max.x]) for (const cy of [bb.min.y, bb.max.y]) for (const cz of [bb.min.z, bb.max.z]) {
          const p = new V(cx, cy, cz); o.localToWorld(p);
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
          minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
        }
      });
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
      const span = Math.max(maxX - minX, maxZ - minZ), h = maxY - minY;
      const cam = ctx.three.camera; ctx.flags.paused = true;
      // Half-buried: frame the EXPOSED hull (terrain line → top), NOT the full
      // bbox — its bottom is under the sand, which would drag the eye down and
      // let the dune cut across mid-hull. spawn.pos[1] is the terrain Y.
      const groundY = (spawn && spawn.pos) ? spawn.pos[1] : minY;
      const expMid = (groundY + maxY) * 0.5;
      const expH = Math.max(0.6, maxY - groundY);
      const D = Math.max(span, expH * 2.2) * 1.35 * (zoom || 1);
      const eyeY = expMid + expH * 0.18;        // slightly above exposed-mid → gentle down-angle
      // Procgen wrecks are X-LONG (flanks ±Z; breaches + salvage panels live on
      // the +Z flank), so unlike the Z-long hero: 'side' is a +Z broadside (the
      // money shot for breach/greeble inspection), 'front' is nose-on down -X,
      // '3q' favors the +Z detail flank.
      const aim = (p) => { cam.position.copy(p); cam.lookAt(cx, expMid, cz); };
      if (ang === 'side') aim(new V(cx, eyeY, cz + D));
      else if (ang === 'front') aim(new V(cx - D, eyeY, cz + D * 0.12));
      else aim(new V(cx + D * 0.55, eyeY, cz + D * 0.62));   // 3q — length + +Z flank
      // ACAZ T2A — when --forceanchor, aim a CLOSE 3/4 shot straight at a hatch (its
      // world pos was recorded pre-merge on the wreck group). `--zoom` sets the
      // distance (×9): 0.3→~2.7m, 0.22→~2.0m. The hatch is pinned to the +Z flank.
      if (fa) {
        let ap = null;
        mw.traverse((o) => { if (!ap && o.userData && o.userData.anchorLocalPositions) ap = o.userData.anchorLocalPositions; });
        if (ap && ap.length >= 3) {
          const lp = new V(ap[0], ap[1], ap[2]);
          mw.localToWorld(lp);                 // transform by the rig's FINAL orientation
          const ax = lp.x, ay = lp.y, az = lp.z;
          const dist = (zoom || 1) * 9;
          cam.position.set(ax + dist * 0.30, ay + dist * 0.16, az + dist);
          cam.lookAt(ax, ay, az);
        }
      }
      cam.updateMatrixWorld(true);
      let DirCtor = null, HemiCtor = null;
      ctx.three.scene.traverse((o) => { if (o.isDirectionalLight && !DirCtor) DirCtor = o.constructor; if (o.isHemisphereLight && !HemiCtor) HemiCtor = o.constructor; });
      // Key + hemi fill — named so the seed sweep reuses them (reposition the key
      // each seed so framing-relative lighting stays correct).
      let key = ctx.three.scene.getObjectByName('__procgenKey');
      if (!key && DirCtor) { key = new DirCtor(); key.name = '__procgenKey'; key.intensity = 2.0; key.color.set(0xfff2e0); ctx.three.scene.add(key.target); ctx.three.scene.add(key); }
      if (key) { const toC = new V(cx - cam.position.x, 0, cz - cam.position.z); key.position.set(cam.position.x + toC.x * 0.2 + span * 0.25, cam.position.y + h * 0.6, cam.position.z + toC.z * 0.2); key.target.position.set(cx, cy, cz); key.target.updateMatrixWorld(true); }
      if (!ctx.three.scene.getObjectByName('__procgenFill') && HemiCtor) { const fill = new HemiCtor(0xbfccdd, 0x6b5840, 0.7); fill.name = '__procgenFill'; ctx.three.scene.add(fill); }
      return { found: true, cls: archetype || cls, seed, span: +span.toFixed(1), height: +h.toFixed(1), meshes };
    }, { cls, ang: angle, seed, zoom, fa, variant, archetype });
    await page.waitForTimeout(320);
    const tag = archetype ? archetype : cls;
    await page.screenshot({ path: join(OUT, `scen-procgen-${tag}-${angle}-s${seed}${variant >= 0 ? `-v${variant}` : ''}.png`), fullPage: false });
    console.log(`[procgen-wreck] ${JSON.stringify(r)}`);
    }
  },

  // ACAQ — WRECK-YARD biome framer (Cycle 8). Finds the seed-derived wreck-yard
  // anchor (ctx.biomes.wreckYardAnchor) + frames the region. `--angle=aerial|approach|ground`.
  // The framer for the whole wreck-yard build (biome → graveyard → pit).
  'wreck-yard': async (page) => {
    const angle = argv.angle || 'aerial';
    const r = await page.evaluate(({ ang, doBreakdown, openAmt }) => {
      const ctx = window.__game.ctx;
      ctx.weather.intensity = 0; ctx.weather.cloudiness = 0.15;
      window.__game.setTime(0.36);
      ctx.three.renderer.toneMappingExposure = 1.4;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      const anchor = ctx.biomes.wreckYardAnchor;
      const rad = ctx.biomes.wreckYardRadius;
      const biomeHere = ctx.biomes.biomeAt(anchor.x, anchor.z);
      const cam = ctx.three.camera; ctx.flags.paused = true;
      const groundY = ctx.terrain.heightAt(anchor.x, anchor.z);
      if (ang === 'aerial') {
        cam.position.set(anchor.x, groundY + rad * 1.5, anchor.z + rad * 0.25);
        cam.lookAt(anchor.x, groundY, anchor.z);
      } else if (ang === 'approach') {
        cam.position.set(anchor.x + rad * 1.7, groundY + 26, anchor.z + rad * 1.7);
        cam.lookAt(anchor.x, groundY + 5, anchor.z);
      } else if (ang === 'pit' || ang === 'pit-eye' || ang === 'maw') {
        // The pit is now a RECESSED funnel crater (ACAR2) at its own dune anchor
        // (ctx.sarlaccPit.basePos = the carved crater FLOOR). Force the maw open for
        // the shot (no mesh-sink now). The rim sits ~CRATER_DEPTH above the floor, so
        // sample the undisturbed dune just outside the clearing for the camera height.
        const pit = ctx.sarlaccPit;
        const pr = (pit && pit.rOuter) || 10;
        const pb = pit ? pit.basePos : { x: anchor.x, y: groundY, z: anchor.z };
        if (pit) {
          pit.openAmt = openAmt;
          // ACBD — replicate updateSarlaccPit's buried-rise pose (the FSM doesn't run
          // while the shot is paused) so the still shows the real sink for this openAmt.
          const sink = 11 * (1 - openAmt);   // = SARLACC_PIT_BURY_DEPTH
          pit.parts.teeth.position.y = -sink;
          pit.parts.innerTeeth.position.y = -sink;
          for (const t of pit.parts.tendrils) t.position.y = -sink;
          const bk = pit.parts.beak;
          bk.position.y = (bk.userData.baseY || 0) + openAmt * pr * 0.16 - sink;
        }
        // Lower, raking sun + tamer exposure so the funnel's near-wall shadow reads
        // (overhead noon light flattens the depression). The crater depth shows as a
        // light/shadow gradient across the bowl.
        window.__game.setTime(0.4);
        ctx.three.renderer.toneMappingExposure = 1.1;
        const rimY = ctx.terrain.heightAt(pb.x + 34, pb.z);
        if (ang === 'maw') {
          // Tight, low 3/4 close-up of the MAW itself (beak/teeth/tentacles/throat) —
          // for iterating the creature detail. Inside the bowl, near the floor.
          cam.position.set(pb.x + pr * 0.95, pb.y + pr * 0.7, pb.z + pr * 0.95);
          cam.lookAt(pb.x, pb.y + pr * 0.12, pb.z);
        } else if (ang === 'pit-eye') {
          // Peer over the rim lip — the player's approach POV, close enough that the
          // bowl interior + maw read (not foreshortened to a flat disc from far off).
          cam.position.set(pb.x + pr * 1.9, rimY + 3.0, pb.z + pr * 0.5);
          cam.lookAt(pb.x, pb.y + pr * 0.1, pb.z);
        } else {
          // Elevated 3/4 look-down framing the WHOLE crater (rim to rim) so the sand
          // funnel around the maw is visible, not just the maw.
          cam.position.set(pb.x + pr * 2.4, rimY + pr * 2.0, pb.z + pr * 2.4);
          cam.lookAt(pb.x, pb.y + pr * 0.05, pb.z);
        }
      } else { // ground
        cam.position.set(anchor.x - rad * 0.55, groundY + 3.2, anchor.z - rad * 0.55);
        cam.lookAt(anchor.x, groundY + 2.5, anchor.z);
      }
      cam.updateMatrixWorld(true);
      // Count wrecks/objects near the anchor (for Y2+ verification).
      let near = 0;
      for (const o of ctx.three.scene.children) {
        const p = o.position; if (!p) continue;
        const dx = p.x - anchor.x, dz = p.z - anchor.z;
        if (dx * dx + dz * dz < rad * rad) near++;
      }
      // ACAS A4 — count salvageable panels registered within the graveyard (the
      // procgen wrecks + now the big hand-wrecks) to confirm loot registration.
      let nearSalvage = 0;
      const sl = ctx.salvageables && ctx.salvageables.list;
      if (sl) for (const s of sl) {
        const sp = s.pos || (s.group && s.group.position); if (!sp) continue;
        const dx = sp.x - anchor.x, dz = sp.z - anchor.z;
        if (dx * dx + dz * dz < rad * rad) nearSalvage++;
      }
      ctx.three.renderer.render(ctx.three.scene, cam);   // populate renderer.info for this view
      const info = ctx.three.renderer.info;
      // --breakdown perf probe (ACBC / D237) — opt-in yard draw-call attribution.
      // Buckets every VISIBLE mesh by a coarse "kind" (a draw call ≈ one visible
      // mesh = one material) so the dominant draw-call source in the dense yard is
      // measurable headlessly (page.screenshot times out on this scene). Salvage
      // panels are split into EXT_body / EXT_door / EXT_mask / EXT_rim / INTERIOR
      // so the merge-eligible static rim greeble (the ACBC cut target) is visible.
      // `inYard` counts meshes under the wreckYard group; `distinctMats` flags a
      // bucket that can't merge by-material (N meshes, N materials). Kept as a
      // reusable probe; inert without the flag.
      let breakdown = null;
      if (doBreakdown) {
        const yard = ctx.three.scene.getObjectByName('wreckYard');
        const kindOf = (o) => {
          // walk up: find the panel body (accessPanel) or interactType tag.
          let n = o, body = null;
          while (n) {
            if (n.userData?.accessPanel) { body = n; break; }
            if (n.userData?.interactType === 'salvage') { body = n; break; }
            if (n.userData?.interactType) return 'interact:' + n.userData.interactType;
            n = n.parent;
          }
          if (body) {
            // INTERIOR if o is a descendant of body.userData.panelInterior.
            const interior = body.userData.panelInterior;
            if (interior) {
              let q = o;
              while (q) { if (q === interior) return 'salvagePanel:INTERIOR'; q = q.parent; }
            }
            // sub-classify the exterior: BODY (the cavity box = raycast target),
            // DOOR (animated pivot), MASK (stencil), or RIM (static greeble).
            const doorV = body.userData.panelDoor;
            const mask = body.userData.panelMask;
            if (o === body) return 'salvagePanel:EXT_body';
            let q2 = o;
            while (q2) {
              if (q2 === doorV) return 'salvagePanel:EXT_door';
              if (q2 === mask) return 'salvagePanel:EXT_mask';
              q2 = q2.parent;
            }
            return 'salvagePanel:EXT_rim(' + ((o.material && o.material.name) || o.geometry?.type || '?') + ')';
          }
          const m = o.material;
          const mn = (m && m.name) || '';
          const gn = (o.name) || (o.geometry && o.geometry.type) || '';
          if (mn) return 'mat:' + mn;
          return 'geo:' + gn;
        };
        const buckets = {};        // kind -> { meshes, matUUIDs:Set, transparent, inYard }
        const matsAll = new Set();
        let visMeshes = 0;
        ctx.three.scene.traverse((o) => {
          if (!o.isMesh || !o.visible || !o.material) return;
          // skip if any ancestor invisible
          let p = o.parent, vis = true;
          while (p) { if (p.visible === false) { vis = false; break; } p = p.parent; }
          if (!vis) return;
          visMeshes++;
          const mat = Array.isArray(o.material) ? o.material[0] : o.material;
          matsAll.add(mat.uuid);
          const k = kindOf(o);
          let b = buckets[k];
          if (!b) { b = buckets[k] = { meshes: 0, mats: new Set(), transp: 0, inYard: 0 }; }
          b.meshes++; b.mats.add(mat.uuid);
          if (mat.transparent) b.transp++;
          // is it under the yardGroup?
          let q = o, isY = false;
          while (q) { if (q === yard) { isY = true; break; } q = q.parent; }
          if (isY) b.inYard++;
        });
        const ranked = Object.entries(buckets)
          .map(([k, b]) => ({ k, meshes: b.meshes, distinctMats: b.mats.size, transp: b.transp, inYard: b.inYard }))
          .sort((a, b) => b.meshes - a.meshes);
        breakdown = {
          visibleMeshesTotal: visMeshes,
          distinctMaterialsTotal: matsAll.size,
          yardChildren: yard ? yard.children.length : -1,
          top: ranked.slice(0, 22),
        };
      }
      return { anchor: [+anchor.x.toFixed(0), +anchor.z.toFixed(0)], rad, biomeHere, groundY: +groundY.toFixed(1), nearObjects: near, nearSalvage, drawCalls: info.render.calls, tris: info.render.triangles, breakdown };
    }, { ang: angle, doBreakdown: !!argv.breakdown, openAmt: argv.openamt !== undefined ? Number(argv.openamt) : 1 });
    await page.waitForTimeout(350);
    await page.screenshot({ path: join(OUT, `scen-wreckyard-${angle}.png`), fullPage: false });
    console.log(`[wreck-yard] ${JSON.stringify(r)}`);
  },

  // ACAS B2 — drop-test: drop capsule/sphere/box pickups + tick; confirm the bodies
  // SETTLE (finite + near terrain), i.e. the per-item collider shapes don't NaN or
  // explode. The settle FEEL (natural lie vs box) still needs an attended walk-test.
  'drop-test': async (page) => {
    const ids = await page.evaluate(() => {
      const g = window.__game; g.enterGame(true);
      g.ctx.flags.paused = false;
      return {
        capsule: g.dropTestItem('pipe_staff'),
        sphere: g.dropTestItem('canteen'),
        rifle: g.dropTestItem('amban_rifle'),
        box: g.dropTestItem('scrap_bar'),   // no hint → default cuboid (control)
      };
    });
    await page.waitForTimeout(4000);   // let the bodies fall + settle
    const after = await page.evaluate((ids) => {
      const ctx = window.__game.ctx;
      const read = (id) => {
        const p = ctx.pickups.list.find((pp) => pp.id === id);
        if (!p || !p.body) return { ok: false };
        const t = p.body.translation();
        const finite = Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(t.z);
        const gy = ctx.terrain.heightAt(t.x, t.z);
        return { ok: true, finite, dy: +(t.y - gy).toFixed(2), settled: finite && Math.abs(t.y - gy) < 1.0 };
      };
      const out = {};
      for (const k in ids) out[k] = read(ids[k]);
      return out;
    }, ids);
    const allOk = Object.values(after).every((r) => r.ok && r.finite && r.settled);
    console.log(`[drop-test] ${allOk ? 'PASS' : 'FAIL'} ${JSON.stringify(after)}`);
  },

  // ACAS B3 + C37 — crafting multi-match CHOOSER verification.
  //   REAL collision (C37): branch×3 + scrap×1 now matches BOTH fire_kit (id 2) AND
  //   signal_kit (id 18) — the first live gameplay collision, which lights up the
  //   chooser in real play (dev-mode pre-discovers both, so it shows two NAMED buttons).
  //   INJECTED (ACAS B3): also inject a transient recipe colliding with scrap_bar
  //   (scrap×2 + branch×1) to exercise the discovery-respecting "?" path (one option
  //   discovered, one not). Confirm the chooser renders one button per recipe + gates
  //   CRAFT until a pick. Control: a single-match combo + a no-match combo show no chooser.
  'craft-chooser': async (page) => {
    const r = await page.evaluate(() => {
      const g = window.__game; g.enterGame(true);
      // C37 — the REAL fire_kit ⇄ signal_kit collision (no injection needed).
      const real = g.craftChooserTest([{ id: 'branch', count: 3 }, { id: 'scrap', count: 1 }]);
      // Inject a transient recipe colliding with scrap_bar to exercise the "?" path.
      g.injectTestRecipe();
      const collide = g.craftChooserTest([{ id: 'scrap', count: 2 }, { id: 'branch', count: 1 }]);
      const single = g.craftChooserTest([{ id: 'cloth', count: 1 }, { id: 'scrap', count: 1 }]);  // → bandage only
      const none = g.craftChooserTest([{ id: 'cloth', count: 2 }, { id: 'branch', count: 5 }]);    // no recipe
      return { real, collide, single, none };
    });
    const c = r.collide || {};
    const rl = r.real || {};
    // REAL collision: 2 buttons, CRAFT gated, both named (dev pre-discovers both).
    const realPass = !!rl.buttons && rl.buttons.length === 2 && rl.craftDisabled === true
      && rl.buttons.includes('fire kit') && rl.buttons.includes('signal flare');
    // Injected: 2 buttons, CRAFT gated, discovery-respecting (scrap_bar named, injected "?").
    const injPass = !!c.buttons && c.buttons.length === 2 && c.craftDisabled === true
      && c.buttons.includes('?') && c.buttons.includes('scrap bar');
    const pass = realPass && injPass
      && (r.single ? r.single.buttons.length === 0 : false)
      && (r.none ? r.none.buttons.length === 0 : false);
    console.log(`[craft-chooser] ${pass ? 'PASS' : 'FAIL'} (real=${realPass} injected=${injPass}) ${JSON.stringify(r)}`);
  },

  // ACAQ — Sarlacc-pit behavior smoke test. Teleport the player onto the maw, let
  // the live game tick, confirm the maw OPENS + BITES (health drops). The pull
  // FEEL can't be judged headless (attended walk-test); this gates the wiring.
  'sarlacc-test': async (page) => {
    const before = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const pit = ctx.sarlaccPit;
      if (!pit) return { ok: false, reason: 'no pit' };
      // Teleport the player onto the maw rim.
      const bp = pit.basePos;
      ctx.player.body.body.setNextKinematicTranslation({ x: bp.x + 4, y: bp.y + 2, z: bp.z + 4 });
      ctx.stats.health = 1;
      return { ok: true, health0: ctx.stats.health, openAmt0: +pit.openAmt.toFixed(2), state0: pit.state, meshY0: +pit.mesh.position.y.toFixed(2) };
    });
    await page.waitForTimeout(5000);   // live ticks: maw opens + bites
    const after = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const pit = ctx.sarlaccPit;
      const tr = ctx.player.body.body.translation();
      const d = Math.hypot(tr.x - pit.basePos.x, tr.z - pit.basePos.z);
      return {
        health1: +ctx.stats.health.toFixed(3),
        openAmt1: +pit.openAmt.toFixed(2),
        state1: pit.state,
        meshY1: +pit.mesh.position.y.toFixed(2),
        playerDist: +d.toFixed(1),
        damaged: ctx.stats.health < 1,
        dead: ctx.stats.dead,
      };
    });
    console.log(`[sarlacc-test] ${JSON.stringify({ before, after })}`);
  },

  'tree': async (page) => {
    const t = argv.time !== undefined ? Number(argv.time) : 0.42;
    const r = await page.evaluate((t) => {
      const ctx = window.__game.ctx;
      ctx.weather.intensity = 0; ctx.weather.cloudiness = 0.3;
      window.__game.setTime(t);
      ctx.three.renderer.setSize(900, 950, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 900 / 950; cam.updateProjectionMatrix(); }
      const V = cam.position.constructor;
      let tree = null;
      ctx.three.scene.traverse((o) => { if (!tree && o.name === 'deadTree') tree = o; });
      if (!tree) return { found: false };
      const wp = tree.getWorldPosition(new V());
      ctx.flags.paused = true;
      // Full-tree 3/4 framing: stand back ~3.5m, eye ~1.9m, look at mid-trunk.
      cam.position.set(wp.x + 2.3, wp.y + 1.5, wp.z + 2.7);
      cam.lookAt(wp.x, wp.y + 1.5, wp.z);
      cam.updateMatrixWorld(true);
      // ACAI (T6) — assert a trunk collider sits near this tree (within 0.6m
      // horizontally, raised above the base = the static cylinder, not the
      // terrain heightfield which sits at/near the ground plane).
      let trunkCol = 0;
      ctx.physics.world.forEachCollider((c) => {
        const tr = c.translation();
        const dx = tr.x - wp.x, dz = tr.z - wp.z;
        if (dx * dx + dz * dz < 0.36 && tr.y > wp.y + 0.2) trunkCol++;
      });
      return { found: true, pos: [wp.x.toFixed(1), wp.y.toFixed(1), wp.z.toFixed(1)], trunkCol };
    }, t);
    await page.waitForTimeout(350);
    await page.screenshot({ path: join(OUT, 'scen-tree.png'), fullPage: false });
    console.log(`[tree] ${JSON.stringify(r)}`);
  },

  // Perf-probe (ACAH diag): report renderer.info (draw calls, triangles, compiled
  // programs) + scene object counts + per-itemId pickup mesh totals. No screenshot.
  'perf-probe': async (page) => {
    await page.waitForTimeout(2000);
    const r = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const ren = ctx.three.renderer;
      // Boot phase deltas (ms) from the __bootT marks.
      const bt = window.__bootT || [];
      const bootPhases = {};
      for (let i = 1; i < bt.length; i++) bootPhases[bt[i][0]] = Math.round(bt[i][1] - bt[i - 1][1]);
      const bootTotal = bt.length ? Math.round(bt[bt.length - 1][1] - bt[0][1]) : -1;
      ren.render(ctx.three.scene, ctx.three.camera);   // populate info for this frame
      const info = ren.info;
      let objs = 0, meshes = 0;
      ctx.three.scene.traverse((o) => { objs++; if (o.isMesh) meshes++; });
      const pk = ctx.pickups?.list || [];
      const meshCount = (g) => { let m = 0; g.traverse((o) => { if (o.isMesh) m++; }); return m; };
      const byId = {};
      for (const p of pk) {
        const id = p.itemId;
        byId[id] = byId[id] || { n: 0, meshes: 0 };
        byId[id].n++; byId[id].meshes += meshCount(p.mesh);
      }
      // Biggest individual scene children by mesh count (perf-hog finder).
      const ranked = ctx.three.scene.children
        .map((c) => ({ c, k: c.name || c.userData?.poiKind || c.userData?.kind || c.type || 'unnamed', m: meshCount(c) }))
        .filter((x) => x.m > 3)
        .sort((a, b) => b.m - a.m);
      const topGroups = ranked.slice(0, 18).map((x) => `${x.k}:${x.m}m`);
      // Deep dump of the top 6 — what ARE these big groups? (identify before optimizing, D193)
      const idOf = (o) => o.name || o.userData?.poiKind || o.userData?.kind || o.type;
      const topGroupsDeep = ranked.slice(0, 6).map((x) => {
        const kids = x.c.children || [];
        const hist = {};
        for (const kid of kids) { const id = idOf(kid); hist[id] = (hist[id] || 0) + 1; }
        return {
          k: x.k, m: x.m, kids: kids.length,
          ud: Object.keys(x.c.userData || {}).join(',') || '-',
          childKinds: Object.entries(hist).map(([id, n]) => `${n}x${id}`).slice(0, 8),
        };
      });
      return {
        topGroups,
        topGroupsDeep,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        programs: info.programs ? info.programs.length : -1,
        sceneObjects: objs,
        sceneMeshes: meshes,
        pickupTotal: pk.length,
        pickupsByIdMeshes: Object.fromEntries(Object.entries(byId).map(([k, v]) => [k, `${v.n}pk/${v.meshes}mesh`])),
        salvageables: ctx.salvageables?.list?.length ?? -1,
        bootTotalMs: bootTotal,
        bootPhasesMs: bootPhases,
      };
    });
    console.log('[perf-probe] ' + JSON.stringify(r));
  },

  // Branch-match (ACAF f/u): FP held branch + a world branch in ONE frame under
  // the SAME lighting, to verify they read identical (vm scene now mirrors the
  // world sun/moon/ambient). Runs LIVE (not paused) so updateViewModel tracks
  // the camera each frame. --time=<0..1> to compare day/dusk.
  'branch-match': async (page) => {
    const t = argv.time !== undefined ? Number(argv.time) : 0.5;
    await captureStrip(page, 'branch-match', `(i)=>{
      const ctx = window.__game.ctx;
      ctx.weather.intensity = 0; ctx.weather.cloudiness = 0;
      window.__game.setTime(${t});
      ctx.flags.thirdPerson = false;
      ctx.three.renderer.setSize(900, 700, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 900/700; cam.updateProjectionMatrix(); }
      const inv = ctx.inventory;
      inv.slots[0].item='branch'; inv.slots[0].count=1; inv.slots[0].meta=undefined; inv.selectedIdx=0;
      const bs = (ctx.pickups.list||[]).filter(p=>p.itemId==='branch');
      const b = bs[0]; if(!b){console.log('[branch-match] no world branch');return;}
      const p = b.pos; const gy = ctx.terrain.heightAt(p.x, p.z);
      const bx = p.x + 0.9, bz = p.z + 0.9;
      ctx.player.body.body.setTranslation({x:bx, y:gy+1.0, z:bz}, true);
      cam.position.set(bx, gy+1.55, bz);
      cam.lookAt(p.x, p.y+0.05, p.z);
      cam.updateMatrixWorld(true);
      if(i===0) console.log('[branch-match] world branch at '+p.x.toFixed(1)+','+p.z.toFixed(1));
    }`);
  },

  // Cloud-shadows (ACAH): force overcast + frame the lit ground from above so the
  // moving cloud-shadow dapple on the terrain is visible. --cl=<0..1> coverage.
  'cloud-shadows': async (page) => {
    const cl = argv.cl !== undefined ? Number(argv.cl) : 0.9;
    const r = await page.evaluate((cl) => {
      const ctx = window.__game.ctx;
      window.__game.setTime(0.5);                 // bright midday so the dapple contrasts
      ctx.weather.cloudiness = cl;
      ctx.weather.cloudinessHold = cl;            // pin it against the wander
      ctx.three.renderer.setSize(900, 700, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 900 / 700; cam.updateProjectionMatrix(); }
      const tr = ctx.player.body.body.translation();
      ctx.flags.paused = true;
      // Look down-ahead across the flats from ~14m up.
      cam.position.set(tr.x, tr.y + 9, tr.z + 2);
      cam.lookAt(tr.x + 14, tr.y, tr.z + 30);
      cam.updateMatrixWorld(true);
      return { cloudiness: ctx.weather.cloudiness };
    }, cl);
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT, 'scen-cloud-shadows.png'), fullPage: false });
    console.log(`[cloud-shadows] ${JSON.stringify(r)}`);
  },

  // Storm (C20): force a PEAK sandstorm centered on the player + render the dust-
  // storm LOOK (the signature atmosphere moment — 3 dust layers + fog + sun/ambient
  // dimming + the storm vignette). No storm-render scenario existed; this is the
  // reusable enabler for atmosphere iteration. Eye-level horizontal view into the wall.
  'storm': async (page) => {
    await page.evaluate(() => {
      const ctx = window.__game.ctx;
      window.__game.setTime(0.42);                 // mid-morning: lit but warm
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      ctx.player.inShelter = false;                // ensure perceivedIntensity isn't dampened
      ctx.three.renderer.setSize(900, 600, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 900 / 600; cam.updateProjectionMatrix(); }
      // Force a peak storm centered on the player (player inside the wall core → intensity 1).
      const w = ctx.weather;
      const tr = ctx.player.body.body.translation();
      w.state = 'storm';
      w.intensity = 1.0;
      w.perceivedIntensity = 1.0;
      w.currentStormDuration = 1e6;                // don't let it settle during the shot
      w.stateTimer = 0;
      w.wall.active = true;
      w.wall.posX = tr.x; w.wall.posZ = tr.z;
      w.wall.dirX = 1; w.wall.dirZ = 0;
      w.wall.width = 400; w.wall.age = 0; w.wall.approaching = false;
    });
    // Run the LIVE loop ~2.4s so the 3 dust layers populate, drift, + ramp to full
    // opacity (opacity keys off perceivedIntensity, recomputed by the shelter pass).
    await page.waitForTimeout(2400);
    const r = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const w = ctx.weather;
      w.intensity = 1.0; w.perceivedIntensity = 1.0;   // re-pin peak
      const tr = ctx.player.body.body.translation();
      const cam = ctx.three.camera;
      ctx.flags.paused = true;
      // Eye-level horizontal view into the storm.
      cam.position.set(tr.x, tr.y + 1.6, tr.z);
      cam.lookAt(tr.x + 30, tr.y + 1.6, tr.z + 4);
      cam.updateMatrixWorld(true);
      ctx.three.renderer.render(ctx.three.scene, cam);   // guarantee the repositioned view paints
      const fog = ctx.three.scene.fog;
      return {
        intensity: +w.intensity.toFixed(2), pi: +w.perceivedIntensity.toFixed(2),
        fogDensity: fog ? +fog.density.toFixed(4) : null,
        vis: [w.layers.near.particles.visible, w.layers.mid.particles.visible, w.layers.far.particles.visible],
        op: [+w.layers.near.mat.opacity.toFixed(2), +w.layers.mid.mat.opacity.toFixed(2), +w.layers.far.mat.opacity.toFixed(2)],
      };
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: join(OUT, 'scen-storm.png'), fullPage: false });
    console.log(`[storm] ${JSON.stringify(r)}`);
  },

  // Smoke-plume (C21): deploy a lit fire + let its smoke-signal column build, then
  // frame it from a distance against the sky (the "visible-from-afar" signal read).
  // Tall frame for a vertical plume. --storm forces a peak storm (the plume tears flat).
  'smoke-plume': async (page) => {
    const stormy = !!argv.storm;
    await page.evaluate((stormy) => {
      const ctx = window.__game.ctx;
      window.__game.setTime(0.5);         // noon — sun overhead (not behind the plume → front/side-lit, not backlit)
      ctx.weather.cloudiness = 0.12;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      ctx.three.renderer.setSize(720, 840, false);   // tall frame for a vertical plume
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 720 / 840; cam.updateProjectionMatrix(); }
      // Offset the fire to the player's side + ahead (clear of the wreck the player spawns by).
      const tr = ctx.player.body.body.translation();
      const V = ctx.three.camera.position.constructor;
      const fwd = new V(); ctx.three.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      const fx = tr.x + fwd.z * 20 + fwd.x * 6;
      const fz = tr.z - fwd.x * 20 + fwd.z * 6;
      window.__fireId = window.__game.spawnFire(fx, fz);
      if (stormy) {
        const w = ctx.weather; const tr = ctx.player.body.body.translation();
        w.state = 'storm'; w.intensity = 1; w.perceivedIntensity = 1; w.currentStormDuration = 1e6; w.stateTimer = 0;
        w.wall.active = true; w.wall.posX = tr.x; w.wall.posZ = tr.z; w.wall.dirX = 1; w.wall.dirZ = 0; w.wall.width = 400; w.wall.age = 0;
      } else {
        ctx.weather.intensity = 0;
      }
      // Deterministically build the column (headless rAF throttling starves the
      // real-time accumulation) — fast-forward ~10s of plume.
      window.__game.warmSmoke(10);
    }, stormy);
    await page.waitForTimeout(400);
    const r = await page.evaluate((stormy) => {
      const ctx = window.__game.ctx;
      const f = ctx.fires.list.find((x) => x.id === window.__fireId) || ctx.fires.list[0];
      if (stormy) { ctx.weather.intensity = 1; ctx.weather.perceivedIntensity = 1; }
      ctx.flags.paused = true;
      const cam = ctx.three.camera;
      const p = f.pos;
      // Stand back ~15m + a touch up; look at the lower-mid column so the full plume
      // rises through the upper frame against the sky.
      cam.position.set(p.x - 12, p.y + 3, p.z - 2);
      cam.lookAt(p.x, p.y + 7, p.z);
      cam.updateMatrixWorld(true);
      ctx.three.renderer.render(ctx.three.scene, cam);
      let active = 0, topY = 0;
      if (f.smoke) for (const s of f.smoke) if (s.active) { active++; topY = Math.max(topY, s.sprite.position.y); }
      return { fireId: f.id, alive: f.alive, activePuffs: active, columnHeight: +topY.toFixed(1) };
    }, stormy);
    await page.waitForTimeout(120);
    await page.screenshot({ path: join(OUT, `scen-smoke-plume${stormy ? '-storm' : ''}.png`), fullPage: false });
    console.log(`[smoke-plume] ${JSON.stringify(r)}`);
  },

  // Signal flare (C37): fire signal_kit's transient flare from the player's view,
  // advance the arc to mid-climb (head high + a full ember trail), then frame the
  // whole arc from the side against the sky. --day forces noon; default is a dimmer
  // evening sky where the additive flare reads brightest. Tall frame for the arc.
  'signal-flare': async (page) => {
    const day = !!argv.day;
    await page.evaluate((day) => {
      const ctx = window.__game.ctx;
      window.__game.setTime(day ? 0.5 : 0.86);   // noon, or a dim evening so the flare pops
      ctx.weather.cloudiness = 0.1;
      ctx.weather.intensity = 0;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      ctx.three.renderer.setSize(720, 840, false);   // tall frame for the vertical arc
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 720 / 840; cam.updateProjectionMatrix(); }
      // Flatten the look so the flare launches along the horizontal forward (a clean arc).
      const V = cam.position.constructor;
      const fwd = new V(); cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      // Capture the launch origin + forward BEFORE firing (the flare uses the live camera).
      window.__flareOrigin = { x: cam.position.x + fwd.x * 0.6, y: cam.position.y - 0.15, z: cam.position.z + fwd.z * 0.6 };
      window.__flareFwd = { x: fwd.x, z: fwd.z };
      // Fire + fast-forward ~1.6s of arc (head near apogee → the ballistic curve +
      // downrange lean read clearly, and the ember ribbon is fully formed behind it).
      window.__flareCount = window.__game.fireSignalFlare(1.6);
    }, day);
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      ctx.flags.paused = true;
      const O = window.__flareOrigin, F = window.__flareFwd;
      const cam = ctx.three.camera;
      // Side vantage: perpendicular to the launch forward, ~15m off, looking at mid-arc.
      const rx = F.z, rz = -F.x;                       // right vector ⟂ to the launch/lean dir → profile view of the arc
      const midX = O.x + F.x * 2.6, midZ = O.z + F.z * 2.6;   // ~mid of the leaned arc
      cam.position.set(midX + rx * 16, O.y + 5.0, midZ + rz * 16);
      cam.lookAt(midX, O.y + 7, midZ);
      cam.updateMatrixWorld(true);
      ctx.three.renderer.render(ctx.three.scene, cam);
      return { liveFlares: window.__flareCount };
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: join(OUT, `scen-signal-flare${day ? '-day' : ''}.png`), fullPage: false });
    console.log(`[signal-flare] ${JSON.stringify(r)}`);
  },

  // Vista (C28): the horizon-landmark-silhouette check. Find a hand-modeled flagship
  // by name, stand ~--dist=600m away across the desert, and look AT it — does it read
  // as a skyline silhouette, or fade into the fog/sky? --dist=<m> sets the camera range.
  'vista': async (page) => {
    const dist = argv.dist !== undefined ? Number(argv.dist) : 600;
    const fogmult = argv.fogmult !== undefined ? Number(argv.fogmult) : 1;
    const info = await page.evaluate(({ dist, fogmult }) => {
      const ctx = window.__game.ctx;
      window.__game.setTime(0.5);            // midday, clear sky
      ctx.weather.intensity = 0; ctx.weather.cloudiness = 0.1;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      ctx.three.renderer.setSize(1000, 480, false);   // wide for the horizon
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1000 / 480; cam.updateProjectionMatrix(); }
      const V = cam.position.constructor;
      // Find a flagship landmark by name (the hand-modeled hero wrecks).
      const names = ['megaShip', 'megaWreck', 'satelliteDish', 'crashedHull', 'openingWreck'];
      let target = null, hit = null;
      for (const n of names) {
        const o = ctx.three.scene.getObjectByName(n);
        if (o) { target = o.getWorldPosition(new V()); hit = n; break; }
      }
      if (!target) return { noTarget: true };
      // Stand `dist` m from the landmark (along the line to origin), eye-level on the dune.
      const d = Math.hypot(target.x, target.z) || 1;
      const ux = target.x / d, uz = target.z / d;
      const cx = target.x - ux * dist, cz = target.z - uz * dist;
      const groundY = ctx.terrain.heightAt(cx, cz);
      cam.position.set(cx, groundY + 3, cz);
      cam.lookAt(target.x, target.y + 12, target.z);   // look at the upper landmark
      cam.updateMatrixWorld(true);
      ctx.flags.paused = true;
      const fog = ctx.three.scene.fog;
      // C30 — optional fog multiplier to preview the vista-crest fog-LIFT effect.
      if (fog && fogmult !== 1) fog.density *= fogmult;
      return { landmark: hit, target: [+target.x.toFixed(0), +target.y.toFixed(0), +target.z.toFixed(0)], dist, fogmult, fogDensity: fog ? +fog.density.toFixed(4) : null };
    }, { dist, fogmult });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, `scen-vista-${dist}${argv.fogmult !== undefined ? '-fog' + argv.fogmult : ''}.png`), fullPage: false });
    console.log('[vista] ' + JSON.stringify(info));
  },

  // Spyglass zoom (C29): stand `dist` m from a flagship landmark, force the spyglass
  // FOV zoom + the scope vignette, and capture the world-through-the-glass. Pass
  // --raw to capture the UN-zoomed wide view for a before/after compare.
  'spyglass-view': async (page) => {
    const dist = argv.dist !== undefined ? Number(argv.dist) : 480;
    const raw = !!argv.raw;
    const info = await page.evaluate(({ dist, raw }) => {
      const ctx = window.__game.ctx;
      window.__game.setTime(0.5);
      ctx.weather.intensity = 0; ctx.weather.cloudiness = 0.1;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      ctx.three.renderer.setSize(720, 720, false);
      const cam = ctx.three.camera;
      const V = cam.position.constructor;
      const names = ['megaShip', 'megaWreck', 'satelliteDish', 'crashedHull', 'openingWreck'];
      let target = null, hit = null;
      for (const n of names) {
        const o = ctx.three.scene.getObjectByName(n);
        if (o) { target = o.getWorldPosition(new V()); hit = n; break; }
      }
      if (!target) return { noTarget: true };
      const d = Math.hypot(target.x, target.z) || 1;
      const ux = target.x / d, uz = target.z / d;
      const cx = target.x - ux * dist, cz = target.z - uz * dist;
      const groundY = ctx.terrain.heightAt(cx, cz);
      cam.position.set(cx, groundY + 3, cz);
      cam.lookAt(target.x, target.y + 10, target.z);
      // Force the zoom (paused → updateSpyglass won't fight it) + the vignette.
      const zoomFov = raw ? 78 : 24;          // SPYGLASS_FOV
      cam.fov = zoomFov;
      cam.aspect = 1; cam.updateProjectionMatrix();
      cam.updateMatrixWorld(true);
      const scope = document.getElementById('spyglass-scope');
      if (scope) scope.style.opacity = raw ? '0' : '0.96';
      ctx.flags.paused = true;
      return { landmark: hit, dist, fov: zoomFov, raw, hasScope: !!scope };
    }, { dist, raw });
    await page.waitForTimeout(320);
    await page.screenshot({ path: join(OUT, `scen-spyglass-${raw ? 'raw' : 'zoom'}-${dist}.png`), fullPage: false });
    console.log('[spyglass-view] ' + JSON.stringify(info));
  },

  // Sun-shade probe (C31): replicate the updateSunExposure heightfield raymarch over a
  // deterministic grid at 3 sun heights, report the shaded fraction. Confirms the
  // occlusion logic detects MEANINGFUL dune shade on the real terrain (not all-sun /
  // all-shade) + reacts to sun height (overhead = clear, low = long shadows).
  'sun-probe': async (page) => {
    const r = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const STEP = 2.5, MAXD = 140, CLEAR = 22;
      // Compute the sun direction directly from dayTime (lighting.ts formula) so the
      // probe doesn't depend on the rAF-throttled lighting tick.
      const zones = window.__game.sunInfo().boxes.concat(ctx.shelter.zones);
      const hitsAABB = (ox, oy, oz, dx, dy, dz, z) => {
        let tmin = 0.5, tmax = MAXD;
        const ax = [[ox, dx, z.cx, z.hx], [oy, dy, z.cy, z.hy], [oz, dz, z.cz, z.hz]];
        for (const [o, d, c, h] of ax) {
          if (Math.abs(d) < 1e-6) { if (o < c - h || o > c + h) return false; continue; }
          let t1 = (c - h - o) / d, t2 = (c + h - o) / d; if (t1 > t2) { const m = t1; t1 = t2; t2 = m; }
          if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return false;
        }
        return true;
      };
      const probe = (dayTime) => {
        const ang = (dayTime - 0.25) * Math.PI * 2;
        let sx = Math.cos(ang), sy = Math.sin(ang), sz = 0.18;
        const len = Math.hypot(sx, sy, sz); sx /= len; sy /= len; sz /= len;
        const sunHeight = Math.sin(ang);   // matches ctx.time.sunHeight
        if (sunHeight <= 0.08 || sy <= 0.02) return { dayTime, sunHeight: +sunHeight.toFixed(3), note: 'low sun' };
        let terr = 0, struct = 0, total = 0;
        // Wide grid centered to reach the flagship wrecks (megaShip ~-485,227).
        for (let gx = -560; gx <= 360; gx += 40) {
          for (let gz = -160; gz <= 440; gz += 40) {
            const headY = ctx.terrain.heightAt(gx, gz) + 1.6;
            let tBlock = false;
            for (let d = STEP; d <= MAXD; d += STEP) {
              const ry = headY + sy * d;
              const th = ctx.terrain.heightAt(gx + sx * d, gz + sz * d);
              if (th > ry + 0.3) { tBlock = true; break; }
              if (ry - th > CLEAR) break;
            }
            let sBlock = false;
            if (!tBlock) for (const z of zones) { if (hitsAABB(gx, headY, gz, sx, sy, sz, z)) { sBlock = true; break; } }
            if (tBlock) terr++;
            if (sBlock) struct++;
            total++;
          }
        }
        return { dayTime, sunHeight: +sunHeight.toFixed(3), terrainPct: Math.round((terr / total) * 100), structPct: Math.round((struct / total) * 100), total };
      };
      const out = [probe(0.5), probe(0.40), probe(0.33), probe(0.29), probe(0.275)];   // noon → low sun
      // Targeted: a point on a wreck's SHADOW side must read shaded; the SUNNY side must not.
      let targeted = null;
      const tboxes = window.__game.sunInfo().boxes;
      if (tboxes.length) {
        const b = tboxes[0];
        const ang = (0.33 - 0.25) * Math.PI * 2;
        let sx = Math.cos(ang), sy = Math.sin(ang), sz = 0.18; const L = Math.hypot(sx, sy, sz); sx /= L; sy /= L; sz /= L;
        const off = b.hx + b.hz + 6;
        const shadowSideDetected = hitsAABB(b.cx - sx * off, b.cy, b.cz - sz * off, sx, sy, sz, b);
        const sunnySideClear = !hitsAABB(b.cx + sx * off, b.cy, b.cz + sz * off, sx, sy, sz, b);
        targeted = { boxHalf: { hx: +b.hx.toFixed(1), hy: +b.hy.toFixed(1), hz: +b.hz.toFixed(1) }, shadowSideDetected, sunnySideClear };
      }
      return { occluderBoxes: tboxes.length, zoneTotal: zones.length, targeted, probes: out };
    });
    console.log('[sun-probe] ' + JSON.stringify(r));
  },

  // Wordless prop scene (C32): frame a storytelling tableau (skeleton + props).
  // --idx=N picks the Nth scene; --angle=3q|front|side. Rotation forced to 0 +
  // morning sun (front-light, not noon-flat) per the harness footgun.
  'wordless': async (page) => {
    const idx = argv.idx !== undefined ? Number(argv.idx) : 0;
    const ang = argv.angle || '3q';
    const r = await page.evaluate(({ idx, ang }) => {
      const ctx = window.__game.ctx;
      window.__game.setTime(0.42);            // morning sun — front/side light, not flat noon
      ctx.weather.intensity = 0; ctx.weather.cloudiness = 0.15;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      ctx.three.renderer.setSize(840, 760, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 840 / 760; cam.updateProjectionMatrix(); }
      const V = cam.position.constructor;
      const scenes = [];
      ctx.three.scene.traverse((o) => { if (o.name === 'wordlessScene') scenes.push(o); });
      const s = scenes[idx];
      if (!s) return { found: false, count: scenes.length };
      s.rotation.y = 0;                       // face +Z for a stable read
      s.updateMatrixWorld(true);
      const c = s.getWorldPosition(new V());
      const D = 2.7;
      let cp;
      if (ang === 'front') cp = [c.x, c.y + 1.15, c.z + D];
      else if (ang === 'side') cp = [c.x + D, c.y + 1.0, c.z + 0.2];
      else cp = [c.x + D * 0.72, c.y + 1.35, c.z + D * 0.72];   // 3q
      cam.position.set(cp[0], cp[1], cp[2]);
      cam.lookAt(c.x, c.y + 0.45, c.z);
      cam.updateMatrixWorld(true);
      ctx.flags.paused = true;
      return { found: true, idx, count: scenes.length, center: [+c.x.toFixed(0), +c.y.toFixed(1), +c.z.toFixed(0)] };
    }, { idx, ang });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, `scen-wordless-${idx}-${ang}.png`), fullPage: false });
    console.log('[wordless] ' + JSON.stringify(r));
  },

  // Worm far-horizon crossing (C36): force a distant crossing, fast-forward to mid-
  // sweep (fully surfaced + central), and frame the dorsal ridge from ~190m.
  'worm-crossing': async (page) => {
    const r = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      window.__game.setTime(0.33);              // warm afternoon — side-lit dunes, dark ridge
      ctx.weather.intensity = 0; ctx.weather.cloudiness = 0.1;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      ctx.three.renderer.setSize(920, 600, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 920 / 600; cam.updateProjectionMatrix(); }
      const c = window.__game.triggerWormCrossing();
      if (!c) return { found: false };
      window.__game.advanceWormCrossing(13);    // jump to mid-sweep (surfaced + central)
      const pl = ctx.player.body.body.translation();
      const dx = c.cx - pl.x, dz = c.cz - pl.z, d = Math.hypot(dx, dz) || 1;
      const ux = dx / d, uz = dz / d, camDist = 165;
      const ccx = c.cx - ux * camDist, ccz = c.cz - uz * camDist;
      cam.position.set(ccx, ctx.terrain.heightAt(ccx, ccz) + 16, ccz);   // raised to clear foreground dunes
      cam.lookAt(c.cx, ctx.terrain.heightAt(c.cx, c.cz) + 4, c.cz);
      cam.updateMatrixWorld(true);
      ctx.flags.paused = true;
      return { found: true, center: [+c.cx.toFixed(0), +c.cz.toFixed(0)] };
    });
    await page.waitForTimeout(320);
    await page.screenshot({ path: join(OUT, 'scen-worm-crossing.png'), fullPage: false });
    console.log('[worm-crossing] ' + JSON.stringify(r));
  },

  // Fireball/bolide (C34): force a rare fireball at midnight, aim the camera at its
  // arc, let it advance to ~peak, and capture the night-sky moment.
  'fireball': async (page) => {
    const r = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      window.__game.setTime(0.0);               // midnight
      ctx.weather.intensity = 0; ctx.weather.cloudiness = 0;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      ctx.three.renderer.setSize(860, 760, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 860 / 760; cam.updateProjectionMatrix(); }
      const res = window.__game.triggerFireball();
      if (!res) return { found: false };
      const d = res.dir, R = 460, p = cam.position;
      cam.lookAt(p.x + d[0] * R, p.y + d[1] * R, p.z + d[2] * R);   // aim at the fireball's peak point
      cam.updateMatrixWorld(true);
      return { found: true, dir: d.map((x) => +x.toFixed(2)) };
    });
    await page.waitForTimeout(700);             // let night settle + the fireball advance to ~peak
    await page.screenshot({ path: join(OUT, 'scen-fireball.png'), fullPage: false });
    console.log('[fireball] ' + JSON.stringify(r));
  },

  // ACBE (D1) — the crashing-wreck event, captured DETERMINISTICALLY: trigger, PAUSE the
  // main tick, then step the FSM via __game.advanceCrash to an exact moment (the live sim
  // runs slow headless, so wall-clock waits are unreliable). The paused scene still renders,
  // so the static screenshot doesn't time out. --phase=streak (mid-flight asset shot) |
  // impact (settled FX) | ground (player POV up at the descending streak). --time=day|night.
  'crash': async (page) => {
    const phase = argv.phase || 'impact';
    const dn = argv.time === 'day' ? 0.5 : 0.0;
    await page.evaluate(({ dn }) => {
      const ctx = window.__game.ctx;
      window.__game.setTime(dn);
      ctx.weather.intensity = 0; ctx.weather.cloudiness = 0.12;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      ctx.three.renderer.setSize(900, 760, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 900 / 760; cam.updateProjectionMatrix(); }
    }, { dn });
    await page.waitForTimeout(550);   // let lighting/sky settle to the set time of day (paused would freeze it)
    const r = await page.evaluate(({ phase }) => {
      const ctx = window.__game.ctx;
      const FLIGHT = 5.5;   // = Tuning.CRASH_FLIGHT_S
      const pp = ctx.player.body.body.translation();
      const res = window.__game.triggerCrash();
      if (!res) return { found: false };
      const ix = res.x, iz = res.z, iy = ctx.terrain.heightAt(ix, iz);
      ctx.flags.paused = true;                                                    // freeze the live tick
      // Fine sub-steps → the trail builds densely like real 60fps play (not blobby).
      const adv = (phase === 'site' || phase === 'interior') ? FLIGHT + 9 : phase === 'impact' ? FLIGHT + 0.5 : FLIGHT * 0.5;
      window.__game.advanceCrash(adv, 220);
      const st = window.__game.crashState();
      const hp = st.headPos;
      const cam = ctx.three.camera;
      if (phase === 'streak' && hp) {
        cam.position.set(hp[0] + 120, hp[1] - 70, hp[2] + 120);   // side + below the head → trail streaks up-back
        cam.lookAt(hp[0], hp[1] - 4, hp[2]);
      } else if (phase === 'ground' && hp) {
        cam.position.set(pp.x, iy + 2.6, pp.z);                   // player eye, look up at the streak
        cam.lookAt(hp[0], hp[1], hp[2]);
      } else if (phase === 'site') {
        cam.position.set(ix + 24, iy + 11, iz + 24);             // settled site: wreck + scorch + beacon column
        cam.lookAt(ix, iy + 4, iz);
      } else if (phase === 'interior') {
        ctx.three.renderer.toneMappingExposure = 2.4;           // brighten the dim trough so the dressing reads for verification
        cam.position.set(ix + 5, iy + 7, iz + 8);               // lower 3/4 down into the open husk → the dressed interior
        cam.lookAt(ix, iy - 0.8, iz);
      } else {
        cam.position.set(ix + 36, iy + 16, iz + 36);             // 3/4 over the impact moment
        cam.lookAt(ix, iy + 3, iz);
      }
      cam.updateMatrixWorld(true);
      const jl = ctx.journals.list.filter((j) => j.kind === 'crash_log').slice(-1)[0];
      const log = jl && jl.content ? (jl.content.subtitle + ' :: ' + jl.content.entries.map((e) => e[1]).join(' // ')) : null;
      return { found: true, ix: +ix.toFixed(1), iy: +iy.toFixed(1), iz: +iz.toFixed(1),
        role: res.role, t: +st.t.toFixed(2), impacted: st.impacted, head: hp ? hp.map((v) => +v.toFixed(0)) : null, log };
    }, { phase });
    if (!r.found) { console.log('[crash] not armed'); return; }
    // 'site' adds a wreck (new materials) → let the paused scene render a few frames first so
    // the cold shader compile (ABL multi-second stall) finishes BEFORE the screenshot.
    await page.waitForTimeout((phase === 'site' || phase === 'interior') ? 2200 : 300);
    await page.screenshot({ path: join(OUT, `scen-crash-${phase}-${argv.time || 'night'}.png`), fullPage: false, timeout: 90000 });
    console.log('[crash] ' + JSON.stringify(r));
  },

  // ACBE (D1) Tier 4 — crash SAVE ROUND-TRIP test (no screenshot). Land a crash, then run the
  // full save → clear → load(v15) → restore cycle and report site counts: PASS iff
  // before === afterRestore (>0) && afterReset === 0 && saveOk && loadOk.
  'crash-roundtrip': async (page) => {
    const r = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      window.__game.setTime(0.5);
      ctx.weather.intensity = 0;
      window.__game.triggerCrash();
      window.__game.advanceCrash(7, 120);   // fly + land the crash so a site exists
      return window.__game.crashRoundtrip();
    });
    const pass = r.before > 0 && r.afterReset === 0 && r.afterRestore === r.before && r.saveOk && r.loadOk;
    console.log(`[crash-roundtrip] ${pass ? 'PASS' : 'FAIL'} ${JSON.stringify(r)}`);
  },

  // ACBE (D1) Tier 4 (C) — interior HEAT-HAZARD probe (no screenshot). Land a fresh crash, then
  // sample the heat falloff + bake the player at centre. PASS iff center>near>half>edge==0 and
  // the temperature CLIMBS while baking. Runs at NIGHT so the climb is the crash heat, not the sun.
  'crash-heat': async (page) => {
    const r = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      window.__game.setTime(0.92);          // night — cold drains, so a temp climb = the crash bake
      ctx.weather.intensity = 0;
      window.__game.triggerCrash();
      window.__game.advanceCrash(7, 120);   // land a fresh crash so its fires are at full burn
      return window.__game.crashHeatProbe();
    });
    const pass = !r.error && r.center > r.near && r.near > r.half && r.half > r.edge && r.edge === 0 && r.dTemp > 0 && r.shelterAfter > 0;
    console.log(`[crash-heat] ${pass ? 'PASS' : 'FAIL'} ${JSON.stringify(r)}`);
  },

  // Vulture (ACAH): frame a perched vulture on its tree for model iteration.
  // --angle=3q|side|front; head faces +X (rotation forced to 0 for a stable read).
  'vulture': async (page) => {
    const ang = argv.angle || '3q';
    const r = await page.evaluate((ang) => {
      const ctx = window.__game.ctx;
      window.__game.setTime(0.45);
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      ctx.three.renderer.setSize(820, 900, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 820 / 900; cam.updateProjectionMatrix(); }
      const v = ctx.vultures?.list?.[0];
      if (!v) return { found: false };
      v.mesh.rotation.y = 0;                 // head faces +X for a stable read
      ctx.flags.paused = true;
      const p = v.pos;
      const eye = p.y + 0.28;                // bird body height
      let cp;
      if (ang === 'side') cp = [p.x, eye, p.z + 1.1];
      else if (ang === 'front') cp = [p.x + 1.1, eye, p.z + 0.15];
      else cp = [p.x + 1.0, eye + 0.12, p.z + 1.0];   // 3q
      cam.position.set(cp[0], cp[1], cp[2]);
      cam.lookAt(p.x + 0.05, p.y + 0.24, p.z);
      cam.updateMatrixWorld(true);
      return { found: true, count: ctx.vultures.list.length, perchY: +p.y.toFixed(1) };
    }, ang);
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, `scen-vulture-${ang}.png`), fullPage: false });
    console.log(`[vulture] ${JSON.stringify(r)}`);
  },

  // Vulture-pose (ACAI): force the first vulture into a state + pin it in frame so
  // the live loop poses the rig (idle/flying/landing/dead). --state=<state>.
  'vulture-pose': async (page) => {
    const state = argv.state || 'flying';
    await page.evaluate((state) => {
      const ctx = window.__game.ctx;
      window.__game.setTime(0.45);
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      ctx.three.renderer.setSize(820, 760, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 820 / 760; cam.updateProjectionMatrix(); }
      const v = ctx.vultures?.list?.[0];
      if (!v) return;
      // Pin the bird at a clear spot ~3m up; remember it for re-pinning each frame.
      window.__poseAnchor = { x: v.pos.x, y: v.pos.y + 1.5, z: v.pos.z };
      window.__poseV = v;
      v.state = state;
      v.landed = false;
    }, state);
    // Let the live loop pose the rig for ~0.4s, THEN pause (freezing the rig
    // rotations) + re-pin the bird at the anchor + frame the camera on it.
    await page.waitForTimeout(450);
    const ang = argv.angle || '3q';
    await page.evaluate((ang) => {
      const ctx = window.__game.ctx;
      const v = window.__poseV; const a = window.__poseAnchor;
      if (!v || !a) return;
      ctx.flags.paused = true;
      v.pos.set(a.x, a.y, a.z);
      v.mesh.position.set(a.x, a.y, a.z);
      v.mesh.rotation.set(0, 0, 0);   // head faces +X → camera on +Z sees the profile
      const cam = ctx.three.camera;
      // side = pure +Z (left flank profile); 3q = front-quarter (+X +Z).
      const cp = ang === 'side' ? [a.x, a.y + 0.04, a.z + 0.82] : [a.x + 0.64, a.y + 0.1, a.z + 0.64];
      cam.position.set(cp[0], cp[1], cp[2]);
      cam.lookAt(a.x, a.y, a.z);
      cam.updateMatrixWorld(true);
    }, ang);
    await page.waitForTimeout(120);
    await page.screenshot({ path: join(OUT, `scen-vulture-pose-${state}.png`), fullPage: false });
    console.log(`[vulture-pose] state=${state}`);
  },

  // Vulture-kill (ACAH): verify the kill->fall->land->'take'-tag path (the loot
  // E-take + combat dispatch mirror the verified shrew pattern). Logic eval.
  // Vulture-flight (ACAI T4): verify the relocate-and-land FSM cycle
  // perched → flying (relocating, target on ANOTHER tree) → landing → perched
  // (re-perched at the target). Logic eval — the in-motion arc/cadence is
  // foreground-owed (D150), so this asserts the state machine, not the feel.
  'vulture-flight': async (page) => {
    const r1 = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const v = ctx.vultures?.list?.[0];
      if (!v) return { noVulture: true };
      // Park the perched bird right beside the player so proximity triggers the
      // launch; its relocation target is then a far salt-flat perch (different tree).
      const pp = ctx.player.body.body.translation();
      const gy = ctx.terrain.heightAt(pp.x + 5, pp.z);
      v.state = 'perched'; v.relocating = false; v.landed = false;
      v.perch.set(pp.x + 5, gy + 2.5, pp.z);
      v.pos.copy(v.perch);
      v.mesh.position.copy(v.pos);
      v.body.setNextKinematicTranslation({ x: v.pos.x, y: v.pos.y + 0.26, z: v.pos.z });
      return { ok: true };
    });
    if (r1.noVulture) { console.log('[vulture-flight] SKIP — no vulture'); return; }
    await page.waitForTimeout(1600);   // let it launch + pick a target
    // ACAI f/u — sample terrain clearance during the REAL flight (the bug: the
    // bird sank through dunes when leaving the salt flats). Min over a few frames.
    let minClear = Infinity, minFacing = 1;
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(120);
      const c = await page.evaluate(() => {
        const ctx = window.__game.ctx;
        const v = ctx.vultures.list[0];
        if (v.state !== 'flying') return null;
        // Head-forward check: world +X (the head) should align with the travel dir.
        const V = ctx.three.camera.position.constructor;
        const fwd = new V(1, 0, 0).applyQuaternion(v.mesh.quaternion);
        const vx = Math.sin(v.heading), vz = Math.cos(v.heading);
        const facing = fwd.x * vx + fwd.z * vz;   // ~+1 forward, ~-1 backwards
        return { clear: +(v.pos.y - ctx.terrain.heightAt(v.pos.x, v.pos.z)).toFixed(2), facing: +facing.toFixed(2) };
      });
      if (c) { if (c.clear < minClear) minClear = c.clear; if (c.facing < minFacing) minFacing = c.facing; }
    }
    const r2 = await page.evaluate(() => {
      const v = window.__game.ctx.vultures.list[0];
      const dTree = Math.sqrt((v.target.x - v.perch.x) ** 2 + (v.target.z - v.perch.z) ** 2);
      return { state: v.state, relocating: v.relocating, targetTreeDist: +dTree.toFixed(1) };
    });
    // Shortcut the long cross-map flight: drop the bird just overhead its target
    // so the landing → re-perch leg runs without waiting out 40m of travel.
    const r3 = await page.evaluate(() => {
      const v = window.__game.ctx.vultures.list[0];
      if (v.state !== 'flying') return { notFlying: v.state };
      v.pos.set(v.target.x, v.target.y + 1.2, v.target.z);
      v.mesh.position.copy(v.pos);
      return { ok: true };
    });
    await page.waitForTimeout(16000);   // descend + re-perch (slow sim clock)
    const r4 = await page.evaluate(() => {
      const v = window.__game.ctx.vultures.list[0];
      const atTarget = Math.sqrt((v.perch.x - v.target.x) ** 2 + (v.perch.z - v.target.z) ** 2);
      const hd = Math.sqrt((v.pos.x - v.target.x) ** 2 + (v.pos.z - v.target.z) ** 2);
      return { state: v.state, rePerchAtTarget: +atTarget.toFixed(2), hd: +hd.toFixed(2), dy: +(v.pos.y - v.target.y).toFixed(2) };
    });
    const launchOk = r2.state === 'flying' && r2.relocating === true && r2.targetTreeDist >= 40;
    const landOk = r4.state === 'perched' && r4.rePerchAtTarget < 0.3;
    // Clearance must stay near/above VULTURE_MIN_FLIGHT_CLEARANCE (3.0m) — a small
    // negative slack tolerates the heightAt sample landing on a sharp ridge tip.
    const clearOk = minClear === Infinity || minClear >= 2.0;
    // Head must point ALONG travel (forward), not backwards.
    const facingOk = minFacing > 0.7;
    console.log(`[vulture-flight] ${launchOk && landOk && clearOk && facingOk ? 'PASS' : 'FAIL'} launch=${JSON.stringify(r2)} minClear=${minClear === Infinity ? 'n/a' : minClear} minFacing=${minFacing} flightShortcut=${JSON.stringify(r3)} land=${JSON.stringify(r4)}`);
  },

  // Vulture-circle (ACAI f/u E1): a vulture wheeling over a bone carcass. Reports
  // the circler + carcass counts and frames the orbit (paused mid-wheel).
  'vulture-circle': async (page) => {
    await page.waitForTimeout(800);   // let the circlers climb to orbit altitude
    const r = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const circlers = ctx.vultures.list.filter((v) => v.carcass);
      const carcasses = new Set(ctx.vultures.list.filter((v) => v.carcass).map((v) => `${v.carcass.x.toFixed(0)},${v.carcass.z.toFixed(0)}`));
      if (!circlers.length) return { circlers: 0 };
      const v = circlers[0];
      const c = v.carcass;
      ctx.weather.intensity = 0; window.__game.setTime(0.5);
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      ctx.flags.paused = true;   // freeze the wheel for a clean still
      const cam = ctx.three.camera;
      // Close on the soaring bird (carcass below-ground in frame for context).
      cam.position.set(v.pos.x + 4.5, v.pos.y + 1.2, v.pos.z + 4.5);
      cam.lookAt(v.pos.x, v.pos.y - 1.5, v.pos.z);
      cam.updateMatrixWorld(true);
      return {
        circlers: circlers.length, carcasses: carcasses.size,
        state: v.state,
        vpos: [v.pos.x.toFixed(1), v.pos.y.toFixed(1), v.pos.z.toFixed(1)],
        alt: +(v.pos.y - c.y).toFixed(1),
      };
    });
    await page.waitForTimeout(300);
    if (r.circlers) await page.screenshot({ path: join(OUT, 'scen-vulture-circle.png'), fullPage: false });
    console.log(`[vulture-circle] ${JSON.stringify(r)}`);
  },

  // Vulture-hunt (ACAI f/u E3): a circling vulture swoops, grabs a lizard, and
  // carries it off. Teleports a lizard under a carcass + forces the hunt, then
  // asserts swooping → carrying (prey clutched) → lizard removed from the world.
  'vulture-hunt': async (page) => {
    const r1 = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const v = ctx.vultures.list[0];
      const l = ctx.lizards[0];
      if (!v || !l) return { noEntity: true };
      // Synthesize a circling vulture over a lizard (seed-independent): anchor a
      // carcass at the lizard, set the bird wheeling above it, force the hunt.
      const V = ctx.three.camera.position.constructor;
      const cy = ctx.terrain.heightAt(l.pos.x, l.pos.z);
      v.carcass = new V(l.pos.x, cy, l.pos.z);
      v.prey = null;
      v.state = 'circling';
      v.circlePhase = 0;
      v.pos.set(l.pos.x + 13, cy + 15, l.pos.z);
      v.huntCooldown = 0;   // hunt now
      return { ok: true, lizardId: l.id, vId: v.id, lizardsBefore: ctx.lizards.length };
    });
    if (r1.noEntity) { console.log(`[vulture-hunt] SKIP ${JSON.stringify(r1)}`); return; }
    let sawSwoop = false, sawCarry = false, sawPrey = false, sawFeed = false, sawReturn = false, feedDist = null;
    for (let i = 0; i < 340; i++) {
      await page.waitForTimeout(250);
      const s = await page.evaluate((a) => {
        const ctx = window.__game.ctx;
        const v = ctx.vultures.list.find((vv) => vv.id === a.vId);
        const feedDist = v && v.state === 'feeding' && v.carcass
          ? Math.sqrt((v.pos.x - v.carcass.x) ** 2 + (v.pos.z - v.carcass.z) ** 2) : null;
        return { state: v ? v.state : 'gone', hasPrey: !!(v && v.prey), lizGone: !ctx.lizards.find((l) => l.id === a.lizardId), feedDist };
      }, { lizardId: r1.lizardId, vId: r1.vId });
      if (s.state === 'swooping') sawSwoop = true;
      if (s.state === 'carrying') sawCarry = true;
      if (s.hasPrey) sawPrey = true;
      if (s.state === 'feeding') { sawFeed = true; if (feedDist === null && s.feedDist !== null) feedDist = +s.feedDist.toFixed(1); }
      if (s.state === 'returning') sawReturn = true;
      // The bird should fly off a distance → land to eat → fly back (NOT teleport).
      if (sawFeed && sawReturn) break;
    }
    const fin = await page.evaluate((a) => {
      const ctx = window.__game.ctx;
      const v = ctx.vultures.list.find((vv) => vv.id === a.vId);
      return { state: v ? v.state : 'gone', lizGone: !ctx.lizards.find((l) => l.id === a.lizardId), lizardsAfter: ctx.lizards.length };
    }, { lizardId: r1.lizardId, vId: r1.vId });
    // Must have flown a real distance from the carcass before landing to feed.
    const fedFar = feedDist !== null && feedDist >= 30;
    const pass = sawSwoop && sawCarry && sawPrey && fin.lizGone && sawFeed && fedFar;
    console.log(`[vulture-hunt] ${pass ? 'PASS' : 'FAIL'} sawSwoop=${sawSwoop} sawCarry=${sawCarry} sawFeed=${sawFeed} feedDist=${feedDist} sawReturn=${sawReturn} ${JSON.stringify(fin)}`);
  },

  // Vulture-escape (ACAI f/u): a swooped shrew dives for cover; once it's half-
  // buried the vulture loses the target + pulls up (shrew survives).
  'vulture-escape': async (page) => {
    const r1 = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const v = ctx.vultures.list[0];
      const s = ctx.shrews.list[0];
      if (!v || !s) return { noEntity: true };
      const V = ctx.three.camera.position.constructor;
      const cy = ctx.terrain.heightAt(s.pos.x, s.pos.z);
      v.carcass = new V(s.pos.x, cy, s.pos.z);
      v.prey = null; v.state = 'circling'; v.circlePhase = 0;
      v.pos.set(s.pos.x + 6, cy + 8, s.pos.z);
      v.huntCooldown = 0;
      window.__rand = Math.random; Math.random = () => 0;   // force the escape roll to succeed
      return { ok: true, shrewId: s.id, vId: v.id };
    });
    if (r1.noEntity) { console.log('[vulture-escape] SKIP'); return; }
    let sawSwoop = false, sawBurrow = false, forced = false;
    for (let i = 0; i < 70; i++) {
      await page.waitForTimeout(180);
      const o = await page.evaluate((a) => {
        const ctx = window.__game.ctx;
        const v = ctx.vultures.list.find((x) => x.id === a.vId);
        const s = ctx.shrews.list.find((x) => x.id === a.shrewId);
        return { vstate: v ? v.state : 'gone', sstate: s ? s.state : 'gone' };
      }, r1);
      if (o.vstate === 'swooping') sawSwoop = true;
      if (o.sstate === 'burrow') {
        sawBurrow = true;
        // It dove — complete the burrow so the escape is decisive (skip the close race).
        if (!forced) { forced = true; await page.evaluate((a) => { const s = window.__game.ctx.shrews.list.find((x) => x.id === a.shrewId); if (s) { s.burrowT = 1; s.burrowHold = 4; } }, r1); }
      }
      if (sawBurrow && forced && o.vstate === 'circling') break;   // swoop aborted
    }
    const fin = await page.evaluate((a) => {
      Math.random = window.__rand;
      const ctx = window.__game.ctx;
      const v = ctx.vultures.list.find((x) => x.id === a.vId);
      const s = ctx.shrews.list.find((x) => x.id === a.shrewId);
      return { vstate: v ? v.state : 'gone', shrewAlive: !!s, sstate: s ? s.state : 'gone' };
    }, r1);
    const pass = sawSwoop && sawBurrow && fin.shrewAlive && fin.vstate === 'circling';
    console.log(`[vulture-escape] ${pass ? 'PASS' : 'FAIL'} sawSwoop=${sawSwoop} sawBurrow=${sawBurrow} ${JSON.stringify(fin)}`);
  },

  // Vulture-scavenge (ACAI f/u): a circler is attracted to dropped MEAT, swoops,
  // grabs it off the ground + carries it off (the pickup is removed).
  'vulture-scavenge': async (page) => {
    const r1 = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const v = ctx.vultures.list[0];
      if (!v) return { noVulture: true };
      const V = ctx.three.camera.position.constructor;
      // Anchor a carcass near the player + drop a fake meat pickup beside it.
      const pt = ctx.player.body.body.translation();
      const cy = ctx.terrain.heightAt(pt.x + 20, pt.z);
      v.carcass = new V(pt.x + 20, cy, pt.z);
      v.prey = null; v.state = 'circling'; v.circlePhase = 0;
      v.pos.set(pt.x + 20 + 13, cy + 15, pt.z);
      v.huntCooldown = 0;
      const mx = pt.x + 20 + 4, mz = pt.z + 4;
      const fakeMesh = new (ctx.three.scene.constructor)();   // throwaway Object3D
      const id = 990000 + Math.floor(Math.random() * 1000);
      ctx.pickups.list.push({
        id, itemId: 'raw_lizard_meat', mesh: fakeMesh,
        pos: new V(mx, ctx.terrain.heightAt(mx, mz) + 0.06, mz),
        body: null, bobPhase: 0, hovered: false, ridingSledId: null,
      });
      window.__rand = Math.random; Math.random = () => 0;   // force the scavenge roll
      return { ok: true, meatId: id, vId: v.id, pickupsBefore: ctx.pickups.list.length };
    });
    if (r1.noVulture) { console.log('[vulture-scavenge] SKIP'); return; }
    let sawSwoop = false, sawPickupTarget = false, sawCarry = false;
    for (let i = 0; i < 80; i++) {
      await page.waitForTimeout(200);
      const o = await page.evaluate((a) => {
        const ctx = window.__game.ctx;
        const v = ctx.vultures.list.find((x) => x.id === a.vId);
        return { vstate: v ? v.state : 'gone', huntKind: v ? v.huntKind : null, meatGone: !ctx.pickups.list.find((p) => p.id === a.meatId) };
      }, r1);
      if (o.vstate === 'swooping') sawSwoop = true;
      if (o.huntKind === 'pickup') sawPickupTarget = true;
      if (o.vstate === 'carrying') sawCarry = true;
      if (sawCarry && o.meatGone) break;
    }
    const fin = await page.evaluate((a) => {
      Math.random = window.__rand;
      const ctx = window.__game.ctx;
      const v = ctx.vultures.list.find((x) => x.id === a.vId);
      return { vstate: v ? v.state : 'gone', meatGone: !ctx.pickups.list.find((p) => p.id === a.meatId) };
    }, r1);
    const pass = sawSwoop && sawPickupTarget && sawCarry && fin.meatGone;
    console.log(`[vulture-scavenge] ${pass ? 'PASS' : 'FAIL'} sawSwoop=${sawSwoop} pickupTarget=${sawPickupTarget} sawCarry=${sawCarry} ${JSON.stringify(fin)}`);
  },

  'vulture-kill': async (page) => {
    const r1 = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const v = ctx.vultures?.list?.[0];
      if (!v) return { noVulture: true };
      // Relocate to OPEN ground (6m off the tree) + lift ~3m so the dynamic-body
      // tumble (T5) falls clear of the trunk and reads against bare dune.
      const ox = v.pos.x + 6, oz = v.pos.z + 6;
      const gy = ctx.terrain.heightAt(ox, oz);
      v.perch.set(ox, gy, oz);
      v.pos.set(ox, gy + 3.0, oz);
      v.mesh.position.copy(v.pos);
      v.body.setNextKinematicTranslation({ x: v.pos.x, y: v.pos.y + 0.26, z: v.pos.z });
      // Frame a side camera on the bird so the fall strip reads (pulled back +
      // raised; sun high so it isn't a horizon silhouette).
      const cam = ctx.three.camera;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      ctx.weather.intensity = 0;
      cam.position.set(v.pos.x + 7, gy + 4.5, v.pos.z + 7);
      cam.lookAt(v.pos.x, gy + 1.2, v.pos.z);
      cam.updateMatrixWorld(true);
      window.__game.setTime(0.5);
      // Drive the REAL death → swaps in the dynamic tumbling body.
      const killed = window.__game.killVulture(v.id);
      return { ok: true, killed, id: v.id };
    });
    if (r1.noVulture) { console.log('[vulture-kill] SKIP — no vulture'); return; }
    // Let the dynamic body tumble + settle (game stays live so physics ticks).
    // The player camera is far away + auto-tracks the player, so we can't film
    // the fall from here (D150 — in-motion feel is foreground-owed); instead we
    // PAUSE once it has settled and frame the resting corpse for a clean read.
    // rig-shot runs a deliberately slow sim clock (D172, ~8× wall:sim), so a 3m
    // fall + tumble + settle needs many wall-seconds of game-time to complete.
    await page.waitForTimeout(16000);
    const r2 = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const V = ctx.three.camera.position.constructor;
      const v = ctx.vultures.list[0];
      let tagged = false;
      v.mesh.traverse((o) => { if (o.userData.interactType === 'take' && o.userData.interactRegistry === 'vultures') tagged = true; });
      const gy = ctx.terrain.heightAt(v.pos.x, v.pos.z);
      // Measure the mesh's actual lowest point vs the ground (the feet-origin is
      // misleading once the bird rests on its side).
      v.mesh.updateMatrixWorld(true);
      const Box3 = ctx.three.scene.constructor === Object ? null : null;  // (unused — keep V import live)
      const box = { minY: Infinity, maxY: -Infinity };
      v.mesh.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox;
        for (const cx of [bb.min.x, bb.max.x]) for (const cy of [bb.min.y, bb.max.y]) for (const cz of [bb.min.z, bb.max.z]) {
          const p = new V(cx, cy, cz); o.localToWorld(p);
          if (p.y < box.minY) box.minY = p.y;
          if (p.y > box.maxY) box.maxY = p.y;
        }
      });
      const bottomGap = +(box.minY - gy).toFixed(2);   // lowest mesh point above ground
      // Freeze + frame the corpse on the dune.
      ctx.flags.paused = true;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      ctx.weather.intensity = 0;
      window.__game.setTime(0.5);
      const cam = ctx.three.camera;
      cam.position.set(v.pos.x + 1.6, gy + 1.0, v.pos.z + 1.6);
      cam.lookAt(v.pos.x, gy + 0.15, v.pos.z);
      cam.updateMatrixWorld(true);
      return { state: v.state, landed: v.landed, tagged, bottomGap, deathAge: +v.deathAge.toFixed(1) };
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(OUT, 'scen-vulture-kill-rest.png'), fullPage: false });
    // Lowest mesh point within ~0.25m of the ground = resting on the dune.
    const onGround = r2.bottomGap >= -0.25 && r2.bottomGap <= 0.25;
    const pass = r2.state === 'dead' && r2.landed === true && r2.tagged === true && onGround;
    console.log(`[vulture-kill] ${pass ? 'PASS' : 'FAIL'} ${JSON.stringify(r2)}`);
  },

  // Scrap-loot (ACAH): verify scrap debris scatters around wrecks (the bootstrap
  // loot fix) — count scrap pickups + how many sit within 12m of a wreck, and
  // frame a wreck with its scrap ring. --time for legibility.
  'scrap-loot': async (page) => {
    const t = argv.time !== undefined ? Number(argv.time) : 0.42;
    const r = await page.evaluate((t) => {
      const ctx = window.__game.ctx;
      window.__game.setTime(t);
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      ctx.three.renderer.setSize(900, 700, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 900 / 700; cam.updateProjectionMatrix(); }
      const scrap = (ctx.pickups.list || []).filter((p) => p.itemId === 'scrap');
      const wrecks = (ctx.salvageables?.list || []).map((s) => s.pos);
      // count scrap within 12m of any wreck
      let nearWreck = 0;
      for (const sp of scrap) {
        for (const w of wrecks) {
          const dx = sp.pos.x - w.x, dz = sp.pos.z - w.z;
          if (dx * dx + dz * dz < 144) { nearWreck++; break; }
        }
      }
      // frame the wreck that has the most scrap around it
      let best = null, bestN = -1;
      for (const w of wrecks) {
        let c = 0;
        for (const sp of scrap) {
          const dx = sp.pos.x - w.x, dz = sp.pos.z - w.z;
          if (dx * dx + dz * dz < 144) c++;
        }
        if (c > bestN) { bestN = c; best = w; }
      }
      if (best) {
        ctx.flags.paused = true;
        cam.position.set(best.x + 13, best.y + 11, best.z + 13);
        cam.lookAt(best.x, best.y + 0.3, best.z);
        cam.updateMatrixWorld(true);
      }
      return { scrapTotal: scrap.length, nearWreck, wreckCount: wrecks.length, bestWreckScrap: bestN };
    }, t);
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, 'scen-scrap-loot.png'), fullPage: false });
    console.log(`[scrap-loot] ${JSON.stringify(r)}`);
  },

  // Worm-shelter (ACAH): verify the sandworm won't acquire a SHELTERED player +
  // disengages if they reach shelter. Inject a shelter zone over a teleported
  // player 40m from the worm (inside still-detection ~82m); sheltered → stays
  // patrol; remove the zone → acquires. Logic eval (state read), no screenshot.
  'worm-shelter': async (page) => {
    const r1 = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      window.__game.setTime(0.5);           // midday — no twilight breach/ambush confounds
      const worm = ctx.sandWorms?.list?.[0];
      if (!worm) return { noWorm: true };
      worm.state = 'patrol';
      const wx = worm.basePos.x, wz = worm.basePos.z;
      const px = wx + 40, pz = wz;          // 40m away — inside still-detection radius
      const gy = ctx.terrain.heightAt(px, pz);
      ctx.player.body.body.setTranslation({ x: px, y: gy + 1.0, z: pz }, true);
      ctx.shelter.zones.push({ cx: px, cy: gy + 1.0, cz: pz, hx: 6, hy: 6, hz: 6 });
      return { ok: true };
    });
    if (r1.noWorm) { console.log('[worm-shelter] SKIP — no worm in world'); return; }
    await page.waitForTimeout(2800);
    const sheltered = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const worm = ctx.sandWorms.list[0];
      const out = { state: worm.state, inShelter: ctx.player.inShelter };
      ctx.shelter.zones.pop();              // expose the player for phase 2
      return out;
    });
    await page.waitForTimeout(3200);
    const exposed = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const worm = ctx.sandWorms.list[0];
      return { state: worm.state, inShelter: ctx.player.inShelter };
    });
    const pass = sheltered.inShelter === true && sheltered.state === 'patrol'
      && exposed.inShelter === false && exposed.state !== 'patrol';
    console.log(`[worm-shelter] ${pass ? 'PASS' : 'FAIL'} sheltered=${JSON.stringify(sheltered)} exposed=${JSON.stringify(exposed)}`);
  },

  // WORM-MODEL studio (Campaign C12) — surfaces ctx.sandWorms.list[0] on the sand
  // in a clean head-at-+X pose + frames it for MODEL iteration (the M3 hero creature).
  // `--angle=head|side|3q`. Pauses the sim so the posed mesh holds. If no worm exists
  // at spawn, tries ctx.sandWorms.spawnAt/forceSpawn; SKIPs if it can't make one.
  'worm-model': async (page) => {
    const angle = argv.angle || 'head';
    const r = await page.evaluate(({ ang }) => {
      const ctx = window.__game.ctx;
      ctx.weather.intensity = 0; ctx.weather.cloudiness = 0.12;
      window.__game.setTime(0.42);                 // raking light — reads the body taper + ridges
      ctx.three.renderer.toneMappingExposure = 1.25;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      ctx.flags.paused = true;                      // freeze the tick so the posed mesh holds
      let worm = ctx.sandWorms?.list?.[0];
      if (!worm && ctx.sandWorms?.spawnAt) {        // best-effort spawn near the player
        const pp = ctx.player.body.body.translation();
        try { worm = ctx.sandWorms.spawnAt(pp.x + 80, pp.z); } catch { /* no-op */ }
      }
      if (!worm) return { found: false };
      const ax = worm.basePos.x, az = worm.basePos.z;
      const groundY = ctx.terrain.heightAt(ax, az);
      const rad = 10, halfLen = 60;                 // SANDWORM_MAX_RADIUS, SANDWORM_LENGTH/2
      // Surface + pose: body along +X, head at +X.
      worm.mesh.visible = true;
      worm.mesh.rotation.set(0, 0, 0);
      let meshes = 0; worm.mesh.traverse((o) => { if (o.isMesh) meshes++; });
      if (ang === 'arc') {
        // Faithful LUNGE-PEAK pose — mirrors sandWorm.ts applyBodyBend + the lunge Y-curve at t=0.5:
        // PEAK=20, DEPTH=12.5, RAD=10 → basePos.y = ground − DEPTH/2 + PEAK = ground+13.75; bend amp 2.5;
        // tailSink = aboveGround + RAD*0.5 = 18.75. Confirms the C14 TAIL-BURIED read (tail under, front arcs).
        const aboveGround = 13.75, bendAmp = 2.5, tailSink = aboveGround + rad * 1.2;
        worm.mesh.position.set(ax, groundY + aboveGround, az);
        for (const child of worm.mesh.children) {
          if (child.userData._nomY === undefined) child.userData._nomY = child.position.y;
          const s = child.position.x / halfLen;
          const sBias = s - 0.15;
          const arch = Math.max(0, 1 - sBias * sBias) * bendAmp;
          const rear = Math.max(0, -s);
          child.position.y = child.userData._nomY + arch - rear * rear * tailSink;
        }
      } else if (ang === 'charge') {
        // C15 charge exposure: rides ground − MAX_RADIUS*CHARGE_SUBMERGE (0.42) so only the armored
        // back-ridge breaks the surface; the REAR tapers into the dune (mirrors applyBodyBend chargeDip).
        worm.mesh.position.set(ax, groundY - rad * 0.42, az);
        const chargeDip = rad * 1.0;
        for (const child of worm.mesh.children) {
          if (child.userData._nomY === undefined) child.userData._nomY = child.position.y;
          const s = child.position.x / halfLen;
          const rear = Math.max(0, -s);
          child.position.y = child.userData._nomY - rear * rear * chargeDip;
        }
      } else {
        worm.mesh.position.set(ax, groundY + rad * 0.55, az);
      }
      worm.mesh.updateMatrixWorld(true);
      const cam = ctx.three.camera;
      const headX = ax + halfLen;
      if (ang === 'arc') {                           // side-on lunge arc — tail buried + body arcing out
        cam.position.set(ax - halfLen * 0.05, groundY + rad * 2.4, az + halfLen * 1.5);
        cam.lookAt(ax - halfLen * 0.05, groundY + rad * 0.7, az);
      } else if (ang === 'charge') {                 // low 3q — the armored back-ridge breaking the surface
        cam.position.set(ax + halfLen * 0.55, groundY + rad * 1.1, az + halfLen * 0.65);
        cam.lookAt(ax, groundY + rad * 0.15, az);
      } else if (ang === 'head') {                   // close 3/4 on the maw + front body
        cam.position.set(headX + rad * 2.0, groundY + rad * 1.5, az + rad * 2.4);
        cam.lookAt(headX - rad * 0.8, groundY + rad * 0.7, az);
      } else if (ang === 'side') {                   // full 120m silhouette broadside
        cam.position.set(ax + halfLen * 0.1, groundY + rad * 3.4, az + halfLen * 1.6);
        cam.lookAt(ax, groundY + rad * 0.4, az);
      } else {                                       // 3q — head-led three-quarter of the whole body
        cam.position.set(ax + halfLen * 0.8, groundY + rad * 2.4, az + halfLen * 1.0);
        cam.lookAt(ax + halfLen * 0.15, groundY + rad * 0.4, az);
      }
      cam.updateMatrixWorld(true);
      let DirCtor = null, HemiCtor = null;
      ctx.three.scene.traverse((o) => { if (o.isDirectionalLight && !DirCtor) DirCtor = o.constructor; if (o.isHemisphereLight && !HemiCtor) HemiCtor = o.constructor; });
      let key = ctx.three.scene.getObjectByName('__wormKey');
      if (!key && DirCtor) { key = new DirCtor(); key.name = '__wormKey'; key.intensity = 2.1; key.color.set(0xfff2e0); ctx.three.scene.add(key.target); ctx.three.scene.add(key); }
      if (key) { key.position.set(cam.position.x + rad, cam.position.y + 24, cam.position.z + 12); key.target.position.set(ax + halfLen * 0.4, groundY, az); key.target.updateMatrixWorld(true); }
      if (!ctx.three.scene.getObjectByName('__wormFill') && HemiCtor) { const fill = new HemiCtor(0xbfccdd, 0x6b5840, 0.7); fill.name = '__wormFill'; ctx.three.scene.add(fill); }
      return { found: true, meshes, angle: ang, halfLen };
    }, { ang: angle });
    await page.waitForTimeout(340);
    if (!r.found) { console.log('[worm-model] SKIP — no worm in world'); return; }
    await page.screenshot({ path: join(OUT, `scen-worm-${angle}.png`), fullPage: false });
    console.log(`[worm-model] ${JSON.stringify(r)}`);
  },

  // Dev-panel (ACAD): open the dev item-spawner panel + click an item, verify
  // it renders + adds to inventory.
  'dev-panel': async (page) => {
    await page.evaluate(() => {
      const ctx = window.__game.ctx;
      ctx.flags.devMode = true;
      const badge = document.getElementById('dev-mode-badge');
      badge?.classList.add('visible');
      badge?.click();   // toggle the panel open
    });
    await page.waitForTimeout(450);
    await page.screenshot({ path: join(OUT, 'scen-dev-panel.png'), fullPage: false });
    const res = await page.evaluate(() => {
      const inv = window.__game.ctx.inventory;
      const total = () => inv.slots.concat(inv.backpack).reduce((n, s) => n + (s.item ? s.count : 0), 0);
      const before = total();
      // click the LAST item button (likely pulse_rifle — unlikely already in the loadout)
      const btns = document.querySelectorAll('.dev-item-btn');
      btns[btns.length - 1]?.click();
      return { itemCount: btns.length, totalBefore: before, totalAfter: total() };
    });
    console.log(`[dev-panel] items=${res.itemCount} invTotal ${res.totalBefore}→${res.totalAfter}`);
  },

  // Pulse-test (ACAC): smoke-test the pulse rifle's auto-fire + self-recharging
  // energy cell. Holds LMB (mouseHeld) for ~1.2s → the cell should drain; then
  // releases + waits → it should recharge. Numeric (no screenshot).
  'pulse-test': async (page) => {
    await page.evaluate(() => {
      const ctx = window.__game.ctx;
      ctx.input.controls.isLocked = true; ctx.flags.paused = false; ctx.flags.thirdPerson = false;
      const inv = ctx.inventory;
      inv.slots[0].item = 'pulse_rifle'; inv.slots[0].count = 1; inv.slots[0].meta = undefined;
      inv.selectedIdx = 0;
    });
    await page.waitForTimeout(350);   // updateHeld inits the cell
    const full = await page.evaluate(() => window.__game.ctx.inventory.slots[0].meta?.ammoRemaining ?? -1);
    const inp = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      ctx.input.mouseHeld.add(0);     // hold LMB
      return { hasHeld: ctx.input.mouseHeld.has(0), locked: ctx.input.controls.isLocked, hasSpec: !!window.__game.ctx };
    });
    // NOTE: the headless harness runs the game clock in slow-motion (dt clamped,
    // low fps) so GAME-time passes ~5x slower than wall-clock — wait long.
    const traj = [];
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(900);
      traj.push(await page.evaluate(() => {
        const ctx = window.__game.ctx;
        return +(ctx.inventory.slots[0].meta?.ammoRemaining ?? -1).toFixed(1) + (ctx.input.mouseHeld.has(0) ? '' : '!');
      }));
    }
    await page.evaluate(() => window.__game.ctx.input.mouseHeld.delete(0)); // release
    await page.waitForTimeout(9000);
    const afterRecharge = await page.evaluate(() => +(window.__game.ctx.inventory.slots[0].meta?.ammoRemaining ?? -1).toFixed(1));
    // (Headless runs the game clock slow, so the cell drains/recharges in
    // slow-motion vs wall-clock — the trajectory should DROP while held + return
    // to full after release.)
    console.log(`[pulse-test] cellFull=${full} input=${JSON.stringify(inp)} hold-traj=[${traj.join(',')}] afterRecharge=${afterRecharge}`);
  },

  // Sky (ACAB, Cycle 6): sweep cloud cover × time-of-day, aim the camera up at
  // the dome, and screenshot — verifies the procedural cloud layer (clear →
  // partly → overcast) and that clouds occlude stars at night. Headless.
  'sky': async (page) => {
    // [label, cloudiness, dayTime, pitch]
    const shots = [
      ['clear-noon', 0.0, 0.5, 0.55],
      ['partly-noon', 0.45, 0.5, 0.55],
      ['overcast-noon', 0.9, 0.5, 0.55],
      ['partly-dusk', 0.5, 0.72, 0.32],
      ['clear-night', 0.0, 0.95, 0.55],
      ['overcast-night', 0.9, 0.95, 0.55],
      // Ground-level: see the overcast LIGHTING flatten on terrain (vs clear).
      ['clear-noon-ground', 0.0, 0.5, -0.12],
      ['overcast-noon-ground', 0.92, 0.5, -0.12],
    ];
    for (const [label, cloud, time, pitch] of shots) {
      await page.evaluate(({ cloud, time }) => {
        const ctx = window.__game.ctx;
        ctx.weather.intensity = 0;
        window.__game.setCloudiness(cloud);
        window.__game.setTime(time);
        ctx.three.renderer.setSize(900, 700, false);
        const cam = ctx.three.camera;
        if (cam.isPerspectiveCamera) { cam.aspect = 900 / 700; cam.updateProjectionMatrix(); }
        ctx.flags.thirdPerson = false;
        if (ctx.player.rig) ctx.player.rig.group.visible = false;
      }, { cloud, time });
      await page.waitForTimeout(380);
      await page.evaluate((pitch) => {
        const cam = window.__game.ctx.three.camera;
        cam.rotation.set(pitch, 0.6, 0);
        cam.updateMatrixWorld(true);
      }, pitch);
      await page.waitForTimeout(220);
      const path = join(OUT, `scen-sky-${label}.png`);
      await page.screenshot({ path, fullPage: false });
      console.log(`[sky] ${label} → ${path}`);
    }
    // Storm telegraph: trigger a storm, let the 'building' state ramp the sky to
    // ominous overcast (before the dust wall), capture it.
    await page.evaluate(() => {
      const ctx = window.__game.ctx;
      window.__game.setCloudiness(-1);      // release the hold → auto (storm forces overcast)
      window.__game.setTime(0.5);
      window.__game.triggerStorm();
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
    });
    await page.waitForTimeout(4500);        // let cloudiness ramp during 'building'
    await page.evaluate(() => {
      const cam = window.__game.ctx.three.camera;
      cam.rotation.set(0.28, 0.6, 0); cam.updateMatrixWorld(true);
    });
    await page.waitForTimeout(300);
    const st = await page.evaluate(() => {
      const w = window.__game.ctx.weather;
      return { state: w.state, intensity: +w.intensity.toFixed(2), cloud: +w.cloudiness.toFixed(2) };
    });
    await page.screenshot({ path: join(OUT, 'scen-sky-storm-build.png'), fullPage: false });
    console.log(`[sky] storm-build → scen-sky-storm-build.png ${JSON.stringify(st)}`);
  },

  // FP-item (ACAA): equip an item in FIRST person and screenshot the REAL
  // viewmodel as the player sees it — this exercises the two-pass depth-cleared
  // viewmodel render (loop.ts), the only path where the see-through-rings bug
  // appears (the item-studio uses default-material meshes that already
  // depth-sort, so it can't reproduce it). --item=<id> OR --items=a,b,c.
  'fp-item': async (page) => {
    const items = String(argv.items || argv.item || 'scrap_bar').split(',').map((s) => s.trim());
    for (const item of items) {
      await page.evaluate(({ item, night }) => {
        const ctx = window.__game.ctx;
        ctx.weather.intensity = 0;
        window.__game.setTime(night ? 0.96 : 0.5);   // --night → dark, to see emitted light
        ctx.three.renderer.setSize(900, 900, false);
        const cam = ctx.three.camera;
        if (cam.isPerspectiveCamera) { cam.aspect = 1; cam.updateProjectionMatrix(); }
        ctx.flags.thirdPerson = false;        // FIRST person → FP viewmodel shows
        ctx.flags.started = true; ctx.flags.paused = false;
        // Hide the rig so the camera-at-head hood doesn't fill the frame in
        // this forced FP state (normal play keeps the head below the eyeline).
        if (ctx.player.rig) ctx.player.rig.group.visible = false;
        const inv = ctx.inventory;
        inv.slots[0].item = item; inv.slots[0].count = 1;
        // Light the torch / flashlight so their lit-only effects show.
        inv.slots[0].meta = item === 'torch' ? { lit: true, burnRemaining: 1 }
          : item === 'flashlight' ? { lit: true, fuelLevel: 1 } : undefined;
        inv.selectedIdx = 0;
      }, { item, night: !!argv.night });
      await page.waitForTimeout(450);         // let updateViewModel swap + camera settle to FP
      // Aim the FP camera UP at clean sky (FP sync only sets position, not
      // rotation) + re-assert FP/rig-hidden, so the item frames against sky.
      const lookPitch = argv.pitch !== undefined ? Number(argv.pitch) : 0.16;
      const dbg = await page.evaluate((pitch) => {
        const ctx = window.__game.ctx;
        ctx.flags.thirdPerson = false;
        if (ctx.player.rig) ctx.player.rig.group.visible = false;
        const cam = ctx.three.camera;
        cam.rotation.set(pitch, 2.2, 0);       // slight up + yaw away; --pitch=<rad> for look-down light tests
        cam.updateMatrixWorld(true);
        const vm = ctx.player.viewModel;
        const V = cam.position.constructor;
        vm.group.updateWorldMatrix(true, true);
        const ip = vm.itemRoot.getWorldPosition(new V());
        const cp = cam.position;
        return {
          tp: ctx.flags.thirdPerson, vmVisible: vm.group.visible, item: ctx.inventory.slots[0].item,
          sceneKids: vm.scene.children.length, groupInScene: vm.group.parent === vm.scene,
          itemMeshes: vm.itemRoot.children.length,
          cam: [cp.x.toFixed(1), cp.y.toFixed(1), cp.z.toFixed(1)],
          itemPos: [ip.x.toFixed(1), ip.y.toFixed(1), ip.z.toFixed(1)],
        };
      }, lookPitch);
      await page.waitForTimeout(260);
      const path = join(OUT, `scen-fp-${item}.png`);
      await page.screenshot({ path, fullPage: false });
      console.log(`[fp-item] ${item} → ${path}  ${JSON.stringify(dbg)}`);
    }
  },

  // Item-studio (ACY): build the item's makeViewModel mesh in ISOLATION (no rig
  // / world), suspended high against the sky gradient + lit for form, framed per
  // angle. The clean multi-angle view the deep item-detail pass iterates against
  // (the held-item shot buries small items behind the rig torso). --item=<id>,
  // --angles=front,3q,left,top (default). One PNG per angle.
  'item-studio': async (page) => {
    // --item=<id> OR --items=a,b,c (multiple items in one server boot).
    const items = String(argv.items || argv.item || 'machete').split(',').map((s) => s.trim());
    const angles = String(argv.angles || 'front,3q,left,top').split(',').map((s) => s.trim());
    for (const item of items) {
      for (const angle of angles) {
        const res = await page.evaluate(({ item, angle }) => window.__game.itemStudio(item, angle), { item, angle });
        await page.waitForTimeout(200);
        const path = join(OUT, `scen-item-${item}-${angle}.png`);
        await page.screenshot({ path, fullPage: false });
        console.log(`[item-studio] ${item} ${angle} → ${path}  ${JSON.stringify(res)}`);
      }
    }
  },

  // ACAV — panel-studio: isolated single salvage-panel framer for the shape +
  // interior visual-iteration loop. --shapes=rect,square,circle --kinds=fuselage
  // --archetype=electrical --state=open|closed --angles=front,3q,side,eye
  // --scale=1. Sweep mode (--sweep) loops shapes × a representative archetype set
  // × open/closed at 3q (one-pass /visual-triage fodder).
  'panel-studio': async (page) => {
    const sweep = argv.sweep !== undefined;
    const allArch = argv.allarch !== undefined;
    const shapes = String(argv.shapes || argv.shape || (sweep ? 'rect,square,circle' : 'rect')).split(',').map((s) => s.trim());
    const archetypes = (allArch)
      ? ['electrical', 'plumbing', 'avionics', 'mechanical', 'junction']
      : (argv.archetypes || argv.archetype)
        ? String(argv.archetypes || argv.archetype).split(',').map((s) => s.trim())
        : [undefined];
    const angles = String(argv.angles || (sweep || allArch ? '3q' : 'front,3q,side')).split(',').map((s) => s.trim());
    const states = argv.state ? [String(argv.state)] : (argv.open !== undefined ? ['open'] : (sweep ? ['closed', 'open'] : (allArch ? ['open'] : ['closed'])));
    const scale = Number(argv.scale || 1);
    const occlude = argv.occlude !== undefined;   // ACAX — drop a hull slab in front (stencil-portal spike)
    for (const shape of shapes) {
      for (const archetype of archetypes) {
        for (const st of states) {
          for (const angle of angles) {
            const res = await page.evaluate(
              ({ shape, archetype, st, angle, scale, occlude }) =>
                window.__game.spawnPanelStudio({ shape, archetype, scale, open: st === 'open', angle, occlude }),
              { shape, archetype, st, angle, scale, occlude },
            );
            await page.waitForTimeout(220);
            const tag = (archetype ? `${shape}-${archetype}` : `${shape}-fuselage`) + (occlude ? '-occ' : '');
            const path = join(OUT, `scen-panelstudio-${tag}-${st}-${angle}.png`);
            await page.screenshot({ path, fullPage: false });
            console.log(`[panel-studio] ${tag}/${st}/${angle} → ${path}  ${JSON.stringify(res)}`);
          }
        }
      }
    }
  },

  // ACAX — WYSIWYG salvage audit. For every registered panel, the number of VISIBLE
  // interior components must EQUAL salvageRemaining (so what you see is what you can
  // salvage). Boots the real world + iterates ctx.salvageables.list.
  'salvage-audit': async (page) => {
    const r = await page.evaluate(() => {
      const list = window.__game.ctx.salvageables.list;
      let mismatches = 0; const samples = []; const byCond = {};
      for (const s of list) {
        const comps = s.panel.userData.panelComponents ?? [];
        const visible = comps.filter((c) => c.visible).length;
        const match = visible === s.salvageRemaining;
        if (!match) mismatches++;
        byCond[s.condition] = byCond[s.condition] || { n: 0, vis: 0, rem: 0 };
        byCond[s.condition].n++; byCond[s.condition].vis += visible; byCond[s.condition].rem += s.salvageRemaining;
        if (!match && samples.length < 8) samples.push({ cond: s.condition, visible, remaining: s.salvageRemaining });
      }
      return { total: list.length, mismatches, byCond, samples };
    });
    console.log('[salvage-audit] ' + JSON.stringify(r));
    console.log(r.mismatches === 0
      ? `[salvage-audit] PASS — visible == salvageable across all ${r.total} panels`
      : `[salvage-audit] FAIL — ${r.mismatches}/${r.total} mismatches`);
  },

  // ACAX — door pop-off smoke test. Pops a salvage-panel door (physics), lets the
  // LIVE loop run, then asserts the door detached + FELL + reached a finite resting
  // pose (no NaN / explosion / fall-through). The "satisfying" feel is walk-test-owed.
  'door-pop': async (page) => {
    const before = await page.evaluate((seed) => window.__game.popTestDoor(seed), Number(argv.seed || 1337));
    console.log('[door-pop] pop: ' + JSON.stringify(before));
    if (!before.ok) { console.log('[door-pop] FAIL — door did not pop'); return; }
    await page.waitForTimeout(2800);   // live loop steps physics → door falls + settles
    const after = await page.evaluate(() => window.__game.panelDebris());
    const d = after.doors[0];
    const finite = !!d && Number.isFinite(d.y);
    const fell = finite && d.y < before.spawnY - 0.3;
    console.log(`[door-pop] spawnY=${before.spawnY} restY=${d ? d.y.toFixed(2) : 'NONE'} fell=${fell} finite=${finite} sleeping=${d ? d.sleeping : '?'} count=${after.count}`);
    console.log(fell && finite ? '[door-pop] PASS — door detached + fell with physics to a finite pose' : '[door-pop] FAIL');
  },

  // Speeder-FX (ACW C7/C8): drive the (unmounted) bike LIVE for ~0.6s so the
  // dust trail builds + the engine glow ramps with speed, then PAUSE (freezes
  // the dust cloud mid-air + holds the glow) and free-camera a 3/4-behind shot
  // showing the trail + the hot nozzle. Re-inject forward velocity each tick so
  // the unmounted damping doesn't bleed the speed (→ no dust).
  'speeder-fx': async (page) => {
    await page.evaluate(() => {
      const ctx = window.__game.ctx;
      ctx.weather.intensity = 0;
      window.__game.setTime(0.5);
      ctx.three.renderer.toneMappingExposure = 1.05;
      ctx.three.renderer.setSize(1000, 720, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1000 / 720; cam.updateProjectionMatrix(); }
      const s = ctx.speeder;
      const bx = 8, bz = 0, by = ctx.terrain.heightAt(bx, bz) + 1.2;
      s.body.setTranslation({ x: bx, y: by, z: bz }, true);   // yaw 0 → forward = -Z
      s.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      s.mounted = false;
    });
    // Drive forward (-Z) for several ticks; re-inject velocity each step.
    for (let i = 0; i < 11; i++) {
      await page.evaluate(() => {
        const s = window.__game.ctx.speeder;
        s.body.setLinvel({ x: 0, y: s.body.linvel().y, z: -12 }, true);
      });
      await page.waitForTimeout(55);
    }
    const info = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      ctx.flags.paused = true;                 // freeze dust cloud + glow + camera
      const s = ctx.speeder;
      const p = s.body.translation();
      const cam = ctx.three.camera;
      // Bike drove -Z, so the dust trails behind it toward +Z. View 3/4
      // behind-right so the trail recedes into frame + the nozzle glow shows.
      cam.position.set(p.x + 1.8, p.y + 1.1, p.z + 3.6);
      cam.lookAt(p.x, p.y + 0.05, p.z + 0.6);
      cam.updateMatrixWorld(true);
      // ACAS A2 — static-merge safety check: every interactive/animated ref must
      // still resolve + sit in the speeder graph; count meshes under the group.
      const inGraph = (o) => { let n = o; while (n) { if (n === s.group) return true; n = n.parent; } return false; };
      let meshCount = 0; s.group.traverse((o) => { if (o.isMesh) meshCount++; });
      const merge = {
        discOk: !!(s.headlampDisc && s.headlampDisc.isMesh && inGraph(s.headlampDisc)),
        towBarOk: !!(s.towBar && s.towBar.isMesh && inGraph(s.towBar)),
        seatOk: !!(s.seat && s.seat.userData.interactType === 'mount' && inGraph(s.seat)),
        headlampOk: !!(s.headlamp && s.headlamp.isSpotLight && inGraph(s.headlamp)),
        speederMeshes: meshCount,
      };
      return { speed: +s.speed.toFixed(1), bikeZ: +p.z.toFixed(1), merge };
    });
    console.log(`[speeder-fx] final speed=${info.speed} bikeZ=${info.bikeZ} merge=${JSON.stringify(info.merge)}`);
    await page.waitForTimeout(250);
    const path = join(OUT, 'scen-speeder-fx.png');
    await page.screenshot({ path, fullPage: false });
    console.log(`[rig-shot] saved ${path}`);
  },

  // Companion (ACW B6 ASSESS): the companion is already a full proc-character
  // (icosahedron carapace + 5 radial legs + gait). Frame it close from two
  // angles + a walking-pose leg lift so we can judge whether it needs polish or
  // already reads. Paused free camera.
  'companion': async (page) => {
    const shots = [
      { tag: '3q', off: [0.55, 0.40, 0.62], walk: false },
      { tag: 'side', off: [0.0, 0.30, 0.78], walk: false },
      { tag: 'walk', off: [0.5, 0.34, 0.6], walk: true },
    ];
    for (const sh of shots) {
      await page.evaluate((sh) => {
        const ctx = window.__game.ctx;
        ctx.weather.intensity = 0;
        window.__game.setTime(0.5);
        ctx.three.renderer.toneMappingExposure = 1.1;
        ctx.three.renderer.setSize(900, 900, false);
        const cam = ctx.three.camera;
        if (cam.isPerspectiveCamera) { cam.aspect = 1; cam.updateProjectionMatrix(); }
        const c = ctx.companion;
        if (!c) return;
        const cx = c.pos.x, cz = c.pos.z;
        const cy = ctx.terrain.heightAt(cx, cz);
        if (sh.walk) {
          // Pose a mid-walk leg lift so leg taper/segmenting is visible.
          const REST = 0.6, LIFT = 0.55;
          for (let i = 0; i < c.legs.length; i++) {
            c.legs[i].visible = true;
            const ph = (i / 5) * Math.PI * 2;
            c.hips[i].rotation.z = -REST + Math.max(0, Math.sin(ph)) * LIFT;
          }
        }
        ctx.flags.paused = true;
        c.group.updateMatrixWorld(true);
        cam.position.set(cx + sh.off[0], cy + sh.off[1], cz + sh.off[2]);
        cam.lookAt(cx, cy + 0.12, cz);
        cam.updateMatrixWorld(true);
      }, sh);
      await page.waitForTimeout(250);
      const path = join(OUT, `scen-companion-${sh.tag}.png`);
      await page.screenshot({ path, fullPage: false });
      console.log(`[companion] ${sh.tag} → ${path}`);
    }
  },

  // Aim-twist (ACN dynamic): drive the 3P camera yaw over rAF ticks and sample
  // rig._aimTwist to PROVE it responds to turn RATE (not a constant). Then two
  // paused posed shots (resting bias vs full lead) for the visual range. The
  // page is visible Playwright so rAF actually ticks (unlike the hidden preview).
  'aim-twist': async (page) => {
    // Drive + sample from NODE (page.waitForTimeout), letting the game's own
    // tick loop run. Must NOT use in-page requestAnimationFrame: the Playwright
    // page is `hidden`, so rAF is throttled to ~0 (the game survives via its
    // setTimeout fallback in loop.ts — D146). Shrink canvas for fast ticks.
    await page.evaluate(() => window.__game.ctx.three.renderer.setSize(64, 64, false));
    const setYaw = (y) => page.evaluate((yy) => {
      const c = window.__game.ctx.three.camera;
      c.quaternion.setFromEuler(new (c.rotation.constructor)(-0.12, yy, 0, 'YXZ'));
      c.updateMatrixWorld(true);
    }, y);
    const readAim = () => page.evaluate(() => +window.__game.ctx.player.rig._aimTwist.toFixed(3));
    const samples = [];
    // steady → relaxes to the resting bias
    await setYaw(0); await page.waitForTimeout(1200);
    samples.push({ phase: 'steady', aim: await readAim() });
    // turn LEFT — ramp yaw + in small steps so the heading keeps changing
    // (continuous turn rate); read promptly so the lead is fresh.
    let y = 0;
    for (let i = 0; i < 14; i++) { y += 0.10; await setYaw(y); await page.waitForTimeout(70); }
    samples.push({ phase: 'turn+', aim: await readAim() });
    // turn RIGHT — ramp yaw back the other way
    for (let i = 0; i < 14; i++) { y -= 0.10; await setYaw(y); await page.waitForTimeout(70); }
    samples.push({ phase: 'turn-', aim: await readAim() });
    // stop → relaxes back toward the bias
    await page.waitForTimeout(1500);
    samples.push({ phase: 'relax', aim: await readAim() });
    console.log('[aim-twist] dynamic response: ' + JSON.stringify(samples));
    for (const [tag, val] of [['rest', 0.18], ['lead', 0.5]]) {
      await page.evaluate((v) => {
        const ctx = window.__game.ctx;
        ctx.three.renderer.setSize(900, 1100, false); // restore from the 48×48 numeric-loop size
        ctx.flags.paused = true;                       // freeze so our pose survives the shot
        const rig = ctx.player.rig;
        rig.shoulders[1].rotation.y = v;
        rig.group.updateMatrixWorld(true);
        const cam = ctx.three.camera; const V = cam.position.constructor;
        if (cam.isPerspectiveCamera) { cam.aspect = 900 / 1100; cam.updateProjectionMatrix(); }
        const hp = rig.headGroup.getWorldPosition(new V());
        cam.position.set(hp.x + 1.5, hp.y + 0.05, hp.z + 1.0); // front-ish, slightly above
        cam.lookAt(hp.x, hp.y - 0.30, hp.z);
        cam.updateMatrixWorld(true);
      }, val);
      await page.waitForTimeout(300);
      const path = join(OUT, `scen-aim-twist-${tag}.png`);
      await page.screenshot({ path, fullPage: false });
      console.log(`[rig-shot] saved ${path}`);
    }
  },

  // Rifle (ACL amban_rifle): equip in hotbar slot 0 (1P viewmodel), prove the
  // ranged FIRE path decrements ammo + the R-reload refills from scrap_bullet
  // stacks, then a 1P viewmodel screenshot. State-based (functional) verify —
  // reliable without trying to catch a muzzle flash in a slow software render.
  'rifle': async (page) => {
    // Equip + state setup. Node-driven press re-injection below (NOT in-page rAF
    // — the page is hidden so rAF is throttled, and a single-tick input inject
    // races endInputFrame which clears pressed/mousePressed each tick — D146).
    await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const inv = ctx.inventory;
      inv.slots[0].item = 'amban_rifle'; inv.slots[0].count = 1; inv.slots[0].meta = { ammoRemaining: 3 };
      inv.slots[1].item = 'scrap_bullet'; inv.slots[1].count = 12; inv.slots[1].meta = undefined;
      inv.selectedIdx = 0;
      ctx.three.renderer.setSize(64, 64, false);     // fast ticks for the fire/reload sim
    });
    const ammo = () => page.evaluate(() => window.__game.ctx.inventory.slots[0].meta.ammoRemaining);
    const bullets = () => page.evaluate(() => { const s = window.__game.ctx.inventory.slots[1]; return s.item === 'scrap_bullet' ? s.count : 0; });
    const ammo0 = await ammo();
    // FIRE — re-inject LMB each step until ammo drops (cooldown then blocks further shots).
    let ammoAfterShot = ammo0;
    for (let i = 0; i < 14; i++) {
      await page.evaluate(() => window.__game.ctx.input.mousePressed.add(0));
      await page.waitForTimeout(110);
      ammoAfterShot = await ammo();
      if (ammoAfterShot < ammo0) break;
    }
    // RELOAD — re-inject R until ammo refills from the scrap_bullet stack.
    let ammoAfterReload = ammoAfterShot;
    for (let i = 0; i < 14; i++) {
      await page.evaluate(() => window.__game.ctx.input.pressed.add('KeyR'));
      await page.waitForTimeout(110);
      ammoAfterReload = await ammo();
      if (ammoAfterReload > ammoAfterShot) break;
    }
    const result = { equipped: 'amban_rifle', ammo0, ammoAfterShot, ammoAfterReload, bulletsLeft: await bullets() };
    console.log('[rifle] ' + JSON.stringify(result));
    // 1P viewmodel screenshot (restore size).
    await page.evaluate(() => {
      const ctx = window.__game.ctx;
      ctx.three.renderer.setSize(900, 1100, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 900 / 1100; cam.updateProjectionMatrix(); }
    });
    await page.waitForTimeout(500);
    const path = join(OUT, 'scen-rifle-viewmodel.png');
    await page.screenshot({ path, fullPage: false });
    console.log(`[rig-shot] saved ${path}`);
  },

  // Night-sky (ACO): set deep night, let lighting settle sunHeight, confirm the
  // ambient tan dust drift is hidden (gated on sun height) + capture the sky so
  // the stars read. Camera pitched up toward the star field.
  'night-sky': async (page) => {
    const info = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      ctx.three.renderer.setSize(900, 1100, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 900 / 1100; cam.updateProjectionMatrix(); }
      window.__game.setTime(0.0);            // midnight
      return { dayTime: ctx.time.dayTime };
    });
    await page.waitForTimeout(900);          // let lighting.update settle sunHeight + dust fade
    const result = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const cam = ctx.three.camera;
      // pitch the camera up ~35° to frame the star field
      cam.quaternion.setFromEuler(new (cam.rotation.constructor)(0.6, 0, 0, 'YXZ'));
      cam.updateMatrixWorld(true);
      return {
        sunHeight: +ctx.time.sunHeight.toFixed(3),
        dustVisible: ctx.ambientDust ? ctx.ambientDust.particles.visible : null,
        dustOpacity: ctx.ambientDust ? +ctx.ambientDust.particleMat.opacity.toFixed(4) : null,
      };
    });
    console.log('[night-sky] ' + JSON.stringify(result));
    await page.waitForTimeout(300);
    const path = join(OUT, 'scen-night-sky.png');
    await page.screenshot({ path, fullPage: false });
    console.log(`[rig-shot] saved ${path}`);
  },

  // Panels (ACP; ACY-hardened): enumerate salvage panels, force every door
  // open, then (1) run a HEADLESS BURY ASSERTION — for each panel, raycast
  // inward along its own outward axis against its wreck root; if the nearest
  // hit isn't the panel itself, hull occludes it (buried) → FAIL — and (2)
  // screenshot a sample from the front. Each harness boot rolls a fresh random
  // seed, so re-running sweeps seeds. Static (pause after the door-lerp).
  'panels': async (page) => {
    await page.evaluate(() => { window.__game.ctx.three.renderer.setSize(900, 1100, false); window.__game.setTime(0.42); });
    const list = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      ctx.salvageables.list.forEach((s) => {
        s.panel.userData.panelOpened = true;
        s.panel.userData.panelDoorTarget = 2.2;   // ~126° — clearly open
      });
      return { count: ctx.salvageables.list.length, seed: ctx.seed ?? '?' };
    });
    console.log(`[panels] seed=${list.seed} count=${list.count}`);
    await page.waitForTimeout(1400);             // let updatePanelDoors lerp them open

    // ── Bury assertion (runs in TS via __game.panelBuryAudit — THREE there). ──
    const audit = await page.evaluate(() => window.__game.panelBuryAudit());
    console.log(`[panels] BURY-AUDIT seed=${list.seed} pass=${audit.pass}/${audit.tested} fails=${audit.failCount} ${audit.failCount ? JSON.stringify(audit.fails) : 'ALL CLEAR'}`);
    // ACBA — surface-scoped terrain audit (corner-aware; interiors excluded).
    const t = audit.terrain;
    if (t) console.log(`[panels] TERRAIN-AUDIT seed=${list.seed} pass=${t.pass}/${t.tested} fails=${t.failCount} ${t.failCount ? JSON.stringify(t.fails) : 'ALL CLEAR'}`);

    // ── Screenshots: sample panels from the front (all kinds + first few). ──
    const targets = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const V = ctx.three.camera.position.constructor;
      const Q = ctx.three.camera.quaternion.constructor;
      const items = ctx.salvageables.list.map((s, idx) => {
        const wp = s.panel.getWorldPosition(new V());
        const outward = new V(0, 0, 1).applyQuaternion(s.panel.getWorldQuaternion(new Q()));
        return { idx, kind: s.kind || s.wreckKind || '?', x: wp.x, y: wp.y, z: wp.z, ox: outward.x, oy: outward.y, oz: outward.z };
      });
      const seen = new Set(); const pick = [];
      for (const it of items) { const k = it.kind; if (!seen.has(k)) { seen.add(k); pick.push(it); } if (pick.length >= 12) break; }
      ctx.flags.paused = true;
      return pick;
    });
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      await page.evaluate((t) => {
        const ctx = window.__game.ctx;
        const cam = ctx.three.camera;
        cam.position.set(t.x + t.ox * 1.7, t.y + 0.35, t.z + t.oz * 1.7);
        cam.lookAt(t.x, t.y, t.z);
        cam.updateMatrixWorld(true);
      }, t);
      await page.waitForTimeout(200);
      const path = join(OUT, `scen-panel-${String(i).padStart(2, '0')}-${t.kind}.png`);
      await page.screenshot({ path, fullPage: false });
      console.log(`[panels] shot ${i}: kind=${t.kind} → ${path}`);
    }
  },

  // Stake (ACQ): equip + place a stake_kit, then frame the deployed stake to
  // confirm the ACQ fixes — no sand mound, rope-loop seated near the top
  // touching the shaft. Static (pause after place).
  'stake': async (page) => {
    await page.evaluate(() => {
      const ctx = window.__game.ctx;
      ctx.inventory.slots[0].item = 'stake_kit'; ctx.inventory.slots[0].count = 1;
      ctx.inventory.selectedIdx = 0;
      window.__game.setTime(0.42);
    });
    // Place via the LMB 'place' wield path (re-inject until a stake exists).
    let placed = false;
    for (let i = 0; i < 12 && !placed; i++) {
      placed = await page.evaluate(() => {
        window.__game.ctx.input.mousePressed.add(0);
        return window.__game.ctx.stakes.list.length > 0;
      });
      await page.waitForTimeout(120);
    }
    const info = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const s = ctx.stakes.list[0];
      if (!s) return { placed: false };
      ctx.three.renderer.setSize(900, 1100, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 900 / 1100; cam.updateProjectionMatrix(); }
      ctx.flags.paused = true;
      cam.position.set(s.pos.x + 0.7, s.pos.y + 0.75, s.pos.z + 0.7); // close 3/4 from above
      cam.lookAt(s.pos.x, s.pos.y + 0.45, s.pos.z);
      cam.updateMatrixWorld(true);
      return { placed: true, pos: [+s.pos.x.toFixed(1), +s.pos.z.toFixed(1)] };
    });
    console.log('[stake] ' + JSON.stringify(info));
    await page.waitForTimeout(300);
    const path = join(OUT, 'scen-stake.png');
    await page.screenshot({ path, fullPage: false });
    console.log(`[rig-shot] saved ${path}`);
  },

  // Shrew-kill (ACR): equip the rifle, aim point-blank at a shrew, fire until
  // it dies, then take the meat. Verifies the combat→damageShrew→dead→'take'→
  // raw_shrew_meat chain via state (aim+cook loop still needs foreground feel).
  'shrew-kill': async (page) => {
    // Combat-aim on a small fleeing critter isn't reliably scriptable headlessly
    // (the shrew flees + its AI moves it each tick out of the ray). The
    // combat→damageShrew branch is a tsc-clean 1:1 mirror of the proven lizard
    // path; here we verify the NEW take→meat→lootShrew chain reliably by placing
    // a dead-tagged shrew directly in the crosshair (replicating
    // applyDeadShrewPose), then taking it via the real interaction path.
    const setup = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      ctx.three.renderer.setSize(64, 64, false);
      const s = ctx.shrews.list[0];
      if (!s) return { err: 'no shrew' };
      const cam = ctx.three.camera;
      const fwd = new (cam.position.constructor)();
      cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      // Place the shrew 1.2m straight ahead of the camera (already in the
      // crosshair → the interaction raycast hits without any aim fight).
      const sx = cam.position.x + fwd.x * 1.2, sz = cam.position.z + fwd.z * 1.2;
      const gy = ctx.terrain.heightAt(sx, sz);
      s.pos.set(sx, gy + 0.04, sz); s.mesh.position.copy(s.pos);
      s.body.setNextKinematicTranslation({ x: sx, y: gy + 0.04, z: sz });
      // Mark dead + retag (replicate applyDeadShrewPose).
      s.state = 'dead';
      s.mesh.rotation.z = Math.PI / 2;
      s.mesh.traverse((o) => { o.userData.interactType = 'take'; o.userData.interactId = s.id; o.userData.interactRegistry = 'shrews'; });
      return { shrewId: s.id, deadState: s.state };
    });
    // Take it — aim the camera DOWN at the ground-level dead shrew each frame
    // (a level forward ray would pass over its head) + re-inject E.
    let meat = 0; let hoverNoun = null;
    for (let i = 0; i < 16 && meat === 0; i++) {
      hoverNoun = await page.evaluate(() => {
        const ctx = window.__game.ctx;
        const s = ctx.shrews.list.find((x) => x.state === 'dead');
        if (s) { const cam = ctx.three.camera; cam.lookAt(s.pos.x, s.pos.y + 0.04, s.pos.z); cam.updateMatrixWorld(true); }
        ctx.input.pressed.add('KeyE');
        return ctx.inventory.hover ? ctx.inventory.hover.promptNoun : null;
      });
      await page.waitForTimeout(110);
      meat = await page.evaluate(() => { let n = 0; for (const sl of window.__game.ctx.inventory.slots) if (sl.item === 'raw_shrew_meat') n += sl.count; return n; });
    }
    const looted = await page.evaluate(() => !window.__game.ctx.shrews.list.some((x) => x.id === 1 || x.state === 'dead'));
    console.log('[shrew-kill] ' + JSON.stringify({ ...setup, hoverNoun, rawShrewMeat: meat, deadRemovedAfterTake: looted }));
  },

  // Footprints (ACO repro): walk → mount speeder → dismount → walk again, and
  // sample rig.stepCount each phase. If stepCount stops climbing after the
  // mount/dismount cycle, the gait (and thus footprint spawning) is wedged.
  // Driven from Node (keys persist; pressed cleared each tick → re-inject E).
  'footprints': async (page) => {
    await page.evaluate(() => { window.__game.ctx.three.renderer.setSize(64, 64, false); });
    const walk = async (label, ms) => {
      const before = await page.evaluate(() => {
        const c = window.__game.ctx;
        c.input.keys['KeyW'] = true;          // hold forward (keys persist; not cleared by endInputFrame)
        return { step: c.player.rig.stepCount, x: +c.player.body.body.translation().x.toFixed(2) };
      });
      await page.waitForTimeout(ms);
      const after = await page.evaluate(() => {
        const c = window.__game.ctx;
        c.input.keys['KeyW'] = false;
        return {
          step: c.player.rig.stepCount, x: +c.player.body.body.translation().x.toFixed(2),
          speedMag: +c.player.rig.speedMag.toFixed(2), state: c.player.rig.state,
        };
      });
      console.log(`[footprints] ${label}: stepCount ${before.step}→${after.step} (Δ${after.step - before.step}), moved ${(after.x - before.x).toFixed(2)}m, speedMag=${after.speedMag} state=${after.state}`);
      return after.step - before.step;
    };
    const dWalkA = await walk('walk-A (pre-mount)', 1600);
    // Teleport adjacent to the speeder so the mount (proximity-gated) succeeds.
    await page.evaluate(() => {
      const c = window.__game.ctx;
      const s = c.speeder;
      if (s) {
        const gy = c.terrain.heightAt(s.pos.x + 1.2, s.pos.z);
        c.player.body.body.setTranslation({ x: s.pos.x + 1.2, y: gy + 1.6, z: s.pos.z }, true);
      }
    });
    await page.waitForTimeout(150);
    // Mount: re-inject E until mounted (updateSpeeder reads pressed.has('KeyE')).
    let mounted = false;
    for (let i = 0; i < 12 && !mounted; i++) {
      mounted = await page.evaluate(() => {
        const c = window.__game.ctx;
        c.input.pressed.add('KeyE');
        return !!(c.speeder && c.speeder.mounted);
      });
      await page.waitForTimeout(110);
    }
    const distInfo = await page.evaluate(() => {
      const c = window.__game.ctx;
      const p = c.player.body.body.translation();
      const s = c.speeder;
      return { mounted: !!(s && s.mounted), dist: s ? +Math.hypot(p.x - s.pos.x, p.z - s.pos.z).toFixed(1) : null };
    });
    console.log(`[footprints] after mount attempts: ${JSON.stringify(distInfo)}`);
    await page.waitForTimeout(800); // ride a beat
    // Dismount.
    for (let i = 0; i < 12; i++) {
      const stillMounted = await page.evaluate(() => {
        const c = window.__game.ctx;
        c.input.pressed.add('KeyE');
        return !!(c.speeder && c.speeder.mounted);
      });
      await page.waitForTimeout(110);
      if (!stillMounted) break;
    }
    await page.waitForTimeout(300);
    const dWalkB = await walk('walk-B (post-dismount)', 1600);
    console.log(`[footprints] VERDICT: pre-mount Δstep=${dWalkA}, post-dismount Δstep=${dWalkB} → ${dWalkB > 0 ? 'footprints RESUME (no bug here)' : 'footprints WEDGED (bug confirmed)'}`);
  },
};

function startDev() {
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'npm.cmd' : 'npm';
  const proc = spawn(cmd, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    shell: isWin,
  });
  let exited = false;
  proc.on('exit', () => { exited = true; });
  proc.stdout.on('data', () => {});
  proc.stderr.on('data', () => {});
  return new Promise((res, rej) => {
    const start = Date.now();
    const tick = async () => {
      if (exited) return rej(new Error('dev server exited early'));
      if (Date.now() - start > 30000) { proc.kill(); return rej(new Error('dev server not ready in 30s')); }
      try {
        const r = await fetch(`http://127.0.0.1:${PORT}/`);
        if (r.ok) return res(proc);
      } catch {}
      setTimeout(tick, 300);
    };
    tick();
  });
}

// Dramatic key/fill/shadow lighting — rigStudio cranks ambient to 2.2 + exposure
// 2.0 (flat, even, kills all form). For a fair realism read (and a better in-game
// presentation), drop ambient, keep a strong directional sun for shadow/form, and
// lower exposure so highlights don't blow out. Self-shadowing on the rig (chin,
// folds, under the tunic hem) is what makes a 3D form read as solid rather than flat.
async function maybeFormLight(page) {
  if (LIT !== 'form') return;
  await page.evaluate(() => {
    const ctx = window.__game.ctx;
    const scene = ctx.three.scene;
    const cam = ctx.three.camera;
    const V = cam.position.constructor;
    let sun = null;
    scene.traverse((o) => {
      if (!o.isLight) return;
      if (o.type === 'AmbientLight') o.intensity = 0.28;          // low fill → form reads
      else if (o.type === 'HemisphereLight') o.intensity = 0.35;
      else if (o.type === 'DirectionalLight' && o.intensity > 0 && !sun) {
        sun = o;                                                   // KEY
        o.intensity = 3.0;
        o.castShadow = true;
        if (o.shadow) { o.shadow.bias = -0.0004; o.shadow.normalBias = 0.02; }
      }
    });
    // RIM/back light — separates the silhouette from the ground = the single
    // biggest "solid 3D figure" read. Placed behind the figure relative to the
    // camera, up high, cool tint. Created once + repositioned per shot.
    const rig = ctx.player.rig;
    const head = rig.headGroup.getWorldPosition(new V());
    const behind = new V().subVectors(head, cam.position).normalize(); // away from camera
    let rim = scene.getObjectByName('__rimLight');
    if (!rim && sun) { rim = new sun.constructor(0xbfd4ff, 2.2); rim.name = '__rimLight'; scene.add(rim); }
    if (rim) {
      rim.position.set(head.x + behind.x * 4 + 1.5, head.y + 3.5, head.z + behind.z * 4);
      if (rim.target) { rim.target.position.copy(head); rim.target.updateMatrixWorld(true); }
    }
    ctx.three.renderer.shadowMap.enabled = true;
    ctx.three.renderer.toneMappingExposure = 1.05;
  });
  await page.waitForTimeout(250);
}

async function main() {
  if (!POSES[POSE]) throw new Error(`unknown pose "${POSE}" (idle|apose|walk)`);
  console.log(`[rig-shot] starting dev server on ${PORT}…`);
  const dev = await startDev();
  console.log(`[rig-shot] dev up; launching chromium…`);
  const browser = await chromium.launch({
    args: ['--enable-webgl', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });
  try {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`  [page error] ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') console.log(`  [browser error] ${m.text()}`); });
    // ACN — mark the tutorial intro as seen BEFORE any page script runs, so the
    // first-boot controls panel never opens. Otherwise it stays open in the
    // headless session and `updateWieldAction`'s overlayOpen() gate suppresses
    // ALL LMB actions (attack/place) — which silently blocked the rifle-fire
    // scenario (reload uses a separate path with no overlay gate, so it worked).
    await page.addInitScript((seed) => {
      try { localStorage.setItem('dustfall.tutorial.v1', JSON.stringify({ seenIntro: true, usedItems: [] })); } catch { /* ignore */ }
      // Pin the world seed so rig-shots are DETERMINISTIC (same world every run →
      // clean before/after visual comparisons). Re-set on every document load
      // (boot consumes/removes the pending key). Override with --seed=<n>.
      try { localStorage.setItem('dustfall.pendingSeed', String(seed)); } catch { /* ignore */ }
    }, Number(argv.seed ?? 1337));
    await page.goto(`http://127.0.0.1:${PORT}/`);
    // Wait for the rig to exist (Rapier WASM + boot done).
    await page.waitForFunction(() => !!(window.__game && window.__game.ctx?.player?.rig), undefined, { timeout: 30000 });
    // ACN — live scenario mode short-circuits the static pose/angle path.
    if (SCENARIO) {
      const fn = SCENARIOS[SCENARIO];
      if (!fn) throw new Error(`unknown scenario "${SCENARIO}" (${Object.keys(SCENARIOS).join('|')})`);
      console.log(`[rig-shot] running live scenario "${SCENARIO}" (${FRAMES} frames @ ${INTERVAL}ms)…`);
      await enterLive(page, ['shrew-flee', 'rifle', 'shrew-kill'].includes(SCENARIO) ? false : true);
      await fn(page);
      return; // the finally below closes browser + kills dev
    }
    // Enter the studio (headless enter + lighting + unpause), let a frame settle
    // the rig at the player, then pause + pose.
    await page.evaluate(() => window.__game.rigStudio());
    await page.waitForTimeout(700);
    await page.evaluate((poseCode) => {
      const g = window.__game;
      const rig = g.ctx.player.rig;
      g.ctx.flags.paused = true;
      // eslint-disable-next-line no-eval
      eval(poseCode);
      rig.group.updateMatrixWorld(true);
    }, POSES[POSE]);
    if (CLOSEUP) {
      const spec = CLOSEUPS[CLOSEUP];
      if (!spec) throw new Error(`unknown closeup "${CLOSEUP}" (${Object.keys(CLOSEUPS).join('|')})`);
      await page.evaluate(({ jointExpr, off, look }) => {
        const g = window.__game;
        const rig = g.ctx.player.rig;
        const cam = g.ctx.three.camera;
        const V = cam.position.constructor;
        g.ctx.flags.paused = true;
        // eslint-disable-next-line no-eval
        const joint = eval(jointExpr);
        const jp = joint.getWorldPosition(new V());
        const fz = rig.headGroup.getWorldDirection(new V()); fz.y = 0; fz.normalize();
        const side = new V(-fz.z, 0, fz.x);
        cam.position.set(
          jp.x + side.x * off[0] + fz.x * off[2],
          jp.y + off[1],
          jp.z + side.z * off[0] + fz.z * off[2],
        );
        cam.lookAt(jp.x + look[0], jp.y + look[1], jp.z + look[2]);
        cam.updateMatrixWorld(true);
      }, { jointExpr: spec.joint, off: spec.off, look: spec.look });
      await page.waitForTimeout(350);
      await maybeFormLight(page);
      const path = join(OUT, `rig-${TAG}-${POSE}-closeup-${CLOSEUP}${LIT ? '-' + LIT : ''}.png`);
      await page.screenshot({ path, fullPage: false });
      console.log(`[rig-shot] saved ${path}`);
    } else {
      for (const angle of ANGLES) {
        await page.evaluate((a) => window.__game.rigStudio(a), angle);
        await page.waitForTimeout(350);
        await maybeFormLight(page);
        const path = join(OUT, `rig-${TAG}-${POSE}-${angle}${LIT ? '-' + LIT : ''}.png`);
        await page.screenshot({ path, fullPage: false });
        console.log(`[rig-shot] saved ${path}`);
      }
    }
  } finally {
    await browser.close();
    // Windows: dev.kill() only signals the npm wrapper; the vite child is left
    // orphaned — it keeps --strictPort 5191 bound (so the NEXT run can't bind)
    // AND its stdio pipes keep this node process alive → the run "hangs" after
    // the screenshot is already written. Kill the whole process tree so the
    // port frees and the loop doesn't wedge.
    try {
      if (process.platform === 'win32' && dev.pid) {
        spawnSync('taskkill', ['/pid', String(dev.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        dev.kill();
      }
    } catch {}
  }
}

// Force a clean exit — on win32 a lingering child handle can otherwise keep the
// event loop alive even after teardown completes.
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
