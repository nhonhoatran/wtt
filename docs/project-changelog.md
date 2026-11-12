# Project Changelog — Kamito

> Cập nhật: 2026-11-12. Mục mới nhất ở trên. Mục "chưa commit" mô tả code trong working tree tại thời điểm ghi.
> Lộ trình và trạng thái phase: [development-roadmap.md](./development-roadmap.md).

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
