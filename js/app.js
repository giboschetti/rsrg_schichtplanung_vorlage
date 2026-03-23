// ─── Constants ──────────────────────────────────────────────────────────────

const SCHICHTEN = ['Tag', 'Nacht', 'Früh', 'Spät', 'Bereitschaft'];
const EINHEITEN = ['m', 'm²', 'm³', 'kg', 't', 'Stk', 'Psch', 'h', 'l', 'lfm'];
const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const TL_DAYS   = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
/** Kurzmonate für Timeline-Kopfzeile (z.B. Mo / 15.Jun) */
const TL_MONTH_DE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const TL_SHIFTS = [{ id: 'T', label: 'Tag', cls: 'sh-t' }, { id: 'N', label: 'Nacht', cls: 'sh-n' }];

// Each group maps to a section key in workItems cell
const TL_GROUPS = [
  { id: 'tasks',         label: 'Tätigkeiten',  section: 'tasks' },
  { id: 'personal',      label: 'Personal',        section: 'personal' },
  { id: 'inventar',      label: 'Inventar',        section: 'inventar' },
  { id: 'material',      label: 'Material',        section: 'material' },
  { id: 'fremdleistung', label: 'Fremdleistung',   section: 'fremdleistung' },
];

// ─── State ──────────────────────────────────────────────────────────────────

const tables = {};
const kwList = []; // [{id, label, num, year, dateFrom, dateTo}]

// workItems[key] = {
//   tasks:         [{id, name, beschreibung, location, resStatus, notes}]
//   personal:      [{id, name, funktion, resStatus, bemerkung}]
//   inventar:      [{id, geraet, anzahl, resStatus, bemerkung}]
//   material:      [{id, material, menge, einheit, resStatus, bemerkung}]
//   fremdleistung: [{id, firma, leistung, resStatus, bemerkung}]
// }
const workItems = {};

let tlZoom = 'shifts';
const tlFilter = { tasks: true, personal: true, inventar: true, material: true, fremdleistung: true };
let selectedCell = null; // { kwId, dayIdx, shift }
/** Zuletzt angeklickte Schicht-Zelle (Schichten-Ansicht) — bleibt nach Schliessen des Panels für Strg+C erhalten */
let timelineShiftFocus = null;
/** Fallback, falls navigator.clipboard eingeschränkt ist */
let shiftClipboardInternal = null;
const sdpTables = {}; // { tasks: Tabulator, personal: Tabulator, ... }

let shiftConfig = { tag: { von: '07:00', bis: '19:00' }, nacht: { von: '19:00', bis: '07:00' } };

// ─── Dirty / Clean ───────────────────────────────────────────────────────────

function markDirty() { document.getElementById('btnSave')?.classList.add('dirty'); }
function markClean()  { document.getElementById('btnSave')?.classList.remove('dirty'); }

// ─── Toast ───────────────────────────────────────────────────────────────────

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

// ─── LocalStorage ────────────────────────────────────────────────────────────

function saveTbl(id) {
  if (!tables[id]) return;
  try { localStorage.setItem('t_' + id, JSON.stringify(tables[id].getData())); }
  catch(e) { console.warn('Save error', e); }
  markDirty();
}

function loadTbl(id) {
  try { const r = localStorage.getItem('t_' + id); return r ? JSON.parse(r) : null; }
  catch(e) { return null; }
}

function saveKWList() {
  localStorage.setItem('kwList', JSON.stringify(kwList));
  markDirty();
}

function loadKWList() {
  try { const r = localStorage.getItem('kwList'); return r ? JSON.parse(r) : []; }
  catch(e) { return []; }
}

function saveStammdaten() {
  const ids = ['projektname','projektnummer','auftraggeber','bauleiter','polier','standort','baubeginn','bauende'];
  const data = {};
  ids.forEach(id => { const el = document.getElementById('sd-' + id); if (el) data[id] = el.value; });
  localStorage.setItem('stammdaten', JSON.stringify(data));
  markDirty();
}

function loadStammdaten() {
  try {
    const r = localStorage.getItem('stammdaten');
    if (!r) return;
    const data = JSON.parse(r);
    Object.entries(data).forEach(([k, v]) => {
      const el = document.getElementById('sd-' + k);
      if (el) el.value = v;
    });
  } catch(e) {}
}

function saveShiftConfig() {
  shiftConfig = {
    tag:   { von: document.getElementById('sh-tag-von')?.value   || '07:00',
             bis: document.getElementById('sh-tag-bis')?.value   || '19:00' },
    nacht: { von: document.getElementById('sh-nacht-von')?.value || '19:00',
             bis: document.getElementById('sh-nacht-bis')?.value || '07:00' },
  };
  localStorage.setItem('shiftConfig', JSON.stringify(shiftConfig));
  markDirty();
}

function loadShiftConfig() {
  try {
    const r = localStorage.getItem('shiftConfig');
    if (r) shiftConfig = JSON.parse(r);
  } catch(e) {}
  const s = id => document.getElementById(id);
  if (s('sh-tag-von'))   s('sh-tag-von').value   = shiftConfig.tag?.von   || '07:00';
  if (s('sh-tag-bis'))   s('sh-tag-bis').value   = shiftConfig.tag?.bis   || '19:00';
  if (s('sh-nacht-von')) s('sh-nacht-von').value = shiftConfig.nacht?.von || '19:00';
  if (s('sh-nacht-bis')) s('sh-nacht-bis').value = shiftConfig.nacht?.bis || '07:00';
}

function updateHeaderProj() {
  const el = document.getElementById('headerProjName');
  if (el) el.textContent = document.getElementById('sd-projektname')?.value || '';
}

// ─── Tab Management ──────────────────────────────────────────────────────────

function switchTab(pageId) {
  flushOpenSDPTables();
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.page === pageId));
  document.querySelectorAll('.page').forEach(p =>
    p.classList.toggle('active', p.id === 'page-' + pageId));
  if (pageId === 'uebersicht') { updateStats(); renderTimeline(); renderKWList(); }
}

function openAddKWModal() {
  document.getElementById('kwNum').value  = '';
  document.getElementById('kwYear').value = new Date().getFullYear();
  document.getElementById('kwFrom').value = '';
  document.getElementById('kwTo').value   = '';
  document.getElementById('addKWModal').classList.add('open');
  setTimeout(() => document.getElementById('kwNum').focus(), 80);
}

function closeModal() {
  document.getElementById('addKWModal').classList.remove('open');
}

// ─── Bulk Add Resources ────────────────────────────────────────────────────

function toYMD(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/** Returns [{kwId, dayIdx, shift}, ...] for all cells in date range, selected shifts, and allowed days.
 * allowedDays: array of dayIdx 0-6 (0=Mo .. 5=Sa, 6=So). If null/undefined, all days included. */
function getTargetCellsFromDateRange(dateFromStr, dateToStr, shifts, allowedDays) {
  const targets = [];
  const from = parseLocalYMD(dateFromStr);
  const to = parseLocalYMD(dateToStr);
  if (!from || !to || from > to) return targets;
  const shiftsArr = shifts || ['T', 'N'];
  const dayFilter = Array.isArray(allowedDays) ? new Set(allowedDays) : null;
  for (const kw of kwList) {
    const mon = mondayDateForKw(kw);
    if (!mon) continue;
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      if (dayFilter && !dayFilter.has(dayIdx)) continue;
      const d = addDaysLocal(mon, dayIdx);
      const ymd = toYMD(d);
      if (ymd >= dateFromStr && ymd <= dateToStr) {
        for (const shift of shiftsArr) {
          if (shift === 'T' || shift === 'N') targets.push({ kwId: kw.id, dayIdx, shift });
        }
      }
    }
  }
  return targets;
}

function openBulkAddModal() {
  if (!kwList.length) {
    showToast('Zuerst Kalenderwochen hinzufügen');
    return;
  }
  const firstKw = kwList[0];
  const lastKw = kwList[kwList.length - 1];
  const fromMon = mondayDateForKw(firstKw);
  const toSun = fromMon ? addDaysLocal(fromMon, 6) : null;
  const toMon = lastKw ? mondayDateForKw(lastKw) : null;
  const toSunLast = toMon ? addDaysLocal(toMon, 6) : null;
  const elFrom = document.getElementById('bulkAddFrom');
  const elTo = document.getElementById('bulkAddTo');
  if (elFrom && fromMon) elFrom.value = toYMD(fromMon);
  if (elTo && toSunLast) elTo.value = toYMD(toSunLast);
  else if (elTo && toSun) elTo.value = toYMD(toSun);
  document.getElementById('bulkAddShiftTag').checked = true;
  document.getElementById('bulkAddShiftNacht').checked = true;
  document.getElementById('bulkAddDaySa').checked = true;
  document.getElementById('bulkAddDaySo').checked = true;
  bulkAddTypeChanged();
  updateBulkAddPreview();
  ['bulkAddFrom', 'bulkAddTo', 'bulkAddShiftTag', 'bulkAddShiftNacht', 'bulkAddDaySa', 'bulkAddDaySo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateBulkAddPreview);
  });
  document.getElementById('bulkAddModal').classList.add('open');
  setTimeout(() => document.getElementById('bulkAddType')?.focus(), 80);
}

function closeBulkAddModal() {
  document.getElementById('bulkAddModal').classList.remove('open');
  ['bulkAddFrom', 'bulkAddTo', 'bulkAddShiftTag', 'bulkAddShiftNacht', 'bulkAddDaySa', 'bulkAddDaySo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.removeEventListener('change', updateBulkAddPreview);
  });
}

function bulkAddTypeChanged() {
  const type = document.getElementById('bulkAddType')?.value || 'personal';
  document.querySelectorAll('.bulk-add-type-panel').forEach(panel => {
    panel.style.display = panel.dataset.type === type ? '' : 'none';
  });
  updateBulkAddPreview();
}

function getBulkAddAllowedDays() {
  const sa = document.getElementById('bulkAddDaySa')?.checked;
  const so = document.getElementById('bulkAddDaySo')?.checked;
  const days = [0, 1, 2, 3, 4]; // Mo–Fr always
  if (sa) days.push(5);
  if (so) days.push(6);
  return days;
}

