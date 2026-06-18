# Campaign — Dustfall

**Goal:** Build out the *remaining* roadmap + backlog toward the GDD vision — a browser
first-person lone-survivor procedural desert (Long Dark / Mad Max / Dune tone). The
project is post-MVP (~90 sessions, the full loop ships end-to-end), so "done enough" is
**depth + finish, not new vision**: close the started-but-unfinished debt, then add
breadth on the solid base, until the roadmap "Up next" + `backlog.md` PENDING are
exhausted (`--until=roadmap-empty`). Measured against GDD §13 success conditions
("I want to know what's over that ridge"; a tighter, more-*felt* world each cycle).

**Started:** 2026-06-18
**Branch:** `campaign/2026-06-18` (every cycle commits here; never pushed)
**Budget:** max-cycles **12** (hard stop, this first run) · no soft token ceiling set
  (calibrate per-cycle spend from `campaign-log.md` after milestone 1, then
  `/campaign-start --resume` with a higher cap)
**Checkpoint policy:** **milestone**, with markers placed at **PHASE boundaries** (user, 2026-06-18) —
  runs an ENTIRE phase unattended across many cycles, **committing every cycle**, and pauses for a human
  playtest + approval ONLY at a phase boundary (after Phase A's last milestone M5b; after Phase B's M10),
  **not** at each M-milestone. (Commits are per-cycle for reversibility; review is per-phase.)
**Verify gate:** `npm run verify:all` (tsc + `verify:placement` + `verify:colliders`) —
  Dustfall opts out of the tier-ladder; this is its real headless gate.
**Visual gate:** `auto` — visual/feel cycles also run the adversarial appearance gate
  (multi-angle render → harsh-lens critics + code-auditor → PASS iff no sev≥2). This
  verifies **appearance only**; feel (motion/traversal/timing) is walk-tested by the
  human at each milestone — those items are logged `appearance-verified; feel-pending`.
**Self-author policy:** propose — when the queue empties, draft more roadmap from the
  GDD and wait for approval (never invent-and-build new direction unattended).
**Status:** active — **paused at `plan-review`** awaiting `/campaign-approve` of the
  plan below before any building starts (this first run is `--plan-first`).

## How to steer this campaign
- **Watch progress:** read `campaign-log.md` (one entry per cycle) or run `/campaign-status`.
- **Redirect (no need to stop the loop):** write a note in `steering.md` — picked up + archived
  at the next cycle boundary. (Or dictate it: voice → `/digest-conversation` → `vision-deltas.md`.)
- **At a milestone checkpoint:** pull + play the build (walk-test the `feel-pending` items),
  then `/campaign-approve` to release the next milestone, or `/campaign-approve --reject`
  with steering notes.
- **Approve/reject self-authored direction:** when the backlog empties the loop *proposes*
  more roadmap and waits — `/campaign-approve` or `--reject`.
- **Stop:** `/campaign-status --stop`, write "pause" in `steering.md`, or end the `/loop`.
  Resume with `/campaign-start --resume`.

## The plan
The ordered, milestone-grouped build queue lives in **[../iteration-plan.md](../iteration-plan.md)**
(refreshed for this campaign), with `### Milestone:` review boundaries marked in
**[../roadmap.md](../roadmap.md)** "Up next" and the pre-committed scope-cut list in
**[../GDD.md](../GDD.md) §12**. This is what `/campaign-approve` releases.

## Git note
Campaign mode is the deliberate exception to Dustfall's usual "human owns git / no
commits" rule: it **auto-commits every cycle** on `campaign/2026-06-18` (never pushes,
never runs destructive git) so each cycle is one revertible commit. Merge the branch into
`master` when you're happy with a milestone; abandon a bad run with `git branch -D` (delete
the lock first — the guard blocks it while the campaign is live).
