# Mega-Wreck POI — Star Destroyer-scale crashed ship (Sessions BB-2 + BB-3)

## Context

The current "mega-ship" POI at `src/world/megaShip.ts` (12 × 5 × 3m, central
dunes) is a satisfying small wreck. The user wants a TRULY massive crashed
ship in the same world — Force Awakens / Jakku scale, with multi-room
interior, catwalks, giant engines, half-buried, surrounded by debris.

Literal "100×" linear scale is impossible (would exceed the 800m terrain).
User picked **~120m long × 45m wide × 30m tall** visible above sand —
about 10× linear and 1000× volume vs the current mega-ship. Dominates the
skyline; visible from much of the playable area through fog.

This is a **two-session build** (~13h total). Each session must ship
something the user can walk into.

### Visual reference (Force Awakens Inflictor on Jakku)

Wedge silhouette, bow buried in sand, stern + bridge tower exposed, hull
rents revealing internal bays, "David and Goliath" scale contrast,
surrounding debris field of smaller crashed ships. The wreck is what the
player sees on the horizon before deciding it's worth the walk.

---

## Position

**`(-180, 0, -130)`** in world space. Sized + oriented as a long ship with
long axis ~30° off east. Selected from candidate sweep:

- Spawn at `(-55, 0)` → distance ~180m to wreck center. Bow tip (~60m
  forward of center) sits at ~120m from spawn, **inside fog** for a
  partial reveal. Bridge tower fades into fog at the limit — the "ruin
  in the haze" read.
- Clears every existing POI by 100m+:
  - antenna_outpost (-88, -50) at 120m
  - small mega-ship (-120, 30) at 170m
  - crashed_hull (18, -110) at ~200m
- SW quadrant is currently unused — pulls the player into new territory.

Empirical biome + terrain checks at runtime (see verification).

---

## Hull architecture

**Three hull sections in a row** along the ship's long axis. Composite
gives chamber separation for free; box-collider patterns scale cleanly.

| Section | Local Z range | Visible dims | Role |
|---|---|---|---|
| **Bow** | -60 to -25 | 30L × 18W × 8H | Narrow, deeply buried + nose-down. Chamber 1. |
| **Mid-hull break** | -25 to -10 | (open) | Torn spine — player walks through dunes between sections. Iconic FA Jakku rent. |
| **Aft** | -10 to +50 | 50L × 40W × 22H | Cavernous engine bay (Chamber 2) + side room (Chamber 3). |
| **Bridge tower** | mounted on aft top | 12m tall pylon | Visual landmark only; partially climbable in BB-3. |
| **2 giant engine bells** | rear of aft, ~10m Ø each | exterior | Salvage points. |

**Per-section burial**: bow section's origin Y is offset downward more
than aft's so the natural nose-dive pose is built into the geometry, NOT
the runtime tilt. Lets us keep `placePOIs` tilt-cap small without
sacrificing the silhouette.

Wedge silhouette is achieved by **bow narrow + aft wide**, not by skewing
geometry. All walls stay axis-aligned; colliders stay cuboid.

---

## Catwalks + interior verticality (BB-3)

Three catwalks in the **main aft bay**, all single box-meshes with single
cuboid colliders.

| Catwalk | Y above bay floor | Notes |
|---|---|---|
| Lower | 3m | Runs full length along one interior wall, 1.8m wide |
| Upper | 7m | Perpendicular crossing across the bay |
| Bridge-overlook stub | 11m | Short dead-end. Holds best salvage panel. |

**Access** (no ladders — collider complexity not worth it):
- Mid-hull break: tilted broken hull plate doubles as **30° ramp** into
  the lower catwalk.
- Lower → upper: a **fallen interior bulkhead** lying diagonally (single
  box-mesh + box-collider, 25° pitch).
- Upper → bridge-overlook: **3 box-mesh debris stack** acts as steps.

No fall damage (per user). The down-trip is a hop. Total catwalk colliders: **5 box-cuboids**.

---

## Lighting strategy

Sequenced from "naturally lit" to "dark requires torch" as you move
deeper. Forces the AA torch/flashlight to matter without making the wreck
unfair.

| Chamber | Light | How |
|---|---|---|
| Chamber 1 (Bow) | Naturally lit | Large ragged opening on the side, no door |
| Mid-hull break | Sky direct | Open to atmosphere |
| Chamber 2 (Main aft bay) | Partially lit | 3 skylights via `panelWithHole` in upper hull + torn section above engine bells. Bright pools, deep shadow corners. |
| Chamber 3 (Side room) | **Fully dark** | Off the main bay via internal bulkhead doorway. No skylights. **Best loot panel here.** |

