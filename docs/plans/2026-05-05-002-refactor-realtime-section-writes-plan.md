---
title: "refactor: Real-time section writes — remove save button and dirty-state machinery"
type: refactor
status: active
date: 2026-05-05
origin: docs/adr/0001-realtime-writes-no-save-button.md
---

# refactor: Real-time section writes — remove save button and dirty-state machinery

## Overview

Replace the optimistic save-button model with real-time, section-level Firestore writes. Every planner edit immediately writes the affected section to Firestore (debounced ~800ms for text, immediate for add/delete/status changes). The Firestore listener is simplified to always apply a full refresh. Three coupled mechanisms — the dirty store, `mergeIntervalleOnly`, and `REACT_OWNED_SECTIONS` — are deleted.

See ADR: `docs/adr/0001-realtime-writes-no-save-button.md`.

## Problem Frame

The write-authority boundary between CRON (owns `intervalle`) and the React app (owns the other five sections) is currently defended by three separate, uncoordinated mechanisms:
- A `projectDocumentDirtyStore` whose side effects must be manually invoked in every store action
- A `mergeIntervalleOnly` function duplicated in both `useProject.ts` and `projectRemoteSync.ts`
- A `REACT_OWNED_SECTIONS` constant buried inside `saveProjectSnapshot`

Any one of these breaking independently causes silent data loss. Making writes structural (CRON writes `intervalle`, React writes the others — in separate Firestore field paths) removes the need for runtime coordination entirely.

## Requirements Trace

- R1. Every planner edit to a Shift Cell section is persisted to Firestore without a save button
- R2. CRON-written `intervalle` data is never overwritten by the React app
- R3. Firestore listener always applies a full state refresh — no conditional merge logic
- R4. No dirty flag, no `mergeIntervalleOnly`, no `REACT_OWNED_SECTIONS`
- R5. Stammdaten changes (FachdienstBauteile, Schichtkonfiguration, Kontaktliste, project form) are also persisted in real time
- R6. A sync indicator replaces the save button so planners have write-state feedback

## Scope Boundaries

- No changes to Firestore security rules or data schema — only the write path changes
- No multi-user conflict resolution (last-write-wins per section is accepted, per ADR-0001)
- No undo/redo functionality
- KW-scope selection for exports is a separate future task

### Deferred to Separate Tasks

- `Zusätzlicher Bedarf` section (planner-authored additional track interdictions): separate task, depends on this refactor completing first
- `Storniert` ResStatus implementation: separate task
- `mitarbeiter` → `kontakte` rename: separate cleanup task

## Context & Research

### Relevant Code and Patterns

- `src/services/firestoreService.ts` — existing `saveProjectSnapshot` uses dot-notation field updates; `writeCellSection` follows the same pattern scoped to one field
- `src/stores/plannerStore.ts` — `setSection` is the sole user-action setter for cell data; `setWorkItems` / `setKwList` are load-only setters
- `src/stores/stammdatenStore.ts` — `addBauteil`, `removeBauteil`, `setShiftConfig`, `setProjectForm`, `addMitarbeiterRow`, `updateMitarbeiterRow`, `removeMitarbeiterRow` are user-action setters; `setFachdienstBauteile` and `setMitarbeiter` are load-only
- `src/hooks/useProject.ts` — current subscription pattern to follow for the simplified listener
- `src/lib/projectRemoteSync.ts` — to be deleted; `computeRemoteApply` and `mergeIntervalleOnly` unused by the hook

### Institutional Learnings

- `stripUndefinedForFirestore` in `firestoreService.ts` must be applied to all new write payloads — Firestore rejects `undefined` anywhere in document data

## Key Technical Decisions

- **Write channel pattern over generic store subscriptions**: User-action setters in `plannerStore` and `stammdatenStore` will call registered write callbacks; load-only setters will not. This is the only safe way to avoid write loops when the Firestore listener refreshes the stores using the same setters that user code calls.
- **Section-level write unit**: The entire section array for one Shift Cell (`snapshot.workItems.<cellKey>.<section>`) is written atomically. Finer granularity (entry-level) is not needed given single-primary-user context and accepted last-write-wins tradeoff.
- **Separate write paths per data type**: Four targeted write functions replace one bulk `saveProjectSnapshot` — `writeCellSection`, `writeKwList`, `writeStammdaten`, `writeMitarbeiter`. Each maps to its own Firestore field path.
- **Debounce per (cellKey, section) pair**: Text-field edits to the same section of the same cell accumulate into a single write. Add/delete/status changes write immediately. A single shared debounce-per-key map in `useAutoSave` handles this.
- **`useAutoSave` enabled only after initial load**: The hook is activated once `useProject` reports `loading: false`. This prevents the initial Firestore hydration from triggering writes.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification.*

