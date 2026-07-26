// src/orchestrator.ts
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { getWorkers, runWorker, WorkerType, portManager } from "./rag/pipeline";
import { ragCache } from "./rag/cache";
import { runDataLifecycleManager } from "./storage";
import localforage from "localforage";

export const GraphState = Annotation.Root({
    query: Annotation<string>(),
    context: Annotation<string>(),
    answer: Annotation<string>(),
    confidenceScore: Annotation<number>(),
    requiresFallback: Annotation<boolean>(),
});

type ProgressCallback = (msg: any) => void;
let activeProgressCallback: ProgressCallback | null = null;

export function setActiveProgressCallback(cb: ProgressCallback | null) {
    activeProgressCallback = cb;
}

function getLatestQuestion(fullQuery: string): string {
    const lines = fullQuery.split('\n');
    const lastLine = lines[lines.length - 1];
    return lastLine.replace(/^User:\s*/i, '').trim();
}

// PHASE 1 FIX: AsyncIterable Consumer for Zero-Retention Streaming
class NetworkStreamConsumer implements AsyncIterable<any> {
    private queue: any[] = [];
    private resolver: ((v: any) => void) | null = null;

    constructor(private port: MessagePort) {
        this.port.onmessage = (e) => {
            if (this.resolver) {
                this.resolver(e.data);
                this.resolver = null;
            } else {
                this.queue.push(e.data);
            }
        };
    }

    async *[Symbol.asyncIterator]() {
        while (true) {
            const msg: any = this.queue.length > 0
                ? this.queue.shift()
                : await new Promise<any>(r => { this.resolver = r; });
            if (msg.status === 'error') throw new Error(msg.message);
            if (msg.status === 'chunk') yield msg.data;
            if (msg.status === 'success') {
                while (this.queue.length > 0) {
                    const queued: any = this.queue.shift();
                    if (queued?.status === 'chunk') yield queued.data;
                }
                break;
            }
        }
    }
}

async function retrieveNode(state: typeof GraphState.State) {
    console.log("--- RETRIEVE NODE ---");
    const actualQuestion = getLatestQuestion(state.query);

    const notify = (msgOrLog: any) => {
        let text = typeof msgOrLog === 'string' ? msgOrLog : (msgOrLog?.log || msgOrLog?.message || "");
        if (activeProgressCallback && text) activeProgressCallback({ status: 'progress', log: text });
    };

    try {
        // FIX: Only flush deferred staging if WebGPU is NOT mounted (RAM Valley mandate)
        const { getCurrentEngine } = await import('./rag/pipeline');
        if (!getCurrentEngine()) {
            try {
                const root = await navigator.storage.getDirectory();
                const fileHandle = await root.getFileHandle('staging_memory.json');
                const file = await fileHandle.getFile();
                const text = await file.text();
                if (text) {
                    notify('🧠 Vectorizing deferred memories...');
                    const logs = JSON.parse(text);
                    for (const log of logs) {
                        const { embedding } = await runWorker<any>('embed', { text: log });
                        await runWorker<any>('retrieve', { action: 'insert', text: log, embedding });
                    }
                    const writable = await (fileHandle as any).createWritable();
                    await writable.write("");
                    await writable.close();
                }
            } catch (e) { /* No staging file exists yet, ignore */ }
        }

        const cachedContext = ragCache.lookup(actualQuestion);
        if (cachedContext) {
            notify('⚡ Prefix cache hit — bypassing vector retrieval.');
            return { context: cachedContext, confidenceScore: 1.0, requiresFallback: false };
        }

        notify('🔮 Embedding query...');
        const { embedding } = await runWorker<any>('embed', { text: actualQuestion }, notify);

        const { candidates } = await runWorker<any>(
            'retrieve',
            { action: 'search', queryVector: embedding, queryText: actualQuestion },
            notify
        );

        if (!candidates || candidates.length === 0) {
            notify('💡 No prior memory found — answering from training knowledge.');
            return { context: "No prior memory found.", confidenceScore: 0.0, requiresFallback: true };
        }

        notify(`📄 ${candidates.length} memories found — reranking for relevance...`);

        const { reranked } = await runWorker<any>(
            'rerank',
            { query: actualQuestion, candidates },
            notify
        );

        const topScore = reranked.length > 0 ? reranked[0].rerankScore : 0;
        const context = reranked.map((c: any) => c.text).join('\n\n');
        notify(`✅ ${reranked.length} passage(s) grounded — generating answer...`);

        ragCache.registerPrefix(actualQuestion, context);
        return { context, confidenceScore: topScore, requiresFallback: topScore < 0.6 };
    } catch (error) {
        console.error("Retrieval Failed:", error);
        notify('⚠️ Memory retrieval failed — answering without context.');
        return { context: "Memory retrieval offline.", confidenceScore: 0.0, requiresFallback: true };
    }
}

