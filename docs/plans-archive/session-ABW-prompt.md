# Session ABX — Kickoff Brief (post-ABW)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded; ABW Last-shipped summarises cape fix
   + the 8-session arc)
2. `docs/session-end-report.md` — cumulative through ABW
3. `docs/changelog.md` — ABW + ABV + ABU + ABT at top
4. `docs/decisions.md` — D118 + D117 + D116 + D115 latest. D107 is
   load-bearing (zero-asset). Existing procedural shader vocab:
   `metalMaterial`, `paintMaterial`, `skinMaterial`, `woodGrain`,
   `bone`, `glass`, `fabricMaterial` (with `disableShimmer` opt for
   moving entities per ABN/D109).
5. `docs/roadmap.md` — Up next is **ABX texture pass**
6. `docs/backlog.md` — ABW followup at top
7. `~/projects/gamedev-framework/shared-memory/iterative-polish-
   discipline.md` — discipline 9 sessions running

## What's already built (post-ABW snapshot)

78 sessions. **8-session procedural-character quality arc complete**.
Rig + cloth + animation + cape-fit all solid:
- ABP→ABV pipeline of D107+D109+D111+D113+D114+D115+D116+D117+D118
- ABW cape clipping fix

The visual side that remains is **per-element material variation +
weathering detail** — texture/material pass within D107 zero-asset.

## Session ABX focus

**Player model texture pass per user direction**. Apply existing
procedural shader vocabulary to specific rig elements for material
variation + weathering. D107 zero-asset stays preserved — these are
all procedural shaders (no textures files).

## Priority items (in order; pick 2-3 per discipline)

### P1 — Poncho weave + dye pattern (3-5 rounds, ~45-90min)
Current poncho uses `fabricMaterial(PONCHO_COLOR, undefined, {
disableShimmer: true })`. Solid color with weave pattern from the
existing fabricMaterial shader. Add:
- Per-vertex color variation via vertex attribute (alpha or color
  channel) — slight stripe/blotch pattern for dye unevenness
- Or use 2 fabricMaterial instances with slightly different colors
  applied to alternating poncho segments
- Or modify fabricMaterial to accept a "stripe" pattern parameter
Goal: poncho reads as a hand-dyed scavenger garment, not uniform
factory fabric.

### P2 — Skin tone variation (face + hands + jaw) (3-5 rounds, ~30-60min)
Face + hands currently use uniform skinMat (`SKIN_COLOR = 0xc9a876`).
Real weathered faces have:
- Sun-darkened forehead + nose ridge
- Darker upper lip / chin from beard shadow
- Lighter cheeks
Apply per-region variation: face = sun-aged; hands = dirtier knuckles
+ palm shadow. Use `createSkinMaterial(color, { accentColor, ... })`
with per-region color tuning or add tint patches via geometry.

### P3 — Metal pauldron weathering (2-3 rounds, ~30min)
Current pauldron plates use `createPaintedMetalMaterial(rust,
{ wearLevel: 0.7 })`. Bump wear level higher (0.85?) + add visible
rivet detail (small SphereGeometry studs at plate corners). Reads
as more salvaged, more battle-scarred.

### P4 — Leather strap detail (bandolier) (2-3 rounds, ~30min)
Bandolier currently uses `createMetalMaterial(STRAP_COLOR=0x505050,
{ wornScale, scratchStrength })`. Switch to a "leather strap" style:
- Different base color (brown rather than grey)
- Different shader treatment (less metallic, more matte)
- Optional: add subtle stitching dots at intervals along the strap
Plus subtle radial perturbation on the TubeGeometry for leather
cracks/wear (similar pattern to D117 cloth-drape but at smaller
amplitude).

### P5 — Hood edge torn weave (~30min)
Hood drape edge could read "torn" via geometry irregularity at the
bottom edge — slightly different per-vertex offsets at the hem
boundary. Subtle "ripped scavenger gear" feel.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars +
decisions.md realism dial (D45+, D49, D67, D86–D118), append a new
D-entry, keep going.

**Iteration discipline contract** (9 sessions running):
- `tsc clean` is NOT the success gate on visual/feel work
- Per substantive element: build → screenshot → critique → iterate
- 5-8 rounds for new visual, 3-5 for tuning, 1-2 for bug fix
- Ship 1-2 fully-iterated tiers, NOT 4-5 shallow ones

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic
block, destructive-action attempt.

## Notable footguns

- **D107 zero-asset POLICY**: ALL procedural; no GLB; no texture
  files. Texture pass = shader parameter tuning + geometry detail,
  NOT loading PBR maps.
- **D109 localSpace on skin**: moving entities use `localSpace: true`
  on skinMaterial so the texture detail doesn't crawl as the body
  moves. Rig face/hands already use this.
- **ABN disableShimmer on rig cloth**: rig cloth layers use
  `disableShimmer: true` on fabricMaterial to avoid shader-shimmer
  breathing during walk. Don't accidentally re-enable shimmer.
- **D117 cloth drape**: subdivided geometry + per-vertex sin-wave
  offsets. If adding vertex color/attribute variation, walk the same
  attribute pattern.
- **D115 LatheGeometry**: profiles MUST close at top + bottom (r=0).
- **D114 walk cycle**: knee `max(0, cos(legPhase))`.
- **D116 over-shoulder camera**: shoulderAnchor is the target.
- **HMR triggers full reload** for playerRig.ts changes.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For ABX iteration:
- Per element: screenshot before → screenshot after each round
- Critique honestly
- Ship only when screenshot reads as intended goal

## Begin block

Read CLAUDE.md (auto). Read session-end-report (through ABW) +
recent changelog + decisions D118 + procedural shader files in
src/world/ (metalMaterial.ts, paintMaterial.ts, skinMaterial.ts,
fabricMaterial.ts). Pick P1-P5 sub-tasks. Boot preview. Iterate.

**The iteration discipline IS still the contract.** 9 sessions
running. Don't slip.
