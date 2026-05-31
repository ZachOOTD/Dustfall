# Feature arc: Player model → real-human + Rey-Jakku quality

**Created**: 2026-05-31 (after the ACH audit honestly found the model is far from the
Rey target — a rigid barrel/sandwich-board on stick-legs, not a slim draped human).
**Supersedes**: the single iteration-plan "Cycle 2 — Rig to Rey-tier" (which shipped
geometry detail but NOT a correct silhouette; re-opened here as a proper multi-cycle arc).
**Reference**: `docs/research/reference-tfa-jakku-opening.md` (shots 4, 7, 10 = outfit).
**Tooling**: the D134 headless screenshot loop (`__game.enterGame`) is the verification engine.

---

## Why a multi-cycle arc (not one cycle)

The ACH audit (4 lit screenshots, front/side/back/head) found the gap is **fundamental
silhouette + proportion**, not surface detail:
- Poncho = a rigid rectangular slab jutting out front+back with a hard flat hem (cardboard sandwich-board), not draped cloth.
- Torso too wide, no waist taper; head too small; neck too long + bare; legs spindly.
- Headscarf = a flat mushroom disc floating above a featureless ovoid face; bandana = a floating ring; neck exposed.
- Arms/belt/pouches hidden behind the slab; backpack a separate stuck-on box.

Detail (the ACH band-wraps, fingerless glove, fold displacement) is fine in isolation but
invisible/irrelevant under a wrong silhouette. **Fix the armature + garment drape + head
first; texture last.** Lesson logged: judge the FULL-BODY silhouette every round, not parts
in isolation (the ACH over-claim).

---

## Model Verification Protocol (MVP-check) — run EVERY round + as each cycle's gate

The quality bar. No element is "done" until it passes this, and no cycle closes until the
**adversarial second look** finds nothing major.

**0. Studio setup (one call).** Build `__game.rigStudio(angle?)` (PM-Cycle A task 0): a DEV
helper that does `enterGame(true)` + `renderer.setSize(900,1100)` + `thirdPerson=true` +
**even studio lighting** (ambient ~2.2 + a key directional from camera-front + exposure ~2.0
— NOT the in-game dusk that hid detail in ACH) + frames a requested canonical angle. Makes
verification one repeatable call instead of re-derived eval each time. (Runtime-only; gated to DEV.)

**1. Capture the 6 canonical frames** each round: full-body **FRONT, BACK, LEFT-side,
3/4-front**, **HEAD close**, + the **cycle's focus-area close** (waist / arm / legs / drape-in-motion).

**2. Critique each frame against BOTH:**
- **(a) Real-human proportion/anatomy** — ~7–7.5 head-heights tall; shoulders wider than waist; limb thickness proportional; neck short; natural standing posture; no part floating/clipping.
- **(b) The matching Rey reference shot** — palette (cream-beige wraps `#cab48a`, leather `#6e5333`, dirt/sweat), outfit layering (headscarf head+neck, layered tunic, cinched belt + pouches, gloves w/ knuckle cutouts, wrapped boots).

**3. Per-cycle PASS BAR** (explicit + checkable — see each cycle).

**4. Adversarial second look** (the anti-shallow-ship gate): before declaring an element done,
ask *"what still reads as low-poly / programmer-art / anatomically wrong here?"* — list it; if
non-empty, another round. Borrow a fresh lens: compare side-by-side to the reference shot, and
to a real human at the same camera distance.

**Iteration counts** (per `iterative-polish-discipline.md`): **5–8 rounds** for new/rebuilt
elements, **3–5** for tuning. A cycle ships **1–2 fully-iterated elements**, not 5 shallow ones.

---

## PM-Cycle A — Proportion + silhouette (THE FOUNDATION)

**Why**: everything sits on the armature. A correct slim-human silhouette must exist before any
garment/detail work — else we polish a barrel. GDD Pillar 2/4.

**Scope** (`playerRig.ts` constants + torso/leg/neck profiles; 1–2 sessions):
0. **`__game.rigStudio()` verification helper** (above) — build first; every later cycle uses it.
1. Narrow the torso: `TORSO_CHEST_R`/`TORSO_WAIST_R` + the lathe profile → real shoulder→waist
   taper (waist clearly narrower than chest). Kill the barrel.
2. Re-shape the poncho from rigid wide box → **narrower, body-following, gravity-draped** static
   geometry: hangs DOWN (longer than wide), soft/broken hem (not a flat horizontal cut), an open
   front V, slight asymmetry. (Full drape comes in PM-Cycle D cloth physics — this is the
   correct *resting* shape.)
3. Fix ratios: head bigger (≈1/7.5 body height), neck shorter, legs more substance
   (thigh/calf volume), feet → boot-shaped not flat slabs.
4. Posture/stance check (feet plant, slight contrapposto OK).

**Verify / PASS BAR**: at 3 m the full-body silhouette reads as a **slim draped human**, not a
barrel/board; shoulders > waist; ~7–7.5 head-heights; no slab-poncho, no bare long neck, no
stick-legs. Adversarial look finds no "barrel/sandwich-board/mannequin-proportion" read.

**Dependencies**: none. **Risk**: touches core rig constants many systems read (camera offsets,
held-item attach, footstep) — re-verify 3P camera + viewmodel after. Likely D-entries: proportion
constants rebalance; poncho resting-shape approach.

