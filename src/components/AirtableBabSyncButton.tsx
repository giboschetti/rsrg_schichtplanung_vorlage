import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  AS25_WANKDORF_PROJECT_ID,
  requestAirtableBabSync,
} from '@/lib/airtableBabSync';
import { usePlannerStore } from '@/stores/plannerStore';
import { useUiStore } from '@/stores/uiStore';

function parseOptionalKw(input: string): { value?: number; error?: string } {
  const t = input.trim();
  if (t === '') return {};
  const n = Number(t);
  if (!Number.isFinite(n)) return { error: 'KW bitte als Zahl eingeben.' };
  return { value: Math.trunc(n) };
}

export function AirtableBabSyncButton() {
  const projectId = usePlannerStore((s) => s.projectId);
  const showToast = useUiStore((s) => s.showToast);

  const [open, setOpen] = useState(false);
  const [kwFromStr, setKwFromStr] = useState('');
  const [kwToStr, setKwToStr] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const onSubmit = useCallback(async () => {
    const a = parseOptionalKw(kwFromStr);
    const b = parseOptionalKw(kwToStr);
    if (a.error) {
      showToast(a.error);
      return;
    }
    if (b.error) {
      showToast(b.error);
      return;
    }
    const kwFrom = a.value;
    const kwTo = b.value;
    if (kwFrom != null && kwTo != null && kwFrom > kwTo) {
      showToast('KW «von» darf nicht grösser sein als KW «bis».');
      return;
    }

    setSyncing(true);
    try {
      const result = await requestAirtableBabSync(
        kwFrom == null && kwTo == null ? undefined : { kwFrom, kwTo },
      );
      if (result.ok) {
        showToast(result.message ?? 'Airtable BAB Sync abgeschlossen. Daten werden übernommen…');
        setOpen(false);
        setKwFromStr('');
        setKwToStr('');
      } else {
        showToast(result.message);
      }
    } finally {
      setSyncing(false);
    }
  }, [kwFromStr, kwToStr, showToast]);

  if (projectId !== AS25_WANKDORF_PROJECT_ID) return null;

  const btnStyle: CSSProperties = {
    padding: '5px 12px',
    borderRadius: 6,
    border: '1px solid #e4e4e7',
    background: '#fff',
    fontSize: 12,
    cursor: syncing ? 'wait' : 'pointer',
    color: '#09090b',
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={btnStyle}>
        Airtable BAB Sync
      </button>
      {open &&
        createPortal(
          <div
            role="presentation"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 150,
              background: 'rgba(9,9,11,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => !syncing && setOpen(false)}
          >
            <div
              role="dialog"
              aria-labelledby="bab-sync-title"
              style={{
                background: '#fff',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                padding: '20px 22px',
                maxWidth: 400,
                width: '100%',
                fontFamily: 'inherit',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div id="bab-sync-title" style={{ fontWeight: 600, fontSize: 15, marginBottom: 12, color: '#09090b' }}>
                Airtable BAB Sync
              </div>
              <p style={{ fontSize: 13, color: '#52525b', margin: '0 0 16px', lineHeight: 1.45 }}>
                Optional KW-Bereich eingrenzen (leer = alle Kalenderwochen des Projekts). Es läuft dieselbe
                Logik wie der Server-Sync mit <code style={{ fontSize: 12 }}>bab_sync_firebase.py</code>.
              </p>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#71717a' }}>
                  KW von
                  <input
                    type="text"
                    inputMode="numeric"
                    value={kwFromStr}
                    onChange={(e) => setKwFromStr(e.target.value)}
                    disabled={syncing}
                    style={{
                      width: 88,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #e4e4e7',
                      fontSize: 13,
                    }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#71717a' }}>
                  KW bis
                  <input
                    type="text"
                    inputMode="numeric"
                    value={kwToStr}
                    onChange={(e) => setKwToStr(e.target.value)}
                    disabled={syncing}
                    style={{
                      width: 88,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #e4e4e7',
                      fontSize: 13,
                    }}
                  />
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => setOpen(false)}
                  style={{ ...btnStyle, cursor: syncing ? 'default' : 'pointer' }}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => void onSubmit()}
                  style={{
                    ...btnStyle,
                    border: 'none',
                    background: syncing ? '#e4e4e7' : '#FF6300',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: syncing ? 'wait' : 'pointer',
                  }}
                >
                  {syncing ? 'Synchronisiere…' : 'Sync starten'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
