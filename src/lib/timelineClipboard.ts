import type { SdpSection, TaskItem, PersonalItem } from '@/types';
import type { TlRowMeta } from '@/types/timeline';
import { normalizeBauteil, normalizeFachdienst } from '@/lib/workItemHelpers';

export const TIMELINE_CLIP_MAGIC = '_schichtplanungBadgesV1' as const;

export interface ClipboardBadgeRow {
  section: SdpSection;
  record: Record<string, unknown>;
}

export interface ClipboardPayload {
  [TIMELINE_CLIP_MAGIC]: true;
  items: ClipboardBadgeRow[];
}

function newId(): string {
  return `tl_${Math.random().toString(36).slice(2)}`;
}

export function buildClipboardPayload(items: ClipboardBadgeRow[]): ClipboardPayload {
  return {
    [TIMELINE_CLIP_MAGIC]: true,
    items: items.map((row) => ({
      section: row.section,
      record: JSON.parse(JSON.stringify(row.record)) as Record<string, unknown>,
    })),
  };
}

export function parseClipboardPayload(text: string): ClipboardPayload | null {
  const t = text?.trim();
  if (!t?.startsWith('{')) return null;
  try {
    const o = JSON.parse(t) as ClipboardPayload;
    if (o && o[TIMELINE_CLIP_MAGIC] === true && Array.isArray(o.items)) return o;
  } catch {
    return null;
  }
  return null;
}

/** Remap row fields to the target timeline row (e.g. Bauteil / Fachdienst / Funktion). */
export function applyPasteTargetToRecord(
  section: SdpSection,
  record: Record<string, unknown>,
  targetMeta: TlRowMeta,
): Record<string, unknown> {
  const out = { ...record, id: newId() };
  if (section === 'tasks') {
    const t = out as unknown as TaskItem;
    if (targetMeta.kind === 'bauteil') {
      t.fachdienst = normalizeFachdienst(targetMeta.fachdienst);
      t.bauteil = normalizeBauteil(targetMeta.bauteil);
    }
  } else if (section === 'personal') {
    const p = out as unknown as PersonalItem;
    if (targetMeta.kind === 'funktion' && targetMeta.funktion) {
      p.funktion = targetMeta.funktion;
    }
  }
  return out as Record<string, unknown>;
}

/** Single decision point for paste validity. Covers both row-type and content checks. */
export function validatePaste(
  items: ClipboardBadgeRow[],
  targetMeta: TlRowMeta,
): { allowed: boolean; reason?: string } {
  // Row-type check
  if (targetMeta.sectionId === 'intervalle')
    return { allowed: false, reason: 'Hier einfügen nicht möglich' };
  if (targetMeta.kind === 'group-header' || targetMeta.kind === 'fachdienst')
    return { allowed: false, reason: 'Hier einfügen nicht möglich' };
  if (targetMeta.kind === 'bauteil' && targetMeta.sectionId !== 'tasks')
    return { allowed: false, reason: 'Hier einfügen nicht möglich' };
  if (targetMeta.kind === 'funktion' && targetMeta.sectionId !== 'personal')
    return { allowed: false, reason: 'Hier einfügen nicht möglich' };

  // Content check
  if (!items.length)
    return { allowed: false, reason: 'Keine passenden Daten in der Zwischenablage' };
  const sec = items[0]!.section;
  if (!items.every((r) => r.section === sec))
    return { allowed: false, reason: 'Einfügen: Abschnitt passt nicht zur Zeile' };
  if (sec === 'tasks' && !(targetMeta.sectionId === 'tasks' && targetMeta.kind === 'bauteil'))
    return { allowed: false, reason: 'Einfügen: Abschnitt passt nicht zur Zeile' };
  if (sec === 'personal' && !(targetMeta.sectionId === 'personal' && targetMeta.kind === 'funktion'))
    return { allowed: false, reason: 'Einfügen: Abschnitt passt nicht zur Zeile' };
  if (sec !== 'tasks' && sec !== 'personal' && !(targetMeta.sectionId === sec && targetMeta.kind === 'simple'))
    return { allowed: false, reason: 'Einfügen: Abschnitt passt nicht zur Zeile' };

  return { allowed: true };
}
