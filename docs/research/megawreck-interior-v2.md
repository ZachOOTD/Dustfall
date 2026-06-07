# Mega-wreck interior v2 — the broken guts of the dagger

*Concept for the from-scratch interior rebuild. SCRAPS the clean LEVEL spinal-corridor
interior (`CELLS` in `src/world/megaWreck.ts`). Grounded in `src/world/wreckForms.ts`,
`megaWreck.ts` (`hullAt`, `shellQuat`/`shellPos`, the loft stations), and the 4 research
findings. This is the design truth for the rebuild — not yet built.*

---

## 1. THE READ

You don't walk a hallway — you **climb through the cracked-open body of a fallen blade**.
You drop in through a torn breach in the buried bow, into a compartment that is *wrong*:
the whole world is canted ~17° to one flank, the floor you stand on is a settled deck-slab
that slid and jammed against the down-side hull, ribs claw out of the skin where the plating
peeled, and a sand-fan has poured in through the breach behind you. You scramble over a
buckled deck and a fallen bulkhead-ramp toward a stab of daylight ahead — that light is the
**FRACTURE**, the open-sky break where the dagger snapped in two, a cathedral cross-section
with two decks of torn floor exposed, dangling cables, and a former-rib skeleton you cross on
a collapsed-beam bridge. Beyond it the aft drops into a dark, tighter collapsed engineering
space lit only by flank breaches, then ramps up to the bridge under the command island — the
one near-intact, almost-level pocket, where the captain's log waits. Touchstones: Subnautica's
Aurora (breaches as light-beacons + sediment drifts), Dead Space's Ishimura (exposed pipes,
no softening), Event Horizon (canted gothic disorientation), and real wreck-dive photography
(silt as "rusty snowstorm," daylight stabbing through hull breaches into a dark moody hold).
The separator from "intact corridor with damage": **directionality of collapse** — everything
debris-flows, peels, and pools toward the down-rolled +X flank, because that's the side that
hit.

---

## 2. WHY THE CORRIDOR FAILED + THE NEW PRINCIPLE

**Why the corridor failed.** The current interior is the *exact anti-pattern the research
names*: a level box-cavity built at `y=0` with a tilted decorative shell draped over it. The
`CELLS` list is a sequence of clean axis-aligned rooms + a 3.5m spine corridor; the hull is
tilted separately by `shellQuat()` and "generously ENVELOPS the level interior boxes so none
poke through." Two failures compound:
- **Decoupled frames.** Inside is level; outside is listed ~17°. They are *two objects that
  happen to overlap*, not one broken ship. The player's gravity cue (level floor) contradicts
  every visual cue (canted hull, sloped horizon through the breach). The research calls this
  out directly: *"Decorative shell over disconnected box breaks alignment / Tilt applied only
  to visual, not colliders."* You feel it as a level-editor box, not a wreck.
- **Clean-corridor read.** Rectilinear rooms + a straight spine = "intact ship with cosmetic
  wear," not "violent wreckage." Research pitfall: *"Uniform symmetrical damage reads as intact
  with minor cosmetic wear."* The geometry has no collapse directionality, no exposed
  cross-section you traverse, no debris that flowed downhill.

**The new principle — one coherent broken object, interior-first, carrying the list.**
1. **Interior-first (Cosmoteer rule).** The interior volume is *derived from the hull
   cross-section* (`hullAt(z)` already gives `halfW/halfH/cy/dorsalY/keelY` per Z). Walls,
   floors, and ceilings sit a fixed inset *inside* `hullAt`, so the cavity is the literal
   inside of the skin — not an independent box the shell is wrapped around.
2. **The interior carries the list.** The walkable geometry is built in the **same shell frame**
   (`shellQuat`/`shellPos`) as the exterior — but *resolved into walkable footing* (see §4).
   Inside and outside share one transform; tilt is real, in the colliders, not faked.
3. **No clean corridors, no symmetric rooms.** The spine is replaced by a *chain of
   collapsed compartments* connected by breaches, fallen-bulkhead ramps, and the open
   fracture. Damage is asymmetric (down-+X-flank shattered, up--X-flank intact). The
   fracture cross-section becomes a *walkable space you cross*, not a backdrop.

