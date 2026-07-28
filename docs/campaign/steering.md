# Steering inbox — DEEPER (2026-07-24)

Write notes below this header; read at the TOP of each cycle. `pause` on its own line to pause.
(Underworld's steering is archived in `steering-archive.md`.)

## Standing directives (in force)

**The walk-test repair outranks the charter.** [cave-walktest-2026-07-24.md](cave-walktest-2026-07-24.md)
is the source of truth for cycles 1-5. No new content ships before Zach's repair descent signs off.

**Zach's kickoff decisions — DECIDED, do not relitigate:**
- **NO CREATURE UNDERGROUND.** Environment-only danger: the dark, the depth, the rock, your torch
  burning down. No cycle may introduce a cave monster.
- **Caves are a regular feature of ROCKY TERRAIN**, not a rare landmark. The egg cave stays unique
  and legible near origin. If uniform density can't be made perf-safe, the fallback is clustered
  "cave country" — and that is a SCOPE-CUT that gets surfaced to Zach, never taken silently.
- **Water pools are wanted** ("do love the idea… definitely want to add that") — promoted to
  cycle 6, the first new-content cycle. Default design is atmosphere-parity with wells, built so
  the larger-vessel follow-on is small. Water purity/boiling is OUT of this campaign.
- Ceiling 10M / 20 cycles.

**Engineering constraints:**
- D307 architecture is DECIDED: under-sheet trimesh interiors + entrance-chunk collider swap.
  **No portals, no teleports.** The crevice makes the carved hole smaller, which is easier.
- The D-2 fix is a **watertight single surface** (SDF → marching cubes over the existing
  room-graph). `DoubleSide` is NOT an acceptable fix — it hides the symptom and leaves paper walls.
- **The room-graph layout logic is preserved.** Underworld's sibling-angle (55°) and clear-span
  run-sizing fixes were bought with real bugs; the remesh replaces the MESHING layer only.
- Rule 7 (real thickness) / rule 9 (collision matches the visible geometry, changed together).
- Determinism (D290): seed-pure per site descriptor. Saves additive-only.

**Gate discipline — the project's driving lesson:**
- Every failure given a machine gate stopped recurring; every failure given only a prose rule came
  back. **The void-ray gate lands in cycle 1 and must be shown RED on today's `master` before the
  fix is built.** A gate that can't be demonstrated failing on the broken build is a gate that
  launders bugs as verified.
- Widen the seed net. Underworld's two generator defects hid behind 2 gate seeds. 6 seeds minimum.
- **Trust the playtest over a green gate.**

**EFFICIENCY WATCH (Zach 2026-07-27, in force — "keep monitoring to see if there are any other
efficiencies we should implement along the way"):**
1. **Gate-latency budget.** The full `verify:chunks` suite has a wall-clock budget of ~35 min
   (post-parallelization). Adding a permanent leg must state its cost and stay inside the budget
   — pay for new legs with parallelism/tiering, never by silently growing the serial wall.
2. **Full suite ONCE per cycle, run by the orchestrator at close.** Agents run only the legs
   their change touches (`--legs=` filter). An agent re-running the full suite is a brief bug.
3. **Tee every gate run to a file** (verification/gate-logs/) — a result is never lost and never
   re-run for reporting.
4. **Measure before dispatching.** No multi-hour fix agent is commissioned on an unmeasured
   hypothesis; buy the 15-minute probe first. Flaky signals need n≥5 per tree.
5. **Right-sized critic waves.** Full adversarial panels for NEW hero elements only;
   verification passes get 1 visual + 1 code critic.
6. **Per-cycle efficiency retro.** Every cycle-close log entry includes one line: where the
   wall-clock actually went + any new efficiency lever spotted. New levers get proposed to Zach
   at checkpoints, implemented when cheap and obviously safe.
7. **Dead-signal detection (Zach 2026-07-28 — "critical time that we are wasting").** When an
   agent stops claiming work is "still running" but the harness reports NO live background
   children, that work is ORPHANED — nobody will ever report it. The orchestrator acts
   IMMEDIATELY: read the teed gate-logs / poll the filesystem, never wait on a notification
   that cannot come. Long fallback wakeups are ONLY legal behind a genuinely tracked task.
   Long-running gate suites run under the ORCHESTRATOR'S OWN tracked background shell
   (harness-notified on exit), never inside an agent that might end its turn mid-run.
8. **THE STALL RULE (Zach 2026-07-28, second occurrence — this is the one that keeps costing).**
   Measured mechanism: an agent's shell caps at 10 min, a gate leg runs 20-55, so the agent
   detaches the run and ends its turn; the harness reports the AGENT done while the gate keeps
   running untracked, and the orchestrator then waits on a notification that cannot arrive.
   THEREFORE, unconditionally:
   - **Agent briefs END at "report and stop."** Agents run only `--legs=` iteration runs that
     fit inside one turn (the ~60s `--march=0 --void=0` path). They NEVER run a full leg or the
     full suite.
   - **The orchestrator runs every long gate** under its own tracked background shell.
   - **Never idle through one.** Dispatch disjoint read-only work (next-cycle prep, docs,
     research) the moment a gate starts — the hazard spec proved this is free.

**SPEED RULES (Zach 2026-07-20, in force):**
1. Probes ONLY via `npm run rig -- --scenario=… --port=52xx` (zero permission prompts).
   NEVER raw `node scripts/…`.
2. The full-boot gate runs at most ONCE per iteration BATCH. Geometry iteration uses the fast
   in-page screenshot path or the cave digest, not full walks. Final gates run ONCE at the end.
3. **NO monitor/wait/watcher patterns.** Run gates synchronously, then finish and report. An agent
   that has results does not wait for anything. (This stalled TWO Underworld cycles.)
4. Per-agent wall-clock budget stated in the brief; report if you'll blow it, don't grind.

**Rule 8 (visual iteration):** `npm run verify` green is NOT the success gate for the crevice
entrance, the remesh read, or the water pools. Build → screenshot → critique → iterate, 5-8 rounds
for new visual elements. Never >150 LOC of visual code in one Edit without a screenshot between.

**Process:** one code-writing agent at a time · never `git stash` here · Fable plans / Opus
executes · **push HELD** — commit to this branch, master untouched · walk-test feedback gets
written down the SAME DAY (the 4-day gap that produced this campaign's cycle 1 was the miss).

---

## Notes

### 2026-07-28 — Zach: walk-test verdict + the NEW remaining ladder (supersedes the hazard plan)
> *"i don't want these hazards, i want the caves more a place to explore, the temperature should
> be colder but not cold enough to damage the player. i like the lanterns, we already have
> lanterns in the game so can use those. also think we need to increase the light strength of the
> flashlilght, lantern, and torch. and make sure that the sunlight doesn't make the caves
> brighter, i noticed the caves are brighter during the day and darker at night so the light
> looks like it is penetrating the terrain or something like that, also i can see the sun
> slightly through the terrain and i think the moon as well so need to fix that. there should be
> a journal and a skeleton in one of the caves with some loot. if we're getting close to budget
> can increase it."*

**Effects (all DECIDED):**
1. **HAZARDS CANCELLED.** The hazard-spec-review milestone is RESOLVED in person: verdict = no
   damage mechanics underground. Caves are a place to EXPLORE. The spec doc stays as a record;
   its lantern + cold ideas carry forward stripped of damage.
2. **Cave cold = atmosphere only** — temperature reads colder underground but is CLAMPED above
   any damage threshold. Never hurts.
3. **Deployable lanterns YES, using the EXISTING lantern item** (place + retrieve as route
   breadcrumbs).
4. **Carried-light strength UP** — torch, flashlight, lantern dials (he will fine-tune by feel).
5. **Daylight must not reach the deep cave** — the interior currently brightens by day/darkens by
   night (ambient coupling), and the sun (and likely moon) discs show through terrain. Both are
   bugs to fix: constant deep-cave darkness (the mouth shaft stays sun-tracked — a real opening),
   and no sky body ever visible through rock, any cave, either body.
6. **A skeleton + journal + loot cache in one of the caves** — an authored story beat (loot
   numbers flagged for Zach per the economy gate).
7. **Ceiling raised on his authorization**: 10M → 14M.
8. The repair-descent milestone is SATISFIED by today's walk-test (feedback above is the record;
   no D-1..D-4-class defects reported). More tuning feedback to come — capture same-day when it
   lands.

### 2026-07-25 — Zach: run the whole remaining ladder unattended
> *"ok keep working through all of the remaining cycles. I am going to be gone all day so want to
> see significant progress when i return"*

**Effect:** the campaign runs cycles back-to-back without pausing for him. This OVERRIDES the
charter's "new content is BLOCKED until the repair descent" gate — he has explicitly asked for
progress rather than a day spent waiting on his walk-test.

**What this does NOT override:**
- His descent walk-test is still OWED and still the real verdict on the repair. Content built
  after it is built on an unverified base — say so plainly in the final summary rather than
  presenting the repair as signed off.
- **No creature underground** — still decided, still not relitigable.
- Anything that can DAMAGE OR KILL the player (cycle 10 hazards) is a feel call with real
  consequences. Write the spec; build only the conservative, telegraphed subset, and flag the
  rest for his review. Do not ship a hazard that can end a run without him having seen it.
- Push stays HELD. Master stays untouched. Nothing merges without him.

**Priority order if the day runs out** (highest first): finish the REPAIR (crevice → preload →
reassess), then WATER (he asked for it by name), then density, then kinds. Hazards, light budget,
and the return-reason are the tail and may be left unstarted — an honest "not reached" beats a
rushed cycle.

**Budget realism** (cycles 2 and 3 both ran 2-3× over their briefs): size briefs to what the work
actually takes. A 4-8 round visual loop is ~2 hours. Stating 50 minutes and blowing it is worse
than stating 2 hours, because it hides where the time went.
