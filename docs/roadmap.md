# Roadmap

Next sessions in execution order. One-liner each + terse scope notes.
Detailed plans live in `.claude/plans/<session>.md` while active; on ship
they're archived + summarised in [changelog.md](changelog.md).

When done with a session, the `/session-end` skill removes the "Next" entry
and promotes the second.

---

## Next — Storm + fog visual rework (~5-7h)
Full pass on sandstorm + fog realism: layered dust depth, fog-density
curve tied to sky color, terrain darkening near peak, screen-edge tint
at full intensity. Pairs with X's storm-tense music stem; replaces
current uniform-color dust + linear fog with something that reads as a
real weather event. Now that the mega-wreck silhouette through fog is
a key visual (BB-2/BB-3), the fog itself deserves attention.

## Then — Big-ticket bucket (1–2 picks per session at ~4–7h each)
Pick whatever feels most missing after the polish + atmosphere arc.

- Raider variants (scout / ambusher / brute) — *if* we decide to bring raiders back
- Q2: Rigged hands + lizard (GLB-dependent — deferred with N's asset work)
- Hover speeder bike for fast travel
- Giant sand worm enemy
- Base-building mechanics
- Small red creature companion (pocketable + re-deployable)
- Animated main menu (pod crash + flickering fire + day/night loop)
- Weapon variants (pipe staff / scrap machete / scrap gun / energy pistol)
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