---

## Salvage panels — 8 total, mixed kinds for loot variety

| # | Location | Kind | Phase |
|---|---|---|---|
| 1 | Main aft bay lower deck | `massive` | BB-2 |
| 2 | Bow chamber | `massive` | BB-2 |
| 3 | Main aft bay upper catwalk dead-end | `massive` | BB-3 |
| 4 | Bridge-overlook stub (best position) | `massive` | BB-3 |
| 5 | Side room (Chamber 3) | `massive` | BB-3 |
| 6 | Engine bell A (exterior) | `engine_bell` | BB-3 |
| 7 | Engine bell B (exterior) | `engine_bell` | BB-3 |
| 8 | Antenna spire on bridge tower (exterior, climb to reach) | `antenna_spire` | BB-3 |

Per-panel sub-group pattern from `src/world/megaShip.ts:609-633`:
- Create `new THREE.Group()`, position it at the panel's local location
- `addAccessPanel(subgroup, 0, 0, 0, scale, faceYaw)` — fills
  `subgroup.userData.accessPanel`
- `registerSalvageable(salvageables, subgroup, kind, worldPos(subgroup.position), rand)`

---

## Phase split

### BB-2 (~7h) — minimum playable shell

End state: player can walk from entrance through all three sections; the
wreck reads as a POI from the horizon. Rough but functional.

**Build**:
- New file `src/world/megaWreck.ts` with `makeMegaWreck` + `placeMegaWreck`
- All 3 hull sections as box-walls (bow + aft + bridge tower)
- 2 giant engine bells (visual only, no salvage in this phase)
- One large side entrance on the bow chamber
- Mid-hull break (open passage)
- Internal doorway from bow → main aft bay
- All exterior wall + roof colliders (cuboid only — **no
  `attachCompoundCollider` on the root**)
- 2 salvage panels (1 main bay lower deck, 1 bow chamber)
- Shelter zone covering main aft bay (oversized AABB)
- POI registration in `src/world/poi.ts`:
  - Add `'mega_wreck'` to `POISpec.kind` union
  - Add `{ kind: 'mega_wreck', x: -180, z: -130 }` to `POI_LAYOUT`
  - New dispatch case mirroring `mega_ship` but with **expanded flat-spot
    search** (8 angles × `[10, 20, 30]` radii) and **larger terrain
    sample window** (5×5 at 8m spacing in `terrainVarAt`)
  - Tilt cap tightened from `0.25` → `0.10` rad so the wreck doesn't
    over-tilt at 120m length
  - WALL_BURY scaled to **6-8m** internally in megaWreck.ts

### BB-3 (~6h) — verticality, detail, polish

**Build**:
- All 3 catwalks + 3 ramps
- Side room (Chamber 3) via bulkhead doorway off main bay
- 3 skylights via `panelWithHole` in main bay upper hull + 1 ragged
  opening in bow chamber wall
- Remaining 6 salvage panels (per table above)
- Bridge tower climb (debris-pile steps + leeward hull-fragment ramp)
- Interior detail pass on main bay + bow: hanging pipes, conduits, broken
  consoles, rust, hull-plate fragments around openings (reuse exact
  patterns from `src/world/megaShip.ts:188-377`)
- Exterior detail: hull-plate seams, rust streaks, broken antenna stubs,
  surrounding debris field via `placeDebrisField(scene, terrain, pos, 50,
  rand, 40)`
- 2-3 small "companion wreck" props (using existing `placeWreck` from
  `src/world/wrecks.ts`) placed 30-60m around the mega-wreck for
  scale-reference

---

## Critical files

| File | Action |
|---|---|
| `src/world/megaWreck.ts` | **NEW** — main file. ~600 lines projected. |
| `src/world/poi.ts` | EDIT — add `'mega_wreck'` to union + dispatch + expanded flat-spot search |
| `src/world/megaShip.ts` | UNCHANGED — small mega-ship stays as separate smaller POI |
| `src/world/openingWreck.ts` | UNCHANGED — opening wreck stays |

### Existing utilities to REUSE (don't reinvent)

- `src/world/panelUtils.ts` → `panelWithHole(W, T, D, cu, cv, hw, hd, mat)`
- `src/world/wrecks.ts` → `addAccessPanel(group, x, y, z, scale, faceYaw)`
- `src/world/wrecks.ts` → `placeDebrisField(scene, terrain, center, radius, rand, count)`
- `src/world/wrecks.ts` → `placeWreck(scene, world, terrain, pos, kind, rand, opts)` for companion wrecks
- `src/world/salvage.ts` → `registerSalvageable(registry, group, kind, pos, rand)`
- `src/shelter/shelterZones.ts` → `addShelterZone(reg, pos, half)`
- `src/world/megaShip.ts` (read for reference, not modified) — sub-group salvage pattern at lines 609-633; tilt + flat-spot pattern at lines 540-583

