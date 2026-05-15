# Decisions

Numbered key calls — why + when. Don't re-explain in chat — link here.

When adding: append at the bottom with the next D-number. Don't renumber.

---

## D1 — Browser-first runtime (Three.js + TS + Vite)
**When**: Session A.
**Why**: Zero-install for the player, hot iterate in the browser, ship a
URL. Procedural Web Audio + GLTF + Rapier all run cleanly in the same page.
Migrating to Godot / Unity / Bevy gives no FPS headroom that hardware-
accelerated Chrome doesn't already have (see `architecture.md` perf notes).

## D2 — Rapier for physics, not custom
**When**: Session A.
**Why**: Kinematic character controller + heightfield collider + raycasts
out of the box. Building these from scratch would be a multi-week detour.
Trade-off: WASM bundle is ~500 KB.

## D3 — Procedural Web Audio, no sample files
**When**: Session C.
**Why**: Keeps the bundle tiny (no audio assets). Every sfx is a function
in `src/audio/audio.ts` that synthesises via filtered noise + oscillator
nodes. Easy to A/B feel by tweaking envelope numbers.

## D4 — Magic numbers go in `tuning.ts` only
**When**: Session A (rule), reinforced every session.
**Why**: Game-feel iteration is "tweak number → reload → feel". Numbers
sprinkled across files make this exhausting. One file = one place to
search.

## D5 — `GameContext` is the spine, not arg-passing
**When**: Session A.
**Why**: A 3D survival game touches every subsystem from every other.
Threading params through call chains becomes spaghetti. One `ctx` object
on every `init` and `update`.

## D6 — Rejected Kenney asset packs ("too cartoony")
**When**: Session P.
**Why**: The user wants Dune / Mad Max tone. Kenney's low-poly survival
pack reads as gamey, not bleak. Drove the **D7 barren-desert pivot**.

## D7 — Barren-desert tonal pivot
**When**: Session P.
**Why**: Empty world + distant POIs reads more like Dune than scattered
clutter. Removed 134 rocks/trunks + truck wreck + standalone loot crates.
Replaced with ridged dunes + biomes + perimeter mountains + hand-placed
hero landmarks.

## D8 — Sci-fi scavenger pivot
**When**: Session S.
**Why**: After P shipped, the user picked a Jakku scavenger fantasy as the
populated layer on the barren desert. Half-buried hulls become the
recognisable silhouettes; replaced ribcage/obelisk/tower with crashed-ship
wrecks as everyday landmarks.

## D9 — Salvageables are finite (drives exploration economy)
**When**: Session T.
**Why**: Wrecks as pure scenery were a dead end. Giving each wreck a
`salvageRemaining` counter (2-3 hero, 4-6 massive) ties art to mechanics:
walking to a wreck rewards you, but only finitely. Combined with wells
(thirst) this gives the survival loop its full economy.

## D10 — Single-slot save, no death autosave
**When**: Session M.
**Why**: One `localStorage['dustfall.save.v1']` slot keeps the UI simple
(single Continue button on the start overlay). **No autosave on death** —
dying means you load your last save or start a new run. Matches the
Long Dark / DayZ contract. Sleep is the natural autosave point.

## D11 — Confirm on New-Game-while-save-exists
**When**: Session M (post-ship adjustment).
**Why**: First version of M silently kept the old save until first
overwrite. User identified the footgun: click New Game by accident,
sleep once, old run is gone. Inline `[yes, new game] / [cancel]` prompt
fires only when `hasSave()`.

## D12 — GOD_MODE stays on through Session M
**When**: Sessions A–M.
**Why**: Iterating game feel requires not dying constantly. `Tuning.GOD_MODE`
in `tuning.ts` floors stats in `die()` so the player survives. Will flip
off when balance tuning starts (post-O / win-condition session).

