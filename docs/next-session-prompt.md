# Next cycle (24) — M12: a new far-field biome (LAST queued milestone)

**State:** campaign "Sharpen & Deepen" `active` on `campaign/2026-07-12-skyfall` (23 cycles, ~6.9M/8.75M
spent; **~1.85M left** of the +4M cap). Checkpoint none. **M7-R + M8 + M9 + M10 + M11 COMPLETE.** Queue: **M12** (last).

## Cycle 24 = M12 — a new far-field biome
A new biome beyond salt/rocky/dune/wreck_yard for the infinite world: distinct ground (colour/mottle),
palette, scatter (rocks/props), and a hazard or destination flavour. Study `src/world/biomes.ts` (the
`BiomeSampler` / `BiomeId` union / `biomeAt` / how biomes are sampled per-region + blended) and how the
terrain colours + scatter read the biome (terrain.ts vertex colours, chunkManager scatter rolls that
gate on `biomes.biomeAt`). Add a new `BiomeId` + its sampler region + ground/palette + scatter tuning +
(optional) a signature hazard/prop, weighting it into the biome field.

**`/feature-slice` it** (write `docs/feature-biome-m12.md` — the concept + the DoD + sub-tasks). A new
biome touches: the BiomeId union (+ every `Record<BiomeId, ...>` — ARCH_WEIGHTS, colour tables, etc. —
TypeScript will flag the exhaustiveness gaps, which is your checklist), descriptor purity (D290 — the
biome field must be pure), streamed-teardown-safety (D292), and the gates (verify:all, verify-chunks
determinism). Concept ideas: a **salt-crust / cracked-hardpan flat** (bright, mirror-flat, sparse — a
different desolation); an **ash/scorched barren** (dark volcanic-ash ground, charred props, a "something
burned through here" read); a **dune-sea / erg** (deep rolling dunes, near-empty, wind-sculpted). Pick
one that reads DISTINCT from the existing four + fits the Dune/Mad-Max tone. Real thickness (rule 7) +
no sand mounds (steering) for any new props.

Gate: verify:all (placement 5-seed + colliders — new biome bakes byte-safe) + verify-chunks (determinism
stable per seed, no leak, the new biome streams). The `chunk-vista` rig for the biome's look.

**⚠ BUDGET:** ~1.85M left — a new biome may not fully finish. Feature-slice it, do the CORE (the biome
exists + reads distinct + streams gate-clean) first; if the cap hits mid-way, the campaign stops at
`budget` (`status:"completed"`, `stop_reasons:["budget"]`) — the clean end of this overnight. Don't leave
a broken half-biome: each committed cycle must be gate-green. If M12 needs >1 cycle and the budget won't
cover it, ship a coherent minimal biome + note the polish for a future session.

## After M12 / at the budget cap — THE OVERNIGHT IS DONE
When `spend.total >= 8.75M`, set `status:"completed"`, `stop_reasons:["budget"]`, STOP the loop. Then
write a **morning summary** (`docs/campaign/morning-summary-2026-07-14.md`) covering the whole batch
(M7-R Skyfall fixes → M8 vultures → M9 archetypes → M10 vignettes → M11 tube retirement → M12 biome),
the owed walk-tests, and the cleanup (remove `scratch-baseline/`, `scripts/_vultcheck.mjs`,
`scripts/_scenecheck.mjs`). Reap dev servers. The branch awaits Zach's morning review + merge decision.

## Standing constraints (steering.md)
- **models-need-thickness** (rule 7) · **100% collision** (rule 9, swept) · determinism (D290) +
  streamed-teardown (D292/rule 9, NO body leaks) · no save-schema change without the D81 pause · GPU probe default.
