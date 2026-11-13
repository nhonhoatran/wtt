# Tester report: phase 06 full suite (uncommitted, main)

Date: 2026-11-13. Scope: full verification of uncommitted phase 06 changes. No app code changed. Tests not weakened.

## Gate results

| Check | Command | Result |
|---|---|---|
| Typecheck | `pnpm typecheck` | PASS, 12/12 tasks (9 packages). Log: /tmp/tc.log |
| Lint | `pnpm lint` | PASS, 8/8 tasks, no warnings |
| Build | `pnpm build` | PASS, 8/8 tasks. 1 warning: `@kamito/admin` chunk >500 kB (not an error) |
| Migrations | `pnpm --filter @kamito/db exec prisma migrate status` (read-only) | "Database schema is up to date!" 11 migrations on disk = 11 applied on `kamito_tt_dev` localhost:5433 |
| Tests | `pnpm test` | PASS, 10/10 tasks, exit 0, 3m07s |
| Coverage | `pnpm --filter @kamito/competition-engine test:coverage` | PASS, see below |

Infra: `kamito-tt-dev-postgres-1`, `-redis-1`, `-s3-1` were up (healthy). No restart needed.

## Test results per package (from `pnpm test`)

| Package | Files | Tests | Result | Duration |
|---|---|---|---|---|
| @kamito/ui-tokens | 1 | 3 | 3 pass | 2.0s |
| @kamito/competition-engine | 18 | 178 | 178 pass | 3.9s |
| @kamito/shared | 15 | 83 | 83 pass | 4.0s |
| @kamito/worker | 6 | 30 | 30 pass | 7.9s |
| @kamito/api (unit + e2e) | 41 | 298 | 298 pass | 179s |
| @kamito/admin (node --test) | - | 5 | 5 pass | 8.5s |
| scripts (node --test) | - | 4 | 4 pass | 0.2s |
| @kamito/db | - | no test script | n/a | - |

Total: 601 tests, 601 pass, 0 fail, 0 skipped.

## Phase 06 specs (run alone, extra check)

Command: `cd apps/api && npx vitest run test/draws.e2e-spec.ts test/draw-post-publish.e2e-spec.ts test/group-standings-concurrency.e2e-spec.ts test/draw-locks.e2e-spec.ts`

- 4 files, 41 tests, all pass, 18.8s. Log: /tmp/phase06.log

Included in the 298 api run above (all 41 api files passed).

## Known flaky test

`apps/api/test/imports-worker.e2e-spec.ts`, "stops a zip whose central directory entries all point at one big local entry":
- Full run: passed.
- Alone: 23/23 pass.
- Status: not reproduced. One run each, so no flake evidence either way.
- No changes in `apps/api/test/imports-worker.e2e-spec.ts`, `apps/worker`, or the import module (git status clean for those paths). No link to phase 06 found. Base-commit comparison not needed.

## Coverage: @kamito/competition-engine

| Metric | Value | Target |
|---|---|---|
| Statements | 99.31% (580/584) | ≥90% |
| Branches | 97.69% (381/390) | - |
| Functions | 100% (115/115) | - |
| Lines | 99.57% (464/466) | ≥90% PASS |

Uncovered lines (minor):
- derive-matches.ts:129
- draw-preview.ts:58 (branch)
- allocation file (`...-allocation.ts`):28 (branch)
- match-scoring file (`...tch-scoring.ts`):55, 64 (branch)
- placement file (`...t-placement.ts`):61 (branch)
- generator file (`...t-generator.ts`):68
- generator file (`...n-generator.ts`):47 (branch)
- resolver file (`...k-resolvers.ts`):55

Full names truncated by the coverage reporter. Use `pnpm --filter @kamito/competition-engine test:coverage` with a wider reporter to get them.

## Failures and root causes

None. No failing tests.

## Concerns (non-blocking)

1. Build warning: `@kamito/admin` main chunk >500 kB after minify. Warning only. Consider code-splitting (`build.rolldownOptions.output.codeSplitting` or dynamic `import()`) later. Not checked against base.
2. Noise in api full run log: multiple `Unique constraint failed on the constraint: ...` lines (`User_email_key`, `Entry_subEventId_stage_seed_key`, `Round_drawId_scopeKey_number_key`, `VenueTable_venueId_code_key`, `Tier_code_key`). All tests passed. Lines are probably from negative-case tests that trigger conflicts on purpose. Source spec not pinned down. Not a failure.
3. api e2e is the slow part: 179s, 34% test time, 64% import. No per-test slow-test analysis done.
4. Coverage uncovered lines are branch-level in the engine. Not a blocker.

## Not done

- No per-test timing breakdown (no slow-test list).
- No base-commit comparison (not needed, no failures).
- No repeated runs for flake detection beyond the single full run and single alone runs.
- `@kamito/db` has no test script, so no db tests ran. Schema and migrations verified only via `migrate status`.

## Unresolved questions

- Which spec emits the unique-constraint log noise? Harmless, but worth a look if it hides real errors.
- Is the admin chunk warning accepted for this phase, or should code-splitting be a follow-up?

**Status:** DONE_WITH_CONCERNS
**Summary:** Typecheck, lint, build, migrate status and full test run all pass. 601/601 tests pass. Competition-engine coverage 99.57% lines. Phase 06 specs 41/41 pass alone.
**Concerns/Blockers:** Admin chunk >500 kB build warning. Unique-constraint log noise (non-failing). No blockers.
