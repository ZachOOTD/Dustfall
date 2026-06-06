# Mega-wreck anatomy — concrete build spec (ACAJ T2 rebuild)

> Synthesized from 6 research facets (downed-capital-ship silhouette, derelict component
> vocabulary, 120m hauler anatomy, greebling/density rules, crashed-ship compositional
> language, LatheGeometry hull tactics). Grounded against the **existing** interior cavity
> in `src/world/megaWreck.ts` and the toolkit in `src/world/wreckForms.ts`.
>
> **Why the last attempt failed:** it draped a single smooth tapered lathe tube over each
> interior box (aft + bow), added 4 formers + 3 breaches + a frustum bridge cap, and called
> it done. Result = "a smoother box." The hull had no spine, no broken cross-section at the
> fracture, no panel-line rhythm, no command-tower detail, no engine structure, no debris,
> no burial. A wreck reads as crashed only when **three signals co-occur**: structural
> rupture (broken spine + list), exposed internal cross-section (decks/frames/cables at the
> break), and environmental integration (half-burial + debris field + ground-contact
> deformation). Smooth-shell-over-boxes delivers none of them.

---

## 0. HARD CONSTRAINTS (do not break)

- **Interior box cavity is sacred.** Bow chamber (Z ≈ −60…−25), mid-hull fracture
  (Z ≈ −25…−10), main aft bay (Z ≈ −10…+50), side room (off +X at Z ≈ −5…+15). ~25
  hand-authored cuboid colliders, 2 salvage panels, shelter zone, journal — ALL stay.
  The box walls remain the collidable inner shell; the player walks the cavity.
- **Everything new in this rebuild is EXTERIOR shell + exposed-structure detail**, built
  *around / over* the boxes. Every new mesh: `userData.noCollider = true`, `FrontSide`
  (so the camera sees the bay's box walls from inside, not the shell's backface).
- **The shell ENVELOPS the box** so the box reads as inner structure, not the silhouette.
  Lathe cross-section flattened in Y (`HULL_Y_FLAT ≈ 0.72`) to an ellipse hugging the wide
  rectangular box. Document the flatten intent inline or it reads "squished."
- **Local axis:** ship long-axis = **+Z** (bow at −Z, engines at +Z). `wreckForms` builders
  default to +X; pass `axis:'z'` to `makeLatheHull`, and rotate formers/breaches accordingly.
- **Rule 7 (depth):** any BoxGeometry decoration on an OUTSIDE surface viewable edge-on is
  ≥10cm thin / 15cm hull-substantial. 5cm reads paper-thin. (The existing seam/streak/patch
  passes already comply — keep that.)
- **Rule 8 (iteration):** `npm run verify` clean is NOT the success gate. Per component:
  build → `megawreck` rig-shot → score against §5 rubric → iterate. 5–8 rounds for new
  silhouette elements, 3–5 for tuning. Ship 1–2 fully-iterated passes, not 6 shallow ones.

---

## 1. TARGET READ

A **120-meter military cargo hauler that came down hard, nose-first and rolled**, now
half-swallowed by a dune sea — the Jakku Star Destroyer and the *Subnautica* Aurora as the
two load-bearing touchstones. From 100m it must read instantly as a **broken ship, not a
building**: a long **tapered dagger-wedge** lying at a visible list (~18–25°), its **spine
snapped** at the mid-hull so the bow and the main hull are two distinct masses with a ragged
gap between them — and through that gap you can *count interior decks, ribs, and dangling
cables* like looking into a cut-open *Titanic* cross-section. A **command tower with real
windows, a sensor mast, and dish antennas** rides dorsally on the aft mass and anchors "this
was the bridge." Two **flared engine bells** with exposed mounting structure cap the stern.
The hull skin is **panel-lined and greebled in functional clusters** (engines, sensors,
breach rims) against large clean plates, **rust-streaked downward from every vent and joint**,
asymmetrically scarred — the impact (+X) flank is shattered, the lee (−X) flank nearly
intact. A **debris field** of torn plates and struts fans downwind from the fracture, and
**wind-drifted sand** climbs the windward flank. The emotional read: *Long Dark* loneliness,
*Mad Max* scavenged menace, *Dune* scale-against-emptiness.