```
User action
  → store setter (user-action variant)
  → calls registered write callback with (data, key, section)
  → useAutoSave debounces
  → writeCellSection / writeKwList / writeStammdaten / writeMitarbeiter
  → Firestore field update

CRON
  → writes snapshot.workItems.<key>.intervalle
  → Firestore listener fires in useProject
  → always full refresh (setWorkItems, setKwList, setMitarbeiter, etc.)
  → load-only setters — NO write callbacks registered → no loop
```

Write channel registration (module-level, not React state):
```
// plannerStore exports:
registerPlannerWriteCallbacks(onSection, onKwList)
clearPlannerWriteCallbacks()

// stammdatenStore exports:
registerStammdatenWriteCallbacks(onStammdaten, onMitarbeiter)
clearStammdatenWriteCallbacks()
```

`useAutoSave` registers on mount (when `enabled` becomes true), clears on unmount or projectId change.

## Implementation Units

- [ ] **Unit 1: Targeted Firestore write functions**

  **Goal:** Add four new write functions to `firestoreService.ts`; remove `saveProjectSnapshot` and `REACT_OWNED_SECTIONS`.

  **Requirements:** R1, R2, R4, R5

  **Dependencies:** None

  **Files:**
  - Modify: `src/services/firestoreService.ts`

  **Approach:**
  - Add `writeCellSection(projectId, cellKey, section, items)` → `updateDoc` with `{ "snapshot.workItems.<cellKey>.<section>": stripUndefined(items), updatedAt: serverTimestamp() }`
  - Add `writeKwList(projectId, kwList)` → `{ "snapshot.kwList": ... }`
  - Add `writeStammdaten(projectId, stammdaten)` → `{ "snapshot.stammdaten": ... }`
  - Add `writeMitarbeiter(projectId, mitarbeiter)` → `{ "snapshot.mitarbeiter": ... }`
  - Apply `stripUndefinedForFirestore` to every payload before writing
  - Remove `saveProjectSnapshot` and `REACT_OWNED_SECTIONS` — they are replaced entirely
  - `subscribeToProject`, `loadProject`, `createProject`, `deleteProject`, `listUserProjects` are unchanged

  **Patterns to follow:**
  - Existing `saveProjectSnapshot` dot-notation field update pattern in `src/services/firestoreService.ts`

  **Test scenarios:**
  - Happy path: `writeCellSection` issues an `updateDoc` with the correct dot-notation key and stripped payload
  - Happy path: `writeKwList` writes to `snapshot.kwList` only — no other fields touched
  - Edge case: `writeCellSection` with an empty array writes `[]`, not undefined or missing key
  - Edge case: payload containing `undefined` values is stripped before write (no Firestore rejection)
  - Error path: `updateDoc` rejection surfaces as a thrown error to the caller

  **Verification:**
  - `saveProjectSnapshot` and `REACT_OWNED_SECTIONS` no longer exist in the file
  - Four new write functions are exported and typed correctly
  - TypeScript build passes

---

