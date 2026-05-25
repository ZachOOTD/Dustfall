# Session ABO — Kickoff Brief (post-ABN)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through ABN
3. `docs/changelog.md` — ABN entry at top
4. `docs/decisions.md` — D109 (procedural-shader localSpace opt) is
   the latest
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built (post-ABN snapshot)

69 sessions. Procgen wreck system at **5 classes** (corvette /
gunship / freighter / science_vessel / **bulk_hauler** — added ABN);
class roulette 35/20/18/12/15. megaWreck has aft hull-shell (ABL) +
**bow hull-shell** (ABN, half-cylinder preserving -X entrance).
Companion follows speeder in real time when player mounts (ABN bug
fix). Moving entities (companion, sandworm, lizard, speeder) have
**static-relative shader detail** via D109 `localSpace` opt — no
more crawling textures. Cloth + bandage viewmodels no longer expand
on movement (ABN `disableShimmer` opt). Dropped items have rigid-
body physics (ABM). SAVE_VERSION v11 unchanged through ABN.

## Suggested focus (pick one)

### Big-ticket (single session, 4-10h)

- **A1 infinite chunk streaming** (~6-10h). Last major architectural
  lift. Lazy 800m chunks at boundaries; free farthest; per-chunk seed
  derivation; GPU memory budget. Save bump v11→v12.
- **B8 generalized rope attachment (re-scoped)** (~4-5h). B7 (dropped
  item physics) shipped — items HAVE positions + bodies to act as
  rope anchors. Needs new UX path (no rope-stub on pickups) +
  gameplay decisions (can cloth pull a sled?) + data-model refactor
  splitting Tether into Endpoint pairs.

### Medium (~2-4h)

- **Migrate flagship modules into composite system** — retire the
  wrecks.ts procgen palette (engineBlock, crashedHull, etc.) into
  the bulk_hauler-style 5-class composite vocabulary. The procgen
  wreck system has now proven out across 5 classes; the legacy
  palette can be retired or kept for hand-tuned narrative POIs only.
- **megaWreck catwalk panel reachability (panels 3 + 4)** — 1-2
  more ground-level alternatives.

### Polish / quick wins (~30 min – 2h)

- **Identify + remove stale fire+cloth wreck POI** (deferred from
  ABN triage) — needs user to name the POI; then strip the content
  in 1-2 file edits.
- **Item viewmodel fidelity pass (continuation)** — ABJ shipped 5
  items; ~25 ItemDefs remaining could benefit.
- **Dropped-item playtest tune** — ABM defaults (damping 0.6/0.8,
  friction 0.85, density 0.6) need in-play signal.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars +
decisions.md realism dial (D45+, D49, D67, D86–D109), append a new
D-entry, keep going.

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic
block, destructive-action attempt.

## Notable footguns

- **ABN D109 localSpace pattern**: when adding a new procedural
  shader factory, expose `localSpace?` opt UP FRONT even if no
  current caller is a moving entity. Future-proofing one interface
  field beats refactoring after a "textures crawl" bug report. Same
  for any vertex displacement (`disableShimmer` precedent) — viewmodel
  callers need to suppress without forking the factory.
- **ABN bow shell theta**: bow uses HALF-cylinder
  (`thetaStart=0, thetaLength=Math.PI`) NOT full cylinder, so the
  open underside preserves the -X side entrance. If adding more shell
  geometry to other openings, audit theta direction first.
- **ABM dropped-item bodies**: only PLAYER-FACING drops use bodies
  (player drop / craft overflow / pickup-swap). Seed-spawn stays
  static (140+ branches at boot would burn Rapier step budget).
- **ABM save round-trip**: `droppedPickups` is additive on v11. If
  changing Pickup interface fields, audit save serialization.
- **ABK-tail pointer-lock guard**: `handoffToGame()` skips
  `controls.lock()` in DEV+hidden/0×0/!hasFocus preview tabs. Apply
  same guard if adding new lock-acquisition points.
- **ABJ D108**: combine multiple additive save fields into one bump.
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

## Begin block

Read CLAUDE.md (auto), session-end-report (through ABN), recent
changelog (ABN + ABM + ABL entries), decisions D107-D109. Pick focus
from the menu above. TaskCreate sub-tasks. Start coding.
