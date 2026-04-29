import { useMemo, useRef, useCallback, useEffect, type MouseEvent } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  type ColumnDef,
  type Row,
  type Column,
  flexRender,
} from '@tanstack/react-table';
import { usePlannerStore } from '@/stores/plannerStore';
import { useStammdatenStore } from '@/stores/stammdatenStore';
import { useUiStore, type SelectedCell } from '@/stores/uiStore';
import {
  useTimelineSelectionStore,
  makeBadgeRef,
  badgeKey,
} from '@/stores/timelineSelectionStore';
import { handleTimelineGridKeyDown } from '@/lib/timelineBulkActions';
import {
  getItemLabel,
  chipClassFromResStatus,
  chipTitle,
  getUsedFachdienste,
  getBauteileInUseForFachdienst,
  getUsedPersonalFunctions,
  getTasksByFachdienstBauteil,
  getPersonalByFunktion,
} from '@/lib/workItemHelpers';
import { tlDayHeader } from '@/lib/dateHelpers';
import { isHttpUrl, intervallePdfUrl } from '@/lib/utils';
import type { KalenderWoche, SdpSection, ShiftId, TaskItem, PersonalItem } from '@/types';
import { TL_DAYS, TL_SHIFTS } from '@/types';
import type { TlRowMeta } from '@/types/timeline';

// ─── Column id format ────────────────────────────────────────────────────────

function colId(kwId: string, dayIdx: number, shiftId: ShiftId): string {
  return `kw:${kwId}:d:${dayIdx}:s:${shiftId}`;
}

// ─── Chip component ──────────────────────────────────────────────────────────

function Chip({
  item,
  section,
  selected,
  onIntervalleClick,
  onSelectMouseDown,
}: {
  item: unknown;
  section: SdpSection;
  selected?: boolean;
  onIntervalleClick?: (e: MouseEvent) => void;
  onSelectMouseDown?: (e: MouseEvent) => void;
}) {
  const it = item as Record<string, unknown>;
  const cls = chipClassFromResStatus(it, section);
  const label = getItemLabel(it, section).substring(0, 14);
  const tip = chipTitle(it, section) || label;
  const interactive = !!(onIntervalleClick || onSelectMouseDown);
  return (
    <span
      className={cls}
      title={tip}
      role={interactive ? 'button' : undefined}
      onMouseDown={(e) => {
        if (onSelectMouseDown) {
          e.stopPropagation();
          onSelectMouseDown(e);
        } else if (onIntervalleClick) {
          e.stopPropagation();
        }
      }}
      onClick={
        onIntervalleClick
          ? (e) => {
              e.stopPropagation();
              onIntervalleClick(e);
            }
          : onSelectMouseDown
            ? (e) => e.stopPropagation()
            : undefined
      }
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '1px 5px', borderRadius: 9999, fontSize: 10, fontWeight: 500,
        whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%',
        margin: '1px 0',
        cursor: interactive ? 'pointer' : undefined,
        boxShadow: selected ? '0 0 0 2px #FF6300' : undefined,
      }}
    >
      <span className="chip-dot" style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0 }} />
      {label}
    </span>
  );
}

