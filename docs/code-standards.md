# Code Standards — Kamito

> Cập nhật: 2026-11-12 · Phạm vi: phase 01 (monorepo, api, worker, client, admin, packages), phase 03 (auth, RBAC, users, /settings, nhật ký, khung admin), phase 04 (danh mục, giải, ảnh, sanitizer).
> Nguồn đối chiếu: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `packages/*/package.json`, `apps/*/package.json`, `.editorconfig`, `.gitignore`, `apps/api/src/common/*`, `apps/worker/src/*`.
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
- [Danh mục, danh sách và xóa (phase 04)](#danh-mục-danh-sách-và-xóa-phase-04)
- [URL và rich text (phase 04)](#url-và-rich-text-phase-04)
- [Worker và queue](#worker-và-queue)
- [Nghiệp vụ VĐV và import (phase 05)](#nghiệp-vụ-vđv-và-import-phase-05)
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
| BullMQ | 6.5.1 | `apps/api` (producer, bull-board), `apps/worker` (processor) |
| bull-board | 9.10.5 | `apps/api/package.json` |
| sharp | 0.35.5 | `apps/api`, `apps/worker` (xử lý ảnh) |
| sanitize-html | 2.18.1 | `apps/api` (rich text giải) |
| Prisma + adapter | 7.10.1 | `packages/db/package.json` (`prisma`, `@prisma/client`, `@prisma/adapter-pg`) |
| Next.js / React | 16.4.3 / 19.3.1 | `apps/client/package.json` |
| Vite / antd | 8.3.5 / 5.29.3 | `apps/admin/package.json` |
| Refine | core 5.0.12, antd 6.0.3, router 2.0.4 | `apps/admin/package.json` |
| react-router | 7.18.5 | `apps/admin/package.json` |
| TipTap | 3.33.1 (`react`, `starter-kit`, `extension-link`, `pm`) | `apps/admin/package.json` (ô soạn rich text) |
| Vitest | 5.0.5 | `apps/api`, `apps/worker`, `packages/shared`, `packages/ui-tokens` |
| zod | 4.6.7 | api, worker, shared |
| ioredis | 6.0.0 | api, worker, shared |
| PostgreSQL (dev) | 17.11 | `docker-compose.dev.yml` |
| Redis (dev) | 8.2.11 | `docker-compose.dev.yml` |
| S3-compatible (dev) | RustFS 1.0.4 | `docker-compose.dev.yml` |

Quy ước:
- Phụ thuộc ghim bản chính xác (không `^`, `~`). CI và Docker dùng `pnpm install --frozen-lockfile`.
- Chọn bản đã phát hành ít nhất khoảng 2 tuần thay vì thêm exclude cho bản mới. Repo chưa có `minimumReleaseAge` trong `pnpm-workspace.yaml` (kiểm 2026-11-12).
- Build script chỉ được chạy cho package có trong `allowBuilds` của `pnpm-workspace.yaml`: `prisma`, `@prisma/engines`, `@swc/core`. Kiểm lại khi thêm `sharp` lên image: sharp dùng binary prebuilt, chưa kiểm chứng trên Alpine (xem [deployment-guide.md](./deployment-guide.md#biến-môi-trường-theo-service)).
- TypeScript 7 (native) chưa thử. Lý do: chưa kiểm chứng việc emit decorator metadata cho Nest. Xem lại sau.

## Cấu trúc thư mục

```
apps/
  api/        NestJS 12 (Express 5). REST /api/v1/{admin,public,auth,media}
    src/      main.ts, bootstrap-app.ts, app.module.ts
              common/{config,logger,filters,pagination,audit,security,validation}/   (phase 01, 03)
              common/{crud,html,http}/   (phase 04: CatalogCrudService, list query, delete guard, sanitizer, body limit)
              modules/{health,prisma,storage,queue}/   (phase 01)
              modules/{auth,access-control,users,settings,audit-logs}/   (phase 03)
              modules/{tiers,event-types,categories,disciplines,match-formats,group-scoring-rules,venues}/   (phase 04: danh mục)
              modules/{events,sub-events,media}/   (phase 04)
              cli/      create-admin.ts (chạy tay, không nằm trong luồng HTTP)
    test/     *.e2e-spec.ts (dùng dependency thật), support/
  worker/     Node + ioredis + BullMQ. Health HTTP nội bộ. Media worker (queue `media`).
    src/      main.ts, worker-env.ts, redis-eviction-guard.ts, worker-health-server.ts
              media-worker.ts (khởi động worker, scheduler dọn), processors/ (process-image, cleanup)
  client/     Next.js App Router. Segment [locale], i18n vi/en.
  admin/      Vite + React + antd + Refine. Runtime config từ /config.json.
    src/      main.tsx, app.tsx, runtime-config.ts
              api/ (http-client), providers/ (auth, access control, data, current-user)
              components/ (require-access, list-filter-bar, step-up-modal, temp-password-modal,
                           confirm-action-button, media-upload-field, rich-text-field, slug-input)
              layout/ (admin-layout, menu-groups), pages/ (login, change-password, settings, role home,
                           event-hub/, settings-editors/)
              resources/{users,audit-logs,catalog-common,tiers,event-types,categories,disciplines,
                         match-formats,group-scoring-rules,events,venues}/, i18n/vi.ts
    test/     *.test.mjs (node:test)
packages/
  config/     tsconfig.base.json, tsconfig.node.json, eslint.config.mjs, vitest-preset
  db/         prisma/schema/*.prisma, prisma/migrations/, prisma/seed/, prisma.config.ts, src/
  shared/     pagination, queue-names, app-setting-registry, auth-settings, list-settings,
              tournament-settings, permissions, user-role, env-validation, redis-eviction-policy, redis-probe,
              slugify-vietnamese, lifecycle-from-dates, tiebreak-criteria, https-url,
              media/ (contract, storage-env), object-storage/ (local, s3, create-object-storage)
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
| File | kebab-case, tên nói rõ mục đích | `redis-eviction-policy-check.ts`, `audit.service.ts`, `media-image-processor.ts` |
| Unit test | `*.test.ts` (api, shared, ui-tokens), `*.test.mjs` (admin, scripts) | `mask-pii.test.ts` |
| E2E | `*.e2e-spec.ts` trong `apps/api/test/` | `health.e2e-spec.ts`, `media-upload.e2e-spec.ts` |
| Class / Nest provider | PascalCase, hậu tố theo loại | `AuditService`, `HealthLiveController`, `PrismaService`, `TiersService` |
| Symbol DI | UPPER_SNAKE | `API_ENV`, `REDIS_CONNECTION`, `OBJECT_STORAGE` |
| Biến môi trường | UPPER_SNAKE | `QUEUE_PREFIX`, `S3_FORCE_PATH_STYLE`, `STORAGE_DRIVER` |
| Model / field Prisma | PascalCase model, camelCase field | `AuditLog.actorType`, `AppSetting.updatedById`, `MediaAsset.incomingKey` |
| Enum Prisma | PascalCase, giá trị UPPER_SNAKE | `AuditActorType.USER`, `MediaStatus.AWAITING_UPLOAD` |
| Migration | `YYYYMMDDHHMMSS_snake_name` do Prisma sinh | `20261112015704_init_app_settings_audit_log` |
| Partial index (SQL) | `<Model>_<mô tả>` | `MatchFormat_single_default` |
| Queue name | camelCase giá trị trong `QueueName` | `QueueName.Media = 'media'`, `QueueName.Maintenance = 'maintenance'` |
| Job name | kebab-case | `process-image`, `cleanup-expired-intents` |
| Redis key | `QUEUE_PREFIX` + `:` + phần khóa | `kamito-tt:production:...` |
| Action audit | `<entityCamel>.<hành động>` (xem bên dưới) | `tier.create`, `subEvent.update`, `event.publish`, `media.complete` |

Action audit: danh mục dùng `auditPrefix` (`tier`, `eventType`, `matchFormat`...), giải dùng `event.*`, nội dung thi đấu `subEvent.*`, ảnh `media.*`. Entity ghi vào cột `entity` là tên model Prisma (`Tier`, `SubEvent`). Chuỗi action theo camelCase, khác với mẫu `match.result.confirm` trong ví dụ của [system-architecture.md](./system-architecture.md#dữ-liệu).

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
- **Giá trị nghiệp vụ không hard-code.** Giá trị admin có thể đổi (tên site, ngưỡng, khung thời gian, múi giờ mặc định...) đi vào bảng `AppSetting`. Mỗi key khai báo trong registry `packages/shared/src/app-setting-registry.ts` với zod schema và default.
- **Tham số vận hành** (ngưỡng đăng nhập, khóa tạm, phiên, mật khẩu, page size, thời gian chờ tải ảnh, trần kích thước ảnh) cũng đi vào `AppSetting`, sửa ở `/settings`. Key khai báo bằng `defineNumberSetting` (`auth-settings.ts`, `list-settings.ts`, `tournament-settings.ts`) kèm khoảng min/max và mặc định, hoặc `defineAppSetting` với zod schema và `editor`. Danh sách đầy đủ: [auth-and-rbac.md](./auth-and-rbac.md#cài-đặt-vận-hành-settings).
- **Tham số kỹ thuật** (timeout, concurrency, chu kỳ dọn, trần an toàn của hạ tầng) đi vào env. Giá trị mặc định nằm trong code khi biến là tùy chọn.
- **Không có giá trị kết nối trong code hay compose.** `.env.example` chỉ chứa placeholder. Danh sách biến theo service xem [deployment-guide.md](./deployment-guide.md#biến-môi-trường-theo-service).
- **`.env` không được commit** (`.gitignore`). Gitleaks chạy trong CI.
- **Khi lệnh có đụng database:**
  - Không tự truyền `DATABASE_URL` bịa ra. Để script đọc `.env`.
  - Chạy `pnpm db:print-target` trước để in `host:port/database` (mật khẩu được ẩn).
  - Xác nhận target đúng môi trường rồi mới chạy migration, seed hoặc truy vấn.
  - Không lấy giá trị từ dòng đã comment `#` trong `.env`. Khi grep, neo đầu dòng: `^DATABASE_URL=`.

### Settings hay env: hằng số giữ trong code có chủ đích

Phân loại:
- Admin quyết định, đổi không cần deploy → `AppSetting` (`/settings`). Nếu là giới hạn ảnh thì bị chặn bởi một trần env.
- Thuộc hạ tầng theo môi trường → env.
- Thiết kế của queue, thuật toán, hoặc trần an toàn của tiến trình → hằng số trong code. Đổi chúng là đổi kỹ thuật, cần review. Đây là ngoại lệ được phép theo luật dự án, nêu lý do ở bảng dưới.

| Hằng số | Giá trị | Nơi | Lý do giữ trong code |
|---|---|---|---|
| Số lần thử job ảnh và backoff | 3 lần; exponential từ 5 giây | `apps/api/src/modules/media/media-queue.ts` | Thiết kế retry của queue. Đổi phải kiểm lại hành vi khi lỗi tạm thời. Không phải tham số cho admin |
| Giữ job đã xong và job lỗi | 1000 job xong; job lỗi giữ 7 ngày | `media-queue.ts` | Giới hạn bộ nhớ Redis và thời gian debug trên bull-board |
| Giữ job dọn định kỳ | 10 job xong; 50 job lỗi | `apps/worker/src/media-worker.ts` | Chỉ để xem lịch sử gần nhất |
| Chất lượng WebP | 82 | `apps/worker/src/processors/media-image-processor.ts` | Đổi thì ảnh mới của mọi giải đổi chất lượng. Cần đo trước, không phải quyết định hằng ngày của admin |
| Trần điểm ảnh đầu vào | 40 triệu điểm ảnh | `media-image-processor.ts` | Chống decompression bomb làm cạn bộ nhớ sharp. Trần an toàn của tiến trình |
| Số dòng mỗi lượt dọn | 200 | `apps/worker/src/processors/media-intent-cleanup-processor.ts` | Giới hạn để một lượt quét không chiếm worker. Lượt sau xử lý tiếp |
| Bulk tạo nội dung thi đấu | tối đa 50 mục mỗi request | `apps/api/src/modules/sub-events/sub-event-dtos.ts` | Một request một transaction |
| Bulk tạo bàn | 1–100 bàn mỗi request | `apps/api/src/modules/venues/venue-dtos.ts` | Một request một transaction (ghi chú trong code) |
| Độ dài trường (tên 200, mã bàn 8, rich text 100 000 ký tự...) | theo từng DTO | `*-dtos.ts` | Ràng buộc với cột DB và giao diện, không phải chính sách |
| Trần body JSON | tính từ `MAX_INFO_BODY` | `apps/api/src/common/http/json-body-limit.ts` | Phải đủ cho hai trường rich text tối đa. Nginx admin đặt `2m`, cũng phải lớn hơn |

Giữ dạng env (chốt trong plan phase 04):

| Biến | Lý do |
|---|---|
| `UPLOAD_MAX_IMAGE_BYTES` | Trần cứng. Dùng cho api, worker và `client_max_body_size` của nginx admin. Setting `media.maxImageMegabytes` không được vượt trần này |
| `UPLOAD_ALLOWED_IMAGE_TYPES` | Chốt an toàn. Mở rộng sai là lỗ bảo mật |
| `MEDIA_IMAGE_VARIANT_WIDTHS` | Gắn với `srcset` của site công khai. Đổi theo bản deploy |
| `MEDIA_WORKER_CONCURRENCY`, `MEDIA_CLEANUP_INTERVAL_MINUTES` | Hạ tầng theo môi trường |
| `STORAGE_DRIVER`, `UPLOAD_LOCAL_DIR` | Chọn nơi lưu theo môi trường |

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
- **Partial unique index** (`WHERE "isDefault"`): Prisma không biểu diễn được `WHERE`, nên index nằm trong SQL migration. Khi sửa schema các model `MatchFormat` và `GroupScoringRule`, kiểm SQL sinh ra không có `DROP INDEX` cho `*_single_default`.
- Không sửa migration đã áp dụng ở bất kỳ môi trường nào. Sai thì tạo migration mới.
- Migration được track trong git. Danh sách migration đi kèm image: `packages/db/src/migration-state.ts` (`listBundledMigrations`).
- Kiểm tra migration chờ áp dụng: `findPendingMigrations(prisma)` trong `@kamito/db`. API dùng hàm này lúc boot và ở `/api/v1/health/ready`.
- **Seed danh mục mặc định:** `packages/db/prisma/seed/seed-config-defaults.ts`, chạy bằng `pnpm --filter @kamito/db seed:config`. Idempotent theo `code` hoặc `name`: dòng đã có được giữ nguyên, kể cả khi admin đã sửa. Seed import từ `dist/`, nên phải build `@kamito/db` trước. Chi tiết xem [deployment-guide.md](./deployment-guide.md#seed-danh-mục-mặc-định).

## Quy ước API

- Global prefix `api/v1` (`API_GLOBAL_PREFIX`). Route nội bộ nằm dưới `/api/v1/{admin,public,auth,media}`, health dưới `/api/v1/health/*`.
- Thư mục: `common/` cho hạ tầng dùng chung, `modules/<feature>/` cho nghiệp vụ.
- **Lỗi** trả về một dạng duy nhất:
  ```json
  { "error": { "code": "INVALID_QUERY", "message": "Invalid pagination query", "fields": { "page": "..." } } }
  ```
  `fields` chỉ có khi lỗi validate từng trường. Lỗi 500 luôn trả `INTERNAL_ERROR`, không lộ chi tiết.
- **Mã HTTP theo loại lỗi:**

  | Loại | HTTP | Ví dụ `code` |
  |---|---|---|
  | Query danh sách sai (sort, filter, `q`) | 400 | `INVALID_QUERY` |
  | Dữ liệu body sai, kể cả URL không phải https, slug trùng, mã trùng | 422 | `VALIDATION_FAILED`, `SLUG_TAKEN`, `DUPLICATE`, `SLUG_LOCKED` |
  | Đăng ký không hợp lệ theo luật (có `issues`) | 422 | `ENTRY_INELIGIBLE` |
  | Xung đột trạng thái: đang được dùng, mặc định, đã công bố, phiên tải ảnh, đã đăng ký, đã gộp | 409 | `IN_USE`, `IS_DEFAULT`, `EVENT_PUBLISHED`, `DEFAULT_CHANGED`, `INTENT_EXPIRED`, `ALREADY_ENTERED`, `SEED_TAKEN`, `PLAYER_MERGED`, `MERGE_RETRY`, `MERGE_CONFLICT`, `NOT_COMMITTABLE` |
  | Có quyền vào màn hình nhưng không đủ quyền cho một tham số (ghi đè chỉ ADMIN) | 403 | `OVERRIDE_FORBIDDEN`, `OVERRIDE_ADMIN_ONLY` |
  | File import: quá lớn, sai loại, rỗng | 413, 415, 422 | `PAYLOAD_TOO_LARGE`, `CONTENT_TYPE_MISMATCH`, `EMPTY_UPLOAD` |
  | Không tìm thấy | 404 | `EVENT_NOT_FOUND`, `TIER_NOT_FOUND` |

  Quy tắc: dữ liệu sai đã biết trước theo field → 422. Trạng thái hiện tại không cho phép → 409. Slug trùng là 422 (không phải 409) để form gắn lỗi vào field `slug`, kèm `suggestion` là slug còn trống.
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
- **Body JSON:** giới hạn tính từ `JSON_BODY_LIMIT` (`common/http/json-body-limit.ts`), không dùng mặc định 100 kB của Express. Tiếng Việt có dấu làm rich text vượt 100 kB sớm.

## Danh mục, danh sách và xóa (phase 04)

### Danh sách: một đường duy nhất

Mọi danh sách admin dùng `prismaListQuery` (`common/crud/prisma-list-query.ts`), mỗi module khai một `ListSpec`:

| Thành phần | Hành vi |
|---|---|
| `sortable` | Whitelist. `sort` ngoài danh sách → 400 `INVALID_QUERY`. Luôn có thêm `id asc` để thứ tự ổn định |
| `defaultSort` | Sắp xếp khi không có `sort` |
| `searchFields` | `q` → `contains`, không phân biệt hoa thường, nối bằng `OR` |
| `filters` | Converter cho từng `filter[key]`: `booleanFilter`, `enumFilter` (nhiều giá trị bằng dấu phẩy), `idFilter` (danh sách id). Key lạ → 400 |
| `findMany` + `count` | Trong một transaction, để `total` khớp đúng trang |

Ví dụ, rút gọn từ `apps/api/src/modules/tiers/tiers.service.ts`:

```ts
export const TIER_LIST_SPEC = {
  sortable: ['order', 'name', 'code', 'createdAt'],
  defaultSort: { field: 'order', direction: 'asc' },
  searchFields: ['code', 'name', 'nameEn'],
  filters: { isActive: booleanFilter('isActive') },
} as const;
```

Giải dùng cùng cơ chế, nhưng thêm `EVENT_LIST_RULES` với `filterable`: `eventTypeId`, `year`, `lifecycle`, `publishStatus`. Lọc `lifecycle` tính theo múi giờ từng giải (`lifecycle-filter.ts`).

### Danh mục: `CatalogCrudService`

Bảy danh mục (nhóm giải, hạng giải, nội dung chuẩn, nhóm tuổi/trình độ, thể thức trận, luật vòng bảng, địa điểm) dùng chung một base class `CatalogCrudService<Row>` (`common/crud/catalog-crud.ts`). Service con khai báo cấu hình và chỉ override khi cần:

```ts
export class TiersService extends CatalogCrudService<Tier> {
  protected readonly config: CatalogConfig = {
    entity: 'Tier',
    auditPrefix: 'tier',
    notFoundCode: 'TIER_NOT_FOUND',
    uniqueField: 'code',
    listSpec: TIER_LIST_SPEC,
  };
  protected delegate(db: Tx): CrudDelegate<Tier> {
    return db.tier;
  }
}
```

Các hook cần override:

| Hook | Dùng để |
|---|---|
| `prepare(tx, input, existing)` | Kiểm chéo field, kiểm ảnh đã `READY` (`assertReadyMedia`), chuẩn hóa dữ liệu ghi |
| `usage(tx, row)` | Đếm phụ thuộc. Trả về map `tên → hàm đếm`, có số > 0 thì chặn xóa |
| `assertDeletable(row)` | Chặn xóa theo quy tắc riêng. `MatchFormat` và `GroupScoringRule` chặn mục mặc định |
| `toView(row)` | Định dạng response |

Create, update, delete chạy trong transaction và ghi audit `<auditPrefix>.create|update|delete` cùng transaction.

### Xóa và 409

| Tình huống | HTTP | `code` | Ghi chú |
|---|---|---|---|
| Đang được dùng (đếm phụ thuộc > 0) | 409 | `IN_USE` | Kèm `dependants: { <tên>: <số> }` để UI hiện "đang dùng ở N nơi" |
| Phụ thuộc được tạo giữa lúc đếm và lúc xóa (FK P2003) | 409 | `IN_USE` | Lưới an toàn (`rethrowForeignKeyAsInUse`) |
| Xóa mục mặc định | 409 | `IS_DEFAULT` | `MatchFormat`, `GroupScoringRule` |
| Giải không phải nháp, hoặc đã có nội dung thi đấu | 409 | `IN_USE` | `dependants.subEvents` |
| Xóa nội dung thi đấu khi giải đã công bố | 409 | `EVENT_PUBLISHED` | Hủy công bố trước |
| Mặc định bị đổi giữa chừng | 409 | `DEFAULT_CHANGED` | Vi phạm partial unique index |

Quy ước UI (theo plan phase 04, cần đối chiếu lại trong giao diện): khi `IN_USE` thì hộp xác nhận hiện số phụ thuộc và nút **Ẩn** (`isActive = false`). Ẩn là cách chính để bỏ một mục đang dùng.

### Một mặc định duy nhất

`MatchFormat` và `GroupScoringRule` có cột `isDefault`. Có hai lớp bảo vệ:
1. Advisory lock (`lockDefault`, tên khóa trong `defaultLockName`) khi sửa và xóa, trong transaction.
2. Partial unique index `WHERE "isDefault"` trong SQL. Đây là lớp cuối cùng. Vi phạm → 409 `DEFAULT_CHANGED`.

Seed chỉ đặt mặc định khi chưa có mặc định nào.

### Mã trùng

- Mã (`code`) và các khóa unique khác: P2002 → 422 `DUPLICATE` gắn vào field (`uniqueField`).
- Slug giải: 422 `SLUG_TAKEN` với `suggestion`. Slug đã công bố không đổi được: 422 `SLUG_LOCKED`.

## URL và rich text (phase 04)

### URL https

`httpsUrlSchema` và `optionalHttpsUrlSchema` (`packages/shared/src/https-url.ts`) dùng cho `mapUrl` của địa điểm và `ticketUrl` của giải:
- Chỉ `https:`, có hostname, không có `user:pass@`.
- Tối đa 2048 ký tự. Không có khoảng trắng hoặc ký tự điều khiển.
- Chuỗi rỗng là xóa giá trị. Sai → 422 với `fields.<tên>`.

### Rich text: sanitize ở server

`infoBody` và `infoBodyEn` của giải được làm sạch bằng `sanitizeRichHtmlOrNull` (`common/html/sanitize-rich-html.ts`, dùng `sanitize-html` 2.18.1) **khi ghi**. Admin soạn bằng TipTap, xuất HTML, rồi API làm sạch.

Allowlist:

| Thành phần | Quy tắc |
|---|---|
| Thẻ | `p`, `br`, `strong`, `em`, `u`, `s`, `h2`, `h3`, `h4`, `ul`, `ol`, `li`, `blockquote`, `a`, `img`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `hr` |
| `a[href]` | Scheme `https:` hoặc `mailto:`. Chỉ `target="_blank"` được giữ, đi kèm `rel="noopener noreferrer nofollow"` |
| `img[src]` | Chỉ `https:`. `width` và `height` phải là số. Không có `src` hợp lệ thì bỏ cả thẻ `img` |
| Thẻ ngoài allowlist | Bỏ thẻ, giữ chữ bên trong (`disallowedTagsMode: 'discard'`, theo README sanitize-html 2.18.1) |
| Kết quả rỗng | Chuỗi chỉ có khoảng trắng hoặc thẻ rỗng → `null` |

Sanitize lại khi render là yêu cầu của site công khai (phase 08). Đó là lớp thứ hai, để allowlist đổi không làm dữ liệu cũ thành nguy hiểm.

## Worker và queue

- BullMQ bắt buộc `maxmemory-policy noeviction` trên Redis. Redis dùng chung làm cache có eviction sẽ mất job.
- Mọi khóa Redis và tên queue có tiền tố `QUEUE_PREFIX`, dạng `kamito-tt:<APP_ENV>[:...]`. Prefix sai thì api và worker không khởi động.
- **Job payload chỉ chứa id.** Processor nạp lại bản ghi từ DB, kiểm trạng thái, rồi mới làm việc. Không tin dữ liệu trong payload. Ví dụ: `process-image` chỉ mang `{ mediaId }`.
- Tên queue khai trong `packages/shared/src/queue-names.ts`: `media` (phase 04), `import` (phase 05), `maintenance` (chưa có job).
- **Job import** (`import`): job id gắn `attemptNo` (`imp-<id>-validate-<n>`, `imp-<id>-commit-<n>`). Job commit mang `attemptNo` trong payload. Worker bỏ qua job có `attemptNo` cũ hơn lượt hiện tại. Chi tiết xem [system-architecture](./system-architecture.md#queue-import).
- **Job id cố định khi cần chống trùng:** `media-<mediaId>`. Trước khi `add`, xóa job cũ cùng id (`queue.remove`), vì BullMQ bỏ qua `add` khi job cùng id còn tồn tại.
- **Retry:** job ảnh tối đa 3 lần, backoff exponential từ 5 giây. Lỗi tạm thời (storage, DB) để dữ liệu tạm cho lần sau. Hết lượt thử thì worker đặt trạng thái cuối (`FAILED`) và xóa dữ liệu tạm. Nếu worker chết giữa chừng, job dọn định kỳ đảm nhận.
- **Job lặp:** dùng `upsertJobScheduler` với id cố định (`media-intent-cleanup`), không dùng `setInterval`.
- BullMQ là dependency của `apps/api` và `apps/worker` (xem [Toolchain](#toolchain-đã-ghim)). Khi thêm queue mới, kiểm license và mức bảo trì như mục [Thư viện mới](#thư-viện-mới).

## Nghiệp vụ VĐV và import (phase 05)

- **Logic dùng chung nằm trong package, không copy giữa api và worker.**
  - `@kamito/db` (`packages/db/src/domain/`): định danh và mã VĐV, competitor, khóa (`lockSubEvent`, `lockPlayersForShare`, `advisoryLock`...), kiểm đăng ký.
  - `@kamito/shared`: hàm thuần (`normalizePersonName`, `ageOnEvent`, `checkEntryEligibility`), cột import (`ENTRY_IMPORT_COLUMNS`), định nghĩa setting.
  - Module Nest chỉ gọi các hàm này. Không viết lại trong service.
- **Thứ tự khóa là luật bắt buộc.** Advisory lock, rồi dòng `SubEvent` theo id tăng dần, rồi dòng `Player` theo id tăng dần. Đoạn code mới ghi entry hoặc Player phải tuân theo. Lấy khóa sai thứ tự có thể gây deadlock với gộp VĐV và commit import. Đọc lại dữ liệu sau khi đã có khóa, không đọc trước rồi mới khóa.
- **Kiểm tra trùng và sức chứa phải nằm dưới khóa.** Kiểm trước khi khóa rồi ghi là đua điều kiện. Ràng buộc DB (unique, CHECK) là lớp cuối. Lỗi P2002 được map theo tên index (`entry-errors.ts`), không map theo chuỗi thông báo. P2002 không khớp index đã biết được ném lại nguyên trạng.
- **Lỗi nghiệp vụ hợp lệ** trả 422 (hoặc 409 khi xung đột trạng thái), có mảng `issues` tùy chọn. Filter lỗi giữ nguyên `issues` và `fields` trong envelope `{ error: { code, message, ... } }`. Admin UI dùng `issues` để hiện lỗi ngay dưới ô liên quan. Mỗi issue có `code`, `message`, `overridable`, và `playerId` nếu có.
- **Ghi đè** (`overrideReason`) chỉ ADMIN được gửi, và chỉ bỏ qua issue `overridable`. Đăng ký tay lưu lý do vào `Entry.eligibilityOverrideReason`. Import lưu vào `ImportJob.overrideReason` và ghi audit `import.commit.request`.
- **Dữ liệu riêng tư** (SĐT, email, ngày sinh): API chỉ trả khi có `players.update` (`canSeePlayerPii`) ở danh sách và chi tiết VĐV. Lookup, export và dòng import không đưa các trường này vào select. Phần công khai (`GET /public/*`) sẽ có test serializer ở phase 08.
- **Đọc file Excel:** chỉ đọc qua stream và đếm byte thật. Không tin kích thước khai trong header zip. Mọi file từ người dùng đều được coi là không tin cậy. Chi tiết và giới hạn: [system-architecture](./system-architecture.md#giới-hạn-và-bảo-vệ-file-import).
- **Commit import idempotent.** Dòng `COMMITTED` không được xử lý lại. Lô được commit trong một transaction. Chạy lại sau lỗi không được tạo bản ghi trùng.

## Frontend

- **Client (Next.js):**
  - App Router, mọi trang nằm dưới `src/app/[locale]/`. Locale hợp lệ: `vi`, `en` (`src/i18n/locales.ts`). Mặc định `vi`.
  - Danh sách, tìm kiếm, lọc, phân trang: render ở server (Server Component + `searchParams`). Không tải toàn bộ dữ liệu về trình duyệt rồi lọc bằng JS.
  - `next.config.ts` dùng `output: 'standalone'`, `outputFileTracingRoot` là root monorepo.
- **Admin (Vite + React + antd):**
  - Không đọc URL từ biến build-time. Đọc `/config.json` lúc chạy (`runtime-config.ts`). Container sinh file này khi start.
  - Chỉ gọi `/api/v1/admin/*` và `/api/v1/auth/*`. Cùng khớp với proxy trong `vite.config.ts` và nginx.
  - Ô tải ảnh, ô rich text, ô slug, và hộp xác nhận hành động nguy hiểm là component dùng chung trong `components/`. Không viết lại trong từng resource.
- **Design token:** sửa màu, bo góc, khoảng cách ở `packages/ui-tokens/src/tokens.ts`. Không hard-code hex trong component.
  - `tokens.css` sinh bởi `scripts/write-tokens-css.mjs` lúc build. Client import qua `@kamito/ui-tokens/tokens.css`.
  - Theme antd lấy từ `@kamito/ui-tokens/antd-theme`.
  - Màu theo hạng giải hoặc loại giải là dữ liệu động (`colorHex` trong DB), không phải token.

## Kiểm thử

| Khu vực | Công cụ | Lệnh | Ghi chú |
|---|---|---|---|
| api, worker, shared, ui-tokens | Vitest 5 | `pnpm test` (qua turbo) | Không dùng Jest |
| api (Nest) | Vitest + `unplugin-swc` | `pnpm --filter @kamito/api test` | SWC để giữ decorator metadata; esbuild không làm được |
| api e2e | Vitest, `apps/api/test/*.e2e-spec.ts` (21 file) | như trên | Dùng dependency thật từ `.env` ở root, **không mock**. Lần chạy tester 2026-11-12 13:29: 169/169 ở hai lần, một lần crash native (xem [roadmap](./development-roadmap.md)) |
| admin | `node --test` | `pnpm --filter @kamito/admin test` | Kiểm allowlist của `docker/admin-entrypoint.sh` |
| scripts | `node --test` | `pnpm test` (root) | `scripts/*.test.mjs` |
| migration | Prisma CLI | `prisma migrate deploy` trên DB test | CI chạy trên Postgres service container |

Quy tắc:
- E2E cần dependency dev đang chạy (`docker-compose.dev.yml`). CI có service container Postgres 17.11, Redis 8.2.11 và RustFS 1.0.4.
- `vitest.config.ts` của api nạp `../../.env` nếu có. CI đặt env trực tiếp.
- Không mock để qua build. Test lỗi phải kiểm lỗi thật.
- Test upload ảnh đi qua luồng API thật (intent → content → complete) với file JPEG thật. Tester ghi nhận một test ảnh 3 MB chạy khoảng 644 ms (báo cáo 2026-11-12 13:29).
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
- Lịch sử commit: xem `git log`. Code phase 04 chưa commit (kiểm 2026-11-12).
- Repo chưa có remote (kiểm 2026-11-12). Đã chốt: chỉ commit cục bộ, push khi kết thúc dự án. Trước khi thêm remote, xác nhận lại tài khoản GitHub, email commit, tên repo.
- Tài khoản dự kiến cho repo này: `midomax-hoa`, SSH host alias `github.com` (chưa thêm remote, chưa xác nhận lại). Không dùng URL HTTPS. Email commit đặt bằng `git config user.email` mức repo, không đặt `--global`.
- Không commit `.env`, `packages/db/src/generated/`, `dist/`, `.next/`, `.turbo/`, `coverage/`, `apps/api/uploads/`.

## Thư viện mới

Trước khi dùng thư viện lần đầu:
1. Kiểm license (ghi rõ trong PR hoặc tài liệu liên quan).
2. Kiểm repo còn được bảo trì (commit gần đây, issue được xử lý).
3. Đọc doc chính thức của đúng phiên bản đã ghim. Không suy từ trí nhớ. Ví dụ đã làm: `disallowedTagsMode` của sanitize-html đọc từ README trong `apps/api/node_modules/sanitize-html` (2.18.1).
4. Với chức năng lớn (sửa Office, ký số, chat, BI, workflow, PDF...), tìm giải pháp tự host hoặc tích hợp có sẵn trước khi tự viết.

## Liên quan

- [system-architecture.md](./system-architecture.md): thành phần, luồng mạng, luồng khởi động, upload ảnh.
- [deployment-guide.md](./deployment-guide.md): môi trường, compose, quy trình phát hành, seed.
- [auth-and-rbac.md](./auth-and-rbac.md): đăng nhập, phân quyền, cài đặt vận hành.
