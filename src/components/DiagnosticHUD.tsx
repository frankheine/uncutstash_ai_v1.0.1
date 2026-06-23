import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

export const DiagnosticHUD: React.FC = () => {
    const [sabLatency, setSabLatency] = useState<number>(0);
    const [pmLatency, setPmLatency] = useState<number>(0);
    const [isCrossOriginIsolated, setIsCrossOriginIsolated] = useState<boolean>(false);
    
    const workerRef = useRef<Worker | null>(null);
    const sabRef = useRef<SharedArrayBuffer | null>(null);

    useEffect(() => {
        setIsCrossOriginIsolated(window.crossOriginIsolated);
        
        if (window.crossOriginIsolated) {
            sabRef.current = new SharedArrayBuffer(1024);
            workerRef.current = new Worker(new URL('../workers/latency.monitor.ts', import.meta.url), { type: 'module' });
            
            workerRef.current.postMessage({ command: 'init-sab', sab: sabRef.current });

            workerRef.current.onmessage = (e) => {
                if (e.data.type === 'sab-ping') {
                    const diff = (performance.now() - pingSentTimeRef.current) * 1000; // microseconds
                    setSabLatency(Math.round(diff));
                } else if (e.data.type === 'postmessage-ping') {
                    const diff = (e.data.wakeTime - e.data.sentTime) * 1000;
                    setPmLatency(Math.round(diff));
                }
            };

            const pingLoop = setInterval(() => {
                runDiagnosticPing();
            }, 1000);

            return () => {
                clearInterval(pingLoop);
                workerRef.current?.terminate();
            };
        }
    }, []);

    const pingSentTimeRef = useRef<number>(0);

    const runDiagnosticPing = () => {
        if (!workerRef.current) return;
        
        // 1. Fire structured clone PostMessage
        workerRef.current.postMessage({ command: 'postmessage-ping', sentTime: performance.now() });

        // 2. Fire SAB zero-copy pulse
        if (sabRef.current) {
            const i32 = new Int32Array(sabRef.current);
            pingSentTimeRef.current = performance.now();
            Atomics.store(i32, 0, 1);
            Atomics.notify(i32, 0, 1);
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1 }}
            className="fixed bottom-6 right-6 z-50 pointer-events-none"
        >
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl text-xs font-mono text-white/80 w-80">
                <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                    <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Mathematical Diagnostics</span>
                    <div className="flex items-center space-x-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[9px] text-white/50">LIVE</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center bg-black/40 p-2 rounded-lg">
                        <span className="text-white/60">Cross-Origin Isolated:</span>
                        <span className={isCrossOriginIsolated ? "text-emerald-400" : "text-red-400"}>
                            {isCrossOriginIsolated ? 'ACTIVE' : 'BLOCKED'}
                        </span>
                    </div>

                    <div className="space-y-1 bg-black/40 p-2 rounded-lg">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-white/60 text-[10px]">Worker Synchronization Latency (µs)</span>
                        </div>
                        
                        {/* postMessage Latency Bar */}
                        <div className="relative pt-1">
                            <div className="flex justify-between text-[9px] mb-1">
                                <span className="text-white/40">postMessage (Cloned)</span>
                                <span className="text-rose-300">{pmLatency} µs</span>
                            </div>
                            <div className="overflow-hidden h-1 text-xs flex rounded bg-white/5">
                                <div style={{ width: `${Math.min(100, pmLatency / 10)}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-rose-400/80 transition-all duration-300"></div>
                            </div>
                        </div>

                        {/* SAB Latency Bar */}
                        <div className="relative pt-2">
                            <div className="flex justify-between text-[9px] mb-1">
                                <span className="text-white/40">SharedArrayBuffer (Zero-Copy)</span>
                                <span className="text-emerald-300">{sabLatency} µs</span>
                            </div>
                            <div className="overflow-hidden h-1 text-xs flex rounded bg-white/5">
                                <div style={{ width: `${Math.min(100, sabLatency / 10)}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-400/80 transition-all duration-300"></div>
                            </div>
                        </div>
                    </div>

                    <div className="text-[9px] text-white/30 pt-2 border-t border-white/5 leading-relaxed">
                        Visualizing deterministic thread wake-up via Atomics.wait() bypassing structured cloning penalties.
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
