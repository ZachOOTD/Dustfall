# Session next — Satellite dish polish + engine_block POI rework

## Context

Session KK shipped the **wrecked satellite dish** flagship POI as a
dedicated module ([satelliteDish.ts](src/world/satelliteDish.ts), 798
LOC) at hand-placed `(-88, -50)`. It set the template for what POI
rework can aspire to: dedicated module + per-piece colliders + walkable
+ shelter + multi-point salvage + curved/detailed silhouette.

Two threads this session (4-6h budget):

- **(A) Polish pass on the satellite dish** (~3h). Five carry-over
  candidates from KK's end. The dish reads as a flagship landmark from
  far off but has rough edges: no climbing route to the dish-back
  salvage panel, flat panel colors, sand burial reads as 9 scattered
  apron mounds rather than one wrapping dune, feed assembly looks
  "clean" without dangling cables, interior is unlit.
- **(B) Wreck POI rework target — engine_block only** (~2.5h). Roadmap's
  "Wreck POI rework" entry calls for less-boxy / curves+detail / better
  collision on hand-placed POIs that haven't been touched. Of the three
  candidates (engine_block / camp / crashed_hull), the user picked
  engine_block — most boxy, simplest scope, cleanest gameplay. Camp is
  intentionally lean (skip). Crashed_hull would mean replacing two
  shared wreck builders in lockstep (defer).

Both threads validate the dish as a transferable template. Out of scope
per the prompt: new POI kinds, new biomes, AI density changes.

**Roadmap doc cleanup**: [docs/roadmap.md:26](docs/roadmap.md) still
lists "New POI: wrecked satellite dish" as a backlog item — that
shipped in KK. Remove that line during `/session-end`.

---

## Thread A — satellite dish polish (5 items)

