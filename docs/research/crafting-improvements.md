# Research: Survival-Crafting Material & Recipe Taxonomies

**Researched**: 2026-07-17
**Trigger**: Design ambiguity — next campaign "Scavenger's Economy" needs a leaner material set + improved bench-free recipe flow; goal is 4–5 new ItemIds building on existing `scrap`, per-POI loot identity, deeper multi-material recipes.
**Depth**: medium

## Summary

Fallout 4's 35-component system and The Long Dark's location-gated crafting validate leaner material counts (not 200+) as the sweet spot for inventory pressure without clutter. Recipe discovery in modern survival games (Enshrouded, Subnautica 2) auto-unlocks recipes on material collection, mirroring Dustfall's existing discovery gate; bench-free crafting is precedented in Fallout: New Vegas campfire system. Per-POI loot tables (Dune: Awakening) prove location identity matters for engagement and should anchor material drops.

## Key findings

1. **Material count: 30–35 components is the ceiling.** Fallout 4 runs exactly 35 distinct components; The Long Dark uses diverse resource categories (pelts, cloth, chemicals, leather) totaling ~20–25 distinct types. Beyond 35, inventory clutter exceeds meaningful decision-making pressure. — sources: [Fallout 4 components list (Game8)](https://game8.co/games/Fallout-4/archives/456247), [The Long Dark crafting analysis (itch.io)](https://itch.io/blog/772877/the-crafting-system-of-the-long-dark)

2. **Junk-to-component breakdown keeps scavenging intentional.** In Fallout 4, "junk" items (ashtrays, telephones, toys) scrap into components (adhesive, copper, circuitry) at a workbench; this indirection creates a secondary salvage decision (keep raw junk vs. break down now?). Kenshi's economy fails partly because raw scavenging outputs often exceed craft-value, making crafting feel wasteful. — source: [Fallout 4 junk system (GameRant)](https://gamerant.com/fallout-4-pro-tips-gathering-scrap-building-materials/), [Kenshi economy design (Kenshi Wiki)](https://kenshi.fandom.com/wiki/Crafting)

3. **Recipe auto-unlock on first material collection drives discovery without tutorial overhead.** Enshrouded and The Survivalists both auto-reveal recipes when you collect an ingredient; Subnautica 2 requires blueprint scans (one-time). For bench-free systems, auto-unlock on collection mimics discovery and keeps flow fluid (no popup roadblock). — sources: [Enshrouded crafting guide](https://expertgamereviews.com/complete-enshrouded-crafting-guide-npcs-recipes-progression/), [Subnautica 2 blueprints](https://gamerant.com/subnautica-2-how-scanning-blueprints-work/), [The Survivalists blueprint unlock](https://progameguides.com/the-survivalists/how-to-unlock-blueprints-in-the-survivalists/)

4. **Multi-material recipes (3–4 materials per recipe) drive strategic depth without exponential complexity.** Subnautica 2 exemplifies this: Scanner = 2 Titanium + 1 Circuit Board + 1 Battery. Each material has distinct loot sources and value profiles, forcing trade-off decisions (e.g., "use copper for ammunition or circuits?"). Single-input recipes don't create pressure; single-output recipes breed hoarding. — source: [Subnautica 2 recipes (Narcosis)](https://www.narcosis-the-game.com/list-of-all-subnautica-2-crafting-recipes-june-2026-complete-guide/)

5. **Per-POI loot tables create location identity and guide exploration.** Dune: Awakening assigns unique loot tables to each POI archetype (Testing Stations drop rare schematics; Spice Fields drop Spice-infused materials). The Long Dark's "loot table 1–4" system identifies world locations by what's scavengeable there. Players internalize "refinery = electrical components; crashed tank = metal + fuel" and optimize route planning. — sources: [Dune: Awakening loot tables (Method)](https://www.method.gg/dune-awakening/deep-desert-companion), [The Long Dark loot tables](https://thelongdark.fandom.com/wiki/Loot_Table)

6. **Repair as an economy drain keeps crafted gear meaningful.** The Long Dark and Project Zomboid both feature degradation + repair costs that consume components; this prevents endgame stagnation and keeps late-game loot runs necessary. Repair recipes should cost slightly less than initial craft to avoid frustration. — source: [Survival game economy design (GameDesignSkills)](https://gamedesignskills.com/game-design/survival/), [Project Zomboid repair/crafting integration](https://gamerant.com/best-games-deep-crafting-systems-ranked/)

7. **Bench-free "quick-access" crafting is proven (Fallout: New Vegas campfire system).** Rather than force workbench interaction, Fallout: New Vegas allows crafting at any campfire (location-agnostic but still a deliberate stop). Dustfall's anywhere-press-C approach is *more* fluid and matches Enshrouded's behavior. The constraint: ensure discovery gates are discoverable without a tutorial tooltip. — source: [Fallout: New Vegas crafting guide (GameFAQs)](https://gamefaqs.gamespot.com/pc/959559-fallout-new-vegas/faqs/61226)

8. **Scarcity drives meaningful decision-making; inventory pressure without clutter requires ~3–5 'decision-critical' materials.** Of Fallout's 35 components, fewer than 10 are actively bottlenecks (adhesive, circuitry, nuclear material). Kenshi's problem: too many materials, none rare enough. Dustfall should aim for 4–5 *new* materials where each solves a different recipe class (fuel, armor, electronics, medical, structural). — sources: [Fallout 4 adhesive farming (GameRant)](https://gamerant.com/fallout-4-pro-tips-gathering-scrap-building-materials/), [Survival inventory design (GamingYou)](https://gamingyou.com/gaming-guides/1759794-how-to-manage-your-inventory-in-survival-games-in-2025)

## Recommended material set for Dustfall

**Current inventory**: `scrap` (generic salvage), `cloth`, `branch`, + consumables/tools.

**Proposed additions** (4 new ItemIds, each anchored to POI archetypes):

### 1. **`wiring`** (electrical components)
- **Drop sources**: Refinery Stack, Hab Dome, Relay Mast, Cargo Crawler, Skyfall Freighter (hero), Leviathan (hero) — anywhere with power infrastructure.
- **Recipes**: Signal Kit (existing, but wiring → signal amplifier), future torch mods, remote triggers.
- **Scarcity**: Moderate; requires cutting/salvage skill discovery (implies later-game).
- **Why it earns a slot**: Electronics are thematically distinct from metal scrap; future game loops (signal/trap-craft, vehicle mods) will demand it.

### 2. **`fuel`** (refined hydrocarbons)
- **Drop sources**: Wrecked Tank, Cargo Crawler, Transit Car, Buried Pipeline, Skyfall (hero) — transport/energy infrastructure.
- **Recipes**: Torch fuel, campfire accelerant, future vehicle/generator crafts.
- **Scarcity**: High early-game (only from containers/salvage panels), normalizes mid-game with repeatable refinery recipes.
- **Why it earns a slot**: Fuel is story-critical (The Long Dark, Rust); camp/light management ties to survival tension. Also creates an economy drain (consumption for heating/cooking).

### 3. **`metal`** (refined structural material)
- **Drop sources**: Wrecked Tank, Debris Field, Buried Pipeline, Bone Field (wreck scrap), Skyfall (hero), Leviathan (hero) — anywhere with corroded/torn structures.
- **Recipes**: Machete, cans, armor plates, traps.
- **Scarcity**: High; salvage panels + wrecks, not abundant ground loot.
- **Why it earns a slot**: Distinguishes raw `scrap` (junk) from refined `metal` (tool-grade). Dual-material recipes (cloth + metal = armor) force trade-offs. Fallout's adhesive analog: active bottleneck.

### 4. **`casing`** (synthetic/polymer components)
- **Drop sources**: Hab Dome, Cargo Crawler, Transit Car, Relay Mast (panel/housing salvage).
- **Recipes**: Flask seals, medical kit components, container repairs, future electronics housings.
- **Scarcity**: Moderate-high; late-game material (most ground loot is wood/cloth/branch).
- **Why it earns a slot**: Weathering/polymers thematically tie to hab structures + consumer goods. Fills a niche Dustfall hasn't occupied (seal/containment craft).

### 5. (Optional, if depth is desired) **`chemical`** (refined solvents/catalysts)
- **Drop sources**: Refinery Stack (primary), Hab Dome (medical supply), Buried Pipeline (spillage).
- **Recipes**: Disinfectant, adhesive (tying recipes together), fire-starters, water purification.
- **Scarcity**: Very high; only specific POI types + late-game refinement.
- **Why**: Creates multi-step craft chains (raw scrap → chemical → finished item). Refinery becomes a destination. **Caveat**: adds complexity; defer to Phase 2 if initial set feels tight.

**Mapping to Dustfall's existing POI archetypes** (from `docs/roadmap.md` S4 + landmarks):
| POI Archetype | Primary Drop | Secondary Drop | Salvage Panel Material |
|---|---|---|---|
| Derelict (wreck) | `scrap`, `metal` | `cloth`, `branch` | `wiring` or `metal` |
| Satellite | `wiring`, `casing` | `scrap` | `wiring` |
| Wrecked Tank | `metal`, `fuel` | `scrap` | `fuel` |
| Debris Field | `scrap`, `metal` | `cloth` | `metal` |
| Hollow Husk | `scrap`, `cloth` | `branch` | `wiring` (if power-bearing) |
| Well | `branch`, `cloth` | (none) | (none) |
| Debris Trail | `scrap`, `metal` | `cloth` | `metal` |
| Relay Mast | `wiring`, `casing` | `scrap` | `wiring` |
| Buried Pipeline | `fuel`, `metal` | `scrap` | `fuel` |
| Cargo Crawler | `metal`, `casing`, `fuel` | `cloth` | `metal` or `casing` |
| Refinery Stack | `fuel`, `chemical` (future) | `wiring` | `fuel` or `wiring` |
| Hab Dome | `wiring`, `casing`, `chemical` | `cloth` | `casing` |
| Transit Car | `metal`, `casing`, `fuel` | `scrap` | `casing` or `fuel` |
| **Skyfall Freighter** (hero) | `metal`, `wiring`, `fuel` | `cloth`, `scrap` | `wiring` |
| **Leviathan** (hero) | `metal`, `wiring` | `cloth` | `wiring` |
| **Bone Field** (biome) | `scrap`, `metal`, `branch` | (none, bones are deco) | (none) |

## Recipe pattern recommendations (bench-free)

1. **Auto-unlock on first material collection.** When the player loots their first `wiring`, the recipe card system should unlock 1–2 recipes using `wiring` (e.g., "Signal Amplifier"). This mirrors Enshrouded and avoids a separate "blueprint find" gate. **Implementation**: tag recipes with `unlocksOnMaterial: 'wiring'` and check `recipeDiscovery` state at end of each loot event.

2. **Multi-material depth without exponential growth.** Recipes should use 2–4 materials, with at least one "bread-and-butter" material (like Fallout's adhesive or Dustfall's current `scrap`). Example recipes:
   - Torch upgrade: `cloth` (fuel wick) + `metal` (barrel ring) + `wiring` (battery contact) = "Reinforced Torch" (lasts 20% longer, harder to break).
   - Flask seal: `casing` + `metal` = "Sealed Flask" (no spill on rough terrain).
   - Trap: `metal` (spring) + `branch` (frame) + `fuel` (trigger mechanism) = "Pressure Trap".
   
   This keeps recipe cards scannable (rarely more than 4 ingredients visible) and forces decision-making ("do I use my wiring here or save it for a signal item?").

3. **Repair recipes: 60–70% of craft cost.** If a "Reinforced Torch" costs `cloth` + `metal` + `wiring` to craft, repair it at 50% of original cost (or just `cloth` + `wiring`). This creates a soft economy drain while avoiding the "throw away and re-craft" trap. **Track via**: `maxDurability` on each kit/tool ItemId; `recipeDiscovery` should include repair cards.

4. **Saleable byproducts for economy loops.** Loot some pre-crafted items (half-built kits, partial assemblies) that can be either finished (craft cost: 30% of full recipe) or sold to an NPC (future mechanic) for resources. This creates a "optimize for now vs. invest for later" decision.

5. **Don't gate new POI archetypes behind craft recipes.** The Scavenger's Economy should *enable* exploration (you unlock shelter gear → can camp in new biomes) but not *require* a recipe to access a location. Gating is via loot availability + inventory pressure, not gating recipes.

## Contrarian or surprising

- **Repair is not a "quality-of-life drag"; it's an economy design tool.** Players resent repair costs in online games (Rust, Eve) because they feel like gold-sinks. But in singleplayer survival (Long Dark, Project Zomboid), repair costs keep endgame interesting by forcing continued scavenging. Dustfall should lean into repair as a *choice* (mend a tool vs. craft new), not a tax.

- **Bench-free crafting *reduces* discovery friction vs. workbench-gating.** Fallout 4's workbench gates are often complained about (travel cost, animation, UI); Fallout: New Vegas's campfire system felt more immersive. Dustfall's anywhere-press-C is a *feature*, not a limitation. The real gate should be recipe discovery (do you know it exists?) and material scarcity (do you have the inputs?), not location access.

- **Fewer total materials, tighter scarcity bottlenecks.** Kenshi's economy failed partly because it had ~15–20 craftable materials with no clear hierarchy. Fallout fixes this by having only ~3–5 *actively scarce* components (adhesive, circuitry, nuclear material) while the rest are "nice to have." Dustfall should design for the same pattern: 4 new materials, but only 1–2 are ever truly hard to find (e.g., `wiring` for mid-game, `chemical` for late).

## Open questions for Zach

1. **Repair vs. re-craft balance**: Should players be able to fully repair tools indefinitely, or should repair degrade durability (e.g., tool can be repaired 3 times before it breaks permanently)? The Long Dark uses the latter; it creates finality.

2. **"Scrap" identity going forward**: Does raw `scrap` remain the bread-and-butter, or does it split into `scrap_metal` (from wrecks) + `scrap_electronics` (from wiring) + `scrap_fabric` (from clothing)? Keeping it unified is simpler; splitting it adds depth but complexity.

3. **Salvage panel drops**: Should salvage panels always drop their dedicated material (refinery panel → fuel), or should they have a roll table with a chance for a rarer alternative (refinery panel → 70% fuel, 20% wiring, 10% chemical)? The latter creates more exploration tension.

4. **Durability + repairability on all tools or just kits?** Machete, torch, flashlight, canteen currently don't degrade in Dustfall. Should they? If yes, repair recipes unlock a new dimension of mid-game play (you manage your tool lifespan). If no, kits (fire_kit, tent_kit, signal_kit) remain the only repairable items, which is cleaner.

5. **"Hard cap" on material hoarding**: Dustfall's inventory has no weight limit currently (only slot count). Should materials/junk have a weight/volume penalty to create inventory pressure? Fallout 4's solution (shipments are weightless, junk is heavy) works well.

## Sources

- [The Long Dark crafting analysis (itch.io)](https://itch.io/blog/772877/the-crafting-system-of-the-long-dark) — Detailed breakdown of recipe structure, location-gating, and discovery flow.
- [Fallout 4 components list (Game8)](https://game8.co/games/Fallout-4/archives/456247) — Complete 35-component taxonomy and scrap mapping.
- [Fallout 4 junk system (GameRant)](https://gamerant.com/fallout-4-pro-tips-gathering-scrap-building-materials/) — How junk breaks down into components; adhesive bottleneck case study.
- [Enshrouded crafting guide (Expert Game Reviews)](https://expertgamereviews.com/complete-enshrouded-crafting-guide-npcs-recipes-progression/) — Auto-unlock via material discovery; experimentation-based progression.
- [Subnautica 2 blueprints (GameRant)](https://gamerant.com/subnautica-2-how-scanning-blueprints-work/) — Multi-material recipe structure (e.g., Scanner = Titanium + Circuit Board + Battery).
- [Subnautica 2 recipes (Narcosis)](https://www.narcosis-the-game.com/list-of-all-subnautica-2-crafting-recipes-june-2026-complete-guide/) — Concrete 3–4 material recipe examples.
- [The Survivalists blueprint unlock (Pro Game Guides)](https://progameguides.com/the-survivalists/how-to-unlock-blueprints-in-the-survivalists/) — Experimentation-driven discovery (craft first, unlock next).
- [Kenshi crafting (Kenshi Wiki)](https://kenshi.fandom.com/wiki/Crafting) — Economy failure case study (crafting outputs < material value).
- [Survival game economy design (GameDesignSkills)](https://gamedesignskills.com/game-design/survival/) — Sources vs. drains; scarcity as macro-economic pressure.
- [Project Zomboid repair/crafting (GameRant)](https://gamerant.com/best-games-deep-crafting-systems-ranked/) — Repair as ongoing resource drain; skill-based crafting.
- [Fallout: New Vegas crafting guide (GameFAQs)](https://gamefaqs.gamespot.com/pc/959559-fallout-new-vegas/faqs/61226) — Campfire crafting as bench-free precedent.
- [Survival inventory design (GamingYou)](https://gamingyou.com/gaming-guides/1759794-how-to-manage-your-inventory-in-survival-games-in-2025) — Clutter vs. pressure; categorization strategies.
- [Dune: Awakening loot tables (Method)](https://www.method.gg/dune-awakening/deep-desert-companion) — Per-POI loot table identity; location-based material anchors.
- [The Long Dark loot tables (Wiki)](https://thelongdark.fandom.com/wiki/Loot_Table) — Sandbox loot table system (1–4) and location identity.
