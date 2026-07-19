# Morning summary — 2026-07-19 (The Deep Desert: BUILD COMPLETE, paused for your review)

The overnight ran cycles 7-8 after your bedtime sign-off; the full ladder is done. Branch
`campaign/2026-07-18-deep-desert`, ~2.5M/6M spent, 8 cycles. **Push HELD; sled flag OFF.**
The dev server config `dustfall-sled` (port 5180) bakes the flag ON for your testing.

## What the campaign built (all committed, all gates green)
1. **The mega dune-sea (erg) biome** — rare multi-km regions (nearest ~5-10km by seed), 45-58m
   dunes at 220-320m wavelength, walkable windward faces (p95 ≤28°), sleddable slip faces
   (~30-34°), seamless border blend, clean aeolian sand read (the crack texture no longer climbs
   dunes), deterministic + perf-green. Permanent `dune-slope` gate. `__game.gotoErg()` warps you.
2. **The ridable sled** — E mount / JUMP dismount, kneeling pose, gravity descent hitting ~2.4×
   sprint on a slip face with sub-stepped surface follow (≤6cm gap at 32 m/s), carve steering
   (A/D — **your inversion catch is fixed**, and the gate now asserts direction), uphill stall,
   coast-out, sand kick-up, speed-FOV rush, procedural sand-hiss. `sled-ride` + `sled-dune`
   probes green ×2 seeds.
3. **Overnight dressing (cycle 7)** — the erg is a place now:
   - **Crest smoke**: surface-hugging spindrift streaming off dune lips along the per-erg wind,
     scaling with weather; sun-scaled so it does NOT glow at night; ~zero frame cost.
   - **Trough finds**: rare half-buried wreck shards / bone bits / lone dead trees on true trough
     floors (0.08-0.125 per trough — near-empty by design), descriptor-pure.
   - **The hush**: ambience ducks to a low sand-sigh inside ergs, smooth border crossfade.
   - **First-crest moment**: one-time "the deep desert" toast + a warm audio swell, save-persisted.
4. **Integration proof**: the sled-dune probe re-run with smoke + dressing live — all phases pass.

## Parked questions (answer whenever; defaults are fine)
1. **Music duck in the erg** (the wind bed is muted per your 2026-07-07 call, so the hush ducks
   the music pad ~36%). Keep, or set `ERG_HUSH_MUSIC_DUCK: 0` to leave the score full?
2. **Trough find frequency** — deliberately sparse (6-9 per whole erg). `ERG_DRESS_CHANCE` bumps it.
3. **Wreck-shard collision** — shards/bone bits are walk-through (matches the scatter rule); only
   dead trees collide. Want shards solid?
4. Sled feel tweaks you mentioned — all data (`SLED_RIDE_*`).

## Your review loop (server: preview `dustfall-sled`, port 5180)
`__game.gotoErg()` → walk a windward face up → the first-crest moment fires → check the crest
smoke + the hush → `__game.spawnSled()` → drop a slip face (A/D now correct) → find a trough
dressing piece on the way out. Storm during any of it = free bonus test.

## After your OK
Flag flip (`FEATURES.rideableSled` default ON) + merge to master + deploy = one short attended
session. Remaining roadmap after this campaign: the cave system (needs the 10-min attended D254
KCC spike — script in `docs/research/cave-feasibility.md`) → character/MP (digests ready; needs
the GDD re-anchor).
