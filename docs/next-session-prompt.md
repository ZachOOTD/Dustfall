# Campaign cycle-6 kickoff — `campaign/2026-06-18`

> `/session-end` (focused, per-cycle) rewrote this. The roadmap is authoritative (skill Step 4).

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` "Campaign 2026-06-18 — milestone ladder" · 5. `CLAUDE.md` + `docs/decisions.md` tail.

## Where we are
- ✓ **M1 COMPLETE** (C1-C4): deadcode+perf · sand-mounds · scrap-3q · dish-disc (feel-pending → Phase-A walk-test).
- **M2 in progress (1/4):** C5 shipped `feature-flags-infra` (NEW `src/config/features.ts`, inert, default-OFF).

## Cycle 6 picks up: **Phase A → M2 — next unit = `security-review-repo`**
`security-review-repo` (M · headless · medium) — audit the repo for vulnerabilities / leaked secrets.
**This is a CLIENT-SIDE browser game (Three.js, no backend/server/DB/auth)** — the attack surface is narrow,
so scope the audit accordingly:
1. **Leaked secrets** — grep the tree (incl. git-tracked files) for committed secrets: API keys, tokens,
   passwords, private keys, `.env` files, AWS/GCP creds, `Authorization:` headers. Expect NONE (procedural
   game, no external services) — confirm + document.
2. **Unsafe DOM** — confirm no `innerHTML` with concatenated strings (CLAUDE.md rule 6 — the pre-tool hook
   flags it), no `eval`/`Function(`, no `dangerouslySetInnerHTML`. The game builds DOM via createElement/textContent.
3. **Dependency vulns** — `npm audit` (note: dev-only/build deps for a static site are low-severity; report
   anything high/critical with a fix path).
4. **Repo hygiene** — `.gitignore` covers `node_modules`/`dist`/secrets; no committed build artifacts/credentials.
Write findings to `docs/backlog.md` (tagged `[debt]`/`[bug]`) + a one-paragraph summary in the changelog.
NO game-code change unless a real vuln needs a fix (then verify:all). Likely outcome: "clean, narrow surface,
0 secrets, npm-audit advisories noted" — a documented all-clear.

## Remaining M2 units (after security-review)
- `wreck-polish-bundle` (M · **visual-gate**) — §F/§G sev-2/3: non-axial mass (break the "sausage") ·
  up-close weathering chroma · engine-droop randomize + nozzle-detach · scout/corvette guaranteed trauma ·
  scale-anchor exclusion pocket. Rig-shot + critique REQUIRED; likely spans >1 cycle (ship `[partial]`).
- `yard-cross-poi-merge` (M · headless · **HIGH-RISK, DO LAST on its own cycle**) — the D237/D239 re-attempt;
  fold the yard sub-groups WITHOUT perturbing `panelDoorExtents` bottom-edge (regressed the bury-audit twice).
  Run `pruneBuriedPanels`/`validatePanels` before the cross-merge. **Fails audit twice → revert+requeue;
  3-strike → scope-cut GDD §12 + D-entry.**

After all 4 → M2 complete → M3. Phase A pauses ONLY at the `### Milestone: Phase A — Build-out complete` marker.

## Autonomy contract
- **`phash`-determinism (D221)** — re-run `verify:placement` + `verify:colliders` after any POI/panel/geometry
  change; rand-preserving approach for non-last `rand` draws (C2). **Rule 8** — visual work iterates
  (front-light + length-frame first). **COLLIDER-AUDIT (D235)** · **Save (D81)** additive-only, surface bumps.
- **Net-new content (M5a/M5b later)** needs a rig-shot framing authored for the visual gate.

## Stop conditions
3 fix-walls on one element (→ scope-cut GDD §12, D-entry) · a placement/collider regression you can't clear in
2 tries · a needed `SAVE_VERSION` bump (surface) · destructive-git attempt · per-cycle spend exhausted (ship `[partial]`).
