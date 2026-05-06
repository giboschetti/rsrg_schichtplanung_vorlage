import { usePlannerStore } from '@/stores/plannerStore';
import { useTimelineSelectionStore } from '@/stores/timelineSelectionStore';
import { useUiStore } from '@/stores/uiStore';
import type { SdpSection, ShiftId } from '@/types';
import type { TlBadgeRef } from '@/types/timeline';
import {
  buildClipboardPayload,
  parseClipboardPayload,
  applyPasteTargetToRecord,
  validatePaste,
} from '@/lib/timelineClipboard';

function groupKey(r: TlBadgeRef): string {
  return JSON.stringify([r.kwId, r.dayIdx, r.shift, r.sectionId]);
}

export function deleteTimelineSelection(): void {
  const refs = useTimelineSelectionStore.getState().selected.filter((r) => r.sectionId !== 'intervalle');
  if (!refs.length) return;
  const planner = usePlannerStore.getState();
  const by = new Map<string, Set<string>>();
  for (const r of refs) {
    const k = groupKey(r);
    if (!by.has(k)) by.set(k, new Set());
    by.get(k)!.add(r.itemId);
  }
  for (const [key, ids] of by) {
    const [kwId, dayIdx, shift, section] = JSON.parse(key) as [string, number, ShiftId, SdpSection];
    const cur = planner.getSection<Record<string, unknown>>(kwId, dayIdx, shift, section);
    const next = cur.filter((row) => {
      const id = row.id;
      return typeof id === 'string' && id !== '' && !ids.has(id);
    });
    planner.setSection(kwId, dayIdx, shift, section, next);
  }
  useTimelineSelectionStore.getState().clearSelection();
}

export async function copyTimelineSelectionToClipboard(): Promise<void> {
  const refs = useTimelineSelectionStore.getState().selected.filter((r) => r.sectionId !== 'intervalle');
  if (!refs.length) return;
  const planner = usePlannerStore.getState();
  const payloadItems: { section: SdpSection; record: Record<string, unknown> }[] = [];
  for (const r of refs) {
    const list = planner.getSection<Record<string, unknown>>(r.kwId, r.dayIdx, r.shift, r.sectionId);
    const row = list.find((x) => x.id === r.itemId);
    if (row) payloadItems.push({ section: r.sectionId, record: { ...row } });
  }
  if (!payloadItems.length) return;
  const text = JSON.stringify(buildClipboardPayload(payloadItems));
  try {
    await navigator.clipboard.writeText(text);
    useUiStore.getState().showToast('In Zwischenablage kopiert');
  } catch {
    useUiStore.getState().showToast('Kopieren fehlgeschlagen');
  }
}

export async function pasteTimelineClipboard(): Promise<void> {
  const { lastPasteContext } = useTimelineSelectionStore.getState();
  if (!lastPasteContext) {
    useUiStore.getState().showToast('Zuerst eine Zelle wählen');
    return;
  }
  const { meta, kwId, dayIdx, shift } = lastPasteContext;
  let text = '';
  try {
    text = await navigator.clipboard.readText();
  } catch {
    useUiStore.getState().showToast('Zwischenablage lesen fehlgeschlagen');
    return;
  }
  const payload = parseClipboardPayload(text);
  const items = payload?.items ?? [];
  const { allowed, reason } = validatePaste(items, meta);
  if (!allowed) {
    useUiStore.getState().showToast(reason ?? 'Einfügen nicht möglich');
    return;
  }
  const section = items[0]!.section;
  const planner = usePlannerStore.getState();
  const rows = planner.getSection(kwId, dayIdx, shift, section);
  const added = items.map((it) => applyPasteTargetToRecord(it.section, it.record, meta));
  planner.setSection(kwId, dayIdx, shift, section, [...rows, ...added] as never[]);
  useUiStore.getState().showToast(`${added.length} eingefügt`);

}

function isTypingTarget(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  if (el.closest('[data-sdp-panel]') || el.closest('[data-tabulator]')) return true;
  return false;
}

export function handleTimelineGridKeyDown(e: KeyboardEvent): void {
  if (isTypingTarget(document.activeElement)) return;
  const copy = e.key === 'c' && (e.ctrlKey || e.metaKey);
  const paste = e.key === 'v' && (e.ctrlKey || e.metaKey);
  const del = e.key === 'Delete' || e.key === 'Backspace';
  if (!copy && !paste && !del) return;
  if (copy) {
    e.preventDefault();
    void copyTimelineSelectionToClipboard();
    return;
  }
  if (paste) {
    e.preventDefault();
    void pasteTimelineClipboard();
    return;
  }
  if (del) {
    e.preventDefault();
    deleteTimelineSelection();
  }
}
