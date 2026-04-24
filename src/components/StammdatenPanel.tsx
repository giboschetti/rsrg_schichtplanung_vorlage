import { useState } from 'react';
import { useStammdatenStore } from '@/stores/stammdatenStore';
import { FACHDIENST_VALUES } from '@/types';

export function StammdatenPanel() {
  const fachdienstBauteile = useStammdatenStore((s) => s.fachdienstBauteile);
  const addBauteil = useStammdatenStore((s) => s.addBauteil);
  const removeBauteil = useStammdatenStore((s) => s.removeBauteil);
  const shiftConfig = useStammdatenStore((s) => s.shiftConfig);
  const setShiftConfig = useStammdatenStore((s) => s.setShiftConfig);

  const [selectedFd, setSelectedFd] = useState<string>(FACHDIENST_VALUES[0]);
  const [newBauteil, setNewBauteil] = useState('');

  function handleAddBauteil() {
    if (!newBauteil.trim()) return;
    addBauteil(selectedFd, newBauteil.trim());
    setNewBauteil('');
  }

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 24, color: '#09090b' }}>
        Stammdaten
      </h2>

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

        {/* Grid of all Fachdienste with their Bauteile */}
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

const inputStyle: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid #e4e4e7',
  fontSize: 13, fontFamily: 'inherit', width: '100%',
};
