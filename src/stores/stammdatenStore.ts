import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FachdienstBauteile, MitarbeiterRow, ProjectStamFormFields, ShiftConfig } from '@/types';
import { EMPTY_PROJECT_STAM_FORM } from '@/types';

// ─── Write-channel callbacks ─────────────────────────────────────────────────
// Registered by useAutoSave. User-action setters call these; load-only bulk
// setters (setFachdienstBauteile, setMitarbeiter) do not.

type StammdatenWriteCallback = (stammdaten: unknown) => void;
type MitarbeiterWriteCallback = (mitarbeiter: MitarbeiterRow[]) => void;

let _onStammdatenWrite: StammdatenWriteCallback | null = null;
let _onMitarbeiterWrite: MitarbeiterWriteCallback | null = null;

export function registerStammdatenWriteCallbacks(
  onStammdaten: StammdatenWriteCallback,
  onMitarbeiter: MitarbeiterWriteCallback,
): void {
  _onStammdatenWrite = onStammdaten;
  _onMitarbeiterWrite = onMitarbeiter;
}

export function clearStammdatenWriteCallbacks(): void {
  _onStammdatenWrite = null;
  _onMitarbeiterWrite = null;
}

// ─── Store ───────────────────────────────────────────────────────────────────

function newId(): string {
  return `m_${Math.random().toString(36).slice(2)}`;
}

export const DEFAULT_SHIFT_CONFIG: ShiftConfig = {
  tag: { von: '07:00', bis: '19:00' },
  nacht: { von: '19:00', bis: '07:00' },
};

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

export const useStammdatenStore = create<StammdatenState>()(
  persist(
    (set, get) => ({
      fachdienstBauteile: {},
      shiftConfig: DEFAULT_SHIFT_CONFIG,
      projectForm: { ...EMPTY_PROJECT_STAM_FORM },
      mitarbeiter: [],

      // Load-only — no write callback.
      setFachdienstBauteile: (data) => {
        set({ fachdienstBauteile: data });
      },

      addBauteil: (fachdienst, bauteil) => {
        const s = get();
        const existing = s.fachdienstBauteile[fachdienst] ?? [];
        if (existing.includes(bauteil)) return;
        const fachdienstBauteile = {
          ...s.fachdienstBauteile,
          [fachdienst]: [...existing, bauteil],
        };
        set({ fachdienstBauteile });
        _onStammdatenWrite?.({ fachdienstBauteile, shiftConfig: get().shiftConfig, ...get().projectForm });
      },

      removeBauteil: (fachdienst, idx) => {
        set((s) => {
          const existing = [...(s.fachdienstBauteile[fachdienst] ?? [])];
          existing.splice(idx, 1);
          const fachdienstBauteile = { ...s.fachdienstBauteile, [fachdienst]: existing };
          _onStammdatenWrite?.({ fachdienstBauteile, shiftConfig: s.shiftConfig, ...s.projectForm });
          return { fachdienstBauteile };
        });
      },

      getBauteileForFachdienst: (fachdienst) =>
        get().fachdienstBauteile[fachdienst] ?? [],

      setShiftConfig: (cfg) => {
        set({ shiftConfig: cfg });
        const s = get();
        _onStammdatenWrite?.({ fachdienstBauteile: s.fachdienstBauteile, shiftConfig: cfg, ...s.projectForm });
      },

      setProjectForm: (p) => {
        set((s) => {
          const projectForm = { ...s.projectForm, ...p };
          _onStammdatenWrite?.({ fachdienstBauteile: s.fachdienstBauteile, shiftConfig: s.shiftConfig, ...projectForm });
          return { projectForm };
        });
      },

      // Load-only — no write callback.
      setMitarbeiter: (rows) => {
        set({ mitarbeiter: rows });
      },

      addMitarbeiterRow: () => {
        set((s) => {
          const mitarbeiter = [...s.mitarbeiter, { id: newId() }];
          _onMitarbeiterWrite?.(mitarbeiter);
          return { mitarbeiter };
        });
      },

      updateMitarbeiterRow: (id, patch) => {
        set((s) => {
          const mitarbeiter = s.mitarbeiter.map((r) => (r.id === id ? { ...r, ...patch } : r));
          _onMitarbeiterWrite?.(mitarbeiter);
          return { mitarbeiter };
        });
      },

      removeMitarbeiterRow: (id) => {
        set((s) => {
          const mitarbeiter = s.mitarbeiter.filter((r) => r.id !== id);
          _onMitarbeiterWrite?.(mitarbeiter);
          return { mitarbeiter };
        });
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