---

## 2. OVERALL COMPOSITION

The existing cavity is a **horizontal walkable tube** running bow→aft along +Z. We keep that
geometry and pose the *exterior shell* to tell a crash story over it.

**The spine + two masses.** The ship is two structural masses joined by a broken spine:
- **Bow mass** (over the bow box, Z −60…−25): the nose section. Sharp tapered point at −Z,
  shouldering up to the fracture face at −25. ~half the height of the aft mass — this is the
  crumpled/buried impact end, so its nose is **crushed and driven into the sand** (low,
  dented, sand piled over the tip).
- **Aft mass** (over the aft box, Z −10…+50): the main hull + cargo body + bridge + engines.
  Broad belly, dorsal bridge tower, twin engine bells at +Z.
- **The fracture** (Z −25…−10): the **money shot**. This is NOT just a gap with formers — it
  is a **readable broken cross-section**. Both torn faces (bow-rear face + aft-front face)
  expose: 3–4 **former rings** (rib skeleton), **stacked deck-edge ledges** (3–4 horizontal
  platforms, 3m apart, offset/staggered between the two faces, RECESSED ~15–20cm so they read
  as depth not paper), **a keel/spine stub** bridging the gap, **2–4 dangling cables**, and
  **bent torn flaps** around the rim. The gap is partial — a spine stub still connects the
  masses (snapped, not severed), which reads more "broke its back" than "two separate ships."

**The pose (list + nose-down).** The wreck is placed with a **terrain-driven list** already
(tilt quaternion at placement). We commit harder: a **~18–25° roll toward the +X (impact)
flank** and a **slight nose-down pitch** so the bow drives into the dune. *This is the single
biggest cheap win over the current flat attempt.* (Caution: the interior cavity floor must
stay walkable — apply the dramatic tilt to a NEW exterior-only shell group, OR keep the cavity
near-level and let the *shell + sand* sell the list via asymmetric burial and a raked
silhouette. Prefer the latter if tilting the collidable cavity risks trapping the player; the
asymmetric sand drift + the raked bridge + the higher +X-flank burial can fake a list without
rotating the floor.)

