// Item registry: every item the player can hold + its onUse behavior,
// first-person viewmodel mesh, hotbar SVG icon, and use animation.

import * as THREE from 'three';
import type { ItemDef, ItemId } from './types.ts';
import { Tuning } from '../config/tuning.ts';
import { playDrink, playPour, playBandageUse, playSignalFlare } from '../audio/audio.ts';
import { deployFire, findFireById, attachGrillToFire } from '../world/fire.ts';
import { fireSignalFlare } from '../world/signalFlare.ts';   // M6 (C37) — signal_kit's transient flare
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
import { spawnDroppedPickup } from '../pickups/pickups.ts';   // C18 — worm-lure onUse plants a pickup the worm homes on
import { makeLizardVisual } from '../enemies/lizard.ts';
import { makeShrewVisual } from '../enemies/shrew.ts';
import { makeVultureVisual } from '../enemies/vulture.ts';  // ACAH — held dead-vulture model
import { createMetalMaterial, type MetalMaterialOpts } from '../world/metalMaterial.ts';
import { createFabricMaterial } from '../world/fabricMaterial.ts';
import { createWoodGrainMaterial, type WoodGrainMaterialOpts } from '../world/woodGrainMaterial.ts';
import { createBoneMaterial, type BoneMaterialOpts } from '../world/boneMaterial.ts';
import { createGlassMaterial, type GlassMaterialOpts } from '../world/glassMaterial.ts';  // ACL ITEMS — lantern globe
import { buildBranchMesh, BRANCH_WOOD_COLOR, BRANCH_WEATHER_LEVEL } from '../world/branchMesh.ts';  // ACAA — shared branch model + shared color (item + world pickups)
import { buildScrapMesh } from '../world/scrapMesh.ts';  // ACAH — shared scrap model (item + world pickups)
import { buildRelicCoreMesh } from '../world/relicMesh.ts';  // ACAQ — shared relic-core model (item + world pickups)

// ACT — viewmodel material wrappers. EVERY item mesh is rendered as a
// VIEWMODEL: it's added to the main scene and tracks the camera (FP copy) or
// the rig's hand bone (3P copy) every frame — see viewModel.ts. So every item
// surface MOVES through world space continuously. Per D109, procedural noise
// on a moving mesh must sample in OBJECT-LOCAL space or the grain / scratches /
// frost / cracks crawl across the surface as the player walks (the "texture
// shifts on a moving model" bug). These wrappers force `localSpace: true` so no
// item call site can forget it. (Item FABRIC already passes `disableShimmer`,
// which implies local sampling — see fabricMaterial.ts — so it's already safe
// and routes through createFabricMaterial directly.)
function vmMetal(color: number, opts: MetalMaterialOpts = {}) {
  // ACAD — the desert weathers everything: held metal gear defaults to a
  // visibly rusty/scrappy finish (override per-item for shinier or filthier).
  return createMetalMaterial(color, { rustLevel: 0.34, ...opts, localSpace: true });
}
function vmWood(color: number, opts: WoodGrainMaterialOpts = {}) {
  return createWoodGrainMaterial(color, { ...opts, localSpace: true });
}
function vmBone(color: number, opts: BoneMaterialOpts = {}) {
  return createBoneMaterial(color, { ...opts, localSpace: true });
}
function vmGlass(color: number, opts: GlassMaterialOpts = {}) {
  return createGlassMaterial(color, { ...opts, localSpace: true });
}

const SVG_NS = 'http://www.w3.org/2000/svg';

