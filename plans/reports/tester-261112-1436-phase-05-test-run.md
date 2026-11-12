# Test run sau phase 05 (VĐV, cặp, đăng ký, import/export, gộp VĐV, admin UI)

Ngày: 2026-11-12. Repo: `D:\Project\wtt`. Shell: Git Bash. Node 24 (engines >=24). Vitest 5.0.5.
Log thô: `D:\Project\wtt\plans\reports\tester-logs\` (mọi lần chạy được nêu dưới đây).
DB/Redis: local từ `.env` (không sửa, không `db push`, không đổi schema/migration).

## 1. Kết quả tổng quan

| # | Lệnh | Kết quả | Ghi chú |
|---|---|---|---|
| 1 | `pnpm --filter @kamito/shared test` | **79/79 pass** (14 file) | Trước khi thêm test mới: 76/76 (13 file) |
| 2 | `pnpm --filter @kamito/worker test` | **29/29 pass** (6 file) | |
| 3a | `pnpm --filter @kamito/admin test` | **4/4 pass** | `node --test`, chỉ có `admin-entrypoint.test.mjs`. Không có test UI nào cho phase 05 |
| 3b | `pnpm --filter @kamito/admin build` | **OK** | `tsc --noEmit` + `vite build`. Cảnh báo chunk JS 2.62 MB > 500 kB (có sẵn, không do phase 05) |
| 4a | `pnpm exec vitest run` (api, full) — run 1 | **35/35 file, 231/231 test, exit 0**, 132.9 s | `api-full-run1.log` |
| 4b | như trên — run 2 | **35/35 file, 231/231 test, exit 0**, 124.5 s | `api-full-run2.log` |
| 4c | như trên — run 3 (sau khi thêm test photo, verbose) | **34/35 file**, 225 pass, 7 test chưa báo cáo, **exit 1** | Worker crash ở `auth.e2e-spec.ts` (xem F1). Không có assertion fail |
| 4d | `pnpm exec vitest run --pool=threads` (full) | **35/35 file, 232/232 test, exit 0**, 125.4 s | `api-full-threads.log` |
| 4e | `apps/api/test/players.e2e-spec.ts` riêng | **10/10 pass** | Sau khi thêm test photo |
| 5 | `pnpm turbo run typecheck lint --force` (root) | **14/14 task successful, exit 0** | Gồm typecheck + lint của api, admin, worker, shared, db, client, ui-tokens. Không có warning |

Tổng assertion fail trong mọi lần chạy: **0**. Mọi lỗi là crash cấp process worker (F1), không phải test đỏ.

## 2. Lệnh đã chạy để tái hiện flaky

| Thí nghiệm | Số lần | Kết quả |
|---|---|---|
| `entries.e2e-spec.ts` riêng (fork, mặc định) | 5 | 5/5 pass, 17/17 mỗi lần. Không tái hiện được crash |
| `express-router-allowlist.e2e-spec.ts` riêng (fork, mặc định) | 22 (5 + 10 + 7) | **3 crash** (~14%), exit `3221226505` |
| `express-router-allowlist.e2e-spec.ts` riêng (`--pool=threads`) | 35 (20 + 15) | **0 crash 0xC0000409**. 2 lần thoát `EXIT=127` không in output (cả 2 đều là lần thứ 13 của mỗi đợt) |
| Full api suite, fork | 3 | 1 crash (auth). 2 lần pass |
| Full api suite, threads | 1 | pass 232/232 |

## 3. Failures và phân tích

### F1. Worker crash `exit code 3221226505` (CRITICAL cho độ ổn định CI, không phải lỗi logic)

Output (run 3, `api-full-run3-verbose.log` dòng 348-361, rút gọn):
```
Vitest caught 1 unhandled error during the test run.
Error: [vitest-pool]: Worker forks emitted error.
Caused by: Error: Worker exited unexpectedly with exit code 3221226505 during started state while running test file D:/Project/wtt/apps/api/test/auth.e2e-spec.ts
 Test Files  34 passed (35)
      Tests  225 passed (232)
     Errors  1 error
