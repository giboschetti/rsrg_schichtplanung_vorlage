import { useCallback, useEffect, useState } from 'react';
import { saveProjectSnapshot, subscribeProject } from '@/services/firestoreService';
import { usePlannerStore } from '@/stores/plannerStore';
import { useStammdatenStore, DEFAULT_SHIFT_CONFIG } from '@/stores/stammdatenStore';
import { useUiStore } from '@/stores/uiStore';
import type { ProjectStamFormFields, ProjectSnapshot } from '@/types';
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
  const markClean = usePlannerStore((s) => s.markClean);

  const setFachdienstBauteile = useStammdatenStore((s) => s.setFachdienstBauteile);
  const setShiftConfig = useStammdatenStore((s) => s.setShiftConfig);
  const setProjectForm = useStammdatenStore((s) => s.setProjectForm);
  const setMitarbeiter = useStammdatenStore((s) => s.setMitarbeiter);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsub: (() => void) | undefined;

    setError(null);
    setLoading(true);

    const persistKey = `p-${projectId}`;

    void (async () => {
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

      unsub = subscribeProject(
        projectId,
        (project) => {
          if (cancelled) return;
          if (!project) {
            setError('Projekt nicht gefunden');
            setLoading(false);
            return;
          }
          const snap = project.snapshot;
          if (usePlannerStore.getState().dirty) {
            // Intervalle are written by the BAB sync cron and are not user-editable.
            // Always refresh them from Firestore even when the planner has unsaved edits.
            if (snap?.workItems) {
              const current = usePlannerStore.getState().workItems;
              const merged = { ...current };
              for (const [key, cell] of Object.entries(snap.workItems)) {
                merged[key] = { ...merged[key], intervalle: cell.intervalle ?? [] };
              }
              setWorkItems(merged);
            }
            setLoading(false);
            return;
          }
          setError(null);
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
        },
        (err) => {
          if (cancelled) return;
          setError(String(err));
          setLoading(false);
        },
      );
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async () => {
    if (!projectId) return;
    if (!usePlannerStore.getState().dirty) return;
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
  }, [projectId, markClean]);

  return { loading, error, save, saving };
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