---

## PM-Cycle B — Head, face, scarf (the focal point)

**Why**: the face draws the eye; a blank ovoid + floating-disc scarf kills the read at any
distance. Rey shots 4/7/10.

**Scope** (`playerRig.ts` head section):
1. Face planes: brow / nose bridge / cheekbones / jaw definition on the head lathe (stylized but
   readable as a face). Goggles read on the forehead (Rey detail).
2. Scarf rebuild: cloth that **wraps the crown snugly** (no floating disc, no gap) and **drapes
   continuously head → neck → back-shoulder** (close the bare-neck gap). Face wrap = cloth over
   nose/mouth connected to the scarf, not a floating ring.
3. Neck: shorten; the scarf covers it.

**Verify / PASS BAR**: head closeups from 4 angles read as **a person's head wrapped in a
continuous scarf**; discernible facial features; no floating crown, no bare neck, no ring-bandana.
Adversarial: "does this read as a mannequin/UFO-hat?" → no.

**Dependencies**: A (correct head size/neck). **Risk**: low-arch, high-iteration.

---

## PM-Cycle C — Layered outfit: garment + arms + belt/pouches + backpack

**Why**: with a slim torso + defined waist, build the **layered-scavenger** read (Rey shot 7/10:
layered tunic + cinched belt + pouches + visible gloved arms).

**Scope** (`playerRig.ts`):
1. Layering: tunic/poncho as 2+ cloth layers (under-tunic + over-wrap), asymmetric, so the body
   reads as *dressed in layers* not *one shell*.
2. Arms now visible (slim torso no longer occludes) — the ACH band-wraps + fingerless glove
   finally read; tune their visibility/scale.
3. Belt cinched at the now-defined waist, pouches + buckle legible (no longer hidden under a slab).
4. Backpack integrated: softer shape + shoulder straps that clearly cross to the front; bedroll reads.
5. Clean the shoulder/pauldron bunching (ACH flagged lumpy blobs).

**Verify / PASS BAR**: front/side/back + waist/arm/back closeups read as a **layered scavenger
outfit**; belt+pouches+arms+pack all legible; no bunching/mess at the shoulders. Adversarial:
"anything reading as blobs / stuck-on boxes?" → no.

**Dependencies**: A (slim torso), B (head) ideally. **Risk**: moderate.

---

## PM-Cycle D — Cloth physics (Verlet drape + motion)

**Why**: hand-authored static cloth can't read as real fabric — it's why the poncho looked stiff.
A Verlet/segmented sim makes the poncho + scarf tails + loose wrap ends **drape under gravity at
rest and sway in motion**. **Synergy**: shares a solver with iteration-plan **Cycle 4 (real rope
physics)** — consider building the Verlet primitive once for both.

**Scope** (likely NEW `src/player/clothSim.ts` + hook in the rig tick):
1. Verlet point-mass + distance-constraint cloth primitive (gravity + iterations), behind a
   `FEATURES.clothPhysics` gate-and-wait flag.
2. Apply to the poncho hem/back-drape + scarf tail (pinned at the shoulders/crown, free at the hem).
3. Collision against the body (capsule/spheres) so cloth doesn't clip through.
4. Save: cloth is transient — re-derive on load, don't serialize (per `day-cycle-weather-state.md`).

**Verify / PASS BAR**: at rest the poncho/scarf hang with gravity folds; in a walk/turn they sway
believably; no body clipping; flag-off keeps the static fallback. In-motion screenshots (multiple
gait phases) + at-rest. Adversarial: "stiff/clipping/jittery?" → no.

**Dependencies**: A (garment resting shape), C (layers to simulate). **Risk**: HIGH (architectural;
new sim; perf). Gate-and-wait + `known-hard-patterns` discrete-collision/tunneling screen.

---

## PM-Cycle E — Texture / material pass (LAST)

**Why**: surface richness. Can only land on a correct silhouette (can't rescue a barrel). D107
zero-asset → procedural shaders only (`skinMaterial`/`fabricMaterial`/`paintMaterial`/`metalMaterial`).

**Scope**:
1. Skin weathering (face/hands sun-damage + dirt gradient, grimy knuckles).
2. Cloth weave + dye + edge wear (poncho/scarf/wraps); glove tone contrast (ACH flagged too-subtle).
3. Leather grain (belt/straps), backpack stitching/wear.
4. Palette match to the reference table (cream-beige wraps, leather, dust/sweat).

**Verify / PASS BAR**: material-region closeups read as worn cloth/leather/skin (not flat fills);
palette matches reference. Adversarial: "flat/plasticky/uniform?" → no.

**Dependencies**: A–C (geometry), ideally D (don't texture cloth you're about to re-author for sim).

---

## Recommended ordering

A (proportion/silhouette + studio tool) → B (head/scarf) → C (layered outfit) → **D (cloth
physics)** → E (texture). D before E so we don't texture cloth that the sim re-shapes. D shares a
Verlet solver with iteration-plan Cycle 4 (rope) — build the primitive once.

**Cadence**: after each cycle, run the full MVP-check (6 frames + adversarial look) and capture the
6 canonical shots into the session-end report as the visual record. Re-rank remaining cycles if a
playtest/critique surfaces a bigger gap. Honor the discipline: 1–2 fully-iterated elements per
session, never 5 shallow.
