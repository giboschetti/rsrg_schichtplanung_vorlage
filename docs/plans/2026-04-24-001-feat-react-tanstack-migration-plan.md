---
title: "feat: Migrate Schichtplanung to React 19 + TanStack Table + shadcn/ui"
type: feat
status: active
date: 2026-04-24
---

# feat: Migrate Schichtplanung to React 19 + TanStack Table + shadcn/ui

## Overview

Full rewrite of the vanilla JS shift-planning app into a Vite + React 19 + TypeScript stack, replacing the hand-rolled HTML timeline grid with TanStack Table v8 + TanStack Virtual v3, and replacing the bespoke CSS component system with shadcn/ui. Firebase Auth + Firestore backend is retained unchanged. XLSX + PDF exports stay on SheetJS + jsPDF. PDF export becomes the primary data-sharing mechanism; standalone HTML export is dropped.

## Problem Frame

The current app is a single-file vanilla JS codebase with no build step, global mutable state, direct DOM manipulation, and a hand-rolled `<table>` timeline grid. This makes it fragile to extend (tight coupling between state.js globals and DOM imperatives), hard to test (no module isolation), and visually inconsistent (custom CSS for every component). The timeline grid specifically suffers from layout jank, no virtual scrolling, and complex imperative rebuild-on-every-change cycles.

Migrating to React + TanStack Table gives us:
- Declarative component tree replacing DOM mutations
- Built-in column + row virtualization for the large KW × day × shift column matrix
- shadcn/ui for accessible, tested, design-system-quality UI components
- TypeScript for type-safe data models across the three-level resource hierarchy
- Zustand for global state that matches the mental model of the current `state.js` globals but without mutation side effects

## Requirements Trace

- R1. All existing planner features work after migration: KW management, timeline grid with collapsible rows, Shift Detail Panel, Stammdaten, bulk add, clipboard copy/paste
- R2. 3-level Tätigkeiten hierarchy (Fachdienst → Bauteil → Tätigkeit) rendered as collapsible tree rows
- R3. Intervalle resource type with its full SDP table (BAB-Nr, dates, status)
- R4. Firebase Auth (Google Sign-in) + Firestore project save/load works identically
- R5. LocalStorage snapshot round-trip preserved, including migration of old `name`/`bauphaseBauteil` task fields
- R6. XLSX and PDF export produce output equivalent to current exports
- R7. Timeline column virtualization: no browser jank with 10+ calendar weeks (140+ columns)
- R8. SDP panel slides up from bottom with animation (current UX preserved)
- R9. Standalone HTML export removed; PDF export is the sharing mechanism
- R10. Firebase Hosting deploy continues to work

## Scope Boundaries

- No new features beyond what currently exists
- No backend changes to Firestore schema or security rules
- No drag-and-drop scheduling (remains future work — FullCalendar consideration)
- No mobile-specific layout optimisations

### Deferred to Separate Tasks

- Drag-and-drop shift scheduling: separate task, may introduce FullCalendar if chosen
- Vitest + Playwright CI pipeline: separate task after migration stabilises

## Context & Research

### Relevant Code and Patterns

- `js/state.js` — global mutable state: `workItems`, `kwList`, `tlFilter`, `tlCollapsed`, `fachdienstBauteile`, `shiftConfig` → maps to Zustand store slices
- `js/storage.js` — LocalStorage persistence + `loadFromEmbeddedData` + migration logic → Zustand `persist` middleware + explicit migration function
- `js/project.js` — Firebase Firestore load/save + auth guard + `normalizeSnapshot` → React hook `useProject` + `firestoreService`
- `js/timeline.js` — `buildTasksRows()`, `buildPersonalRows()`, `buildSimpleRow()`, `buildCell()` → TanStack Table column + row definitions + `TimelineCell` component
- `js/sdp.js` — `initSDPTables()`, `flushOpenSDPTables()`, `openSDP()`, `closeSDP()` → `ShiftDetailPanel` Sheet component with per-section TanStack Tables
- `js/stammdaten.js` — `renderFachdienstBauteileList()`, `addBauteilToFachdienst()` → `FachdienstBauteilEditor` component
- `js/app.js` — `DOMContentLoaded` init, event listeners → React component mount effects
- `js/export-xlsx.js` / `js/export-pdf.js` — SheetJS + jsPDF logic → reusable `lib/exporters/xlsx.ts` + `lib/exporters/pdf.ts` called from React hooks

### Institutional Learnings

- No existing `docs/solutions/` entries — this is the first documented plan in the project

### External References

