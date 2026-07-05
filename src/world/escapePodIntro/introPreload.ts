// Escape-pod intro — the UP-FRONT PRELOAD PIPELINE (the user's #1 perf idea).
// ─────────────────────────────────────────────────────────────────────────────
// THE PROBLEM (the user's reported "freezes/stutters between the intro phases"):
// each intro beat builds heavy geometry + NEW materials ON BEAT ENTRY — the ship
// interior (~1400 meshes) at cockpit, the hauler exterior + its explosion FX at
// shipExplode, the pod cabin at descent — AND WebGL lazily compiles every new
// shader on its FIRST DRAW. Those mid-play costs are the hitches.
//
// THE FIX: pay ALL of it up front, once, behind an honest loading screen, BEFORE
// the cockpit beat begins. This module is the async step-queue that does it:
//   1. BUILD every intro scene at its offset (invisible to the player, far above
//      the desert): the ship interior, the hauler exterior, the pod cabin. The beat
//      controllers' build calls are idempotent (`if (group) return`), so the beats
//      REUSE these prebuilt scenes instead of rebuilding — the build-on-entry stays
//      as the fallback for the dev/jumpToBeat paths.
//   2. FORCE-COMPILE every shader: renderer.compileAsync per prebuilt scene, PLUS a
//      brief hidden warm-up DRAW to a 1×1 scissored viewport (some drivers only fully
//      warm a program on a real draw) — including the space-mode sky states, the
//      descent re-entry plasma/shimmer, and the hauler explosion FX materials.
//   3. YIELD to the frame loop between steps (await a rAF) so the bar animates + the
//      tab never hard-freezes.
//
// DISPOSE / STATE-RESTORE DISCIPLINE (the intro's recurring bug class):
//   • The prebuilt scenes are HIDDEN (group.visible=false) so they don't render mid-beat
//     until the beat that owns them makes them visible (the beats already position them
//     at their offset; cockpit's buildShipScene stays a no-op reuse, etc.).
//   • The warm-up TOUCHES global renderer/sky state (space-mode sky, exposure). Every
//     touched value is snapshotted before the pass and RESTORED after, so the cockpit
//     fades in on a clean orbit exactly as if the preload never ran.
//   • This runs on the NEW-GAME intro path only (FEATURES.escapePodIntro). Flag off →
//     preloadIntro is never called → zero impact.
//
// See docs/architecture-escape-pod-intro.md (State-restore) + the CLAUDE.md perf note.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import type { GameContext } from '../../GameContext.ts';
import {
  showIntroLoading, setIntroLoadingProgress, hideIntroLoading,
} from './introHud.ts';
import { buildShipScene } from './shipScene.ts';
import {
  buildPodScene, setDescentProgress, setTumbleLight, setCabinCrashPose,
  blowCabinHatch, podBuilt, setPodHidden,
} from './podScene.ts';
import { buildHaulerExterior, setHaulerExplosion, setHaulerHidden } from './haulerScene.ts';
import { setSkyIntroMode } from '../sky.ts';
import { flashScreen, updateScreenFlash, resetScreenFlash } from '../../fx/screenFlash.ts';   // PERF candidate 5 — warm the detonation flash overlay

/** A single preload step: a label the loading screen shows + the async work. Steps run
 *  in order; each is awaited, then the bar advances, then we yield a frame. A step that
 *  THROWS is logged + skipped (the fallback build-on-entry still exists) — never a soft-lock. */
interface PreloadStep {
  label: string;
  run: (ctx: GameContext) => void | Promise<void>;
}

/** Per-step timeout + the whole-preload budget (the anti-hang hardening): generous enough
 *  for a slow first boot on weak hardware, tight enough that a wedged await can't hold the
 *  New Game hostage — everything skipped is covered by the beats' build-on-entry fallbacks. */
const STEP_TIMEOUT_MS = 20_000;
const PRELOAD_BUDGET_MS = 75_000;