function updateBulkAddPreview() {
  const from = document.getElementById('bulkAddFrom')?.value || '';
  const to = document.getElementById('bulkAddTo')?.value || '';
  const tag = document.getElementById('bulkAddShiftTag')?.checked;
  const nacht = document.getElementById('bulkAddShiftNacht')?.checked;
  const shifts = [];
  if (tag) shifts.push('T');
  if (nacht) shifts.push('N');
  const allowedDays = getBulkAddAllowedDays();
  const targets = getTargetCellsFromDateRange(from, to, shifts, allowedDays);
  const el = document.getElementById('bulkAddPreview');
  if (!el) return;
  if (targets.length === 0) {
    el.textContent = from && to ? 'Keine Schichten im Zeitraum oder keine KW vorhanden.' : '';
    el.className = 'bulk-add-preview';
  } else {
    el.textContent = 'Wird in ' + targets.length + ' Schichten eingetragen.';
    el.className = 'bulk-add-preview active';
  }
}

function collectBulkAddData(section) {
  const row = { id: Math.random().toString(36).slice(2) };
  if (section === 'personal') {
    row.name = (document.getElementById('bulk-personal-name')?.value || '').trim();
    row.funktion = (document.getElementById('bulk-personal-funktion')?.value || '').trim();
    row.resStatus = (document.getElementById('bulk-personal-status')?.value || '').trim();
    row.bemerkung = (document.getElementById('bulk-personal-bemerkung')?.value || '').trim();
  } else if (section === 'material') {
    row.material = (document.getElementById('bulk-material-material')?.value || '').trim();
    const menge = document.getElementById('bulk-material-menge')?.value;
    row.menge = menge !== '' && menge != null ? parseFloat(menge) : null;
    row.einheit = (document.getElementById('bulk-material-einheit')?.value || '').trim();
    row.resStatus = (document.getElementById('bulk-material-status')?.value || '').trim();
    row.bemerkung = (document.getElementById('bulk-material-bemerkung')?.value || '').trim();
  } else if (section === 'inventar') {
    row.geraet = (document.getElementById('bulk-inventar-geraet')?.value || '').trim();
    const anzahl = document.getElementById('bulk-inventar-anzahl')?.value;
    row.anzahl = anzahl !== '' && anzahl != null ? parseInt(anzahl, 10) : null;
    row.resStatus = (document.getElementById('bulk-inventar-status')?.value || '').trim();
    row.bemerkung = (document.getElementById('bulk-inventar-bemerkung')?.value || '').trim();
  } else if (section === 'tasks') {
    row.name = (document.getElementById('bulk-tasks-name')?.value || '').trim();
    row.beschreibung = (document.getElementById('bulk-tasks-beschreibung')?.value || '').trim();
    row.location = (document.getElementById('bulk-tasks-location')?.value || '').trim();
    row.resStatus = (document.getElementById('bulk-tasks-status')?.value || '').trim();
    row.notes = (document.getElementById('bulk-tasks-notes')?.value || '').trim();
  } else if (section === 'fremdleistung') {
    row.firma = (document.getElementById('bulk-fremdleistung-firma')?.value || '').trim();
    row.leistung = (document.getElementById('bulk-fremdleistung-leistung')?.value || '').trim();
    row.resStatus = (document.getElementById('bulk-fremdleistung-status')?.value || '').trim();
    row.bemerkung = (document.getElementById('bulk-fremdleistung-bemerkung')?.value || '').trim();
  }
  return row;
}

function hasBulkAddRequiredField(section, row) {
  if (section === 'personal') return !!row.name;
  if (section === 'material') return !!row.material;
  if (section === 'inventar') return !!row.geraet;
  if (section === 'tasks') return !!row.name;
  if (section === 'fremdleistung') return !!row.firma;
  return false;
}

function confirmBulkAdd() {
  const section = document.getElementById('bulkAddType')?.value;
  if (!section) return;
  const from = document.getElementById('bulkAddFrom')?.value;
  const to = document.getElementById('bulkAddTo')?.value;
  if (!from || !to) {
    showToast('Zeitraum (Von/Bis) angeben');
    return;
  }
  const tag = document.getElementById('bulkAddShiftTag')?.checked;
  const nacht = document.getElementById('bulkAddShiftNacht')?.checked;
  const shifts = [];
  if (tag) shifts.push('T');
  if (nacht) shifts.push('N');
  if (!shifts.length) {
    showToast('Mindestens eine Schicht (Tag oder Nacht) auswählen');
    return;
  }
  const allowedDays = getBulkAddAllowedDays();
  const row = collectBulkAddData(section);
  if (!hasBulkAddRequiredField(section, row)) {
    const labels = { personal: 'Name', material: 'Material', inventar: 'Gerät/Inventar', tasks: 'Tätigkeit', fremdleistung: 'Firma' };
    showToast('Pflichtfeld angeben: ' + (labels[section] || section));
    return;
  }
  const targets = getTargetCellsFromDateRange(from, to, shifts, allowedDays);
  if (!targets.length) {
    showToast('Keine Schichten im gewählten Zeitraum');
    return;
  }
  flushOpenSDPTables();
  for (const { kwId, dayIdx, shift } of targets) {
    const key = wiKey(kwId, dayIdx, shift);
    if (!workItems[key]) workItems[key] = {};
    const existing = workItems[key][section] || [];
    const newRow = { ...row, id: Math.random().toString(36).slice(2) };
    workItems[key][section] = [...existing, newRow];
  }
  saveWorkItemsLS();
  markDirty();
  updateStats();
  renderTimeline();
  renderKWList();
  closeBulkAddModal();
  showToast('Ressource in ' + targets.length + ' Schichten hinzugefügt');
}

function confirmAddKW() {
  const num  = parseInt(document.getElementById('kwNum').value);
  const year = parseInt(document.getElementById('kwYear').value);
  const from = document.getElementById('kwFrom').value;
  const to   = document.getElementById('kwTo').value;

  if (!num || num < 1 || num > 53) { alert('Bitte eine gültige KW-Nummer eingeben (1–53).'); return; }
  if (!year || year < 2020)         { alert('Bitte ein gültiges Jahr eingeben.'); return; }

  const kwId    = 'kw_' + year + '_' + String(num).padStart(2, '0');
  const kwLabel = 'KW ' + String(num).padStart(2, '0') + ' / ' + year;

  if (kwList.find(k => k.id === kwId)) { alert('Diese KW existiert bereits.'); return; }

  const kwData = { id: kwId, label: kwLabel, num, year, dateFrom: from, dateTo: to };
  kwList.push(kwData);
  kwList.sort((a, b) => a.year !== b.year ? a.year - b.year : a.num - b.num);

  saveKWList();
  closeModal();
  renderKWList();
  renderTimeline();
  updateStats();
  showToast(kwLabel + ' hinzugefügt');
}

function removeKW(kwId) {
  const kw = kwList.find(k => k.id === kwId);
  if (!kw) return;
  if (!confirm('"' + kw.label + '" wirklich entfernen?\nAlle Daten dieser KW gehen verloren.')) return;

  kwList.splice(kwList.indexOf(kw), 1);

  // Remove workItems for this KW
  Object.keys(workItems).filter(k => k.startsWith(kwId + '||')).forEach(k => delete workItems[k]);

  saveKWList();
  saveWorkItemsLS();
  renderKWList();
  renderTimeline();
  updateStats();
  showToast(kw.label + ' entfernt');
}

function renderKWList() {
  const container = document.getElementById('kwListContainer');
  if (!container) return;
  if (!kwList.length) {
    container.innerHTML = '<div class="kw-empty">Noch keine Kalenderwochen vorhanden.</div>';
    return;
  }
  container.innerHTML = kwList.map(kw => {
    const dr = (kw.dateFrom && kw.dateTo)
      ? `<span class="date-range">${fmtDate(kw.dateFrom)} – ${fmtDate(kw.dateTo)}</span>`
      : '';
    // Count total entries for this KW
    let count = 0;
    Object.entries(workItems).forEach(([key, cell]) => {
      if (!key.startsWith(kw.id + '||') || !cell || typeof cell !== 'object') return;
      Object.values(cell).forEach(arr => { if (Array.isArray(arr)) count += arr.length; });
    });
    return `
      <div class="kw-list-item">
        <div class="kw-list-label">
          <span class="kw-badge">${kw.label}</span>
          ${dr}
          ${count ? `<span style="font-size:11px;color:var(--text-muted)">${count} Einträge</span>` : ''}
        </div>
        <button class="btn btn-danger" style="padding:3px 8px;font-size:10px"
          onclick="removeKW('${kw.id}')">✕ Entfernen</button>
      </div>`;
  }).join('');
}

// ─── WorkItems Persistence ────────────────────────────────────────────────────

function wiKey(kwId, dayIdx, shift) { return kwId + '||' + dayIdx + '||' + shift; }

const SHIFT_CLIP_SECTIONS = ['tasks', 'personal', 'inventar', 'material', 'fremdleistung'];

function isUebersichtPageActive() {
  return document.getElementById('page-uebersicht')?.classList.contains('active');
}

function isTimelineClipboardTargetEditable(el) {
  if (!el || el.nodeType !== 1) return false;
  if (document.getElementById('addKWModal')?.classList.contains('open')) return true;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  if (el.closest('.tabulator')) return true;
  return false;
}

function getShiftPayloadFromStore(kwId, dayIdx, shift) {
  const key = wiKey(kwId, dayIdx, shift);
  const cell = workItems[key];
  const out = {};
  SHIFT_CLIP_SECTIONS.forEach(s => {
    out[s] = JSON.parse(JSON.stringify(Array.isArray(cell?.[s]) ? cell[s] : []));
  });
  return out;
}

function regenerateShiftPayloadIds(payload) {
  const out = {};
  SHIFT_CLIP_SECTIONS.forEach(s => {
    out[s] = (payload[s] || []).map(r => {
      const row = { ...r };
      row.id = Math.random().toString(36).slice(2);
      return row;
    });
  });
  return out;
}

function parseShiftClipboardPayload(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();
  if (!t.startsWith('{')) return null;
  try {
    const o = JSON.parse(t);
    if (o._schichtplanungShiftV1 && o.sections && typeof o.sections === 'object') return o.sections;
  } catch (_) { return null; }
  return null;
}

