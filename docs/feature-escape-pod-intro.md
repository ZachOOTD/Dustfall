# Feature: Escape-Pod Intro Sequence — VISION (⏳ awaiting your sign-off)

**This is the captured vision, not yet a build plan.** It's the source of truth for how the
intro should *play, look, and feel* — written from the 2026-06-22 vision interview. Read it,
correct anything that isn't exactly what's in your head; once you sign off, we do (1) a
reference-research pass and (2) `/feature-slice` to turn this into a phased, buildable plan.

**Context:** a dedicated solo session, OUTSIDE the campaign loop. Supersedes the deferred
backlog item "⑯ drop-pod-intro-cutscene." Build behind a feature flag (`FEATURES.escapePodIntro`)
so it can't break existing saves while in progress.

---

## 1. Premise / fiction

You're the lone pilot of a worn cargo hauler that has just reached orbit over the desert
planet — unsure what's down there. Moments after arrival, something goes catastrophically
wrong: the engines fail and fire, the ship is dying. You flee to an escape pod and eject as
the ship explodes behind you. The pod's parachute fails on the way down; you crash into the
dunes, black out, and wake as the sole survivor — with nothing. Stepping out of your own
wrecked pod and prying it for parts is your first act in the world.

The whole game opens on this. It's the player's introduction to the tone (lonely, hostile,
beautiful) and to the core loop (salvage + craft), taught through their own crash.

---

## 2. Tone · pace · camera

- **Tone:** urgent and violent during the disaster + crash, but **beautiful** during the
  descent (the view through the viewport). Lonely throughout — one pilot, no crew.
- **Pace:** a longer, **interactive cinematic** — a free-roam intro aboard the ship, then a
  ~30–60s descent. Never a fail-state; pressure comes from atmosphere, not difficulty.
- **Camera:** **first-person the entire time** — walking the ship, seated in the pod (look
  around + interact via mouse-look), through the crash, and out into the desert.
- **Plays every new game; not skippable** (for now — we may revisit). The current spawn
  flow is retained for **dev mode only**.

---

## 3. The sequence, beat by beat (the spine)

> Per beat: **what happens · player agency · look · audio.**

### Beat 0 — Cockpit arrival
- **What:** the game opens with you **seated in the bridge/cockpit** of the hauler, having
  just arrived in orbit. The planet fills the window below.
- **Agency:** you can sit and take it in; free to get up when ready (no timer).
- **Look:** cramped, worn, utilitarian single-pilot cockpit; the big forward window onto the
  huge desert planet + the black of space.
- **Audio:** quiet cockpit hum / ambient ship systems.

### Beat 1 — "Check the engines"
- **What:** a **screen/light flashes a prompt** (diegetic) — *check the engines*. You get up
  from the seat and head out of the bridge through a door.
- **Agency:** get up, walk out (player-initiated).
- **Look:** the cockpit screen lighting up; the bridge door.
- **Audio:** a soft alert chirp; footsteps; the door.

### Beat 2 — Corridor → the engines are on fire (the disaster)
- **What:** you walk down a corridor toward the engines. **Reaching the back of the corridor
  triggers the disaster:** the engines are on fire behind a door, alarms + lights start
  flashing. (Trigger = reaching that point, not a timer.)
- **Agency:** walk the corridor; then turn for the pod (the pod is in this corridor).
- **Look:** worn industrial corridor → **fire behind the engine-room door**; calm lighting
  flips to **hard red-alert flashing**.
- **Audio:** the calm hum gives way to a **klaxon**, distant explosions, fire crackle, hull
  groan.

### Beat 3 — Into the escape pod → eject
- **What:** you reach the **escape pod** in the corridor, climb in, **sit in the seat**, and
  pull a lever / hit a button to **eject**.
- **Agency:** enter pod, sit, trigger eject.
- **Look:** the pod hatch; the tight capsule interior (one seat, a small control panel, the
  viewport, flashing lights).
- **Audio:** the hatch; you settle in; a charge-up; then the **eject — a heavy thunk + whoosh**.

### Beat 4 — The ship dies
- **What:** right after you eject, through the viewport you watch your **ship explode**.
- **Agency:** you watch (you can look around — the pod may be drifting/tumbling, see §4).
- **Look:** the hauler exterior, then a **violent explosion + debris** against space.
- **Audio:** a muffled, concussive **boom** (felt through the hull) + debris pings.