/** Yield one animation frame so the loading bar paints + the tab stays responsive.
 *  BUGFIX (the "stuck at 0%" hang, mode 2): rAF NEVER FIRES in a hidden/backgrounded tab
 *  (Chromium stops scheduling frames), so a bare rAF await here hung the whole preload the
 *  moment the tab wasn't foreground (minimize/tab-switch during loading = a frozen New Game).
 *  Race the rAF against a short timer: foreground tabs still sync to the real frame (the bar
 *  paints); hidden tabs fall through on the timer and the preload keeps working. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      let done = false;
      const settle = (): void => { if (!done) { done = true; resolve(); } };
      requestAnimationFrame(settle);
      setTimeout(settle, 120);
    } else {
      setTimeout(resolve, 0);   // headless (node/rig) — no rAF; fall through fast
    }
  });
}

/** Compile every program the given scene needs against the intro camera.
 *  BUGFIX (the user's "stuck at 0%, game never starts" hang): this used compileAsync, whose
 *  KHR_parallel_shader_compile completion-polling can NEVER RESOLVE on some drivers/contexts —
 *  the first step then awaits forever and the whole New Game silently hangs behind the loading
 *  bar. SYNCHRONOUS renderer.compile() is the deterministic choice here: it may block for a
 *  moment (fine — we're literally behind a loading screen, and we yield a frame between steps
 *  so the bar still paints), but it CANNOT hang. */
async function compileScene(ctx: GameContext): Promise<void> {
  const { renderer, scene, camera } = ctx.three;
  renderer.compile(scene, camera);
}

/** A brief HIDDEN warm-up DRAW. Some drivers only fully warm a program on a real draw (not
 *  on compile()), so we render the shared scene into a 1×1 SCISSORED corner of the framebuffer
 *  for one frame. The scissor confines it to a single pixel (invisible — the loading overlay
 *  covers the canvas anyway), and we restore autoClear/scissor state after. The CALLER is
 *  responsible for making the target geometry visible first + hiding it after. */
function warmDraw(ctx: GameContext): void {
  const { renderer, scene, camera } = ctx.three;
  // In headless rigs there may be no real GL context worth poking; guard the call.
  const gl = (renderer as unknown as { getContext?: () => unknown }).getContext?.();
  if (!gl) return;
  const prevScissorTest = renderer.getScissorTest();
  const prevScissor = new THREE.Vector4();
  renderer.getScissor(prevScissor);
  const prevAutoClear = renderer.autoClear;
  try {
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, 1, 1);   // a single bottom-left pixel — invisible, real draw
    renderer.autoClear = false;        // don't wipe the framebuffer the loading overlay sits over
    renderer.render(scene, camera);
  } catch {
    // A warm-up draw is best-effort — a driver hiccup here must not fail the preload.
  } finally {
    renderer.setScissor(prevScissor.x, prevScissor.y, prevScissor.z, prevScissor.w);
    renderer.setScissorTest(prevScissorTest);
    renderer.autoClear = prevAutoClear;
  }
}

/** Compile + warm-draw the current scene contents in one call (the common per-step tail). */
async function compileAndWarm(ctx: GameContext): Promise<void> {
  await compileScene(ctx);
  warmDraw(ctx);
}

/** A snapshot of the GLOBAL renderer/sky state the warm-up mutates, so the cockpit fades in
 *  on a clean orbit regardless of what the warm-up poked. Captured before the pipeline, restored
 *  after (and in the finally, so a throw mid-pipeline can't leak a warmed-up value). */
interface PreloadSnapshot {
  exposure: number;
  fogDensity: number | null;
}
function snapshot(ctx: GameContext): PreloadSnapshot {
  const fog = ctx.three.scene.fog as { density?: number } | null;
  return {
    exposure: ctx.three.renderer.toneMappingExposure,
    fogDensity: fog && typeof fog.density === 'number' ? fog.density : null,
  };
}
function restore(ctx: GameContext, snap: PreloadSnapshot): void {
  ctx.three.renderer.toneMappingExposure = snap.exposure;
  const fog = ctx.three.scene.fog as { density?: number } | null;
  if (fog && snap.fogDensity != null && 'density' in fog) fog.density = snap.fogDensity;
  // The sky is left in normal mode (space01=0). updateSky re-derives the whole gradient every
  //   frame from 0, so a single tick self-heals — but set it explicitly so the FIRST cockpit
  //   frame (which flips space mode back on) starts from a known-clean base.
  setSkyIntroMode(0);
  setDescentProgress(0);   // clears any re-entry FX visibility the warm-up toggled on
  setTumbleLight(0);
  setCabinCrashPose(0);    // idempotent; ensures no lifted-exposure/crash-lean leaks from the warm pass
  // The candidate-5 light-environment passes (steps 4/5) hide the SHIP while compiling the
  //   descent/detonation variants. Their own finally re-shows it, but a step TIMEOUT resolves the
  //   race while the step is still wedged mid-hide — re-assert the parked contract here (the ship
  //   stays VISIBLE: the cockpit beat opens inside it) so a preload failure can't brick New Game.
  const ship = ctx.three.scene.getObjectByName('escapePodShipCockpit');
  if (ship) ship.visible = true;
}

