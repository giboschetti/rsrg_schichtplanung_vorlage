import { useMemo, useRef, useCallback, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  type ColumnDef,
  type Column,
} from '@tanstack/react-table';
import { usePlannerStore } from '@/stores/plannerStore';
import { useStammdatenStore } from '@/stores/stammdatenStore';
import { useUiStore } from '@/stores/uiStore';
import { handleTimelineGridKeyDown } from '@/lib/timelineBulkActions';
import {
  getUsedFachdienste,
  getUsedPersonalFunctions,
} from '@/lib/workItemHelpers';
import type { ShiftId } from '@/types';
import { TL_DAYS, TL_SHIFTS } from '@/types';
import type { TlRowMeta } from '@/types/timeline';

import { buildTimelineRows } from './timelineRowBuilder';
import { timelineColId } from './timelineColumnIds';
import { TimelineBodyRow } from './TimelineBodyRow';
import { TimelineCell } from './TimelineCell';
import { TimelineThead } from './TimelineThead';

const LABEL_COL_WIDTH = 250;
const SHIFT_COL_WIDTH = 88;

export function TimelineGrid() {
  const kwList = usePlannerStore((s) => s.kwList);
  const workItems = usePlannerStore((s) => s.workItems);
  const getSection = usePlannerStore((s) => s.getSection);
  const fachdienstBauteile = useStammdatenStore((s) => s.fachdienstBauteile);
  const tlFilter = useUiStore((s) => s.tlFilter);
  const fachdienstTlFilter = useUiStore((s) => s.fachdienstTlFilter);
  const tlCollapsed = useUiStore((s) => s.tlCollapsed);
  const toggleTlCollapsed = useUiStore((s) => s.toggleTlCollapsed);
  const openSdp = useUiStore((s) => s.openSdp);
  const openIntervallePdf = useUiStore((s) => s.openIntervallePdf);

  const handleShiftHeaderClick = useCallback(
    (kwId: string, dayIdx: number, shift: ShiftId) => {
      openSdp({ kwId, dayIdx, shift, sdpCollapseAll: true });
    },
    [openSdp],
  );

  const usedFachdienste = useMemo(() => getUsedFachdienste(workItems), [workItems]);
  const usedFunktionen = useMemo(() => getUsedPersonalFunctions(workItems), [workItems]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => handleTimelineGridKeyDown(e);
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const rows: TlRowMeta[] = useMemo(
    () =>
      buildTimelineRows({
        tlFilter,
        fachdienstTlFilter,
        tlCollapsed,
        usedFachdienste,
        usedFunktionen,
        workItems,
        fachdienstBauteile,
      }),
    [
      tlFilter,
      fachdienstTlFilter,
      tlCollapsed,
      usedFachdienste,
      usedFunktionen,
      workItems,
      fachdienstBauteile,
    ],
  );

  const columns = useMemo<ColumnDef<TlRowMeta>[]>(() => {
    const cols: ColumnDef<TlRowMeta>[] = [
      {
        id: 'label',
        header: 'Ressource',
        size: LABEL_COL_WIDTH,
        cell: ({ row }) => {
          const meta = row.original;
          const collapsed = !!tlCollapsed[meta.groupId];
          if (meta.kind === 'group-header') {
            return (
              <div
                onClick={() => toggleTlCollapsed(meta.groupId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 12,
                  padding: '0 8px',
                  height: '100%',
                  minHeight: 38,
                  fontFamily: 'Space Grotesk, sans-serif',
                  color: '#18181b',
                }}
              >
                <span style={{ fontSize: 9, color: '#71717a', width: 10 }}>
                  {collapsed ? '▶' : '▼'}
                </span>
                {meta.label}
              </div>
            );
          }
          if (meta.kind === 'fachdienst') {
            return (
              <div
                style={{
                  paddingLeft: 20,
                  fontSize: 11,
                  color: '#71717a',
                  display: 'flex',
                  alignItems: 'center',
                  height: '100%',
                }}
              >
                {meta.label}
              </div>
            );
          }
          if (meta.kind === 'bauteil') {
            return (
              <div
                style={{
                  paddingLeft: 36,
                  fontSize: 11,
                  color: '#71717a',
                  display: 'flex',
                  alignItems: 'center',
                  height: '100%',
                }}
              >
                {meta.label}
              </div>
            );
          }
          if (meta.kind === 'funktion') {
            return (
              <div
                style={{
                  paddingLeft: 20,
                  fontSize: 11,
                  color: '#71717a',
                  display: 'flex',
                  alignItems: 'center',
                  height: '100%',
                }}
              >
                {meta.label}
              </div>
            );
          }
          return (
            <div
              style={{
                paddingLeft: 8,
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                height: '100%',
              }}
            >
              {meta.label}
            </div>
          );
        },
      },
    ];

    kwList.forEach((kw) => {
      TL_DAYS.forEach((_, dayIdx) => {
        TL_SHIFTS.forEach((sh) => {
          cols.push({
            id: timelineColId(kw.id, dayIdx, sh.id as ShiftId),
            size: SHIFT_COL_WIDTH,
            header: () => null,
            cell: ({ row }) => {
              const meta = row.original;
              return (
                <TimelineCell
                  kwId={kw.id}
                  dayIdx={dayIdx}
                  shift={sh.id as ShiftId}
                  meta={meta}
                  getSection={getSection}
                  collapsed={!!tlCollapsed[meta.groupId]}
                  onOpen={openSdp}
                  onOpenIntervallePdf={openIntervallePdf}
                />
              );
            },
          });
        });
      });
    });

    return cols;
  }, [kwList, tlCollapsed, toggleTlCollapsed, getSection, openSdp, openIntervallePdf]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const allCols = table.getAllColumns();
  const shiftCols = allCols.slice(1) as Column<TlRowMeta>[];
  const shiftColWidth = SHIFT_COL_WIDTH;
  const totalColWidth = shiftCols.length * shiftColWidth;

  if (!kwList.length) {
    return (
      <div style={{ padding: '40px 24px', color: '#71717a', fontSize: 13 }}>
        Noch keine Kalenderwochen vorhanden. Bitte &quot;+ KW hinzufügen&quot; verwenden.
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      style={{
        overflow: 'auto',
        border: '1px solid #e4e4e7',
        borderRadius: 8,
        background: '#fff',
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        width: '100%',
      }}
    >
      <table
        style={{
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          minWidth: LABEL_COL_WIDTH + totalColWidth,
        }}
      >
        <TimelineThead
          kwList={kwList}
          labelColWidth={LABEL_COL_WIDTH}
          onShiftHeaderClick={handleShiftHeaderClick}
        />
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <TimelineBodyRow
              key={row.id}
              row={row}
              shiftCols={shiftCols}
              labelColWidth={LABEL_COL_WIDTH}
              shiftColWidth={shiftColWidth}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
