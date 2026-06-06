# Mega-Wreck — Unified From-Scratch Concept (sleek dagger + new narrow interior)

> Synthesis of 4 research facets (derelict-interior atmosphere, 120m-scale wreck/dungeon
> layout, low-poly procedural Three.js interior architecture, dagger capital-ship exterior).
> Replaces the old wide cargo-bay interior wholesale. Grounded in the real toolkit
> (`src/world/wreckForms.ts`) and the existing build/placement conventions in
> `src/world/megaWreck.ts`.
>
> **Local-space convention (KEEP — matches the current file):**
> `+Z` = aft / engine end, `-Z` = bow tip, hull long-axis is `Z` (~120m).
> `y=0` = nominal walkable floor; walls bury below via `WALL_BURY`.
> The exterior `shell` Group is tilted (roll + nose-down pitch) and sunk; the
> interior collidable boxes stay LEVEL so the cavity is walkable while the ship
> visibly lists. The shell ENVELOPS the interior boxes so no corner pokes through.

---

## 1. CONCEPT

The mega-wreck is a sleek ~120m narrow-dagger warship that **snapped in two at the
spine amidships and drove nose-first into a dune** — you enter through a torn ventral
hull breach near the bow, walk a single claustrophobic 3-4m spinal corridor that
threads the length of the ship through a sequence of branch compartments, cross the
open-sky **mid-hull fracture** (the cathedral beat where the two masses pulled apart
and you see decks/ribs/cables cut clean through), and arrive at the elevated **bridge**
at the far aft end as the payoff: the captain's log, the salvage, and a sealed pocket
to shelter in. Asymmetric impact damage, light shafting in from breaches as wayfinding
beacons, and half-burial in the lee dune make it read as *one downed ship that something
terrible happened to* — not a cluster of boxes.

---

## 2. EXTERIOR — the dagger

**Proportions.** Length **~120m** along Z, max beam **~22-26m** (use `~24m`, i.e.
`halfW ≈ 12`), height above sand **~18-22m** at the amidships peak. Length:width
**≈ 5:1** — deliberately narrower than the old 45m-wide hauler so the silhouette reads
as a *blade*, not a brick. Greeble spacing tightens to **every 1-2m** on the narrow hull
(denser than a wide ship) so the implied interior-compartment scale reads correctly.

**Tapered profile (two lofted masses, `makeLoftedHull`).** The faceted ship cross-section
(flat keel, hard chines, vertical sides, flat dorsal deck) lofted along Z through
stations whose `halfW`/`halfH` taper:
- **Bow mass (-Z, ~0 to ~55m of the length):** a sharp wedge. Nose fineness ratio
  **1.5-1.7** (sharp apex, NOT blunt). Stations taper from a near-point crushed tip
  (`halfW ≈ 1.5, halfH ≈ 2`, low `cy` — buried) up to the fracture face
  (`halfW ≈ 11, halfH ≈ 9`). The bow rises toward the fracture (driven-in nose lower).
- **Aft mass (+Z, ~60 to 120m):** widest amidships at ~55-65% of length
  (`halfW ≈ 13, halfH ≈ 12`), tapering to a **blunt low transom** at the stern
  (`halfW ≈ 11, halfH ≈ 9`), with the roofline raking down toward the transom.

**The two masses + mid-hull fracture (the hero / "money shot").** A clean spine-snap at
**~Z=57** (the ~55-60m mark). The two masses are **vertically offset by 2-4m** and
counter-tilted (Titanic-style: aft rides higher, bow nose-down). The ~15-20m gap is a
**cut-open cross-section**, NOT an opaque slit:
- a near-black interior backboard plane behind it so depth reads,
- **`makeFormerRings`** on both torn faces (countable exposed ribs),
- **recessed full-width deck slabs staggered in Y between the two faces** (countable decks),
- a **bent two-segment spine/keel stub** low-center ("broke its back"),
- **`makeCable`** danglers drooping from the upper deck edges to the floor,
- **`makeBreach`** torn-flap rims around the gap edges.

