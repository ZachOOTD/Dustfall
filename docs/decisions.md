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

## D34 — Speeder: velocity-controlled motion over force/torque (Session CC)
**When**: Session CC.
**Why**: First cut was a "real" dynamic body — PD hover via `addForce`,
forward thrust via `addForce`, steering via `addTorque`. Two failures:
  (1) **PD hover NaN'd**: when the bike fell far below target Y, the
  proportional gain × mass × error produced astronomical forces
  (>1e6 N). Rapier's Euler integrator overshot, velocity went to
  infinity, position serialized as `null`.
  (2) **Torque steering spun out**: angular damping had to be high
  enough to stop the bike spinning after A/D release, but high damping
  made the bike feel sluggish under turn. There was no tuning that
  gave both "responsive turn" and "stable straight line."
Switched to **velocity control** for all three axes (X, Z linear; Y
hover; yaw angular):
  - Compute target velocity from input + state (e.g. forward × thrust,
    yaw error × response gain).
  - Clamp target velocity to a max.
  - Lerp body's actual velocity toward target with a tuned factor
    (0.07 for X/Z accel, 0.30 for yaw, 0.25 for hover Y).
  - `body.setLinvel` / `body.setAngvel` each frame.
This pattern is unconditionally stable (you can never overshoot a
clamped target by more than the lerp factor per frame), feels arcade
without the user noticing they're not in "real physics", and gives
predictable timing (~14 frames to 64% of target). Required:
  - `body.setGravityScale(0)` so Rapier doesn't re-apply gravity
    between updateSpeeder runs and cancel the hover velocity.
  - Linear + angular damping disabled (0). We own the velocity
    completely; damping would fight our lerp.
Trade-off lost: the bike can't be pushed around by other dynamic
bodies (nothing exists in the world to push it anyway). If we ever
add stacked-crate physics where you can ram the bike into something
and have IT react, we'd need a hybrid: external impulses route
through forces, our control inputs route through setLinvel. Not
needed for v1.

## D35 — Speeder input: mouse turns bike + A/D strafe (not A/D turn) (Session CC)
**When**: Session CC.
**Why**: Initial scheme was the bike-game classic: W/S throttle, A/D
yaw, mouse independent look-around. User feedback: "starts spinning
uncontrollably if I try to turn." Two issues stacked: the torque-
based steering (D34) was already unstable, and the bike's heading
being decoupled from the camera meant the player had to mentally
track two yaws (where the bike points vs where they're looking).
Switched to: **mouse turns the bike** (target yaw = camera yaw, lerp
toward it), **A/D strafe**. This is the FPS-shooter mental model
applied to a vehicle — the bike points where you look, A/D move you
sideways relative to the bike's heading. Net effect: steering feels
"where you look", strafe is the new lateral control, no separate
turn input. Boost still maps to Shift. Lost: ability to spin in place
without the camera moving (which was buggy anyway). Re-adoptable if
ever needed by adding a "free-look" modifier key.

## D36 — Speeder: camera at +1.45m above bike body, player capsule parked off-world (Session CC)
**When**: Session CC.
**Why**: Two camera-position pitfalls solved in one decision:
  (a) Initial `RIDER_SEAT_Y = 0.55` put the camera at handlebar
  height (handlebars sit at body-Y ≈ 0.5). Rider's view was blocked
  by the bike's own geometry. Raised to 1.45m so the camera clears
  the bars and the rider looks over them at the world.
  (b) Initial approach teleported the player's kinematic capsule to
  the rider seat each frame so the existing camera-from-player-body
  pipeline would just work. But the kinematic capsule's
  `setApplyImpulsesToDynamicBodies(true)` meant it bumped the dynamic
  bike body — bike drifted away. Switched to: while mounted, the
  player body parks at `(0, -2000, 0)` (out of physics relevance) and
  `updateSpeeder` writes `camera.position` directly each frame from
  `bike.translation + riderSeatOffset.rotateByYaw`. `updatePlayer`
  early-returns BEFORE the `isPlaying` gate so the speeder-driven
  camera persists even when pointer lock isn't engaged (e.g., in
  preview or while paused).
On dismount, the player body is teleported back via `body.setTranslation`
(instant, not `setNextKinematicTranslation`) — because `updatePlayer`
runs LATER in the same frame and would clobber a deferred kinematic
update by reading the stale parked position (-2000) and rewriting
it. Subtle but cost an hour to track down.

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

## D37 — Speeder tilt as visual-only quaternion (not physics body rotation) (Session CC-2)
**When**: Session CC-2.
**Why**: D34 disabled the speeder body's X+Z rotations
(`setEnabledRotations(false, true, false, true)`) so the chassis stays
upright after collisions. But CC-2 also wants the bike to PITCH under
W/S and ROLL under A/D for tactile feel. Resolved by composing a
visual-only quaternion on top of the body's yaw each frame:
```
visualQ = yawQ × pitchQ × rollQ
group.quaternion.copy(visualQ)
```
The physics body still rotates only around Y (yaw stays the same), but
the visual mesh tilts. `s.visualPitch` + `s.visualRoll` lerp toward
input-driven targets (`±SPEEDER_TILT_PITCH_MAX`, `±SPEEDER_TILT_ROLL_MAX`)
with `SPEEDER_TILT_LERP = 0.12`. Two free benefits: tilt is
deterministic (no physics surprises), and reverting to "no tilt" is
just setting the constants to 0 — no body re-config needed.

