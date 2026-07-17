# Next cycle (2) — #29 Boneyard scatter overhaul (HERO visual)

**State:** campaign "Scavenger's Economy (setup)" `active` on `campaign/2026-07-17-economy`
(1 cycle done, ~0.4M/6M spent, max-cycles 16). Checkpoint = pause at the economy proposal.
Self-author = none. **Plan of record: `docs/campaign/plan-2026-07-17.md` — do NOT re-plan.**

## The fixed queue (in order)
1. ~~#28 Skyfall stern seam~~ ✅ SHIPPED (009ccca)
2. **#29 Boneyard scatter overhaul** ← THIS cycle (HERO visual)
3. Research swarm (4 digests)
4. Economy proposal → PAUSE

## Cycle 2 mission — #29 boneyard scatter overhaul
**Zach's feedback (verbatim):** "lets make all of the other bones match the same new darker texture
material we used for the larger skeleton. also i want to add more variation to the kinds of bones
and skeletons … these look totally outdated now … add the cracked bones, make them less of just
rounded rings in the sand and more like real bones … more variations on types of skeletons."

**What "the scatter" is:** the smaller bone props strewn around the boneyard biome, SEPARATE from
the colossal hero ribcage. It currently uses the OLDER lighter `_boneMat` + a ring-y `placeRibcage`
so the small skeletons read as rounded rings in the sand — outdated next to the redesigned hero.

**Files (verify against the code — it merged recently, names may have shifted):**
- `src/world/boneScatter.ts` — the scatter placement (the thing to overhaul).
- `src/world/giantRibcage.ts` — the HERO vocabulary to reuse: `jagProfile()` jagged caps,
  `layFallen()`, section wobble, the darker `_ribBone` material recipe.
- `src/world/boneMaterial.ts` — `createBoneMaterial(hex, opts)` (crackDensity/crackDepth/marrowHint/
  ageBleach/weathering) + `registerBoneEmissive(mat, hex, base)` + `updateBoneEmissiveDaylight(sunHeight)`.
  The hero ribcage uses ~`0xc9c5bc` with `emissive 0x494d52 @ 0.36`, DAYLIGHT-DRIVEN.

**Definition of Done:**
1. All scatter bones use the SAME darker hero bone material (match the ribcage's tone + weathering),
   and — critically — its emissive is DAYLIGHT-DRIVEN via `registerBoneEmissive` /
   `updateBoneEmissiveDaylight`. **The scatter must NOT glow at night** (this is the exact
   lighting-invariant bug that bit the hero bones + the worm; the scatter likely still opts out).
2. Real bone VARIETY replacing rounded rings: cracked/snapped long bones (femurs, jagged ends via
   the hero `jagProfile`), rib fragments, vertebrae, partial small skeletons — not just torus rings.
   Several distinct skeleton TYPES, not one repeated.
3. 100% collision matches the visible bones (rule 9) where they're substantial enough to block.
4. `verify:all` green.

## GATES — this is a HERO visual (rule 8 + the lighting-invariant lesson)
- **Do NOT ship on tsc alone.** Delegate to the `procedural-modeler` agent; iterate
  build→shoot→critique **5-8 rounds** against a quality bar ("reads as a real bone graveyard,
  released-game quality" — not "reads as bones").
- **ADD A DAY/NIGHT RENDER CHECK.** Two bugs (hero bones, worm) shipped because a constant was tuned
  by eye in daylight and opted out of lighting, with no gate covering that class. Shoot the scatter
  at BOTH day and night (there's a `bone-daynight` rig scenario — grep `scripts/rig-shot.mjs`) and
  confirm the scatter tracks the light level (no pale/glowing blobs at night). Make this a repeatable
  check if cheap.
- Shoot the PLAYER'S REAL IN-GAME VIEW in the real boneyard placement (use the `bone-field` /
  `boneyard` review hook — `__game.gotoBoneField` / the debug-panel button), multiple angles + the
  walk-under, close AND mid distance. Fresh-critic pass (N≥3, one adversarial).
- FRESH `--port=52xx` per rig run.

**Commit** to `campaign/2026-07-17-economy`. Push HELD.

## Hard rules
Never `git stash` here · ONE agent at a time · no AskUserQuestion overnight · trust the
playtest/day-night render over a green tsc.
