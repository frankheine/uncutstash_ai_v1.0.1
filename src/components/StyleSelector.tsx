import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Check, ChevronDown } from 'lucide-react';

interface StyleOption {
    id: number;
    name: string;
}

const STYLE_OPTIONS: StyleOption[] = [
    { id: 0, name: "Minimalist Glass" },
    { id: 1, name: "Edge-Lit Prismatic" },
    { id: 2, name: "Magnetic Displacement" },
    { id: 3, name: "Chromatic Aberration" },
    { id: 4, name: "Crystalline Volumetric" }
];

interface StyleSelectorProps {
    currentStyle: number;
    onStyleChange: (styleId: number) => void;
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({ currentStyle, onStyleChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const currentOption = STYLE_OPTIONS.find(o => o.id === currentStyle) || STYLE_OPTIONS[0];

    return (
        <div className="relative z-50 flex flex-col items-end">
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative"
            >
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl backdrop-blur-xl border border-white/10 bg-black/40 text-white/90 font-medium transition-all hover:bg-white/5 cursor-pointer hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                >
                    <span className="flex items-center gap-2 text-xs">
                        <Palette className="w-4 h-4 text-violet-400" />
                        {currentOption.name}
                    </span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full right-0 mt-2 w-56 p-2 rounded-xl backdrop-blur-xl border border-white/10 bg-black/80 shadow-2xl overflow-hidden origin-top-right"
                        >
                            {STYLE_OPTIONS.map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => {
                                        onStyleChange(opt.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-colors ${
                                        currentStyle === opt.id 
                                        ? 'bg-white/10 text-white' 
                                        : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                                    }`}
                                >
                                    {opt.name}
                                    {currentStyle === opt.id && <Check className="w-3 h-3 text-violet-400" />}
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
export default StyleSelector;