**Command tower / bridge island.** A stepped 4-5 deck wedding-cake island at **true
amidships on the AFT mass** (just aft of the fracture, ~Z=70), height **12-18m** above
the dorsal deck so it dominates the skyline. Offset off-center toward the **+X impact
flank** + framed viewport clusters (dark `_viewportMat`) + a raked windscreen + a
leaning sensor mast/dish array on the crown (bent on impact). This is the recognition
anchor — and (NEW) it now has a walkable interior (§3).

**Engine bank.** **3 clustered nozzles** at the stern transom (`makeEngineBellMesh`),
~5-6m diameter, on an exposed torn mount cage (`TorusGeometry` ring + radial struts) so
they read ripped from their housing. Asymmetric: with the ship rolled, one bell points
skyward, one is half-buried/twisted in the dune.

**Crash pose.** Nose-down pitch **~6-15°**, roll **~11-20°** toward the +X impact flank,
keel buried. Achieved by tilting the whole `shell` group (`shell.rotation.z`,
`shell.rotation.x`, `shell.position.y = sink`) while interior boxes stay level.

**Half-burial.** `makeSandMound` drifts heaped against the **-X lee flank** (impact +X
flank stays exposed for breaches/debris/panels) + a big mound swallowing the driven-in
bow nose. Bury to **~35-40% of hull height** so it reads "settled into the dunes."

**Entrance breach.** A torn ventral/flank breach on the **bow mass, +X impact flank,
near the bow at ~Z=-40 (about 8-10m offset from the fracture, asymmetric)**, ~4-6m,
`makeBreach` flaps + recessed void. From outside it should frame a glimpse of the
interior corridor mouth beyond (the "way in" read) — light shafts INTO the corridor
through it.

---

## 3. INTERIOR LAYOUT — the new narrow walkable concept

**Replaces** the old wide aft cargo-bay + side-room + catwalks. New model: **one legible
spinal corridor** running most of the 120m length, with **modular branch rooms off it**,
a single open-sky fracture crossing, and the bridge as the elevated payoff.

**The spine (the critical path, ~70-90m of legible route).** A single corridor along Z:
- **Width 3.5m** (`SPINE_HALF_W = 1.75`), **height 3m** (`SPINE_HALF_H = 1.5`,
  floor `y=0` → ceiling `y=3`). Human-scale, claustrophobic even when "open."
- It is NOT dead straight: a **kink/jog at each bulkhead** (±1-2m lateral, every
  ~12-15m) breaks tunnel monotony and hides sightlines so each new room is a reveal.
- Built as straight **BoxGeometry corridor segments** between rooms (floor + 2 side
  walls + ceiling per segment), each ~12-15m long, with a **bulkhead doorway**
  (~2m wide × 2.4m high `panelWithHole`) at each room threshold.

**Branch rooms (6 chambers along the spine, fore → aft):**

| # | Room | Local Z center | Footprint (W×L×H) | Role |
|---|------|----------------|-------------------|------|
| R1 | **Entrance breach hall** | Z ≈ -42 | 8×10×4 | Where the bow breach drops you in; rubble ramp up to spine floor; first light shaft. |
| R2 | **Crew / med bay** | Z ≈ -22 | 7×10×3 | Bunks, lockers, a med station; personalized wear; off a short spur (dead-end + loot). |
| R3 | **Fractured mid-section (crossing)** | Z ≈ -5 to +20 | open, ~16 wide | The OPEN-SKY beat: corridor floor breaks; you cross a **fallen-bulkhead ramp + 2 debris steps** over the gap; daylight + cables + cut decks above. Cathedral swing. |
| R4 | **Engine / reactor room** | Z ≈ +35 | 10×16×6 | Tallest interior volume, machinery maze (pipes/conduits/cylinders), red emergency tint, scary "off-limits" core glow at the back. A 1-2 step ladder/ramp DOWN into it (verticality). |
| R5 | **Cargo / mess junction** | Z ≈ +52 | 9×12×4 | A wider social/storage junction; the spine widens briefly; a spur to the **shelter pocket**. |
| R6 | **BRIDGE (payoff chamber)** | Z ≈ +70, in the command island | 9×9×4, raised +3m | Largest sightline, elevated platform reached by a short stair, raked viewport wall (looks out over the desert through the windscreen), captain's chair/console. THE destination. |

