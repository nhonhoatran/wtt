# Review — cluster A: public-cache revalidation wiring

Ngày: 2026-11-14 · Phạm vi: working tree chưa commit (events, sub-events, entries, players, player merge, import commit worker, `packages/shared/src/public-cache-tag-sets.ts`, `revalidate-job-options.ts`, `apps/api/src/modules/revalidation/*`, 2 e2e spec mới).

## Kiểm chứng đã chạy

| Lệnh | Kết quả |
|---|---|
| `tsc --noEmit` shared / api / worker | pass, 0 lỗi |
| `eslint` các file thay đổi (api + worker) | 0 issue |
| `vitest run` shared `public-cache-tag-sets.test.ts`, `revalidate-job-options.test.ts` | 5/5 pass |
| `vitest run src/modules/revalidation` (api) | 9/9 pass |
| 2 e2e spec mới | **CHƯA chạy** — cần Postgres + Redis thật; chưa xác nhận DB đích nên không tự chạy |

## Tổng quan

Thiết kế đúng hướng: tag tính SAU commit từ dữ liệu đọc lại; rename event/sub-event invalidates cả slug/code cũ + mới; `enqueue` nhận builder async và nuốt cả lỗi DB → `PUBLIC_REFRESH_DELAYED`; job id unique; chia lô ≤ `REVALIDATE_MAX_TAGS` dùng chung API + worker. Response shape admin giữ `{ data, warnings? }` — không regression (đã đối chiếu controller cũ bọc `{ data }`, và caller admin `entry-bulk-bar.tsx:21`, `use-add-entry.ts:30`, `entry-table.tsx:49` đọc `res.data`).

Critical: **0**. Điểm: **7.5/10**.

## High

### H1. Sửa `fullNameEn` / `publicDisplayName` / `club` không làm mới trang draw/groups/entries
- `apps/api/src/modules/players/players.service.ts:142,148-151` — chỉ khi `fullName` đổi mới nạp context sự kiện; các trường khác chỉ refresh `players` + `player-<slug>`.
- Nhưng trang public đọc trực tiếp các trường này từ `Player`: `apps/api/src/modules/public-competition/public-bracket.query.ts:8` (`fullName, fullNameEn, publicDisplayName, club`), `public-bracket.serializer.ts:45` (`name: p.publicDisplayName ?? p.fullName`). `toSide` dùng chung cho bracket, groups, entries, match card.
- Hệ quả: đặt `publicDisplayName` để ẩn tên thật (yêu cầu riêng tư) → tên thật vẫn nằm trong cache bracket/groups/entries tới hết TTL matchday.
- Sửa:
  ```ts
  const PUBLIC_SIDE_FIELDS = ['fullName', 'fullNameEn', 'publicDisplayName', 'club'] as const;
  const showsOnEventPages = PUBLIC_SIDE_FIELDS.some((k) => k in data && data[k] !== current[k]);
  ```
  rồi dùng `showsOnEventPages` thay cho `renamed` khi chọn context (giữ `renamed` cho `refreshCompetitorNames`). Thêm case e2e đổi `club`.

## Medium

### M1. Tập tag của player thiếu `schedule` (và match / results-strip)
- `apps/api/src/modules/revalidation/cache-tags.ts:53-57` — `playerTags` dựa trên `entryChangeTags` (event, draw, groups) nhưng schedule/match/results-strip cũng render tên qua `toSide` (`public-match.serializer.ts:3-4`, `apps/client/src/lib/public-data.ts:40,46,62`).
- Sửa tối thiểu: thêm `t.schedule(event.eventSlug)` cho từng event trong `playerTags` (rẻ, 1 tag/event). Trang match: hoặc nạp `matchNo` các trận có competitor của player trong `loadPlayerTagContext`, hoặc chấp nhận TTL và ghi rõ trong comment.

### M2. Hằng số cứng `MAX_PLAYER_TAGS = 1000`
- `apps/worker/src/import/import-revalidate-tags.ts:7,14` — cắt im lặng (không log) theo thứ tự tuỳ ý.
- Khuyến nghị: **bỏ cap** (KISS). Lý do: `revalidateTagsJobs` đã chia lô 200, số player đã bị chặn bởi giới hạn import rows (setting + env ceiling), `revalidateTag` mỗi tag rất rẻ. Nếu vẫn muốn giữ → đưa vào AppSetting trên `/settings` (worker đã có `readSetting`) và log khi cắt. Không nên để hằng số không có lý do đo đạc.

### M3. Admin không hiển thị / hiển thị thô `PUBLIC_REFRESH_DELAYED`
- `apps/admin/src/pages/event-hub/entry-labels.ts:76-78` `showWarnings` in thẳng chuỗi → user thấy toast "PUBLIC_REFRESH_DELAYED" (cùng lỗi có sẵn với `RANKING_RECOMPUTE_DELAYED`).
- Trang events / sub-events / players trong admin không đọc `warnings` → lỗi refresh im lặng.
- Sửa: map mã → nhãn (đã có mẫu ở `pages/results/match-score-drawer.tsx:70`), chuyển `showWarnings` thành dùng bảng nhãn và gọi ở các mutation event/sub-event/player.

