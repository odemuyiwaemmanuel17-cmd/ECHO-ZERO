import { create } from "zustand";
function read(key: string, fallback: number | boolean) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
export const usePresentation = create<{
  reducedMotion: boolean;
  volume: number;
  setReducedMotion: (v: boolean) => void;
  setVolume: (v: number) => void;
}>((set) => ({
  reducedMotion: read(
    "echo-reduced-motion",
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  ),
  volume: read("echo-volume", 0.45),
  setReducedMotion: (v) => {
    set({ reducedMotion: v });
    try {
      localStorage.setItem("echo-reduced-motion", JSON.stringify(v));
    } catch {}
  },
  setVolume: (v) => {
    set({ volume: v });
    try {
      localStorage.setItem("echo-volume", JSON.stringify(v));
    } catch {}
  },
}));
