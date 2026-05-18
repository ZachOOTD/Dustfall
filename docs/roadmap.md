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
- Wreck POI rework continued: `crashed_hull` dedicated module (LL did `engine_block`; `camp` deferred — already lean + functional). crashed_hull pairs `makeFuselage(3.2)` + `placeWreck(engine_bell, 2.4)` so reworking means replacing 2 shared wreck builders in lockstep; consider a `src/world/crashedHull.ts` matching the dish/engine_block template (LatheGeometry/curved primitives, per-piece tilted colliders, 2 salvage panels).
- Extend procedural-shader treatment beyond terrain: wreck hulls (rust-streak shader, paneled wear patches via onBeforeCompile patches on the shared wreck material) and/or satellite-dish concrete (weathered patches, salt-leach staining). Pattern from MM's `terrainMaterial.ts` is the template — inject world-position varying + custom attributes via onBeforeCompile, no bundle cost. Also worth: aeolian wind-streak overlay shader for the dune surface (long thin streaks running with `DUNE_WIND_DIR_RAD`), and a rocky-biome shader (currently rocky just inherits slope effects with no dedicated pattern).
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
