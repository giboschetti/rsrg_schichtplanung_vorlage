import { useState } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { useUiStore } from '@/stores/uiStore';
import { useStammdatenStore } from '@/stores/stammdatenStore';
import { buildKw, getCurrentIsoWeek } from '@/lib/kwHelpers';
import type { SdpSection } from '@/types';
import { TL_GROUPS, FACHDIENST_VALUES, SDP_FUNKTION_VALUES, SDP_RES_STATUS_VALUES } from '@/types';

// ─── Filter pills ────────────────────────────────────────────────────────────

export function TimelineFilterBar() {
  const tlFilter = useUiStore((s) => s.tlFilter);
  const toggleTlFilter = useUiStore((s) => s.toggleTlFilter);

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: '#71717a', marginRight: 4 }}>Anzeigen:</span>
      {TL_GROUPS.map((g) => {
        const active = tlFilter[g.id];
        return (
          <button
            key={g.id}
            onClick={() => toggleTlFilter(g.id as keyof typeof tlFilter)}
            style={{
              padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 500,
              border: `1px solid ${active ? '#FF6300' : '#e4e4e7'}`,
              background: active ? '#fff3eb' : '#fff',
              color: active ? '#FF6300' : '#71717a',
              cursor: 'pointer',
            }}
          >
            {g.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── KW management toolbar ───────────────────────────────────────────────────

export function KwToolbar() {
  const kwList = usePlannerStore((s) => s.kwList);
  const addKw = usePlannerStore((s) => s.addKw);
  const removeKw = usePlannerStore((s) => s.removeKw);
  const showToast = useUiStore((s) => s.showToast);
  const [showBulkAdd, setShowBulkAdd] = useState(false);

  const { year: curYear, num: curNum } = getCurrentIsoWeek();
  const [inputYear, setInputYear] = useState(curYear);
  const [inputNum, setInputNum] = useState(curNum);

  function handleAddKw() {
    const kw = buildKw(inputYear, inputNum);
    if (kwList.find((k) => k.id === kw.id)) {
      showToast(`KW ${inputNum}/${inputYear} bereits vorhanden`);
      return;
    }
    addKw(kw);
    setInputNum((n) => (n < 52 ? n + 1 : 1));
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            type="number"
            value={inputNum}
            min={1} max={53}
            onChange={(e) => setInputNum(Number(e.target.value))}
            style={{ width: 52, padding: '4px 6px', borderRadius: 5, border: '1px solid #e4e4e7', fontSize: 12, textAlign: 'center' }}
          />
          <span style={{ fontSize: 11, color: '#71717a' }}>/</span>
          <input
            type="number"
            value={inputYear}
            min={2020} max={2040}
            onChange={(e) => setInputYear(Number(e.target.value))}
            style={{ width: 64, padding: '4px 6px', borderRadius: 5, border: '1px solid #e4e4e7', fontSize: 12, textAlign: 'center' }}
          />
          <button
            onClick={handleAddKw}
            style={{
              padding: '4px 12px', borderRadius: 5, border: 'none',
              background: '#FF6300', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            + KW
          </button>
        </div>

        {kwList.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {kwList.map((kw) => (
              <span
                key={kw.id}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 5, border: '1px solid #e4e4e7',
                  background: '#fafafa', fontSize: 11,
                }}
              >
                {kw.label}
                <button
                  onClick={() => removeKw(kw.id)}
                  style={{
                    border: 'none', background: 'none', cursor: 'pointer',
                    color: '#71717a', fontSize: 12, lineHeight: 1, padding: 0,
                  }}
                  title="KW entfernen"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowBulkAdd(true)}
          style={{
            padding: '4px 12px', borderRadius: 5,
            border: '1px solid #e4e4e7', background: '#fff',
            fontSize: 12, cursor: 'pointer', color: '#09090b',
          }}
        >
          Bulk hinzufügen
        </button>
      </div>

      {showBulkAdd && <BulkAddModal onClose={() => setShowBulkAdd(false)} />}
    </>
  );
}

// ─── Bulk-add modal ───────────────────────────────────────────────────────────

type BulkSection = 'tasks' | 'personal' | 'inventar' | 'material' | 'fremdleistung' | 'intervalle';

function BulkAddModal({ onClose }: { onClose: () => void }) {
  const kwList = usePlannerStore((s) => s.kwList);
  const setSection = usePlannerStore((s) => s.setSection);
  const getSection = usePlannerStore((s) => s.getSection);
  const showToast = useUiStore((s) => s.showToast);
  const fachdienstBauteile = useStammdatenStore((s) => s.fachdienstBauteile);

  const [section, setSection2] = useState<BulkSection>('tasks');
  const [selectedKws, setSelectedKws] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [selectedShifts, setSelectedShifts] = useState<('T' | 'N')[]>(['T']);

  // Task fields
  const [fachdienst, setFachdienst] = useState('');
  const [bauteil, setBauteil] = useState('');
  const [taetigkeit, setTaetigkeit] = useState('');
  const [resStatus, setResStatus] = useState('');

  // Personal fields
  const [funktion, setFunktion] = useState('');
  const [name, setName] = useState('');

  // Inventar
  const [geraet, setGeraet] = useState('');
  const [anzahl, setAnzahl] = useState('');

  // Material
  const [material, setMaterial] = useState('');
  const [menge, setMenge] = useState('');
  const [einheit, setEinheit] = useState('Stk');

  // Fremdleistung
  const [firma, setFirma] = useState('');
  const [leistung, setLeistung] = useState('');

  const bauteileForFd = fachdienstBauteile[fachdienst] ?? [];

  const toggleKw = (id: string) =>
    setSelectedKws((prev) => prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]);
  const toggleDay = (d: number) =>
    setSelectedDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  const toggleShift = (s: 'T' | 'N') =>
    setSelectedShifts((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  function buildRow(): Record<string, unknown> | null {
    const id = Math.random().toString(36).slice(2);
    if (section === 'tasks') {
      if (!taetigkeit) return null;
      return { id, fachdienst, bauteil, taetigkeit, resStatus };
    }
    if (section === 'personal') {
      if (!name && !funktion) return null;
      return { id, funktion, name, resStatus };
    }
    if (section === 'inventar') {
      if (!geraet) return null;
      return { id, geraet, anzahl: anzahl ? Number(anzahl) : undefined, resStatus };
    }
    if (section === 'material') {
      if (!material) return null;
      return { id, material, menge: menge ? Number(menge) : undefined, einheit, resStatus };
    }
    if (section === 'fremdleistung') {
      if (!firma) return null;
      return { id, firma, leistung, resStatus };
    }
    return null;
  }

  function handleApply() {
    const row = buildRow();
    if (!row) { showToast('Bitte Pflichtfelder ausfüllen'); return; }
    let count = 0;
    const kwIds = selectedKws.length ? selectedKws : kwList.map((k) => k.id);
    kwIds.forEach((kwId) => {
      selectedDays.forEach((dayIdx) => {
        selectedShifts.forEach((shift) => {
          const existing = getSection<Record<string, unknown>>(kwId, dayIdx, shift, section as SdpSection);
          setSection(kwId, dayIdx, shift, section as SdpSection, [...existing, { ...row, id: Math.random().toString(36).slice(2) }]);
          count++;
        });
      });
    });
    showToast(`${count} Zellen befüllt`);
    onClose();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#fff', borderRadius: 12, padding: 24, width: 520, maxHeight: '90vh',
        overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontFamily: 'Space Grotesk, sans-serif', fontSize: 16, fontWeight: 700 }}>
            Bulk hinzufügen
          </h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#71717a' }}>×</button>
        </div>

        {/* Section selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 4 }}>BEREICH</label>
          <select
            value={section}
            onChange={(e) => setSection2(e.target.value as BulkSection)}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e4e4e7', fontSize: 13 }}
          >
            <option value="tasks">Tätigkeiten</option>
            <option value="personal">Personal</option>
            <option value="inventar">Inventar</option>
            <option value="material">Material</option>
            <option value="fremdleistung">Fremdleistung</option>
            <option value="intervalle">Intervalle</option>
          </select>
        </div>

        {/* KW selection */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 4 }}>
            KALENDERWOCHEN <span style={{ fontWeight: 400 }}>(leer = alle)</span>
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {kwList.map((kw) => (
              <button key={kw.id} onClick={() => toggleKw(kw.id)}
                style={{
                  padding: '3px 8px', borderRadius: 4, border: `1px solid ${selectedKws.includes(kw.id) ? '#FF6300' : '#e4e4e7'}`,
                  background: selectedKws.includes(kw.id) ? '#fff3eb' : '#fff',
                  color: selectedKws.includes(kw.id) ? '#FF6300' : '#09090b', fontSize: 11, cursor: 'pointer',
                }}>
                {kw.label}
              </button>
            ))}
          </div>
        </div>

        {/* Day selection */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 4 }}>TAGE</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d, i) => (
              <button key={d} onClick={() => toggleDay(i)}
                style={{
                  padding: '3px 7px', borderRadius: 4, border: `1px solid ${selectedDays.includes(i) ? '#FF6300' : '#e4e4e7'}`,
                  background: selectedDays.includes(i) ? '#fff3eb' : '#fff',
                  color: selectedDays.includes(i) ? '#FF6300' : '#09090b', fontSize: 11, cursor: 'pointer',
                }}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Shift selection */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 4 }}>SCHICHTEN</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['T', 'N'] as const).map((s) => (
              <button key={s} onClick={() => toggleShift(s)}
                style={{
                  padding: '3px 12px', borderRadius: 4, border: `1px solid ${selectedShifts.includes(s) ? '#FF6300' : '#e4e4e7'}`,
                  background: selectedShifts.includes(s) ? '#fff3eb' : '#fff',
                  color: selectedShifts.includes(s) ? '#FF6300' : '#09090b', fontSize: 11, cursor: 'pointer',
                }}>
                {s === 'T' ? 'Tag' : 'Nacht'}
              </button>
            ))}
          </div>
        </div>

        {/* Section-specific fields */}
        <div style={{ borderTop: '1px solid #e4e4e7', paddingTop: 16, marginBottom: 20 }}>
          {section === 'tasks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Row label="Fachdienst">
                <select value={fachdienst} onChange={(e) => setFachdienst(e.target.value)} style={fieldStyle}>
                  <option value="">— Wählen —</option>
                  {FACHDIENST_VALUES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Row>
              <Row label="Bauteil">
                <select value={bauteil} onChange={(e) => setBauteil(e.target.value)} style={fieldStyle}>
                  <option value="">— Ohne Bauteil —</option>
                  {bauteileForFd.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </Row>
              <Row label="Tätigkeit *">
                <input value={taetigkeit} onChange={(e) => setTaetigkeit(e.target.value)} style={fieldStyle} placeholder="z. B. Gleis aufnehmen" />
              </Row>
              <Row label="Status">
                <select value={resStatus} onChange={(e) => setResStatus(e.target.value)} style={fieldStyle}>
                  <option value="">—</option>
                  {SDP_RES_STATUS_VALUES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Row>
            </div>
          )}

          {section === 'personal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Row label="Funktion">
                <select value={funktion} onChange={(e) => setFunktion(e.target.value)} style={fieldStyle}>
                  <option value="">— Wählen —</option>
                  {SDP_FUNKTION_VALUES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Row>
              <Row label="Name *">
                <input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} placeholder="Vorname Nachname" />
              </Row>
              <Row label="Status">
                <select value={resStatus} onChange={(e) => setResStatus(e.target.value)} style={fieldStyle}>
                  <option value="">—</option>
                  {SDP_RES_STATUS_VALUES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Row>
            </div>
          )}

          {section === 'inventar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Row label="Gerät / Inventar *">
                <input value={geraet} onChange={(e) => setGeraet(e.target.value)} style={fieldStyle} placeholder="z. B. Bagger" />
              </Row>
              <Row label="Anzahl">
                <input type="number" value={anzahl} onChange={(e) => setAnzahl(e.target.value)} style={{ ...fieldStyle, width: 80 }} />
              </Row>
              <Row label="Status">
                <select value={resStatus} onChange={(e) => setResStatus(e.target.value)} style={fieldStyle}>
                  <option value="">—</option>
                  {SDP_RES_STATUS_VALUES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Row>
            </div>
          )}

          {section === 'material' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Row label="Material *">
                <input value={material} onChange={(e) => setMaterial(e.target.value)} style={fieldStyle} placeholder="z. B. Schotter" />
              </Row>
              <Row label="Menge">
                <input type="number" value={menge} onChange={(e) => setMenge(e.target.value)} style={{ ...fieldStyle, width: 80 }} />
              </Row>
              <Row label="Einheit">
                <select value={einheit} onChange={(e) => setEinheit(e.target.value)} style={fieldStyle}>
                  {['m', 'm²', 'm³', 'kg', 't', 'Stk', 'Psch', 'h', 'l', 'lfm'].map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </Row>
            </div>
          )}

          {section === 'fremdleistung' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Row label="Firma *">
                <input value={firma} onChange={(e) => setFirma(e.target.value)} style={fieldStyle} placeholder="Firmenname" />
              </Row>
              <Row label="Leistung">
                <input value={leistung} onChange={(e) => setLeistung(e.target.value)} style={fieldStyle} placeholder="Leistungsbeschreibung" />
              </Row>
            </div>
          )}

          {section === 'intervalle' && (
            <div style={{ color: '#71717a', fontSize: 12 }}>
              Intervalle können direkt im Schichtdetail-Panel erfasst werden.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #e4e4e7', background: '#fff', fontSize: 13, cursor: 'pointer' }}>
            Abbrechen
          </button>
          <button
            onClick={handleApply}
            style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#FF6300', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  flex: 1, padding: '6px 8px', borderRadius: 5,
  border: '1px solid #e4e4e7', fontSize: 13, fontFamily: 'inherit',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12, color: '#71717a', width: 120, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, display: 'flex' }}>{children}</div>
    </div>
  );
}
