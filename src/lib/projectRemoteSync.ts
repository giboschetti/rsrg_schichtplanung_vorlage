/**
 * Pure rules for Firestore ↔ in-memory planner state (no React).
 * Keeps subscription/loading in the hook; merge policy is testable here.
 */

import type {
  FachdienstBauteile,
  KalenderWoche,
  MitarbeiterRow,
  Project,
  ProjectSnapshot,
  ProjectStamFormFields,
  ShiftConfig,
  WorkItems,
} from '@/types';
import { EMPTY_PROJECT_STAM_FORM } from '@/types';

// ─── Remote snapshot → UI (subscriber) ─────────────────────────────────────

/** Outcome for one Firestore document update vs current dirty flag */
export type RemoteApplyResult =
  | { kind: 'not_found' }
  | {
      /** User has unsaved edits: only Intervalle refresh from BAB sync cron */
      kind: 'dirty_partial';
      workItemsPatch?: WorkItems;
    }
  | {
      kind: 'full_replace';
      projectId: string;
      projectName: string;
      kwList: KalenderWoche[];
      workItems: WorkItems;
      fachdienstBauteile: FachdienstBauteile;
      /** When `skip`, leave stammdaten store shift times unchanged (snapshot had no shiftConfig). */
      applyShiftConfig: { mode: 'default' } | { mode: 'skip' } | { mode: 'value'; value: ShiftConfig };
      projectForm: ProjectStamFormFields;
      mitarbeiter: MitarbeiterRow[];
    };

/** Merge BAB-written intervalle cells from remote without touching local sections. */
export function mergeIntervalleOnly(current: WorkItems, remote: WorkItems): WorkItems {
  const merged: WorkItems = { ...current };
  for (const [key, remoteCell] of Object.entries(remote)) {
    const localCell = merged[key] ?? {};
    /** Firestore payloads may omit `intervalle`; never replace with `[]` unless the key is present. */
    const hasExplicitIntervalle =
      remoteCell !== null &&
      typeof remoteCell === 'object' &&
      Object.prototype.hasOwnProperty.call(remoteCell, 'intervalle');
    if (!hasExplicitIntervalle) continue;
    merged[key] = {
      ...localCell,
      intervalle: remoteCell.intervalle ?? [],
    } as WorkItems[string];
  }
  return merged;
}

/**
 * Decide what to apply after a Firestore snapshot for this project doc.
 *
 * When `dirty` is true we only patch `intervalle` from remote (sync cron — not user-editable).
 * Otherwise we replace KW list, cells, Stammdaten, Kontakte — then caller should clear dirty.
 */
export function computeRemoteApply(
  project: Project | null,
  dirty: boolean,
  currentWorkItems: WorkItems,
): RemoteApplyResult {
  if (!project) {
    return { kind: 'not_found' };
  }

  const snap = project.snapshot;

  if (dirty) {
    // Always merge Intervalle fields when dirty (never skip: missing `snapshot.workItems` would
    // silently block BAB/cron updates). Partial Firestore payloads may omit sibling sections.
    const remoteWi = snap?.workItems ?? {};
    return {
      kind: 'dirty_partial',
      workItemsPatch: mergeIntervalleOnly(currentWorkItems, remoteWi),
    };
  }

  if (snap) {
    return {
      kind: 'full_replace',
      projectId: project.id,
      projectName: project.name,
      kwList: snap.kwList ?? [],
      workItems: snap.workItems ?? {},
      fachdienstBauteile: snap.stammdaten?.fachdienstBauteile ?? {},
      applyShiftConfig: snap.stammdaten?.shiftConfig
        ? { mode: 'value' as const, value: snap.stammdaten.shiftConfig }
        : { mode: 'skip' as const },
      projectForm: {
        ...EMPTY_PROJECT_STAM_FORM,
        ...stamFormFieldsFromSnapshot(snap.stammdaten),
      },
      mitarbeiter: snap.mitarbeiter ?? [],
    };
  }

  return {
    kind: 'full_replace',
    projectId: project.id,
    projectName: project.name,
    kwList: [],
    workItems: {},
    fachdienstBauteile: {},
    applyShiftConfig: { mode: 'default' },
    projectForm: { ...EMPTY_PROJECT_STAM_FORM },
    mitarbeiter: [],
  };
}

export function stamFormFieldsFromSnapshot(
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

// ─── Save → Firestore ────────────────────────────────────────────────────────

export function buildProjectSnapshotForSave(args: {
  kwList: KalenderWoche[];
  workItems: WorkItems;
  mitarbeiter: MitarbeiterRow[];
  fachdienstBauteile: FachdienstBauteile;
  shiftConfig: ShiftConfig;
  projectForm: ProjectStamFormFields;
}): ProjectSnapshot {
  return {
    kwList: args.kwList,
    workItems: args.workItems,
    mitarbeiter: args.mitarbeiter,
    stammdaten: {
      fachdienstBauteile: args.fachdienstBauteile,
      shiftConfig: args.shiftConfig,
      ...args.projectForm,
    },
  };
}