## D13 — Sandbox pivot: raiders deprioritized, win condition dropped
**When**: Session U (mid-session direction shift).
**Why**: User wants Dustfall to feel like an open-world sandbox survival
game — "we're the only one's surviving in this desolate world." The
planned O session (raider variants + warlord camp + satellite-phone
endgame) was scoped to add a win condition; that's now off the table.
The single spawned raider at boot was removed too. Raider AI + rigged-
animation code in `src/enemies/raider.ts` STAYS — we may revisit (raider
variants moved to the Later bucket). `Tuning.GOD_MODE` stays on
indefinitely; no balance pass on the horizon.

## D14 — Music disabled as placeholder; full audio overhaul pending
**When**: Session V (built it), Session W bugfix (disabled it).
**Why**: V built a 3-voice procedural music system (drone pad + pentatonic
plucks + storm sub-bass via feedback-delay reverb) and a tuned wind layer.
User feedback was clear: "not the vibe… we'll need to do an overhaul of the
audio later so these can just be placeholder for now." Both wind and music
are commented out in `audio/soundscape.ts` with restore points. The next
session (X) is the overhaul. Tonally we likely need sample-based stems
rather than pure synthesis — procedural music is hard to make feel like a
soundtrack.

## D15 — Opening wreck is intentionally non-salvageable
**When**: Session W.
**Why**: The wreck in the opening scene contains the dead survivor + their
journal. It's a story prop, not a loop entry. Players spend Day 1 there;
giving them scrap reward for stripping it down would conflict with the
"this was someone's last shelter" tone. So it's the ONE wreck in the world
not registered in the salvageables registry. All other wrecks (registered
via `salvage.ts` in T) still salvage normally. If we later want it
salvageable, just register it in `openingScene.ts`.

## D16 — Fog: near and far BOTH move with storm intensity
**When**: Session W bugfix.
**Why**: First storm-fog pass moved only `fog.far` down (to 22 m at peak)
while leaving `Tuning.FOG_NEAR` at 25. Three.js linear fog math
`(dist - near) / (far - near)` inverts when `far < near` — every visible
surface clamped to full fog color, painting the wreck and surroundings
red-brown even at 12 m distance. Fix: at peak storm, `fog.near = 15`,
`fog.far = 30` — math stays sane, fog still feels claustrophobic. Going
forward, always pair fog far + near changes; never let one cross the other.

## D17 — CC0 sample stems over procedural for ambient + music (Session X)
**When**: Session X.
**Why**: D3 ("procedural Web Audio, no sample files") still holds for SFX
— short envelope-shaped sounds work great synthesized. But Session V proved
the same approach fails for long-form ambient + music: a 3-voice procedural
score (drone pad + pentatonic plucks + storm sub) reads as "synthesizer
demo," not "lonely-desert soundtrack." Session X carves out an exception:
sample-based stems (.ogg, CC0) for the 3 wind layers, 2 day/night beds,
and 2 music variants. SFX stay procedural. Stems are crossfaded by
weather.intensity + sunHeight at runtime — no timeline, no DAW, no stem
sync. The loader tolerates missing files so the architecture can ship
ahead of the asset pack (same pattern as Session N rigged-raider GLB).

## D18 — Continuous quiet music over silent-calm baseline (Session X)
**When**: Session X.
**Why**: V/W default was "silence in calm weather, music only during
storms." User considered keeping it but chose to play `music-calm.ogg`
continuously at ~0.20 gain instead, crossfading to a `music-tense.ogg`
variant above `weather.intensity > 0.4`. Reason: the silence vibe was
acceptable but felt like a fallback, not a deliberate choice. A very
quiet always-on pad sets the lonely-desert tone without competing with
SFX. Risk recorded in archived plan: if 30s of calm listening grates,
drop `MUSIC_CALM_TARGET` to 0.10 or switch to a sparse fade-in/out
cycle.

