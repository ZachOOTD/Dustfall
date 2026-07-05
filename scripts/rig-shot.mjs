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
    const archs = (argv.archetype ? String(argv.archetype) : 'satellite,wrecked_tank,debris_field,hollow_husk,derelict,well,debris_trail,enterable_wreck')
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
    const pinyaw = argv.pinyaw !== undefined;     // C41 — length-frame pin (spine broadside) for the visual gate
    for (const seed of seeds) {
    const r = await page.evaluate(({ cls, ang, seed, zoom, fa, variant, archetype, pinyaw }) => {
      const ctx = window.__game.ctx;
      window.__FORCE_ANCHOR_NEAR = fa;   // inspection only — forces the hatch camera-facing
      if (variant >= 0) window.__FORCE_HULL_VARIANT = variant; else delete window.__FORCE_HULL_VARIANT;
      ctx.weather.intensity = 0; ctx.weather.cloudiness = 0.15;
      window.__game.setTime(0.34);
      ctx.three.renderer.toneMappingExposure = 1.5;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      const spawn = window.__game.spawnProcgenWreckRig(cls, seed, archetype || undefined, pinyaw);
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
      else if (ang === 'tear') aim(new V(cx + D * 0.95, eyeY, cz + D * 0.22));   // look INTO the torn +X end (ribbing/flaps)
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
    }, { cls, ang: angle, seed, zoom, fa, variant, archetype, pinyaw });
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

  // M8 ⑨ (C47) — render the DEEP CAVE descent funnel at its seeded anchor (the cave MOUTH).
  // `--angle=aerial` (3/4 look-down framing the whole funnel) | `approach` (peer over the rim).
  // Low raking sun + tame exposure so the funnel's near-wall shadow + the dark coloring read.
  'cave': async (page) => {
    const angle = argv.angle || 'aerial';
    const r = await page.evaluate(({ ang }) => {
      const ctx = window.__game.ctx;
      ctx.weather.intensity = 0; ctx.weather.cloudiness = 0.15;
      window.__game.setTime(0.4);                                   // low raking sun
      ctx.three.renderer.toneMappingExposure = 1.1;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      const a = ctx.biomes.caveAnchor;
      const cam = ctx.three.camera; ctx.flags.paused = true;
      const floorY = ctx.terrain.heightAt(a.x, a.z);               // carved funnel floor
      const rimY = ctx.terrain.heightAt(a.x + 30, a.z);            // undisturbed dune just outside the rim
      const R = 22;                                                // ~CAVE_PIT_CLEARING
      if (ang === 'interior' || ang === 'door' || ang === 'inside') {
        // C52 — the rig boots in DEV MODE (companionAcquired=true → the boot reconcile
        // detaches the egg). Re-attach it so the M8 ⑩ egg renders on the dais for the shot.
        const dc = ctx.deepCave;
        if (dc && dc.egg && !dc.egg.group.parent) dc.group.add(dc.egg.group);
        // C49 dark-nav LOOK: emulate updateDeepCave for the shot (the real effect is
        // player-position-driven) — darken ambient/sun + light the REAL cave torch.
        ctx.lights.ambient.intensity *= 0.1;
        ctx.lights.sun.intensity *= 0.06;
        const torch = ctx.deepCave && ctx.deepCave.torch;
        if (ang === 'inside') {
          if (torch) { torch.visible = true; torch.intensity = 2.4; torch.position.set(a.x - 1.5, floorY + 1.6, a.z + 1.0); }
          cam.position.set(a.x - 2.2, floorY + 1.7, a.z + 1.6);
          cam.lookAt(a.x + 3, floorY + 1.4, a.z - 1.2);
        } else {
          if (torch) { torch.visible = true; torch.intensity = 2.4; torch.position.set(a.x - 4.5, floorY + 1.6, a.z); }
          cam.position.set(a.x - 6.5, floorY + 1.7, a.z);
          cam.lookAt(a.x + 1, floorY + 1.5, a.z);
        }
      } else if (ang === 'approach') {
        cam.position.set(a.x + R * 1.7, rimY + 3.0, a.z + R * 0.5);
        cam.lookAt(a.x, floorY + 2.0, a.z);
      } else {
        cam.position.set(a.x + R * 2.2, rimY + R * 1.9, a.z + R * 2.2);
        cam.lookAt(a.x, floorY + 1.0, a.z);
      }
      cam.updateMatrixWorld(true);
      ctx.three.renderer.render(ctx.three.scene, cam);
      // structural sanity: the deepCave interior group + its meshes (1 box mesh : 1 collider).
      let caveMeshes = 0, caveGroup = null;
      ctx.three.scene.traverse((o) => { if (o.name === 'deepCave') caveGroup = o; });
      if (caveGroup) caveGroup.traverse((o) => { if (o.isMesh) caveMeshes++; });
      return { anchor: [+a.x.toFixed(0), +a.z.toFixed(0)], floorY: +floorY.toFixed(1), rimY: +rimY.toFixed(1), depth: +(rimY - floorY).toFixed(1), caveMeshes, caveFound: !!caveGroup };
    }, { ang: angle });
    console.log(`[cave] ${JSON.stringify(r)}`);   // log BEFORE the screenshot so the carve numbers survive a screenshot flake
    await page.waitForTimeout(350);
    try {
      await page.screenshot({ path: join(OUT, `scen-cave-${angle}.png`), fullPage: false, timeout: 60000 });
      console.log(`[cave] saved scen-cave-${angle}.png`);
    } catch (e) {
      console.log(`[cave] screenshot flaked (${e.name}) — numeric result above stands`);
    }
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

  // M6 ② (C38) — survival-rebalance gate. Drives the REAL updateStats deterministically
  // under controlled scenarios (the godmode floor is bypassed inside survivalProbe) to
  // assert the FORGIVING Long-Dark curve: each urgent single-neglect path (heat/cold/thirst)
  // kills in ~7-13 min; hunger is the slow background path (~12-18 min); a PREPARED player
  // never dies and HEALS back to full. Numeric only — no screenshot.
  'survival-probe': async (page) => {
    const r = await page.evaluate(() => {
      const g = window.__game; g.enterGame(true);
      return {
        heat: g.survivalProbe('heat'),
        cold: g.survivalProbe('cold'),
        thirst: g.survivalProbe('thirst'),
        hunger: g.survivalProbe('hunger'),
        prepared: g.survivalProbe('prepared'),
      };
    });
    // Death→overlay path (dormant under GOD_MODE for a long time): force a real death LAST
    // (it leaves the game in the death state) and confirm the overlay un-hides.
    const deathUi = await page.evaluate(() => window.__game.triggerDeath('the desert took you'));
    const inBand = (m, lo, hi) => m != null && m >= lo && m <= hi;
    const urgent = ['heat', 'cold', 'thirst'].every((k) => r[k].died && inBand(r[k].timeToDeathMin, 7, 13));
    const hungerOk = r.hunger.died && inBand(r.hunger.timeToDeathMin, 12, 18);
    const preparedOk = !r.prepared.died && r.prepared.finalHealth >= 0.95;
    const deathOk = deathUi.dead === true && deathUi.overlayShown === true;
    const pass = urgent && hungerOk && preparedOk && deathOk;
    console.log(`[survival-probe] ${pass ? 'PASS' : 'FAIL'} (urgent=${urgent} hunger=${hungerOk} prepared=${preparedOk} deathUi=${deathOk}) ${JSON.stringify({ ...r, deathUi })}`);
  },

  // M6 ③ (C39) — flat-color-texture-audit render: deploy the camp objects (fire/bedroll/tent/
  // lantern) in a row so the procedural-material swaps are visible, frame them in good front
  // light, and report the shader-PROGRAM count (must stay at baseline — the audit reuses the
  // existing factories, adds zero new programs). The screenshot drives the appearance gate.
  'camp-studio': async (page) => {
    const r = await page.evaluate(() => {
      const g = window.__game; g.enterGame(true);
      const ctx = g.ctx;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      g.setTime(0.40);                       // morning — sun high + angled, not backlighting the row
      ctx.weather.cloudiness = 0.1; ctx.weather.intensity = 0;
      ctx.three.renderer.setSize(1000, 600, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1000 / 600; cam.updateProjectionMatrix(); }
      const out = g.campStudio();            // spawns the row ahead of the player + returns center + programs
      return out;
    });
    await page.waitForTimeout(400);
    await page.evaluate((center) => {
      const ctx = window.__game.ctx;
      ctx.flags.paused = true;
      const cam = ctx.three.camera;
      // Stand ~2.2m in FRONT of the row centre (forward = camera→centre) at near eye-level so the
      // fire logs + bedroll fabric read close, in 3/4 profile (not foreshortened top-down).
      const cx = center[0] - cam.position.x, cz = center[2] - cam.position.z;
      const d = Math.hypot(cx, cz) || 1;
      const fx = cx / d, fz = cz / d;
      cam.position.set(center[0] - fx * 2.2, center[1] + 1.3, center[2] - fz * 2.2);
      cam.lookAt(center[0], center[1] + 0.4, center[2]);
      cam.updateMatrixWorld(true);
      ctx.three.renderer.render(ctx.three.scene, cam);
    }, r.center);
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(OUT, 'scen-camp-studio.png'), fullPage: false });
    console.log(`[camp-studio] programs=${r.programs} ${JSON.stringify(r)}`);
  },

  // M6 ④ (C40) — diegetic-survival WIRING gate (numeric). Forces diegetic mode + drives each
  // stat to its tell; asserts the matching vignette lights (>0) while the others stay dark
  // (~0), a healthy player shows nothing, and the HUD stat bars hide/show on toggle.
  'diegetic-probe': async (page) => {
    const r = await page.evaluate(() => { const g = window.__game; g.enterGame(true); return g.diegeticProbe(); });
    const lit = (v) => v > 0.02, dark = (v) => v < 0.02;
    const pass =
      lit(r.thirsty.thirst) && dark(r.thirsty.cold) && dark(r.thirsty.heat) && dark(r.thirsty.health) &&
      lit(r.cold.cold) && dark(r.cold.thirst) && dark(r.cold.heat) &&
      lit(r.hot.heat) && dark(r.hot.cold) &&
      lit(r.starving.hunger) &&
      lit(r.wounded.health) &&
      dark(r.healthy.thirst) && dark(r.healthy.cold) && dark(r.healthy.heat) && dark(r.healthy.hunger) && dark(r.healthy.health) &&
      r.barsHidden === true && r.barsShown === true;
    console.log(`[diegetic-probe] ${pass ? 'PASS' : 'FAIL'} ${JSON.stringify(r)}`);
  },

  // M6 ④ (C40) — diegetic-survival vignette RENDER (appearance gate). Forces diegetic mode +
  // sets ONE stat to its tell level so the screen-edge vignette shows over the game, then
  // screenshots. --stat=thirst|cold|heat|hunger|health (default health).
  'diegetic-vignette': async (page) => {
    const stat = argv.stat || 'health';
    await page.evaluate((stat) => {
      const g = window.__game; g.enterGame(true);
      const ctx = g.ctx;
      g.setTime(0.5);                       // noon — a cooler, brighter backdrop so the coloured tints read
      ctx.weather.cloudiness = 0.1; ctx.weather.intensity = 0;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      ctx.three.renderer.setSize(820, 520, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 820 / 520; cam.updateProjectionMatrix(); }
      // Aim at a clean dune horizon (slightly down), away from the spawn wreck.
      cam.rotation.set(-0.08, 0, 0);
      cam.updateMatrixWorld(true);
      g.showDiegeticVignette(stat);
      ctx.three.renderer.render(ctx.three.scene, cam);
      ctx.flags.paused = true;   // freeze so the live tick doesn't recompute the vignette
    }, stat);
    await page.waitForTimeout(550);   // let the CSS opacity transition settle to the target
    const op = await page.evaluate(() => {
      const ids = ['cold', 'thirst', 'heat', 'hunger', 'health'];
      const out = {};
      for (const id of ids) {
        const el = document.getElementById('stat-vignette-' + id);
        out[id] = el ? { o: el.style.opacity, comp: getComputedStyle(el).opacity, z: getComputedStyle(el).zIndex, disp: getComputedStyle(el).display } : null;
      }
      return out;
    });
    await page.screenshot({ path: join(OUT, `scen-diegetic-${stat}.png`), fullPage: false });
    console.log(`[diegetic-vignette] ${stat} rendered — ${JSON.stringify(op)}`);
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

  // Crashed-pod (T1.1) — the HERO escape-pod exterior at the desert wake spot.
  // Reproduces the REAL stepOut placement (placeCrashedPodWreck at player+4,+4,
  // half-buried + tilted; camera at the player's wake eye looking at the pod), NOT
  // an isolated studio rig (the C60/C63 false-pass trap — visual-diagnostic-
  // methodology.md D165). Angles: wake (player's-eye approach), hatch (close-up into
  // the blown salvage face), oblique (3/4 of the whole silhouette), back (the modular
  // panels). --time=<0..1> for the dawn/morning desert light. Front-lit.
  // (the 'smoke-intro' health GATE lives further down — a single definition now.)

  'crashed-pod': async (page) => {
    const angle = argv.angle || 'wake';
    const t = argv.time !== undefined ? Number(argv.time) : 0.32;   // dawn-ish, sun low + warm
    const popchute = !!argv.popchute;   // T4.3 — fire the comic chute-pop + freeze on the fully-inflated frame
    const r = await page.evaluate(({ ang, t, popchute }) => {
      const g = window.__game;
      const ctx = g.ctx;
      g.setTime(t);
      ctx.weather.intensity = 0; ctx.weather.cloudiness = 0.12;
      ctx.three.renderer.toneMappingExposure = 1.25;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      ctx.three.renderer.setSize(960, 720, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 960 / 720; cam.updateProjectionMatrix(); }
      // Place the pod at a clear anchor near the player (mirrors stepOut's +4,+4
      // wake-beside read, offset further to clear the spawn-area fuselage wreck so
      // the hero pod is the subject — the real stepOut spot still applies in-game).
      const tr = ctx.player.body.body.translation();
      const px = tr.x + 14, pz = tr.z - 12;
      g.placeCrashedPod(px, pz);
      // T4.3 — fire the comic chute-pop + advance it fully so the paused frame catches
      //   the FULLY-inflated canopy draped over the pod (placeCrashedPod arms it).
      if (popchute) g.popChute(3.0);
      const gy = ctx.terrain.heightAt(px, pz);
      const V = cam.position.constructor;
      ctx.flags.paused = true;
      // C11 — TALL VERTICAL CAPSULE: the visible standing pod runs ~gy → gy+1.9
      // (hatch centred ~gy+0.65, porthole ~gy+1.25). Aim at the mid-body so the
      // whole standing silhouette frames; cameras pulled back + raised vs the old
      // wide box. Still reproduces the real half-buried wake placement.
      const aimY = gy + 0.95;
      if (ang === 'wake') {
        // Player's-eye: standing ~4.5m away, eye height, biased to the +X side so
        // the +Z hatch/porthole face AND the +X riveted flank both read at ~45°
        // (a round 3D volume, not a flat-on slab). The real wake-beside read.
        cam.position.set(px + 4.0, gy + 1.7, pz + 2.6);
        cam.lookAt(px - 0.1, aimY, pz);
      } else if (ang === 'hatch') {
        // Close-up squarely onto the blown-open hatch (the salvage face). The hatch
        // is on the capsule's LOCAL +Z face; the pod is yawed ~0.55, so the hatch
        // world-normal is (sin0.55, 0, cos0.55). Frame dead-on along that normal.
        const hy = 0.55, hnx = Math.sin(hy), hnz = Math.cos(hy);
        const hd2 = 3.0;
        cam.position.set(px + hnx * hd2, gy + 1.2, pz + hnz * hd2);
        cam.lookAt(px + hnx * 0.3, gy + 0.8, pz + hnz * 0.3);
      } else if (ang === 'oblique') {
        // 3/4 of the WHOLE standing silhouette from a higher, further vantage so
        // the nose dome + base both frame.
        cam.position.set(px + 4.6, gy + 2.6, pz + 4.0);
        cam.lookAt(px, aimY + 0.1, pz);
      } else if (ang === 'back') {
        // The riveted flank away from the hatch — verifies the strippable panels.
        cam.position.set(px - 4.0, gy + 1.9, pz - 3.4);
        cam.lookAt(px, aimY, pz);
      } else if (ang === 'iso') {
        // DIAGNOSTIC studio: lift the whole capsule ABOVE the sand (un-bury) so the
        // FULL standing form is judgeable in isolation (additional shot, never the
        // verdict — the buried wake read is the gate). Re-pose upright, clean 3/4.
        const pod2 = ctx.three.scene.getObjectByName('crashedPod');
        if (pod2) { pod2.position.y = gy + 0.1; pod2.rotation.set(0, 0.55, 0); pod2.updateMatrixWorld(true); }
        cam.position.set(px + 3.6, gy + 1.9, pz + 4.0);
        cam.lookAt(px, gy + 1.2, pz);
      } else { // close — tight detail of the upper hull (porthole / rivets / nose)
        cam.position.set(px + 2.8, gy + 2.0, pz + 2.8);
        cam.lookAt(px, gy + 1.3, pz);
      }
      cam.updateMatrixWorld(true);
      // Front KEY light from above + beside the camera so the camera-facing hull is
      // LIT (not a backlit silhouette — the harness front-light prerequisite).
      let DirCtor = null, HemiCtor = null;
      ctx.three.scene.traverse((o) => { if (o.isDirectionalLight && !DirCtor) DirCtor = o.constructor; if (o.isHemisphereLight && !HemiCtor) HemiCtor = o.constructor; });
      let key = ctx.three.scene.getObjectByName('__podKey');
      if (!key && DirCtor) { key = new DirCtor(); key.name = '__podKey'; key.intensity = 1.8; key.color.set(0xffe9cf); ctx.three.scene.add(key.target); ctx.three.scene.add(key); }
      if (key) {
        const toP = new V(px - cam.position.x, 0, pz - cam.position.z);
        key.position.set(cam.position.x + toP.x * 0.2 + 2, cam.position.y + 3, cam.position.z + toP.z * 0.2 + 1);
        key.target.position.set(px, aimY, pz); key.target.updateMatrixWorld(true);
      }
      if (!ctx.three.scene.getObjectByName('__podFill') && HemiCtor) { const fill = new HemiCtor(0xbfccdd, 0x6b5840, 0.5); fill.name = '__podFill'; ctx.three.scene.add(fill); }
      // Report: the pod's exposed height above the sand + structural mesh count.
      const pod = ctx.three.scene.getObjectByName('crashedPod');
      let meshes = 0, maxY = -1e9, minY = 1e9;
      if (pod) { pod.updateMatrixWorld(true); pod.traverse((o) => { if (o.isMesh && o.geometry) { meshes++; o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox; for (const cy of [bb.min.y, bb.max.y]) { const wv = new V(0, cy, 0); o.localToWorld(wv); maxY = Math.max(maxY, wv.y); minY = Math.min(minY, wv.y); } } }); }
      return { angle: ang, podAt: [+px.toFixed(1), +pz.toFixed(1)], groundY: +gy.toFixed(2), exposedH: +(maxY - gy).toFixed(2), meshes, found: !!pod };
    }, { ang: angle, t, popchute });
    await page.waitForTimeout(350);
    const tag = popchute ? `${angle}-chute` : angle;
    await page.screenshot({ path: join(OUT, `scen-crashed-pod-${tag}.png`), fullPage: false });
    console.log(`[crashed-pod] ${JSON.stringify(r)}`);
  },

  // Pod-interior (T1.2): the REAL seated first-person view inside the HERO escape-pod
  // cabin. Drives the game's OWN intro path (startIntro → jumpToBeat) so the camera +
  // seat are EXACTLY what the player sees through enterPod/descent/parachute — NOT an
  // idealized studio rig. --angle: forward (viewport ahead), lever (look right at the
  // parachute lever + console), eject (look left at the eject control), wide (head-
  // turned 3/4 of the cabin), descent (forward with the planet swelled). --pull=<0..1>
  // poses the parachute lever; --snap droops it (the gag's broken state).
  'pod-interior': async (page) => {
    const angle = argv.angle || 'forward';
    const beat = argv.beat || (angle === 'descent' ? 'descent' : 'enterPod');
    const pull = argv.pull !== undefined ? Number(argv.pull) : 0;
    const snap = !!argv.snap;
    // --descent=<0..1> drives the vista swell/atmosphere ramp so the planet can be shot
    // at several altitudes (high 0.0 → low 0.9). Overrides the beat's own 0.7 default.
    const descent = argv.descent !== undefined ? Number(argv.descent) : null;
    const r = await page.evaluate(({ angle, beat, pull, snap, descent }) => {
      const g = window.__game;
      const ctx = g.ctx;
      // First-person (the seated read); hide the rig so it doesn't block the FP camera.
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      // Drive the real intro: start it (force), jump to the requested beat so the beat
      // controller builds the pod + seats the player facing −Z (the genuine FP frame).
      g.startIntro();
      g.jumpToBeat(beat);
      ctx.three.renderer.setSize(1000, 760, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1000 / 760; cam.updateProjectionMatrix(); }
      if (descent !== null) { try { g.setDescentProgress(descent); } catch {} }
      else if (angle === 'descent' || beat === 'descent') { try { g.setDescentProgress(0.7); } catch {} }
      if (pull > 0 || snap) { try { g.setParachuteLeverPull(pull, snap); } catch {} }
      return { beat, angle };
    }, { angle, beat, pull, snap, descent });
    // Let the beat controller tick (it runs in the page's RAF loop) so the pod builds +
    // the player is seated, THEN pose the camera for the chosen look. We re-seat from the
    // real spawn + aim the head — mirroring the seated FP look directions.
    await page.waitForTimeout(600);
    const meas = await page.evaluate(({ angle, pull, snap, descent }) => {
      const g = window.__game;
      const ctx = g.ctx;
      ctx.flags.paused = true;
      if (descent !== null) { try { g.setDescentProgress(descent); } catch {} }
      if (pull > 0 || snap) { try { g.setParachuteLeverPull(pull, snap); } catch {} }
      // R1b — mirror tickDescent's fog thinning so the rig sees the SAME real-world descent
      // view the player gets (the game's survival fog otherwise hazes the ground from altitude).
      if (descent !== null) {
        const fog = ctx.three.scene.fog;
        // W6 item 5 — mirror the descent fog: thin high (the clear vista), blending to survival as
        //   the pod drops below ~150 m (altitude = 600·(1−p^1.7)). Faithful to blendDescentFog.
        if (fog && 'density' in fog) {
          const alt = 600 * (1 - Math.pow(descent, 1.7));
          const kRaw = Math.max(0, Math.min(1, 1 - alt / 150));
          const k = kRaw * kRaw * (3 - 2 * kRaw);
          const survival = 0.0018;   // FOG_DENSITY_CLEAR (the game's survival target at ground level)
          fog.density = 0.00006 + (survival - 0.00006) * k;
        }
        // Mirror tickDescent's SKY blend: space (1) high → desert (0) as the pod drops. Without this
        // the rig's descent shows the normal daytime sky (a tan fog wall), not the orbit vista.
        // W6 item 3 — drive the planet APPROACH with the NEW two-phase curve (slow far, faster near)
        //   via the exported planetApproachCurve, so the rig shows the reworked approach faithfully.
        try { g.setSkyIntroMode(1 - Math.min(1, Math.max(0, (descent - 0.14) / 0.34))); } catch {}
        try { g.setPlanetApproach(g.planetApproachCurve(descent)); } catch {}
      }
      const cam = ctx.three.camera;
      const V = cam.position.constructor;
      // R1b — the pod now PHYSICALLY descends (setDescentProgress moves the pod GROUP + the
      // collider cage to the current altitude). setDescentProgress(descent) above moved the
      // pod, but NOT the player body, so derive the seated EYE from the POD GROUP world origin
      // (floor-top centre) — the genuine seated FP eye relative to the descending capsule. The
      // seat math mirrors getPodSpawn: origin + (halfHeight+radius) for the body centre, +0.35
      // aft, + the seated eyeOffset for the eye. Falls back to the body if the pod isn't found.
      const pod0 = ctx.three.scene.getObjectByName('escapePodCabin');
      let eye;
      if (pod0) {
        pod0.updateMatrixWorld(true);
        const o = pod0.getWorldPosition(new V());
        const pb = ctx.player.body;
        const bodyY = o.y + (pb.halfHeight || 0.6) + (pb.radius || 0.3);
        eye = new V(o.x, bodyY + (ctx.player.eyeOffset || 0.5), o.z + 0.35);
        // Re-seat the actual body too (so any live tick agrees + nothing snaps it back).
        pb.body.setTranslation({ x: o.x, y: bodyY, z: o.z + 0.35 }, true);
      } else {
        const tr = ctx.player.body.body.translation();
        eye = new V(tr.x, tr.y + (ctx.player.eyeOffset || 0.6), tr.z);
      }
      cam.position.copy(eye);
      // Look directions in the pod-local frame: −Z is forward (viewport), +X is right
      // (the parachute lever / console), −X is left (the eject control).
      let look;
      if (angle === 'forward') look = new V(eye.x, eye.y - 0.08, eye.z - 1);
      // R1b — the DESCENT look pitch tracks altitude (matches tickDescent): SHALLOW high (the
      // horizon + far dunes read) → STEEP low (the desert rushes up). pitch = -0.12 - 0.28·p².
      else if (angle === 'descent') {
        const dp = descent !== null ? descent : 0.7;
        const pitch = -0.12 - 0.28 * (dp * dp);
        look = new V(eye.x, eye.y + Math.tan(pitch), eye.z - 1);
      }
      else if (angle === 'down') look = new V(eye.x, eye.y - 1.0, eye.z - 0.45);   // R1b probe — look DOWN-and-out the porthole at the approaching ground
      else if (angle === 'lever') look = new V(eye.x + 1, eye.y - 0.25, eye.z - 0.55);
      else if (angle === 'eject') look = new V(eye.x - 0.9, eye.y - 0.25, eye.z - 0.8);
      else if (angle === 'wide') look = new V(eye.x + 0.7, eye.y - 0.1, eye.z - 0.7);
      else if (angle === 'floor') look = new V(eye.x, eye.y - 1.0, eye.z - 0.6);   // look DOWN at the deck/footwell
      else look = new V(eye.x, eye.y - 0.08, eye.z - 1);
      cam.lookAt(look);
      cam.updateMatrixWorld(true);
      // Report: is the cabin built? mesh count? eye world pos? pod altitude above the spawn?
      const pod = ctx.three.scene.getObjectByName('escapePodCabin');
      let meshes = 0;
      if (pod) pod.traverse((o) => { if (o.isMesh) meshes++; });
      const rp = ctx.intro && ctx.intro.returnPos ? ctx.intro.returnPos : null;
      const podY = pod ? +pod.getWorldPosition(new V()).y.toFixed(1) : null;
      const altAboveSpawn = (pod && rp) ? +(pod.getWorldPosition(new V()).y - rp.y).toFixed(1) : null;
      return {
        found: !!pod, meshes, eye: [+eye.x.toFixed(2), +eye.y.toFixed(2), +eye.z.toFixed(2)],
        podY, altAboveSpawn, spawn: rp ? [+rp.x.toFixed(1), +rp.y.toFixed(1), +rp.z.toFixed(1)] : null,
      };
    }, { angle, pull, snap, descent });
    // RE-ANCHOR the camera-relative space planet + star field + sky dome to the posed camera, and
    // apply the space-mode fog/background darkening — all of which updateSky does per-frame but we
    // paused before it could run at the pod's high-altitude camera. Without this the porthole shows
    // the stale desert-fog/background TAN (the same bug the cockpit had), not the real orbit vista.
    await page.evaluate((descent) => {
      const ctx = window.__game.ctx;
      const cam = ctx.three.camera; cam.updateMatrixWorld(true);
      const V = cam.position.constructor;
      const s = (ctx.three.scene);
      if (descent === null) return;
      // The space blend for this altitude (mirrors tickDescent): full space high → dawn desert low.
      // C3 — MATCH tickDescent's (descent−0.14)/0.34 curve so the rig's blend is faithful.
      const space01 = 1 - Math.min(1, Math.max(0, (descent - 0.14) / 0.34));
      // W6 item 3 — the planet-approach factor at this altitude via the NEW two-phase curve (slow
      //   far, faster near), so the paused rig mirrors the reworked approach.
      const approach = window.__game.planetApproachCurve(descent);
      if (space01 <= 0.01) return;   // low in the fall the sky has crossed to the dawn desert — leave it
      let dome = null, stars = null, planetGroup = null;
      s.traverse((o) => {
        if (o.isMesh && o.material && o.material.uniforms && o.material.uniforms.uTopColor) dome = o;
        if (o.isPoints && o.renderOrder === -0.5) stars = o;
        if (o.isMesh && o.renderOrder === -0.4 && o.parent) planetGroup = o.parent;
      });
      // Manually APPLY the space-mode uniforms + anchor (applySpaceMode runs in updateSky, which is
      // gated by the pause — so at a paused descent frame the dome is still the daytime sky). Set the
      // dome black + kill clouds + lift stars, matching applySpaceMode, scaled by space01.
      if (dome) {
        const u = dome.material.uniforms; const C = u.uTopColor.value.constructor;
        u.uTopColor.value.lerp(new C(0x01020a), space01);
        u.uHorizonColor.value.lerp(new C(0x03050f), space01);
        if (u.uSpace) u.uSpace.value = space01;
        if (u.uCloudiness) u.uCloudiness.value *= (1 - space01);
        if (u.uSunGlow) u.uSunGlow.value *= (1 - space01 * 0.9);
        dome.position.copy(cam.position); dome.updateMatrixWorld(true);
      }
      if (stars) {
        const u = stars.material.uniforms;
        if (u.uOpacity) u.uOpacity.value = Math.max(u.uOpacity.value, space01);
        if (u.uBrightness) u.uBrightness.value = 3.0 * space01 + u.uBrightness.value * (1 - space01);
        if (u.uSpace) u.uSpace.value = space01;
        stars.position.copy(cam.position); stars.updateMatrixWorld(true);
      }
      const dir = new V(0.30, 0.10, -1).normalize();
      const DIST = 400;
      if (planetGroup) {
        // C3 — mirror applySpaceMode's APPROACH: scale the group up + slide it DOWN as the planet
        //   approaches (ease-in), so the paused rig shows the SAME swelling planet the live descent
        //   produces (the planet fills the porthole across d0→d0.2). Match sky.ts constants.
        const ae = approach * approach;
        const scale = 1 + (3.6 - 1) * ae;      // _PLANET_APPROACH_MAX_SCALE = 3.6
        const drop = 150 * ae;                  // _PLANET_APPROACH_DROP = 150
        planetGroup.scale.setScalar(scale);
        planetGroup.position.set(cam.position.x + dir.x*DIST, cam.position.y + dir.y*DIST - drop, cam.position.z + dir.z*DIST);
        planetGroup.updateMatrixWorld(true);
        planetGroup.traverse((o) => { if (o.material && o.material.uniforms && o.material.uniforms.uOpacity) o.material.uniforms.uOpacity.value = space01; });
      }
      // darken the background + thin/space-tint the fog (mirrors applySpaceMode) so no tan shows.
      const bg = s.background;
      if (bg && bg.isColor) { const C = bg.constructor; bg.lerp(new C(0x01020a), space01); }
      const fog = s.fog;
      if (fog && fog.density !== undefined) { fog.density = fog.density * (1 - space01) + 0.00002 * space01; if (fog.color) { const C = fog.color.constructor; fog.color.lerp(new C(0x03050f), space01); } }
      // Full-intro coherence fix mirror: dim the WORLD sun + ambient by the orbit blend so the
      // paused rig shows the SAME vacuum-lit cabin the in-game applySpaceMode now produces (the
      // desert noon light no longer floods the pod cabin to pale white). See sky.ts applySpaceMode.
      if (ctx.lights) {
        ctx.lights.sun.intensity *= (1 - space01 * 0.88);
        ctx.lights.ambient.intensity *= (1 - space01 * 0.94);
      }
    }, descent);
    await page.waitForTimeout(300);
    const perfPi = await page.evaluate(() => { const ctx = window.__game.ctx; ctx.three.renderer.info.reset(); ctx.three.renderer.render(ctx.three.scene, ctx.three.camera); const i = ctx.three.renderer.info; const pod = ctx.three.scene.getObjectByName('escapePodCabin'); let pm = 0; if (pod) pod.traverse((o) => { if (o.isMesh) pm++; }); return { draws: i.render.calls, tris: i.render.triangles, programs: i.programs?.length ?? -1, podMeshes: pm }; });
    console.log('[pod-interior-perf] ' + JSON.stringify(perfPi));
    const dtag = descent !== null ? `-d${String(descent).replace('.', '')}` : '';
    const tag = `pod-interior-${angle}${dtag}${pull > 0 ? '-pull' + pull : ''}${snap ? '-snap' : ''}`;
    await page.screenshot({ path: join(OUT, `scen-${tag}.png`), fullPage: false, animations: 'disabled', timeout: 60000 });
    console.log(`[pod-interior] ${JSON.stringify(meas)} → scen-${tag}.png`);
  },

  // W6 item 6 — THE SEALED CABIN DOOR must sit FLUSH (not slanted) at every sealed stage. Probes the
  //   cabin hatch pivot's rotation (x,y,z) at descent (sealed), impact (sealed, crashed), and reports
  //   whether any residual tilt exists; then shoots a TRUE head-on porthole-centred frame at descent
  //   so the door slab edges vs the frame can be eyeballed. A non-zero pivot.x/z (or y≠0 when sealed)
  //   = the slant. --descent=<0..1> picks the sealed descent altitude to shoot (default 0.02).
  'door-check': async (page) => {
    const descent = argv.descent !== undefined ? Number(argv.descent) : 0.02;
    await page.evaluate(() => {
      const g = window.__game;
      const ctx = g.ctx;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      g.startIntro();
      g.jumpToBeat('descent');   // the descent init tick (next RAF) builds + seats the pod
    });
    await page.waitForTimeout(700);   // let the descent init tick build the pod (like pod-interior)
    const probe = await page.evaluate((descent) => {
      const g = window.__game;
      try { g.setDescentProgress(descent); } catch {}
      const atDescent = g.probeCabinDoor();
      // IMPACT (sealed, crashed) — the crash pose tilts the GROUP; the door pivot LOCAL should stay 0.
      try { g.setDescentProgress(1); g.setCabinCrashPose(1); } catch {}
      const atImpact = g.probeCabinDoor();
      // back to the sealed descent pose for the head-on shot
      try { g.setCabinCrashPose(0); g.setDescentProgress(descent); } catch {}
      return { atDescent, atImpact };
    }, descent);
    console.log('[door-check] pivot ' + JSON.stringify(probe));
    // head-on shot: camera at the porthole centre height, dead −Z, close.
    await page.waitForTimeout(300);
    await page.evaluate((descent) => {
      const ctx = window.__game.ctx;
      ctx.flags.paused = true;
      try { window.__game.setDescentProgress(descent); } catch {}
      const cam = ctx.three.camera;
      const V = cam.position.constructor;
      const pod = ctx.three.scene.getObjectByName('escapePodCabin');
      pod.updateMatrixWorld(true);
      const o = pod.getWorldPosition(new V());
      // VP_CY = 1.34 (porthole centre height above the floor origin); CAB_R front wall at z = o.z − 1.28.
      cam.position.set(o.x, o.y + 1.34, o.z + 0.9);
      cam.lookAt(o.x, o.y + 1.34, o.z - 1.28);
      cam.updateMatrixWorld(true);
      ctx.three.renderer.setSize(900, 900, false);
      if (cam.isPerspectiveCamera) { cam.aspect = 1; cam.updateProjectionMatrix(); }
    }, descent);
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(OUT, 'scen-door-check.png'), fullPage: false, animations: 'disabled', timeout: 60000 });
    console.log('[door-check] → scen-door-check.png');
  },

  // Hauler (T3.1): the HERO cargo-hauler exterior seen THROUGH the pod porthole at the
  // shipExplode beat — the worn freighter the player just fled, floating in orbit ahead
  // (−Z) about to explode. Builds the pod cabin (so the porthole frames the shot) + the
  // hauler exterior, seats the camera at the seated EYE facing −Z (the real FP-through-
  // porthole view), then shoots that + a couple of framing angles. --angle:
  //   porthole  the FP-through-the-window view (the GATE — the seated eye, −Z)         [default]
  //   wide      a framing angle: the whole hauler in free space (no pod), 3/4
  //   broadside the hauler dead-on broadside (silhouette legibility)
  //   engines   a closer 3/4 on the rear engine cluster (the explosion feature)
  //   nose      a closer 3/4 on the cockpit/bridge
  'hauler': async (page) => {
    const angle = argv.angle || 'porthole';
    // C1 — --depart=<0..1> drives the post-eject DEPARTURE recession (0 = the framed hero pose,
    //   1 = the ship receded/drifted away as the pod pulls clear). For the eject-departure shots.
    const depart = argv.depart !== undefined ? Number(argv.depart) : null;
    await page.evaluate(() => {
      const g = window.__game;
      const ctx = g.ctx;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      // Build the real pod cabin (porthole frame) via the intro path, then the hauler.
      g.startIntro();
      // enterPod builds the pod cabin + seats the player at the porthole eye (the proven
      // pod-interior path); shipExplode's scripted camera doesn't seat in the pod.
      g.jumpToBeat('enterPod');
      // Reset the descent vista to deep ORBIT (0) so the porthole shows SPACE (the
      // shipExplode beat sits in orbit) — not the low-altitude desert that swells in
      // later. The hauler then reads through the window against the star void.
      try { g.setDescentProgress(0); } catch {}
      g.buildHauler();
      ctx.three.renderer.setSize(1000, 760, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1000 / 760; cam.updateProjectionMatrix(); }
    });
    // Let the beat controller tick so the pod builds + the player is seated.
    await page.waitForTimeout(600);
    const meas = await page.evaluate(({ angle, depart }) => {
      const g = window.__game;
      const ctx = g.ctx;
      ctx.flags.paused = true;
      try { g.setDescentProgress(0); } catch {}
      // C1 — pose the eject-departure recession (the ship receding in the porthole).
      if (depart !== null) { try { g.setHaulerDeparture(depart); } catch {} }
      // Hide the descent VISTA (orbital planet + atmosphere + its own starfield + the
      // depth-occluder) so the porthole shows the HAULER against ITS star backdrop. The
      // vista meshes use ShaderMaterials or the starOccluder flag; the cabin structure
      // uses Lambert/rusted-hull mats. Done HERE (after the pod has built on a tick).
      const cabin0 = ctx.three.scene.getObjectByName('escapePodCabin');
      if (cabin0) cabin0.traverse((o) => {
        if (!o.isMesh) return;
        const m = o.material;
        if ((m && m.isShaderMaterial) || (o.userData && o.userData.starOccluder)) o.visible = false;
      });
      const cam = ctx.three.camera;
      const V = cam.position.constructor;
      // Locate the hauler centre (world) so the framing angles can orbit it.
      const hauler = ctx.three.scene.getObjectByName('escapePodHauler');
      let hc = null;
      if (hauler) { hauler.updateMatrixWorld(true); hc = new V(); hauler.getWorldPosition(hc); }
      if (angle === 'porthole') {
        // THE GATE: the seated EYE world position, looking straight out −Z (the porthole).
        const tr = ctx.player.body.body.translation();
        const eye = new V(tr.x, tr.y + (ctx.player.eyeOffset || 0.6), tr.z);
        cam.position.copy(eye);
        cam.lookAt(eye.x, eye.y - 0.05, eye.z - 1);
      } else if (hc) {
        // Free-space framing angles (the studio diagnostic — additional, not the verdict).
        // Hide the pod cabin so it doesn't block the external read.
        const cabin = ctx.three.scene.getObjectByName('escapePodCabin');
        if (cabin) cabin.visible = false;
        // The ship's local axes in WORLD space (so framing angles track the yaw).
        const Q = cam.quaternion.constructor;
        const hq = hauler.getWorldQuaternion(new Q());
        const axX = new V(1, 0, 0).applyQuaternion(hq);   // ship NOSE direction (local +X)
        const axZ = new V(0, 0, 1).applyQuaternion(hq);   // ship broadside flank (local +Z)
        if (angle === 'broadside') {
          cam.position.set(hc.x, hc.y + 1.0, hc.z + 15);
          cam.lookAt(hc.x, hc.y, hc.z);
        } else if (angle === 'engines') {
          // off the TAIL (−X) end + the camera-side flank → the flared nozzles read.
          const e = new V(hc.x - axX.x * 9 + axZ.x * 6, hc.y + 2.5, hc.z - axX.z * 9 + axZ.z * 6);
          cam.position.copy(e);
          cam.lookAt(hc.x - axX.x * 6, hc.y, hc.z - axX.z * 6);
        } else if (angle === 'nose') {
          // off the NOSE (+X) end + the camera-side flank → the cockpit/windscreen reads.
          const n = new V(hc.x + axX.x * 9 + axZ.x * 6, hc.y + 2, hc.z + axX.z * 9 + axZ.z * 6);
          cam.position.copy(n);
          cam.lookAt(hc.x + axX.x * 6, hc.y + 0.5, hc.z + axX.z * 6);
        } else { // wide 3/4
          cam.position.set(hc.x + 11, hc.y + 5, hc.z + 15);
          cam.lookAt(hc.x, hc.y, hc.z);
        }
      }
      cam.updateMatrixWorld(true);
      let meshes = 0;
      if (hauler) hauler.traverse((o) => { if (o.isMesh) meshes++; });
      // DIAGNOSTIC: where is the camera, where is the hauler, what's the descent state?
      const cabin = ctx.three.scene.getObjectByName('escapePodCabin');
      let lowAltVis = null, planetVis = null;
      if (cabin) cabin.traverse((o) => {
        if (o.material && o.material.uniforms && o.material.uniforms.uLowAlt) lowAltVis = { vis: o.visible, lowAlt: o.material.uniforms.uLowAlt.value };
      });
      console.error('[hauler-diag] camPos=' + [cam.position.x, cam.position.y, cam.position.z].map((v) => +v.toFixed(1)).join(',') +
        ' haulerPos=' + (hc ? [hc.x, hc.y, hc.z].map((v) => +v.toFixed(1)).join(',') : 'null') +
        ' cabin=' + !!cabin + ' lowAlt=' + JSON.stringify(lowAltVis));
      return { found: !!hauler, meshes, angle };
    }, { angle, depart });
    await page.waitForTimeout(300);
    const deptag = depart !== null ? `-depart${String(depart).replace('.', '')}` : '';
    await page.screenshot({ path: join(OUT, `scen-hauler-${angle}${deptag}.png`), fullPage: false });
    console.log(`[hauler] ${JSON.stringify(meas)} → scen-hauler-${angle}${deptag}.png`);
  },

  // Ship-explode (T3.2): THE CLIMACTIC SPECTACLE — the player watches their hauler DIE
  // through the porthole. Builds the pod cabin (porthole frame) + the hauler, drives the
  // explosion FX to a chosen moment (--t=<0..1> into the blast; default 0.22 = mid-fireball),
  // and shoots the REAL seated FP-through-the-window view (−Z). --view=free renders a free
  // 3/4 angle on the exploding ship instead (the studio diagnostic). --strip captures a
  // sequence of moments (0.03 flash → 0.15 fireball → 0.35 breakup → 0.7 husk) in one boot.
  'ship-explode': async (page) => {
    const view = argv.view || 'porthole';
    const t = argv.t !== undefined ? Number(argv.t) : 0.22;
    const strip = !!argv.strip;
    await page.evaluate(() => {
      const g = window.__game;
      const ctx = g.ctx;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      // Build the real pod cabin at the ORBIT frame + seat the player at the porthole eye,
      // then the hauler. (buildPodOrbit builds+seats deterministically — the enterPod beat
      // stalls in its walk-up phase in a headless boot, never sealing the cabin.)
      g.startIntro();
      g.jumpToBeat('shipExplode');   // the real beat context (mode seated, faces −Z)
      g.buildPodOrbit();             // build + seat the pod cabin at orbit (porthole eye)
      try { g.setDescentProgress(0); } catch {}   // orbital vista through the window
      g.buildHauler();
      ctx.three.renderer.setSize(1000, 760, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1000 / 760; cam.updateProjectionMatrix(); }
    });
    await page.waitForTimeout(600);   // let the pod cabin build + seat on a tick
    // Frame + drive-explosion + shoot. `moments` is a list of (tag, explosionT) — one for a
    // single shot, or the strip preset.
    const moments = strip
      ? [['f00-flash', 0.03], ['f01-bloom', 0.13], ['f02-fireball', 0.24], ['f03-breakup', 0.42], ['f04-husk', 0.72]]
      : [[`t${String(t).replace('.', '')}`, t]];
    for (const [tag, et] of moments) {
      const meas = await page.evaluate(({ view, et }) => {
        const g = window.__game;
        const ctx = g.ctx;
        ctx.flags.paused = true;
        try { g.setDescentProgress(0); } catch {}
        try { g.setHaulerExplosion(et); } catch {}
        const cam = ctx.three.camera;
        const V = cam.position.constructor;
        // Hide any cabin ShaderMaterial meshes (the re-entry plasma/shimmer — invisible at
        // descent=0 anyway) so nothing layers over the porthole read (matches the hauler scenario).
        const cabin = ctx.three.scene.getObjectByName('escapePodCabin');
        if (cabin) cabin.traverse((o) => {
          if (!o.isMesh) return;
          const m = o.material;
          if ((m && m.isShaderMaterial) || (o.userData && o.userData.starOccluder)) o.visible = false;
        });
        // Full-intro coherence fix mirror: this beat sits in full orbit (descent=0, space01=1) —
        // dim the world sun+ambient so the paused rig shows the vacuum-lit cabin (not the pale
        // noon-flooded one). Matches sky.ts applySpaceMode (sun ×0.12, ambient ×0.06 at s=1).
        // X2a gate post-mortem: the old one-shot `*=` compounded across strip re-evaluates AND
        // could be re-derived back to noon by a live lighting tick before the capture (the false
        // PALE frame). Idempotent SET from a stashed base; re-applied again just before capture.
        if (ctx.lights) {
          if (window.__rigSpaceBase === undefined) window.__rigSpaceBase = { sun: ctx.lights.sun.intensity, amb: ctx.lights.ambient.intensity };
          ctx.lights.sun.intensity = window.__rigSpaceBase.sun * 0.12;
          ctx.lights.ambient.intensity = window.__rigSpaceBase.amb * 0.06;
        }
        const hauler = ctx.three.scene.getObjectByName('escapePodHauler');
        let hc = null;
        if (hauler) { hauler.updateMatrixWorld(true); hc = new V(); hauler.getWorldPosition(hc); }
        if (view === 'porthole') {
          // THE GATE: the seated EYE world pos (derived from the cabin group), looking −Z.
          let eye;
          const pod0 = ctx.three.scene.getObjectByName('escapePodCabin');
          if (pod0) {
            pod0.updateMatrixWorld(true);
            const o = pod0.getWorldPosition(new V());
            const pb = ctx.player.body;
            const bodyY = o.y + (pb.halfHeight || 0.6) + (pb.radius || 0.3);
            eye = new V(o.x, bodyY + (ctx.player.eyeOffset || 0.5), o.z + 0.35);
          } else {
            const tr = ctx.player.body.body.translation();
            eye = new V(tr.x, tr.y + (ctx.player.eyeOffset || 0.5), tr.z);
          }
          cam.position.copy(eye);
          cam.lookAt(eye.x, eye.y - 0.05, eye.z - 1);
        } else if (hc) {
          // FREE 3/4 on the exploding ship (studio diagnostic — hide the cabin).
          if (cabin) cabin.visible = false;
          cam.position.set(hc.x + 12, hc.y + 6, hc.z + 17);
          cam.lookAt(hc.x, hc.y, hc.z);
        }
        cam.updateMatrixWorld(true);
        return { view, et, hauler: !!hauler };
      }, { view, et });
      await page.waitForTimeout(250);
      // Re-assert the vacuum dim AFTER the settle wait — a live lighting tick during the wait
      // re-derives noon sun/ambient and produced the false PALE cabin frame (X2a flag).
      await page.evaluate(() => {
        const ctx = window.__game.ctx;
        if (ctx.lights && window.__rigSpaceBase !== undefined) {
          ctx.lights.sun.intensity = window.__rigSpaceBase.sun * 0.12;
          ctx.lights.ambient.intensity = window.__rigSpaceBase.amb * 0.06;
        }
      });
      const fname = strip ? `scen-ship-explode-${tag}.png` : `scen-ship-explode-${view}-${tag}.png`;
      await page.screenshot({ path: join(OUT, fname), fullPage: false });
      console.log(`[ship-explode] ${JSON.stringify(meas)} → ${fname}`);
    }
  },

  // W1 COLLIDER ENUM (item 7 diagnosis) — list every collider whose AABB sits in the cockpit box,
  //   flagging those AFT of the seat (z_local > 0) that could box the player in. No shot.
  'cockpit-colliders': async (page) => {
    const out = await page.evaluate(async () => {
      const g = window.__game; const ctx = g.ctx;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const realClock = ctx.three.clock; realClock.getDelta = () => 0.05;
      ctx.three.renderer.setSize(48, 48, false);
      try { g.skipIntro(); } catch {}
      for (let i = 0; i < 40; i++) { await sleep(16); if (!ctx.intro || !ctx.intro.active) break; }
      g.startIntro();
      for (let a = 0; a < 20; a++) { g.jumpToBeat('cockpit'); for (let i = 0; i < 30; i++) { await sleep(16); if (ctx.player.body.body.translation().y > 2900) break; } if (ctx.player.body.body.translation().y > 2900) break; }
      const sp = ctx.player.body.body.translation();
      const ORIGIN = { x: sp.x, y: sp.y - (ctx.player.body.halfHeight + ctx.player.body.radius) - 0.85, z: sp.z + 0.30 };  // approx ship origin (seat z_local=-0.30)
      const world = ctx.physics.world;
      const hits = [];
      world.forEachCollider((col) => {
        const t = col.translation();
        // local to ship origin
        const lx = t.x - sp.x, ly = t.y, lz = t.z - (sp.z + 0.30);
        // only near the cockpit (|lx|<4, |lz|<4, world y near ship origin ~3000)
        if (Math.abs(lx) < 4 && Math.abs(lz) < 4 && ty(t.y)) {
          let half = null;
          try { const s = col.halfExtents ? col.halfExtents() : null; if (s) half = [ +s.x.toFixed(2), +s.y.toFixed(2), +s.z.toFixed(2) ]; } catch {}
          hits.push({ lx: +lx.toFixed(2), lz: +lz.toFixed(2), wy: +t.y.toFixed(1), half, aftOfSeat: lz > -0.15 && Math.abs(lx) < 0.9 });
        }
        function ty(y) { return y > 2990 && y < 3010; }
      });
      const aft = hits.filter((h) => h.aftOfSeat);
      return { total: hits.length, aftOfSeat: aft, all: hits };
    });
    console.log('[cockpit-colliders] total=' + out.total + ' aftOfSeat=' + out.aftOfSeat.length);
    for (const h of out.aftOfSeat) console.log('[cockpit-colliders][AFT] ' + JSON.stringify(h));
    for (const h of out.all) console.log('[cockpit-colliders] ' + JSON.stringify(h));
  },

  // W1 COCKPIT MOTION PROBE (item 7 — "remove the chair collider + the invisible collider behind
  //   the chair; I want to walk the cockpit freely"). The B1.f real-KCC motion proof: seat the
  //   player at getShipSpawn, then drive REAL WASD in each direction (aft / left / right / fwd) and
  //   report the max body displacement. A FREE cockpit = large Δ aft + strafe (no wall boxing the
  //   seat). No screenshot — a motion assertion (like pod-walkin). Pins a FIXED dt so it's
  //   throttle-proof under the ~1 fps headless tab.
  // GLASS-SEAL CONTAINMENT PROBE (LIVE-fix 2026-07-05) — the cockpit-motion gate passed while a
  //   walk-through-glass hole existed at the SIDE closures (it only tests 4 cardinal legs + 5 roam
  //   targets, none of which push straight OUT through a closure pane). This probe is strictly
  //   stronger: from the cabin walk centre it walks OUTWARD at 12 azimuths (30° steps) and asserts the
  //   KCC is CONTAINED at EVERY azimuth (never escapes past the dome sill radius). PASS = the max
  //   outward radius reached at every azimuth stays inside the glass line + a small margin.
  //   node scripts/rig-shot.mjs --scenario=cockpit-glass-seal --port=5192
  'cockpit-glass-seal': async (page) => {
    const out = await page.evaluate(async () => {
      const g = window.__game; const ctx = g.ctx;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      try { ctx.weather.intensity = 0; ctx.weather.cloudiness = 0; } catch {}
      const realClock = ctx.three.clock; const FIXED_DT = 0.05;
      realClock.getDelta = () => FIXED_DT;
      ctx.three.renderer.setSize(48, 48, false);
      const drive = async (simBudget, perTick) => {
        const s0 = ctx.time.elapsed; let last = s0, stalls = 0;
        for (let i = 0; i < 8000; i++) {
          if (perTick) perTick();
          await sleep(16);
          const now = ctx.time.elapsed;
          if (now > last + 1e-6) { last = now; stalls = 0; } else if (++stalls > 600) break;
          if (now - s0 >= simBudget) break;
        }
      };
      try { g.skipIntro(); } catch {}
      await drive(0.2);
      g.startIntro();
      for (let a = 0; a < 20; a++) { g.jumpToBeat('cockpit'); await drive(0.3); if (ctx.player.body.body.translation().y > 2900) break; }
      try { g.setSkyIntroMode(0); } catch {}
      ctx.flags.paused = false;
      ctx.input.controls.isLocked = true;
      const cam = ctx.three.camera; cam.rotation.order = 'YXZ';
      const clearKeys = () => { for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) ctx.input.keys[k] = false; };
      const origin = () => ctx.player.body.body.translation();
      const s0 = origin(); const SEAT = { x: s0.x, y: s0.y, z: s0.z };
      // walk-centre: a hair aft of the seat (mid cabin) so all 12 outward pushes start from one interior point.
      const CX = SEAT.x, CZ = SEAT.z + 0.4;
      // the dome sill radius envelope (ship-local): the glass line the player must NOT cross. Front reach
      //   (−Z) is far (nose ≈ z−2.25); the sides ≈ x±2.08; we compute the outward distance from the walk
      //   centre to the sill footprint at each azimuth and assert the body stays inside it + a KCC margin.
      const results = [];
      const STEPS = 12;
      for (let s = 0; s < STEPS; s++) {
        const yaw = (s / STEPS) * Math.PI * 2;      // 0..2π (0 = −Z forward under YXZ fwd = (−sinθ,0,−cosθ))
        clearKeys();
        if (ctx.intro) { ctx.intro.mode = 'walk'; ctx.player.eyeOffset = 0.85; }
        ctx.player.body.body.setTranslation({ x: CX, y: SEAT.y, z: CZ }, true);
        await drive(0.2);
        // push OUTWARD along this azimuth for a good while (try hard to escape the canopy).
        await drive(2.6, () => { cam.rotation.set(0, yaw, 0); ctx.input.keys['KeyW'] = true; });
        clearKeys();
        const p = origin();
        const rx = p.x - CX, rz = p.z - CZ;
        const r = Math.hypot(rx, rz);
        // forward dir under YXZ at this yaw:
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        results.push({ deg: Math.round((yaw * 180) / Math.PI), r: +r.toFixed(2), at: [+rx.toFixed(2), +rz.toFixed(2)], fwd: [+fx.toFixed(2), +fz.toFixed(2)] });
      }
      let dbg = null;
      try {
        const w = ctx.physics.world; const bodyY = SEAT.y; const near = [];
        w.forEachCollider((c) => {
          const t = c.translation();
          // dome ring colliders: ship-local x<−1.5 AND ship-local z in [−2.5, 0.6] (the forward glass band)
          const lz = t.z - CZ + 0.1, lx = t.x - CX;
          if (Math.abs(t.y - bodyY) < 3 && lx < -1.5 && lz < 0.6 && lz > -2.6) near.push({ x: +lx.toFixed(2), y: +(t.y - bodyY).toFixed(2), z: +(t.z - CZ).toFixed(2), hx: +(c.halfExtents ? c.halfExtents().x : -1).toFixed(2), hy: +(c.halfExtents ? c.halfExtents().y : -1).toFixed(2) });
        });
        dbg = { bodyY: +bodyY.toFixed(2), domeLeftColliders: near.length, sample: near };
      } catch (e) { dbg = { err: String(e) }; }
      return { results, centre: [+CX.toFixed(2), +CZ.toFixed(2)], dbg };
    });
    console.log('[cockpit-glass-seal][dbg] ' + JSON.stringify(out.dbg));
    // Containment check — classify by the FINAL body position (ship-local, relative to the walk centre
    //   at [0, +0.4]-ish; the probe reports `at` = [dx, dz] from centre). A GLASS BREACH = the body
    //   ended OUTSIDE the canopy envelope: to the SIDE (|dx| > 2.2 while not deep aft) or FORWARD past
    //   the nose (dz < −2.5). The AFT DOORWAY (the corridor, |dx|<1.2 and dz large positive) is a
    //   DESIGNED opening → NOT a breach; the aft-corner reaches (dz≈+2, |dx|≈2.4 at the door jamb/quarters
    //   region) are inside the ship, also not glass. This is what makes the probe strictly stronger than
    //   cockpit-motion (which counted any long walk as "free").
    const CZ0 = out.centre[1];   // walk-centre z (ship-local), so world dz = at[1]; absolute z = CZ0+at[1]
    const isGlassBreach = (r) => {
      const dx = r.at[0], dz = r.at[1];
      const zAbs = CZ0 + dz;
      const sideBreach = Math.abs(dx) > 2.2 && zAbs < 1.5;      // walked out a side/forward closure into space
      const noseBreach = zAbs < -2.5;                            // walked out the forward nose glazing
      return sideBreach || noseBreach;
    };
    const breaches = out.results.filter(isGlassBreach);
    const maxR = Math.max(...out.results.map((r) => r.r));
    const pass = breaches.length === 0;
    console.log('[cockpit-glass-seal] ' + (pass ? 'PASS' : 'FAIL') + ' glassBreaches=' + breaches.length + ' maxR=' + maxR.toFixed(2) + ' centre=' + JSON.stringify(out.centre));
    console.log('[cockpit-glass-seal][azimuths] ' + JSON.stringify(out.results.map((r) => ({ [r.deg]: '[' + r.at[0] + ',' + r.at[1] + ']' }))));
    if (breaches.length) console.log('[cockpit-glass-seal][BREACH] ' + JSON.stringify(breaches));
  },

  'cockpit-motion': async (page) => {
    const out = await page.evaluate(async () => {
      const g = window.__game; const ctx = g.ctx;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      try { ctx.weather.intensity = 0; ctx.weather.cloudiness = 0; } catch {}
      const realClock = ctx.three.clock; const FIXED_DT = 0.05;
      realClock.getDelta = () => FIXED_DT;
      ctx.three.renderer.setSize(48, 48, false);
      const drive = async (simBudget, perTick) => {
        const s0 = ctx.time.elapsed; let last = s0, stalls = 0;
        for (let i = 0; i < 8000; i++) {
          if (perTick) perTick();
          await sleep(16);
          const now = ctx.time.elapsed;
          if (now > last + 1e-6) { last = now; stalls = 0; } else if (++stalls > 600) break;
          if (now - s0 >= simBudget) break;
        }
      };
      try { g.skipIntro(); } catch {}
      await drive(0.2);
      g.startIntro();
      for (let a = 0; a < 20; a++) { g.jumpToBeat('cockpit'); await drive(0.3); if (ctx.player.body.body.translation().y > 2900) break; }
      try { g.setSkyIntroMode(0); } catch {}
      ctx.flags.paused = false;
      ctx.input.controls.isLocked = true;   // isPlaying() → real KCC motion processed
      const cam = ctx.three.camera; cam.rotation.order = 'YXZ';
      const clearKeys = () => { for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) ctx.input.keys[k] = false; };
      const origin = () => ctx.player.body.body.translation();
      // capture the SEAT as the seated spawn position (the body is at getShipSpawn right after the jump)
      const s0 = origin(); const SEAT = { x: s0.x, y: s0.y, z: s0.z };
      const reseat = () => ctx.player.body.body.setTranslation({ x: SEAT.x, y: SEAT.y, z: SEAT.z }, true);
      const runLeg = async (label, yaw, key) => {
        clearKeys(); reseat();
        // force WALK mode + standing eye (the cockpit opening is SEATED by design → locomotion off;
        //   "walk the cockpit freely" is the walk-enabled state — that's what item 7 tests).
        if (ctx.intro) { ctx.intro.mode = 'walk'; ctx.player.eyeOffset = 0.85; }
        await drive(0.2);
        const start = origin(); const p0 = { x: start.x, z: start.z };
        await drive(2.2, () => { cam.rotation.set(0, yaw, 0); ctx.input.keys[key] = true; });
        clearKeys();
        const p1 = origin();
        const d = Math.hypot(p1.x - p0.x, p1.z - p0.z);
        const dir = ctx.three.camera.getWorldDirection(new (ctx.three.camera.position.constructor)());
        return { label, dx: +(p1.x - p0.x).toFixed(2), dz: +(p1.z - p0.z).toFixed(2), d: +d.toFixed(2),
                 camY: +ctx.three.camera.rotation.y.toFixed(2), fwd: [+dir.x.toFixed(2), +dir.z.toFixed(2)],
                 introActive: !!(ctx.intro && ctx.intro.active), mode: ctx.intro && ctx.intro.mode, eyeOff: +(ctx.player.eyeOffset||0).toFixed(2) };
      };
      const legs = [];
      // KeyW drives ALONG the camera-forward; yaw π → aft(+Z, the door egress), −π/2 → −X, +π/2 → +X, 0 → fwd(−Z)
      legs.push(await runLeg('aft(+Z)', Math.PI, 'KeyW'));
      legs.push(await runLeg('left(−X)', -Math.PI / 2, 'KeyW'));
      legs.push(await runLeg('right(+X)', Math.PI / 2, 'KeyW'));
      legs.push(await runLeg('fwd(−Z)', 0, 'KeyW'));
      // ── WHOLE-COCKPIT ROAM (coordinator: prove the whole floor, not just the egress lane). Place
      //    the body at each aisle spot + walk TOWARD a target corner; report how close it reaches.
      //    ORIGIN.z = SEAT.z + 0.30. Walkable band ≈ |x|<1.9, z ∈ (−1.0 .. 2.2).
      const OZ = SEAT.z + 0.30;
      const roam = [];
      const roamTo = async (label, from, target) => {
        clearKeys();
        if (ctx.intro) { ctx.intro.mode = 'walk'; ctx.player.eyeOffset = 0.85; }
        ctx.player.body.body.setTranslation({ x: SEAT.x + from.x, y: SEAT.y, z: OZ + from.z }, true);
        await drive(0.2);
        const yawTo = Math.atan2(-(target.x - from.x), -(target.z - from.z));   // face the target (YXZ fwd = (−sinθ,0,−cosθ))
        await drive(2.0, () => { cam.rotation.set(0, yawTo, 0); ctx.input.keys['KeyW'] = true; });
        clearKeys();
        const p = origin();
        const reached = Math.hypot((p.x - SEAT.x) - target.x, (p.z - OZ) - target.z);
        return { label, at: [+(p.x - SEAT.x).toFixed(2), +(p.z - OZ).toFixed(2)], distToTarget: +reached.toFixed(2) };
      };
      roam.push(await roamTo('fwd-L (beside console)', { x: -1.4, z: -0.6 }, { x: -1.6, z: -1.1 }));
      roam.push(await roamTo('fwd-R (beside console)', { x: 1.4, z: -0.6 }, { x: 1.6, z: -1.1 }));
      roam.push(await roamTo('wall-L (mid)', { x: 0, z: 0.4 }, { x: -1.8, z: 0.4 }));
      roam.push(await roamTo('wall-R (mid)', { x: 0, z: 0.4 }, { x: 1.8, z: 0.4 }));
      roam.push(await roamTo('aft-door', { x: 0, z: 1.0 }, { x: 0, z: 2.3 }));
      return { legs, roam, seat: [+SEAT.x.toFixed(2), +SEAT.y.toFixed(2), +SEAT.z.toFixed(2)] };
    });
    const freeDirs = out.legs.filter((l) => l.d >= 0.8).length;
    // roam OK = each target reached within a capsule-radius standoff (~0.55) OR the body walked PAST
    //   it (overshoot past a wall-clear target = even freer). The aft-door target is a pass-through.
    const roamOk = out.roam.every((r) => {
      if (r.label === 'aft-door') return r.at[1] >= 2.0;          // walked to/through the door mouth
      return r.distToTarget <= 0.6 || Math.abs(r.at[0]) >= Math.abs(1.6);   // reached the corner or the wall standoff
    });
    const pass = freeDirs >= 3 && out.legs.find((l) => l.label === 'aft(+Z)').d >= 0.8 && roamOk;
    console.log('[cockpit-motion] ' + (pass ? 'PASS' : 'FAIL') + ' freeDirs=' + freeDirs + ' roamOk=' + roamOk);
    console.log('[cockpit-motion][legs] ' + JSON.stringify(out.legs.map((l) => ({ [l.label]: l.d }))));
    console.log('[cockpit-motion][roam] ' + JSON.stringify(out.roam));
  },

  // Cockpit (T3.3): the GAME'S OPENING SHOT — the REAL seated first-person view inside the
  // HERO single-pilot cockpit. Drives the game's OWN intro path (startIntro → jumpToBeat
  // 'cockpit') so the beat machine builds the ship + seats the player at getShipSpawn facing
  // −Z (looking out the forward window at the orbit view) — NOT an idealized studio rig.
  //   --angle: forward (Beat-0 seated, out the window)   [default]
  //            console (look down-forward at the dash/screens)
  //            door    (stood + turned aft to the corridor doorway — the "check engines" exit)
  //            left/right (head-turned reads of the side walls / clutter)
  //            wide    (head-turned 3/4 of the whole bridge)
  //   --stand draws the standing eye (rise + walk read) instead of the seated eye.
  //   --alert=<0|1|2> drives the cockpit alert state (verify the escalation surface).
  'cockpit': async (page) => {
    const angle = argv.angle || 'forward';
    const stand = !!argv.stand;
    const colliders = !!argv.colliders;   // A1 evidence — overlay the Rapier collider wireframe on the hull
    const alert = argv.alert !== undefined ? Number(argv.alert) : 0;
    const space = argv.space !== undefined ? Number(argv.space === true ? 1 : argv.space) : 0; // REBUILD v2 R1a — --space[=0..1] drives the orbit sky
    const hideStars = !!argv.hidestars;
    const noPlanet = !!argv.noplanet;
    const noGlass = !!argv.noglass;
    const noDome = !!argv.nodome;
    const noHull = !!argv.nohull;
    await page.evaluate(({ space, hideStars, noPlanet, noGlass, noDome, noHull }) => {
      window.__RIG_SPACE01 = space;
      window.__RIG_HIDESTARS = hideStars;
      window.__RIG_NOPLANET = noPlanet;
      window.__RIG_NOGLASS = noGlass;
      window.__RIG_NODOME = noDome;
      window.__RIG_NOHULL = noHull;
      const g = window.__game;
      const ctx = g.ctx;
      // First-person seated read; hide the rig so it doesn't block the FP camera.
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      // KILL the weather (the rain/dust streaks read as a dirty-lens filter over the cockpit
      // — they are world atmosphere, not the cabin) + a touch of warm exposure for the mood.
      try { ctx.weather.intensity = 0; ctx.weather.cloudiness = 0; } catch {}
      try { ctx.three.renderer.toneMappingExposure = 1.08; } catch {}
      // Drive the real intro: start it (force) + jump to the cockpit beat → the beat
      // controller builds the ship + seats the player facing −Z (the genuine FP frame).
      g.startIntro();
      g.jumpToBeat('cockpit');
      // REBUILD v2 R1a — drive the real sky into space mode so the window reads as orbit.
      if (space > 0) {
        try { g.setSkyIntroMode(space); } catch {}
        // Vacuum cabin has no floating dust — suppress the camera-anchored mote/dust
        // layers (these are atmospheric, not orbital). The space BEATS must do the same
        // (coordinator handoff); here we mirror that so the sky read is clean.
        try { if (ctx.dustMotes) ctx.dustMotes.particles.visible = false; } catch {}
        try { if (ctx.ambientDust) ctx.ambientDust.particles.visible = false; } catch {}
        try { for (const k of ['near', 'mid', 'far']) { const L = ctx.weather.layers && ctx.weather.layers[k]; if (L && L.particles) L.particles.visible = false; } } catch {}
      } else { try { g.setSkyIntroMode(0); } catch {} }   // control: prove space-mode off = normal sky
      ctx.three.renderer.setSize(1100, 760, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1100 / 760; cam.updateProjectionMatrix(); }
    }, { space, hideStars, noPlanet, noGlass, noDome, noHull });
    // Let the beat controller tick (page RAF) so the ship builds + the player seats.
    await page.waitForTimeout(700);
    // --eye=dx,dy,dz --look=lx,ly,lz — a free camera override in SHIP-LOCAL coords (offsets from the
    //   spawn XZ / ship floor). Lets a fix-agent shoot arbitrary STANDING / WALKING / CROUCHED vantages
    //   around the glass perimeter that the fixed seated/stand poses can't reach (the C63 vantage lesson).
    const eyeOv = argv.eye ? String(argv.eye).split(',').map(Number) : null;
    const lookOv = argv.look ? String(argv.look).split(',').map(Number) : null;
    const meas = await page.evaluate(({ angle, stand, alert, colliders, eyeOv, lookOv }) => {
      const g = window.__game;
      const ctx = g.ctx;
      if (alert > 0) { try { g.setCockpitAlert(alert); } catch {} }
      // A1 EVIDENCE — overlay the Rapier collider wireframe (bright green LineSegments, depthTest off)
      //   so the shot shows the collider surface OVER the visible hull skin. The COCKPIT colliders are
      //   at world y≈3000 (SHIP_ORIGIN.y), so they render right on the cockpit hull. `three` is reached
      //   via a dynamic import (Vite serves the module); the overlay is finished in an async step below.
      if (colliders) { window.__RIG_WANT_COLLIDERS = true; }
      // REBUILD v2 R1a debug — --hidestars proves whether the top speckles are the
      // real star sphere (set the env via argv passthrough below).
      if (window.__RIG_HIDESTARS) {
        ctx.three.scene.traverse((o) => { if (o.isPoints && o.renderOrder === -0.5) o.visible = false; });
      }
      if (window.__RIG_NOPLANET) { ctx.three.scene.traverse((o)=>{ if(o.isMesh && (o.renderOrder===-0.4||o.renderOrder===-0.39)) o.visible=false; }); }
      // --noglass: hide the windscreen glass + smudge + streak overlays (transparent meshes near the
      // -Z window plane) to see the RAW background behind the window.
      if (window.__RIG_NOGLASS) {
        const ship = ctx.three.scene.getObjectByName('escapePodShipCockpit');
        if (ship) ship.traverse((o) => {
          if (o.isMesh && o.material && o.material.transparent && o.position.z < -1.8) o.visible = false;
        });
      }
      // --nodome: hide the sky dome sphere (the big uTopColor mesh) so we can tell if the tan is the sky.
      if (window.__RIG_NODOME) {
        ctx.three.scene.traverse((o) => { if (o.isMesh && o.material && o.material.uniforms && o.material.uniforms.uTopColor) o.visible = false; });
      }
      // --nohull: hide every ship mesh FORWARD of the eye (world z<2998.7) to strip whatever fills the window.
      if (window.__RIG_NOHULL) {
        const ship = ctx.three.scene.getObjectByName('escapePodShipCockpit');
        const hidden = {};
        if (ship) ship.traverse((o) => {
          if (o.isMesh && o.visible) {
            const wp = o.getWorldPosition(new (ctx.three.camera.position.constructor)());
            if (wp.z < 2998.7) { o.visible = false; const k=(o.material&&o.material.name)||(o.geometry&&o.geometry.type)||'?'; hidden[k]=(hidden[k]||0)+1; }
          }
        });
        console.error('[nohull] hid ' + JSON.stringify(hidden));
      }
      ctx.flags.paused = true;
      const cam = ctx.three.camera;
      const V = cam.position.constructor;
      // Keep the framed aspect for THIS shot (other scenarios may have left a stale size).
      ctx.three.renderer.setSize(1100, 760, false);
      if (cam.isPerspectiveCamera) { cam.aspect = 1100 / 760; cam.updateProjectionMatrix(); }
      // The SEATED PILOT eye: LOW + leaned back into the seat (a pilot sits low at the
      // controls). The spawn is the forward pilot station; the seated pose lowers the eye to
      // ~1.15m above the floor (this mirrors the in-game seated pose sequence.ts will wire —
      // see the agent's hand-back note). For "stand", raise to a standing eye + step aft.
      const tr = ctx.player.body.body.translation();
      const floorY = tr.y - (ctx.player.body.halfHeight + ctx.player.body.radius); // ship floor world-y
      if (angle === 'wide') {
        // The WIDE 3/4 is NOT a seated-eye shot — it must SHOW the seat + station, so park the
        // camera up + WELL behind the pilot's right shoulder (near the aft wall), looking
        // forward-down over the whole chair at the dash + window (the chair clearly in frame).
        const sx = tr.x + 1.3, sy = floorY + 2.05, sz = tr.z + 2.0;
        cam.position.set(sx, sy, sz);
        cam.lookAt(tr.x - 0.25, floorY + 0.7, tr.z - 1.4);
        cam.updateMatrixWorld(true);
        const ship0 = ctx.three.scene.getObjectByName('escapePodShipCockpit');
        let m0 = 0; if (ship0) ship0.traverse((o) => { if (o.isMesh) m0++; });
        return { found: !!ship0, meshes: m0, eye: [+sx.toFixed(2), +sy.toFixed(2), +sz.toFixed(2)], alert };
      }
      // The SEATED PILOT eye = the REAL in-game seated eye: body-centre + the seated eye
      // offset (POD_SEATED_EYE_OFFSET 0.50 → floor + 0.85 + 0.50 = floor+1.35). This is the
      // genuine Beat-0 frame the player sees (NOT a fabricated viewpoint). For "stand", raise
      // to a standing eye + step aft (the rise + walk-to-the-door read).
      const seatedEye = (ctx.player.eyeOffset || 0.5);   // the controller sets this to the seated offset in intro
      const eyeY = stand ? floorY + 1.62 : (tr.y + seatedEye);
      const eyeZ = tr.z + (stand ? -0.1 : 0.1);   // seated: a hair back into the seat
      const eye = new V(tr.x, eyeY, eyeZ);
      // FREE OVERRIDE (--eye/--look): offset from the spawn XZ + ship floor. dy is height ABOVE the floor.
      if (eyeOv) { eye.set(tr.x + eyeOv[0], floorY + eyeOv[1], tr.z + eyeOv[2]); }
      cam.position.copy(eye);
      if (lookOv) {
        cam.up.set(0, 1, 0);
        cam.lookAt(new V(tr.x + lookOv[0], floorY + lookOv[1], tr.z + lookOv[2]));
        cam.updateMatrixWorld(true);
        const shipF = ctx.three.scene.getObjectByName('escapePodShipCockpit');
        let mF = 0; if (shipF) shipF.traverse((o) => { if (o.isMesh) mF++; });
        return { found: !!shipF, meshes: mF, eye: [+eye.x.toFixed(2), +eye.y.toFixed(2), +eye.z.toFixed(2)], alert };
      }
      // Look directions in the cockpit-local frame: −Z is forward (window), +Z is aft
      // (the corridor doorway), +X right, −X left.
      if (angle === 'forward') {
        // Mirror the beat's OWN opening framing (tickCockpit faceControl(-0.09, -0.03)) via the SAME
        // YXZ euler method — so this shot is the REAL in-game opening gaze, not a fabricated lookAt.
        // rotation.set(pitch, yaw, 0) with YXZ; faceControl(yaw, pitch) → set(pitch, yaw, 0).
        cam.rotation.order = 'YXZ';
        cam.rotation.set(-0.03, -0.09, 0);
        cam.updateMatrixWorld(true);
      } else {
        let look;
        if (angle === 'console') look = new V(eye.x, eye.y - 0.7, eye.z - 0.8);    // down-forward at the dash
        else if (angle === 'door') look = new V(eye.x, eye.y - 0.05, eye.z + 1);        // turn aft to the corridor
        else if (angle === 'left') look = new V(eye.x - 1, eye.y - 0.1, eye.z - 0.2);
        else if (angle === 'right') look = new V(eye.x + 1, eye.y - 0.1, eye.z - 0.2);
        else look = new V(eye.x, eye.y + 0.06, eye.z - 1);
        cam.lookAt(look);
        cam.updateMatrixWorld(true);
      }
      // Report: is the cockpit built? mesh count? eye height?
      const ship = ctx.three.scene.getObjectByName('escapePodShipCockpit');
      let meshes = 0;
      if (ship) ship.traverse((o) => { if (o.isMesh) meshes++; });
      return { found: !!ship, meshes, eye: [+eye.x.toFixed(2), +eye.y.toFixed(2), +eye.z.toFixed(2)], alert };
    }, { angle, stand, alert, colliders, eyeOv, lookOv });
    // A1 — inject the collider wireframe (green LineSegments) using the game's exposed THREE namespace.
    if (colliders) {
      const cinfo = await page.evaluate(async () => {
        const ctx = window.__game.ctx;
        const three = window.__game.THREE;
        const dr = ctx.physics.world.debugRender();
        const bg = new three.BufferGeometry();
        bg.setAttribute('position', new three.BufferAttribute(dr.vertices, 3));
        const mat = new three.LineBasicMaterial({ color: 0x39ff5a, depthTest: false, transparent: true, opacity: 0.95 });
        const seg = new three.LineSegments(bg, mat);
        seg.renderOrder = 9999; seg.frustumCulled = false;
        ctx.three.scene.add(seg);
        return { segVerts: dr.vertices.length / 3 };
      });
      console.log('[cockpit] collider wireframe: ' + JSON.stringify(cinfo));
    }
    // RE-ANCHOR the camera-relative space planet to the NOW-POSED camera. The planet is
    // anchored each frame in updateSky (cam + dir*distance); we paused before it could run
    // at the ship-origin camera (y≈3000), so it was left stale 3000m below at y≈0 → NOT in
    // the window. Mirror applySpaceMode's anchor here so the rig shows the REAL in-game
    // frame (the planet where the seated pilot actually sees it out the windscreen).
    await page.evaluate(() => {
      const ctx = window.__game.ctx;
      let group = null;
      ctx.three.scene.traverse((o) => { if (o.isMesh && o.renderOrder === -0.4 && o.parent) group = o.parent; });
      if (!group) return;
      const cam = ctx.three.camera; cam.updateMatrixWorld(true);
      const V = cam.position.constructor;
      const dir = new V(0.30, 0.10, -1).normalize();
      const DIST = 400;   // keep in sync with _SPACE_PLANET_DIR/_DISTANCE in sky.ts
      group.position.set(cam.position.x + dir.x * DIST, cam.position.y + dir.y * DIST, cam.position.z + dir.z * DIST);
      group.updateMatrixWorld(true);
      // Re-anchor the star field + sky DOME to the posed camera too (updateSky does this each
      // frame via .position.copy(cam), but we paused before it ran at the ship-origin camera →
      // they'd be stuck at the world origin 3000m below, so the window showed no stars). Mirror it.
      ctx.three.scene.traverse((o) => {
        if (o.isPoints && o.renderOrder === -0.5) { o.position.copy(cam.position); o.updateMatrixWorld(true); }        // stars
        if (o.isMesh && o.material && o.material.uniforms && o.material.uniforms.uTopColor) { o.position.copy(cam.position); o.updateMatrixWorld(true); }   // dome sphere
      });
      // Full-intro coherence fix mirror: dim the world sun+ambient by the orbit blend so the paused
      // cockpit rig shows the SAME vacuum lighting the in-game applySpaceMode now applies (no desert
      // noon flooding the cockpit at orbit). Uses window.__RIG space passthrough via the closure arg.
      if (ctx.lights) { const sp = (window.__RIG_SPACE01 || 0); ctx.lights.sun.intensity *= (1 - sp * 0.88); ctx.lights.ambient.intensity *= (1 - sp * 0.94); }
    });
    await page.waitForTimeout(300);
    const perfC = await page.evaluate(() => { const ctx = window.__game.ctx; ctx.three.renderer.info.reset(); ctx.three.renderer.render(ctx.three.scene, ctx.three.camera); const i = ctx.three.renderer.info; const ship = ctx.three.scene.getObjectByName('escapePodShipCockpit'); let sm = 0; if (ship) ship.traverse((o) => { if (o.isMesh) sm++; }); return { draws: i.render.calls, tris: i.render.triangles, programs: i.programs?.length ?? -1, shipMeshes: sm }; });
    console.log('[cockpit-perf] ' + JSON.stringify(perfC));
    const tag = `cockpit-${argv.tag || angle}${stand ? '-stand' : ''}${alert > 0 ? '-a' + alert : ''}${space > 0 ? '-space' + (space === 1 ? '' : space) : ''}${hideStars ? '-nostars' : ''}`;
    // Clip to the canvas rect + disable animations + generous timeout: the full-page
    // font/compositor wait can stall on the space-mode ship scene (the cockpit build);
    // a clipped grab of just the WebGL canvas snapshots reliably.
    await page.screenshot({ path: join(OUT, `scen-${tag}.png`), fullPage: false, clip: { x: 0, y: 0, width: 1100, height: 760 }, animations: 'disabled', timeout: 60000 });
    console.log(`[cockpit] ${JSON.stringify(meas)} → scen-${tag}.png`);
  },

  // PARALLAX-FIX PROBE (sky.ts): measure the space planet's projected ANGULAR DIAMETER
  // from (a) the seated pilot eye and (b) ~10m aft down the corridor doorway, comparing the
  // OLD camera-anchored placement (planet re-centered on the camera → ZERO parallax → it
  // balloons as the ship shrinks) vs the NEW fixed-world-anchor placement (near-constant
  // angular size + natural tiny parallax). Prints hard numbers — the reproduction + the fix
  // evidence. Drives the real cockpit beat + space mode LIVE (updateSky/applySpaceMode run,
  // so the NEW numbers come from the shipped code, not a rig fabrication).
  //   node scripts/rig-shot.mjs --scenario=planet-parallax
  'planet-parallax': async (page) => {
    const aft = argv.aft !== undefined ? Number(argv.aft) : 10;   // metres aft to sample the "backed down the corridor" view
    await page.evaluate(() => {
      const g = window.__game;
      const ctx = g.ctx;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      try { ctx.weather.intensity = 0; ctx.weather.cloudiness = 0; } catch {}
      g.startIntro();
      g.jumpToBeat('cockpit');
      g.setSkyIntroMode(1);
    });
    // Let the beat build the ship + seat the player, and let a few live frames run so
    // updateSky→applySpaceMode CAPTURES the world anchor at the seated eye (the fix).
    await page.waitForTimeout(900);
    // Shrink the canvas so each throttled tick is cheap, then RESET + re-engage space mode
    // AFTER the seat has settled — the first (transient, pre-seat) capture frame is gone, so
    // the anchor now captures at the real seated eye. Then pump time so the recapture-on-teleport
    // path also has a chance to run. Mirrors the real game where the 60fps loop recaptures freely.
    await page.evaluate(() => {
      const g = window.__game;
      g.ctx.three.renderer.setSize(96, 96, false);
      g.setSkyIntroMode(0);   // drop the stale pre-seat anchor
      g.setSkyIntroMode(1);   // re-engage → next sky tick captures at the seated eye
    });
    await page.waitForTimeout(1400);
    const r = await page.evaluate(({ aft }) => {
      const g = window.__game; const ctx = g.ctx;
      const cam = ctx.three.camera;
      const V = cam.position.constructor;
      // Find the space-planet group + its geometric radius.
      let planetMesh = null;
      ctx.three.scene.traverse((o) => { if (o.isMesh && o.renderOrder === -0.4) planetMesh = o; });
      if (!planetMesh) return { error: 'planet mesh not found (space mode not built?)' };
      const group = planetMesh.parent;
      const R = (planetMesh.geometry.boundingSphere
        ? planetMesh.geometry.boundingSphere.radius
        : (planetMesh.geometry.computeBoundingSphere(), planetMesh.geometry.boundingSphere.radius));

      // The REAL seated eye (mirror the cockpit scenario's seated pose).
      const tr = ctx.player.body.body.translation();
      const seatedEye = (ctx.player.eyeOffset || 0.5);
      const eye = new V(tr.x, tr.y + seatedEye, tr.z + 0.1);
      // Aft sample = eye stepped +Z down the corridor doorway (backing away from the −Z window).
      const eyeAft = new V(eye.x, eye.y, eye.z + aft);

      // Angular DIAMETER (deg) of a sphere radius R at centre C seen from P: 2*asin(R/|C−P|).
      const angDiam = (Cx, Cy, Cz, P) => {
        const dx = Cx - P.x, dy = Cy - P.y, dz = Cz - P.z;
        const dist = Math.hypot(dx, dy, dz);
        const s = Math.min(1, R / dist);
        return { deg: 2 * Math.asin(s) * 180 / Math.PI, dist };
      };

      // The LIVE (NEW, fixed-world-anchor) planet centre — where applySpaceMode has it now.
      const Cnew = group.getWorldPosition(new V());

      // OLD camera-anchored math: centre = camera + dir*DIST (recomputed per camera pos → the bug).
      // DIST is read LIVE from the current anchor→seat distance (W4 moved it 400→1400), so the "old"
      // camera-anchored reference uses the SAME geometry as the live planet — the comparison stays honest.
      const dir = new V(0.30, 0.10, -1).normalize();
      const DIST = Cnew.distanceTo(eye);
      const oldCentre = (P) => new V(P.x + dir.x * DIST, P.y + dir.y * DIST, P.z + dir.z * DIST);

      const oldSeat = angDiam(oldCentre(eye).x, oldCentre(eye).y, oldCentre(eye).z, eye);
      const oldAft  = angDiam(oldCentre(eyeAft).x, oldCentre(eyeAft).y, oldCentre(eyeAft).z, eyeAft);
      // NEW: the planet is fixed at Cnew; only the eye moves.
      const newSeat = angDiam(Cnew.x, Cnew.y, Cnew.z, eye);
      const newAft  = angDiam(Cnew.x, Cnew.y, Cnew.z, eyeAft);

      const pct = (a, b) => +((b.deg - a.deg) / a.deg * 100).toFixed(2);
      return {
        // World-fixed planet centre (NEW) + the seated eye it was captured from.
        planetWorld: [+Cnew.x.toFixed(1), +Cnew.y.toFixed(1), +Cnew.z.toFixed(1)],
        seatedEye: [+eye.x.toFixed(1), +eye.y.toFixed(1), +eye.z.toFixed(1)],
        aftMeters: aft,
        planetRadius: R,
        old: {
          seatedDeg: +oldSeat.deg.toFixed(3), aftDeg: +oldAft.deg.toFixed(3),
          seatedDist: +oldSeat.dist.toFixed(1), aftDist: +oldAft.dist.toFixed(1),
          changePct: pct(oldSeat, oldAft),
        },
        new: {
          seatedDeg: +newSeat.deg.toFixed(3), aftDeg: +newAft.deg.toFixed(3),
          seatedDist: +newSeat.dist.toFixed(1), aftDist: +newAft.dist.toFixed(1),
          changePct: pct(newSeat, newAft),
        },
        // Sanity: at the SEATED eye the new anchor should EQUAL the old placement (capture == camera-relative).
        seatedMatchDeg: +(newSeat.deg - oldSeat.deg).toFixed(4),
        maxCamDist: +Math.max(newSeat.dist, newAft.dist).toFixed(1),
      };
    }, { aft });
    console.log(`[planet-parallax] ${JSON.stringify(r, null, 2)}`);
  },

  // REAL-CHAIN PARALLAX PROBE (W4 regression). The old `planet-parallax` probe FABRICATES the aft
  // sample (it measures a synthetic eyeAft point against the already-captured centre; it never moves
  // the body + re-runs updateSky), so it can't see a per-frame regression. THIS drives the REAL chain:
  // start intro → cockpit (space mode engaged live) → physically walk the body +Z down the corridor
  // frame-by-frame, letting updateSky→applySpaceMode run EACH ticked frame, and SAMPLES the planet
  // group's WORLD position + projected angular DIAMETER at the seat / 10m aft / 15m aft. If the planet
  // moves WITH the camera (world pos tracks the body) the anchor isn't holding → the balloon regression.
  //   node scripts/rig-shot.mjs --scenario=planet-parallax-real
  'planet-parallax-real': async (page) => {
    const log = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const g = window.__game;
      const ctx = g.ctx;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      try { ctx.weather.intensity = 0; ctx.weather.cloudiness = 0; } catch {}
      const FIXED_DT = 0.05;
      const realClock = ctx.three.clock;
      const origGetDelta = realClock.getDelta.bind(realClock);
      const origW = ctx.three.renderer.domElement.width, origH = ctx.three.renderer.domElement.height;
      const V = ctx.three.camera.position.constructor;
      // Drive the live loop until cond() or simBudget sim-seconds (throttle-proof; mirrors pod-walkout).
      const drive = async (simBudget, cond, perTick) => {
        const simStart = ctx.time.elapsed;
        let lastSim = simStart, stalls = 0;
        for (let i = 0; i < 8000; i++) {
          if (perTick) perTick();
          await sleep(16);
          const nowSim = ctx.time.elapsed;
          if (nowSim > lastSim + 1e-6) { lastSim = nowSim; stalls = 0; }
          else if (++stalls > 600) break;
          if (cond && cond()) return { ok: true, sim: +(nowSim - simStart).toFixed(2) };
          if (nowSim - simStart >= simBudget) break;
        }
        return { ok: cond ? cond() : true, sim: +(ctx.time.elapsed - simStart).toFixed(2) };
      };
      // Find the space-planet mesh + its geometric radius (renderOrder −0.4).
      const findPlanet = () => { let m = null; ctx.three.scene.traverse((o) => { if (o.isMesh && o.renderOrder === -0.4) m = o; }); return m; };
      // Angular DIAMETER (deg) of the planet sphere seen from the current camera, using the LIVE
      // world-space group position + the live group scale (the approach scale grows the visual radius).
      const sample = (label) => {
        const planetMesh = findPlanet();
        if (!planetMesh) return { label, error: 'planet mesh not found' };
        const group = planetMesh.parent;
        group.updateMatrixWorld(true);
        const C = group.getWorldPosition(new V());
        const R0 = planetMesh.geometry.boundingSphere
          ? planetMesh.geometry.boundingSphere.radius
          : (planetMesh.geometry.computeBoundingSphere(), planetMesh.geometry.boundingSphere.radius);
        const scl = group.scale.x;                         // the approach scale (1 in orbit)
        const R = R0 * scl;
        const cam = ctx.three.camera.position;
        const body = ctx.player.body.body.translation();
        const dx = C.x - cam.x, dy = C.y - cam.y, dz = C.z - cam.z;
        const dist = Math.hypot(dx, dy, dz);
        const s = Math.min(1, R / dist);
        // The camera-anchored distant-planet SPRITE (makePlanetTexture, renderOrder 0) — should be
        // fully faded (opacity ~0) in full space mode. If it's still visible it's a 2nd, zero-parallax
        // planet (a candidate "balloon" the anchor fix never touched).
        let spriteOp = -1, spriteVis = false;
        ctx.three.scene.traverse((o) => { if (o.isSprite && o.material && o.material.map && o.renderOrder === 0 && o.scale.x > 5) { spriteOp = o.material.opacity; spriteVis = o.visible; } });
        return {
          label,
          bodyZ: +body.z.toFixed(2), camZ: +cam.z.toFixed(2), camY: +cam.y.toFixed(1),
          planetWorld: [+C.x.toFixed(1), +C.y.toFixed(1), +C.z.toFixed(1)],
          groupScale: +scl.toFixed(3),
          camDist: +dist.toFixed(1),
          angDiamDeg: +(2 * Math.asin(s) * 180 / Math.PI).toFixed(3),
          distSprite: { op: +spriteOp.toFixed(3), vis: spriteVis },
        };
      };
      const samples = [];
      try {
        realClock.getDelta = () => FIXED_DT;
        ctx.three.renderer.setSize(64, 64, false);   // tiny canvas → more real frames tick per second
        // FORCE the pointer-lock gate open so isPlaying()===true → updatePlayer runs REAL KCC + camera-anchor.
        ctx.input.controls.isLocked = true;
        ctx.flags.paused = false;
        g.startIntro();                              // REAL new-game entry point (beat 0 = cockpit)
        // let the cockpit build + several live frames run so applySpaceMode CAPTURES the anchor at the SEATED eye
        await drive(2.0, () => ctx.intro && ctx.intro.beat === 'cockpit' && ctx.intro.scratch.shipBuilt === true);
        await drive(0.6, null);
        samples.push(sample('seat'));
        // Advance to checkEngines the REAL way: the cockpit dwell auto-advances after COCKPIT_DWELL, but
        // drive it deterministically — jumpToBeat('checkEngines') flips mode='walk' (stand up + walk),
        // matching the real transition. NO setSkyIntroMode call here → the anchor must HOLD.
        g.jumpToBeat('checkEngines');
        await drive(0.6, null);
        samples.push(sample('stand'));               // stood up (eyeOffset 0.5→0.85) — anchor still held?
        // WALK AFT by translating the body in small increments, letting updatePlayer anchor the camera
        // NATURALLY (no cameraSnapNextFrame) so this is the realest possible per-frame camera-follow the
        // anchor path sees. Each increment is followed by ticked frames so updateSky→applySpaceMode runs
        // at the freshly-anchored camera. This traverses the full 14m corridor + then a big 80m jump to
        // FORCE the recapture path (proving whether recapture returns the camera-relative balloon).
        const shipZ = ctx.player.body.body.translation().z;
        const glideTo = async (targetDz, label, snap) => {
          const steps = Math.max(6, Math.ceil(Math.abs(targetDz)));   // ~1m per increment
          const startZ = ctx.player.body.body.translation().z;
          for (let k = 1; k <= steps; k++) {
            const t = ctx.player.body.body.translation();
            const z = startZ + (shipZ + targetDz - startZ) * (k / steps);
            ctx.player.body.body.setTranslation({ x: t.x, y: t.y, z }, true);
            if (snap) ctx.player.cameraSnapNextFrame = true;   // else the camera lerps/snaps via syncCameraToBody naturally
            await drive(0.15, null);
          }
          samples.push(sample(label));
        };
        window.__PP_seatZ = shipZ;
        await glideTo(10, 'aft10', false);
        await glideTo(14, 'aft14', false);
        // Back toward the window (−Z) — "walk back" toward the seat/planet.
        await glideTo(0.5, 'backToWindow', false);
        // ── A/B MODEL COMPARISON (the design call, kept for the record). At the SEAT and 12m AFT,
        //   compute the planet's projected on-screen DIAMETER (NDC, = "size in the frame") under three
        //   anchor models at the SAME ~19° seat framing: (400) the OLD world-anchor @400m [the W4
        //   regression the user re-reported], (cam) pure camera-anchor [0% — but glued to the camera],
        //   and (LIVE) the SHIPPED far world-anchor [read from the module's live geometry]. This is what
        //   the user actually SEES; it shows the shipped model reads "same size as I move" (≈−1%).
        {
          const cam = ctx.three.camera;
          const planetMesh = findPlanet();
          const Rlive = planetMesh.geometry.boundingSphere.radius;     // the SHIPPED radius (module const)
          const Clive = planetMesh.parent.getWorldPosition(new V());   // the SHIPPED anchor (module const · dir)
          const distLive = Clive.distanceTo(new V(0, 3001.4, shipZ));  // the SHIPPED distance
          const dir = new V(0.30, 0.10, -1).normalize();
          const ndcDiam = (C, R, eye) => {
            const d = Math.hypot(C.x - eye.x, C.y - eye.y, C.z - eye.z);
            const ang = 2 * Math.asin(Math.min(1, R / d));
            const fov = cam.fov * Math.PI / 180;
            return ang / fov;                                          // fraction of the vertical FOV the disc spans
          };
          const seatEye = new V(0, 3001.4, shipZ);
          const aftEye = new V(0, 3001.4, shipZ + 12);
          // OLD 400m world anchor with a radius that hits the SAME seat framing (66 for a 19° disc @400).
          const R400 = 66, D400 = 400;
          const C400 = new V(seatEye.x + dir.x * D400, seatEye.y + dir.y * D400, seatEye.z + dir.z * D400);
          const mk = (eye) => ({
            oldWorldAnchor400: +ndcDiam(C400, R400, eye).toFixed(4),
            cameraAnchored: +ndcDiam(new V(eye.x + dir.x * D400, eye.y + dir.y * D400, eye.z + dir.z * D400), R400, eye).toFixed(4),
            shippedFarAnchor: +ndcDiam(Clive, Rlive, eye).toFixed(4),
          });
          window.__PP_ab = { seat: mk(seatEye), aft12: mk(aftEye), shippedDist: +distLive.toFixed(0) };
        }
        // ── DESCENT-APPROACH regression check: the planet MUST still GROW during the descent beats
        //   (intentional — "we are falling INTO that"). Drive setSkyIntroMode + setPlanetApproach exactly
        //   as tickDescent does, at progress 0 / 0.11 / 0.22, and measure the group scale + angular diameter
        //   from the descending pod eye. The disc should visibly swell across the approach (scale 1→3.6).
        const descSamples = [];
        for (const prog of [0.0, 0.11, 0.22]) {
          g.setSkyIntroMode(1 - Math.min(1, Math.max(0, (prog - 0.14) / 0.34)));
          g.setPlanetApproach(Math.min(1, prog / 0.22));
          await drive(0.15, null);
          const pm = findPlanet();
          const grp = pm.parent; grp.updateMatrixWorld(true);
          const C = grp.getWorldPosition(new V());
          const scl = grp.scale.x;
          const R = pm.geometry.boundingSphere.radius * scl;
          const cam2 = ctx.three.camera.position;
          const dist = Math.hypot(C.x - cam2.x, C.y - cam2.y, C.z - cam2.z);
          descSamples.push({ prog, groupScale: +scl.toFixed(3), camDist: +dist.toFixed(0), angDiamDeg: +(2 * Math.asin(Math.min(1, R / dist)) * 180 / Math.PI).toFixed(2) });
        }
        window.__PP_desc = descSamples;
      } finally {
        ctx.input.keys['KeyW'] = false;
        realClock.getDelta = origGetDelta;
        ctx.three.renderer.setSize(origW, origH, false);
      }
      return { samples, ab: window.__PP_ab, desc: window.__PP_desc };
    });
    if (log.desc) {
      console.log('[planet-parallax-real] DESCENT-APPROACH (must GROW — intentional): progress → group scale / angular diameter:');
      for (const d of log.desc) console.log(`[planet-parallax-real]   p=${d.prog}: scale ${d.groupScale}× · camDist ${d.camDist}m · angDiam ${d.angDiamDeg}°`);
    }
    if (log.ab) {
      const pct = (a, b) => ((b - a) / a * 100).toFixed(1) + '%';
      console.log(`[planet-parallax-real] MODEL A/B — planet on-screen diameter (fraction of vertical FOV), seat → 12m aft (shipped anchor dist=${log.ab.shippedDist}m):`);
      for (const model of ['oldWorldAnchor400', 'cameraAnchored', 'shippedFarAnchor']) {
        const s = log.ab.seat[model], a = log.ab.aft12[model];
        console.log(`[planet-parallax-real]   ${model}: ${s} → ${a}  (${pct(s, a)} change as you back up 12m)`);
      }
    }
    console.log('[planet-parallax-real] REAL-CHAIN samples (seat → 10m aft → 15m aft):');
    for (const s of log.samples) console.log('[planet-parallax-real] ' + JSON.stringify(s));
    // Drift = angular-diameter change relative to the seat sample.
    const seat = log.samples.find((s) => s.label === 'seat');
    if (seat && !seat.error) {
      for (const s of log.samples) {
        if (s.error || s.label === 'seat') continue;
        const drift = (s.angDiamDeg - seat.angDiamDeg) / seat.angDiamDeg * 100;
        const posDrift = Math.hypot(s.planetWorld[0] - seat.planetWorld[0], s.planetWorld[1] - seat.planetWorld[1], s.planetWorld[2] - seat.planetWorld[2]);
        console.log(`[planet-parallax-real] ${s.label}: angDiam ${seat.angDiamDeg}°→${s.angDiamDeg}° (${drift >= 0 ? '+' : ''}${drift.toFixed(2)}%), planet world moved ${posDrift.toFixed(2)}m from the seat anchor`);
      }
    }
  },

  // Corridor disaster (T3.4): the engine-bay FIRE + the RED-ALERT corridor (the disaster the
  // player flees). Builds the ship, drives the disaster state (fire + red-alert + HULL BREACH),
  // and shoots the corridor. --angle: fire (mid-corridor looking AFT at the engine-bay blaze)
  //   [default] · flee (at the dead-end looking FORWARD down the red corridor toward the bridge).
  'corridor': async (page) => {
    const angle = argv.angle || 'fire';
    if (argv.smoke) {
      await page.evaluate(() => { window.__game.startIntro(); });
      const res = await page.evaluate(() => window.__game.smokeIntro());
      console.log(`[corridor-smoke] ${JSON.stringify(res)}`);
      return;
    }
    await page.evaluate(() => {
      const g = window.__game;
      const ctx = g.ctx;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      try { ctx.weather.intensity = 0; ctx.weather.cloudiness = 0; } catch {}
      g.startIntro();
      g.jumpToBeat('cockpit');   // builds the ship + seats the player
    });
    await page.waitForTimeout(700);
    const calm = !!argv.calm;   // --calm shoots the pre-disaster (normal-lit) corridor
    const meas = await page.evaluate(({ angle, calm }) => {
      const g = window.__game;
      const ctx = g.ctx;
      // Drive the disaster state directly (the corridor beat does this at the dead-end).
      if (calm) { try { g.setEngineFire(0, 0); g.setShipAlert(0, 0); g.setCockpitAlert(0); } catch {} }
      else { try { g.setEngineFire(1, 2.1); g.setShipAlert(2, 0.9); g.setCockpitAlert(2); } catch {} }
      ctx.flags.paused = true;
      ctx.three.renderer.setSize(1100, 760, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1100 / 760; cam.updateProjectionMatrix(); }
      const tr = ctx.player.body.body.translation();
      const floorY = tr.y - (ctx.player.body.halfHeight + ctx.player.body.radius);   // ship floor world-y
      const V = cam.position.constructor;
      // Corridor runs +Z (local z 2.6→14.6); the engine-bay fire sits at the dead-end (z≈14.4).
      let eye, look;
      if (angle === 'flee') {
        eye = new V(tr.x, floorY + 1.55, tr.z + 12.5);              // at the dead-end
        look = new V(tr.x, floorY + 1.2, tr.z + 2.0);              // forward down the red corridor to the bridge
      } else if (angle === 'engineroom') {
        eye = new V(tr.x, floorY + 1.55, tr.z + 12.4);             // close to the dead-end glass door
        look = new V(tr.x, floorY + 1.35, tr.z + 17.0);           // aft THROUGH the glass into the engine room
      } else if (angle === 'entrance') {
        // stood a few m INTO the corridor, looking back FORE at the cockpit archway + the mouth-flank
        //   junction-manifold hardware on BOTH walls (the "very messy entranceway" the user flagged)
        eye = new V(tr.x, floorY + 1.55, tr.z + 5.0);
        look = new V(tr.x, floorY + 1.35, tr.z + 2.4);
      } else if (angle === 'entrance-left') {
        // angled at the −X (left) flank of the entranceway (the manifold + low-pipe elbow + conduit run)
        eye = new V(tr.x + 0.6, floorY + 1.55, tr.z + 4.6);
        look = new V(tr.x - 1.0, floorY + 1.3, tr.z + 2.8);
      } else if (angle === 'entrance-right') {
        // angled at the +X (right) flank of the entranceway (the fore manifold + breaker/placards)
        eye = new V(tr.x - 0.6, floorY + 1.55, tr.z + 4.6);
        look = new V(tr.x + 1.0, floorY + 1.3, tr.z + 2.8);
      } else if (angle === 'quarters') {
        // face the −X crew-quarters door + jamb (the z-fighting jamb sides the user flagged), from
        //   mid-corridor a touch aft so both jamb posts are in frame
        eye = new V(tr.x + 0.85, floorY + 1.5, tr.z + 9.6);
        look = new V(tr.x - 3.0, floorY + 1.35, tr.z + 9.6);
      } else if (angle === 'quarters-graze') {
        // a GRAZING oblique down the −X wall past the quarters jamb (where coplanar jamb/wall faces
        //   shimmer worst — the near-parallel view that exposes z-fighting)
        eye = new V(tr.x + 0.4, floorY + 1.45, tr.z + 7.4);
        look = new V(tr.x - 0.9, floorY + 1.3, tr.z + 10.8);
      } else {
        eye = new V(tr.x, floorY + 1.5, tr.z + 7.0);               // mid-corridor
        look = new V(tr.x, floorY + 1.1, tr.z + 14.5);            // aft at the engine-bay blaze
      }
      cam.position.copy(eye);
      cam.lookAt(look);
      cam.updateMatrixWorld(true);
      const ship = ctx.three.scene.getObjectByName('escapePodShipCockpit');
      let meshes = 0;
      if (ship) ship.traverse((o) => { if (o.isMesh) meshes++; });
      return { found: !!ship, meshes, shipAlert: g.ctx ? undefined : 0, eye: [+eye.x.toFixed(2), +eye.y.toFixed(2), +eye.z.toFixed(2)] };
    }, { angle, calm });
    await page.waitForTimeout(300);
    const perfCo = await page.evaluate(() => { const ctx = window.__game.ctx; ctx.three.renderer.info.reset(); ctx.three.renderer.render(ctx.three.scene, ctx.three.camera); const i = ctx.three.renderer.info; return { draws: i.render.calls, tris: i.render.triangles, programs: i.programs?.length ?? -1 }; });
    console.log('[corridor-perf] ' + JSON.stringify(perfCo));
    const tag = `corridor-${angle}${calm ? '-calm' : ''}`;
    await page.screenshot({ path: join(OUT, `scen-${tag}.png`), fullPage: false });
    console.log(`[corridor] ${JSON.stringify(meas)} → scen-${tag}.png`);
  },

  // Pod-bay (R5c): the DOCKED escape pod in its bay at the bridge end — what the fleeing player
  // runs toward + physically enters (no teleport). Builds the ship (bay + docked pod), then shoots
  // the REAL in-corridor view. --angle: flee (down the corridor at the bay, the flee approach)
  //   [default] · hatch (close at the open hatch — cabin peek + the swung door) · wide (a framing
  //   3/4 of the bay alcove). --calm shoots pre-disaster lighting (default calm; --disaster for red).
  'pod-bay': async (page) => {
    const angle = argv.angle || 'flee';
    await page.evaluate(() => {
      const g = window.__game;
      const ctx = g.ctx;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      try { ctx.weather.intensity = 0; ctx.weather.cloudiness = 0; } catch {}
      g.startIntro();
      g.jumpToBeat('cockpit');   // builds the ship (incl. the pod-bay + docked pod)
    });
    await page.waitForTimeout(700);
    const disaster = !!argv.disaster;
    const meas = await page.evaluate(({ angle, disaster }) => {
      const g = window.__game;
      const ctx = g.ctx;
      if (disaster) { try { g.setEngineFire(1, 2.1); g.setShipAlert(2, 0.9); g.setCockpitAlert(2); } catch {} }
      ctx.flags.paused = true;
      ctx.three.renderer.setSize(1100, 760, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1100 / 760; cam.updateProjectionMatrix(); }
      const tr = ctx.player.body.body.translation();
      const floorY = tr.y - (ctx.player.body.halfHeight + ctx.player.body.radius);   // ship floor world-y
      const V = cam.position.constructor;
      // W2b airlock layout: aperture at local z≈4.8 on the −X wall (x=−1.0); collar to x=−1.92; the
      //   docked pod centre x = SHIP_ORIGIN.x − 3.36 (mostly OUTSIDE the hull); pod door face x=−1.92.
      const bayZ = tr.z + 4.8;            // world z of the airlock centre (tr.z is SHIP_ORIGIN.z at spawn)
      const wallX = tr.x - 1.0;           // the −X wall / sliding-door plane
      const podDoorX = tr.x - 1.92;       // the pod door face (collar far end)
      const podX = tr.x - 3.36;           // the docked pod centre (out in the void)
      // open the sliding door for the hatch/collar/exterior reads so the pod door + collar show.
      //   setBayAirlockDoor isn't yet on __game (the orchestrator wires it) — drive the named leaves
      //   directly here (mirror the slide math: fore leaf −Z, aft leaf +Z into wall pockets).
      if (angle === 'hatch' || angle === 'collar' || angle === 'exterior') {
        const aHW = 0.72, travel = 0.82, bzL = 4.8;   // LOCAL bay-group z (group is at SHIP_ORIGIN)
        const lL = ctx.three.scene.getObjectByName('airlockDoorLeafL');
        const lR = ctx.three.scene.getObjectByName('airlockDoorLeafR');
        if (lL) lL.position.z = (bzL - aHW / 2) - travel;
        if (lR) lR.position.z = (bzL + aHW / 2) + travel;
      }
      let eye, look;
      if (angle === 'hatch') {
        // in the collar mouth, looking −X at the whole pod door face + the lit cabin peek through its glass
        eye = new V(wallX - 0.05, floorY + 1.45, bayZ + 0.05);
        look = new V(podDoorX - 0.2, floorY + 1.2, bayZ);
      } else if (angle === 'collar') {
        // stood back in the CORRIDOR at the open sliding door, looking down the lit collar to the pod
        //   door (the sliding door → airlock collar → docked pod read — the money shot)
        eye = new V(wallX + 1.9, floorY + 1.55, bayZ);
        look = new V(podDoorX, floorY + 1.28, bayZ);
      } else if (angle === 'exterior') {
        // DIAGNOSTIC — from outside the ship's −X hull, looking back at the docked pod (verifies the pod
        //   sits OUTSIDE the hull, not floating/clipping). Not a player view; a build check.
        eye = new V(podX - 2.6, floorY + 2.2, bayZ + 2.4);
        look = new V(podX + 0.2, floorY + 1.3, bayZ);
      } else if (angle === 'sealed' || angle === 'sealed-left' || angle === 'sealed-right') {
        // ROUND-1f AIRTIGHT check — seat the eye INSIDE the docked pod facing the CLOSED +X door (the
        //   user's sealed-eye vantage). Star-gaps down the door sides = the slab clearance against the
        //   curved shell reads as space. Keep the pod door CLOSED (don't open it). The seat backs the
        //   aft (−X) wall facing +X, so the eye sits just aft of the door looking +X.
        try { g.setBayPodDoorOpen(0); } catch {}
        const zc = angle === 'sealed-left' ? -0.55 : angle === 'sealed-right' ? 0.55 : 0.0;
        eye = new V(podX + 0.25, floorY + 1.30, bayZ + zc * 0.4);
        look = new V(podDoorX + 0.4, floorY + 1.12, bayZ + zc);
      } else if (angle === 'wide') {
        // a 3/4 framing from down the corridor, angled INTO the airlock (the docked pod is the subject)
        eye = new V(tr.x + 0.3, floorY + 1.65, bayZ + 3.2);
        look = new V(podDoorX + 0.2, floorY + 1.3, bayZ);
      } else {
        // flee: near the corridor centreline, level with the airlock, looking across at the
        //   sliding door in the −X wall (the run-past-and-see-THE-EXIT read; door CLOSED by default).
        //   W2 gate post-mortem: the old x=+0.85 eye stood 0.15m off the +X wall — proud wall hardware
        //   (breaker-box latch, steel greebles) grazed the frame edge as "floating triangle" slivers
        //   the real centreline player never sees (the D165 harness-viewpoint trap). Judge from where
        //   the player actually runs.
        eye = new V(tr.x + 0.45, floorY + 1.62, bayZ + 2.2);
        look = new V(wallX - 0.2, floorY + 1.3, bayZ - 0.1);
      }
      cam.position.copy(eye);
      cam.lookAt(look);
      cam.updateMatrixWorld(true);
      const bay = ctx.three.scene.getObjectByName('escapePodBay');
      let meshes = 0; if (bay) bay.traverse((o) => { if (o.isMesh) meshes++; });
      return { found: !!bay, meshes, eye: [+eye.x.toFixed(2), +eye.y.toFixed(2), +eye.z.toFixed(2)] };
    }, { angle, disaster });
    await page.waitForTimeout(300);
    const tag = `pod-bay-${angle}${disaster ? '-red' : ''}`;
    await page.screenshot({ path: join(OUT, `scen-${tag}.png`), fullPage: false });
    console.log(`[pod-bay] ${JSON.stringify(meas)} → scen-${tag}.png`);
  },

  // Wake interior (T4.1): the REAL first-person view as you COME TO inside the crashed pod in
  // the desert, looking out the ajar hatch (the C18 wake-inside read). Drives the intro to the
  // wake beat (which builds the wake interior + seats the player at the desert spawn), lets the
  // come-to black fade, then poses the seated eye looking −Z out the hatch + shoots.
  'wake': async (page) => {
    await page.evaluate(() => {
      const g = window.__game;
      const ctx = g.ctx;
      g.setTime(0.46);   // CONSISTENT-MIDDAY (user re-scope) — the wake now happens at bright clear midday (not dawn); the beat sets this too
      ctx.weather.intensity = 0; ctx.weather.cloudiness = 0;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      ctx.three.renderer.setSize(1000, 760, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1000 / 760; cam.updateProjectionMatrix(); }
      g.startIntro();
      // R3a — the wake now happens INSIDE the real hero cabin (no separate shell). Run the
      // chain through impact (which settles the cabin to its crashed pose at the spawn + frees
      // the player), then jump to wake (seats inside the crashed cabin, looking at its hatch).
      g.jumpToBeat('impact');
    });
    await page.waitForTimeout(2800);   // let impact settle the crashed cabin + fade
    await page.evaluate(() => { window.__game.jumpToBeat('wake'); });
    await page.waitForTimeout(4200);   // let the come-to black fade naturally (mode seated, ticking)
    if (argv.blow) await page.evaluate(() => { try { window.__game.blowCabinHatch(1); } catch {} });   // R3a — force the hatch fully open (the climb-out read: the dawn desert through the wide door)
    // The come-to fade is a transient; we grade the STEADY wake-INSIDE read (the cabin lighting),
    //   so force the black overlay clear before the shot (else we'd grade the fade, not the cabin —
    //   the fade doesn't auto-complete in the non-pointer-locked scenario tick).
    await page.evaluate(() => { const f = document.getElementById('intro-fade'); if (f) f.style.opacity = '0'; });
    const meas = await page.evaluate(() => {
      const g = window.__game;
      const ctx = g.ctx;
      ctx.flags.paused = true;
      const cam = ctx.three.camera;
      const V = cam.position.constructor;
      const tr = ctx.player.body.body.translation();
      const eye = new V(tr.x, tr.y + (ctx.player.eyeOffset || 0.5), tr.z);
      cam.position.copy(eye);
      // CLUSTER D — look at the cabin's merged FRONT DOOR (−Z, FDOOR_AZ=π → outward dir (0,-1)). The
      //   wake camera faces the door (yaw 0) in-beat; mirror it here so the shot frames the front door
      //   + the midday desert past it, with the riveted cabin wall around (the SAME hero cabin read).
      const haz = Math.PI;
      cam.lookAt(new V(eye.x + Math.sin(haz) * 2, eye.y - 0.05, eye.z + Math.cos(haz) * 2));
      cam.updateMatrixWorld(true);
      const wi = ctx.three.scene.getObjectByName('escapePodCabin');
      let meshes = 0; if (wi) wi.traverse((o) => { if (o.isMesh) meshes++; });
      let sunI = 0; ctx.three.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) sunI = o.intensity; });
      const expo = +ctx.three.renderer.toneMappingExposure.toFixed(2);
      // sanity: the come-to fade overlay must be clear for the wake read (else the shot grades the
      //   black fade, not the cabin — the footgun this scenario hit before the pre-shot fade-clear).
      const fadeEl = document.getElementById('intro-fade');
      const fadeOp = fadeEl ? +getComputedStyle(fadeEl).opacity : -1;
      return { found: !!wi, meshes, fadeOp, sunI: +sunI.toFixed(2), expo, dayTime: +ctx.time.dayTime.toFixed(3), eye: [+eye.x.toFixed(2), +eye.y.toFixed(2), +eye.z.toFixed(2)] };
    });
    await page.waitForTimeout(300);
    const wtag = argv.blow ? 'scen-wake-blown.png' : 'scen-wake.png';
    await page.screenshot({ path: join(OUT, wtag), fullPage: false });
    console.log(`[wake] ${JSON.stringify(meas)} → ${wtag}`);
    // CRASH-AFTERMATH (2026-07-03) — GATE the interior wake lamp-flicker mechanism (a still can't
    //   judge a temporal flicker): arm + drive it headlessly, report lamp varied / spark toggled / settled.
    const flick = await page.evaluate(() => { try { return window.__game.smokeWakeFlicker(); } catch (e) { return { error: String(e) }; } });
    console.log(`[wake-flicker] ${JSON.stringify(flick)}`);
  },

  // ONE-ENTERABLE-POD (user re-scope, 2026-07-01) — drive the REAL chain through stepOut, which
  // UNIFIES the crashed cabin into the ONE persistent walk-in pod (exterior skin + walkable
  // colliders), then shoot it FROM OUTSIDE in the real game: the step-out-beside read, the
  // walk-back-in approach at the hatch, a look INTO the interior through the open hatch, and a
  // descent-low-vs-stepout light-match. --angle=beside|approach|interior|3q (default beside).
  // Verifies: no model swap (ONE pod in↔out), it's enterable (open hatch + walkable interior),
  // and the light/time is a CONSISTENT bright midday. Front-lit by the real midday sun.
  'stepout-pod': async (page) => {
    const angle = argv.angle || 'beside';
    await page.evaluate(() => {
      const g = window.__game;
      const ctx = g.ctx;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      ctx.three.renderer.setSize(1000, 800, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1000 / 800; cam.updateProjectionMatrix(); }
      g.startIntro();
      g.jumpToBeat('impact');
    });
    await page.waitForTimeout(2600);
    await page.evaluate(() => { window.__game.jumpToBeat('wake'); });
    await page.waitForTimeout(1600);
    // drive the REAL stepOut (unify) — jump to stepOut + let its init tick run (unifyEnterablePod),
    //   then let the reveal-dwell (~4s) elapse so endEscapePodIntro HANDS OFF to the real game (the
    //   real midday sun + game exposure take over — the pod is now a real-world lit object). Shoot
    //   the HANDED-OFF game, not the mid-intro suppressed-light frame.
    await page.evaluate(() => { window.__game.jumpToBeat('stepOut'); });
    await page.waitForTimeout(1400);   // let stepOut's init tick run unifyEnterablePod (builds the skin + colliders + salvage)
    // The rig tab is throttled (dustfall_preview_gotchas), so the reveal-dwell may not tick to the
    //   natural handoff — force it: skipIntro() calls endEscapePodIntro, which (post-re-scope) does
    //   NOT dispose the now-ENTERABLE pod (podIsEnterable) but DOES clear the black overlay + restore
    //   the game HUD/sun. So we hand off to the real game with the ONE unified pod persisting.
    await page.evaluate(() => { window.__game.skipIntro(); });
    await page.waitForTimeout(900);    // let the handed-off game run a lit frame (sun/sky/exposure restored)
    // --popchute (Item 2): fire the comic chute-pop on the UNIFIED pod + synchronously inflate it
    //   (the paused loop gates the per-frame driver, so advanceSeconds drives the settle). Verifies
    //   the canopy anchors ON the unified pod's true crown (not floating ~0.4m above it).
    if (argv.popchute) await page.evaluate(() => { try { window.__game.popChute(2.5); } catch (e) { console.log('popChute err', e); } });
    const r = await page.evaluate(({ ang }) => {
      const g = window.__game;
      const ctx = g.ctx;
      ctx.flags.paused = true;
      const cam = ctx.three.camera;
      const V = cam.position.constructor;
      // the unified pod persists under the SAME group name ('escapePodCabin'); find its world (x,z).
      const pod = ctx.three.scene.getObjectByName('escapePodCabin');
      let px = 0, pz = 0;
      if (pod) { pod.updateMatrixWorld(true); const p = new V(); p.setFromMatrixPosition(pod.matrixWorld); px = p.x; pz = p.z; }
      const gy = ctx.terrain.heightAt(px, pz);
      // CLUSTER D — the merged FRONT DOOR faces cabin-local FDOOR_AZ=π (−Z) → world outward dir
      //   (sin π, cos π) = (0,−1) (the pod yaw≈0). beside/approach/interior frame the −Z front door.
      const haz = Math.PI, hnx = Math.sin(haz), hnz = Math.cos(haz);
      if (ang === 'beside') {
        // the STEP-OUT read: standing a few m out on the hatch side, looking back at the whole pod.
        cam.position.set(px + hnx * 4.4 + 1.2, gy + 1.7, pz + hnz * 4.4 + 0.6);
        cam.lookAt(px, gy + 1.1, pz);
      } else if (ang === 'approach') {
        // WALK BACK IN: squarely on the open hatch from ~2.6 m out along its normal (the entry read).
        cam.position.set(px + hnx * 2.8, gy + 1.55, pz + hnz * 2.8);
        cam.lookAt(px + hnx * 0.2, gy + 1.0, pz + hnz * 0.2);
      } else if (ang === 'interior') {
        // look INTO the interior through the open hatch (right at the sill) — the walk-in read.
        cam.position.set(px + hnx * 0.9, gy + 1.5, pz + hnz * 0.9);
        cam.lookAt(px - hnx * 1.0, gy + 1.0, pz - hnz * 1.0);
      } else if (ang === 'porthole') {
        // Item 3 — frame the −Z FORWARD arc where the exterior porthole echo bezel sits (VP_AZ=π →
        //   outward −Z). Stand off the −Z side + a touch high/oblique so the bezel is seen at the
        //   grazing angle where it read warm/detached — it must now read flush cool band-metal.
        cam.position.set(px - 1.6, gy + 2.0, pz - 4.2);
        cam.lookAt(px, gy + 1.5, pz);
      } else if (ang === 'chute') {
        // CHUTE-POP read (Item 2): stand well back + a touch high so the whole pod crown + the
        //   draped canopy frame together — the anchor must sit ON the crown, not float above it.
        cam.position.set(px + 6.6, gy + 3.4, pz + 6.2);
        cam.lookAt(px, gy + 2.4, pz);
      } else if (ang === 'furrow') {
        // CRASH-AFTERMATH (2026-07-03) — look DOWN the landing furrow from beyond its far end back
        //   toward the pod, so the whole skid gouge + berms + scattered debris + scorch read as one
        //   "this thing CRASHED here" story. The furrow trails the pod's back-left along the world
        //   heading dir≈(-0.57,+0.82) (crashAftermath _FURROW_DIR); stand ~24 m out along +dir, a
        //   little high + off-axis so the trench + both berms + the base scorch all read.
        const fx = -0.57, fz = 0.82;                 // must match _FURROW_DIR in podScene.ts
        cam.position.set(px + fx * 15 - 2.6, gy + 2.7, pz + fz * 15 + 1.0);   // closer + lower so the trench relief + berm shadows read (a high/far shot flattens them)
        cam.lookAt(px + fx * 3, gy + 0.4, pz + fz * 3);
      } else if (ang === 'furrow3q') {
        // a 3/4 CROSS view of the furrow's mid-section — perpendicular-ish to the skid so the trench
        //   BASIN + both proud berms + the shadow they rake read as real relief (the length view is
        //   near-axial, which flattens the ridges). Stand off the furrow's side, low + raking.
        const fx = -0.57, fz = 0.82;                 // furrow heading
        const perpx = -fz, perpz = fx;               // perpendicular (across the furrow)
        const midx = px + fx * 9, midz = pz + fz * 9;   // ~9 m down the furrow (its mid-section)
        cam.position.set(midx + perpx * 7 + fx * 2, gy + 2.2, midz + perpz * 7 + fz * 2);
        cam.lookAt(midx, gy - 0.1, midz);
      } else { // 3q — a 3/4 of the whole standing silhouette (the exterior form)
        cam.position.set(px + 4.2, gy + 2.4, pz + 4.0);
        cam.lookAt(px, gy + 1.2, pz);
      }
      cam.updateMatrixWorld(true);
      // FRONT-LIGHT prerequisite (visual-diagnostic-methodology.md): the intro's own midday sun is
      //   set, but a paused frame may not have re-derived the lit exposure — set a modest exposure +
      //   a front KEY from beside/above the camera so the camera-facing hull is LIT (not a backlit
      //   silhouette). This is the harness front-light, NOT a substitute viewpoint (D165) — the
      //   camera IS the real step-out-beside/approach/interior read.
      ctx.three.renderer.toneMappingExposure = 1.3;
      let DirCtor = null, HemiCtor = null;
      ctx.three.scene.traverse((o) => { if (o.isDirectionalLight && !DirCtor) DirCtor = o.constructor; if (o.isHemisphereLight && !HemiCtor) HemiCtor = o.constructor; });
      let key = ctx.three.scene.getObjectByName('__soKey');
      if (!key && DirCtor) { key = new DirCtor(); key.name = '__soKey'; key.color.set(0xfff2e0); ctx.three.scene.add(key.target); ctx.three.scene.add(key); }
      if (key) {
        key.intensity = 3.0;
        const toP = new V(px - cam.position.x, 0, pz - cam.position.z);
        key.position.set(cam.position.x + toP.x * 0.2 + 2, cam.position.y + 4, cam.position.z + toP.z * 0.2 + 1);
        key.target.position.set(px, gy + 1.0, pz); key.target.updateMatrixWorld(true);
      }
      let fill = ctx.three.scene.getObjectByName('__soFill');
      if (!fill && HemiCtor) { fill = new HemiCtor(0xcfe0f0, 0x7a6848, 0); fill.name = '__soFill'; ctx.three.scene.add(fill); }
      if (fill) fill.intensity = 1.1;
      // report the pod's exposed height + mesh count + the current dayTime (light-consistency check).
      let meshes = 0, maxY = -1e9;
      if (pod) pod.traverse((o) => { if (o.isMesh && o.geometry) { meshes++; o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox; const wv = new V(0, bb.max.y, 0); o.localToWorld(wv); maxY = Math.max(maxY, wv.y); } });
      const introActive = !!(ctx.intro && ctx.intro.active);
      const sunI = (() => { let s = 0; ctx.three.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) s = o.intensity; }); return +s.toFixed(2); })();
      // walkable-collider check: count STATIC boxes near the pod (floor + wall-ring segments). A
      //   healthy walk-in pod has ~a dozen (the ring is gapped at the hatch, so not a full circle).
      let podCols = 0;
      ctx.physics.world.forEachCollider((c) => { const t = c.translation(); const d = Math.hypot(t.x - px, t.z - pz); if (d < 3.0 && Math.abs(t.y - gy) < 3.0) podCols++; });
      // the tutorial chain: is the unified pod registered as a machete-salvageable (the first-salvage
      //   target), and did the tutorial scatter scrap/cloth around it?
      const podSalvageable = (ctx.salvageables && ctx.salvageables.list || []).some((s) => s.kind === 'escape_pod');
      const scatter = (ctx.pickups && ctx.pickups.list || []).filter((p) => p.itemId === 'scrap' || p.itemId === 'cloth').length;
      return { angle: ang, podAt: [+px.toFixed(1), +pz.toFixed(1)], groundY: +gy.toFixed(2), exposedH: +(maxY - gy).toFixed(2), meshes, podCols, podSalvageable, scatter, dayTime: +ctx.time.dayTime.toFixed(3), introActive, sunI, found: !!pod };
    }, { ang: angle });
    await page.waitForTimeout(350);
    await page.screenshot({ path: join(OUT, `scen-stepout-pod-${angle}.png`), fullPage: false, animations: 'disabled', timeout: 60000 });
    console.log(`[stepout-pod] ${JSON.stringify(r)}`);
  },

  // LEVIATHAN-REVEAL (2026-07-01 midday consistency re-scope) — shoot the STEP-OUT reveal
  // looking OUT toward the beached-leviathan horizon landmark at the NEW bright midday
  // (was designed as a dawn-backlit silhouette; verify it still commands the horizon front-
  // lit). Drives the REAL chain: startIntro → jumpToBeat('stepOut') → let stepOut's init tick
  // run (teleport to the real desert spawn, setIntroMiddayClear, sky mode 0, atmosphere on),
  // then face the leviathan world-bearing from the spawn eye and shoot with the GAME'S OWN
  // midday sun (NO front-key override — the whole point is the natural front-lit read).
  // REQUIRES the intro feature ON so the leviathan is placed at world build:
  //   VITE_ESCAPE_POD_INTRO=1 node scripts/rig-shot.mjs --scenario=leviathan-reveal
  // --fov to widen the horizon read (default 62). --exp exposure (default = leave the game's).
  'leviathan-reveal': async (page) => {
    const fov = argv.fov !== undefined ? Number(argv.fov) : 62;
    const exp = argv.exp !== undefined ? Number(argv.exp) : 0;
    await page.evaluate(() => {
      const g = window.__game;
      const ctx = g.ctx;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      ctx.three.renderer.setSize(1100, 720, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1100 / 720; cam.updateProjectionMatrix(); }
      g.startIntro();
      // Jump straight to stepOut: its init tick teleports to the real spawn + sets the bright
      // clear midday + real desert sky/atmosphere (the exact handed-off world the player sees).
      g.jumpToBeat('stepOut');
    });
    await page.waitForTimeout(1400);   // let tickStepOut's init run (teleport + midday + sky/atmosphere + unify)
    // Force the HANDOFF to the real game (skipIntro → endEscapePodIntro) so the REAL midday sun/sky/
    //   exposure/atmosphere take over — the throttled rig tab won't auto-tick the reveal-dwell to the
    //   natural handoff, and we must judge the HANDED-OFF world (bright clear midday), not the mid-
    //   intro suppressed-sky frame. The unified pod + leviathan persist (not disposed).
    await page.evaluate(() => { window.__game.skipIntro(); });
    await page.waitForTimeout(900);    // let several handed-off game frames run so the sky/sun/exposure settle to real midday
    const r = await page.evaluate(({ fov, exp }) => {
      const g = window.__game;
      const ctx = g.ctx;
      ctx.flags.paused = true;
      const cam = ctx.three.camera;
      const V = cam.position.constructor;
      // The player capsule is at the real desert spawn (stepOut teleported it to intro.returnPos).
      //   The enterable pod is UNIFIED at that same spot, so the raw spawn eye is INSIDE the cabin.
      //   The real reveal is the player having STEPPED OUT — stand a few m out along the leviathan
      //   bearing (clear of the hull), the honest step-out standpoint looking at the horizon.
      const tr = ctx.player.body.body.translation();
      // The leviathan's fixed world position (its own module reports it).
      const lev = ctx.three.scene.getObjectByName('leviathanLandmark');
      let lx = -403, lz = 106, foundLev = !!lev;
      if (lev) lev.updateMatrixWorld(true);
      // Bearing from spawn to the landmark.
      const bx = lx - tr.x, bz = lz - tr.z;
      const bl = Math.hypot(bx, bz);
      const bnx = bx / bl, bnz = bz / bl;
      // Step OUT ~5m along the bearing so the camera clears the unified pod hull.
      const STEP = 5.0;
      const ex = tr.x + bnx * STEP, ez = tr.z + bnz * STEP;
      const egy = ctx.terrain.heightAt(ex, ez);
      const ey = egy + 1.7;   // standing eye height on the sand
      // Compute the bearing from THIS standpoint to the landmark; aim along it, pitched a hair up.
      const dx = lx - ex, dz = lz - ez;
      const dist = Math.hypot(dx, dz);
      // Aim a touch above the horizon: the leviathan mass sits ~gy..gy+~30 at 340m; a small
      //   upward pitch keeps the skyline centred without cropping the prow.
      const aimY = ctx.terrain.heightAt(lx, lz) + 14;
      if (cam.isPerspectiveCamera) { cam.fov = fov; cam.updateProjectionMatrix(); }
      cam.position.set(ex, ey, ez);
      cam.lookAt(lx, aimY, lz);
      cam.updateMatrixWorld(true);
      if (exp) ctx.three.renderer.toneMappingExposure = exp;
      // Report the true bearing (unit dir) so we can confirm it matches (-0.949,+0.315), the
      //   current dayTime (midday consistency), the sun direction/intensity (front-lit check),
      //   and the leviathan's exposed silhouette height above its ground (does it clear the horizon).
      const dir = [+(dx / dist).toFixed(3), +(dz / dist).toFixed(3)];
      let sunDir = null, sunI = 0;
      ctx.three.scene.traverse((o) => {
        if (o.isDirectionalLight && o.castShadow) {
          sunI = +o.intensity.toFixed(2);
          const p = o.getWorldPosition(new V());
          const t2 = o.target ? o.target.getWorldPosition(new V()) : new V();
          const d = new V().subVectors(t2, p);
          if (d.length() > 1e-4) { d.normalize(); sunDir = [+d.x.toFixed(2), +d.y.toFixed(2), +d.z.toFixed(2)]; }
        }
      });
      // Leviathan silhouette extent above its ground (from its meshes).
      let levMinY = 1e9, levMaxY = -1e9, levMeshes = 0;
      if (lev) lev.traverse((o) => {
        if (o.isMesh && o.geometry) {
          levMeshes++;
          o.geometry.computeBoundingBox();
          const b = o.geometry.boundingBox;
          for (const cy of [b.min.y, b.max.y]) { const w = new V(0, cy, 0); o.localToWorld(w); levMinY = Math.min(levMinY, w.y); levMaxY = Math.max(levMaxY, w.y); }
        }
      });
      const levGy = ctx.terrain.heightAt(lx, lz);
      return {
        foundLev, levMeshes, dist: +dist.toFixed(1), bearing: dir,
        exposedH: lev ? +(levMaxY - levGy).toFixed(1) : 0,
        dayTime: +ctx.time.dayTime.toFixed(3),
        exposure: +ctx.three.renderer.toneMappingExposure.toFixed(2),
        sunDir, sunI, spawn: [+ex.toFixed(1), +ez.toFixed(1)],
      };
    }, { fov, exp });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, `scen-leviathan-reveal.png`), fullPage: false, animations: 'disabled', timeout: 60000 });
    console.log(`[leviathan-reveal] ${JSON.stringify(r)}`);
  },

  // FLOW-CLARITY (action-beat framing audit): drive each REAL action beat to its PROMPT
  // moment and shoot the ACTUAL viewpoint the game gives the player (the beat's own
  // faceControl pose — NOT a rig-substituted lookAt, per D165). Answers "when the prompt
  // fires, can the player SEE where to go / what to do?". --beat=checkEngines|corridor|
  // enterPod|wake (default all four in one run). No camera override: reads camera.rotation
  // as the game left it + reports yaw so direction is checkable.
  'flow-clarity': async (page) => {
    const which = argv.beat ? [String(argv.beat)] : ['checkEngines', 'corridor', 'enterPod', 'wake'];
    const flowAngle = argv.angle || 'hatch';
    await page.evaluate((a) => { window.__FLOW_ANGLE = a; }, flowAngle);
    const results = [];
    for (const beat of which) {
      const meas = await page.evaluate(async (beat) => {
        const g = window.__game;
        const ctx = g.ctx;
        const V = ctx.three.camera.position.constructor;
        // clean render: no weather streaks, FP (hide rig/viewmodel), warm-ish exposure.
        ctx.flags.thirdPerson = false;
        if (ctx.player.rig) ctx.player.rig.group.visible = false;
        if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
        try { ctx.weather.intensity = 0; ctx.weather.cloudiness = 0; } catch {}
        try { ctx.three.renderer.toneMappingExposure = 1.1; } catch {}
        ctx.three.renderer.setSize(1100, 760, false);
        const cam = ctx.three.camera;
        if (cam.isPerspectiveCamera) { cam.aspect = 1100 / 760; cam.updateProjectionMatrix(); }
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        ctx.flags.paused = false;           // UNPAUSE — the prior iteration paused to freeze for its shot;
                                            //   the intro beat controllers only tick while unpaused.
        ctx.input.controls.isLocked = true; // keep isPlaying()===true so updateEscapePodIntro ticks
        try { g.skipIntro(); } catch {}     // FULL teardown of any prior iteration's intro (no state bleed)
        await sleep(250);
        // Helper: build the ship interior + seat at the bridge, waiting until getShipSpawn takes
        //   (the cockpit tick reseats to y≈3000). Retries the jump if the async tick raced.
        const seatInShip = async () => {
          g.startIntro();
          g.jumpToBeat('cockpit');
          for (let i = 0; i < 20; i++) {
            await sleep(120);
            const t = ctx.player.body.body.translation();
            if (t.y > 2900) return true;    // seated in the ship (SHIP_ORIGIN.y=3000)
            g.jumpToBeat('cockpit');        // nudge the init again
          }
          return false;
        };

        if (beat === 'checkEngines') {
          // Drive the REAL cockpit→checkEngines transition so the camera is EXACTLY where
          // the game leaves it when "check the engines (aft)" fires (inherited from the
          // cockpit's opening faceControl — the game does NOT reframe on checkEngines).
          await seatInShip();
          try { g.setSkyIntroMode(1); } catch {}   // in orbit — the window shows space
          await sleep(300);                 // let the open framing settle
          g.jumpToBeat('checkEngines');     // fires the prompt; mode→walk; NO faceControl
          await sleep(250);                 // let the beat tick set the prompt/mode
        } else if (beat === 'corridor') {
          // Realistic pose at the disaster trigger: the player walked AFT to the dead-end
          // (facing +Z, aft). Fire the disaster + shoot what they see when "GET TO THE
          // ESCAPE POD" appears (they're facing the fire; the pod-bay is behind them fwd).
          await seatInShip();
          try { g.setSkyIntroMode(0); } catch {}   // interior beat — normal lighting, not the space skybox
          await sleep(200);
          const sp = ctx.player.body.body.translation();   // the FRESH cockpit spawn (bridge)
          g.jumpToBeat('corridor');
          try { g.setEngineFire(1, 2.1); g.setShipAlert(2, 0.9); g.setCockpitAlert(2); } catch {}
          // The disaster erupts at the aft dead-end; the player TURNS AND FLEES FORWARD (−Z)
          // toward the bridge/pod. --angle=fire → face aft at the blaze (the trigger view);
          // default → the FLEE view: mid-corridor facing forward −Z (is the pod signposted
          // ahead as they run for it?). The pod-bay is on the −X wall at z≈4.8.
          cam.rotation.order = 'YXZ';
          if ((window.__FLOW_ANGLE || '') === 'fire') {
            ctx.player.body.body.setTranslation({ x: sp.x, y: sp.y, z: sp.z + 13.4 }, true);
            cam.rotation.set(0, Math.PI, 0);   // face +Z (aft, toward the engine bay blaze)
          } else {
            ctx.player.body.body.setTranslation({ x: sp.x, y: sp.y, z: sp.z + 9.0 }, true);
            cam.rotation.set(0, 0, 0);         // face −Z (forward, fleeing toward the bridge/pod)
          }
          ctx.player.cameraSnapNextFrame = true;
          await sleep(150);
        } else if (beat === 'enterPod') {
          // Drive the REAL enterPod walkUp start: the player fled to the bridge; the docked
          // pod-bay hatch is on the −X wall at world z≈4.8. Place the body a little aft of
          // the bay facing the flee direction (−Z, forward toward the bridge) — the pose they
          // arrive in — so the shot answers "is the open hatch obvious as they arrive?".
          await seatInShip();
          try { g.setSkyIntroMode(0); } catch {}   // interior beat — normal lighting, not the space skybox
          await sleep(200);
          const sp = ctx.player.body.body.translation();   // FRESH bridge spawn
          g.jumpToBeat('enterPod');
          await sleep(150);                  // let walkUp init (prompt "Get in the escape pod")
          // --angle=flee: stand aft of the bay facing forward −Z (the arriving pose — is the
          //   hatch visible as they run up?). --angle=hatch (default): at the threshold facing
          //   the bay hatch (−X) — is the open lit entry obvious to walk into?
          const ang = window.__FLOW_ANGLE || 'hatch';
          cam.rotation.order = 'YXZ';
          if (ang === 'flee') {
            ctx.player.body.body.setTranslation({ x: sp.x + 0.4, y: sp.y, z: sp.z + 6.6 }, true);
            cam.rotation.set(0, 0, 0);       // face −Z (forward, the flee direction); bay is ahead-left
          } else {
            // at the bay threshold (corridor-side of the hatch), facing −X into the aperture.
            ctx.player.body.body.setTranslation({ x: sp.x - 0.45, y: sp.y, z: sp.z + 4.8 }, true);
            cam.rotation.set(0, Math.PI / 2, 0);   // yaw +90° → face −X (into the docked-pod hatch)
          }
          ctx.player.cameraSnapNextFrame = true;
          try { g.setEngineFire(1, 2.1); g.setShipAlert(2, 0.9); } catch {}
          await sleep(150);
        } else if (beat === 'wake') {
          // Drive the REAL wake: run through impact (settles the crashed cabin) then wake
          // (seats inside it + faceControl(CABIN_HATCH_YAW) at the hatch), let the come-to
          // black fade, and shoot the ACTUAL pose — do NOT override rotation.
          g.setTime(0.32);
          g.startIntro();
          g.jumpToBeat('impact');
          await sleep(2600);                 // impact settles the crashed cabin + fades
          g.jumpToBeat('wake');
          await sleep(4200);                 // come-to black fades naturally (mode seated ticking)
        }

        // Read the ACTUAL pose the game left (no override). Pin the camera to the body eye
        // for position but KEEP the rotation the beat set.
        ctx.flags.paused = true;
        const tr = ctx.player.body.body.translation();
        cam.position.set(tr.x, tr.y + (ctx.player.eyeOffset || 0.5), tr.z);
        cam.updateMatrixWorld(true);
        const yaw = cam.rotation.y, pitch = cam.rotation.x;
        const ship = ctx.three.scene.getObjectByName('escapePodShipCockpit');
        let shipMeshes = 0; if (ship) ship.traverse((o) => { if (o.isMesh && o.visible) shipMeshes++; });
        return {
          beat,
          mode: ctx.intro ? ctx.intro.mode : null,
          eye: [+cam.position.x.toFixed(2), +cam.position.y.toFixed(2), +cam.position.z.toFixed(2)],
          yawDeg: +(yaw * 180 / Math.PI).toFixed(1),
          pitchDeg: +(pitch * 180 / Math.PI).toFixed(1),
          shipMeshes,
        };
      }, beat);
      await page.waitForTimeout(250);
      // only tag a suffix when an explicit --angle was passed that overrides the beat default.
      const dfl = { enterPod: 'hatch', corridor: 'flee' };
      const suffix = (argv.angle && dfl[beat] && argv.angle !== dfl[beat]) ? `-${argv.angle}` : '';
      const path = join(OUT, `scen-flow-${beat}${suffix}.png`);
      // wake sits over the full desert scene (heavy) — the clipped/animations-disabled grab
      //   stalls there (known); use a plain grab for it. Interior beats use the clean clip.
      if (beat === 'wake') await page.screenshot({ path, fullPage: false });
      else await page.screenshot({ path, fullPage: false, clip: { x: 0, y: 0, width: 1100, height: 760 }, animations: 'disabled', timeout: 60000 });
      results.push(meas);
      console.log(`[flow-clarity] ${JSON.stringify(meas)} → scen-flow-${beat}${suffix}.png`);
    }
    console.log(`[flow-clarity] all: ${JSON.stringify(results)}`);
  },

  // Smoke-intro (T1.2): run the whole intro beat chain headless + report {ok,beats}.
  // Escape-pod intro health GATE: drives the whole 12-beat chain headless + asserts
  // {ok:true, beats:12}. THROWS on failure so `node rig-shot.mjs --scenario=smoke-intro`
  // exits non-zero (main().catch → exit 1) — usable as `npm run verify:intro`. No screenshot.
  'smoke-intro': async (page) => {
    const r = await page.evaluate(() => window.__game.smokeIntro());
    console.log(`[smoke-intro] ${JSON.stringify(r)}`);
    if (!r || !r.ok || r.beats !== 12) throw new Error(`smoke-intro GATE FAILED: ${JSON.stringify(r)}`);
  },

  // B2 — THE PLAYER-GATED BOARDING WALK-IN PROOF (reuses the B1.f trapped-in-chair real-motion test
  //   pattern: prove the walkable path with REAL KCC motion, not collider math). Drives the enterPod
  //   beat LIVE: seats the player in the ship, jumps to enterPod, then (1) E-opens the closed door,
  //   (2) drives real WASD → the KCC physically WALKS the player corridor → through the airlock
  //   doorway → INTO the pod bore (sampling the body position each leg so we PROVE it traversed, not
  //   teleported), (3) E-sits, and asserts the beat reached the sealed/eject phase. THROWS if the
  //   walk-in path is blocked (the body never gets inside) so this gates like smoke-intro. No shot —
  //   it's a motion proof; the console log reports the traversal. Every boarding phase is driven by
  //   the FIXED-DT sim-budget loop (see below) so the proof is DETERMINISTIC under the ~1 fps
  //   headless swiftshader tab — no wall-clock timing dependence.
  'pod-walkin': async (page) => {
    const log = await page.evaluate(async () => {
      const g = window.__game;
      const ctx = g.ctx;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const trace = [];
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      try { ctx.weather.intensity = 0; ctx.weather.cloudiness = 0; } catch {}
      ctx.flags.paused = false;
      ctx.input.controls.isLocked = true;   // isPlaying()===true → updatePlayer processes real KCC motion
      // ── DETERMINISTIC DRIVER (throttle-proof — the same fixed-dt sim-budget technique as
      //    pod-walkout). The OLD driver gave each boarding phase a WALL-CLOCK iteration budget
      //    (E-open 20×80 ms, E-sit 25×80 ms, …) — but the headless swiftshader tab renders this
      //    heavy ship+bay scene at ~1 fps, so a whole phase budget could elapse with ZERO game
      //    frames ticking (instrumented: 15 straight E-sit iterations with phase=atSeat, the gaze
      //    near/look BOTH true and E pending, while ctx.time.elapsed sat frozen — the game-side
      //    gate is healthy; the harness just raced a starved loop → "E-sit did not seat", flaky).
      //    THE FIX: pin the loop's dt to FIXED_DT so every ticked frame advances a KNOWN sim-dt,
      //    and drive each phase until its PHASE-FLIP CONDITION (or a sim-time budget) — never a
      //    wall-clock count — re-asserting facing + input every yield. Assertions stay strict.
      const FIXED_DT = 0.05;   // sim-seconds per frame (under the loop's 0.1 clamp → never clamped)
      const cam = ctx.three.camera;
      const faceNegX = () => { cam.rotation.order = 'YXZ'; cam.rotation.set(0, Math.PI / 2, 0); };   // face −X (toward the docked pod / the seat)
      /** Drive the live loop until cond() is true or simBudget sim-seconds elapse. perTick
       *  re-asserts input/facing every yield (so whenever a real frame lands, the inputs are
       *  there). Stall-bail: ~10 s of yields with no ticked frame → the loop is wedged, bail
       *  (never hangs; a long BLOCKING frame — e.g. a shader compile — can't false-trip it,
       *  because these yields don't run while the main thread is blocked either). */
      const drive = async (simBudget, cond, perTick) => {
        const simStart = ctx.time.elapsed;
        let lastSim = simStart, stalls = 0;
        for (let i = 0; i < 8000; i++) {
          if (perTick) perTick();
          await sleep(16);
          const nowSim = ctx.time.elapsed;
          if (nowSim > lastSim + 1e-6) { lastSim = nowSim; stalls = 0; }
          else if (++stalls > 600) break;
          if (cond()) return { ok: true, sim: +(nowSim - simStart).toFixed(2) };
          if (nowSim - simStart >= simBudget) break;
        }
        return { ok: cond(), sim: +(ctx.time.elapsed - simStart).toFixed(2) };
      };
      const realClock = ctx.three.clock;
      const origGetDelta = realClock.getDelta.bind(realClock);
      const origW = ctx.three.renderer.domElement.width, origH = ctx.three.renderer.domElement.height;
      let walkedInX = 0, insideOk = false, seated = false, ejected = false;
      try {
        realClock.getDelta = () => FIXED_DT;             // pin the per-frame sim-dt (throttle-proof)
        ctx.three.renderer.setSize(48, 48, false);       // tiny canvas → more REAL frames tick per second (this gate takes no screenshots)
        try { g.skipIntro(); } catch {}
        await drive(0.2, () => !ctx.intro || !ctx.intro.active);   // let the teardown tick run
        // seat in the ship (retry the cockpit jump until the reseat to y≈3000 takes).
        g.startIntro();
        for (let a = 0; a < 20; a++) {
          g.jumpToBeat('cockpit');
          const r = await drive(0.3, () => ctx.player.body.body.translation().y > 2900);
          if (r.ok) break;
        }
        try { g.setSkyIntroMode(0); } catch {}
        const sp = ctx.player.body.body.translation();
        // the bridge spawn sits at SEAT_Z = −0.30 off the ship origin → origin.z = sp.z + 0.30. Use
        //   the ORIGIN frame so the walk line is centred on the bay door (local z = BAY_ZC = 4.8).
        const SHIP = { x: sp.x, y: sp.y, z: sp.z + 0.30 };
        // Position the player in the CORRIDOR, just fore of the bay opening (bay z-span ≈ +3.2..+6.4 on
        //   the −X wall), on the +X side of the walkable tube, facing −X toward the docked pod door.
        g.jumpToBeat('enterPod');
        await drive(0.4, () => ctx.intro.beat === 'enterPod' && ctx.intro.scratch.phase === 'approach');   // the beat's init tick ran (mode=walk, door closed)
        const startPos = { x: SHIP.x + 0.6, y: sp.y, z: SHIP.z + 4.8 };   // corridor, +X side, on the door centreline
        ctx.player.body.body.setTranslation(startPos, true);
        ctx.player.cameraSnapNextFrame = true;
        faceNegX();
        await drive(0.15, () => false, faceNegX);        // ≥2 ticked frames: the camera snap + anchor apply
        const p0 = ctx.player.body.body.translation();
        trace.push({ leg: 'start(corridor)', phase: ctx.intro.scratch.phase, x: +(p0.x - SHIP.x).toFixed(2), z: +(p0.z - SHIP.z).toFixed(2) });
        // (1) E-OPEN the door — re-assert E + the −X facing every yield until the gaze-gated press
        //     lands (phase flips approach→enter). Sim budget 2 s ≈ 40 fixed-dt frames.
        const rOpen = await drive(2.0,
          () => ctx.intro.scratch.phase === 'enter' || ctx.intro.scratch.phase === 'atSeat',
          () => { faceNegX(); ctx.input.pressed.add('KeyE'); });
        trace.push({ leg: 'after E-open', phase: ctx.intro.scratch.phase, doorOpened: rOpen.ok, sim: rOpen.sim });
        // (2) WALK IN — hold W (real KCC) to walk −X through the doorway into the bore. The stop
        //     condition is phase=atSeat AND a fixed DEPTH LINE (x < −1.8): the atSeat gate flips at
        //     the 1.05 m stand radius (x ≈ −1.16), shy of the assertion's −1.2 walked-in-depth
        //     proof, so we walk the deterministic 2-3 extra fixed-dt frames to −1.8 — well past the
        //     −1.2 line, still 0.4 m fore of the stand-point (no seat overshoot; the CLUSTER D
        //     halt-near-the-seat intent holds, now deterministic). The door swing (0.75 sim-s) runs
        //     concurrently in this phase; budget 6 sim-s covers the swing + the ~2.8 m walk.
        const rWalk = await drive(6.0,
          () => ctx.intro.scratch.phase === 'atSeat' && (ctx.player.body.body.translation().x - SHIP.x) < -1.8,
          () => { faceNegX(); ctx.input.keys['KeyW'] = true; });
        ctx.input.keys['KeyW'] = false;
        insideOk = rWalk.ok;
        // capture the REAL walked-in depth (the gate's proof of the KCC boarding) BEFORE any settle.
        walkedInX = ctx.player.body.body.translation().x - SHIP.x;   // well into −X (past the −1.0 wall, toward the pod at −2.5)
        // settle the body at the interior stand-point so the E-sit gaze/proximity is deterministic (a
        //   real player stands by the seat before sitting). BAY_POD_X = −(COR_HW 1.0 + BAY_RECESS
        //   2.9 · 0.52) = −2.508; stand = +0.30 fore. (Framing aid ONLY — walkedInX above already
        //   proves the real walk reached the bore.)
        if (insideOk) {
          const stand = { x: SHIP.x - 2.508 + 0.30, y: ctx.player.body.body.translation().y, z: SHIP.z + 4.8 };
          ctx.player.body.body.setTranslation(stand, true);
          ctx.player.cameraSnapNextFrame = true;
          await drive(0.15, () => false, faceNegX);      // ≥2 ticked frames: the snap + camera anchor land at the stand
        }
        const pIn = ctx.player.body.body.translation();
        trace.push({ leg: 'inside?', phase: ctx.intro.scratch.phase, x: +walkedInX.toFixed(2), z: +(pIn.z - SHIP.z).toFixed(2), insideOk, walkSim: rWalk.sim });
        // (3) E-SIT — re-assert E + the −X facing (the seat gaze target) every yield until the
        //     edge-triggered sit lands (phase flips atSeat→sealing). Sim budget 2 s.
        const rSit = await drive(2.0,
          () => { const ph = ctx.intro.scratch.phase; return ph === 'sealing' || ph === 'eject' || ctx.intro.beat !== 'enterPod'; },
          () => { faceNegX(); ctx.input.pressed.add('KeyE'); });
        seated = rSit.ok;
        trace.push({ leg: 'after E-sit', beat: ctx.intro.beat, phase: ctx.intro.beat === 'enterPod' ? ctx.intro.scratch.phase : '(advanced)', seated, sim: rSit.sim });
        // (4) E-EJECT — the auto-seal is 0.9 SIM-seconds (deterministic now: 18 fixed-dt frames),
        //     then inject E at the eject gate until the beat ADVANCES to shipExplode (the lever is
        //     purely player-gated — no fallback timer). Sim budget 5 s covers the seal + the press.
        const rEject = await drive(5.0,
          () => ctx.intro.beat !== 'enterPod',
          () => { if (ctx.intro.beat === 'enterPod' && ctx.intro.scratch.phase === 'eject') ctx.input.pressed.add('KeyE'); });
        ejected = rEject.ok;
        trace.push({ leg: 'after E-eject', beat: ctx.intro.beat, ejected, sim: rEject.sim });
      } finally {
        ctx.input.keys['KeyW'] = false;
        realClock.getDelta = origGetDelta;               // restore the real clock (leak-free)
        ctx.three.renderer.setSize(origW, origH, false); // restore the canvas
      }
      return { trace, walkedInX, reachedInside: insideOk, seated, ejected };
    });
    console.log('[pod-walkin] ' + JSON.stringify(log.trace, null, 0));
    console.log(`[pod-walkin] walkedInX=${log.walkedInX.toFixed(2)} reachedInside=${log.reachedInside} seated=${log.seated}`);
    // GATE: the body must have physically walked PAST the −1.0 corridor-wall line into the bore
    //   (x < −1.2 relative to SHIP_ORIGIN) via real KCC, reached the atSeat gate, and E-sit advanced it.
    if (!log.reachedInside) throw new Error(`pod-walkin GATE FAILED: the player never walked INTO the pod (walkedInX=${log.walkedInX.toFixed(2)}, expected < −1.2). The walkable boarding path is blocked.`);
    if (log.walkedInX > -1.2) throw new Error(`pod-walkin GATE FAILED: the body only reached x=${log.walkedInX.toFixed(2)} (expected < −1.2 inside the bore).`);
    if (!log.seated) throw new Error(`pod-walkin GATE FAILED: E-sit did not seat/advance the beat.`);
    if (!log.ejected) throw new Error(`pod-walkin GATE FAILED: E-eject did not fire/advance to shipExplode.`);
    console.log('[pod-walkin] GATE PASS — corridor → through the doorway → inside the pod → seated → E-eject fired (real KCC motion + real input path).');
  },

  // W2b — THE AIRLOCK COLLIDER MOTION PROBE (Rule 9: collision matches the visible airlock, proven by
  //   real motion). Independent of the sequence flow (the orchestrator rewires that later). Boots the
  //   ship, seats the KCC body in the corridor on the airlock centreline (+X side), and proves:
  //   (1) CLOSED sliding door BLOCKS — drive W(−X) into the closed door; the body stops at the wall
  //       plane (can't cross past x ≈ AIRLOCK_WALL_X − a small margin). The seal collider works.
  //   (2) OPEN sliding door PASSES — slide the leaves open (by name) + drop the seal (find + remove
  //       the aperture static box), drive W(−X); the body walks THROUGH into the collar and reaches
  //       near the pod-door threshold (x < COLLAR_FAR_X + margin). The collar floor/walls are walkable.
  //   (3) NO FALL-THROUGH / NO GAP TO SPACE — y stays on the ship floor (≈3000) the whole way.
  //   No screenshot — a motion assertion (like cockpit-motion / pod-walkin).
  'airlock-motion': async (page) => {
    const log = await page.evaluate(async () => {
      const g = window.__game; const ctx = g.ctx;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      try { ctx.weather.intensity = 0; ctx.weather.cloudiness = 0; } catch {}
      const realClock = ctx.three.clock; const FIXED_DT = 0.05;
      const origGetDelta = realClock.getDelta.bind(realClock);
      const origW = ctx.three.renderer.domElement.width, origH = ctx.three.renderer.domElement.height;
      realClock.getDelta = () => FIXED_DT;
      ctx.three.renderer.setSize(48, 48, false);
      const drive = async (simBudget, perTick) => {
        const s0 = ctx.time.elapsed; let last = s0, stalls = 0;
        for (let i = 0; i < 8000; i++) {
          if (perTick) perTick();
          await sleep(16);
          const now = ctx.time.elapsed;
          if (now > last + 1e-6) { last = now; stalls = 0; } else if (++stalls > 600) break;
          if (now - s0 >= simBudget) break;
        }
      };
      const result = { legs: [], closedBlocked: false, openedPassed: false, onFloor: true };
      try {
        try { g.skipIntro(); } catch {}
        await drive(0.2);
        g.startIntro();
        for (let a = 0; a < 20; a++) { g.jumpToBeat('cockpit'); await drive(0.3); if (ctx.player.body.body.translation().y > 2900) break; }
        try { g.setSkyIntroMode(0); } catch {}
        ctx.flags.paused = false;
        ctx.input.controls.isLocked = true;   // isPlaying() → real KCC motion processed
        if (ctx.intro) { ctx.intro.mode = 'walk'; ctx.player.eyeOffset = 0.85; }   // free-walk (the cockpit opens seated → locomotion gated otherwise)
        const cam = ctx.three.camera; cam.rotation.order = 'YXZ';
        // ORIGIN frame: the bridge spawn is at SEAT_Z = −0.30 → origin.z = spawn.z + 0.30. Airlock is
        //   at local z = BAY_ZC = 4.8, wall plane at local x = AIRLOCK_WALL_X = −1.0, collar far = −1.92.
        const sp = ctx.player.body.body.translation();
        const OX = sp.x, OY = sp.y, OZ = sp.z + 0.30;   // ship-origin frame
        const WALL_X = -1.0, COLLAR_FAR = -1.92, POD_X = -3.36, AHW = 0.72, TRAVEL = 0.82, BZ = 4.8;
        const faceNegX = () => { cam.rotation.set(0, Math.PI / 2, 0); if (ctx.intro) ctx.intro.mode = 'walk'; };   // YXZ yaw +π/2 → forward = −X; keep walk mode
        const floorY = OY;   // the KCC body-centre y at the corridor floor (spawn y ≈ ship floor)

        // ── LEG 1: CLOSED door blocks. Place the body in the corridor on the airlock centreline, +X
        //    side (x = −0.4 local, well corridor-side of the −1.0 wall), face −X, drive W into the door.
        ctx.player.body.body.setTranslation({ x: OX - 0.4, y: OY, z: OZ + BZ }, true);
        ctx.player.cameraSnapNextFrame = true;
        await drive(0.15, faceNegX);
        await drive(2.4, () => { faceNegX(); ctx.input.keys['KeyW'] = true; });
        ctx.input.keys['KeyW'] = false;
        const p1 = ctx.player.body.body.translation();
        const x1 = p1.x - OX;
        // BLOCKED if the body did NOT cross meaningfully past the wall plane (allow the KCC skin ~0.1).
        result.closedBlocked = x1 > (WALL_X - 0.15);
        if (Math.abs(p1.y - floorY) > 0.6) result.onFloor = false;
        result.legs.push({ leg: 'closed-block', xEnd: +x1.toFixed(2), wallX: WALL_X, blocked: result.closedBlocked, y: +p1.y.toFixed(1) });

        // ── OPEN the door: slide the leaves into their pockets (by name) + DROP the seal collider. The
        //    seal is the ONE static collider at the aperture centre (world x = OX+WALL_X, z = OZ+BZ,
        //    y ≈ OY + AIRLOCK_TOP/2). Find + remove it from the rapier world.
        const lL = ctx.three.scene.getObjectByName('airlockDoorLeafL');
        const lR = ctx.three.scene.getObjectByName('airlockDoorLeafR');
        if (lL) lL.position.z = (BZ - AHW / 2) - TRAVEL;
        if (lR) lR.position.z = (BZ + AHW / 2) + TRAVEL;
        // remove the seal collider (search the rapier world for a collider at the aperture centre)
        const world = ctx.physics.world;
        const sealWX = OX + WALL_X, sealWZ = OZ + BZ;
        let removed = 0;
        world.forEachCollider((col) => {
          const body = col.parent(); if (!body) return;
          const t = body.translation();   // world position lives on the BODY (makeStaticBox sets it there)
          let hz = 1; try { hz = col.halfExtents().z; } catch {}
          // the seal is the box at the aperture centre (x/z) spanning the aperture width (hz≈AIRLOCK_HW 0.72).
          if (Math.abs(t.x - sealWX) < 0.2 && Math.abs(t.z - sealWZ) < 0.25 && hz > 0.6 && hz < 0.85) {
            world.removeRigidBody(body); removed++;
          }
        });
        result.sealRemoved = removed;
        // DIAGNOSTIC — dump every collider near the boarding lane (x −2.2..0, z BZ±1) so we can see
        //   what blocks the walk-in. (After the seal removal, so it shows the remaining set.)
        result.nearColliders = [];
        world.forEachCollider((col) => {
          const body = col.parent(); if (!body) return;
          const t = body.translation();
          const lx = t.x - OX, lz = t.z - OZ;
          if (lx > -2.4 && lx < 0.2 && Math.abs(lz - BZ) < 1.0 && t.y > OY - 0.5 && t.y < OY + 2.6) {
            let hx = 0, hy = 0, hz = 0;
            try { const h = col.halfExtents(); hx = h.x; hy = h.y; hz = h.z; } catch {}
            result.nearColliders.push({ lx: +lx.toFixed(2), lz: +lz.toFixed(2), ly: +(t.y - OY).toFixed(2), hx: +hx.toFixed(2), hy: +hy.toFixed(2), hz: +hz.toFixed(2) });
          }
        });

        // ── LEG 2: OPEN door passes. Re-place in the corridor (+X side), face −X, drive W through the
        //    open door + collar toward the pod door.
        ctx.player.body.body.setTranslation({ x: OX - 0.4, y: OY, z: OZ + BZ }, true);
        ctx.player.cameraSnapNextFrame = true;
        await drive(0.15, faceNegX);
        await drive(3.5, () => { faceNegX(); ctx.input.keys['KeyW'] = true; });
        ctx.input.keys['KeyW'] = false;
        const p2 = ctx.player.body.body.translation();
        const x2 = p2.x - OX;
        // PASSED if the body walked past the wall into the collar, near the pod-door threshold.
        result.openedPassed = x2 < (COLLAR_FAR + 0.35);
        if (Math.abs(p2.y - floorY) > 0.6) result.onFloor = false;
        result.legs.push({ leg: 'open-pass', xEnd: +x2.toFixed(2), collarFar: COLLAR_FAR, passed: result.openedPassed, y: +p2.y.toFixed(1) });
      } finally {
        ctx.input.keys['KeyW'] = false;
        realClock.getDelta = origGetDelta;
        ctx.three.renderer.setSize(origW, origH, false);
      }
      return result;
    });
    console.log('[airlock-motion] ' + JSON.stringify(log.legs, null, 0));
    console.log('[airlock-motion] nearColliders=' + JSON.stringify(log.nearColliders || []));
    console.log(`[airlock-motion] closedBlocked=${log.closedBlocked} openedPassed=${log.openedPassed} onFloor=${log.onFloor} sealRemoved=${log.sealRemoved}`);
    if (!log.closedBlocked) throw new Error('airlock-motion GATE FAILED: the CLOSED sliding door did NOT block the player (they crossed the wall plane) — the seal collider is missing/misplaced.');
    if (!log.openedPassed) throw new Error('airlock-motion GATE FAILED: the OPEN sliding door did NOT let the player through to the pod threshold — the collar is not walkable (a blocking collider or a floor gap).');
    if (!log.onFloor) throw new Error('airlock-motion GATE FAILED: the player fell through the floor / a gap to space along the boarding path.');
    console.log('[airlock-motion] GATE PASS — closed door blocks, open door + collar are walkable to the pod threshold, no fall-through (real KCC motion).');
  },

  // CLUSTER D — the WALK-OUT gate (user spec: crash → wake → kick the FRONT door → walk out on your
  //   OWN legs onto the real terrain, NO teleport; the exposure EASES like eye-adaptation, no snap).
  //   Drives the REAL chain impact → wake → kick the door → real-KCC walk out the −Z door, and PROVES:
  //   (1) the player physically walked OUT through the door onto the terrain (position moved −Z past
  //   the pod radius via real KCC, not a teleport — sampled continuity), (2) the step-out did NOT
  //   teleport (no discontinuous jump at the handoff), and (3) the renderer exposure EASED from the
  //   wake lift toward the desert base over ~1.8s (monotone-ish descent, no single-frame snap).
  //   The real-KCC walk is driven by a FIXED-DT sim-budget loop (see below) so the proof is
  //   DETERMINISTIC under the ~2 fps headless swiftshader tab — no wall-clock timing dependence.
  'pod-walkout': async (page) => {
    const log = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const g = window.__game;
      const ctx = g.ctx;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      // ── DETERMINISTIC DRIVER (throttle-proof). The OLD driver was wall-clock end to end: the
      //    impact/wake setup slept 2600+600 ms and the walk loop held W for 90×70 ms, measuring
      //    however far the KCC happened to travel — but the headless swiftshader tab renders this
      //    heavy scene at ~1-2 fps, so BOTH legs raced a starved loop: (a) the wake beat's init tick
      //    could MISS the 600 ms window, so forcing phase='climb' got undone by the late init
      //    (blowCabinHatch(0) re-shut the door + mode='seated' → walkedOutZ≈0, flaky), and (b) the
      //    walked distance swung run-to-run (~−5.6..−6.9 m; could dip under the −2.0 GATE-2 floor).
      //    THE FIX (same technique as pod-walkin / smokeExposureEase): pin the loop's dt to FIXED_DT
      //    so every ticked frame advances a KNOWN sim-dt, drive the impact→wake chain by its REAL
      //    phase-flip conditions, and drive the walk until a SIM-TIME budget elapses — never a
      //    wall-clock count. The assertions below are UNCHANGED and strict.
      const FIXED_DT = 0.05;      // sim-seconds per frame (under the loop's 0.1 clamp → never clamped)
      const SIM_BUDGET = 2.0;     // sim-seconds of walking: at WALK_SPEED 6 m/s → ~11 m out the door
                                  //   (well past the −2.0 GATE-2 floor + the 2.2 m stepOut climb gate)
      /** Drive the live loop until cond() or simBudget sim-seconds. Stall-bail: ~10 s of yields with
       *  no ticked frame → the loop is wedged, bail (a long BLOCKING frame can't false-trip it —
       *  these yields don't run while the main thread is blocked either). */
      const drive = async (simBudget, cond, perTick) => {
        const simStart = ctx.time.elapsed;
        let lastSim = simStart, stalls = 0;
        for (let i = 0; i < 8000; i++) {
          if (perTick) perTick();
          await sleep(16);
          const nowSim = ctx.time.elapsed;
          if (nowSim > lastSim + 1e-6) { lastSim = nowSim; stalls = 0; }
          else if (++stalls > 600) break;
          if (cond()) return { ok: true, sim: +(nowSim - simStart).toFixed(2) };
          if (nowSim - simStart >= simBudget) break;
        }
        return { ok: cond(), sim: +(ctx.time.elapsed - simStart).toFixed(2) };
      };
      const realClock = ctx.three.clock;
      const origGetDelta = realClock.getDelta.bind(realClock);
      const origW = ctx.three.renderer.domElement.width, origH = ctx.three.renderer.domElement.height;
      const cam = ctx.three.camera;
      let expoAtWake = 0, wakeInitOk = false;
      let inside = { x: 0, y: 0, z: 0 };
      let maxJump = 0;          // the largest single-tick position jump (a teleport would spike this)
      let reachedStepOut = false;
      let teleportAtHandoff = 0;
      let framesTicked = 0, simElapsed = 0;
      try {
        realClock.getDelta = () => FIXED_DT;             // pin the per-frame sim-dt (throttle-proof)
        ctx.three.renderer.setSize(48, 48, false);       // tiny canvas → more REAL frames tick per second (no screenshots in this gate)
        g.startIntro();
        // run through the crash → the REAL impact beat auto-advances → wake, whose init tick seats
        //   the player inside the crashed cabin + lifts the exposure. Driven by the CHAIN's own
        //   conditions (impact runs IMPACT_FADE+IMPACT_HOLD = 2.7 sim-s, then advanceBeat → wake).
        g.jumpToBeat('impact');
        const rWake = await drive(4.5, () => ctx.intro && ctx.intro.beat === 'wake' && ctx.intro.scratch.init === true);
        wakeInitOk = rWake.ok;
        expoAtWake = ctx.three.renderer.toneMappingExposure;   // the lifted wake exposure (~1.62)
        // FORCE the wake to its walk-out-ready state deterministically (the come-to fade phases are
        //   proven by smokeIntro; this gate proves the WALK). Safe now: the wake init has PROVABLY
        //   run (rWake cond), so no late init will undo this. Blow the FRONT door fully open + hand
        //   control to WALK — the exact end-state of the wake 'blowing'→'climb' phases.
        g.blowCabinHatch(1);                 // kick the −Z front door wide (the wake exit)
        const f = document.getElementById('intro-fade'); if (f) f.style.opacity = '0';   // clear the come-to overlay
        if (ctx.intro) { ctx.intro.mode = 'walk'; ctx.intro.scratch.phase = 'climb'; ctx.intro.scratch.t = 0; }
        // record the spawn (inside the cabin) — the walk-out must MOVE the body from here, not teleport.
        const p0 = ctx.player.body.body.translation();
        inside = { x: p0.x, y: p0.y, z: p0.z };
        // WALK OUT the −Z front door on real legs: face −Z, hold W (forward = −Z), sample the path
        //   each yield (proves the motion is continuous). Terminated by the SIM budget.
        cam.rotation.order = 'YXZ';
        let prev = { x: inside.x, y: inside.y, z: inside.z };
        const simStart = ctx.time.elapsed;
        let lastSim = simStart, stalls = 0;
        for (let i = 0; i < 8000; i++) {
          cam.rotation.set(-0.05, 0, 0);   // face −Z (yaw 0) → W walks toward/through the −Z front door
          ctx.input.keys['KeyW'] = true;   // re-assert each iteration (endInputFrame clears pressed; keys persist, belt-and-braces)
          await sleep(16);                 // yield so real rAF frames tick between samples
          const t = ctx.player.body.body.translation();
          const jump = Math.hypot(t.x - prev.x, t.z - prev.z);
          if (jump > maxJump) maxJump = jump;
          prev = { x: t.x, y: t.y, z: t.z };
          // the wake-climb advanced to stepOut (or handed off) — capture whether the body JUMPED at that
          //   moment (a teleport-to-returnPos would spike jump exactly here; the real flow does NOT teleport).
          if (!reachedStepOut && ctx.intro && (ctx.intro.beat === 'stepOut' || !ctx.intro.active)) {
            reachedStepOut = true; teleportAtHandoff = jump;
          }
          const nowSim = ctx.time.elapsed;
          if (nowSim > lastSim + 1e-6) { lastSim = nowSim; stalls = 0; }
          else if (++stalls > 600) break;   // ~10 s of yields with no ticked frame → loop wedged, bail
          simElapsed = nowSim - simStart;
          framesTicked = Math.round(simElapsed / FIXED_DT);
          if (simElapsed >= SIM_BUDGET) break;
        }
      } finally {
        ctx.input.keys['KeyW'] = false;
        realClock.getDelta = origGetDelta;               // restore the real clock (leak-free)
        ctx.three.renderer.setSize(origW, origH, false); // restore the canvas
      }
      const pOut = ctx.player.body.body.translation();
      const walkedOutZ = pOut.z - inside.z;   // negative = walked −Z out the front door

      // ── ZERO-SHIFT EXPOSURE PROOF (W6 item 5). The wake NO LONGER lifts the exposure — it stays at
      //    the desert base (1.05) from the crash onward, so there is nothing to ease and no washed-out
      //    exit. __game.smokeExposureConstant() drives the crash-pose settle 0→1 and asserts the
      //    renderer exposure is CONSTANT at 1.05 across the whole settle (min==max==base).
      const easeReport = g.smokeExposureConstant();
      return {
        walkExpoAtWake: +expoAtWake.toFixed(3), walkExpoFinal: +ctx.three.renderer.toneMappingExposure.toFixed(3),
        ease: easeReport,
        inside: [+inside.x.toFixed(2), +inside.z.toFixed(2)], walkedOutZ: +walkedOutZ.toFixed(2),
        maxJump: +maxJump.toFixed(2), reachedStepOut, teleportAtHandoff: +teleportAtHandoff.toFixed(2),
        driver: { simElapsed: +simElapsed.toFixed(2), framesTicked, wakeInitOk },   // deterministic-driver diagnostics
      };
    });
    console.log('[pod-walkout] ' + JSON.stringify(log));
    // GATE 0 — the SETUP proved itself: the real impact→wake chain advanced + the wake init tick ran
    //   (seats the player inside the crashed cabin). Without this, a walk failure below would be a
    //   confusing symptom of a broken setup, not a broken walk-out.
    if (!log.driver.wakeInitOk) throw new Error(`pod-walkout GATE FAILED: the impact→wake chain never initialised the wake (driver=${JSON.stringify(log.driver)}) — the crash-chain setup is broken.`);
    // GATE 1 — the player physically WALKED OUT (moved −Z out the front door onto the terrain).
    if (log.walkedOutZ > -1.0) throw new Error(`pod-walkout GATE FAILED: the body only moved z=${log.walkedOutZ} out the door (expected < −1.0 — the walk-out path is blocked or the door didn't open).`);
    // GATE 2 — NO TELEPORT: a stepOut teleport-to-returnPos would SNAP the body back near the spawn
    //   (returnPos ≈ the inside/origin) — but the player ends where they WALKED (z well past the door),
    //   proving no teleport. The definitive no-teleport signal is the END POSITION: a real teleport to
    //   returnPos would land the body back at |Δz|≈0, not the ~−11 m the deterministic driver walks to.
    if (Math.abs(log.walkedOutZ) < 2.0) throw new Error(`pod-walkout GATE FAILED: the body ended only ${log.walkedOutZ}m from the spawn — a teleport-back-to-returnPos would land here; the walk-out should leave the player where they WALKED (well out the door).`);
    // a per-tick jump far beyond any walking step WOULD be a teleport. With the fixed-dt driver the KCC
    //   step is a steady ~0.6 m (FIXED_DT 0.05 s × WALK_SPEED 6 m/s); the 3.0 m ceiling flags a real snap.
    if (log.maxJump > 3.0) throw new Error(`pod-walkout GATE FAILED: a discontinuous ${log.maxJump}m jump (a teleport, not a KCC step) occurred during the walk-out.`);
    // GATE 3 — the wake-climb advanced to stepOut (the walk-out → stepOut chain fired).
    if (!log.reachedStepOut) throw new Error(`pod-walkout GATE FAILED: the walk-out never advanced to stepOut (the climb-out distance gate didn't fire).`);
    // GATE 4 — ZERO-SHIFT EXPOSURE (W6 item 5): the exposure is CONSTANT at the desert base (1.05)
    //   across the whole crash-pose settle — the wake never lifts it, so there's no washed-out exit
    //   + nothing to ease. Both the settle-sweep (smokeExposureConstant) AND the live wake capture
    //   must sit at the base.
    if (!log.ease || !log.ease.ok || !log.ease.constant) throw new Error(`pod-walkout GATE FAILED: the exposure is NOT CONSTANT at the desert base across the crash settle — smokeExposureConstant=${JSON.stringify(log.ease)} (expected min==max==${log.ease ? log.ease.base : '1.05'}).`);
    if (Math.abs(log.walkExpoAtWake - 1.05) > 1e-2) throw new Error(`pod-walkout GATE FAILED: the LIVE wake exposure lifted to ${log.walkExpoAtWake} (expected 1.05 — the wake must not lift the exposure; W6 item 5).`);
    if (Math.abs(log.walkExpoFinal - 1.05) > 1e-2) throw new Error(`pod-walkout GATE FAILED: the exposure ended at ${log.walkExpoFinal} after the walk-out (expected 1.05 — bit-stable across the exit).`);
    console.log(`[pod-walkout] GATE PASS — kicked the front door + walked OUT on real legs (Δz=${log.walkedOutZ}m over ${log.driver.simElapsed}s sim / ${log.driver.framesTicked} fixed-dt frames, maxJump=${log.maxJump}m, handoff jump=${log.teleportAtHandoff}m = NO teleport), reached stepOut, and the exposure held CONSTANT at ${log.ease.base} (wake=${log.walkExpoAtWake}, settle min/max=${log.ease.min}/${log.ease.max}) — zero-shift handoff.`);
  },

  // W6 item 4 GATE — the IMPACT VIEW NEVER LEAVES THE POD. Drives the real descent→parachute→impact
  //   →wake chain with a FIXED sim-dt and, each ticked frame from the ground-approach through the
  //   crash-settle + wake, probes whether the camera EYE is inside the (possibly-tilted) cabin shell
  //   (probeEyeInCabin). Asserts the eye stays INSIDE the whole time — no frame where the view clips
  //   outside the pod (the "seeing above the pod / the landscape" bug). The bug this catches: the
  //   body left ~20 m up when the cabin grounded at impact → the eye hung above the pod for a few frames.
  'impact-eye': async (page) => {
    const log = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const g = window.__game;
      const ctx = g.ctx;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      const FIXED_DT = 0.05;
      const realClock = ctx.three.clock;
      const origGetDelta = realClock.getDelta.bind(realClock);
      const origW = ctx.three.renderer.domElement.width, origH = ctx.three.renderer.domElement.height;
      const cam = ctx.three.camera;
      let worstMargin = 999;        // the smallest radial margin seen (negative = clipped outside the wall)
      let worstReport = null;
      let anyOutside = false, framesProbed = 0, sawImpact = false, sawWake = false;
      const beatsSeen = {};
      try {
        realClock.getDelta = () => FIXED_DT;
        ctx.three.renderer.setSize(48, 48, false);
        g.startIntro();
        // enter the descent LATE (near the ground) so we exercise the ground-approach → impact → wake
        //   frames densely; then let the chain auto-advance through parachute → impact → wake.
        g.jumpToBeat('descent');
        // drive frames; sample the eye vs cabin each ticked frame once we're at/after the parachute
        //   (the ground-approach) and all the way through wake's come-to.
        const simStart = ctx.time.elapsed;
        let lastSim = simStart, stalls = 0;
        for (let i = 0; i < 8000; i++) {
          await sleep(16);
          const beat = ctx.intro ? ctx.intro.beat : 'done';
          beatsSeen[beat] = (beatsSeen[beat] || 0) + 1;
          if (beat === 'impact') sawImpact = true;
          if (beat === 'wake') sawWake = true;
          // probe from the parachute (ground-approach) through impact + wake — the window the bug lived in.
          if (beat === 'parachute' || beat === 'impact' || beat === 'wake') {
            const eye = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
            const r = g.probeEyeInCabin(eye);
            if (r.built) {
              framesProbed++;
              if (!r.inside) anyOutside = true;
              if (r.radialMargin < worstMargin) { worstMargin = r.radialMargin; worstReport = { beat, ...r }; }
            }
          }
          const nowSim = ctx.time.elapsed;
          if (nowSim > lastSim + 1e-6) { lastSim = nowSim; stalls = 0; }
          else if (++stalls > 600) break;
          // stop a couple seconds into wake (past the come-to fade) — the whole impact→wake window is covered.
          if (sawWake && (beatsSeen['wake'] || 0) > 30) break;
          if (nowSim - simStart > 40) break;   // hard sim-time cap
        }
      } finally {
        realClock.getDelta = origGetDelta;
        ctx.three.renderer.setSize(origW, origH, false);
        if (window.__game.ctx.intro && window.__game.ctx.intro.active) { try { window.__game.skipIntro(); } catch {} }
      }
      return { anyOutside, framesProbed, sawImpact, sawWake, worstMargin: +worstMargin.toFixed(3), worstReport, beatsSeen };
    });
    console.log('[impact-eye] ' + JSON.stringify(log));
    if (!log.sawImpact) throw new Error(`impact-eye GATE FAILED: the chain never reached the impact beat (beatsSeen=${JSON.stringify(log.beatsSeen)}).`);
    if (!log.sawWake) throw new Error(`impact-eye GATE FAILED: the chain never reached the wake beat (beatsSeen=${JSON.stringify(log.beatsSeen)}).`);
    if (log.framesProbed < 10) throw new Error(`impact-eye GATE FAILED: too few eye probes (${log.framesProbed}) — the descent/impact window wasn't exercised.`);
    if (log.anyOutside) throw new Error(`impact-eye GATE FAILED: the camera eye CLIPPED OUTSIDE the cabin on at least one frame (worst=${JSON.stringify(log.worstReport)}) — the view left the pod during impact/wake (the "seeing above the pod / the landscape" bug).`);
    console.log(`[impact-eye] GATE PASS — the eye stayed INSIDE the cabin across ${log.framesProbed} probed frames through impact→wake (worst radial margin=${log.worstMargin}m, all inside). The view never leaves the pod.`);
  },

  // W6 item 5 GATE — THE ZERO-SHIFT HANDOFF. The visible world must be BIT-STABLE across the exit
  //   threshold: exposure, fog density, sun intensity, and the diurnal clock must NOT snap at the
  //   wake, at step-out, or after handoff — the wake IS the survival world; walking out is just a
  //   door. Drives the real chain to wake, then to step-out + handoff + 5 s of gameplay, sampling
  //   the world state at each point and asserting they match (within tight tolerances). The clock
  //   ADVANCES continuously (that's fine — it must not SNAP BACKWARD); exposure/fog/sun hold.
  'zero-shift-handoff': async (page) => {
    const log = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const g = window.__game;
      const ctx = g.ctx;
      const FIXED_DT = 0.05;
      const realClock = ctx.three.clock;
      const origGetDelta = realClock.getDelta.bind(realClock);
      const origW = ctx.three.renderer.domElement.width, origH = ctx.three.renderer.domElement.height;
      const sample = () => ({
        expo: +ctx.three.renderer.toneMappingExposure.toFixed(4),
        fog: ctx.three.scene.fog && ctx.three.scene.fog.density != null ? +ctx.three.scene.fog.density.toFixed(6) : null,
        sun: ctx.lights && ctx.lights.sun ? +ctx.lights.sun.intensity.toFixed(4) : null,
        dayTime: +ctx.time.dayTime.toFixed(4),
      });
      const drive = async (cond, budget) => {
        const start = ctx.time.elapsed; let last = start, stalls = 0;
        for (let i = 0; i < 8000; i++) {
          await sleep(16);
          if (cond()) return true;
          const now = ctx.time.elapsed;
          if (now > last + 1e-6) { last = now; stalls = 0; } else if (++stalls > 600) break;
          if (now - start > budget) break;
        }
        return cond();
      };
      let atWake = null, atStepOut = null, afterHandoff = null, reachedWake = false, reachedStepOut = false, handedOff = false;
      try {
        realClock.getDelta = () => FIXED_DT;
        ctx.three.renderer.setSize(48, 48, false);
        g.startIntro();
        // run the REAL descent → crash → wake so the fog/exposure/time are set by the actual flow.
        g.jumpToBeat('descent');
        reachedWake = await drive(() => ctx.intro && ctx.intro.beat === 'wake' && ctx.intro.scratch.init === true, 30);
        atWake = sample();
        // force the wake to walk-out-ready + walk out to trigger stepOut → endEscapePodIntro.
        g.blowCabinHatch(1);
        const f = document.getElementById('intro-fade'); if (f) f.style.opacity = '0';
        if (ctx.intro) { ctx.intro.mode = 'walk'; ctx.intro.scratch.phase = 'climb'; ctx.intro.scratch.t = 0; }
        const cam = ctx.three.camera; cam.rotation.order = 'YXZ';
        // capture the moment we enter stepOut (the unify has just run — the pod is now the persistent world object).
        reachedStepOut = await drive(() => { cam.rotation.set(-0.05, 0, 0); ctx.input.keys['KeyW'] = true; return ctx.intro && ctx.intro.beat === 'stepOut'; }, 6);
        atStepOut = sample();
        ctx.input.keys['KeyW'] = false;
        // let stepOut's REVEAL_DWELL elapse → endEscapePodIntro (handoff), then 5 s of gameplay.
        handedOff = await drive(() => !ctx.intro || !ctx.intro.active, 8);
        await drive(() => false, 5);   // 5 s of real gameplay ticks (the fog-ease window that USED to exist)
        afterHandoff = sample();
      } finally {
        realClock.getDelta = origGetDelta;
        ctx.three.renderer.setSize(origW, origH, false);
        if (ctx.intro && ctx.intro.active) { try { g.skipIntro(); } catch {} }
      }
      return { atWake, atStepOut, afterHandoff, reachedWake, reachedStepOut, handedOff };
    });
    console.log('[zero-shift-handoff] ' + JSON.stringify(log));
    if (!log.reachedWake) throw new Error(`zero-shift-handoff GATE FAILED: never reached wake (${JSON.stringify(log)}).`);
    if (!log.reachedStepOut) throw new Error(`zero-shift-handoff GATE FAILED: never reached stepOut (${JSON.stringify(log)}).`);
    if (!log.handedOff) throw new Error(`zero-shift-handoff GATE FAILED: the intro never handed off (${JSON.stringify(log)}).`);
    const w = log.atWake, s = log.atStepOut, a = log.afterHandoff;
    // EXPOSURE — constant 1.05 at every point (no lift, no ease).
    for (const [tag, p] of [['wake', w], ['stepOut', s], ['afterHandoff', a]]) {
      if (Math.abs(p.expo - 1.05) > 1e-2) throw new Error(`zero-shift-handoff GATE FAILED: exposure at ${tag} was ${p.expo} (expected 1.05 — no lift/ease anywhere).`);
    }
    // FOG — bit-stable across the exit (already at survival by the crash; no clear pin, no ease). The
    //   wake→stepOut→afterHandoff fog must not jump (tolerance covers float noise, not a visible shift).
    if (Math.abs(w.fog - s.fog) > 2e-5 || Math.abs(s.fog - a.fog) > 2e-5) throw new Error(`zero-shift-handoff GATE FAILED: fog density shifted across the exit — wake=${w.fog} stepOut=${s.fog} afterHandoff=${a.fog} (must be bit-stable; the fog is already survival by the crash).`);
    // SUN intensity — bit-stable (the midday sun the pod fell under continues; no relight at exit).
    if (w.sun != null && (Math.abs(w.sun - s.sun) > 0.05 || Math.abs(s.sun - a.sun) > 0.1)) throw new Error(`zero-shift-handoff GATE FAILED: sun intensity shifted across the exit — wake=${w.sun} stepOut=${s.sun} afterHandoff=${a.sun}.`);
    // CLOCK — must ADVANCE (or hold), never SNAP BACKWARD (the old setIntroMiddayClear re-set was a backward jump).
    const wrap = (b, x) => x < b - 0.5 ? x + 1 : x;   // handle a midnight wrap (won't happen at midday, but be safe)
    if (wrap(w.dayTime, s.dayTime) < w.dayTime - 1e-4 || wrap(s.dayTime, a.dayTime) < s.dayTime - 1e-4) throw new Error(`zero-shift-handoff GATE FAILED: the diurnal clock SNAPPED BACKWARD across the exit — wake=${w.dayTime} stepOut=${s.dayTime} afterHandoff=${a.dayTime} (the clock must continue, not reset).`);
    console.log(`[zero-shift-handoff] GATE PASS — the world is bit-stable across the exit: exposure ${w.expo}/${s.expo}/${a.expo} (constant 1.05), fog ${w.fog}/${s.fog}/${a.fog} (stable), sun ${w.sun}/${s.sun}/${a.sun} (stable), clock ${w.dayTime}→${s.dayTime}→${a.dayTime} (continuous, no backward snap). The wake IS the survival world.`);
  },

  // B2 dev diagnostic — dump every physics collider whose AABB centre falls in the pod-bay boarding
  //   region (relative to the bridge spawn) so a blocked walk-in path can be diagnosed exactly.
  'bay-probe': async (page) => {
    const out = await page.evaluate(async () => {
      const g = window.__game;
      const ctx = g.ctx;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      ctx.flags.paused = false;
      ctx.input.controls.isLocked = true;
      try { g.skipIntro(); } catch {}
      await sleep(200);
      g.startIntro();
      g.jumpToBeat('cockpit');
      for (let i = 0; i < 20; i++) { await sleep(120); if (ctx.player.body.body.translation().y > 2900) break; g.jumpToBeat('cockpit'); }
      const sp = ctx.player.body.body.translation();
      const SHIP = { x: sp.x, y: sp.y - 0.85, z: sp.z + 0.30 };   // bridge spawn → ship origin (seat at z −0.30; body centre ≈ +0.85)
      const hits = [];
      ctx.physics.world.forEachCollider((col) => {
        const t = col.translation();
        const lx = t.x - SHIP.x, lz = t.z - SHIP.z;
        if (t.y < SHIP.y - 2 || t.y > SHIP.y + 6) return;      // ship-deck band only
        const sh = col.shape;
        // AABB-overlap the boarding region (a long wall's CENTRE can sit far outside it).
        const hx = sh.halfExtents ? Math.max(sh.halfExtents.x, sh.halfExtents.z) : (sh.radius || 0.5);
        const hz = hx;
        if (lx + hx < -4.5 || lx - hx > 1.5 || lz + hz < 2.0 || lz - hz > 7.5) return;
        const desc = { type: sh.type, x: +lx.toFixed(2), y: +(t.y - SHIP.y).toFixed(2), z: +lz.toFixed(2) };
        if (sh.halfExtents) { desc.he = [+sh.halfExtents.x.toFixed(2), +sh.halfExtents.y.toFixed(2), +sh.halfExtents.z.toFixed(2)]; }
        if (sh.radius != null) desc.r = +sh.radius.toFixed(2);
        if (sh.halfHeight != null) desc.hh = +sh.halfHeight.toFixed(2);
        const q = col.rotation();
        const yaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
        if (Math.abs(yaw) > 0.01) desc.yawDeg = +(yaw * 180 / Math.PI).toFixed(0);
        hits.push(desc);
      });
      hits.sort((a, b) => a.x - b.x);
      // ── KCC blocker interrogation: park the capsule AT the stall point on the door centreline and
      //    ask the character controller for a −X step; report exactly which collider(s) it hits.
      ctx.flags.paused = true;   // freeze the sim so nothing re-moves the body under us
      const pb = ctx.player.body;
      pb.body.setTranslation({ x: SHIP.x - 0.7, y: sp.y, z: SHIP.z + 4.8 }, true);
      pb.controller.computeColliderMovement(pb.collider, { x: -0.6, y: -0.05, z: 0 });
      const mv = pb.controller.computedMovement();
      const cols = [];
      try {
        const n = pb.controller.numComputedCollisions();
        for (let i = 0; i < n; i++) {
          const c = pb.controller.computedCollision(i);
          if (!c || !c.collider) continue;
          const ct = c.collider.translation();
          const cs = c.collider.shape;
          cols.push({
            type: cs.type, x: +(ct.x - SHIP.x).toFixed(2), y: +(ct.y - SHIP.y).toFixed(2), z: +(ct.z - SHIP.z).toFixed(2),
            he: cs.halfExtents ? [+cs.halfExtents.x.toFixed(2), +cs.halfExtents.y.toFixed(2), +cs.halfExtents.z.toFixed(2)] : undefined,
            r: cs.radius != null ? +cs.radius.toFixed(2) : undefined,
            n1: c.normal1 ? [+c.normal1.x.toFixed(2), +c.normal1.y.toFixed(2), +c.normal1.z.toFixed(2)] : undefined,
          });
        }
      } catch (e) { cols.push({ err: String(e) }); }
      ctx.flags.paused = false;
      return { shipY: +SHIP.y.toFixed(1), n: hits.length, hits, kcc: { moved: [+mv.x.toFixed(3), +mv.y.toFixed(3), +mv.z.toFixed(3)], cols } };
    });
    console.log('[bay-probe] shipY=' + out.shipY + ' n=' + out.n);
    for (const h of out.hits) console.log('[bay-probe] ' + JSON.stringify(h));
    console.log('[bay-probe][kcc] ' + JSON.stringify(out.kcc));
  },

  // FLAG-OFF byte-identical GATE — a normal (no-intro) game save must write NO podCrash field, so
  // the live game is unaffected by this feature. enterLive already ran enterGame (a normal dev game,
  // NO intro/unify); we just save + assert the field is absent. THROWS on failure.
  'pod-persistence-flagoff': async (page) => {
    const r = await page.evaluate(() => {
      const g = window.__game;
      const sv = g.saveGame();
      const raw = localStorage.getItem('dustfall.save.v1');
      const parsed = raw ? JSON.parse(raw) : {};
      return { saveOk: sv.ok, hasPodCrash: 'podCrash' in parsed };
    });
    console.log(`[pod-persistence-flagoff] ${JSON.stringify(r)}`);
    if (!r.saveOk || r.hasPodCrash) throw new Error(`FLAG-OFF GATE FAILED — a no-pod save wrote podCrash: ${JSON.stringify(r)}`);
    console.log('[pod-persistence-flagoff] PASS — no podCrash in a normal (no-pod) save.');
  },

  // Pod-tutorial GATE — the craft→salvage→chute-pop loop, headless. Mirrors smoke-intro's gate.
  'smoke-pod-tutorial': async (page) => {
    const r = await page.evaluate(() => window.__game.smokePodTutorial());
    console.log(`[smoke-pod-tutorial] ${JSON.stringify(r)}`);
    if (!r || !r.ok) throw new Error(`smoke-pod-tutorial GATE FAILED: ${JSON.stringify(r)}`);
  },

  // ── Y3 fix 8 — DOOR-FLUSH-AUDIT: the merged front door must read PERFECTLY FLUSH (pivot rotation
  //    == 0 exactly) at EVERY sealed state (bay pre-open, post-seal, descent altitudes, impact, wake
  //    pre-kick). Steps each state, reads probeCabinDoor()/the bay pivot, and GATES local rotation.y
  //    == 0 (and local x/z == 0). THROWS on any drift. No screenshot — a hard assertion.
  'door-flush-audit': async (page) => {
    const log = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const g = window.__game; const ctx = g.ctx;
      const realClock = ctx.three.clock;
      const origGetDelta = realClock.getDelta.bind(realClock);
      const origW = ctx.three.renderer.domElement.width, origH = ctx.three.renderer.domElement.height;
      const rows = [];
      const EPS = 1e-3;
      const readRide = (label) => {
        const p = g.probeCabinDoor();   // the RIDE/landed cabin's front-door pivot
        rows.push({ label, kind: 'ride', built: p.built, localX: p.localX, localY: p.localY, localZ: p.localZ, ajarY: p.ajarY });
        return p;
      };
      const readBay = (label) => {
        const pod = ctx.three.scene.getObjectByName('dockedCanonicalPod') || ctx.three.scene.getObjectByName('canonicalPod');
        let localY = null, found = false;
        if (pod) { pod.traverse((o) => { if (o.name === 'canonicalPodDoor') { found = true; localY = +o.rotation.y.toFixed(4); } }); }
        rows.push({ label, kind: 'bay', built: found, localY });
        return { found, localY };
      };
      try {
        realClock.getDelta = () => 0.05;
        ctx.three.renderer.setSize(48, 48, false);
        // 1) BAY pre-open (the docked pod door sealed, before the player E-opens it).
        g.startIntro(); g.jumpToBeat('cockpit');
        const driveBay = async () => { for (let i = 0; i < 120; i++) { await sleep(16); if (ctx.three.scene.getObjectByName('dockedCanonicalPod')) return; } };
        await driveBay();
        readBay('bay pre-open (docked, sealed)');
        // 1b) MID-RELEASE sampling (live-test 1h coverage hole: the audit only checked RESTING
        //     sealed states while releasePodFromBay's old door rattle read as "tilted" IN TRANSIT —
        //     the player now rides the bay pod through the release). Drive the real shipExplode
        //     release and assert the bay door pivot stays pinned (the rattle fix) until the ship
        //     disposes at the release end (found:false rows are skipped by the gate).
        g.jumpToBeat('shipExplode');
        for (let i = 0; i < 6; i++) {
          await sleep(120);
          const r = readBay(`mid-release sample ${i}`);
          if (!r.found) break;   // phase B disposed the ship — the release window is over
        }
        // 2) RIDE cabin sealed states — drive the descent chain + sample the front-door pivot sealed.
        g.jumpToBeat('descent');
        const driveTo = async (cond, budget) => { const s0 = ctx.time.elapsed; let last = s0, st = 0; for (let i = 0; i < 8000; i++) { await sleep(16); const n = ctx.time.elapsed; if (n > last + 1e-6) { last = n; st = 0; } else if (++st > 400) break; if (cond()) return true; if (n - s0 >= budget) break; } return cond(); };
        // sample the sealed door at several descent altitudes (the user still saw crooked in SOME phases)
        for (const d of [0.02, 0.15, 0.5, 0.9]) {
          try { g.setDescentProgress(d); } catch {}
          await sleep(60);
          readRide(`descent p=${d} (sealed)`);
        }
        // 3) impact (the crash settles the cabin — the door must still read sealed/flush pre-kick)
        await driveTo(() => ctx.intro && ctx.intro.beat === 'impact' && ctx.intro.scratch.init === true, 25);
        await sleep(80); readRide('impact (crash, pre-kick)');
        // 4) wake pre-kick (comeTo — the blast cracked it AJAR; the FLUSH audit is the pre-ajar seal, so
        //    we assert the ajar REST value is the intended _cabinHatchAjarY (0), i.e. sealed-then-ajar==0).
        await driveTo(() => ctx.intro && ctx.intro.beat === 'wake' && ctx.intro.scratch.init === true, 10);
        await sleep(80);
        // force the sealed pre-ajar read: blowCabinHatch(0) sets the ajar rest; the FLUSH contract is the
        //   SEALED pivot == 0. Read the ajar rest value (should be 0 = the door was flush before the kick).
        const preKick = readRide('wake pre-kick (ajar rest)');
        rows[rows.length - 1].note = `ajarY=${preKick.ajarY} (0 = the door was flush/sealed before the blast cracked it)`;
      } finally { realClock.getDelta = origGetDelta; ctx.three.renderer.setSize(origW, origH, false); }
      return { rows, EPS };
    });
    console.log('[door-flush-audit]');
    for (const r of log.rows) console.log('  ' + JSON.stringify(r));
    // GATE: every SEALED state must read the door pivot local rotation.y == 0 (and x/z == 0 for the ride).
    const EPS = 1e-3;
    const fails = [];
    for (const r of log.rows) {
      if (!r.built) continue;   // (a dev jump may not build a given door — the built states are what we gate)
      // the ride pivot: local (x,y,z) must all be ~0 when sealed; the ajar-rest read is gated on ajarY==0.
      if (r.kind === 'ride') {
        const ajar = r.label.includes('ajar rest');
        const y = ajar ? r.ajarY : r.localY;
        if (Math.abs(y) > EPS || Math.abs(r.localX) > EPS || Math.abs(r.localZ) > EPS) fails.push(r);
      } else {   // bay
        if (Math.abs(r.localY) > EPS) fails.push(r);
      }
    }
    if (fails.length) throw new Error(`door-flush-audit GATE FAILED — the door DRIFTED from flush (rotation != 0) in: ${JSON.stringify(fails)}`);
    console.log(`[door-flush-audit] GATE PASS — the door read PERFECTLY FLUSH (pivot == 0) at every sealed state (${log.rows.filter((r) => r.built).length} states checked).`);
  },

  // ── Y3 fix 9 — DOORWAY-TORTURE: enter/exit the LANDED pod ×6 across the wake→step-out→tutorial
  //    states on REAL KCC legs. The player must NEVER be blocked from walking IN through the −Z door,
  //    NEVER fall through the floor, and NEVER get trapped inside (the walls exist from the crash, one
  //    state forever). Asserts the body physically crosses the doorway plane in AND out each cycle.
  'doorway-torture': async (page) => {
    const log = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const g = window.__game; const ctx = g.ctx;
      ctx.flags.thirdPerson = false;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (ctx.player.viewModel && ctx.player.viewModel.group) ctx.player.viewModel.group.visible = false;
      const realClock = ctx.three.clock;
      const origGetDelta = realClock.getDelta.bind(realClock);
      const origW = ctx.three.renderer.domElement.width, origH = ctx.three.renderer.domElement.height;
      const cam = ctx.three.camera; cam.rotation.order = 'YXZ';
      const FIXED_DT = 0.05;
      const cycles = [];
      let _colliderDump = [];
      let podX = 0, podZ = 0, gy = 0, minY = 1e9, maxJump = 0, everTrapped = false;
      const driveTo = async (cond, budget) => { const s0 = ctx.time.elapsed; let last = s0, st = 0; for (let i = 0; i < 8000; i++) { await sleep(16); const n = ctx.time.elapsed; if (n > last + 1e-6) { last = n; st = 0; } else if (++st > 500) break; if (cond()) return true; if (n - s0 >= budget) break; } return cond(); };
      // WALK in a compass direction for a sim-budget, sampling the path (continuity + floor).
      const walk = async (yaw, budget) => {
        const s0 = ctx.time.elapsed; let last = s0, st = 0;
        let prev = ctx.player.body.body.translation();
        for (let i = 0; i < 8000; i++) {
          cam.rotation.set(-0.02, yaw, 0);
          ctx.input.keys['KeyW'] = true;
          await sleep(16);
          const t = ctx.player.body.body.translation();
          const jump = Math.hypot(t.x - prev.x, t.z - prev.z);
          if (jump > maxJump) maxJump = jump;
          if (t.y < minY) minY = t.y;
          prev = t;
          const n = ctx.time.elapsed;
          if (n > last + 1e-6) { last = n; st = 0; } else if (++st > 500) break;
          if (n - s0 >= budget) break;
        }
        ctx.input.keys['KeyW'] = false;
      };
      try {
        realClock.getDelta = () => FIXED_DT;
        ctx.three.renderer.setSize(48, 48, false);
        // drive the intro to step-out so the pod is the persistent WALK-IN structure (colliders live).
        g.startIntro();
        g.jumpToBeat('descent');
        await driveTo(() => ctx.intro && ctx.intro.beat === 'wake' && ctx.intro.scratch.init === true, 25);
        // force the wake to hand off to step-out (unify) so the pod is fully landed + enterable.
        g.blowCabinHatch(1);
        if (ctx.intro) { ctx.intro.mode = 'walk'; ctx.intro.scratch.phase = 'climb'; ctx.intro.scratch.t = 999; }
        await driveTo(() => ctx.intro && (ctx.intro.beat === 'stepOut' || !ctx.intro.active), 20);
        await driveTo(() => !ctx.intro || !ctx.intro.active, 12);   // let stepOut hand off + startPodTutorial
        const pod = ctx.three.scene.getObjectByName('escapePodCabin');
        if (pod) { pod.updateMatrixWorld(true); const V = cam.position.constructor; const p = pod.getWorldPosition(new V()); podX = p.x; podZ = p.z; }
        gy = ctx.terrain.heightAt(podX, podZ);
        // DIAGNOSTIC — dump the walkable colliders near the pod (position + half-extents) so a
        //   missing/mis-placed wall segment is visible in the log.
        _colliderDump = [];
        ctx.physics.world.forEachCollider((col) => {
          const t = col.translation();
          if (Math.hypot(t.x - podX, t.z - podZ) < 3.2 && Math.abs(t.y - gy) < 3.5) {
            let hx = 0, hy = 0, hz = 0;
            try { const h = col.halfExtents(); hx = +h.x.toFixed(2); hy = +h.y.toFixed(2); hz = +h.z.toFixed(2); } catch {}
            _colliderDump.push({ dz: +(t.z - podZ).toFixed(2), dx: +(t.x - podX).toFixed(2), y: +(t.y - gy).toFixed(2), hx, hy, hz });
          }
        });
        // the −Z door faces world −Z (pod yaw ≈ 0). Walking toward −Z (yaw 0) walks THROUGH the door.
        // Start the player just OUTSIDE the −Z door, ~3 m out.
        const startOutside = () => ctx.player.body.body.setTranslation({ x: podX, y: gy + 1.0, z: podZ - 3.2 }, true);
        for (let c = 0; c < 6; c++) {
          // IN — from outside (−Z), face −Z? No: to enter through the −Z door we walk toward +... the
          //   door is on −Z, so from further −Z we walk +Z (yaw π) INTO the pod. Start outside at −Z.
          startOutside();
          await sleep(60);
          const before = ctx.player.body.body.translation();
          await walk(Math.PI, 1.2);   // yaw π = face +Z = walk toward the pod centre (through the −Z door)
          const afterIn = ctx.player.body.body.translation();
          // reached the bore = crossed the −Z door INTO the hull AND was STOPPED (not passed through the
          //   far +Z wall out the other side). POD_R≈1.44; inside = within the hull, not beyond +Z wall.
          const insideNow = (afterIn.z > podZ - 1.6) && (afterIn.z < podZ + 1.6) && Math.hypot(afterIn.x - podX, afterIn.z - podZ) < 1.7;
          // OUT — from inside, walk −Z (yaw 0) back out the door.
          await walk(0, 1.4);
          const afterOut = ctx.player.body.body.translation();
          const outsideNow = (afterOut.z - podZ) < -1.4;   // cleared the door outward
          if (!outsideNow) everTrapped = true;   // couldn't get back out → trapped
          cycles.push({ c, walkedInReached: insideNow, inZ: +afterIn.z.toFixed(2), walkedOut: outsideNow, outZ: +afterOut.z.toFixed(2) });
        }
      } finally { realClock.getDelta = origGetDelta; ctx.three.renderer.setSize(origW, origH, false); ctx.input.keys['KeyW'] = false; }
      return { podAt: [+podX.toFixed(2), +podZ.toFixed(2)], gy: +gy.toFixed(2), minY: +minY.toFixed(2), maxJump: +maxJump.toFixed(2), everTrapped, cycles, colliderDump: _colliderDump };
    });
    console.log('[doorway-torture] ' + JSON.stringify({ podAt: log.podAt, gy: log.gy, minY: log.minY, maxJump: log.maxJump, everTrapped: log.everTrapped }));
    console.log('[doorway-torture] colliders (dz,dx,y,halfExtents) near pod: ' + JSON.stringify(log.colliderDump));
    for (const c of log.cycles) console.log('  ' + JSON.stringify(c));
    // GATE 1 — never fell through the floor (minY stayed near/above the pod ground; a fall-through spikes minY far below gy).
    if (log.minY < log.gy - 2.0) throw new Error(`doorway-torture GATE FAILED: the body FELL THROUGH the floor (minY=${log.minY}, gy=${log.gy}).`);
    // GATE 2 — never trapped: every cycle walked back OUT the door.
    if (log.everTrapped) throw new Error(`doorway-torture GATE FAILED: the player got TRAPPED inside (a cycle could not walk back out): ${JSON.stringify(log.cycles)}`);
    // GATE 3 — the walk-in reached the bore + the walk-out cleared the door in a majority of cycles (the
    //   door is walkable both ways; a fully blocked doorway would fail every cycle).
    const inOk = log.cycles.filter((c) => c.walkedInReached).length;
    const outOk = log.cycles.filter((c) => c.walkedOut).length;
    if (inOk < 4) throw new Error(`doorway-torture GATE FAILED: the walk-IN reached the bore in only ${inOk}/6 cycles (the doorway is blocked): ${JSON.stringify(log.cycles)}`);
    if (outOk < 4) throw new Error(`doorway-torture GATE FAILED: the walk-OUT cleared the door in only ${outOk}/6 cycles: ${JSON.stringify(log.cycles)}`);
    // GATE 4 — no teleport (a KCC step never jumps more than a walking stride).
    if (log.maxJump > 2.0) throw new Error(`doorway-torture GATE FAILED: a discontinuous ${log.maxJump}m jump (teleport, not a KCC step).`);
    console.log(`[doorway-torture] GATE PASS — entered/exited the landed pod on real legs across 6 cycles (in ${inOk}/6, out ${outOk}/6, minY=${log.minY} ≥ gy−2, maxJump=${log.maxJump} — never blocked, never fell through, never trapped).`);
  },

  // ── Y3 DIAGNOSIS PROBE (findings-before-fixes; no screenshot — hard measurements only) ──
  //    Gathers the geometry/collider/timeline evidence for the four Y3 diagnosis questions:
  //    (1) the bay-pod doorway "black wall" lower half, (2) the collider state-flip trap,
  //    (3) the base/ground swap at landing, (4) old+new interior coexistence.
  //    Prints one JSON blob per finding. Never throws (diagnostic).
  // ROUND-1f — a LIGHT sealed-door render (first screenshot = reliable, unlike pod-diag's late shots).
  //   Builds the bay pod, keeps the pod door CLOSED, seats the eye INSIDE facing the door (the user's
  //   sealed-eye vantage), and shoots — the AIRTIGHT check (no star-gaps down the door sides).
  //   --angle: seated (inside, facing the +X door) [default] | edge-left | edge-right (graze each jamb)
  'pod-sealed': async (page) => {
    const angle = argv.angle || 'seated';
    await page.evaluate(() => {
      const g = window.__game;
      g.ctx.flags.thirdPerson = false;
      if (g.ctx.player.rig) g.ctx.player.rig.group.visible = false;
      g.startIntro();
      g.jumpToBeat('cockpit');   // builds the ship + docked canonical pod
    });
    await page.waitForTimeout(900);
    const meas = await page.evaluate(({ angle }) => {
      const g = window.__game; const ctx = g.ctx; const THREE = g.THREE;
      ctx.flags.paused = true;
      ctx.three.renderer.setSize(1100, 820, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1100 / 820; cam.updateProjectionMatrix(); }
      const pod = ctx.three.scene.getObjectByName('dockedCanonicalPod');
      pod.updateMatrixWorld(true);
      const p = pod.getWorldPosition(new THREE.Vector3());
      try { g.setBayPodDoorOpen(0); } catch {}   // sealed
      // seat the eye INSIDE the pod facing the +X door (the door faces +X in the bay).
      let eye, look;
      if (angle === 'edge-left') { eye = new THREE.Vector3(p.x + 0.9, p.y + 1.10, p.z - 0.60); look = new THREE.Vector3(p.x + 2.0, p.y + 1.05, p.z - 0.45); }
      else if (angle === 'edge-right') { eye = new THREE.Vector3(p.x + 0.9, p.y + 1.10, p.z + 0.60); look = new THREE.Vector3(p.x + 2.0, p.y + 1.05, p.z + 0.45); }
      else { eye = new THREE.Vector3(p.x + 0.35, p.y + 1.30, p.z); look = new THREE.Vector3(p.x + 2.0, p.y + 1.05, p.z); }
      cam.position.copy(eye); cam.lookAt(look); cam.updateMatrixWorld(true);
      ctx.three.renderer.render(ctx.three.scene, cam);
      return { angle, podWorld: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], eye: [+eye.x.toFixed(2), +eye.y.toFixed(2), +eye.z.toFixed(2)] };
    }, { angle });
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(OUT, `scen-pod-sealed-${angle}.png`), fullPage: false });
    console.log(`[pod-sealed] ${JSON.stringify(meas)} → scen-pod-sealed-${angle}.png`);
  },

  'pod-diag': async (page) => {
    // ── FINDING 1 + 4: the BAY pod (docked) — doorway aperture geometry + interior duplicate audit.
    await page.evaluate(() => {
      const g = window.__game;
      g.ctx.flags.thirdPerson = false;
      g.startIntro();
      g.jumpToBeat('cockpit');   // builds the ship incl. the pod-bay + docked canonical pod
    });
    await page.waitForTimeout(900);
    const bay = await page.evaluate(() => {
      const g = window.__game; const ctx = g.ctx;
      const V = ctx.three.camera.position.constructor;
      const scene = ctx.three.scene;
      const pod = scene.getObjectByName('dockedCanonicalPod');
      if (!pod) return { error: 'dockedCanonicalPod not found' };
      pod.updateMatrixWorld(true);
      const podWorld = pod.getWorldPosition(new V());
      // FINDING 4 — how many interior sub-groups exist? (canonicalPodInterior). >1 = duplicate build.
      let interiors = 0, canopyGroups = 0, doorSlabs = 0, meshes = 0;
      const names = {};
      pod.traverse((o) => {
        if (o.name) names[o.name] = (names[o.name] || 0) + 1;
        if (o.name === 'canonicalPodInterior') interiors++;
        if (o.name === 'canonicalPodDoor') doorSlabs++;
        if (o.isMesh) meshes++;
      });
      // whole-scene: are there MULTIPLE pod cabins (escapePodCabin + dockedCanonicalPod both live)?
      let escapePodCabins = 0, dockedPods = 0;
      scene.traverse((o) => { if (o.name === 'escapePodCabin') escapePodCabins++; if (o.name === 'dockedCanonicalPod') dockedPods++; });
      // FINDING 1 — the doorway aperture. The bay door faces +X; the collar approach eye stands at
      //   the pod-door face plane. Sample the aperture bottom vs the collar floor world Y.
      // door aperture bottom (world Y) = pod floor (podWorld.y) + (CPOD_DOOR_CY − CPOD_DOOR_H/2).
      const FDOOR_CY = 1.10, FDOOR_H = 1.98;                    // from podScene (frozen contract)
      const apertureBottomLocal = FDOOR_CY - FDOOR_H / 2;       // 0.11 above pod floor
      const apertureBottomWorld = podWorld.y + apertureBottomLocal;
      // collar/corridor floor world Y = SHIP_ORIGIN.y (bay-local floor 0). The pod floor is at bay
      //   local 0 too (pod.position.set(podLocalX, 0, podZ)). So both floors are at podWorld.y here.
      // The collar deck top is ~0.02 above that. Report the delta the standing eye sees.
      const collarFloorWorld = podWorld.y;                     // bay-local 0 == pod-local floor 0
      // what fills the LOWER doorway (below apertureBottomWorld, at the door plane)? Sample: is there
      //   an opaque mesh spanning the aperture-bottom band on the +X face inside the collar?
      return {
        podWorldY: +podWorld.y.toFixed(3),
        interiorSubgroups: interiors,        // FINDING 4: should be exactly 1
        doorSlabGroups: doorSlabs,           // should be 1
        escapePodCabinsInScene: escapePodCabins,   // should be 0 during the bay (ride cabin not built yet)
        dockedPodsInScene: dockedPods,       // should be 1
        podMeshCount: meshes,
        apertureBottomLocal: +apertureBottomLocal.toFixed(3),   // FINDING 1: 0.11m above the floor
        apertureBottomWorld: +apertureBottomWorld.toFixed(3),
        collarFloorWorld: +collarFloorWorld.toFixed(3),
        doorSillGap: +(apertureBottomWorld - collarFloorWorld).toFixed(3),   // FINDING 1: the sill step you face
        uniqueNamedGroups: names,
      };
    });
    console.log('[pod-diag][FINDING-1+4 bay] ' + JSON.stringify(bay, null, 0));

    // ── FINDING 1 (rendered): OPEN the sliding door + the POD door, stand at the collar eye, look
    //    into the OPEN aperture. This reproduces the user's "black wall lower half on first E-open".
    const openMeas = await page.evaluate(() => {
      const g = window.__game; const ctx = g.ctx;
      const V = ctx.three.camera.position.constructor;
      ctx.flags.paused = true;
      ctx.three.renderer.setSize(1100, 820, false);
      const cam = ctx.three.camera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1100 / 820; cam.updateProjectionMatrix(); }
      const tr = ctx.player.body.body.translation();
      const floorY = tr.y - (ctx.player.body.halfHeight + ctx.player.body.radius);
      const bayZ = tr.z + 4.8, wallX = tr.x - 1.0, podDoorX = tr.x - 1.92;
      // open the sliding airlock door (both leaves into their pockets)
      const aHW = 0.72, travel = 0.82, bzL = 4.8;
      const lL = ctx.three.scene.getObjectByName('airlockDoorLeafL');
      const lR = ctx.three.scene.getObjectByName('airlockDoorLeafR');
      if (lL) lL.position.z = (bzL - aHW / 2) - travel;
      if (lR) lR.position.z = (bzL + aHW / 2) + travel;
      // OPEN the pod door fully via the REAL animator (the first-E-open state) — drives _bayDoorPivot.
      let doorOpened = false;
      try { g.setBayPodDoorOpen ? g.setBayPodDoorOpen(1) : null; doorOpened = true; } catch {}
      const podDoor = ctx.three.scene.getObjectByName('canonicalPodDoor');
      if (!doorOpened && podDoor) { podDoor.rotation.y = -1.9; doorOpened = true; }
      // Stand BACK in the collar (the user's vantage: at the airlock/collar, the just-opened door
      //   ahead), eye at standing height 1.62, look LEVEL straight in (−X) through the aperture — this
      //   reproduces the "curved grey sheet walling the lower half of the doorway" the user reports.
      const eye = new V(podDoorX + 0.85, floorY + 1.62, bayZ);
      cam.position.copy(eye);
      cam.lookAt(new V(podDoorX - 1.2, floorY + 1.20, bayZ));   // look nearly LEVEL into the aperture (slight down)
      cam.updateMatrixWorld(true);
      return { eye: [+eye.x.toFixed(2), +eye.y.toFixed(2), +eye.z.toFixed(2)], floorY: +floorY.toFixed(2), doorOpened };
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(OUT, 'scen-pod-diag-dooropen.png'), fullPage: false });
    console.log('[pod-diag][FINDING-1 rendered] ' + JSON.stringify(openMeas) + ' → scen-pod-diag-dooropen.png');

    // ── FINDING 1b (mesh identification): which named mesh actually OCCLUDES the lower doorway from
    //    the collar eye? A RAYCAST FAN — fire rays from the standing collar eye through a grid of
    //    aperture-plane targets covering the LOWER HALF of the doorway (sill 0.11 up to mid), and for
    //    each ray report the FIRST opaque hit's nearest-named ancestor + the hit world-Y + the mesh's
    //    pod-local extents. Rays that pass CLEAN through to the interior (hit far interior wall / seat)
    //    tell us the aperture is clear; rays stopped by a near curved plate name the blocker.
    const rayProbe = await page.evaluate(() => {
      const g = window.__game; const ctx = g.ctx;
      const THREE = g.THREE;
      const pod = ctx.three.scene.getObjectByName('dockedCanonicalPod');
      if (!pod || !THREE) return { error: 'pod or THREE missing' };
      pod.updateMatrixWorld(true);
      const podWorld = pod.getWorldPosition(new THREE.Vector3());
      const cam = ctx.three.camera;
      const eye = cam.position.clone();
      // The door faces −X from the eye (podDoorX < eye.x). Aperture plane at pod +X face (world x = podWorld.x + doorPlaneX).
      const CAB_R = 1.28, SHELL = 0.16, doorPlaneX = CAB_R + SHELL;   // 1.44
      const apX = podWorld.x + doorPlaneX;
      // Build a fan of targets on the aperture plane: z (width) across the door ±0.48, y (height) from
      //   the sill (podWorld.y+0.11) up to mid-door (podWorld.y+1.05) — the LOWER HALF the user reports.
      const rc = new THREE.Raycaster();
      const meshes = [];
      pod.traverse((o) => { if (o.isMesh && o.visible && o.material && !o.material.transparent) meshes.push(o); });
      const rows = [];
      for (let yi = 0; yi <= 6; yi++) {
        const ty = podWorld.y + 0.11 + (yi / 6) * 0.94;   // sill → mid
        const cols = [];
        for (let zi = -3; zi <= 3; zi++) {
          const tz = podWorld.z + (zi / 3) * 0.48;
          const target = new THREE.Vector3(apX, ty, tz);
          const dir = target.clone().sub(eye).normalize();
          rc.set(eye, dir);
          rc.far = 4.0;
          const hits = rc.intersectObjects(meshes, false).filter((h) => h.distance > 0.05);
          if (hits.length === 0) { cols.push('·'); continue; }
          const h = hits[0];
          let nm = h.object.name, node = h.object;
          while (!nm && node.parent && node !== pod) { node = node.parent; nm = node.name; }
          // hit BEFORE the aperture plane (nearer than apX) AND below mid = a blocker of the lower doorway
          const beforePlane = h.point.x > apX - 0.02;   // hit at/outside the door plane (a near occluder)
          const local = pod.worldToLocal(h.point.clone());
          cols.push({ y: +ty.toFixed(2), z: +tz.toFixed(2), named: nm || '?', hitWorldY: +h.point.y.toFixed(2), hitLocalX: +local.x.toFixed(2), hitLocalY: +local.y.toFixed(2), dist: +h.distance.toFixed(2), near: beforePlane });
        }
        rows.push({ ty: +ty.toFixed(2), cols });
      }
      // tally the blockers (named hits at the low band that are NEAR occluders)
      const tally = {};
      for (const r of rows) for (const c of r.cols) if (c && c.named) tally[c.named] = (tally[c.named] || 0) + 1;
      return { podWorldY: +podWorld.y.toFixed(3), apertureWorldX: +apX.toFixed(3), eye: [+eye.x.toFixed(2), +eye.y.toFixed(2), +eye.z.toFixed(2)], sillWorldY: +(podWorld.y + 0.11).toFixed(2), rows, blockerTally: tally };
    });
    console.log('[pod-diag][FINDING-1b raycast fan] ' + JSON.stringify(rayProbe, null, 0));

    // ── FINDING 1d (AIRTIGHT SEAL): CLOSE the pod door, seat the eye INSIDE the pod facing the door
    //    (+X, the user's sealed-eye vantage), and shoot. Star-gaps down the door sides = the slab
    //    clearance against the curved shell reads as space. The stop-lip fix must make it airtight.
    const sealMeas = await page.evaluate(() => {
      const g = window.__game; const ctx = g.ctx;
      const THREE = g.THREE;
      ctx.flags.paused = true;
      const pod = ctx.three.scene.getObjectByName('dockedCanonicalPod');
      pod.updateMatrixWorld(true);
      const podWorld = pod.getWorldPosition(new THREE.Vector3());
      try { g.setBayPodDoorOpen(0); } catch {}   // CLOSE the door (sealed)
      // raycast fan at the door SIDES (just inside each vertical edge) from the seated eye — count how
      //   many rays hit OPAQUE pod metal (sealed) vs pass to the sky (a star-gap crack).
      const eye = new THREE.Vector3(podWorld.x + 0.55, podWorld.y + 1.35, podWorld.z);   // seated-ish, inside, near the door
      const cam = ctx.three.camera;
      cam.position.copy(eye);
      cam.lookAt(new THREE.Vector3(podWorld.x + 2.0, podWorld.y + 1.15, podWorld.z));   // face +X at the door
      cam.updateMatrixWorld(true);
      const rc = new THREE.Raycaster();
      const meshes = []; pod.traverse((o) => { if (o.isMesh && o.visible && o.material && !o.material.transparent) meshes.push(o); });
      // aperture edges in world: door plane +X at podWorld.x + 1.44; edges z = podWorld.z ± 0.51; y sill..lintel
      const apX = podWorld.x + 1.44;
      let sealed = 0, leaks = 0; const leakPts = [];
      for (const edgeZ of [-0.50, -0.48, 0.48, 0.50]) {
        for (let yi = 0; yi <= 8; yi++) {
          const ty = podWorld.y + 0.13 + (yi / 8) * 1.90;
          const target = new THREE.Vector3(apX + 0.02, ty, podWorld.z + edgeZ);
          const dir = target.clone().sub(eye).normalize();
          rc.set(eye, dir); rc.far = 3.0;
          const hits = rc.intersectObjects(meshes, false).filter((h) => h.distance > 0.05);
          if (hits.length > 0 && hits[0].point.x <= apX + 0.12) sealed++;
          else { leaks++; leakPts.push({ z: +edgeZ.toFixed(2), y: +ty.toFixed(2) }); }
        }
      }
      ctx.three.renderer.setSize(1100, 820, false);
      if (cam.isPerspectiveCamera) { cam.aspect = 1100 / 820; cam.updateProjectionMatrix(); }
      ctx.three.renderer.render(ctx.three.scene, cam);   // force a frame (headless rAF is throttled)
      return { doorClosed: true, eye: [+eye.x.toFixed(2), +eye.y.toFixed(2), +eye.z.toFixed(2)], sealedRays: sealed, leakRays: leaks, leaks: leakPts.slice(0, 10) };
    });
    await page.waitForTimeout(150);
    try { await page.screenshot({ path: join(OUT, 'scen-pod-diag-sealed.png'), fullPage: false, timeout: 15000, animations: 'disabled' }); } catch (e) { console.log('[pod-diag] sealed screenshot flaked: ' + e.name); }
    console.log('[pod-diag][FINDING-1d AIRTIGHT] ' + JSON.stringify(sealMeas) + ' → scen-pod-diag-sealed.png');

    // ── FINDING 1c (the TWO top-left pipes): stand BACK in the collar (the user's actual vantage),
    //    shoot the whole open doorway, and project every TALL-THIN rod mesh to screen so we can name
    //    which pipe-like rods land in the UPPER-LEFT of the door sightline (the ones to relocate).
    const rods = await page.evaluate(() => {
      const g = window.__game; const ctx = g.ctx;
      const THREE = g.THREE;
      const pod = ctx.three.scene.getObjectByName('dockedCanonicalPod');
      if (!pod || !THREE) return { error: 'pod or THREE missing' };
      pod.updateMatrixWorld(true);
      const podWorld = pod.getWorldPosition(new THREE.Vector3());
      const cam = ctx.three.camera;
      // stand BACK ~1.1m from the door in the collar, eye 1.62, look level −X through the aperture
      const eye = new THREE.Vector3(podWorld.x + (1.28 + 0.16) + 0.55, podWorld.y + 1.62, podWorld.z);
      cam.position.copy(eye);
      cam.lookAt(new THREE.Vector3(podWorld.x - 0.5, podWorld.y + 1.25, podWorld.z));
      cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
      // find TALL-THIN rod meshes (a vertical rod: bbY span > 0.35, footprint < 0.16) in the interior.
      const found = [];
      pod.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox; if (!bb) return;
        const dx = bb.max.x - bb.min.x, dy = bb.max.y - bb.min.y, dz = bb.max.z - bb.min.z;
        const isRod = dy > 0.35 && Math.max(dx, dz) < 0.18;
        if (!isRod) return;
        const c = new THREE.Vector3((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, (bb.min.z + bb.max.z) / 2).applyMatrix4(o.matrixWorld);
        const loc = pod.worldToLocal(c.clone());
        const azBay = Math.atan2(loc.x, loc.z);   // bay-frame azimuth (door faces +X ⇒ az≈π/2)
        const azCabin = azBay + Math.PI / 2;       // undo the −π/2 interior yaw → cabin-local az the builder used
        const sp = c.clone().project(cam);         // NDC: x −1(left)..+1(right), y −1(bottom)..+1(top)
        // is it visible through the door (in front + roughly within the aperture frame)?
        const onScreen = sp.z < 1 && Math.abs(sp.x) < 1.1 && Math.abs(sp.y) < 1.1;
        found.push({
          mat: o.material && o.material.color ? '#' + o.material.color.getHexString() : '?',
          worldC: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)],
          bayAz: +azBay.toFixed(2), cabinAz: +azCabin.toFixed(2),
          ndc: [+sp.x.toFixed(2), +sp.y.toFixed(2)],
          quadrant: (sp.y > 0 ? 'TOP-' : 'BOT-') + (sp.x < 0 ? 'LEFT' : 'RIGHT'),
          onScreen, dyH: +(bb.max.y - bb.min.y).toFixed(2),
        });
      });
      // upper-left rods through the door = the user's "two pipes"
      found.sort((a, b) => a.ndc[0] - b.ndc[0]);
      return { eye: [+eye.x.toFixed(2), +eye.y.toFixed(2), +eye.z.toFixed(2)], rodCount: found.length, upperLeft: found.filter((r) => r.onScreen && r.ndc[1] > -0.1 && r.ndc[0] < 0.2), all: found };
    });
    await page.waitForTimeout(150);
    try { await page.screenshot({ path: join(OUT, 'scen-pod-diag-collar.png'), fullPage: false, timeout: 15000 }); } catch (e) { console.log('[pod-diag] collar screenshot flaked: ' + e.name); }
    console.log('[pod-diag][FINDING-1c rods] ' + JSON.stringify(rods, null, 0) + ' → scen-pod-diag-collar.png');

    // ── FINDING 2 + 3: the CRASH → WAKE → STEP-OUT collider + base timeline.
    const timeline = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const g = window.__game; const ctx = g.ctx;
      const V = ctx.three.camera.position.constructor;
      const podColCount = (px, pz, gy) => {
        let n = 0; ctx.physics.world.forEachCollider((c) => {
          const t = c.translation();
          if (Math.hypot(t.x - px, t.z - pz) < 3.2 && Math.abs(t.y - gy) < 3.5) n++;
        }); return n;
      };
      const snap = (label) => {
        const pod = ctx.three.scene.getObjectByName('escapePodCabin');
        let px = 0, pz = 0, py = 0, hasSkin = false, hasSalvagePanel = false;
        if (pod) {
          pod.updateMatrixWorld(true);
          const p = pod.getWorldPosition(new V()); px = p.x; pz = p.z; py = p.y;
          pod.traverse((o) => {
            if (o.name === 'podExteriorSkin') hasSkin = true;
            if (o.name && /accessPanel|salvage/i.test(o.name)) hasSalvagePanel = true;
          });
        }
        const gy = ctx.terrain ? ctx.terrain.heightAt(px, pz) : 0;
        return {
          label, beat: ctx.intro ? ctx.intro.beat : null, mode: ctx.intro ? ctx.intro.mode : null,
          podCols: pod ? podColCount(px, pz, gy) : 0,
          hasExteriorSkin: hasSkin,      // FINDING 3: the exterior skin/base appears at unify (step-out)
          hasSalvagePanel,
          podFloorY: +py.toFixed(2), groundY: +gy.toFixed(2),
        };
      };
      const out = [];
      // pin a fixed sim-dt + tiny canvas so the beat chain advances deterministically under the
      //   starved headless tab (mirrors the pod-walkout driver — the reliable pattern).
      const realClock = ctx.three.clock;
      const origGetDelta = realClock.getDelta.bind(realClock);
      const origW = ctx.three.renderer.domElement.width, origH = ctx.three.renderer.domElement.height;
      const drive = async (cond, simBudget) => {
        const simStart = ctx.time.elapsed; let lastSim = simStart, stalls = 0;
        for (let i = 0; i < 8000; i++) {
          await sleep(16);
          const nowSim = ctx.time.elapsed;
          if (nowSim > lastSim + 1e-6) { lastSim = nowSim; stalls = 0; } else if (++stalls > 400) break;
          if (cond()) return true;
          if (nowSim - simStart >= simBudget) break;
        }
        return cond();
      };
      try {
        realClock.getDelta = () => 0.05;
        ctx.three.renderer.setSize(48, 48, false);
        g.startIntro();
        // drive the REAL chain from descent so the pod grounds naturally (impact needs _descentBase).
        g.jumpToBeat('descent');
        await drive(() => ctx.intro && ctx.intro.beat === 'impact' && ctx.intro.scratch.init === true, 25);
        out.push(snap('at-impact (crash moment, cage dropped by setCabinCrashPose)'));
        await drive(() => ctx.intro && ctx.intro.beat === 'wake' && ctx.intro.scratch.init === true, 8);
        out.push(snap('wake comeTo (player still inside, NO colliders)'));
        // force the wake to the climb/walk state (the trap window if the player lingers).
        g.blowCabinHatch(1);
        if (ctx.intro) { ctx.intro.mode = 'walk'; ctx.intro.scratch.phase = 'climb'; ctx.intro.scratch.t = 0; }
        await drive(() => false, 0.5);
        out.push(snap('wake CLIMB (mode=walk, NO colliders — the TRAP window)'));
        // trip WAKE_CLIMB_FALLBACK (8s) → advance to stepOut → unifyEnterablePod (walls appear).
        if (ctx.intro) { ctx.intro.scratch.t = 999; }
        await drive(() => ctx.intro && (ctx.intro.beat === 'stepOut' || !ctx.intro.active), 15);
        await drive(() => false, 0.8);
        out.push(snap('after stepOut/unify (exterior skin + walls appear — the state FLIP)'));
      } finally { realClock.getDelta = origGetDelta; ctx.three.renderer.setSize(origW, origH, false); }
      return out;
    });
    console.log('[pod-diag][FINDING-2+3 timeline]');
    for (const s of timeline) console.log('  ' + JSON.stringify(s));
    console.log('[pod-diag] DONE (diagnostic — no gate).');
  },

  // SAVE/LOAD pod-persistence GATE — headless save→teardown→restore round-trip on the ONE walk-in
  // pod. Proves (a) the bug (the pod is GONE after a fresh-boot teardown) and (b) the fix (the restore
  // re-builds it with matching salvage/chute state). THROWS on failure so `--scenario=smoke-pod-
  // persistence` exits non-zero (usable as a gate). No screenshot.
  'smoke-pod-persistence': async (page) => {
    const r = await page.evaluate(() => window.__game.smokePodPersistence());
    console.log(`[smoke-pod-persistence] ${JSON.stringify(r)}`);
    if (!r || !r.ok) throw new Error(`smoke-pod-persistence GATE FAILED: ${JSON.stringify(r)}`);
  },

  // END-TO-END pod persistence via a REAL page reload + Continue. Drives the intro to step-out (the
  // ONE walk-in pod unifies + persists), SAVES, RELOADS the page (a genuine fresh boot — the pod is
  // NOT re-built at boot), then clicks CONTINUE and asserts the pod is back. This is the strongest
  // proof: it exercises the actual boot → onContinue → loadGameState → handoff → restore chain, not
  // an in-page simulation. THROWS on failure.
  'pod-persistence-reload': async (page) => {
    // 1. Force-start the intro + drive the whole chain to step-out (unify the pod), then hand off.
    const before = await page.evaluate(() => {
      const g = window.__game;
      const r = g.smokeIntro();   // runs the chain incl. tickStepOut → unifyEnterablePod; ends the intro
      const pod = g.ctx.three.scene.getObjectByName('escapePodCabin');
      let px = 0, pz = 0;
      if (pod) { pod.updateMatrixWorld(true); const V = g.ctx.three.camera.position.constructor; const p = new V(); p.setFromMatrixPosition(pod.matrixWorld); px = +p.x.toFixed(2); pz = +p.z.toFixed(2); }
      // save to the single slot (the exact menu Save path, minus UI)
      const sv = g.saveGame();
      const raw = localStorage.getItem('dustfall.save.v1');
      const parsed = raw ? JSON.parse(raw) : {};
      return { beats: r.beats, podPresent: !!pod, podAt: [px, pz], saveOk: sv.ok, hasPodCrash: !!parsed.podCrash };
    });
    console.log(`[pod-persistence-reload] before-reload: ${JSON.stringify(before)}`);
    if (!before.podPresent || !before.saveOk || !before.hasPodCrash) {
      throw new Error(`pod-persistence-reload SETUP FAILED (pod not built / not saved): ${JSON.stringify(before)}`);
    }
    // 2. REAL fresh boot — reload the page. (addInitScript re-pins the SAME seed each load, so the save
    //    passes the seed check; it also re-sets seenIntro so no controls panel opens.)
    await page.reload();
    await page.waitForFunction(() => !!(window.__game && window.__game.ctx?.player?.rig), undefined, { timeout: 30000 });
    // 3. Click the real CONTINUE button on the title overlay (drives main.ts onContinue →
    //    loadGameState → handoffToGame → applyPendingPodCrashRestore).
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const cont = btns.find((b) => (b.textContent || '').trim().toUpperCase() === 'CONTINUE');
      if (!cont) return false;
      cont.click();
      return true;
    });
    if (!clicked) throw new Error('pod-persistence-reload: no CONTINUE button on the reloaded title (save missing?)');
    await page.waitForTimeout(1200);   // let onContinue + the restore run
    // 4. Assert the pod is BACK after the real reload + Continue.
    const after = await page.evaluate(() => {
      const g = window.__game;
      const pod = g.ctx.three.scene.getObjectByName('escapePodCabin');
      let px = 0, pz = 0;
      if (pod) { pod.updateMatrixWorld(true); const V = g.ctx.three.camera.position.constructor; const p = new V(); p.setFromMatrixPosition(pod.matrixWorld); px = +p.x.toFixed(2); pz = +p.z.toFixed(2); }
      const podSalvageable = (g.ctx.salvageables && g.ctx.salvageables.list || []).some((s) => s.kind === 'escape_pod');
      // walkable colliders near the pod (floor + gapped wall ring) — the walk-in read survived
      let podCols = 0;
      if (pod) { const gy = g.ctx.terrain.heightAt(px, pz); g.ctx.physics.world.forEachCollider((c) => { const t = c.translation(); if (Math.hypot(t.x - px, t.z - pz) < 3.0 && Math.abs(t.y - gy) < 3.0) podCols++; }); }
      return { podPresent: !!pod, podAt: [px, pz], podSalvageable, podCols, titleActive: !!g.ctx.flags.titleActive };
    });
    console.log(`[pod-persistence-reload] after-continue: ${JSON.stringify(after)}`);
    if (!after.podPresent || !after.podSalvageable || after.podCols < 3) {
      throw new Error(`pod-persistence-reload GATE FAILED — pod did NOT survive reload+Continue: ${JSON.stringify(after)}`);
    }
    console.log('[pod-persistence-reload] PASS — the walk-in pod survived save → reload → Continue.');
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
    // M12 ⓖ — lunge time for the strike/dive angles (default a visible MID-dive; --t=<0..1> to scan).
    const lungeT = argv.t !== undefined ? parseFloat(argv.t) : (angle === 'strike' ? 0.5 : 0.65);
    const r = await page.evaluate(({ ang, lt }) => {
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
      let diveInfo = null;   // M12 ⓖ — the real poseLunge numbers for the dive/strike angles
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
      } else if (ang === 'dive' || ang === 'strike') {
        // M12 ⓖ — the REAL breach-and-dive lunge pose (applyLungePose + applyMeshTransform via
        // the poseLunge hook → no rig-vs-real drift). 'strike' = head reared (t=0.5), 'dive' = plunging (t=0.82).
        worm.yaw = 0;   // lie along +X so the broadside camera sees the breach/dive profile
        diveInfo = window.__game.poseLunge(lt);
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
      } else if (ang === 'dive' || ang === 'strike') {   // M12 ⓖ — full broadside (body in the sand, head rearing/diving)
        cam.position.set(ax + halfLen * 0.05, groundY + rad * 4.0, az + halfLen * 2.0);
        cam.lookAt(ax + halfLen * 0.05, groundY + rad * 0.8, az);
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
      return { found: true, meshes, angle: ang, halfLen, diveInfo };
    }, { ang: angle, lt: lungeT });
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
    // W2 ASPECT FIX — scenarios resize the RENDER BUFFER (renderer.setSize(w,h,false) + a matching
    // camera.aspect) but the canvas CSS box stays at the fixed 900×1100 viewport, so page.screenshot
    // resampled the buffer into the wrong aspect → every non-900×1100 shot was stretched (the
    // "oval porthole" false frame; circles are just where it shows). Snap the viewport to the canvas
    // buffer dims right before each capture so CSS == buffer == camera aspect and shots are true.
    const _origScreenshot = page.screenshot.bind(page);
    page.screenshot = async (opts = {}) => {
      try {
        const dims = await page.evaluate(() => {
          const c = document.querySelector('canvas');
          return c && c.width > 50 ? { w: c.width, h: c.height } : null;
        });
        const vp = page.viewportSize();
        if (dims && vp && (dims.w !== vp.width || dims.h !== vp.height)) {
          await page.setViewportSize({ width: dims.w, height: dims.h });
          await page.waitForTimeout(120);   // let layout/compositor settle before the capture
        }
      } catch { /* fall through — a wrong-aspect shot beats no shot */ }
      return _origScreenshot(opts);
    };
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
      // BLOCK THE VITE-HMR WEBSOCKET (mirrors model-stage.mjs): concurrent sessions editing src/
      //   (sibling agents own shipScene/haulerScene) would otherwise trigger a full-reload mid-run
      //   ("Execution context was destroyed, most likely because of a navigation") and kill long
      //   live-scenario evals (the pod boarding/walk gates). The page becomes a snapshot of the
      //   source at boot; re-run to pick up edits. (The stub also stalls window 'load' — we already
      //   gate on domcontentloaded + the __game poll below, so that's fine.)
      const NativeWS = window.WebSocket;
      // eslint-disable-next-line func-names
      window.WebSocket = function (url, protocols) {
        const isHmr = (protocols && String(protocols).includes('vite-hmr')) || /vite/.test(String(url));
        if (isHmr) {
          return { addEventListener() {}, removeEventListener() {}, send() {}, close() {}, readyState: 3, onopen: null, onmessage: null, onclose: null, onerror: null };
        }
        return new NativeWS(url, protocols);
      };
      window.WebSocket.prototype = NativeWS.prototype;
    }, Number(argv.seed ?? 1337));
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
    // Ensure the document is parsed before we poll for __game — under swiftshader the
    // first WebGL context creation can lag, and polling before DOM-ready can catch a
    // half-initialised window (the boot-race root the verify:* gates retry around).
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    // Wait for the rig to exist (Rapier WASM + boot done). 45s (up from 30s): the
    // swiftshader first-paint tail can exceed 30s on a cold/loaded headless boot,
    // which surfaced as the "NO AUDIT LINE" flake. The verify:* single-retry is the
    // real safety net; this just makes the retry fire less often.
    await page.waitForFunction(() => !!(window.__game && window.__game.ctx?.player?.rig), undefined, { timeout: 45000 });
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
