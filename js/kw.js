// ─── Tab Management ──────────────────────────────────────────────────────────

function switchTab(pageId) {
  flushOpenSDPTables();
  if (pageId !== 'uebersicht') {
    clearTimelineRangeSelection();
    applyTimelineRangeSelectionHighlight();
  }
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

// ─── Bulk Add Resources ───────────────────────────────────────────────────────

/** Returns [{kwId, dayIdx, shift}, ...] for all cells in date range, selected shifts, and allowed days. */
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
  if (type === 'tasks') renderBauphaseBauteilOptions();
  updateBulkAddPreview();
}

function getBulkAddAllowedDays() {
  const sa = document.getElementById('bulkAddDaySa')?.checked;
  const so = document.getElementById('bulkAddDaySo')?.checked;
  const days = [0, 1, 2, 3, 4];
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
    row.bauphaseBauteil = normalizeBauphaseBauteilValue(document.getElementById('bulk-tasks-bauphase')?.value || '');
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
  if (!from || !to) { showToast('Zeitraum (Von/Bis) angeben'); return; }
  const tag = document.getElementById('bulkAddShiftTag')?.checked;
  const nacht = document.getElementById('bulkAddShiftNacht')?.checked;
  const shifts = [];
  if (tag) shifts.push('T');
  if (nacht) shifts.push('N');
  if (!shifts.length) { showToast('Mindestens eine Schicht (Tag oder Nacht) auswählen'); return; }
  const allowedDays = getBulkAddAllowedDays();
  const row = collectBulkAddData(section);
  if (!hasBulkAddRequiredField(section, row)) {
    const labels = { personal: 'Name', material: 'Material', inventar: 'Gerät/Inventar', tasks: 'Tätigkeit', fremdleistung: 'Firma' };
    showToast('Pflichtfeld angeben: ' + (labels[section] || section));
    return;
  }
  const targets = getTargetCellsFromDateRange(from, to, shifts, allowedDays);
  if (!targets.length) { showToast('Keine Schichten im gewählten Zeitraum'); return; }
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

// ─── KW Management ───────────────────────────────────────────────────────────

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
