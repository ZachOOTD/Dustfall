# ▶ CAMPAIGN cycle 39 — Kickoff Brief — `campaign/2026-06-18`

**Phase B is building unattended (M6→M10).** Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next"
(the AUTHORITATIVE queue) — NOT from this file's hints. The loop commits every cycle and pauses only at
`### Milestone: Phase B — Build-out complete` (after M10). Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` (your inbox) + `docs/campaign/campaign-log.md` (recent cycles).
3. `docs/roadmap.md` "Up next" → Phase B unit list.
4. `docs/decisions.md` tail (D245 chooser, D246 survival) + `docs/backlog.md` §A + `shared-memory/iterative-polish-discipline.md`.

## What's already built (one paragraph)
Phase A (M1–M5b) shipped + Phase B is underway: C37 lit the crafting **chooser** via a new `signal_kit` flare; C38 made survival
REAL + forgiving (GOD_MODE off, a Long-Dark curve + health regen, gated by a `survival-probe`). The world already uses **9 procedural
shader factories** for its hero surfaces — `src/world/*Material.ts`: `metalMaterial.ts` (createMetalMaterial), `hullMaterial.ts`
(createRustedHullMaterial), `woodGrainMaterial.ts`, `boneMaterial.ts`, `glassMaterial.ts`, `fabricMaterial.ts`, plus stone/concrete/
terrain/skin variants. But a number of secondary surfaces still use **flat `MeshLambertMaterial`/`MeshBasicMaterial` single colors**
that read cheap up close (e.g. fire logs in `world/fire.ts`, various prop/decoration meshes).

## Cycle 39 focus — **M6 ③ flat-color-texture-audit (L, SCOPE-FIRST)**
Upgrade the ~6–8 WEAKEST flat-shaded surfaces to the existing procedural shaders. **Zero new shader programs, zero asset bytes** — this
is NOT the D107 real-PBR fork. Reuse the 9 factories; do not author new material classes or import textures.

### Priority items (in order)
1. **SCOPE FIRST — identify the worst offenders.** `grep` for `MeshLambertMaterial` / `MeshBasicMaterial` / `flatShading: true` across
   `src/world/`, `src/inventory/items.ts`, `src/enemies/`. Rank by (a) how often the player sees the surface up close and (b) how cheap
   the flat color reads. Pick the **~6–8** highest-impact surfaces. Write the shortlist into the cycle plan BEFORE editing (and `log()`
   anything you DON'T get to, so the cut is visible — no silent truncation). Candidates to check: fire logs/ember, prop tableaux
   set-dressing (`world/wordlessScenes.ts`), skeleton bone (already `boneMaterial`? confirm), pickup/decoration meshes, tent/kit fabric.
2. **Upgrade each via the nearest existing factory** — wood → `woodGrainMaterial`, metal → `metalMaterial`, stone/rock → the stone/
   concrete factory, bone → `boneMaterial`, cloth → `fabricMaterial`. Match the `localSpace` convention the viewmodel helpers use
   (`vmWood`/`vmMetal` in items.ts) for held items. Keep the program count flat — confirm with the perf-probe (`programs` must not rise).
3. **Per-surface visual iteration (Rule 8 — this is VISUAL work).** For each upgraded surface: render via the rig-shot/studio harness →
   critique → iterate. This is TUNING existing factories onto existing geometry (3–5 rounds), not net-new elements. Run the adversarial
   appearance gate (lighter pass — these are secondary surfaces, not hero assets) as the pass/fail; PASS iff no finding ≥ sev 2.
4. **Verify** — `npm run verify:all` + a perf-probe check that `programs` did NOT increase (the whole point: reuse, no new compiles).

### Stretch (only if the unit fits)
- Scout **M6 ④ remove-hud-stat-bars** (the next unit, dep on C38's survival): where the HUD bars live (`ui/hud.ts`), how `FEATURES`
  flags gate UI, what diegetic tells (screen vignette, audio, viewmodel) would replace each bar.

## Autonomy contract
Ambiguous call → pick the realism dial that fits the moody Dune/Long-Dark tone, log a D-entry, continue — never ask the human.
Flipping `FEATURES.*` ON is AUTHORIZED once the headless + visual gates pass (reversible; user vetoes FEEL at review). **D81 SAVE-VERSION
bump still STOPs the loop — surface it, never bump autonomously** (a material swap shouldn't need one, but watch it).

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify-baseline break · 3 consecutive fix-walls on one gate · a needed save-version bump (STOP
+ surface) · destructive-action attempt (blocked). Pause: steering "pause" · the Phase-B milestone (after M10).

## Notable footguns
- **Program-count creep** is the trap: every NEW material *factory call with new uniforms* can add a shader program. Reuse the SHARED
  factories with the same options so the program cache hits (`three-js-procedural-material-onbeforecompile.md`, D207). Perf-probe `programs` before/after.
- Visual work demands screenshots — do NOT ship a material swap on `tsc`-clean alone (Rule 8 / `iterative-polish-discipline.md`).
- `verify:placement` buffers output to the END + is slow; don't kill it early or `taskkill node.exe` mid-run (C18 zombie footgun).

## Verification protocol
`npm run verify:all` (tsc + `verify:placement` ×5 + `verify:colliders`) + a perf-probe `programs` check. Visual surfaces → the
adversarial appearance gate + Rule-8 iteration per surface.

## Begin
Read the order above → `TaskCreate` the scope-shortlist → upgrade surface-by-surface with screenshot iteration → `verify:all` + perf
check → `/session-end`. Boot fresh from FILES; don't trust chat memory.