- [TanStack Table v8 — Row Models Guide](https://tanstack.com/table/v8/docs/guide/row-models)
- [TanStack Table v8 — Grouping Guide](https://tanstack.com/table/v8/docs/guide/grouping)
- [TanStack Table — Virtualized Columns Example](https://tanstack.com/table/latest/docs/framework/react/examples/virtualized-columns)
- [TanStack Virtual v3 — Virtualizer API](https://tanstack.com/virtual/v3/docs/api/virtualizer)
- [Zustand v5 — Persist Middleware](https://zustand.site/en/docs/persist/)
- [shadcn/ui — Sheet component](https://ui.shadcn.com/docs/components/sheet)
- [Firebase SDK v10 modular API](https://firebase.google.com/docs/web/modular-upgrade)

## Key Technical Decisions

- **Big-bang rewrite, not incremental embedding**: The vanilla JS codebase has no module boundary suitable for incremental React adoption; global state and DOM manipulation are entangled. A clean rewrite in a new `src/` tree is faster and safer than trying to host React inside the existing HTML files.
- **TanStack Table tree data (subRows) for row hierarchy, not column-based grouping**: The resource rows are a fixed hierarchy (Tätigkeiten → Fachdienst → Bauteil, Personal → Funktion) not a data-driven group-by. Using `subRows` + `getExpandedRowModel()` mirrors the current manual row-type system without AG Grid Enterprise or custom rebuilds.
- **Column virtualization for KW axis**: Each KW adds 14 columns (7 days × 2 shifts). At 10 KW = 140 columns. TanStack Virtual `horizontal: true` virtualizer renders only the visible columns, eliminating current layout jank.
- **Zustand `persist` middleware replaces `saveWorkItemsLS` / `loadStammdaten`**: Direct drop-in for the current LocalStorage write/read pattern; supports partial state persistence and custom migration functions for the old `name → taetigkeit` field rename.
- **shadcn/ui `Sheet` (side="bottom") for SDP panel**: Replaces the current CSS `position:fixed; transform: translateY(100%)` panel. Portal rendering prevents z-index conflicts; Radix provides accessible focus trapping.
- **TanStack Table (headless) for SDP sub-tables**: Replaces Tabulator 6.3. Consistent with the timeline grid; no extra dependency. Inline cell editing via controlled React inputs in custom cell components.
- **React Router v7 (file-based, two routes)**: `/` → Dashboard, `/project/:id` → Planner. Replaces the two-HTML-file approach. Auth guard as a wrapper component.
- **Vite 6 + React 19 + TypeScript 5**: Standard modern stack, aligns with CLAUDE.md recommendations for the organisation.
- **Tailwind CSS v4**: Required by shadcn/ui; replaces the hand-written `css/styles.css`.
- **Standalone HTML export dropped**: Was already a secondary mechanism; PDF export (jsPDF) covers the sharing use case with better portability.

## Open Questions

### Resolved During Planning

- **Can TanStack Table handle the column-group header structure (KW → Day → Shift)?** Yes — column groups via nested `columns` arrays produce the `<colgroup>` + multi-row `<thead>` structure exactly matching the current layout.
- **Does Zustand persist work across the Firestore bootstrap-reload pattern?** Yes — `persist` re-hydrates from localStorage on mount; the Firestore load overwrites only the keys it manages (same as current `writeSnapshotToBootstrap`).
- **Is TanStack Table inline editing feasible without Tabulator?** Yes — render a controlled `<input>` or `<select>` as the cell component; commit on blur/change. More code than Tabulator's built-in editor but fully controlled and testable.
- **Sticky first column with column virtualization?** TanStack Table's `pinning` feature pins columns left outside the virtual window; the label column stays sticky via `position: sticky`.

### Deferred to Implementation

- Exact Tailwind token mapping from current CSS variables (--accent, --text, --border) — resolve when building the Tailwind config
- Whether `react-firebase-hooks` is worth adding or direct SDK calls suffice — evaluate during Unit 2
- Exact jsPDF column layout adjustments for new component structure — resolve during Unit 14

## Output Structure

```
rsrg_schichtplanung_vorlage/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── constants/
│   │   └── index.ts
│   ├── types/
│   │   ├── workItems.ts
│   │   ├── kw.ts
│   │   └── project.ts
│   ├── store/
│   │   ├── plannerStore.ts
│   │   ├── uiStore.ts
│   │   └── stammdatenStore.ts
│   ├── firebase/
│   │   ├── config.ts
│   │   ├── auth.ts
│   │   └── firestore.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useProject.ts
│   │   └── useLocalStorage.ts
│   ├── lib/
│   │   ├── utils.ts
│   │   ├── kw.ts
│   │   ├── dateHelpers.ts
│   │   └── exporters/
│   │       ├── xlsx.ts
│   │       └── pdf.ts
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   └── PlannerPage.tsx
│   └── components/
│       ├── layout/
│       │   ├── AppHeader.tsx
│       │   └── TabBar.tsx
│       ├── timeline/
│       │   ├── TimelineGrid.tsx
│       │   ├── TimelineCell.tsx
│       │   ├── ResourceChip.tsx
│       │   └── TimelineControls.tsx
│       ├── sdp/
│       │   ├── ShiftDetailPanel.tsx
│       │   ├── SDPSection.tsx
│       │   └── SDPTable.tsx
│       ├── stammdaten/
│       │   ├── StammdatenPanel.tsx
│       │   └── FachdienstBauteilEditor.tsx
│       └── modals/
│           ├── AddKWModal.tsx
│           └── BulkAddModal.tsx
├── public/
│   └── assets/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── components.json
├── firebase.json
├── firestore.rules
└── docs/
    └── plans/
        └── 2026-04-24-001-feat-react-tanstack-migration-plan.md
```

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Timeline Grid Data Flow

```
Zustand plannerStore
  ├── kwList[]           ─────────────────────────────────────────┐
  ├── workItems{}        ──→  TimelineGrid                        │
  ├── tlFilter{}         │      ├── buildColumns(kwList)          │
  └── tlCollapsed{}      │      │     └── [label | KW→Day→Shift]  │
                         │      └── buildRows(workItems,          │
                         │                   fachdienstBauteile)  │
                         │            └── subRows tree            │
                         │                                        │
                         └──→ TanStack Table instance             │
                                ├── getExpandedRowModel()         │
                                ├── column pinning (label sticky) │
                                └── TanStack Virtual (horizontal) ┘
                                      └── TimelineCell
                                            └── ResourceChip[]
                                                  (chip-* CSS class)
```

### Row Tree Shape

```
[
  { id:'intervalle', type:'simple', section:'intervalle' },
  { id:'tasks',      type:'parent', section:'tasks', subRows: [
    { id:'tasks-FB',  type:'child',  fachdienst:'FB', subRows: [
      { id:'tasks-FB-Bauteil1', type:'leaf', bauteil:'Bauteil1' }
    ]}
  ]},
  { id:'personal',   type:'parent', section:'personal', subRows: [
    { id:'personal-Baugruppe', type:'child', funktion:'Baugruppe' }
  ]},
  { id:'inventar',   type:'simple' },
  { id:'material',   type:'simple' },
  { id:'fremdleistung', type:'simple' },
]
```

Each row type controls which work items are looked up and rendered in cells. Parent rows show aggregated count badge when collapsed (`tlCollapsed[id] === true`).

### SDP Panel Architecture

```
User clicks TimelineCell
  → openSDP(kwId, dayIdx, shift) sets uiStore.sdpCell
  → ShiftDetailPanel (shadcn Sheet, side="bottom") opens
      ├── SDPSection per TL_GROUP
      │     └── SDPTable (TanStack Table, inline edit cells)
      │           └── cell blur → plannerStore.setSection()
      └── close → uiStore.clearSdpCell
```

## Implementation Units

### Phase 1 — Foundation

- [ ] **Unit 1: Vite + React + TypeScript + Tailwind + shadcn/ui scaffold**

**Goal:** Create the `src/` tree, configure Vite 6 + React 19 + TypeScript 5, install Tailwind CSS v4, initialise shadcn/ui, map current CSS variables to Tailwind tokens.

**Requirements:** R1, R10

**Dependencies:** None

**Files:**
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `components.json`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `index.html` (replaces current root `index.html` and `project.html`)
- Modify: `package.json` (add all dependencies)

**Approach:**
- Run `npm create vite@latest` scaffold then layer shadcn/ui init on top
- Map CSS variables from `css/styles.css` to Tailwind config: `--accent → orange-500`, `--text → zinc-950`, `--border → zinc-200`, etc. — preserve the RSRG orange brand
- shadcn/ui components to install upfront: Button, Badge, Sheet, Dialog, Select, Input, Textarea, Tabs, Separator, Toast (Sonner)
- Keep `firebase.json` and `firestore.rules` at root — no path changes needed for Firebase CLI
- `index.html` becomes the single Vite entry point; React Router handles the two routes

**Test expectation:** none — scaffolding only, no behavior

**Verification:**
- `npm run dev` serves a blank React page at localhost without console errors
- `npm run build` produces a `dist/` folder without type errors
- `firebase deploy --only hosting` deploys from `dist/` successfully

---

- [ ] **Unit 2: Firebase config + Auth hook + React Router routes**

**Goal:** Wire Firebase Auth (Google Sign-in) into React, create the two-route structure (`/` dashboard, `/project/:id` planner), implement auth guard.

**Requirements:** R1, R4

**Dependencies:** Unit 1

**Files:**
- Create: `src/firebase/config.ts`
- Create: `src/firebase/auth.ts`
- Create: `src/hooks/useAuth.ts`
- Create: `src/pages/DashboardPage.tsx` (stub)
- Create: `src/pages/PlannerPage.tsx` (stub)
- Modify: `src/App.tsx`

**Approach:**
- Port Firebase config from `js/firebase-init.js` (env vars via `import.meta.env` — no hardcoded keys)
- `useAuth` hook wraps `onAuthStateChanged`; returns `{ user, loading, signIn, signOut }`
- Auth guard: wrapper component that redirects to `/` if no user, renders children if authenticated
- React Router v7: `createBrowserRouter` with two routes; `PlannerPage` wrapped in auth guard
- Firebase API keys go into `.env.local` (gitignored); document required vars in README

**Test scenarios:**
- Happy path: authenticated user navigates to `/project/abc` → `PlannerPage` renders
- Error path: unauthenticated user navigates to `/project/abc` → redirected to `/`
- Happy path: user signs in via Google → `useAuth` user state updates, navigation proceeds
- Edge case: `onAuthStateChanged` still loading → loading spinner shown, no premature redirect

**Verification:**
- Signing in via Google Sign-in button lands the user on the dashboard
- Direct navigation to `/project/xyz` without auth redirects to `/`
- Firebase console shows new sign-in event

---

### Phase 2 — Data Model & State

- [ ] **Unit 3: TypeScript types**

**Goal:** Define all shared TypeScript interfaces replacing the implicit JS object shapes documented in `js/state.js` comments.

**Requirements:** R1, R2, R3, R5

**Dependencies:** Unit 1

**Files:**
- Create: `src/types/workItems.ts`
- Create: `src/types/kw.ts`
- Create: `src/types/project.ts`
- Create: `src/constants/index.ts`

**Approach:**
- Port `FACHDIENST_VALUES`, `TL_GROUPS`, `SDP_SECTIONS`, `SHIFT_CLIP_SECTIONS`, `SDP_RES_STATUS_VALUES`, `SDP_INTERVALLE_STATUS_VALUES`, `TL_SHIFTS`, `TL_DAYS` from `js/constants.js` to `src/constants/index.ts` as `const` arrays with `as const` for literal inference
- Define discriminated union `WorkItem = TaskItem | PersonalItem | InventarItem | MaterialItem | FremdleistungItem | IntervalleItem` in `src/types/workItems.ts`
- `TaskItem`: `{ id, fachdienst, bauteil, taetigkeit, beschreibung, location, resStatus, notes }`
- `IntervalleItem`: `{ id, babNr, babDatei, babTitel, status, gleissperrungen, fahrleitungsausschaltungen, vonDatum, vonZeit, bisDatum, bisZeit }`
- `CellKey = string` (format `kwId||dayIdx||shift`), `CellData = Partial<Record<SectionId, WorkItem[]>>`
- `WorkItemMap = Record<CellKey, CellData>`
- `KW = { id, label, num, year, dateFrom, dateTo }`
- `ProjectSnapshot` mirrors current `normalizeSnapshot` output shape

**Test expectation:** none — types only, no runtime behavior

**Verification:**
- `npm run build` with zero type errors
- All `WorkItem` variants are exhaustively handled in a switch/discriminated union in at least one utility function

---

- [ ] **Unit 4: Zustand stores**

**Goal:** Create three Zustand stores replacing `js/state.js` globals: `plannerStore` (work data), `uiStore` (selection, filter, collapse state), `stammdatenStore` (project metadata + fachdienstBauteile).

**Requirements:** R1, R2, R3, R5

**Dependencies:** Unit 3

**Files:**
- Create: `src/store/plannerStore.ts`
- Create: `src/store/uiStore.ts`
- Create: `src/store/stammdatenStore.ts`
- Create: `src/lib/utils.ts` (wiKey helper + section accessor)

**Approach:**
- `plannerStore`: holds `workItems: WorkItemMap`, `kwList: KW[]`, `shiftConfig`; actions: `setSection`, `addKW`, `removeKW`, `pasteShift`, `clearAll`; persisted to localStorage via Zustand `persist` middleware (key `sp_workItems_v2`)
- `stammdatenStore`: holds `fachdienstBauteile: Record<string, string[]>`, `projektInfo` fields; persisted (key `sp_stammdaten_v2`); migration function handles old `bauphaseBauteile: string[]` shape
- `uiStore`: holds `tlFilter`, `tlCollapsed`, `selectedCell`, `sdpOpen`, `timelineShiftFocus`, `shiftClipboard`; NOT persisted (session-only UI state)
- `plannerStore` migration: on store rehydration, scan all `cell.tasks` and apply `name → taetigkeit`, `bauphaseBauteil → bauteil`, default `fachdienst: 'Andere'` — mirrors current `loadWorkItemsLS` migration block in `js/storage.js`
- `wiKey(kwId, dayIdx, shift)` utility returns the canonical cell key string

**Test scenarios:**
- Happy path: `setSection('kw1', 0, 'T', 'tasks', [...])` updates `workItems['kw1||0||T'].tasks`
- Edge case: calling `setSection` on a new key creates the cell entry
- Happy path (migration): persisted data with `{ name: 'X', bauphaseBauteil: 'Y' }` task item is read back as `{ taetigkeit: 'X', bauteil: 'Y', fachdienst: 'Andere' }`
- Happy path: `tlCollapsed` toggling for 'tasks' flips the boolean

**Verification:**
- Opening the app with old localStorage data (from the vanilla JS version) does not crash; old task items are readable under the new field names

---

- [ ] **Unit 5: Firestore service + `useProject` hook**

**Goal:** Port `js/firestore-service.js` and `js/project.js` auth-guard + load/save logic to a typed service module and a `useProject` React hook.

**Requirements:** R4, R5

**Dependencies:** Unit 2, Unit 3, Unit 4

**Files:**
- Create: `src/firebase/firestore.ts`
- Create: `src/hooks/useProject.ts`

**Approach:**
- `firestore.ts` exports: `getProject(id)`, `saveProjectData(id, payload)`, `listRegisteredUsers()`, `addProjectMember(id, uid)`, `ensureUserProfile(user)` — typed with `ProjectSnapshot` and Firestore document types
- `useProject(projectId)` hook: loads project on mount, calls `writeSnapshotToStores(snapshot)` to hydrate all three Zustand stores from Firestore data, then re-uses `markDirty` equivalent via Zustand action
- `writeSnapshotToStores` replaces `writeSnapshotToBootstrap` + the `localStorage` bootstrap approach: writes directly into Zustand stores (no localStorage indirection needed)
- Autosave: `useEffect` watching Zustand store hash (JSON.stringify of relevant slices); debounced 1200ms; calls `saveProjectData`
- Safety net preserved: if local store looks empty and Firestore has data, restore from Firestore (port of `snapshotLooksEmpty` check)
- Member management (add/list) stays in `useProject`

**Test scenarios:**
- Happy path: project loads from Firestore → all three stores hydrated → timeline renders
- Error path: project not found → alert + redirect to dashboard
- Error path: user not in memberIds → access denied + redirect
- Edge case: Firestore data is empty `{}` + localStorage has data → local data wins (no overwrite)
- Edge case: local data is empty + Firestore has data → Firestore data restored

**Verification:**
- Opening a project URL loads the correct KW list and work items from Firestore
- Editing any cell triggers an autosave within ~1.5s (visible in Firestore console)

---

- [ ] **Unit 6: Utility library (dates, normalization, item helpers)**

**Goal:** Port all pure utility functions from `js/utils.js`, `js/kw.js`, `js/stammdaten.js` to typed TypeScript modules.

**Requirements:** R1, R2, R3

**Dependencies:** Unit 3

**Files:**
- Create: `src/lib/dateHelpers.ts`
- Create: `src/lib/kw.ts`
- Create: `src/lib/utils.ts` (extends from Unit 4)

**Approach:**
- `dateHelpers.ts`: `parseLocalYMD`, `toYMD`, `addDaysLocal`, `isoWeekMondayLocal`, `mondayDateForKw`, `tlDayPlain`, `tlDayThHtml`, `fmtDate` — identical logic, typed
- `kw.ts`: `buildKWId`, `confirmAddKW` logic, `renderKWList` replaced by `useKWList` hook returning sorted array
- `utils.ts`: `getItemLabel`, `tlBlockClassFromResStatus` (returns `chip-*` class), `tlBlockTitle`, `getBauteileForFachdienst`, `getAllBauteile`, `getUsedFachdienste`, `getBauteileForFachdienstInUse`, `getTaskItemsByFachdienstBauteil`, `getUsedPersonalFunctions`, `getPersonalItemsByFunction`, `normalizeFachdienst`, `normalizeBauteil`, `normalizeTaetigkeit`
- All functions are pure (no store access) — they receive data as arguments; store selectors compose them

**Test scenarios:**
- Happy path: `parseLocalYMD('2026-04-14')` returns a Date at April 14 2026
- Edge case: `parseLocalYMD(null)` returns null
- Happy path: `getItemLabel({ taetigkeit: 'Aushub' }, 'tasks')` returns `'Aushub'`
- Happy path: `getItemLabel({}, 'tasks')` returns `'–'`
- Happy path: `tlBlockClassFromResStatus({ resStatus: 'Bestätigt' }, 'tasks')` returns `'chip-bestaetigt'`
- Happy path: `tlBlockClassFromResStatus({ status: 'Verständigt' }, 'intervalle')` returns `'chip-bestaetigt'`
- Happy path: `getUsedFachdienste(workItems)` returns only Fachdienste present in data, in FACHDIENST_VALUES order

**Verification:**
- All utility test scenarios pass in Vitest with `npm test`

---

### Phase 3 — Pages & Shell

- [ ] **Unit 7: Dashboard page**

**Goal:** Implement the project list + create project UI currently in `index.html`.

**Requirements:** R1, R4

**Dependencies:** Unit 2, Unit 5

**Files:**
- Create: `src/pages/DashboardPage.tsx`
- Create: `src/components/layout/AppHeader.tsx`

**Approach:**
- `AppHeader` renders logo, project name, sign-out button — accepts title and action slots as props; shared between Dashboard and Planner pages
- `DashboardPage`: lists user's projects from Firestore, allows creating new project (name input + button), navigates to `/project/:id` on click
- Use shadcn/ui Card for project list items, Input + Button for create form, Dialog for confirm-delete
- Auth is already provided by the route guard from Unit 2

**Test scenarios:**
- Happy path: user with 3 projects sees 3 cards
- Happy path: creating a new project navigates to its planner page
- Edge case: user with 0 projects sees an empty state message

**Verification:**
- Dashboard loads, project list populates, clicking a project opens the planner

---

- [ ] **Unit 8: App shell — PlannerPage layout, tabs, toast**

**Goal:** Implement the two-tab layout (Stammdaten / Übersicht), toast notifications, and the global header for the planner page.

**Requirements:** R1

**Dependencies:** Unit 7

**Files:**
- Create: `src/components/layout/TabBar.tsx`
- Modify: `src/pages/PlannerPage.tsx`

**Approach:**
- `PlannerPage` renders: `AppHeader` (with project name from `stammdatenStore`) + `TabBar` + active tab content
- `TabBar` uses shadcn/ui Tabs component; two tabs: Stammdaten and Übersicht
- Toast: use Sonner (shadcn/ui recommended) — `toast('Ressource kopiert')` replaces `showToast()`; Toaster component placed in `App.tsx`
- Export buttons (XLSX, PDF) in header — call lib functions from Units 13/14
- Cloud save state indicator in header (from `useProject`)

**Test expectation:** none — layout scaffolding; behavior covered by integration in later units

**Verification:**
- Both tabs render their content areas without errors
- Toast appears when triggered programmatically

---

### Phase 4 — Timeline Grid

- [ ] **Unit 9: TimelineGrid component (TanStack Table + Virtual)**

**Goal:** Implement the full timeline grid using TanStack Table v8 with `getExpandedRowModel` for the collapsible resource hierarchy and TanStack Virtual v3 column virtualization.

**Requirements:** R1, R2, R3, R7

**Dependencies:** Unit 4, Unit 6, Unit 8

**Files:**
- Create: `src/components/timeline/TimelineGrid.tsx`
- Create: `src/components/timeline/TimelineCell.tsx`
- Create: `src/components/timeline/ResourceChip.tsx`

**Approach:**
- **Columns**: `buildColumns(kwList)` generates a pinned `label` column + nested column groups `KW → Day (colspan=2) → [Tag, Nacht]`; each leaf column id encodes `${kwId}||${dayIdx}||${shift}`
- **Rows**: `buildRows(workItems, fachdienstBauteile, tlFilter, tlCollapsed)` constructs the subRows tree; row shape includes `{ id, rowType: 'parent'|'child'|'leaf'|'simple', section, label, fachdienst?, bauteil?, funktion? }`; only rows with `tlFilter[section] === true` are included
- **TanStack Table instance**: `useReactTable` with `getExpandedRowModel`, `getExpandedRowModel`, column pinning for label; `expanded` state driven by `tlCollapsed` from `uiStore`
- **Column virtualization**: `useVirtualizer({ horizontal: true, count: leafColumns.length, getScrollElement, estimateSize: () => 80 })`; render only visible columns in each row; pad with spacer `<td>` left and right
- **Row virtualization**: `useVirtualizer({ count: rows.length, ... })` for vertical — handles many resource rows gracefully
- **Parent row cells**: when `tlCollapsed[groupId]` is true, cell shows total count badge across all child items for that KW/day/shift; when expanded, cell is empty placeholder (current behaviour preserved)
- **Cell click**: calls `uiStore.openSDP(kwId, dayIdx, shift, grp)` — triggers Sheet open
- **Sticky label column**: CSS `position:sticky; left:0` with Tailwind; `column.getIsPinned()` guard
- `ResourceChip` renders `<span class="tl-chip {chipClass}"><span class="tl-chip-dot" />{label}</span>` — purely presentational

**Test scenarios:**
- Happy path: grid renders with 2 KW, 7 days each → 28 day columns visible
- Happy path: Tätigkeiten row is collapsed → parent cells show count badges, child rows not rendered
- Happy path: Tätigkeiten row is expanded → parent cells empty, child rows render with chips
- Edge case: `kwList` is empty → empty state message rendered instead of table
- Happy path: clicking a leaf cell opens SDP for correct (kwId, dayIdx, shift)
- Happy path: filter 'tasks' toggled off → Tätigkeiten parent row and all children absent

**Verification:**
- With 10 KW loaded, scrolling the timeline horizontally is smooth (no layout jank)
- Expanding/collapsing rows updates cell content without full re-mount

---

- [ ] **Unit 10: Timeline controls — filter bar, KW management, bulk-add modal**

**Goal:** Implement the filter pills, KW management panel, and bulk-add resources modal.

**Requirements:** R1

**Dependencies:** Unit 9

**Files:**
- Create: `src/components/timeline/TimelineControls.tsx`
- Create: `src/components/modals/AddKWModal.tsx`
- Create: `src/components/modals/BulkAddModal.tsx`

**Approach:**
- Filter pills: toggle `uiStore.tlFilter[grpId]`; use shadcn/ui Toggle or Button with `variant="outline"` + active state styling
- KW management: list of KW items with delete button; "+ KW hinzufügen" opens `AddKWModal`
- `AddKWModal`: shadcn/ui Dialog; fields: KW number, year, date range (optional); on confirm calls `plannerStore.addKW`
- `BulkAddModal`: shadcn/ui Dialog with type selector (Select) + dynamic field set (one panel per resource type, same structure as current HTML); on confirm iterates all cells in date range × selected shifts and appends items
- `bulkAddTypeChanged` logic: show/hide field panels based on selected type; for tasks, render `FachdienstSelect` + `BauteilSelect` (driven by `stammdatenStore`)

**Test scenarios:**
- Happy path: toggling 'personal' filter hides the Personal row from the grid
- Happy path: adding KW 20/2026 appends it to `kwList` sorted by year+num
- Happy path: bulk-add 3 cells (Mon–Wed, Tag only, personal type) adds 3 personal entries
- Edge case: bulk-add with no date range → form validation error shown

**Verification:**
- Filter pills reflect current tlFilter state after toggle
- Bulk-add creates the expected number of work items visible as chips in the timeline

---

### Phase 5 — Shift Detail Panel & Stammdaten

- [ ] **Unit 11: ShiftDetailPanel + per-section SDPTables**

**Goal:** Implement the slide-up SDP Sheet with one collapsible section per TL_GROUP, each backed by an editable TanStack Table.

**Requirements:** R1, R2, R3, R8

**Dependencies:** Unit 9

**Files:**
- Create: `src/components/sdp/ShiftDetailPanel.tsx`
- Create: `src/components/sdp/SDPSection.tsx`
- Create: `src/components/sdp/SDPTable.tsx`

**Approach:**
- `ShiftDetailPanel`: shadcn/ui Sheet with `side="bottom"`, open state from `uiStore.sdpOpen`; `max-h-[50vh] overflow-y-auto`; header shows KW + day + shift label; close button clears `uiStore`; on open, sets `PlannerPage` bottom padding
- On close: flush in-progress edits (call `plannerStore.setSection` for all dirty sections) before clearing `uiStore.sdpCell`
- `SDPSection`: one per `TL_GROUPS` entry; shadcn/ui Collapsible; header shows section name + count badge; "+ Zeile" button calls `plannerStore.addRow(section)`
- `SDPTable`: headless TanStack Table; each section has its own column definition (mirrors current `initSDPTables` column arrays); inline editing via controlled cell components:
  - Text cells: `<Input>` rendered directly in the cell, `onChange` updates local draft state, `onBlur` commits to store
  - Select cells (resStatus, fachdienst, status): `<Select>` from shadcn/ui; `onValueChange` commits immediately
  - Bauteil cell: `<Select>` populated from `getBauteileForFachdienst(row.fachdienst)` — live, reacts to fachdienst change
  - Delete cell: `<Button variant="ghost" size="icon">✕</Button>` calls `plannerStore.deleteRow(section, rowId)`
- Row context menu (copy resource): use shadcn/ui DropdownMenu on right-click or dedicated menu icon
- After any commit: `plannerStore.setSection` persists, `uiStore` count updates, timeline re-renders (React reactivity replaces manual `renderTimeline()`)

**Test scenarios:**
- Happy path: clicking a timeline cell opens the Sheet with correct KW/day/shift title
- Happy path: adding a tasks row, setting fachdienst=FB, bauteil=X, taetigkeit=Y, blurring → item persists in store → chip appears in timeline cell
- Happy path: changing resStatus to 'Bestätigt' → chip turns green immediately
- Happy path: adding an intervalle row, setting babNr + status → count badge increments
- Happy path: closing the panel → bottom padding removed from page
- Edge case: panel open + user clicks different cell → panel updates to new cell without flicker
- Error path: fachdienst changed after bauteil was set → bauteil select resets to empty

**Verification:**
- Adding a resource via SDP and closing the panel shows the chip in the correct timeline cell
- Re-opening the same cell shows the previously entered data

---

- [ ] **Unit 12: Stammdaten panel**

**Goal:** Implement the Stammdaten tab content: project info form, shift time config, Mitarbeiter table, Fachdienst/Bauteil editor, member management.

**Requirements:** R1

**Dependencies:** Unit 11

**Files:**
- Create: `src/components/stammdaten/StammdatenPanel.tsx`
- Create: `src/components/stammdaten/FachdienstBauteilEditor.tsx`

**Approach:**
- Project info fields (projektname, projektnummer, etc.): shadcn/ui Input components bound to `stammdatenStore`; `onChange` debounced 300ms before store write
- Shift time config: two time inputs per shift; `stammdatenStore.shiftConfig`
- Mitarbeiter table: TanStack Table with editable rows (same `SDPTable` approach from Unit 11) — replaces Tabulator instance
- `FachdienstBauteilEditor`: Select for fachdienst + Input for bauteil name + "+ Eintrag" Button; list below grouped by fachdienst with remove buttons; driven by `stammdatenStore.fachdienstBauteile`; on add/remove calls store action + triggers `renderBulkAddBauteilOptions` equivalent (Zustand selector)
- Member management: list registered users, Select + Add button — ports `refreshMemberUi` from `js/project.js`

**Test scenarios:**
- Happy path: typing in projektname field updates `stammdatenStore.projektInfo.projektname` and header display
- Happy path: adding bauteil 'Tunnel A' under FB → appears in list + appears in SDP Bauteil select for FB rows
- Happy path: removing a bauteil removes it from the list
- Edge case: adding duplicate bauteil (case-insensitive) → rejected silently

**Verification:**
- Bauteil added in Stammdaten is immediately available in the SDP Bauteil select without refresh

---

### Phase 6 — Exports & Deploy

- [ ] **Unit 13: XLSX export**

**Goal:** Port `js/export-xlsx.js` to `src/lib/exporters/xlsx.ts`; expose as a React hook `useXLSXExport`.

**Requirements:** R6

**Dependencies:** Unit 4, Unit 6

**Files:**
- Create: `src/lib/exporters/xlsx.ts`
- Modify: `src/components/layout/AppHeader.tsx` (wire export button)

**Approach:**
- Pure function `exportAllXLSX(workItems, kwList, stammdaten, shiftConfig)` — same sheet-per-resource-type structure as current export; takes data arguments rather than reading globals
- SheetJS (`xlsx`) imported as ES module: `import * as XLSX from 'xlsx'`
- `useXLSXExport` hook wraps the function, reads from Zustand stores, calls `XLSX.writeFile`

**Test scenarios:**
- Happy path: calling `exportAllXLSX` with non-empty `workItems` produces a Blob without throwing
- Edge case: `workItems` is empty → export still produces valid XLSX with empty sheets

**Verification:**
- Clicking "↓ Excel" in the header downloads a valid `.xlsx` file with the expected sheet names

---

- [ ] **Unit 14: PDF export**

**Goal:** Port `js/export-pdf.js` to `src/lib/exporters/pdf.ts`; expose as `usePDFExport` hook. This is now the primary data-sharing mechanism.

**Requirements:** R6, R9

**Dependencies:** Unit 4, Unit 6

**Files:**
- Create: `src/lib/exporters/pdf.ts`
- Modify: `src/components/layout/AppHeader.tsx` (wire export button)

**Approach:**
- jsPDF + jspdf-autotable imported as ES modules
- Pure function `exportAllPDF(workItems, kwList, stammdaten, shiftConfig, fachdienstBauteile)` — produces per-KW pages with resource tables; same layout as current export
- Standalone HTML export button removed from header (per R9)
- `usePDFExport` hook reads from stores, calls `exportAllPDF`

**Test scenarios:**
- Happy path: calling `exportAllPDF` with non-empty data produces a Blob without throwing
- Edge case: `kwList` is empty → single-page PDF with "Keine Kalenderwochen" message

**Verification:**
- Clicking "↓ PDF" downloads a valid PDF with at least one page per KW

---

- [ ] **Unit 15: Clipboard copy/paste + Firebase deploy config**

**Goal:** Port the shift clipboard copy/paste (Ctrl+C / Ctrl+V) from `js/clipboard.js`; update `firebase.json` to serve from `dist/`.

**Requirements:** R1, R10

**Dependencies:** Units 9–14

**Files:**
- Create: `src/hooks/useTimelineClipboard.ts`
- Modify: `firebase.json`

**Approach:**
- `useTimelineClipboard`: `useEffect` attaches `keydown` listener for Ctrl+C / Ctrl+V; reads `uiStore.timelineShiftFocus` and `uiStore.shiftClipboard`; calls `plannerStore` actions to copy/paste sections; exact logic from `js/clipboard.js`
- `firebase.json`: change `"public"` from `"."` to `"dist"`; update rewrites to `dist/index.html`
- `vite.config.ts`: ensure `build.outDir = 'dist'`

**Test scenarios:**
- Happy path: Ctrl+C on selected cell → `uiStore.shiftClipboard` set; Ctrl+V on another cell → work items pasted
- Edge case: Ctrl+V with no clipboard → no-op, no error

**Verification:**
- `firebase deploy --only hosting` after `npm run build` serves the React app correctly at the Firebase Hosting URL

---

## System-Wide Impact

- **Interaction graph:** Zustand store mutations replace the current `renderTimeline()` → `buildCell()` → DOM mutation chain. React's render cycle handles propagation automatically; no manual DOM calls remain.
- **Error propagation:** Firestore errors surface via `useProject` hook state (`error` field); render a banner; toast for transient failures (same UX as current `setCloudState`).
- **State lifecycle risks:** The Zustand `persist` store serializes `workItems` to localStorage on every mutation. Large projects (10+ KW) may produce >2MB localStorage entries — the current app has the same risk. Deferred: evaluate `IndexedDB` adapter if this becomes a problem.
- **API surface parity:** Firestore document shape (`plannerData`, `overview`, `kalenderwochen`, `stammdaten`) is unchanged — existing saved projects load correctly.
- **Integration coverage:** End-to-end flow (sign in → load project → add tasks → close SDP → verify chip → export PDF) must be validated manually before deploy; Playwright test is deferred to a follow-up task.
- **Unchanged invariants:** Firestore security rules (`firestore.rules`) are not modified. Firebase Auth provider (Google) is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Column virtualization with sticky label column conflicts | TanStack Table `column.getIsPinned()` + CSS `position:sticky` are compatible; official examples confirm this. Fall back to non-virtualized columns for label column only if conflict found. |
| TanStack Table inline editing UX is less polished than Tabulator | Accept for now — input-in-cell is sufficient for the use case. Drag-to-fill and bulk-paste are deferred. |
| Zustand persist rehydration race with Firestore load | Firestore load calls `writeSnapshotToStores` which directly sets all store slices, overwriting any stale localStorage data. Order: React mounts → Zustand rehydrates localStorage → `useProject` fetches Firestore → Firestore overwrites. Same order as current bootstrap-reload pattern. |
| shadcn/ui Sheet `side="bottom"` max-height on mobile | Non-goal for now (mobile layout is out of scope). |
| Tailwind CSS v4 breaking changes vs v3 | shadcn/ui supports Tailwind v4 since early 2026. Use `npx shadcn init` which auto-detects the version. |
| Standalone HTML export removal surprises users | Communicated at deploy time via a toast on first load after migration. PDF export covers the use case. |

## Documentation / Operational Notes

- `.env.local` must contain all Firebase config keys (`VITE_FIREBASE_API_KEY`, etc.) — document in `README.md` after migration
- `firebase.json` `public` key changes from `"."` to `"dist"` — run `npm run build` before every `firebase deploy`
- GitHub Actions CI can be added later to automate build + deploy on push to `main`
- After deploy, inform users that the app URL is unchanged and existing project data is preserved

## Sources & References

- [TanStack Table v8 Row Models](https://tanstack.com/table/v8/docs/guide/row-models)
- [TanStack Table — Virtualized Columns Example](https://tanstack.com/table/latest/docs/framework/react/examples/virtualized-columns)
- [TanStack Virtual v3 — Virtualizer](https://tanstack.com/virtual/v3/docs/api/virtualizer)
- [Zustand v5 — Persist Middleware](https://zustand.site/en/docs/persist/)
- [shadcn/ui — Sheet](https://ui.shadcn.com/docs/components/sheet)
- [Firebase SDK v10 modular upgrade guide](https://firebase.google.com/docs/web/modular-upgrade)
- [Vite — Environment Variables](https://vitejs.dev/guide/env-and-mode)
