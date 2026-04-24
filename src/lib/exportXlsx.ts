import * as XLSX from 'xlsx';
import type { KalenderWoche, WorkItems, SdpSection } from '@/types';
import { TL_DAYS, TL_SHIFTS, SDP_SECTIONS } from '@/types';

const SECTION_LABELS: Record<SdpSection, string> = {
  intervalle: 'Intervalle',
  tasks: 'Tätigkeiten',
  personal: 'Personal',
  inventar: 'Inventar',
  material: 'Material',
  fremdleistung: 'Fremdleistung',
};

function wiKey(kwId: string, dayIdx: number, shiftId: string): string {
  return `${kwId}__${dayIdx}__${shiftId}`;
}

export function exportXlsx(
  projectName: string,
  kwList: KalenderWoche[],
  workItems: WorkItems,
): void {
  const wb = XLSX.utils.book_new();

  SDP_SECTIONS.forEach((section) => {
    const rows: (string | number)[][] = [];
    // Header row
    const header: string[] = ['KW', 'Tag', 'Schicht'];
    const firstRow = Object.values(workItems)
      .flatMap((cell) => (cell[section] ?? []) as unknown as Record<string, unknown>[])
      .find(Boolean);
    const keys = firstRow
      ? Object.keys(firstRow).filter((k) => !k.startsWith('_') && k !== 'id')
      : ['value'];
    keys.forEach((k) => header.push(k));
    rows.push(header);

    kwList.forEach((kw) => {
      TL_DAYS.forEach((day, dayIdx) => {
        TL_SHIFTS.forEach((sh) => {
          const key = wiKey(kw.id, dayIdx, sh.id);
          const cell = workItems[key];
          const items = (cell?.[section] ?? []) as unknown as Record<string, unknown>[];
          items.forEach((item) => {
            const row: (string | number)[] = [kw.label, day, sh.id === 'T' ? 'Tag' : 'Nacht'];
            keys.forEach((k) => {
              const val = item[k];
              row.push(val != null ? String(val) : '');
            });
            rows.push(row);
          });
        });
      });
    });

    if (rows.length > 1) {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, SECTION_LABELS[section].substring(0, 31));
    }
  });

  const filename = `Schichtplanung_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
