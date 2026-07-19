# Campaign charter — THE DEEP DESERT (2026-07-18)

**Goal:** Phase 3 of the roadmap (`audit-and-roadmap-2026-07-15.md` B1+B2, Zach-approved order):
a rare regional **mega dune-sea (erg) biome** — Sahara-scale dunes, sightline occlusion in the
troughs, long views only from crests, near-empty by design — PAIRED with the **ridable scrap
sled** (wire the inert `FEATURES.rideableSled`, D257 seat-teleport approach). The pairing IS the
feature: crest a colossal dune → see the next landmark → sled down. The game's Mad-Max/Dune
postcard.

**Branch:** `campaign/2026-07-18-deep-desert` (from the just-shipped master 9fd98c9).
**Push HELD** until Zach's "ship it" after the feel checkpoints.

## Non-negotiable constraints
- Regional-anchor pattern (like wreck_yard / bone_field), NOT a global terrain rework (Fable rec,
  approved). Descriptor purity (D290): dune region assignment must be hash/seed-pure.
- The KCC has a 50° climb limit — dune windward faces must be walkable (≤~30°), slip faces can be
  steeper (that's the sled's playground). Speeder terrain-follow must survive the new relief.
- Chunk determinism / streaming / perf gates stay green every cycle (the dune field changes
  heightAt — placement/collider gates must hold on steep terrain).
- Save: additive (SAVE_VERSION 18 just shipped; a new seed-derived region kind needs NO bump —
  verify, don't assume).
- Sled: build behind the OFF flag; cap at 2 physics approaches per D257 if it fights the KCC;
  ride FEEL is human-vetoed, never self-certified.
- One code-writing agent at a time · never `git stash` here · Fable plans / Opus executes.

## Human checkpoints (the campaign PAUSES at each)
1. **Dune blockout vista** — after the biome core streams: a vista shot set (crest view, trough
   view, approach from flat desert) + dune height/wavelength numbers. Zach approves scale/feel
   direction before detail cycles are spent (the boneyard lesson: concept read first).
2. **Sled ride feel** — after the sled works behind the flag: Zach rides it (mount/dismount,
   gravity slide, dune descent). The flag flips only on his approval.

## Cycle ladder
| # | Unit | Gate |
|---|---|---|
| 1 | Research: dune-field synthesis on a streamed heightfield (directional superposed noise / dune ridge functions, slip-face asymmetry, walkability math) → digest | digest exists; no code |
| 2 | Dune region core: region-grid erg assignment + heightAt integration behind a region check, streamed + deterministic; slope audit probe (walkable windward, steeper slip faces) | verify:all + a new dune-slope probe |
| 3 | Blockout vista set + numbers → **PAUSE (checkpoint 1)** | vista shots; campaign paused |
| 4 | Dune detail per Zach's direction: surface ripple/wind-streak detail, crest smoke (storm tie-in), trough emptiness dressing (sparse: a lone wreck, bones), biome soundscape hush | verify:all + visual iteration (rule 8: 5-8 rounds) |
| 5 | Sled core: FEATURES.rideableSled wired — mount (E) / dismount (jump), seat pin in updateSleds, KCC handoff, flat-ground ride | verify:all + a ride probe (mount/ride/dismount cycle) |
| 6 | Sled physics feel: gravity slide on slopes, dune-descent acceleration, steering, bail-out; tuning constants in tuning.ts | ride probe on dunes; capped 2 approaches (D257) |
| 7 | **PAUSE (checkpoint 2)** — Zach rides. Flag flip on approval | campaign paused |
| 8 | Integration + polish: sled-down-a-dune payoff pass, dune-region discovery moment (first crest vista), perf on dune chunks, docs/changelog | verify:all + perf + summary |

**Ceiling:** 6M tokens / 16 cycles (matches the economy campaign). Checkpoint mode: the two
listed pauses (milestone-style).
