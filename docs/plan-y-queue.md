# Y-queue plan — cockpit Mk-III + hallway truth + pod consistency (2026-07-04)

User-approved process: this plan is READ + AMENDED BY THE USER before implementation.
Collaborative design gates where marked ⏸. Source feedback: steering-archive 2026-07-04
(morning walk-test). Branch campaign/escape-pod-intro.

## Y1 — COCKPIT Mk-III: the glazed canopy SHELL (the structural fix)

**Diagnosis of why 2 attempts failed:** both kept the lofted D-section hull and cut windows
INTO it — so the hull stayed a tunnel and the glass stayed "a window at the front." The
reference (Falcon-class) is the opposite: the front section IS the glazing — a glass shell
on a metal skeleton, with almost no opaque hull forward of the pilot.

**The design (what will be built):**
1. DEMOLISH the cockpit's front half: everything forward of the seat line — wall, ceiling,
   ribs, the current canopy — deleted. Kept: the seat, the front console, the floor, and the
   AFT half (the ribbed arched hull behind the seat, which the user likes).
2. ONE transition ring where the aft hull ends: a clean structural hoop (the "collar") the
   canopy springs from.
3. THE CANOPY SHELL: a segmented low-poly glass dome/barrel forward of the collar —
   ~10-14 flat trapezoid panes arranged in 2 bands (a lower ring of tall panes + an upper
   ring converging to a crown), following a dome profile so glass wraps LEFT, OVERHEAD, and
   RIGHT of the seat continuously down to a low sill (~0.5m). Every pane edge carries a
   visible METAL SKELETON member (8-10cm wide, 12-15cm deep, rivet studs at nodes) — the
   glass sits IN the skeleton, so alignment is by construction (no glass-vs-hull mismatch
   possible).
4. From the seat: glass at 9 o'clock through 3 o'clock and straight up; the console sits
   under the forward panes; the horizon/planet unobstructed.
5. The exterior hauler nose becomes a matching glazed dome (silhouette-level).
6. Colliders rebuilt for the new shell (rule 9), motion probe the full perimeter.

⏸ **DESIGN GATE (user): GREYBOX FIRST.** Build the skeleton + pane layout as a quick
greybox, shoot it from the seat (look-left/up/right/forward) + outside 3/4, and show the
user BEFORE glazing/detailing. The user adjusts pane count/angles/sill from real frames.

## Y2 — HALLWAY TRUTH PASS
1. **Real windows:** delete the star-backdrop ("fake window"). The viewport panes become
   genuinely transparent glass showing the ACTUAL space sky. To keep real space from reading
   as empty black at that azimuth: densify the real starfield dome (more/brighter stars —
   a sky.ts change that also improves the cockpit view) rather than faking a backdrop.
2. **Z-fighting sweep:** fix coplanar overlaps at (a) the hallway↔cockpit junction,
   (b) both sides of the crew-quarters entrance, (c) the airlock/pod entrance. Method: a
   slow camera pass along each junction hunting flicker, then offset/trim the overlapping
   panels (real geometry fixes, not polygonOffset hacks). Re-shoot moving-camera pairs.
3. **No emojis:** strip the 🔥 from the engine-fire prompt + sweep every intro prompt/HUD
   string for emojis.

## Y3 — POD CONSISTENCY (boarding → descent → landed, no state flips)
1. **The doorway "wall" glitch:** diagnose the black lower half seen through the first-open
   door (suspect: the pod deck/base sits above the collar floor, showing the deck edge/
   under-floor band). Fix = align the pod deck to the collar floor or build a proper sill/
   step that reads intentional. Also verify the KCC fits the doorway cleanly; widen the
   aperture if the probe shows friction (keeping the door design).
2. **Interior Mk-II, from scratch:** RIP OUT all interior consoles/levers/detail — BOTH
   generations (the walk-test shows the old + new versions coexisting = a duplicate-build
   bug; root it so only one interior path can ever build). Rebuild clean and fitted: seat
   (kept) + ONE integrated console unit + the eject assembly + the parachute lever + tidy
   conduits that live INSIDE the wall line (the seated view showed pipes clipping through).
   The messy left-side lever assembly is removed and redesigned as part of this.
3. **E-to-sit fix:** replace the strict gaze gate with a generous inside-the-pod proximity
   gate (inside + E = sit, first press, every time).
4. **ROTATE-THEN-EJECT (new beat):** after sit + seal, the pod mechanically rotates in its
   docking cradle (player inside, felt + heard) so the porthole faces OUT into open space;
   then the eject prompt. (Angle + trigger: user question below.)
5. **Interactive lever pulls:** each E visibly pulls the parachute lever down-and-return;
   the 3rd pull snaps the handle off (it breaks visibly and stays broken).
6. **Door flush, PROVEN:** a new rig probe reads the door pivot at EVERY sealed state
   (bay pre-open, sealed, rotate, eject, descent, parachute, impact, wake) and gates
   rotation == 0 exactly; fix whichever phases still drift.
7. **Collision, ONE state forever:** the landed pod's walkable colliders are built at the
   CRASH moment (before the player can ever move), never added/removed afterwards — no
   step-out state flip, no trapped-inside window. New torture probe: enter/exit the doorway
   repeatedly across the wake→step-out→tutorial states; never blocked, never fall-through.
8. **The base/ground visual change at landing:** find what swaps (suspected: the unify
   exterior-skin/base build at step-out) and make the landed pod visually identical from
   crash → forever.

## Y4 — VERIFY + WRAP
- New gates: door-flush-all-phases · sit-first-press · doorway-torture (enter/exit ×6 across
  states) · z-fight junction pans · the rotate beat in smoke-intro.
- Adversarial gates (3 lenses + refuters) on the Mk-III cockpit and the Mk-II pod interior.
- Full suite (verify:all, smoke, walk gates, persistence, bench) + collision-audit delta.
- Fresh build + server on 4173 + summary.

## Execution shape
Wave 1: Y1 greybox (⏸ user gate) ∥ Y3 diagnosis probes (door-wall glitch, sit gate,
collision timeline, base-change — findings before fixes). Wave 2: Y1 full build (post-gate)
∥ Y3 fixes ∥ Y2. Wave 3: Y4. Per-unit commits; modeler agents own single files; sequence.ts
stays main-loop.
