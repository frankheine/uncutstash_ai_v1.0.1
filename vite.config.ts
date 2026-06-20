// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const crossOriginHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  // credentialless still enables SharedArrayBuffer but allows cross-origin
  // fetches to jsdelivr/huggingface CDNs that don't send CORP headers
  "Cross-Origin-Embedder-Policy": "credentialless",
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
  resolve: {
    tsconfigPaths: true
  },
  assetsInclude: ['**/*.wasm', '**/*.onnx', '**/*.gguf', '**/*.bin'],
  server: {
    port: 5173,
    strictPort: true,
    host: 'localhost',
    allowedHosts: [
      '.ngrok-free.dev',
      '.run.pinggy-free.link'
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
    // Native tsconfig paths handles workers now
  },
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm', '@wllama/wllama', '@huggingface/transformers'],
  },
});
