# Dustfall — Session-end report

Cumulative state. Rewritten at each `/session-end`. Per-session detail: `docs/changelog.md`;
campaign detail: `docs/campaign/campaign-log.md`.

## Current state (2026-07-11)

**🏁 Campaign "Infinite Sands" is COMPLETE** (7 cycles, ~1.3M/10M tokens, D288–D298). The world
is INFINITE: deterministically streamed (S1), populated with salvageable wrecks (S2), rocks/
vignettes/prey (S3), rare hero landmarks + regional graveyard biomes (S4), hitch-free (S6), and
PERSISTENT — far-field changes survive save/reload via SAVE_VERSION 17's descriptor-keyed
`chunkDiffs` (S5). The released origin world + intro are byte-identical throughout. Plus the
D297 playtest hotfix (streaming/save read `getPlayerPos`, never the speeder-parked capsule) and,
earlier this session, the framework-wide `reap-orphans` process-leak fix
(`gamedev-framework@e78c1ca`).

**Verify:** the permanent suite is now placement ×5 + colliders + `verify:chunks` (determinism ×2
+ cross-seed, streaming with ride + persistence legs, generation-perf) + 5 smoke gates — ALL
GREEN on the final state. The streaming gate's persistence legs prove the full S5 lifecycle
including a REAL page-reload + CONTINUE.

**Branch:** `campaign/2026-07-10-procgen`, 8 commits (`e82d9a7`→`5f57a5d`, `fe56a99`, `47769c8`,
+ the S5 commit). `master` untouched; nothing pushed. **Next human action: the merge review**
(checklist in `docs/next-session-prompt.md`).

## What works end-to-end
The complete released survival game + walk (or RIDE) forever in any direction: terrain, wrecks
with working salvage, ambient life, titan-skeleton landmarks, graveyard regions — hitch-free —
and your changes out there now persist across save/reload. Old saves (≤v16) load unchanged.

## Known gaps (all logged)
Regenerate-only: scrap rings at streamed wrecks (S5 v2), far-field vultures (D294), regional-yard
dense cluster read, the Sarlacc-vs-rider design call (D297), streamed-landmark horizon
silhouettes; the §A owed feel walk-tests; content-id registration-order coupling noted in D298.

## Suggested next
1. **The merge review** → merge to master → redeploy web/desktop.
2. Resume the parked **Skyfall** campaign (plugs into the S4 landmark slot).
3. Or the §A walk-test pile / backlog polish.

## Token spend (session, approx)
Cycles 5-7 + the D297 hotfix + the process-leak investigation ≈ 700K output tokens this session;
campaign total ~1.3M/10M across 7 cycles — well under the ceiling, with the ladder finished.

## Iteration-discipline self-check (rule 8)
PASS. S5 is systems work verified by behavior-level gates (a real extraction, a real reload);
no new visual surface. The one visual/feel item this session (the speeder streaming bug) came
from the USER's walk-test and was fixed + A/B gate-proven same session.
