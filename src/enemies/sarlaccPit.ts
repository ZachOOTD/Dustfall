// Sarlacc pit (Cycle 8 / Session ACAQ) — the wreck-yard's hero hazard.
//
// A stationary sand-maw at the graveyard center: a funnel of teeth + an undulating
// ring of tendrils around a dark throat. A TRAP, not a hunter (cf. sandWorm.ts):
// its threat is immobility + an inevitable pull. When the player nears, the maw
// gapes (telegraph), tendrils rise, a pull force drags the player toward the
// throat, and damage ticks in the inner danger radius. Reuses the sandworm's
// detection/damage/pause-gate patterns; the model + pull are new.
//
// This file owns the MODEL + spawn. The per-frame FSM + pull/damage live in
// updateSarlaccPit (added once the model reads right).

import * as THREE from 'three';
import type { Terrain } from '../world/terrain.ts';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { die } from '../stats/survival.ts';
import { playPlayerHurt } from '../audio/audio.ts';

const _rimMat = new THREE.MeshLambertMaterial({ color: 0x6e5b40, flatShading: true });    // packed sand lip
const _funnelMat = new THREE.MeshLambertMaterial({ color: 0x3a2c1c, flatShading: true });  // dark funnel wall
const _throatMat = new THREE.MeshLambertMaterial({ color: 0x140a06, flatShading: true, emissive: 0x2a0e04, emissiveIntensity: 0.5 }); // glowing-dark gullet
const _toothMat = new THREE.MeshLambertMaterial({ color: 0xcbb98c, flatShading: true });   // bone teeth
const _tendrilMat = new THREE.MeshLambertMaterial({ color: 0x5a4a36, flatShading: true });  // leathery feeler

export interface SarlaccPitParts {
  teeth: THREE.Group;        // outer rim teeth (animate spread/clench)
  innerTeeth: THREE.Group;   // deeper teeth
  tendrils: THREE.Mesh[];    // rim feelers (animate rise + sway)
  throat: THREE.Mesh;        // dark gullet (animate emissive pulse)
}

/** Build the Sarlacc-pit maw mesh. `rOuter` = rim radius (m). The returned group
 *  is centered at the maw origin; `group.userData.parts` holds the animatable
 *  sub-parts. Built in the OPEN pose; the FSM lerps toward closed. */
