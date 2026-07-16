# Dustfall — Game Design Document

This is the design-truth document. When `decisions.md` doesn't answer a
question, consult this. When this doesn't, decide + log a new D-entry.

**Hydrated retroactively at the gamedev-framework v0.3.x retrofit
(2026-05-20).** Content extracted from CLAUDE.md, `decisions.md`
(D1-D68), `architecture.md`, and 17 sessions of shipped history.
Sections marked `TODO` need deepening via `/interview-vision` when the
user is ready to formalize them — Dustfall has been operating without
this document for its entire run, so the content below describes what
was de-facto designed, not aspirations.

---

## 1. Elevator pitch

**Browser first-person desert survival game in the tone of The Long
Dark / Mad Max / Dune.** Solo procedural sandbox where the player is
the only survivor of an unstated disaster, scavenging a 2400m radius
desert for water, shelter, and salvage while a single boss-tier sand
worm patrols the dunes.

## 2. Tone and references

| Reference | Borrows | Rejects |
|---|---|---|
| **The Long Dark** | Quiet survival as the dominant emotional tone; weather + temperature + thirst as the primary antagonists; intimate first-room narrative (one wreck, one journal, one skeleton); "you can survive but you cannot win" | Hand-painted snowy-Canadian art direction; expansive crafting trees; campaign structure |
| **Mad Max (film + game)** | Salvaged vehicle culture (the hover speeder); ruined-engine vocabulary in wreck silhouettes; raiders that exist but aren't the point | War-band combat focus; vehicular combat as core loop |
| **Dune** | Roaming sand worm boss; vast featureless dune horizons; the idea of a single hostile geography you're a guest in | Spice / political faction layer; psychic powers; established lore-canon |
| **Subnautica (procedural-only-ish)** | First-person exploration in a hostile biome you build a foothold in; no NPC chatter; environmental storytelling | Underwater specifically; defined main quest |

## 3. Design pillars

### Pillar 1 — Lone-survivor sandbox tone

The player is the only person in the world. NPCs and combat exist but
must never become the point — the game's emotional center is
solitude + weathering. Raiders were deprioritized in Session U
explicitly to protect this. The sand worm exists because Dune was
referenced as a tone — it's a hostile geography feature, not a
recurring fight.

**Implications:**
- Combat is a survival pressure, never a progression vector
- NPCs (if any) appear briefly, not as questgivers
- The world is mostly empty by intent — emptiness IS the design

### Pillar 2 — Procedural everything

No external asset files. Every mesh, sound, shader, and recipe is
authored in code. D1 (procedural-only) is the foundational decision;
D3 (procedural Web Audio) extends it to sound. The cost: art-quality
ceiling is what you can author in code. The benefit: bundle stays
tiny, world is infinitely consistent, no asset pipeline drift.

**Implications:**
- Wreck silhouettes built from `LatheGeometry` + box primitives, not
  GLTF imports (KK/LL/NN/RR wreck arc)
- Procedural shaders for surface weathering (`createRustedHullMaterial`,
  `createWeatheredConcreteMaterial`)
- Skeleton + journal + interior props all assembled from icosahedra +
  cylinders + boxes

### Pillar 3 — Browser-first, zero-install

Ship a URL, not a binary. The whole game must load + run in Chrome
without plugins or downloads. D1 commits to this; FAR_PLANE / fog /
WORLD_RADIUS tuning all defer to GPU budgets achievable in WebGL.

**Implications:**
- Bundle size matters more than per-frame headroom
- No native physics engine; Rapier WASM is the budget (~500 KB)
- Shadows + fog + post-processing are tuned against mobile-GPU
  worst-case

### Pillar 4 — Tactile world, every object earns its mesh

Every interactable + decorative prop is hand-authored to a specific
purpose. The opening wreck has a journal at a skeleton's hand. Wrecks
have salvage panels you can actually tear off. Sleds you can drag. No
"flavor objects" that look interesting but do nothing. The bar for
adding a mesh is: it serves a verb or it tells a story.

**Implications:**
- Loot is sparse (D-era choices) — every find matters
- Story props (skeleton, journal, opening wreck) are deliberate
  anchors, not background dressing
- Procedural POIs follow rules (biome-aware, distance-spaced) that
  keep them feeling intentional even though they're random

### Pillar 5 — Iteration via `tuning.ts`

Game feel is the deliverable. D4 commits magic numbers to a single
file (`src/config/tuning.ts`); 17 sessions of shipping have validated
this. Tweaking a number → reloading → feeling the change is the
fastest loop in the project, and the codebase architecture protects
that loop.

**Implications:**
- New systems must externalize their tunables (sled spring K,
  sandworm bite range, etc.)
- One file per session of tuning growth — the file is now ~500 lines;
  that's intentional
- "Magic number in a system file" is a code-review flag

## 4. Core loop

```
spawn at wreck → drink from canteen → fight thirst/heat curve →
salvage nearby wrecks for scrap/cloth/branch →
craft fire (warm) + tent (sleep) + sled (haul more) →
mount speeder → reach a further biome →
encounter sand worm or raider (combat is incidental, not central) →
return to shelter → save → repeat next day cycle
```

