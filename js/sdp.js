// ─── Shift Detail Panel ───────────────────────────────────────────────────────

function shiftLabel(shift) {
  return shift === 'T'
    ? `Tag (${shiftConfig.tag.von} – ${shiftConfig.tag.bis})`
    : `Nacht (${shiftConfig.nacht.von} – ${shiftConfig.nacht.bis})`;
}

function openSDP(kwId, dayIdx, shift, grp) {
  flushOpenSDPTables();

  selectedCell = { kwId, dayIdx, shift, grp: grp || undefined };
  timelineShiftFocus = { kwId, dayIdx, shift, grp: grp || undefined };

  document.querySelectorAll('.tl-cell.selected').forEach(td => td.classList.remove('selected'));
  if (grp) {
    document.querySelectorAll(
      `.tl-cell[data-kw="${kwId}"][data-day="${dayIdx}"][data-shift="${shift}"][data-grp="${grp}"]`
    ).forEach(td => td.classList.add('selected'));
  } else {
    document.querySelectorAll(
      `.tl-cell[data-kw="${kwId}"][data-day="${dayIdx}"][data-shift="${shift}"]`
    ).forEach(td => td.classList.add('selected'));
  }

  const kw = kwList.find(k => k.id === kwId);
  document.getElementById('sdp-title').textContent =
    `${kw?.label || kwId}  —  ${tlDayPlain(kw, dayIdx)}  —  ${shiftLabel(shift)}`;

  initSDPTables(kwId, dayIdx, shift);
  if (grp) showOnlySDPSection(grp);
  else showAllSDPSections();

  const panel = document.getElementById('shiftDetailPanel');
  panel.classList.add('open');
  document.getElementById('page-uebersicht').style.paddingBottom = '50vh';
}

function updateSDPMeta() {
  if (!selectedCell) return;
  const { kwId, dayIdx, shift } = selectedCell;
  let total = 0;
  TL_GROUPS.forEach(g => {
    total += getSection(kwId, dayIdx, shift, g.section).length;
  });
  document.getElementById('sdp-meta').textContent = total + ' Einträge total';
}

function updateSDPCounts() {
  TL_GROUPS.forEach(g => {
    const el = document.getElementById('sdp-count-' + g.id);
    if (!el || !selectedCell) return;
    const n = getSection(selectedCell.kwId, selectedCell.dayIdx, selectedCell.shift, g.section).length;
    el.textContent = n;
    el.classList.toggle('empty', n === 0);
  });
  updateSDPMeta();
}

function sdpResStatusFormatter(cell) {
  const v = cell.getValue() || '';
  const map = { Planung: 'st-rs-planung', Bestellt: 'st-rs-bestellt', 'Bestätigt': 'st-rs-bestaetigt' };
  const cls = map[v];
  return cls ? `<span class="${cls}">${v}</span>` : (v || '–');
}

function sdpNativeSelectEditor(choices, emptyLabel) {
  return function (cell, onRendered, success) {
    const sel = document.createElement('select');
    sel.className = 'sdp-native-select';
    sel.style.cssText = 'width:100%;box-sizing:border-box;padding:4px 6px;font:inherit;';
    const cur = cell.getValue();
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = emptyLabel || '—';
    sel.appendChild(opt0);
    choices.forEach(v => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      if (v === cur) o.selected = true;
      sel.appendChild(o);
    });
    onRendered(() => { sel.focus(); });
    sel.addEventListener('change', () => success(sel.value || ''));
    return sel;
  };
}

function sdpResStatusColumn(width = 118) {
  return {
    title: 'Status',
    field: 'resStatus',
    width,
    editor: sdpNativeSelectEditor(SDP_RES_STATUS_VALUES),
    formatter: sdpResStatusFormatter,
  };
}

