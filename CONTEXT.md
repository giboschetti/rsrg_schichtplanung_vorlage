# Schichtplanung

Shift-planning tool for Rhomberg Sersa Rail Group. Planners assign resources to shift cells across calendar weeks; the result is exported as XLSX or PDF for site operations.

## Language

**Shift Cell**:
The primary planning unit — the intersection of a calendar week, a day (Mon–Sun), and a shift (Tag or Nacht).
_Avoid_: slot, entry, cell (too generic)

**Resource**:
Anything a planner assigns to a Shift Cell — personnel, tasks, equipment, or Intervalle.
_Avoid_: item, entry

**BAB** (Betriebliche Anordnung Bau):
A client-issued document authorising specific track interdiction windows for construction work. Describes individual track blockages (start/end times) and electrical cable states. A Projekt typically has hundreds of BABs. The source of truth for what track access is available on any given shift. BABs and Tätigkeiten are independent — a BAB may exist with no planned tasks, and a task may exist without a BAB. Their only relationship is co-presence on the same Shift Cell.
_Avoid_: track order, construction order
_Note_: `babNr` on `TaskItem` in the code is obsolete — BABs and Tätigkeiten should not be directly linked.

**Intervall** (pl. Intervalle):
A track interdiction window for a given shift. Two kinds exist with different write authorities:
1. **BAB-derived Intervall** — extracted from a BAB document by CRON automation. Status values reflect the BAB version: `Entwurf` (draft), `Änderung` (revision), `Verständigt` (client-notified). Written to Shift Cells automatically; read-only in the React UI.
2. **Zusätzlicher Bedarf** — a planner-authored request for an additional track interdiction not yet covered by any BAB. Used to formally request new windows from the client (e.g. as a PDF attachment). Currently unimplemented as a UI input; a proposed solution is to make it a separate section in the timeline grid rather than mixing it with CRON-written Intervalle.
_Avoid_: interval, schedule entry, track window

**Tag / Nacht**:
The two shift variants within a day. Every Shift Cell belongs to exactly one.
_Avoid_: day shift / night shift (use the German terms to match the codebase)

### Project & time structure

**Projekt**:
A single physical construction site. Has a name, number, client (Auftraggeber), site manager (Bauleiter), Polier, location (Standort), and date range (Baubeginn/Bauende). Planners switch between Projekte on the dashboard. Archiving a finished Projekt is planned but not yet implemented.
_Avoid_: project (use as code alias only), contract, assignment

**Kalenderwochen** (sing. Kalenderwoche, KW):
The time axis of a Projekt. A planner adds KWs to a Projekt; each KW contains seven days × two shifts (Tag/Nacht) = 14 Shift Cells.
_Avoid_: week, calendar week (use the German term)

**Stammdaten**:
Per-Projekt master data that define planning boundaries and key contacts. Contains: the Bauteil catalogue per Fachdienst (FachdienstBauteile), the Kontaktliste, shift start/end times (Schichtkonfiguration), and the Projekt's own metadata fields (name, number, Auftraggeber, Bauleiter, Polier, Standort, dates). Used to populate dropdowns and to supply contact details for PDF export.
_Avoid_: master data (use the German term)

