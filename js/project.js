import { observeAuthState, signOutCurrentUser } from "./auth.js";
import { getProject, saveProjectData } from "./firestore-service.js";

const LOCAL_KEYS = ["stammdaten", "shiftConfig", "kwList", "workItems", "t_mitarbeiter"];

const DEFAULT_SNAPSHOT = {
  savedAt: "",
  stammdaten: {
    projektname: "",
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
};

const state = {
  projectId: null,
  projectDoc: null,
  user: null,
  lastSnapshotHash: "",
  saveTimer: null,
  saveInFlight: false,
  autosaveStarted: false,
};

const ui = {
  cloudSaveState: document.getElementById("cloudSaveState"),
  btnCloudSaveNow: document.getElementById("btnCloudSaveNow"),
  btnSignOutProject: document.getElementById("btnSignOutProject"),
  btnBackToDashboard: document.getElementById("btnBackToDashboard"),
};
const BOOTSTRAP_SESSION_KEY_PREFIX = "sp.bootstrapSnapshotHash.";
const BOOTSTRAP_RELOADED_PREFIX = "sp.bootstrapReloaded.";

function getProjectIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("projectId");
}

function setCloudState(message, isError = false) {
  if (!ui.cloudSaveState) return;
  ui.cloudSaveState.textContent = message || "";
  ui.cloudSaveState.style.color = isError ? "#FFB4B4" : "rgba(255,255,255,0.7)";
}

