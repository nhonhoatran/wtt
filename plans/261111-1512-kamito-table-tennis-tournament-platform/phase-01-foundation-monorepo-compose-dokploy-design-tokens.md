# Phase 01 — Nền móng: monorepo, compose, Dokploy, staging, design token

## Context Links

- [Brainstorm §4.1, §6](../reports/brainstorm-261111-1512-kamito-table-tennis-tournament-platform.md)
- [Admin + hạ tầng: D.1 MinIO, D.2 Dokploy, D.3 monorepo, D.4 Prisma, B.1 Redis](../reports/researcher-261111-1450-admin-ui-kit-and-infra-queue-storage-realtime.md)
- [Brand §7 token, phương án A + gợi ý dung hòa](../reports/researcher-261111-1450-midomax-kamito-brand-identity-analysis.md)
- [Red team đã phân xử: nhóm 7, 8, 9, 10, 14, 15](./reports/red-team-261111-1614-adjudicated-findings.md)
- Phase song song: [phase-02 spike](./phase-02-spikes-refine-antd-better-auth-dokploy-nextjs-revalidation.md)

## Overview

<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Priority: P1. Status: In progress (code xong, chờ hạ tầng). Tuần 1–2 (≈6 ngày công, xen với phase 02).
- Dựng monorepo 4 app + package dùng chung, Prisma 7.10.x nối PostgreSQL có sẵn, compose cho Dokploy, compose dev cục bộ, design token Kamito, kiểm tra tiền điều kiện hạ tầng (Redis, MinIO, PostgreSQL, Dokploy), **staging** + quy trình phát hành.
- Cổng ra của phase (chưa đạt thì không sang phase 03): staging chạy được; Redis riêng (hoặc đã xác nhận `noeviction`) cho BullMQ; thiết kế upload (a)/(b) đã chọn; chủ sở hữu sao lưu + RPO đã ghi.
- Đường dẫn trong file này tính từ gốc repo `d:\Project\wtt\`.

## Key Insights

- Dokploy ghi biến môi trường UI vào `.env` cạnh compose nhưng KHÔNG tự inject vào container → mỗi service khai `${VAR}` tường minh (doc Dokploy docker-compose).
- Compose (không phải Stack) mới hỗ trợ `build`. Domain qua tab Domains, service gắn `dokploy-network`, dùng `expose` thay `ports`.
- BullMQ bắt buộc Redis `maxmemory-policy noeviction`; Redis dùng chung làm cache có eviction sẽ mất job.
- MinIO community đã archive 2026-04-25 → chỉ gọi qua S3 API (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`), endpoint lấy từ env để đổi kho dễ.
- Prisma 7 bỏ Rust engine, cần driver adapter (`@prisma/adapter-pg`) và `prisma.config.ts`; npm tag `latest` đang là 8.0.0-rc → pin `7.10.x` tường minh.
<!-- Red Team: Revalidate Next.js chưa kiểm chứng — 2026-11-11 -->
- Next.js: API cache theo tag đổi qua các bản gần đây; cách dùng chốt ở Spike E (phase 02) trên đúng bản đã ghim, không suy từ trí nhớ.
<!-- Spike E results — 2026-11-12 -->
- `docker/client.Dockerfile` entrypoint phải xóa `.next/cache` mỗi lần container start (trước khi chạy server). Lý do: fetch cache nằm trên đĩa, không hết hạn qua restart → trả HTML cũ. Chưa thử trên Docker thật (chờ staging).
<!-- Red Team: Hạ tầng dùng chung không cách ly — 2026-11-11 -->
- PostgreSQL/Redis/MinIO "có sẵn" có thể dùng chung với dự án khác → mọi khóa Redis/queue có tiền tố `QUEUE_PREFIX` theo môi trường; worker nạp lại trạng thái từ DB, không tin payload job.
<!-- Red Team: Tô-pô mạng, IP thật, rate limit, health — 2026-11-11 -->
- API sau chuỗi proxy (Traefik → nginx/Next → API) chỉ thấy IP container nếu không cấu hình `trust proxy` → rate limit theo IP phải đặt ở tầng thấy IP thật.
- Repo chưa có git. Chưa biết tài khoản GitHub → cổng hỏi bắt buộc.

## Requirements

Functional
- `pnpm install --frozen-lockfile && pnpm build` chạy được 4 app + package.
<!-- Red Team: Tô-pô mạng, IP thật, rate limit, health — 2026-11-11 -->
- API `/api/v1/health/live` (tiến trình sống, không gọi phụ thuộc — dùng cho healthcheck container) và `/api/v1/health/ready` (DB, Redis, S3, trạng thái migration — chỉ trong mạng nội bộ); worker có health; client `/api/health`; admin `/healthz`.
- Compose prod chạy trên Dokploy với DB/Redis/MinIO bên ngoài qua env; compose dev cục bộ có Postgres, Redis (`noeviction`), MinIO pin phiên bản.
<!-- Red Team: Deploy/migrate/staging/sao lưu — 2026-11-11 -->
- Hai môi trường Dokploy: **staging** (DB, bucket/prefix, `QUEUE_PREFIX` riêng) và production. Cuối mỗi phase: deploy + migrate staging.
- Package token xuất CSS variables cho client và object theme antd cho admin, cùng một nguồn.
<!-- Red Team: Audit, phạm vi công khai, VĐV nhỏ tuổi, song ngữ — 2026-11-11 -->
- `AuditService` dùng chung: ghi actor (user hoặc `system`), ip, userAgent, sessionId, requestId; che PII trong JSON trước/sau.

