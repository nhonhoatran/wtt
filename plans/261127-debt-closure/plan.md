---
title: Debt closure
status: in-progress
priority: P1
effort: large
branch: main
tags: [debt, admin, scheduling, public]
created: 2026-11-27
---

# Debt closure — 2026-11-27

## Scope and reviewed approach

Implement the actionable debts confirmed by the 2026-11-27 audit. The planning review approved the work below with these safeguards: use the configured business timezone, validate publishing legacy future snapshots, never infer job success from HTTP 404, and retain fixture/database ownership guards in the tracked runner.

## Workstreams

- [x] A — Validate ranking rule dates, manual point dates, draft dates and publish dates at the API; make admin ranking dates follow the business timezone. Add regression coverage.
- [x] B — Retain failed/unknown snapshot-job outcomes, preserve visible error feedback, and provide safe retry/history behavior for missing jobs (E4).
- [x] C — Constrain import candidate selection to the mobile viewport without losing candidate identity, keyboard access or desktop usability (E2).
- [x] D — Track a reproducible admin-full-flow runner and support code; keep only generated evidence ignored. Document safe execution and check CI coverage.
- [ ] E — Run available regression tests, lint, typecheck, build and browser/visual checks; investigate runtime failures from fresh evidence. Record unavailable infrastructure separately.
- [ ] F — Independently review changes, synchronize plans/debt ledger/docs and write a technical journal.
- [x] G — Add nullable discipline colors through migration, catalog API/admin and schedule borders/legend; keep discipline text and neutral fallback.
- [x] H — Add server-side automatic scheduling proposals ordered by dependency/round, preserving existing scheduled matches, table/session capacities, player conflicts and configured minimum rest. Preview first; apply an unchanged proposal atomically with schedule-version checks and audit/cache updates.
- [x] I — Add public bilingual `/search` for tournaments and players using existing filtered APIs, SSR, no search-result caching, existing rate limits and safe metadata. Enable the header search entry; avoid inventing a news/full-text API.

## Verification

- Add focused tests that expose the old behavior and pass after each fix.
- Run repository gates after dependency installation and generated workspace prerequisites.
- Use an isolated local PostgreSQL database ending in `_test` and an owned Redis namespace for integration/browser fixtures. Do not alter developer data or environment files.
- Inspect changed mobile selection feedback and relevant generated print output when a runnable browser stack is available.
- Do not equate tests using mocks with API/browser or staging acceptance.

## External/product gates

- S1/S2 require infrastructure details and organizer decisions (G1/G2/consent); no credentials or approvals will be invented.
- The user approved all three [BTC/consent decision bundles](./btc-consent-decisions.md) in this session on 2026-11-27: G1 including KEEP_PLAYED_RESULTS/no club avoidance; G2 mechanisms including 365 days and manual snapshot publication; external consent evidence with new profiles hidden until confirmation, age off/noindex on. Official ranking points/effective date and each person's consent evidence remain outstanding. Default/seed implementation is tracked separately; no old rows are backfilled or treated as evidence.
- D1/D2 concern developer database cleanup. Inventory and cleanup require the actual target and must preserve unrelated data; no blanket database reset.
- User clarification: staging is handled by the owner; use a freshly seeded WSL2 test database. L3/L5 and `/search` are now explicitly included in this iteration. Follow the recommended approaches in the existing open-questions records (nullable color; greedy scheduling preview then apply; search events and players).
- T2 remains open: installed Windows Node 26.13.1 has the upstream shutdown guard, 30 bounded upstream reproducer trials passed, and no matching Application event/dump was found. Runner exit records now retain timing/runtime/Windows hex status; no retry or automatic runtime change. [Diagnosis](../reports/debugger-261127-native-windows-t2.md). An unobserved native crash is not marked fixed.

## Progress

Planning review complete. A/B/C/D/G/H/I implemented with scoped regression/review evidence (7/9 workstreams); broader final E/F remain in progress. H has backend review/integration, component stale/cancel checks and accepted desktop/mobile full-flow preview/cancel/apply. No `phase-XX` children exist under this plan; the related redesign plan was swept across all 22 phases, now 158 checked/2 open (C11 final visuals/review).

