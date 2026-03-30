// ─── Standalone HTML Save ─────────────────────────────────────────────────────

let _fileSystemHandle = null;

const exportAssetCache = new Map();

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

function isStandaloneDocument() {
  const hasAppScript = document.querySelector('script[src*="app.js"]');
  const hasOurCss = document.querySelector('link[href*="styles.css"]');
  return !hasAppScript && !hasOurCss;
}

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

async function saveToFile() {
  const saveBtn = document.getElementById('btnSave');
  try {
    if (saveBtn) saveBtn.disabled = true;
    showToast('Erstelle Standalone-Datei...');
    flushOpenSDPTables();
    syncSavedDataToDom();
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
  stammdaten.bauphaseBauteile = [...bauphaseBauteile];

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

  const proj = stammdaten.projektname?.trim();
  const filename = proj
    ? 'Schichtplanung_' + proj.replace(/[^\w\-äöüÄÖÜ ]/g, '').replace(/\s+/g, '_') + '.html'
    : 'schichtplanung.html';

  async function saveViaFSA(html) {
    if (!('showSaveFilePicker' in window)) return false;
    try {
      if (!_fileSystemHandle) {
        _fileSystemHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'HTML Datei', accept: { 'text/html': ['.html'] } }],
        });
      }
      const writable = await _fileSystemHandle.createWritable();
      await writable.write(html);
      await writable.close();
      return true;
    } catch (e) {
      if (e.name === 'AbortError') { _fileSystemHandle = null; return null; }
      console.warn('FSA save failed, falling back to download:', e);
      _fileSystemHandle = null;
      return false;
    }
  }

  function saveViaDownload(html) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
  }

  async function doSave(html) {
    const fsaResult = await saveViaFSA(html);
    if (fsaResult === null) {
      if (saveBtn) saveBtn.disabled = false;
      return;
    }
    if (fsaResult) {
      markClean();
      showToast('✅ Direkt gespeichert: ' + (_fileSystemHandle?.name || filename));
    } else {
      saveViaDownload(html);
      markClean();
      showToast('Datei heruntergeladen – bitte Original ersetzen');
    }
    if (saveBtn) saveBtn.disabled = false;
  }

  try {
    const html = isStandaloneDocument()
      ? buildStandaloneHtmlSync(snapshot)
      : await buildStandaloneHtml(snapshot);
    await doSave(html);
  } catch (err) {
    console.error('Standalone export failed:', err);
    showToast('Export fehlgeschlagen: ' + (err?.message || 'Unbekannter Fehler'));
    if (saveBtn) saveBtn.disabled = false;
  }
}
