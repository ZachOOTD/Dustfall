# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`. A
reviewer who's never seen the project should be able to read this +
`CLAUDE.md` + `docs/GDD.md` and understand where Dustfall is.

**Current state**: Session ABJ shipped (2026-05-24, overnight). 65
sessions post-MVP. tsc clean across all 4 ABJ tier boundaries.
SAVE_VERSION v11 (D108 — combined bump from v10 covering huddleState
+ journalReadKinds + bornInDevMode). All ABB-ABI commits pushed to
origin. ABJ commits (`0f64fc1`, `83c353a`, `fadc78e`, `b22d98d`) +
this session-end commit not yet pushed.

**ABJ scope**: 6h aggressive overnight bundle, 14 of 19 selected items
shipped across 4 tiers. Tier 5 stretch items (salt outpost, rocky
entrance, megaWreck rebuild, dropped-item physics, generalized rope)
pre-committed to defer and remain in backlog.

---

## Tier progress table

Dustfall opts out of the gamedev-framework v0.3.x tier-ladder structure
(see `docs/roadmap.md` framework note). The project is post-MVP and
operates on a per-session "Big-ticket bucket + Polish" model.

| Era | Sessions | Status | What it proved |
|---|---|---|---|
| Tier 0 — Foundations | A–H | ✓ shipped | Browser runtime, Rapier, GameContext spine, procedural world |
| Tier 1 — Vertical slice | I–W | ✓ shipped | Inventory, crafting, interactions, opening scene, journal |
| Tier 2 — Target | X–CC | ✓ shipped | Audio architecture, atmosphere, speeder, animated title |
| Tier 3 — Expected | DD–PP | ✓ shipped | Sand worm boss, weapon variants, procgen POIs, biome rework |
| Tier 4 — Polish + breadth | QQ–ABJ | ✓ ongoing | Sled, crafting rework, control overhaul, creature companion, long-storm countdown, procgen world, salvage tactile pry+extract+conditions, procgen wreck system, fire grill multi-cook, narrative journals, texture-overhaul shader vocabulary, biome-specific POIs (dune cockpit), sandworm bait-and-strike feeding loop, comm-relay cluster, science_vessel wreck class, v11 schema (huddleState + journalReadKinds + bornInDevMode) |

**Verify status**: `npm run verify` = `tsc --noEmit`. Single check
(no tier breakdown). Currently PASS.

---

## What works end-to-end (singleplayer flow)

1. **Boot title**: animated 3D title scene (CC-3) with a pod
   shooting-star + landing on a hero dune. NEW GAME / DEV MODE
   buttons. Advanced disclosure for typing a custom uint32 seed
   (per-seed worlds — AAI).
2. **Opening cinematic**: player spawns ~4.5m in front of the
   redesigned opening wreck (RR + SS DoubleSide fix + AAJ thick-hull
   + tally-mark repositioning). Tapered cockpit + tail-stub silhouette,
   30° stress-fracture skylight running the upper hull. Inside:
   skeleton + journal at cockpit front, tally marks on the interior
   side wall, ash pile + branch stubs + empty canteen. Companion
   (AAE — Rocky-inspired) deployed 3m camera-right. Opening wreck is
   non-salvageable (D15 restored in ABG).
3. **First interactions**: pickup E, journal E (reads the W-era
   survivor entries via the new ABF journal-kind system).
4. **Speeder**: parked ~12m from the wreck entrance. Mountable via E
   (CC-2). speederTowBar mesh for rope attachment (QQ-2). Hull now
   renders with painted-corroded shader per ABH.
5. **Survival loop**: thirst/heat/hunger/stamina/health all decaying.
   Canteen drinks hold-LMB continuously (UU) — one gulp per 0.7s.
   Wells in salt-flats refill via E (well rim stones now render with
   stone shader per ABH). Fires/tents/sleds/bedrolls/lanterns/lockers/
   grill — all LMB-click placement with ghost preview ring (AAA).
   Sleep cools temperature; respects shelter state (AAL).
6. **Combat**: 5 weapons (PP — machete, pipe_staff, scrap_gun,
   energy_pistol, plus scrap_bullet ammo). LMB swings/fires; combat
   dispatched from `wieldAction.ts` (UU). R-key reload for scrap_gun
   (ABE) — drains scrap_bullet stacks. Lizards 1-shot; sand worm
   boss takes 12 hits; sensor collider (D48); 120m body. All weapons
   now render with metal shader per ABH.
