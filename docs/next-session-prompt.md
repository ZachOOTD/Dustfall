# Next session — Mega-wreck FROM-SCRATCH rebuild (sleek dagger + new narrow interior)

**Direction (user, ACAJ cont.):** the wide-cargo-bay mega-wreck is being **reworked from
scratch**. Go for a **sleek narrow DAGGER** exterior (≈5:1, ~24m beam) + a **brand-new narrow
walkable INTERIOR** (a spinal corridor through 6 chambers to a bridge payoff). The old wide
interior is discarded. **Research is done** — build to the concept.

**THE SPEC (read first):** [docs/research/megawreck-concept.md](research/megawreck-concept.md)
— full unified concept: exact local-Z coordinates, the 6-room interior layout, the
collision/interactables plan, a tiered **T0–T8 build order**, and a **16-point harsh
exterior+interior rubric**. Companion: [docs/research/megawreck-anatomy.md](research/megawreck-anatomy.md)
(exterior detail spec + greebling rules).

**Why from scratch:** the exterior + interior are *coupled* — a narrow dagger only works once
the interior is narrowed too (the shell must envelop the interior boxes). So it's one coherent
rewrite of `src/world/megaWreck.ts` (`makeMegaWreck` geometry + `placeMegaWreck` colliders/
shelter/2-panels/journal), NOT an incremental patch. Keep the game walkable at each committed
checkpoint (don't commit a broken-interior half-state).

**Build order (each tier: build → `megawreck` rig-shot → critique → iterate 3–8 rounds; tsc is
NOT the visual success gate, rule 8):**
- **T0** new local-Z layout constants (spine half-dims, 6 room Z-centers/footprints, fracture Z,
  island Z) + stub `makeMegaWreck`.
- **T1** dagger exterior: `makeLoftedHull` bow + aft masses (sharp nose, blunt transom, ~5:1),
  tilt+sink the `shell`.
- **T2** mid-hull fracture cross-section (backboard + `makeFormerRings` ×2 faces + staggered deck
  slabs + bent spine stub + `makeCable` danglers + `makeBreach` rims + 2–4m vertical offset).
- **T3** interior spine corridor (3.5×3m, kinks, bulkhead `panelWithHole` doorways) + R1/R2/R4/R5
  rooms + ALL cuboid colliders + the fracture-crossing ramp → **walk it end-to-end in-app**.
- **T4** bridge payoff (R6 raised platform + stair + console + raked viewport) + register shelter
  zone (pocket off R5), 2 salvage panels (R4 + R6), journal (R6 console).
- **T5** light shafts + `PointLight`s at each beat (entrance, flank tears, fracture daylight,
  bridge skylight) + red engine-room tint + interior haze.
- **T6** burial: `makeSandMound` lee-flank drifts + buried bow mound + nose scorch + debris.
- **T7** surface greeble + asymmetry (dense 1–2m plating/strakes, one-flank damage).
- **(T8, never-cut perf)** `mergeGeometries` static shell+interior by material (panels/colliders
  separate); measure via `perf-probe`.

**Reusable iteration harness (built this session — USE IT):**
- `megawreck-research` / `megawreck-interior-research` workflows (web research → spec).
- `megawreck-critique` workflow — **4 adversarial critics READ the actual rig-shot PNGs** + score
  against the rubric + rank weaknesses. Re-run it each tier (`scriptPath` re-invoke) to stay
  honest. Scripts under `…/workflows/scripts/`.
- `megawreck` rig-shot angles: `side`/`3q`/`hero`/`front`/`rear`/`interior`; bright midday + a
  raking key light already wired.

**Save discipline (D81):** geometry/material only → no `SAVE_VERSION` bump expected (colliders/
panels/shelter rebuild from seed; transient state re-derives). Surface if a save field turns out
necessary (unlikely).

**Deferred (unchanged):** the procgen fleet vocabulary level-up + half-burial + greeble + WebGL
perf merge (old ACAJ T3–T7) now ride on the new `wreckForms` toolkit AFTER the hero dagger lands.
The raider proc-character + all rig-dependent work stays DEFERRED.

---

## What shipped this session (ACAJ cont. — mega-wreck quality push)

The user flagged the first mega-wreck rebuild as shipped-too-early / low-quality. This session:
1. **Research** — 6-facet workflow → `docs/research/megawreck-anatomy.md` (exterior build spec +
   12-pt rubric).
2. **Ground-up exterior rework** — `makeLoftedHull` (NEW faceted ship-hull cross-section, replaces
   the smooth-lathe "lump"); the whole exterior in a `shell` group tilted into a **list** + sunk;
   dagger taper + raked roofline; real fracture cross-section (decks/ribs/spine/cables); stepped
   command island + sensor mast; engine cage; asymmetric breaches; `makeSandMound` half-burial +
   debris + scorch; hull plating strakes. Commits `03e8ddd` (+ `6c3fe99` earlier T1/T2).
3. **Adversarial critique harness** — `megawreck-critique` workflow (4 critics read the renders).
   Honest trajectory: **2.75 → 3.0** on the prior wide-hull — improving but capped by the
   wide-cavity-vs-dagger tension.
4. **Decision (user)** — narrow it, rework the interior from scratch → the **dagger + new interior
   concept** (`docs/research/megawreck-concept.md`, commit `08687fd`). **Build = next.**

Toolkit added to `wreckForms.ts`: `makeLoftedHull`, `dentGeometry`, `makeCable` (+ existing
`makeLatheHull`/`makeFormerRings`/`makeBreach`/`makeSandMound`).