// ACAB — scratch vector reused by flashlight updateHeld to aim the world spot.
const _flashlightDir = new THREE.Vector3();

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
  // ACAS B1 — a real whittled BRANCH as the spit (was a smooth CG cylinder),
  // reusing the shared branch model (taper + faint organic bow). twigs:0 keeps it
  // clean enough to read as a sharpened skewer. Canonical branch lies along +X →
  // rotate so the tip points UP, base at the grip.
  const stick = buildBranchMesh(stickMat, { len: stickLen, twigs: 0, tipRatio: 0.45, radiusScale: 1.15 });
  stick.rotation.z = -Math.PI / 2;
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
      // ACY — deep-detail rebuild: a battered tin field canteen. Flattened flask
      // body (weathered metal), a felt pouch cover over the lower body with a
      // stitch line + reinforcement band, a stepped neck, a knurled screw cap,
      // and a cap retention chain. (D107 zero-asset — procedural shaders only.)
      const tinMat = vmMetal(0x4a463c, { wornScale: 8.0, scratchStrength: 0.06 });
      tinMat.emissive = new THREE.Color(0x0d0c09);
      const capMat = vmMetal(0x2a2620, { wornScale: 5.0 });
      const coverMat = createFabricMaterial(0x6a6450, undefined, { disableShimmer: true });
      const strapMat = createFabricMaterial(0x4a4030, undefined, { disableShimmer: true });
      const chainMat = vmMetal(0x7a7268, { wornScale: 3.0 });

      // Flask body (flattened front-to-back).
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.063, 0.155, 16), tinMat);
      body.scale.set(1, 1, 0.62); group.add(body);
      // Felt pouch cover over the lower body.
      const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.067, 0.10, 16), coverMat);
      cover.scale.set(1, 1, 0.64); cover.position.y = -0.024; group.add(cover);
      // Cover top stitch line + a horizontal reinforcement band.
      const stitch = new THREE.Mesh(new THREE.CylinderGeometry(0.0645, 0.0645, 0.006, 16), strapMat);
      stitch.scale.set(1, 1, 0.64); stitch.position.y = 0.027; group.add(stitch);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0665, 0.0665, 0.016, 16), strapMat);
      band.scale.set(1, 1, 0.64); band.position.y = -0.02; group.add(band);

      // Stepped neck + knurled screw cap.
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.027, 0.034, 12), tinMat);
      neck.position.y = 0.094; group.add(neck);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.024, 16), capMat);
      cap.position.y = 0.122; group.add(cap);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const knurl = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.024, 0.004), capMat);
        knurl.position.set(Math.cos(a) * 0.029, 0.122, Math.sin(a) * 0.029); group.add(knurl);
      }
      // Cap retention chain (a couple of links to the neck).
      for (let i = 0; i < 3; i++) {
        const link = new THREE.Mesh(new THREE.TorusGeometry(0.005, 0.0015, 5, 8), chainMat);
        link.position.set(0.03, 0.118 - i * 0.008, 0); link.rotation.y = 0.5; group.add(link);
      }

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
      // ACY — deep-detail rebuild: a rolled cloth bandage. A fabric roll (along
      // X) with visible spiral wrap rings, a loose frayed end draping off, a
      // binding tie, and a painted field-medical cross on top. Object-local
      // fabric sampling (disableShimmer) keeps the weave anchored as it bobs.
      const group = new THREE.Group();
      const cloth = createFabricMaterial(0xe8dcc0, undefined, { disableShimmer: true });
      const clothDark = createFabricMaterial(0xcdbf9f, undefined, { disableShimmer: true });
      const tieMat = createFabricMaterial(0x9a8a6a, undefined, { disableShimmer: true });
      const crossMat = new THREE.MeshLambertMaterial({ color: 0xa83a2a });

      // Roll body (axis along X).
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.072, 18), cloth);
      roll.rotation.z = Math.PI / 2; group.add(roll);
      // Spiral wrap rings.
      for (let i = 0; i < 4; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0482, 0.0034, 6, 22), clothDark);
        ring.rotation.y = Math.PI / 2; ring.position.x = -0.027 + i * 0.018; group.add(ring);
      }
      // Loose frayed end draping down-forward.
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.058, 0.004), cloth);
      flap.position.set(0, -0.05, 0.03); flap.rotation.x = 0.45; group.add(flap);
      const flapTip = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.028, 0.003), clothDark);
      flapTip.position.set(0, -0.086, 0.052); flapTip.rotation.x = 0.55; group.add(flapTip);
      // Binding tie around the roll.
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.0492, 0.006, 6, 18), tieMat);
      tie.rotation.y = Math.PI / 2; tie.position.x = 0.006; group.add(tie);
      // Painted field-medical cross on top of the roll.
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.008), crossMat);
      crossH.position.set(0, 0.049, 0); group.add(crossH);
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.004, 0.03), crossMat);
      crossV.position.set(0, 0.049, 0); group.add(crossV);

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
      // ACBC/ACBD — one torn, bent, rusted SHEET of hull plating via the SHARED
      // buildScrapMesh (matches the world pickups scattered around wrecks, like
      // branchMesh does for branches). Heavily-rusted oxidized steel — buckled
      // plate + curling edge + bitten corners + fold crease + a peeled accent tab
      // + a darker shard. (ACBD: rivets dropped — read as floating bolts.)
      // wornScale bumped 6→44: at the old low scale the rust noise barely cycled
      // once across the ~15cm sheet (one flat blotch); finer = per-flake detail.
      const mat = vmMetal(0x7a3c1c, { wornScale: 44.0, scratchStrength: 0.08, rustLevel: 0.92 });        // saturated rust-orange base
      const accentMat = vmMetal(0x52260f, { wornScale: 52.0, scratchStrength: 0.06, rustLevel: 0.97 });  // deep-rust crevice tone
      return buildScrapMesh(mat, accentMat);
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('polygon', { points: '5,8 9,4 16,5 20,10 18,17 12,20 6,16' }));
      s.appendChild(svgEl('line', { x1: '9', y1: '10', x2: '14', y2: '14', 'stroke-width': '1' }));
      return s;
    },
  },

  // ACAQ (Cycle 8) — wreck-yard exclusive: a glowing alien-tech relic core.
  // A rare emergency artifact (near-full restore on use) scattered only in the
  // graveyard biome (pickups.ts spawnRelicAt). The reward for the journey + pit.
  relic_core: {
    id: 'relic_core',
    name: 'RELIC CORE',
    glyph: '◆',
    description: 'an intact alien-tech core, still humming with power',
    stackable: true,
    maxStack: 4,
    onUse(ctx, _slot) {
      ctx.stats.health = Math.min(1, ctx.stats.health + 0.6);
      ctx.stats.thirst = 1;
      ctx.stats.hunger = 1;
      ctx.stats.stamina = 1;
      return { consumed: true, message: 'the core discharges — energy floods through you' };
    },
    makeViewModel() {
      return buildRelicCoreMesh();
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('polygon', { points: '12,3 19,12 12,21 5,12' }));
      s.appendChild(svgEl('circle', { cx: '12', cy: '12', r: '3.4' }));
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
    // ACX — 3P grip: shaft is mesh +Y (machete convention) → -90° X points it
    // forward (attach -Z), grip-wrap trails into the fist.
    handAttachTransform: { pos: [0, 0, 0], rot: [-1.571, 0, 0] },
    onUse(_ctx, _slot) {
      // The actual pry logic lives in interaction.ts's 'salvageables'
      // case — onUse returns "do nothing" because the interaction.ts
      // path handles the hover-aware action. If LMB fires without a
      // salvageable hovered, this is a no-op (no toast, no consumption).
      return { consumed: false };
    },
    makeViewModel() {
      const group = new THREE.Group();
      // ACY — deep-detail rebuild: a proper double-ended crowbar. Faceted forged
      // shaft, a curved nail-puller claw with a V slot at the top, a flattened
      // beveled chisel pry-blade at the bottom, and a wrapped grip at the hand.
      const ironMat = vmMetal(0x6e5a4a, { wornScale: 7.0, scratchStrength: 0.06 });
      ironMat.emissive = new THREE.Color(0x0a0806);
      const tipMat = vmMetal(0x9a886e, { wornScale: 6.0 });          // worn-bright working ends
      const gripMat = createFabricMaterial(0x33251b, undefined, { disableShimmer: true });

      // Octagonal forged shaft (faceted, not a plain box).
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0118, 0.0126, 0.32, 8), ironMat);
      shaft.position.y = 0.06; group.add(shaft);

      // Reinforced bend junction near the top.
      const knee = new THREE.Mesh(new THREE.CylinderGeometry(0.0162, 0.0142, 0.05, 8), ironMat);
      knee.position.set(-0.006, 0.215, 0); knee.rotation.z = -0.32; group.add(knee);

      // Curved nail-puller claw — two flattened segments curling back.
      const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.015), tipMat);
      seg1.position.set(-0.024, 0.25, 0); seg1.rotation.z = -0.72; group.add(seg1);
      const seg2 = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.017, 0.014), tipMat);
      seg2.position.set(-0.052, 0.234, 0); seg2.rotation.z = -1.18; group.add(seg2);
      // V nail-slot notched into the claw edge.
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.022), ironMat);
      slot.position.set(-0.031, 0.244, 0); slot.rotation.z = -0.72; group.add(slot);

      // Bottom: flattened angled chisel / pry blade (double-ended).
      const chisel = new THREE.Mesh(new THREE.BoxGeometry(0.031, 0.05, 0.012), tipMat);
      chisel.position.set(0.007, -0.115, 0); chisel.rotation.z = 0.2; group.add(chisel);
      const bevel = new THREE.Mesh(new THREE.BoxGeometry(0.033, 0.012, 0.005), tipMat);
      bevel.position.set(0.014, -0.141, 0); bevel.rotation.z = 0.2; group.add(bevel);

      // Wrapped grip at the hand zone (straddles the origin).
      for (let i = 0; i < 6; i++) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.0138, 0.003, 6, 14), gripMat);
        band.rotation.x = Math.PI / 2; band.position.y = 0.022 - i * 0.016; group.add(band);
      }
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

  // M10 ⑭ (C57) — scrap machete: a crude blade beaten from salvage. Functions as a
  // PRY TOOL (wieldLmb 'click_use' → the salvageables hover-path in interaction.ts
  // levers panels open, same as scrap_bar) but reads as an improvised machete rather
  // than a crowbar. Cruder than the found `machete` weapon (rough bolo blade, chipped
  // edge, bolted tang) — that one stays the honed melee blade; this is the tool you craft.
  scrap_machete: {
    id: 'scrap_machete',
    name: 'SCRAP MACHETE',
    glyph: '|',
    description: 'a crude blade beaten from scrap — swings for meat, bites panels open',
    stackable: false,
    maxStack: 1,
    // 2026-07-09 — now a real WEAPON: LMB swings + damages wildlife (registered in
    // combat.ts _WEAPON_SPECS, uses the melee proximity assist). Prying is UNCHANGED —
    // it's E-triggered + gated on the item id in interaction.ts, independent of wieldLmb.
    wieldLmb: 'attack',
    thirdPersonScale: 1.35,
    // 3P grip: blade is mesh +Y (machete convention) → -90° X points it forward.
    handAttachTransform: { pos: [0, 0, 0], rot: [-1.571, 0, 0] },
    onUse(_ctx, _slot) {
      // The swing is handled by updateCombat (melee spec). Prying is E-triggered in
      // interaction.ts. onUse (LMB fallback) is a no-op.
      return { consumed: false };
    },
    makeViewModel() {
      const group = new THREE.Group();
      // A crude bolo: a rough scrap-steel plate (wide belly, blunt angled tip), a
      // chipped edge, a bolted iron tang + rivets, and a cloth-wrapped grip. Dirtier
      // + simpler than the honed `machete` so the two read as distinct items.
      const bladeMat = vmMetal(0x6b5f51, { scratchAngle: Math.PI / 2, wornScale: 4.5, scratchStrength: 0.14 });
      bladeMat.emissive = new THREE.Color(0x0a0806);               // dark oxidized scrap steel
      const edgeMat = vmMetal(0xa1937b, { wornScale: 5.0 });        // worn-bright sharpened edge (only the honed bevel catches light)
      const ironMat = vmMetal(0x34302a, { wornScale: 5.0 });        // dark iron tang / rivets
      ironMat.emissive = new THREE.Color(0x070605);
      const gripMat = createFabricMaterial(0x3a2b1e, undefined, { disableShimmer: true });
      const rivetMat = vmMetal(0x968d80, { wornScale: 3.0 });

      // --- Blade: extruded crude bolo profile (flat in XY, thickness in Z) ---
      const bs = new THREE.Shape();
      bs.moveTo(-0.013, 0.0);                       // spine at the ricasso
      bs.lineTo(-0.017, 0.165);                     // up the slightly-irregular spine
      bs.lineTo(-0.011, 0.224);                     // spine near the tip
      bs.lineTo(0.012, 0.236);                      // blunt angled chopping tip
      bs.lineTo(0.024, 0.12);                       // fat bolo belly
      bs.lineTo(0.014, 0.0);                        // cutting edge at the ricasso
      bs.lineTo(-0.013, 0.0);
      const bladeGeo = new THREE.ExtrudeGeometry(bs, {
        depth: 0.006, bevelEnabled: true, bevelThickness: 0.0014, bevelSize: 0.0013, bevelSegments: 1, steps: 1,
      });
      bladeGeo.translate(0, 0, -0.003);
      group.add(new THREE.Mesh(bladeGeo, bladeMat));

      // Honed edge strip — a thin worn-bright bevel along the belly.
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.2, 0.0085), edgeMat);
      edge.position.set(0.015, 0.1, 0); edge.rotation.z = 0.06; group.add(edge);

      // Chips knocked out of the edge (dark notch boxes) — improvised, damaged.
      const chip1 = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.014, 0.012), ironMat);
      chip1.position.set(0.02, 0.072, 0); group.add(chip1);
      const chip2 = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.011, 0.012), ironMat);
      chip2.position.set(0.013, 0.155, 0); group.add(chip2);
      const chip3 = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.009, 0.012), ironMat);
      chip3.position.set(0.022, 0.105, 0); group.add(chip3);

      // Bolted iron tang/bolster where the blade meets the grip.
      const tang = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.045, 0.016), ironMat);
      tang.position.set(0.0, -0.02, 0); group.add(tang);
      for (let i = 0; i < 2; i++) {
        const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.02, 6), rivetMat);
        rivet.rotation.x = Math.PI / 2; rivet.position.set(0, -0.01 - i * 0.022, 0); group.add(rivet);
      }

      // Cloth-wrapped grip (bands straddling the hand origin).
      for (let i = 0; i < 6; i++) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.0135, 0.0032, 6, 14), gripMat);
        band.rotation.x = Math.PI / 2; band.position.y = -0.045 - i * 0.016; group.add(band);
      }
      group.rotation.set(-0.15, 0.0, 0.10);
      return group;
    },
    makeIcon() {
      const s = svg();
      // Wide bolo blade + short grip.
      s.appendChild(svgEl('polygon', { points: '11,3 14,5 13,14 9,14' }));
      s.appendChild(svgEl('line', { x1: '10', y1: '14', x2: '10', y2: '21', 'stroke-width': '2.4' }));
      return s;
    },
    playUseAnim(itemRoot, t) {
      // Pry-thrust — forward jab + slight roll, recovers cubic (mirrors scrap_bar).
      const p = t < 0.35 ? easeOutBack(t / 0.35) : 1 - easeInOutCubic((t - 0.35) / 0.65);
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
    // ACX — 3P grip. The attach frame is now oriented (playerRig) so -Z =
    // player-forward. The machete's blade is mesh +Y, so rotate -90° about X
    // (+Y → -Z) to point the blade forward; the handle then trails back into
    // the fist.
    handAttachTransform: { pos: [0, 0, 0], rot: [-1.571, 0, 0] },
    onUse(_ctx, _slot) {
      return { consumed: false };
    },
    makeViewModel() {
      const group = new THREE.Group();
      // ACY — deep-detail rebuild. Real extruded parang-style blade profile
      // (belly bulge + clip tip) with a bevel-honed edge, a thicker spine ridge,
      // a fuller groove, a crossguard + quillon, and a leather-wrapped grip with
      // wrap bands, pommel, and rivets. Brushed scratches run ALONG the blade
      // (scratchAngle ≈ vertical) for the honed read.
      const steel = vmMetal(0xb4b6bc, { scratchAngle: Math.PI / 2, wornScale: 10.0, scratchStrength: 0.06 });
      steel.emissive = new THREE.Color(0x121214);
      const ironMat = vmMetal(0x33302a, { wornScale: 6.0 });            // guard / pommel dark iron
      ironMat.emissive = new THREE.Color(0x070605);
      const leatherMat = createFabricMaterial(0x4a3322, undefined, { disableShimmer: true });  // grip wrap
      const rivetMat = vmMetal(0x9a9288, { wornScale: 3.0 });

      // --- Blade: extruded 2D profile (flat in XY, thickness in Z) ---
      const bs = new THREE.Shape();
      bs.moveTo(-0.012, 0.0);                              // spine at ricasso
      bs.lineTo(-0.014, 0.20);                             // up the straight spine
      bs.lineTo(-0.009, 0.265);                            // spine just before tip
      bs.quadraticCurveTo(0.004, 0.302, 0.013, 0.252);    // clip-point tip
      bs.quadraticCurveTo(0.027, 0.175, 0.016, 0.045);    // belly bulge sweeping to the edge
      bs.lineTo(0.012, 0.0);                               // cutting edge at the ricasso
      bs.lineTo(-0.012, 0.0);
      const bladeGeo = new THREE.ExtrudeGeometry(bs, {
        depth: 0.0055, bevelEnabled: true, bevelThickness: 0.0016,
        bevelSize: 0.0015, bevelSegments: 1, steps: 1,
      });
      bladeGeo.translate(0, 0, -0.00275);                 // center the thickness on z=0
      group.add(new THREE.Mesh(bladeGeo, steel));

      // Spine ridge — a touch thicker than the blade so it catches a highlight.
      const spine = new THREE.Mesh(new THREE.BoxGeometry(0.0045, 0.255, 0.0092), steel);
      spine.position.set(-0.0115, 0.128, 0);
      group.add(spine);

      // Fuller groove — a thin darker line engraved down each face.
      for (const z of [0.0032, -0.0032]) {
        const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.0032, 0.205, 0.0009), ironMat);
        fuller.position.set(-0.0025, 0.118, z);
        group.add(fuller);
      }

      // --- Crossguard + quillon + bolster ---
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.017, 0.026), ironMat);
      guard.position.y = -0.013;
      group.add(guard);
      const quillon = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.026, 0.016), ironMat);
      quillon.position.set(0.027, -0.027, 0);
      group.add(quillon);
      // Metal ferrule/bolster collaring the grip to the guard.
      const bolster = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.0155, 0.016, 12), rivetMat);
      bolster.position.y = -0.03;
      group.add(bolster);

      // --- Leather-wrapped grip (slimmer than the blade ricasso) ---
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.0152, 0.082, 10), leatherMat);
      core.position.y = -0.072;
      group.add(core);
      for (let i = 0; i < 5; i++) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.0146, 0.0032, 6, 14), leatherMat);
        band.rotation.x = Math.PI / 2;
        band.position.y = -0.044 - i * 0.0145;
        group.add(band);
      }
      const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.0185, 0.013, 0.019, 12), ironMat);
      pommel.position.y = -0.117;
      group.add(pommel);
      // Two rivets pinning the scales — heads proud on both faces.
      const rivetGeo = new THREE.CylinderGeometry(0.0034, 0.0034, 0.034, 6);
      for (const y of [-0.06, -0.092]) {
        const rivet = new THREE.Mesh(rivetGeo, rivetMat);
        rivet.rotation.x = Math.PI / 2;
        rivet.position.set(0, y, 0);
        group.add(rivet);
      }

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
    playUseAnim3P(rig, t) {
      // ACW D11 — 3P diagonal overhead chop on the right arm (the FP playUseAnim
      // only moves the viewmodel item, invisible in 3P). p ∈ [-1 (raised back),
      // +1 (struck down-forward)]: windup → snap → recover, mirroring the FP
      // strike timing. Author absolute bone poses (the rig re-poses next frame).
      let p: number;
      if (t < 0.3) p = -easeOutQuad(t / 0.3);                 // raise up/back
      else if (t < 0.55) p = -1 + 2 * easeOutBack((t - 0.3) / 0.25); // snap forward (overshoot)
      else p = 1 - easeInOutCubic((t - 0.55) / 0.45);         // recover to neutral
      rig.shoulders[0].rotation.set(-0.5 + 1.0 * p, 0, 0.2 - 0.3 * p);  // ACX — index 0 = right arm
      rig.elbows[0].rotation.x = 0.9 - 0.7 * Math.max(0, p);  // bent on windup, extends on strike
      rig.wrists[0].rotation.x = -0.1;
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
    // ACX — 3P grip: pipe is mesh +Y → -90° X points it forward (attach -Z),
    // wrapped grip trails into the fist.
    handAttachTransform: { pos: [0, 0, 0], rot: [-1.571, 0, 0] },
    onUse(_ctx, _slot) {
      return { consumed: false };
    },
    makeViewModel() {
      const group = new THREE.Group();
      // ACY — deep-detail rebuild: scavenged plumbing. Two pipe sections joined
      // by a hex union coupling with exposed threads, a bolted flange as the
      // striking head, a hose-clamp field repair, and a taped cloth grip that
      // straddles the origin so the hand holds the wrap.
      const pipeMat = vmMetal(0x6a6055, { wornScale: 6.0, scratchStrength: 0.05 });
      pipeMat.emissive = new THREE.Color(0x0a0907);
      const rustMat = vmMetal(0x7a4a30, { wornScale: 8.0 });          // corroded joints
      rustMat.emissive = new THREE.Color(0x0c0604);
      const steelMat = vmMetal(0x8c877d, { wornScale: 4.0 });         // bright threads / clamps
      const gripMat = createFabricMaterial(0x3a2c22, undefined, { disableShimmer: true });
      const tapeMat = new THREE.MeshLambertMaterial({ color: 0x221d18 });

      // Lower + upper pipe sections (slightly different bore reads as scavenged).
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.0182, 0.019, 0.16, 12), pipeMat);
      lower.position.y = 0.135; group.add(lower);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.0172, 0.0182, 0.20, 12), pipeMat);
      upper.position.y = 0.33; group.add(upper);

      // Union coupling — hex nut joining the sections, with exposed threads.
      const coupling = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.032, 6), rustMat);
      coupling.position.y = 0.225; group.add(coupling);
      for (const y of [0.205, 0.245]) {
        const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.0202, 0.0202, 0.012, 12), steelMat);
        thread.position.y = y; group.add(thread);
      }

      // Striking head: a pipe flange (wide disc) ringed with bolt heads.
      const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.02, 16), rustMat);
      flange.position.y = 0.44; group.add(flange);
      const flangeCap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.034, 0.016, 16), steelMat);
      flangeCap.position.y = 0.458; group.add(flangeCap);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0038, 0.024, 6), steelMat);
        bolt.position.set(Math.cos(a) * 0.026, 0.44, Math.sin(a) * 0.026);
        group.add(bolt);
      }

      // Hose-clamp field repair on the upper section.
      const clamp = new THREE.Mesh(new THREE.TorusGeometry(0.0192, 0.0028, 6, 16), steelMat);
      clamp.rotation.x = Math.PI / 2; clamp.position.y = 0.37; group.add(clamp);

      // Taped cloth grip straddling the origin (the hand holds here).
      const tapeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.0205, 0.021, 0.115, 12), tapeMat);
      tapeBase.position.y = -0.005; group.add(tapeBase);
      for (let i = 0; i < 6; i++) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.0218, 0.0034, 6, 16), gripMat);
        band.rotation.x = Math.PI / 2; band.position.y = 0.045 - i * 0.018; group.add(band);
      }
      // Butt cap.
      const butt = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.0235, 0.018, 12), rustMat);
      butt.position.y = -0.072; group.add(butt);

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
    // ACX — 3P grip. The attach frame's -Z is now player-forward and the gun's
    // barrel is mesh -Z, so NO rotation is needed — it points forward out of the
    // box. (Pre-ACX a π/2 X-rot fought the un-oriented frame.)
    handAttachTransform: { pos: [0, 0, 0], rot: [0, 0, 0] },
    onUse(_ctx, _slot) {
      // Firing is driven by combat.ts via LMB — `onUse` (E key) is a
      // no-op for ranged weapons.
      return { consumed: false };
    },
    makeViewModel() {
      const group = new THREE.Group();
      // ACY — deep-detail rebuild: a crude welded scrap pistol. Welded receiver
      // (seam + ejection port), breech collar, wire-wrapped reinforced barrel +
      // muzzle, front/rear sights, external hammer, wrapped canted grip, real
      // trigger inside a loop guard. Barrel points -Z (viewmodel forward).
      const bodyMat = vmMetal(0x4a4640, { wornScale: 7.0 });
      bodyMat.emissive = new THREE.Color(0x0a0907);
      const barrelMat = vmMetal(0x2c2924, { wornScale: 7.0, scratchAngle: Math.PI / 2 });
      const steelMat = vmMetal(0x8a8278, { wornScale: 4.0 });          // bright hammer/trigger/wire
      const weldMat = vmMetal(0x6a4a38, { wornScale: 9.0 });           // rusty weld seam
      const gripMat = createFabricMaterial(0x33251b, undefined, { disableShimmer: true });

      // Receiver (welded scrap block) + a rough weld seam + ejection port.
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.041, 0.062, 0.105), bodyMat);
      receiver.position.set(0, 0, -0.04); group.add(receiver);
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.011, 0.10), weldMat);
      seam.position.set(0, 0.034, -0.04); group.add(seam);
      const port = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.02, 0.032), barrelMat);
      port.position.set(0, 0.013, -0.018); group.add(port);

      // Breech collar → barrel → muzzle, with wire-wrap reinforcement bands.
      const breech = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.03, 10), bodyMat);
      breech.rotation.x = Math.PI / 2; breech.position.set(0, 0.013, -0.095); group.add(breech);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.0125, 0.175, 10), barrelMat);
      barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.013, -0.188); group.add(barrel);
      for (const z of [-0.155, -0.205, -0.245]) {
        const wire = new THREE.Mesh(new THREE.TorusGeometry(0.0132, 0.0022, 6, 14), steelMat);
        wire.position.set(0, 0.013, z); group.add(wire);
      }
      const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0132, 0.024, 10), bodyMat);
      muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, 0.013, -0.278); group.add(muzzle);

      // Sights — front blade + rear notch block; external hammer at the rear.
      const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.015, 0.008), steelMat);
      frontSight.position.set(0, 0.032, -0.258); group.add(frontSight);
      const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.011, 0.009), bodyMat);
      rearSight.position.set(0, 0.038, -0.006); group.add(rearSight);
      const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.024, 0.009), steelMat);
      hammer.position.set(0, 0.03, 0.014); hammer.rotation.x = 0.32; group.add(hammer);

      // Wrapped canted grip (subgroup inherits the cant) with a base plate.
      const gripG = new THREE.Group();
      gripG.position.set(0, -0.062, 0.0); gripG.rotation.x = -0.34;
      gripG.add(new THREE.Mesh(new THREE.BoxGeometry(0.027, 0.094, 0.034), gripMat));
      for (let i = 0; i < 4; i++) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.031, 0.006, 0.038), barrelMat);
        band.position.y = 0.03 - i * 0.022; gripG.add(band);
      }
      const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.031, 0.012, 0.038), bodyMat);
      basePlate.position.y = -0.052; gripG.add(basePlate);
      group.add(gripG);

      // Trigger guard loop + trigger.
      const guard = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0035, 6, 16), bodyMat);
      guard.rotation.y = Math.PI / 2; guard.position.set(0, -0.03, -0.022); group.add(guard);
      const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.017, 0.005), steelMat);
      trigger.position.set(0, -0.029, -0.02); trigger.rotation.x = 0.25; group.add(trigger);

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
      // ACY — deep-detail rebuild: a proper bottlenecked rifle cartridge. Rimmed
      // base + extractor groove + primer, brass case body, shoulder taper, necked
      // mouth with a crimp, and a copper-jacketed ogive bullet.
      const group = new THREE.Group();
      const brassMat = vmMetal(0xb09464, { wornScale: 16.0, scratchStrength: 0.03 });
      brassMat.emissive = new THREE.Color(0x120c05);
      const copperMat = vmMetal(0x9a5a32, { wornScale: 16.0, scratchStrength: 0.03 });
      copperMat.emissive = new THREE.Color(0x140a04);
      const primerMat = vmMetal(0x6a6258, { wornScale: 8.0 });

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.0156, 0.0156, 0.005, 14), brassMat);
      rim.position.y = 0.0025; group.add(rim);
      const groove = new THREE.Mesh(new THREE.CylinderGeometry(0.0122, 0.0122, 0.004, 14), brassMat);
      groove.position.y = 0.0075; group.add(groove);
      const primer = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.0035, 10), primerMat);
      primer.position.y = 0.0008; group.add(primer);

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0146, 0.0152, 0.026, 14), brassMat);
      body.position.y = 0.0225; group.add(body);
      const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.0106, 0.0146, 0.008, 14), brassMat);
      shoulder.position.y = 0.0395; group.add(shoulder);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.0103, 0.0106, 0.009, 14), brassMat);
      neck.position.y = 0.048; group.add(neck);
      const crimp = new THREE.Mesh(new THREE.TorusGeometry(0.0104, 0.0012, 6, 14), copperMat);
      crimp.rotation.x = Math.PI / 2; crimp.position.y = 0.051; group.add(crimp);

      const bulletBase = new THREE.Mesh(new THREE.CylinderGeometry(0.0099, 0.0103, 0.012, 14), copperMat);
      bulletBase.position.y = 0.058; group.add(bulletBase);
      const ogive = new THREE.Mesh(
        new THREE.SphereGeometry(0.0099, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), copperMat);
      ogive.position.y = 0.064; ogive.scale.y = 1.7; group.add(ogive);

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
    // ACX — 3P grip (same −Z-barrel family as scrap_gun): barrel = attach -Z =
    // forward with no rotation needed.
    handAttachTransform: { pos: [0, 0, 0], rot: [0, 0, 0] },
    onUse(_ctx, _slot) {
      return { consumed: false };
    },
    makeViewModel() {
      const group = new THREE.Group();
      // ACY — deep-detail rebuild: a sleek salvaged sci-fi sidearm, distinct
      // from the crude scrap_gun. Angular alloy body + beveled cowl + heat-sink
      // vent fins, a glowing barrel-coil emitter rail, a muzzle lens, energy-cell
      // windows, and a grooved grip. All glow elements share `chamberMat` so
      // updateHeld pulses them together cold→orange→hot as the shot charges.
      const bodyMat = vmMetal(0x2a3540, { wornScale: 11.0, scratchStrength: 0.035 });
      bodyMat.emissive = new THREE.Color(0x0a0d12);
      const accentMat = vmMetal(0x55636e, { wornScale: 11.0, scratchStrength: 0.035 });
      const darkMat = vmMetal(0x171d24, { wornScale: 12.0 });
      const gripMat = createFabricMaterial(0x161d27, undefined, { disableShimmer: true });
      const chamberMat = new THREE.MeshBasicMaterial({ color: 0x1a1410 });   // pulsed by updateHeld

      // Receiver + beveled top cowl + heat-sink vent fins.
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.056, 0.092), bodyMat);
      receiver.position.set(0, 0, -0.05); group.add(receiver);
      const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.018, 0.086), accentMat);
      cowl.position.set(0, 0.035, -0.05); group.add(cowl);
      for (let i = 0; i < 4; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.009, 0.005), darkMat);
        fin.position.set(0, 0.047, -0.018 - i * 0.015); group.add(fin);
      }
      // Side energy-cell window (glow).
      const cell = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.016, 0.028), chamberMat);
      cell.position.set(0, 0.0, -0.038); group.add(cell);

      // Emitter rail barrel + top groove rail + glowing coil rings + muzzle lens.
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.027, 0.024, 0.11), accentMat);
      barrel.position.set(0, 0.012, -0.145); group.add(barrel);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.007, 0.1), darkMat);
      rail.position.set(0, 0.027, -0.145); group.add(rail);
      for (const z of [-0.115, -0.15, -0.185]) {
        const coil = new THREE.Mesh(new THREE.TorusGeometry(0.0162, 0.0026, 6, 16), chamberMat);
        coil.position.set(0, 0.012, z); group.add(coil);
      }
      const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.006, 14), chamberMat);
      emitter.rotation.x = Math.PI / 2; emitter.position.set(0, 0.012, -0.205); group.add(emitter);
      const emitterRing = new THREE.Mesh(new THREE.TorusGeometry(0.0162, 0.0032, 8, 16), accentMat);
      emitterRing.position.set(0, 0.012, -0.205); group.add(emitterRing);

      // Charge chamber across the action (the primary glow element).
      const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 14), chamberMat);
      chamber.rotation.z = Math.PI / 2; chamber.position.set(0, 0.03, -0.018); group.add(chamber);

      group.userData.chamberMat = chamberMat;
      group.userData.emitterMat = chamberMat;

      // Grip subgroup — angled, finger grooves + a glowing cell strip.
      const gripG = new THREE.Group();
      gripG.position.set(0, -0.058, -0.012); gripG.rotation.x = -0.30;
      gripG.add(new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.088, 0.032), gripMat));
      for (let i = 0; i < 3; i++) {
        const groove = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.005, 0.034), darkMat);
        groove.position.set(0, 0.022 - i * 0.02, 0.004); gripG.add(groove);
      }
      const cellStrip = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.05, 0.012), chamberMat);
      cellStrip.position.set(0.016, 0.0, 0.0); gripG.add(cellStrip);
      group.add(gripG);

      // Trigger guard loop + trigger.
      const guard = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.003, 6, 16), bodyMat);
      guard.rotation.y = Math.PI / 2; guard.position.set(0, -0.028, -0.03); group.add(guard);
      const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.016, 0.005), accentMat);
      trigger.position.set(0, -0.026, -0.028); trigger.rotation.x = 0.2; group.add(trigger);

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
    // ACX — 3P grip (same −Z-barrel family, longer with a rear stock): barrel =
    // attach -Z = forward, no rotation. Small -Z shift centres the long body so
    // the pistol grip (not the receiver) sits in the fist.
    handAttachTransform: { pos: [0, 0, -0.04], rot: [0, 0, 0] },
    onUse(_ctx, _slot) {
      // Ranged firing is driven by combat.ts via LMB; onUse (E) is inert.
      return { consumed: false };
    },
    makeViewModel() {
      const group = new THREE.Group();
      // Receiver/barrel — machined dark steel; long barrel runs forward (-Z).
      const steelMat = vmMetal(0x3a3832, { wornScale: 9.0, scratchStrength: 0.05 });
      steelMat.emissive = new THREE.Color(0x090807);
      const barrelMat = vmMetal(0x26241f, { wornScale: 9.0, scratchAngle: Math.PI / 2, scratchStrength: 0.06 });
      // Stock + fore-grip — carved wood grain.
      const woodMat = vmWood(0x5a3a22, {
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
      // Trigger guard — proper metal loop + a trigger inside it.
      const guard = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0032, 6, 16), steelMat);
      guard.rotation.y = Math.PI / 2; guard.position.set(0, -0.026, -0.012); group.add(guard);
      const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.016, 0.005), steelMat);
      trigger.position.set(0, -0.024, -0.01); trigger.rotation.x = 0.2; group.add(trigger);
      // Bolt handle — knob jutting from the right of the receiver, with a ball.
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6), steelMat);
      bolt.rotation.z = Math.PI / 2; bolt.position.set(0.035, 0.012, 0.02); group.add(bolt);
      const boltBall = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), steelMat);
      boltBall.position.set(0.058, 0.012, 0.02); group.add(boltBall);

      // ACY — marksman scope: tube + objective bell + ring mounts + glass lenses.
      const glassMat = vmGlass(0x2a3a44, { frostLevel: 0.1, edgeHighlight: 0.8, opacity: 0.7 });
      const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.15, 14), steelMat);
      scopeTube.rotation.x = Math.PI / 2; scopeTube.position.set(0, 0.052, -0.085); group.add(scopeTube);
      const objective = new THREE.Mesh(new THREE.CylinderGeometry(0.0185, 0.015, 0.04, 14), steelMat);
      objective.rotation.x = Math.PI / 2; objective.position.set(0, 0.052, -0.165); group.add(objective);
      for (const z of [-0.18, -0.02]) {        // lens glass at each end
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(z < -0.1 ? 0.017 : 0.0125, z < -0.1 ? 0.017 : 0.0125, 0.004, 14), glassMat);
        lens.rotation.x = Math.PI / 2; lens.position.set(0, 0.052, z); group.add(lens);
      }
      for (const z of [-0.04, -0.13]) {         // two ring mounts to the receiver
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.0035, 6, 14), steelMat);
        ring.position.set(0, 0.052, z); group.add(ring);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.018, 0.012), steelMat);
        post.position.set(0, 0.04, z); group.add(post);
      }

      // Box magazine below the action.
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.052, 0.046), steelMat);
      mag.position.set(0, -0.045, -0.052); mag.rotation.x = 0.12; group.add(mag);
      // Barrel band joining the fore-grip to the barrel.
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0035, 6, 14), steelMat);
      band.rotation.x = Math.PI / 2; band.position.set(0, 0.009, -0.292); group.add(band);
      // Recoil pad at the butt of the stock.
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.072, 0.014),
        new THREE.MeshLambertMaterial({ color: 0x1a140f }));
      pad.position.set(0, -0.022, 0.214); pad.rotation.x = 0.12; group.add(pad);

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

  // ACAC — pulse rifle: rapid-fire energy carbine. Auto-fires while LMB held
  // (combat.ts `auto` spec) from a self-recharging energy cell (slot.meta.
  // ammoRemaining, refilled by updateHeld below — no ammo item). The cell +
  // emitter coils GLOW by charge level + flash on each pulse.
  pulse_rifle: {
    id: 'pulse_rifle',
    name: 'PULSE RIFLE',
    glyph: '⌁',
    description: 'a salvaged energy carbine — rapid pulses from a recharging cell',
    stackable: false,
    maxStack: 1,
    wieldLmb: 'attack',
    thirdPersonScale: 1.28,
    handAttachTransform: { pos: [0, 0, 0], rot: [0, 0, 0] },   // barrel = mesh -Z = forward
    onUse(_ctx, _slot) {
      return { consumed: false };   // ranged firing is driven by combat.ts on LMB
    },
    makeViewModel() {
      const group = new THREE.Group();
      // ACAD — salvaged + corroded: rusted-iron body (heavy rust + scratches),
      // a mismatched scrap patch, exposed wiring + a cable wrap + a hose clamp.
      // The glowing cell is the only pristine tech amid the junk.
      const bodyMat = vmMetal(0x3c352c, { wornScale: 9.0, scratchStrength: 0.08, rustLevel: 0.62 });
      bodyMat.emissive = new THREE.Color(0x0a0806);
      const accentMat = vmMetal(0x6a5a46, { wornScale: 9.0, scratchStrength: 0.07, rustLevel: 0.5 });
      const darkMat = vmMetal(0x1e1813, { wornScale: 12.0, rustLevel: 0.42 });
      const patchMat = vmMetal(0x5c4a38, { wornScale: 7.0, rustLevel: 0.72 });   // mismatched scrap patch
      const copperMat = vmMetal(0x7a4a28, { wornScale: 8.0, rustLevel: 0.25 });  // exposed copper wiring
      const wireMat = new THREE.MeshLambertMaterial({ color: 0x241b13 });        // grimy cable
      const gripMat = createFabricMaterial(0x2a2017, undefined, { disableShimmer: true });  // grimy wrap
      // Glow material — cell + emitter coils + muzzle lens; pulsed by updateHeld.
      const cellMat = new THREE.MeshBasicMaterial({ color: 0x2a8a6a, toneMapped: false, fog: false });

      // Receiver + top rail + a small sight.
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.13), bodyMat);
      receiver.position.set(0, 0, -0.05); group.add(receiver);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.012, 0.12), darkMat);
      rail.position.set(0, 0.037, -0.05); group.add(rail);
      const sight = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.02, 0.01), accentMat);
      sight.position.set(0, 0.052, -0.018); group.add(sight);
      // Side vent slots (heat).
      for (let i = 0; i < 3; i++) {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.012, 0.006), darkMat);
        vent.position.set(0, -0.008, -0.018 - i * 0.016); group.add(vent);
      }

      // Energy cell — the signature glowing element (slotted on top, with
      // clamps + battery-segment ribs so it reads as a power cell).
      const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0155, 0.07, 14), cellMat);
      cell.rotation.x = Math.PI / 2; cell.position.set(0, 0.028, 0.012); group.add(cell);
      for (const z of [-0.012, 0.036]) {
        const clamp = new THREE.Mesh(new THREE.TorusGeometry(0.0175, 0.004, 6, 14), accentMat);
        clamp.position.set(0, 0.028, z); group.add(clamp);
      }
      for (const z of [-0.002, 0.012, 0.026]) {     // segment ribs
        const rib = new THREE.Mesh(new THREE.TorusGeometry(0.0162, 0.0016, 6, 14), darkMat);
        rib.position.set(0, 0.028, z); group.add(rib);
      }
      group.userData.cellMat = cellMat;

      // Emitter barrel — shroud + glowing coil rings + muzzle ring + lens.
      const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.03, 0.13), accentMat);
      shroud.position.set(0, 0.008, -0.165); group.add(shroud);
      for (const z of [-0.13, -0.165, -0.2]) {
        const coil = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0032, 6, 16), cellMat);
        coil.position.set(0, 0.008, z); group.add(coil);
      }
      const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.016, 0.02, 14), bodyMat);
      muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, 0.008, -0.232); group.add(muzzle);
      const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 14), cellMat);
      emitter.rotation.x = Math.PI / 2; emitter.position.set(0, 0.008, -0.241); group.add(emitter);

      // Skeleton stock — twin rails + a cheek piece + a recoil pad.
      for (const yy of [0.006, -0.018]) {
        const rail2 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.1), bodyMat);
        rail2.position.set(0, yy, 0.06); group.add(rail2);
      }
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, 0.06), accentMat);
      cheek.position.set(0, 0.012, 0.055); group.add(cheek);
      const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.056, 0.014), darkMat);
      stockPad.position.set(0, -0.006, 0.108); group.add(stockPad);

      // Grip subgroup + trigger guard loop + trigger.
      const gripG = new THREE.Group();
      gripG.position.set(0, -0.058, -0.012); gripG.rotation.x = -0.32;
      gripG.add(new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.086, 0.032), gripMat));
      for (let i = 0; i < 3; i++) {
        const groove = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.005, 0.034), darkMat);
        groove.position.set(0, 0.022 - i * 0.02, 0.004); gripG.add(groove);
      }
      group.add(gripG);
      const guard = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.003, 6, 16), bodyMat);
      guard.rotation.y = Math.PI / 2; guard.position.set(0, -0.028, -0.03); group.add(guard);
      const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.016, 0.005), accentMat);
      trigger.position.set(0, -0.026, -0.028); trigger.rotation.x = 0.2; group.add(trigger);

      // ── Scavenger repairs (ACAD) — this thing's been kept running with junk. ──
      // Mismatched riveted scrap patch welded over the receiver side.
      const patch = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.034, 0.05), patchMat);
      patch.position.set(0.026, 0.004, -0.05); group.add(patch);
      for (const [py, pz] of [[0.013, -0.068], [0.013, -0.032], [-0.012, -0.068], [-0.012, -0.032]] as const) {
        const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.0026, 0.006, 6), accentMat);
        rivet.rotation.z = Math.PI / 2; rivet.position.set(0.028, py, pz); group.add(rivet);
      }
      // Grimy cable wrapped around the emitter shroud (a coil of cable).
      for (const z of [-0.12, -0.142, -0.188]) {
        const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.0035, 6, 14), wireMat);
        wrap.position.set(0, 0.008, z); group.add(wrap);
      }
      // Exposed wiring running from the cell down into the receiver.
      for (const [x, col] of [[-0.006, copperMat], [0.004, wireMat]] as const) {
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.05, 5), col);
        wire.rotation.x = 0.9; wire.position.set(x, 0.018, -0.005); group.add(wire);
      }
      // Hose-clamp band cinching the barrel to the receiver.
      const clampBand = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0028, 6, 16), accentMat);
      clampBand.rotation.y = Math.PI / 2; clampBand.position.set(0, 0.008, -0.108); group.add(clampBand);
      // A couple of tape bands on the grip.
      for (const gy of [0.0, -0.03]) {
        const tape = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.008, 0.034), wireMat);
        tape.position.set(0, gy, 0.003); gripG.add(tape);
      }

      group.rotation.set(-0.08, 0.02, 0.1);
      return group;
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('rect', { x: '3', y: '9', width: '15', height: '4' }));    // body/barrel
      s.appendChild(svgEl('rect', { x: '8', y: '6', width: '5', height: '3' }));      // cell
      s.appendChild(svgEl('rect', { x: '7', y: '13', width: '5', height: '7' }));     // grip
      s.appendChild(svgEl('line', { x1: '18', y1: '11', x2: '22', y2: '11' }));       // muzzle
      return s;
    },
    updateHeld(itemRoot, slot, ctx, dt) {
      if (!slot.meta) slot.meta = {};
      const max = Tuning.WEAPON_PULSE_RIFLE_CELL_MAX;
      if (slot.meta.ammoRemaining === undefined) slot.meta.ammoRemaining = max;
      // Recharge the cell after a delay since the last pulse.
      const lastFire = slot.meta.lastFireAt ?? -999;
      const sinceFire = ctx.time.elapsed - lastFire;
      if (sinceFire > Tuning.WEAPON_PULSE_RIFLE_RECHARGE_DELAY_S && slot.meta.ammoRemaining < max) {
        slot.meta.ammoRemaining = Math.min(
          max, slot.meta.ammoRemaining + Tuning.WEAPON_PULSE_RIFLE_RECHARGE_PER_S * dt);
      }
      // Drive the glow: brightness tracks cell charge; a quick white flash per pulse.
      const cellMat = itemRoot.userData.cellMat as THREE.MeshBasicMaterial | undefined;
      if (!cellMat) return;
      const charge = Math.max(0, Math.min(1, slot.meta.ammoRemaining / max));
      const flash = Math.max(0, 1 - sinceFire / 0.07);
      cellMat.color.setRGB(
        0.06 + charge * 0.16 + flash * 0.9,
        0.36 + charge * 0.55 + flash * 0.9,   // cyan-green energy
        0.28 + charge * 0.45 + flash * 0.9,
      );
    },
    playUseAnim(itemRoot, t) {
      // Quick light recoil flick (rapid cadence — small kick).
      const kick = t < 0.4 ? easeOutBack(t / 0.4) : 1 - easeOutQuad((t - 0.4) / 0.6);
      itemRoot.position.set(0.004 * kick, 0.01 * kick, 0.045 * kick);
      itemRoot.rotation.set(-0.12 * kick, 0.02 * kick, 0.1);
    },
    useAnimDuration: Tuning.VIEWMODEL_PULSE_RIFLE_ANIM_S,
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
      // ACZ — detail pass: a cut chunk of cactus — pale wet flesh core, a waxy
      // green skin cap on the outer face, exposed vertical fiber ribs on the cut
      // face, and a couple of spine clusters.
      const fleshMat = new THREE.MeshLambertMaterial({ color: 0x8aa868, flatShading: true });
      const skinMat = new THREE.MeshLambertMaterial({ color: 0x3a5a2a, flatShading: true });
      const fiberMat = new THREE.MeshLambertMaterial({ color: 0xc0cda0 });
      const spineMat = new THREE.MeshLambertMaterial({ color: 0xd8c89a });

      const flesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.046, 0), fleshMat);
      flesh.scale.set(1.2, 0.85, 1.0); flesh.rotation.set(0.2, 0.3, 0.1); group.add(flesh);
      // Waxy skin cap on the outer (top) face.
      const skin = new THREE.Mesh(
        new THREE.SphereGeometry(0.047, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), skinMat);
      skin.scale.set(1.18, 0.55, 1.0); skin.position.y = 0.013; group.add(skin);
      // Exposed fiber ribs on the cut face.
      for (let i = 0; i < 5; i++) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.0026, 0.052, 0.0026), fiberMat);
        f.position.set((i - 2) * 0.012, -0.006, 0.03); f.rotation.x = 0.22; group.add(f);
      }
      // Spine clusters on the skin.
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1;
        const spine = new THREE.Mesh(new THREE.ConeGeometry(0.0022, 0.014, 4), spineMat);
        spine.position.set(Math.cos(a) * 0.026, 0.03, Math.sin(a) * 0.018);
        spine.rotation.set(0.3, 0, a); group.add(spine);
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
      const charMat = vmMetal(0x1e2418, { wornScale: 9.0, scratchStrength: 0.04 });
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

  // ACR — desert shrew meat (mirror the lizard-meat pair). Raw drops when a
  // shrew is killed (damageShrew → 'take'); cooks on a fire via COOK_MAP.
  raw_shrew_meat: {
    id: 'raw_shrew_meat',
    name: 'DEAD SHREW',
    glyph: 'ʂ',
    description: 'a limp desert shrew — small, but meat is meat',
    stackable: true,
    maxStack: 4,
    onUse(ctx, _slot) {
      ctx.stats.hunger = Math.min(1, ctx.stats.hunger + 0.10);
      ctx.stats.health = Math.max(0, ctx.stats.health - 0.05);
      return { consumed: true, message: 'raw meat — you gag a little' };
    },
    makeViewModel() {
      // ACW D9 — was MISSING (rendered nothing in hand). Mirror raw_lizard_meat:
      // show the actual shrew mesh held dangling upside-down by the tail.
      const group = new THREE.Group();
      const shrew = makeShrewVisual();
      shrew.scale.setScalar(1.1);                          // shrew is smaller than the lizard
      shrew.rotation.set(Math.PI * 0.05, 0.4, Math.PI);    // upside-down dangle, slight yaw
      group.add(shrew);
      return group;
    },
    makeIcon() {
      const s = svg();
      // Limp shrew silhouette held by the tail: plump body + big ear + long tail.
      s.appendChild(svgEl('ellipse', { cx: '13', cy: '13', rx: '5', ry: '3' }));   // body
      s.appendChild(svgEl('circle', { cx: '18', cy: '12', r: '2' }));              // head
      s.appendChild(svgEl('ellipse', { cx: '17', cy: '9.5', rx: '1.4', ry: '2' })); // ear
      s.appendChild(svgEl('path', { d: 'M8 13 Q4 13 3 16' }));                     // long tail
      s.appendChild(svgEl('line', { x1: '17.4', y1: '11.4', x2: '18.4', y2: '12.4', 'stroke-width': '1' }));
      s.appendChild(svgEl('line', { x1: '18.4', y1: '11.4', x2: '17.4', y2: '12.4', 'stroke-width': '1' }));
      return s;
    },
  },

  cooked_shrew_meat: {
    id: 'cooked_shrew_meat',
    name: 'COOKED SHREW',
    glyph: '≈',
    description: 'a small shrew, charred over a fire',
    stackable: true,
    maxStack: 4,
    onUse(ctx, _slot) {
      ctx.stats.hunger = Math.min(1, ctx.stats.hunger + 0.28);
      return { consumed: true, message: 'stringy, but it fills you a little' };
    },
    makeViewModel() {
      // ACW D9 — was MISSING. Small charred-meat composite (mirror
      // cooked_lizard_meat, scaled down — a shrew is a mouthful): 2 layered
      // cuts (char + cooked interior) on a little bone shard.
      const group = new THREE.Group();
      const charMat = vmMetal(0x2a1408, { wornScale: 10.0, scratchStrength: 0.05 });
      const interiorMat = new THREE.MeshLambertMaterial({ color: 0x7a3a22 });
      const boneMat = vmBone(0xcab8a0, { crackDensity: 0.5 });
      for (let i = 0; i < 2; i++) {
        const useChar = i % 2 === 0;
        const slice = new THREE.Mesh(
          new THREE.BoxGeometry(0.06 - i * 0.004, 0.010, 0.042 - i * 0.003),
          useChar ? charMat : interiorMat,
        );
        slice.position.set(0, -0.003 + i * 0.010, 0);
        slice.rotation.set(0.1, 0.4, 0.05);
        group.add(slice);
      }
      const bone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.005, 0.034, 5),
        boneMat,
      );
      bone.position.set(-0.028, 0.004, 0.008);
      bone.rotation.set(0, 0.4, Math.PI / 2);
      group.add(bone);
      return group;
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('polygon', { points: '6,12 9,8 15,9 18,12 16,16 11,17 7,15' }));
      s.appendChild(svgEl('line', { x1: '10', y1: '12', x2: '15', y2: '13', 'stroke-width': '1' }));
      s.appendChild(svgEl('path', { d: 'M9 5 Q10 3 11 5', 'stroke-width': '1' }));
      return s;
    },
  },

  raw_vulture_meat: {
    id: 'raw_vulture_meat',
    name: 'DEAD VULTURE',
    glyph: 'V',
    description: 'a shot-down scavenger — dark, gamey meat',
    stackable: true,
    maxStack: 4,
    onUse(ctx, _slot) {
      ctx.stats.hunger = Math.min(1, ctx.stats.hunger + 0.16);
      ctx.stats.health = Math.max(0, ctx.stats.health - 0.06);   // raw carrion-bird — rougher than shrew
      return { consumed: true, message: 'raw vulture — foul, but food' };
    },
    makeViewModel() {
      // Held dangling by a wing — the actual vulture mesh, scaled down + inverted.
      const group = new THREE.Group();
      const bird = makeVultureVisual();
      bird.scale.setScalar(0.6);
      bird.rotation.set(Math.PI * 0.95, 0.5, 0.2);   // hung limp, head down
      bird.position.set(0, 0.05, 0);
      group.add(bird);
      return group;
    },
    makeIcon() {
      const s = svg();
      // limp bird: body + drooping head + hanging wing
      s.appendChild(svgEl('ellipse', { cx: '12', cy: '11', rx: '5', ry: '3.5' }));
      s.appendChild(svgEl('path', { d: 'M16 12 Q19 14 18 17' }));            // drooping neck/head
      s.appendChild(svgEl('circle', { cx: '18', cy: '17.5', r: '1.6' }));    // head
      s.appendChild(svgEl('path', { d: 'M9 13 Q6 17 8 19' }));               // hanging wing
      return s;
    },
  },

  cooked_vulture_meat: {
    id: 'cooked_vulture_meat',
    name: 'COOKED VULTURE',
    glyph: '≋',
    description: 'a dark bird, roasted — gamey but filling',
    stackable: true,
    maxStack: 4,
    onUse(ctx, _slot) {
      ctx.stats.hunger = Math.min(1, ctx.stats.hunger + 0.40);   // a whole bird — substantial
      return { consumed: true, message: 'gamey, dark, but it fills you up' };
    },
    makeViewModel() {
      // A roasted-bird composite — a plump charred body + a drumstick + a bone.
      const group = new THREE.Group();
      const charMat = vmMetal(0x33180a, { wornScale: 9.0, scratchStrength: 0.05, rustLevel: 0 });
      const interiorMat = new THREE.MeshLambertMaterial({ color: 0x7a3a22 });
      const boneMat = vmBone(0xcab8a0, { crackDensity: 0.5 });
      const bodyM = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), charMat);
      bodyM.scale.set(1.4, 0.9, 1.0);
      group.add(bodyM);
      const cut = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), interiorMat);
      cut.position.set(0.03, 0.012, 0.02);
      group.add(cut);
      // drumstick (leg) sticking out
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.05, 6), charMat);
      leg.position.set(-0.05, 0.0, 0.025);
      leg.rotation.set(0, 0, 0.9);
      group.add(leg);
      const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.03, 5), boneMat);
      bone.position.set(-0.075, -0.01, 0.025);
      bone.rotation.set(0, 0, 0.9);
      group.add(bone);
      return group;
    },
    makeIcon() {
      const s = svg();
      s.appendChild(svgEl('polygon', { points: '6,12 9,7 15,8 18,12 16,17 10,18 7,15' }));
      s.appendChild(svgEl('line', { x1: '5', y1: '15', x2: '8', y2: '13', 'stroke-width': '1.2' }));  // drumstick bone
      s.appendChild(svgEl('line', { x1: '10', y1: '12', x2: '15', y2: '13', 'stroke-width': '1' }));
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
      const charMat = vmMetal(0x2a1408, { wornScale: 10.0, scratchStrength: 0.05 });
      const interiorMat = new THREE.MeshLambertMaterial({ color: 0x7a3a22 });
      const boneMat = vmBone(0xcab8a0, { crackDensity: 0.5 });
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
      // ACZ — detail pass: a heavy, lumpy slab of pale worm-flesh — a darker
      // raw membrane on top, exposed fiber striations on the cut face, and a
      // couple of glistening wet ooze patches.
      const fleshMat = new THREE.MeshLambertMaterial({ color: 0xc2a890, flatShading: true });
      const membraneMat = new THREE.MeshLambertMaterial({ color: 0x9a7a64, flatShading: true });
      const fiberMat = new THREE.MeshLambertMaterial({ color: 0xd8c4ac });
      const oozeMat = new THREE.MeshLambertMaterial({ color: 0x7a4438, emissive: 0x180806, emissiveIntensity: 0.3 });

      const slab = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 1), fleshMat);
      slab.scale.set(1.5, 0.5, 1.0); slab.rotation.set(0.1, 0.4, 0.05); group.add(slab);
      // Raw membrane patch draped over the top.
      const membrane = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 1), membraneMat);
      membrane.scale.set(1.5, 0.18, 1.0); membrane.position.set(0.004, 0.02, 0); membrane.rotation.set(0.1, 0.4, 0.05); group.add(membrane);
      // Exposed fiber striations across the cut face.
      for (let i = 0; i < 5; i++) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.0022, 0.0022), fiberMat);
        f.position.set(0, -0.004 + (i - 2) * 0.006, 0.03); f.rotation.set(0.1, 0.4, 0.05); group.add(f);
      }
      // Glistening wet ooze patches.
      for (const [x, y, z] of [[0.02, 0.014, 0.02], [-0.03, 0.008, -0.015]] as const) {
        const ooze = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), oozeMat);
        ooze.scale.set(1.4, 0.4, 1.1); ooze.position.set(x, y, z); group.add(ooze);
      }
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

  worm_lure: {
    id: 'worm_lure',
    name: 'WORM-LURE',
    glyph: '◈',
    description: 'a staked scent-gland on bone spikes — plant it to CALL the deep. the worm homes on it from afar + surfaces to feed (when it can be struck)',
    stackable: true,
    maxStack: 4,
    onUse(ctx, _slot) {
      // Plant the lure ~4m ahead of the player (on the ground) as a pickup the worm homes on
      // (it's in the meatItems set with a long scent range). Static placement so it stays put;
      // recoverable until the worm feeds on it (which consumes it via the feeding loop).
      const cam = ctx.three.camera;
      const fwd = new THREE.Vector3();
      cam.getWorldDirection(fwd); fwd.y = 0;
      if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
      fwd.normalize();
      const fx = cam.position.x + fwd.x * 4;
      const fz = cam.position.z + fwd.z * 4;
      const p = spawnDroppedPickup(ctx.three.scene, ctx.terrain, { x: fx, z: fz }, 'worm_lure');
      ctx.pickups.list.push(p);
      return { consumed: true, message: 'lure planted — it calls the deep' };
    },
    makeViewModel() {
      const g = new THREE.Group();
      // C18 gate r2: desaturated DRIED-BLOOD gland (the bright red read cartoonish vs the muted palette),
      // a LUMPY/CLOTTED organic mass (not a clean sphere), a bigger/higher bone CROWN + a clear collar.
      const woodMat = new THREE.MeshLambertMaterial({ color: 0x4f3c28, flatShading: true });          // drier, darker wood
      const glandMat = new THREE.MeshLambertMaterial({ color: 0x361c16, flatShading: true });   // r4: dried-blood, NO emissive (the glow read as a hot orange-red); value-matched toward the wood
      const clotMat = new THREE.MeshLambertMaterial({ color: 0x281310, flatShading: true });          // dark clotting/mottle
      const boneMat = new THREE.MeshLambertMaterial({ color: 0xcdc3aa, flatShading: true });          // r3: the lightest values in frame
      // Stake driven into the ground (the held model is shown tip-down).
      const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.022, 0.24, 6), woodMat);
      stake.position.y = -0.07; g.add(stake);
      // Scent-gland: a ROUNDED irregular lumpy mass (r3: subdiv-2 ico, not a faceted peak that read as a roof) —
      // a main blob + a couple of fused sub-lumps so the silhouette sags organically, not a clean sphere.
      const gland = new THREE.Mesh(new THREE.IcosahedronGeometry(0.046, 2), glandMat);
      gland.scale.set(1.12, 0.92, 1.05); gland.rotation.set(0.3, 0.5, 0.1); gland.position.y = 0.072; g.add(gland);
      for (const [sx, sy, sz, r] of [[0.028, 0.084, 0.012, 0.026], [-0.026, 0.06, 0.02, 0.022]] as const) {
        const lump = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), glandMat);
        lump.scale.set(1.1, 0.95, 1.0); lump.position.set(sx, sy, sz); g.add(lump);
      }
      // Dark clots / dried-fluid mottle break up the surface (reads as cured tissue, not painted plastic).
      for (const [cx, cy, cz] of [[0.022, 0.092, 0.028], [-0.03, 0.066, -0.012], [0.008, 0.05, -0.03]] as const) {
        const clot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.013, 1), clotMat);
        clot.scale.set(1.3, 0.5, 1.2); clot.position.set(cx, cy, cz); g.add(clot);
      }
      // Bone CROWN — THICK barbs (rule 7) in a clean radial ring, each canted UP + OUTWARD (no drooping) so
      // they read as a cage of barbs encircling the gland, rooted at the collar.
      const _up = new THREE.Vector3(0, 1, 0);
      const _dir = new THREE.Vector3();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.019, 0.085, 5), boneMat);   // ~3.8cm base — holds volume edge-on
        spike.position.set(Math.cos(a) * 0.05, 0.07, Math.sin(a) * 0.05);
        _dir.set(Math.cos(a) * 0.6, 1, Math.sin(a) * 0.6).normalize();   // up + outward, uniform
        spike.quaternion.setFromUnitVectors(_up, _dir);
        g.add(spike);
      }
      // Clear bone COLLAR band where the gland is lashed to the stake (overhangs the stake top).
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.032, 0.03, 8), boneMat);
      collar.position.y = 0.026; g.add(collar);
      return g;
    },
    makeIcon() {
      const s = svg();
      // staked lure: a vertical stake + a round gland + splayed spikes
      s.appendChild(svgEl('line', { x1: '12', y1: '21', x2: '12', y2: '11', 'stroke-width': '2' }));
      s.appendChild(svgEl('circle', { cx: '12', cy: '8', r: '3.5' }));
      s.appendChild(svgEl('line', { x1: '12', y1: '8', x2: '6', y2: '4', 'stroke-width': '1' }));
      s.appendChild(svgEl('line', { x1: '12', y1: '8', x2: '18', y2: '4', 'stroke-width': '1' }));
      s.appendChild(svgEl('line', { x1: '12', y1: '8', x2: '12', y2: '3', 'stroke-width': '1' }));
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
      const crustMat = vmMetal(0x2e1810, { wornScale: 8.0, scratchStrength: 0.04 });
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
      // ACAA — shared branch model (matches the world pickups under dead
      // trees). Clean tapered stick + a couple of twigs; no splinter bristles
      // or knot bumps (those read as weird clutter). vmWood for the held item.
      // ACAE — dark aged-wood grain (matches the dead trees + ground branches).
      // ACAF follow-up — uses the SHARED BRANCH_WOOD_COLOR/WEATHER_LEVEL so the
      // held branch is the EXACT same color as the world ones; the vm scene now
      // mirrors world lighting (viewModel.ts) so they read identical.
      const mat = vmWood(BRANCH_WOOD_COLOR, {
        grainAxis: Math.PI / 2.4,     // grain runs along the shaft
        ringDensity: 12.0,            // tight rings → small-diameter branch
        weatherLevel: BRANCH_WEATHER_LEVEL,   // sun-cracked deadwood
      });
      const group = buildBranchMesh(mat, { len: 0.34, twigs: 3 });
      group.rotation.set(0, 0, -0.22);   // gentle diagonal lean for the FP read
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
      // ACAS B1 — soft DRAPED folds (was a rigid 3-tier slab stack that read as a
      // stepped pyramid). Each layer is a subdivided slab whose top sags toward the
      // corners + a faint weave-wave, with the underside edges curling up — so it
      // reads as folded fabric, not stacked chips. A rolled hem + frayed tag finish it.
      const fold = (w: number, h: number, d: number, m: THREE.Material, yBase: number, sag: number): THREE.Mesh => {
        const g = new THREE.BoxGeometry(w, h, d, 8, 1, 6);
        const p = g.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          const edge = Math.max(Math.abs(x) / (w * 0.5), Math.abs(z) / (d * 0.5));
          if (y > 0) p.setY(i, y - sag * edge * edge + Math.sin(x * 55 + z * 40) * h * 0.14);
          else p.setY(i, y + sag * 0.3 * edge * edge);
        }
        g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, m);
        mesh.position.y = yBase;
        mesh.rotation.y = ((yBase * 7) % 0.3) - 0.15;   // slight per-layer twist (deterministic)
        return mesh;
      };
      group.add(fold(0.115, 0.026, 0.090, mat, 0.0, 0.013));
      group.add(fold(0.098, 0.020, 0.074, matInner, 0.022, 0.011));
      group.add(fold(0.082, 0.016, 0.060, matInnermost, 0.040, 0.009));
      // Rolled hem along the front folded edge of the bottom layer.
      const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.106, 7), mat);
      hem.rotation.z = Math.PI / 2;
      hem.position.set(0, 0.005, 0.046);
      group.add(hem);
      // Frayed fabric "tag" sticking out one side — adds asymmetry.
      const tag = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.007, 0.024, 3, 1, 2), matInner);
      tag.position.set(0.062, 0.019, 0);
      tag.rotation.z = -0.22;
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
      const woodMat = vmWood(0x6a4a2a, {
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
      const strikerMat = vmMetal(0x9aa0a8, { wornScale: 12.0 });
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

  // M6 (C37) — signal flare: signal_kit's "call out" half of the fire_kit
  // recipe collision. LMB fires a transient bright flare skyward (no fire, no
  // placeable, no save state — see world/signalFlare.ts). A genuine either/or
  // against fire_kit's "warm yourself".
  signal_kit: {
    id: 'signal_kit',
    name: 'SIGNAL FLARE',
    glyph: '✺',
    description: 'a scrap tube packed to burn bright — fire it skyward to call out',
    stackable: true,
    maxStack: 4,
    wieldLmb: 'place',        // single LMB-click fires it (deploy-style dispatch); ghost ring exempted in ghostPreview
    thirdPersonScale: 1.3,    // small cartridge — bump for the 3P silhouette (matches fire_kit-class kits)
    onUse(ctx, _slot) {
      fireSignalFlare(ctx);
      playSignalFlare();
      return { consumed: true, message: 'signal flare fired' };
    },
    makeViewModel() {
      // A short scrap-metal flare tube: rusted body, a dark cap at the base,
      // a bright charge tip, and a striker tab — reads as an improvised flare.
      const group = new THREE.Group();
      const bodyMat = vmMetal(0x8a5230, { rustLevel: 0.5, wornScale: 11.0 });   // rusty scrap brass
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.13, 10), bodyMat);
      body.rotation.z = Math.PI / 2;   // lie it along the hand (X axis)
      group.add(body);
      // Dark base cap.
      const capMat = vmMetal(0x3a3330, { rustLevel: 0.4 });
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.018, 10), capMat);
      cap.rotation.z = Math.PI / 2;
      cap.position.x = -0.066;
      group.add(cap);
      // Bright charge tip — a self-luminous nub at the firing end.
      const tipMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false });
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.022, 10), tipMat);
      tip.rotation.z = Math.PI / 2;
      tip.position.x = 0.072;
      group.add(tip);
      // Striker tab on the side.
      const tabMat = vmMetal(0x9aa0a8, { wornScale: 12.0 });
      const tab = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.012), tabMat);
      tab.position.set(0.01, 0.022, 0);
      tab.rotation.z = 0.25;
      group.add(tab);
      return group;
    },
    makeIcon() {
      const s = svg();
      // Flare tube angled up + radiating spark lines (a "going off" burst).
      s.appendChild(svgEl('rect', { x: '6', y: '13', width: '9', height: '4', rx: '1', transform: 'rotate(-35 10 15)' }));
      // Burst at the tip.
      s.appendChild(svgEl('circle', { cx: '16', cy: '8', r: '1.6', fill: 'currentColor', stroke: 'none' }));
      for (const a of [-60, -30, 0, 30]) {
        const rad = (a * Math.PI) / 180;
        s.appendChild(svgEl('line', {
          x1: String(16 + Math.cos(rad) * 2.6), y1: String(8 + Math.sin(rad) * 2.6),
          x2: String(16 + Math.cos(rad) * 5), y2: String(8 + Math.sin(rad) * 5),
          'stroke-width': '1.2',
        }));
      }
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
      // ACZ — deep-detail: a real framed cooking grate — perimeter frame +
      // parallel grate bars (one rust-caked from use) + 4 short folding legs so
      // it reads as something you set OVER a fire + a dangling attach chain.
      const group = new THREE.Group();
      const ironMat = vmMetal(0x3a342a, { wornScale: 10.0, scratchStrength: 0.08 });
      const rustyMat = vmMetal(0x5a2a18, { wornScale: 10.0, scratchStrength: 0.12 });
      const W = 0.19, D = 0.12;

      // Perimeter frame — 2 side rails (along X) + 2 end rails (along Z).
      for (const sz of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, W, 8), ironMat);
        rail.rotation.z = Math.PI / 2; rail.position.set(0, 0, sz * D / 2); group.add(rail);
      }
      for (const sx of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, D, 8), ironMat);
        rail.rotation.x = Math.PI / 2; rail.position.set(sx * W / 2, 0, 0); group.add(rail);
      }
      // Grate bars spanning the depth, spaced along the width (one rusty).
      const n = 6;
      for (let k = 0; k < n; k++) {
        const x = (k / (n - 1) - 0.5) * W * 0.92;
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, D * 0.96, 6), k === 2 ? rustyMat : ironMat);
        bar.rotation.x = Math.PI / 2; bar.position.set(x, 0, 0); group.add(bar);
      }
      // Four short folding legs angled down-out at the corners.
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.005, 0.05, 6), ironMat);
        leg.position.set(sx * W * 0.44, -0.024, sz * D * 0.42);
        leg.rotation.set(sz * 0.3, 0, -sx * 0.3); group.add(leg);
      }
      // Dangling attach chain from one corner.
      for (let i = 0; i < 3; i++) {
        const link = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0018, 4, 8), ironMat);
        link.position.set(W * 0.46, 0.0 - i * 0.009, D * 0.46);
        link.rotation.x = (i % 2) * Math.PI / 2; group.add(link);
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
      // ACZ — detail pass: a smoother bulbous teal fruit with bioluminescent
      // glow PODS (always-on MeshBasic nodes), darker mottle spots, and a woody
      // stem + sepal calyx at the top. Reads organic + alien, not plastic.
      const bodyMat = new THREE.MeshLambertMaterial({
        color: 0x2a8a8a, emissive: 0x0c3030, emissiveIntensity: 0.7, flatShading: false,
      });
      const spotMat = new THREE.MeshLambertMaterial({ color: 0x0e3434, flatShading: true });
      const podMat = new THREE.MeshBasicMaterial({ color: 0x6fe6dc, toneMapped: false, fog: false });
      const stemMat = new THREE.MeshLambertMaterial({ color: 0x4a3a26 });
      const sepalMat = new THREE.MeshLambertMaterial({ color: 0x1f6a52, flatShading: true });

      const fruit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 2), bodyMat);
      fruit.scale.set(1, 1.12, 0.95); group.add(fruit);

      // Bioluminescent glow pods scattered on the surface.
      for (let i = 0; i < 6; i++) {
        const a = i * 2.39, yy = (i / 5 - 0.5) * 0.1;
        const pod = new THREE.Mesh(new THREE.SphereGeometry(0.008 + (i % 2) * 0.003, 8, 6), podMat);
        pod.position.set(Math.cos(a) * 0.063, yy, Math.sin(a) * 0.06); group.add(pod);
      }
      // Darker mottle spots.
      for (const [x, y, z] of [[0.045, 0.02, 0.04], [-0.04, 0.04, 0.038], [0.012, -0.045, 0.05], [-0.03, -0.03, 0.045]] as const) {
        const spot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.013, 0), spotMat);
        spot.position.set(x, y, z); spot.scale.set(1, 0.6, 1); group.add(spot);
      }
      // Woody stem + sepal calyx at the top.
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.008, 0.025, 8), stemMat);
      stem.position.y = 0.085; group.add(stem);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const sepal = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 4), sepalMat);
        sepal.position.set(Math.cos(a) * 0.018, 0.074, Math.sin(a) * 0.018);
        sepal.rotation.set(Math.PI * 0.62, 0, -a); group.add(sepal);
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
      // ACY — deep-detail rebuild: a real branch (wood grain + knot + side nub)
      // with overlapping rag wrap layers lashed by binding cords and a charred
      // pitch-soaked head. Flame cone + PointLight keep their names for updateHeld.
      const shaftMat = vmWood(0x5a3c22, { ringDensity: 7.0, weatherLevel: 0.5 });
      const ragMat = createFabricMaterial(0x6a4a30, undefined, { disableShimmer: true });
      const charMat = createFabricMaterial(0x241a12, undefined, { disableShimmer: true });
      const cordMat = new THREE.MeshLambertMaterial({ color: 0x2a2018 });

      // Branch shaft + knot bump + a broken side nub.
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.023, 0.34, 8), shaftMat);
      shaft.position.y = -0.04; group.add(shaft);
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), shaftMat);
      knot.position.set(0.005, -0.10, 0); knot.scale.set(1, 0.7, 1); group.add(knot);
      const nub = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.04, 5), shaftMat);
      nub.position.set(0.022, -0.145, 0); nub.rotation.z = 0.9; group.add(nub);

      // Rag-wrapped head — overlapping layers, top two charred.
      for (let i = 0; i < 4; i++) {
        const r = 0.041 + i * 0.0015;
        const wrap = new THREE.Mesh(new THREE.CylinderGeometry(r, r - 0.006, 0.032, 10), i >= 2 ? charMat : ragMat);
        wrap.position.y = 0.105 + i * 0.027; wrap.rotation.y = i * 0.6; group.add(wrap);
      }
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), charMat);
      head.position.y = 0.215; head.scale.y = 0.82; group.add(head);
      // Binding cords lashing the rags to the stick.
      for (const y of [0.098, 0.155]) {
        const cord = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.0042, 6, 16), cordMat);
        cord.rotation.x = Math.PI / 2; cord.position.y = y; group.add(cord);
      }

      // ACAA — REAL fire: a layered flickering flame (deep-orange outer →
      // hot-white core) plus rising ember sparks, all additive so they glow.
      // Lives in a group named 'torchFlame'; updateHeld shows it ONLY when lit
      // and animates the flicker + embers. (Replaces the static yellow cone.)
      const flameGroup = new THREE.Group();
      flameGroup.name = 'torchFlame';
      flameGroup.position.y = 0.235;
      flameGroup.visible = false;
      // Nested flame cones — outer to hot core.
      const flameLayers: Array<[number, number, number, number]> = [
        [0.06, 0.22, 0.0, 0xff4214],   // outer deep orange
        [0.043, 0.18, 0.02, 0xff8a2a], // mid orange
        [0.026, 0.135, 0.04, 0xffd060],// inner yellow
        [0.013, 0.09, 0.06, 0xfff4cc], // hot white-yellow core
      ];
      for (const [r, h, yo, col] of flameLayers) {
        const m = new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.7, toneMapped: false, fog: false,
          depthWrite: false, blending: THREE.AdditiveBlending,
        });
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), m);
        cone.position.y = h * 0.5 + yo;
        cone.userData.flameLayer = true;
        flameGroup.add(cone);
      }
      // Ember sparks — tiny additive flecks that rise from the flame + fade.
      for (let i = 0; i < 7; i++) {
        const em = new THREE.Mesh(
          new THREE.ConeGeometry(0.006, 0.013, 4),
          new THREE.MeshBasicMaterial({
            color: 0xffb24a, transparent: true, opacity: 0.0, toneMapped: false,
            fog: false, depthWrite: false, blending: THREE.AdditiveBlending,
          }));
        em.userData.ember = {
          phase: i / 7,
          speed: 0.6 + (i % 3) * 0.2,
          sx: (i % 2 ? 1 : -1) * (0.02 + (i % 3) * 0.006),
          sz: ((i % 3) - 1) * 0.016,
        };
        flameGroup.add(em);
      }
      group.add(flameGroup);
      // NOTE: the world-illuminating PointLight is NOT here — it lives in the
      // world scene (vm.heldPointLight) and is driven by updateHeld. A light
      // parented here would sit in the isolated viewmodel scene (D170) and only
      // light the held item, not the world (ACAB fix).
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
      // ACAB — the world-illuminating light is vm.heldPointLight (in the world
      // scene), zeroed each frame by updateViewModel; we re-arm + position it
      // here. The flame VISUAL stays in the viewmodel scene.
      const light = ctx.player.viewModel?.heldPointLight ?? null;
      const flameGroup = itemRoot.getObjectByName('torchFlame') as THREE.Group | null;
      if (!slot.meta) slot.meta = { lit: false, burnRemaining: 1 };
      const lit = !!slot.meta.lit;
      if (!flameGroup) return;
      if (!lit) { flameGroup.visible = false; return; }   // light already zeroed
      // Drain burnRemaining; auto-consume on burn-out.
      const remaining = (slot.meta.burnRemaining ?? 1) - dt / Tuning.TORCH_BURN_DURATION_S;
      if (remaining <= 0) {
        slot.meta.lit = false;
        slot.meta.burnRemaining = 0;
        slot.item = null;
        slot.count = 0;
        slot.meta = undefined;
        flameGroup.visible = false;
        ctx.ui.showToast('the torch burns out');
        return;
      }
      slot.meta.burnRemaining = remaining;
      flameGroup.visible = true;
      // Flicker — two desynced sines for organic feel.
      const t = ctx.time.elapsed;
      const wobble = Math.sin(t * 17.3) * 0.5 + Math.sin(t * 23.7) * 0.5;
      // Drive the WORLD light: position it at the flame's world location.
      if (light) {
        light.color.setHex(Tuning.TORCH_LIGHT_COLOR_HEX);
        light.distance = Tuning.TORCH_LIGHT_DISTANCE;
        light.intensity = Tuning.TORCH_LIGHT_INTENSITY + wobble * Tuning.TORCH_LIGHT_FLICKER_AMP;
        flameGroup.updateWorldMatrix(true, false);
        flameGroup.getWorldPosition(light.position);
      }
      // Whole-flame flicker: vertical stretch + a little lateral lick.
      flameGroup.scale.set(1 + wobble * 0.06, 1 + wobble * 0.22, 1 + wobble * 0.06);
      flameGroup.rotation.z = wobble * 0.11;
      flameGroup.position.x = wobble * 0.006;
      // Per-element animation: cone opacity shimmer + rising/fading embers.
      for (const child of flameGroup.children) {
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        if (child.userData.flameLayer) {
          mat.opacity = 0.6 + (Math.sin(t * 19 + child.position.y * 42) * 0.5 + 0.5) * 0.3;
        } else if (child.userData.ember) {
          const e = child.userData.ember as { phase: number; speed: number; sx: number; sz: number };
          const p = (t * e.speed + e.phase) % 1;                 // 0→1 rise cycle
          child.position.set(
            e.sx * p + Math.sin(t * 8 + e.phase * 10) * 0.004,
            0.1 + p * 0.2,                                        // rise from the flame top
            e.sz * p,
          );
          mat.opacity = (1 - p) * 0.9 * Math.min(1, p / 0.06);   // fade in fast, fade out as it rises
          const s = 0.5 + (1 - p) * 0.7;
          child.scale.set(s, s, s);
        }
      }
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
      // ACY — deep-detail rebuild: a salvaged hand-light as a forward-pointing
      // tube (beam along -Z): machined body + knurled grip rings, flared bezel
      // head with an interior reflector behind the lens, and a tail cap with a
      // push button. Lens + SpotLight keep their names for updateHeld.
      const bodyMat = vmMetal(0x3a3630, { wornScale: 8.0 });
      const headMat = vmMetal(0x4a463e, { wornScale: 7.0 });
      const knurlMat = vmMetal(0x22201c, { wornScale: 11.0 });
      const reflMat = vmMetal(0xc0bcb0, { wornScale: 6.0 });
      const buttonMat = new THREE.MeshLambertMaterial({ color: 0x6a2620 });
      const lensMat = new THREE.MeshBasicMaterial({
        color: 0xe4f0ff, transparent: true, opacity: 0.4, toneMapped: false, fog: false,
      });

      // Main body tube + knurled grip rings.
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.13, 14), bodyMat);
      body.rotation.x = Math.PI / 2; body.position.set(0, 0, -0.03); group.add(body);
      for (let i = 0; i < 5; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0276, 0.002, 6, 16), knurlMat);
        ring.position.set(0, 0, -0.002 - i * 0.013); group.add(ring);
      }
      // Flared bezel head + interior reflector cone.
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.03, 0.05, 16), headMat);
      head.rotation.x = Math.PI / 2; head.position.set(0, 0, -0.115); group.add(head);
      const refl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.033, 0.012, 0.03, 16, 1, true), reflMat);
      refl.rotation.x = Math.PI / 2; refl.position.set(0, 0, -0.123); group.add(refl);
      // Tail cap + push button.
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.027, 0.022, 14), headMat);
      tail.rotation.x = Math.PI / 2; tail.position.set(0, 0, 0.046); group.add(tail);
      const button = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.009, 10), buttonMat);
      button.rotation.x = Math.PI / 2; button.position.set(0, 0, 0.06); group.add(button);

      // Lens — bright disc at the bezel front (named; updateHeld pulses opacity).
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.034, 16), lensMat);
      lens.name = 'flashlightLens';
      lens.position.set(0, 0, -0.14);
      group.add(lens);
      // NOTE: the beam SpotLight is NOT here — it lives in the world scene
      // (vm.heldSpotLight) and is driven by updateHeld (a light parented here
      // would sit in the isolated viewmodel scene and not light the world —
      // ACAB fix). The lens disc above is the visible emitter.
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
      // ACAB — the beam is vm.heldSpotLight (world scene), zeroed each frame by
      // updateViewModel; re-armed + aimed here. The lens disc is the visual.
      const light = ctx.player.viewModel?.heldSpotLight ?? null;
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
      if (lens) (lens.material as THREE.MeshBasicMaterial).opacity = slot.meta.lit ? 0.85 : 0.4;
      // Drive the WORLD spotlight: position at the lens, aim along camera fwd.
      if (light && slot.meta.lit && lens) {
        const cam = ctx.three.camera;
        lens.updateWorldMatrix(true, false);
        lens.getWorldPosition(light.position);
        cam.getWorldDirection(_flashlightDir);
        light.target.position.copy(light.position).addScaledVector(_flashlightDir, 5);
        light.color.setHex(Tuning.FLASHLIGHT_LIGHT_COLOR_HEX);
        light.intensity = Tuning.FLASHLIGHT_LIGHT_INTENSITY;
      }
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
      // ACY/ACZ — deep-detail: a rolled canvas bundle (fabric roll w/ a rolled
      // end-spiral + cord straps), bundled tent poles lashed alongside, and two
      // iron stakes tucked in. (D107 zero-asset — procedural shaders.)
      const canvas = createFabricMaterial(0xb0a184, undefined, { disableShimmer: true });
      const canvasDark = createFabricMaterial(0x8e7f60, undefined, { disableShimmer: true });
      const poleMat = vmWood(0x4a3a2a, { ringDensity: 8.0, weatherLevel: 0.5 });
      const cordMat = new THREE.MeshLambertMaterial({ color: 0x6a5238 });
      const ironMat = vmMetal(0x6a6258, { wornScale: 5.0 });

      // Rolled canvas (axis along X).
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.22, 16), canvas);
      roll.rotation.z = Math.PI / 2; group.add(roll);
      // Rolled-fabric spiral on the +X end face (concentric).
      for (const r of [0.05, 0.034, 0.018]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.009, 6, 18), canvasDark);
        ring.rotation.y = Math.PI / 2; ring.position.x = 0.111; group.add(ring);
      }
      // A loose canvas flap draping off the roll.
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.004, 0.09), canvas);
      flap.position.set(-0.02, -0.052, 0.04); flap.rotation.set(0.3, 0, 0.05); group.add(flap);
      // Cord straps cinching the bundle (axis X).
      for (const x of [-0.075, 0, 0.075]) {
        const strap = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.005, 6, 18), cordMat);
        strap.rotation.y = Math.PI / 2; strap.position.x = x; group.add(strap);
      }
      // Two bundled tent poles lashed to the underside.
      for (let i = 0; i < 2; i++) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.27, 8), poleMat);
        pole.rotation.z = Math.PI / 2; pole.position.set(0, -0.058, (i - 0.5) * 0.03); group.add(pole);
      }
      // Two iron stakes tucked alongside.
      for (let i = 0; i < 2; i++) {
        const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.003, 0.12, 6), ironMat);
        stake.rotation.set(0, 0, Math.PI / 2 + 0.15); stake.position.set(0.04, -0.052, -0.05 + i * 0.018); group.add(stake);
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
      // ACZ — deep-detail: a folded warped scrap-metal sheet (matches the real
      // deployed sled's scrap-metal look — ACA) with rivets, lashed by a strap,
      // twin skid runners underneath, and a stub of the tow handle/yoke.
      const sheetMat = vmMetal(0x6a5a48, { wornScale: 6.0, scratchStrength: 0.06 });
      sheetMat.emissive = new THREE.Color(0x0c0a07);
      const sheetDark = vmMetal(0x52463a, { wornScale: 7.0 });
      const runnerMat = vmMetal(0x39302a, { wornScale: 5.0 });
      const rivetMat = vmMetal(0x8a8278, { wornScale: 3.0 });
      const strapMat = createFabricMaterial(0x4a3a28, undefined, { disableShimmer: true });

      // Folded sheet — 2 plates with a slight warp (rotation) reads as scrap.
      for (let i = 0; i < 2; i++) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.013, 0.10), i ? sheetDark : sheetMat);
        plate.position.y = -0.012 + i * 0.02;
        plate.rotation.z = (i - 0.5) * 0.06;   // warped, not flat
        group.add(plate);
      }
      // Rivets across the top plate.
      for (const x of [-0.085, 0, 0.085]) for (const z of [-0.035, 0.035]) {
        const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.006, 6), rivetMat);
        rivet.position.set(x, 0.012, z); group.add(rivet);
      }
      // Lashing strap around the fold.
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.108), strapMat);
      strap.position.set(0.0, -0.002, 0); group.add(strap);
      // Twin skid runners underneath.
      for (const sz of [-1, 1]) {
        const runner = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.012, 0.02), runnerMat);
        runner.position.set(0, -0.038, sz * 0.03); group.add(runner);
      }
      // Stub of the welded tow-handle yoke.
      const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.08, 8), runnerMat);
      yoke.rotation.x = Math.PI / 2; yoke.position.set(0.1, -0.018, 0); group.add(yoke);

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
      const poleMat = vmWood(0x4a3a2a, {
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
      const stakeMat = vmMetal(0x6e5a4a, { wornScale: 7.0 });
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
      const pegMat = vmWood(0x4a3320, { grainAxis: Math.PI / 2, ringDensity: 14.0 });
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
      const postMat = vmWood(0x5a4030, {
        grainAxis: Math.PI / 2,    // grain runs up the post
        ringDensity: 13.0,
        weatherLevel: 0.5,
      });
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.22, 8), postMat);
      group.add(post);
      // Metal base foot + top cap.
      const metalMat = vmMetal(0x4a4640, { wornScale: 8.0 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.018, 12), metalMat);
      base.position.y = -0.115;
      group.add(base);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.030, 0.022, 12), metalMat);
      cap.position.y = 0.135;
      group.add(cap);
      // Frosted-glass globe — lets the flame read through.
      const globeMat = vmGlass(0xffd9a0, {
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
      const woodMat = vmWood(0x6a4a2c, {
        grainAxis: 0,
        ringDensity: 10.0,
        weatherLevel: 0.45,
      });
      const metalMat = vmMetal(0x3a3a3a, { wornScale: 8.0 });
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
      // ACZ — detail pass: a smoother carved-stone egg (subdivided) with a
      // GLOWING crack-vein network (the creature's warmth bleeding through),
      // raised speckle nubs, and a chipped base. Lambert (no procedural-noise
      // shader — it crawls on the moving viewmodel; the emissive veins carry it).
      const stoneMat = new THREE.MeshLambertMaterial({ color: 0x4a3a2c, flatShading: true });
      const stoneDark = new THREE.MeshLambertMaterial({ color: 0x382a1e, flatShading: true });
      const veinMat = new THREE.MeshLambertMaterial({ color: 0xc4502e, emissive: 0x5a1a08, emissiveIntensity: 0.55 });

      const egg = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 1), stoneMat);
      egg.scale.set(1, 1.25, 1); group.add(egg);

      // Crack-vein network: 3 rings at varied tilts + 2 vertical seams.
      const ringSpecs: Array<[number, number, number, number]> = [
        [0.078, Math.PI / 2, 0, 0.006],
        [0.073, Math.PI / 2.4, 0.5, 0.005],
        [0.07, Math.PI / 1.8, -0.6, 0.0045],
      ];
      for (const [r, rx, rz, tube] of ringSpecs) {
        const v = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 4, 20), veinMat);
        v.rotation.x = rx; v.rotation.z = rz; v.scale.set(1, 1, 1.2); group.add(v);
      }
      for (const rzv of [0.0, Math.PI / 2.5]) {
        const seam = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.004, 4, 22, Math.PI), veinMat);
        seam.rotation.y = rzv; seam.scale.set(0.85, 1, 0.85); group.add(seam);
      }
      // Raised speckle nubs (carved stone texture in geometry).
      for (let i = 0; i < 7; i++) {
        const a = i * 2.39, y = (i / 6 - 0.5) * 0.16;
        const nub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.006 + (i % 3) * 0.002, 0), stoneDark);
        nub.position.set(Math.cos(a) * 0.078, y, Math.sin(a) * 0.078); group.add(nub);
      }
      // Chipped flat base so it sits.
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.024, 0.012, 8), stoneDark);
      base.position.y = -0.105; group.add(base);
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
      const ironMat = vmMetal(0x4a4038, {
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
      // ACY — deep-detail rebuild: a wound rope hank. Several side-by-side loops
      // form a thick coiled bundle (tilted for a 3/4 read), lashed at the bottom
      // by binding wraps, with a fraying tail hanging off. Tight wood-grain rings
      // read as twisted-fiber striations (D107 zero-asset).
      const group = new THREE.Group();
      const coilMat = vmWood(0x6e4a2a, { grainAxis: 0, ringDensity: 28.0, weatherLevel: 0.5 });
      const coilMat2 = vmWood(0x5e3e22, { grainAxis: 0, ringDensity: 28.0, weatherLevel: 0.62 });
      const lashMat = new THREE.MeshLambertMaterial({ color: 0x46301c });

      // Tilted coil subgroup so the lashing + tail follow the loops.
      const coilG = new THREE.Group();
      coilG.rotation.set(0.52, 0.12, 0.15);
      const loops = 5;
      for (let i = 0; i < loops; i++) {
        const r = 0.067 - Math.abs(i - (loops - 1) / 2) * 0.0035;   // slight mid-bundle bulge
        const loop = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0108, 8, 26), i % 2 ? coilMat2 : coilMat);
        loop.position.z = (i - (loops - 1) / 2) * 0.0135;
        loop.rotation.z = i * 0.11;
        coilG.add(loop);
      }
      // Binding lashing at the bottom of the hank — 3 wraps around the bundle.
      for (let i = 0; i < 3; i++) {
        const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.005, 6, 16), lashMat);
        wrap.rotation.y = Math.PI / 2;
        wrap.position.set((i - 1) * 0.012, -0.066, 0);
        coilG.add(wrap);
      }
      // Fraying tail hanging from the lashing.
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.0095, 0.085, 8), coilMat);
      tail.position.set(0.016, -0.10, 0.018); tail.rotation.set(0.25, 0, 0.32); coilG.add(tail);
      const frayTip = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.003, 0.03, 6), coilMat2);
      frayTip.position.set(0.03, -0.142, 0.03); frayTip.rotation.set(0.25, 0, 0.45); coilG.add(frayTip);

      group.add(coilG);
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

  // M5a (C29) — salvaged brass spyglass. The ZOOM verb is hold-RMB, driven by
  // updateSpyglass (player/spyglass.ts) reading mouseHeld(2) while equipped — NOT
  // wieldLmb, so LMB stays inert and Q just surfaces the how-to hint.
  spyglass: {
    id: 'spyglass',
    name: 'SPYGLASS',
    glyph: '⊙',
    description: 'a salvaged, pitted-iron spyglass — hold RMB to scan the horizon',
    stackable: false,
    maxStack: 1,
    wieldLmb: 'click_use',
    thirdPersonScale: 1.35,    // long but thin tube — modest 3P boost
    onUse(_ctx, _slot) {
      return { consumed: false, message: 'hold RMB to look through the spyglass' };
    },
    makeViewModel() {
      // C29 r3 — a long brass draw-telescope with the CLASSIC spyglass taper: a
      // narrow eyepiece (+Z, the eye end) widening through stepped draw-tubes to a
      // flared OBJECTIVE bell (−Z). ~6.5:1 length:width. The lenses are now SOLID
      // dark glossy discs RECESSED behind raised brass bezel rings (r2's transparent
      // glass showed brass through it → read as a flat painted cap). Bold steel joint
      // collars + a leather grip. Brass reads metallic in-hand under the sun.
      const group = new THREE.Group();
      // ACBD — was shiny brass (0xcf9a3a, rustLevel 0.025) which read as a flat
      // yellow that clashed with the all-rusty world. Now weathered pitted IRON:
      // rust-brown hue + high rustLevel. (Var names kept for the geometry below;
      // the material is rusty iron, not brass.)
      const brass = vmMetal(0x6b4a33, { wornScale: 3.4, rustLevel: 0.62, scratchStrength: 0.09 });
      const brassDark = vmMetal(0x44301f, { wornScale: 3.9, rustLevel: 0.74, scratchStrength: 0.08 });
      const steel = vmMetal(0xb7bcc4, { wornScale: 4.5, rustLevel: 0.02, scratchStrength: 0.05 });
      const leather = createFabricMaterial(0x33210e, undefined, { disableShimmer: true });
      const lensMat = new THREE.MeshStandardMaterial({ color: 0x070a11, roughness: 0.22, metalness: 0.15, side: THREE.DoubleSide });

      const tube = (r1: number, r2: number, len: number, z: number, mat: THREE.Material) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 22), mat);
        m.rotation.x = Math.PI / 2;   // lay the Y-cylinder along Z
        m.position.z = z;
        group.add(m);
        return m;
      };
      const collar = (r: number, z: number, t: number, mat: THREE.Material = steel) => {
        const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 9, 24), mat);
        m.position.z = z; group.add(m);   // ring wraps the Z-axis tube
        return m;
      };
      // A recessed lens: a raised brass bezel torus + a big SOLID dark disc set back
      // INTO the tube (toward the body centre — note −Z is forward/out at the
      // objective, +Z at the eyepiece, so recess toward z=0) so end-on it reads as a
      // dark glassy disc inside a brass rim, not a flat painted cap.
      const lens = (bezelR: number, z: number) => {
        collar(bezelR, z, 0.006, brassDark);                         // raised bezel lip
        const disc = new THREE.Mesh(new THREE.CircleGeometry(bezelR - 0.001, 24), lensMat);
        const dir = z > 0 ? -1 : 1;                                  // recess toward the body centre
        disc.position.z = z + dir * 0.008;
        group.add(disc);
      };

      // Eyepiece (narrowest, +Z, the eye end).
      tube(0.0175, 0.0175, 0.10, 0.155, brass);
      tube(0.0205, 0.0205, 0.020, 0.205, brassDark);    // eyecup
      lens(0.018, 0.214);                                // recessed eye lens behind the eyecup
      collar(0.0185, 0.105, 0.006);                      // steel collar at eyepiece↔draw1

      // Draw-tube 1 (widening toward the objective).
      tube(0.0225, 0.0225, 0.115, 0.04, brass);
      collar(0.0235, -0.018, 0.0065);                    // draw1↔main collar
      // Main barrel (widest body) with a leather grip sleeve.
      tube(0.0285, 0.0285, 0.13, -0.10, brass);
      tube(0.0305, 0.0305, 0.05, -0.07, leather);        // wrapped grip
      collar(0.0312, -0.046, 0.0055, leather);
      collar(0.0312, -0.094, 0.0055, leather);
      collar(0.029, -0.16, 0.007);                       // bold steel collar at main↔bell
      // Flared objective bell + the big recessed lens.
      tube(0.0285, 0.034, 0.04, -0.19, brassDark);
      lens(0.033, -0.207);                               // recessed objective lens behind a brass bezel

      // Tilt very slightly so it reads as held, not a floating prop.
      group.rotation.set(0.04, 0.0, 0.0);
      return group;
    },
    makeIcon() {
      const s = svg();
      // A tapered spyglass: a long body + a flared objective end.
      s.appendChild(svgEl('path', { d: 'M4 9 L15 10 L20 7 L20 17 L15 14 L4 15 Z' }));
      s.appendChild(svgEl('line', { x1: '9', y1: '9.6', x2: '9', y2: '14.4', 'stroke-width': '1' }));
      return s;
    },
  },
};

export function getItemDef(id: ItemId): ItemDef {
  return _DEFS[id];
}

/** ACAD — EVERY registered item, derived from the registry so it can never go
 *  stale (the dev item spawner needs the complete set). Use this over the
 *  hand-maintained ALL_ITEM_IDS below when you want "literally every item". */
export const ALL_REGISTERED_ITEM_IDS: ReadonlyArray<ItemId> =
  Object.keys(_DEFS) as ItemId[];

export const ALL_ITEM_IDS: ReadonlyArray<ItemId> = [
  'canteen', 'scrap', 'bandage', 'machete', 'scrap_bar', 'scrap_machete',
  'cactus_pulp', 'cooked_cactus_pulp',
  'raw_lizard_meat', 'cooked_lizard_meat',
  'raw_worm_meat', 'cooked_worm_meat',
  'raw_shrew_meat', 'cooked_shrew_meat',
  'raw_vulture_meat', 'cooked_vulture_meat',
  'branch', 'cloth', 'fire_kit', 'signal_kit', 'grill_kit', 'tent_kit',
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
  'pulse_rifle',    // ACAC — rapid-fire energy carbine
  'relic_core',     // ACAQ — wreck-yard exclusive artifact
];
