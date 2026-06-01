# Session ACK — Player-model arc, PM-C: layered outfit (re-dress the stripped torso)

> Player-model arc: **[docs/feature-player-model.md](feature-player-model.md)**.
> Done: PM-A silhouette, **PM-S SkinnedMesh foundation** (arms+legs skinned — the
> marionette ceiling is broken), PM-B face (goggles + lower-face scarf), poncho
> cut + junction fillers. **This session: PM-C — re-dress the now-STRIPPED torso**
> with a real layered outfit (NOT a fake poncho — D139) + fix shoulder bunching.

## Read these now (in order)
1. **CLAUDE.md** (auto-loaded) — rule 8 is LOAD-BEARING; visual work is iterated, not one-shot.
2. **docs/session-end-report.md** — full state through ACJ.
3. **docs/feature-player-model.md** — the arc + the Model Verification Protocol.
4. **docs/decisions.md** tail — **D136** (SkinnedMesh foundation + skinnedLimb.ts), **D137** (rigStudio frames +Z now — no negate), **D138** (Playwright `rig-shot` harness = verify path), **D139** (poncho cut — DON'T restore a fake one), D107 (zero-asset), D109 (localSpace).
5. **docs/research/sci-fi-desert-scavenger-aesthetic.md** + the Rey reference (`docs/research/reference-tfa-jakku-opening.md`).

## What's already built
A slim procedural scavenger: skinned arms+legs (continuous, smooth joints), goggled + scarf-wrapped head, rounded hips, belt + bandolier + backpack + pauldron. The torso itself is bare dark **undercloth** — the poncho was removed (it was a stiff fake). The figure reads "stripped/undressed" and needs a real garment layer.

## PM-C focus — layered outfit
Heavy visual iteration; `tsc` is the type gate, NOT the quality gate. Use `npm run rig-shot` (D138) every round (`--pose=idle|apose|walk`, `--angles=front,3q,left,back`, `--closeup=shoulder|hip|hand|face`). 5–8 rounds for new garments.

## Priority items (in order)
1. **Torso garment** (`playerRig.ts`) — a real layered top over the slim torso: e.g. a sleeveless tunic/wrap or vest in a distinct cloth tone (use `scarfMat`-style fabric, NOT the old poncho cylinder). Should sit ON the torso (follow its lathe profile), leave the arms visible, and read as worn cloth/leather. Parent to `spineBend`. Resting shape only — real drape is PM-D.
2. **Shoulder bunching fix** — with the poncho gone, check the shoulder/deltoid↔torso read at `--closeup=shoulder` (apose); refine the deltoid/garment so the shoulder line is clean.
3. **Legible belt/pouches + integrated pack** — now exposed; make sure they read as worn kit, not floating boxes.
4. **Visible gloved arms** — the forearm wraps + fingerless glove are already there; verify they read against the new garment.

## Then (if budget)
- **PM-S.3** — skin the torso to spine/hip bones for the TRUE junction blend (currently filler-bridged via deltoid/hip-cap spheres). Fold into PM-D if cloth physics needs it.

## Autonomy contract
Ambiguous → GDD pillars + the Rey reference + the scavenger aesthetic doc; append a D-entry; continue. Surface only on: procedural-vs-asset (D107), save bumps (D81), destructive git.

## Stop conditions
Wall-clock 2-4h. 3 fix-walls on a garment → `/scope-cutter`. **Rule-8 self-check**: never mark a garment done on tsc alone or without a harness screenshot + honest critique.

## Notable footguns
- **D137**: `rigStudio`/harness now frame the face at **+Z** (no negate). If you move the "front" again, re-run the two-sided marker test.
- **D138**: the preview-MCP screenshotter WEDGES mid-session — use `npm run rig-shot`, not the MCP, for captures.
- **D136**: limbs are SkinnedMeshes; `rig.shoulders/elbows/wrists/hips/knees/ankles` are now **Bones** (Object3D), animation/foot-IK unchanged. Don't reparent clothing to the limb bones expecting Group behavior — attach torso garments to `spineBend`.
- **D107** procedural-only (no GLB); **D109** localSpace on the moving rig.
- The harness boots its own dev server on port **5191** (strictPort) — kill stale dev servers if it fails to bind.

## Verification protocol
`npm run verify` (= tsc) = type gate. QUALITY gate = `npm run rig-shot` + honest critique, 5–8 rounds per garment.

## Begin block
1. Read CLAUDE.md, session-end-report, feature-player-model, decisions tail (D136-D139), the aesthetic/Rey refs.
2. `npm run verify` baseline.
3. TaskCreate: torso garment → shoulder fix → belt/pouch/pack legibility → (PM-S.3 if budget).
4. `npm run rig-shot --pose=idle --angles=front,3q` baseline shot, then iterate the garment with a screenshot each round.
