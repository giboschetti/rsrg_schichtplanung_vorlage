import type {
  IntervalleItem,
  KalenderWoche,
  MitarbeiterRow,
  ProjectSnapshot,
  ProjectStammdaten,
  ShiftConfig,
  ShiftData,
  TaskItem,
  WorkItems,
} from '@/types';
import { migrateTaskItem } from '@/lib/workItemHelpers';

/** Legacy vanilla app used `kwId||dayIdx||shift` — React uses `__` (plannerStore wiKey). */
const LEGACY_KEY_SEP = '||';
const REACT_KEY_SEP = '__';

const DEFAULT_SHIFT: ShiftConfig = {
  tag: { von: '07:00', bis: '19:00' },
  nacht: { von: '19:00', bis: '07:00' },
};

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

function buildStammdaten(
  fach: ProjectStammdaten['fachdienstBauteile'],
  shift: ShiftConfig,
  extra: Record<string, unknown> | undefined,
): ProjectStammdaten {
  return {
    fachdienstBauteile: fach,
    shiftConfig: shift,
    projektname: str(extra?.projektname),
    projektnummer: str(extra?.projektnummer),
    auftraggeber: str(extra?.auftraggeber),
    bauleiter: str(extra?.bauleiter),
    polier: str(extra?.polier),
    standort: str(extra?.standort),
    baubeginn: str(extra?.baubeginn),
    bauende: str(extra?.bauende),
  };
}

function newRowId(): string {
  return `m_${Math.random().toString(36).slice(2)}`;
}

function intRowId(): string {
  return `int_${Math.random().toString(36).slice(2)}`;
}

/** Some Firestore / import rows use `BAB Titel`, `bab_titel`, etc. — we read them into canonical camelCase. */
function firstNonEmptyField(obj: Record<string, unknown>, explicitKeys: string[], fuzzy: string): string | undefined {
  for (const k of explicitKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      const v = obj[k];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'id' || v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    const kn = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (kn === fuzzy) return s;
  }
  return undefined;
}

/** Normalize a single Intervall row from any sensible key shape (Excel / hand-edited JSON). */
export function normalizeIntervalleItem(raw: Record<string, unknown>): IntervalleItem {
  const id = typeof raw.id === 'string' && raw.id ? raw.id : intRowId();
  return {
    id,
    babNr: firstNonEmptyField(raw, ['babNr', 'bab_nr', 'BABNr', 'BAB_Nr', 'BAB-Nr', 'BABN'], 'babnr'),
    babDatei: firstNonEmptyField(raw, ['babDatei', 'bab_datei', 'BABDatei', 'BAB-Datei'], 'babdatei'),
    babTitel: firstNonEmptyField(raw, [
      'babTitel',
      'bab_titel',
      'BABTitel',
      'BAB Titel',
      'BAB_Titel',
      'BabTitel',
      'Babtitel',
      'titel', // some feeds only have generic “titel”
      'title',
      'Titel',
    ], 'babtitel'),
    status: firstNonEmptyField(
      raw,
      ['status', 'Status', 'BABStatus', 'BAB_Status'],
      'status',
    ) as IntervalleItem['status'] | undefined,
    gleissperrungen: firstNonEmptyField(raw, ['gleissperrungen', 'Gleissperrungen', 'Gleis_Sperrungen'], 'gleissperrungen'),
    fahrleitungsausschaltungen: firstNonEmptyField(raw, [
      'fahrleitungsausschaltungen',
      'Fahrleitungsausschaltungen',
      'Fahrleitungsschaltungen',
    ], 'fahrleitungsausschaltungen'),
    vonDatum: firstNonEmptyField(raw, ['vonDatum', 'von_datum', 'VonDatum', 'von', 'Von_Datum'], 'vondatum'),
    vonZeit: firstNonEmptyField(raw, ['vonZeit', 'von_zeit', 'VonZeit', 'Von'], 'vonzeit'),
    bisDatum: firstNonEmptyField(raw, ['bisDatum', 'bis_datum', 'BisDatum', 'bis', 'Bis_Datum'], 'bisdatum'),
    bisZeit: firstNonEmptyField(raw, ['bisZeit', 'bis_zeit', 'BisZeit', 'Bis'], 'biszeit'),
  };
}

const INT_MERGE_KEYS: (keyof IntervalleItem)[] = [
  'babNr',
  'babTitel',
  'babDatei',
  'status',
  'gleissperrungen',
  'fahrleitungsausschaltungen',
  'vonDatum',
  'vonZeit',
  'bisDatum',
  'bisZeit',
];

