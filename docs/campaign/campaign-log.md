# Campaign log — Dustfall · "DEEPER" (started 2026-07-24)

Newest cycle at top. Prior campaigns archived alongside
(`campaign-log-underworld-DONE.md`, `campaign-log-sharpen-deepen-DONE.md`, …).

Charter: [campaign-deeper.md](campaign-deeper.md) · Walk-test source of truth:
[cave-walktest-2026-07-24.md](cave-walktest-2026-07-24.md) · Steering: [steering.md](steering.md)

## Cycle 12 — THE SKELETON & THE JOURNAL (2026-07-29, overnight) — SHIPPED

**Zach's brief, verbatim:** *"there should be a journal and a skeleton in one of the caves with some
loot."* Built with **every one of the plan's Q1-Q10 defaults taken** (he was asleep), which by
construction means no economy number moved, no save version moved, no origin digest moved and no
gate leg was added. Commits `c5c06d3` (systems) · `9cd9efa` (visual) · `c4aa5d6` (gates), plus
`10a36da` (a live gate defect found in passing) and `3722e31` (the flake).

### What it is

Every `warren` cave now carries a dead salvager: slumped against a chamber wall off the walk line,
right arm out where the book slipped from it, a **spent lantern** (the same lantern the player
deploys — cycle 11's cave tool, unmistakable) on its side past the hand, a fallen canteen at the hip,
and their **rifled crate** beside them. The journal is the reward for having read the scene, not the
delivery mechanism for it. Its five entries each teach one true thing about caves without ever
addressing the player: the cold that never kills (cycle 11), the water that never runs out (cycle 6),
and the light budget as the real clock (cycle 11). **The journal is the manual for the systems cycles
6 and 11 built, written as a dead man's diary.**

### The three things worth remembering

**1 — THE PREDICATE LIVES IN ONE PLACE, AND THE GATE READS IT.** `deadExplorer` is a kind-table
field; `caveKindCarriesBeat()` is the only reader; the gate asks the game's own table through
`caveKindTable()`. A gate that hardcodes `kind === 'warren'` asserts its own opinion and stays green
through the exact change it exists to catch. A table assert holds `canonical` false — that, not a
comment, is what makes "the origin-parity digests cannot move" a machine fact. **Proven: `cave-digest`
seed 1337 = `d8f15005`, unchanged.**

**2 — THE TABLEAU LEVITATED, AND THE INSTRUMENT HAD TO BE FIXED BEFORE THE BUG COULD BE.** Measured:
journal 8.8cm, lantern 10.0cm, crate 5.5cm in the air, seat 0.4cm. The anchor is exact only AT THE
SEAT and a rigid 2.4m arrangement cannot follow displaced rock.

> ⚠ **The bedding probe could not see the fix by construction.** It measured `anchor-plane y − rock`
> — the floor's *gradient*, never a prop. After every prop was re-seated it reported **the same seven
> numbers to the millimetre**. A gate that cannot move when the defect is fixed cannot report the
> fix. Rewritten to measure each prop's real **lowest vertex** against the rock under its own
> footprint (origin-vs-rock was also wrong: a tipped lantern rests on its cage, a flask on its rim —
> both sit deliberately above their origins).

Fix: `caveGen` publishes a rock-height patch with the anchor, sampled by `rockFloor` at dress time —
a Rapier downcast at sink-attach is the wrong tool, because the QueryPipeline has not rebuilt on the
frame a cave finalizes. The rigid figure drops to the **lowest** rock under its footprint (bed the
high side in rather than float the low side); loose props rest by computed bounding box.
**Two hypotheses died on measurement and are recorded in-source so they are not retried:** a finer
sample grid changed *nothing to the millimetre* (`rockFloor` is itself a 0.45m grid — resampling it
adds no information), and footprint-centre sampling fixed the lantern but not the canteen. The true
residual is that `rockFloor` and a Rapier downcast disagree by ~5cm on displaced floor, so the solids
get a bed deeper than the disagreement and the thin journal keeps a shallow one.
**Result: nothing floats. Worst daylight 0.8cm, was 10.0cm.**

**3 — A RED-PROOF FAILED TO GO RED, AND THAT IS THE MOST USEFUL RESULT OF THE CYCLE.** The plan
specified: seat the anchor on the analytic plane (the historical bug) → the 5cm floor tooth blows.
It **measured 4.2cm on this seed — inside the bar.** So that tooth would pass a build with the old
bug in it. Rather than tighten it (3.9cm is the *correct* path's reading, so tightening reds the
truth), a second tooth was added that IS red-provable: per-prop bedding, which fires on three props
at 6.2-6.8cm when the pre-fix seating is restored. **The defect this cycle actually fixed now has a
machine gate — the one thing this project has proven makes a failure stop recurring.**

### The gate of record — GREEN END TO END

`npm run verify:all`: **24/24 legs PASS, zero `*** FAIL ***` anywhere**, 55m35s wall
(`verification/gate-logs/20260729T071501Z-*`). Both new sub-rows green at every seed
(`beat-sites` ×2, `beat-build`). Origin parity held: `cave-density` re-entry bit-identical at both
seeds, `cave-kinds` 4 kinds built + marched + void-swept + light-tested, 0 strands, 0 void escapes.

**This is also the first full-suite run since cycle 10 in which `cave-kinds` was CAPABLE of reporting
a pass** — see the regex fix below. Two cycles of "green" for that leg were read off raw logs while
the row underneath said FAIL.

And the warren marched **12/12, ascent=OUT, digest `9219905d`** inside it — a sixth sample on
identical rock, making the flake tally **5 passes to 1 failure**.

### The gates

| | rides | teeth | verdict |
|---|---|---|---|
| **BEAT-SITES** | `cave-density` ×2 seeds, ~0 cost, no cave built | seed purity over two derivations · vacuous guards · **origin parity proven purely** · measured findability | GREEN — 113 sites, 18 beat, 5 kinds, **nearest 1.3km**, 0.125/km² |
| **BEAT-BUILD** | `cave-kinds` (the only leg that builds a warren) | exists · **collider identity** · **nothing floats** · readable via real WASD+`[E]` · grants once at v18 | GREEN — anchorGap 0.039m, hover `read` @2.16m after a 3.15→1.35m walk, panel opened, `beatRecord {looted, 0 left}` |

Red-proofs: dropping the `journals.list` push → RED (*"placeJournal does not self-register"*);
skipping the `caveBeats` write → RED (*"would refill on re-entry"*); the analytic-plane seat → **did
not go red** (above); pre-fix seating → RED on the bedding tooth. Clearing the beat flag fired three
BEAT-SITES teeth **with the site digest unchanged at `4a988b6d`**, proving the flag moves no
placement; flipping it onto `canonical` is caught even earlier by the kind-table assert, which halts
boot by name.

*The first red-proof also exposed a defect in the gate itself: a throw REPLACED the findings already
collected instead of appending them, so the run that tripped lost the finding that explained it.*

### Two deliberate departures from the plan — ⚑ both are Zach's to overrule

1. **Q6 said a `looted` boolean; shipped remaining CONTENTS.** A boolean only closes the exploit for
   a player who empties the crate in one visit — take just the `battery`, walk out, and the whole
   cache refills. Recorded at BOTH boundaries (save *and* eviction), because the ordinary way to loot
   it is to empty it and save while still standing in the cave, which the eviction path never sees.
2. **The plan's `0.72·rx` seat is exactly the ring of the march gate's own floor grid** — that is the
   walk line, not the wall. Moved to `0.80` (fallback only; the real seat is the measured wall).

### The visual half — 5 rounds, and round 0 found more than it was sent for

`makeSkeleton(opts)` gains a `closeRead` path for the 1-2m torch read. **The no-argument signature is
the only deleted line in the file**, so the opening scene and the wordless surface scenes are provably
untouched (Q7's default). The baseline shot found three defects nobody had named: limb joints **did
not meet** (forearms placed by hand-tuned offsets ~0.22m off the computed elbow), **both legs were
authored below y=0** (a −Y bone swung backwards by `rotation.x` — the shipped wreck skeleton has no
visible legs), and the four rib half-tori lay in the **sagittal** plane, so the ribcage read as a coil
spring. Rebuilt on real joint chains: capped `sweptTube` bones with a tip-radius floor (the
`SPELEO_TIP_FLOOR` contract restated), a vertex-displaced cranium with **solid frustum orbits**, one
fractured rib with a splintered cross-section. Merges to 2 draw calls. The socket fix is proven by
the pair `skull` / `skullturn`: at ~70° off-axis the orbit is still a shaded recess with a rim, where
a `CircleGeometry` disc would have vanished.

Also fixed on inspection: the beat crate was a **saturated orange cube that out-shouted the body** —
now a muted, lid-off variant, opt-in so every other crate in the world is byte-identical; and the
spent lantern was yawed off the view line because broadside it read as a rifle.

### ⚑ Residuals, honestly (Zach's call, none are blocking)

- **The cache contents are one flagged array** (`CAVE_BEAT_CACHE` in `tuning.ts`) — hand-authored,
  no `lootRegistry` entry, drop rate or recipe touched, so **`verify:loot`'s digest provably cannot
  move** (and it was re-run: PASS). Edit that array and nothing else shifts. Q4 is still yours.
- Bone renders warm-cream under a torch inside 1m — the lever is `TORCH_LIGHT_*`, not the albedo;
  going darker costs the 4m arrival read.
- The journal reads as a small pale card at 1.5m rather than as a bound book.
- The cranium's parietal is still smooth in profile at the 1m macro framing (not a gameplay distance).
- ~~`openingScene`'s skeleton still has the zero-thickness `CircleGeometry` eye sockets.~~
  **CLOSED 2026-07-29 — Zach overruled Q7 and asked for it.** See below.

### Follow-up (same day) — the surface skeleton's eye sockets, on Zach's call

Q7's default had left the shipped skeleton alone. He overruled it, so the rule-7 violation in the
game's **first impression** is fixed: each `CircleGeometry` disc is now a near-black solid **frustum**
sunk into the cranium, wide mouth at the surface narrowing 3cm inward.

**A new permanent probe, because this defect is invisible to the shot you would naturally take.** A
disc reads as a perfect socket face-on — it only dies off-axis, so a framed portrait is exactly the
picture that cannot see it. `skeleton-sockets` shoots the REAL opening-wreck skull from three
bearings: square on, 70°, and an 88° graze.
`scen-sockets-turn70-before.png` is the defect in one frame — **both sockets simply gone, the skull a
smooth ball**. After: the orbit holds as a dark recess with a rim at 70° *and* at 88°.

Two rounds, and round 1 failed on tone rather than on rule 7: at 0.030 radius, set high and wide and
standing 6mm proud, they read as **alien goggles** — two dark ovals over a third of the face. That is
the identical failure the close-read cave skull hit at *its* round 2, so it is now recorded in-source
beside the numbers, so a third skull does not have to learn it. r2: smaller, lower, closer together,
barely proud, and the taper does the work.

Parented to the **skull** rather than to `spineBase` — the skull carries its own rotation and a
non-uniform scale, and the old sockets were placed by hand-derived numbers in the parent's frame,
which is why they sat ~2cm *inside* the surface and were nearly invisible even face-on. As children,
direction × radius puts them on the sphere by construction.

Gates: `verify:intro` PASS (12 beats) · `verify:chunks --legs=determinism` PASS at both seeds, so the
vignette digests did not move · tsc clean.

## ⚠ CORRECTION (2026-07-28, on resume) — the "regression" below was MISCALLED. It is a FLAKE.

### The warren flake: sampled, and a method defect found in my own sampling

The correction below said "sampling to n≥5 before any fix is designed." Ran it first thing:
`cave-kinds --kinds=warren --void=0`, five times, sequentially, on a quiet machine.

| run | verdict | digest | reached | ascent |
|---|---|---|---|---|
| 1 | PASS | `9219905d` | 12/12 | OUT |
| 2 | PASS | `9219905d` | 12/12 | OUT |
| 3 | PASS | `9219905d` | 12/12 | OUT |
| 4 | **VOID — my fault, see below** | — | — | — |
| 5 | not run (aborted with 4) | — | — | — |

Three clean passes, byte-identical geometry, ~3m37s each. With the resume repro that is **4 passes
to 1 failure on the cycle-11 tree**, all on the same digest. The flake reading holds and hardens;
the regression call stays dead.

**⚠ THE METHOD DEFECT, recorded because it invalidates a whole class of measurement: THE RIG SERVES
THE LIVE WORKING TREE.** I spent the sampling window writing cycle-12 source, on the theory that
editing is zero-CPU and therefore cannot perturb a dt-coupled march. It is not about CPU. Vite serves
the working tree, so run 4 booted a half-written `main.ts` — it used `buildDeadExplorer` two edits
before I added its import — and died with `[page error] buildDeadExplorer is not defined`. That is
not a flake, a regression, or a timing artefact; it is a probe measuring code that never existed as a
commit. **Rule: never edit source with a probe in flight. Run → wait → edit → run.**

**Does that mechanism explain the ORIGINAL 8/12 failure? No — checked, and the answer is honest.**
The failing gate ran 19:52–20:32 local. Two commits landed inside that window (`79905bf`, `6b7f6d7`)
and **both are docs-only**, so no source changed under the probe. What the timestamps *do* falsify is
the pause note's claim that the run was **"SOLO on a quiet machine (so dt-coupling does not explain
it)"** — the machine was concurrently running an agent that read files and wrote two commits. That
was the load-free premise the regression call rested on, and it was not true. D311's dt-coupling
remains the live hypothesis, now without the evidence that was supposed to exclude it.

**Not designing a fix on this.** Four passes to one failure is a flake rate too low to characterise
from five samples, the failure mode is a walker wedging while hunting a corridor mouth (a pathing
outcome, not an obstruction), and the fix belongs in the march leg recipe rather than the game.
Cycle 13 owns it; cycle 12's own gate run adds samples for free.

### Shipped so far — the systems half (`c5c06d3`), tsc clean

The beat is composition, placement and lifecycle over parts that all shipped months ago. Detail is
in the commit; the load-bearing decisions:

- **The predicate lives in the kind table** (`deadExplorer`, warren true) with `caveKindCarriesBeat()`
  as the single reader, so the gate cannot assert its own opinion of where the beat is. A table
  assert holds `canonical` false — which is what makes "the origin digests cannot move" a machine
  fact rather than a promise.
- **`caveGen` publishes an ANCHOR, never a mesh.** `caveDigest` hashes `meshes.concat(decor)`, so any
  mesh added there moves it even at local origin; anchors are published after the hash and spawned
  from a resident sink. **PROVEN, not argued: `cave-digest` seed 1337 = `d8f15005`, unchanged.**
- Seated against the **measured** wall (`wallCast` + `rockFloor`), never the analytic plane — the
  close-out lesson that "a salvage plate seated on the plane hung a metre over the sand."
- **Two deliberate deviations from the plan, both strengthenings, both flagged for Zach:**
  1. Plan Q6 specified a `looted` boolean. Shipped **remaining contents** instead. A boolean only
     closes the exploit for a player who empties the crate in one visit: take just the `battery`,
     walk out, and the whole cache refills — the exact farm the persistence exists to prevent.
     Recorded at BOTH boundaries (save *and* eviction), because the ordinary way to loot it is to
     empty it and save while still standing in the cave, which the eviction path never sees.
  2. The plan's `0.72·rx` seat is **exactly the ring of the march gate's own floor grid** (both
     `addRubble` and `addSpeleothems` explicitly keep clear of it). Harmless for collision — the beat
     has none — but it is the walk line, not the wall. Fallback moved to `0.80`.
- Closed the owed source fix: `caveKinds.ts` named the pre-lattice-snap origin digests in **two**
  places, not the one the pause note recorded.

**Zach's Q1-Q10 were unanswered at build time, so every recommended default was taken** — which by
construction means no economy number moved, no save version moved, no origin digest moved, and no
gate leg was added. The cache contents are a single flagged array in `tuning.ts`
(`CAVE_BEAT_CACHE`): hand-authored, no `lootRegistry` entry or drop rate or recipe touched, so
`verify:loot`'s 1000-roll digest provably cannot move. Edit that one array and nothing else moves.

## ⚠ CORRECTION (2026-07-28, on resume) — the "regression" below was MISCALLED. It is a FLAKE.

**I got this wrong and the record must say so.** The pause entry below calls the warren march
failure a confirmed regression. On resume the first two measurements overturned it:

1. **The geometry is byte-identical.** Warren's mesh digest is `9219905d` in **six** consecutive
   `cave-kinds` runs — five marched 12/12 and the failing one marched 8/12 **on the same digest**.
   Cycle 11's only change to `caveGen.ts` was an additive read-back function; it moved no vertex.
   The rubble/placement-sampler hypothesis in the pause note is **dead**.
2. **The repro passed**: `pass=1 … digest=9219905d … reached=12/12 ascent=OUT strands=0 fails=0`.

So on the cycle-11 tree the warren march is 1 fail / 1 pass on identical rock. **That is a flake,
and my pause note asserted a regression off n=1** — the exact error this campaign wrote the n≥5
rule for (D311 / the 4242 lesson), committed in the opposite direction. Twelve prior passes made
one failure *feel* conclusive; feeling is not the bar.

Supporting facts gathered while narrowing it: stamina no longer gates movement
(`controller.ts:227`), so the new cave-cold branch cannot be slowing the capsule; and the stall
sits at the chamber-3 **wall** with the capsule moving 3.2m where legs normally move ~16m — a
walker wedging while hunting the corridor mouth, i.e. a **pathing** outcome, not an obstruction.
The live hypothesis is D311's own class: marches are dt-coupled, cycle 11 added real per-frame
work (the cold branch, plus a duplicated `caveContainmentAt` its own report flagged), and on
marginal geometry a small timing shift changes the walker's path. If so this is a **pre-existing
gate fragility any frame-cost change would expose**, and the fix belongs in the march leg recipe,
not in the game.

**Sampling to n≥5 before any fix is designed.** Everything below this heading stands as the
contemporaneous record, wrong call included.

## PAUSED (2026-07-28 late) — Zach: "need to pause now" — ⚠ A REGRESSION IS OPEN (MISCALLED — see above)

**Read this before anything else on resume.** The owed cycle-11 gate legs ran to a verdict:

- **`cave-streamed` 1337 + 7: PASS** — that leg is now fully green (marchOk 1/1, ascent OUT,
  0 strands, 0 escapes on both seeds). It is no longer owed.
- **`cave-kinds`: FAIL — warren only.** `could not reach node 7 (pocket) from 3 … ended
  (1239.9,−268.5,y−7.9); fwdClear@[.3/1/1.7]=[1.0 1.1 0.8]`, reached **8/12**, cascading to
  chambers 6/7/9/11 never reached. **fungal, flooded and shaft all pass with 0 fails and
  ascent=OUT.**

**It is a regression, not a flake — established before the pause, not assumed.** Warren marched
**12/12 in twelve consecutive `cave-kinds` runs** across 07-27 and 07-28, *including cycle 10's
own gate at 18:13*, and **8/12 on the first run against the cycle-11 tree**. It ran **solo in the
quiet phase**, so the dt-coupling explanation (D311) does not apply.

**Prime suspect, explicitly UNPROVEN:** cycle 11's placement-sampler change (`d645f88`). Warren is
the only kind carrying `rubblePerChamber > 0` *and* `salvagePlates` *and* `scrapPerCave`; rubble
and plates are **collider-bearing** (they enter `meshes` and are baked into the cave trimesh), and
cycle 11 moved their seating from the analytic plane to the **real cave floor** — which can
narrow a corridor. That is a hypothesis with a mechanism, not a diagnosis.

**First action on resume, in order:** (1) reproduce cheaply — `npm run rig -- --scenario=cave-kinds
--kinds=warren --void=0 --port=52xx`; (2) **A/B it** by zeroing warren's rubble/plate placement to
confirm attribution; (3) only then build a fix, **by construction** (clearance-aware seating),
never by relaxing the gate. Do **not** dispatch a multi-hour fix agent on the unproven hypothesis
— that is exactly the 4242 lesson.

**Everything else is green:** the other 22 legs passed in the earlier run
(`20260728T231336Z-*`), `tsc`/`loot`/`placement`/`colliders` are green, and cycle 11's own
**LANTERN-RT** and **CAVE-COLD** sub-gates pass on both seeds.

**Also landed this session, all committed:** cycle-13's recon plan (`79905bf` — tor slicing is a
GO but **digest-first**, because the tor is in no digest today and a slicing bug would ship green;
plus the docs drift and framework-backflow audit) and **D308–D314** (`6b7f6d7`), the first
D-entries this campaign has written in twelve cycles — including D313, which records a *negative*
result: the lattice snap shipped believing it fixed the entrance marches and was later A/B-proven
not to have. One-line source fix owed: `caveKinds.ts:19` still names the pre-lattice-snap origin
digests as "a hard campaign gate."

