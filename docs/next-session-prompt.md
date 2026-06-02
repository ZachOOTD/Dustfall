# Session ACU — Kickoff Brief

> Recent: night-dust ✓ACO, panel-faceYaw ✓ACP, quick-wins+Pebble+stake+mount-gate ✓ACQ,
> shrew catch/cook ✓ACR, carcass-tow flow ✓ACS, **FP footprints/audio + 3P interact-hints +
> world-space texture-swim sweep ✓ACT**. The headless-tractable backlog is cleared.
> **The user is playtesting in the foreground.** START by reading any new findings they bring,
> then chase the one remaining foreground bug + the feature-sized backlog.

## Read these now (in order)
1. **CLAUDE.md** (auto-loaded) — rules; note the tick order + rule 8 (visual iteration discipline).
2. **docs/session-end-report.md** — cumulative state (top "Current state" + "ACT scope" + "Suggested next").
3. **docs/decisions.md** tail — **D151** (rig gait bookkeeping runs in BOTH camera modes, above the visibility gate), **D152** (3P interaction ray originates from the player eye), **D153** (every viewmodel/held item moves → localSpace via wrappers; extends D109), and the prior **D146-D150** verification-environment canon.
4. **docs/backlog.md** — the ACT idea-dump block (bottom) + the open `[bug]` lines.
5. `shared-memory/iterative-polish-discipline.md` + `preview-screenshot-tips.md` — REQUIRED before any visual/animation work (the ACT idea wave is heavily visual).

## What's already built
A full singleplayer desert-survival loop + a believable stylized procedural player rig (skinned, dressed, PBR, dynamic aim-twist). Night sky reads clean; footprints + footstep audio now work in both camera modes; 3P interact hints reach correctly; procedural weathering no longer swims on moving models. A Playwright `rig-shot` harness with static pose/closeup shots + live `--scenario` mode. SAVE_VERSION 14.

## Session ACU focus
Confirm the ACT fixes hold in real play, kill the last foreground bug, then pick up the feature-sized backlog. Beyond that, the ACT idea dump opens a large **art/animation wave** the user wants — scope it deliberately (it's multi-session).

## Priority items (in order)
1. **Foreground confirm the ACT fixes** (no code unless they fail). In `npm run dev`: FP walk → footprints + footstep SFX appear; 3P walk up to a pickup/fire/sled → `[E]` hint at normal range; drive speeder + walk 3P + equip held items → weathering stays locked to surfaces (no swim). If any fails, that's the first fix.
2. **Random dramatic speed spike** (#40, `controller.ts` / `speeder.ts`) — **foreground-only (D150)**. On-foot speed is `speed*dt` (dt clamped 0.1 in `loop.ts`), so it's bounded; suspect the SPEEDER (dynamic body — collision-penetration velocity / `setLinvel` lerp) or a dismount state-leak. Play on-foot vs on-bike, note WHEN it spikes (after collision? boost? dismount?) to localize, then clamp/​fix the unbounded path.
3. **Sled-vs-POI collision** (#42, `sled.ts`) — the sled (`KinematicPositionBased`) has terrain collision but passes through POI/wreck static colliders. Needs an explicit shapecast against POI colliders before the kinematic slide moves (non-trivial; architectural-ish).
4. **Rope-leaves-inventory while deployed** (#50, `rope.ts` / inventory / `save.ts`) — currently the rope stays in-slot via `meta.attachedSledId`; make it leave the bag when both ends are tied and return when re-grabbed. Save-touching state-model change → likely SAVE_VERSION 14→15 (additive, D81).

## Stretch / the ACT art-animation wave (scope before diving — multi-session)
Higher-detail item models + correct 3P hand placement + 3P use-animations; lizard/shrew walk gait + shrew burrow animation; speeder dust trail + engine-ignition FX; seated 3P speeder rig + camera (closes the ACN mount-pose bug + D116); cloth-physics robe (PM-D); lighter sled drag-mark colour (`footprints.ts` sled tint — quick); POI model detail; **dynamic salvage-panel placement on procgen POIs** (clip-safe surface-finding — the heaviest item, needs its own design spike). Each visual element gets the rule-8 build→screenshot→critique→iterate loop (5-8 rounds new / 3-5 tuning).

## Autonomy contract
Ambiguous → GDD pillars + decisions realism dial → new D-entry → continue. Surface only on: D107 (procedural-vs-asset fork — relevant if the "higher-quality item models" means importing assets), save bumps (D81), destructive git, whole-game aesthetic shifts (lighting mood — D142).

## Stop conditions
Wall-clock / budget · 3 fix-walls on one bug (cut/log) · catastrophic block · destructive attempt · **if a bug can't be reproduced foreground either, log the finding + move on (don't blind-fix — D150 discipline).**

## On stop
Invoke `/session-end` (verify → changelog → CLAUDE Last-shipped → roadmap → D-entries → backlog → report → next-prompt → post-mortem → commit per Dustfall git policy).

## Notable footguns
- **D150**: gait/footstep/on-foot-speed/feel bugs are FOREGROUND-only — the headless harness's kinematic `linvel` reads 0 (`speedMag=0`). Don't repro-or-claim them via the harness.
- **D151/D152**: the rig visibility gate is a RENDER optimization, not a logic switch (anything other systems read off the rig must update in both modes); the interaction ray originates from the player eye in 3P. Don't regress these.
- **D153**: any new held/viewmodel item material must be localSpace — route through the `vm*` wrappers in `items.ts`; any new MOVING entity needs `localSpace: true` on its procedural materials (D109).
- **D147**: the harness no longer traps the cursor (`enterGame` skips PointerLock) — don't re-add a lock on automated entry. **D149**: drive `--scenario` from Node, pre-dismiss the tutorial overlay (gates LMB).
- D107 procedural-only (the "higher-quality item models" idea may force an asset-vs-procedural decision — surface it); rule 2 magic-numbers→tuning.ts; rule 6 no innerHTML; rule 7 box depth ≥10cm. SAVE_VERSION 14.

## Verification protocol
`npm run verify` (= `tsc --noEmit`) = type gate. Velocity/feel bugs' QUALITY gate = a foreground `npm run dev` repro+observe+iterate (rule 8). Render-state changes can use the `--scenario` harness; visual/animation work uses `npm run rig-shot` + screenshot iteration.

## Begin block
1. Read CLAUDE.md, session-end-report, decisions tail (D151-D153 + D146-D150), backlog ACT block, the discipline docs.
2. `npm run verify` baseline.
3. Ask the user for their playtest findings (or read what they paste); confirm the ACT fixes; then start priority item 2.
4. TaskCreate one task per priority item; work them in order.
