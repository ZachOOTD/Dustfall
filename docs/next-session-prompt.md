# ▶ Escape-pod intro · Phase 2 (the descent showpiece) — C16 — `campaign/escape-pod-intro`

**Campaign ACTIVE** (`status: active`). Phase 2 in progress. **T2.1 COMPLETE (C14 vista + C15 cabin-light).**
C16 = **T2.2 — re-entry FX.** Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` (not chat memory).

## What's shipped in Phase 2 so far (don't redo)
- **C14 — the descent VISTA** (`podScene.ts`): a `descentProgress`-driven orbit→atmosphere→desert fall through
  the round porthole (curved desert planet + Fresnel atmosphere limb + starfield → cross-fade to a barchan dune
  ground/horizon/sky with raking dawn light + closing scale). Gate-passed @ beauty 8. Shaders: `PLANET_VS/FS`,
  `ATMO_FS`, `STAR_FS`, `LOWALT_FS`. The single `setDescentProgress(0..1)` is the only animation surface.
- **C15 — the cabin interior-lit-by-exterior**: `setDescentProgress` drives the porthole-spill `PointLight`
  (`vpGlowLight`) + the hemisphere `cabinFill` cool→warm as the dawn desert swells (driver `dawn=clamp((p−0.25)/0.6)`).
- Rig: `node scripts/rig-shot.mjs --scenario=pod-interior --descent=<0..1>`; `preview_screenshot` works for the offset
  pod interior. The descent beat lives in `sequence.ts` (`tickDescent`); it calls `setDescentProgress(beatProgress)`.

## C16 — T2.2: re-entry FX (the heat + violence of the atmospheric entry)
Make the entry into the atmosphere read as PHYSICAL + tense (the vision: "beautiful + tense + physical"). All driven
off `descentProgress` (and/or a dedicated re-entry window within it). Build:
1. **Plasma / fire past the glass** — additive plasma streaks/glow building as you hit the atmosphere (a re-entry window,
   e.g. descentProgress ~0.15–0.45 as you punch through), licking past/around the porthole. Hottest at peak entry, fading
   as you slow into the lower atmosphere. (Lives in front of/around the viewport vista — don't break the C14 vista; layer
   over/around it.)
2. **The white flash on entry** — a bright bloom/flash at the peak of re-entry (the screen/viewport blows out briefly),
   then clears to the descent. Use the existing screen-flash fx if suitable (`src/fx/screenFlash.ts` — `flashScreen`,
   already imported in `sequence.ts`).
3. **Viewport heat-shimmer** — a heat-haze distortion over the porthole during entry (a subtle wobble/refraction), easing
   as you descend.
4. **Speed-coupled camera shake** — `addTrauma`/the camera-shake fx (`src/fx/cameraShake.ts`, already imported) ramped by
   the re-entry intensity — buffeting at peak entry, smoothing out into the calm beautiful descent.
- This is hero-ish FX → consider the **procedural-modeler** for the plasma/shimmer shaders + run the **adversarial gate
  ONCE** when the structure is sound (it's FX over the existing vista, not a from-scratch hero asset — don't expect the
  4-round saga the vista needed; gate to confirm it reads as re-entry heat, not noise). `preview_screenshot` the offset
  pod interior at the re-entry window.
- **Arc:** violence at entry (plasma + flash + shake + shimmer peak) → easing into the calm, beautiful, lonely descent
  (C14's vista + C15's warming cabin). The contrast (tense entry → serene fall) is the beat.

## Then T2.3 + the milestone
- **T2.3 — tumbling reveal + interior-lit-by-exterior:** the pod rotates so the window drifts across ship→space→planet→
  desert; stage the ship-explosion reveal through the frame; the cabin washed by the shifting light (build on C15's
  `vpGlowLight`/`cabinFill` hook — extend it to track the tumble, not just altitude).
- **Then: Phase 2 milestone walk-test** — the user rides the whole descent. NOTE the felt **MOTION/pace** of
  `descentProgress` over the ~20s fall is a walk-test item stills can't judge (the C14 gate flagged d05→d09 pacing);
  the re-entry FX timing (how long the plasma/shake lasts) is also a feel item. `/campaign-approve` releases Phase 3.

## Campaign rules
ENRICH-NOT-CUT · hero/FX → procedural-modeler + the adversarial gate (run it on genuinely-new hero assets; lighter/once on
FX-over-existing + integration polish — C15's 2-light ramp was own-eyes-verified, proportionate) · anti-punt · behind
`FEATURES.escapePodIntro` (off) · no save bump · `verify:all` (600s, real exit, NOT piped through `tail`) · commit each
cycle · checkpoint = per phase (next pause = Phase 2 milestone, after T2.3).

## Cost note
C14 (the hero vista) was ~2.4M (5 modeler rounds + 4 gates — justified, it's THE showpiece). C15 (cabin-light) was lean
(~own-loop + preview, no gate). For T2.2: the plasma/shimmer is real FX work (modeler + 1 gate ~400-700K); the flash +
shake are cheap (existing fx). Keep the gate to ONCE unless it surfaces a structural miss.