## D19 — Footprint decals via InstancedMesh + onBeforeCompile, not DecalGeometry or RenderTarget (Session Y)
**When**: Session Y.
**Why**: Three alternatives were on the table:
  1. `DecalGeometry` — projects per-decal geometry onto the terrain. Heavy:
     each decal allocates a fresh BufferGeometry triangulated against the
     terrain mesh. 200+ player + 240 lizard decals = thousands of cloned
     geometries per minute of walking.
  2. RenderTarget texture splat — paint stamps into an offscreen texture
     that the terrain shader samples. Fast at runtime but needs a custom
     terrain shader (currently a plain `MeshLambertMaterial` with
     vertex-color biome blending) — would force a shader rewrite.
  3. InstancedMesh + per-instance opacity via `onBeforeCompile` shader
     patch — picked. One draw call per kind, pool size bounded (200+240),
     round-robin recycle. Per-instance opacity via a custom
     `instanceOpacity` attribute injected into `MeshBasicMaterial`'s
     vertex/fragment shaders. Geometry is flat planes lying on the
     terrain with `polygonOffset` to avoid z-fight. Doesn't conform to
     terrain curvature in micro-detail (decal is flat, dune is curved)
     but the small per-decal footprint (~20-35cm) hides this.
The choice favors a known scaling cap (pool size) + minimal renderer
surface area over visually-perfect terrain-conforming decals. Revisit if
we need much larger or more-detailed decals later.

## D20 — No footprints on rocky biome (Session Y)
**When**: Session Y.
**Why**: Real desert sand prints don't appear on rock. Both the player
hook (`controller.ts`) and lizard hook (`lizard.ts`) check
`ctx.biomes.biomeAt(x, z) === 'rocky'` and skip the decal spawn while
the footstep AUDIO still plays. Salt and dune biomes both stamp (salt's
crusted-mud reads like a flat impression — close enough for v1).
Trade-off: walking from dune onto rock and back leaves a visible gap
in the trail. Acceptable — reads as "the terrain doesn't take the
print" rather than a bug.

## D21 — Wells hard-confined to salt biome, no quota fallback (Session Z)
**When**: Session Z.
**Why**: Earlier, `spawnWaterSources` placed 5 wells anywhere with a
"≥2 must be salt" quota — the other 3 could land on dunes or rocky
outcrops where a dug well makes no sense (no aquifer below). Z tightens
this to a HARD requirement: wells MUST be in salt (dried lakebed →
believable groundwater). Sample positions that miss salt within 80
attempts are silently dropped — better to ship 3 wells in salt than to
scatter strays into wrong-feeling biomes. Side-effect: total well count
may now be < 5 if the salt patches are tight; balance-wise this is fine
because canteens are reusable and water sources are deliberately scarce
in this game.

## D22 — Salvage interact tag moves from wreck root to a small panel mesh (Session Z)
**When**: Session Z.
**Why**: Pre-Z, `registerSalvageable` tagged the wreck *group* with
`interactType: 'salvage'`, so raycasting any mesh on the wreck (a nozzle,
a strut, a 6m fuselage cylinder) triggered the prompt. Reads as
non-tactile — the whole wreck is one giant button. Z introduces a small
brass-rimmed access plate (~32×24×6 cm) embedded in each wreck at a
kind-specific local offset; only THIS panel carries the interact tag.
Players must aim at the panel deliberately. Architectural rules:
  - Wreck constructors (`makeXxx` in `wrecks.ts`) bake in the panel and
    stash it on `group.userData.accessPanel`.
  - Custom POI hulls that wrap a wreck (engine_block, crashed_hull)
    forward the inner panel ref to the outer group's
    `userData.accessPanel`.
  - `Salvageable.panel` field stores the ref; `interaction.ts` raycast
    targets `s.panel`, not `s.mesh`.
  - Panel meshes are flagged `noCollider` so the existing wreck compound
    colliders aren't redundantly bumped.
If a future wreck constructor forgets to call `addAccessPanel`,
`registerSalvageable` falls back to tagging the group root (legacy
behavior) so the wreck is still salvageable, just not tactile.

