import { create } from 'zustand';
import type { SdpSection, ShiftId, TlGroup } from '@/types';
import { TL_GROUPS } from '@/types';

interface SelectedCell {
  kwId: string;
  dayIdx: number;
  shift: ShiftId;
  grp?: SdpSection;
}

interface TlFilterState {
  intervalle: boolean;
  tasks: boolean;
  personal: boolean;
  inventar: boolean;
  material: boolean;
  fremdleistung: boolean;
}

interface ToastMessage {
  id: string;
  message: string;
}

interface UiState {
  /** Currently open tab: 'uebersicht' | 'stammdaten' */
  activeTab: string;
  /** Open SDP panel */
  sdpOpen: boolean;
  /** Which cell triggered the SDP */
  selectedCell: SelectedCell | null;
  /** Timeline group filter */
  tlFilter: TlFilterState;
  /** Which timeline parent rows are collapsed */
  tlCollapsed: Record<string, boolean>;
  /** Active toast messages */
  toasts: ToastMessage[];
  /** Available TL groups (can be reordered) */
  tlGroups: TlGroup[];

  setActiveTab: (tab: string) => void;
  openSdp: (cell: SelectedCell) => void;
  closeSdp: () => void;
  toggleTlFilter: (grpId: keyof TlFilterState) => void;
  toggleTlCollapsed: (grpId: string) => void;
  showToast: (message: string) => void;
  dismissToast: (id: string) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  activeTab: 'uebersicht',
  sdpOpen: false,
  selectedCell: null,
  tlFilter: {
    intervalle: true,
    tasks: true,
    personal: true,
    inventar: true,
    material: true,
    fremdleistung: true,
  },
  tlCollapsed: {},
  toasts: [],
  tlGroups: TL_GROUPS,

  setActiveTab: (tab) => set({ activeTab: tab }),

  openSdp: (cell) => set({ sdpOpen: true, selectedCell: cell }),

  closeSdp: () => set({ sdpOpen: false, selectedCell: null }),

  toggleTlFilter: (grpId) =>
    set((s) => ({
      tlFilter: { ...s.tlFilter, [grpId]: !s.tlFilter[grpId] },
    })),

  toggleTlCollapsed: (grpId) =>
    set((s) => ({
      tlCollapsed: { ...s.tlCollapsed, [grpId]: !s.tlCollapsed[grpId] },
    })),

  showToast: (message) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
