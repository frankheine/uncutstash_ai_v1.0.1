Audit: Inference Pipeline & Orchestrator — Parallel GPU/CPU Execution

### Architecture Verified

The pipeline is **correctly designed** — GPU inference and CPU-side tasks (embedding, reranking, retrieval) run on **separate Web Worker threads** with no resource contention.

### Isolation Analysis

| Worker | Thread | GPU Usage | Technology |
|--------|--------|-----------|------------|
| `inference.worker.ts` | Dedicated Worker | **WebGPU** | `@mlc-ai/web-llm` |
| `embedding.worker.ts` | Dedicated Worker | **None (CPU/WASM)** | Transformers.js (ONNX WASM backend) |
| `rerank.worker.ts` | Dedicated Worker | **None (CPU/WASM)** | Transformers.js (ONNX WASM backend) |
| `retrieval.worker.ts` | Dedicated Worker | **None (CPU)** | Orama vector DB |

Key findings:

1. **GPU context is fully isolated inside `inference.worker.ts`** — No other worker creates a WebGPU adapter. The `currentEngine` proxy in `pipeline.ts:213` communicates with the inference worker exclusively via async message passing (`postMessage`/`onmessage`).

2. **Embedding & reranking explicitly use CPU (WASM)**, not WebGPU. Per the comment at `rerank.worker.ts:16-17`:
   > *"We force WASM for Transformers.js because WebGPU inside Web Workers for ONNX models can silently hang on iOS Safari when competing with WebLLM."*

3. **All worker dispatch is non-blocking** — `runWorker()` in `pipeline.ts:300` returns a `Promise`; the main thread is never blocked. GPU inference proceeds asynchronously while the main thread remains responsive to UI events.

4. **The orchestrator (`orchestrator.ts`) runs sequentially by design** — `retrieve → generate → memorize` is the correct RAG dependency order. During `retrieveNode` (embed → search → rerank), the inference worker is simply **idle**, not "blocked". No GPU resource contention occurs.

### Minor Concerns Found

1. **`getNetworkPort()` dead message** — `orchestrator.ts:23` sends `{ type: 'INIT_PORT' }` to the inference worker, but `inference.worker.ts:174` drops all messages without a `uuid` field, so the transferred `MessagePort` is never used. The `network.worker.ts` exists but is never instantiated by this path. Not a GPU issue, but dead code.

