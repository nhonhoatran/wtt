# Báo cáo kiểm thử Phase 09 (ranking) — thay đổi UI admin và API

- Ngày: 2026-11-16
- Phạm vi: thay đổi chưa commit trong `apps/admin`, `apps/api` (sub-events, catalog-crud, ranking-lists, ranking-points, ranking-snapshots)
- Người kiểm: tester agent

## Kết luận

**Status: DONE_WITH_CONCERNS**

- Toàn bộ API test (unit + e2e) xanh: 91 file, 571 test, 0 fail, 0 skip, exit 0.
- Typecheck và lint xanh cho `apps/api`, `apps/admin`, `apps/worker`, `packages/ranking-engine`.
- Unit test `packages/ranking-engine` xanh, coverage đạt mục tiêu.
- Concern: admin mới chưa có unit test (xem mục 6).

## 1. Hạ tầng và DB

- `.env` (dòng neo `^DATABASE_URL=`, dòng 23): `postgresql://kamito:****@localhost:5433/kamito_tt_dev`. Khớp target được duyệt.
- `REDIS_URL` (dòng 30): `redis://localhost:6380`.
- Trước lần chạy đầu: 5433 và 6380 đóng, Docker không có trong PATH. Chủ repo đã bật container dev (WSL docker, compose `kamito-tt-dev`). Sau đó cả hai port đều mở.
- Migration (read-only): `cd packages/db && pnpm migrate:status` → `16 migrations found`, `Database schema is up to date!`, datasource `kamito_tt_dev` tại `localhost:5433`. Không có migration pending.
- Không chạy `db push`, `migrate dev`, `migrate deploy`, seed. Không commit, stash, checkout.

## 2. Kết quả theo suite

| # | Suite | Lệnh | Kết quả |
|---|---|---|---|
| 1 | ranking-engine unit + coverage | `pnpm test:coverage` (packages/ranking-engine) | 3 file, 36/36 pass |
| 2 | ranking-engine typecheck | `pnpm typecheck` | exit 0 |
| 2 | apps/api typecheck | `pnpm typecheck` | exit 0 (chạy lại sau khi sửa test: exit 0) |
| 2 | apps/api lint | `pnpm lint` (eslint src test) | exit 0 (chạy lại sau khi sửa test: exit 0) |
| 2 | apps/admin typecheck | `pnpm typecheck` (tsc --noEmit) | exit 0 |
| 2 | apps/admin lint | `pnpm lint` (eslint src) | exit 0 |
| 2 | apps/worker typecheck | `pnpm typecheck` | exit 0 |
| 2 | apps/worker lint | `pnpm lint` (eslint src) | exit 0 |
| 3 | apps/admin test | `pnpm test` (node --test) | 5/5 pass (chỉ có test cấu hình nginx) |
| 4 | apps/api unit (`src/**/*.test.ts`) | `npx vitest run src` | 19 file, 131/131 pass |
| 4 | apps/api e2e: 12 ranking + sub-events, venues, catalogs, catalog-revalidation, catalog-media-refs, player-merge, permission-coverage | `npx vitest run test/ranking-*.e2e-spec.ts ...` | 19 file, 98/98 pass (trước khi thêm assertion mới) |
| 4 | apps/api FULL (unit + e2e) | `npx vitest run --reporter=verbose` (apps/api) | **91 file, 571/571 pass, 0 skip, exit 0**, 450s |
| 5 | apps/worker unit | `pnpm test` (vitest run) | 7 file, 39/39 pass |

Ghi chú về lần chạy full: lần chạy đầu tiên bị dừng giữa chừng (log dừng ở `public-site`, không có dòng tổng kết; tiến trình không còn sống). Đã chạy lại bằng `nohup`, chạy xong sạch. Kết quả trên là của lần chạy lại.

## 3. Thêm assertion cho field response mới

Đã thêm `toMatchObject` / `toEqual` thật, không mock:

- `ranking-admin-snapshots.e2e-spec.ts`:
  - Draft: `publishedBy: null` ở list và ở GET detail.
  - Sau publish: GET detail và list `status=PUBLISHED` trả `publishedBy` = `{ id: admin.id, name: <name trong DB> }`.
