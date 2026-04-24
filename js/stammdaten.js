// ─── Stammdaten ───────────────────────────────────────────────────────────────

function updateHeaderProj() {
  const el = document.getElementById('headerProjName');
  if (el) el.textContent = document.getElementById('sd-projektname')?.value || '';
}

// ─── Fachdienst / Bauteil ─────────────────────────────────────────────────────

function setFachdienstBauteile(data) {
  fachdienstBauteile = {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) return;
  Object.entries(data).forEach(([fd, arr]) => {
    if (!Array.isArray(arr)) return;
    const seen = new Set();
    fachdienstBauteile[fd] = arr
      .map(v => String(v || '').trim())
      .filter(v => v.length > 0)
      .filter(v => {
        const k = v.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  });
  renderFachdienstBauteileList();
  renderBulkAddBauteilOptions();
}

function addBauteilToFachdienst(fachdienst, bauteil) {
  const v = String(bauteil || '').trim();
  if (!v) return;
  if (!fachdienstBauteile[fachdienst]) fachdienstBauteile[fachdienst] = [];
  const existing = fachdienstBauteile[fachdienst];
  if (existing.some(e => e.toLowerCase() === v.toLowerCase())) return;
  existing.push(v);
  renderFachdienstBauteileList();
  renderBulkAddBauteilOptions();
}

function removeBauteilFromFachdienst(fachdienst, idx) {
  if (!fachdienstBauteile[fachdienst]) return;
  fachdienstBauteile[fachdienst].splice(idx, 1);
  renderFachdienstBauteileList();
  renderBulkAddBauteilOptions();
}

function renderFachdienstBauteileList() {
  const el = document.getElementById('fachdienstBauteilList');
  if (!el) return;
  const hasAny = FACHDIENST_VALUES.some(fd => (fachdienstBauteile[fd] || []).length > 0);
  if (!hasAny) {
    el.innerHTML = '<div class="project-row bauphase-row"><div class="project-meta"><strong>Keine Bauteile definiert.</strong></div></div>';
    return;
  }
  let html = '';
  FACHDIENST_VALUES.forEach(fd => {
    const items = fachdienstBauteile[fd] || [];
    if (!items.length) return;
    html += `<div class="bauphase-group"><div class="bauphase-group-hdr">${escAttr(fd)}</div>`;
    items.forEach((bauteil, idx) => {
      html += `
        <div class="project-row bauphase-row">
          <div class="project-meta">${escapeHtmlText(bauteil)}</div>
          <button class="btn btn-danger" type="button"
            data-fd-remove="${escAttr(fd)}" data-fd-idx="${idx}">✕</button>
        </div>`;
    });
    html += '</div>';
  });
  el.innerHTML = html || '<div class="project-row bauphase-row"><div class="project-meta"><strong>Keine Bauteile definiert.</strong></div></div>';
}

function renderBulkAddBauteilOptions() {
  const bauteilEl = document.getElementById('bulk-tasks-bauteil');
  if (!bauteilEl) return;
  const fachdienstEl = document.getElementById('bulk-tasks-fachdienst');
  const fachdienst = fachdienstEl?.value || '';
  const options = fachdienst ? getBauteileForFachdienst(fachdienst) : getAllBauteile();
  const current = bauteilEl.value;
  bauteilEl.innerHTML = ['<option value="">— Ohne Bauteil —</option>']
    .concat(options.map(v => `<option value="${escAttr(v)}">${escAttr(v)}</option>`))
    .join('');
  if (current && options.includes(current)) bauteilEl.value = current;
}
