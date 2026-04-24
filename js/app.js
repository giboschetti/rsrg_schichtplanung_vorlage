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
  setFachdienstBauteile(fachdienstBauteile);
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
  document.getElementById('btnAddBauteil')?.addEventListener('click', () => {
    const fd = document.getElementById('sd-fachdienst-select')?.value || 'Andere';
    const bauteil = document.getElementById('sd-bauteil-input')?.value || '';
    addBauteilToFachdienst(fd, bauteil);
    const inp = document.getElementById('sd-bauteil-input');
    if (inp) inp.value = '';
    saveStammdaten();
  });
  document.getElementById('sd-bauteil-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const fd = document.getElementById('sd-fachdienst-select')?.value || 'Andere';
      const bauteil = document.getElementById('sd-bauteil-input')?.value || '';
      addBauteilToFachdienst(fd, bauteil);
      const inp = document.getElementById('sd-bauteil-input');
      if (inp) inp.value = '';
      saveStammdaten();
    }
  });
  document.getElementById('fachdienstBauteilList')?.addEventListener('click', e => {
    const btn = e.target?.closest?.('[data-fd-remove]');
    if (!btn) return;
    const fd = btn.dataset.fdRemove;
    const idx = parseInt(btn.dataset.fdIdx, 10);
    if (!fd || Number.isNaN(idx)) return;
    removeBauteilFromFachdienst(fd, idx);
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
    if (!isUebersichtPageActive()) return;
    if (k === 'c' && window.getSelection()?.toString()?.trim()) return;
    e.preventDefault();
    if (k === 'c') copyTimelineShiftToClipboard();
    else pasteTimelineShiftFromClipboard();
  }, true);

  window.addEventListener('beforeunload', () => { flushOpenSDPTables(); });
});
