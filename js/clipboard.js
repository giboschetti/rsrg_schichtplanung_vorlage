// ─── Clipboard helpers ────────────────────────────────────────────────────────

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

function parseRangeClipboardPayload(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();
  if (!t.startsWith('{')) return null;
  try {
    const o = JSON.parse(t);
    if (o._schichtplanungRangeV1 && Array.isArray(o.cells)) return o;
  } catch (_) { return null; }
  return null;
}

// ─── Range Selection ──────────────────────────────────────────────────────────

function tlGroupIndex(grpId) {
  return TL_GROUPS.findIndex(g => g.id === grpId);
}

function tlCellCoordsFromElement(el) {
  if (!el) return null;
  const kwId = el.dataset.kw;
  const dayIdx = parseInt(el.dataset.day);
  const shift = el.dataset.shift;
  const grp = el.dataset.grp;
  const kwIdx = kwList.findIndex(k => k.id === kwId);
  const row = tlGroupIndex(grp);
  if (!kwId || Number.isNaN(dayIdx) || !shift || kwIdx < 0 || row < 0) return null;
  return { kwId, dayIdx, shift, grp, kwIdx, col: kwIdx * 14 + dayIdx * 2 + (shift === 'T' ? 0 : 1), row };
}

function clearTimelineRangeSelection() {
  tlRangeSelection = null;
}

function setTimelineRangeSelection(a, b) {
  if (!a || !b) return false;
  if (a.shift !== b.shift) return false;
  tlRangeSelection = {
    shift: a.shift,
    rowMin: Math.min(a.row, b.row),
    rowMax: Math.max(a.row, b.row),
    colMin: Math.min(a.col, b.col),
    colMax: Math.max(a.col, b.col),
  };
  return true;
}

function isCoordsInTimelineRange(coords, range) {
  if (!coords || !range) return false;
  return (
    coords.shift === range.shift
    && coords.row >= range.rowMin
    && coords.row <= range.rowMax
    && coords.col >= range.colMin
    && coords.col <= range.colMax
  );
}

function applyTimelineRangeSelectionHighlight() {
  const wrapper = document.getElementById('timelineWrapper');
  if (!wrapper) return;
  wrapper.querySelectorAll('.tl-cell.selected-range').forEach(td => td.classList.remove('selected-range'));
  if (!tlRangeSelection) return;
  wrapper.querySelectorAll('.tl-cell[data-shift]').forEach(td => {
    const c = tlCellCoordsFromElement(td);
    if (isCoordsInTimelineRange(c, tlRangeSelection)) td.classList.add('selected-range');
  });
}

// ─── WorkItem Cell Manipulation ───────────────────────────────────────────────

function appendSectionsToCell(kwId, dayIdx, shift, sections, opts = {}) {
  const { replace = false } = opts;
  const key = wiKey(kwId, dayIdx, shift);
  if (!workItems[key]) workItems[key] = {};
  const regenerated = regenerateShiftPayloadIds(sections || {});
  SHIFT_CLIP_SECTIONS.forEach(section => {
    const incoming = Array.isArray(regenerated[section]) ? regenerated[section] : [];
    const existing = Array.isArray(workItems[key][section]) ? workItems[key][section] : [];
    workItems[key][section] = replace ? incoming : [...existing, ...incoming];
  });
}

function applyShiftPayloadToCell(kwId, dayIdx, shift, payload, opts = {}) {
  const { replace = false, render = true } = opts;
  flushOpenSDPTables();
  appendSectionsToCell(kwId, dayIdx, shift, payload, { replace });
  saveWorkItemsLS();
  markDirty();
  if (render) {
    updateStats();
    renderTimeline();
    renderKWList();
    if (selectedCell && selectedCell.kwId === kwId && selectedCell.dayIdx === dayIdx && selectedCell.shift === shift) {
      initSDPTables(kwId, dayIdx, shift);
      selectedCell.grp ? showOnlySDPSection(selectedCell.grp) : showAllSDPSections();
    }
  }
}

function applySectionToShift(kwId, dayIdx, shift, section, data, opts = {}) {
  const { replace = false, render = true } = opts;
  appendSectionsToCell(kwId, dayIdx, shift, { [section]: data }, { replace });
  saveWorkItemsLS();
  markDirty();
  if (render) {
    updateStats();
    renderTimeline();
    renderKWList();
    if (selectedCell && selectedCell.kwId === kwId && selectedCell.dayIdx === dayIdx && selectedCell.shift === shift) {
      if (sdpTables[section]) sdpTables[section].setData(getSection(kwId, dayIdx, shift, section));
    }
  }
}

// ─── Copy / Paste ─────────────────────────────────────────────────────────────

