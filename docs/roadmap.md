# Roadmap

Next sessions in execution order. One-liner each + terse scope notes.
Detailed plans live in `.claude/plans/<session>.md` while active; on ship
they're archived + summarised in [changelog.md](changelog.md).

When done with a session, the `/session-end` skill removes the "Next" entry
and promotes the second.

> **Framework note** (retrofit 2026-05-20): Dustfall opts out of the
> gamedev-framework v0.3.x tier-ladder structure (Tier 1/2/3/4 with
> explicit success criteria + verify commands). At 17 shipped sessions
> Dustfall is post-MVP; the per-session "Next + Big-ticket bucket"
> structure already validated stays in use. Skills `/plan-vertical-slice`
> and `/verify-tier` do not apply. The Scope-cut section at the bottom
> exists to satisfy framework-skill expectations and may be populated
> per-session by `/plan-game` or its successor.

---

## Overnight queue + follow-on (COMPLETE — UU+VV+UU-2+WW+XX+YY shipped 2026-05-21)

5-session overnight run + 1 follow-on polish session. Plan archived at `.claude/plans/i-want-to-set-floating-dusk.md`. All sessions shipped ✓. The overnight era is closed.

Next session pick is open — pick from "Next — Big-ticket bucket" below or `docs/backlog.md` polish items (e.g., wind audio off `intensity` → `perceivedIntensity` as a small completion of YY's split).

## Next — Big-ticket bucket (1–2 picks per session at ~4–7h each)
Pick whatever feels most missing after the polish + atmosphere arc.

- Crafting rework — combine up to 4 items to discover recipes (no grid); chooser for overlapping outputs. Replaces the current bloating recipe list. (shipped UU/TT-era; remaining work = chooser UI for overlapping outputs once two recipes share inputs)
- Small red creature companion (pocketable + re-deployable) — charm + character, no combat surface area, scoped at one session
- Raider variants (scout / ambusher / brute) — *if* we decide to bring raiders back
- Q2: Rigged hands + lizard (GLB-dependent — deferred with N's asset work)
- Base-building mechanics
- Trading / NPC economy
- 7-day storm countdown
- Bounties (template: D39 `'mount'` singleton-interactable pattern from CC-2)
- Procedural world generation (idea — POIs randomized per seed)
- Remove HUD stat bars in favor of audio/visual/text cues (idea)

---

## Continuous polish (interleaved between numbered sessions)
- Environmental: dust motes in light beams, footprint puffs, distant cloud
  bank, mirage shader on salt-flat biome.
- Audio: source + commit CC0 sample pack into `public/audio/` (file
  contract in archived Session X plan). Architecture is in; soundscape
  activates each stem as its .ogg lands.
- HUD micro-polish: low-stat warning vignettes (cold = blue tint, thirst =
  brown), interact-prompt fade, low-stamina screen wobble.
- Crosshair feedback: thicken on interactable, red on enemy.
- **Title screen — "real-world render" variant** (idea, deferred from
  CC-3): instead of the dedicated title scene, render the actual game
  world behind the menu — camera floating around the opening-scene wreck,
  parallax on the pod-crash narrative. Higher-effort cinematic intro.

---

## Scope-cut candidates (pre-committed)

Per the framework's autonomy convention: if a session's verify fails 3x
or time pressure trips, `/scope-cutter` (or its successor) is authorized
to cut from this list in order. Top entry cut first.

Currently empty. Populate at the start of each session if the session
plan has scope risk worth pre-committing cuts for.
