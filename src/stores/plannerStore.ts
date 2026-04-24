import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  KalenderWoche,
  WorkItems,
  WorkItemKey,
  SdpSection,
  ShiftId,
} from '@/types';

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
  /** Whether there are unsaved changes relative to Firestore */
  dirty: boolean;

  // ─── Actions ───────────────────────────────────────────────────────
  setProject: (id: string, name: string) => void;
  setKwList: (list: KalenderWoche[]) => void;
  setWorkItems: (items: WorkItems) => void;
  addKw: (kw: KalenderWoche) => void;
  removeKw: (kwId: string) => void;
  getSection: <T>(kwId: string, dayIdx: number, shift: ShiftId, section: SdpSection) => T[];
  setSection: <T>(kwId: string, dayIdx: number, shift: ShiftId, section: SdpSection, rows: T[]) => void;
  markDirty: () => void;
  markClean: () => void;
}

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set, get) => ({
      projectId: null,
      projectName: '',
      kwList: [],
      workItems: {},
      dirty: false,

      setProject: (id, name) => set({ projectId: id, projectName: name }),
      setKwList: (list) => set({ kwList: list }),
      setWorkItems: (items) => set({ workItems: items }),

      addKw: (kw) =>
        set((s) => ({
          kwList: s.kwList.find((k) => k.id === kw.id) ? s.kwList : [...s.kwList, kw],
          dirty: true,
        })),

      removeKw: (kwId) =>
        set((s) => ({ kwList: s.kwList.filter((k) => k.id !== kwId), dirty: true })),

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
          const key = wiKey(kwId, dayIdx, shift);
          const updated: WorkItems = {
            ...s.workItems,
            [key]: { ...s.workItems[key], [section]: rows },
          };
          return { workItems: updated, dirty: true };
        }),

      markDirty: () => set({ dirty: true }),
      markClean: () => set({ dirty: false }),
    }),
    {
      name: 'rsrg-planner',
      // Only persist workItems + kwList locally; projectId is loaded from URL
      partialize: (s) => ({ workItems: s.workItems, kwList: s.kwList }),
    },
  ),
);

/** Convenience selector */
export function wiKeyHelper(kwId: string, dayIdx: number, shiftId: ShiftId): WorkItemKey {
  return wiKey(kwId, dayIdx, shiftId);
}
