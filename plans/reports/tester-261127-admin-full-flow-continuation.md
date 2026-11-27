# Admin desktop/mobile continuation — 2026-11-27

Status: desktop and mobile accepted after checking final browser, shutdown and cleanup evidence. T2 remains open; no native-crash fix is inferred.

## Environment and ownership

- Native Windows Node 26.13.1, libuv 1.52.1, V8 14.6.202.34-node.40; database/Redis services run in WSL2 Docker.
- Confirmed test target `localhost:5433/kamito_tt_phase12_test`; isolated UUID queue/storage/account/catalog fixtures. No developer/staging database reset or environment-file edit.
- Tracked runner `scripts/admin-full-flow.mjs`; API dist 3371, admin preview 3372, Next production 3373; workers 1, retries 0.
- Desktop 1440×900 and mobile 390×844 with touch emulation. This is Chromium coverage, not a physical-device/browser matrix.

## Recovery before new tests

The historical desktop `925594be-4063-447f-b0ed-66aaec68100a` journal contained eight completed steps and `PASSED`, but no final runner result or cleanup evidence. Its owner PID 4236 and all service processes were absent, with ports 3371–3373 free. It is not counted as a newly accepted full run.

Ran only its manifest-owned cleanup with the exact world/run/UUID namespace. The cleanup independently checked zero active Redis workers and all ownership guards. `full-ui-cleanup.json` reports every residual counter zero; `recovery.json` records the recovery checks, unchanged root environment during recovery and the original finalization limitation. Only then was the stale lease removed. No native-crash cause is inferred from the missing finalization.

## Fresh verification

| Gate | Result and evidence |
|---|---|
| Production build before desktop | 9/9 tasks, exit 0; desktop run `55081e38-bb68-4296-a317-941f9ca6a3b0/build.log` |
| Admin lint after consent helper copy | Exit 0; `test-results/261127-debt-verification/continuation-admin-lint.log` |
| Latest API/worker/admin lint and typecheck | 6/6 gates exit 0, no ESLint/TypeScript diagnostics; `test-results/261127-debt-verification/reviewer-{api,worker,admin}-{lint,typecheck}.log`. PowerShell stderr-banner wrapper labels in raw logs are documented in the independent review |
| Latest production build before mobile | 9/9 tasks, exit 0 (4 cached), 33.006s; includes the approved private-profile defaults |
| Consent-stage React component browser | 22/22, exit 0, 79.395s; HTTP mocked, separate from full stack. Includes 4 scheduling-modal cases and 4 actual PlayerCreate cases across 390/1440. Final date-hook verification is recorded below. [Report](tester-261127-admin-modal-continuation.md) |
| Consent API regression | 6/6 files, 61/61 tests, 60.43s; private default, explicit opt-in/PATCH preservation, public privacy/names/sitemap/payload and real import-worker integration; `test-results/261127-debt-verification/consent-api.log` |
| Worker regression | 9/9 files, 46/46 tests, 2.49s; new imported players stay private and existing linked players retain flags; `test-results/261127-debt-verification/consent-worker.log` |
| Complete API before commit | 129/129 files, 773/773 tests, exit 0, 645.67s after the private-default and fixture changes; `test-results/261127-debt-verification/precommit-api-full.log`. A single guarded test-DB lease was released on completion |
| Migration 20 and generated DB build | Applied only to the confirmed test DB; DB default false, build 2/2. Inventory had 0 existing players: retention is supported by SQL with no UPDATE and the separate API PATCH regression, not an empirical old-row migration test |
| Native runner regression | 14 passed, 1 POSIX-only skip on Windows; no automatic retry or suppression. [T2 investigation](debugger-261127-native-windows-t2.md) |
| Full desktop | Accepted: 1 browser spec, 8/8 steps, 60 public-refresh checks, 9.3m; run `desktop-55081e38-bb68-4296-a317-941f9ca6a3b0`. Final runner passed, worker exit 0, all cleanup residual counters 0 and root env unchanged |
| Full mobile | Accepted on latest defaults: 1 browser spec, 8/8 steps, 60 public-refresh checks, 6.2m; run `mobile-d6121820-32f8-4c66-9f1a-ea2db98f476e`. Runner exit 0/passed true, worker exit 0, all cleanup residual counters 0, root env unchanged, exclusive lease removed |

