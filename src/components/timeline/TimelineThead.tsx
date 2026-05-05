import { tlDayHeader } from '@/lib/dateHelpers';
import type { KalenderWoche, ShiftId } from '@/types';
import { TL_DAYS, TL_SHIFTS } from '@/types';
import { COLS_PER_KW } from './timelineConstants';

export function TimelineThead({
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
      <tr style={{ background: '#f4f4f5' }}>
        <th
          rowSpan={3}
          style={{
            width: labelColWidth,
            position: 'sticky',
            left: 0,
            zIndex: 3,
            background: '#f4f4f5',
            textAlign: 'left',
            padding: '0 8px',
            fontSize: 11,
            fontWeight: 600,
            borderBottom: '1px solid #e4e4e7',
            borderRight: '1px solid #e4e4e7',
          }}
        >
          Ressource
        </th>
        {kwList.map((kw, i) => (
          <th
            key={kw.id}
            colSpan={COLS_PER_KW}
            style={{
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 8px',
              borderBottom: '1px solid #e4e4e7',
              borderLeft: i > 0 ? '2px solid #e4e4e7' : undefined,
              fontFamily: 'Space Grotesk, sans-serif',
              background: '#f4f4f5',
            }}
          >
            {kw.label}
          </th>
        ))}
      </tr>

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
                  textAlign: 'center',
                  fontSize: 10,
                  padding: '3px 4px',
                  borderBottom: '1px solid #e4e4e7',
                  borderLeft: isKwStart ? '2px solid #e4e4e7' : '1px solid #f0f0f0',
                  background: '#fafafa',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontWeight: 600 }}>{day}</span>
                {date && <span style={{ color: '#71717a', marginLeft: 3 }}>{date}</span>}
              </th>
            );
          }),
        )}
      </tr>

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
                    textAlign: 'center',
                    fontSize: 9,
                    fontWeight: 600,
                    padding: '2px',
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
