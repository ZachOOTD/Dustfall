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

// Palette from the Great Pit of Carkoon references (ROTJ + 1997 Special Edition):
// leathery hide rim, fleshy maw collar, a warm-glowing gullet, ivory bone teeth,
// a fleshy reddish beak, moist tan tentacles.
const _lipMat = new THREE.MeshLambertMaterial({ color: 0x8b6f47, flatShading: true });       // leathery hide rim lip
const _mawFleshMat = new THREE.MeshLambertMaterial({ color: 0x5e4030, flatShading: true });  // fleshy maw collar
const _throatMat = new THREE.MeshLambertMaterial({ color: 0x180c05, flatShading: true, emissive: 0x6e2c0a, emissiveIntensity: 0.6 }); // warm-glowing gullet (digestive ember)
const _toothMat = new THREE.MeshLambertMaterial({ color: 0xe6d6bd, flatShading: true });      // ivory bone teeth
const _beakMat = new THREE.MeshLambertMaterial({ color: 0x7a3a24, flatShading: true });       // fleshy reddish beak (SE)
const _tendrilMat = new THREE.MeshLambertMaterial({ color: 0x8a7048, flatShading: true });    // moist tan tentacle

export interface SarlaccPitParts {
  teeth: THREE.Group;          // outer + mid teeth tiers (gape/clench)
  innerTeeth: THREE.Group;     // inner teeth around the beak
  tendrils: THREE.Object3D[];  // tentacle base pivots (sway + raise)
  throat: THREE.Mesh;          // glowing gullet (emissive pulse)
  beak: THREE.Group;           // central beak (extend/retract + gnash)
}

/** Build the Sarlacc-pit maw mesh. `rOuter` = maw rim radius (m). The returned
 *  group's ORIGIN sits at the carved crater FLOOR (the terrain is dug into a funnel
 *  crater around it — see terrain.ts / SARLACC_PIT_CRATER_DEPTH). Everything builds
 *  DOWN (throat) and UP (beak/teeth/tentacles) from the floor; nothing rises above
 *  the surrounding sand. `group.userData.parts` holds the animatable sub-parts. */