function parseJsonSafe(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function clearPlannerLocalStorage() {
  LOCAL_KEYS.forEach((key) => localStorage.removeItem(key));
}

function normalizeSnapshot(snapshot) {
  return {
    ...DEFAULT_SNAPSHOT,
    ...(snapshot || {}),
    stammdaten: {
      ...DEFAULT_SNAPSHOT.stammdaten,
      ...(snapshot?.stammdaten || {}),
    },
    shiftConfig: {
      ...DEFAULT_SNAPSHOT.shiftConfig,
      ...(snapshot?.shiftConfig || {}),
      tag: {
        ...DEFAULT_SNAPSHOT.shiftConfig.tag,
        ...(snapshot?.shiftConfig?.tag || {}),
      },
      nacht: {
        ...DEFAULT_SNAPSHOT.shiftConfig.nacht,
        ...(snapshot?.shiftConfig?.nacht || {}),
      },
    },
    tables: {
      mitarbeiter: snapshot?.tables?.mitarbeiter || [],
    },
    kwList: Array.isArray(snapshot?.kwList) ? snapshot.kwList : [],
    workItems: snapshot?.workItems && typeof snapshot.workItems === "object" ? snapshot.workItems : {},
  };
}

function extractSnapshotFromLocalStorage() {
  const snapshot = normalizeSnapshot({
    savedAt: state.projectDoc?.plannerData?.savedAt || "",
    stammdaten: parseJsonSafe(localStorage.getItem("stammdaten"), DEFAULT_SNAPSHOT.stammdaten),
    shiftConfig: parseJsonSafe(localStorage.getItem("shiftConfig"), DEFAULT_SNAPSHOT.shiftConfig),
    kwList: parseJsonSafe(localStorage.getItem("kwList"), []),
    tables: { mitarbeiter: parseJsonSafe(localStorage.getItem("t_mitarbeiter"), []) },
    workItems: parseJsonSafe(localStorage.getItem("workItems"), {}),
  });
  return snapshot;
}

function snapshotHash(snapshot) {
  const normalized = normalizeSnapshot(snapshot);
  // Avoid autosave loops from transient timestamp differences.
  normalized.savedAt = "";
  return JSON.stringify(normalized);
}

function snapshotLooksEmpty(snapshot) {
  const normalized = normalizeSnapshot(snapshot);
  const hasKw = (normalized.kwList || []).length > 0;
  const hasMitarbeiter = ((normalized.tables || {}).mitarbeiter || []).length > 0;
  const hasWorkItems = Object.keys(normalized.workItems || {}).length > 0;
  const hasStammdaten =
    Object.values(normalized.stammdaten || {}).some((v) => String(v || "").trim() !== "");
  return !hasKw && !hasMitarbeiter && !hasWorkItems && !hasStammdaten;
}

function snapshotFromProjectDoc(projectDoc) {
  if (projectDoc?.plannerData) return normalizeSnapshot(projectDoc.plannerData);

  const fallback = normalizeSnapshot();
  fallback.stammdaten = {
    ...fallback.stammdaten,
    projektname: projectDoc?.name || "",
    projektnummer: projectDoc?.overview?.projektnummer || "",
    auftraggeber: projectDoc?.overview?.auftraggeber || "",
    bauleiter: projectDoc?.overview?.bauleiter || "",
    polier: projectDoc?.overview?.polier || "",
    standort: projectDoc?.overview?.standort || "",
    baubeginn: projectDoc?.overview?.baubeginn || "",
    bauende: projectDoc?.overview?.bauende || "",
  };
  fallback.tables.mitarbeiter = projectDoc?.stammdaten?.personal || [];
  fallback.kwList = (projectDoc?.kalenderwochen || []).map((kw) => ({
    id: kw.id || `kw_${kw.year}_${String(kw.kw).padStart(2, "0")}`,
    label: `KW ${String(kw.kw).padStart(2, "0")} / ${kw.year}`,
    num: kw.kw,
    year: kw.year,
    dateFrom: kw.dateFrom || "",
    dateTo: kw.dateTo || "",
  }));
  return fallback;
}

function writeSnapshotToBootstrap(snapshot) {
  const normalized = normalizeSnapshot(snapshot);
  clearPlannerLocalStorage();
  localStorage.setItem("stammdaten", JSON.stringify(normalized.stammdaten));
  localStorage.setItem("shiftConfig", JSON.stringify(normalized.shiftConfig));
  localStorage.setItem("kwList", JSON.stringify(normalized.kwList));
  localStorage.setItem("workItems", JSON.stringify(normalized.workItems));
  localStorage.setItem("t_mitarbeiter", JSON.stringify(normalized.tables.mitarbeiter || []));

  const savedDataEl = document.getElementById("savedData");
  if (savedDataEl) {
    savedDataEl.textContent = JSON.stringify(normalized);
  }
}

function needsBootstrapReload(projectId, snapshot) {
  const reloadKey = `${BOOTSTRAP_RELOADED_PREFIX}${projectId}`;
  if (sessionStorage.getItem(reloadKey) === "1") return false;

  const key = `${BOOTSTRAP_SESSION_KEY_PREFIX}${projectId}`;
  const hash = snapshotHash(snapshot);
  const previous = sessionStorage.getItem(key);
  if (previous === hash) {
    sessionStorage.setItem(reloadKey, "1");
    return false;
  }
  sessionStorage.setItem(key, hash);
  sessionStorage.setItem(reloadKey, "1");
  return true;
}

function toFirestoreProjectPayload(snapshot, existingDoc) {
  const normalized = normalizeSnapshot(snapshot);
  const nameFromSnapshot = (normalized.stammdaten.projektname || "").trim();
  const projectName = nameFromSnapshot || existingDoc?.name || "Projekt";

  const overview = {
    projektnummer: normalized.stammdaten.projektnummer || "",
    auftraggeber: normalized.stammdaten.auftraggeber || "",
    bauleiter: normalized.stammdaten.bauleiter || "",
    polier: normalized.stammdaten.polier || "",
    standort: normalized.stammdaten.standort || "",
    baubeginn: normalized.stammdaten.baubeginn || "",
    bauende: normalized.stammdaten.bauende || "",
    shiftConfig: normalized.shiftConfig,
  };

  const kalenderwochen = normalized.kwList.map((kw) => ({
    id: kw.id,
    kw: kw.num,
    year: kw.year,
    dateFrom: kw.dateFrom || "",
    dateTo: kw.dateTo || "",
  }));

  return {
    name: projectName,
    schemaVersion: 1,
    overview,
    stammdaten: {
      personal: normalized.tables.mitarbeiter || [],
      inventar: existingDoc?.stammdaten?.inventar || [],
      material: existingDoc?.stammdaten?.material || [],
      fremdleistung: existingDoc?.stammdaten?.fremdleistung || [],
    },
    kalenderwochen,
    plannerData: normalized,
  };
}

async function persistNow() {
  if (!state.user || !state.projectId || state.saveInFlight) return;

  try {
    state.saveInFlight = true;
    setCloudState("Speichere ...");
    if (typeof window.flushOpenSDPTables === "function") {
      window.flushOpenSDPTables();
    }
    const snapshot = extractSnapshotFromLocalStorage();
    const hash = snapshotHash(snapshot);
    if (hash === state.lastSnapshotHash) {
      setCloudState("Alles gespeichert");
      return;
    }

    const existingSnapshot = normalizeSnapshot(state.projectDoc?.plannerData || {});
    if (snapshotLooksEmpty(snapshot) && !snapshotLooksEmpty(existingSnapshot)) {
      // Safety net: do not overwrite non-empty cloud data with accidental empty local state.
      writeSnapshotToBootstrap(existingSnapshot);
      state.lastSnapshotHash = snapshotHash(existingSnapshot);
      setCloudState("Leeren Stand verworfen, Cloud-Daten wiederhergestellt");
      return;
    }

    snapshot.savedAt = new Date().toISOString();

    const payload = toFirestoreProjectPayload(snapshot, state.projectDoc);
    await saveProjectData(state.projectId, payload);
    state.lastSnapshotHash = snapshotHash(snapshot);
    state.projectDoc = { ...(state.projectDoc || {}), ...payload };
    setCloudState("Gespeichert");
  } catch (error) {
    console.error("Cloud-Speichern fehlgeschlagen.", error);
    setCloudState("Speichern fehlgeschlagen", true);
  } finally {
    state.saveInFlight = false;
  }
}

function queueAutosave() {
  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
  }
  state.saveTimer = setTimeout(() => {
    persistNow();
  }, 1200);
}

