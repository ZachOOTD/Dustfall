// Escape-pod intro — the FIRST TUTORIAL (T4.3 · Beats 10-11 of the vision).
// ─────────────────────────────────────────────────────────────────────────────
// This is the gameplay beat AFTER the crash intro hands off (sequence.ts stepOut →
// endEscapePodIntro): the player has climbed out of their crashed pod into the dawn
// dunes. This module teaches the core CRAFT + SALVAGE loop on the player's OWN pod:
//
//   1. scrap + cloth are scattered around the crashed pod (the raw materials)
//   2. the player combines them (C → crafting) into a scrap machete (the pry tool)
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
import { getCrashedPodSalvageableId, chutePopReady, popChute, placeCrashedPodWreck } from './podScene.ts';

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
  // The first cue: point the player at the scattered scrap + the crafting menu. One-shot
  //   (persisted so it doesn't re-nag on a resumed intro); resettable via __game.resetTutorial().
  maybeShowEventHint(ctx, 'intro_craft', 'Scrap litters the sand — press C to combine scrap + cloth into a machete');
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
        if (chutePopReady()) {
          popChute();   // the failed chute FINALLY deploys — uselessly, on the ground (the gag)
          maybeShowEventHint(ctx, 'intro_chute_pop', 'Your parachute finally deploys — now that you\'ve already crashed.');
        }
        // advance regardless (if the chute somehow wasn't armed, still don't spin the driver).
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
  error?: string;
} {
  const report = {
    ok: false, materialsScattered: 0, podSalvageable: false,
    reachedSalvage: false, chutePopped: false, reachedDone: false,
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

    // grant a machete (as if the player crafted it) → tick → should advance to 'salvage'
    grantMachete(ctx);
    updatePodTutorial(ctx, 0.1);
    report.reachedSalvage = _phase === 'salvage';

    // simulate the pry completing on the pod's panel (interaction.ts completePry sets this)
    if (podRec) podRec.panel.userData.panelOpened = true;
    updatePodTutorial(ctx, 1.0);   // > 0.8 so the salvage cue also fires; detects the pry → pops
    report.chutePopped = _phase === 'popped' || _phase === 'done';

    // tick the inflate + settle to completion
    for (let i = 0; i < 60; i++) updatePodTutorial(ctx, 0.05);
    report.reachedDone = _phase === 'done';

    report.ok = report.podSalvageable && report.reachedSalvage && report.chutePopped && report.reachedDone;
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