The 30-second cycle the player repeats: **scan horizon → pick a POI
→ travel (on foot or via speeder) → interact (salvage / drink / loot)
→ return toward shelter as stats decay**.

## 5. Vertical slice scope

**Already shipped. Session W (opening scene) was the de-facto Tier 1.**

The vertical slice was: spawn in the opening wreck → read the journal
→ exit to find the speeder → explore enough world to feel the
loneliness → drink from a water source → survive one day-night cycle.
This was working by Session W and has been polished + extended for
every subsequent session.

## 6. Tier ladder

**Dustfall opts out of the framework's tier-ladder structure** because
it's post-MVP. The retroactive equivalent of "tier N shipped" is the
session arc:

| Session range | What proved out | Approximate tier-equivalent |
|---|---|---|
| A–H | Browser runtime + Rapier + GameContext + procedural world | Tier 0 (foundations) |
| I–W | Inventory + crafting + interactions + opening scene + journal | Tier 1 (vertical slice) |
| X–CC | Audio architecture + atmosphere + speeder + animated title | Tier 2 (target) |
| DD–PP | Sand worm + weapon variants + procgen POIs + biome rework | Tier 3 (expected) |
| QQ–RR | Sled mechanic + sandworm rescale + opening wreck redo | Tier 4 (stretch / polish) |

Future sessions track via the per-session workflow (`/session-start` /
`/session-end`), not tier verification. See `docs/roadmap.md` for what
is queued.

## 7. Mechanics

Living systems (post-RR). Per-system rules + edge cases live in
`docs/decisions.md` and per-module headers.

### Survival stats

Thirst, hunger, temperature (cold/heat), stamina, health. All
decay-on-time-elapsed; thirst is the dominant pressure. Sleeping in a
tent skips a chunk of dayTime + cools temperature. See
`src/stats/survival.ts`.

### Crafting

Recipe registry in `src/ui/craftingMenu.ts`. Ingredients consumed,
products added. Recipe count growing — there's a backlog item to
rework into a free-combination "discover" system.

### Combat

Generalized in Session PP: `WeaponKind` dispatch (melee / ranged /
charged) in `src/player/combat.ts`. Lizards, raiders (currently
dormant per Session U), and the sandworm are damageable. No XP /
progression.

### World

3×3 grid of 800m heightfield chunks (FF), biome-aware procgen POIs
+ lizards (HH), one sandworm in the dune biome (DD/MM/QQ-2), placeable
fires + tents + sleds.

### Sled / tow rope (Session QQ + QQ-2)

Dynamic Rapier body + **inextensible rope constraint** (D67) ties to
player or speeder. Bidirectional cargo inventory. Lock-rotation +
manual-yaw to prevent spinning.

### Speeder (Session CC arc)

Hover vehicle with PD terrain-tracking, headlamp, mountable. Now has
a back-bar (QQ-2) for sled rope attachment.

### Opening scene

Single fixed wreck at world (-50, 0, 0) with a skeleton + journal at
the back. Just rebuilt in Session RR using LatheGeometry. The
narrative anchor of the game.

## 8. Progression / economy

**None — exploration + survival driven.** No XP, no levels, no
unlocks. Crafting recipes are static. The "progression" the player
feels is mastery of the world map + their own stat management +
incrementally better gear they salvage / craft.

## 9. Art and audio direction

- **Visual approach:** Procedural-only (D1). MeshLambertMaterial +
  `flatShading: true` everywhere; procedural rust/concrete shader
  patches applied via `onBeforeCompile` (OO). Sky shader, terrain
  shader, hull weathering — all in code.
- **Audio approach:** Procedural Web Audio (D3). Every sfx is a JS
  function in `src/audio/audio.ts` synthesizing via filtered noise +
  oscillators. Music + ambient stems are deferred (Session X
  architected the slots; .ogg sourcing remains a backlog item).
- **Palette:** Warm desert tones — sand `~0xC9A26B`, rust
  `~0x8a4f30`, hull `~0x7a6e58`, sky-day `~0xd6a368`. Defined in
  `src/config/tuning.ts` HEX constants.

## 10. Tech stack

Three.js + TypeScript + Vite + `@dimforge/rapier3d-compat` +
`simplex-noise` + procedural Web Audio. No multiplayer. No server.
Single-page browser app.

## 11. Anti-features

What Dustfall explicitly is NOT. If a session starts drifting into
these, stop, log to `backlog.md` as `[idea]`, and return to the
current direction.

- **Not an MMO / multiplayer.** Solo experience by design.
  > *⚠ OPEN CONTRADICTION (flagged 2026-07-15): multiplayer (co-op) is now on the active idea list — see `docs/campaign/feedback-and-ideas-2026-07-15.md` §C and `docs/campaign/audit-and-roadmap-2026-07-15.md` C3. This anti-feature (and the "No MP planned" hard stop in §14, and "No multiplayer. No server." in §10) has NOT been resolved. Resolve deliberately via `/interview-vision` BEFORE any Phase-5 MP work — do not silently drift.*
- **Not a base-builder primarily.** Tents + fires are placeable, but
  the game isn't "build a fortress" — it's "survive a hostile
  geography".