7. **Sled mechanic** (QQ + QQ-2): craft rope + sled_kit. Rope wield
   + click sled rope-stub to tie. Inextensible rope constraint (D67).
   Bidirectional cargo via lootMenu's `allowDeposit`.
8. **Crafting** (TT rework): combine-to-discover via 4-slot multiset.
   15 recipes shipped through AAR (scrap_bar). ABE added categorization
   sub-headers (tool/ammo/shelter/consumable) within CRAFTABLE/MISSING
   buckets. AAV added partial-match suggestions. Recipe Book panel
   TAB-key (AAA). First-recipe discovery fanfare (AAN).
9. **Salvage** (AAR + AAS + AAT + AAU + ABA + ABB + ABG): tactile
   pry+extract flow. Equip scrap_bar, hold E to pry door open (0.85s),
   then E presses extract individual components (per-component loot
   mapping via PANEL_COMPONENT_PALETTES). Condition tiers
   (corroded/standard/pristine) per D96. Electrical-flicker glow on
   pry-complete (AAS). All flagship panels migrated to addAccessPanel
   (ABA P3). ABB fixed 3 panel placement bugs. ABG fixed the
   interior-visibility bug (BackSide rendering — D105) so components
   are now actually visible inside opened panels.
10. **Cooking** (II + AAM): equip raw meat → E on lit fire to start
    cook (3.5s). Grill attachment (AAM) raises per-fire cap to 4
    parallel cooks. Grill bars now render with metal shader per ABH.
11. **Long Storm** (AAF): escalating storm schedule from day 0 → 6
    plateau day 7+. HUD countdown indicator at top-right.
12. **POI narrative** (ABF): 5 lone-survivor journals at hand-modeled
    flagships (megaShip / megaWreck / satelliteDish / crashedHull /
    engineBlock), each with a distinct narrator voice. Plus the W-era
    opening journal. Per-kind content via Journal.kind discriminator
    (D106).
13. **Procgen wrecks** (ABA P7 + ABC + ABD): composite wreck system
    (cockpit + hullSegment + engineModule + tailStub vocabulary,
    5 hullSegment variants including OPEN_TRUSS + FUEL_BARRELS, 3
    classes: corvette/gunship/freighter). Breach patches as a
    decoration layer (~41% of eligible hulls). PROCGEN_COMPOSITE_SHARE
    = 0.50.
14. **Save / load**: single-slot localStorage (`dustfall.save.v1`),
    `SAVE_VERSION = 10` (unchanged through ABB-ABH — no schema bumps
    this catch-up). Pre-v10 saves load cleanly with hasGrill=false
    default.

---

## What's freshly shipped (ABH delta)

**Texture overhaul via procedural shader vocabulary**. 4 new factory
modules + applied across the game's surfaces. Zero new texture files
(preserves D3 + formalizes D107).

- `src/world/metalMaterial.ts` (159 LOC): `createMetalMaterial`.
  Brushed scratches + worn highlights + grain + edge dirt. Applied to
  scrap_bar, machete, pipe_staff, scrap_gun, energy_pistol, scrap_bullet
  brass, lantern iron, grill bars, antenna.
- `src/world/paintMaterial.ts` (143 LOC): `createPaintedMetalMaterial`.
  Paint chips revealing rust + faded gradient + vertical drip-streaks.
  Applied to speeder hull, locker bands.
- `src/world/stoneMaterial.ts` (156 LOC): `createStoneMaterial`.
  Aggregate noise + cracks + dust-on-top-facing-surfaces (world-up
  normal check) + sun-bleach. Applied to rockScatter (both tiers),
  well rim stones.
- `src/world/skinMaterial.ts` (151 LOC): `createSkinMaterial`. Scale-
  cell FBM + pigment blotches + vein lines + sheen. Applied to
  sandworm body, lizard, companion carapace.

All 4 follow terrainMaterial.ts / fabricMaterial.ts onBeforeCompile
pattern (D62). Bundle impact +11KB (4 shader source files; zero asset
bytes).

