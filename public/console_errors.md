CommsPanel.tsx:28 WebSocket connection to 'ws://localhost:8080/' failed:   
(anonymous) @ CommsPanel.tsx:28  
CommsPanel.tsx:44 \[CommsPanel\] Signaling WebSocket error (Server offline?) Event {isTrusted: true, type: 'error', target: WebSocket, currentTarget: WebSocket, eventPhase: 2, …}  
(anonymous) @ CommsPanel.tsx:44  
CommsPanel.tsx:48 \[CommsPanel\] Signaling WebSocket closed. Retrying in 5s...  
embedding.worker.ts:44 \[Embedding Worker Error\]: Error: no available backend found. ERR: \[wasm\] TypeError: Failed to fetch dynamically imported module: https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort-wasm-simd-threaded.asyncify.mjs  
    at Ta (http://localhost:5173/node\_modules/onnxruntime-web/dist/ort.webgpu.bundle.min.mjs?v=ece6158f:6:1826)  
    at async a.create (http://localhost:5173/node\_modules/onnxruntime-web/dist/ort.webgpu.bundle.min.mjs?v=ece6158f:6:19893)  
    at async createInferenceSession (http://localhost:5173/node\_modules/@huggingface/transformers/dist/transformers.web.js?v=ece6158f:7762:19)  
    at async http://localhost:5173/node\_modules/@huggingface/transformers/dist/transformers.web.js?v=ece6158f:18572:25  
    at async Promise.all (index 0\)  
    at async constructSessions (http://localhost:5173/node\_modules/@huggingface/transformers/dist/transformers.web.js?v=ece6158f:18562:5)  
    at async Promise.all (index 0\)  
    at async BertModel.from\_pretrained (http://localhost:5173/node\_modules/@huggingface/transformers/dist/transformers.web.js?v=ece6158f:20452:18)  
    at async AutoModel.from\_pretrained (http://localhost:5173/node\_modules/@huggingface/transformers/dist/transformers.web.js?v=ece6158f:27492:14)  
    at async Promise.all (index 2\)  
(anonymous) @ embedding.worker.ts:44  
orchestrator.ts:73 Retrieval Failed: Error: Worker error: no available backend found. ERR: \[wasm\] TypeError: Failed to fetch dynamically imported module: https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort-wasm-simd-threaded.asyncify.mjs  
    at Worker.handleResponse (pipeline.ts:277:28)  
retrieveNode @ orchestrator.ts:73  
orchestrator.ts:80 \--- GENERATE NODE \---  
CommsPanel.tsx:28 WebSocket connection to 'ws://localhost:8080/' failed:   
(anonymous) @ CommsPanel.tsx:28  
CommsPanel.tsx:44 \[CommsPanel\] Signaling WebSocket error (Server offline?) Event {isTrusted: true, type: 'error', target: WebSocket, currentTarget: WebSocket, eventPhase: 2, …}

—--------

CommsPanel.tsx:44 \[CommsPanel\] Signaling WebSocket error (Server offline?)   
Event {isTrusted: true, type: 'error', target: WebSocket, currentTarget: WebSocket, eventPhase: 2, …}  
CommsPanel.tsx:48 \[CommsPanel\] Signaling WebSocket closed. Retrying in 5s...  
embedding.worker.ts:44 \[Embedding Worker Error\]: Error: no available backend found. ERR: \[wasm\] TypeError: Failed to fetch dynamically imported module: https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort-wasm-simd-threaded.asyncify.mjs  
    at Ta (http://localhost:5173/node\_modules/onnxruntime-web/dist/ort.webgpu.bundle.min.mjs?v=ece6158f:6:1826)  
    at async a.create (http://localhost:5173/node\_modules/onnxruntime-web/dist/ort.webgpu.bundle.min.mjs?v=ece6158f:6:19893)  
    at async createInferenceSession (http://localhost:5173/node\_modules/@huggingface/transformers/dist/transformers.web.js?v=ece6158f:7762:19)  
    at async http://localhost:5173/node\_modules/@huggingface/transformers/dist/transformers.web.js?v=ece6158f:18572:25  
    at async Promise.all (index 0\)  
    at async constructSessions (http://localhost:5173/node\_modules/@huggingface/transformers/dist/transformers.web.js?v=ece6158f:18562:5)  
    at async Promise.all (index 0\)  
    at async BertModel.from\_pretrained (http://localhost:5173/node\_modules/@huggingface/transformers/dist/transformers.web.js?v=ece6158f:20452:18)  
    at async AutoModel.from\_pretrained (http://localhost:5173/node\_modules/@huggingface/transformers/dist/transformers.web.js?v=ece6158f:27492:14)  
    at async Promise.all (index 2\)  
orchestrator.ts:107 Memorization Failed: Error: Worker error: no available backend found. ERR: \[wasm\] TypeError: Failed to fetch dynamically imported module: https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort-wasm-simd-threaded.asyncify.mjs  
    at Worker.handleResponse (pipeline.ts:277:28)  
CommsPanel.tsx:28 WebSocket connection to 'ws://localhost:8080/' failed:   
CommsPanel.tsx:44 \[CommsPanel\] Signaling WebSocket error (Server offline?)   
Event {isTrusted: true, type: 'error', target: WebSocket, currentTarget: WebSocket, eventPhase: 2, …}

—--------

CommsPanel.tsx:48 \[CommsPanel\] Signaling WebSocket closed. Retrying in 5s...  
CommsPanel.tsx:28 WebSocket connection to 'ws://localhost:8080/' failed:   
(anonymous) @ CommsPanel.tsx:28  
embedding.worker.ts:44 \[Embedding Worker Error\]: Error: no available backend found. ERR: \[wasm\] TypeError: Failed to fetch dynamically imported module: https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort-wasm-simd-threaded.asyncify.mjs  
    at Ta (http://localhost:5173/node\_modules/onnxruntime-web/dist/ort.webgpu.bundle.min.mjs?v=ece6158f:6:1826)  
    at async a.create (http://localhost:5173/node\_modules/onnxruntime-web/dist/ort.webgpu.bundle.min.mjs?v=ece6158f:6:19893)  
    at async createInferenceSession (http://localhost:5173/node\_modules/@huggingface/transformers/dist/transformers.web.js?v=ece6158f:7762:19)  
    at async http://localhost:5173/node\_modules/@huggingface/transformers/dist/transformers.web.js?v=ece6158f:18572:25  
    at async Promise.all (index 0\)  
    at async constructSessions (http://localhost:5173/node\_modules/@huggingface/transformers/dist/transformers.web.js?v=ece6158f:18562:5)  
    at async Promise.all (index 0\)  
    at async BertModel.from\_pretrained (http://localhost:5173/node\_modules/@huggingface/transformers/dist/transformers.web.js?v=ece6158f:20452:18)  
    at async AutoModel.from\_pretrained (http://localhost:5173/node\_modules/@huggingface/transformers/dist/transformers.web.js?v=ece6158f:27492:14)  
    at async Promise.all (index 2\)  
(anonymous) @ embedding.worker.ts:44  
CommsPanel.tsx:44 \[CommsPanel\] Signaling WebSocket error (Server offline?) Event {isTrusted: true, type: 'error', target: WebSocket, currentTarget: WebSocket, eventPhase: 2, …}  
(anonymous) @ CommsPanel.tsx:44  
CommsPanel.tsx:48 \[CommsPanel\] Signaling WebSocket closed. Retrying in 5s...  
orchestrator.ts:73 Retrieval Failed: Error: Worker error: no available backend found. ERR: \[wasm\] TypeError: Failed to fetch dynamically imported module: https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort-wasm-simd-threaded.asyncify.mjs  
    at Worker.handleResponse (pipeline.ts:277:28)  
retrieveNode @ orchestrator.ts:73  
orchestrator.ts:80 \--- GENERATE NODE \---  
CommsPanel.tsx:28 WebSocket connection to 'ws://localhost:8080/' failed: 

d:   
(anonymous) @ CommsPanel.tsx:28  
CommsPanel.tsx:44 \[CommsPanel\] Signaling WebSocket error (Server offline?) Event {isTrusted: true, type: 'error', target: WebSocket, currentTarget: WebSocket, eventPhase: 2, …}

—---------

CommsPanel.tsx:48 \[CommsPanel\] Signaling WebSocket closed. Retrying in 5s...  
ID3D12Device::GetDeviceRemovedReason failed with DXGI\_ERROR\_DEVICE\_HUNG (0x887A0006)  
 \- While handling unexpected error type Internal when allowed errors are (Validation|DeviceLost).  
    at CheckHRESULTImpl (..\\..\\third\_party\\dawn\\src\\dawn\\native\\d3d\\D3DError.cpp:121)

Backend messages:  
 \* Device removed reason: DXGI\_ERROR\_DEVICE\_HUNG (0x887A0006)

(index):1 ID3D12Device::GetDeviceRemovedReason failed with DXGI\_ERROR\_DEVICE\_HUNG (0x887A0006)  
 \- While handling unexpected error type Internal when allowed errors are (Validation|DeviceLost).  
    at CheckHRESULTImpl (..\\..\\third\_party\\dawn\\src\\dawn\\native\\d3d\\D3DError.cpp:121)

Backend messages:  
 \* Device removed reason: DXGI\_ERROR\_DEVICE\_HUNG (0x887A0006)

inference.worker.ts:129 Device was lost. This can happen due to insufficient memory or other GPU constraints. Detailed error: \[object GPUDeviceLostInfo\]. Please try to reload WebLLM with a less resource-intensive model.  
(anonymous) @ index.js?v=ece6158f:12541  
Promise.then  
(anonymous) @ index.js?v=ece6158f:12539  
fulfilled @ index.js?v=ece6158f:3015  
Promise.then  
step @ index.js?v=ece6158f:3017  
fulfilled @ index.js?v=ece6158f:3015  
Promise.then  
step @ index.js?v=ece6158f:3017  
fulfilled @ index.js?v=ece6158f:3015  
Promise.then  
step @ index.js?v=ece6158f:3017  
fulfilled @ index.js?v=ece6158f:3015  
Promise.then  
step @ index.js?v=ece6158f:3017  
(anonymous) @ index.js?v=ece6158f:3018  
\_\_awaiter @ index.js?v=ece6158f:3014  
reloadInternal @ index.js?v=ece6158f:12449  
(anonymous) @ index.js?v=ece6158f:12433  
fulfilled @ index.js?v=ece6158f:3015  
Promise.then  
step @ index.js?v=ece6158f:3017  
(anonymous) @ index.js?v=ece6158f:3018  
\_\_awaiter @ index.js?v=ece6158f:3014  
reload @ index.js?v=ece6158f:12410  
(anonymous) @ index.js?v=ece6158f:13510  
(anonymous) @ index.js?v=ece6158f:3018  
\_\_awaiter @ index.js?v=ece6158f:3014  
(anonymous) @ index.js?v=ece6158f:13508  
(anonymous) @ index.js?v=ece6158f:13479  
(anonymous) @ index.js?v=ece6158f:3018  
\_\_awaiter @ index.js?v=ece6158f:3014  
handleTask @ index.js?v=ece6158f:13477  
onmessage @ index.js?v=ece6158f:13508  
(anonymous) @ inference.worker.ts:129  
CommsPanel.tsx:28 WebSocket connection to 'ws://localhost:8080/' failed:   
(anonymous) @ CommsPanel.tsx:28  
CommsPanel.tsx:44 \[CommsPanel\] Signaling WebSocket error (Server offline?) Event {isTrusted: true, type: 'error', target: WebSocket, currentTarget: WebSocket, eventPhase: 2, …}  
(anonymous) @ CommsPanel.tsx:44  
CommsPanel.tsx:48 \[CommsPanel\] Signaling WebSocket closed. Retrying in 5s...  
orchestrator.ts:91 Worker Execution Failed: Error: Error: Object has already been disposed  
    at runGeneration (pipeline.ts:242:61)  
generateNode @ orchestrator.ts:91  
await in generateNode  
(anonymous) @ @langchain\_langgraph.js?v=ece6158f:43727  
run @ @langchain\_langgraph.js?v=ece6158f:15412  
runWithConfig @ @langchain\_langgraph.js?v=ece6158f:15445  
invoke @ @langchain\_langgraph.js?v=ece6158f:43727  
invoke @ @langchain\_langgraph.js?v=ece6158f:26713  
await in invoke  
\_runWithRetry @ @langchain\_langgraph.js?v=ece6158f:46294  
\_executeTasksWithRetry @ @langchain\_langgraph.js?v=ece6158f:46465  
tick @ @langchain\_langgraph.js?v=ece6158f:46394  
\_runLoop @ @langchain\_langgraph.js?v=ece6158f:47822  
CommsPanel.tsx:28 WebSocket connection to 'ws://localhost:8080/' failed:   
(anonymous) @ CommsPanel.tsx:28

—--------

CommsPanel.tsx:28 WebSocket connection to 'ws://localhost:8080/' failed:   
(anonymous)	@	CommsPanel.tsx:28

CommsPanel.tsx:44 \[CommsPanel\] Signaling WebSocket error (Server offline?)   
Event {isTrusted: true, type: 'error', target: WebSocket, currentTarget: WebSocket, eventPhase: 2, …}  
CommsPanel.tsx:48 \[CommsPanel\] Signaling WebSocket closed. Retrying in 5s...  
ID3D12Device::GetDeviceRemovedReason failed with DXGI\_ERROR\_DEVICE\_HUNG (0x887A0006)  
 \- While handling unexpected error type Internal when allowed errors are (Validation|DeviceLost).  
    at CheckHRESULTImpl (..\\..\\third\_party\\dawn\\src\\dawn\\native\\d3d\\D3DError.cpp:121)

Backend messages:  
 \* Device removed reason: DXGI\_ERROR\_DEVICE\_HUNG (0x887A0006)  
(index):1 ID3D12Device::GetDeviceRemovedReason failed with DXGI\_ERROR\_DEVICE\_HUNG (0x887A0006)  
 \- While handling unexpected error type Internal when allowed errors are (Validation|DeviceLost).  
    at CheckHRESULTImpl (..\\..\\third\_party\\dawn\\src\\dawn\\native\\d3d\\D3DError.cpp:121)

Backend messages:  
 \* Device removed reason: DXGI\_ERROR\_DEVICE\_HUNG (0x887A0006)  
inference.worker.ts:129 Device was lost. This can happen due to insufficient memory or other GPU constraints. Detailed error: \[object GPUDeviceLostInfo\]. Please try to reload WebLLM with a less resource-intensive model.  
CommsPanel.tsx:28 WebSocket connection to 'ws://localhost:8080/' failed:   
CommsPanel.tsx:44 \[CommsPanel\] Signaling WebSocket error (Server offline?)   
Event {isTrusted: true, type: 'error', target: WebSocket, currentTarget: WebSocket, eventPhase: 2, …}  
CommsPanel.tsx:48 \[CommsPanel\] Signaling WebSocket closed. Retrying in 5s...  
orchestrator.ts:91 Worker Execution Failed: Error: Error: Object has already been disposed  
    at runGeneration (pipeline.ts:242:61)  
CommsPanel.tsx:28 WebSocket connection to 'ws://localhost:8080/' failed:   
CommsPanel.tsx:44 \[CommsPanel\] Signaling WebSocket error (Server offline?)   
Event {isTrusted: true, type: 'error', target: WebSocket, currentTarget: WebSocket, eventPhase: 2, …}

