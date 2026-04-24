import { useMemo, useRef, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  type ColumnDef,
  type Row,
  type Column,
  flexRender,
} from '@tanstack/react-table';
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import { usePlannerStore } from '@/stores/plannerStore';
import { useStammdatenStore } from '@/stores/stammdatenStore';
import { useUiStore } from '@/stores/uiStore';
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
import type {
  KalenderWoche,
  SdpSection,
  ShiftId,
  TaskItem,
  PersonalItem,
} from '@/types';
import { TL_DAYS, TL_SHIFTS } from '@/types';

// ─── Row types ──────────────────────────────────────────────────────────────

type RowKind =
  | 'group-header'
  | 'fachdienst'
  | 'bauteil'
  | 'funktion'
  | 'simple';

interface TlRowMeta {
  kind: RowKind;
  sectionId: SdpSection;
  groupId: string;
  label: string;
  fachdienst?: string;
  bauteil?: string;
  funktion?: string;
}

// ─── Column id format ────────────────────────────────────────────────────────

function colId(kwId: string, dayIdx: number, shiftId: ShiftId): string {
  return `kw:${kwId}:d:${dayIdx}:s:${shiftId}`;
}

// ─── Chip component ──────────────────────────────────────────────────────────

function Chip({ item, section }: { item: unknown; section: SdpSection }) {
  const it = item as Record<string, unknown>;
  const cls = chipClassFromResStatus(it, section);
  const label = getItemLabel(it, section).substring(0, 14);
  const tip = chipTitle(it, section) || label;
  return (
    <span
      className={cls}
      title={tip}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '1px 5px', borderRadius: 9999, fontSize: 10, fontWeight: 500,
        whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%',
        margin: '1px 0',
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
  const tlCollapsed = useUiStore((s) => s.tlCollapsed);
  const toggleTlCollapsed = useUiStore((s) => s.toggleTlCollapsed);
  const openSdp = useUiStore((s) => s.openSdp);

  const usedFachdienste = useMemo(() => getUsedFachdienste(workItems), [workItems]);
  const usedFunktionen = useMemo(() => getUsedPersonalFunctions(workItems), [workItems]);

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
  }, [tlFilter, tlCollapsed, usedFachdienste, usedFunktionen, workItems, fachdienstBauteile]);

  // ─── Build columns ───────────────────────────────────────────────

  const columns = useMemo<ColumnDef<TlRowMeta>[]>(() => {
    const cols: ColumnDef<TlRowMeta>[] = [
      {
        id: 'label',
        header: 'Ressource',
        size: 160,
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
                  padding: '0 8px', height: '100%',
                  fontFamily: 'Space Grotesk, sans-serif',
                  color: '#09090b',
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
                />
              );
            },
          });
        });
      });
    });

    return cols;
  }, [kwList, tlCollapsed, toggleTlCollapsed, getSection, openSdp]);

  // ─── Table instance ──────────────────────────────────────────────

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  // ─── Column virtualizer ──────────────────────────────────────────

  const scrollRef = useRef<HTMLDivElement>(null);
  const allCols = table.getAllColumns();
  const shiftCols = allCols.slice(1) as Column<TlRowMeta>[];

  const colVirtualizer = useVirtualizer({
    count: shiftCols.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 88,
    horizontal: true,
    overscan: 4,
  });

  const virtualCols = colVirtualizer.getVirtualItems();
  const totalColWidth = colVirtualizer.getTotalSize();
  const labelColWidth = 160;

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
          virtualCols={virtualCols}
          labelColWidth={labelColWidth}
          totalColWidth={totalColWidth}
        />
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <TlBodyRow
              key={row.id}
              row={row}
              virtualCols={virtualCols}
              shiftCols={shiftCols}
              labelColWidth={labelColWidth}
              totalColWidth={totalColWidth}
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
  virtualCols,
  shiftCols,
  labelColWidth,
  totalColWidth,
}: {
  row: Row<TlRowMeta>;
  virtualCols: VirtualItem[];
  shiftCols: Column<TlRowMeta>[];
  labelColWidth: number;
  totalColWidth: number;
}) {
  const meta = row.original;
  const isParent = meta.kind === 'group-header';
  const isL1 = meta.kind === 'fachdienst';

  const labelCell = row.getVisibleCells().find((c) => c.column.id === 'label');
  const last = virtualCols.length > 0 ? virtualCols[virtualCols.length - 1] : null;
  const trailWidth = last ? totalColWidth - (last.start + last.size) : 0;
  const leadWidth = virtualCols.length > 0 ? virtualCols[0].start : 0;

  const bgColor = isParent ? '#f4f4f5' : isL1 ? '#fafafa' : '#fff';

  return (
    <tr style={{ height: 36 }}>
      <td
        style={{
          width: labelColWidth,
          position: 'sticky', left: 0, zIndex: 2,
          background: bgColor,
          borderBottom: '1px solid #e4e4e7',
          borderRight: '1px solid #e4e4e7',
          ...(isParent ? { borderLeft: '3px solid #FF6300' } : {}),
          padding: 0, overflow: 'hidden',
        }}
      >
        {labelCell ? flexRender(labelCell.column.columnDef.cell, labelCell.getContext()) : null}
      </td>

      {leadWidth > 0 && (
        <td style={{ width: leadWidth, padding: 0, borderBottom: '1px solid #e4e4e7' }} />
      )}

      {virtualCols.map((vc) => {
        const col = shiftCols[vc.index];
        if (!col) return null;
        const cell = row.getVisibleCells().find((c) => c.column.id === col.id);
        if (!cell) return null;
        return (
          <td
            key={String(vc.key)}
            style={{
              width: vc.size,
              padding: 0,
              borderBottom: '1px solid #e4e4e7',
              borderRight: '1px solid #f0f0f0',
              verticalAlign: 'top',
              cursor: 'pointer',
            }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        );
      })}

      {trailWidth > 0 && (
        <td style={{ width: trailWidth, padding: 0, borderBottom: '1px solid #e4e4e7' }} />
      )}
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
}: {
  kwId: string;
  dayIdx: number;
  shift: ShiftId;
  meta: TlRowMeta;
  getSection: <T>(kwId: string, dayIdx: number, shift: ShiftId, section: SdpSection) => T[];
  collapsed: boolean;
  onOpen: (cell: { kwId: string; dayIdx: number; shift: ShiftId; grp?: SdpSection }) => void;
}) {
  const handleClick = useCallback(() => {
    onOpen({ kwId, dayIdx, shift, grp: meta.sectionId });
  }, [kwId, dayIdx, shift, meta.sectionId, onOpen]);

  if (meta.kind === 'group-header') {
    if (collapsed) {
      const allItems = getSection<unknown>(kwId, dayIdx, shift, meta.sectionId);
      const count = allItems.length;
      return (
        <div onClick={handleClick} style={{ padding: '4px 6px', height: '100%', cursor: 'pointer' }}>
          {count > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              padding: '1px 7px', borderRadius: 9999, fontSize: 10, fontWeight: 600,
              background: '#f4f4f5', color: '#71717a',
            }}>
              {count}
            </span>
          )}
        </div>
      );
    }
    return <div onClick={handleClick} style={{ height: '100%', cursor: 'pointer' }} />;
  }

  if (meta.kind === 'fachdienst') {
    return <div onClick={handleClick} style={{ height: '100%', cursor: 'pointer' }} />;
  }

  let items: unknown[] = [];

  if (meta.kind === 'bauteil') {
    const tasks = getSection<TaskItem>(kwId, dayIdx, shift, 'tasks');
    items = getTasksByFachdienstBauteil(tasks, meta.fachdienst!, meta.bauteil!);
  } else if (meta.kind === 'funktion') {
    const personal = getSection<PersonalItem>(kwId, dayIdx, shift, 'personal');
    items = getPersonalByFunktion(personal, meta.funktion!);
  } else {
    items = getSection<unknown>(kwId, dayIdx, shift, meta.sectionId);
  }

  return (
    <div
      onClick={handleClick}
      style={{
        padding: '3px 5px', height: '100%', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 1, justifyContent: 'flex-start',
      }}
    >
      {items.slice(0, 3).map((it, i) => (
        <Chip key={(it as Record<string, unknown>).id as string ?? i} item={it} section={meta.sectionId} />
      ))}
      {items.length > 3 && (
        <span style={{ fontSize: 9, color: '#71717a', paddingLeft: 2 }}>+{items.length - 3}</span>
      )}
    </div>
  );
}