**Half-burial (asymmetric).** Sand drifts against the **windward (−X / lee-of-impact) flank**
and **over the crushed bow tip**, ~20–30% burial depth, NOT uniform. Use `makeSandMound`
along the −X flank at 3–4 points of varied size, plus one big mound swallowing the nose. The
+X impact flank stays exposed (that's where the breaches and debris are). Burial blends the
hull into the terrain mesh so it "sits IN the dunes, not ON them."

**Debris field.** A directional arc of **30+ fragments** fans **downwind from the fracture**
(reuse `placeDebrisField` from `wrecks.ts`): torn hull plates (0.3–3m), bent struts, a few
former-ring fragments, scattered over ~45–60m. Concentrated near the break, thinning downwind.
Optional scale-anchor: 1–2 small companion wrecks or a crushed vehicle near the bow for the
"19km scale" trick — establishes the mega-wreck's mass viscerally.

**Ground contact.** At the bow impact point, a shallow **settling depression / scorch +
gravel scatter** (dark disc + a few displaced rocks) so the wreck visibly *hit* rather than
*parked*.

---

## 3. COMPONENT BUILD LIST (ordered by silhouette impact)

> Build top-down. Each item: **[NEW]**/**[TOOLKIT]**/**[EXISTING]**, approach, proportions,
> location. "Toolkit" = reuse `wreckForms.ts`. Numbers are in body-local meters (the existing
> `AFT_HALF_*`/`BOW_HALF_*` constants are the anchors).

### Tier A — Silhouette (must read as a broken ship at 100m)

1. **Aft fuselage shell** — [TOOLKIT `makeLatheHull`, axis:'z'] — *rework, don't reuse current.*
   Tapered fuselage enveloping the aft box (Z −10…+50). 60m long, waist radius ≈ AFT_HALF_W
   × 1.28 (envelops the 40m box corners), `scale.set(1, 0.72, 1)`. **Improve the profile over
   the current one:** sharper belly bulge mid-section, a distinct **shoulder** where the
   dorsal deck meets the flank (so the bridge has a base to sit on), tapering to a blunt
   engine transom at +Z (NOT a smooth point — capital ships have a flat stern). 7–9 profile
   points. This is the body the bridge/engines/greebles attach to.

2. **Bow nose shell + crushed tip** — [TOOLKIT `makeLatheHull`, axis:'z' + vertex-displace] —
   Nose section over the bow box (Z −60…−25). 35m long, tapering to a near-point at −Z.
   **Then crush it:** grab the nose-tip vertices and displace them ~1–2m inward/up + flatten
   the underside (impact deformation) so the nose reads *buckled*, not clean. Attach to
   `bowGroup` so it tracks the bow's terrain Y-offset. `scale.set(1, 0.76, 1)`.

3. **Mid-hull fracture cross-section** — [TOOLKIT `makeFormerRings` + NEW deck-ledges + NEW
   spine stub + NEW cables] — THE hero detail. At Z −25…−10:
   - **Former rings:** 3–4 via `makeFormerRings(AFT_HALF_W×1.02, 4, 4.2, {tube:0.6})`, on
     BOTH torn faces (bow-rear + aft-front), `scale(1,0.72,1)`, rotated rings ⟂ +Z.
   - **Deck-edge ledges [NEW]:** 3–4 horizontal box platforms per face (full-width thin
     slabs, ~0.2m thick, 3m vertical spacing), **RECESSED 15–20cm inside the hull rim** and
     **staggered/offset** between the two faces (deck on bow side at Y=3,6,9; aft side at
     Y=4.5,7.5,10.5) so the eye reads discrete countable decks, not muddy layers.
   - **Spine/keel stub [NEW]:** one bent box beam (~1m×1m section) bridging part of the gap
     low-center — the snapped backbone. Slightly kinked (two segments at a shallow angle).
   - **Cables [NEW]:** 2–4 `TubeGeometry`/Catmull-Rom sagging curves from upper deck-edge to
     floor, drooping under gravity. Dark conduit material.
   - **Torn rim flaps:** reuse `makeBreach`'s flap pattern or a partial-arc lathe end.

4. **Bridge / command tower** — [NEW box-kit over existing tower box + TOOLKIT cap] — Over
   the tower box (dorsal, forward on aft mass, Z ≈ AFT_ORIGIN_Z − 0.4×AFT_HALF_L). Replace
   the bare cube read with a **stepped 4–5 deck tower** (each deck a box ~2.5–3m tall,
   stepping back slightly going up — the "wedding cake" capital-ship island), a **forward-raked
   windscreen slab** (keep current, improve), **window clusters** (5–7 dark viewport boxes
   per deck on the front + sides, 0.6–0.9m, framed with ≥10cm relief), and a **tapered cap**.
   Total ~12–16m above the aft roof. This is the recognition anchor — exaggerate it ~1.3×.

5. **Sensor mast + dish array** — [NEW LatheGeometry stepped mast + cylinders/spheres] — Rises
   from the bridge crown. Tapered tubular mast (base 0.4m → crown 0.15m, ~8–12m tall, lean it
   2–4° off-vertical as bent-on-impact). Crown supports **3–5 parabolic dishes** (shallow
   open cones / lathe paraboloids, 1–4m varied diameter) + 2–3 whip antennas (thin tall
   cylinders) + a scanner globe (hemisphere, ~2m, topmost point). Cluster asymmetrically.

6. **Engine bells + mount structure** — [EXISTING `makeEngineBellMesh` + NEW exposed frame] —
   Keep the twin 10m bells at the transom (Z = aft back wall + offset). **Improve the mount:**
   replace the flat `frame` box with an **exposed engine-room cage** — a former-ring + 4–6
   radial struts + a few pipes running forward into the hull, so the bells read as torn from
   their housing, not bolted to a billboard. Offset one bell ~5–10° (battle/impact damage),
   vary diameters ±10%. Add a dark recessed combustion void behind each (already in the bell).

### Tier B — Surface believability (must not read smooth)

7. **Hull panel-line greebles** — [NEW box-kit, recessed seams + raised strakes] — Panel
   seams running **fore-aft (along Z)** in continuous strakes on the shell flanks + dorsal
   deck. Mix **1–2m structural plates** with **0.3–0.7m local zones**. Recessed-seam look via
   thin proud box ridges (≥10cm per rule 7) at plate boundaries; vary plate widths 2–4m. The
   current vertical/horizontal seam passes on the box walls are fine for the *interior* read —
   add a fore-aft strake pass on the *new shell*. Aim 40–60% clean negative space per surface.

8. **Asymmetric impact breaches** — [TOOLKIT `makeBreach`] — Keep 3 but reposition for the
   committed list: **+X impact flank = 2 large gaping breaches** (r≈4 and r≈2.6) showing
   former rings + a deck ledge behind each (a breach over void reads hollow — always back it
   with 1–2 ribs + a recessed dark interior disc, which `makeBreach` provides). **−X lee
   flank = 1 small tear** (r≈2). Each `scale(1, ~0.85, 1)`, `noCollider`, `tagWreckDecoration`.

9. **Functional greeble clusters** — [NEW box/cyl kit] — Concentrate detail where systems
   live, sparse elsewhere: **vent louvers + heat-radiator fin panels** on the dorsal/flank
   between bridge and engines (thin parallel fins, mounted PERPENDICULAR to hull, opposite
   sides for thermal logic); **pipe/conduit runs** tracing from engine bells forward along the
   flank to the bridge (keep the existing exterior pipe pass, extend it onto the shell);
   **cargo hatch coamings** (2–3 raised-rim rectangles on the dorsal deck, 1–1.8m coaming);
   **escape-pod bay** (one hex-grid cluster of 6–8 small capsule recesses, a couple ejected).

10. **Rust-streak + weathering pass** — [EXISTING `_rustMat`/`_rustDarkMat` + shader] — Keep
    the 25-streak + 6-patch passes but **bias them**: streaks flow DOWNWARD from vents, joints,
    breach rims, and the bridge base (natural weathering direction); concentrate NEAR fractures
    and the impact flank; near-clean on the lee flank. Brighter oxidation (orange) at fresh-torn
    fracture metal grading to weathered brown on old skin. Selective, not uniform.

### Tier C — Environmental integration (must read crashed + buried, not parked)

11. **Asymmetric sand drifts** — [TOOLKIT `makeSandMound`] — 3–4 mounds along the **−X / lee
    flank** (varied size 8–18m) + **1 large mound over the crushed bow tip**. Windward bias via
    the `windDir` arg. Blends hull into terrain (~20–30% burial). NOT uniform — leave the +X
    impact flank, breaches, and debris exposed.

12. **Debris field** — [EXISTING `placeDebrisField`] — 30+ fragments fanning **downwind from
    the fracture** in a directional arc over ~45–60m: torn plates (0.3–3m), bent struts,
    former-ring shards. Dense near the break, thinning out. Varied scale (0.8–2×) + rotation.

13. **Ground-contact deformation** — [NEW] — At the bow impact point: a shallow dark
    settling-depression disc + scorch + a few displaced rocks/gravel, so the wreck visibly
    *hit*. Small but kills the "floating/parked" read.

14. **Scale-anchor companion wreck** *(optional, high-value)* — [EXISTING procgen wreck via
    `wrecks.ts`] — 1 small (8–15m) crashed companion ship or crushed vehicle near the bow, to
    make the mega-wreck's 120m mass land emotionally by contrast.

### Tier D — Interior-facing-the-breaches polish (lower priority)

15. **Breach interior backing** — [NEW] — Where a flank breach overlaps the bay, ensure the
    player inside sees ribs/deck-edge/cables through it (not a flat box-wall hole). Small
    rib + cable cluster behind each interior-facing breach.

16. **Bridge interior tease** — [NEW, optional] — A few console boxes + a dark viewport behind
    the windscreen so the bridge glass shows *something* when lit, not a black void.

---

## 4. DETAILING RULES (rules of thumb)

- **Silhouette first.** If the 100m silhouette doesn't read "broken ship," no amount of
  greeble saves it. Lock Tier A before touching Tier B.
- **Function justifies every detail.** Pipes run engine→bridge. Radiators sit opposite each
  other. Antennas have a mast. Breaches expose ribs. No arbitrary boxes. A detail that traces
  to no system reads as noise.
- **Greeble in clusters, not carpets.** Concentrate density at engines, sensors, breach rims,
  bridge base. Keep **40–60% clean negative space** per visible surface. Uniform greeble =
  synthetic, kills scale inference.
- **Panel lines BEFORE greebles, fore-aft.** Strakes run parallel to hull travel (Z). Mix
  1–2m plates with 0.3–0.7m zones. Vary widths. Don't let seams disappear under kit parts.
- **Asymmetry with a cause.** Impact flank (+X) shattered; lee flank (−X) intact. Bridge
  off-center, one engine offset, radiators one side. Symmetric damage reads "designed," not
  "crashed." But every asymmetry must have a reason (impact direction, wind, thermal).
- **Depth, not paper.** Box decorations on outside surfaces ≥10cm (15cm hull-substantial).
  Deck-edges and ribs at breaches RECESSED 15–20cm so they read as interior depth, not
  flush stickers. (CLAUDE.md rule 7.)
- **Breaches are never empty.** Every torn hole = recessed dark void disc + bent rim flaps +
  at least 1–2 ribs/deck-edge visible behind. A void with nothing behind reads "hole in a box."
- **Weathering flows down + concentrates.** Rust streaks DOWNWARD from vents/joints/rims,
  densest near fractures and impact, sparse on clean lee skin. Never uniform rust.
- **Scale anchors sell magnitude.** Window clusters, a human-door-sized hatch, a small
  companion wreck — these make 120m *feel* like 120m.
- **Lathe cross-section is circular** — Y-flatten (0.72) to envelop the wide box; document it.
  Keep the taper **monotonic** (no bumps back up) or the hull reads broken-in-a-bad-way.

---

## 5. HARSH ITERATION RUBRIC (score EVERY render round; be ruthless)

Shoot the `megawreck` rig-shot (and a 100m wide angle). For each round answer YES/NO. Any NO
on Q1–Q6 = the round is **not shippable**; loop back.

1. **Ship, not building?** — At 100m does the silhouette read as a long crashed *vessel*, not
   a cluster of boxes / a bunker? (If the boxy interior reads through the shell anywhere → NO.)
2. **Dominant + asymmetric silhouette?** — Tapered dagger-wedge, clearly longer than wide,
   with ONE dominant focal mass (the bridge), and asymmetric (list + impact damage on one
   side)? Or does it read symmetric/centered/flat? (Symmetric → NO.)
3. **Broken spine + real cross-section?** — Is there a visible mid-hull FRACTURE showing
   *countable* internal decks (3+ offset ledges), ribs, and a snapped spine stub — not just a
   gap or a curtain of formers? Can you "look inside the cut"? (Empty gap → NO.)
4. **Bridge reads as a bridge?** — Does the tower have windows, a sensor mast, and dishes —
   recognizable as the command island — or is it still a box with a cap? (Box → NO.)
5. **Engines read as engines?** — Flared bells with *exposed mount structure* (cage/struts/
   pipes), not bells stuck on a flat billboard frame? (Billboard → NO.)
6. **Crashed + buried, not parked?** — Visible list, sand climbing the flank asymmetrically,
   debris fanning downwind, ground-contact at the nose? Or does it sit flat ON the sand? (Flat
   on sand, no debris → NO.)
7. **Hull surfaces detailed, not smooth?** — Fore-aft panel strakes + greeble clusters +
   varied plate sizes, OR large smooth unbroken curved patches >3m? (Smooth patches → fix.)
8. **Greeble clustered, negative space preserved?** — Detail concentrated at functional
   zones with 40–60% clean plate between, OR uniform clutter / uniform blankness? (Either → fix.)
9. **Breaches show internals?** — Every torn hole backed by ribs/deck/dark void + bent flaps,
   none reading as a flat hole in a wall? (Flat hole → fix.)
10. **Weathering directional + concentrated?** — Rust flows down from vents/joints, densest at
    impact/fractures, sparse on lee flank — or evenly smeared? (Even → fix.)
11. **Depth honest?** — No paper-thin (<10cm) edge-on decorations; ribs/decks recessed, not
    flush? (Paper → fix per rule 7.)
12. **Interior untouched + walkable?** — Bay/bow/side-room cavity, colliders, panels, shelter,
    journal all intact; shell is `noCollider`/`FrontSide`; player can still walk end-to-end?
    (Regression → STOP, the hard constraint is broken.)

---

## 6. ANTI-PATTERNS (specific failure modes — do NOT do these)

- **The smooth-shell-over-boxes trap** *(the exact failure of the last attempt).* One smooth
  lathe tube per box with a few decorations ≠ a wreck. It needs a broken spine, a readable
  cross-section, a detailed bridge, panel rhythm, debris, and burial — or it's just a rounder
  box. Silhouette + fracture + environment must ALL be present.
- **Empty fracture gap / curtain of formers.** A gap with only ring tori behind it reads
  hollow. The fracture needs offset deck-edges (countable rooms), a spine stub, cables, AND
  ribs — the *Titanic* cross-section read.
- **Bridge-as-box.** A cube with a frustum cap is not a bridge. Without windows + mast +
  dishes the viewer won't recognize the hero element.
- **Engine bells on a billboard.** Bells bolted to a flat frame box read toy-like. Expose the
  mount cage/struts/pipes.
- **Uniform greeble carpet** OR **uniform blank curves.** Both kill scale. Cluster detail at
  functional zones against clean plates.
- **Perfect symmetry.** Centered bridge, mirror-image breaches, even burial, level rest. Real
  crashes are asymmetric: list, impact on one flank, wind-biased drifts.
- **Boolean-clean breach holes.** Razor-edged voids read "CSG subtract." Use bent torn flaps +
  inward-curled rim (`makeBreach`) + recessed dark interior.
- **Paper-thin decorations (<10cm) / flush ribs + decks.** Rule 7. Edge-on reads as stickers;
  recess interior structure 15–20cm for depth.
- **Uniform sand burial.** Even coverage ignores wind. Drift asymmetrically against the
  windward flank + over the crushed nose; leave the impact flank exposed.
- **No debris / floating wreck.** A solo clean hull on flat sand reads "parked." Needs a
  downwind debris arc + ground-contact deformation + half-burial.
- **Uniform rust.** Even rust on a desert/vacuum hull is wrong. Selective edge-wear, downward
  streaks from joints, concentrated at impact/fractures.
- **Tilting the collidable cavity into a trap.** If a dramatic list is applied to the
  *interior* boxes, verify the floor stays walkable end-to-end. Prefer faking the list via
  the exterior shell + asymmetric burial + raked bridge if rotating the floor risks trapping
  the player (rubric Q12 is non-negotiable).
- **Detail at the same density inside and out.** Exposed interior ribs/formers should be
  sparser + coarser than exterior greeble. Don't carpet the cross-section.
```
