# Phase 03 — Đăng nhập admin, RBAC, người dùng, khung admin

## Context Links

- [Phase 02 — kết quả spike B, C](./phase-02-spikes-refine-antd-better-auth-dokploy-nextjs-revalidation.md)
- [Admin + hạ tầng: A.3 RBAC Refine chỉ ở client, D.5 Auth](../reports/researcher-261111-1450-admin-ui-kit-and-infra-queue-storage-realtime.md)
- [Brainstorm §4.1 Auth, §4.4 menu admin](../reports/brainstorm-261111-1512-kamito-table-tennis-tournament-platform.md)
- [Red team đã phân xử: nhóm 4, 5, 14, 15](./reports/red-team-261111-1614-adjudicated-findings.md)

## Overview

<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Priority: P1. Status: pending. Tuần 2–3 (≈5,5 ngày công; ước lại từ 2 ngày, gồm ui-consistency ≈0,5 ngày).
- Đăng nhập chỉ cho nhân viên; admin **mở ra internet** → khóa tạm theo tài khoản, idle timeout, thu hồi phiên; phân quyền 2 vai trò enforce ở NestJS; khung admin Refine + antd 5 tiếng Việt; quản lý người dùng; nhật ký thao tác (chỉ đọc); bull-board.
- Phụ thuộc: phase 01 xong; spike B, C có kết quả.

## Key Insights

- Refine `accessControlProvider` chỉ quyết định ẩn/hiện; mọi endpoint admin mặc định **từ chối** nếu không có quyền (guard toàn cục, deny-by-default).
- Một ma trận quyền duy nhất trong `packages/shared` dùng cho cả guard (enforce) và admin (ẩn UI) → không lệch nhau (DRY).
- Admin gọi API qua proxy nginx cùng origin → cookie phiên `HttpOnly`, không cần token trong JS.
<!-- Red Team: Auth/bull-board ngoài guard + vòng đời phiên — 2026-11-11 -->
- Handler auth và bull-board mount ở tầng Express, **ngoài** guard Nest → test phải duyệt router Express, không chỉ route Nest.
- Role đọc từ DB mỗi request (không tin role lưu trong phiên) → đổi vai trò có hiệu lực ngay.
<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Chỉ 2 vai trò (`ADMIN`, `RESULTS_OPERATOR`) cho nhóm nhân viên nhỏ; thêm vai trò khi có người thật cần (thêm giá trị enum + cột ma trận, không đổi kiến trúc).
<!-- Spike B/C results — 2026-11-12 -->
- Auth: chọn **Better Auth** (không cần Passport), ghim đúng `better-auth` 1.7.21 (đã chốt 2026-11-12: giữ bản đã spike). Báo cáo: `plans/reports/spike-c-261112-1007-better-auth-nest-results.md`.
<!-- Decisions after spike — 2026-11-12 -->
- Đã chốt 2026-11-12: hash mật khẩu giữ scrypt mặc định của Better Auth; **không có "quên mật khẩu"** (không gửi email), mật khẩu chỉ do `ADMIN` đặt/cấp lại mật khẩu tạm.
- Đã chốt 2026-11-12: tham số vận hành của auth (ngưỡng rate limit, khóa theo tài khoản, thời hạn phiên, idle timeout, TTL mật khẩu tạm, step-up, độ dài mật khẩu tối thiểu) **chỉnh trên trang `/settings` của admin**, lưu bảng `AppSetting` (có sẵn từ phase 01), không để env. Env chỉ còn secret/kết nối/`TRUST_PROXY_HOPS` và sàn an toàn (vd ngưỡng không được thấp tới mức tự khóa mọi người). Better Auth đọc `rateLimit` lúc khởi tạo → rate limit + khóa tài khoản tự làm ở Redis (đã có trong Non-functional), đọc setting qua cache ngắn; tắt hoặc nới rate limit có sẵn của Better Auth (chưa kiểm, kiểm khi làm).
- Bốn việc bắt buộc khi làm phase này:
  1. Allowlist default-deny ở Express theo `req.path` chính xác (`disabledPaths` không phủ path có tham số).
  2. Ghi đè `X-Forwarded-For` bằng `req.ip` trước handler (rate limit đọc thẳng XFF; nhiều giá trị dồn chung bucket); số hop qua `TRUST_PROXY_HOPS`.
  3. Đặt tường minh `disableOriginCheck: false`, `disableCSRFCheck: false` (BA tự tắt khi `NODE_ENV=test`).
  4. Ngưỡng rate limit đăng nhập chỉnh trên `/settings` (mặc định 3 lần/10 s/IP của Better Auth quá chặt cho mạng chung tại sân).
