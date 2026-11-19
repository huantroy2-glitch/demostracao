import { create } from "zustand";

export type Dialog = { name: string; text: string; index: number; total: number };

type UIState = {
  started: boolean;
  locked: boolean;
  prompt: string | null;
  money: number;
  clock: number;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  dialog: Dialog | null;
  toast: { text: string; id: number } | null;
  showHelp: boolean;
  set: (patch: Partial<Omit<UIState, "set">>) => void;
};

export const useUI = create<UIState>((set) => ({
  started: false,
  locked: false,
  prompt: null,
  money: 0,
  clock: 18 * 60 + 5,
  playerX: 0,
  playerZ: -58,
  playerYaw: Math.PI,
  dialog: null,
  toast: null,
  showHelp: true,
  set: (patch) => set(patch),
}));
