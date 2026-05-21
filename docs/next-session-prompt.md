# Session VV — Kickoff Brief

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded) — project manual, current state, architecture rules
2. `docs/session-end-report.md` — cumulative state through Session UU, the "what works end-to-end" reference
3. `docs/decisions.md` — D1-D75 with friction-scores. Pay attention to **friction ≥ 4** entries — especially D73 (wieldAction.ts dispatcher) + D74 (wieldLmb field) which just shipped.
4. `docs/roadmap.md` — "Overnight queue" lists the 5-session sequence (UU shipped; VV/UU-2/WW/XX queued)
5. `docs/backlog.md` — unprioritized ideas / bugs / polish / debt
6. `docs/architecture.md` — file map; consult only if you don't know where a system lives

## What's already built

Dustfall is 21 sessions past start, post-MVP. The lone-survivor sandbox loop
works end-to-end. Session UU just shipped the control scheme overhaul:
LMB-leaning interactions via the new `wieldAction.ts` dispatcher. Hold-LMB
to drink the canteen, click-LMB to deploy a kit, click-LMB to pick up
ground items. E retained for "open this thing" — loot containers, sleep,
mount, read, refill, harvest, cook, salvage. No known critical bugs.

## Session VV focus

**Tuning lift + crosshair feedback + `as any` fix** (~1.5h). Architecture
hygiene + first-impression polish. Three discrete shippable improvements
bundled. Acts as a palette cleanser between UU and UU-2 (both interaction-
dispatch sessions). Different files, different mental model.

This is a low-risk session by design — no novel architecture. Mostly
mechanical refactors + one small UI polish item.

## Priority items (in order)

1. **Lift `src/world/fire.ts` local constants to `Tuning.FIRE_*`** (~20 min).
   - Lines 32-36 hold 5 local constants:
     - `FIRE_INITIAL_FUEL = 90` → `Tuning.FIRE_INITIAL_FUEL_S`
     - `FIRE_FUEL_PER_BRANCH = 30` → `Tuning.FIRE_FUEL_PER_BRANCH_S`
     - `SHELTER_RADIUS = 2.2` → `Tuning.FIRE_SHELTER_RADIUS_M`
     - `SHELTER_HEIGHT = 1.5` → `Tuning.FIRE_SHELTER_HEIGHT_M`
     - `NEAR_FIRE_DISTANCE_SQ = 1.5 * 1.5` → `Tuning.FIRE_NEAR_DISTANCE_SQ`
   - Acceptance: tsc clean, fire deploy works identically (values preserved).

2. **Lift `src/world/tent.ts` local constants to `Tuning.TENT_*`** (~10 min).
   - Lines 21-22 hold 2 local constants:
     - `TENT_SHELTER_HALF = { x: 1.8, y: 1.4, z: 1.8 }` → `Tuning.TENT_SHELTER_HALF_X/Y/Z`
     - `NEAR_TENT_DISTANCE_SQ = 2.0 * 2.0` → `Tuning.TENT_NEAR_DISTANCE_SQ`
   - Acceptance: tsc clean, tent deploy works identically.

3. **Crosshair feedback** (~45 min — largest item).
   - `#crosshair` in `src/style.css` (around line 141) — the current
     crosshair is a thin static dot/cross.
   - Add an `updateCrosshair(ctx)` hook in `src/ui/interactPrompt.ts`
     (or a new tiny `src/ui/crosshair.ts` if you prefer separation).
     Wire it into `main.ts` per-frame tick.
   - States to render:
     - Default (no hover): thin dot.
     - On `ctx.inventory.hover !== null`: thicker / brighter (signals
       "interactable in view").
     - On `ctx.inventory.hover?.type === 'kill'`: red (signals enemy
       in view; lizards are the only target this fires on currently).
   - New Tuning constants: `CROSSHAIR_THICKEN_PX`, `CROSSHAIR_KILL_COLOR_HEX`.
   - Acceptance: visible color/size change on hover, tsc clean.