## PAUSED (2026-07-28 evening) — Zach: "pause cleanly now and pick back up from here later"

**Where things stand.** Cycles 10 and 11 shipped and are committed; cycle 12's plan is written and
verified. Tree clean at the pause commit; loop stopped, agents stopped, machine quiet.

**Gate state, precisely** (this is the one thing to read on resume): the cycle-11 gate of record
was stopped mid-run with **22 of 24 legs GREEN**, salvaged per-leg from
`verification/gate-logs/20260728T231336Z-*.txt`. That includes `pool-fill` ×2 — which carries
cycle 11's own new sub-gates **LANTERN-RT** and **CAVE-COLD** — and `cave-walk-7a`, i.e. the
dt-coupling reclassification is holding. `verify` / `verify:loot` / `verify:placement` /
`verify:colliders` all green separately. **OWED: `node scripts/verify-chunks.mjs
--legs=cave-kinds,cave-streamed` (~30 min).** `cave-kinds` never started; `cave-streamed-7` was
mid-flight. Neither is known-bad — they are simply unrun.

**Then cycle 12** ([cycle-12-plan.md](cycle-12-plan.md), committed): build the dead-explorer beat.
**Two items are Zach's call**, held as flagged one-liners rather than baked: **Q4** the loot-cache
contents (proposed: `lantern_kit` + 2 `metal_pipe` + 2 `wiring` + 1 `battery` + 3-4 `scrap` —
hand-authored, `lootRegistry` untouched so `verify:loot` cannot move) and **Q9** the drafted
5-entry journal text (plan §6).

