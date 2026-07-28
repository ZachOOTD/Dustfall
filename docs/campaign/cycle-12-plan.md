# Cycle 12 plan — THE SKELETON & THE JOURNAL

**Campaign:** DEEPER · branch `campaign/2026-07-24-deeper` · cycle 12 of the post-walk-test ladder.
**Source of truth:** [steering.md](steering.md) 2026-07-28, Zach verbatim —
*"there should be a journal and a skeleton in one of the caves with some loot."*
**Status:** RECON COMPLETE, not started. Read-only investigation, 2026-07-28. No probe was run
(the cycle-11 gate suite was live on this machine).

---

## 0. The headline finding — the beat is already built, in three pieces, in three files

Cycle 11's shape repeats exactly. This is **not** "model a skeleton and build a lore system." Every
load-bearing part ships today and has for months; cycle 12 is a **composition + placement + lifecycle**
job.

| Piece | What exists | Where |
|---|---|---|
| **The skeleton** | `makeSkeleton(): THREE.Group` — a HUMAN skeleton (pelvis → 5-vertebra spine → 4 rib arcs → skull with eye sockets/nasal/brow/jaw → 2 arms → 2 legs), authored in **exactly the pose this beat needs**. Its own header: *"positioned to read as 'slumped against the back wall, died writing'"*. Faces +Z, origin at the floor between the feet, right arm reaching ~0.65m +Z **toward a journal**. | `src/world/skeleton.ts:36` |
| **The journal** | `placeJournal(scene, pos, yaw, kind, content): Journal` builds the leather book, tags `userData.interactType='read' / interactRegistry='journals' / interactSubKind=kind`. `updateInteraction` raycasts `ctx.journals.list` every frame → `[E] read journal` → `openJournalPanel(ctx, kind, content)` renders a modal. Read-state persists per-kind in `journalReadKinds` (save v11+). | `src/world/journal.ts:119`, `src/player/interaction.ts:1227-1246`, `src/ui/journalPanel.ts:212` |
| **The loot** | `spawnLootContainerAt(scene, pos, contents, rand)` — *"no terrain snap (the caller knows the cave floor Y), no collider"*. Already used for the origin cave's three deep caches. Saved as `{id, opened, contents}`. | `src/world/lootContainers.ts:108`, `src/main.ts:245-248`, `src/persistence/save.ts:235` |
| **The staging kit** | `makeColdFirePit`, `makeFallenCanteen`, `makeCairn`, `makeCrate`, `makeBedroll`, `makeTool`, `scrapBit` — all module-private in the vignette file, all rule-7 clean. | `src/world/wordlessScenes.ts:35-169` |
| **The placement machinery** | `addFungi` / `addRubble` are copy-shaped templates: a private RNG stream keyed off the cave seed, `rockFloor(x,z,fallback)` for real-rock seating, `makeWallCaster` for wall mounting, `decor` vs `meshes` for the collider decision. | `src/world/caveGen.ts:1426, 1106, 822, 886` |

