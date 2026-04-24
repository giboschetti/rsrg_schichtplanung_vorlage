// ─── Utils ───────────────────────────────────────────────────────────────────

// ─── String / HTML helpers ────────────────────────────────────────────────────

function escAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeHtmlText(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escScriptText(s) {
  return String(s || '').replace(/<\/script>/gi, '<\\/script>');
}

function toAbsoluteUrl(url) {
  try { return new URL(url, location.href).href; }
  catch (_) { return url; }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

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

function toYMD(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/** Montag der ISO-Kalenderwoche (lokal) */
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

/** Montag der KW: bevorzugt „Datum von" (Mo), sonst aus Jahr + KW-Nummer */
function mondayDateForKw(kw) {
  if (!kw) return null;
  const from = parseLocalYMD(kw.dateFrom);
  if (from) return from;
  if (kw.year != null && kw.num != null) return isoWeekMondayLocal(kw.year, kw.num);
  return null;
}

function tlDayPlain(kw, dayIdx) {
  const mon = mondayDateForKw(kw);
  if (!mon || dayIdx < 0 || dayIdx > 6) return TL_DAYS[dayIdx] || '';
  const d = addDaysLocal(mon, dayIdx);
  return `${TL_DAYS[dayIdx]} ${d.getDate()}.${TL_MONTH_DE[d.getMonth()]}`;
}

function tlPdfDayHeader(kw, dayIdx, shiftId) {
  const mon = mondayDateForKw(kw);
  if (!mon || dayIdx < 0 || dayIdx > 6) return TL_DAYS[dayIdx] + (shiftId === 'T' ? ' T' : ' N');
  const d = addDaysLocal(mon, dayIdx);
  const dateStr = `${d.getDate()}. ${TL_MONTH_DE[d.getMonth()]}`;
  const shiftLabel = shiftId === 'T' ? 'Tag' : 'Nacht';
  return `${TL_DAYS[dayIdx]} - ${dateStr} - ${shiftLabel}`;
}

function tlDayThHtml(kw, dayIdx) {
  const mon = mondayDateForKw(kw);
  if (!mon || dayIdx < 0 || dayIdx > 6) return TL_DAYS[dayIdx] || '';
  const d = addDaysLocal(mon, dayIdx);
  const sub = `${d.getDate()}.${TL_MONTH_DE[d.getMonth()]}`;
  return `${TL_DAYS[dayIdx]}<span class="tl-date-sub">${sub}</span>`;
}

// ─── Normalization helpers ────────────────────────────────────────────────────

function normalizePersonalFunktion(raw) {
  const v = String(raw || '').trim();
  return v || 'Ohne Funktion';
}

function normalizeFachdienst(raw) {
  const v = String(raw || '').trim();
  return v || 'Andere';
}

function normalizeBauteil(raw) {
  const v = String(raw || '').trim();
  return v || 'Ohne Bauteil';
}

function normalizeTaetigkeit(raw) {
  const v = String(raw || '').trim();
  return v || 'Ohne Tätigkeit';
}

// ─── WorkItem display helpers ─────────────────────────────────────────────────

function getItemLabel(item, sectionId) {
  if (sectionId === 'tasks')         return item.taetigkeit || '–';
  if (sectionId === 'personal')      return (item.name || '').trim() || '–';
  if (sectionId === 'inventar')      return item.geraet   || '–';
  if (sectionId === 'material')      return item.material || '–';
  if (sectionId === 'fremdleistung') return item.firma    || '–';
  if (sectionId === 'intervalle')    return item.babNr || item.babTitel || '–';
  return '–';
}

function tlBlockClassFromResStatus(it, sectionId) {
  if (sectionId === 'intervalle') {
    const v = it.status;
    if (v === 'Verständigt')       return 'tl-rs-bestaetigt';
    if (v === 'Entwurf' || v === 'Änderung') return 'tl-rs-iv-warning';
    if (v === 'Zusätzlicher Bedarf') return 'tl-rs-planung';
    return 'tl-rs-none';
  }
  const v = it.resStatus;
  if (v === 'Planung')    return 'tl-rs-planung';
  if (v === 'Bestellt')   return 'tl-rs-bestellt';
  if (v === 'Bestätigt')  return 'tl-rs-bestaetigt';
  return 'tl-rs-none';
}

function tlBlockTitle(it, sectionId) {
  if (sectionId === 'tasks')
    return [it.taetigkeit, it.resStatus].filter(Boolean).join(' · ');
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
  if (sectionId === 'intervalle')
    return [it.babNr, it.babTitel, it.status].filter(Boolean).join(' · ');
  return '';
}

// ─── Data query helpers ───────────────────────────────────────────────────────

function getBauteileForFachdienst(fachdienst) {
  return Array.isArray(fachdienstBauteile[fachdienst]) ? [...fachdienstBauteile[fachdienst]] : [];
}

function getAllBauteile() {
  const seen = new Set();
  const result = [];
  Object.values(fachdienstBauteile).forEach(arr => {
    if (!Array.isArray(arr)) return;
    arr.forEach(v => {
      if (!seen.has(v)) { seen.add(v); result.push(v); }
    });
  });
  return result;
}

function getUsedPersonalFunctions() {
  const set = new Set();
  Object.values(workItems).forEach(cell => {
    const rows = Array.isArray(cell?.personal) ? cell.personal : [];
    rows.forEach(r => set.add(normalizePersonalFunktion(r?.funktion)));
  });
  const ordered = [];
  SDP_FUNKTION_VALUES.forEach(f => { if (set.has(f)) ordered.push(f); });
  const extras = Array.from(set).filter(f => !SDP_FUNKTION_VALUES.includes(f)).sort((a, b) => a.localeCompare(b, 'de-CH'));
  ordered.push(...extras);
  return ordered;
}

function getPersonalItemsByFunction(kwId, dayIdx, shift, funktion) {
  return getSection(kwId, dayIdx, shift, 'personal').filter(r => normalizePersonalFunktion(r?.funktion) === funktion);
}

function getUsedFachdienste() {
  const set = new Set();
  Object.values(workItems).forEach(cell => {
    const rows = Array.isArray(cell?.tasks) ? cell.tasks : [];
    rows.forEach(r => set.add(normalizeFachdienst(r?.fachdienst)));
  });
  const ordered = [];
  FACHDIENST_VALUES.forEach(f => { if (set.has(f)) ordered.push(f); });
  const extras = Array.from(set).filter(f => !FACHDIENST_VALUES.includes(f)).sort((a, b) => a.localeCompare(b, 'de-CH'));
  ordered.push(...extras);
  return ordered;
}

function getBauteileForFachdienstInUse(fachdienst) {
  const set = new Set();
  Object.values(workItems).forEach(cell => {
    const rows = Array.isArray(cell?.tasks) ? cell.tasks : [];
    rows
      .filter(r => normalizeFachdienst(r?.fachdienst) === fachdienst)
      .forEach(r => set.add(normalizeBauteil(r?.bauteil)));
  });
  const masterBauteile = getBauteileForFachdienst(fachdienst);
  const ordered = masterBauteile.filter(v => set.has(v));
  const extras = Array.from(set).filter(v => !ordered.includes(v)).sort((a, b) => a.localeCompare(b, 'de-CH'));
  ordered.push(...extras);
  return ordered;
}

function getTaskItemsByFachdienstBauteil(kwId, dayIdx, shift, fachdienst, bauteil) {
  return getSection(kwId, dayIdx, shift, 'tasks')
    .filter(r => normalizeFachdienst(r?.fachdienst) === fachdienst && normalizeBauteil(r?.bauteil) === bauteil);
}