**Also pending from him:** more tuning feedback he hasn't given yet, and a **process reflection**
he asked for once the cave work lands. The agenda, from the evidence gathered this session:
the framework loop is one-directional (16 undrained post-mortems; `shared-memory/` untouched
since Jul 17, i.e. before this campaign); `rig-shot.mjs` is 19,651 lines against 94k of `src/`;
the fixed cost per change no longer scales with the size of the change; and this chat is long
enough that a fresh file-booted session would be sharper and cheaper.

## Cycle 11 — lanterns underground + cave cold (2026-07-28) — SHIPPED

- **Planned:** Zach's asks — deployable lanterns using the existing item; colder caves that never
  damage. **What the recon found instead: both were LIVE BUGS**, and it found them by reading,
  inside cycle 10's gate window at zero wall-clock cost.

- **G1 — placeables could not be placed underground** (`d645f88`). Every placeable computed its Y
  from `terrain.heightAt`, the SURFACE sampler: a lantern, campfire, bedroll, tent or sled placed
  in a cave landed tens of metres up **inside solid rock**, and the ghost preview lied about it.
  New `src/world/placementGround.ts` casts down against LIVE colliders (5m drop, player excluded)
  and snaps to the analytic height within 0.25m, so open-desert placement stays byte-identical to
  what shipped. **Fixed at nine sites, not the six named** — grep showed largeTent/locker/stake
  carry the identical line, and fixing six of nine identical bugs would have been arbitrary.
  Proof: the lantern lands at y −22.71 with collider identity = **the cave body**; the old path
  gave y +7.89 — thirty metres up inside rock.

- **CAVE COLD — the shipped behaviour was BACKWARDS**, so this is a fix, not an addition:
  underground, exposure still ran off the surface clock, so shade-heat **warmed** you by day and
  `COLD_NIGHT_DRAIN` could reach −1 and **kill you at night**. INV-COLD: a cave branch
  pre-empting shelter/sun walks temperature toward `caveColdTarget(depth, kind, wet)` and never
  past it, **in both directions** — a freezing descender is warmed toward the target, which is
  the clause that makes "never damages" total rather than conditional. The clamp binds the
  TARGET, at the function's last line, after every multiplier; `depth ≤ 0` is exactly a no-op.
- **Measured deviation:** `CAVE_COLD_FLOOR` is **−0.48**, not the plan's −0.55 — the gate proved
  −0.55 makes the plan's own defaults jointly unsatisfiable (the worst stack lands outside
  `HEALTH_REGEN_TEMP_MAX`, silently stopping regen in the deepest wet cave, which its own Q6
  forbids).

- **Gates** (both ride `pool-fill`, no 25th leg): **LANTERN-RT** and **CAVE-COLD**, `pass=1` on
  both seeds — collider identity, lit-check, a 25m KCC walk plus a 400m far-field relocation (the
  range eviction actually runs at), real RMB retrieve, pool-slot release, save/reload with
  `SAVE_VERSION === 18` asserted, cap refusal, bounce 0.95→0 exact; 112 real-tick cold cells with
  `damageCells: 0`. **Red-proofs recorded — including one that corrected the plan:** −1.4 alone
  cannot reach the damage line (TARGET_MAX is −0.45), so the damage assertion was additionally
  proven with `TARGET_MAX = −1.2` → 4,500 damage ticks, player died. Both restored.

- **Three probe defects found and fixed en route**, one worth remembering: a NaN reaching
  `setTranslation` **poisons the Rapier wasm module**, after which every later call reports
  "recursive use of an object" — that error is always a *downstream* symptom.

- **Spend:** ~1.3M (campaign ~11.2M / 14M; cycle 11/20).
- **Commits:** `d645f88` (+ `3d5e177` cycle-12 recon).
- **Walk-test affordance:** a **"lantern trail"** dev button drops a real breadcrumb trail through
  the actual deploy path — the "can I find my way back?" read in one click instead of six crafts.

## Cycle 10 — light & darkness integrity (2026-07-28) — SHIPPED

- **Planned:** Zach's three walk-test asks (steering.md 2026-07-28) after he cancelled the hazards.

- **The root cause was ONE fact, and it explained both bugs** (`827182b`): `caveAtmosphere` was
  written when there was exactly one cave and only ever tested the ORIGIN cave's AABB — so in the
  cycle-8/9 streamed world **every other cave scored darkness 0 and inherited surface daylight
  wholesale**. That is why caves "got brighter during the day": they were never dark, they were
  surface-lit. `caveDarknessAt` now asks `caveStream.occupied()` (a pure live-AABB test, no
  cached state) with the origin AABB kept as a first test. Deep targets became ABSOLUTE levels
  instead of multipliers of surface light; the mouth/threshold zone still blends from live
  surface values, because that is a real opening.
- **The sky bodies:** the sun's depthTest line was already correct — its *signal* was origin-only.
  The moon's disc was already occluded; what Zach saw was the moon's DIRECTIONAL LIGHT flooding
  streamed interiors. Both now plural-cave correct; surface framings byte-identical.
- **Carried light up** (his ask, his dials to taste): torch 1.8/12m → 2.7/15m · flashlight
  3.0/25m → 4.5/31m · lantern 1.6/14m → 2.4/17.5m.

- **Two new permanent teeth in `cave-kinds`, both red-proven:** day-invariance (a deep framing at
  noon vs midnight must match) and sky occlusion (A/B against bodies-hidden). Final: `pass=1
  kinds=4 built=4 marched=4 voided=4 **lit=4** strands=0 escapes=0 fails=0` — every kind measured
  Δmean 0.000 / Δp95 0.000 and changedPx=0 for BOTH bodies.

- **A probe defect wedged the gate first, worth recording:** the new light-teeth helper froze the
  game for stable frames (the `caveKindShots` "FREEZE FIRST" pattern) and never unfroze — so
  CLAUDE.md rule 4's pause gate stopped physics, streaming, chunk loading and eviction for every
  kind after the first. **One flag produced all seven failures.** Instrumented and proven
  (`paused=true, elapsedΔ=0.00s` across 900 frames), not guessed; the rival hypothesis (stale
  `occupied()`) was falsified in the same pass.

- **Verify:** cave-kinds GREEN (above) · pool-fill ×2 + cave-preload ×2 · determinism ×2 + perf +
  cave-density ×2 (the legs the lighting/sky/shader-warm changes could touch) · origin digests
  d8f15005 / 99e0015b unmoved · tsc clean.

- **PROCESS — THE STALL RULE landed this cycle** (`6ed743b`), after Zach caught the same idle
  pattern twice: an agent's shell caps at 10 min, a gate leg runs 20-55, so agents detach the run
  and end their turn; the harness then reports the AGENT done while the gate runs untracked and
  the orchestrator waits on a notification that can never arrive. Now: agent briefs END at
  "report and stop"; the orchestrator runs every long gate under its own tracked shell; and no
  gate window is idle (cycle 11's recon ran in parallel with this cycle's gate, free).

- **Spend:** ~0.75M (campaign ~9.9M / 14M; cycle 10/20).
- **Commit:** `827182b` (+ `6ed743b` process).
- **Next (cycle 11):** deployable lanterns underground + cave cold. The recon
  ([cycle-11-plan.md](cycle-11-plan.md)) found the lantern is ALREADY a complete place/retrieve
  system — and found **two live player-facing bugs**: every placeable (lantern/fire/bedroll/
  tent/sled) samples the SURFACE height, so placing anything in a cave hurls it into solid rock;
  and cave temperature runs off the surface clock, making caves warm by day and **lethally cold
  at night today**. Cycle 11 fixes both.

## Cycle 9 — CAVE KINDS + the gate runner + the headroom fix (2026-07-27/28) — SHIPPED
## → CHECKPOINT: hazard-spec-review (the charter's checkpoint 2) — RESOLVED IN PERSON 2026-07-28

- **Planned:** four cave kinds as a parameter table over the one generator; grew (by finding) to
  include the gate runner, a 1-in-9 enterability defect, and three adversarial fix rounds.
- **Shipped, in order:** the kind table (warren/fungal/flooded/shaft, machine-asserted
  invariants, distribution proven ×3 seeds) `c8fab5a` · the lattice snap `c8fab5a` · **the gate
  runner** (suite 90→~32-55 min, `--legs=`, tee-to-file, dt-coupling discipline) `05bb7a1`+`b85ed24` ·
  **the entrance headroom defect closed by construction** (~1 cave in 9 could not be entered;
  hole 3→4 cells + placement rule 8 + red-proven tooth) `9b1c509` · the per-kind look pass
  `ea55be6` · **two adversarial fix rounds** off a light critic's FAIL (floating history prop,
  the snowman cluster, sconce orbs, cardboard rubble, dry flooded frames — all root-caused:
  an Euler mirror bug, analytic-plane seating, 80-facet icosahedron fins, flat capScale)
  `ec45ab1`+`8348402` · the **fungiContact machine assert** (mounting is a gate number;
  red-proven; caught two real floats AND its own false positive) · **the hazard spec drafted in
  parallel** (the pipelining lever, 38 min, `b1315c4`).
- **Verify (the gate of record, this tree):** tsc + loot + placement + colliders green;
  `verify:chunks` **ALL 24 LEGS GREEN** in 54m50s with the march legs in the quiet phase —
  `cave-walk-7a` green on quiet, confirming its parallel-phase red was load, not geometry.
  Origin digests `d8f15005`/`99e0015b` held through every fix round, proven repeatedly.
- **Visual iteration:** ~5 rounds (look pass) + 2 critic-driven fix rounds across 26 framings;
  final critic state: both sev-1s closed, remaining items are accepted/parked residuals.
