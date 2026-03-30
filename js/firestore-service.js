import {
  arrayUnion,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { db } from "./firebase-init.js";

const PROJECTS_COLLECTION = "projects";
const USERS_COLLECTION = "users";

function projectsCollection() {
  return collection(db, PROJECTS_COLLECTION);
}

function defaultProjectPayload(ownerId, name) {
  return {
    ownerId,
    memberIds: [ownerId],
    name: name || "Neues Projekt",
    schemaVersion: 1,
    overview: {},
    stammdaten: {
      personal: [],
      inventar: [],
      material: [],
      fremdleistung: [],
    },
    kalenderwochen: [],
    plannerData: {
      savedAt: "",
      stammdaten: {
        projektname: name || "",
        projektnummer: "",
        auftraggeber: "",
        bauleiter: "",
        polier: "",
        standort: "",
        baubeginn: "",
        bauende: "",
      },
      shiftConfig: {
        tag: { von: "07:00", bis: "19:00" },
        nacht: { von: "19:00", bis: "07:00" },
      },
      kwList: [],
      tables: { mitarbeiter: [] },
      workItems: {},
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function createProject(ownerId, name) {
  const payload = defaultProjectPayload(ownerId, name);
  const created = await addDoc(projectsCollection(), payload);
  return created.id;
}

export async function listProjects(ownerId) {
  const byMembershipQuery = query(projectsCollection(), where("memberIds", "array-contains", ownerId));
  const byOwnerQuery = query(projectsCollection(), where("ownerId", "==", ownerId));
  const [membershipSnap, ownerSnap] = await Promise.all([getDocs(byMembershipQuery), getDocs(byOwnerQuery)]);
  const merged = new Map();
  membershipSnap.docs.forEach((projectDoc) => {
    merged.set(projectDoc.id, { id: projectDoc.id, ...projectDoc.data() });
  });
  ownerSnap.docs.forEach((projectDoc) => {
    merged.set(projectDoc.id, { id: projectDoc.id, ...projectDoc.data() });
  });
  return Array.from(merged.values());
}

export async function getProject(projectId) {
  const ref = doc(db, PROJECTS_COLLECTION, projectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function saveProjectData(projectId, payload) {
  const ref = doc(db, PROJECTS_COLLECTION, projectId);
  await updateDoc(ref, {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

export async function ensureUserProfile(user) {
  if (!user?.uid) return;
  const ref = doc(db, USERS_COLLECTION, user.uid);
  await setDoc(
    ref,
    {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function listRegisteredUsers() {
  const snap = await getDocs(collection(db, USERS_COLLECTION));
  return snap.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() }));
}

export async function addProjectMember(projectId, userId) {
  const ref = doc(db, PROJECTS_COLLECTION, projectId);
  await updateDoc(ref, {
    memberIds: arrayUnion(userId),
    updatedAt: serverTimestamp(),
  });
}
