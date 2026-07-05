# Research digest — Escape-Pod Intro references (2026-06-28)

Reference + technique digest for the escape-pod intro (`docs/feature-escape-pod-intro.md`).
Four parallel research sweeps: crash/escape intros · re-entry visuals · FP ship-disaster design ·
capsule interiors + viewport framing. **For composition/feel + implementable technique — our
stylized low-poly art style stays.** Full source lists at the bottom of each section.

## Cross-cutting principles (the load-bearing ones)

1. **Subnautica's lifepod crash is our closest analog** — cinematic impact + shockwave → player
   knocked out → wake in the wrecked pod → scavenge teaches crafting/inventory with no voiceover.
   Validates our spine; steal the "teach by interaction in the wreck" onboarding.
2. **Long intros work IF the player keeps agency** (Firewatch's 5-min open is loved; Half-Life 2's
   passive tram was criticized). Never lock movement — even in the descent, let the player look
   around / shift. Our no-fail, take-your-time pacing is the right call *because* agency stays.
3. **The "waking + aftermath silence" beat is underrated** — the walk from pod to the first desert
   sight, near-silent (wind + breath, score held back), is the real tone-setter. It's not the
   crash that lands the emotion; it's the quiet after.
4. **Show, don't monologue** — no lore exposition / radio explainer. The failing ship systems +
   the wreck tell the story. (Lone-pilot caveat below.)
5. **Color/lighting transition IS the storytelling** — cold blue space → plasma orange → our
   canonical desert sky. Cheap, stylized, and more memorable than volumetric realism.
6. **Speed-coupled intensity is non-negotiable** — fire density, camera shake, particle count,
   sound ALL ramp with a single `descentProgress`/altitude value, or the descent reads false.
7. **Diegetic direction beats a HUD waypoint** — light-and-door funnels + spatial audio guide the
   player; first-person pod descent is *rare*, a signature POV worth owning.

## Aboard the ship — staging a no-fail FP disaster escape
- **3 lighting zones, one direction:** calm cool cockpit → warm/amber alert corridor → red
  emergency pod bay + orange fire-glow. Dead lights *behind* the player, flickering strips *ahead*,
  the only-open bulkhead leads on (others sealed w/ red warning). No backtracking, no puzzles.
- **Spatial audio funnel:** the klaxon/engine-groan grows louder toward the pod (Web Audio
  `StereoPanner` + filter cutoff); comms/console crackle localizes the cockpit behind you.
- **Red-alert WITHOUT frame damage:** subtle red tint + ~2s strobe at ~30% opacity post-trigger,
  intensifying near the pod (encourages, never forces, a hustle).
- **Pacing rhythm:** ~10–15s quiet corridor walk → the engine explosion is the inflection (lights
  flip, hull groans, alarms spike) → the pod bay is a brief *still refuge* before eject.
- **Procedural fire/damage:** scorch decals + panel-edge particle emitters + orange bloom; hull
  groan SFX. (Reuse/extend our fire + smoke systems.)

## The descent — the "beautiful" showpiece (the cheap-but-stunning stack)
Drive EVERYTHING off one `descentProgress: 0→1` (altitude). Two phases: **(1) orbital→plasma
entry**, **(2) glide→surface**.
- **Planet limb glow** = a 2nd slightly-larger sphere, back-side Fresnel (`dot(viewDir,normal)`)
  glow — cheap fake atmosphere, no scattering sim.
- **Plasma/fire** = additive-blended billboard/point particles streaking past the viewport,
  camera-relative velocity, spawn-rate + speed ramped by `descentProgress`.
- **Lighting/color shift** = `FogExp2` color sampled from a 1D ramp texture (blue→orange→tan) by
  altitude; density DROPS as you near the ground → desert detail "pops in" (illusion of approach
  without aggressive camera moves).
- **White flash on atmo entry** (ODST) = brief full-screen white quad → fades to reveal the
  landscape (reads as the eye adapting from plasma glare).