function mergeIntervalleRows(legacy: IntervalleItem[], v2: IntervalleItem[]): IntervalleItem[] {
  const byId = new Map(legacy.map((r) => [r.id, r]));
  return v2.map((row) => {
    const o = byId.get(row.id);
    if (!o) return row;
    const p: IntervalleItem = { ...row };
    for (const f of INT_MERGE_KEYS) {
      const a = p[f];
      const emptyA = a == null || (typeof a === 'string' && a.trim() === '');
      const b = o[f];
      if (emptyA && b != null && (typeof b !== 'string' || b.trim() !== '')) {
        (p as unknown as Record<string, unknown>)[f] = b as string;
      }
    }
    return p;
  });
}

function normalizeMitarbeiterList(raw: unknown): MitarbeiterRow[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((r) => ({
    id: typeof r.id === 'string' && r.id ? r.id : newRowId(),
    name: str(r.name),
    vorname: str(r.vorname),
    funktion: str(r.funktion),
    firma: str(r.firma),
    tel: str(r.tel),
    email: str(r.email),
    bemerkung: str(r.bemerkung),
  }));
}

const SHIFT_SECTIONS: (keyof ShiftData)[] = [
  'intervalle',
  'tasks',
  'personal',
  'inventar',
  'material',
  'fremdleistung',
];

/** `kw_2025_30__6__N` and `kw_2025_30__06__N` or `n` / `N` must resolve to the same key as the grid. */
export function canonicalizeWorkItemKey(key: string): string {
  if (!key.includes(REACT_KEY_SEP) && !key.includes(LEGACY_KEY_SEP)) return key;
  const normalized = key.includes(LEGACY_KEY_SEP) && !key.includes(REACT_KEY_SEP)
    ? (() => {
        const p = key.split(LEGACY_KEY_SEP);
        return p.length === 3 ? `${p[0]}${REACT_KEY_SEP}${p[1]}${REACT_KEY_SEP}${p[2]}` : key;
      })()
    : key;
  const parts = normalized.split('__');
  if (parts.length < 3) return normalized;
  const shiftRaw = parts.pop() as string;
  const dayRaw = parts.pop() as string;
  const kwId = parts.join('__');
  const d = parseInt(String(dayRaw), 10);
  if (!Number.isFinite(d) || d < 0 || d > 6) return normalized;
  let sh = String(shiftRaw).trim();
  if (sh.toLowerCase() === 'nacht' || sh.toLowerCase() === 'night') sh = 'N';
  else if (sh.toLowerCase() === 'tag' || sh.toLowerCase() === 'day') sh = 'T';
  else sh = sh.toUpperCase();
  if (sh !== 'T' && sh !== 'N') return normalized;
  return `${kwId}__${String(d)}__${sh}`;
}

/** Firestore / imports sometimes store a section as a map or empty object. */
function coerceSectionArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const vals = Object.values(o);
    if (vals.length > 0 && typeof vals[0] === 'object') return vals as T[];
  }
  return [];
}

function hasOwnSection(val: unknown, section: keyof ShiftData): boolean {
  return !!val
    && typeof val === 'object'
    && !Array.isArray(val)
    && Object.prototype.hasOwnProperty.call(val, section);
}

function normalizeOneCell(val: unknown): Partial<ShiftData> {
  if (!val || typeof val !== 'object') return {};
  const c = val as Record<string, unknown>;
  const out: Partial<ShiftData> = {};
  for (const s of SHIFT_SECTIONS) {
    if (!hasOwnSection(c, s)) continue;
    if (s === 'intervalle') {
      const rawList = coerceSectionArray<Record<string, unknown>>(c[s] as unknown);
      out[s] = rawList.map((r) => normalizeIntervalleItem(r)) as ShiftData[typeof s];
    } else if (s === 'tasks') {
      const rawList = coerceSectionArray<Record<string, unknown>>(c[s] as unknown);
      out[s] = rawList.map((r) => migrateTaskItem(r)) as ShiftData[typeof s];
    } else {
      out[s] = coerceSectionArray(c[s] as unknown) as ShiftData[typeof s];
    }
  }
  return out;
}

/**
 * Merge legacy + v2 raw task rows by `id`: v2 fields win, legacy fills missing keys
 * (e.g. `bauphaseBauteil` only on `plannerData` while `snapshot` has empty `bauteil`).
 */
