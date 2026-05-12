import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// WizardUX dev/build config.
// In dev, the Fastify server runs on 5174 and proxies / -> Vite (5175 for HMR).
// In prod, Vite emits to ./dist and Fastify serves it statically.
export default defineConfig({
  // wizard-ux is a standalone tool served by Fastify with SPA fallback routing.
  // Must use absolute base '/' so asset URLs resolve correctly on deep routes
  // like /step/3. (Code Apps in derived repos use './' for the Power Apps iframe.)
  base: '/',
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
    host: '127.0.0.1',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
});
