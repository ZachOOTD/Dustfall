// Item registry: every item the player can hold + its onUse behavior,
// first-person viewmodel mesh, hotbar SVG icon, and use animation.

import * as THREE from 'three';
import type { ItemDef, ItemId } from './types.ts';
import { Tuning } from '../config/tuning.ts';
import { playDrink, playPour, playBandageUse } from '../audio/audio.ts';
import { deployFire, findFireById, attachGrillToFire } from '../world/fire.ts';
import { deployTent } from '../world/tent.ts';
import { deploySled } from '../world/sled.ts';
import { deployLargeTent } from '../world/largeTent.ts';
import { deployBedroll } from '../world/bedroll.ts';
import { deployLantern } from '../world/lantern.ts';
import { deployLocker } from '../world/locker.ts';
import { deployStake } from '../world/stake.ts';
import { deployCompanion } from '../enemies/companion.ts';
import { easeOutBack, easeInOutCubic, easeOutQuad } from '../core/ease.ts';
import { addItem } from './inventory.ts';
import { makeLizardVisual } from '../enemies/lizard.ts';
import { createMetalMaterial } from '../world/metalMaterial.ts';
import { createFabricMaterial } from '../world/fabricMaterial.ts';
import { createWoodGrainMaterial } from '../world/woodGrainMaterial.ts';
import { createBoneMaterial } from '../world/boneMaterial.ts';
import { createGlassMaterial } from '../world/glassMaterial.ts';  // ACL ITEMS — lantern globe

const SVG_NS = 'http://www.w3.org/2000/svg';

// ACL ITEMS — amban rifle magazine capacity, mirrored from combat.ts's
// WEAPON_AMBAN_RIFLE_MAX_AMMO so the scrap_bullet reload path can cap fill
// without importing the combat spec (avoids a circular dep).
// Promoted to Tuning (integration) — single source of truth shared w/ combat.ts.
const AMBAN_RIFLE_MAX_AMMO = Tuning.WEAPON_AMBAN_RIFLE_MAX_AMMO;

function svg(viewBox = '0 0 24 24'): SVGSVGElement {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', viewBox);
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.6');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('stroke-linecap', 'round');
  return s;
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

/** Shared viewmodel builder for the lizard-on-a-stick item (raw + cooked).
 *  Vertical stick gripped at the bottom; the actual lizard mesh is impaled
 *  near the top of the stick, body roughly horizontal so it looks pierced.
 *  Cooked variant darkens both the stick (charred) and the lizard tint. */
function buildSkewerMesh(cooked: boolean): THREE.Group {
  const group = new THREE.Group();
  const stickColor = cooked ? 0x4a3a30 : 0x6e685f;
  const stickMat = new THREE.MeshLambertMaterial({ color: stickColor });
  // II — longer stick so there's visible branch above + below the lizard.
  const stickLen = 0.55;
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.018, stickLen, 6),
    stickMat,
  );
  // Stick is vertical (default cylinder is along Y). Grip lives at the
  // group origin → push the stick up so its base sits there.
  stick.position.y = stickLen * 0.5;
  group.add(stick);

  // Lizard impaled near the top of the stick. Use the shared
  // makeLizardVisual so changing the lizard model elsewhere keeps the
  // skewer in sync. Right-side-up so the stick pierces underbelly →
  // back; slid down the stick so a clear tip of branch protrudes above
  // the lizard.
  const lizard = makeLizardVisual();
  lizard.scale.setScalar(0.85);
  // Side-on view of the lizard skewered through belly → back. Y = π
  // flips the lizard's local +X (its head) to point to the player's
  // LEFT, putting the tail on the right. Small X and Z tilts keep the
  // body from sitting perfectly axis-aligned ("slumped on the spit"
  // look) without disturbing the belly-to-back stick orientation.
  lizard.rotation.set(0.14, Math.PI, -0.18);
  // Position the lizard's center at ~73% up the stick so ~0.15 of
  // stick is visible above its back.
  lizard.position.set(0, stickLen * 0.73, 0);
  group.add(lizard);

  // If cooked, walk the lizard meshes and darken their materials toward
  // a roasted brown. We clone material so the source helper's instances
  // aren't mutated.
  if (cooked) {
    lizard.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshLambertMaterial;
      const cloned = mat.clone();
      cloned.color.setHex(0x3a2418);  // charred brown
      m.material = cloned;
    });
  }

  // Tilt the whole skewer slightly forward so the lizard hangs out
  // toward where the player is looking (away from body, per the spec).
  group.rotation.set(-0.15, 0, -0.05);
  return group;
}