The full flow creates an event, imports 40 singles and 12 doubles entries with an ambiguous-player decision, publishes four draws, replaces an entrant, manually schedules matches, previews/cancels/applies automatic scheduling, prints match sheets, enters/amends/reopens results with role/step-up checks, withdraws a group entrant, places qualifiers, finishes finals, publishes ranking snapshots, and verifies rule effective dates against old and new events. Desktop's production build predates the approved default changes; the API/worker/component suites and mobile use the latest defaults.

Accepted shutdown evidence distinguishes graceful worker exit 0 from deliberate taskkill of API/admin/client at teardown (exit 1). No native crash is inferred from those intentional service stops. Existing build chunk-size and pg client-query warnings are not treated as native failures.

Measured response-to-public-refresh checks: desktop 60 samples, 531–1406ms (mean 977.77ms); mobile 60 samples, 468–1173ms (mean 777.35ms). These are local functional-run observations, not load-test or production latency commitments. Desktop cleanup removed 252 owned Redis keys; mobile removed 209. Both verified two journaled events against two cleaned events, with zero remaining owned DB objects/Redis keys.

## Visual scope

Root opened desktop `auto-schedule-preview.png` and `auto-schedule-applied.png` from the fresh run. The preview is readable and the applied schedule retains manual assignments alongside 33 new assignments. The full-page capture of the preview cuts the overlay at the viewport edge; the helper separately activates the apply/cancel controls. No claim that this single capture displays every modal row/control.

Root also opened desktop `step-7.png` (published ranking) and `match-sheets-print.png` (three readable sheets; unknown opponents remain blank). This is PNG inspection, not a fresh audit of every physical PDF page.

Root opened mobile `auto-schedule-preview.png` and `step-7.png`; the independent tester opened nine captures: steps 1/2/5/6/7/8, preview/applied grid and print PNG. The mobile proposal shows 31 new assignments, preserves the three manual assignments and keeps the wide proposal/ranking tables inside horizontal regions. The actual UI preview/cancel/reopen/apply checks passed. As on desktop, the fixed overlay's footer falls outside the full-page preview capture; screenshot inspection alone does not establish footer visibility. Long UUID fixture names make grid rows tall through wrapping, without observed overlap in the inspected captures. No blocking visual defect was found within this scope. The step-4 capture is the admin page, not the operator score drawer; these captures do not establish visual clipping coverage for the score-entry/reopen dialogs. The print PNG does not audit every PDF page.

Component modal evidence covers smaller proposals at 390/1440 and stale-409 recovery; it does not replace a production-sized proposal. The four actual PlayerCreate screenshots independently show the private default and explicit opt-in on both widths. Broader public-page visual gaps and final whole-working-tree review remain separate C11/E/F work.

## Decisions and remaining limits

The user approved the G1 proposal, G2 mechanisms pending the real points matrix, and external BTC storage of consent evidence in this session. [Decision record](../261127-debt-closure/btc-consent-decisions.md) separates these approvals from participant consent and official points-table acceptance. New-profile defaults now agree across schema/API/admin/import: private until explicit opt-in, noindex on. New G1 seeds use KEEP_PLAYED_RESULTS; existing rules/players are not backfilled. Synthetic public fixtures opt in explicitly to retain positive serializer/link coverage; those fixtures are not evidence of real consent.

T2 remains open: 30 clean upstream-reproducer trials do not diagnose the historical crash. The runner now retains runtime, timestamps and hexadecimal exit status. Local browser acceptance does not close staging/infrastructure, official points-table or participant-evidence gates.

## Precommit date-hook correction

The final independent review found that reopening a still-mounted ranking modal after business midnight could initialize its form from cached yesterday data. The API permits that past date, so server date guards cannot prevent the unintended default. The hook now resets its query-observer baseline on each enable transition and waits for the first successful fetch of that opening. A bounded readiness state also blocks retained cached data after an initial error/retry while preserving an already initialized form through later background refresh errors.

Both accepted full-stack runs above predate this final hook correction. Its actual-route browser regression and fresh admin gates are recorded separately; no additional full-stack rerun is claimed.

Final verification passed: the eight actual-route date cases cover both ranking forms at 390/1440, held success, initial error/retry, and preservation of edited dates through a later background error. The complete admin component browser suite passed 30/30 with no skips in 152.228s. Admin lint, typecheck and production build also exited 0 after the final hook change. Logs: `test-results/261127-debt-verification/admin-ranking-date-final.log` and `precommit-admin-final-{lint,typecheck,build,browser}.log` in the same directory. These browser cases mock HTTP and do not add a new full-stack acceptance run.