## D38 — Speeder camera roll: tracked-undo + re-apply (not naive multiply) (Session CC-2)
**When**: Session CC-2.
**Why**: First cut applied camera roll via
`camera.quaternion.multiply(rollQ)` each frame while mounted. This
spun the camera continuously at 12°/frame × 60fps = 720°/sec because
`PointerLockControls` does NOT reset `camera.quaternion` between
mouse events — it only writes on mousemove. So the roll quaternion
accumulated across frames. Fix: track `s.lastCamRoll` on
`SpeederState`, each frame multiply by the inverse of last roll
THEN by the new roll. Net result: each frame's camera quat ends up
with exactly the current roll applied (regardless of what
PointerLockControls has done since), and the user can mouse-look
normally without losing the roll. On dismount, undo any residual
roll so the on-foot player doesn't inherit a banked horizon.

## D39 — `'mount'` InteractType + `'speeder'` registry (Session CC-2)
**When**: Session CC-2.
**Why**: The "press E to mount" tooltip needed to plug into the
existing crosshair-anchored interact prompt (D23 chain). Extended:
  - `InteractType` gains `'mount'` (in `inventory/types.ts`); `VERBS`
    in `interactPrompt.ts` gets `mount: 'mount'`.
  - `InteractHit['registry']` union gains `'speeder'` (in
    `player/interaction.ts`).
  - The speeder's seat mesh is named `'speederSeat'` + tagged with
    `userData.interactType='mount'`, `interactId=0`,
    `interactRegistry='speeder'`. `placeSpeeder` extracts the seat
    ref via `getObjectByName` and stores it on `SpeederState.seat`.
  - `updateInteraction` pushes `ctx.speeder.seat` into targets when
    `ctx.speeder && !ctx.speeder.mounted`. New `case 'speeder':`
    sets `hover.type = 'mount'`, `promptNoun = 'speeder'`. Does NOT
    dispatch on E-press — `updateSpeeder` already handles the mount
    earlier in the tick (with its own `SPEEDER_MOUNT_RANGE = 3.5m`
    check). The interaction system is purely showing the prompt.
This pattern (singleton interactable with `interactId=0` + custom
registry) is the template for future singletons like a bounty board.

## D40 — Shared 3D engine bell mesh helper (Session CC-3)
**When**: Session CC-3 (part of CC-2 long iteration).
**Why**: The original engine-bell visual (`TorusGeometry` ring + flat
`CircleGeometry` dark inner disc) used a 2D single-sided circle. From
any angle except dead-on, the disc looked like a decal — especially
bad on hero-scale bells (mega-wreck 10m bells, mega-ship). Replaced
with a shared `makeEngineBellMesh(radius, depth, outerMat, interiorMat)`
in `wrecks.ts`:
  1. Outer flared cone — `CylinderGeometry(R, R*0.55, depth, 16, 1, true)`
     (open-ended). DoubleSide variant of `outerMat` (cached in
     `_bellOuterMatCache: WeakMap<Material, Material>`) so the inside-
     the-mouth view isn't transparent.
  2. Inner solid cylinder — `CylinderGeometry(R*0.75, R*0.45, depth*0.95)`
     in `interiorMat`, slightly recessed so the +Y cap shows as the
     dark exhaust face inside the flare; -Y cap closes the back.
  3. Rim torus at the mouth — `TorusGeometry(R*1.02, R*0.06, 6, 18)`.
