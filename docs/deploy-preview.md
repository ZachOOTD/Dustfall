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

### Option B — Cloudflare Pages (dashboard-configured)
1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git →** pick **Dustfall**.
2. **Production branch = `campaign/escape-pod-intro`**. Build command **`npm run build`**, output dir **`dist`**.
3. Add env vars: **`VITE_ESCAPE_POD_INTRO = 1`** and **`VITE_BASE = /`** (Settings → Environment variables).
4. The playable link is `https://<project>.pages.dev/`; it rebuilds on every push to the branch.

## Per-cycle flow
The campaign already commits each cycle to `campaign/escape-pod-intro`. With the branch **pushed** (the campaign
loop now pushes it after each cycle once this is set up), each push triggers the host to rebuild the preview link —
so the latest descent/intro is always playable at the URL. The live master GitHub-Pages site is untouched.
