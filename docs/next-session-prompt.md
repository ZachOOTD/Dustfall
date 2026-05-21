# Session AAB — World depth (god-rays + salvage diff)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through AAA
3. `docs/changelog.md` — read the most recent 4 entries (XX, YY, ZZ, AAA)
4. `docs/decisions.md` — D73-D81 are the recent overnight-era entries
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built

28 sessions. UU-ZZ shipped the overnight era (control scheme + RMB + HUD
polish + larger enterable tent + perceivedIntensity split). AAA shipped
the first-impression polish bundle (E-take reverted, ghost preview for
LMB-place, vignette threshold lowered, recipe book panel, crosshair
.dead state). Codebase is in excellent shape — tsc clean, 0 `as any`,
save schema v7.

## Session AAB focus

**World depth — two complementary improvements** (~2-3h total):

1. **Skylight god-rays for the opening wreck.** The 30° stress-fracture
   slice gap in the opening wreck (Session RR) admits real sunlight via
   the omitted lathe slices, but without atmospheric dust scattering the
   interior beam isn't visually dramatic. Add additive cone geometry
   from the gap downward (or screen-space god-ray pass) to sell the
   "shaft of light cutting through dust into the wreck interior" feel.

2. **Salvage yield differentiation by wreck kind.** Currently all
   salvageable panels roll from similar loot tables. Differentiate by
   `kind`: engine_block-heavy in scrap, fuselage-heavy in cloth/scrap,
   antenna/satellite in rope+wire. Drives real player choice — "I need
   rope so I'll strip the antenna over there" instead of strip-anything-
   nearby.

## Priority items (in order)

1. **Salvage yield differentiation** (~1-1.5h — start here, lower risk).
   - Read `src/world/salvage.ts` — find `rollWreckLoot(kind, rng)`. It
     already takes a `kind` argument but probably has a single
     loot table.
   - Per-kind tables: `engine_block` (scrap×3-4, occasional pipe-staff
     parts), `fuselage` (cloth×2-3 + scrap×1-2), `antenna` (rope×0-1,
     scrap×1-2, rare wire), `crashed_hull` (mix — generalist),
     `wreck` (mix — generalist). Tune the weights so each kind FEELS
     different — players notice "the engine block always has scrap" vs.
     "the antenna sometimes has rope".
   - Acceptance: stripping 5+ panels of each kind in the preview tab,
     yields skew per kind as designed. Toast feedback already shows
     what was salvaged.

2. **Skylight god-rays** (~1.5-2h — higher risk; visual iteration).
   - Read `src/world/openingWreck.ts` — find the slice geometry.
     `OPENING_WRECK_SKYLIGHT_SLICE = 17`; SS skips slices 17+18 →
     30° gap centered at top of the hull.
   - Approach A: additive cone geometry. Build a low-poly triangular
     prism extending DOWN from the gap toward the floor, with an
     additive transparent material tinted warm/dusty. Soft falloff via
     opacity gradient. Tilt to match the sun's projected angle (read
     from `ctx.lights.sun.position` each frame? or freeze at noon-ish).
   - Approach B (cheaper if A gets fiddly): in-scene billboard geometry
     facing the camera, drawn additively as a "ray" sprite. Less
     accurate but reliably visible.
   - Try Approach A first; fall back to B if the cone math fights with
     camera angles.
   - Acceptance: walking into the opening wreck interior, the player
     sees a visible warm-light beam through the gap. The intensity
     should ramp with daylight (`ctx.time.sunHeight`) — invisible at
     night, peak at high sun.

## Stretch goals (if budget allows)

- Mirage shader on salt-flat biome (rough idea from continuous polish).
- Footprint puffs on player movement (small particle bursts).
- Dust motes in OTHER light beams (e.g., flashlight cone? fire light?).

## Autonomy contract

- Salvage yield diff: when ambiguous on weights, default to "engine
  is scrap-heavy" intuition; tune to feel after preview-verify.
- God-rays: visual iteration session. Don't perfect-tune the cone;
  ship a visible-enough beam, document feel-tuning constants in
  Tuning.OPENING_WRECK_GODRAY_*.
- Never ask the human mid-session.

## Stop conditions

- All priority items shipped + verify passes → `/session-end`.
- 3-strike wall on god-rays specifically → cut it (scope-cut #1).
- 3-strike wall on salvage yield → cut differentiation, keep current
  table (scope-cut #2).
- Catastrophic block → halt + write CAUTION.

## Pre-committed scope cuts

1. **God-rays entirely**. Cut means AAB ships just salvage yield diff
   (~1h session) and god-rays go to backlog. Visual iteration is the
   highest scope-risk piece.
2. **Per-kind salvage weights**. Cut means generic table stays; AAB
   becomes a god-rays-only session.

## Notable footguns

- **D71 (recipe id stability)** — irrelevant for AAB unless adding
  recipes (we're not).
- **D75 (PLACEMENT_DISTANCE_M)** — irrelevant.
- **D79 (perceivedIntensity)** — god-rays could optionally dim with
  perceivedIntensity inside large tent (stretch). Keep separate from
  intensity reads.
- **rollWreckLoot in salvage.ts may not exist as-named** — verify the
  function signature before editing. Adapt to what's actually there.

## Verification protocol

```
npm run verify  # = tsc --noEmit
```

Plus eval-driven preview:
1. tsc clean.
2. Strip 5 fuselage panels in a row → cloth-heavy yields confirmed.
3. Strip 5 engine_block panels → scrap-heavy.
4. Strip 5 antenna panels → rope-occasional.
5. Walk into opening wreck interior → visible warm light beam from
   the gap.
6. Force `ctx.time.dayTime = 0.5` (midnight) → beam invisible.
7. Force `ctx.time.dayTime = 0.25` (noon-ish) → beam at peak.

## Begin block

Read CLAUDE.md → `docs/session-end-report.md` (AAA deltas) →
`docs/decisions.md` (D73-D81). Create TaskCreate. Mark AAB.1
(salvage yield diff) as in_progress. Read `src/world/salvage.ts`
first to confirm rollWreckLoot's shape.
