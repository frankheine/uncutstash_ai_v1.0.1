import path from "path";
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// COOP + COEP headers are required for SharedArrayBuffer (multi-threaded WASM)
// They must be present in BOTH dev and preview/production environments.
const crossOriginHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Treat .wasm files as static URL assets so that new URL('...wasm', import.meta.url)
  // resolves to a correct hashed URL rather than Vite trying to bundle the binary.
  assetsInclude: ['**/*.wasm'],
  server: {
    headers: crossOriginHeaders,
  },
  // Mirror headers into the preview server so `npm run preview` also
  // has SharedArrayBuffer available (required for wllama multi-threading).
  preview: {
    headers: crossOriginHeaders,
  },
  worker: {
    // ES module workers are required for import.meta.url to resolve correctly
    // inside the wllama WASM loader running inside the inference worker context.
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@wllama/wllama'],
  },
});