function mergeTaskRowsRaw(
  legacyRaw: Record<string, unknown>[],
  v2Raw: Record<string, unknown>[],
): TaskItem[] {
  const legById = new Map<string, Record<string, unknown>>();
  for (const row of legacyRaw) {
    const id = typeof row.id === 'string' && row.id ? row.id : '';
    if (id) legById.set(id, row);
  }
  const seen = new Set<string>();
  const out: TaskItem[] = [];
  for (const row of v2Raw) {
    const id = typeof row.id === 'string' && row.id ? row.id : '';
    if (id) seen.add(id);
    const lo = id ? legById.get(id) : undefined;
    const mergedRaw = lo ? ({ ...lo, ...row } as Record<string, unknown>) : row;
    out.push(migrateTaskItem(mergedRaw));
  }
  for (const row of legacyRaw) {
    const id = typeof row.id === 'string' && row.id ? row.id : '';
    if (!id || seen.has(id)) continue;
    out.push(migrateTaskItem(row));
  }
  return out;
}

/** Merge one cell while keeping the CRON-owned intervalle source authoritative when requested. */
function mergeWorkItemCell(
  legacy: unknown,
  fromV2: unknown,
  options: { preferLegacyIntervalle?: boolean } = {},
): Partial<ShiftData> {
  const legCell = legacy && typeof legacy === 'object' ? (legacy as Record<string, unknown>) : {};
  const v2Cell = fromV2 && typeof fromV2 === 'object' ? (fromV2 as Record<string, unknown>) : {};

  const a = normalizeOneCell(legacy);
  const b = normalizeOneCell(fromV2);
  const m: Partial<ShiftData> = { ...a, ...b };
  for (const s of SHIFT_SECTIONS) {
    const av = a[s] as unknown[] | undefined;
    const bv = b[s] as unknown[] | undefined;
    const aLen = Array.isArray(av) ? av.length : 0;
    const bLen = Array.isArray(bv) ? bv.length : 0;
    const legacyHasSection = hasOwnSection(legacy, s);
    const v2HasSection = hasOwnSection(fromV2, s);
    if (s === 'intervalle') {
      if (options.preferLegacyIntervalle) {
        if (legacyHasSection) m[s] = (av ?? []) as ShiftData[typeof s];
        else if (v2HasSection) m[s] = (bv ?? []) as ShiftData[typeof s];
      } else if (legacyHasSection && v2HasSection && aLen > 0 && bLen > 0) {
        m[s] = mergeIntervalleRows(av as IntervalleItem[], bv as IntervalleItem[]) as ShiftData[typeof s];
      } else if (v2HasSection) m[s] = (bv ?? []) as ShiftData[typeof s];
      else if (legacyHasSection) m[s] = (av ?? []) as ShiftData[typeof s];
    } else if (s === 'tasks' && (aLen > 0 || bLen > 0)) {
      const legTasks = coerceSectionArray<Record<string, unknown>>(legCell.tasks);
      const v2Tasks = coerceSectionArray<Record<string, unknown>>(v2Cell.tasks);
      m[s] = mergeTaskRowsRaw(legTasks, v2Tasks) as ShiftData[typeof s];
    } else if (bLen > 0) m[s] = bv as ShiftData[typeof s];
    else if (aLen > 0) m[s] = av as ShiftData[typeof s];
  }
  return m;
}

export function mergeWorkItemMaps(legacy: WorkItems, v2: WorkItems): WorkItems {
  const out: WorkItems = { ...legacy };
  for (const [k, v2cell] of Object.entries(v2)) {
    out[k] = mergeWorkItemCell(legacy[k], v2cell, {
      preferLegacyIntervalle: true,
    }) as WorkItems[string];
  }
  return out;
}

/** Rewrite workItems keys from legacy `||` separators to `__`, canonicalize day/shift, merge duplicate keys. */
export function normalizeWorkItemKeys(raw: unknown): WorkItems {
  if (!raw || typeof raw !== 'object') return {};
  const merged: WorkItems = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    let nk = key;
    if (key.includes(LEGACY_KEY_SEP) && !key.includes(REACT_KEY_SEP)) {
      const parts = key.split(LEGACY_KEY_SEP);
      if (parts.length === 3) {
        nk = `${parts[0]}${REACT_KEY_SEP}${parts[1]}${REACT_KEY_SEP}${parts[2]}`;
      }
    }
    nk = canonicalizeWorkItemKey(nk);
    if (merged[nk]) {
      merged[nk] = mergeWorkItemCell(merged[nk], val) as WorkItems[string];
    } else {
      merged[nk] = normalizeOneCell(val) as WorkItems[string];
    }
  }
  return merged;
}

