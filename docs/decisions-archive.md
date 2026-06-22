# Decisions — archive (D1–D220)

Older decisions split out to keep the active `decisions.md` lean — D1–D87 on 2026-05-31, D88–D188 on 2026-06-17, D189–D206 on 2026-06-20, D207–D220 on 2026-06-22. Preserved verbatim; D-numbers are never reused, so cross-references (e.g. "D14") resolve here and stay grep-able. See `decisions.md` for recent entries and the friction-score legend.

---

## D1 — Browser-first runtime (Three.js + TS + Vite)
**When**: Session A.
**Why**: Zero-install for the player, hot iterate in the browser, ship a
URL. Procedural Web Audio + GLTF + Rapier all run cleanly in the same page.
Migrating to Godot / Unity / Bevy gives no FPS headroom that hardware-
accelerated Chrome doesn't already have (see `architecture.md` perf notes).
**friction-score:** 5

## D2 — Rapier for physics, not custom
**When**: Session A.
**Why**: Kinematic character controller + heightfield collider + raycasts
out of the box. Building these from scratch would be a multi-week detour.
Trade-off: WASM bundle is ~500 KB.
**friction-score:** 5

## D3 — Procedural Web Audio, no sample files
**When**: Session C.
**Why**: Keeps the bundle tiny (no audio assets). Every sfx is a function
in `src/audio/audio.ts` that synthesises via filtered noise + oscillator
nodes. Easy to A/B feel by tweaking envelope numbers.
**friction-score:** 4

## D4 — Magic numbers go in `tuning.ts` only
**When**: Session A (rule), reinforced every session.
**Why**: Game-feel iteration is "tweak number → reload → feel". Numbers
sprinkled across files make this exhausting. One file = one place to
search.
**friction-score:** 4

## D5 — `GameContext` is the spine, not arg-passing
**When**: Session A.
**Why**: A 3D survival game touches every subsystem from every other.
Threading params through call chains becomes spaghetti. One `ctx` object
on every `init` and `update`.
**friction-score:** 5

## D6 — Rejected Kenney asset packs ("too cartoony")
**When**: Session P.
**Why**: The user wants Dune / Mad Max tone. Kenney's low-poly survival
pack reads as gamey, not bleak. Drove the **D7 barren-desert pivot**.
**friction-score:** 2

## D7 — Barren-desert tonal pivot
**When**: Session P.
**Why**: Empty world + distant POIs reads more like Dune than scattered
clutter. Removed 134 rocks/trunks + truck wreck + standalone loot crates.
Replaced with ridged dunes + biomes + perimeter mountains + hand-placed
hero landmarks.
**friction-score:** 4

## D8 — Sci-fi scavenger pivot
**When**: Session S.
**Why**: After P shipped, the user picked a Jakku scavenger fantasy as the
populated layer on the barren desert. Half-buried hulls become the
recognisable silhouettes; replaced ribcage/obelisk/tower with crashed-ship
wrecks as everyday landmarks.
**friction-score:** 3

## D9 — Salvageables are finite (drives exploration economy)
**When**: Session T.
**Why**: Wrecks as pure scenery were a dead end. Giving each wreck a
`salvageRemaining` counter (2-3 hero, 4-6 massive) ties art to mechanics:
walking to a wreck rewards you, but only finitely. Combined with wells
(thirst) this gives the survival loop its full economy.
**friction-score:** 3

## D10 — Single-slot save, no death autosave
**When**: Session M.
**Why**: One `localStorage['dustfall.save.v1']` slot keeps the UI simple
(single Continue button on the start overlay). **No autosave on death** —
dying means you load your last save or start a new run. Matches the
Long Dark / DayZ contract. Sleep is the natural autosave point.
**friction-score:** 3

## D11 — Confirm on New-Game-while-save-exists
**When**: Session M (post-ship adjustment).
**Why**: First version of M silently kept the old save until first
overwrite. User identified the footgun: click New Game by accident,
sleep once, old run is gone. Inline `[yes, new game] / [cancel]` prompt
fires only when `hasSave()`.
**friction-score:** 1

## D12 — GOD_MODE stays on through Session M
**When**: Sessions A–M.
**Why**: Iterating game feel requires not dying constantly. `Tuning.GOD_MODE`
in `tuning.ts` floors stats in `die()` so the player survives. Will flip
off when balance tuning starts (post-O / win-condition session).
**friction-score:** 1

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
**friction-score:** 5

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
**friction-score:** 2

## D15 — Opening wreck is intentionally non-salvageable
**When**: Session W.
**Why**: The wreck in the opening scene contains the dead survivor + their
journal. It's a story prop, not a loop entry. Players spend Day 1 there;
giving them scrap reward for stripping it down would conflict with the
"this was someone's last shelter" tone. So it's the ONE wreck in the world
not registered in the salvageables registry. All other wrecks (registered
via `salvage.ts` in T) still salvage normally. If we later want it
salvageable, just register it in `openingScene.ts`.
**friction-score:** 3

## D16 — Fog: near and far BOTH move with storm intensity
**When**: Session W bugfix.
**Why**: First storm-fog pass moved only `fog.far` down (to 22 m at peak)
while leaving `Tuning.FOG_NEAR` at 25. Three.js linear fog math
`(dist - near) / (far - near)` inverts when `far < near` — every visible
surface clamped to full fog color, painting the wreck and surroundings
red-brown even at 12 m distance. Fix: at peak storm, `fog.near = 15`,
`fog.far = 30` — math stays sane, fog still feels claustrophobic. Going
forward, always pair fog far + near changes; never let one cross the other.
**friction-score:** 1

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
**friction-score:** 4

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
**friction-score:** 1

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
**friction-score:** 4

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
**friction-score:** 1

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
**friction-score:** 2

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
**friction-score:** 3

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
**friction-score:** 3

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
**friction-score:** 2

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
**friction-score:** 3

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
**friction-score:** 2

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
**friction-score:** 2

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
**friction-score:** 2

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
**friction-score:** 2

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
**friction-score:** 3

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
**friction-score:** 3

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
**friction-score:** 4

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
**friction-score:** 3

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
**friction-score:** 3

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
**friction-score:** 2

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
**friction-score:** 3

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
**friction-score:** 2

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
**friction-score:** 3

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
**friction-score:** 3

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
**friction-score:** 3

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
**friction-score:** 3

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
**friction-score:** 2

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
**friction-score:** 4

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
**friction-score:** 2

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
**friction-score:** 2

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
**friction-score:** 2

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
**friction-score:** 1

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
**friction-score:** 4

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
**friction-score:** 3

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
**friction-score:** 4

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
**friction-score:** 4

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
**friction-score:** 3

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
**friction-score:** 3

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
**friction-score:** 3

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
**friction-score:** 3

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
**friction-score:** 3

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
**friction-score:** 3

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
**friction-score:** 3

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
**friction-score:** 3

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
**friction-score:** 3

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
**friction-score:** 2

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
**friction-score:** 4

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
**friction-score:** 3

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
**friction-score:** 4

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
**friction-score:** 3

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
**friction-score:** 2

## D67 — Inextensible rope constraint replaces spring-damper (Session QQ-2; supersedes D65)
**When**: Session QQ-2.
**Why**: D65's one-way spring-damper produced the right velocity-
follow behavior on paper but felt wrong in play: the rope was
visibly elastic (sled bouncing toward the anchor on slack), the
sled rotated freely around the player as the spring pulled it from
the body center, and small static-friction tweaks (D66) only
masked the elasticity issue. The user's playtest feedback was
"rope very elastic, sled spins around character and moves
erratically — we need realistic rope pulling metal sled on sand".
The spring model fundamentally cannot represent an inextensible
rope: any spring with finite stiffness will stretch.
**Decision**: Replace the spring impulse with a hard constraint.
Per frame, measure `dist(anchor, sled_attach_point)`. If `<=
SLED_TOW_DISTANCE`: rope is slack, no force applied — sand
friction holds the sled in place. If `>`:
  1. **Position-snap**: translate the sled body inward by the
     stretch amount (`body.setTranslation(...)`), enforcing the
     rope length exactly.
  2. **Velocity-correct**: project out the outward radial
     component of the sled's linear velocity (only when
     `vDotU < 0`), so the constraint also prevents the sled from
     accelerating away from the anchor.
This is the standard impulse-based rope-constraint approach (cf.
XPBD) implemented manually because Rapier doesn't expose XPBD
joints + we don't want a dependency on its joint API for one
mechanic.

**Companion changes that make the constraint stable**:
- `body.setEnabledRotations(false, false, false, true)` — the
  sled body cannot rotate from physics forces. Visual yaw is
  managed manually via `group.rotation.y` lerping toward "face the
  anchor" each frame. This kills the "spinning around the puller"
  failure mode entirely.
- Friction back to 0.6 (was dropped to 0.25 under D66). Static
  friction now correctly holds slack-rope sleds in place — without
  the spring, there's no force fighting friction at small errors.
- Rope length 3 → 5m, so the slack zone is visibly readable.
- Rope visual replaced with `TubeGeometry` along a `CatmullRomCurve3`
  with mid-point sag scaled by slack — taut rope = straight,
  slack rope = parabolic drop.

**Apply**: when a tether's "feel" matters (rope, chain, leash,
fixed-length cable), prefer position-based constraints over
spring models. Springs are great for soft-bodies and bumpers, not
ropes. The two cheap stabilizers — locked rotation + manual visual
yaw — should always travel with this constraint pattern for body
shapes longer than their width.
**friction-score:** 4

## D68 — Angular-slice LatheGeometry for "lathe with holes" (Session RR)
**When**: Session RR.
**Why**: The opening wreck redo needed "light-shaft holes baked into
the geometry" (per user direction) on a tapered curved hull. Three
candidate approaches: (a) CSG subtraction of hole-shapes from a
single full lathe — heavy, introduces a CSG library dependency
just for one mesh; (b) flat-panel approximation via `panelWithHole`
giving up the curve on the upper hull — visually inconsistent with
the rest of the wreck; (c) **build the lathe as N angular slices
(`phiStart` + `phiLength` < 2π each) and omit specific slices for
holes** — keeps the curved silhouette intact for present slices,
gives genuine empty space where slices are missing, no dependencies.
**Decision**: Approach (c). Implementation pattern:
```ts
const sliceArc = (Math.PI * 2) / SLICE_COUNT;
for (let i = 0; i < SLICE_COUNT; i++) {
  if (i === SKYLIGHT_SLICE || i === SKYLIGHT_SLICE + 1) continue;
  const phiStart = i * sliceArc;
  const geo = new THREE.LatheGeometry(profile, segments, phiStart, sliceArc);
  group.add(new THREE.Mesh(geo, material));
}
```
With SLICE_COUNT=24 (15° per slice), skipping two adjacent slices
gives a 30° gap that aligns symmetrically with true vertical when
the SKYLIGHT_SLICE boundary lands on the world-UP angle (phi=270°
in lathe-local under our X=+π/2 group rotation).
**Mid-impl gotcha**: lathe-local axis directions are NOT the same as
world directions after the group's rotation. Under our convention
(`group.rotation.x = +π/2`, mapping lathe local +Y → world +Z),
lathe-local +Z lands at world -Y and lathe-local -Z at world +Y.
"World UP" corresponds to lathe-local phi=-π/2 (= 3π/2). Any detail
mesh placed in lathe-local coordinates (cockpit windows, breach
patches) must be authored with these angles in mind — first
implementation had breach patches at lathe-phi ∈ [π/4, 3π/4]
thinking they were "side flanks" when they were actually mapping
to world-Y near zero on one side and below-floor on the other.
**Apply**: future modules that need partial-coverage lathes (rib
sections, broken hull pieces, partial domes) should use this
pattern. Avoid mixing lathe-local and parent-group-local angle
conventions in the same function — pick one and stick to it,
ideally placing all detail meshes in the SAME coordinate space
the lathe slices use (then the angles transfer directly).
Alternative simpler approach when curve fidelity matters less:
author the wreck in wreck-local space throughout and skip the
group-rotation gymnastics — `RotateZ(profile)` baked into the
geometry at construction time would have avoided the axis confusion
entirely.
**friction-score:** 4


## D69 — Enterable lathe wrecks need `side: DoubleSide` on hull materials (Session SS)
**When**: Session SS — caught while playtesting the RR opening-wreck
rebuild from an interior camera position.
**Why**: `createRustedHullMaterial` (Session OO) builds a
`MeshLambertMaterial` which defaults to `side: FrontSide`. For
non-enterable wrecks (crashedHull, satelliteDish, engineBlock) this
is correct — the player never sees the hull from inside, and
FrontSide cuts fragment-shader cost by half. But the opening wreck
is **enterable**: a player walks into the cockpit through the torn
rear. From an interior position, FrontSide back-face-culls the
inside of the lathe slices → the cockpit renders as "open desert +
floating debris" with the wall material completely absent. RR's
verification missed this because all screenshots were eval-driven
from external camera positions; the first interior render under SS
exposed it immediately.
**Decision**: enterable wrecks set both `material.side =
THREE.DoubleSide` (so interior surfaces render) AND `material.shadowSide
= THREE.FrontSide` (so shadows project from the outer surface only,
not from the inside hull surface casting back into the cavity).
Currently the only enterable lathe-based wreck. Future flagship
wrecks that become enterable (e.g., a larger transport-pod redesign,
a satellite-dish-interior session) MUST set both flags or the
interior will render hollow.
**Considered alternatives**: (a) clone the materials per-mesh and
set per-slice — over-engineered for a shared hull aesthetic; (b)
use `BackSide` instead of `DoubleSide` and add a second inner
lathe for the inside surface — doubles geometry cost; (c) use a
`Group` of multiple lathe arcs with explicit front/back face mat
pairs — fragile and hard to maintain.
**Apply**: also relevant for future enterable shapes built from
single-sided lathe / cylinder / cone geometries (cockpits, hatches,
domes, tubes). If a player can ever stand INSIDE the volume bounded
by the surface, set both `side` and `shadowSide` flags.
**friction-score:** 3