---

## 3. SPATIAL LAYOUT

The dagger runs local **Z -47 (bow) → +76 (transom)**; `hullAt` interpolates two masses
(bow `-60..-5`, aft `+18..+76`) split at the **fracture** (`FRACTURE_Z=6`). The interior is a
**critical-path chain of 5 spaces**, each seated inside the `hullAt` cross-section, paced
dark→light→dark (research: tight-dark clusters punctuated by open cathedral moments). Entry is
a breach, not a door. Approx local-Z ranges and how each sits in the hull:

| # | Space | Local Z | Sits in hull (`hullAt`) | Light / feel |
|---|-------|---------|--------------------------|--------------|
| **E** | **Bow breach landing** | `-45..-37` | Bow mass `halfW≈10`, `halfH≈8`, `cy≈3`. Floor inset to keel side; sand-fan pours from the +X breach. | Bright entry shaft from the breach → drops to dark. Low ceiling (~3m). Compression. |
| **1** | **Torn bow compartment** | `-37..-17` | `halfW 10→11`. Buckled deck, one bulkhead peeled inward from the +X side; ribs exposed on the down-flank. | Dim. Side breach (`-1` lee) lets a thin shaft in. Sightlines blocked by a fallen bulkhead. |
| **2** | **Buckled mid-deck ramp** | `-17..-5` | Bow mass tapering to `BOW_FACE_Z`. A settled deck slab tilts up toward the fracture; debris foothold chain. | Daylight grows ahead (the fracture glow). Climb. |
| **3** | **THE FRACTURE — cathedral crossing** | `-5..+17` | **Open sky** between `BOW_FACE_Z=-5` and `AFT_FACE_Z=18`. Two torn cross-sections face each other (`hullAt(-5)` vs `hullAt(18)`); aft rides ~2m higher. | **Bright.** 12–14m ceiling void → daylight floods. Decks exposed at 2 levels, former rings, dangling cables. The money shot. |
| **4** | **Collapsed engineering aft** | `+17..+50` | Aft mass `halfW 11.5→13.5`, `halfH→14`, `cy→9.5` — the fat belly. Tallest space, but ceiling sags + a fallen reactor mass blocks center; you skirt the down-+X flank. | **Dark.** Lit only by two flank breaches (`+30 +X`, `+40 -X`) stabbing light. Reactor-room scale = release-then-compress. |
| **5** | **Bridge under the island** | `+50..+76` | Aft mass `halfW 13→9.8`, narrowing to transom; the command island sits at `ISLAND_Z=68` on the dorsal. Floor ramps **up +3m** to the bridge. | The near-intact pocket. Calmer, key-lit through the windscreen. Payoff. |

**Verticality through collapsed decks.** Only the **fracture (3)** stacks visible deck planes
(2 levels exposed at the cut, per research "fractured mid-hull = natural open atrium"); you
cross at the lower deck on a collapsed-beam bridge with the upper torn deck overhead. Every
other space keeps **≤2 floor planes in view** (research limit) — a settled main deck + the
debris/ramp you climb. No tall vertical shafts.

**How the LIST cants the floors + how it stays walkable** (the central problem — resolved in §4):
each space's *settled deck* is built **near-level in world-space inside the tilted hull**, as if
the deck slabs broke free, slid down the list, and jammed flat against the low-side structure.
Connective ramps (fallen bulkheads, buckled deck edges, debris stairs) bridge the small
height offsets between settled decks at **≤30° walkable slope** with debris footholds. The hull
*around* you carries the full ~17° list; the *floor under you* is a settled, near-walkable
deck — which is exactly what happens physically when a ship lists and its decks fail.

---

## 4. ALIGNMENT — inside agrees with outside

**The slide-vs-authenticity tension, resolved explicitly.** Two bad extremes:
- *Tilt the whole walkable floor 17°* → authentic but the player **slides/can't walk** (research:
  "slopes that slide," 17° is fine to stand but a continuous canted floor reads punishing and a
  long run accumulates drift), and it fights Rapier's snap-to-ground.
- *Keep the floor dead-level* → walkable but it's the **current failure** (disconnected box).

