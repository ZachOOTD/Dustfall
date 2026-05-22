# Roadmap

Next sessions in execution order. One-liner each + terse scope notes.
Detailed plans live in `.claude/plans/<session>.md` while active; on ship
they're archived + summarised in [changelog.md](changelog.md).

When done with a session, the `/session-end` skill removes the "Next" entry
and promotes the second.

> **Framework note** (retrofit 2026-05-20): Dustfall opts out of the
> gamedev-framework v0.3.x tier-ladder structure (Tier 1/2/3/4 with
> explicit success criteria + verify commands). At 17 shipped sessions
> Dustfall is post-MVP; the per-session "Next + Big-ticket bucket"
> structure already validated stays in use. Skills `/plan-vertical-slice`
> and `/verify-tier` do not apply. The Scope-cut section at the bottom
> exists to satisfy framework-skill expectations and may be populated
> per-session by `/plan-game` or its successor.

---

## Recently shipped (overnight + post-overnight)

- **Overnight era** (UU through ZZ, 7 sessions, 2026-05-21): control scheme overhaul, RMB context verbs, HUD polish, larger enterable tent, perceivedIntensity split (visual + audio halves).
- **Session AAA** (2026-05-21): first-impression polish bundle — UU pickup migration reverted (E takes again), ghost preview for LMB-place, vignette threshold lowered, recipe book panel, crosshair `.dead` state.
- **Session AAB** (2026-05-21): world depth — salvage yield differentiation per wreck kind + skylight god-rays for opening wreck.
- **Session AAC** (2026-05-21): craftable home — bedroll/lantern/locker kits, SAVE_VERSION v8.
- **Session AAD** (2026-05-21): playtest polish for AAC kits — ghost-ring sizes + bedroll visibility.
- **Session AAE** (2026-05-21): creature companion (Rocky-inspired), SAVE_VERSION v9.
- **Session AAF** (2026-05-21): 7-day storm countdown ("THE LONG STORM") — escalating-storm endgame.
- **Session AAG** (2026-05-21): atmospheric polish + inventory swap-on-full — footprint puffs, dust motes, mirage shader, hold-E swap-on-pickup-full.
- **Session AAH** (2026-05-21): playtest polish for AAG — Tuning lifts (footprintPuffs + interaction.ts swap-duration) + 5 feel tweaks (puff height ↑, motes opacity ↑, swap snappier, mirage near-edge ↓, motes storm cross-fade softened).
- **Session AAI** (2026-05-21): procedural world generation (standard 2400m) — per-seed auto-roll on NEW GAME + advanced UI seed entry + flagship POIs unified into rejection sampler + opening scene as seed-stable anchor + density bumps. D82-D85.
- **Session AAJ** (2026-05-21): opening wreck bugfix pass — AAB godray removed (theatrical), entrance enterable (rim bumped, fragments reduced, floor collider reaches rim), hull thickness (drop DoubleSide for inner-shell + FrontSide approach), tally marks repositioned to side wall.
- **Session AAK** (2026-05-21): AAI multi-seed playtest + flagship placement tightening — flagship scatter band narrowed (200-800m), larger spawn-exclusion (200m for flagships vs 80m for procgen wrecks), terrain-roughness gate (max 0.7).
- **Session AAL** (2026-05-21): project-wide audit pass — 8 unused Tuning consts removed, energy_pistol wired into salvage, sleep temp respects shelter state, DoubleSide sweep (crashedHull bell + engineBlock heat shield + sandWorm body split + tent/largeTent thickness), lootContainers drop balance lifted to Tuning. 13 files touched.
- **Session AAM** (2026-05-21): fire grill attachment + multi-cook + SAVE_VERSION v10 — grill_kit recipe id 14, Fire.hasGrill field, _cooking singleton lifted to _cooks list with per-fire cap (1 without grill, 4 with). Incidentally fixed AAI loader bug (seed check used Tuning.RNG_SEED instead of ctx.seed).
- **Session AAN** (2026-05-21): systems review + quick-win polish bundle — three-agent audit (gameplay loop / models / UX-audio-debt) → shipped top 4 quick wins. Paper-thin wrecks.ts fixes (5 violations + fuselage CircleGeometry → 0.10m Cylinder), scrap_gun empty-state crosshair (.no_ammo class), bandage SFX (cloth-tear + pad pat), first-recipe-discovery fanfare (rising-arp chime + warm-gold toast variant held 3.2s). D88-D89. 8 files; no new modules.
- **Session AAO** (2026-05-21): another quick-wins bundle — flagship paper-thin sweep (megaShip 8 + megaWreck 6 + crashedHull/engineBlock CircleGeometry → Cylinder = 15 fixes total), cook-progress-per-fire HUD (showCookProgresses pre-builds 4 mini-bars, surfaced when hovering grilled fires with active cooks), companion storm-peak huddle state (gated on weather.intensity > 0.80 per D90 — uses world-truth not perceivedIntensity since the companion is outdoors), rule-2 magic-number sweep on deadTree.ts (5 module-locals lifted to Tuning). D90. 10 files; no new modules.
- **Session AAP** (2026-05-22, overnight): sandworm overhaul + atmospheric music tracks (paired overnight). Sandworm: procgen biome-seeded spawn via sampleSandwormHome (rejection sampler on dune biome, 350m player-spawn exclusion, per-seed jitter — D91); noise-scaled detection (mounted/sprinting/walking/still multipliers on the 150m radius). Music: new src/audio/music.ts (~240 LOC) — 3 procedural Web Audio tracks (day C-minor drone + rising-fifth motif, storm C+Db dissonance + rumble noise, night sparse sine pads + soft chime); crossfaded by sun height + perceivedIntensity; soundscape's sample-stem music layer kept silent and intact per D92. 5 files + 1 new module.
- **Session AAQ** (2026-05-22): POI overhaul slice — themed clusters. Two cluster kinds shipped: military_convoy (4-6 wrecks aligned along a 28-48m crash trajectory; lead engine_cluster + cargo containers + tail fuselage; closes with debris field at impact end) and refugee_caravan (scavenger_camp + 2-3 cargo containers ringed at 6-12m pointed inward). Composition-over-creation per D93 — no new POI modules, just layouts of existing wreck/camp primitives. sampleClusterPositions adds rejection-sampler with cluster-specific exclusion radii; cluster anchors push onto _placedFlagshipPositions so procgenPoi excludes them. CLUSTER_COUNT_PER_WORLD = 3. D93. 2 files touched.
- **Session AAR** (2026-05-22): salvage mechanics overhaul — tactile pry + extract. Salvage flow rewritten from one-press-roll into two-stage: pry door open with new `scrap_bar` tool, then E-press extracts individual components that visibly disappear. New panel model is a rusted fuse-box with a hinged door + 5 interior detail meshes (wires, chip, fuse, scrap). Pry creak + component-clink SFX. Prying composes with AAP noise detection — louder = sandworm hears you from farther (D95). Visible depletion derived from `salvageRemaining` (no schema bump per D94). 8 files touched.
- **Session AAS** (2026-05-22): salvage polish bundle. Per-component loot mapping (red_wire→rope, chip→scrap_bullet, bandage_pack→bandage etc. — replaces AAR's random kind-table roll with deterministic per-component lookup). Variant interiors per wreck kind via PANEL_COMPONENT_PALETTES (engine kinds are cabling-heavy, escape_pod is medical-heavy, etc.); `addAccessPanel` gained a `kind` parameter and all callers updated. Electrical-flicker amber PointLight ignites in the cavity on pry-complete, fades over 3.2s with 2-sine flicker. 2 new component meshes (cloth_scrap, bandage_pack). 5 files touched; no schema bump.
- **Session AAT** (2026-05-22): salvage condition tiers (corroded / standard / pristine). Each panel rolls one of 3 conditions deterministically at boot (per id + biome + scatterRand) per D96. Salt biome biases corroded; dune biases pristine. Affects pry duration (×0.6 / ×1.0 / ×1.4), max extracts (1-2 / kind-default / 5), loot quality (corroded downgrades wire→cloth + chip→scrap; pristine last-extract gets premium scrap_bullet×3 bonus), and visual appearance (door material variants: heavy rust / weathered iron / cooler steel). Hover prompt annotated with condition adjective. D96. 4 files touched; no schema bump.
- **Session AAU** (2026-05-22): salvage panel polish from playtest feedback. Taller rectangular proportions (0.55×0.55×0.18 → 0.45×0.70×0.20) — house access-panel shape. Body recessed INTO hull via panel-local Z shift in addAccessPanel — front face flush with hull, only rim + door read proud (integrated, not stuck on). scrap_bar added to DEBUG_STARTER_LOADOUT (was undiscoverable testability gap). Door swing lerp slowed 4.5→3.0/s for visibility. completePry toast "the panel pries open — search inside" makes the two-stage pry→extract flow unmissable. 4 files; no schema bump.

## Up next

Infinite chunk streaming (Minecraft-style) remains the queued big-ticket lift. Other big-ticket items: trading/NPC economy (needs design pass), POI narrative beats (lone-survivor journals + hostile raider holdouts), biome-specific POI kinds, salvage thermal-cut tier (fire-starter as alternative pry tool).

## Next — Big-ticket bucket (1–2 picks per session at ~4–7h each)
Pick whatever feels most missing after the polish + atmosphere arc.

- Crafting rework — combine up to 4 items to discover recipes (no grid); chooser for overlapping outputs. Replaces the current bloating recipe list. (shipped UU/TT-era; remaining work = chooser UI for overlapping outputs once two recipes share inputs)
- Small red creature companion (pocketable + re-deployable) — charm + character, no combat surface area, scoped at one session
- Raider variants (scout / ambusher / brute) — *if* we decide to bring raiders back
- Q2: Rigged hands + lizard (GLB-dependent — deferred with N's asset work)
- Base-building mechanics
- Trading / NPC economy
- 7-day storm countdown
- Bounties (template: D39 `'mount'` singleton-interactable pattern from CC-2)
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
- **Title screen — "real-world render" variant** (idea, deferred from
  CC-3): instead of the dedicated title scene, render the actual game
  world behind the menu — camera floating around the opening-scene wreck,
  parallax on the pod-crash narrative. Higher-effort cinematic intro.

---

## Scope-cut candidates (pre-committed)

Per the framework's autonomy convention: if a session's verify fails 3x
or time pressure trips, `/scope-cutter` (or its successor) is authorized
to cut from this list in order. Top entry cut first.

Currently empty. Populate at the start of each session if the session
plan has scope risk worth pre-committing cuts for.
