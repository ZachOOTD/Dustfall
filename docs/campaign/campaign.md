# Campaign — Dustfall · "Scavenger's Economy (setup)"

**Goal:** Close Phase 1 (the last two SOLID fixes) and lay the groundwork for the
Scavenger's Economy — WITHOUT baking any balance decision while Zach sleeps. The
overnight produces finished fixes + four research digests + a decision-ready
economy proposal, then PAUSES for morning approval.

**Started:** 2026-07-17
**Branch:** `campaign/2026-07-17-economy` (every cycle commits here; NOT merged to master)
**Budget:** max-cycles 16 (hard stop) · spend ceiling ~6M tokens total (soft)
**Checkpoint policy:** pause at the economy proposal (awaiting_approval)
**Self-author policy:** none — the queue is fixed in `plan-2026-07-17.md`; do NOT invent roadmap
**Verify gate (per cycle):** `npm run verify:all` (tsc + placement + colliders + chunks). Any unit
that touches a hero asset also runs `npm run verify:solid --asset=<that asset>`. Visual/feel cycles
(#29) run the adversarial appearance gate + a day/night render check.
**Status:** active

## The fixed queue (do NOT re-plan — see docs/campaign/plan-2026-07-17.md)
1. **#28 Skyfall stern seam** — fix at the shared `solidInner` lip weld in `wreckForms.ts`.
2. **#29 Boneyard scatter overhaul** — HERO visual; iterate 5-8 rounds; add a day/night check.
3. **Research swarm** — 4 digests to `docs/research/`: crafting-improvements,
   multiplayer-architecture, character-pipeline, cave-feasibility (parallel, cheap Haiku).
4. **Economy proposal** — write `docs/campaign/economy-proposal.md` (leaner ~4-5 material set +
   recipe/drop matrix + UX ideas), set awaiting_approval, PAUSE. **Bake NO ItemIds; change NO loot
   tables.**

## Hard rules for this run (learned the hard way)
- **Never `git stash` in this worktree** (it clobbered a concurrent agent).
- **Run agents ONE AT A TIME** — no concurrent agents on the shared source tree (real incident).
  The research swarm is the one exception: read-only Haiku agents, each writing only its own
  `docs/research/<topic>.md` (no shared-source writes) — safe to fan out.
- **A gate that measures the wrong thing is worse than no gate.** Trust the physics/playtest over a
  green topology check. When a builder cuts a real opening, declare `userData.intendedOpening`.
- **Rule 8:** #29 is a hero visual — do NOT ship it on `tsc` alone. Screenshot-iterate.
- Push is HELD. Commit each unit to `campaign/2026-07-17-economy`. Do NOT merge to master.
- Do NOT use AskUserQuestion overnight — every decision is locked in the plan doc.

## How to steer this campaign
- Watch progress: read `campaign-log.md` or run `/campaign-status`.
- Redirect: write a note in `steering.md` (picked up at the next cycle boundary).
- At the pause: review the fixes + `economy-proposal.md`, then `/campaign-approve`.
- Stop: write "pause" in `steering.md`, or stop the `/loop`.
