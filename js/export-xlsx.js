// ─── XLSX Export ─────────────────────────────────────────────────────────────

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
