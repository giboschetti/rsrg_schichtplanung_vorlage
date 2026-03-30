// ─── Stammdaten ───────────────────────────────────────────────────────────────

function updateHeaderProj() {
  const el = document.getElementById('headerProjName');
  if (el) el.textContent = document.getElementById('sd-projektname')?.value || '';
}

// ─── Bauphase / Bauteil ───────────────────────────────────────────────────────

function setBauphaseBauteile(values) {
  const seen = new Set();
  bauphaseBauteile = (Array.isArray(values) ? values : [])
    .map(normalizeBauphaseBauteilValue)
    .filter(v => v.length > 0)
    .filter(v => {
      const k = v.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  renderBauphaseBauteileList();
  renderBauphaseBauteilOptions();
}

function getBauphaseBauteilOptions() {
  return [...bauphaseBauteile];
}

function renderBauphaseBauteileList() {
  const el = document.getElementById('bauphaseList');
  if (!el) return;
  if (!bauphaseBauteile.length) {
    el.innerHTML = '<div class="project-row bauphase-row"><div class="project-meta"><strong>Keine Bauphase/Bauteile definiert.</strong></div></div>';
    return;
  }
  el.innerHTML = bauphaseBauteile.map((value, idx) => `
    <div class="project-row bauphase-row">
      <div class="project-meta">
        <input type="text" class="bauphase-input" value="${escAttr(value)}" data-bauphase-idx="${idx}">
      </div>
      <button class="btn btn-danger" type="button" data-bauphase-remove="${idx}">✕</button>
    </div>
  `).join('');
}

function renderBauphaseBauteilOptions() {
  const select = document.getElementById('bulk-tasks-bauphase');
  if (select) {
    const current = select.value || '';
    const opts = ['<option value="">— Ohne Bauphase/Bauteil —</option>']
      .concat(getBauphaseBauteilOptions().map(v => `<option value="${escAttr(v)}">${escAttr(v)}</option>`));
    select.innerHTML = opts.join('');
    if (current && getBauphaseBauteilOptions().includes(current)) select.value = current;
  }
}

function addBauphaseBauteilFromInput() {
  const input = document.getElementById('sd-bauphase-input');
  const value = normalizeBauphaseBauteilValue(input?.value || '');
  if (!value) return;
  setBauphaseBauteile([...bauphaseBauteile, value]);
  saveStammdaten();
  if (input) input.value = '';
}