- `ranking-admin-points.e2e-spec.ts`:
  - Row `AUTO`: `subEvent` có `id` = `w.subEventId`, `code` là string, có key `name`.
  - Row `MANUAL`: `subEvent` = `null`.
  - Sửa lần 1: assert `name: expect.any(String)` sai, vì `SubEvent.name` là `String?` (`packages/db/prisma/schema/tournament-event.prisma`). API đúng, assert đã sửa để chấp nhận null và vẫn kiểm tra key tồn tại.
- `ranking-admin-lists-rules.e2e-spec.ts`:
  - Tạo list: `category: null`.
  - Test mới: PATCH `categoryId` → `category` = `{id, code, name}` ở response PATCH và GET. Audit `ranking.list.update` có `before.category = null`, `after.category = {id,...}`. Dọn dẹp list và category trong test. Thêm import `randomUUID`.
- `sub-events.e2e-spec.ts`:
  - Bulk create: `discipline` có `competitorKind` và `genderRule` khớp DB; `rankingList: null`.
  - Test mới: PATCH `rankingListId` → `rankingList` = `{id, code, name}`; GET list thấy đúng `rankingList` và `discipline` rules; PATCH `null` → `rankingList: null`. afterAll xoá ranking list đã tạo (sau khi xoá event).
- `catalogs.e2e-spec.ts` (test "refuses to delete a tier, then an event type..."): sau PATCH event-type, audit `eventType.update` có `before.tier` = `{id, code}` và `after.tier.id`. Đây là catalog update audit check cho relation key, dùng event-type (`catalog-crud` include `tier`).

Không sửa file ứng dụng nào. Chỉ sửa 5 file test trên.

## 4. Hiệu năng

- `ranking-performance` (log lúc full run): recompute 128 entries = 107 ms (target 2000 ms). Snapshot 5000 players = 722 ms (target 10000 ms). Thời gian của test (1915 ms, 1978 ms) gồm setup.
- Test chậm nhất trong full run:
  - `imports-worker`: validate 1000 rows có 20 lỗi = 7295 ms (chậm nhất, không liên quan Phase 09).
  - `imports-worker`: resume = 3445 ms.
  - `player-merge-concurrency`: 2905 ms.
  - `login-hardening`: lockout backoff = 2607 ms.
- Không có test ranking nào vượt 2.1 s ngoài ranking-performance.

## 5. Coverage

- `packages/ranking-engine` (v8): Statements 100% (105/105), Functions 100% (31/31), Lines 100% (81/81), Branches 98.09% (103/105). Mục tiêu ≥ 90% đạt.
- Hai nhánh chưa phủ:
  - `src/stage-code-rows.ts:19`: nhánh tie-break `|| a.localeCompare(b)` trong comparator, khi hai code có cùng `codeOrder`.
  - `src/stage-reached.ts:19`: `!last || match.roundNumber > last.roundNumber`, một nhánh chưa chạy.
- Đề xuất: thêm test hai code cùng `codeOrder`, và test hai match OFFICIAL có roundNumber nhỏ hơn ở match sau.
- Không đo coverage API (không nằm trong yêu cầu).

## 6. Rủi ro và khoảng trống

1. Admin mới chưa có unit test. `apps/admin/test` chỉ có `admin-entrypoint.test.mjs` (cấu hình nginx). 22 file mới trong `pages/ranking` và `resources/ranking-lists` cùng các file event-hub mới chỉ được kiểm bằng typecheck và lint.
2. Chưa có test cho nhánh `publishedBy` khi user đã bị xoá (`publishersOf` trả null vì không có FK). Đề xuất thêm.
3. `ranking-points` `subEvent` có trường hợp `subEvent` null cho row MANUAL: đã được assert. Trường hợp sub-event bị xoá chưa có test.
4. Lần chạy full đầu tiên bị cắt, nguyên nhân chưa rõ (tiến trình biến mất không có tổng kết; harness báo exit 0). Lần chạy lại sạch. Nếu lặp lại thì cần điều tra thêm.

## 7. Câu hỏi chưa giải quyết

- Có cần unit test cho các màn admin mới (ranking pages, ranking-lists resource, seed suggestion modal) không? Hiện chỉ typecheck và lint.
- Có cần thêm test cho nhánh user đã bị xoá trong `publishedBy` không?
- Nguyên nhân lần chạy full đầu tiên bị cắt có cần điều tra không?