const _DEFS: Record<ItemId, ItemDef> = {
  canteen: {
    id: 'canteen',
    name: 'CANTEEN',
    glyph: '◇',
    description: 'a half-empty canteen',
    stackable: false,
    maxStack: 1,
    wieldLmb: 'hold_use',
    thirdPersonScale: 1.3,    // ABY P3
    onUse(ctx, slot) {
      // Q-key single-gulp path (backward compatibility post-UU).
      const fill = slot.meta?.fillLevel ?? 1;
      if (fill <= 0.001) {
        return { consumed: false, message: 'the canteen is empty' };
      }
      const drink = Math.min(fill, Tuning.CANTEEN_DRINK_DELTA);
      if (!slot.meta) slot.meta = { fillLevel: 1 };
      slot.meta.fillLevel = Math.max(0, fill - drink);
      // Thirst gain scales with how much we actually drank (proportional).
      const restorePerUnit = Tuning.CANTEEN_THIRST_RESTORE / Tuning.CANTEEN_DRINK_DELTA;
      ctx.stats.thirst = Math.min(1, ctx.stats.thirst + drink * restorePerUnit);
      playPour();
      playDrink();
      const empty = slot.meta.fillLevel <= 0.001;
      return {
        consumed: false,
        message: empty ? 'you drink the last of it' : 'you drink — the water is warm',
      };
    },
    // Session UU — hold-LMB sustained drinking. Deliver one gulp each
    // time holdSeconds crosses a multiple of CANTEEN_DRINK_INTERVAL_S.
    // No bookkeeping field needed — derive the crossing from (now, now-dt).
    onHoldTick(ctx, slot, holdSeconds, dt) {
      const interval = Tuning.CANTEEN_DRINK_INTERVAL_S;
      const prev = Math.max(0, holdSeconds - dt);
      const gulpsAfter = Math.floor(holdSeconds / interval);
      const gulpsBefore = Math.floor(prev / interval);
      if (gulpsAfter <= gulpsBefore) return;
      const fill = slot.meta?.fillLevel ?? 1;
      if (fill <= 0.001) {
        // Empty — toast on the first attempted gulp of this hold.
        if (gulpsBefore === 0) ctx.ui.showToast('the canteen is empty');
        return;
      }
      const drink = Math.min(fill, Tuning.CANTEEN_DRINK_DELTA);
      if (!slot.meta) slot.meta = { fillLevel: 1 };
      slot.meta.fillLevel = Math.max(0, fill - drink);
      const restorePerUnit = Tuning.CANTEEN_THIRST_RESTORE / Tuning.CANTEEN_DRINK_DELTA;
      ctx.stats.thirst = Math.min(1, ctx.stats.thirst + drink * restorePerUnit);
      playPour();
      playDrink();
      ctx.player.viewModel?.triggerUse();
      if (slot.meta.fillLevel <= 0.001) {
        ctx.ui.showToast('you drink the last of it');
      }
    },
    makeViewModel() {
      const group = new THREE.Group();
      const bodyMat = new THREE.MeshLambertMaterial({
        color: 0x4a463c,
        emissive: 0x12110d,
      });
      const capMat = new THREE.MeshLambertMaterial({ color: 0x2a2620 });
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.065, 0.16, 12),
        bodyMat,
      );
      body.scale.set(1, 1, 0.6);
      group.add(body);
      const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.04, 8),
        bodyMat,
      );
      neck.position.y = 0.10;
      group.add(neck);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.015, 8),
        capMat,
      );
      cap.position.y = 0.128;
      group.add(cap);
      group.rotation.set(0, 0, -0.18);
      return group;
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('rect', { x: '7', y: '8', width: '10', height: '12', rx: '2.2' }));
      s.appendChild(svgEl('rect', { x: '10', y: '4', width: '4', height: '4' }));
      s.appendChild(svgEl('line', { x1: '9', y1: '3.5', x2: '15', y2: '3.5' }));
      s.appendChild(svgEl('path', { d: 'M7 11 Q5 14 7 17', 'stroke-width': '1' }));
      return s;
    },
    playUseAnim(itemRoot, t) {
      // Rise to lips with a snappy back-overshoot; release with a soft ease.
      // Positive rotation.x tips the cap toward the camera (toward the
      // player's mouth); negative would pour forward, away from the face.
      const p = t < 0.5
        ? easeOutBack(t * 2)
        : 1 - easeOutQuad((t - 0.5) * 2);
      itemRoot.position.set(-0.16 * p, 0.20 * p, 0.08 * p);
      itemRoot.rotation.set(1.35 * p, -0.25 * p, -0.18);
    },
    useAnimDuration: Tuning.VIEWMODEL_CANTEEN_ANIM_S,
  },

  bandage: {
    id: 'bandage',
    name: 'BANDAGE',
    glyph: '+',
    description: 'a strip of clean fabric — torn from a hull pennant',
    stackable: true,
    maxStack: 4,
    thirdPersonScale: 1.5,    // ABY P3 — small + light-colored, biggest boost needed
    onUse(ctx, _slot) {
      ctx.stats.health = Math.min(1, ctx.stats.health + 0.25);
      // AAN — cloth-tear + soft pad SFX so the use lands audibly.
      playBandageUse();
      return { consumed: true, message: 'you bind a wound' };
    },
    makeViewModel() {
      // ABJ — B13: applied fabric shader (weave + color variation +
      // stains). Pad gets the weave reading; binding stripes show
      // distinct cloth weave for free. Added a small red cross stripe
      // for the "medical kit" silhouette.
      const group = new THREE.Group();
      // ABN — disableShimmer for viewmodels: shimmer + world-sampled
      // noise read as "the bandage expands when I walk" because the
      // shader sees a camera-relative position. Object-local sampling
      // keeps the weave + stain pattern anchored to the pad as it bobs.
      const cloth = createFabricMaterial(0xe8dcc0, undefined, { disableShimmer: true });
      const stripe = createFabricMaterial(0xc8b89a, undefined, { disableShimmer: true });
      const crossMat = new THREE.MeshLambertMaterial({ color: 0xa83a2a });
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.04, 0.08), cloth);
      group.add(pad);
      const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.041, 0.082), stripe);
      s1.position.x = -0.03;
      group.add(s1);
      const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.041, 0.082), stripe);
      s2.position.x = 0.03;
      group.add(s2);
      // Red cross — small horizontal + vertical bar atop the pad
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.005, 0.011), crossMat);
      crossH.position.set(0, 0.021, 0);
      group.add(crossH);
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.005, 0.045), crossMat);
      crossV.position.set(0, 0.021, 0);
      group.add(crossV);
      return group;
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('rect', { x: '10', y: '4', width: '4', height: '16', rx: '0.8' }));
      s.appendChild(svgEl('rect', { x: '4', y: '10', width: '16', height: '4', rx: '0.8' }));
      return s;
    },
    playUseAnim(itemRoot, t) {
      // Deliberate up + down, smooth at both ends — no overshoot.
      const p = t < 0.5
        ? easeInOutCubic(t * 2)
        : 1 - easeInOutCubic((t - 0.5) * 2);
      itemRoot.position.set(-0.10 * p, 0.18 * p, 0.04 * p);
      itemRoot.rotation.set(-0.4 * p, 0, 0);
    },
    useAnimDuration: Tuning.VIEWMODEL_BANDAGE_ANIM_S,
  },

  scrap: {
    id: 'scrap',
    name: 'SCRAP',
    glyph: '#',
    description: 'salvaged hull plating',
    stackable: true,
    maxStack: 8,
    onUse(_ctx, _slot) {
      return { consumed: false, message: 'no use for it yet' };
    },
    makeViewModel() {
      // ABJ — B13: upgraded from 1-box + 1-bolt flat Lambert to weathered-
      // metal chunk + 2 bolts + a small bent fragment. Reads as actual
      // salvaged plate scrap rather than a brick. ABH metal shader gives
      // scratches + edge dirt.
      const group = new THREE.Group();
      const mat = createMetalMaterial(0x6e5a4a, { wornScale: 6.0 });
      const accentMat = createMetalMaterial(0x4a3a2a, { wornScale: 6.0, scratchStrength: 0.03 });
      // Main plate — slightly trapezoidal silhouette via small tilted slice
      const chunk = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.04, 0.07), mat);
      chunk.rotation.set(0.2, 0.4, 0.1);
      group.add(chunk);
      // Bent edge fragment — adds asymmetry; sits over one corner
      const bend = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.06), accentMat);
      bend.position.set(-0.045, 0.025, 0);
      bend.rotation.set(0.5, 0.3, 0.2);
      group.add(bend);
      // 2 bolts — main rivet + secondary
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.020, 6),
        accentMat,
      );
      bolt.position.set(0.04, 0.025, 0.02);
      bolt.rotation.x = Math.PI / 2;
      group.add(bolt);
      const bolt2 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.010, 0.010, 0.016, 6),
        accentMat,
      );
      bolt2.position.set(0.02, 0.022, -0.025);
      bolt2.rotation.x = Math.PI / 2;
      group.add(bolt2);
      return group;
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('polygon', { points: '5,8 9,4 16,5 20,10 18,17 12,20 6,16' }));
      s.appendChild(svgEl('line', { x1: '9', y1: '10', x2: '14', y2: '14', 'stroke-width': '1' }));
      return s;
    },
  },

  // Session AAR — scrap bar: heavy iron lever used to pry open salvage
  // access panels. Without this equipped, panels stay sealed (the new
  // tactile salvage flow gates open-panel on tool). wieldLmb='click_use'
  // routes through wieldAction → fires a one-shot pry attempt when the
  // crosshair is on a salvageable panel. Otherwise inert (no LMB attack;
  // it's not a weapon).
  scrap_bar: {
    id: 'scrap_bar',
    name: 'SCRAP BAR',
    glyph: '/',
    description: 'a length of bent iron, perfect for prying',
    stackable: false,
    maxStack: 1,
    wieldLmb: 'click_use',
    thirdPersonScale: 1.4,    // ABY P3 — small thin metal bar, boost for 3P visibility
    onUse(_ctx, _slot) {
      // The actual pry logic lives in interaction.ts's 'salvageables'
      // case — onUse returns "do nothing" because the interaction.ts
      // path handles the hover-aware action. If LMB fires without a
      // salvageable hovered, this is a no-op (no toast, no consumption).
      return { consumed: false };
    },
    makeViewModel() {
      const group = new THREE.Group();
      // ABH — scrap bar metal gets the weathered-metal procedural shader
      // (scratches + worn highlights + edge dirt). Keeps emissive for the
      // moody dark tone the original ironMat had.
      const ironMat = createMetalMaterial(0x6e5a4a, { wornScale: 6.0 });
      ironMat.emissive = new THREE.Color(0x0a0806);
      const tipMat = createMetalMaterial(0x8a7a64, { wornScale: 6.0 });
      // Main shaft — long bar, square cross-section, slight bend at the tip.
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.34, 0.022), ironMat);
      shaft.position.y = 0.05;
      group.add(shaft);
      // Bent prying tip — angled 25° at the top end.
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.08, 0.022), tipMat);
      tip.position.set(-0.018, 0.24, 0);
      tip.rotation.z = -0.44;       // ~25° bend toward the hook
      group.add(tip);
      // Forked hook at the very end — splits into 2 small claws.
      const claw1 = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.020, 0.010), tipMat);
      claw1.position.set(-0.038, 0.28, 0.008);
      claw1.rotation.z = -0.44;
      group.add(claw1);
      const claw2 = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.020, 0.010), tipMat);
      claw2.position.set(-0.038, 0.28, -0.008);
      claw2.rotation.z = -0.44;
      group.add(claw2);
      // Grip wrap — leather binding at the base of the shaft.
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.10, 0.026),
        new THREE.MeshLambertMaterial({ color: 0x2a1e16, flatShading: true }));
      grip.position.y = -0.10;
      group.add(grip);
      group.rotation.set(-0.15, 0.0, 0.10);
      return group;
    },
    makeIcon() {
      const s = svg();
      // Long shaft
      s.appendChild(svgEl('line', { x1: '12', y1: '4', x2: '12', y2: '20', 'stroke-width': '2.2' }));
      // Bent hook tip
      s.appendChild(svgEl('polyline', { points: '12,4 8,2 6,4' }));
      return s;
    },
    playUseAnim(itemRoot, t) {
      // Pry-thrust animation — forward jab + slight roll, recovers cubic.
      const p = t < 0.35
        ? easeOutBack(t / 0.35)
        : 1 - easeInOutCubic((t - 0.35) / 0.65);
      itemRoot.position.set(-0.06 * p, 0.03 * p, -0.16 * p);
      itemRoot.rotation.set(-0.5 * p, -0.15 * p, 0.10 + 0.4 * p);
    },
    useAnimDuration: Tuning.VIEWMODEL_MACHETE_ANIM_S,
  },

  machete: {
    id: 'machete',
    name: 'MACHETE',
    glyph: '|',
    description: 'a notched, weighted blade',
    stackable: false,
    maxStack: 1,
    wieldLmb: 'attack',
    thirdPersonScale: 1.35,    // ABY P3
    onUse(_ctx, _slot) {
      return { consumed: false };
    },
    makeViewModel() {
      const group = new THREE.Group();
      // ABH — machete blade gets weathered-metal shader (brushed scratches
      // perpendicular to the blade length give the "honed edge" read).
      const bladeMat = createMetalMaterial(0xa8aab0, {
        scratchAngle: 0,           // scratches along world X — perpendicular to blade as held
        wornScale: 8.0,
        scratchStrength: 0.07,
      });
      bladeMat.emissive = new THREE.Color(0x10100e);
      const handleMat = new THREE.MeshLambertMaterial({ color: 0x2a1e16 });
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.28, 0.006), bladeMat);
      blade.position.y = 0.10;
      group.add(blade);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.04, 0.006), bladeMat);
      tip.position.y = 0.26;
      group.add(tip);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.012, 0.018), handleMat);
      guard.position.y = -0.04;
      group.add(guard);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.08, 0.022), handleMat);
      handle.position.y = -0.09;
      group.add(handle);
      group.rotation.set(-0.2, 0.0, 0.15);
      return group;
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('polygon', { points: '15,3 19,5 11,17 9,15' }));
      s.appendChild(svgEl('line', { x1: '8', y1: '14', x2: '12', y2: '18' }));
      s.appendChild(svgEl('line', { x1: '7', y1: '17', x2: '5', y2: '20' }));
      return s;
    },
    playUseAnim(itemRoot, t) {
      // Strike phase (0..0.4): snap forward with back-overshoot.
      // Recovery phase (0.4..1): cubic ease back to rest.
      const p = t < 0.4
        ? easeOutBack(t / 0.4)
        : 1 - easeInOutCubic((t - 0.4) / 0.6);
      itemRoot.position.set(-0.04 * p, 0.04 * p, -0.22 * p);
      itemRoot.rotation.set(-0.85 * p, -0.2 * p, 0.15);
    },
    useAnimDuration: Tuning.VIEWMODEL_MACHETE_ANIM_S,
  },

  // Session PP — pipe staff. Slower heavy swing, longer reach, knockback.
  pipe_staff: {
    id: 'pipe_staff',
    name: 'PIPE STAFF',
    glyph: '⊓',
    description: 'a length of scrap pipe with cloth grip',
    stackable: false,
    maxStack: 1,
    wieldLmb: 'attack',
    onUse(_ctx, _slot) {
      return { consumed: false };
    },
    makeViewModel() {
      const group = new THREE.Group();
      // ABH — pipe staff: metal pipe + cap get weathered-metal; grip stays
      // wrapped-cord look (plain Lambert).
      const pipeMat = createMetalMaterial(0x6a6055, { wornScale: 5.0 });
      pipeMat.emissive = new THREE.Color(0x0a0907);
      const gripMat = new THREE.MeshLambertMaterial({ color: 0x382820 });
      const capMat = createMetalMaterial(0x4a4035, { wornScale: 5.0 });
      // Main pipe — long thin cylinder along Y.
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.46, 8),
        pipeMat,
      );
      pipe.position.y = 0.10;
      group.add(pipe);
      // End cap at the top (the striking end) — slightly fatter.
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.022, 0.04, 8),
        capMat,
      );
      cap.position.y = 0.34;
      group.add(cap);
      // Cloth grip wrap at the bottom — 3 thin bands.
      for (let i = 0; i < 3; i++) {
        const band = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.022, 0.018, 6),
          gripMat,
        );
        band.position.y = -0.10 + i * 0.022;
        group.add(band);
      }
      // Rest pose mirrors the machete tilt.
      group.rotation.set(-0.2, 0.0, 0.15);
      return group;
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('line', { x1: '6', y1: '20', x2: '18', y2: '4' }));
      s.appendChild(svgEl('rect', { x: '4', y: '18', width: '5', height: '4' }));
      return s;
    },
    playUseAnim(itemRoot, t) {
      // Slower wind-up + heavier follow-through than the machete.
      // Strike phase 0..0.5 (slow wind-up overshoot), recovery 0.5..1.
      const p = t < 0.5
        ? easeOutBack(t / 0.5)
        : 1 - easeInOutCubic((t - 0.5) / 0.5);
      itemRoot.position.set(-0.06 * p, 0.05 * p, -0.30 * p);
      itemRoot.rotation.set(-1.05 * p, -0.18 * p, 0.15);
    },
    useAnimDuration: Tuning.VIEWMODEL_PIPE_STAFF_ANIM_S,
  },

  // Session PP — scrap gun. Single-shot ranged. Ammo via slot.meta.
  scrap_gun: {
    id: 'scrap_gun',
    name: 'SCRAP GUN',
    glyph: '⌐',
    description: 'a crude single-shot scrap-iron pistol',
    stackable: false,
    maxStack: 1,
    wieldLmb: 'attack',
    thirdPersonScale: 1.35,    // ABY P3
    onUse(_ctx, _slot) {
      // Firing is driven by combat.ts via LMB — `onUse` (E key) is a
      // no-op for ranged weapons.
      return { consumed: false };
    },
    makeViewModel() {
      const group = new THREE.Group();
      // ABH — scrap gun: receiver + barrel get weathered-metal (heavy worn
      // around the action). Grip stays plain wrapped-cord.
      const bodyMat = createMetalMaterial(0x4a4640, { wornScale: 7.0 });
      bodyMat.emissive = new THREE.Color(0x0a0907);
      const barrelMat = createMetalMaterial(0x2c2924, { wornScale: 7.0, scratchAngle: Math.PI / 2 });
      const gripMat = new THREE.MeshLambertMaterial({ color: 0x382820 });
      // Receiver — short rectangular block. Z is forward (camera +Z is
      // into the screen via Three.js — viewmodel renders in -Z space so
      // the barrel points away from the camera along its own +Z).
      const receiver = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.06, 0.10),
        bodyMat,
      );
      receiver.position.set(0, 0, -0.04);
      group.add(receiver);
      // Barrel — thin cylinder extending forward from receiver.
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.18, 8),
        barrelMat,
      );
      barrel.rotation.x = Math.PI / 2;          // align cylinder Y → +Z (forward)
      barrel.position.set(0, 0.012, -0.18);
      group.add(barrel);
      // Front sight — tiny bump on top of the barrel near the muzzle.
      const sight = new THREE.Mesh(
        new THREE.BoxGeometry(0.005, 0.012, 0.012),
        bodyMat,
      );
      sight.position.set(0, 0.028, -0.26);
      group.add(sight);
      // Grip — angled downward from receiver.
      const grip = new THREE.Mesh(
        new THREE.BoxGeometry(0.026, 0.090, 0.030),
        gripMat,
      );
      grip.position.set(0, -0.062, -0.005);
      grip.rotation.x = -0.30;                  // canted slightly forward for a real pistol angle
      group.add(grip);
      // Trigger guard — small loop hanging below the receiver.
      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(0.028, 0.014, 0.040),
        bodyMat,
      );
      guard.position.set(0, -0.024, -0.022);
      group.add(guard);
      // Rest pose — pistol angled slightly upward + canted as if held
      // at the hip-ish ready position.
      group.rotation.set(-0.08, 0.02, 0.10);
      return group;
    },
    makeIcon() {
      const s = svg();
      // Pistol silhouette: barrel + grip
      s.appendChild(svgEl('rect', { x: '4', y: '8', width: '14', height: '5' }));
      s.appendChild(svgEl('rect', { x: '6', y: '13', width: '6', height: '8' }));
      s.appendChild(svgEl('line', { x1: '18', y1: '10.5', x2: '21', y2: '10.5' }));
      return s;
    },
    playUseAnim(itemRoot, t) {
      // Sharp recoil — quick kick back, fast return. Easing favors a
      // snap on the kick and a softer settle.
      const kick = t < 0.25
        ? easeOutBack(t / 0.25)
        : 1 - easeOutQuad((t - 0.25) / 0.75);
      // Pull back along -Z (toward camera), slight up-Y, small CCW yaw.
      itemRoot.position.set(0.01 * kick, 0.025 * kick, 0.10 * kick);
      itemRoot.rotation.set(-0.25 * kick, 0.05 * kick, 0.10);
    },
    useAnimDuration: Tuning.VIEWMODEL_SCRAP_GUN_ANIM_S,
  },

  // Session PP — scrap bullets. Consumable ammo for the scrap gun.
  // `onUse` (E key) tops up the gun's slot.meta.ammoRemaining if the
  // gun is currently the equipped slot. Stackable.
  scrap_bullet: {
    id: 'scrap_bullet',
    name: 'SCRAP BULLET',
    glyph: '*',
    description: 'a hand-loaded scrap-iron round',
    stackable: true,
    maxStack: 12,
    onUse(ctx, _slot) {
      // Find the equipped scrap_gun and increment its ammo by 1.
      // If the equipped item ISN'T a scrap_gun, this is a no-op
      // (we don't want to silently consume a bullet).
      const equipped = ctx.inventory.slots[ctx.inventory.selectedIdx];
      // ACL ITEMS — bullets also feed the amban rifle (both are
      // scrap_bullet-fed ranged weapons).
      if (equipped.item !== 'scrap_gun' && equipped.item !== 'amban_rifle') {
        return { consumed: false, message: 'equip a scrap-fed gun first' };
      }
      // amban capacity from Tuning.WEAPON_AMBAN_RIFLE_MAX_AMMO (via AMBAN_RIFLE_MAX_AMMO).
      const maxAmmo = equipped.item === 'amban_rifle'
        ? AMBAN_RIFLE_MAX_AMMO
        : Tuning.WEAPON_SCRAP_GUN_MAX_AMMO;
      const cur = equipped.meta?.ammoRemaining ?? 0;
      if (cur >= maxAmmo) {
        return { consumed: false, message: 'gun is full' };
      }
      if (!equipped.meta) equipped.meta = {};
      equipped.meta.ammoRemaining = cur + 1;
      return { consumed: true, message: `loaded (${cur + 1}/${maxAmmo})` };
    },
    makeViewModel() {
      // A single bullet held in the fingertips — small cylinder.
      const group = new THREE.Group();
      // ABH — bullet brass case gets weathered metal with tight scratches.
      const brassMat = createMetalMaterial(0xa28860, { wornScale: 14.0, scratchStrength: 0.03 });
      brassMat.emissive = new THREE.Color(0x100a04);
      const tipMat = createMetalMaterial(0x484035, { wornScale: 14.0 });
      const case_ = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.035, 8),
        brassMat,
      );
      case_.position.y = 0.018;
      group.add(case_);
      const tip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.013, 0.0, 0.020, 8),
        tipMat,
      );
      tip.position.y = 0.045;
      group.add(tip);
      group.rotation.set(-0.4, 0.0, 0.20);
      return group;
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('rect', { x: '10', y: '8', width: '4', height: '10' }));
      s.appendChild(svgEl('polygon', { points: '10,8 14,8 12,4' }));
      return s;
    },
    playUseAnim(itemRoot, t) {
      // Reload pantomime — short tip-forward as if seating the round.
      const p = Math.sin(t * Math.PI);
      itemRoot.position.set(0, -0.02 * p, -0.05 * p);
      itemRoot.rotation.set(-0.4 - 0.3 * p, 0.0, 0.20);
    },
    useAnimDuration: Tuning.VIEWMODEL_SCRAP_BULLET_ANIM_S,
  },

  // Session PP — energy pistol. Hold LMB to charge; release to fire
  // with damage scaled by hold time (0.5 tap → 2.0 fully charged over
  // 1.2s). No ammo. The viewmodel's chamber pulses brighter as the
  // charge ramps up — driven by updateHeld + chargeProgress().
  energy_pistol: {
    id: 'energy_pistol',
    name: 'ENERGY PISTOL',
    glyph: '⌬',
    description: 'a salvaged sci-fi sidearm; hold to charge, release to fire',
    stackable: false,
    maxStack: 1,
    wieldLmb: 'attack',
    onUse(_ctx, _slot) {
      return { consumed: false };
    },
    makeViewModel() {
      const group = new THREE.Group();
      // ABH — energy pistol: alloy body + accent get weathered-metal with
      // a finer scale (high-tech tool, less worn than scrap gear).
      const bodyMat = createMetalMaterial(0x2a3540, { wornScale: 10.0, scratchStrength: 0.04 });
      bodyMat.emissive = new THREE.Color(0x0a0d12);
      const accentMat = createMetalMaterial(0x4a5560, { wornScale: 10.0, scratchStrength: 0.04 });
      const gripMat = new THREE.MeshLambertMaterial({ color: 0x18202a });
      // Chamber mat is emissive so we can pulse it via updateHeld as
      // the weapon charges. Stash it on group.userData so updateHeld
      // can find it.
      const chamberMat = new THREE.MeshBasicMaterial({ color: 0x1a1410 });
      // Receiver — short angular body.
      const receiver = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.055, 0.085),
        bodyMat,
      );
      receiver.position.set(0, 0, -0.05);
      group.add(receiver);
      // Barrel — flat-topped emitter rather than a round muzzle.
      const barrel = new THREE.Mesh(
        new THREE.BoxGeometry(0.028, 0.022, 0.10),
        accentMat,
      );
      barrel.position.set(0, 0.01, -0.14);
      group.add(barrel);
      // Emitter cap at the muzzle — small bright disc that glows
      // when fired (could be tied to swingViewKick later).
      const emitter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011, 0.011, 0.004, 8),
        chamberMat,
      );
      emitter.rotation.x = Math.PI / 2;
      emitter.position.set(0, 0.01, -0.193);
      group.add(emitter);
      // Charge chamber — small box on top of the receiver that glows
      // brighter as the charge ramps. We tint chamberMat from dark to
      // hot blue-white via updateHeld below.
      const chamber = new THREE.Mesh(
        new THREE.BoxGeometry(0.020, 0.012, 0.025),
        chamberMat,
      );
      chamber.position.set(0, 0.04, -0.045);
      group.add(chamber);
      group.userData.chamberMat = chamberMat;
      group.userData.emitterMat = chamberMat;     // share for now
      // Grip — angled down.
      const grip = new THREE.Mesh(
        new THREE.BoxGeometry(0.028, 0.085, 0.030),
        gripMat,
      );
      grip.position.set(0, -0.060, -0.015);
      grip.rotation.x = -0.28;
      group.add(grip);
      // Trigger guard.
      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(0.030, 0.012, 0.038),
        bodyMat,
      );
      guard.position.set(0, -0.022, -0.030);
      group.add(guard);
      // Rest pose — similar to scrap_gun.
      group.rotation.set(-0.08, 0.02, 0.10);
      return group;
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('rect', { x: '4', y: '8', width: '14', height: '5' }));
      s.appendChild(svgEl('rect', { x: '8', y: '5', width: '5', height: '3' }));
      s.appendChild(svgEl('rect', { x: '6', y: '13', width: '6', height: '8' }));
      s.appendChild(svgEl('line', { x1: '18', y1: '10.5', x2: '22', y2: '10.5' }));
      return s;
    },
    playUseAnim(itemRoot, t) {
      // Quick recoil pulse on fire. Smaller than scrap_gun (less
      // mechanical, more "vrrm").
      const kick = t < 0.3
        ? easeOutBack(t / 0.3)
        : 1 - easeOutQuad((t - 0.3) / 0.7);
      itemRoot.position.set(0.008 * kick, 0.018 * kick, 0.06 * kick);
      itemRoot.rotation.set(-0.18 * kick, 0.04 * kick, 0.10);
    },
    useAnimDuration: Tuning.VIEWMODEL_ENERGY_PISTOL_ANIM_S,
    // Per-frame: drive the chamber+emitter glow based on combat.ts's
    // exposed chargeProgress (0..1). At t=0 → dark. At t=1 → hot
    // blue-white. Color lerps through warm orange in the middle so
    // the player gets a visible warning before the shot maxes out.
    updateHeld(itemRoot, _slot, ctx, _dt) {
      const chamberMat = itemRoot.userData.chamberMat as THREE.MeshBasicMaterial | undefined;
      const emitterMat = itemRoot.userData.emitterMat as THREE.MeshBasicMaterial | undefined;
      if (!chamberMat) return;
      // Lazy-import the combat module to avoid a static import cycle.
      // Cache on window so we only pay the dynamic-import cost once.
      // (Combat module is small + already loaded by main; this is
      // effectively a free property lookup after the first frame.)
      const cp = (window as unknown as { __chargeProgress?: (c: typeof ctx) => number }).__chargeProgress;
      const t = cp ? cp(ctx) : 0;
      // Cold dark → warm orange (0.5) → hot blue-white (1.0).
      let r: number, g: number, b: number;
      if (t < 0.5) {
        const u = t / 0.5;
        r = 0.10 + u * (1.10 - 0.10);
        g = 0.08 + u * (0.45 - 0.08);
        b = 0.06 + u * (0.10 - 0.06);
      } else {
        const u = (t - 0.5) / 0.5;
        r = 1.10 - u * (1.10 - 0.65);
        g = 0.45 + u * (0.95 - 0.45);
        b = 0.10 + u * (1.15 - 0.10);
      }
      chamberMat.color.setRGB(r, g, b);
      if (emitterMat && emitterMat !== chamberMat) emitterMat.color.setRGB(r, g, b);
    },
  },

  // ACL ITEMS — amban rifle. Long-barreled ranged weapon: longer reach +
  // harder hit than the scrap gun (see combat.ts _WEAPON_SPECS). Procedural
  // wood stock + machined-metal receiver/barrel from the material factories.
  // wieldLmb:'attack' routes LMB through updateCombat's ranged path; R
  // reloads from scrap_bullet stacks (combat.ts updateReload, generalized).
  amban_rifle: {
    id: 'amban_rifle',
    name: 'AMBAN RIFLE',
    glyph: '↟',
    description: 'a long-barreled marksman rifle; carved stock, scrap-iron action',
    stackable: false,
    maxStack: 1,
    wieldLmb: 'attack',
    thirdPersonScale: 1.25,    // ACL — long but thin; modest 3P boost
    onUse(_ctx, _slot) {
      // Ranged firing is driven by combat.ts via LMB; onUse (E) is inert.
      return { consumed: false };
    },
    makeViewModel() {
      const group = new THREE.Group();
      // Receiver/barrel — machined dark steel; long barrel runs forward (-Z).
      const steelMat = createMetalMaterial(0x3a3832, { wornScale: 9.0, scratchStrength: 0.05 });
      steelMat.emissive = new THREE.Color(0x090807);
      const barrelMat = createMetalMaterial(0x26241f, { wornScale: 9.0, scratchAngle: Math.PI / 2, scratchStrength: 0.06 });
      // Stock + fore-grip — carved wood grain.
      const woodMat = createWoodGrainMaterial(0x5a3a22, {
        grainAxis: Math.PI / 2,     // grain runs along the barrel axis
        ringDensity: 9.0,
        weatherLevel: 0.4,
      });
      // Receiver block — the action, sits at grip height.
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.055, 0.14), steelMat);
      receiver.position.set(0, 0, -0.02);
      group.add(receiver);
      // Long barrel — extends well forward of the receiver.
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011, 0.013, 0.46, 10),
        barrelMat,
      );
      barrel.rotation.x = Math.PI / 2;       // cylinder Y → +Z (forward)
      barrel.position.set(0, 0.012, -0.34);
      group.add(barrel);
      // Muzzle band — slightly fatter ring near the barrel tip.
      const muzzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.016, 0.04, 10),
        steelMat,
      );
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.set(0, 0.012, -0.55);
      group.add(muzzle);
      // Wooden fore-grip — a tube wrapping the rear half of the barrel.
      const foreGrip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.18, 8),
        woodMat,
      );
      foreGrip.rotation.x = Math.PI / 2;
      foreGrip.position.set(0, 0.006, -0.20);
      group.add(foreGrip);
      // Iron sight — small blade on top near the muzzle.
      const sight = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.018, 0.012), steelMat);
      sight.position.set(0, 0.032, -0.50);
      group.add(sight);
      // Rear sight notch — small block atop the receiver.
      const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.012), steelMat);
      rearSight.position.set(0, 0.033, 0.02);
      group.add(rearSight);
      // Wooden shoulder stock — angled back + down behind the receiver.
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.07, 0.16), woodMat);
      stock.position.set(0, -0.022, 0.13);
      stock.rotation.x = 0.12;
      group.add(stock);
      // Stock comb — thin raised cheek-piece on the stock.
      const comb = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.014, 0.10), woodMat);
      comb.position.set(0, 0.018, 0.10);
      group.add(comb);
      // Grip — angled wooden pistol grip beneath the receiver.
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.075, 0.030), woodMat);
      grip.position.set(0, -0.052, 0.01);
      grip.rotation.x = -0.30;
      group.add(grip);
      // Trigger guard — metal loop below the action.
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.012, 0.040), steelMat);
      guard.position.set(0, -0.024, -0.01);
      group.add(guard);
      // Bolt handle — small knob jutting from the right of the receiver.
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6),
        steelMat,
      );
      bolt.rotation.z = Math.PI / 2;
      bolt.position.set(0.035, 0.012, 0.02);
      group.add(bolt);
      // Rest pose — held at a slight cant, shouldered-ready angle.
      group.rotation.set(-0.06, 0.04, 0.08);
      return group;
    },
    makeIcon() {
      const s = svg();
      // Long rifle silhouette — barrel line + stock + grip.
      s.appendChild(svgEl('line', { x1: '3', y1: '8', x2: '20', y2: '8', 'stroke-width': '2' }));
      s.appendChild(svgEl('polygon', { points: '17,8 21,9 21,13 16,12' }));   // receiver/stock
      s.appendChild(svgEl('line', { x1: '13', y1: '9', x2: '12', y2: '15' })); // grip
      s.appendChild(svgEl('line', { x1: '4', y1: '6.5', x2: '4', y2: '8' }));  // muzzle sight
      return s;
    },
    playUseAnim(itemRoot, t) {
      // Heavy recoil — sharp kick back + slight muzzle rise, slow settle.
      const kick = t < 0.22
        ? easeOutBack(t / 0.22)
        : 1 - easeOutQuad((t - 0.22) / 0.78);
      itemRoot.position.set(0.006 * kick, 0.03 * kick, 0.13 * kick);
      itemRoot.rotation.set(-0.20 * kick, 0.04 * kick, 0.08);
    },
    useAnimDuration: Tuning.VIEWMODEL_SCRAP_GUN_ANIM_S,
  },

  // ─── Food items (new in Session F) ────────────────────────────────────────

  cactus_pulp: {
    id: 'cactus_pulp',
    name: 'CACTUS PULP',
    glyph: '∴',
    description: 'fibrous, bitter pulp',
    stackable: true,
    maxStack: 6,
    onUse(ctx, _slot) {
      ctx.stats.hunger = Math.min(1, ctx.stats.hunger + 0.18);
      return { consumed: true, message: 'you chew the bitter pulp' };
    },
    playCookAnim(itemRoot, t) {
      // Hold the pulp out over the fire and twist gently — you're charring
      // it bare-handed, no skewer. Shift LEFT to cancel the rightward
      // viewmodel offset so the pulp lands over the crosshair / fire.
      const reach = t < 0.5 ? easeInOutCubic(t * 2) : 1 - easeInOutCubic((t - 0.5) * 2);
      itemRoot.position.set(-0.30 * reach, 0.0 * reach, -0.28 * reach);
      const twist = Math.sin(t * Math.PI * 6) * 0.35;
      itemRoot.rotation.set(-0.4 * reach, twist, 0);
    },
    makeViewModel() {
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: 0x4a6a3a });
      const wedge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.06), mat);
      wedge.rotation.set(0.2, 0.3, 0.1);
      group.add(wedge);
      // Tiny fiber strands
      const fiber = new THREE.MeshLambertMaterial({ color: 0x6a8a4a });
      for (let i = 0; i < 3; i++) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.012, 0.002), fiber);
        f.position.set((i - 1) * 0.012, 0.028, 0);
        group.add(f);
      }
      return group;
    },
    makeIcon() {
      const s = svg();
      // Stylized cactus tuft — three blade shapes radiating from a base
      s.appendChild(svgEl('path', { d: 'M12 20 L9 8 L11 6 L12 12 L13 6 L15 8 Z' }));
      s.appendChild(svgEl('line', { x1: '7', y1: '12', x2: '10', y2: '14' }));
      s.appendChild(svgEl('line', { x1: '17', y1: '12', x2: '14', y2: '14' }));
      return s;
    },
  },

  cooked_cactus_pulp: {
    id: 'cooked_cactus_pulp',
    name: 'ROASTED PULP',
    glyph: '∵',
    description: 'pulp seared dark over a fire',
    stackable: true,
    maxStack: 6,
    onUse(ctx, _slot) {
      ctx.stats.hunger = Math.min(1, ctx.stats.hunger + 0.28);
      return { consumed: true, message: 'the smoke clings to your throat' };
    },
    makeViewModel() {
      // ABO C3 — upgraded from single-box to composite: charred outer crust
      // (metalMaterial dark) + lighter steamed pulp pocket showing through
      // a split + a small green fiber for residual cactus identity.
      const group = new THREE.Group();
      const charMat = createMetalMaterial(0x1e2418, { wornScale: 9.0, scratchStrength: 0.04 });
      const innerMat = new THREE.MeshLambertMaterial({ color: 0x5a6a3a });
      const outer = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.05, 0.062), charMat);
      outer.rotation.set(0.2, 0.3, 0.1);
      group.add(outer);
      // Inner pulp pocket peeking through a split on top
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.018, 0.04), innerMat);
      inner.position.set(0.008, 0.028, 0.002);
      inner.rotation.set(0.2, 0.3, 0.1);
      group.add(inner);
      // Residual fiber strand sticking out
      const fiber = new THREE.MeshLambertMaterial({ color: 0x4a6a3a });
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.022, 0.002), fiber);
      f.position.set(0.018, 0.038, 0);
      f.rotation.z = -0.3;
      group.add(f);
      return group;
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('path', { d: 'M12 20 L9 8 L11 6 L12 12 L13 6 L15 8 Z' }));
      s.appendChild(svgEl('line', { x1: '7', y1: '12', x2: '10', y2: '14' }));
      s.appendChild(svgEl('line', { x1: '17', y1: '12', x2: '14', y2: '14' }));
      // Heat lines above
      s.appendChild(svgEl('path', { d: 'M9 4 Q10 2 11 4', 'stroke-width': '1' }));
      s.appendChild(svgEl('path', { d: 'M13 4 Q14 2 15 4', 'stroke-width': '1' }));
      return s;
    },
  },

  raw_lizard_meat: {
    id: 'raw_lizard_meat',
    name: 'DEAD LIZARD',
    glyph: 'ʟ',
    description: 'a fresh kill — limp body, still warm',
    stackable: true,
    maxStack: 4,
    onUse(ctx, _slot) {
      // Eating a whole raw lizard is still raw meat — same penalty as before.
      ctx.stats.hunger = Math.min(1, ctx.stats.hunger + 0.12);
      ctx.stats.health = Math.max(0, ctx.stats.health - 0.05);
      return { consumed: true, message: 'raw meat — you gag a little' };
    },
    makeViewModel() {
      // II — show the actual lizard mesh (held dangling) instead of a meat
      // slab. Rotated belly-up + slightly tilted to read as "dead" in-hand.
      const group = new THREE.Group();
      const lizard = makeLizardVisual();
      lizard.scale.setScalar(0.9);
      lizard.rotation.set(Math.PI * 0.05, 0.4, Math.PI);  // upside-down dangle, slight yaw
      group.add(lizard);
      return group;
    },
    makeIcon() {
      const s = svg();
      // Stylised dead lizard silhouette — elongated body + 4 legs splayed +
      // tail, oriented horizontally as if held by the tail.
      s.appendChild(svgEl('ellipse', { cx: '12', cy: '13', rx: '6', ry: '2.4' }));
      s.appendChild(svgEl('circle', { cx: '18', cy: '13', r: '1.6' }));      // head
      s.appendChild(svgEl('path', { d: 'M6 13 L3 15' }));                    // tail
      s.appendChild(svgEl('line', { x1: '9',  y1: '15', x2: '8',  y2: '18' }));
      s.appendChild(svgEl('line', { x1: '15', y1: '15', x2: '14', y2: '18' }));
      s.appendChild(svgEl('line', { x1: '9',  y1: '11', x2: '8',  y2: '8'  }));
      s.appendChild(svgEl('line', { x1: '15', y1: '11', x2: '14', y2: '8'  }));
      // X for eye = dead
      s.appendChild(svgEl('line', { x1: '17.2', y1: '12.2', x2: '18.2', y2: '13.2', 'stroke-width': '1' }));
      s.appendChild(svgEl('line', { x1: '18.2', y1: '12.2', x2: '17.2', y2: '13.2', 'stroke-width': '1' }));
      return s;
    },
  },

  cooked_lizard_meat: {
    id: 'cooked_lizard_meat',
    name: 'COOKED MEAT',
    glyph: '≈',
    description: 'meat charred over a fire',
    stackable: true,
    maxStack: 4,
    onUse(ctx, _slot) {
      ctx.stats.hunger = Math.min(1, ctx.stats.hunger + 0.35);
      return { consumed: true, message: 'it tastes of smoke and salt' };
    },
    makeViewModel() {
      // ABO C3 — upgraded from single-slab to sliced-meat composite:
      // 3 layered cuts (alternating dark-char + lighter cooked-interior) +
      // small bone shard exposed at one edge via boneMaterial.
      const group = new THREE.Group();
      const charMat = createMetalMaterial(0x2a1408, { wornScale: 10.0, scratchStrength: 0.05 });
      const interiorMat = new THREE.MeshLambertMaterial({ color: 0x7a3a22 });
      const boneMat = createBoneMaterial(0xcab8a0, { crackDensity: 0.5 });
      // 3 slices stacked
      for (let i = 0; i < 3; i++) {
        const useChar = i % 2 === 0;
        const slice = new THREE.Mesh(
          new THREE.BoxGeometry(0.09 - i * 0.005, 0.011, 0.06 - i * 0.004),
          useChar ? charMat : interiorMat,
        );
        slice.position.set(0, -0.004 + i * 0.011, 0);
        slice.rotation.set(0.1, 0.4, 0.05);
        group.add(slice);
      }
      // Small bone shard at one edge
      const bone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.007, 0.048, 5),
        boneMat,
      );
      bone.position.set(-0.04, 0.005, 0.01);
      bone.rotation.set(0, 0.4, Math.PI / 2);
      group.add(bone);
      return group;
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('polygon', { points: '5,11 8,7 16,8 19,11 17,15 13,17 7,16' }));
      s.appendChild(svgEl('line', { x1: '9', y1: '11', x2: '15', y2: '13', 'stroke-width': '1' }));
      s.appendChild(svgEl('path', { d: 'M9 4 Q10 2 11 4', 'stroke-width': '1' }));
      s.appendChild(svgEl('path', { d: 'M13 4 Q14 2 15 4', 'stroke-width': '1' }));
      return s;
    },
  },

  // ─── Session DD — sand worm meat (raw + cooked) ───────────────────────

  raw_worm_meat: {
    id: 'raw_worm_meat',
    name: 'RAW WORM-FLESH',
    glyph: '≀',
    description: 'a heavy slab of pale worm-flesh — fibrous, oozing',
    stackable: true,
    maxStack: 4,
    onUse(ctx, _slot) {
      ctx.stats.hunger = Math.min(1, ctx.stats.hunger + 0.18);
      ctx.stats.health = Math.max(0, ctx.stats.health - 0.08);
      return { consumed: true, message: 'raw worm — your stomach turns' };
    },
    playCookAnim(itemRoot, t) {
      // Heavier slab — slower twist, deeper reach over the flames.
      // Shift LEFT (same reason as the skewer + pulp) so the meat ends
      // up over the crosshair / fire instead of right of it.
      const reach = t < 0.5 ? easeInOutCubic(t * 2) : 1 - easeInOutCubic((t - 0.5) * 2);
      itemRoot.position.set(-0.30 * reach, 0.0 * reach, -0.32 * reach);
      const twist = Math.sin(t * Math.PI * 5) * 0.4;
      itemRoot.rotation.set(-0.5 * reach, twist, 0);
    },
    makeViewModel() {
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: 0xb8a088 });
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.07), mat);
      slab.rotation.set(0.1, 0.4, 0.05);
      group.add(slab);
      return group;
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('polygon', { points: '4,12 7,7 17,7 20,12 18,17 14,18 6,17' }));
      s.appendChild(svgEl('line', { x1: '8', y1: '11', x2: '16', y2: '14', 'stroke-width': '1' }));
      s.appendChild(svgEl('line', { x1: '9', y1: '14', x2: '15', y2: '11', 'stroke-width': '1' }));
      return s;
    },
  },

  cooked_worm_meat: {
    id: 'cooked_worm_meat',
    name: 'COOKED WORM-FLESH',
    glyph: '∝',
    description: 'dense flesh seared dark over a fire — finally edible',
    stackable: true,
    maxStack: 4,
    onUse(ctx, _slot) {
      ctx.stats.hunger = Math.min(1, ctx.stats.hunger + 0.45);
      return { consumed: true, message: 'rich, oily — it fills you' };
    },
    makeViewModel() {
      // ABO C3 — upgraded from single-slab. Dense worm-flesh has no bone
      // (worms are invertebrate) so composite is: thick char-crusted outer
      // slab + lighter rendered-fat interior peeking through a crack +
      // a few darker char-blister bumps on top.
      const group = new THREE.Group();
      const crustMat = createMetalMaterial(0x2e1810, { wornScale: 8.0, scratchStrength: 0.04 });
      const fatMat = new THREE.MeshLambertMaterial({ color: 0xa07050 });
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.07), crustMat);
      slab.rotation.set(0.1, 0.4, 0.05);
      group.add(slab);
      // Rendered fat exposed through a crack along the top
      const fat = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.008, 0.014), fatMat);
      fat.position.set(0.005, 0.022, 0);
      fat.rotation.set(0.1, 0.4, 0.05);
      group.add(fat);
      // Char-blister bumps (3 small dark domes)
      for (let i = 0; i < 3; i++) {
        const bump = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), crustMat);
        bump.position.set(-0.025 + i * 0.025, 0.024, -0.018 + (i % 2) * 0.012);
        bump.rotation.set(0.1, 0.4, 0.05);
        group.add(bump);
      }
      return group;
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('polygon', { points: '4,12 7,7 17,7 20,12 18,17 14,18 6,17' }));
      s.appendChild(svgEl('line', { x1: '8', y1: '11', x2: '16', y2: '14', 'stroke-width': '1' }));
      s.appendChild(svgEl('path', { d: 'M9 4 Q10 2 11 4', 'stroke-width': '1' }));
      s.appendChild(svgEl('path', { d: 'M13 4 Q14 2 15 4', 'stroke-width': '1' }));
      return s;
    },
  },

  // ─── Session G — crafting materials + deployable kits ────────────────────

  branch: {
    id: 'branch',
    name: 'BRANCH',
    glyph: '/',
    description: 'a dry length of wood — good for fuel',
    stackable: true,
    maxStack: 6,
    onUse(_ctx, _slot) {
      return { consumed: false, message: 'aim at a fire to add fuel' };
    },
    makeViewModel() {
      // ABJ — B13: applied wood-grain shader (grain + rings + weathering).
      // Reads as actual woody fiber not painted plastic. Added one more
      // small offshoot for asymmetric "natural twig" silhouette.
      const group = new THREE.Group();
      const mat = createWoodGrainMaterial(0x6e685f, {
        grainAxis: Math.PI / 2.4,     // grain aligns with the stick's tilt
        ringDensity: 12.0,            // tight rings → small-diameter branch
        weatherLevel: 0.55,           // dead-tree branches are weathered grey
      });
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.34, 6), mat);
      stick.rotation.set(0, 0, Math.PI / 2.4);
      group.add(stick);
      const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.09, 4), mat);
      twig.position.set(0.08, 0.03, 0);
      twig.rotation.set(0, 0, -0.6);
      group.add(twig);
      // Second smaller offshoot on the opposite side
      const twig2 = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.06, 4), mat);
      twig2.position.set(-0.04, 0.02, 0.01);
      twig2.rotation.set(0, 0, 0.75);
      group.add(twig2);
      return group;
    },
    makeIcon() {
      const s = svg();
      // Horizontal stick + two short twigs
      s.appendChild(svgEl('line', { x1: '4', y1: '14', x2: '20', y2: '10' }));
      s.appendChild(svgEl('line', { x1: '10', y1: '12.5', x2: '8', y2: '8' }));
      s.appendChild(svgEl('line', { x1: '15', y1: '11.5', x2: '17', y2: '16' }));
      return s;
    },
  },

  cloth: {
    id: 'cloth',
    name: 'CLOTH',
    glyph: '∏',
    description: 'a folded piece of fabric',
    stackable: true,
    maxStack: 6,
    onUse(_ctx, _slot) {
      return { consumed: false, message: 'press C to craft' };
    },
    makeViewModel() {
      // ABJ — B13: upgraded from 2-box flat Lambert to 3-fold composite
      // with fabric shader (weave + color variation). Reads as actual
      // folded cloth bundle rather than a stack of paint chips.
      const group = new THREE.Group();
      // ABN — disableShimmer for viewmodels (same reason as bandage:
      // world-sampled shimmer animates against player movement).
      const mat = createFabricMaterial(0xc8b89a, undefined, { disableShimmer: true });
      const matInner = createFabricMaterial(0xb8a888, undefined, { disableShimmer: true });
      const matInnermost = createFabricMaterial(0xa8987c, undefined, { disableShimmer: true });
      const fold = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.085), mat);
      group.add(fold);
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.018, 0.072), matInner);
      inner.position.y = 0.020;
      group.add(inner);
      const innermost = new THREE.Mesh(new THREE.BoxGeometry(0.080, 0.014, 0.060), matInnermost);
      innermost.position.y = 0.036;
      group.add(innermost);
      // Small fabric "tag" sticking out one side — adds asymmetry.
      const tag = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.008, 0.022), matInner);
      tag.position.set(0.060, 0.020, 0);
      tag.rotation.z = -0.20;
      group.add(tag);
      return group;
    },
    makeIcon() {
      const s = svg();
      // Folded square with stitching
      s.appendChild(svgEl('rect', { x: '5', y: '7', width: '14', height: '10', rx: '1' }));
      s.appendChild(svgEl('line', { x1: '5', y1: '12', x2: '19', y2: '12', 'stroke-width': '1', 'stroke-dasharray': '2 1.5' }));
      return s;
    },
  },

  fire_kit: {
    id: 'fire_kit',
    name: 'FIRE KIT',
    glyph: '△',
    description: 'kindling, flint, and a striker',
    stackable: true,
    maxStack: 2,
    wieldLmb: 'place',
    thirdPersonScale: 1.35,   // ACE Tier 4B — small bundle reads dim at 3P
    onUse(ctx, _slot) {
      const fire = deployFire(ctx);
      if (!fire) {
        return { consumed: false, message: 'too close to another fire' };
      }
      return { consumed: true, message: 'fire lit' };
    },
    makeViewModel() {
      // ABO C3 — upgraded from plain Lambert sticks. Wood-grain shader on
      // sticks + a flint chip near the base + a small striker (metal shard)
      // wedged in the bundle. Reads as "kindling, flint, and a striker"
      // per the item description.
      const group = new THREE.Group();
      const woodMat = createWoodGrainMaterial(0x6a4a2a, {
        grainAxis: 0,
        ringDensity: 14.0,
        weatherLevel: 0.45,
      });
      // Bundle of 3 sticks in a tee-pee
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.16, 6), woodMat);
        stick.position.set(Math.cos(a) * 0.025, 0, Math.sin(a) * 0.025);
        stick.rotation.x = 0.4 * Math.sin(a);
        stick.rotation.z = 0.4 * Math.cos(a);
        group.add(stick);
      }
      // Flint chip — small dark angular fragment at the base
      const flintMat = new THREE.MeshLambertMaterial({ color: 0x4a4a4e, flatShading: true });
      const flint = new THREE.Mesh(new THREE.OctahedronGeometry(0.014, 0), flintMat);
      flint.position.set(0.018, -0.06, -0.01);
      flint.rotation.set(0.3, 0.5, 0.2);
      group.add(flint);
      // Striker — small metal shard wedged on the other side
      const strikerMat = createMetalMaterial(0x9aa0a8, { wornScale: 12.0 });
      const striker = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.008, 0.004), strikerMat);
      striker.position.set(-0.022, -0.058, 0.008);
      striker.rotation.set(0.1, -0.4, 0.6);
      group.add(striker);
      return group;
    },
    makeIcon() {
      const s = svg();
      // Triangle of kindling
      s.appendChild(svgEl('line', { x1: '12', y1: '4', x2: '5', y2: '20' }));
      s.appendChild(svgEl('line', { x1: '12', y1: '4', x2: '19', y2: '20' }));
      s.appendChild(svgEl('line', { x1: '8', y1: '14', x2: '16', y2: '14' }));
      // A small spark
      s.appendChild(svgEl('circle', { cx: '12', cy: '11', r: '0.8', fill: 'currentColor', stroke: 'none' }));
      return s;
    },
  },

  // Session AAM — grill attachment for a fire (multi-cook).
  grill_kit: {
    id: 'grill_kit',
    name: 'GRILL KIT',
    glyph: '⛻',
    description: 'iron crossbars for a fire — cook multiple meats in parallel',
    stackable: true,
    maxStack: 2,
    thirdPersonScale: 1.30,   // ACE Tier 4B — thin grate; bump for 3P silhouette
    wieldLmb: 'click_use',
    onUse(ctx, _slot) {
      // AAZ-fix — grill attaches to any LIVE fire the player is facing.
      // Pre-AAZ-fix the check was `hover.type !== 'add_fuel'` which only
      // matched when the player had a BRANCH selected (not grill_kit), so
      // attempting to attach always failed. Now any fire-related hover
      // (cook / add_fuel / relight) routes here, gated on the fire being
      // alive (relight is for dead fires → reject). The hover.entityId
      // field is set in interaction.ts case 'fires' on every branch.
      const hover = ctx.inventory.hover;
      const isFireHover = !!hover && (hover.type === 'cook' || hover.type === 'add_fuel');
      if (!isFireHover) {
        return { consumed: false, message: 'face a fire to attach the grill' };
      }
      const fireId = hover.entityId ?? -1;
      const fire = findFireById(ctx.fires.list, fireId);
      if (!fire) return { consumed: false, message: 'no fire found' };
      if (!fire.alive) {
        return { consumed: false, message: 'fire is cold — relight it first' };
      }
      if (fire.hasGrill) {
        return { consumed: false, message: 'this fire already has a grill' };
      }
      attachGrillToFire(ctx, fire);
      return { consumed: true, message: 'grill attached' };
    },
    makeViewModel() {
      // ABO C3 — upgraded from plain Lambert. Metal shader on bars + rails
      // (brushed iron with scratches + worn highlights) + a cooked-residue
      // rust patch on one bar + small chain detail dangling from a side.
      const group = new THREE.Group();
      const ironMat = createMetalMaterial(0x3a342a, { wornScale: 10.0, scratchStrength: 0.08 });
      const rustyMat = createMetalMaterial(0x5a2a18, { wornScale: 10.0, scratchStrength: 0.12 });
      // 4 short bars stacked + a frame loop suggesting the grate
      for (let i = 0; i < 4; i++) {
        const bar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6),
          i === 1 ? rustyMat : ironMat,
        );
        bar.rotation.z = Math.PI / 2;
        bar.position.set(0, -0.015 + i * 0.012, 0);
        group.add(bar);
      }
      // Side rails (perpendicular)
      for (const sz of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 6), ironMat);
        rail.position.set(0, 0.003, sz * 0.075);
        group.add(rail);
      }
      // Small dangling chain link from one side — reads as "attach to fire"
      for (let i = 0; i < 3; i++) {
        const link = new THREE.Mesh(
          new THREE.TorusGeometry(0.006, 0.0018, 4, 8),
          ironMat,
        );
        link.position.set(0.08, -0.026 - i * 0.008, 0.075);
        link.rotation.x = (i % 2) * Math.PI / 2;
        group.add(link);
      }
      return group;
    },
    makeIcon() {
      const s = svg();
      // Grate icon: 4 horizontal bars + 2 side rails
      for (let i = 0; i < 4; i++) {
        const y = 9 + i * 2;
        s.appendChild(svgEl('line', { x1: '6', y1: String(y), x2: '18', y2: String(y) }));
      }
      s.appendChild(svgEl('line', { x1: '6', y1: '8', x2: '6', y2: '17' }));
      s.appendChild(svgEl('line', { x1: '18', y1: '8', x2: '18', y2: '17' }));
      return s;
    },
  },

  alien_fruit: {
    id: 'alien_fruit',
    name: 'ALIEN FRUIT',
    glyph: '◉',
    description: 'a bulbous teal fruit from the strange cactus',
    stackable: true,
    maxStack: 4,
    onUse(ctx, _slot) {
      ctx.stats.hunger = Math.min(1, ctx.stats.hunger + 0.25);
      ctx.stats.thirst = Math.min(1, ctx.stats.thirst + 0.10);
      return { consumed: true, message: 'tastes like nothing on this rock' };
    },
    makeViewModel() {
      const group = new THREE.Group();
      const bodyMat = new THREE.MeshLambertMaterial({
        color: 0x2a8a8a,
        emissive: 0x0a2828,
        emissiveIntensity: 0.6,
        flatShading: true,
      });
      const spotMat = new THREE.MeshLambertMaterial({
        color: 0x103838,
        flatShading: true,
      });
      const fruit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), bodyMat);
      fruit.scale.set(1, 1.1, 0.95);
      group.add(fruit);
      // A few darker spots — small icosahedra parented at offsets
      const spotPositions: Array<[number, number, number]> = [
        [0.04, 0.02, 0.045], [-0.035, 0.04, 0.04], [0.01, -0.04, 0.05],
      ];
      for (const [x, y, z] of spotPositions) {
        const spot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.012, 0), spotMat);
        spot.position.set(x, y, z);
        group.add(spot);
      }
      return group;
    },
    makeIcon() {
      const s = svg();
      // Teardrop outline + 3 small dots
      s.appendChild(svgEl('path', {
        d: 'M12 4 C16 9, 17 13, 12 19 C7 13, 8 9, 12 4 Z',
      }));
      s.appendChild(svgEl('circle', { cx: '10.5', cy: '11', r: '0.7', fill: 'currentColor', stroke: 'none' }));
      s.appendChild(svgEl('circle', { cx: '13', cy: '13.5', r: '0.7', fill: 'currentColor', stroke: 'none' }));
      s.appendChild(svgEl('circle', { cx: '12', cy: '8', r: '0.6', fill: 'currentColor', stroke: 'none' }));
      return s;
    },
  },

  // ─── Session AA — light sources for night gameplay ───────────────────

  torch: {
    id: 'torch',
    name: 'TORCH',
    glyph: '!',
    description: 'wrapped cloth on a branch — burns for a few minutes',
    stackable: false,
    maxStack: 1,
    thirdPersonScale: 1.30,   // ACE Tier 4B — thin stick reads dim at 3P (emissive flame helps but body needs boost)
    wieldLmb: 'none',
    onUse(_ctx, slot) {
      if (!slot.meta) slot.meta = { lit: false, burnRemaining: 1 };
      // Refuse to light a torch with no fuel left (defensive — burn-out path
      // should clear the slot, but guards a weird state).
      if (!slot.meta.lit && (slot.meta.burnRemaining ?? 0) < 0.001) {
        return { consumed: false, message: 'the torch is spent' };
      }
      slot.meta.lit = !slot.meta.lit;
      return { consumed: false, message: slot.meta.lit ? 'torch lit' : 'torch out' };
    },
    makeViewModel() {
      const group = new THREE.Group();
      // Branch shaft
      const shaftMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.024, 0.34, 6),
        shaftMat,
      );
      shaft.position.y = -0.04;
      group.add(shaft);
      // Cloth-wrap head
      const wrapMat = new THREE.MeshLambertMaterial({ color: 0x8a6038 });
      const wrap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.035, 0.10, 8),
        wrapMat,
      );
      wrap.position.y = 0.14;
      group.add(wrap);
      // Flame — a small emissive cone at the top. updateHeld toggles its
      // material.emissiveIntensity along with the light.
      const flameMat = new THREE.MeshBasicMaterial({
        color: Tuning.TORCH_LIGHT_COLOR_HEX,
        transparent: true,
        opacity: 0.0,
        toneMapped: false,
        fog: false,
      });
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.14, 6),
        flameMat,
      );
      flame.name = 'torchFlame';
      flame.position.y = 0.26;
      group.add(flame);
      // PointLight at the flame. Starts at 0 intensity.
      const light = new THREE.PointLight(
        Tuning.TORCH_LIGHT_COLOR_HEX,
        0,
        Tuning.TORCH_LIGHT_DISTANCE,
        2,
      );
      light.name = 'torchLight';
      light.position.y = 0.26;
      group.add(light);
      return group;
    },
    makeIcon() {
      const s = svg();
      // Stick + flame outline
      s.appendChild(svgEl('line', { x1: '12', y1: '20', x2: '12', y2: '10' }));
      s.appendChild(svgEl('rect', { x: '10', y: '8', width: '4', height: '4' }));
      s.appendChild(svgEl('path', { d: 'M12 7 Q9 5 11 2 Q12 4 13 2 Q14 5 12 7 Z' }));
      return s;
    },
    updateHeld(itemRoot, slot, ctx, dt) {
      const light = itemRoot.getObjectByName('torchLight') as THREE.PointLight | null;
      const flame = itemRoot.getObjectByName('torchFlame') as THREE.Mesh | null;
      if (!slot.meta) slot.meta = { lit: false, burnRemaining: 1 };
      const lit = !!slot.meta.lit;
      if (!light || !flame) return;
      if (!lit) {
        light.intensity = 0;
        (flame.material as THREE.MeshBasicMaterial).opacity = 0;
        return;
      }
      // Drain burnRemaining; auto-consume on burn-out.
      const remaining = (slot.meta.burnRemaining ?? 1) - dt / Tuning.TORCH_BURN_DURATION_S;
      if (remaining <= 0) {
        slot.meta.lit = false;
        slot.meta.burnRemaining = 0;
        slot.item = null;
        slot.count = 0;
        slot.meta = undefined;
        light.intensity = 0;
        (flame.material as THREE.MeshBasicMaterial).opacity = 0;
        ctx.ui.showToast('the torch burns out');
        return;
      }
      slot.meta.burnRemaining = remaining;
      // Flicker — two desynced sines for organic feel.
      const t = ctx.time.elapsed;
      const wobble = Math.sin(t * 17.3) * 0.5 + Math.sin(t * 23.7) * 0.5;
      light.intensity = Tuning.TORCH_LIGHT_INTENSITY + wobble * Tuning.TORCH_LIGHT_FLICKER_AMP;
      (flame.material as THREE.MeshBasicMaterial).opacity = 0.85 + wobble * 0.1;
    },
  },

  flashlight: {
    id: 'flashlight',
    name: 'FLASHLIGHT',
    glyph: 'F',
    description: 'a salvaged hand-light — drains, recharges while off',
    stackable: false,
    maxStack: 1,
    thirdPersonScale: 1.30,   // ACE Tier 4B — small handheld; boost for 3P readability
    wieldLmb: 'none',
    onUse(_ctx, slot) {
      if (!slot.meta) slot.meta = { lit: false, fuelLevel: 1 };
      if (!slot.meta.lit && (slot.meta.fuelLevel ?? 0) < 0.02) {
        return { consumed: false, message: 'the flashlight is dead — let it recharge' };
      }
      slot.meta.lit = !slot.meta.lit;
      return { consumed: false, message: slot.meta.lit ? 'flashlight on' : 'flashlight off' };
    },
    makeViewModel() {
      const group = new THREE.Group();
      // Body — short cylinder
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3a3630 });
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.04, 0.16, 10),
        bodyMat,
      );
      body.rotation.z = Math.PI / 2;
      body.position.set(0, 0, -0.05);
      group.add(body);
      // Lens — bright disc on the forward end
      const lensMat = new THREE.MeshBasicMaterial({
        color: 0xe4f0ff,
        transparent: true,
        opacity: 0.4,
        toneMapped: false,
        fog: false,
      });
      const lens = new THREE.Mesh(
        new THREE.CircleGeometry(0.035, 12),
        lensMat,
      );
      lens.name = 'flashlightLens';
      lens.position.set(0, 0, -0.135);
      // Lens faces forward (-Z), already aligned by default CircleGeometry.
      group.add(lens);
      // Grip detail — small ridges
      for (let i = 0; i < 3; i++) {
        const ridge = new THREE.Mesh(
          new THREE.BoxGeometry(0.005, 0.082, 0.005),
          new THREE.MeshLambertMaterial({ color: 0x1a1612 }),
        );
        ridge.position.set(0.02 - i * 0.018, 0, -0.05);
        group.add(ridge);
      }
      // SpotLight at the lens, pointed along -Z (camera forward).
      const light = new THREE.SpotLight(
        Tuning.FLASHLIGHT_LIGHT_COLOR_HEX,
        0,
        Tuning.FLASHLIGHT_LIGHT_DISTANCE,
        Tuning.FLASHLIGHT_LIGHT_ANGLE_RAD,
        Tuning.FLASHLIGHT_LIGHT_PENUMBRA,
        1.5,
      );
      light.name = 'flashlightLight';
      light.position.set(0, 0, -0.13);
      // SpotLight needs its target in the scene graph. Add both light + target
      // to this group so they inherit the camera's transform.
      light.target.position.set(0, 0, -5);
      group.add(light);
      group.add(light.target);
      return group;
    },
    makeIcon() {
      const s = svg();
      // Cylinder body + cone of light forward
      s.appendChild(svgEl('rect', { x: '8', y: '11', width: '8', height: '6', rx: '0.6' }));
      s.appendChild(svgEl('polygon', { points: '16,11 22,8 22,20 16,17' }));
      s.appendChild(svgEl('circle', { cx: '10', cy: '14', r: '1', fill: 'currentColor', stroke: 'none' }));
      return s;
    },
    updateHeld(itemRoot, slot, ctx, dt) {
      const light = itemRoot.getObjectByName('flashlightLight') as THREE.SpotLight | null;
      const lens = itemRoot.getObjectByName('flashlightLens') as THREE.Mesh | null;
      if (!slot.meta) slot.meta = { lit: false, fuelLevel: 1 };
      const lit = !!slot.meta.lit;
      let fuel = slot.meta.fuelLevel ?? 1;
      if (lit) {
        fuel = Math.max(0, fuel - dt / Tuning.FLASHLIGHT_DRAIN_DURATION_S);
        if (fuel <= 0) {
          slot.meta.lit = false;
          ctx.ui.showToast('your flashlight dies');
        }
      } else {
        // Passive recharge while held + off.
        fuel = Math.min(1, fuel + dt / Tuning.FLASHLIGHT_RECHARGE_DURATION_S);
      }
      slot.meta.fuelLevel = fuel;
      if (light) light.intensity = slot.meta.lit ? Tuning.FLASHLIGHT_LIGHT_INTENSITY : 0;
      if (lens) (lens.material as THREE.MeshBasicMaterial).opacity = slot.meta.lit ? 0.85 : 0.4;
    },
  },

  // ─── Session II — lizard-on-a-stick (wielded cooking) ───────────────────

  lizard_on_a_stick_raw: {
    id: 'lizard_on_a_stick_raw',
    name: 'RAW LIZARD-ON-A-STICK',
    glyph: '✱',
    description: 'a lizard speared on a branch — look at a fire to roast',
    stackable: false,
    maxStack: 1,
    onUse(_ctx, _slot) {
      return { consumed: false, message: 'aim at a fire to roast it' };
    },
    makeViewModel() {
      // II — vertical skewer: hand grips the bottom, the lizard is
      // impaled near the top and held away from the body. Stick tilts
      // slightly forward so the lizard hangs out toward whatever the
      // player is looking at (e.g. the fire they're about to cook on).
      return buildSkewerMesh(/* cooked */ false);
    },
    makeIcon() {
      const s = svg();
      // Vertical skewer + lizard at top + heat lines
      s.appendChild(svgEl('line', { x1: '12', y1: '20', x2: '12', y2: '5' }));
      s.appendChild(svgEl('ellipse', { cx: '12', cy: '6', rx: '5', ry: '2' }));
      s.appendChild(svgEl('circle', { cx: '16', cy: '6', r: '1.2' }));
      s.appendChild(svgEl('path', { d: 'M9 3 Q10 1 11 3', 'stroke-width': '1' }));
      return s;
    },
    playCookAnim(itemRoot, t) {
      // Extend the skewer forward (-Z) over the fire and rotate around
      // its long axis (Y) back-and-forth so the lizard turns over the
      // flames. Ease in/out so it doesn't snap. The skewer also slides
      // LEFT to cancel VIEWMODEL_OFFSET_X (+0.32) — without this shift
      // the tip lands well right of the crosshair. A small upward bias
      // keeps the lizard hovering ABOVE the flames rather than dipping
      // into them.
      const reach = t < 0.5 ? easeInOutCubic(t * 2) : 1 - easeInOutCubic((t - 0.5) * 2);
      itemRoot.position.set(-0.30 * reach, 0.06 * reach, -0.35 * reach);
      const pitch = -0.7 * reach;
      // Twist envelope: stay still while extending toward + retracting
      // from the fire, only spin the meat during the held-over-flames
      // middle phase (~t∈[0.30, 0.75]). Reads as "place it, turn it,
      // pull it back" rather than spinning the stick all the way in.
      const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
      const smooth = (x: number) => { const c = clamp01(x); return c * c * (3 - 2 * c); };
      const twistAmp = smooth((t - 0.25) / 0.10) * (1 - smooth((t - 0.70) / 0.10));
      const spin = Math.sin(t * Math.PI * 8) * 0.7 * twistAmp;
      itemRoot.rotation.set(pitch, spin, 0);
    },
  },

  lizard_on_a_stick_cooked: {
    id: 'lizard_on_a_stick_cooked',
    name: 'COOKED LIZARD-ON-A-STICK',
    glyph: '※',
    description: 'roasted lizard on a charred branch — eat to recover the stick',
    stackable: false,
    maxStack: 1,
    onUse(ctx, _slot) {
      ctx.stats.hunger = Math.min(1, ctx.stats.hunger + 0.35);
      // Recover the branch so the skewer is reusable.
      addItem(ctx.inventory, 'branch', undefined, ctx);
      return { consumed: true, message: 'you eat — the stick goes back in your pack' };
    },
    makeViewModel() {
      return buildSkewerMesh(/* cooked */ true);
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('line', { x1: '12', y1: '20', x2: '12', y2: '5' }));
      s.appendChild(svgEl('ellipse', { cx: '12', cy: '6', rx: '5', ry: '2' }));
      s.appendChild(svgEl('circle', { cx: '16', cy: '6', r: '1.2' }));
      // Two heat lines (cooked = more smoke)
      s.appendChild(svgEl('path', { d: 'M9 3 Q10 1 11 3', 'stroke-width': '1' }));
      s.appendChild(svgEl('path', { d: 'M13 3 Q14 1 15 3', 'stroke-width': '1' }));
      return s;
    },
  },

  tent_kit: {
    id: 'tent_kit',
    name: 'TENT KIT',
    glyph: '⌂',
    description: 'a roll of canvas and poles',
    stackable: false,
    maxStack: 1,
    thirdPersonScale: 1.25,   // ACE Tier 4B — rolled bundle; modest boost (already has some volume)
    wieldLmb: 'place',
    onUse(ctx, _slot) {
      const tent = deployTent(ctx);
      if (!tent) {
        return { consumed: false, message: 'no room to pitch a tent here' };
      }
      return { consumed: true, message: 'tent pitched' };
    },
    makeViewModel() {
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: 0xa89878 });
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 12), mat);
      roll.rotation.z = Math.PI / 2;
      group.add(roll);
      // Two short poles strapped to one side
      const poleMat = new THREE.MeshLambertMaterial({ color: 0x4a3a2a });
      for (let i = 0; i < 2; i++) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.24, 4), poleMat);
        pole.rotation.z = Math.PI / 2;
        pole.position.set(0, -0.05, (i - 0.5) * 0.04);
        group.add(pole);
      }
      return group;
    },
    makeIcon() {
      const s = svg();
      // Tent silhouette: large triangle with center pole
      s.appendChild(svgEl('polygon', { points: '12,4 4,20 20,20' }));
      s.appendChild(svgEl('line', { x1: '12', y1: '4', x2: '12', y2: '20', 'stroke-width': '1' }));
      return s;
    },
  },

  // ── Session QQ — sled + rope ────────────────────────────────
  // sled_kit: one-shot deployer (mirrors tent_kit / fire_kit).
  // rope: wielded item. LMB while aimed at a sled's rope stub attaches
  // (or detaches). The actual attach/detach is handled in
  // interaction.ts — onUse here is just an explanatory hint.
  sled_kit: {
    id: 'sled_kit',
    name: 'SLED KIT',
    glyph: '⛷',
    description: 'a folded flatbed sled with skids',
    stackable: false,
    maxStack: 1,
    wieldLmb: 'place',
    onUse(ctx, _slot) {
      const sled = deploySled(ctx);
      if (!sled) {
        return { consumed: false, message: 'no room to deploy a sled here' };
      }
      return { consumed: true, message: 'sled deployed' };
    },
    makeViewModel() {
      const group = new THREE.Group();
      // Folded planks bundled together — a small flat stack.
      const plankMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2c });
      for (let i = 0; i < 3; i++) {
        const plank = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.018, 0.08),
          plankMat,
        );
        plank.position.y = -0.02 + i * 0.022;
        group.add(plank);
      }
      // Twin runners strapped underneath.
      const runnerMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
      for (const sz of [-1, 1]) {
        const runner = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.012, 0.018),
          runnerMat,
        );
        runner.position.set(0, -0.05, sz * 0.024);
        group.add(runner);
      }
      return group;
    },
    makeIcon() {
      const s = svg();
      // Flatbed sled silhouette: rectangle + two short runners
      s.appendChild(svgEl('rect', { x: '4', y: '10', width: '16', height: '4' }));
      s.appendChild(svgEl('line', { x1: '5', y1: '17', x2: '19', y2: '17' }));
      s.appendChild(svgEl('line', { x1: '6', y1: '14', x2: '6', y2: '17' }));
      s.appendChild(svgEl('line', { x1: '18', y1: '14', x2: '18', y2: '17' }));
      return s;
    },
  },

  // Session XX — larger enterable tent. Walk-in shelter; LMB-click to
  // deploy at the camera-forward 2.2m+depth/2 distance. RMB to pack
  // (handled by wieldAction.ts/handleContextAction).
  large_tent_kit: {
    id: 'large_tent_kit',
    name: 'SHELTER TENT',
    glyph: '⌂',
    description: 'a frame + canvas — large enough to walk inside',
    stackable: false,
    maxStack: 1,
    thirdPersonScale: 1.20,   // ACE Tier 4B — bigger bundle, smaller boost needed
    wieldLmb: 'place',
    onUse(ctx, _slot) {
      const tent = deployLargeTent(ctx);
      if (!tent) {
        return { consumed: false, message: 'no room to pitch a shelter here' };
      }
      return { consumed: true, message: 'shelter pitched' };
    },
    makeViewModel() {
      // ACL ITEMS — upgraded from plain Lambert roll+poles to procedural
      // fabric canvas + wood-grain poles + lashing cords + a metal stake.
      // Reads as a real bundled-up shelter kit.
      const group = new THREE.Group();
      const canvasMat = createFabricMaterial(0xa89878, undefined, { disableShimmer: true });
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.30, 16), canvasMat);
      roll.rotation.z = Math.PI / 2;
      group.add(roll);
      // Visible rolled-edge flap — a thin slab of canvas peeling off the roll.
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.012, 0.14), canvasMat);
      flap.position.set(0, 0.07, 0.04);
      flap.rotation.set(0.18, 0, 0);
      group.add(flap);
      // 4 wood-grain poles bundled beneath the canvas.
      const poleMat = createWoodGrainMaterial(0x4a3a2a, {
        grainAxis: 0,            // grain along the pole length (lies along X)
        ringDensity: 11.0,
        weatherLevel: 0.5,
      });
      for (let i = 0; i < 4; i++) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.34, 6), poleMat);
        pole.rotation.z = Math.PI / 2;
        pole.position.set(0, -0.07, (i - 1.5) * 0.026);
        group.add(pole);
      }
      // 2 lashing cords binding the bundle.
      const cordMat = createFabricMaterial(0x5a4030, undefined, { disableShimmer: true });
      for (let i = 0; i < 2; i++) {
        const cord = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.006, 6, 14), cordMat);
        cord.position.set((i - 0.5) * 0.16, -0.01, 0);
        cord.rotation.y = Math.PI / 2;
        group.add(cord);
      }
      // A spare metal stake tucked along the bundle.
      const stakeMat = createMetalMaterial(0x6e5a4a, { wornScale: 7.0 });
      const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.002, 0.24, 6), stakeMat);
      stake.rotation.z = Math.PI / 2;
      stake.position.set(0, 0.05, -0.09);
      group.add(stake);
      return group;
    },
    makeIcon() {
      const s = svg();
      // House-shape outline (larger than tent_kit's pyramid)
      s.appendChild(svgEl('rect', { x: '5', y: '10', width: '14', height: '11' }));
      s.appendChild(svgEl('polygon', { points: '5,10 12,4 19,10' }));
      s.appendChild(svgEl('rect', { x: '10', y: '14', width: '4', height: '7' }));
      return s;
    },
  },

  // Session AAC — craftable home placeables (bedroll/lantern/locker).
  // Each mirrors tent_kit/sled_kit/fire_kit: wieldLmb='place', LMB-click
  // to deploy, RMB to pack up (handled by wieldAction.ts/handleContextAction).
  bedroll_kit: {
    id: 'bedroll_kit',
    name: 'BEDROLL',
    glyph: '═',
    description: 'a rolled cloth pad — lay it down to sleep',
    stackable: false,
    maxStack: 1,
    wieldLmb: 'place',
    thirdPersonScale: 1.35,   // ACE Tier 4B — slim roll reads small at 3P
    onUse(ctx, _slot) {
      const b = deployBedroll(ctx);
      if (!b) return { consumed: false, message: 'no room to lay it down here' };
      return { consumed: true, message: 'bedroll laid out' };
    },
    makeViewModel() {
      // ACL ITEMS — upgraded from plain Lambert roll to procedural fabric
      // (weave + folds) with a contrasting inner-liner band peeking from the
      // end + wood-grain toggle pegs on the binding cords.
      const group = new THREE.Group();
      const cloth = createFabricMaterial(0x9a7b5a, undefined, { disableShimmer: true });
      const liner = createFabricMaterial(0x6a5238, undefined, { disableShimmer: true });
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 16), cloth);
      roll.rotation.z = Math.PI / 2;
      group.add(roll);
      // Inner liner — a slightly smaller, darker disc set into each open end.
      for (const sx of [-1, 1]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.012, 16), liner);
        cap.rotation.z = Math.PI / 2;
        cap.position.set(sx * 0.125, 0, 0);
        group.add(cap);
      }
      // Cord wrapping the roll + a small wood toggle peg on each.
      const cordMat = createFabricMaterial(0x5a4030, undefined, { disableShimmer: true });
      const pegMat = createWoodGrainMaterial(0x4a3320, { grainAxis: Math.PI / 2, ringDensity: 14.0 });
      for (let i = 0; i < 2; i++) {
        const x = (i - 0.5) * 0.10;
        const cord = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.005, 6, 14), cordMat);
        cord.position.set(x, 0, 0);
        cord.rotation.y = Math.PI / 2;
        group.add(cord);
        const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 6), pegMat);
        peg.position.set(x, 0.066, 0);
        group.add(peg);
      }
      return group;
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('rect', { x: '4', y: '11', width: '16', height: '4', rx: '0.6' }));
      s.appendChild(svgEl('line', { x1: '6', y1: '11', x2: '6', y2: '15' }));
      s.appendChild(svgEl('line', { x1: '18', y1: '11', x2: '18', y2: '15' }));
      return s;
    },
  },

  lantern_kit: {
    id: 'lantern_kit',
    name: 'LANTERN',
    glyph: '✦',
    description: 'a glass-globe lantern on a wooden post — never burns out',
    stackable: false,
    maxStack: 1,
    wieldLmb: 'place',
    thirdPersonScale: 1.30,   // ACE Tier 4B — thin post + small globe needs boost
    onUse(ctx, _slot) {
      const l = deployLantern(ctx);
      if (!l) return { consumed: false, message: 'no room for the lantern here' };
      return { consumed: true, message: 'lantern set' };
    },
    makeViewModel() {
      // ACL ITEMS — upgraded from plain post + MeshBasic globe to a
      // wood-grain post, metal cap/base/uprights, a procedural frosted-glass
      // globe, and a bright emissive flame core glowing inside the glass.
      const group = new THREE.Group();
      const postMat = createWoodGrainMaterial(0x5a4030, {
        grainAxis: Math.PI / 2,    // grain runs up the post
        ringDensity: 13.0,
        weatherLevel: 0.5,
      });
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.22, 8), postMat);
      group.add(post);
      // Metal base foot + top cap.
      const metalMat = createMetalMaterial(0x4a4640, { wornScale: 8.0 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.018, 12), metalMat);
      base.position.y = -0.115;
      group.add(base);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.030, 0.022, 12), metalMat);
      cap.position.y = 0.135;
      group.add(cap);
      // Frosted-glass globe — lets the flame read through.
      const globeMat = createGlassMaterial(0xffd9a0, {
        frostLevel: 0.35,
        edgeHighlight: 0.7,
        dustLayer: 0.2,
        opacity: 0.45,
      });
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 12), globeMat);
      globe.position.y = 0.085;
      group.add(globe);
      // Two metal uprights flanking the globe (the lantern cage).
      for (const sx of [-1, 1]) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.10, 5), metalMat);
        bar.position.set(sx * 0.04, 0.085, 0);
        group.add(bar);
      }
      // Emissive flame core inside the globe — small bright sphere.
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb060, toneMapped: false });
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), flameMat);
      flame.position.y = 0.082;
      group.add(flame);
      group.rotation.z = -0.15;
      return group;
    },
    makeIcon() {
      const s = svg();
      // Lantern silhouette — stem + globe + cap
      s.appendChild(svgEl('line', { x1: '12', y1: '20', x2: '12', y2: '13' }));
      s.appendChild(svgEl('circle', { cx: '12', cy: '10', r: '4' }));
      s.appendChild(svgEl('rect', { x: '10', y: '4', width: '4', height: '2' }));
      s.appendChild(svgEl('line', { x1: '12', y1: '6', x2: '12', y2: '7' }));
      return s;
    },
  },

  locker_kit: {
    id: 'locker_kit',
    name: 'LOCKER',
    glyph: '▣',
    description: 'a wooden chest — stash gear inside',
    stackable: false,
    maxStack: 1,
    wieldLmb: 'place',
    onUse(ctx, _slot) {
      const l = deployLocker(ctx);
      if (!l) return { consumed: false, message: 'no room for the locker here' };
      return { consumed: true, message: 'locker placed' };
    },
    makeViewModel() {
      // ABO C3 — upgraded from plain Lambert box+band. Wood-grain shader
      // on body, metal shader on band + hinges + latch, plus a small
      // round handle on the front face. Reads as a real lidded chest.
      const group = new THREE.Group();
      const woodMat = createWoodGrainMaterial(0x6a4a2c, {
        grainAxis: 0,
        ringDensity: 10.0,
        weatherLevel: 0.45,
      });
      const metalMat = createMetalMaterial(0x3a3a3a, { wornScale: 8.0 });
      // Body
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.12), woodMat);
      group.add(box);
      // Metal band around the middle
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.018, 0.13), metalMat);
      band.position.y = 0;
      group.add(band);
      // 2 hinges on back face
      for (const sx of [-1, 1]) {
        const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.014), metalMat);
        hinge.position.set(sx * 0.06, 0.05, -0.063);
        group.add(hinge);
      }
      // Latch on front face
      const latch = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.020, 0.012), metalMat);
      latch.position.set(0, 0.052, 0.066);
      group.add(latch);
      // Small round handle below latch
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.012, 0.003, 4, 12),
        metalMat,
      );
      handle.position.set(0, 0.022, 0.067);
      handle.rotation.x = Math.PI / 2;
      group.add(handle);
      return group;
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('rect', { x: '4', y: '8', width: '16', height: '12' }));
      s.appendChild(svgEl('line', { x1: '4', y1: '14', x2: '20', y2: '14' }));
      s.appendChild(svgEl('rect', { x: '11', y: '13', width: '2', height: '3' }));
      return s;
    },
  },

  // Session AAE — pocketable creature companion. Pre-deployed at boot
  // near the opening wreck. Player picks up via RMB on the deployed
  // creature, which converts it to a `companion_pod` in inventory.
  // LMB on the wielded pod redeploys.
  companion_pod: {
    id: 'companion_pod',
    name: 'STONE EGG',
    glyph: '◓',
    description: 'a small carved stone egg — Pebble curls inside, asleep',
    stackable: false,
    maxStack: 1,
    wieldLmb: 'place',
    onUse(ctx, _slot) {
      const c = deployCompanion(ctx);
      if (!c) {
        // Already deployed — refuse silently (only one companion at a time).
        return { consumed: false, message: 'Pebble is already out somewhere' };
      }
      return { consumed: true, message: 'the egg cracks — something rolls out' };
    },
    makeViewModel() {
      const group = new THREE.Group();
      // Egg-shape — slightly elongated icosahedron. Dark stone with
      // subtle warm-red veining (the creature curled inside).
      const stoneMat = new THREE.MeshLambertMaterial({
        color: 0x4a3a2c,
        flatShading: true,
      });
      const veinMat = new THREE.MeshLambertMaterial({
        color: 0xb04030,
        emissive: 0x4a1408,
        emissiveIntensity: 0.4,
      });
      const egg = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 0), stoneMat);
      egg.scale.set(1, 1.25, 1);
      group.add(egg);
      // Two thin veins running around the egg
      const v1 = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.006, 4, 18), veinMat);
      v1.rotation.x = Math.PI / 2;
      v1.scale.set(1, 1, 1.2);
      group.add(v1);
      const v2 = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.005, 4, 16), veinMat);
      v2.rotation.x = Math.PI / 2.5;
      v2.rotation.z = 0.4;
      v2.scale.set(1, 1, 1.2);
      group.add(v2);
      return group;
    },
    makeIcon() {
      const s = svg();
      // Egg shape with central crack
      s.appendChild(svgEl('ellipse', { cx: '12', cy: '13', rx: '5', ry: '7' }));
      s.appendChild(svgEl('path', { d: 'M12 7 L11 10 L13 12 L11 14 L13 17 L12 19', 'stroke-width': '1' }));
      s.appendChild(svgEl('circle', { cx: '12', cy: '12.5', r: '0.8', fill: 'currentColor', stroke: 'none' }));
      return s;
    },
  },

  // Session ACE — craftable world-anchor stake. B1 Phase 3 RopeEndpoint.
  // LMB-place drives the stake into the sand 2.2m in front of the player.
  // RMB-on-stake with rope wielded ties the rope to the stake (interaction.ts
  // routes via the stake's interactType='attach_rope' tag).
  // RMB pack-up via wieldAction.ts/handleContextAction once the stake is
  // a hovered registry entry.
  stake_kit: {
    id: 'stake_kit',
    name: 'STAKE',
    glyph: '⊥',
    description: 'an iron stake — drive it into the sand to anchor a rope',
    stackable: false,
    maxStack: 1,
    wieldLmb: 'place',
    thirdPersonScale: 1.35,   // ACE Tier 4B — thin iron rod; needs boost at 3P
    onUse(ctx, _slot) {
      const s = deployStake(ctx);
      if (!s) return { consumed: false, message: 'too close to another stake' };
      return { consumed: true, message: 'stake driven into the sand' };
    },
    makeViewModel() {
      // Held: a short iron stake with a rope-loop at the top + flared
      // driven cap. Same vocab as the in-world mesh, scaled smaller for
      // the FP viewmodel.
      const group = new THREE.Group();
      const ironMat = createMetalMaterial(0x4a4038, {
        wornScale: 14.0,
        scratchStrength: 0.35,
      });
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.011, 0.22, 8),
        ironMat,
      );
      shaft.rotation.z = Math.PI / 2;  // hold horizontally
      group.add(shaft);
      // Flared driven cap at one end
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.023, 0.018, 0.012, 10),
        ironMat,
      );
      cap.rotation.z = Math.PI / 2;
      cap.position.x = 0.10;
      group.add(cap);
      // Pointed tip at the other end
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.011, 0.05, 8),
        ironMat,
      );
      tip.rotation.z = -Math.PI / 2;
      tip.position.x = -0.13;
      group.add(tip);
      // Rope-loop welded near the cap
      const loop = new THREE.Mesh(
        new THREE.TorusGeometry(0.022, 0.005, 5, 12),
        ironMat,
      );
      loop.position.set(0.06, 0.025, 0);
      group.add(loop);
      return group;
    },
    makeIcon() {
      const s = svg();
      // Vertical stake with a small loop at top + flared cap.
      s.appendChild(svgEl('line', { x1: '12', y1: '5', x2: '12', y2: '18' }));
      s.appendChild(svgEl('circle', { cx: '12', cy: '7', r: '2' }));
      s.appendChild(svgEl('line', { x1: '10', y1: '4', x2: '14', y2: '4' }));
      s.appendChild(svgEl('polyline', { points: '10,18 12,21 14,18' }));
      return s;
    },
  },

  rope: {
    id: 'rope',
    name: 'ROPE',
    glyph: '~',
    description: 'aim at a sled and click to tow',
    stackable: false,
    maxStack: 1,
    // wieldLmb='none' — rope's LMB-on-sled-stub stays in interaction.ts
    // (it needs hover-state to dispatch). wieldAction.ts skips this item
    // for LMB-place / LMB-take so the existing rope-attach flow is
    // unchanged (D67 / QQ-2 preserved).
    wieldLmb: 'none',
    onUse(_ctx, _slot) {
      // E does nothing — attach is LMB-driven via interaction.ts (the
      // wielded-rope special case in case 'sleds'). Toast as a hint.
      return { consumed: false, message: 'aim at a sled and click to tie' };
    },
    makeViewModel() {
      // ABJ — B13: applied wood-grain shader for hempy-fiber reading
      // (tight rings + weathering read as twisted rope strands). Added
      // a second concentric coil loop for "looped multiple times"
      // silhouette + a fraying tail strand at one end.
      const group = new THREE.Group();
      const coilMat = createWoodGrainMaterial(0x6e4a2a, {
        grainAxis: 0,           // grain along the rope's circumference
        ringDensity: 24.0,      // very tight — reads as fiber striations
        weatherLevel: 0.45,
      });
      // Main coil
      const coil = new THREE.Mesh(
        new THREE.TorusGeometry(0.07, 0.022, 8, 16),
        coilMat,
      );
      coil.rotation.x = Math.PI / 2;
      coil.rotation.z = 0.2;
      group.add(coil);
      // Second inner coil — smaller torus stacked behind for "wound
      // multiple times" depth.
      const coil2 = new THREE.Mesh(
        new THREE.TorusGeometry(0.055, 0.018, 6, 14),
        coilMat,
      );
      coil2.rotation.x = Math.PI / 2;
      coil2.rotation.z = 0.35;
      coil2.position.z = -0.012;
      group.add(coil2);
      for (let i = 0; i < 2; i++) {
        const strand = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6),
          coilMat,
        );
        strand.rotation.x = Math.PI / 2;
        strand.position.set((i - 0.5) * 0.06, 0, 0);
        group.add(strand);
      }
      // Fraying tail strand sticking out (asymmetric break).
      const tail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.005, 0.06, 5),
        coilMat,
      );
      tail.position.set(0.08, 0.02, 0.04);
      tail.rotation.set(0.3, 0.5, 0.8);
      group.add(tail);
      return group;
    },
    makeIcon() {
      const s = svg();
      // Coiled rope: concentric circles
      s.appendChild(svgEl('circle', { cx: '12', cy: '12', r: '7' }));
      s.appendChild(svgEl('circle', { cx: '12', cy: '12', r: '4' }));
      return s;
    },
  },
};

export function getItemDef(id: ItemId): ItemDef {
  return _DEFS[id];
}

export const ALL_ITEM_IDS: ReadonlyArray<ItemId> = [
  'canteen', 'scrap', 'bandage', 'machete',
  'cactus_pulp', 'cooked_cactus_pulp',
  'raw_lizard_meat', 'cooked_lizard_meat',
  'raw_worm_meat', 'cooked_worm_meat',
  'branch', 'cloth', 'fire_kit', 'tent_kit',
  'alien_fruit',
  'torch', 'flashlight',
  'lizard_on_a_stick_raw', 'lizard_on_a_stick_cooked',
  'pipe_staff', 'scrap_gun', 'scrap_bullet', 'energy_pistol',
  'rope', 'sled_kit',
  'large_tent_kit',  // Session XX
  'bedroll_kit', 'lantern_kit', 'locker_kit',  // Session AAC
  'companion_pod',  // Session AAE
  'stake_kit',      // Session ACE
  'amban_rifle',    // ACL ITEMS — long-barreled ranged weapon
];
