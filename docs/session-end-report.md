# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`. A
reviewer who's never seen the project should be able to read this +
`CLAUDE.md` + `docs/GDD.md` and understand where Dustfall is.

**Current state**: Session AAN shipped (2026-05-21). 41 sessions
post-MVP. tsc clean. SAVE_VERSION v10 (additive: per-fire hasGrill).
Working tree dirty pending the user's commit.

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
| Tier 4 — Polish + breadth | QQ–AAN | ✓ ongoing | Sled, opening wreck redo, crafting rework, control overhaul, larger tent, perceivedIntensity split, ghost previews, recipe book, craftable home (bedroll/lantern/locker), creature companion, long-storm countdown, atmospheric polish, procgen world generation, opening wreck enterable + thick hull, AAI flagship-tightening, project-wide audit, fire grill multi-cook, systems review quick-wins |

**Verify status**: `npm run verify` = `tsc --noEmit`. Single check
(no tier breakdown). Currently PASS.

---

## What works end-to-end (singleplayer flow)

Fresh-game start (the de-facto Tier 1 — Session W shipped):

1. **Boot title**: animated 3D title scene (CC-3) with a pod
   shooting-star + landing on a hero dune. NEW GAME / CONTINUE
   buttons. AAI added an Advanced disclosure for typing a custom
   uint32 seed (per-seed worlds).
2. **Opening cinematic**: player spawns ~4.5m in front of the
   redesigned opening wreck (RR + SS DoubleSide fix + AAJ thick-hull
   + tally-mark repositioning). Tapered cockpit + tail-stub silhouette,
   30° stress-fracture skylight running the upper hull. Inside:
   skeleton + journal at cockpit front, tally marks on the curved
   interior side wall, ash pile + branch stubs + empty canteen.
   Companion (AAE — Rocky-inspired) deployed 3m camera-right of
   the player.
