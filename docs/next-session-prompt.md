# Next session — PAUSE POINT (2026-07-06, live-feedback rounds); resume here

The user ran a long live-feedback session on the released escape-pod intro, then paused
(machine slowdown). Everything is committed + pushed to master; the tree is clean at
`86fa769`. Live at https://zachootd.github.io/Dustfall/.

## What shipped this session (all pushed; see git log 2ad74fe..86fa769)
- **Crew quarters — full redesign** (`e618d4a`, 6 rounds + 3 adversarial gates): the bunk
  is a TRUE recess bored INTO the wall (flush wall, mattress inside the pocket, nothing
  proud/underneath, flush under-bunk drawer); made bedding (distinct olive blanket + turn-down,
  rounded pillow, softened mattress); detailed lockers/cabinet + status LEDs; the dead bright
  wall worn down. **Airlock**: the 2 umbilical stubs that read as pipes into the pod removed.
- **Parachute** (`53f4b47`): sits ~6cm off the hull (no phase-through) + ropes removed on deflate.
- **Porthole** (`2fd1a65`): domed glass → a single FLAT circular pane, depthWrite:false so the
  re-entry FIRE reads through it again (the dome was depth-occluding the additive FX). Plasma
  scroll/flicker slowed further.
- **Cockpit** (`ba5287a`): the glass was BACKFACE-CULLED (the real reason it read "invisible"
  for 5 rounds) — fixed the inverted winding + retuned the haze; added the waist side-mullions;
  trimmed the floor behind the glass.
- **Audio** (`13264ff`): no wind/music until the ship (suppress before handoffToGame).
- **Loading screen** (`ad69ea4`): REVERTED the live-menu experiment back to the freeze-frame —
  the live 3D menu can't be smooth during the main-thread-blocking shader preload (stuttered +
  the title buttons overlapped the bar). If we want life there later: a COMPOSITOR-thread CSS
  animation on the captured frame (not a main-thread 3D render).

## DEFERRED — pick these up next (in priority order)
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

## Keeping the machine fast (NEW this session)
Long sessions accumulate orphaned Vite dev servers + headless browsers (each agent/rig-shot spawns
its own; completed agents don't always clean up). Run **`npm run reap`** anytime the machine slows
(kills all stale dev servers + headless browsers, keeps the MCP servers; `-KeepPort 5180` to keep a
test server). The agent should reap between waves in long sessions. Script: scripts/reap-dev.ps1.