Refactored all 7 bells (speeder ×2, megaShip ×1, megaWreck ×2,
`makeEngineBell`, `makeEngineCluster`'s 3-5 nozzles) to use it. The
WeakMap cache means even with 7+ bells across the world we allocate
exactly one DoubleSide clone per source material. Trade-off: 3 meshes
per bell instead of 2 — negligible perf cost, big visual upgrade. The
helper's local +Y orientation is the convention — callers rotate as
needed (most use `rotation.x = π/2` to point the mouth at +Z).

## D41 — Dedicated title 3D scene, not "render game world behind menu" (Session CC-3)
**When**: Session CC-3.
**Why**: The animated main-menu bucket entry had two paths: (A) decoupled
THREE.Scene + camera; (B) render the live game world behind the title with
a cinematic camera rig. Picked A because (1) the title needs a fixed
cinematic composition (camera atop a hero dune, horizon at bottom-third)
that the player's real spawn camera + WASD-controlled view can't match;
(2) the title sky needs a custom day/night cycle independent of
`ctx.time.dayTime` (the title runs while `ctx.flags.paused=true` and
the game world's time should freeze with it); (3) the in-game opening-
scene wreck has a specific narrative role we don't want to upstage. Cost
of A: ~600 LoC of inline scene assembly + helper exports from sky.ts so
the title can build its own SkyBundle without disturbing the game's
module-singleton. (B) is preserved as a deferred polish idea in roadmap.

## D42 — Title sun arc rebuilt around camera-forward axis (Session CC-3)
**When**: Session CC-3.
**Why**: The in-game sun direction is `(cos(angle), sin(angle), 0.18)`
— a flat east-west sweep in the X-Y plane that works because the player
can turn to look at it. The title camera is FIXED forward (lookAt rig),
so the in-game arc only crosses the visible frustum near sunrise/sunset
and even then misses the screen most of the day. Rebuilt the title sun
as `sunDir = dawnAxis * cos(angle) + upPerp * sin(angle)` where
`dawnAxis` is the camera-forward direction (shifted ~LEFT_SHIFT camera-
right units left of pure forward) and `upPerp` is the world-up
component perpendicular to it. Result: sun rises in front of camera, arcs
up-and-over, sets behind. Moon = -sun, so moon emerges as sun sets, also
in-frame. Day-night brightness math still uses `sin(sunAngle)` so the
cycle has full -1..+1 swing — only the VISUAL direction changes. This is
a title-only patch; the in-game sky stays on its original arc.

## D43 — setupOpeningScene runs on every boot; load patches over (Session CC-3)
**When**: Session CC-3.
**Why**: The original gate was `if (!hasSave()) setupOpeningScene(...)`
— so when the player saved + reloaded + clicked Continue, they landed in
a world with NO starter wreck, journal, skeleton, or speeder. Bug surfaced
as "clicked NEW GAME, the game had no hover bike or starting wreck".
Two fixes considered: (A) save the wreck/speeder/journal explicitly to
save data; (B) always run setupOpeningScene and have loadGameState patch
the speeder position over the default placement (the wreck/skeleton/
journal are static so the default placement IS the save state). Picked B
— wreck/skeleton/journal are deterministic from `scatterRand`, so the
placement is byte-identical across boots. Only the speeder moves, and
its pose is now an optional field in SaveV1 that loadGameState restores
via `body.setTranslation/setRotation`. NEW GAME from a save calls
`clearSave() + location.reload()` so a "new game" is a real fresh boot,
not a hot reset that could leak partial state.

## D44 — Crescent moon via canvas destination-out + tight halo (Session CC-3)
**When**: Session CC-3.
**Why**: User wanted a crescent moon visible at distance in both the
title and the game. Options: (A) load a moon GLB / PNG sprite; (B)
rebuild `makeMoonTexture` to draw a crescent via 2D canvas. Picked B —
zero asset shipping, matches the existing makeSunTexture / makePlanetTexture
pattern (all canvas-procedural). Implementation: halo radial gradient
(radius 28→56, kept tight so the erase disk can swallow it), full body
disc + maria, then `globalCompositeOperation = 'destination-out'` to
carve a circle offset (84, 60, r=40) to the right of body center. The
erase carves the halo on the shadowed side too — intentional (a real
crescent moon has NO bloom on its dark side). Earlier iterations had
the erase disk too small (r=32) and the halo too wide (radius 64) so
the right side of the halo bled past the carved shape; bumped both to
fix. `MOON_DISC_SIZE` 16 → 32 so the crescent reads at SUN_DISC_DISTANCE.
Also flipped `depthTest: false → true` on the moon material so terrain
occludes it (matching stars + planet) — the previous setting was a
copy-paste from the sun material and caused the moon to render through
dunes in-game.

## D45 — Single well at the salt-flats centroid (not scattered) (Session CC-4)
**When**: Session CC-4.
**Why**: The salt-flats well was originally a quota-based scatter (up to
5 wells, each placed at a random salt patch). User direction shifted
to a single well 'at the center of the salt flats biome' — easier
landmark, more of a destination, less RNG-driven map clutter. Picked
an analytical centroid: grid-sample the explorable disc, score each
'salt' cell by `rawAt(x, z) - distFromOrigin × 0.001` (higher raw
biome-noise value = deeper into salt territory; the small distance
penalty prefers central salt patches over edge ones). `WELL_TARGET_COUNT`
stayed configurable (default 1) so a future tuning bump could re-
introduce scatter without code surgery. Trade-off: the world loses
some 'multiple watering holes' feel, but gains a clear pilgrimage-
type goal — walk far enough across the salt and you'll find THE well.

## D46 — GitHub Pages via Actions (not Cloudflare / Netlify / itch.io) (Session CC-4)
**When**: Session CC-4.
**Why**: User wanted to share Dustfall with friends. Four static-host
options: GitHub Pages (free, GitHub-native), Cloudflare Pages (free,
faster + unlimited bandwidth, requires connecting repo to CF), Netlify
/ Vercel (similar to CF, 100 GB/mo cap), itch.io (game-dev focused, can
be password-protected for friends-only, manual upload per release).
Picked GitHub Pages because (1) repo is already on GitHub so zero new
dashboard/account, (2) auto-deploy on push to master keeps the dev
flow identical to what's been working all session, (3) workflow file
is ~50 lines of YAML and lives next to the code (good archeology in 6
months), (4) the public URL is fine for a shared-with-friends use case
— if privacy ever matters, we can move to itch.io's password-protected
upload without losing anything. Implementation: `.github/workflows/
deploy.yml` (build with `npm ci` + `npm run build` → upload `dist/`
→ `actions/deploy-pages@v4`), Vite config gains mode-based base `/Dustfall/`
for production-only (dev stays at `/`). One-time UI toggle: Settings
→ Pages → Source = 'GitHub Actions'.

## D47 — Phantom `simplex-noise` dep (resolved from parent node_modules) (Session CC-4)
**When**: Session CC-4.
**Why**: Documenting a bite so future-Zach (and anyone else) doesn't
get the same one. `simplex-noise@4.0.3` was being resolved at
`C:/Users/Zach/node_modules/simplex-noise/` — installed in the user's
home directory's node_modules (probably from a one-off `npm install`
run outside the project) and silently picked up by Node's module-
resolution walk-up. Locally `npx tsc --noEmit` passed (with
`moduleResolution: "bundler"`, tsc defers actual module resolution to
the bundler), `npm run build` passed (Vite walks up the tree too), and
the game shipped fine — but on CI, `npm ci` strictly installs only what's
in package.json's dependencies, with no fallback to a parent directory.
Result: GitHub Pages build #1 failed with 3× "Cannot find module
'simplex-noise'" errors. Fix: declared `simplex-noise: ^4.0.3` in
package.json + ran `npm install` to update the lockfile. 
**Lesson**: any time you suspect a phantom dep, check `ls
C:/Users/Zach/node_modules/` — that directory should be empty for a
project like this. Stray packages there will mask CI bugs forever
because locally they 'just work.'

## D48 — Sand worm collider is a sensor (no contact forces) (Session DD)
**When**: Session DD.
**Why**: The worm body is a kinematic cuboid (12, 2, 2) that moves at
up to 8 m/s underground + arcs 6m above sand during lunges. Both the
player capsule (`kinematicPositionBased`) and the speeder body
(dynamic) sit in the worm's path during normal play. With a regular
solid collider, Rapier's character controller computes a "push-out"
displacement for the kinematic player (launching them skyward when
the lunge cuboid intersects from above) and applies real impulses to
the dynamic speeder (ragdolling it into the terrain when the worm
brushes past). Bite damage is unrelated — it's an explicit XZ
distance check at the lunge arc midpoint in `tickLunge`, not a
collision event. So we lose nothing by making the collider a sensor.
**Implementation**: `collider.setSensor(true)` in `spawnSandWorm`.
**Machete still works**: `castShape` defaults to including sensors;
combat.ts also passes filter flag `0` explicitly so this never
regresses if a future Rapier version changes the default.
**Rejected alternatives**: collision groups (would require touching
player + speeder collider configs); reducing collider size (doesn't
solve the lunge-arc-above case).

## D49 — Charge commits at enterCharging snapshot (not live-tracked) (Session DD)
**When**: Session DD.
**Why**: Original implementation refreshed `worm.target` every 0.5s
during charging (leading the player by `playerVel * 1.0s`). Result:
unavoidable lunge. Player sprints at 7.1 m/s, worm charges at 8 —
the worm always closes regardless of direction, and the lunge fired
when within `LUNGE_RANGE = 6m` of the **live** player. The encounter
felt like a 100%-hit cooldown rather than a fight.
**Fix**: `enterCharging` snapshots the player's CURRENT XZ to
`worm.target`. `tickCharging` does NOT refresh. The lunge triggers
when the **worm reaches its target** (distance to target, not to
player). `enterLunge` arcs along `worm.target - worm.basePos`, not
toward the live player. Player can now dodge sideways before the
worm arrives → the lunge fires at empty sand → retreat → re-charge
or stationary breach. The bite still uses `distToPlayer ≤ BITE_RANGE`
at arc midpoint, so a player who didn't dodge gets bitten.
**Trade-off**: charging at a slow / unaware player is now a guaranteed
hit, but a moving / aware player has a real defensive option. That's
the intended game-feel split. If raiders ever get a "charge" attack
later, mirror this commit pattern.

## D50 — 3×3 fixed-resident chunks (not streaming, not one big heightfield) (Session FF)
**When**: Session FF — world rework #1.
**Why**: Two alternatives were rejected. (a) Single enlarged
heightfield at 2400m × 720-cell grid: ~3.6M-triangle monolithic mesh
with one giant Rapier heightfield collider. The mesh becomes a frustum-
culling disaster (single AABB spans the whole world) and the collider
puts the entire heightfield on Rapier's hot path. (b) Streaming chunks
(load/unload by player position): real procedural-world scale, but the
load/unload pump is a session of its own — pose hand-off, collider
re-registration, deterministic seed-per-chunk indexing, fade-in
artifacts.
**Pick**: 3×3 fixed-resident chunks. Each chunk reuses the proven 192-
cell pattern so per-chunk fidelity matches the pre-FF world. All 9
chunks resident at boot, no swap pump. Cheap enough that the playable
area can grow to 2400m without changing the rendering or physics
pipelines.
**Trade-off**: world has a hard 2400m cap. If sessions #2 + #3 reveal
the user wants 4000m+ ("real" exploration scale), revisit with
streaming. For now, 2400m gives 9× the area of the old world — plenty
of room for vaster biomes + spread POIs.

## D51 — Seam invisibility via shared noise + world-space sampling (Session FF)
**When**: Session FF.
**Why**: Naively, each chunk would build its own `createNoise2D`
instance from its own RNG stream. Adjacent chunks would then sample
DIFFERENT noise channels at their shared edge, producing visible
discontinuities at chunk boundaries — a grid of seams in the desert.
The alternative considered was an explicit seam-stitching pass after
mesh creation (averaging adjacent vertex heights).
**Fix**: ONE shared `createNoise2D` instance lives at the
`createTerrain` scope; every chunk passes it to `sampleHeight`. Every
chunk samples WORLD-SPACE `(x, z)` (chunkCenter + localOffset), not
chunk-local coords. With both invariants, vertex at chunk (gx,gz)'s
east edge (worldX = chunkCenter.x + SIZE/2) and vertex at chunk
(gx+1,gz)'s west edge (worldX = chunkCenter.x + SIZE/2) sample the
SAME world coord through the SAME noise function and produce bit-
identical heights. Verified Δ < 0.0004m across all four seams and the
corner (residual is floating-point bilinear interp error).
**Apply**: any future chunked / streamed terrain logic MUST honor
both rules. If session #2 or #3 introduces a per-chunk noise seed, it
breaks seam invisibility.

## D52 — LOD ring slotted under chunks (no donut carving) (Session FF)
**When**: Session FF.
**Why**: The coarse far-LOD mesh (80×80 vertices over ±2000m, no
collider) physically overlaps with the chunk band in [-1200, +1200].
Three options: (a) donut-carve the LOD geometry to exclude the
chunk-band square — costs an indexing pass and complicates the
vertex layout for marginal benefit. (b) Disable depth-test on the
LOD so chunks always paint over — would break terrain occlusion of
landmarks beyond the chunk band. (c) Render the LOD slightly under
the chunks.
**Pick**: option (c). LOD mesh sits at `y = -0.15`. Inside the chunk
band, the high-detail chunks always win the z-buffer fight by a
millimeter or two. Outside the band, the LOD is the only terrain
visible. The 0.15m bias is invisible at the LOD's viewing distance
(>1200m from camera, heavy fog at the new clear-density 0.0018).
**Trade-off**: at the chunk-band edge, the LOD sits 0.15m below the
chunks — a tiny vertical step. Visually undetectable; nobody will see
a 15cm shelf at 1200m.

## D53 — `findBiomeCentroid` drops the origin-distance bias (Session GG)
**When**: Session GG.
**Why**: The pre-EE `findSaltCentroid` scored cells as
`score = biomes.rawAt(x, z) - dist * 0.001` to bias the well toward
spawn ("anchors near spawn rather than at the edge"). That penalty
was tuned for `RANGE = 220` (max dist 220 × 0.001 = 0.22, comparable
to biome thresholds at ±0.22/0.32). At GG's `RANGE = 1100`, the same
0.001 penalty becomes 1.1 at the edge — completely swamps biome
scoring and would push the centroid to origin regardless of biome.
**Fix**: drop the penalty entirely. Score is pure `biomes.rawAt`.
Multi-well placement now uses greedy `excludeCenters` to spread
across separate regions instead of relying on origin bias.
**Trade-off**: the single well is no longer anchored near spawn.
Players may need to travel further to reach the first well —
intentional for the bigger-world feel. If a future polish session
wants a "starter well near spawn", add a `bias` option that
re-introduces the penalty when called with `searchRadius ≤ ~400`.

## D54 — Greedy `excludeCenters` for multi-well placement (Session GG)
**When**: Session GG (`WELL_TARGET_COUNT 1 → 3`).
**Why**: Three alternatives considered:
(a) Top-K by score — find the K best cells globally. Risk: K
clustered cells in the same salt region instead of K spread regions.
(b) Per-region scoring — partition the world into N regions, find
the best cell in each. Complex region detection logic.
(c) Greedy with exclusion radius — find best cell, mark
`WELL_MIN_SEPARATION = 400m` around it, find next-best, repeat.
**Pick**: (c). Simplest implementation, naturally distributes across
separate biome regions, and stops cleanly when salt runs out (the
loop breaks on `null` return). The `excludeCenters: Array<{ x, z,
radius }>` API in `findBiomeCentroid` is reusable — session #3 will
use it for Poisson-disk-like POI placement.

## D55 — id-based scatter persistence absorbs count growth (Session GG)
**When**: Session GG.
**Why**: Sessions #2 + #3 grow scatter counts substantially (cacti
3→10, eventually lizards 4→28). The scoping plan called for an
ordinal-mapping migration (`min(savedCount, newCount)` walk). On
inspection, the existing save schema is already robust: `cacti`,
`lizards`, `salvageables`, `lootContainers` save by `id`, not
ordinal index. The `_nextId` counter resets per boot, and rejection
sampling is deterministic from `RNG_SEED`, so the first N cacti
spawned post-bump always have ids 1..N. On load, `find((c) => c.id
=== saved.id)` matches saved state to the correctly-indexed new
spawn. Count growth → new ids beyond the saved set are simply
un-harvested. Count shrinks (won't happen in #2/#3) → saved ids
without matching spawns are silently skipped.
**Apply**: future scaling sessions (e.g. raider re-spawn in some
later session, more cacti, more POI salvageables) don't need
migration code. Just bump `SAVE_VERSION` as a marker and trust the
id-based lookup. The version bump exists so future tooling can
distinguish saves from different world layouts.

## D56 — LOD ring removed (D52 superseded) (Session HH)
**When**: Session HH.
**Why**: D52's "slot the LOD 0.15m beneath the chunks via mesh.position.y"
approach assumed the resolution difference between LOD and chunks was
small. It isn't. The LOD uses 50m vertex spacing with linear interpolation
between samples; the chunks use 4.17m spacing with fine dune detail
(primary wavelength 170m, amplitude 13.5m). When two adjacent LOD
samples land on dune crests and the chunks dip into a valley between
them, the LOD's straight line sits 10m+ above the chunks' actual valley
floor. The 0.15m bias is meaningless against that overshoot; the LOD
ends up "floating" above the chunks in valleys, and since it has no
collider, the player passes through it.
**Fix**: delete `src/world/terrainLod.ts` and its tuning constants
entirely. Chunks become the single source of terrain truth. The chunk-
band edge (1200m radial) is the visible horizon; fog density 0.0018
gives `exp(-(0.0018·1200)²) ≈ 0.009` — ~99% opaque at the edge, so
nothing past 1200m would have been visible anyway.
**Rejected alternative**: donut-carving the LOD to only emit triangles
outside the chunk band. The LOD's only purpose was to extend the
visible horizon past 1200m, but fog at that distance makes any
contribution nearly invisible. Carrying the code path isn't worth it
at the current fog density.
**Apply**: if a future session wants an extended-horizon read (e.g.
the user wants to see distant terrain past 1200m), the right move is
EITHER a donut-carved LOD (vertex-aligned at the chunk-band boundary)
OR streaming chunks. Don't reintroduce the overlap-with-bias approach.

## D57 — Procgen POI rejection covers all salvageables, not just anchor POIs (Session HH)
**When**: Session HH (mid-flight bug-fix).
**Why**: First implementation passed only the 6 anchor POI coords to
`placeProcgenPOIs` as exclusion centers. Hero landmarks (15-20 wrecks
placed earlier in the boot) were NOT in the exclusion set, so a procgen
POI landed 2.2m from a hero-landmark engine_cluster — visibly
overlapping wrecks. Found by min-pair-distance check across the
salvageables registry post-boot.
**Fix**: main.ts collects ALL already-registered salvageable positions
(anchor POIs + hero landmarks + mega-ship/wreck parts) at the time
`placeProcgenPOIs` runs, and passes the combined list as the exclusion
centers. Procgen-vs-existing min separation is now 265m (above the
250m threshold).
**Apply**: future procgen placement layers must check against the LIVE
salvageables registry, not just the static anchor coord list. If
session ordering ever changes (e.g. hero landmarks placed AFTER
procgen POIs), the exclusion logic must be re-audited. Equivalent rule
holds for anything else with positional uniqueness — read the registry,
don't trust a static layout list.

## D58 — Cook animation driven by slot.meta.cookProgress, not a separate ctx state (Session II)
**When**: Session II — lizard-on-a-stick cooking.
**Why**: The held-cooking flow needs three things coordinated:
(a) interaction.ts owns the cook timer (started by aim-at-fire + E,
canceled if the slot changes or the player switches selection),
(b) viewModel.ts owns the per-frame held-item pose, (c) items.ts owns
the per-item animation shape. Three options for plumbing the cook
state from (a) to (b):
1. Add a `ctx.flags.cooking: { itemId, progress } | null`. Clean but
   adds a global field that has to be cleared on every cancel path.
2. Have viewModel.ts import + poll `getCookingState()` from
   interaction.ts. Couples two systems that otherwise don't talk.
3. Write progress directly onto `slot.meta.cookProgress` (a field
   already in `ItemMeta` from a discarded auto-cook attempt). Both
   tickCooking and the viewmodel read the slot; the slot is the
   shared bus.
**Pick**: (3). The cook progress is conceptually a property of the
slot being cooked (same way `fillLevel` is a property of a canteen
slot, `lit` of a torch). Cancel paths just clear the field. The
viewmodel doesn't import from interaction.ts. Each item declares its
own `playCookAnim(itemRoot, t)` so animation shape is colocated with
the item.
**Trade-off**: cook progress persists in the save schema (it's on
slot.meta). If a player saves mid-cook and reloads, the meat would
appear partially cooked on the held skewer but the cook timer in
interaction.ts wouldn't be running. Acceptable — the player can just
re-aim at a fire to resume cooking, and the partial progress is
preserved naturally. If this surfaces as a real bug, clear cookProgress
in saveGameState.

## D59 — Boot-time teleports of kinematic bodies use setTranslation, not setNextKinematicTranslation (Session JJ-2)
**When**: Session JJ-2 — opening-scene spawn bug fix.
**Why**: `setupOpeningScene` ran `playerBody.body.setNextKinematicTranslation({...})`
to teleport the player to the wreck entrance at boot. Rapier's
`setNextKinematicTranslation` SCHEDULES a translation that's applied
on the next physics step. The game boots PAUSED (title screen up,
`ctx.flags.titleActive`/`paused` both true). Physics doesn't step
while paused, so the scheduled teleport never applies. On NEW GAME
the player controller in `controller.ts` takes over: it reads the
body's current translation (still the placeholder from `makePlayer`,
i.e. world origin), computes its own desired translation (origin + 0
movement), and calls `setNextKinematicTranslation` itself —
overwriting whatever the opening scene had pending. Result: player
permanently spawned at (0, ground+capsule, 0), ~52m from the wreck.
**Fix**: use `setTranslation(pos, true)` — immediate, synchronous
write. The body's actual position is updated before any controller
tick reads it, so the controller's first tick reads the wreck-entrance
position and writes its own translation around that.
**Apply**: any future boot-time teleport of a kinematic body needs
`setTranslation` (immediate) NOT `setNextKinematicTranslation`
(scheduled). The latter only works once physics is actively stepping.
This includes future opening-scene variants, custom start positions,
debug spawn helpers — anywhere you want to place a body BEFORE the
controller has a chance to step.

