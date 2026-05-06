import type { TaskItem, PersonalItem, WorkItems } from '@/types';
import { SDP_FUNKTION_VALUES, FACHDIENST_VALUES } from '@/types';

/**
 * Domain helpers for work-item aggregation and filtering.
 * These functions encode the Fachdienst → Bauteil → Tätigkeit hierarchy
 * and the Funktion grouping for Personal.
 *
 * Display logic lives in chipHelpers.ts.
 * Migration logic lives in mergeFirestoreSnapshot.ts.
 */

// ─── Normalization ──────────────────────────────────────────────────────────
// Canonical fallback values match the domain vocabulary in CONTEXT.md.

export function normalizePersonalFunktion(raw: string | undefined): string {
  return String(raw ?? '').trim() || 'Ohne Funktion';
}

export function normalizeFachdienst(raw: string | undefined): string {
  return String(raw ?? '').trim() || 'Andere';
}

export function normalizeBauteil(raw: string | undefined): string {
  return String(raw ?? '').trim() || 'Ohne Bauteil';
}

export function normalizeTaetigkeit(raw: string | undefined): string {
  return String(raw ?? '').trim() || 'Ohne Tätigkeit';
}

// ─── Aggregation: derive visible rows from all Shift Cells ──────────────────

/** Returns Fachdienste that have at least one Tätigkeit in any Shift Cell,
 *  ordered by the canonical FACHDIENST_VALUES list, then alphabetically. */
export function getUsedFachdienste(workItems: WorkItems): string[] {
  const set = new Set<string>();
  Object.values(workItems).forEach((cell) => {
    (cell?.tasks ?? []).forEach((r) => set.add(normalizeFachdienst((r as TaskItem).fachdienst)));
  });
  const ordered: string[] = [];
  FACHDIENST_VALUES.forEach((f) => { if (set.has(f)) ordered.push(f); });
  const extras = Array.from(set)
    .filter((f) => !(FACHDIENST_VALUES as readonly string[]).includes(f))
    .sort((a, b) => a.localeCompare(b, 'de-CH'));
  return [...ordered, ...extras];
}

/** Returns Bauteile in use for a given Fachdienst, ordered by the master
 *  catalogue, then alphabetically for any that aren't in the catalogue. */
export function getBauteileInUseForFachdienst(
  workItems: WorkItems,
  fachdienst: string,
  masterBauteile: string[],
): string[] {
  const set = new Set<string>();
  Object.values(workItems).forEach((cell) => {
    (cell?.tasks ?? [])
      .filter((r) => normalizeFachdienst((r as TaskItem).fachdienst) === fachdienst)
      .forEach((r) => set.add(normalizeBauteil((r as TaskItem).bauteil)));
  });
  const ordered = masterBauteile.filter((v) => set.has(v));
  const extras = Array.from(set).filter((v) => !ordered.includes(v)).sort((a, b) => a.localeCompare(b, 'de-CH'));
  return [...ordered, ...extras];
}

/** Returns Personal Funktionen in use across all Shift Cells,
 *  ordered by the canonical SDP_FUNKTION_VALUES list. */
export function getUsedPersonalFunctions(workItems: WorkItems): string[] {
  const set = new Set<string>();
  Object.values(workItems).forEach((cell) => {
    (cell?.personal ?? []).forEach((r) => set.add(normalizePersonalFunktion((r as PersonalItem).funktion)));
  });
  const ordered: string[] = [];
  SDP_FUNKTION_VALUES.forEach((f) => { if (set.has(f)) ordered.push(f); });
  const extras = Array.from(set)
    .filter((f) => !(SDP_FUNKTION_VALUES as readonly string[]).includes(f))
    .sort((a, b) => a.localeCompare(b, 'de-CH'));
  return [...ordered, ...extras];
}

// ─── Filtering: narrow items for a specific timeline row ───────────────────

export function getTasksByFachdienstBauteil(
  tasks: TaskItem[],
  fachdienst: string,
  bauteil: string,
): TaskItem[] {
  return tasks.filter(
    (r) => normalizeFachdienst(r.fachdienst) === fachdienst && normalizeBauteil(r.bauteil) === bauteil,
  );
}

export function getPersonalByFunktion(personal: PersonalItem[], funktion: string): PersonalItem[] {
  return personal.filter((r) => normalizePersonalFunktion(r.funktion) === funktion);
}
