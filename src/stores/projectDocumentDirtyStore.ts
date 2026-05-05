/**
 * Whether the in-memory project document (KW + cells + Stammdaten) diverges from Firestore.
 * One seam for both planner and Stammdaten stores — not persisted (same as prior planner.dirty).
 */

import { create } from 'zustand';

interface ProjectDocumentDirtyState {
  dirty: boolean;
  markDirty: () => void;
  markClean: () => void;
}

export const useProjectDocumentDirtyStore = create<ProjectDocumentDirtyState>((set) => ({
  dirty: false,
  markDirty: () => set({ dirty: true }),
  markClean: () => set({ dirty: false }),
}));