## D60 — Anchor angled cylinders via geometry.translate, not manual rotation math (Session KK)
**When**: Session KK — wrecked satellite dish, the bent strut + broken
feed arm both ended up floating after rotation.
**Why**: When you want a cylinder (or any geo) to have ONE END at a
known anchor point and the other end pointing wherever the rotation
sends it, the naive approach is:
1. Compute the rotated +Y axis (the cylinder's long-axis direction
   after rotation) using sin/cos of the Euler angles.
2. Set `mesh.position = anchor + rotatedAxis * halfLength`.
3. Set `mesh.rotation = the_intended_Euler`.
This bit me TWICE in session KK because Three.js's XYZ Euler order
composes as `R_x * R_y * R_z` (Z applied first to the vector, then
Y, then X). My manual derivations both times used the wrong
composition order, leaving the anchor end ~1-2m offset from where I
expected. Visually = "floating piece next to base" or "broken arm
dangling away from feed horn."
**Fix**: skip the rotation math entirely. Use
`geometry.translate(0, halfLength, 0)` once, which moves the
cylinder's geometric origin to its BOTTOM end. Then
`mesh.position = anchor` and `mesh.rotation = anything` — the bottom
end stays at the anchor because that's where the mesh origin (and
hence the rotation pivot) sits.
**Apply**: any future "I want one end anchored, other end free to
rotate" pattern should use this trick. Don't try to compute rotated
axes — too easy to get the Euler order wrong, and you don't need to
care anyway.

