# Code review — phase 03 auth / RBAC / users / admin shell (uncommitted)

Ngày: 2026-11-12 · Phạm vi: diff chưa commit (api auth, access-control, users, settings, audit-logs, bull-board, cli, shared, prisma, admin) · Đọc thêm nguồn `better-auth@1.7.21` đã cài để kiểm chứng hành vi.

## Kiểm chứng đã chạy

- `pnpm -r --filter @kamito/api --filter @kamito/shared --filter @kamito/admin typecheck` → pass cả 3.
- `npx vitest run src` (apps/api, unit) → 3 file, 28 test pass.
- **Chưa chạy** e2e (`test/*.e2e-spec.ts`) vì cần Postgres + Redis thật; chưa xác nhận DB đích nên không chạy.

## Đánh giá chung — 8/10

Thiết kế auth chắc tay: deny-by-default 3 tầng (Session → MustChangePassword → Permission → StepUp), allowlist raw Better Auth chỉ 2 route, ghim `X-Forwarded-For` theo `req.ip`, Origin check cho mọi ghi dưới `/admin` + `/auth` + bull-board, role/isActive đọc DB mỗi request, last-admin dùng Serializable, log redact cookie/set-cookie, `USER_VIEW_SELECT` không lộ hash. Có e2e duyệt router Express. Không thấy lỗ Critical. Các điểm dưới đây là bypass phụ và lệch luật cấu hình.

Đã kiểm chứng trong nguồn BA:
- Before hook ném lỗi → after hook **không** chạy (`dispatch.mjs:212`), nên thử khi đang khóa không leo thang lock level. OK.
- BA sign-in tự `email.toLowerCase()` (`routes/sign-in.mjs:317`) khớp `normalizeEmail` → không lách lockout bằng hoa/thường. OK.
- BA `changePassword` trả `BAD_REQUEST INVALID_PASSWORD` khi sai mật khẩu hiện tại (`routes/update-user.mjs:172`) — không đi qua lockout (xem H1).
- BA `validateOrigin` chỉ ép Origin khi request có cookie (`middlewares/origin-check.mjs:108`); sign-in không cookie dựa vào `formCsrfMiddleware`.

## Critical

Không có.

## High

### H1. `/auth/change-password` cho dò mật khẩu hiện tại không giới hạn
- `apps/api/src/modules/auth/auth.service.ts:32-56`
- Kịch bản: kẻ có cookie phiên bị đánh cắp (máy tính bảng dùng chung ở bàn điều hành) gọi lặp `POST /auth/change-password` với `currentPassword` đoán. Sai → 422, không `lockout.recordFailure`, không check `isLocked`, không rate limit IP. Đoán trúng → đổi mật khẩu, mọi phiên khác bị thu hồi → chiếm hẳn tài khoản (kể cả ADMIN). Step-up thì có lockout, change-password thì không — không nhất quán.
- Sửa: trước khi gọi BA, `if (await lockout.isLocked(user.email)) throw fieldError('currentPassword', ...)`; khi upstream trả `INVALID_PASSWORD` → `await lockout.recordFailure(user.email)` + audit `auth.password.change.failed`.

## Medium

### M1. bull-board polling giữ phiên sống mãi, vô hiệu idle timeout
- `apps/api/src/modules/queue/bull-board-mount.ts:25-27` gọi `SessionResolver.resolve` → `session-resolver.service.ts:59-61` ghi `lastSeenAt`.
- UI bull-board tự poll API vài giây/lần. ADMIN để tab bull-board mở trên máy chung → phiên không bao giờ hết idle (chỉ còn hạn tuyệt đối 12h mặc định).
- Sửa: thêm tham số `resolve(headers, { touch: false })` cho request poll nền (bull-board `GET .../api/*`), chỉ touch cho request do người thao tác (Nest routes, hoặc bull-board GET trang UI).

### M2. Oracle thời gian lộ tài khoản bị khóa / vô hiệu / mật khẩu tạm hết hạn
- `apps/api/src/modules/auth/auth-instance.ts:56-60` + `sign-in-policy.service.ts:13-23`.
- Khi `allowAttempt` trả false, hook ném 401 ngay, **không** băm scrypt; còn email không tồn tại / sai mật khẩu thì BA băm (`sign-in.mjs:320,331`). Phản hồi nhanh hơn hẳn → biết email đó tồn tại và đang bị khóa/vô hiệu, và biết lúc nào lock hết để dò tiếp. Body giống nhau nhưng timing thì không.
- Sửa: trong before hook, trước khi ném `INVALID_CREDENTIALS`, chạy `await ctx.context.password.hash(String(body.password ?? ''))` (hoặc `hashPassword`) để cân thời gian.

