# RSRG Schichtplanung — Vorlage

Web-basierte **Schichtplanung** mit Firebase Authentication + Firestore für mehrere Projekte.

## Struktur

| Pfad | Inhalt |
|------|--------|
| `index.html` | Dashboard (Login, Projektliste, Projekt erstellen) |
| `project.html` | Planungs-Workspace (bestehende UI/Logik inkl. Bulk-Add) |
| `css/styles.css` | Layout & Komponenten |
| `js/app.js` | Bestehende Planungslogik (UI, Timeline, Bulk-Add, Export, lokale Snapshot-Logik) |
| `js/firebase-init.js` | Firebase App/Auth/Firestore Initialisierung |
| `js/auth.js` | Google Auth + Auth State |
| `js/firestore-service.js` | Firestore CRUD für Projekte |
| `js/dashboard.js` | Dashboard-Interaktionen |
| `js/project.js` | Projektladen/-speichern (Firestore ↔ bestehende Planner-Daten) |
| `firestore.rules` | Empfohlene Start-Regeln (Single-Owner-Projekte) |
| `_build_from_monolith.py` | Optional: erneute Aufteilung aus `../schichtplanung.html` |

## Nutzung

1. `index.html` über lokalen HTTP-Server oder Hosting öffnen.
2. Mit Google anmelden.
3. Projekt erstellen oder bestehendes Projekt öffnen.
4. Planung in `project.html` bearbeiten (Autosave + manuelles Cloud-Speichern).
5. Optional weiterhin „Datei speichern“ / XLSX / PDF aus dem Planner verwenden.

> **Hinweis:** Standalone-HTML-Export bleibt kompatibel und arbeitet weiterhin auf Basis der bestehenden Planungslogik.

## GitHub Pages

Repository **Settings → Pages → Build and deployment**: Branch **main**, Ordner **/** (root). Die App liegt dann unter `https://<user>.github.io/rsrg_schichtplanung_vorlage/`.

## Abhängigkeiten (CDN)

Fonts, Tabulator, SheetJS, jsPDF werden wie in der Vorlage von öffentlichen CDNs geladen; Offline-Nutzung der **gespeicherten Einzeldatei** funktioniert nur mit Netzwerk für diese Bibliotheken (gleiches Verhalten wie die ursprüngliche Monolith-HTML).
