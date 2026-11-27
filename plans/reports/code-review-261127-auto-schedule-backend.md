# Independent automatic scheduling backend review — 2026-11-27

## Scope

Reviewed the new pure dependency resolver/engine, loader/fingerprint, preview/apply service, controller permissions, module wiring and route-to-cache mapping. Compared the lock order and timeline behavior with existing manual scheduling, session changes and result writers. No database reads or writes during this review.

## Accepted finding and resolution

**Medium — missing actual match activity in reservations.** The initial loader/engine reserved only matches with a session, table and scheduled time. Starting a published match does not require assigning a session, so a player could be LIVE in an unscheduled match and still receive an overlapping automatic assignment. An unscheduled OFFICIAL match also failed to reserve the player's minimum rest. For an already scheduled match that finished late, the estimated finish could precede `officialAt` and incorrectly allow its next match too soon.

The independent pure-engine reproduction initially assigned the shared player at 00:15 while the other match was LIVE, and at 00:35 after an official finish at 00:30 with a 20-minute rest requirement. The implementer accepted the finding and added `startedAt` to the loader/hash, actual finish reservations and a conservative block on possible participants in LIVE matches. The final reproduction now rejects all four unsafe live/recent/late-feeder cases and accepts confirmed winners exactly at the minimum-rest boundary. Regression coverage was added to the tracked engine suite.

## Checks and adjudication

| Area | Review result |
|---|---|
| Singles/doubles and possible winners | Participant unions include both partners and every unresolved feeder candidate; known official winners narrow the inherited set |
| Dependencies and BYEs | Direct source references plus reverse `nextMatchId` cover sources cleared after propagation; BYE/walkover dependencies flatten without artificial duration |
| Preserving existing assignments | Candidates are published, unvoided, playable, SCHEDULED and unscheduled; existing slots/status/result versions are not changed |
| End time, table and cap | Appends to table tails, bounds both session count and slot order, checks physical-table overlap across sessions within the event |
| Rest and incomplete participants | Uses existing conflict detector; unknown qualifier/group-place participants are skipped explicitly rather than guessed |
| Preview/apply consistency | Hash includes selected sessions/tables, event timezone, match schedule/result versions, participants/sources, durations and effective scheduling settings; server recomputes rather than accepting client assignments |
| Atomicity and writers | Apply locks sub-events, draws, sessions, matches, then runs under serializable isolation; changed fingerprint or serialization conflict aborts with 409 |
| Permissions | Both routes require `tournaments.update`, matching manual scheduling; result operators cannot schedule |
| Audit and public refresh | Each new assignment has a transaction-bound `match.schedule` audit; successful writes refresh `schedule.update` tags for affected match numbers/sub-event codes |

No additional blocking finding after the accepted fix. The engine intentionally appends without inserting idle gaps; a simple final may be skipped when no other match fills its required rest interval. The preview must state that limit, and the current modal does. Physical table reservations retain the existing estimated-duration model; LIVE participant handling is more conservative because no reliable player finish is available.

## Verification evidence

- Initial tracked engine suite: 11/11 passed before the new reproduction; this exposed a genuine coverage gap rather than an existing test failure.
- After the activity/rest fix: 12/12 tracked engine tests passed, exit 0.
- Final classifier/engine run: 17/17 across two source test files, exit 0. The classifier accepts exact PostgreSQL serialization/deadlock causes wrapped by Prisma raw-query errors and keeps unrelated failures visible.
- Independent ignored reproduction `test-results/261127-debt-verification/auto-schedule-review.mjs`: four unsafe scenarios rejected and exact-rest-boundary final accepted, exit 0.
- Integration spec reviewed for permissions/validation, read-only preview, preserved assignments, fingerprint changes, two concurrent applies, replay rejection, schedule versions and audit count. Not executed by this reviewer; the database lease is owned by other workstreams.

API integration (including `cache-tags-coverage.e2e-spec.ts`), stale apply under real concurrent writers, admin interaction/mobile layout and final build remain separate gates. This review does not close those through pure tests.