---

## Perf budget

~**600 meshes maximum** for the entire mega-wreck. The small mega-ship is
111 meshes at 12m; 10× linear ≠ 10× detail. Detail scales with
surface-area-facing-player. Front-load near entrance + along expected
path.

| Bucket | Mesh budget |
|---|---|
| Hull shell (3 sections walls/roof + colliders) | ~30 |
| Bridge tower | ~25 |
| Engine bells (×2) | ~60 |
| Catwalks + ramps | ~10 |
| Salvage panels (8 × ~3 each) | ~24 |
| Interior pipes/conduits (main bay + bow only — **none in dark side room**) | ~150 |
| Exterior seams/rust/fragments | ~200 |
| Surrounding wreckage debris + companion wrecks | ~100 |

No LOD system — all meshes pay frustum-culled render cost. **Profile FPS
on entry in BB-2 before committing to BB-3's detail pass.** If <60 FPS in
foreground with shadows ON, cut interior conduits first.

---

## Architectural risks (from Plan agent)

1. **Don't use `attachCompoundCollider`** on the megaWreck root. Hand-author
   every cuboid collider. ~25-30 colliders on the rigid body is fine for
   Rapier but `attachCompoundCollider` would multiply this by mesh count.

2. **Shelter zone is AABB** but cavity is rotated + tilted. Use a single
   oversized AABB sized by diagonal (same pattern as
   `src/world/megaShip.ts:597`). Player at the absolute edge on a
   windless day won't notice over-coverage.

3. **Sand-burial seam on tilt**: at 120m length, 0.25 rad tilt exposes
   ~30m of wall underside on the high end. **Tighten tilt cap to 0.10
   rad** in the poi.ts dispatch. WALL_BURY scaled to **6-8m**.

4. **Fog tint inside the bay**: at 120m total length, parts of the
   interior are inside fog range. Walls will be tinted. Not a bug, but
   verify in BB-2 — if it looks washed out, consider tightening fog
   density or adding an interior ambient lift.

5. **Flat-spot search**: current `terrainVarAt` (3×3 at 2.5m spacing) is
   too narrow for a 120m structure. Expand to 5×5 at 8m spacing and
   widen the search radius to 30m.

---

## Verification

### BB-2

1. **Type check**: `npx tsc --noEmit` clean.
2. **Boot**: `npm run dev`. Confirm no console errors.
3. **Biome check**: Via `preview_eval`, verify the mega-wreck position is
   in `dune` biome and the surrounding 30m radius is also dune (no salt
   intrusion).
4. **POI clearance**: Min distance from wreck center to every other POI
   ≥ 100m.
5. **Visibility from spawn**: External screenshot with camera at spawn
   `(-55, _, 0)`, dayTime=0.42, looking toward `(-180, _, -130)`. Bridge
   tower silhouette should be partially visible through fog.
6. **Walk-through**: `__game.audioState` not needed; use `__game.setTime`
   for noon. Walk player from spawn to wreck (use console teleport via
   `body.setNextKinematicTranslation`). Confirm:
   - Player can walk into bow entrance (no clipping)
   - Player can walk through mid-hull break into main aft bay
   - Floor inside bay reads as terrain (sand), not metal
   - 2 salvage panels are interactable (look at, press E starts salvage)
   - Shelter zone activates inside (`ctx.player.inShelter = true`)
7. **No floating sides**: External screenshots from 4 cardinal directions
   should show walls extending into terrain on all sides (no visible
   gap under any wall).
8. **F1 perf HUD**: With player at wreck entrance, FPS ≥ 60 with shadows
   ON. Record before-after vs the existing scene without the mega-wreck.

### BB-3

1. tsc clean.
2. All 8 salvage panels interactable + return loot when stripped.
3. Catwalks: stand on each, walk along, drop off without damage.
4. Side room reads as fully dark with torch off; readable with torch on
   (test by equipping torch from inventory).
5. Skylights drop visible light pools on bay floor at noon.
6. Surrounding debris field visible around the wreck; no overlap with
   wreck walls.
7. Companion small wrecks placed without colliding with mega-wreck
   walls.
8. Visual screenshot from external 3/4 view: wreck silhouette reads as a
   "ship," not a "box."
9. Visual screenshot inside main bay at noon: skylight pools + catwalk
   silhouettes visible.
10. Final FPS check with shadows ON near the wreck entrance.