- Allowlist chưa đăng nhập (dưới `/api/v1`): `POST /auth/sign-in/email`, `POST /auth/sign-out`, `GET /auth/get-session`, `GET /health`. Danh sách endpoint đầy đủ lấy từ `auth.api` (45 endpoint); duyệt router Express không cho ra danh sách này.
- Refine: chọn **Refine 5 + @refinedev/antd 6.0.3 + antd 5.29.3** (không cần ProComponents). Việc bắt buộc: import `antd/es/locale/vi_VN`; patch React 19; `i18nProvider` cho nhãn Refine; `getPopupContainer` cho Select trong `FilterDropdown`; `title` list tường minh; `ThemedSider` bỏ qua `Layout.siderBg` (tự dựng sider tối); ghim `react-router@7`. Báo cáo: `plans/reports/spike-b-261112-1007-refine-antd-results.md`.
- Chưa kiểm: chặn truy cập thẳng route theo role (cần `CanAccess` + API tự kiểm role); XFF qua nginx/Traefik thật (chờ staging, spike D).

## Requirements

Functional
- Đăng nhập email + mật khẩu; đăng xuất; đổi mật khẩu; bắt đổi mật khẩu ở lần đăng nhập đầu khi được cấp mật khẩu tạm.
<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Vai trò: `ADMIN`, `RESULTS_OPERATOR`.
- Quản lý người dùng (chỉ `ADMIN`): danh sách lọc/tìm/phân trang server, tạo, đổi vai trò, khóa/mở, cấp lại mật khẩu tạm, "Đăng xuất mọi thiết bị".
- Không khóa/hạ quyền được chính mình và `ADMIN` đang hoạt động cuối cùng.
- Tạo `ADMIN` đầu tiên bằng lệnh CLI (không có tài khoản mặc định trong code).
- Khung admin: menu theo nhóm, trang chủ theo vai trò, bull-board cho `ADMIN`.
<!-- Red Team: Audit, phạm vi công khai, VĐV nhỏ tuổi, song ngữ — 2026-11-11 -->
- Màn "Nhật ký thao tác" chỉ đọc cho `ADMIN`: lọc theo người, đối tượng, hành động, khoảng ngày; phân trang server.
<!-- Decisions after spike — 2026-11-12 -->
- Trang **`/settings`** (chỉ `ADMIN`, nhóm menu Cấu hình): form theo nhóm (Đăng nhập & phiên, …; phase sau thêm nhóm của mình), mỗi mục có nhãn tiếng Việt, mô tả, giá trị mặc định, validate tại field, nút "Khôi phục mặc định"; lưu `AppSetting`, ghi `AuditLog`, có hiệu lực không cần redeploy.
<!-- Red Team: Auth/bull-board ngoài guard + vòng đời phiên — 2026-11-11 -->
- Thu hồi **mọi phiên** của user khi: đổi vai trò, reset/đổi mật khẩu, khóa tài khoản.
- `mustChangePassword` enforce ở guard toàn cục: khi cờ bật chỉ cho `/auth/me`, `/auth/change-password`, `/auth/logout`; còn lại 403 `PASSWORD_CHANGE_REQUIRED`.
- Mật khẩu tạm hết hạn sau thời hạn chỉnh trên `/settings` (mặc định ví dụ 24 giờ).
- Nhập lại mật khẩu (step-up, hiệu lực chỉnh trên `/settings`, mặc định ví dụ 5 phút) trước: mở lại/cưỡng chế kết quả (phase 07), điểm thủ công + công bố snapshot (phase 09), gộp VĐV (phase 05).

