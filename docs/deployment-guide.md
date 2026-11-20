# Deployment Guide — Kamito

> Cập nhật: 2026-11-19 · Trạng thái: CMS và SEO/hardening phase 12 đã có trong working tree. Đợt này đã triển khai đủ 18 migration trên DB local riêng `localhost:5433/kamito_tt_phase12_test` để kiểm thử thật; không áp dụng migration mới vào DB dev hoặc staging. Staging/production Dokploy và cổng ra mắt chưa được nghiệm thu.
> Nguồn đối chiếu: `docker-compose.yml`, `docker-compose.dev.yml`, `docker/*`, `scripts/print-db-target.mjs`, `.env.example`, `.github/workflows/ci.yml`, `apps/api/src/cli/create-admin.ts`.
> Kiến trúc và luồng khởi động xem [system-architecture.md](./system-architecture.md). Tiêu chuẩn migration xem [code-standards.md](./code-standards.md#database-và-migration).

## Contents
- [Môi trường](#môi-trường)
- [Chạy dev local](#chạy-dev-local)
- [Playwright e2e (client)](#playwright-e2e-client)
- [Biến môi trường theo service](#biến-môi-trường-theo-service)
- [Dokploy: compose và domain](#dokploy-compose-và-domain)
- [Quy trình phát hành](#quy-trình-phát-hành)
- [Runbook: migration lỗi](#runbook-migration-lỗi)
- [Sao lưu và khôi phục](#sao-lưu-và-khôi-phục)
- [Cổng nghiệm thu ra mắt (phase 12)](#cổng-nghiệm-thu-ra-mắt-phase-12)
- [Kiểm tra sau deploy](#kiểm-tra-sau-deploy)
- [Xử lý sự cố](#xử-lý-sự-cố)
- [Việc còn mở](#việc-còn-mở)

## Môi trường

| Môi trường | Nơi chạy | Cách cấu hình | Ghi chú |
|---|---|---|---|
| Dev local | Host Windows + Docker trong WSL2 | `.env` ở root (từ `.env.example`) | Apps chạy bằng `pnpm dev` trên host |
| Staging | Dokploy, project riêng | Env khai trong Dokploy | `QUEUE_PREFIX=kamito-tt:staging`, DB và bucket riêng |
| Production | Dokploy, project riêng | Env khai trong Dokploy | `QUEUE_PREFIX=kamito-tt:production`, DB và bucket riêng |

Cả staging và production dùng cùng `docker-compose.yml`. Giá trị khác nhau nằm ở project Dokploy.

## Chạy dev local

**Yêu cầu:** Node 24.15.0, pnpm 11.3.0, Docker trong WSL2.

1. Tạo `.env` từ `.env.example`. Thay mọi placeholder `replace-with-*` và `change-me-*`. Secret phải từ 32 ký tự trở lên, và bốn secret phải khác nhau.
2. Dựng dependency dev (chạy từ PowerShell hoặc Git Bash trên Windows):
   ```bash
   wsl.exe -e bash -lc "cd /mnt/d/Project/wtt && docker compose --env-file .env -f docker-compose.dev.yml up -d"
   ```
   Luôn truyền `--env-file .env`. Compose có giá trị mặc định khi thiếu `.env`, và giá trị đó không khớp `.env.example`.
3. Cài và chạy:
   ```bash
   pnpm install --frozen-lockfile
   pnpm build
   pnpm dev
   ```
4. Áp migration cho DB local (xem [quy trình tạo migration](./code-standards.md#database-và-migration)):
   ```bash
   pnpm db:print-target
   pnpm --filter @kamito/db exec prisma migrate deploy
   ```
5. Seed danh mục mặc định (một lần, không bắt buộc). Xem [Seed danh mục mặc định](#seed-danh-mục-mặc-định).
6. Tạo ADMIN đầu tiên để đăng nhập admin. Xem [Tạo admin đầu tiên](#tạo-admin-đầu-tiên).

Ảnh khi dev: `.env.example` đặt `STORAGE_DRIVER=local`, file nằm ở `apps/api/uploads/` (đã gitignore). Không cần RustFS để thử upload.

Client khi chạy `next dev` không đọc `.env` ở root. Các biến client (bảng [Biến môi trường theo service](#biến-môi-trường-theo-service), mục `client`) phải có trong shell hoặc `apps/client/.env.local` (đã gitignore qua `.env.*`). Thiếu biến thì `serverEnv` ném lỗi `Missing environment variable <TÊN>` khi trang được render.

## Playwright e2e (client)

Chạy từ root repo:

```bash
pnpm --filter @kamito/client test:e2e
```

| Mục | Nội dung | Nguồn |
|---|---|---|
| Điều kiện | Stack dev đang chạy (Postgres 5433, Redis 6380, xem [Chạy dev local](#chạy-dev-local)). `.env` ở root có đủ biến | `apps/client/playwright.config.ts` |
| Trước khi chạy | Dùng `DATABASE_URL` process-only trỏ tới PostgreSQL local có tên DB kết thúc `_test`; đặt `MIGRATE_CONFIRM_TARGET` khớp chính xác `host:port/database`, kiểm bằng `pnpm db:print-target`. Fixture từ chối đích dev trong root `.env` | `scripts/print-db-target.mjs`, `tests/e2e/support/test-database-target.ts` |
| Web server | Mặc định API source cổng `API_PORT` (3000), Next dev cổng `E2E_CLIENT_PORT` (3001). `E2E_NEXT_MODE=start` chạy Next production; `E2E_API_MODE=dist` chạy API đã build. `CI=1` không tái dùng server cũ | `playwright.config.ts` |
| Biến ghi đè | Giữ `DATABASE_URL` process-only qua child process; không sửa root `.env`. Đặt `APP_ENV=test`, `QUEUE_PREFIX=kamito-tt:test`. Địa chỉ API HTTP, canonical và allowed Host lấy theo port test; `API_FETCH_TIMEOUT_MS=5000` | `playwright.config.ts`, `api-world-runner.ts` |
| Dữ liệu | `global-setup` dọn world cũ, seed giải công khai (`apps/api/test/playwright/public-world.seed.ts`, gọi `setupPublicWorld`), gọi `/api/revalidate`, warm up route. `global-teardown` dọn lại | `tests/e2e/global-setup.ts`, `global-teardown.ts` |
| Project | `desktop` 1280×800; `mobile` 390×844 | `playwright.config.ts` |
| Spec | `event-pages.spec.ts` (danh sách, trang giải, nhánh, bảng đấu, VĐV); `site-chrome-and-seo.spec.ts` (locale, canonical/hreflang, Twitter/JSON-LD, header bảo mật và CSP report-only, 390 px không tràn ngang, in nhánh). Ca mới phải chạy lại trước khi nghiệm thu | `tests/e2e/` |
| Đầu ra | `apps/client/test-results/` và `apps/client/playwright-report/` (đều gitignore) | `.gitignore` |

Kiểm phát hành local nên build API/client trước, rồi chạy với `E2E_NEXT_MODE=start`, `E2E_API_MODE=dist`, cặp port riêng và `CI=1`. Ngày 2026-11-15: client 3115/API 3215 đạt 51 Playwright/7 bỏ qua theo viewport, JavaScript bật; xem `plans/reports/tester-261115-phase08-remaining-debts.md`. Đây là production build chạy local, không phải staging.

Ngày 2026-11-19, ba spec `content-pages`, `rankings-and-players`, `site-chrome-and-seo` đạt **55/5 bỏ qua theo viewport/0 lỗi**, API 3313 và client 3314, worker 1, không retry. Dùng DB `kamito_tt_phase12_test` đã migrate/seed, Redis thật, storage local; iframe YouTube dùng fixture. Setup/teardown hoàn tất và hai port không còn listener sau chạy. Xem [báo cáo phase 12](../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261119-2234-phase-12-bilingual-public-e2e.md).

Chuẩn bị DB test riêng bằng tài khoản local đang hoạt động, không lấy credentials từ dòng comment và không in chuỗi kết nối. Tạo DB một lần, giữ credentials hiện có và chỉ đổi tên DB sang hậu tố `_test`; trước mỗi lệnh ghi phải in host/tên DB đã ẩn mật khẩu. Truyền URL qua biến process từ kho bí mật/shell hiện tại, rồi chạy quy trình sau; không chạy seed khi guard chưa xác nhận đúng đích. Không chạy fixture API và Playwright đồng thời vì chúng cùng thay đổi settings/world test.

```powershell
# DATABASE_URL must already target a dedicated local *_test database.
$env:MIGRATE_CONFIRM_TARGET = 'localhost:5433/kamito_tt_phase12_test'
$env:APP_ENV = 'test'
$env:QUEUE_PREFIX = 'kamito-tt:test'
node scripts/print-db-target.mjs --confirm
pnpm --filter @kamito/db exec prisma migrate deploy
pnpm --filter @kamito/db seed:config
```

```powershell
pnpm --filter @kamito/api build
pnpm --filter @kamito/client build
$env:E2E_NEXT_MODE = 'start'
$env:E2E_API_MODE = 'dist'
$env:E2E_CLIENT_PORT = '3115'
$env:API_PORT = '3215'
$env:CI = '1'
pnpm --filter @kamito/client test:e2e
```

Cổng dev:

| Dịch vụ | Host port | Bind | Phiên bản |
|---|---|---|---|
| PostgreSQL | 5433 (`DEV_POSTGRES_PORT`) | `127.0.0.1` | 17.11 |
| Redis | 6380 (`DEV_REDIS_PORT`) | `127.0.0.1` | 8.2.11, `noeviction`, AOF bật |
| S3 API (RustFS) | 9010 (`DEV_S3_PORT`) | `127.0.0.1` | 1.0.4 |
| S3 console | 9011 (`DEV_S3_CONSOLE_PORT`) | `127.0.0.1` | — |
| api | 3000 | — | `pnpm dev` |
| client | 3001 | — | `next dev --port 3001` |
| admin | 5173 | — | `vite`; proxy `/api/v1/admin`, `/api/v1/auth` tới 3000 |
| worker health | 3010 | — | `WORKER_HEALTH_PORT` |

Cổng được chọn để tránh trùng dịch vụ đã có trên máy (PostgreSQL 5432, Redis 6379, một dự án khác dùng 9000).

Bucket dev được tạo bởi service `s3-init` (AWS CLI) trong compose.

## Biến môi trường theo service

Quy tắc:
- Tên cố định. Giá trị lấy từ Dokploy (prod) hoặc `.env` (dev).
- Dokploy ghi biến của UI vào `.env` cạnh compose nhưng **không tự inject** vào container. Vì vậy compose liệt kê từng biến bằng `${VAR:?}` (bắt buộc) hoặc `${VAR:-default}` (tùy chọn).
- Không đưa giá trị kết nối vào code hay compose.
- Không bao giờ lấy giá trị từ dòng đã comment trong `.env`.

**Dùng chung (tất cả service):** `APP_ENV` (bắt buộc; `staging` hoặc `production` trong Dokploy), `TZ` (mặc định `UTC`), `LOG_LEVEL` (mặc định `info`). `NODE_ENV` cố định `production` trong compose.

| Biến | Service | Bắt buộc | Ghi chú |
|---|---|---|---|
| `DATABASE_URL` | api, worker | có | Role runtime. Trong `migrate` được gán từ `DATABASE_MIGRATE_URL` |
| `DATABASE_MIGRATE_URL` | migrate | có | Role migrate. Không có role riêng thì bằng `DATABASE_URL` |
| `MIGRATE_CONFIRM_TARGET` | migrate | có | Phải đúng `host:port/database` in ra. Khác nhau giữa staging và prod |
| `REDIS_URL` | api, worker | có | Redis riêng cho BullMQ, `noeviction` |
| `QUEUE_PREFIX` | api, worker | có | Dạng `kamito-tt:<APP_ENV>` |
| `REDIS_EVICTION_CHECK_OVERRIDE` | api, worker | không | Mặc định trống. Chỉ đặt khi policy không đọc được và đã xác nhận thủ công |
| `STORAGE_DRIVER` | api, worker | không | `s3` (mặc định) hoặc `local` (dev). Xem [Upload ảnh](./system-architecture.md#upload-ảnh-phase-04) |
| `UPLOAD_LOCAL_DIR` | api, worker | không | Chỉ khi `STORAGE_DRIVER=local`. Mặc định `apps/api/uploads`, tính từ thư mục chứa `pnpm-workspace.yaml`. Không dùng trong compose |
| `S3_ENDPOINT` | api, worker | có khi `STORAGE_DRIVER=s3` | URL S3 API. Compose để trống mặc định; code báo lỗi lúc boot nếu thiếu |
| `S3_REGION` | api, worker | có khi `STORAGE_DRIVER=s3` | |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | api, worker | có khi `STORAGE_DRIVER=s3` | Service account chỉ có quyền trên bucket mục tiêu (và trên `S3_INCOMING_BUCKET` nếu khai) |
| `S3_BUCKET` | api, worker | có khi `STORAGE_DRIVER=s3` | Bucket chứa ảnh đã xử lý (`public/`) |
| `S3_INCOMING_BUCKET` | api, worker | không | Bucket riêng tư cho ảnh gốc mới tải lên (`incoming/`). Trống = `incoming/` nằm chung `S3_BUCKET`. Xem mục "Bucket công khai" bên dưới |
| `S3_FORCE_PATH_STYLE` | api, worker | không | Mặc định `true` |
| `S3_PRESIGN_ENDPOINT`, `S3_PUBLIC_BASE_URL` | api | không | Không dùng: thiết kế upload (b) đã chọn (2026-11-12). Còn trong compose và `.env.example`; gỡ ở lần dọn env |
| `AUTH_SECRET` | api | có | ≥ 32 ký tự, riêng từng môi trường |
| `REVALIDATE_SECRET` | api, client, worker | có | Khác `AUTH_SECRET`. Worker gửi trong header `x-revalidate-secret` khi gọi `/api/revalidate` của client |
| `SSR_INTERNAL_SECRET` | api, client | có | Client gửi trong header `x-internal-secret` khi đọc `/api/v1/public/*`. API kiểm bằng `SsrInternalGuard`. Phải khác các secret còn lại (api kiểm trong `env-schema.ts`) |
| `IP_HASH_SALT` | api | có | Hash IP của form liên hệ (phase 11) |
| `CLIENT_INTERNAL_URL` | api, worker | có | Origin nội bộ của client, ví dụ `http://client:3000`. Compose đặt mặc định này khi không khai biến; code không có mặc định. Path con được giữ: `http://host/app` gọi `http://host/app/api/revalidate` (worker, `revalidateUrl()`; sửa 2026-11-14). Api chỉ kiểm định dạng, chưa dùng |
| `REVALIDATE_TIMEOUT_MS` | worker | không | Mặc định 5000 (ms). Timeout mỗi lần gọi `/api/revalidate`. Compose truyền biến này (mặc định như code) |
| `REVALIDATE_WORKER_CONCURRENCY` | worker | không | Mặc định 2. Số job revalidate chạy song song. Compose truyền biến này |
| `PUBLIC_SITE_URL` | api, client, admin | có | Client: `metadataBase` (canonical, hreflang, Open Graph), sitemap, robots. API: kiểm `Origin` |
| `ADMIN_PUBLIC_URL` | api, admin | có | |
| `TRUST_PROXY_HOPS` | api | có (compose) | Mã mặc định trong code là `0`. Số proxy tin cậy trước api. Phải khớp đúng số hop thật, xem [auth-and-rbac.md](./auth-and-rbac.md#chống-dò-mật-khẩu) |
| `PAGINATION_MAX_PAGE_SIZE` | api | không | Mặc định 100. Trần cứng của `pageSize`. Page size mặc định sửa ở `/settings` |
| `QUERY_MAX_LENGTH` | api | không | Mặc định 100. Độ dài tối đa của tham số `q` |
| `API_PORT` | api | cố định | `3000` |
| `UPLOAD_MAX_IMAGE_BYTES` | api, worker, admin | có | Trần cứng của setting `media.maxImageMegabytes` (API từ chối giá trị cao hơn). Container admin ghi `client_max_body_size` của route tải ảnh từ biến này lúc start, và thoát nếu thiếu hoặc không phải số nguyên dương. Xem [Giới hạn upload ảnh](#giới-hạn-upload-ảnh) |
| `UPLOAD_ALLOWED_IMAGE_TYPES`, `MEDIA_IMAGE_VARIANT_WIDTHS` | api, worker | có | Danh sách loại ảnh (ví dụ `image/jpeg,image/png,image/webp`) và bề rộng biến thể WebP (ví dụ `320,640,1280`). Compose bắt buộc khai (`:?`). Giữ env theo [quyết định phase 04](./code-standards.md#settings-hay-env-hằng-số-giữ-trong-code-có-chủ-đích) |
| `MEDIA_PUBLIC_BASE_URL` | api | không | URL của prefix `public/` (ví dụ `https://<host>/<bucket>/public`). Trống (dev) thì API phục vụ `/api/v1/media/public/*` |
| `MEDIA_WORKER_CONCURRENCY` | worker | không | Mặc định 2. Số job ảnh chạy song song |
| `MEDIA_CLEANUP_INTERVAL_MINUTES` | worker | không | Mặc định 15. Chu kỳ job dọn intent hết hạn và ảnh kẹt |
| `IMPORT_WORKER_CONCURRENCY`, `IMPORT_CLEANUP_INTERVAL_MINUTES` | worker | không | Mặc định 1 và 60. Số job import song song; chu kỳ dọn file import quá hạn |
| `WORKER_MAX_OLD_SPACE_MB`, `WORKER_MEM_LIMIT` | compose | không | Mặc định 384 và 512m. Trần heap Node và giới hạn RAM container worker (import đọc cả file vào bộ nhớ) |
| `IMPORT_MAX_FILE_BYTES`, `IMPORT_MAX_UNZIPPED_BYTES`, `IMPORT_MAX_ROWS` | api, worker | có | Trần import (phase 05). Thời hạn giữ file (`import.retentionDays`) và hạn chờ tải file (`import.uploadTtlHours`) chỉnh ở `/settings` |
| `WORKER_HEALTH_PORT` | worker | cố định | `3010` |
| `API_INTERNAL_URL` | client | có | Code không có mặc định (`lib/server-env.ts`). Compose mặc định `http://api:3000` |
| `REDIS_URL`, `QUEUE_PREFIX` | client | có khi dùng cache/hạn mức chung | Redis response cache và Lua rate limit giữa replica. Compose đã truyền; giữ namespace tách môi trường. Redis lỗi đọc API trực tiếp, invalidation 503 để worker thử lại |
| `SSR_INTERNAL_SECRET` | client | có | Gửi trong header `x-internal-secret` khi đọc API công khai. Code không có mặc định |
| `PUBLIC_REVALIDATE_SECONDS`, `MATCHDAY_REVALIDATE_SECONDS` | client | có | TTL dự phòng của cache công khai (số nguyên dương). Client đọc theo request. Làm mới chính là revalidate theo tag. Compose bắt buộc khai (`:?`) |
| `REVALIDATE_ALLOWED_HOSTS` | client | có (compose mặc định `client:3000`) | Danh sách Host (`host:port`, cách nhau bằng dấu phẩy) được gọi `/api/revalidate`. Phải bằng `host:port` của `CLIENT_INTERNAL_URL` của worker. Sai thì mọi lần revalidate nhận 404 và job failed. Domain công khai không đưa vào danh sách |
| `API_FETCH_TIMEOUT_MS` | client | có (compose mặc định 5000) | Timeout khi client gọi API công khai, đơn vị ms, số nguyên dương. Giữ ở env vì cần trước request bootstrap API/settings và phải giới hạn chính request đó (quyết định rà 2026-11-15). Hết giờ thì trang báo lỗi và không cache |
| `API_BASE_PATH` | admin | không | Mặc định `/api/v1`. Ghi vào `/config.json` |

`MEDIA_INTENT_TTL_MINUTES` đã bỏ (2026-11-12): thời gian chờ tải ảnh là setting `media.intentTtlMinutes`, thời gian tối đa xử lý ảnh là `media.processingTimeoutMinutes`, số ngày kết thúc mặc định của giải là `event.defaultDurationDays`, đều sửa ở `/settings`.

### Bucket công khai

Ảnh gốc vừa tải lên nằm ở prefix `incoming/` cho tới khi worker xử lý xong rồi xóa (vài giây; tối đa bằng `media.processingTimeoutMinutes` nếu worker gặp sự cố). Nếu **cả bucket** cho đọc công khai (policy public-read trên toàn bucket), file gốc chưa xử lý đọc được qua URL trong khoảng đó. Chọn một trong hai:

- Đặt `S3_INCOMING_BUCKET` trỏ tới một bucket riêng tư. Driver S3 tự chuyển mọi key `incoming/` sang bucket này (tạo, đọc, xóa); `public/` vẫn ở `S3_BUCKET`. Service account cần quyền trên cả hai bucket. Đây là cách nên dùng.
- Giữ một bucket, tắt quyền `ListBucket` ẩn danh và chấp nhận cửa sổ phơi bày ngắn nói trên (chỉ lộ nếu đoán được key chứa UUID ngẫu nhiên).

Bucket chỉ cho đọc công khai prefix `public/` thì không cần biến này.

Biến có trong code nhưng **không có trong compose và `.env.example`**:

| Biến | Đọc ở | Mặc định | Vấn đề |
|---|---|---|---|
| `SHADOW_DATABASE_URL` | `packages/db/prisma.config.ts` | — | Chỉ cho `migrate dev` trên server dev dùng chung (phase 01 bước 15). Chưa có trong `.env.example` |

`PAGINATION_DEFAULT_PAGE_SIZE` đã bỏ khỏi code (2026-11-12). Page size mặc định nằm ở `/settings` (`list.defaultPageSize`). Hai biến trần còn lại đã có trong compose và `.env.example`.

### Giới hạn upload ảnh

| Lớp | Giá trị | Nơi áp dụng |
|---|---|---|
| Trần cứng | `UPLOAD_MAX_IMAGE_BYTES` | api, worker, `client_max_body_size` của nginx admin ở route `/api/v1/admin/media/<id>/content` |
| Tham số admin | `media.maxImageMegabytes` (mặc định 5 MB, khoảng 1–50) | Sửa ở `/settings`. Không vượt trần cứng |

- Đổi trần: đổi `UPLOAD_MAX_IMAGE_BYTES` cho cả api, worker và admin, rồi restart. Không cần build lại admin.
- Nginx admin giới hạn body JSON thường ở `2m`, lớn hơn `JSON_BODY_LIMIT` của api (khoảng 1,2 MB). Đừng hạ thấp mức này.

### Giới hạn import Excel

| Lớp | Giá trị (mặc định trong `.env.example`) | Nơi áp dụng |
|---|---|---|
| Trần env | `IMPORT_MAX_FILE_BYTES` (5242880), `IMPORT_MAX_UNZIPPED_BYTES` (52428800), `IMPORT_MAX_ROWS` (5000) | api và worker. Compose bắt buộc khai (`:?`). Đổi thì restart api và worker |
| Tham số admin | `import.maxFileMegabytes` (5 MB, 1–100), `import.maxRows` (5000, 1–100000) | Sửa ở `/settings`. Không vượt trần env |
| Bộ nhớ worker | `WORKER_MAX_OLD_SPACE_MB` (384), `WORKER_MEM_LIMIT` (512m) | compose, service `worker` |
| Nginx admin | `client_max_body_size 2m` cho cả server | `docker/admin-nginx.conf` |

`IMPORT_MAX_UNZIPPED_BYTES` chỉ có ở env (chốt an toàn chống zip bomb), không có trên `/settings`.

**Đã sửa 2026-11-12:** `docker/admin-nginx.conf` có `location` riêng cho `^/api/v1/admin/imports/[^/]+/file$`, `client_max_body_size` lấy từ `IMPORT_MAX_FILE_BYTES` (ghi ra `/tmp/admin-config/import-limit.conf` lúc container admin khởi động, `docker/admin-entrypoint.sh`). Container admin giờ bắt buộc có `IMPORT_MAX_FILE_BYTES` (đã thêm trong `docker-compose.yml`); test ở `apps/admin/test/admin-entrypoint.test.mjs`.

## Dokploy: compose và domain

- File: `docker-compose.yml` (một file cho staging và production). Project name: `kamito-tt`.
- Service:

  | Service | Build target | Mạng | Ghi chú |
  |---|---|---|---|
  | `migrate` | `docker/api.Dockerfile`, target `migrate` | `internal` | `restart: "no"`, chạy một lần |
  | `api` | `docker/api.Dockerfile`, target `runtime` | `internal` | `expose: 3000`, không có domain. Phụ thuộc `migrate` hoàn tất |
  | `worker` | `docker/worker.Dockerfile` | `internal` | Phụ thuộc `migrate`. Health cổng 3010. Gọi `client:3000/api/revalidate` qua mạng `internal` |
  | `client` | `docker/client.Dockerfile` | `internal`, `dokploy-network` | Domain công khai |
  | `admin` | `docker/admin.Dockerfile` | `internal`, `dokploy-network` | Domain quản trị. Port 8080 |

- `dokploy-network` là mạng external, phải tồn tại trên Dokploy.
- Domain gắn ở tab Domains của Dokploy cho `client` và `admin`. Không gắn domain cho `api`.
- `depends_on: service_completed_successfully` có hiệu lực hay không là câu hỏi Spike D. Chưa kiểm chứng.
- **Fallback chưa có trong compose:** nếu Dokploy bỏ qua điều kiện trên, phương án là đưa `migrate` vào `profiles: [tools]` và chạy tay trước mỗi lần redeploy. Compose hiện chưa có profile, nên phương án này cần sửa file trước khi dùng.

### Preflight hạ tầng (trạng thái)

Kết quả preflight chưa có trong repo. Ghi lại khi có, kèm output lệnh làm bằng chứng.

| Hạng mục | Cần biết | Trạng thái |
|---|---|---|
| PostgreSQL | Phiên bản, quyền `CREATE`, pooler, SSL, giới hạn kết nối; DB riêng cho staging và prod; có dùng chung với dự án khác không | Chưa có |
| Role DB | Role runtime (chỉ DML, nếu được cấp) và role migrate riêng | Chưa có |
| Redis | `maxmemory-policy` hiện tại; có dùng chung không. Nếu không phải `noeviction` thì cần Redis riêng cho BullMQ (cổng ra phase 01) | Chưa có |
| S3 / MinIO | Trình duyệt có tới được qua HTTPS không; ai đặt được bucket policy và CORS; service account giới hạn một bucket | Chưa có |
| Thiết kế upload | (a) trình duyệt upload trực tiếp bằng URL ký, hoặc (b) upload qua API | Chưa chọn |
| Traefik | Có chuyển IP thật vào container không; có ghi đè XFF không; có tin `forwardedHeaders` không. Rate limit công khai của client đọc `X-Real-Ip`, nếu không có thì phần tử cuối `X-Forwarded-For`. Nếu Traefik tin header do client gửi, client giả được IP để vượt ngưỡng hoặc gây 429 cho người khác. Quy tắc chặn `/api/revalidate` theo path cũng nằm ở Traefik | Chưa kiểm (chưa có staging) |
| Sao lưu | Chủ sở hữu, RPO, lịch, thời gian giữ, nơi lưu | Chưa chốt |

## Quy trình phát hành

Áp dụng cho mỗi lần phát hành staging và production. Diễn tập đầy đủ ở Spike D.

1. **Build image.** Qua CI hoặc build trực tiếp trên Dokploy. Phương án build ở CI cần registry (chưa chốt).
2. **Xác nhận target.** Người phát hành đọc output của `migrate` (host, port, database) và danh sách migration chờ. Xác nhận đúng môi trường trước khi tiếp tục.
3. **Sao lưu.** `pg_dump` DB của môi trường đó ra nơi chủ hạ tầng chỉ định. Không ghi đè bản trước. Chưa có nơi lưu đã chốt: không nạp dữ liệu thật cho đến khi có.
4. **Migrate.** Chạy qua `depends_on` (tự động) hoặc tay qua profile `tools` (nếu đã cấu hình).
5. **Đổi container** api, worker, client, admin. Kiểm `/api/v1/health/live` và smoke test.
6. **Lỗi:** rollback về image trước. Schema mới vẫn chạy được với code cũ nhờ [quy tắc tương thích ngược](./code-standards.md#database-và-migration). Migration lỗi giữa chừng: xem [runbook](#runbook-migration-lỗi).

### Cổng xác nhận target

`migrate-entrypoint.sh` gọi `node scripts/print-db-target.mjs --confirm`:

| Điều kiện | Kết quả |
|---|---|
| `DATABASE_URL` trống | In `DATABASE_URL is not set`, thoát `2` |
| `MIGRATE_CONFIRM_TARGET` không khớp đúng `host:port/database` | In target cần khớp, thoát `3`. Không chạy migration |
| Khớp | In `DB target confirmed`, rồi `migrate status` (chỉ để xem), rồi `migrate deploy` |

Lưu ý:
- Khóa so khớp có **port**. Staging và prod có thể trùng host nhưng khác database. Trước đây không xét port, đã sửa ở review phase 01 (M4).
- Mật khẩu không bao giờ được in ra.
- `migrate status` thoát khác 0 khi còn migration chờ. Điều này là bình thường trong bước này.

## Tạo admin đầu tiên

Chạy một lần cho mỗi database, sau khi migration đã áp dụng. Code không có tài khoản mặc định.

**Dev local** (đã đối chiếu với `apps/api/package.json`, script `create-admin`):

```bash
pnpm --filter @kamito/api create-admin --email <email> --name "<Họ tên>"
```

Lệnh này đọc `DATABASE_URL` từ `.env` ở root (`--env-file-if-exists=../../.env`). Không truyền `DATABASE_URL` bằng tay.

Thứ tự hỏi khi chạy:

| Bước | CLI in ra | Bạn làm |
|---|---|---|
| 1 | `DB target: <host>:<port>/<database> (user: ...)` | Đọc và đối chiếu với đúng môi trường |
| 2 | `Type the database name (<database>) to continue:` | Gõ đúng tên database. Sai thì thoát, không ghi gì |
| 3 | Nếu email đã có: `... exists. Make it an active ADMIN and set a new password? (yes/no)` | Gõ `yes` để khôi phục |
| 4 | `Password (min N characters):` | Nhập mật khẩu, không hiện ra màn hình. `N` lấy từ `auth.password.minLength` (mặc định 10) |
| 5 | `Repeat password:` | Nhập lại |

Kết quả:
- Tạo mới: `Created ADMIN <email>`. Tài khoản không bắt đổi mật khẩu ở lần đăng nhập đầu, vì mật khẩu do người vận hành nhập.
- Khôi phục: `Restored ADMIN <email>`. Đặt `isActive` và vai trò `ADMIN`, xóa mọi phiên hiện có.
- Ghi audit `user.admin.create.cli` hoặc `user.admin.restore.cli` với actor `SYSTEM`.

Lưu ý:
- **Không xóa khóa đăng nhập trong Redis.** Nếu tài khoản đang bị khóa tạm, phải chờ hết thời gian khóa (mặc định tối đa 30 phút) hoặc xóa key bằng tay.
- Tự động hóa: CLI nhận stdin khi không có TTY (`printf` các dòng theo đúng thứ tự trên). Không ghi mật khẩu vào lệnh, file, hay lịch sử shell.
- **Staging và production: chưa kiểm chứng.** Image `api` chỉ chứa `dist/` và dependency production, không có `.env` ở root và không có `devDependencies` (`@swc-node/register`). `dist/cli/create-admin.js` có trong build, nhưng chưa thử chạy trong container. Thử trên staging trước khi dựa vào đường này. Trước khi chạy, đối chiếu dòng `DB target` với `MIGRATE_CONFIRM_TARGET` của môi trường đó.

## Seed danh mục mặc định

Chạy sau migration khi cần dữ liệu mẫu: nhóm giải `KAMITO` và hạng giải `KAMITO_CHAMPIONSHIP`, `KAMITO_OPEN`, năm nội dung chuẩn (MS, WS, MD, WD, XD), một thể thức mặc định (5 ván, 11 điểm, cách 2), một luật vòng bảng mặc định. Nguồn: `packages/db/prisma/seed/seed-config-defaults.ts`.

```bash
pnpm db:print-target                      # đọc host:port/database cần xác nhận
pnpm build                                # seed import từ dist/ của @kamito/db
MIGRATE_CONFIRM_TARGET=<host:port/database in ra> pnpm --filter @kamito/db seed:config
```

Lệnh đọc `DATABASE_URL` từ `.env` ở root. Không truyền `DATABASE_URL` bằng tay.

| Điều kiện | Kết quả |
|---|---|
| `DATABASE_URL` trống | Báo `DATABASE_URL is not set`, thoát lỗi, không ghi gì |
| `MIGRATE_CONFIRM_TARGET` không khớp target | Báo `Set MIGRATE_CONFIRM_TARGET=... to confirm this target`, không ghi gì |
| Khớp | In `Catalog defaults seeded` |

Hành vi:
- Idempotent: dòng đã có (theo `code`, hoặc `name` với thể thức và luật vòng bảng) được giữ nguyên, kể cả khi admin đã sửa.
- Mặc định (`isDefault`) chỉ được đặt khi chưa có mặc định nào.
- Luật vòng bảng seed với `withdrawalPolicy` để trống: rút lui giữa bảng bị chặn cho tới khi BTC chọn chính sách.
- Staging và production: chỉ chạy sau khi đã đối chiếu `MIGRATE_CONFIRM_TARGET` của môi trường đó, cùng quy tắc với migrate.

## Runbook: migration lỗi

Lệnh `prisma migrate resolve` đọc `DATABASE_URL` qua `prisma.config.ts` (từ biến môi trường hoặc `.env` ở root). Trước khi chạy, luôn xác nhận target:

```bash
pnpm db:print-target
pnpm --filter @kamito/db exec prisma migrate status
```

Quy trình:
1. Xác định migration nào thất bại (từ output của `migrate status`).
2. Kiểm tra SQL đã áp dụng đến đâu trên DB đúng target.
3. Sửa nguyên nhân gốc. Thao tác trên DB dùng chung cần xác nhận trước.
4. Ghi lại trạng thái bằng một trong hai lệnh:
   - Migration chưa áp dụng gì (đã rollback sạch): `pnpm --filter @kamito/db exec prisma migrate resolve --rolled-back <migration_name>`, rồi deploy lại.
   - Đã áp dụng một phần và đã hoàn tất thủ công: `pnpm --filter @kamito/db exec prisma migrate resolve --applied <migration_name>`.
5. **Không sửa file migration đã có trong git.** Cần thay đổi thì tạo migration mới.
6. **Không dùng `prisma db push`** để "sửa" lệch schema.

Cú pháp `--applied` và `--rolled-back` đã đối chiếu với `prisma migrate resolve --help` (Prisma 7.10.1, 2026-11-12).

## Sao lưu và khôi phục

**Trạng thái: chưa chốt.** Chưa có chủ sở hữu, RPO, lịch, thời gian giữ, và nơi lưu.

Mục tiêu trước pilot (tuần 9 theo phase 01):
- Chốt chủ sở hữu sao lưu PostgreSQL và object storage.
- Chốt RPO và lịch.
- Diễn tập khôi phục trên staging. Diễn tập phải xong **trước khi nạp dữ liệu thật đầu tiên**.
- Mỗi lần phát hành có bản `pg_dump` trước migration (bước 3 của quy trình).

## Cổng nghiệm thu ra mắt (phase 12)

**Trạng thái: chưa đạt.** Staging/Dokploy, thông tin sao lưu và các quyết định quy chế còn mở theo [kế hoạch](../plans/261111-1512-kamito-table-tennis-tournament-platform/plan.md#phụ-thuộc). Kiểm local hoặc bằng API mẫu không thay cho các bước dưới đây.

| Cổng | Bằng chứng phải ghi trước khi đóng |
|---|---|
| Hạ tầng và bảo mật biên | Domain client/admin, TLS, API không có domain công khai; kiểm giả mạo forwarded headers và `TRUST_PROXY_HOPS`; xác minh `/api/revalidate` và `/api/v1/public/*` không lộ qua domain công khai |
| Migration và dữ liệu mẫu | In host/tên DB thực tế, xác nhận target, `pg_dump` trước migration và deploy migration đúng thứ tự. Không lấy cấu hình từ dòng `.env` đã comment; không dùng `prisma db push` |
| CSP enforce | Chưa chuyển header. Bổ sung nonce hoặc cơ chế tương đương cho script Next.js, đối chiếu nguồn ảnh/video, kiểm bản build bằng trình duyệt và rà báo cáo staging không còn vi phạm hợp lệ bị chặn trước khi bật enforce |
| Hiệu năng và khả năng truy cập | Lighthouse mobile trang chủ/giải/nhánh/BXH: Performance ≥ 85, Accessibility ≥ 90, SEO ≥ 95; axe không có lỗi critical. Ghi URL, phiên bản build, điều kiện đo và artifact báo cáo |
| Tải nhẹ staging | Trang giải đang diễn ra: 5 req/s trong 2 phút, không có 5xx, lưu p95 và số phản hồi theo mã HTTP; chỉ chạy với target đã thống nhất và công cụ đã kiểm license |
| E2E vận hành | Luồng giải đầy đủ với PostgreSQL/Redis/storage thật, ADMIN và RESULTS_OPERATOR, import, kết quả, mở lại và công bố BXH; kiểm 1440/390 px. Ca đã viết hoặc pass bằng API mẫu chưa đóng cổng này |
| Rollback và khôi phục | Diễn tập Spike D trên staging với bản phát hành hiện tại, xác minh bản trước chạy được trên schema mới. Khôi phục PostgreSQL và object storage vào đích staging đã chỉ định; ghi bản sao dùng, thời gian, kết quả và người vận hành |

Header client được khai trong `apps/client/next.config.ts`: HSTS `max-age=31536000`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`. Chưa bật `includeSubDomains` hoặc preload vì phạm vi TLS của các subdomain chưa được xác nhận. CSP vẫn là `Content-Security-Policy-Report-Only`, còn `unsafe-inline` cho script/style và iframe hosts cố định trong code. Đối chiếu header thực tế trên domain TLS sau deploy; không gọi trạng thái này là CSP enforce. Chi tiết và giới hạn SEO xem [site công khai](./public-site.md#content-security-policy).

API đăng ký Helmet trước các raw handler xác thực và bull-board trong `apps/api/src/bootstrap-app.ts`, với chính sách ở `common/security/api-security-headers.ts`: HSTS `max-age=15552000`, không `includeSubDomains`/preload, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`; Helmet bổ sung `X-Content-Type-Options: nosniff`. Tắt CSP và `Cross-Origin-Embedder-Policy` ở middleware API; không áp CSP của Next lên các route này. Kiểm lại bull-board và ảnh media qua domain admin khi nghiệm thu staging.

Log HTTP dùng allowlist method, request id, route template và status; không ghi raw URL/query/header/body/IP. Error sink chỉ xuất loại/mã đã lọc, không xuất message/stack/cause. Better Auth và worker dùng cùng nguyên tắc. Prisma mặc định `log: []`, chỉ opt-in có chủ đích. Probe SQL lỗi chỉ đọc trên DB `_test` xác nhận cấu hình mặc định không rò sentinel nhạy cảm, trong khi negative control `log: ['error']` phát hiện sentinel. Media công khai có CORP `cross-origin`; response API còn lại giữ mặc định `same-origin`.

`tests/load/event-page-smoke-test.js` đã chuẩn bị target và ngưỡng cấu hình; mới kiểm cú pháp/inspect, chưa có lượt tải staging đạt. Audit dependency hiện còn 2 moderate, 0 high/critical sau override có phạm vi; không coi đó là toàn bộ cổng bảo mật đã đóng.

URL hồ sơ VĐV không được bổ sung vào sitemap hoặc JSON-LD `Person` trong khi câu hỏi đồng ý công khai chưa được chốt. Tôn trọng `isPublicProfile`, `noindex` và tên công khai thay thế khi kiểm dữ liệu phát hành.

## Kiểm tra sau deploy

Chạy từ máy có quyền truy cập domain (thay `<admin-domain>`):

```bash
curl -fsS https://<admin-domain>/healthz                 # 200 {"status":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' https://<admin-domain>/api/v1/health/ready   # 404 (đúng: không lộ ra ngoài)
curl -s -o /dev/null -w '%{http_code}\n' https://<admin-domain>/api/v1/public/x      # 404
curl -fsS https://<admin-domain>/config.json             # chỉ 3 khóa: API_BASE_PATH, ADMIN_PUBLIC_URL, PUBLIC_SITE_URL
curl -s -o /dev/null -w '%{http_code}\n' https://<admin-domain>/api/v1/auth/me          # 401 (chưa đăng nhập)
curl -s -o /dev/null -w '%{http_code}\n' https://<admin-domain>/api/v1/admin/queues     # 401 (bull-board, chưa đăng nhập)
curl -s -o /dev/null -w '%{http_code}\n' https://<admin-domain>/api/v1/admin/media/config  # 401 (chưa đăng nhập)
curl -s -o /dev/null -w '%{http_code}\n' https://<admin-domain>/api/v1/media/public/x    # 404 (không có file)
```

Kiểm nội bộ, trong container api (cùng lệnh với healthcheck của compose):

```bash
wget -qO- http://127.0.0.1:3000/api/v1/health/live
wget -qO- http://127.0.0.1:3000/api/v1/health/ready      # status: ready hoặc degraded (không phải not_ready)
```

Trong container worker: `wget -qO- http://127.0.0.1:3010/health`.

Staging phải có 4 service `healthy`, client và admin mở được qua domain, api không có domain công khai.

Kiểm bổ sung cho phase 10 sau khi có staging:

- Công bố kỳ mới ở admin, theo dõi queue `revalidate`, mở `/vi/rankings/:listCode` và kiểm ngày/thứ tự mới; thử tìm tên không dấu và mở chi tiết điểm khi tắt JavaScript.
- Mở hồ sơ chuẩn `p-<UUID>`, thử slug cũ/đã gộp nhận 301 và đích ẩn nhận 404. Kiểm `robots` theo `noindex`, không có URL VĐV trong sitemap hay JSON-LD `Person`.
- Nội dung gắn bảng đang bật phải có điểm theo vòng ở tab Thông tin, theo phiên bản tại ngày kết thúc giải. Đổi quy tắc phải làm mới tab qua `rankingRules.write`.
- Phase 10 không thêm migration. Snapshot cũ không có `eventId` trong breakdown che nhãn/link giải nguồn nhưng vẫn giữ điểm; tạo kỳ mới nếu cần nhãn đầy đủ, không sửa kỳ đã công bố. Ngân sách 80 KiB của rankings đo body HTTP gzip; không áp cho JSON thô hay HTML trang.

## Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp | Xử lý |
|---|---|---|
| `migrate` thoát `3` | `MIGRATE_CONFIRM_TARGET` sai (thiếu port, sai tên DB) | Sửa đúng `host:port/database` in ra. Không sửa thành giá trị bất kỳ để qua |
| `migrate` thoát `2` | Không gặp qua compose (`DATABASE_MIGRATE_URL` là biến bắt buộc). Chỉ gặp khi chạy image bằng `docker run` tay thiếu `DATABASE_URL` | Chạy qua compose, hoặc truyền `DATABASE_URL` khi chạy tay |
| api thoát `1`, log `Refusing to start: migrations not applied` | `migrate` chưa chạy hoặc thất bại | Xem `migrate` log, chạy lại sau khi sửa |
| worker thoát `1`, log `refusing to run` | Redis không tới được, hoặc policy khác `noeviction` ở production | Kiểm Redis. Không đặt override để bỏ qua policy sai |
| worker health `degraded` | Policy khác `noeviction` ở staging/dev, hoặc policy không đọc được | Xem `detail` trong `/health`. Lưu ý: vẫn trả 200 nên healthcheck của compose không phát hiện được |
| api `/health/ready` trả 503 | Có check `down` (DB, Redis, S3, migration) | Xem `checks` trong body để biết mục nào |
| Service thoát ngay khi start, log có tên biến | Biến bắt buộc thiếu hoặc sai | Thêm biến theo tên trong log. Log không in giá trị |
| `/config.json` của admin sai | `API_BASE_PATH`, `ADMIN_PUBLIC_URL` hoặc `PUBLIC_SITE_URL` của service `admin` sai | Sửa env rồi restart container. Không cần build lại |
| Secret bị từ chối | Ngắn hơn 32 ký tự, hoặc bắt đầu bằng `replace-with` / `change-me` | Thay bằng giá trị ngẫu nhiên mới |
| Đăng nhập admin trả 429 `TOO_MANY_REQUESTS` | Vượt ngưỡng đếm theo IP, hoặc đang bị khóa tạm theo tài khoản | Chờ hết `Retry-After`. Nếu ngưỡng quá thấp, chỉnh ở `/settings` (không tắt bằng env) |
| Nhiều người cùng bị 429 trong một lúc | `TRUST_PROXY_HOPS` thấp hơn số proxy thật, nên mọi client chung một IP | Kiểm số hop thực tế của Traefik và nginx, rồi đặt lại biến |
| Ghi bị 403 `ORIGIN_MISMATCH` | `ADMIN_PUBLIC_URL` không khớp scheme và host của domain admin | Sửa `ADMIN_PUBLIC_URL` của service `api` (và `admin`), redeploy |
| 403 `PASSWORD_CHANGE_REQUIRED` | Tài khoản đang có mật khẩu tạm | Đổi mật khẩu ở màn `/change-password`. Quá hạn tạm thì quản trị reset lại |
| 401 `SESSION_IDLE_TIMEOUT` hoặc `SESSION_EXPIRED` | Hết `auth.session.idleMinutes` hoặc `auth.session.maxAgeHours` | Đăng nhập lại |
| 409 `LAST_ACTIVE_ADMIN` | Thao tác sẽ làm hệ thống không còn ADMIN đang hoạt động | Cấp ADMIN khác trước, rồi mới hạ hoặc khóa |
| Đổi setting, replica khác chưa thấy | Kiểm request/DB và tag invalidation | API đọc DB mỗi lần, không còn cache RAM 10 giây; client JSON cache dùng Redis chung |
| Log `login rate limit unavailable` hoặc `lockout ... unavailable` | Redis lỗi. Đăng nhập đang fail-open (không đếm, không khóa) | Khôi phục Redis. Đây là cửa mở, xem [giới hạn đã biết](./auth-and-rbac.md#giới-hạn-đã-biết) |
| `complete` ảnh trả 503 `QUEUE_UNAVAILABLE` | api không đưa được job vào Redis | Ảnh trở về `AWAITING_UPLOAD`. Khôi phục Redis rồi bấm lại |
| Ảnh `FAILED` với `PROCESSING_TIMEOUT` | Worker chết hoặc không chạy, hoặc Redis mất job | Xem worker health và log. Tải lại ảnh. Ngưỡng ở `/settings` (`media.processingTimeoutMinutes`) |
| Ảnh `FAILED` với `PROCESSING_ERROR` | Hết 3 lần thử, thường do storage hoặc DB lỗi kéo dài | Kiểm `/api/v1/health/ready`, mục `storage` và `database`. Tải lại ảnh |
| Ảnh `FAILED` với `NOT_AN_IMAGE` hoặc `TOO_LARGE` | Định dạng ngoài `UPLOAD_ALLOWED_IMAGE_TYPES`, hoặc quá 40 triệu điểm ảnh | Dùng ảnh khác |
| Tải ảnh 413 `PAYLOAD_TOO_LARGE` hoặc 415 `CONTENT_TYPE_MISMATCH` | Vượt `media.maxImageMegabytes`, hoặc `Content-Type` không khớp loại đã khai lúc tạo intent | Giảm ảnh. Không vượt `UPLOAD_MAX_IMAGE_BYTES` |
| Tải ảnh bị 413 từ nginx, api không nhận được | `UPLOAD_MAX_IMAGE_BYTES` của container admin khác với api | Đặt cùng một giá trị cho cả hai service, restart |
| Ảnh dev không hiện (`STORAGE_DRIVER=local`) | api không chạy, hoặc thư mục `UPLOAD_LOCAL_DIR` không nằm cùng repo root với worker | Kiểm `apps/api/uploads/public/` có file không. Api và worker đều tính đường dẫn từ repo root |

## Việc còn mở

| # | Việc | Nguồn | Hướng xử lý |
|---|---|---|---|
| 1 | Dokploy có tôn trọng `service_completed_successfully` không | Spike D | Nếu không: thêm profile `tools` cho `migrate` vào compose |
| 2 | Traefik có ghi đè XFF do client gửi không; có tin forwarded headers không | Review M7, phase 01 | Chốt giá trị `TRUST_PROXY_HOPS` theo kết quả |
| 3 | Tên DNS `api` có đụng service khác trên `dokploy-network` không | Review H3 | Alias riêng, hoặc Isolated Deployment |
| 4 | Build image trên Dokploy hay ở CI kèm registry | Phase 01 rủi ro | Chưa chốt |
| 5 | Chủ sở hữu, RPO, lịch, nơi lưu sao lưu | Phase 01 bước 15 | Chưa chốt |
| 6 | Thiết kế upload | Phase 04 (2026-11-12) | Đã chốt (b): ảnh đi qua API. Không còn việc mở |
| 7 | Hạ tầng PostgreSQL, Redis, MinIO có dùng chung không; role và quyền | Phase 01 bước 15 | Chưa có câu trả lời |
| 8 | Client chưa truyền `ADMIN_PUBLIC_URL` trong compose (phase 01 bảng biến có ghi) | So sánh compose với bảng phase | Thêm nếu client cần đọc |
| 9 | CI (`.github/workflows/ci.yml`) chỉ chạy khi push lên `main` hoặc mở PR. Repo hiện có remote `origin`; chưa có bằng chứng workflow GitHub thành công trong đợt này | Kiểm git baseline 2026-11-19 | Xác minh lượt CI thực tế trên GitHub khi phát hành |
| 10 | Tạo admin đầu tiên trong container `api` chưa kiểm chứng | [Tạo admin đầu tiên](#tạo-admin-đầu-tiên) | Thử trên staging |
| 11 | Deploy staging: chưa áp dụng migration nào trong 18 migration hiện có của repo; xem thứ tự trong [system-architecture](./system-architecture.md#dữ-liệu). Đợt 2026-11-19 chỉ migrate đủ 18 trên `localhost:5433/kamito_tt_phase12_test`; hai migration mới chưa áp dụng DB dev | Phase 03–12; [báo cáo API thật](../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261119-phase-12-real-api.md) | Xác nhận target và sao lưu trước khi deploy đúng thứ tự; sau migrate chạy seed danh mục |
| 12 | Sharp trên image Alpine (`node:24.22.3-alpine3.23`) chưa kiểm chứng | Phase 04 | Build image rồi xử lý một ảnh thật trong container api và worker trước khi dựa vào upload |
| 13 | `STORAGE_DRIVER=s3` với bucket thật chưa thử: tải, xử lý, xóa `incoming/`, đọc `public/` | Phase 04 | Thử trên staging. Nên dùng `S3_INCOMING_BUCKET` riêng để đóng cửa sổ phơi bày (xem [Bucket công khai](#bucket-công-khai)) |
| 14 | ~~Nginx admin giới hạn `2m` cho route upload import~~ | Đã sửa 2026-11-12 | Location riêng theo `IMPORT_MAX_FILE_BYTES` (xem [Giới hạn import Excel](#giới-hạn-import-excel)) |
| 15 | Deploy staging và 4 migration phase 05 chưa chạy: `20261112074412_add_players_pairs_competitors`, `20261112074503_add_entries`, `20261112074532_add_import_jobs`, `20261112074553_add_player_merge` | Phase 05 bước 1 và 6 đến 8 | Làm sau migration phase 04 theo [roadmap](./development-roadmap.md). Trước `migrate deploy` chạy `pnpm db:print-target` |
| 16 | Test API có một lần crash native `0xC0000409` (1/6 lần chạy đầy đủ, Windows), chưa rõ nguyên nhân | `plans/reports/tester-261112-1436-phase-05-test-run-2.md` | Chạy lặp với reporter verbose để tìm file cuối trước khi crash. Trùng với F1 phase 04 |
| 17 | Chưa thử file xlsx do Excel thật tạo. Bộ test dùng file viết tay có cấu trúc giống Excel | `plans/reports/tester-261112-1436-phase-05-test-run-2.md` | Thêm một file mẫu nhỏ, không có dữ liệu thật, vào `apps/api/test/fixtures/` trước pilot |
| 18 | Worker đọc sheet đầu theo tên `xl/worksheets/sheetN.xml`, không theo thứ tự tab. Nếu người dùng đổi thứ tự tab, kiểm header báo lỗi | `plans/reports/code-reviewer-261112-1436-phase-05-review-2.md` | Ghi rõ trong hướng dẫn cho BTC: sheet đăng ký phải là sheet đầu tiên của file |
| 19 | Route `/api/revalidate` ở client đã có (phase 08 lát cắt, đã commit). Chưa kiểm trên staging: worker gọi `client` qua mạng `internal` và Host khớp `REVALIDATE_ALLOWED_HOSTS` | [system-architecture](./system-architecture.md#route-apirevalidate-ở-client-phase-08), review phase 08 | Deploy staging, chốt một trận hoặc bỏ công bố một nhánh, rồi xem job `revalidate` trong bull-board và trang công khai |
| 20 | Phase 08 chưa lên staging (mốc M1): Playwright mới chạy trên máy dev, chưa chạy trên staging | [public-site](./public-site.md#việc-còn-mở) | Sau khi deploy: kiểm trang giải, nhánh, `robots.txt`, `sitemap.xml`, header CSP report-only trên domain staging |
| 21 | Rate limit công khai và `forwardedHeaders` của Traefik chưa kiểm | Mục Traefik ở [Preflight hạ tầng](#preflight-hạ-tầng-trạng-thái) | Trên staging: gửi `X-Forwarded-For` giả từ client và xem IP mà client thấy. Chỉnh Traefik nếu nó tin header client |
| 22 | `API_FETCH_TIMEOUT_MS` giữ ở env vì giới hạn request bootstrap API/settings | Đã đối chiếu 2026-11-15 | Không còn chờ quyết định; xem `plans/reports/reviewer-261115-phase08-review-debt-audit.md`. Timeout của revalidation nền do Next điều khiển vẫn là giới hạn riêng |
| 23 | Phase 12 chưa nghiệm thu CSP enforce, Lighthouse/axe, tải nhẹ, E2E toàn luồng, rollback/restore | Phase 12 | Hoàn thành và lưu bằng chứng theo [cổng nghiệm thu ra mắt](#cổng-nghiệm-thu-ra-mắt-phase-12); không dùng kết quả local/mock để đóng staging |

## Liên quan

- [system-architecture.md](./system-architecture.md): thành phần, luồng mạng, health endpoints.
- [auth-and-rbac.md](./auth-and-rbac.md): đăng nhập, phân quyền, lỗi thường gặp của đăng nhập.
- [code-standards.md](./code-standards.md): tiêu chuẩn migration, `.env`, git.