| Work | Evidence and limits |
|---|---|
| A | API guards cover retroactive rules, future manual points/drafts and old future drafts at publish. Shared business-day context replaces browser calendar defaults/expiry. Fresh service unit 13/13 and admin labels 2/2 passed; API regression and final root gate recorded separately. |
| B | Node 7/7, real React browser with mocked HTTP 9/9; two HEAD negative controls fail on the old loss of error/404 feedback. [Report](../reports/tester-261127-debt-closure-client.md) |
| C | Real component browser 3/3 at 320/390/1440; mobile old geometry fails, candidate identity/pointer/keyboard verified. [Report](../reports/tester-261127-import-colors-runner.md) |
| D | Runner tracked under scripts, exclusive lease/target guard/process tree/interrupt/logging tests. Initial Windows 13 passed/1 POSIX-only skip; root Linux container 14/14. After T2 diagnostics, fresh Windows 14 passed/1 POSIX-only skip, retaining failure and no retry. New full-flow execution still under E. [Review](../reports/code-review-261127-debt-closure-search-runner.md), [diagnosis](../reports/debugger-261127-native-windows-t2.md) |
| E (partial) | Public production: 126 passed/16 intentional skips, 0 failures/flaky, 80 axe scans without violations; 80 captures plus 4 extras reviewed with explicit scope gaps. Native desktop `55081e38…` and mobile `d6121820…`: each passed all 8 steps/60 refresh checks, worker exit 0, cleanup counters 0, root env unchanged, leases released. Desktop predates approved profile/default changes; mobile uses the later build. Broader whole-diff review/visual gaps remain. [Visual review](../reports/tester-261127-public-visual-review.md), [admin continuation](../reports/tester-261127-admin-full-flow-continuation.md) |
| G | Migration 19 applied only to confirmed test DB, DB generated/built; API integration 5/5, DTO 6/6, helper 2/2, browser 390/1440 2/2. [Report](../reports/tester-261127-import-colors-runner.md) |
| H | Backend review plus focused integration/engine/classifier 21/21; real component modal 4 cases cover cancel/session changes and stale 409 at 390/1440. Desktop/mobile full-flow preview/cancel/apply accepted, preserving manual assignments; production captures inspected with footer capture limits retained. [Backend review](../reports/code-review-261127-auto-schedule-backend.md), [modal review](../reports/tester-261127-admin-modal-continuation.md), [full flow](../reports/tester-261127-admin-full-flow-continuation.md) |
| I | SSR vi/en events and players, no-store, current privacy serializers/rate limits, noindex; unit 8/8 and independent review passed. Empty/results search captured in both languages/viewports in the production run under E. [Review](../reports/code-review-261127-debt-closure-search-runner.md), [visual review](../reports/tester-261127-public-visual-review.md) |
| Approved defaults | Schema/API/admin/import default new profiles to hidden; explicit opt-in remains available after BTC's external check. G1 seed uses KEEP for new rules and preserves existing rules. Migration20 only ALTER DEFAULT false applied to the test DB; 0 existing players means that inventory does not demonstrate retention. API 6 specs/61 tests, worker 9 files/46 tests and component browser 22 tests passed, including actual PlayerCreate default/opt-in at 390/1440. API separately verifies explicit true/PATCH omission preserve flags. Latest-code mobile full-flow passed. Scoped API/worker/admin lint+typecheck 6/6 also passed. [Decision record](./btc-consent-decisions.md), [browser/default review](../reports/tester-261127-admin-modal-continuation.md) |

Client regression remains 199/199 from the earlier build; latest approved-default checks are API 61/61, worker 46/46 and component browser 22/22. Earlier worker44/component14 results remain historical subsets/builds, not extra unique cases. Scope includes G–I by the user's follow-up. The default-only migration has no backfill; API preservation tests are separate from its empty pre-migration inventory. G2's official matrix and applied consent evidence remain outstanding. T2 is open; no new clean run alone proves the native crash fixed.