Non-functional
<!-- Red Team: Auth/bull-board ngoài guard + vòng đời phiên — 2026-11-11 -->
- Rate limit đăng nhập theo IP thật (mặc định ví dụ 5 lần/phút/IP, `/settings`) **và** khóa tạm theo tài khoản có backoff (mặc định ví dụ 5 lần sai → khóa 1 phút, nhân đôi mỗi lần, trần 30 phút; `/settings`), lưu Redis với tiền tố `QUEUE_PREFIX`. Thông báo lỗi chung "Email hoặc mật khẩu không đúng" (không lộ tài khoản bị khóa hay không tồn tại).
- Thời hạn phiên tuyệt đối trên `/settings` (mặc định ví dụ 12 giờ); idle timeout trên `/settings` (mặc định ví dụ 60 phút) cho mọi vai trò, kể cả máy tính bảng dùng chung ở bàn điều hành. Mọi thay đổi người dùng ghi `AuditLog`.

## Architecture

<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
Ma trận quyền (`packages/shared/src/permissions.ts`, theo nhóm menu)

| Nhóm menu / thao tác | ADMIN | RESULTS_OPERATOR |
|---|---|---|
| Giải đấu: giải, nội dung, danh sách, bốc thăm, lịch | toàn quyền | đọc |
| Nhập tỷ số: `start`, `un-start`, `save-progress`, `confirm`, `amend-scores` | có | có |
| Mở lại / cưỡng chế kết quả (`reopen`, `force-reopen`) | có (nhập lại mật khẩu) | không |
| Vận động viên: VĐV, cặp, import, gộp | toàn quyền | đọc |
| Xếp hạng | toàn quyền | không |
| Nội dung, Nhà tài trợ | toàn quyền | không |
| Cấu hình, Cài đặt hiển thị | toàn quyền | không |
| Người dùng, Nhật ký thao tác | toàn quyền | không |
| Hàng đợi: xem (`queues.read`) / retry–xóa (`queues.manage`) | có / có | không / không |

- Kiểu: `can(role, resource, action)`; action ∈ `list|read|create|update|delete|confirm|amend|reopen|publish|manage`.
- Decorator `@RequirePermission('matches', 'confirm')`; `@Public()` cho route public/auth; `@RequireStepUp()` cho thao tác nhạy cảm. Guard toàn cục: thiếu decorator trên route admin → 403 (deny-by-default).

Model (theo kết quả spike C)

```prisma
enum UserRole { ADMIN RESULTS_OPERATOR }
model User {
  id                     String    @id @default(uuid())
  email                  String    @unique
  name                   String
  role                   UserRole
  isActive               Boolean   @default(true)
  mustChangePassword     Boolean   @default(false)
  tempPasswordExpiresAt  DateTime?
  lastLoginAt            DateTime?
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt
}
// Better Auth: add its session/account/verification models generated by its CLI, mapped onto User.
// Fallback: UserCredential { userId, passwordHash(argon2) } + UserSession { id, userId, tokenHash, expiresAt, lastSeenAt, stepUpAt, ip, userAgent }.
```

Migration: `add_users_and_auth_sessions`.

API

<!-- Red Team: Auth/bull-board ngoài guard + vòng đời phiên — 2026-11-11 -->
| Method | Path | Quyền |
|---|---|---|
| POST | `/api/v1/auth/login`, `/auth/logout` | public (rate limit IP + khóa tạm theo tài khoản) |
| GET | `/api/v1/auth/me` | đã đăng nhập → `{ id, name, role, permissions[], mustChangePassword }` |
| POST | `/api/v1/auth/change-password` | đã đăng nhập; thu hồi các phiên khác |
| POST | `/api/v1/auth/step-up {password}` | đã đăng nhập → đánh dấu phiên đã nhập lại mật khẩu |
| GET | `/api/v1/admin/users?page&pageSize&sort&q&filter[role]&filter[isActive]` | users.list |
| POST/PATCH | `/api/v1/admin/users`, `/admin/users/:id` | users.create/update (đổi role → thu hồi phiên) |
| POST | `/api/v1/admin/users/:id/reset-password` → trả mật khẩu tạm 1 lần | users.update |
| POST | `/api/v1/admin/users/:id/revoke-sessions` | users.update |
| GET | `/api/v1/admin/audit-logs?filter[actorId]&filter[entity]&filter[action]&filter[from]&filter[to]&page&sort` | audit.list |
| GET | `/api/v1/admin/queues/*` (bull-board) | queues.read; POST/PUT/DELETE cần queues.manage |

