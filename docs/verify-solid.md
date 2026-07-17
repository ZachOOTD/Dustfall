# Solid-model verification harness (`verify:solid`)

Machine-detects the geometry bug classes that keep recurring in Dustfall's
procedurally-modelled hero assets. Built per `docs/campaign/audit-and-roadmap-2026-07-15.md`
§A3 rec 1 ("every failure that got a machine gate stopped recurring; every failure
that got only a prose rule recurred"). It is the Phase-1 "SOLID" B0 unlock.

`scripts/verify-solid.mjs` rides the rig-shot / model-stage harness pattern (own
Vite dev server + Playwright chromium + `page.evaluate` driving `window.__game`)
but stages a NAMED hero asset **in the real world** (real terrain + real colliders,
built through the same code paths the game uses) and runs six per-asset checks.
Zero game-source changes — every check is injected in-page.

## Run

```
node scripts/verify-solid.mjs --asset=skyfall        # one asset
node scripts/verify-solid.mjs --asset=leviathan
node scripts/verify-solid.mjs --asset=ribcage
node scripts/verify-solid.mjs --asset=all            # all three, one boot (page-reload isolated)
node scripts/verify-solid.mjs --asset=selftest       # synthetic-defect proof (detectors non-vacuous)

npm run verify:solid            # = --asset=all
npm run verify:solid:selftest   # = --asset=selftest
```

Flags: `--port` (default 5205), `--json` (dump full result JSON per asset).
GPU headless by default (d3d11, ~10× faster + CPU-cool, D301); `RIG_GL=swiftshader`
reverts to the software path.

**Exit code:** non-zero if any check flagged. A modeler wants all-green before
declaring an asset done; on the KNOWN-DEFECTIVE assets a non-zero exit is the
CORRECT result (it is flagging the defects).

## The six checks

| # | Check | Detects | Method |
|---|---|---|---|
| 1 | `thin` | paper-thin / zero-thickness shells (esp. `DoubleSide` faking solidity) | per-mesh geometry bbox: smallest dim < 4.5cm on a wall-scale feature (≥30cm), OR a `DoubleSide` mesh with smallest dim < 12cm |
| 2 | `backface` | see-through hulls (missing front faces / inverted winding / thin-panel backs) | render the asset front=white / back=magenta (`DoubleSide` override, nearest surface wins) from N exterior orbit angles; count BACK-face pixels vs the silhouette. A closed correctly-wound solid shows ~0 back-faces from OUTSIDE |
| 3 | `openend` | uncapped torn hull ends / holes | topological: weld coincident verts, tally boundary edges (used by exactly ONE triangle), cluster them into loops; a loop with world-diagonal ≥ 1.2m and ≥ 8 edges = a real open cross-section |
| 4 | `floating` | detached mid-air pieces | connected-component analysis, then AABB-merge components into super-components (so a mast/fin split off by material doesn't false-flag); a super-component whose lowest point floats > 0.5m above `terrain.heightAt` under its footprint |
| 5 | `collision` | collision ≠ visual (rule 9), **negative** form | ring of exterior rays at player heights: compare the first VISIBLE-surface hit (three raycast) vs the first COLLIDER hit (Rapier `castRay`). A visible wall with no collider within +0.6m is walk-through-able. Plus: interior waypoints have a solid floor under them; the intended opening is NOT collider-blocked |
| 6 | `seam` | entrance mismatch / shell-gap sightlines to daylight | probe-waypoint rays: exterior opening must lead to the interior (not a near wall); interior mouth must see daylight (not hull); an interior daylight fan must escape in ~ONE arc — extra arcs = torn ends / shell gaps beyond the intended mouth |

Checks 5 & 6 are scoped to **enclosure** assets (hulls you enter). An open colonnade
like the ribcage is walk-THROUGH by design, so those two report **N/A** for it (firing
the exterior-wall probe on it would be a false positive).

## How a modeler should use it

Before declaring a hero asset done, run `--asset=<name>` and drive every applicable
check to `[ OK ]`. Wire it into the campaign the same way `verify:chunks` /
`verify:colliders` gate their bug classes: any touched hero asset must pass. The
default review artifact should include the harness output (per the audit's "player's-
eye shot set" recommendation, memories: verify-visual-multi-angle, verify-near-glass-
from-outside). Adding a new enclosure asset only needs an entry in `ASSET_DEFS` +
a spawn branch in `lib.spawnAsset` (the asset must expose a `*Probe` userData with
`waypoints` + `floorHandles` for checks 5/6, like `skyfallProbe` / `leviathanProbe`).

## Acceptance results (2026-07-16 — run on the three known-defective assets)

The harness was proven by running it over the current defective assets and confirming
it flags the known defects (test-mode discipline, like model-stage's):

- **selftest** — all 7 assertions PASS: each geometry detector (thin / open-end /
  floating / backface / seam) fires on a synthetic known-bad rig AND stays clean on
  the control solid box. The detectors are non-vacuous.
- **leviathan** — FLAGS `collision` (32% of exterior rays hit a visible hull wall with
  NO collider → the "exterior hull has no collision, walk through it from outside"
  defect), `openend` (four large open hull cross-sections, Ø34m / Ø30m / Ø12m /
  Ø8m — the single-skin uncapped hull), `backface`, `thin`.
- **ribcage** — FLAGS `backface` (90%+ back-faces visible from every exterior angle →
  the boneyard see-through / inverted-winding defect).
- **skyfall** — FLAGS `thin` (six `DoubleSide` 4cm panels faking solidity),
  `backface` (5-10% exterior see-through), `collision` (83% exterior walk-through).

### Honest limitations

- **skyfall `openend` and `seam` report clean — and that is correct.** Skyfall's hull
  is built with `makeLoftedHull(..., HULL_THICK=0.7)`, which caps BOTH ends with rim
  caps (wreckForms.ts, the M7-R/D304 fix): it is a genuinely closed thick-walled solid
  with ZERO boundary edges, and its interior entrance is walk-aligned (the `skyfall-walk`
  gate passes). The audit's "open ends" prose predates / describes the visual read; the
  residual solidity issues surface via `thin` + `backface` + `collision` instead. The
  open-end detector IS proven on a real open hull (the leviathan) and on the selftest.
- **The seam defect the audit describes (leviathan "entrance faced a wall") appears
  resolved** by the review commit that shipped the walkable interior — the `leviathan-walk`
  gate passes and the interior mouth is aligned, so `seam` is honestly clean there. The
  seam detector is proven non-vacuous by the selftest (a synthetic torn-open hole → 2
  daylight arcs → flag).
- **`floating` on the real assets:** after the super-component AABB-merge, masts/fins
  that are attached-but-elevated do not false-flag, and the current assets have no fully
  detached mid-air pieces, so it reports clean. It is proven on the selftest's detached
  cube. (A literal per-mesh min.y-vs-terrain check — the task's phrasing — false-flags
  every legitimately overhead-but-attached part; the super-component form is the
  model-stage floater lesson applied.)

## False-positive concerns + threshold tuning

All thresholds live in the `PARAMS` object at the top of `scripts/verify-solid.mjs`.

- **`thin`** — legitimately thin open things (grille slats, cloth, DoubleSide by design)
  will flag. Gate is a wall-scale feature (≥30cm largest dim) so pins/wires are ignored.
  Tune `thinAbs` / `thinFeature` / `thinDoubleSide`.
- **`backface`** — GATES on EXTERIOR orbit shots only; interior views are reported
  informationally because a single-shell walkable hull legitimately shows its back-facing
  inner skin from inside (a real false-positive trap that early versions hit). `bleedFrac`
  = 1% of the exterior silhouette; a clean solid is ~0, real defects run 5-90%, so the
  margin is wide. Anti-aliasing at silhouette edges is the only clean-asset noise source.
- **`openend`** — `loopDiag` ≥ 1.2m + `loopEdges` ≥ 8 distinguishes a torn-open hull
  cross-section from incidental primitive seams (a lone plane, a grille). Merged
  geometry is welded at a 3mm grid; a builder that leaves a real opening slightly wider
  than 3mm still registers. Lower `loopDiag` to catch smaller holes at the cost of noise.
- **`floating`** — `floatTol` 0.5m, `minCompSize` 0.6m. The super-component merge
  (expanded-AABB 0.4m) is the key false-positive guard; widen it if a genuinely-attached
  part reads as detached (a thin connector under 0.4m of clearance).
- **`collision`** — flags if >25% of valid exterior rays or ≥4 rays walk through. Rays
  that hit terrain before the visible surface are SKIPPED (not flagged), so terrain
  never causes a false positive. `penTol` 0.6m is the allowed visible-surface-to-collider
  gap. An asset with intentionally-uncollidable thin decoration on its exterior could
  flag — scope the probe or tag those.
- **`seam`** — the interior-fan `extra-daylight-arcs` test assumes ONE intended mouth;
  an asset with two legitimate entrances would read 2 arcs. Adjust per-asset if a hero
  design has multiple openings.