## D61 — Satellite dish BURY_Y reduced to 1.0m so the doorway opens above grade (Session LL)
**When**: Session LL.
**Why**: KK shipped `BURY_Y = 2.5` which gave a dramatic "settled in
dunes" silhouette but trapped the 2.2m doorway opening 1.9m below
terrain (only ~0.3m of the lintel area peeked above ground). The
interior was geometrically unreachable from outside — verification at
KK ship time was synthetic (the player was teleported into the
shelter zone rather than walking through the door, so nobody noticed).
LL drops `BURY_Y` to 1.0m. New geometry: doorway sill 0.4m below
terrain (small step-down, character drops in naturally), interior
floor 0.7m below terrain, rim top ~3.7m above terrain. The PITCH +
ROLL whole-structure tilt continues to sell "settled in the desert"
character independently of bury depth — the bury depth was never
doing the heavy visual lifting that the tilt was.
**Why not shallower (0.5m)**: corner-float risk. With max PITCH+ROLL
of ~(13°, 8°), the high-tilt corner of the 8×8m base lifts ~1.3m
above baseGroup origin. At `BURY_Y = 0.5`, that high corner sits 0.8m
above terrain — a visible floater. At 1.0m bury the worst-case lift
is ~0.3m, hidden by the existing 9 apron sand mounds (each 0.7-1.2m
tall) placed at corners.
**Why not deeper bury + carved sand path into the entrance**: more
code, and the tilt sells the "settled" look on its own. Defer the
carved-path approach if a future POI specifically needs a more
dramatic bury (e.g., a "fully entombed" structure where the doorway
is meant to feel excavated).
**Apply**: any future POI that has an enterable doorway should
double-check the door's world-Y range *with the tilt + bury combined*
to confirm the opening clears terrain. The KK bug was a static-
analysis miss — bury looked fine in isolation, tilt looked fine in
isolation, but combined they buried the door.

