import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, MessageSquare } from 'lucide-react';
import { runWorker } from '../rag/pipeline';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (isOpen) onClose();
                else {
                    // It should open. For now we assume parent manages state via keyboard listener,
                    // but we can also trigger a custom event if needed.
                }
            }
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!query.trim() || !isOpen) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                // Generate query embedding
                const { embedding } = await runWorker<{ embedding: number[] }>('embed', { text: query });
                
                // Search via Orama
                const { candidates } = await runWorker<{ candidates: any[] }>('retrieve', { 
                    action: 'search', 
                    queryVector: embedding, 
                    queryText: query 
                });
                
                setResults(candidates || []);
            } catch (error) {
                console.error("Semantic search failed:", error);
            } finally {
                setIsSearching(false);
            }
        }, 500); // debounce

        return () => clearTimeout(timer);
    }, [query, isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="fixed top-[20%] left-1/2 -translate-x-1/2 z-[101] w-full max-w-2xl bg-black/80 backdrop-blur-xl border border-violet-500/30 rounded-2xl shadow-[0_0_50px_rgba(139,92,246,0.15)] overflow-hidden flex flex-col"
                    >
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                            <Search className="w-5 h-5 text-violet-400" />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Semantic Search across memories & documents..."
                                className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/40 text-lg font-light"
                            />
                            {isSearching && (
                                <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                            )}
                            <div className="flex items-center gap-1 text-[10px] font-mono text-white/30 border border-white/10 px-2 py-0.5 rounded bg-white/5">
                                <span>ESC</span>
                            </div>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {results.length === 0 && query && !isSearching ? (
                                <div className="p-8 text-center text-white/40 text-sm">
                                    No memories or documents found for this query.
                                </div>
                            ) : (
                                <div className="p-2 space-y-1">
                                    {results.map((result, idx) => (
                                        <button
                                            key={idx}
                                            className="w-full text-left p-3 rounded-xl hover:bg-white/5 transition-colors group flex gap-4 items-start"
                                        >
                                            <div className="mt-1 opacity-50 group-hover:opacity-100 group-hover:text-violet-400 transition-colors">
                                                {result.text.includes('User:') ? <MessageSquare className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-white/90 line-clamp-2 leading-relaxed">
                                                    {result.text}
                                                </div>
                                                <div className="mt-2 text-[10px] font-mono text-white/40 flex gap-4">
                                                    <span>Score: {(result.score * 100).toFixed(1)}%</span>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default CommandPalette;