## D23 — `panelWithHole` helper for real geometry holes, not fake emissive shafts (Session AA)
**When**: Session AA.
**Why**: User wanted actual sunlight reaching the opening-wreck interior
through pierced walls/roof. Tried two cheats first — emissive
"light-shaft" cones inside the cavity, then exterior dark spots — both
read as artificial. The fix was a new `panelWithHole(W, T, D, cu, cv,
hw, hd, mat)` helper in `openingWreck.ts` that builds a flat panel as a
`THREE.Group` of up to 4 sub-meshes wrapping a rectangular hole
(top/bottom strips + left/right pieces in the hole's height band).
Wall geometry is genuinely missing where the hole is; the directional
sun reaches the floor through real gaps. Used for side walls, back wall
(rotated -π/2 around X), and front-roof / back-roof slabs.
Decorations (seams, rust streaks) consult `wallHoles[]` and skip
positions that would float over a now-empty gap. Trade-off:
panel-with-hole only supports ONE rectangular hole per call — multiple
holes per wall would need a recursive rectangle decomposition. v1 places
at most one hole per wall, which is enough.

## D24 — Back roof as translucent flat tarp, not gabled hull (Session AA)
**When**: Session AA.
**Why**: After holes alone didn't brighten the interior enough — even
with bigger holes the directional sun shadow from the surrounding walls
+ roof kept most of the cavity dark — user proposed replacing the back
slabs with cloth that lets sun through. Implementation: a single FLAT
horizontal panel in `_tarpMat` (MeshLambertMaterial with
`transparent: true, opacity: 0.30, emissive: 0xb88a4a, intensity 0.45,
side: DoubleSide`), tagged `userData.noShadow = true` so the wreck's
local shadow walk sets `castShadow = false` — sun rays pass through to
the cavity floor. Tarp is slightly tilted around X so the back edge
anchors at the back-wall ledge (Y = HALF_H*2 + 0.06) and the front edge
sags 25cm forward, reading as a salvaged sheet tied off and pulled tight.
The emissive component is what makes the cloth itself look luminous when
viewed from below — pure transparency alone left the underside dark.
**Footgun fixed in this session**: the wreck's `g.traverse` at end of
`makeOpeningWreck` was unconditionally setting `castShadow = true`,
overwriting any `userData.noShadow` flags. main.ts's global shadow walk
runs at boot BEFORE `setupOpeningScene`, so the wreck's local walk is
the authoritative source. Updated the local walk to
`m.castShadow = !m.userData.noShadow`.

## D25 — Opening wreck placement: hardcoded yaw + post-placement player teleport (Session AA)
**When**: Session AA.
**Why**: The wreck's position is set by `findFlattestSpot`, which drifts
up to 16m from the search center. Two related decisions:
  (a) **Yaw**: was `atan2(wreckOrigin.x, wreckOrigin.z)` — meaning the
      effective rotation depended on where flat-spot search ended up, so
      "back wall faces sunrise" was approximate. Hardcoded to π/2 so the
      back wall faces world +X (sunrise direction) exactly regardless of
      drift. Cinematic intent always reads.
  (b) **Player spawn**: was a fixed `(35, _, 0)` in main.ts — could
      easily end up east of the wreck after drift, on the wrong side of
      the entrance. Now `setupOpeningScene` takes a `playerBody`
      parameter and calls `body.setNextKinematicTranslation` AFTER the
      wreck is placed, putting the player 6m in front of the entrance
      regardless of where the wreck landed. Camera lookAt at the
      entrance gives a deterministic first-frame view.
Save-load path unaffected — `setupOpeningScene` is skipped when
`hasSave()` is true.

## D26 — Sand-reclaimed floor: terrain IS the cavity floor (Session BB)
**When**: Session BB.
**Why**: First iteration of the mega-ship had a metal floor mesh covering
the cavity interior, but no floor collider — player fell through. Fix
options: (a) add a floor collider, (b) remove the floor mesh entirely
and let terrain serve as the floor (player walks on sand inside).
Picked (b) per user: "the floor of the wreck can be under the sand to
make it look like the sand has reclaimed it over time." Result is more
atmospheric (sand drifts inside, gradient terrain reads as natural
burial). Implementation: no `_floorMat` mesh, no floor collider — the
existing terrain heightfield collider supports the player both outside
and inside the wreck. Walls extend WALL_BURY (2m) below the wreck
origin so no gap is visible on sloped dunes. Wreck origin = mean terrain
in footprint, so terrain rises into the cavity for the reclaimed look.

## D27 — Wreck pose: terrain-normal tilt + per-section burial (Session BB)
**When**: Session BB.
**Why**: A wreck sitting flat-on-the-ground on a sloped dune looks like
it landed on a level pad. Tilting it to match the terrain normal at
its position gives the "crashed and settled" silhouette. Implementation
in `src/world/poi.ts` mega_ship dispatch: sample
`terrain.normalAt(x, z)` at the chosen flat spot, build a quaternion
from up-axis to that normal capped at ~14° (`Math.min(angle, 0.25)`),
compose with yaw, apply to both the Three.js group and the Rapier
fixed-body rotation. Cap exists so the wreck doesn't tip absurdly on
steep slopes. For the BB-2 mega-wreck, the cap tightens further to
~5.7° (0.10 rad) since 0.25 rad on a 120m structure exposes 30m of
underside on the high end — see BB plan section "Architectural risks."

## D28 — Mega-wreck visual reference: Force Awakens Jakku Inflictor (Session BB plan)
**When**: Session BB (plan-mode research).
**Why**: User specifically asked to "do some research on what a sci-fi
wreck of a ship should look like" referencing the Force Awakens opening
with Rey salvaging the Star Destroyer. Visual takeaways logged here so
future iterations don't drift off-reference:
  - Wedge silhouette, bow buried, stern + bridge tower exposed
  - Battle damage / hull rents reveal interior bays
  - "David and Goliath" scale contrast (small figures against massive
    plating) — the wreck must FEEL big through context, not just be big
  - Layered sand burial (gradient drift up the sides)
  - Surrounding wreckage field of smaller crashed ships acts as scale
    reference
  - Squatters lived in conning towers — interior is enterable + has
    multiple connected rooms
For Dustfall's scale (literal 1.6km Star Destroyer impossible in 280m
playable radius), the BB-2/BB-3 mega-wreck targets 120m long × 45m wide
× 30m tall above sand — ~10× linear vs current mega-ship, dominates
skyline, visible from much of the playable area through fog.