## ABB-ABG deltas (condensed)

- **ABG** (panel interior bugfix + opening-wreck panel removal): body
  BoxGeometry's front face was occluding the 5 interior components
  shipped in AAS — fixed by rendering body material with `side:
  BackSide` (D105). Module-cached BackSide clone. Opening-wreck salvage
  panels removed per D15 (story prop, not salvage site).
- **ABF** (5 flagship journals overnight): added `Journal.kind`
  discriminator; placeJournal tags `userData.interactSubKind` so
  interaction.ts routes by tag; journalPanel.ts uses `Map<JournalKind,
  JournalContent>`. 5 narrator voices: cargo handler, captain, radio
  operator, pilot, engineer. D106.
- **ABE** (5-item polish overnight): P1 tutorial HINTS for rope +
  sled_kit. P2 wind shimmer shader on fabric (sin displacement keyed
  to weather.intensity). P3 scrap_gun R-key reload + playReloadGun
  SFX. P4 crafting category sub-headers. P5 megaWreck ground-level
  secondary panel between engine bells.
- **ABD** (breach freq tune): data-driven sweep across seeds 12345 +
  7777 showed only 15% breached. Bumped ribbed_cylinder 0.50 → 0.70,
  plated_rectangular 0.40 → 0.60. Post-tweak ~41%.
- **ABC** (procgen wreck expansion): 2 new hullSegment variants
  (OPEN_TRUSS, FUEL_BARRELS), gunship class (engine-heavy 4-6 parts),
  3-way class roulette 45/30/25, addBreachPatches helper,
  PROCGEN_COMPOSITE_SHARE 0.35 → 0.50.
- **ABB** (visual audit): 3 migrated flagship panels (satelliteDish
  back-of-dish, crashedHull bell-throat, engineBlock bell-wall) had
  wrapper positions using arbitrary constants instead of actual lathe
  profile values. Recomputed each from the surface formula. openingWreck
  panels were already correct (used lookAt + profileRadiusAt).

## Older sessions (condensed, see changelog for detail)

- **ABA**: overnight 7-item bundle. Light-pool refactor (eliminates
  the lantern-deploy freeze). Salvage door direction bugfix (D101).
  Legacy panel migration to addAccessPanel (D102). Speeder damping.
  Tutorial hints. alignToTerrain lift (D103). Procgen wreck system
  first cut (D104).
- **AAY** (visual overhaul): tents + fabric shader + lantern + companion
  + grill bug. D97-D100.
- **AAR/AAS/AAT/AAU/AAV** (salvage stack): tactile pry+extract,
  variant interiors, condition tiers, panel polish, inventory overhaul.
- **AAA-AAQ** (polish + atmosphere arc): ghost previews, recipe book,
  craftable home (bedroll/lantern/locker), creature companion (AAE),
  7-day storm countdown (AAF), atmospheric polish (AAG), procedural
  world (AAI), flagship tightening (AAK), grill multi-cook (AAM),
  POI clusters (AAQ).
- **QQ-ZZ**: control scheme overhaul, RMB context verbs, larger tent,
  perceivedIntensity split, crafting rework, opening wreck rebuild,
  sled mechanic, weapon variants.
- **DD-PP**: sandworm boss, weapon variants (PP), procgen POIs (HH),
  POI rework arc (KK/LL/NN), terrain shader (MM), procedural shader
  expansion (OO).
- **A-CC-4**: foundations + atmosphere + speeder + animated title +
  GH Pages deploy.

---

## Known issues / partials

- **Sandworm at procgen-seeded position** (AAP); multi-worm population
  still backlog (needs schema bump).
- **_cooks module-level state** in interaction.ts survives HMR badly.
  Hard-reload the preview tab if editing.
- **megaWreck catwalk panels 3 + 4** (~11.5m up) still require stairs.
  ABE added 1 ground panel between bells; full sweep deferred.
- **preview_screenshot tool blocked in hidden tabs** — canvas 0×0
  problem. Workarounds documented in `dustfall_preview_gotchas.md`
  (data-driven verification preferred).
- **megaWreck visual quality** lags rest of the game (BB-2 era model,
  pre-OO shaders). Rebuild flagged in backlog.

See `docs/backlog.md` for full open list.

