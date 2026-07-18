# Scavenger's Economy — build complete, walk-test guide (2026-07-18)

All 4 build cycles landed on `campaign/2026-07-17-economy` (push still held). Every gate green:
tsc · verify:loot (digest baseline) · placement 5/5 · colliders 70 · chunks (determinism ×2,
streaming, perf, both walk gates) · craft-unlock probe · material-probe.

## What's in the game now
- **4 materials** — `metal_pipe` · `machine_part` · `wiring` · `battery` — with distinct pickup
  meshes + hotbar icons, dropping by POI identity (pipes at pipelines/refineries, machine parts
  at tanks/crawlers, wiring+batteries at satellites/relays/habs/pods, hero wrecks richest).
- **3 newly craftable existing items**: pipe staff · scrap gun · worm-lure (battery + wiring +
  ANY raw meat — a powered thumper).
- **7 updated recipes** now cost identity materials (flashlight, lantern, sled, grill, locker,
  stake, spyglass). Tutorial arc (bandage/fire/tent/torch/rope) untouched.
- **Recipe cards teach the map**: missing materials show where they live ("BATTERY — found in
  pods, habs and relays"). Discovery toasts announce new recipes on first pickup.
- **One data-driven loot registry** behind it all (`src/config/lootRegistry.ts`) with a
  1000-roll digest gate (`npm run verify:loot`) so future loot edits can't drift silently.
- Cleanup: cactus_pulp grant paths removed (dead since alien-only cacti); ids kept for save-compat.

## Balance (analytic, from the shipped tables)
Expected yield per visit: pipeline/refinery/transit ≈ 1.7-1.8 pipes · tank/crawler ≈ 1.8 machine
parts · satellite/relay/hab ≈ 1.8 wiring + 0.45 battery · escape-pod panels 0.45 wiring/0.28
battery · containers ~0.10-0.14 each. **Battery is deliberately the scarcest** (gates flashlight/
lantern/worm-lure); pipes are the workhorse (5 recipes want one). This matches the "only 1-2
truly scarce" design target.

## Walk-test questions (the feel only you can judge)
1. **Does scavenging feel differentiated?** Walk a pipeline, a tank, a relay: do the ground
   pickups telegraph identity before you pry a panel?
2. **Flashlight progression**: it now needs battery+wiring (was scrap+cloth) — torch is the
   early light by design. Does the first night feel right or too harsh?
3. **Worm-lure craft loop**: hunt meat → relay for battery/wiring → craft → plant. Worth the trip?
4. **Pickup read**: do the 4 material silhouettes read at a glance on the sand (incl. at dusk)?
5. **Panel yields**: do salvage panels feel noticeably richer at heroes (Skyfall/leviathan)?

## Carried from before (still owed)
Storm wind loudness + wash-over feel · leviathan drift climb + aft console light · sprint toggle
feel · POI density · boneyard walk-under + night no-glow check · Skyfall stern seam grazing look.

## After the walk-test
Say "ship it" → merge to master + auto-deploy. Tuning tweaks from the walk-test are data edits
in `lootRegistry.ts` / `recipeDiscovery.ts` (fast turnaround; digest baseline regenerates with
`node scripts/verify-loot-digest.mjs --update`).