// ─── TimelineGrid ────────────────────────────────────────────────────────────

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

  // ─── Build rows ──────────────────────────────────────────────────

  const rows: TlRowMeta[] = useMemo(() => {
    const result: TlRowMeta[] = [];

    const GROUPS: { id: SdpSection; label: string }[] = [
      { id: 'intervalle', label: 'Intervalle' },
      { id: 'tasks', label: 'Tätigkeiten' },
      { id: 'personal', label: 'Personal' },
      { id: 'inventar', label: 'Inventar' },
      { id: 'material', label: 'Material' },
      { id: 'fremdleistung', label: 'Fremdleistung' },
    ];

    GROUPS.forEach(({ id, label }) => {
      if (!tlFilter[id]) return;

      const collapsed = !!tlCollapsed[id];
      const hasChildren = id === 'tasks' || id === 'personal';

      if (hasChildren) {
        result.push({ kind: 'group-header', sectionId: id, groupId: id, label });
        if (!collapsed) {
          if (id === 'tasks') {
            usedFachdienste.forEach((fd) => {
              if (fachdienstTlFilter[fd] === false) return;
              result.push({ kind: 'fachdienst', sectionId: 'tasks', groupId: id, label: fd, fachdienst: fd });
              const bauteile = getBauteileInUseForFachdienst(workItems, fd, fachdienstBauteile[fd] ?? []);
              bauteile.forEach((bt) => {
                result.push({ kind: 'bauteil', sectionId: 'tasks', groupId: id, label: bt, fachdienst: fd, bauteil: bt });
              });
            });
          }
          if (id === 'personal') {
            usedFunktionen.forEach((fn) => {
              result.push({ kind: 'funktion', sectionId: 'personal', groupId: id, label: fn, funktion: fn });
            });
          }
        }
      } else {
        result.push({ kind: 'simple', sectionId: id, groupId: id, label });
      }
    });

    return result;
  }, [tlFilter, fachdienstTlFilter, tlCollapsed, usedFachdienste, usedFunktionen, workItems, fachdienstBauteile]);

  // ─── Build columns ───────────────────────────────────────────────

  const columns = useMemo<ColumnDef<TlRowMeta>[]>(() => {
    const cols: ColumnDef<TlRowMeta>[] = [
      {
        id: 'label',
        header: 'Ressource',
        size: 250,
        cell: ({ row }) => {
          const meta = row.original;
          const collapsed = !!tlCollapsed[meta.groupId];
          if (meta.kind === 'group-header') {
            return (
              <div
                onClick={() => toggleTlCollapsed(meta.groupId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  cursor: 'pointer', fontWeight: 600, fontSize: 12,
                  padding: '0 8px', height: '100%', minHeight: 38,
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
              <div style={{ paddingLeft: 20, fontSize: 11, color: '#71717a', display: 'flex', alignItems: 'center', height: '100%' }}>
                {meta.label}
              </div>
            );
          }
          if (meta.kind === 'bauteil') {
            return (
              <div style={{ paddingLeft: 36, fontSize: 11, color: '#71717a', display: 'flex', alignItems: 'center', height: '100%' }}>
                {meta.label}
              </div>
            );
          }
          if (meta.kind === 'funktion') {
            return (
              <div style={{ paddingLeft: 20, fontSize: 11, color: '#71717a', display: 'flex', alignItems: 'center', height: '100%' }}>
                {meta.label}
              </div>
            );
          }
          return (
            <div style={{ paddingLeft: 8, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', height: '100%' }}>
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
            id: colId(kw.id, dayIdx, sh.id as ShiftId),
            size: 88,
            header: () => null,
            cell: ({ row }) => {
              const meta = row.original;
              return (
                <TlCell
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

  // ─── Table instance ──────────────────────────────────────────────

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  // All shift columns are rendered (horizontal virtualizer was empty when flex gave the scroller width 0).

  const scrollRef = useRef<HTMLDivElement>(null);
  const allCols = table.getAllColumns();
  const shiftCols = allCols.slice(1) as Column<TlRowMeta>[];

  const labelColWidth = 250;
  const shiftColWidth = 88;
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
          minWidth: labelColWidth + totalColWidth,
        }}
      >
        <TimelineThead
          kwList={kwList}
          labelColWidth={labelColWidth}
          onShiftHeaderClick={handleShiftHeaderClick}
        />
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <TlBodyRow
              key={row.id}
              row={row}
              shiftCols={shiftCols}
              labelColWidth={labelColWidth}
              shiftColWidth={shiftColWidth}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Body row component ──────────────────────────────────────────────────────

function TlBodyRow({
  row,
  shiftCols,
  labelColWidth,
  shiftColWidth,
}: {
  row: Row<TlRowMeta>;
  shiftCols: Column<TlRowMeta>[];
  labelColWidth: number;
  shiftColWidth: number;
}) {
  const meta = row.original;
  const isGroupHeader = meta.kind === 'group-header';
  const isL1 = meta.kind === 'fachdienst';

  const labelCell = row.getVisibleCells().find((c) => c.column.id === 'label');

  /** Full-width row band: same fill on every cell (sticky label + scrollable shifts). */
  const rowBackground = isGroupHeader
    ? '#e8ebef'
    : isL1
      ? '#f6f7f8'
      : '#fff';
  const rowBorderTop = isGroupHeader ? '1px solid #cfd4dc' : undefined;
  const rowBorderBottom = isGroupHeader ? '1px solid #cfd4dc' : '1px solid #e4e4e7';

  return (
    <tr
      style={{
        height: isGroupHeader ? 38 : 36,
        ...(isGroupHeader ? { background: rowBackground } : undefined),
      }}
    >
      <td
        style={{
          width: labelColWidth,
          position: 'sticky', left: 0, zIndex: 2,
          background: rowBackground,
          borderTop: rowBorderTop,
          borderBottom: rowBorderBottom,
          borderRight: '1px solid #e4e4e7',
          ...(isGroupHeader ? { borderLeft: '3px solid #FF6300' } : {}),
          padding: 0, overflow: 'hidden',
        }}
      >
        {labelCell ? flexRender(labelCell.column.columnDef.cell, labelCell.getContext()) : null}
      </td>

      {shiftCols.map((col) => {
        const cell = row.getVisibleCells().find((c) => c.column.id === col.id);
        if (!cell) return null;
        return (
          <td
            key={col.id}
            style={{
              width: shiftColWidth,
              background: rowBackground,
              borderTop: rowBorderTop,
              borderBottom: rowBorderBottom,
              padding: 0,
              borderRight: '1px solid #f0f0f0',
              verticalAlign: 'top',
              cursor: 'pointer',
            }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        );
      })}
    </tr>
  );
}

// ─── TlCell ──────────────────────────────────────────────────────────────────

function TlCell({
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
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: '1px 7px', borderRadius: 9999, fontSize: 10, fontWeight: 600,
              background: '#fff', color: '#52525b', border: '1px solid #d4d4d8',
            }}>
              {count}
            </span>
          )}
        </div>
      );
    }
    return <div onClick={handleCellBackground} style={{ height: '100%', minHeight: 36, cursor: 'pointer' }} />;
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
        padding: '3px 5px', height: '100%', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 1, justifyContent: 'flex-start',
      }}
    >
      {items.map((it, idx) => {
        if (idx >= 3) return null;
        const ref = makeBadgeRef(it, kwId, dayIdx, shift, meta);
        const sel =
          ref != null && selected.some((r) => badgeKey(r) === badgeKey(ref));
        return (
          <Chip
            key={(it as Record<string, unknown>).id as string ?? idx}
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
        <span style={{ fontSize: 9, color: '#71717a', paddingLeft: 2 }}>+{items.length - 3}</span>
      )}
    </div>
  );
}

// ─── Custom 3-row thead ──────────────────────────────────────────────────────

const COLS_PER_KW = TL_DAYS.length * TL_SHIFTS.length;

function TimelineThead({
  kwList,
  labelColWidth,
  onShiftHeaderClick,
}: {
  kwList: KalenderWoche[];
  labelColWidth: number;
  onShiftHeaderClick: (kwId: string, dayIdx: number, shift: ShiftId) => void;
}) {
  return (
    <thead>
      {/* Row 1: KW banners */}
      <tr style={{ background: '#f4f4f5' }}>
        <th
          rowSpan={3}
          style={{
            width: labelColWidth, position: 'sticky', left: 0, zIndex: 3,
            background: '#f4f4f5', textAlign: 'left', padding: '0 8px',
            fontSize: 11, fontWeight: 600,
            borderBottom: '1px solid #e4e4e7', borderRight: '1px solid #e4e4e7',
          }}
        >
          Ressource
        </th>
        {kwList.map((kw, i) => (
          <th
            key={kw.id}
            colSpan={COLS_PER_KW}
            style={{
              textAlign: 'center', fontSize: 11, fontWeight: 700,
              padding: '4px 8px', borderBottom: '1px solid #e4e4e7',
              borderLeft: i > 0 ? '2px solid #e4e4e7' : undefined,
              fontFamily: 'Space Grotesk, sans-serif',
              background: '#f4f4f5',
            }}
          >
            {kw.label}
          </th>
        ))}
      </tr>

      {/* Row 2: Day headers */}
      <tr style={{ background: '#fafafa' }}>
        {kwList.flatMap((kw) =>
          TL_DAYS.map((_, dayIdx) => {
            const { day, date } = tlDayHeader(kw, dayIdx);
            const isKwStart = dayIdx === 0;
            return (
              <th
                key={`${kw.id}-day-${dayIdx}`}
                colSpan={2}
                style={{
                  textAlign: 'center', fontSize: 10, padding: '3px 4px',
                  borderBottom: '1px solid #e4e4e7',
                  borderLeft: isKwStart ? '2px solid #e4e4e7' : '1px solid #f0f0f0',
                  background: '#fafafa', whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontWeight: 600 }}>{day}</span>
                {date && <span style={{ color: '#71717a', marginLeft: 3 }}>{date}</span>}
              </th>
            );
          }),
        )}
      </tr>

      {/* Row 3: T/N shift headers */}
      <tr style={{ background: '#fff' }}>
        {kwList.flatMap((kw) => {
          let g = 0;
          return TL_DAYS.flatMap((_, dayIdx) =>
            TL_SHIFTS.map((sh) => {
              const isKwStart = g % COLS_PER_KW === 0;
              const isDayStart = g % 2 === 0;
              g += 1;
              return (
                <th
                  key={`${kw.id}-${dayIdx}-${sh.id}`}
                  title="Schicht im Panel bearbeiten"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShiftHeaderClick(kw.id, dayIdx, sh.id as ShiftId);
                  }}
                  style={{
                    textAlign: 'center', fontSize: 9, fontWeight: 600, padding: '2px',
                    borderBottom: '2px solid #e4e4e7',
                    borderLeft: isKwStart ? '2px solid #e4e4e7' : isDayStart ? '1px solid #f0f0f0' : 'none',
                    color: sh.id === 'N' ? '#1d4ed8' : '#374151',
                    background: sh.id === 'N' ? '#eff6ff' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  {sh.id}
                </th>
              );
            }),
          );
        })}
      </tr>
    </thead>
  );
}
