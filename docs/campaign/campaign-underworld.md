# Campaign charter — UNDERWORLD (2026-07-19)

**Goal:** the real cave system for the egg (replacing the single chamber, D255): a multi-chamber
branching dark cave — descent, dark-nav + torch economy, the egg deep inside, cave-exclusive
loot (the economy's materials give it a reason beyond the egg). "Get it right" (Zach).

**Architecture (DECIDED — D307, spike-proven):** trimesh cave interiors under the INTACT terrain
heightfield (no ejection below the sheet; full KCC control) + a chunk-local heightfield→trimesh
collider swap at the entrance chunk with a real carved opening (the sheet is two-sided — you
can't pass through it, so the opening must be real geometry). NO portals/teleports.

**Branch:** `campaign/2026-07-19-underworld` (from master + D307). **Push HELD.**

## Non-negotiable constraints
- Determinism (D290): cave layout seed-pure per site descriptor; save-additive.
- Rule 7 thickness / rule 9 collision-matches-visual — `verify:solid` disciplines apply to the
  cave kit (walkin gate with a declared `intendedOpening` at the mouth — the leviathan lesson).
- Dark-nav is a FEEL feature: torch economy, landmark-based nav, branching-tree topology (no
  maze loops), per the digest. The claustrophobic feel is human-vetoed, never self-certified.
- The entrance-chunk collider swap must keep placement/collider/chunk gates green and the
  surface world byte-identical outside the swapped chunk.
- One code-writing agent at a time · never `git stash` · Fable plans / Opus executes.

## Human checkpoints
1. **Cave-plan approval**: generation method + topology + scale + the entrance read (a blockout
   walk of one greybox cave) BEFORE detail cycles.
2. **The descent feel walk-test**: darkness/torch/dread pacing on the detailed cave.

## Cycle ladder
| # | Unit | Gate |
|---|---|---|
| 1 | The entrance-chunk collider-swap mechanism + a carved test opening (the enabling tech) | verify:all + a walk-in/out march through the opening; surface world unchanged elsewhere |
| 2 | Cave-gen core: deterministic room-graph + corridor layout under the sheet (greybox trimesh, lit debug), one site wired to a descriptor | determinism ×2 + a full-cave KCC march (every room reachable) |
| 3 | Blockout walk + vista/entrance shots → **PAUSE (checkpoint 1)** | screenshots + the plan doc |
| 4-6 | Per Zach's direction: cave dressing to hero quality (rock vocabulary, the egg chamber, cave-exclusive loot via lootRegistry, dark-nav landmarks, torch/audio design) | verify:solid-style cave checks + visual iteration |
| 7 | **PAUSE (checkpoint 2)** — the descent walk-test | — |
| 8 | Integration: egg relocation, journal/story beat, perf, docs, summary | verify:all + summary |

**Ceiling:** 6M / 16 cycles. Checkpoints as listed.
