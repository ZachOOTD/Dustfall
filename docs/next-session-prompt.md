# Session ABP — Kickoff Brief (post-ABO)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through ABO
3. `docs/changelog.md` — ABO entry at top (substantial — 7 items)
4. `docs/decisions.md` — D110 (3P camera architecture) is the latest
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built (post-ABO snapshot)

70 sessions. **NEW**: player has a visible rigged body (procedural
primitive rig — capsule torso + sphere head + 4 limb pivots with
hand-coded walk cycle); **F-key toggles 3rd-person camera** (2.5m
behind + 1.5m above, no spring-arm collision yet). Sandworm has an
'ambush' state (silent submerged → snap to lunge within 12m) +
dawn/dusk surfacing modifier (×1.30 detection in twilight). engineBlock
flagship is now a COMPOSITE procgen wreck (flagship_engineBlock fixed-
recipe class) — first POC migration off the hand-modeled wrecks. Plus
4 polish items (scavenger camp stripped; engine heat-shield back panel;
dish backing framework + collision; 6 cooked-meat + kit viewmodel
upgrades). B1 generalized rope CUT from ABO — deferred to ABP.

## Suggested focus (pick one)

### Big-ticket (single session, 4-10h)

- **A1 infinite chunk streaming** (~6-10h). Last major architectural
  lift. Lazy 800m chunks at boundaries; free farthest; per-chunk seed
  derivation; GPU memory budget. Save bump v11→v12.
- **B1 generalized rope attachment (re-scoped)** (~4-5h). Pre-committed
  ABO cut #1. RopeEndpoint union + Tether{endpointA, endpointB} +
  resolveEndpointWorldPos helper (lift getPlayerPos to util/) + RMB-
  on-item two-stage UX + additive save migration. Full plan still in
  the ABO plan file.

### Medium (~2-5h)

- **Migrate remaining 4 flagships to composite procgen** (~6-8h) — if
  the ABO B6 engineBlock POC reads well in playtest, sweep megaShip /
  megaWreck / satelliteDish / crashedHull using the same
  `flagship_<kind>` fixed-recipe pattern. Risk: each one has a unique
  silhouette that may need new vocabulary parts (satelliteDish dish
  silhouette, megaShip interior + shelter, etc.).
- **B5 flagship NPC beats** (~4-6h) — hostile raider holdouts + friendly
  hermits at hand-modeled flagships. From the Archive section
  (parked 2026-05-24 — unparkable if appetite exists).
- **3P camera spring-arm collision** (~1-2h) — ABO debt. Raycast from
  player head toward intended camera position; clamp to first hit.

### Polish / quick wins (~30 min – 2h)

- **Item viewmodel pass remainder** — ~19 ItemDefs at primitive
  complexity. Suggested next batch: large_tent_kit, bedroll_kit,
  lantern_kit.
- **B3 retreat-stalk loop** (~1h) — extension to ABO B3. tickRetreat
  optionally re-enters 'alert' at retreat-end if player still close.
- **Dropped-item playtest tune** — ABM defaults need in-play signal.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars +
decisions.md realism dial (D45+, D49, D67, D86–D110), append a new
D-entry, keep going.

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic
block, destructive-action attempt.

## Notable footguns

- **ABO D110 single-camera arch**: 3P camera reuses the FP camera
  with a position offset; PointerLockControls owns yaw+pitch on the
  shared camera. If adding a new camera mode (free-cam, photo), follow
  the same branch-in-syncCameraToBody pattern — DO NOT introduce a
  second THREE.PerspectiveCamera.
- **ABO A3 player rig localSpace**: `createSkinMaterial` calls in
  `playerRig.ts` use `localSpace: true` per D109. If forking a new
  creature with similar code, MUST keep localSpace=true for moving
  entities (else texture-crawl).
- **ABO B6 reversibility**: `engineBlock.ts` kept on disk; `poi.ts`
  has commented `placeEngineBlock` import + replaced dispatch line.
  Revert one line + uncomment import to restore hand-modeled.
- **ABN D109 localSpace pattern**: applies to skinMaterial +
  paintMaterial. fabricMaterial has the sibling `disableShimmer` opt
  for viewmodels.
- **ABM dropped-item bodies**: only PLAYER-FACING drops use bodies.
  Seed-spawn stays static (Rapier step budget).
- **ABK-tail pointer-lock guard**: `handoffToGame()` skips
  `controls.lock()` in DEV+hidden/0×0/!hasFocus preview tabs. F-key
  3P toggle DOES NOT change pointer-lock state.
- **Preview screenshot rule**: `ctx.time.dayTime = 0.5` + unpause
  briefly before screenshots.

## Verification protocol

```
npm run verify     # = tsc --noEmit
npx vite build     # production-build sanity
```

For substantial features:
1. Boot game, exercise the feature.
2. Save + reload roundtrip if persisted state changed.
3. Multi-seed sanity if the change touches world generation.

For ABO-specific playtest:
- F-key toggle from FP → 3P, confirm rig visible + viewmodel hidden.
- Walk around in 3P — confirm walk cycle visible, body shadow casts.
- Mount speeder in 3P — rig should follow (parented to body via
  per-frame translation).
- Inspect engine_block POI on seeds 12345 + 7777 — confirm new
  composite silhouette + journal still readable + 3 salvage panels.

## Begin block

Read CLAUDE.md (auto), session-end-report (through ABO), recent
changelog (ABO + ABN + ABM entries), decisions D108-D110. Pick focus
from the menu above. TaskCreate sub-tasks. Start coding.
