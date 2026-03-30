import {
  getCurrentUser,
  observeAuthState,
  signInWithGoogle,
  signOutCurrentUser,
} from "./auth.js";
import { createProject, ensureUserProfile, listProjects } from "./firestore-service.js";

const ui = {
  userLabel: document.getElementById("authUserLabel"),
  btnSignIn: document.getElementById("btnSignIn"),
  btnSignOut: document.getElementById("btnSignOut"),
  btnCreateProject: document.getElementById("btnCreateProject"),
  newProjectName: document.getElementById("newProjectName"),
  projectsList: document.getElementById("projectsList"),
  status: document.getElementById("dashboardStatus"),
};

function setStatus(message, isError = false) {
  if (!ui.status) return;
  ui.status.textContent = message || "";
  ui.status.classList.toggle("dashboard-status-error", Boolean(isError));
}

function formatDate(value) {
  if (!value) return "—";
  if (value.toDate) return value.toDate().toLocaleString("de-CH");
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("de-CH");
}

function toTimestamp(value) {
  if (!value) return 0;
  if (value.toDate) return value.toDate().getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderProjects(projects) {
  if (!ui.projectsList) return;
  if (!projects.length) {
    ui.projectsList.innerHTML =
      '<div class="project-row"><div class="project-meta"><strong>Noch keine Projekte.</strong><span>Erstelle dein erstes Projekt oben.</span></div></div>';
    return;
  }

  ui.projectsList.innerHTML = projects
    .map((project) => {
      const safeName = escapeHtml(project.name || "Ohne Namen");
      const updated = formatDate(project.updatedAt);
      return `
        <div class="project-row">
          <div class="project-meta">
            <strong>${safeName}</strong>
            <span>Zuletzt geändert: ${escapeHtml(updated)}</span>
          </div>
          <a class="btn btn-accent" href="project.html?projectId=${project.id}">Öffnen</a>
        </div>
      `;
    })
    .join("");
}

async function refreshProjects() {
  const user = getCurrentUser();
  if (!user) {
    renderProjects([]);
    return;
  }

  setStatus("Lade Projekte ...");
  try {
    const projects = await listProjects(user.uid);
    projects.sort((a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt));
    renderProjects(projects);
    setStatus("");
  } catch (error) {
    console.error("Projektliste konnte nicht geladen werden.", error);
    const details = error?.message ? ` (${error.message})` : "";
    setStatus(`Projektliste konnte nicht geladen werden.${details}`, true);
  }
}

async function handleCreateProject() {
  const user = getCurrentUser();
  if (!user) {
    setStatus("Bitte zuerst anmelden.", true);
    return;
  }
  const name = (ui.newProjectName?.value || "").trim();
  if (!name) {
    setStatus("Bitte einen Projektnamen eingeben.", true);
    return;
  }

  setStatus("Projekt wird erstellt ...");
  try {
    const projectId = await createProject(user.uid, name);
    window.location.href = `project.html?projectId=${projectId}`;
  } catch (error) {
    console.error("Projekt konnte nicht erstellt werden.", error);
    setStatus("Projekt konnte nicht erstellt werden.", true);
  }
}

function bindEvents() {
  ui.btnSignIn?.addEventListener("click", async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Anmeldung fehlgeschlagen.", error);
      setStatus("Google-Anmeldung fehlgeschlagen.", true);
    }
  });

  ui.btnSignOut?.addEventListener("click", async () => {
    try {
      await signOutCurrentUser();
    } catch (error) {
      console.error("Abmeldung fehlgeschlagen.", error);
      setStatus("Abmeldung fehlgeschlagen.", true);
    }
  });

  ui.btnCreateProject?.addEventListener("click", handleCreateProject);
  ui.newProjectName?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleCreateProject();
    }
  });
}

function updateAuthUi(user) {
  ui.btnSignIn?.classList.toggle("hidden", Boolean(user));
  ui.btnSignOut?.classList.toggle("hidden", !user);
  if (ui.userLabel) {
    ui.userLabel.textContent = user ? `${user.displayName || "Benutzer"} (${user.email || ""})` : "";
  }
}

function initDashboard() {
  bindEvents();
  observeAuthState(async (user) => {
    updateAuthUi(user);
    if (!user) {
      renderProjects([]);
      setStatus("Bitte mit Google anmelden.");
      return;
    }
    await ensureUserProfile(user);
    await refreshProjects();
  });
}

initDashboard();
