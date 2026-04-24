import { createPortal } from 'react-dom';
import { useUiStore } from '@/stores/uiStore';
import { usePlannerStore } from '@/stores/plannerStore';
import { useStammdatenStore } from '@/stores/stammdatenStore';
import { tlDayPlain } from '@/lib/dateHelpers';
import {
  SDP_SECTIONS,
  SDP_RES_STATUS_VALUES,
  SDP_FUNKTION_VALUES,
  SDP_INTERVALLE_STATUS_VALUES,
  FACHDIENST_VALUES,
  MATERIAL_EINHEIT_VALUES,
} from '@/types';
import type { SdpSection, ShiftId } from '@/types';

// ─── Section configs ─────────────────────────────────────────────────────────

const SECTION_LABELS: Record<SdpSection, string> = {
  intervalle: 'Intervalle',
  tasks: 'Tätigkeiten',
  personal: 'Personal',
  inventar: 'Inventar',
  material: 'Material',
  fremdleistung: 'Fremdleistung',
};

// ─── ShiftDetailPanel ────────────────────────────────────────────────────────

export function ShiftDetailPanel() {
  const sdpOpen = useUiStore((s) => s.sdpOpen);
  const selectedCell = useUiStore((s) => s.selectedCell);
  const closeSdp = useUiStore((s) => s.closeSdp);
  const kwList = usePlannerStore((s) => s.kwList);
  const shiftConfig = useStammdatenStore((s) => s.shiftConfig);

  if (!sdpOpen || !selectedCell) return null;

  const { kwId, dayIdx, shift } = selectedCell;
  const kw = kwList.find((k) => k.id === kwId);
  const dayLabel = tlDayPlain(kw, dayIdx);
  const shiftLabel = shift === 'T'
    ? `Tag (${shiftConfig.tag.von} – ${shiftConfig.tag.bis})`
    : `Nacht (${shiftConfig.nacht.von} – ${shiftConfig.nacht.bis})`;

  return createPortal(
    <>
      {/* Backdrop — portal avoids ancestors with transform/filters breaking position:fixed */}
      <div
        onClick={closeSdp}
        role="presentation"
        style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.08)' }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: '#fff', borderTop: '2px solid #FF6300',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.10)',
        maxHeight: '55vh', overflow: 'auto', pointerEvents: 'auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px', borderBottom: '1px solid #e4e4e7',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1,
        }}>
          <div>
            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 14, color: '#09090b' }}>
              {kw?.label ?? kwId}
            </span>
            <span style={{ color: '#71717a', marginLeft: 8, fontSize: 13 }}>
              {dayLabel} — {shiftLabel}
            </span>
          </div>
          <button onClick={closeSdp} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#71717a', padding: '0 4px' }}>×</button>
        </div>

        {/* Sections */}
        <div style={{ padding: '0 20px 20px' }}>
          {SDP_SECTIONS.map((section) => (
            <SdpSection
              key={section}
              section={section}
              kwId={kwId}
              dayIdx={dayIdx}
              shift={shift}
              defaultExpanded={section === (selectedCell.grp ?? 'tasks')}
            />
          ))}
        </div>
      </div>
    </>,
    document.body,
  );
}

// ─── SdpSection (collapsible section with editable table) ───────────────────

