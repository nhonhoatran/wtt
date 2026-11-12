# System Architecture — Kamito

> Cập nhật: 2026-11-12 · Trạng thái: khung phase 01 (chưa có nghiệp vụ thi đấu).
> Nguồn đối chiếu: `apps/*/src`, `packages/*/src`, `packages/db/prisma`, `docker/*`, `docker-compose*.yml`.
> Tiêu chuẩn code xem [code-standards.md](./code-standards.md). Triển khai xem [deployment-guide.md](./deployment-guide.md).

## Contents
- [Tổng quan](#tổng-quan)
- [Thành phần](#thành-phần)
- [Luồng mạng (staging và production)](#luồng-mạng-staging-và-production)
- [Luồng khởi động](#luồng-khởi-động)
- [Health endpoints](#health-endpoints)
- [Dữ liệu (phase 01)](#dữ-liệu-phase-01)
- [Dịch vụ dùng chung trong api](#dịch-vụ-dùng-chung-trong-api)
- [Packages dùng chung](#packages-dùng-chung)
- [Chưa xây dựng](#chưa-xây-dựng)
- [Quyết định kiến trúc](#quyết-định-kiến-trúc)

## Tổng quan

Nền tảng giải bóng bàn Kamito: site công khai (tiếng Việt và tiếng Anh), trang quản trị giải đấu, API, và worker xử lý nền. Monorepo pnpm + Turborepo gồm 4 app và 4 package.

Đường đi chính:
- Người xem: trình duyệt → client (Next.js, SSR) → api (nội bộ).
- Quản trị: trình duyệt → admin (nginx phục vụ SPA, proxy vào api) → api.
- Nền: api và worker dùng chung PostgreSQL, Redis (`noeviction`, dành cho queue; BullMQ chưa cài), S3-compatible storage.

## Thành phần

| Thành phần | Công nghệ | Cổng | Mạng | Vai trò hiện tại |
|---|---|---|---|---|
| `apps/client` | Next.js 16.4.3, React 19.3.1 | 3000 trong container, 3001 khi dev | `internal`, `dokploy-network` | Khung: layout `[locale]`, trang trống, route health |
| `apps/admin` | Vite 8.3.5, React 19.3.1, antd 5.29.3 | 8080 trong container (nginx-unprivileged), 5173 khi dev | `internal`, `dokploy-network` | Khung: entrypoint, `runtime-config.ts`, proxy |
| `apps/api` | NestJS 12.3.2 trên Express 5.3.0 | `API_PORT` (3000) | `internal` | Health, error filter, pagination, audit, kiểm migration và Redis lúc boot |
| `apps/worker` | Node + ioredis | `WORKER_HEALTH_PORT` (3010) | `internal` | Kiểm Redis lúc boot, health HTTP. **Chưa có processor, chưa có BullMQ** |
| `migrate` (target của `api.Dockerfile`) | Prisma CLI | — (chạy một lần) | `internal` | Xác nhận target, `prisma migrate deploy` |
| PostgreSQL | 17.11 (dev) | 5433 (dev) | ngoài compose prod | Dữ liệu nghiệp vụ, `_prisma_migrations` |
| Redis | 8.2.11, `noeviction`, AOF (dev) | 6380 (dev) | ngoài compose prod | Queue BullMQ (từ phase sau) |
| Object storage | S3 API; dev dùng RustFS 1.0.4 | 9010 API, 9011 console (dev) | ngoài compose prod | Chưa có upload |

Packages: `@kamito/db`, `@kamito/shared`, `@kamito/ui-tokens`, `@kamito/config`. Chi tiết ở [Packages dùng chung](#packages-dùng-chung).

## Luồng mạng (staging và production)

```
Browser ─TLS─> Traefik (Dokploy) ─> client (Next.js, domain công khai)
                                      └─ SSR fetch ──> api:3000   (internal; kế hoạch, client chưa gọi API)
Browser ─TLS─> Traefik ─> admin (nginx: SPA tĩnh + proxy)
                            ├─ /api/v1/admin/*  ──> api:3000
                            ├─ /api/v1/auth/*   ──> api:3000
                            └─ /api/*  khác     ──> 404
api ──> PostgreSQL / Redis / S3 (URL ngoài, qua env)
worker ──> PostgreSQL / Redis / S3 (kế hoạch: client:3000/api/revalidate)
```

Quy tắc:
- **API không có domain công khai.** Chỉ `client` và `admin` có domain (gắn qua tab Domains của Dokploy, compose dùng `expose`, không `ports`).
- `api` chỉ nằm trên mạng `internal`. `client` và `admin` nằm trên cả `internal` và `dokploy-network`.
- Admin nginx (`docker/admin-nginx.conf`):

  | Đường dẫn trên domain admin | Kết quả |
  |---|---|
  | `/healthz` | 200 `{"status":"ok"}` (nginx tự trả) |
  | `/api/v1/admin/*`, `/api/v1/auth/*` | proxy tới api (`docker/admin-api-proxy.conf`) |
  | `/api/*` khác (kể cả `/api/v1/public/*`, `/api/v1/health/*`) | 404 |
  | `/config.json` | file sinh lúc start (xem dưới) |
  | `/assets/*` | `Cache-Control` 1 năm, immutable |
  | `/*` | SPA fallback về `index.html`, `no-cache` |

- **Resolve tên `api` lúc request:** `resolver 127.0.0.11` + biến `$api_upstream`. Nginx khởi động được khi api chưa sẵn sàng, và theo IP mới khi api tạo lại.
- **Rủi ro đã ghi nhận:** tên DNS `api` có thể đụng service khác trên `dokploy-network` dùng chung (review H3, `plans/reports/code-reviewer-261112-0907-phase-01-foundation-review.md`). Hoãn sang Spike D: alias riêng hoặc Isolated Deployment.

### Chuỗi proxy và IP thật

- Chuỗi tin cậy: Traefik → nginx (admin) hoặc Next (client) → api.
- nginx chuyển tiếp `X-Forwarded-For` nguyên vẹn, không nối thêm hop. API đặt `trust proxy` = `TRUST_PROXY_HOPS`.
- Dev không có proxy: `TRUST_PROXY_HOPS=0` (`.env.example`). Compose prod bắt buộc khai biến này.
- Chưa kiểm: Traefik có ghi đè XFF do client gửi không, và có tin `forwardedHeaders` không. Kiểm ở Spike D.
- Rate limit cho site công khai đặt ở tầng thấy IP thật (Traefik hoặc Next), không đặt ở api. Chưa triển khai.

### Admin: cấu hình lúc chạy

`docker/admin-entrypoint.sh` chạy khi container start. Ghi `/tmp/admin-config/config.json` từ **allowlist** ba khóa: `API_BASE_PATH`, `ADMIN_PUBLIC_URL`, `PUBLIC_SITE_URL`. Không khóa nào khác được ghi. `apps/admin/test/admin-entrypoint.test.mjs` kiểm việc này bằng biến chứa chuỗi `must-not-leak`.

Vì vậy đổi URL không cần build lại admin image. File `/config.json` có `Cache-Control: no-store`.

## Luồng khởi động

**API** (`apps/api/src/main.ts`):
1. `loadApiEnv()` parse env bằng zod. Lỗi → in tên biến, thoát.
2. `createApiApp()`: Nest + pino, `trust proxy`, prefix `api/v1`, `HttpExceptionFilter`, shutdown hooks.
3. `RedisEvictionPolicyCheck` kiểm `maxmemory-policy` lúc bootstrap, cache kết quả cho `/health/ready`.
4. `findPendingMigrations(prisma)`: nếu còn migration đi kèm image chưa áp dụng → log và `exit(1)`.
5. `listen(API_PORT, '0.0.0.0')`.

**Worker** (`apps/worker/src/main.ts`):
1. `loadWorkerEnv()` parse env. Kiểm `QUEUE_PREFIX` đúng dạng `kamito-tt:<APP_ENV>`.
2. `checkRedisEvictionPolicy(env)`:
   - Không kết nối được Redis → `fatal` → thoát `1`.
   - Policy khác `noeviction`: `production` → `fatal` → thoát `1`; môi trường khác → `degraded` (log lỗi, health báo `degraded`).
   - Không đọc được policy: nếu `REDIS_EVICTION_CHECK_OVERRIDE` có giá trị → `overridden` (log cảnh báo, vẫn chạy). Nếu không → như trên.
3. Mở health server trên `WORKER_HEALTH_PORT`, tạo kết nối Redis cho BullMQ (chưa dùng).
4. `SIGTERM` / `SIGINT`: đóng health server, `redis.quit()`, thoát `0`.

**Worker không kiểm migration và không kiểm DB** (khác với api). Đây là khoảng trống có chủ ý ở phase 01; xem lại khi có processor đầu tiên.

**Migrate** (`docker/migrate-entrypoint.sh`):
1. `node scripts/print-db-target.mjs --confirm`: in `host:port/database` (ẩn mật khẩu). Nếu `MIGRATE_CONFIRM_TARGET` không khớp đúng `host:port/database` → thoát `3`.
2. `prisma migrate status` (chỉ để xem; lỗi bị bỏ qua có chủ ý).
3. `prisma migrate deploy`.

`DATABASE_URL` thiếu → `print-db-target.mjs` thoát `2`.

**Admin:** entrypoint ghi `config.json` → nginx chạy.

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
- `storage`: `HeadBucket` trên `S3_BUCKET`.
- Tổng hợp: có `down` → `not_ready`; có `degraded` → `degraded`; còn lại `ready`.

Health không được ghi log (`autoLogging.ignore`). Admin và client không chuyển tiếp `/health/*` ra ngoài; nginx admin trả 404.

## Dữ liệu (phase 01)

Migration duy nhất: `packages/db/prisma/migrations/20261112015704_init_app_settings_audit_log`.

**`AppSetting`** — chỉ giá trị nghiệp vụ. Key, zod schema và default nằm trong `@kamito/shared`.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `key` | TEXT, PK | Ví dụ `site.name` |
| `value` | JSONB | |
| `updatedById` | TEXT, nullable | |
| `updatedAt` | TIMESTAMP(3) | `@updatedAt` |

Registry hiện có một key: `siteName` (`site.name`, mặc định `vi` và `en`).

**`AuditLog`** — ghi mọi thay đổi nghiệp vụ.

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

Schema tách file: `base.prisma` (generator, datasource), `app-setting.prisma`, `audit-log.prisma`.

## Dịch vụ dùng chung trong api

| Dịch vụ | File | Hành vi |
|---|---|---|
| Config | `common/config/env-schema.ts`, `app-config.module.ts` | Symbol `API_ENV`. Schema zod toàn cục, global module |
| Logger | `common/logger/logger.module.ts` | pino JSON. Request ID, redact theo danh sách trong `LOG_REDACT_PATHS` |
| Error filter | `common/filters/http-exception.filter.ts` | Mọi lỗi trả `{error:{code,message,fields?}}`. Lỗi không phải HttpException → 500 `INTERNAL_ERROR` |
| Pagination | `common/pagination/pagination-query.ts` | Whitelist sort/filter, giới hạn page size và độ dài `q`. Xem [code-standards.md](./code-standards.md#quy-ước-api) |
| Request context | `common/audit/request-context.ts` | Middleware trên mọi route. `AsyncLocalStorage` giữ `requestId`, `ip`, `userAgent`. `userId`, `sessionId` sẽ do lớp auth điền (phase 03) |
| AuditService | `common/audit/audit.service.ts` | `record(entry, tx?)`. Actor = `USER` nếu có userId, ngược lại `SYSTEM`. Ghi `before`/`after` sau khi mask |
| PII mask | `common/audit/mask-pii.ts` | Khớp chuỗi con trên khóa, không phân biệt hoa thường. Đệ quy, tối đa 20 cấp. Không sửa object gốc |
| Prisma | `modules/prisma/prisma.service.ts` | `PrismaClient` + `@prisma/adapter-pg`. Đóng kết nối khi tắt |
| Redis | `modules/queue/redis-connection.provider.ts` | `enableOfflineQueue: false`: lệnh lỗi ngay khi Redis mất. Chờ ready tối đa 5 giây lúc boot |
| Eviction check | `modules/queue/redis-eviction-policy-check.ts` | Kết nối riêng ngắn hạn (`redis-probe`) để đọc `CONFIG GET maxmemory-policy` |
| S3 | `modules/storage/s3-client.provider.ts` | `@aws-sdk/client-s3`, `forcePathStyle` theo `S3_FORCE_PATH_STYLE` |

Kiểm tra prefix queue: `isQueuePrefixValid` trong `@kamito/shared`. Dạng hợp lệ là `kamito-tt:<APP_ENV>` (có thể thêm đoạn sau). `APP_ENV` gồm `development`, `test`, `staging`, `production`.

## Packages dùng chung

| Package | Export chính | Ghi chú |
|---|---|---|
| `@kamito/db` | `PrismaClient` (generated), `buildPrismaClientOptions`, `createPrismaClient`, `findPendingMigrations`, `listBundledMigrations`, `bundledMigrationsDir` | Build chạy `prisma generate` trước `tsc` |
| `@kamito/shared` | `parseEnv`, `appEnvSchema`, `requiredString`, `secretString`, `csvList`, `PaginatedResult`, `QueueName`, `isQueuePrefixValid`, `appSettingRegistry`, `judgeEvictionPolicy` | `redis-probe` là subpath riêng vì dùng ioredis |
| `@kamito/ui-tokens` | `tokens`, `buildCssVariables`, `buildCssText` (root); `buildAntdTheme`, `antdTheme` (subpath `./antd-theme`) | `tokens.ts` là nguồn duy nhất. Build sinh `dist/tokens.css` |
| `@kamito/config` | `tsconfig.base.json`, `tsconfig.node.json`, `eslint.config.mjs`, `vitest-preset` | Preset Vitest: `src/**/*.test.ts`, `test/**/*.spec.ts` |

Token mặc định (màu đỏ logo `#EC1E24`, navy `#0F285D`, font Archivo) đang chờ brand guideline. Đổi màu = sửa một file.

## Chưa xây dựng

| Hạng mục | Phase | Trạng thái |
|---|---|---|
| `packages/competition-engine` (bracket, seeding, round robin) | 06–07 | Chưa có |
| `packages/ranking-engine` (điểm, snapshot) | 09 | Chưa có |
| BullMQ processor và đăng ký queue | 02 trở đi | Chưa cài `bullmq`; worker chỉ có Redis connection |
| Auth và RBAC admin | 03 | Chưa có. Context đã sẵn chỗ cho `userId`, `sessionId` |
| Refine trong admin | 02 (Spike B) | Chưa cài |
| Upload: thiết kế (a) trình duyệt upload trực tiếp qua URL ký, hoặc (b) upload qua API | 01 bước 15 | Chưa chọn. Hai biến `S3_PRESIGN_ENDPOINT`, `S3_PUBLIC_BASE_URL` chỉ dùng cho (a) |
| Revalidate Next.js từ worker | 02 (Spike E) | Chưa có. Worker chưa có `CLIENT_INTERNAL_URL`, `REVALIDATE_SECRET` |
| Thi đấu, bảng điểm, site công khai | 04–12 | Chưa có |

## Quyết định kiến trúc

| # | Quyết định | Lý do (theo phase 01 và code) |
|---|---|---|
| 1 | Monorepo pnpm + Turborepo | Chia sẻ schema, token, env validation giữa 4 app |
| 2 | NestJS 12 cho api | Module và DI; ESM-only nên toàn repo dùng ESM |
| 3 | Prisma 7 với driver adapter `@prisma/adapter-pg` | Prisma 7 bỏ Rust engine; adapter là cách kết nối chính |
| 4 | Migration là nguồn sự thật, cấm `db push` | Schema trên DB không lệch khỏi lịch sử git |
| 5 | Redis riêng cho BullMQ, bắt buộc `noeviction` | Eviction làm mất job; production từ chối chạy nếu không đúng |
| 6 | Job payload chỉ chứa id, processor nạp lại từ DB | Dữ liệu queue có thể cũ hoặc bị đụng khi Redis dùng chung |
| 7 | Chỉ truy cập object storage qua S3 API | MinIO community đã archive (theo phase 01, 2026-04-25). Đổi nhà cung cấp chỉ cần đổi env |
| 8 | Dev dùng RustFS 1.0.4 thay MinIO | Image MinIO không còn trên Docker Hub (ghi nhận 2026-11-12). API chỉ nói S3 nên prod có thể giữ MinIO |
| 9 | Vitest cho api, không Jest | SWC giữ được decorator metadata của Nest (`unplugin-swc`) |
| 10 | Admin đọc `/config.json` lúc chạy | Không cần build lại khi đổi URL |
| 11 | Cấu hình nghiệp vụ trong `AppSetting`, kỹ thuật trong env | Admin đổi được giá trị nghiệp vụ mà không deploy |
| 12 | Health tách live và ready | Container healthcheck không phụ thuộc DB; ready chỉ nội bộ |

Lưu ý về mục 7 và 8: nguồn gốc là phase 01 và ghi nhận của chủ repo. Chưa đối chiếu lại trong lần viết này.

## Liên quan

- [code-standards.md](./code-standards.md): tiêu chuẩn code, migration, quy ước API.
- [deployment-guide.md](./deployment-guide.md): compose, biến môi trường, quy trình phát hành.
