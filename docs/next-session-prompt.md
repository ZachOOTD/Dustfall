# ▶ CAMPAIGN cycle 58 — Kickoff Brief — `campaign/2026-06-18`

**Phase B FINAL tier. M6 ✓ · M7 ✓ · M8 ✓ · M9 ✓ · M10 underway (⑭ scrap-machete ✓ C57). Now ⑮ craftable-hover-bike.**
**M10 = ⑭ ✓ · ⑮ (this) · ⑰ pickup-instancing. ⑯ drop-pod-intro is DEFERRED (user steering). After ⑰ → the Phase-B milestone pause (the big Phase-A/B feedback + walk-test).**
Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md`. The loop commits every cycle. Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` + `docs/campaign/campaign-log.md` (the C57 entry + the C56→C57 approve boundary).
3. `docs/decisions.md` tail — D261 (⑭ machete), D257 (the rideable-sled spike — relevant: the speeder's ride/mount pattern), D81 (NEVER bump SAVE_VERSION).
4. `src/world/speeder.ts` (the existing vehicle — the hover-bike IS the speeder; recon how it spawns / is ridden / its state) + `src/inventory/recipeDiscovery.ts` (the recipe pattern, last id 19) + `src/inventory/items.ts` (item-def pattern, esp. any `*_kit` deploy items).

## What ⑭ landed (C57)
NEW `scrap_machete` craftable pry tool (recipe id 19, scrap×2+cloth×1) — pries panels alongside `scrap_bar`; crude-bolo viewmodel. D261. The found `machete` stays the melee blade.

## Cycle 58 focus — **M10 ⑮ craftable-hover-bike (repairable-speeder)**
Design call (Phase-B proposal): **"hover-bike = repairable-speeder"** — ONE vehicle, TWO states. The speeder spawns/exists **broken** and the player **repairs it** (with scrap + the tools) into a working hover-bike. NOT a second vehicle — reuse `speeder.ts`.

### Priority items (in order)
1. **Recon FIRST (cheap, decides scope).** Read `speeder.ts`: how the speeder is spawned (a world POI? a deploy item? already in the opening scene?), how it's ridden/mounted, and whether it ALREADY has any "broken/disabled" state or condition field. Decide the repair mechanic: likely a `broken` flag on the speeder + a repair interaction (E with scrap/parts, or feed it N `scrap`/a new part item) that flips it to `working`. **Confirm D81:** if the speeder's broken/working state must persist across save/load, it needs a save field — that is a SAVE-VERSION concern. Prefer an ADDITIVE optional field (default = the existing behaviour for old saves) so NO version bump (like C52's `companionAcquired?`). If you cannot avoid a bump, STOP + surface.
2. **Broken state + repair interaction.** Spawn the speeder broken (visually: drooped/dead, no hover glow, maybe a missing-panel look — reuse wreck/dead-material idioms); a repair interaction (E, gated on having the parts) that plays a beat + flips it to working (hover restored, rideable). Keep it bounded — one repair step, not a multi-part minigame (that can be a follow-up).
3. **Recipe / parts** — if repair consumes a craftable part, add it (recipe id 20) following the id-19 pattern; or consume raw `scrap`. Keep the input multiset free (avoid the collision-chooser unless intended).
4. **Verify** — `npm run verify:all` green. If you added a save field, confirm it's additive + load-defaults cleanly (a save-roundtrip probe like C52's `crashRoundtrip` if one fits).
5. **Visual/feel** — the broken→repaired LOOK gets a render pass (the speeder studio rig if one exists; else a world shot). The repair FEEL + the ride → walk-test at the Phase-B milestone.

### CRITICAL — stop conditions
- **D81 SAVE BUMP = STOP.** The broken/working state is the likely trap. Make it additive-optional; never bump SAVE_VERSION autonomously.
- **Reuse the speeder, don't fork a new vehicle** (the design call is explicit: one vehicle, two states).
- **Scope:** if the full repair mechanic + the broken art can't fit one cycle, ship `[partial]` (e.g. the broken state + repair flag this cycle, the art/feel polish next) rather than an unbounded build.

### After ⑮
⑰ pickup-instancedmesh (perf — human-attended; the LAST M10 unit). Then **the Phase-B milestone pause** — the user gives ALL their held Phase-A/B feedback + walk-tests everything. Do NOT start anything past ⑰ autonomously.

## Autonomy contract
Reuse `speeder.ts`. Additive save only (D81 STOP on a bump). `[partial]` is fine if the cycle won't fit. Recon the speeder's spawn/ride/state BEFORE building. Render the broken→repaired look; the feel → walk-test.

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify break · 3 fix-walls on one gate · **save-version bump (STOP)** · destructive attempt. Pause: steering "pause" · the Phase-B milestone (after M10 = after ⑰).

## Notable footguns
- **The speeder's broken/working state + save** is the D81 trap — additive-optional field, default to current behaviour for old saves.
- **One vehicle, two states** — don't build a second vehicle.
- `verify:placement` buffers output to the END + is slow; don't kill it early.
- The dev item spawner (DEV badge / backquote) auto-lists new items via `ALL_REGISTERED_ITEM_IDS`.

## Verification protocol
`npm run verify:all` + (if a save field is added) a roundtrip probe. The broken→repaired LOOK via a render; the repair/ride FEEL → walk-test.

## Begin
Read the order → recon `speeder.ts` (spawn/ride/state) + confirm the save approach (D81) → `TaskCreate` the broken-state + repair → build (reuse the speeder) → render the look → `verify:all` → `/session-end`. `[partial]` ok. Boot fresh from FILES.
