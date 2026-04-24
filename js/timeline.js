// ─── Timeline UI helpers ──────────────────────────────────────────────────────

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
  const body = hdr.nextElementSibling;
  body.classList.toggle('collapsed');
  if (!body.classList.contains('collapsed')) {
    const grp = hdr.closest('.sdp-section')?.dataset?.grp;
    if (grp && sdpTables[grp]) sdpTables[grp].redraw(true);
  }
}

function collapseAllSDPSections() {
  document.querySelectorAll('#shiftDetailPanel .sdp-section-hdr').forEach(hdr => {
    hdr.classList.add('collapsed');
    const body = hdr.nextElementSibling;
    if (body && body.classList.contains('sdp-section-body')) body.classList.add('collapsed');
  });
}

function showOnlySDPSection(grp) {
  document.querySelectorAll('#shiftDetailPanel .sdp-section').forEach(sec => {
    if (sec.dataset.grp === grp) {
      sec.classList.remove('sdp-section-hidden');
      const hdr = sec.querySelector('.sdp-section-hdr');
      const body = sec.querySelector('.sdp-section-body');
      if (hdr) hdr.classList.remove('collapsed');
      if (body) body.classList.remove('collapsed');
      if (sdpTables[grp]) setTimeout(() => sdpTables[grp].redraw(true), 0);
    } else {
      sec.classList.add('sdp-section-hidden');
    }
  });
}

function showAllSDPSections() {
  document.querySelectorAll('#shiftDetailPanel .sdp-section').forEach(sec => {
    sec.classList.remove('sdp-section-hidden');
  });
  collapseAllSDPSections();
}

function updateStats() {
  /* Statistik-Karten entfernt — Platzhalter für bestehende Aufrufe */
}

// ─── Timeline Zoom & Filter ───────────────────────────────────────────────────