function applyShiftPayloadToCell(kwId, dayIdx, shift, payload) {
  flushOpenSDPTables();
  const key = wiKey(kwId, dayIdx, shift);
  workItems[key] = regenerateShiftPayloadIds(payload);
  saveWorkItemsLS();
  markDirty();
  updateStats();
  renderTimeline();
  renderKWList();
  if (selectedCell && selectedCell.kwId === kwId && selectedCell.dayIdx === dayIdx && selectedCell.shift === shift) {
    initSDPTables(kwId, dayIdx, shift);
    selectedCell.grp ? showOnlySDPSection(selectedCell.grp) : showAllSDPSections();
  }
}

function applySectionToShift(kwId, dayIdx, shift, section, data) {
  const key = wiKey(kwId, dayIdx, shift);
  if (!workItems[key]) workItems[key] = {};
  const regenerated = regenerateShiftPayloadIds({ [section]: data });
  workItems[key][section] = regenerated[section];
  saveWorkItemsLS();
  markDirty();
  updateStats();
  renderTimeline();
  renderKWList();
  if (selectedCell && selectedCell.kwId === kwId && selectedCell.dayIdx === dayIdx && selectedCell.shift === shift) {
    if (sdpTables[section]) sdpTables[section].setData(getSection(kwId, dayIdx, shift, section));
  }
}

function copyTimelineShiftToClipboard() {
  if (!timelineShiftFocus) {
    showToast('Zuerst eine Schicht-Zelle anklicken (Ansicht „Schichten“)');
    return;
  }
  const { kwId, dayIdx, shift, grp } = timelineShiftFocus;
  let sections;
  if (grp) {
    sections = { [grp]: JSON.parse(JSON.stringify(getSection(kwId, dayIdx, shift, grp))) };
  } else {
    sections = getShiftPayloadFromStore(kwId, dayIdx, shift);
  }
  const wrap = { _schichtplanungShiftV1: true, sections };
  shiftClipboardInternal = wrap;
  const json = JSON.stringify(wrap);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(json).then(() => {
      showToast(grp ? 'Ressource kopiert (Strg+V auf Ziel-Zelle)' : 'Schicht kopiert (Strg+V auf Ziel-Schicht)');
    }).catch(() => showToast('Kopiert'));
  } else {
    showToast('Kopiert');
  }
}

function pasteTimelineShiftFromClipboard() {
  if (!timelineShiftFocus) {
    showToast('Ziel-Schicht-Zelle anklicken, dann Strg+V');
    return;
  }
  const { kwId, dayIdx, shift } = timelineShiftFocus;
  const apply = (sections) => {
    if (!sections || typeof sections !== 'object') {
      showToast('Keine Schicht-Daten in der Zwischenablage');
      return;
    }
    const sectionKeys = Object.keys(sections).filter(k => SHIFT_CLIP_SECTIONS.includes(k));
    if (sectionKeys.length === 1) {
      const clipSection = sectionKeys[0];
      if (timelineShiftFocus.grp && clipSection !== timelineShiftFocus.grp) {
        const fromLbl = TL_GROUPS.find(g => g.id === clipSection)?.label || clipSection;
        const toLbl = TL_GROUPS.find(g => g.id === timelineShiftFocus.grp)?.label || timelineShiftFocus.grp;
        alert('Verschiedene Ressourcen-Typen – Einfügen nicht möglich.\n\nKopiert: ' + fromLbl + '\nZiel: ' + toLbl);
        return;
      }
      applySectionToShift(kwId, dayIdx, shift, clipSection, sections[clipSection]);
      showToast('Ressource eingefügt');
    } else {
      const fullPayload = {};
      SHIFT_CLIP_SECTIONS.forEach(s => { fullPayload[s] = sections[s] || []; });
      applyShiftPayloadToCell(kwId, dayIdx, shift, fullPayload);
      showToast('Schicht eingefügt');
    }
  };
  if (navigator.clipboard?.readText) {
    navigator.clipboard.readText().then(text => {
      let sections = parseShiftClipboardPayload(text);
      if (!sections && shiftClipboardInternal?.sections) sections = shiftClipboardInternal.sections;
      apply(sections);
    }).catch(() => {
      apply(shiftClipboardInternal?.sections || null);
    });
  } else {
    apply(shiftClipboardInternal?.sections || null);
  }
}

function getSection(kwId, dayIdx, shift, section) {
  const cell = workItems[wiKey(kwId, dayIdx, shift)] || {};
  return cell[section] || [];
}

function setSection(kwId, dayIdx, shift, section, data) {
  const key = wiKey(kwId, dayIdx, shift);
  if (!workItems[key]) workItems[key] = {};
  workItems[key][section] = data;
  saveWorkItemsLS();
  markDirty();
  updateStats();
}

function saveWorkItemsLS() {
  try { localStorage.setItem('workItems', JSON.stringify(workItems)); } catch(e) {}
}

function loadWorkItemsLS() {
  try {
    const r = localStorage.getItem('workItems');
    if (r) {
      const loaded = JSON.parse(r);
      // Migration: if old format was array, convert to new object format
      Object.entries(loaded).forEach(([key, val]) => {
        if (Array.isArray(val)) {
          // Old format: array of items with groups field → migrate to tasks
          workItems[key] = { tasks: val.map(it => ({
            id: it.id || Math.random().toString(36).slice(2),
            name: it.name || '',
            beschreibung: it.beschreibung || '',
            location: it.location || '',
            resStatus: it.resStatus || '',
            notes: it.notes || '',
          })), personal: [], inventar: [], material: [], fremdleistung: [] };
        } else {
          workItems[key] = val;
        }
      });
      // Migrate tasks to new schema (remove category, status; add beschreibung)
      Object.values(workItems).forEach(cell => {
        if (cell?.tasks) {
          cell.tasks = cell.tasks.map(it => {
            const { category, status, ...rest } = it;
            return { beschreibung: '', ...rest, resStatus: rest.resStatus ?? '' };
          });
        }
      });
    }
  } catch(e) {}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return d + '.' + m + '.' + y;
}

