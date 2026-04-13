import { createStore } from "zustand/vanilla";
import { persist } from "zustand/middleware";

export interface SoundState {
  enabled: boolean;
  volume: number;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
}

export const soundStore = createStore<SoundState>()(
  persist(
    (set) => ({
      enabled: false,
      volume: 0.5,
      setEnabled: (enabled) => set({ enabled }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
    }),
    {
      name: "fellowship-sounds",
    },
  ),
);

const SOUNDS = {
  councilNew: "/sounds/council-new.mp3",
  approved: "/sounds/approved.mp3",
  rejected: "/sounds/rejected.mp3",
  incident: "/sounds/incident.mp3",
  deploySuccess: "/sounds/deploy-success.mp3",
  emergencyStop: "/sounds/emergency-stop.mp3",
} as const;

export type SoundKey = keyof typeof SOUNDS;

export function playSound(key: SoundKey, volume?: number): void {
  const state = soundStore.getState();
  if (!state.enabled) return;
  const vol = volume ?? state.volume;
  const audio = new Audio(SOUNDS[key]);
  audio.volume = Math.max(0, Math.min(1, vol));
  audio.play().catch(() => {}); // Suppress autoplay policy errors
}