## D62 — Terrain shader uses world-space normal + per-vertex biome attribute (Session MM-2)
**When**: Session MM-2.
**Why**: Two coupled bugs in the first terrain-shader pass that took
an embarrassingly long diagnostic loop to find:
1. **`vNormal` is view space.** Three.js's built-in `vNormal` varying
   is the normal post-`normalMatrix` multiply — i.e. view space.
   When the camera looked straight down at flat terrain, world up
   (0, 1, 0) became (0, ~0, ~1) in view space, so
   `smoothstep(0.86, 0.99, vNormal.y)` collapsed flatness to 0 and
   silently masked off cracks/ripples/any flatness-gated effect.
2. **Biome detection via interpolated vertex color is fragile.**
   `saltness = smoothstep(0.60, 0.82, diffuseColor.b)` worked away
   from biome boundaries but failed deep inside salt where adjacent
   vertices in the dune-salt blend zone dragged the interpolated B
   down to ~0.60. saltness → 0 → no cracks.
**Fix**: terrain shader now injects two project-owned channels:
- `vWorldNormal = normalize(mat3(modelMatrix) * normal)` for any
  slope-direction-based effects.
- `aBiomeRaw` per-vertex Float attribute (sampled from
  `biomes.rawAt(worldX, worldZ)` at mesh build) → `vBiomeRaw`
  varying for biome-strength detection. Threshold matches
  `BIOME_THRESHOLD_SALT ± BIOME_BLEND_WIDTH` so cracks ramp on
  exactly where the color blend ramps.
