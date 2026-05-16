import { defineConfig } from 'vite';

// Production builds target GitHub Pages at https://<user>.github.io/Dustfall/,
// so asset paths need to be prefixed with /Dustfall/. Dev server stays at
// the root so `npm run dev` keeps serving from localhost:5173/.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/Dustfall/' : '/',
  optimizeDeps: {
    // Rapier ships WASM that breaks Vite's dep optimization. Exclude to avoid
    // a dev-server hang on first load.
    exclude: ['@dimforge/rapier3d-compat'],
  },
}));
