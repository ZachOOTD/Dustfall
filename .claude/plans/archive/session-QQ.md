# Session QQ — Raider variants + bring raiders back

## Why now
PP just shipped 3 new weapons + a generalized combat dispatcher. The
weapons land in a world where the only real combat targets are
lizards (trivial), the sandworm (single boss arena), and raiders
(coded but DON'T spawn — Session U "lone survivor" decision).
With combat infra freshly proven, this is the natural moment to
reintroduce raiders **with variety** so the new weapons have varied
targets. The roadmap's #1 entry is exactly this.

## Scope (this session)

**1. Variants — 3 archetypes** (drop the `_if we decide to bring raiders back_`
hedge by spawning them in a way that respects the lone-survivor tone:
clustered around hostile procgen POIs, not roaming everywhere):

- **`scout`** — fast (~5.5 m/s run), low HP (0.6), longer sight (~40m),
  retreats when hit instead of attacking through stagger.
  Primitive visual: lean, lighter cloak tint, normal scale.
- **`brute`** — slow (~3.0 m/s run), high HP (3.0), heavier attack
  damage + larger attack range. Primitive visual: scale 1.2, darker
  cloak, wider geometry.
- **`ambusher`** — medium HP (1.5), wields a scrap_gun (ranged
  raycast attack from ~18m), tries to maintain distance instead of
  closing. Visual: hood up, gun model on the arm pivot in place of
  the machete blade.

The existing default raider stays as the **`melee`** variant (no
change to current stats — those are the baseline).

**2. Spawn wiring** — opt-in encounters, not ambient threat. Pick
~3 procgen wreck POIs at world boot (filtered by distance from
player spawn ≥ 80m) and seed 1–2 raiders per chosen POI. Variants
mix per POI. Total raider count cap = 6. Lizard spawn pattern is
the template (`spawnLizardsProcgen`).

**3. Variant-aware AI** — in `updateRaiders()`:
- `scout`: faster RUN_SPEED, longer SIGHT_DISTANCE, on stagger → set
  patrol target away from player + transition back to patrol
  ("hit-and-run" feel)
- `brute`: slower, more attack damage, melee-only
- `ambusher`: ranged attack via raycast (no contact required);
  maintains a preferred distance band (8–18m) — flees when too
  close, closes when too far

**4. Drops** — variant-keyed loot via the existing salvageable /
inventory-toast pattern. Provisional:
- scout drops `cloth` + occasionally `scrap`
- brute drops `scrap` x2 + occasionally `machete`
- ambusher drops `scrap` + occasionally `scrap_bullet` x2

**5. Save format** — `SAVE_VERSION 4 → 5`. `raiders` entry gains
`variant: RaiderVariant`. Old saves default missing variants to
`'melee'`.

**6. Tuning constants** for everything (stats per variant, spawn
counts, distance bands, drop chances).

## Out of scope
- Quaternius rigged variants (deferred with N's GLB work)
- Raider speech / barks
- Squad coordination / multi-raider tactics
- Faction system
- Night-only raider spawns

## Files I'll touch
- `src/enemies/raider.ts` — variant field, spec-driven stats, ranged
  attack path, variant visuals
- `src/main.ts` — replace empty `raiders: Raider[] = []` with
  procgen spawn loop
- `src/config/tuning.ts` — RAIDER_* constants
- `src/persistence/save.ts` — bump SAVE_VERSION, add variant field
- Maybe `src/player/combat.ts` — verify dispatchHit still works
  cleanly with the variant-keyed drops

## Acceptance
- tsc clean
- ~6 raiders spawn at boot across procgen POIs, distributed across 3
  variants
- Each variant has visibly distinct stats in-game (verified via
  preview console probes for state + position over time, plus a
  screenshot showing the variant visuals)
- Drops trigger on kill (inventory toast confirms)
- Save → kill one → reload restores correct variant + state
