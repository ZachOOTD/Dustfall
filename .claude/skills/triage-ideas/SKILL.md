---
name: triage-ideas
description: Bulk-classify a free-form dump of game ideas as [bug] / [feat] / [polish] / [debt] / [idea] and append to docs/backlog.md. Invoke when the user pastes ideas they want triaged into the backlog.
---

# Triage ideas — Dustfall

The user will paste a wall of free-form text — a mix of bugs they noticed,
features they want, polish ideas, code-debt items, speculative thoughts.

Your job: classify each distinct idea with a single tag, rewrite as a
short one-line entry, and append to [docs/backlog.md](../../../docs/backlog.md).

## Tag definitions

| Tag | Use for |
|---|---|
| `[bug]` | Something visibly broken — crash, wrong behaviour, visual glitch, soft-lock |
| `[feat]` | New gameplay mechanic, system, or content |
| `[polish]` | Feel / UX / visual refinement on something that already works |
| `[debt]` | Code cleanup, refactor, doc improvement, perf, type-safety |
| `[idea]` | Speculative / underspecified — needs validation before promotion |

When in doubt, prefer `[idea]` over forcing a wrong tag.

## Steps

1. **Parse the user's dump** into distinct ideas. One idea per entry.
   Multi-sentence ideas that describe one thing → one entry. Bullets
   that describe separate things → separate entries.

2. **Classify each** with one tag using the table above.

3. **Rewrite each as a one-line entry**, under ~90 chars when possible.
   Use imperative or noun-phrase style — match existing backlog entries.
   Preserve user's context if it's load-bearing (a specific function
   name, a specific scenario, a why).

4. **Append to [docs/backlog.md](../../../docs/backlog.md)** at the
   BOTTOM (newest at bottom). Don't reorder existing entries.

5. **Flag ambiguous entries** — if you couldn't tell whether something
   was `[feat]` vs `[idea]` or `[bug]` vs `[polish]`, surface those in
   your reply so the user can clarify or re-tag.

6. **Print a summary count**: `Added: 3 [bug], 5 [feat], 2 [polish], 1 [debt], 0 [idea]`.

## Format example

User input:
```
- the canteen icon on the hotbar looks the same when empty and full
- machete sometimes hits through walls
- add a compass HUD pointing to last shelter
- ribcages should creak in the wind
- something with bartering with NPCs
```

Becomes in backlog.md:
```
[polish] canteen hotbar icon should distinguish full vs empty fillLevel
[bug] machete swept-capsule sometimes registers through static colliders
[feat] compass HUD pointing to last placed shelter
[polish] ribcage landmarks emit creak ambience in wind
[idea] bartering / NPC trading economy
```

Print:
```
Added: 1 [bug], 1 [feat], 2 [polish], 0 [debt], 1 [idea] → docs/backlog.md
```

## Don't

- Promote anything to `roadmap.md`. That's a separate decision.
- Reorder or edit existing backlog entries.
- Try to dedupe — if the user dumps something already in backlog, just
  append it; better to have a duplicate than to silently drop user input.
- Add commentary, scoping, or estimates inside entries. Keep them as
  one-liners. Promotion to a session plan is when you scope.