export function makeSarlaccPitMesh(rOuter: number): THREE.Group {
  const g = new THREE.Group();
  const yRim = rOuter * 0.42;        // raised mound rim height (above ground)
  const throatY = -rOuter * 0.75;    // funnel bottom (below ground)

  // ── Raised sand mound — the maw's lips. A frustum cone (wide buried base →
  //    narrower rim) so the maw rises from the sand; the open top IS the mouth. ──
  const mound = new THREE.Mesh(
    new THREE.CylinderGeometry(rOuter * 1.02, rOuter * 1.6, yRim + 2.0, 28, 1, true),
    _rimMat,
  );
  mound.material.side = THREE.DoubleSide;   // inner-upper lip reads from above too
  mound.position.y = yRim - (yRim + 2.0) / 2;
  g.add(mound);

  // ── Funnel — dark cone descending from the rim into the throat (DoubleSide so
  //    the gullet wall reads from the 3/4 look-in angle). ──
  const funnel = new THREE.Mesh(
    new THREE.CylinderGeometry(rOuter * 0.9, rOuter * 0.16, yRim - throatY, 28, 1, true),
    _funnelMat,
  );
  funnel.material.side = THREE.DoubleSide;
  funnel.position.y = (yRim + throatY) / 2;
  g.add(funnel);

  // ── Throat — darker recessed gullet at the bottom + a back-cap. ──
  const throat = new THREE.Mesh(
    new THREE.CylinderGeometry(rOuter * 0.16, rOuter * 0.05, rOuter * 0.6, 16, 1, true),
    _throatMat,
  );
  throat.material.side = THREE.DoubleSide;
  throat.position.y = throatY - rOuter * 0.2;
  g.add(throat);
  const throatCap = new THREE.Mesh(new THREE.CircleGeometry(rOuter * 0.06, 12), _throatMat);
  throatCap.rotation.x = -Math.PI / 2;
  throatCap.position.y = throatY - rOuter * 0.5;
  g.add(throatCap);

  // ── Outer teeth ring — big inward-curving fangs around the rim. ──
  const teeth = new THREE.Group();
  const outerN = 18;
  for (let i = 0; i < outerN; i++) {
    const a = (i / outerN) * Math.PI * 2;
    const len = rOuter * (0.5 + (i % 3) * 0.06);
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(rOuter * 0.08, len, 5), _toothMat);
    tooth.position.set(Math.cos(a) * rOuter * 0.84, yRim + len * 0.3, Math.sin(a) * rOuter * 0.84);
    tooth.rotation.z = Math.cos(a) * 0.85;     // tip inward over the maw
    tooth.rotation.x = -Math.sin(a) * 0.85;
    tooth.rotation.y = -a;
    teeth.add(tooth);
  }
  g.add(teeth);

  // ── Inner teeth ring — smaller, deeper, more vertical. ──
  const innerTeeth = new THREE.Group();
  const innerN = 12;
  for (let i = 0; i < innerN; i++) {
    const a = (i / innerN) * Math.PI * 2 + 0.2;
    const len = rOuter * 0.34;
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(rOuter * 0.05, len, 4), _toothMat);
    tooth.position.set(Math.cos(a) * rOuter * 0.4, throatY * 0.4, Math.sin(a) * rOuter * 0.4);
    tooth.rotation.z = Math.cos(a) * 0.35;
    tooth.rotation.x = -Math.sin(a) * 0.35;
    innerTeeth.add(tooth);
  }
  g.add(innerTeeth);

  // ── Tendrils — a few leathery feelers rising from the rim, curling inward. ──
  const tendrils: THREE.Mesh[] = [];
  const tendN = 4;
  for (let i = 0; i < tendN; i++) {
    const a = (i / tendN) * Math.PI * 2 + 0.6;
    const baseR = rOuter * 0.74;   // from the INNER rim, rising out of the maw
    // A thin feeler reaching UP + slightly inward over the throat (curling tentacle).
    const tend = new THREE.Mesh(new THREE.CylinderGeometry(rOuter * 0.01, rOuter * 0.035, rOuter * 0.7, 5), _tendrilMat);
    tend.position.set(Math.cos(a) * baseR, yRim + rOuter * 0.28, Math.sin(a) * baseR);
    tend.rotation.z = -Math.cos(a) * 0.32;   // slight inward curl over the maw
    tend.rotation.x = Math.sin(a) * 0.32;
    tend.userData.baseAngle = a;
    g.add(tend);
    tendrils.push(tend);
  }

  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  g.userData.parts = { teeth, innerTeeth, tendrils, throat } as SarlaccPitParts;
  return g;
}

export type SarlaccState = 'idle' | 'alerted' | 'open' | 'closing';

export interface SarlaccPit {
  mesh: THREE.Group;
  parts: SarlaccPitParts;
  basePos: THREE.Vector3;
  rOuter: number;
  state: SarlaccState;
  /** 0 = closed/buried .. 1 = fully gaping. Drives the open/close animation. */
  openAmt: number;
  phaseStartedAt: number;
  nextDamageAt: number;
}

/** Spawn the Sarlacc pit at the graveyard center. Built in the OPEN pose; the
 *  FSM (updateSarlaccPit) lerps it toward closed when idle. */
