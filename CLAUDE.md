# Claude Code — schichtplanung_vorlage

Web-based shift planning (“Schichtplanung”) for Rhomberg Sersa Rail Group: weekly schedules, Firebase-backed projects, exports (e.g. XLSX/PDF).

**Stack:** React + Vite (`src/`). The former vanilla `js/` + `project.html` planner was retired; Firebase Hosting serves `npm run build` output (`dist/`).

## Agent skills

### Issue tracker

GitHub Issues on this repo; use `gh` for create/list/edit/labels. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical roles map 1:1 to GitHub label names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `CONTEXT.md` and `docs/adr/` when present. See `docs/agents/domain.md`.
