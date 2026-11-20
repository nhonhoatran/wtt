# Phase 12 — Kiểm thử API với PostgreSQL và Redis thật

Ngày: 2026-11-19, Asia/Saigon. Phạm vi: sitemap/site, quyền truy cập, CMS song ngữ và kiểm chứng log Prisma. Không commit hoặc triển khai.

## Kết quả cuối

**7 file / 32 ca duy nhất đạt; 0 lỗi assertion và 0 bỏ qua ở các lượt xác nhận cuối.** Số này được hợp nhất từ ba lệnh thành công, thay 4 ca articles cũ bằng 5 ca mới, không cộng trùng lượt rerun.

| Spec | Số ca cuối | Bằng chứng |
|---|---:|---|
| `public-site.e2e-spec.ts` | 7 | `test-results/phase12-api-sitemap.json` |
| `public-sitemap.e2e-spec.ts` | 3 | Cùng JSON sitemap; batch 2 file / 10 ca, 8,82 giây |
| `express-router-allowlist.e2e-spec.ts` | 3 | `test-results/phase12-api-cms-permissions.json` |
| `permission-coverage.e2e-spec.ts` | 4 | Cùng JSON CMS/permissions |
| `articles.e2e-spec.ts` | 5 | `test-results/phase12-api-articles-final.json`; 4,87 giây |
| `cms-resources.e2e-spec.ts` | 6 | JSON CMS/permissions; cả batch 5 file / 21 ca, 20,42 giây, gồm 4 ca articles trước khi thêm regression |
| `contact.e2e-spec.ts` | 4 | Cùng JSON CMS/permissions |

Các ca mới/được tăng cường kiểm: video chỉ công bố sau thời điểm hợp lệ; sitemap chỉ có trận `OFFICIAL` không void/BYE của draw/giải công khai; capability tab đúng, không xuất định danh hồ sơ; `categoryEn`, `durationTextEn`, `groupEn` được lưu và trả đúng whitelist. Footer chỉ có nhóm EN vẫn được đưa ra công khai. Nhãn chuyên mục lấy từ setting động `news.categoryLabelsEn`, loại khóa không còn cấu hình và thuộc tính prototype kế thừa (`__proto__`, `constructor`). Quyền ADMIN/RESULTS_OPERATOR và SSR secret vẫn được kiểm qua HTTP thật.

## Cô lập dữ liệu

- Cấu hình hoạt động được đọc bằng `process.loadEnvFile('.env')`; không lấy dòng comment, không chỉnh file `.env` trong các lệnh đã chạy.
- Target nguồn được in trước khi chạy: `localhost:5433/kamito_tt_dev`. Không query, seed hoặc migrate schema DB dev.
- Target duy nhất cho fixture/migration: **`localhost:5433/kamito_tt_phase12_test`**, được tạo trên PostgreSQL local của `docker-compose.dev.yml`. Credentials được kế thừa trong bộ nhớ từ cấu hình hoạt động; không in hoặc ghi URL có mật khẩu.
- Đã `migrate deploy` đủ **18 migrations** trên DB test, gồm CMS và `20261119151407_add_content_english_fields`. Đã đọc SQL migration mới: chỉ thêm ba cột `TEXT` nullable, không drop hoặc sửa dữ liệu cũ. `seed:config` chạy với `MIGRATE_CONFIRM_TARGET=localhost:5433/kamito_tt_phase12_test`.
- Lượt xác nhận cuối dùng env riêng của process: `APP_ENV=test`, `QUEUE_PREFIX=kamito-tt:test`, `NODE_ENV=test`, `LOG_LEVEL=warn`, local upload dir trong `test-results/`. Không đổi root `.env`.
- Lượt thử đầu kế thừa queue prefix development của `.env`; sau đó đã tách prefix test. Không có worker Kamito chạy ở lượt đầu; không xóa job dev/không rõ nguồn. `CmsTestKit` dọn publishing job và row của chính nó theo cơ chế fixture.
- Chỉ start PostgreSQL/Redis của compose Kamito, giữ volume. Không stop hoặc sửa container dự án khác. DB test được giữ lại; các fixture thành công tự cleanup, catalog mẫu còn để tái chạy.

## Lệnh đã chạy

Runner tạm `test-results/phase12-api-runner.mjs` đọc cấu hình hoạt động, bắt buộc loopback, kiểm cổng compose, yêu cầu tên DB kết thúc `_test`, rồi chỉ đổi pathname và env của process con. Node tại `C:\nvm4w\nodejs`; file runner/log/JSON nằm trong thư mục gitignored.

