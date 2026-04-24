import { useState, type CSSProperties, type ReactNode } from 'react';
import { useStammdatenStore } from '@/stores/stammdatenStore';
import { FACHDIENST_VALUES, MITARBEITER_FUNKTION_OPTIONS } from '@/types';

const labelW = 140;

export function StammdatenPanel() {
  const fachdienstBauteile = useStammdatenStore((s) => s.fachdienstBauteile);
  const addBauteil = useStammdatenStore((s) => s.addBauteil);
  const removeBauteil = useStammdatenStore((s) => s.removeBauteil);
  const shiftConfig = useStammdatenStore((s) => s.shiftConfig);
  const setShiftConfig = useStammdatenStore((s) => s.setShiftConfig);
  const projectForm = useStammdatenStore((s) => s.projectForm);
  const setProjectForm = useStammdatenStore((s) => s.setProjectForm);
  const mitarbeiter = useStammdatenStore((s) => s.mitarbeiter);
  const addMitarbeiterRow = useStammdatenStore((s) => s.addMitarbeiterRow);
  const updateMitarbeiterRow = useStammdatenStore((s) => s.updateMitarbeiterRow);
  const removeMitarbeiterRow = useStammdatenStore((s) => s.removeMitarbeiterRow);

  const [selectedFd, setSelectedFd] = useState<string>(FACHDIENST_VALUES[0]);
  const [newBauteil, setNewBauteil] = useState('');

  function handleAddBauteil() {
    if (!newBauteil.trim()) return;
    addBauteil(selectedFd, newBauteil.trim());
    setNewBauteil('');
  }

  return (
    <div style={{ padding: 24, maxWidth: 960, width: '100%', boxSizing: 'border-box' }}>
      <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 24, color: '#09090b' }}>
        Stammdaten
      </h2>

      {/* Projekt */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, fontWeight: 600, color: '#09090b', marginBottom: 12 }}>
          Projekt
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: `${labelW}px 1fr`, gap: '10px 16px', maxWidth: 640, alignItems: 'center' }}>
          <FormLabel>Projekttitel</FormLabel>
          <input
            value={projectForm.projektname}
            onChange={(e) => setProjectForm({ projektname: e.target.value })}
            placeholder="z. B. Ausbau SZU Zürich Los 1"
            style={inputStyle}
          />
          <FormLabel>Projektnummer</FormLabel>
          <input
            value={projectForm.projektnummer}
            onChange={(e) => setProjectForm({ projektnummer: e.target.value })}
            style={inputStyle}
          />
          <FormLabel>Auftraggeber</FormLabel>
          <input
            value={projectForm.auftraggeber}
            onChange={(e) => setProjectForm({ auftraggeber: e.target.value })}
            style={inputStyle}
          />
          <FormLabel>Bauleiter</FormLabel>
          <input
            value={projectForm.bauleiter}
            onChange={(e) => setProjectForm({ bauleiter: e.target.value })}
            placeholder="Name, Telefon"
            style={inputStyle}
          />
          <FormLabel>Polier</FormLabel>
          <input
            value={projectForm.polier}
            onChange={(e) => setProjectForm({ polier: e.target.value })}
            placeholder="Name, Telefon"
            style={inputStyle}
          />
          <FormLabel>Standort / Baustelle</FormLabel>
          <input
            value={projectForm.standort}
            onChange={(e) => setProjectForm({ standort: e.target.value })}
            style={inputStyle}
          />
          <FormLabel>Baubeginn</FormLabel>
          <input
            type="date"
            value={toDateInput(projectForm.baubeginn)}
            onChange={(e) => setProjectForm({ baubeginn: e.target.value })}
            style={inputStyle}
          />
          <FormLabel>Bauende</FormLabel>
          <input
            type="date"
            value={toDateInput(projectForm.bauende)}
            onChange={(e) => setProjectForm({ bauende: e.target.value })}
            style={inputStyle}
          />
        </div>
      </section>

      {/* Kontaktliste */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, fontWeight: 600, color: '#09090b', margin: 0 }}>
            Kontaktliste / Projektteam
          </h3>
          <button
            type="button"
            onClick={() => addMitarbeiterRow()}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none',
              background: '#FF6300', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            + Zeile
          </button>
        </div>
        <div style={{ overflowX: 'auto', border: '1px solid #e4e4e7', borderRadius: 8, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 720 }}>
            <thead>
              <tr style={{ background: '#f4f4f5', textAlign: 'left' }}>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Vorname</th>
                <th style={thStyle}>Funktion</th>
                <th style={thStyle}>Firma</th>
                <th style={thStyle}>Tel</th>
                <th style={thStyle}>E-Mail</th>
                <th style={thStyle}>Bemerkung</th>
                <th style={{ ...thStyle, width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {mitarbeiter.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 16, color: '#71717a' }}>
                    Noch keine Kontakte — &quot;+ Zeile&quot; für einen Eintrag.
                  </td>
                </tr>
              )}
              {mitarbeiter.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}><CellInput value={row.name} onChange={(v) => updateMitarbeiterRow(row.id, { name: v })} /></td>
                  <td style={tdStyle}><CellInput value={row.vorname} onChange={(v) => updateMitarbeiterRow(row.id, { vorname: v })} /></td>
                  <td style={tdStyle}>
                    <select
                      value={row.funktion ?? ''}
                      onChange={(e) => updateMitarbeiterRow(row.id, { funktion: e.target.value })}
                      style={{ ...inputStyle, fontSize: 12, padding: '5px 6px' }}
                    >
                      <option value="">—</option>
                      {MITARBEITER_FUNKTION_OPTIONS.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </td>
                  <td style={tdStyle}><CellInput value={row.firma} onChange={(v) => updateMitarbeiterRow(row.id, { firma: v })} /></td>
                  <td style={tdStyle}><CellInput value={row.tel} onChange={(v) => updateMitarbeiterRow(row.id, { tel: v })} /></td>
                  <td style={tdStyle}><CellInput value={row.email} onChange={(v) => updateMitarbeiterRow(row.id, { email: v })} /></td>
                  <td style={tdStyle}><CellInput value={row.bemerkung} onChange={(v) => updateMitarbeiterRow(row.id, { bemerkung: v })} /></td>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      onClick={() => removeMitarbeiterRow(row.id)}
                      style={{ border: 'none', background: 'none', color: '#DC002E', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}
                      title="Zeile entfernen"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Schichtkonfiguration */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, fontWeight: 600, color: '#09090b', marginBottom: 12 }}>
          Schichtzeiten
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 480 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 6 }}>
              TAG: VON
            </label>
            <input
              type="time"
              value={shiftConfig.tag.von}
              onChange={(e) => setShiftConfig({ ...shiftConfig, tag: { ...shiftConfig.tag, von: e.target.value } })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 6 }}>
              TAG: BIS
            </label>
            <input
              type="time"
              value={shiftConfig.tag.bis}
              onChange={(e) => setShiftConfig({ ...shiftConfig, tag: { ...shiftConfig.tag, bis: e.target.value } })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 6 }}>
              NACHT: VON
            </label>
            <input
              type="time"
              value={shiftConfig.nacht.von}
              onChange={(e) => setShiftConfig({ ...shiftConfig, nacht: { ...shiftConfig.nacht, von: e.target.value } })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 6 }}>
              NACHT: BIS
            </label>
            <input
              type="time"
              value={shiftConfig.nacht.bis}
              onChange={(e) => setShiftConfig({ ...shiftConfig, nacht: { ...shiftConfig.nacht, bis: e.target.value } })}
              style={inputStyle}
            />
          </div>
        </div>
      </section>

      {/* Fachdienst → Bauteil */}
      <section>
        <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, fontWeight: 600, color: '#09090b', marginBottom: 12 }}>
          Fachdienste &amp; Bauteile
        </h3>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 4 }}>FACHDIENST</label>
            <select
              value={selectedFd}
              onChange={(e) => setSelectedFd(e.target.value)}
              style={{ ...inputStyle, width: 130 }}
            >
              {FACHDIENST_VALUES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', display: 'block', marginBottom: 4 }}>NEUES BAUTEIL</label>
            <input
              value={newBauteil}
              onChange={(e) => setNewBauteil(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddBauteil()}
              placeholder="Bauteilname"
              style={inputStyle}
            />
          </div>
          <button
            onClick={handleAddBauteil}
            disabled={!newBauteil.trim()}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none',
              background: newBauteil.trim() ? '#FF6300' : '#e4e4e7',
              color: newBauteil.trim() ? '#fff' : '#71717a',
              fontSize: 13, fontWeight: 600, cursor: newBauteil.trim() ? 'pointer' : 'default',
            }}
          >
            + Hinzufügen
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {FACHDIENST_VALUES.map((fd) => {
            const bauteile = fachdienstBauteile[fd] ?? [];
            return (
              <div
                key={fd}
                style={{
                  border: '1px solid #e4e4e7', borderRadius: 8, padding: '12px 14px',
                  background: selectedFd === fd ? '#fff3eb' : '#fff',
                  borderColor: selectedFd === fd ? '#FF6300' : '#e4e4e7',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedFd(fd)}
              >
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: '#09090b' }}>{fd}</div>
                {bauteile.length === 0 && (
                  <div style={{ fontSize: 11, color: '#71717a' }}>Keine Bauteile</div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {bauteile.map((bt, i) => (
                    <div
                      key={bt}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        fontSize: 12, color: '#09090b',
                      }}
                    >
                      <span>{bt}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeBauteil(fd, i); }}
                        style={{
                          border: 'none', background: 'none', cursor: 'pointer',
                          color: '#71717a', fontSize: 13, padding: '0 2px', lineHeight: 1,
                        }}
                        title="Entfernen"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function FormLabel({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: '#71717a' }}>{children}</span>
  );
}

function CellInput({ value, onChange }: { value: string | undefined; onChange: (v: string) => void }) {
  return (
    <input
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...inputStyle, fontSize: 12, padding: '5px 8px' }}
    />
  );
}

/** Legacy values may be YYYY-MM-DD or empty; <input type="date"> needs YYYY-MM-DD or "" */
function toDateInput(s: string | undefined): string {
  if (!s || !s.trim()) return '';
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return '';
}

const inputStyle: CSSProperties = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid #e4e4e7',
  fontSize: 13, fontFamily: 'inherit', width: '100%',
};

const thStyle: CSSProperties = {
  padding: '8px 10px', fontSize: 11, fontWeight: 600, color: '#71717a', borderBottom: '1px solid #e4e4e7',
};

const tdStyle: CSSProperties = {
  padding: 4, borderBottom: '1px solid #f4f4f5', verticalAlign: 'middle',
};