- **EFFICIENCY RETRO (the watch's first full cycle):** the gate runner cut the suite ~2×; and
  agents iterated on `--legs` all day (the headroom fix's lever selection took one 20-second
  pure-model sweep instead of build-per-variant). Costs found and fixed: the parallel phase
  manufactured march false-reds twice (→ quiet phase, ~55 min suite — verdict integrity over
  the 35-min target); two runner agents parked in watcher-waits (→ poll-to-completion pattern);
  one critic mis-attribution cost two rounds before a 90-second pixel→mesh probe named the real
  builder (→ probe the pixels FIRST when a critique names a suspect). The parallel spec draft
  cost zero wall-clock.
- **⚠ BUDGET:** ~3.0M this cycle (the biggest yet — it absorbed the gate runner + two critic
  waves + the spec). **Campaign ~9.15M / 10M soft ceiling** — the remaining ladder (hazards
  build, light budget, return reason, integration) does NOT fit without raising it. Zach's
  call at this checkpoint.
- **Commits:** `c8fab5a` → `8348402` + `b85ed24` (10 commits across the two stretches).
- **PARKED FOR ZACH at this checkpoint:** [hazard-spec.md](hazard-spec.md) Q1-Q10 (the review
  this pause exists for) · the budget ceiling · THE REPAIR DESCENT WALK-TEST (cycles 6-9
  changed everything underground) · canonical speleothem geometry knife-tips (digest
  re-baseline) · pocket-9 wedge trap + floorOk margin + the seed-7 marginal pocket (all
  digest-moving) · the shaft collapse-skylight option (spec appendix Q9) · kind taste dials.

## PAUSED again (2026-07-27 evening) — Zach: "need to pause cleanly now" — cycle 9 nearly closed

What shipped between the morning resume and this pause (all committed, tree clean at `ea55be6`):
- **The gate runner** (`05bb7a1`) — verify:chunks is a tiered parallel 24-leg suite: **~32 min**
  (was ~90 recorded / ~60 honest serial), `--legs=` filtering with hard-error on typos,
  tee-to-file (verification/gate-logs/), the silently-skipped void gate folded in as always-run
  legs. Design finding baked in: **KCC marches are dt-coupled** — machine load can flip a verdict
  on marginal geometry; solo-phase criterion is "verdict can move with load", and march legs
  want `--serial` when a change touches cave geometry.
- **The entrance headroom defect CLOSED BY CONSTRUCTION** (`9b1c509`) — a pure clear-height
  model swept ~410 real sites in seconds: the defect was **~1 cave in 9**, pinching exactly at
  the carved hole's far edge (where the roof clamp hands over to terrain). Hole 3→4 cells +
  placement rule 8 (model ≥2.25m = 1.90 physical + measured 0.20m bias); both failing sites now
  clear 2.2-2.3m by ray; density cost −2.6%; red-proven two-part tooth; origin digests untouched.
- **The per-kind look pass** (`ea55be6`) — the shot instrument was broken 3 ways and fixed
  first (warren had zero frames all cycle; signature cameras backed into rock and shot sky; the
  shaft never framed its rubble). Flooded/shaft land structurally; fungal is a cathedral at eye
  level; 8 new machine-asserted kind dials.

**Remaining to close cycle 9 (the resume queue, in order):**
1. **The critic FAIL fix round.** The right-sized single verification critic then failed the
   final shots with real finds the builder's framing hid — sev-1: the warren's ONLY history
   prop FLOATS ~1m over the sand (`scen-kind-warren-signature-r5.png` ~(500,300), new in r5,
   reads as an orange chevron) · the shaft signature is dominated by a near-camera fungi
   cluster reading as a CARTOON SNOWMAN (merged silhouettes + blown emissive + occluded stems).
   Sev-2: wall/ceiling fungi float and read as sconces/orbs (fungal-pocket (1035,160)+(360,290),
   fungal-vault (967,578)) · shaft rubble slabs are flat untextured facets with rule-7 knife
   edges and one floating slab (shaft-room (940-1030,530-560)) · the flooded ROOM frame contains
   zero water (kind identity absent from its primary frame — camera/coverage rule) · shaft
   verticality is real geometry receiving zero light · (pre-existing, backlog: the egg dais
   reads as a grey tarp/ash mound — shared `_caveSolid` asset, present since r1). Critic's
   cheapest-path: ground the prop; de-cluster/move near-camera fungi at the shaft signature;
   anchor wall/ceiling fungi to their host surface; slab material/thickness; the flooded room
   framing. Then the SAME critic re-verifies (SendMessage resume).
2. **Shaft-vault lighting — a DESIGN OPTION for Zach, not free light**: a diegetic collapse
   SKYLIGHT down the shaft chimney via the existing hole-iff-resident machinery would light the
   verticality and give the kind its signature; the critic noted the moon currently punches
   through exactly where a real aperture would sit.
3. **The full suite once** (the parallel run at this pause was killed mid-flight; fast gates —
   tsc/loot/placement/colliders — were green at `ea55be6`).
4. Cycle-9 close bookkeeping + the efficiency retro (the gate runner's first full cycle:
   suite 90→32 min; the look pass's HMR lesson — never edit src/ while a rig runs; the
   one-critic wave caught 2 sev-1s for ~116k tokens — right-sizing validated).

## RESUMED (2026-07-27) — Zach: /campaign-start --resume, after the pace review

The pause gate is cleared. Per the approved efficiency plan: the tiered/parallel gate runner is
the first act (EFFICIENCY WATCH standing directive now in force in steering.md), then cycle 9
finishes (entrance headroom fix → kinds look pass → shaft/1337 apron flake → close).

## PAUSED mid-cycle-9 (2026-07-27) — Zach: "ok need to pause cleanly here"

Cycle 9 state at the pause (`c8fab5a`, tree clean, in-flight agent stopped pre-edit):
- **DONE + committed:** the four-kind table (warren/fungal/flooded/shaft) over the canonical
  generator with machine-asserted safety invariants; seed-pure kind assignment (placement digests
  untouched); distribution proven ×3 seeds; 9/12 kind marches green with 0 strands everywhere;
  a real void-gate mis-sampling fixed (+ puncture-red re-proof); the warren's scrap scatter (6
  plain scrap, transient, loot digest untouched — Zach's number); the `cave-kinds` gate as
  verify:chunks leg 13; the lattice snap (latent-coupling fix, origin digests re-baselined
  108af91c→d8f15005 / ff8309a8→99e0015b, surface+density digests unmoved).
- **REMAINING (cycle 9 finishes on resume):** (1) the **pre-existing entrance headroom defect**
  — at some streamed sites the roofed fissure pinches to 1.17-1.44m clear height vs the 1.70m
  capsule: those caves cannot be entered. Kind-independent (canonical A/B fails identically);
  the grid-origin theory was falsified by measurement; the guard-sweep fix proven a no-op; the
  `crevice-profile` instrument + measured deficits + four shortlisted levers are in the c8fab5a
  message. The cave-kinds seed-1337 leg stays deliberately RED until this is fixed. (2) The
  per-kind rule-8 look pass (12 smoke shots exist). (3) The flaky shaft/1337 apron steering.
- **Two process notes from tonight worth keeping:** the 4242 lesson (one flaky-gate sample is
  not evidence — n≥5 per tree) was applied again when the grid-origin diagnosis was falsified
  by A/B measurement before any churn shipped; and the density/kinds gate-widening philosophy
  paid for itself three times (the tile-clamped hole, the 1.6s cold-shader frame, the headroom
  pinch — all found by widening, none by the original nets).

**Resume:** `/campaign-start --resume` then `/loop /campaign-cycle`. **Owed: Zach's repair
descent walk-test** — cycles 6-9 changed pools, interior rendering, entrance geometry, density,
and kinds; his next descent judges the whole stack. Parked decisions listed in
[next-session-prompt.md](../next-session-prompt.md).

## Cycle 8 — caves are a rocky-terrain feature: the D307-at-density proof (2026-07-27) — SHIPPED

- **Planned:** the charter's density cycle — caves roll off the chunk descriptor in rocky terrain
  at real density; the three flagged D307-at-density proofs (swap cost, teardown symmetry,
  resident cap); egg cave unique; origin world byte-identical; the "cave country" fallback only
  ever as a Zach-surfaced scope-cut.

- **Baseline honesty first:** placement was NOT real before this cycle — cycles 5-7 built
  infrastructure; the chunk-perf "8 caves" were synthetic hardcoded-coordinate test placements.
  The game placed exactly one cave (origin/egg).

- **Shipped (`d5b28e8`):** `caveSites.ts` — 460m grid + jitter → 300m spacing by construction,
  rocky-only, relief/POI/landmark rejections, origin protection 1150m (= the POI exclusion, so
  tors can't weld onto boot POIs). Realized density measured: **~3.0-3.4 caves per travel-hour**
  (`CAVE_SITE_CHANCE 0.60` = Zach's dial). **The architectural win:** holed tiles now
  band-decompose into sub-heightfields instead of a full-tile trimesh — measured **80× cheaper**
  (0.3 vs 24.4ms) — buying the invariant *a hole exists iff the cave beneath it is a live
  resident* (the sheet is simply intact until the cave arrives; origin tile keeps the D307
  trimesh path untouched). Teardown proven EXACT (restoreMax 0.0000m; 0 rays through the sheet
  outside the hole; pools/materials/water registries to baseline); re-entry bit-identical.
  **No scope cut needed** — uniform density is perf-safe on foot.

- **Gates widened + two real defects found by the widening:** (1) cave-walk/cave-void extended
  to STREAMED sites as literal reuse (residentKey — not a fork that can drift); 4 sites
  marched/void-swept clean through the real streaming path (0 strands, 0 escapes); permanent
  leg, +~11min. (2) Code-reading found the carved hole CLAMPS TO ONE TERRAIN TILE — ~1.6% of
  sites would ship a visible-but-unenterable cave with every gate green; fixed by construction
  (tile-seam rejection sharing one `rawHoleCells` derivation with the hole block itself).
  (3) The reproducible **1.6-second frame** at seed 7 root-caused to a COLD SHADER-PROGRAM LINK
  on the finalize frame (pool water needs 2 programs; three's program keys carry the live light
  state, so boot-time warming can never match — tried, proven, reverted). Shipped: a warm stage
  in the build scheduler (`compileAsync` off-scene at live state) — **0 programs compiled on the
  visible frame, gate-asserted**; worst frame 1667ms → the known ~155-175ms unsliced tor. Also
  fixed `worstFrameMs f>2` silently skipping the actual worst frame, and a false-positive
  edge-check in the new density gate (the "gate that fails on healthy geometry is the same class
  of error" lesson, written into the check).

- **Verify:** `verify:all` end-to-end ALL GREEN on the final tree — every leg. Origin parity
  byte-stable (`108af91c`/`ff8309a8`); density digests `f180c0fc`/`f95e4986` stable ×2;
  SAVE_VERSION stays 18 (streamed caves descriptor-derived + save-transient, D299).

- **FLAGGED FOR ZACH:** `CAVE_SITE_CHANCE 0.60` (~3.3/travel-hour — the low end of "several";
  1.0 ≈ one per 360m rocky travel, 0.3 ≈ landmark-rare) · the tor is now the worst frame
  (~155-175ms every ~90s of rocky walking; the slicing refactor is the named lever) · streamed
  caves' harvested-fungi state is save-transient (matches D299 streamed-content behavior) ·
  program keys carry the scene light count (engine-wide pre-existing recompile sensitivity —
  fires/lanterns elsewhere; the cave path is now immune).

- **Residuals:** speeder-pace drive unmeasured (foot-pace proven; feeds the density taste call) ·
  the warm fail-safe path untested (no harness browser lacks KHR_parallel_shader_compile) ·
  tile-seam fix has no negative-control seed on the net (by design — rejection removes them).

- **Spend:** ~0.95M this cycle (campaign ~6.15M / 10M; cycle 8/20).
- **Commit:** `d5b28e8`.
- **Next (cycle 9):** cave kinds — distinct parameter sets over the same generator (tight salvage
  warren / vaulted fungal cavern / flooded cave leaning on cycle 6 / collapsed shaft): a kind
  table, not new code paths. Walk/void green across every kind ×3 seeds.

## Cycle 7 — the D-3 reassess: the cave renders, the crevice reads (2026-07-26/27) — SHIPPED

- **Planned:** the displaced D-3 full-tree adversarial visual audit + CAVE_* taste pass, carrying
  five named residuals (ceiling band, value contrast, tor at 78m, sawtooth spikes, ROCK_BUMP perf).

- **The audit instrument first:** a new `cave-audit` rig scenario — 17 player-eye framings ×2
  seeds at true shipping settings (exposure 1.05, real light path via `__game.setCaveRockLight`,
  HUD-masked metrics), + a swiftshader/GPU CAVE_ROCK_BUMP perf A/B with pixel-proofed legs. Two
  fresh critics then produced the cycle's unifying diagnosis: **the entire interior rendered into
  ~18 of 255 output codes** — the "smoky ceiling band" was a hard torch-distance cutoff leaving
  8-15m rock at code 1-4, the "low contrast" was a healthy 8-11× lighting ratio crushed into a 7%
  envelope, the banding was that envelope quantized, and the "leopard" mottle was the only texture
  octave the rock had. Bonus confirmed bug: the sun sprite (depthTest:false) painting an L≈220
  disc on deep-cave rock in upward views.

- **Interior round (`23c29fe`):** rock dither + depth-ramped lit-envelope gain (unlit floor
  bit-identical — the fungi-only no-free-light canary bit-stable at meanL 0.29); 4-octave normal
  field with tilt saturation (the leopard was the old bump OVER-DRIVEN past the normal-flip
  point); bedding strata + near grain; `flatShading` off on the cave body (it was standing in for
  detail that didn't exist); ceiling bounce strictly proportional to carried light (NO new
  PointLight — one uniform; ceilings p95 2.4→13.4 gallery / 7.9 hall); sun-through-rock fixed
  with the surface byte-identical; motes/wind-dust/flashlight-penumbra/speleothem batch. Found
  and properly fixed a pre-existing slicer laundering hazard: atomic stages were billing work to
  the divisible budget (now 15.3ms, better than baseline — proven against a pristine worktree,
  not blamed on machine load).

- **Entrance round (`23c29fe`):** sawtooth comb fixed by construction (relief out-slopes the
  voxel grid + lateral wobble, widths compensated); the "roof lamina" root-caused as the TERRAIN
  SHEET overshooting the carved hole by 7cm (closure moved inside + ROOF_UNDER clamp — 6.8m of
  real rock above the lintel now); 78m findability met by silhouette not value (seed-pure horn +
  fin shoulders; arc 1.9°→4.1° / 2.7°→5.5°, the notch survives); apron/aperture/sky-rim reshaped;
  the deepest fix was cycle-4's `projectSlot` nearest-segment discontinuity (the true source of
  the lintel blade thicket) replaced with a softmin; a guaranteed arrival fungi cluster near the
  hand-off on its own rand stream. The margin lesson re-learned safely: two clearance approaches
  that moved the whole cave were caught by gates and replaced with `CREVICE_ROOF_DROP`.

- **The 4242 episode (a process lesson recorded honestly):** the entrance round's wide-net run
  flagged seed 4242 failing cave-walk; the orchestrator "proved" it introduced-vs-pre-existing
  with ONE pristine-worktree run — a lucky sample. The follow-up agent falsified the premise
  properly (5+10 runs: flaky on BOTH trees at the same rate), refused to build the hypothesized
  speleothem fix whose reasoning was also wrong, and instead fixed what the flake exposed: the
  march gate could not fail a stranded REVISIT leg (silent blind spot → misdiagnosis 60m away).
  Now every run prints `strands=N`, and it immediately made a genuine pre-existing wedge trap
  visible on green runs. One flaky-gate sample is not evidence; n≥5 per tree is the floor.

- **Verify:** tsc clean · `verify:chunks` 20/20 legs green (walk 11/11+10/10 stable ×2, void
  0/8160+0/7392, pool-fill, preload ON/OFF, perf, skyfall/leviathan/ribcage/dune unmoved) ·
  wide net 4242/99/2024/31337 all `ascent=OUT fails=0` · the speleothem envelope assert PROVEN
  able to fire (clamp deliberately broken → loud abort → reverted).

- **Visual iteration:** interior ~8 rounds, entrance ~9 rounds incl. 4 falsified hypotheses on
  the lintel slivers; both agents A/B'd against the audit framings throughout.

- **FLAGGED FOR ZACH:** ~20 new CAVE_*/CREVICE_* taste dials (legibility gain, bounce, strata,
  horn) — the darkness READ is preserved but the lit rock is far more legible; swiftshader rock
  cost 15-22% (real GPUs: inside noise; levers named in tuning.ts); pocket-9 wedge trap at seed
  4242 (pre-existing on master, digest-moving to fix); `floorOk` margin under-bounds the true
  speleothem silhouette (pre-existing, digest-moving); motion feel (bounce flicker, dither crawl,
  crevice commitment beat) is walk-test territory.

- **Residuals carried:** entrance apron outer shelf still flat-ish with a hard sand rim (terrain
  blend, not tor); 1-3 sub-voxel slivers at the lintel at 3.5× zoom; the horn slightly
  needle-like; the descent below the tor's footprint keeps 0.45m-voxel facets; `ceil-hall` p95
  at the bottom of target; `CREVICE_COVER_CLEAR` under-sized but only binding off-net (named in
  tuning.ts, belongs to a graph-re-baselining cycle).

- **Spend:** ~1.55M this cycle (campaign ~5.2M / 10M; cycle 7/20).
- **Commit:** `23c29fe`.
- **Next (cycle 8):** the charter's density cycle — caves as a regular rocky-terrain feature
  (streamed entrances, resident cap, exact teardown, the D307-at-density proof), egg cave stays
  unique. The clustered-"cave country" fallback remains a Zach-surfaced scope-cut, never silent.

## Cycle 6 — UNDERGROUND WATER, volume tier: pools + the jerrycan (2026-07-26) — SHIPPED

- **Planned:** the charter's cycle-6 spec at the VOLUME tier (Zach's kickoff call): seed-pure pools
  in chamber floor dips + a larger vessel that only fills at real bodies of water.

- **Systems (`d717a9a`):** `src/world/cavePools.ts` (new) — pools scored on the SAME
  `caveFloorSediment` signal the floor tint uses (extracted so placement and the visual read can
  never drift), 1-3 per cave, ≥1 guaranteed, excluded from corridor mouths and the egg dais (a
  real seed-1337 defect: a pool overlapped the dais — fixed by construction, `eggDaisRadius` now
  shared). Water surface has NO collider; the collider is the visible SDF bottom (probe: delta
  0.0000m, 0 frames standing on water). Pool sources publish via `caveStream.setPoolSink`, detach
  before `disposeResident`. **Jerrycan**: craft-only (recipe 24: scrap ×3 + metal_pipe ×1 +
  cloth ×1), 4× canteen capacity, fills ONLY at pools — wells refuse diegetically. Pool audio:
  splash-tailed drips + a proximity lapping bed. Loot registry untouched (digest baseline intact);
  SAVE_VERSION stays 18.

- **Hero visual (rounds 1-13, `f388194`):** the builder's 11-round pass was then FAILED by a
  3-critic adversarial panel (identity, craft, code) with measured findings — the surface shaded
  as a lit diffuse pan up to 16× brighter than the rock, ripple at 0.14 of one 8-bit level,
  nothing mirrored, banding, and the rig shooting 19-29% over shipping exposure while claiming
  honesty. The fix rounds killed the diffuse term (raw-linear albedo + real F0 via r184's
  `specularColorBlended`), moved the ripple onto the specular lobe (6 octaves), added post-sRGB
  dither, and built K=8 seed-pure emissive glint reflections — the fungi framing is now a broken
  teal glitter column down near-black water. Verify critics: visual **PASS** (all 9 failures
  resolved; the 2 remaining metric reds ruled false positives from a mis-normalized denominator),
  code FAIL → a final integrity round: per-cave pool materials (a streaming cave could steal the
  live cave's reflections — proven fixed by uniform snapshot), the pixel gate wired into
  `verify:chunks` with unconditional throws, a TEMPORAL ripple metric (proven 0.00 on a flat
  surface after the spatial metric measured toothless — flat pool2-rim scored HIGHER than
  rippled), leg 4b re-anchored in GPU readPixels truth, f32-faithful CPU twins with a measured
  0.70m tolerance, all 9 shader-injection anchors guarded and gate-asserted, seed-7 de-overfit of
  two gate assertions.

- **Verify:** tsc + loot + placement + colliders + `verify:chunks` (cave-walk 11/11 + 10/10,
  cave-void 0 escapes ×2 seeds, chunk-perf, cave-preload, the new pool pixel legs) ALL GREEN on
  the final tree. `pool-fill`: refill rules proven both ways, phantom-annulus 8/8 bearings,
  determinism stable + matchesLive (digests c54885f7 / 74da41c5).

- **Visual iteration:** 13 rounds total + a 5-agent adversarial panel across two waves. Honest
  residuals: pool motion (ripple/glint crawl) untestable in stills — needs Zach's walk-test;
  wet-collar gloss strip invisible in all poses (harmless); the r11 dark shard gone but root
  cause unnamed (a locating diagnostic now lives in pool-fill); at shipping exposure the water is
  a genuinely DARK mirror (median 2-5/255 near, taste dials `CAVE_POOL_GLINT_STRENGTH` /
  `CAVE_POOL_ALPHA_MIN`); pool2-rim is the weakest framing — recheck at cycle 7; dither
  crosshatch worth one motion look.

- **FLAGGED FOR ZACH (balance, not baked):** jerrycan recipe scrap ×3 + metal_pipe ×1 + cloth ×1 ·
  capacity 4× canteen (16 gulps) · pools 1-3/cave ~0.3m deep · the "fill everything at a real
  body of water" purpose lands fully when cave density (cycle 7+) makes descents routine.

- **Spend:** ~1.9M this cycle (campaign ~3.65M / 10M; cycle 6/20). Heavier than a normal cycle —
  the 3+2-critic adversarial panel and three build rounds are what the hero bar costs.
- **Commits:** `d717a9a` (systems) + `f388194` (hero visual + gate integrity).
- **Next (cycle 7):** the displaced D-3 visual reassess + CAVE_* taste pass, carrying the named
  residuals: ceilings ~80% (dark smoky band 8-15m), global value contrast below the old shell
  kit, the tor marginal at 78m, sawtooth spikes on the fissure's upper walls, CAVE_ROCK_BUMP perf
  unmeasured on low-end GPUs + its leopard-print mottle competing with the pools for attention,
  rock 8-bit banding under amplification, and the pool taste dials above.

## Resume + cycle-6 kickoff (2026-07-26)

Zach: "pick up where we left off" — campaign unpaused at `31a6de9` (tree clean, verify:all green).
Cycle-6 design decision, his call at kickoff (made in chat, AskUserQuestion): **VOLUME tier** —
pools plus a larger vessel (jerrycan) that only fills at real bodies of water, giving the descent
a purpose. Stated honestly: the repair descent (D-1..D-4) is **still unwalked**; cycle 6 builds on
the gate-green but human-unverified base, per his 2026-07-25 "run the remaining ladder" directive.

## Cycle 5 — the cave build stops hitching: boot preload + frame-budgeted slicing (2026-07-25) — SHIPPED

- **Planned:** walk-test **D-4** — preload the origin cave behind the loading screen; slice streamed
  cave builds on the S6/D296 pattern; add a resident-interior cap that never unloads the cave the
  player is standing in; gate all three inside `chunk-perf` with real tripwires.

- **⚠ THE FIRST FINDING INVERTS HALF THE TICKET.** The origin/egg cave was **already built at boot**
  — `spawnCave` runs at `main.ts` module scope, before the first frame is ever presented — so it has
  never been able to hitch gameplay. What was missing was not the preload but the **loading screen**:
  the browser showed a blank page for the whole ~4.6s boot, so the 1.3s of cave build read as "the
  game is slow to load in". Shipped `#boot-overlay` in `index.html` — inline-styled so it paints
  BEFORE the module bundle (whose CSS arrives too late to cover boot) and removed on the last line of
  `main.ts`. Measured: **boot 4562.6ms, of which the cave is 1311.9ms (tor 152.3 + body 1159.5) =
  28.7%.** The cost is real, it is covered, and it is now instrumented (`__cavePreloadMs`, the
  `cave:entrance` / `cave:body` marks in `__bootT`).

- **THE SLICER — one code path, two drivers.** `buildCaveSdf` and `spawnCave` are now thin wrappers
  that drive `startCaveSdf` / `startSpawnCave` with an infinite budget. The sliced driver runs the
  SAME job with `CAVE_BUILD_SLICE_MS` (8ms). Nothing was re-implemented, so the synchronous and
  sliced outputs cannot diverge by construction — and the gate proves it rather than trusting it.
  Stages, in run order:

  | stage | divisible? | resume granularity |
  |---|---|---|
  | `graph` | no (~1ms) | — |
  | `sdf:field` | **yes** | one 8³-voxel block (~0.02ms), loop linearized, order unchanged |
  | `sdf:cells` | **yes** | one k-plane of the surface-nets vertex pass |
  | `sdf:quads` | **yes** | one (axis, k) plane of the quad pass |
  | `sdf:cut` | **yes** | 3k triangles of the sky-rim cut |
  | `sdf:geom` | **no** | `computeVertexNormals` is one pass inside three.js |
  | `sdf:color` | **yes** | 7k vertices |
  | `dress` | no | the speleothem/fungi kit |
  | `finalize` | **no** | the Rapier trimesh bake **+ `scene.add` in the SAME step** |

  **Atomic finalize** (the terrain-tile precedent): nothing enters the scene and no collider exists
  until the last step, so a half-built cave is never visible and never collidable, and "visible but
  not solid" cannot exist for even one frame (rule 9).

- **MEASURED, before → after** (seed 1337, GPU headless, the `chunk-perf` walk):

  | | before (sync) | after (sliced) |
  |---|---|---|
  | worst frame of a streamed cave build | **~1160ms** (the whole body build, ~70 frames of hitch) | **90.5ms observed** |
  | worst DIVISIBLE slice step | n/a | **17.7ms** (budget 8ms) |
  | worst INDIVISIBLE step | n/a | **97.6ms — `finalize`, the Rapier trimesh bake** |
  | steps per build | 1 | ~84 (671 steps / 8 caves) |

  **The honest ceiling, stated plainly: ~90-100ms is the floor and no slicer can lower it.** A
  `ColliderDesc.trimesh` call over ~70k triangles cannot be chopped — it is one call into WASM. So a
  streamed cave costs **one dropped frame (~5-6 frames at 60fps), not seventy.** That is a 13× cut,
  not a fix. The remaining levers, none taken this cycle: a coarser voxel for far caves (0.65m was
  ~2.4× cheaper in cycle 1's table and would cut the collider triangles with it), a convex-decomposed
  or heightfield-per-chamber collider instead of one trimesh, or building the collider off-thread.
  The two budgets are reported and gated **separately** so the 97ms bake can never hide inside the
  slice budget, and the divisible tripwire (20ms) is deliberately above the 8ms budget: a stage step
  always finishes the chunk it started, and the coarsest chunk is ~10ms of `pureHeightAt`.

- **THE RESIDENT CAP.** `CAVE_RESIDENT_MAX` = 3 interiors (each ~95k visual tris + a ~70k-tri static
  trimesh). Eviction is farthest-first, and **three things are never evicted**: a `pinned` cave (the
  origin/egg cave, which owns the carved terrain hole and the companion egg), the cave whose padded
  bounds contain the player (`CAVE_EVICT_MARGIN_M`), and anything inside `CAVE_EVICT_MIN_DIST_M`
  (260m — you can see the mouth from there). If every resident is protected the cap is simply not
  enforced that frame: **a soft cap can never cause a fall-through, and a hard one could.** Teardown
  disposes geometries and removes the rigid body (rule 9 — no orphaned collider under vanished rock).

- **THE GATE — `chunk-perf` extended, plus a new boot-only `cave-preload` leg** (both in
  `verify:chunks`, so both run in `verify:all` every session). What it asserts, and the tripwire
  behind each — because "green because nothing built" is the failure mode this project keeps hitting:
  - `builds === N` and every new resident has **>0 visual AND >0 collider triangles** — a cave that
    silently didn't build cannot pass.
  - `steps ≥ 100` for 4 caves — a build that reverted to one synchronous call reports **1** step and
    a ~1160ms max, so slicing cannot be quietly lost.
  - divisible slice ≤ 20ms · **indivisible ≤ 170ms, named by stage** · worst **observed rAF gap**
    ≤ 260ms, measured independently of the counters so a cost they miss still shows.
  - the cap **evicted** (`evictions ≥ 1`, `residents ≤ 3`), the **pinned** origin cave survived, and
    with the player held INSIDE a far cave: that cave is still resident, `occupiedEvictionsBlocked`
    actually incremented (else the guard was never exercised — a vacuous pass), and a second eviction
    round really ran.
  - **the digest contract**: the origin cave's exact junction+seed is rebuilt through the SLICED path
    and its `caveDigest` must equal the synchronously-preloaded original's.
  - `cave-preload` runs at BOTH flag states: ON → preload record exists, origin resident is pinned
    with real triangles, `#boot-overlay` came down; **`--cave=0` → no preload record, no residents,
    and the flag-off world still boots** (the shipped kill-switch cannot be regressed by the preload).
  - **Proven able to fail**: the first `chunk-perf` run went RED on the digest-clone tripwire
    (`the sliced digest-clone cave never built`) — the clone was evicted by the cap in the same frame
    it finalized. Real bug in the probe, caught by the gate, fixed by standing the player at the site.

- **`caveDigest` UNCHANGED — measured, not asserted.** A git worktree at the pre-cycle-5 commit
  (`5433227`) reports seed 1337 `digest=a5d75db9 nodes=11 tris=94927`; after the refactor the same
  scenario reports **`a5d75db9`, 94927 tris**, and the sliced rebuild of the same junction reports
  `a5d75db9` too. Slicing changed when work runs, nothing about what it computes.

- **HONEST READ — can several caves build during travel?** At the cycle-8 density: **yes, with a
  caveat.** One in-flight build at a time, ~84 sliced steps at ≤18ms plus one ~97ms finalize frame
  ≈ 1.4s of wall clock per cave with a single visible stutter. Three caves entering the ring
  back-to-back queue up and cost three stutters over ~4s — noticeable on a fast traverse (speeder,
  sled), acceptable on foot. **What would break it is a cave building every few seconds**, i.e.
  uniform density at speed. If Zach's playtest finds the stutter objectionable the cheap fix is a
  coarser far-cave voxel (fewer collider triangles → a smaller atomic bake), and only after that does
  the clustered "cave country" scope-cut come into play. **Not taken here — it is Zach's call.**

- **Constraints held:** room-graph layout logic untouched · collider still baked from the same
  triangles · `VITE_CAVE=0` still kills the whole feature (now gate-proven) · determinism (D290)
  preserved and digest-verified · no `git stash`, push held.
- **GATES — `npm run verify:all` GREEN, every leg, run end-to-end once at the end.** The new rows:
  - `cave-build`: preload 1305.5ms (tor 145 / body 1160.5) · **8 sliced builds in 699 steps** ·
    divisible slice **17.1ms** / atomic **81.9ms (`finalize`)** / worst observed frame **80.6ms** ·
    residents 3 · **6 evictions, occupied-blocked 3, occupied cave survived** · 0 fails.
  - `cave-preload` flag ON: boot 4349.9ms, cave preload 1332.8ms (tor 157.1 / body 1175.7),
    94,927 tris, digest `a5d75db9`, 0 fails.
  - `cave-preload` **`VITE_CAVE=0`**: boot **2523.5ms**, no preload record, 0 residents, 0 fails —
    the kill-switch path is intact. Note the honest delta: the cave-off boot is **1826ms** shorter,
    not 1333ms — the extra ~490ms is the entrance-chunk heightfield→trimesh swap and the carved-hole
    terrain path, i.e. **the cave's true boot cost is ~40% of boot, not 29%.**
  - `cave-walk` 1337 **11/11 chambers, digest `a5d75db9` stable ×2** · seed 7 **10/10, `ff8162e8`
    stable ×2** · `cave-void` **0/8160 (0.00%)** and **0/7392 (0.00%)**, `excused=0`, `holes=0`.
  - The pre-existing legs are unmoved: terrain `perf` slice 30.4ms / 812 steps, streaming
    bodies 378→378, skyfall / leviathan / ribcage / dune-slope all OK.
- **Commit:** `f7450fe` (code) + `1501bc8` (bookkeeping). **Next:** cycle 6 — water pools (the first
  new-content cycle; Zach asked for it by name).
- **⚠ DOC GAP NOTED, not fixed here:** cycle 4 never wrote a `campaign-log.md` entry (it updated
  `campaign-state.json` only), so this file jumps cycle 3 → cycle 5. The cycle-4 record lives in the
  state file's `cycles[3].note`.

## Cycle 3 — surface character restored; the seed net proven 6/6 (2026-07-25) — SHIPPED

- **Planned:** re-run the two cycle-2 probe hangs · restore the carved-rock read the shell kit had,
  iterating on the REAL torch-lit view, without regressing the void gate or the 32° slope ceiling.

- **TASK A — the two hangs did NOT reproduce; the seed net is 6/6.** `cave-walk` seed 99 = PASS,
  10/10 chambers, full Euler tour, `ascent=OUT`, **max slope 21.1°**, fails=0, digest `a6e21544`.
  `cave-void` seed 2024 = **0/8160 escapes (0.00%)**, 85/85 points clean, `excused=1`, `frontEsc=1`.
  Both ran first-try on a machine with no special preparation. Cycle 2's read ("harness, not
  generator") is now supported by evidence rather than inference. Recorded as a **flake**, not a fix:
  nothing was changed that would explain it, so if it recurs it is still unexplained.

- **THE DIAGNOSIS BEHIND THE REGRESSION, measured.** Cycle 2 called the new surface "smoother and
  softer". The real causes were three, and only one was the shading model:
  1. **Flat vs smooth shading** — real, and the smallest of the three.
  2. **THE SMOKE MOTTLE (the actual reason the cave read as fog).** `caveVertexColor` picked its role
     with a HARD threshold on the surface normal (`up > 0.55` floor / `up < -0.4` ceiling). On the
     SDF surface the normal carries the rock displacement, so adjacent vertices across a bumpy
     ceiling flipped between 'wall' and 'ceiling' — a **×0.58 value step applied per-vertex at
     random**, interpolated into grey-brown smoke. This was a genuine bug, not a taste issue.
  3. **The 0.45m voxel floor on detail.** The third displacement octave (1.2m) sits under Nyquist for
     a 0.45m grid, so surface nets smooths it away: **the surface cannot carry ANY detail below
     ~1.2m**, and at torch range (1-2m) the wall was a featureless blob no matter what the SDF did.

- **What shipped**, in the order the shots forced it:
  - `_caveSurface` is **`flatShading: true`** again (the direct analogue of `_caveShell`).
  - **`CAVE_SDF_MICRO_*`** — a small un-attenuated relief term (0.075m at ~2.5m ≈ 5.5 voxels). The
    big octaves are floor-attenuated to zero (cycle 2's 32.4° fix, preserved), which left walkable
    floors *geometrically planar* — a flat-shaded plane has one normal and reads as brown mud. Sized
    so its own worst-case gradient is ~6° and it cannot approach the 32° ceiling on a 22° ramp.
  - **Smooth role weights** — `caveVertexColor` takes the raw normal Y and ramps the ceiling/floor
    contributions with a smoothstep; the ceiling darkening went ×0.58 → ×0.70. Kills the mottle.
  - **Sharper strata** — two band scales (7.4m formation + 2.0m bedding), each through a power curve
    so a band reads as a layer with an edge; contrast roughly doubled; fine grain added everywhere.
  - **Floor sediment rebalanced** — one 10m blob at 0.9 strength (the "mudflat") → 0.72 broken by a
    3m octave, so it reads as drifts between exposed rock.
  - **`CAVE_ROCK_BUMP` — sub-voxel rock relief as a normal perturbation** in `_caveSurface`'s
    `onBeforeCompile` (hashed 3D value noise, 2 octaves at 0.6m/0.22m, forward-difference gradient,
    world-space, rolled off by `fwidth` footprint). **Zero triangles, zero collider change, one
    program, one uniform.** Halving the voxel was the alternative and was rejected on cycle 1's own
    numbers: 0.35m = 113.6k tris / 1509ms against a streaming budget that is already the campaign's
    flagged risk — for detail still only ~0.9m.

- **ROUND-BY-ROUND** (all on seed 1337; the fast `cave-look` scenario — see below):
  | round | change | what the shot showed |
  |---|---|---|
  | R1 | `flatShading: true` | Walls/ceilings got facets — real gain. **Floor still a featureless wash**, and now inconsistent with the faceted walls. |
  | R2 | micro-relief + sharper strata + sediment rebalance | Floor gained relief and value break-up. Still read as smoke — and the shot showed *why*: blotchy grey mottling on the upper walls. |
  | R3 | smooth role weights + **re-framed the torch shots** | Mottle gone. The re-framed `dark-torch-hall` (the real in-game read) exposed the actual problem: **at torch range the wall is completely featureless.** |
  | R4 | shader bump v1 — sum of directional sine waves | **FAILED loudly.** Even domain-warped, six waves resolve into oriented **zebra banding**; it read as wood grain. Recorded in the source so it isn't retried. |
  | R5 | replaced with hashed value noise, strength 0.16 | Isotropic — but invisible. Over-corrected. |
  | R6 | strength 0.50 | Still barely there. |
  | R7 | strength 2.20 (diagnostic) | Works, clearly too strong: splotchy dark blobs, speckle at range. |
  | R8 | **strength 1.15 — landed** | Floor has genuine grain and drift structure; the torch-lit wall has real ledges and recesses; the dais no longer out-reads the cavern. |

- **⚠ HONEST VERDICT vs the shell baseline — better in the near field, still weakest on ceilings.**
  The near/mid read (floors, walls at torch range, the dais surround) is **better than the shell
  baseline**, and it is better on a surface that is also watertight, which the shell never was. The
  **ceiling is still the weak element**: it reads as a dark smoky band rather than as rock with
  structure — the mottle bug is fixed, but a ceiling seen at 8-15m through the distance roll-off has
  little left to look at, and the finest bump octave still speckles slightly at range. Call it
  **~80% there on ceilings**, good on everything else. Also unresolved: the overall value contrast is
  still lower than the shell kit's, most visible in the wide diagnostic shots.
- **⚠ PERF RISK, flagged not assumed away:** the bump is ~8 value-noise evaluations (≈64 hashes) per
  cave fragment. Confined to one program and distance-faded, but unmeasured on a low-end GPU.
  `CAVE_ROCK_BUMP: 0` disables it with no other change.
- **Harness:** new **`cave-look`** rig scenario — the `cave-walk` shot set (now a shared
  `caveShotSet`, so the framings are byte-identical) with the ~4-minute KCC march skipped. That is
  what made 8 rounds affordable inside one cycle. The two `dark-torch-*` framings were fixed: the
  torch used to sit at the camera aimed across the hall's open middle, so its pool fell out of frame
  and the shot was near-black — **it could not judge anything**, which is why cycle 2's regression
  was described from the rig-lit shots only.
- **Constraints held:** entrance untouched (cycle 4) · room-graph layout logic untouched · collider
  still baked from the same triangles.
- **GATES.** `npm run verify:all` **GREEN**, every leg. `cave-void` **0/8160 (0.00%)** seed 1337 and
  **0/7392 (0.00%)** seed 7, **`excused=0` on both** (cycle 2 was 0-1). `cave-walk` 11/11 and 10/10,
  `ascent=OUT`. **Max corridor slope 1337: 22.3° → 24.8°** — the micro-relief costs ~2.5°, inside the
  ~6° it was sized for, and leaves **7.2° of margin** under the 32° ceiling. Named, not buried: the
  budget for future un-attenuated relief is now smaller than it was.
- **`caveDigest` re-baselined by construction** (the micro-relief moves vertices): 1337
  `fe884530` → **`82a66e57`**, 7 `da185721` → **`3eb21a1a`** — both **stable ×2**, cross-seed
  distinct. Body tris 1337: 67,418 → 89,199 whole-cave (the micro-relief adds sign changes).
- **Commit:** `e0ed864`. **Next:** cycle 4 — the crevice entrance (D-1).

## Cycle 2 — the watertight surface is THE cave; the shell kit is deleted (2026-07-24) — SHIPPED

- **Planned:** make cycle 1's SDF remesh the only meshing path · delete the shell kit · re-bake the
  collider from the same triangles · fix the 32.4° corridor · re-baseline `caveDigest` · 6-seed
  sweep · wire `verify:cave:void` into `verify:chunks` · measure the Rapier trimesh bake.

- **Switched + deleted.** `FEATURES.caveSdf` is RETIRED (nothing left to select between); the cave
  body is always `buildCaveSdf`. `VITE_CAVE=0` kill-switches exactly as before. Removed from
  `caveGen.ts`: `buildChamberGeometry`, `buildCorridorGeometry`, `rockDisp`, the `Carve` interface +
  `carveByNode`/`addCarve`, the `_caveShell` BackSide material, and the duplicated palette (the one
  copy now lives in `caveSdf.ts` as the exported `caveVertexColor`, used by the dais + speleothems).
  Also removed the tuning keys that only the shells read (`CAVE_GEN_CHAMBER_RINGS/SEGS`,
  `CORRIDOR_RINGS/SEGS`, `END_OVERLAP`, `DOORWAY_H`, `FLOOR_FILL`, `CHAMBER_FLOOR_DROP`) and
  rig-shot's `--sdf` selector. `caveGen.ts` 1176 → 837 lines. The room-graph layout logic is
  untouched, as required.

- **THE 32.4° CORRIDOR — root-caused, and it was NOT the smooth-min.** Cycle 1 guessed smooth-min
  rounding. Measured: cycle 1 attenuated the rock displacement by height above `Prim.floorY`, which
  for a corridor was `min(fa, fb)`. On a **descending** corridor the shallow half therefore read as
  "6m above the floor" and took the FULL ±0.95m multi-octave displacement **through its walkable
  floor** — dy-0.8m over a dx-1.2m sample baseline = 33°, exactly the reported figure. Fixed by
  keying attenuation to the LOCAL ramp floor (`_localFloor`, a side-channel out of `primDist`).
  Seed 1337 **32.4° → 22.3°**. The smooth-min blend is ALSO now floor-attenuated
  (`CAVE_SDF_SMOOTH_FLOOR` / `_BAND`) — belt-and-braces, and correct in its own right. The 32°
  ceiling was never touched.

- **The gate is permanent AND has teeth.** `verify:cave:void` is now a leg of `verify:chunks`, so it
  runs in `verify:all` every session. Two anti-laundering guards, because "green because it measured
  nothing" would have been the worst outcome of this cycle: (1) a **vacuous-pass guard** on both the
  in-page probe and the harness — under 40 sample points / 3840 rays is a FAIL, not a pass;
  (2) the **puncture proof** — `--puncture=25` deletes ~25% of the surface's triangles in-page and
  the gate goes RED (seed 1337: **1837/8160 = 22.51%**, `pass=0`, holes=1806). Re-runnable any time.

- **Collider = the visual triangles, only path** (rule 9): the trimesh is baked from the SDF surface
  + dais + collider-bearing speleothems, and `colliderTris` is now reported so the identity is
  visible in the probe line.

- **THE STREAMING NUMBER (cycle 1 deferred this to cycle 4 — measured now).** At voxel 0.45m,
  seed 1337: 67,418 body tris (70,322 baked incl. dressing). **Rapier trimesh bake = 68.2 ms.**
  Polygonization = 992 ms (field 553 / nets 410). So the collider is ~6% of the build cost and is
  NOT the streaming blocker — the polygonizer is, and it is the sliceable half (pure per-block loop,
  zero cross-block state, the S6/D296 pattern). That materially de-risks cycles 4 and 7.

- **⚠ HONEST VISUAL VERDICT — a partial REGRESSION in surface character, reported despite a green
  gate.** The fundamental read is enormously better: the egg chamber used to be a dais and
  speleothems floating in pure black void (that IS D-2), and is now a continuous enclosed cavern
  with floor, walls, ceiling and a light pool. But the new surface reads **smoother and softer**
  than the shell kit's: `_caveShell` was `flatShading: true` (crisp carved facets) and the SDF
  surface is smooth-shaded, so strata banding and the multi-octave knobs read as broad soft washes
  instead of rock. The flat-shaded dais in the same frame now looks MORE like rock than the cave
  around it. Not fixed here (cycle 3 is the entrance; cycle 5 is the visual reassess) — logged as
  the first item of that pass. Evidence: `verification/scen-cave-walk-{egg,hall}.png` vs
  `verification/baseline-shell/` (same shots, shell path, preserved for the comparison).

- **THE 6-SEED SWEEP** (the widened net the cycle demanded — Underworld hid two generator defects
  behind 2 seeds):

  | seed | `cave-void` | `cave-walk` | max corridor slope |
  |---|---|---|---|
  | 1337 | 0 / 8160 escapes (0.00%) | PASS 11/11 chambers, ascent=OUT | 22.3° |
  | 7 | 0 / 7392 (0.00%) | PASS 10/10, ascent=OUT | 22.5° |
  | 42 | 0 / 6624 (0.00%) | PASS 9/9, ascent=OUT | 21.0° |
  | 99 | 0 / 7392 (0.00%) | not completed (probe hang, see below) | — |
  | 2024 | not completed (probe hang) | not completed | — |
  | 555 | 0 / 5856 (0.00%) | not completed | — |

  `excused` is 0 or 1 everywhere — nothing is laundered through the declared-opening allowance.
  **⚠ OPEN: two probe runs (walk 99 / void 2024) hung** with the machine at 25% CPU after ~30 min,
  twice, including once alone on a reaped machine. Not reproduced as a *generator* fault — the same
  seeds pass the other gate (void 99 = 0.00%) — so the current read is probe/harness, not cave. It
  is NOT proven, and it is the first thing cycle 3 should re-run before trusting the far seeds.

- **`caveDigest` re-baselined** (the SDF changes it by construction): 1337 `fe884530`, 7 `da185721`,
  42 `ac136278` — same-seed **stable ×2** (`verify:chunks` runs each seed twice), cross-seed distinct.
- **`npm run verify:all`: GREEN**, every leg, including the new `cave-void` leg inside
  `verify:chunks` (seeds 1337 + 7, 0 escapes each).

- **Commit:** `c5f0a35`. **Next:** cycle 3 — the crevice entrance (D-1).

## Cycle 1 — D-2 diagnosis + the void-ray gate + the SDF remesh prototype (2026-07-24) — SHIPPED

- **Planned:** confirm the D-2 root cause with a real probe · land a see-through gate demonstrated
  RED on the broken cave · prototype the watertight remesh on one seed with real cost numbers.

- **⚠ THE DIAGNOSIS WAS PARTLY WRONG — measured, then corrected.** The pre-cycle hypothesis
  (interpenetrating zero-thickness BackSide shells) is real but accounts for only ~15-18% of the
  leak. **The dominant cause is inverted winding**: `buildChamberGeometry` emits inward-facing
  normals while corridor tubes are wound outward, and both share `_caveShell` (`side: BackSide`).
  So `BackSide` culls exactly the faces you stand behind — **a room's own walls and floor are
  invisible from inside that room** (74.6% chamber escape; the egg-chamber centre leaks 88/96
  rays, 3/96 when forced FrontSide). Corridors are wound the other way, which is why the cave read
  as half-plausible rather than absent. Only 4.0% of rays escape even with `DoubleSide` forced.
  **The prescribed fix is unchanged** — one watertight surface is consistently wound AND seamless,
  killing both classes. Flipping the chamber side was explicitly rejected: it would drop the number
  while leaving paper shells + carve gaps (rule 7).

- **Shipped:**
  - `scripts/verify-cave-void.mjs` + the `cave-void` rig scenario — 85 eye-height sample points
    (chamber centres + 4 offsets, 3 per corridor axis) × 96 Fibonacci-sphere rays, raycast against
    the cave mesh set honoring `material.side`. Declared-opening allowance reads
    `userData.intendedOpening` exactly as `verify-solid.mjs:268` does. `npm run verify:cave:void`.
  - **Demonstrated RED on the shipped cave**: seed 1337 **4373/8160 escapes (53.59%)**, 84/85
    points leaky, `excused=0`; seed 7 3926/7392 (53.11%), 77/77 leaky. Nothing laundered through
    the opening allowance.
  - `src/world/caveSdf.ts` — the remesh prototype behind `VITE_CAVE_SDF` (default OFF, shipped path
    untouched). **Naive surface nets**, not marching cubes: no slivers on near-tangent corridor
    cells, ~35% fewer tris at equal resolution, manifold by construction. Displacement moved INTO
    the SDF (narrow-band, 3 world-space octaves); `role` now derives from the normal, which is
    correct on overhangs where the old lat-long test never was.
  - **Gate result on the prototype: 53.59% → 0.00%.** `excused=0`, and `frontEsc=0` too — correct
    from either side declaration, which is the real proof the winding is now consistent.
  - The builder also ran `cave-walk --sdf` unprompted, because a *sealed* cave would pass the void
    gate while being unreachable — the exact "gate measuring the wrong thing" failure. It doesn't:
    11/11 chambers, full Euler tour, `ascent=OUT`.

- **Cost measured (seed 1337, cave body):** 0.65m → 32.5k tris / 317ms · **0.45m → 68.4k tris /
  814ms (recommended)** · 0.35m → 113.6k tris / 1509ms. Shell baseline ~13.5k tris. Field eval and
  net extraction split cost ~50/50, both linear in voxel count.
- **⚠ STREAMING FLAG (loud, not a stop):** 814ms synchronous ≈ 49 frames of hitch — unacceptable
  as written for "several caves resident". Sliceable on the S6/D296 pattern with **no algorithmic
  change** (the field pass is a pure per-block loop with zero cross-block state). Per-kind
  resolution (far caves 0.65m, hero egg cave 0.45m) buys another ~35%. **The unknown that could
  actually change the plan is the Rapier trimesh bake cost at 68k tris — not yet measured.**
  Cycle 4 must measure the collider bake, not just the polygonizer.

- **Verify:** `npm run verify` (tsc) clean; `verify:all` re-run at batch end (default path unchanged
  — the prototype is flag-gated OFF).
- **Visual iteration:** N/A this cycle (diagnostic + prototype). The remesh's *look* is cycle 2-3.
- **Known residual for cycle 2:** corridor 1–2 measures 32.4° against the 32° ceiling — smooth-min
  rounding shaves the ramp start. Named and marginal, not hidden.
- **Commits:** `db8082a` (diagnosis + gate), `7af419f` (SDF prototype).
- **Next:** cycle 2 — the full watertight build-out: 6-seed sweep, collider re-bake as the only
  path, delete the shell path, re-baseline `caveDigest`, fix the 32.4° corridor, wire
  `verify:cave:void` into `verify:chunks`.

## Cycle 0 — campaign started (2026-07-24)

**Goal:** turn the underworld from a beautiful place with one errand in it into a *system* —
repaired first, then given variety, danger, water, and a reason to descend twice.

**Branch:** `campaign/2026-07-24-deeper` (from `master` @ e9f75b5). **Push HELD.**
**Ceiling:** 10M tokens / 20 cycles. **Checkpoint policy:** milestone.

**Why this campaign exists.** The Underworld ship (2026-07-20) merged with Zach's walk-test
feedback unrecorded — the docs said "feedback pending" for four days. Collected 2026-07-24 and
root-caused against the code the same day:

- **D-1 — the entrance is still the greybox.** `caveTest.ts` still carries its own
  "cycle-1 ENABLING TECH only — greybox geometry" header; it was never replaced. Ships as a
  29.2m × 8.34m × 12m snapped trench + slab ramp (~22°). Zach's "massive ramp" read is literal.
  Wanted: a **crevice** in a rock outcrop, tight and committing.
- **D-2 — see-through interior walls and floors.** Root cause found: the cave is N separate
  **zero-thickness `BackSide` shells that interpenetrate** (chamber ellipsoids + corridor tubes,
  `caveGen.ts:951`, `CAVE_GEN_END_OVERLAP` 1.2m). Stand in a chamber, look at a corridor — you're
  outside that shell, its faces cull, and with no thickness there's nothing behind them. Rule 7,
  never applied to the cave kit. Fix: **one watertight surface** (SDF → marching cubes over the
  existing room-graph). `DoubleSide` explicitly rejected as a symptom-hider.
- **D-3** — reassess + adversarial sweep afterward.
- **D-4** — preload caves at the loading screen; slice streamed cave builds.

**Zach's kickoff calls:** 10M/20 · **no creature underground** (environment-only danger) ·
**caves are a regular rocky-terrain feature**, not a rare landmark · **water pools promoted to
cycle 6**, the first new-content cycle.

**Ladder:** 1 void-ray gate + D-2 spike → 2 watertight remesh → 3 crevice entrance →
4 preload/gen-budget → 5 reassess **→ repair descent (Zach)** → 6 water → 7 density → 8 kinds →
9 hazards → 10 light budget → 11 return reason → 12 integration **→ final descent (Zach)**.
Cycles 1-5 are never cut.

**Flagged at launch:** "caves are common" breaks an assumption in D307 — the entrance collider
swap was specced and gate-proven for exactly ONE cave. At rocky density it becomes a routine
streaming event with multiple resident interiors. Cycle 7 must prove swap cost, teardown symmetry,
and a resident cap rather than assume them; the fallback is clustered cave country, surfaced as a
scope-cut, never taken silently.