All edits in [src/world/satelliteDish.ts](src/world/satelliteDish.ts).
Module structure confirmed (Explore report):
- `placeSatelliteDish()` entry at L181
- `baseGroup` walls/roof/interior at L204–507
- `dishPivot` panels/framework/feed at L589–647
- Sand mounds (terrain-snapped, post-rotation scene children) at L698–716
- `addBaseCollider(localPos, halfExtents)` helper at L726–771 (passes the
  group's world quaternion so colliders rotate correctly)
- Salvage panels at L657–674 (base wall + dish back)

### A1. Climbable exterior ladder/ramp to roof — gameplay priority

**Problem**: dish-back salvage panel is on the roof side via the tilted
`dishPivot` — currently no obvious way for the player to reach it.

**Approach**: external ladder up the side of the base, terminating at
the walkable roof. Reuse the **interior ladder-rung pattern** at
[satelliteDish.ts:436](src/world/satelliteDish.ts:436)-448 — 5 rungs of
`CylinderGeometry(0.04, 0.04, 0.45, 5)` rotated `Math.PI/2` on Z.
- Add 10-12 rungs spanning floor-to-roof on the exterior face nearest
  the dish-back salvage panel's world projection.
- Two vertical side-rails (cylinders, `0.06m` radius).
- Add a static-box ramp collider via `addBaseCollider()` so the player
  can actually walk up it (Three.js geometry doesn't drive Rapier
  contacts — collider must be explicit). One angled box ~0.5m × ladder-
  length × 0.4m, oriented along the ladder axis.

**Validation**: panel's world coords need extraction post-rotation —
follow the exact pattern at
[satelliteDish.ts:792](src/world/satelliteDish.ts:792)-793
(`updateWorldMatrix(true, false)` → `setFromMatrixPosition(matrixWorld)`).
Place the ladder on the base face closest to that XZ point.

**Edit zone**: insert after `baseGroup.position` is set (~L507) and
before `dishPivot` is built. Collider registration alongside roof
collider at L738-741.

### A2. Interior lantern light

**Problem**: hollow interior is unlit; reads as a sand-floored cave but
visually dead.

**Approach**: single warm-tone `PointLight` + small emissive prop.
- No existing lantern helper in `src/` (Explore confirmed: only
  `makeFireVisual()` in [fire.ts:46](src/world/fire.ts:46) uses
  `PointLight(0xff9040, 1.3, 8, 1.6)`, which would couple us to the
  fire module unnecessarily).
- Inline: `new THREE.PointLight(0xffa844, 0.6, 6)` (half fire's
  intensity, half its range, warmer orange).
- Prop: small `BoxGeometry(0.18, 0.22, 0.18)` with
  `MeshBasicMaterial({ color: 0xffc266 })` at the light's position to
  give it a visible source.
- Position: back-upper corner of interior, ~`(0, -BASE_H*0.5 +
  BASE_WALL_T + INTERIOR_H - 0.5, BASE_D*0.5 - BASE_WALL_T - 1.5)` (per
  Explore's calc — back wall, head-height, off the player's path).
- Anchor inside `baseGroup` (so it inherits any group transform) after
  the ceiling pipes (~L464).

### A3. Sand burial dune mound

**Problem**: 9 small `ConeGeometry(1.2-1.9, 0.7-1.2, 6)` mounds in an
apron read as scattered debris, not as "this is half-buried in a dune."

**Approach**: add ONE large flattened sand feature on the lee side of
the base (opposite the entrance — pick the +X or +Z corner depending on
entrance orientation, verify in-file).
- `SphereGeometry(4.5, 14, 8)` scaled to `(1, 0.35, 1)` (flattened
  half-dome), `_sandPileMat` (existing, [satelliteDish.ts:61](src/world/satelliteDish.ts:61)).
- Position centered against the base wall, terrain-snapped:
  `terrain.heightAt(pos.x + offset.x, pos.z + offset.z)`.
- Add after the 9-mound loop at ~L716.
- No collider needed (player can walk over the dune to reach the roof
  via the ladder, but dune mound is decorative — the ladder is the
  intended climbing route).

### A4. Cables dangling from feed assembly

**Problem**: feed horn + feed arms read as "clean" — wreck doesn't
narrate "something snapped and is hanging loose."

**Approach**: 2 droopy cables using `TubeGeometry` over a
`CatmullRomCurve3`. No existing cable helper in codebase — implement
fresh (Explore confirmed zero matches for cable/wire/TubeGeometry-spline
patterns across `src/`).
- Cable A: from feed horn body, drooping toward the dish surface, ending
  unfastened mid-air (cut wire visual).
- Cable B: from the broken feed arm stub (~L639-645 area), longer droop
  curving down past the dish edge.
- Curve: 4 control points each, mid-points sagged ~25% below the chord.
- Radius: ~0.04m. Segments: 8 along, 5 radial. Total ~80 tris per cable.
- Material: dark matte black (`MeshLambertMaterial({ color: 0x1a1612 })`).
- Anchor inside `dishPivot` (after `dishPivot.add(brokenArm)` at L645)
  so cables inherit the dish tilt.
- **D60 reminder**: cables anchor naturally via curve endpoints; no
  cylinder anchor math needed. This is the "right tool for the job"
  case — `geometry.translate` rule applies to straight cylinders with
  angled parents, not to curve-defined tubes.

**Note**: this helper might get extracted to a shared util later for
the engine_block hoses in Thread B — but per "don't add abstractions
beyond what the task requires," define locally in satelliteDish.ts this
session and copy/paste to engineBlock.ts. Extract only if a third
caller appears.

### A5. Rust variation on dish panels

**Problem**: 12 panels alternate between 2 flat colors (`_dishPanelMat`
`0x7a4628` and `_dishPanelDarkMat` `0x4a2818` at
[satelliteDish.ts:44](src/world/satelliteDish.ts:44)-52, selected via
`i % 2` at L602). Reads as too uniform.

**Approach**: add 2 more rust shades, switch selection to `i % 4`.
- New `_dishPanelRustLight` (~`0x8a5a38`, lighter orange-tan rust).
- New `_dishPanelRustEdge` (~`0x3a1e10`, darker oxidized edge).
- Selection at L602: `[_dishPanelMat, _dishPanelDarkMat,
  _dishPanelRustLight, _dishPanelRustEdge][i % 4]`.
- All same `MeshLambertMaterial` + `flatShading: true` + `DoubleSide`
  settings as existing — palette swap only, no new material types.

**Edit zone**: add materials at L40-52 block; change selector at L602.

---

## Thread B — engine_block rework

New module: **`src/world/engineBlock.ts`** (~300 LOC, modeled on
satelliteDish.ts). Replace the inline 31-LOC
[poi.ts:33](src/world/poi.ts:33)-63 `placeEngineBlock` with a
delegator. POI position unchanged: hand-placed `(95, -8)` in
`POI_LAYOUT`.

### B1. Silhouette redesign

Current cluster (5 straight cylinder nozzles + box thrust frame) is the
canonical "boxy" case the roadmap calls out. De-box every visible
surface but keep the iconic upturned-engine silhouette.

- **Bells**: replace straight cylinders with `LatheGeometry`-tapered
  bells. ~9-point profile: narrow throat (R = 0.45×baseR) → bulged
  combustion shoulder (R = 0.85×baseR) → slight pinch → exponential
  flare to wide rim (R = 1.25×baseR). 12 segments around. Same Lathe
  pattern as the dish panels at
  [satelliteDish.ts:97](src/world/satelliteDish.ts:97)-106.
- **Exhaust ports**: `BackSide`-rendered inner cylinder per bell with
  emissive dark backstop (sandworm-maw trick, D48). Disc cap at throat
  end so bells aren't see-through from oblique angles. Rim torus with
  emissive heat-scarring.
- **Cooling shroud (replaces "thrust frame is just a box")**: keep the
  `BoxGeometry` core as the collider host, sleeve it with 3 nested
  `TorusGeometry` rings + 4 lengthwise structural ribs (thin cylinders).
  Box stays, but the visible silhouette reads as machinery.
- **Heat-shield plate**: `LatheGeometry` shallow cone wedged between
  bells and frame on the visible side. "Ablative tile bank, half torn
  off."
- **Fuel hoses**: 2 droopy hoses via `TubeGeometry` +
  `CatmullRomCurve3`, anchored on the frame side, terminating on the
  ground (terrain-snapped). Matte black material. Same primitive as
  the dish cables in A4 — define locally in `engineBlock.ts`, do not
  share until a third caller exists.
- **D60 anchor rule**: bells use `geometry.translate(0, halfL, 0)` so
  anchor is the throat (mount point), not the rim — critical once the
  bells fan slightly outward. Same for hose root segments.

### B2. Colliders — per-piece, not AABB

Drop `attachCompoundCollider(world, parent)` ([poi.ts:59](src/world/poi.ts:59)
— overshoots into thin air at tilted corners; player gets phantom step
~1.5m off the visible mesh).

Replace with local **`addEBCollider(localPos, halfExtents)`** helper
modeled exactly on
[satelliteDish.ts:726](src/world/satelliteDish.ts:726)-735
`addBaseCollider`: capture group's world quaternion + world position
once, apply rotation to each local center, pass quaternion to
`makeStaticBox` from
[src/physics/bodies.ts:9](src/physics/bodies.ts:9)-22.

4-7 colliders:
1. **Thrust-frame core box** — matches `BoxGeometry`, also serves as
   walkable surface.
2. **Bell array fitted cuboid** — one fat block covering all 5 nozzles
   (per-cylinder is overkill, player wouldn't try to wedge between bells
   anyway).
3. **Heat-shield plate** — thin cuboid.
4. **Underside wedge** — 3m × 1.5m × 3m mostly-underground block so
   player can't crawl under the upturned engine.
5–7 (conditional): hose roots, only if playtesting reveals clipping.

### B3. Walkable — yes, one surface

The thrust-frame top face is naturally a walkable lookout perch. With
the cluster pitched `-0.55` X and `-0.18` Z, the upper edge sits ~3.5m
above terrain on the high-tilt side, ramping down toward the bells.
Player scrambles up the dune face onto the upturned frame — reads as
"I climbed the wreck" not "designer placed a platform."

**No interior, no shelter zone** — engine_block is an open landmark.
Doubling shelter affordance dilutes the dish's identity. Skip
`ShelterRegistry` from the placement signature entirely.

### B4. Salvage panels — 2, matching the dish

- **Panel A**: dune-facing side of the thrust frame (eye-level once
  player walks up the dune ramp). The "obvious" panel.
- **Panel B**: recessed inside the throat of the center bell, ~0.5m
  past the rim, facing outward through the throat. Hidden-loot reward.

Both register as `'massive'` (matches current registration at
[poi.ts:249](src/world/poi.ts:249) and dish's two-panel registration at
[satelliteDish.ts:790](src/world/satelliteDish.ts:790)-794).

### B5. Module file layout

`src/world/engineBlock.ts`, top to bottom:
- Header comment block (style of [satelliteDish.ts:1](src/world/satelliteDish.ts:1)-17),
  call out D60 anchor rule explicitly.
- Imports: `THREE`, `RAPIER` (type-only), `Rng`, `Terrain`,
  `SalvageableRegistry` + `registerSalvageable`, `makeStaticBox`,
  `Tuning`, `placeDebrisField`. **No** `ShelterRegistry` import.
- Materials block: `_hullMat`, `_charredMat`, `_nozzleInteriorMat`
  (BackSide + slight emissive), `_nozzleRimMat`, `_heatShieldMat`,
  `_hoseMat`, `_panelBodyMat`, `_panelRimMat`. Copy palette consts in
  rather than reach into wrecks.ts internals — matches dish self-
  containment.
- Dimensions block: `CLUSTER_SCALE = 4.2`, `NOZZLE_COUNT = 5` (fixed
  for flagship reads as deliberate), bell/frame dims, `BURY_Y = 1.4`,
  `PITCH = -0.55`, `ROLL = -0.18`, `YAW_BASE = -0.6`.
- Sub-builders: `makeNozzleBell()`, `makeThrustFrameCore()`,
  `makeHeatShield()`, `makeFuelHose(rand, startLocal, endLocal)`,
  `makeEBAccessPanel()` (local copy of dish's `makeAccessPanel`).
- `addEBCollider(localPos, halfExtents)` helper closure.
- Public entry: `placeEngineBlock(scene, world, terrain, pos, rand,
  salvageables)` — returns the cluster group.

### B6. poi.ts delta

- Add `import { placeEngineBlock } from './engineBlock.ts';`
- Delete the local `placeEngineBlock` function ([poi.ts:33](src/world/poi.ts:33)-63).
- Update dispatch ([poi.ts:247](src/world/poi.ts:247)-251) to match dish
  shape ([poi.ts:260](src/world/poi.ts:260)-269): pass `salvageables`
  into module; remove the inline `registerSalvageable` call (module
  handles its own registration).
- Remove the `makeEngineCluster` import from `poi.ts` if no other
  callers there — **verify before deleting**: `makeEngineCluster` is
  also used by [wrecks.ts:placeWreck](src/world/wrecks.ts) `'engine_cluster'`
  case and by `poi.ts:placeMegaWreck`'s companion-wreck loop
  ([poi.ts:374](src/world/poi.ts:374)). The latter means we keep the
  import in poi.ts even after deleting our usage.

---

## Critical files

- **Edit**: [src/world/satelliteDish.ts](src/world/satelliteDish.ts)
  — Thread A (all 5 items)
- **Create**: [src/world/engineBlock.ts](src/world/engineBlock.ts) —
  Thread B (new dedicated module)
- **Edit**: [src/world/poi.ts](src/world/poi.ts) — Thread B (delete
  inline function, add delegator call)
- **Reference (do not edit)**: [src/physics/bodies.ts](src/physics/bodies.ts)
  — `makeStaticBox` signature
- **Reference (do not edit)**: [src/world/wrecks.ts](src/world/wrecks.ts)
  — confirm `makeEngineCluster` callers before pruning imports

---

## Verification

### Per-thread

**Thread A (satellite dish polish)** at POI `(-88, -50)`:
1. `npx tsc --noEmit` — zero errors.
2. `npm run dev` (port 5173), boot, skip title.
3. Walk to dish; circle the structure.
4. **A1 — ladder**: walk up ladder, verify roof reached, interact with
   dish-back salvage panel (the one that was unreachable from KK).
5. **A2 — lantern**: enter interior, confirm warm orange glow visible
   on walls + sand pile, lantern prop visible at light source.
6. **A3 — sand dune**: 360° external pass, confirm one wrapping half-
   dome reads as "buried in a dune," not just "a bigger mound."
7. **A4 — cables**: zoom view onto feed assembly, confirm 2 cables
   visible drooping, no clipping into dish surface.
8. **A5 — rust variation**: front-on dish view at 20m, confirm panel
   colors no longer alternate 2-shade (look for 4 distinct rust tones
   around the rim).

**Thread B (engine_block rework)** at POI `(95, -8)`:
1. Walk to engine_block — silhouette test at 30m+: reads as "engine
   cluster" via curved bell flare?
2. 5 angles screenshots:
   - North ground 10m back — bell flare profile.
   - East ground 10m back — upturned frame edge.
   - South ground (buried side) — heat shield + fuel hoses ground out
     cleanly, no floating gaps.
   - Frame-height looking down into bell throat — recessed maw reads,
     Panel B visible.
   - Overhead 30m back, 8m up — no floating pieces, no phantom
     collider shadow.
3. **Salvage**: raycast onto Panel A from ground — prompt + roll.
   Climb the frame, raycast onto Panel B — same.
4. **Collider sanity**: strafe around bell ring — no clipping, no
   phantom collider 1.5m off mesh. Walk up dune ramp onto frame —
   solid footing across upper face.
5. **Perf**: `__game` perf HUD — POI tris in dish ballpark (~2-3k),
   no FPS regression vs. current cluster.

### Cross-cutting

6. Save-game round-trip: save mid-session at each POI, reload,
   verify both POIs render identically + salvageables persist
   (id-based, no schema change so `SAVE_VERSION` stays at 4).
7. Confirm `DEBUG_STARTER_LOADOUT` + `DEBUG_UNLIMITED_STAMINA` +
   `GOD_MODE` still set as carry-overs (flip in
   [src/config/tuning.ts](src/config/tuning.ts) only for a real
   playthrough check, not standard verification).

---

## Carry-over reminders

- **D60 — anchor angled cylinders via `geometry.translate(0, halfL, 0)`,
  NOT manual rotation math.** Bit me twice in KK. Applies to: Thread A
  ladder side-rails (probably moot — they're vertical), Thread B bell
  Lathe geometry (throat anchor), Thread B fuel hose root cylinders if
  used, Thread B cooling-shroud ribs attached at one end. Cables
  (TubeGeometry over spline) don't need this — curve endpoints handle
  it naturally.
- Debug flags currently on: `DEBUG_STARTER_LOADOUT`,
  `DEBUG_UNLIMITED_STAMINA`, `GOD_MODE`. Don't flip during dev; they
  speed iteration. Flip before a real playthrough.

---

## Out of scope (explicit)

- New POI kinds (only extending dish + reworking engine_block)
- New biomes
- AI density changes
- Touching `camp` or `crashed_hull` (deferred — `camp` is intentionally
  lean, `crashed_hull` would mean replacing 2 shared wreck builders in
  lockstep)
- Extracting a shared cable/hose helper across satelliteDish.ts and
  engineBlock.ts — copy/paste this session; extract only if a third
  caller appears
- Sharing `makeAccessPanel` between dish + engine_block — copy locally
  into engineBlock.ts to keep the module self-contained, matches dish
  pattern
- Roadmap.md cleanup (remove the stale "New POI: wrecked satellite
  dish" line) — handled by `/session-end`, not in this session's edits

---

## Time budget (4-6h target)

- Thread A: ~3h
  - A1 ladder + collider: 45 min
  - A2 lantern: 30 min
  - A3 sand dune: 30 min
  - A4 cables: 45-60 min
  - A5 rust variation: 15 min
- Thread B: ~2.5h
  - engineBlock.ts new module (silhouette + colliders + 2 panels): 2h
  - poi.ts delegator + import cleanup + verification: 30 min
- **Recommended order**: Thread A first (lower-risk, warms up on the
  known dish module), Thread B second (novel module). If A overruns,
  Thread B can drop to 1 salvage panel + skip the heat shield to
  fit budget.
