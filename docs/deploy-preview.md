# Campaign-branch preview deploy — a playable link to walk-test the escape-pod intro

The user (2026-06-29) asked for a **separate, pushed branch + a playable preview link** to walk-test the
in-progress work each cycle, without touching the live master site. This doc captures the setup.

## What's wired in the repo (committed on `campaign/escape-pod-intro`)
- `src/config/features.ts` — `escapePodIntro` reads the env var **`VITE_ESCAPE_POD_INTRO`** (`=== '1'` → ON).
  Source default stays OFF, so **master / the live game / dev mode are byte-unchanged**; only a build with that
  env var set serves the intro.
- `vite.config.ts` — `base` reads the env var **`VITE_BASE`**. The preview host serves at the domain root, so
  its build sets `VITE_BASE=/` (vs GitHub Pages' `/Dustfall/`).
- `netlify.toml` — turnkey Netlify build config (sets both env vars + `publish=dist`).

## Activate the preview (one-time, on your side — needs your host account)

### Option A — Netlify (turnkey via `netlify.toml`)
1. netlify.com → **Add new site → Import an existing project → GitHub →** pick the **Dustfall** repo.
2. Set **Branch to deploy = `campaign/escape-pod-intro`** (Site settings → Build & deploy → Branches).
3. Netlify reads `netlify.toml` (build `npm run build`, env `VITE_ESCAPE_POD_INTRO=1` + `VITE_BASE=/`). Deploy.
4. The playable link is the site's URL (e.g. `https://<name>.netlify.app/`); it rebuilds on every push to the branch.

### Option B — Cloudflare **Workers** (the "Create a Worker / Import a repository" flow)
Cloudflare now routes Git imports through Workers Builds (`npx wrangler deploy`). For a static Vite
site that needs `wrangler.jsonc` (committed — an assets-only worker serving `./dist` with SPA fallback).
1. Connect the **Dustfall** repo; set the **production branch = `campaign/escape-pod-intro`** (so
   `npx wrangler deploy` runs on it).
2. **Build command = `npm run build`**, **Deploy command = `npx wrangler deploy`** (defaults are fine —
   `wrangler.jsonc` tells it to upload `./dist`).
3. Add two **build variables**: **`VITE_ESCAPE_POD_INTRO` = `1`** and **`VITE_BASE` = `/`**.
4. Deploy. The link is `https://dustfall-preview.<account>.workers.dev/`; rebuilds on each push.
> Simpler alternative on Cloudflare: the classic **Pages** flow (Workers & Pages → Create → **Pages** tab
> → Connect to Git → build `npm run build`, output `dist`, same two env vars) needs NO `wrangler.jsonc`.
> Or just use **Netlify** (Option A) — it's the most turnkey (zero extra config).

## Per-cycle flow
The campaign already commits each cycle to `campaign/escape-pod-intro`. With the branch **pushed** (the campaign
loop now pushes it after each cycle once this is set up), each push triggers the host to rebuild the preview link —
so the latest descent/intro is always playable at the URL. The live master GitHub-Pages site is untouched.
