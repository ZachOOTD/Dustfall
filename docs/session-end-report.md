# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`. A
reviewer who's never seen the project should be able to read this +
`CLAUDE.md` + `docs/GDD.md` and understand where Dustfall is.

**Current state**: Session TT shipped (2026-05-21). 20 sessions
post-MVP. tsc clean. Working tree has uncommitted changes pending the
user's git decision (see `## Commit handoff` at the bottom).

---

## Tier progress table

Dustfall opts out of the gamedev-framework v0.3.x tier-ladder structure
(see `docs/roadmap.md` framework note). The project is post-MVP and
operates on a per-session "Big-ticket bucket + Polish" model.
Retroactive tier mapping for orientation only:

| Era | Sessions | Status | What it proved |
|---|---|---|---|
| Tier 0 — Foundations | A–H | ✓ shipped | Browser runtime, Rapier, GameContext spine, procedural world |
| Tier 1 — Vertical slice | I–W | ✓ shipped | Inventory, crafting, interactions, opening scene, journal |
| Tier 2 — Target | X–CC | ✓ shipped | Audio architecture, atmosphere, speeder, animated title |
| Tier 3 — Expected | DD–PP | ✓ shipped | Sand worm boss, weapon variants, procgen POIs, biome rework |
| Tier 4 — Stretch / polish | QQ–TT | ✓ in progress | Sled mechanic, sandworm rescale, opening wreck redo + playtest, crafting rework |

**Verify status**: `npm run verify` = `tsc --noEmit`. Single check
(no tier breakdown). Currently PASS.

---

## What works end-to-end (singleplayer flow)

Fresh-game start (the de-facto Tier 1 — Session W shipped):

1. **Boot title**: animated 3D title scene (Session CC-3) with a pod
   shooting-star + landing on a hero dune. NEW GAME / CONTINUE
   buttons.
2. **Opening cinematic**: player spawns ~4.5m in front of the
   redesigned opening wreck (Session RR + SS DoubleSide fix). Tapered
   cockpit + tail-stub silhouette, 30° stress-fracture skylight
   running the upper hull. Inside: skeleton + journal at cockpit
   front, tally marks on the curved interior wall, ash pile + branch
   stubs + empty canteen.
3. **First interactions**: pickup E, journal E, salvage panel E.
4. **Speeder**: parked ~12m from the wreck entrance. Mountable via E
   (Session CC-2). Has a `speederTowBar` mesh for rope attachment
   (Session QQ-2).
5. **Survival loop**: thirst/heat/hunger/stamina/health all decaying.
   Canteen drinks from a well in the salt-flats biome (D45). Fire +
   tent placement. Sleep skips dayTime + cools temperature.
6. **Combat**: 5 weapons (Session PP — machete, pipe_staff, scrap_gun,
   energy_pistol, plus scrap_bullet ammo). Lizards 1-shot from any
   weapon. Sand worm boss (Session DD + MM rescale + QQ-2 halving)
   takes 12 hits; sensor collider (D48); 120m body / 10m radius.
7. **Sled mechanic** (Session QQ + QQ-2): craft rope + sled_kit
   (now via the new combine-to-discover UI, D70). Wield rope, click
   sled rope-stub to tie. Inextensible rope constraint (D67) — slack
   = no force, taut = position-snap + velocity project. Locked
   rotation + manual yaw. Bidirectional cargo via the loot menu's
   `allowDeposit` mode. Speeder mount auto-promotes tether to
   `speederTowBar`.
8. **Crafting** (Session TT rework): open the menu (C). 4 input
   slots — click bag rows to add items, click input slots to remove.
   Output preview shows `?` for unknown-valid combinations, the
   actual output icon for discovered ones, "nothing happens" for
   invalid. CRAFT button consumes inputs + produces output + (first
   time) marks the recipe discovered with a toast. 9 seed recipes;
   stable numeric ids 1-9 (D71); discovery is gated on successful
   output add (D72).
9. **Save / load**: single-slot localStorage (`dustfall.save.v1`),
   `SAVE_VERSION = 6`. Death does not auto-save (D10). Continue
   restores player + speeder pose, journal state, sled tethers +
   cargo, salvage progress, harvested cacti, dead lizards, sand worm
   state, AND (new in TT) `inventory.discoveredRecipes`. Pre-v6
   saves get all 9 recipe ids seeded on load so existing playtesters
   keep their knowledge.

---

## What's freshly shipped (Session TT deltas)

**Crafting rework — combine-to-discover** replaces the explicit
recipe-list UI. Detailed breakdown:

- New module: `src/inventory/recipeDiscovery.ts` (~170 LOC). Defines
  `Recipe { id, displayName, inputs[], output }`. Stable numeric ids
  (1-9 for the seed set). `canonicalInputKey()` sorts inputs by id
  then serializes as `"id:count,id:count,..."`. `matchRecipes()`
  returns array (zero / one / many) supporting the chooser UI for
  future overlapping recipes (none of the current 9 overlap).
- `craftingMenu.ts` rewritten end-to-end (319 → ~330 LOC). 4 input
  slots + output preview + CRAFT button + player-bag column. Click
  bag rows to add (stacks onto existing input slot of same item or
  occupies first empty); click input slot to remove (returns to bag).
  Close-button flushes remaining inputs back to bag (no material
  loss).
- New CSS: `.craft-combine-row`, `.craft-input-slot`,
  `.craft-output-slot`, `.craft-output-unknown`, `.craft-chooser`,
  `.craft-bag-row`, etc.
