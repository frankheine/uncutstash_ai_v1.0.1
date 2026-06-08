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
        maximumFileSizeToCacheInBytes: 260000000
      }
    })
  ],
  assetsInclude: ['**/*.wasm', '**/*.onnx', '**/*.gguf', '**/*.bin'],
  server: {
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
  },
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm', '@wllama/wllama', '@huggingface/transformers'],
  },
});
