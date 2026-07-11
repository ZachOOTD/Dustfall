# Next session — ⏸ the campaign is PAUSED at the S5 sanctioned pause

**State:** campaign "Infinite Sands" (branch `campaign/2026-07-10-procgen`) — S1-S4+S6 SHIPPED
across cycles 1-5; cycle 6 wrote the S5 save-schema plan and set
`status: "paused"`, `awaiting_approval: true`, `stop_reasons: ["save-version-bump"]`.
The /loop is stopped. **Nothing runs until the human approves.**

## The human's review checklist (morning)
1. **Walk the world** (`npm run dev`, NEW GAME): sprint across a terrain boundary (S6 — should
   feel hitch-free), walk +1.5km out (streamed wrecks/rocks/prey), visit a hero landmark
   (a colossal ribcage silhouette or a wreck knot), find a regional wreck-yard if ambitious,
   strip a far wreck's panel (it will NOT persist yet — that's what S5 adds).
2. **Read the plan**: [feature-save-per-chunk-diffs.md](feature-save-per-chunk-diffs.md) —
   4 open questions, each with a recommendation.
3. **`/campaign-approve`** (optionally with steering notes / answers to the open questions) —
   releases the ONE-CYCLE S5 build: SAVE_VERSION 17, descriptor-keyed chunk diffs, the probe
   persistence leg. That's the ladder's final rung; after it ships + your final review, the
   branch merges to master.

## If approving, the build cycle's brief (for the agent)
Follow `docs/feature-save-per-chunk-diffs.md` exactly as approved (fold in any steering).
Constraints: D81/D290/D292/D296; the origin world's save round-trip stays byte-exact; all
existing gates green + the new persistence leg. Close with `/session-end` + campaign bookkeeping;
the verdict after S5 ships is TERMINAL (`until: ladder-complete` → `status: "completed"`) — the
campaign ends and the human does the merge review.

## Also parked
The Skyfall campaign (plan-review pause) resumes AFTER this campaign completes — it plugs into
the S4 landmark slot. State: `docs/campaign/*-2026-07-09-sharpen-deepen.*` + `docs/feature-skyfall.md`.
