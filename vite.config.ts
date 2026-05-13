import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    // Rapier ships WASM that breaks Vite's dep optimization. Exclude to avoid
    // a dev-server hang on first load.
    exclude: ['@dimforge/rapier3d-compat'],
  },
});
