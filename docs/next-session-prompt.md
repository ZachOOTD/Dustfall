# Session ACG — Kickoff Brief

## Read these now (in order)

1. **CLAUDE.md** (auto-loaded) — project manual.
2. **docs/session-end-report.md** — cumulative state through ACF.
3. **docs/backlog.md** — open items (top 3 are ACF follow-ups + the framework-feedback debt note).
4. **docs/decisions.md** — D-entries through D132. **Grep, don't slurp** — the file is ~70K tokens; ACF added D131 (towed-body rope kinds + entity-owned `dragAnchor` + `killDrag` system) + D132 (worm carcass speeder-tow-only + tow-before-harvest edge).
5. **docs/roadmap.md** — "Up next" lists ACG candidates.
6. **docs/architecture.md** — only if touching a system you don't already know.

## What's already built (one paragraph)

ACF shipped the corpse/carcass rope-drag, closing ACE's deferred Cut #3. The
`RopeEndpoint` union gained `raider_corpse` + `sandworm_carcass` — the first
*towed-body* kinds (the rope drags them; they're not anchors). NEW
`src/world/killDrag.ts` (`updateKillDrag`) is the first non-sled caller of
ACE's `applyInextensibleConstraint`; drag state lives on the entity as
`dragAnchor` (NOT `sled.tether`). A raider corpse drags on foot or trails a
player-tethered sled; a worm carcass tows behind the speeder only (24m is too
heavy on foot). Sagged rope tube per dragged kill; in-progress drags persist
across save/load (additive, no version bump). The worm path was runtime-verified
(constraint snaps a 20m-yank back to the 14m leash); the aesthetic + the raider
path were NOT.

## Session ACG — focus

**ACF drag polish + verification** — close the rule-8 gap ACF left open. ACF
shipped functionally but never ran the build→screenshot→critique→iterate loop,
and the raider corpse path was never runtime-exercised.

## Priority items (in order)

1. **Raider-spawn path for testing** (`src/enemies/raider.ts`). 0 raiders spawn
   by default (D13). Add a dev-only spawn (e.g. a `__game.spawnRaider(x,z)`
   hook or a DEV-MODE starter raider near spawn) so the corpse-drag path can be
   exercised at all. Acceptance: a raider exists in the world in DEV MODE.
2. **Raider corpse drag — runtime verification + feel** (`killDrag.ts`,
   `interaction.ts`). Kill it → wield rope → LMB-on-corpse → drag on foot, then
   tie to a player-tethered sled. Visual-triage: rope sag, corpse position
   relative to the rope, does it read as "dragging a body". 3-5 iteration rounds.
3. **Body-trails-head-first orientation** (`killDrag.ts`). Deferred in ACF
   pending verification against the dead-pose rotations. Orient the dragged
   corpse (`r.group.rotation.y`) + carcass (`w.mesh.rotation.y`) to point away
   from the anchor — but FIRST confirm it doesn't fight `applyRaiderDeadPose`
   (flop / die-clip) or `applySandWormDeadPose`. Screenshot before/after.
4. **Worm carcass tow — visual-triage** (mount speeder, slay/force a worm dead,
   tow it). Judge the 24m carcass trailing on a 14m leash. Tune
   `KILL_DRAG_WORM_*` if it reads wrong.
5. **Save round-trip of an in-progress drag** — tie a corpse, save, reload,
   confirm the drag resumes (or degrades gracefully). The fields are wired
   (`dragAnchor` on raider + worm); confirm end-to-end.

## Stretch goals

- Fix the `lootSandWorm`-untags-carcass edge (tow-after-harvest): keep an
  `attach_rope` tag on a looted-but-towed carcass, or move cut-loose onto the speeder.
- Drag SFX (rope creak + body-scrape on sand) when a kill is actively dragged.

## Autonomy contract

When ambiguous mid-session → pick the option closest to GDD pillars +
decisions.md realism dial, append a new D-entry, keep going. Surface only on:
- Procedural-vs-asset question (D107 — stay procedural unless explicit approval).
- Save-schema *version* bumps (D81 — additive only; flag if you need to bump SAVE_VERSION).
- Destructive git operations.
- Catastrophic block (a critical system breaks and the fix > 1h).

## Stop conditions

- Wall-clock 2-4h for this focused polish scope.
- 3 consecutive fix walls on the same gate → invoke `/scope-cutter`.
- Catastrophic block / destructive-action attempt → STOP and surface.

## Notable footguns (carried forward)

- **D131 towed-body kinds**: corpse/carcass drag state lives on the ENTITY
  (`dragAnchor`), NOT `sled.tether`. `updateKillDrag` owns dragged-dead-entity
  movement (raiders/worms `continue` past dead in their own update).
- **D132 worm speeder-only**: `killDrag` clears any non-speeder worm anchor;
  `lootSandWorm` untags the carcass (tow-before-harvest only).
- **D107 zero-asset**: no GLB / no PBR / no asset files. Everything procedural.
- **D109 localSpace=true on moving entities**: any shader on a moving body MUST
  pass `localSpace: true` or texture detail crawls.
- **Preview gotchas** (`dustfall_preview_gotchas` memory): pointer-lock gating
  blocks clean automated in-game framing; the opening-wreck spawn occludes the
  forward view. For visual-triage, force state via `__game.ctx` + eval, and
  reposition the camera/player deliberately for screenshots.

## Verification protocol

Single command: `npm run verify` (= `tsc --noEmit`). For the visual/feel work
this session, `tsc` is the type gate, NOT the quality gate — honor the iteration
discipline (`shared-memory/iterative-polish-discipline.md`): build → screenshot
→ critique → iterate, 3-5 rounds per element. This session EXISTS to close
ACF's rule-8 gap — do not repeat it.

## Begin block

1. Read CLAUDE.md (auto-loaded), session-end-report, backlog, decisions
   (grep D131-D132), roadmap.
2. Confirm `npm run verify` baseline passes.
3. TaskCreate covering priority items 1-5.
4. Add the raider-spawn path FIRST (everything else depends on it).
5. Begin coding + visual-triage.
