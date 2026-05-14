---
name: session-start
description: Begin a Dustfall dev session. Reads roadmap top entry + last 2 changelog entries, identifies the 3-5 critical files for the upcoming session, asks for the next-session prompt if not pasted. Invoke at the start of every coding session.
---

# Session start — Dustfall

Run this skill at the very start of every Dustfall coding session, before
touching any code.

## Steps

1. **Read [docs/roadmap.md](../../../docs/roadmap.md)** — get the "Next"
   entry (one-liner + scope notes). That's the working scope for this
   session unless the user overrides via a pasted "next session prompt".

2. **Read the top 2 entries of [docs/changelog.md](../../../docs/changelog.md)**
   — establishes recent state. Don't read older entries (they're history,
   not state).

3. **Resolve scope conflicts**: if the user pasted a next-session prompt
   that disagrees with roadmap.md, the user wins. Note the discrepancy so
   roadmap.md gets updated.

4. **Identify the 3-5 critical files** for the session by inspecting the
   roadmap scope notes:
   - For a "rigged Quaternius raider" entry → `src/enemies/raider.ts`,
     `src/assets/loader.ts`, `src/assets/manifest.ts`, `src/main.ts`.
   - For a "save format v2" entry → `src/persistence/save.ts`,
     `src/GameContext.ts`.
   - Use the file-map in [docs/architecture.md](../../../docs/architecture.md)
     only if you genuinely don't know where a system lives.

5. **Read those 3-5 files**.

6. **Either start work OR ask clarifying questions** — don't assume.

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
