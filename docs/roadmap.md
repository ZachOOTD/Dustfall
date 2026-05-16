# Roadmap

Next sessions in execution order. One-liner each + terse scope notes.
Detailed plans live in `.claude/plans/<session>.md` while active; on ship
they're archived + summarised in [changelog.md](changelog.md).

When done with a session, the `/session-end` skill removes the "Next" entry
and promotes the second.

---

## Next — Big-ticket bucket (1–2 picks per session at ~4–7h each)
Pick whatever feels most missing after the polish + atmosphere arc.

- Raider variants (scout / ambusher / brute) — *if* we decide to bring raiders back
- Q2: Rigged hands + lizard (GLB-dependent — deferred with N's asset work)
- Base-building mechanics
- Small red creature companion (pocketable + re-deployable)
- Weapon variants (pipe staff / scrap machete / scrap gun / energy pistol)
- Trading / NPC economy
- 7-day storm countdown
- Bounties (template: D39 `'mount'` singleton-interactable pattern from CC-2)
- Procedural world generation (idea — POIs randomized per seed)
- World rework #2 — biome rescale + scatter retune (4-5h): BIOME_NOISE_FREQ 1/220 → 1/900, cactus/tree/well counts rescaled, `findBiomeCentroid()` helper.
- World rework #3 — procgen POIs + biome-aware AI spawns (4-6h): 6 anchor POIs + ~15 Poisson-disk procgen POIs (250m min separation); ~28 lizards, salt-excluded, density-by-distance.
- Wreck POI rework: accurate collision, connected geometry (no floaters), less boxy, more curves + detail
- New POI: wrecked satellite dish
- Sled / rope / scrap-metal sled (physical-inventory drag-along, towable behind speeder)
- Lizard-on-a-stick cooking system (raw lizard + branch → roast over fire)
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
- **Title screen — "real-world render" variant** (idea, deferred from
  CC-3): instead of the dedicated title scene, render the actual game
  world behind the menu — camera floating around the opening-scene wreck,
  parallax on the pod-crash narrative. Higher-effort cinematic intro.
