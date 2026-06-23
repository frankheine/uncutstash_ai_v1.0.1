// src/App.tsx
import { Suspense, useEffect, useState, useRef } from 'react';
import { useLocalRuntime, AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { ragApp, setActiveProgressCallback } from './orchestrator';
import { getWorkers, runWorker, bootstrapSpeculativePipeline } from './rag/pipeline';
import ModelSelector from './components/ModelSelector';
import StyleSelector from './components/StyleSelector';
import ProceduralBackground from './components/ProceduralBackground';
import Lenis from '@studio-freight/lenis';
import gsap from 'gsap';
import { TooltipProvider } from "@/components/ui/tooltip";
import { PerimeterHalo } from './components/PerimeterHalo';
import { ContextualOverlay } from './components/ContextualOverlay';
import { SidebarMenu } from './components/SidebarMenu';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { SpatialPanel } from './components/SpatialPanel';
import DocumentDropzone from './components/DocumentDropzone';
import CommandPalette from './components/CommandPalette';
import OfflineIndicator from './components/OfflineIndicator';
import CubeLoader from './components/CubeLoader';
import { SettingsModal } from './components/SettingsModal';

const PanelGroup = ResizablePanelGroup as any;

export default function App() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [engineReady, setEngineReady] = useState(false);
    const [isBooting, setIsBooting] = useState(false);
    const [useZeroCopy, setUseZeroCopy] = useState(false);
    const [targetModel, setTargetModel] = useState("SNOWflake_v1.2_UNCUTstash-1B");
    const [draftModel, setDraftModel] = useState<string | null>(null);
    const [borderStyle, setBorderStyle] = useState(2); // Option 2 Default
    const [cubeVariant, setCubeVariant] = useState(1); // Cube variation state
    const [bgVariant, setBgVariant] = useState(2); // Procedural Background state
    const chatPanelRef = useRef<HTMLDivElement>(null);
    const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
    const [execMode, setExecMode] = useState<'local' | 'edge'>('edge');
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [scrollMode, setScrollMode] = useState<'container' | 'page'>('container');

    useEffect(() => {
        const handleNavigation = () => {
            setSessionId(crypto.randomUUID());
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setIsCommandPaletteOpen(true);
            }
        };
        window.addEventListener('popstate', handleNavigation);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('popstate', handleNavigation);
            window.removeEventListener('keydown', handleKeyDown);
        };
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

    const lastZeroCopyRef = useRef<boolean | null>(null);

    const bootLockRef = useRef(false);

    useEffect(() => {
        if (bootLockRef.current) return;
        bootLockRef.current = true;

        setBootError(null);
        setDownloadLog("Initializing Sovereign Dual Engine...");
        setIsBooting(true);

        const bootSequence = async () => {
            // GPU probing and f16/f32 auto-routing is now handled inside
            // bootstrapSpeculativePipeline itself, including CPU fallback.
            import('./rag/pipeline').then(m => m.setExecutionMode(execMode));
            bootstrapSpeculativePipeline(targetModel, draftModel, (text) => {
                setDownloadLog(text);
                const match = text.match(/\[(\d+)\/\d+\]/);
                if (match) {
                    setDownloadPercent(parseInt(match[1]) * 10);
                } else {
                    setDownloadPercent(prev => (prev < 90 ? prev + 5 : prev));
                }
            })
                .then(() => {
                    setDownloadPercent(100);
                    setIsBooting(false);
                    if (!engineReady) {
                        if ('startViewTransition' in document) {
                            (document as any).startViewTransition(() => setEngineReady(true));
                        } else {
                            setEngineReady(true);
                        }
                    }
                })
                .catch(err => {
                    setIsBooting(false);
                    setBootError(`Initialization Failed: ${err.message || err}`);
                    bootLockRef.current = false;
                });
        };

        bootSequence();

        return () => {
            // Intentionally not resetting bootLockRef to prevent React StrictMode double-booting
        };
    }, [targetModel, draftModel, useZeroCopy, execMode]);

    useEffect(() => {
        if (engineReady && chatPanelRef.current) {
            gsap.fromTo(chatPanelRef.current,
                { opacity: 0, scale: 0.95, filter: 'blur(10px)' },
                { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.2, ease: "expo.out" }
            );
        }
    }, [engineReady]);

    useEffect(() => {
        gsap.ticker.lagSmoothing(0);
        let lenis: Lenis | null = null;
        let observer: MutationObserver | null = null;

        function update(time: number) {
            if (lenis) lenis.raf(time * 1000);
        }

        function initLenis(container: HTMLElement | Window) {
            if (lenis) {
                gsap.ticker.remove(update);
                lenis.destroy();
            }
            lenis = new Lenis({
                wrapper: container === window ? window : (container as HTMLElement),
                content: container === window ? document.documentElement : (container && 'firstElementChild' in container ? (container as HTMLElement).firstElementChild as HTMLElement : undefined),
                duration: 1.2,
                easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
                orientation: 'vertical',
                smoothWheel: true,
            });
            (window as any).activeLenis = lenis;
            gsap.ticker.add(update);
        }

        if (scrollMode === 'page') {
            document.body.style.overflow = 'auto';
            document.documentElement.style.overflow = 'auto';
            initLenis(window);
        } else {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            // Try to find the viewport immediately
            const viewport = document.querySelector('[data-radix-scroll-area-viewport]');
            if (viewport) {
                initLenis(viewport as HTMLElement);
            } else {
                // Fallback to window, but keep watching for the viewport
                initLenis(window);
                observer = new MutationObserver(() => {
                    const newViewport = document.querySelector('[data-radix-scroll-area-viewport]');
                    if (newViewport) {
                        initLenis(newViewport as HTMLElement);
                        observer?.disconnect();
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
            }
        }

        return () => {
            if (observer) observer.disconnect();
            if (lenis) {
                gsap.ticker.remove(update);
                lenis.destroy();
            }
            (window as any).activeLenis = null;
        };
    }, [scrollMode]);

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

    const getBorderClass = (styleIndex: number) => {
        switch (styleIndex) {
            case 1: // Edge-Lit Prismatic Bezel
                return "bg-black/60 backdrop-blur-2xl ring-1 ring-violet-500/60 shadow-[0_0_40px_rgba(139,92,246,0.3)]";
            case 2: // Magnetic Displacement Frame
                return "bg-black/50 backdrop-blur-3xl border border-white/20 shadow-[0_60px_120px_-20px_rgba(0,0,0,1)]";
            case 3: // Chromatic Aberration Halo
                return "bg-black/60 backdrop-blur-2xl border-2 border-transparent [box-shadow:inset_0_0_20px_rgba(255,0,0,0.1),0_0_20px_rgba(0,0,255,0.2)]";
            case 4: // Crystalline Volumetric Extrusion
                return "bg-black/40 backdrop-blur-3xl border border-white/10 [box-shadow:inset_1px_1px_2px_rgba(255,255,255,0.5),inset_-2px_-2px_4px_rgba(0,0,0,0.9),0_30px_60px_rgba(0,0,0,0.8)]";
            default:
                return "bg-black/20 backdrop-blur-xl border border-white/10";
        }
    };

    return (
        <TooltipProvider>
            <AssistantRuntimeProvider runtime={runtime}>
                <div className={`relative flex w-full bg-zinc-950 text-white selection:bg-violet-500/30 ${scrollMode === 'container' ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'}`}>
                    <DocumentDropzone onProgress={(status) => {
                        setGlobalStatus(status);
                        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
                        statusTimerRef.current = setTimeout(() => setGlobalStatus(null), 3000);
                    }} />

                    <OfflineIndicator />
                    <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />

                    <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 items-end">
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    const newMode = execMode === 'local' ? 'edge' : 'local';
                                    bootLockRef.current = false;
                                    setExecMode(newMode);
                                    import('./rag/pipeline').then(m => m.setExecutionMode(newMode));
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-mono tracking-widest backdrop-blur-md border transition-all ${execMode === 'edge'
                                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.4)]'
                                    : 'bg-green-500/20 border-green-500/50 text-green-300 shadow-[0_0_15px_rgba(34,197,94,0.4)]'
                                    }`}
                            >
                                {execMode === 'local' ? 'SOVEREIGN LOCAL' : 'EDGE NETWORK'}
                            </button>
                        </div>
                        <ModelSelector
                            isBooting={isBooting}
                            execMode={execMode}
                            onModelChange={(target, draft) => {
                                bootLockRef.current = false;
                                setTargetModel(target);
                                setDraftModel(draft);
                            }}
                        />
                        <StyleSelector
                            currentStyle={borderStyle}
                            onStyleChange={setBorderStyle}
                        />
                    </div>

                    <div className="absolute inset-0 z-0 pointer-events-none">
                        <ProceduralBackground slowMode={engineReady} variant={bgVariant} />
                    </div>

                    {!engineReady && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-10 pointer-events-none backdrop-blur-md bg-black/40 transition-opacity duration-1000">
                            <div className="flex flex-col items-center gap-6 z-10 pointer-events-auto">
                                <div className="text-white/50 text-xs font-mono uppercase tracking-widest mb-2 text-center">
                                    Cube Variant
                                </div>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4].map(idx => (
                                        <button
                                            key={idx}
                                            onClick={() => setCubeVariant(idx)}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono transition-colors backdrop-blur-md border ${cubeVariant === idx ? 'bg-violet-500/40 border-violet-400 text-white shadow-[0_0_15px_rgba(139,92,246,0.6)]' : 'bg-black/40 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'}`}
                                            title={`Cube ${idx}`}
                                        >
                                            {idx}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="relative z-10 flex items-center justify-center pointer-events-none h-48">
                                <CubeLoader variant={cubeVariant} />
                            </div>
                            <div className="relative z-10 flex flex-col items-center gap-4">
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
                                <div className="mt-8 flex flex-col gap-3">
                                    <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-lg border border-white/10 pointer-events-auto cursor-pointer" onClick={() => !engineReady && setUseZeroCopy(!useZeroCopy)}>
                                        <div className={`w-10 h-5 rounded-full transition-colors relative ${useZeroCopy ? 'bg-violet-500' : 'bg-white/20'}`}>
                                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${useZeroCopy ? 'left-[22px]' : 'left-[2px]'}`} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-mono text-white/90">ZERO-COPY STREAMING</span>
                                            <span className="text-[10px] text-white/50">{useZeroCopy ? "Bypasses iOS Cache Limits (Slower Boot)" : "Uses IndexedDB Cache (Fast Boot)"}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if ('startViewTransition' in document) {
                                                (document as any).startViewTransition(() => setEngineReady(true));
                                            } else {
                                                setEngineReady(true);
                                            }
                                        }}
                                        className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-mono pointer-events-auto hover:bg-red-500/20 transition-colors text-center tracking-widest"
                                    >
                                        FORCE BYPASS ENGINE (DEV DEMO)
                                    </button>
                                </div>
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
                        className={`relative z-10 w-[92%] md:w-[85%] max-w-6xl mx-auto my-8 md:my-12 flex flex-col ${scrollMode === 'container' ? 'h-[calc(100dvh-4rem)] md:h-[calc(100dvh-6rem)] overflow-hidden' : 'min-h-[calc(100dvh-4rem)]'}`}
                        style={{ opacity: 0, pointerEvents: engineReady ? 'auto' : 'none' }}
                    >
                        {engineReady && (
                            <div className="absolute top-4 right-4 z-50 flex gap-2 items-center pointer-events-auto">
                                <ModelSelector
                                    execMode={execMode}
                                    isBooting={isBooting}
                                    onModelChange={(t, d) => {
                                        bootLockRef.current = false;
                                        setTargetModel(t);
                                        setDraftModel(d);
                                    }}
                                />
                                <button
                                    onClick={() => setScrollMode(prev => prev === 'container' ? 'page' : 'container')}
                                    className="px-3 py-1.5 rounded-full text-xs font-mono backdrop-blur-md border border-white/10 bg-black/40 text-white/80 hover:bg-white/10 transition-colors shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                                    title="Toggle Scroll Mode (Container vs Page)"
                                >
                                    SCROLL: {scrollMode.toUpperCase()}
                                </button>
                                <div className="w-[1px] h-6 bg-white/20 mx-1"></div>
                                {[1, 2, 3, 4].map(idx => (
                                    <button
                                        key={idx}
                                        onClick={() => setBorderStyle(idx)}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono transition-colors backdrop-blur-md border ${borderStyle === idx ? 'bg-violet-500/40 border-violet-400 text-white shadow-[0_0_15px_rgba(139,92,246,0.6)]' : 'bg-black/40 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'}`}
                                        title={`UI Theme Option ${idx}`}
                                    >
                                        {idx}
                                    </button>
                                ))}
                                <div className="w-[1px] h-6 bg-white/20 mx-1"></div>
                                <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-full px-2 py-1 border border-white/10">
                                    <span className="text-[10px] text-white/50 uppercase tracking-widest px-2">BG</span>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(idx => (
                                        <button
                                            key={`bg-${idx}`}
                                            onClick={() => setBgVariant(idx)}
                                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-mono transition-colors ${bgVariant === idx ? 'bg-violet-500/60 text-white border border-violet-400' : 'bg-white/5 text-white/40 hover:bg-white/20'}`}
                                            title={`Background ${idx}`}
                                        >
                                            {idx}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <SpatialPanel depth={20} className={`w-full h-full rounded-2xl md:rounded-3xl overflow-hidden transition-all duration-700 ${getBorderClass(borderStyle)}`}>
                            <PanelGroup direction="horizontal" className="w-full h-full">
                                <ResizablePanel
                                    defaultSize={28}
                                    minSize={22}
                                    maxSize={45}
                                    style={{ minWidth: '220px' }}
                                    className="hidden md:flex flex-col bg-black/20 border-r border-white/5"
                                >
                                    <SidebarMenu onOpenSettings={() => setIsSettingsOpen(true)} />
                                </ResizablePanel>

                                <ResizableHandle className="w-[1px] bg-white/10 hover:bg-violet-500/50 transition-colors cursor-col-resize" />

                                <ResizablePanel defaultSize={72} className="bg-transparent relative">
                                    <Suspense fallback={<div className="flex h-full items-center justify-center text-violet-400/50 animate-pulse font-mono text-sm">Mounting Secure Boundary...</div>}>
                                        <div key={sessionId} className="w-full h-full">
                                            <Thread />
                                        </div>
                                    </Suspense>
                                </ResizablePanel>
                            </PanelGroup>
                        </SpatialPanel>
                    </div>

                    {/* <PerimeterHalo onTrigger={() => setIsOverlayOpen(true)} /> */}
                    <ContextualOverlay isOpen={isOverlayOpen} onClose={() => setIsOverlayOpen(false)} />
                    <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

                    {engineReady && <div className="engine-ready-indicator absolute opacity-0 w-0 h-0 pointer-events-none" />}
                </div>
            </AssistantRuntimeProvider>
        </TooltipProvider>
    );
}