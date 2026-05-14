---
name: session-end
description: End a Dustfall dev session. Verifies tsc + browser preview, writes a changelog entry, updates CLAUDE.md "Last shipped" line, updates roadmap, archives the active plan file, and prints the git commit + tag commands for the user to run. Invoke at the end of every coding session.
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

8. **Print these commands** for the user to run (DO NOT execute):
   ```
   git add -A
   git commit -m "session <X> — <noun phrase>"
   git tag session-<X>
   ```
   Add `git push && git push --tags` if the user typically pushes
   immediately. Otherwise omit — they'll push when ready.

9. **Print the next-session prompt** for the user to paste at start of
   next session. Use the roadmap.md "Next" entry as the basis, plus any
   carry-over notes ("preserve the X field from M", "the Y bug found
   this session should land first").

## Don't

- Run `git commit` or `git tag` yourself. Print the commands; let the
  user run them. Tagging is irreversible and the user might want to
  amend the commit message first.
- Skip the verify step. If verification failed mid-session, surface
  that rather than papering over it in the changelog.
- Write a 50-line retro to the changelog. Keep it 2-4 lines. The full
  context is in the archived plan file + git diff + tag.
- Delete the archived plan file. It's the source of truth for the
  implementation details.

## Decisions worth logging

Before finishing, ask yourself: "did we make any call this session that
the user might forget the why of in 3 months?" Examples:
- Picked X over Y because of constraint Z.
- Rejected an approach the user might revisit.
- Tonal / scope pivot.

If yes → log to `decisions.md` as a new D-numbered entry.