function SdpSection({
  section,
  kwId,
  dayIdx,
  shift,
  defaultExpanded,
}: {
  section: SdpSection;
  kwId: string;
  dayIdx: number;
  shift: ShiftId;
  defaultExpanded: boolean;
}) {
  const getSection = usePlannerStore((s) => s.getSection);
  const setSection = usePlannerStore((s) => s.setSection);

  const rows = getSection<Record<string, unknown>>(kwId, dayIdx, shift, section);
  const count = rows.length;

  function addRow() {
    const newRow = { id: Math.random().toString(36).slice(2) };
    setSection(kwId, dayIdx, shift, section, [...rows, newRow]);
  }

  function updateRow(idx: number, key: string, value: unknown) {
    const updated = rows.map((r, i) => i === idx ? { ...r, [key]: value } : r);
    setSection(kwId, dayIdx, shift, section, updated);
  }

  function deleteRow(idx: number) {
    setSection(kwId, dayIdx, shift, section, rows.filter((_, i) => i !== idx));
  }

  return (
    <details
      open={defaultExpanded}
      style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 4 }}
    >
      <summary style={{
        cursor: 'pointer', padding: '10px 0', listStyle: 'none',
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 13,
        userSelect: 'none',
      }}>
        <span style={{ fontSize: 10, color: '#71717a' }}>▼</span>
        {SECTION_LABELS[section]}
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18, borderRadius: '50%',
          background: count > 0 ? '#FF6300' : '#e4e4e7',
          color: count > 0 ? '#fff' : '#71717a',
          fontSize: 10, fontWeight: 700,
        }}>
          {count}
        </span>
      </summary>

      <div style={{ paddingBottom: 8 }}>
        <SdpTable
          section={section}
          rows={rows}
          onUpdate={updateRow}
          onDelete={deleteRow}
        />
        <button
          onClick={addRow}
          style={{
            marginTop: 8, padding: '4px 12px', borderRadius: 5,
            border: '1px dashed #e4e4e7', background: '#fff',
            fontSize: 12, cursor: 'pointer', color: '#71717a',
          }}
        >
          + Zeile
        </button>
      </div>
    </details>
  );
}

// ─── SdpTable ────────────────────────────────────────────────────────────────