2. **No parallelism within retrieval** — Embedding → search → reranking are strictly sequential. This is inherent to the RAG dataflow (can't search without an embedding), so it's correct.

3. **Pre-warming is sequential** — `preWarmReranker()` and `preWarmEmbedder()` in `pipeline.ts:245-258` are called independently but not in parallel. Could be `Promise.all`'d for faster boot, but negligible impact.

### Verdict

**The pipeline does not block the GPU.** All CPU-bound tasks (embedding, reranking, retrieval) run in their own Web Workers using CPU/WASM backends. The GPU inference worker is isolated and only receives messages during `generateNode`. No architectural changes are needed for parallelism.


—-------------------------------------


Full Pipeline Audit & Optimization Plan

### 🔴 Critical Bugs (Cause Inquiry Errors)

**1. Concurrent Initialization Race in Embedding & Rerank Workers**
`embedding.worker.ts:18-32` and `rerank.worker.ts:11-27` use `self.onmessage = async (event) => {...}`. Multiple messages can arrive during the `await pipeline(...)` call because JS's event loop is yielded. If message 1 starts loading the model and message 2 arrives before `extractor`/`reranker` is assigned, **both** will call `pipeline(...)` concurrently, causing double initialization and potential crashes.

**2. Missing 'flush' Action Handler in Retrieval Worker**
`SettingsModal.tsx:87` sends `runWorker('retrieve', { action: 'flush' })`. `retrieval.worker.ts` has no handler for `action === 'flush'`. The `Promise` in `runWorker` **never resolves or rejects** — the message listener stays attached forever (memory leak) and the Settings UI hangs.

**3. No Timeout on Any Worker Operation**
All `runWorker` calls (`orchestrator.ts:56,60,73,116,135,136`) are unbounded. If any worker hangs (Transformers.js stuck on download, Orama crash, etc.), the promise never settles, blocking the entire LangGraph state machine indefinitely.

**4. User System Prompt Ignored at Inference Time**
`SettingsModal` lets the user configure a system prompt (saved to `localforage` key `'sovereign_system_prompt'`), but `generateNode` (`orchestrator.ts:116`) only passes `prompt` and `context`. Meanwhile `runWorker`'s PATH A (`pipeline.ts:314`) uses a **hardcoded** system prompt: `"You are UNCUTstash AI..."`. The user's setting is silently dropped.

---

### 🟠 Slow Boot — Root Causes

**5. Cache API Monkey-Patch Silently Breaks Web-LLM Caching**
`pipeline.ts:18-25` and `inference.worker.ts:20-27` patch `Cache.prototype.add` to swallow ALL errors:
```typescript
Cache.prototype.add = async function(request) {
    try { await originalCacheAdd.call(this, request); } catch (e) { /* suppressed */ }
};
```
Web-LLM internally uses the Cache API to persist model shards. By silently catching every failure (including 302 redirects from HuggingFace CDN), the model is **never cached in the browser's Cache API**. Every page refresh forces a full ~2.5GB re-download, which is the primary cause of "model not persisting across refreshes" and "takes forever to boot."

**6. Service Worker & Inference Worker Use Incompatible OPFS Filenames**
- `sw.ts` (service worker) caches shards as: `_models_Dolphin3_0..._params_shard_0_bin_part0` (URL-sanitized + chunked)
- `inference.worker.ts` looks for shards as: `params_shard_0.bin` (raw filename)
- These naming conventions **don't match**. The inference worker's OPFS read always misses, falling back to network, even when the service worker has the data cached locally. This adds the overhead of a full HTTP round-trip through the service worker for every shard.

**7. No OPFS Cache Probe Before Bootstrap**
`bootstrapSpeculativePipeline()` (`pipeline.ts:111`) never checks whether the target model exists in OPFS before calling `CreateWebWorkerMLCEngine`. The SettingsModal has "boot strategy" UI buttons (`soft`/`opfs`/`full`), but the `onBootStrategy` callback is **never consumed** by the pipeline — there's no implementation to load from OPFS directly.

**8. Sequential Pre-Warming**
The embedder and reranker are pre-warmed in series (whatever order `App.tsx` calls `preWarmEmbedder()` and `preWarmReranker()`). These are independent and could run in parallel with `Promise.all`.

**9. GPU Probe Adds Unnecessary Latency**
`pipeline.ts:137-157` probes `navigator.gpu.requestAdapter()` from the main thread, which is noted to "return null even when WebGPU is fully operational" (line 130-131). This probe is non-functional but adds latency and a try/catch overhead.

---

### 🟡 Code Quality & Dead Code

**10. `getNetworkPort` Sends INIT_PORT Into a Black Hole**
`orchestrator.ts:23` sends `{ type: 'INIT_PORT' }` + transfers a `MessageChannel.port2` to whichever worker is returned by `getWorkers.getNetwork?.() || getWorkers.getInference()`. `getNetwork()` doesn't exist on `getWorkers`, so it always sends to the inference worker. But `inference.worker.ts:174` drops all messages without a `uuid` field. The port is never used.

**11. Missing CPU Fallback Wiring**
`cpu.fallback.worker.ts` exists with a full Wllama implementation, but `pipeline.ts`'s GPU error handler (`pipeline.ts:236-238`) just throws an error rather than falling back to the CPU worker. The `isUsingCpuFallback()` function is exported but never drives any decision.

**12. `navigator.storage.persist()` Result Unused**
`main.tsx:11` checks `navigator.storage.persist()` but logs regardless of whether it returned `true` or `false`.

---

## Proposed Fix Plan

| # | Fix | File(s) | Impact |
|---|-----|---------|--------|
| 1 | Guard worker init with a promise chain; queue messages during model load | `embedding.worker.ts`, `rerank.worker.ts` | ✅ Fixes crash on rapid inquiry |
| 2 | Add `action: 'flush'` handler to retrieval worker | `retrieval.worker.ts` | ✅ Fixes hung Promise |
| 3 | Add configurable timeout to `runWorker` | `pipeline.ts` | ✅ Prevents indefinite hangs |
| 4 | Read system prompt from `localforage` in `generateNode` | `orchestrator.ts` | ✅ User settings respected |
| 5 | Fix Cache API patch to properly handle 302s instead of blanket-swallow | `pipeline.ts`, `inference.worker.ts` | ✅ Enables cross-refresh caching |
| 6 | Align SW + inference worker OPFS filenames | `sw.ts`, `inference.worker.ts` | ✅ Eliminates redundant fetch |
| 7 | Probe OPFS before boot; skip network if cached | `pipeline.ts` | ✅ Faster subsequent boots |
| 8 | `Promise.all` pre-warming | Caller in `App.tsx` | ✅ Faster initial boot |
| 9 | Remove dead GPU probe | `pipeline.ts` | ✅ Minor boot speedup |
| 10 | Wire `getNetworkPort` to `network.worker.ts` properly | `orchestrator.ts` | ✅ Fixes dead code |
| 11 | Implement CPU fallback path or remove | `pipeline.ts` | ✅ Graceful degradation |
| 12 | Add `flush` branching to worker message handler | `pipeline.ts` | ✅ Clean error propagation

