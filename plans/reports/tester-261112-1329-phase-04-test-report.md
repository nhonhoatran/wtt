# Tester report: phase 04 (uncommitted working tree)

Date: 2026-11-12. Scope: full suite (`--full`), all workspaces. Cache disabled (`turbo --force`) for typecheck, lint, build, test.
Phase spec: `plans/261111-1512-kamito-table-tennis-tournament-platform/phase-04-tournament-master-data-config-and-media-upload.md` (Success Criteria).

## 1. Quality gates

| Gate | Command | Result |
|---|---|---|
| Build shared + db | `pnpm -r --filter @kamito/shared --filter @kamito/db run build` | PASS |
| Typecheck | `pnpm exec turbo run typecheck --force` | PASS 10/10 |
| Lint | `pnpm exec turbo run lint --force` | PASS 7/7, 0 warnings |
| Build | `pnpm exec turbo run build --force` | PASS 7/7 |
| Build warning | admin `dist/assets/index-*.js` 2,526.81 kB (gzip 789 kB) | Non-blocking, Vite chunk > 500 kB |

Note: a first lint/typecheck attempt failed only because `--` forwarded `--force` to tsc/eslint. Re-run with `turbo` directly; numbers above are from the valid run.

## 2. Schema and migrations

- `prisma migrate status` (kamito_tt_dev, localhost:5433): "Database schema is up to date!", 4 migrations found.
- Drift check: `prisma migrate diff --from-config-datasource --to-schema prisma/schema --script` returned an empty migration. Live DB matches `prisma/schema`.
- Not run: `--from-migrations` replay. No `SHADOW_DATABASE_URL` is set (uncommented) in `.env`. I did not create a shadow DB on the shared dev server.
- Nothing applied. No schema changes.

## 3. Test results

Diff-aware mode not used (full suite requested).

| Workspace | Files | Tests | Result |
|---|---|---|---|
| apps/api (vitest, unit + e2e) | 25 | 169 | Run 1 CRASH (see F1). Runs 2 and 3: 169/169 pass |
| packages/shared | 9 | 50 | PASS |
| apps/worker | 4 | 18 | PASS (16 before, +2 new, see section 5) |
| packages/ui-tokens | 1 | 3 | PASS |
| apps/admin (`node --test`) | 1 | 2 | PASS |
| root `scripts/**` (`node --test`) | - | 4 | PASS |

Turbo's `test` task ran first (api failed), so the root `&& node --test scripts` was skipped. I ran it separately: 4/4 pass.

Timing: api full run 71 to 81 s. Slowest files (run 1 log): auth.e2e 3.9 s, session-lifecycle 2.6 s, media-upload 2.4 s, login-hardening 1.8 s, catalogs 1.7 s. The 3 MB jpeg media test takes 644 ms end to end.

### Failures

**F1. Intermittent worker crash in api vitest (medium, flaky).**
- Run 1 output: `Error: [vitest-pool]: Worker forks emitted error ... exit code 3221226505 during started state while running test file apps/api/test/must-change-password.e2e-spec.ts`.
- 3221226505 = 0xC0000409 (Windows STATUS_STACK_BUFFER_OVERRUN / fast-fail). Native crash, not an assertion.
- Result: 24/25 files passed, 167/169 tests run. The 2 must-change-password tests did not run. Vitest reported 1 unhandled error.
- Isolated run of that file: 2/2 pass (5.5 s). Full suite runs 2 and 3: 169/169 pass.
- Frequency: 1 of 3 full runs. Root cause not found. The crash skipped that file's `afterAll`, which leaked 2 users (see F3).
- Suspects, not verified: native code in the same fork process (`sharp` used by media specs, or Nest/bcrypt-type native deps). Check with a repeat loop plus the Windows event log if it matters.