**Verticality (keep to 2 floor planes — rule from research: avoid 4+).**
- **Upper plane:** spine floor at `y=0` running fore→aft, and the bridge platform at `y≈+3`.
- **Lower plane:** the engine room (R4) sits ~1.5-2m below the spine, reached by a
  visible **ramp/short ladder** off the spine — the only down-step.
- Each elevation change is **visible from the chamber it exits** (stenciled deck marker,
  dangling chain), per wayfinding rules.

**Light shafts as wayfinding.** Breaches/skylights drop **additive `ConeGeometry` light
shafts** (`THREE.AdditiveBlending`, `depthWrite=false`, opacity 0.3-0.5) paired with a
`PointLight(decay=2, distance=15-25, no shadow)` AT each major beat: the entrance breach
(R1), 2-3 small flank tears along the spine, the fracture (R3, full daylight), one
skylight over the bridge (R6). The player is always pulled toward the next lit chamber;
the critical path is never fully dark. Engine room (R4) gets a **red emergency-strip**
tint only (no white light) for contrast.

**Shelter pocket (the safe beat).** A small **5m × 4m × 3m** secured alcove off R5
(cargo/mess junction), ~1/3-to-1/2 into the interior from the entrance, **not** adjacent
to the bridge or the breach. Visual "secured" markers: an intact pressure bulkhead, less
corrosion, intact furniture, a working light. This is the rest beat in the intensity curve.

**Where the interactables sit:**
- **Salvage panel #1 (`massive`)** — **Engine room (R4)** back wall, on the machinery
  maze (the highest-tension chamber → highest-value salvage read).
- **Salvage panel #2 (`massive`)** — **Bridge (R6)**, on the console/side wall beside
  the captain's station (rewards reaching the payoff).