function sdpDeleteColumn(kwId, dayIdx, shift, section) {
  return {
    title: '',
    field: '_del',
    width: 38,
    resizable: false,
    sortable: false,
    formatter: () => '<span class="sdp-del-btn" title="Zeile löschen">✕</span>',
    cellClick: (e, cell) => {
      if (e.target?.closest?.('.sdp-del-btn')) {
        cell.getRow().delete();
      }
    },
  };
}

function buildSdpRowContextMenu(kwId, dayIdx, shift, section) {
  return [
    {
      label: '<span>📋 Ressource kopieren</span>',
      action: (e, row) => {
        const data = row.getData() || {};
        const clean = {};
        Object.entries(data).forEach(([k, v]) => { if (!k.startsWith('_')) clean[k] = v; });
        delete clean.id;
        const wrap = { _schichtplanungShiftV1: true, sections: { [section]: [clean] } };
        sdpRowClipboardInternal = wrap;
        shiftClipboardInternal = wrap;
        lastClipboardInternal = { type: 'row', payload: wrap };
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(JSON.stringify(wrap)).catch(() => {});
        }
        timelineShiftFocus = { kwId, dayIdx, shift, grp: section };
        showToast('Ressource kopiert (Zielzelle wählen, Strg+V)');
      },
    },
    {
      label: '<span style="color:#DC002E">✕ Zeile löschen</span>',
      action: (e, row) => { row.delete(); saveSDPSection(kwId, dayIdx, shift, section); },
    },
  ];
}

function sdpBauteilEditor(cell, onRendered, success) {
  const row = cell.getRow().getData();
  const fachdienst = normalizeFachdienst(row?.fachdienst);
  const choices = getBauteileForFachdienst(fachdienst);
  const current = String(cell?.getValue?.() || '').trim();
  if (current && !choices.includes(current)) choices.push(current);
  return sdpNativeSelectEditor(choices, '— Ohne Bauteil —')(cell, onRendered, success);
}

function closeSDP() {
  flushOpenSDPTables();
  selectedCell = null;
  document.querySelectorAll('.tl-cell.selected').forEach(td => td.classList.remove('selected'));
  document.getElementById('shiftDetailPanel').classList.remove('open');
  document.getElementById('page-uebersicht').style.paddingBottom = '';
  Object.values(sdpTables).forEach(t => { if (t) t.destroy(); });
  Object.keys(sdpTables).forEach(k => delete sdpTables[k]);
}

