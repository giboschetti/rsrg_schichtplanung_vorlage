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

// ─── Timeline Filter ──────────────────────────────────────────────────────────

function toggleTLFilter(grpId, btn) {
  tlFilter[grpId] = !tlFilter[grpId];
  btn.classList.toggle('active', tlFilter[grpId]);
  renderTimeline();
}

// ─── Timeline HTML builders ───────────────────────────────────────────────────

function toggleTlGroup(groupId) {
  tlCollapsed[groupId] = !tlCollapsed[groupId];
  renderTimeline();
}

function buildSimpleRow(g) {
  let html = `<tr class="tl-res-row"><td class="tl-label-td">${g.label}</td>`;
  kwList.forEach((kw, ki) => {
    TL_DAYS.forEach((_, dayIdx) => {
      const kwBorder = ki > 0 && dayIdx === 0 ? ' kw-border' : '';
      const dayBorder = dayIdx > 0 && !kwBorder ? ' day-border' : '';
      TL_SHIFTS.forEach((sh, si) => {
        const items = getSection(kw.id, dayIdx, sh.id, g.section);
        const borderCls = si === 0 ? (kwBorder || dayBorder) : '';
        html += buildCell(kw.id, dayIdx, sh.id, g, items, sh.cls + borderCls);
      });
    });
  });
  html += '</tr>';
  return html;
}

function buildTasksRows() {
  const tasksGroup = { id: 'tasks', label: 'Tätigkeiten', section: 'tasks' };
  const collapsed = !!tlCollapsed['tasks'];
  const icon = collapsed ? '▶' : '▼';

  let html = `<tr class="tl-res-row tl-tasks-parent-row">`;
  html += `<td class="tl-label-td tl-collapsible-label" onclick="toggleTlGroup('tasks')"><span class="tl-toggle-icon">${icon}</span>Tätigkeiten</td>`;
  kwList.forEach((kw, ki) => {
    TL_DAYS.forEach((_, dayIdx) => {
      const kwBorder = ki > 0 && dayIdx === 0 ? ' kw-border' : '';
      const dayBorder = dayIdx > 0 && !kwBorder ? ' day-border' : '';
      TL_SHIFTS.forEach((sh, si) => {
        const borderCls = si === 0 ? (kwBorder || dayBorder) : '';
        const attrs = `data-kw="${kw.id}" data-day="${dayIdx}" data-shift="${sh.id}" data-grp="tasks"`;
        if (collapsed) {
          const count = getSection(kw.id, dayIdx, sh.id, 'tasks').length;
          const badge = count > 0 ? `<span class="tl-agg-badge">${count}</span>` : '';
          html += `<td class="tl-cell ${sh.cls}${borderCls} tl-cell-parent-summary" ${attrs}>${badge}</td>`;
        } else {
          html += `<td class="tl-cell ${sh.cls}${borderCls} tl-cell-parent-summary" ${attrs}></td>`;
        }
      });
    });
  });
  html += '</tr>';

  if (!collapsed) {
    getUsedFachdienste().forEach(fachdienst => {
      html += `<tr class="tl-res-row tl-tasks-child-row">`;
      html += `<td class="tl-label-td tl-label-td-child">${escapeHtmlText(fachdienst)}</td>`;
      kwList.forEach((kw, ki) => {
        TL_DAYS.forEach((_, dayIdx) => {
          const kwBorder = ki > 0 && dayIdx === 0 ? ' kw-border' : '';
          const dayBorder = dayIdx > 0 && !kwBorder ? ' day-border' : '';
          TL_SHIFTS.forEach((sh, si) => {
            const borderCls = si === 0 ? (kwBorder || dayBorder) : '';
            html += `<td class="tl-cell ${sh.cls}${borderCls} tl-cell-parent-summary"
              data-kw="${kw.id}" data-day="${dayIdx}" data-shift="${sh.id}" data-grp="tasks"></td>`;
          });
        });
      });
      html += '</tr>';

      getBauteileForFachdienstInUse(fachdienst).forEach(bauteil => {
        html += `<tr class="tl-res-row tl-tasks-grandchild-row">`;
        html += `<td class="tl-label-td tl-label-td-grandchild">${escapeHtmlText(bauteil)}</td>`;
        kwList.forEach((kw, ki) => {
          TL_DAYS.forEach((_, dayIdx) => {
            const kwBorder = ki > 0 && dayIdx === 0 ? ' kw-border' : '';
            const dayBorder = dayIdx > 0 && !kwBorder ? ' day-border' : '';
            TL_SHIFTS.forEach((sh, si) => {
              const items = getTaskItemsByFachdienstBauteil(kw.id, dayIdx, sh.id, fachdienst, bauteil);
              const borderCls = si === 0 ? (kwBorder || dayBorder) : '';
              html += buildCell(kw.id, dayIdx, sh.id, tasksGroup, items, sh.cls + borderCls);
            });
          });
        });
        html += '</tr>';
      });
    });
  }

  return html;
}