- Ưu tiên bọc Better Auth sau controller Nest tường minh (`login`, `logout`, `me`, `change-password`) nếu spike C xác nhận khả thi; handler gốc chỉ mount cho đường dẫn bắt buộc, có trong allowlist.

Module Nest: `auth` (controller, service, session guard, step-up guard, account-lockout service), `users`, `access-control` (guard + decorator), `audit-logs` (controller đọc), `bull-board` (mount `@bull-board/express` dưới middleware kiểm session + quyền + `Origin`; mặc định chỉ đọc, thao tác ghi cần `queues.manage`).

Khung admin (`apps/admin`)
- `providers/data-provider.ts` (từ spike B), `auth-provider.ts` (gọi `/auth/me`, xử lý 401/403 `PASSWORD_CHANGE_REQUIRED`), `access-control-provider.ts` (dùng `can()` chung), `i18n` vi.
- Menu (Refine `resources` với `meta.parent`): **Giải đấu**, **Vận động viên**, **Xếp hạng**, **Nội dung**, **Nhà tài trợ**, **Cấu hình**, **Người dùng** (gồm Nhật ký thao tác). Phase sau thêm resource vào đúng nhóm.
- Trang chủ theo vai trò: `RESULTS_OPERATOR` vào thẳng màn "Nhập tỷ số" (phase 07); `ADMIN` thấy lối tắt: giải đang diễn ra, giải sắp tới, bài nháp.
- Hết idle timeout → về trang đăng nhập kèm thông báo "Phiên đã hết hạn do không thao tác", đăng nhập lại quay về đúng màn đang dùng.

Luồng người dùng (góc nhìn quản trị)
- Tạo người dùng: Người dùng → "Thêm" (1) → nhập email, tên, chọn vai trò (mặc định `RESULTS_OPERATOR`) → "Tạo" (2) → modal hiện mật khẩu tạm + hạn dùng + nút "Sao chép" (3). Mật khẩu tạm không xem lại được.
- Khóa: nút "Khóa" trên dòng → xác nhận "Khóa tài khoản X? Người này bị đăng xuất ngay." → phiên của user bị thu hồi.
- Thao tác nhạy cảm (vd mở lại kết quả): modal nhỏ "Nhập lại mật khẩu để tiếp tục" → thao tác chạy tiếp, không mất dữ liệu đang nhập.

## Related Code Files

Create
- `packages/shared/src/{permissions.ts,user-role.ts}`
- `packages/db/prisma/schema.prisma` (thêm model), migration `add_users_and_auth_sessions`
- `apps/api/src/modules/auth/{auth.module.ts,auth.controller.ts,auth.service.ts,session.guard.ts,step-up.guard.ts,require-step-up.decorator.ts,account-lockout.service.ts,must-change-password.guard.ts}`
- `apps/api/src/modules/access-control/{access-control.module.ts,permission.guard.ts,require-permission.decorator.ts,public.decorator.ts}`
- `apps/api/src/modules/users/{users.module.ts,admin-users.controller.ts,users.service.ts,session-revocation.service.ts,dto/*.ts}`
- `apps/api/src/modules/audit-logs/{audit-logs.module.ts,admin-audit-logs.controller.ts}`
- `apps/api/src/modules/queue/bull-board-mount.ts`
- `apps/api/src/cli/create-admin.ts`
- `apps/admin/src/providers/{data-provider.ts,auth-provider.ts,access-control-provider.ts}`, `apps/admin/src/i18n/vi.ts`, `apps/admin/src/layout/{admin-layout.tsx,menu-groups.ts}`, `apps/admin/src/pages/{login-page.tsx,change-password-page.tsx,role-home-page.tsx}`, `apps/admin/src/components/step-up-modal.tsx`, `apps/admin/src/resources/users/{user-list.tsx,user-create.tsx,user-edit.tsx}`, `apps/admin/src/resources/audit-logs/audit-log-list.tsx`
- Test: `apps/api/test/auth.e2e-spec.ts`, `apps/api/test/permission-coverage.e2e-spec.ts`, `apps/api/test/express-router-allowlist.e2e-spec.ts`, `apps/api/test/session-lifecycle.e2e-spec.ts`, `packages/shared/src/permissions.test.ts`

