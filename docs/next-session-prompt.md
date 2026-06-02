# Session ACW — Kickoff Brief

> Recent: ACU (rig look fixes + speeder/sled/rope + slide tune), **ACV (overnight, partial: backlog
> reconcile + seated speeder pose #148 + sled marks #187 + aim-twist #41 + the COMPANION EGG-CAVE
> spine, Cycle 7 core, D158)**. ACV deliberately **scope-cut the visual/feel-tuning pile** — those are
> ACW's job, because each needs the real rule-8 screenshot/foreground iteration loop. The foreground
> bug backlog is cleared.

## Read these now (in order)
1. **CLAUDE.md** (auto-loaded) — rules; **rule 8 is load-bearing this session** (it's visual/animation work).
2. **docs/session-end-report.md** — "Current state" + "ACV scope" + "Suggested next".
3. **docs/decisions.md** tail — **D158** (egg-cave acquisition: egg exists iff `!companionAcquired`, additive save, boot reconcile), **D159** (mounted rig repositions to the seat), **D154-D157** (ACU), **D150** (kinematic/feel = foreground-only), **D107** (procedural-only — relevant to item-model detail).
4. **docs/backlog.md** — the ACT idea-dump block + the 🟡 egg-cave / seated-pose / aim-twist partial entries.
5. `shared-memory/iterative-polish-discipline.md` — REQUIRED before any visual element.

## What's already built
Full singleplayer survival loop + a Rey-like stylized procedural rig (Lambert, no PBR shimmer). Companion is now **egg-gated**: a new game spawns no companion; you find the rock-biome cave and hatch an egg to get Pebble (spine shipped ACV — but the egg is a **placeholder emissive ovoid** + the chamber is unlit; that's ACW's polish). Sled tow (rope-leaves-inventory, POI collision, gentle slide), speeder, stake, salvage, storm. SAVE_VERSION 14.

## Session ACW focus
Finish the ACV scope-cut pile, **one fully-iterated visual element at a time** (rule 8: 1-2 well-iterated elements beats 5 shallow). Start by closing Cycle 7, then the speeder FX, then the rest.

## Priority items (in order — each gets the build→screenshot→critique→iterate loop)
1. **Egg + cave-bottom visual polish** (`rockyEntrance.ts`): the egg is a placeholder `SphereGeometry` ovoid with flat emissive — make it read as a real egg (procedural shell: speckled/veined skin via a material factory, a subtle pulse/glow), and **light the chamber** (claim 1-3 from `ctx.lightPool` near the egg so the descent isn't pitch-black; mirror the fire/salvage-glow claim pattern). `__game`-position the camera at the chamber to screenshot (rig-shot can't frame a cave). **Also foreground-confirm the egg-cave spine**: new game → no companion → hatch → Pebble; save round-trip; legacy save keeps companion.
2. **Companion proc-character** (`enemies/companion.ts`) — completes Cycle 7: rebuild the body via the D128 Lathe pipeline + D100 body-shell/hip-group decomposition; 5 rule-8 rounds.
3. **Speeder dust trail + engine-ignition FX** (`speeder.ts` + a particle module modeled on `footprintPuffs.ts`/`ambientDust.ts`): speed-gated dust under/behind the bike; engines light on throttle. Harness-checkable via a `--scenario` shot.
4. **Sandstorm wind pushes physics bodies** (#146, `weather.ts` read + a wind force): apply to dynamic dropped-item bodies + the unmounted speeder during storms (the sled is kinematic — nudge its slide-velocity or skip + note). Foreground feel-tune.
5. **3P control-prompt positioning** (#149, `interactPrompt.ts`) + **in-storm sensory degradation** (#134, `stormVignette.ts`/`controller.ts`/`audio.ts` — camera sway + near-zero forward-vis while engulfed; verify the ACL storm-wall already covers fog/vignette).
6. **Foreground-confirm ACV owed items**: seated speeder pose (tune `SPEEDER_RIG_SEAT_Y/Z`), aim-twist feel (`AIM_TWIST_*`).

## Stretch / standing levers
Art/animation pile (item-model detail, POI detail, lizard/shrew gaits + shrew burrow, held-item 3P placement, 3P use-anims) · game lighting mood (D142, surface first) · PM-D cloth robe · the heavy **dynamic salvage-panel placement** (its own design spike — surface before coding).

## Autonomy contract
Ambiguous → GDD pillars + decisions realism dial → new D-entry → continue. Surface only on: D107 asset-vs-procedural fork (item-model detail), save bumps (D81), destructive git, whole-game aesthetic shifts (lighting mood D142).

## Stop conditions
Wall-clock / budget · 3 fix-walls on one element (cut/log) · catastrophic block · destructive attempt · **rule 8: never mark a visual element done on tsc alone — screenshot-iterate or honestly flag it un-iterated.**

## On stop → `/session-end`
verify → changelog → CLAUDE Last-shipped → roadmap → D-entries → backlog → report → next-prompt → post-mortem (+consolidate) → commit + tag `session-ACW` + push.

## Notable footguns
- **D158 egg-cave**: the egg exists iff `!companionAcquired` (re-derived at boot); the reconcile is in `main.ts handoffToGame` AFTER loadGameState. Don't add an egg save field. `companionAcquired` is additive (legacy default true). If you change the egg's placement/identity, keep the boot reconcile coherent.
- **D159**: while mounted the player capsule is parked at y=-2000; the rig is repositioned to the bike seat — don't "fix" it by reading the parked body.
- **D150**: gait/feel/kinematic-velocity + the seated pose + aim-twist + wind-force feel are FOREGROUND-only to verify. Render-state (egg glow, dust FX, chamber light, materials) IS harness/`__game`-checkable.
- D107 procedural-only (item-model detail via more geometry is in-bounds; asset import is a user-call fork). rule 2 magic-numbers→tuning.ts; rule 6 no innerHTML; rule 7 box depth ≥10cm. SAVE_VERSION 14.

## Verification protocol
`npm run verify` (= `tsc --noEmit`) = type gate. Visual: `npm run rig-shot` (+ `--scenario`) or `__game`-positioned screenshots → iterate. Feel/kinematic + egg-cave round-trip: foreground `npm run dev` / `__game`.

## Begin block
1. Read CLAUDE.md, session-end-report, decisions tail (D158/D159 + D150/D107), backlog, the discipline doc.
2. `npm run verify` baseline.
3. Start priority 1 (egg/cave visual) — `__game`-frame the chamber, screenshot, iterate; foreground-confirm the spine.
4. TaskCreate one task per priority item; honor the rule-8 loop per element.
