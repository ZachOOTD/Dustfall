# ▶ Escape-pod intro · Phase 2 (the descent showpiece) — C15 — `campaign/escape-pod-intro`

**Campaign ACTIVE** (`status: active`). Phase 2 in progress. **C14 shipped the HERO descent VISTA** (T2.1
centerpiece — gate-passed @ beauty 8). C15 picks up the **T2.1 remainder**, then T2.2/T2.3. Boot from
`docs/campaign/campaign-state.json` + `docs/roadmap.md` (not chat memory).

## What C14 shipped (so you don't redo it)
The greybox planet-disc in `src/world/escapePodIntro/podScene.ts` is replaced by a real `descentProgress`-driven
orbit→atmosphere→desert fall through the pod viewport:
- **Orbital (descentProgress 0→~0.4):** a curved Dune-desert planet (`PLANET_VS/FS` — fbm relief + soft terminator
  from a coherent object-space sun), a soft **Fresnel atmosphere limb** (`ATMO_FS`, `toneMapped:false`) + halo, a
  3-layer **starfield** (`STAR_FS`) + milky band.
- **Cross-fade → surface (~0.4→1.0):** the orbital sphere retracts/fades (`uFade`) and a **ground/horizon/sky** scene
  (`LOWALT_FS`) fades in — asymmetric **barchan dunes** with raking off-axis dawn sun, cool-trough→ochre→pale-crest
  sand palette, aerial haze, **closing scale** (d09 nearer than d05).
- Driven entirely by `setDescentProgress(0..1)` (the single animation contract); 4 ShaderMaterials disposed in
  `disposePodScene`. Module refs: `planetMat/atmoMat/starMat/lowAltMat` (+ meshes).
- Rig: `node scripts/rig-shot.mjs --scenario=pod-interior --descent=<0..1>` shoots the real through-porthole view at
  any altitude (the `--descent` flag exists). `preview_screenshot` also works for the offset pod interior.

## C15 — finish T2.1: the descent's SCENE/CABIN reaction (the bits not in the through-window vista)
The vista (the thing through the glass) is done. T2.1 also calls for the WHOLE view + cabin to react to the fall:
1. **Scene fog color-ramp** — tint the cabin/scene atmosphere across the descent (cool/blue high → warm orange→tan low),
   driven off `descentProgress`, so the whole frame (not just the window) shifts with altitude. (Don't fight the vista —
   complement it.)
2. **Cabin interior-lit-by-exterior** — the round cabin interior should warm/brighten as the dawn desert swells in the
   viewport: a `descentProgress`-driven light (or ambient/emissive shift) washing the cabin with the exterior's shifting
   colour (cool high → warm dawn glow low). This is the "lived-in, lit-by-the-world" feel; it also seeds T2.3's
   interior-lit-by-exterior.
3. **Detail pop-in** (if not already sufficient via the vista) — confirm surface/atmosphere detail resolves believably
   on approach; tune if needed.
Keep it cheap + driven off the single `descentProgress`. Hook the cabin-light/fog update where `setDescentProgress` runs
(or in `updateEscapePodIntro`'s descent beat). Light visual gate (it's scene-integration, not a new hero asset — 1-2
critics or a solo `/visual-triage`, not the full 4-critic hunt).

## Then T2.2 / T2.3 (subsequent cycles)
- **T2.2 — re-entry FX:** additive plasma/fire past the glass + a white flash on entry + viewport heat-shimmer +
  speed-coupled camera shake. Hero-ish FX → procedural-modeler + a gate.
- **T2.3 — tumbling reveal + interior-lit-by-exterior:** the pod rotates so the window drifts across ship→space→planet→
  desert; stage the explosion reveal through the frame; the cabin washed by the shifting exterior light (build on C15's
  cabin-light hook).
- **Then: Phase 2 milestone walk-test** — the user rides the descent (the felt MOTION/pace of `descentProgress` over the
  ~20s fall is a WALK-TEST item stills can't judge; the C14 gate flagged the d05→d09 motion-pace as the one thing to feel
  in real time). `/campaign-approve` releases Phase 3.

## Known residuals from C14 (sev-3 nits — address opportunistically, NOT blocking)
- d05 (mid) is the softest frame — its upper haze can read as cloud in isolation before resolving (a faint distant ridge
  silhouette would lock the desert read at the swing point).
- The dawn palette leans warm; cool troughs are present but not dominant (lever: dial `uWarm`'s grip down a touch).
- The horizon line is soft across the lower frames; the sun-glare band borders on hot at d07/d09 (watch for bloom creep
  if a later exposure pass touches it).

## Campaign rules
ENRICH-NOT-CUT · hero geometry/FX → procedural-modeler + the adversarial gate (the gate caught real defects the builder +
my own eyes missed every round — z-occluder, porthole-band mapping, cross-fade artifacts; run it on hero assets, lighter
on integration polish) · anti-punt · behind `FEATURES.escapePodIntro` (off) · no save bump · `verify:all` (600s, real
exit, NOT piped through `tail`) · commit each cycle · checkpoint = per phase (next pause = Phase 2 milestone).

## Cost note (for pacing)
C14 (the hero vista) cost ~2.4M across 5 modeler rounds + 4 gates — high, but it's THE showpiece + each gate found real
defects. For T2.1-remainder (scene/cabin integration) + similar non-hero work, run the gate ONCE/light. Reserve the full
multi-round hero treatment for genuinely new hero assets (the explosion, the tumbling reveal FX).