Non-functional
- Mọi file code < 200 dòng, kebab-case. Env được validate lúc khởi động (thiếu biến → dừng, báo tên biến, không in giá trị).
- Không giá trị kết nối nào nằm trong code hay compose; `.env.example` chỉ chứa placeholder.
<!-- Red Team: Tô-pô mạng, IP thật, rate limit, health — 2026-11-11 -->
- Múi giờ container đặt tường minh (`TZ`); ngày giờ nghiệp vụ tính theo `Event.timezone`.

## Architecture

Cây thư mục

```
d:\Project\wtt\
├── apps/
│   ├── api/            NestJS (Express) — REST /api/v1/{admin,public,auth}
│   │   └── src/ main.ts, app.module.ts, common/{config,guards,decorators,pagination,filters,logger,audit}/, modules/<feature>/
│   ├── worker/         BullMQ processors (không mở HTTP ra ngoài, chỉ health nội bộ)
│   │   └── src/ main.ts, worker-health-server.ts, processors/
│   ├── client/         Next.js App Router — src/app/[locale]/..., src/components/, src/lib/, src/i18n/
│   └── admin/          Vite + React + Refine — src/providers/, src/resources/<resource>/, src/components/
├── packages/
│   ├── db/             prisma/schema.prisma, prisma/migrations/, prisma/seed/, prisma.config.ts, src/index.ts
│   ├── shared/         enums, zod schema DTO dùng chung, permission matrix, app-setting registry, pagination types, queue names
│   ├── competition-engine/  hàm thuần tự viết: bracket, seeding, round robin, standings, validate tỷ số (phase 06–07)
│   ├── ranking-engine/ hàm thuần: tính điểm, dựng snapshot (phase 09)
│   ├── ui-tokens/      tokens.ts → tokens.css + antd-theme.ts
│   └── config/         tsconfig.base.json, eslint config, vitest preset
├── docker/             api.Dockerfile, worker.Dockerfile, client.Dockerfile, admin.Dockerfile, admin-nginx.conf, admin-entrypoint.sh
├── scripts/            print-db-target.mjs, check-migration-state.mjs
├── docs/               code-standards.md, system-architecture.md, deployment-guide.md (khởi tạo)
├── docker-compose.yml  (Dokploy, dùng cho cả staging và production)
├── docker-compose.dev.yml (Postgres/Redis/MinIO cục bộ)
├── .env.example, pnpm-workspace.yaml, turbo.json, package.json
```

<!-- Red Team: Tô-pô mạng, IP thật, rate limit, health — 2026-11-11 -->
Luồng mạng (prod/staging)

```
Browser ─TLS─> Traefik (Dokploy) ─> client (Next.js, domain công khai) ──SSR fetch──> api:3000 (mạng nội bộ)
Browser ─TLS─> Traefik ─> admin (nginx: SPA tĩnh + proxy CHỈ /api/v1/admin/ và /api/v1/auth/ → api:3000)
api ──> PostgreSQL / Redis / MinIO (URL ngoài qua env)    worker ──> Redis, PostgreSQL, MinIO, client:3000/api/revalidate
Browser ──upload──> theo thiết kế (a) hoặc (b) chốt ở bước 15
```

- API không cần domain công khai; chỉ client và admin có domain.
- nginx admin: `/api/v1/public/*`, `/api/v1/health/*` và mọi đường dẫn `/api/` khác trả 404 trên domain admin.
- Chuỗi proxy tin cậy: Traefik → nginx (admin) hoặc Next (client) → API. Proxy ghi đè (không nối thêm) header IP thật; API đặt `trust proxy` tường minh theo số hop (`TRUST_PROXY_HOPS`); Traefik có chuyển IP thật tin cậy hay không → câu hỏi cho chủ hạ tầng, kiểm ở bước 15.
- Rate limit cho site công khai đặt ở Traefik hoặc Next (thấy IP thật), không ở API; request SSR nội bộ từ client có định danh riêng (header nội bộ + secret) để được miễn.
<!-- Red Team: Kiểm soát bảo mật sớm — 2026-11-11 -->
- Admin SPA đọc `/config.json` sinh lúc container start (`admin-entrypoint.sh`) → không build lại khi đổi URL. Script chỉ ghi **allowlist khóa không bí mật** (`API_BASE_PATH`, `ADMIN_PUBLIC_URL`, `PUBLIC_SITE_URL`), có test khẳng định không khóa nào khác lọt vào.

