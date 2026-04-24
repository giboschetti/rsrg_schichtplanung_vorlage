// ─── Dirty / Clean ───────────────────────────────────────────────────────────

function markDirty() {
  const btn = document.getElementById('btnSave');
  if (btn) { btn.classList.add('dirty'); btn.disabled = false; }
  scheduleSyncSavedDataToDom();
}
function markClean() { document.getElementById('btnSave')?.classList.remove('dirty'); }

let syncSavedDataTimer = null;
function scheduleSyncSavedDataToDom() {
  if (!isStandaloneDocument()) return;
  if (syncSavedDataTimer) clearTimeout(syncSavedDataTimer);
  syncSavedDataTimer = setTimeout(() => {
    syncSavedDataTimer = null;
    syncSavedDataToDom();
  }, 300);
}

function syncSavedDataToDom() {
  if (!isStandaloneDocument()) return;
  const el = document.getElementById('savedData');
  if (!el) return;
  try {
    const sdIds = ['projektname','projektnummer','auftraggeber','bauleiter','polier','standort','baubeginn','bauende'];
    const stammdaten = {};
    sdIds.forEach(id => {
      const e = document.getElementById('sd-' + id);
      if (e) stammdaten[id] = e.value;
    });
    stammdaten.fachdienstBauteile = JSON.parse(JSON.stringify(fachdienstBauteile));
    const snapshot = {
      savedAt: new Date().toISOString(),
      stammdaten,
      shiftConfig,
      kwList: JSON.parse(JSON.stringify(kwList)),
      tables: {},
      workItems: JSON.parse(JSON.stringify(workItems)),
    };
    Object.entries(tables).forEach(([id, tbl]) => {
      try { if (tbl && typeof tbl.getData === 'function') snapshot.tables[id] = tbl.getData(); }
      catch (_) {}
    });
    el.textContent = escScriptText(JSON.stringify(snapshot));
  } catch (e) { console.warn('syncSavedDataToDom failed:', e); }
}

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
  data.fachdienstBauteile = JSON.parse(JSON.stringify(fachdienstBauteile));
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
    setFachdienstBauteile(data?.fachdienstBauteile || {});
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

// ─── WorkItems Key & Persistence ─────────────────────────────────────────────

function wiKey(kwId, dayIdx, shift) { return kwId + '||' + dayIdx + '||' + shift; }

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
      Object.entries(loaded).forEach(([key, val]) => {
        if (Array.isArray(val)) {
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
      Object.values(workItems).forEach(cell => {
        if (cell?.tasks) {
          cell.tasks = cell.tasks.map(it => {
            const { category, status, name, bauphaseBauteil, ...rest } = it;
            const migrated = { beschreibung: '', ...rest, resStatus: rest.resStatus ?? '' };
            // Migrate old fields: name → taetigkeit, bauphaseBauteil → bauteil
            if (!migrated.taetigkeit && name) migrated.taetigkeit = name;
            if (!migrated.bauteil && bauphaseBauteil) migrated.bauteil = bauphaseBauteil;
            if (!migrated.fachdienst) migrated.fachdienst = 'Andere';
            return migrated;
          });
        }
        if (!Array.isArray(cell?.intervalle)) cell.intervalle = [];
      });
    }
  } catch(e) {}
}

// ─── Load from Embedded Data ──────────────────────────────────────────────────

function loadFromEmbeddedData() {
  if (!isStandaloneDocument()) return;
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
