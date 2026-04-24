import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FachdienstBauteile, ShiftConfig } from '@/types';

interface StammdatenState {
  fachdienstBauteile: FachdienstBauteile;
  shiftConfig: ShiftConfig;

  setFachdienstBauteile: (data: FachdienstBauteile) => void;
  addBauteil: (fachdienst: string, bauteil: string) => void;
  removeBauteil: (fachdienst: string, idx: number) => void;
  getBauteileForFachdienst: (fachdienst: string) => string[];
  setShiftConfig: (cfg: ShiftConfig) => void;
}

const DEFAULT_SHIFT_CONFIG: ShiftConfig = {
  tag: { von: '07:00', bis: '19:00' },
  nacht: { von: '19:00', bis: '07:00' },
};

export const useStammdatenStore = create<StammdatenState>()(
  persist(
    (set, get) => ({
      fachdienstBauteile: {},
      shiftConfig: DEFAULT_SHIFT_CONFIG,

      setFachdienstBauteile: (data) => set({ fachdienstBauteile: data }),

      addBauteil: (fachdienst, bauteil) =>
        set((s) => {
          const existing = s.fachdienstBauteile[fachdienst] ?? [];
          if (existing.includes(bauteil)) return s;
          return {
            fachdienstBauteile: {
              ...s.fachdienstBauteile,
              [fachdienst]: [...existing, bauteil],
            },
          };
        }),

      removeBauteil: (fachdienst, idx) =>
        set((s) => {
          const existing = [...(s.fachdienstBauteile[fachdienst] ?? [])];
          existing.splice(idx, 1);
          return {
            fachdienstBauteile: { ...s.fachdienstBauteile, [fachdienst]: existing },
          };
        }),

      getBauteileForFachdienst: (fachdienst) =>
        get().fachdienstBauteile[fachdienst] ?? [],

      setShiftConfig: (cfg) => set({ shiftConfig: cfg }),
    }),
    { name: 'rsrg-stammdaten' },
  ),
);