function parseLocalYMD(s) {
  if (!s || typeof s !== 'string') return null;
  const p = s.split('-');
  if (p.length !== 3) return null;
  const y = +p[0], m = +p[1], d = +p[2];
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

function addDaysLocal(date, n) {
  const x = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

/** Montag der ISO-Kalenderwoche (lokal), gängiger JS-Ansatz */
function isoWeekMondayLocal(year, week) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const monday = new Date(simple);
  const dow = simple.getDay();
  if (dow <= 4)
    monday.setDate(simple.getDate() - simple.getDay() + 1);
  else
    monday.setDate(simple.getDate() + 8 - simple.getDay());
  return monday;
}

/** Montag der KW: bevorzugt „Datum von“ (Mo), sonst aus Jahr + KW-Nummer */
function mondayDateForKw(kw) {
  if (!kw) return null;
  const from = parseLocalYMD(kw.dateFrom);
  if (from) return from;
  if (kw.year != null && kw.num != null) return isoWeekMondayLocal(kw.year, kw.num);
  return null;
}

/** Ein Zeile Text, z.B. Mo 15.Jun (für Titel, SDP) */
function tlDayPlain(kw, dayIdx) {
  const mon = mondayDateForKw(kw);
  if (!mon || dayIdx < 0 || dayIdx > 6) return TL_DAYS[dayIdx] || '';
  const d = addDaysLocal(mon, dayIdx);
  return `${TL_DAYS[dayIdx]} ${d.getDate()}.${TL_MONTH_DE[d.getMonth()]}`;
}

/** PDF day header: "Mo - 12. Jun - Tag" (or Nacht) */
function tlPdfDayHeader(kw, dayIdx, shiftId) {
  const mon = mondayDateForKw(kw);
  if (!mon || dayIdx < 0 || dayIdx > 6) return TL_DAYS[dayIdx] + (shiftId === 'T' ? ' T' : ' N');
  const d = addDaysLocal(mon, dayIdx);
  const dateStr = `${d.getDate()}. ${TL_MONTH_DE[d.getMonth()]}`;
  const shiftLabel = shiftId === 'T' ? 'Tag' : 'Nacht';
  return `${TL_DAYS[dayIdx]} - ${dateStr} - ${shiftLabel}`;
}

/** HTML für Tabellenkopf: Mo + Zeilenumbruch + 15.Jun */
function tlDayThHtml(kw, dayIdx) {
  const mon = mondayDateForKw(kw);
  if (!mon || dayIdx < 0 || dayIdx > 6) return TL_DAYS[dayIdx] || '';
  const d = addDaysLocal(mon, dayIdx);
  const sub = `${d.getDate()}.${TL_MONTH_DE[d.getMonth()]}`;
  return `${TL_DAYS[dayIdx]}<span class="tl-date-sub">${sub}</span>`;
}

function addRow(id) {
  if (!tables[id]) return;
  tables[id].addRow({});
  saveTbl(id);
}

function toggleSection(hdr) {
  hdr.classList.toggle('collapsed');
  hdr.nextElementSibling.classList.toggle('collapsed');
}

function toggleSDPSection(hdr) {
  hdr.classList.toggle('collapsed');
  hdr.nextElementSibling.classList.toggle('collapsed');
}

function collapseAllSDPSections() {
  document.querySelectorAll('#shiftDetailPanel .sdp-section-hdr').forEach(hdr => {
    hdr.classList.add('collapsed');
    const body = hdr.nextElementSibling;
    if (body && body.classList.contains('sdp-section-body')) body.classList.add('collapsed');
  });
}

function showOnlySDPSection(grp) {
  document.querySelectorAll('#shiftDetailPanel .sdp-section').forEach(sec => {
    if (sec.dataset.grp === grp) {
      sec.classList.remove('sdp-section-hidden');
      const hdr = sec.querySelector('.sdp-section-hdr');
      const body = sec.querySelector('.sdp-section-body');
      if (hdr) hdr.classList.remove('collapsed');
      if (body) body.classList.remove('collapsed');
    } else {
      sec.classList.add('sdp-section-hidden');
    }
  });
}

function showAllSDPSections() {
  document.querySelectorAll('#shiftDetailPanel .sdp-section').forEach(sec => {
    sec.classList.remove('sdp-section-hidden');
  });
  collapseAllSDPSections();
}

function updateStats() {
  /* Statistik-Karten entfernt — Platzhalter für bestehende Aufrufe */
}

// ─── Timeline Rendering ───────────────────────────────────────────────────────

function setZoom(zoom) {
  tlZoom = zoom;
  document.querySelectorAll('.zoom-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.zoom === zoom));
  renderTimeline();
}

function toggleTLFilter(grpId, btn) {
  tlFilter[grpId] = !tlFilter[grpId];
  btn.classList.toggle('active', tlFilter[grpId]);
  renderTimeline();
}

/** Fixed column widths for dual day/night grids (shared for alignment). */
function getTlColWidths() {
  const labelW = 140;
  const dayW = 40;
  return { labelW, dayW };
}

/** Build thead for a single-shift table (Tag or Nacht). */
function buildShiftsHeader(shiftId) {
  const sh = TL_SHIFTS.find(s => s.id === shiftId) || { cls: shiftId === 'T' ? 'sh-t' : 'sh-n' };
  const shiftLabel = shiftId === 'T' ? 'Tag' : 'Nacht';
  let html = '<thead><tr>';
  html += '<th class="tl-label-th" rowspan="2">Ressource</th>';
  kwList.forEach(kw => {
    html += `<th class="tl-kw-th ${sh.cls}" colspan="7">${kw.label} — ${shiftLabel}</th>`;
  });
  html += '</tr><tr>';
  kwList.forEach((kw, ki) => {
    TL_DAYS.forEach((_, dayIdx) => {
      const dayT = tlDayPlain(kw, dayIdx);
      const kwBorder = ki > 0 && dayIdx === 0 ? ' kw-border' : '';
      html += `<th class="tl-slot-th tl-day-th ${sh.cls}${kwBorder}"
        data-kw="${kw.id}" data-day="${dayIdx}" data-shift="${shiftId}"
        title="${kw.label} ${dayT} ${shiftId === 'T' ? 'Tag' : 'Nacht'}">${tlDayThHtml(kw, dayIdx)}</th>`;
    });
  });
  html += '</tr></thead>';
  return html;
}

/** Build one resource row for a single-shift table. */
function buildResRowForShift(g, shiftId) {
  const sh = TL_SHIFTS.find(s => s.id === shiftId) || { cls: shiftId === 'T' ? 'sh-t' : 'sh-n' };
  let html = `<tr class="tl-res-row"><td class="tl-label-td">${g.label}</td>`;
  kwList.forEach((kw, ki) => {
    TL_DAYS.forEach((_, dayIdx) => {
      const items = getSection(kw.id, dayIdx, shiftId, g.section);
      const kwBorder = ki > 0 && dayIdx === 0 ? ' kw-border' : '';
      html += buildCell(kw.id, dayIdx, shiftId, g, items, sh.cls + kwBorder);
    });
  });
  html += '</tr>';
  return html;
}

function renderTimeline() {
  const wrapper = document.getElementById('timelineWrapper');
  if (!wrapper) return;

  if (!kwList.length) {
    wrapper.innerHTML = '<div class="tl-empty">Noch keine Kalenderwochen vorhanden. Bitte "+ KW hinzufügen" verwenden.</div>';
    return;
  }

  const zoom = tlZoom;

  if (zoom === 'shifts') {
    const { labelW, dayW } = getTlColWidths();
    const colCount = kwList.length * 7;
    let colgroup = '<colgroup><col style="width:' + labelW + 'px">';
    for (let i = 0; i < colCount; i++) colgroup += '<col style="width:' + dayW + 'px">';
    colgroup += '</colgroup>';

    let html = '<div class="tl-dual-grid">';
    html += '<div class="tl-grid-day"><table class="tl-table tl-table-day" style="table-layout:fixed">' + colgroup;
    html += buildShiftsHeader('T');
    html += '<tbody>';
    TL_GROUPS.forEach(g => {
      if (!tlFilter[g.id]) return;
      html += buildResRowForShift(g, 'T');
    });
    html += '</tbody></table></div>';
    html += '<div class="tl-grid-night"><table class="tl-table tl-table-night" style="table-layout:fixed">' + colgroup;
    html += buildShiftsHeader('N');
    html += '<tbody>';
    TL_GROUPS.forEach(g => {
      if (!tlFilter[g.id]) return;
      html += buildResRowForShift(g, 'N');
    });
    html += '</tbody></table></div></div>';
    wrapper.innerHTML = html;
  } else {
    let html = '<table class="tl-table"><thead>';

  if (zoom === 'days') {
    html += '<tr>';
    html += '<th class="tl-label-th" rowspan="2">Ressource</th>';
    kwList.forEach(kw => {
      html += `<th class="tl-kw-th" colspan="7">${kw.label}</th>`;
    });
    html += '</tr>';

    html += '<tr>';
    kwList.forEach(kw => {
      TL_DAYS.forEach((_, dayIdx) => {
        const dayT = tlDayPlain(kw, dayIdx);
        html += `<th class="tl-slot-th drill tl-day-hdr"
          data-kw="${kw.id}" data-day="${dayIdx}"
          title="${kw.label} ${dayT} – klicken für Schichtenansicht">${tlDayThHtml(kw, dayIdx)}</th>`;
      });
    });
    html += '</tr>';

  } else { // weeks
    html += '<tr>';
    html += '<th class="tl-label-th">Ressource</th>';
    kwList.forEach(kw => {
      html += `<th class="tl-slot-th drill" data-kw="${kw.id}"
        title="${kw.label} – klicken für Tagesansicht">${kw.label}</th>`;
    });
    html += '</tr>';
  }

  html += '</thead><tbody>';

  TL_GROUPS.forEach(g => {
    if (!tlFilter[g.id]) return;
    html += buildResRow(g, zoom);
  });

  html += '</tbody></table>';
  wrapper.innerHTML = html;
  }

  // Drill-down on slot headers
  wrapper.querySelectorAll('.tl-slot-th.drill').forEach(th => {
    th.addEventListener('click', () => {
      if (zoom === 'weeks') setZoom('days');
      else if (zoom === 'days') setZoom('shifts');
    });
  });

  // Day header click → open SDP for whole shift (only in shifts zoom)
  wrapper.querySelectorAll('.tl-slot-th.tl-day-th[data-shift]').forEach(th => {
    th.addEventListener('click', () => {
      openSDP(th.dataset.kw, parseInt(th.dataset.day), th.dataset.shift, null);
    });
  });

  // Cell click → open SDP for single resource (only in shifts zoom)
  wrapper.querySelectorAll('.tl-cell[data-shift]').forEach(td => {
    td.addEventListener('click', () => {
      openSDP(td.dataset.kw, parseInt(td.dataset.day), td.dataset.shift, td.dataset.grp || null);
    });
  });
  wrapper.querySelectorAll('.tl-cell:not([data-shift])').forEach(td => {
    td.addEventListener('click', () => {
      if (zoom === 'days') setZoom('shifts');
      else if (zoom === 'weeks') setZoom('days');
    });
  });

  // Re-apply selected highlight
  if (selectedCell && zoom === 'shifts') {
    if (selectedCell.grp) {
      wrapper.querySelectorAll(
        `.tl-cell[data-kw="${selectedCell.kwId}"][data-day="${selectedCell.dayIdx}"][data-shift="${selectedCell.shift}"][data-grp="${selectedCell.grp}"]`
      ).forEach(td => td.classList.add('selected'));
    } else {
      wrapper.querySelectorAll(
        `.tl-cell[data-kw="${selectedCell.kwId}"][data-day="${selectedCell.dayIdx}"][data-shift="${selectedCell.shift}"]`
      ).forEach(td => td.classList.add('selected'));
    }
  }
}

function calcColCount() {
  if (tlZoom === 'weeks') return kwList.length;
  if (tlZoom === 'days')  return kwList.length * 7;
  return kwList.length * 14;
}

function getGroupItemsForCell(kw, dayIdx, shift, g, zoom) {
  if (zoom === 'shifts') {
    return getSection(kw.id, dayIdx, shift, g.section);
  } else if (zoom === 'days') {
    return [
      ...getSection(kw.id, dayIdx, 'T', g.section),
      ...getSection(kw.id, dayIdx, 'N', g.section),
    ];
  } else {
    let items = [];
    for (let d = 0; d < 7; d++) {
      TL_SHIFTS.forEach(sh => {
        items.push(...getSection(kw.id, d, sh.id, g.section));
      });
    }
    return items;
  }
}

function getItemLabel(item, sectionId) {
  if (sectionId === 'tasks')         return item.name     || '–';
  if (sectionId === 'personal')    return (item.name || '').trim() || '–';
  if (sectionId === 'inventar')      return item.geraet   || '–';
  if (sectionId === 'material')      return item.material || '–';
  if (sectionId === 'fremdleistung') return item.firma    || '–';
  return '–';
}

function escAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function tlBlockClassFromResStatus(it) {
  const v = it.resStatus;
  if (v === 'Planung') return 'tl-rs-planung';
  if (v === 'Bestellt') return 'tl-rs-bestellt';
  if (v === 'Bestätigt') return 'tl-rs-bestaetigt';
  return 'tl-rs-none';
}

function tlBlockTitle(it, sectionId) {
  if (sectionId === 'tasks')
    return [it.name, it.resStatus].filter(Boolean).join(' · ');
  if (sectionId === 'personal') {
    const fn = (it.funktion || '').trim();
    const nm = (it.name || '').trim();
    const who = (fn && nm) ? `${fn} – ${nm}` : (nm || fn || '');
    return [who, it.resStatus].filter(Boolean).join(' · ');
  }
  if (sectionId === 'inventar')
    return [it.geraet, it.resStatus].filter(Boolean).join(' · ');
  if (sectionId === 'material')
    return [it.material, it.resStatus].filter(Boolean).join(' · ');
  if (sectionId === 'fremdleistung')
    return [it.firma, it.leistung, it.resStatus].filter(Boolean).join(' · ');
  return '';
}

function buildResRow(g, zoom) {
  let html = `<tr class="tl-res-row">
    <td class="tl-label-td">${g.label}</td>`;

  if (zoom === 'shifts') {
    kwList.forEach((kw, ki) => {
      TL_DAYS.forEach((d, dayIdx) => {
        TL_SHIFTS.forEach(sh => {
          const items = getGroupItemsForCell(kw, dayIdx, sh.id, g, zoom);
          const kwBorder = ki > 0 && dayIdx === 0 && sh.id === 'T' ? ' kw-border' : '';
          html += buildCell(kw.id, dayIdx, sh.id, g, items, sh.cls + kwBorder);
        });
      });
    });
  } else if (zoom === 'days') {
    kwList.forEach((kw, ki) => {
      TL_DAYS.forEach((d, dayIdx) => {
        const items = getGroupItemsForCell(kw, dayIdx, null, g, zoom);
        const kwBorder = ki > 0 && dayIdx === 0 ? ' kw-border' : '';
        html += buildCell(kw.id, dayIdx, null, g, items, kwBorder);
      });
    });
  } else {
    kwList.forEach((kw, ki) => {
      const items = getGroupItemsForCell(kw, null, null, g, zoom);
      const kwBorder = ki > 0 ? ' kw-border' : '';
      html += buildCell(kw.id, null, null, g, items, kwBorder);
    });
  }

  html += '</tr>';
  return html;
}

function buildCell(kwId, dayIdx, shift, g, items, extraCls) {
  const attrs = `data-kw="${kwId}" data-day="${dayIdx ?? ''}" data-shift="${shift ?? ''}" data-grp="${g.id}"`;
  const blocks = items.slice(0, 3).map(it => {
    const label = getItemLabel(it, g.section).substring(0, 14);
    const bcls = tlBlockClassFromResStatus(it);
    const tip = tlBlockTitle(it, g.section) || label;
    return `<span class="tl-block ${bcls}" title="${escAttr(tip)}">${label}</span>`;
  }).join('');
  const more = items.length > 3 ? `<span class="tl-more">+${items.length - 3}</span>` : '';
  return `<td class="tl-cell ${extraCls}" ${attrs}>${blocks}${more}</td>`;
}

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
  panel.style.display = 'block';
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
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

const SDP_RES_STATUS_VALUES = ['Planung', 'Bestellt', 'Bestätigt'];

function sdpResStatusFormatter(cell) {
  const v = cell.getValue() || '';
  const map = { Planung: 'st-rs-planung', Bestellt: 'st-rs-bestellt', 'Bestätigt': 'st-rs-bestaetigt' };
  const cls = map[v];
  return cls ? `<span class="${cls}">${v}</span>` : (v || '–');
}

/** Native HTML select: volle Liste sichtbar, kein Suchfeld. */
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

/** Gleiche Status-Spalte für alle Ressourcen-Grids im Schicht-Detail. */
function sdpResStatusColumn(width = 118) {
  return {
    title: 'Status',
    field: 'resStatus',
    width,
    editor: sdpNativeSelectEditor(SDP_RES_STATUS_VALUES),
    formatter: sdpResStatusFormatter,
  };
}

/** Erste Spalte: rote X-Schaltfläche zum Löschen der Zeile. */
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
        /* rowDeleted callback persists the change */
      }
    },
  };
}