## D29 — Bow Y-offset anchored at runtime to terrain at the entrance (Session BB-2)
**When**: Session BB-2.
**Why**: The archived BB plan called for a static `BOW_ORIGIN_Y = -2.0`
to bake nose-dive into the bow geometry. In practice, at 120m wreck
length terrain Y varies up to 12m across the footprint (the wreck often
straddles a dune slope), and a static -2m offset pushed the bow entrance
2m below terrain at the entrance position — unwalkable. Fix: build the
bow as a named 'bow' sub-group, and in `placeMegaWreck` compute
`bowYOffset = bowEntranceTerrainY - bowEntranceWorldY` at runtime,
apply to `bowGroup.position.y` AND propagate to every bow-collider
translation. Anchoring to the ENTRANCE position (not bow center)
guarantees the entrance is always walkable; the bow center may have
terrain below the cavity floor (sand reclaims, acceptable) but never
above the entrance opening. Companion fixes: widened the flat-spot
search to 9×9 at 15m spacing (vs archived 5×5 at 8m — too narrow at
this scale), tightened tilt cap to 0.10 rad (vs 0.25), bumped
`BOW_ENTRANCE_H` from 3 to 4m for slack against ±1m terrain variation
within the bow footprint. True tilted-bow geometry (rotating the bow
section around X) deferred to a future session; the current static-
height bow with runtime Y-offset is stable and shippable.

