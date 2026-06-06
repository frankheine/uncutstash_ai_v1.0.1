import path from "path";
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import tsconfigPaths from 'vite-tsconfig-paths';

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
    tsconfigPaths(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts', // Location of your custom worker logic
      registerType: 'autoUpdate',
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5000000 // Pre-cache basic UI assets
      }
    })
  ],
  // Treat .wasm files as static URL assets so that new URL('...wasm', import.meta.url)
  // resolves to a correct hashed URL rather than Vite trying to bundle the binary.
  assetsInclude: ['**/*.wasm', '**/*.onnx'],
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
    // Exclude both engines to prevent Vite from disrupting
    // precompiled WebGPU shaders and WASM TVM bindings.
    exclude: ['@mlc-ai/web-llm', '@wllama/wllama', '@huggingface/transformers'],
  },
});