const SDP_FUNKTION_VALUES = ['Baugruppe','Sicherheit','Maschinist','Polier','Bauleiter','Fremdfirma'];

function closeSDP() {
  flushOpenSDPTables();
  selectedCell = null;
  document.querySelectorAll('.tl-cell.selected').forEach(td => td.classList.remove('selected'));
  document.getElementById('shiftDetailPanel').style.display = 'none';
  Object.values(sdpTables).forEach(t => { if (t) t.destroy(); });
  Object.keys(sdpTables).forEach(k => delete sdpTables[k]);
}

function initSDPTables(kwId, dayIdx, shift) {
  // Destroy existing
  Object.values(sdpTables).forEach(t => { if (t) t.destroy(); });
  Object.keys(sdpTables).forEach(k => delete sdpTables[k]);

  // Tätigkeiten
  sdpTables.tasks = new Tabulator('#sdp-tbl-tasks', {
    data: getSection(kwId, dayIdx, shift, 'tasks').map(d => ({...d})),
    layout: 'fitColumns', height: 'auto', maxHeight: '260px', history: true,
    rowContextMenu: [{ label: '<span style="color:#DC002E">✕ Zeile löschen</span>',
      action: (e, row) => { row.delete(); saveSDPSection(kwId, dayIdx, shift, 'tasks'); } }],
    cellEdited:  () => saveSDPSection(kwId, dayIdx, shift, 'tasks'),
    rowDeleted:  () => saveSDPSection(kwId, dayIdx, shift, 'tasks'),
    columns: [
      sdpDeleteColumn(kwId, dayIdx, shift, 'tasks'),
      { title: 'Tätigkeit', field: 'name', editor: 'input', widthGrow: 2 },
      { title: 'Beschreibung', field: 'beschreibung', editor: 'textarea', widthGrow: 2 },
      { title: 'Bereich / Ort', field: 'location', editor: 'input', widthGrow: 1 },
      sdpResStatusColumn(118),
      { title: 'Notizen', field: 'notes', editor: 'input', widthGrow: 1 },
    ],
  });

  // Personal
  sdpTables.personal = new Tabulator('#sdp-tbl-personal', {
    data: getSection(kwId, dayIdx, shift, 'personal').map(d => ({...d})),
    layout: 'fitColumns', height: 'auto', maxHeight: '260px', history: true,
    rowContextMenu: [{ label: '<span style="color:#DC002E">✕ Zeile löschen</span>',
      action: (e, row) => { row.delete(); saveSDPSection(kwId, dayIdx, shift, 'personal'); } }],
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

  // Inventar
  sdpTables.inventar = new Tabulator('#sdp-tbl-inventar', {
    data: getSection(kwId, dayIdx, shift, 'inventar').map(d => ({...d})),
    layout: 'fitColumns', height: 'auto', maxHeight: '260px', history: true,
    rowContextMenu: [{ label: '<span style="color:#DC002E">✕ Zeile löschen</span>',
      action: (e, row) => { row.delete(); saveSDPSection(kwId, dayIdx, shift, 'inventar'); } }],
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

  // Material
  sdpTables.material = new Tabulator('#sdp-tbl-material', {
    data: getSection(kwId, dayIdx, shift, 'material').map(d => ({...d})),
    layout: 'fitColumns', height: 'auto', maxHeight: '260px', history: true,
    rowContextMenu: [{ label: '<span style="color:#DC002E">✕ Zeile löschen</span>',
      action: (e, row) => { row.delete(); saveSDPSection(kwId, dayIdx, shift, 'material'); } }],
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

  // Fremdleistung
  sdpTables.fremdleistung = new Tabulator('#sdp-tbl-fremdleistung', {
    data: getSection(kwId, dayIdx, shift, 'fremdleistung').map(d => ({...d})),
    layout: 'fitColumns', height: 'auto', maxHeight: '260px', history: true,
    rowContextMenu: [{ label: '<span style="color:#DC002E">✕ Zeile löschen</span>',
      action: (e, row) => { row.delete(); saveSDPSection(kwId, dayIdx, shift, 'fremdleistung'); } }],
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

  updateSDPCounts();
}

const SDP_SECTIONS = ['tasks', 'personal', 'inventar', 'material', 'fremdleistung'];

function serializeSDPTable(tbl) {
  return tbl.getData().map(d => {
    const clean = { id: d.id || Math.random().toString(36).slice(2) };
    Object.entries(d).forEach(([k, v]) => { if (!k.startsWith('_')) clean[k] = v; });
    return clean;
  });
}

/** Persist all open Schicht-detail tables for the current selectedCell (before switching cell / tab / close). */
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

// ─── Übersicht Exports ────────────────────────────────────────────────────────


function exportUebersichtPDF() {
  exportShiftplanungPDF('uebersicht');
}

// ─── XLSX / PDF helpers ───────────────────────────────────────────────────────

function tblToWS(id) {
  if (!tables[id]) return null;
  const data = tables[id].getData();
  if (!data.length) return null;
  const cols    = tables[id].getColumns();
  const headers = cols.map(c => c.getDefinition().title);
  const fields  = cols.map(c => c.getDefinition().field);
  const rows    = data.map(row => fields.map(f => row[f] ?? ''));
  return XLSX.utils.aoa_to_sheet([headers, ...rows]);
}

function exportAllXLSX() {
  const wb = XLSX.utils.book_new();
  const sdIds   = ['projektname','projektnummer','auftraggeber','bauleiter','polier','standort','baubeginn','bauende'];
  const sdLbls  = ['Projektname','Projektnummer','Auftraggeber','Bauleiter','Polier','Standort','Baubeginn','Bauende'];
  const sdVals  = sdIds.map(f => document.getElementById('sd-' + f)?.value || '');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([sdLbls, sdVals]), 'Stammdaten');
  const mitWS = tblToWS('mitarbeiter');
  if (mitWS) XLSX.utils.book_append_sheet(wb, mitWS, 'Mitarbeiter');
  const uebersichtRows = exportUebersichtXLSXRows();
  if (uebersichtRows && uebersichtRows.length > 1) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(uebersichtRows), 'Übersicht');
  }
  XLSX.writeFile(wb, 'Schichtplanung_Gesamt.xlsx');
  showToast('Gesamt-XLSX exportiert');
}

function exportUebersichtXLSXRows() {
  const rows = [['KW', 'Tag', 'Schicht', 'Sektion', 'Bezeichnung', 'Beschreibung', 'Status/Bemerkung']];
  Object.entries(workItems).forEach(([key, cell]) => {
    if (!cell || typeof cell !== 'object') return;
    const [kwId, dayStr, shift] = key.split('||');
    const kw = kwList.find(k => k.id === kwId);
    const day   = TL_DAYS[parseInt(dayStr)] || dayStr;
    const sh    = shift === 'T' ? `Tag (${shiftConfig.tag.von}–${shiftConfig.tag.bis})` : `Nacht (${shiftConfig.nacht.von}–${shiftConfig.nacht.bis})`;

    (cell.tasks || []).forEach(it => {
      const det = (it.beschreibung || '').trim();
      const st = [it.location, it.resStatus, it.notes].filter(Boolean).join(' — ');
      rows.push([kw?.label||kwId, day, sh, 'Tätigkeiten', it.name||'', det, st]);
    });
    (cell.personal || []).forEach(it => {
      const last = [it.resStatus, it.bemerkung].filter(Boolean).join(' — ');
      rows.push([kw?.label||kwId, day, sh, 'Personal', it.name||it.funktion||'', it.funktion||'', last]);
    });
    (cell.inventar || []).forEach(it => {
      const last = [it.resStatus, it.bemerkung].filter(Boolean).join(' — ');
      rows.push([kw?.label||kwId, day, sh, 'Inventar', it.geraet||'', it.anzahl!=null ? String(it.anzahl) : '', last]);
    });
    (cell.material || []).forEach(it => {
      const last = [it.resStatus, it.bemerkung].filter(Boolean).join(' — ');
      const mengeEinheit = `${it.menge||''} ${it.einheit||''}`.trim();
      rows.push([kw?.label||kwId, day, sh, 'Material', it.material||'', mengeEinheit, last]);
    });
    (cell.fremdleistung || []).forEach(it => {
      const last = [it.resStatus, it.bemerkung].filter(Boolean).join(' — ');
      rows.push([kw?.label||kwId, day, sh, 'Fremdleistung', it.firma||'', it.leistung||'', last]);
    });
  });
  return rows;
}

// ─── PDF Design System ────────────────────────────────────────────────────────
// Colours (RGB)
const PDF_C = {
  dark:    [28,  28,  30 ],  // header bg #1C1C1E
  orange:  [255, 99,  0  ],  // RSRG orange #FF6300
  white:   [255, 255, 255],
  offwht:  [242, 239, 232],  // cream text #F2EFE8
  bg:      [245, 242, 236],  // page bg tint #F5F2EC
  surface: [255, 255, 255],
  tblhdr:  [42,  42,  44 ],  // table header dark
  altrow:  [247, 244, 238],  // alternate row
  border:  [217, 211, 200],  // #D9D3C8
  text:    [44,  40,  37 ],  // #2C2825
  muted:   [107, 101, 96 ],  // #6B6560
  grphdr:  [235, 232, 225],  // section header bg
  green:   [22,  163, 74 ],  // bestätigt
  blue:    [37,  99,  235],  // bestellt
  red:     [220, 0,   46 ],  // planung/danger
};

/** Draw RSRG-style page header. Returns Y position after header. */
function pdfHeader(doc, projName, subtitle, isLandscape) {
  const W = isLandscape ? 297 : 210;
  // Dark bar
  doc.setFillColor(...PDF_C.dark);
  doc.rect(0, 0, W, 18, 'F');
  // Orange accent line
  doc.setFillColor(...PDF_C.orange);
  doc.rect(0, 18, W, 2, 'F');

  // Logo placeholder: orange square + "RSRG" text (no image fetch in jsPDF)
  doc.setFillColor(...PDF_C.orange);
  doc.rect(12, 4, 10, 10, 'F');
  doc.setTextColor(...PDF_C.dark);
  doc.setFontSize(6); doc.setFont(undefined, 'bold');
  doc.text('RSRG', 17, 10.5, { align: 'center' });

  // Project name — left, after logo
  doc.setTextColor(...PDF_C.offwht);
  doc.setFontSize(11); doc.setFont(undefined, 'bold');
  doc.text(projName || 'Schichtplanung', 26, 10);

  // Subtitle / date — right
  const dateStr = 'Ausdruck: ' + new Date().toLocaleDateString('de-CH');
  doc.setFontSize(7.5); doc.setFont(undefined, 'normal');
  doc.setTextColor(...PDF_C.offwht);
  doc.text(dateStr, W - 12, 10, { align: 'right' });

  if (subtitle) {
    doc.setFontSize(7); doc.setTextColor(200, 200, 200);
    doc.text(subtitle, W - 12, 15, { align: 'right' });
  }

  doc.setTextColor(...PDF_C.text);
  return 26; // Y start for content
}

/** Draw footer on every page. */
function pdfFooters(doc, isLandscape) {
  const W   = isLandscape ? 297 : 210;
  const H   = isLandscape ? 210 : 297;
  const n   = doc.internal.getNumberOfPages();
  const proj = document.getElementById('sd-projektname')?.value || '';
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    // Footer line
    doc.setDrawColor(...PDF_C.border);
    doc.setLineWidth(0.3);
    doc.line(12, H - 10, W - 12, H - 10);
    doc.setFontSize(7); doc.setFont(undefined, 'normal'); doc.setTextColor(...PDF_C.muted);
    doc.text('Exportiert: ' + new Date().toLocaleDateString('de-CH'), 12, H - 6);
    if (proj) doc.text(proj, W / 2, H - 6, { align: 'center' });
    doc.text('Seite ' + i + ' / ' + n, W - 12, H - 6, { align: 'right' });
  }
}

/**
 * Draw a section heading bar (like the orange-left-border section headers in the app).
 * Returns new Y.
 */
function pdfSectionHeading(doc, label, y, W) {
  const barH = 7;
  doc.setFillColor(...PDF_C.grphdr);
  doc.rect(12, y, W - 24, barH, 'F');
  doc.setFillColor(...PDF_C.orange);
  doc.rect(12, y, 3, barH, 'F');
  doc.setFontSize(8); doc.setFont(undefined, 'bold');
  doc.setTextColor(...PDF_C.text);
  doc.text(label.toUpperCase(), 18, y + 5);
  return y + barH + 3;
}

/** autoTable wrapper with consistent RSRG styling. */
function pdfTable(doc, head, body, startY, W, opts = {}) {
  if (!body.length) return startY;
  doc.autoTable({
    head,
    body,
    startY,
    margin: { left: 12, right: 12 },
    tableWidth: W - 24,
    styles: {
      fontSize: opts.fontSize || 7.5,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      font: 'helvetica',
      textColor: PDF_C.text,
      lineColor: PDF_C.border,
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: PDF_C.tblhdr,
      textColor: PDF_C.white,
      fontStyle: 'bold',
      fontSize: opts.headFontSize || 7,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
    },
    alternateRowStyles: { fillColor: PDF_C.altrow },
    columnStyles: opts.columnStyles || {},
    didParseCell: opts.didParseCell,
    showHead: 'everyPage',
    ...opts.extra,
  });
  return doc.lastAutoTable.finalY + 5;
}

/** Page break check. Adds page + re-draws header if needed. */
function pdfCheckPage(doc, y, threshold, projName, subtitle, isLandscape) {
  const H = isLandscape ? 210 : 297;
  if (y > H - threshold) {
    doc.addPage();
    return pdfHeader(doc, projName, subtitle, isLandscape);
  }
  return y;
}

// ─── Stammdaten PDF page ──────────────────────────────────────────────────────
function buildStammdatenPDFPage(doc, y, W, proj) {
  const sdIds  = ['projektname','projektnummer','auftraggeber','bauleiter','polier','standort','baubeginn','bauende'];
  const sdLbls = ['Projektname','Projektnummer','Auftraggeber','Bauleiter','Polier','Standort / Adresse','Baubeginn','Bauende (geplant)'];
  const sdVals = sdIds.map(id => document.getElementById('sd-' + id)?.value || '–');

  // Tag/Nacht Zeiten
  const tagVon   = document.getElementById('sh-tag-von')?.value   || '07:00';
  const tagBis   = document.getElementById('sh-tag-bis')?.value   || '19:00';
  const nachtVon = document.getElementById('sh-nacht-von')?.value || '19:00';
  const nachtBis = document.getElementById('sh-nacht-bis')?.value || '07:00';

  y = pdfSectionHeading(doc, 'Projekt Stammdaten', y, W);

  const sdBody = sdLbls.map((l, i) => [l, sdVals[i]]);
  sdBody.push(['Schicht Tag',   tagVon + ' – ' + tagBis]);
  sdBody.push(['Schicht Nacht', nachtVon + ' – ' + nachtBis]);

  y = pdfTable(doc, [['Feld', 'Wert']], sdBody, y, W, {
    columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold', fillColor: [240, 237, 230] } },
  });

  // Kontaktliste / Mitarbeiter
  if (tables['mitarbeiter']) {
    const mitData = tables['mitarbeiter'].getData().filter(r =>
      r.name || r.vorname || r.funktion || r.firma
    );
    if (mitData.length) {
      y += 4;
      y = pdfSectionHeading(doc, 'Kontakt Liste', y, W);
      const mitBody = mitData.map(r => [
        r.name || '', r.vorname || '', r.funktion || '', r.firma || '',
        r.tel || '', r.email || '', r.bemerkung || '',
      ]);
      y = pdfTable(doc,
        [['Name','Vorname','Funktion','Firma','Tel','Email','Bemerkung']],
        mitBody, y, W, { fontSize: 7 });
    }
  }
  return y;
}

// ─── KW Summary PDF page ──────────────────────────────────────────────────────
/**
 * One summary per KW: two stacked tables (Tag top, Nacht bottom).
 * Same fixed column widths for horizontal alignment; text wraps within cells.
 */
function buildKWSummaryPage(doc, kw, y, W, proj) {
  const H = 210; // landscape
  if (y > H - 55) {
    doc.addPage();
    y = pdfHeader(doc, proj, '', true);
  }

  y = pdfSectionHeading(doc, kw.label, y, W);

  const colW_res  = 22;
  const colW_day  = (W - 24 - colW_res) / 7;

  const pdfColStyles = {
    0: { cellWidth: colW_res, fontStyle: 'bold', fillColor: [240,237,230] },
    1: { cellWidth: colW_day }, 2: { cellWidth: colW_day }, 3: { cellWidth: colW_day },
    4: { cellWidth: colW_day }, 5: { cellWidth: colW_day }, 6: { cellWidth: colW_day },
    7: { cellWidth: colW_day },
  };

  const pdfTableOpts = {
    fontSize: 6.5,
    headFontSize: 6,
    columnStyles: pdfColStyles,
    extra: {
      styles: {
        fontSize: 6.5,
        cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
        lineColor: PDF_C.border,
        lineWidth: 0.15,
        overflow: 'linebreak',
        minCellHeight: 7,
      },
    },
  };

  const headRowTag  = ['Ressource', ...TL_DAYS.map((_, dayIdx) => tlPdfDayHeader(kw, dayIdx, 'T'))];
  const headRowNacht = ['Ressource', ...TL_DAYS.map((_, dayIdx) => tlPdfDayHeader(kw, dayIdx, 'N'))];

  const grpRowsTag = TL_GROUPS.map(g => {
    const cells = [g.label];
    TL_DAYS.forEach((_, dayIdx) => {
      const items = getSection(kw.id, dayIdx, 'T', g.section);
      const labels = items.map(it => getItemLabel(it, g.section)).filter(l => l && l !== '–').slice(0, 3);
      cells.push(labels.join('\n') || '–');
    });
    return cells;
  });

  const grpRowsNacht = TL_GROUPS.map(g => {
    const cells = [g.label];
    TL_DAYS.forEach((_, dayIdx) => {
      const items = getSection(kw.id, dayIdx, 'N', g.section);
      const labels = items.map(it => getItemLabel(it, g.section)).filter(l => l && l !== '–').slice(0, 3);
      cells.push(labels.join('\n') || '–');
    });
    return cells;
  });

  y = pdfTable(doc, [headRowTag], grpRowsTag, y, W, pdfTableOpts);

  y = doc.lastAutoTable.finalY + 10;

  y = pdfTable(doc, [headRowNacht], grpRowsNacht, y, W, pdfTableOpts);

  return y;
}

// ─── Per-shift detail page ────────────────────────────────────────────────────
function buildShiftDetailPage(doc, kw, dayIdx, shift, y, W, proj) {
  const H = 210; // landscape
  const shLabel = shift === 'T'
    ? `Tag (${shiftConfig.tag.von} – ${shiftConfig.tag.bis})`
    : `Nacht (${shiftConfig.nacht.von} – ${shiftConfig.nacht.bis})`;
  const dayLabel = tlDayPlain(kw, dayIdx);
  const subtitle = kw.label + '  —  ' + dayLabel + '  —  ' + shLabel;

  const cell = workItems[wiKey(kw.id, dayIdx, shift)] || {};

  // Check if this shift has any actual content
  const hasContent = ['tasks','personal','inventar','material','fremdleistung']
    .some(s => (cell[s] || []).length > 0);
  if (!hasContent) return y; // skip empty shifts

  // Start new page for each shift
  doc.addPage();
  y = pdfHeader(doc, proj, subtitle, true);

  // ── TÄTIGKEITEN ──
  const tasks = (cell.tasks || []).filter(t => t.name || t.beschreibung || t.location);
  if (tasks.length) {
    y = pdfSectionHeading(doc, 'Tätigkeiten', y, W);
    const body = tasks.map(t => [
      t.name || '–',
      t.beschreibung || '–',
      t.location || '–',
      t.resStatus || '–',
      t.notes || '–',
    ]);
    y = pdfTable(doc,
      [['Tätigkeit','Beschreibung','Bereich/Ort','Status','Notizen']],
      body, y, W, { fontSize: 7.5 });
  }

  // ── PERSONAL + INVENTAR side by side ──
  const personal  = (cell.personal  || []).filter(p => p.name || p.funktion);
  const inventar  = (cell.inventar  || []).filter(i => i.geraet);

  if (personal.length || inventar.length) {
    y = pdfCheckPage(doc, y, 50, proj, subtitle, true);
    const yBefore = y;

    if (personal.length) {
      y = pdfSectionHeading(doc, 'Personal', y, W);
      const body = personal.map(p => [p.funktion||'–', p.name||'–', p.resStatus||'–', p.bemerkung||'–']);
      // Use half page width for side by side
      doc.autoTable({
        head:    [['Funktion','Name','Res.Status','Bemerkung']],
        body,
        startY:  y,
        margin:  { left: 12, right: W / 2 + 2 },
        styles:  { fontSize: 7.5, cellPadding: { top:2,bottom:2,left:3,right:3 }, lineColor: PDF_C.border, lineWidth: 0.15 },
        headStyles: { fillColor: PDF_C.tblhdr, textColor: PDF_C.white, fontStyle:'bold', fontSize:7 },
        alternateRowStyles: { fillColor: PDF_C.altrow },
      });
      const yAfterPersonal = doc.lastAutoTable.finalY;

      if (inventar.length) {
        const yInvLabel = yBefore;
        // Section heading for inventar
        const barH = 7;
        doc.setFillColor(...PDF_C.grphdr);
        doc.rect(W/2 + 2, yInvLabel, W/2 - 14, barH, 'F');
        doc.setFillColor(...PDF_C.orange);
        doc.rect(W/2 + 2, yInvLabel, 3, barH, 'F');
        doc.setFontSize(8); doc.setFont(undefined, 'bold'); doc.setTextColor(...PDF_C.text);
        doc.text('INVENTAR', W/2 + 8, yInvLabel + 5);

        const invBody = inventar.map(i => [i.geraet||'–', i.anzahl!=null?String(i.anzahl):'–', i.resStatus||'–', i.bemerkung||'–']);
        doc.autoTable({
          head:    [['Gerät / Inventar','Anz.','Res.Status','Bemerkung']],
          body:    invBody,
          startY:  yBefore + barH + 3,
          margin:  { left: W/2 + 2, right: 12 },
          styles:  { fontSize: 7.5, cellPadding: { top:2,bottom:2,left:3,right:3 }, lineColor: PDF_C.border, lineWidth: 0.15 },
          headStyles: { fillColor: PDF_C.tblhdr, textColor: PDF_C.white, fontStyle:'bold', fontSize:7 },
          alternateRowStyles: { fillColor: PDF_C.altrow },
        });
        y = Math.max(yAfterPersonal, doc.lastAutoTable.finalY) + 5;
      } else {
        y = yAfterPersonal + 5;
      }
    } else if (inventar.length) {
      y = pdfSectionHeading(doc, 'Inventar', y, W);
      const invBody = inventar.map(i => [i.geraet||'–', i.anzahl!=null?String(i.anzahl):'–', i.resStatus||'–', i.bemerkung||'–']);
      y = pdfTable(doc, [['Gerät / Inventar','Anz.','Res.Status','Bemerkung']], invBody, y, W);
    }
  }

  // ── MATERIAL + FREMDLEISTUNG side by side ──
  const material      = (cell.material      || []).filter(m => m.material);
  const fremdleistung = (cell.fremdleistung || []).filter(f => f.firma || f.leistung);

  if (material.length || fremdleistung.length) {
    y = pdfCheckPage(doc, y, 40, proj, subtitle, true);
    const yBefore2 = y;

    if (material.length) {
      y = pdfSectionHeading(doc, 'Material', y, W);
      const body = material.map(m => [m.material||'–', m.menge!=null?String(m.menge):'–', m.einheit||'–', m.resStatus||'–', m.bemerkung||'–']);
      doc.autoTable({
        head:    [['Material','Menge','Einheit','Res.Status','Bemerkung']],
        body,
        startY:  y,
        margin:  { left: 12, right: W/2 + 2 },
        styles:  { fontSize: 7.5, cellPadding: { top:2,bottom:2,left:3,right:3 }, lineColor: PDF_C.border, lineWidth: 0.15 },
        headStyles: { fillColor: PDF_C.tblhdr, textColor: PDF_C.white, fontStyle:'bold', fontSize:7 },
        alternateRowStyles: { fillColor: PDF_C.altrow },
      });
      const yAfterMat = doc.lastAutoTable.finalY;

      if (fremdleistung.length) {
        const barH = 7;
        doc.setFillColor(...PDF_C.grphdr);
        doc.rect(W/2+2, yBefore2, W/2-14, barH, 'F');
        doc.setFillColor(...PDF_C.orange);
        doc.rect(W/2+2, yBefore2, 3, barH, 'F');
        doc.setFontSize(8); doc.setFont(undefined,'bold'); doc.setTextColor(...PDF_C.text);
        doc.text('FREMDLEISTUNG', W/2+8, yBefore2+5);
        const fBody = fremdleistung.map(f => [f.firma||'–', f.leistung||'–', f.resStatus||'–', f.bemerkung||'–']);
        doc.autoTable({
          head:    [['Firma','Leistung','Res.Status','Bemerkung']],
          body:    fBody,
          startY:  yBefore2 + barH + 3,
          margin:  { left: W/2+2, right: 12 },
          styles:  { fontSize: 7.5, cellPadding: { top:2,bottom:2,left:3,right:3 }, lineColor: PDF_C.border, lineWidth: 0.15 },
          headStyles: { fillColor: PDF_C.tblhdr, textColor: PDF_C.white, fontStyle:'bold', fontSize:7 },
          alternateRowStyles: { fillColor: PDF_C.altrow },
        });
        y = Math.max(yAfterMat, doc.lastAutoTable.finalY) + 5;
      } else {
        y = yAfterMat + 5;
      }
    } else if (fremdleistung.length) {
      y = pdfSectionHeading(doc, 'Fremdleistung', y, W);
      const fBody = fremdleistung.map(f => [f.firma||'–', f.leistung||'–', f.resStatus||'–', f.bemerkung||'–']);
      y = pdfTable(doc, [['Firma','Leistung','Res.Status','Bemerkung']], fBody, y, W);
    }
  }

  return y;
}

/**
 * Master PDF export function.
 * mode: 'full' (all pages) | 'uebersicht' (KW summaries only) | 'stammdaten'
 */
function exportShiftplanungPDF(mode = 'full') {
  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W    = 297;
  const proj = document.getElementById('sd-projektname')?.value || '';

  let y = pdfHeader(doc, proj, '', true);

  // ── PAGE 1: Stammdaten ──
  if (mode === 'full' || mode === 'stammdaten') {
    y = buildStammdatenPDFPage(doc, y, W, proj);
  }

  // ── KW Summary pages ──
  if (mode === 'full' || mode === 'uebersicht') {
    if (!kwList.length) {
      doc.setFontSize(11); doc.setTextColor(...PDF_C.muted);
      doc.text('Keine Kalenderwochen vorhanden.', 12, y + 10);
    } else {
      kwList.forEach(kw => {
        if (mode === 'full' || mode === 'uebersicht') {
          doc.addPage();
          y = pdfHeader(doc, proj, kw.label, true);
          y = buildKWSummaryPage(doc, kw, y, W, proj);
        }
      });
    }
  }

  // ── Per-shift detail pages (full mode only) ──
  if (mode === 'full') {
    kwList.forEach(kw => {
      TL_DAYS.forEach((_, dayIdx) => {
        ['T', 'N'].forEach(sh => {
          buildShiftDetailPage(doc, kw, dayIdx, sh, 26, W, proj);
        });
      });
    });
  }

  pdfFooters(doc, true);

  const proj2 = proj.trim();
  const filename = (mode === 'uebersicht' ? 'Uebersicht' : 'Schichtplanung')
    + (proj2 ? '_' + proj2.replace(/[^\w\-äöüÄÖÜ ]/g,'').replace(/\s+/g,'_') : '')
    + '.pdf';
  doc.save(filename);
  showToast('PDF exportiert');
}

// Legacy compatibility wrapper
function exportAllPDF() {
  exportShiftplanungPDF('full');
}

// Legacy – kept for addPDFSection calls (mitarbeiter table) - no longer directly called
function buildPDFHeader(doc, title, subtitle) {
  const W = 297;
  doc.setFillColor(...PDF_C.dark);
  doc.rect(0, 0, W, 18, 'F');
  doc.setFillColor(...PDF_C.orange);
  doc.rect(0, 18, W, 2, 'F');
  doc.setTextColor(...PDF_C.offwht);
  doc.setFontSize(11); doc.setFont(undefined, 'bold');
  doc.text(title, 14, 11);
  const proj = document.getElementById('sd-projektname')?.value || '';
  if (proj) { doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.text(proj, W-12, 11, { align: 'right' }); }
  doc.setTextColor(...PDF_C.text);
  return 24;
}
function addPDFFooters(doc) { pdfFooters(doc, true); }

// ─── Save to File ─────────────────────────────────────────────────────────────

function saveToFile() {
  const saveBtn = document.getElementById('btnSave');
  try {
    if (saveBtn) saveBtn.disabled = true;
    showToast('Erstelle Standalone-Datei...');
    flushOpenSDPTables();
  } catch (e) {
    if (saveBtn) saveBtn.disabled = false;
    console.error('saveToFile init:', e);
    alert('Speichern fehlgeschlagen: ' + (e?.message || e));
    return;
  }

  const sdIds = ['projektname','projektnummer','auftraggeber','bauleiter','polier','standort','baubeginn','bauende'];
  const stammdaten = {};
  sdIds.forEach(id => {
    const el = document.getElementById('sd-' + id);
    if (el) stammdaten[id] = el.value;
  });

  const snapshot = {
    savedAt:     new Date().toISOString(),
    stammdaten,
    shiftConfig,
    kwList:      JSON.parse(JSON.stringify(kwList)),
    tables:      {},
    workItems:   JSON.parse(JSON.stringify(workItems)),
  };

  Object.entries(tables).forEach(([id, tbl]) => {
    try { if (tbl && typeof tbl.getData === 'function') snapshot.tables[id] = tbl.getData(); }
    catch (e) { console.warn('Could not get table data for', id, e); }
  });

  function doDownload(html) {
    const proj = stammdaten.projektname?.trim();
    const filename = proj
      ? 'Schichtplanung_' + proj.replace(/[^\w\-äöüÄÖÜ ]/g, '').replace(/\s+/g, '_') + '.html'
      : 'schichtplanung.html';

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);

    if (location.protocol === 'file:') {
      const w = window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      markClean();
      if (w) {
        showToast('Neue Registerkarte geöffnet – mit Strg+S speichern');
      } else {
        navigator.clipboard?.writeText(html).then(() => {
          showToast('In Zwischenablage kopiert – in neue .html-Datei einfügen und speichern');
        }).catch(() => {
          showToast('Pop-ups im Browser erlauben für „Speichern“');
        });
      }
      return;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);

    markClean();
    showToast('Standalone-Datei exportiert');
  }

  if (isStandaloneDocument()) {
    try {
      const html = buildStandaloneHtmlSync(snapshot);
      doDownload(html);
    } catch (err) {
      console.error('Standalone export failed:', err);
      showToast('Export fehlgeschlagen: ' + (err?.message || 'Unbekannter Fehler'));
    }
    if (saveBtn) saveBtn.disabled = false;
  } else {
    buildStandaloneHtml(snapshot).then(html => {
      doDownload(html);
    }).catch(err => {
      console.error('Standalone export failed:', err);
      showToast('Export fehlgeschlagen – bitte erneut versuchen');
    }).finally(() => {
      if (saveBtn) saveBtn.disabled = false;
    });
  }
}

const exportAssetCache = new Map();

function escScriptText(s) {
  return String(s || '').replace(/<\/script>/gi, '<\\/script>');
}

function toAbsoluteUrl(url) {
  try { return new URL(url, location.href).href; }
  catch (_) { return url; }
}

async function fetchAssetText(url) {
  if (exportAssetCache.has(url)) return exportAssetCache.get(url);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Fetch failed for ' + url + ' (' + res.status + ')');
  const txt = await res.text();
  exportAssetCache.set(url, txt);
  return txt;
}

function clearRuntimeTabulatorMarkup(root) {
  root.querySelectorAll('.tabulator').forEach(el => {
    el.innerHTML = '';
  });
}

async function inlineStylesheets(docClone) {
  const links = Array.from(docClone.querySelectorAll('link[rel="stylesheet"][href]'));
  if (links.length === 0) return;
  const doc = docClone.ownerDocument || document;
  const mk = tag => doc.createElement(tag);
  for (const link of links) {
    const href = link.getAttribute('href');
    if (!href) continue;
    const absHref = toAbsoluteUrl(href);
    try {
      const css = await fetchAssetText(absHref);
      const style = mk('style');
      style.setAttribute('data-inlined-from', href);
      style.textContent = css;
      link.replaceWith(style);
    } catch (e) {
      console.warn('Could not inline stylesheet:', href, e);
    }
  }
}

async function inlineScripts(docClone) {
  const scripts = Array.from(docClone.querySelectorAll('script[src]'));
  if (scripts.length === 0) return;
  const doc = docClone.ownerDocument || document;
  const mk = tag => doc.createElement(tag);
  for (const script of scripts) {
    const src = script.getAttribute('src') || '';
    if (/^chrome-extension:\/\//i.test(src)) {
      script.remove();
      continue;
    }
    const absSrc = toAbsoluteUrl(src);
    try {
      const js = await fetchAssetText(absSrc);
      const inlined = mk('script');
      inlined.setAttribute('data-inlined-from', src);
      if (script.type) inlined.type = script.type;
      inlined.textContent = escScriptText(js) + '\n//# sourceURL=' + absSrc;
      script.replaceWith(inlined);
    } catch (e) {
      console.warn('Could not inline script:', src, e);
    }
  }
}

/** True if document appears to be already standalone (all assets inlined). */
function isStandaloneDocument() {
  const hasAppScript = document.querySelector('script[src*="app.js"]');
  const hasOurCss = document.querySelector('link[href*="styles.css"]');
  return !hasAppScript && !hasOurCss;
}

/** Synchronous build for standalone documents – no fetch, runs in click handler. */
function buildStandaloneHtmlSync(snapshot) {
  const docClone = document.documentElement.cloneNode(true);

  docClone.querySelectorAll('script[src^="chrome-extension://"]').forEach(s => s.remove());
  docClone.querySelectorAll('script[data-name="TokenSigning"]').forEach(s => s.remove());

  clearRuntimeTabulatorMarkup(docClone);

  const savedDataEl = docClone.querySelector('#savedData');
  const dataJson = escScriptText(JSON.stringify(snapshot));
  if (savedDataEl) {
    savedDataEl.textContent = dataJson;
  } else {
    const doc = docClone.ownerDocument || document;
    const s = doc.createElement('script');
    s.id = 'savedData';
    s.type = 'application/json';
    s.textContent = dataJson;
    docClone.querySelector('body')?.appendChild(s);
  }

  return '<!DOCTYPE html>\n' + docClone.outerHTML;
}

async function buildStandaloneHtml(snapshot) {
  const docClone = document.documentElement.cloneNode(true);

  docClone.querySelectorAll('script[src^="chrome-extension://"]').forEach(s => s.remove());
  docClone.querySelectorAll('script[data-name="TokenSigning"]').forEach(s => s.remove());

  clearRuntimeTabulatorMarkup(docClone);

  const savedDataEl = docClone.querySelector('#savedData');
  const dataJson = escScriptText(JSON.stringify(snapshot));
  if (savedDataEl) {
    savedDataEl.textContent = dataJson;
  } else {
    const doc = docClone.ownerDocument || document;
    const s = doc.createElement('script');
    s.id = 'savedData';
    s.type = 'application/json';
    s.textContent = dataJson;
    docClone.querySelector('body')?.appendChild(s);
  }

  if (!isStandaloneDocument()) {
    await inlineStylesheets(docClone);
    await inlineScripts(docClone);
  }

  return '<!DOCTYPE html>\n' + docClone.outerHTML;
}

// ─── Load from Embedded Data ──────────────────────────────────────────────────

function loadFromEmbeddedData() {
  const el  = document.getElementById('savedData');
  if (!el) return;
  const raw = el.textContent.trim();
  if (!raw || raw === 'null') return;
  try {
    const snap = JSON.parse(raw);
    if (!snap) return;
    if (snap.stammdaten)  localStorage.setItem('stammdaten',  JSON.stringify(snap.stammdaten));
    if (snap.shiftConfig) localStorage.setItem('shiftConfig', JSON.stringify(snap.shiftConfig));
    if (snap.kwList)      localStorage.setItem('kwList',      JSON.stringify(snap.kwList));
    if (snap.tables) {
      Object.entries(snap.tables).forEach(([id, data]) => {
        localStorage.setItem('t_' + id, JSON.stringify(data));
      });
    }
    if (snap.workItems)   localStorage.setItem('workItems',   JSON.stringify(snap.workItems));
  } catch(e) { console.warn('Could not load embedded snapshot:', e); }
}

// ─── Static Tables ────────────────────────────────────────────────────────────

const txtCol  = (title, field, grow = 1) => ({ title, field, editor: 'input', widthGrow: grow });
const numCol  = (title, field, w = 78)   => ({ title, field, editor: 'number', width: w, hozAlign: 'right' });

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

  // Modal keyboard
  document.getElementById('kwNum').addEventListener('keydown', e => {
    if (e.key === 'Enter')  confirmAddKW();
    if (e.key === 'Escape') closeModal();
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

  // Schicht komplett kopieren/einfügen (wie Excel), nur Übersicht + Zoom „Schichten“
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