**Apply**: future shader work that needs world-space slope info, OR
classifies fragments by biome / region / surface type, should use
these patterns from the start. See
`memory/dustfall_shader_gotchas.md` for the full diagnostic-stack
pattern (4-step debug: vWorldPos → hash → noise primitive → each
mask) that would have caught this in 15 minutes instead of hours.

## D63 — Rocky biome character via scatter geometry, NOT a shader pattern (Session OO)
**When**: Session OO.
**Why**: First pass at rocky biome (OO-3) added a procedural shader
layer — Voronoi fissures + horizontal stratification bands + boulder
mottling — gated on `rockiness = 1.0 - smoothstep(-0.44, 0.0,
vBiomeRaw)`. The fissure pattern read TOO similarly to the salt-flat
desiccation cracks (MM polish work). Both produced polygonal cell
patterns with darkened edges, just at different scales and tints.
Standing on rocky terrain, you couldn't visually distinguish "rocky"
from "salt at a distance" without checking the biome tag.
**Fix**: Reverted the rocky-specific shader block entirely. Rocky
now inherits the sand-detail effects (gated on `1 - saltness` which
is 1 across rocky territory), giving rocky terrain the same grain +
ripple + wind-streak texture as dune. Differentiation now comes from
two sources: (a) the natural dark-brown rocky vertex color (already
in the biome palette), and (b) actual rock scatter geometry — 520
small IcosahedronGeometry rocks placed via new
`src/world/rockScatter.ts` (two size tiers, random rotation +
Y-flatten, no colliders). Rocky biome NOW reads as: "sand-like
ground with rocks strewn across it." Visually distinct from salt
("crackled flat with wells") and dune ("smooth dunes with ripples").
**Apply**: when a procedural shader pattern collides visually with
another biome's pattern (regardless of palette / scale tweaks), pivot
to a DIFFERENT modality — scatter geometry, vertex color shift, audio
cue, distinct light treatment, etc. Don't try to push two similar
shader patterns to be "different enough" via parameter tuning; the
underlying grammar is the same so they'll always read related.