4. **Fix the lone `as any` cast in `src/world/wrecks.ts:137`** (~10 min).
   - Replace with a proper typed assertion or extend the cached-material
     interface. The cast is on a `MeshLambertMaterial` to set `side =
     THREE.DoubleSide` (SS-era fix for the opening wreck interior
     rendering). The Material type has `side` — the `as any` is likely
     a relic of a stricter type elsewhere.
   - Also drop the `// eslint-disable-next-line` comment on line 136.
   - Acceptance: `Grep "as any" src` returns 0 matches; tsc clean;
     `Grep "eslint-disable" src` returns 0 matches (or just one fewer).

## Stretch goals (if budget allows)

- Lift `src/world/sled.ts` near-distance / yaw-lerp local constants
  to `Tuning.SLED_*` (some are already in Tuning per the QQ-2 work,
  but check for any lingering locals).
- Audit `src/audio/audio.ts` for the most-tuned magic numbers
  (master gain, footstep gain) — lift 5-10 to `Tuning.AUDIO_*`
  if there's time. The full audio.ts lift is WW-tier work; don't
  bite off more than 30 min here.

## Autonomy contract

- When ambiguous: pick the option closest to GDD pillars (Pillar 4 —
  tactile world) + D-entries D73/D74/D75 just shipped. Append a new
  D-entry if you make a non-obvious call. Keep going.
- Footgun: **VV does NOT touch `src/persistence/save.ts`**. Save
  schema stays at v6. If you find yourself reading save.ts, you've
  scope-crept; back up and reconsider.
- Never ask the human mid-session.

## Stop conditions (overnight mode)

- All 4 priority items shipped + verify passes → `/session-end`.
- 3-strike wall (same fix attempted 3x) → invoke `/scope-cut` against
  the pre-committed list in `.claude/plans/i-want-to-set-floating-dusk.md`
  Session VV section.
- Catastrophic block (tsc broken, dev server crashes) → halt + write
  a CAUTION entry in `next-session-prompt.md` for the morning.
- Destructive action attempt → halt unconditionally.

## On stop

Invoke `/gamedev-framework:session-end` to verify + append changelog +
bump "Last shipped" + rewrite session-end-report + write next-session-
prompt for UU-2 + commit + tag `session-VV` + push.

## Pre-committed scope cuts (cut top-first on 3-strike wall)

1. **Red-on-enemy crosshair color** (the `kill` hover path). Cut means
   crosshair thickens but doesn't go red. Easier debug; cosmetic loss.
2. **Crosshair feedback entirely**. Cut means VV ships just the tuning
   lifts + `as any` fix — ~40 min session that frees budget for UU-2.
3. **Tent constants lift** (only 2 constants). Cut means just fire
   constants lifted; tent stays for WW.
4. **`as any` fix**. Cut means the codebase keeps its lone `as any`.
   Last cut — 10-minute change with zero feel impact.

## Notable footguns

- **D62 (terrain shader vNormal is VIEW space)** still applies if you
  touch any shader; not expected for VV.
- **D75 (PLACEMENT_DISTANCE_M = 2.2)** just shipped. Do NOT re-locally-
  constant placement distances in fire/tent/sled — they're already on
  the Tuning constant.
- **D73 (wieldAction.ts as sole LMB dispatcher)** just shipped. Do NOT
  add LMB handling to other modules; future LMB behaviors go into
  wieldAction's switch.
- **VV doesn't touch interaction.ts or wieldAction.ts** unless adding
  the crosshair hook there. If you find yourself editing dispatch
  logic, you've scope-crept.

## Verification protocol

```
npm run verify  # = tsc --noEmit
```

Plus eval-driven preview verification:
1. tsc clean.
2. Deploy a fire — works identically (proves fire.ts constants lift didn't change behavior).
3. Pitch a tent — works identically.
4. Look at a lizard → crosshair turns red.
5. Look at a pickup → crosshair thickens.
6. Look away from both → crosshair returns to default.
7. `Grep "as any" src` returns 0 matches.
8. Save + reload → save schema unchanged (still v6).

## Begin block

Read CLAUDE.md (auto-loaded) → `docs/session-end-report.md` →
`docs/decisions.md` (especially D73-D75 just shipped). Create
a TaskCreate top-level list with the 4 priority items. Mark item 1
(`fire.ts constants lift`) as `in_progress`. Begin with `Read
src/world/fire.ts` to confirm the 5 constants on lines 32-36, then
edit `src/config/tuning.ts` to add the `FIRE_*` block, then edit
fire.ts to reference them.
