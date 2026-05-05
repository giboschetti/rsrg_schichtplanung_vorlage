import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
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

export async function loadProject(projectId: string): Promise<Project | null> {
  const ref = doc(db, PROJECTS_COL, projectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  const cr = d.createdAt;
  const createdAt =
    typeof cr === 'string'
      ? cr
      : cr instanceof Timestamp
        ? cr.toDate().toISOString()
        : new Date().toISOString();
  return {
    id: snap.id,
    name: String(d.name ?? 'Projekt'),
    ownerId: String(d.ownerId ?? ''),
    createdAt,
    snapshot: extractProjectSnapshot(d),
  } as Project;
}

// ─── Real-time section-level writes ─────────────────────────────────────────
//
// Each function writes exactly one field path. CRON automation owns
// `snapshot.workItems.<key>.intervalle`; the React app owns everything else.
// Write authority is structural — no runtime coordination needed.

export async function writeCellSection(
  projectId: string,
  cellKey: string,
  section: string,
  items: unknown[],
): Promise<void> {
  const ref = doc(db, PROJECTS_COL, projectId);
  await updateDoc(ref, {
    [`snapshot.workItems.${cellKey}.${section}`]: stripUndefinedForFirestore(items),
    updatedAt: serverTimestamp(),
  });
}

export async function writeKwList(
  projectId: string,
  kwList: unknown[],
): Promise<void> {
  const ref = doc(db, PROJECTS_COL, projectId);
  await updateDoc(ref, {
    'snapshot.kwList': stripUndefinedForFirestore(kwList),
    updatedAt: serverTimestamp(),
  });
}

export async function writeStammdaten(
  projectId: string,
  stammdaten: unknown,
): Promise<void> {
  const ref = doc(db, PROJECTS_COL, projectId);
  await updateDoc(ref, {
    'snapshot.stammdaten': stripUndefinedForFirestore(stammdaten),
    updatedAt: serverTimestamp(),
  });
}

export async function writeMitarbeiter(
  projectId: string,
  mitarbeiter: unknown[],
): Promise<void> {
  const ref = doc(db, PROJECTS_COL, projectId);
  await updateDoc(ref, {
    'snapshot.mitarbeiter': stripUndefinedForFirestore(mitarbeiter),
    updatedAt: serverTimestamp(),
  });
}

// ─── Subscribe to real-time project updates ─────────────────────────────────

export function subscribeToProject(
  projectId: string,
  onData: (project: Project) => void,
  onError: (err: Error) => void,
): () => void {
  const ref = doc(db, PROJECTS_COL, projectId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onError(new Error('Projekt nicht gefunden'));
        return;
      }
      const d = snap.data() as Record<string, unknown>;
      const cr = d.createdAt;
      const createdAt =
        typeof cr === 'string'
          ? cr
          : cr instanceof Timestamp
            ? cr.toDate().toISOString()
            : new Date().toISOString();
      onData({
        id: snap.id,
        name: String(d.name ?? 'Projekt'),
        ownerId: String(d.ownerId ?? ''),
        createdAt,
        snapshot: extractProjectSnapshot(d),
      } as Project);
    },
    onError,
  );
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