/** Build the ordered step queue. Ordered so the FIRST-NEEDED scenes compile first (the
 *  cockpit is the very first thing the player sees), then the mid/late beats. Each step
 *  builds-if-missing (idempotent) + compiles + warms; the beats then reuse the built scene. */
function buildSteps(): PreloadStep[] {
  return [
    // ── 1. THE SHIP INTERIOR — the cockpit is beat 0. This is the ~1400-mesh build that was
    //       stalling at enterGame; build it hidden at the ship offset (y=3000) + compile the
    //       worn-gunmetal + grime shaders now. cockpit's buildShipScene becomes a no-op reuse.
    {
      label: 'Booting bridge systems — hull, corridor, pod bay',
      run: async (ctx) => {
        buildShipScene(ctx);
        const ship = ctx.three.scene.getObjectByName('escapePodShipCockpit');
        // Keep it VISIBLE for the compile+warm (a hidden mesh may skip the draw path on some
        //   drivers); it's at y=3000, far above the desert, so the player never sees it during
        //   the (overlay-covered) warm frame. cockpit re-owns it visible on beat entry.
        if (ship) ship.visible = true;
        await compileAndWarm(ctx);
      },
    },

    // ── 2. THE SPACE-MODE SKY — the orbit states (dark dome + wrapping stars + the camera-
    //       relative planet + Fresnel atmosphere limb) the cockpit shows through the window.
    //       setSkyIntroMode(1) lazily builds the space planet + compiles its shaders on the
    //       next updateSky; force it here by flipping to space + warm-drawing, then back to 0.
    {
      label: 'Calibrating orbital optics — starfield, planet, atmosphere',
      run: async (ctx) => {
        setSkyIntroMode(1);      // lazily builds + arms the space planet/atmosphere/star shaders
        // updateSky applies space mode at the END of its tick; a warm draw here compiles the
        //   space shaders against the real framebuffer. (The planet mesh is built inside
        //   setSkyIntroMode; the star/limb programs warm on this draw.)
        await compileAndWarm(ctx);
        // Hold a couple of intermediate blend states too so the space→sky cross-fade programs
        //   (used across the descent) are warm, not cold on first blend.
        setSkyIntroMode(0.5);
        await compileAndWarm(ctx);
        setSkyIntroMode(0);      // restore.restore() re-asserts this; explicit for clarity
      },
    },

    // ── 3. THE POD CABIN — the ridden capsule interior (built at the orbit offset y=3200). Its
    //       materials are module-shared, so compiling the cabin here warms the descent-rebuild
    //       too (descent disposes the offset pod + rebuilds at the grounded base with the SAME
    //       materials — no cold compile there). enterPod/descent's buildPodScene = no-op reuse.
    {
      label: 'Sealing the escape pod — cabin, seat, porthole',
      run: async (ctx) => {
        buildPodScene(ctx);
        const pod = ctx.three.scene.getObjectByName('escapePodCabin');
        if (pod) pod.visible = true;
        await compileAndWarm(ctx);
      },
    },

    // ── 4. THE RE-ENTRY FX — the descent plasma + heat-shimmer ShaderMaterials (per-placement,
    //       so they DON'T survive the descent's pod-rebuild — but the PROGRAMS the driver caches
    //       do, keyed by shader source). Drive setDescentProgress into the re-entry window so the
    //       plasma/shimmer meshes go visible, then warm-draw to compile them; reset after.
    {
      label: 'Pressurizing re-entry shielding — plasma envelope',
      run: async (ctx) => {
        if (podBuilt()) {
          // PERF (2026-07-05 profile, candidate 5): compile the descent states in the descent's
          //   REAL LIGHT ENVIRONMENT. three.js keys every lit material's program on the visible-
          //   light COUNTS (NUM_POINT_LIGHTS…), and by the descent the ship interior is gone —
          //   its cabin lights no longer count. Warming with the ship still visible (it is, from
          //   step 1) compiles the WRONG variants; the right ones then recompiled mid-play (the
          //   measured residual: ~9 programs at the beat). Hide the ship for the pass — the
          //   finally + restore() both re-assert it visible, so a throw can't leak a hidden ship.
          const ship = ctx.three.scene.getObjectByName('escapePodShipCockpit');
          const shipWasVisible = ship ? ship.visible : true;
          try {
            if (ship) ship.visible = false;
            setDescentProgress(0.24);   // peak re-entry — plasma + shimmer meshes visible
            await compileAndWarm(ctx);
            setDescentProgress(0.7);    // the low-altitude dawn-warm cabin state (past the plasma window)
            await compileAndWarm(ctx);
            setDescentProgress(0);      // back to orbital-cool (restore() also re-asserts)
          } finally {
            if (ship) ship.visible = shipWasVisible;
          }
        }
      },
    },

    // ── 5. THE HAULER EXTERIOR + EXPLOSION FX — the freighter + the fireball/flash/shockwave/
    //       debris/spark ShaderMaterials staged in the post-eject porthole. Built hidden at the
    //       hauler offset; drive setHaulerExplosion into the blast so every FX sub-mesh goes
    //       visible + compiles, then reset to intact. shipExplode's buildHauler = no-op reuse.
    {
      label: 'Arming ordnance telemetry — freighter, blast dynamics',
      run: async (ctx) => {
        buildHaulerExterior(ctx);
        setHaulerHidden(false);         // ensure visible for the compile+warm draws
        // PERF (2026-07-05 profile, candidate 5 — the 92-program detonation spike): two gaps
        //   made the detonation compile mid-play despite this warm pass:
        //   (a) LIGHT ENVIRONMENT — the beat plays with the ship INTERIOR gone (the player is
        //       outside, watching the exterior explode), and three.js keys every lit material's
        //       program on the visible-light counts — warming with the ship visible compiled the
        //       wrong variants. Hide it for the pass (finally + restore() re-assert visible).
        //   (b) FX VISIBILITY WINDOWS — the FX sub-meshes have DISJOINT windows across the blast
        //       t, and renderer.compile only compiles VISIBLE meshes; a single mid-blast state
        //       misses the rest. Two states cover every window (setHaulerExplosion's own curves):
        //         t=0.06 → the white-hot ignition FLASH core (visible only p<0.13 — it compiled ON
        //                  detonation entry before), the early shockwave (0.03<p<0.42), the primary
        //                  fireball (p>0.02) + the still-intact ship exterior (p<0.16).
        //         t=0.35 → the secondary spine fireball (p>0.14), debris (p>0.08), sparks (p>0.06),
        //                  shockwave mid-race + the primary fireball at full bloom.
        const ship = ctx.three.scene.getObjectByName('escapePodShipCockpit');
        const shipWasVisible = ship ? ship.visible : true;
        try {
          if (ship) ship.visible = false;
          setHaulerExplosion(0);          // intact — compile the hull/hero materials
          await compileAndWarm(ctx);
          setHaulerExplosion(0.06);       // ignition — the detonation-ENTRY program set
          await compileAndWarm(ctx);
          setHaulerExplosion(0.35);       // mid-blast — fireball2/shockwave/debris/sparks visible
          await compileAndWarm(ctx);
          setHaulerExplosion(0);          // reset to intact (shipExplode drives it from 0)
        } finally {
          if (ship) ship.visible = shipWasVisible;
        }
        // PARK the hauler INVISIBLE (group + starfield backdrop + hero lights all off) so it
        //   doesn't leak into the cockpit/enterPod views; shipExplode reveals it on entry.
        setHaulerHidden(true);
      },
    },

    // ── 6. THE EGRESS HATCH — warm the blown-hatch geometry/transform path so the wake→step-out
    //       hatch swing doesn't cold-touch it. Purely a transform (no new shaders), reset to sealed.
    //       NOTE: we deliberately DON'T warm the crash-POSE here — setCabinCrashPose(>0) would
    //       REMOVE the pod's seated collider cage (podBodies) permanently, breaking the enterPod
    //       reuse; and the crash lighting adds no new PROGRAMS (same cabin materials, just light
    //       intensities/transforms already compiled in step 3). The impact/wake beats own the pose.
    {
      label: 'Rigging egress hatch — door release path',
      run: async (ctx) => {
        if (podBuilt()) {
          blowCabinHatch(0.5);    // swing the hatch halfway (warm its transform path)
          await compileAndWarm(ctx);
          blowCabinHatch(0);      // re-seal (the wake beat drives it from 0)
        }
      },
    },

    // ── 7. FINAL LINK — a last compile of the whole assembled scene (everything prebuilt is
    //       present now) so any cross-material program the per-scene passes missed is warm, and
    //       the hero scenes are re-hidden to their beat-entry defaults.
    {
      label: 'Finalizing flight computer',
      run: async (ctx) => {
        // PERF (2026-07-05 profile, candidate 5): warm the SCREEN-FLASH overlay. Its quad is
        //   parked invisible (updateScreenFlash gates visibility on a live pulse), so every
        //   compile pass above skipped it — measured compiling ON the detonation flash, the
        //   very frame the beat needs to be clean. Pulse it sub-visibly (the DOM loading
        //   overlay covers the canvas), make the mesh live for THIS compile, then reset idle.
        flashScreen(0xfff0d8, 0.05);
        updateScreenFlash(ctx, 0);      // applies the pulse → the quad goes visible for the pass
        await compileAndWarm(ctx);
        resetScreenFlash();             // back to the idle parked state (invisible, opacity 0)
        await compileScene(ctx);
        // Park the hero scenes to their beat-entry state:
        //   • SHIP stays VISIBLE — the cockpit beat opens inside it (at the ship offset).
        //   • POD parked INVISIBLE — its cabin lights would otherwise leak into the cockpit view;
        //     ensureInPod (the eject seal / the descent rebuild) reveals it when the player sits in.
        //   • HAULER already parked invisible in step 5 (shipExplode reveals it).
        setPodHidden(true);
      },
    },
  ];
}

