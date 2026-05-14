# Roadmap

Next sessions in execution order. One-liner each + terse scope notes.
Detailed plans live in `.claude/plans/<session>.md` while active; on ship
they're archived + summarised in [changelog.md](changelog.md).

When done with a session, the `/session-end` skill removes the "Next" entry
and promotes the second.

---

## Next — Y: Footprints + lizard tracks (~4h)
Player leaves footprints in sand; lizards leave running tracks when
they flee. Decals on terrain (RenderTarget or a long-lived particle
trail). Fades over time. Pure atmosphere/feel polish — pairs well
with the empty-world tone.

## Then — Z: Stone-well rework + tactile salvage panels (~5h)
Replace the current well visuals with a stone-circle well + wooden
hatch, restricted to the salt-flats biome (`biomes.biomeAt() === 'salt'`).
Switch salvage from "stare at wreck + hold E" to interactable panels /
access points on each wreck — more tactile.

## Later — Big-ticket bucket (1–2 picks per session at ~4–7h each)
Pick whatever feels most missing after the polish + atmosphere arc.

- Raider variants (scout / ambusher / brute) — *if* we decide to bring raiders back
- Q2: Rigged hands + lizard (GLB-dependent — deferred with N's asset work)
- Mega-ship POI with enterable explorable interior
- Hover speeder bike for fast travel
- Giant sand worm enemy
- Base-building mechanics
- Small red creature companion (pocketable + re-deployable)
- Animated main menu (pod crash + flickering fire + day/night loop)
- Tactile salvage via interactable panels / access points on wrecks
- Footprints in sand (player + lizard tracks)
- Stone-well rework (stone circle + wooden hatch, salt-flats biome only)
- Weapon variants (pipe staff / scrap machete / scrap gun / energy pistol)
- Torch + flashlight items
- Trading / NPC economy
- 7-day storm countdown
- Bounties
- Procedural world generation (idea — POIs randomized per seed)
- Remove HUD stat bars in favor of audio/visual/text cues (idea)

---

## Continuous polish (interleaved between numbered sessions)
- Environmental: dust motes in light beams, footprint puffs, distant cloud
  bank, mirage shader on salt-flat biome.
- Audio: source + commit CC0 sample pack into `public/audio/` (file
  contract in archived Session X plan). Architecture is in; soundscape
  activates each stem as its .ogg lands.
- HUD micro-polish: low-stat warning vignettes (cold = blue tint, thirst =
  brown), interact-prompt fade, low-stamina screen wobble.
- Crosshair feedback: thicken on interactable, red on enemy.
