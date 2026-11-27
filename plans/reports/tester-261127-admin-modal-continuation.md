# Admin modal continuation — 2026-11-27

## Result and scope

Final native Windows component browser command passed **22/22**, zero failures/skips/cancellations, exit 0, 79.395 seconds, after the approved consent-default changes. These tests render actual React/Ant Design components through a local Vite server and mock their HTTP responses. They do not access PostgreSQL, Redis, workers or the production full-flow servers, and do not establish API/staging acceptance or identify the native T2 crash.

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
node --test --test-concurrency=1 "apps/admin/test/**/*.browser.mjs"
```

Final log: `test-results/261127-debt-verification/admin-browser-final-consent.log`. The initial 18/18 run (67.735 seconds) remains in `admin-browser-continuation.log`. New-modal-only 4/4 (17.271 seconds) and PlayerCreate-only 4/4 (16.255 seconds) are subsets of the final 22, not additional unique tests. Node syntax checks for both new browser files and scoped whitespace checks also exited 0.

| Coverage | Final cases | Evidence |
|---|---:|---|
| Automatic scheduling modal | 4 | Cancel/session-change and stale 409 recovery, each at 390/1440 px |
| Discipline colors | 2 | Schedule text, neutral fallback, conflict feedback and contained width at 390/1440 px |
| Import selection | 3 | Candidate identity, saved PATCH, pointer/keyboard and viewport geometry at 320/390/1440 px |
| PlayerCreate consent defaults | 4 | Actual admin create route; private default and explicit opt-in POST payloads at 390/1440 px |
| Snapshot job feedback | 9 | Failure/unknown states, retry without another enqueue, exact result navigation |

## New consequential checks

Added `auto-schedule.browser.mjs`, `auto-schedule.fixture.tsx` and `auto-schedule.html` under `apps/admin/test/browser/`. No application code changed in this subtask.

- Preview then cancel sends no apply request. Reopening starts without an applicable proposal.
- Clearing selected sessions removes the displayed proposal and disables both preview and apply. Selecting another session requires another preview; the eventual apply contains the new session and its new fingerprint exclusively.
- A simulated HTTP 409 displays its message, removes the obsolete proposal, disables apply and reloads session data. A subsequent preview supplies a different fingerprint; the second apply sends that fingerprint and closes successfully.
- Modal bounds and page width fit 390/1440 px. Both use a 900 px height in this isolated component fixture; the integrated mobile suite has its separate 390×844 configuration.
- All new cases assert no uncaught page errors.

Opened all four screenshots `apps/admin/test-results/auto-schedule/{390,1440}-{preview,stale}.png`. The preview table scrolls within the mobile modal, contextual text stays readable and the stale-response state retains visible error feedback. Disabled apply is verified through the control's actual disabled state. These small fixtures complement the integrated screenshots; they do not cover a large proposal or every schedule operation.

Initial new-test failures were selector/timing problems in the new tests: Ant Design's exiting loading icon temporarily contributes `loading` to a button's accessible name even after the loading class clears. The tests now await preview HTTP completion and match the requested button label at the end of the accessible name. No timeout increase or product change was used to make these cases pass.

## Source review and prior failure

Reviewed `auto-schedule-button.tsx`, `auto-schedule-modal.tsx`, `auto-schedule-proposal.tsx`, their integration in `session-toolbar.tsx`, and the full-flow `auto-schedule.ts` helper. No blocking defect found within this UI scope. Session edits clear the proposal; busy actions prevent changing input or closing through ordinary controls; apply sends the selected sessions and fingerprint; a 409 clears the proposal before another apply. API atomicity, player conflicts and fingerprint construction retain their backend review/test evidence and were not rerun here.

The older `desktop-7986ec68…` full-flow failure is explained by its captured accessibility tree: the button was named `calendar Gợi ý xếp lịch` while the helper requested the exact name `Gợi ý xếp lịch`. The current source hides the decorative icon with `aria-hidden`; the new fixture successfully locates the exact button label. The admin build dated 10:28:43 follows that older failure. This is separate from native process T2 and from the historical desktop `925594be…` manifest that had completed eight browser steps without a complete runner/cleanup result.

## Remaining evidence

The root agent owns fresh desktop/mobile full-stack execution, manifest cleanup, production scheduling screenshots/PDF and the integrated report. This component result does not replace those results. This agent made no product/consent decision and performed no shared fixture/database writes, commit or push.

## Continuation after the approved opt-in policy

Following the user's approval of the three recommended decisions, the implementation agent changed new player profiles to private by default. Added `apps/admin/test/browser/player-consent.browser.mjs`, using the actual `/players/create` route, providers, production `PlayerCreate` and its real form cleaning/submission. It does not reconstruct a substitute form.

Before that source change, all four cases failed because the actual switch had `aria-checked="true"` rather than `false`; the log is `test-results/261127-debt-verification/admin-player-consent-before.log`. After the source change, all four passed: the default control and POST are false, the explicit switch action produces true, noindex stays true, exactly one POST is sent and the form redirects successfully. The final combined 22/22 run confirms these checks with the other component regressions.

The first post-change attempt revealed a test interaction issue: Ant Design's button-style radio hides its native input. The test now clicks its visible `Nam` label and asserts the associated radio checked state. The fixture disables file watching/HMR so another agent's workspace rebuild cannot replace an active form. No application change was needed for this test adjustment.

Opened all four `apps/admin/test-results/player-consent/{390,1440}-{default-private,opt-in}.png` captures. The public-profile switch differs as intended, noindex remains on and the explanation correctly distinguishes indexing from hiding a profile. Fixed shell elements appear at their current scroll position in full-page captures; these images should not be read as showing those elements permanently in the middle of the page.

Independently reviewed the defaults in `players.service.ts`, `commit-entry-write.ts`, `player-create.tsx`, `player-form.tsx`, `players-and-entries.prisma`, `seed-config-defaults.ts` and migration `20261127110000_private_player_profile_default`. **No blocking finding in this scope.** The migration only changes a column default; it contains no row UPDATE/backfill. API creation preserves explicit true via `?? false`; PATCH remains optional without a new DTO default. Import forces private/noindex only for newly created players; linked and deduplicated existing players retain their flags. The G1 seed change only creates new named defaults and preserves existing null/custom rules. Age visibility, Person output and sitemap scope remain under their existing guards; this review creates no external consent evidence.

Updated three narrow synthetic public fixtures so positive privacy/search/payload cases retain their intended meaning after the new default: `support/public-api-kit.ts`, `playwright/ranking-browser-fixture.ts`, and `public-ranking-payload.e2e-spec.ts`. Opt-in updates target only fixture-owned IDs; the explicit private-player override remains false. The dense payload test keeps non-null public links rather than silently shrinking its workload. General player/draw/ranking fixture creation helpers and full-flow imports retain the real private default. The root agent owns their fresh database/API verification.