**F2. Spec vs implementation mismatch, `ticketUrl` status code (decision needed).**
- Criterion: `ticketUrl = "javascript:..."` or `http://...` → 400.
- Code and test: 422 with `error.fields.ticketUrl`. Test: `apps/api/test/events.e2e-spec.ts:68-70`. Schema: `apps/api/src/modules/events/event-dtos.ts:51` (`optionalHttpsUrlSchema`).
- Venue map links use the same 422 convention (`venues.e2e-spec.ts:53`). Sort-whitelist violations do return 400 (matches spec).
- Not changed. Pick one: update the spec to 422, or change code and tests to 400.

**F3. Test data leak after crash (low).**
- After run 1 the dev DB `kamito_tt_dev` has 2 users left by `must-change-password`: `e2e-d358e02b@test.kamito.local` (RESULTS_OPERATOR) and `e2e-4cc28251@test.kamito.local` (ADMIN), plus their 2 audit rows.
- Runs 2 and 3 added no new leftovers. Counts before and after are identical.
- Not deleted (left as evidence). Safe to remove with a `@test.kamito.local` sweep after approval.

## 4. Seeded catalog integrity (step 4)

Snapshot before and after the two clean runs: identical.

| Table | Count | Notes |
|---|---|---|
| tier | 1 | `KAMITO` |
| event_type | 2 | `KAMITO_CHAMPIONSHIP`, `KAMITO_OPEN` |
| discipline | 5 | MS, WS, MD, WD, XD |
| match_format | 1 | default, active, still exactly one `isDefault = true` |
| group_scoring_rule | 1 | default, active, still exactly one `isDefault = true` |
| event, venue, venue_table, media_asset, category, sub_event, app_setting | 0 | clean |

- Catalog e2e restores the seeded default flags in `afterAll` (`catalogs.e2e-spec.ts:55-56`). That bumps `updatedAt` on the seeded default rows each run; values are restored. Expected, not a bug.
- Gap, see F5: the "exactly one default" rule is service-level only. No DB-level unique index exists.

## 5. Changes made in this run

- NEW `apps/worker/src/media-worker.test.ts` (2 tests). Covers the env-to-processor wiring that no test covered before: `loadWorkerEnv` → `buildMediaDeps` → `variantWidths`.
  - `MEDIA_IMAGE_VARIANT_WIDTHS='800, 400,800,200'` → `[200, 400, 800]` (sorted, de-duplicated).
  - Default env → `[320, 640]`.
  - Passes. Lint and typecheck pass for the worker.
- No production code changed. Nothing committed.

## 6. Phase 04 Success Criteria → test mapping

| # | Criterion | Proof | Status |
|---|---|---|---|
| 1 | Create event + 5 contents in ≤ 4 clicks | None. Admin has no UI test runner | MISSING (manual) |
| 2a | List filter/sort/paginate returns correct `total` | `catalogs.e2e` tiers paginate/sort/filter (l.62); `events.e2e` lifecycle/year/type/search total (l.94); `venues.e2e` l.44 | PASS |
| 2b | Sort outside whitelist → 400 | `catalogs.e2e` l.80; `events.e2e` l.117-119 | PASS |
| 2c | Delete tier in use → 409 | `catalogs.e2e` l.120-135 (`IN_USE`, dependants counts); also event type, discipline, category, match format, venue | PASS |
| 3 | 3 MB jpeg → READY, 3 webp variants, ≤ 10 s, `incoming/` removed, no original in public | `media-upload.e2e` l.62-100; `media-image-processor.test.ts` l.79-101 | PASS (local driver only) |
| 4a | Oversize file blocked at upload | `media-upload.e2e` l.101 (413, nothing kept). MinIO `content-length-range` path not automated | PARTIAL (local only) |
| 4b | Wrong Content-Type rejected | `media-upload.e2e` l.109 (415 or 422) | PASS |
| 4c | `complete` with unknown or foreign id → 404 | `media-upload.e2e` l.124 | PASS |
| 4d | Fake image (text renamed .jpg) → FAILED | `media-upload.e2e` l.133; `media-image-processor.test.ts` l.116 | PASS |
| 4e | Worker `HeadObject` oversize check (S3 path) | `media-image-processor.test.ts` l.131 (local storage). `s3-object-storage.ts` has no test | PARTIAL |
| 5 | `MEDIA_IMAGE_VARIANT_WIDTHS` change → new sizes, no code change | Env parse: `worker-env.test.ts` l.34. Processor honours injected widths: `media-image-processor.test.ts` l.103. Wiring env → processor: NEW `media-worker.test.ts` | PASS (added) |
| 6a | XSS test set green | `sanitize-rich-html.test.ts` 29 tests; `events.e2e` l.82 (script/onerror stripped, iframe nulled) | PASS |
| 6b | `ticketUrl` javascript: or http: → 400 | `events.e2e` l.67-72 asserts 422 | MISMATCH (F2) |

