import type {
  KalenderWoche,
  MitarbeiterRow,
  ProjectSnapshot,
  ProjectStammdaten,
  ShiftConfig,
  WorkItems,
} from '@/types';

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

/** Rewrite workItems keys from legacy `||` separators to `__`. */
export function normalizeWorkItemKeys(raw: unknown): WorkItems {
  if (!raw || typeof raw !== 'object') return {};
  const out: WorkItems = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    let nk = key;
    if (key.includes(LEGACY_KEY_SEP) && !key.includes(REACT_KEY_SEP)) {
      const parts = key.split(LEGACY_KEY_SEP);
      if (parts.length === 3) {
        nk = `${parts[0]}${REACT_KEY_SEP}${parts[1]}${REACT_KEY_SEP}${parts[2]}`;
      }
    }
    out[nk] = val as WorkItems[string];
  }
  return out;
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
    // Same document often still has `plannerData` (vanilla app / manual Firestore edits). Merge so that data is not lost.
    const legacyWorkItems =
      pd && typeof pd === 'object'
        ? normalizeWorkItemKeys((pd as Record<string, unknown>).workItems ?? {})
        : {};
    const v2WorkItems = normalizeWorkItemKeys(v2.workItems ?? {});
    const workItems = { ...legacyWorkItems, ...v2WorkItems };
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
