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
//   tasks:         [{id, name, location, category, status, resStatus, notes}]
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
    collapseAllSDPSections();
  }
}

function copyTimelineShiftToClipboard() {
  if (!timelineShiftFocus) {
    showToast('Zuerst eine Schicht-Zelle anklicken (Ansicht „Schichten“)');
    return;
  }
  const { kwId, dayIdx, shift } = timelineShiftFocus;
  const sections = getShiftPayloadFromStore(kwId, dayIdx, shift);
  const wrap = { _schichtplanungShiftV1: true, sections };
  shiftClipboardInternal = wrap;
  const json = JSON.stringify(wrap);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(json).then(() => {
      showToast('Schicht kopiert (Strg+V auf Ziel-Schicht)');
    }).catch(() => showToast('Schicht kopiert'));
  } else {
    showToast('Schicht kopiert');
  }
}

function pasteTimelineShiftFromClipboard() {
  if (!timelineShiftFocus) {
    showToast('Ziel-Schicht-Zelle anklicken, dann Strg+V');
    return;
  }
  const { kwId, dayIdx, shift } = timelineShiftFocus;
  const apply = (sections) => {
    if (!sections) {
      showToast('Keine Schicht-Daten in der Zwischenablage');
      return;
    }
    applyShiftPayloadToCell(kwId, dayIdx, shift, sections);
    showToast('Schicht eingefügt');
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
            location: it.location || '',
            category: it.category || '',
            status: it.status || 'Offen',
            notes: it.notes || '',
          })), personal: [], inventar: [], material: [], fremdleistung: [] };
        } else {
          workItems[key] = val;
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

function renderTimeline() {
  const wrapper = document.getElementById('timelineWrapper');
  if (!wrapper) return;

  if (!kwList.length) {
    wrapper.innerHTML = '<div class="tl-empty">Noch keine Kalenderwochen vorhanden. Bitte "+ KW hinzufügen" verwenden.</div>';
    return;
  }

  const zoom = tlZoom;
  let html = '<table class="tl-table"><thead>';

  if (zoom === 'shifts') {
    html += '<tr>';
    html += '<th class="tl-label-th" rowspan="3">Ressource</th>';
    kwList.forEach(kw => {
      html += `<th class="tl-kw-th" colspan="14">${kw.label}</th>`;
    });
    html += '</tr>';

    html += '<tr>';
    kwList.forEach(kw => {
      TL_DAYS.forEach((_, dayIdx) => {
        html += `<th class="tl-day-th" colspan="2">${tlDayThHtml(kw, dayIdx)}</th>`;
      });
    });
    html += '</tr>';

    html += '<tr>';
    kwList.forEach(kw => {
      TL_DAYS.forEach((_, dayIdx) => {
        const dayT = tlDayPlain(kw, dayIdx);
        TL_SHIFTS.forEach(sh => {
          html += `<th class="tl-slot-th ${sh.cls}"
            data-kw="${kw.id}" data-day="${dayIdx}" data-shift="${sh.id}"
            title="${kw.label} ${dayT} ${sh.label}">${sh.id}</th>`;
        });
      });
    });
    html += '</tr>';

  } else if (zoom === 'days') {
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

  // Drill-down on slot headers
  wrapper.querySelectorAll('.tl-slot-th.drill').forEach(th => {
    th.addEventListener('click', () => {
      if (zoom === 'weeks') setZoom('days');
      else if (zoom === 'days') setZoom('shifts');
    });
  });

  // Cell click → open SDP (only in shifts zoom)
  wrapper.querySelectorAll('.tl-cell[data-shift]').forEach(td => {
    td.addEventListener('click', () => {
      openSDP(td.dataset.kw, parseInt(td.dataset.day), td.dataset.shift);
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
    wrapper.querySelectorAll(
      `.tl-cell[data-kw="${selectedCell.kwId}"][data-day="${selectedCell.dayIdx}"][data-shift="${selectedCell.shift}"]`
    ).forEach(td => td.classList.add('selected'));
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
    return [it.name, it.resStatus, it.status].filter(Boolean).join(' · ');
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

function openSDP(kwId, dayIdx, shift) {
  flushOpenSDPTables();

  selectedCell = { kwId, dayIdx, shift };
  timelineShiftFocus = { kwId, dayIdx, shift };

  document.querySelectorAll('.tl-cell.selected').forEach(td => td.classList.remove('selected'));
  document.querySelectorAll(
    `.tl-cell[data-kw="${kwId}"][data-day="${dayIdx}"][data-shift="${shift}"]`
  ).forEach(td => td.classList.add('selected'));

  const kw = kwList.find(k => k.id === kwId);
  document.getElementById('sdp-title').textContent =
    `${kw?.label || kwId}  —  ${tlDayPlain(kw, dayIdx)}  —  ${shiftLabel(shift)}`;

  initSDPTables(kwId, dayIdx, shift);
  collapseAllSDPSections();

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
      { title: 'Tätigkeit', field: 'name',     editor: 'input', widthGrow: 2 },
      { title: 'Bereich / Ort', field: 'location', editor: 'input', widthGrow: 1 },
      { title: 'Kategorie',     field: 'category', editor: 'list', width: 130,
        editorParams: { values: ['Aushub','Betonierung','Montage','Demontage',
          'Logistik','Sicherung','Vermessung','Sonstiges'], autocomplete: true } },
      { title: 'Arbeitsstatus', field: 'status', width: 118,
        editor: sdpNativeSelectEditor(['Offen','In Arbeit','Erledigt','Verschoben','Gesperrt']),
        formatter: (cell) => {
          const v = cell.getValue() || '';
          const cls = { 'Offen':'st-offen','In Arbeit':'st-arbeit','Erledigt':'st-erledigt',
            'Verschoben':'st-verschoben','Gesperrt':'st-gesperrt' };
          return cls[v] ? `<span class="${cls[v]}">${v}</span>` : v;
        } },
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

function exportUebersichtXLSX() {
  const rows = [['KW', 'Tag', 'Schicht', 'Sektion', 'Bezeichnung', 'Details', 'Status/Bemerkung']];
  Object.entries(workItems).forEach(([key, cell]) => {
    if (!cell || typeof cell !== 'object') return;
    const [kwId, dayStr, shift] = key.split('||');
    const kw = kwList.find(k => k.id === kwId);
    const day   = TL_DAYS[parseInt(dayStr)] || dayStr;
    const sh    = shift === 'T' ? `Tag (${shiftConfig.tag.von}–${shiftConfig.tag.bis})` : `Nacht (${shiftConfig.nacht.von}–${shiftConfig.nacht.bis})`;

    (cell.tasks || []).forEach(it => {
      const det = `${it.location||''} ${it.category||''}`.trim();
      const st = [it.resStatus, it.status].filter(Boolean).join(' / ');
      rows.push([kw?.label||kwId, day, sh, 'Tätigkeiten', it.name||'', det, st]);
    });
    (cell.personal || []).forEach(it => {
      const last = [it.resStatus, it.bemerkung].filter(Boolean).join(' — ');
      rows.push([kw?.label||kwId, day, sh, 'Personal', it.funktion||'', it.name||'', last]);
    });
    (cell.inventar || []).forEach(it => {
      const mid = it.anzahl ? 'Anzahl: '+it.anzahl : '';
      const last = [it.resStatus, it.bemerkung].filter(Boolean).join(' — ');
      rows.push([kw?.label||kwId, day, sh, 'Inventar', it.geraet||'', mid, last]);
    });
    (cell.material || []).forEach(it => {
      const last = [it.resStatus, it.bemerkung].filter(Boolean).join(' — ');
      rows.push([kw?.label||kwId, day, sh, 'Material', it.material||'', `${it.menge||''} ${it.einheit||''}`.trim(), last]);
    });
    (cell.fremdleistung || []).forEach(it => {
      const last = [it.resStatus, it.bemerkung].filter(Boolean).join(' — ');
      rows.push([kw?.label||kwId, day, sh, 'Fremdleistung', it.firma||'', it.leistung||'', last]);
    });
  });
  if (rows.length === 1) { showToast('Keine Einträge vorhanden'); return; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Übersicht');
  XLSX.writeFile(wb, 'Uebersicht_Baustelle.xlsx');
  showToast('XLSX exportiert');
}

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
  XLSX.writeFile(wb, 'Schichtplanung_Gesamt.xlsx');
  showToast('Gesamt-XLSX exportiert');
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
 * One summary table per KW: rows = Ressource groups, cols = Mo…So (Tag / Nacht).
 * Each cell shows up to 2 items, separated by newlines.
 */
function buildKWSummaryPage(doc, kw, y, W, proj) {
  const subtitle = kw.label;
  // Check if we need a new page
  const H = 210; // landscape
  if (y > H - 55) {
    doc.addPage();
    y = pdfHeader(doc, proj, '', true);
  }

  y = pdfSectionHeading(doc, kw.label, y, W);

  // Build header row: Ressource | Mo T | Mo N | Di T | ... | So N
  const colDays = [];
  TL_DAYS.forEach(d => {
    colDays.push(d + ' T');
    colDays.push(d + ' N');
  });
  const headRow = ['Ressource', ...colDays];

  const colW_res  = 22;
  const colW_cell = (W - 24 - colW_res) / 14;

  const grpRows = TL_GROUPS.map(g => {
    const cells = [g.label];
    TL_DAYS.forEach((_, dayIdx) => {
      ['T', 'N'].forEach(sh => {
        const items = getSection(kw.id, dayIdx, sh, g.section);
        const labels = items.map(it => getItemLabel(it, g.section)).filter(l => l && l !== '–').slice(0, 3);
        cells.push(labels.join('\n') || '–');
      });
    });
    return cells;
  });

  y = pdfTable(doc, [headRow], grpRows, y, W, {
    fontSize: 6.5,
    headFontSize: 6,
    columnStyles: {
      0: { cellWidth: colW_res, fontStyle: 'bold', fillColor: [240,237,230] },
    },
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
  });
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
  const tasks = (cell.tasks || []).filter(t => t.name || t.location);
  if (tasks.length) {
    y = pdfSectionHeading(doc, 'Tätigkeiten', y, W);
    const body = tasks.map(t => [
      t.name || '–',
      t.location || '–',
      t.category || '–',
      t.status || '–',
      t.resStatus || '–',
      t.notes || '–',
    ]);
    y = pdfTable(doc,
      [['Tätigkeit','Bereich/Ort','Kategorie','Arbeitsstatus','Res.Status','Notizen']],
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
    snapshot.tables[id] = tbl.getData();
  });

  const dataJson = JSON.stringify(snapshot).replace(/<\/script>/gi, '<\\/script>');
  let html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
  html = html.replace(
    /<script id="savedData" type="application\/json">[\s\S]*?<\/script>/,
    '<script id="savedData" type="application/json">' + dataJson + '<\/script>'
  );

  const proj = stammdaten.projektname?.trim();
  const filename = proj
    ? 'Schichtplanung_' + proj.replace(/[^\w\-äöüÄÖÜ ]/g, '').replace(/\s+/g, '_') + '.html'
    : 'schichtplanung.html';

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  markClean();
  showToast('Datei heruntergeladen — bitte auf SharePoint hochladen');
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