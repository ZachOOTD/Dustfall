# Morning summary — 2026-07-16 (the SOLID campaign)

**Your entire review-feedback batch is fixed, and every fix is machine-verified.** 11 commits on
`campaign/2026-07-12-skyfall`, tree clean, all gates green. **Nothing pushed** — the push is staged
and waiting on you (see "The push").

We followed Fable's recommendation exactly: **build the verification harness first, then run the
fixes through it.** That turned out to be the right call — see "Why the harness mattered."

## What shipped tonight

### The foundation (Fable's plan, Phase 0 + SOLID)
1. **Fable's audit + roadmap** — `docs/campaign/audit-and-roadmap-2026-07-15.md` (+ your feedback/ideas captured in `feedback-and-ideas-2026-07-15.md`).
2. **Doc-sync** — CLAUDE.md brought current, architecture.md's real counts (44 items / 20 recipes / 15 archetypes — Fable's audit had over-counted), the GDD multiplayer contradiction flagged, dead `ash_barren`/`rideableSled` refs corrected.
3. **🔧 `verify:solid` — the solid-model verification harness** (the headline). Six machine checks: thin/zero-thickness, backface-see-through, open hull ends, floating, collision-vs-visual (negative walk-probe), exterior↔interior seam gaps. Self-test proves every detector is non-vacuous. `npm run verify:solid` · docs in `docs/verify-solid.md`.

### Your feedback — all six areas fixed (each harness- or rig-verified)
| Area | What was done |
|---|---|
| **Boneyard** (A2) | See-through root-caused (inverted `sweptTube` side-winding) + fixed → backface **91% → 0%**. Redesigned to a **long/low/sunken sandworm skeleton** (64-78m, crown 15m→8m, dorsal blades removed), distance-surviving bone weathering, greyer, collision re-derived, blob "skull" scatter removed. |
| **Skyfall** (A3) | Entrance edges + ends: rim cap was wound **inward** → new `solidInner` closed rim lip on **both** fractures (thick cut cross-section, no gap/paper edge); **exterior hull collision added** (was 83% walk-through — you hadn't even spotted it); floating bow plate/strakes + the mast funnel seated; entrance floor z-fight killed. |
| **Leviathan** (A1) | Exterior **re-lofted to a genuine closed solid** (DoubleSide→FrontSide, 0.9m walls, capped) — silhouette preserved; **exterior trimesh collision** (32% walk-through → 0); the front dead-end bore sealed; mouth-jamb cut-face un-inverted; **interior lighting lifted** (1.4×). |
| **Hab dome** (A4) | Rebuilt as **one continuous walkable habitat** — dome → open tube → dome, two jambed doorways, on a continuous floor; **bigger**; surface-tiled collision (0 walk-through); the floating cone (an unseated crown cap) removed. Also **added to the harness**. |
| **Storm** (A5) | Dustwall **de-spun** — it was re-yawing to the player every frame; yaw is now locked to the **wind** and the wall only translates → a wide, flat, Dune-style advancing front (proven: yaw constant across a ±34° sweep). Fog reaches full density by intensity 0.6, and the **sky-dome flattens to the fog hue** → the 46m wreck is gone at mid and peak. |
| **Worm sweep** (A6) | Lighter dusty grey-brown; **sinks under the terrain** so only the dorsal crest breaks the surface (rides *through* the dunes instead of floating on top). |

**Bonus:** **infinite sprint + Shift toggle** (B6, Fable's quick win) — no stamina drain/gate; sprint-thirst kept as the cost; stamina stat kept for tow.

## Why the harness mattered (the real result)
Fable's diagnosis was *"every failure that got a machine gate stopped recurring; every failure that got only a prose rule recurred."* Proven tonight: the harness **caught the same inward-winding bug on three separate assets** (ribcage ribs, Skyfall's rim cap, the leviathan's jamb) and found **two exterior hulls you could walk straight through** (Skyfall 83%, leviathan 32%) that nobody had noticed by eye. It also **caught a bug in itself** (Rapier's QueryPipeline only rebuilds on `world.step()`, so collision checks were blind to spawn-time colliders). All four hero assets now pass all six checks — and any future asset must too.

## Needs you (feel calls + one deferred item)
- **Storm residual (honest):** distant *structures* are gone at peak ✅, but a soft **ground/sky edge still reads at the horizon**. Fog and sky share the exact same hue numerically, so it's the storm **vignette** darkening the upper screen — a truly featureless whiteout needs a deeper lighting/vignette pass. Your call whether that's worth it.
- **Deferred with a plan: the crash-wreck → Skyfall integration.** Correctly not rushed — it needs a Skyfall scale variant, a `SAVE_VERSION` bump + migration (the crash save contract assumes a single-panel husk), determinism re-ordering, and crash-FX re-tune for a 46m footprint. Plan is in the Skyfall commit body. Wants its own slice.
- **Feel-tests (stills can't judge):** the boneyard walk-under; the leviathan aft console (still darkish); the storm wall's advance *speed* + wind loudness; the sprint toggle feel; POI density.
- **Stamina's final role** — it no longer gates movement. Retire/hide it, or give it a real tow/melee cost? (Fable's open question.)

## The push
Everything is committed and green, **but nothing is on `master`/live**. Say **"ship it"** and I'll merge + redeploy. (Or take the tweaks above first.)

## Next per Fable's roadmap
**Campaign "Scavenger's Economy"** (crafting materials → loot variety → panel variety) — the material registry is the shared foundation and the single biggest lever on the core loop. It needs your approval of a 1-page material/recipe/drop matrix as its first deliverable. Then mega dunes + ridable sled, then the cave system, then character/multiplayer.

## Housekeeping
Dev servers reaped. Untracked probe litter (`scratch-baseline/`, `scripts/_scenecheck.mjs`, `_vultcheck.mjs`, `_skyfall_diag.mjs`) still safe to delete.
