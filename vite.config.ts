// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';

const crossOriginHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "cross-origin"
};

function getContentType(filePath: string): string {
  if (filePath.endsWith('.wasm')) return 'application/wasm';
  if (filePath.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

export default defineConfig({
  // ADD this inside defineConfig:
  build: {
    target: 'esnext', // Required for Top-Level Await and WebGPU
    assetsInlineLimit: 0, // Prevents base64 corruption of binary model fragments
    rollupOptions: {
      output: {
        manualChunks: {
          'mlc-vendor': ['@mlc-ai/web-llm'],
          'react-vendor': ['react', 'react-dom', 'framer-motion', 'gsap']
        }
      }
    }
  },
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
      '.free.pinggy.net',
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
    exclude: ['@mlc-ai/web-llm', '@wllama/wllama', '@huggingface/transformers', 'hiredis', 'libbloom'],
    include: ['@google/generative-ai']
  },
});
