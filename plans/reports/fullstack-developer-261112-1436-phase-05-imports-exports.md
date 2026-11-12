# Phase 05 - Excel import + export (fullstack-developer)

Status: DONE_WITH_CONCERNS (minor, see Deviations)

## Files
API (apps/api/src/modules/imports): imports.module, admin-imports.controller, imports.service, import-rows.service, import-template.service, import-template-content, import-dtos, import-queue, import-upload-stream.
API (modules/exports): exports.module, admin-exports.controller, entries-export.service, xlsx-stream.
Worker: import-worker.ts, processors/{import-validate,import-commit,import-file-cleanup}-processor.ts, import/{import-row-types,player-matcher(+test),entry-row-mapper,row-evaluator,validation-context,player-lookup,commit-row,xlsx-zip-guard,xlsx-row-reader,import-deps,import-job-state}.ts; edits: main.ts, worker-env.ts(+test), media-worker.test.ts (env base only).
Config: .env.example, docker-compose.yml (worker env, NODE_OPTIONS=--max-old-space-size=${WORKER_MAX_OLD_SPACE_MB:-384}, mem_limit ${WORKER_MEM_LIMIT:-512m}), docs/deployment-guide.md.
Tests: apps/worker/src/import/player-matcher.test.ts (9), apps/api/test/{imports-worker,imports}.e2e-spec.ts (12 + 2), support/import-test-kit.ts.

## Perf (dev, local Postgres + local storage)
validate 1000 rows: 477 ms. commit 980 rows (980 new players + entries): 8.9 s. Targets 30 s / 60 s.

## Tests
worker 29 pass; api 231 tests pass (one transient worker-process crash on express-router-allowlist in the full run, passes on rerun). Typecheck + lint clean both packages. Covered: 20 errors at right rowNo, commit twice no extras, same new player in 2 rows = 1 player, entry added between validate/commit not duplicated (UPDATE_ENTRY), interrupted commit resumes (200 then 250), player changed -> row ERROR not crash, hash change -> FAILED, oversize/non-zip/zip bomb (150 MB inflated, rss growth <100 MB)/bad header/too many rows, cleanup, full API flow, template + export parsed back.

## Decisions
- Zip guard: fflate streaming Unzip counts real inflated bytes; also compares local-entry count to central directory count (blocks crafted mismatch).
- Overridable eligibility problems are stored as ERROR with data.overridable=true; commit with ADMIN overrideReason also picks these rows. Rows with an unresolved NEEDS_CONFIRM slot skip eligibility/duplicate checks in preview; commit re-checks everything.
- Commit-time failures (player changed, duplicate in file, capacity, seed taken, ineligible) mark the row ERROR and continue; job still DONE.
- createdEntityIds = {playerIds, createdPlayerIds, newPlayerKeys, entryId, action}; newPlayerKeys lets a retry reuse players created earlier.
- candidatePlayerIds JSON = {"1":[ids],"2":[ids]}.
- Qualifying stage rejected when sub-event hasQualifying=false; seed uniqueness checked in file and DB.
- PATCH decision also allowed on VALID rows that already have decisions (re-decide); superset of contract.
- uploaded: AWAITING_UPLOAD -> VALIDATING directly (UPLOADED not written).
- Commit with 0 valid rows and no override -> 409 NOTHING_TO_COMMIT; non-creator non-ADMIN -> 403.
- Rows list does not use prismaListQuery (ImportRow has no id column for its tiebreak).

## Deviations / concerns
- Wrote import-upload-stream.ts instead of reusing media receiveUpload: that one hardcodes "Anh" error messages. Could be generalised later.
- worker-env now requires IMPORT_MAX_FILE_BYTES/UNZIPPED/ROWS (compose passes them to worker); CI/other worker env sources must set them (I updated worker tests; check .github workflow if it runs worker with a bare env).
- docs/deployment-guide.md row listing IMPORT_MAX_* still says "api" only.
- No schema changes. app.module registration done by lead.

## Open questions
- Should FAILED validation jobs be re-validatable (new "Kiểm tra lại")? Currently the operator uploads a new import.
- Template data-validation range = effective maxRows+1 rows.

**Status:** DONE_WITH_CONCERNS