function isNonEmptyKalenderWocheList(x: unknown): x is KalenderWoche[] {
  return Array.isArray(x) && x.length > 0 && typeof (x[0] as { id?: string }).id === 'string';
}

/** Firestore `kalenderwochen` (week number field is usually `kw`). */
function kalenderwochenToKwList(raw: unknown): KalenderWoche[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return (raw as Record<string, unknown>[]).map((row) => {
    const n = Number(row.kw ?? row.num);
    const y = Number(row.year);
    const id =
      (typeof row.id === 'string' && row.id) ||
      (Number.isFinite(n) && Number.isFinite(y) ? `kw_${y}_${String(n).padStart(2, '0')}` : `kw_${String(Math.random()).slice(2)}`);
    const label =
      (typeof row.label === 'string' && row.label) ||
      (Number.isFinite(n) && Number.isFinite(y) ? `KW ${String(n).padStart(2, '0')} / ${y}` : id);
    return {
      id,
      label,
      num: Number.isFinite(n) ? n : 1,
      year: Number.isFinite(y) ? y : new Date().getFullYear(),
      dateFrom: typeof row.dateFrom === 'string' ? row.dateFrom : '',
      dateTo: typeof row.dateTo === 'string' ? row.dateTo : '',
    };
  });
}

/**
 * Merges v2 `snapshot` (React) with legacy `plannerData` (vanilla) and `kalenderwochen` / `overview`.
 */
