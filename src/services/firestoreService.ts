import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { extractProjectSnapshot } from '@/lib/mergeFirestoreSnapshot';
import type { Project, ProjectSnapshot } from '@/types';

const PROJECTS_COL = 'projects';

/**
 * Firestore rejects `undefined` anywhere in document data. Strip keys/elements
 * so saves never fail on optional TS fields (tasks, mitarbeiter, kwList, …).
 */
function stripUndefinedForFirestore<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((x) => x !== undefined)
      .map((x) => stripUndefinedForFirestore(x)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = stripUndefinedForFirestore(v);
  }
  return out as T;
}

// ─── List projects owned by a user ─────────────────────────────────────────

export async function listUserProjects(uid: string): Promise<Project[]> {
  const q = query(collection(db, PROJECTS_COL), where('ownerId', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project);
}

// ─── Create a new project ───────────────────────────────────────────────────

export async function createProject(name: string, uid: string): Promise<Project> {
  const data = {
    name,
    ownerId: uid,
    createdAt: new Date().toISOString(),
    snapshot: {
      kwList: [],
      workItems: {},
      mitarbeiter: [],
      stammdaten: {
        fachdienstBauteile: {},
        shiftConfig: { tag: { von: '07:00', bis: '19:00' }, nacht: { von: '19:00', bis: '07:00' } },
        projektname: name,
        projektnummer: '',
        auftraggeber: '',
        bauleiter: '',
        polier: '',
        standort: '',
        baubeginn: '',
        bauende: '',
      },
    } satisfies ProjectSnapshot,
  };
  const ref = await addDoc(collection(db, PROJECTS_COL), data);
  return { id: ref.id, ...data };
}

// ─── Load a project ─────────────────────────────────────────────────────────

function docToProject(docId: string, d: Record<string, unknown>): Project {
  const cr = d.createdAt;
  const createdAt =
    typeof cr === 'string'
      ? cr
      : cr instanceof Timestamp
        ? cr.toDate().toISOString()
        : new Date().toISOString();
  return {
    id: docId,
    name: String(d.name ?? 'Projekt'),
    ownerId: String(d.ownerId ?? ''),
    createdAt,
    snapshot: extractProjectSnapshot(d),
  } as Project;
}

export async function loadProject(projectId: string): Promise<Project | null> {
  const ref = doc(db, PROJECTS_COL, projectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return docToProject(snap.id, snap.data() as Record<string, unknown>);
}

/**
 * Subscribe to project document updates (same merge rules as {@link loadProject}).
 * Caller should avoid applying updates while local edits are dirty.
 */
export function subscribeProject(
  projectId: string,
  onProject: (project: Project | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const ref = doc(db, PROJECTS_COL, projectId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onProject(null);
        return;
      }
      onProject(docToProject(snap.id, snap.data() as Record<string, unknown>));
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  );
}

// ─── Save project snapshot ──────────────────────────────────────────────────

export async function saveProjectSnapshot(
  projectId: string,
  snapshot: ProjectSnapshot,
): Promise<void> {
  const ref = doc(db, PROJECTS_COL, projectId);
  const snapshotClean = stripUndefinedForFirestore(snapshot) as ProjectSnapshot;
  await setDoc(ref, { snapshot: snapshotClean, updatedAt: serverTimestamp() }, { merge: true });
}

// ─── Delete a project ───────────────────────────────────────────────────────

export async function deleteProject(projectId: string): Promise<void> {
  await deleteDoc(doc(db, PROJECTS_COL, projectId));
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert Firestore Timestamp to ISO string if needed */
export function normalizeTimestamp(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return '';
}