- **Viewport heat-glow + distortion** = a screen-space shader on the glass (noise-driven minor
  warp + edge glow), intensity ramped down as speed bleeds off; optional hairline stress crack.
- **Camera shake** = Perlin bursts ramping with g-force/speed during atmospheric braking, then
  decaying. Pair with a low-frequency rumble.
- **Tumbling viewport reveal** = the pod slowly rotates so the small window drifts across: the
  burning ship → black space + stars → the planet/horizon → the desert resolving. Stage the ship
  explosion *through the frame* (fire first, then the silhouette passes by). The limited window +
  rotation creates the "you only see part of it" tension.
- **Interior lit by the exterior** = the warm amber cabin gets washed by the shifting outside
  light; the descent is felt *inside* the pod. Dark-warm interior vs bright exterior = fragility.

## The pod interior + the parachute gag
- **Viewport: small, high, angled down-forward** — player sees ~40–50% of the action, never
  omniscient. The constraint IS the tension.
- **Cabin = warm amber/red light**, dense-but-readable panel (4–6 small lit dials/screens: altitude
  dropping live, a parachute status green→yellow→red), padded restraints framing the view.
- **Keep interactivity to 2–3 things** (look around · the parachute lever · later the door button) —
  restraint keeps focus on the viewport, not busywork.
- **The parachute lever = a chunky 3D prop** (not a button), real pivot/mass. Escalate per pull:
  **pull 1** smooth ~45° + a satisfying click (hope) → **pull 2** sticks halfway, creak/strain →
  **pull 3** SNAP (handle breaks/springs back) + a red light flashes + a pneumatic hiss. Comedy =
  the *physical certainty of failure*, taught by interaction, no words.
- **Gag timing is load-bearing** — it must NOT delay landing. Stage the pulls *just before*
  impact (the chute was only ever going to slow you; it fails; you hit harder). Matches our
  "impact on a timer regardless" plan.
- **Door-blow wake** = hard hit + screen shake + flicker → ~2s dazed muffled silence → one red
  "BLOW / EGRESS" button → explosive charge, door tears away, dust + wind rush in. Claustrophobia
  → openness = visceral relief.
- **Depth discipline (rule-7):** the viewport frame, bezels, restraints, cable ducting need real
  modeled depth (~10–15 cm) so the close-up interior never reads paper-thin.

## ⚠ One tension to resolve (flagged for the user)
Much of the ship-disaster *environmental storytelling* canon leans on **dead crew** ("ALL PODS
LAUNCHED EXCEPT POD 7," a slumped co-pilot). Our fiction is a **lone pilot** — so that doesn't fit
as-is. Recommended substitute: tell the story through **failing ship SYSTEMS** (console readouts:
ORBIT ACHIEVED → ⚠ CORE TEMP CRITICAL → HULL BREACH) + a tiny personal touch (a photo/mug in the
cockpit that humanizes the pilot in 2s), not bodies. User to confirm strictly-solo vs. a hint of
"others."

## Sources (selected)
- Subnautica Lifepod 5 / Aurora (wiki) · Mass Effect 2 Normandy prologue · Dead Space intro
  (Screen Rant) · Halo 3: ODST "Prepare to Drop" (Halopedia) · Half-Life 2 City 17 prologue
  (Medium) · Firewatch opening (My Met Media, Inverse) · Outer Wilds open (GameHelper).
- threejs atmosphere-on-the-cheap (discourse) · curl-noise FBO particles (Maxime Heckel) · threejs
  Fog fundamentals + hacks · Star Citizen re-entry (TEST Squadron) · ODST drop POV (YouTube) ·
  The Martian VFX (fxguide) · Apollo 13 re-entry (SlashFilm).
- Alien Isolation sound/light design · System Shock + Prey environmental storytelling
  (GameDeveloper, TheGamer) · horror level design (GameDeveloper) · spatial audio navigation.
- Halo ODST drop pod + Subnautica lifepod interiors · NASA Crew Dragon / Apollo CSM / Soyuz panels
  · Mechanical comedy in games (Polaris) · Diegetic interface (TV Tropes / All The Tropes).