```text
wsl -d Ubuntu -- docker compose --env-file /mnt/d/Project/wtt/.env -f /mnt/d/Project/wtt/docker-compose.dev.yml up -d postgres redis
pnpm --filter @kamito/db migrate:deploy
pnpm --filter @kamito/db seed:config
pnpm --filter @kamito/api exec vitest run test/public-site.e2e-spec.ts test/public-sitemap.e2e-spec.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=../../test-results/phase12-api-sitemap.json
pnpm --filter @kamito/api exec vitest run test/express-router-allowlist.e2e-spec.ts test/permission-coverage.e2e-spec.ts test/articles.e2e-spec.ts test/cms-resources.e2e-spec.ts test/contact.e2e-spec.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=../../test-results/phase12-api-cms-permissions.json
pnpm --filter @kamito/api exec vitest run test/articles.e2e-spec.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=../../test-results/phase12-api-articles-final.json
```

Không sao chép lệnh migrate/seed ra môi trường khác mà bỏ target guard. Các lệnh trên nhận đúng env test đã mô tả; không chạy trực tiếp với `.env` dev mặc định.

## Lỗi các lượt đầu và cách phân xử

1. DB mới chưa seed catalog: 5/7 file đạt, 21 ca đạt, hai suite sitemap/site dừng setup tại `entries-fixtures.ts:16` vì không có event type. Đã đọc và chạy seed idempotent có xác nhận target test; không sửa test để bỏ điều kiện.
2. Docker/WSL khởi động lại: PostgreSQL nhận fast shutdown, exit 0, không OOM; Redis cũng ngừng. JSON lượt này có 3 đạt / 4 lỗi / 24 pending, không được tính thành đạt. Đã start lại đúng dịch vụ compose; giữ WSL foreground để dịch vụ ổn định suốt các batch sau.
3. Một lượt Vitest gộp thoát native `3221226505` (`0xC0000409`) ngay sau dòng RUN, không có summary/assertion. Repo đã ghi cùng lỗi Windows trong báo cáo 2026-11-12 và 11-17; nguyên nhân native chưa được kết luận. Chia batch nhỏ và `--maxWorkers=1` cho các lượt xác nhận đạt; không gọi lượt crash là thành công.
4. Có deprecation của pg về `client.query()` khi client đang chạy query. Không đổi phụ thuộc hoặc che warning; không có assertion lỗi ở các batch cuối.

Log tổng: `test-results/phase12-api-run.log`. JSON `phase12-api-focused.json` là lượt lỗi môi trường cũ, **không** là kết quả cuối.

## Probe Prisma và review log độc lập

`node test-results/phase12-prisma-privacy-probe.mjs` chạy query SELECT đọc một tên cột không tồn tại chứa sentinel email giả trên test DB, bắt lỗi tại process riêng và chụp stdout/stderr. Không sửa row hoặc AppSetting, không xung đột lease Playwright.

- Negative control opt-in `log: ['error']`: bắt được sentinel và `prisma:error`, 189 byte.
- Factory mặc định `log: []`: không sentinel, không `prisma:error`, chỉ marker xác nhận bắt lỗi, 23 byte.
- Kết quả: PASS; artifact `test-results/phase12-prisma-privacy-probe.json` không chứa thông tin đăng nhập.

Đã độc lập đọc delta logger của agent review: pino request/response allowlist, route pattern, Better Auth logger hook, `safeErrorSummary`, Prisma factory và các sink lỗi API/worker. Không thấy vấn đề vật chất còn mở trong delta này. Đây không phải chứng nhận mọi luồng dữ liệu riêng tư hoặc mọi response của hệ thống.

## Giới hạn và trạng thái môi trường

- Chỉ là tích hợp local với PostgreSQL/Redis thật và storage driver local; không phải MinIO/S3 thật, staging, smoke tải, Lighthouse, axe, backup hoặc rollback.
- Chưa chạy toàn bộ auth/session/RBAC, toàn bộ API hoặc luồng UI giải 8 bước từ plan. Không dùng 32 ca này để đóng các tiêu chí đó.
- Sau API đã nhường test DB theo lượt cho Playwright; kết quả trình duyệt ở [báo cáo riêng](./tester-261119-2234-phase-12-bilingual-public-e2e.md).
- Không có HTTP server API/client riêng do runner này để lại; mỗi `AuthTestKit` đã đóng app ở lượt thành công. Sau Playwright, kiểm `Get-NetTCPConnection` không còn listener 3313/3314. Helper WSL hữu hạn riêng của lượt kiểm (exec session 51870) đã dừng bằng Ctrl+C; read-back không còn process `wsl.exe ... sleep 3600`. Không chạy lệnh stop/remove container hoặc xóa volume/DB. Read-back `docker ps -a --filter name=kamito` sau vòng đời WSL ghi PostgreSQL/Redis `Exited (0)`, không còn phục vụ kết nối; container và volume được giữ để bật lại bằng compose khi cần. Không tác động container dự án khác.
