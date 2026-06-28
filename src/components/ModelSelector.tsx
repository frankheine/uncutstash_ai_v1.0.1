// src/components/ModelSelector.tsx

import React, { useState, useEffect, useRef } from 'react';
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

export const getModelCatalog = (f16Supported: boolean): ModelPair[] => [
    {
        displayName: f16Supported ? "Llama 3.2 1B (f16 - Recommended)" : "Llama 3.2 1B (f32 - Compatibility)",
        targetModel: f16Supported
            ? 'Llama-3.2-1B-Instruct-q4f16_1-MLC'
            : 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
        draftModel: null
    },
    // keep the abliterated entry but move it down, label it local-only
    {
        displayName: "DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC",
        targetModel: `DeepSeek-R1-Distill-Qwen-1.5B-q4f16_1-MLC`,
        draftModel: null
    },
    {
        displayName: "Llama 3.2 1B (Abliterated)",
        targetModel: `Llama-3.2-1B-Instruct-abliterated-q4f16_1-MLC`,
        draftModel: null
    },
    {
        displayName: "Llama 3.2 1B (Instruct)",
        targetModel: `Llama-3.2-1B-Instruct-q4f32_1-MLC`,
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

export const getAvailableTargets = (f16Supported: boolean): string[] => {
    const list = [
        f16Supported
            ? 'Llama-3.2-1B-Instruct-q4f16_1-MLC'
            : 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
        'Llama-3.2-3B-Instruct-q4f32_1-MLC',
        'SNOWflake_v1.2_UNCUTstash-1B',
        'SNOWflake_v1.2_UNCUTstash-3B',
    ];
    if (f16Supported) {
        list.splice(1, 0, 'Llama-3.2-1B-Instruct-abliterated-q4f16_1-MLC');
    }
    return list;
};

interface ModelSelectorProps {
    onModelChange: (target: string, draft: string | null) => void;
    isBooting: boolean;
    execMode: 'local' | 'edge';
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ onModelChange, isBooting, execMode }) => {
    const [isSpeculativeOverride, setIsSpeculativeOverride] = useState(false);
    const [f16Supported, setF16Supported] = useState(false);

    // Normal Mode State
    const [selectedPairIndex, setSelectedPairIndex] = useState(0);
    const [edgeTargetModel, setEdgeTargetModel] = useState("");

    // Dev Mode State
    const [devTarget, setDevTarget] = useState(getAvailableTargets(false)[0]);
    const [devDraft, setDevDraft] = useState<string | null>(getAvailableTargets(false)[1]);
    const [useDraft, setUseDraft] = useState(true);

    const [isOpen, setIsOpen] = useState(false);
    const [edgeModels, setEdgeModels] = useState<any[]>([]);

    useEffect(() => {
        const detectHardware = async () => {
            if (navigator.gpu) {
                try {
                    const adapter = await navigator.gpu.requestAdapter();
                    if (adapter && adapter.features.has('shader-f16')) {
                        setF16Supported(true);
                        setDevTarget(getAvailableTargets(true)[0]);
                        setDevDraft(getAvailableTargets(true)[2]);
                    }
                } catch (e) { }
            }
        };
        detectHardware();
    }, []);

    useEffect(() => {
        if (execMode === 'edge') {
            const list = getModelList();
            setEdgeModels(list);
            if (!edgeTargetModel && list.length > 0) {
                const preferredId = f16Supported
                    ? list.find(m => m.model_id.includes('q4f16'))?.model_id
                    : list.find(m => m.model_id.includes('q4f32'))?.model_id;
                setEdgeTargetModel(preferredId ?? list[0].model_id);
            }
        }
    }, [execMode, f16Supported]);   // ← add f16Supported so it reacts once detection resolves

    // Apply changes when mode or selections change.
    // Guard against firing on initial mount — App.tsx owns the initial model state.
    // We still want to fire when f16Supported changes (hardware detection), when the
    // user changes the dropdown, or when execMode changes.
    const isInitialMountRef = useRef(true);

    useEffect(() => {
        if (isInitialMountRef.current) {
            isInitialMountRef.current = false;
            return;
        }
        if (isSpeculativeOverride) {
            onModelChange(devTarget, useDraft ? devDraft : null);
        } else if (execMode === 'edge') {
            if (edgeTargetModel) {
                onModelChange(edgeTargetModel, null);
            }
        } else {
            const catalog = getModelCatalog(f16Supported);
            const pair = catalog[selectedPairIndex];
            onModelChange(pair.targetModel, pair.draftModel);
        }
    }, [isSpeculativeOverride, selectedPairIndex, devTarget, devDraft, useDraft, execMode, edgeTargetModel, f16Supported]);

    const getDisplayName = (targetModelId: string) => {
        const catalog = getModelCatalog(f16Supported);
        const found = catalog.find(m => m.targetModel === targetModelId);
        return found ? found.displayName : targetModelId;
    };

    const activeLabel = execMode === 'edge'
        ? (edgeTargetModel ? getDisplayName(edgeTargetModel) : "Loading Edge Models...")
        : getModelCatalog(f16Supported)[selectedPairIndex].displayName;

    return (
        <div className="relative z-50 flex flex-col items-end">
            <div className="flex flex-col items-end gap-2">
                {/* Top Row: Toggle Button + Main Dropdown */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsSpeculativeOverride(!isSpeculativeOverride)}
                        className={`p-2 rounded-full backdrop-blur-md border transition-all duration-300 ${isSpeculativeOverride
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                            : 'bg-black/40 border-white/10 text-white/50 hover:text-white/80'
                            }`}
                        title="Toggle Speculative Generation Override"
                    >
                        <Settings2 className="w-4 h-4" />
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => !isBooting && !isSpeculativeOverride && setIsOpen(!isOpen)}
                            disabled={isBooting || isSpeculativeOverride}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl backdrop-blur-xl border border-white/10 bg-black/40 text-white/90 font-medium transition-all ${isBooting || isSpeculativeOverride
                                ? 'opacity-40 cursor-not-allowed'
                                : 'hover:bg-white/5 cursor-pointer hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                                }`}
                        >
                            <span className="flex items-center gap-2 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                                <Zap className={`w-4 h-4 shrink-0 ${execMode === 'edge' ? 'text-blue-400' : 'text-yellow-400'}`} />
                                {activeLabel}
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {isOpen && !isBooting && !isSpeculativeOverride && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute top-full right-0 mt-2 w-80 max-h-[60vh] overflow-y-auto p-2 rounded-xl backdrop-blur-xl border border-white/10 bg-black/80 shadow-2xl overflow-hidden origin-top-right custom-scrollbar"
                                >
                                    {execMode === 'local' ? (
                                        getModelCatalog(f16Supported).map((pair, idx) => (
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
                    </div>
                </div>

                {/* Bottom Row: Speculative Override Panel */}
                <AnimatePresence>
                    {isSpeculativeOverride && (
                        <motion.div
                            key="speculative-mode"
                            initial={{ opacity: 0, height: 0, scale: 0.95, transformOrigin: "top right" }}
                            animate={{ opacity: 1, height: 'auto', scale: 1 }}
                            exit={{ opacity: 0, height: 0, scale: 0.95 }}
                            className="flex flex-col gap-3 p-4 rounded-xl backdrop-blur-2xl border border-purple-500/30 bg-black/60 shadow-[0_0_30px_rgba(168,85,247,0.15)] min-w-[320px] overflow-hidden"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold tracking-widest text-purple-400 uppercase">Speculative Override</span>
                                {isBooting && <span className="text-xs text-yellow-400 animate-pulse">Mounting VRAM...</span>}
                            </div>

                            {/* Target Model */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-white/50 pl-1">Primary Target Engine</label>
                                <select
                                    value={devTarget}
                                    onChange={(e) => setDevTarget(e.target.value)}
                                    disabled={isBooting}
                                    className={`w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-purple-500/50 transition-colors ${isBooting ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                >
                                    {getAvailableTargets(f16Supported).map((t) => (
                                        <option key={t} value={t} className="bg-zinc-900">{t}</option>
                                    ))}
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
                                            className={`w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-purple-500/50 transition-colors ${isBooting ? 'opacity-50 cursor-not-allowed' : ''
                                                }`}
                                        >
                                            {getAvailableTargets(f16Supported).map((t) => (
                                                <option key={t} value={t} className="bg-zinc-900">{t}</option>
                                            ))}
                                        </select>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
export default ModelSelector;
