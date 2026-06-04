import { useEffect, useState, useRef } from 'react';
import { useLocalRuntime, AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { ragApp, setActiveProgressCallback } from './orchestrator';
import { workers } from "./rag/pipeline";
import ProceduralBackground from './components/ProceduralBackground';
import Lenis from '@studio-freight/lenis';
import gsap from 'gsap';
import { TooltipProvider } from "@/components/ui/tooltip";
import { PerimeterHalo } from './components/PerimeterHalo';
import { ContextualOverlay } from './components/ContextualOverlay';

export default function App() {
    const [engineReady, setEngineReady] = useState(false);
    const bootOverlayRef = useRef<HTMLDivElement>(null);
    const chatPanelRef = useRef<HTMLDivElement>(null);

    const [downloadLog, setDownloadLog] = useState("Initializing Sovereign AI Engine...");
    const [downloadPercent, setDownloadPercent] = useState(0);
    const [engineOnline, setEngineOnline] = useState(false);
    const [bootError, setBootError] = useState<string | null>(null);

    const [globalStatus, setGlobalStatus] = useState<string | null>(null);
    const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const receivedFirstMsg = useRef(false);

    const [isOverlayOpen, setIsOverlayOpen] = useState(false);

    // ── Engine Boot Listener ──────────────────────────────────────────────────
    useEffect(() => {
        const handleWorkerMsg = (e: MessageEvent) => {
            const { status, log, percent } = e.data;
            if (status !== 'global_progress') return;

            receivedFirstMsg.current = true;
            if (watchdogRef.current) clearTimeout(watchdogRef.current);

            if (log) setDownloadLog(log);
            if (typeof percent === 'number') setDownloadPercent(percent);

            if (log && (log.includes('Failed') || log.includes('failed') || log.includes('Error'))) {
                setBootError(log);
                return;
            }

            if (percent === 100) {
                setEngineOnline(true);
                setTimeout(() => {
                    const overlay = bootOverlayRef.current;
                    const chat = chatPanelRef.current;
                    if (overlay) {
                        gsap.to(overlay, {
                            opacity: 0, scale: 1.03,
                            duration: 0.9, ease: "power3.inOut",
                            onComplete: () => setEngineReady(true),
                        });
                    }
                    if (chat) {
                        gsap.fromTo(chat,
                            { opacity: 0, y: 24 },
                            { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", delay: 0.3 }
                        );
                    }
                }, 800);
            }
        };

        watchdogRef.current = setTimeout(() => {
            if (!receivedFirstMsg.current) {
                setBootError('Worker silent — open DevTools → Console for the error.');
            }
        }, 30_000);

        workers.inference.addEventListener('message', handleWorkerMsg);
        return () => {
            workers.inference.removeEventListener('message', handleWorkerMsg);
            if (watchdogRef.current) clearTimeout(watchdogRef.current);
        };
    }, []);

    // ── Smooth Scrolling ──────────────────────────────────────────────────────
    useEffect(() => {
        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
        });

        function raf(time: number) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);

        return () => lenis.destroy();
    }, []);

    // ── Runtime ───────────────────────────────────────────────────────────────
    const runtime = useLocalRuntime({
        run: async function* ({ messages, abortSignal }) {
            try {
                const latestMessage = messages[messages.length - 1];
                const contentArray = latestMessage.content as any[];
                const queryText = typeof latestMessage.content === 'string'
                    ? latestMessage.content
                    : contentArray.find((p) => p.type === 'text')?.text || "";

                const queue: any[] = [];
                let done = false;
                let error: any = null;

                setActiveProgressCallback((msg) => { queue.push(msg); });

                ragApp.invoke({ query: queryText }, { signal: abortSignal })
                    .then((state) => { queue.push({ type: 'done', text: state.answer }); done = true; })
                    .catch((e) => { error = e; done = true; });

                let displayedText = "";
                let currentLog = "";

                while (!done || queue.length > 0) {
                    if (queue.length > 0) {
                        const msg = queue.shift();
                        if (msg.type === 'done') {
                            yield { content: [{ type: "text", text: msg.text }] };
                        } else if (msg.log) {
                            currentLog = msg.log;
                            setGlobalStatus(currentLog);
                            if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
                            yield { content: [{ type: "text", text: `${currentLog}\n\n${displayedText}` }] };
                        } else if (msg.text !== undefined) {
                            displayedText = msg.text;
                            yield { content: [{ type: "text", text: currentLog ? `${currentLog}\n\n${displayedText}` : displayedText }] };
                        }
                    } else {
                        await new Promise(r => setTimeout(r, 50));
                    }
                }

                setActiveProgressCallback(null);
                statusTimerRef.current = setTimeout(() => setGlobalStatus(null), 2000);

                if (error) {
                    yield { content: [{ type: "text", text: `System error: ${error.message || error}` }] };
                    return;
                }
            } catch (err: any) {
                console.error("LangGraph Invocation Failed:", err);
                yield { content: [{ type: "text", text: `System error: ${err.message || err}` }] };
                return;
            }
        }
    });

    return (
        <TooltipProvider>
            <AssistantRuntimeProvider runtime={runtime}>
                <div className="relative flex h-screen w-full bg-zinc-950 overflow-hidden text-white">

                    <div className="absolute inset-0 z-0 pointer-events-none">
                        <ProceduralBackground />
                    </div>

                    {!engineReady && (
                        <div
                            ref={bootOverlayRef}
                            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 px-8"
                            style={{ backdropFilter: 'blur(2px)' }}
                        >
                            <div className="relative w-20 h-20">
                                <div className={`absolute inset-0 rounded-full border-2 ${bootError ? 'border-red-500/30' : 'border-violet-500/20'}`} />
                                <div className={`absolute inset-0 rounded-full border-2 border-t-transparent ${bootError ? 'border-red-500' : 'border-violet-400 animate-spin'}`} />
                                <div className={`absolute inset-2 rounded-full ${bootError ? 'bg-red-500/10' : 'bg-violet-500/10 animate-pulse'}`} />
                            </div>

                            {bootError ? (
                                <div className="w-full max-w-sm flex flex-col gap-3">
                                    <p className="text-red-400 text-xs font-mono text-center uppercase tracking-widest">
                                        Initialization Failed
                                    </p>
                                    <div className="bg-black/50 border border-red-500/30 rounded-xl px-4 py-3 backdrop-blur-sm">
                                        <p className="text-red-300 text-xs font-mono leading-relaxed break-words">
                                            {bootError}
                                        </p>
                                    </div>
                                    <p className="text-zinc-400 text-xs text-center font-mono">
                                        Open DevTools → Console for the full stack trace.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <p className="text-zinc-200 text-sm font-mono tracking-widest text-center max-w-sm leading-relaxed drop-shadow-lg">
                                        {downloadLog}
                                    </p>

                                    {downloadPercent > 0 && (
                                        <div className="w-full max-w-sm flex flex-col gap-2">
                                            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
                                                <div
                                                    className="h-full rounded-full transition-all duration-300 ease-out"
                                                    style={{
                                                        width: `${downloadPercent}%`,
                                                        background: engineOnline
                                                            ? 'linear-gradient(90deg, #10b981, #34d399)'
                                                            : 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                                                        boxShadow: engineOnline
                                                            ? '0 0 12px #10b98166'
                                                            : '0 0 12px #7c3aed66',
                                                    }}
                                                />
                                            </div>
                                            <div className="flex justify-between items-center text-xs font-mono">
                                                <span className="text-white/40">AI Weights</span>
                                                <span className={`font-semibold ${engineOnline ? 'text-emerald-400' : 'text-violet-300'}`}>
                                                    {downloadPercent}%
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {engineReady && globalStatus && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
                            <div className="glass-panel px-4 py-2 rounded-full border border-violet-500/30 flex items-center gap-3 shadow-lg shadow-violet-500/10">
                                <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                                <span className="text-xs font-mono text-violet-200 tracking-wide">{globalStatus}</span>
                            </div>
                        </div>
                    )}

                    <div
                        ref={chatPanelRef}
                        className="relative z-10 w-full max-w-4xl mx-auto my-6 h-[calc(100dvh-3rem)] flex flex-col glass-panel rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/5"
                        style={{ opacity: 0, pointerEvents: engineReady ? 'auto' : 'none' }}
                    >
                        <Thread />
                    </div>

                    {engineReady && (
                        <>
                            <PerimeterHalo onTrigger={() => setIsOverlayOpen(true)} />
                            <ContextualOverlay isOpen={isOverlayOpen} onClose={() => setIsOverlayOpen(false)} />
                        </>
                    )}

                </div>
            </AssistantRuntimeProvider>
        </TooltipProvider>
    );
}