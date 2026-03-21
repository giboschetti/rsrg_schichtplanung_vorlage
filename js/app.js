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
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = buildPDFHeader(doc, 'ÜBERSICHT BAUSTELLE', '');

  const heads = [['KW', 'Tag', 'Schicht', 'Sektion', 'Bezeichnung', 'Details', 'Status']];
  const body = [];
  Object.entries(workItems).forEach(([key, cell]) => {
    if (!cell || typeof cell !== 'object') return;
    const [kwId, dayStr, shift] = key.split('||');
    const kw  = kwList.find(k => k.id === kwId);
    const day = TL_DAYS[parseInt(dayStr)] || dayStr;
    const sh  = shift === 'T' ? 'Tag' : 'Nacht';
    (cell.tasks||[]).forEach(it => body.push([kw?.label||kwId, day, sh, 'Tätigkeiten', it.name||'', it.location||'',
      [it.resStatus, it.status].filter(Boolean).join(' / ')]));
    (cell.personal||[]).forEach(it => body.push([kw?.label||kwId, day, sh, 'Personal', it.funktion||'', it.name||'',
      [it.resStatus, it.bemerkung].filter(Boolean).join(' — ')]));
    (cell.inventar||[]).forEach(it => body.push([kw?.label||kwId, day, sh, 'Inventar', it.geraet||'', '',
      [it.resStatus, it.bemerkung].filter(Boolean).join(' — ')]));
    (cell.material||[]).forEach(it => body.push([kw?.label||kwId, day, sh, 'Material', it.material||'', it.einheit||'',
      [it.resStatus, it.bemerkung].filter(Boolean).join(' — ')]));
    (cell.fremdleistung||[]).forEach(it => body.push([kw?.label||kwId, day, sh, 'Fremdleistung', it.firma||'', it.leistung||'',
      [it.resStatus, it.bemerkung].filter(Boolean).join(' — ')]));
  });
  if (!body.length) { showToast('Keine Einträge vorhanden'); return; }
  doc.autoTable({ head: heads, body, startY: y, margin: { left: 14, right: 14 },
    styles: { fontSize: 6.5, cellPadding: 1.5 },
    headStyles: { fillColor: [42,42,44], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
    alternateRowStyles: { fillColor: [247,244,238] },
    tableLineColor: [220,216,206], tableLineWidth: 0.1 });
  addPDFFooters(doc);
  doc.save('Uebersicht_Baustelle.pdf');
  showToast('PDF exportiert');
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

function buildPDFHeader(doc, title, subtitle) {
  doc.setFillColor(28, 28, 30);
  doc.rect(0, 0, 297, 17, 'F');
  doc.setFillColor(255, 99, 0);
  doc.rect(0, 17, 297, 1.5, 'F');
  doc.setTextColor(242, 239, 232);
  doc.setFontSize(13); doc.setFont(undefined, 'bold');
  doc.text(title, 14, 11);
  doc.setFontSize(9); doc.setFont(undefined, 'normal');
  doc.text(subtitle, 80, 11);
  const proj = document.getElementById('sd-projektname')?.value || '';
  if (proj) { doc.setFontSize(8); doc.text(proj, 260, 11, { align: 'right' }); }
  doc.setTextColor(0);
  return 24;
}

function addPDFFooters(doc) {
  const n = doc.internal.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(160);
    doc.text('Seite ' + i + ' / ' + n, 283, 205, { align: 'right' });
    doc.text('Exportiert: ' + new Date().toLocaleDateString('de-CH'), 14, 205);
  }
}

function addPDFSection(doc, id, title, yRef) {
  if (!tables[id]) return yRef;
  const data = tables[id].getData().filter(r => Object.values(r).some(v => v !== '' && v !== undefined));
  if (!data.length) return yRef;
  const cols   = tables[id].getColumns();
  const heads  = cols.map(c => c.getDefinition().title);
  const fields = cols.map(c => c.getDefinition().field);
  const rows   = data.map(row => fields.map(f => String(row[f] ?? '')));
  if (yRef > 174) { doc.addPage(); yRef = 14; }
  doc.setFontSize(9); doc.setFont(undefined, 'bold'); doc.setTextColor(42, 42, 44);
  doc.text(title, 14, yRef); yRef += 4; doc.setFont(undefined, 'normal');
  doc.autoTable({ head: [heads], body: rows, startY: yRef, margin: { left: 14, right: 14 },
    styles: { fontSize: 6.5, cellPadding: 1.5 },
    headStyles: { fillColor: [42, 42, 44], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
    alternateRowStyles: { fillColor: [247, 244, 238] },
    tableLineColor: [220, 216, 206], tableLineWidth: 0.1 });
  return doc.lastAutoTable.finalY + 8;
}

function exportAllPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = buildPDFHeader(doc, 'SCHICHTPLANUNG', '');
  y = addPDFSection(doc, 'mitarbeiter', 'Mitarbeiter', y);
  addPDFFooters(doc);
  doc.save('Schichtplanung_Gesamt.pdf');
  showToast('PDF exportiert');
}