### Beat 5 — The fall (atmospheric entry + descent)
- **What:** the pod falls toward the planet — ignition/launch feel, then atmospheric entry,
  then descent. Through the viewport: the planet below, the curved horizon, the desert
  growing. **This is the "beautiful" beat.**
- **Agency:** **seated; you can look around freely + interact** with the pod interior.
- **Look (the showpiece):** planet curvature + a **glowing atmosphere band** through the
  glass; the **desert sprawl growing**; **re-entry fire licking past the viewport**; the light
  shifting **cold space → orange atmosphere glow → desert daylight**. *(Added ideas, your
  call:* the **pod slowly tumbling** so the view drifts between the planet, black space, and
  the burning wreck; the **interior lit by the exterior** — cold blue → flickering plasma
  orange washing the seat/panel → warm daylight; the **viewport edges heating to a glow**,
  maybe a hairline stress-crack; a **distant landmark/wreck silhouette on the horizon** as a
  quiet "there's a world here" hook; floating dust inside settling as gravity takes hold.*)
- **Audio:** a building **re-entry roar**, the pod **rattling/creaking**, hull stress.

### Beat 6 — The parachute (the gag setup)
- **What:** deep enough into the atmosphere, a **light flickers on** beside a lever —
  *deploy pod parachute*. You pull it → **nothing**. Pull again… again (~3 pulls) → the lever
  **snaps off**. No chute.
- **Agency:** you find + pull the lever (or don't — see timing below).
- **Look:** the lever light; the lever; it breaking off in your hand.
- **Audio:** the warning light tone; a **click-click-CLUNK… SNAP**.
- **Timing (to tune):** impact is on a **descent timer — you crash at the end regardless** of
  whether/when you pull. The lever gag is a cosmetic beat during the fall. We'll tune *when
  the lever lights up* vs *when impact lands* so the comedy-then-doom reads (you get the
  pulls + the snap in, then immediately hit the ground).

### Beat 7 — Impact + blackout
- **What:** you smack into the desert and black out.
- **Look:** a **violent jolt**, dust + debris, the viewport cracks/spiderwebs (*added*), a
  **hard cut to black**.
- **Audio:** a huge **crash** → abrupt **ringing silence**.

### Beat 8 — Wake + blow the door
- **What:** you come to inside the pod — **eyes open, muffled, ringing, lights flashing**. Hit
  a button to **blow the pod door** open into the desert.
- **Agency:** orient, find + hit the door-blow button.
- **Look:** dim, smoky, flashing interior; the door blowing open onto bright desert.
- **Audio:** muffled tinnitus ringing → systems → the **door blowing** → desert wind in.

### Beat 9 — Step into the desert (the reveal)
- **What:** you step out — **this is your spawn point**, likely the **dunes**, **just after
  dawn**. A gentle "explore your surroundings / the pod" beat.
- **Look:** the dunes at low warm dawn light, long shadows; the pod **half-buried in the sand**
  from the impact (*added*).
- **Audio:** wind, sparse desert ambience; the score settles.

### Beat 10 — Salvage + crafting tutorial (your own pod is the first wreck)
- **What:** **scrap is scattered around the pod exterior.** You pick it up, **craft a scrap
  machete** (which becomes the pry tool), then walk to the **back of the pod** and **pry its
  salvage panel** — the panel falls off and you pull the parts out. This teaches **both
  crafting and salvaging** on your own pod.
- **Agency:** pick up scrap → craft → pry → loot.
- **Look:** the pod's back panel — like world salvage panels but **newer / less rusted** (it's
  a newer craft). Scrap pieces on the sand.
- **Audio:** pickup; the craft tick; the pry creak + the panel popping free.

### Beat 11 — The parachute payoff gag
- **What:** as you finish salvaging the back panel, the **parachute you fought to deploy pops
  out the top of the pod** — *now* it works, after you've already crashed. The comedy button
  on the whole opening.
- **Look:** the chute bursting/unfurling from the pod crown.
- **Audio:** a comedic **fwoomp** + flutter.

---

## 4. Look & art direction

- **Art-style anchor:** keep the game's **existing aesthetic** (weathered, stylized,
  procedural sci-fi/desert). The references in §7 are for **composition + feel only**, not a
  style change.
- **The hauler:** cramped, worn, utilitarian, single-pilot. Interior = cockpit + a corridor;
  exterior = the silhouette we see explode (engines at the rear that catch fire). Palette beat:
  calm warm cockpit → **hard red-alert flashing** when it goes wrong.