Biến môi trường (tên cố định, giá trị từ Dokploy; không bao giờ lấy từ dòng `.env` đã comment)

<!-- Red Team: Kiểm soát bảo mật sớm — 2026-11-11 -->
| Biến | Service | Ghi chú |
|---|---|---|
| `DATABASE_URL` | api, worker | role runtime (chỉ DML nếu hạ tầng cấp được) |
| `DATABASE_MIGRATE_URL` | migrate | role migrate riêng nếu có; không có → bằng `DATABASE_URL` |
| `MIGRATE_CONFIRM_TARGET` | migrate | phải khớp `host/database` in ra, khác nhau giữa staging/prod |
| `REDIS_URL` | api, worker | Redis riêng cho BullMQ, `noeviction` |
| `QUEUE_PREFIX` | api, worker | bắt buộc, dạng `kamito-tt:{env}`; dùng cho queue và mọi khóa Redis khác |
| `REDIS_EVICTION_CHECK_OVERRIDE` | worker | chỉ đặt khi không đọc được policy và đã xác nhận tay; mặc định trống |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE` | api, worker | service account chỉ có quyền trên 1 bucket |
| `S3_PRESIGN_ENDPOINT`, `S3_PUBLIC_BASE_URL` | api, client | chỉ dùng ở thiết kế (a) |
| `AUTH_SECRET` | api | ≥ 32 byte ngẫu nhiên; riêng từng môi trường |
| `AUTH_*` (thời hạn phiên, idle timeout, khóa tạm, mật khẩu tạm, nhập lại mật khẩu) | api | tham số kỹ thuật, mặc định ở phase 03 |
| `REVALIDATE_SECRET`, `CLIENT_INTERNAL_URL` | api, worker, client | secret riêng, không trùng `AUTH_SECRET` |
| `SSR_INTERNAL_SECRET` | client, api | định danh request SSR nội bộ |
| `IP_HASH_SALT` | api | hash IP form liên hệ (phase 11) |
| `API_INTERNAL_URL` | client, admin | `http://api:3000` |
| `PUBLIC_SITE_URL`, `ADMIN_PUBLIC_URL` | client, api, admin | canonical, sitemap, kiểm `Origin` |
| `PUBLIC_REVALIDATE_SECONDS`, `MATCHDAY_REVALIDATE_SECONDS` | client | TTL dự phòng; trang ngày thi đấu dùng TTL ngắn đồng nhất (mặc định ví dụ 300 / 30) |
| `TRUST_PROXY_HOPS` | api | số proxy tin cậy |
| `UPLOAD_MAX_IMAGE_BYTES`, `UPLOAD_ALLOWED_IMAGE_TYPES`, `MEDIA_IMAGE_VARIANT_WIDTHS` | api, worker | tham số kỹ thuật (trước đây ở AppSetting) |
| `IMPORT_MAX_FILE_BYTES`, `IMPORT_MAX_UNZIPPED_BYTES`, `IMPORT_MAX_ROWS`, `IMPORT_RETENTION_DAYS` | api, worker | trần import (phase 05) |
| `CONTACT_RETENTION_DAYS`, `VIDEO_EMBED_HOSTS`, `NEWS_PAGE_SIZE` | api, client | phase 11 |
| `QUEUE_*_CONCURRENCY`, `QUEUE_*_ATTEMPTS` | worker | tham số kỹ thuật, có mặc định |
| `TZ`, `LOG_LEVEL`, `NODE_ENV`, `APP_ENV` (`staging`/`production`) | tất cả | |

<!-- Red Team: Deploy/migrate/staging/sao lưu — 2026-11-11 -->
Mẫu compose (rút gọn)

```yaml
services:
  migrate:
    build: { context: ., dockerfile: docker/api.Dockerfile, target: migrate }
    environment: { DATABASE_URL: ${DATABASE_MIGRATE_URL}, MIGRATE_CONFIRM_TARGET: ${MIGRATE_CONFIRM_TARGET} }
    restart: "no"
    networks: [internal]
  api:
    build: { context: ., dockerfile: docker/api.Dockerfile }
    depends_on: { migrate: { condition: service_completed_successfully } }
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      QUEUE_PREFIX: ${QUEUE_PREFIX}
      # ... each variable listed explicitly
    expose: ["3000"]
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/v1/health/live"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    networks: [internal]
  worker:   { build: ..., depends_on: { migrate: { condition: service_completed_successfully } }, environment: {...}, healthcheck: ..., networks: [internal] }
  client:   { build: ..., expose: ["3000"], networks: [internal, dokploy-network] }
  admin:    { build: ..., expose: ["80"], networks: [internal, dokploy-network] }
networks:
  internal: {}
  dokploy-network: { external: true }
```

