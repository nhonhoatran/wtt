# Code Standards — Kamito

> Cập nhật: 2026-11-12 · Phạm vi: phase 01 (monorepo, api, worker, client, admin, packages) và phase 03 (auth, RBAC, users, /settings, nhật ký, khung admin).
> Nguồn đối chiếu: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `packages/*/package.json`, `apps/*/package.json`, `.editorconfig`, `.gitignore`.
> Mô tả kiến trúc xem [system-architecture.md](./system-architecture.md); quy trình triển khai xem [deployment-guide.md](./deployment-guide.md).

## Contents
- [Toolchain đã ghim](#toolchain-đã-ghim)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Module và TypeScript](#module-và-typescript)
- [Đặt tên](#đặt-tên)
- [Kích thước file và comment](#kích-thước-file-và-comment)
- [Cấu hình và biến môi trường](#cấu-hình-và-biến-môi-trường)
- [Database và migration](#database-và-migration)
- [Quy ước API](#quy-ước-api)
- [Worker và queue](#worker-và-queue)
- [Frontend](#frontend)
- [Kiểm thử](#kiểm-thử)
- [Git và commit](#git-và-commit)
- [Thư viện mới](#thư-viện-mới)

## Toolchain đã ghim

| Thành phần | Phiên bản | Nơi khai báo |
|---|---|---|
| Node.js (dev) | 24.15.0 | `setup-node` trong `.github/workflows/ci.yml`; `engines.node >=24.0.0` |
| Node.js (image) | `node:24.22.3-alpine3.23` | `ARG NODE_IMAGE` trong `docker/*.Dockerfile` |
| pnpm | 11.3.0 | `packageManager` trong `package.json` |
| Turborepo | 2.11.10 | `devDependencies` root |
| TypeScript | 6.0.3 | root + mọi package |
| NestJS | 12.3.2 | `apps/api/package.json` |
| Better Auth | 1.7.21 | `apps/api/package.json` (không dùng plugin admin) |
| BullMQ + bull-board | 6.5.1 / 9.10.5 | `apps/api/package.json` (chỉ api; worker chưa dùng) |
| Prisma + adapter | 7.10.1 | `packages/db/package.json` (`prisma`, `@prisma/client`, `@prisma/adapter-pg`) |
| Next.js / React | 16.4.3 / 19.3.1 | `apps/client/package.json` |
| Vite / antd | 8.3.5 / 5.29.3 | `apps/admin/package.json` |
| Refine | core 5.0.12, antd 6.0.3, router 2.0.4 | `apps/admin/package.json` |
| react-router | 7.18.5 | `apps/admin/package.json` |
| Vitest | 5.0.5 | `apps/api`, `apps/worker`, `packages/shared`, `packages/ui-tokens` |
| zod | 4.6.7 | api, worker, shared |
| ioredis | 6.0.0 | api, worker, shared |
| PostgreSQL (dev) | 17.11 | `docker-compose.dev.yml` |
| Redis (dev) | 8.2.11 | `docker-compose.dev.yml` |
| S3-compatible (dev) | RustFS 1.0.4 | `docker-compose.dev.yml` |

Quy ước:
- Phụ thuộc ghim bản chính xác (không `^`, `~`). CI và Docker dùng `pnpm install --frozen-lockfile`.
- Chọn bản đã phát hành ít nhất khoảng 2 tuần thay vì thêm exclude cho bản mới. Repo chưa có `minimumReleaseAge` trong `pnpm-workspace.yaml` (kiểm 2026-11-12).
- Build script chỉ được chạy cho package có trong `allowBuilds` của `pnpm-workspace.yaml`: `prisma`, `@prisma/engines`, `@swc/core`.
- TypeScript 7 (native) chưa thử. Lý do: chưa kiểm chứng việc emit decorator metadata cho Nest. Xem lại sau.

## Cấu trúc thư mục

```
apps/
  api/        NestJS 12 (Express 5). REST /api/v1/{admin,public,auth}
    src/      main.ts, bootstrap-app.ts, app.module.ts
              common/{config,logger,filters,pagination,audit,security,validation}/
              modules/{health,prisma,storage,queue}/   (phase 01)
              modules/{auth,access-control,users,settings,audit-logs}/   (phase 03)
              cli/      create-admin.ts (chạy tay, không nằm trong luồng HTTP)
    test/     *.e2e-spec.ts (dùng dependency thật), support/
  worker/     Node + ioredis. Health HTTP nội bộ. Chưa có processor.
    src/      main.ts, worker-env.ts, redis-eviction-guard.ts, worker-health-server.ts
  client/     Next.js App Router. Segment [locale], i18n vi/en.
  admin/      Vite + React + antd + Refine. Runtime config từ /config.json.
    src/      main.tsx, app.tsx, runtime-config.ts
              api/ (http-client), providers/ (auth, access control, data, current-user)
              components/ (require-access, list-filter-bar, step-up-modal, temp-password-modal)
              layout/ (admin-layout, menu-groups), pages/ (login, change-password, settings, role home)
              resources/{users,audit-logs}/, i18n/vi.ts
    test/     *.test.mjs (node:test)
packages/
  config/     tsconfig.base.json, tsconfig.node.json, eslint.config.mjs, vitest-preset
  db/         prisma/schema/*.prisma, prisma/migrations/, prisma.config.ts, src/
  shared/     pagination, queue-names, app-setting-registry, auth-settings, list-settings,
              permissions, user-role, env-validation, redis-eviction-policy, redis-probe
  ui-tokens/  tokens.ts -> tokens.css, antd-theme.ts
docker/       Dockerfile x4, admin-nginx.conf, admin-api-proxy.conf, admin-security-headers.conf,
              admin-entrypoint.sh, migrate-entrypoint.sh
scripts/      print-db-target.mjs (+ test)
docs/         tài liệu dự án
```

Chưa có: `packages/competition-engine`, `packages/ranking-engine` (phase 06–09).

## Module và TypeScript

- Mọi package và app là ESM: `"type": "module"`. Nest 12 chỉ có ESM.
- `packages/config/tsconfig.node.json`: `module` và `moduleResolution` đều là `NodeNext`; `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `isolatedModules`.
- Import tương đối trong TypeScript của api/worker/shared kết thúc bằng `.js`, ví dụ `import { AppModule } from './app.module.js'`.
- API bật `experimentalDecorators` và `emitDecoratorMetadata` (`apps/api/tsconfig.json`). Nest DI cần metadata này.

## Đặt tên

| Đối tượng | Quy ước | Ví dụ |
|---|---|---|
| File | kebab-case, tên nói rõ mục đích | `redis-eviction-policy-check.ts`, `audit.service.ts` |
| Unit test | `*.test.ts` (api, shared, ui-tokens), `*.test.mjs` (admin, scripts) | `mask-pii.test.ts` |
| E2E | `*.e2e-spec.ts` trong `apps/api/test/` | `health.e2e-spec.ts` |
| Class / Nest provider | PascalCase, hậu tố theo loại | `AuditService`, `HealthLiveController`, `PrismaService` |
| Symbol DI | UPPER_SNAKE | `API_ENV`, `REDIS_CONNECTION`, `S3_CLIENT` |
| Biến môi trường | UPPER_SNAKE | `QUEUE_PREFIX`, `S3_FORCE_PATH_STYLE` |
| Model / field Prisma | PascalCase model, camelCase field | `AuditLog.actorType`, `AppSetting.updatedById` |
| Enum Prisma | PascalCase, giá trị UPPER_SNAKE | `AuditActorType.USER` |
| Migration | `YYYYMMDDHHMMSS_snake_name` do Prisma sinh | `20261112015704_init_app_settings_audit_log` |
| Queue name | camelCase giá trị trong `QueueName` | `QueueName.Maintenance = 'maintenance'` |
| Redis key | `QUEUE_PREFIX` + `:` + phần khóa (quy ước phase 01; hiện chưa có queue nào dùng) | `kamito-tt:production:...` |
| Action audit | `<entity>.<hành động>` | `match.result.confirm` |

## Kích thước file và comment

- Mỗi file code dưới 200 dòng. Vượt thì tách module hoặc hàm tiện ích.
- Comment bằng tiếng Anh, ít. Chỉ viết khi cần giải thích **vì sao** (ràng buộc, workaround, hành vi bất ngờ).
- Không comment lại điều code đã nói rõ. Không viết docstring cho hàm đơn giản.
- Không comment kiểu chia khu hoặc kể lịch sử sửa đổi.
- Tài liệu (`docs/`) viết tiếng Việt. Commit message viết tiếng Anh.
- `.editorconfig`: UTF-8, LF, 2 space, có newline cuối file.

## Cấu hình và biến môi trường

- **Validate lúc boot.** API và worker parse env bằng zod (`parseEnv` trong `@kamito/shared`). Thiếu hoặc sai thì dừng, báo **tên biến và lý do**, không in giá trị.
- **Secret:** tối thiểu 32 ký tự. Giá trị bắt đầu bằng `replace-with` hoặc `change-me` bị từ chối. `AUTH_SECRET`, `REVALIDATE_SECRET`, `SSR_INTERNAL_SECRET`, `IP_HASH_SALT` phải khác nhau (api kiểm trong `env-schema.ts`).
- **Giá trị nghiệp vụ không hard-code.** Giá trị admin có thể đổi (tên site, ngưỡng, khung thời gian...) đi vào bảng `AppSetting`. Mỗi key khai báo trong registry `packages/shared/src/app-setting-registry.ts` với zod schema và default.
- **Tham số vận hành** (ngưỡng đăng nhập, khóa tạm, phiên, mật khẩu, page size) cũng đi vào `AppSetting`, sửa ở `/settings`. Key khai báo bằng `defineNumberSetting` (`auth-settings.ts`, `list-settings.ts`) kèm khoảng min/max và mặc định. Danh sách đầy đủ: [auth-and-rbac.md](./auth-and-rbac.md#cài-đặt-vận-hành-settings).
- **Tham số kỹ thuật** (timeout, concurrency, trần an toàn) đi vào env. Giá trị mặc định nằm trong code khi biến là tùy chọn. Env hiện có `PAGINATION_MAX_PAGE_SIZE` và `QUERY_MAX_LENGTH` làm trần cứng cho phân trang.
- **Không có giá trị kết nối trong code hay compose.** `.env.example` chỉ chứa placeholder. Danh sách biến theo service xem [deployment-guide.md](./deployment-guide.md#biến-môi-trường-theo-service).
- **`.env` không được commit** (`.gitignore`). Gitleaks chạy trong CI.
- **Khi lệnh có đụng database:**
  - Không tự truyền `DATABASE_URL` bịa ra. Để script đọc `.env`.
  - Chạy `pnpm db:print-target` trước để in `host:port/database` (mật khẩu được ẩn).
  - Xác nhận target đúng môi trường rồi mới chạy migration hoặc truy vấn.
  - Không lấy giá trị từ dòng đã comment `#` trong `.env`. Khi grep, neo đầu dòng: `^DATABASE_URL=`.

## Database và migration

- Schema tách theo domain trong `packages/db/prisma/schema/*.prisma`. Generator `prisma-client` xuất ra `packages/db/src/generated/prisma` (gitignored), `moduleFormat = "esm"`.
- Prisma 7 không tự nạp `.env`. `prisma.config.ts` đọc `.env` ở root qua `dotenv`.
- Kết nối luôn qua driver adapter. Dùng `buildPrismaClientOptions` (hoặc `PrismaService` trong api), không `new PrismaClient()` trần.
- **Cấm `prisma db push`** (kể cả script `db:push`). Mọi thay đổi schema đi qua migration:
  1. Sửa `*.prisma`.
  2. `pnpm --filter @kamito/db exec prisma migrate dev --create-only --name <snake_name>`.
  3. Đọc SQL sinh ra, không tự ý sửa migration đã tạo.
  4. Áp dụng: `migrate dev` ở DB local; `migrate deploy` ở staging và production.
  5. `pnpm --filter @kamito/db exec prisma generate` (hoặc `pnpm build`).
- **Migration tương thích ngược:**
  - Chỉ thêm: bảng mới, cột nullable hoặc có default, index.
  - Bước phá hủy (xóa hoặc đổi tên cột, thêm NOT NULL không default) để sang release sau, khi không còn code dùng.
  - Migration phải chạy được trước code cần nó.
- Không sửa migration đã áp dụng ở bất kỳ môi trường nào. Sai thì tạo migration mới.
- Migration được track trong git. Danh sách migration đi kèm image: `packages/db/src/migration-state.ts` (`listBundledMigrations`).
- Kiểm tra migration chờ áp dụng: `findPendingMigrations(prisma)` trong `@kamito/db`. API dùng hàm này lúc boot và ở `/api/v1/health/ready`.

## Quy ước API

- Global prefix `api/v1` (`API_GLOBAL_PREFIX`). Route nội bộ nằm dưới `/api/v1/{admin,public,auth}`, health dưới `/api/v1/health/*`.
- Thư mục: `common/` cho hạ tầng dùng chung, `modules/<feature>/` cho nghiệp vụ.
- **Lỗi** trả về một dạng duy nhất:
  ```json
  { "error": { "code": "INVALID_QUERY", "message": "Invalid pagination query", "fields": { "page": "..." } } }
  ```
  `fields` chỉ có khi lỗi validate từng trường. Lỗi 500 luôn trả `INTERNAL_ERROR`, không lộ chi tiết.
- **Lỗi validate dữ liệu** (body) trả 422 `VALIDATION_FAILED`, `fields` theo từng trường (`parseBody`, `fieldError`). Lỗi query danh sách trả 400 `INVALID_QUERY`.
- **Danh sách** dùng `parsePaginationQuery(raw, rules, limits)` (`common/pagination/pagination-query.ts`). `limits` lấy từ `PaginationLimitsService`:
  - `page` ≥ 1, tối đa 10 000.
  - `pageSize` mặc định lấy từ setting `list.defaultPageSize` (20, khoảng 5–100, sửa ở `/settings`). Trần cứng là env `PAGINATION_MAX_PAGE_SIZE` (mặc định 100).
  - `sort=field:asc|desc`: field phải nằm trong whitelist của resource.
  - `q`: tối đa `QUERY_MAX_LENGTH` ký tự.
  - `filter[key]`: key phải nằm trong whitelist. Key lạ trả 400.
  - Lọc, sắp xếp, phân trang chạy ở server. Response: `{ data, total, page, pageSize }`.
- **Request ID:** nhận `x-request-id` nếu khớp `^[A-Za-z0-9._-]{1,64}$`, không thì sinh UUID mới. Luôn trả lại trong header response.
- **Proxy:** `app.set('trust proxy', TRUST_PROXY_HOPS)`. Không đọc `X-Forwarded-For` ngoài số hop đã khai.
- **Ghi audit:** mọi thay đổi dữ liệu nghiệp vụ gọi `AuditService.record(entry, tx)`, truyền transaction client để bản ghi audit cùng commit với thay đổi. Không truyền `tx` thì audit ghi ngoài transaction.
- **PII trong audit:** `maskPii` thay giá trị bằng `***` cho khóa chứa `phone`, `email`, `birth`, `dob`, `address`, `cccd`, `idnumber`, `password`, `token`, `secret`, `apikey`, `authorization`, `cookie` (so khớp chuỗi con, không phân biệt hoa thường). Giá trị `null` giữ nguyên.
- **Log:** pino JSON. Redact `req.headers.authorization`, `req.headers.cookie`, `x-internal-secret`, `set-cookie`, `*.password`, `*.secret`, `*.token`. Không log request health.

## Worker và queue

- BullMQ bắt buộc `maxmemory-policy noeviction` trên Redis. Redis dùng chung làm cache có eviction sẽ mất job.
- Mọi khóa Redis và tên queue có tiền tố `QUEUE_PREFIX`, dạng `kamito-tt:<APP_ENV>[:...]`. Prefix sai thì api và worker không khởi động.
- **Job payload chỉ chứa id.** Processor nạp lại bản ghi từ DB, kiểm trạng thái, rồi mới làm việc. Không tin dữ liệu trong payload.
- Tên queue khai trong `packages/shared/src/queue-names.ts`.
- BullMQ chưa là dependency (kiểm 2026-11-12). Khi thêm, kiểm license và mức bảo trì trước.

## Frontend

- **Client (Next.js):**
  - App Router, mọi trang nằm dưới `src/app/[locale]/`. Locale hợp lệ: `vi`, `en` (`src/i18n/locales.ts`). Mặc định `vi`.
  - Danh sách, tìm kiếm, lọc, phân trang: render ở server (Server Component + `searchParams`). Không tải toàn bộ dữ liệu về trình duyệt rồi lọc bằng JS.
  - `next.config.ts` dùng `output: 'standalone'`, `outputFileTracingRoot` là root monorepo.
- **Admin (Vite + React + antd):**
  - Không đọc URL từ biến build-time. Đọc `/config.json` lúc chạy (`runtime-config.ts`). Container sinh file này khi start.
  - Chỉ gọi `/api/v1/admin/*` và `/api/v1/auth/*` (cùng khớp với proxy trong `vite.config.ts` và nginx).
- **Design token:** sửa màu, bo góc, khoảng cách ở `packages/ui-tokens/src/tokens.ts`. Không hard-code hex trong component.
  - `tokens.css` sinh bởi `scripts/write-tokens-css.mjs` lúc build. Client import qua `@kamito/ui-tokens/tokens.css`.
  - Theme antd lấy từ `@kamito/ui-tokens/antd-theme`.
  - Màu theo hạng giải hoặc loại giải là dữ liệu động, không phải token.

## Kiểm thử

| Khu vực | Công cụ | Lệnh | Ghi chú |
|---|---|---|---|
| api, worker, shared, ui-tokens | Vitest 5 | `pnpm test` (qua turbo) | Không dùng Jest |
| api (Nest) | Vitest + `unplugin-swc` | `pnpm --filter @kamito/api test` | SWC để giữ decorator metadata; esbuild không làm được |
| api e2e | Vitest, `apps/api/test/*.e2e-spec.ts` (13 file) | như trên | Dùng dependency thật từ `.env` ở root, **không mock**. Đã chạy 2026-11-12 (pass) |
| admin | `node --test` | `pnpm --filter @kamito/admin test` | Kiểm allowlist của `docker/admin-entrypoint.sh` |
| scripts | `node --test` | `pnpm test` (root) | `scripts/*.test.mjs` |
| migration | Prisma CLI | `prisma migrate deploy` trên DB test | CI chạy trên Postgres service container |

Quy tắc:
- E2E cần dependency dev đang chạy (`docker-compose.dev.yml`). CI có service container Postgres 17.11, Redis 8.2.11 và RustFS 1.0.4.
- `vitest.config.ts` của api nạp `../../.env` nếu có. CI đặt env trực tiếp.
- Không mock để qua build. Test lỗi phải kiểm lỗi thật.
- Turbo đã tắt cache cho `test` và `dev` (`turbo.json`).
- CI chạy: `pnpm audit --audit-level high`, gitleaks, `lint`, `typecheck`, `test`, `build`, build 5 Docker target và smoke test admin. Kiểm tra `db push` trong `package.json`.

Lint: ESLint 10 (flat config). `apps/api`, `apps/admin`, `apps/client` có `eslint.config.mjs`. `typescript-eslint` 8.72.1 khai trong `@kamito/config`.

## Git và commit

- Commit message tiếng Anh, conventional commit: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`. Không nhắc tới AI.
- Ví dụ:
  ```
  feat: add audit log service with PII masking
  fix: reject placeholder secrets at boot
  ```
- Repo có 6 commit cục bộ (`git log`, mới nhất `ecfdb2f`, 2026-11-12) và **chưa có remote** (`git remote -v` trống, kiểm 2026-11-12). Code phase 03 chưa commit.
- Đã chốt 2026-11-12: chỉ commit cục bộ, push khi kết thúc dự án. Trước khi thêm remote, xác nhận lại tài khoản GitHub, email commit, tên repo.
- Tài khoản dự kiến cho repo này: `midomax-hoa`, SSH host alias `github.com` (chưa thêm remote, chưa xác nhận lại). Không dùng URL HTTPS. Email commit đặt bằng `git config user.email` mức repo, không đặt `--global`.
- Không commit `.env`, `packages/db/src/generated/`, `dist/`, `.next/`, `.turbo/`, `coverage/`.

## Thư viện mới

Trước khi dùng thư viện lần đầu:
1. Kiểm license (ghi rõ trong PR hoặc tài liệu liên quan).
2. Kiểm repo còn được bảo trì (commit gần đây, issue được xử lý).
3. Đọc doc chính thức của đúng phiên bản đã ghim. Không suy từ trí nhớ.
4. Với chức năng lớn (sửa Office, ký số, chat, BI, workflow, PDF...), tìm giải pháp tự host hoặc tích hợp có sẵn trước khi tự viết.

## Liên quan

- [system-architecture.md](./system-architecture.md): thành phần, luồng mạng, luồng khởi động.
- [deployment-guide.md](./deployment-guide.md): môi trường, compose, quy trình phát hành, sao lưu.
- [auth-and-rbac.md](./auth-and-rbac.md): đăng nhập, phân quyền, cài đặt vận hành.
