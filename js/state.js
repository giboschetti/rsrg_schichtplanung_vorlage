// ─── State ──────────────────────────────────────────────────────────────────

const tables = {};
const kwList = []; // [{id, label, num, year, dateFrom, dateTo}]

// workItems[key] = {
//   tasks:         [{id, fachdienst, bauteil, taetigkeit, beschreibung, location, resStatus, notes}]
//   personal:      [{id, name, funktion, resStatus, bemerkung}]
//   inventar:      [{id, geraet, anzahl, resStatus, bemerkung}]
//   material:      [{id, material, menge, einheit, resStatus, bemerkung}]
//   fremdleistung: [{id, firma, leistung, resStatus, bemerkung}]
//   intervalle:    [{id, babNr, babDatei, babTitel, status, gleissperrungen, fahrleitungsausschaltungen, vonDatum, vonZeit, bisDatum, bisZeit}]
// }
const workItems = {};

const tlFilter = { tasks: true, personal: true, inventar: true, material: true, fremdleistung: true, intervalle: true };
const tlCollapsed = {};
let selectedCell = null; // { kwId, dayIdx, shift }
let timelineShiftFocus = null;
let shiftClipboardInternal = null;
let tlRangeAnchor = null;
let tlRangeSelection = null;
let sdpRowClipboardInternal = null;
let lastClipboardInternal = null;
const sdpTables = {};

let shiftConfig = { tag: { von: '07:00', bis: '19:00' }, nacht: { von: '19:00', bis: '07:00' } };
let fachdienstBauteile = {};
