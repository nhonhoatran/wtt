# Project Changelog — Kamito

> Cập nhật: 2026-11-12. Mục mới nhất ở trên. Mục "chưa commit" mô tả code trong working tree tại thời điểm ghi.
> Lộ trình và trạng thái phase: [development-roadmap.md](./development-roadmap.md).

## 2026-11-12 — Phase 04: dữ liệu gốc giải đấu, cấu hình, upload ảnh (chưa commit)

### Thêm
- Ba migration: `20261112061544_add_tournament_master_data` (8 danh mục, `Event`, `SubEvent`, `Venue`, `VenueTable`), `20261112061630_add_media_assets` (`MediaAsset`), `20261112070130_add_single_default_partial_indexes` (partial unique index cho `MatchFormat` và `GroupScoringRule`). Chỉ thêm bảng và index.
- Danh mục CRUD: nhóm giải, hạng giải, nội dung chuẩn, nhóm tuổi/trình độ, thể thức trận, luật vòng bảng, địa điểm (kèm bàn, tạo nhanh nhiều bàn). Xóa khi đang dùng trả 409 `IN_USE` kèm số phụ thuộc. Ẩn bằng `isActive`.
- Giải: `/api/v1/admin/events` gồm CRUD, slug (gợi ý khi trùng), publish, unpublish, cancel, uncancel, lọc theo lifecycle, năm, loại giải, trạng thái công bố. Lifecycle suy ra từ ngày, không lưu cột.
- Nội dung thi đấu: `/api/v1/admin/events/:eventId/sub-events` gồm CRUD và tạo hàng loạt tối đa 50 mục.
- Ảnh: `/api/v1/admin/media` (intent, nội dung, complete, GET, PATCH alt text) và `/api/v1/media/public/*`. Worker xử lý queue `media` (sharp, WebP) và job dọn định kỳ. Chi tiết: [system-architecture](./system-architecture.md#upload-ảnh-phase-04).
- Rich text: sanitizer `sanitize-html` với allowlist cho `infoBody`/`infoBodyEn`. URL: `httpsUrlSchema` cho `mapUrl` và `ticketUrl`.
- Tám setting mới trên `/settings`: `event.defaultTimezone`, `event.defaultDurationDays`, `venue.tablePrefix`, `header.resultsStrip.enabled`, `home.featuredEventId`, `media.maxImageMegabytes`, `media.intentTtlMinutes`, `media.processingTimeoutMinutes`.
- Quyền `media` (chỉ ADMIN). Quyền `tournaments` cho danh mục, địa điểm và giải.
- Seed danh mục mặc định: `pnpm --filter @kamito/db seed:config`, idempotent.
- `@kamito/shared`: `slugify-vietnamese`, `lifecycle-from-dates`, `tiebreak-criteria`, `https-url` (có test).
- Nền dùng chung cho api: `common/crud/prisma-list-query.ts`, `catalog-crud.ts`, `delete-guard.ts`.
- Admin: menu Giải đấu và Cấu hình (danh mục), hub giải với tab **Thông tin** và **Nội dung thi đấu**, ô tải ảnh, ô rich text (TipTap), ô slug, hộp xác nhận hành động nguy hiểm.

### Thay đổi
- Worker: từ "chưa có processor" sang media worker dùng BullMQ (queue `media`). Worker vẫn chưa kiểm migration lúc boot.
- Admin nginx: route `/api/v1/admin/media/<id>/content` có `client_max_body_size` lấy từ `UPLOAD_MAX_IMAGE_BYTES`. Route `/api/v1/media/*` được proxy tới api. Body JSON thường giới hạn `2m`.
- Container admin yêu cầu `UPLOAD_MAX_IMAGE_BYTES`. Thiếu thì thoát khi start.
- Body JSON của api giới hạn theo `MAX_INFO_BODY` (`json-body-limit.ts`), thay vì 100 kB mặc định của Express.
- `S3_*` bắt buộc khi `STORAGE_DRIVER=s3` (mặc định). `STORAGE_DRIVER=local` dùng cho dev. `S3_INCOMING_BUCKET` là tùy chọn cho ảnh gốc.

### Breaking và lưu ý cấu hình
- `MEDIA_INTENT_TTL_MINUTES` đã bỏ. Thay bằng setting `media.intentTtlMinutes` (mặc định 15 phút).
- `S3_PRESIGN_ENDPOINT` và `S3_PUBLIC_BASE_URL` không còn được code dùng. Vẫn còn trong env schema, compose và `.env.example`.
- Slug trùng trả 422 `SLUG_TAKEN` (không phải 409), kèm `suggestion`. URL không phải https trả 422 `VALIDATION_FAILED`. Tài liệu theo quy ước 422 cho dữ liệu sai. Báo cáo tester F2 ghi spec gốc là 400; đây là quyết định cần chủ repo xác nhận.
- Migration không xóa hay đổi cột cũ. Chưa áp dụng lên staging.

### Kiểm chứng
- Theo báo cáo tester 13:29 (`plans/reports/tester-261112-1329-phase-04-test-report.md`): typecheck 10/10, lint 7/7, build 7/7. `prisma migrate status` trên DB dev: up to date. Drift check: rỗng. Unit: shared 50, worker 18, ui-tokens 3, admin 2. API: 169/169 ở hai lần chạy, một lần crash native (F1).
- Code đã đổi sau báo cáo 13:29 (nhánh sửa lỗi review). Cần chạy lại kiểm tra trước khi commit.
- Review 13:29 (`plans/reports/code-reviewer-261112-1329-phase-04-review.md`), điểm 7.5/10, không có mục Critical. Đối chiếu lại trong code (`plans/reports/project-manager-261112-1347-phase-04-sync.md`): H1, H2, M1 đến M5 đã có bằng chứng trong code. M6 còn một phần. Mục L chưa đối chiếu.

### Chưa xong
- Chưa commit. Chưa deploy staging.
- Chưa kiểm sharp trên image Alpine. Chưa thử `STORAGE_DRIVER=s3` với bucket thật.
- Chưa có `cache-tags.ts` (phase 07).
- Các việc tiếp theo: xem [development-roadmap](./development-roadmap.md).

## 2026-11-12 — Phase 03: đăng nhập admin, RBAC, users, /settings, nhật ký, khung admin (chưa commit)

### Thêm
- Đăng nhập bằng email và mật khẩu qua Better Auth 1.7.21. Đăng ký tắt. Không dùng plugin admin. Raw handler chỉ nhận `POST /sign-in/email` và `POST /sign-out` (`apps/api/src/modules/auth/auth-raw-handler.ts`).
- Bốn guard toàn cục, deny-by-default: session, mật khẩu tạm, quyền, step-up. Decorator `@Public`, `@RequireSession`, `@RequirePermission`, `@AllowPendingPasswordChange`, `@RequireStepUp`.
- Ma trận quyền `packages/shared/src/permissions.ts`, dùng chung cho api và admin UI. Vai trò `ADMIN`, `RESULTS_OPERATOR`.
- Chống dò mật khẩu: giới hạn theo IP, khóa tạm theo tài khoản (thời gian khóa nhân đôi), cân thời gian phản hồi. Ngưỡng nằm ở `/settings`.
- Mật khẩu tạm có hạn. Đổi mật khẩu có khóa và audit. Step-up (nhập lại mật khẩu).
- API `/api/v1/admin/users`: list, get, create, update, reset-password, revoke-sessions. Có ràng buộc ADMIN cuối và không tự khóa, tự hạ quyền chính mình.
- API `/api/v1/admin/audit-logs`: chỉ đọc, lọc theo actor, entity, action, khoảng thời gian.
- API `/api/v1/admin/settings`: GET, PUT, DELETE. 11 key sửa được, lưu bảng `AppSetting`.
- bull-board tại `/api/v1/admin/queues`, chỉ ADMIN, guard theo phiên, quyền, và Origin.
- CLI `pnpm --filter @kamito/api create-admin`: tạo hoặc khôi phục ADMIN đầu tiên.
- Migration `20261112042429_add_users_and_auth_sessions`: bảng `User`, `Session`, `Account`, `Verification`, enum `UserRole`.
- Admin (`apps/admin`): đăng nhập, đổi mật khẩu, danh sách và form người dùng, nhật ký thao tác, `/settings`, menu theo quyền, modal step-up, modal mật khẩu tạm.

### Thay đổi
- `pageSize` mặc định lấy từ setting `list.defaultPageSize` (20, khoảng 5–100). Admin đọc giá trị này từ `/auth/me`, không còn fix cứng 20.
- `page` tối đa 10 000.

### Đã sửa theo review phase 03 (2026-11-12)
- Đổi mật khẩu có khóa và audit khi sai (H1).
- Polling bull-board không làm mới phiên (M1).
- Cân thời gian phản hồi khi tài khoản bị khóa, vô hiệu, hoặc mật khẩu tạm hết hạn (M2).
- Phân trang lấy từ `/settings` (M4).
- Chặn `\` trong redirect sau đăng nhập (L6).

### Breaking và lưu ý cấu hình
- `PAGINATION_DEFAULT_PAGE_SIZE` đã bỏ khỏi `env-schema.ts`. Nếu Dokploy có khai biến này thì nó bị bỏ qua. Page size mặc định đổi ở `/settings`.
- `PAGINATION_MAX_PAGE_SIZE` và `QUERY_MAX_LENGTH` vẫn là env, đã có trong `docker-compose.yml` với mặc định 100.

### Chưa xong
- Chưa deploy staging, chưa chạy migration `20261112042429` trên staging.
- Kiểm chứng 2026-11-12: turbo typecheck/lint/build 18/18; test API 18 file / 87 (gồm 13 file e2e trên Postgres + Redis dev local), shared 20, worker 4, ui-tokens 3.
- Còn mở các mục review (M3 một phần, L2–L5, L7–L10, `@RequireStepUp` chưa gắn route). Danh sách và trạng thái: [auth-and-rbac.md](./auth-and-rbac.md#giới-hạn-đã-biết).

## 2026-11-12 — Phase 02: spike Refine, Better Auth, Next revalidate

Commits: `412ec4e`, `730b35b`, `ecfdb2f`.

- Spike B (Refine + antd), C (Better Auth + Nest), E (Next.js revalidate) đạt ở môi trường cục bộ. Spike D (phát hành Dokploy) chờ staging.
- Kết quả ghi trong `plans/reports/spike-{b,c,e}-261112-1007-*.md`.
- `730b35b`: chuyển thiết lập auth vận hành sang trang `/settings` và ghi lại quyết định auth.
- `ecfdb2f`: thêm prototype spike cho Refine, Better Auth và Next revalidate.

## 2026-11-12 — Phase 01: khung monorepo, compose, health, audit

Commits: `f030184`, `c572b16`, `ec4d782`.

- Khung monorepo pnpm + Turborepo: `apps/api`, `apps/worker`, `apps/client`, `apps/admin`, packages `db`, `shared`, `ui-tokens`, `config`.
- Docker: 4 Dockerfile, `docker-compose.yml` cho staging và production, `docker-compose.dev.yml` cho dev.
- Health endpoint (`live`, `ready`) cho api, health cho worker, client và admin.
- Migration `20261112015704_init_app_settings_audit_log`: bảng `AppSetting`, `AuditLog`.
- Chưa dựng staging trên Dokploy. Cổng ra phase 01 chưa đạt theo plan.
