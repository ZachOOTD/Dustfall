# ⏸ PAUSED — Escape-pod intro · PHASE 0 MILESTONE (greybox spine COMPLETE) — `campaign/escape-pod-intro`

**The campaign is PAUSED at the Phase 0 milestone** (`status: paused`, `awaiting_approval: true`,
`stop_reasons: ["milestone-review"]`). The greybox spine plays end-to-end. **The user walk-tests, then
`/campaign-approve` releases Phase 1.** Do NOT auto-continue the loop until approved.

## 🎮 FOR THE USER — walk-test the greybox intro (Phase 0)
The whole sequence is wired in **placeholder greybox art** — judge the **FLOW + PACING**, not the looks
(the hero art is Phases 1-5). Two ways to play it:
- **In-console (fastest):** open the game, then `__game.startIntro()` (force-starts even with the flag off).
  Navigate with `__game.jumpToBeat('<beat>')` (`cockpit`, `checkEngines`, `corridor`, `enterPod`,
  `shipExplode`, `descent`, `parachute`, `impact`, `wake`, `stepOut`), `__game.skipIntro()` to bail to the
  desert, `__game.smokeIntro()` to auto-run the whole chain.
- **Real flow:** set `FEATURES.escapePodIntro = true` (`src/config/features.ts`) → start a NEW game → it
  plays the intro, then hands you into the desert. (Dev Mode + Continue keep the normal spawn.)

**The beats:** seated cockpit (planet out the window) → "check engines" → walk the corridor → into the pod
→ pull eject → ship explodes (flash) → the fall (planet swells, rumble) → **the parachute gag** (pull 3×,
the lever snaps off) → crash + fade to black → wake → step into the dawn desert beside your crashed pod +
a "craft a machete to pry it" hint.

**What to give feedback on:** the order/pacing of beats, how long each holds, the gag's timing, the
seated-vs-walk transitions, anything that drags or rushes. Drop notes in `docs/campaign/steering.md` (the
loop reads it next cycle) or just say them. Known greybox limitations (NOT bugs): box-art everything, the
window shows the desert sky (no space backdrop yet), no audio, the manual 3-pull timing is rough, the
crashed pod is a plain box. All of that is the Phase 1-5 hero work.

## ▶ AFTER `/campaign-approve` → Phase 1 — The pod (hero)
The first HERO-ART phase. Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md`.
- **T1.1 — pod exterior** → **delegate to the `procedural-modeler` agent**: the chosen identity = **industrial
  modular box** (NOT an ODST clone — see `docs/research/escape-pod-design-variety.md`). Render the **real
  first-person in-game view** (the player walks up to it half-buried in the dunes — the C60/C63 "real
  placement, real angles" gate); iterate build→shoot→critique 5-8 rounds to a quality BAR. Replace the
  greybox `placeCrashedPodWreck` box with the hero exterior. **Half-buried-in-sand gate** (per the
  `verify-visual-multi-angle` memory + D-precedent: shoot from the player's eye + into any opening, not one
  framed hero shot).
- **T1.2 — pod interior** (the panel, the chunky parachute lever, the door-blow button, the viewport, a warm
  cabin) — replaces the greybox `podScene` interior; the descent/eject/gag beats re-point at the hero geometry.
- **T1.3 — seated-FP camera + viewport framing** (the descent showpiece in Phase 2 frames through this).
- **Milestone: Phase 1 — pod hero COMPLETE → USER WALK-TEST (pod in + out) → `/campaign-approve`.**

## Campaign rules
ENRICH-NOT-CUT · hero geometry → procedural-modeler + the real FP-view gate (5-8 rounds) · anti-punt · behind
the flag · no save bump · `verify:all` (capture the real exit — don't pipe through `tail`) + the live/visual
gate each cycle · commit each cycle · checkpoint = per phase.

## State of the code (Phase 0)
- `src/world/escapePodIntro/` — `sequence.ts` (the beat state machine + all 10 beat controllers + `smokeTestIntro`),
  `shipScene.ts` (greybox ship), `podScene.ts` (greybox pod + `setDescentProgress` + `placeCrashedPodWreck`),
  `introHud.ts` (`setGameHudHidden`/`showIntroPrompt`/`setIntroBlack`).
- Gating: `ctx.intro.active` + `ctx.intro.mode` (walk/seated/scripted); `introActive(ctx)` guards (controller
  locomotion, survival drain). `returnPos` = the captured desert spawn. `introComplete` save marker (no version bump).
- Dev hooks: `__game.startIntro/skipIntro/jumpToBeat/smokeIntro`. Decisions: **D269** (architecture), **D270** (wiring).

## Footguns (for Phase 1)
- The hero pod exterior REPLACES the greybox `placeCrashedPodWreck` box — keep it a persistent world object (don't dispose on handoff).
- Hero modeling = the procedural-modeler agent + the REAL in-game view (not an isolated studio rig) — re-apply the C60/C63 lesson.
- Keep `FEATURES.escapePodIntro` OFF by default until the whole feature ships.