**Resolution — "settled decks in a listed hull."** The floor the player walks is built as a
chain of **near-level settled deck-slabs** (each tilted only **0–8°**, varied per slab so it
reads as *broken-and-jammed*, not a machined plane), positioned **inside the tilted hull frame**
so the *hull, ribs, ceiling, and breaches around the player carry the full ~17° list*, while the
*footing stays walkable*. Narratively: the decks tore loose, slid down-list, and settled against
the low-+X structure — so they sit lower and canted-toward-+X, but flat enough to traverse. This
is authentic (lists DO shear decks loose) **and** walkable. Steeper connective pieces (ramps
between settled decks, the fracture-crossing beam) stay **≤30°** with debris footholds; anything
the research calls un-walkable (>45°) is *visual-only debris*, never on the critical path.

**Concretely how the collidable interior sits inside + agrees with the shell:**
- **One shared transform.** Both the walkable interior *and* the exterior shell are emitted in
  shell-local space and pushed through `shellQuat()`/`shellPos()` (or the per-slab "settled"
  variant of it). Today only the exterior uses that transform; v2 routes the interior through it
  too — *that* is the fix. Colliders get `setRotation(shellQ-derived)` so physics tilts with the
  visual (research: "Tilt applied only to visual, not colliders" is the bug we kill).
- **Floors/ceilings/walls follow `hullAt`.** Each space reads `hullAt(z)` and insets: settled
  deck near `keelY + inset`, ceiling near `dorsalY − inset` (or the sagging hull underside),
  side walls at `±(halfW − inset)`. So the cavity *is* the inside of the skin — when the hull
  tapers/curves, the interior tapers with it. Inset ~0.6–0.9m (research: <0.4m feels cramped).