- Base image ghim theo digest/phiên bản cụ thể, không dùng `latest`.
- Entry script của `migrate`: gọi `scripts/print-db-target.mjs` in `host:port/database` (ẩn mật khẩu) + danh sách migration chờ áp; chỉ chạy `prisma migrate deploy` khi `MIGRATE_CONFIRM_TARGET` khớp đúng `host/database`; không khớp → thoát mã khác 0 → api/worker không khởi động.
- Dokploy có tôn trọng `service_completed_successfully` hay không: kiểm ở Spike D. Không tôn trọng → `migrate` chuyển về profile `tools`, chạy tay `docker compose --profile tools run --rm migrate` trước mỗi lần redeploy.
- API lúc khởi động gọi `check-migration-state`: `_prisma_migrations` thiếu migration đi kèm image → log lỗi + dừng.

Quy trình phát hành (ghi vào `docs/deployment-guide.md`, diễn tập ở Spike D)
1. Build image (CI hoặc Dokploy).
2. Người phát hành đọc target in ra (host + tên DB) + danh sách migration chờ, xác nhận đúng môi trường.
3. `pg_dump` DB của môi trường đó về nơi dự án kiểm soát (vị trí hỏi chủ hạ tầng; không ghi đè bản trước).
4. `migrate` chạy (tự động qua `depends_on` hoặc tay theo profile tools).
5. Đổi container api/worker/client/admin; kiểm `/health/live` + smoke.
6. Lỗi → rollback về image trước (schema mới vẫn chạy được nhờ quy tắc tương thích ngược); migration lỗi giữa chừng → runbook `prisma migrate resolve`.

Quy tắc migration tương thích ngược (cũng nằm trong "Ràng buộc cứng" của plan.md)
- Migration chạy được **trước** code cần nó và chỉ cộng thêm (bảng/cột nullable/có default, index).
- Bước phá hủy (xóa/đổi tên cột, thêm NOT NULL không default) lùi sang bản phát hành sau, khi không còn code nào dùng.

<!-- Red Team: Audit, phạm vi công khai, VĐV nhỏ tuổi, song ngữ — 2026-11-11 -->
Prisma ban đầu (`packages/db/prisma/schema.prisma`)

```prisma
model AppSetting {            // business values only; keys + zod schema + default live in packages/shared
  key         String   @id
  value       Json
  updatedById String?
  updatedAt   DateTime @updatedAt
}
enum AuditActorType { USER SYSTEM }
model AuditLog {
  id        String         @id @default(uuid())
  actorType AuditActorType
  actorId   String         // user id, or "system" for jobs/CLI
  action    String         // e.g. match.result.confirm
  entity    String
  entityId  String
  before    Json?          // PII masked
  after     Json?
  reason    String?
  ip        String?
  userAgent String?
  sessionId String?
  requestId String?
  createdAt DateTime       @default(now())
  @@index([entity, entityId])
  @@index([actorId, createdAt])
}
```

- Quy tắc che PII trong `before/after`: `phone`, `email`, `birthDate`, mọi khóa chứa `password`/`token`/`secret` → `"***"`. Có test.

Design token (`packages/ui-tokens`, mặc định chờ brand guideline)

| Token | Giá trị mặc định | Dùng cho |
|---|---|---|
| `color.primary` | `#EC1E24` (đỏ logo, theo brainstorm) | hành động, điểm nhấn |
| `color.primary-strong` | `#A31115` | hover |
| `color.ink` | `#0A0A0A` | chữ, header/footer |
| `color.data` / `color.data-deep` | `#0F285D` / `#0F2452` | vùng số liệu: lịch, nhánh, xếp hạng |
| `color.live` | `#E3F42A` | nhãn đang đấu, chỉ trên nền navy/đen |
| `color.border` / `color.surface` | `#E5E5E5` / `#FFFFFF`, `#FAFAFA`, `#F5F5F5` | |
| `font.family` | Archivo 300–800, subset vietnamese, fallback `system-ui` | |
| `radius` | 4 / 8 / 20 / 999 px | nút / thẻ / hero / pill |
| `space.section` | 64 px desktop, 40 px mobile | |
| `layout.container` | tối đa 1520 px, lề 40 px (mobile 16 px) | |

- Token là file theme, không phải cấu hình nghiệp vụ; đổi màu = sửa 1 file `tokens.ts`. Màu theo hạng giải (`Tier.colorHex`, `EventType.colorHex`) là dữ liệu động ở phase 04.

## Related Code Files