Modify: `apps/api/src/app.module.ts`, `apps/admin/src/app.tsx`.

## Implementation Steps

1. Chạy skill `ui-consistency:finding-patterns` rồi `ui-consistency:planning` trước task UI đầu tiên: chốt mẫu dùng chung của admin (bảng danh sách, thanh lọc, form 1 cột có nhóm, modal xác nhận, toast, empty state, nút hành động chính góc phải trên). Phase sau dùng lại, không tạo mẫu mới.
2. Viết `permissions.ts` (2 vai trò) + test ma trận.
3. Auth theo kết quả spike C (Better Auth hoặc dự phòng); sign-up, impersonation tắt; endpoint admin-plugin tắt hoặc chỉ `ADMIN`. Migration `--create-only` → review → áp dụng DB cục bộ (in host + tên DB trước).
4. Guard toàn cục theo thứ tự: session (nạp `User` từ DB, kiểm `isActive`, idle timeout theo `lastSeenAt`) → must-change-password (allowlist 3 đường dẫn) → permission → step-up (nếu có decorator). Route admin thiếu decorator → 403.
5. Test `permission-coverage`: duyệt mọi route Nest, khẳng định có `@Public` hoặc `@RequirePermission`. Test `express-router-allowlist`: duyệt **router Express** sau khi app khởi động (gồm handler auth và bull-board), gọi từng đường dẫn khi chưa đăng nhập → chỉ các đường dẫn trong allowlist (ghi từ spike C) được trả khác 401/403/404.
6. Rate limit login theo IP thật + `account-lockout.service.ts` (Redis, backoff); đổi mật khẩu; mật khẩu tạm có hạn; bắt đổi khi `mustChangePassword`; step-up.
7. Users CRUD + ràng buộc "không tự khóa, giữ ≥ 1 ADMIN đang hoạt động"; `session-revocation.service.ts` gọi ở đổi vai trò, reset/đổi mật khẩu, khóa; ghi `AuditLog`.
8. CLI `create-admin`: in host + tên DB, hỏi xác nhận, nhận email qua tham số, nhập mật khẩu ẩn từ stdin.
9. Mount bull-board dưới `/api/v1/admin/queues` sau middleware kiểm session + `queues.read` + `Origin` khớp `ADMIN_PUBLIC_URL`; method ghi cần `queues.manage`.
10. Màn Nhật ký thao tác (chỉ đọc, lọc server).
11. Admin: Refine + data/auth/access-control provider, `ConfigProvider` antd `locale=viVN` + theme token, layout, menu, trang login/đổi mật khẩu, trang chủ theo vai trò, modal step-up, resource Users, Nhật ký.
12. Chạy `ui-consistency:verifying` cho các màn admin vừa làm (login, users, nhật ký, layout) theo checklist đã chốt ở bước 1.
13. Deploy + migrate staging theo quy trình phát hành phase 01.

## Todo List

