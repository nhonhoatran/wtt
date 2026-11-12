# Deployment Guide — Kamito

> Cập nhật: 2026-11-12 · Trạng thái: phase 01. Staging và production chưa được dựng trên Dokploy.
> Nguồn đối chiếu: `docker-compose.yml`, `docker-compose.dev.yml`, `docker/*`, `scripts/print-db-target.mjs`, `.env.example`, `.github/workflows/ci.yml`.
> Kiến trúc và luồng khởi động xem [system-architecture.md](./system-architecture.md). Tiêu chuẩn migration xem [code-standards.md](./code-standards.md#database-và-migration).

## Contents
- [Môi trường](#môi-trường)
- [Chạy dev local](#chạy-dev-local)
- [Biến môi trường theo service](#biến-môi-trường-theo-service)
- [Dokploy: compose và domain](#dokploy-compose-và-domain)
- [Quy trình phát hành](#quy-trình-phát-hành)
- [Runbook: migration lỗi](#runbook-migration-lỗi)
- [Sao lưu và khôi phục](#sao-lưu-và-khôi-phục)
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
| `S3_ENDPOINT` | api | có | URL S3 API |
| `S3_REGION` | api | có | |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | api | có | Service account chỉ có quyền trên một bucket (mục tiêu) |
| `S3_BUCKET` | api | có | |
| `S3_FORCE_PATH_STYLE` | api | không | Mặc định `true` |
| `S3_PRESIGN_ENDPOINT`, `S3_PUBLIC_BASE_URL` | api | không | Chỉ dùng cho thiết kế upload (a), chưa chốt |
| `AUTH_SECRET` | api | có | ≥ 32 ký tự, riêng từng môi trường |
| `REVALIDATE_SECRET` | api, client | có | Khác `AUTH_SECRET` |
| `SSR_INTERNAL_SECRET` | api, client | có | Định danh request SSR nội bộ |
| `IP_HASH_SALT` | api | có | Hash IP của form liên hệ (phase 11) |
| `CLIENT_INTERNAL_URL` | api | không | Mặc định `http://client:3000` |
| `PUBLIC_SITE_URL` | api, client, admin | có | Canonical, sitemap, kiểm `Origin` |
| `ADMIN_PUBLIC_URL` | api, admin | có | |
| `TRUST_PROXY_HOPS` | api | có (compose) | Mã mặc định trong code là `0`. Số proxy tin cậy trước api |
| `API_PORT` | api | cố định | `3000` |
| `UPLOAD_MAX_IMAGE_BYTES`, `UPLOAD_ALLOWED_IMAGE_TYPES`, `MEDIA_IMAGE_VARIANT_WIDTHS` | api | có | Tham số kỹ thuật upload |
| `IMPORT_MAX_FILE_BYTES`, `IMPORT_MAX_UNZIPPED_BYTES`, `IMPORT_MAX_ROWS`, `IMPORT_RETENTION_DAYS` | api | có | Trần import (phase 05) |
| `WORKER_HEALTH_PORT` | worker | cố định | `3010` |
| `API_INTERNAL_URL` | client | không | Mặc định `http://api:3000` |
| `PUBLIC_REVALIDATE_SECONDS`, `MATCHDAY_REVALIDATE_SECONDS` | client | có (compose) | TTL cache. Code client chưa đọc (phase 02+) |
| `API_BASE_PATH` | admin | không | Mặc định `/api/v1`. Ghi vào `/config.json` |

Biến có trong code nhưng **không có trong compose và `.env.example`**:

| Biến | Đọc ở | Mặc định | Vấn đề |
|---|---|---|---|
| `PAGINATION_DEFAULT_PAGE_SIZE` | api (`env-schema.ts`) | 20 | Compose không truyền, nên Dokploy không đổi được nếu không sửa compose |
| `PAGINATION_MAX_PAGE_SIZE` | api | 100 | Như trên |
| `QUERY_MAX_LENGTH` | api | 100 | Như trên |
| `SHADOW_DATABASE_URL` | `packages/db/prisma.config.ts` | — | Chỉ cho `migrate dev` trên server dev dùng chung (phase 01 bước 15). Chưa có trong `.env.example` |

Quyết định cần chốt: đưa ba biến phân trang vào compose hoặc giữ mặc định trong code.

## Dokploy: compose và domain

- File: `docker-compose.yml` (một file cho staging và production). Project name: `kamito-tt`.
- Service:

  | Service | Build target | Mạng | Ghi chú |
  |---|---|---|---|
  | `migrate` | `docker/api.Dockerfile`, target `migrate` | `internal` | `restart: "no"`, chạy một lần |
  | `api` | `docker/api.Dockerfile`, target `runtime` | `internal` | `expose: 3000`, không có domain. Phụ thuộc `migrate` hoàn tất |
  | `worker` | `docker/worker.Dockerfile` | `internal` | Phụ thuộc `migrate`. Health cổng 3010 |
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
| Traefik | Có chuyển IP thật vào container không; có ghi đè XFF không; có tin `forwardedHeaders` không | Chưa kiểm |
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

## Kiểm tra sau deploy

Chạy từ máy có quyền truy cập domain (thay `<admin-domain>`):

```bash
curl -fsS https://<admin-domain>/healthz                 # 200 {"status":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' https://<admin-domain>/api/v1/health/ready   # 404 (đúng: không lộ ra ngoài)
curl -s -o /dev/null -w '%{http_code}\n' https://<admin-domain>/api/v1/public/x      # 404
curl -fsS https://<admin-domain>/config.json             # chỉ 3 khóa: API_BASE_PATH, ADMIN_PUBLIC_URL, PUBLIC_SITE_URL
```

Kiểm nội bộ, trong container api (cùng lệnh với healthcheck của compose):

```bash
wget -qO- http://127.0.0.1:3000/api/v1/health/live
wget -qO- http://127.0.0.1:3000/api/v1/health/ready      # status: ready hoặc degraded (không phải not_ready)
```

Trong container worker: `wget -qO- http://127.0.0.1:3010/health`.

Staging phải có 4 service `healthy`, client và admin mở được qua domain, api không có domain công khai.

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

## Việc còn mở

| # | Việc | Nguồn | Hướng xử lý |
|---|---|---|---|
| 1 | Dokploy có tôn trọng `service_completed_successfully` không | Spike D | Nếu không: thêm profile `tools` cho `migrate` vào compose |
| 2 | Traefik có ghi đè XFF do client gửi không; có tin forwarded headers không | Review M7, phase 01 | Chốt giá trị `TRUST_PROXY_HOPS` theo kết quả |
| 3 | Tên DNS `api` có đụng service khác trên `dokploy-network` không | Review H3 | Alias riêng, hoặc Isolated Deployment |
| 4 | Build image trên Dokploy hay ở CI kèm registry | Phase 01 rủi ro | Chưa chốt |
| 5 | Chủ sở hữu, RPO, lịch, nơi lưu sao lưu | Phase 01 bước 15 | Chưa chốt |
| 6 | Thiết kế upload (a) hoặc (b) | Phase 01 bước 15 | Chưa chốt |
| 7 | Hạ tầng PostgreSQL, Redis, MinIO có dùng chung không; role và quyền | Phase 01 bước 15 | Chưa có câu trả lời |
| 8 | Ba biến phân trang nằm ngoài compose | Mục [Biến môi trường](#biến-môi-trường-theo-service) | Chốt đưa vào compose hay giữ mặc định |
| 9 | Client chưa truyền `ADMIN_PUBLIC_URL` trong compose (phase 01 bảng biến có ghi) | So sánh compose với bảng phase | Thêm nếu client cần đọc |
| 10 | CI (`.github/workflows/ci.yml`) chỉ chạy khi push lên `main` hoặc mở PR. Repo chưa có remote | Quyết định 2026-11-12 | Push cuối dự án |

## Liên quan

- [system-architecture.md](./system-architecture.md): thành phần, luồng mạng, health endpoints.
- [code-standards.md](./code-standards.md): tiêu chuẩn migration, `.env`, git.