**The two precedents that already pair a skeleton with a journal:** `openingScene.ts:175-188` (the
opening wreck's dead survivor — skeleton at `backZ - 0.45`, journal at the outstretched right hand)
and `wordlessScenes.ts:176/193` (`sceneLastFire`, `sceneWatcher`). Cycle 12 is the third instance of
a staging the game already knows how to compose — moved underground and made readable.

### What is genuinely NEW

1. A `'cave_explorer'` `JournalKind` + its text (§6).
2. A `deadExplorer.ts` composer + a cave anchor for it.
3. A second `CaveResidentSink` (lifecycle: attach on cave load, **detach on eviction**).
4. A tiny additive save branch so the cache is looted **once** (§4).
5. A close-read pass on `makeSkeleton()` — it was authored for a dim wreck at 2-4m and this beat is
   read at **torch range, 1-2m** (§2).

---

## 1. THE DIGEST QUESTION — the constraint in the brief does not bind

The brief flags the origin-parity digests (`d8f15005` seed 1337 / `99e0015b` seed 7, both kind
`canonical`) as a hard gate that a cave-content change would move, requiring Zach-sanctioned
re-baselining. **Verified: it does not, if the beat is spawned the way the scrap already is.**

`caveDigest(graph, allMeshes)` (`caveGen.ts:2476`, called at `:2400`) hashes the room graph plus
**every vertex position of every mesh in `allMeshes = meshes.concat(decor)`** (`:2380`), rounded to 1cm.
So:

- **Adding a mesh to `meshes` or `decor` MOVES the digest** — even at local origin, because its
  vertices join the hashed set. This is the trap.
- **Anchors are not hashed.** `scrapAnchors`, `lootAnchors` and `eggDaisTop` are `Vector3`s on
  `SpawnedCave`, published *after* the hash, and their content is spawned outside `caveGen` entirely.
- The digest is computed inside `doFinalize`, **before any resident sink attaches**. A sink-spawned
  mesh goes into `three.scene`, never into `meshes`/`decor`, and therefore **cannot** move it.

**Therefore: publish an anchor from `caveGen`, spawn the whole beat from a resident sink.** The
digests are provably untouched no matter which cave carries the beat. This is also forced anyway —
`caveGen` has no `GameContext`, and the journal needs `ctx.journals.list` while the container needs
`ctx.lootContainers.list`.

Two second-order parity notes, both handled:
- The site-descriptor draw budget is **fixed and append-only** (`caveSites.ts:117-127`): five draws
  run unconditionally, and cycle 9 added the kind roll **last** precisely so placement digests
  (`f180c0fc` / `f95e4986`) stayed byte-stable. A sixth draw appended after `kind` is safe **by the
  same proof**. Better still, §3's recommendation needs **no new draw at all**.
- The origin cave consumes **no pickup ids** today (`main.ts:798`, canonical `scrapPerCave` 0). §3
  keeps the beat off canonical, so that stays true.

---

## 2. The skeleton at torch range — scope it honestly

`makeSkeleton()` is anatomically complete and correctly posed, but it was authored for a dim wreck
interior at 2-4m. Cycle 10 raised the torch to **2.7 intensity / 15m** and this prop will be read at
**1-2m with a light source in hand**. Three defects that only appear at that distance:

- **R7-VIOLATION — the eye sockets are zero-thickness.** `skeleton.ts` uses
  `new THREE.CircleGeometry(0.032, 10)` for each socket. A single-face disc: face-on it works, and at
  a head-turn it vanishes edge-on. Rule 7, on the one feature a player will put their face against.
  Fix: a recessed solid (a shallow inverted cone / a sphere-boolean-style dish), not a disc.
- **TAPER-TO-BLADE risk.** Limbs are 5-6-segment `CylinderGeometry`. The project already paid for
  this class of bug in the dripstone kit and fixed it with a **tip-radius floor**
  (`caveGen.ts:502-508`, `SPELEO_TIP_FLOOR = 0.22`, whose comment is verbatim the critique that will
  land here: *"on a 30cm-base nubbin it is a 4cm-wide blade, and at arm's length that is a paper
  shaving"*). Any bone that tapers gets the same floor.
- **FACETING.** 5-6 radial segments and `IcosahedronGeometry(0.11, 1)` read as faceted tubes and a
  polygonal ball at 1m. Raise segment counts; the prop is a handful of meshes in one cave.

**The upgrade that is worth it:** swap the limb cylinders for `sweptTube(pts, radii, radial, wobble, jag)`
(`giantRibcage.ts`, already cross-imported by `boneScatter.ts`) — a closed, capped, tapered tube along
a polyline, with `jag` producing a **splintered fracture cross-section** on a deliberately broken bone.
That is rule 7's "show a real cross-section" clause satisfied by an existing, reviewed function.

**Colour.** Do **not** reuse `heroBoneMaterial` (`giantRibcage.ts:89`): its registered emissive is a
*sun-cancelling* device that goes to zero underground, and `weathering: 0.9` is tuned for 50-70m
reads. Follow D252's cave direction instead — `deepCave.ts:42` uses `0x8a7d68`, *"muted DRIED old
bone, not bright white"* — via `createBoneMaterial(0x8a7d68, {...})`.

**Collider: NONE.** A ~0.9m slumped figure against a wall, off the walk line, is exactly the
"step over / walk between" case the scatter rule covers (`boneScatter.ts:27-33`). A collider would
put the prop into the march gate's floor-grid margin business for zero gameplay gain. Tag the subtree
`isWreckDecoration` (honoured by `bodies.ts:138`).

**Rule 8 rounds: 5-8.** This is a NEW hero-ish visual element read at conversation distance, not a
tuning pass. Budget it as such — the framings that matter are (a) torch-lit at 1.5m head-on,
(b) the skull at 1m with a head-turn (the socket fix), (c) a grazing/edge angle on every limb,
(d) the fracture cross-section, (e) the whole tableau at 4m as the player enters the room. **Not**
one framed shot.

**Backward compatibility is a hard constraint:** `openingScene.ts:175` and `wordlessScenes.ts:176/193`
call `makeSkeleton()` with no args. Give the new options object defaults that reproduce today's
output exactly, or the opening scene changes. *(Judgement call for Zach: the socket + taper fixes are
arguably improvements the surface skeletons should also get — see Q7.)*

### The staging — tasteful, not horror

Recommended tableau, all from parts that exist:

> **Slumped against a chamber wall, off the walk line.** The right arm reaches out — the pose is
> already authored for this — with the **journal** at the fingertips. A **spent lantern** on its side
> just past the hand (the light that ran out; cycle 11 just made lanterns the cave tool, so this reads
> instantly). A **fallen canteen** at the hip. The **loot cache** (an open-lidded crate,
> `makeCrate(rand, true)`) against the wall beside them, gear half spilled out. A cold, dead thing —
> no blood, no rictus, no staging for shock.

The story is told by the arrangement: they got to this wall, they sat down, they wrote, the light
went out. No text is required to read it — the journal is the *reward* for reading it, not the
delivery mechanism.

---

## 3. Placement — RECOMMEND the `warren` kind

Zach's three options, scored against what recon found:

| Option | Verdict |
|---|---|
| **(a) origin / egg cave** | **NO.** Digests are safe (§1), but this room already carries THE objective (the companion egg on the dais) *and* three deep loot caches. A second story beat in the game's one unique landmark competes with the beat that is already there. It also puts an authored corpse in the room every player is funnelled to, which converts a discovery into a set-piece. |
| **(b) a rare roll on streamed caves** | Workable, but a bare 1-in-N roll makes the gate's "does it exist" question expensive and the fiction arbitrary. |
| **(c) a specific cave KIND — `warren`** | **RECOMMENDED.** |

**Why the warren.** It is *already dressed as this story.* Its own design note (`caveKinds.ts:283-287`)
reads: *"a tight salvage warren… there is man-made SCRAP on the floor"*, and it ships
`scrapPerCave: 6` arranged as three two-flake caches, `salvagePlates: 2` leaning on rubble heaps, and
`rubblePerChamber: 1` — dressing whose stated intent (`caveGen.ts:2273-2275`) is *"the grammar of
somebody having stopped and worked there."* **The dead explorer is the person that dressing already
implies.** Cycle 12 gives the warren its subject.

Three further wins, all mechanical:
- **Origin parity is free.** Canonical never carries the beat, so the origin cave is untouched by
  construction — not by a re-baseline, and not by Zach having to approve one.
- **The gate host already exists.** `cave-kinds` builds a warren by construction every run (§5).
- **No new RNG draw.** `kind` is already on the descriptor (`caveSiteInCell` returns it). The rule is
  a pure read, not a roll — the strongest possible determinism story.

### The seed-pure placement rule

> **A cave carries the dead-explorer beat iff `desc.kind === 'warren'`.** Within that cave, the
> anchor is the **deepest non-egg, non-entrance chamber** (`graph.nodes` filtered, sorted by
> `floorY`, tie-broken by `id` — a total order, no RNG), seated against the wall at
> `0.72 · rx` from centre on a bearing drawn from a **dedicated stream**
> `makeRng((seed ^ <new key>) >>> 0)` — never `srand`/`frand`/`prand`/`rrand`/`scrand`
> (`caveGen.ts:2144-2148` states this constraint outright). Floor Y from `rockFloor(x, z, fallback)`,
> wall normal from `makeWallCaster` — **never `node.floorY`**, which is the analytic plane and
> disagrees with the SDF surface by up to 0.375m (`caveGen.ts:803-809`: *"A salvage plate seated on
> the plane hung a metre over the sand."*).

Deepest-non-egg keeps it out of the objective room and away from the entrance hall (the composed
hand-off frame), and makes the fiction literal: they went as deep as they could.

**Findability — ESTIMATE, not measured.** Site density ≈ `CAVE_SITE_CHANCE 0.60 × rocky 0.35 /
(0.46km)²` ≈ **1.0 caves/km²** before relief/conflict rejections; warren weight is `0.19` of a
`1.00` total, so ≈ **0.19 warrens/km²** → **nearest warren ≈ 1.3 km**. Origin exclusion is 1.15 km,
so the first beat cave sits just past the origin ring. Every warren carrying it is therefore *findable
without being commonplace*. **These are arithmetic estimates; the `cave-density` leg measures the real
number and the gate asserts against the measurement, not this comment.** (Alternative if 1.3km reads
as too common: gate on a seed roll so ~1-in-3 warrens carries it → ~2.2 km. Q3.)

**Repetition is handled by a shipped mechanic:** `journalReadKinds` is per-*kind*, so a second beat
cave shows `[E] read journal (read)` — dimmed (`interaction.ts:1237-1241`). The game already tells
the player "you've seen this one."

---

## 4. The loot cache — PROPOSAL ONLY, Zach approves

**Economy is a morning gate.** This section touches **no** `lootRegistry` entry, **no** drop rate and
**no** recipe. Contents are **hand-authored** and passed straight to `spawnLootContainerAt` — the same
call the origin cave's caches use, but with an authored array instead of `rollCaveCache(rng)`.
Consequence worth stating: **`verify:loot`'s 1000-roll digest cannot move**, because nothing it hashes
is touched. (Exact precedent: `pickups.ts:519-521` for cave scrap.)

**The fiction first — what were they carrying?**

| Item | Why it's there | Count |
|---|---|---|
| `lantern_kit` | **The light that ran out.** The single most story-load-bearing item in the cache, and it hands the player cycle 11's cave tool at the moment they learn why it matters. | 1 |
| `metal_pipe` | What they came down for. Warren = salvage. | 2 |
| `wiring` | Same. | 2 |
| `battery` | The scarcest material (Scavenger's Economy). One, as the "they did find something" payoff. | 1 |
| `scrap` | Ordinary salvage, the bulk. | 3-4 |
| `cloth` *(optional)* | Their kit. Flavour, not value. | 1-2 |

⚑ **FLAGGED FOR ZACH — every number above is a proposal.** The `lantern_kit` is the one I would argue
for hardest on design grounds; the `battery` is the one most likely to want cutting on economy grounds.

**How it is granted:** ONE `spawnLootContainerAt` — the existing searchable-container flow (walk up,
`[E]`, the loot menu overlay, take what you want). **Not** loose pickups: loose flakes are the
warren's *ambient* dressing and would read the beat as more of the same; a container reads as
*their pack*. Visually it is `makeCrate(rand, true)` — the open-lidded, rifled variant — spilled
beside the body.

**Persistence — the one real engineering gap, and it is small.**
`spawnCaveScrapAt` is `transient: true` by D299: *"Taken-state does not persist for a streamed cave…
and is flagged as such"* (`pickups.ts:523-527`). For six scrap flakes that is an acceptable deal. For
a one-time authored cache containing a battery it is an **infinite farm** — re-enter the cave, the
crate is full again. So the beat needs persistence that the streamed cave does not have today.

**The cheap correct fix (do NOT build general cave diffs):** a single additive optional save array
keyed on the **descriptor key**, never on a runtime id (the D292 trap):

```ts
caveBeats?: Array<{ key: string; looted: boolean }>;   // key = `cave:<gx>,<gz>`
```

Additive + optional ⇒ **`SAVE_VERSION` stays 18, no migration** (the exact shape of the cycle-11
lantern precedent, `save.ts:310`). The sink consults it on attach: if `looted`, spawn the skeleton and
the journal (the story survives) and the crate **already empty** (or absent). The journal's own
read-state needs nothing new — `journalReadKinds` already persists and is already keyed by something
stable. ~40 LOC total.

---

## 5. Gates — two sub-rows on two existing legs, NO 25th leg

The suite is **24 legs** today (verified), so "no 25th leg" is literal. Both proofs ride existing legs
via the established sub-row idiom (`chunk-perf`→`CAVE-BUILD`; cycle 11's `pool-fill`→`LANTERN-RT`+
`CAVE-COLD`). **Ports are derived from declaration order** (`verify-chunks.mjs:116`), so a sub-row also
keeps every later leg's port stable — a second, quieter argument for it.

### Gate A — `BEAT-SITES`, rides `cave-density-<seed>` (×2 seeds, SOLO, est 5) · cost ≈ **seconds**

Pure descriptor math over hundreds of sites — **no cave is built**. `cave-density` already sweeps
sites purely and already runs at both seeds, which is where the ×2 determinism requirement is
satisfied cheaply.

1. **Seed purity.** Re-derive every site in the sweep twice; the beat flag must be identical both
   times, and identical to `desc.kind === 'warren'`.
2. **Existence + findability.** ≥1 beat site within the swept radius at both seeds; report the
   measured nearest-beat distance and the realized beat density (assert against the *measurement*,
   with a generous envelope — not against §3's arithmetic).
3. **ORIGIN PARITY, proven purely.** No beat site inside the origin exclusion radius, and
   `canonical` never carries the beat. This is the assertion that makes "`d8f15005`/`99e0015b` cannot
   move" a machine fact rather than a claim.
4. **Vacuous-pass guard.** FAIL if fewer than N sites were swept or if zero warrens were seen —
   "green because nothing was tested" is the exact failure mode cycles 5 and 8 both hit.
- **Red-proof:** set the beat predicate to a mutable module global instead of the descriptor → the
  double-derivation in (1) diverges → RED. Record the RED output in the cycle log.

### Gate B — `BEAT-BUILD`, rides `cave-kinds` (SOLO, est 25) · cost ≈ **+2-3 min** (ESTIMATE)

`cave-kinds` is the **only** leg that builds a warren by construction — it already builds, marches and
shoots all four non-canonical kinds. That is why it hosts this and `pool-fill` does not: `pool-fill`
boots the preloaded origin cave, which is `canonical` and by design never carries the beat.
*(UNVERIFIED: I did not read the `cave-kinds` scenario body, so whether it currently drives any
interaction at all is unconfirmed — if it does not, the `[E]` drive is new code inside that scenario.)*

1. **The beat exists at its seed-pure site.** The built warren publishes a beat anchor; skeleton,
   journal and container are all in the scene at it.
2. **Seated on REAL floor.** A Rapier downcast from just above the skeleton's origin hits within
   **5cm**, *and the hit collider handle is the CAVE BODY, not the terrain heightfield* — the rule-9
   collider-identity idiom `skyfall-walk` and cycle 11's `LANTERN-RT` both use. Reuse
   `placementGroundY` (`src/world/placementGround.ts`, cycle 11) as the sampler so the gate and the
   game agree by construction.
   *Red-proof: seat on `node.floorY` (the analytic plane) → the gap blows past 5cm in displaced
   rooms.* This is a **real historical bug**, not a hypothetical.
3. **Readable through the REAL interaction path.** Walk the KCC to within `RAYCAST_DISTANCE` (2.5m) —
   **real WASD under gravity, never `placeAt`** (the `leviathan-walk` lesson: that leg teleports its
   waypoints and was once green on an unclimbable ramp; `walkToward` at `rig-shot.mjs:2471` is the
   legitimate pattern) — assert `ctx.inventory.hover.type === 'read'`, press `KeyE`, assert
   `isJournalPanelOpen()` and that `journalReadKinds` gained `'cave_explorer'`.
   *Red-proof: omit the `ctx.journals.list.push` → the raycast never hits → no hover → RED.* This is
   the exact trap the idiom sets: **`placeJournal` does not register itself.**
4. **Grants once, and persists.** Open the container, take everything, `saveGame()` → read
   `SAVE_VERSION` out of the written JSON and assert **18** (a stray bump reds this) → `loadGame()`
   → re-attach the cave → the crate is still empty. Then evict + re-stream the cave → **still empty**.
   *Red-proof: skip the `caveBeats` write → it refills → RED.*
5. **Vacuous guards.** FAIL if no warren was built, if the container held 0 items, or if the journal
   panel never opened.
6. **Teardown / leak canary.** After eviction: `ctx.journals.list` and `ctx.lootContainers.list` back
   to baseline. A journal mesh left in the raycast union after its cave's geometry is disposed is the
   dangling-target bug `main.ts:815-821` documents for scrap, in its worst form.

### Cost statement (EFFICIENCY WATCH #1)

Gate A is pure math on an existing solo leg — **≈ 0**. Gate B adds **~2-3 min** to `cave-kinds`, which
is the parallel phase's critical path, so the suite wall grows by roughly that. **Zero new legs, zero
port churn.** If that is unacceptable, the lever is Q3 (make the beat kind-agnostic and host Gate B on
`pool-fill` for free) — but it costs the warren fiction.

---

## 6. The journal — DRAFT TEXT, for Zach's approval

Format is `{ title, subtitle, entries: ReadonlyArray<[label, body]> }` (`journal.ts:34-38`), rendered
all-at-once by the panel (no paging). The two shipped generators both emit exactly 5 entries.

Tone target: Long Dark / Mad Max / Dune — spare, practical, no melodrama, no exposition. Each entry
quietly teaches something **true about caves** without instructing: the cold that doesn't kill (cycle
11's clamped cave cold), the water that doesn't run out (cycle 6's pools), and the light budget as the
real clock (cycle 11's lanterns). **The journal is the manual for the systems cycles 6 and 11 just
built, written as a dead man's diary.**

> **SURVEY NOTEBOOK**
> *left where they sat down*
>
> **DAY ONE** — Rope fast at the mouth, forty feet down to the first floor. It's cold in here. Not
> the kind that kills you — the kind that just never lets up. Four days of oil. Three days of work.
>
> **DAY TWO** — Standing water in the third room. Black and flat and it doesn't move at all. Drank
> it, filled both flasks, waited. Fine. That's the only thing down here that isn't running out.
>
> **DAY FOUR** — Lost a day. There's always another room past the one you're in, and the next one is
> always bigger. I keep saying I'll turn back at the next one.
>
> **DAY SIX** — Last of the oil. Been walking it dark with a hand on the wall, counting. Forty steps
> from the water to the fallen roof. Ninety from there to the slope. I know the way out. I just need
> the light for the last of it.
>
> **—** — Sat down to rest a while. The dark down here isn't like night. Night has a shape to it.

No cause of death is stated. No one is named. Nothing addresses the player.

---

## 7. File-by-file change list

| File | Change | LOC |
|---|---|---|
| `src/world/journal.ts` | Add `\| 'cave_explorer'` to the `JournalKind` union (`:22`). Nothing else — `placeJournal` already dispatches the book mesh for every kind except `'crash_log'`. | ~1 |
| `src/ui/journalPanel.ts` | The `JournalContent` constant from §6 + one line in `CONTENT_BY_KIND` (`:114`). **Mandatory** — it is an exhaustive `Record<JournalKind, JournalContent>`; omitting it is a tsc error, which is the correct guardrail. | ~22 |
| `src/world/skeleton.ts` | Options object with today's output as the default (openingScene + wordlessScenes must not change). Socket fix (solid, not `CircleGeometry`); limbs → `sweptTube` with a `SPELEO_TIP_FLOOR`-style radius floor; raised segment counts; a cave bone material (`0x8a7d68`, D252). **This is the rule-8 5-8-round element.** | ~120 |
| **NEW** `src/world/deadExplorer.ts` | The composer: `buildDeadExplorer(rand, opts) → { group, journalPos, journalYaw, cratePos }`. Skeleton + spent lantern + fallen canteen + open crate + a little spilled gear, all at local origin so the caller positions the **group**. Decoration-only, `isWreckDecoration`, no colliders. | ~180 |
| `src/world/caveGen.ts` | Anchor only. A dedicated RNG stream (new XOR key), deepest-non-egg/non-entrance chamber, `rockFloor` + `makeWallCaster` seating, published as `beatAnchor: { pos, yaw } \| null` on `SpawnedCave` (`:2057`) and a count on `CaveGenProbe` (`:2018`) so the gate can read it. **Nothing enters `meshes`/`decor`** (§1). | ~55 |
| `src/main.ts` | A second `caveStream.addResidentSink({ attach, detach })` beside the scrap sink (`:804`). Attach: build the composer, `placeJournal` + **push to `ctx.journals.list`**, `spawnLootContainerAt` unless `caveBeats` says looted. Detach: splice both registries and dispose — the `chunkManager.ts:1305-1310` precedent. | ~55 |
| `src/persistence/save.ts` | `caveBeats?: Array<{ key: string; looted: boolean }>` — additive, optional. **No `SAVE_VERSION` bump, no migration.** | ~25 |
| `src/config/tuning.ts` | `CAVE_BEAT_*` block: anchor radius fraction, wall offset, crate/journal offsets, and the (flagged) contents table. Usual comment provenance. | ~20 |
| `src/debug/debugPanel.ts` + `src/ui/devPanel.ts` | A "dead explorer" warp button beside the per-kind cave buttons (`202cc16`) — reuses `gotoCaveKind('warren')` filtered to a beat site. Walk-test affordance; Zach should not have to hunt 1.3km to review this. | ~20 |
| `scripts/rig-shot.mjs` | Gate A probe in `cave-density`; Gate B probe in `cave-kinds`. | ~230 |
| `scripts/verify-chunks.mjs` | Two sub-row matchers folded into the existing `row(m, out)` of each leg, plus **an entry in each `noLineRow` array** — a missing sub-row must print `NO PROBE LINE … *** FAIL ***`, never vanish. | ~35 |

**Ballpark: ~480 LOC in `src/`, ~265 LOC of gate/rig.** No new system, no save-schema version bump,
no new tick-order constraint, no new permanent leg, no economy-registry edit.

---

## 8. Build order

1. **`journal.ts` + `journalPanel.ts`** — the new kind and its text. Smallest possible slice, and tsc
   proves the exhaustive record is satisfied. Verifiable immediately in the opening wreck by
   temporarily retagging (revert after).
2. **`skeleton.ts` close-read pass — the rule-8 loop, 5-8 rounds** (§2). Do this BEFORE any placement
   work: it is the long pole and the only genuinely visual item. Screenshot every ≤150 LOC. Confirm
   `openingScene` output is unchanged.
3. **`deadExplorer.ts` composer**, shot standalone at 1.5m and 4m under a torch.
4. **`caveGen.ts` anchor** + probe field. **Assert the digest did not move** (`cave-digest` scenario,
   the fast path — this is the cheap proof of §1, and it should be run before anything depends on it).
5. **Gate A, RED FIRST.** Land the sweep, break the predicate's purity, **record the RED output in the
   cycle log**, restore. (Steering: *"a gate that can't be demonstrated failing on the broken build is
   a gate that launders bugs as verified."*)
6. **`main.ts` sink** (attach + detach + leak-clean) and `tuning.ts`.
7. **`save.ts` `caveBeats`** + the looted branch in the sink.
8. **Gate B, RED FIRST** on each of its three teeth in turn: seat on `node.floorY` (floor identity),
   drop the `journals.list` push (readability), skip the `caveBeats` write (grants-once). Record each
   RED, restore.
9. **Dev-panel warp button.**
10. `npm run verify` (tsc) after each step. **The orchestrator — not an agent — runs
    `verify:chunks --legs=cave-density,cave-kinds,cave-walk` ONCE at close** under its own tracked
    background shell (steering THE STALL RULE).

---

## 9. Risks

- **R1 — `placeJournal` does not register itself.** It tags and `scene.add`s; the caller must
  `ctx.journals.list.push(...)`. Forget it and the prop is visible, correct, and completely inert —
  a silent failure with no error. Gate B tooth 3 exists specifically for this.
- **R2 — eviction must splice BOTH registries.** A journal mesh left in `ctx.journals.list` after its
  cave's geometry is disposed is a dangling raycast target: you'd read a book inside solid rock in a
  cave that no longer exists. `main.ts:815-821` documents the same class of bug for scrap, including
  the double-despawn trap on pooled instances — **only despawn what is still live; membership is the
  guard.**
- **R3 — the cache is a farm without §4's persistence.** Streamed-cave taken-state does not persist
  today (D299, by design). Shipping the beat without `caveBeats` means re-entering the warren refills
  a battery cache. This is the one item in the cycle that is a correctness bug rather than a polish
  gap.
- **R4 — the skeleton upgrade touches the OPENING SCENE.** `makeSkeleton()` has three call sites and
  the opening wreck is the game's first impression. Defaults must reproduce today's output byte-for-byte
  unless Q7 says otherwise.
- **R5 — `cave-kinds` is the critical path.** It is solo at est 25 min and Gate B lands on it.
  Budgeted at +2-3 min (ESTIMATE, unmeasured). If it comes in materially worse, Q3 is the lever.
- **R6 — tone drift.** This is a survival game, not a horror game. Every round of the rule-8 loop
  should be critiqued against "does this read as sad and quiet, or as a scare?" A skull lit from below
  at 1m is very easy to make ghoulish by accident. Light it from the player's own torch, keep the
  posture collapsed rather than contorted, and no rictus grin.
- **R7 — UNVERIFIED items, listed plainly.** (a) Whether the `cave-kinds` rig scenario currently drives
  any interaction — if not, the `[E]` drive is new scenario code. (b) The +2-3 min Gate B estimate.
  (c) The 1.0 caves/km² / 1.3 km findability arithmetic (pre-rejection; the gate measures the truth).
  (d) That `pool-fill` boots the canonical origin cave — inferred from the preload path, not read.

---

## 10. Q-list for Zach — every one has a recommended default

| # | Question | **Recommended default** |
|---|---|---|
| **Q1** | **Which cave** carries the beat? | **Every `warren`.** Its shipped dressing (6 scrap in caches, 2 salvage plates, rubble) already implies a person; this gives that person a body. Origin digests untouched by construction, and the gate host already builds a warren every run. |
| **Q2** | Does this **move the origin digests** (`d8f15005` / `99e0015b`)? | **NO — and provably.** The beat is sink-spawned, so its meshes never enter the hashed set, and canonical never carries it anyway. **No re-baseline is being requested.** |
| **Q3** | Warren-only, or a **rarer roll**? | **Warren-only, every one** (~1.3 km to the nearest, ESTIMATE). Alternatives: 1-in-3 warrens (~2.2 km, rarer, needs one appended descriptor draw); or kind-agnostic (commoner, but loses the fiction and would let Gate B ride `pool-fill` for free). |
| **Q4** | **What's in the cache?** | 1 `lantern_kit` · 2 `metal_pipe` · 2 `wiring` · **1 `battery`** · 3-4 `scrap` (+1-2 `cloth`). ⚑ Economy gate — **your call, hand-authored, no `lootRegistry` edit, `verify:loot` cannot move.** The `lantern_kit` is the one I'd argue for; the `battery` is the one to cut if you want it leaner. |
| **Q5** | **A container, or loose pickups?** | **One container** (an open-lidded crate). Loose flakes are the warren's ambient dressing; a container reads as *their pack*. |
| **Q6** | Does the cache **persist as looted**? | **YES** — additive `caveBeats` array, `SAVE_VERSION` stays 18. Without it a battery cache refills on every re-entry (R3). |
| **Q7** | Do the **surface** skeletons get the close-read upgrade too? | **NO by default** — defaults reproduce today's output, so the opening scene is untouched. But the zero-thickness eye sockets are a rule-7 violation everywhere they appear; say the word and they're fixed globally in the same pass (~free). |
| **Q8** | Does the journal **grant an item**? | **NO.** No journal in the game does; reading is purely in-world and the reward is the cache beside it. |
| **Q9** | **The text** (§6) — approve, edit, or rewrite? | Ships as drafted unless you say otherwise. It's written so each entry teaches one true thing about caves (cold that doesn't kill · water that doesn't run out · light as the real clock) without ever addressing the player. |
| **Q10** | Does the skeleton get a **collider**? | **NO.** Decoration, off the walk line, `isWreckDecoration` — the shipped scatter rule. A collider would put it in the march gate's floor-grid margin for no gain. |

*Unanswered ⇒ every default above is taken — which by construction means no economy number moves, no
save version moves, no origin digest moves, and no new gate leg is added.*
