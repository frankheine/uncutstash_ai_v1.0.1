// src/orchestrator.ts
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { getWorkers, runWorker, WorkerType } from "./rag/pipeline";
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

let networkChannel: MessageChannel | null = null;

export function getNetworkPort(): MessagePort {
    if (!networkChannel) {
        networkChannel = new MessageChannel();
        const networkWorker = (getWorkers as any).getNetwork();
        networkWorker.postMessage({ type: 'INIT_PORT' }, [networkChannel.port2]);
    }
    return networkChannel.port1;
}

function getLatestQuestion(fullQuery: string): string {
    const lines = fullQuery.split('\n');
    const lastLine = lines[lines.length - 1];
    return lastLine.replace(/^User:\s*/i, '').trim();
}

async function retrieveNode(state: typeof GraphState.State) {
    console.log("--- RETRIEVE NODE ---");
    const actualQuestion = getLatestQuestion(state.query);

    const notify = (msgOrLog: any) => {
        let text = typeof msgOrLog === 'string' ? msgOrLog : (msgOrLog?.log || msgOrLog?.message || "");
        if (activeProgressCallback && text) activeProgressCallback({ status: 'progress', log: text });
    };

    try {
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

// 2. UPDATE THE GENERATE NODE (The Real-Time RAM Flush)
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
            });

            return { answer: response.text };

        } catch (error: any) {
            // THIS IS THE CATCH BLOCK THAT WAS MISSING
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
    console.log("--- MEMORIZE NODE ---");
    try {
        const actualQuestion = getLatestQuestion(state.query);
        const memoryText = `User: ${actualQuestion}\nFrank: ${state.answer}`;

        const { embedding } = await runWorker<any>('embed', { text: memoryText });
        await runWorker<any>('retrieve', { action: 'insert', text: memoryText, embedding });

        console.log("--- MEMORY SAVED ---");
        return {};
    } catch (error) {
        console.error("Memorization Failed:", error);
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
    console.log("--- FALLBACK SEARCH NODE (CONTINUOUS INGESTION) ---");
    if (activeProgressCallback) activeProgressCallback({ status: 'progress', log: '🌐 Initiating deep network search...' });

    try {
        const actualQuestion = getLatestQuestion(state.query);

        // 1. Let the search run for up to 30 seconds
        const { results } = await runWorker<any>('network', {
            action: 'SEARCH',
            query: actualQuestion
        }, undefined, 30000);

        if (!results || results.length === 0) {
            if (activeProgressCallback) activeProgressCallback({ status: 'progress', log: '⚠️ No external data found.' });
            return { context: state.context, requiresFallback: false };
        }

        let immediateContext = "";

        // 2. THE USER'S PARALLEL FLUSH PROTOCOL
        // Cycle through the data, embed it, log it to the Vector DB, and clear it from RAM.
        // 2. THE USER'S PARALLEL FLUSH PROTOCOL
        for (let i = 0; i < results.length; i++) {
            const chunk = results[i];

            try {
                if (activeProgressCallback) activeProgressCallback({ status: 'progress', log: `🧠 Embedding & Storing chunk ${i + 1}/${results.length}...` });
                // Send to Embedding Worker
                const { embedding } = await runWorker<any>('embed', { text: chunk });
                // Flush to Vector DB
                await runWorker<any>('retrieve', { action: 'insert', text: chunk, embedding });
            } catch (embedErr) {
                // FIX: If embedding fails (e.g. missing tokenizer.json), log it but DO NOT crash.
                console.warn("Failed to embed chunk, skipping Vector DB insert...", embedErr);
            }

            // Always keep the top 2 chunks in hot RAM so the AI can answer the immediate question
            if (i < 2) {
                immediateContext += chunk + "\n\n";
            }
        }

        if (activeProgressCallback) activeProgressCallback({ status: 'progress', log: '✅ Search complete. Data flushed to Vector DB.' });

        return { context: `${state.context}\n\n[Live Web Data]:\n${immediateContext}`, requiresFallback: false };
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