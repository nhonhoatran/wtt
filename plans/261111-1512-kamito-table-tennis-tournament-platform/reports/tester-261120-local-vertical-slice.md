# Lát cắt local admin API → BullMQ → SSR

## Phạm vi được duyệt

Một bài Vitest standalone tại `apps/api/test/playwright/vertical-slice-refresh.seed.ts`, chạy khi điều phối cấp lease DB test sau các suite API/browser khác. Không thêm spec tự chạy vào bộ Playwright hiện có.

Luồng: đăng nhập ADMIN và RESULTS_OPERATOR qua API thật → tạo giải, nội dung MS loại trực tiếp, bốn VĐV/bốn entry qua admin API → sinh và công bố nhánh, công bố giải → warm trang nhánh/trận SSR → operator chốt một trận qua API → BullMQ worker cô lập gọi processor revalidation production → hai trang SSR có tỷ số chính thức trong tối đa 5 giây.

AuthTestKit khởi tạo API Nest thật và gọi bằng Supertest; Next đang chạy đọc public API server của bộ kiểm qua `API_INTERNAL_URL`. Không bấm giao diện admin và không mô phỏng bộ luồng tám bước vận hành giải. Không dùng kết quả local để đóng M1/staging.

## Cô lập và bằng chứng dự kiến

- Guard trước setup yêu cầu PostgreSQL loopback có hậu tố `_test`, `MIGRATE_CONFIRM_TARGET` khớp, `APP_ENV=test`, queue prefix test; URL Next/API phải loopback, không credentials.
- Mutations và worker revalidate dùng namespace BullMQ có UUID riêng; không tiêu thụ hoặc xóa queue khác.
- Trước đo, queue phải idle. Trang nhánh và trang trận được tải hai lần, xác nhận chưa có tỷ số. Đọc đúng response key Redis của fixture, yêu cầu cache tồn tại và TTL còn trên 5,5 giây để tránh nhận nhầm refresh do fallback TTL hết hạn.
- Đo từ trước request confirm: SSR nhánh phải có tỷ số theo format thật, trang trận có trạng thái kết thúc và bảng điểm từng ván. Job completed phải tăng. Không gọi revalidation thủ công để đạt điều kiện đo.
- Cleanup exact fixture event/draw/player IDs và response cache key của slug riêng; không đổi version tag cache dùng chung. Sau khi đóng worker, kiểm không còn worker khác rồi dọn mọi `QueueName` trong đúng namespace UUID của probe, bao gồm job ranking phát sinh từ confirm và metadata Bull Board. Không ghi `.env`, schema, migration, DB dev hoặc credentials ra artifact.
- `E2E_VERTICAL_SLICE_PROBE_FILE` chọn artifact riêng từng lượt; mặc định `test-results/vertical-slice-refresh.json` tại cwd API. Điều phối cung cấp đường dẫn riêng để không ghi đè bằng chứng cũ.

## Kiểm tra tĩnh đã chạy

Tại root repo, trước khi có lease thực thi DB:

| Lệnh | Kết quả |
|---|---|
| `pnpm --filter @kamito/api typecheck` | PASS, exit 0 |
| `pnpm --filter @kamito/api exec eslint test/playwright/vertical-slice-refresh.seed.ts` | PASS, exit 0 |
| `pnpm --filter @kamito/api exec vitest list -c vitest.playwright.config.ts test/playwright/vertical-slice-refresh.seed.ts` | PASS, liệt kê đúng một ca; không chạy beforeAll/setup |
| `git diff --check` | PASS |

## Trạng thái thực thi

**PASS local với DB test được xác nhận và lease riêng, ngày 2026-11-20.** Target `localhost:5433/kamito_tt_phase12_test`; API production build tại cổng 3313, Next production tại cổng 3314. Không dùng DB dev và không đổi schema/migration trong gói này.

Lệnh thực thi từ root qua runner tạm có guard lease và kiểm hash `.env`:

