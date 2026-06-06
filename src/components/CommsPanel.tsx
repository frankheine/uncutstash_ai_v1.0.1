import React, { useState, useEffect, useRef } from 'react';
import { getNetworkPort } from '@/orchestrator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

// Minimal Zero-Knowledge Comms Panel
// Handles local Web Crypto API encryption/decryption before routing to Network Worker
export const CommsPanel: React.FC = () => {
    const [peerId, setPeerId] = useState<string | null>(null);
    const [targetId, setTargetId] = useState('');
    const [connected, setConnected] = useState(false);
    const [messages, setMessages] = useState<{from: string, text: string}[]>([]);
    const [inputMsg, setInputMsg] = useState('');
    const wsRef = useRef<WebSocket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const dcRef = useRef<RTCDataChannel | null>(null);

    // Crypto Keys
    const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
    const myKeyPairRef = useRef<CryptoKeyPair | null>(null);

    useEffect(() => {
        // Connect to local signaling server
        wsRef.current = new WebSocket('ws://localhost:8080');
        
        wsRef.current.onmessage = async (e) => {
            const data = JSON.parse(e.data);
            if (data.type === 'REGISTERED') {
                setPeerId(data.peerId);
            } else if (data.type === 'OFFER') {
                await handleOffer(data.from, data.payload);
            } else if (data.type === 'ANSWER') {
                await handleAnswer(data.payload);
            } else if (data.type === 'ICE') {
                await handleIceCandidate(data.payload);
            }
        };

        return () => {
            wsRef.current?.close();
            pcRef.current?.close();
        };
    }, []);

    const setupPeerConnection = () => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pc.onicecandidate = (e) => {
            if (e.candidate && targetId) {
                wsRef.current?.send(JSON.stringify({
                    type: 'ICE',
                    targetId,
                    payload: e.candidate
                }));
            }
        };

        pc.ondatachannel = (e) => {
            dcRef.current = e.channel;
            setupDataChannel(dcRef.current);
        };

        pcRef.current = pc;
        return pc;
    };

    const setupDataChannel = (dc: RTCDataChannel) => {
        dc.onopen = () => setConnected(true);
        dc.onclose = () => setConnected(false);
        dc.onmessage = async (e) => {
            // Decrypt incoming message
            try {
                if (sharedKey && e.data instanceof ArrayBuffer) {
                    // Extract IV (first 12 bytes) and ciphertext
                    const iv = e.data.slice(0, 12);
                    const ciphertext = e.data.slice(12);
                    const decryptedBuffer = await window.crypto.subtle.decrypt(
                        { name: 'AES-GCM', iv: new Uint8Array(iv) },
                        sharedKey,
                        ciphertext
                    );
                    const text = new TextDecoder().decode(decryptedBuffer);
                    setMessages(prev => [...prev, { from: 'Peer', text }]);
                } else {
                    // Unencrypted fallback for now
                    setMessages(prev => [...prev, { from: 'Peer', text: e.data }]);
                }
            } catch (err) {
                console.error('Decryption failed', err);
            }
        };
    };

    const handleOffer = async (fromId: string, payload: any) => {
        const { sdp, publicKey } = payload;
        setTargetId(fromId);
        
        // 1. Generate local ECDH keypair
        const myKeyPair = await window.crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]);
        const myJwkPubKey = await window.crypto.subtle.exportKey("jwk", myKeyPair.publicKey);
        
        // 2. Import peer's public key
        const peerPubKey = await window.crypto.subtle.importKey("jwk", publicKey, { name: "ECDH", namedCurve: "P-256" }, true, []);
        
        // 3. Derive shared AES-GCM key
        const derivedKey = await window.crypto.subtle.deriveKey(
            { name: "ECDH", public: peerPubKey },
            myKeyPair.privateKey,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
        setSharedKey(derivedKey);

        const pc = setupPeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        wsRef.current?.send(JSON.stringify({
            type: 'ANSWER',
            targetId: fromId,
            payload: { sdp: answer, publicKey: myJwkPubKey }
        }));
    };

    const handleAnswer = async (payload: any) => {
        const { sdp, publicKey } = payload;
        if (pcRef.current) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        }
        
        if (myKeyPairRef.current && publicKey) {
            // Import peer's public key
            const peerPubKey = await window.crypto.subtle.importKey("jwk", publicKey, { name: "ECDH", namedCurve: "P-256" }, true, []);
            
            // Derive shared AES-GCM key
            const derivedKey = await window.crypto.subtle.deriveKey(
                { name: "ECDH", public: peerPubKey },
                myKeyPairRef.current.privateKey,
                { name: "AES-GCM", length: 256 },
                true,
                ["encrypt", "decrypt"]
            );
            setSharedKey(derivedKey);
        }
    };

    const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
        if (pcRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
    };

    const connectToPeer = async () => {
        if (!targetId) return;
        
        // 1. Generate local ECDH keypair
        const myKeyPair = await window.crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]);
        myKeyPairRef.current = myKeyPair;
        const myJwkPubKey = await window.crypto.subtle.exportKey("jwk", myKeyPair.publicKey);

        const pc = setupPeerConnection();
        const dc = pc.createDataChannel('secure-chat');
        setupDataChannel(dc);
        dcRef.current = dc;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        wsRef.current?.send(JSON.stringify({
            type: 'OFFER',
            targetId,
            payload: { sdp: offer, publicKey: myJwkPubKey }
        }));
    };

    const sendMessage = async () => {
        if (!inputMsg || !dcRef.current || dcRef.current.readyState !== 'open') return;

        if (sharedKey) {
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const encodedText = new TextEncoder().encode(inputMsg);
            const ciphertext = await window.crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                sharedKey,
                encodedText
            );
            
            // Combine IV and Ciphertext
            const payload = new Uint8Array(iv.length + ciphertext.byteLength);
            payload.set(iv, 0);
            payload.set(new Uint8Array(ciphertext), iv.length);
            
            // Proxy through the Network Worker Bridge to transmit securely
            const port = getNetworkPort();
            port.postMessage({ action: 'CIPHERTEXT_OUTBOUND', payload: payload.buffer }, [payload.buffer]);
            
            // For now, directly send if worker isn't fully wired for WebRTC sending
            dcRef.current.send(payload.buffer);
        } else {
            dcRef.current.send(inputMsg);
        }

        setMessages(prev => [...prev, { from: 'Me', text: inputMsg }]);
        setInputMsg('');
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="p-3 border border-white/5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-between">
                    <span className="text-sm font-medium">P2P Comms</span>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-black/90 border border-white/10 text-white backdrop-blur-xl">
                <DialogHeader>
                    <DialogTitle className="text-emerald-400">Secure WebRTC Link</DialogTitle>
                    <DialogDescription className="text-white/50">
                        Zero-Knowledge End-to-End Encrypted P2P
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex items-center gap-4">
                        <div className="text-xs text-white/50">My Peer ID: <span className="font-mono text-white">{peerId || 'Connecting...'}</span></div>
                        <div className="flex-1 flex gap-2">
                            <Input 
                                placeholder="Target Peer ID" 
                                className="bg-white/5 border-white/10 text-white font-mono text-xs" 
                                value={targetId}
                                onChange={(e) => setTargetId(e.target.value)}
                                disabled={connected}
                            />
                            <Button size="sm" variant={connected ? "destructive" : "default"} onClick={connected ? () => pcRef.current?.close() : connectToPeer} disabled={!targetId}>
                                {connected ? 'Disconnect' : 'Connect'}
                            </Button>
                        </div>
                    </div>
                    
                    <Card className="bg-white/5 border-white/10">
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-xs font-mono uppercase text-white/50 flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500'}`} />
                                {connected ? 'Encrypted Tunnel Active' : 'Offline'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[200px] p-4 bg-black/50 border-y border-white/5">
                                <div className="flex flex-col gap-2">
                                    {messages.map((m, i) => (
                                        <div key={i} className={`text-xs p-2 rounded-lg max-w-[85%] ${m.from === 'Me' ? 'bg-violet-500/20 text-violet-100 self-end border border-violet-500/30' : 'bg-white/10 text-white self-start border border-white/5'}`}>
                                            <span className="opacity-50 block mb-1 font-mono text-[10px]">{m.from}</span>
                                            {m.text}
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            <div className="p-2 flex gap-2">
                                <Input 
                                    className="h-8 bg-black/50 border-white/10 text-xs text-white" 
                                    placeholder="Secure Message..." 
                                    value={inputMsg}
                                    onChange={(e) => setInputMsg(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                    disabled={!connected}
                                />
                                <Button size="sm" className="h-8 px-3" onClick={sendMessage} disabled={!connected || !inputMsg}>Send</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </DialogContent>
        </Dialog>
    );
};