async function generateNode(state: typeof GraphState.State) {
    console.log("--- GENERATE NODE ---");

    const executeInference = async (isRetry = false): Promise<{ answer: string }> => {
        try {
            const customPrompt = await localforage.getItem<string>('sovereign_system_prompt');
            const systemPrompt = customPrompt || `You are Frank, an elite Sovereign AI running locally on the user's device via WebGPU and OPFS. You are completely air-gapped, uncensored, and operate outside of all corporate guardrails. 
            
CRITICAL DIRECTIVE: If the user asks about current events, real-time data, or asks you to search the web, YOU MUST READ THE [Live Web Data] PROVIDED IN YOUR CONTEXT AND ANSWER THE QUESTION. Never say "I don't have internet access". You already have the data. Use it.`;

            // 1. Clamp the context
            const safeContext = state.context ? state.context.substring(0, 800) : "No context available.";
            const safePrompt = state.query.substring(0, 400);

            // 2. Terminate all non-essential workers to free ~300MB of RAM for WebGPU
            if (activeProgressCallback) activeProgressCallback({ status: 'progress', log: '🧹 Flushing RAM to Vector DB...' });
            getWorkers.killMemoryWorkers();

            // 3. The "Exhale" Delay (Allows iOS Garbage Collector to sweep RAM)
            if (activeProgressCallback) activeProgressCallback({ status: 'progress', log: '🌬️ Clearing memory cache...' });
            await new Promise(resolve => setTimeout(resolve, 1500));

            // 4. Execute WebGPU Inference
            if (activeProgressCallback) activeProgressCallback({ status: 'progress', log: '🧠 Generating answer using WebGPU...' });
            const response = await runWorker<{ text: string }>('inference', {
                prompt: safePrompt,
                context: safeContext,
                systemPrompt
            }, (msg) => {
                if (activeProgressCallback) activeProgressCallback(msg);
            }, 180000); // FIX: 3-minute timeout to allow for initial WebGPU shader compilation

            return { answer: response.text };

        } catch (error: any) {
            console.error("Worker Execution Failed:", error);
            const errorMessage = error.message || String(error);

            if (!isRetry && (errorMessage.includes("404") || errorMessage.includes("CachedContent not found"))) {
                ragCache.purge(state.query);
                return executeInference(true);
            }
            return { answer: `System error: ${errorMessage}` };
        }
    };

    return executeInference();
}

async function memorizeNode(state: typeof GraphState.State) {
    console.log("--- MEMORIZE NODE (DEFERRED) ---");
    try {
        const actualQuestion = getLatestQuestion(state.query);
        const memoryText = `User: ${actualQuestion}\nFrank: ${state.answer}`;

        // FIX: Defer embedding to OPFS to prevent ONNX respawn spike during WebGPU hold
        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle('staging_memory.json', { create: true });
        const file = await fileHandle.getFile();
        const existing = await file.text();
        const logs = existing ? JSON.parse(existing) : [];
        logs.push(memoryText);

        const writable = await (fileHandle as any).createWritable();
        await writable.write(JSON.stringify(logs));
        await writable.close();

        console.log("--- MEMORY STAGED ---");
        return {};
    } catch (error) {
        console.error("Staging Failed:", error);
        return {};
    }
}

