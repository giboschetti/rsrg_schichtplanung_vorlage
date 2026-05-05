import { useMemo, useCallback, type MouseEvent } from 'react';
import { useTimelineSelectionStore, makeBadgeRef, badgeKey } from '@/stores/timelineSelectionStore';
import type { SelectedCell } from '@/stores/uiStore';
import {
  getPersonalByFunktion,
  getTasksByFachdienstBauteil,
} from '@/lib/workItemHelpers';
import { isHttpUrl, intervallePdfUrl } from '@/lib/utils';
import type { SdpSection, ShiftId, TaskItem, PersonalItem } from '@/types';
import type { TlRowMeta } from '@/types/timeline';
import { TimelineChip } from './TimelineChip';

export function TimelineCell({
  kwId,
  dayIdx,
  shift,
  meta,
  getSection,
  collapsed,
  onOpen,
  onOpenIntervallePdf,
}: {
  kwId: string;
  dayIdx: number;
  shift: ShiftId;
  meta: TlRowMeta;
  getSection: <T>(kwId: string, dayIdx: number, shift: ShiftId, section: SdpSection) => T[];
  collapsed: boolean;
  onOpen: (cell: SelectedCell) => void;
  onOpenIntervallePdf: (p: { url: string; label?: string }) => void;
}) {
  const selected = useTimelineSelectionStore((s) => s.selected);

  const leafItems = useMemo(() => {
    if (meta.kind === 'bauteil') {
      const tasks = getSection<TaskItem>(kwId, dayIdx, shift, 'tasks');
      return getTasksByFachdienstBauteil(tasks, meta.fachdienst!, meta.bauteil!);
    }
    if (meta.kind === 'funktion') {
      const personal = getSection<PersonalItem>(kwId, dayIdx, shift, 'personal');
      return getPersonalByFunktion(personal, meta.funktion!);
    }
    if (meta.kind === 'group-header' || meta.kind === 'fachdienst') return [];
    return getSection<unknown>(kwId, dayIdx, shift, meta.sectionId);
  }, [kwId, dayIdx, shift, meta, getSection]);

  const handleCellBackground = useCallback(() => {
    if (meta.kind === 'fachdienst') {
      useTimelineSelectionStore.getState().setLastPasteContext({ kwId, dayIdx, shift, meta });
      useTimelineSelectionStore.getState().clearSelection();
      return;
    }
    if (meta.kind === 'group-header') {
      const all = getSection<unknown>(kwId, dayIdx, shift, meta.sectionId);
      useTimelineSelectionStore.getState().selectAllBadgesInCell(kwId, dayIdx, shift, meta, all);
      return;
    }
    useTimelineSelectionStore.getState().selectAllBadgesInCell(kwId, dayIdx, shift, meta, leafItems);
  }, [kwId, dayIdx, shift, meta, getSection, leafItems]);

  const openSdpForIntervalle = useCallback(() => {
    onOpen({ kwId, dayIdx, shift, grp: 'intervalle' });
  }, [kwId, dayIdx, shift, onOpen]);

  const handleIntervalleChipClick = useCallback(
    (e: MouseEvent, it: unknown) => {
      e.stopPropagation();
      const row = it as Record<string, unknown>;
      openSdpForIntervalle();
      const file = intervallePdfUrl(row);
      if (isHttpUrl(file)) {
        onOpenIntervallePdf({
          url: file.trim(),
          label: (row.babTitel as string) || (row.babNr as string) || undefined,
        });
      }
    },
    [openSdpForIntervalle, onOpenIntervallePdf],
  );

  if (meta.kind === 'group-header') {
    if (collapsed) {
      const allItems = getSection<unknown>(kwId, dayIdx, shift, meta.sectionId);
      const count = allItems.length;
      return (
        <div onClick={handleCellBackground} style={{ padding: '4px 6px', height: '100%', cursor: 'pointer' }}>
          {count > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1px 7px',
                borderRadius: 9999,
                fontSize: 10,
                fontWeight: 600,
                background: '#fff',
                color: '#52525b',
                border: '1px solid #d4d4d8',
              }}
            >
              {count}
            </span>
          )}
        </div>
      );
    }
    return (
      <div onClick={handleCellBackground} style={{ height: '100%', minHeight: 36, cursor: 'pointer' }} />
    );
  }

  if (meta.kind === 'fachdienst') {
    return <div onClick={handleCellBackground} style={{ height: '100%', cursor: 'pointer' }} />;
  }

  const items = leafItems;
  const isIntRow = meta.sectionId === 'intervalle';

  return (
    <div
      onClick={handleCellBackground}
      style={{
        padding: '3px 5px',
        height: '100%',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        justifyContent: 'flex-start',
      }}
    >
      {items.map((it, idx) => {
        if (idx >= 3) return null;
        const ref = makeBadgeRef(it, kwId, dayIdx, shift, meta);
        const sel =
          ref != null && selected.some((r) => badgeKey(r) === badgeKey(ref));
        return (
          <TimelineChip
            key={((it as Record<string, unknown>).id as string) ?? idx}
            item={it}
            section={meta.sectionId}
            selected={!isIntRow && sel}
            onIntervalleClick={isIntRow ? (e) => handleIntervalleChipClick(e, it) : undefined}
            onSelectMouseDown={
              !isIntRow && ref
                ? (e) => {
                    useTimelineSelectionStore.getState().setLastPasteContext({
                      kwId,
                      dayIdx,
                      shift,
                      meta,
                    });
                    useTimelineSelectionStore.getState().activateBadge(ref, meta, items, idx, {
                      shiftKey: e.shiftKey,
                    });
                  }
                : undefined
            }
          />
        );
      })}
      {items.length > 3 && (
        <span style={{ fontSize: 9, color: '#71717a', paddingLeft: 2 }}>
          +{items.length - 3}
        </span>
      )}
    </div>
  );
}