- `InventoryState.discoveredRecipes: number[]` — added (TT).
- Save format `SAVE_VERSION 5 → 6`. Persists
  `inventory.discoveredRecipes`. Pre-v6 loads seed `ALL_RECIPE_IDS`
  so existing playtesters keep all 9 recipes as discovered.
- Backlog cleanup: struck "crafting rework" entry.

**Decisions D70-D72** logged: (D70) the model change itself;
(D71) recipe id stability rule — never reuse, never renumber;
(D72) discovery gated on successful output add, not on input matching.

---

## Known issues / partials

- **No source audio files yet** (`public/audio/*.ogg`). Soundscape
  has procedural fallbacks; full atmospheric experience pending CC0
  sourcing. See `docs/backlog.md`.
- **Skylight god-rays subtle**: opening wreck's 30° gap admits real
  sunlight, but without atmospheric dust scattering the interior beam
  isn't visually dramatic at midday. Possible polish via volumetric
  fog pass — deferred.
- **No "recipe book" panel yet**: a stretch goal from TT — showing a
  list of all discovered recipes (separate hotkey, e.g. Tab) — was
  skipped. The combine-mode UI is currently discover-only. If
  playtesting reveals players forget what they've discovered, add
  this in a follow-up.
- **No hover tooltips on the bag rows** showing which inputs go with
  what — another TT stretch deferred. Could land alongside the
  recipe book.
- **Opening wreck pointer-locked walk-in not yet playtested by a
  human**: eval-driven verification passed, but the actual "walk
  through the torn entrance" experience still hasn't been tried.
  Worth a quick boot in the user's tab before a major polish session.

---

## Constants worth tuning

Recent ones (session-tagged):

| Constant | Session | Default | Notes |
|---|---|---|---|
| `OPENING_WRECK_HULL_LEN` | RR | 6.0 | Tapered fuselage length |
| `OPENING_WRECK_SLICE_COUNT` | RR | 24 | Angular slices (15°/slice) |
| `OPENING_WRECK_SKYLIGHT_SLICE` | RR | 17 | First slice to omit; SS skips 17+18 |
| `SLED_TOW_DISTANCE` | QQ-2 | 5.0 | Inextensible rope length |
| `SLED_TOW_MAX_DIST` | QQ-2 | 10.0 | Hard snap-detach threshold |
| `SLED_YAW_LERP` | QQ-2 | 0.12 | Visual yaw lerp |
| `STAMINA_TOW_FACTOR` | QQ | 2.0 | Stamina drain × this while tethered on foot |
| `SANDWORM_LENGTH` | QQ-2 | 120 | Halved from MM's 240 |
| `RECIPES` array | TT | 9 entries | Stable numeric ids 1-9; new recipes append at id ≥ 10 |

---

## Suggested next session (1-3 directions in priority order)

1. **Control scheme overhaul** — modern-survival-game parity,
   LMB-leaning (hold to drink canteen, click to place kits/sled,
   etc.) instead of E for every interaction. Touches every per-item
   `onUse`, plus `combat.ts` + `interaction.ts`. Highest blast radius
   of the bucket — affects every existing player interaction. Plan
   for ~4-6h.
2. **Small red creature companion** — pocketable + re-deployable.
   Charm + character, no combat surface area. Mirrors lizard
   visual/AI shape; reuses speeder velocity-follow idiom. New module
   `src/enemies/companion.ts`, new ItemId `companion_pod`, save
   schema bump v6 → v7. Was the pre-RR recommendation.
3. **Audio + atmospheric stems**: source 5-7 CC0 .ogg files for wind
   / dust / day / night / music-calm / music-tense. Architecture is
   in (Session X); only the files are missing. Lower implementation
   cost than the others; bigger atmospheric uplift.

The top pick (control scheme overhaul) is the recommended default
for Session UU.

---

## Time spent

20 sessions shipped (A–TT). Approx ~80-130h elapsed dev time across
roughly 3 weeks of calendar time. Session TT was a medium-scope
session — ~2-3h: data model + UI rewrite + save migration + playtest.

---

## State at session end

- **Git status**: working tree dirty (uncommitted) per "Commit
  handoff" below. Branch: `master`.
- **Last commit**: `fce5ff9` (Session SS) on origin/master. Session
  TT work is uncommitted as of writing.
- **Tags on origin**: `session-A` through `session-SS`. `session-TT`
  not yet tagged.
- **Ports bound**: none (preview server stopped at end of playtest).
- **Save state**: localStorage has a v6 save from the TT playtest
  (player inside cockpit, rope crafted, discoveredRecipes=[8]). If
  you boot fresh + click CONTINUE, you'll land in that state.

---

## Token spend this session (estimated)

Rough estimate (Claude doesn't expose live counts to the agent):

- Input: ~120K-160K tokens (state-of-the-build reads + 4 source files
  read + interview-question round + playtest tool roundtrips)
- Output: ~25K-40K tokens (one new module, one full file rewrite,
  CSS append, save.ts edits, docs/changelog/decisions writes)
- Cached input: substantial (CLAUDE.md, recent files re-read across
  turns)
- Cost (Sonnet 4 rates, rough): $0.40-$1.00

Not flagged — within baseline range for a medium-scope session.

---

## Commit handoff

See `/session-end` step 12. Dustfall's CLAUDE.md does not have a
`## Git policy` section, so default = **print-hints mode**. Commands
printed in the user-facing summary; user authorizes per-turn.
