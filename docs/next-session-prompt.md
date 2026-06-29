# ▶ RESUME — Escape-pod intro · Phase 1 · T1.2 (the HERO pod INTERIOR) — `campaign/escape-pod-intro`

**Cycle 10 of the escape-pod-intro campaign.** Phase 1 (the hero pod). Phase 0 (greybox spine) COMPLETE
+ approved; **T1.1 hero pod EXTERIOR shipped (C9)**. Boot from `docs/campaign/campaign-state.json` +
`docs/roadmap.md` (NOT chat memory).

## Read first
1. `CLAUDE.md` (auto-loaded) — "Where we are now"
2. `docs/campaign/campaign-state.json` — cycle 9/150, current_tier (T1.2)
3. `docs/feature-escape-pod-intro.md` — the vision (the pod interior: seated, the chunky parachute lever, the door-blow button, the viewport, a warm cabin) + `docs/research/escape-pod-intro-references.md`
4. `src/world/escapePodIntro/podScene.ts` — `buildPodScene` (greybox interior to replace) + the T1.1 hero exterior (`placeCrashedPodWreck`, `createRustedHullMaterial` idiom — match its style) + `getPodSpawn`/`setDescentProgress`
5. `src/world/escapePodIntro/sequence.ts` — the beats that use the interior: `enterPod` (seated), `shipExplode`, `descent` (setDescentProgress), `parachute` (the gag). They re-point at the hero interior automatically if `buildPodScene` keeps its role.

## What's built (Phase 0 + T1.1)
- The whole intro plays greybox; the **crashed pod EXTERIOR is now hero** (industrial modular box, `placeCrashedPodWreck`).
- The flying-pod **INTERIOR is still greybox** (`buildPodScene`: box floor/walls/ceiling + a viewport frame + a seat block + a planet disc; the player is seated inside for enterPod→shipExplode→descent→parachute).
- Dev hooks: `__game.startIntro/jumpToBeat('enterPod'|'descent'|'parachute')/skipIntro/smokeIntro/placeCrashedPod`. `setDescentProgress` grows the viewport planet.

## Cycle 10 focus — T1.2: the hero pod INTERIOR (procedural-modeler)
**Delegate to the `procedural-modeler` agent.** This is the cabin the player RIDES (seated, first-person) through eject → ship-explode → descent → the parachute gag — so it's seen up-close, head-turn range, for ~20-30s. Replace the greybox `buildPodScene` interior with a hero cabin that MATCHES the T1.1 exterior identity (industrial modular box, `createRustedHullMaterial` idiom, grey-beige + steel + worn):
- **The cabin shell** — a tight worn industrial capsule interior (frame-and-panel, exposed conduit, a warm/dim cabin light feel) sized to the seated FP view; keep the viewport where `setDescentProgress`'s planet shows through (the descent showpiece in Phase 2 frames through it).
- **The chunky PARACHUTE LEVER** — a real, readable lever the player yanks in the `parachute` beat (the 3-pull gag). It should look pullable + industrial; ideally animate/jolt per pull (the gag's snap is the payoff). Position it in easy FP reach.
- **The door-blow button / eject control** — the control the player hits in `enterPod` ("pull the eject lever"). A chunky industrial button/lever.
- **A seat + restraints** + the panel/console (some readable dials/switches — escalating console energy is more a Phase 3 ship thing, but a believable pod console sells it).
- **Keep the contract:** `buildPodScene` stays the lazy-built offset pod the beats use; `getPodSpawn` (seated position) + `setDescentProgress` (grow the planet through the viewport) + `disposePodScene` must keep working. The eject/descent/gag beats should need NO changes (they reference the pod via these) — but if the lever/button want a beat hook (e.g. the lever jolts on pull), wire it minimally in `sequence.ts`'s `parachute`/`enterPod` ticks.
- Iterate via the **real seated FP view** (the player's eye inside the pod): `__game.startIntro()` → `jumpToBeat('enterPod')`/`'descent'`/`'parachute')` → capture. **preview_screenshot hangs on heavy scenes** — but the pod interior at the offset (y=3200) with the desert NOT in view may be light enough to screenshot; if it hangs, add a `pod-interior` rig scenario to `rig-shot.mjs` (mirror the real seated placement, like the `crashed-pod` rig). 5-8 rounds to the hero bar.

### Acceptance (T1.2)
- The seated FP view inside the pod reads as a worn industrial lifeboat cabin (matching the exterior), with a readable chunky parachute lever + eject control + viewport (planet visible via `setDescentProgress`). The eject→descent→parachute beats still play (smoke ok). `verify:all` green end-to-end (real exit); flag OFF → live game byte-unchanged; no SAVE_VERSION bump.

## Then
T1.3 — seated-FP camera + viewport framing (lock the seated camera pose so the descent showpiece frames
beautifully through the viewport). Then **Phase 1 milestone → PAUSE** for the user's "pod in + out" walk-test.

## Campaign rules
ENRICH-NOT-CUT · hero geometry → procedural-modeler + the real in-game-view gate (5-8 rounds; defining quality
not punted) · anti-punt · behind the flag · no save bump · `verify:all` (real exit, NOT piped through `tail`;
it's slow — give it ~600s) + the visual gate · commit each cycle · checkpoint = per phase.

## Footguns
- Match the T1.1 exterior identity/material (`createRustedHullMaterial`, the wrecks.ts idiom) — the interior + exterior are the SAME pod; don't drift styles.
- Keep `buildPodScene`/`getPodSpawn`/`setDescentProgress`/`disposePodScene` contracts so the beats keep working.
- `verify:all` is slow (tsc + 5 placement seeds + colliders through Playwright) — run with a 600s budget + capture the real exit (the agent's shorter Bash timeout will falsely "time out"; re-run end-to-end yourself).
- `preview_screenshot` hangs on the full ~723K-tri desert scene → for in-desert views use `rig-shot --scenario=crashed-pod`; for the pod interior (offset, no desert in view) the live screenshot may work — else add a `pod-interior` rig.
- Keep `FEATURES.escapePodIntro` OFF by default.

## Verify
`npm run verify:all` (600s budget, real exit) + a visual gate of the seated FP interior (live screenshot if it doesn't hang, else a `pod-interior` rig) at enterPod/descent/parachute → confirm the cabin + lever + viewport read + the beats still play (smokeIntro ok) + 0 console errors.
