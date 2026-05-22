# Backlog

Unprioritized ideas, bugs, polish, debt. Tags:

- `[bug]` — something broken or visibly wrong
- `[feat]` — new gameplay or mechanic
- `[polish]` — feel, UX, visual refinement
- `[debt]` — code cleanup, refactor, doc improvement
- `[idea]` — speculative, needs validation before promotion

When ready to ship one, promote it into a session in [roadmap.md](roadmap.md).
Use `/triage-ideas` to bulk-classify a free-form dump.

---

<!-- entries below this line — newest at the bottom -->
<!-- (procedural world generation — shipped in AAI/AAK) -->
<!-- (creature companion — shipped in AAE) -->

[feat] atmospheric music tracks for day, sandstorm, and night
[feat] base-building mechanics
[idea] remove HUD stat bars in favor of audio/visual/text cues ("you could use a drink")
[feat] sandworm overhaul — AAL moved home to (900, 0) at world edge as a quick test fix. Real overhaul: procgen biome-seeded spawn (dune-biome rejection sampler, like wells in salt); possibly multiple worms per world; smarter detection (sound-based? footstep cadence?); deeper encounter design beyond "sees player → charges"
[feat] satellite dish structural-framework backing geometry — visible from above when player approaches from the convex side; currently uses DoubleSide as a known cheat (documented in satelliteDish.ts AAL comment)
[feat] engine block heat shield back panel — modeled thickness instead of FrontSide-only (AAL switched DoubleSide → FrontSide; back face is mostly occluded but a thin back layer would improve oblique-angle reads)
[idea] stamina tow factor playtest — current 2.0× drain discourages sled travel; audit flagged this; needs in-play signal before tuning
[polish] paper-thin decoration audit — AAM-followup #8 fixed opening wreck (cockpit windows + breach patches + entrance fragments + salvage panels — all bumped to ≥10cm depth, matching the new CLAUDE.md rule 7). Other flagship POIs likely have similar paper-thin features that read as 2D at oblique angles. Audit: megaShip.ts, megaWreck.ts, crashedHull.ts, engineBlock.ts, satelliteDish.ts — find BoxGeometry decorations on hull surfaces with depth < 0.10m and bump them.
[feat] texture overhaul — game-wide visual upgrade. Today everything is flat-color MeshLambertMaterial + procedural shaders (terrain rust/sand, hull rust streaks per OO, concrete weathering). Move to PBR-ish material treatment: normal maps on hulls/wrecks for surface detail, subtle albedo variation on cloth (tents/bedroll/canteen), worn-metal masks on weapons. Sources: CC0 PBR (PolyHaven, ambientCG) OR extend the existing procedural shader vocabulary. Decide bundle-cost stance first (current zero-texture-files policy per D3 — would need to revisit). Big atmospheric win; biggest visual upgrade since the procedural shader era (OO).
[feat] salvage mechanics overhaul — current loop is "hold-E on panel → roll from kind-keyed loot table → done." Overhaul candidates: multi-stage panel pry (find tool → bend open → expose lootable interior), tool requirements (need scrap-bar to lever heavier wrecks, fire-starter to thermal-cut others), per-panel rarity tiers (small panel = scrap-only, large/deep panel = rare drops), salvage condition (recent crash = fresh loot, ancient wreck = corroded scrap only), salvage durability (each wreck has finite salvageable mass; deplete to corpse), risk/reward (loud salvage attracts raiders or worm). Pick 2-3 angles to ship; full vision is a multi-session arc.
[feat] POI overhaul — broaden the POI vocabulary + add narrative beats. Today 6 flagship kinds (engine_block, camp, satellite_dish, crashed_hull, mega_ship, mega_wreck) + 4 procgen wreck kinds (engine_bell, fuselage, escape_pod, engine_cluster). Overhaul: themed POI clusters (military convoy = 3-5 related wrecks in formation; refugee caravan = camp + cargo + fuselage; comm-relay = dish + tower + satellite_debris); per-POI encounter beats (hostile raider holdout, friendly hermit, lone survivor's last journal entry); biome-specific POI kinds (salt = corroded scientific outpost, rocky = subterranean entrance, dune = buried spaceship cockpit). Builds on AAI's rejection sampler.
[idea] dynamic POI model generation system — procedurally compose unique POI silhouettes per-seed instead of hand-modeling each kind. Vocabulary of parts (hull pieces, engine bells, antenna struts, breach patches, salvage panels) + composition rules (this kind has a cockpit + tail + N engines arranged on a tilt; that kind is a flat slab with a turret stub on top). Per-seed variation: bigger/smaller, more or fewer breaches, different tilt angles, paint scheme. Goal: every wreck in a procgen world looks distinct without authoring 50 hand-modeled variants. Big architecture lift; would supersede some of the hand-modeled flagship modules (engineBlock.ts, satelliteDish.ts) and the wrecks.ts procgen palette. Needs design pass + scope discussion before code. Speculative.
