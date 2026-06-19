import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, ShieldCheck } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <AnimatePresence>
            {isOffline && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute top-4 left-4 z-50 flex items-center gap-3 px-4 py-2 rounded-full bg-black/60 backdrop-blur-xl border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.15)]"
                >
                    <div className="relative">
                        <WifiOff className="w-4 h-4 text-green-400" />
                        <ShieldCheck className="w-3 h-3 text-green-300 absolute -bottom-1 -right-1 bg-black rounded-full" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-mono tracking-widest text-green-400 uppercase leading-tight">Air-Gapped Mode</span>
                        <span className="text-[8px] font-mono text-green-300/60 leading-tight">Secure Local Sandbox Active</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default OfflineIndicator;
