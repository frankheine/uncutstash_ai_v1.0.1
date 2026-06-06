// network.worker.ts
// The Zero-Knowledge Data Bridge
// This isolated worker handles ALL external networking (Brave Search API, WebRTC signaling)
// The Sovereign Core has NO direct network access. All data passing here MUST be encrypted or explicitly whitelisted.

let securePort: MessagePort | null = null;

self.addEventListener("message", async (e: MessageEvent) => {
  const { type, payload, id } = e.data;

  try {
    switch (type) {
      case "INIT_PORT":
        securePort = e.ports[0];
        securePort.onmessage = handleSecureMessage;
        console.log("[Network Worker] Zero-Knowledge Bridge Secured.");
        break;

      case "BRAVE_SEARCH_INTENT":
        // The core sends a search intent. We fetch the raw data and return it to be sanitized.
        const response = await handleBraveSearch(payload.query, payload.apiKey);
        self.postMessage({ id, status: "success", data: response });
        break;

      case "WEBRTC_SIGNAL_OFFER":
      case "WEBRTC_SIGNAL_ANSWER":
        // In the future: Talk to local WebSocket signaling server to exchange encrypted SDPs
        // For now, we simulate success
        self.postMessage({ id, status: "success", log: "Signaling payload broadcasted blindly." });
        break;

      case "WEBRTC_TRANSMIT_CIPHERTEXT":
        // The Sovereign Core has encrypted a message. We blindly push it to the RTCPeerConnection.
        // We do NOT have the keys to read this data.
        transmitOverWebRTC(payload.ciphertext);
        self.postMessage({ id, status: "success" });
        break;

      default:
        console.warn("[Network Worker] Unknown action type:", type);
        self.postMessage({ id, status: "error", error: "Unknown action type" });
    }
  } catch (error: any) {
    self.postMessage({ id, status: "error", error: error.message });
  }
});

async function handleBraveSearch(query: string, apiKey: string) {
  if (!apiKey) throw new Error("Brave Search API Key missing in Network Worker");
  
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`, {
    headers: {
      "Accept": "application/json",
      "X-Subscription-Token": apiKey
    }
  });

  if (!res.ok) {
    throw new Error(`Brave Search failed with status: ${res.status}`);
  }

  const data = await res.json();
  // Return the raw JSON. The Sovereign Core is responsible for rigorous sanitization.
  return data;
}

// WebRTC logic will be instantiated here in the future
let peerConnection: RTCPeerConnection | null = null;
let dataChannel: RTCDataChannel | null = null;

function transmitOverWebRTC(ciphertext: ArrayBuffer) {
  if (dataChannel && dataChannel.readyState === "open") {
    dataChannel.send(ciphertext);
  } else {
    throw new Error("WebRTC DataChannel is not open");
  }
}

// Handler for the secure MessageChannel
async function handleSecureMessage(e: MessageEvent) {
  const { action, payload } = e.data;
  
  if (action === 'CIPHERTEXT_OUTBOUND') {
     // Forward the opaque ArrayBuffer directly to WebRTC
     transmitOverWebRTC(payload);
  } else {
     console.warn("[Network Worker] Unknown secure action:", action);
  }
}