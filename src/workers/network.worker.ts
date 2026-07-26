// src/workers/network.worker.ts
self.addEventListener("message", async (e: MessageEvent) => {
  const { action, query, taskId } = e.data;
  const replyPort = e.ports[0];

  if (!replyPort) {
    console.error("[Network Worker] No reply port provided.");
    return;
  }

  try {
    if (action === "SEARCH") {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      // 1. Target URL (No ?q= in the URL, because it goes in the POST body)
      const targetUrl = `https://lite.duckduckgo.com/lite/`;

      // 2. The CORS Proxy Wrapper
      const searchUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

      // 3. The CORRECTED fetch call (All options inside one object)
      const response = await fetch(searchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `q=${encodeURIComponent(query)}`,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`Search failed: ${response.status}`);

      // 4. Parse the HTML (Since DDG Lite returns HTML, not JSON)
      const html = await response.text();

      // Basic Regex to extract the text snippets from DDG Lite HTML inside a Web Worker
      const snippetRegex = /<td class='result-snippet'>([\s\S]*?)<\/td>/g;
      let match;
      let resultsArray: string[] = [];

      while ((match = snippetRegex.exec(html)) !== null && resultsArray.length < 5) {
        // Strip inner HTML tags to get clean text
        const cleanText = match[1].replace(/<[^>]*>?/gm, '').trim();
        if (cleanText) resultsArray.push(cleanText);
      }

      if (resultsArray.length === 0) {
        resultsArray.push("No external data found.");
      }

      replyPort.postMessage({ taskId, status: "success", results: resultsArray });
    } else {
      replyPort.postMessage({ taskId, status: "error", message: "Unknown action type" });
    }
  } catch (error: any) {
    replyPort.postMessage({ taskId, status: "error", message: error.message });
  }
});