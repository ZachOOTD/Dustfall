# Next session — resume the live-feedback loop (after round ABQ, 2026-07-07)

The user is live-testing the escape-pod intro in `npm run dev` and filing per-issue fixes.
Round ABQ (2026-07-07) landed a big cockpit/pod/audio/airlock fix batch — see
[changelog.md](changelog.md) 2026-07-07 + D272-D276. Just keep taking their feedback and
fixing, probe-/render-verifying each via the ship-shot + pod harnesses.

## What shipped in round ABQ (2026-07-07; `f17fce6` + the ABQ commit)
- **Cockpit console** rebuilt as 3 angular panels off the dome sill (mitred deck/folded fascia,
  proud instruments) + moved closer to the glass (`INSET 0.24`; clutter re-anchored to track it).
- **Pod interior**: the "brown floor" was the charred `baseCap` poking above the deck (dropped
  below, D273); white splotches = shader flecks (zeroed, interior + exterior); floor z-fight
  flicker (deck/sub-floor split 1cm, D274) + streak layers stripped; footwell disc removed;
  eject lever → a simple pull-down handle.
- **Rounded airlock → plain hallway** (bellows + mating shroud removed; also cleared the
  pre-eject porthole bands). Pod door confirmed ONE unified model.
- **Audio**: desert wind + ship hum muted reversibly. **Cockpit glass**: sill gap closed + slight
  haze added. **Airlock corner z-fight**: `--probe`-confirmed pair → polygonOffset (D275/D276).

## FIRST THING next session (owed live-motion checks)
- **Confirm the airlock-corner z-fight is gone IN MOTION** (polygonOffset can't be verified by the
  probe/still render — see backlog + [[ship-zfight-probe-first]]). If it still flickers, fall back
  to a geometry fix (pull the collar wall back). Also eyeball: the cockpit glass haze amount, the
  crashed-pod exterior (did zeroing flecks make it too clean?).

## Older deferred items (lower priority)
1. **The descent METAL-CRAWL** (the user's live report): a dynamic-texture "swim" on the DOOR /
   LEVER / CONSOLE metal, visible only while the pod MOVES during descent. NOT the plasma (that's
   separate + fixed). NOT the classic localSpace world-space crawl — every pod createRustedHullMaterial
   ALREADY has `localSpace: true`, and the pod stays LEVEL (no tumble) during descent, so the two
   obvious mechanisms are ruled out. Leading suspects: z-fighting on those pieces that shifts with
   the view, or a view-dependent specular/env sweep on the metal. A reproduction agent was mid-hunt
   when paused (no diagnosis yet); a `crawl-probe` rig scenario it left (in rig-shot.mjs, `86fa769`)
   drives the descent motion + captures the interior metal — reuse it. Reproduce → name the exact
   mechanism → fix (podScene.ts; do NOT edit the SHARED hullMaterial.ts blind — report if the root
   cause is there).
2. **The systemic SWIM-GUARD** (the user's architecture ask: "make sure texture swim never happens
   on any texture ever again, even moving"): (a) flip createRustedHullMaterial's default to swim-safe
   (local-space) so new materials are protected by default — VERIFY the static desert wrecks/terrain
   don't lose cross-seam grime tiling; (b) add a MACHINE GUARD rig gate that translates each object a
   test delta + asserts the surface pattern doesn't slide (catches existing + new, forever); (c)
   document the convention. Fold #1's actual mechanism into the guard so it covers that class too.

## Open flags for the user's eyes (their call)
- The cockpit glass HAZE level (now that the glass actually renders — tune up/down to taste).
- Whether the descent STREAKS read better now (plasma slowed) — the metal-crawl (#1) is separate + deferred.
- The cockpit floor-overshoot (agent applied the geometrically-correct inset but couldn't frame the
  user's exact screenshot angle — confirm in-build).

## Keeping the machine fast (SOLVED this session — automatic)
Long sessions used to accumulate orphaned Vite dev servers (each agent/rig-shot spawns its own;
completed ones leaked). FIXED at the source: `vite.config.ts` now has an `autoShutdownIdle` plugin —
every dev server terminates ITSELF once no browser has been connected for ~8 min (or ~20 min if never
used), safe because an in-use rig-shot/bench keeps its page attached so it never dies mid-run. So
servers self-clean; no command needed. `npm run reap` (scripts/reap-dev.ps1) remains the manual
force-clean for immediate relief; `DUSTFALL_NO_AUTOSHUTDOWN=1` opts a server out.
VERIFIED (2026-07-06): the auto-shutdown fires — a server with no browser self-exited at ~11s under a
short test threshold ("auto-shutdown: unused for 0m — freeing this idle dev server"), reading a real
client-count of 0 (the same path the "don't kill an active run" safety relies on). Thresholds are env-
overridable (DUSTFALL_AUTOSHUTDOWN_{IDLE,NEVER,CHECK}_MS). Also PORTED into the gamedev-framework
(shared-memory/dev-server-auto-shutdown.md + the project skeleton) so every new game inherits it.
