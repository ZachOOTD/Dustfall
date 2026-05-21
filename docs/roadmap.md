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

## Recently shipped (overnight + post-overnight)

- **Overnight era** (UU through ZZ, 7 sessions, 2026-05-21): control scheme overhaul, RMB context verbs, HUD polish, larger enterable tent, perceivedIntensity split (visual + audio halves).
- **Session AAA** (2026-05-21): first-impression polish bundle — UU pickup migration reverted (E takes again), ghost preview for LMB-place, vignette threshold lowered, recipe book panel, crosshair `.dead` state.
- **Session AAB** (2026-05-21): world depth — salvage yield differentiation per wreck kind + skylight god-rays for opening wreck.
- **Session AAC** (2026-05-21): craftable home — bedroll/lantern/locker kits, SAVE_VERSION v8.
- **Session AAD** (2026-05-21): playtest polish for AAC kits — ghost-ring sizes + bedroll visibility.
- **Session AAE** (2026-05-21): creature companion (Rocky-inspired), SAVE_VERSION v9.
- **Session AAF** (2026-05-21): 7-day storm countdown ("THE LONG STORM") — escalating-storm endgame.
- **Session AAG** (2026-05-21): atmospheric polish + inventory swap-on-full — footprint puffs, dust motes, mirage shader, hold-E swap-on-pickup-full.
- **Session AAH** (2026-05-21): playtest polish for AAG — Tuning lifts (footprintPuffs + interaction.ts swap-duration) + 5 feel tweaks (puff height ↑, motes opacity ↑, swap snappier, mirage near-edge ↓, motes storm cross-fade softened).

## Up next

Procedural world generation (POI randomization per seed) is the next-recommended architectural lift — the user has called it "the logical next step" with the caveat that it needs careful work. See `docs/next-session-prompt.md` for the kickoff brief and the fire-grill-attachment fallback if a smaller session is preferred.

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
