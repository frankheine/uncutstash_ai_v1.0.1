// src/orchestrator.ts
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { getWorkers, runWorker, WorkerType } from "./rag/pipeline";

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

let networkChannel: MessageChannel | null = null;

export function getNetworkPort(): MessagePort {
    if (!networkChannel) {
        networkChannel = new MessageChannel();
        const networkWorker = (getWorkers as any).getNetwork?.() || getWorkers.getInference();
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
            return { context: "No prior memory found." };
        }

        notify(`📄 ${candidates.length} memories found — reranking for relevance...`);

        const { reranked } = await runWorker<any>(
            'rerank',
            { query: state.query, candidates },
            notify
        );

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

const workflow = new StateGraph(GraphState)
    .addNode("retrieve", retrieveNode)
    .addNode("generate", generateNode)
    .addNode("memorize", memorizeNode)
    .addEdge(START, "retrieve")
    .addEdge("retrieve", "generate")
    .addEdge("generate", "memorize")
    .addEdge("memorize", END);

export const ragApp = workflow.compile();