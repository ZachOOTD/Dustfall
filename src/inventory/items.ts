// Item registry: every item the player can hold + its onUse behavior,
// first-person viewmodel mesh, hotbar SVG icon, and use animation.

import * as THREE from 'three';
import type { ItemDef, ItemId } from './types.ts';
import { Tuning } from '../config/tuning.ts';
import { playDrink, playPour } from '../audio/audio.ts';
import { deployFire } from '../world/fire.ts';
import { deployTent } from '../world/tent.ts';
import { easeOutBack, easeInOutCubic, easeOutQuad } from '../core/ease.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

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

const _DEFS: Record<ItemId, ItemDef> = {
  canteen: {
    id: 'canteen',
    name: 'CANTEEN',
    glyph: '◇',
    description: 'a half-empty canteen',
    stackable: false,
    maxStack: 1,
    onUse(ctx, slot) {
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
    onUse(ctx, _slot) {
      ctx.stats.health = Math.min(1, ctx.stats.health + 0.25);
      return { consumed: true, message: 'you bind a wound' };
    },
    makeViewModel() {
      const group = new THREE.Group();
      const cloth = new THREE.MeshLambertMaterial({ color: 0xe8dcc0 });
      const stripe = new THREE.MeshLambertMaterial({ color: 0xc8b89a });
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.04, 0.08), cloth);
      group.add(pad);
      const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.041, 0.082), stripe);
      s1.position.x = -0.03;
      group.add(s1);
      const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.041, 0.082), stripe);
      s2.position.x = 0.03;
      group.add(s2);
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
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: 0x6e5a4a });
      const chunk = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.04, 0.07), mat);
      chunk.rotation.set(0.2, 0.4, 0.1);
      group.add(chunk);
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.02, 6),
        mat,
      );
      bolt.position.set(0.04, 0.025, 0.02);
      bolt.rotation.x = Math.PI / 2;
      group.add(bolt);
      return group;
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('polygon', { points: '5,8 9,4 16,5 20,10 18,17 12,20 6,16' }));
      s.appendChild(svgEl('line', { x1: '9', y1: '10', x2: '14', y2: '14', 'stroke-width': '1' }));
      return s;
    },
  },

  machete: {
    id: 'machete',
    name: 'MACHETE',
    glyph: '|',
    description: 'a notched, weighted blade',
    stackable: false,
    maxStack: 1,
    onUse(_ctx, _slot) {
      return { consumed: false };
    },
    makeViewModel() {
      const group = new THREE.Group();
      const bladeMat = new THREE.MeshLambertMaterial({
        color: 0xa8aab0,
        emissive: 0x10100e,
      });
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
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: 0x2a3a20 });
      const wedge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.06), mat);
      wedge.rotation.set(0.2, 0.3, 0.1);
      group.add(wedge);
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
    name: 'RAW MEAT',
    glyph: '~',
    description: 'a fleshy strip of lizard',
    stackable: true,
    maxStack: 4,
    onUse(ctx, _slot) {
      ctx.stats.hunger = Math.min(1, ctx.stats.hunger + 0.12);
      ctx.stats.health = Math.max(0, ctx.stats.health - 0.05);
      return { consumed: true, message: 'raw meat — you gag a little' };
    },
    makeViewModel() {
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: 0x9a4a3a });
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.025, 0.06), mat);
      slab.rotation.set(0.1, 0.4, 0.05);
      group.add(slab);
      return group;
    },
    makeIcon() {
      const s = svg();
      // Irregular cut slab
      s.appendChild(svgEl('polygon', { points: '5,11 8,7 16,8 19,11 17,15 13,17 7,16' }));
      s.appendChild(svgEl('line', { x1: '9', y1: '11', x2: '15', y2: '13', 'stroke-width': '1' }));
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
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: 0x4a2a18 });
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.025, 0.06), mat);
      slab.rotation.set(0.1, 0.4, 0.05);
      group.add(slab);
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
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.22, 6), mat);
      stick.rotation.set(0, 0, Math.PI / 2.4);
      group.add(stick);
      // A small offshoot twig
      const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.06, 4), mat);
      twig.position.set(0.05, 0.02, 0);
      twig.rotation.set(0, 0, -0.6);
      group.add(twig);
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
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: 0xc8b89a });
      const fold = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.025, 0.08), mat);
      group.add(fold);
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.015, 0.065),
        new THREE.MeshLambertMaterial({ color: 0xb8a888 }));
      inner.position.y = 0.018;
      group.add(inner);
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
    onUse(ctx, _slot) {
      const fire = deployFire(ctx);
      if (!fire) {
        return { consumed: false, message: 'too close to another fire' };
      }
      return { consumed: true, message: 'fire lit' };
    },
    makeViewModel() {
      const group = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
      // Bundle of 3 sticks in a tee-pee
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.16, 6), mat);
        stick.position.set(Math.cos(a) * 0.025, 0, Math.sin(a) * 0.025);
        stick.rotation.x = 0.4 * Math.sin(a);
        stick.rotation.z = 0.4 * Math.cos(a);
        group.add(stick);
      }
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

  tent_kit: {
    id: 'tent_kit',
    name: 'TENT KIT',
    glyph: '⌂',
    description: 'a roll of canvas and poles',
    stackable: false,
    maxStack: 1,
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
};

export function getItemDef(id: ItemId): ItemDef {
  return _DEFS[id];
}

export const ALL_ITEM_IDS: ReadonlyArray<ItemId> = [
  'canteen', 'scrap', 'bandage', 'machete',
  'cactus_pulp', 'cooked_cactus_pulp',
  'raw_lizard_meat', 'cooked_lizard_meat',
  'branch', 'cloth', 'fire_kit', 'tent_kit',
  'alien_fruit',
  'torch', 'flashlight',
];
