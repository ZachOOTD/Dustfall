---
name: session-end
description: End a Dustfall dev session. Verifies tsc + browser preview, writes a changelog entry, updates CLAUDE.md "Last shipped" line, updates roadmap, archives the active plan file, AUTO-EXECUTES git commit + tag + push to master, and writes the next-session prompt to `.claude/plans/next-session.md` (read by session-start). Invoke at the end of every coding session.
---

# Session end — Dustfall

Run this skill at the end of every Dustfall coding session, BEFORE
committing.

## Steps

1. **Verify**:
   - Run `npx tsc --noEmit`. Must be clean.
   - Browser-verified end-to-end via preview tools? Note one of:
     - `verified` — preview_screenshot succeeded + behaviour confirmed.
     - `partially verified` — preview_eval / DOM inspection confirmed
       behaviour but screenshot timed out.
     - `unverified` — the change wasn't observable in the browser
       (pure type/refactor work) OR verification was skipped.
   - Be honest: don't report "verified" if a verification tool failed.

2. **Append a 2-4 line entry** to the TOP of
   [docs/changelog.md](../../../docs/changelog.md). Format:
   ```
   ## Session X — YYYY-MM-DD — <noun phrase>
   <2-4 line body summarizing what shipped + any non-obvious implementation deltas>
   ```
   Reuse the project's existing changelog style.

3. **Update [CLAUDE.md](../../../CLAUDE.md)** "Last shipped" line under
   `## Where we are now` to reference the new session.

4. **Update [docs/roadmap.md](../../../docs/roadmap.md)**:
   - Delete the "Next" entry (just shipped).
   - Promote the second entry to "Next".
   - If the user gave direction for what should come next, add a fresh
     "Later" entry.

5. **Move the active plan file** `.claude/plans/<session>.md` →
   `.claude/plans/archive/session-<X>.md`.

6. **Update [decisions.md](../../../docs/decisions.md)** if any
   non-obvious tonal / scope / architectural call was made this session
   that would otherwise need to be re-explained. Append at the bottom
   with the next D-number. Don't renumber.

7. **Update memory** (workflow / project / user) if any durable
   guidance changed. Use the auto-memory write protocol from the system
   prompt.

8. **Auto-execute git commit + tag + push** (no manual paste loop).
   Run these in sequence, stopping immediately on any failure and
   surfacing the error to the user:
   ```
   git add -A
   git commit -m "session <X> — <noun phrase>

   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
   git tag session-<X>
   git push origin master && git push origin --tags
   ```
   - The commit message must follow the existing changelog noun-phrase
     style and end with the Co-Authored-By trailer.
   - If the harness's auto-mode classifier blocks `git push origin
     master` ("pushing to default branch bypasses PR review"), stop +
     tell the user, and recommend they add `Bash(git push:*)` to
     settings.json if they want zero prompts on future sessions.
   - Never use `--force`, `--no-verify`, or amend an existing commit.
     If the commit message has a typo, surface it BEFORE pushing —
     after the push lands on origin master, amending requires
     force-push (don't do that without explicit user direction).

9. **Write the next-session prompt to a file** + print a short
   summary in chat (NOT the full prompt). Use the roadmap.md "Next"
   entry as the basis, plus any carry-over notes ("preserve the X
   field from M", "the Y bug found this session should land first").
   - File path: `.claude/plans/next-session.md`.
   - Format: same prose style we previously printed inline. session-
     start reads this file at the very start of the next session.
   - Summary printed in chat: 3-5 lines naming the next session's
     primary focus + any critical carry-overs the user should know
     about right now. The full prompt stays in the file — the chat
     summary is just so the user knows what was queued up.

## Don't

- Run `git push --force` or `git commit --amend` or `--no-verify`
  under any circumstances. If something needs amending, surface the
  issue + let the user decide.
- Skip the verify step. If verification failed mid-session, surface
  that rather than papering over it in the changelog.
- Write a 50-line retro to the changelog. Keep it 2-4 lines. The full
  context is in the archived plan file + git diff + tag.
- Delete the archived plan file. It's the source of truth for the
  implementation details.
- Print the full next-session prompt in chat. Write it to the file
  AND print a short summary. The full prompt only exists in the file.

## Decisions worth logging

Before finishing, ask yourself: "did we make any call this session that
the user might forget the why of in 3 months?" Examples:
- Picked X over Y because of constraint Z.
- Rejected an approach the user might revisit.
- Tonal / scope pivot.

If yes → log to `decisions.md` as a new D-numbered entry.