- **Journal (captain's log)** — on the **captain's console in the Bridge (R6)**, the
  natural place for a last log; mid-platform so the player meets it on arrival, not by
  searching wall edges.
- *(Optional exterior salvage — keep the existing ground-reachable pattern: 1-2 hull
  panels on the most-walkable exterior faces so the wreck stays fully salvageable from
  the sand without scaling it. These are additive, not part of the 2 required.)*

**Approx local footprint check.** Spine + rooms span local Z ≈ **-47 → +75** (~122m),
max interior half-width ~8 → fits inside the dagger hull (aft `halfW ≈ 13`, bow tapering).
Every interior box stays inside the lofted shell envelope at the tilt.

---

## 3b. INTERIOR ↔ EXTERIOR

- The **exterior dagger** is the lofted `shell` Group (`makeLoftedHull` masses + fracture
  cross-section + island + engines + plating + breaches). It is **all `FrontSide`,
  `userData.noCollider = true`**, and **tilted + sunk** (roll/pitch/`position.y`). It is
  purely visual — the "skin" of the ship.
- The **interior** is a separate set of **axis-aligned, LEVEL, collidable BoxGeometry**
  corridor + room walls (with `panelWithHole` doorways), on a single fixed Rapier body.
- **The shell ENVELOPS the interior boxes.** Loft stations use a generous multiplier
  (~×1.3-1.4 on `halfW`/`halfH`, as the current file does) so even when the shell is
  rolled ~11-20° and pitched, **no interior box corner pokes through the hull** — the
  hull reads as the *outer plating around* the inner structure. The interior walls become
  "inner bulkheads" seen from inside; the lofted hull is the outer skin seen from outside.
- **Breaches register where light enters.** Each exterior `makeBreach` / skylight is
  positioned over a hole in the corresponding interior wall/ceiling (a `panelWithHole`
  gap in the collidable box), so the additive light shaft + `PointLight` actually reach
  the walkable floor. The big fracture (R3) is the cleanest case: the interior corridor
  is simply OPEN (no ceiling, no far wall) across the gap, and the exterior cross-section
  geometry is what you see overhead.
- **Mismatch is fine** where unseen: the tilted hull may dip below the level floor at the
  buried bow — that volume is sand-occluded and never entered.

---

## 4. COLLISION + INTERACTABLES PLAN

**Approach (KEEP the current proven pattern):** a **single fixed Rapier body**
(`RAPIER.RigidBodyDesc.fixed()` at `pos`, rotated by `finalQ`), with **hand-authored
cuboid colliders** (`RAPIER.ColliderDesc.cuboid(...).setTranslation(...)`). **No**
`attachCompoundCollider`, **no** trimesh, **no** boolean. Target **~30-40 cuboids** total
(the narrow spine is cheaper than the old wide bay + catwalks).

**Corridor segments (per ~12-15m straight run):**
- Floor cuboid (`SPINE_HALF_W` × thin × seg-half-len).
- Left + right wall cuboids (thin × `SPINE_HALF_H` × seg-half-len).
- Ceiling cuboid (`SPINE_HALF_W` × thin × seg-half-len).
- Where a wall meets a bulkhead doorway, **split that wall around the door**
  (`panelWithHole` visual + 4-piece collider split: below-buried, lintel, left jamb,
  right jamb) — the exact pattern the current file uses for the bow entrance & side-room
  door. The doorway opening itself has **no collider** (you walk through).

**Branch rooms (per room):** 4 wall cuboids + floor + ceiling, with the spine-facing wall
split around its doorway. Reuse the room as a `box`-walled chamber exactly like the
current aft/side-room construction (just smaller).

**Fracture crossing (R3):** the open gap has **no ceiling/no far-wall colliders**; the
**fallen-bulkhead ramp + debris-step** cuboids (tilted via `setRotation` quaternion, the
current ramp pattern) carry the player across. Side rails optional.

**Vertical access (engine room down-step):** a tilted ramp cuboid + 1-2 step cuboids
(current "stack of debris steps" pattern).

**Bridge platform (R6):** a raised floor cuboid at `y≈+3` + a short stair (2-3 step
cuboids) up from the spine.

**Interactable registration (KEEP the current APIs):**
- **Shelter zone** — `addShelterZone(shelter, centerWorld, halfExtents)`. Cover the
  **shelter pocket alcove** (the 5×4 secured room) — sized by the diagonal trick so the
  AABB still covers the rotated cavity: `halfExtents ≈ { x: √(hw²+hl²), y: roomHalfH+0.5,
  z: √(hw²+hl²) }`, centered at the alcove's world position
  (`localCenter.applyQuaternion(finalQ).add(pos)`). *(If a larger safe interior is wanted,
  the shelter AABB can instead span the aft half of the spine — but the dedicated 5×4
  pocket is the intended "secured" read.)*
- **Salvage panel #1 + #2** — for each: build a `THREE.Group`, set its body-local
  `position` + `rotation.y` (facing into the room), `addAccessPanel(p, 0,0,0, 1,0,
  'massive')`, then `p.updateWorldMatrix(true,false)` and `registerSalvageable(salvageables,
  p, 'massive', matrixWorldPos, rand)` — the `registerNested` helper already in the file.
  #1 → engine-room (R4) back wall; #2 → bridge (R6) console wall.
- **Journal** — `journals.list.push(placeJournal(scene, journalWorld, journalYaw,
  'mega_wreck'))`, where `journalWorld = bridgeConsoleLocal.applyQuaternion(finalQ)
  .add(pos)`. On the bridge captain's console.
- **Debris field** — keep `placeDebrisField(scene, terrain, pos, 50, rand, 40)` outside,
  plus interior debris piles (boxes/equipment) as `noCollider` decoration along the spine.

---

## 5. BUILD ORDER (ordered, each verifiable)

Each tier: build → **screenshot via the `megawreck` rig-shot** (`scripts/rig-shot.mjs`) →
critique → iterate **5-8 rounds for new visual elements, 3-5 for tuning** (CLAUDE.md
rule 8). `npm run verify` clean is necessary but **NOT** the success gate for visual tiers.

- **T0 — Constants + scaffold.** Define the new local-Z layout constants (spine half-dims,
  6 room Z-centers/footprints, fracture Z-range, island Z). Stub `makeMegaWreck` returning
  an empty `g` + empty `shell`. *Verify: `npm run verify` clean, rig-shot renders nothing
  broken.*
- **T1 — Exterior dagger silhouette.** `makeLoftedHull` bow mass + aft mass (tapered,
  ~5:1, sharp nose, blunt transom, dorsal deck), tilted + sunk shell. *Verify: rig-shot
  from 3 angles — reads as a sleek crashed blade, not a brick; ≥4:1; nose sharp.*
- **T2 — Mid-hull fracture cross-section.** The 15-20m gap: backboard + `makeFormerRings`
  ×2 faces + staggered deck slabs + bent spine stub + `makeCable` danglers + `makeBreach`
  rims + the 2-4m vertical offset between masses. *Verify: rig-shot of the fracture —
  countable decks + ribs, reads as a snapped spine with depth, not an opaque slit.*
- **T3 — Interior spine + rooms + colliders.** The 3.5×3m corridor (segments, kinks,
  bulkhead doorways) + R1/R2/R4/R5 box rooms + all cuboid colliders + the fracture-crossing
  ramp. *Verify: walk end-to-end in-app (entrance breach → spine → fracture cross → aft
  rooms); no fall-through, no stuck doorways; collider count ~30-40.*
- **T4 — Bridge payoff + interactables.** Command island exterior (stepped decks, viewports,
  windscreen, mast/dishes) + the WALKABLE bridge interior (R6 raised platform + stair +
  console + raked viewport wall) + register shelter zone (pocket), 2 salvage panels (R4 +
  R6), journal (R6 console). *Verify: in-app — reach bridge, shelter registers (stat icon),
  both panels prysalvage, journal reads; engine bells visible at stern.*
- **T5 — Light + atmosphere.** Additive `ConeGeometry` shafts + `PointLight`s at each beat
  (entrance, flank tears, fracture daylight, bridge skylight) + red engine-room tint +
  interior dust/haze; flicker/dead-light variety. *Verify: rig-shot interior — light shafts
  guide eye toward the next chamber; not fully-dark, not fully-lit; engine room red.*
- **T6 — Burial + debris.** `makeSandMound` lee-flank drifts + buried bow-nose mound + nose
  scorch disc + `placeDebrisField` + interior debris piles + scorch around the entrance
  breach. *Verify: rig-shot wide — reads "settled into the dunes," ~35-40% buried, asymmetric
  drift reinforces the list.*
- **T7 — Surface greeble + asymmetry pass.** Dense (1-2m spacing) hull strakes/plating,
  flank panels, vents, antenna stubs, asymmetric breaches (+X flank shattered, -X one small
  tear), functional pipe runs with junction boxes. *Verify: rig-shot — narrow hull reads at
  100m, greeble density sells the scale, damage reads one-sided/"this happened."*
- **(T8, optional perf, never-cut) — `mergeGeometries`** the static shell + interior meshes
  by material (panels/colliders/pickups stay separate); measure via `perf-probe`.

---

## 6. HARSH RUBRIC (yes/no — must pass BOTH exterior + interior)

**Exterior — "reads as a sleek crashed dagger":**
1. Is the length:width ratio **≥ 4:1** (a blade, not a brick) at every viewing angle?
2. Is the **nose a sharp wedge** (fineness ≥1.5), not blunt/squared?
3. Are there **two distinct masses** with a **visible 2-4m vertical offset + counter-tilt**
   at the fracture (reads as a break, not a dent)?
4. Is the **fracture a real cut-open cross-section** — countable decks AND ribs AND a spine
   stub AND cables AND depth — NOT an opaque black slit?
5. Does the **command island dominate the skyline** at true amidships on the aft mass
   (not bow, not stern)?
6. Is the **damage asymmetric** (one flank shattered, the other near-intact) so it reads
   "this happened," not a symmetric design feature?
7. Is the ship **listing + nose-down + ~35-40% buried**, with **asymmetric sand drift** on
   the lee flank (not sitting flat on the surface)?
8. Does the **greeble density (1-2m)** sell the implied interior scale on the narrow hull
   (it reads LARGER, not smaller, than a sparse wide ship)?

**Interior — "reads as a real explorable ship interior":**
9. Is there **one legible spinal corridor** (3-4m wide, ~3m high) that is the obvious
   main throughway, with branch rooms clearly OFF it (hub-and-spine, not a maze)?
10. Can the player **walk end-to-end** entrance-breach → spine → fracture-crossing → bridge
    with **no fall-through, no stuck doorways, no dead-end traps without reward**?
11. Does the interior have the **claustrophobic-then-cathedral rhythm** — narrow corridor
    breaking into the open-sky fracture and the engine-room volume — not uniform tunnel?
12. Is the **bridge an unmistakable payoff chamber** — elevated, largest sightline, raked
    viewport, holds the journal + a salvage panel?
13. Do **light shafts from breaches/skylights guide the player forward** toward the next
    chamber (critical path never fully dark, never flatly lit)?
14. Does the **shelter pocket read as genuinely secured** (intact bulkhead, less corrosion,
    its own light), isolated from the breach/bridge, and does the shelter zone register?
15. Do **both salvage panels + the journal** sit in sensible, discoverable spots (engine
    room, bridge) that the player meets on the natural path, not by edge-searching?
16. Does the **interior nest cleanly inside the tilted exterior hull** — no box corner
    pokes through the FrontSide shell, and breaches actually let exterior light onto the
    walkable floor?

---

## SUMMARY (return)

**Concept:** a sleek ~120m narrow-dagger warship (≈5:1, sharp nose, blunt transom) that
snapped in two at an amidships spine-fracture and drove nose-first into a dune — listing,
nose-down, ~35-40% buried in an asymmetric lee drift — that you enter through a torn bow
hull breach and walk through to the bridge. **Interior:** a single claustrophobic 3.5m×3m
spinal corridor (with kinks + bulkhead doorways) threading the length, off which hang 6
chambers fore→aft — entrance breach hall, crew/med bay, the open-sky mid-hull fracture you
cross on a fallen-bulkhead ramp (the cathedral beat), a lower engine/reactor room (salvage
panel #1, red light), a cargo/mess junction holding a 5×4 secured **shelter pocket**, and
the elevated **bridge** payoff (salvage panel #2 + the captain's-log journal); 2 floor
planes, light shafts from breaches as wayfinding, all built as level collidable
BoxGeometry inside a tilted FrontSide lofted dagger shell that envelops it. **First 5 build
steps:** (1) T0 lay down the new local-Z layout constants + stub `makeMegaWreck`; (2) T1
loft the two tapered dagger masses (sharp nose, blunt transom) and tilt+sink the shell;
(3) T2 build the mid-hull fracture cross-section (former rings + staggered deck slabs +
spine stub + cables + the vertical offset); (4) T3 build the spine corridor + R1/R2/R4/R5
box rooms + all cuboid colliders + the fracture-crossing ramp, and walk it end-to-end;
(5) T4 build the bridge payoff chamber + register the shelter zone, 2 salvage panels, and
the journal. File to edit: `C:\Users\Zach\projects\dustfall\src\world\megaWreck.ts`;
toolkit: `C:\Users\Zach\projects\dustfall\src\world\wreckForms.ts`.