```

Quan sát:
- `3221226505` = `0xC0000409` = `STATUS_STACK_BUFFER_OVERRUN` (Windows fast-fail). Process chết không ghi stderr; không có Application Error trong Event Log (đã kiểm tra 1 giờ gần nhất).
- Vị trí crash **ngẫu nhiên, khác file**:
  - express (solo): chết ở ~3.3-3.6 s, `import 86-87%`, **trước khi test body chạy**.
  - auth (full run 3): chết sau khi 4/11 test pass, trong test 5 (`ends the session after the absolute lifetime...`). Test này chỉ dùng Prisma update + sign-in, không có gì native đặc biệt.
  - Implementer báo entries chết sau 6/17 test. Chữ ký lỗi trùng ("Worker exited unexpectedly"), nhưng không có exit code gốc để xác nhận cùng họ lỗi.
- Chỉ xảy ra với **fork**. Với threads: 0/35 solo + 1/1 full. Xác suất 0 crash trong 35 lần nếu tỉ lệ fork là 14% khoảng 0.5%. Đây là bằng chứng mạnh rằng vấn đề nằm ở cơ chế child process của fork pool, không nằm ở một test cụ thể.
- Không phải lỗi assertion. Không phải lỗi production code trong đường chạy đã kiểm tra.

Root cause: **chưa xác định**. Các giả thuyết đã loại trừ hoặc chưa đủ bằng chứng:
- `sharp` (native libvips): **loại trừ cho express**, spec đó không load sharp. `sharp` chỉ được load qua `test/support/media-test-kit.ts` (media spec và players spec).
- Prisma native engine: loại trừ một phần. Stack trace pg deprecation (mục F3) cho thấy Prisma 7 chạy qua `@prisma/adapter-pg` (JS thuần).
- Còn lại: native transform của vitest/vite (`@swc/core` qua `unplugin-swc`, binding oxc/rolldown) trong child fork. Chưa kiểm chứng.

Đề xuất (không áp dụng, cần chủ repo quyết định):
- **Ưu tiên 1**: đổi pool sang threads trong `apps/api/vitest.config.ts`, thêm `pool: 'threads'` vào khối `test`. Bằng chứng: 35/35 solo + 232/232 full pass. Phạm vi: toàn bộ api test infra, nên cần 2-3 lần full run xác nhận trước khi merge.
- **Phương án thay thế** nếu giữ fork: wrapper CI chạy lại khi thoát `3221226505`. Vitest không tự retry file-level crash.
- Để tìm root cause: bật Windows Error Reporting LocalDumps cho `node.exe`. Đây là thay đổi registry hệ thống, cần xin phép trước.

### F2. `entries.e2e-spec.ts` chết sau 6/17 test: KHÔNG tái hiện được

- Solo 5/5 pass (17/17). Full suite 3 lần không có crash ở entries.
- Nếu là cùng họ với F1 thì đã được phủ bởi F1. Chưa xác nhận được vì không có exit code gốc.
- Không sửa code test.

### F3. "3 test fail trong 231" của lần chạy trước: KHÔNG tái hiện được

- 4 lần full run (run 1, run 2, threads, run 3) không có assertion fail nào.
- Log của lần chạy đó không còn trong repo nên không đối chiếu được. Có thể là hệ quả của crash (F1) hoặc đã được sửa (report api-core ghi "one test bug since fixed").
- Trạng thái: **chưa giải quyết** (xem câu hỏi mở).

### F4. Cảnh báo deprecation `pg` lặp trong mọi lần chạy (không fail, nhưng là bug tiềm ẩn)

Output: `DeprecationWarning: Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0`.

Nguồn (đã xác định bằng `NODE_OPTIONS=--trace-deprecation`, log `pg-deprecation-trace.log`):
- `PgTransaction.queryRaw` ← Prisma runtime ← **`analyseMerge(tx, ...)`**.
- Code: `apps/api/src/modules/players/player-merge-preview.ts:18-21` dùng `Promise.all([db.player.findUnique(A), db.player.findUnique(B)])`.
- Được gọi trong `$transaction` tại `apps/api/src/modules/players/player-merge.service.ts:25`.
- Hành vi hiện tại đúng (pg xếp hàng query), nhưng gửi 2 query song song trên 1 connection của interactive transaction là không được hỗ trợ và sẽ thành lỗi khi nâng pg lên 9.

Fix đề xuất (không áp dụng, vì không phải lỗi hành vi hiện tại):
```ts
const target = await db.player.findUnique({ where: { id: targetId }, select: PLAYER_SELECT });
const source = await db.player.findUnique({ where: { id: sourceId }, select: PLAYER_SELECT });
```
Các `Promise.all` khác trong api/worker đã rà bằng grep: những chỗ đã đọc (`resolveItems`, `commitImport`, `PlayersService.create`) đều chạy ngoài transaction. Các chỗ còn lại chưa đọc chi tiết.

### F5. Exit 127 không có output (2 lần, chưa giải thích)

- Cả 2 lần đều là lần thứ 13 trong đợt threads (`repro-express-threads.log`, `repro-express-threads-b.log`). Vitest in "RUN" rồi thoát 127 mà không có test output.
- Không thấy lần nào trong ~30 lần chạy fork. Nguyên nhân chưa rõ (có thể là lỗi spawn tạm thời). Ghi nhận, không kết luận.

## 4. Flakiness và cross-file interference

Đã kiểm tra tĩnh và động:
- **AppSettings bị sửa**: `permission-coverage.e2e-spec.ts` đổi setting và khôi phục trong `finally`. OK.
- **Đếm toàn bảng**: `express-router-allowlist` so sánh `user.count()` trước/sau trong cùng file. Các file chạy tuần tự (`fileParallelism: false`). OK.
- **Player rác**: mọi fixture có `tag` ngẫu nhiên, query lọc theo `tag`, `cleanupFixtures` xóa entry/competitor/pair/player/audit. OK.
- **BullMQ job**: `imports.e2e-spec` và `media-upload` xóa job theo id trong `afterAll`. `players.e2e-spec` (mới) cũng xóa job `media-<id>`. `imports-worker.e2e-spec` không dùng Queue. OK.
- **Rủi ro chưa kiểm chứng**: test enqueue job thật vào Redis queue `import`/`media` với `QUEUE_PREFIX` của `.env`. Nếu `apps/worker` đang chạy dev cùng Redis/prefix, worker đó sẽ nhặt job của test. Cần xác nhận `QUEUE_PREFIX` của test khác dev.
- **Handle leak**: không thấy cảnh báo "close timed out" / "hanging process" trong log. Vitest thoát bình thường.
- **Bộ nhớ zip bomb**: test `stops a zip bomb at the unzipped ceiling with bounded memory` lấy RSS mỗi 5 ms và assert tăng < 100 MB. Pass 4/4 lần, 1.2 s. Đây là phép đo lấy mẫu, không phải giới hạn tuyệt đối.
- Test không có order-dependence nào lộ ra qua 4 lần full run.

## 5. Hiệu năng

- Import validate 1000 dòng: **487 ms**. Commit 980 dòng: **9.6 s**. Ngưỡng trong test: commit < 60 s. Nguồn: `PERF` trong `imports-worker.e2e-spec.ts:94`.
- Test chậm nhất (run 3): validate 1000 dòng + commit 10.2 s; resume commit 3.8 s; zip bomb 1.2 s; express probes 0.97 s; login lockout 0.9 s.
- Tổng thời gian full api: 124-133 s.
- Không có test nào quá 60 s.

## 6. Ma trận Success Criteria (phase-05, mục "Success Criteria", dòng 242-252)

| # | Tiêu chí | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1a | Unit eligibility: giới tính, 2 cách tính tuổi, chỉ có `birthYear`, cặp nam-nữ cho MIXED | **Đã phủ, pass** | `packages/shared/src/entry-eligibility.test.ts:18-98`, `age-on-event.test.ts` |
| 1b | Unit matcher: mã; tên có/không dấu; trùng nhiều → NEEDS_CONFIRM; mã khớp nhưng năm sinh lệch → ERROR | **Đã phủ, pass** | `apps/worker/src/import/player-matcher.test.ts:24-69` (9 test) |
| 2a | Import 1000 dòng (20 lỗi cố ý): preview báo đúng 20 lỗi kèm số dòng | **Đã phủ, pass** | `imports-worker.e2e-spec.ts:68-93` (assert `rowNo`) |
| 2b | Commit lần 2 không tạo thêm bản ghi | **Đã phủ, pass** | `imports-worker.e2e-spec.ts:68` |
| 2c | 2 dòng cùng 1 VĐV mới → 1 VĐV | **Đã phủ, pass** | `imports-worker.e2e-spec.ts:109` + `player-matcher.test.ts:69` |
| 3a | File > `IMPORT_MAX_FILE_BYTES` → FAILED có lý do | **Đã phủ, pass** | `imports-worker.e2e-spec.ts:179` |
| 3b | File vượt trần giải nén → FAILED, worker không vượt bộ nhớ | **Đã phủ, pass** (RSS lấy mẫu) | `imports-worker.e2e-spec.ts:190-200` |
| 3c | Số dòng vượt trần → FAILED | **Đã phủ, pass** | `imports-worker.e2e-spec.ts:209` |
| 4 | Sửa dữ liệu giữa validate và commit (thêm tay entry trùng) → không nhân đôi | **Đã phủ, pass** | `imports-worker.e2e-spec.ts:121` (UPDATE_ENTRY) |
| 5 | Commit bị ngắt → retry chỉ chạy dòng chưa COMMITTED | **Đã phủ, pass** | `imports-worker.e2e-spec.ts:135` |
| 6 | Import vào draw PUBLISHED bị từ chối nếu không có override | **KHÔNG phủ, KHÔNG được triển khai** | `packages/db/src/domain/entry-guards.ts:55-57` là stub trả `{locked: [], draft: []}`. Worker không có check draw. Phụ thuộc phase 06 |
| 7a | Rút entry trong draw đã công bố → 409 | **KHÔNG phủ, KHÔNG được triển khai** | Cùng stub ở trên. `entries.service.ts:136-139` chỉ đường thrown không bao giờ chạy |
| 7b | Trùng hạt giống cùng nội dung/giai đoạn → DB từ chối | **Đã phủ, pass** | `entries.e2e-spec.ts:112-122` (409 + DB unique) |
| 8a | Gộp VĐV: entry/cặp của B trỏ về A | **Đã phủ, pass** | `player-merge.e2e-spec.ts:90` |
| 8b | Xung đột (A, B cùng nội dung) → chặn | **Đã phủ, pass** | `player-merge.e2e-spec.ts:129` (MERGE_CONFLICT) và `:141` |
| 8c | URL hồ sơ B → 301 sang A | **KHÔNG phủ, KHÔNG được triển khai** | Không có `301`/`redirect` trong `apps/api/src`. Có thể thuộc phase 08 (public) |
| 9 | Thêm 1 VĐV vào nội dung đơn: 2 click + gõ tên | **Chỉ phủ phần API** (thêm đơn, pass: `entries.e2e-spec.ts` test 1). Thao tác UI **không có test** | Admin không có test component. Báo cáo UI ghi "chưa chạy tay trên trình duyệt" |
| 10 | `GET /public/*` không trả phone/email/birthDate | **Không áp dụng** (chưa có route public trong phase 05, grep `src` rỗng) | Phase 08 |

Tiêu chí bổ sung (từ yêu cầu lần này):

| Mục | Trạng thái | Bằng chứng |
|---|---|---|
| Nhãn Suất "Từ vòng loại" round trip (export → parse lại) | **Đã phủ, pass (mới)** | `packages/shared/src/import-columns.test.ts` (3 test) |
| Header template có đủ nhãn Suất | **Đã phủ, pass (mới)** | cùng file |
| Nhãn cũ "Vòng loại" vẫn được nhận | **Đã phủ, pass (mới)** | cùng file |
| Template: sheet, dropdown, A1 | Đã phủ, pass | `imports.e2e-spec.ts:149-160`. Chỉ assert ô A1, không assert header cột Suất |
| Media purpose `player-photo` tạo intent được | **Đã phủ, pass (mới)** | `players.e2e-spec.ts` "sets photoMediaId only from a finished player-photo upload" |
| `player-photo` set làm `photoMediaId` khi READY, bị từ chối khi chưa READY | **Đã phủ, pass (mới)** | cùng test: 422 khi AWAITING_UPLOAD, 201 sau worker `ready` |
| `MEDIA_PURPOSES` có `player-photo` ở shared dist | Đã kiểm | `packages/shared/dist/media/media-contract.js` có `player-photo`, mtime khớp src |

Ghi chú: `plans/reports/ui-261112-1436-phase-05-admin-ui.md` nói "MEDIA_PURPOSES không có player-photo". Thông tin này đã cũ: src và dist đều có purpose này, và `player-form.tsx:102` đã gắn `MediaUploadField`.

## 7. Thay đổi file trong lần chạy này

Không sửa production code. Không sửa schema, migration, `.env`, `vitest.config.ts`.

1. `apps/api/test/players.e2e-spec.ts` (sửa)
   - Thêm setup media: `useTempUploadDir` trước `AuthTestKit.start()` (phải trước vì app đọc `STORAGE_DRIVER` lúc khởi tạo), `loadWorkerProcessors`, `worker deps`, `mediaQueue`.
   - `afterAll`: xóa media, job queue, đóng queue, xóa thư mục tạm.
   - Test mới: intent `player-photo` → 422 khi chưa upload → PUT + complete + `processImage` → `ready` → 201 với `photoMediaId`; kiểm tra purpose và status trong DB.
   - Không dùng mock, không set status tay: đi qua pipeline worker thật (sharp).
2. `packages/shared/src/import-columns.test.ts` (**mới**, 3 test): round trip nhãn quota, header template chứa đủ nhãn, nhãn cũ "Vòng loại".
3. `plans/reports/tester-logs/*.log` (**mới**): log thô của các lần chạy và thí nghiệm.

## 8. Khuyến nghị (theo độ ưu tiên)

1. **Quyết định về F1**: đổi `pool: 'threads'` trong `apps/api/vitest.config.ts` (bằng chứng mạnh) hoặc giữ fork + retry ở CI. Sau khi chọn, chạy full api 3 lần liên tiếp.
2. Sửa F4: thay `Promise.all` trong `analyseMerge` bằng 2 `await` tuần tự (2 dòng).
3. Bổ sung test cho draw guard (criteria 6, 7a) **khi phase 06 triển khai** `entriesInLockedDraw`. Hiện tại test sẽ đỏ hoặc phải skip, nên không viết trước.
4. Quyết định có triển khai 301 cho hồ sơ đã gộp (criteria 8c) trong phase 05 hay chuyển sang phase 08. Nếu triển khai thì cần test.
5. Thêm 1 test cho `resolveItems`/quota trong worker khi có entry-row-mapper: hiện `entry-row-mapper.ts` không có file test nào.
6. Admin UI: không có test component cho phase 05. Tối thiểu nên có test cho `player-lookup-select` và `import-row-decision-select`. Thao tác "2 click" chưa được đo.
7. Xác nhận `QUEUE_PREFIX` của test khác với dev worker để tránh nhặt job của nhau.
8. Bundle admin 2.62 MB: code-split khi có thời gian (không chặn).

## 9. Trạng thái

**Status: DONE_WITH_CONCERNS**

- Tất cả suite chạy được đều xanh: 0 assertion fail trong toàn bộ lần chạy.
- Concern 1: worker crash `0xC0000409` xảy ra ngẫu nhiên trong fork pool (3/22 solo express, 1/3 full). Chưa tìm được root cause. Threads pool không tái hiện (0/35 + 1/1).
- Concern 2: 3 criteria của phase 05 (6, 7a, 8c) chưa có triển khai ở production code, không phải thiếu test.

## Câu hỏi mở

1. Có đổi vitest pool sang `threads` cho api (F1) không? Nếu có, tôi chạy thêm 2 full run xác nhận.
2. Có cho phép bật Windows LocalDumps cho `node.exe` để lấy dump root cause (F1)? Đây là thay đổi registry hệ thống nên cần xác nhận.
3. Có áp dụng fix F4 (2 dòng trong `player-merge-preview.ts`) không? Tôi chưa áp dụng vì không phải lỗi hành vi.
4. 3 test fail của lần chạy trước không tái hiện được. Có log gốc hoặc commit nào để đối chiếu không?
5. Criteria 8c (301) thuộc phase 05 hay phase 08?
6. `QUEUE_PREFIX` trong `.env` có trùng với prefix của worker dev đang chạy không?
7. Entries chết sau 6/17 test (báo cáo của implementer): có exit code gốc không, để xác nhận cùng họ với F1?