Also in scope but untested directly: `packages/shared` `tiebreak-criteria.ts`, `tournament-settings.ts`, `app-setting-registry.ts`, `list-settings.ts`, `s3-object-storage.ts`. Tiebreak rules are exercised indirectly through the group-scoring e2e.

## 7. Concerns and recommendations (priority order)

1. **F1 flaky crash.** Repeat the api suite 5 to 10 times to get a rate. Check whether the crash follows `sharp` or another native module. Consider `pool: 'forks'` isolation or per-file process restart so one native crash cannot kill the run.
2. **F2 status code.** Decide 400 vs 422 and align spec or code.
3. **F3 leaked users.** Add a sweep in the auth test kit (`@test.kamito.local` older than the run) or a vitest `globalSetup` cleanup, so crashes cannot leak rows.
4. **F4 S3/MinIO path untested.** Add an integration test against MinIO (`content-length-range`, `HeadObject` oversize check, incoming delete). MinIO is not running here (port 9000 closed), so this was not run.
5. **F5 default-row invariant.** No partial unique index on `MatchFormat.isDefault` or `GroupScoringRule.isDefault` in migrations (only the column definitions in `20261112061544_add_tournament_master_data/migration.sql:95,116`). Concurrent writes could leave two defaults. Suggest a new migration with `CREATE UNIQUE INDEX ... WHERE "isDefault"`. Requires the repo owner to approve a schema change.
6. **F6 no coverage tooling.** `@vitest/coverage-v8` is not installed and the vitest preset has no coverage config. No line/branch/function percentages could be produced. Adding it changes `package.json` and the lockfile, so I did not add it.
7. **F7 UI criterion.** The "≤ 4 clicks" criterion has no automated check. Needs Playwright or manual QA.
8. **F8 admin bundle.** 2.5 MB JS chunk. Code-split the admin routes (catalog and settings editors are the likely heavy parts).

## 8. Commands run

- `pnpm -r --filter @kamito/shared --filter @kamito/db run build`
- `pnpm exec turbo run typecheck --force`, `... lint --force`, `... build --force`, `... test --force`
- `node --test "scripts/**/*.test.mjs"`
- `pnpm --filter @kamito/api test` (x2 clean)
- `pnpm exec vitest run test/must-change-password.e2e-spec.ts` (in apps/api)
- `pnpm exec vitest run src/media-worker.test.ts` (in apps/worker)
- `pnpm exec prisma migrate status`, `pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema --script` (read-only)
- Read-only Prisma count and select scripts (temporary, deleted after use)

## Unresolved questions

- Which status code is canonical for invalid `ticketUrl`: 400 (spec) or 422 (code and venues convention)?
- Is a MinIO integration test required in phase 04, or is the manual verification in the spec accepted?
- Approve adding `@vitest/coverage-v8` for coverage numbers?
- Delete the 2 leaked `@test.kamito.local` users in `kamito_tt_dev`?
- Add a partial unique index for the single-default rule (new migration)?
