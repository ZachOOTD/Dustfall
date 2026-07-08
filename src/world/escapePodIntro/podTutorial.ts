// Escape-pod intro — the FIRST TUTORIAL (T4.3 · Beats 10-11 of the vision).
// ─────────────────────────────────────────────────────────────────────────────
// This is the gameplay beat AFTER the crash intro hands off (sequence.ts stepOut →
// endEscapePodIntro): the player has climbed out of their crashed pod into the dawn
// dunes. This module teaches the core CRAFT + SALVAGE loop on the player's OWN pod:
//
//   1. scrap + cloth are scattered around the crashed pod (the raw materials)
//   2. gathering them unlocks the scrap-machete recipe (pickup-gated discovery);
//      the player crafts it (C → crafting) — the pry tool
//   3. they pry + strip the pod's back salvage panel with the machete
//   4. the parachute that FAILED during the fall comically POPS OUT of the pod crown
//      (the callback/comedy button on the whole opening)
//
// It runs as NORMAL gameplay, not an intro beat — startPodTutorial seeds the state at
// the desert handoff; updatePodTutorial ticks it each frame (guarded, cheap, self-ends).
// Nothing here touches saves or breaks the rest of the game's salvage/craft/tutorial
// systems — it REUSES them (spawnDroppedPickup, addAccessPanel/registerSalvageable in
// podScene, the maybeShowEventHint one-shot toast). Behind FEATURES.escapePodIntro via
// its call site (only stepOut starts it).
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import type { GameContext } from '../../GameContext.ts';
import { spawnDroppedPickup } from '../../pickups/pickups.ts';
import { countItems } from '../../inventory/inventory.ts';
import { findSalvageableById } from '../salvage.ts';
import { maybeShowEventHint } from '../../ui/tutorial.ts';
import { getCrashedPodSalvageableId, chutePopReady, popChute, placeCrashedPodWreck, updateChutePop } from './podScene.ts';   // D5 — updateChutePop owns the decoupled pry→pop gag trigger (smoke proves it fires regardless of tutorial phase)

/** Tutorial phase — a tiny linear state machine over the craft→salvage→payoff loop. */
type TutPhase =
  | 'idle'       // not running
  | 'craft'      // materials scattered; cue "craft a machete"; waiting for the machete
  | 'salvage'    // machete in hand; cue "pry your pod"; waiting for the pry
  | 'popped'     // the chute burst out — playing the inflate, then done
  | 'done';

let _phase: TutPhase = 'idle';
let _t = 0;                  // seconds in the current phase (paced cues)
let _cuedSalvage = false;    // the "pry your pod" cue has been shown
let _podX = 0, _podZ = 0;    // the crashed pod's spawn (x,z) — for scatter + distance checks

/** Is the pod tutorial currently active (running its loop)? */
export function podTutorialActive(): boolean {
  return _phase !== 'idle' && _phase !== 'done';
}

/** Begin the first-salvage tutorial at the desert handoff. `podX/podZ` = the crashed
 *  pod's world (x,z) (the returnPos the pod was placed at). Scatters the raw materials
 *  (scrap + cloth) in a loose ring around the pod so the player has what they need to
 *  craft the machete, then cues the craft. Idempotent-ish (a re-call restarts clean). */