### M3. Lockout check-then-act: burst song song vượt ngưỡng
- `account-lockout.service.ts:24-52`, `auth-instance.ts:56-71`.
- `isLocked` đọc ở before hook, `recordFailure` ở after hook. N request song song (nhiều IP để né limiter IP) đều qua `isLocked=false` trước khi lock được set → mỗi đợt lock được `maxFailures + N` lần đoán. Đồng thời nhiều lần `incr` ≥ ngưỡng cùng lúc làm `lock-level` nhảy nhiều bậc.
- Sửa: đếm **lượt thử** nguyên tử ở before hook (`INCR attempt` có TTL, từ chối khi > ngưỡng), after hook chỉ xóa khi thành công; hoặc dùng Lua script set lock + level 1 lần (chỉ leo level khi `SET lock NX` thành công).

### M4. Tham số phân trang để ở env + admin fix cứng 20 — lệch luật "/settings"
- `apps/api/src/common/pagination/pagination-limits.ts:4-9` (`PAGINATION_DEFAULT_PAGE_SIZE`, `PAGINATION_MAX_PAGE_SIZE`, `QUERY_MAX_LENGTH` từ env); `apps/admin/src/providers/data-provider.ts:10` (`?? 20`), `apps/admin/src/resources/audit-logs/audit-log-list.tsx:21` (`pageSize: 20`).
- Luật dự án: page size là tham số vận hành → setting trên `/settings`, env chỉ làm trần/sàn. Hiện admin không sửa được, và client fix cứng 20 trùng với default server.
- Sửa: thêm group `pagination` vào registry (`defaultPageSize`, `maxPageSize`), env giữ làm trần cứng; client bỏ `?? 20`, để server áp default (hoặc đọc default từ `/admin/settings`).
- Cũng nên chặn `page` trên (vd `page * pageSize <= 2^31`) — `page=1e15` hiện tạo `skip` khổng lồ → lỗi Prisma 500 / quét offset sâu (`pagination-query.ts:26`).

## Low