export function spawnSarlaccPit(
  scene: THREE.Scene,
  terrain: Terrain,
  anchor: { x: number; z: number },
  rOuter: number,
): SarlaccPit {
  const y = terrain.heightAt(anchor.x, anchor.z);
  const mesh = makeSarlaccPitMesh(rOuter);
  mesh.position.set(anchor.x, y, anchor.z);
  mesh.name = 'sarlaccPit';
  scene.add(mesh);
  return {
    mesh,
    parts: mesh.userData.parts as SarlaccPitParts,
    basePos: new THREE.Vector3(anchor.x, y, anchor.z),
    rOuter,
    state: 'idle',
    openAmt: 1,        // start visible/open for first-look verification; FSM takes over live
    phaseStartedAt: 0,
    nextDamageAt: 0,
  };
}

/** Per-frame update (called from main.ts, after the pause gate). Detection FSM:
 *  the maw gapes when the player nears (rises from buried/dormant), then PULLS the
 *  player toward the throat + BITES (damage ticks) in the inner danger radius.
 *  A trap, not a hunter — stationary; its threat is the inevitable pull.
 *  NOTE: the pull MAGNITUDE/escape-ability is feel-critical → attended tune (the
 *  numbers in tuning.ts are a first pass; verify in `npm run dev`). */
export function updateSarlaccPit(ctx: GameContext, dt: number): void {
  const pit = ctx.sarlaccPit;
  if (!pit) return;
  const elapsed = ctx.time.elapsed;
  const tr = ctx.player.body.body.translation();
  const dx = tr.x - pit.basePos.x, dz = tr.z - pit.basePos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  // Open/close: the maw gapes when the player is within detect radius (~0.6s lerp).
  const target = dist < Tuning.SARLACC_PIT_DETECT_RADIUS ? 1 : 0;
  pit.openAmt += (target - pit.openAmt) * Math.min(1, dt * 1.6);
  pit.state = pit.openAmt > 0.6 ? 'open'
    : target > 0 ? 'alerted'
    : pit.openAmt > 0.05 ? 'closing' : 'idle';

  // ── Pose: sink the maw when closed (buried/dormant), rise when open; pulse the
  //    throat glow + sway the feelers (stronger when open). ──
  pit.mesh.position.y = pit.basePos.y - (1 - pit.openAmt) * pit.rOuter * 0.6;
  const throatMat = pit.parts.throat.material as THREE.MeshLambertMaterial;
  throatMat.emissiveIntensity = 0.18 + pit.openAmt * 0.7 + Math.sin(elapsed * 2.2) * 0.12 * pit.openAmt;
  for (const tend of pit.parts.tendrils) {
    const ph = (tend.userData.baseAngle as number) || 0;
    tend.rotation.y = Math.sin(elapsed * 0.9 + ph) * 0.18 * (0.3 + pit.openAmt);
  }

  if (pit.openAmt <= 0.55) return;   // only pulls/bites once meaningfully open

  // ── Pull toward the throat — stronger the closer you are. ──
  if (dist < Tuning.SARLACC_PIT_PULL_RADIUS && dist > 0.5) {
    const prox = 1 - dist / Tuning.SARLACC_PIT_PULL_RADIUS;   // 0 at edge .. 1 at center
    const pull = Tuning.SARLACC_PIT_PULL_ACCEL * (0.4 + prox * 1.2) * pit.openAmt;
    ctx.player.externalPullX += (-dx / dist) * pull;
    ctx.player.externalPullZ += (-dz / dist) * pull;
  }

  // ── Bite — damage ticks in the inner danger radius. ──
  if (dist < Tuning.SARLACC_PIT_DANGER_RADIUS && elapsed >= pit.nextDamageAt) {
    pit.nextDamageAt = elapsed + Tuning.SARLACC_PIT_DAMAGE_INTERVAL;
    ctx.stats.health = Math.max(0, ctx.stats.health - Tuning.SARLACC_PIT_DAMAGE_PER_TICK);
    ctx.flags.damageFlashUntil = elapsed + 0.35;
    playPlayerHurt();
    ctx.ui.showToast('the maw grinds — you are being pulled under');
    if (ctx.stats.health <= 0) die(ctx, 'the wreck-yard swallowed you');
  }
}