**Kontaktliste**:
A curated list of important contacts for a Projekt (e.g. client Bauleiter, emergency contacts, key subcontractors). Lives in Stammdaten. Distinct from the Personal entries in Shift Cells — Kontaktliste is for reference and PDF export, not for shift planning. Some planned personnel may optionally appear here, but most will not.
_Avoid_: Mitarbeiterliste (the code uses this name but it's misleading — these are contacts, not all workers)

**FachdienstBauteile**:
The per-Projekt catalogue that maps each Fachdienst to its available Bauteile. Defines what Bauteil options appear in dropdowns when adding a Tätigkeit. The Fachdienst list itself is stable across Projekte; the Bauteile within each are defined per Projekt in Stammdaten.

**Schichtkonfiguration**:
Per-Projekt start and end times (von/bis) for each shift (Tag and Nacht). Default: Tag 07:00–19:00, Nacht 19:00–07:00.
_Avoid_: shiftConfig (use as code alias only)

### Resource types

**Tätigkeit** (pl. Tätigkeiten):
A construction schedule item filed under a Fachdienst → Bauteil hierarchy with a free-text title, optional description, location (Bereich/Ort), status, and notes.
_Avoid_: task (use as code alias only)

**Fachdienst**:
A railway construction service department. Tätigkeiten are grouped under one. Fixed vocabulary: `FB`, `IB/TB`, `FL`, `SAZ`, `KAB`, `Andere`.
_Avoid_: department, service

**Bauteil**:
A construction component within a Fachdienst. Each Fachdienst has its own Bauteile; each Bauteil contains multiple Tätigkeiten.
_Avoid_: component, element

**Personal** (entry: Personaleintrag):
A human resource assigned to a Shift Cell: name (free text), Funktion, ResStatus, and notes.
_Avoid_: employee, worker, person

**Inventar** (entry: Inventareintrag):
An equipment or tool item: name (Gerät), quantity (Anzahl), ResStatus, and notes.
_Avoid_: equipment, machinery

**Material** (entry: Materialeintrag):
A consumable material: name, quantity (Menge), unit (Einheit), ResStatus, and notes.

**Fremdleistung** (entry: Fremdleistungseintrag):
A third-party service: company (Firma), service description (Leistung), ResStatus, and notes.
_Avoid_: external service, subcontractor

**ResStatus**:
Planning lifecycle state shared by all planner-owned resource types (Tätigkeiten, Personal, Inventar, Material, Fremdleistung). Represents the planner's coordination progress, not a system state. Values: `Planung` (need identified) → `Bestellt` (sent to disposition) → `Bestätigt` (disposition confirmed). Cancelled entries become `Storniert` rather than being deleted. Transitions are a planning convention, not enforced by the app.
_Avoid_: status (too generic — always say ResStatus)
_Note_: `Storniert` is the intended cancelled state but is not yet in the code type definition (`src/types/index.ts`).

### Users

**Planner**:
A user who creates and edits the shift schedule — adds resources to Shift Cells, manages Stammdaten, and exports. Full read/write access to a Projekt.
_Avoid_: editor, admin

**Reader**:
A user with read-only access — can view the plan and export, but cannot create or modify any resource. Not yet implemented.
_Avoid_: viewer

## Example dialogue

> **Dev:** "A Bauleiter called to say the Nachtschicht on KW 21 Monday needs two more Gleismonteure."
> **Planner:** "I'll open the Shift Cell for KW 21, Monday, Nacht and add two Personaleinträge with Funktion 'Gleismonteur' and ResStatus 'Planung'. Once I've sent the request to the disposition agent I'll move them to 'Bestellt'."

> **Dev:** "There's an Intervall showing up on KW 22 Thursday Tag — but there's no Tätigkeit planned for it."
> **Planner:** "That's fine. The BAB exists and our CRON put that window in the Shift Cell, but we might not use it. I'll either plan a Tätigkeit against it later or ask the client to cancel that BAB."

> **Dev:** "Can a Reader export the PDF for KW 20?"
> **Planner:** "Yes — Readers can export. They just can't edit any Shift Cell or Stammdaten."

## Flagged ambiguities

- **Zusätzlicher Bedarf** is currently typed as an `IntervalleStatus` value alongside CRON-written statuses, but it has fundamentally different write authority (planner, not CRON). Mixing them in one section creates a write-authority conflict. Proposed resolution: promote it to a dedicated timeline section with its own UI input, separate from Intervalle.
- The code calls the Kontaktliste `mitarbeiter`/`MitarbeiterRow` — misleading because these are key contacts, not the workforce being planned. Rename candidate.
- `babNr` on `TaskItem` is obsolete — BABs and Tätigkeiten are independent objects with no direct link.
- `Storniert` is the intended cancelled ResStatus but is missing from `SDP_RES_STATUS_VALUES` in `src/types/index.ts`.

## Relationships

- A **Shift Cell** belongs to exactly one calendar week, one day, and one shift (Tag or Nacht)
- A **Shift Cell** holds zero or more resources across six types: **Tätigkeit**, **Personal**, **Inventar**, **Material**, **Fremdleistung**, **Intervall**
- **Tätigkeiten** are organised in a three-level hierarchy: **Fachdienst** → **Bauteil** → **Tätigkeit**
- **Intervalle** are the only resource type with an external write authority (CRON automation); all other types are planner-owned
- All planner-owned resource types share a common **ResStatus** lifecycle; **Intervalle** have a separate status vocabulary
- The **Export** can cover any user-selected subset of **Kalenderwochen** within a Projekt — KW selection dialog is planned but not yet implemented; intended audience is internal (site team) and external (client, subcontractors)
