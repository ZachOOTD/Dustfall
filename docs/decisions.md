# Decisions

Numbered key calls — why + when. Don't re-explain in chat — link here.

When adding: append at the bottom with the next D-number. Don't renumber.

Each entry carries a `**friction-score:**` (0-5) reflecting how often the
decision will cause future rework or pain. Added in the gamedev-framework
v0.3.x retrofit (2026-05-20). The `/audit-debt` skill surfaces high-friction
unresolved entries.

- **0** = trivial, reversible (color, UI copy, tuning number)
- **1** = small, locally-reversible
- **2** = moderate; touches one subsystem
- **3** = workaround that ships visibly-wrong-but-shippable
- **4** = architectural, hard to reverse
- **5** = foundational; reversing means rewriting multiple subsystems

> **Older entries (D1–D87) are archived** in [decisions-archive.md](decisions-archive.md) — preserved verbatim, still grep-able; D-numbers never reused. This file keeps the most recent ~45 (D88 onward). At session-start, read the recent tail + grep `friction-score: [3-5]`; look up older entries on demand.

---

## D88 — Hover state always wins the crosshair feedback channel (Session AAN)
**When**: Session AAN (scrap_gun empty-state crosshair).
**Why**: AAN added a `.no_ammo` crosshair state — dim warning-red when
the equipped weapon is a ranged gun with empty magazine. Question: when
the player is hovering an interactable AND holding a dry gun, which
state shows? Chose hover wins: kill / dead / interactable is the more
actionable signal (you can DO something at the corpse / pickup; the
empty gun is a passive concern). `.no_ammo` only fires when
`hover === null`. This keeps the crosshair channel as a single-state
indicator (mutually exclusive classes) rather than stacking warnings.
**Apply**: future crosshair states (e.g. low-stamina-no-attack, broken-
weapon) follow the same precedence — hover-derived states win over
equipped-derived states.
**friction-score:** 1

## D89 — Toast.kind variants instead of separate UI elements (Session AAN)
**When**: Session AAN (first-recipe-discovery fanfare).
**Why**: First-time recipe discovery wanted a "moment" — larger font,
warm glow, longer hold. Considered (a) separate `#discovery-modal`
overlay vs (b) extending `#toast` with a `.discovery` class variant.
Picked (b): the existing toast pipeline already handles timing,
fade, opacity transitions. A new modal would need its own create/
mount/teardown + clash with other DOM (hotbar, hud). One DOM element
+ CSS class swap = 5 LOC for the same player-visible result.
HudApi.showToast signature gained optional `opts?: { kind?: 'discovery' }`
arg, so existing call sites are unchanged.
**Apply**: future short-lived "moment" feedback (first kill, first
sleep through a storm, etc.) reuses showToast with new `kind` values
rather than introducing new overlay modules.
**friction-score:** 0

## D90 — Companion reads weather.intensity, not perceivedIntensity, for huddle state (Session AAO)
**When**: Session AAO (companion storm-peak huddle).
**Why**: AAO added a huddle state at `weather.intensity > 0.80`. Question:
read `weather.intensity` (world truth, D79) or `weather.perceivedIntensity`
(player-context-aware, dampened inside large tents)? Chose `intensity`.
The companion is an outdoor creature; whether the PLAYER is sheltered
doesn't change whether the COMPANION is being hit by storm dust. Reading
perceivedIntensity would have the companion stop huddling when the player
walks into a tent — wrong reading. This matches the state-split shared-
memory rule: physics/AI read truth, visual/audio read perceived.
**Apply**: future companion behavior gated on weather (cower, retreat
to shelter, mood drop) reads `weather.intensity`. The companion's own
shelter check (future: "is the companion under a tent?") would be a
separate per-companion lookup, not the player-perceived value.
**friction-score:** 1

## D91 — Sandworm home sampled from dune biome via rejection sampler (Session AAP)
**When**: Session AAP (sandworm overhaul).
**Why**: AAL's world-edge test-fix (`SANDWORM_HOME_POS = (900, 0)`) was
shipped as a "ship-stable-not-correct" patch. AAP replaces it with a
real procgen placement: `sampleSandwormHome(rand, biomes, terrain)`
uses `findBiomeCentroid` on the dune biome (mirror of wells-in-salt
per D55) with a player-spawn-exclusion ring at 350m (wider than
flagship POIs at 200m per D82 because the worm's detection radius
alone is 150m — a 200m exclusion still allows alert within ~50m of
spawn). Per-seed ±30m jitter so different seeds with the same centroid
cell still produce distinct positions. Falls back to
`Tuning.SANDWORM_HOME_POS` only if no dune centroid is reachable
(world is mostly dunes; rare).
**Apply**: future enemy/boss procgen placements use this 3-step pattern
— rejection sampler on biome centroid + spawn-exclusion ring +
per-seed jitter to avoid same-cell-always behavior.
**friction-score:** 1

## D92 — Procedural music stays separate from soundscape's sample-stem layer (Session AAP)
**When**: Session AAP (atmospheric music tracks).
**Why**: The pre-AAP soundscape.ts already had a sample-stem music
layer (music-calm + music-tense .ogg loops crossfaded by storm). That
layer never shipped audio (no .ogg pack was ever added) but the
architecture stayed in case CC0 music landed someday. AAP needed to
fill the music slot NOW per D3 (no .ogg files); options were
(a) gut the stem layer entirely and replace with procedural, or
(b) add procedural as a separate module that runs alongside the
silent stems. Chose (b). Reasons: (1) preserves the stem path for
future .ogg adoption without a re-architecture; (2) procedural music
has a different scope (3 tracks vs 2 stems) and different signal
mix (sun-height-aware vs storm-only); (3) clone-not-abstract per the
project convention. If both layers ever play simultaneously a toggle
is needed; today only the procedural layer is audible.
**Apply**: future audio additions (music genres, ambient creature
calls, mechanical hums) get their own modules connected to the same
`a.ambient` bus rather than threading variants through soundscape.ts.
**friction-score:** 1

## D93 — Themed POI clusters compose existing primitives, not new modules (Session AAQ)
**When**: Session AAQ (POI overhaul — themed clusters slice).
**Why**: AAQ shipped 2 cluster kinds (military_convoy, refugee_caravan).
Each is a coordinated layout of EXISTING wreck/camp primitives
(engine_cluster, cargo_container, fuselage, scavenger_camp) rather
than new POI modules. The "theme" comes from layout shape (linear
crash trajectory vs ring around a camp) + kind selection, not from
new 3D geometry.
**Considered alternatives**:
- New model modules per cluster type (e.g. `militaryConvoy.ts` with
  custom truck + jeep + watchtower meshes). Rejected — would balloon
  module count and require new model authoring for every new cluster
  theme. The "convoy" silhouette reads fine with engine_cluster trucks
  + cargo containers + fuselage — the FORMATION is what makes it
  read as a convoy, not the specific vehicle silhouettes.
- Procedural mesh composition (e.g. dynamically attach gun-turrets to
  cargo containers for "military" theming). Rejected — too much complexity
  for too little visible payoff at this scale; would need a per-kind
  mesh-mutation vocabulary.
**Apply**: future cluster themes (comm-relay, military outpost, refugee
caravan extensions) start by composing existing wreck/camp kinds in new
layouts. Only commit to new POI modules when the silhouette demands it
(e.g. a "research outpost" needs a unique flat-roof concrete block that
no existing primitive provides).
**friction-score:** 1

## D94 — Visible depletion via index-order component hiding, no per-save tracking (Session AAR)
**When**: Session AAR (salvage mechanics overhaul).
**Why**: New panel design has 5 visible interior components; each
extract hides one. Question: which one? And how does this persist
across save/load?
**Considered alternatives**:
- Random per-extract pick (looks more organic, but needs
  per-extract RNG seed for save-stability — extra state).
- Track extractedComponentIndices: number[] in Salvageable + save
  (full fidelity reload, but additive schema bump v10 → v11 just
  for visual state).
- Fixed index order (0 → 4) hiding, no save tracking.
**Picked**: fixed index order. Save format stays v10 (zero schema
risk); reload reconstructs visible state from `salvageRemaining` alone
(extracted count = 5 - salvageRemaining clamped to kindMaxExtracts;
hide components [0, extractedCount)). Two acceptable migration
limits documented in changelog: (1) pre-AAR partial saves show all
components visible but capped extracts; (2) open-door state doesn't
persist. Players re-pry; no cost.
**Apply**: future content visual state should default to deriving
from existing persisted counters rather than adding bespoke schema
fields. Visible inconsistency on partial saves beats a schema bump
for cosmetic state.
**friction-score:** 2

## D95 — Salvage prying composes with movement noise (Session AAR)
**When**: Session AAR (risk/reward polish on salvage overhaul).
**Why**: AAP added a noise-multiplier on the sandworm's detection
radius (mounted=1.85, sprinting=1.45, walking=1.0, still=0.55).
AAR's pry is also loud (metal-on-metal scrape). Question: should
prying REPLACE the movement multiplier or COMPOSE with it?
**Picked**: compose. Standing still while prying = STILL × 1.3 = 0.72
multiplier (slightly quieter than walking). Mounted while prying =
MOUNTED × 1.3 = 2.4 multiplier (very loud — the bike's hum + the
pry creak stack). The composition rule reads as physical-sound-source
additivity: louder activities add to other louder activities.
**Considered alternatives**:
- Replace: prying overrides movement multiplier to a flat 1.5×.
  Simpler but loses the "mounted-while-prying is double-bad" beat.
- Pure addition (multipliers summed): wrong shape — would make
  still+pry quieter than walking (0.55 + 0.3 = 0.85 vs walking 1.0).
**Apply**: future activity-modifiers on detection follow the same
multiplicative composition. The base movement multiplier IS the
floor; activities scale ABOVE it.
**friction-score:** 1

## D96 — Salvage condition derived from save-stable inputs, no schema bump (Session AAT)
**When**: Session AAT (salvage condition tiers).
**Why**: New per-panel condition field affects pry duration + loot +
visuals. Question: persist condition in save (additive v10→v11) or
derive deterministically from existing save-stable inputs?
**Picked**: derive. Condition comes from `(id + biome-at-pos + a
rand() call during registerSalvageable)`. The id is stable per-seed
(registration order), the biome is stable per-seed (terrain doesn't
change), and the scatterRand stream is per-seed-deterministic.
Result: same seed → same condition on every reload. Save format
stays v10.
**Considered alternatives**:
- Additive field on Salvageable + save schema v10→v11. Full
  fidelity but another migration to track + an additional save
  field that's purely derivable.
- Per-condition module-level Map<id, condition>. Same effect but
  worse — couples the salvage module to the registry size and
  doesn't survive HMR / hot module replace cleanly.
