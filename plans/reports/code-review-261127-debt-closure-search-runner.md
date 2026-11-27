# Independent review: search, runner and API harness — 2026-11-27

## Scope and result

Reviewed workstreams D and I against `plans/261127-debt-closure/plan.md`, plus the two API specs that failed in the initial full baseline. One CI diagnostics finding was accepted by the lead; no additional product defect found in this scope. This is not a review of the scheduling engine or final integrated build.

| Requirement | Evidence |
|---|---|
| Bilingual SSR search over events and players | `search/page.tsx` uses the existing public list serializers concurrently; locale validation and dictionaries cover both languages |
| Bounded input, empty search without enumeration | Existing `toQuery` trims and limits `q`, ignores ambiguous arrays and unrelated filters; empty input invokes neither API |
| Public privacy and cache behavior | Both reads use `searching=true`, leading to `policy: none` and `fetch` with `cache: no-store`; existing player/event visibility rules remain the authority |
| Partial API failure | `Promise.allSettled` keeps the successful section usable and shows a localized unavailable message for the failed section |
| Metadata and navigation | Stable locale canonical and alternates, `noindex`; header exposes search on desktop and inside the mobile menu |
| Reproducible full-flow runner | Tracked runner owns fixed ports, UUID storage/queues, a local test target, an exclusive run lease, child processes and fixture cleanup |
| Failure handling | Runner records exit status, responds to interruption, shuts down owned process trees and releases the lease in `finally` |

## Accepted finding

**Medium — CI failure diagnostics:** `.github/workflows/ci.yml` originally uploaded result/exit records and visual artifacts but omitted the runner's owned `*.log` files. Child stdout/stderr are redirected to those logs, so a native crash in CI would lose its actual error output when the runner VM disappears. The lead accepted adding `test-results/admin-full-flow-*/*.log` to artifacts after checking that the setup does not print generated passwords. World manifests and traces remain outside this artifact recommendation because they can carry session data.

## Fresh local checks

- `node --test scripts/admin-full-flow.test.mjs`: 13 passed, one POSIX-only test skipped on Windows, zero failures.
- `pnpm --filter @kamito/client exec vitest run tests/unit/search-page.test.ts`: 8/8 passed.
- Focused eslint for `session-lifecycle.e2e-spec.ts` and `ranking-performance.e2e-spec.ts`: exit 0.
- `git diff --check`: exit 0.

The lead independently reported 14/14 runner tests on Node 24.15 in a POSIX Docker container with an init process. That result is separate from the Windows run above.

## API baseline adjudication

The initial full API run ended with 122/124 files and 736/740 tests passing. Three session failures share one fixture cause: an earlier role-change case left a third active admin behind. Both participants in the later concurrent demotion can then be demoted legitimately while the third admin survives. The assertion checked the two participants; a failed assertion skipped the original restoration and caused subsequent authenticated reads to return 401.

The production transaction checks the global active-admin invariant under serializable isolation and maps a serialization conflict to 409. No production authentication patch is justified by these failures. The fixture now restores the promoted operator and the main admin/session in `finally`; it checks that the concurrency case starts with exactly two active admins.

The 5,000-player performance case timed out at Vitest's default five seconds even though the measured snapshot processor took 1,594 ms against its existing 10,000 ms target. Fixture writes happen before the measured processor segment. Whole-test timeouts now allow a separate 30-second fixture budget plus the unchanged target multiplied by the existing factor of three, with setup duration logged separately. No target or factor was relaxed.

The date agent reran the two failed specs before the final cleanup hardening: 11/11 passed, recompute 146 ms and snapshot 1,786 ms. The final `finally` and derived-timeout refinements received static checks and agent review; they have not been rerun by this reviewer because the database lease passed to the color/scheduling workstreams.

## Limits

- Search unit tests mock public HTTP reads; fresh API/browser privacy and layout acceptance still belongs to the final production browser run.
- The runner contract tests do not replace a real desktop/mobile full-flow invocation.
- No PostgreSQL reads or writes were performed for this review. The native Windows crash remains unresolved until fresh runtime evidence identifies its process and cause.