function buildPersonalRows() {
  const personalGroup = { id: 'personal', label: 'Personal', section: 'personal' };
  const collapsed = !!tlCollapsed['personal'];
  const icon = collapsed ? '▶' : '▼';

  let html = `<tr class="tl-res-row tl-personal-parent-row">`;
  html += `<td class="tl-label-td tl-collapsible-label" onclick="toggleTlGroup('personal')"><span class="tl-toggle-icon">${icon}</span>Personal</td>`;
  kwList.forEach((kw, ki) => {
    TL_DAYS.forEach((_, dayIdx) => {
      const kwBorder = ki > 0 && dayIdx === 0 ? ' kw-border' : '';
      const dayBorder = dayIdx > 0 && !kwBorder ? ' day-border' : '';
      TL_SHIFTS.forEach((sh, si) => {
        const borderCls = si === 0 ? (kwBorder || dayBorder) : '';
        const attrs = `data-kw="${kw.id}" data-day="${dayIdx}" data-shift="${sh.id}" data-grp="personal"`;
        if (collapsed) {
          const count = getSection(kw.id, dayIdx, sh.id, 'personal').length;
          const badge = count > 0 ? `<span class="tl-agg-badge">${count}</span>` : '';
          html += `<td class="tl-cell ${sh.cls}${borderCls} tl-cell-parent-summary" ${attrs}>${badge}</td>`;
        } else {
          html += `<td class="tl-cell ${sh.cls}${borderCls} tl-cell-parent-summary" ${attrs}></td>`;
        }
      });
    });
  });
  html += '</tr>';

  if (!collapsed) {
    getUsedPersonalFunctions().forEach(funktion => {
      html += `<tr class="tl-res-row tl-personal-child-row">`;
      html += `<td class="tl-label-td tl-label-td-child">${escapeHtmlText(funktion)}</td>`;
      kwList.forEach((kw, ki) => {
        TL_DAYS.forEach((_, dayIdx) => {
          const kwBorder = ki > 0 && dayIdx === 0 ? ' kw-border' : '';
          const dayBorder = dayIdx > 0 && !kwBorder ? ' day-border' : '';
          TL_SHIFTS.forEach((sh, si) => {
            const items = getPersonalItemsByFunction(kw.id, dayIdx, sh.id, funktion);
            const borderCls = si === 0 ? (kwBorder || dayBorder) : '';
            html += buildCell(kw.id, dayIdx, sh.id, personalGroup, items, sh.cls + borderCls);
          });
        });
      });
      html += '</tr>';
    });
  }

  return html;
}

function buildCell(kwId, dayIdx, shift, g, items, extraCls) {
  const attrs = `data-kw="${kwId}" data-day="${dayIdx ?? ''}" data-shift="${shift ?? ''}" data-grp="${g.id}"`;
  const blocks = items.slice(0, 3).map(it => {
    const label = getItemLabel(it, g.section).substring(0, 14);
    const bcls = tlBlockClassFromResStatus(it, g.section);
    const tip = tlBlockTitle(it, g.section) || label;
    return `<span class="tl-block ${bcls}" title="${escAttr(tip)}">${label}</span>`;
  }).join('');
  const more = items.length > 3 ? `<span class="tl-more">+${items.length - 3}</span>` : '';
  return `<td class="tl-cell ${extraCls}" ${attrs}>${blocks}${more}</td>`;
}

