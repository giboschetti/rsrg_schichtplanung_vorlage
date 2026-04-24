import type {
  TaskItem,
  PersonalItem,
  SdpSection,
  WorkItems,
} from '@/types';
import { SDP_FUNKTION_VALUES, FACHDIENST_VALUES } from '@/types';

// ─── Normalization ──────────────────────────────────────────────────────────

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

// ─── Item label for timeline chips ─────────────────────────────────────────

export function getItemLabel(item: Record<string, unknown>, sectionId: SdpSection): string {
  if (sectionId === 'tasks') return (item.taetigkeit as string) || '–';
  if (sectionId === 'personal') return ((item.name as string) ?? '').trim() || '–';
  if (sectionId === 'inventar') return (item.geraet as string) || '–';
  if (sectionId === 'material') return (item.material as string) || '–';
  if (sectionId === 'fremdleistung') return (item.firma as string) || '–';
  if (sectionId === 'intervalle') return (item.babNr as string) || (item.babTitel as string) || '–';
  return '–';
}

// ─── Chip class from status ─────────────────────────────────────────────────

export function chipClassFromResStatus(item: Record<string, unknown>, sectionId: SdpSection): string {
  if (sectionId === 'intervalle') {
    const v = item.status as string;
    if (v === 'Verständigt') return 'chip-bestaetigt';
    if (v === 'Entwurf' || v === 'Änderung') return 'chip-planung';
    if (v === 'Zusätzlicher Bedarf') return 'chip-anfrage';
    return 'chip-default';
  }
  const v = item.resStatus as string;
  if (v === 'Planung') return 'chip-planung';
  if (v === 'Bestellt') return 'chip-bestellt';
  if (v === 'Bestätigt') return 'chip-bestaetigt';
  return 'chip-default';
}

// ─── Tooltip title for chips ────────────────────────────────────────────────

export function chipTitle(item: Record<string, unknown>, sectionId: SdpSection): string {
  if (sectionId === 'tasks')
    return [(item.taetigkeit as string), (item.resStatus as string)].filter(Boolean).join(' · ');
  if (sectionId === 'personal') {
    const fn = ((item.funktion as string) ?? '').trim();
    const nm = ((item.name as string) ?? '').trim();
    const who = fn && nm ? `${fn} – ${nm}` : nm || fn;
    return [who, item.resStatus as string].filter(Boolean).join(' · ');
  }
  if (sectionId === 'inventar')
    return [(item.geraet as string), (item.resStatus as string)].filter(Boolean).join(' · ');
  if (sectionId === 'material')
    return [(item.material as string), (item.resStatus as string)].filter(Boolean).join(' · ');
  if (sectionId === 'fremdleistung')
    return [(item.firma as string), (item.leistung as string), (item.resStatus as string)].filter(Boolean).join(' · ');
  if (sectionId === 'intervalle')
    return [(item.babNr as string), (item.babTitel as string), (item.status as string)].filter(Boolean).join(' · ');
  return '';
}

// ─── Aggregation helpers for 3-level task hierarchy ────────────────────────

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

export function getBauteileInUseForFachdienst(workItems: WorkItems, fachdienst: string, masterBauteile: string[]): string[] {
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

// ─── Migration helper (old task shape → new) ────────────────────────────────

export function migrateTaskItem(raw: Record<string, unknown>): TaskItem {
  return {
    id: (raw.id as string) || Math.random().toString(36).slice(2),
    fachdienst: (raw.fachdienst as string) ?? 'Andere',
    bauteil: (raw.bauteil as string) ?? (raw.bauphaseBauteil as string) ?? '',
    taetigkeit: (raw.taetigkeit as string) ?? (raw.name as string) ?? '',
    beschreibung: (raw.beschreibung as string) ?? '',
    location: (raw.location as string) ?? '',
    resStatus: (raw.resStatus as TaskItem['resStatus']) ?? '',
    notes: (raw.notes as string) ?? '',
  };
}