export function extractProjectSnapshot(data: Record<string, unknown>): ProjectSnapshot {
  const legacyKw = kalenderwochenToKwList(data.kalenderwochen);
  const overview = (data.overview as Record<string, unknown> | undefined) ?? undefined;
  const pd = data.plannerData as Record<string, unknown> | undefined;

  // —— v2: `snapshot` from this React app — prefer when field exists ——
  if (data.snapshot != null && typeof data.snapshot === 'object') {
    const v2 = data.snapshot as Partial<ProjectSnapshot>;
    const st = (v2.stammdaten ?? {}) as ProjectStammdaten;
    const stExtra = st as unknown as Record<string, unknown>;
    const stPd = pd && typeof pd === 'object' ? (pd.stammdaten as Record<string, unknown> | undefined) : undefined;
    const shiftFromPlanner =
      (pd && typeof pd === 'object'
        ? ((pd as Record<string, unknown>).shiftConfig as ShiftConfig | undefined) ||
          (stPd?.shiftConfig as ShiftConfig | undefined) ||
          (overview?.shiftConfig as ShiftConfig | undefined)
        : undefined) ?? undefined;
    const shift = (st.shiftConfig ?? shiftFromPlanner ?? DEFAULT_SHIFT) as ShiftConfig;
    const fachFromPd = (stPd?.fachdienstBauteile ?? {}) as ProjectStammdaten['fachdienstBauteile'];
    const fachV2 = (st.fachdienstBauteile ?? {}) as ProjectStammdaten['fachdienstBauteile'];
    const fach: ProjectStammdaten['fachdienstBauteile'] = { ...fachFromPd, ...fachV2 };
    // Prefer v2 weeks; if empty, use legacy plannerData weeks, then top-level kalenderwochen
    const kwList = isNonEmptyKalenderWocheList(v2.kwList)
      ? v2.kwList!
      : isNonEmptyKalenderWocheList(pd?.kwList)
        ? (pd!.kwList as KalenderWoche[])
        : legacyKw;
    // Same document often still has `plannerData` (vanilla app / CRON feed). Merge so that
    // user-owned sections are not lost, but keep plannerData intervalle authoritative.
    const legacyWorkItems =
      pd && typeof pd === 'object'
        ? normalizeWorkItemKeys((pd as Record<string, unknown>).workItems ?? {})
        : {};
    const v2WorkItems = normalizeWorkItemKeys(v2.workItems ?? {});
    const workItems = mergeWorkItemMaps(legacyWorkItems, v2WorkItems);
    const stV2: Record<string, unknown> = {
      ...(stExtra ?? {}),
      projektname: str(stExtra?.projektname) || str(data.name),
      projektnummer: str(stExtra?.projektnummer) || str(overview?.projektnummer),
      auftraggeber: str(stExtra?.auftraggeber) || str(overview?.auftraggeber),
      bauleiter: str(stExtra?.bauleiter) || str(overview?.bauleiter),
      polier: str(stExtra?.polier) || str(overview?.polier),
      standort: str(stExtra?.standort) || str(overview?.standort),
      baubeginn: str(stExtra?.baubeginn) || str(overview?.baubeginn),
      bauende: str(stExtra?.bauende) || str(overview?.bauende),
    };
    const v2Mita = normalizeMitarbeiterList(v2.mitarbeiter);
    const tables = pd && typeof pd === 'object' ? (pd as Record<string, unknown>).tables as { mitarbeiter?: unknown } | undefined : undefined;
    const mitarbeiterFromPd = normalizeMitarbeiterList(
      tables?.mitarbeiter ?? (stPd as { mitarbeiter?: unknown } | undefined)?.mitarbeiter,
    );
    const mitarbeiter = v2Mita.length > 0 ? v2Mita : mitarbeiterFromPd;
    return {
      kwList,
      workItems,
      stammdaten: buildStammdaten(fach, shift, stV2),
      mitarbeiter,
    };
  }

  // —— Legacy: `plannerData` blob (no top-level v2 snapshot) ——
  if (pd && typeof pd === 'object') {
    const st = pd.stammdaten as Record<string, unknown> | undefined;
    const shiftFromPd =
      (pd.shiftConfig as ShiftConfig | undefined) ||
      (st?.shiftConfig as ShiftConfig | undefined) ||
      (overview?.shiftConfig as ShiftConfig | undefined) ||
      DEFAULT_SHIFT;
    const fach =
      (st?.fachdienstBauteile as ProjectStammdaten['fachdienstBauteile']) ?? {};
    const tables = pd.tables as { mitarbeiter?: unknown } | undefined;

    const kwList = isNonEmptyKalenderWocheList(pd.kwList) ? (pd.kwList as KalenderWoche[]) : legacyKw;
    const mitarbeiter = normalizeMitarbeiterList(
      tables?.mitarbeiter ?? (st as { mitarbeiter?: unknown } | undefined)?.mitarbeiter,
    );
    const stMerged: Record<string, unknown> = {
      ...(st ?? {}),
      projektname: str(st?.projektname) || str(data.name),
      projektnummer: str(st?.projektnummer) || str(overview?.projektnummer),
      auftraggeber: str(st?.auftraggeber) || str(overview?.auftraggeber),
      bauleiter: str(st?.bauleiter) || str(overview?.bauleiter),
      polier: str(st?.polier) || str(overview?.polier),
      standort: str(st?.standort) || str(overview?.standort),
      baubeginn: str(st?.baubeginn) || str(overview?.baubeginn),
      bauende: str(st?.bauende) || str(overview?.bauende),
    };

    return {
      kwList,
      workItems: normalizeWorkItemKeys(pd.workItems ?? {}),
      stammdaten: buildStammdaten(fach, shiftFromPd, stMerged),
      mitarbeiter,
    };
  }

  // —— Minimal: top-level `stammdaten`, `overview`, `name` (legacy import) ——
  const stDoc =
    data.stammdaten && typeof data.stammdaten === 'object'
      ? (data.stammdaten as Record<string, unknown>)
      : {};
  const ov = overview ?? {};
  const mita = normalizeMitarbeiterList(stDoc.personal);
  const extra: Record<string, unknown> = {
    ...stDoc,
    projektname: str(stDoc.projektname) || str(data.name),
    projektnummer: str(stDoc.projektnummer) || str(ov.projektnummer),
    auftraggeber: str(stDoc.auftraggeber) || str(ov.auftraggeber),
    bauleiter: str(stDoc.bauleiter) || str(ov.bauleiter),
    polier: str(stDoc.polier) || str(ov.polier),
    standort: str(stDoc.standort) || str(ov.standort),
    baubeginn: str(stDoc.baubeginn) || str(ov.baubeginn),
    bauende: str(stDoc.bauende) || str(ov.bauende),
  };

  return {
    kwList: legacyKw,
    workItems: normalizeWorkItemKeys((data as { workItems?: unknown }).workItems),
    stammdaten: buildStammdaten(
      (stDoc.fachdienstBauteile as ProjectStammdaten['fachdienstBauteile']) ?? {},
      (ov.shiftConfig as ShiftConfig | undefined) ?? DEFAULT_SHIFT,
      extra,
    ),
    mitarbeiter: mita,
  };
}