- **Not a horror game.** The tone is melancholy, not jump-scares. The
  sand worm is awe-inducing, not terror-inducing.
- **Not lore-heavy.** The opening journal is the only authored
  narrative. Nothing else is "story content" — the world tells you
  what happened by what's left of it.
- **Not driven by combat.** Combat exists; it's not the loop.
- **Not free-roam-anywhere.** The world has soft edges
  (`WORLD_RADIUS`) and fog — you can't escape to infinity.

## 12. Scope-cut candidates (pre-committed)

Populated 2026-06-18 for the `campaign/2026-06-18` autonomous run (`--plan-first`).
Historically Dustfall applied cuts ad-hoc in the changelog (e.g., D52 `LOD ring deleted`
in NN; trim `pipe_staff` + `energy_pistol` from the QQ starter loadout). Under the
campaign, **if a cycle's `npm run verify:all` fails 3× or time-pressure trips,
`/scope-cut` (or the autonomy stop-condition) is authorized to cut from this list IN
ORDER — top entry first.** Cut juice + optional content before core/pillar systems.

**Cut order (top cut first):**
1. **`viewmodel-nits`** (M5) — purely cosmetic (3P torch-flame anim, FP held-item night dim).
   Nothing depends on it; the lowest-value unit in the queue.
2. **`smoke-signal-plume`** (M4) — atmosphere juice; standalone, nothing reads off it.
3. **The star-twinkle/drift half of `atmosphere-feeltunes`** (M4) — cosmetic sky polish.
   KEEP the cloud-shadow + storm-wall-sweep half (that's the load-bearing storm feel).
4. **`multi-worm-population` N>2 scaling + retreat-stalk** (M3) — the 2-worm `sandWorms[]`
   baseline already ships; N>2 is breadth. KEEP the worm model/tail/charge-dive (the §1 Dune
   pillar lever).
5. **`lie-down-to-sleep`** (M5) — nice-to-have; the instant-sleep overlay already works.
6. **`rope-attach-speeder-rear-bar`** (M5) — convenience; the existing tether flow is functional.
7. **`salvage-panel-variations` + optional wreck-breadth** (M7) — optional content.

**Never cut once started** (defer the whole unit to a follow-up instead of half-shipping):
- **Any save-touching change** — additive-only per D81; if a unit genuinely needs a
  `SAVE_VERSION` bump, **surface it to the user**, don't cut around it.
- **`worm-model-overhaul`** (M3 pillar lever) and **`security-review-repo`** (hygiene).
- A **high-risk** unit that fails (e.g. `yard-cross-poi-merge`) is **reverted to its last green
  state** per its own D237/D239 history — not half-shipped — and re-queued, not "cut".

## 13. Success conditions

Dustfall has shipped 17 named sessions. Success is no longer
"will this work?" — it's "is each session shipping a tighter,
more-felt world?" Per-session success criteria live in the
session plan file (`.claude/plans/session-X.md`) and in the
`/session-end` verification step.

**Final success** (the game-is-done bar, deferred — currently
operating in "improve until done" mode):
- First-time player averages ≥ 30-min session on a single load
- 5/5 testers want to keep playing after 10 min
- The wreck → speeder → distant POI loop produces at least one
  "I want to know what's over that ridge" moment per playthrough

## 14. Hard stops (player constraints)

| Constraint | Choice |
|---|---|
| Permadeath | No (single-slot save, dies → reload). Cited rationale: tone is melancholy, not punishing. |
| Multiplayer mode | Solo only. No MP planned. |
| Target session length | 30-60 min per save-session. Game can be played in short bursts; not designed for marathon. |
| Platform | Browser only. WebGL2. Tested on Chrome desktop; mobile not a target. |
| Save model | Single-slot via localStorage (`dustfall.save.v1`). SAVE_VERSION currently 5. Death does NOT auto-save. |

## 15. Inspiration corpus

Specific references the agent should consult when ambiguous:

- **The Long Dark** — Hinterland's "Wintermute" tone. Extract: how a
  shelter feels in a hostile world, the rhythm of stat decay vs
  resting, how environmental sound communicates threat.
- **Mad Max (2015 film)** — Extract: salvaged-vehicle silhouettes,
  ruined-engine vocabulary, the empty-horizon shot composition.
- **Dune (book + 2021 film)** — Extract: how a sand worm enters a
  scene (slow tremors before reveal), how vast scale reads through
  procedural haze and dust.
- **Subnautica** — Extract: first-person navigation through a hostile
  biome you build a small foothold in, environmental storytelling
  via leftover props (skeletons, journals).
- **Rust** — Extract (cautiously): salvage as a verb. Avoid: PvP
  surface area.

## 16. Vision deltas reconciled

This document was hydrated from existing state at the gamedev-framework
v0.3.x retrofit (Session RR end). Prior to the retrofit, design intent
was distributed across CLAUDE.md + `decisions.md` + per-session plan
archives + the running changelog. Any newer signals from playtests +
session direction should be appended to `docs/vision-deltas.md`
(currently absent — create on first need) and reconciled here at the
next `/plan-game` refresh.