**Apply**: pattern extends D94 — "derive cosmetic / deterministic-
from-seed state from existing inputs, skip the schema bump." Future
per-entity fields that are seed-stable can use the same dodge.
Caveat: if condition ever becomes player-mutable (e.g. "weld this
corroded panel back to standard with scrap") it must move to a save
field, since player edits aren't seed-derivable. The line is
"does the player change it?" — no = derive; yes = persist.
**friction-score:** 1

## D97 — Procedural fabric shader via onBeforeCompile patch (Session AAY)
**When**: AAY tent redesign — needed cloth surfaces to read as fabric,
not painted cardboard. Considered baked textures vs. shader vs. just
better Lambert colors.
**Picked**: shader. New `src/world/fabricMaterial.ts` exports
`createFabricMaterial(color, side)` — drop-in replacement for
`MeshLambertMaterial`. Patches the standard material via
`onBeforeCompile`: vertex shader forwards a world-space varying;
fragment shader injects weave cross-hatch (2.5cm cycle) + FBM mid-scale
color variation + stain patches + per-pixel micro-grain. Mirrors the
`terrainMaterial.ts` pattern (D62) with the same IQ-style hash for
precision-robust noise at large world coords.
**Why**: zero bundle cost (no texture files shipped), preserves Lambert
lighting + fog + shadows, world-space sampling means different tents at
different positions get free per-instance variation. Bakes textures
were the alternative — would need a PBR pipeline + memory budget +
file authoring; not worth it when the procedural version reads well at
the camera distances Dustfall plays at.
**Apply**: any new cloth surface (sails, banners, future scavenger-camp
canopies) should use `createFabricMaterial` instead of plain Lambert.
Pattern is composable — the four layered effects can be tuned via
literals at the top of `fabricMaterial.ts` for different cloth kinds
(e.g. tighter weave for canvas, looser for goat-hair).
**friction-score:** 1

## D98 — Terrain-slope alignment helper duplicated across 3 callers (Session AAY)
**When**: AAY companion fix — third copy of `alignMeshToTerrain` /
`alignCompanionToTerrain` (4-cardinal-sample gradient → terrain
normal → basis with up=normal, forward=projected heading, set
quaternion). Already in `tent.ts` and `largeTent.ts`.
**Picked**: leave inline in all three for now; defer extraction to a
shared util until a fourth caller wants it.
**Why**: extracting now is a refactor without a clear payoff — each
copy is ~30 LOC, the scratch-vector allocation patterns vary slightly
(tent + largeTent use locals, companion uses module-level for per-
frame), and the right shape of the shared module isn't obvious yet
(does it own the vectors? does it allocate per-call? does it accept
custom radii?). Three duplicate copies is small enough debt to leave;
four would push it into refactor-worthwhile territory.
**Apply**: when adding the 4th caller, lift to `src/util/terrainAlign.ts`
(or similar) with a clear API: `alignToTerrain(obj, terrain, pos,
yaw, sampleRadius)`. Migrate all callers; update this entry.
**Considered alternatives**: lift now into a shared util. Rejected
because (a) no third caller demonstrated a divergent need yet, and
(b) the existing terrainMaterial / vNormal D62 pattern showed how
sharing GLSL helpers via duplication is sometimes simpler than a
shared abstraction.
**friction-score:** 2

## D99 — HoverState.entityId — generic registry-id passthrough (Session AAY)
**When**: AAY grill-kit attach bug. `grill_kit.onUse` tried to read
`(hover as { id?: number }).id` — a TypeScript cast onto a property
that didn't exist on `HoverState`. Symptom: grill_kit attach silently
failed because the fire lookup returned undefined.
**Picked**: add `entityId?: number` to `HoverState`. Set it on every
fire interaction branch (cook / add_fuel / relight / passive). Item
`onUse` handlers that need the hovered entity read `hover.entityId`.
**Why**: the existing fix was a stale cast — the field was needed but
never declared. Making it a proper optional field surfaces the
dependency in the type system, prevents the same bug from recurring
silently, and works for any future onUse handler that needs to act on
a hovered entity (apply paint to a placed sled, fertilize a cactus,
upgrade a deployed locker, etc.).
**Apply**: any new InteractType that an item.onUse handler may act
upon should set `entityId` in its `interaction.ts` case branch.
Generic across registries; the consumer reads it without needing to
know which registry the entity belongs to (it can also check
`hover.type` or `hover.promptNoun` if needed).
**friction-score:** 2

## D100 — Companion architecture — body-shell + hip-group decomposition (Session AAY)
**When**: AAY companion polish — two visual bugs (legs floating flat
under body; rolling looked like bobbing into sand) traced to the same
root cause: the body group's origin was at GROUND level, and rolling
rotated this group → meshes orbited the ground point instead of
spinning around the body center.
**Picked**: split the body Group into TWO sub-groups:
- `bodyShell` (origin at `y=R` inside body group) holds all body
  meshes at `y=0` relative to its own origin. Rolling rotates the
  shell — meshes orbit the shell's origin = body center.
- `hipGroup` (one per leg, inside `legPivot`) rotates around its Z
  axis to lift the leg around its body attachment. Walk gait modulates
  hip rotation instead of translating the leg pivot.
The leg pivots themselves moved to the body surface BELOW the equator
(at the latitude where short legs at the resting down-angle reach
the ground), and were recessed ~3cm into the sphere for visual leg-
body embedment.
**Why**: separating "rolls around its center" from "presses to ground"
keeps the two motions independent. Pre-AAY the body group did both,
which is why rolling looked like bobbing — the rotation pivot was the
wrong axis. The leg hinge fix is the same principle (a foot hinges at
the hip, not via whole-leg translation).
**Apply**: any future radial-symmetric creature (a different
companion variant, an enemy crab, etc.) should use the same
body-shell + per-leg hip-group decomposition. The pattern generalizes:
- Body group: world position + slope alignment
- Body shell: meshes that roll/spin (rotation around body center)
- Per-limb pivot: world-positioned at body surface
- Per-limb hip: rotates to animate the limb via hinge motion
**friction-score:** 1

## D101 — Salvage panel door open-direction convention (Session ABA)
**When**: ABA bugfix — the door's free edge (with the handle) was
swinging INTO the hull instead of OUT toward the player, making the
pry stage read backwards. Root cause: addAccessPanel positions the
hinge at the panel's LEFT edge (body-local -X), the door extends to
body's +X with the handle on the right — real fuse-box convention.
Three.js's right-hand rule on +Y means a positive Y rotation around
that hinge swings the +X point toward -Z = INTO the hull.
**Picked**: keep the geometry as-is (preserves the real-world hinge
convention) + apply the NEGATIVE of `panelDoorAngle` at
`door.rotation.y` in `updatePanelDoors`. State field stays a positive
magnitude; the sign convention is encoded once at the application
site, documented inline at both the application site and the geometry
definition.
**Why**: a one-line fix that preserves the original geometry's
real-world convention (hinges on the LEFT, handle on the RIGHT —
matches actual fuse boxes when viewed from outside). Alternative
("flip the geometry") would have swapped the hinge to RIGHT edge +
moved handle to LEFT + moved 4 rivets — visually identical when
closed but 6+ lines of changes per callsite and a violation of
the real-world convention.
**Apply**: don't introduce a new positive-vs-negative-rotation
convention; the negative is the docstring-blessed encoding of the
hinge-frame ↔ open-direction relationship. Future panels added via
addAccessPanel inherit the fix.
**friction-score:** 1

## D102 — addAccessPanel as the universal salvage-panel pipeline (Session ABA)
**When**: ABA legacy panel migration + procgen wreck system. Pre-ABA
the 4 flagship modules (satelliteDish, crashedHull, engineBlock,
openingWreck) each had their own inline `make*AccessPanel` helper
that built a simple Box body + horizontal rim — none of them
participated in the AAR hinged-door / AAS interior detail / AAT
condition tiers / AAU recess / AAS glow pipeline. Latent bug
discovered during P2/P3 audit: legacy panels were pry-able but the
extract path found NO `panelComponents` → force-stripped with no
loot.
**Picked**: every salvage panel in the project goes through
`addAccessPanel(parent, localX, localY, localZ, scale, faceYaw, kind)`.
Legacy callsites migrate via a **wrapper-Group pattern**: each
callsite constructs an empty Group → calls addAccessPanel(wrapper,
0, 0, 0, 1, 0, kind) → positions + rotates the wrapper. The
wrapper's local +Z encodes the panel's outward direction;
addAccessPanel recesses the body INTO -Z so the front face sits at
the wrapper's origin (flush with hull surface).
**Why**: ONE source of truth for the panel pipeline means future
features (P2-style fixes, new condition tiers, glow effects, panel
material variants) land everywhere automatically. Procgen wreck
system in the same session was the 4th-and-final caller using the
panel pipeline, and benefitted from the same uniformity.
**Considered alternatives**:
- Keep the inline copies + manually backport AAR/AAS/AAT/AAU fixes
  to each (rejected — already missed the AAU recess sweep, would
  miss future ones).
- Extract a shared `buildAccessPanel(scale, kind)` returning the
  Group + body (rejected — addAccessPanel already does this, just
  with a parent arg). The wrapper-Group pattern uses what's there.
- Extend addAccessPanel to take a Quaternion for full 3-axis
  rotation (rejected — wrapper-Group pattern handles all 3 axes
  trivially via the parent's transform).
**Apply**: any module needing a salvage panel must call addAccessPanel
via the wrapper-Group pattern. The wrapper's local +Z = outward
direction. Don't recreate panel materials or hinge geometry locally.
**friction-score:** 2

## D103 — Shared `terrainAlign` util — when to extract (Session ABA)
**When**: ABA. The terrain-slope alignment helper (4-cardinal
heightAt sample → finite-difference gradient → normal → project
heading onto tangent plane → orthonormal basis → setFromRotationMatrix)
existed in 3 places: `tent.ts`, `largeTent.ts`, `companion.ts`. Each
had different argument conventions: tents took a `pos: Vector3`,
companion took `px, pz` scalars. Per D98, the 4th caller triggers
extraction; P7's procgen wreck system in the same session would be
the 4th.
**Picked**: extract to `src/util/terrainAlign.ts` exporting
`alignToTerrain(obj, terrain, x, z, yaw, sampleRadius)`. Module-level
scratch vectors preserve the no-allocation per-frame behavior the
companion's local copy had. Dropped the Vector3 `pos` param in favor
of (x, z) scalars — matches companion's pattern and lets future
scattered-positioning callers avoid Vector3 allocation just to call
the helper.
**Why**: 3 copies is the cost-tolerable threshold; 4 means at least
one copy will drift. The shared util captures the proven 4-cardinal
+ projection pattern so the next caller (and the one after) gets it
right for free. Once-only scratch vectors mean per-frame callers
(companion) keep paying zero GC.
**Apply**: lift the 5th-caller-shaped helper if you spot it. Don't
extract at 2 callers — the cost of generalizing the API outweighs
the savings until the 4th would land within the same session as the
3rd.
**friction-score:** 1

## D104 — Procgen wreck composite system — coexists with hand-modeled (Session ABA)
**When**: ABA P7 first-cut delivery. The composite system
(procgenWreck.ts) is fundamentally different from the legacy
hand-modeled wreck-kind palette (engine_cluster / fuselage /
escape_pod / cargo_container / engine_bell): composite builds a
wreck from a sequenced part vocabulary, legacy is a finished single
silhouette. Both are valid; both have different visual profiles.
**Picked**: integrate composite as a SHARE of procgen slots
(`Tuning.PROCGEN_COMPOSITE_SHARE = 0.35`) rather than replacing the
legacy palette. ~7 of 22 procgen POIs per world get composite
silhouettes; the rest stay on the proven 4-kind palette. Hand-
modeled flagship modules (satelliteDish, crashedHull, engineBlock,
megaShip, megaWreck) are NOT touched.
**Why**: gradual ramp lets multi-seed playtests evaluate the
composite system's visual quality alongside the proven legacy
palette before raising the share. Hand-modeled flagships have
deliberate silhouettes + interior shelter zones + custom colliders
that don't fit the part-vocabulary mold — keeping them out of scope
keeps this session's surface focused on procgen slots.
**Considered alternatives**:
- Replace legacy palette outright (rejected — multi-seed risk, no
  visual A/B data yet).
- Replace one specific legacy kind (e.g. `engine_cluster`) with the
  composite (rejected — splits the rollout decision into two: "is
  composite good enough" + "does engine_cluster have remaining
  value", harder to reason about).
- Composite system replaces flagship modules (rejected — flagships
  have hand-tuned narrative + interior + collider work that's not in
  scope; future-session expansion if the system proves out).
**Apply**: when adding new wreck-creation systems, default to
coexistence with the existing palette via a Tuning share constant.
Migration to "replace all" comes after playtest data validates the
new system, not at first ship.
**friction-score:** 2

## D105 — BackSide rendering for "open cavity" boxes (Session ABG)
**When**: ABG salvage panel interior bug fix.
**Why**: Salvage panels rendered as blank boxes when the door pried open
— the `body` mesh was a solid `BoxGeometry` with default `FrontSide`
material; its front face occluded the interior components even though
they were correctly positioned inside the box. The original design
intent (per the addAccessPanel comment "the body itself is the rusted
RECESSED CAVITY box") was for body to be an open-front cavity, but
BoxGeometry is always solid 6-faced.

**Picked**: render the body's material with `side: THREE.BackSide` and
`shadowSide: THREE.FrontSide`. From a player POV outside the panel:
the front face becomes invisible (BackSide doesn't render when viewed
from the +normal side, which is from outside-the-box), but the interior
walls (back face + 4 sides) DO render (player viewing from outside is
on the -normal side of those faces = "behind" them = BackSide). Door
covers when closed; opens to reveal the cavity contents.
shadowSide=FrontSide preserves normal shadow casting (BackSide self-
shadow can produce weird artifacts on small boxes). Material is
module-cached so all panels share one instance.

**Considered alternatives**:
- Replace BoxGeometry with a 5-sided shell (back + 4 walls, no front).
  Cleanest visually but breaks the body as a single raycast target
  + tagged interactable. Would have required restructuring panel
  geometry + child positions + collider conventions.
- Make body invisible + add separate "cavity walls" group. Same
  raycast problem (invisible meshes get skipped by raycaster).
- Move the body further back so its front face is below the hull
  surface. Breaks AAU recess convention + changes interact bounds.

**Apply**: any future "open-cavity" primitive that needs to be visible
from outside but appear hollow when opened can use the BackSide trick
on a solid BoxGeometry. Cache the BackSide-cloned material at module
scope. Set shadowSide=FrontSide unless self-shadowing is desired.
**friction-score:** 2

## D106 — Per-POI narrative content via Journal.kind + interactSubKind (Session ABF)
**When**: ABF POI narrative beats — 5 lone-survivor journals at hand-
modeled flagships (megaShip, megaWreck, satelliteDish, crashedHull,
engineBlock), each with a distinct narrator voice.

**Why**: 6 journals (1 W-era opening + 5 flagship) need to share the
SAME interaction handler (E-press → open modal panel) but render
DIFFERENT content per journal. Two approaches considered:
(a) 6 separate journal types each with its own placeXxxJournal +
its own openXxxJournalPanel function. Massive duplication.
(b) One Journal type with a `kind: JournalKind` discriminator; one
placeJournal that tags `mesh.userData.interactSubKind = kind`; one
openJournalPanel(ctx, kind) that looks up content in
`Map<JournalKind, JournalContent>`.

**Picked**: (b). The W-era system already had Journal as a single type
+ interactRegistry='journals' routing; ABF just extended it with the
kind discriminator. Interaction.ts case 'journals' reads `info.subKind`
(set by `placeJournal` via the existing `interactSubKind` userData
convention from AAY) and passes it to openJournalPanel.

**Apply**: any "many entities, one interaction handler, content varies
by tag" pattern follows this shape. Use `userData.interactSubKind` as
the canonical tag — interaction.ts surfaces it as `info.subKind`
without needing a registry lookup. Per-content lookup via a
`Map<Kind, Content>` exported from the UI module. The discriminator
type lives with the entity (Journal in journal.ts), not the UI.
**friction-score:** 1

## D107 — Procedural shader vocabulary as the formal extension of D3 (Session ABH)
**When**: ABH texture overhaul — needed to decide whether to (a) extend
the existing OO-era procedural shader pattern (terrainMaterial.ts,
hullMaterial.ts, fabricMaterial.ts) to more surfaces, or (b) revisit
D3's zero-asset-files policy to allow real PBR textures with normal
maps + albedo.

**Why**: Real PBR has the higher visual ceiling but two practical
problems against Dustfall: (1) the geometry is almost entirely
PROGRAMMATIC (Lathe, Cylinder, custom Box composites with no
meaningful UVs); applying normal/albedo textures would require
either custom UV generation per primitive type (substantial
engineering) or triplanar sampling (which IS effectively the
procedural shader approach with extra steps). (2) Bundle-size growth
of 50-200MB for CC0 PBR asset libraries, conflicting with the
zero-asset principle that started as D3 for audio and has been
informally extended to materials since the OO procedural shader era.

**Picked**: extend the procedural shader vocabulary. 4 new factory
modules (`metalMaterial.ts`, `paintMaterial.ts`, `stoneMaterial.ts`,
`skinMaterial.ts`), each following the proven onBeforeCompile pattern
(D62: world-space varyings + IQ hash + value noise + FBM). Applied
across weapons, placeables, world props, and creatures. Zero new
texture files; +11KB total bundle impact (just the shader source).

**Considered alternatives**:
- Path 1: Full PBR with per-mesh UV authoring. Rejected — 15-25h
  scope across 3-4 sessions, breaks D3, requires asset license vetting.
- Path 2: Hybrid with one small CC0 noise/grime atlas sampled via
  triplanar. Rejected this session as overkill — the procedural
  vocabulary covers the visual goal without breaking D3 at all.

**Apply**: any future surface that needs material detail uses one of
the existing factories or extends the vocabulary with a new factory
following the same pattern (IQ hash + value noise + FBM in world-space
+ multiplicative layer composition). The "no texture files" stance is
now formal policy for materials, not just audio. To revisit, a future
session would need to consciously break D3+D107 and budget for the
full PBR pipeline.
**friction-score:** 3


## D108 — Combined v10→v11 schema bump (huddleState + journalReadKinds + bornInDevMode)

**Rule**: When 3 additive-only fields ship in the same overnight bundle and target different ctx subtrees (companion / inventory / flags), they SHOULD be combined into a single SAVE_VERSION bump rather than 3 sequential bumps (v11/v12/v13).

**When**: Session ABJ overnight, 2026-05-24. Schema-affecting items were C1 (companion huddle persistence), C2 (per-kind journal-read tracking), and C12 (DEV mode flag persistence). All 3 followed D81's additive-only discipline (optional fields, defaults on load).

**Why**: Reduces migration overhead — 3 separate bumps would force the agent to write 3 separate "accept v11/v12/v13" version checks + 3 separate load blocks, each with its own correctness review. Combining means one diff, one save round-trip test, one decision entry. Pre-v11 saves load identically across either approach (additive fields default to undefined regardless). The risk reduction is small (additive bumps are low-risk) but the boilerplate savings are real.

**Considered alternatives**: Sequential 3-bump (v11→v12→v13). Rejected as boilerplate-heavy with no upside. The "atomic blame" property of one-field-per-bump matters when the bump is a SCHEMA SHAPE CHANGE (e.g., renaming a field); for additive optional fields, the blame radius stays at the file level regardless of bump count.

**Apply**: When the next overnight session has multiple additive-only fields targeting the schema, combine into one bump. When even ONE field requires non-trivial migration (e.g., renaming, restructuring), break that field into its own bump and combine the rest. friction-score: 1

## D109 — Procedural-shader `localSpace` opt for moving entities (Session ABN)
**When**: ABN bug-fix session, after user playtest report: "the companion's texture detail moves around when it moves, also the texture on the speeder bike moves around when the speeder moves — the textures should be more static but detailed."

**Why**: The ABH procedural shader vocabulary (skinMaterial, paintMaterial, metalMaterial, stoneMaterial, fabricMaterial, etc.) follows D62/D107: sample noise in WORLD-SPACE coords via `(modelMatrix * vec4(position, 1.0)).xyz`. For STATIC surfaces this is the right call — adjacent wall panels of the same wreck get coherent weathering that "matches up across seams" without needing UV authoring, and different instances at different world positions get free per-instance variation. For MOVING entities (creatures, vehicles), the same world-space sampling means the noise pattern re-evaluates at the body's NEW position each frame, so the texture detail visibly slides across the surface as the body translates. Reads as "the skin is crawling" / "the paint is sliding."

**Picked**: add `opts.localSpace?: boolean` to each procedural shader factory. When true, the vertex-stage assignment becomes `varying = position` (object-local) instead of the world-space transform. Branch is at the GLSL string-assembly level; zero runtime cost vs the static path. Default false preserves existing static-entity behavior + coherent world-aligned weathering.

**Applied this session**: skinMaterial.ts + paintMaterial.ts. Callers updated: companion (skin), sandworm (skin), lizard (skin), speeder hull (paint). Also added `disableShimmer?: boolean` to fabricMaterial.ts for VIEWMODEL fabric — same root cause (camera-relative "world" coords on viewmodels) but the shimmer also adds vertex displacement that has to be skipped.

**Considered alternatives**:
- Make every shader local-space by default. Rejected — would break the seam-coherent weathering on multi-panel static surfaces (megaWreck hull panels, locker bands, well rim stones) where world-space sampling is the feature, not the bug.
- Pass a per-mesh "isMoving" flag at uniform tick time. Rejected — would mean every static call pays uniform-update overhead + adds a runtime branch. Compile-time opt is cleaner.
- Use UV coords instead of either world or local position. Rejected — most procedural geometry (Lathe, custom Box composites) lacks meaningful UVs; would force per-primitive UV authoring (which is exactly what D107 rejected).

**Apply**: ANY future procedural shader factory MUST consider both static and moving callers up front. Default to world-space sampling (existing convention). Expose `localSpace` opt at the factory signature even if no current caller is a moving entity — the cost is one extra interface field + one shader-string branch, and the alternative (the user reporting "the texture crawls" after the fact and having to refactor the factory) is more expensive. Same applies to vertex displacements (ABE wind shimmer): if the factory does ANY vertex-level animation keyed off the noise input, expose a `disable*` opt so viewmodel + non-physical callers can suppress it without forking the factory.
**friction-score:** 2

## D110 — Third-person camera as offset-from-FP-camera (no separate camera) (Session ABO)
**When**: ABO A3 — added third-person camera mode + F-key toggle alongside the procedural primitive player rig.

**Why**: Two natural architectures for adding a 3P camera mode on top of an established FP pipeline:
(a) Maintain TWO PerspectiveCameras (`fpCamera` + `tpCamera`); swap which one the renderer uses per-frame based on `ctx.flags.thirdPerson`. Each camera owns its own pose; mouse-look + PointerLockControls would need to drive both.
(b) Keep the ONE existing PerspectiveCamera. Reuse its quaternion (set by PointerLockControls) as the spring-arm direction; in `syncCameraToBody`, branch on `ctx.flags.thirdPerson` and offset the camera's POSITION behind+above the player while preserving the rotation. The player rig appears in front of the camera because the camera is now positioned behind the player but facing the same direction.

**Picked**: (b). Reasons:
- No changes needed to PointerLockControls (still owns rotation via the single camera).
- No fork in render path (renderer always uses `ctx.three.camera`).
- Audio listener (Web Audio AudioListener is camera-attached) doesn't get teleported between cameras on mode swap.
- Cheaper to implement (~10 LOC `syncCameraToBody` branch vs ~50 LOC for dual-camera management + render-path switching).

**Trade-off**: 3P camera has no spring-arm collision (camera can clip into dunes / wreck walls when the player is against a surface). Documented as polish debt for ABP. The dual-camera path would have made adding collision easier (separate update loop) but the cost is high vs the benefit at this scope.

**Considered alternatives**:
- Dual cameras (option a above). Rejected per the audio listener + render path complexity + PointerLockControls integration overhead.
- 3rd-person ONLY mode (no FP at all). Rejected — FP is the canonical mode and the viewmodel/HUD is built around it; making 3P optional is a polish add, not a replacement.
- Spring-arm raycast for camera collision. Deferred to ABP polish session — the basic toggle ships now; collision joins it when the player feedback says "the camera clips into walls."

**Apply**: future camera mode additions (free-cam, photo-mode, top-down) follow the same pattern: branch in `syncCameraToBody` with mode-specific position+lookAt math; keep the single PerspectiveCamera as the renderer's eye. Add a new `ctx.flags.<mode>` boolean + a keybind handler that toggles it pause-gated.
**friction-score:** 2

## D111 — Procedural clothing layering as primitive composite (Session ABP)
**When**: ABP Tier 1 — overhauled the procedural player rig from blocky-primitives to mismatched-scavenger silhouette while staying within the D107 zero-asset policy.

**Why**: User asked for "looks like a real person, moves like a real person, probably has clothes on" while constraining the asset stance to procedural-only. Real-person-quality is unreachable without GLB + mocap — the honest ceiling is "convincing silhouette + better animation feel". Within that ceiling, the right approach is layered procedural clothing on top of the existing primitive rig (vs trying to make the bare-primitive itself "look real", which it never will).

**Picked**: Per-layer composition: torso under-cloth (existing skin material) + hood (ConeGeometry + half-cylinder back drape) + poncho (tapered CylinderGeometry with thetaLength<2π for open side) + bandolier strap (TubeGeometry along Catmull-Rom curve with natural sag — strap geometry matters; flat torus reads wrong) + pouches (4 BoxGeometry along strap path) + asymmetric pauldron (3 layered curved BoxGeometry plates RIGHT SIDE ONLY) + face bandana (TorusGeometry) + forearm wraps (per-elbow torus stack). Each layer uses the ABH shader vocabulary (fabric/metal/paint/skin) at appropriate weathering levels.

**Considered alternatives**:
- Single complex mesh per layer (e.g., a single MyPonchoGeometry custom buffer). Rejected — primitives compose faster, the shader vocab does the visual lift, and edits are localized to one geometry per layer.
- Symmetric pauldrons (matched pair). Rejected — research (sci-fi-desert-scavenger-aesthetic.md) explicitly recommends ASYMMETRIC armor as the genre tell that distinguishes "scavenger" from "soldier". Asymmetry is the silhouette identity.

**Apply**: future procedural character variants follow the same layer-per-mesh structure. If adding a new "outfit" variant (different faction / NPC), keep the rig hierarchy + replace/add layers. Avoid: complex CustomBufferGeometry (the maintenance cost dominates the visual gain at this aesthetic ceiling).
**friction-score:** 2

## D112 — 3P camera collision: Rapier raycast + 0.3m pushback (Session ABP)
**When**: ABP Tier 3 — added spring-arm collision to the 3P camera (ABO shipped 3P without collision; camera could clip into dunes/wreck walls).

**Why**: Three options were on the table:
(a) Three.js Raycaster against scene meshes — separate from physics, requires tagging static meshes
(b) Rapier `world.castRay` — uses the physics world, accurate per existing colliders, requires filtering player body
(c) Volumetric sweep (multi-ray or convex cast) — most conservative, highest cost

**Picked**: (b) Rapier raycast. Research (`docs/research/3p-cameras-in-games.md` section 4) explicitly recommends this for Three.js + Rapier projects — leverages existing collider tagging via the physics world, avoids duplicate scene queries, integrates with the same filter chain used by combat raycasts and sandworm detection. The 0.3m pushback buffer is the standard sweet-spot (0.2-0.5m range per research) — smaller buffers risk edge-hugging, larger buffers cramp the camera against the player.

**Considered alternatives**:
- (a) Three.js Raycaster — would require ADDING `userData.staticCollider` tags to every static mesh in the world, plus maintaining the filter as new POIs ship. Rapier already has every static collider registered; no additional tagging needed.
- (c) Sweep test — overkill for a survival game's exploration camera. Reserve for cases where a single ray genuinely misses (e.g., camera passing through narrow gaps).

**Apply**: any future camera-collision system in this project (debug-cam, photo-mode, replay-cam) uses Rapier raycast with the same exclude-player pattern. 0.3m pushback is the canonical buffer. If a use case ever needs volumetric correctness (e.g., a chunky drone camera), upgrade to multi-ray fan or proper sweep — single ray was sufficient for the standard 3P case.
**friction-score:** 2

## D113 — Dual-mesh held items with mode-gated visibility (Session ABP)
**When**: ABP Tier 4 — needed to render held items in the 3P rig's hand while preserving the existing FP viewmodel.

**Why**: Two architectures considered:
(a) **Single mesh**, shared between FP + 3P. Move the existing viewmodel mesh per-frame between camera-attached (FP) and rig-attached (3P) based on the mode flag. Cheaper to instantiate but requires runtime parenting changes + scale tweaks (viewmodel meshes are sized for camera-close ~10cm; world-rig is sized for arm-length ~30cm).
(b) **Dual mesh**: instantiate `def.makeViewModel()` TWICE on item swap — one for FP viewmodel (with viewmodel material conventions — depthTest off, renderOrder 999, no shadows) + one for 3P rig hand-attach (default render conventions, shadows on). Mode flag gates visibility, not parenting.

**Picked**: (b) dual mesh. Reasons:
- Viewmodel meshes need depthTest=false + renderOrder=999 to render on top of world geometry. Toggling those flags per-frame would force material recompile cycles (Three.js material hash changes). Keeping two separate material instances avoids this.
- Item meshes are cheap to instantiate (most are <50 verts; ItemDef.makeViewModel returns a small composite). The 2x instantiation cost on item swap is negligible vs the per-frame parenting cost of (a).
- The TWO meshes can be sized differently if needed (FP sized for close-camera; 3P sized for arm-length). Currently using same scale; future tuning can diverge.
- Lifecycle is clean: `swapEquippedMesh(vm, newId, ctx)` disposes both old meshes + instances both new meshes in one function. Visibility gate in `updateViewModel` is one-line per frame.

**Considered alternatives**:
- (a) single mesh — rejected per above (material recompile + parenting churn).
- (c) Three-layer render (camera-relative layer mask). Would require Three.js layer machinery (camera.layers) which Dustfall doesn't currently use. Higher integration cost for marginal benefit.

**Apply**: future hand-attached or cross-mode meshes (e.g., NPC viewmodels for shoulder-cam mode, vehicle dashboards in cockpit vs external cam) follow the same dual-mesh + visibility-gate pattern. Avoid runtime re-parenting between camera-attached + scene-attached groups.
**friction-score:** 2

## D114 — Walk cycle knee bend formula: peak at mid-swing, not mid-stance (Session ABQ)
**When**: ABQ — iterating ABP's walk cycle under the new iteration discipline. Static-pose screenshots at phase=π/4 and mirror phase=5π/4 revealed the knee was bending during the wrong half of the cycle.

**Why**: ABP shipped `kneeBend = max(0, sin(legPhase - π/3)) * 0.6` which peaks at `legPhase = π + π/3` (≈ MID-STANCE — the weight-bearing leg moment, when the foot is planted under the hip + the leg should be STRAIGHT). The forward-swing leg got a straight knee at heel-strike but mid-stance back-leg got the max bend — inverted relative to a real gait. The mistake wasn't surfaced before because `tsc clean + tier shipped` was the success gate; static-pose screenshots through the iteration discipline caught it.

**Picked**: `kneeBend = max(0, cos(legPhase)) * 0.65` — peaks at `legPhase = 0` (and 2π), which corresponds to MID-SWING (foot in air, leg recovering forward through the vertical), and is zero across `[π/2, 3π/2]` (heel-strike → mid-stance → toe-off, where the leg should be straight). Walk cycle now reads correctly: forward leg LIFTED with bent knee, back leg PLANTED with straight knee.

**Considered alternatives**:
- Tune the `-π/3` offset to a different value. Rejected — sin-with-shift cycles through both signs; whichever offset is chosen, the formula bends across HALF the cycle including stance phase. The `cos`-only formulation bends across the upper quadrant only (correctly the swing phase).
- Two separate phase windows with explicit gates. Rejected — `max(0, cos)` is a single expression doing the same thing more concisely.

**Apply**: any future per-leg gait curve (creature animation, NPC walk cycles, mount stride) follows this principle: knee bend peaks at MID-SWING (transition through vertical, leg-in-air phase), not at MID-STANCE. The `max(0, cos(legPhase))` shape is the canonical pattern.

This D-entry exists primarily as a memo for the iteration discipline: a bug like this is the kind of thing `tsc clean` will never catch, but per-element screenshot critique catches in one round. It was missed in ABP because that session shipped with `verify` as the only gate. **friction-score:** 1

## D115 — LatheGeometry as the canonical organic-body-shape primitive (Session ABS)
**When**: ABS — user direction "real video game quality model + rigging, not blocky figures and cylinders" required pushing the procedural rig past its primitive ceiling within D107 (zero-asset). Replaced 4 limb cylinders + 4-piece torso composite with single LatheGeometry meshes from hand-crafted profile curves.

**Why**: Three.js's primitive geometries (Box, Cylinder, Sphere) are uniform tubes/blocks. No taper, no muscle swell, no organic contour. Hand-crafting profile curves and rotating them via LatheGeometry gives smooth, controlled organic shapes at low poly cost (~250 tris per limb at 16 radial segments). The pattern composes well — body parts are mostly rotational solids (torso, arms, legs, fingers, hood crown, lantern globes) so a Lathe profile + rotation count is sufficient for the bulk of organic geometry needs.

**Picked**: LatheGeometry with hand-tuned profile arrays. Each profile is an array of Vector2(radial, axial) points. Profiles MUST start + end at radius=0 to close the mesh (open endpoints leave a visible interior cavity). For meshes that will be seen through cutouts (e.g., torso visible through poncho V), the material MUST be `side: DoubleSide` so the back-interior renders (otherwise FrontSide single-sided shows a black hole). Profile design tips: (1) shoulder/hip points are widest, (2) waist/knee/elbow are narrowest, (3) add multiple intermediate points for smooth curves not piecewise-linear edges, (4) 14-24 radial segments for smooth read at FP/close-3P range; lower for distant rigs.

**Considered alternatives**:
- Stay with primitives — already maxed out at "blocky scavenger silhouette" per ABP-ABR feedback. Path doesn't reach "real human body".
- Custom BufferGeometry per body part — full control over every vertex but maintenance cost dominates. The profile-array approach gets 90% of the look at 10% of the code.
- Subdivision modifier on primitives — Three.js doesn't have native subdivision; would need to write/include the algorithm. Heavy.
- Switch to GLB assets — violates D107 zero-asset policy. Off the table without explicit user re-vote.

**Apply**: future organic body parts (creature variants, NPC outfits, alien anatomy) use profile-array Lathes. Cylinder primitives reserved for genuinely-uniform tubes (poles, posts, simple ropes). Box for genuinely flat surfaces (panels, signs, armor plates). Sphere for genuinely spherical objects (balls, eyes, planets). The procedural rig file `playerRig.ts` is the reference implementation — torsoProfile / upperLegProfile / lowerLegProfile / upperArmProfile / forearmProfile arrays are the templates to copy from.

This is the architectural shift that lets the procedural rig actually approach video-game-rig quality within D107. **friction-score:** 2

## D116 — Over-the-shoulder camera convention (Session ABT)
**When**: ABT — user reported the pre-ABT 3P camera (3.2m back + 1.8m above, research-recommended in ABP) read as "weird position way above the player". Rewrote to match modern over-the-shoulder convention.

**Why**: Research in `docs/research/3p-cameras-in-games.md` recommended the wider 3.2m/1.8m offsets generically, but Dustfall's actual feel — survival exploration with combat focus — matches the TLOU/GoW/Souls over-the-shoulder convention better than the Souls/MGS distant-cam style. The two patterns differ in three axes:
- BACK distance: distant ~3.2m / over-shoulder ~1.5-2.0m
- ABOVE offset: distant ~1.8m / over-shoulder ~0.2-0.5m
- LATERAL: distant 0 / over-shoulder ~0.3-0.5m (offset to one side)
- TARGET: distant aims at player center / over-shoulder aims at shoulder anchor

**Picked**: Over-the-shoulder with shoulder-anchor target. Constants: `_3P_BACK_DIST=1.8`, `_3P_ABOVE_DIST=0.30`, `_3P_LATERAL_OFFSET=0.40` (right shoulder, perpendicular to camFwd in XZ), `_3P_SHOULDER_DROP=0.25` (shoulder is below eye). Camera position formula: cam = shoulderAnchor - camFwd × BACK + ABOVE upward, where shoulderAnchor = (playerPos + eyeOffset - shoulderDrop) + camRight × lateralOffset. Spring-arm collision rays fire from shoulderAnchor (not playerHead) so collision is symmetric with the offset.

**Considered alternatives**:
- Stay with distant-cam — rejected per user direct feedback
- Make it user-configurable (slider in settings) — premature; can add later if multiple users want different presets
- Souls-style high-pitch shoulder cam — picked the lower TLOU/GoW pitch since survival exploration benefits from horizon visibility

**Apply**: future camera modes in Dustfall (debug-cam, photo-mode, replay-cam, mounted-on-creature-cam) use the same shoulder-anchor pattern: target a body-anchor not a math-center, offset laterally for over-shoulder feel, keep back-distance tight (1.5-2.5m range). The lateral offset can flip to left shoulder for left-handed weapon swap, or to 0 for symmetric "behind" mode. **friction-score:** 1

## D117 — Procedural cloth drape via subdivided geometry + per-vertex offsets (Session ABU)
**When**: ABU — user direction to push procedural rig toward real video game quality required realistic cloth (not a smooth uniform tube). Within D107 zero-asset, no physics simulation budget — needed static geometry that READS as draped cloth.

**Why**: A single-segment CylinderGeometry tube can't read as cloth no matter how it's textured/colored — the silhouette is wrong. Real cloth has vertical fold ridges + valleys + a wavy hem from gravity-pull. Three procedural options:
(a) Modify the geometry's position attribute with hand-tuned per-vertex offsets
(b) Vertex shader displacement (procedural in shader code)
(c) Real physics simulation (Verlet/spring-mass on each vertex)

**Picked**: (a) — geometry-side per-vertex displacement. Walk the position attribute, compute polar coords from XZ, apply a sin-wave offset modulated by height. Then `computeVertexNormals()` so the lighting catches the displacement. Cost: ~240 verts processed once at build time. Result: static cloth that READS as draped + folded.

Formula:
```ts
for each vertex (x, y, z):
  r = sqrt(x² + z²)
  θ = atan2(z, x)
  t = (y - minY) / (maxY - minY)              // 0 at hem, 1 at top
  amp = AMP_HEM * (1 - t) + AMP_TOP * t        // attenuate top-ward
  newR = r + sin(WAVES × θ) × amp
  x *= newR/r;  z *= newR/r
```
With WAVES=6, AMP_HEM=4.5cm, AMP_TOP=0.8cm: clear visible fold ridges + scalloped hem, gentle near shoulders.

**Considered alternatives**:
- (b) Shader displacement — would need a custom vertex shader (or onBeforeCompile injection) just for poncho. Higher integration cost; cheaper per-frame but not needed (no animation). Reserved for cloth that needs wind-driven displacement (like the existing `fabricMaterial.ts` shimmer).
- (c) Real physics — way out of budget for a survival exploration game. Cloth physics is its own 400-LOC system. Cheap static-geometry-with-displacement gets 80% of the visual benefit at <50 LOC.

**Apply**: any roughly-cylindrical procedural mesh that should read as cloth (poncho, robe, banner, flag, curtain, sail, hood-drape) follows this displacement pattern. Tune amplitudes per use case. For meshes with multiple physical sections (e.g., a robe with a separate sleeve), apply per-section. For meshes that should ALSO have wind animation, layer this displacement underneath the wind shader so the static folds stay stable while the wind perturbs on top.

This is the cloth-quality unlock that lets procedural primitives + Lathes (D115) + this displacement (D117) cover most low-poly stylized character outfit needs. **friction-score:** 1

## D118 — Procedural rigging sub-pivot architecture (Session ABV)
**When**: ABV — pursuit of "real video game quality rigging" required adding wrist + ankle + spine bend pivots beyond the basic hip/knee/shoulder/elbow hierarchy shipped in ABP. Sub-pivots had been deferred 3 sessions running because they're code-heavier than geometry iteration.

**Why**: Low-poly stylized 3rd-person game character rigs use ~12-15 bone joints (hip × 2, knee × 2, ankle × 2, spine, neck, shoulder × 2, elbow × 2, wrist × 2). The procedural rig had 8 (hip × 2, knee × 2, shoulder × 2, elbow × 2) — missing the foot articulation, hand orientation, and spine motion that distinguish "puppet" from "character". Adding the missing 5 pivots (ankle × 2, wrist × 2, spine bend) puts the rig at parity with that low-poly-rig joint count.

**Picked**: Three.Group hierarchy with strategic insertion points:
- `wrists[2]` — child of each elbowGroup, parent of handGroup. Inserts between elbow and hand so wrist rotation moves the hand without affecting the forearm. Drives: subtle hang + opposite roll during arm swing.
- `ankles[2]` — child of each kneeGroup, parent of foot + toe meshes. Inserts between knee and foot so ankle pitch rotates the foot without affecting the shin. Drives: ASYMMETRIC plantarflexion (toes UP × 0.30 at heel-strike via cos>0, toes DOWN × 0.45 at toe-off via cos<0 — push-off should be MORE aggressive than landing).
- `spineBend` — child of body, parent of headGroup + shoulders + torso visuals + cloth (poncho/bandolier/pauldron). Hips/legs stay direct children of body. This lets the upper body bend with spine motion without dragging legs sideways. Drives: Z-sway opposite hip lift (-sin(phase) × 0.05) + X-lean (0.05 walking / 0.16 running, replaces the previous whole-body lean which tilted legs too).

**Considered alternatives**:
- Add fewer pivots (just ankle, say) — rejected: spine bend is what distinguishes "robot walk" from "human walk"; wrist hang is what distinguishes "puppet" from "person".
- Full IK chain (analytical inverse kinematics for limbs) — overkill for the gait quality we need; simple per-joint sin curves give 80% of the visual benefit at 5% of the complexity.
- Skeletal animation with bone weights — would require switching to GLB asset path, violates D107.

**Apply**: future creature rigs (companion, raider variants, NPC humanoids) that want animation parity follow the same insertion pattern. Insert sub-pivots between primary joints; drive with phase-locked sin/cos curves. ASYMMETRIC scale factors are important — biological motion isn't symmetric (push-off vs landing has different angles).

The combination of D107 (procedural-only) + D109 (skin localSpace) + D111 (asymmetric clothing) + D113 (dual-mesh items) + D114 (knee bend formula) + D115 (Lathe organic primitive) + D116 (over-shoulder cam) + D117 (cloth drape displacement) + D118 (sub-pivot architecture) is the full procedural-character pipeline that gets to low-poly stylized 3P game quality within zero-asset. **friction-score:** 2

## D119 — Kinematic-rider promotion for moving-platform items (Session ACC)
**When**: ACC — items thrown onto a tow-sled need to ride the sled as it accelerates at sprint speeds. Pure-friction approach was insufficient because the inextensible-rope position-snap teleports the sled body ~0.1m/frame, faster than Coulomb friction can drag a Newtonian rigid body along.

**Why**: For dynamic-on-dynamic carry, the carried body needs an explicit kinematic relationship to the carrier — not just frictional coupling. Three.js scene-graph parenting alone isn't enough because we want the carried body to remain physically collidable (so MORE items can be dropped onto the stack), so we keep the Rapier body and just change its mode.

**Picked**: when a dropped pickup body settles on the sled top deck collider (Rapier reports `isSleeping()` + XZ-and-Y range check), promote the pickup to `KinematicPositionBased`: capture the sled-local pose, drive `setNextKinematicTranslation` + `setNextKinematicRotation` each frame from `sled.group.matrixWorld × ridingLocalPos`. Mirror onto mesh + `pickup.pos` so raycasts and saves read correct world coords.

**Considered alternatives**:
- Scene-graph parent (like the locker mesh) — loses physical collision; new items dropped on the sled wouldn't stack on existing riders.
- Pure friction tuning — fails fundamentally at the per-frame position-snap (no friction coefficient can match a teleport).
- Distance constraint (Rapier joint) — Rapier-compat doesn't expose constraint joints stably; would also tangle with the existing rope constraint.
- Manual impulse per frame to match sled velocity — works in steady state but breaks on snap teleports.

**Apply**: any "object rides another moving body" carry mechanic (locker on sled was a scene-graph variant of this for an item with no physics body; the generalization to physics-bodied carry items is the kinematic-rider pattern). Future: items on a speeder cargo rack, items in a tossed-grenade pouch, etc.

Despawn flow works unchanged — Rapier `removeRigidBody` handles kinematic bodies the same as dynamic. Release-to-dynamic (sled gone) restores normal physics. **friction-score:** 2

## D120 — RopeEndpoint vocabulary, sled-as-implicit-second-endpoint (Session ACC)
**When**: B1 Phase 2 — generalising QQ's sled-specific `SledTether` union into a shared rope endpoint vocabulary. ACA had already added a 4th union member (static-pos), and the next natural step was non-sled tethers (corpse drag, lassoed pickup, etc.).

**Why**: The 5-member SledTether union (`none | player | speeder | companion | static-pos`) was implicitly the "other end" of a sled rope — the sled itself was always the second endpoint, never represented in the type. Future kinds (corpse, pickup, world-anchor stake) would either tangle into SledTether or require parallel unions per carrier type.

**Picked**: `RopeEndpoint` union in `src/world/rope.ts` covers all current and likely-future endpoint kinds (`none | player | speeder | companion | sled | static-pos`), with payload where needed (`sled.sledId`, `static-pos.x/z`). `Tether {a, b}` shape models a full rope as two endpoints, for future non-sled tethers. `Sled.tether` stays as a single RopeEndpoint (the "other end" view — sled is the implicit second endpoint of its own tether; same SledTether name kept as an alias for back-compat).

**Considered alternatives**:
- Full Tether{a,b} on every sled with sled-id explicit — works but doubles the storage + adds redundant info (sled always knows its own id; serialising it is waste).
- Generic Constraint type with per-kind subclasses — over-engineered for the current "sled-as-anchor" centric system.
- Lift the constraint logic out of `updateSleds` into a shared system — useful future move; deferred until non-sled tethers actually ship.

**Apply**: any new endpoint kind needs (a) addition to `RopeEndpoint` union, (b) a case in `resolveEndpointWorldPos`, (c) save serialization. Adding pure new endpoint kinds is now ~30 LOC each. Non-sled constraint physics (e.g., rope between two pickups) is a separate larger lift that the Tether{a,b} model positions for. **friction-score:** 2

## D121 — Twilight breach as ambient threat-display, bypass combat loop on exit (Session ACC)
**When**: ACC pre-work — user asked for ambient breach drama at sunset/sunrise (visible at distance, no engagement). Existing `stationaryBreach` state was reachable only from the retreat → alert combat loop.

**Why**: The existing exit path of `stationaryBreach` transitions to `retreat`, increments `attackCount`, picks a retreat target — all combat-loop side effects. For an AMBIENT (non-engagement) breach, those side effects are wrong — player wasn't detected, so there's no engagement to wind down.

**Picked**: a single boolean flag `_isTwilightBreach` set in the patrol-trigger branch before calling `enterStationaryBreach`. The exit logic in `tickStationaryBreach` checks the flag: if true, route straight back to `patrol` (reset flag, no `attackCount` increment, no `pickRetreatTarget`); if false, the original retreat path runs.

**Considered alternatives**:
- A separate `twilightBreach` state with copied tick logic — works but duplicates ~50 LOC of the breach animation curve for one flag-difference.
- New "ambient" sub-state inside `stationaryBreach` (a state-of-the-state) — overkill for one bit of variation.
- Pure parameterization — would require a stateBag pattern, not justified here.

**Apply**: when reusing a state-machine state for a variant outcome that bypasses normal transitions, flag the entry point + branch the exit. Cleaner than duplicating the tick logic, simpler than full sub-state. **friction-score:** 1

## D122 — Managed-scalar slope-slide bypasses Rapier velocity integrator (Session ACD)
**When**: ACD playtest follow-up — pre-ACD slope-slide used `setLinvel` to push the sled downhill each frame, but the sled visibly didn't move. Diagnosed: Rapier's contact solver was zeroing the tangential velocity each step due to the body's 0.6 friction with the heightfield (static-friction angle atan(0.6)≈31°, swallowing every dune slope).

**Why**: Direct setLinvel + Rapier contact resolution is fundamentally incompatible — anything we add via setLinvel gets eaten by friction the next step. The body's friction coefficient is what we want for towing feel (sled grips sand when stationary), so we can't just lower it.

**Picked**: managed-scalar XZ velocity (`_slideVx`, `_slideVz` fields on Sled) driven entirely by our code — slope-gravity adds, Coulomb friction subtracts, linear damping decays. Position update via `setNextKinematicTranslation(currentXZ + slideV*dt)`. Bypasses Rapier's velocity-integration + contact-resolution path entirely; the body's collider friction now only matters for collisions with OTHER bodies.

**Considered alternatives**:
- Lower body collider friction to ~0 — would break tow feel.
- Use `applyImpulse` instead of setLinvel — same problem (Rapier still resolves contacts after the impulse).
- KinematicVelocityBased body type — setLinvel-driven kinematic; would still pass through contact resolution.

**Apply**: when you need a body to move under "your physics" rather than Rapier's, drive position directly via `setNextKinematicTranslation` each frame and maintain motion state in your own data fields. Set the body type to KinematicPositionBased so Rapier doesn't integrate position from forces/linvel. **friction-score:** 2

## D123 — Sled body KinematicPositionBased + tilts to match terrain slope (Session ACD)
**When**: ACD playtest follow-up — (a) dynamic items on the sled deck were transferring lateral friction impulses to the sled body via Newton's 3rd law, accumulating in body.linvel and pre-empting our setTranslation; (b) the axis-aligned sled body on a slope had uphill terrain poking up through the body's XZ footprint, so players walking onto the sled landed on terrain inside the footprint, not on the deck.

**Why**: (a) Kinematic bodies are immune to dynamic-body push impulses (one-way kinematic-vs-dynamic interaction). The user explicitly wanted the player to not push the sled either — kinematic gives this for free. (b) The body collider being axis-aligned while the visual deck tilted to match terrain was a visual-vs-physics mismatch. With the body itself tilting, the top face is uniformly 2*hy + clearance above terrain across the full footprint.

**Picked**: body type → `KinematicPositionBased`; rotations driven each frame via `setNextKinematicRotation(slerp(currentRot, terrain-tilt × yaw, lerpRate))`. Both visual and physics conform to terrain slope. Items on the now-tilted deck stay put via top-deck friction (0.85) since atan(0.85)≈40° static threshold beats any reasonable dune slope. Player walks the tilted deck via KCC's normal slope-walking.

**Considered alternatives**:
- Keep body axis-aligned + sample terrain at all 4 corners + raise body Y to max corner (Option A) — works for terrain-poke-through but leaves sled visibly floating above the downhill side on steep slopes (up to 30-80cm at 10-20° slopes).
- Dynamic body with huge density to resist item push — items still accumulate small pushes that compound; doesn't solve terrain-poke-through.

**Apply**: for placeable objects on uneven terrain, tilt the body collider to match terrain normal (not just the visual). Conform-to-terrain physics is cleaner than work-around layers. **friction-score:** 2

## D124 — CCD enabled on dropped-pickup bodies prevents thin-collider tunneling (Session ACD)
**When**: ACD playtest follow-up — user reported rope (and any other flat-bbox item: cloth, bandage) falls THROUGH terrain when dropped via G.

**Why**: Some viewmodels have very thin AABBs — the rope coil is a flat horizontal torus, bbox.y ≈ 6.6cm after 1.5× scale, so the cuboid collider half-height hits the 4cm `Math.max` floor. 8cm-thick collider + 60cm spawn height + downward throw velocity (camera-direction × 3.2 m/s when looking down) = body reaches 4+ m/s within 0.3 sec, per-frame travel at 60Hz = ~7cm, exceeding the 8cm collider thickness. Rapier's discrete collision detection misses the heightfield and the pickup tunnels through.

**Picked**: enable CCD (`setCcdEnabled(true)`) on all dynamic dropped-pickup bodies. Rapier's swept-shape test catches the crossing regardless of step size. Cheap on the ~30 pickup max in flight; covers all flat-bbox items (rope, cloth, bandage) automatically.

**Considered alternatives**:
- Per-item collider sizing (bump min half-height to 0.06m+) — would make settled items visually float above terrain.
- Cap initial throw velocity — kills the gameplay value of the aimable throw arc.

**Apply**: any dynamic body with a thin AABB + initial velocity needs CCD. Cheap insurance. **friction-score:** 1

## D125 — Sled riding mechanic tabled — Rapier KCC has no moving-platform support (Session ACD)
**When**: ACD playtest follow-up — user wanted "stand on the sled, sled moves, player rides with it". Spent significant time trying multiple architectures; ultimately tabled.

**Why**: Rapier's `KinematicCharacterController` has no built-in moving-platform tracking. Standing on a moving kinematic body doesn't auto-carry the player; the deck moves out from under the capsule each frame. Multiple manual platform-ride architectures were tried:
1. Detect player on sled (raycast + AABB+Y fallback), add sled's per-frame XZ delta to KCC `desired` BEFORE `computeColliderMovement` — KCC's slope-projection ate ~20% of horizontal motion when standing on the tilted body (Option B), causing drift.
2. Apply delta AFTER `computeColliderMovement` to bypass slope-projection — drift dropped to ~10% but the player's Y still followed gravity instead of the sled's Y change; gap built until detection dropped.
3. Sticky ride state + full 3D delta (XYZ) + `_frameDeltaY` tracking — player still slid off after 5-10 frames.

The fundamental issue: KCC's slope projection, autostep, and contact resolution interact with a tilted moving kinematic body in ways that no amount of detection + delta application could fully counter.

**Picked**: TABLE the feature. Remove platform-ride code from controller.ts. Preserve the sled-side data (`_frameDeltaX/Y/Z` + Option B body tilt) as foundation for a future attempt. Document tried approaches + concrete next-attempt directions in backlog.md.

**Considered next-attempt directions** (for whoever picks this up):
- **Full Option C parenting**: when on sled, COMPLETELY override `setNextKinematicTranslation` to (sled.tr + savedLocalOffset + inputMotion). Skip KCC entirely while riding. Jump (Space) exits ride state. Most deterministic; bypasses KCC's interaction-with-moving-platform issues entirely.
- **Synthetic "ride peg" dynamic body**: the user observed they CAN stand on a branch dropped on the sled. Branches are dynamic; the branch's irregular geometry creates a "depression" the capsule sits in, and gravity tracks the moving depression (a happy accident of contact resolution). Spawn a thin invisible dynamic cylinder anchored to the sled center; player capsule overlaps slightly with its upper portion; lateral motion of the cylinder shoves the capsule via Rapier's contact resolution. Mirrors the working "branch on sled" case directly.

**Apply**: when a feature requires fighting the physics engine, evaluate whether to switch to a fundamentally different approach (bypass the engine for that motion). Don't keep adding bandages. **friction-score:** 3 — this is a real gameplay feature the user wants; tabled doesn't mean abandoned.

## D126 — Inextensible-rope constraint extracted as shared helper (Session ACE)
**When**: B1 Phase 3 — pre-ACE the constraint math (position-snap + radial/perpendicular damping) lived inline in `updateSleds`. ACE shipped the first new tetherable endpoint kind (stake), and additional kinds (raider_corpse, sandworm_carcass) are queued. Each new kind would need to apply the same end-of-line behavior to a different towed body type. Inline-in-updateSleds wouldn't scale.

**Why**: The math is body-agnostic — given an attach point, an anchor, a max distance, and managed velocity scalars, the helper enforces the rope constraint regardless of what's at either end. Extracting it lets any callable system run the same logic against any body, while keeping sled-specific scaffolding (slope-slide velocity model, yaw-lerp, rope mesh rebuild) in updateSleds.

**Picked**: `applyInextensibleConstraint(target, anchor, params)` in `src/world/ropeConstraint.ts`. Target shape captures the body + managed velocity scalars + terrain + clearance. Returns `{ snapped, torn, postX/Y/Z }` so the caller can react (detach on torn, update its post-snap state on snapped). Sled.ts refactor preserves behavior (verified via existing save reload + slope-slide regression check).

**Considered alternatives**:
- Class-based AbstractTetheredBody — over-engineered; the helper is pure data-in/data-out.
- Embed constraint as a method on RopeEndpoint — anchors and towed-bodies aren't symmetric, so a method on the endpoint enum is awkward.

**Apply**: when adding a new tetherable entity kind, populate the constraint target from its body + a managed velocity (or zero scalars if the body doesn't slide), call the helper, react to the result. The constraint vocabulary is the integration point, not new constraint math each time. **friction-score:** 2

## D127 — Multi-worm v13 schema migration (singleton → array) (Session ACE)
**When**: Tier 2 — extending the single boss-tier sandworm to N=2-3 worms per world per playtest signal that one worm felt gameable across long sessions. Also a strategic schema prep step: every wandering-entity class (lizards, raiders, dropped pickups, fires, tents, lockers, sleds) is array-keyed; the lone singleton was a future-streaming-refactor blocker.

**Why**: Pre-v13 the schema field `sandWorm: { … } | null` couldn't grow additively (an additive field would conflict with the existing one). The cleanest path was a version bump that lifts singleton → `sandWorms[0]` on load and serializes the array going forward.

**Picked**: SAVE_VERSION 12 → 13. Schema gains optional `sandWorms?: SandWormSave[]` field; legacy `sandWorm?` retained (loader checks both — v13+ uses array, pre-v13 lifts singleton). At load time the worms in `ctx.sandWorms.list` (boot-spawned per Tuning.SANDWORM_COUNT) are matched IN ORDER to saved entries (saved id NOT used — boot allocates fresh ids per session and matching by index is simpler). Mismatched counts: saved > spawned → extras ignored; spawned > saved → extras retain default boot 'patrol' state. Also fixed a latent version-check bug that was rejecting v12 saves entirely.

**Considered alternatives**:
- Match saved worms back to spawned worms via SAVED id → SPAWNED id mapping. Boot ids start from 1 each session; the in-order index approach is robust to seed changes and avoids stale-id concerns.
- Keep singleton + add second-worm field — would require another migration when extending to N > 2; bad direction.

**Apply**: when array-ifying a singleton, bump the schema version. Keep the legacy field in the type union so the loader can detect + migrate pre-bump saves. Match boot-spawned instances to saved entries by INDEX, not id. **friction-score:** 3

## D128 — Procedural-character pipeline applied to lizard (Session ACE)
**When**: Tier 3 — the player rig had a 10-session arc (ABP-ABY) ending at low-poly-stylized 3P character quality using D115 Lathe geometry + D117 cloth drape + D118 sub-pivot rigging. The same primitive-only pipeline applies to NPCs; lizard was the first lift (companion + raider held off per user direction).

**Why**: NPCs (lizards, raiders, companion, sandworm) ship per D107 zero-asset, meaning no GLB / no PBR textures. Their visual quality ceiling was bounded by what could be expressed with primitives. D115 Lathe geometry unlocked anatomical body silhouettes for the player rig; the same Lathe vocabulary applied to NPCs lifts them past the Box+Sphere+Cylinder block-figure look.

**Picked**: lizard body, head, tail all rebuilt as Lathe meshes. Body 8-point profile (tail-end → hip → ribcage-peak → shoulder → neck) rotated z=-π/2 so axis aligns with world +X. Head 6-point profile rotated z=+π/2 (FLIPPED relative to body) so snout sits at +X tip and neck-joint lands at body's neck-end. Tail tapered 5-point profile. Legs asymmetric (front shorter than rear, sprawl posture) with knee/ankle bumps. **5 iteration rounds** per the discipline (shared-memory/iterative-polish-discipline.md): R1 baseline, R2 fixed head orientation + stretched body, R3 ground contact, R4 belly-on-ground Y-squash, R5 head-body overlap for smooth neck transition.

**Apply**: when applying the procedural-character pipeline to a new NPC: identify the anatomical landmarks (snout/neck/shoulder/ribcage/hip/tail-base/tip), build Lathe profiles for each major segment, verify orientation (Lathe spins around Y; rotation.z = ±π/2 puts axis along ±X), iterate per the discipline. The Z-squash trick (scale.set(1, Y, Z) where Z < 1) gives a wider-than-tall reptile cross-section without re-authoring the profile. **friction-score:** 2

## D129 — Footstep audio + dust driven from rig.stepCount, not _stepAccum (Session ACE)
**When**: Tier 4A — pre-ACE the controller's footstep audio fired on a distance accumulator (`_stepAccum`) while the rig's visual gait ran on a sin-wave timer (`gaitFreq * phase`). ABY P1 calibrated `STEP_DISTANCE` constants to match the rig's gait math, but the two timers were independent and could drift over distance.

**Why**: A footstep is a single event that should fire ON the visible heel-strike, not on a parallel distance threshold that approximates the heel-strike. ABY introduced `rig.stepCount` (incremented per heel-strike in playerRig.ts), so reading it directly in controller.ts locks audio to the actual visible foot event.

**Picked**: controller.ts checks `ctx.player.rig`; if present, derives `stepsThisFrame` from `rig.stepCount - _lastSeenStepCount`. Legacy `_stepAccum` path stays as fallback for cases where rig is null (defensive — shouldn't happen post-ABP). State-change burst guard (delta < 5 fires steps; delta >= 5 fires exactly 1 step then resyncs) prevents the lastSeenStepCount sync issue at state transitions. Foot dust now spawns at `rig.ankles[parity].getWorldPosition()` (terrain-clamped Y) instead of body-center + lateral-offset.

**Apply**: when the agent needs an audio/effect event to fire on a visible animation beat, drive it from the visual system's beat counter, not from a separately-calibrated approximation of the same beat. Calibration drifts; direct reads don't. **friction-score:** 1

## D130 — Stake as craftable persistent RopeEndpoint alongside ad-hoc static-pos (Session ACE)
**When**: B1 Phase 3 — pre-ACE the `static-pos` RopeEndpoint kind (introduced ACA) anchored a sled to the player's foot XZ at the moment they dropped the rope (LMB-on-empty-ground with rope wielded). It's transient — no in-world entity, no save persistence of the anchor mesh, no way to interact with the anchor point afterward. ACE adds a craftable + persistent version: the iron stake.

**Why**: Players were dropping the rope and forgetting where the sled was anchored. A visible in-world entity (the stake mesh + sand mound) gives the anchor a spatial identity. Crafting cost (scrap×3 + branch×1) gates it lightly so it's not free; pack-up via RMB recovers the kit so it's reusable.

**Picked**: keep BOTH endpoint kinds — `static-pos` for ad-hoc "drop the rope here right now" UX (LMB-on-empty-ground), and `stake` for craftable persistent anchors (LMB-on-stake-with-rope-wielded re-anchors). Stake's interaction surface (a registered entity with hover state) is what gives it the spatial identity static-pos lacks. Save schema additive — both kinds round-trip independently.

**Considered alternatives**:
- Replace static-pos with stake entirely — would require crafting at game start, ruins the muscle-memory drop-rope flow.
- Make static-pos persistent by adding a visual marker mesh — would re-create stake without crafting cost / pack-up symmetry.

**Apply**: when adding a craftable upgrade of an existing mechanic, keep both — the craftable serves as a permanence/identity upgrade, not a replacement. The ad-hoc flow is the "every player can do this immediately" baseline. **friction-score:** 1

## D131 — Corpse/carcass are TOWED-body RopeEndpoint kinds; drag state lives on the entity (Session ACF)
**When**: B1 Phase 3 follow-up — adding `raider_corpse` + `sandworm_carcass` to the `RopeEndpoint` union (closing ACE's Cut #3). Every prior endpoint kind (player, speeder, companion, sled, static-pos, stake) is an ANCHOR — the thing the rope is tied *to*, that the sled is constrained *toward*. A corpse you drag is the opposite role: it's the TOWED body, and the anchor is the player/speeder/sled.

**Why**: The naive read of "add corpse to RopeEndpoint" is to set `sled.tether = { kind: 'raider_corpse' }`. That's backwards — it would constrain the sled toward the corpse (sled towed *by* the corpse), which is not a gameplay flow. The actual relationship is corpse-towed-toward-anchor, so the tether state must live on the CORPSE, not the sled. Added `dragAnchor?: RopeEndpoint` to `Raider` + `SandWorm` (the anchor end; `{kind:'none'}`/undefined = not dragged). NEW `src/world/killDrag.ts` (`updateKillDrag`) is the first non-sled caller of D126's `applyInextensibleConstraint`: it treats the kill as the towed body and the `dragAnchor` as the anchor, runs each frame AFTER `updateRaiders`/`updateSandWorm` (both `continue` past dead entities, so drag-movement is unowned and free to take) and BEFORE `updateSledRiders`. Rope visual is self-contained in killDrag (keyed by entity id, disposed on detach) — no per-entity `ropeMesh` field needed.

**Considered alternatives**:
- Put the tether on `sled.tether` as `raider_corpse` — wrong role (see above); the save serializer still handles those kinds defensively (mirrors the existing 'sled' kind that "won't fire under current gameplay") but no flow sets them.
- A generic `TowedBody` interface both sled + corpse implement — over-engineered; the constraint helper is already data-in/data-out, and sled keeps its own velocity-managing scalars (slope-slide) that a corpse doesn't have.

**Apply**: when a new RopeEndpoint references something the rope DRAGS rather than is anchored to, store the anchor on that entity (`dragAnchor`) and drive it through `updateKillDrag` / `applyInextensibleConstraint` — do NOT put it on `sled.tether`. **friction-score:** 2

## D132 — Sandworm carcass towable only behind the speeder; tow-before-harvest (Session ACF)
**When**: B1 Phase 3 follow-up — surfaced at session-start as a design fork (the autonomy contract flagged it) and resolved with the user. The worm is a ~24m kinematic boss; "drag the carcass with a hand-rope on foot" clashes hard with the realism dial.

**Why**: A human dragging a 24m carcass across dunes is absurd. But cutting the carcass-drag entirely loses a fun trophy/harvest-logistics beat. Compromise: the carcass is towable ONLY while the player is mounted on the speeder (the vehicle implies the power). `killDrag` guards `anchor.kind === 'speeder'` for worms (clears any stale non-speeder anchor); `interaction.ts` gates the tie on rope-wielded + `speeder.mounted`, with a soft on-foot hint ("too heavy to drag on foot — tow from the speeder"). The raider corpse (human-scale) keeps the full on-foot + sled drag.

**Known edge (shippable, low-severity)**: `lootSandWorm` untags the carcass mesh on harvest, so a carcass is interactable (and thus towable / cut-loose-able) only BEFORE it's been harvested. The intended flow is tow-then-harvest; harvesting ends the carcass's interaction surface. A carcass already being towed when harvested keeps moving (killDrag doesn't need the tag) but can no longer be cut loose via interaction until the rope tears.

**Considered alternatives**:
- Tow on foot too — rejected on realism.
- Cut the carcass drag entirely — loses the logistics beat; the speeder-only path keeps it cheaply.

**friction-score:** 1

## D133 — Dragged kills yaw head-first toward the anchor; orient via the entity's existing yaw, not a fresh transform (Session ACG)
**When**: Cycle 1 (drag verification) — ACF deferred orienting the dragged corpse/carcass "until verified against the dead pose so we don't fight it." ACG confirmed it's safe and shipped it.

**Why**: A dragged body that slides sideways reads wrong; it should trail head-first behind whatever pulls it. The deferral existed because a dragged kill's orientation could collide with the rotation its *dead pose* already applies. Reading the dead-pose code resolved it: `applySandWormDeadPose` sets `mesh.rotation.set(0, worm.yaw, 0)` (yaw-only), and the raider's rig-path dead pose leaves `group.rotation` at identity (only the primitive-flop fallback sets `.x`). So setting a world-Y yaw toward the anchor composes cleanly in every case — for the worm, drive its existing `worm.yaw` + match the mesh; for the raider, set `group.rotation.y`.

**Picked**: in `updateKillDrag`'s snapped branch, `yaw = atan2(anchor.x − post.x, anchor.z − post.z)` (the raider faceTarget convention) applied to the entity's own yaw channel. Human playtest (ACG) confirmed the head/tail sign is correct (no ±π flip) for both kinds.

**Considered alternatives**:
- Compose a fresh quaternion on the mesh — would fight the dead-pose rotation; using the entity's existing yaw channel is the safe seam.
- Orient continuously (even at slack) — chose snapped-only so a stationary dragged body doesn't swivel in place; it reorients only while actively pulled.

**Apply**: when a system needs to reorient an entity that another system already poses (dead pose, ragdoll, animation), drive the SHARED rotation channel that pose uses, after confirming that pose's rotation convention — don't stack an independent transform. **friction-score:** 1

## D134 — Headless gameplay entry (`__game.enterGame`) for agent self-verification of visual work (Session ACH)
**When**: Cycle 2 (Rig to Rey-tier) — a heavy visual-iteration cycle. Rule 8 requires screenshot/critique/iterate, but the agent couldn't get the in-game rig rendered headlessly: a synthetic/preview click on NEW GAME / DEV MODE entered the title-gone scene but the game never *ticked* (elapsed stuck at 0), so the rig never posed/animated and screenshots showed a frozen or empty frame.

**Why**: The title handoff (`handoffToGame`) sets `flags.titleActive = false` and (in non-preview contexts) calls `controls.lock()`. But `flags.paused` is ONLY cleared in the pointer-lock `'lock'` event handler (`input.ts`) — and pointer-lock is deliberately skipped for preview-like contexts (the `isPreviewLike` guard, to avoid hijacking the cursor). Net: a preview entry leaves `paused = true` forever → the per-frame loop renders but early-returns before any game logic. The agent literally could not drive the game to verify its own visual edits.

**Picked**: a DEV-only `__game.enterGame(dev?)` hook (impl in `main.ts`, exposed via a `DebugHooks` closure passed to `installDebugPanel`) that bypasses the button + pointer-lock entirely: runs the handoff side-effects + sets `flags.paused = false` directly. Combined with `ctx.three.renderer.setSize(w,h)` (the preview canvas can boot at 0×0), `ctx.flags.thirdPerson = true`, and posing joints via `ctx.player.rig.*` while paused, this gives a complete headless **edit → HMR → enterGame → pose → screenshot → critique → iterate** loop with no human in the loop. It immediately paid off — it caught + verified the fix for a latent floating-knuckle-bump bug.

**Footguns** (learned this session): (1) pause AFTER the rig has settled at the player position — pausing in the same tick as enterGame freezes before `updatePlayer` positions the rig, so joint world-positions are stale and the framed camera aims at empty sky; let it run a frame, then pause + pose + frame. (2) The preview-MCP screenshot capability can wedge independently (timed out even on a fresh title boot mid-session); a Claude Code / preview-MCP restart cleared it. (3) The continuous rAF render keeps painting, so rely on `enterGame` + state inspection for STATE verification even when pixel capture is flaky.

**Considered alternatives**: clicking the real button (synthetic clicks are flaky + don't satisfy pointer-lock); making `handoffToGame` set `paused=false` in the preview branch (changes the prod-ish handoff path; a separate DEV hook is safer + explicit). **friction-score:** 1

## D135 — `getWorldDirection` points AWAY from a character's face; negate for "front" framing (Session ACI)
**When**: PM-Cycle B — the `rigStudio` verification helper (D134) framed `'front'`/`'head'` by placing the camera along `rig.headGroup.getWorldDirection()`. Every studio shot turned out to be the **BACK** of the character. The bug went unnoticed across the PM-Cycle A silhouette audit because the body is roughly front/back-symmetric — it only surfaced when the head got a face-opening (which appeared on the far side from the "front" camera).

**Why**: `Object3D.getWorldDirection()` returns the world-space direction of the object's **+Z** axis. The rig is authored with the **face toward the head's local +Z... no — toward −Z relative to getWorldDirection's result**: empirically, the camera placed at `headPos + getWorldDirection()*d` saw the back of the hood, and `headPos − getWorldDirection()*d` saw the face. So the face is opposite the reported "world direction." (The exact local-axis convention is murky in this rig; the empirical test — screenshot both sides — is the reliable arbiter, not reasoning about the axis.)

**Picked**: in `rigStudio`, negate the direction (`fwd.negate()`) so `'front'`/`'head'` look at the face. Lesson: when a headless framing tool aims via `getWorldDirection`, **verify which side is the face with a two-sided screenshot before trusting it** — don't reason about the local frame; a backwards verification camera silently audits the wrong side.

**friction-score:** 1

## D136 — Player rig is a procedural SkinnedMesh + bone skeleton, not rigid parented primitives (Session ACJ)
**When**: PM-S — after ~13 sessions (ABP→ACI) of polishing a rig built from rigid Lathe/Box meshes parented at joint Groups, an honest look found the quality ceiling wasn't polish but the FOUNDATION: rigid parts can't deform across a joint, so every elbow/knee/wrist was a hard seam and the hand read as a disconnected block off the wrist. User picked rebuilding on skinning over importing a rigged asset (keeps D107 zero-asset) or staying primitive.

**Why**: A `SkinnedMesh` whose vertices are weighted to a bone chain bends smoothly across joints — the marionette seam is structurally impossible. Generating the geometry + skin weights in code keeps it 100% procedural (no GLB). `THREE.Bone extends Object3D`, so bones can replace the existing pivot Groups 1:1: the per-frame animation (`rig.shoulders[i].rotation.x = …`), foot-IK, held-item attach, and stepCount code all keep working untouched.

**Picked**: NEW `src/player/skinnedLimb.ts` — `buildSkinnedLimb(profile, midY, endY, blendBand, material)` lathes a radius profile into one continuous tube, assigns skinIndex/skinWeight per vertex (linear blend across ±blendBand at the mid joint; root bone above, mid bone below; end bone carries the hand/foot as a rigid child), builds a 3-bone chain, `updateMatrixWorld` BEFORE `new Skeleton(bones)` so boneInverses capture the rest pose, then `mesh.bind()`. AttachedBindMode (default, r184) recomputes bindMatrixInverse from the live world each frame, so the limb follows the moving body correctly. Arms (shoulder→elbow→wrist) + legs (hip→knee→ankle) converted; PlayerRig limb fields retyped `THREE.Group[]`→`THREE.Object3D[]`.

**Footguns**: (1) Legs — `applyFootIK` rewrites `rig.hips[i].position.y` each frame, so the hip BONE must carry the HIP_Y/lateral offset (mesh at body origin); arms instead carry the offset on the mesh (animation only ROTATES the shoulder). (2) `mesh.frustumCulled = false` — a posed limb swings outside its rest-pose bounds and would vanish. (3) Custom materials (`createSkinMaterial` etc.) are built-in `MeshLambertMaterial` subtypes, so skinning chunks auto-inject for a SkinnedMesh — no manual shader work; their `vWorldSkin = position` noise sampling stays rest-anchored (good, no crawl). (4) Torso/neck/head NOT yet skinned (PM-S.3) — the torso↔limb junctions still overlap + use filler (deltoid/hip-cap) rather than a true skin blend.

**Considered alternatives**: import a rigged humanoid (Mixamo/MakeHuman) + drape procedural clothing — fastest to high quality but BREAKS D107; rejected to preserve the zero-asset identity. Stay on rigid primitives + only polish — hits the same ceiling; rejected.

**friction-score:** 3

## D137 — rigStudio framing inverted when PM-B.1 moved the face to +Z (the D135 regression) (Session ACJ)
**When**: PM-B.2 — starting face work, a markered two-sided test showed `rigStudio('head')`/`'front'` was framing the BACK of the head, not the face. Every `'head'`/`'front'` shot from ACI→ACJ had silently audited the wrong side (undetected — the head is front/back-symmetric, the exact trap D135 warns about).

**Why**: D135 added `fwd.negate()` because the face was then on the −Z side. But PM-B.1 (ACI) rebuilt the hood + bandana with the face opening on **+Z** — flipping the face to where `getWorldDirection()` points. So the negate, correct in ACI, became backwards in ACJ. The face side is now `+headZ`; the camera must sit there (NO negate).

**Picked**: removed the `fwd.negate()` in `debugPanel.ts rigStudio`. Verified empirically (reddened the +Z bandana, confirmed it's centered front when framed from +headZ). Lesson reinforced: geometry edits that move the "front" silently invert framing-tool conventions — re-verify the two-sided test after any face/orientation change, don't trust a prior negate.

**friction-score:** 2

## D138 — Playwright `rig-shot` harness is the rig-verification path (preview-MCP wedges) (Session ACJ)
**When**: PM-S/PM-B — the preview-MCP screenshotter wedged twice mid-session (`UnknownVizError`, then a 30s timeout) on the visual-iteration loop. The MEMORY gotcha (hidden-tab throttling + dynamic-import isolation) plus mid-session wedging makes it unreliable for sustained iteration.

**Why**: A self-contained Playwright script (mirroring Highwind's `verify-rigs.ts`) launches its own headless chromium + dev server and never wedges; `page.screenshot()` captures the composited page regardless of `preserveDrawingBuffer`. Reuses the existing `__game.rigStudio` studio (D134/D135).

**Picked**: NEW `scripts/rig-shot.mjs` + `npm run rig-shot`. Boots a dedicated dev server (port 5191, strictPort), waits for `__game.ctx.player.rig`, enters the studio, poses, frames, screenshots to `verification/` (gitignored). Flags: `--pose=idle|apose|walk`, `--angles=front,3q,left,right,back,head`, `--closeup=shoulder|hip|hand|knee|elbow|face` (heading-relative joint close-ups so framing is consistent across spawns). Added `playwright` devDep. The preview-MCP stays usable for quick interactive `ctx` inspection but is no longer the capture path of record.

**friction-score:** 1

## D139 — Poncho cut pending cloth physics (Session ACJ)
**When**: PM-C entry — user judged the procedural folded-cylinder poncho "pretty unrealistic" (a tube with sine-wave grooves + a scalloped hem — no real drape, reads as stiff boxy panels). Removed rather than polished further.

**Why**: A convincing poncho needs actual cloth simulation (drape, sway, fold under gravity) — that's PM-D (Verlet, shared solver with the Cycle-4 rope physics). Iterating the static-geometry fake further is wasted work that PM-D will replace. Removing it also exposed the torso↔limb junctions it was hiding, which is what surfaced the hip/shoulder-filler fixes this session.

**Picked**: deleted the poncho mesh + fold/dye-stripe code + dead `ponchoMat`/`PONCHO_COLOR`. The figure is intentionally "stripped" (undercloth + belt + bandolier + pack + goggles) until PM-C re-dresses it with a proper layered outfit and PM-D adds the simulated cloth. Mark this explicit so a future session doesn't "restore" a fake poncho.

**friction-score:** 2

## D140 — Torso garment HUGS the body lathe (fitted tunic), not a flared cylinder (Session ACK)
**When**: PM-C — re-dressing the torso after the D139 poncho cut. The old poncho failed because it was a flared open cylinder offset from the body (read as stiff boxy panels).

**Why**: A worn garment should follow the body. The tunic is a `LatheGeometry` built from the torso profile offset outward by a cloth thickness (~1.7cm), from a neckline at the trapezius to a hem at the upper hip — so it sits ON the torso like a fitted top, sleeveless (top radius ≈ the arm-attach lateral so the skinned arms emerge just outside + the deltoid caps the gap). Subtle fold displacement + a broken hem + a diagonal wrap-seam band read as worn cloth. Resting shape only — motion drape is PM-D.

**Picked**: tunic lathe parented to `spineBend`. Distinct cloth tone (faded olive) so it reads as a garment over the dark undercloth. **Don't** reach for a flared cylinder again (that's the poncho mistake) — drape comes from PM-D cloth sim, not a wider tube.

**friction-score:** 1

## D141 — Player skin + cloth use opt-in PBR (MeshStandard) + procedural micro-bump + baked occlusion (Session ACK)
**When**: PM-E realism pass — flat `MeshLambertMaterial` (vertex-lit, smooth normals, no specular) made every surface read as smooth plastic; the figure looked "stylized/fake" regardless of geometry.

**Why**: Three levers, all in the existing `createSkinMaterial`/`createFabricMaterial` `onBeforeCompile` shaders, behind an opt-in `pbr` flag (creatures stay cheap Lambert): (1) **MeshStandardMaterial** → per-FRAGMENT lighting + roughness, so a perturbed normal actually shades; (2) **derivative-based micro-bump** (`dFdx/dFdy` of a procedural height = weave/pores/folds) → surfaces catch light with relief, no normal-map texture; (3) **baked occlusion** — darken downward-facing fragments (`smoothstep` on the local normal.y passed as a varying) so undersides/recesses self-shadow EVEN under the game's flat high-ambient daylight. Lever (3) is the key in-game win: solidity without touching the global lighting (a separate mood decision).

**Picked**: `pbr`/`roughness`/`bump` opts added to both material factories; player skin (face/hands), undercloth (limbs/torso clones), and the cloth (tunic/hood/scarf/wraps) opt in. Goggle lenses → plain glossy `MeshStandard` (low roughness + metalness) for a specular glint. **Footgun**: enabling the union return type (`Lambert | Standard`) broke a stale consumer (`viewModelHands.ts`) — deleted it (dead since ACJ).

**Considered alternatives**: vertex-color AO bake — rejected (pose-stale on a skinned figure, marginal at gameplay scale, black-mesh risk if a color attribute is missed); the shader baked-occlusion term is cleaner + universal.

**friction-score:** 2

## D142 — Realism is a believable STYLIZED human; photoreal is the asset fork; in-game lighting is the other lever (Session ACK)
**When**: A `/goal` to make the player "look like a realistic person." Ran a 9-round realism arc (proportions, stance, PBR materials, baked AO, glassy goggles, hands, boots, head profile).

**Why / outcome**: The arc genuinely transformed the figure (cartoon mannequin → believable solid dressed human). But the honest ceiling of a flat-shaded **zero-asset procedural-primitive** rig is *believable stylized*, not photoreal. Two findings worth not re-litigating: (1) **proportions reverted** `HEAD_R` 0.135→0.115 — ACI's 0.135 (chosen to look less "small-headed" in the stylized look) reads as a ~1:6.7 cartoon big-head; ~1:7.7 is the realistic adult ratio. Don't bump it back up for "presence." (2) Under proper key/rim lighting the model reads dramatically more solid than under the game's flat bright-desert ambient — so **the biggest remaining realism lever for actual play is the game's lighting MOOD** (lower ambient / higher sun contrast in `lighting.ts`), which is a whole-game aesthetic decision (surface to the user, don't change unilaterally). True photoreal = the D107 asset fork (also the user's call).

**Picked**: shipped the stylized-realism result; surfaced both user-owned levers rather than overhauling lighting or importing an asset. The realism `/goal` was banked at "believable stylized human."

**friction-score:** 2

## D143 — Overnight breadth runs as parallel file-OWNERSHIP lanes + manifests + a single integrator (Session ACL)
**When**: A long unattended overnight (~2M budget) to ship a broad mixed batch of backlog items in parallel via fanned-out agents. The risk: parallel agents editing the same files → merge hell.

**Why**: Pre-exploration (3 Explore agents) mapped each candidate item to its files + identified the only true SHARED seams (`main.ts` tick order, `save.ts` SAVE_VERSION, `GameContext.ts`, `tuning.ts`, and the `types.ts`/`items.ts` ItemId bottleneck). Assigning each agent a **disjoint set of files** (a "lane") means parallel agents never touch the same file — no worktrees, no merge conflicts. Lanes do NOT edit the shared seams; instead each returns an **integration manifest** `{ tuningConsts, tickInsertions, saveFields, ctxSlots }`. A final **single integrator** agent applies all manifests to the shared seams (one SAVE_VERSION bump, all tick calls, all ctx slots, promotes all PROMOTE-TO-TUNING locals to `tuning.ts`) and runs the authoritative full `tsc`. Worked: 8 lanes + integrator, full tsc PASS, zero merge conflicts.

**Footguns learned**: (1) lanes' per-lane `tsc` shows transient errors from OTHER lanes' mid-edit files (same working tree, no isolation) — instruct lanes to judge tsc on THEIR files only + treat sibling errors as expected; the integrator's full tsc is the real gate. (2) Magic numbers can't go straight into the shared `tuning.ts` (race) — lanes declare tagged `// PROMOTE-TO-TUNING` locals (compiles standalone) + report them; integrator promotes. (3) Features needing a tick/ctx/save can't self-wire — they implement standalone (own a module-local list, export update/spawn fns) + report the wiring; integrator wires. (4) Rule-8: visual features ship tsc+boot-clean but UN-iterated — schedule a visual-triage follow-up; don't claim visual quality.

**Considered alternatives**: `isolation: worktree` per agent — rejected (merging changed worktrees that touch shared seams is the same conflict, just deferred + harder). Sequential single-agent — rejected (no parallelism; wastes the budget).

**friction-score:** 2

## D144 — SAVE_VERSION 13→14: additive shrew roster + storm-wall state, back-compat for v13 (Session ACL)
**When**: ACL added two persistent bits — the desert-shrew roster (`shrews`) and the sweeping-storm wall state (`weatherWall`).

**Why / how**: Per D81 additive discipline, ONE version bump per session (the integrator owns it). Both new fields are OPTIONAL: a v13 load skips the `if (save.shrews)` / `if (save.weatherWall)` guards → boot procgen shrews stand + `ctx.weather.wall` keeps the dormant struct `createWeather` always initializes (so the serialize spread is always safe). Shrews restore by id (deterministic same-seed procgen → boot ids match); the wall restores verbatim (plain data; `intensity` re-derives on the first `updateWeather` tick — no 2nd-pass needed).

**Footgun**: shrew restore assumes deterministic same-seed scatter — if a future change makes shrew spawn non-deterministic or the seed changes between save/load, saved shrews simply won't match and boot procgen stands (no crash, but positions/state don't restore). `weatherWall` is a top-level save field (weather had no prior persisted block); fine + additive.

**friction-score:** 1

## D145 — Sweeping sandstorm is a directional WALL that DERIVES the existing intensity carrier (Session ACL)
**When**: Reworking the uniform storm intensity-ramp into a Dune-style sweeping wall, with a separate in-storm movement-penalty lane + many downstream intensity readers (sky/fog/dust/vignette).

**Why**: Rather than re-plumb every downstream system, the wall (XZ position + travel dir + half-width core + speed) **computes `weather.intensity` (0..1) from the player's signed distance to the wall** — ramp-up approaching, peak inside the core, ramp-down departing. So `weather.intensity` stays the single carrier every existing reader already consumes (lighting fog, sky tint, dust opacity, stormVignette, and the new movement penalty) — zero downstream changes, and the in-storm-penalty lane could be built in parallel against the unchanged intensity contract. The state machine still bounds storm duration; the wall retires past the player.

**Picked**: keep `weather.intensity` as the immutable contract; the wall is an upstream producer of it. **Don't** make downstream systems read wall geometry directly — that would fork the contract and break the parallel-lane independence.

**friction-score:** 2

## D146 — Live AI/feel verification can't run in the headless preview MCP (hidden-tab rAF freeze); use a foreground env (Session ACM)
**When**: ACM tried to visual-triage the ACL features' live BEHAVIOR (shrew flee motion, aim-twist sweep, rifle fire/reload) through the preview MCP `__game.enterGame()` path.

**Why**: The preview MCP tab runs with `document.visibilityState:"hidden"`, so the browser throttles `requestAnimationFrame` to ~zero — the game's rAF tick loop is FROZEN (`ctx.time.elapsed` does not advance; an rAF callback never fired within 30s). Nothing in the per-frame update path runs, so no AI/animation/combat can be exercised, regardless of pause/lock state. There are TWO gates to clear, and only the first is workaround-able: (1) `isPlaying(ctx)` requires `ctx.input.controls.isLocked` — the headless enter path never locks the pointer, so set `ctx.input.controls.isLocked = true` in an eval; (2) the rAF freeze itself is a hard browser-level block with no page-script override. STATIC verification still works (last-rendered frame persists for screenshots; sync evals read state; geometry/wiring inspectable) — that's how the shrew model, rifle viewmodel, and rig plumbing were confirmed this session.

**Picked**: for anything requiring the tick to advance (motion, feel, timed state machines), verify in a TICKING environment — a foreground `npm run dev` browser tab the human drives, or the Playwright `rig-shot` harness (its Chromium page is `visible`, so rAF runs — extend it to equip items / set aim state for these specific checks). Do NOT attempt live-behavior triage through the preview MCP. **Corollary lesson** (the ACM bug): debug hooks that mutate state must call the REAL state-transition fn (e.g. `weather.triggerStorm`→`armWall`), not re-set fields inline — inline duplication silently rots when the real path gains side effects (the stale `triggerStorm` produced 0 intensity post-D145).

**Considered alternatives**: spoofing `document.hidden`/visibility (read-only; throttle is enforced below page script); driving a manual tick from the eval (the main-loop closure isn't exposed; update fns aren't importable in page context). Both dead ends.

**friction-score:** 3

## D147 — Automated/headless game-entry must DETERMINISTICALLY skip PointerLock (the focus heuristic fails for headless Playwright) (Session ACN)
**When**: A user reported their OS cursor trapped in an invisible top-left box during `npm run rig-shot` (Playwright) verification.

**Why**: `rig-shot` enters via the DEV `enterGame()` hook → `handoffToGame()` → `controls.lock()`. That lock was guarded by `isPreviewLike = DEV && (document.hidden || canvas 0×0 || !document.hasFocus())` (ABL/ABN history). But headless Playwright's page reports `visibilityState:"visible"`, a sized canvas, AND `document.hasFocus()===true` — all three signals read "real user", so the guard does NOT fire and PointerLock engages, confining the physical cursor to the harness's offscreen/top-left window. The focus heuristic is fundamentally insufficient for headless automation.

**Picked**: `handoffToGame(opts?: {skipLock?:boolean})`; the `enterGame` DEV hook passes `{skipLock:true}`. Automated entry NEVER acquires PointerLock — verification drives input via evals, so it has zero use for the lock. This is deterministic, not heuristic. Extracted a shared `pointerLockSuppressed(canvas)` helper (input.ts) and also applied it to the start-overlay click as defense-in-depth for stray preview clicks. Real users are unaffected (title buttons lock normally; a real click always has focus). The menus.ts lock sites (mid-game continue/restart/settings) were left unguarded — only reachable by a focused real user, never the harness.

**friction-score:** 2

## D148 — Aim-twist is DYNAMIC (camera turn-rate lead), not a constant 3P shoulder bias (Session ACN)
**When**: ACN visual-triage found the ACL "aim twist-IK" was a CONSTANT `clamp(AIM_TWIST_BIAS)` on `shoulders[1].rotation.y` whenever in 3P — no response to turning/aiming, despite the feature name + comments + ACL changelog describing a dynamic "upper body leads toward the camera" behavior. The ACL author's own comment admitted it: `rig.heading` snaps to the camera heading every frame, so the static `(camHeading − bodyHeading)` delta is ~0 → they fell back to a constant.

**Why**: The real dynamic signal is the camera TURN RATE, not a static heading delta. `aimTwistTarget = clamp(AIM_TWIST_BIAS + (Δheading/dt)·AIM_TWIST_TURN_GAIN, ±CLAMP)`, lerped. The lead shoulder winds INTO the turn and relaxes to a small resting bias when steady. Added `rig._aimPrevHeading` (per-frame heading diff), `AIM_TWIST_TURN_GAIN`=0.10, lowered `AIM_TWIST_BIAS` 0.35→0.18 (the static 0.35 read too square at rest). User chose "make it dynamic" over keep-static-and-document. Verified via the harness: steady 0.167 → turn+ 0.207 → turn− 0.052 (responds to direction + rate). **Peak magnitude in the harness underestimates real continuous-turn play** (Node-side bursty sampling), so the gain/bias likely want a foreground feel-tune (ACO).

**friction-score:** 1

## D149 — Live-behavior verification harness: drive the TICKING game from Node, not in-page rAF; pre-clear LMB-gating overlays (Session ACN)
**When**: Building the `rig-shot --scenario` mode (shrew-flee / aim-twist / rifle) to exercise per-frame BEHAVIOR (the thing D146 says the preview MCP can't do), using the Playwright harness whose page DOES tick.

**Why**: Two non-obvious footguns, each cost a debug cycle:
1. **In-page `requestAnimationFrame` is throttled in the Playwright page** — its `visibilityState` is `hidden`, so rAF runs at ~0. The GAME keeps ticking because `loop.ts` falls back to `setTimeout(16)` when `document.hidden` (DEV), but a verification eval that `await`s in-page rAF in a loop HANGS → page-close/timeout. **Drive + sample from NODE** (`page.waitForTimeout` between short evals), letting the game's own setTimeout loop tick. For tick-only numeric sampling (no pixels needed), **shrink the canvas to ~48–64px** so each software-WebGL frame is near-instant (full 900×1100 renders at ~10s/frame).
2. **Headless `enterGame` leaves the first-boot tutorial controls panel OPEN** (`!seenIntro`). `updateWieldAction.overlayOpen()` includes `isControlsPanelOpen()`, so ALL LMB actions (attack/place) are suppressed → the rifle-fire scenario silently did nothing while RELOAD (a separate path with no overlay gate) worked — that asymmetry is what exposed it. Fix: `page.addInitScript` to pre-set `localStorage['dustfall.tutorial.v1'] = {seenIntro:true}` before page load so the panel never opens.

**Picked**: Node-driven scenario loops + canvas-shrink for numeric sampling + pre-dismiss LMB-gating overlays. This is the reusable recipe for live-feel verification, complementing D146 (static-only via the preview MCP). The rifle "didn't fire" was NOT a combat bug — it was the overlay gate; once dismissed, fire decrements ammo correctly.

**friction-score:** 2

## D150 — The headless harness CAN'T verify kinematic-body-velocity-dependent behavior (gait/footsteps/on-foot-speed); those need a foreground repro (Session ACO)
**When**: ACO tried to reproduce the user's speeder-dismount-footprint bug + random-speed-spike via the rig-shot `--scenario` harness (the D149 recipe that worked for AI/weapon state).

**Why**: The player body is `KinematicPositionBased`. On-foot movement is `setNextKinematicTranslation` (position-based, bounded by `speed*dt` with dt clamped to 0.1 in loop.ts), and the rig's gait reads `rig.speedMag` from `body.linvel()` — which Rapier derives from the per-frame kinematic position delta. In the headless harness the page is hidden so the game ticks via `setTimeout(16)` at an IRREGULAR/throttled rate; the kinematic `linvel` then reads ~0 even while the body is visibly translating (ACO `footprints` scenario: body moved 1.38m but `speedMag=0`, `state=idle`, `stepCount` Δ0 — even PRE-mount). So the gait→stepCount→footprint path can't be exercised at all headlessly, and the speed feel can't be observed. This is a SUPERSET limit beyond D146/D149: even the ticking harness (great for AI state machines like shrew-flee + weapon ammo state, which are position/event-based) fails for anything reading kinematic VELOCITY.

**Picked**: gait/footstep/on-foot-speed/feel bugs are FOREGROUND-only (`npm run dev`, real 60fps, real kinematic linvel). Don't try to repro or "fix-and-claim" them through the harness — `speedMag=0` there is a harness artifact, not the bug. Static analysis still applies (the footstep block resyncs `_lastSeenStepCount` each frame + dt is clamped, so neither footprints nor speed has an obvious code fault) — but confirming the actual misbehavior + a fix needs real-rate observation. The night-dust gate shipped this session was verifiable headlessly precisely because it's RENDER-state (opacity vs sunHeight), not velocity.

**Considered alternatives**: driving the body via direct `setTranslation` per Node step (bypasses the kinematic linvel computation entirely → still 0); forcing `rig.speedMag` manually (would fake the gait, not verify the real path). Both defeat the purpose.

**friction-score:** 2

## D151 — Rig gait bookkeeping (speedMag/state/stepCount) must run in BOTH camera modes, not behind the 3P visibility gate (Session ACT)
**When**: Fixing the user's playtest report that footprints (and, as it turned out, footstep audio) only appeared in third person.

**Why**: `updatePlayerRig` opened with a visibility gate — `rig.group.visible = ctx.flags.thirdPerson; if (!rig.group.visible) return;` — and EVERYTHING after it (including `rig.speedMag`, the state classification, and the `rig.stepCount` advancement) was skipped in first person. But `controller.ts` drives BOTH the footstep audio AND the footprint decals off `rig.stepCount` (ACE Tier 4A made stepCount the single cadence source). So in FP the counter never advanced → no footsteps, no prints; it only worked in 3P where the rig is visible. The gait bookkeeping is cheap state math (a linvel read + a few comparisons + an absolute-time phase) and is NOT visual — only the transform work (group position/heading, bone rotations, foot-IK, aim-twist) actually needs the rig to be visible.

**Picked**: Hoist the bookkeeping (speedMag, state, gait-phase, stepCount) ABOVE the visibility gate so it runs every frame in both modes; keep ONLY the visual transform work gated. The existing `delta < 5` burst-clamp + the controller's `_lastSeenStepCount` resync still prevent a catch-up spike on FP↔3P toggle. General rule: anything OTHER systems read off the rig (cadence, speed, state) must update regardless of whether the rig mesh is drawn; the gate is a render optimization, not a logic switch.

**friction-score:** 2

## D152 — The interaction raycast originates from the PLAYER EYE in 3P, not the camera (Session ACT)
**When**: Fixing the user's report that `[E]` interact hints never appear in third person.

**Why**: `interaction.ts` cast its hover ray from `cam.position` along `cam.getWorldDirection()` with `_ray.far = RAYCAST_DISTANCE` (2.5m). In 3P the camera sits `_3P_BACK_DIST` (~1.8m) behind the player, so the effective reach FROM THE PLAYER was only ~0.7m — you'd have to clip into a target for a prompt to register, i.e. hints essentially never showed. Combat doesn't exhibit this because weapon ranges are several meters and absorb the 1.8m offset; the 2.5m interaction reach doesn't. The reticle in 3P is still screen-center = `camFwd`, so the DIRECTION is right; only the ORIGIN was wrong.

**Picked**: In 3P, originate the ray from the player's eye (`body.translation() + eyeOffset`) along `camFwd`; in FP keep `cam.position` (which already IS the eye). Reach is then identical in both modes. Considered reconstructing the exact 3P shoulder-anchor (cf. controller's `_shoulderAnchor`) but that duplicates the camera constants for sub-target-radius precision gain — the player-eye approximation is collinear-enough at 2.5m and low-coupling. NOTE: combat.ts still casts from `cam.position`; if a future 3P melee/range feels short-reached, apply the same player-eye origin there.

**friction-score:** 2

## D153 — Every VIEWMODEL/held item is a moving mesh → all its procedural materials must be localSpace; routed through wrappers (extends D109) (Session ACT)
**When**: The D109 texture-swim sweep, tracing the user's "texture shifts when the speeder moves" report to its general cause across all moving entities.

**Why**: D109 established that procedural materials sample noise in WORLD space by default (free per-instance weathering on static objects) and that MOVING entities must pass `localSpace:true` or the pattern crawls. ACT found the rule under-applied: (a) `woodGrainMaterial`/`boneMaterial`/`glassMaterial` had NO `localSpace` option at all (always world-space) — yet they're used on held items; (b) every item mesh is rendered as a VIEWMODEL (added to the main scene, tracking the camera for the FP copy + the rig hand bone for the 3P copy — see `viewModel.ts`), so EVERY held item moves through world space continuously and was swimming; (c) `fabricMaterial` only did local sampling as a side-effect of `disableShimmer`, coupling two concerns so a moving fabric couldn't keep wind shimmer without swimming.

**Picked**: (1) Added a `localSpace` option to woodGrain/bone/glass (glass also flips its dust-layer normal to object space). (2) Decoupled `fabricMaterial.localSpace` from `disableShimmer` (`useLocalCoords = disableShimmer || localSpace`; shimmer gated only by `disableShimmer`). (3) In `items.ts`, routed ALL viewmodel material calls through `vmMetal/vmWood/vmBone/vmGlass` wrappers that force `localSpace:true` — so no item call site can forget it (the structural fix, vs. 25+ brittle per-call edits). Static world callers (locker, wreck skeletons, cockpit canopy) keep world-space intentionally. Audit confirmed sled/creature-skin/rig-skin/rig-fabric were already safe; raiders use plain flat materials. RULE: if a mesh is camera- or bone-anchored (any viewmodel/held item), its procedural materials are localSpace by default — prefer a wrapper over per-call flags.

**friction-score:** 2

## D154 — Derivative-based (dFdx/dFdy) procedural micro-bump is NOT safe on a moving/animating mesh; the rig uses flat Lambert (Session ACU)
**When**: The user reported the player model looked "glitchy when it moves." The ACK PM-E realism pass (D141) had switched the rig's skin + cloth to `MeshStandardMaterial` (`pbr:true`) with a derivative-based normal bump — `normal = normalize(normal + vec3(dFdx(h), dFdy(h), 0) * bump)` where `h` is a world/local-sampled height.

**Why**: `dFdx/dFdy` are SCREEN-SPACE derivatives — they measure how the sampled height changes between adjacent fragments on screen. On a moving/animating mesh the screen-space footprint of each fragment changes frame-to-frame, so the perturbed normal (and thus the per-fragment lighting) shimmers/sparkles as the model translates or the limbs swing. It's stable on a static mesh and was fine when the rig was inspected standing still in the harness, which is why it slipped through. Removing PBR was tried first as a hypothesis (it didn't fully fix the user's flicker — that turned out to be a SEPARATE shadow issue, D155 — but the PBR shimmer was real and worth removing regardless).

**Picked**: Reverted `pbr` (+ its `roughness`/`bump`) on all rig skin (3 mats) + cloth (4 mats) → back to `MeshLambertMaterial` (vertex-lit, smooth interpolated normal, no derivative term). The procedural surface COLOR layers (pigment/cells/veins/sheen/grain for skin; weave/stain/grain for cloth) are NOT pbr-gated, so the textured look survives — only the relief/bump lighting is gone. The goggle lens (a small rigid `MeshStandard` disc) was left (doesn't animate). RULE: don't use screen-space-derivative normal perturbation on anything that moves/skins; bake relief into geometry or a real tangent-space normal map (or accept flat shading) for moving meshes.

**friction-score:** 2

## D155 — A player-following shadow camera needs a shadow-map regen whenever the player MOVES, not just a fixed throttle (Session ACU)
**When**: Chasing the "model flickers when I move" report after the PBR revert (D154) didn't fully fix it. The flicker was the rig's SELF-SHADOW swimming, only while moving.

**Why**: `lighting.ts` moves the directional light's shadow camera to follow the player every frame (so shadows stay centered on the player). But for perf (ABL) `renderer.shadowMap.autoUpdate=false` and `needsUpdate` was set only every `SHADOW_UPDATE_EVERY_N_FRAMES` (~10Hz). Three.js recomputes `light.shadow.matrix` (world→shadow-map projection) ONLY on the frames the shadow map renders. So between regens the player translates to a new world position while their fragments are still projected by the STALE matrix into the stale depth map → the self-shadow lands at the wrong texels, drifting a little each frame, then snapping back on the next regen = flicker. Static scenery doesn't move so it never swam. The ABL throttle comment reasoned about the sun's slow ROTATION but missed that the camera also TRANSLATES with the player.

**Picked**: Force `shadowMap.needsUpdate = true` on any frame the player actually moved (track last position; >1e-3 delta), and keep the ~10Hz throttle only when idle. Moving → matrix never goes stale (no swim); idle → throttled (ABL's perf win preserved, imperceptible when nothing moves). Considered: bump the throttle to every-frame (loses the perf win for no reason when idle); decouple the shadow cam from per-frame follow (would lag shadows behind the player). RULE: if a shadow (or any reprojection) camera tracks a moving target, the map + its matrix must refresh on motion, not on a target-agnostic timer.

**friction-score:** 2

## D156 — Sled-vs-POI collision via a shapecast filtered to FIXED, non-heightfield colliders (Session ACU)
**When**: #42 — the KinematicPositionBased sled had terrain collision but passed straight through POI/wreck static colliders (could be dragged or slid through structures).

**Why**: A kinematic body driven by `setNextKinematicTranslation` doesn't get solid collision response against other statics for free. Needed an explicit pre-move check. There's no collision-group tagging in the project and the terrain (also FIXED) can't be excluded by body-type. Rapier's `world.castShape(...filterPredicate)` accepts a per-collider predicate, and `collider.shapeType()` distinguishes the terrain heightfield (`ShapeType.HeightField`) from POI cuboids/trimeshes — so "block only FIXED, non-heightfield colliders" cleanly selects POIs/wrecks/rocks while letting the sled ride dunes + pass loose dynamic objects.

**Picked**: A `clampSledMoveAgainstPOIs` helper shapecasts the sled's footprint cuboid (taller cast-Y than the flat 2cm body so it reliably meets hull walls) from current→target each frame, clamps the move short of any hit (with a skin gap), and zeros the slide velocity into the wall. Applied at BOTH commit sites (slope-slide + the rope-tow constraint snap). `stopAtPenetration=false` so an already-overlapping start doesn't freeze the sled. Gated behind `Tuning.SLED_POI_COLLISION` (default on) because the sled slide/tow is a heavily-iterated, foreground-only-verifiable system — instant kill-switch if it regresses (e.g. stick-on-dunes). Foreground-confirm owed.

**friction-score:** 3

## D157 — Towed-rope leaves inventory only when BOTH ends are anchored; all tether changes route through applyTether (Session ACU)
**When**: #50 — the rope "stayed in the hotbar via meta.attachedSledId" while a sled was tied. The user wanted it to behave like a real deployed line (leave the bag), but ALSO be able to carry it to a second anchor (Pebble/stake) — i.e. it should leave only once BOTH ends are tied.

**Why**: A first cut that removed the rope on ANY attach broke the carry-to-second-anchor flow (the gates that tie the 2nd end require a rope in hand) and tripped the old `ropeIsStillHeld` auto-detach guard (which untied the sled the moment no slot held the rope). The correct model keys on "deployed" = tether is a NON-player anchor: while `none`/`player` the player still holds the free end, so the rope stays a carried hotbar item; the moment the other end anchors (speeder/companion/stake/static-pos) both ends are fixed → the rope leaves; freeing an end returns it.

**Picked**: Centralize ALL `sled.tether` changes through `applyTether(ctx, sled, endpoint)` — it removes one rope on entering a deployed tether and adds one back on leaving (drops at feet if the bag is full). attach/detach/stake/companion/floor + speeder mount/dismount all route through it. Retired the old `attachedSledId` stamping + `ropeIsStillHeld` guard. Replaced the latter with a scoped DROP-TO-RELEASE: a player-tethered sled with zero rope in inventory (player dropped it with G) auto-detaches. Removed the LMB-on-ground floor-drop (staking replaces it). NO save bump — a tethered sled already persists and the rope's absence is just the normal inventory save; old v14 saves with a tied sled may carry one bonus rope (benign, no data loss). RULE: model "deployed" as a property of the anchor state, not of item presence, and funnel every state transition through one helper so the item can't desync. Foreground-confirm owed.

**friction-score:** 3

## D158 — Gated companion acquisition (cave egg): persist only an `acquired` flag; derive the egg's existence from it (Session ACV)
**When**: Cycle 7 — making the companion (Pebble) acquired by hatching an egg in the rock-biome cave instead of spawning at the player's side on a new game.

**Why**: The companion was a singleton spawned unconditionally at boot (`spawnCompanionAt` in main.ts), with `loadGameState` patching it (despawn if the pod was in inventory, restore if a `companion` field existed) — the project's "boot places everything deterministically; load patches over it" pattern. Gating acquisition behind a world egg needs the save to record "has the player got the companion yet?" — a classic singleton-under-existing-save migration (`known-hard-patterns.md` → singleton→list-promotion sibling). The key simplification: the EGG does NOT need its own save field. The egg is a deterministic POI prop (built in `rockyEntrance.ts`); it exists in the world **iff `!companionAcquired`**, re-derived at boot exactly like the wreck/speeder/skeleton. So only ONE additive boolean persists.

**Picked**: `flags.companionAcquired` (default **false** on a NEW game → the egg is the path; **legacy/pre-feature saves default TRUE on load** so existing players keep their companion — additive, NO SAVE_VERSION bump, D81). Boot STILL spawns the companion + builds the egg (so a Continue can patch the companion in place); the reconcile lives in `handoffToGame` (the common entry for new-game/continue/dev, AFTER `loadGameState` ran): `acquired → remove the egg; not acquired → despawnCompanion`. Added `despawnCompanion(ctx)` (remove without granting a pod — distinct from `packUpCompanion`). Egg interaction via a new `'eggs'` registry + `'hatch'` InteractType; hatch = `spawnCompanionAt(egg.pos)` + set acquired + remove egg. DEV MODE sets acquired=true (keeps the companion as a test affordance). **Owed a foreground/`__game` confirm** of the boot spawn-then-despawn timing + the full save round-trip (traced correct across new-game / legacy-continue / not-yet-hatched / pod-in-bag, but not yet run live). The egg's VISUAL (placeholder emissive ovoid) + chamber lighting are deferred to ACW.

**friction-score:** 3

## D159 — A 3P rig "ridden" on a vehicle must be repositioned to the seat, not driven off the parked player body (Session ACV)
**When**: #148 — the 3P rig was "broken" (invisible/at the world origin) while mounted on the speeder.

**Why**: On mount, `speeder.ts` parks the player capsule far below the world (`setNextKinematicTranslation` y=-2000) so it can't collide with the bike. `updatePlayerRig` positions the rig AT the player body each frame — so while mounted the rig dropped to (0, terrain(0,0), 0)/underground, leaving the player riding an empty bike. The camera was fine (speeder.ts drives it from the rider-seat offset); only the rig was mis-placed.

**Picked**: In `updatePlayerRig`, when `ctx.speeder.mounted`, branch BEFORE the normal body-follow: position the rig at the bike's rider seat (bike body translation + a yaw-rotated local offset, mirroring the rider-seat math in speeder.ts), face `bikeYaw + π`, and apply a seated pose (thighs forward astride, knees bent down, arms to the grips). Seat offset constants `SPEEDER_RIG_SEAT_Y/Z` are foreground-tunable (the rig origin is the feet, so SEAT_Y is offset down from the camera seat). The dedicated speeder 3P camera (orbit/chase) stays deferred — the existing follow-the-rider-seat camera is adequate. General rule: a parked-body vehicle (capsule hidden so it doesn't fight the vehicle collider) must drive the visible rig from the VEHICLE transform, not the parked body.

**friction-score:** 1

## D160 — 3P held items need a per-item hand-attach transform + a separate 3P use-anim hook (the FP viewmodel is hidden in 3P) (Session ACW)
**When**: ACW Phase A/D — seating items in the rig's right hand + animating use-actions in third person.

**Why**: The dual-mesh system (ABP) parents a second copy of `makeViewModel()` to the rig's `rightHandAttach`, but those meshes are authored for the FP camera origin — their local origin is wherever the builder placed it (often the item's MIDDLE, e.g. the machete's guard), so in 3P the rig grips the item at its centre with the handle floating above the fist. Separately, `playUseAnim` only animates the FP `vm.itemRoot` (the viewmodel item), which is HIDDEN in 3P — so a swing/drink/fire showed no arm motion at all with the camera behind the body.

**Picked**: Two additive `ItemDef` fields. (1) `handAttachTransform: {pos,rot}` — applied to the 3P hand-attach mesh ONLY in `viewModel.swapEquippedMesh` AFTER `thirdPersonScale`; authored per held item (machete/scrap_bar/pipe_staff lift +Y ~0.11–0.12 so the grip seats in the fist; canteen + the Z-oriented guns/rifle need none). (2) `playUseAnim3P(rig, t)` — drives the rig's right-arm BONES, called LAST in `updatePlayerRig` (after the per-state gait + aim-twist) when `vm.anim.active && thirdPerson`, with `t` from the vm anim clock; author ABSOLUTE poses (the gait re-poses next frame, no reset needed). Both default to no-op (legacy behavior). Verified the grip per-item via a paused `held-item` screenshot scenario (arm posed out to clear the torso). The exhaustive per-item pass (guns/rifle/consumables grips + their use-anims) is foreground-owed.

**friction-score:** 2

## D161 — Reusable creature-gait helper + pooled particle-trail; particle `size` is a WORLD diameter, not pixels (Session ACW)
**When**: ACW Phase A — factoring the per-creature gait math + a shared dust/puff particle system out of footprintPuffs.

**Why**: Lizard/shrew/companion all want the same sin-phase leg gait the player rig uses, and the speeder dust + shrew burrow want the footprintPuffs pool pattern but with soft per-particle fade. Copy-pasting either would drift.

**Picked**: `enemies/creatureGait.ts` (`gaitPhase(elapsed,freq)` + `legPose(phase,offset,swingAmp,liftAmp,bendAmp)` returning swing/lift/bend; `sin` swing, `max(0,cos)` lift peaking in the forward-recovery half-stride — mirrors the player rig). `world/particleTrail.ts` (per-instance pooled `THREE.Points` + a tiny ShaderMaterial giving per-particle alpha+size fade over life — soft round motes that dissolve, vs footprintPuffs' hard cull). **GOTCHA promoted to the EmitSpec doc**: the shader renders `gl_PointSize = size * uScale(300) / cameraDist`, so the `size` param is ≈ world-space diameter — the right range is ~0.4–1.2; values in the tens (mistaking it for pixels) render screen-filling blobs. Cost both the speeder dust + shrew puff an iteration before the convention was pinned.

**friction-score:** 1

## D162 — Shrew burrow = an FSM state that sinks the mesh below the terrain plane (occlusion sells "underground"); trigger radius < flee distance (Session ACW)
**When**: ACW Phase B — the "shrew dives into the sand when you get close" behavior.

**Why**: The terrain is a continuous heightfield with no holes, so there's no literal burrow to dig into. But a creature sunk below the surface plane is OCCLUDED by the terrain mesh from every angle — which IS the read "it went underground." A ~9cm shrew vanishes once it sinks past ~its own height; SHREW_BURROW_DEPTH (0.34m) just guarantees it's well-buried.

**Picked**: New `'burrow'` state in the shrew FSM, pre-empting `'flee'` (checked first; flee's guard excludes burrow). `SHREW_BURROW_RADIUS` (2.6m) < `SHREW_SPOT_DISTANCE` (7m) → the shrew BOLTS at 7m, then if the player closes to 2.6m it DIVES instead of continuing to run (escalation). `burrowT` (0..1, transient/not-persisted) eases toward 1 while the player is near (×1.6 hysteresis to stay buried), back to 0 when they leave; mesh Y = surface − burrowT·DEPTH, nose-down tilt via `rotation.z`, `visible=false` past 0.85, kinematic body sunk too (so a melee swing can't hit a buried invisible collider), a pooled sand puff bursts when crossing the surface threshold (entry/exit). Re-emerge → back to `idle`. The visible dive happens in burrowT 0–0.25; verified via static sink screenshots. Dive/puff TIMING is foreground-feel (D150).

**friction-score:** 1

## D163 — Storm wind on loose bodies uses WORLD intensity (not perceivedIntensity); kinematic bodies get a slide-velocity nudge, not a force (Session ACW)
**When**: ACW Phase E (#146) — making a sandstorm physically shove dropped pickups / the parked speeder / a slack sled.

**Why**: `perceivedIntensity` is shelter-dampened (a player-FELT quantity — drives fog/vignette/audio/thirst). But loose world objects are blown by the actual wind regardless of where the PLAYER is hiding, so the physical push must read `weather.intensity` (world truth) — same reasoning the companion's storm-huddle uses world intensity. (In-storm SENSORY effects — camera sway, audio muffle — correctly use perceivedIntensity, since those ARE player-felt.)

**Picked**: `stormWindAccel(weather)` helper in weather.ts returns a shared-scratch `{x,z}` = wall travel dir × world intensity × `STORM_WIND_PUSH_ACCEL`, zero when the wall is inactive/intensity≈0. Dynamic dropped-pickup bodies get a per-frame `applyImpulse(accel·mass·dt)`; the unmounted speeder adds `accel·dt` to its velocity (its own damping bleeds it off when the gust eases); the KINEMATIC sled (can't take a force) folds `accel·dt` into its managed `_slideVx/_slideVz` scalars (a towed sled is perturbed but the rope-snap correction pulls it back). `updatePickups` gained a `dt` param. All foreground feel-tune.

**friction-score:** 1

## D164 — Headless creature/item screenshots use the PAUSED free-camera path; the live FP/3P camera + KCC body-teleport fights placement (Session ACW)
**When**: ACW Phase B/C/D — building rig-shot scenarios to verify small-creature gaits, in-hand items, and speeder FX.

**Why**: Live scenarios (`enterLive`) keep the sim ticking, so `syncCameraToBody` re-pins the camera to the player body every frame (FP: body+eye; 3P: a spring-arm BEHIND the body), and teleporting the dynamic KCC player body to a vantage gets stomped by the controller's own movement integration. Net: a `cam.position.set` + `lookAt` in a live scenario doesn't stick — the lizard ended up a distant dot / the player rig framed instead of the creature. (The non-FP-allowlist scenarios silently ran in 3P, compounding it.)

**Picked**: For static reads, set `ctx.flags.paused = true` — the main loop early-returns before any camera sync (the pause-gates-everything rule), so a free `cam.position`/`lookAt` STICKS and the manually-posed mesh holds. Pattern: enter live briefly (so terrain + entities exist + a live tick populates dust/anim if needed), then pause, pose the target (manual gait phase / burrowT / leg-lift), free-frame the camera close, screenshot. For FX that must accumulate over frames (speeder dust trail), drive a few LIVE ticks first (re-injecting velocity so damping doesn't bleed it), THEN pause to freeze the cloud mid-air + hold the glow. Live tracking strips remain useful only when the creature recedes ALONG the view axis from the player-as-camera (the pre-existing shrew-flee). Genuinely live-only feel (in-motion gait, wind, sway) stays foreground (D150).

**friction-score:** 2
