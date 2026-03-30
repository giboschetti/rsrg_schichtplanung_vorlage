// ─── Static Tables ────────────────────────────────────────────────────────────

const txtCol = (title, field, grow = 1) => ({ title, field, editor: 'input', widthGrow: grow });
const numCol = (title, field, w = 78)   => ({ title, field, editor: 'number', width: w, hozAlign: 'right' });

function initStaticTables() {
  const el = document.getElementById('table-mitarbeiter');
  if (!el) return;
  const saved = loadTbl('mitarbeiter');
  tables['mitarbeiter'] = new Tabulator('#table-mitarbeiter', {
    data: saved || [],
    columns: [
      txtCol('Name', 'name', 1),
      txtCol('Vorname', 'vorname', 1),
      { title: 'Funktion', field: 'funktion', editor: 'list', widthGrow: 1,
        editorParams: { values: ['Baugruppe','Sicherheit','Maschinist','Polier','Bauleiter','Fremdfirma'] } },
      txtCol('Firma', 'firma', 1),
      { title: 'Tel', field: 'tel', editor: 'input', width: 125 },
      txtCol('Email', 'email', 1),
      txtCol('Bemerkung', 'bemerkung', 1),
    ],
    layout: 'fitColumns', height: 'auto', maxHeight: '380px',
    selectable: true, history: true, clipboard: true, clipboardCopyStyled: false,
    rowContextMenu: [
      { label: '<span style="color:#DC002E">✕ Zeile löschen</span>',
        action: (e, row) => { row.delete(); saveTbl('mitarbeiter'); } },
      { label: '↓ Zeile darunter einfügen',
        action: (e, row) => { tables['mitarbeiter'].addRow({}, false, row); saveTbl('mitarbeiter'); } },
    ],
    cellEdited: () => saveTbl('mitarbeiter'),
    rowDeleted:  () => saveTbl('mitarbeiter'),
  });
}

// ─── Reset ────────────────────────────────────────────────────────────────────

function clearAllData() {
  if (!confirm('Alle Daten wirklich löschen?\nDieser Vorgang kann nicht rückgängig gemacht werden.')) return;
  localStorage.clear();
  location.reload();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  loadFromEmbeddedData();
  loadWorkItemsLS();
  loadStammdaten();
  setBauphaseBauteile(bauphaseBauteile);
  loadShiftConfig();
  updateHeaderProj();
  initStaticTables();

  loadKWList().forEach(kw => {
    if (!kwList.find(k => k.id === kw.id)) {
      kwList.push(kw);
    }
  });
  kwList.sort((a, b) => a.year !== b.year ? a.year - b.year : a.num - b.num);

  renderKWList();
  updateStats();
  renderTimeline();

  document.getElementById('kwNum').addEventListener('keydown', e => {
    if (e.key === 'Enter')  confirmAddKW();
    if (e.key === 'Escape') closeModal();
  });
  document.getElementById('btnAddBauphase')?.addEventListener('click', addBauphaseBauteilFromInput);
  document.getElementById('sd-bauphase-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addBauphaseBauteilFromInput();
    }
  });
  document.getElementById('bauphaseList')?.addEventListener('click', e => {
    const removeIdx = e.target?.closest?.('[data-bauphase-remove]')?.dataset?.bauphaseRemove;
    if (removeIdx == null) return;
    const idx = parseInt(removeIdx, 10);
    if (Number.isNaN(idx)) return;
    setBauphaseBauteile(bauphaseBauteile.filter((_, i) => i !== idx));
    saveStammdaten();
  });
  document.getElementById('bauphaseList')?.addEventListener('change', e => {
    const input = e.target?.closest?.('[data-bauphase-idx]');
    if (!input) return;
    const idx = parseInt(input.dataset.bauphaseIdx, 10);
    if (Number.isNaN(idx)) return;
    const next = [...bauphaseBauteile];
    const updatedValue = normalizeBauphaseBauteilValue(input.value || '');
    if (!updatedValue) next.splice(idx, 1);
    else next[idx] = updatedValue;
    setBauphaseBauteile(next);
    saveStammdaten();
  });
  document.getElementById('addKWModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Ctrl+Z undo on active table
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      Object.values(tables).forEach(tbl => { tbl.undo?.(); });
    }
  });

  // Shift copy/paste (Übersicht + Zoom „Schichten")
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = (e.key || '').toLowerCase();
    if (k !== 'c' && k !== 'v') return;
    if (isTimelineClipboardTargetEditable(e.target)) return;
    if (!isUebersichtPageActive() || tlZoom !== 'shifts') return;
    if (k === 'c' && window.getSelection()?.toString()?.trim()) return;
    e.preventDefault();
    if (k === 'c') copyTimelineShiftToClipboard();
    else pasteTimelineShiftFromClipboard();
  }, true);

  window.addEventListener('beforeunload', () => { flushOpenSDPTables(); });
});
