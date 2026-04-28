import { create } from 'zustand';
import type { ShiftId } from '@/types';
import type { TlBadgeRef, TlRowMeta } from '@/types/timeline';

export function badgeKey(r: TlBadgeRef): string {
  return `${r.kwId}|${r.dayIdx}|${r.shift}|${r.sectionId}|${r.itemId}`;
}

function cellKey(
  kwId: string,
  dayIdx: number,
  shift: ShiftId,
  meta: TlRowMeta,
): string {
  return `${kwId}|${dayIdx}|${shift}|${meta.kind}|${meta.sectionId}|${meta.fachdienst ?? ''}|${meta.bauteil ?? ''}|${meta.funktion ?? ''}`;
}

export function makeBadgeRef(
  item: unknown,
  kwId: string,
  dayIdx: number,
  shift: ShiftId,
  meta: TlRowMeta,
): TlBadgeRef | null {
  const id = (item as { id?: string })?.id;
  if (!id) return null;
  return {
    kwId,
    dayIdx,
    shift,
    sectionId: meta.sectionId,
    rowKind: meta.kind,
    itemId: id,
    fachdienst: meta.fachdienst,
    bauteil: meta.bauteil,
    funktion: meta.funktion,
  };
}

export interface LastPasteContext {
  kwId: string;
  dayIdx: number;
  shift: ShiftId;
  meta: TlRowMeta;
}

interface TimelineSelectionState {
  selected: TlBadgeRef[];
  /** Anchor index within `items` for Shift+range in the same cell */
  rangeAnchor: { cellKey: string; itemIndex: number } | null;
  lastPasteContext: LastPasteContext | null;

  clearSelection: () => void;
  setLastPasteContext: (ctx: LastPasteContext) => void;
  /** White cell click: select every badge in that cell (and set paste target). */
  selectAllBadgesInCell: (
    kwId: string,
    dayIdx: number,
    shift: ShiftId,
    meta: TlRowMeta,
    items: unknown[],
  ) => void;
  /** Chip activate: normal click replaces selection; Shift+click range in-cell or additive across cells */
  activateBadge: (
    ref: TlBadgeRef,
    meta: TlRowMeta,
    itemsInCell: unknown[],
    itemIndex: number,
    opts: { shiftKey: boolean },
  ) => void;
}

export const useTimelineSelectionStore = create<TimelineSelectionState>((set, get) => ({
  selected: [],
  rangeAnchor: null,
  lastPasteContext: null,

  clearSelection: () => set({ selected: [], rangeAnchor: null }),

  setLastPasteContext: (ctx) => set({ lastPasteContext: ctx }),

  selectAllBadgesInCell: (kwId, dayIdx, shift, meta, items) => {
    const refs = items
      .map((it) => makeBadgeRef(it, kwId, dayIdx, shift, meta))
      .filter((r): r is TlBadgeRef => r != null);
    set({
      lastPasteContext: { kwId, dayIdx, shift, meta },
      selected: refs,
      rangeAnchor: null,
    });
  },

  activateBadge: (ref, meta, itemsInCell, itemIndex, { shiftKey }) => {
    const ck = cellKey(ref.kwId, ref.dayIdx, ref.shift, meta);
    const { rangeAnchor, selected } = get();

    if (shiftKey && rangeAnchor && rangeAnchor.cellKey === ck) {
      const lo = Math.min(rangeAnchor.itemIndex, itemIndex);
      const hi = Math.max(rangeAnchor.itemIndex, itemIndex);
      const slice = itemsInCell.slice(lo, hi + 1);
      const next: TlBadgeRef[] = [];
      const seen = new Set<string>();
      for (const it of slice) {
        const r = makeBadgeRef(it, ref.kwId, ref.dayIdx, ref.shift, meta);
        if (!r) continue;
        const k = badgeKey(r);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push(r);
      }
      set({ selected: next });
      return;
    }

    if (shiftKey && rangeAnchor && rangeAnchor.cellKey !== ck) {
      const k = badgeKey(ref);
      const have = new Map(selected.map((r) => [badgeKey(r), r]));
      have.set(k, ref);
      set({ selected: Array.from(have.values()) });
      return;
    }

    set({
      selected: [ref],
      rangeAnchor: { cellKey: ck, itemIndex },
    });
  },
}));
