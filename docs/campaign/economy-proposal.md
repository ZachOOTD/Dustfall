# Scavenger's Economy — the proposal (2026-07-18, for morning approval)

**Nothing here is built.** No ItemIds baked, no loot tables changed. This is the decision sheet;
approve it (or edit it) and the build campaign runs against it. Research basis:
`docs/research/crafting-improvements.md` (TLD / Rust / Subnautica / FO4 / Dune: Awakening survey).
Code ground truth: 20 recipes in `recipeDiscovery.ts`; materials today are `scrap` / `cloth` /
`branch` / `rope`; three separate loot systems (container rolls, salvage `TABLES`, `COMPONENT_LOOT`).

**Locked already (your calls):** crafting stays BENCH-FREE · leaner set (~4-5) building on `scrap` ·
per-POI loot identity.

---

## 1. The material set — 4 new ItemIds (recommended)

Keep `scrap` as the universal bread-and-butter junk. Add exactly four, each owning a distinct
recipe class (the research's strongest finding: only 1-2 materials should ever be truly scarce):

| New material | What it is | Recipe class it owns | Scarcity |
|---|---|---|---|
| **`metal`** | tool-grade refined plate/bar (vs `scrap` = junk) | tools, blades, traps, armor | the mid-game bottleneck |
| **`wiring`** | cabling + electronics pulled from powered wrecks | light, signal, powered upgrades | moderate; hero wrecks are rich in it |
| **`fuel`** | refined hydrocarbons | fire, torch upgrades, future vehicle/generator | high early, normalizes later |
| **`casing`** | polymer/synthetic housings + seals | canteen/flask seals, med components, containers | moderate-high |

**Deferred (not in v1): `chemical`** — the research likes it but it mostly enables multi-step
chains (scrap→chemical→item), which fights "leaner." It slots in cleanly later with
refinery_stack as its anchor. **Default: defer.**

## 2. The drop matrix (per-POI identity at a glance)

`P` = primary (the POI's identity), `s` = secondary, `·` = absent. Ground loot + containers +
salvage panels all draw from the same identity; exact weights are tuning, not schema.

| POI / landmark | scrap | metal | wiring | fuel | casing | cloth/branch |
|---|---|---|---|---|---|---|
| derelict wreck | P | s | s | · | · | s |
| satellite | s | · | **P** | · | s | · |
| wrecked_tank | s | **P** | · | **P** | · | · |
| debris_field / trail | P | s | · | · | · | s |
| hollow_husk | P | · | s | · | · | s |
| enterable_wreck | P | s | s | · | · | s |
| relay_mast | s | · | **P** | · | s | · |
| buried_pipeline | s | s | · | **P** | · | · |
| cargo_crawler | s | P | · | s | **P** | · |
| refinery_stack | s | · | s | **P** | · | · |
| hab_dome | s | · | **P** | · | **P** | s |
| transit_car | s | P | · | s | s | · |
| **Skyfall freighter** (hero) | s | **P** | **P** | s | · | s |
| **Leviathan** (hero) | s | **P** | **P** | · | · | s |
| boneyard biome | P | s | · | · | · | branch |
| well / trees / cacti | (unchanged — organics stay as they are) | | | | | |

The player learns: **tank/pipeline = fuel · relay/satellite/hab = wiring · crawler/hab = casing ·
tanks/heroes = metal.** Heroes are the richest single stops (they earn the walk).

## 3. Recipes

**Existing 20 recipes: UNCHANGED.** (Changing early-game costs like fire_kit would silently
rebalance the released tutorial arc — not worth it.) Depth comes from ~8 NEW recipes using the new
materials, auto-unlocked on first collect exactly like today's discovery flow:

| New recipe (bench-free) | Inputs | Why |
|---|---|---|
| Reinforced torch | torch + metal + wiring | longer burn — the storm/cave light |
| Sealed canteen | canteen + casing + metal | +capacity (the desert's #1 stat) |
| Pressure trap | metal ×2 + branch + fuel | first passive-defense verb |
| Signal amplifier | signal_kit + wiring ×2 | longer flare visibility |
| Fire accelerant | fuel + cloth | instant-light a fire in a storm |
| Machete re-edge | machete + metal | repair-as-choice (see Q3) |
| Armor plate vest | cloth ×2 + metal ×2 + rope | first armor slot |
| Lantern (placeable) | wiring + casing + fuel | persistent camp light |

Pattern rules (from the research): 2-4 inputs; at least one common input; upgrades consume the
base item; no recipe gates exploration.

## 4. Plumbing — unify the three loot systems (pure refactor, loot-preserving)

One data-driven registry (`src/world/lootRegistry.ts`): each source (container kind, salvage kind,
component kind, POI archetype ground-scatter) declares a table `{id, chance, count}[]` — the same
shape salvage `TABLES` already uses. Container rolls + `COMPONENT_LOOT` migrate to it with their
CURRENT drops byte-identical (gate: a seeded 1000-roll digest comparison, old vs new, must match
before any new material is added). Then per-POI identity becomes a data edit, not code.

## 5. Crafting-UX improvements (small, from the research)

- **S** — On first pickup of a new material, surface the 1-2 recipe cards it unlocked (the
  discovery system already tracks this; it just doesn't announce).
- **S** — Recipe cards show WHERE a missing material lives ("wiring — salvaged from relays,
  satellites, habs") — teaches the drop matrix diegetically.
- **M** — Half-built finds: rare "damaged X" loot finishing at ~30% recipe cost (a scavenger-y
  "finish it or strip it" decision). Defer-able.

## 6. Open questions (each with a default so "yes to defaults" works)

| # | Question | Default |
|---|---|---|
| Q1 | 4 materials as named (`metal`/`wiring`/`fuel`/`casing`)? Any rename/swap? | as named |
| Q2 | `chemical` deferred? | defer |
| Q3 | Durability/repair: none (v1), kits-only, or all tools? | **none in v1** — repair recipes like machete re-edge exist as one-off upgrades instead; full durability is its own feel-risky system |
| Q4 | Salvage panels: fixed identity drop or 70/20/10 roll with a rare alternative? | **70/20/10 roll** — exploration tension, still teaches identity |
| Q5 | Inventory pressure: keep slot-count only? | keep slots only (no weight system in v1) |
| Q6 | New-material spawn in ALREADY-STREAMED chunks: new materials appear only in newly-streamed/looted-fresh sources (additive-safe), or retrofit? | **additive-only** — zero save risk |

## 7. Build plan (the campaign that runs after your approval)

| Cycle | Unit | Gate |
|---|---|---|
| 1 | Loot-registry unification, loot-preserving | 1000-roll digest old=new; verify:all |
| 2 | 4 ItemIds + icons/pickup meshes + ground-scatter wiring | verify:all + pickup-take sweep |
| 3 | Drop matrix live (containers/panels/ground per §2) + hero-wreck richness | verify:all + a per-POI loot audit probe |
| 4 | 8 new recipes + discovery auto-unlock + UX-S items | craft-unlock gate re-verify |
| 5 | Balance pass + your walk-test prep + morning summary | attended review: does scavenging FEEL differentiated? |

Estimated ~1.5-2.5M tokens. Save-schema: additive-only (new ItemIds are additive-safe under
SAVE_VERSION 17; no migration).

---

**To approve:** `/campaign-approve` (optionally with edits/answers to Q1-Q6 — unanswered = the
defaults). The build campaign then runs the §7 ladder.

---

# APPROVED DESIGN (2026-07-18, interactive review with Zach) — THIS SUPERSEDES §1-§3 ABOVE

Zach's revisions during review:
- NO new craftable outputs — new materials craft EXISTING items only.
- `metal` rejected (too close to scrap) · `casing` rejected · `fuel` replaced by battery (sci-fi
  coherence: the wrecks are starships — you strip power cells, not jerrycans).
- cactus_pulp is dead code (only alien cacti spawn since CC-4) — do NOT use it; clean it up.

## Final material set (4 new ItemIds)
| Material | What it is | Identity drops |
|---|---|---|
| `metal_pipe` | a length of salvaged tube | buried_pipeline (primary), refinery, transit_car, debris fields |
| `machine_part` | gears/springs/actuators | wrecked_tank, cargo_crawler, transit_car, Skyfall machine bay, leviathan |
| `wiring` | cabling + electronics | relay_mast, satellite, hab_dome, hero wrecks |
| `battery` | a small salvaged power cell | satellite, relay_mast, hab_dome, escape pods, hero wrecks |

## Final recipes
NEW (existing loot-only outputs become craftable):
- pipe_staff = metal_pipe + cloth + rope
- scrap_gun = metal_pipe + machine_part + scrap
- worm_lure = battery + wiring + raw meat (a powered thumper)

UPDATED existing recipes:
- flashlight: scrap×2+cloth → battery + wiring + scrap
- lantern_kit: cloth×2+scrap×2+branch → battery + wiring + scrap + cloth
- sled_kit: scrap×2+branch+rope → metal_pipe + scrap + branch + rope
- grill_kit: scrap×2+branch×2 → metal_pipe + scrap + branch
- locker_kit: scrap×4+branch×2 → metal_pipe + scrap×2 + branch
- stake_kit: scrap×3+branch → metal_pipe + scrap
- spyglass: scrap×3+cloth → machine_part + scrap + cloth

UNCHANGED: the whole tutorial arc (bandage/fire_kit/tent_kit/torch/rope), canteen,
scrap_machete (a SCRAP machete stays scrap), signal_kit (a flare is pyrotechnic — reverted),
scrap_bullet, large_tent_kit, bedroll_kit, scrap_bar, foods.
Still loot-only by design: machete, energy_pistol, pulse_rifle, amban_rifle, companion_pod,
relic_core.

## Approved build ladder
1. Loot-registry unification (loot-preserving; 1000-roll digest old=new gate) — plumbing, in.
2. 4 ItemIds + pickup meshes + drop matrix live (identity table above; 70/20/10 panel rolls per
   Q4 default) + cactus_pulp dead-code cleanup.
3. Recipes (3 new + 7 updated) + discovery auto-unlock + UX-S (announce unlocked cards on first
   pickup; cards name where a missing material lives).
4. Balance pass + walk-test prep + morning summary.
Q1-Q6 defaults stand except as revised above. Additive-only save-wise (Q6).
