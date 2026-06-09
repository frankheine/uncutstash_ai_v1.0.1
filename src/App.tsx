// src/App.tsx
import { Suspense, useEffect, useState, useRef } from 'react';
import { useLocalRuntime, AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { ragApp, setActiveProgressCallback } from './orchestrator';
import { getWorkers, runWorker } from './rag/pipeline';
import ProceduralBackground from './components/ProceduralBackground';
import Lenis from '@studio-freight/lenis';
import gsap from 'gsap';
import { TooltipProvider } from "@/components/ui/tooltip";
import { PerimeterHalo } from './components/PerimeterHalo';
import { ContextualOverlay } from './components/ContextualOverlay';
import { SidebarMenu } from './components/SidebarMenu';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { SpatialPanel } from './components/SpatialPanel';

const PanelGroup = ResizablePanelGroup as any;

export default function App() {
    const [engineReady, setEngineReady] = useState(false);
    const chatPanelRef = useRef<HTMLDivElement>(null);
    const [sessionId, setSessionId] = useState(() => crypto.randomUUID());

    useEffect(() => {
        const handleNavigation = () => {
            setSessionId(crypto.randomUUID());
        };
        window.addEventListener('popstate', handleNavigation);
        return () => window.removeEventListener('popstate', handleNavigation);
    }, []);

    const [downloadLog, setDownloadLog] = useState(`Initializing UNCUTstash AI
Private Intelligence Engine...`);
    const [downloadPercent, setDownloadPercent] = useState(0);
    const [bootError, setBootError] = useState<string | null>(null);
    const [globalStatus, setGlobalStatus] = useState<string | null>(null);

    const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const receivedFirstMsg = useRef(false);
    const [isOverlayOpen, setIsOverlayOpen] = useState(false);

    useEffect(() => {
        const handleWorkerMsg = (e: MessageEvent) => {
            const { status, log, percent } = e.data;

            if (status === 'engine_ready') {
                setDownloadPercent(100);
                if (log) setDownloadLog(log);

                // Trigger View Transition API for seamless state morphing
                if ('startViewTransition' in document) {
                    (document as any).startViewTransition(() => setEngineReady(true));
                } else {
                    setEngineReady(true);
                }
                return;
            }

            if (status !== 'global_progress') return;

            receivedFirstMsg.current = true;
            if (watchdogRef.current) clearTimeout(watchdogRef.current);

            if (log) setDownloadLog(log);
            if (typeof percent === 'number') setDownloadPercent(percent);

            if (log && (log.toLowerCase().includes('failed') || log.toLowerCase().includes('error'))) {
                setBootError(log);
            }
        };

        watchdogRef.current = setTimeout(() => {
            if (!receivedFirstMsg.current) {
                setBootError(`Worker silent — open DevTools (F12)
            → Console for the error.`)
            }
        }, 30_000);

        getWorkers.getInference().addEventListener('message', handleWorkerMsg);
        return () => {
            getWorkers.getInference().removeEventListener('message', handleWorkerMsg);
            if (watchdogRef.current) clearTimeout(watchdogRef.current);
        };
    }, []);

        useEffect(() => {
            if (engineReady && chatPanelRef.current) {
                gsap.fromTo(chatPanelRef.current,
                    { opacity: 0, scale: 0.95, filter: 'blur(10px)' },
                    { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.2, ease: "expo.out" }
                );
            }
        }, [engineReady]);

        useEffect(() => {
            const lenis = new Lenis({
                duration: 1.2,
                easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
                orientation: 'vertical',
                smoothWheel: true,
            });

            function raf(time: number) {
                lenis.raf(time);
                requestAnimationFrame(raf);
            }
            requestAnimationFrame(raf);
            return () => lenis.destroy();
        }, []);

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
                            } else if (msg.delta !== undefined) {
                                displayedText += msg.delta;
                                yield { content: [{ type: "text", text: currentLog ? `${currentLog}\n\n${displayedText}` : displayedText }] };
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
                    }
                } catch (err: any) {
                    yield { content: [{ type: "text", text: `System error: ${err.message || err}` }] };
                }
            }
        });

        return (
            <TooltipProvider>
                <AssistantRuntimeProvider runtime={runtime}>
                    <div className="relative flex h-[100dvh] w-full bg-zinc-950 overflow-hidden text-white selection:bg-violet-500/30">

                        <div className="absolute inset-0 z-0 pointer-events-none">
                            <ProceduralBackground />
                        </div>

                        {!engineReady && (
                            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-10 pointer-events-none backdrop-blur-md bg-black/40 transition-opacity duration-1000">
                                <div className="relative w-48 h-48 flex items-center justify-center">
                                    <svg className="absolute inset-0 w-full h-full animate-spin-slow" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(139, 92, 246, 0.2)" strokeWidth="1"></circle>
                                        <circle cx="50" cy="50" r="48" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="300" strokeDashoffset="250" className="drop-shadow-[0_0_10px_rgba(139,92,246,0.8)]"></circle>
                                    </svg>
                                    <div className="text-4xl font-light tracking-widest text-violet-400">AI</div>
                                </div>
                                <div className="flex flex-col items-center gap-4">
                                    <div className="flex items-center gap-3 text-white/80 text-xs font-mono tracking-widest uppercase">
                                        <div className={`w-2 h-2 rounded-full ${bootError ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.8)]'} animate-pulse`} />
                                        <span>{downloadLog}</span>
                                    </div>
                                    {downloadPercent >= 0 && (
                                        <div className="w-80 bg-white/5 rounded-full overflow-hidden border border-white/10 h-1.5">
                                            <div className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all duration-300 ease-out relative" style={{ width: `${Math.max(downloadPercent, 2)}%` }}>
                                                <div className="absolute top-0 right-0 bottom-0 w-10 bg-white/40 blur-[2px]" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {engineReady && globalStatus && (
                            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
                                <div className="glass-panel px-5 py-2.5 rounded-full border border-violet-500/40 flex items-center gap-3 shadow-[0_0_20px_rgba(139,92,246,0.2)] backdrop-blur-xl">
                                    <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
                                    <span className="text-xs font-mono text-violet-100 tracking-wider">{globalStatus}</span>
                                </div>
                            </div>
                        )}

                        <div
                            ref={chatPanelRef}
                            className="relative z-10 w-full md:w-[96%] max-w-7xl mx-auto my-4 md:my-6 h-[calc(100dvh-2rem)] md:h-[calc(100dvh-3rem)] flex flex-col overflow-hidden"
                            style={{ opacity: 0, pointerEvents: engineReady ? 'auto' : 'none' }}
                        >
                            <SpatialPanel depth={20} className="w-full h-full rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 border border-white/5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)]">
                                <PanelGroup direction="horizontal" className="w-full h-full glass-panel">
                                    <ResizablePanel defaultSize={25} minSize={20} maxSize={40} className="hidden md:block bg-black/20">
                                        <SidebarMenu onOpenSettings={() => { console.log('Settings') }} />
                                    </ResizablePanel>

                                    <ResizableHandle className="w-[1px] bg-white/10 hover:bg-violet-500/50 transition-colors" />

                                    <ResizablePanel defaultSize={75} className="bg-transparent relative">
                                        <Suspense fallback={<div className="flex h-full items-center justify-center text-violet-400/50 animate-pulse font-mono text-sm">Mounting Secure Boundary...</div>}>
                                            <div key={sessionId} className="w-full h-full">
                                                <Thread />
                                            </div>
                                        </Suspense>
                                    </ResizablePanel>
                                </PanelGroup>
                            </SpatialPanel>
                        </div>

                        <PerimeterHalo onTrigger={() => setIsOverlayOpen(true)} />
                        <ContextualOverlay isOpen={isOverlayOpen} onClose={() => setIsOverlayOpen(false)} />

                        {engineReady && <div className="engine-ready-indicator hidden" />}
                    </div>
                </AssistantRuntimeProvider>
            </TooltipProvider>
        );
    }