Create
- `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.env.example`, `.editorconfig`
- `packages/config/{tsconfig.base.json,eslint.config.mjs,vitest.preset.ts}`
- `packages/db/{package.json,prisma.config.ts,prisma/schema.prisma,src/index.ts,src/prisma-client-factory.ts}`
- `packages/shared/src/{index.ts,pagination.ts,app-setting-registry.ts,queue-names.ts}`
- `packages/ui-tokens/src/{tokens.ts,antd-theme.ts,build-css-variables.ts}`
- `apps/api/src/{main.ts,app.module.ts}`, `apps/api/src/common/config/env-schema.ts`, `.../config/app-config.module.ts`, `.../logger/logger.module.ts`, `.../filters/http-exception.filter.ts`, `.../pagination/pagination-query.ts`, `.../audit/{audit.module.ts,audit.service.ts,mask-pii.ts,request-context.ts}`, `apps/api/src/modules/health/{health.module.ts,health-live.controller.ts,health-ready.controller.ts}`, `apps/api/src/modules/prisma/prisma.service.ts`, `apps/api/src/modules/storage/{storage.module.ts,s3-client.provider.ts}`, `apps/api/src/modules/queue/{queue.module.ts,redis-eviction-policy-check.ts,queue-prefix-check.ts}`
- `apps/worker/src/{main.ts,worker-health-server.ts}`
- `apps/client/src/app/[locale]/{layout.tsx,page.tsx}`, `apps/client/src/app/api/health/route.ts`
- `apps/admin/{index.html,vite.config.ts,src/main.tsx,src/app.tsx}`
- `docker/*` (4 Dockerfile multi-stage + target `migrate`, `admin-nginx.conf`, `admin-entrypoint.sh`), `docker-compose.yml`, `docker-compose.dev.yml`, `scripts/{print-db-target.mjs,check-migration-state.mjs}`
- Test: `apps/api/src/common/audit/mask-pii.test.ts`, `docker/admin-entrypoint.test.sh` (hoặc test Node tương đương), `apps/api/test/health.e2e-spec.ts`
- `docs/{code-standards.md,system-architecture.md,deployment-guide.md}` (giao `docs-manager`)
- `.github/workflows/ci.yml` (sau cổng git)

Modify / Delete: không có (repo trống).

## Implementation Steps

