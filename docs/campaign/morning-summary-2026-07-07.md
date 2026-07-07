# Morning summary — 2026-07-07 overnight playtest-fix batch

All 7 requested fixes shipped to the working tree (not committed — review the diff + shots, then tell me to commit). `npm run verify` clean; the quarters-walk collider gate passes. Everything is in `src/world/escapePodIntro/shipScene.ts`.

**New tooling (reusable):** `scripts/ship-shot.mjs` — boots the intro headless, parks a camera at any named interior view, captures via a render-then-`toDataURL` path (the WebGL loop hangs Playwright's normal screenshot on this scene). `--probe` casts a ray grid and names any two overlapping meshes at equal depth — the z-fight finder. Views: `console`, `con-pilot`, `con-side`, `con-mull`, `quarters-door/-in/-aft/-fore/-back`, `corr-bottle`, `corr-grille`, etc. Multi-view: `--view=a,b,c` in one boot.

## The fixes

| # | Item | What I did | Verify shot |
|---|------|-----------|-------------|
| 1 | **Corner crate** (your shot 3) | Removed the strapped stowage crate + its rule-9 collider. | `ship-quarters-back-detail1.png`, `-fore-fix1.png` |
| 2 | **Cupboard overlaps wall** (shot 4) | Base cabinet shifted 15cm toward the lockers (its door-side edge was poking into the corridor-side wall return); collider moved to match; trimmed its kick-rail conduit that also overshot. | `ship-quarters-aft-fix1.png` |
| 3 | **Hallway vent rotated wrong** (shot 1) | Root cause: the crew-quarters base-cabinet vent's x-offset overshot the room wall by 17cm, so it poked **through the wall into the corridor**. Removed it (a redundant echo of the fore-wall vent). Confirmed via the corridor probe. | `ship-corr-bottle-fix1.png` |
| 4 | **Desk support struts not connecting** (shot 2) | The 2 diagonal struts used a hand-guessed transform that floated below the desk. Recomputed from real endpoints (desk front-underside → wall base) — they now land flush at both ends. | `ship-quarters-fore-fix1.png` |
| 5 | **Doorway clipping** (my in-progress item) | The probe pinned the coincident-plane pairs: the dado sat coplanar with the wall return (×105), the jamb posts' aperture faces coincided with the corridor wall edges, the lintel bottom coincided with the over-door wall, and the returns terminated on the aperture edges. Fixed each with a real ≥6mm offset (dado proud, posts straddle the edges, lintel widened + dropped to enclose the posts, returns inset 5cm). Re-probe: the big coplanar pairs are gone; the frame renders clean. | `ship-quarters-door-zfix3b.png` |
| 6 | **Bunk back wall too flat** | Added the room's panel language above + flanking the bore — a proud upper panel band + rub-rail + bolt row + a ceiling head band + two pilasters framing the bunk. Opening stays clean + accessible. | `ship-quarters-back-detail1.png` |
| 7 | **Console → angular, parallel to the glass** (my item; two rounds of your feedback) | First pass poked through the glass (a real miss — I'd only checked interior). Second pass followed the glass but was **curved**, which you didn't want. **Final:** THREE straight ANGULAR panels chorded off the dome sill — the original straight front console + a left + right console each parallel to its side glass — every panel's window edge inset a fixed distance INBOARD so nothing crosses a pane (verified EXTERIOR + graze), joined by corner posts as one system. Matched detail on all three (front: green MFD + gauges + throttle + switch strip + LED row; each side: amber data screen + gauge + toggle plate + LED-indicator panel + decal). Colliders per panel. | `ship-con-pilot-a1.png`, `-con-ext-r-a1.png`, `-con-graze-r-a1.png`, `-con-top-a1.png` |

## Console (#7) — clean corners pass

Removed the chunky corner posts and made the three sections connect as one continuous surface: the deck is now a single mitred polygon (no more overlapping deck boxes z-fighting at the corners), and the fascia is one continuous folded wall that miters at each corner (no exposed panel ends piling into a block). Instruments still mount proud in each section's frame. Verified corner close-up + full view + front/side close-ups + exterior (still fully inboard, no poke). Shots: `ship-con-corner-r-fold1.png`, `-con-pilot-fold1.png`, `-con-ext-r-fold1.png`.

## Console (#7) — cleanup pass (closer to glass + tilt + no overlaps)

After the angular rebuild landed, a polish round: moved it **closer to the glass** (inset 0.42), **canted the fascia back** like the original (built each panel's fascia + instruments in a tilted child group so they cant as one), and **fixed the instrument overlaps** — screens now mount *proud* of the fascia (the prior bug half-buried them), the buried dial gauges are gone, and the throttle is centred in the gap between the two screens instead of crossing one. Green MFD in the calm cockpit beat, amber under checkEngines (correct alert behaviour). Verified front/side close-ups + exterior (still fully inboard). Shots: `ship-con-front-cu-calm.png` (green MFD), `-con-pilot-b3.png`, `-con-lside-cu-b4.png`, `-con-ext-r-b4.png`.

## Console (#7) — final: 3 angular panels parallel to the glass

Two corrections landed here: (1) the first straight-arm pass poked through the glass — a miss I owned (now a permanent rule: near-canopy geometry gets checked from exterior + graze); (2) the follow-up followed the glass but was curved, which wasn't wanted. The FINAL is three straight ANGULAR panels — the original straight front console + two side consoles parallel to the side glass — joined as one system, matched detail on each, all inset inboard of the panes. `ship-con-pilot-a1.png` = seated view; `ship-con-ext-r-a1.png` = from outside the dome (fully inboard). Parametric off the sill, so the inset depth / how far the sides wrap / instrument mix are all cheap to tune.

## Minor residual (noted, not blocking)

The parked quarters door *leaf* is embedded in the wall pocket (its back face coincides with the return) — a low-count, occluded z-fight behind the leaf itself, not the frame you flagged. Easy to fix with a proper pocket recess if you see it flicker in-game.

## Not done

Left uncommitted per the repo's "commit only when asked" rule. Say the word and I'll commit with a print-hints message (and can run `/session-end` to fold this into the changelog/roadmap).
