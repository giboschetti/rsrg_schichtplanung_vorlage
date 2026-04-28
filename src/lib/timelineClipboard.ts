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

/** Whether paste is allowed for this target row (not group header / empty fachdienst band). */
export function canPasteIntoRow(meta: TlRowMeta): boolean {
  if (meta.sectionId === 'intervalle') return false;
  if (meta.kind === 'group-header' || meta.kind === 'fachdienst') return false;
  if (meta.kind === 'bauteil') return meta.sectionId === 'tasks';
  if (meta.kind === 'funktion') return meta.sectionId === 'personal';
  return meta.kind === 'simple';
}

export function clipboardSectionsCompatible(
  items: ClipboardBadgeRow[],
  targetMeta: TlRowMeta,
): boolean {
  if (!items.length) return false;
  const sec = items[0]!.section;
  if (!items.every((r) => r.section === sec)) return false;
  if (sec === 'tasks') return targetMeta.sectionId === 'tasks' && targetMeta.kind === 'bauteil';
  if (sec === 'personal') return targetMeta.sectionId === 'personal' && targetMeta.kind === 'funktion';
  return targetMeta.sectionId === sec && targetMeta.kind === 'simple';
}
