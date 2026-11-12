# Đăng nhập, phân quyền và API quản trị — Kamito

> Cập nhật: 2026-11-12 · Phạm vi: phase 03 (code chưa commit, chưa deploy staging).
> Nguồn đối chiếu: `apps/api/src/modules/{auth,access-control,users,settings,audit-logs,queue}`, `apps/api/src/cli/`, `packages/shared/src/{permissions,auth-settings,list-settings,app-setting-registry}.ts`, `packages/db/prisma/schema/auth.prisma`.
> Kiến trúc tổng thể xem [system-architecture.md](./system-architecture.md). Triển khai và tạo admin đầu tiên xem [deployment-guide.md](./deployment-guide.md#tạo-admin-đầu-tiên).

## Contents
- [Tổng quan](#tổng-quan)
- [Đăng nhập và phiên](#đăng-nhập-và-phiên)
- [Chuỗi guard](#chuỗi-guard)
- [Decorator](#decorator)
- [Ma trận quyền](#ma-trận-quyền)
- [Chống dò mật khẩu](#chống-dò-mật-khẩu)
- [Mật khẩu tạm, đổi mật khẩu, step-up](#mật-khẩu-tạm-đổi-mật-khẩu-step-up)
- [Cài đặt vận hành (/settings)](#cài-đặt-vận-hành-settings)
- [API quản trị](#api-quản-trị)
- [Hàng đợi (bull-board)](#hàng-đợi-bull-board)
- [Giới hạn đã biết](#giới-hạn-đã-biết)

## Tổng quan

- Đăng nhập bằng email và mật khẩu qua **Better Auth 1.7.21**. Không dùng plugin admin. Đăng ký tự do bị tắt (`disableSignUp: true`).
- Hai vai trò: `ADMIN`, `RESULTS_OPERATOR` (enum `UserRole` trong `packages/db/prisma/schema/auth.prisma`).
- Phân quyền **deny-by-default** ở NestJS. Admin UI chỉ ẩn những gì API sẽ từ chối.
- Mọi ngưỡng đăng nhập, khóa, phiên, và mật khẩu nằm trong bảng `AppSetting`, sửa được ở `/settings`.

## Đăng nhập và phiên

### Hai route do Better Auth xử lý trực tiếp

`apps/api/src/modules/auth/auth-raw-handler.ts` gắn Better Auth lên Express **trước** `app.init()`, để handler đọc body thô trước parser JSON của Nest. Allowlist là so khớp chính xác method và path:

| Method | Path (sau `/api/v1/auth`) | Ghi chú |
|---|---|---|
| POST | `/sign-in/email` | Có giới hạn theo IP (xem [Chống dò mật khẩu](#chống-dò-mật-khẩu)) |
| POST | `/sign-out` | |

Mọi route khác dưới `/api/v1/auth/*` (kể cả `/sign-in/email/`, hoa thường, `%2F`) không vào Better Auth, rơi về Nest hoặc 404.

### Route Nest

| Method | Path | Quyền | Response (`data`) |
|---|---|---|---|
| GET | `/api/v1/auth/me` | đăng nhập (`@RequireSession`), dùng được khi có mật khẩu tạm | `{ id, email, name, role, mustChangePassword, permissions[], listDefaultPageSize }` |
| POST | `/api/v1/auth/change-password` | đăng nhập, dùng được khi có mật khẩu tạm | `{ ok: true }` |
| POST | `/api/v1/auth/step-up` | đăng nhập | `{ stepUpExpiresAt }` |

`permissions` là danh sách dạng `resource.action`, ví dụ `users.list`. Admin UI dùng danh sách này để ẩn menu và nút.

### Phiên

| Thuộc tính | Nơi thực thi | Giá trị |
|---|---|---|
| Cookie | `auth-instance.ts` | `httpOnly`, `secure`, `sameSite: lax` |
| Thời hạn tuyệt đối | `session-resolver.service.ts`, mỗi request | `auth.session.maxAgeHours`, mặc định 12 giờ (1–72) |
| Hết hạn do không thao tác | `session-resolver.service.ts` | `auth.session.idleMinutes`, mặc định 60 phút (5–720) |
| Ghi `lastSeenAt` | `session-resolver.service.ts` | Tối đa một lần mỗi 60 giây |
| Trần của Better Auth | `session.expiresIn` | 72 giờ. Hạn thực tế do setting quyết định |

- Vai trò, `isActive`, `mustChangePassword` đọc từ bảng `User` ở **mỗi request**. Đổi vai trò hoặc khóa tài khoản có hiệu lực ngay.
- Tài khoản bị vô hiệu → xóa mọi phiên, trả `ACCOUNT_DISABLED`.
- Mã lỗi phiên (401): `UNAUTHORIZED`, `SESSION_EXPIRED`, `SESSION_IDLE_TIMEOUT`, `ACCOUNT_DISABLED`.
- Polling của bull-board không làm mới `lastSeenAt` (xem [Hàng đợi](#hàng-đợi-bull-board)).
- Token phiên lưu thô trong bảng `Session` (mặc định của Better Auth). Lộ dump DB = lộ phiên còn hạn. Đã ghi nhận ở [Giới hạn đã biết](#giới-hạn-đã-biết).

### Kiểm Origin

- Better Auth kiểm Origin với `trustedOrigins = origin của ADMIN_PUBLIC_URL` (`disableOriginCheck: false`).
- `TrustedOriginMiddleware` (`common/security/trusted-origin.ts`) áp dụng cho mọi request **ghi** dưới `admin/*` và `auth/*` (route Nest). Sai Origin → 403 `ORIGIN_MISMATCH`.
- Bull-board cũng kiểm Origin cho request ghi.

## Chuỗi guard

Bốn guard toàn cục đăng ký bằng `APP_GUARD` trong `auth.module.ts`, theo đúng thứ tự:

| # | Guard | Việc làm | Lỗi khi từ chối |
|---|---|---|---|
| 1 | `SessionGuard` | Route `@Public` bỏ qua. Còn lại: resolve phiên, gắn `AuthContext` vào request | 401 (xem mã phiên ở trên) |
| 2 | `MustChangePasswordGuard` | Nếu `mustChangePassword`, chỉ cho route `@AllowPendingPasswordChange` | 403 `PASSWORD_CHANGE_REQUIRED` |
| 3 | `PermissionGuard` | Route `@Public` → cho qua. Không có `AuthContext` → 403. Có `@RequirePermission` → kiểm ma trận. Chỉ có `@RequireSession` → cho qua. Không có gì → 403 | 403 `FORBIDDEN` |
| 4 | `StepUpGuard` | Route `@RequireStepUp`: `session.stepUpAt` còn trong `auth.stepUp.ttlMinutes` | 403 `STEP_UP_REQUIRED` |

Lỗi validate dữ liệu trả 422 `VALIDATION_FAILED` kèm `fields` (xem [code-standards.md](./code-standards.md#quy-ước-api)).

## Decorator

Khai báo ở `modules/access-control/access-decorators.ts` và `modules/auth/auth-decorators.ts`:

| Decorator | Ý nghĩa | Dùng ở |
|---|---|---|
| `@Public()` | Không cần phiên | Health endpoint, site công khai sau này |
| `@RequireSession()` | Cần đăng nhập, không cần quyền riêng | `GET /auth/me` (qua `AuthController`) |
| `@RequirePermission(resource, action)` | Cần quyền trong ma trận | Mọi route admin |
| `@AllowPendingPasswordChange()` | Dùng được khi đang có mật khẩu tạm | `/auth/me`, `/auth/change-password` |
| `@RequireStepUp()` | Cần nhập lại mật khẩu gần đây | Hiện **chưa gắn route nào** (kiểm 2026-11-12) |

Route Nest không có decorator nào → bị từ chối (deny-by-default).

## Ma trận quyền

Nguồn duy nhất: `packages/shared/src/permissions.ts` (`PERMISSION_MATRIX`). API guard và admin UI dùng chung hàm `can(role, resource, action)`.

**Resource:** `tournaments`, `matches`, `players`, `rankings`, `content`, `sponsors`, `settings`, `users`, `audit-logs`, `queues`.

**Action:** `list`, `read`, `create`, `update`, `delete`, `confirm`, `amend`, `reopen`, `publish`, `manage`.

| Resource | ADMIN | RESULTS_OPERATOR |
|---|---|---|
| `tournaments` | tất cả | `list`, `read` |
| `players` | tất cả | `list`, `read` |
| `matches` | tất cả | `list`, `read`, `update`, `confirm`, `amend` |
| `settings`, `users`, `audit-logs`, `queues` | tất cả | không |
| `rankings`, `content`, `sponsors` | tất cả | không |

- `reopen` và `publish` chỉ có ở ADMIN (ghi chú trong ma trận: thao tác mở lại kết quả là đặc quyền ADMIN).
- Thêm resource ở phase sau: thêm vào `PERMISSION_RESOURCES`, không thêm vai trò mới.

**Ánh xạ action của Refine** (`apps/admin/src/providers/access-control-provider.ts`): `list`→`list`, `show`→`read`, `create`→`create`, `edit`→`update`, `delete`→`delete`.

## Chống dò mật khẩu

Ba lớp, cấu hình được ở `/settings`:

| Lớp | Cơ chế | Setting (mặc định, khoảng) | Nơi thực thi |
|---|---|---|---|
| Theo IP | Đếm cố định theo cửa sổ, khóa `req.ip`. Vượt ngưỡng → 429 `TOO_MANY_REQUESTS` kèm `Retry-After` | `auth.login.ipMaxAttempts` (5, 3–1000); `auth.login.ipWindowSeconds` (60, 10–3600) | `login-ip-rate-limiter.service.ts`, `auth-raw-handler.ts` |
| Theo tài khoản | Đếm lỗi theo email (băm SHA-256), từ mọi IP. Đủ ngưỡng → khóa tạm. Thời gian khóa nhân đôi mỗi lần, trần `maxSeconds`. Mức khóa nhớ 24 giờ | `auth.lockout.maxFailures` (5, 3–50); `auth.lockout.baseSeconds` (60, 10–3600); `auth.lockout.maxSeconds` (1800, 60–86400) | `account-lockout.service.ts` (Lua, atomic cho bước ghi lỗi) |
| Thời gian phản hồi | Tài khoản không có, bị khóa, bị vô hiệu, hoặc mật khẩu tạm hết hạn đều trả `INVALID_EMAIL_OR_PASSWORD` và băm scrypt giả để cân thời gian | — | `auth-instance.ts` (`burnPasswordCheck`) |

Ghi chú:
- Redis lỗi → hai lớp theo IP và theo tài khoản **fail-open** (cho qua, ghi log lỗi). Đây là chủ đích để không khóa toàn bộ người vận hành trong ngày thi đấu.
- Khóa Redis có tiền tố `QUEUE_PREFIX`, email được băm, không lưu PII.
- Đăng nhập thành công: xóa bộ đếm lỗi và khóa của tài khoản, cập nhật `lastLoginAt`.
- **`TRUST_PROXY_HOPS` phải khớp số proxy thật.** Thiếu hop → IP thấy được là IP proxy → mọi người dùng chung một bucket IP, một người sai nhiều lần có thể khóa đăng nhập cả hệ thống. Thừa hop → client giả được `X-Forwarded-For`. Raw handler ghi đè `X-Forwarded-For` bằng `req.ip` trước khi Better Auth đọc, để IP lưu trong phiên không bị giả mạo.

## Mật khẩu tạm, đổi mật khẩu, step-up

**Mật khẩu tạm** (tạo khi cấp tài khoản hoặc reset):
- Sinh ngẫu nhiên bằng `randomInt`, bảng chữ không có ký tự dễ nhầm (`0/O`, `1/l/I`), dài tối thiểu 14 và không ngắn hơn `auth.password.minLength`.
- Hạn dùng theo `auth.tempPassword.ttlHours` (mặc định 24 giờ). Quá hạn mà chưa đổi → đăng nhập bị từ chối như sai mật khẩu. Quản trị phải reset lại.

**`POST /api/v1/auth/change-password`** — body `{ currentPassword, newPassword }`:
- `newPassword`: tối thiểu `auth.password.minLength` (mặc định 10, 8–64), tối đa 128, phải khác mật khẩu cũ.
- Tài khoản đang khóa → 422 `currentPassword`.
- Sai mật khẩu hiện tại → 422, ghi lỗi vào bộ đếm khóa, audit `auth.password.change.failed`.
- Thành công: thu hồi các phiên khác (`revokeOtherSessions`), xóa cờ `mustChangePassword`, audit `auth.password.change`, trả cookie phiên mới.

**`POST /api/v1/auth/step-up`** — body `{ password }`:
- Đúng → ghi `stepUpAt` vào phiên, trả `stepUpExpiresAt`. Hiệu lực `auth.stepUp.ttlMinutes` (mặc định 5).
- Sai → 422 `STEP_UP_FAILED`, ghi bộ đếm khóa, audit `auth.step-up.failed`.
- Đang khóa → 422 `STEP_UP_FAILED`, không ghi thêm lỗi (thông báo hiện vẫn là "Mật khẩu không đúng", xem giới hạn).

## Cài đặt vận hành (/settings)

Hai API:

| Method | Path | Quyền | Hành vi |
|---|---|---|---|
| GET | `/api/v1/admin/settings` | `settings.read` | Trả `data` (mỗi key: `key`, `group`, `label`, `value`, `defaultValue`, `isDefault`, `updatedAt`, `editor`) và `groups` |
| PUT | `/api/v1/admin/settings/:key` | `settings.update` | Body `{ value }`, validate bằng zod của key. Lưu `AppSetting`, audit `setting.update` |
| DELETE | `/api/v1/admin/settings/:key` | `settings.update` | Xóa dòng DB, quay về mặc định. Audit `setting.reset` |

- Key không có hoặc không cho sửa → 404 `SETTING_NOT_FOUND`.
- Cache trong từng replica 10 giây. Replica ghi thấy thay đổi ngay, replica khác thấy sau tối đa 10 giây.

**Danh sách key sửa được** (nguồn: `packages/shared/src/auth-settings.ts`, `list-settings.ts`):

| Key | Nhóm | Mặc định | Khoảng | Đơn vị |
|---|---|---|---|---|
| `auth.login.ipMaxAttempts` | auth | 5 | 3–1000 | lần |
| `auth.login.ipWindowSeconds` | auth | 60 | 10–3600 | giây |
| `auth.lockout.maxFailures` | auth | 5 | 3–50 | lần |
| `auth.lockout.baseSeconds` | auth | 60 | 10–3600 | giây |
| `auth.lockout.maxSeconds` | auth | 1800 | 60–86400 | giây |
| `auth.session.maxAgeHours` | auth | 12 | 1–72 | giờ |
| `auth.session.idleMinutes` | auth | 60 | 5–720 | phút |
| `auth.tempPassword.ttlHours` | auth | 24 | 1–168 | giờ |
| `auth.stepUp.ttlMinutes` | auth | 5 | 1–60 | phút |
| `auth.password.minLength` | auth | 10 | 8–64 | ký tự |
| `list.defaultPageSize` | list | 20 | 5–100 | dòng |

Khoảng min/max là rào an toàn để validate, không phải giá trị nghiệp vụ. Ví dụ: không cho đặt ngưỡng khóa làm khóa tất cả mọi người.

## API quản trị

Tất cả trả lỗi theo dạng `{ error: { code, message, fields? } }`. Mọi route đều qua bốn guard ở trên.

### Người dùng `/api/v1/admin/users`

| Method | Path | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/` | `users.list` | Query: `page`, `pageSize`, `sort` (`createdAt`, `name`, `email`, `role`, `lastLoginAt`; `:asc` hoặc `:desc`), `q` (tìm theo tên và email, không phân biệt hoa thường), `filter[role]` (nhiều giá trị ngăn bởi dấu phẩy), `filter[isActive]` (`true`/`false`). Mặc định sắp `createdAt` giảm dần |
| GET | `/:id` | `users.read` | 404 `USER_NOT_FOUND` |
| POST | `/` | `users.create` | Body `{ email, name, role? }` (`role` mặc định `RESULTS_OPERATOR`). Trả `{ user, tempPassword, tempPasswordExpiresAt }`. Email trùng → 422 |
| PATCH | `/:id` | `users.update` | Body một phần `{ name, role, isActive }`. Không đổi trường không thay đổi. Đổi vai trò hoặc khóa → thu hồi mọi phiên của user đó |
| POST | `/:id/reset-password` | `users.update` | Sinh mật khẩu tạm mới, thu hồi phiên, xóa khóa. Trả `{ tempPassword, tempPasswordExpiresAt }` |
| POST | `/:id/revoke-sessions` | `users.update` | Trả `{ revoked }` (số phiên đã xóa) |

Ràng buộc:
- Không tự đổi vai trò hoặc tự khóa chính mình → 422 `CANNOT_MODIFY_SELF`. Không tự reset mật khẩu chính mình (dùng đổi mật khẩu) → 422 `CANNOT_MODIFY_SELF`.
- Luôn phải còn ít nhất một `ADMIN` đang hoạt động → 409 `LAST_ACTIVE_ADMIN`. Kiểm trong transaction `Serializable`. Hai thao tác đồng thời bị từ chối → 409 `CONCURRENT_UPDATE`.
- Trả về không bao giờ có hash mật khẩu hay token (`USER_VIEW_SELECT`).
- Mở khóa (`isActive: true`) xóa bộ đếm khóa của tài khoản.

**Audit action** ghi từ luồng này: `user.create`, `user.lock`, `user.unlock`, `user.role.change`, `user.update`, `user.password.reset`, `user.sessions.revoke`.

### Nhật ký thao tác `/api/v1/admin/audit-logs`

- `GET /` cần `audit-logs.list`. Chỉ đọc. Không có route ghi, sửa, hay xóa.
- Query: `page`, `pageSize`, `sort=createdAt:asc|desc` (mặc định `desc`), `filter[actorId]`, `filter[entity]`, `filter[action]` (so khớp tiền tố, ví dụ `user.` hoặc `setting.`), `filter[from]` và `filter[to]` (ngày ISO, lọc trên `createdAt`).
- Response: `{ data, total, page, pageSize }`. Mỗi dòng có thêm `actorName` (lấy từ `User.name`, `null` nếu actor là `SYSTEM`).
- Ngày không đọc được → 400 `INVALID_QUERY`.

**Audit action** khác (không thuộc users/settings): `auth.password.change`, `auth.password.change.failed`, `auth.step-up.failed`, `setting.update`, `setting.reset`, `user.admin.create.cli`, `user.admin.restore.cli` (từ CLI, actor `SYSTEM`). Dữ liệu `before` và `after` đi qua `maskPii` trước khi ghi.

### Phân trang và tìm kiếm

Áp dụng chung cho mọi danh sách (`parsePaginationQuery`, xem [code-standards.md](./code-standards.md#quy-ước-api)):
- `pageSize` mặc định lấy từ `list.defaultPageSize`. Trần cứng là `PAGINATION_MAX_PAGE_SIZE` (env, mặc định 100). Admin UI đọc `listDefaultPageSize` từ `/auth/me`.
- `page` tối đa 10 000.
- `q` tối đa `QUERY_MAX_LENGTH` ký tự (env, mặc định 100).

## Hàng đợi (bull-board)

- Đường dẫn: `/api/v1/admin/queues`. Mount bằng Express trước Nest (`queue/bull-board-mount.ts`). Nginx admin chuyển tiếp `/api/v1/admin/*` nên đường này truy cập được từ domain admin.
- Bull-board nằm ngoài guard Nest, nên tự lặp lại các kiểm tra theo thứ tự:
  1. Resolve phiên. Không có → 401 `UNAUTHORIZED`.
  2. `mustChangePassword` → 403 `PASSWORD_CHANGE_REQUIRED`.
  3. `GET`/`HEAD` cần `queues.read`. Ghi cần `queues.manage`. Sai → 403 `FORBIDDEN`.
  4. Ghi phải có Origin đúng → 403 `ORIGIN_MISMATCH`.
- Chỉ ADMIN có quyền `queues`.
- Request polling của UI (đường dẫn `/api/*` bên trong bull-board) **không** làm mới `lastSeenAt`. Chỉ thao tác của người dùng mới gia hạn phiên.
- Một `Queue` BullMQ cho mỗi giá trị trong `QueueName` (`packages/shared/src/queue-names.ts`). Hiện chỉ có `maintenance`, chưa có processor nào.

## Giới hạn đã biết

Danh sách lấy từ review phase 03 (`plans/reports/code-reviewer-261112-phase-03-auth-rbac.md`). Trạng thái ghi theo **code hiện tại** đã kiểm ngày 2026-11-12.

| Mã review | Vấn đề | Trạng thái |
|---|---|---|
| H1 | `change-password` dò được mật khẩu không giới hạn | Đã sửa (có khóa và audit) |
| M1 | Polling bull-board giữ phiên sống mãi | Đã sửa (`touch: false` cho `/api/*`) |
| M2 | Lệch thời gian phản hồi khi tài khoản bị khóa | Đã sửa (`burnPasswordCheck`) |
| M3 | Burst song song từ nhiều IP vượt ngưỡng khóa trước khi khóa được đặt (check-then-act) | Một phần: ghi lỗi + đặt khóa nguyên tử bằng Lua (không nhảy cấp, không đếm khi đang khóa); vẫn còn khe giữa bước kiểm (before-hook) và bước ghi (after-hook) cho request song song, bị chặn thêm bởi rate limit theo IP |
| M4 | Phân trang fix cứng ở admin và env | Đã sửa (`list.defaultPageSize` trong `/settings`) |
| L1 | Step-up khi đang khóa vẫn báo "Mật khẩu không đúng" | Một phần (không đếm thêm lỗi, chưa có mã riêng) |
| L2 | Đổi mật khẩu không nguyên tử với cờ `mustChangePassword` | **Còn mở** |
| L3 | Cửa sổ đếm lỗi đang dùng `maxSeconds` | **Còn mở** |
| L4 | `LOCK_LEVEL_MEMORY_SECONDS` = 24 giờ, fix cứng | **Còn mở** |
| L5 | Redis lỗi → fail-open không có cảnh báo vận hành | **Còn mở** |
| L6 | Chặn `\` trong redirect sau đăng nhập | Đã sửa (`auth-provider.ts`) |
| L7 | Lỗi cập nhật `lastLoginAt` làm sign-in trả 500 dù phiên đã tạo | **Còn mở** |
| L8 | Sign-in raw không đi qua `TrustedOriginMiddleware` (Better Auth vẫn kiểm Origin) | **Còn mở** |
| L9 | CLI `create-admin` không xóa khóa Redis của tài khoản | **Còn mở** |
| L10 | Diff khi cập nhật user đọc ngoài transaction | **Còn mở** |
| L11 | Token phiên lưu thô trong DB | Ghi nhận (mặc định Better Auth) |
| — | `@RequireStepUp` chưa gắn route. Đề xuất gắn cho settings và reset-password | **Còn mở** (quyết định của chủ repo) |
| — | E2E (`apps/api/test/*.e2e-spec.ts`, 13 file) | Đã chạy 2026-11-12 trên Postgres + Redis dev local: API 18 file / 87 test pass |
| — | CLI `create-admin` chết ở câu hỏi thứ hai khi stdin là pipe | Đã sửa (một line reader dùng chung, có test) |

Ghi chú rủi ro vận hành:
- Khi `auth.lockout.maxSeconds` nhỏ hơn `auth.lockout.baseSeconds`, code dùng `max(maxSeconds, baseSeconds)` làm trần (`account-lockout.service.ts`). Cửa sổ đếm lỗi cũng lấy giá trị này (mục L3).
- Redis `noeviction` là yêu cầu chung của queue. Khóa đăng nhập cũng nằm trên cùng Redis theo `QUEUE_PREFIX`.

## Liên quan

- [system-architecture.md](./system-architecture.md): thành phần, luồng khởi động, quyết định kiến trúc.
- [code-standards.md](./code-standards.md): quy ước API, audit, PII.
- [deployment-guide.md](./deployment-guide.md): biến môi trường, tạo admin đầu tiên, kiểm tra sau deploy.
