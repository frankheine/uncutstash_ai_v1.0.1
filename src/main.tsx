// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'tw-shimmer'
import './index.css'
import App from './App.tsx'

// TEMPORARY DEBUG — remove after diagnosis
const _origFetch = window.fetch;
window.fetch = async (...args) => {
  const res = await _origFetch(...args);
  const ct = res.headers.get('content-type') || '';
  const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
  if (ct.includes('html') && !url.endsWith('.html')) {
    console.error('🚨 [FETCH-DEBUG] Got HTML for non-HTML request:', url, '| status:', res.status);
  }
  return res;
};

// Request persistent storage on boot to prevent OS from purging the WebLLM Cache API / OPFS
async function ensurePersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`[STORAGE] Persistent Storage Permissions Granted`);
  }
}

ensurePersistentStorage().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
});
