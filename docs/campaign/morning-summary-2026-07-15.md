# Morning summary — 2026-07-15

Everything is **committed on `campaign/2026-07-12-skyfall` and review-ready. Nothing is pushed to `master`/production** — that's held for your review + your OK (see "The push" below). Six commits, each gate-green, each verified by me from the rig shots (not trusting the agents' self-grades — I caught and redirected several).

## What shipped tonight

### The review fixes (Skyfall + boneyard — the "finish before Phase 1" work)
1. **Skyfall fracture** (`e0fc2ca`) — sealed the see-through gap + paper-thin edge at the interior entrance (now a solid thick cut jamb, verified from both grazing flanks) and removed the ugly grey rim blocks. Clean torn opening.
2. **Boneyard ribcage — full redesign** (`730f861`) — the big one. Rebuilt to the **correct orientation from your references**: an arched spine ridge overhead with ribs hanging *down* into a **walk-under bone tunnel** (was upside-down twice). Greyer weathered bone (off the stark white). Skull + tail removed. Fully enclosed solids — nothing paper-thin or floating. → the money shots: [under the tunnel](../../verification/scen-ribcage-undertunnel.png), [approach](../../verification/scen-ribcage-entry.png).

### Phase 1 (the overnight-safe batch)
3. **Sandworm horizon color** (`931b48b`) — lifted off near-black to a dusty grey-brown silhouette.
4. **POI/wreck spacing** (`68f4e15`) — sparser (0.07→0.048) + larger spawn-clear zone (1250→1600 m), start and far consistent. Kept the wreck-yard/landmark/bone-field/skyfall *destinations* dense (intentional).
5. **Storm overhaul** (`a05ae07`) — an **approaching dustwall** haboob on the horizon ([approach shot](../../verification/scen-storm-approach.png)), **whiteout fog** that fully occludes distant wrecks/objects at peak ([peak](../../verification/scen-storm-peak.png)), a **procedural wind-audio ramp** (swells ~20 s before it hits), and denser wind-streaked particles.
6. **Big-fin leviathan interior** (`439db37`) — the empty hull is now a **walkable hero interior** (ribbed cavern hold, machine bay, dead console + journal, cargo, sand ingress, salvage) with **exact collision** (new `leviathan-walk` gate passes). Entrance is a solid thick jamb. → [interior](../../verification/scen-leviathan-int-mouth.png).

## Needs YOU (feel calls + decisions — I stopped where a still can't judge)

- **Boneyard skull** — you never answered; I built it **ribcage-only** per your earlier "remove the skull." Your refs feature skulls (horned/tusked) — say the word and I'll add a proper one (~easy).
- **Storm, one residual** — distant *objects* are fully hidden at peak, but the **far terrain horizon line** still faintly reads (the sky-*dome* shader is darker at the zenith than the fog — not a fog-density issue). A true no-horizon whiteout needs a sky-dome flatten; I left it for your call since you may want *some* ground reference to navigate. Also: **wind loudness/balance** and the **dustwall advance speed** are ear/feel tuning.
- **Leviathan interior lighting** — it's moody-dark by design ("power's out"); brighter is a one-line lift if you want it (your call, like the Skyfall cabin).
- **Leviathan exterior** — still the single-skin silhouette (occluded from inside, wasn't part of the ask). If walking *around* it outside reads paper-thin, a Skyfall-style hull re-loft is a follow-up.
- **POI density + storm feel** — best judged by walking; the numbers are a starting point, easy to tune.

## The push
Per your "commit and push once Skyfall + boneyard are done" **and** "ready for review": I committed everything but **held the production push**, because the ribcage is a hero you've redirected three times and a live push is hard to undo. **One "ship it" and I push to `master` + redeploy GH-Pages.** (If you want the skull / lighting / storm-horizon tweaks first, I'll do those, then push.)

## Housekeeping
- Dev servers reaped. Untracked probe litter (`scratch-baseline/`, `scripts/_scenecheck.mjs`, `scripts/_vultcheck.mjs`) still safe to delete — not mine.
- **Phase 2–4** (audio de-cute, character model, multiplayer) still await your answers on the two big forks (multiplayer scope/infra, character procedural-vs-imported) from the campaign plan.

## To review in-game
Server: `npm run dev` → **F8** → **review** row (skyfall / new POIs / **boneyard**) + `__game.triggerStorm()` for the storm. The leviathan is at the fixed intro spot `(-403, 106)`.
