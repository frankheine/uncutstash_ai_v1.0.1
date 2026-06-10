// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import tsconfigPaths from 'vite-tsconfig-paths';

const crossOriginHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        maximumFileSizeToCacheInBytes: 260000000 // Safely handles mid-sized model binaries
      }
    })
  ],
  assetsInclude: ['**/*.wasm', '**/*.onnx', '**/*.gguf', '**/*.bin'],
  server: {
    allowedHosts: [
      '.ngrok-free.dev',
      '.uncutstash.loca.lt'
    ], // FIX: Trust ngrok tunnel traffic
    headers: crossOriginHeaders,
    watch: {
      // CRITICAL FIX: Prevent Chokidar from indexing massive AI binaries
      ignored: [
        '**/public/models/**',
        '**/public/wasm/**',
        '**/.playwright_cache/**'
      ]
    }
  },
  preview: {
    headers: crossOriginHeaders,
  },
  worker: {
    format: 'es',
    // FIX: Inject path alias mapping inside the independent web worker compilation cycle
    plugins: () => [
      tsconfigPaths()
    ]
  },
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm', '@wllama/wllama', '@huggingface/transformers'],
  },
});