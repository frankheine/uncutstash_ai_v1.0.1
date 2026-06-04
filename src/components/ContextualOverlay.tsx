import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface OverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ContextualOverlay({ isOpen, onClose }: OverlayProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="absolute inset-0 z-40 flex items-center justify-center p-8 pointer-events-auto"
                >
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />
                    
                    <div className="relative w-full max-w-2xl h-[60vh] bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(124,58,237,0.15)] overflow-hidden flex flex-col">
                        
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                            <h3 className="text-sm font-mono text-zinc-300 tracking-wider">SECURE P2P CHANNEL / RAG CONTEXT</h3>
                            <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-zinc-400 transition-colors">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full bg-violet-500 animate-pulse" />
                            </div>
                            <div>
                                <h4 className="text-lg font-semibold text-white">Incoming Context Shift</h4>
                                <p className="text-xs text-zinc-400 font-mono mt-2 max-w-xs leading-relaxed">
                                    This overlay materializes on demand, allowing you to interface with incoming tasks, payment requests, or document syncs without losing your primary AI workspace state.
                                </p>
                            </div>
                        </div>

                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
