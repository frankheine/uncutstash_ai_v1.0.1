import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, ChevronDown, Check, Zap } from 'lucide-react';

export interface ModelPair {
    displayName: string;
    targetModel: string;
    draftModel: string | null;
}

export const MODEL_CATALOG: ModelPair[] = [
    {
        displayName: "UNCUTstash 3B (Fast)",
        targetModel: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
        draftModel: "Llama-3.2-1B-Instruct-q4f16_1-MLC"
    },
    {
        displayName: "SNOWflake 1B (Standard)",
        targetModel: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
        draftModel: null
    }
];

export const AVAILABLE_TARGETS = [
    "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    "Llama-3.2-3B-Instruct-q4f32_1-MLC",
    "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    "Llama-3.2-1B-Instruct-q4f32_1-MLC"
];

interface ModelSelectorProps {
    onModelChange: (target: string, draft: string | null) => void;
    isBooting: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ onModelChange, isBooting }) => {
    const [isDevMode, setIsDevMode] = useState(false);
    
    // Normal Mode State
    const [selectedPairIndex, setSelectedPairIndex] = useState(0);
    
    // Dev Mode State
    const [devTarget, setDevTarget] = useState(AVAILABLE_TARGETS[0]);
    const [devDraft, setDevDraft] = useState<string | null>(AVAILABLE_TARGETS[2]);
    const [useDraft, setUseDraft] = useState(true);

    const [isOpen, setIsOpen] = useState(false);

    // Apply changes when mode or selections change
    useEffect(() => {
        if (!isDevMode) {
            const pair = MODEL_CATALOG[selectedPairIndex];
            onModelChange(pair.targetModel, pair.draftModel);
        } else {
            onModelChange(devTarget, useDraft ? devDraft : null);
        }
    }, [isDevMode, selectedPairIndex, devTarget, devDraft, useDraft]);

    return (
        <div className="relative z-50 flex flex-col items-end">
            <div className="flex items-center gap-2 mb-2">
                <button
                    onClick={() => setIsDevMode(!isDevMode)}
                    className={`p-2 rounded-full backdrop-blur-md border transition-all duration-300 ${
                        isDevMode 
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.4)]' 
                        : 'bg-black/40 border-white/10 text-white/50 hover:text-white/80'
                    }`}
                    title="Developer Options"
                >
                    <Settings2 className="w-4 h-4" />
                </button>
            </div>

            <AnimatePresence mode="wait">
                {!isDevMode ? (
                    <motion.div
                        key="normal-mode"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="relative"
                    >
                        <button
                            onClick={() => !isBooting && setIsOpen(!isOpen)}
                            disabled={isBooting}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl backdrop-blur-xl border border-white/10 bg-black/40 text-white/90 font-medium transition-all ${
                                isBooting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5 cursor-pointer hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <Zap className={`w-4 h-4 ${selectedPairIndex === 0 ? 'text-yellow-400' : 'text-blue-400'}`} />
                                {MODEL_CATALOG[selectedPairIndex].displayName}
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {isOpen && !isBooting && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute top-full right-0 mt-2 w-64 p-2 rounded-xl backdrop-blur-xl border border-white/10 bg-black/80 shadow-2xl overflow-hidden origin-top-right"
                                >
                                    {MODEL_CATALOG.map((pair, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                setSelectedPairIndex(idx);
                                                setIsOpen(false);
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                                                selectedPairIndex === idx 
                                                ? 'bg-white/10 text-white' 
                                                : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                                            }`}
                                        >
                                            {pair.displayName}
                                            {selectedPairIndex === idx && <Check className="w-4 h-4" />}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                ) : (
                    <motion.div
                        key="dev-mode"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex flex-col gap-3 p-4 rounded-xl backdrop-blur-2xl border border-purple-500/30 bg-black/60 shadow-[0_0_30px_rgba(168,85,247,0.15)] min-w-[320px]"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold tracking-widest text-purple-400 uppercase">Developer Override</span>
                            {isBooting && <span className="text-xs text-yellow-400 animate-pulse">Mounting VRAM...</span>}
                        </div>

                        {/* Target Model */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-white/50 pl-1">Primary Target Engine</label>
                            <select 
                                value={devTarget}
                                onChange={(e) => setDevTarget(e.target.value)}
                                disabled={isBooting}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none transition-colors"
                            >
                                {AVAILABLE_TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        {/* Draft Model Toggle */}
                        <div className="flex items-center justify-between mt-2 pl-1">
                            <label className="text-xs font-medium text-white/50">Speculative Draft Engine</label>
                            <button 
                                onClick={() => setUseDraft(!useDraft)}
                                disabled={isBooting}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${useDraft ? 'bg-purple-500' : 'bg-white/20'}`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${useDraft ? 'translate-x-4' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* Draft Model Select */}
                        <AnimatePresence>
                            {useDraft && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <select 
                                        value={devDraft || ''}
                                        onChange={(e) => setDevDraft(e.target.value)}
                                        disabled={isBooting}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none transition-colors"
                                    >
                                        {AVAILABLE_TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
export default ModelSelector;
