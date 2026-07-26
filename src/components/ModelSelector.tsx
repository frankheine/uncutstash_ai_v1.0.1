// src/components/ModelSelector.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Zap } from 'lucide-react';

export const getModelCatalog = () => [
    { displayName: "Qwen 3 0.6B (Abliterated - f16)", targetModel: 'Qwen3-0.6B-abliterated-q4f16_1-MLC' },
    { displayName: "Qwen 2 0.5B (Universal - f32)", targetModel: 'Qwen2-0.5B-Instruct-q4f32_1-MLC' }
];

interface ModelSelectorProps {
    onModelChange: (target: string) => void;
    isBooting: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ onModelChange, isBooting }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const catalog = getModelCatalog();

    return (
        <div className="relative z-50 flex flex-col items-end">
            <button
                onClick={() => !isBooting && setIsOpen(!isOpen)}
                disabled={isBooting}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl backdrop-blur-xl border border-white/10 bg-black/40 text-white/90 font-medium transition-all ${isBooting ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5 cursor-pointer hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]'}`}
            >
                <span className="flex items-center gap-2">
                    <Zap className="w-4 h-4 shrink-0 text-yellow-400" />
                    {catalog[selectedIdx].displayName}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && !isBooting && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full right-0 mt-2 w-72 p-2 rounded-xl backdrop-blur-xl border border-white/10 bg-black/80 shadow-2xl origin-top-right"
                    >
                        {catalog.map((pair, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    setSelectedIdx(idx);
                                    onModelChange(pair.targetModel);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${selectedIdx === idx ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white/90'}`}
                            >
                                {pair.displayName}
                                {selectedIdx === idx && <Check className="w-4 h-4" />}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
export default ModelSelector;