import React, { useState, useEffect } from 'react';
import { MessageSquare, PlusCircle, Settings, Network, HardDrive, History } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import localforage from 'localforage';

interface SidebarMenuProps {
  onOpenSettings: () => void;
}

export function SidebarMenu({ onOpenSettings }: SidebarMenuProps) {
  const [history, setHistory] = useState<{ id: string, title: string }[]>([]);
  const [username, setUsername] = useState('Sovereign User');

  useEffect(() => {
    // Load local history and settings
    const loadState = async () => {
      try {
        const savedHistory = await localforage.getItem<{ id: string, title: string }[]>('sovereign_history');
        if (savedHistory) setHistory(savedHistory);

        const savedUser = localStorage.getItem('sovereign_username');
        if (savedUser) setUsername(savedUser);
      } catch (e) {
        console.error("Failed to load local state", e);
      }
    };
    loadState();
  }, []);

  return (
    <div className="h-full flex flex-col justify-between p-4 text-white/70 bg-black/30 backdrop-blur-md">

      <div className="flex flex-col gap-6 h-full">
        {/* Top Actions */}
        <div className="flex flex-col gap-2">
          <button className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-violet-500/20 transition-all border border-white/5 hover:border-violet-500/30 text-white shadow-sm font-medium">
            <PlusCircle size={18} className="text-violet-400" />
            <span>New Chat</span>
          </button>
          <button
            onClick={() => {
              const messages = document.querySelectorAll('.assistant-ui-message');
              let md = "# Sovereign AI Session Export\n\n";
              messages.forEach(m => {
                const role = m.getAttribute('data-role') || 'Unknown';
                const text = m.textContent || '';
                md += `**${role}**\n${text}\n\n`;
              });
              const blob = new Blob([md], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `sovereign_session_${new Date().getTime()}.md`;
              a.click();
            }}
            className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-blue-500/20 transition-all border border-white/5 hover:border-blue-500/30 text-white shadow-sm font-medium"
          >
            <HardDrive size={18} className="text-blue-400" />
            <span>Export Session (.md)</span>
          </button>
        </div>

        <ScrollArea className="flex-1 pr-2 custom-scrollbar">
          <div className="flex flex-col gap-8 pb-4">

            {/* History Section */}
            <div>
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-3 flex items-center gap-2">
                <History size={12} />
                <span>Recent Sessions</span>
              </h2>
              <div className="flex flex-col gap-1">
                {history.length > 0 ? history.map((chat, i) => (
                  <button key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors text-sm text-left truncate text-white/60 hover:text-white/90">
                    <MessageSquare size={14} className="opacity-50 flex-shrink-0" />
                    <span className="truncate">{chat.title}</span>
                  </button>
                )) : (
                  <span className="text-[10px] text-white/30 italic px-2">No active sessions</span>
                )}
              </div>
            </div>

            {/* RAG DB */}
            <div>
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-pink-400 mb-3 drop-shadow-[0_0_8px_rgba(244,114,182,0.5)] flex items-center gap-2">
                <HardDrive size={12} />
                <span>OPFS RAG Explorer</span>
              </h2>
              <div className="p-4 border border-white/5 rounded-xl bg-black/40 text-xs text-white/50 flex flex-col gap-2 shadow-inner">
                <div className="flex justify-between">
                  <span>Storage Limit:</span>
                  <span className="text-white/80">2 GB</span>
                </div>
                <div className="flex justify-between">
                  <span>Chunks Indexed:</span>
                  <span className="text-white/80">0</span>
                </div>
              </div>
            </div>

          </div>
        </ScrollArea>
      </div>

      {/* Bottom Profile / Settings */}
      <div className="pt-4 mt-2 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center font-bold text-xs text-white shadow-[0_0_15px_rgba(139,92,246,0.5)]">
            {username.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-white/90 font-medium leading-none">{username}</span>
            <span className="text-[10px] text-white/40 mt-1 uppercase tracking-wider font-mono">Sovereign Node</span>
          </div>
        </div>
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white"
          title="Advanced Settings"
        >
          <Settings size={18} className="hover:animate-spin-slow" />
        </button>
      </div>

    </div>
  );
}
