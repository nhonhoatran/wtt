# System Architecture — Kamito

> Cập nhật: 2026-11-16 · Trạng thái: phase 01 (khung), phase 03–08 đã commit (phase 08 đến `a26f833`), chưa deploy staging. Phase 09: lõi đã commit; màn admin xếp hạng và thay đổi API nhỏ nằm trong working tree (chưa commit). Trạng thái từng phase: xem [roadmap](./development-roadmap.md).
> Bốc thăm và vòng bảng chi tiết: [draws-and-groups.md](./draws-and-groups.md).
> Nguồn đối chiếu: `apps/*/src`, `packages/*/src`, `packages/db/prisma`, `docker/*`, `docker-compose*.yml`.
> Tiêu chuẩn code xem [code-standards.md](./code-standards.md). Triển khai xem [deployment-guide.md](./deployment-guide.md). Chi tiết đăng nhập và phân quyền xem [auth-and-rbac.md](./auth-and-rbac.md).

## Contents
- [Tổng quan](#tổng-quan)
- [Thành phần](#thành-phần)
- [Luồng mạng (staging và production)](#luồng-mạng-staging-và-production)
- [Luồng khởi động](#luồng-khởi-động)
- [Health endpoints](#health-endpoints)
- [Dữ liệu](#dữ-liệu)
- [Upload ảnh (phase 04)](#upload-ảnh-phase-04)
- [Vận động viên và đăng ký (phase 05)](#vận-động-viên-và-đăng-ký-phase-05)
- [Bốc thăm và vòng bảng (phase 06)](#bốc-thăm-và-vòng-bảng-phase-06)
- [Nhập, lịch và revalidate (phase 07)](#nhập-lịch-và-revalidate-phase-07)
- [Site công khai (phase 08)](#site-công-khai-phase-08)
- [Xác thực và phân quyền (phase 03)](#xác-thực-và-phân-quyền-phase-03)
- [Dịch vụ dùng chung trong api](#dịch-vụ-dùng-chung-trong-api)
- [Packages dùng chung](#packages-dùng-chung)
- [Admin: menu và module](#admin-menu-và-module)
- [Chưa xây dựng](#chưa-xây-dựng)
- [Quyết định kiến trúc](#quyết-định-kiến-trúc)

## Tổng quan

Nền tảng giải bóng bàn Kamito: site công khai (tiếng Việt và tiếng Anh), trang quản trị giải đấu, API, và worker xử lý nền. Monorepo pnpm + Turborepo gồm 4 app và 5 package.

Đường đi chính:
- Người xem: trình duyệt → client (Next.js, SSR) → api (nội bộ).
- Quản trị: trình duyệt → admin (nginx phục vụ SPA, proxy vào api) → api. Đăng nhập bằng session cookie (Better Auth), phân quyền ở api.
- Ảnh: admin tải lên qua api → worker xử lý (WebP) → `public/` trên object storage hoặc thư mục local (dev).
- Nền: api và worker dùng chung PostgreSQL, Redis (`noeviction`, dành cho queue BullMQ và khóa đăng nhập), object storage (S3 API, hoặc driver `local` khi dev). api đưa job vào queue `media`, `import` và `revalidate`, và chạy bull-board; worker chạy processor cho ba queue này.
- Cache công khai: api đưa tag vào queue `revalidate` sau khi ghi xong; worker gọi `client` `/api/revalidate` để xóa cache theo tag. Trang công khai (phase 08) đọc dữ liệu từ api qua `/api/v1/public/*`, bằng secret nội bộ.

## Thành phần

| Thành phần | Công nghệ | Cổng | Mạng | Vai trò hiện tại |
|---|---|---|---|---|
| `apps/client` | Next.js 16.4.3, React 19.3.1 | 3000 trong container, 3001 khi dev | `internal`, `dokploy-network` | Site công khai `[locale]` (vi, en): trang chủ tạm, danh sách và lịch giải, trang giải 6 tab, trang trận, nhánh đấu, SSR đọc `api` công khai. Route `/api/revalidate`, `/api/csp-report`, `/api/health`, `sitemap.ts`, `robots.ts`, `proxy.ts`. Chi tiết: [public-site.md](./public-site.md) |
| `apps/admin` | Vite 8.3.5, React 19.3.1, antd 5.29.3, `@refinedev/core` 5.0.12 + `@refinedev/antd` 6.0.3, react-router 7.18.5, TipTap 3.33.1 | 8080 trong container (nginx-unprivileged), 5173 khi dev | `internal`, `dokploy-network` | Đăng nhập, người dùng, nhật ký, `/settings`, danh mục cấu hình, địa điểm và bàn, danh sách giải, hub giải, ô tải ảnh, ô soạn rich text, VĐV, cặp đôi, tab Danh sách đăng ký, wizard import, gộp VĐV, tab Bốc thăm (wizard sinh nhánh, bảng sơ đồ, vòng bảng, thao tác sau công bố), trang Nhập tỷ số `/results`, tab Lịch & kết quả (session, lưới xếp lịch, panel chưa xếp), in phiếu trận |
| `apps/api` | NestJS 12.3.2 trên Express 5.3.0, Better Auth 1.7.21, BullMQ 6.5.1, sharp 0.35.5, sanitize-html 2.18.1 | `API_PORT` (3000) | `internal` | Health, error filter, pagination, audit, auth và RBAC, users, settings, nhật ký (đọc), bull-board, danh mục CRUD, địa điểm và bàn, giải và nội dung thi đấu, media (intent, nội dung, complete, public), CLI `create-admin`, VĐV và gộp VĐV, cặp đôi (đọc), đăng ký, import và export Excel (phase 05), bốc thăm, nhánh, vòng bảng, trận, đọc (phase 06), nhập, chốt, sửa và mở lại tỷ số, session và xếp lịch, phiếu trận, xuất lịch và kết quả, revalidation (phase 07), API công khai `/public/*` (phase 08) |
| `apps/worker` | Node, ioredis, BullMQ 6.5.1, sharp 0.35.5 | `WORKER_HEALTH_PORT` (3010) | `internal` | Kiểm Redis lúc boot, health HTTP, media worker: job `process-image` và job dọn định kỳ `cleanup-expired-intents`. Import worker (queue `import`): `validate-import`, `commit-import`, dọn file import định kỳ. Revalidate worker (queue `revalidate`): job `revalidate-tags`, gọi `client` `/api/revalidate` |
| `migrate` (target của `api.Dockerfile`) | Prisma CLI | — (chạy một lần) | `internal` | Xác nhận target, `prisma migrate deploy` |
| PostgreSQL | 17.11 (dev) | 5433 (dev) | ngoài compose prod | Dữ liệu nghiệp vụ, `_prisma_migrations` |
| Redis | 8.2.11, `noeviction`, AOF (dev) | 6380 (dev) | ngoài compose prod | Queue BullMQ (`media`, `import`, `revalidate`, `maintenance`), khóa đăng nhập, bull-board |
| Object storage | S3 API; dev dùng RustFS 1.0.4, hoặc driver `local` | 9010 API, 9011 console (dev) | ngoài compose prod | Ảnh: `incoming/` (riêng tư), `public/` (đã xử lý). Xem [Upload ảnh](#upload-ảnh-phase-04) |

Packages: `@kamito/db`, `@kamito/shared`, `@kamito/ui-tokens`, `@kamito/config`, `@kamito/competition-engine` (phase 06 và 07, hàm thuần; phase 07 thêm `validateMatchScore`, `validateProgressGames`, `computeReopenImpact`). Chi tiết ở [Packages dùng chung](#packages-dùng-chung).

## Luồng mạng (staging và production)

```
Browser ─TLS─> Traefik (Dokploy) ─> client (Next.js, domain công khai)
                                      └─ SSR fetch ──> api:3000   (internal; `/api/v1/public/*`, header x-internal-secret)
Browser ─TLS─> Traefik ─> admin (nginx: SPA tĩnh + proxy)
                            ├─ /api/v1/admin/*  ──> api:3000
                            ├─ /api/v1/auth/*   ──> api:3000
                            ├─ /api/v1/media/*  ──> api:3000   (ảnh public/, không cần đăng nhập)
                            └─ /api/*  khác     ──> 404
api ──> PostgreSQL / Redis / S3 (URL ngoài, qua env)
worker ──> PostgreSQL / Redis / S3
worker ──> client:3000/api/revalidate   (phase 08, kiểm Host và secret)
```

Quy tắc:
- **API không có domain công khai.** Chỉ `client` và `admin` có domain (gắn qua tab Domains của Dokploy, compose dùng `expose`, không `ports`).
- `api` chỉ nằm trên mạng `internal`. `client` và `admin` nằm trên cả `internal` và `dokploy-network`.
- Admin nginx (`docker/admin-nginx.conf`):

  | Đường dẫn trên domain admin | Kết quả |
  |---|---|
  | `/healthz` | 200 `{"status":"ok"}` (nginx tự trả) |
  | `/api/v1/admin/*`, `/api/v1/auth/*` | proxy tới api (`docker/admin-api-proxy.conf`) |
  | `/api/v1/admin/media/<id>/content` | proxy tới api, `client_max_body_size` lấy từ `UPLOAD_MAX_IMAGE_BYTES` |
  | `/api/v1/media/*` | proxy tới api (chỉ route `media/public`) |
  | `/api/*` khác (kể cả `/api/v1/public/*`, `/api/v1/health/*`) | 404 |
  | `/config.json` | file sinh lúc start (xem dưới) |
  | `/assets/*` | `Cache-Control` 1 năm, immutable |
  | `/*` | SPA fallback về `index.html`, `no-cache` |

  Body JSON của các route khác giới hạn `client_max_body_size 2m`, phải lớn hơn `JSON_BODY_LIMIT` của api (khoảng 1,2 MB, `apps/api/src/common/http/json-body-limit.ts`).

- **Resolve tên `api` lúc request:** `resolver 127.0.0.11` + biến `$api_upstream`. Nginx khởi động được khi api chưa sẵn sàng, và theo IP mới khi api tạo lại.
- **Rủi ro đã ghi nhận:** tên DNS `api` có thể đụng service khác trên `dokploy-network` dùng chung (review H3, `plans/reports/code-reviewer-261112-0907-phase-01-foundation-review.md`). Hoãn sang Spike D: alias riêng hoặc Isolated Deployment.

### Chuỗi proxy và IP thật

- Chuỗi tin cậy: Traefik → nginx (admin) hoặc Next (client) → api.
- nginx chuyển tiếp `X-Forwarded-For` nguyên vẹn, không nối thêm hop. API đặt `trust proxy` = `TRUST_PROXY_HOPS`.
- Dev không có proxy: `TRUST_PROXY_HOPS=0` (`.env.example`). Compose prod bắt buộc khai biến này.
- Chưa kiểm: Traefik có ghi đè XFF do client gửi không, và có tin `forwardedHeaders` không. Kiểm ở Spike D.
- Rate limit cho site công khai đặt ở `proxy.ts` của client (thấy IP thật qua `X-Real-Ip` hoặc phần tử cuối `X-Forwarded-For`), không đặt ở api. Chưa kiểm trên staging: Traefik có tin `forwardedHeaders` của client không. Chi tiết: [public-site.md](./public-site.md#proxy-locale-chặn-revalidate-rate-limit).

### Admin: cấu hình lúc chạy

`docker/admin-entrypoint.sh` chạy khi container start. Ghi `/tmp/admin-config/config.json` từ **allowlist** ba khóa: `API_BASE_PATH`, `ADMIN_PUBLIC_URL`, `PUBLIC_SITE_URL`. Không khóa nào khác được ghi. `apps/admin/test/admin-entrypoint.test.mjs` kiểm việc này bằng biến chứa chuỗi `must-not-leak`.

Cùng lúc đó, entrypoint đọc `UPLOAD_MAX_IMAGE_BYTES` (bắt buộc, phải là số nguyên dương; thiếu hoặc sai thì container thoát lỗi) và ghi `client_max_body_size` vào `/tmp/admin-config/upload-limit.conf`. Nginx include file này ở route tải ảnh.

Vì vậy đổi URL và trần upload không cần build lại admin image. File `/config.json` có `Cache-Control: no-store`.

## Luồng khởi động

**API** (`apps/api/src/main.ts`):
1. `loadApiEnv()` parse env bằng zod. Lỗi → in tên biến, thoát.
2. `createApiApp()` (`bootstrap-app.ts`): Nest + pino, `trust proxy`, prefix `api/v1`, `HttpExceptionFilter`, shutdown hooks, `useBodyParser('json', { limit: JSON_BODY_LIMIT })`. Trước `app.init()` gắn trên Express: handler raw của Better Auth (`/api/v1/auth/sign-in/email`, `/sign-out`) và bull-board (`/api/v1/admin/queues`). Các guard toàn cục (session, mật khẩu tạm, quyền, step-up) đăng ký trong `AuthModule`. Chi tiết xem [auth-and-rbac.md](./auth-and-rbac.md#chuỗi-guard).
3. `RedisEvictionPolicyCheck` kiểm `maxmemory-policy` lúc bootstrap, cache kết quả cho `/health/ready`.
4. `findPendingMigrations(prisma)`: nếu còn migration đi kèm image chưa áp dụng → log và `exit(1)`.
5. `listen(API_PORT, '0.0.0.0')`.

**Worker** (`apps/worker/src/main.ts`):
1. `loadWorkerEnv()` parse env. Kiểm `QUEUE_PREFIX` đúng dạng `kamito-tt:<APP_ENV>`. Kiểm storage: `STORAGE_DRIVER=s3` thì bắt buộc đủ `S3_*`.
2. `checkRedisEvictionPolicy(env)`:
   - Không kết nối được Redis → `fatal` → thoát `1`.
   - Policy khác `noeviction`: `production` → `fatal` → thoát `1`; môi trường khác → `degraded` (log lỗi, health báo `degraded`).
   - Không đọc được policy: nếu `REDIS_EVICTION_CHECK_OVERRIDE` có giá trị → `overridden` (log cảnh báo, vẫn chạy). Nếu không → như trên.
3. Mở health server trên `WORKER_HEALTH_PORT`. Gọi `startMediaWorker` (`media-worker.ts`): mở Prisma client, upsert job scheduler `media-intent-cleanup` (chu kỳ `MEDIA_CLEANUP_INTERVAL_MINUTES`), tạo `Worker` cho queue `media` với `concurrency` = `MEDIA_WORKER_CONCURRENCY`.
4. `startImportWorker` (queue `import`) và `startRevalidateWorker` (`revalidate-worker.ts`, queue `revalidate`, concurrency `REVALIDATE_WORKER_CONCURRENCY`).
5. `SIGTERM` / `SIGINT`: đóng health server, đóng media, import và revalidate worker, ngắt Prisma, `redis.quit()`, thoát `0`.

**Worker không kiểm migration lúc boot** (khác với api). Prisma client được mở khi media worker khởi động, nhưng `findPendingMigrations` không được gọi. Đây là khoảng trống đã ghi nhận ở phase 01; cần xem lại trước khi triển khai worker có thêm queue.

**Migrate** (`docker/migrate-entrypoint.sh`):
1. `node scripts/print-db-target.mjs --confirm`: in `host:port/database` (ẩn mật khẩu). Nếu `MIGRATE_CONFIRM_TARGET` không khớp đúng `host:port/database` → thoát `3`.
2. `prisma migrate status` (chỉ để xem; lỗi bị bỏ qua có chủ ý).
3. `prisma migrate deploy`.

`DATABASE_URL` thiếu → `print-db-target.mjs` thoát `2`.

**Admin:** entrypoint ghi `config.json` và `upload-limit.conf` → nginx chạy.

**Client:** Next standalone (`node apps/client/server.js`).

Thứ tự triển khai: `migrate` hoàn tất → api và worker khởi động (compose `depends_on: service_completed_successfully`). Nếu Dokploy không tôn trọng điều kiện này, api vẫn tự dừng khi thiếu migration.

## Health endpoints

| Service | Endpoint | Nội dung | Mã HTTP |
|---|---|---|---|
| api | `GET /api/v1/health/live` | `{"status":"ok"}`, không gọi dependency. Dùng cho healthcheck container | 200 |
| api | `GET /api/v1/health/ready` | Kiểm 4 mục: `database`, `migrations`, `redis`, `storage`. Mỗi kiểm tra có timeout 3 giây | 200 khi `ready` hoặc `degraded`; 503 khi `not_ready` |
| worker | `GET /health` (cổng `WORKER_HEALTH_PORT`) | `{"status":"ok"}` hoặc `{"status":"degraded","detail":...}` | 200 cả khi degraded; path khác 404 |
| client | `GET /api/health` | `{"status":"ok"}` | 200 |
| admin | `GET /healthz` (nginx) | `{"status":"ok"}` | 200 |

Chi tiết `/health/ready`:
- `database`: `SELECT 1`.
- `migrations`: `down` nếu còn migration chờ (`pending: ...`).
- `redis`: `PING`, rồi xem verdict eviction. `fatal` → `down`; `degraded` → `degraded`.
- `storage`: `ping()` của driver đang chọn. S3: `HeadBucket` trên `S3_BUCKET`. Local: tạo thư mục gốc nếu thiếu.
- Tổng hợp: có `down` → `not_ready`; có `degraded` → `degraded`; còn lại `ready`.

Health không được ghi log (`autoLogging.ignore`). Admin và client không chuyển tiếp `/health/*` ra ngoài; nginx admin trả 404.

## Dữ liệu

Migration theo thứ tự:
1. `packages/db/prisma/migrations/20261112015704_init_app_settings_audit_log` (phase 01)
2. `packages/db/prisma/migrations/20261112042429_add_users_and_auth_sessions` (phase 03)
3. `packages/db/prisma/migrations/20261112061544_add_tournament_master_data` (phase 04: danh mục, giải, nội dung thi đấu)
4. `packages/db/prisma/migrations/20261112061630_add_media_assets` (phase 04: ảnh)
5. `packages/db/prisma/migrations/20261112070130_add_single_default_partial_indexes` (phase 04: một mặc định duy nhất)

6. `packages/db/prisma/migrations/20261112074412_add_players_pairs_competitors` (phase 05: `Player`, `Pair`, `Competitor`; sequence `player_code_seq`; CHECK)
7. `packages/db/prisma/migrations/20261112074503_add_entries` (phase 05: `Entry`)
8. `packages/db/prisma/migrations/20261112074532_add_import_jobs` (phase 05: `ImportJob`, `ImportRow`)
9. `packages/db/prisma/migrations/20261112074553_add_player_merge` (phase 05: `Player.mergedAt`, gộp VĐV)
10. `packages/db/prisma/migrations/20261113030544_add_draws_rounds_matches_games` (phase 06: `Draw`, `BracketPosition`, `Round`, `Match`, `Game`, `EventMatchCounter`)
11. `packages/db/prisma/migrations/20261113030600_add_groups_and_standings` (phase 06: `Group`, `GroupMember`, `GroupStanding`)
12. `packages/db/prisma/migrations/20261113091254_add_ranking_lists_and_rules` (phase 09: bảng xếp hạng và luật; đã commit trước phiên cập nhật này)
13. `packages/db/prisma/migrations/20261113091336_add_ranking_ledger_and_snapshots` (phase 09: sổ điểm và snapshot)
14. `packages/db/prisma/migrations/20261114064027_add_sessions_and_match_scheduling` (phase 07: `EventSession`, `EventSessionTable`, cột lịch của `Match`)
15. `packages/db/prisma/migrations/20261114071907_add_match_schedule_indexes` (phase 07: index lịch)
16. `packages/db/prisma/migrations/20261115032757_add_player_public_name_key` (phase 08: khóa tên công khai, trigger/backfill/index; DB dev local đã áp dụng, staging chưa)

Schema tách file: `base.prisma`, `app-setting.prisma`, `audit-log.prisma`, `auth.prisma`, `tournament-catalog.prisma`, `tournament-event.prisma`, `media.prisma`, `players-and-entries.prisma`, `imports.prisma`, `draws-and-matches.prisma`, `groups-and-standings.prisma`, `sessions.prisma`.

**`AppSetting`** — chỉ giá trị nghiệp vụ và tham số vận hành. Key, zod schema và default nằm trong `@kamito/shared` (`app-setting-registry.ts`).

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `key` | TEXT, PK | Ví dụ `auth.login.ipMaxAttempts` |
| `value` | JSONB | |
| `updatedById` | TEXT, nullable | |
| `updatedAt` | TIMESTAMP(3) | `@updatedAt` |

Registry gồm các nhóm dưới đây. Danh sách key, khoảng giá trị và nhóm: [auth-and-rbac](./auth-and-rbac.md#cài-đặt-vận-hành-settings).
- `site.name` (`siteName`, mặc định `vi` và `en`). Chưa có editor, không sửa được trên `/settings`.
- 10 key `auth.*` và `list.defaultPageSize`. Sửa được trên `/settings`. Bảng đầy đủ xem [auth-and-rbac.md](./auth-and-rbac.md#cài-đặt-vận-hành-settings).
- 8 key phase 04 (`tournament-settings.ts`): `event.defaultTimezone`, `event.defaultDurationDays`, `venue.tablePrefix`, `header.resultsStrip.enabled`, `home.featuredEventId`, `media.maxImageMegabytes`, `media.intentTtlMinutes`, `media.processingTimeoutMinutes`. Sửa được trên `/settings`.
- 10 key phase 05 (`player-settings.ts`, `import-operational-settings.ts`): `player.codePrefix`, `player.codeDigits`, `player.defaultCountryCode`, `player.showAge`, `entry.maxBulkItems`, `category.ageCalculation`, `import.maxFileMegabytes`, `import.maxRows`, `import.retentionDays`, `import.uploadTtlHours`. Sửa được trên `/settings`. Bảng mặc định và khoảng xem [auth-and-rbac.md](./auth-and-rbac.md#cài-đặt-vận-hành-settings).
- 4 key phase 06 (`tournament-settings.ts`, nhóm `draw`): `draw.defaultSeedPercent` (25 %), `draw.defaultGroupSize` (4), `draw.defaultAdvancePerGroup` (2), `draw.defaultQualifierCount` (4). Đây là giá trị điền sẵn khi sinh nhánh; từng nội dung vẫn sửa được. Sửa được trên `/settings`.
- 2 key lịch (phase 07, `tournament-settings.ts`, nhóm `event`): `schedule.minRestMinutes` (20 phút), `schedule.sessionMatchCap` (500 trận). Chi tiết: [scheduling](./scheduling.md#cài-đặt).

**`AuditLog`** — ghi mọi thay đổi nghiệp vụ (xem bảng bên dưới).

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | TEXT, PK | UUID |
| `actorType` | enum `AuditActorType` (`USER`, `SYSTEM`) | |
| `actorId` | TEXT | id người dùng, hoặc `system` |
| `action` | TEXT | Ví dụ `match.result.confirm` |
| `entity`, `entityId` | TEXT | |
| `before`, `after` | JSONB, nullable | đã mask PII |
| `reason` | TEXT, nullable | |
| `ip`, `userAgent`, `sessionId`, `requestId` | TEXT, nullable | lấy từ request context |
| `createdAt` | TIMESTAMP(3) | default `CURRENT_TIMESTAMP` |

Index: `(entity, entityId)` và `(actorId, createdAt)`.

**Bảng auth (migration phase 03)** — shape Better Auth yêu cầu, cộng cột riêng của dự án:

| Bảng | Cột riêng của dự án | Ghi chú |
|---|---|---|
| `User` | `role` (enum `UserRole`: `ADMIN`, `RESULTS_OPERATOR`, mặc định `RESULTS_OPERATOR`), `isActive` (mặc định true), `mustChangePassword`, `tempPasswordExpiresAt`, `lastLoginAt` | Index `(role, isActive)`. Sign-up tắt, không có tài khoản mặc định trong code |
| `Session` | `lastSeenAt`, `stepUpAt` | Index `userId`. Hết hạn tuyệt đối và idle do api kiểm, không do Better Auth |
| `Account` | `password` (scrypt, không bao giờ trả ra API) | Provider `credential`. Index `userId` |
| `Verification` | — | Shape bắt buộc của Better Auth, dự án chưa dùng |

### Danh mục cấu hình (phase 04)

Các bảng danh mục do admin quản lý. Quy ước chung:
- Mã (`code`) là khóa duy nhất, kiểu chữ in hoa. Tên có `name` (tiếng Việt, bắt buộc) và `nameEn` (tùy chọn). Trang công khai đọc `nameEn ?? name`.
- Ẩn bằng `isActive = false`. Không xóa khi đang được dùng (xem [code-standards.md](./code-standards.md#danh-mục-danh-sách-và-xóa-phase-04)).
- Liên kết tới danh mục dùng `onDelete: Restrict`.

| Model | Khóa và ràng buộc | Liên kết và cột chính |
|---|---|---|
| `Tier` | `code` unique | `logoMediaId`, `backgroundMediaId` → `MediaAsset` (SetNull). `colorHex`, `order` |
| `EventType` | `code` unique; index `tierId` | `tierId` → `Tier` (Restrict). Logo và nền → `MediaAsset` (SetNull) |
| `Category` | `code` unique | `kind` (`AGE`, `SKILL`, `OPEN`), `minAge`, `maxAge` |
| `Discipline` | `code` unique | `competitorKind` (`SINGLES`, `DOUBLES`), `genderRule` (`MEN`, `WOMEN`, `MIXED`, `OPEN`) |
| `MatchFormat` | Partial unique index `MatchFormat_single_default` trên `isDefault` (chỉ một dòng `true`) | `bestOf`, `pointsPerGame`, `winBy`, `estimatedMinutes` |
| `GroupScoringRule` | Partial unique index `GroupScoringRule_single_default` trên `isDefault` | Điểm thắng, thua, thua walkover, thua chưa đấu xong. `unfinishedMatchScoring`, `awardedGamePoints`. `withdrawalPolicy` nullable (`null` = chưa chốt). `tiebreakers` JSON (danh sách `TiebreakCriterion`) |
| `Venue` | — | `address`, `city`, `mapUrl` (https) |
| `VenueTable` | `(venueId, code)` unique | `venueId` → `Venue` (Cascade). `displayName`, `order` |

Partial unique index không biểu diễn được trong Prisma schema, nên nằm trong SQL migration. Migration sau này không được sinh `DROP INDEX` cho hai index này (kiểm SQL trước khi `migrate deploy`).

### Giải và nội dung thi đấu (phase 04)

| Model | Khóa và ràng buộc | Ghi chú |
|---|---|---|
| `Event` | `slug` unique; index `startDate`, `eventTypeId`, `venueId` | `eventTypeId`, `venueId` → Restrict. `startDate`, `endDate` kiểu DATE. `timezone` (IANA). `publishStatus` (`DRAFT`, `PUBLISHED`), `publishedAt`, `isCancelled`, `isFeatured`. `ticketUrl` và `showTicket`. `bannerMediaId` → `MediaAsset` (SetNull). `summary`, `summaryEn`, `infoBody`, `infoBodyEn` (HTML đã sanitize), `showInfoTab` |
| `SubEvent` | `(eventId, code)` unique | `eventId` → `Event` (Cascade, nhưng API chặn xóa giải đang có nội dung thi đấu). `disciplineId`, `categoryId`, `matchFormatId`, `groupScoringRuleId` → Restrict. `format` (`KNOCKOUT`, `GROUP_KNOCKOUT`), `hasQualifying`, `maxEntries`, `order` |

Lifecycle của giải (sắp diễn ra, đang diễn ra, đã kết thúc, đã hủy) **không lưu cột**. Suy ra từ `startDate`, `endDate`, `timezone` của giải và `isCancelled`. Lọc danh sách theo lifecycle tính "hôm nay" theo múi giờ của từng giải (`lifecycle-filter.ts`).

### Ảnh (phase 04)

**`MediaAsset`**

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `purpose` | TEXT | Một trong `MEDIA_PURPOSES`: `tier-logo`, `tier-background`, `event-type-logo`, `event-type-background`, `event-banner` (kiểm bằng zod) |
| `incomingKey` | TEXT, unique | `incoming/<purpose>/<uuid>`. Không bao giờ được phục vụ |
| `publicKey` | TEXT, unique, nullable | Khóa của biến lớn nhất khi `READY` |
| `declaredMime`, `declaredSize` | TEXT, INT | Khai báo lúc tạo intent |
| `mime`, `size`, `width`, `height` | | Thông số của file WebP đã xử lý |
| `status` | enum `MediaStatus`: `AWAITING_UPLOAD`, `PROCESSING`, `READY`, `FAILED` | Index `(status, expiresAt)` |
| `failureReason` | TEXT, nullable | Xem [bảng lý do lỗi](#lỗi-và-mã-trả-về) |
| `variants` | JSONB, nullable | `[{ width, height, key }]`, các file WebP đã xử lý |
| `altText`, `altTextEn` | TEXT, nullable | |
| `createdById` | TEXT | Người tạo intent |
| `expiresAt` | TIMESTAMP | Hạn tải lên, lấy từ `media.intentTtlMinutes` |

Các cột `*MediaId` trên `Tier`, `EventType`, `Event` là FK tới `MediaAsset` với `onDelete: SetNull`. API kiểm trước khi ghi rằng ảnh đã `READY` (`assertReadyMedia`).

## Upload ảnh (phase 04)

Thiết kế đã chọn: **(b) ảnh đi qua API**. Trình duyệt không nhận URL ký và không ghi thẳng vào bucket. Chốt 2026-11-12 (xem [quyết định 18](#quyết-định-kiến-trúc)).

### Luồng

Chỉ vai trò có `media.create` (ADMIN) được tải lên. `RESULTS_OPERATOR` không có quyền `media`.

| Bước | Gọi | Việc làm | Trạng thái sau bước |
|---|---|---|---|
| 1 | `POST /api/v1/admin/media/intents` với `{ purpose, contentType, size }` | Kiểm `contentType` thuộc `UPLOAD_ALLOWED_IMAGE_TYPES` (422 `UNSUPPORTED_IMAGE_TYPE`), `size` ≤ trần hiệu lực (422 `IMAGE_TOO_LARGE`). Tạo bản ghi, ghi audit `media.create`. Trả `mediaId`, `uploadUrl`, `maxBytes`, `expiresAt` | `AWAITING_UPLOAD` |
| 2 | `PUT /api/v1/admin/media/:id/content` (body là byte ảnh) | `Content-Type` phải khớp `contentType` đã khai (415). Stream vào storage, đếm byte, dừng khi vượt trần (413). Hết hạn → 409 `INTENT_EXPIRED` | vẫn `AWAITING_UPLOAD` |
| 3 | `POST /api/v1/admin/media/:id/complete` | Kiểm file đã có trong storage (409 `UPLOAD_MISSING`). Chuyển `AWAITING_UPLOAD` → `PROCESSING` (chỉ một lần, lần hai 409). Đưa job `process-image` vào queue `media`. Ghi audit `media.complete`. Queue lỗi → trả về `AWAITING_UPLOAD`, 503 `QUEUE_UNAVAILABLE` | `PROCESSING` |
| 4 | Worker, job `process-image` | Đọc file gốc. Kiểm định dạng bằng sharp: phải thuộc allowlist và không quá 40 triệu điểm ảnh. Xoay theo EXIF, encode WebP (chất lượng 82, bỏ metadata). Ghi `public/<purpose>/<năm>/<uuid>-<width>.webp` cho mỗi bề rộng trong `MEDIA_IMAGE_VARIANT_WIDTHS`, không phóng to. Xóa file gốc | `READY` (kèm `variants`, `publicKey`) hoặc `FAILED` (`failureReason`) |
| 5 | `GET /api/v1/admin/media/:id` | Admin UI hỏi lại tới khi `READY` hoặc `FAILED`. Không có push | — |

Response của `GET` và `complete` có `status`, `failureReason`, `url` (biến lớn nhất), `variants[]` (mỗi phần tử có `url`).

### Retry và dọn dẹp

- Job `process-image`: tối đa 3 lần, backoff exponential bắt đầu 5 giây. Lỗi tạm thời (storage, DB) giữ file gốc để lần sau thử lại.
- Hết lượt thử → `failProcessing`: `FAILED` (`PROCESSING_ERROR`), xóa file gốc.
- Job lặp `cleanup-expired-intents` (scheduler `media-intent-cleanup`, chu kỳ `MEDIA_CLEANUP_INTERVAL_MINUTES`, mặc định 15 phút), mỗi lần quét tối đa 200 dòng:
  - `AWAITING_UPLOAD` đã quá `expiresAt` → `FAILED` (`INTENT_EXPIRED`), xóa file gốc.
  - `PROCESSING` quá `media.processingTimeoutMinutes` (mặc định 10 phút) → `FAILED` (`PROCESSING_TIMEOUT`), xóa file gốc. Bắt trường hợp job bị mất (worker crash, Redis bị xóa key).

### Storage và phục vụ ảnh

| `STORAGE_DRIVER` | Nơi lưu | Dùng cho | Ghi chú |
|---|---|---|---|
| `s3` (mặc định) | `public/` ở `S3_BUCKET`. `incoming/` ở `S3_INCOMING_BUCKET` nếu khai, nếu không thì chung `S3_BUCKET` | staging, production | Bắt buộc đủ `S3_*`. Xem [bucket công khai](./deployment-guide.md#bucket-công-khai) |
| `local` | Thư mục `UPLOAD_LOCAL_DIR` (mặc định `apps/api/uploads`, tính từ thư mục chứa `pnpm-workspace.yaml`) | dev | Không có trong compose. `apps/api/uploads/` đã nằm trong `.gitignore` |

Phục vụ ảnh công khai:
- `MEDIA_PUBLIC_BASE_URL` có giá trị: URL trỏ tới prefix `public/` (ví dụ `https://<host-bucket>/<bucket>/public`). API ghép khóa sau `public/` vào base này.
- `MEDIA_PUBLIC_BASE_URL` trống (dev): API phục vụ `GET /api/v1/media/public/*` không cần đăng nhập. Chỉ nhận đúng mẫu `<purpose>/<năm>/<uuid>-<width>.webp`, trả `Cache-Control: public, max-age=31536000, immutable`. Không bao giờ đọc `incoming/`.

Trần upload, ba lớp (hiệu lực = giá trị nhỏ hơn):

| Lớp | Nguồn | Mặc định | Vai trò |
|---|---|---|---|
| Trần cứng | env `UPLOAD_MAX_IMAGE_BYTES` | — (bắt buộc) | Dùng cho api, worker và `client_max_body_size` của nginx admin |
| Tham số vận hành | setting `media.maxImageMegabytes` | 5 MB (1–50) | Admin đổi trên `/settings`, không vượt trần |
| Kiểm khi nhận | `Content-Length` và đếm byte khi stream | — | Vượt → 413 `PAYLOAD_TOO_LARGE` |

### Lỗi và mã trả về

| Mã | HTTP | Ở bước |
|---|---|---|
| `UNSUPPORTED_IMAGE_TYPE`, `IMAGE_TOO_LARGE` | 422 | 1 (intent) |
| `CONTENT_TYPE_MISMATCH` | 415 | 2 (nội dung) |
| `PAYLOAD_TOO_LARGE` | 413 | 2 |
| `EMPTY_UPLOAD` | 422 | 2 (body rỗng) |
| `NOT_AWAITING_UPLOAD`, `INTENT_EXPIRED`, `UPLOAD_MISSING` | 409 | 2, 3 |
| `QUEUE_UNAVAILABLE` | 503 | 3 |

Lý do `failureReason` (`MEDIA_FAILURE` trong `packages/shared/src/media/media-contract.ts`):

| Giá trị | Nguyên nhân |
|---|---|
| `NOT_AN_IMAGE` | Không đọc được hoặc không thuộc allowlist |
| `TOO_LARGE` | Vượt trần lúc xử lý, hoặc quá 40 triệu điểm ảnh |
| `MISSING_UPLOAD` | Không còn file gốc khi worker chạy |
| `INTENT_EXPIRED` | Hết hạn trước khi hoàn tất tải lên |
| `PROCESSING_ERROR` | Hết lượt thử |
| `PROCESSING_TIMEOUT` | Quá `media.processingTimeoutMinutes` |

## Vận động viên và đăng ký (phase 05)

Phạm vi: hồ sơ VĐV, cặp đôi, đăng ký vào nội dung thi đấu (`Entry`), import và export Excel, gộp hồ sơ trùng. Bốc thăm đã có ở phase 06 (xem [mục riêng](#bốc-thăm-và-vòng-bảng-phase-06)). Chưa có bảng điểm (phase 09) và trang công khai VĐV (phase 10).

### Mô hình dữ liệu

Nguồn: `packages/db/prisma/schema/players-and-entries.prisma`, `imports.prisma`.

| Model | Vai trò | Ràng buộc chính |
|---|---|---|
| `Player` | Hồ sơ VĐV. `code` = tiền tố + số từ sequence Postgres `player_code_seq`; `slug`; `normalizedName` (chữ thường, bỏ dấu, dùng để khớp và tìm) | `code`, `slug` unique. `mergedIntoId` trỏ tới hồ sơ giữ lại khi gộp. `phone`, `email`, `birthDate` là dữ liệu riêng tư |
| `Pair` | Cặp đôi gồm hai VĐV khác nhau | CHECK `playerAId < playerBId`; unique `(playerAId, playerBId)` |
| `Competitor` | Đơn vị được đăng ký, `PLAYER` hoặc `PAIR`. Entry và sau này là trận đấu trỏ vào đây, không trỏ thẳng vào Player/Pair | CHECK: đúng cột khớp `type` được điền. `displayName` làm mới trong cùng transaction khi đổi tên hoặc gộp |
| `Entry` | Đăng ký của một competitor vào một nội dung | unique `(subEventId, competitorId)`; unique `(subEventId, stage, seed)` (nhiều NULL không xung đột). `status` CONFIRMED/WITHDRAWN; `stage` MAIN/QUALIFYING; `quotaType` DIRECT/WILDCARD/QUALIFIER; `eligibilityOverrideReason` |
| `ImportJob` | Một lượt import file Excel của một giải | `fileSha256`, `status`, bộ đếm dòng, `attemptNo`, `overrideReason`, `fileDeletedAt` |
| `ImportRow` | Một dòng của lượt import | khóa `(importJobId, rowNo)`; `status` VALID/ERROR/NEEDS_CONFIRM/COMMITTED; `decisions` (JSON, chọn VĐV cho từng slot: `{"1": "<playerId>" \| "NEW"}`) |

### Module API

Tất cả route nằm dưới `/api/v1`. Quyền lấy từ ma trận `PERMISSION_MATRIX` (xem [auth-and-rbac.md](./auth-and-rbac.md#ma-trận-quyền)).

| Module (`apps/api/src/modules/`) | Route | Quyền |
|---|---|---|
| `players` | `GET /admin/players`, `GET /admin/players/lookup`, `GET /admin/players/:id`, `POST /admin/players`, `PATCH /admin/players/:id` | `players.list`, `read`, `create`, `update` |
| `players` (gộp) | `GET /admin/players/merge/preview`, `POST /admin/players/merge` | `players.manage`. POST thêm `@RequireStepUp()` |
| `pairs` | `GET /admin/pairs` (chỉ đọc; cặp được tạo khi đăng ký đôi) | `players.list` |
| `entries` | `GET /admin/events/:eventId/entry-counts`, `GET` và `POST /admin/sub-events/:id/entries`, `PATCH /admin/entries/:id`, `POST /admin/entries/bulk` | `tournaments.list`, `create`, `update` |
| `imports` | `GET /admin/imports/template`, `GET` và `POST /admin/imports`, `GET /admin/imports/:id`, `PUT /admin/imports/:id/file`, `POST /admin/imports/:id/uploaded`, `POST /admin/imports/:id/validate`, `POST /admin/imports/:id/commit`, `GET /admin/imports/:id/rows`, `PATCH /admin/imports/:id/rows/:rowNo` | `tournaments.*` |
| `exports` | `GET /admin/exports/entries?eventId&subEventId` (stream xlsx, đồng bộ) | `tournaments.list` |

Nghiệp vụ không có module riêng: `competitors.ts` và `player-identity.ts` nằm ở `@kamito/db` (`src/domain/`), `eligibility` nằm ở `packages/shared/src/entry-eligibility.ts` và `apps/api/src/modules/entries/entry-eligibility.service.ts`. Dịch vụ trong module: `EntriesService`, `EntryEligibilityService`, `EntryBulkActionsService`, `PlayerMergeService`, `ImportsService`, `ImportRowsService`, `ImportTemplateService`, `ImportQueue`.

### Kiểm tra đăng ký (eligibility)

Nguồn: `packages/shared/src/entry-eligibility.ts` (hàm `checkEntryEligibility`), `apps/api/src/modules/entries/entry-eligibility.service.ts`.

| Mã issue | Ý nghĩa | Ghi đè được |
|---|---|---|
| `PLAYER_COUNT`, `SAME_PLAYER` | Cặp sai số người, hoặc hai VĐV trùng nhau | Không |
| `MIXED_PAIR` | Nội dung đôi nam nữ nhưng cặp không đủ một nam và một nữ | Có |
| `GENDER` | Giới tính VĐV không khớp nội dung | Có |
| `AGE_UNKNOWN` | Thiếu dữ liệu để tính tuổi theo nhóm | Có |
| `AGE_ABOVE`, `AGE_BELOW` | Vượt hoặc chưa đủ tuổi của nhóm | Có |
| `CAPACITY` | Nội dung đã đủ `maxEntries` | Có |

- Tuổi tính theo setting `category.ageCalculation`: `BIRTH_YEAR` là năm giải − năm sinh; `EVENT_START_DATE` là tuổi tròn tại ngày khai mạc, thiếu ngày sinh đầy đủ thì quay về cách năm sinh (`packages/shared/src/age-on-event.ts`).
- Lỗi hợp lệ trả **422 `ENTRY_INELIGIBLE`** với `issues` (xem [envelope lỗi](./code-standards.md#quy-ước-api)). Người có `ADMIN` gửi `overrideReason` thì bỏ qua các issue `overridable`. Người khác gửi lý do ghi đè trả 403 `OVERRIDE_FORBIDDEN`.
- Đã đăng ký rồi (VĐV hoặc cặp đã có entry CONFIRMED trong nội dung) trả 409 `ALREADY_ENTERED`. Hạt giống trùng trả 409 `SEED_TAKEN`, kèm `fields.seed`.

### Import Excel

Trạng thái (`ImportStatus`):

```
AWAITING_UPLOAD --PUT file, POST uploaded--> VALIDATING --worker--> VALIDATED | FAILED
VALIDATED | FAILED --POST validate--> VALIDATING          (kiểm lại; xóa fileSha256 và totalRows)
VALIDATED | FAILED --POST commit--> COMMITTING --worker--> DONE | FAILED
AWAITING_UPLOAD quá import.uploadTtlHours --worker dọn--> FAILED ("Hết hạn tải file")
```

Enum còn `UPLOADED`. API không đặt trạng thái này, nhưng worker vẫn xử lý nếu gặp.

1. **Tạo lượt.** `POST /admin/imports` nhận `eventId`, `fileName`, `fileSize`. Từ chối nếu vượt `import.maxFileMegabytes` (đã kẹp theo `IMPORT_MAX_FILE_BYTES`). Trả thêm `maxBytes`.
2. **Tải file.** `PUT /admin/imports/:id/file` nhận body nhị phân. `Content-Type` phải là MIME xlsx, nếu không trả 415. Body được stream vào storage khóa `private/imports/<id>.xlsx`, dừng khi vượt trần (413 `PAYLOAD_TOO_LARGE`). Rỗng trả 422 `EMPTY_UPLOAD`.
3. **Xác nhận và xếp hàng.** `POST .../uploaded` kiểm file đã có trong storage, chuyển sang `VALIDATING` và đưa job `validate-import` vào queue.
4. **Kiểm tra (worker).** `validate-import`:
   - Kiểm kích thước, kiểm chữ ký zip và giải nén thử (xem [Giới hạn và bảo vệ file](#giới-hạn-và-bảo-vệ-file-import)).
   - Tính SHA-256 lưu vào `fileSha256`.
   - Đọc sheet đầu tiên (theo tên `xl/worksheets/sheetN.xml`; file mẫu đặt sheet đăng ký ở vị trí này). Header phải khớp `ENTRY_IMPORT_COLUMNS`. Dòng trống bị bỏ qua. Vượt `import.maxRows` thì lượt lỗi cả file.
   - Với mỗi dòng: tra VĐV và nội dung, kiểm eligibility, gán `status` và `plannedAction`. Ghi theo lô 500 dòng trong transaction, cập nhật bộ đếm.
   - Lỗi cấp file (sai header, sai định dạng, quá giới hạn) đặt `FAILED` kèm `failureReason`.
5. **Xử lý dòng cần xác nhận.** Dòng `NEEDS_CONFIRM` được chọn tại chỗ: `PATCH .../rows/:rowNo` nhận `decisions` (`playerId` hoặc `NEW`). Dòng được kiểm lại ngay, không chờ validate mới.
6. **Nhập.** `POST .../commit` kiểm `fileSha256` vẫn khớp, chuyển `COMMITTING`, đưa job `commit-import` vào queue với `attemptNo`. `overrideReason` chỉ ADMIN được gửi; cho phép nhập dòng `ERROR` có `overridable` và cho phép vào nội dung đã có draw không ở DRAFT (hook phase 06, hiện chưa chặn gì).
7. **Ghi (worker).** `commit-import` đọc lại file và kiểm hash. Mỗi lô (200 dòng) là một transaction: khóa theo [thứ tự khóa](#thứ-tự-khóa), đọc lại dòng (dòng `COMMITTED` không xử lý lại), kiểm lại trùng và sức chứa, tạo hoặc liên kết VĐV, tạo entry, ghi audit. Kết thúc `DONE`. Job có `attemptNo` cũ hơn lượt hiện tại bị bỏ qua.
8. **Thử lại.** Lượt `FAILED` đã có dòng và `fileSha256` thì "Thử lại" được. Dòng đã `COMMITTED` không bị nhập lại. Revalidate không chạy được khi đã có dòng `COMMITTED`.

Khớp VĐV (`apps/worker/src/import/player-matcher.ts`):

| Điều kiện dòng | Kết quả |
|---|---|
| Có mã VĐV, không có hồ sơ | `ERROR`. Nếu mã thuộc hồ sơ đã gộp, thông báo nêu mã đích |
| Có mã, khác họ tên, giới tính hoặc năm sinh | `ERROR` ("Khác dữ liệu VĐV mã …") |
| Có mã, khớp | Liên kết VĐV đó |
| Không mã, tên chuẩn hóa chưa có ai trùng | Tạo VĐV mới (cần giới tính) |
| Trùng tên, đúng giới và năm sinh, chỉ một người | Liên kết VĐV đó |
| Trùng tên nhưng không xác định được | `NEEDS_CONFIRM` với danh sách ứng viên |

Ghi chú: dòng đôi có hai VĐV, nên `decisions` có hai slot.

### Giới hạn và bảo vệ file import

| Lớp | Cơ chế | Nơi thực hiện |
|---|---|---|
| Dung lượng | `import.maxFileMegabytes` (kẹp theo `IMPORT_MAX_FILE_BYTES`), kiểm ở lúc tạo lượt, lúc nhận body, và lúc validate | `imports.service.ts`, `import-upload-stream.ts`, `import-validate-processor.ts` |
| Định dạng | API so khớp `Content-Type`. Worker kiểm chữ ký zip (`PK\x03\x04`) trước khi đọc | `import-upload-stream.ts`, `xlsx-zip-guard.ts` |
| Zip bomb | `assertSafeXlsx` giải nén thử theo từng khối và đếm byte thật. Số entry phải khớp central directory. `worksheetsLast` cộng dồn kích thước khai báo của mọi entry trong central directory, nên entry chồng lấn không lọt qua. Trần chung: `IMPORT_MAX_UNZIPPED_BYTES` (chỉ env, không có trên `/settings`) | `xlsx-zip-guard.ts`, `xlsx-row-reader.ts` |
| Số dòng | `import.maxRows` (kẹp theo `IMPORT_MAX_ROWS`) | `xlsx-row-reader.ts` |
| Bộ nhớ | Sheet được đọc theo stream của exceljs từ file tạm trong thư mục tạm của hệ điều hành (`node:os` `tmpdir`, thư mục `kamito-import-*`), xóa trong `finally`. Các bước giải nén vẫn giữ dữ liệu trong bộ nhớ, nên RAM của worker được chặn bằng `WORKER_MAX_OLD_SPACE_MB` và `WORKER_MEM_LIMIT` | `xlsx-row-reader.ts`, [deployment-guide](./deployment-guide.md#giới-hạn-import-excel) |
| Lưu giữ | File bị xóa sau `import.retentionDays`. Lượt chưa tải file hết hạn sau `import.uploadTtlHours`. Lịch sử và kết quả import vẫn giữ | `import-file-cleanup-processor.ts` |

Thư viện: `exceljs` 4.4.0 (đọc và ghi xlsx, cả api lẫn worker), `fflate` 0.8.3 (giải nén thử và dựng lại zip tạm).

### Queue `import`

Tên queue khai trong `packages/shared/src/queue-names.ts` (`QueueName.Import = 'import'`). Đăng ký processor ở `apps/worker/src/import-worker.ts`.

| Job | Payload | `jobId` | Thử lại |
|---|---|---|---|
| `validate-import` | `{ importJobId }` | `imp-<id>-validate-<attemptNo>` | 2 lần, cách 10 giây |
| `commit-import` | `{ importJobId, attemptNo }` | `imp-<id>-commit-<attemptNo>` | 1 lần |
| `cleanup-import-files` | — (scheduler `import-file-cleanup`) | — | theo lịch |

- Số job song song: `IMPORT_WORKER_CONCURRENCY` (mặc định 1). Chu kỳ dọn: `IMPORT_CLEANUP_INTERVAL_MINUTES` (mặc định 60).
- Nếu `queue.add` lỗi, API trả status về trạng thái cũ (chỉ khi lượt còn đúng trạng thái và `attemptNo` của request đó) và trả 503 `QUEUE_UNAVAILABLE`.

### Thứ tự khóa

Mọi nơi ghi entry và gộp VĐV lấy khóa theo cùng thứ tự, nên không có vòng chờ:

| Thứ tự | Khóa | Ai lấy |
|---|---|---|
| 1 | Advisory transaction lock `import-event-<eventId>` | Commit import, mỗi lô |
| 2 | Dòng `SubEvent` theo id tăng dần, `FOR UPDATE` | Commit import; ghi entry (`lockSubEvent`); gộp VĐV (tập nội dung đã dự kiến) |
| 3 | Dòng `Player` theo id tăng dần: `FOR SHARE` khi ghi entry và commit import; `FOR UPDATE` khi gộp | Mọi nơi ghi entry, commit import, gộp VĐV |

Gộp VĐV sau khi khóa đọc lại tập nội dung bị ảnh hưởng. Nếu tập đã đổi, trả 409 `MERGE_RETRY`.

Phase 06 chèn `Draw` và `Group` sau `SubEvent`, trước `Player`. Xem [Bốc thăm và vòng bảng](#bốc-thăm-và-vòng-bảng-phase-06). Phase 07 thêm `EventSession` và `Match` sau `Group`, xem [Nhập tỷ số, lịch và revalidate](#nhập-lịch-và-revalidate-phase-07).

### Gộp VĐV

1. **Xem trước.** `GET /admin/players/merge/preview?targetId&sourceId` (`players.manage`). Trả phân tích xung đột.
2. **Xác nhận.** `POST /admin/players/merge` nhận `{ targetId, sourceId, reason }`, `reason` từ 5 đến 500 ký tự. Route yêu cầu step-up (nhập lại mật khẩu, xem [auth-and-rbac.md](./auth-and-rbac.md#mật-khẩu-tạm-đổi-mật-khẩu-step-up)).
3. **Thực hiện** trong một transaction (có thứ tự khóa ở trên):
   - Hai hồ sơ cùng một nội dung (đăng ký đơn hoặc cặp) gây `MERGE_CONFLICT` 409 kèm `issues`.
   - Entry đơn và cặp của hồ sơ nguồn chuyển sang đích. Cặp được tạo lại với đích nếu cần.
   - Làm mới `displayName` của Competitor đích.
   - Hồ sơ nguồn: `mergedIntoId`, `mergedAt`, `isActive = false`.
   - Ghi audit `player.merge` kèm lý do.
4. **Sau gộp.** Sửa hồ sơ đã gộp trả 409 `PLAYER_MERGED`. Đăng ký bằng mã đã gộp cũng trả `PLAYER_MERGED`. Chuyển hướng 301 từ slug cũ sang đích **chưa làm** (phase 10).

### Export

`GET /admin/exports/entries` stream file xlsx trực tiếp trong request (không qua queue). Cột giống file mẫu import, cộng cột "Trạng thái" (Đã xác nhận / Đã rút). Có thể sửa rồi import lại. Phân trang theo cursor, 1.000 dòng mỗi trang. Nguồn: `apps/api/src/modules/exports/entries-export.service.ts`.

### Quyền xem dữ liệu cá nhân

- SĐT, email và ngày sinh chỉ trả khi người xem có `players.update` (`canSeePlayerPii` trong `player-views.ts`). `RESULTS_OPERATOR` chỉ có `players.list` và `read`, nên không thấy các trường này.
- Năm sinh, CLB và mã VĐV vẫn hiện cho cả hai vai trò.
- Dữ liệu dòng import và file export không chứa ngày sinh, SĐT hay email.
- `GET /public/*` có từ phase 08 (đợt 1 đến 3), xem [Site công khai](#site-công-khai-phase-08). `player.showAge` vẫn chưa có nơi đọc (phase 08 đợt 2, 10).

## Bốc thăm và vòng bảng (phase 06)

Phạm vi: sinh nhánh `MAIN`, `QUALIFYING`, `GROUP` cho một nội dung, hạt giống, BYE, công bố, thao tác sau công bố có xem trước (`dryRun`). Chi tiết API, engine, walkover treo và mã lỗi: [draws-and-groups.md](./draws-and-groups.md).

### Mô hình dữ liệu

Nguồn: `draws-and-matches.prisma`, `groups-and-standings.prisma`.

| Model | Vai trò | Ràng buộc chính |
|---|---|---|
| `Draw` | Nhánh của một nội dung | unique `(subEventId, kind)`; `status` DRAFT/PUBLISHED; `version` cho khóa lạc quan; `randomSeed` để tái lập |
| `BracketPosition` | Ô trong nhánh | unique `(drawId, section, position)`; `source` ENTRY/BYE/QUALIFIER/GROUP_PLACE |
| `Round` | Vòng | unique `(drawId, scopeKey, number)`; `scopeKey` là `S1..Sk` hoặc `G-<mã bảng>` |
| `Match` | Trận | unique `(eventId, matchNo)`; nguồn hai phía lưu JSON; cột lịch để trống tới phase 07 |
| `Game` | Ván | Có trong schema, phase 06 chưa ghi |
| `EventMatchCounter` | Cấp `matchNo` theo giải | Upsert dưới khóa dòng; không lùi khi sinh lại nháp (số có thể hở) |
| `Group`, `GroupMember`, `GroupStanding` | Bảng vòng tròn | BXH tính lại toàn bộ, không sửa tăng dần |

Trạng thái khóa cấu trúc không lưu cột. `isStructureLocked` trả true khi có trận LIVE hoặc OFFICIAL không phải BYE (`packages/db/src/domain/draw-locks.ts`).

### Module API

| Module (`apps/api/src/modules/`) | Việc làm | Quyền |
|---|---|---|
| `draws` | Preview, sinh nháp, swap, publish, xóa nháp, xếp vòng loại và bảng vào MAIN, unpublish, thay và rút VĐV, sửa thể thức vòng | `tournaments.*` |
| `groups` | Nhập hạng tay, tính lại BXH | `tournaments.update` |
| `matches` | Đọc trận: danh sách của giải (`GET /events/:eventId/matches`, lọc session và bàn) và chi tiết (`GET /matches/:id`). `MatchQueryService`, `match-view.ts` | `matches.list`, `matches.read` |
| `match-results` | Bắt đầu, hủy bắt đầu, lưu tạm, chốt, sửa tỷ số, xem trước và mở lại (phase 07). `match-result.service.ts`, `match-progress.service.ts`, `match-amend.service.ts`, `match-reopen.service.ts`; khóa trong `match-lock.ts`; đẩy nhánh trong `bracket-advance.ts`. Chi tiết: [match-results](./match-results.md) | `matches.update`, `confirm`, `amend`, `reopen` (kèm step-up) |
| `scheduling`, `sessions` | Session, xếp lịch (`PATCH /admin/matches/:id/schedule`), xung đột, phiếu trận, giải phóng ô (phase 07). Chi tiết: [scheduling](./scheduling.md) | `tournaments.*`; phiếu trận dùng `matches.list` |
| `exports` | Xuất xlsx: đăng ký (phase 05), lịch và kết quả (phase 07) | `tournaments.list` |
| `revalidation` | Enqueue tag sau commit (`RevalidationEnqueueService`, global), tag theo mutation (`cache-tags.ts`), phủ route (`route-tag-coverage.ts`), nút làm mới trang công khai | `tournaments.update` (làm mới) |

Dịch vụ chính: `draws` có `DrawParamsService`, `DrawGenerationService`, `DrawEditService`, `DrawPublishService`, `DrawPostPublishService`, `GroupWithdrawalService`, `GroupQualifierService`, `RoundFormatService`. `groups` có `GroupStandingsService`, `GroupAdminService`, `GroupViewService`.

### Khóa và thao tác ghi

- Mọi thao tác ghi nhánh mở bằng `loadDrawLocked` (`apps/api/src/modules/draws/draw-lock.ts`): khóa `SubEvent`, khóa `Draw`, rồi mới kiểm `expectedVersion` trên dòng vừa khóa.
- Thứ tự: `SubEvent` → `Draw` → `Group` (theo `id`) → `Player` → `EventMatchCounter`. Draw không lấy khóa Player. Phase 06 không khóa dòng `Match`; phase 07 khóa `Match` sau `Group`, xem [Nhập, lịch và revalidate](#nhập-lịch-và-revalidate-phase-07).
- `dryRun` chạy đúng code thật trong transaction rồi rollback. Chi tiết: [draws-and-groups.md](./draws-and-groups.md#xem-trước-và-thao-tác-sau-công-bố-dryrun).
- Quy ước `expectedVersion` và mã 409 `DRAW_VERSION_CONFLICT`: [code-standards.md](./code-standards.md#bốc-thăm-và-vòng-bảng-phase-06).

## Nhập, lịch và revalidate (phase 07)

Chi tiết theo nhóm chức năng: [match-results](./match-results.md) (nhập, chốt, sửa, mở lại tỷ số), [scheduling](./scheduling.md) (session, xếp lịch, phiếu trận, xuất file), [cache-revalidation](./cache-revalidation.md) (tag và phủ route).

### Luồng ghi nhập tỷ số

```
admin ──POST /admin/matches/:id/confirm──> api
  transaction:
    khóa SubEvent → Draw → Group (trận bảng) → Match
    kiểm expectedVersion, trạng thái, validateMatchScore
    ghi Game, cập nhật Match thành OFFICIAL
    đẩy người thắng vào trận kế (nhánh loại trực tiếp) hoặc tính lại BXH (bảng)
    ghi audit match.confirm
  commit
  đọc lại chi tiết trận, gửi tag cache (ngoài transaction)
```

### Thứ tự khóa (phase 07)

| Thứ tự | Khóa | Dùng bởi |
|---|---|---|
| 1 | `SubEvent` (`FOR UPDATE`, theo `id` tăng dần khi có nhiều nội dung) | Trận, lịch, mở lại |
| 2 | `Draw` (`FOR UPDATE`), kiểm `PUBLISHED` | Trận, lịch. Mở lại khóa mọi nhánh của nội dung: QUALIFYING, GROUP, MAIN |
| 3 | `Group` theo `id` tăng dần | Trận bảng, mở lại khi có bảng |
| 4 | `EventSession` theo `id` tăng dần (`FOR UPDATE`) | Xếp lịch, sửa session, đổi múi giờ, giải phóng ô |
| 5 | `Match` (`FOR UPDATE`), rồi kiểm phiên bản | Mọi thao tác trên trận |

Luồng nhập tỷ số không khóa `Player`. Thứ tự khóa của đăng ký và nhánh ở phase 05 và 06 nằm ở [Thứ tự khóa](#thứ-tự-khóa). Phase 07 chèn `EventSession` trước `Match`.

### Revalidate

Tag gửi sau commit qua queue `revalidate` (job `revalidate-tags`, tối đa 200 tag mỗi job). Worker gọi `client` `/api/revalidate`. Lỗi enqueue không hoàn tác thao tác đã commit: API trả `warnings: ["PUBLIC_REFRESH_DELAYED"]`. Mọi route ghi `/admin` phải có dòng trong `ROUTE_TAG_RULES`; test `apps/api/test/cache-tags-coverage.e2e-spec.ts` kiểm việc này. Bảng mutation, hằng số và khe hở: [cache-revalidation](./cache-revalidation.md).

### Route `/api/revalidate` ở client (phase 08)

| Bước | Kiểm | Khi sai |
|---|---|---|
| 1. Host | Khớp `REVALIDATE_ALLOWED_HOSTS` (host:port, không đọc `X-Forwarded-Host`). `proxy.ts` kiểm trước route | 404 |
| 2. Method | Chỉ `POST`. `GET` trả 404 | 404 |
| 3. Secret | Header `x-revalidate-secret` so với `REVALIDATE_SECRET` (SHA-256, `timingSafeEqual`) | 403 |
| 4. Body | `{tags}`: 1 đến `REVALIDATE_MAX_TAGS` (200) tag, mỗi tag qua `isValidCacheTag` | 400 `invalid tags` |

Thành công: vô hiệu phiên bản tag trong Redis response cache dùng chung, trả `{revalidated}`. Redis lỗi trả 503 để worker retry. Lớp Host là phòng thủ nhiều lớp. Quy tắc chặn ở Traefik cần kiểm trên hạ tầng thật; secret vẫn được kiểm trước invalidation.

## Site công khai (phase 08)

Chi tiết route, API, cache, proxy, SEO, in ấn, CSP và việc còn mở: [public-site.md](./public-site.md).

Tóm tắt:
- Trang Server Component trong `apps/client/src/app/[locale]/` (vi, en). Mọi dữ liệu đọc qua `publicGet()` (`lib/public-data.ts`, `lib/api-client.ts`, chỉ server).
- Request từ client đến `api` mang header `x-internal-secret` (`SSR_INTERNAL_SECRET`). API không có domain công khai, nên secret là ranh giới thật.
- API `GET /api/v1/public/*`: `@Public()` + `SsrInternalGuard`, một predicate phạm vi `publicScope`, serializer whitelist. Không công khai thì 200 `{data: null}`, không 404.

```
Browser ──> client (Next SSR, proxy.ts: locale, rate limit, chặn /api/revalidate)
              publicGet(): header x-internal-secret, Redis response/tag cache (TTL theo policy), upstream no-store + timeout
client ──> api: GET /api/v1/public/*  (API_INTERNAL_URL, không qua Traefik)
api:   @Public + SsrInternalGuard ──> publicScope ──> serializer whitelist
```

Cache: tag chính xác theo mutation (`packages/shared/src/public-cache-tags.ts`), TTL dự phòng (`PUBLIC_REVALIDATE_SECONDS`, `MATCHDAY_REVALIDATE_SECONDS`), trang có `q` không cache. Bảng tag và mutation: [public-site.md](./public-site.md#dữ-liệu-và-cache).

Lịch công khai: `PublicScheduleQuery` trong `public-competition` đọc lịch phase 07, áp phạm vi công khai, gom session → bàn → trận và lọc bằng mã `session`/`table`. Hợp đồng `packages/shared/src/public-schedule-contract.ts`; client render ở tab Thông tin, gắn tag lịch và giải, in từng session/bàn trên trang riêng. Không thay đổi schema. Kiểm local đạt: API tích hợp, Playwright lịch (5 đạt/1 bỏ qua PDF mobile), client build/typecheck/lint (2026-11-15).

Rate limit công khai ở `proxy.ts` của client, Lua atomic trong Redis dùng chung giữa replica; Redis lỗi chuyển bộ đếm RAM cục bộ có trần. Thông số ở `/settings`, nhóm "Truy cập site công khai". Cache JSON công khai cũng dùng Redis chung với generation fence; hai Next production local đã kiểm cache/invalidation/hạn mức chung, chưa thay thế staging.

## Xác thực và phân quyền (phase 03)

Tóm tắt. Chi tiết, bảng mã lỗi, và API xem [auth-and-rbac.md](./auth-and-rbac.md).

```
Trình duyệt (admin SPA)
  │  POST /api/v1/auth/sign-in/email   ──> Better Auth raw handler (Express, trước Nest)
  │                                         ├─ IP rate limit (Redis)
  │                                         └─ khóa theo tài khoản (Redis, Lua)
  │  Cookie phiên
  ▼
Nest guard toàn cục (theo thứ tự)
  1. SessionGuard              phiên trong bảng Session; hết hạn tuyệt đối / idle
  2. MustChangePasswordGuard   mật khẩu tạm → chỉ /auth/me, /auth/change-password
  3. PermissionGuard           deny-by-default; @RequirePermission ↔ PERMISSION_MATRIX
  4. StepUpGuard               @RequireStepUp (mở lại tỷ số, gộp VĐV, điểm và chụp xếp hạng)
  ▼
Controller: /auth/*, /admin/users, /admin/audit-logs, /admin/settings,
            /admin/tiers, /admin/event-types, /admin/categories, /admin/disciplines,
            /admin/match-formats, /admin/group-scoring-rules, /admin/venues,
            /admin/events, /admin/media
            (@Public: /media/public/*; /public/* chỉ với SsrInternalGuard, xem Site công khai)
Express (ngoài guard Nest): /api/v1/admin/queues (bull-board, kiểm lại các bước trên)
```

Quy tắc chung:
- Ma trận quyền ở `@kamito/shared` dùng chung cho api và admin UI. Admin UI chỉ ẩn, api là nơi chặn.
- Resource phase 04: `tournaments` (danh mục, địa điểm, giải, nội dung thi đấu) và `media`. `RESULTS_OPERATOR` chỉ có `tournaments` ở mức `list`, `read`. `media` chỉ ADMIN.
- Vai trò, `isActive`, `mustChangePassword` đọc từ DB mỗi request. Đổi quyền có hiệu lực ngay, và thu hồi phiên khi đổi vai trò hoặc khóa.
- Ngưỡng đăng nhập, khóa, phiên, mật khẩu, và các setting phase 04 nằm ở `/settings` (`AppSetting`). Env chỉ giữ secret (`AUTH_SECRET`), URL (`ADMIN_PUBLIC_URL` cho Origin), `TRUST_PROXY_HOPS`, và trần kỹ thuật (`UPLOAD_MAX_IMAGE_BYTES`).
- Ghi audit cho mọi thay đổi user, setting, mật khẩu, phiên, danh mục, giải, nội dung thi đấu, và ảnh.

## Dịch vụ dùng chung trong api

| Dịch vụ | File | Hành vi |
|---|---|---|
| Config | `common/config/env-schema.ts`, `app-config.module.ts` | Symbol `API_ENV`. Schema zod toàn cục, global module. Bao gồm `storageEnvShape` dùng chung với worker |
| Logger | `common/logger/logger.module.ts` | pino JSON. Request ID, redact theo danh sách trong `LOG_REDACT_PATHS`. Header SSR trong danh sách lấy từ `SSR_SECRET_HEADER` |
| Error filter | `common/filters/http-exception.filter.ts` | Mọi lỗi trả `{error:{code,message,fields?}}`. Lỗi không phải HttpException → 500 `INTERNAL_ERROR` |
| Lỗi tranh chấp | `common/filters/http-exception.filter.ts` | Prisma `P2034` và Postgres `40P01`, `40001` → 409 `CONCURRENT_UPDATE_RETRY` ("thử lại"). Không lộ chi tiết lỗi gốc |
| Pagination | `common/pagination/pagination-query.ts`, `pagination-limits.ts` | Whitelist sort/filter. `pageSize` mặc định lấy từ `list.defaultPageSize` (`/settings`), trần từ env `PAGINATION_MAX_PAGE_SIZE`. `page` tối đa 10 000. Xem [code-standards.md](./code-standards.md#quy-ước-api) |
| Danh mục CRUD | `common/crud/catalog-crud.ts`, `prisma-list-query.ts`, `delete-guard.ts`, `default-flag.ts`, `catalog-fields.ts`, `ready-media.ts` | Base class cho 7 danh mục. List một đường (`prismaListQuery`), delete có kiểm phụ thuộc (409 `IN_USE`), một mặc định duy nhất. Xem [code-standards.md](./code-standards.md#danh-mục-danh-sách-và-xóa-phase-04) |
| Sanitizer | `common/html/sanitize-rich-html.ts` | `sanitize-html` với allowlist. Dùng khi ghi `infoBody`/`infoBodyEn` của giải |
| Request context | `common/audit/request-context.ts` | Middleware trên mọi route. `AsyncLocalStorage` giữ `requestId`, `ip`, `userAgent`. `SessionGuard` điền `userId`, `sessionId` |
| AuditService | `common/audit/audit.service.ts` | `record(entry, tx?)`. Actor = `USER` nếu có userId, ngược lại `SYSTEM`. Ghi `before`/`after` sau khi mask |
| PII mask | `common/audit/mask-pii.ts` | Khớp chuỗi con trên khóa, không phân biệt hoa thường. Đệ quy, tối đa 20 cấp. Không sửa object gốc |
| Auth | `modules/auth/auth-instance.ts`, `auth-raw-handler.ts`, `session-resolver.service.ts`, `auth-guards.ts` | Better Auth 1.7.21 (không dùng plugin admin). Raw handler chỉ 2 route. Phiên đọc từ DB mỗi request |
| Login throttling | `modules/auth/login-ip-rate-limiter.service.ts`, `account-lockout.service.ts` | Redis, key có `QUEUE_PREFIX`, email băm. Fail-open khi Redis lỗi |
| Access control | `modules/access-control/` | `@Public`, `@RequireSession`, `@RequirePermission`, `PermissionGuard` |
| SSR guard | `common/guards/ssr-internal.guard.ts` | `SsrInternalGuard`: so SHA-256 của header `x-internal-secret` với `SSR_INTERNAL_SECRET` bằng `timingSafeEqual`. Thiếu hoặc sai → 403 `SSR_ONLY` |
| Public scope | `modules/public-scope/public-scope.ts` | Điều kiện công khai duy nhất: event `PUBLISHED` và không hủy, draw `PUBLISHED`. Mọi truy vấn công khai dựng `where` từ đây |
| Origin check | `common/security/trusted-origin.ts` | `TrustedOriginMiddleware` cho ghi dưới `admin/*`, `auth/*`. Dùng lại trong bull-board |
| Users | `modules/users/` | CRUD user (không xóa), reset mật khẩu, thu hồi phiên, ràng buộc ADMIN cuối |
| Settings | `modules/settings/` | `AppSettingsService`: đọc DB mỗi lần, không giữ cache RAM riêng từng replica; sửa, reset, audit |
| Xếp hạng | `modules/ranking-lists/`, `ranking-rules/`, `ranking-points/`, `ranking-snapshots/`, `ranking-jobs/` | Bảng xếp hạng, quy tắc điểm (ma trận có phiên bản), sổ điểm, kỳ chốt (nháp rồi công bố), job dựng bản nháp (`GET /admin/ranking/jobs/:id`). Điểm thủ công và công bố kỳ chốt có `@RequireStepUp()`. Ngày nghiệp vụ: `rankingToday()` (`ranking-jobs/ranking-today.ts`) theo múi giờ của giải |
| Audit log (đọc) | `modules/audit-logs/` | Chỉ GET. Lọc theo actor, entity, action (tiền tố), khoảng thời gian |
| Danh mục và địa điểm | `modules/tiers/`, `event-types/`, `categories/`, `disciplines/`, `match-formats/`, `group-scoring-rules/`, `venues/` | Mỗi module: controller + service kế thừa `CatalogCrudService`. Venue có thêm `admin/venues/:id/tables` (tạo nhanh nhiều bàn) |
| Giải và nội dung thi đấu | `modules/events/`, `modules/sub-events/` | Slug (`event-slug.ts`), publish/unpublish, cancel/uncancel, delete có chặn, lọc `lifecycle`/`year`/`eventTypeId`/`publishStatus`. Sub-event đơn và bulk (tối đa 50 mục mỗi lần) |
| Media (admin) | `modules/media/admin-media.controller.ts`, `media.service.ts`, `media-upload-stream.ts` | Intent, nhận nội dung, complete, GET, PATCH alt text, `config` (trần và loại ảnh) |
| Media (public) | `modules/media/media-public-files.controller.ts` | `GET /api/v1/media/public/*`, chỉ khi `MEDIA_PUBLIC_BASE_URL` trống (dev) |
| MediaQueue | `modules/media/media-queue.ts` | Producer cho queue `media` (BullMQ). `jobId = media-<id>`, 3 lần thử, backoff 5 giây |
| Storage | `modules/storage/object-storage.provider.ts`, `storage.module.ts`; `createObjectStorage` trong `@kamito/shared/object-storage` | Chọn driver theo `STORAGE_DRIVER`. Symbol `OBJECT_STORAGE` |
| Bull-board | `modules/queue/bull-board-mount.ts` | UI hàng đợi trên Express, guard theo phiên và quyền `queues` |
| CLI | `cli/create-admin.ts` | Tạo hoặc khôi phục ADMIN đầu tiên, xác nhận DB target trước khi ghi |
| Prisma | `modules/prisma/prisma.service.ts` | `PrismaClient` + `@prisma/adapter-pg`. Đóng kết nối khi tắt |
| Redis | `modules/queue/redis-connection.provider.ts` | `enableOfflineQueue: false`: lệnh lỗi ngay khi Redis mất. Chờ ready tối đa 5 giây lúc boot. Dùng chung cho queue, bull-board, và khóa đăng nhập |
| Eviction check | `modules/queue/redis-eviction-policy-check.ts` | Kết nối riêng ngắn hạn (`redis-probe`) để đọc `CONFIG GET maxmemory-policy` |

Kiểm tra prefix queue: `isQueuePrefixValid` trong `@kamito/shared`. Dạng hợp lệ là `kamito-tt:<APP_ENV>` (có thể thêm đoạn sau). `APP_ENV` gồm `development`, `test`, `staging`, `production`.

## Packages dùng chung

| Package | Export chính | Ghi chú |
|---|---|---|
| `@kamito/db` | `PrismaClient` (generated), `MediaStatus`, `Prisma`, `buildPrismaClientOptions`, `createPrismaClient`, `findPendingMigrations`, `listBundledMigrations`, `bundledMigrationsDir`. Domain (phase 05, `src/domain/`): `allocatePlayerIdentity`, `nextPlayerCode`, `uniquePlayerSlug`, `findOrCreateCompetitor`, `refreshCompetitorNames`, `lockSubEvent`, `lockSubEventsInOrder`, `lockPlayersForShare`, `lockPlayersForUpdate`, `advisoryLock`, `playersAlreadyEntered`, `confirmedEntryCount`, `entriesInLockedDraw`, `subEventsWithLockedDraw`, `lockDraw`, `lockGroups`, `isStructureLocked`, `allocateMatchNumbers` (phase 06) | Build chạy `prisma generate` trước `tsc`. Seed `seed:config` import từ `dist/`, nên phải build trước. Domain dùng chung api và worker, nên luật khóa và định danh VĐV chỉ viết một chỗ |
| `@kamito/shared` | `parseEnv`, `appEnvSchema`, `requiredString`, `secretString`, `csvList`, `PaginatedResult`, `QueueName`, `isQueuePrefixValid`, `appSettingRegistry`, `authSettings`, `listSettings`, `tournamentSettings`, `isValidTimezone`, `APP_SETTING_GROUPS`, `DRAW_REASON_MIN_LENGTH`, `DRAW_REASON_MAX_LENGTH` (phase 06), `judgeEvictionPolicy`, `PERMISSION_MATRIX`, `can`, `permissionsFor`, `USER_ROLES`, `isUserRole`, `isHttpsUrl`, `httpsUrlSchema`, `optionalHttpsUrlSchema`, `todayInTimezone`, `isEventLifecycle`, `EVENT_LIFECYCLES`, `isValidSlug`, `slugifyVietnamese`. Phase 05: `normalizePersonName`, `stripDiacritics`, `ageOnEvent`, `checkEntryEligibility`, `ENTRY_IMPORT_COLUMNS`, `playerSettings`, `importSettings`, `importOperationalSettings`. Phase 07: `publicCacheTags`, `isValidCacheTag`, `REVALIDATE_TAGS_JOB`, `revalidateTagsJob`, `revalidateTagsJobs`, `REVALIDATE_ENQUEUE_TIMEOUT_MS`, `withTimeout`, `MATCH_REASON_MIN_LENGTH`, `MATCH_REASON_MAX_LENGTH`. Phase 08: `API_GLOBAL_PREFIX`, `PUBLIC_API_SEGMENT`, `SSR_SECRET_HEADER`, `REVALIDATE_SECRET_HEADER`, `REVALIDATE_MAX_TAGS` (`public-api.ts`), `PUBLIC_DRAW_KINDS` và kiểu `PublicBracket` (`public-bracket-contract.ts`). Phase 09: `RANKING_REASON_MIN_LENGTH`, `RANKING_REASON_MAX_LENGTH`, `RANKING_NOTE_MAX_LENGTH` (`ranking-limits.ts`), `rankingSettings` (`ranking-settings.ts`) | `redis-probe` là subpath riêng vì dùng ioredis. Ma trận quyền dùng cho cả api và admin |
| `@kamito/shared/media` | `MEDIA_PURPOSES`, `MEDIA_PROCESS_JOB`, `MEDIA_CLEANUP_JOB`, `MEDIA_FAILURE`, `incomingKeyFor`, `publicKeyFor`, `effectiveMaxImageBytes`, `parseVariantWidths`, `publicUrlFor`, `storageEnvShape`, `refineStorageEnv` | Hợp đồng media và cấu hình storage dùng chung cho api và worker |
| `@kamito/shared/object-storage` | `ObjectStorage`, `createObjectStorage`, `LocalObjectStorage`, `S3ObjectStorage`, `PayloadTooLargeError`, `assertSafeKey` | `assertSafeKey` chặn khóa có `..` hoặc ký tự lạ |
| `@kamito/competition-engine` | `previewDraw`, `generateKnockout`, `deriveMatches`, `seedPositions`, `generateQualifying`, `allocateGroups`, `generateRoundRobin`, `calculateGroupStandings`, `planGroupWithdrawal`, `placeGroupsInKnockout`, `fillQualifierSlots`, `fillGroupPlaces`, `createRng`, `DrawParamsError` (phase 06) | Hàm thuần, không I/O, không Prisma. Phụ thuộc duy nhất là `@kamito/shared`. RNG có hạt (cyrb128 + sfc32): cùng seed cho cùng kết quả |
| `@kamito/ranking-engine` | Hàm thuần cho xếp hạng: quy tắc theo ngày (`rule-for-date`), điểm theo thứ hạng (`points-for-entry`), dựng snapshot (`snapshot-builder`), xếp hạng (`competition-rank`), vòng đạt được (`stage-reached`) (phase 09) | Không I/O, không Prisma. Phụ thuộc duy nhất là `@kamito/shared`. Test đơn vị nằm cạnh source |
| `@kamito/ui-tokens` | `tokens`, `buildCssVariables`, `buildCssText` (root); `buildAntdTheme`, `antdTheme` (subpath `./antd-theme`) | `tokens.ts` là nguồn duy nhất. Build sinh `dist/tokens.css` |
| `@kamito/config` | `tsconfig.base.json`, `tsconfig.node.json`, `eslint.config.mjs`, `vitest-preset` | Preset Vitest: `src/**/*.test.ts`, `test/**/*.spec.ts` |

Token mặc định (màu đỏ logo `#EC1E24`, navy `#0F285D`, font Archivo) đang chờ brand guideline. Đổi màu = sửa một file. Màu theo hạng giải hoặc loại giải là dữ liệu động (cột `colorHex`), không phải token.

## Admin: menu và module

Menu lấy từ `apps/admin/src/layout/menu-groups.ts`. Một nhóm chỉ hiện khi vai trò có quyền `list` với ít nhất một mục.

| Nhóm | Mục | Đường dẫn | Resource |
|---|---|---|---|
| Giải đấu | Danh sách giải | `/events` | `tournaments` |
| Giải đấu | Địa điểm & bàn | `/venues` | `tournaments` |
| Giải đấu | Nhập tỷ số | `/results` | `matches` |
| Vận động viên | Danh sách VĐV, Cặp đôi, Lịch sử import | `/players`, `/pairs`, `/imports` | `players`, `players`, `tournaments` |
| Xếp hạng | Bảng xếp hạng, Quy tắc điểm, Sổ điểm, Kỳ chốt | `/ranking-lists`, `/ranking-rules`, `/ranking-points`, `/ranking-snapshots` | `rankings` |
| Nội dung, Nhà tài trợ | (trống, phase sau) | — | — |
| Cấu hình | Nhóm giải, Hạng giải, Nội dung chuẩn, Nhóm tuổi / trình độ, Thể thức trận, Luật vòng bảng | `/tiers`, `/event-types`, `/disciplines`, `/categories`, `/match-formats`, `/group-scoring-rules` | `tournaments` |
| Cấu hình | Cài đặt hệ thống | `/settings` | `settings` |
| Cấu hình | Hàng đợi xử lý | `/api/v1/admin/queues` (bull-board, ngoài SPA) | `queues` |
| Người dùng | Tài khoản nhân viên, Nhật ký thao tác | `/users`, `/audit-logs` | `users`, `audit-logs` |

Code phía admin (`apps/admin/src`):
- `components/`: `confirm-action-button` (xác nhận hành động nguy hiểm), `media-upload-field` và `media-upload-support` (ô tải ảnh có trạng thái), `rich-text-field` (TipTap), `slug-input` (gợi ý slug trùng).
- `components/` thêm: `sortable-list-field` (danh sách sắp thứ tự bằng kéo thả, có bàn phím; dùng cho tiêu chí xếp hạng và bàn của session), `use-debounced-value` (hook debounce cho ô tìm kiếm), `auth-gate` (chỉ 401 mới đăng xuất, lỗi khác hiện nút thử lại; xem [auth-and-rbac](./auth-and-rbac.md#admin-khi-authme-lỗi)).
- `resources/catalog-common/` và `resources/catalog-routes.tsx`: khung chung cho 7 danh mục (bảng, form, hành động dòng, màu hex). `useCatalogAccess(permission)` (mặc định `tournaments`), `CatalogCreatePage` và `CatalogEditPage` nhận `onSaved`.
- `resources/events/`, `resources/venues/`: danh sách và form giải, địa điểm và bàn (modal tạo nhanh).
- `pages/event-hub/`: hub một giải với tab **Thông tin**, **Nội dung thi đấu**, **Danh sách** (đăng ký) và **Bốc thăm** (antd `Tabs`). Tab Bốc thăm có wizard sinh nhánh, bảng sơ đồ (`admin-bracket-view.tsx`), vòng bảng (`group-card.tsx`) và modal thao tác sau công bố có xem trước. Tab Danh sách có menu dọc chọn nội dung, bảng đăng ký, form thêm đơn/đôi, thao tác hàng loạt và nút "Import Excel". Modal tạo nội dung hàng loạt nằm trong tab Nội dung thi đấu.
- Tab **Lịch & kết quả** (`schedule-tab.tsx`, `session-form-modal.tsx`, `session-grid*.tsx`, `unscheduled-panel.tsx`, `use-schedule-board.ts`): session, lưới xếp lịch (hai cú bấm hoặc kéo thả bằng `@dnd-kit`), panel trận chưa xếp. `match-sheets-print-page.tsx`: in phiếu trận tại `/events/:id/print/match-sheets`, CSS riêng (`match-sheets-print.module.css`). Chi tiết: [scheduling](./scheduling.md#màn-hình-admin). `pages/results/`: màn nhập tỷ số, xem [match-results](./match-results.md#màn-hình-nhập-tỷ-số).
- `resources/players/`, `resources/pairs/`, `resources/imports/`: danh sách, sửa, tạo VĐV, modal gộp VĐV, danh sách và chi tiết lượt import.
- `components/import-wizard.tsx`, `import-preview-table.tsx`, `player-lookup-select.tsx`: wizard import (tải mẫu, tải file, kiểm tra và nhập), bảng xem trước, ô tìm VĐV dùng lại được.
- `pages/settings-field.tsx` và `pages/settings-editors/`: editor theo `editor.kind` của setting (`number`, `text`, `boolean`, `timezone`, `event`).
- `pages/ranking/`, `resources/ranking-lists/`: bốn màn Xếp hạng (bảng, quy tắc điểm dạng ma trận có phiên bản, sổ điểm, kỳ chốt). Route khai ở `pages/ranking/ranking-routes.tsx`, kiểm quyền theo resource `rankings`. Trong `pages/event-hub/` có `sub-event-ranking-field.tsx` (chọn bảng cho nội dung) và `draw-seed-suggestion-modal.tsx` (gợi ý hạt giống theo BXH). Chi tiết: [changelog 2026-11-16](./project-changelog.md#2026-11-16--phase-09-màn-admin-xếp-hạng-chưa-commit).

## Chưa xây dựng

| Hạng mục | Phase | Trạng thái |
|---|---|---|
| Chuyển hướng 301 slug VĐV đã gộp | 10 | Mới lưu `mergedIntoId`, chưa có route công khai |
| Hiện năm sinh hoặc tuổi trên site công khai (`player.showAge`) | 08, 10 | Setting đã khai báo, chưa có nơi đọc |
| Queue nghiệp vụ khác | Phase sau | `QueueName` có `maintenance` (chưa có job), `media`, `import` và `revalidate` (đang dùng) |
| Bảng xếp hạng công khai, hồ sơ VĐV công khai, tin, video, nhà tài trợ | 10–11 | Trang công khai chưa có. Bảng xếp hạng công khai thuộc phase 10 ([public-site](./public-site.md)) |
| Sửa `site.name` trên `/settings` | — | Key có trong registry, chưa có editor |
| `S3_PRESIGN_ENDPOINT`, `S3_PUBLIC_BASE_URL` | — | Không còn dùng (đã chọn thiết kế (b)). Vẫn nằm trong `env-schema.ts`, compose và `.env.example`. Gỡ ở lần dọn env |

## Quyết định kiến trúc

| # | Quyết định | Lý do (theo phase 01, phase 04 và code) |
|---|---|---|
| 1 | Monorepo pnpm + Turborepo | Chia sẻ schema, token, env validation giữa 4 app |
| 2 | NestJS 12 cho api | Module và DI; ESM-only nên toàn repo dùng ESM |
| 3 | Prisma 7 với driver adapter `@prisma/adapter-pg` | Prisma 7 bỏ Rust engine; adapter là cách kết nối chính |
| 4 | Migration là nguồn sự thật, cấm `db push` | Schema trên DB không lệch khỏi lịch sử git |
| 5 | Redis riêng cho BullMQ, bắt buộc `noeviction` | Eviction làm mất job; production từ chối chạy nếu không đúng |
| 6 | Job payload chỉ chứa id, processor nạp lại từ DB | Dữ liệu queue có thể cũ hoặc bị đụng khi Redis dùng chung. Job `process-image` chỉ mang `{ mediaId }` |
| 7 | Chỉ truy cập object storage qua S3 API (hoặc driver `local` cho dev) | MinIO community đã archive (theo phase 01, 2026-04-25). Đổi nhà cung cấp chỉ cần đổi env |
| 8 | Dev dùng RustFS 1.0.4 thay MinIO | Image MinIO không còn trên Docker Hub (ghi nhận 2026-11-12). API chỉ nói S3 nên prod có thể giữ MinIO |
| 9 | Vitest cho api, không Jest | SWC giữ được decorator metadata của Nest (`unplugin-swc`) |
| 10 | Admin đọc `/config.json` lúc chạy | Không cần build lại khi đổi URL |
| 11 | Cấu hình nghiệp vụ trong `AppSetting`, kỹ thuật trong env | Admin đổi được giá trị nghiệp vụ mà không deploy |
| 12 | Health tách live và ready | Container healthcheck không phụ thuộc DB; ready chỉ nội bộ |
| 13 | Better Auth không dùng plugin admin. Chỉ 2 route (`sign-in/email`, `sign-out`) đi qua handler raw, phần còn lại qua Nest | Allowlist chính xác, route mới mặc định bị chặn. Plugin admin không cần cho mô hình 2 vai trò |
| 14 | Phân quyền deny-by-default ở guard toàn cục; ma trận quyền một nguồn cho api và admin UI | Route quên khai báo quyền vẫn bị chặn. UI không phải lớp bảo vệ |
| 15 | Vai trò, `isActive`, `mustChangePassword` đọc từ DB mỗi request | Đổi quyền và khóa tài khoản có hiệu lực ngay, không chờ hết phiên |
| 16 | Tham số đăng nhập, phiên, mật khẩu, phân trang, và tham số phase 04 nằm ở `/settings` (`AppSetting`) | Theo luật dự án: đổi được trên giao diện, không cần redeploy. Env chỉ còn secret, URL, và trần an toàn |
| 17 | Admin dùng Refine + antd, phân quyền UI qua `accessControlProvider` cùng ma trận của api | Refine cho list, form, và router. Quyền vẫn do api quyết định |
| 18 | Upload ảnh qua API (thiết kế b), trần cứng byte, stream vào storage; không dùng URL ký | Một luồng cho mọi môi trường (dev không cần S3). Không lộ bucket cho trình duyệt. Kiểm định dạng ở worker, không tin Content-Type |
| 19 | Ảnh gốc ở `incoming/` không bao giờ được phục vụ; worker encode lại sang WebP `public/` | File gốc có thể chứa EXIF, payload lạ, hoặc ảnh quá lớn. Encode lại loại bỏ metadata và chặn ảnh giả định dạng |
| 20 | Rich text: sanitize ở server khi ghi và sẽ sanitize lại khi render. Allowlist thẻ và thuộc tính; link chỉ `https:` và `mailto:`; ảnh chỉ `https:` | TipTap xuất HTML, nên server không tin input. Sanitize hai lần giữ an toàn khi allowlist đổi |
| 21 | Lifecycle giải suy ra từ ngày và `isCancelled`, không lưu cột | Không lệch khi đổi ngày, múi giờ, hoặc hủy giải. Lọc theo múi giờ của từng giải |
| 22 | Danh mục ẩn bằng `isActive=false`, không xóa khi đang dùng (409 `IN_USE`) | Giữ lịch sử và FK `Restrict`. Admin vẫn thấy mục cũ trong dữ liệu đã có |
| 23 | Một mặc định duy nhất bằng partial unique index, cộng advisory lock trong transaction | Index là ràng buộc cuối cùng trong DB. Lock giúp báo lỗi rõ thay vì 500 khi đua nhau |
| 24 | Entry trỏ vào `Competitor`, không trỏ thẳng vào Player/Pair | Thêm đội (TEAM) sau này không đổi entry và trận đấu |
| 25 | Định danh VĐV, khớp và luật khóa nằm trong `@kamito/db` và `@kamito/shared`, api và worker cùng dùng | Hai nơi ghi (đăng ký tay và import) không lệch luật. Thứ tự khóa cố định: advisory, SubEvent, Player |
| 26 | Import là hai bước: validate ghi kết quả xem trước, commit đọc lại dữ liệu và khớp lại dưới khóa | Dữ liệu có thể đổi giữa hai bước. Xem trước không được coi là lệnh nhập. Hash file phải khớp khi commit |
| 27 | Quyền xem SĐT, email, ngày sinh theo `players.update` | Một nguồn quyền. `RESULTS_OPERATOR` không sửa được hồ sơ nên không thấy dữ liệu riêng tư |
| 28 | Bốc thăm và xếp nhánh là hàm thuần trong `@kamito/competition-engine`; api chỉ nạp dữ liệu và ghi | Test không cần DB. Cùng `randomSeed` cho cùng kết quả, nên tranh chấp tra lại được |
| 29 | Xem trước (`dryRun`) chạy đúng luồng thật rồi rollback | Không có hai bản logic có thể lệch nhau |
| 30 | `expectedVersion` cho nhánh và bảng, cộng khóa `SubEvent` → `Draw` → `Group` | Hai admin cùng sửa không ghi đè nhau. Dữ liệu đổi giữa lúc xem và lúc ghi bị phát hiện |
| 31 | Revalidate sau commit, ngoài transaction; lỗi enqueue không rollback thao tác | Transaction không chờ Redis. Cache công khai tái tạo được: một lần xóa thất bại không làm sai dữ liệu gốc, chỉ làm trang cũ lâu hơn. Job có `jobId` duy nhất vì BullMQ có thể bỏ job mới khi trùng id |
| 32 | Nội dung công khai không có hoặc chưa công bố trả 200 `{data: null}`, không 404 | Next chỉ cache 200. Với 404, trang đã gỡ vẫn nằm trong cache. Đổi lại, slug sai cũng là 200: client phải kiểm `data` |
| 33 | Site công khai đọc API bằng secret nội bộ (`x-internal-secret`), không bằng phiên | API không có domain công khai nên secret là ranh giới thật. Host allowlist ở `/api/revalidate` là lớp phụ |
| 34 | Rate limit công khai ở `proxy.ts`, Redis atomic chung, ngưỡng ở `/settings` | Hai Next chia sẻ hạn mức theo IP; Redis lỗi dùng fallback cục bộ có trần, không bảo đảm tổng hạn mức toàn cụm. Header IP vẫn cần xác nhận Traefik thật |
| 35 | CSP `Content-Security-Policy-Report-Only` từ phase 08, enforce ở phase 12 | Đo vi phạm trước khi chặn. Báo cáo gửi về `/api/csp-report` có giới hạn kích thước và số lần ghi log |
| 36 | `sitemap` và `robots` sinh lúc chạy (`force-dynamic`) | Build Docker không gọi được API nên không sinh lúc build |
| 37 | Lịch: thứ tự khóa `SubEvent` → `Draw` → `Group` → `EventSession` → `Match`. `scheduleVersion` tách khỏi `Match.version`, nên sửa lịch không làm trượt khóa kết quả và ngược lại | Thứ tự chung ngăn vòng chờ giữa xếp lịch, đổi giờ session và nhập tỷ số. Chi tiết: [scheduling](./scheduling.md#khóa-và-đồng-thời) |
| 38 | Mở lại tỷ số khóa mọi nhánh của nội dung (QUALIFYING, GROUP, MAIN) trước khi khóa trận. Ảnh hưởng tính bằng hàm thuần `computeReopenImpact` dùng chung cho xem trước và thực thi | Mở lại có thể chạm suất ở nhánh khác. Xem trước và thực thi không lệch nhau. Chi tiết: [match-results](./match-results.md#mở-lại-trận) |
| 39 | Mọi route ghi `/admin` phải đăng ký trong `ROUTE_TAG_RULES`: gửi tag hoặc ghi lý do không gửi | Route mới quên tag là lỗi cache âm thầm. Test e2e buộc người viết route phải quyết định. Chi tiết: [cache-revalidation](./cache-revalidation.md#quy-tắc-phủ-route) |

Lưu ý về mục 7 và 8: nguồn gốc là phase 01 và ghi nhận của chủ repo. Chưa đối chiếu lại trong lần viết này.

## Liên quan

- [draws-and-groups.md](./draws-and-groups.md): bốc thăm, hạt giống, vòng bảng, walkover treo, mã lỗi (phase 06).
- [match-results.md](./match-results.md): nhập và chốt tỷ số, API trận, quy tắc tỷ số, tag revalidate (phase 07).
- [public-site.md](./public-site.md): site công khai (phase 08): route, API public, cache, proxy, SEO, in ấn, CSP.
- [code-standards.md](./code-standards.md): tiêu chuẩn code, migration, quy ước API, danh mục và upload.
- [deployment-guide.md](./deployment-guide.md): compose, biến môi trường, quy trình phát hành, seed.
- [auth-and-rbac.md](./auth-and-rbac.md): đăng nhập, phân quyền, cài đặt vận hành.
- [project-changelog.md](./project-changelog.md) và [development-roadmap.md](./development-roadmap.md): lịch sử và trạng thái phase.
