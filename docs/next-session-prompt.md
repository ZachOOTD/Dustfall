# Session UU — Kickoff Brief

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded) — project manual, current state, architecture rules
2. `docs/session-end-report.md` — cumulative state through Session TT, the "what works end-to-end" reference
3. `docs/decisions.md` — D1-D72, with friction-scores. Pay attention to **friction ≥ 4** entries — D70 in particular for the just-shipped crafting model + D71 for recipe id stability
4. `docs/roadmap.md` — "Next — Big-ticket bucket" lists the remaining big-ticket items
5. `docs/backlog.md` — unprioritized ideas / bugs / polish / debt
6. `docs/architecture.md` — file map; consult only if you don't know where a system lives

## What's already built

Dustfall is 20 sessions past start, post-MVP. The lone-survivor sandbox loop
works end-to-end: spawn at the redesigned opening wreck → read the journal at
the dead survivor's hand → exit to the speeder → cross the 2400m world via
hover speeder + on-foot → harvest at the salt-flats well → salvage at procgen
wrecks → fight lizards / sand worm boss with one of 5 weapons → craft (now via
combine-to-discover) → save + reload. Just-shipped TT replaced the explicit
recipe list UI with a 4-slot combine-mode UI; save format v5→v6 with
ALL_RECIPE_IDS seeded as legacy fallback. No known critical bugs.

## Session UU focus

**Control scheme overhaul — LMB-leaning, modern-survival parity.** Replace
the "E for every interaction" pattern with a more granular click-driven
model: hold LMB to drink the canteen, click LMB to place a kit/sled, click
LMB to pick up a pickup, etc. E stays for opening containers / sleeping /
reading the journal (the "open this thing" actions). The goal is a control
scheme closer to The Long Dark / Rust / Subnautica defaults where the
mouse owns most action verbs and the keyboard owns movement + a small set
of meta actions.

This is the **highest blast radius** of any remaining bucket item — it
touches every per-item `onUse`, plus `combat.ts` + `interaction.ts`. Plan
for ~4-6h.

## Priority items (in order)