- **L1. Step-up khi đang khóa vẫn đếm thêm lỗi** — `auth.service.ts:67-71`: `ok=false` do `isLocked` vẫn `recordFailure` → người dùng (hoặc phiên bị chiếm) bấm thử lúc đang khóa sẽ kéo dài khóa, và báo "Mật khẩu không đúng" dù nhập đúng. Tách nhánh: locked → 429/`ACCOUNT_LOCKED` không record.
- **L2. Đổi mật khẩu không nguyên tử với cờ `mustChangePassword`** — `auth.service.ts:44-60`: BA đổi hash xong, `prisma.user.update` lỗi → mật khẩu đã đổi nhưng cờ còn; sau khi `tempPasswordExpiresAt` qua, `allowAttempt` chặn luôn mật khẩu mới → phải nhờ admin reset. Sửa: ghi cờ trước (hoặc bọc retry), hoặc `allowAttempt` chỉ xét hết hạn khi hash còn là hash tạm.
- **L3. Cửa sổ đếm lỗi gắn với `lockoutMaxSeconds`** — `account-lockout.service.ts:41`: admin đặt `maxSeconds=60` thì đếm lỗi chỉ trong 60s trượt; dò cách quãng >60s không bao giờ bị khóa. Nên là setting riêng (`auth.lockout.failureWindowSeconds`) hoặc `max(maxSeconds, giá trị sàn)`.
- **L4. `LOCK_LEVEL_MEMORY_SECONDS = 24h` fix cứng** — `account-lockout.service.ts:11`: tham số vận hành, nên đưa lên `/settings` cùng nhóm lockout.
- **L5. Redis sập = không còn rate limit lẫn lockout** — `login-ip-rate-limiter.service.ts:33-36`, `account-lockout.service.ts:27-30` fail-open (có chủ đích). Đề nghị ít nhất cảnh báo/metric khi rơi vào nhánh này để vận hành biết đang mở cửa.
- **L6. `safeRedirect` cho qua `/\evil.com`** — `apps/admin/src/providers/auth-provider.ts:22-24`. Qua react-router `pushState` thì trình duyệt chặn cross-origin nên khó khai thác, nhưng nên chặn thêm `\` (`/^\/(?![\/\\])/`).
- **L7. after hook `onSuccess` lỗi → 500 nhưng phiên đã tạo** — `sign-in-policy.service.ts:29-32`: update `lastLoginAt` lỗi làm request 500, phiên DB mồ côi (không cookie). Bọc try/catch + log, không fail đăng nhập vì cột thống kê.
- **L8. Sign-in raw không qua `TrustedOriginMiddleware`** — chỉ dựa vào BA (`validateOrigin` khi có cookie + `formCsrfMiddleware`). Có thể gọi `hasTrustedOrigin` trong `auth-raw-handler.ts:39` cho đồng nhất với plan "kiểm Origin mọi request ghi"; rẻ, chặn luôn login-CSRF.
- **L9. CLI `create-admin` không xóa lockout Redis** — `apps/api/src/cli/create-admin.ts:43-61`: khôi phục admin đang bị khóa vẫn phải chờ hết lock (tới 30 phút mặc định). Thêm xóa key lockout (cần `QUEUE_PREFIX` + Redis) hoặc ghi chú trong docs.
- **L10. `UsersService.update` diff trên dữ liệu đọc ngoài transaction** — `users.service.ts:50-62`: `before` trong audit có thể cũ nếu 2 admin sửa cùng lúc. Đọc `current` bên trong tx Serializable.
- **L11. Session token lưu thô trong DB** (mặc định BA, `auth.prisma:29`). Ghi nhận rủi ro: lộ dump DB = chiếm phiên. Chấp nhận được với phiên ngắn; ghi vào docs bảo mật.

## Ghi nhận (không phải lỗi)

- `@RequireStepUp` chưa gắn route nào — đúng plan (dùng ở phase 05/07/09). Cân nhắc gắn sớm cho `PUT/DELETE /admin/settings/:key` (sửa ngưỡng lockout/rate limit) và `POST /admin/users/:id/reset-password` vì đều là thao tác chiếm quyền được.
- Mỗi request có session = 2 query (BA `getSession` + `findUnique` session/user) + ghi `lastSeenAt` mỗi 60s. Chấp nhận được ở quy mô này.
- `TRUST_PROXY_HOPS` mặc định 0; compose prod bắt buộc khai (`docker-compose.yml:49`). Nếu khai sai sau proxy, mọi client chung 1 bucket IP → khóa đăng nhập toàn hệ thống. Spike D cần chốt.

## Edge case đã soát và thấy ổn

- Route Nest thiếu decorator → 403 (`permission.guard.ts:25`); chưa đăng nhập → 401 ở SessionGuard.
- Allowlist raw: so khớp chính xác method + subPath; `/sign-in/email/`, `%2F`, hoa/thường đều rơi về Nest 404.
- Absolute + idle timeout xét theo setting mỗi request, xóa phiên khi hết; user bị vô hiệu → xóa mọi phiên.
- Đổi vai trò / khóa → thu hồi phiên trong cùng tx; reset password thu hồi phiên + xóa lockout.
- Last-active-admin: Serializable + count có index `(role,isActive)` → SSI bắt được 2 admin hạ nhau; map P2034 → 409.
- `mustChangePassword` chặn cả bull-board; temp password ≥ 14 ký tự, `randomInt`.
- Audit không chứa mật khẩu/token; `maskPii` áp cho before/after; log pino redact cookie/set-cookie/password/token.
- Filter/sort whitelist, `q` giới hạn độ dài, Prisma tham số hóa → không injection.

## Việc nên làm (theo thứ tự)

1. H1: lockout + audit cho change-password.
2. M2: cân thời gian ở before hook.
3. M1: không touch `lastSeenAt` cho poll nền bull-board.
4. M3: đếm lượt thử nguyên tử.
5. M4: đưa page size lên `/settings`, bỏ fix cứng 20 ở admin, chặn `page` trên.
6. Low theo thời gian cho phép; chạy e2e trên DB dev local trước khi commit.

## Câu hỏi mở

- Có chấp nhận giữ phân trang ở env cho phase 03 rồi chuyển `/settings` sau không? (luật dự án nói nên ở `/settings`).
- Có muốn gắn `@RequireStepUp` cho settings/reset-password ngay phase 03 không?

**Status:** DONE_WITH_CONCERNS
**Summary:** Không có lỗi Critical; 1 High (dò mật khẩu qua change-password không có lockout), 4 Medium (bull-board vô hiệu idle timeout, oracle thời gian, lockout race, phân trang để env/fix cứng), 11 Low. Typecheck + unit test pass; e2e chưa chạy.
**Concerns/Blockers:** e2e chưa chạy do cần DB/Redis thật — cần chạy trước khi commit.
