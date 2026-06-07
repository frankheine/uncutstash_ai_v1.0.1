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
import { UncutStashLogo, DataCartelLogo } from './components/ProceduralLogos';
import { CommsPanel } from '@/components/CommsPanel';
import { SpatialPanel } from './components/SpatialPanel';
import { SidebarMenu } from './components/SidebarMenu';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

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

            if (status === 'engine_ready') {
                setDownloadPercent(100);
                if (log) setDownloadLog(log);
                setEngineOnline(true);
                setTimeout(() => {
                    setEngineReady(true);
                }, 800);
                return;
            }

            if (status !== 'global_progress') return;

            receivedFirstMsg.current = true;
            if (watchdogRef.current) clearTimeout(watchdogRef.current);

            if (log) setDownloadLog(log);
            if (typeof percent === 'number') setDownloadPercent(percent);

            if (log && (log.includes('Failed') || log.includes('failed') || log.includes('Error'))) {
                setBootError(log);
                return;
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

    // ── UI Reveal Animation ───────────────────────────────────────────────────
    useEffect(() => {
        if (engineReady && chatPanelRef.current) {
            gsap.fromTo(chatPanelRef.current,
                { opacity: 0, y: 24 },
                { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", delay: 0.2 }
            );
        }
    }, [engineReady]);

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

                    {/* Inline loading indicator when engine not ready */}
{!engineReady && (
  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-10 pointer-events-none backdrop-blur-sm bg-black/60 transition-opacity duration-1000">
    {/* Free-floating transparent video logo */}
    <video 
      src="/uncutstash-logo.mp4" 
      autoPlay 
      loop 
      muted 
      playsInline 
      className="w-64 md:w-96 object-contain mix-blend-screen opacity-90 drop-shadow-[0_0_30px_rgba(139,92,246,0.3)] filter brightness-110"
    />
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3 text-white/70 text-sm font-mono tracking-widest uppercase">
        <div className={`w-2.5 h-2.5 rounded-full ${bootError ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.8)]'} animate-pulse`} />
        <span>{downloadLog}</span>
      </div>
      {downloadPercent >= 0 && (
        <div className="w-72 bg-white/5 rounded-full overflow-hidden border border-white/5 mt-1 h-1">
          <div className="h-full bg-gradient-to-r from-violet-500/80 to-fuchsia-400/80 transition-all duration-500 ease-out relative" style={{ width: `${Math.max(downloadPercent, 2)}%` }}>
            <div className="absolute top-0 right-0 bottom-0 w-12 bg-white/30 blur-[2px]" />
          </div>
        </div>
      )}
    </div>
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
                        className="glass-panel relative z-10 w-full md:w-[95%] max-w-7xl mx-auto my-4 md:my-6 h-[calc(100dvh-2rem)] md:h-[calc(100dvh-3rem)] flex flex-col max-w-[100vw] overflow-hidden"
                        style={{ opacity: 0, pointerEvents: engineReady ? 'auto' : 'none' }}
                    >
                        <SpatialPanel depth={30} className="w-full h-full rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/5 border border-white/10 shadow-[0_30px_60px_-15px_rgba(139,92,246,0.3)]">
                            <ResizablePanelGroup direction="horizontal" className="w-full h-full glass-panel">
                                <ResizablePanel defaultSize={30} minSize={20} maxSize={50} className="hidden md:block">
                                    <SidebarMenu onOpenSettings={() => { console.log('Open settings clicked') }} />
                                </ResizablePanel>
                                
                                <ResizableHandle className="w-1 bg-white/5 hover:bg-violet-500/50 transition-colors" />
                                
                                <ResizablePanel defaultSize={75} className="bg-transparent relative">
                                    <Thread />
                                </ResizablePanel>
                            </ResizablePanelGroup>
                        </SpatialPanel>
                    </div>

                    <PerimeterHalo onTrigger={() => setIsOverlayOpen(true)} />
                    <ContextualOverlay isOpen={isOverlayOpen} onClose={() => setIsOverlayOpen(false)} />

                </div>
            </AssistantRuntimeProvider>
        </TooltipProvider>
    );
}
