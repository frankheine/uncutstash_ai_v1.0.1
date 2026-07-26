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
      const response = await fetch("https://lite.duckduckgo.com/lite/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `q=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`Search failed: ${response.status}`);
      const html = await response.text();
      const snippets: string[] = [];
      const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g;
      const titleRegex = /<a[^>]*class="result-link"[^>]*>([\s\S]*?)<\/a>/g;
      const titles: string[] = [];
      let m;
      while ((m = titleRegex.exec(html)) !== null) {
        titles.push(m[1].replace(/<[^>]+>/g, "").trim());
      }
      let i = 0;
      while ((m = snippetRegex.exec(html)) !== null) {
        const snippet = m[1].replace(/<[^>]+>/g, "").trim();
        if (snippet) snippets.push(`${titles[i] || ""}: ${snippet}`);
        i++;
      }
      replyPort.postMessage({ taskId, status: "success", results: snippets.slice(0, 10) });
    } else {
      replyPort.postMessage({ taskId, status: "error", message: "Unknown action type" });
    }
  } catch (error: any) {
    replyPort.postMessage({ taskId, status: "error", message: error.message });
  }
});