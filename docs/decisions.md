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