```powershell
$env:REAL_TEST_DB_LEASE='phase0910'
node test-results/261120-real-vertical-slice-runner.mjs
```

Runner gọi đúng một seed:

```text
pnpm --filter @kamito/api exec vitest run -c vitest.playwright.config.ts test/playwright/vertical-slice-refresh.seed.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=<timestamped-artifact>
```

| Chỉ số lượt chốt | Kết quả |
|---|---|
| Run ID | `261120-real-vertical-slice-20261120051744375` |
| Test | 1/1 PASS; exit 0; tổng runner 6.743 ms |
| Mutation thật | ADMIN đăng nhập, tạo giải/MS knockout/bốn VĐV/bốn entry/sinh và publish draw/publish event; RESULTS_OPERATOR đăng nhập và confirm trận |
| Kết quả trận | `3:0`, trạng thái `OFFICIAL` |
| Shared cache trước confirm | Draw tồn tại, PTTL 29.978 ms; match tồn tại, PTTL 29.947 ms |
| Từ trước request confirm đến cả hai trang SSR có kết quả | **133 ms**, giới hạn 5.000 ms |
| Revalidation | Job completed tăng 1; processor production; không gọi refresh thủ công |
| Cleanup kiểm đọc riêng sau `afterAll` | Event 0; player 0; ba response key 0; mọi BullMQ key namespace UUID 0 |
| Auth rate limit riêng namespace UUID | Hai key `login-ip` có TTL tự hết hạn; kiểm cuối còn 0, không DEL rộng |
| `.env` | SHA-256 trước/sau bằng nhau; `envUnchanged=true` |

Artifact tại root `test-results/261120-real-vertical-slice-20261120051744375.{log,vitest.json,probe.json,cleanup.json,summary.json}`. Probe JSON giữ PTTL trước confirm, elapsed, số job và giới hạn phạm vi; cleanup JSON giữ số record/key sau dọn. Runner tạm nằm trong `test-results/`, không phải thay đổi production.

### Điều chỉnh có bằng chứng trong lượt chạy

- Preflight Node tái hiện `AbortSignal.timeout(4999.25)` ném `RangeError/ERR_OUT_OF_RANGE` vì tham số phải nguyên. Probe nay `Math.floor` phần thời gian còn lại, giữ timer đo tối đa 5 giây; tự kiểm cả đầu vào số lẻ, dưới 1 ms và 5.000 ms đều tạo signal được.
- Lượt đầu `261120-real-vertical-slice-20261120051416208` đạt 1/1 và refresh 136 ms nhưng kiểm cleanup phát hiện 10 BullMQ key thuộc đúng UUID của probe. `confirm` còn enqueue ranking và Bull Board tạo metadata các queue; cleanup ban đầu chỉ dọn revalidate. Đã dọn riêng UUID này bằng API BullMQ, mở rộng cleanup sang mọi `QueueName` trong UUID, kiểm `getWorkers()` rỗng trước obliterate rồi chạy lại. Lượt chốt trên là bằng chứng sau sửa cleanup; không lấy lượt đầu để tuyên bố cleanup sạch.
- Hai lượt đều có cảnh báo deprecation của `pg` về gọi `client.query()` khi client đang có query khác. Không có assertion fail hoặc native crash; chưa xử lý nguyên nhân cảnh báo ngoài phạm vi probe.

Lease DB đã release cho điều phối sau khi kiểm cleanup cuối; không giữ hoặc khởi động lại server.

## Giới hạn

- Một giải và một trận, không bao gồm import Excel, vòng loại/vòng bảng, sửa/mở lại trận, xếp hạng, quy tắc theo phiên bản hoặc toàn bộ tám bước UI.
- Chưa xác nhận triển khai staging/Dokploy/Traefik, đường đi network production, MinIO/S3 hoặc cổng M1/M2.
- Cache probe bám định dạng key nội bộ hiện tại của `public-response-cache.ts`; nếu đổi key/policy/tag, bài kiểm sẽ fail thay vì bỏ bằng chứng cache và tiếp tục nhận đạt.
