import { defineConfig, type PluginOption } from 'vite';

// AUTO-SHUTDOWN — a dev server reaps ITSELF once no browser is using it, so a long
// agent/rig session can't pile up orphaned Vite servers that slow the machine (the user's
// pain: things get slow after hours of dev). Each procedural-modeler agent + each rig-shot
// run spawns its own dev server; completed ones don't reliably clean up. This makes every
// dev server self-terminating instead of relying on a manual `npm run reap`.
//
// SAFE BY DESIGN: an in-USE server has a browser attached over the HMR websocket
// (server.ws.clients), so it is NEVER killed mid-run — a rig-shot/bench keeps its page
// connected the whole time. A server only exits once EVERY browser has been gone for
// IDLE_MS (it was used, then abandoned), or a server that no browser EVER connected to has
// sat unused for NEVER_MS. FAIL-SAFE: if the client count can't be read, it never exits.
// Opt out entirely with DUSTFALL_NO_AUTOSHUTDOWN=1 (e.g. to keep a server up with its tab closed).
function autoShutdownIdle(): PluginOption {
  const IDLE_MS = 8 * 60 * 1000;    // had browsers, all gone this long → exit
  const NEVER_MS = 20 * 60 * 1000;  // no browser EVER connected this long → exit (an unused server)
  const CHECK_MS = 20 * 1000;
  return {
    name: 'dustfall-auto-shutdown',
    apply: 'serve',
    configureServer(server) {
      if (process.env.DUSTFALL_NO_AUTOSHUTDOWN === '1') return;
      const startedAt = Date.now();
      let sawClient = false;
      let zeroSince: number | null = null;
      // HMR websocket client count = browsers actively using this dev server. Reading it
      //   defensively: any failure returns -1 → the tick is skipped (never risk a live server).
      const clientCount = (): number => {
        try {
          const c = (server.ws as unknown as { clients?: { size?: number } })?.clients;
          if (c && typeof c.size === 'number') return c.size;
        } catch { /* ignore */ }
        return -1;
      };
      const bye = (why: string): void => {
        try { server.config.logger.info(`\n[dustfall] auto-shutdown: ${why} — freeing this idle dev server.`); } catch { /* ignore */ }
        clearInterval(timer);
        Promise.resolve(server.close()).finally(() => process.exit(0));
      };
      const timer = setInterval(() => {
        const n = clientCount();
        if (n < 0) return;                                   // can't detect → fail safe
        if (n > 0) { sawClient = true; zeroSince = null; return; }
        if (sawClient) {                                     // was used, now empty
          if (zeroSince == null) zeroSince = Date.now();
          else if (Date.now() - zeroSince >= IDLE_MS) bye(`no browser for ${Math.round(IDLE_MS / 60000)}m`);
        } else if (Date.now() - startedAt >= NEVER_MS) {     // never used at all
          bye(`unused for ${Math.round(NEVER_MS / 60000)}m`);
        }
      }, CHECK_MS);
      if (timer.unref) timer.unref();
    },
  };
}

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
  // autoShutdownIdle: dev servers self-reap when idle (apply:'serve', so build/preview are untouched).
  //   The Cloudflare wrangler framework-setup also needs a real plugins array to inject into.
  plugins: [autoShutdownIdle()],
  optimizeDeps: {
    // Rapier ships WASM that breaks Vite's dep optimization. Exclude to avoid
    // a dev-server hang on first load.
    exclude: ['@dimforge/rapier3d-compat'],
  },
}));