3. **First interactions**: pickup E (AAA reverted UU's LMB-pickup),
   journal E, salvage panel hold-E.
4. **Speeder**: parked ~12m from the wreck entrance. Mountable via E
   (CC-2). Has `speederTowBar` mesh for rope attachment (QQ-2).
5. **Survival loop**: thirst/heat/hunger/stamina/health all decaying.
   Canteen drinks **hold-LMB continuously** (UU) — one gulp per
   0.7s. Wells in salt-flats refill via E. Fires/tents/sleds/
   bedrolls/lanterns/lockers/grill — all **LMB-click placement**
   with ghost preview ring (AAA). Sleep cools temperature; respects
   shelter state (AAL).
6. **Combat**: 5 weapons (PP — machete, pipe_staff, scrap_gun,
   energy_pistol, plus scrap_bullet ammo). LMB swings/fires; combat
   dispatched from `wieldAction.ts` (UU). Lizards 1-shot; sand worm
   boss (DD + MM + QQ-2 + AAL test-fix moving it to world edge) takes
   12 hits; sensor collider (D48); 120m body.
7. **Sled mechanic** (QQ + QQ-2): craft rope + sled_kit. Rope wield +
   click sled rope-stub to tie. Inextensible rope constraint (D67).
   Bidirectional cargo via lootMenu's `allowDeposit`.
8. **Crafting** (TT rework): combine-to-discover via 4-slot multiset.
   14 recipes shipped through AAM. Recipe Book panel TAB-key (AAA).
   **First-recipe discovery** now triggers a fanfare (AAN): rising-
   arpeggio chime + warm-gold glowing toast held 3.2s (D89).
9. **Cooking** (II + AAM): equip raw meat → E on lit fire to start
   cook (3.5s). Grill attachment (AAM) raises per-fire cap to 4
   parallel cooks.
10. **Long Storm** (AAF): escalating storm schedule from day 0 → 6
    plateau day 7+. HUD countdown indicator at top-right. Player
    must reach a stable home with stored water + fuel by day ~5-6.
11. **Save / load**: single-slot localStorage (`dustfall.save.v1`),
    `SAVE_VERSION = 10`. Death does not auto-save (D10). Continue
    restores player + speeder pose, journal state, sled tethers +
    cargo, salvage progress, harvested cacti, dead lizards, sand worm
    state, AND `inventory.discoveredRecipes`, AND `companion.pos/state`
    (AAE), AND `fire.hasGrill` per saved fire (AAM). Save bump v9→v10
    additive per D81.

---

## What's freshly shipped (Session AAN deltas)

Systems review + quick-win polish bundle. User asked for a comprehensive
audit. Three parallel Explore agents (gameplay loop / models+materials
/ UX-audio-debt) ran at boot; user said "ship the top wins." 8 files
touched, no new modules. Two new D-entries (D88-D89).

- **Paper-thin wrecks.ts fixes** (CLAUDE.md rule 7 audit on procgen
  wrecks). Five sub-10cm BoxGeometry violations bumped to ≥0.10m
  depth + the fuselage end cap rewritten from `CircleGeometry`
  (zero depth — completely 2D disc!) to a 0.10m-thick
  `CylinderGeometry`. Affected: engine_cluster rusty panel (0.06 →
  0.15), escape pod hatch (0.04 → 0.12), escape pod rust patch
  (0.05 → 0.12), cargo container door (0.04 → 0.10 width), debris
  hull plate (0.04 → 0.10 Y). All read as real metal at edge angles
  now. AAJ + AAM-followup #8 covered opening wreck; AAL covered
  tent fabric; AAN covers procgen wrecks. Remaining: megaShip,
  megaWreck, crashedHull, engineBlock, satelliteDish flagships.
- **Scrap gun empty-state crosshair** (`src/ui/interactPrompt.ts` +
  `style.css`). New `.no_ammo` crosshair state (dim warning-red,
  smaller font). Fires when there's no hover AND the equipped
  slot is `scrap_gun` with `ammoRemaining <= 0`. Hover state always
  wins (kill/dead/interactable — D88: the actionable signal beats
  the passive concern). Crosshair state union extended; per-frame
  classList toggle cached as `_lastCrosshairState`.
- **Bandage SFX** (`src/audio/audio.ts`, `src/inventory/items.ts`).
  New `playBandageUse()` — two-layer cloth-tear noise burst
  (highpass 900 → 1800 Hz) + soft pad triangle blip (220 → 110 Hz).
  Wired into bandage onUse. Closes a long-standing silent-use gap
  (bandage was crafted early + used often with no feedback).
- **First-recipe-discovery fanfare** (`src/ui/craftingMenu.ts`,
  `src/audio/audio.ts`, `src/ui/hud.ts`, `src/GameContext.ts`,
  `src/style.css`). On first-time discovery of a recipe: distinct
  rising-arpeggio chime `playRecipeDiscovery()` (C5 → G5 → C6 sines
  + C4 triangle pad, ~0.6s total) replaces the routine playCraft
  tick; toast renders in warm-gold with text-shadow glow + larger
  26px font, held 3.2s instead of 1.6s. `HudApi.showToast` extended
  with optional `{ kind?: 'discovery' }` opts arg (D89). Existing
  single-arg call sites are unchanged. Closes the AAM next-session-
  prompt "screen flash on first craft" stretch.

## What's freshly shipped (Session AAM deltas)

Fire grill attachment + multi-cook. Backlog item from AAG. Save schema
v9 → v10 (additive). Also caught + fixed a leftover AAI bug.

- **grill_kit** ItemId + ItemDef (recipe id 14, scrap×2 + branch×2).
  wieldLmb='click_use'; onUse attaches to hovered fire via new
  `attachGrillToFire(ctx, fire)`.
- **`Fire.hasGrill: boolean` + `grillMesh: THREE.Group | null`** fields.
  `attachGrillToFire` builds the grate via `makeGrillMesh()` (4 iron
  bars + 2 side rails, 0.55×0.45m at Y=0.45 above fire base) and
  parents it to the fire group. 5 new `FIRE_GRILL_*` Tuning constants.
- **`_cooking` singleton → `_cooks: CookState[]` list** in
  `interaction.ts` (D86). tickCooking iterates + removes completed/
  cancelled. Cook cap = 1 without grill, 4 with grill. Slot-switch
  cancel dropped (single-cook UX limitation; grill needs the player
  to switch slots freely to load more raw items).
- **SAVE_VERSION 9 → 10**. Additive `hasGrill?: boolean` per fire.
  Loader re-calls attachGrillToFire on restored fires that had it.
  Pre-v10 saves load with hasGrill=false default.
- **Bug fix (AAI debt, D87)**: loader's seed-validity check compared
  against `Tuning.RNG_SEED` instead of `ctx.seed`. Saves from any
  non-1337 world failed to load post-AAI. Now compares to ctx.seed.

## What's freshly shipped (Session AAL deltas)

Project-wide audit pass. 3 Explore agents in parallel (gameplay loop /
visuals / code-debt). 13 files touched across 4 bundles.

- **Hygiene**: deleted 8 unused Tuning constants. Companion
  receiveShadow=true. Footprint-puffs HMR-dispose guard. samples.ts
  console.warn silenced.
- **Gameplay bugfixes**: energy_pistol added to massive salvage
  table (was orphaned). scrap_bullet drops bumped on engine_cluster
  + added to massive. Sleep temperature reads `ctx.player.inShelter`
  (sheltered factor 0.7, open-air 0.25).
- **DoubleSide sweep**: crashedHull bell + engineBlock heat shield
  → FrontSide. sandWorm body material split (closed segs FrontSide,
  openEnded DoubleSide). Tent + largeTent walls → thin BoxGeometry /
  ExtrudeGeometry (4cm fabric thickness). satelliteDish documented as
  legitimate-DoubleSide case.
- **Magic-number lift**: lootContainers.ts loot drop balance lifted
  to `Tuning.LOOT_CONTAINER_*` (9 new constants).

## What's shipped (older sessions, condensed)

- **AAK** (multi-seed playtest): snapshot harness across 5 seeds.
  Three issues + fixes: FLAGSHIP_SCATTER_RADIUS_MIN/MAX (200-800m
  band), FLAGSHIP_SPAWN_EXCLUSION_RADIUS=200, FLAGSHIP_MAX_ROUGHNESS=0.7
  + new `localRoughness` helper. Max distance dropped 1077m → 786m.
- **AAJ** (opening wreck bugfixes): godray cone removed, entrance
  enterable (rim bumped + floor collider reaches rim), hull
  thickness via inner-shell + FrontSide drop, tally marks repositioned
  to LEFT cockpit interior wall.
- **AAI** (procedural world gen, D82-D85): per-seed worlds within
  standard 2400m grid. `ctx.seed` is single source of truth; 3 RNG
  streams derive from it. Flagship POIs unified into rejection
  sampler. Title Advanced section for seed entry. Density bumps.
- **AAH** (AAG playtest polish): footprintPuffs constants lifted,
  5 feel tweaks (puff height ↑, motes opacity ↑, swap snappier).
- **AAG** (atmospheric polish): footprint puffs, ambient dust motes,
  mirage shader on salt-flat, inventory swap-on-pickup-full hold-E.
- **AAF** (long storm countdown): `stormCurveAt(daysSurvived)` lerps
  day 0 baseline → day 7 endpoint → plateau. HUD countdown indicator.
- **AAE** (creature companion + v9): pocketable Rocky-inspired
  creature with dual locomotion state machine (rolling / walking /
  idle). `companion_pod` ItemId. SAVE_VERSION v9 additive.
- **AAD** (AAC playtest polish): bedroll visibility + ghost ring sizes.
- **AAC** (craftable home + v8): bedroll/lantern/locker placeable kits.
  Recipes id 11/12/13. SAVE_VERSION v8 additive.
- **AAB** (world depth): salvage yield differentiation per wreck
  kind + skylight god-rays for opening wreck.
- **AAA** (first-impression polish): UU pickup migration reverted,
  ghost preview for LMB-place, vignette threshold lowered, recipe
  book panel TAB-key, crosshair `.dead` state.
- **Overnight era** (UU/VV/UU-2/WW/XX/YY/ZZ): control scheme overhaul
  (LMB-leaning), RMB context verbs, HUD micro-polish (stat vignettes
  + stamina wobble + prompt fade), larger enterable tent + v7,
  perceivedIntensity split (visual + audio halves).
- **TT** (crafting rework): combine-to-discover replaces explicit
  recipe-list UI. SAVE_VERSION 5 → 6. Recipe id stability per D71.
- **SS, RR** (opening wreck): DoubleSide fix for slice culling; full
  redo with LatheGeometry hull + procedural rust shader + tilted
  per-piece colliders.
- **QQ + QQ-2** (sled mechanic): rope-tow flatbed cargo + sandworm
  rescale + hotbar tooltips + inextensible-rope constraint (D67).
- **PP** (weapon variants): 3 new weapons (pipe_staff, scrap_gun,
  energy_pistol) + combat generalization + dev rAF fallback (D64).
- **OO** (procedural shader expansion): hull rust + concrete weathering
  + dune wind streaks + rocky biome via scatter.
- **NN, LL, KK** (POI rework arc): dedicated crashedHull, engineBlock,
  satelliteDish modules with full geometry detail.
- **MM** (sandworm rescale + terrain shader): 24m → 240m worm, ranges
  rescaled. Procedural terrain shader (dune grain, salt cracks).
- **DD–JJ-2** (boss + scatter + early polish): sandworm boss DD,
  scatter retuning JJ, spawn teleport bug fix JJ-2.
- **A–CC-4** (foundations + atmosphere): Rapier setup, GameContext,
  inventory, crafting, combat, audio architecture, speeder,
  animated title, GH Pages deploy.

---

## Known issues / partials

- **Sandworm at (900, 0)** as a test-fix only (AAL). Backlog: real
  procgen biome-seeded overhaul.
- **Paper-thin flagship sweep** still incomplete (megaShip, megaWreck,
  crashedHull, engineBlock, satelliteDish). AAN closed wrecks.ts.
- **_cooks module-level state** in interaction.ts survives HMR
  badly. Hard-reload the preview tab if editing.
- **Cook progress per-fire HUD missing** — multi-cook grill shows
  only one cook's progress (deferred from AAN audit).
- **Music tracks** still missing (deferred from AAL; long-standing
  backlog item).
- **Tutorial gaps**: grill_kit / companion_pod / RMB context / sled
  cargo could use clearer first-discovery hints.

See `docs/backlog.md` for full open list.

---

## Constants worth tuning

Recent (session-tagged):

| Constant | Session | Default | Notes |
|---|---|---|---|
| `FIRE_GRILL_MAX_PARALLEL_COOKS` | AAM | 4 | Per-fire cook cap with grill attached |
| `FIRE_GRILL_*` (5 constants) | AAM | various | Grate dimensions + bar radius |
| `FLAGSHIP_SCATTER_RADIUS_MIN/MAX` | AAK | 200/800 | Flagship POI scatter band |
| `FLAGSHIP_SPAWN_EXCLUSION_RADIUS` | AAK | 200 | Bigger than procgen 80m |
| `FLAGSHIP_MAX_ROUGHNESS` | AAK | 0.7 | Reject candidates on steep dune |
| `OPENING_WRECK_HULL_WALL_THICKNESS` | AAJ | 0.15 | Inner-shell offset |
| `PLAYER_SPAWN_EXCLUSION_RADIUS` | AAI | 80 | Opening anchor ± 80m |
| `POI_PROCGEN_COUNT` | AAI | 22 | Bumped from 15 (density) |
| `CACTUS_TARGET_COUNT` | AAI | 14 | Bumped from 10 |
| `DEAD_TREE_TARGET_COUNT` | AAI | 45 | Bumped from 30 |
| `LARGE_TENT_STORM_DAMPEN` | YY | 0.4 | Perceived storm intensity inside large tent |
| `PICKUP_SWAP_DURATION_S` | AAH | 1.2 | Hold-E swap-on-pickup-full |
| `MIRAGE_NEAR_M` | AAH | 10 | Mirage starts at this radius |
| `LONG_STORM_DAY` | AAF | 7 | Days until plateau |
| `PLACEMENT_DISTANCE_M` | UU | 2.2 | All kit deploys |

---

## Suggested next session (1-3 directions in priority order)

1. **Infinite chunk streaming** (still queued from post-AAI, ~6-10h
   big-ticket). Generate 800m chunks lazily as player approaches
   boundary; free farthest chunks. Per-chunk seed derivation. GPU
   memory budget. Save bump v10→v11.
2. **Sandworm overhaul** (deferred from AAL/AAM/AAN, ~3-5h medium).
   Procgen biome-seeded spawn via dune-biome rejection sampler
   (mirror of wells-in-salt). Multiple worms per world. Sound-based
   detection. Deeper encounter beats.
3. **Atmospheric music tracks** (long-standing backlog, ~4-6h
   medium). 3 procedural Web Audio tracks (day / storm / night) via
   slow drones + sparse motifs. Biggest atmospheric ROI per LOC.

Top pick: infinite chunks if the user wants the big architectural
lift; otherwise sandworm overhaul has the highest gameplay-impact
per hour. See `docs/next-session-prompt.md` for the full brief.

---

## Time spent

41 sessions shipped (A–AAN). Approx ~150-200h elapsed dev time across
roughly 4 weeks of calendar time. Overnight era (UU–ZZ, 7 sessions)
ran in one ~8-10h push. The audit/polish arc (AAL → AAM → AAN) has
been tight per-session (1-3h each).

---

## State at session end

- **Git status**: working tree dirty (uncommitted). Branch: `master`.
- **Last commit**: session-AAM (or whatever the user tagged).
  `session-AAN` not yet tagged.
- **Ports bound**: none.
- **Save state**: localStorage v10 (or pre-existing v9/v10 depending
  on last play). Pre-v10 saves load cleanly with hasGrill=false
  default.

---

## Token spend this session (estimated)

Rough estimate (Claude doesn't expose live counts to the agent):

- Input: ~120K-160K tokens (three parallel Explore agents at session
  start, then file reads for the 4 quick-win implementations,
  decisions/changelog/backlog reads at session end)
- Output: ~25K-40K tokens (audit synthesis, 5 wrecks.ts edits + 8
  files of quick-win code + multi-paragraph .md docs rewrites + 2
  D-entries + changelog entry + next-session-prompt)
- Cached input: substantial (CLAUDE.md, tuning.ts, decisions.md
  re-read across agent + main turns)
- Cost (Opus 4.7 rates, rough): $2-$4

Within baseline. The audit phase did the heavy reading; implementation
phase was tight (4 targeted edits in known files).

---

## Commit handoff

Print-hints mode (Dustfall CLAUDE.md does not have `auto-commit: on`).
Commit + tag commands surfaced to the user as the final step of this
report.
