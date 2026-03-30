import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { db } from "./firebase-init.js";

const PROJECTS_COLLECTION = "projects";

function projectsCollection() {
  return collection(db, PROJECTS_COLLECTION);
}

function defaultProjectPayload(ownerId, name) {
  return {
    ownerId,
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
  const q = query(projectsCollection(), where("ownerId", "==", ownerId));
  const snap = await getDocs(q);
  return snap.docs.map((projectDoc) => ({ id: projectDoc.id, ...projectDoc.data() }));
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
