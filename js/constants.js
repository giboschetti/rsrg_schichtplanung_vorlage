// ─── Constants ──────────────────────────────────────────────────────────────

const SCHICHTEN = ['Tag', 'Nacht', 'Früh', 'Spät', 'Bereitschaft'];
const EINHEITEN = ['m', 'm²', 'm³', 'kg', 't', 'Stk', 'Psch', 'h', 'l', 'lfm'];
const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const TL_DAYS   = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const TL_MONTH_DE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const TL_SHIFTS = [{ id: 'T', label: 'Tag', cls: 'sh-t' }, { id: 'N', label: 'Nacht', cls: 'sh-n' }];

const FACHDIENST_VALUES = ['FB', 'IB/TB', 'FL', 'SAZ', 'KAB', 'Andere'];

// Each group maps to a section key in workItems cell
const TL_GROUPS = [
  { id: 'tasks',         label: 'Tätigkeiten',  section: 'tasks' },
  { id: 'personal',      label: 'Personal',        section: 'personal' },
  { id: 'inventar',      label: 'Inventar',        section: 'inventar' },
  { id: 'material',      label: 'Material',        section: 'material' },
  { id: 'fremdleistung', label: 'Fremdleistung',   section: 'fremdleistung' },
  { id: 'intervalle',    label: 'Intervalle',      section: 'intervalle' },
];

const SHIFT_CLIP_SECTIONS = ['tasks', 'personal', 'inventar', 'material', 'fremdleistung', 'intervalle'];

const SDP_RES_STATUS_VALUES = ['Planung', 'Bestellt', 'Bestätigt'];
const SDP_FUNKTION_VALUES = ['Baugruppe','Sicherheit','Maschinist','Polier','Bauleiter','Fremdfirma'];
const SDP_INTERVALLE_STATUS_VALUES = ['Entwurf', 'Änderung', 'Verständigt', 'Zusätzlicher Bedarf'];
const SDP_SECTIONS = ['tasks', 'personal', 'inventar', 'material', 'fremdleistung', 'intervalle'];

// ─── PDF Design System Colours (RGB) ─────────────────────────────────────────
const PDF_C = {
  dark:    [28,  28,  30 ],
  orange:  [255, 99,  0  ],
  white:   [255, 255, 255],
  offwht:  [242, 239, 232],
  bg:      [245, 242, 236],
  surface: [255, 255, 255],
  tblhdr:  [42,  42,  44 ],
  altrow:  [247, 244, 238],
  border:  [217, 211, 200],
  text:    [44,  40,  37 ],
  muted:   [107, 101, 96 ],
  grphdr:  [235, 232, 225],
  green:   [22,  163, 74 ],
  blue:    [37,  99,  235],
  red:     [220, 0,   46 ],
};
