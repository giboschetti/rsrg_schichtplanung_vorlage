import { useEffect, useState } from 'react';
import { subscribeToProject } from '@/services/firestoreService';
import { usePlannerStore } from '@/stores/plannerStore';
import { useStammdatenStore, DEFAULT_SHIFT_CONFIG } from '@/stores/stammdatenStore';
import type { ProjectStamFormFields, ProjectSnapshot } from '@/types';
import { EMPTY_PROJECT_STAM_FORM } from '@/types';

interface UseProjectReturn {
  loading: boolean;
  error: string | null;
}

export function useProject(projectId: string | undefined): UseProjectReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setProject = usePlannerStore((s) => s.setProject);
  const setKwList = usePlannerStore((s) => s.setKwList);
  const setWorkItems = usePlannerStore((s) => s.setWorkItems);

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
            setLoading(false);
          } else if (snap) {
            // Live update from Firestore (e.g. CRON writing intervalle).
            // Always apply a full refresh — write authority is structural:
            // CRON owns `intervalle` fields, React owns everything else.
            // No dirty check or merge logic needed.
            setKwList(snap.kwList ?? []);
            setWorkItems(snap.workItems ?? {});
            setMitarbeiter(snap.mitarbeiter ?? []);
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

  return { loading, error };
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
