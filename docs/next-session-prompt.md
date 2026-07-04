# Next session — the X-queue OVERNIGHT batch (W2 walk-test feedback, 2026-07-04 pre-bed)

The user walk-tested W2 and left a large feedback batch + 4 clarifying answers (steering-archive
2026-07-04 — read it verbatim first). Branch `campaign/escape-pod-intro`; W2 shipped as `65bb290`.
Overnight autonomous execution approved: "plan it all perfectly... wake up to a lot of well done
progress." Quality bar: very high; verify thoroughly; adversarial gates on hero visuals.
**Standing rule 9: collision matches models, same change, motion-proven.**

## User's clarifying answers (2026-07-04)
1. **Canopy scope = FULL REBUILD** — tear down most of the cockpit front section, build the
   multi-pane wraparound canopy fresh (keep chair, console [redesign allowed], arched ribs);
   update the exterior hauler nose ROUGHLY to match (the eject shot).
2. **Eject view = BAY UNTIL EJECT** — seated+sealed you see the airlock/bay through the porthole
   (red-alert still flashing); the frame swap happens under the eject blast/tumble.
3. **Crew quarters = LIVED-IN BASICS** — bunk, locker, small desk/shelf, a few personal props.
4. **Hallway windows = ONE LONG VIEWPORT STRIP** on the right/starboard wall.

## The X-queue (waves = file-ownership; parallel within a wave)

### WAVE 1 (parallel: shipScene ∥ podScene)
- ▶ **X1 — COCKPIT FULL REBUILD** (shipScene cockpit region + haulerScene nose; modeler +
  research digest + adversarial gate): multi-pane ANGLED glass canopy wrapping partial
  top+left+right (user reference: framed panoramic, Millennium-Falcon-like; flat front sheet =
  the complaint); keep chair/console/arches; REMOVE side-wall pipes + the light-grey/dark-grey
  long rectangles (back wall→glass); REMOVE the yellow box consoles on both cockpit walls; fix
  the FRONT ribs' orange light-strip placement (back ribs OK); fix cockpit bolt orientations;
  colliders same-change; hauler nose roughly matched.
- ▶ **X2a — THE ONE POD, FOR REAL** (podScene; modeler + adversarial gate) — the #1 ask, 3rd
  repeat: the bay pod must BE the real cabin — full real interior (not the canonical "peek"),
  NO space visible from inside (seal the exterior-skin/wall gaps); INTERIOR DETAIL REDESIGN
  (levers/console/buttons realistic); door EXACTLY flush in every sealed state (still ajar
  pre-eject); hunt+kill the PALE/BRIGHT pod that appears at eject (all phases, one tone);
  LANDED POD: same door as the ship one (it reads different), remove the metal sheet blocking
  the landed doorway, remove the sand streaks + mound, WALK-BACK-IN works (motion gate).
### WAVE 2 (after X1 frees shipScene; parallel: shipScene ∥ sequence)
- ▶ **X4 — CORRIDOR: QUARTERS + VIEWPORT + MISC** (shipScene; modeler + gate): crew quarters
  room LEFT side toward the engine room (sliding door, lived-in basics per answer 3); the long
  right-wall viewport strip (answer 4); seal the hull GAPS beside the pod-bay entrance (space
  visible!); airlock detail pass; bay-pod COLLISION (player can't pass through its hull);
  W3 leftovers: bolt orientation ship-wide, corridor-entrance pipe ends routed into the
  wall/arch, engine-room detail. Colliders + motion probes.
- ▶ **X3 — FLOW + STATE** (sequence; main loop): board straight after the engine check (no
  cockpit detour to arm the pod door); red-alert flashing PERSISTS until seated + LAUNCH;
  pre-eject seated view = the BAY through the porthole, frame swap at eject under the blast
  (answer 2 — move the ensureInPod swap from the seal phase to the eject fire); smoke driver +
  gates updated.
### WAVE 3
- ▶ **X6 — THE WRAP**: ship-wide collision audit (rule 9, motion-proven) → full gate suite
  (verify:all · smoke-intro · pod-walkin/out · airlock-motion · persistence · bench:intro
  [NOTE: bench takes ~30 min wall-clock under swiftshader — that is NORMAL, do not kill it]) →
  adversarial visual gates on X1/X2a/X4 → rebuild `npm run build:intro` + restart the
  `dustfall-intro-preview` server (port 4173) → kill stray rig dev servers → clean `git status`
  → ONE wake-up summary.

## Contracts + tools (unchanged from W2)
Commit+push per unit. Modeler agents own one file each; sequence.ts is main-loop-owned.
Rig ports: 5191/5192 split when parallel. The rig aspect fix + flee-cam fix are in (65bb290) —
shots are true now. Adversarial gate: 3 lenses + confirm pass; own-eyes verify every fix on the
finding shot. `docs/architecture-escape-pod-intro.md` = the map.