function initSDPTables(kwId, dayIdx, shift) {
  Object.values(sdpTables).forEach(t => { if (t) t.destroy(); });
  Object.keys(sdpTables).forEach(k => delete sdpTables[k]);

  sdpTables.tasks = new Tabulator('#sdp-tbl-tasks', {
    data: getSection(kwId, dayIdx, shift, 'tasks').map(d => ({...d})),
    layout: 'fitColumns', height: 'auto', maxHeight: '260px', history: true,
    rowContextMenu: buildSdpRowContextMenu(kwId, dayIdx, shift, 'tasks'),
    cellEdited:  () => saveSDPSection(kwId, dayIdx, shift, 'tasks'),
    rowDeleted:  () => saveSDPSection(kwId, dayIdx, shift, 'tasks'),
    columns: [
      sdpDeleteColumn(kwId, dayIdx, shift, 'tasks'),
      { title: 'Fachdienst', field: 'fachdienst', editor: sdpNativeSelectEditor(FACHDIENST_VALUES, '— Fachdienst —'), widthGrow: 1 },
      { title: 'Bauteil', field: 'bauteil', editor: sdpBauteilEditor, widthGrow: 1.2 },
      { title: 'Tätigkeit', field: 'taetigkeit', editor: 'input', widthGrow: 2 },
      { title: 'Beschreibung', field: 'beschreibung', editor: 'input', widthGrow: 2 },
      { title: 'Bereich / Ort', field: 'location', editor: 'input', widthGrow: 1 },
      sdpResStatusColumn(118),
      { title: 'Notizen', field: 'notes', editor: 'input', widthGrow: 1 },
    ],
  });

  sdpTables.personal = new Tabulator('#sdp-tbl-personal', {
    data: getSection(kwId, dayIdx, shift, 'personal').map(d => ({...d})),
    layout: 'fitColumns', height: 'auto', maxHeight: '260px', history: true,
    rowContextMenu: buildSdpRowContextMenu(kwId, dayIdx, shift, 'personal'),
    cellEdited:  () => saveSDPSection(kwId, dayIdx, shift, 'personal'),
    rowDeleted:  () => saveSDPSection(kwId, dayIdx, shift, 'personal'),
    columns: [
      sdpDeleteColumn(kwId, dayIdx, shift, 'personal'),
      { title: 'Funktion', field: 'funktion', widthGrow: 1,
        editor: sdpNativeSelectEditor(SDP_FUNKTION_VALUES) },
      { title: 'Name', field: 'name', editor: 'input', widthGrow: 2 },
      sdpResStatusColumn(118),
      { title: 'Bemerkung', field: 'bemerkung', editor: 'input', widthGrow: 1 },
    ],
  });

  sdpTables.inventar = new Tabulator('#sdp-tbl-inventar', {
    data: getSection(kwId, dayIdx, shift, 'inventar').map(d => ({...d})),
    layout: 'fitColumns', height: 'auto', maxHeight: '260px', history: true,
    rowContextMenu: buildSdpRowContextMenu(kwId, dayIdx, shift, 'inventar'),
    cellEdited:  () => saveSDPSection(kwId, dayIdx, shift, 'inventar'),
    rowDeleted:  () => saveSDPSection(kwId, dayIdx, shift, 'inventar'),
    columns: [
      sdpDeleteColumn(kwId, dayIdx, shift, 'inventar'),
      { title: 'Gerät / Inventar', field: 'geraet',   editor: 'input', widthGrow: 2 },
      { title: 'Anzahl',           field: 'anzahl',   editor: 'number', width: 75, hozAlign: 'right' },
      sdpResStatusColumn(118),
      { title: 'Bemerkung',        field: 'bemerkung', editor: 'input', widthGrow: 1 },
    ],
  });

  sdpTables.material = new Tabulator('#sdp-tbl-material', {
    data: getSection(kwId, dayIdx, shift, 'material').map(d => ({...d})),
    layout: 'fitColumns', height: 'auto', maxHeight: '260px', history: true,
    rowContextMenu: buildSdpRowContextMenu(kwId, dayIdx, shift, 'material'),
    cellEdited:  () => saveSDPSection(kwId, dayIdx, shift, 'material'),
    rowDeleted:  () => saveSDPSection(kwId, dayIdx, shift, 'material'),
    columns: [
      sdpDeleteColumn(kwId, dayIdx, shift, 'material'),
      { title: 'Material',  field: 'material', editor: 'input',  widthGrow: 2 },
      { title: 'Menge',     field: 'menge',    editor: 'number', width: 75, hozAlign: 'right' },
      { title: 'Einheit',   field: 'einheit',  editor: 'list',   width: 82,
        editorParams: { values: ['m','m²','m³','kg','t','Stk','Psch','h','l','lfm'], autocomplete: true } },
      sdpResStatusColumn(118),
      { title: 'Bemerkung', field: 'bemerkung', editor: 'input', widthGrow: 1 },
    ],
  });

  sdpTables.fremdleistung = new Tabulator('#sdp-tbl-fremdleistung', {
    data: getSection(kwId, dayIdx, shift, 'fremdleistung').map(d => ({...d})),
    layout: 'fitColumns', height: 'auto', maxHeight: '260px', history: true,
    rowContextMenu: buildSdpRowContextMenu(kwId, dayIdx, shift, 'fremdleistung'),
    cellEdited:  () => saveSDPSection(kwId, dayIdx, shift, 'fremdleistung'),
    rowDeleted:  () => saveSDPSection(kwId, dayIdx, shift, 'fremdleistung'),
    columns: [
      sdpDeleteColumn(kwId, dayIdx, shift, 'fremdleistung'),
      { title: 'Firma',     field: 'firma',    editor: 'input', widthGrow: 1 },
      { title: 'Leistung',  field: 'leistung', editor: 'input', widthGrow: 2 },
      sdpResStatusColumn(118),
      { title: 'Bemerkung', field: 'bemerkung', editor: 'input', widthGrow: 1 },
    ],
  });

  sdpTables.intervalle = new Tabulator('#sdp-tbl-intervalle', {
    data: getSection(kwId, dayIdx, shift, 'intervalle').map(d => ({...d})),
    layout: 'fitColumns', height: 'auto', maxHeight: '260px', history: true,
    rowContextMenu: buildSdpRowContextMenu(kwId, dayIdx, shift, 'intervalle'),
    cellEdited:  () => saveSDPSection(kwId, dayIdx, shift, 'intervalle'),
    rowDeleted:  () => saveSDPSection(kwId, dayIdx, shift, 'intervalle'),
    columns: [
      sdpDeleteColumn(kwId, dayIdx, shift, 'intervalle'),
      { title: 'BAB-Nr',   field: 'babNr',   editor: 'input', width: 80 },
      { title: 'BAB-Datei', field: 'babDatei', editor: 'input', widthGrow: 1 },
      { title: 'BAB Titel', field: 'babTitel', editor: 'input', widthGrow: 2 },
      { title: 'Status', field: 'status', width: 160,
        editor: sdpNativeSelectEditor(SDP_INTERVALLE_STATUS_VALUES) },
      { title: 'Gleissperrungen', field: 'gleissperrungen', editor: 'input', widthGrow: 1 },
      { title: 'Fahrleitungsausschaltungen', field: 'fahrleitungsausschaltungen', editor: 'input', widthGrow: 1 },
      { title: 'Von Datum', field: 'vonDatum', editor: 'input', width: 110,
        editorParams: { elementAttributes: { type: 'date' } } },
      { title: 'Von Zeit', field: 'vonZeit', editor: 'input', width: 80,
        editorParams: { elementAttributes: { type: 'time' } } },
      { title: 'Bis Datum', field: 'bisDatum', editor: 'input', width: 110,
        editorParams: { elementAttributes: { type: 'date' } } },
      { title: 'Bis Zeit', field: 'bisZeit', editor: 'input', width: 80,
        editorParams: { elementAttributes: { type: 'time' } } },
    ],
  });

  updateSDPCounts();
}