## D64 — Dev-mode rAF fallback to setTimeout when document.hidden (Session PP)
**When**: Session PP.
**Why**: Browsers throttle `requestAnimationFrame` to ~1Hz (or pause it
entirely) when `document.hidden = true`. The Claude_Preview MCP tool
runs the game in a hidden iframe — so the per-frame tick runs at 1Hz
instead of 60Hz, and combat / physics / weather / lighting all
effectively freeze. Verifying combat logic (mouse press →
updateCombat fires → ammo decrements → damage applies) was impossible
in the preview environment across NN, OO and the first part of PP.
Spoofing `document.hidden = false` via `Object.defineProperty` does
NOT trick the browser's underlying visibility tracking; the throttle
sits below user-space.
**Fix**: in `core/loop.ts`, the next-frame scheduler now picks
between rAF and `setTimeout(16)` based on visibility:
```ts
function scheduleFrame(cb): void {
  if (import.meta.env.DEV && document.hidden) setTimeout(cb, 16);
  else requestAnimationFrame(cb);
}
```
`setTimeout` is not throttled in hidden tabs (unless the page is
fully backgrounded for several minutes, at which point browsers
start throttling timers to 1Hz — but that's well past our
verification windows).
**Production untouched**: `import.meta.env.DEV` gates the fallback
out of `vite build` output. Real players see real rAF behavior —
when their tab is hidden, the game pauses to save CPU/battery,
which is the right behavior.
**Apply**: future preview-env shenanigans (verification tools that
need the game loop to run while the browser thinks the tab is
hidden) should follow this pattern — guard with `import.meta.env
.DEV` and use a wall-clock timer fallback that the browser doesn't
throttle.


## D65 — Sled tow uses one-way spring-damper, no Rapier joints (Session QQ)
**When**: Session QQ.
**Why**: A towed sled needs to follow either the player capsule
(kinematic) or the speeder (dynamic) at a fixed offset. Three
candidate approaches existed: (a) RAPIER fixed/distance joints,
(b) two-way spring-damper between both bodies, (c) one-way
spring-damper applied to the sled only. Joints were ruled out
because they are not used anywhere else in the codebase
(velocity-follow is the idiom across raiders/lizards/speeder
hover) — introducing the dependency just for the sled would
fragment the physics surface. Two-way force was ruled out
because the speeder is a dynamic body with its own PD hover
controller — coupling sled back-reaction into the speeder
would either oscillate or fight the hover loop, and the player
capsule is kinematic so back-reaction on it is undefined anyway.
**Decision**: One-way spring-damper impulse on the sled body
only, per frame in `updateSleds`:
`force = errVec * SLED_TOW_SPRING_K - sledVel * SLED_TOW_SPRING_DAMP`;
`body.applyImpulse(force * dt)`. Speeder/player feels no
back-reaction; sled accelerates toward a target pos behind the
tether. `applyImpulse` (not `setLinvel`) so gravity, terrain
contact, and contacts from other bodies still apply normally.
Snap-distance auto-detach (`SLED_TOW_MAX_DIST = 8m`) prevents
unrecoverable separation if the speeder boosts through a wreck.
**Apply**: future tethered entities (companion creatures,
chained sleds, lanterns swinging from a hook) should follow
the same pattern — apply force to the dependent body only,
no joints, mass tuned so the dependent feels weighty without
slowing the puller.

## D66 — Static-friction stiction in physics tow: K must exceed μmg (Session QQ)
**When**: Session QQ.
**Why**: First sled tuning pass used K=90, friction=0.8. The
sled body's mass ≈ ρV ≈ 30 × (1.0×0.2×1.8) = 10.8 kg. Static
friction ceiling = μ × m × g = 0.8 × 10.8 × 9.81 ≈ 85 N.
Spring force at a 0.7m settle gap = 90 × 0.7 = 63 N. **Less
than the friction ceiling** → the sled refused to move at
small errors, settling at ~4m past target instead of catching
up to the 3m offset. The simulation showed velocity dropping
toward zero and the body locked in place, while the spring
math said force was being applied.
**Fix**: dropped collider friction to 0.25 (sleds glide on
dunes) AND bumped spring K to 220, damp to 28. New static
ceiling = 0.25 × 10.8 × 9.81 = 26.5 N. Spring at 0.5m err =
110 N — 4× the friction ceiling, so the body slides.
**Apply**: for any spring-driven dynamic body resting on
terrain, sanity-check `spring_K * typical_err > μ * m * g`
BEFORE tuning damping. If the body sits on the ground with
friction, static friction is the dominant failure mode at
small errors — not damping or damping-overshoot. Inspect the
trace: if velocity drops to ~0 with non-zero spring force,
it's stiction, not overdamping.