1. **CỔNG GIT (bắt buộc, trước mọi lệnh git):** hỏi chủ repo một lượt: (a) tài khoản GitHub nào, (b) email commit, (c) tên repo. Chưa có câu trả lời → không chạy `git init`, `git remote add`, `git push`; vẫn làm các bước code cục bộ. Có câu trả lời → `git init`, `git config user.email` mức local (không `--global`), remote dùng SSH host alias tương ứng tài khoản được chỉ định, không dùng URL HTTPS; kiểm bằng `ssh -T` trước lần push đầu.
2. Kiểm phiên bản Node LTS + pnpm đang cài (`node -v`, `pnpm -v`); ghi vào `docs/code-standards.md`. Pin `packageManager` trong `package.json`.
3. Tạo workspace root, `turbo.json` với pipeline `build`, `lint`, `typecheck`, `test`, `dev`.
4. `packages/config`: tsconfig strict, ESLint, preset Vitest. Thử Vitest cho NestJS (decorator cần SWC, ví dụ `unplugin-swc` — chưa kiểm chứng); không chạy được trong 2 giờ → dùng Jest cho riêng `apps/api`, ghi quyết định vào `docs/code-standards.md`.
5. `packages/db`: cài `prisma@7.10.x`, `@prisma/client@7.10.x`, `@prisma/adapter-pg` cùng bản; `prisma.config.ts` đọc `DATABASE_URL` từ env. Tra doc Prisma 7.10 xem có hỗ trợ schema nhiều file không; có → tách file theo domain trong `prisma/schema/`, không → một file.
6. Viết model `AppSetting`, `AuditLog`. Chạy `pnpm --filter db exec prisma migrate dev --create-only --name init_app_settings_audit_log` lên **Postgres cục bộ của compose dev** (in `node scripts/print-db-target.mjs` trước, xác nhận đúng `localhost:5432/kamito_tt_dev` hoặc tên đã chốt), review SQL, rồi `migrate dev` áp dụng. Không bao giờ dùng `prisma db push`.
7. `apps/api`: Nest + Express, global prefix `/api/v1`, `env-schema.ts` (zod) validate env lúc boot, logger JSON (pino, gắn `requestId`), filter lỗi chuẩn `{ error: { code, message, fields? } }`, `PaginationQuery` chung: `page` (≥1), `pageSize` (mặc định 20, trần 100 — tham số kỹ thuật), `sort=field:asc|desc` (whitelist theo resource), `q` (giới hạn độ dài), `filter[...]` → trả `{ data, total, page, pageSize }`. `trust proxy` theo `TRUST_PROXY_HOPS`.
8. `AuditService` + `request-context` (ip, userAgent, sessionId, requestId) + `mask-pii` + test.
9. Health tách live/ready: ready ping DB (`SELECT 1`), Redis (`PING`), S3 (`HeadBucket`), trạng thái migration. `check-migration-state` chạy lúc boot (thiếu migration → dừng).
10. `queue-prefix-check.ts`: thiếu `QUEUE_PREFIX` hoặc prefix không chứa `APP_ENV` → dừng. `redis-eviction-policy-check.ts`: `CONFIG GET maxmemory-policy` lúc boot; production: khác `noeviction` hoặc không đọc được → worker **từ chối chạy** (trừ khi `REDIS_EVICTION_CHECK_OVERRIDE` đặt tường minh, log cảnh báo); staging/dev: log error + ready báo `degraded`.
11. `apps/worker`: bootstrap BullMQ chưa có processor, health HTTP nội bộ cổng riêng, cùng 2 check trên. Quy tắc processor (ghi vào `docs/code-standards.md`): payload chỉ chứa id; processor nạp lại bản ghi từ DB và kiểm trạng thái trước khi làm.
12. `apps/client`: Next.js bản ổn định hiện hành (ghim bản cụ thể), App Router, segment `[locale]` khung rỗng, route health. `apps/admin`: Vite + React khung rỗng (Refine cài sau spike B). `admin-nginx.conf` chỉ proxy `/api/v1/admin/` và `/api/v1/auth/`, mọi `/api/` khác 404; `admin-entrypoint.sh` + test allowlist khóa.
13. `packages/ui-tokens`: `tokens.ts` là nguồn duy nhất → `build-css-variables.ts` sinh `tokens.css` (`--color-primary`...) cho client; `antd-theme.ts` map sang `ThemeConfig` antd 5.
14. Dockerfile multi-stage: dùng `turbo prune --docker` hoặc `pnpm deploy` để image chỉ chứa app + deps cần; chạy user non-root; base image ghim; image client dùng Next standalone output; target `migrate` cho api image. `docker-compose.dev.yml`: `postgres` (pin major), `redis` với `--maxmemory-policy noeviction --appendonly yes`, `minio` (pin release cuối đã biết) + tạo bucket dev. `docker-compose.yml` cho Dokploy như mẫu trên.
<!-- Red Team: Deploy/migrate/staging/sao lưu — 2026-11-11 -->
<!-- Red Team: Hạ tầng dùng chung không cách ly — 2026-11-11 -->
<!-- Red Team: Luồng upload và khả năng truy cập MinIO — 2026-11-11 -->
15. Preflight trên hạ tầng thật (in host + tên DB/bucket trước; xin xác nhận trước khi kết nối dịch vụ dùng chung; ghi output làm bằng chứng):
    - Hỏi chủ hạ tầng: dịch vụ có dùng chung với dự án khác không; ai giữ thông tin đăng nhập; cấp được role PG runtime (chỉ DML) + role migrate riêng, service account MinIO giới hạn 1 bucket không.
    - PostgreSQL: phiên bản, quyền `CREATE` trên schema, có pooler (pgbouncer) không, SSL, giới hạn kết nối; DB riêng cho dự án (staging + prod) và DB shadow cho `migrate dev` nếu dùng server dev; hỏi tên DB, không tự tạo trên server dùng chung khi chưa xác nhận.
    - Redis: phiên bản, `maxmemory-policy`. Khác `noeviction` hoặc dùng chung làm cache → Redis riêng cho BullMQ (**cổng ra phase 01**).
    - MinIO: trình duyệt có tới được MinIO qua HTTPS không; ai đặt được bucket policy/CORS. Chọn và ghi một thiết kế: **(a)** trình duyệt upload trực tiếp bằng URL ký + ảnh phục vụ từ `S3_PUBLIC_BASE_URL`; **(b)** upload qua API (stream, trần cứng) + ảnh phục vụ qua route Next hoặc proxy Traefik có cache dài.
    - Traefik/Dokploy: có chuyển IP thật tin cậy vào container không (gửi request, đọc header ở container).
    - Sao lưu: ai sở hữu sao lưu PostgreSQL + MinIO, RPO, lịch, thời gian giữ. Diễn tập khôi phục trên staging phải xong **trước lần nạp dữ liệu thật đầu tiên** (pilot tuần 9).
16. Tạo 2 project Dokploy (staging, production) với env riêng; deploy bản "hello" lên staging (client + admin + api + worker), gắn domain tạm, kiểm healthcheck xanh; ghi kết quả vào Spike D (phase 02).
<!-- Red Team: Kiểm soát bảo mật sớm — 2026-11-11 -->
17. CI (sau bước 1): `.github/workflows/ci.yml` chạy `pnpm install --frozen-lockfile`, `pnpm audit --audit-level high`, quét secret (vd gitleaks — kiểm license/bảo trì trước), `lint`, `typecheck`, `test`, `build` qua Turborepo; job test dùng service container Postgres + Redis thật.
18. Giao `docs-manager` tạo `docs/code-standards.md` (cấu trúc, naming, comment ít tiếng Anh, commit convention, luật migration + tương thích ngược, luật `.env`, kiểm license thư viện trước lần dùng đầu), `docs/system-architecture.md`, `docs/deployment-guide.md` (quy trình phát hành, runbook `prisma migrate resolve`, sao lưu/khôi phục).

## Todo List