- [ ] **Unit 2: Write-channel callbacks in plannerStore and stammdatenStore**

  **Goal:** Add module-level write-callback registration to both stores; call registered callbacks from user-action setters; remove all `markDocumentDirty` / `touchDocumentDirty` calls and `projectDocumentDirtyStore` imports.

  **Requirements:** R1, R4, R5

  **Dependencies:** Unit 1 (function signatures needed to type the callbacks correctly)

  **Files:**
  - Modify: `src/stores/plannerStore.ts`
  - Modify: `src/stores/stammdatenStore.ts`

  **Approach:**

  *plannerStore:*
  - Remove import of `useProjectDocumentDirtyStore` and the `markDocumentDirty` helper
  - Add module-level callback slots: `_onSectionWrite` (cellKey, section, items) and `_onKwWrite` (kwList)
  - Export `registerPlannerWriteCallbacks(onSection, onKwList)` and `clearPlannerWriteCallbacks()`
  - In `setSection`: after updating state, call `_onSectionWrite?.(key, section, rows)`
  - In `addKw` / `removeKw`: after updating state, call `_onKwWrite?.(updatedKwList)` — pass the new list from state, not a stale closure
  - `setWorkItems` and `setKwList` (load-only bulk setters): no callback, no side effects
  - `setProject` unchanged

  *stammdatenStore:*
  - Remove import of `useProjectDocumentDirtyStore` and the `touchDocumentDirty` helper
  - Add module-level callback slots: `_onStammdatenWrite` (stammdaten payload) and `_onMitarbeiterWrite` (mitarbeiter array)
  - Export `registerStammdatenWriteCallbacks(onStammdaten, onMitarbeiter)` and `clearStammdatenWriteCallbacks()`
  - User-action setters (`addBauteil`, `removeBauteil`, `setShiftConfig`, `setProjectForm`, `addMitarbeiterRow`, `updateMitarbeiterRow`, `removeMitarbeiterRow`) call the appropriate callback after updating state
  - Load-only setters (`setFachdienstBauteile`, `setMitarbeiter`): no callback
  - `setShiftConfig` and `setProjectForm` are called by both the listener and user code — mark them as user-action setters (the listener will call `setShiftConfig`/`setProjectForm` but this is acceptable: if CRON or another planner updates stammdaten, we do want to write it back — this scenario is rare and not harmful)

  **Patterns to follow:**
  - Existing `markDocumentDirty` call pattern in `src/stores/plannerStore.ts` (lines 55, 61, 79) — replace with callback pattern

  **Test scenarios:**
  - Happy path: calling `setSection` invokes the registered `_onSectionWrite` callback with correct (cellKey, section, rows)
  - Happy path: calling `addKw` invokes `_onKwWrite` with the updated KW list
  - Happy path: calling `setWorkItems` (load setter) does NOT invoke any callback
  - Happy path: calling `setKwList` (load setter) does NOT invoke any callback
  - Happy path: `clearPlannerWriteCallbacks` prevents callbacks from firing after unmount
  - Happy path: stammdaten user-action setter (`addBauteil`) invokes `_onStammdatenWrite`
  - Happy path: load setter (`setFachdienstBauteile`) does NOT invoke any callback
  - Edge case: callback fires with latest state when called from inside a Zustand `set` (verify state is updated before callback is called)

  **Verification:**
  - No references to `projectDocumentDirtyStore` remain in either store file
  - TypeScript build passes

---

- [ ] **Unit 3: `useAutoSave` hook**

  **Goal:** New hook that registers write callbacks, debounces Firestore writes per data type, and exposes a `syncing` boolean.

  **Requirements:** R1, R2, R5, R6

  **Dependencies:** Unit 1 (write functions), Unit 2 (callback registration API)

  **Files:**
  - Create: `src/hooks/useAutoSave.ts`

  **Approach:**
  - Accepts `(projectId: string | undefined, options: { enabled: boolean })`
  - Returns `{ syncing: boolean }`
  - When `enabled` is false or `projectId` is undefined, does not register callbacks (prevents writes during initial load)
  - On mount with `enabled: true`: calls `registerPlannerWriteCallbacks` and `registerStammdatenWriteCallbacks` with debounced write functions
  - On unmount or when `projectId`/`enabled` changes: calls `clearPlannerWriteCallbacks` and `clearStammdatenWriteCallbacks`
  - Debounce strategy:
    - Cell section writes: debounced ~800ms, keyed per `(cellKey, section)` pair — use a `Map<string, ReturnType<typeof setTimeout>>` so each section has its own timer
    - KW list writes: debounced ~400ms (structure changes, not text)
    - Stammdaten writes: debounced ~800ms
    - Mitarbeiter writes: debounced ~400ms
  - `syncing` state: a counter of pending timers + in-flight Firestore calls; `syncing = pendingCount > 0`
  - Each debounced write: increment pending count when timer starts, decrement when `await write(...)` resolves or rejects; on error, call `useUiStore.getState().showToast(...)` with a brief error message

  **Patterns to follow:**
  - `useUiStore.getState().showToast` pattern in `src/hooks/useProject.ts` for error feedback

  **Test scenarios:**
  - Happy path: `setSection` callback debounces and calls `writeCellSection` after 800ms with correct args
  - Happy path: two rapid `setSection` calls to the same (cellKey, section) result in one `writeCellSection` call
  - Happy path: `setSection` calls to different sections of the same cell each produce independent debounced writes
  - Happy path: `addKw` callback calls `writeKwList` after debounce
  - Happy path: `syncing` is true while a timer is pending and becomes false after the write resolves
  - Edge case: hook disabled (`enabled: false`) — no callbacks registered, no writes fire
  - Edge case: `projectId` changes mid-session — old timers are flushed and new callbacks are registered for the new project
  - Error path: `writeCellSection` rejects — `syncing` returns to false and a toast is shown

  **Verification:**
  - A rapid burst of edits to one section produces exactly one Firestore write after the debounce window
  - Edits to different sections produce independent writes
  - No writes fire during initial project load

