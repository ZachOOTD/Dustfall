# Cave walk-test — Zach's descent report (recorded 2026-07-24, walk-test taken ~07-20)

The Underworld ship (2026-07-20) merged before this feedback was written down. Recording it now.
**These defects are cycle 1 of the DEEPER campaign and outrank the charter's own ladder.**

---

## D-1 — The entrance is still the greybox, and it reads as a massive ramp
> *"i didn't like the entrance, it still had the greybox and was more like a massive ramp. i want
> the entrance to the cave to be more like a small opening like a crevice in a rock that leads you
> down. not a wide open ramp."*

**Confirmed in code — this is literally true, not a perception problem.** `src/world/caveTest.ts`
still carries its own header: *"This is cycle-1 ENABLING TECH only — greybox geometry."* It was
never replaced. What ships today is a snapped rectangular trench with a slab ramp:

| | value | reads as |
|---|---|---|
| `CAVE_TEST_RAMP_RUN` | **29.2 m** horizontal run | a haul road |
| `CAVE_TEST_WIDTH` | **8.34 m** clear width | two lanes wide |
| `CAVE_TEST_DEPTH` | 12 m descent | ~22° — a gentle drive-down |

An 8.3m-wide, 29m-long open trench is a ramp by any reading. The sinkhole/rubble-collar dressing
described in the morning summary sits *on top of* that greybox trench; it never replaced it.

**Wanted:** a **crevice** — a narrow fissure in a rock outcrop that you squeeze into and descend
through. Small opening, not a wide mouth. The descent should feel like committing to a tight
space, not walking down a driveway.

**Build constraints:** must stay KCC-traversable (steep + narrow is fine; a switchback or chimney
descent inside a slot beats one straight ramp), must keep the D307 carved-hole entrance mechanism
(the hole gets *smaller*, which is easier, not harder), and the entrance must remain findable —
a crevice in a distinctive rock outcrop that reads from a distance, since it holds the egg.

---

## D-2 — Interior walls and floors are INVISIBLE; you can see through into the void
> *"many of the interior walls and floors of the cave were invisible, i could see right through
> under the world which is not right."*

**Root cause found — architectural, not a material typo.** The cave is built as **N separate
zero-thickness shells that interpenetrate**: one closed ellipsoid per chamber, one tube per
corridor, each its own `THREE.Mesh` (`caveGen.ts` ~1047-1071), all sharing `_caveShell` which is
`side: THREE.BackSide` (`caveGen.ts:951`).

BackSide is correct *only* while you are inside that particular shell. But the shells overlap —
corridor end-rings deliberately poke **1.2 m** into each chamber (`CAVE_GEN_END_OVERLAP`). So
wherever you stand inside chamber A and look at corridor B's tube, you are **outside B's surface**,
B's faces are culled, and there is nothing there — you see straight through the world. Same at
every junction, every doorway carve, and anywhere two shells interpenetrate. Zero-thickness
single-surface shells also mean there is no back wall to stop the ray: you get the void.

This is **rule 7 in its purest form** — the project's own no-paper-thin-shells rule — and the cave
kit was never held to it.

**The fix is NOT `DoubleSide`.** That hides the symptom and leaves paper walls, z-fighting at every
overlap, and other rooms' interior faces visible through doorways. The correct fix is to make the
whole cave **ONE watertight surface**: build a signed-distance field from the existing room-graph
(union of chamber ellipsoids + corridor capsules + the entrance slot), polygonize it with marching
cubes / surface nets, then apply the existing displacement + strata + staining to *that* surface.

The room-graph layout logic — the good part, the part with the sibling-angle and clear-span fixes
baked in — **survives untouched**. Only the meshing layer is replaced. It also makes the D-1
crevice trivial: the entrance slot becomes one more SDF primitive unioned into the same surface,
so there is no weld seam between entrance and cave at all.

Cost to watch: marching cubes raises triangle count and generation time. That collides with the
preload/streaming item (D-4) and with "caves are common" — all three get budgeted together.

---

## D-3 — Reassess afterward, and sweep for anything else wrong
> *"need to fix both of those and reassess. then need to look for anything else that might look
> wrong."*

After D-1 and D-2 land, a full adversarial visual audit of the cave from **player-eye positions
throughout the whole tree** — not framed hero shots. Per the standing memory rules: multi-angle,
including grazing angles and looking back the way you came, and fresh critics rather than the
builder's self-assessment.

**This gets a machine gate, not just a review pass** — the project's driving lesson is that every
failure given a gate stopped recurring and every failure given only a prose rule came back. The
gate for D-2's whole class: from N sample points across every chamber and corridor, cast a sphere
of rays; **every ray must terminate on cave geometry** (or on a declared `intendedOpening`).
Any ray that escapes to the void or the sky is a see-through defect. Runs across multiple seeds.

---

## D-4 — Preload caves so they don't hitch the game when they load in
> *"will also need to preload the caves on the starting loading screen so it doesn't slow down the
> game as much when it loads in"*

Cave generation is heavy and gets heavier with the D-2 remesh. Two halves, because the origin cave
and the streamed caves are different problems:
- **Origin/egg cave** — generate during the boot loading screen, so it is resident before play.
- **Streamed caves** (the campaign is making caves a routine rocky-biome feature) — cannot be
  preloaded at boot; they need the existing S6 frame-budgeted slicing pattern (D296) extended to
  cave builds, plus the resident-interior cap. Covered by the `chunk-perf` gate.

---

## Process note
This report existing at all is the fix for the real miss: the 07-20 walk-test feedback lived only
in Zach's memory for four days while the docs recorded "feedback pending". Walk-test output gets
written down the same day from here on.
