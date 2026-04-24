// ─── Constants ─────────────────────────────────────────────────────────────

export const FACHDIENST_VALUES = ['FB', 'IB/TB', 'FL', 'SAZ', 'KAB', 'Andere'] as const;
export type Fachdienst = (typeof FACHDIENST_VALUES)[number];

export const SDP_FUNKTION_VALUES = [
  'Bauleiter', 'Stellv. Bauleiter', 'Polier', 'Vorarbeiter',
  'Facharbeiter', 'Hilfsarbeiter', 'Sicherheitsbeauftragter',
  'Sicherungsposten', 'Signalmann', 'Kranführer', 'Andere',
] as const;
export type PersonalFunktion = (typeof SDP_FUNKTION_VALUES)[number] | string;

export const SDP_RES_STATUS_VALUES = ['Planung', 'Bestellt', 'Bestätigt'] as const;
export type ResStatus = (typeof SDP_RES_STATUS_VALUES)[number] | '';

export const SDP_INTERVALLE_STATUS_VALUES = [
  'Entwurf', 'Änderung', 'Verständigt', 'Zusätzlicher Bedarf',
] as const;
export type IntervalleStatus = (typeof SDP_INTERVALLE_STATUS_VALUES)[number] | '';

export const SDP_SECTIONS = [
  'intervalle', 'tasks', 'personal', 'inventar', 'material', 'fremdleistung',
] as const;
export type SdpSection = (typeof SDP_SECTIONS)[number];

export const SHIFT_CLIP_SECTIONS = SDP_SECTIONS;

export const TL_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
export type TlDay = (typeof TL_DAYS)[number];

export const TL_SHIFTS = [
  { id: 'T', label: 'T', cls: 'tl-shift-t' },
  { id: 'N', label: 'N', cls: 'tl-shift-n' },
] as const;
export type ShiftId = 'T' | 'N';

export const MATERIAL_EINHEIT_VALUES = ['m', 'm²', 'm³', 'kg', 't', 'Stk', 'Psch', 'h', 'l', 'lfm'] as const;

// ─── Work item row types ────────────────────────────────────────────────────

export interface TaskItem {
  id: string;
  fachdienst?: string;
  bauteil?: string;
  taetigkeit?: string;
  beschreibung?: string;
  location?: string;
  resStatus?: ResStatus;
  notes?: string;
}

export interface PersonalItem {
  id: string;
  funktion?: string;
  name?: string;
  resStatus?: ResStatus;
  bemerkung?: string;
}

export interface InventarItem {
  id: string;
  geraet?: string;
  anzahl?: number;
  resStatus?: ResStatus;
  bemerkung?: string;
}

export interface MaterialItem {
  id: string;
  material?: string;
  menge?: number;
  einheit?: string;
  resStatus?: ResStatus;
  bemerkung?: string;
}

export interface FremdleistungItem {
  id: string;
  firma?: string;
  leistung?: string;
  resStatus?: ResStatus;
  bemerkung?: string;
}

export interface IntervalleItem {
  id: string;
  babNr?: string;
  babDatei?: string;
  babTitel?: string;
  status?: IntervalleStatus;
  gleissperrungen?: string;
  fahrleitungsausschaltungen?: string;
  vonDatum?: string;
  vonZeit?: string;
  bisDatum?: string;
  bisZeit?: string;
}

export interface ShiftData {
  intervalle: IntervalleItem[];
  tasks: TaskItem[];
  personal: PersonalItem[];
  inventar: InventarItem[];
  material: MaterialItem[];
  fremdleistung: FremdleistungItem[];
}

/** Key format: `${kwId}__${dayIdx}__${shiftId}` */
export type WorkItemKey = string;

export type WorkItems = Record<WorkItemKey, Partial<ShiftData>>;

// ─── Stammdaten ─────────────────────────────────────────────────────────────

/** Map of fachdienst → list of user-defined Bauteil strings */
export type FachdienstBauteile = Record<string, string[]>;

export interface ShiftConfig {
  tag: { von: string; bis: string };
  nacht: { von: string; bis: string };
}

/** Kontaktliste / Projektteam (legacy Tabulator: tables.mitarbeiter) */
export interface MitarbeiterRow {
  id: string;
  name?: string;
  vorname?: string;
  funktion?: string;
  firma?: string;
  tel?: string;
  email?: string;
  bemerkung?: string;
}

export const MITARBEITER_FUNKTION_OPTIONS = [
  'Baugruppe', 'Sicherheit', 'Maschinist', 'Polier', 'Bauleiter', 'Fremdfirma', 'Andere',
] as const;

// ─── Calendar week ──────────────────────────────────────────────────────────

export interface KalenderWoche {
  id: string;
  label: string;
  year: number;
  num: number;
  dateFrom?: string; // ISO YYYY-MM-DD (Monday)
  dateTo?: string;   // ISO YYYY-MM-DD (Sunday)
}

// ─── Project (Firestore document) ──────────────────────────────────────────

export interface ProjectStammdaten {
  fachdienstBauteile: FachdienstBauteile;
  shiftConfig: ShiftConfig;
  fachdienste?: string[];
  /** Projekt- & Baustellenfelder (legacy: inputs in stammdaten) */
  projektname?: string;
  projektnummer?: string;
  auftraggeber?: string;
  bauleiter?: string;
  polier?: string;
  standort?: string;
  baubeginn?: string;
  bauende?: string;
}

/** Nur die freien Textfelder (für Store / Formular) */
export type ProjectStamFormFields = Pick<
  ProjectStammdaten,
  'projektname' | 'projektnummer' | 'auftraggeber' | 'bauleiter' | 'polier' | 'standort' | 'baubeginn' | 'bauende'
>;

export const EMPTY_PROJECT_STAM_FORM: Readonly<ProjectStamFormFields> = {
  projektname: '',
  projektnummer: '',
  auftraggeber: '',
  bauleiter: '',
  polier: '',
  standort: '',
  baubeginn: '',
  bauende: '',
};

export interface ProjectSnapshot {
  kwList: KalenderWoche[];
  workItems: WorkItems;
  stammdaten: ProjectStammdaten;
  /** Projektkontakte — auch als Firestore-Top-Level `stammdaten.personal` (Import) */
  mitarbeiter?: MitarbeiterRow[];
}

export interface Project {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string; // ISO timestamp
  snapshot?: ProjectSnapshot;
}

// ─── Timeline group config ──────────────────────────────────────────────────

export interface TlGroup {
  id: SdpSection;
  label: string;
  section: SdpSection;
}

export const TL_GROUPS: TlGroup[] = [
  { id: 'intervalle',    label: 'Intervalle',    section: 'intervalle' },
  { id: 'tasks',        label: 'Tätigkeiten',   section: 'tasks' },
  { id: 'personal',     label: 'Personal',      section: 'personal' },
  { id: 'inventar',     label: 'Inventar',      section: 'inventar' },
  { id: 'material',     label: 'Material',      section: 'material' },
  { id: 'fremdleistung',label: 'Fremdleistung', section: 'fremdleistung' },
];