---

## Constants worth tuning

Recent (session-tagged):

| Constant | Session | Default | Notes |
|---|---|---|---|
| `PROCGEN_COMPOSITE_SHARE` | ABC | 0.50 | Composite vs legacy procgen wreck mix (was 0.35 in ABA) |
| `ribbed_cylinder breach chance` | ABD | 0.70 | Per-variant in procgenWreck.ts (was 0.50 in ABC) |
| `plated_rectangular breach chance` | ABD | 0.60 | Per-variant (was 0.40 in ABC) |
| Wind shimmer amplitude | ABE | 0.5cm–4cm | fabricMaterial.ts; calm baseline + storm peak |
| Metal shader `wornScale` | ABH | 5-14 per surface | Larger = smaller worn-spot pattern |
| Paint shader `wearLevel` | ABH | 0.55-0.65 | How chipped the paint is |
| Stone shader `dustStrength` | ABH | 0.6-0.75 | Top-facing surface dust accumulation |
| Skin shader `scaleSize` | ABH | 12-40 per creature | Larger = smaller scale cells (lizard tiny, worm large) |
| `FIRE_GRILL_MAX_PARALLEL_COOKS` | AAM | 4 | Per-fire cook cap with grill attached |
| `FLAGSHIP_SCATTER_RADIUS_MIN/MAX` | AAK | 200/800 | Flagship POI scatter band |

---

## Suggested next session (1-3 directions in priority order)

1. **Multi-worm population** (~3-4h medium). Needs save schema bump
   (sandWorm → sandWorms[]); per-worm min-separation logic; playtest
   pass to confirm N>1 doesn't ruin the early game. Closes AAP scope-
   cut. Highest gameplay impact per hour of the medium picks.
2. **Sandworm encounter depth** (~3-5h medium). Ambush state, retreat-
   and-stalk loop, weakness/feeding behavior, dawn/dusk surfacing.
   Builds on AAP's procgen spawn + noise detection. Could combine
   with #1 as a multi-session sandworm arc.
3. **Infinite chunk streaming** (~6-10h big-ticket). The last major
   architectural lift. Generate 800m chunks lazily as player nears
   boundary; free farthest chunks. Per-chunk seed derivation. GPU
   memory budget. Save bump v10→v11.

Top pick: multi-worm if the user wants gameplay; infinite chunks if
architecture. See `docs/next-session-prompt.md` for the full ABI brief.

---

## Time spent

62 sessions shipped (A through ABH). Approx ~240-300h elapsed dev time
across ~5 weeks of calendar time. The ABB-ABH arc (7 sessions) ran in
one ~12-14h push including 2 overnights. The texture overhaul (ABH)
was the heaviest single session at ~3-4h actual work.

---

## State at session end

- **Git status**: working tree dirty (this session-end's docs updates).
  Branch: `master`. Up to date with origin through `session-ABH` tag.
- **Last commit**: `d720b4b` (session ABH).
- **Last tag**: `session-ABH` (pushed to origin).
- **Ports bound**: none.
- **Save state**: localStorage v10. ABB-ABH made zero save-schema
  changes; any pre-ABB save loads identically.

---

## Token spend this session (estimated)

This conversation has been very long — 8 sessions of work (ABB through
ABH) in one continuous Claude session, plus this session-end catch-up.

- Input: ~600-800K tokens cumulative (heavy file reads across 8
  sessions, multiple Explore agents, runtime eval inspection)
- Output: ~150-220K tokens cumulative (8 sessions of code + 7
  changelog entries + 3 D-entries + full report rewrite)
- Cached input: substantial (CLAUDE.md, decisions.md, tuning.ts all
  read repeatedly across sessions)
- Cost (Opus 4.7 rates, very rough): $30-50 cumulative for the 8
  sessions + catch-up

The catch-up session-end alone is ~50-70K tokens (read backlog, read
decisions, read changelog, rewrite report + brief + roadmap entries).
Within reasonable budget given the 7-session backlog of docs.

---

## Commit handoff

Print-hints mode (Dustfall CLAUDE.md does not have `auto-commit: on`).
ABB-ABH commits + tags are already pushed; only this catch-up session-
end's doc updates need committing. Commands surfaced to the user as
the final step of this report.
