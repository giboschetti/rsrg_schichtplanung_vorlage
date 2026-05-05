# RSRG Schichtplanung — Vorlage

Web-basierte **Schichtplanung** mit Firebase Authentication + Firestore für mehrere Projekte.  
**Aktueller Stack:** React 19, Vite 6, TypeScript, TanStack Table, Zustand, Tailwind CSS v4.

## Struktur

| Pfad | Inhalt |
|------|--------|
| `src/` | React-App (Dashboard, Planner, Firestore, Exporte) |
| `index.html` | Vite-Einstieg → `/src/main.tsx` |
| `vite.config.ts` / `tsconfig.*` | Build & Aliase (`@` → `src`) |
| `firebase.json` | Hosting: `dist/` (nach `npm run build`) |
| `firestore.rules` | Empfohlene Start-Regeln (Single-Owner-Projekte) |
| `_build_from_monolith.py` | **Veraltet** — beendet mit Fehlcode (historisches Monolith-Split-Skript) |

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Öffnet die App mit Hot-Reload (Standard: http://localhost:5173).

## Produktion / Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

`firebase.json` liefert `dist/` aus und leitet SPA-Routes auf `index.html` um (`**` → `/index.html`).

## Daten & Auth

Projektdaten liegen in Firestore unter `projects/{projectId}`; Login über Google (Firebase Auth).  
Details zur Domäne: `CLAUDE.md` und `docs/agents/domain.md`.

## GitHub Pages (optional)

Repository **Settings → Pages**: Branch mit dem gebauten `dist`-Inhalt deployen oder CI bauen lassen — die **Quelle der Wahrheit** ist die Vite-Ausgabe, nicht mehr statische Legacy-HTML-Dateien.

## Archiv-Hinweise

- Ein eingefrorenes Standalone-Beispiel kann unter `assets/` liegen (ältere Einzeldatei-Exports mit eingeblendeter alter Logik).