---

- [ ] **Unit 4: Simplify `useProject`**

  **Goal:** Remove `save`, `saving`, dirty state, `mergeIntervalleOnly`, and `markClean` from the hook. Simplify the Firestore listener to always apply a full refresh.

  **Requirements:** R3, R4

  **Dependencies:** Unit 2 (load-only setters confirmed to not fire callbacks)

  **Files:**
  - Modify: `src/hooks/useProject.ts`

  **Approach:**
  - Remove `save`, `saving`, `markClean`, `UseProjectReturn.save`, `UseProjectReturn.saving`
  - New return type: `{ loading: boolean; error: string | null }`
  - Remove `saveProjectSnapshot` import from `firestoreService`
  - Remove `useProjectDocumentDirtyStore` import
  - Remove the local `mergeIntervalleOnly` function entirely
  - Simplify the Firestore listener's `else if (snap)` branch (live updates after first snapshot): always do a full refresh — `setKwList`, `setWorkItems`, `setMitarbeiter`. No `dirty` check, no merge
  - Remove `pickStamForm` → keep it or replace with the equivalent function already exported from `projectRemoteSync.ts` (`stamFormFieldsFromSnapshot`) — actually since `projectRemoteSync.ts` is being deleted, inline it or keep `pickStamForm` locally
  - Keep rehydration logic (persist.setOptions / persist.rehydrate) unchanged

  **Patterns to follow:**
  - Existing first-snapshot hydration block in `src/hooks/useProject.ts` (lines 66–87) — the new live-update branch should mirror it

  **Test scenarios:**
  - Happy path: first Firestore snapshot hydrates all stores and sets `loading: false`
  - Happy path: subsequent snapshot (simulating CRON intervalle write) triggers full refresh of `workItems`, `kwList`, `mitarbeiter` via load-only setters — no callbacks fire
  - Edge case: snapshot arrives with `snap = undefined` — stores are cleared to empty defaults
  - Error path: Firestore subscription error sets `error` state

  **Verification:**
  - `save` and `saving` are not exported from `useProject`
  - The Firestore listener has no reference to `dirty`, `mergeIntervalleOnly`, or `projectDocumentDirtyStore`
  - TypeScript build passes

---