- **Breaches/fracture admit light AND are the entry/exit grammar.** Every interior light shaft
  originates at a **real exterior opening** at matched coordinates (research: "matched
  exterior-interior breach pairs at same coordinate"): the bow-breach entry (`E`), the flank
  breaches in (1) and (4) — the *same* `breachSites` the shell already cuts — and the open
  fracture (3). No light without a justified source (research pitfall: "light too obvious/UI-like").
- **Ceiling = the hull underside.** Where a space has a ceiling, it follows `dorsalY` and *sags*
  near breaches (curvature, not a plane — research: "tilted geometry without sag reads mechanical").
  The fracture (3) and the bow breach are *open* (no ceiling) so daylight floods.

---

## 4b. BUILD APPROACH — paired visual + collider descriptors

**Core discipline (kills frame-drift):** every walkable element is one **descriptor** consumed by
*both* the mesh builder and the collider builder — the proven pattern already in `megaWreck.ts`
(`cellWallBoxes` feeds both `makeMegaWreck` and `placeMegaWreck`). v2 generalizes it:

```ts
// One source of truth per walkable element. Built in SHELL-LOCAL space.
interface DeckPiece {
  x:number; y:number; z:number;      // shell-local center
  hx:number; hy:number; hz:number;   // half-extents
  tilt:[number,number,number];       // small euler (0..8° walkable; up to ~30° on ramps)
  mat?:THREE.Material;
  collide:boolean;                    // true = walkable+collider; false = visual debris only
}
```
- **Visual pass:** `box(2hx,2hy,2hz,mat)` + apply `tilt` + push through `shellQuat`/`shellPos`.
- **Collider pass:** `ColliderDesc.cuboid(hx,hy,hz)` with translation = `pos.applyQuaternion(shellQ).add(shellOff)` and rotation = `shellQ ∘ tiltQ`. **Only `collide:true` pieces get a collider** (research: "visual buckled geometry doesn't need colliders — only the walkable floor planes do"). This keeps the collider network a *clean tilted-cuboid compound* even though the visual reads chaotic.

**Element kit (all in `wreckForms.ts` vocabulary, extended where noted):**
- **Settled deck planes** — `DeckPiece collide:true`, tilt 0–8°, sized from `hullAt` inset. The walkable spine. ~2–4 per space.
- **Buckled slabs / debris piles** — `collide:false` boxes with 0–0.1rad random rot + 0–0.2m offset, *piled toward the down-+X flank* (gravity-flow, not scattered). Reuse `dentGeometry` for crumpled hull underside. Visual only.
- **Torn bulkheads (peeled inward)** — tapered box (thick base→thin edge), one per bow/engineering space, peeled from the +X side; `collide:true` only where it forms a ramp, else visual. Use `makeBreach`-style void behind it.
- **Exposed ribs/formers** — `makeFormerRings` at fracture faces + breach mouths + where plating peeled, **asymmetric** (research: parallel rows read as design, not failure). Visual.
- **Hanging structure** — `makeCable` (catenary sag) + conduit cylinders dangling from torn deck-edges DOWN to lower decks, in the shell frame so they hang correctly under the list. Visual, FrontSide, noCollider.
- **Light shafts** — `ConeGeometry(r, h, 16–32, openEnded)` + `AdditiveBlending` + `depthWrite:false`, base at each breach/fracture, aimed down-and-inboard, opacity ≤0.4, **cap at 3** (research perf limit). Plus 1–2 warm `PointLight`s at the brightest breaches. Silt particles only inside the lit cones.
- **Sand-fan ingress** — small `makeSandMound`-style drift *inside* the bow-breach landing, flowing from the breach down-list (sediment line). Visual.

**Shared shell transform = the lock.** Because the interior descriptors go through the *same*
`shellQuat`/`shellPos` as the shell, inside and outside are literally one rigid object: re-tilt
the ship and both move together. The hull `halfW/halfH` margin over the (now-tilted, but
inset-from-`hullAt`) interior guarantees no poke-through *by construction*, because the interior
is derived from `hullAt` minus an inset.

---

## 5. INTERACTABLES

All three keep their game-registration paths (`addShelterZone`, `registerSalvageable` +
`addAccessPanel`, `placeJournal`) and `worldOf(local)` mapping — but now the `local` points sit
on **settled decks in the listed frame**, and the registrations must use the *shell-tilted* world
position (push `local` through `shellQ/shellOff` before `worldOf`), not the old level position.

- **Shelter pocket** — a **sheltered settled nook** tucked against the **up--X (intact, lee)
  flank of the engineering/aft space (~Z 50–56)**, where the canted ceiling + a fallen bulkhead
  form a covered pocket out of the wind. Narratively: the one compartment that *didn't* breach.
  `addShelterZone` AABB sized by the cavity diagonal (as today) at the shell-tilted center.
- **Salvage panel #1** — on a **canted bulkhead in collapsed engineering (~Z 40, down-+X
  flank)**, lit by the +X flank breach shaft (research: spotlight 1 prop per compartment).
  `addAccessPanel(...,'massive')` flush to the settled wall, facing inboard.
- **Salvage panel #2** — on the **bridge console wall (~Z 71, +X)**, the near-intact payoff
  space, facing -X (as today, re-seated on the raised bridge deck).
