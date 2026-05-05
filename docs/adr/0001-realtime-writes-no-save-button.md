# Real-time section writes replace the save-button model

The app previously used an optimistic write model: planner edits accumulated in Zustand, a dirty flag tracked unsaved state, and a manual save built a full project snapshot and wrote it to Firestore — deliberately excluding the `intervalle` section to avoid overwriting CRON-written track interdiction data. This produced three coupled mechanisms (dirty store, `mergeIntervalleOnly`, `REACT_OWNED_SECTIONS`) that all defended the same invariant: CRON owns `intervalle`; the React app owns everything else.

We replaced this with **real-time section-level writes**: every planner edit immediately writes the affected section (`tasks`, `personal`, `inventar`, `material`, or `fremdleistung`) to Firestore as a targeted field update, debounced ~800ms for text input and immediate for add/delete/status changes. The Firestore listener now always applies a full state refresh — no conditional merge. The three defensive mechanisms are deleted.

The write-authority separation is now structural rather than runtime-managed: CRON writes `snapshot.workItems.<key>.intervalle`; the React app writes the other five sections. They never touch the same Firestore field, so no coordination is required.

## Considered options

**Keep the save button, fix the coupling** — We could have introduced a Zustand middleware to auto-mark dirty and moved `REACT_OWNED_SECTIONS` into a typed module. This would have cleaned up the code but left the fundamental tension intact: a bulk save still needs to know which sections to skip, and the dirty/merge logic still needs to exist somewhere.

**Entry-level writes (one Firestore write per resource row)** — More granular and concurrent-edit-safe (two planners adding to the same cell simultaneously would not clobber each other). Rejected for now because concurrent editing is not a current operational scenario (single primary user) and section-level writes are significantly simpler to implement and reason about.

## Consequences

- No save button in the UI. A sync indicator (e.g. spinner on last-write) may be added for feedback.
- Last-write-wins at the section level. If two planners simultaneously modify the same section of the same Shift Cell, one change is silently lost. Acceptable given the current single-user context; if multi-planner concurrent editing becomes real, upgrade to entry-level writes or sub-collection storage.
- `Zusätzlicher Bedarf` (planner-authored additional track interdiction requests) becomes straightforward to implement as a new planner-owned section — it writes like any other section with no special coordination needed.
