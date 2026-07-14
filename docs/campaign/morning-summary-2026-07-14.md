# Morning summary — 2026-07-14

**The overnight "Sharpen & Deepen" batch is COMPLETE.** The whole queue you set
before bed (M7-R → M8 → M9 → M10 → M11 → M12) shipped — 11 cycles (14–24), each
gate-green, each a single revertible commit, **all under the 4M budget you set**
(~2.6M spent this batch; campaign total ~7.25M against the 8.75M safety cap).

Branch `campaign/2026-07-12-skyfall` — **nothing pushed, nothing merged.** It's
all sitting locally for your review. Campaign status: `completed` (until-met —
the queue emptied), not budget-capped.

---

## What shipped

### M7-R — Skyfall refinement (your 6 walk-test fixes) — cycles 14–17
Every point from your feedback:
1. **No more paper-thin hull.** The whole exterior hull was a double-sided
   zero-thickness shell — rebuilt with real thickness (`HULL_THICK` 0.7m,
   fractured rim caps, single-sided void interior). Generalized into **CLAUDE.md
   rule 7** (no paper-thin double-sided models anywhere).
2. **Floating-model audit.** Swept the interior — panels now sit flush on the
   wall surface, no floaters.
3. **100% collision.** Added the missing **dorsal container colliders** (you
   could walk through the containers on top) + swept the whole interior collider
   set against the visible geometry (rule 9).
4. **More interior detail.**
5. **Broken cockpit glass** — a shattered canopy in the freighter's fore, in the
   intro-ship style.
6. **Captain's log** — a 5-entry drop-pod-evac story (`generateSkyfallLog`): the
   crew ejecting in the pods, the captain alone at the helm as the recorder ends.

### M8 — Far-field vultures — cycle 18
Circling vultures now wheel over the streamed far field (6 aloft), spawned per
chunk, torn down with no body leak. The infinite world has aerial life.

### M9 — 3 new POI archetypes — cycles 19–21
`refinery_stack` (cracking-tower ruin), `hab_dome` (collapsed habitat domes),
`transit_car` (derailed rail car) — new streamed far-field destinations, each
real-thickness + gate-verified collision.

### M10 — 3 new story vignettes — cycle 22
Cold camp, stripped vehicle, the abandoned cache (+ 4 new props) — the mid-field
wordless storytelling went from 2 scenes to 5.

### M11 — Retire legacy tube-wrecks — cycle 23
The old "long tube" ship wrecks are gone from world-gen — **0 of 278** far-field
POIs are tubes now, by construction (folded the weight into the socket-built
`derelict`; the low-risk endpoint of the strategy, not the rewrite that was
rejected twice before).

### M12 — A new biome — cycle 24
`ash_barren` — a rare regional scorched-flats zone (dark charred ground, a low
flatten, a burned-industrial wreck mix) far out in the world. Distinct from the
existing desert.

---

## What needs YOU (walk-tests — headless can't judge feel)

These are the honest owed items — appearance/gates are verified, **feel is not**:

1. **Skyfall walk-test (the big one).** Walk the refined freighter: the hull
   thickness, the flush panels, standing ON the dorsal containers (new collision),
   the broken cockpit glass, reading the captain's log. Scale/lighting feel.
   - **Cabin lighting is your call:** `SKYFALL_CABIN_FILL` (currently 1.05, lit).
     If you want it moodier, drop it toward ~0.4; revert to taste.
2. **Ash-barren biome — a possible polish note.** The dark scorched ground reads
   distinct but is on the subtle side in dawn light. If you want it more dramatic
   (darker core / charred scatter props / a signature hazard), say so — it's a
   clean tuning follow-up, I deliberately shipped the coherent core rather than
   over-polishing at 5am.
3. Vultures, new POIs, new vignettes — worth a fly-by for feel, but low-risk.

## Housekeeping
- Untracked probe litter left in the tree (the overnight reversible-action guard
  blocked me from `rm`-ing them): `scratch-baseline/`, `scripts/_vultcheck.mjs`,
  `scripts/_scenecheck.mjs`. Safe to delete — none are referenced by anything.
- The released origin world is byte-identical throughout (every biome/POI change
  is far-field or additive; the wreck-yard seed was appended, not reordered).
- Desktop `.exe` is still pre-procgen — rebuild (`npm run tauri:build`) when you
  want a fresh installable.

## To ship it
Review the branch, then merge to `master` + redeploy GH-Pages when happy. Or
steer: drop a note in `docs/campaign/steering.md` and `/campaign-start --resume`
if you want more cycles (the cap has ~1.5M headroom).
