---
date: 2026-11-27
status: in-progress
plan: plans/261127-debt-closure/plan.md
---

# Plan/docs sync for admin E2E, BTC/consent and T2

## Scope and result

Swept every one of the redesign plan's 22 phase files, then reconciled the debt plan, ledger and deployment runbook against reports and final runtime artifacts. The root accepted desktop and mobile; H/L5 is complete. Broader debt-plan E/F and redesign C11 retain their remaining review/visual scope.

| Plan | Verified checklist state | Remaining |
|---|---|---|
| Debt closure | 7/9 workstreams checked: A/B/C/D/G/H/I | Broader E final gates, F whole-diff review/sync |
| Figma redesign | 158/160 checked across 22 phase files | C11 complete capture scope and final diff/tester review |
| A8 | 10/10 checked; existing redesign scope complete | New automatic scheduling H/L5 also completed with separate backend/API/UI evidence |

Original phase 01–12 checkboxes/status are unchanged. Phase 12's question record now carries the 2026-11-27 approvals and a correction to the historical question 22; it does not close staging. There are no phase child files under the debt-closure plan, so its workstreams map directly to `plan.md`.

## Evidence mapped

- D runner/runbook/CI integration: tracked source, target/lease/process/cleanup guards and independent [review](code-review-261127-debt-closure-search-runner.md). Initial Windows 13+1 skip and Linux 14/14 are separate from the newer Windows 14+1 skip after diagnostics.
- Existing public production: 126 passed/16 intentional skips, 0 failures/flaky; 80 axe scans with no violations; all 80 captures and four extra raw images opened. [Visual review](tester-261127-public-visual-review.md) explicitly excludes several routes/variants from fresh visual acceptance. The C11 image checkbox stays open for that reason.
- Existing gates in `test-results/261127-debt-verification/`: typecheck 14/14, lint 9/9, build 9/9, client unit 199, admin unit 109, browser components 14. These are distinct runs; their results are not added to make a full-stack count.
- H: [backend review](code-review-261127-auto-schedule-backend.md) plus 21/21 focused API/engine/classifier; four component cancel/session/stale-409 cases at 390/1440; root accepted desktop/mobile preview/cancel/apply and actual captures. Each keeps three manual assignments; desktop adds 33 and mobile 31. These satisfy H's scoped acceptance without closing whole-site visual/review gates.
- Root accepted desktop `55081e38-bb68-4296-a317-941f9ca6a3b0` and mobile `d6121820-32f8-4c66-9f1a-ea2db98f476e`: each 8 steps/60 refresh checks, runner passed/environment unchanged, worker exit 0, all residual counters 0, leases released and final ports free. Desktop predates the newly approved defaults; mobile uses the later build (9/9 build tasks), 6.2 minutes, refresh range 468–1173 ms. The final captures do not show every overlay footer/control; separate interaction tests cover their operation. [Continuation report](tester-261127-admin-full-flow-continuation.md).
- Independent reviewer opened nine mobile captures (steps 1/2/5/6/7/8, automatic preview/applied and print PNG), without a blocking finding. The step-4 screenshot is the admin page, not the operator score/reopen drawer; those dialog clipping states lack visual evidence. The preview footer is outside its capture, and the new PDF has no whole-page audit. Functional control checks passed separately. C7's older eight-PDF/40-page audit is distinct.
- [T2 diagnosis](debugger-261127-native-windows-t2.md): Node 26.13.1 includes the relevant upstream shutdown guard; 30/30 bounded reproducer children passed. No matching Application event or dump. Metadata improves future attribution; T2 remains open.
- [BTC/consent decisions](../261127-debt-closure/btc-consent-decisions.md): the user approved all three bundles in this session on 2026-11-27. G1 KEEP/no club avoidance and G2 mechanisms are approved; the official points matrix/effective date and first publication period remain missing. BTC will keep consent evidence externally, with new profiles hidden until scoped confirmation, age off/noindex on. Implementation/default migration is separate; no old-row backfill or inferred individual consent. S2 remains open for those rollout conditions.
- New default source paths are in schema/API/admin/import; G1 seed uses KEEP for newly created rules. Root applied migration20 (only ALTER DEFAULT false) to the confirmed test DB. After inventory has 0 players: it verifies default false, not actual old-row retention. API 6 specs/61 tests, worker 9 files/46 tests and component browser 22/22 passed. API explicit true/PATCH preservation is checked separately; four actual PlayerCreate cases at 390/1440 failed on the old default and pass now. Logs: `consent-api.log`, `consent-worker.log`, `admin-browser-final-consent.log` under the verification directory. Scoped API/worker/admin lint+typecheck 6/6 passed. [Browser/default review](tester-261127-admin-modal-continuation.md). Dev/staging unchanged; latest-code mobile full-flow passed.

## Files synchronized

Debt plan and BTC/consent decision record; redesign plan, A8 and C11; deployment guide, public-site, architecture (retained at 800 lines), draws/groups and current roadmap statements; open-debts backlog; phase 12's historical question/status note; existing debt-closure journal. Only concise additions/status reconciliations were made; historical runs and external gates remain separate. The runbook explicitly notes idempotent seed leaves existing null policies untouched and points operators to the external evidence checklist.

## Validation and unresolved gates

- `git diff --check`: exit 0.
- Full phase recount: 22 files, 158 checked/2 open. Debt recount: 7 checked/2 open.
- Final docs validator: exit 0, warn-only; 324 links verified (`docs-sync-final-validation.log`). Four historical links still point to the absent 2026-11-25 tester report. Code-reference warnings are unreliable on this Windows CLI because the validator invokes unavailable `grep`; config-key warnings include role/error constants. New plan/memo/PM/T2 report link checks found no missing local targets.

H/L5 closed on final scoped evidence; E/F and both C11 checkboxes remain open for their broader scope. Keep S1/S2, T2, developer DB cleanup D1/D2 and staging acceptance open. G1/G2 mechanisms/consent process approvals do not supply the official points matrix or any participant's evidence. No commit or push performed.
