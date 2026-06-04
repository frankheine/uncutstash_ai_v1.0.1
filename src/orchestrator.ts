import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { workers, runWorker } from "./rag/pipeline";

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

async function retrieveNode(state: typeof GraphState.State) {
    console.log("--- RETRIEVE NODE ---");

    // Routes a log string into the App.tsx streaming queue (polled every 50ms).
    // This is what makes retrieval stages visible to the user in real-time.
    const notify = (log: string) => {
        if (activeProgressCallback) activeProgressCallback({ status: 'progress', log });
    };

    try {
        // 1. Embed the query into a dense vector
        notify('🔮 Embedding query...');
        const { embedding } = await runWorker<any>(workers.embed, { text: state.query });

        // 2. Hybrid vector + BM25 search — pass notify so the worker's own
        //    progress log ("🔍 Searching vector index...") also surfaces in the UI
        const { candidates } = await runWorker<any>(
            workers.retrieve,
            { action: 'search', queryVector: embedding, queryText: state.query },
            notify   // ← onProgress: routes worker progress msgs to the UI queue
        );

        // 3. Empty index on first boot — no memories yet
        if (!candidates || candidates.length === 0) {
            notify('💡 No prior memory found — answering from training knowledge.');
            return { context: "No prior memory found." };
        }

        notify(`📄 ${candidates.length} memories found — reranking for relevance...`);

        // 4. Cross-encoder rerank — also passes notify so rerank stage logs appear
        const { reranked } = await runWorker<any>(
            workers.rerank,
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
        const response = await runWorker<{ text: string }>(workers.inference, {
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
        // 1. Format the interaction into a single memory block
        const memoryText = `User: ${state.query}\nFrank: ${state.answer}`;

        // 2. Generate a vector embedding for this specific memory
        const { embedding } = await runWorker<any>(workers.embed, { text: memoryText });

        // 3. Insert the memory silently into the Orama database
        await runWorker<any>(workers.retrieve, { action: 'insert', text: memoryText, embedding });

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