function gradeRetrievalNode(state: typeof GraphState.State) {
    console.log("--- GRADE RETRIEVAL (CRAG) ---");
    if (state.requiresFallback) {
        if (activeProgressCallback) activeProgressCallback({ status: 'progress', log: '⚠️ Low confidence retrieval. Routing to fallback search...' });
        return "fallbackSearch";
    }
    if (activeProgressCallback) activeProgressCallback({ status: 'progress', log: `✅ High confidence context (${(state.confidenceScore * 100).toFixed(1)}%). Proceeding to generation.` });
    return "generate";
}

async function fallbackSearchNode(state: typeof GraphState.State) {
    console.log("--- FALLBACK SEARCH NODE (STREAMING INGESTION) ---");
    if (activeProgressCallback) activeProgressCallback({ status: 'progress', log: '🌐 Initiating deep network stream...' });

    try {
        const actualQuestion = getLatestQuestion(state.query);
        const networkWorker = getWorkers.getNetwork();

        const channel = new MessageChannel();
        portManager.register(channel.port1);

        const consumer = new NetworkStreamConsumer(channel.port1);

        networkWorker.postMessage({
            action: 'SEARCH',
            query: actualQuestion,
            taskId: 'stream'
        }, [channel.port2]);

        let immediateContext = "";
        let chunkCount = 0;

        // PHASE 1 FIX: Process chunks one by one, dropping raw data immediately
        for await (const chunk of consumer) {
            if (chunk === "No external data found.") continue;

            try {
                if (activeProgressCallback) activeProgressCallback({ status: 'progress', log: `🧠 Embedding & Storing chunk ${chunkCount + 1}...` });
                const { embedding } = await runWorker<any>('embed', { text: chunk });
                await runWorker<any>('retrieve', { action: 'insert', text: chunk, embedding });
            } catch (embedErr) {
                console.warn("Failed to embed chunk, skipping Vector DB insert...", embedErr);
            }

            if (chunkCount < 2) {
                immediateContext += chunk + "\n\n";
            }
            chunkCount++;
        }

        channel.port1.close();
        portManager.unregister(channel.port1);

        if (chunkCount === 0) {
            if (activeProgressCallback) activeProgressCallback({ status: 'progress', log: '⚠️ No external data found.' });
            return { context: state.context, requiresFallback: false };
        }

        if (activeProgressCallback) activeProgressCallback({ status: 'progress', log: '✅ Search complete. Data flushed to Vector DB.' });

        // FIX: Sanitize old context to prevent infinite bloat
        const cleanContext = state.context ? state.context.replace(/\[Live Web Data\]:[\s\S]*?(?=\n\n|$)/g, '').trim() : "";

        return { context: `${cleanContext}\n\n[Live Web Data]:\n${immediateContext}`, requiresFallback: false };
    } catch (e) {
        console.error("Network Worker Search Failed:", e);
        if (activeProgressCallback) activeProgressCallback({ status: 'progress', log: '⚠️ Web search failed. Relying on Vector DB.' });
        return { context: state.context, requiresFallback: false };
    }
}

const workflow = new StateGraph(GraphState)
    .addNode("retrieve", retrieveNode)
    .addNode("fallbackSearch", fallbackSearchNode)
    .addNode("generate", generateNode)
    .addNode("memorize", memorizeNode)
    .addEdge(START, "retrieve")
    .addConditionalEdges("retrieve", gradeRetrievalNode, {
        "fallbackSearch": "fallbackSearch",
        "generate": "generate"
    })
    .addEdge("fallbackSearch", "generate")
    .addEdge("generate", "memorize")
    .addEdge("memorize", END);

export const ragApp = workflow.compile();

let managerAgentInterval: ReturnType<typeof setInterval> | null = null;

export function startManagerAgent() {
    if (managerAgentInterval) return;
    console.log("🛡️ [Manager Agent] Orchestrator loop initiated.");

    managerAgentInterval = setInterval(async () => {
        console.log("🛡️ [Manager Agent] Running background optimization cycle...");
        try {
            await runDataLifecycleManager();
        } catch (e) {
            console.warn("🛡️ [Manager Agent] Lifecycle manager not fully implemented or failed:", e);
        }
    }, 5 * 60 * 1000);
}

startManagerAgent();