// src/workers/network.worker.ts
self.addEventListener("message", async (e: MessageEvent) => {
  const { action, query, taskId } = e.data;
  const replyPort = e.ports[0];

  if (!replyPort) return;

  try {
    if (action === "SEARCH") {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const response = await fetch("https://lite.duckduckgo.com/lite/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `q=${encodeURIComponent(query)}`,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`Search failed: ${response.status}`);

      // Parse the HTML (Since DDG Lite returns HTML, not JSON)
      const html = await response.text();

      // Basic Regex to extract the text snippets from DDG Lite HTML inside a Web Worker
      const snippetRegex = /<td class='result-snippet'>([\s\S]*?)<\/td>/g;
      let match;
      let found = false;

      // PHASE 1 FIX: True Streaming. Send chunks immediately, do not hold in an array.
      while ((match = snippetRegex.exec(html)) !== null) {
        const cleanText = match[1].replace(/<[^>]*>?/gm, '').trim();
        if (cleanText) {
          found = true;
          replyPort.postMessage({ taskId, status: 'chunk', data: cleanText });
        }
      }

      if (!found) {
        replyPort.postMessage({ taskId, status: 'chunk', data: "No external data found." });
      }

      replyPort.postMessage({ taskId, status: "success" });
      replyPort.close(); // FIX: Prevent half-open IPC memory leak
    } else {
      replyPort.postMessage({ taskId, status: "error", message: "Unknown action type" });
      replyPort.close(); // FIX: Prevent half-open IPC memory leak
    }
  } catch (error: any) {
    replyPort.postMessage({ taskId, status: "error", message: error.message });
    replyPort.close(); // FIX: Prevent half-open IPC memory leak
  }
});