/** Is a preload currently running? (Guards a re-entrant call — e.g. a stray double new-game.) */
let _running = false;
export function introPreloadRunning(): boolean { return _running; }

/**
 * Run the up-front preload behind the loading screen, then resolve. The CALLER (the new-game
 * branch) awaits this, THEN starts the intro (the cockpit beat) — by which point every scene
 * is built + every shader compiled, so the beats are butter (their build/compile cost is already
 * paid; they just reuse the prebuilt scenes). Never throws: a failing step is logged + skipped
 * (the fallback build-on-entry still exists), so the intro always starts.
 *
 * Instrumentation: returns per-step timings + the total, so the perf win is measurable.
 */
export async function preloadIntro(ctx: GameContext): Promise<{ ok: boolean; totalMs: number; steps: Array<{ label: string; ms: number; error?: string }> }> {
  if (_running) return { ok: false, totalMs: 0, steps: [] };
  _running = true;
  const snap = snapshot(ctx);
  const steps = buildSteps();
  const timings: Array<{ label: string; ms: number; error?: string }> = [];
  const t0 = performance.now();
  showIntroLoading();
  // Let the overlay paint one frame before the (heavy) first step so the fade-in shows.
  setIntroLoadingProgress(0, 'Spinning up…');
  await nextFrame();
  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      setIntroLoadingProgress(i / steps.length, step.label);
      await nextFrame();   // paint the label + bar BEFORE the blocking build so the step reads
      const s0 = performance.now();
      let error: string | undefined;
      try {
        // BUGFIX hardening: race every step against a per-step TIMEOUT so no awaited work
        //   (driver quirk, a pending promise that never settles) can hang the New Game — on
        //   timeout we log + move on; the beat's build-on-entry fallback covers the skipped
        //   warm-up. (A pegged-main-thread sync block can't be raced, but the sync work here
        //   is bounded — the race guards the ASYNC awaits.)
        await Promise.race([
          Promise.resolve(step.run(ctx)),
          new Promise<never>((_, reject) => {
            window.setTimeout(() => reject(new Error(`step timed out after ${STEP_TIMEOUT_MS}ms`)), STEP_TIMEOUT_MS);
          }),
        ]);
      } catch (e) {
        // NEVER soft-lock: log + continue. The beat's own build-on-entry is the fallback.
        error = e instanceof Error ? e.message : String(e);
        console.warn(`[introPreload] step "${step.label}" failed (continuing):`, e);
      }
      timings.push({ label: step.label, ms: performance.now() - s0, error });
      setIntroLoadingProgress((i + 1) / steps.length, step.label);
      await nextFrame();   // yield so the bar animates + the tab never hard-freezes
      // The global WATCHDOG: if the whole preload has somehow chewed through its budget,
      //   stop warming and let the intro start — a slower first beat beats a hung game.
      if (performance.now() - t0 > PRELOAD_BUDGET_MS) {
        console.warn(`[introPreload] budget exceeded (${Math.round(performance.now() - t0)}ms) — starting the intro with ${steps.length - 1 - i} step(s) unwarmed`);
        break;
      }
    }
  } finally {
    // ALWAYS restore the global state the warm-up poked, hide the screen, clear the guard —
    //   even if a step threw past its own catch (defensive), so the cockpit fades in clean.
    restore(ctx, snap);
    hideIntroLoading();
    _running = false;
  }
  return { ok: true, totalMs: performance.now() - t0, steps: timings };
}
