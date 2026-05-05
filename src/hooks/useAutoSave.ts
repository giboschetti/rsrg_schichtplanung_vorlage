import { useEffect, useRef, useState } from 'react';
import {
  registerPlannerWriteCallbacks,
  clearPlannerWriteCallbacks,
} from '@/stores/plannerStore';
import {
  registerStammdatenWriteCallbacks,
  clearStammdatenWriteCallbacks,
} from '@/stores/stammdatenStore';
import {
  writeCellSection,
  writeKwList,
  writeStammdaten,
  writeMitarbeiter,
} from '@/services/firestoreService';
import { useUiStore } from '@/stores/uiStore';
import type { KalenderWoche, MitarbeiterRow, SdpSection } from '@/types';

const DEBOUNCE_SECTION_MS = 800;
const DEBOUNCE_KW_MS = 400;
const DEBOUNCE_STAMMDATEN_MS = 800;
const DEBOUNCE_MITARBEITER_MS = 400;

interface UseAutoSaveOptions {
  /** Only register callbacks and start watching after initial load is complete. */
  enabled: boolean;
}

export function useAutoSave(
  projectId: string | undefined,
  { enabled }: UseAutoSaveOptions,
): { syncing: boolean } {
  const [pendingCount, setPendingCount] = useState(0);

  // Timer maps keyed by a string identifier so each (cellKey, section) pair
  // gets its own independent debounce window.
  const sectionTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const kwTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stammdatenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mitarbeiterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addPending = () => setPendingCount((n) => n + 1);
  const removePending = () => setPendingCount((n) => Math.max(0, n - 1));

  const showError = (msg: string) => useUiStore.getState().showToast(msg);

  useEffect(() => {
    if (!enabled || !projectId) return;

    const pid = projectId;

    // ── Section writes ────────────────────────────────────────────────────
    const onSectionWrite = (cellKey: string, section: SdpSection, items: unknown[]) => {
      const timerKey = `${cellKey}__${section}`;
      const existing = sectionTimers.current.get(timerKey);
      if (existing) clearTimeout(existing);

      addPending();
      const id = setTimeout(() => {
        sectionTimers.current.delete(timerKey);
        writeCellSection(pid, cellKey, section, items)
          .catch(() => showError('Automatisches Speichern fehlgeschlagen'))
          .finally(removePending);
      }, DEBOUNCE_SECTION_MS);
      sectionTimers.current.set(timerKey, id);
    };

    // ── KW list writes ───────────────────────────────────────────────────
    const onKwWrite = (kwList: KalenderWoche[]) => {
      if (kwTimer.current) clearTimeout(kwTimer.current);
      addPending();
      kwTimer.current = setTimeout(() => {
        kwTimer.current = null;
        writeKwList(pid, kwList)
          .catch(() => showError('Automatisches Speichern fehlgeschlagen'))
          .finally(removePending);
      }, DEBOUNCE_KW_MS);
    };

    // ── Stammdaten writes ────────────────────────────────────────────────
    const onStammdatenWrite = (stammdatenPayload: unknown) => {
      if (stammdatenTimer.current) clearTimeout(stammdatenTimer.current);
      addPending();
      stammdatenTimer.current = setTimeout(() => {
        stammdatenTimer.current = null;
        writeStammdaten(pid, stammdatenPayload)
          .catch(() => showError('Automatisches Speichern fehlgeschlagen'))
          .finally(removePending);
      }, DEBOUNCE_STAMMDATEN_MS);
    };

    // ── Mitarbeiter writes ───────────────────────────────────────────────
    const onMitarbeiterWrite = (mitarbeiter: MitarbeiterRow[]) => {
      if (mitarbeiterTimer.current) clearTimeout(mitarbeiterTimer.current);
      addPending();
      mitarbeiterTimer.current = setTimeout(() => {
        mitarbeiterTimer.current = null;
        writeMitarbeiter(pid, mitarbeiter)
          .catch(() => showError('Automatisches Speichern fehlgeschlagen'))
          .finally(removePending);
      }, DEBOUNCE_MITARBEITER_MS);
    };

    registerPlannerWriteCallbacks(onSectionWrite, onKwWrite);
    registerStammdatenWriteCallbacks(onStammdatenWrite, onMitarbeiterWrite);

    return () => {
      // Clear all pending timers on unmount or projectId/enabled change.
      sectionTimers.current.forEach(clearTimeout);
      sectionTimers.current.clear();
      if (kwTimer.current) clearTimeout(kwTimer.current);
      if (stammdatenTimer.current) clearTimeout(stammdatenTimer.current);
      if (mitarbeiterTimer.current) clearTimeout(mitarbeiterTimer.current);

      clearPlannerWriteCallbacks();
      clearStammdatenWriteCallbacks();

      // Reset pending count since all timers are cancelled.
      setPendingCount(0);
    };
  }, [enabled, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { syncing: pendingCount > 0 };
}