## D70 — Combine-to-discover replaces explicit recipe list (Session TT)
**When**: Session TT.
**Why**: The Session G `RECIPES` array shipped as an explicit list:
each recipe had its own row in the crafting UI, showing the output
plus the ingredient counts; the player saw every possible craft from
day one. By Session QQ-2 the list had grown to 9 recipes and was
already feeling bloated per user direction ("current list is getting
bloated... should move away from the current list of recipes and
more to a combining different items together to discover new recipes
system"). The explicit-list model has two problems: (a) zero
discovery feel — the player knows everything upfront, robbing the
moment of "I wonder if I can combine these?", and (b) UI grows
linearly with recipe count.
**Decision**: Replace the list UI with a **combine-to-discover**
model. 4 input slots (multiset, order-insensitive). Output preview
shows `?` for valid-but-undiscovered combinations, the actual output
icon for discovered ones, "nothing happens" for invalid combinations.
Clicking CRAFT consumes inputs + produces output + (if first time)
adds the recipe id to `inventory.discoveredRecipes`. Pillars enforced:
the 9 seed recipes stay tight per D7/D9/D13 — discovery feel matters
more than recipe count. Future sessions add recipes by appending to
the `RECIPES` array with the next stable numeric id.
**Considered alternatives**:
- Hybrid (combine-mode + a "recipe book" panel showing discovered
  recipes for reference) — deferred to stretch goal status; could
  ship in a follow-up session if the discovery-only mode feels too
  opaque.
- Minecraft-style 3×3 grid — rejected as too positional / fiddly for
  Dustfall's tone. Flat multiset matches the survival-game pattern
  better.
- Auto-discovery (recipes unlock when the player owns all required
  items) — rejected because it strips the "I tried something" agency
  that's the whole point.
**Apply**: when adding a new recipe in a future session, just append
to `RECIPES` in `src/inventory/recipeDiscovery.ts` with the next
unused numeric id. The UI auto-picks it up; save/load handles it via
the existing `discoveredRecipes` ledger.
**friction-score:** 3

## D71 — Recipe id stability rule (never reuse, never renumber) (Session TT)
**When**: Session TT.
**Why**: `inventory.discoveredRecipes: number[]` is persisted in
save format v6. If a recipe is removed in a future session and its
id is reused for a different recipe, EVERY existing save's
"discovered" ledger would silently mean a different thing — the
player would have rope marked discovered but the recipe id 8 might
now point at "explosive charge" or whatever. Subtle, hard to detect,
breaks the trust contract of save files.
**Decision**: Recipe ids are STABLE. Once assigned, an id is never
reused even if the recipe is retired. New recipes get the next-highest
unused id. To remove a recipe: comment it out of `RECIPES` but
preserve the id slot. If a recipe is materially CHANGED (different
inputs or output), bump it to a new id and leave the old one as a
no-op (or removed entirely + tombstoned in code comments).
**Considered alternatives**:
- String ids (`'rope'`, `'tent_kit'`) — more readable in save inspection
  but every recipe rename then has the same cross-save-breakage risk,
  with the additional pitfall of string typos.
- Hash of canonical input key as id — collision risk; if two recipes
  ever collide in the multiset (the chooser case the system supports),
  they'd have the same hash.
- Migrate ids on every save load — pushes complexity into the loader;
  one bug in migration logic corrupts every save.
**Apply**: when editing `RECIPES`, never change the `id` field of an
existing entry. The numeric ids are the save schema, just like
column names in a SQL table.
**friction-score:** 4

## D72 — Crafting discovery is gated on successful output addition (Session TT)
**When**: Session TT (discovered during eval-driven playtest).
**Why**: The first playtest run hit a non-obvious edge case:
`DEBUG_STARTER_LOADOUT` fills all 14 inventory slots, so `addItem`
returned -1 when trying to add the crafted rope. The `performCraft`
function correctly refunded the consumed cloth + branch back to the
player's inventory — but the question was whether to ALSO mark the
recipe as discovered. Two interpretations:
(a) The player tried the combination + saw what would happen, so it
counts as a discovery. Mark discovered + skip the output.
(b) The craft didn't actually complete (no output was produced), so
no discovery — try again when you have room.
**Decision**: (b). Discovery is gated on `addItem returning ≥ 0`. If
the output couldn't be added, the inputs are refunded AND the recipe
stays undiscovered. Rationale: discovery is a moment of CONFIRMATION
("I made this thing"); a failed craft is the universe rejecting
your attempt, not granting you knowledge of a recipe you didn't
actually produce. The player has to retry when they have room.
**Apply**: any future craft-adjacent system (cooking, salvaging,
infusing, etc.) that marks "discovered" state should similarly gate
on successful output side-effect, not on input matching. The
canonical pattern: `consume inputs → try produce output → if
success, mark discovered; if failure, refund inputs + skip
discovery + toast`.
**friction-score:** 2

## D73 — `wieldAction.ts` as the sole LMB-while-wielded dispatcher (Session UU)
**When**: Session UU.
**Why**: Pre-UU, LMB handling was scattered: `combat.ts` read
`mousePressed.has(0)` directly for weapons; `interaction.ts` read it
for the rope-on-sled attach case; `inventory.ts`'s Q-key path
indirectly drove canteen drinking + kit deployment. Extending this
pattern to support LMB-place + LMB-pickup-take + hold-LMB-drinking
would have meant editing 3+ files PLUS each per-item `onUse` —
linear blast radius. The new `wieldAction.ts` centralizes ALL
LMB-while-wielded dispatch in one file. All gates (overlay-open,
speeder-mounted, isPlaying) live there. `updateCombat` is now
delegated FROM wieldAction (and removed from `main.ts`'s tick).
**Considered alternatives**:
- Extend each item's `onUse` with LMB semantics — scatters logic
  across 25 items, footgun risk scales linearly.
- Make `updateCombat` the dispatcher and add place/pickup paths to
  it — pollutes a module that should stay weapons-only.
- A `Map<ItemId, LMBHandler>` registry outside ItemDef — fine but
  duplicates the indexing that already happens via `getItemDef`.
**Apply**: future LMB behaviors (RMB for UU-2, charge-and-throw,
etc.) land in `wieldAction.ts`'s switch, not new modules. New gates
(e.g., "while sleeping" if that's ever a thing) get added once in
`updateWieldAction`'s early-return block.
**friction-score:** 4

## D74 — `wieldLmb` field on ItemDef (Session UU)
**When**: Session UU.
**Why**: wieldAction.ts needs to know what LMB does for each item.
Options were a Map<ItemId, behavior> registry (extrinsic) or a field
on ItemDef (intrinsic). Intrinsic wins because: (1) per-item LMB
behavior lives next to the per-item `onUse` / `makeViewModel` etc. —
one place to read all behavior of an item; (2) adding a new item
involves declaring its full behavior in one block, including LMB —
the registry pattern would silently default the LMB handling and
the new item would have surprising-default behavior; (3) the type
union (`'attack' | 'place' | 'hold_use' | 'click_use' | 'none'`)
makes the system exhaustively switchable. Default `'click_use'`
chosen so items not yet annotated keep working (pickup-take still
fires for them; Q still drives onUse).
**Considered alternatives**:
- Bit flags (attack + can-place + ...) — over-engineered for 5
  mutually-exclusive behaviors.
- Per-item callback `onLmb?(ctx, slot, isHeld, dt)` — gives max
  flexibility but loses the centralization win (each callback can
  do anything; can't audit the LMB surface area).
**Apply**: new items declare `wieldLmb` explicitly when their LMB
behavior differs from `click_use`. The `hold_use` path uses the
companion `onHoldTick` hook on ItemDef. The `place` path reuses
`onUse` (no separate `onPlace` — kits already do their work in
onUse).
**friction-score:** 3

## D75 — `Tuning.PLACEMENT_DISTANCE_M = 2.2` (Session UU)
**When**: Session UU.
**Why**: Pre-UU, `fire.ts` placed at 1.5m, `tent.ts` at 2.2m,
`sled.ts` at 2.2m. Three hardcoded local constants for the same
concept. Tents and sleds felt right; fires placed slightly too
close — they'd spawn at the edge of the player's collider. UU's
LMB-place was an opportunity to unify: all kits now deploy at 2.2m
(just outside arm's reach, at the edge of the fire's shelter
zone). Fire's 1.5 → 2.2 is a perceptible feel change; documented
here so future tuning sessions know the constants were intentionally
unified. Local constants in fire.ts/tent.ts/sled.ts deploy paths
were lifted to this single Tuning constant.
**Apply**: any new placeable kit (large_tent_kit in XX, future
shelter types) uses `Tuning.PLACEMENT_DISTANCE_M` — do not introduce
local placement distances.
**friction-score:** 1

## D76 — fire + tent constants migrated to tuning.ts (Session VV)
**When**: Session VV.
**Why**: CLAUDE.md rule says "Magic numbers → tuning.ts ONLY".
`src/world/fire.ts` had 5 local constants pre-VV (fuel seconds,
shelter radius/height, near-fire reject distance); `src/world/tent.ts`
had 2 (shelter half-extents, near-tent reject distance). Both were
in violation. VV's palette-cleanser slot was a natural opportunity
to fix without scope risk. Values preserved exactly — pure refactor.
**Apply**: when adding new world entities (XX's large tent etc.),
declare constants in `tuning.ts` from the start. Don't ship local
constants as "placeholder" expecting to lift later — the lift never
happens unless explicitly scoped (like VV did).
**friction-score:** 0

## D77 — RMB as additive power-user verb (Session UU-2)
**When**: Session UU-2.
**Why**: After UU shipped the LMB-leaning scheme, two power-user
actions had no clean home: tent pack-up and speeder-tethered sled
rope release. Adding them to the E menu would have made E feel
overloaded again (the very thing UU just fixed). Adding new keyboard
keys would have grown the binding sheet without proportional
ergonomic value. RMB as a context-action verb is the natural third
button: same hover-state dispatch as LMB-take, different button.
The dispatcher lives in `wieldAction.ts`'s `handleContextAction()` —
inherits ALL UU gates (overlay, mounted, isPlaying) automatically.
**Considered alternatives**:
- Long-press E for pack-up (à la inventory weight-drop in some
  survival games) — clashes with the existing salvage 1.5s E-hold;
  player can't tell which E-hold they're doing.
- Combo keys (Shift+E to pack) — keyboard-shortcut bloat.
- A "tent menu" UI on E (with sleep/pack/cancel options) — extra UI
  layer for what should be a single-click action.
**Apply**: future power-user verbs (any "take back what you placed"
or "release what you tethered" semantic) land in `handleContextAction`.
The hover-state dispatch is the pattern; the hover.type discriminates.
**friction-score:** 2

## D78 — Stat vignettes as CSS overlay, not in-scene shader (Session WW)
**When**: Session WW.
**Why**: `stormVignette.ts` is an in-scene ShaderMaterial because the
storm is atmosphere — it composites with the world AND tone-maps with
the renderer. Stat vignettes are HUD-tier: they're a UI warning, not
part of the world. CSS divs with radial-gradient backgrounds + opacity
tweens are cheaper (no shader draw call, no scene graph node) and
correct for the HUD tier (overlay the screen post-render, no tone
mapping). Also a pure-clone approach — separate file, no abstraction
attempt to unify storm + stat into a "vignette manager" for 3 callers
(would have been premature).
**Considered alternatives**:
- Clone the in-scene shader path — gets free tone-mapping but is
  overkill for a HUD warning, and would compete with stormVignette
  for the same fullscreen quad slot.
- Single shader with multi-channel uniforms (storm + cold + thirst
  in one pass) — couples three independent systems; any change to
  one ripples to the shader.
- Three.js post-processing pipeline (EffectComposer) — heavy
  dependency for what is fundamentally screen-space CSS.
**Apply**: future HUD-tier warnings (health-low pulse, low-fuel-on-
speeder tint) follow the CSS-overlay pattern; atmosphere-tier
effects (storm vignette, mirage shader) follow the in-scene shader
pattern.
**friction-score:** 1

## D80 — `largeTent.ts` as a distinct module, not a parameterized `tent.ts` (Session XX)
**When**: Session XX.
**Why**: The straightforward refactor when adding a tent variant
would be `tent.ts` parameterized by a `kind: 'small' | 'large'` arg
threaded through `deployTent` / `spawnTentAt` / `packUpTent`. But
the collider geometry diverges substantially: small tent is a
double-pyramid with two angled wall panels and no real interior;
large tent is a 3-walled cabin with a roof and 4 corner posts and a
walk-in cavity. The shelter-zone math differs too (small tent zone
covers the footprint approximating; large tent zone covers ONLY the
interior cavity since "inside the tent" matters). Forcing both into
one parameterized function would either bloat the function with
branches OR ship a degenerate "large pyramid" that doesn't fit the
walk-in spec. Two modules with shared types (LargeTent shaped like
Tent) is cheaper for the lifetime of the code than the abstraction.
**Considered alternatives**:
- `kind`-parameterized `tent.ts` — see above.
- Inheritance / class hierarchy — overkill for two cases.
- Shared base function + per-kind specializers — reasonable but
  more indirection than three callers (deploy / spawn / pack)
  warrant.
**Apply**: if a THIRD tent variant ships (e.g., a tarp lean-to),
revisit this call. With three callers + 2-3 divergent geometry
parameters, a shared builder might pay off. With 2, keep the
clone-not-abstract pattern (matches D78 for vignettes).
**friction-score:** 2

## D81 — `SAVE_VERSION 6 → 7`, additive only (Session XX)
**When**: Session XX.
**Why**: XX added a new world entity (large tents) that the player
can place + the save must restore. The save schema needed a new
field. The migration is **strictly additive**: a new optional
`largeTents?: Array<...>` on `SaveV1`. Existing fields are untouched.
Pre-v7 saves load with `largeTents === undefined` → loader treats
as empty array. No data loss on either direction.
**Apply**: future save migrations follow this discipline. Never
rearrange existing fields, never remove fields without a deprecation
path, always make new fields optional + provide a default on load.
The SAVE_VERSION bump is a tooling marker (tells external tools
"this save has the new field if you need it"); the loader's
backward-compat code is what actually matters. Pre-XX, the loader
already supported v1-v6 cleanly via this exact pattern (sleds
optional, discoveredRecipes optional w/ seeded default). XX inherits
the contract; future sessions inherit it from XX. D71 (recipe id
stability) is a related principle: never break the meaning of
existing data.
**friction-score:** 3

## D79 — `weather.perceivedIntensity` split from `intensity` (Session YY)
**When**: Session YY (was reserved as a placeholder in the XX plan;
this entry actualizes the call).
**Why**: Pre-YY, the storm-visual systems (dust + vignette) used a
binary `ctx.player.inShelter` check to suppress themselves entirely
when the player was inside any shelter zone. XX added a walk-in
large tent (open front face); binary suppression made the inside-
the-tent experience feel wrong — you'd expect to see SOME storm
through the open front. The split: `intensity` stays the authoritative
world-truth value (drives fog density, thirst drain rate, AI
triggers — things the world itself "knows"); a new
`perceivedIntensity` field tracks the player-context-aware version
(drives dust opacity + screen vignette — things the player's
senses report). `updateShelter` writes perceivedIntensity each
frame: full intensity if not sheltered; 0 if inside a fully-enclosed
shelter (small tent / fire); `intensity * LARGE_TENT_STORM_DAMPEN`
if inside a "partial" shelter (only large tents currently). The
small tent + fire keep their legacy zero-out feel; the large tent
shows ~40% storm presence — you're sheltered, you can see it, the
contrast sells the shelter feel.
**Considered alternatives**:
- Tag dust + vignette per-tier and have them each read their own
  conditional logic — scatters the rule across modules. Centralizing
  in updateShelter keeps the contract in one place.
- Run dust ramps off `intensity` and add a "muffle" multiplier in
  each dust layer — same scatter problem.
- Per-shelter-zone `dampenMultiplier: number` — over-engineered for
  the current 2 categories (fully enclosed vs. partial). If a third
  shelter type ships (cave with opening, ruin with collapsed roof),
  revisit.
**Apply**: future shelter types declare their `isLargeTent?` flag
(misnomer if more types come; rename to `dampenFactor?` then).
Visual-only systems read `perceivedIntensity`; world-truth systems
read `intensity`. Audio could go either way — currently on `intensity`;
moving it to `perceivedIntensity` would make wind sound dampen
inside the large tent (probably desirable as a future polish item).
**friction-score:** 2

## D82 — Flagship POIs unified into the rejection sampler (Session AAI)
**When**: Session AAI.
**Why**: Pre-AAI, six flagship POIs (engine_block, camp, satellite_dish,
crashed_hull, mega_ship, mega_wreck) had hardcoded coordinates in
`poi.ts:147-154` while procgen wrecks went through a rejection sampler in
`procgenPoi.ts`. Two placement paths meant flagship+procgen min-separation
broke whenever seeds shuffled — the procgen layer correctly avoided
flagships (it knew their coords), but the flagships couldn't move per-seed
at all. Unified catalog (`FLAGSHIP_KINDS` + `sampleFlagshipPositions`)
gives one source of placement truth: flagships go through the same
Poisson-disk-character sampler as procgen wrecks. Procgen wrecks then
receive the placed flagship positions as exclusion seeds, so the entire
wreck layout is rejection-sampled together and consistent under any seed.
**Considered alternatives**:
- Keep flagship coords hardcoded, only randomize procgen wrecks +
  scatter. Smallest scope. Rejected: scope-cut-5 fallback, not first
  choice — leaves the "different worlds" feel weak because the most
  iconic landmarks always sit at the same spots.
- Per-kind constraint records (flag tag for "must be on flat ground",
  "must be in dune biome", etc.). Over-engineered for 6 kinds; the
  existing per-kind dispatch code in `placePOIs` already handles its
  own flat-spot drift inside each spawn fn (mega_ship/mega_wreck do
  their own search). Constraints stay inline.
**Apply**: future flagship additions land in `FLAGSHIP_KINDS` array.
The rejection sampler honors `POI_MIN_SEPARATION` between flagships
and `PLAYER_SPAWN_EXCLUSION_RADIUS` from the opening anchor.
**friction-score:** 2

## D83 — Opening scene is seed-stable as narrative anchor (Session AAI)
**When**: Session AAI.
**Why**: Player's first 30 seconds of every new game should be a
consistent experience — same opening wreck silhouette, same cockpit
journal, same companion pod position, same speeder pose. Per-seed
randomization of the opening would break tonal continuity
("Dustfall opens like this") and require regression-testing the
narrative beat for every seed. The cheapest implementation: lock
`OPENING_SCENE_ANCHOR_X/Z = -50, 0` in Tuning, and
`PLAYER_SPAWN_EXCLUSION_RADIUS = 80` keeps procgen content out of the
immediate viewshed so the opening isn't crowded. The wreck's
`findFlattestSpot` drift up to 16m is preserved.
**Apply**: never randomize player spawn, opening wreck, opening companion
pod, opening speeder placement.
**friction-score:** 1

## D84 — Seed source: auto-roll on NEW GAME + advanced UI entry (Session AAI)
**When**: Session AAI.
**Why**: Default flow needs to be friction-free — a player clicks NEW
GAME and gets a fresh random world without thinking about seeds. Power
users want to share + reproduce specific worlds, so the title overlay
gains a collapsed "Advanced ▾" disclosure with a uint32 seed input.
Browser `Math.random() * 0x100000000 >>> 0` is "good enough" entropy —
we're not cryptographic, just want variety. The pendingSeed handshake
through localStorage survives page reloads (which the existing NEW GAME
flow uses to wipe + rebuild the procgen world cleanly).
**Apply**: don't add seed display to the default title UI (would clutter
the minimal aesthetic); seed shows in the controls panel (H key) for
post-spawn sharing.
**friction-score:** 1

## D85 — `Tuning.RNG_SEED` retained as fallback only (Session AAI)
**When**: Session AAI.
**Why**: Production NEW GAME inline-rolls a random seed on first-ever
boot + persists per-game seeds via save. `Tuning.RNG_SEED = 1337` is
no longer the production world seed. Keeping it as a Tuning constant
documents the historic default + provides a dev/test path: setting
`localStorage['dustfall.pendingSeed'] = '1337'` reproduces the
pre-AAI world for regression testing.
**Apply**: don't delete; reference via `void Tuning.RNG_SEED` for
unused-import discipline. Don't read it in any other module post-AAI.
**friction-score:** 0

## D86 — Cook state as a list, not a singleton (Session AAM)
**When**: Session AAM.
**Why**: Pre-AAM, `_cooking` was a module-level singleton — only one
cook could run in the entire world at a time. Adequate when fires
were single-cook devices, but the AAM grill attachment needed
parallel cooks per fire. Lifting to `_cooks: CookState[]` allows
N cooks per fire (capped by `Tuning.FIRE_GRILL_MAX_PARALLEL_COOKS = 4`
when grill is attached, 1 otherwise). Each entry tracks its own slot,
fireId, and completeAt; `tickCooking` iterates and removes
completed/cancelled entries.
**Considered alternatives**:
- Per-fire cook-list (`fire.cookSlots: CookState[]`) — keeps cook state
  with the entity. Rejected because the cook references a player
  inventory slot (slot.meta.cookProgress drives viewmodel animation),
  not just the fire. A module-level list with a `fireId` link is
  simpler to iterate + removes the entity-fire-ownership ambiguity
  on save/load.
- Map<fireId, CookState[]> — over-engineered for the current 4-cook
  cap. Linear scan over a small array is fast.
**Apply**: future cook-related additions (e.g. cookable recipe variations,
mid-cook stat hooks) extend `CookState` rather than reverting to a
singleton. Slot-switch no longer cancels cooks (it was a single-cook
UX limitation that multi-cook breaks).
**friction-score:** 2

## D87 — Save-load seed check reads ctx.seed, not Tuning.RNG_SEED (Session AAM)
**When**: Session AAM (incidental bug fix surfaced while testing v10
save/load).
**Why**: AAI introduced per-game seeds (`ctx.seed`) but the loader's
"different world" guard (`save.ts:415`) still compared
`save.seed !== Tuning.RNG_SEED`. Result: any non-1337 saved world
failed to load — saves were effectively non-loadable post-AAI for
the entire AAI/AAK era. Now reads `save.seed !== ctx.seed`. This
was AAI debt the AAI-end verification missed (the test save/load
roundtrip used seed 42 by setting pendingSeed → boot ctx.seed = 42
→ loader's `Tuning.RNG_SEED === 1337` check should have failed, but
the AAI eval-test apparently passed somehow; possibly the test
didn't exercise the loader path).
**Apply**: when adding ctx.X fields that supersede a Tuning constant,
grep the codebase for `Tuning.X` and audit each remaining reference.
**friction-score:** 1

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

## D165 — A verification harness MUST render the REAL game camera; a harness that overrides the camera (or assumes a facing convention) can mask a real-view bug for multiple rounds (Session ACX)
**When**: ACX — the user reported the seated speeder rig facing/posed wrong; my `speeder-seated` rig-shot scenario reported "facing forward, pose fine" via a numeric `faceDotFwd` check for THREE rounds while the live view was visibly wrong.

**Why**: The scenario (a) OVERRODE `cam.position`/`lookAt` with a hand-placed behind-cam for its screenshot — so it never rendered what the game's own chase-cam shows the user — and (b) computed "facing" as `+Z·bikeForward`, *assuming* +Z is the visible face (the D137 convention) rather than observing pixels. Both assumptions can be individually true yet jointly mask the real bug. Net: the harness looked faithful but verified a fiction; I shipped "fixes" that didn't match the user's screen.

**Picked**: A pose/feel harness must (1) render the REAL in-game camera path (let `updateSpeeder` drive the chase cam; do NOT override `cam.position` for the shot), and (2) supplement any convention-based numeric check with fixed EXTERNAL world angles + actually reading the pixels. The new `bike-truth` scenario pins bike yaw=0 (nose=-Z unambiguous), captures the real game-cam frame + 5 fixed world angles, and only THEN poses. The "torso disconnected" + "facing backwards" reports were both diagnosable in one `bike-truth` run once the camera was real.

**friction-score:** 4

## D166 — Pose a rig to world targets with a numeric IK SWEEP (minimize joint-world-pos → target distance), not by eyeballing low-res frames (Session ACX)
**When**: ACX — solving the seated speeder pose so the hands land on the handlebar grips + feet on the footpegs.

**Why**: Hand-tuning coupled Euler joint angles (hip pitch + abduction + knee; shoulder pitch + lean) by eye across recompile→screenshot rounds is slow and converges poorly — the bike's grip/peg positions are known world points, so the problem is just "find the joint angles whose wrist/ankle world positions hit them."

**Picked**: An in-page sweep (runs paused, pure matrix math, one dev-boot) grids the joint angles, computes each candidate's `wrist.getWorldPosition()` distance to the grip target + `ankle` to the peg, and reports the lowest-error angles + per-axis residuals to bake. Surfaced the real constraints fast: the ~0.65m arm can't reach the ~0.80m grips without a forward torso lean (→ deeper lean); the seat can't go further back than 0.36 or the bars leave arm range; the 3-DOF leg can't hit the pegs dead-on (~22cm residual, reads astride). Constrain the sweep (e.g. forbid strong backward hip pitch) to avoid contorted local minima. The numeric error is the gate; a final render confirms it reads.

**friction-score:** 2

## D167 — A big seated forward-lean must pivot at the WAIST; `spineBend` is parented at the rig origin (y=0, feet), so a bare rotation slides the whole torso off the pelvis (Session ACX)
**When**: ACX — the seated speeder lean (~0.6 rad) made the torso visibly detach from the lower body ("torso disconnected from the body").

**Why**: `spineBend` (torso + head + arms + pack) is added to `body` at the rig origin (y=0, the feet), while the legs stay on `body`. `spineBend.rotation.x` therefore pivots the upper body about the FEET — a 0.6 rad lean translates the torso ~0.4m forward off the (static) pelvis. Invisible at the normal standing lean (0.04 rad), glaring at a riding lean. Subtlety: that same forward slide had been *accidentally* providing the arm reach to the bars, so fixing the pivot also removed the reach (re-solved with a deeper lean — D166).

**Picked**: In the seated branch, compensate `spineBend.position = (0, PIVOT_Y·(1-cos θ), -PIVOT_Y·sin θ)` with `PIVOT_Y≈0.92` (waist) so the rotation effectively pivots at the waist — the torso rotates in place, staying seated on the hips. RESET `spineBend.position.set(0,0,0)` on the non-seated path so on-foot posture is unaffected (the early-return seated branch would otherwise leave the offset stuck after dismount).

**friction-score:** 2

## D168 — Procgen salvage panels mount via a raycast surface-sampler (`findPanelMount`), not a single hardcoded per-part anchor; cardinal-yaw only, with the anchor kept as a fallback (Session ACY)
**When**: ACY — backlog #190 ("dynamically place salvage panels on procgen POIs — avoid clipping, snap to flat surfaces, valid facing"). The prior system gave each part builder ONE hardcoded `panelAnchor` on its +Z flank; the assembler just placed there, so panels could bury in geometry, overlap decorations, or only ever appear on one side.

**Why**: A part is a composite `THREE.Group` of arbitrary child meshes; the only reliable way to find a flat, outward-facing, clip-free spot on arbitrary geometry is to ask the geometry. `Box3().setFromObject` + `Raycaster.intersectObject(part, true)` does the composite math for free — first-hit = the true outer surface, with point + face normal in one call.

**Picked**: `findPanelMount(part, rand, placed)` casts a seeded jittered grid of outside-in rays at both ±Z flanks; keeps the first hit that is (a) outward (`normal·(point−centroid) > MIN`), (b) not-steep (`|n.y| < MAX` — the hinge/recess only YAW, so reject sloped/top faces), (c) flat (a 4-ray probe ring at the panel footprint agrees on depth within TOL — rejects curves, gaps, proud decorations, panel-spanning seams), (d) not on a `userData.isWreckDecoration` mesh, (e) clear of already-placed panels (`MIN_SEPARATION`). Returns part-LOCAL coords (pure-translation world→local at assembly time) + a `faceYaw` quantized to the nearest π/2 from the hit normal — so **`addAccessPanel`'s signature is unchanged** (its hinge/recess/rim are all built for pure-Y rotation). Falls back to the authored `panelAnchor` (on-surface by construction) when no mount is found; OPEN_TRUSS / engine bells keep explicit `null` anchors as a ray-budget fast-skip. Runs once at worldgen. **Considered**: extending `addAccessPanel` to take a full quaternion for arbitrary-tilt mounts — rejected (touches the hinge/recess/rim math + door swing; cardinal-yaw covers the flanks, which is where panels read best). RNG-stream caveat: the sampler consumes a variable number of `rand()` calls, so existing saved seeds render differently — additive, no save bump, verify on NEW seeds.

**friction-score:** 3

## D169 — Item viewmodels iterate against an ISOLATED `itemStudio` view (mesh alone vs the sky), not the in-hand `held-item` shot; the rig torso buries small items (Session ACY)
**When**: ACY — deep-polishing 12 held item models under the rule-8 screenshot discipline. The first `held-item` smoke shot framed the machete as a thin sliver behind the rig's torso/backpack — useless for judging mesh fidelity.

**Why**: The `held-item` scenario poses the 3P arm out and frames the hand, but the rig body + outfit fill most of the frame and small items read as occluded slivers. Critique needs the item ALONE, legibly, from several angles.

**Picked**: NEW `__game.itemStudio(id, angle)` debug hook builds the item's `makeViewModel()` mesh in isolation, suspends it ~40m up (so terrain/wrecks fall outside the narrow framing → pure sky backdrop), hides the player rig, lights it for form (raking key + cool fill + ambient), and frames the chosen angle at a bbox-derived distance. A thin `item-studio` rig-shot scenario loops `--items=a,b,c --angles=front,3q,left,top` in one server boot. The studio uses the SAME `makeViewModel` mesh the game renders, so it faithfully previews FP + 3P (which both build that mesh) — verified by a 3P `held-item` spot-check on the structurally-changed amban. Lesson reinforces D165: the verification view must be legible AND faithful; an isolated studio is both for static mesh work (feel/in-motion still needs the real camera). **ACAA addendum**: the studio is NOT faithful for the depth-sort/material side of the FP viewmodel — its meshes use default materials (depthTest on) so it never showed the "see-through rings" bug (D170). For FP-render issues, use the new `fp-item` scenario (renders the real first-person viewmodel through the game loop).

**friction-score:** 1

## D170 — The FP viewmodel renders in its OWN scene in a second depth-cleared pass (depthTest ON), not in the world scene with depthTest OFF (Session ACAA)
**When**: ACAA — the ACY/ACZ detailed item models showed "see-through" rings/coils in first person (the far side of a torus drew over the near side). Root cause: `configureViewModelMaterial` set `depthTest=false`+`depthWrite=false` on every FP viewmodel material so world walls couldn't clip the held item — which ALSO disabled depth-sorting within the item. Simple weapons (few meshes) hid it; the new multi-mesh items (grip-rings, coils, chains) exposed it.

**Why**: There's no single material flag that gives both "draw on top of the world" AND "self-sort correctly" — depthTest off breaks self-sort; depthTest on reintroduces wall-clip. The textbook FPS fix is to render the viewmodel as a separate pass over a cleared depth buffer.

**Picked**: The viewmodel `group` now lives in a dedicated `THREE.Scene` (`vm.scene`) with its own lights (ambient + a key/fill rig parented to `group` so lighting is camera-relative + consistent as the player turns). `core/loop.ts` renders the world, then — when `vm.group.visible` (FP gameplay only) — `renderer.autoClear=false; clearDepth(); render(vm.scene, gameCamera)`. Materials go back to `depthTest=true`; opaque ones write depth (self-sort), authored-transparent ones (flame/lens/glow) keep `transparent` + skip depth-write. **Two gotchas burned in:** (1) `getRenderTarget()` ALWAYS returns a target (world scene during play), so the viewmodel pass must run *after* the main render unconditionally, NOT in an `else` branch — putting it in the else made the viewmodel vanish entirely. (2) The old `configureViewModelMaterial` force-set `transparent=false`, which had silently been breaking the torch flame fade for ages; stop overriding authored transparency. **Considered**: camera-layers two-pass in one scene (rejected — lights+layers interaction is fiddly; a separate scene is cleaner and pass 2 only traverses the tiny vm scene). **Trade-off**: the held item no longer receives world lights → doesn't dim at night (fixed vm-scene lights = readability win; emissive effects like the torch flame still dominate). Verify FP-render changes with the `fp-item` rig-shot scenario, NOT `item-studio` (whose default-material meshes can't reproduce viewmodel depth bugs). **Third gotcha (ACAB follow-up)**: lights that emit onto the WORLD (torch PointLight, flashlight SpotLight) must NOT live in the viewmodel mesh — once it moved to `vm.scene` they only lit the held item. Fix: two reusable held-lights (point+spot) live in the WORLD scene (`createViewModel`), zeroed each frame by `updateViewModel`, re-armed + positioned by the emitter item's `updateHeld` (at the flame/lens world pos, spot aimed along camera-forward). Always-present at intensity 0 so equipping a torch doesn't trigger a lightsHash recompile stutter.

**friction-score:** 3

## D171 — Clouds are a procedural FBM layer in the sky-dome fragment shader driven by a `cloudiness` weather-state field, NOT geometry/sprites; storm telegraph rides the same field (Session ACAB)
**When**: ACAB — Cycle 6 atmosphere. The sky was a gradient + sun/moon/stars; no clouds existed. The GDD's Dune tone wants clear↔cloudy daytime variation + a telegraphed storm.

**Why**: A geometry/sprite cloud layer (billboards, a cloud mesh) is heavy + hard to make recede to the horizon convincingly. The sky is already a single inverted-sphere shader drawn first; adding clouds there is ~40 lines of GLSL, zero new draw calls, zero assets (fits D107), and the `d.xz/d.y` plane projection gives free horizon recession + compression.

**Picked**: Clouds live in `SKY_FRAGMENT`: FBM value-noise sampled on the `d.xz/d.y` plane (clamped near the horizon), domain-warped to break the radial streaks into billows, drifted by `uTime`, thresholded by a `uCloudiness` uniform (0 clear → 1 overcast), shaded lit-top/dark-underside + sun-tinted. The driver is a NEW `weather.cloudiness` field (0..1) eased toward a slow deterministic wander (gamma-biased toward clear) — so cloud cover is a *weather-state quantity*, like `intensity`, read by the sky shader AND the lighting coupling (overcast dims/cools the sun + lifts ambient — `CLOUD_SUN_DIM`/`CLOUD_AMBIENT_LIFT`, distinct from the orange storm dim) AND the star/sun/moon opacity (overcast veils them). **Storm coupling**: a storm forces `cloudiness` overcast the moment it starts BUILDING (before the dust wall) and the clouds darken to an ominous dusty hue — so the storm telegraph rides the cloud field, not a separate system. This does NOT supersede the AAF/D31/D32 storm intensity-ramp or the ACL sweeping wall (both stand — the wall + dust are the storm; clouds are the sky above + ahead of it). **Save**: `cloudiness` is transient (re-derives from elapsed time on load) — additive, no version bump (D81). **Verify**: the `sky` rig-shot scenario (cloud cover × time-of-day + the storm-build telegraph); `item-studio` can't show sky. RNG note: the wander is a pure function of `ctx.time.elapsed` (deterministic across reloads), like the star drift.

**friction-score:** 2

## D172 — Auto-fire + self-recharging energy cell is a clean extension of the ranged weapon spec (an `auto` flag); headless cadence tests must wait in GAME-time, not wall-clock (Session ACAC)
**When**: ACAC — adding the pulse rifle (Cycle 5 weapon half), a rapid-fire energy carbine distinct from the 3 existing guns.

**Why**: The weapon system had melee / ranged (ammo-fed) / charged. A rapid-fire energy weapon is neither charge-release nor single-shot-per-click, and shouldn't need an ammo ITEM. Rather than a new weapon `kind`, the smallest change is a flag on the existing ranged path.

**Picked**: WeaponSpec gains `auto?: boolean`. In `updateCombat`'s non-charged path, auto weapons trigger on `mouseHeld.has(0)` (fire while held, gated by `cooldown`) instead of `mousePressed.has(0)` (one shot per click), and empty SILENTLY (skip the "out of ammo" toast — it'd spam during auto-fire). The "ammo" is a `maxAmmo` energy CELL in `slot.meta.ammoRemaining` (reuses the existing field) that drains 1/shot and **recharges over time in the item's `updateHeld`** (after a `RECHARGE_DELAY_S` idle since `slot.meta.lastFireAt`, which combat stamps per shot) — NO ammo item, NO R-reload path. The cell value is allowed to be fractional internally (recharge is rate×dt); nothing displays it numerically (the empty-crosshair state is scrap_gun-only), so no flooring needed. **Considered**: a new `kind: 'auto'` — rejected (it'd duplicate the whole ranged fire/raycast/ammo path for one flag's worth of difference). The glow (cell + emitter coils) is driven by `updateHeld` from the charge level + a per-pulse flash, mirroring the energy_pistol's shared-MeshBasic pattern.

**Verification footgun worth remembering**: the headless rig-shot harness runs the GAME CLOCK in slow-motion — low fps + `dt` clamped to 0.1 in `loop.ts` — so `ctx.time.elapsed` advanced ~5× slower than wall-clock. A cadence/recharge test waiting `waitForTimeout(1200)` (wall) only advanced ~0.25s of game-time → it read "1 shot fired, no recharge" and looked broken when the logic was fine. Cadence/cooldown/recharge tests must wait LONG in wall-clock (or assert on game-time), and instrument `ctx.time.elapsed` to confirm. (This also explains why `--scenario` strips use generous frame intervals.)

**friction-score:** 2

## D173 — "Weather everything" is a `rustLevel` LAYER on the shared procedural metal shader + a rusty default on the item wrapper, not per-model hand-painting (Session ACAD)
**When**: ACAD — user direction: "everything in the desert has been weathered by time; all models should reflect that." The metal shader (`createMetalMaterial`) had scratches/worn-patina/dirt but no actual RUST, and items read too clean.

**Why**: 12 files use the metal shader (all held items via `vmMetal` + world props). Hand-adding rust geometry/colors to each of ~35 items + props is huge + inconsistent. The leverage is the SHARED shader: add one rust layer and a sensible default, and the whole game's metal weathers coherently in a couple of edits.

**Picked**: NEW `rustLevel` (0..1) on `MetalMaterialOpts` → an FBM-oxidation layer in the fragment (patches + Y-stretched drip streaks, two-tone rust core→halo, MIXED INTO the diffuse — oxidation replaces the metal color, not multiplies it). Default 0 (so the 8 world-prop callers are unchanged unless opted in — no surprise regressions). The ITEM wrapper `vmMetal` defaults `rustLevel: 0.34` so EVERY held metal item ages at once (verified the rust reads on dark gun metal + stays subtle on bright blade steel + leaves wood/fabric alone, since those use other shaders). Per-model dials layer on top: the pulse rifle uses 0.5–0.72 + rusty base colors + scavenger GEOMETRY (riveted scrap patch, cable wrap, exposed wiring, hose clamp, taped grip) so it reads as junk-tech; iron props (stake driven into sand) use 0.55–0.6. **Considered**: a separate rust-overlay mesh per item (rejected — per-model labor, the whole point was a systemic lever) and bumping the shared shader's *default* rust >0 (rejected — would silently re-skin tuned world props like the speeder/sled; opt-in via the wrapper is safer). **Gap noted**: painted-metal surfaces (`createPaintedMetalMaterial` — sled top, speeder body) have a `wearLevel` but no rust layer; a parallel `rustLevel` there is a follow-up if the paint reads too clean.

**friction-score:** 1

## D174 — The FP viewmodel scene MIRRORS the world sun/moon/ambient each frame, so held items are lit identically to their dropped/world copies (Session ACAG)
**When**: ACAG — user reported the held branch and the same branch dropped on the ground looked like different colors, even at the same hex. "Everything needs to be consistent; no model should look different in-hand vs in-world."

**Why**: The FP viewmodel renders in its OWN scene (D170 two-pass depth-cleared render), which carried FIXED studio lights (ambient 0.9 + key 1.7 + fill 0.45). World objects are lit by the day/night sun+moon+ambient. So the same material under two different light rigs read as two different colors — the in-hand item looked brighter/warmer than its dropped copy.

**Picked**: `updateViewModel` now copies `ctx.lights` (sun/moon color+intensity+direction, ambient color+intensity) into mirror lights living in `vm.scene` every frame. The lights are added to `vm.scene` (NOT the camera-tracked `group`), so their directions are world-space and the held item — which tracks the camera in world space — is lit exactly as a world object at that orientation would be. **Trade-off accepted**: held items are no longer artificially bright at night (the old studio rig kept them readable); they now darken at dusk / flatten under overcast like everything else (the torch flame stays emissive). The user explicitly chose consistency over the readability win. **Considered**: lifting the world material colors to *match* the bright in-hand look (rejected — chases the symptom; the moment lighting changes they diverge again). Also unified the deadwood color to ONE exported constant `BRANCH_WOOD_COLOR` (held item + ground pickups + tree) so they can never drift in hex either.

**friction-score:** 2

## D175 — Procedural shader materials that inject per-instance constants via onBeforeCompile MUST set customProgramCacheKey, or Three silently shares ONE compiled program across them (Session ACAG)
**When**: ACAG — the new `bark` grain layer (and, in hindsight, every prior per-material grain tweak) appeared to do NOTHING on the dead-tree trunk; it rendered as one flat color. A debug color-fill injected into the fragment shader didn't show either — proving the trunk wasn't running its own compiled shader at all.

**Why**: Every wood material is a `MeshLambertMaterial` with identical STANDARD parameters; the per-material differences (grain axis, ring density, bark, localSpace) live only in the `onBeforeCompile`-injected GLSL source. Three.js computes its compiled-program cache key from material PROPERTIES, not from the injected source — so all wood materials collided to ONE cache key and reused whichever program compiled first. Per-material grain/bark was silently ignored across the whole game's wood (locker, sled, posts, trees, held items) — they were all rendering the first-compiled variant.

**Picked**: `createWoodGrainMaterial` now sets `mat.customProgramCacheKey = () => <string encoding every baked constant>` (grainAxis, ringDensity, weatherLevel, grainStrength, bark, localSpace, doubleSide). Each distinct variant compiles its own program. Side effect (correct): this also UN-shares grain across all existing wood props, which were previously collapsed to one look. **General rule for this codebase**: the metal/fabric/bone/glass shader factories use the same onBeforeCompile pattern — if any of them bakes per-instance constants into the source AND is instantiated with differing opts, they need the same `customProgramCacheKey` guard. Verify by injecting a debug fill and confirming it renders per-material before trusting a shader-source change "did nothing."

**friction-score:** 3

## D176 — Dead trees are a RECURSIVE forking branch generator merged into one geometry per tree, not a pole-with-twigs (Session ACAG)
**When**: ACAG — user attached Deadvlei camelthorn reference photos; the prior single-tapered-trunk-with-straight-limbs model read as inorganic / too straight / too pointed.

**Why**: Real dead desert trees branch recursively — a bole forks into limbs, each forking again into finer branches, forming a spreading gnarled crown. A flat "trunk + N side limbs" can't capture that silhouette.

**Picked**: `makeDeadTree` is a recursive `grow(base, dir, len, radius, depth)`: each call emits one tapered, parabolically-bowed cylinder segment (the bow = gnarl) and forks into 2-3 children at its CURVED TIP with divergence + upward bias, recursing `depth` levels (currently 4) until depth/min-radius cutoff. Children attach with matching radii at the parent tip → seamless forks, connected by construction (no floaters). Buttress roots flare at the base. **Perf**: a tree is ~40-80 cylinder segments; all merge into ONE `BufferGeometry` via `mergeGeometries` → 1 draw call/tree (×45 trees). One shared `_treeMat` (BRANCH_WOOD_COLOR + bark, localSpace). **Knobs**: `depth` = generations of forking (crown complexity, exponential cost), `childCount` probabilities = density per level (tune fine-twig sparseness here, NOT depth, to thin tips while keeping reach), `boleLen`/`baseR` = trunk size. **Process note**: this was iterated 6+ screenshot rounds via a NEW `tree` rig-shot scenario (trees tagged `name='deadTree'` so the harness can locate one) — caught a backwards limb taper, ball-collar junctions, a trumpet root flare, over-density, and proportions, none of which `tsc` would surface (rule 8).

**friction-score:** 2

## D177 — The onBeforeCompile program-cache collision (D175) was GAME-WIDE: every procedural material factory needs customProgramCacheKey (Session ACAH)
**When**: ACAH — building the rusty scrap model, I found `createMetalMaterial` bakes its constants (rustLevel/wornScale/scratch) into the GLSL via `.toFixed()` with no cache key — the exact D175 bug. A grep showed ALL of metal/fabric/glass/bone/skin/paint/stone do the same; only woodGrainMaterial had been fixed (D175).

**Why**: Three.js keys its compiled-program cache on material PROPERTIES, not the onBeforeCompile-injected source. So for each factory, every variant reused the FIRST-compiled program and silently ignored its per-instance baked effect params. Base `color` is a real uniform so it still varied per material — which is why nobody noticed across ~100 sessions (color carries most of the read; the shared rust/scratch/grain was "good enough" everywhere). The D173 rust pass *looked* like it varied because the scrappy read came from GEOMETRY + base colors, not the (collided) rust-shader layer.

**Picked**: Added `mat.customProgramCacheKey` to all 7 remaining factories — metal hand-encodes its baked consts; fabric/glass/bone/skin/paint/stone use `'<factory>:' + JSON.stringify(opts ?? {})` (captures every baked field without enumerating; can only over-compile, never wrong-share). **terrainMaterial excluded**: it bakes only GLOBAL `Tuning.MIRAGE_*` constants (identical across all terrain instances → sharing is correct; the ACAH cloud-shadow addition uses a uniform, not a baked const). **Considered**: leaving it (rejected — it silently defeats per-material art direction game-wide). **Verified no catastrophic regression**: items + player rig render correctly; most materials use default opts so they're unchanged, only the few with custom params shift toward their authored intent. **Standing rule**: any NEW onBeforeCompile factory MUST set customProgramCacheKey; verify a shader-source change actually renders (inject a debug fill) before trusting it.

**Cost tradeoff (ACAH perf pass)**: un-sharing is correct but it grew the compiled-program count from ~16 (ABL era) to ~120, which turned the boot `renderer.compile()` pre-warm into a multi-second STARTUP FREEZE. Mitigation: switch the pre-warm to `renderer.compileAsync()` (parallel / off-main-thread, fire-and-forget) so the title appears immediately and programs finish in the background — do NOT revert the cache keys (that brings the silent collision back). If the program count ever needs to actually SHRINK (GPU memory), the proper fix is converting the numeric baked opts to UNIFORMS (then all variants of a factory share ONE program AND render their own values, and the key collapses to just structural variants like `localSpace`) — deferred as a bigger refactor.

**friction-score:** 3

## D178 — The early game DEADLOCKED on scrap; fixed by scattering scrap around wrecks (no-tools loot), mirroring branches-around-trees (Session ACAH)
**When**: ACAH — user flagged that panels are the only loot source, but opening a panel needs a `scrap_bar`, whose recipe needs 2 `scrap`, and scrap only dropped from panels → a cold-start deadlock (verified in code).

**Why**: The salvage loop had no bootstrap entry. The cleanest no-tools source that fits the world is debris around crash sites — and the dead-tree→branch scatter is the exact proven pattern (ring-scatter from an anchor, static seed-spawned pickups).

**Picked**: `main.ts` iterates `salvageables.list` (all placed wrecks) and drops 2-4 scrap in a ring around each (`spawnScrapAt` mirrors `spawnBranchAt`; massive wrecks get a larger ring to clear their footprint). Deterministic from `scatterRand`; static pickups (`body:null`), no save bump. Balanced so the first wreck reached yields enough for a `scrap_bar`. **Considered**: making panels pryable without a tool (rejected — removes the scrap_bar's purpose) and seeding a scrap_bar in the opening pod (rejected — narrower fix, doesn't enrich the world). Built the scrap mesh as a SHARED `buildScrapMesh` (held item + world pickups) per the branchMesh precedent so they can't drift.

**friction-score:** 1

## D179 — The vulture is a PERCHED proc-creature mirroring the shrew pipeline (not a flying-AI rebuild); dead trees return crown perch points (Session ACAH)
**When**: ACAH — adding the rare salt-flat vulture (user spec: perches on trees, flees on approach, gun-kill for meat).

**Why**: A full flight-AI bird is large + hard to verify headless. But the gameplay the user wants is perch → flee (kill window) → shoot → meat — which maps almost 1:1 onto the shrew's spawn/damage/loot/save pipeline. The only genuinely new pieces are the perched model + a simple flee-climb-despawn flight and a gravity death-fall.

**Picked**: `enemies/vulture.ts` mirrors `shrew.ts` (module-owned list, kinematic body, combat dispatch, interaction take-case, COOK_MAP, additive save reconcile-by-id). FSM perched|flee|dead. **Perch placement**: `deadTree.spawnDeadTrees` now RETURNS world-space crown perch points (it tracks the crown-top Y during recursion and exposes `userData.perchY`); the vulture spawner picks ~3 well-separated perches. **Considered**: physics-driven flight (rejected — overkill; the flee is a scripted climb-arc + despawn) and ground-walking (rejected — a perched scavenger is the reference + reuses the new trees). **Save**: additive `vultures[]` (id+pos+state), reconciled like shrews — no version bump (D81). The in-FLIGHT feel (flee arc) is foreground-owed (D150 — the headless clock can't read flight cadence).

**friction-score:** 1

## D180 — The mounted player capsule parks at y=-2000; any system reading player position must account for it (Session ACAH)
**When**: ACAH — fixing the user-reported "world lighting differs mounted vs on foot." Root cause: `lighting.ts` followed `ctx.player.body.body.translation()` for the sun/moon targets + shadow camera, but on speeder-mount `speeder.ts` parks the player capsule at `{0,-2000,0}` (so it can't collide with the bike) → the lighting tracked 2km underground (moonlight inverted, world darkened).

**Why**: Worth a D-entry because it's a LATENT GOTCHA: the parked-at-y=-2000 trick (a reasonable way to stow the capsule while mounted) silently breaks any system that reads the player body position while mounted. Lighting was the one that surfaced; future systems (audio attenuation, fog, spawn distance, AI targeting) could hit the same trap.

**Picked**: `updateLighting` derives a single follow-position: `ctx.speeder?.mounted ? ctx.speeder.body.translation() : ctx.player.body.body.translation()`, used for both the shadow-move check and the sun/moon targets. **General rule**: when reading player world position, prefer a helper that resolves the speeder position while mounted (the `getPlayerPos` util already does this for AI — sandWorm/companion/vulture use it; lighting predated it). Audit other raw `ctx.player.body.body.translation()` readers if a mounted-state bug appears.

**friction-score:** 2

## D181 — The vulture is now a fully-rigged creature: joint-pivot rig + per-state anim + relocate-and-land FSM + dynamic-body death tumble; branch perches captured during dead-tree generation (Session ACAI)
**When**: ACAI — user asked to make the ACAH static-mesh vulture sit cleanly on a real branch, have full animations (idle / flap / landing / death-fall), and use real death physics.

**Why**: The ACAH vulture floated at a computed crown height with only a tiny idle bob + a crude scripted gravity fall. Four design forks were resolved with the user: (1) the rig follows the proven lizard/shrew leg-pivot convention (sub-`Group` at each joint, children offset) rather than a skinned-mesh skeleton — it's verifiable headless + reuses the codebase pattern; (2) DEATH is a SINGLE Rapier dynamic-body tumble (mirrors dropped-item physics), NOT an articulated ragdoll — far cheaper + the dunes give a believable bounce/roll; (3) FLEE is relocate-and-land (fly to another tree + re-perch, stays alive), so all four requested anims are used; (4) the tree merges to ONE geometry, so perch points are captured DURING `grow()` recursion (before the merge) rather than from surviving branch meshes.

**Picked**: `enemies/vulture.ts` — `makeVultureVisual` builds the rig into `userData.rig`; `animateVulture(v, elapsed)` poses per state; FSM `perched|flying|landing|dead`; `damageVulture` swaps kinematic→dynamic (cuboid from the posed AABB, CCD, collider offset to the body CoM so `body.translation()` maps onto `mesh.position`). `deadTree.grow()` records `branchPerches` (~60% along depth-2 limbs + dir); `spawnDeadTrees` returns `TreePerch[]` (pos+dir); the spawner seats feet on the limb + yaws across it. **Death-settle gotcha (friction)**: a corpse resting on the terrain HEIGHTFIELD keeps spurious ANGULAR jitter from mesh-vs-triangle contact, so a naive `linvel²+angvel² < ε` settle test NEVER fires — keyed the settle on LINEAR velocity only, with body-sleep + a `SETTLE_MAX_AGE` hard cap as backstops. **Considered**: articulated ragdoll (rejected — overkill), flee-to-despawn only (kept as the fallback when no relocation perch qualifies). **Save**: flying/landing/target fields are transient; dead persists via the existing additive `vultures[]` (no bump, D81). In-MOTION flight arc + tumble cadence are foreground-owed (D150 — the headless slow clock can't judge feel).

**friction-score:** 2

## D182 — Dead trees gained a single static trunk-cylinder collider; spawnDeadTrees now needs the physics world (Session ACAI)
**When**: ACAI — user asked for tree collision while doing the vulture pass (you could walk through trunks).

**Why**: Trees were deliberately visual-only (the original comment: "non-interactable static props … players can walk through them; the silhouette is what matters"). That reads wrong once you're standing next to one. Only the bole needs collision — the fine gnarled crown twigs don't (a body can't reach them, and per-twig colliders would be absurd).

**Picked**: `makeDeadTree` exposes `userData.trunkRadius` (`baseR*1.35`, generous for the bark) + `trunkColliderH` (`bole+0.6`); `spawnDeadTrees` gains a `world: RAPIER.World` param (threaded from `main.ts`) and drops one `makeStaticCylinder` per trunk, centred over the bole. No save/cleanup (rebuilt from seed). **Considered**: a convex hull of the merged geometry (rejected — the crown would block movement + cost more) and a capsule (rejected — a cylinder matches a trunk + is cheap). Footgun for the vulture death pass: a perched bird dropped straight onto its own tree could collide with this new trunk cylinder, so the `vulture-kill` scenario relocates the corpse to open ground.

**friction-score:** 1

## D183 — Carcass ecology: vultures circle bone landmarks + swoop-grab prey; cross-module prey removal goes through ctx, not new APIs (Session ACAI f/u)
**When**: ACAI follow-up — user wanted vultures to circle the bone carcasses, prey to gather there, and vultures to swoop down + carry off a lizard/shrew.

**Why**: A "living world" layer that reuses what's already there. The ribcage hero landmarks (`heroLandmarks.ts`) are the carcasses; lizards/shrews already cluster near `poiPositions`; the vulture FSM already had flight states. The only genuinely new pieces are a circling orbit, a swoop/grab/carry sub-FSM, and a way for the vulture to remove a prey creature.

**Picked**: (1) `placeHeroLandmarks` returns the carcass positions; `main.ts` feeds them into BOTH the lizard/shrew `allPoiPositions` (clustering — free reuse of the existing POI-cluster pass) AND a new `spawnCirclingVultures`. (2) Vulture FSM gains `circling | swooping | carrying`; circling vultures soar a banked orbit (`applyFlightOrientation` gives constant bank), never flee the player (they're high up), only die when shot. (3) **Prey removal crosses modules via `ctx`, NOT new find/remove APIs**: the vulture module reads `ctx.lizards` / `ctx.shrews.list` directly (already on GameContext) and calls the existing `lootLizard`/`lootShrew` to eat one — no new surface on lizard.ts/shrew.ts, no circular-import risk (those modules don't import vulture). The swoop re-resolves the live prey position by id each frame so it tracks a fleeing creature. **Considered**: a circling-vulture as a separate entity type (rejected — reuses the Vulture struct + FSM + death/loot pipeline); a dedicated `findHuntablePrey`/`removeForHunt` API pair on each creature module (rejected — `ctx` access + the existing loot fns already do it, less surface area). **Save**: circling/swooping/carrying are transient (re-derive to perched on load); carcasses + circlers rebuild from seed — no bump (D81). In-MOTION swoop/carry CADENCE is foreground-owed (D150).

**friction-score:** 2

## D184 — Shrew burrow-escape is a RACE (grabbable until half-buried); vultures scavenge dropped meat via ctx.pickups (Session ACAI f/u)
**When**: ACAI follow-up — user wanted a shrew to be able to burrow before a vulture grabs it, and dropped meat/carcass to attract a swooping vulture.

**Why**: Both extend D183's ecology with emergent reactions. The shrew already had a `burrow` state (player-triggered); the dropped-meat hunt reuses the swoop/grab/carry pipeline.

**Picked**: (1) **Burrow-escape race** — when a vulture's dive gets within `VULTURE_SHADOW_WARN_DIST` of a targeted shrew, it calls `alertShrewToSwoop(shrew, chance)` ONCE per swoop (a `swoopWarned` latch); on a successful roll the shrew flips to `burrow` + a `burrowHold` timer keeps it under independent of the player (the existing burrow logic would otherwise ease it straight back up). The vulture's `findHuntPos` keeps a burrowing shrew grabbable until `burrowT >= 0.5`, then drops it — so it's a genuine race (dive fast enough = catch; shrew buries in time = escape), not a binary. (2) **Scavenge** — `maybeStartSwoop` checks dropped meat FIRST (carrion is easy food): any pickup whose `itemId` includes `meat`/`carcass` within `VULTURE_SCAVENGE_RADIUS` (≫ the live-prey `HUNT_RADIUS`, so the bird will travel), probability-gated by `VULTURE_SCAVENGE_CHANCE`; the swoop/grab/carry path handles a `huntKind: 'pickup'` the same as a creature, removing it with the existing `despawnPickup`. **Cross-module**: still all through `ctx` (`ctx.pickups.list`) + existing remove fns — no new creature/pickup API, no circular import. **Considered**: making the escape binary (rejected — the race reads better + rewards a well-timed shot); attracting a vulture from ANYWHERE on the map to dropped meat (rejected for now — circling vultures are carcass-anchored, so scavenging is scoped to meat dropped within a carcass's wide radius; "a chance," per the user). In-MOTION feel of the dive/escape/scavenge is foreground-owed (D150).

**friction-score:** 1

## D185 — Wreck visual rebuilds WRAP a curved toolkit hull over the existing box interior (FrontSide, noCollider); never rebuild the playable interior (Session ACAJ)
**When**: ACAJ — the mega-wreck read as a cluster of boxes; the user wanted it rebuilt to read as a crashed ship, while preserving the walk-through cavity + colliders + panels + shelter + journal.

**Why**: The mega-wreck (`megaWreck.ts`) is a 120m WALKABLE INTERIOR (bow chamber → mid-break → aft bay → side room, with catwalks, doorways, skylights, ~25 hand-authored cuboid colliders, 2 salvage panels, a shelter AABB, a journal). The "boxy" read comes from the EXTERIOR box-section walls; the interior box architecture is fine (a ship interior IS boxy). Rebuilding the interior from scratch would be high-risk (break the playable space + every collider) for no visual gain. So the rebuild WRAPS the boxy structure in a curved exterior hull and leaves the interior alone.

**Picked**: A NEW shared toolkit (`world/wreckForms.ts`: `makeLatheHull`/`makeFormerRings`/`makeBreach`/`makeSandMound`) builds the curved exterior; the mega-wreck's exterior shell (the old ABL cylinder + rust bands + rib bumps) is replaced with a tapered fuselage hull + exposed former rings at the fracture + asymmetric breaches + a tapered bridge cap. All shell meshes are `userData.noCollider = true` + FrontSide (the shared `_hullMat`), so the interior box walls (which carry the colliders + are visible from inside the bay) are untouched, and the hull is sized to ENVELOP the wide box (ellipse contains the rectangle's corners) so the box reads as inner structure not silhouette. **The toolkit is shared** so T3 (procgen fleet) levels up from the same blocks. **Considered**: a true from-scratch interior rebuild (rejected — breaks gameplay + colliders for no benefit); per-wreck bespoke geometry (rejected — the toolkit amortizes across the hero + ~80 procgen wrecks). **Scope discipline (rule 8 / ABP lesson)**: shipped T1+T2 fully-iterated and DEFERRED T3-T7 rather than rush 5 shallow tiers — notably T6 (perf merge) touches the salvage-panel interaction (a core loop) and warrants careful verification, not a rushed pass.

**friction-score:** 2

## D186 — Mega-wreck rebuilt FROM SCRATCH as a sleek dagger (REVERSES D185's "wrap the box, never rebuild") (Session ACAK)
**When**: ACAK — after D185's wrap-the-box exterior shipped, the user still found it low-quality ("a smoother box") and a 4-critic adversarial review confirmed it (2.75–3.75/10): the wide ~40m walkable cavity physically caps the silhouette — a shell can't be narrower than the box it wraps. The user chose to narrow the footprint + rework the interior from scratch.

**Why**: D185 was the right call *given a fixed wide interior* (don't break gameplay for no visual gain). But once the user accepted reshaping the interior, the constraint that capped quality (the 40m-wide box) was removed, so a true from-scratch rebuild became the higher-value path: a sleek ~5:1 dagger reads dramatically better than a chunky hauler, and building "interior-first / one coherent broken object" fixes the root failure that even a good shell couldn't (a level box-cavity under a tilted shell never agrees with itself).

**Picked**: Rewrote `megaWreck.ts` end-to-end. Exterior = `makeLoftedHull` (NEW — a faceted ship-hull cross-section lofted along Z, replacing the smooth lathe dome) in a `shell` group tilted ~17° + sunk; a `hullAt(z)` sampler gives the cross-section at any Z so flank detail sits ON the hull. Interior = `interiorDecks()` descriptors in the SAME shell frame (D187). **Considered**: keep wrapping the wide box + grind surface detail (rejected — the user explicitly wanted the dagger + a new interior; the wide cavity was the quality ceiling). **This reverses D185** but only because its precondition (immutable wide interior) was lifted — D185's "don't rebuild a working interior for no gain" still holds whenever the interior is fixed.

**friction-score:** 3

## D187 — The wreck interior is built in the SAME tilted `shell` frame as the exterior (one rigid listed object); the floor carries the full ~17° list (Session ACAK)
**When**: ACAK — rebuilding the interior (D186). The user explicitly rejected near-level "settled decks" in favor of fully tilting the floor for max authenticity, accepting a canted walk surface.

**Why**: The original interior failure was *decoupled frames* — a level box-cavity at y=0 under an independently-tilted decorative shell, so the player's gravity cue (level floor) contradicted every visual cue (canted hull, sloped horizon through the breach); it read as a level-editor box, not a wreck. The fix is to build inside + outside in ONE transform so they're literally one rigid broken object.

**Picked**: A shared `shellQuat()`/`shellPos()` (pivot-compensated roll+pitch+sink) consumed by BOTH the exterior shell meshes AND the interior `interiorDecks()` meshes (added to the same `shell` group) AND the colliders (`extCuboid` applies the same quaternion + optional per-piece tilt). The DoubleSide lofted hull IS the interior walls/ceiling (the cavity is `hullAt` minus an inset → no poke-through by construction). The walkable floor carries the full ~17° list (user's call). **Risk / friction**: a continuously-canted floor is unverifiable from screenshots — it NEEDS an in-app walk-test to confirm the player doesn't slide/get-stuck; flagged honestly. A `physics/bodies.ts` autostep of 0.3m means stepped/ramped transitions (e.g. the fracture crossing) must stay within that or the player wedges (one such ~2m step was found + fixed mid-session). **Considered**: near-level settled decks counter-tilting the shell list (the researched compromise — rejected by the user for authenticity). **Paired visual+collider descriptors** keep mesh + collision locked.

**friction-score:** 3

## D188 — Visual quality is driven by an adversarial WORKFLOW HARNESS (research → build → critics/defect-hunters read the actual renders + code → ranked fixes → iterate) (Session ACAK)
**When**: ACAK — the iteration method for getting the mega-wreck to high quality across a long session.

**Why**: "Build → screenshot → self-critique" (rule 8) works but a single agent grades its own work leniently. Fanning the critique across N independent adversarial agents that READ the rendered PNGs (and, for defects, the geometry code with line numbers) surfaces far more — floating/clipping/see-through/collision-gap issues a builder misses — and the ranked dedup'd output is a concrete fix list. It caught real bugs (a global HemisphereLight washing the whole scene; solid props with no colliders; a gameplay-blocking unclimbable step) a screenshot glance would not.

**Picked**: Reusable Workflow scripts — `megawreck-research`/`-interior-research` (web→spec), `megawreck-critique` (4 lenses score a rubric off the renders), `megawreck-interior-defects` (4 lenses hunt defects off renders + code). Re-run each round to verify convergence. **Key footgun learned**: the critique is only as good as the RENDER — early rounds scored a "near-black squat blob" because the rig-shot was backlit + framed end-on (foreshortening the 136m dagger); fixing the rig lighting (front-key + fill) + framing (length-revealing 3/4 angles, shell-frame interior cams) was a prerequisite for trustworthy critique. **Considered**: solo self-critique (insufficient at the AAA bar the user wanted). Cost is real (each hunt ≈ 5 agents / 200-290K subagent tokens) — justified for a hero asset, not for routine work.

**friction-score:** 1

## D189 — Hand-modeled hero wreck collision = ONE trimesh baked from EVERY mesh (not hand-authored cuboids) (Session ACAL)
**When**: ACAL — the user walk-tested the ACAK mega-wreck and could clip through most of the model; the coarse hand-authored cuboid proxy (flank slabs + caps + a few prop blockers) only roughly bounded the hull. The ask: "EVERYTHING on the model has collision that exactly matches the shape of the model."

**Why**: The wreck is a lofted faceted hull + canted decks + ribs + debris + island + engine bells — fundamentally non-boxy. An *exhaustive* cuboid set that genuinely can't be clipped through would need dozens of tilted cuboids tracking the loft at every station, drift from the mesh the moment the geometry changes, and still leave facet-seam gaps. A trimesh wraps the actual rendered surface exactly (zero drift, no clip-through by construction). The player is a slow KinematicCharacterController capsule (low tunnel risk), and Rapier handles capsule-vs-static-trimesh well.

**Picked**: In `placeMegaWreck`, traverse the built group; for every Mesh (except flat fake-AO/scorch `CircleGeometry` decals), clone its geometry → non-indexed → bake `invGroupMatrix × mesh.matrixWorld` (so verts land in **body-local**, which already includes the `shellQuat/shellPos` tilt because the meshes are children of the tilted shell) → push positions → ONE `RAPIER.ColliderDesc.trimesh`. This ELIMINATES the manual `extCuboid` shell-transform replication (the trimesh inherits the tilt from the mesh hierarchy). Kept ONLY: invisible deck-edge curbs + the entrance ramp (no mesh equivalent). The `makeLoftedHull` masses are OPEN-ended tubes → the FRACTURE gap is naturally open in the trimesh = the walkable entrance. Panels/journal are added AFTER the trimesh build → stay interactive, not solid blockers. **Considered**: exhaustive cuboids (rejected — high authoring cost, drifts, leaves gaps); a convex hull (rejected — fills the walkable cavity). **Caveat**: a full-model trimesh is many tris; acceptable for ONE hero wreck (static body, BVH built once, narrowphase only near the player) — NOT a pattern to copy onto all ~80 procgen wrecks (those want the merge-by-material + simpler colliders of the deferred T6). **friction-score:** 2

## D190 — The wreck is lit by NATURAL world light only; no per-object lights or unlit decals (Session ACAL)
**When**: ACAL — the user found the ACAK interior lighting (additive god-ray cones + per-wreck PointLights + a fracture "daylight flood") unrealistic, and saw "floating pink light rectangles" around the hull. "Remove all the lighting and just have the natural world lighting."

**Why**: Per-object fill lights + fake god-ray cones read as artificial in a survival sim that otherwise lives on one global sun/ambient (D180-era lighting). And — the subtle bug — the rust-streak DECALS used an **unlit `MeshBasicMaterial`**: MeshBasic ignores scene lighting, so once the artificial lights were removed and the hull correctly darkened, the streaks kept their flat reddish color and read as glowing rectangles floating off the hull. Lesson: an unlit/emissive material on a dark-scene prop will GLOW relative to its surroundings — only use MeshBasic for things meant to self-illuminate (screens, actual lights), never for weathering/decals.

**Picked**: Deleted the entire interior light block (cones + ~8 PointLights), the console-glow + ember PointLights, and the (A9) rust-streak decal planes. Interior daylight now comes only from the real openings (fracture + breaches + open hull ends); the lit hull-shader rust (`createRustedHullMaterial` streakIntensity) carries the weathering without glowing. Accepted that the interior is darker (the user's explicit call); if too dark the fix is WIDER openings, not fake lights. **Considered**: keeping a dim bounded fill (rejected by the user); converting the streak decals to a lit Lambert material (would stop the glow but the user wanted them gone). **friction-score:** 1

## D191 — Two reusable wreckForms upgrades (hull `thickness`, former-ring `arc`) + the "sample the surface at the piece's own X/Z" anti-float rule (Session ACAL)
**When**: ACAL — the user flagged the hull as "paper thin" edge-on and asked to hunt + fix interior floating pieces.

**Why (thickness)**: `makeLoftedHull` lofted a single zero-thickness surface; at any torn/open edge (fracture, bow tip, transom) the camera sees the paper edge. Real hull plating has thickness. **Why (arc)**: `makeFormerRings` built FULL tori; placed at the hull cross-section center, the lower ~half-arc hangs ~5m below the inset walkable deck (`deckY = keelY + 5.5`) in the unfloored belly → reads as a floating hoop. **Why (the rule)**: ~16 of the interior floaters traced to ONE bug class — a piece's Y (or anchor) sampled ONCE at a cluster/section CENTER, then placed at a spread of X/Z on the ~17°-canted deck or the curved ceiling, so it floats/sinks away from the real surface.

**Picked**: (1) `makeLoftedHull(stations, mat, thickness)` — optional second inner skin (sections inset by `thickness`) + rim caps at the two open ends; mega-wreck hull uses 0.4m. (2) `makeFormerRings(..., {arc})` — partial `TorusGeometry` with the gap auto-centered at the bottom (`geo.rotateZ(π/2 − arc/2)`); ribs use 1.5π → top-arcs that spring from the deck (+ short leg-stubs tying the free ends down per-Z). (3) Shared `ceilingY(x,s)` / `hullHalfWAt(y,s)` ellipse samplers used to EMBED beam/duct/bracket ends into the real curved skin, and a discipline of sampling `deckY(z)` at each prop's OWN z (not the cluster center). Both wreckForms options are backward-compatible (default 0 / 2π) so the procgen fleet is unaffected until T3 opts in. **friction-score:** 1

## D192 — Wreck draw-call perf = merge static meshes by material AFTER per-part colliders; merge the right (sub)group (Session ACAM)
**When**: ACAM — the never-cut T6 perf merge. Wrecks dominate the wreck-related draw calls; the mega-wreck alone was 491 meshes.

**Why**: Each wreck builds dozens of small static meshes (one draw call each). Merging the static, non-interactive ones into one geometry per material collapses that to a few. Two ordering gotchas make-or-break it.

**Picked**: NEW `mergeStaticByMaterial(root)` (wreckForms.ts) — traverse, collect meshes that are NOT in a `userData.accessPanel` subtree and NOT `transparent`, bake each to ROOT-LOCAL (`rootInv × mesh.matrixWorld`, the D189 bake), group by (material uuid, has-uv, cast/recv shadow), `mergeGeometries` per group, add merged mesh tagged `noCollider`, remove + dispose originals. **Gotcha 1 (order):** `attachCompoundCollider` builds ONE collider per child mesh by geometry TYPE — it MUST run BEFORE the merge, else the whole wreck collapses to one giant AABB. Rapier colliders are independent of the meshes, so removing the visual meshes after is safe. **Gotcha 2 (which group):** for a wreck with a tilted SUB-group framed by something (the mega-wreck's `shell`, which the rig-shot interior cameras key off), merge the SUB-group (bake to its frame + leave it populated), not the root — merging the root empties the shell + breaks the interior camera (the geometry is still correct in-world, but the verification camera mis-frames). Transparent meshes left unmerged (per-object depth-sort). **Results:** mega-wreck 491→79, fleet ~254→52. **Hero-only-ish caveat:** the 3 other flagships (megaShip/satelliteDish/crashedHull) are bigger hogs but lack verification rig-shots → deferred (don't merge unverifiable stable assets, rule 8). **friction-score:** 2

## D193 — Measure before optimizing: the "wrecks dominate ~4900 meshes" claim was wrong (Session ACAM)
**When**: ACAM — planning the T6 perf merge, an exploration agent (+ a prior changelog note) asserted wrecks were ~4900 of ~4900 scene meshes.

**Why**: Acting on it would have over-invested in the procgen FLEET (only ~250 meshes total). A per-top-level-child mesh breakdown (added to the `perf-probe` rig-shot) showed the real picture: ~5000 meshes split across 131 Groups (3590m, mostly hand-modeled flagships + POIs), ~996 individual scatter meshes, and the mega-wreck alone at **491**. The hogs are the hand-modeled FLAGSHIPS, not the procgen fleet.

**Picked**: Added a biggest-objects breakdown to `perf-probe` (sort scene.children by mesh count). Re-scoped T6 to target the mega-wreck (491→79, the single biggest win) + the full fleet, and DEFER the other flagships (need verification first). **Lesson (general):** a perf claim in docs/agent-output is a hypothesis — measure the actual distribution before choosing where to optimize; the dominant cost is often one or two hand-authored hero assets, not the procgen many. Also: the rig-shot uses a RANDOM seed per boot, so cross-boot draw-call/mesh numbers aren't comparable — measure the optimization's DIRECT effect (the merge's before→after counts) instead of a cross-seed A/B. **friction-score:** 1

## D194 — Procgen smooth-cylinder hulls → faceted ship sections via the shared lofted-hull (rotated to the +X convention) (Session ACAM)
**When**: ACAM — T3, leveling up the procgen fleet's visual vocabulary to match the hero.

**Why**: The procgen hull variants used smooth `CylinderGeometry` (read as pipes); the hero mega-wreck reads as a ship because of `makeLoftedHull`'s faceted SHIP_SECTION (flat keel + hard chines + flat dorsal deck). Reusing the toolkit primitive makes the fleet consistent with the hero + amortizes the ACAJ-T1 investment.

**Picked**: RIBBED_CYLINDER + PANELED_TAPERED build `makeLoftedHull([{z:0,…},{z:len,…}], mat, ~0.1)` then `rotation.y = π/2`. **Axis gotcha:** `makeLoftedHull` lofts SHIP_SECTION along **Z** (the hero convention: long-axis Z, cross-section XY); the procgen convention is long-axis **+X**, radius in YZ. So loft along Z (stations z:0..len) then `rotation.y = π/2` maps local +Z→world +X (keel stays down, the section's width maps to world Z). `makeFormerRings` is ALREADY +X-oriented (internal `rotation.y=π/2`) so it needs NO extra rotation in the procgen path — the opposite of the mega-wreck which rotates it −π/2. Thickness is SMALL here (~0.1m; procgen wrecks are 3-6m, not the 136m hero). The boxy/truss/barrel/antenna variants stay (intentionally different). `findPanelMount` raycasts the new surface fine (bury-audit 61/63, all procgen panels pass). Only the 2 smooth variants converted — a measured, verified swap, not a fleet-wide rewrite. **friction-score:** 1

## D195 — Name hero/flagship assets so verification can find them; the static-merge covers them too (Session ACAN)
**When**: ACAN — extending the T6 static-merge to the 3 hand-modeled flagships (megaShip/satelliteDish/crashedHull), which D193 showed were the real mesh hogs but ACAM deferred because they had no verification rig-shot.

**Why**: Merging stable hero assets blind violates rule 8 (don't ship unverifiable changes). The blocker was verification, not the merge itself — so the fix was to make them verifiable, then merge + confirm render-identity.

**Picked**: (1) Gave each flagship `group.name = '<kind>'` in its place function. (2) NEW generic `flagship` rig-shot scenario (`--name=<group.name> --angle=<3q|side|front>`) that FINDS the named object in the scene, frames its exterior by world-bbox, lights it, AND returns its descendant mesh count — so the before/after merge drop is built into the verification (no separate instrument). (3) Called `mergeStaticByMaterial(group)` before each flagship's return — merge the ROOT (these have no subgroup framed by a camera, unlike the mega-wreck `shell` per D192) since their collision is hand-built static boxes (independent of the visual meshes → merge order is moot). Results: megaShip 160→67, satelliteDish 148→47, crashedHull 51→44; all render structurally identical (panels/dish-struts/fuselage-bands intact). **General lesson:** if a hand-authored hero asset isn't findable by a verification harness, NAME it + add a find-by-name framer before optimizing it — the naming is the cheap enabler. The merge now covers every big wreck/flagship in the game. **friction-score:** 1

## D196 — A salvage panel's outward normal (+Z) must point AWAY from the hull; the bury-audit reads +Z (Session ACAN)
**When**: ACAN — the mega-wreck's 2 lee-flank salvage panels had failed the bury-audit since ACAL ("hull@0.22<panel@0.73") and the ACAL panel-reachability concern was unresolved.

**Why**: `panelBuryAudit` (debugPanel.ts) computes each panel's outward direction as its **local +Z** in world, raycasts from `pos + outward*0.8` inward, and fails if hull is hit grossly before the panel. The lee-flank panels were placed with `addPanel(local, +π/2)`; the faceYaw rotates the panel's +Z to +X, but the panel is on the −X flank — so +Z pointed INTO the hull. The panel faced inward, recessed outward, and the audit started its ray INSIDE the hull → instant occlusion. A 0.08m "proud" nudge couldn't fix a 180°-wrong facing.

**Picked**: `addPanel(local, −π/2)` so the panel's +Z faces −X (truly outward); the recess then goes into the hull (correct). Bury-audit went 61/63 → **68/68 ALL CLEAR**. **Lesson:** `addAccessPanel`'s +Z is BOTH the visible face normal AND the audit's "outward" axis AND the recess-away axis — so the faceYaw must orient +Z to the true outward direction of the mounting surface (away from the hull interior), not just "toward where the player stands." For a −X flank that's −X (faceYaw −π/2); a +π/2 sign error faces it backwards. friction-score: 1

## D197 — `makeBreach` holes don't read on small procgen hulls (no boolean cut); kept the flat damage patch (Session ACAO)
**When**: ACAO — re-applying the ACAN-reverted T5 breach swap on the now-frameable procgen hulls (RIBBED_CYLINDER, ~line 390): swap the flat dark `addBreachPatches` box for a real `makeBreach` torn-hole.

**Why**: `makeBreach` (wreckForms) does NO boolean cut — it's a recessed dark void disc + collar + ragged flaps placed relative to the skin, designed for the 136m hero where the scale sells it as a blown-open hole. On a small procgen hull (~1m radius) it fails both ways: placed recessed, the INTACT hull skin in front OCCLUDES the dark void (nothing reads as a hole); pushed proud so the void clears the skin, the flaps + collar read as a crusty BUMP. Verified with the NEW `procgen-wreck` framer across 3 iterations (recessed → big-proud → revert) — exactly the kind of "can't make it read" wall rule 8 says to stop forcing.

**Picked**: Reverted to the flat `addBreachPatches` (a dark recessed-looking box that reads reliably as battle damage at this scale) and put T5's value into the richer greeble vocabulary (3→7 types) + impact-flank asymmetry instead. **Lesson:** a decal-style "breach" built from a recessed void only reads when the hull actually has an opening there (a real cut or a built-in gap) OR the asset is big enough that the torn flaps alone sell it. A small intact hull needs either a genuine geometry cut (this codebase avoids CSG) or a flat dark scar — don't force the hero's breach primitive onto sub-meter hulls. If real procgen holes are wanted later, loft the hull WITH a gap rather than decaling over intact skin. **friction-score:** 1

## D198 — The remaining draw-call hogs were the hand POIs never given the static-merge; harden the merge to skip interactType (Session ACAP)
**When**: ACAP W1 — a measure-first long overnight ("finish the wreck arc"), starting from a `perf-probe` read instead of assuming T7 LOD was needed.

**Why**: T6/ACAM/ACAN merged the procgen fleet + the 4 flagships, but a NEW `perf-probe` deep-dump (`topGroupsDeep` — a child-kind histogram of the biggest scene children) showed the remaining 80-134-mesh groups were the OTHER hand-modeled POIs that were never merged: the **opening wreck** (always rendered at spawn), **rockyEntrance**, **saltOutpost**. Not the procgen fleet (already ~10-50 each), not a need for distance-LOD. Classic D193: measure WHERE the cost is before optimizing.

**Picked**: (1) Added `mergeStaticByMaterial` to `placeOpeningWreck`/`placeRockyEntrance`/`placeSaltOutpost` after their colliders are built (D192 order; the opening wreck uses hand-built cuboid colliders, the entrances use `attachCompoundCollider`), named each for the `flagship` rig-shot. Render-identical: opening wreck ~80-130→**13**, rockyEntrance →**37**, saltOutpost →**28**. (2) **Hardened `mergeStaticByMaterial` to skip any `userData.interactType` ancestor** (journals/loot/triggers), not just `accessPanel`/`noMerge` — so merging an arbitrary hand POI can't silently fold a live interaction into a static mesh. This de-risks merging ANY POI. (3) **CUT heavy distance-LOD** (the planned T7): the merge already won the draw-call budget; the remaining big groups are mesh-heavy *already-merged* procgen wrecks (bulk_haulers, many material groups — LOD territory but low ROI) + the speeder (86 meshes, but animated/interactive parts → unsafe to merge unattended) + pickups (340 branch+scrap, but instancing breaks the per-item take-raycast). **Lesson:** the static-merge is the high-ROI, low-risk wreck-perf lever; LOD/instancing is the long-tail with real risk. Sweep EVERY unmerged hand POI through the merge before reaching for LOD. **friction-score:** 1

## D199 — Fix flat-grey wrecks at the SHARED hull material (form-AO + oxidation zones), not per-wreck (Session ACAP)
**When**: ACAP W3 — the procgen hulls (and even the detailed flagships) read flat-grey/monochrome; needed depth.

**Why**: Every wreck (procgen + all flagships + opening wreck + mega-wreck hero) uses `createRustedHullMaterial`. Improving the ONE shared material is the highest-leverage move — it lifts the entire fleet in a single change — vs. per-wreck tinting (which would fragment the shared material into many instances/programs, hurting the merge + draw calls). The material already had wear/streak/bleach but read flat because: `wearAmplitude` was only 0.15 (little plate-to-plate variation), rust darkened toward near-black (grime, not rust), and there was NO form/AO darkening (so the hull had no volume).

**Picked**: Added 3 layers on top of the existing 3: **(4) form-AO** — down-facing/underside surfaces darken (`uAoStrength` 0.34) → volumetric read (pure value, lowest-risk); **(5) bare-metal scuff flecks** — sparse high-freq chipped-paint spots, side-biased; **(6) oxidation zones** — a low-freq field tints zones toward a warm rust-brown (`uOxColor` 0x6b4326, `uOxStrength` 0.32) = COLOR depth, the main flat-grey fix. Bumped `wearAmplitude` 0.15→0.20. **Blast-radius verified** across procgen corvette + bulk_hauler + the mega-wreck hero + the megaShip flagship — all read weathered-with-depth, none over-rusted/muddy. **Lesson:** when N assets share a procedural material, fix the look at the material (one verified change lifts all); just verify the change across the full RANGE of assets that use it (small procgen + big hero + flagship) so you don't over-tune for one. **friction-score:** 1

## D200 — In-group crash debris at local-y = buryY so it folds into the merge AND rests on the sand after the half-burial sink (Session ACAP)
**When**: ACAP W4 — adding crash-debris fans to procgen wrecks for crash-site storytelling, without a perf regression.

**Why**: Debris wants two contradictory things: (a) sit on the TERRAIN surface (so it needs world/terrain placement), and (b) fold into the wreck's `mergeStaticByMaterial` (so it costs ~0 draw calls — the W1 perf goal). The existing `placeDebrisField` adds debris to the SCENE (correct terrain, but unmerged → +draw calls × 80 wrecks). Adding debris to the wreck GROUP merges it, but the group sinks by `buryY` (half-burial, T4) → debris at local-y≈0 ends up BELOW the terrain (invisible).

**Picked**: A NEW `addDebrisFan` adds 2-4 fragments to the wreck GROUP *before* the merge (so they fold in, same materials → ~0 extra draw calls), positioned at **local-y = buryY** — so AFTER the group sinks by `buryY` the debris lands at ~terrain height, resting on the sand. The slight terrain-align tilt is inherited (fine — debris on the crash-site slope). All `isWreckDecoration` so `findPanelMount` avoids them. Verified across seeds (debris rests on sand, not buried/floating; bbox grows past the flank confirming placement; bury-audit ALL CLEAR). **Lesson:** to merge a decoration that must sit on terrain onto a BURIED/transformed parent, pre-compensate its local transform by the parent's bury/offset so it lands correctly in world space after the parent transform — you get the merge's perf win without the terrain-placement loss. **friction-score:** 1

## D201 — A rare DESTINATION biome is a distance-override disc around a seed-derived anchor, NOT a noise band (Session ACAQ)
**When**: ACAQ Y1 — adding the `wreck_yard` biome for Cycle 8. The biome system (`biomes.ts`) is a pure low-freq simplex NOISE field discretized by thresholds (dune/rocky/salt).

**Why**: A "rare destination" wants ONE contiguous region per seed at a controlled distance from spawn. A 4th noise threshold gives MANY scattered wreck_yard cells (noise-distributed), not a single destination — the wrong shape. But the biome infra (terrain ground-tint + height + scatter/loot gating) is exactly what a destination region wants for free.

**Picked**: Add `'wreck_yard'` as a DISTANCE-OVERRIDE biome: the sampler picks a seed-derived anchor (polar, 620-1000m from the spawn anchor) at construction, exposes `wreckYardAnchor`/`wreckYardRadius` + a `wreckYardAt(x,z)` STRENGTH field (1 in the core, smoothstep→0 at the edge), and `biomeAt` returns 'wreck_yard' within ~50% radius. `terrain.ts` blends ground color + flattens height toward the wreck-yard values by `wreckYardAt` (so the region reads distinct + the POI/loot/scatter systems gate on `biomeAt==='wreck_yard'` for free). The POI placement (placeWreckYard) reuses `biomes.wreckYardAnchor` as the graveyard center. **Lesson:** for a SINGLE controlled-placement region in a noise-driven biome system, don't add a noise band — add a distance-override around an exposed anchor + a 0..1 strength field for the terrain blends; you get a contiguous destination + reuse the whole biome consumer chain. Threading the 4th biome needs widening any hardcoded `'dune'|'rocky'|'salt'` unions (found 2 in shrew/lizard spawn signatures). **friction-score:** 1

## D202 — A stationary hazard pulls the player by injecting an external velocity into the KCC `desired` vector (Session ACAQ)
**When**: ACAQ Y4 — the Sarlacc pit must DRAG the player toward its throat (a continuous pull, unlike the sandworm's single-frame bite).

**Why**: The player is a kinematic character controller (KCC). Directly `setNextKinematicTranslation`-ing the player toward center (from the pit's late-tick update) would OVERRIDE the controller's own per-frame translation (computed earlier from input) → input is lost, and the KCC timing fights it (translation() reads the pre-step position). A clean pull must route THROUGH the KCC's collision/slope solve so the player slides toward center along the terrain.

**Picked**: A one-frame `ctx.player.externalPullX/Z` (m/s) field. The pit ACCUMULATES the pull into it each frame (direction = toward center, magnitude ramps with proximity × openAmt). The controller, just BEFORE `computeColliderMovement(collider, desired)`, adds `desired.x/z += externalPull * dt` then clears the field. So the pull composes with input + routes through collision (slides along terrain, respects the existing horizontal clamp). **Lesson:** to apply an external force to a KCC, don't fight the controller with a competing `setNextKinematicTranslation` — add a one-frame impulse field that the controller folds into its movement REQUEST before the solve. The pull MAGNITUDE/escape-ability is feel-critical (a trap must be escapable but scary) → flagged for an attended walk-test; the headless harness can confirm the wiring (smoke test: player pulled 5.6m→0.3m + bitten) but not the feel. **friction-score:** 2

## D203 — Merge a dense POI at the PARENT level by re-parenting its members via group.attach (Session ACAQ)
**When**: ACAQ Y6 — the wreck-yard graveyard (~30 already-merged wrecks) measured 2055 draw calls in-field.

**Why**: Each `placeProcgenComposite`/`placeWreck` already merges its OWN wreck (1-few meshes) + adds it to the SCENE. But 30 wrecks × a few meshes = ~hundreds of draw calls when the whole field is in view. The D198 cluster-merge says: merge at the CLUSTER/parent level. The wrecks are scene-direct, though — no parent to merge.

**Picked**: placeWreckYard creates a `yardGroup`, and after each placement `yardGroup.attach(group)` re-parents the returned wreck group into it (`attach` preserves the world transform — the wreck stays put), then `mergeStaticByMaterial(yardGroup)` collapses ALL the wrecks' static hulls into per-material meshes. Salvage panels (accessPanel) stay live (the merge skips them); per-part colliders were built earlier (independent). Result: **2055→1664** draw calls. **Lesson:** to merge a dense field of independently-placed (scene-direct) props, re-parent them into one group via `Object3D.attach` (world-transform-preserving) then merge the group — no need to thread a `parent` param through every placement function. Remaining hogs not captured this way (added to scene INTERNALLY, not returned — the sand mounds/debris/ribcages) need either a `parent` opt or a separate merge pass; flagged. **friction-score:** 1

## D204 — A recessed terrain hazard is carved into the shared heightfield, not modeled as a mesh sitting in a hole (Session ACAR2)
**When**: ACAR2 — user feedback that the Sarlacc pit read as a raised sand-MOUND on top of the dunes; it should sink INTO the sand like the Great Pit of Carkoon.

**Why**: A pit can be faked two ways: (a) a mesh "hole" placed on flat ground, or (b) actually deforming the terrain. (a) breaks the moment the player walks up to it — the ground stays flat, the player walks over the maw, no sense of descending into a trap. (b) is the real thing: the terrain itself funnels down.

**Picked**: Carve the funnel into the terrain's shared `heights` array (terrain.ts height loop) — a radial smoothstep depth on distance to `biomes.sarlaccPitAnchor`, deepest at center (`SARLACC_PIT_CRATER_DEPTH`), eased to 0 at the clearing rim. Because the SAME `heights` array feeds the visual mesh, the Rapier heightfield collider, AND the bilinear `heightAt()` sampler, ALL THREE dip together: the player physically walks/slides down into the bowl, the maw mesh's origin auto-lands at the carved floor (spawn reads `heightAt(anchor)`), and props scattered nearby sit on the funnel walls. **Two gates:** (1) wall slope must stay under the KCC `maxSlopeClimbAngle` (50°) or the player softlocks at the bottom — the smoothstep profile spreads peak slope to ~39° at depth 13 / clearing 24, escapable on foot; the pull force (D202) is what makes it a trap, not an inescapable slope. (2) The depression alone reads weakly under flat overhead light, so the sand is also color-dusked toward center (a shadowed-pit tint) — the gradient sells the recess. **Lesson:** to sink a hazard into the world, deform the terrain heightfield (one source of truth for mesh+collider+sampler), don't model a hole; gate the wall slope against the character-controller climb limit so the player can still get out. **friction-score:** 2

## D205 — To static-merge an INTERACTIVE/ANIMATED object, tag the live parts noMerge; keep the collider mesh-independent (Session ACAS)
**When**: ACAS A2 — extending `mergeStaticByMaterial` (the wreck draw-call win, D192/D198) to the player's hover speeder, an object that is mounted, driven, toggled (headlamp), and tows a sled.

**Why**: The merge bakes a group's static meshes into per-material meshes and REMOVES the originals (`om.parent?.remove(om)`), which also removes their subtrees. For a wreck that's harmless; for an interactive object it would silently break the mount trigger, the toggled headlamp disc, the sled-anchor tow-bar, and any LIGHT parented to a merged mesh.

**Picked**: A checklist that makes the merge safe on a live object: (1) the merge already SKIPS any subtree tagged `userData.interactType`/`accessPanel`/`noMerge` (it walks UP the parent chain), so the mount seat is auto-preserved; tag the remaining live meshes (headlamp disc — material swapped on toggle; tow-bar — world-pos read each frame; antenna — carries the beacon light) `userData.noMerge`. (2) Lights that are DIRECT children of the merged root survive (they're not meshes); a light parented to a MERGED mesh is lost with it — so tag that mesh `noMerge` (the up-the-chain skip then spares the whole subtree). (3) The collider must be INDEPENDENT of the meshes — the speeder's is hand-defined cuboids built in placeSpeeder, so merging the visual meshes can't collapse it (unlike a wreck, whose per-part collider must be built BEFORE the merge). **Verify wiring, not feel:** a rig-shot (`speeder-fx`) asserts every `getObjectByName`/state ref still resolves + sits in the graph + the body still drives (speed>0); the mount/drive FEEL needs an attended walk-test. **Lesson:** static-merge generalizes from inert props to interactive objects IF you tag every live/animated/light-bearing mesh `noMerge` and the collider is mesh-independent — then eval-verify the refs survive. **friction-score:** 2

## D206 — A dropped-item collider picks its SHAPE from a hint but derives its SIZE from the mesh bbox (Session ACAS)
**When**: ACAS B2 — every dropped item used one snug cuboid, so long-thin items (pipe/rifle/branch) and round items (flask/orb) settled as chunky boxes.

**Why**: Two ways to do per-item shapes: (a) hardcode half-extents per item (the audit's first proposal), or (b) hint only the SHAPE and compute the SIZE from the viewmodel's bounding box. (a) is brittle — every viewmodel tweak silently desyncs the collider, and the numbers are guesses.

**Picked**: An optional `ItemDef.colliderHint` ('box'|'sphere'|'capsule'); `spawnDroppedPickup` reads it and builds: a ball sized to the mean bbox half-extent; a capsule whose axis = the bbox's LONGEST dimension (rotated onto it via `setFromUnitVectors`), radius from the smaller two; else the legacy cuboid. Size always tracks the real mesh, so it can't desync. Omitted hint = unchanged behavior (safe rollout); pickup raycast keys on `userData` tags so the shape never affects interaction. Verified the WIRING (a `drop-test` rig-shot + a `dropTestItem` dev hook drops capsule/sphere/box pickups, ticks, asserts each body settles finite + near terrain — no NaN/explosion from the capsule rotation); the settle FEEL (does a capsule lie more naturally) is flagged for an attended walk-test (the audit's headless-limit note). **Lesson:** when adding per-instance physics shapes, hint the shape + derive the size from existing geometry rather than hardcoding dimensions — robust to art changes, and default-off keeps it a safe additive change. **friction-score:** 1

## D207 — Procedural-material program collapse: uniforms + runtime branches, and `pbr` rides the base-material class (Session ACAT)
**When**: ACAT T3 — converting the 7 remaining procedural material factories (glass/bone/stone/paint/wood/fabric/skin) from per-instance `.toFixed()`-baked GLSL constants to uniforms, to cut the compiled-program count (faster real-GPU startup).

**Why**: Each factory's `onBeforeCompile` baked per-instance values into the GLSL string, so every distinct param combo compiled a SEPARATE program (~105 total). The D175/D177 fix added a per-instance `customProgramCacheKey` (correct, but it's what GREW the count). Metal was converted in ACAH (the template); this finishes the rest.

**Picked**: Move per-instance VALUE params to `shader.uniforms`, and convert any opts that change the INJECTED SOURCE (the `localSpace` vertex branch; wood's `bark` conditional; fabric's `useLocalCoords`/`disableShimmer`-shimmer) into RUNTIME uniform branches (`(uX > 0.5) ? a : b`, `if (uX > 0.001){…}`). Then the injected source is IDENTICAL across all instances of a factory → Three's DEFAULT cache key (which is `onBeforeCompile.toString()` when no custom key) shares ONE program within the factory + still distinguishes factories (different `.toString()`). So `customProgramCacheKey` is DROPPED. **Key insight for the pbr-fork factories (fabric/skin):** the `pbr` flag forks the BASE material class (`MeshStandardMaterial` vs `MeshLambertMaterial`), which is part of Three's default key — so the `if (opts.pbr)` blocks can STAY compile-time conditionals (they ride 1:1 with the base class; the default key separates them) while only the value params + base-class-independent source-conditionals need converting. Result: **programs 105→67 (−36%), boot shader-compile 270→197ms.** **Lesson:** to collapse onBeforeCompile-patched material variants, make every per-instance difference a uniform/runtime-branch so the injected source is identical, then drop the per-instance cache key (the default `onBeforeCompile.toString()` key does the rest) — but a structural fork that already changes the BASE material class needs no key (Three distinguishes it natively). The catch-net is a per-factory material-identity rig-shot (a uniform/branch bug renders wrong). **friction-score:** 2

## D208 — A registry whose registration consumes the shared RNG can't be conditionally skipped without desyncing the world (Session ACAT)
**When**: ACAT T2 — tried to fix the salvage-panel bury-audit by skipping registration of panels the assembled wreck occludes (an outward-clearance gate in `placeProcgenComposite`).

**Why**: `registerSalvageable(registry, o, kind, pos, rand)` consumes `rand()` internally (condition tier + loot roll). The procgen world is generated from ONE shared `rand` stream threaded through every placement. Conditionally SKIPPING a `registerSalvageable` call removes its `rand` draws → every downstream draw shifts → the whole world (wreck positions, parts, later panels) regenerates differently. The audit confirmed it: the panel count moved 122→133 and the target fails were untouched (the skip fired on LATER panels, desyncing everything after).

**Picked**: Reverted the gate. **Lesson:** when a system is driven by a single seeded RNG stream, any per-item branch that changes how many `rand()` draws happen is a world-changing side effect — you cannot "skip" an RNG-consuming step to filter items. The correct shape is **register-all-then-prune**: let every item consume its RNG normally (stream intact), then in a SECOND pass remove the unwanted ones from the registry (removal consumes no RNG). Also: a raycast-based occlusion check must update the FULL subtree world matrix (`updateWorldMatrix(true, true)`) or descendant geometry is missed (the audit updates the wreck root; the naive gate only updated the panel + ancestors → the panel's door/rim were stale → the raycast missed). The real fix (register-all-then-prune + full matrix update, matching the audit raycast) is deferred; the residual is a pre-existing ~3% cosmetic dev-audit tail. **friction-score:** 2

## D209 — Lift a duplicated GLSL helper by GENERATING it with caller-supplied names, not by renaming call sites (Session ACAU)
**When**: ACAU — the D207 stretch: 11 procedural material factories (metal/hull/stone/paint/wood/glass/bone/skin/fabric/concrete/terrain) each hand-copied the identical IQ integer-hash value-noise + fBm GLSL block, with cosmetic differences (the hash is named `<x>Hash` in most but `<x>Hash21` in the terrain lineage; the fBm runs 3 octaves in some, 4 in others). Goal: one source of truth without changing any rendered pixel.

**Why**: Two ways to dedup. (a) Lift to ONE shared snippet with fixed names (`dfHash`/`dfValueNoise`/`dfFbm`) and rewrite every external call site in each factory's colour logic. (b) Keep a GENERATOR (`iqNoise2D({hash,valueNoise,fbm,octaves})`) that emits the block with each factory's EXACT existing names + octave count, so zero call sites change. (a) is more "DRY" but touches dozens of call sites across 11 files — and a missed/typo'd GLSL identifier is invisible to tsc (the names are strings) and only fails as a runtime shader-compile error.

**Picked**: (b) — `NEW world/shaderNoise.ts`. The emitted GLSL is byte-for-byte what each file declared inline, so the compiled programs are unchanged and rendering is provably pixel-identical; the only diff per file is import + replacing the ~25-line block with a one-line call. **Verification that's actually decisive here:** `perf-probe`'s program count is the catch-net — it was 67 before and after (a broken/typo'd factory would fail to compile → the count or a `[browser error]` shifts), plus a `procgen-wreck` before/after pixel-diff (hull/metal/terrain) and tsc. **Lesson:** when lifting a duplicated shader/string helper, prefer a generator parameterised by the existing identifiers over a rename sweep — it makes the change provably identical (no call-site churn) and side-steps the "GLSL name typo is invisible to the type-checker" trap. Confirm with the program-count invariant, not just tsc. **friction-score:** 1

## D210 — Bury-pruning runs at TWO scopes (per-wreck self + cluster-merge cross-wreck) and excludes the door to match the open-door audit (Session ACAU)
**When**: ACAU — implementing D208's deferred register-all-then-prune so the `panels` bury-audit reaches 0 fails.

**Why**: The per-wreck self-prune (raycast each panel against its own `placeProcgenComposite` `group`) caught 3 of the 4 seed-1337 fails but not the 4th. An occluder-trail diagnostic added to `panelBuryAudit` showed why: `rootName:"wreckYard"` — the survivor was buried behind a NEIGHBOURING wreck's hull, which only becomes an occluder AFTER `placeWreckYard` re-parents every wreck into `yardGroup` and `mergeStaticByMaterial`s the whole yard into cluster-level meshes. A single-wreck raycast structurally cannot see a sibling wreck. Separately, the prune disagreed with the audit on door state: the audit force-OPENS every door before testing (panel's nearest surface = the recessed rim), but at world-build time doors are CLOSED, and a proud closed door yields a tiny `dPanel` that masks the occluder.

**Picked**: (1) Export `pruneBuriedPanels(root, records, registry)` and call it at BOTH scopes — once per wreck inside `placeProcgenComposite` (standalone desert wrecks; self-occlusion), and once in `wreckYard.ts` AFTER `mergeStaticByMaterial(yardGroup)` over the yard's registry slice, raycasting the whole `yardGroup` (mirrors the audit's walk-up `root=wreckYard`, so cross-wreck buries are caught). (2) In the raycast, SKIP hits under the panel's `userData.panelDoor` subtree so `dPanel` is always the recessed rim regardless of door state — reproducing the audit's open-door geometry without animating doors at build time. Result: `panels` audit **0 fails across 5 seeds**; seed 1337 133→129 panels (drops exactly the 4 D208 predicted). **Lesson:** an occlusion/visibility prune must run at the SAME geometric scope the verifying audit uses — if the audit raycasts a post-merge cluster root, a per-instance prune is necessarily blind to cross-instance occlusion; prune at every scope where geometry gets combined. And when build-time state differs from audit-time state (closed vs forced-open doors), neutralise the difference in the predicate (exclude the moving part) rather than trying to replay the audit's mutations. The trail-diagnostic-then-revert pattern (instrument the audit to name the occluder + root, run once, revert) was what turned "still 1 fail" into the actual root cause. **friction-score:** 2

## D211 — Dropped-item collider: revert per-shape hints to the cuboid; a sphere rolls, a thin capsule tunnels (Session ACAV, reverses D206)
**When**: ACAV — the user walk-tested ACAS B2's per-item `colliderHint` (box/sphere/capsule) and disliked the feel: dropped items "spin around weirdly and sometimes fall through the terrain."

**Why**: A `ColliderDesc.ball` (sphere) ROLLS — on a dune it keeps rolling/spinning instead of settling; a `ColliderDesc.capsule` rolls about its long axis AND its radius floored at 2cm (vs the cuboid's 4cm), thin enough to tunnel the heightfield even with CCD on. The original ABM behaviour — one snug `cuboid` sized to the mesh bbox — settles flat (its faces grip the dune) and is thick enough not to tunnel.

**Picked**: Reverted `pickups.ts` to always build the cuboid; removed the capsule scratch vars. The `ItemDef.colliderHint` field + per-item tags are now dead but harmless (an optional field that's set but unread → no tsc error). **Lesson:** "more accurate physics shapes" is not automatically better feel — for *dropped loot* that should plant where it lands, a box's flat faces + non-rolling are the feature; rolling/spinning capsules+spheres read worse and the thin capsule radius is a tunnelling hazard. D206's headless `drop-test` only proved "doesn't NaN / does settle," never the feel — exactly what its own note flagged. **friction-score:** 1

## D212 — Salvage-panel TERRAIN cull is SURFACE-scoped, not global; one validatePanels, register-all-then-prune (Session ACAV)
**When**: ACAV Tier 0+1 — fixing the "panels phase through terrain" bug (there was NO terrain check anywhere in placement).

**Why**: Two findings shaped it. (1) The bury raycast lived in THREE drifting copies (`pruneBuriedPanels`/`panelBuryAudit`/wreck-yard gate; D210 already showed drift), so I unified them into one `validatePanels` (NEW `world/panelPlacement.ts`, imports only THREE+Tuning — cull via an injected callback to avoid the salvage circular dep) before adding checks. (2) A terrain check seemed like it should be global, but instrumenting the audit (root-name trace) showed interior panels are LEGITIMATELY below the terrain surface — `rockyEntrance` chamber (−2.05m), `crashedHull` bell-throat, the mega-wreck interior. Terrain-culling them globally would delete reachable loot.

**Picked**: Terrain culling runs ONLY on the SURFACE-wreck gen paths (procgen composite + the legacy `placeWreck` branch that was never covered before — the worst phase-through offender — + the wreck-yard cluster), each via register-all-then-prune (every panel registers, consuming `rand`; the RNG-free cull removes buried ones — never conditionally skip `registerSalvageable`, D208; this also let me drop the wreck-yard center-point gate that DID conditionally skip it). The check is **center-clearance** (cull a panel whose centre sits below terrain+margin), NOT 4-corner — a 0.7m-tall panel on a crashed hull naturally dips its lower edge toward the sand, so corner-testing over-culls normal panels; only a submerged CENTRE means "phased through." The global `panelBuryAudit` stays occlusion-only (a surface-scoped terrain audit is deferred to Tier 5). **Considered alternatives:** global terrain cull (rejected — kills interior panels); 4-corner clearance (rejected — over-culls partial-burial); a margin of +0.10 (rejected — over-culled; relaxed to −0.10 = tolerate partial burial, cull only fully-submerged). **Lesson:** a "universal" geometric gate often isn't — scope it to where its assumption (here, "below the ground surface ⇒ unreachable") actually holds; interiors break it. **friction-score:** 2

## D213 — Shape-agnostic panel mount: bounding-sphere rays + full quaternion, fixed 1-rand budget (Session ACAV)
**When**: ACAV Tier 2 — fixing "panels at weird angles / not flush" + making placement survive future wreck-model changes.

**Why**: The old `findPanelMount` cast a jittered grid against the part's **±Z bounding-box flanks** (assumes a vertical cylinder — fails on cockpits/bells/boxes/any future hull) and **snapped the facing to the nearest 90°** (`Math.round(atan2/(π/2))*(π/2)`), so panels never sat flush on curved/angled surfaces. It also consumed a VARIABLE number of `rand` draws (grid shuffle + per-candidate jitter), coupling the world RNG to placement internals.

**Picked**: NEW `findSurfaceMounts` — generate Fibonacci-sphere directions (RNG-free) rotated by ONE seeded offset, cast each from outside the part's bounding sphere INWARD to hit the REAL surface (works on any shape), score each candidate over the panel FOOTPRINT (push each footprint point out by a clearance and cast back: `|d−clearance|≤tol` + normal-agreement = flat AND clear, which subsumes decoration avoidance), and orient via a FULL quaternion from `makeBasis(right, up, normal)` so local +Z = the real surface normal → flush on curved/angled hulls. The ONE `rand` (the rotation offset) is the entire per-panel RNG budget regardless of how many directions are tried — fixed-budget, D208-safe; 48 dirs + an early-exit on a high-quality mount keep boot cheap (perf-probe boot 964ms, programs 67). `addAccessPanel` gained an optional `orientQuat` (recess composes along local −Z; yaw-only path reproduces the legacy math exactly); `addAccessPanelOriented` wraps it. **Lesson:** to make procedural placement robust to future geometry changes, sample the ACTUAL mesh surface (sphere-cast + real normals) rather than assuming part shapes/anchors; and keep a fixed per-item RNG budget so the sampler can't desync the seeded world no matter how its internal search branches. **friction-score:** 2

## D214 — Panel shape variants: 'square' = rect aspect-1; 'circle' = a bolted LIFT-OFF cover that reuses the door's open-state plumbing (Session ACAW)
**When**: ACAW Tier 3 — adding square + circular salvage panels alongside the rect hatch.

**Why**: A panel's whole interaction (the bury-audit/prune EXCLUDE the door subtree for open-door parity; `completePry` sets `panelDoorTarget`; `updatePanelDoors` lerps `panelDoorAngle`) is keyed off `body.userData.panelDoor` + the existing angle float. A new shape that introduced its own open-state would have to re-wire all of that. And a circular HINGED hatch is awkward — the hinge edge on a circle is arbitrary and the `-panelDoorAngle` swing math is coupled to the rect left-edge.

**Picked**: Two geometry paths, not three: `'square'` collapses to rect with aspect 1 (the only real fork is rect-family vs circle). `'circle'` = a CylinderGeometry bore + a thick bolted torus ring rim + a disc cover on a `coverPivot` that is NAMED `body.userData.panelDoor` — so the door-exclusion + `completePry` apply UNCHANGED. The cover is a bolted LIFT-OFF, not a hinge: `updatePanelDoors` branches on `panelShape === 'circle'` and slides it out + tumbles it ajar, NORMALISED by the open-angle (`t = angle/OPEN_ANGLE`) so it tracks the same 0..1 lerp the hinge does — reusing the entire `panelDoorAngle/Target` float with no new state. Shape is added via the absent-⇒-identical `AccessPanelOpts` (every existing caller + the regression baseline byte-unchanged); procgen derives it from already-rolled values (zero new world-rand). **Lesson:** to add a variant to an object with a rich interaction contract, make the variant REUSE the contract's existing state fields (here: name the new pivot what the system already drives, and re-express the new motion as a function of the existing animation scalar) rather than adding parallel state — the audit, the prune, and the gameplay all keep working for free. **friction-score:** 2

## D215 — Rich panel interior = MERGED decorative greeble + the unchanged 5 lootables; merge BEFORE parenting under the accessPanel (Session ACAW)
**When**: ACAW Tier 4 — overhauling the salvage-panel interior into a scrappy pipes/fuses/machinery/wires/rust look without exploding the loot economy or the live-mesh count.

**Why**: Two tensions. (1) Loot: the user wanted a much richer interior but the loot economy (`COMPONENT_LOOT`, `salvageRemaining` semantics, the index-ordered extract) is keyed to exactly 5 extractable components. Making the new detail all lootable would rebalance loot + need save work. (2) Perf: ~68 panels × ~30 new greeble meshes is a lot of live geometry, and the wreck-level `mergeStaticByMaterial` SKIPS `accessPanel` subtrees (panels stay live for animation), so the greeble would never get merged by it.

**Picked**: Split DECORATIVE greeble (rich set-dressing, NOT tagged `panelComponentIndex` — built by the new `world/panelGreeble.ts` library + `buildGreeble(archetype)`) from the 5 LOOTABLE components (reuse the existing 7 `PanelComponentKind`s → `COMPONENT_LOOT` + loot economy + save are UNCHANGED). Merge the greeble per-panel HERE, BEFORE parenting it under the body — at that moment it has no `accessPanel` ancestor, so `mergeStaticByMaterial(greeble)` folds it; then parent. All greeble uses shared singleton materials so the whole new system reuses existing shader programs (perf-probe stayed 67 — and a `glass.material.transparent = true` MUTATION of a shared singleton briefly pushed it to 69 until fixed). Also: pushed the backplate to the body BACK for real cavity DEPTH (the shallow mid-cavity plate read flat) + moved the pry-glow anchor central so it lights the deep greeble; both are attended-feel-owed (the headless audit force-opens doors without igniting the glow). **Lesson:** when enriching the visuals of a gameplay object, separate the COSMETIC layer (merge-able, freely elaborated) from the MECHANIC layer (the few tagged interactables) so the look can go maximal while the economy/contract stay fixed — and when a per-instance subtree is excluded from a global static-merge, merge it yourself before it enters the skip-zone. **friction-score:** 2

## D216 — A core procedural mechanic gets a multi-seed "scalability gate" that a future content change re-runs (Session ACAW)
**When**: ACAW Tier 5 — the user's explicit "it must still work if we change the wreck-model generation later."

**Why**: Salvage-panel placement reads the real wreck geometry; a future wreck-model edit could silently re-bury panels or break flush mounting, and a one-off manual check wouldn't catch it. The placement correctness IS already machine-checkable (the `panels` bury-audit, run per seed, exercises every procgen class probabilistically + the hand-modeled flagships + the wreck-yard cluster).

**Picked**: Package the existing audit into ONE command — `npm run verify:placement` (`scripts/verify-placement.mjs`) sweeps the `panels` bury-audit across a seed set and PASSES iff every seed reports 0 fails (parsing stdout, since rig-shot's teardown can exit non-zero AFTER the audit prints). Documented the CONTRACT in `architecture.md`: any new wreck class / flagship must pass `verify:placement` before shipping. Chose the multi-seed full-world sweep over a bespoke per-class "torture" harness because the sweep already covers all the placers (including the cross-wreck-merge cases that a single-wreck rig can't) and reuses the proven audit. **Lesson:** when a mechanic's correctness depends on procedural CONTENT that will keep changing, the durable guarantee isn't "I verified it once" — it's a named gate (one command) that re-runs the existing audit across enough seeds to exercise every code path, plus a written contract that ties shipping new content to passing it. **friction-score:** 1

## D217 — Salvage-panel interior as a STENCIL PORTAL ("window into the hull"), with a DEPTH-GATED mask so it's visible through the wreck hull ONLY, not the world (Session ACAX)
**When**: ACAX — user: "the panel is clipping through the wreck model with the interior totally hidden... make the interior visible through the [wreck] model" (the recessed cavity could clip into the hull, which then occluded the interior). Later: "interior visible through the terrain and sides — only the wreck model, not anything else in the world."

**Why**: A recessed panel cavity intersects hull geometry; with normal depth the hull occludes the interior. Naive fix (interior `depthTest:false`) shows it through the hull but ALSO bleeds it through terrain/dunes/side-walls/far-side panels — it draws over everything in the opening's screen window.

**Picked**: A stencil portal (`world/panelPortal.ts`, renderer built `{stencil:true}` in `core/scene.ts`). A per-panel MASK mesh at the mouth writes `stencil=REF`; the interior materials (`_panel*` + all of `panelGreeble.ts`, shared singletons) draw `stencilFunc EQUAL` + `depthTest:false` + `transparent:true`, so they paint over a clipping hull but stay confined to the mouth. The KEY refinement: the MASK itself RESPECTS depth (`depthTest:true` + a negative polygonOffset to win the coplanar flush hull surface it mounts SURFACE_EPS proud of) — so it writes its window ONLY where the mouth is genuinely visible. Terrain / dunes / side-walls / a far-side panel behind the near hull all FAIL the mask's depth test → no window → the interior is correctly occluded by the WORLD, while the interior's own `depthTest:false` still draws over the RECESSED hull behind the visible mouth. **Considered alternatives:** depthTest-off mask (the bleed bug); a separate cleared-depth pass like the D170 viewmodel (per-frame full-scene re-traversal — worse perf); per-panel stencil refs to kill 2-open-panel overlap (would explode the shared-material/program budget — instead the breaker-board's full backing board covers the overlap). Making the interior materials transparent is a bounded +shared programs (still ≤72); keep them shared singletons. **friction-score:** 3

## D218 — Salvage interior redesigned realism-first (DIN-rail breaker board) via an adversarial design WORKFLOW; fixed skeleton + modules-over-bays = WYSIWYG deplete with zero new logic (Session ACAX)
**When**: ACAX — user, after several scattered-greeble iterations: "this is far from what we need, it looks like a cluster of components... the interior needs to make sense, everything should have a place where it belongs and is realistic... if this means getting rid of all the coils/valves/gauges then lets do that and start from scratch. verify adversarial every time."

**Why**: The greeble (breaker banks, coils, valves, gauges) placed at jittered positions + random rotations + random depths read as "junk tossed in a box", not an engineered panel. Realism = flush-mount to a back plane, grid/rows, logical zones, routed wiring — alignment + repetition, NOT scatter.

**Picked**: Ran a 3-concept design Workflow (DIN-rail breaker board / LRU card rack / zoned board), adversarially judged → DIN-rail board won (closest to the corroded-breaker reference + the cleanest depletion read + WYSIWYG-correct with the engine). Implemented (`panelGreeble.ts` `makeBreakerBoard`/`makeBreaker`/`buildSalvageComponents`): a FIXED skeleton (mounting board + brass bus bar + 3 DIN rails + wiring trough + terminal + 12 grid-aligned empty bay-SOCKETS + labels, merged, NOT salvageable) + 5 salvageable BREAKER modules clipped onto the first 5 bays at the SAME slot+depth. Because extraction only HIDES (no spawn), hiding a module reveals its fixed socket underneath — zero new logic. ZERO position/rotation jitter (alignment is the realism; decay comes only from rust materials + dead lenses). Per-archetype variety on ONE skeleton (toggles / screen cards / a gauge-valve accent column). `mergeStaticByMaterial` gained an `includeTransparent` opt (the portal materials are transparent so they were never merging) — the board is built strictly back-to-front so the merged buffer order is the correct draw order; collapses ~100 sub-meshes to ~1/material (sceneMeshes 21k→8.6k). **Lesson:** for "make it look real, not like a pile", the realism lives in a FIXED engineered SKELETON (aligned grid + routed wiring) that the salvageable parts plug INTO; the parts then deplete from the front leaving sockets, and it reads right full/half-gutted/stripped. **friction-score:** 2

## D219 — WYSIWYG salvage: the count of VISIBLE interior parts EQUALS the count you can extract (hide surplus at registration; persist extracted indices) (Session ACAX)
**When**: ACAX — user: "the number of items you can salvage should match the items that disappear... if I can only salvage one thing, there should only be one thing visible; if a panel is full of components, they should all be salvageable."

**Why**: `salvageRemaining` was capped at registration (by condition: corroded 1-2, pristine 5) INDEPENDENTLY of the always-5 built components — so a corroded panel showed 5 parts you could only take 2 of (the rest stayed). Visible ≠ salvageable.

**Picked**: In `registerSalvageable` (`salvage.ts`), after computing the condition count, HIDE the surplus components (index ≥ count) + cap `salvageRemaining` to the built count. So visible == salvageable (audited headless: NEW `salvage-audit` scenario, 0 mismatches / 99 panels). With the breaker board (D218), the hidden surplus is the higher-index bays → a corroded panel reads "picked over" (mostly empty sockets), pristine reads "full board". `save.ts` gained an OPTIONAL `extractedIndices?: number[]` (additive, NO save-version bump) so a half-salvaged panel re-hides the same parts on reload. **friction-score:** 1

## D220 — Panel door 50% pop-off: a pried door SHEARS LOOSE + falls with real physics, reusing the dropped-item pattern (Session ACAX)
**When**: ACAX — user: "make it so the panel doors have a 50% chance to pop off and fall to the ground with real physics like the items."

**Why**: A satisfying "this is salvage, things break" detail. Needed to feel like the dropped items (real tumble + settle), not a bespoke animation.

**Picked**: NEW `world/panelDebris.ts`. On `completePry`, `Math.random() < SALVAGE_PANEL_POP_CHANCE` (0.5) → detach the door visual (`scene.attach`, preserving world pose), spawn a dynamic Rapier body sized to stored local half-extents (cuboid collider + CCD, mirroring `spawnDroppedPickup`'s friction/restitution), launch it OUTWARD off the hull + a slight upward arc + a random tumble (`setLinvel`/`setAngvel` = mass-independent), `playMetalClang`. A dedicated debris list (NOT the pickups list → not E-takeable) synced by `updatePanelDebris` after `updatePickups`; settled (sleeping) doors are skipped. Snap the open-state to fully-open so the cavity reveals immediately. Transient (not persisted — matches the door-open state never being saved). **friction-score:** 1
