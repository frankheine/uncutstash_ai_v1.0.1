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

async function retrieveNode(state: typeof GraphState.State) {
    console.log("--- RETRIEVE NODE ---");

    const notify = (msgOrLog: any) => {
        let text = "";
        if (typeof msgOrLog === 'string') {
            text = msgOrLog;
        } else if (msgOrLog && typeof msgOrLog === 'object') {
            text = msgOrLog.log || msgOrLog.message || "";
        }

        if (activeProgressCallback && text) {
            activeProgressCallback({ status: 'progress', log: text });
        }
    };

    try {
        // Step 4: RAG Prefix Matcher fast-path lookup
        const cachedContext = ragCache.lookup(state.query);
        if (cachedContext) {
            notify('⚡ Prefix cache hit — bypassing vector retrieval.');
            return { context: cachedContext, confidenceScore: 1.0, requiresFallback: false };
        }

        // FIX: Explicitly pass matching type strings matching the 'WorkerType' layout schema
        notify('🔮 Embedding query...');
        const { embedding } = await runWorker<any>('embed', { text: state.query }, notify);

        const { candidates } = await runWorker<any>(
            'retrieve',
            { action: 'search', queryVector: embedding, queryText: state.query },
            notify
        );

        if (!candidates || candidates.length === 0) {
            notify('💡 No prior memory found — answering from training knowledge.');
            return { context: "No prior memory found.", confidenceScore: 0.0, requiresFallback: true };
        }

        notify(`📄 ${candidates.length} memories found — reranking for relevance...`);

        const { reranked } = await runWorker<any>(
            'rerank',
            { query: state.query, candidates },
            notify
        );

        const topScore = reranked.length > 0 ? reranked[0].rerankScore : 0;
        const context = reranked.map((c: any) => c.text).join('\n\n');
        notify(`✅ ${reranked.length} passage(s) grounded — generating answer...`);

        // Cache the retrieved context for future prefix matches
        ragCache.registerPrefix(state.query, context);
        return { context, confidenceScore: topScore, requiresFallback: topScore < 0.6 };
    } catch (error) {
        console.error("Retrieval Failed:", error);
        notify('⚠️ Memory retrieval failed — answering without context.');
        return { context: "Memory retrieval offline.", confidenceScore: 0.0, requiresFallback: true };
    }
}

async function generateNode(state: typeof GraphState.State) {
    console.log("--- GENERATE NODE ---");

    // Internal generation function to allow for Gemini 404 Retry Loop
    const executeInference = async (isRetry = false): Promise<{ answer: string }> => {
        try {
            const customPrompt = await localforage.getItem<string>('sovereign_system_prompt');
            const systemPrompt = customPrompt || "You are 'Frank', the private sovereign intelligence engine under the branding 'UNCUTstash AI'.";

            const response = await runWorker<{ text: string }>('inference', {
                prompt: state.query,
                context: state.context ?? "No context available.",
                systemPrompt
            }, (msg) => {
                if (activeProgressCallback) activeProgressCallback(msg);
            });

            return { answer: response.text };
        } catch (error: any) {
            console.error("Worker Execution Failed:", error);
            const errorMessage = error.message || String(error);

            // Step 5: Gemini 404 Cache Expiration Pattern Recovery
            if (!isRetry && (errorMessage.includes("404") || errorMessage.includes("CachedContent not found"))) {
                console.warn("[Orchestrator] Gemini 404 cache expired. Purging Bloom Filter and retrying...");
                if (activeProgressCallback) {
                    activeProgressCallback({ status: 'progress', log: '♻️ Context expired. Re-uploading to model...' });
                }
                ragCache.purge(state.query);
                // In a production Gemini app we would re-run retrieveNode, but here we just retry inference
                // without the cached ID (which the worker handles if it was calling Gemini).
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
        const memoryText = `User: ${state.query}\nFrank: ${state.answer}`;

        const { embedding } = await runWorker<any>('embed', { text: memoryText });
        await runWorker<any>('retrieve', { action: 'insert', text: memoryText, embedding });

        console.log("--- MEMORY SAVED ---");
        return {};
    } catch (error) {
        console.error("Memorization Failed:", error);
        return {};
    }
}

// --- NODE: CORRECTIVE RAG (CRAG) ROUTING ---
function gradeRetrievalNode(state: typeof GraphState.State) {
    console.log("--- GRADE RETRIEVAL (CRAG) ---");
    if (state.requiresFallback) {
        if (activeProgressCallback) activeProgressCallback({ status: 'progress', log: '⚠️ Low confidence retrieval. Routing to fallback search...' });
        return "fallbackSearch";
    }
    if (activeProgressCallback) activeProgressCallback({ status: 'progress', log: `✅ High confidence context (${(state.confidenceScore * 100).toFixed(1)}%). Proceeding to generation.` });
    return "generate";
}

// --- NODE: FALLBACK SEARCH ---
async function fallbackSearchNode(state: typeof GraphState.State) {
    console.log("--- FALLBACK SEARCH NODE ---");
    if (activeProgressCallback) activeProgressCallback({ status: 'progress', log: '🌐 Querying external network bridge for missing context...' });
    try {
        // In a full implementation, this posts to network.worker.ts to hit Brave Search / Supabase
        const fallbackContext = "External search simulated. No additional data found.";
        return { context: `${state.context}\n\n[External Data]: ${fallbackContext}`, requiresFallback: false };
    } catch (e) {
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

// ============================================================================
// AUTONOMOUS AGENTIC ORCHESTRATION (MANAGER AGENT)
// ============================================================================
let managerAgentInterval: ReturnType<typeof setInterval> | null = null;

export function startManagerAgent() {
    if (managerAgentInterval) return;
    console.log("🛡️ [Manager Agent] Orchestrator loop initiated.");

    managerAgentInterval = setInterval(async () => {
        console.log("🛡️ [Manager Agent] Running background optimization cycle...");

        // 1. Run LRU Decay & Migration
        try {
            await runDataLifecycleManager();
        } catch (e) {
            console.warn("🛡️ [Manager Agent] Lifecycle manager not fully implemented or failed:", e);
        }

        // 2. Monitor Storage Thresholds & Spawn Specialists
        // (In a full implementation, this queries Orama for cluster density)
        const clusterDensityHigh = false;
        if (clusterDensityHigh) {
            console.log("🛡️ [Manager Agent] High density detected. Spawning Specialist Agent for summarization...");
            // Spawn a temporary LangGraph chain to summarize the cluster, then retire it.
        }

    }, 5 * 60 * 1000); // Run every 5 minutes
}

// Start the manager agent on boot
startManagerAgent()