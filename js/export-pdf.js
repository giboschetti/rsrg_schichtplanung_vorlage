// ─── PDF helpers ──────────────────────────────────────────────────────────────

function pdfHeader(doc, projName, subtitle, isLandscape) {
  const W = isLandscape ? 297 : 210;
  doc.setFillColor(...PDF_C.dark);
  doc.rect(0, 0, W, 18, 'F');
  doc.setFillColor(...PDF_C.orange);
  doc.rect(0, 18, W, 2, 'F');

  doc.setFillColor(...PDF_C.orange);
  doc.rect(12, 4, 10, 10, 'F');
  doc.setTextColor(...PDF_C.dark);
  doc.setFontSize(6); doc.setFont(undefined, 'bold');
  doc.text('RSRG', 17, 10.5, { align: 'center' });

  doc.setTextColor(...PDF_C.offwht);
  doc.setFontSize(11); doc.setFont(undefined, 'bold');
  doc.text(projName || 'Schichtplanung', 26, 10);

  const dateStr = 'Ausdruck: ' + new Date().toLocaleDateString('de-CH');
  doc.setFontSize(7.5); doc.setFont(undefined, 'normal');
  doc.setTextColor(...PDF_C.offwht);
  doc.text(dateStr, W - 12, 10, { align: 'right' });

  if (subtitle) {
    doc.setFontSize(7); doc.setTextColor(200, 200, 200);
    doc.text(subtitle, W - 12, 15, { align: 'right' });
  }

  doc.setTextColor(...PDF_C.text);
  return 26;
}

function pdfFooters(doc, isLandscape) {
  const W   = isLandscape ? 297 : 210;
  const H   = isLandscape ? 210 : 297;
  const n   = doc.internal.getNumberOfPages();
  const proj = document.getElementById('sd-projektname')?.value || '';
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...PDF_C.border);
    doc.setLineWidth(0.3);
    doc.line(12, H - 10, W - 12, H - 10);
    doc.setFontSize(7); doc.setFont(undefined, 'normal'); doc.setTextColor(...PDF_C.muted);
    doc.text('Exportiert: ' + new Date().toLocaleDateString('de-CH'), 12, H - 6);
    if (proj) doc.text(proj, W / 2, H - 6, { align: 'center' });
    doc.text('Seite ' + i + ' / ' + n, W - 12, H - 6, { align: 'right' });
  }
}

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

  const allBauteile = getAllBauteile();
  if (allBauteile.length) {
    y += 4;
    y = pdfSectionHeading(doc, 'Fachdienst / Bauteil', y, W);
    const bpBody = [];
    FACHDIENST_VALUES.forEach(fd => {
      const items = getBauteileForFachdienst(fd);
      if (!items.length) return;
      items.forEach(bauteil => bpBody.push([fd, bauteil]));
    });
    y = pdfTable(doc, [['Fachdienst', 'Bauteil']], bpBody, y, W, { fontSize: 7.5 });
  }

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

function buildKWSummaryPage(doc, kw, y, W, proj) {
  const H = 210;
  if (y > H - 55) {
    doc.addPage();
    y = pdfHeader(doc, proj, '', true);
  }

  y = pdfSectionHeading(doc, kw.label, y, W);

  const colW_res  = 22;
  const colW_day  = (W - 24 - colW_res) / 7;

  const pdfColStyles = {
    0: { cellWidth: colW_res, fontStyle: 'bold', fillColor: [240,237,230] },
    1: { cellWidth: colW_day }, 2: { cellWidth: colW_day }, 3: { cellWidth: colW_day },
    4: { cellWidth: colW_day }, 5: { cellWidth: colW_day }, 6: { cellWidth: colW_day },
    7: { cellWidth: colW_day },
  };

  const pdfTableOpts = {
    fontSize: 6.5,
    headFontSize: 6,
    columnStyles: pdfColStyles,
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
  };

  const headRowTag   = ['Ressource', ...TL_DAYS.map((_, dayIdx) => tlPdfDayHeader(kw, dayIdx, 'T'))];
  const headRowNacht = ['Ressource', ...TL_DAYS.map((_, dayIdx) => tlPdfDayHeader(kw, dayIdx, 'N'))];

  function buildSummaryRow(label, shiftId, getItemsForDay) {
    const cells = [label];
    TL_DAYS.forEach((_, dayIdx) => {
      const items = getItemsForDay(dayIdx, shiftId);
      const labels = items.map(it => getItemLabel(it, it._sectionId || 'tasks')).filter(l => l && l !== '–').slice(0, 3);
      cells.push(labels.join('\n') || '–');
    });
    return cells;
  }

  function withSection(items, sectionId) {
    return items.map(it => ({ ...it, _sectionId: sectionId }));
  }

  function buildKWSummaryRowsForShift(shiftId) {
    const rows = [];
    TL_GROUPS.forEach(g => {
      if (g.id === 'personal') {
        rows.push(buildSummaryRow('Personal', shiftId, () => []));
        getUsedPersonalFunctions().forEach(funktion => {
          rows.push(buildSummaryRow('  ↳ ' + funktion, shiftId, dayIdx =>
            withSection(getPersonalItemsByFunction(kw.id, dayIdx, shiftId, funktion), 'personal')
          ));
        });
        return;
      }
      if (g.id === 'tasks') {
        rows.push(buildSummaryRow('Tätigkeiten', shiftId, () => []));
        getUsedFachdienste().forEach(fd => {
          getBauteileForFachdienstInUse(fd).forEach(bauteil => {
            rows.push(buildSummaryRow('  ↳ ' + fd + ' / ' + bauteil, shiftId, dayIdx =>
              withSection(getTaskItemsByFachdienstBauteil(kw.id, dayIdx, shiftId, fd, bauteil), 'tasks')
            ));
          });
        });
        return;
      }
      rows.push(buildSummaryRow(g.label, shiftId, dayIdx =>
        withSection(getSection(kw.id, dayIdx, shiftId, g.section), g.section)
      ));
    });
    return rows;
  }

  const grpRowsTag   = buildKWSummaryRowsForShift('T');
  const grpRowsNacht = buildKWSummaryRowsForShift('N');

  y = pdfTable(doc, [headRowTag], grpRowsTag, y, W, pdfTableOpts);
  y = doc.lastAutoTable.finalY + 10;
  y = pdfTable(doc, [headRowNacht], grpRowsNacht, y, W, pdfTableOpts);

  return y;
}

