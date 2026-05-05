import { flexRender, type Column, type Row } from '@tanstack/react-table';
import type { TlRowMeta } from '@/types/timeline';

export function TimelineBodyRow({
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

  const rowBackground = isGroupHeader ? '#e8ebef' : isL1 ? '#f6f7f8' : '#fff';
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
          position: 'sticky',
          left: 0,
          zIndex: 2,
          background: rowBackground,
          borderTop: rowBorderTop,
          borderBottom: rowBorderBottom,
          borderRight: '1px solid #e4e4e7',
          ...(isGroupHeader ? { borderLeft: '3px solid #FF6300' } : {}),
          padding: 0,
          overflow: 'hidden',
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