- **Journal (captain's log)** — on the **bridge console (~Z 72)**, met on arrival at the
  end of the critical path, key-lit through the windscreen. `placeJournal(scene, worldOf(...),
  yaw+π, 'mega_wreck')`.

---

## 6. BUILD ORDER (tiers) + HARSH RUBRIC

**Build order** (each tier screenshot-iterated 3–8 rounds per CLAUDE.md rule 8; `npm run verify`
is NOT the gate for visual tiers):
- **I1 — Frame unification + walkable spine.** Route the interior through `shellQuat`/`shellPos`.
  Replace `CELLS` with the `DeckPiece` chain: 5 spaces, settled decks (0–8°) + connective ramps
  (≤30°), all paired visual+collider. **Goal: the player can walk bow→fracture→aft→bridge inside
  the listed hull without sliding or clipping.** Verify in-game (walk the whole path), not just tsc.
- **I2 — The fracture cathedral.** Build space (3): open-sky crossing, two torn cross-sections
  (`hullAt(-5)`/`hullAt(18)`), 2 exposed deck levels, former rings, collapsed-beam bridge
  (collide:true), dangling cables. The money shot.
- **I3 — Collapse + asymmetry pass.** Peeled bulkheads (+X side), buckled-slab debris piled
  down-+X, exposed ribs where plating tore, sagging ceilings near breaches. Ceilings/walls follow
  `hullAt`. Kill every rectilinear-room read.
- **I4 — Light + atmosphere.** ≤3 light shafts at real breaches/fracture, 1–2 PointLights, silt
  particles in the cones, sand-fan ingress at the bow breach. Dark→light→dark pacing.
- **I5 — Interactables + narrative props.** Shelter nook, 2 panels, journal re-seated on settled
  decks in the tilted frame; 1–3 spotlit crew props (helmet/suit). Register at shell-tilted world
  positions.
- **I6 — Polish + perf.** Curvature-zone rust/scorch in recessed creases (not uniform), merge
  static interior meshes by material (`perf-probe`), final traversal + collision audit.

**HARSH RUBRIC** — a tier is NOT done until every line is YES:
1. **Reads as crashed wreckage aligned to the hull?** Standing inside, the floor, ribs, breaches,
   and ceiling all carry the *same* ~17° list as the exterior horizon through the breach. It looks
   like the *inside of THIS ship*, not a box. (FAIL if the interior horizon contradicts the
   exterior shell.)
2. **Traversable?** Player walks the full bow→bridge critical path with no slide, no stuck slope.
   Every walkable surface ≤30° (decks ≤8°); >45° surfaces are visual-only and off-path. Step
   offsets between settled decks ≤ player step-height. (FAIL if you slide back or get wedged.)
3. **Collidable + matched?** Every `collide:true` deck/ramp/wall has a cuboid collider at the
   *same* shell-tilted transform as its mesh. No walking through floors, no invisible walls, no
   ghost geometry. Visual-only debris has NO collider. (FAIL on any mesh/collider drift.)
4. **No clean-corridor read?** Zero straight rectilinear corridor segments; zero symmetric rooms.
   Damage is asymmetric (down-+X shattered, up--X intact); debris flows down-list; the fracture is
   a *space you cross*. (FAIL if any stretch reads as "intact hallway with wear.")
5. **Inside agrees with outside?** Interior derived from `hullAt` (inset), built in the shared
   shell frame; light shafts originate at the *same* breach/fracture coords the shell cuts; hull
   never pokes through (guaranteed by inset). Re-tilting the ship moves both as one. (FAIL if
   inside is a separate object overlapping the shell.)

---

### One-paragraph summary

**The read:** you climb through the cracked-open guts of a fallen dagger — a canted, debris-flowed,
breach-lit wreck where the floor, ribs, and breaches all carry the same ~17° list as the hull
outside, scrambling bow→fracture→aft→bridge over settled decks and collapsed beams toward stabs of
daylight. **The spatial concept:** a 5-space critical-path chain seated *inside* the `hullAt`
cross-section — bow-breach landing (Z -45) → torn buckled bow compartment → up-ramp to the open-sky
**FRACTURE cathedral** (the money shot, two exposed deck levels crossed on a fallen beam) → dark
collapsed engineering aft lit only by flank breaches → up-ramp to the near-intact bridge payoff —
all built in the shared `shellQuat`/`shellPos` frame so inside and outside are ONE broken object,
not a level box under a tilted shell. **First 5 build steps:** (1) route the interior through
`shellQuat`/`shellPos` (the core fix); (2) replace `CELLS` with a `DeckPiece` chain of 5 spaces,
each a paired visual+collider descriptor consumed by both the mesh and collider builders; (3) build
settled deck planes (tilt 0–8°) + connective ramps (≤30°, debris footholds) so the path is walkable
inside the listed hull; (4) inset floors/ceilings/walls from `hullAt(z)` so the cavity is the literal
inside of the skin and tapers with the hull; (5) build the fracture cathedral crossing at the open-sky
break (Z -5..+17). **Slide-vs-list resolved:** the *hull/ribs/ceiling/breaches around the player carry
the full ~17° list*, but the *floor under the player is a near-level settled deck* (0–8°, varied per
slab) — narratively the decks sheared loose, slid down-list, and jammed flat against the low-+X
structure: authentic (lists DO shear decks) AND walkable, with steeper connective ramps capped at 30°
and anything >45° demoted to visual-only off-path debris.