export function startPodTutorial(ctx: GameContext, podX: number, podZ: number): void {
  // Guard against a double-scatter: only (re)seed when the tutorial has NEVER run this page load.
  //   A genuine new-game replay reloads the page (fresh module state → _phase 'idle'), so this
  //   fires exactly once per playthrough. NOTE: we key off `_phase !== 'idle'` (NOT
  //   podTutorialActive(), which is false in the 'done' phase) — captured BEFORE the 'craft'
  //   assignment below — so a same-page dev/smoke replay (which leaves _phase 'done') does NOT
  //   re-scatter another 5 pickups on top of the lingering batch (the +5-per-replay leak).
  const alreadySeeded = _phase !== 'idle';
  _phase = 'craft';
  _t = 0;
  _cuedSalvage = false;
  _podX = podX;
  _podZ = podZ;
  if (!alreadySeeded) scatterMaterials(ctx, podX, podZ);
  // The first cue: point the player at the scattered scrap + the crafting menu. Gathering the
  //   scrap + cloth unlocks the machete recipe (pickup-gated discovery); then C to craft it.
  //   One-shot (persisted so it doesn't re-nag on a resumed intro); resettable via __game.resetTutorial().
  maybeShowEventHint(ctx, 'intro_craft', 'Scrap litters the sand — gather the scrap and cloth, then press C to craft a machete');
}

/** Scatter the raw materials the machete needs (scrap ×3, cloth ×2 — enough to craft
 *  the machete [scrap×2+cloth×1] with a little spare) in a loose ring around the pod.
 *  Physics-bodied so they settle naturally on the dune. Pushed into ctx.pickups.list. */
function scatterMaterials(ctx: GameContext, podX: number, podZ: number): void {
  // items + how many of each (a touch of spare so a fumbled craft / a lost piece doesn't strand)
  const drops: { id: 'scrap' | 'cloth'; n: number }[] = [
    { id: 'scrap', n: 3 },
    { id: 'cloth', n: 2 },
  ];
  let i = 0;
  const total = drops.reduce((s, d) => s + d.n, 0);
  for (const d of drops) {
    for (let k = 0; k < d.n; k++) {
      // spread around the pod in a ring, 1.8–3.0 m out, at staggered angles (deterministic-ish
      //   spread; the exact spots don't matter — they just need to be close + gatherable).
      const ang = (i / total) * Math.PI * 2 + 0.6;
      const rad = 1.8 + (i % 2) * 0.7 + (k * 0.15);
      const px = podX + Math.cos(ang) * rad;
      const pz = podZ + Math.sin(ang) * rad;
      const p = spawnDroppedPickup(
        ctx.three.scene, ctx.terrain, { x: px, z: pz }, d.id, undefined,
        { world: ctx.physics.world },
      );
      ctx.pickups.list.push(p);
      i++;
    }
  }
}

/** Per-frame tutorial driver (T4.3). No-op unless the loop is running. Drives the chute-pop
 *  inflate every frame it's popping; advances the craft→salvage→payoff phases; fires the
 *  chute-pop when the pod's panel is first pried. Cheap + self-ending. */
export function updatePodTutorial(ctx: GameContext, dt: number): void {
  if (_phase === 'idle' || _phase === 'done') return;
  _t += dt;

  switch (_phase) {
    case 'craft': {
      // waiting for the machete. Once the player has crafted (or otherwise holds) a scrap
      //   machete, advance + cue the salvage.
      if (countItems(ctx.inventory, 'scrap_machete') > 0) {
        _phase = 'salvage';
        _t = 0;
      }
      return;
    }
    case 'salvage': {
      // cue the pry once (a beat after picking up the machete, so it follows the craft toast).
      if (!_cuedSalvage && _t > 0.8) {
        _cuedSalvage = true;
        maybeShowEventHint(ctx, 'intro_salvage', 'Now strip your own pod — face its back panel with the machete and hold E to pry it open');
      }
      // fire the payoff the moment the pod's panel is pried open (completePry sets panelOpened).
      const id = getCrashedPodSalvageableId();
      const s = id >= 0 ? findSalvageableById(ctx.salvageables.list, id) : undefined;
      // if the pod salvageable vanished (e.g. an edge-case dispose), retire the driver cleanly.
      if (id < 0 || (id >= 0 && !s)) { _phase = 'done'; return; }
      const opened = s ? (s.panel.userData.panelOpened === true) : false;
      if (opened) {
        // D5 — the GAG FIRE itself is now decoupled: updateChutePop (always-running, main tick)
        //   detects panelOpened + pops the chute robustly, regardless of which phase THIS driver is
        //   in (the old bug: if the pry happened outside 'salvage', the pop was never observed). Here
        //   we only show the reactive TOAST + advance the driver. Belt-and-suspenders popChute() too
        //   (idempotent — a no-op if updateChutePop already fired it this frame / it's already popped).
        if (chutePopReady()) popChute();
        maybeShowEventHint(ctx, 'intro_chute_pop', 'Your parachute finally deploys — now that you\'ve already crashed.');
        _phase = 'popped';
        _t = 0;
      }
      return;
    }
    case 'popped': {
      // let the inflate + a short settle beat finish, then retire the driver (the pod stays a
      //   normal salvageable wreck; the chute stays popped on the crown as a permanent gag).
      if (_t > 2.5) _phase = 'done';
      return;
    }
  }
}