- [ ] ui-consistency: finding-patterns → planning (mẫu admin dùng chung)
- [ ] permissions.ts (ADMIN, RESULTS_OPERATOR) + test
- [ ] Auth theo spike C + migration `add_users_and_auth_sessions`; sign-up/impersonation tắt
- [ ] Guard: session từ DB + idle timeout, must-change-password, permission, step-up
- [ ] Test phủ route Nest + test allowlist router Express
- [ ] Rate limit IP + khóa tạm theo tài khoản; mật khẩu tạm có hạn
- [ ] Users CRUD + ràng buộc ADMIN cuối + thu hồi phiên + audit
- [ ] CLI create-admin
- [ ] bull-board sau session + quyền + Origin; chỉ đọc mặc định
- [ ] Màn Nhật ký thao tác
- [ ] Khung admin: providers, layout, menu, login, users, step-up
- [ ] ui-consistency: verifying
- [ ] Deploy + migrate staging

## Success Criteria

- Test tích hợp (Postgres + Redis cục bộ thật): đăng nhập đúng/sai, phiên hết hạn tuyệt đối, idle timeout, user bị khóa bị đăng xuất ngay, đổi vai trò → phiên cũ bị thu hồi, `RESULTS_OPERATOR` nhận 403 ở ≥ 1 endpoint mỗi nhóm không được phép.
- Test phủ route xanh: 0 route admin thiếu quyền; test router Express: 0 đường dẫn ngoài allowlist trả 2xx khi chưa đăng nhập; `POST .../sign-up/*` → 404.
- Đăng nhập lần 6 trong 1 phút từ cùng IP → 429; 5 lần sai liên tiếp cùng tài khoản từ nhiều IP → tài khoản bị khóa tạm, lỗi trả về vẫn là thông báo chung.
- `mustChangePassword = true` → mọi API ngoài 3 đường dẫn allowlist trả 403; mật khẩu tạm quá hạn → không đăng nhập được.
- Thao tác có `@RequireStepUp` không có step-up còn hạn → 403 `STEP_UP_REQUIRED`.
- bull-board: chưa đăng nhập → 401; `RESULTS_OPERATOR` → 403; `Origin` lạ → 403; retry/xóa job cần `queues.manage`.
- Admin: menu chỉ hiện nhóm được phép; `RESULTS_OPERATOR` không thấy Người dùng, Cấu hình, Xếp hạng.

## Risk Assessment

| Rủi ro | Khả năng × Tác động | Xử lý |
|---|---|---|
| Spike C trượt | Trung bình × Trung bình | Dự phòng Passport + phiên DB đã thiết kế sẵn |
| Endpoint của thư viện auth lọt ngoài guard | Trung bình × Cao | Test duyệt router Express + allowlist |
| Lệch quyền UI và server | Thấp × Cao | Một ma trận chung + test phủ route |
| Mất ADMIN duy nhất | Thấp × Cao | Ràng buộc trong service + CLI tạo lại |
| Khóa tạm bị lạm dụng để khóa người khác | Trung bình × Thấp | Khóa ngắn có backoff, tự mở; ADMIN mở tay |
| Idle timeout làm phiền bàn điều hành | Trung bình × Thấp | Chỉnh trên `/settings`; đăng nhập lại quay về đúng màn |

Rollback: migration chỉ thêm bảng; revert app về bản phase 02.

## Security Considerations

- Hash mật khẩu scrypt mặc định của Better Auth (đã chốt 2026-11-12); độ dài tối thiểu trên `/settings` (mặc định ví dụ 10).
- Cookie `HttpOnly; Secure; SameSite=Lax`; CSRF: chỉ nhận JSON + kiểm `Origin` khớp `ADMIN_PUBLIC_URL` cho request ghi (gồm bull-board).
<!-- Red Team: Tô-pô mạng, IP thật, rate limit, health — 2026-11-11 -->
- Rate limit dùng IP thật qua `trust proxy` (phase 01); không tin header IP do client gửi.
- Không trả password hash, session token qua API; audit mọi thay đổi vai trò, khóa, reset, thu hồi phiên, step-up thất bại.

## Next Steps

- Lát cắt dọc (tuần 4–6) dùng auth + khung admin này; phase 04 thêm resource vào nhóm Giải đấu, Cấu hình; dùng mẫu UI đã chốt.