export function makeSarlaccPitMesh(rOuter: number): THREE.Group {
  const g = new THREE.Group();

  // ── Fleshy maw collar — an inverted-cone of the creature's flesh lining the
  //    immediate maw, descending from a wide rim down to the throat mouth. Sets the
  //    living-flesh boundary apart from the sand funnel walls above. DoubleSide so it
  //    reads looking straight down + from the inner-wall angle. ──
  const collarH = rOuter * 0.4;
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(rOuter * 0.96, rOuter * 0.22, collarH, 32, 1, true),
    _mawFleshMat,
  );
  collar.material.side = THREE.DoubleSide;
  collar.position.y = -collarH / 2 + rOuter * 0.06;   // lip just above floor, throat below
  g.add(collar);

  // ── Leathery rim lip — a thick hide ring where the flesh meets the sand. ──
  const lip = new THREE.Mesh(new THREE.TorusGeometry(rOuter * 0.94, rOuter * 0.075, 8, 36), _lipMat);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = rOuter * 0.05;
  g.add(lip);

  // ── Throat — a warm-glowing gullet punching BELOW the floor + a back-cap. ──
  const throatTopY = -collarH + rOuter * 0.06;
  const throat = new THREE.Mesh(
    new THREE.CylinderGeometry(rOuter * 0.22, rOuter * 0.08, rOuter * 0.7, 20, 1, true),
    _throatMat,
  );
  throat.material.side = THREE.DoubleSide;
  throat.position.y = throatTopY - rOuter * 0.35;
  g.add(throat);
  const throatCap = new THREE.Mesh(new THREE.CircleGeometry(rOuter * 0.085, 14), _throatMat);
  throatCap.rotation.x = -Math.PI / 2;
  throatCap.position.y = throatTopY - rOuter * 0.7;
  g.add(throatCap);

  // ── Central BEAK (1997 Special Edition) — a fleshy prehensile spike rising from
  //    the throat at center: a bulbous lathe core ringed by 4 mandible plates that
  //    splay when the maw gapes. The hero feature. Grouped for extend/gnash. ──
  const beak = new THREE.Group();
  const beakProfile = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(rOuter * 0.12, rOuter * 0.06),
    new THREE.Vector2(rOuter * 0.18, rOuter * 0.20),   // bulge
    new THREE.Vector2(rOuter * 0.13, rOuter * 0.37),
    new THREE.Vector2(rOuter * 0.05, rOuter * 0.5),
    new THREE.Vector2(0.001, rOuter * 0.56),           // point
  ];
  const beakCore = new THREE.Mesh(new THREE.LatheGeometry(beakProfile, 16), _beakMat);
  beak.add(beakCore);
  const mandN = 4;
  for (let i = 0; i < mandN; i++) {
    const a = (i / mandN) * Math.PI * 2 + Math.PI / 4;
    const plate = new THREE.Mesh(new THREE.ConeGeometry(rOuter * 0.055, rOuter * 0.42, 4), _beakMat);
    plate.position.set(Math.cos(a) * rOuter * 0.07, rOuter * 0.21, Math.sin(a) * rOuter * 0.07);
    plate.rotation.z = Math.cos(a) * 0.18;
    plate.rotation.x = -Math.sin(a) * 0.18;
    plate.userData.mandAngle = a;
    beak.add(plate);
  }
  beak.position.y = throatTopY + rOuter * 0.04;   // rises from the throat mouth
  beak.userData.baseY = beak.position.y;
  g.add(beak);

  // ── Teeth — 3 concentric tiers of inward-pointing ivory fangs ringing the maw,
  //    outer biggest → inner smallest (around the beak). Grouped per role so the FSM
  //    can gape (lean back) / clench (lean in). ──
  const teeth = new THREE.Group();        // outer + mid tiers
  const innerTeeth = new THREE.Group();   // inner tier around the beak
  // ACAS A5 — denser fang ring (was 20/15/11 = 46 → 28/21/14 = 63, nearer the
  // canon ~73) so the maw reads as a jagged tooth-lined gullet, not a sparse ring.
  const tiers = [
    { grp: teeth,      n: 28, r: 0.82, len: 0.5,  y: 0.02,  thick: 0.062, lean: 0.9 },
    { grp: teeth,      n: 21, r: 0.6,  len: 0.42, y: -0.14, thick: 0.052, lean: 0.7 },
    { grp: innerTeeth, n: 14, r: 0.36, len: 0.32, y: -0.3,  thick: 0.045, lean: 0.5 },
  ];
  for (const tier of tiers) {
    for (let i = 0; i < tier.n; i++) {
      const a = (i / tier.n) * Math.PI * 2 + tier.r * 3.1;
      const len = rOuter * (tier.len + (i % 3) * 0.04);
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(rOuter * tier.thick, len, 5), _toothMat);
      tooth.position.set(Math.cos(a) * rOuter * tier.r, rOuter * tier.y + len * 0.34, Math.sin(a) * rOuter * tier.r);
      tooth.rotation.z = Math.cos(a) * tier.lean;   // tips curve inward over the throat
      tooth.rotation.x = -Math.sin(a) * tier.lean;
      tooth.rotation.y = -a;
      tooth.userData.toothAngle = a;
      tooth.userData.leanBase = tier.lean;
      tier.grp.add(tooth);
    }
  }
  g.add(teeth);
  g.add(innerTeeth);

  // ── Tentacles — sinuous tan feelers emerging from the lower maw wall, curling UP
  //    and INWARD over the throat. Each is a TubeGeometry along a CatmullRom curve,
  //    parented to a base pivot so the FSM can sway + raise them. ──
  const tendrils: THREE.Object3D[] = [];
  const tendN = 9;
  for (let i = 0; i < tendN; i++) {
    const a = (i / tendN) * Math.PI * 2 + 0.5;
    const baseR = rOuter * (0.8 + (i % 2) * 0.12);   // emerge from the funnel wall
    const reach = rOuter * (0.5 + (i % 4) * 0.16);   // varied lengths (some reach high)
    // Local curve: from the base, rise + curl toward -X (the pivot's y-rotation aims
    // -X at the maw center, so the feeler curls inward over the throat).
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-reach * 0.1, reach * 0.45, reach * 0.08),
      new THREE.Vector3(-reach * 0.42, reach * 0.82, -reach * 0.05),
      new THREE.Vector3(-reach * 0.78, reach * 0.96, 0),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const TS = 14, RS = 6;
    const tubeGeo = new THREE.TubeGeometry(curve, TS, rOuter * 0.05, RS, false);
    // Taper toward the tip — scale each cross-section ring's radial offset from the
    // centerline (uniform tubes read as pipes; tapered reads as an organic feeler).
    const pos = tubeGeo.attributes.position;
    const ctr = new THREE.Vector3(), tmp = new THREE.Vector3();
    for (let s = 0; s <= TS; s++) {
      curve.getPointAt(s / TS, ctr);
      const taper = 1 - 0.72 * (s / TS);
      for (let k = 0; k <= RS; k++) {
        const vi = s * (RS + 1) + k;
        tmp.fromBufferAttribute(pos, vi).sub(ctr).multiplyScalar(taper).add(ctr);
        pos.setXYZ(vi, tmp.x, tmp.y, tmp.z);
      }
    }
    tubeGeo.computeVertexNormals();
    const tube = new THREE.Mesh(tubeGeo, _tendrilMat);
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(a) * baseR, 0, Math.sin(a) * baseR);
    pivot.rotation.y = -a;    // orient local -X toward the maw center
    pivot.add(tube);
    pivot.userData.baseAngle = a;
    g.add(pivot);
    tendrils.push(pivot);
  }

  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  g.userData.parts = { teeth, innerTeeth, tendrils, throat, beak } as SarlaccPitParts;
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

  // ── Buried-until-entered (ACBD) — the teeth, tentacles + beak sink below the
  //    crater floor when dormant and RISE out of the sand as the maw gapes, tied to
  //    openAmt so they emerge exactly as the player enters the pit (and sink back
  //    when they leave). The static collar/throat/lip stay — only the living parts
  //    erupt. (The crater terrain occludes them while buried.) ──
  const sink = Tuning.SARLACC_PIT_BURY_DEPTH * (1 - pit.openAmt);
  pit.parts.teeth.position.y = -sink;
  pit.parts.innerTeeth.position.y = -sink;

  // ── Pose: the crater is PERMANENT terrain now — the mesh never sinks. Only the
  //    living maw animates: the beak extends + gnashes, the teeth gape (lean back)
  //    when open / clench (lean in) when dormant, the tentacles writhe, the gullet
  //    pulses. All scaled by openAmt so the gape telegraphs as the player nears. ──
  const r = pit.rOuter;
  const throatMat = pit.parts.throat.material as THREE.MeshLambertMaterial;
  throatMat.emissiveIntensity = 0.18 + pit.openAmt * 0.7 + Math.sin(elapsed * 2.2) * 0.12 * pit.openAmt;

  // Beak — rises from the throat + a slow gnash when open; mandibles splay.
  const beak = pit.parts.beak;
  const beakBaseY = (beak.userData.baseY as number) || 0;
  beak.position.y = beakBaseY + pit.openAmt * r * 0.16 + Math.sin(elapsed * 1.8) * 0.04 * pit.openAmt - sink;
  for (const ch of beak.children) {
    const ma = ch.userData.mandAngle as number | undefined;
    if (ma === undefined) continue;
    const splay = 0.16 + pit.openAmt * 0.5 + Math.sin(elapsed * 3 + ma) * 0.06 * pit.openAmt;
    ch.rotation.z = Math.cos(ma) * splay;
    ch.rotation.x = -Math.sin(ma) * splay;
  }

  // Teeth — gape (reduce inward lean) when open, clench when dormant.
  for (const grp of [pit.parts.teeth, pit.parts.innerTeeth]) {
    for (const t of grp.children) {
      const ta = t.userData.toothAngle as number | undefined;
      const lb = t.userData.leanBase as number | undefined;
      if (ta === undefined || lb === undefined) continue;
      const lean = lb * (1 - pit.openAmt * 0.4);
      t.rotation.z = Math.cos(ta) * lean;
      t.rotation.x = -Math.sin(ta) * lean;
    }
  }

  // Tentacles — sway (idle) → writhe + reach (open). Keep the pivot's y-orient.
  for (const tend of pit.parts.tendrils) {
    const ph = (tend.userData.baseAngle as number) || 0;
    tend.position.y = -sink;   // ACBD — rise from below the sand with the teeth
    tend.rotation.z = Math.sin(elapsed * 1.1 + ph) * (0.12 + pit.openAmt * 0.22);
    tend.rotation.x = Math.cos(elapsed * 0.9 + ph) * 0.1 * (0.4 + pit.openAmt);
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