function serializeSDPTable(tbl) {
  return tbl.getData().map(d => {
    const clean = { id: d.id || Math.random().toString(36).slice(2) };
    Object.entries(d).forEach(([k, v]) => { if (!k.startsWith('_')) clean[k] = v; });
    return clean;
  });
}

function flushOpenSDPTables() {
  if (!selectedCell) return;
  const { kwId, dayIdx, shift } = selectedCell;
  const key = wiKey(kwId, dayIdx, shift);
  let touched = false;
  for (const section of SDP_SECTIONS) {
    const tbl = sdpTables[section];
    if (!tbl) continue;
    if (!workItems[key]) workItems[key] = {};
    workItems[key][section] = serializeSDPTable(tbl);
    touched = true;
  }
  if (!touched) return;
  saveWorkItemsLS();
  markDirty();
  updateStats();
  updateSDPCounts();
  renderTimeline();
  renderKWList();
}

function saveSDPSection(kwId, dayIdx, shift, section) {
  const tbl = sdpTables[section];
  if (!tbl) return;
  setSection(kwId, dayIdx, shift, section, serializeSDPTable(tbl));
  updateSDPCounts();
  renderTimeline();
  renderKWList();
}

function addSDPRow(section) {
  if (!sdpTables[section] || !selectedCell) return;
  sdpTables[section].addRow({});
  saveSDPSection(selectedCell.kwId, selectedCell.dayIdx, selectedCell.shift, section);
}
