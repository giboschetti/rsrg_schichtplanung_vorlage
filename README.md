# RSRG Schichtplanung — Vorlage

Offline-fähige **Schichtplanung** als statische Web-App (Tabulator, Timeline, Export XLSX/PDF).  
Dieses Repository enthält den **Quellcode in mehreren Dateien**; die Arbeitskopie mit Projektdaten ist weiterhin **eine einzelne HTML-Datei**.

## Struktur

| Pfad | Inhalt |
|------|--------|
| `index.html` | Shell, eingebetteter leerer Daten-Block `#savedData` |
| `css/styles.css` | Layout & Komponenten |
| `js/app.js` | Anwendungslogik |
| `_build_from_monolith.py` | Optional: erneute Aufteilung aus `../schichtplanung.html` |

## Nutzung

1. **Entwicklung / Team-Vorlage:** Repository klonen oder ZIP laden, `index.html` über einen **lokalen HTTP-Server** oder **GitHub Pages** öffnen (nicht alle Browser erlauben `fetch` zu `css`/`js` von `file://`).
2. **Einzeldatei für die Baustelle:** In der App **„Datei speichern“** wählen — es wird eine **eine HTML-Datei** erzeugt, in der Styles, Skript und Daten eingebettet sind (wie bisher portabel per E-Mail/SharePoint).

> **Hinweis:** Speichern als Einzeldatei aus dem Multi-File-Setup setzt voraus, dass `css/styles.css` und `js/app.js` per `fetch` erreichbar sind (z. B. `https://…` auf GitHub Pages oder `http://localhost:…`).

## GitHub Pages

Repository **Settings → Pages → Build and deployment**: Branch **main**, Ordner **/** (root). Die App liegt dann unter `https://<user>.github.io/rsrg_schichtplanung_vorlage/`.

## Abhängigkeiten (CDN)

Fonts, Tabulator, SheetJS, jsPDF werden wie in der Vorlage von öffentlichen CDNs geladen; Offline-Nutzung der **gespeicherten Einzeldatei** funktioniert nur mit Netzwerk für diese Bibliotheken (gleiches Verhalten wie die ursprüngliche Monolith-HTML).
