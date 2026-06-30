import { defineConfig } from 'vite';

// Production builds target GitHub Pages at https://<user>.github.io/Dustfall/,
// so asset paths need to be prefixed with /Dustfall/. Dev server stays at
// the root so `npm run dev` keeps serving from localhost:5173/.
//
// PREVIEW-DEPLOY OVERRIDE (2026-06-29, user steering): the Cloudflare/Netlify campaign-branch
// preview serves at the ROOT of its own domain, not /Dustfall/, so its build sets VITE_BASE=/
// (alongside VITE_ESCAPE_POD_INTRO=1). With no env override, the master GitHub-Pages build is
// byte-unchanged (/Dustfall/ in prod, / in dev).
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE || (mode === 'production' ? '/Dustfall/' : '/'),
  // Empty by default (we add no Vite plugins). Present so Cloudflare Workers' `wrangler deploy`
  // framework-setup can find a plugins array to inject @cloudflare/vite-plugin into (it errors
  // "could not find a valid plugins array" otherwise). Harmless for the master/Netlify builds.
  plugins: [],
  optimizeDeps: {
    // Rapier ships WASM that breaks Vite's dep optimization. Exclude to avoid
    // a dev-server hang on first load.
    exclude: ['@dimforge/rapier3d-compat'],
  },
}));
