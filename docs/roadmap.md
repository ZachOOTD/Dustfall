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
- **Next** — Extend procedural-shader treatment from terrain to wreck hulls. New shared `src/world/hullMaterial.ts` (~150-200 LOC) — `createRustedHullMaterial({baseColor, rustHex?, bleachHex?})` patches MeshLambertMaterial via onBeforeCompile to add vertical rust streaks (vertically-stretched FBM `(wx * 8, wy * 0.5)` attenuated by `(1 - vWorldNormal.y)` — only on side / down-facing surfaces), low-freq panel wear patches, sun-bleached top surfaces via `smoothstep(0.6, 0.95, vWorldNormal.y)`. D62 — uses `vWorldNormal` not `vNormal`. Apply to 3 flagship wreck modules (satelliteDish.ts `_rustedSteelMat`, engineBlock.ts `_hullMat` + `_bellOuterMat`, crashedHull.ts `_hullMat` + `_hullDarkMat`). Flat-shaded primitives produce per-triangle effect bands which is intentional (reads as per-panel wear states). Lathe surfaces (crashedHull fuselage) get smooth gradients. Skip shared wreck builders in wrecks.ts for now (procgen + mega_wreck use those — risk too wide). Defer: concrete weathering, dune wind-streak overlay, rocky biome shader. ~5h.
- Concrete weathering shader for satellite-dish base (`_concreteMat`, `_concreteDarkMat`) — salt-leach staining at low points, mineral mottling, aggregate noise. ~1-2h.
- Aeolian wind-streak overlay shader added to dune surface in terrainMaterial.ts — long thin streaks running with `DUNE_WIND_DIR_RAD`. ~1h.
- Rocky-biome shader — currently rocky just inherits terrainMaterial.ts slope effects with no dedicated pattern. Add stratification bands + fissure cracks similar to salt cracks but rust-tinted. ~1-2h.
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
