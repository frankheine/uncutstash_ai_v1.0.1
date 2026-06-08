import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
// FIX: Import getWorkers getter utility and the updated string-signature runWorker function
import { getWorkers, runWorker } from "./rag/pipeline";

export const GraphState = Annotation.Root({
    query: Annotation<string>(),
    context: Annotation<string>(),
    answer: Annotation<string>(),
});

type ProgressCallback = (msg: any) => void;
let activeProgressCallback: ProgressCallback | null = null;

export function setActiveProgressCallback(cb: ProgressCallback | null) {
    activeProgressCallback = cb;
}

// ── Zero-Knowledge Network Bridge ───────────────────────────────────────
let networkChannel: MessageChannel | null = null;

export function getNetworkPort(): MessagePort {
    if (!networkChannel) {
        networkChannel = new MessageChannel();
        // Pass port2 to the network worker via the dynamic lazy-loader method
        const networkWorker = (getWorkers as any).getNetwork?.() || (getWorkers as any).getInference();
        networkWorker.postMessage({ type: 'INIT_PORT' }, [networkChannel.port2]);
    }
    return networkChannel.port1;
}

// src/orchestrator.ts (Continued)

async function retrieveNode(state: typeof GraphState.State) {
    console.log("--- RETRIEVE NODE ---");

    // Routes a log string into the App.tsx streaming queue (polled every 50ms).
    // This makes retrieval stages visible to the user in real-time.
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
        // 1. Embed the query into a dense vector - Route via string descriptor
        notify('🔮 Embedding query...');
        const { embedding } = await runWorker<any>('embed', { text: state.query }, notify);

        // 2. Hybrid vector + BM25 search — Pass strict routing layout key
        const { candidates } = await runWorker<any>(
            'retrieve',
            { action: 'search', queryVector: embedding, queryText: state.query },
            notify   // ← onProgress: routes worker progress msgs to the UI queue
        );

        // 3. Empty index on first boot — no memories yet
        if (!candidates || candidates.length === 0) {
            notify('💡 No prior memory found — answering from training knowledge.');
            return { context: "No prior memory found." };
        }

        notify(`📄 ${candidates.length} memories found — reranking for relevance...`);

        // 4. Cross-encoder rerank — Pass strict routing layout key
        const { reranked } = await runWorker<any>(
            'rerank',
            { query: state.query, candidates },
            notify   // ← onProgress: routes "🧠 Cross-encoder reranking..." to UI
        );

        // 5. Format top passages into a grounded context block for the LLM
        const context = reranked.map((c: any) => c.text).join('\n\n');
        notify(`✅ ${reranked.length} passage(s) grounded — generating answer...`);
        return { context };
    } catch (error) {
        console.error("Retrieval Failed:", error);
        notify('⚠️ Memory retrieval failed — answering without context.');
        return { context: "Memory retrieval offline." };
    }
}

async function generateNode(state: typeof GraphState.State) {
    console.log("--- GENERATE NODE ---");
    try {
        // Route generation using the strict 'inference' execution string tag signature
        const response = await runWorker<{ text: string }>('inference', {
            prompt: state.query,
            context: state.context ?? "No context available.",
        }, (msg) => {
            if (activeProgressCallback) activeProgressCallback(msg);
        });

        return { answer: response.text };
    } catch (error) {
        console.error("Worker Execution Failed:", error);
        throw error;
    }
}

async function memorizeNode(state: typeof GraphState.State) {
    console.log("--- MEMORIZE NODE ---");
    try {
        // FIX: Changed variable name to use proper camelCase 'memoryText'
        const memoryText = `User: ${state.query}\nFrank: ${state.answer}`;

        // 2. Generate a vector embedding for this specific memory block string
        const { embedding } = await runWorker<any>('embed', { text: memoryText });

        // 3. Insert the memory silently into the local vector storage engine
        await runWorker<any>('retrieve', { action: 'insert', text: memoryText, embedding });

        console.log("--- MEMORY SAVED ---");
        return {};
    } catch (error) {
        console.error("Memorization Failed:", error);
        return {};
    }
}

// Assemble the Graph using the Continuous Semantic Memory topology
const workflow = new StateGraph(GraphState)
    .addNode("retrieve", retrieveNode)
    .addNode("generate", generateNode)
    .addNode("memorize", memorizeNode)
    .addEdge(START, "retrieve")
    .addEdge("retrieve", "generate")
    .addEdge("generate", "memorize")
    .addEdge("memorize", END);

export const ragApp = workflow.compile();