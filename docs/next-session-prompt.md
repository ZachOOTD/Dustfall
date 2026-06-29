# ▶ Escape-pod intro · Phase 2 (the descent showpiece) — C17 — `campaign/escape-pod-intro`

**Campaign ACTIVE** (`status: active`). Phase 2: **T2.1 ✅ (C14+C15), T2.2 ✅ (C16).** C17 = **T2.3 — the tumbling
reveal + interior-lit-by-exterior**, the LAST Phase 2 unit → then the Phase 2 milestone walk-test. Boot from
`docs/campaign/campaign-state.json` + `docs/roadmap.md` (not chat memory).

## Phase 2 so far (don't redo)
- **C14 — descent VISTA** (`podScene.ts`): a `descentProgress`-driven orbit→atmosphere→desert fall through the round
  porthole (planet + Fresnel atmosphere limb + starfield → cross-fade to a barchan dune ground/horizon/sky). Shaders
  `PLANET_VS/FS`, `ATMO_FS`, `STAR_FS`, `LOWALT_FS`. Gate-passed @ beauty 8.
- **C15 — cabin interior-lit-by-exterior**: `setDescentProgress` drives the porthole-spill light (`vpGlowLight`) + the
  hemisphere `cabinFill` cool→warm as the dawn desert swells (driver `dawn=clamp((p−0.25)/0.6)`).
- **C16 — re-entry FX**: plasma (`PLASMA_FS`, white-hot core + slipstream, clipped to the porthole) + heat-shimmer
  (`SHIMMER_FS`) + a white flash + a speed-coupled shake, on a shared `re=max(0,1−((p−0.24)/0.16)²)` curve (peak p≈0.24,
  gone by ~0.40). Visual half in `podScene.ts`, felt half in `sequence.ts` `tickDescent`.
- The descent beat is `sequence.ts` `tickDescent` (seated FP, looking −Z at the porthole, `setDescentProgress(progress)`
  over `DESCENT_DURATION=8s`). The eject + ship-explode beats precede it (`tickEnterPod`, `tickShipExplode`).
- Rig: `node scripts/rig-shot.mjs --scenario=pod-interior --descent=<0..1>`; `preview_screenshot` works for the offset pod.

## C17 — T2.3: the tumbling reveal + interior-lit-by-exterior
The vision: just after eject + the ship explodes, the pod **tumbles**, and through the window the view **drifts across
ship → space → planet → desert** as it stabilizes into the descent — the explosion staged through the frame, the cabin
washed by the shifting exterior light. This is the most architecturally-involved T2 unit (it adds ROTATION + sequences
the reveal). Scope:
1. **The tumble (scripted camera/pod rotation)** — during the transition from ship-explode → descent (or the very start of
   the descent), rotate so the porthole sweeps the view. The seated FP camera is otherwise fixed-look; the tumble is a
   SCRIPTED rotation over a few seconds that the player rides (then it settles to the stable −Z descent look). Decide:
   rotate the camera, or rotate the pod's vista group — whichever reads as the capsule spinning. Settle smoothly into the
   descent's stable framing (don't fight the seated camera contract longer than the tumble; restore the look at the end).
2. **Stage the explosion reveal THROUGH the frame** — as the window sweeps past the (greybox so far) exploding ship, the
   blast reads through the porthole (tie into the existing `tickShipExplode` / `flashScreen` + the ship scene). The window
   drifts ship → space (stars) → the planet below → into the descent. (The ship is greybox until Phase 3 — stage the
   reveal with what's there + the FX; the hero ship is Phase 3.)
3. **Interior-lit-by-exterior through the tumble** — extend C15's `vpGlowLight`/`cabinFill` hook so the cabin light tracks
   the TUMBLE (washes of explosion-orange, then cool space, then the planet glow) — not just altitude. The cabin should
   catch the swinging exterior light as the window sweeps.
- Hero-ish (camera/staging + light) → likely a main-loop + procedural-modeler collaboration; gate the visual reveal ONCE.
  The MOTION (the tumble feel) is a walk-test item — get the staging/look right in stills + the felt spin is the user's call.
- **This COMPLETES Phase 2** → the **Phase 2 milestone walk-test** (the whole beautiful descent: eject → tumble/reveal →
  re-entry → the calm fall → the parachute gag). `/campaign-approve` releases Phase 3.

## Known Phase-2 residuals (sev-3 — address opportunistically / walk-test)
- Re-entry (C16): the white-hot core could go a touch whiter/larger; the vista is dim (glimpsed, not framed) at the
  plasma peak — optional polish.
- Descent (C14): the d05↔d09 scale progression + the felt MOTION/pace of `descentProgress` over the ~20s fall is a
  walk-test item (stills can't judge it); d05 is the softest vista frame.
- These are all things the user will feel at the Phase-2 walk-test — surface them then.

## Campaign rules
ENRICH-NOT-CUT · hero/FX → procedural-modeler + the adversarial gate (run it on hero assets + the visual reveal; lighter/once
on FX-over-existing + integration; own-loop preview is fine for a contained light/camera tweak) · anti-punt · behind
`FEATURES.escapePodIntro` (off) · no save bump · `verify:all` (600s, real exit, NOT piped through `tail`) · commit each
cycle · checkpoint = per phase (**next pause = the Phase 2 milestone, after T2.3**).

## Cost note
Phase 2 so far ~3.0M (C14 vista 2.4M [the big one] + C15 0.15M + C16 ~0.45M). T2.3 (camera/staging + light + 1 gate) ~
0.4-0.7M. Keep the gate to ONCE; the tumble FEEL is a walk-test judgment, not a stills-gate one.
