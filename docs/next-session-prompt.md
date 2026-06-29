# ⏸ PAUSED — Escape-pod intro · PHASE 1 MILESTONE (the HERO pod COMPLETE) — `campaign/escape-pod-intro`

**The campaign is PAUSED at the Phase 1 milestone** (`status: paused`, `awaiting_approval: true`,
`stop_reasons: ["milestone-review"]`). The cylindrical hero pod is whole — exterior + interior + seated
camera. **The user walk-tests, then `/campaign-approve` releases Phase 2.** Do NOT auto-continue the loop
until approved.

## 🎮 FOR THE USER — walk-test the hero pod (Phase 1): "pod in + out"
The escape pod is now HERO art (the cylindrical riveted-aluminium capsule you chose, D271) — replacing the
greybox. Two things to judge:
- **OUT (the exterior):** you wake beside it half-buried in the dawn dunes — a weathered riveted aluminium
  capsule, scorched base, a blown salvage hatch, a recessed porthole, leaning in a sand berm.
- **IN (the interior):** you ride the round cabin through eject → ship-explode → descent → the parachute
  gag — curved riveted walls, the viewport (planet swelling through it), the chunky red parachute lever
  (3 pulls → it snaps dead), the guarded yellow eject, a console + bucket seat. You sit at eye level with
  the viewport; each beat turns you toward its control.

**How to play it:**
- **Real flow:** set `FEATURES.escapePodIntro = true` (`src/config/features.ts`) → start a NEW game.
- **In-console:** `__game.startIntro()`, then `__game.jumpToBeat('enterPod'|'descent'|'parachute'|'stepOut')`,
  `__game.skipIntro()`, `__game.smokeIntro()`. To see the exterior: `__game.smokeIntro()` runs to the desert
  + leaves you beside the crashed pod.

**What to give feedback on:** the pod's look + feel (exterior + cabin), the seated framing, the controls'
clarity, the parachute-gag feel, anything off. Drop notes in `docs/campaign/steering.md` or say them.
**Known deferred (NOT bugs):** the PLANET/atmosphere through the viewport is still a greybox disc — the
real hero descent vista (atmosphere glow, terminator, stars, the swelling-planet showpiece) is **Phase 2**,
which frames through this viewport. The descent/explosion FX are also Phase 2. The console reads slightly
warm under the dawn lamp (minor). Audio is Phase 5.

## ▶ AFTER `/campaign-approve` → Phase 2 — The descent showpiece
Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md`. The beautiful atmospheric fall (the
emotional core the user loved in the vision interview), framed through the now-hero pod viewport:
- **T2.1 — the `descentProgress` effect stack:** Fresnel atmosphere glow + fog color-ramp + the planet/
  horizon vista (the real planet through the viewport — replaces the greybox disc; surface + terminator +
  atmospheric limb + a starfield) + detail pop-in + a lighting shift across the fall. Drive it off the
  existing `descent` beat's `descentProgress` 0→1 (already wired via `podScene.setDescentProgress`).
- **T2.2 — re-entry FX:** plasma particles, the white flash, heat-shimmer, speed-coupled camera shake.
- **T2.3 — the tumbling reveal + interior-lit-by-exterior** (the cabin lit by the plasma/planet glow).
- Hero visual work → the **procedural-modeler** + the **adversarial visual gate** (the Phase-1 lesson:
  self-critique + a single review miss identity/pareidolia + placement bugs; the N-critic gate catches them
  — see `memory/hero-asset-adversarial-gate.md`). Run the gate ONCE per asset when the structure is sound
  (don't loop it). `preview_screenshot` works for the offset pod interior (hangs on the full desert).
- **Milestone: Phase 2 — descent COMPLETE → USER WALK-TEST (the beautiful descent) → `/campaign-approve`.**

## State of the code (Phase 1)
- `src/world/escapePodIntro/podScene.ts` — `placeCrashedPodWreck` (hero exterior capsule) + `buildPodScene`
  (hero round cabin) + `getPodSpawn`/`setDescentProgress`/`setParachuteLeverPull`/`disposePodScene`/`removeCrashedPodWreck`.
  The viewport's `setDescentProgress` planet is the greybox stand-in Phase 2 replaces.
- `sequence.ts` — the beat machine + `faceControl` (YXZ rotation) + the seated-eye set. `controller.ts` —
  `POD_SEATED_EYE_OFFSET` when intro-seated. `introHud.ts` — HUD suppression + prompts + `setIntroBlack`.
- Rigs: `rig-shot.mjs --scenario=crashed-pod` (exterior) / `pod-interior` (cabin). Decisions: D269 (architecture), D270 (wiring), D271 (cylindrical identity).

## Campaign rules
ENRICH-NOT-CUT · hero geometry/FX → procedural-modeler + the adversarial gate (once per asset) · anti-punt ·
behind the flag · no save bump · `verify:all` (600s, real exit, NOT piped through `tail`) + the visual gate ·
commit each cycle · checkpoint = per phase.

## Footguns (for Phase 2)
- The planet vista replaces the greybox disc IN THE POD VIEWPORT (`setDescentProgress` drives it) — keep the contract.
- Hero FX = the procedural-modeler + the real in-game-view gate; `preview_screenshot` hangs on the full desert (use the rigs).
- Keep `FEATURES.escapePodIntro` OFF by default until the whole feature ships.
