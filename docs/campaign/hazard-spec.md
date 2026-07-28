# Environmental hazard spec — DEEPER checkpoint 2

> **REVIEWED 2026-07-28 — VERDICT: NO HAZARDS.** Zach, at the walk-test checkpoint: *"i don't
> want these hazards, i want the caves more a place to explore, the temperature should be colder
> but not cold enough to damage the player. i like the lanterns."* Kept as the decision record.
> What carries forward, stripped of all damage: deployable lanterns (the existing item, cycle
> 11), cave cold as pure non-damaging atmosphere (cycle 11), and the shaft-skylight appendix
> idea (unscheduled). Nothing else in this spec gets built.

**Status: RESOLVED — rejected in person (see above).** This was the charter's checkpoint-2 document
("*a hazard spec review — a doc, not a walk-test: exactly which environmental hazards, how each is
telegraphed, and how each interacts with the light economy. Cheap to read; exists so an unfair
hazard can't ship overnight*"). Written 2026-07-28, branch `campaign/2026-07-24-deeper`.

**Ladder position.** This is charter row 9. The executed numbering drifted by one when the
displaced D-3 reassess ran as cycle 7, so hazards land as **cycle 10** — the name steering itself
uses ("*cycle 10 hazards*", 2026-07-25 note). Cycle 9 (kinds) closes first.

**The standing directive this doc exists to satisfy** (steering, 2026-07-25):
> *Anything that can DAMAGE OR KILL the player is a feel call with real consequences. Write the
> spec; build only the conservative, telegraphed subset, and flag the rest for his review. Do not
> ship a hazard that can end a run without him having seen it.*

Every hazard below is therefore tagged **CONSERVATIVE** (safe to build unattended) or
**ZACH-GATED** (does not get built until you sign).

---

## The floor everything is measured against

| fact | value | source |
|---|---|---|
| Health | `0..1`; regen `1/150`/s when thirst>0.4, hunger>0.4, \|temp\|<0.5 | `survival.ts` |
| Existing damage precedents | raider hit **0.15** · worm bite **0.50** · sarlacc tick 0.07 @0.45s · bad meat 0.05-0.08 | `tuning.ts` |
| Gentlest lethal rate the game ships | `COLD_DAMAGE_PER_SEC` **1/150** (2.5 min full→dead) | `tuning.ts:140` |
| Freeze clock, unsheltered desert night | `COLD_NIGHT_DRAIN` **1/420** (~7 min to -1) | `tuning.ts:139` |
| Torch | 180s burn, **consumed**, 12m point light | `TORCH_*` |
| Flashlight | 120s drain / 180s recharge, 25m spot, **not consumed** | `FLASHLIGHT_*` |
| Lantern | placeable, 14m, warm | `LANTERN_*` |
| Cave depth by kind | warren 24-32m · canonical 28-38 · fungal/flooded 30-40 · **shaft 42-52** | `caveKinds.ts` |
| Cave density | ~3.0-3.4 caves per travel-hour on foot | cycle 8 |
| Pools | 26cm, wadeable, ≥1 per cave, **no swimming** | `CAVE_POOL_DEPTH_M` |
| **Fall damage** | **does not exist anywhere in `src/`** | verified by search |
| Death | no permadeath, but **death does not auto-save** — you reload to your last sleep/manual save | GDD §14 |

Two GDD constraints that shape all of this: *"Not a horror game. The tone is melancholy, not
jump-scares"* (§11), and *"tone is melancholy, not punishing"* (§14, the permadeath rationale).
**A hazard here is weather, not a monster.** No stings, no screams, no jump cuts.

---

## H1 — ROCKFALL (unstable ceilings) · **CONSERVATIVE**

**What + where.** A discrete unstable-ceiling patch over a floor disk in a **chamber** (never a
corridor — a tree has no alternate route, so a corridor hazard is a coin flip on progress).
Entering the disk *arms* it; ~1.2s later a handful of rocks come down and leave a **permanent talus
heap**. The heap is not new code: cycle 9's `addRubble` already builds collider-bearing talus cones
as a general capability with canonical density 0.

Placement is seed-pure per site descriptor, drawn on the cave's own RNG stream **after** all
existing draws inside a fixed budget — the same discipline that let `caveKinds` land without moving
a single site. Density: **shaft 2-3, warren 0-1, canonical/fungal/flooded 0.** Excluded from: the
entrance hall, the egg dais radius (`eggDaisRadius` is already shared with the pool placer), the
`CAVE_SPELEO_MOUTH_CLEAR_DEG` (42°) sector at every corridor mouth, and any pool rim.

**Telegraph — what you SEE at 2-4m with a torch:**
1. **A broken ceiling directly overhead** — a shallow fracture dome ringed with exposed strata
   edges and 3-6 short, thick, **snapped-off stalactite stubs** showing flat fracture faces.
2. **Rubble already on the floor under it** — a small pre-existing talus at ~0.3× the shaft heap
   scale. Broken ceiling + fallen rock beneath it is the oldest legible warning there is, and both
   halves sit inside the 12m torch pool.
3. **Grit falling through your beam** — a low-rate trickle emitter over the disk (the `dustMotes`
   family). It ramps hard for the ~1.2s arm window: *commit or back off.*
4. **Audio** — a dry granular trickle (the existing white-noise buffer + steep highpass, the
   `playFootstepSalt` synthesis family), then one low crack ~0.8s before the drop.

**Light-economy hook.** Telegraphs 3 and 4 are the arming signal, and **#3 is invisible without
carried light** — you only see falling grit where your torch or beam catches it. Moving through a
cave dark is already how you save torch; this makes it cost you the early warning. The hazard is a
tax on moving unlit, not a random tax.

**Consequence + survivability.**

| | |
|---|---|
| Direct hit | **0.12 health** + camera shake + dust screen-flash + ~1.2s stagger. No stun, no knockdown. |
| At the disk edge / already moving out | **0** — it lands behind you |
| Worst case, all 3 shaft rockfalls headlong | 0.36 health; regen recovers it in ~54s of provisioned walking |
| **Hard clamp** | **rockfall damage can never take health below 0.15.** It wounds; it cannot kill. One line, machine-checkable. |
| Mitigation | walk (don't sprint) and the arm window is generous; it fires **once per cave visit** |
| Payoff | the room afterwards reads *this happened here* — a permanent heap you walked out from under |

---

## H2 — FOUL AIR (unventilated deep pockets) · **CONSERVATIVE**, one ZACH-GATED sub-decision

**What + where.** Not a cloud with an edge — a **depth-banded volume**: below a gas line in a
specific chamber, the air is dead. It is a place, not an event.

The placement rule is diegetic and derivable from the graph the generator already has: **leaf
chambers only** (degree 1 in the room tree) at depth ≥ ~30m — air pools where it cannot drain.
Never on the trunk, never the egg chamber, never the entrance hall, and **never a chamber that is
the route to another chamber** (leaf-only, machine-asserted). So foul air can never gate progress;
it always guards an *optional* pocket — which is exactly where cycle 11's "reason to return" loot
(the battery/wiring tier) wants to sit.

Density: **warren 1** (its deep dug pockets), **shaft 0-1** (deepest), canonical/fungal/flooded 0.
Flooded is excluded on fiction *and* geometry — water already fills the low points.

**Telegraph — the hero telegraph is the flame, and it is exactly the charter's ask:**
1. **YOUR TORCH GUTTERS.** Crossing the gas line, flicker amplitude ramps (`TORCH_LIGHT_FLICKER_AMP`
   0.4 → ~1.1 across the entry band), mean intensity drops, colour slides down to a dull orange-red,
   and the crackle becomes a low guttering hiss. It happens in the first second, **before any stat
   moves**, and it is unmissable because the torch is the one thing you are already watching.
2. **A layer you can see** — the cave fog raised locally in that chamber (the same mechanism
   `updateCaveAtmosphere` already lerps globally), plus dust motes that *sag* downward instead of
   hanging. Read at torch range: *the light doesn't go as far in here.*
3. **Dead-air acoustics** — the hush deepens and `CAVE_BED_DRIP_ECHO_S` shortens. Cheap; it lands.
4. **Your breathing** — labored, on the shipped diegetic-survival audio path.

**Light-economy hook — the best mechanic in this spec, because it splits the two light sources:**

| | |
|---|---|
| Torch | gutters + **burns ×1.8 faster** below the gas line. The gas taxes your light budget directly. |
| Flashlight | **immune** (electric) — foul air is where the flashlight finally earns its keep, at the cost of its 120s battery |
| Lantern | gutters and dims visibly, but **never goes out** — a silently-deleted breadcrumb is how you strand a player |
| **Explicitly NOT built** | **the gas must not extinguish your torch.** Losing your only light in a dead-end pocket 40m down *is* the run-ender the directive prohibits. Guttering + faster burn is the whole mechanic. |

**Consequence + survivability.**
- **Stamina** is the primary pressure: drain doubled, recovery ×0.25. You cannot sprint out. Real,
  felt, non-lethal, and it reads exactly as *I can't breathe in here*.
- **Health drain: the gated part.** After a **12s grace**, `1/150`/s — deliberately *the exact rate
  the game already ships for freezing*, so the number is not new; it is the project's established
  "recoverable spiral, not a cliff." 2.5 minutes of standing still and doing nothing.
- **Exit is always up and back the way you came**, ≤ ~10s of walking from anywhere in a leaf pocket
  (chamber radii 2.6-6.8m). The survivable margin is ~15× the required escape time.
- **On exit, damage stops instantly.** No lingering timer, no poison. A hazard that kills you 200m
  later reads as unfair and is banned here.

**The ZACH-GATED bit (Q1).** The mechanic gets built once; what ships is a number.
**(a)** stamina + torch-burn only — fully non-lethal. **(b)** + the `1/150` drain.
Recommendation: **build it, ship (a), land (b) behind `CAVE_FOUL_HEALTH_DRAIN = 0`** so flipping it
lethal is a single-number decision you make *after* feeling it in a walk-test.

---

## H3 — FALSE FLOORS OVER DROPS · **ZACH-GATED — and my recommendation is DEFER**

I am going to argue against this one, plainly, because it is the only item on the charter's list
whose honest build cost is *"a new global survival mechanic plus a non-tree edge in the graph our
entire traversal proof rests on."*

**Three real problems, not tuning questions:**
1. **The game has no fall-damage system.** Nothing anywhere in `src/` computes landing impact.
   Adding one immediately applies to dune slip-faces, the sled, the ribcage climb, the leviathan
   interior, Skyfall's cargo hold, and every wreck — an enormous blast radius, shipped as a side
   effect of a cave cycle. That is precisely the "shipped a hazard he never saw" failure.
2. **The room graph is a strict TREE by charter decision** (no maze loops). A drop is a non-tree
   edge: it can deposit you in a chamber with no walkable route out, 40m down, under a generator
   whose corridors are capped at 26°. `cave-walk`'s Euler-tour proof assumes the tree. This is an
   architectural conflict.
3. It is the one hazard where a careful player can do everything right and still fall.

**If you want it anyway, the only shape I would build:** a **shortcut, not a trap.** It drops you
3-5m into the chamber directly below on the *same trunk* — a room the tree already connects — so it
costs a scare, a bruise, and a re-climb and can never strand you. Flat clamped **0.10** damage (not
velocity-derived, no fall-damage system). The crust gives on the **second** step, with an audible
crack on the first, so a careful player who stops gets out.

**Telegraph** (it would be good, which is the temptation): a visibly different floor — the existing
`caveFloorSediment` signal driven to a pale, cracked, un-rubbled crust with a raised rim (that
signal is already shared by the pool placer and the floor tint, so placement and visual read cannot
drift); a **hollow footstep**, one new function in `audio.ts` beside `playFootstepRock` — drum-like
with a resonant tail, so you *hear* the floor change under your boots; and in torch light the cracks
show **the dark under them** — the light visibly falls into it.

**Verdict: defer out of this campaign.** The other three hazards deliver the charter's brief.

---

## H4 — DEEP COLD · **CONSERVATIVE** (and nearly free)

**What + where.** The deep cave is cold, and the deeper you go the faster it takes you. It plugs
into a system that already exists, is already tuned, already has a vignette
(`COLD_VIGNETTE_THRESHOLD` 0.3), already has a death-cause string ("the cold took you"), and already
has a proven counter (fire/shelter). **No new damage path, no new UI, no new death cause.**

Driven by *true depth below the surface sheet* — the value `updateCaveAtmosphere` already computes —
not by the darkness smoothstep, which saturates at 7m while cold should keep growing to 50m.
Scaled by kind: **flooded ×1.5 (wet + cold — the synergy the brief asks for)**, **shaft ×1.2
(deepest)**, canonical/warren baseline, **fungal reduced** (see Q3).

**Telegraph:**
1. **The shipped cold vignette** — blue tint, already legible, already reviewed by you. Zero new UI.
2. **VISIBLE BREATH IN TORCHLIGHT** — the hero visual, and small: a short pale fog puff at the
   camera on a slow cadence, additively lit, so **you only see it where your carried light reaches**.
   In pitch dark you don't see your own breath; carry a torch and the cave tells you it's cold.
3. **Wading** — an audible gasp and a sharp step down in temperature at the exact moment the wet
   multiplier applies. The wet footstep already fires there (`nearWaterSource`, `controller.ts:344`).

**Light-economy hook — the cleanest one in the spec (Q5):** **a lit torch or lantern warms you.**
A small positive temperature term (recommend ×0.2 of `COLD_SHELTER_RECOVER`) that *partially*
offsets the deep-cold drain without cancelling it. The flashlight does not. A **placed fire**
counters it fully (fires already register shelter zones), which gives the deep cave a real
"make camp down here" beat and a reason to carry fuel — feeding cycles 10 and 11 directly.
**One term in `updateStats`, and the light budget and the thermal budget become the same budget.**

**Consequence + survivability.** The shipped model, unchanged: temperature drifts toward -1; damage
only at ≤ -1, at `COLD_DAMAGE_PER_SEC`. Recommended max-depth drain = **1/420 — exactly the desert
night rate**, ×1.5 wading in a flooded cave. Worst case in the coldest place in the game: ~4.7 min
to freeze, then 2.5 min to die = **~7 minutes of total inattention**, in a place you can walk out of
in 60-90 seconds. That is a ~6× margin for a careful player.

**One honest flag:** this is the only hazard that can kill a *careful* player who arrived
underground already at -0.6 from a night trek. That is the shipped survival model doing its job
rather than a new cliff — but it is a real interaction and it is Q6.

---

## Kind synergies — and the design offer

| kind | share | rockfall | foul air | deep cold | false floor (if ever) |
|---|---|---|---|---|---|
| **canonical** | 24% | 0 | 0 | baseline | 0 |
| **warren** | 19% | 0-1 | **1** (deep dug pockets) | baseline | 0-1 |
| **fungal** | 19% | 0 | **0 — SANCTUARY** | **reduced** | 0 |
| **flooded** | 19% | 0 | 0 (water fills the low points) | **×1.5 wet** | 0 |
| **shaft** | 19% | **2-3** | 0-1 (deepest) | ×1.2 | its natural home |

**The offer (Q3): make the fungal cavern the SAFE kind.** Nothing in it hurts you, it has the most
light in it (the glow ladder), and it is warm. The world's cave kinds then carry a **legible risk
gradient a player learns without a single word of UI**: teal glow = you can rest here. That is Long
Dark's entire vocabulary — *this building is safe, that one isn't* — and it gives cycle 11's
"camp underground" beat a home. Strong recommend.

**And (Q4): canonical stays hazard-free.** 24% of caves, including the origin/egg cave — so **the
first cave any player ever enters is safe**, which is the correct tutorial shape: you learn the dark
before you learn the danger. It is also *free*: canonical hazard density 0 is what keeps the origin
parity digests (`108af91c` / `ff8309a8`) byte-identical **by construction**, exactly as rubble and
scrap did in cycle 9.

---

## NOT DOING — explicit

- **No creature.** Decided at kickoff, non-negotiable, not relitigated here.
- **No swimming, no drowning, no deep water.** `CAVE_POOL_DEPTH_M` stays a non-kind constant at 26cm.
- **No random instadeath.** Nothing here kills faster than `COLD_DAMAGE_PER_SEC` (2.5 min from full),
  and rockfall is hard-clamped so it *cannot* kill at all.
- **No hazard that extinguishes your only light source.**
- **No hazard in a corridor.** The graph is a tree; a corridor is the only route.
- **No hazard that gates progress.** Foul air is leaf-only. Rockfall's heaps must still leave the
  full Euler tour walkable, and the gate proves it.
- **No lingering debuff or status timer that follows you out of the cave.**
- **No fall damage as a global system in this campaign.**
- **No hazard in the entrance hall or on the crevice descent** — the first 12m stay clean so the
  entrance keeps reading as an entrance.
- **No new save schema, no SAVE_VERSION bump, no migration.**
- **No horror framing** (GDD §11). A crack and a thud; a flame going wrong. Melancholy, not fright.

---

## Build order

**Batch A — CONSERVATIVE, buildable unattended under the standing directive:**
1. **Deep cold** — plugs into the shipped survival model, no new damage path, the biggest
   feel-per-line in the spec. Includes the torch-warmth term and visible breath.
2. **Rockfall** — the geometry capability already exists; telegraph is static + live dust; damage
   clamped so it can never kill. This is the one that wants the rule-8 5-8 round visual loop.
3. **Foul air, non-lethal tier** — stamina + torch-burn tax; `CAVE_FOUL_HEALTH_DRAIN = 0`.

**Batch B — ZACH-GATED, not built until you sign:**
4. Foul air's health drain flipped on (one number).
5. False floors — if at all. Recommendation: defer.

*Why this order:* cold is nearly free and validates the "does a hazard read at torch range?"
instrument; rockfall is the visual one and needs that instrument trustworthy; foul air's telegraph
depends most on the real light model, so it goes last.

---

## Determinism + save

- **Placement is seed-pure** per site descriptor, drawn on the cave's own RNG stream *after* all
  existing draws inside a fixed budget — so adding hazards moves **no existing geometry**, and the
  cycle-8 placement digests and cycle-9 kind assignment are unchanged. (Exactly how `caveKinds`
  landed without moving a site by a millimetre.)
- **Canonical hazard density is 0 across the board** → the origin-parity digests hold *by
  construction*, and the origin gate stays the alarm it is.
- **Deep cold and foul air are stateless** — pure functions of position, depth and kind. They
  persist correctly with no save support at all.
- **Triggered state** (a rockfall that has fired) is **save-transient** — hazards re-arm on reload.
  Zero schema change, zero `SAVE_VERSION` bump, zero migration. This matches D299 streamed-content
  behaviour and cycle 8's already-flagged harvested-fungi transience; a cave is regenerated wholesale
  on stream-in anyway. Honest cost: reload → the heap you dropped is gone, the ceiling is unstable
  again.
- **If persistence is ever wanted**, the additive path exists and is proven: the `chunkDiffs` sparse
  per-descriptor branch (SAVE_VERSION 17's mechanism, the same one `pickups.taken` rides). Additive
  only, no version bump. **Not built now** (Q8).

---

## The gate — `cave-hazard`

Per the EFFICIENCY WATCH directive, the cost is stated up front: this **rides inside the existing
`cave-kinds` leg**, not as a 25th parallel leg — it needs the same boot and the same seeds.
Estimated **+3-5 min inside the current tiered ~32-min wall**, not a new serial leg.

Asserted per kind × 3 seeds minimum (6 preferred, per the charter's seed-net rule):

1. **Placement legality** — chamber-only · mouth-clearance respected · egg dais excluded · entrance
   hall excluded · pool rim excluded · **foul air leaf-only** (degree 1 in the room graph).
2. **Escapability, measured with the real KCC** — *not arithmetic*, because an arithmetic check
   passes on a disk sitting against a wall. Rockfall: walk out of the disk inside the arm window.
   Foul air: walk from the farthest floor point to above the gas line inside budget, **with the
   stamina penalty active** so the probe measures the crippled speed, not the healthy one.
3. **Survivability envelope** — a scripted worst-case traverse (eat every rockfall, transit every
   foul pocket at walk pace, at max deep-cold) must end at **health ≥ 0.5**; and the never-below-0.15
   clamp proven by driving 20 synthetic hits.
4. **Post-trigger traversability** — the full `cave-walk` Euler tour re-run **after firing every
   hazard in the cave**: 0 strands, every chamber reached, `ascent=OUT`. (Charter: "`cave-walk`
   unaffected or explicitly re-baselined.")
5. **Anti-vacuous guards** — this project's driving lesson is that *a gate measuring the wrong thing
   is worse than no gate*:
   - `hazards > 0` per hazard-bearing kind or **FAIL** ("green because nothing spawned" is the exact
     failure mode cycles 5 and 8 both hit).
   - **Red-proofs, demonstrated before the fix ships green** (the void-gate discipline): set the
     escape window to 0.1s → escapability must go RED; disable the clamp and drive 20 hits →
     survivability must go RED.
   - The torch-burn multiplier proven by measuring the actual `burnRemaining` delta across a foul
     transit — never by reading the constant back.
6. **Determinism** — hazard-set digest stable ×2 per seed, distinct across seeds, **origin cave
   digest unmoved**.

---

## Appendix — the shaft SKYLIGHT (a design option, not part of the hazard build)

Cycle 9's critic noted two things about the collapsed shaft: its verticality is real geometry
receiving **zero light**, and **the moon currently punches through exactly where a real aperture
would sit.**

**The machinery already exists and is gate-proven.** Cycle 8 built the dynamic hole registry with
the invariant *a hole exists in the terrain sheet IFF the cave beneath it is a live resident*, and
band-decomposed heightfields made opening/closing a hole **80× cheaper** (0.3ms vs 24.4ms), with
teardown measured exact (`restoreMax 0.0000m`). A **second** hole — a small collapse aperture at the
top of a shaft cave's chimney — is architecturally cheap and rides proven code. The origin cave's
static D307 hole is on a different path and is untouched.

**Why it does not violate "no free light":**
- It is **local and diegetic** — one collapse hole above one chamber of one kind. It lights the top
  10-15m of the chimney and dies long before the deep tree (the mouth shaft already demonstrates
  that falloff at `CAVE_SHAFT_DIST` 34m).
- It is **on the sun's clock** — bright at noon, a pale grey column at dawn, a moon-shaft at night,
  gone in a storm. It doesn't remove the light budget; it gives the shaft kind a **time-of-day
  dimension nothing else underground has**, and makes descending past it read as *leaving the last
  daylight behind*. That is a stronger expression of "the light runs out" than darkness alone.
- It is **the rockfall fantasy's own justification** — the ceiling collapsed here; that's why
  there's a hole, that's why there's a talus, that's why more of it might come down. Skylight,
  rubble, and rockfall are one idea.
- On the surface it becomes a **second cave silhouette** — a dark aperture in rock, distinct from
  the crevice tor, and a findability feature in its own right.

**Honest costs:** a second hole per shaft cave (registry churn — cheap, but must be *measured*, not
assumed); the aperture needs its own rule-8 visual loop (a hole in a heightfield is not
automatically a collapse); it needs a spacing/tile-seam rejection against the crevice's own hole
(the `CAVE_SITE_*` rejection ladder already does this class of thing); and it slightly reduces the
shaft kind's darkness, which is the campaign's whole product — so its light must be tightly capped.

**Recommendation: yes, but as its own scoped unit after hazards, not folded in.** It shares an idea
with rockfall but not a line of code, and folding it in would make the hazard cycle a two-headed
thing neither gate covers well.

---

## Questions — Q1..Q10, each with a recommended default

| # | Question | **Recommended default** |
|---|---|---|
| **Q1** | **Foul air lethality:** (a) non-lethal — stamina + torch-burn only, or (b) + the 1/150 health drain after a 12s grace? | **Build the mechanic; ship (a); land (b) behind `CAVE_FOUL_HEALTH_DRAIN = 0`** so you can flip it lethal with one number after a walk-test. |
| **Q2** | **False floors:** build, defer, or kill? | **DEFER out of this campaign.** No fall-damage system exists (adding one touches dunes/sled/every wreck), and a drop is a non-tree edge in a graph whose whole traversal proof assumes a tree. If you want it: the 3-5m "shortcut drop" shape only, flat 0.10 damage. |
| **Q3** | **Is the fungal cavern the SAFE kind** — zero hazards, reduced cold, the place you can rest? | **YES.** A legible risk gradient with no UI, and a home for cycle 11's camp-underground beat. |
| **Q4** | **Does canonical (24%, incl. the origin/egg cave) stay hazard-free?** | **YES.** The first cave anyone enters teaches the dark, not the danger — and canonical-density-0 keeps origin parity byte-identical by construction. |
| **Q5** | **Does a lit torch/lantern warm you** (small positive temp term, partial offset to deep cold)? | **YES.** One term in `updateStats`; makes the light budget and the thermal budget the same budget — the cleanest light-economy hook in the spec. |
| **Q6** | **Deep-cold severity at max depth.** | **Exactly the desert-night rate, 1/420 (~7 min to freeze), ×1.5 wading in a flooded cave.** Alternatives: gentler 1/600, harsher 1/300. |
| **Q7** | **Rockfall damage per hit** — 0.12, hard-clamped so it can never take you below 0.15? | **Accept.** Precedents: raider hit 0.15, worm bite 0.50, bad meat 0.05-0.08. |
| **Q8** | **Triggered-hazard state: save-transient** (reload re-arms ceilings; the heap you dropped is gone), or additive `chunkDiffs` persistence? | **Transient.** No schema change, no version bump, matches D299 streamed-content behaviour. |
| **Q9** | **The shaft skylight** — yes/no, and if yes: its own unit or folded into hazards? | **YES, its own unit, after hazards.** |
| **Q10** | **The split:** Batch A (cold → rockfall → foul-air non-lethal) built unattended, then **PAUSE**; Batch B (foul-air lethality, false floors) waits for your sign-off. | **Confirm this split.** Nothing that can end a run gets built before you answer Q1 and Q2. |

*Unanswered = every recommended default above is taken, which by construction means **nothing that
can end a run gets built.***