- **The pod:** **rounded capsule.** Interior = tight, one seat, a small panel (parachute
  lever + door-blow button), the viewport, flashing lights. Exterior = the capsule, the back
  **salvage panel**, the **crown** the chute erupts from. **Viewport size:** big enough to see
  the ship explode + the planet/horizon, small enough to feel **a bit claustrophobic / "you're
  not quite sure"** — dialed in during build.
- **The descent** is the visual showpiece (see Beat 5 + the added ideas).
- **Diegetic-first:** information comes from the world (the cockpit screen, the pod's lever
  light, the door button) rather than UI overlays where possible — consistent with the game's
  diegetic-survival direction. (A minimal objective hint like "get to the escape pod" is TBD —
  diegetic preferred.)

---

## 5. Audio & music

- **SFX arc:** quiet cockpit hum → **klaxon + explosions + fire crackle + hull groan** →
  **eject thunk/whoosh** → muffled explosion **boom** → **re-entry roar + pod rattle** → the
  lever **click-click-snap** → **crash → ringing silence** → muffled wake → **door blow** →
  desert wind. Plus the pickup/craft/pry tutorial sounds and the chute **fwoomp**. (Everything
  procedural via the existing Web-Audio approach.)
- **Music:** yes — score the key moments to enhance the atmosphere, in a **similar vibe to the
  game's current music**: e.g. a tense sting through the disaster/escape and a **beautiful
  swell over the descent**, easing as you step into the desert.

---

## 6. Mechanics & integration (decisions that touch existing systems)

These are choices this feature commits to — the `/feature-slice` will formalize each:

1. **New game = this intro.** It fully replaces the current new-game spawn. **No starting
   loadout, no companion** — you start with nothing. First spawn = stepping out of the pod
   (dunes, just-after-dawn). The cave/companion remain *findable later*, not granted.
2. **Current start → dev-mode only.** The existing spawn path is kept behind dev mode for
   testing, not shown to new players.
3. **`scrap_machete` becomes the pry tool** (joining/replacing `scrap_bar`). This **revisits
   D261** (which deferred the scrap_bar→machete unification); the feature adopts it so the
   tutorial teaches one tool. The slice will decide whether scrap_bar is retired or both work.
4. **The pod's back panel reuses the salvage-panel system** — a **newer/cleaner variant**
   (less rust). The scrap-on-the-ground + craft-then-pry is the **first crafting + salvage
   tutorial**.
5. **The parachute is a tracked prop** — failed lever during descent → pops out the pod crown
   on salvage completion (a one-time scripted payoff).
