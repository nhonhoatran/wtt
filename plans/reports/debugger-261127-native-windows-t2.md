# Native Windows T2 investigation — 2026-11-27

## Result

T2 remains open. The known `UV_HANDLE_CLOSING` shutdown race has a concrete upstream fix and regression reproducer, but the installed runtime already contains that fix. Thirty bounded reproducer invocations exited cleanly. Neither this result nor a clean application run identifies the cause of the earlier long-running worker failure.

The runner now records process timing, runtime versions and hexadecimal Windows status to make a future failure attributable. It still rejects every nonzero exit, retains the numeric status and does not retry a failed command.

## Scope and observed baseline

- Windows 11 Pro, version `10.0.26300`, x64; local observation at `2026-11-27T10:41:31+07:00`.
- Installed `C:\Program Files\nodejs\node.exe`: Node `26.13.1`, libuv `1.52.1`, V8 `14.6.202.34-node.40`.
- Historical full-flow report records a worker exiting `3221226505` (`0xc0000409`) before its stop marker. A separate public browser log recorded `UV_HANDLE_CLOSING` while Playwright reported exit 0. These observations cannot be merged into one proven cause.
- Latest interrupted run `desktop-925594be-4063-447f-b0ed-66aaec68100a` has a world manifest, worker-ready marker and no final result. Its exit ledger contains setup only. At inspection, its recorded runner PID `4236` was absent and ports 3371–3373 had no listeners. Missing exit records do not establish a native crash; the root agent handles recovery of that owned manifest separately.
- No application/DB/Redis processes were started or stopped by this investigation. No database or environment files were changed.

## Primary-source comparison

[Node issue #56645](https://github.com/nodejs/node/issues/56645) describes the Windows libuv assertion class. The merged [Node fix #61999](https://github.com/nodejs/node/pull/61999) prevents delayed tasks from posting after the task scheduler begins shutdown. Its [regression test](https://github.com/nodejs/node/blob/main/test/parallel/test-process-exit-after-fetch-throw.js) uses a local redirect loop, failed fetch and immediate process exit.

The [Node 26.13.1 source](https://github.com/nodejs/node/blob/v26.13.1/src/node_platform.cc) has the shutdown guard in `DelayedTaskScheduler::PostDelayedTask` under the task queue lock. CI uses Node 24.15.0 on Linux; the [24.15.0 source](https://github.com/nodejs/node/blob/v24.15.0/src/node_platform.cc) predates that fix. The [24.x changelog](https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V24.md) records the fix under 24.20.0. Current Docker defaults are 24.22.3. This is a runtime distinction, not evidence that Linux CI has reproduced the Windows defect.

No automatic Node downgrade was applied: the installed runtime has the relevant upstream guard, the project permits Node >=24, and selecting an older runtime without a failing/passing comparison would not identify or repair the observed T2 failure. Vitest pool changes and arbitrary exit delays are likewise unsupported by fresh evidence.

## Fresh read-only checks

| Check | Result | Limit |
|---|---|---|
| Upstream regression adapted inline; 30 sequential children; local ephemeral HTTP port; 10-second timeout per child | 30/30 exit 0, no stderr, no timeout | Tests the known shutdown trigger, not the full application workload |
| Windows Application events 1000/1001 in previous three days | Log readable; 8 events checked; 0 matching `node.exe`, `uv_handle` or `0xc0000409` | Absence of an event does not rule out a crash |
| `%LOCALAPPDATA%\CrashDumps` | Directory absent | No native dump is available to inspect |

The inline probe invoked `spawnSync(process.execPath, ['-e', child])` 30 times with captured status, signal and stderr. Each child served redirects on `127.0.0.1` port 0, awaited the fetch rejection, then exited 0. It used only Node built-ins and no project imports or external HTTP requests.

## Diagnostic change and verification

`scripts/admin-full-flow-process.mjs` adds `startedAt`, `endedAt`, monotonic `durationMs`, `runtime` (`node`, `uv`, `v8`, `platform`, `arch`) and Windows `exitCodeHex` to the existing exit record. It does not serialize command arguments, environment variables, secrets or application payloads. The existing result file embeds these records, and the existing CI artifact includes the exit ledger.

`scripts/admin-full-flow.test.mjs` checks actual child exit records and adds a Windows case that deliberately returns signed `-1073740791`. This is a status simulation, not a native crash. It verifies rejection, the retained original numeric code, `0xc0000409`, and exactly one exit record (no retry).

- `node --test scripts/admin-full-flow.test.mjs`: **14 passed, 1 POSIX-only skip, 0 failures** on Windows Node 26.13.1.
- `node --check` both edited scripts: exit 0.
- `git diff --check`: exit 0.

Independent review and the root agent's fresh full-flow executions are recorded separately. T2 requires an attributable crash/reproducer or native dump before it can be closed; these diagnostics do not claim to fix it.

## Final application observations

The root subsequently accepted native Windows desktop `55081e38…` and mobile `d6121820…`: each completed all eight steps/60 refresh checks, worker exit 0 and owned cleanup with environment unchanged. Their exit records include the new runtime/timing/hex metadata. API/admin/client exit 1 is the runner's forced shutdown after the browser completed; it is not a native-failure finding. Desktop predates the approved consent defaults; mobile uses the later source. No native assertion was observed in these runs, and T2 remains open. [Integrated evidence and visual limits](tester-261127-admin-full-flow-continuation.md).