// ─── Custom 3-row thead ──────────────────────────────────────────────────────

interface ColMeta {
  kwId: string;
  kwLabel: string;
  dayIdx: number;
  shift: ShiftId;
}

function TimelineThead({
  kwList,
  virtualCols,
  labelColWidth,
  totalColWidth,
}: {
  kwList: KalenderWoche[];
  virtualCols: VirtualItem[];
  labelColWidth: number;
  totalColWidth: number;
}) {
  const colMeta: ColMeta[] = useMemo(() => {
    const result: ColMeta[] = [];
    kwList.forEach((kw) => {
      TL_DAYS.forEach((_, dayIdx) => {
        TL_SHIFTS.forEach((sh) => {
          result.push({ kwId: kw.id, kwLabel: kw.label, dayIdx, shift: sh.id as ShiftId });
        });
      });
    });
    return result;
  }, [kwList]);

  const last = virtualCols.length > 0 ? virtualCols[virtualCols.length - 1] : null;
  const trailWidth = last ? totalColWidth - (last.start + last.size) : 0;
  const leadWidth = virtualCols.length > 0 ? virtualCols[0].start : 0;

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
        {leadWidth > 0 && <th rowSpan={3} style={{ width: leadWidth }} />}
        {(() => {
          // Group virtualCols by KW
          const kwGroups: { kwId: string; kwLabel: string; vcs: VirtualItem[] }[] = [];
          virtualCols.forEach((vc) => {
            const cm = colMeta[vc.index];
            if (!cm) return;
            const existing = kwGroups.find((g) => g.kwId === cm.kwId);
            if (existing) existing.vcs.push(vc);
            else kwGroups.push({ kwId: cm.kwId, kwLabel: cm.kwLabel, vcs: [vc] });
          });
          return kwGroups.map((g, i) => (
            <th
              key={g.kwId}
              colSpan={g.vcs.length}
              style={{
                textAlign: 'center', fontSize: 11, fontWeight: 700,
                padding: '4px 8px', borderBottom: '1px solid #e4e4e7',
                borderLeft: i > 0 ? '2px solid #e4e4e7' : undefined,
                fontFamily: 'Space Grotesk, sans-serif',
                background: '#f4f4f5',
              }}
            >
              {g.kwLabel}
            </th>
          ));
        })()}
        {trailWidth > 0 && <th rowSpan={3} style={{ width: trailWidth }} />}
      </tr>

      {/* Row 2: Day headers */}
      <tr style={{ background: '#fafafa' }}>
        {(() => {
          const dayHeaders: { vc: VirtualItem; cm: ColMeta }[] = [];
          virtualCols.forEach((vc) => {
            const cm = colMeta[vc.index];
            if (!cm || vc.index % 2 !== 0) return;
            dayHeaders.push({ vc, cm });
          });
          return dayHeaders.map(({ vc, cm }) => {
            const kw = kwList.find((k) => k.id === cm.kwId);
            const { day, date } = tlDayHeader(kw, cm.dayIdx);
            const isKwStart = vc.index % 14 === 0;
            return (
              <th
                key={String(vc.key)}
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
          });
        })()}
      </tr>

      {/* Row 3: T/N shift headers */}
      <tr style={{ background: '#fff' }}>
        {virtualCols.map((vc) => {
          const cm = colMeta[vc.index];
          if (!cm) return null;
          const isKwStart = vc.index % 14 === 0;
          const isDayStart = vc.index % 2 === 0;
          return (
            <th
              key={String(vc.key)}
              style={{
                textAlign: 'center', fontSize: 9, fontWeight: 600, padding: '2px',
                borderBottom: '2px solid #e4e4e7',
                borderLeft: isKwStart ? '2px solid #e4e4e7' : isDayStart ? '1px solid #f0f0f0' : 'none',
                color: cm.shift === 'N' ? '#1d4ed8' : '#374151',
                background: cm.shift === 'N' ? '#eff6ff' : '#fff',
              }}
            >
              {cm.shift}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