/** Force-reset the tutorial state (dev / a fresh new game). Does NOT touch world objects —
 *  the pod + pickups + chute are owned by podScene; this only clears the driver's phase. */
export function resetPodTutorial(): void {
  _phase = 'idle';
  _t = 0;
  _cuedSalvage = false;
}

/** SAVE/LOAD — resume the tutorial driver after a Continue re-built the enterable pod
 *  (restoreEnterablePod), so the comic chute-pop still fires on the pod's first pry post-reload.
 *  On a fresh boot the module state is 'idle', which would kill the payoff button; this re-homes the
 *  driver to the 'salvage' phase watching THIS pod's panel. No cues are (re)shown — the salvage cue
 *  is already marked seen in localStorage from the pre-save session (maybeShowEventHint is a persisted
 *  one-shot), so `_cuedSalvage=true` here suppresses a re-nag. Only meaningful when the chute has NOT
 *  already popped (caller gates on that): a reload AFTER the payoff leaves the driver idle (nothing to
 *  resume). `podX/podZ` = the re-built pod's world (x,z). */
export function resumePodTutorialAfterRestore(podX: number, podZ: number): void {
  _phase = 'salvage';   // watching for the pry → the chute-pop payoff (skip 'craft' — the pry is what matters)
  _t = 1.0;             // past the salvage-cue delay so no cue timer fires
  _cuedSalvage = true;  // the cue was shown pre-save (persisted one-shot) — don't re-nag
  _podX = podX;
  _podZ = podZ;
}

// (kept for a potential dev hook: the pod's world position the tutorial seeded around.)
export function podTutorialAnchor(): THREE.Vector2 {
  return new THREE.Vector2(_podX, _podZ);
}

/** Dev smoke (T4.3) — drive the WHOLE craft→salvage→chute-pop loop headlessly + assert each
 *  stage fires. Places a crashed pod at the player's current spot, starts the tutorial (scatters
 *  materials + registers the pod salvageable), then programmatically: grants a machete → ticks
 *  (→ salvage phase) → pries the pod's panel (→ chute-pop) → ticks the inflate to completion.
 *  Returns a per-stage pass report. Exposed via `__game.smokePodTutorial()`. */
