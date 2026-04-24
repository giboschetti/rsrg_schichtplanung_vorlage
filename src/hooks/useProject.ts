import { useCallback, useEffect, useState } from 'react';
import { loadProject, saveProjectSnapshot } from '@/services/firestoreService';
import { usePlannerStore } from '@/stores/plannerStore';
import { useStammdatenStore } from '@/stores/stammdatenStore';
import type { ProjectSnapshot } from '@/types';

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
  const fachdienstBauteile = useStammdatenStore((s) => s.fachdienstBauteile);
  const shiftConfig = useStammdatenStore((s) => s.shiftConfig);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    loadProject(projectId)
      .then((project) => {
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
        }
        markClean();
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const snapshot: ProjectSnapshot = {
        kwList,
        workItems,
        stammdaten: { fachdienstBauteile, shiftConfig },
      };
      await saveProjectSnapshot(projectId, snapshot);
      markClean();
    } finally {
      setSaving(false);
    }
  }, [projectId, kwList, workItems, fachdienstBauteile, shiftConfig, markClean]);

  return { loading, error, save, saving };
}
