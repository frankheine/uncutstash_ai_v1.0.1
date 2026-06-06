import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'tw-shimmer'
import './index.css'
import App from './App.tsx'

// Request persistent storage on boot to prevent OS from purging the WebLLM Cache API / OPFS
async function ensurePersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`[STORAGE] Persistent storage granted: ${isPersisted}`);
  }
}

ensurePersistentStorage().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
});
