import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useProjectDocumentDirtyStore } from '@/stores/projectDocumentDirtyStore';
import type {
  KalenderWoche,
  WorkItems,
  WorkItemKey,
  SdpSection,
  ShiftId,
} from '@/types';

function markDocumentDirty(): void {
  useProjectDocumentDirtyStore.getState().markDirty();
}

function wiKey(kwId: string, dayIdx: number, shiftId: ShiftId): WorkItemKey {
  return `${kwId}__${dayIdx}__${shiftId}`;
}

interface PlannerState {
  /** Current open project id */
  projectId: string | null;
  /** Project display name */
  projectName: string;
  /** Calendar weeks in order */
  kwList: KalenderWoche[];
  /** All work items keyed by `kwId__dayIdx__shiftId` */
  workItems: WorkItems;

  // ─── Actions ───────────────────────────────────────────────────────
  setProject: (id: string, name: string) => void;
  setKwList: (list: KalenderWoche[]) => void;
  setWorkItems: (items: WorkItems) => void;
  addKw: (kw: KalenderWoche) => void;
  removeKw: (kwId: string) => void;
  getSection: <T>(kwId: string, dayIdx: number, shift: ShiftId, section: SdpSection) => T[];
  setSection: <T>(kwId: string, dayIdx: number, shift: ShiftId, section: SdpSection, rows: T[]) => void;
}

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set, get) => ({
      projectId: null,
      projectName: '',
      kwList: [],
      workItems: {},

      setProject: (id, name) => set({ projectId: id, projectName: name }),
      setKwList: (list) => set({ kwList: list }),
      setWorkItems: (items) => set({ workItems: items }),

      addKw: (kw) =>
        set((s) => {
          if (s.kwList.find((k) => k.id === kw.id)) return {};
          markDocumentDirty();
          return { kwList: [...s.kwList, kw] };
        }),

      removeKw: (kwId) =>
        set((s) => {
          markDocumentDirty();
          return { kwList: s.kwList.filter((k) => k.id !== kwId) };
        }),

      getSection: <T>(kwId: string, dayIdx: number, shift: ShiftId, section: SdpSection): T[] => {
        const key = wiKey(kwId, dayIdx, shift);
        const cell = get().workItems[key];
        return (Array.isArray(cell?.[section]) ? cell[section] : []) as T[];
      },

      setSection: <T>(
        kwId: string,
        dayIdx: number,
        shift: ShiftId,
        section: SdpSection,
        rows: T[],
      ) =>
        set((s) => {
          markDocumentDirty();
          const key = wiKey(kwId, dayIdx, shift);
          const updated: WorkItems = {
            ...s.workItems,
            [key]: { ...s.workItems[key], [section]: rows },
          };
          return { workItems: updated };
        }),
    }),
    {
      // Key is set per project in useProject (setOptions) so local cache never mixes projects.
      name: 'rsrg-planner',
      skipHydration: true,
      // Only persist workItems + kwList locally; projectId is loaded from URL
      partialize: (s) => ({ workItems: s.workItems, kwList: s.kwList }),
    },
  ),
);

/** Convenience selector */
export function wiKeyHelper(kwId: string, dayIdx: number, shiftId: ShiftId): WorkItemKey {
  return wiKey(kwId, dayIdx, shiftId);
}