export function smokePodTutorial(ctx: GameContext): {
  ok: boolean;
  materialsScattered: number;
  podSalvageable: boolean;
  reachedSalvage: boolean;
  chutePopped: boolean;
  reachedDone: boolean;
  poppedViaAutoFireWrongPhase: boolean;   // D5 — the gag fires on the pry even when the tutorial is NOT in 'salvage'
  error?: string;
} {
  const report = {
    ok: false, materialsScattered: 0, podSalvageable: false,
    reachedSalvage: false, chutePopped: false, reachedDone: false,
    poppedViaAutoFireWrongPhase: false,
  } as ReturnType<typeof smokePodTutorial>;
  try {
    const pod = ctx.player.body.body.translation();
    const px = pod.x, pz = pod.z;
    // place the crashed pod + start the tutorial around it
    placeCrashedPodWreck(ctx, px, pz);
    startPodTutorial(ctx, px, pz);
    report.materialsScattered = ctx.pickups.list.filter(
      (p) => (p.itemId === 'scrap' || p.itemId === 'cloth'),
    ).length;
    // the pod is registered as a salvageable?
    const podId = getCrashedPodSalvageableId();
    const podRec = podId >= 0 ? findSalvageableById(ctx.salvageables.list, podId) : undefined;
    report.podSalvageable = !!podRec && podRec.kind === 'escape_pod' && podRec.salvageRemaining > 0;

    // ── D5 ORDER A (the phase-mismatch / decoupled path — the USER-REPORTED failure). The player
    //    pries the pod panel while the tutorial is STILL in 'craft' (no machete yet / the machine
    //    hasn't advanced). The OLD code only watched the pry inside 'salvage' → the gag was missed.
    //    Now updateChutePop (always-running, tutorial-phase-independent) MUST fire the pop here even
    //    though _phase is 'craft'. Prove it: pry → updateChutePop → chutePopReady goes false (popped).
    const wrongPhase = _phase;                          // 'craft' at this point (machete not yet granted)
    if (podRec) podRec.panel.userData.panelOpened = true;
    const readyBeforeAutoFire = chutePopReady();        // armed + unpopped before the pry is observed
    updateChutePop(ctx, 0.05);                          // the decoupled trigger sees panelOpened + pops — no tutorial dependency
    report.poppedViaAutoFireWrongPhase = wrongPhase !== 'salvage' && readyBeforeAutoFire && !chutePopReady();

    // reset to prove ORDER B (the normal in-order path) cleanly on a fresh pod.
    resetPodTutorial();
    placeCrashedPodWreck(ctx, px, pz);   // re-place (re-arms a fresh chute + a fresh salvageable record)
    startPodTutorial(ctx, px, pz);
    const podId2 = getCrashedPodSalvageableId();
    const podRec2 = podId2 >= 0 ? findSalvageableById(ctx.salvageables.list, podId2) : undefined;

    // ── D5 ORDER B (craft → cue → pry). grant a machete (as if the player crafted it) → tick →
    //    should advance to 'salvage', then pry → the gag fires (via updateChutePop) + the driver
    //    advances. This is the happy path the tutorial toast follows.
    grantMachete(ctx);
    updatePodTutorial(ctx, 0.1);
    report.reachedSalvage = _phase === 'salvage';

    // simulate the pry completing on the pod's panel (interaction.ts completePry sets this)
    if (podRec2) podRec2.panel.userData.panelOpened = true;
    updateChutePop(ctx, 0.05);      // the decoupled trigger fires the gag on the pry (as in the real main tick)
    updatePodTutorial(ctx, 1.0);    // > 0.8 so the salvage cue also fires; the driver reacts + advances
    report.chutePopped = _phase === 'popped' || _phase === 'done';

    // tick the inflate + settle to completion (updateChutePop drives the inflate, as in the main tick)
    for (let i = 0; i < 60; i++) { updateChutePop(ctx, 0.05); updatePodTutorial(ctx, 0.05); }
    report.reachedDone = _phase === 'done';

    report.ok = report.podSalvageable && report.reachedSalvage && report.chutePopped
      && report.reachedDone && report.poppedViaAutoFireWrongPhase;
    return report;
  } catch (e) {
    report.error = e instanceof Error ? e.message : String(e);
    return report;
  }
}

/** Give the player a scrap machete (dev — simulates the craft) by dropping it into the first
 *  empty hotbar slot, or stacking onto an existing one. Minimal — the smoke just needs
 *  countItems('scrap_machete') > 0. */
function grantMachete(ctx: GameContext): void {
  const slots = ctx.inventory.slots;
  for (const s of slots) {
    if (s.item === null) { s.item = 'scrap_machete'; s.count = 1; return; }
  }
  // no empty slot — overwrite slot 0 (dev only)
  slots[0].item = 'scrap_machete'; slots[0].count = 1;
}
