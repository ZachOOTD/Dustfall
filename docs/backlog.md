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

[feat] base-building mechanics
[idea] remove HUD stat bars in favor of audio/visual/text cues ("you could use a drink")
[feat] multi-worm population — AAP shipped single-worm procgen biome-seeded spawn + noise-scaled detection. Extending to N worms per world needs save-schema bump (currently `sandWorm: { ... } | null` field; would become `sandWorms: [...]`), per-worm min-separation logic, and playtest pass to confirm N>1 doesn't ruin the early game.
[feat] sandworm deeper encounter design — AAP added procgen spawn + noise detection; remaining vision items: more than "sees player → charges" (e.g. ambush state, retreat-and-stalk loop, weakness/feeding behavior, dawn/dusk surfacing).
[feat] satellite dish structural-framework backing geometry — visible from above when player approaches from the convex side; currently uses DoubleSide as a known cheat (documented in satelliteDish.ts AAL comment)
[feat] engine block heat shield back panel — modeled thickness instead of FrontSide-only (AAL switched DoubleSide → FrontSide; back face is mostly occluded but a thin back layer would improve oblique-angle reads)
[idea] stamina tow factor playtest — current 2.0× drain discourages sled travel; audit flagged this; needs in-play signal before tuning
[polish] tutorial coverage gaps — first-time-hint pop-ups exist for several kits but grill_kit (AAM), companion_pod (AAE), RMB context actions (UU-2), sled cargo (QQ) could use clearer first-discovery hints. Audit src/ui/tutorial.ts HINTS table.
[debt] poi.ts scavenger-camp magic-number sweep — assessed in AAO and deferred. Hand-coded camp has ringR=0.55, stone size 0.10-0.14, ash 0.85, bandage offset 1.0/0.8 etc. — aesthetic one-offs not meaningfully feel-tunable. Best done as part of a future scavenger-camp rework when the POI's design is being revisited anyway. Lifting them now would bloat Tuning without future iteration value.
[polish] scrap_gun reload action — AAN added the .no_ammo empty crosshair; closing the loop needs an actual reload UX (R-key? E-on-gun? consumes scrap_bullet?) + a reload SFX (mechanical clack + bullet-in-chamber click).
[feat] saved companion huddle state — AAO huddle resets on every game load (state field defaults to 'idle' on respawn). Acceptable today; if "huddle persistence across saves" matters (saving in a storm should reload with companion still huddled), needs save schema additive bump.
[feat] texture overhaul — game-wide visual upgrade. Today everything is flat-color MeshLambertMaterial + procedural shaders (terrain rust/sand, hull rust streaks per OO, concrete weathering). Move to PBR-ish material treatment: normal maps on hulls/wrecks for surface detail, subtle albedo variation on cloth (tents/bedroll/canteen), worn-metal masks on weapons. Sources: CC0 PBR (PolyHaven, ambientCG) OR extend the existing procedural shader vocabulary. Decide bundle-cost stance first (current zero-texture-files policy per D3 — would need to revisit). Big atmospheric win; biggest visual upgrade since the procedural shader era (OO).
[feat] salvage mechanics overhaul — AAR shipped tactile pry + extract: scrap_bar lever, hinged-door fuse-box panels with 5 interior components, visible depletion, pry creak + extract clink SFX, sandworm noise composition during pry (D95). REMAINING: (1) electrical-flicker PointLight on panel open (faint amber glow for ~3s after pry); (2) variant interiors per wreck kind (fuselage gets different components than cargo); (3) condition tiers (corroded panel: easier pry, fewer components / pristine: harder pry, premium loot); (4) thermal-cut tier with fire-starter for sealed/heavier panels; (5) rare key-card panels gated behind a quest item. The base "press E → roll loot" loop is fully replaced.
[feat] POI overhaul — partial progress. AAQ shipped themed clusters (military_convoy + refugee_caravan). REMAINING: (1) third cluster kind (comm-relay: satellite_dish + tower + debris); (2) per-POI narrative beats (lone-survivor journal entries at hand-placed flagships, hostile raider holdouts, friendly hermit NPCs); (3) biome-specific POI kinds (salt = corroded scientific outpost, rocky = subterranean entrance, dune = buried spaceship cockpit). The (3) item is the largest — would need new POI modules per biome, breaking the AAQ composition-only pattern (D93). (2) is the natural follow-on and reuses existing flagships.
[idea] dynamic POI model generation system — procedurally compose unique POI silhouettes per-seed instead of hand-modeling each kind. Vocabulary of parts (hull pieces, engine bells, antenna struts, breach patches, salvage panels) + composition rules (this kind has a cockpit + tail + N engines arranged on a tilt; that kind is a flat slab with a turret stub on top). Per-seed variation: bigger/smaller, more or fewer breaches, different tilt angles, paint scheme. Goal: every wreck in a procgen world looks distinct without authoring 50 hand-modeled variants. Big architecture lift; would supersede some of the hand-modeled flagship modules (engineBlock.ts, satelliteDish.ts) and the wrecks.ts procgen palette. Needs design pass + scope discussion before code. Speculative.
