---
name: session-start
description: Begin a Dustfall dev session. Reads `.claude/plans/next-session.md` (written by the previous session-end) if present, falls back to the roadmap "Next" entry otherwise, then reads last 2 changelog entries + identifies the 3-5 critical files for the session. Invoke at the start of every coding session.
---

# Session start — Dustfall

Run this skill at the very start of every Dustfall coding session, before
touching any code.

## Steps

1. **Check for a pending next-session prompt** at
   `.claude/plans/next-session.md`. If the file exists, read it — it's
   the authoritative working scope for this session (written by the
   previous session-end based on roadmap state at end-of-shipping plus
   any carry-overs that came up). After reading, move the file to
   `.claude/plans/archive/session-<X>-prompt.md` (X = the session
   letter we're about to start, e.g. `session-QQ-prompt.md`) so it
   doesn't shadow the NEXT session if the user forgets to invoke
   session-end. If the file doesn't exist, fall back to step 2.

2. **Read [docs/roadmap.md](../../../docs/roadmap.md)** — get the "Next"
   entry (one-liner + scope notes). Only consulted when there's no
   pending next-session prompt file (i.e., previous session-end was
   skipped, or this is a fresh project).

3. **Read the top 2 entries of [docs/changelog.md](../../../docs/changelog.md)**
   — establishes recent state. Don't read older entries (they're history,
   not state).

4. **Resolve scope conflicts**: precedence order is (a) user-pasted
   prompt args > (b) `.claude/plans/next-session.md` > (c) roadmap
   "Next". When the user pastes something inline and there's ALSO a
   file, the user wins; note the file was overridden so session-end
   can update the roadmap accordingly.

5. **Identify the 3-5 critical files** for the session by inspecting the
   working prompt's scope notes:
   - For a "rigged Quaternius raider" entry → `src/enemies/raider.ts`,
     `src/assets/loader.ts`, `src/assets/manifest.ts`, `src/main.ts`.
   - For a "save format v2" entry → `src/persistence/save.ts`,
     `src/GameContext.ts`.
   - Use the file-map in [docs/architecture.md](../../../docs/architecture.md)
     only if you genuinely don't know where a system lives.

6. **Read those 3-5 files**.

7. **Either start work OR ask clarifying questions** — don't assume.

## Don't

- Read `.claude/plans/archive/` — those are frozen retros, not state.
- Read `docs/architecture.md` end-to-end unless the session touches a
  system you don't know. The file map is for targeted lookups.
- Re-read CLAUDE.md — it was auto-loaded.
- Read more than 5 files at start; reach for an Explore agent if the
  scope feels uncertain.

## Token budget

The fixed cost of this skill should be ~1.5K tokens (roadmap top + 2
changelog entries). Files-to-read cost depends on scope but typically
3-8K tokens for 3-5 files.
