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
  // FIX: Added the alias resolver back so Vite knows what "@/" means!
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'esnext',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@mlc-ai/web-llm')) return 'mlc-vendor';
          if (id.includes('react') || id.includes('framer-motion') || id.includes('gsap')) return 'react-vendor';
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
        maximumFileSizeToCacheInBytes: 260000000
      }
    })
  ],
  assetsInclude: ['**/*.wasm', '**/*.json', '**/*.onnx', '**/*.gguf', '**/*.bin', '**/param_shard_*.bin'],

  server: {
    port: 5173,
    strictPort: true,
    host: 'localhost',
    allowedHosts: [
      '.ngrok-free.dev',
      '.free.pinggy.net',
      '.run.pinggy-free.link'
    ],
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
    watch: {
      ignored: [
        '**/public/models/**',
        '**/public/wasm/**',
        '**/.playwright_cache/**'
      ]
    }
  },

  preview: {
    headers: crossOriginHeaders
  },

  worker: {
    format: 'es'
  },

  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm', '@wllama/wllama', '@huggingface/transformers', 'hiredis', 'libbloom'],
    include: ['@google/generative-ai']
  }
});