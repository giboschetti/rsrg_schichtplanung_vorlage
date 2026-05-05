import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useProjectDocumentDirtyStore } from '@/stores/projectDocumentDirtyStore';
import type { FachdienstBauteile, MitarbeiterRow, ProjectStamFormFields, ShiftConfig } from '@/types';
import { EMPTY_PROJECT_STAM_FORM } from '@/types';

function touchDocumentDirty(): void {
  useProjectDocumentDirtyStore.getState().markDirty();
}

interface StammdatenState {
  fachdienstBauteile: FachdienstBauteile;
  shiftConfig: ShiftConfig;
  projectForm: ProjectStamFormFields;
  mitarbeiter: MitarbeiterRow[];

  setFachdienstBauteile: (data: FachdienstBauteile) => void;
  addBauteil: (fachdienst: string, bauteil: string) => void;
  removeBauteil: (fachdienst: string, idx: number) => void;
  getBauteileForFachdienst: (fachdienst: string) => string[];
  setShiftConfig: (cfg: ShiftConfig) => void;

  setProjectForm: (p: Partial<ProjectStamFormFields>) => void;
  setMitarbeiter: (rows: MitarbeiterRow[]) => void;
  addMitarbeiterRow: () => void;
  updateMitarbeiterRow: (id: string, patch: Partial<Omit<MitarbeiterRow, 'id'>>) => void;
  removeMitarbeiterRow: (id: string) => void;
}

function newId(): string {
  return `m_${Math.random().toString(36).slice(2)}`;
}

export const DEFAULT_SHIFT_CONFIG: ShiftConfig = {
  tag: { von: '07:00', bis: '19:00' },
  nacht: { von: '19:00', bis: '07:00' },
};

export const useStammdatenStore = create<StammdatenState>()(
  persist(
    (set, get) => ({
      fachdienstBauteile: {},
      shiftConfig: DEFAULT_SHIFT_CONFIG,
      projectForm: { ...EMPTY_PROJECT_STAM_FORM },
      mitarbeiter: [],

      setFachdienstBauteile: (data) => {
        set({ fachdienstBauteile: data });
        touchDocumentDirty();
      },

      addBauteil: (fachdienst, bauteil) => {
        const s = get();
        const existing = s.fachdienstBauteile[fachdienst] ?? [];
        if (existing.includes(bauteil)) return;
        set({
          fachdienstBauteile: {
            ...s.fachdienstBauteile,
            [fachdienst]: [...existing, bauteil],
          },
        });
        touchDocumentDirty();
      },

      removeBauteil: (fachdienst, idx) => {
        set((s) => {
          const existing = [...(s.fachdienstBauteile[fachdienst] ?? [])];
          existing.splice(idx, 1);
          return {
            fachdienstBauteile: { ...s.fachdienstBauteile, [fachdienst]: existing },
          };
        });
        touchDocumentDirty();
      },

      getBauteileForFachdienst: (fachdienst) =>
        get().fachdienstBauteile[fachdienst] ?? [],

      setShiftConfig: (cfg) => {
        set({ shiftConfig: cfg });
        touchDocumentDirty();
      },

      setProjectForm: (p) => {
        set((s) => ({ projectForm: { ...s.projectForm, ...p } }));
        touchDocumentDirty();
      },

      setMitarbeiter: (rows) => {
        set({ mitarbeiter: rows });
        touchDocumentDirty();
      },

      addMitarbeiterRow: () => {
        set((s) => ({
          mitarbeiter: [...s.mitarbeiter, { id: newId() }],
        }));
        touchDocumentDirty();
      },

      updateMitarbeiterRow: (id, patch) => {
        set((s) => ({
          mitarbeiter: s.mitarbeiter.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        }));
        touchDocumentDirty();
      },

      removeMitarbeiterRow: (id) => {
        set((s) => ({
          mitarbeiter: s.mitarbeiter.filter((r) => r.id !== id),
        }));
        touchDocumentDirty();
      },
    }),
    {
      name: 'rsrg-stammdaten',
      skipHydration: true,
      partialize: (s) => ({
        fachdienstBauteile: s.fachdienstBauteile,
        shiftConfig: s.shiftConfig,
        projectForm: s.projectForm,
        mitarbeiter: s.mitarbeiter,
      }),
    },
  ),
);
