// src/store.ts
import { create } from 'zustand';

interface SovereignState {
  // Engine State
  targetModel: string;
  isBooting: boolean;
  engineReady: boolean;
  setEngineState: (booting: boolean, ready: boolean) => void;
  setModel: (modelId: string) => void;

  // UI State
  borderStyle: number;
  bgVariant: number;
  setUIPreferences: (border: number, bg: number) => void;

  // Security & Network (Isolated from Main Thread payloads)
  encryptionKey: CryptoKey | null;
  setEncryptionKey: (key: CryptoKey) => void;
}

export const useSovereignStore = create<SovereignState>((set) => ({
  // Defaulting to a fast 0.5B/1B model for WebGPU stability
  targetModel: 'Qwen3-0.6B-abliterated-q4f16_1-MLC',
  isBooting: false,
  engineReady: false,
  setEngineState: (isBooting, engineReady) => set({ isBooting, engineReady }),
  setModel: (targetModel) => set({ targetModel }),

  borderStyle: 2,
  bgVariant: 2,
  setUIPreferences: (borderStyle, bgVariant) => set({ borderStyle, bgVariant }),

  encryptionKey: null,
  setEncryptionKey: (encryptionKey) => set({ encryptionKey }),
}));