- [ ] Hỏi chủ repo: tài khoản GitHub, email commit, tên repo (chờ trả lời trước mọi lệnh git) — một phần: đã chốt 2026-11-12 tài khoản `midomax-hoa`, email `dev03@midomax.vn` (mức local), chỉ commit local, push cuối dự án; tên repo hỏi lại lúc push
- [x] Workspace pnpm + Turborepo + packages/config
- [x] packages/db Prisma 7.10.x + migration `init_app_settings_audit_log` (DB cục bộ, đã in target)
- [x] API khung: env validate, logger, error filter, pagination, trust proxy, audit service + che PII
- [x] Health live/ready + kiểm trạng thái migration lúc boot
- [x] Kiểm `QUEUE_PREFIX` + eviction policy (worker từ chối chạy ở production)
- [x] Worker khung + health
- [x] Client + admin khung rỗng build được; nginx admin chỉ proxy admin/auth; entrypoint allowlist + test
- [x] packages/ui-tokens → CSS vars + theme antd
- [x] Dockerfile x4 + target migrate, compose prod/dev, base image ghim, script target + migration state
- [ ] Preflight PG/Redis/MinIO/Traefik + câu hỏi chủ hạ tầng; chọn thiết kế upload (a)/(b) — chờ chủ hạ tầng
- [ ] Chủ sở hữu sao lưu + RPO; lịch diễn tập khôi phục trước pilot — chờ chủ hạ tầng
- [ ] 2 project Dokploy (staging, prod); deploy hello lên staging — chờ hạ tầng
- [x] CI frozen lockfile + audit + quét secret + lint/typecheck/test/build — lượt GitHub Actions đầu tiên đạt cả 3 job (secret-scan, docker-images, build-test): run `45337885843`, commit `0f9bba3` (2026-11-24)
- [x] docs/ khởi tạo (gồm quy trình phát hành) — code-standards, system-architecture, deployment-guide

## Success Criteria

- `pnpm build` và `pnpm test` xanh ở máy dev và CI; CI fail khi có lỗ hổng high hoặc secret trong diff.
- `docker compose -f docker-compose.dev.yml up` + `pnpm dev` → 4 health endpoint trả 200.
- Trên staging Dokploy: 4 service healthy, client + admin mở được qua domain; API không có domain công khai; `https://<admin>/api/v1/public/...` và `/api/v1/health/ready` trả 404.
- Thiếu một biến env (kể cả `QUEUE_PREFIX`) → service dừng với thông báo tên biến.
- `MIGRATE_CONFIRM_TARGET` sai → `migrate` thoát mã khác 0 và api không khởi động bản mới (hoặc quy trình tay đã ghi nếu Dokploy bỏ qua `depends_on`).
- Kết quả preflight (PG, Redis, MinIO, Traefik, sao lưu) được ghi kèm bằng chứng (output lệnh); thiết kế upload đã chọn.
- `/config.json` của admin chỉ chứa các khóa trong allowlist (test).
- `grep -rn "db push"` trên `package.json` các app không thấy script nào.

## Risk Assessment

| Rủi ro | Khả năng × Tác động | Xử lý |
|---|---|---|
| Redis có sẵn không `noeviction` | Trung bình × Cao | Redis riêng cho BullMQ là cổng ra phase 01; worker prod từ chối chạy |
| Dịch vụ dùng chung với dự án khác → đụng khóa/queue | Trung bình × Cao | `QUEUE_PREFIX` bắt buộc; service account/role tách nếu cấp được |
| Trình duyệt không tới được MinIO, CORS không đặt được | Trung bình × Cao | Thiết kế (b): upload qua API + ảnh qua route Next/Traefik |
| Dokploy bỏ qua `depends_on` → app chạy trước migrate | Trung bình × Cao | Kiểm migration lúc boot (dừng); migrate tay theo profile tools |
| Không có nơi lưu `pg_dump` dự án kiểm soát | Trung bình × Cao | Hỏi chủ hạ tầng ở preflight; chưa có → không nạp dữ liệu thật |
| Prisma 7 driver adapter lạ, lỗi build Docker | Thấp × Trung bình | Làm theo doc 7.10; thử build image ngay tuần 1 |
| Vitest không chạy decorator Nest | Trung bình × Thấp | Jest cho api |
| Dokploy server thiếu RAM build 4 image | Trung bình × Trung bình | Build tuần tự; hoặc build ở CI, Dokploy chỉ pull image (cần registry) |

Rollback: phase chỉ thêm file + 1 migration tạo bảng mới; revert = xóa service khỏi Dokploy; migration không động dữ liệu cũ.

## Security Considerations

