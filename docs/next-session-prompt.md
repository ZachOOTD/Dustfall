# Session ACJ — Player-model arc, PM-B.2: face planes + goggles (then B.3)

> Player-model 5-cycle arc: **[docs/feature-player-model.md](feature-player-model.md)**.
> Done: PM-A (silhouette — slim/tapered, barrel killed) + PM-B.1 (hood wraps the skull,
> killed the floating disc). **This session: PM-B.2 — give the face real features** (it's
> a blank ovoid), then PM-B.3 (face-wrap + neck). Continues PM-Cycle B.

## Read these now (in order)

1. **CLAUDE.md** (auto-loaded) — rule 8 is LOAD-BEARING; faces are unforgiving, iterate honestly.
2. **docs/feature-player-model.md** — the arc + the **Model Verification Protocol (MVP-check)** + PM-Cycle B scope/pass-bar.
3. **docs/research/reference-tfa-jakku-opening.md** — Rey shots 4/7/10 (face + goggles + headscarf).
4. **docs/decisions.md** — recent tail; esp. **D134** (`__game.enterGame` / `rigStudio` headless loop), **D135** (rigStudio frames the face only after negating getWorldDirection — already fixed, but know it), D107 (zero-asset), D109 (localSpace), D115 (head Lathe profile).
5. **docs/session-end-report.md** — state through ACI.

## What's already built / the problem

The model now reads as a slim draped human (PM-A) with a hood that wraps the skull and a
face opening (PM-B.1). But the **face inside the opening is a smooth blank tan ovoid** — no
brow/nose/cheek/jaw, no goggles. It reads as a mannequin. The head is a Lathe profile
(`headProfile`, `playerRig.ts` ~L257) — currently a smooth silhouette of revolution, so it
has NO front/back features by construction.

## PM-B.2 focus — facial planes + goggles

Heavy visual-iteration; `tsc` is the type gate, NOT the quality gate. Use `rigStudio('head')`
+ the MVP-check (critique vs real-human + Rey + adversarial "still a mannequin?") EVERY round,
5–8 rounds.

## Priority items (in order)

1. **Facial planes** (`playerRig.ts` head section) — the Lathe-of-revolution can't have a
   face; add discrete feature geometry on the front of the head: brow ridge, nose
   (bridge + tip), cheekbones, jaw/chin definition, eye sockets (even shallow). Stylized
   low-poly is fine (it's D107 zero-asset) — the bar is "reads as a face from 3P," not realism.
   Consider: small boxes/wedges/spheres parented to the head for the nose/brow, or switching
   the front of the head from pure-lathe to a sculpted set of planes.
2. **Goggles** — a band + two lenses resting on the forehead/hood brow (Rey detail; goggles
   "dropped to neck/forehead" in the reference). Reads as the scavenger signature.
3. **MVP-check** each round: `rigStudio('head')` + front + 3q; critique vs real-human + Rey;
   adversarial "does this still read as a blank mannequin / does the nose read at 3m?"

## Then (if budget) PM-B.3
- Face-wrap = cloth over nose/mouth connected to the scarf (currently a floating ring `bandana`).
- Neck shortened/covered by the scarf drape (close any residual bare-neck gap).

## Autonomy contract
Ambiguous → GDD pillars + realism dial + the Rey reference, append a D-entry, continue.
Surface only on: procedural-vs-asset (D107), save bumps (D81), destructive git.

## Stop conditions
Wall-clock 2-4h. 3 fix-walls on the face → `/scope-cutter` (faces are hard; a stylized
"reads as a face" is the bar, not realism). **Rule-8 self-check**: never mark the face done
on tsc alone or without the adversarial "still a mannequin?" check passing.

## Notable footguns
- The head is a **Lathe of revolution** — it has no inherent front; facial features must be
  ADDED as separate front geometry (or the profile approach changed). Don't expect the lathe
  to grow a nose.
- **D135**: `rigStudio` now frames the face correctly (it negates getWorldDirection). If you
  add your own framing eval, remember the face is OPPOSITE `getWorldDirection`.
- **D107** procedural-only; **D109** localSpace on the moving rig.
- **Preview**: if `preview_screenshot` wedges, restart Claude Code / the preview MCP. Pause
  AFTER a frame settles the rig (D134 footgun) — or just use `rigStudio()` then `rigStudio('head')`.

## Verification protocol
`npm run verify` (= tsc) = type gate. QUALITY gate = the MVP-check via `rigStudio`, 5–8 rounds.

## Begin block
1. Read CLAUDE.md, feature-player-model.md (MVP-check + Cycle B), the Rey reference, decisions (D134/D135/D107/D115).
2. `npm run verify` baseline.
3. TaskCreate: facial planes → goggles → (B.3 face-wrap/neck).
4. `rigStudio()` then `rigStudio('head')`, iterate the face with the MVP-check each round.