## D31 — FogExp2 over linear THREE.Fog for storm density (Session BB-4)
**When**: Session BB-4.
**Why**: Pre-BB-4, storm fog was linear `THREE.Fog` with `near` and
`far` ramping (25→15, 170→30) with intensity. Linear fog reads the same
across the middle distance and "snaps off" at `far`, giving a flat-
wall feel. FogExp2 (exponential falloff via `density`) sells real
atmospheric scattering — close objects fog gently, distant objects
fade smoothly to invisible. Density curve: clear=`0.0035`, peak storm
=`0.055`, smoothstep-eased between. No shader rewrites needed because
default three.js materials respect both `FOG` and `FOG_EXP2` shader
chunks; our custom shaders (sky.ts, particles, sun/moon sprites) all
already set `fog: false` so they're unaffected. Trade-off: every
fog-aware surface now reads slightly tinted in the foreground at peak
storm (not just middle-distance) — addressed by bumping the fog-color
lerp to dust from 0.45 → 0.70 so the foreground tint matches the sky
tint instead of reading bichromatic. Switching back to linear is a
1-line revert in scene.ts if a future session wants a bigger
visibility range without dust feeling.

## D32 — Three stacked dust layers (near/mid/far) over single layer + per-particle variance (Session BB-4)
**When**: Session BB-4.
**Why**: Two ways to get "depth" in particle dust: (a) one layer with
per-particle size/color/speed variance, (b) three discrete layers each
with their own bulk size/color/speed/spread. Picked (b). Reasons:
  - Each layer's opacity can ramp independently with storm intensity —
    far comes in first at `intensity 0` (storm appears on horizon),
    near comes in last at `intensity > 0.15` (wind reaches you). This
    staged ramp is the visual story; a single layer can't tell it.
  - Layer-specific spread + Y-wrap (near=30m × 6m, far=200m × 18m) keeps
    near particles tight around the player and far particles smeared
    across the horizon — exactly what we want for parallax depth.
  - 3 draw calls instead of 1 is a real cost but acceptable at the
    measured FPS (143→91 at peak, well above the 60 target).
  - Mid layer is the existing 2500-particle cloud, kept as-is so the
    "this is what a storm looked like before" reference is preserved.
Future sessions can collapse to single-layer if perf becomes a problem
on weaker hardware — the layer config is centralized in tuning.ts and
the layer setup is symmetric.

## D33 — Storm vignette as in-scene clip-space quad, not CSS overlay (Session BB-4)
**When**: Session BB-4.
**Why**: The screen-edge tint at peak storm could have been a CSS
`background: radial-gradient(...)` on a fullscreen DOM div. Picked an
in-scene `THREE.Mesh` + `ShaderMaterial` with a clip-space vertex
shader instead. Reasons:
  - In-scene composites correctly with tone-mapping + bloom (if added
    later) — CSS would over-paint a tone-mapped scene, fighting the
    ReinhardToneMapping output.
  - Aspect-corrected radius is one uniform → circle is round on every
    aspect ratio. CSS `radial-gradient` ovals on widescreen.
  - Color is a shader uniform; future sessions can drive it from the
    same `fogTarget` color as the scene fog if we want the vignette
    to track storm tint perfectly.
  - Cost: 1 extra draw call (depth-test off, last in render order).
    Negligible at our scene size.
Trade-off: if the user later prefers a HUD-style overlay (HUD over
vignette so vignette doesn't tint the HUD), we'd need to either move
vignette to CSS or render HUD via a separate Three.js orthographic
overlay. Not addressing now — current HUD reads fine over the
~55%-opacity dust-rust vignette since HUD elements are bright/contrast-
high already.

## D30 — Mega-wreck skylights via 3 strip-panels (not multi-hole panel) (Session BB-3)
**When**: Session BB-3.
**Why**: BB-3 needed 3 skylights in the aft roof. `panelWithHole` only
supports one rectangular hole per call (D23). Two options: (a) write a
new multi-hole panel helper that decomposes the panel into pieces
around N holes, (b) split the roof into 3 strips along Z, each with
one hole via the existing helper. Picked (b) — keeps the utility
single-purpose, no new code in panelUtils, and the strip pattern
generalizes to N>3 skylights trivially by adding rows to `ROOF_STRIPS`.
Trade-off: 3 mesh objects for the roof instead of 1, plus per-strip
collider splits (up to 4 cuboids each — front/back of hole + left/right
in hole Z band). Worth it: each strip's cv (hole Z offset) is
independent so skylights can be staggered for visual interest. Same
pattern can be applied to walls if multi-hole walls are ever needed.