- `.env` trong `.gitignore`; `.env.example` chỉ placeholder; không in secret ra log (logger redact `password`, `secret`, `authorization`, `cookie`).
- Secret tách riêng theo mục đích (auth, revalidate, SSR nội bộ, salt IP) và theo môi trường.
- Container non-root; API chỉ trong mạng nội bộ; admin proxy chỉ `/api/v1/admin/` + `/api/v1/auth/` → cùng origin, cookie `HttpOnly; Secure; SameSite=Lax`.
- MinIO: bucket private; đọc công khai chỉ prefix `public/` (thiết kế a) hoặc qua route phục vụ (thiết kế b); cô lập mạng theo khuyến nghị (MinIO không còn vá lỗi).
- Role PG runtime chỉ DML nếu hạ tầng cấp được (không là điều kiện ra mắt).

## Next Steps

- Phase 02 dùng khung này + staging để chạy spike. Phase 03 cần kết quả spike C (auth) và B (Refine).
- Câu hỏi mở: xem mục câu hỏi ở cuối [phase 12](./phase-12-english-seo-hardening-and-launch.md#câu-hỏi-chưa-giải-quyết) (hạ tầng dùng chung, IP thật, tên bucket/DB, sao lưu).

## Kết quả triển khai 2026-11-12

**Trạng thái:** code xong, cổng ra phase 01 CHƯA đạt (staging chưa có, Redis riêng chưa xác nhận, thiết kế upload chưa chọn, chủ sở hữu sao lưu + RPO chưa ghi). Không sang phase 03 cho tới khi đủ 4 điều kiện.

**Đã xong (đã kiểm chứng):**
- Workspace pnpm 11.3.0 + Turborepo 2.11.10 + `packages/config`; `packages/ui-tokens` (CSS vars + theme antd).
- `packages/db`: Prisma 7.10.1, migration `20261112015704_init_app_settings_audit_log` áp lên DB dev `localhost:5433/kamito_tt_dev` (target xác nhận trước khi chạy).
- API khung (env zod, pino, error filter, phân trang, `trust proxy`, AuditService + che PII); health live/ready; boot từ chối khi thiếu migration; `QUEUE_PREFIX` + eviction guard (worker exit 1 ở production).
- Worker khung + health; client Next 16.4.3 + admin Vite 8/React 19/antd 5.29.3 build được; nginx admin + entrypoint allowlist + test.
- 4 Dockerfile (target `migrate`), compose prod/dev, base image ghim; 5 image build + smoke trong WSL Docker.
- `docs/`: code-standards, system-architecture, deployment-guide.
- CI `.github/workflows/ci.yml` đạt trên GitHub Actions từ 2026-11-24 (run `45337885843`).
- Git: repo local, email `dev03@midomax.vn` (mức local); quyết định 2026-11-12 chỉ commit local, push cuối dự án.

**Chưa xong (chờ chủ hạ tầng):** preflight PG/Redis/MinIO/Traefik + chọn upload (a)/(b); sao lưu + RPO + diễn tập; 2 project Dokploy + deploy hello staging.

**Sai khác so với kế hoạch:**
- TypeScript ghim 6.0.3 (TS 7 chưa kiểm chứng với decorator Nest); NestJS 12 chỉ ESM.
- Test: Vitest + `unplugin-swc`, không Jest.
- S3 dev: RustFS 1.0.4 thay MinIO (image MinIO không còn trên Docker Hub; chỉ dùng S3 API).
- Cổng host dev 5433/6380/9010/9011 (tránh trùng dịch vụ dùng chung).
- `check-migration-state.mjs` → `findPendingMigrations` (`@kamito/db`); `queue-prefix-check` gộp vào env schema.
- `bullmq` cài khi có processor đầu tiên.
- `MIGRATE_CONFIRM_TARGET` dạng `host:port/database`; admin lắng nghe 8080, `config.json` ghi `/tmp/admin-config`.

**Kiểm thử (pass):** api 30, shared 14, worker 4, ui-tokens 3, admin 2, scripts 4.
**Review:** `plans/reports/code-reviewer-261112-0907-phase-01-foundation-review.md` — đã sửa C1, H1, H2, M1–M6, L1, L2, L4, L10, L11; hoãn H3, M7 (spike D).

**Câu hỏi chưa giải quyết:**
1. Traefik Dokploy có tin `forwardedHeaders` không (sau Cloudflare?) → `TRUST_PROXY_HOPS`.
2. Staging và production có dùng chung host PostgreSQL không.
3. Tài khoản GitHub và tên repo để push cuối dự án (chưa ghi nhận).
4. Ai sở hữu sao lưu PG + S3, RPO, lịch, thời gian giữ.
5. PG/Redis/S3 có dùng chung với dự án khác không (quyết định Redis riêng).

Cập nhật sync phase 03 (2026-11-12):
- Phase 03 đã code trước khi cổng ra phase 01 đạt (xem mục sai lệch cổng trong phase 03). Chủ repo cần chốt tiếp tục hay dừng deploy.
- Phân trang: `PAGINATION_MAX_PAGE_SIZE` và `QUERY_MAX_LENGTH` là trần an toàn (env); page size mặc định là setting `list.defaultPageSize` trên `/settings`.
