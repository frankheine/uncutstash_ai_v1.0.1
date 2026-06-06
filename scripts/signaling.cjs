// scripts/signaling.cjs
// Temporary Local WebSocket Signaling Server for WebRTC
// This server facilitates the initial exchange of encrypted WebRTC SDP offers/answers.
// All payloads passing through this server will be pre-encrypted locally by the Sovereign Core
// using the Web Crypto API, making this a Zero-Knowledge signaling pipeline.

const { WebSocketServer } = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocketServer({ server });

const peers = new Map();

wss.on('connection', (ws) => {
    // Generate a temporary peer ID for the session
    const peerId = Math.random().toString(36).substring(2, 10);
    peers.set(peerId, ws);
    
    console.log(`[Signaling] Peer Connected: ${peerId}`);
    ws.send(JSON.stringify({ type: 'REGISTERED', peerId }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            
            // Expected data format: { type: 'OFFER' | 'ANSWER' | 'ICE', targetId: string, payload: any }
            if (data.targetId && peers.has(data.targetId)) {
                console.log(`[Signaling] Routing ${data.type} from ${peerId} to ${data.targetId}`);
                peers.get(data.targetId).send(JSON.stringify({
                    type: data.type,
                    from: peerId,
                    payload: data.payload
                }));
            } else if (data.type === 'BROADCAST') {
                // Temporary utility to find other local peers for testing without manual ID entry
                for (const [id, peerWs] of peers.entries()) {
                    if (id !== peerId) {
                        peerWs.send(JSON.stringify({
                            type: 'DISCOVERY',
                            from: peerId
                        }));
                    }
                }
            }
        } catch (e) {
            console.error('[Signaling] Failed to parse message', e);
        }
    });

    ws.on('close', () => {
        peers.delete(peerId);
        console.log(`[Signaling] Peer Disconnected: ${peerId}`);
    });
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`[Zero-Knowledge Signaling] Server running on ws://localhost:${PORT}`);
    console.log(`[Security Note] This server blindly routes ciphertexts and SDPs. It possesses no decryption keys.`);
});