function copyTimelineRangeToClipboard() {
  if (!tlRangeSelection) return false;
  const cells = [];
  for (let row = tlRangeSelection.rowMin; row <= tlRangeSelection.rowMax; row++) {
    const grp = TL_GROUPS[row]?.id;
    if (!grp) continue;
    for (let col = tlRangeSelection.colMin; col <= tlRangeSelection.colMax; col++) {
      const kwIdx = Math.floor(col / 14);
      const dayIdx = Math.floor((col % 14) / 2);
      const kw = kwList[kwIdx];
      if (!kw) continue;
      cells.push({
        row,
        col,
        grp,
        sections: { [grp]: JSON.parse(JSON.stringify(getSection(kw.id, dayIdx, tlRangeSelection.shift, grp))) },
      });
    }
  }
  const wrap = {
    _schichtplanungRangeV1: true,
    shift: tlRangeSelection.shift,
    rowMin: tlRangeSelection.rowMin,
    colMin: tlRangeSelection.colMin,
    rowMax: tlRangeSelection.rowMax,
    colMax: tlRangeSelection.colMax,
    cells,
  };
  lastClipboardInternal = { type: 'range', payload: wrap };
  const json = JSON.stringify(wrap);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(json).then(() => showToast('Bereich kopiert (Strg+V)')).catch(() => showToast('Bereich kopiert'));
  } else {
    showToast('Bereich kopiert');
  }
  return true;
}

function pasteTimelineRangePayload(rangePayload) {
  if (!rangePayload || !timelineShiftFocus) return false;
  const targetShift = timelineShiftFocus.shift;
  const targetRowStart = timelineShiftFocus.grp ? tlGroupIndex(timelineShiftFocus.grp) : rangePayload.rowMin;
  const targetKwIdx = kwList.findIndex(k => k.id === timelineShiftFocus.kwId);
  if (targetKwIdx < 0 || targetRowStart < 0) return false;
  const targetColStart = targetKwIdx * 14 + timelineShiftFocus.dayIdx * 2 + (targetShift === 'T' ? 0 : 1);

  let pasted = 0;
  rangePayload.cells.forEach(cell => {
    const rowDelta = cell.row - rangePayload.rowMin;
    const colDelta = cell.col - rangePayload.colMin;
    const tRow = targetRowStart + rowDelta;
    const tCol = targetColStart + colDelta;
    if (tRow < 0 || tRow >= TL_GROUPS.length) return;
    const tGrp = TL_GROUPS[tRow].id;
    const tKwIdx = Math.floor(tCol / 14);
    const tDayIdx = Math.floor((tCol % 14) / 2);
    const tKw = kwList[tKwIdx];
    if (!tKw) return;
    const srcSection = Object.keys(cell.sections || {}).find(k => SHIFT_CLIP_SECTIONS.includes(k));
    if (!srcSection) return;
    const rows = Array.isArray(cell.sections[srcSection]) ? cell.sections[srcSection] : [];
    if (!rows.length) return;
    appendSectionsToCell(tKw.id, tDayIdx, targetShift, { [tGrp]: rows }, { replace: false });
    pasted += rows.length;
  });

  if (!pasted) return false;
  saveWorkItemsLS();
  markDirty();
  updateStats();
  renderTimeline();
  renderKWList();
  if (selectedCell && sdpTables[selectedCell.grp || '']) {
    initSDPTables(selectedCell.kwId, selectedCell.dayIdx, selectedCell.shift);
    selectedCell.grp ? showOnlySDPSection(selectedCell.grp) : showAllSDPSections();
  }
  showToast('Bereich eingefügt');
  return true;
}

function copyTimelineShiftToClipboard() {
  if (copyTimelineRangeToClipboard()) return;
  if (!timelineShiftFocus) {
    showToast('Zuerst eine Schicht-Zelle anklicken (Ansicht „Schichten")');
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
  sdpRowClipboardInternal = null;
  lastClipboardInternal = { type: 'shift', payload: wrap };
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
      applySectionToShift(kwId, dayIdx, shift, clipSection, sections[clipSection], { replace: false });
      showToast('Ressource eingefügt');
    } else {
      const fullPayload = {};
      SHIFT_CLIP_SECTIONS.forEach(s => { fullPayload[s] = sections[s] || []; });
      applyShiftPayloadToCell(kwId, dayIdx, shift, fullPayload, { replace: false });
      showToast('Schicht eingefügt');
    }
  };
  if (navigator.clipboard?.readText) {
    navigator.clipboard.readText().then(text => {
      let rangePayload = parseRangeClipboardPayload(text);
      if (!rangePayload && lastClipboardInternal?.type === 'range') rangePayload = lastClipboardInternal.payload;
      if (rangePayload && pasteTimelineRangePayload(rangePayload)) return;
      let sections = parseShiftClipboardPayload(text);
      if (!sections && lastClipboardInternal && (lastClipboardInternal.type === 'shift' || lastClipboardInternal.type === 'row')) {
        sections = lastClipboardInternal.payload?.sections || null;
      }
      apply(sections);
    }).catch(() => {
      if (lastClipboardInternal?.type === 'range' && pasteTimelineRangePayload(lastClipboardInternal.payload)) return;
      if (lastClipboardInternal && (lastClipboardInternal.type === 'shift' || lastClipboardInternal.type === 'row')) {
        apply(lastClipboardInternal.payload?.sections || null);
        return;
      }
      apply(null);
    });
  } else {
    if (lastClipboardInternal?.type === 'range' && pasteTimelineRangePayload(lastClipboardInternal.payload)) return;
    if (lastClipboardInternal && (lastClipboardInternal.type === 'shift' || lastClipboardInternal.type === 'row')) {
      apply(lastClipboardInternal.payload?.sections || null);
      return;
    }
    apply(null);
  }
}