function SdpTable({
  section,
  rows,
  onUpdate,
  onDelete,
}: {
  section: SdpSection;
  rows: Record<string, unknown>[];
  onUpdate: (idx: number, key: string, value: unknown) => void;
  onDelete: (idx: number) => void;
}) {
  const fachdienstBauteile = useStammdatenStore((s) => s.fachdienstBauteile);

  const columns = getSdpColumns(section, fachdienstBauteile);

  if (rows.length === 0) {
    return <div style={{ fontSize: 12, color: '#71717a', padding: '8px 0' }}>Keine Einträge</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f9f9fa' }}>
            <th style={{ width: 32, borderBottom: '1px solid #e4e4e7' }} />
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: 'left', padding: '5px 8px',
                  borderBottom: '1px solid #e4e4e7', fontWeight: 600,
                  color: '#71717a', fontSize: 11, whiteSpace: 'nowrap',
                  width: col.width,
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={String(row.id ?? idx)} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ textAlign: 'center', padding: '4px 4px', verticalAlign: 'middle' }}>
                <button
                  onClick={() => onDelete(idx)}
                  style={{
                    border: 'none', background: 'none', cursor: 'pointer',
                    color: '#DC002E', fontSize: 12, padding: '1px 4px', lineHeight: 1,
                  }}
                  title="Zeile löschen"
                >
                  ✕
                </button>
              </td>
              {columns.map((col) => (
                <td key={col.key} style={{ padding: '3px 4px', verticalAlign: 'middle' }}>
                  <SdpCell
                    colDef={col}
                    value={row[col.key]}
                    row={row}
                    onChange={(val) => onUpdate(idx, col.key, val)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── SdpCell ─────────────────────────────────────────────────────────────────

type ColType = 'text' | 'number' | 'select' | 'date' | 'time' | 'bauteil-select';

interface ColDef {
  key: string;
  label: string;
  type: ColType;
  options?: string[];
  width?: number;
}

function SdpCell({
  colDef,
  value,
  row,
  onChange,
}: {
  colDef: ColDef;
  value: unknown;
  row: Record<string, unknown>;
  onChange: (val: unknown) => void;
}) {
  const fachdienstBauteile = useStammdatenStore((s) => s.fachdienstBauteile);
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '4px 6px', borderRadius: 4,
    border: '1px solid #e4e4e7', fontSize: 12, fontFamily: 'inherit',
    background: '#fff',
  };

  if (colDef.type === 'bauteil-select') {
    const fd = String(row.fachdienst ?? '');
    const choices = fachdienstBauteile[fd] ?? [];
    const cur = String(value ?? '');
    const opts = [...choices];
    if (cur && !opts.includes(cur)) opts.push(cur);
    return (
      <select value={cur} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        <option value="">— Ohne Bauteil —</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (colDef.type === 'select' && colDef.options) {
    return (
      <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        <option value="">—</option>
        {colDef.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (colDef.type === 'number') {
    return (
      <input
        type="number"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
        style={{ ...inputStyle, width: colDef.width ?? 70, textAlign: 'right' }}
      />
    );
  }

  if (colDef.type === 'date') {
    return (
      <input
        type="date"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    );
  }

  if (colDef.type === 'time') {
    return (
      <input
        type="time"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    );
  }

  return (
    <input
      type="text"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      style={inputStyle}
    />
  );
}

// ─── Column definitions ───────────────────────────────────────────────────────

function getSdpColumns(section: SdpSection, _fachdienstBauteile: Record<string, string[]>): ColDef[] {
  switch (section) {
    case 'tasks':
      return [
        { key: 'fachdienst', label: 'Fachdienst', type: 'select', options: [...FACHDIENST_VALUES], width: 110 },
        { key: 'bauteil', label: 'Bauteil', type: 'bauteil-select', width: 120 },
        { key: 'taetigkeit', label: 'Tätigkeit', type: 'text' },
        { key: 'beschreibung', label: 'Beschreibung', type: 'text' },
        { key: 'location', label: 'Bereich / Ort', type: 'text', width: 110 },
        { key: 'resStatus', label: 'Status', type: 'select', options: [...SDP_RES_STATUS_VALUES], width: 110 },
        { key: 'notes', label: 'Notizen', type: 'text', width: 110 },
      ];
    case 'personal':
      return [
        { key: 'funktion', label: 'Funktion', type: 'select', options: [...SDP_FUNKTION_VALUES], width: 130 },
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'resStatus', label: 'Status', type: 'select', options: [...SDP_RES_STATUS_VALUES], width: 110 },
        { key: 'bemerkung', label: 'Bemerkung', type: 'text' },
      ];
    case 'inventar':
      return [
        { key: 'geraet', label: 'Gerät / Inventar', type: 'text' },
        { key: 'anzahl', label: 'Anzahl', type: 'number', width: 72 },
        { key: 'resStatus', label: 'Status', type: 'select', options: [...SDP_RES_STATUS_VALUES], width: 110 },
        { key: 'bemerkung', label: 'Bemerkung', type: 'text' },
      ];
    case 'material':
      return [
        { key: 'material', label: 'Material', type: 'text' },
        { key: 'menge', label: 'Menge', type: 'number', width: 72 },
        { key: 'einheit', label: 'Einheit', type: 'select', options: [...MATERIAL_EINHEIT_VALUES], width: 80 },
        { key: 'resStatus', label: 'Status', type: 'select', options: [...SDP_RES_STATUS_VALUES], width: 110 },
        { key: 'bemerkung', label: 'Bemerkung', type: 'text' },
      ];
    case 'fremdleistung':
      return [
        { key: 'firma', label: 'Firma', type: 'text', width: 130 },
        { key: 'leistung', label: 'Leistung', type: 'text' },
        { key: 'resStatus', label: 'Status', type: 'select', options: [...SDP_RES_STATUS_VALUES], width: 110 },
        { key: 'bemerkung', label: 'Bemerkung', type: 'text' },
      ];
    case 'intervalle':
      return [
        { key: 'babNr', label: 'BAB-Nr', type: 'text', width: 80 },
        { key: 'babDatei', label: 'BAB-Datei', type: 'text', width: 110 },
        { key: 'babTitel', label: 'BAB Titel', type: 'text' },
        { key: 'status', label: 'Status', type: 'select', options: [...SDP_INTERVALLE_STATUS_VALUES], width: 150 },
        { key: 'gleissperrungen', label: 'Gleissperrungen', type: 'text' },
        { key: 'fahrleitungsausschaltungen', label: 'Fahrleitungsausschaltungen', type: 'text' },
        { key: 'vonDatum', label: 'Von Datum', type: 'date', width: 110 },
        { key: 'vonZeit', label: 'Von Zeit', type: 'time', width: 80 },
        { key: 'bisDatum', label: 'Bis Datum', type: 'date', width: 110 },
        { key: 'bisZeit', label: 'Bis Zeit', type: 'time', width: 80 },
      ];
  }
}
