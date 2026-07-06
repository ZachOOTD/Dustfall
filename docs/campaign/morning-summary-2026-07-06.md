# Morning summary — the Z-queue overnight round (2026-07-06)

Good morning. Your round-3 playtest (the 5 screenshots + the verbal notes) became a
10-unit fix queue. All 10 shipped, each verified, each committed and pushed to master and
auto-deployed. The session hit the 5-hour usage limit partway through and picked back up
without losing anything — every completed unit was committed before the cut, and the two
in-flight units were re-dispatched cleanly.

Live now at https://zachootd.github.io/Dustfall/.

## What you asked for → what shipped

**Cockpit & eject**
- The glass haze is now measured-equal across every pane (the top/edge cells matched the
  fronts — root cause was a face-winding/DoubleSide bug; all 12 cells now read 0.0% apart).
- The eject rotation is 90° instead of 180°, so the porthole swings to frame the planet and
  the ship's flank. The wake door-kick is now PLAYER-GATED — the auto-timer is gone, per your
  "nothing should happen on a timer" rule.
- The far-space approach (the pod flying toward the planet) is slowed to about half speed —
  it was moving too fast to read as real. The blackouts are shorter (the phase fades and the
  wake come-to were trimmed) so they hold attention without dragging.

**The pod (one model, everywhere)**
- The explosion-phase over-bright wash is now a contained window flare; the descent "fast
  light textures moving inside" glitch is fixed (the plasma/heat-shimmer runs ~40% slower);
  a local deck light replaces what was washing the cabin.
- The sealed-door star-gaps are gone STRUCTURALLY, not patched. The real cause (found on the
  4th report): the curved hull is cut about 6cm wider than the flat door slab on each side,
  and the old thin lip never filled that wedge — at yaw 0 the ship hid it, and rotating to
  open space exposed the stars. It's now a real box-section jamb on all four sides of both
  doors, so there's zero see-through at any angle. A new automated gate fires ~156 leak rays
  per angle and confirms zero.

**The bay / airlock**
- "Ship models poking into the pod": the umbilical plate and hoses were literally modeled
  0.5–0.6m INSIDE the pod's hull (hidden at rest, swept into view as the pod rotates). They're
  relocated onto the collar's exterior. A new gate sweeps the whole rotation and confirms no
  ship geometry enters the pod volume at any angle.
- Bonus: the airlock control panel's readout was mounted backwards, buried in the wall — it's
  now facing the corridor and readable.

**Crew quarters — the full overhaul you asked for**
- Rebuilt from "generic boxes overlapping at the back wall" into a real lived-in cabin: a
  built-in recessed bunk berth with a reading light, a bank of lockers, a fold-down desk with
  a console readout, a base storage cabinet, paneled walls with conduit and a vent. Each wall
  owns a function, so nothing overlaps. The scene-global light that used to bleed into the
  desert world is removed. The starboard viewport (real stars) is kept as the hero view.
- This got the full hero treatment: five build-and-critique rounds, then an adversarial gate
  (14 fresh critic agents across five lenses) that found three real issues — a returning
  seam on the bunk header, a pillow that read as a cube, and a dead undetailed wall — all
  fixed in a follow-up round and re-verified.

**The reactor room — replacing the "weird blocky cylinders"**
- The engine bay is now a real reactor hall composed for the through-glass view from the
  corridor: a tall containment column with a glowing core channel, coolant towers, a pipe
  manifold, a control station, a hazard rail. It has two states — a calm cool-cyan contained
  glow, and a critical hot-orange breach when the reactor fails (the fire staging is intact).
- Also hero-gated. The gate caught two genuinely serious issues that a single review would
  have shipped: the calm core wasn't glowing at all (it read as dead grey metal — now a real
  emissive cyan channel with its own light), and the glass door's center post was splitting
  the glowing core down the middle (the panes now meet seamlessly so the core reads unbroken).

**The parachute — round 2**
- The suspension lines now connect INTO the canopy fabric (they were using a build-time size
  the runtime overrides, so they hung short). The flutter is cut from ~10 seconds to about
  two. And the collapse is now gravity-truthful: the canopy pours down the pod's flank and
  wraps the cylindrical hull, pooling on the ground — verified from four angles plus a
  timing strip. The pop gag you like is byte-for-byte unchanged.

## One thing worth knowing: a scare that turned out fine

Late in verification, the "doorway-torture" gate (which walks in and out of the landed pod
six times) failed with "the doorway is blocked" — exactly the kind of thing you've flagged
before. I did not paper over it. I bisected it against the pre-queue build (where it passed),
which proved my queue changed something, then dug in: the game is fine. The walk-out gate and
the walk-in gate both pass, and the landed pod is fully enterable. What broke was the TEST
itself — when Z7 made the wake advance player-gated (your "nothing on a timer" rule), it
removed a timer that the old test secretly relied on to set itself up, so the test's player
never got unfrozen. I fixed the test to advance the real way (by walking), and it now passes
6/6 against the real geometry, with the actual check unchanged.

## How it was verified

Full intro gate suite, all green on the final merged build: the whole-intro playthrough
(12 beats), the 9-state door-flush audit, the seal-sweep (zero cracks), the rotation-clearance
sweep (zero intrusions), airlock motion, the quarters walk (colliders correct), the reactor
glass (no z-fighting), the cockpit glass parity (0.0% deviation), pod walk-in and walk-out
(and walk-out confirms zero world-light bleed into the desert), the doorway torture (6/6), the
collider coverage gate, and the production intro build. The two hero rooms each passed their
own adversarial gate plus a fix pass, and a final cross-area "journey" gate (fresh critics
checking that cockpit → quarters → reactor → landed pod read as one coherent ship) came back
clean — zero findings.

## For your playthrough (the feel items only a human can judge)

- The eject rhythm: lever pull → the 90° rotate → the blast.
- The reactor's flicker cadence at run pace (calm hum vs the critical breach) through the glass.
- The parachute flutter-and-collapse feel on approach.
- The far-space pacing (now half speed) and the shorter blackouts.
- The crew quarters at walking pace.

## Left open

The performance bench (a ~30-minute headless run) is the one item that runs separately from
the correctness gates; its result is noted where you can see it. The previously-deferred items
(the ship-explosion polish through the eject frame, the audio mix listen-pass, and the
out-of-loop Skyfall/CAVE/instancing work) are unchanged in the roadmap.
