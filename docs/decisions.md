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