// ─── Render Timeline ──────────────────────────────────────────────────────────

function renderTimeline() {
  const wrapper = document.getElementById('timelineWrapper');
  if (!wrapper) return;

  if (!kwList.length) {
    wrapper.innerHTML = '<div class="tl-empty">Noch keine Kalenderwochen vorhanden. Bitte "+ KW hinzufügen" verwenden.</div>';
    return;
  }

  const labelW = 140;
  const shiftW = 80;
  const totalShiftCols = kwList.length * 14;

  let colgroup = `<colgroup><col style="width:${labelW}px">`;
  for (let i = 0; i < totalShiftCols; i++) colgroup += `<col style="width:${shiftW}px">`;
  colgroup += '</colgroup>';

  // 3-row thead
  let thead = '<thead>';

  // Row 1: label (rowspan=3) + KW banners (colspan=14)
  thead += '<tr><th class="tl-label-th" rowspan="3">Ressource</th>';
  kwList.forEach((kw, ki) => {
    const kwBorderCls = ki > 0 ? ' kw-border' : '';
    thead += `<th class="tl-kw-th${kwBorderCls}" colspan="14">${kw.label}</th>`;
  });
  thead += '</tr>';

  // Row 2: day headers (colspan=2)
  thead += '<tr>';
  kwList.forEach((kw, ki) => {
    TL_DAYS.forEach((_, dayIdx) => {
      const kwBorderCls = ki > 0 && dayIdx === 0 ? ' kw-border' : '';
      const dayBorderCls = dayIdx > 0 && !kwBorderCls ? ' day-border' : '';
      thead += `<th class="tl-slot-th tl-day-th${kwBorderCls}${dayBorderCls}" colspan="2"
        data-kw="${kw.id}" data-day="${dayIdx}">${tlDayThHtml(kw, dayIdx)}</th>`;
    });
  });
  thead += '</tr>';

  // Row 3: T/N shift headers
  thead += '<tr>';
  kwList.forEach((kw, ki) => {
    TL_DAYS.forEach((_, dayIdx) => {
      const kwBorderCls = ki > 0 && dayIdx === 0 ? ' kw-border' : '';
      const dayBorderCls = dayIdx > 0 && !kwBorderCls ? ' day-border' : '';
      TL_SHIFTS.forEach((sh, si) => {
        const borderCls = si === 0 ? (kwBorderCls || dayBorderCls) : '';
        thead += `<th class="tl-slot-th tl-sh-th ${sh.cls}${borderCls}"
          data-kw="${kw.id}" data-day="${dayIdx}" data-shift="${sh.id}">${sh.label}</th>`;
      });
    });
  });
  thead += '</tr></thead>';

  // tbody
  let tbody = '<tbody>';
  TL_GROUPS.forEach(g => {
    if (!tlFilter[g.id]) return;
    if (g.id === 'tasks') tbody += buildTasksRows();
    else if (g.id === 'personal') tbody += buildPersonalRows();
    else tbody += buildSimpleRow(g);
  });
  tbody += '</tbody>';

  wrapper.innerHTML = `<div class="tl-unified-wrap"><table class="tl-table tl-unified" style="table-layout:fixed">${colgroup}${thead}${tbody}</table></div>`;

  // Day header click → open SDP (Tag shift)
  wrapper.querySelectorAll('.tl-day-th[data-kw]').forEach(th => {
    th.addEventListener('click', () => {
      openSDP(th.dataset.kw, parseInt(th.dataset.day), 'T', null);
    });
  });

  // Shift header click → open SDP
  wrapper.querySelectorAll('.tl-sh-th[data-shift]').forEach(th => {
    th.addEventListener('click', () => {
      openSDP(th.dataset.kw, parseInt(th.dataset.day), th.dataset.shift, null);
    });
  });

  // Cell click → open SDP or range select
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

  // Re-apply selected highlight
  if (selectedCell) {
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
