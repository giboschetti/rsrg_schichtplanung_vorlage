import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { KalenderWoche, WorkItems, SdpSection, ShiftId } from '@/types';
import { TL_DAYS, TL_SHIFTS, SDP_SECTIONS } from '@/types';
import { tlDayPlain } from './dateHelpers';

const SECTION_LABELS: Record<SdpSection, string> = {
  intervalle: 'Intervalle',
  tasks: 'Tätigkeiten',
  personal: 'Personal',
  inventar: 'Inventar',
  material: 'Material',
  fremdleistung: 'Fremdleistung',
};

const SECTION_COLUMNS: Record<SdpSection, string[]> = {
  intervalle: ['BAB-Nr', 'BAB Titel', 'Status', 'Von Datum', 'Von Zeit', 'Bis Datum', 'Bis Zeit'],
  tasks: ['Fachdienst', 'Bauteil', 'Tätigkeit', 'Beschreibung', 'Ort', 'Status'],
  personal: ['Funktion', 'Name', 'Status', 'Bemerkung'],
  inventar: ['Gerät / Inventar', 'Anzahl', 'Status', 'Bemerkung'],
  material: ['Material', 'Menge', 'Einheit', 'Status', 'Bemerkung'],
  fremdleistung: ['Firma', 'Leistung', 'Status', 'Bemerkung'],
};

const SECTION_KEYS: Record<SdpSection, string[]> = {
  intervalle: ['babNr', 'babTitel', 'status', 'vonDatum', 'vonZeit', 'bisDatum', 'bisZeit'],
  tasks: ['fachdienst', 'bauteil', 'taetigkeit', 'beschreibung', 'location', 'resStatus'],
  personal: ['funktion', 'name', 'resStatus', 'bemerkung'],
  inventar: ['geraet', 'anzahl', 'resStatus', 'bemerkung'],
  material: ['material', 'menge', 'einheit', 'resStatus', 'bemerkung'],
  fremdleistung: ['firma', 'leistung', 'resStatus', 'bemerkung'],
};

function wiKey(kwId: string, dayIdx: number, shiftId: string): string {
  return `${kwId}__${dayIdx}__${shiftId}`;
}

export function exportPdf(
  projectName: string,
  kwList: KalenderWoche[],
  workItems: WorkItems,
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let firstPage = true;

  kwList.forEach((kw) => {
    TL_DAYS.forEach((_, dayIdx) => {
      TL_SHIFTS.forEach((sh) => {
        const shiftId = sh.id as ShiftId;
        const key = wiKey(kw.id, dayIdx, shiftId);
        const cell = workItems[key];
        if (!cell) return;

        const hasContent = SDP_SECTIONS.some(
          (s) => (cell[s] ?? []).length > 0,
        );
        if (!hasContent) return;

        if (!firstPage) doc.addPage();
        firstPage = false;

        const dayStr = tlDayPlain(kw, dayIdx);
        const shiftStr = shiftId === 'T' ? 'Tag' : 'Nacht';
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`${kw.label} — ${dayStr} — ${shiftStr}`, 14, 14);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(projectName, 14, 20);

        let yPos = 26;

        SDP_SECTIONS.forEach((section) => {
          const items = (cell[section] ?? []) as unknown as Record<string, unknown>[];
          if (!items.length) return;

          const keys = SECTION_KEYS[section];
          const cols = SECTION_COLUMNS[section];
          const tableData = items.map((item) =>
            keys.map((k) => (item[k] != null ? String(item[k]) : '')),
          );

          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(SECTION_LABELS[section], 14, yPos);
          yPos += 4;

          autoTable(doc, {
            startY: yPos,
            head: [cols],
            body: tableData,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [255, 99, 0], textColor: 255, fontStyle: 'bold' },
            margin: { left: 14, right: 14 },
            didDrawPage: (data) => {
              yPos = (data.cursor?.y ?? yPos) + 6;
            },
          });

          // jspdf-autotable adds lastAutoTable to the doc object at runtime
          const lastTable = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
          yPos = lastTable?.finalY ? lastTable.finalY + 6 : yPos + 6;
        });
      });
    });
  });

  const filename = `Schichtplanung_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