1. **Audit + categorize current E-actions** (~30 min)
   - Read every per-item `onUse` in `src/inventory/items.ts` and every
     `case` in `src/player/interaction.ts`'s `case 'lootContainers' /
     'tents' / 'sleds' / 'speeder' / ...` dispatch. Classify each as
     either:
     - **Take/use** (drink canteen, deploy fire_kit, use bandage) →
       migrate to LMB-while-wielded (hold for sustained actions, click
       for one-shot).
     - **Open** (loot container, sled cargo, tent for sleep, journal) →
       keep on E.
     - **Pick up** (item pickup) → migrate to LMB on the world item.
     - **Tool use** (machete swing, scrap_gun fire) → already LMB; no
       change.
   - Write the audit to a working scratch file or as comments in
     `interaction.ts`; the next priority items act on it.
2. **Hold-LMB sustained-action infrastructure** (~1h)
   - The canteen drinks one gulp per LMB click currently. The new
     model is "hold to drink" — drink while LMB is held, stop when
     released. Mirror the existing `chargeProgress` pattern from the
     energy_pistol (Session PP). Files: `combat.ts` (or a new
     `wieldAction.ts` if combat.ts gets too crowded),
     `inventory/items.ts` (canteen.onUse signature extends with a
     `holdProgress` flag or similar).
3. **LMB-driven placement** (~1.5h)
   - Currently E (or wielded-item.onUse fired via E) deploys
     fire_kit / tent_kit / sled_kit. Rewire so LMB while the kit is
     equipped triggers placement. Crosshair shows a ghost preview of
     where the kit would land at the camera-forward 2.2m mark.
4. **LMB-driven pickup** (~30 min)
   - Pickups on the ground currently take via E. Switch to LMB on
     the pickup's mesh, with a passive prompt "[click] take ..."
     that doesn't show the [E] chip.
5. **E semantics tightened to "OPEN"** (~30 min)
   - Loot containers, sled cargo, tents (sleep overlay), journal,
     speeder mount — all stay on E. Update the interact-prompt verbs
     to communicate "open" / "mount" / "read" / "sleep in" (most
     already do).
6. **Save format check** (~15 min)
   - No persisted state changes expected. `SAVE_VERSION` stays at 6.
     But: hotbar-selected-while-mid-hold state must NOT persist
     across save (cleared on save serialize).

## Stretch goals (if budget allows)

- **Right-mouse context action**: e.g., RMB on a tent → "pack up" + return
  to inventory. RMB on a sled → "release rope from speeder". Adds a third
  verb for advanced players without bloating the LMB menu.
- **In-game controls hint card** that reflects the new scheme (the existing
  one at `__game.showControls()` needs updating).

## Autonomy contract

- When ambiguous: pick the option closest to GDD pillars (Pillar 4 —
  tactile world / every object earns its mesh) + D7/D9/D13 (sandbox tone,
  combat-isn't-the-point). Append a D-entry, keep going.
- Footgun: **moving an interaction off E may break muscle memory** for the
  user. Surface the migration in the changelog explicitly so they can
  adjust expectations on first boot. Document any tutorial / hints panel
  updates.
- Never ask the human mid-session.

## Stop conditions (gated mode default)

- All 6 priority items shipped + verify passes
- 3-strike wall (same fix attempted 3x) → invoke `game-verifier`
- Catastrophic block (tsc broken, dev server won't start)
- Destructive action attempt (git push/force/amend without user grant)

## On stop

Invoke `/gamedev-framework:session-end` to verify + append changelog +
bump "Last shipped" + rewrite session-end-report + write next-session-prompt
+ print commit handoff.

## Notable footguns

- **D70 (combine-to-discover)** just shipped. The crafting menu's CRAFT
  button intentionally uses LMB-click on a DOM button — that's UI, NOT
  game-world LMB. The control scheme overhaul should NOT touch the
  crafting UI's button behavior. Distinguish in-world LMB from menu LMB.
- **D34 (speeder velocity-controlled motion)** — mounted speeder's W/S/A/D
  + Shift inputs are already LMB-independent. Don't break that.
- **D67 (sled inextensible rope)** — wielded rope LMB on a sled rope-stub
  attaches/detaches. That's already LMB-driven; no change needed but
  verify the new LMB-action infrastructure doesn't double-fire.
- **Combat LMB** already wired (Session PP). The new LMB-pickup + LMB-place
  paths must NOT fire when a weapon is the wielded item.
- **HMR can show stale singleton state** for module-level closures.
  Anything touching `_ctx` / `_selectedRecipe` / similar should expect
  a hard reload during dev.

## Verification protocol

```
npm run verify  # = tsc --noEmit; Dustfall opts out of tier-ladder verification
```

Plus eval-driven + HMR-aware playtest:
1. tsc clean.
2. Wield canteen → hold LMB → thirst stat drops continuously while held →
   release LMB → drinking stops. Toast on first sip.
3. Wield fire_kit → click LMB → fire spawns 2.2m in front. Toast "fire lit".
4. Look at a pickup → click LMB → item enters inventory (without the [E]
   chip).
5. Look at a loot container → E opens the menu (unchanged).
6. Wield machete → LMB on a lizard → still swings, no double-fire.
7. Wield rope → LMB on sled rope-stub → still attaches (unchanged).
8. Mount speeder → LMB still fires combat weapons (no LMB hijack).
9. Save + reload → no persisted state corruption.

## Begin block

Read CLAUDE.md (auto-loaded) → `docs/session-end-report.md` →
`docs/decisions.md` (especially D70 + D72 since they just shipped). Create
a TaskCreate top-level list with the 6 priority items. Mark item 1
`in_progress` (the audit). Begin work on `src/inventory/items.ts` +
`src/player/interaction.ts` — read both first, then classify each
interaction in scratch comments.
