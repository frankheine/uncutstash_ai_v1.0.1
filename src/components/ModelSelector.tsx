import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, ChevronDown, Check, Zap, Download } from 'lucide-react';
import { getModelList } from '../rag/pipeline';

export interface ModelPair {
    displayName: string;
    targetModel: string;
    draftModel: string | null;
    vramRequiredMB?: number;
    quantization?: string;
    contextSize?: number;
    description?: string;
}

export const MODEL_CATALOG: ModelPair[] = [
    {
        displayName: "Llama 3.2 1B (Instruct)",
        targetModel: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
        draftModel: null
    },
    {
        displayName: "SNOWflake 3B (Standard)",
        targetModel: "SNOWflake_v1.2_UNCUTstash-3B",
        draftModel: "SNOWflake_v1.2_UNCUTstash-1B"
    },
    {
        displayName: "SNOWflake 1B (Fast)",
        targetModel: "SNOWflake_v1.2_UNCUTstash-1B",
        draftModel: null
    }
];

export const AVAILABLE_TARGETS = [
    "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    "SNOWflake_v1.2_UNCUTstash-1B",
    "SNOWflake_v1.2_UNCUTstash-3B",
];

interface ModelSelectorProps {
    onModelChange: (target: string, draft: string | null) => void;
    isBooting: boolean;
    execMode: 'local' | 'edge';
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ onModelChange, isBooting, execMode }) => {
    const [isDevMode, setIsDevMode] = useState(false);

    // Normal Mode State
    const [selectedPairIndex, setSelectedPairIndex] = useState(0);
    const [edgeTargetModel, setEdgeTargetModel] = useState("");

    // Dev Mode State
    const [devTarget, setDevTarget] = useState(AVAILABLE_TARGETS[0]);
    const [devDraft, setDevDraft] = useState<string | null>(AVAILABLE_TARGETS[2]);
    const [useDraft, setUseDraft] = useState(true);

    const [isOpen, setIsOpen] = useState(false);
    const [edgeModels, setEdgeModels] = useState<any[]>([]);

    useEffect(() => {
        if (execMode === 'edge') {
            const list = getModelList();
            setEdgeModels(list);
            if (!edgeTargetModel && list.length > 0) {
                setEdgeTargetModel(list[0].model_id);
            }
        }
    }, [execMode]);

    // Apply changes when mode or selections change
    useEffect(() => {
        if (isDevMode) {
            onModelChange(devTarget, useDraft ? devDraft : null);
        } else if (execMode === 'edge') {
            if (edgeTargetModel) {
                onModelChange(edgeTargetModel, null);
            }
        } else {
            const pair = MODEL_CATALOG[selectedPairIndex];
            onModelChange(pair.targetModel, pair.draftModel);
        }
    }, [isDevMode, selectedPairIndex, devTarget, devDraft, useDraft, execMode, edgeTargetModel]);

    const getDisplayName = (targetModelId: string) => {
        const found = MODEL_CATALOG.find(m => m.targetModel === targetModelId);
        return found ? found.displayName : targetModelId;
    };

    const activeLabel = execMode === 'edge'
        ? (edgeTargetModel ? getDisplayName(edgeTargetModel) : "Loading Edge Models...")
        : MODEL_CATALOG[selectedPairIndex].displayName;

    return (
        <div className="relative z-50 flex flex-col items-end">
            <div className="flex items-center gap-2 mb-2">
                <button
                    onClick={() => setIsDevMode(!isDevMode)}
                    className={`p-2 rounded-full backdrop-blur-md border transition-all duration-300 ${isDevMode
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
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl backdrop-blur-xl border border-white/10 bg-black/40 text-white/90 font-medium transition-all ${isBooting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5 cursor-pointer hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                                }`}
                        >
                            <span className="flex items-center gap-2 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                                <Zap className={`w-4 h-4 shrink-0 ${execMode === 'edge' ? 'text-blue-400' : 'text-yellow-400'}`} />
                                {activeLabel}
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {isOpen && !isBooting && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute top-full right-0 mt-2 w-80 max-h-[60vh] overflow-y-auto p-2 rounded-xl backdrop-blur-xl border border-white/10 bg-black/80 shadow-2xl overflow-hidden origin-top-right custom-scrollbar"
                                >
                                    {execMode === 'local' ? (
                                        MODEL_CATALOG.map((pair, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    setSelectedPairIndex(idx);
                                                    setIsOpen(false);
                                                }}
                                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${selectedPairIndex === idx
                                                    ? 'bg-white/10 text-white'
                                                    : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                                                    }`}
                                            >
                                                {pair.displayName}
                                                {selectedPairIndex === idx && <Check className="w-4 h-4" />}
                                            </button>
                                        ))
                                    ) : (
                                        edgeModels.map((model) => (
                                            <div key={model.model_id} className="relative group w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5 text-white/60 hover:text-white/90">
                                                <button
                                                    onClick={() => {
                                                        setEdgeTargetModel(model.model_id);
                                                        setIsOpen(false);
                                                    }}
                                                    className="flex-1 text-left"
                                                >
                                                    <span className={edgeTargetModel === model.model_id ? "text-white font-medium" : ""}>
                                                        {getDisplayName(model.model_id)}
                                                    </span>
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        console.log("Trigger WASM download for", model.model_id);
                                                    }}
                                                    className="p-1.5 ml-2 rounded-full hover:bg-white/10 text-white/40 hover:text-blue-400 transition-colors"
                                                    title="Download WASM Shards"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>

                                                {/* Hover Popover */}
                                                <div className="absolute top-0 right-[calc(100%+0.5rem)] w-64 p-4 rounded-xl backdrop-blur-3xl border border-white/10 bg-black/90 shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all scale-95 group-hover:scale-100 origin-right">
                                                    <h4 className="font-mono text-xs text-blue-300 mb-2 truncate">{model.model_id}</h4>
                                                    <div className="text-[10px] text-white/50 space-y-1">
                                                        <div className="flex justify-between"><span>VRAM Req:</span> <span>{model.vram_required_MB ? `${model.vram_required_MB} MB` : 'Unknown'}</span></div>
                                                        <div className="flex justify-between"><span>Context:</span> <span>{model.context_window_size || 'Default'}</span></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
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