- [ ] **Unit 5: Update AppHeader and PlannerPage**

  **Goal:** Remove save button and its props; add sync indicator; wire `useAutoSave` into `PlannerPage`.

  **Requirements:** R6

  **Dependencies:** Unit 3 (`useAutoSave`), Unit 4 (simplified `useProject` return type)

  **Files:**
  - Modify: `src/components/AppHeader.tsx`
  - Modify: `src/pages/PlannerPage.tsx`

  **Approach:**

  *AppHeader:*
  - Remove `onSave` and `saving` from `AppHeaderProps`
  - Remove `dirty` selector from `useProjectDocumentDirtyStore`
  - Remove `useProjectDocumentDirtyStore` import
  - Remove the "Speichern" button element
  - Remove the "Ungespeichert" badge
  - Add `syncing: boolean` prop
  - When `syncing` is true: show a small, unobtrusive indicator near the project name — e.g. a spinner or "●" dot with muted colour. Keep it subtle; this is background activity, not a blocking state

  *PlannerPage:*
  - Update `useProject` call — destructure only `{ loading, error }`
  - Add `const { syncing } = useAutoSave(projectId, { enabled: !loading })`
  - Pass `syncing` to `<AppHeader syncing={syncing} />`
  - Remove `save` and `saving` from `AppHeader` call

  **Test scenarios:**
  - Happy path: `AppHeader` renders without save button
  - Happy path: `syncing=true` shows the sync indicator; `syncing=false` hides it
  - Test expectation: none for PlannerPage wiring — render correctness verified by E2E / manual check

  **Verification:**
  - No `onSave` or `saving` prop on `AppHeader`
  - No `projectDocumentDirtyStore` import in `AppHeader`
  - Sync indicator visible when `syncing` is true, hidden otherwise

---

- [ ] **Unit 6: Delete dead files**

  **Goal:** Remove `projectDocumentDirtyStore.ts` and `projectRemoteSync.ts`; verify no remaining imports.

  **Requirements:** R4

  **Dependencies:** Units 1–5 complete (all imports removed)

  **Files:**
  - Delete: `src/stores/projectDocumentDirtyStore.ts`
  - Delete: `src/lib/projectRemoteSync.ts`

  **Approach:**
  - Grep for any remaining imports of `projectDocumentDirtyStore` and `projectRemoteSync` before deleting
  - Delete both files
  - Run `tsc -b` to confirm no lingering references

  **Test scenarios:**
  - Test expectation: none — deletion verified by TypeScript build

  **Verification:**
  - `tsc -b && vite build` completes with no errors
  - Neither deleted file is referenced anywhere in `src/`

## System-Wide Impact

- **Interaction graph:** `useAutoSave` → store write callbacks → `firestoreService` write functions → Firestore. The `subscribeToProject` listener in `useProject` is unchanged except for the simplified merge logic.
- **Error propagation:** Write errors surface as toasts via `useUiStore.showToast`; they do not block the UI or retry automatically.
- **State lifecycle risks:** The write-callback channel must be cleared on unmount and on `projectId` change to prevent stale-projectId writes. `clearPlannerWriteCallbacks` / `clearStammdatenWriteCallbacks` must be called in the `useAutoSave` cleanup effect.
- **Unchanged invariants:** `subscribeToProject`, `createProject`, `deleteProject`, `listUserProjects`, `loadProject` are not touched. The `ProjectSnapshot` type is not changed. The `extractProjectSnapshot` / `mergeFirestoreSnapshot` pipeline is unchanged.
- **Persist/rehydrate:** Zustand persist is still used for offline cache per project. The rehydration in `useProject` is unchanged. `useAutoSave` should not trigger during rehydration — guaranteed because it is only enabled after `loading: false`, which is set after the first Firestore snapshot resolves.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Write loop: Firestore listener updates stores → callbacks fire → write back | Explicit write-channel pattern: load-only setters have no registered callbacks; only user-action setters do |
| Stale projectId in debounced write callback | `clearPlannerWriteCallbacks` in `useAutoSave` cleanup + callbacks are registered with `projectId` captured in closure |
| Pending debounced writes on unmount (navigating away mid-edit) | Flush pending timers in cleanup, or accept that in-flight writes may complete after unmount — Firestore writes are fire-and-forget; the data arrives correctly regardless |
| `setShiftConfig` / `setProjectForm` called by both listener and user — may write-back during listener refresh | Acceptable: stammdaten is small and rare to change; listener-triggered write of the same data is idempotent |

## Sources & References

- **Origin document (ADR):** `docs/adr/0001-realtime-writes-no-save-button.md`
- Related stores: `src/stores/plannerStore.ts`, `src/stores/stammdatenStore.ts`, `src/stores/projectDocumentDirtyStore.ts`
- Related hook: `src/hooks/useProject.ts`
- Files to delete: `src/lib/projectRemoteSync.ts`, `src/stores/projectDocumentDirtyStore.ts`
- Firestore write pattern: `src/services/firestoreService.ts` (`saveProjectSnapshot`, lines 108–134)
