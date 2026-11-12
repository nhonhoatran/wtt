# System Architecture — Kamito

> Cập nhật: 2026-11-12 · Trạng thái: phase 01 (khung) và phase 03 (đăng nhập, RBAC, users, /settings, nhật ký, khung admin). Chưa có nghiệp vụ thi đấu.
> Nguồn đối chiếu: `apps/*/src`, `packages/*/src`, `packages/db/prisma`, `docker/*`, `docker-compose*.yml`.
> Tiêu chuẩn code xem [code-standards.md](./code-standards.md). Triển khai xem [deployment-guide.md](./deployment-guide.md). Chi tiết đăng nhập và phân quyền xem [auth-and-rbac.md](./auth-and-rbac.md).

## Contents
- [Tổng quan](#tổng-quan)
- [Thành phần](#thành-phần)
- [Luồng mạng (staging và production)](#luồng-mạng-staging-và-production)
- [Luồng khởi động](#luồng-khởi-động)
- [Health endpoints](#health-endpoints)
- [Dữ liệu](#dữ-liệu)
- [Xác thực và phân quyền (phase 03)](#xác-thực-và-phân-quyền-phase-03)
- [Dịch vụ dùng chung trong api](#dịch-vụ-dùng-chung-trong-api)
- [Packages dùng chung](#packages-dùng-chung)
- [Chưa xây dựng](#chưa-xây-dựng)
- [Quyết định kiến trúc](#quyết-định-kiến-trúc)

## Tổng quan

Nền tảng giải bóng bàn Kamito: site công khai (tiếng Việt và tiếng Anh), trang quản trị giải đấu, API, và worker xử lý nền. Monorepo pnpm + Turborepo gồm 4 app và 4 package.

Đường đi chính:
- Người xem: trình duyệt → client (Next.js, SSR) → api (nội bộ).
- Quản trị: trình duyệt → admin (nginx phục vụ SPA, proxy vào api) → api. Đăng nhập bằng session cookie (Better Auth), phân quyền ở api.
- Nền: api và worker dùng chung PostgreSQL, Redis (`noeviction`, dành cho queue và khóa đăng nhập), S3-compatible storage. BullMQ hiện chỉ api dùng (bull-board); worker chưa có processor.

## Thành phần

| Thành phần | Công nghệ | Cổng | Mạng | Vai trò hiện tại |
|---|---|---|---|---|
| `apps/client` | Next.js 16.4.3, React 19.3.1 | 3000 trong container, 3001 khi dev | `internal`, `dokploy-network` | Khung: layout `[locale]`, trang trống, route health |
| `apps/admin` | Vite 8.3.5, React 19.3.1, antd 5.29.3, `@refinedev/core` 5.0.12 + `@refinedev/antd` 6.0.3, react-router 7.18.5 | 8080 trong container (nginx-unprivileged), 5173 khi dev | `internal`, `dokploy-network` | Đăng nhập, người dùng, nhật ký thao tác, `/settings`, menu theo quyền, đổi mật khẩu |
| `apps/api` | NestJS 12.3.2 trên Express 5.3.0, Better Auth 1.7.21, BullMQ 6.5.1 (cho bull-board) | `API_PORT` (3000) | `internal` | Health, error filter, pagination, audit, auth và RBAC, users, settings, nhật ký (đọc), bull-board, CLI `create-admin`, kiểm migration và Redis lúc boot |
| `apps/worker` | Node + ioredis | `WORKER_HEALTH_PORT` (3010) | `internal` | Kiểm Redis lúc boot, health HTTP. **Chưa có processor. Chưa dùng BullMQ** (BullMQ hiện chỉ api dùng, để bull-board đọc queue) |
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
2. `createApiApp()` (`bootstrap-app.ts`): Nest + pino, `trust proxy`, prefix `api/v1`, `HttpExceptionFilter`, shutdown hooks. Trước `app.init()` gắn trên Express: handler raw của Better Auth (`/api/v1/auth/sign-in/email`, `/sign-out`) và bull-board (`/api/v1/admin/queues`). Các guard toàn cục (session, mật khẩu tạm, quyền, step-up) đăng ký trong `AuthModule`. Chi tiết xem [auth-and-rbac.md](./auth-and-rbac.md#chuỗi-guard).
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

## Dữ liệu

Migration theo thứ tự:
1. `packages/db/prisma/migrations/20261112015704_init_app_settings_audit_log` (phase 01)
2. `packages/db/prisma/migrations/20261112042429_add_users_and_auth_sessions` (phase 03)

Schema tách file: `base.prisma`, `app-setting.prisma`, `audit-log.prisma`, `auth.prisma`.

**`AppSetting`** — chỉ giá trị nghiệp vụ và tham số vận hành. Key, zod schema và default nằm trong `@kamito/shared` (`app-setting-registry.ts`).

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `key` | TEXT, PK | Ví dụ `auth.login.ipMaxAttempts` |
| `value` | JSONB | |
| `updatedById` | TEXT, nullable | |
| `updatedAt` | TIMESTAMP(3) | `@updatedAt` |

Registry hiện có 12 key:
- `site.name` (`siteName`, mặc định `vi` và `en`). Chưa có editor, không sửa được trên `/settings`.
- 10 key `auth.*` và `list.defaultPageSize`. Đều sửa được trên `/settings`. Bảng đầy đủ xem [auth-and-rbac.md](./auth-and-rbac.md#cài-đặt-vận-hành-settings).

**`AuditLog`** — ghi mọi thay đổi nghiệp vụ (xem bảng bên dưới).

**Bảng auth (migration phase 03)** — shape Better Auth yêu cầu, cộng cột riêng của dự án:

| Bảng | Cột riêng của dự án | Ghi chú |
|---|---|---|
| `User` | `role` (enum `UserRole`: `ADMIN`, `RESULTS_OPERATOR`, mặc định `RESULTS_OPERATOR`), `isActive` (mặc định true), `mustChangePassword`, `tempPasswordExpiresAt`, `lastLoginAt` | Index `(role, isActive)`. Sign-up tắt, không có tài khoản mặc định trong code |
| `Session` | `lastSeenAt`, `stepUpAt` | Index `userId`. Hết hạn tuyệt đối và idle do api kiểm, không do Better Auth |
| `Account` | `password` (scrypt, không bao giờ trả ra API) | Provider `credential`. Index `userId` |
| `Verification` | — | Shape bắt buộc của Better Auth, dự án chưa dùng |


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
  4. StepUpGuard               @RequireStepUp (chưa gắn route)
  ▼
Controller: /auth/*, /admin/users, /admin/audit-logs, /admin/settings
Express (ngoài guard Nest): /api/v1/admin/queues (bull-board, kiểm lại các bước trên)
```

Quy tắc chung:
- Ma trận quyền ở `@kamito/shared` dùng chung cho api và admin UI. Admin UI chỉ ẩn, api là nơi chặn.
- Vai trò, `isActive`, `mustChangePassword` đọc từ DB mỗi request. Đổi quyền có hiệu lực ngay, và thu hồi phiên khi đổi vai trò hoặc khóa.
- Ngưỡng đăng nhập, khóa, phiên, mật khẩu nằm ở `/settings` (`AppSetting`). Env chỉ giữ secret (`AUTH_SECRET`), URL (`ADMIN_PUBLIC_URL` cho Origin), và `TRUST_PROXY_HOPS`.
- Ghi audit cho mọi thay đổi user, setting, mật khẩu, và phiên. Xem danh sách action trong [auth-and-rbac.md](./auth-and-rbac.md#api-quản-trị).

## Dịch vụ dùng chung trong api

| Dịch vụ | File | Hành vi |
|---|---|---|
| Config | `common/config/env-schema.ts`, `app-config.module.ts` | Symbol `API_ENV`. Schema zod toàn cục, global module |
| Logger | `common/logger/logger.module.ts` | pino JSON. Request ID, redact theo danh sách trong `LOG_REDACT_PATHS` |
| Error filter | `common/filters/http-exception.filter.ts` | Mọi lỗi trả `{error:{code,message,fields?}}`. Lỗi không phải HttpException → 500 `INTERNAL_ERROR` |
| Pagination | `common/pagination/pagination-query.ts`, `pagination-limits.ts` | Whitelist sort/filter. `pageSize` mặc định lấy từ `list.defaultPageSize` (`/settings`), trần từ env `PAGINATION_MAX_PAGE_SIZE`. `page` tối đa 10 000. Xem [code-standards.md](./code-standards.md#quy-ước-api) |
| Request context | `common/audit/request-context.ts` | Middleware trên mọi route. `AsyncLocalStorage` giữ `requestId`, `ip`, `userAgent`. `SessionGuard` điền `userId`, `sessionId` |
| AuditService | `common/audit/audit.service.ts` | `record(entry, tx?)`. Actor = `USER` nếu có userId, ngược lại `SYSTEM`. Ghi `before`/`after` sau khi mask |
| PII mask | `common/audit/mask-pii.ts` | Khớp chuỗi con trên khóa, không phân biệt hoa thường. Đệ quy, tối đa 20 cấp. Không sửa object gốc |
| Auth | `modules/auth/auth-instance.ts`, `auth-raw-handler.ts`, `session-resolver.service.ts`, `auth-guards.ts` | Better Auth 1.7.21 (không dùng plugin admin). Raw handler chỉ 2 route. Phiên đọc từ DB mỗi request |
| Login throttling | `modules/auth/login-ip-rate-limiter.service.ts`, `account-lockout.service.ts` | Redis, key có `QUEUE_PREFIX`, email băm. Fail-open khi Redis lỗi |
| Access control | `modules/access-control/` | `@Public`, `@RequireSession`, `@RequirePermission`, `PermissionGuard` |
| Origin check | `common/security/trusted-origin.ts` | `TrustedOriginMiddleware` cho ghi dưới `admin/*`, `auth/*`. Dùng lại trong bull-board |
| Users | `modules/users/` | CRUD user (không xóa), reset mật khẩu, thu hồi phiên, ràng buộc ADMIN cuối |
| Settings | `modules/settings/` | `AppSettingsService`: đọc (cache 10 giây), sửa, reset, audit |
| Audit log (đọc) | `modules/audit-logs/` | Chỉ GET. Lọc theo actor, entity, action (tiền tố), khoảng thời gian |
| Bull-board | `modules/queue/bull-board-mount.ts` | UI hàng đợi trên Express, guard theo phiên và quyền `queues` |
| CLI | `cli/create-admin.ts` | Tạo hoặc khôi phục ADMIN đầu tiên, xác nhận DB target trước khi ghi |
| Prisma | `modules/prisma/prisma.service.ts` | `PrismaClient` + `@prisma/adapter-pg`. Đóng kết nối khi tắt |
| Redis | `modules/queue/redis-connection.provider.ts` | `enableOfflineQueue: false`: lệnh lỗi ngay khi Redis mất. Chờ ready tối đa 5 giây lúc boot. Dùng chung cho queue, bull-board, và khóa đăng nhập |
| Eviction check | `modules/queue/redis-eviction-policy-check.ts` | Kết nối riêng ngắn hạn (`redis-probe`) để đọc `CONFIG GET maxmemory-policy` |
| S3 | `modules/storage/s3-client.provider.ts` | `@aws-sdk/client-s3`, `forcePathStyle` theo `S3_FORCE_PATH_STYLE` |

Kiểm tra prefix queue: `isQueuePrefixValid` trong `@kamito/shared`. Dạng hợp lệ là `kamito-tt:<APP_ENV>` (có thể thêm đoạn sau). `APP_ENV` gồm `development`, `test`, `staging`, `production`.

## Packages dùng chung

| Package | Export chính | Ghi chú |
|---|---|---|
| `@kamito/db` | `PrismaClient` (generated), `buildPrismaClientOptions`, `createPrismaClient`, `findPendingMigrations`, `listBundledMigrations`, `bundledMigrationsDir` | Build chạy `prisma generate` trước `tsc` |
| `@kamito/shared` | `parseEnv`, `appEnvSchema`, `requiredString`, `secretString`, `csvList`, `PaginatedResult`, `QueueName`, `isQueuePrefixValid`, `appSettingRegistry`, `authSettings`, `listSettings`, `APP_SETTING_GROUPS`, `judgeEvictionPolicy`, `PERMISSION_MATRIX`, `can`, `permissionsFor`, `USER_ROLES`, `isUserRole` | `redis-probe` là subpath riêng vì dùng ioredis. Ma trận quyền dùng cho cả api và admin |
| `@kamito/ui-tokens` | `tokens`, `buildCssVariables`, `buildCssText` (root); `buildAntdTheme`, `antdTheme` (subpath `./antd-theme`) | `tokens.ts` là nguồn duy nhất. Build sinh `dist/tokens.css` |
| `@kamito/config` | `tsconfig.base.json`, `tsconfig.node.json`, `eslint.config.mjs`, `vitest-preset` | Preset Vitest: `src/**/*.test.ts`, `test/**/*.spec.ts` |

Token mặc định (màu đỏ logo `#EC1E24`, navy `#0F285D`, font Archivo) đang chờ brand guideline. Đổi màu = sửa một file.

## Chưa xây dựng

| Hạng mục | Phase | Trạng thái |
|---|---|---|
| `packages/competition-engine` (bracket, seeding, round robin) | 06–07 | Chưa có |
| `packages/ranking-engine` (điểm, snapshot) | 09 | Chưa có |
| BullMQ processor và đăng ký queue | Phase sau | Chưa có processor. `bullmq` chỉ api dùng (bull-board). Worker chưa dùng BullMQ |
| Queue nghiệp vụ | Phase sau | Chỉ có `maintenance` trong `QueueName`, chưa có job |
| Auth và RBAC | 03 | Đã có (xem [Xác thực và phân quyền](#xác-thực-và-phân-quyền-phase-03)). Còn việc mở, liệt kê trong [auth-and-rbac.md](./auth-and-rbac.md#giới-hạn-đã-biết) |
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
| 13 | Better Auth không dùng plugin admin. Chỉ 2 route (`sign-in/email`, `sign-out`) đi qua handler raw, phần còn lại qua Nest | Allowlist chính xác, route mới mặc định bị chặn. Plugin admin không cần cho mô hình 2 vai trò |
| 14 | Phân quyền deny-by-default ở guard toàn cục; ma trận quyền một nguồn cho api và admin UI | Route quên khai báo quyền vẫn bị chặn. UI không phải lớp bảo vệ |
| 15 | Vai trò, `isActive`, `mustChangePassword` đọc từ DB mỗi request | Đổi quyền và khóa tài khoản có hiệu lực ngay, không chờ hết phiên |
| 16 | Tham số đăng nhập, phiên, mật khẩu, phân trang nằm ở `/settings` (`AppSetting`) | Theo luật dự án: đổi được trên giao diện, không cần redeploy. Env chỉ còn secret, URL, và trần an toàn |
| 17 | Admin dùng Refine + antd, phân quyền UI qua `accessControlProvider` cùng ma trận của api | Refine cho list, form, và router. Quyền vẫn do api quyết định |

Lưu ý về mục 7 và 8: nguồn gốc là phase 01 và ghi nhận của chủ repo. Chưa đối chiếu lại trong lần viết này.

## Liên quan

- [code-standards.md](./code-standards.md): tiêu chuẩn code, migration, quy ước API.
- [deployment-guide.md](./deployment-guide.md): compose, biến môi trường, quy trình phát hành.
- [auth-and-rbac.md](./auth-and-rbac.md): đăng nhập, phân quyền, cài đặt vận hành.
- [project-changelog.md](./project-changelog.md) và [development-roadmap.md](./development-roadmap.md): lịch sử và trạng thái phase.