// ─── Per-shift detail page ────────────────────────────────────────────────────

function buildShiftDetailPage(doc, kw, dayIdx, shift, y, W, proj) {
  const shLabel = shift === 'T'
    ? `Tag (${shiftConfig.tag.von} – ${shiftConfig.tag.bis})`
    : `Nacht (${shiftConfig.nacht.von} – ${shiftConfig.nacht.bis})`;
  const dayLabel = tlDayPlain(kw, dayIdx);
  const subtitle = kw.label + '  —  ' + dayLabel + '  —  ' + shLabel;

  const cell = workItems[wiKey(kw.id, dayIdx, shift)] || {};
  const hasContent = ['tasks','personal','inventar','material','fremdleistung','intervalle']
    .some(s => (cell[s] || []).length > 0);
  if (!hasContent) return y;

  doc.addPage();
  y = pdfHeader(doc, proj, subtitle, true);

  const tasks = (cell.tasks || []).filter(t => t.taetigkeit || t.beschreibung || t.location);
  if (tasks.length) {
    y = pdfSectionHeading(doc, 'Tätigkeiten', y, W);
    const body = tasks.map(t => [
      normalizeFachdienst(t?.fachdienst),
      normalizeBauteil(t?.bauteil),
      t.taetigkeit || '–',
      t.beschreibung || '–',
      t.location || '–',
      t.resStatus || '–',
    ]);
    y = pdfTable(doc,
      [['Fachdienst','Bauteil','Tätigkeit','Beschreibung','Bereich/Ort','Status']],
      body, y, W, { fontSize: 7.5 });
  }

  const personal  = (cell.personal  || []).filter(p => p.name || p.funktion);
  const inventar  = (cell.inventar  || []).filter(i => i.geraet);

  if (personal.length || inventar.length) {
    y = pdfCheckPage(doc, y, 50, proj, subtitle, true);
    const yBefore = y;

    if (personal.length) {
      y = pdfSectionHeading(doc, 'Personal', y, W);
      const body = personal.map(p => [p.funktion||'–', p.name||'–', p.resStatus||'–', p.bemerkung||'–']);
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

// ─── Master PDF export ────────────────────────────────────────────────────────

function exportShiftplanungPDF(mode = 'full') {
  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W    = 297;
  const proj = document.getElementById('sd-projektname')?.value || '';

  let y = pdfHeader(doc, proj, '', true);

  if (mode === 'full' || mode === 'stammdaten') {
    y = buildStammdatenPDFPage(doc, y, W, proj);
  }

  if (mode === 'full' || mode === 'uebersicht') {
    if (!kwList.length) {
      doc.setFontSize(11); doc.setTextColor(...PDF_C.muted);
      doc.text('Keine Kalenderwochen vorhanden.', 12, y + 10);
    } else {
      kwList.forEach(kw => {
        doc.addPage();
        y = pdfHeader(doc, proj, kw.label, true);
        y = buildKWSummaryPage(doc, kw, y, W, proj);
      });
    }
  }

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

function exportUebersichtPDF() {
  exportShiftplanungPDF('uebersicht');
}

function exportAllPDF() {
  exportShiftplanungPDF('full');
}

// Legacy wrapper kept for compatibility
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