6. **Feature flag** `FEATURES.escapePodIntro` (default off until shipped); **no SAVE_VERSION
   bump** unless unavoidable (D81 — don't bump lightly).

---

## 7. References (feel + composition only — NOT art style)

- **ODST drop-pod** — the sealed-capsule descent + the cramped, instrument-lit interior.
- **Star Citizen re-entry** — the atmospheric-entry beauty (curvature, atmo band, plasma).
- **Dead Space corridor** — the claustrophobic, alarm-lit ship disaster + dread.
- *(We'll run a research pass for more before building — keeping our own art style.)*

---

## 8. Scope reality + phasing (for the feature-slice)

This is a **large, multi-session feature** — essentially the game's opening *level*:
- **Two hero models:** the hauler (cockpit + corridor interior **and** the exterior that
  explodes) and the escape pod (interior **and** exterior). Both must be high-quality →
  **procedural-modeler** territory, iterated to a bar.
- **FX:** the ship explosion, re-entry plasma/fire, atmosphere/lighting shifts, impact dust,
  the chute.
- **A long scripted, interactive, first-person sequence** with many beats + state.
- **Tutorial integration** (crafting + salvage) + new-game-flow replacement + audio + music.

The `/feature-slice` will decompose this into ordered sub-tasks (each a beat/system) with a
**Definition of Done = the sequence actually playing as described**, and a **scope-cut order**
(e.g. ship-interior fidelity, how much corridor is walkable, FX richness) so we can phase it
and ship a coherent vertical slice first, then enrich — rather than promise it all at once.
**Build discipline:** real-in-game (first-person) view rendering, build→view→critique→iterate,
and **a walk-test sign-off from you per beat** (this is pure feel/look — you validate, I don't
self-certify).

---

## 9. Open / to-decide / to-research (NOT locked)

- **Impact timing** vs **lever-light timing** during the descent (tune for the gag — Beat 6).
- **Exact viewport size** (dial in during build).
- **Objective hinting** style (diegetic vs a minimal prompt for "get to the escape pod").
- **scrap_bar fate** (retire vs keep alongside the machete) — D261 follow-through.
- **What's in the pod's salvage panel** (starting supplies — quantity/kind).
- **Music specifics** (how many cues, where).
- **Reference research** pass before building.

---

## Enrichments + decisions — APPROVED (2026-06-22)

Approved after the reference research (`docs/research/escape-pod-intro-references.md`). All folded
into the build plan; detail/technique in the digest.

- **E1** Diegetic guidance, zero HUD waypoint (3 lighting zones + only-open-door + spatial-audio funnel toward the pod).
- **E2** The ship tells its own death via **consoles** (`ORBIT ACHIEVED → ⚠ CORE TEMP CRITICAL → HULL BREACH`); the "check engines" prompt is diegetic; a 2-second human touch (photo/mug) for the lone pilot.
- **E3** Pacing rhythm: calm → the engine explosion as the sharp inflection → the pod bay as a brief still refuge before eject.
- **E4** The `descentProgress`-driven effect stack (Fresnel atmosphere glow · additive plasma past the glass · fog color-ramp blue→orange→tan · white flash on entry · viewport heat-shimmer · speed-coupled shake · desert detail pop-in).
- **E5** The tumbling viewport reveal (the window drifts across burning ship → space/stars → planet → desert; the limited frame is the tension).
- **E6** Interior lit by the exterior (cabin washed by the shifting outside light; fragility through contrast).
- **E7** The aftermath-silence beat (hard cut to black → dazed ringing → the BLOW-DOOR button → step into the dawn dunes in near-silence; the pod half-buried).
- **E8** A horizon hook on the reveal (a distant landmark silhouette pulls you onward — reuses the M5a horizon-silhouette system).
- **E9** The parachute lever escalated (chunky 3D prop; pull 1 click → pull 2 creak → pull 3 SNAP + red light + hiss; staged just before impact so it never delays the crash).
- **E10** Tutorial by discovery (scrap glints in the sand; craft + pry taught with minimal diegetic prompts; the chute pops the crown as you finish salvaging — the comedy button).

**DECISION — strictly solo + clean.** The pilot is alone; the disaster is told through **failing
ship SYSTEMS** (console readouts + a tiny personal touch), **not** dead crew / "other pods." No
bodies, no crew hints.

**DECISION — pod identity = INDUSTRIAL MODULAR BOX** (Direction B; chosen 2026-06-22). A boxy /
short-cylinder "van + spacecraft" pod with a **visible steel exoskeleton + bolt-off modular
panels**, external cables/struts, grey-beige paint under rust + sand abrasion, and a **small,
off-center rectangular viewport in channel-steel**. Explicitly NOT an ODST carapace clone. Why it
won: the modular panels *read as strippable from the silhouette* → the pod visually teaches "you
can take this apart," which IS the first-salvage tutorial; and it reads as a worn cargo-hauler's
gear + a human-scale temporary shelter. **Viewport stays small/offset/recessed** (anti-ODST + the
claustrophobic-window intent). The newer/less-rusted salvage-panel variant (Beat 10) lives on the
back of this box. Full reference + the rejected directions: `docs/research/escape-pod-design-variety.md`.
The procedural-modeler will iterate the model to a quality bar against this anchor, success-gated on
the **player's-eye view of the half-buried pod**.

## BUILD PLAN (feature-slice → dedicated campaign · 2026-06-22)

**Anchored to:** GDD opening/onboarding + the salvage/craft core loop + the lonely-survivor tone.
**Scale:** a dedicated campaign (NOT a 2-3 session slice) — checkpoint=**phase**, until=**plan-complete**,
max-cycles **150** (guardrail), **ENRICH-not-cut**. **Definition of Done:** a new game plays the
entire sequence (Beats 0-11) exactly as the vision describes, hero-quality, behind
`FEATURES.escapePodIntro`. **Build discipline:** hero geometry/FX → the **procedural-modeler**
agent; **real first-person in-game-view** visual gate; build→view→critique→iterate to a quality
**bar** (5-8 rounds new hero elements, 3-5 tuning); **anti-punt**; per-PHASE walk-test sign-off by
the user (feel/audio = the human gate). `npm run verify:all` (tsc + placement/colliders) stays
green each cycle; **no SAVE_VERSION bump** unless unavoidable (D81).

### Sequencing principle
**Phase 0 builds the whole thing in greybox first** (the full sequence playable end-to-end with
placeholder art) so we feel the pacing + prove the state machine — then each later phase raises one
area to hero quality. This is NOT cutting; every beat gets its hero pass. Enrichment order leads
with the **pod** (it's on-screen most + a dependency for the descent interior AND the salvage
exterior), then the **descent showpiece**, then the **ship**, then **crash/tutorial polish**, then
**audio/music**. Order is adjustable via steering.

---

### Pre-build review — risks & decisions (2026-06-22)
A critical pass before launch. Most are **resolved here** + folded into Phase 0; two are flagged
feel-risks to watch.

**Decide-now / architecture (folded into Phase 0):**
- **R1 Save marker + mid-intro quit.** The intro plays every NEW game, but a LOADED (post-intro)
  save must NOT replay it. → additive save field `introComplete` (legacy saves default **true** →
  never replay; D81-safe, no version bump). The intro is **not saved mid-sequence**; quitting
  mid-intro restarts it next load; the **first real save is at the desert spawn**.
- **R2 World-loading orchestration.** The intro is its own context; the heavy desert world must be
  **ready the instant you step out** (no hitch at the worst moment). → generate the desert world in
  the background **during the descent** (hidden), so the half-buried pod + dunes are ready at impact.
  The ship/pod/descent run in a lightweight intro scope (the full procgen world isn't live yet).
- **R3 Handoff seam.** The pod is ONE object **re-contextualized** from cinematic prop → real
  salvageable wreck half-buried at the spawn (camera/control transfer; the world positioned so the
  pod sits in the dunes). Treated explicitly in Phase 0 (T0.4) + polished in Phase 4 (T4.2).
- **R4 The sequence state-machine is the spine → contract first** (new T0.0 spike): how beats are
  defined, how input is gated, how the FP camera is driven (scripted vs free-look), beat-completion
  signaling, **Esc/pause behavior mid-cinematic**, the dev skip/jump. Confirm the **KCC controller**
  works on a bespoke **ship floor** (it's built for the terrain heightfield + POI colliders — a
  different collision context) — surface any issue in T0.0.
- **R5 `scrap_machete` as the pry tool is a LIVE-game change** (existing wrecks, `scrap_bar`
  holders, saves), not intro-local. Finalize **D261** (recommend: machete pries + scrap_bar still
  works → additive, strands no one) **before** T4.3 depends on it.
- **R6 Entry point.** Decide menu→new-game→intro vs the current "click to begin" overlay (T0.1).

**Feel-risks to watch (build-time):**
- **R7 Parachute-gag fallback.** The player paces their own looking-around — if they never notice
  the lever, the gag dies. → the lever light + audio actively draw the eye, AND a fallback (it
  auto-rattles/snaps near impact) so the comedy reads even if ignored. (Greybox in T0.3; tuned P1/P2.)
- **R8 First-time tutorial clarity.** Beat 10 is the player's FIRST contact with scrap + crafting +
  inventory + prying at once; "minimal diegetic" can lose a new player. → deliberate onboarding +
  a **fresh-player playtest** (Phase 4); clarity beats purity here.
- **R9 Ship-walk interest.** Keep the opening corridor from being a dead A-to-B (HL2-tram lesson) —
  the consoles/window/personal-touch/building-wrongness must carry it.
- **R10 Accessibility / photosensitivity.** The red-alert strobe + the white entry-flash + the
  tumbling pod + camera shake = epilepsy + motion-sickness risk. → flash-cap + reduce-motion /
  reduce-flashing options, baked in from the start (painful to retrofit).

**Phase order:** **pod-first** (confirmed) — front-loads the hardest, most novel, most-on-screen
work (pod + descent = the signature moment) to de-risk it early; the greybox spine covers the whole
chronology regardless.

### PHASE 0 — Playable greybox spine + new-game flow  *(feel the whole sequence)*
- **T0.0 State-machine contract spike** `[ordered]` — design + stub the sequence/beat framework
  (R4): beat definition, input-gating, FP-camera driving (scripted vs free-look), beat-completion,
  Esc/pause behavior, dev skip-to-gameplay + jump-to-beat hooks. Confirm the KCC works on a ship
  floor (R4). Small design note in the feature doc; no art.
- **T0.1 New-game flow + save marker** `[ordered]` — `FEATURES.escapePodIntro` (default off);
  new game → intro (old spawn → dev-mode only, D-entry); the **`introComplete` save field** (R1,
  legacy=true); mid-intro = unsaved, first save at spawn; the **entry point** (R6).
- **T0.2 Greybox ship** `[ordered]` — FP walk: cockpit (seated start) → "check engines" → corridor →
  reach-the-end disaster trigger (placeholder alarms/fire) → pod → eject. Box placeholders. Keep the
  walk from being dead (R9 — placeholder consoles/window).
- **T0.3 Greybox descent + seated pod interaction** `[ordered]` — seated FP look-around; the
  parachute lever (placeholder) with the 3-pull→snap **+ the ignore-it fallback** (R7); a **timed
  descent** (impact regardless); placeholder viewport/planet; impact → cut to black.
- **T0.4 Greybox wake → desert handoff → tutorial scaffold** `[ordered]` — door-blow; the **handoff
  seam** (R3: the pod re-contextualized as the real spawn wreck) + **world-loading orchestration**
  (R2: desert generated during the descent, ready at impact); scrap pickups → craft machete → pry
  the back panel → chute-pop payoff (placeholder).
- **Verify:** `verify:all` green; the **`feature-escape-pod-intro` smoke check** (drive every beat
  via the dev jump-hooks → assert each advances, no soft-lock, the handoff completes) — guards the
  whole sequence against regressions across the campaign. **Iteration:** N/A (greybox — 0 rounds).
- **PHASE 0 GATE:** you walk the whole sequence in greybox + we tune **pacing/timing/flow** (this
  validates FLOW, not beauty — the art lands in later phases). The most important early checkpoint.

### PHASE 1 — The escape pod (hero) — exterior + interior
- **T1.1 Pod exterior** (procedural-modeler) — the **industrial modular box** identity: steel
  exoskeleton, bolt-off panels, cables/struts, rust + sand abrasion, the **newer salvage-panel**
  on the back, the crown the chute erupts from. **Gate:** the player's-eye view of the **half-buried**
  pod in the dunes.
- **T1.2 Pod interior** (procedural-modeler) — tight cabin: seat + restraints, the dense-but-readable
  panel, the **chunky 3D parachute lever** + the door-blow button, the channel-steel **viewport**,
  warm amber/red cabin light + flashing warning lights. Depth-discipline (rule-7) on frame/bezels.
- **T1.3 Seated-FP camera + viewport framing** — small/offset/recessed window; the look-around feel;
  interior reads against the (placeholder) exterior view.
- **Iteration:** T1.1 5-8 · T1.2 6-8 · T1.3 3-5. **PHASE 1 GATE:** the pod reads hero in + out.

### PHASE 2 — The descent showpiece *(the "beautiful" beat — E4/E5/E6)*
- **T2.1 `descentProgress` stack** — Fresnel atmosphere limb-glow + fog color-ramp (blue→orange→tan)
  + planet/horizon through the viewport + desert detail pop-in + the lighting shift; all altitude-driven.
- **T2.2 Re-entry FX** — additive plasma/fire past the glass + the white flash on entry + viewport
  heat-shimmer + speed-coupled camera shake.
- **T2.3 Tumbling reveal + interior-lit-by-exterior** — the pod rotates so the window drifts across
  ship→space→planet→desert; stage the explosion reveal through the frame; the cabin washed by the
  shifting exterior light.
- **Iteration:** 5-8 each (hero FX). **PHASE 2 GATE:** the descent reads beautiful + tense + physical.

### PHASE 3 — The hauler (hero) + the disaster staging
- **T3.1 Hauler exterior** (procedural-modeler) — the worn cargo-hauler silhouette (rear engines),
  seen through the viewport at eject. **Gate:** the FP view through the pod window.
- **T3.2 Ship explosion FX** — the blow-up (animation + particles + debris + the concussive boom),
  staged through the viewport (E5).
- **T3.3 Cockpit interior** (procedural-modeler) — single pilot seat, the big forward window, the
  consoles with the **escalating readouts** (E2: ORBIT→CORE TEMP CRITICAL→HULL BREACH) + the
  2-second personal touch.
- **T3.4 Corridor + disaster staging** — the 3 lighting zones + only-open-door funnel + spatial-audio
  funnel (E1/E3), the engine fire behind the door, red-alert lighting/strobe, "ship dying" detail.
- **Iteration:** T3.1/T3.3 5-8 · T3.2 5-8 · T3.4 4-6. **PHASE 3 GATE:** the ship + explosion + the
  diegetic guidance read hero-quality.

### PHASE 4 — Crash · wake · reveal + tutorial polish
- **T4.1 Impact + wake** — violent dust + viewport spiderweb + hard cut to black; the muffled-ringing
  flashing wake; the door blowing → claustrophobia→openness.
- **T4.2 Desert reveal** — dawn light, the half-buried pod, the **aftermath-silence** pacing (E7) +
  the **horizon hook** (E8, reuse M5a silhouettes).
- **T4.3 Craft+salvage tutorial + the gag payoff** — scrap **glints** (E10), minimal diegetic
  prompts, craft the machete (→ pry tool; **D261 follow-through**), pry the newer panel, starting
  supplies; the **chute pops the crown** as you finish.
- **Iteration:** 3-6 each. **PHASE 4 GATE:** the crash→desert→tutorial→gag reads + teaches cleanly.

### PHASE 5 — Audio + music
- **T5.1 SFX arc** — cockpit hum → klaxon/explosions/fire/hull-groan → eject thunk/whoosh → re-entry
  roar/rattle → lever click-click-snap → crash/ringing → door blow → wind; + tutorial sounds + the
  chute fwoomp. Procedural Web-Audio; **code-auditor the graph** (C16 lifecycle); SOUND → user LISTEN.
- **T5.2 Music** — cues in the game's current vibe: a tense escape sting + a **beautiful descent
  swell** + an easing as you step into the desert.
- **PHASE 5 GATE (final):** the whole sequence is scored + sound-designed; you LISTEN end-to-end.

---

### Per-system LOC ceilings (rough; the loop refines)
A new `src/world/escapePodIntro/` module (the sequence/state machine + per-beat controllers) ·
`enemies`-style hero builders for the pod + hauler (procedural-modeler) · descent FX in a focused
module · audio additions in `audio.ts`. Keep each beat-controller small; the state machine is the spine.

### Scope-cut authorization (SAFETY NET ONLY — enrich-not-cut)
Only if a gate hits a true 3-strike TECHNICAL wall, and **surfaced to the user first** (never a
silent cut). Cut order if forced: (1) the tumbling-reveal complexity → a simpler fixed-view descent;
(2) ship-explosion debris richness; (3) cockpit console-readout depth; (4) music cue count. The
**core spine + the pod + the descent beauty + the tutorial are NOT cuttable** — they're the feature.

### Reuses (existing systems + shared-memory)
Salvage-panel system + `hideAccessPanel` (Beat 10) · crafting + `scrap_machete` (D261) · M5a
horizon silhouettes (E8) · fire/smoke + particle systems (ship fire, dust) · the diegetic-survival
HUD philosophy · `web-audio-synthesis` + the C16 sustained-voice lifecycle · `game-feel-patterns`
(anticipation/follow-through) · `feature-flag-gate-and-wait` (the FEATURES flag) · the procedural-
modeler real-view gate + `iterative-polish-discipline`.

### NOT included / deferred
- Skyfall hero wreck + the cave rework (separate dedicated sessions). · The intro being skippable /
  first-boot-only (every-new-game for now; revisit later). · Multiple ship/pod variants (one each).

### D-entries likely
- New-game flow replaced by the intro (old spawn → dev-mode); `scrap_machete` as the pry tool
  (D261 follow-through); the intro sequence/state-machine architecture; the descentProgress effect
  system; any save-flow touch (aim: none/additive, no version bump).

## Next steps
1. **You review this plan** (correct/steer anything — esp. the phase ordering + the scope-cut net).
2. On your go: **`/campaign-start`** for a dedicated escape-pod-intro campaign (conclude the finished
   M11→M13 campaign first; new branch off `master`; checkpoint=phase · until=plan-complete ·
   max-cycles 150 · enrich-not-cut · visual-gate=auto · self-author=propose).
3. **`/loop /campaign-cycle`** — it runs Phase 0 first (the greybox spine), pausing per phase for
   your walk-test. You steer anytime via `docs/campaign/steering.md`.