// ─── Save to File (File System Access API oder Download-Fallback) ────────────

const SAVE_FILE_IDB = { db: 'schichtplanung_fs', store: 'meta', key: 'htmlSaveHandle' };

function idbOpenSaveStore() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SAVE_FILE_IDB.db, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(SAVE_FILE_IDB.store))
        db.createObjectStore(SAVE_FILE_IDB.store);
    };
  });
}

async function getStoredSaveFileHandle() {
  try {
    const db = await idbOpenSaveStore();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(SAVE_FILE_IDB.store, 'readonly');
      const r = tx.objectStore(SAVE_FILE_IDB.store).get(SAVE_FILE_IDB.key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  } catch (_) { return null; }
}

async function setStoredSaveFileHandle(handle) {
  try {
    const db = await idbOpenSaveStore();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SAVE_FILE_IDB.store, 'readwrite');
      tx.objectStore(SAVE_FILE_IDB.store).put(handle, SAVE_FILE_IDB.key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) { console.warn('Konnte Speicherort-Merkung nicht speichern', e); }
}

function saveToFileFallbackDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  markClean();
  showToast('Download gestartet (Browser ohne Speichern-Dialog — Datei manuell ersetzen)');
}

/** Multi-file-Setup: gespeicherte HTML muss CSS/JS eingebettet haben (Portabel wie Einzeldatei). */
async function inlineBundledAssets(html) {
  let out = html;
  const link = document.querySelector('link[rel="stylesheet"][href="css/styles.css"]')
    || document.querySelector('link[rel="stylesheet"][href$="styles.css"]');
  if (link && (link.getAttribute('href') || '').includes('styles.css') && !link.href.includes('tabulator')) {
    const href = link.getAttribute('href');
    const abs = new URL(href, document.baseURI).href;
    const css = (await (await fetch(abs)).text()).replace(/<\/style>/gi, '<\\/style>');
    out = out.replace(/<link[^>]*rel=["']stylesheet["'][^>]*href=["'][^"']*styles\.css["'][^>]*>/i, '<style>\n' + css + '\n</style>');
  }
  const scr = document.querySelector('script[src="js/app.js"]');
  if (scr) {
    const href = scr.getAttribute('src');
    const abs = new URL(href, document.baseURI).href;
    const js = (await (await fetch(abs)).text()).replace(/<\/script>/gi, '<\\/script>');
    const esc = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp('<script[^>]*src=["\']' + esc + '["\'][^>]*>\\s*</script>', 'i'), '<script>\n' + js + '\n</script>');
  }
  return out;
}

async function saveToFile() {
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

  try {
    html = await inlineBundledAssets(html);
  } catch (e) {
    console.warn('inlineBundledAssets', e);
    showToast('CSS/JS konnte nicht eingebettet werden — Seite über http(s) öffnen (z. B. GitHub Pages) oder lokalen Server nutzen.');
    return;
  }

  const proj = stammdaten.projektname?.trim();
  const filename = proj
    ? 'Schichtplanung_' + proj.replace(/[^\w\-äöüÄÖÜ ]/g, '').replace(/\s+/g, '_') + '.html'
    : 'schichtplanung.html';

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });

  if (typeof window.showSaveFilePicker !== 'function') {
    saveToFileFallbackDownload(blob, filename);
    return;
  }

  try {
    const lastHandle = await getStoredSaveFileHandle();
    const pickerOpts = {
      suggestedName: filename,
      types: [{
        description: 'HTML (Schichtplanung)',
        accept: { 'text/html': ['.html'] },
      }],
    };
    if (lastHandle) pickerOpts.startIn = lastHandle;

    const fileHandle = await window.showSaveFilePicker(pickerOpts);
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    await setStoredSaveFileHandle(fileHandle);
    markClean();
    showToast(lastHandle
      ? 'Gespeichert — Dialog startete im zuletzt gewählten Ordner (Ersetzen bestätigen falls gleicher Name)'
      : 'Gespeichert — beim nächsten Speichern öffnet der Dialog wieder in diesem Ordner');
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    console.warn('Speichern-Dialog fehlgeschlagen, Fallback Download:', e);
    saveToFileFallbackDownload(blob, filename);
  }
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