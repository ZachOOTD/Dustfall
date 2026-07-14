# Next cycle — M7-R Skyfall refinement (start of the +4M overnight batch)

**State:** campaign "Sharpen & Deepen" `active` on `campaign/2026-07-12-skyfall` (13 cycles done,
~4.75M spent; overnight cap 8.75M = +4M). Checkpoint none — run the queue overnight, Zach reviews
the batch in the morning. Queue (priority order): **M7-R → M8 → M9 → M10 → M11 → M12**.

## Cycle 14 = M7-R Skyfall refinement — spec: `docs/feature-skyfall.md` (M7-R section)
Six fixes from Zach's walk-test, priority order:
1. **Real hull thickness** — the exterior reads paper-thin double-sided; rebuild as a THICK
   solid (torn edges show a wall cross-section). Audit ALL Skyfall geometry for zero-thickness
   double-sided shells → solids. **This is the headline fix.** When it lands, add the standing
   rule to CLAUDE.md (models get real thickness; extends rule 7).
2. **Floating-model audit** — every interior panel/prop flush on its surface, nothing floating.
3. **100% collision** — the dorsal cargo containers have none; sweep the whole wreck (rule 9).
4. **More interior detail.**
5. **Broken cockpit glass** — a shattered canopy on the bridge (intro-ship `_glass` vocabulary).
6. **Captain's log story** — crew ejected in the drop pods; bespoke journal content (crashLog.ts).

Likely > 1 cycle — feature-slice it (thickness+collision first, then glass, then detail+log).
Gates: verify:all (verify:colliders for the new colliders + skyfall-walk still PASS) + 5 smokes +
adversarial visual gate (HERO bar) for thickness/glass/interior + the loot/journal probe.
Deterministic digest may shift (geometry) but must stay STABLE per seed.

## Then the world-deepening queue (each its own feature-slice when reached)
- **M8 far-field vultures** — aerial life for the infinite world (region-rolled perch/placement
  rework; the D294 chunk-model tension is the thing to solve). Backlog §A.
- **M9 new POI archetypes** — 2-3 new far-field destination types (M6-style: gate-verified,
  placement + collider gates, adversarial visual gate). No save bump.
- **M10 more story vignettes** — expand the wordless `buildWordlessTableau` tableaus (environmental
  storytelling; the "world tells you what happened by what's left" pillar). No text.
- **M11 retire legacy tube-wrecks** — the owed ship->socket migration (D227/D249) so no wreck
  reads as a plain tube. Systems cleanup + visual lift.
- **M12 new far-field biome** — a new biome beyond salt/rocky/wreck-yard (ground/palette/scatter/
  hazards). Descriptor-pure (D290), streamed-teardown-safe (rule 9), gate it.

## Standing constraints (steering.md)
- **models-need-thickness** (no paper-thin double-sided). **100% collision** (rule 9, swept).
- Probe rig is GPU-default now (~10x faster; `RIG_GL=swiftshader` reverts). Never reap while a
  probe is live. Determinism law (D290) + streamed-teardown (D292/rule 9) for all far-field content.
- No save-schema changes without the sanctioned pause (D81).
