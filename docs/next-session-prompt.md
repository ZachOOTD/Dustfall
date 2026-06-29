# ▶ RESUME — Escape-pod intro · Phase 1 · the CYLINDRICAL pod INTERIOR REDO (C12) — `campaign/escape-pod-intro`

**Cycle 12 of the escape-pod-intro campaign.** Phase 1 (the hero pod), CYLINDRICAL redesign (D271). The
boxy interior (C10) must be rebuilt to match the new **vertical riveted aluminium capsule** exterior
(C11, shipped). Then T1.3 (seated camera) → Phase 1 milestone. Boot from `docs/campaign/campaign-state.json`
+ `docs/roadmap.md` (NOT chat memory).

## Read first
1. `CLAUDE.md` (auto-loaded) — "Where we are now"
2. `docs/decisions.md` **D271** — the cylindrical identity · `docs/research/escape-pod-cylindrical.md` (live ref)
3. `src/world/escapePodIntro/podScene.ts` — the C11 hero EXTERIOR (`placeCrashedPodWreck` + the lathe capsule helpers + `createRustedHullMaterial` tuning — MATCH this) + the box INTERIOR to replace (`buildPodScene`) + the contracts (`getPodSpawn`/`setDescentProgress`/`setParachuteLeverPull`/`disposePodScene`).
4. `src/world/escapePodIntro/sequence.ts` — the seated beats that use the interior (enterPod/shipExplode/descent/parachute; `ctx.intro.mode==='seated'`; `setParachuteLeverPull` wired in `tickParachute`).

## What's built
- **C11 hero EXTERIOR** = the half-buried vertical riveted-aluminium capsule (`placeCrashedPodWreck`) — passed 2 adversarial gates (helmet-read + float both fixed). This is the look to MATCH inside.
- **The INTERIOR is still the C10 BOX cabin** (`buildPodScene`: grey-beige panels + dark-steel ribs + viewport + red parachute lever + yellow eject + console + seat) — it's a rectangular cabin, mismatched with the round capsule exterior. C12 rebuilds it round.

## Cycle 12 focus — the cylindrical pod INTERIOR (procedural-modeler)
**Delegate to the `procedural-modeler` agent.** Rebuild `buildPodScene` as the interior of a **round riveted-aluminium capsule** (matching the C11 exterior identity + materials), seen seated first-person through eject→descent→parachute. Keep the praised C10 hardware (the red parachute lever + `setParachuteLeverPull` jab/droop, the yellow eject control, the console, the seat, the viewport) but re-home it in a CURVED cabin:
- **Curved ribbed cabin shell** — concave/cylindrical walls (lathe/cylinder interior or curved panels), riveted ring-frames + vertical ribs following the capsule, exposed conduit, a warm dim cramped feel — reading as the INSIDE of the C11 capsule (same `createRustedHullMaterial` aluminium idiom, NOT the box's flat grey-beige walls).
- **Viewport** — keep it where `setDescentProgress`'s planet shows through (the Phase-2 descent showpiece frames through it); curve-seat it in the round wall.
- **The chunky RED parachute lever** (keep `setParachuteLeverPull(t,snapped)` — jabs per-pull, droops on the snap) + the **yellow eject control** + the **console** (dim amber screen, gauges, telltales) + the **seat/restraints** — re-placed in natural seated reach within the round cabin.
- **Contracts intact:** `buildPodScene`/`getPodSpawn`/`setDescentProgress`/`setParachuteLeverPull`/`disposePodScene` must keep working so the beats keep playing (`__game.smokeIntro()` → `{ok:true,beats:10}`).
- Iterate via the REAL seated FP view: `__game.startIntro()` → `jumpToBeat('enterPod'|'descent'|'parachute')`. The offset pod interior is a LIGHT scene → `preview_screenshot` WORKS here (unlike the heavy desert). 5-8 rounds to the hero bar.

### Acceptance (C12)
- The seated FP view reads as the inside of a round riveted-aluminium capsule matching the exterior, with the viewport (planet through it) + chunky red parachute lever + yellow eject + console + seat in natural reach. The beats still play (smoke ok). `verify:all` green end-to-end (600s, real exit); flag OFF → live game byte-unchanged; no SAVE_VERSION bump.

## Visual gate (HERO — ultracode)
After the modeler converges, run the adversarial visual gate (the `pod-exterior-visual-gate` workflow pattern — adapt the PNG paths/lenses for the seated INTERIOR view: `preview_screenshot` the seated cabin at enterPod/descent/parachute, or a `pod-interior` rig) — N harsh critics + a code auditor, severity-ranked. The C11 lesson: the builder's self-critique + a single look MISS identity/pareidolia failures — the adversarial gate catches them. PASS = no sev≥2 + identity (round capsule interior matching the exterior) holds; iterate else.

## Then
T1.3 — seated-FP camera + viewport framing (lower the seated eye into the chair; frame the viewport). Then
**Phase 1 milestone → PAUSE** for the user's "pod in + out" walk-test of the cylindrical pod (exterior + interior).

## Campaign rules
ENRICH-NOT-CUT · hero geometry → procedural-modeler + the **adversarial visual gate** (it caught the C11 helmet + float; use it) · anti-punt · behind the flag · no save bump · `verify:all` (600s, real exit, NOT piped through `tail`) · commit each cycle · checkpoint = per phase.

## Footguns
- MATCH the C11 exterior identity/material (round riveted aluminium, `createRustedHullMaterial`) — interior + exterior are the SAME pod; the box cabin is wrong now.
- Keep the podScene contracts so the beats keep playing; keep `setParachuteLeverPull` working (the gag).
- `verify:all` slow → 600s + real exit. `preview_screenshot` works for the offset pod interior; hangs on the full desert.
- RUN THE ADVERSARIAL GATE before declaring done (the C11 lesson — self-critique missed the helmet + float).
- Keep `FEATURES.escapePodIntro` OFF by default.

## Verify
`npm run verify:all` (600s, real exit) + the adversarial visual gate on the seated interior + `__game.smokeIntro()` ok + 0 console errors.