function installDirtyHook() {
  if (state.autosaveStarted) return;
  const originalMarkDirty = window.markDirty;
  if (typeof originalMarkDirty !== "function") {
    setTimeout(installDirtyHook, 250);
    return;
  }
  if (originalMarkDirty._spCloudWrapped) {
    state.autosaveStarted = true;
    return;
  }
  const wrapped = function (...args) {
    const result = originalMarkDirty.apply(this, args);
    queueAutosave();
    return result;
  };
  wrapped._spCloudWrapped = true;
  window.markDirty = wrapped;
  state.autosaveStarted = true;
}

function bindUiEvents() {
  ui.btnCloudSaveNow?.addEventListener("click", () => {
    persistNow();
  });
  ui.btnSignOutProject?.addEventListener("click", async () => {
    await signOutCurrentUser();
    window.location.href = "index.html";
  });
  ui.btnBackToDashboard?.setAttribute("href", "index.html");
}

async function loadProjectForUser(user, projectId) {
  const project = await getProject(projectId);
  if (!project) throw new Error("Projekt wurde nicht gefunden.");
  if (project.ownerId !== user.uid) throw new Error("Kein Zugriff auf dieses Projekt.");

  state.projectDoc = project;
  const snapshot = snapshotFromProjectDoc(project);
  writeSnapshotToBootstrap(snapshot);
  if (needsBootstrapReload(projectId, snapshot)) {
    setCloudState("Lade Projektdaten ...");
    window.location.reload();
    return false;
  }
  state.lastSnapshotHash = snapshotHash(snapshot);
  setCloudState("Projekt geladen");
  return true;
}

function authGuard() {
  observeAuthState(async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    state.user = user;
    const projectId = getProjectIdFromQuery();
    if (!projectId) {
      window.location.href = "index.html";
      return;
    }
    state.projectId = projectId;

    try {
      const ready = await loadProjectForUser(user, projectId);
      if (!ready) return;
      bindUiEvents();
      installDirtyHook();
    } catch (error) {
      console.error(error);
      alert("Projekt konnte nicht geöffnet werden: " + error.message);
      window.location.href = "index.html";
    }
  });
}

window.addEventListener("beforeunload", () => {
  if (typeof window.flushOpenSDPTables === "function") {
    window.flushOpenSDPTables();
  }
});

authGuard();
