import { useCallback, useEffect, useState } from 'react';
import { loadProject, saveProjectSnapshot } from '@/services/firestoreService';
import { usePlannerStore } from '@/stores/plannerStore';
import { useStammdatenStore, DEFAULT_SHIFT_CONFIG } from '@/stores/stammdatenStore';
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
  const kwList = usePlannerStore((s) => s.kwList);
  const workItems = usePlannerStore((s) => s.workItems);

  const setFachdienstBauteile = useStammdatenStore((s) => s.setFachdienstBauteile);
  const setShiftConfig = useStammdatenStore((s) => s.setShiftConfig);
  const setProjectForm = useStammdatenStore((s) => s.setProjectForm);
  const setMitarbeiter = useStammdatenStore((s) => s.setMitarbeiter);
  const fachdienstBauteile = useStammdatenStore((s) => s.fachdienstBauteile);
  const shiftConfig = useStammdatenStore((s) => s.shiftConfig);
  const projectForm = useStammdatenStore((s) => s.projectForm);
  const mitarbeiter = useStammdatenStore((s) => s.mitarbeiter);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

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

      try {
        const project = await loadProject(projectId);
        if (cancelled) return;
        if (!project) {
          setError('Projekt nicht gefunden');
          return;
        }
        setProject(project.id, project.name);
        const snap = project.snapshot;
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
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const snapshot: ProjectSnapshot = {
        kwList,
        workItems,
        mitarbeiter,
        stammdaten: {
          fachdienstBauteile,
          shiftConfig,
          ...projectForm,
        },
      };
      await saveProjectSnapshot(projectId, snapshot);
      markClean();
    } finally {
      setSaving(false);
    }
  }, [projectId, kwList, workItems, fachdienstBauteile, shiftConfig, projectForm, mitarbeiter, markClean]);

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
