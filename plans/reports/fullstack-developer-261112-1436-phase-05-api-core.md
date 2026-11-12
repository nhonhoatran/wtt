# Phase 05 API core: players, pairs, entries, merge

## Files
- apps/api/src/modules/players/: admin-players.controller, players.service, player-merge.service, player-merge-preview, player-dtos, player-views, player-birth, players.module
- apps/api/src/modules/pairs/: admin-pairs.controller, pairs.service, pairs.module
- apps/api/src/modules/entries/: admin-entries.controller, entries.service, entries-query.service, entry-bulk-actions.service, entry-eligibility.service, entry-dtos, entry-view, entry-errors, entries.module
- sub-events.service.ts: delete with entries -> 409 SUB_EVENT_HAS_ENTRIES
- app.module.ts: Players/Pairs/Entries registered (lead added Imports/Exports; kept)
- packages/shared: entry-eligibility.test.ts, age-on-event.test.ts, normalize-person-name.test.ts
- apps/api/test: players, entries, player-merge e2e specs + support/entries-fixtures.ts (extra helper file, not in ownership list)

## Endpoints
Exactly per contract (players CRUD/lookup/merge preview/merge with step-up, pairs list, entry-counts, sub-event entries list/create, PATCH entry, bulk).

## Tests
- shared: 13 files, 76 tests pass
- api e2e players+entries+merge+sub-events+permission-coverage: 5 files, 42 tests pass (players 9, entries 16, merge 6)
- Full api suite earlier run (31 files): all passed except one test bug since fixed
- typecheck, lint, shared build clean

## Deviations / notes
- MERGE_CONFLICT conflicts are returned in `error.issues` (filter only passes `issues`), not `error.conflicts`.
- POST /admin/players/merge and POST /admin/entries/bulk return 200 (not 201).
- Entry list `q` also matches members' accent-free normalizedName, not just displayName.
- Player `entryCount` counts all-status entries incl. via pairs. Merge `movedEntries` = entries involving source (incl. via pairs re-pointed in place).
- Withdraw (single and bulk) clears seed to null, old seed in audit before; reinstate does not restore it.
- Draw hooks (entriesInLockedDraw) are still phase-06 stubs, so ENTRY_IN_PUBLISHED_DRAW path is untested.
- Found advisoryLock void bug; lead fixed, merge now uses shared advisoryLock and passes.

## Open questions
- none
