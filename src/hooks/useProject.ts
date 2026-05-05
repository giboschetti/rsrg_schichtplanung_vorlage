import { useCallback, useEffect, useState } from 'react';
import { subscribeToProject, saveProjectSnapshot } from '@/services/firestoreService';
import { usePlannerStore } from '@/stores/plannerStore';
import { useProjectDocumentDirtyStore } from '@/stores/projectDocumentDirtyStore';
import { useStammdatenStore, DEFAULT_SHIFT_CONFIG } from '@/stores/stammdatenStore';
import { useUiStore } from '@/stores/uiStore';
import type { ProjectStamFormFields, ProjectSnapshot, WorkItems } from '@/types';
import { EMPTY_PROJECT_STAM_FORM } from '@/types';

interface UseProjectReturn {
  loading: boolean;
  error: string | null;
  save: () => Promise<void>;
  saving: boolean;
}

export function useProject(projectId: string | undefined): UseProjectReturn {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setProject = usePlannerStore((s) => s.setProject);
  const setKwList = usePlannerStore((s) => s.setKwList);
  const setWorkItems = usePlannerStore((s) => s.setWorkItems);
  const markClean = useProjectDocumentDirtyStore((s) => s.markClean);

  const setFachdienstBauteile = useStammdatenStore((s) => s.setFachdienstBauteile);
  const setShiftConfig = useStammdatenStore((s) => s.setShiftConfig);
  const setProjectForm = useStammdatenStore((s) => s.setProjectForm);
  const setMitarbeiter = useStammdatenStore((s) => s.setMitarbeiter);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    let unsubFirestore: (() => void) | null = null;
    let cancelled = false;
    setError(null);
    setLoading(true);

    const persistKey = `p-${projectId}`;

    (async () => {
      try {
        usePlannerStore.persist.setOptions({ name: `rsrg-planner-${persistKey}` });
        useStammdatenStore.persist.setOptions({ name: `rsrg-stammdaten-${persistKey}` });
        await Promise.all([
          usePlannerStore.persist.rehydrate() ?? Promise.resolve(),
          useStammdatenStore.persist.rehydrate() ?? Promise.resolve(),
        ]);
      } catch {
        // ignore rehydration errors; Firestore is source of truth
      }
      if (cancelled) return;

      let isFirstSnapshot = true;

      unsubFirestore = subscribeToProject(
        projectId,
        (project) => {
          if (cancelled) return;
          const snap = project.snapshot;

          if (isFirstSnapshot) {
            isFirstSnapshot = false;
            setProject(project.id, project.name);
            if (snap) {
              setKwList(snap.kwList ?? []);
              setWorkItems(snap.workItems ?? {});
              setFachdienstBauteile(snap.stammdaten?.fachdienstBauteile ?? {});
              if (snap.stammdaten?.shiftConfig) setShiftConfig(snap.stammdaten.shiftConfig);
              setProjectForm({
                ...EMPTY_PROJECT_STAM_FORM,
                ...pickStamForm(snap.stammdaten),
              });
              setMitarbeiter(snap.mitarbeiter ?? []);
            } else {
              setKwList([]);
              setWorkItems({});
              setFachdienstBauteile({});
              setShiftConfig(DEFAULT_SHIFT_CONFIG);
              setProjectForm({ ...EMPTY_PROJECT_STAM_FORM });
              setMitarbeiter([]);
            }
            markClean();
            setLoading(false);
          } else if (snap) {
            // Live update (e.g. from CRON automation writing to Firestore)
            const dirty = useProjectDocumentDirtyStore.getState().dirty;
            if (!dirty) {
              // No unsaved user edits — safe to fully refresh
              setKwList(snap.kwList ?? []);
              setWorkItems(snap.workItems ?? {});
              setMitarbeiter(snap.mitarbeiter ?? []);
            } else {
              // User has unsaved edits — only refresh intervalle sections
              // so CRON-written data shows up without overwriting the user's work
              const currentItems = usePlannerStore.getState().workItems;
              setWorkItems(mergeIntervalleOnly(currentItems, snap.workItems ?? {}));
            }
          }
        },
        (err) => {
          if (!cancelled) {
            setError(String(err));
            if (isFirstSnapshot) setLoading(false);
          }
        },
      );
    })();

    return () => {
      cancelled = true;
      unsubFirestore?.();
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async () => {
    if (!projectId) return;
    if (!useProjectDocumentDirtyStore.getState().dirty) return;
    setSaving(true);
    try {
      const pl = usePlannerStore.getState();
      const st = useStammdatenStore.getState();
      const snapshot: ProjectSnapshot = {
        kwList: pl.kwList,
        workItems: pl.workItems,
        mitarbeiter: st.mitarbeiter,
        stammdaten: {
          fachdienstBauteile: st.fachdienstBauteile,
          shiftConfig: st.shiftConfig,
          ...st.projectForm,
        },
      };
      await saveProjectSnapshot(projectId, snapshot);
      markClean();
      useUiStore.getState().showToast('Gespeichert');
    } catch (err) {
      useUiStore.getState().showToast(`Speichern fehlgeschlagen: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }, [projectId, markClean]); // eslint-disable-line react-hooks/exhaustive-deps

  return { loading, error, save, saving };
}

/**
 * When the user has unsaved edits, apply only the `intervalle` sections from
 * the incoming Firestore snapshot so CRON-written data is always visible
 * without clobbering in-progress user work on other sections.
 */
function mergeIntervalleOnly(current: WorkItems, incoming: WorkItems): WorkItems {
  const result: WorkItems = { ...current };
  const keys = new Set([...Object.keys(current), ...Object.keys(incoming)]);
  for (const key of keys) {
    const incomingCell = incoming[key];
    const hasIncomingIntervalle =
      !!incomingCell
      && Object.prototype.hasOwnProperty.call(incomingCell, 'intervalle');

    if (hasIncomingIntervalle) {
      result[key] = {
        ...(current[key] ?? {}),
        intervalle: Array.isArray(incomingCell?.intervalle) ? incomingCell.intervalle : [],
      };
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(current[key] ?? {}, 'intervalle')) {
      const rest = { ...(current[key] ?? {}) };
      delete rest.intervalle;
      if (Object.keys(rest).length > 0) result[key] = rest;
      else delete result[key];
    }
  }
  return result;
}

function pickStamForm(
  st: ProjectSnapshot['stammdaten'] | undefined,
): ProjectStamFormFields {
  if (!st) return { ...EMPTY_PROJECT_STAM_FORM };
  return {
    projektname: st.projektname ?? '',
    projektnummer: st.projektnummer ?? '',
    auftraggeber: st.auftraggeber ?? '',
    bauleiter: st.bauleiter ?? '',
    polier: st.polier ?? '',
    standort: st.standort ?? '',
    baubeginn: st.baubeginn ?? '',
    bauende: st.bauende ?? '',
  };
}