function setZoom(zoom) {
  tlZoom = zoom;
  if (zoom !== 'shifts') clearTimelineRangeSelection();
  document.querySelectorAll('.zoom-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.zoom === zoom));
  renderTimeline();
}

function toggleTLFilter(grpId, btn) {
  tlFilter[grpId] = !tlFilter[grpId];
  btn.classList.toggle('active', tlFilter[grpId]);
  renderTimeline();
}

function getTlColWidths() {
  const labelW = 140;
  const dayW = 80;
  return { labelW, dayW };
}

// ─── Timeline HTML builders ───────────────────────────────────────────────────

function buildShiftsHeader(shiftId) {
  const sh = TL_SHIFTS.find(s => s.id === shiftId) || { cls: shiftId === 'T' ? 'sh-t' : 'sh-n' };
  const shiftLabel = shiftId === 'T' ? 'Tag' : 'Nacht';
  let html = '<thead><tr>';
  html += '<th class="tl-label-th" rowspan="2">Ressource</th>';
  kwList.forEach(kw => {
    html += `<th class="tl-kw-th ${sh.cls}" colspan="7">${kw.label} — ${shiftLabel}</th>`;
  });
  html += '</tr><tr>';
  kwList.forEach((kw, ki) => {
    TL_DAYS.forEach((_, dayIdx) => {
      const dayT = tlDayPlain(kw, dayIdx);
      const kwBorder = ki > 0 && dayIdx === 0 ? ' kw-border' : '';
      html += `<th class="tl-slot-th tl-day-th ${sh.cls}${kwBorder}"
        data-kw="${kw.id}" data-day="${dayIdx}" data-shift="${shiftId}"
        title="${kw.label} ${dayT} ${shiftId === 'T' ? 'Tag' : 'Nacht'}">${tlDayThHtml(kw, dayIdx)}</th>`;
    });
  });
  html += '</tr></thead>';
  return html;
}

function buildResRowForShift(g, shiftId) {
  const sh = TL_SHIFTS.find(s => s.id === shiftId) || { cls: shiftId === 'T' ? 'sh-t' : 'sh-n' };
  let html = `<tr class="tl-res-row"><td class="tl-label-td">${g.label}</td>`;
  kwList.forEach((kw, ki) => {
    TL_DAYS.forEach((_, dayIdx) => {
      const items = getSection(kw.id, dayIdx, shiftId, g.section);
      const kwBorder = ki > 0 && dayIdx === 0 ? ' kw-border' : '';
      html += buildCell(kw.id, dayIdx, shiftId, g, items, sh.cls + kwBorder);
    });
  });
  html += '</tr>';
  return html;
}

function toggleTlGroup(groupId) {
  tlCollapsed[groupId] = !tlCollapsed[groupId];
  renderTimeline();
}

function buildTasksRowsForShift(shiftId) {
  const sh = TL_SHIFTS.find(s => s.id === shiftId) || { cls: shiftId === 'T' ? 'sh-t' : 'sh-n' };
  const tasksGroup = { id: 'tasks', label: 'Tätigkeiten', section: 'tasks' };
  const collapsed = !!tlCollapsed['tasks'];
  const toggleIcon = collapsed ? '▶' : '▼';

  // Parent row
  let html = `<tr class="tl-res-row tl-tasks-parent-row">`;
  html += `<td class="tl-label-td tl-tasks-parent">`;
  html += `<button class="tl-toggle-btn" onclick="toggleTlGroup('tasks')">${toggleIcon}</button>`;
  html += `Tätigkeiten</td>`;
  kwList.forEach((kw, ki) => {
    TL_DAYS.forEach((_, dayIdx) => {
      const kwBorder = ki > 0 && dayIdx === 0 ? ' kw-border' : '';
      const attrs = `data-kw="${kw.id}" data-day="${dayIdx}" data-shift="${shiftId}" data-grp="tasks"`;
      if (collapsed) {
        const count = getSection(kw.id, dayIdx, shiftId, 'tasks').length;
        const badge = count > 0 ? `<span class="tl-agg-badge">${count}</span>` : '';
        html += `<td class="tl-cell ${sh.cls}${kwBorder} tl-cell-parent-summary" ${attrs}>${badge}</td>`;
      } else {
        html += `<td class="tl-cell ${sh.cls}${kwBorder} tl-cell-parent-summary" ${attrs}></td>`;
      }
    });
  });
  html += '</tr>';

  if (!collapsed) {
    const fachdienste = getUsedFachdienste();
    fachdienste.forEach(fachdienst => {
      // Level-1: Fachdienst child row
      html += `<tr class="tl-res-row tl-tasks-child-row">`;
      html += `<td class="tl-label-td tl-label-td-child">${escapeHtmlText(fachdienst)}</td>`;
      kwList.forEach((kw, ki) => {
        TL_DAYS.forEach((_, dayIdx) => {
          const kwBorder = ki > 0 && dayIdx === 0 ? ' kw-border' : '';
          html += `<td class="tl-cell ${sh.cls}${kwBorder} tl-cell-parent-summary"
            data-kw="${kw.id}" data-day="${dayIdx}" data-shift="${shiftId}" data-grp="tasks"></td>`;
        });
      });
      html += '</tr>';

      // Level-2: Bauteil grandchild rows
      const bauteile = getBauteileForFachdienstInUse(fachdienst);
      bauteile.forEach(bauteil => {
        html += `<tr class="tl-res-row tl-tasks-grandchild-row">`;
        html += `<td class="tl-label-td tl-label-td-grandchild">${escapeHtmlText(bauteil)}</td>`;
        kwList.forEach((kw, ki) => {
          TL_DAYS.forEach((_, dayIdx) => {
            const items = getTaskItemsByFachdienstBauteil(kw.id, dayIdx, shiftId, fachdienst, bauteil);
            const kwBorder = ki > 0 && dayIdx === 0 ? ' kw-border' : '';
            html += buildCell(kw.id, dayIdx, shiftId, tasksGroup, items, sh.cls + kwBorder);
          });
        });
        html += '</tr>';
      });
    });
  }

  return html;
}

function buildPersonalRowsForShift(shiftId) {
  const sh = TL_SHIFTS.find(s => s.id === shiftId) || { cls: shiftId === 'T' ? 'sh-t' : 'sh-n' };
  const personalGroup = { id: 'personal', label: 'Personal', section: 'personal' };
  const functions = getUsedPersonalFunctions();
  const collapsed = !!tlCollapsed['personal'];
  const toggleIcon = collapsed ? '▶' : '▼';

  let html = `<tr class="tl-res-row tl-personal-parent-row">`;
  html += `<td class="tl-label-td tl-personal-parent">`;
  html += `<button class="tl-toggle-btn" onclick="toggleTlGroup('personal')">${toggleIcon}</button>`;
  html += `Personal</td>`;
  kwList.forEach((kw, ki) => {
    TL_DAYS.forEach((_, dayIdx) => {
      const kwBorder = ki > 0 && dayIdx === 0 ? ' kw-border' : '';
      const attrs = `data-kw="${kw.id}" data-day="${dayIdx}" data-shift="${shiftId}" data-grp="personal"`;
      if (collapsed) {
        const count = getSection(kw.id, dayIdx, shiftId, 'personal').length;
        const badge = count > 0 ? `<span class="tl-agg-badge">${count}</span>` : '';
        html += `<td class="tl-cell ${sh.cls}${kwBorder} tl-cell-parent-summary" ${attrs}>${badge}</td>`;
      } else {
        html += `<td class="tl-cell ${sh.cls}${kwBorder} tl-cell-parent-summary" ${attrs}></td>`;
      }
    });
  });
  html += '</tr>';

  if (!collapsed) {
    functions.forEach(funktion => {
      html += `<tr class="tl-res-row tl-personal-child-row"><td class="tl-label-td tl-label-td-child">${escapeHtmlText(funktion)}</td>`;
      kwList.forEach((kw, ki) => {
        TL_DAYS.forEach((_, dayIdx) => {
          const items = getPersonalItemsByFunction(kw.id, dayIdx, shiftId, funktion);
          const kwBorder = ki > 0 && dayIdx === 0 ? ' kw-border' : '';
          html += buildCell(kw.id, dayIdx, shiftId, personalGroup, items, sh.cls + kwBorder);
        });
      });
      html += '</tr>';
    });
  }

  return html;
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

function calcColCount() {
  if (tlZoom === 'weeks') return kwList.length;
  if (tlZoom === 'days')  return kwList.length * 7;
  return kwList.length * 14;
}

// ─── Render Timeline ──────────────────────────────────────────────────────────

function renderTimeline() {
  const wrapper = document.getElementById('timelineWrapper');
  if (!wrapper) return;

  if (!kwList.length) {
    wrapper.innerHTML = '<div class="tl-empty">Noch keine Kalenderwochen vorhanden. Bitte "+ KW hinzufügen" verwenden.</div>';
    return;
  }

  const zoom = tlZoom;

  if (zoom === 'shifts') {
    const { labelW, dayW } = getTlColWidths();
    const colCount = kwList.length * 7;
    let colgroup = '<colgroup><col style="width:' + labelW + 'px">';
    for (let i = 0; i < colCount; i++) colgroup += '<col style="width:' + dayW + 'px">';
    colgroup += '</colgroup>';

    let html = '<div class="tl-dual-grid">';

    // Day (Tag) grid
    html += '<div class="tl-grid-day"><div class="tl-cat-stack">';
    html += '<div class="tl-timeline-card tl-timeline-header-card">';
    html += '<table class="tl-table tl-table-day tl-header-table" style="table-layout:fixed">' + colgroup + buildShiftsHeader('T') + '</table>';
    html += '</div>';
    TL_GROUPS.forEach(g => {
      if (!tlFilter[g.id]) return;
      let rows = '';
      if (g.id === 'personal') rows = buildPersonalRowsForShift('T');
      else if (g.id === 'tasks') rows = buildTasksRowsForShift('T');
      else rows = buildResRowForShift(g, 'T');

      html += '<div class="tl-timeline-card tl-category-card">';
      html += '<table class="tl-table tl-table-day tl-cat-table" style="table-layout:fixed">' + colgroup + '<tbody>' + rows + '</tbody></table>';
      html += '</div>';
    });
    html += '</div></div>';

    // Night (Nacht) grid
    html += '<div class="tl-grid-night"><div class="tl-cat-stack">';
    html += '<div class="tl-timeline-card tl-timeline-header-card">';
    html += '<table class="tl-table tl-table-night tl-header-table" style="table-layout:fixed">' + colgroup + buildShiftsHeader('N') + '</table>';
    html += '</div>';
    TL_GROUPS.forEach(g => {
      if (!tlFilter[g.id]) return;
      let rows = '';
      if (g.id === 'personal') rows = buildPersonalRowsForShift('N');
      else if (g.id === 'tasks') rows = buildTasksRowsForShift('N');
      else rows = buildResRowForShift(g, 'N');

      html += '<div class="tl-timeline-card tl-category-card">';
      html += '<table class="tl-table tl-table-night tl-cat-table" style="table-layout:fixed">' + colgroup + '<tbody>' + rows + '</tbody></table>';
      html += '</div>';
    });
    html += '</div></div></div>';

    wrapper.innerHTML = html;
  } else {
    let html = '<table class="tl-table"><thead>';

    if (zoom === 'days') {
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
  }

  // Drill-down on slot headers
  wrapper.querySelectorAll('.tl-slot-th.drill').forEach(th => {
    th.addEventListener('click', () => {
      if (zoom === 'weeks') setZoom('days');
      else if (zoom === 'days') setZoom('shifts');
    });
  });

  // Day header click → open SDP for whole shift
  wrapper.querySelectorAll('.tl-slot-th.tl-day-th[data-shift]').forEach(th => {
    th.addEventListener('click', () => {
      openSDP(th.dataset.kw, parseInt(th.dataset.day), th.dataset.shift, null);
    });
  });

  // Cell click → open SDP for single resource
  wrapper.querySelectorAll('.tl-cell[data-shift]').forEach(td => {
    td.addEventListener('click', (event) => {
      const coords = tlCellCoordsFromElement(td);
      if (event.shiftKey && tlRangeAnchor && coords && setTimelineRangeSelection(tlRangeAnchor, coords)) {
        timelineShiftFocus = { kwId: coords.kwId, dayIdx: coords.dayIdx, shift: coords.shift, grp: coords.grp || undefined };
        applyTimelineRangeSelectionHighlight();
        showToast('Bereich markiert');
        return;
      }
      if (coords) tlRangeAnchor = coords;
      clearTimelineRangeSelection();
      applyTimelineRangeSelectionHighlight();
      openSDP(td.dataset.kw, parseInt(td.dataset.day), td.dataset.shift, td.dataset.grp || null);
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
    if (selectedCell.grp) {
      wrapper.querySelectorAll(
        `.tl-cell[data-kw="${selectedCell.kwId}"][data-day="${selectedCell.dayIdx}"][data-shift="${selectedCell.shift}"][data-grp="${selectedCell.grp}"]`
      ).forEach(td => td.classList.add('selected'));
    } else {
      wrapper.querySelectorAll(
        `.tl-cell[data-kw="${selectedCell.kwId}"][data-day="${selectedCell.dayIdx}"][data-shift="${selectedCell.shift}"]`
      ).forEach(td => td.classList.add('selected'));
    }
  }
  applyTimelineRangeSelectionHighlight();
}