### M4. Unpublish / cancel event không làm mới results-strip và trang match
- `cache-tags.ts:42-45` `eventTags` chỉ có events, event, schedule, draw, groups.
- Trận của event vừa unpublish vẫn còn trên results strip / trang match tới hết TTL. Thêm `t.resultsStrip()` cho `event.unpublish|cancel|uncancel` (1 tag). Match pages: nạp matchNo hoặc chấp nhận TTL (khớp ghi chú `apps/client/src/lib/api-client.ts:12`).

### M5. Worker enqueue không có timeout; refresh có thể mất vĩnh viễn
- `apps/worker/src/import-worker.ts:29-31` — kết nối dùng chung có `maxRetriesPerRequest: null` (`apps/worker/src/main.ts:31`) → khi Redis sập, `revalidateQueue.add` treo vô thời hạn, giữ 1 slot concurrency import. API thì fail-fast 2s.
- `import-commit-processor.ts:92-93` — crash giữa `finish()` và enqueue: job đã `DONE`, chạy lại bị `skipped` → không bao giờ refresh. Tương tự commit một phần rồi fail hẳn.
- Sửa: bọc `Promise.race` timeout (dùng chung helper `withTimeout` đưa về shared) + log; ghi rõ fallback là TTL.

## Low

- L1. `apps/worker/src/import/import-deps.ts:19-22` — docstring của `onBatchCommitted` bị đẩy lên trên `enqueueRevalidate` (2 JSDoc liền nhau, `onBatchCommitted` mất doc). Dời dòng 19 xuống ngay trên `onBatchCommitted`.
- L2. `apps/api/src/modules/entries/entry-bulk-actions.service.ts:85-89` — refresh player cho toàn bộ `ids`, kể cả entry không đổi. Truyền id các entry thật sự thay đổi (`changes.map((c) => c.row.id)`, trả ra từ transaction).
- L3. `apps/api/src/modules/sub-events/sub-events.service.ts:154-160` — `withRefresh` khai báo trả `Promise<T>` nhưng thêm `warnings` → kiểu sai; đổi thành `Promise<T & { warnings?: string[] }>`.
- L4. `apps/api/src/modules/ranking-snapshots/ranking-snapshot-publish.service.ts:97-102` — tự chia lô trong khi `enqueue` giờ đã chia (DRY); gọi `enqueue` một lần.
- L5. `import-worker.ts:23` — nếu `upsertJobScheduler` throw lúc khởi động, `revalidateQueue` (và prisma, có sẵn) không được close.

## Chất lượng test

- T1. `apps/api/test/public-refresh-wiring.e2e-spec.ts:39-41` — tên test nói "without a warning" nhưng không assert warnings (fixture tạo trong `beforeAll` bỏ body). Tag toàn cục `events`, `players` (dòng 40, 45) có thể khớp job cũ của lần chạy/test khác → pass giả. Lọc job theo `job.timestamp >= startedAt` hoặc chỉ assert tag chứa slug riêng.
- T2. Cùng file: phụ thuộc job còn nằm trong Redis; nếu có revalidate worker đang chạy cùng prefix, `removeOnComplete: { count: 100 }` có thể xoá job → flaky. `afterAll` chỉ xoá job đã "thấy" — job khác rò rỉ. Nên dọn theo timestamp.
- T3. Thiếu: e2e nhánh Redis sập ở endpoint admin (shape `{ data, warnings: ['PUBLIC_REFRESH_DELAYED'] }`), merge, đổi code sub-event, bulk, delete; unit test `enqueue(async () => { throw new Error() })` cho nhánh DB lỗi khi dựng tag (dễ, rẻ).
- T4. `imports-commit-guards.e2e-spec.ts` — DB thật, kiểm tag đúng/không lan sang MS, kiểm lỗi enqueue không làm fail import: tốt. Phần nối thật `revalidateTagsJobs → queue.add` trong `import-worker.ts` chưa được test (chấp nhận được).

## Điểm tốt

- Tag tính sau commit, đọc lại DB; event rename dùng `[current.slug, updated.slug]`, sub-event dùng `[current.code, row.code]`.
- Builder async nằm trong `try` → lỗi DB khi dựng tag thành warning, không 500.
- `revalidateTagsJobs` dedupe + chia lô theo `REVALIDATE_MAX_TAGS` dùng chung với client route và revalidate processor.
- Worker đóng `revalidateQueue` sau `worker.close()` — đúng thứ tự.
- No-op path (event `change`, entry update không đổi) không enqueue.

## Câu hỏi mở

1. Trang public player chưa có trên client (không thấy `tags.player` trong `apps/client/src`) — publish/unpublish event có cần refresh `player-*` khi trang player ra đời?
2. Cap 1000 có số đo nào ủng hộ không? Nếu không → bỏ.
