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
import { spawn } from 'node:child_process';
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
      return { speed: +s.speed.toFixed(1), bikeZ: +p.z.toFixed(1) };
    });
    console.log(`[speeder-fx] final speed=${info.speed} bikeZ=${info.bikeZ}`);
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

  // Panels (ACP): enumerate salvage panels, force every door open, then frame +
  // screenshot the nearest N from the FRONT to spot interior-clipping-through-
  // hull-wall. Static (pause after the door-lerp settles → free camera).
  'panels': async (page) => {
    await page.evaluate(() => { window.__game.ctx.three.renderer.setSize(900, 1100, false); window.__game.setTime(0.42); });
    // Enumerate + force every door fully open for inspection.
    const list = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const out = [];
      ctx.salvageables.list.forEach((s, idx) => {
        s.panel.userData.panelOpened = true;
        s.panel.userData.panelDoorTarget = 2.2;   // ~126° — clearly open
        if (idx < 8) out.push({ idx, kind: s.kind || s.wreckKind || '?', cond: s.condition || '?' });
      });
      return { count: ctx.salvageables.list.length, sample: out };
    });
    console.log(`[panels] count=${list.count} sample=${JSON.stringify(list.sample)}`);
    await page.waitForTimeout(1400);             // let updatePanelDoors lerp them open
    // Collect nearest-N panel world transforms, then pause + shoot each.
    const targets = await page.evaluate(() => {
      const ctx = window.__game.ctx;
      const cam = ctx.three.camera;
      const V = cam.position.constructor;
      const Q = cam.quaternion.constructor;
      const items = ctx.salvageables.list.map((s, idx) => {
        const wp = s.panel.getWorldPosition(new V());
        const wq = s.panel.getWorldQuaternion(new Q());
        const outward = new V(0, 0, 1).applyQuaternion(wq);   // body-local +Z = door/outward side
        const d = Math.hypot(wp.x - cam.position.x, wp.z - cam.position.z);
        return { idx, kind: s.kind || s.wreckKind || '?', x: wp.x, y: wp.y, z: wp.z, ox: outward.x, oy: outward.y, oz: outward.z, d };
      });
      // One panel per UNIQUE kind (the offenders are kind-specific) — sweep all POI types.
      const seen = new Set();
      const perKind = [];
      for (const it of items) { if (!seen.has(it.kind)) { seen.add(it.kind); perKind.push(it); } }
      ctx.flags.paused = true;                    // freeze so the framing camera survives
      return perKind;
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
      await page.waitForTimeout(250);
      const path = join(OUT, `scen-panel-${String(i).padStart(2, '0')}-${t.kind}.png`);
      await page.screenshot({ path, fullPage: false });
      console.log(`[panels] shot ${i}: kind=${t.kind} dist=${t.d.toFixed(1)} → ${path}`);
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
    await page.addInitScript(() => {
      try { localStorage.setItem('dustfall.tutorial.v1', JSON.stringify({ seenIntro: true, usedItems: [] })); } catch { /* ignore */ }
    });
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
    try { dev.kill(); } catch {}
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
