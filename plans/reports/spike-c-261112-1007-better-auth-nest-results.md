# Spike C - Better Auth trên NestJS: kết quả

Ngày: 2026-11-12. Thư mục spike: `spikes/better-auth-nest/` (ngoài workspace, `pnpm install --ignore-workspace`, lockfile gốc không đổi: `git status` chỉ thấy `spikes/`).
DB: `localhost:5433` / `kamito_tt_dev` / schema `spike_auth` (in ra trước mỗi lệnh DB). Không đụng schema `public`, không `db push`, không dùng migrate/push của Better Auth.

## Kết luận

**ĐẠT CÓ ĐIỀU KIỆN** - dùng Better Auth cho phase 03, kèm 6 biện pháp bắt buộc (mục "Ghi chú cho phase 03"). Không cần fallback Passport. 32/32 test e2e xanh (4 file), typecheck sạch.

Điều kiện quan trọng nhất: mặc định của Better Auth KHÔNG an toàn khi đứng sau proxy + Nest (xem "Phát hiện bảo mật"). Phải có allowlist default-deny ở Express và ghi đè `X-Forwarded-For`.

## Phiên bản và license (tra từ `npm view` + `pnpm licenses list`, trước khi cài)

| Gói | Bản | License | Publish gần nhất | Bảo trì |
|---|---|---|---|---|
| better-auth | 1.7.21 | MIT | 2026-11-11 17:58Z | rất tích cực: 1.7.18 (11-05), 1.7.19 (11-10), 1.7.20 (11-10), 1.7.21 (11-11) |
| auth (CLI sinh schema) | 1.7.21 | MIT | 2026-11-11 | cùng repo better-auth; `@better-auth/cli` cũ đã deprecated ("no longer supported") |
| @better-auth/core, prisma-adapter, utils... | 1.7.21 / 0.5.1 | MIT | cùng đợt | đi kèm better-auth |
| better-call, jose, kysely, @noble/hashes, zod (phụ thuộc gián tiếp) | - | MIT | - | - |
| pg | 8.23.1 | MIT | 2026-09-30 | ổn định |
| dotenv | 17.2.3 (khớp packages/db) | BSD-2-Clause | - | - |
| @prisma/client, adapter-pg, prisma | 7.10.1 (khớp repo) | Apache-2.0 | - | - |
| @nestjs/* 12.3.2, express 5.3.0 | khớp apps/api | MIT | - | - |
| @thallesp/nestjs-better-auth 2.8.0 | không cài | MIT | 2026-09-03 | cộng đồng; không dùng, tự mount handler |

Lưu ý chuỗi cung ứng: better-auth 1.7.21 mới publish chưa tới 1 ngày. pnpm 11 chặn qua `minimumReleaseAge`, spike phải thêm 9 dòng `minimumReleaseAgeExclude` (nằm trong `spikes/better-auth-nest/pnpm-workspace.yaml`). Phase 03: cân nhắc ghim bản cũ hơn >= 7 ngày (vd 1.7.18) và chạy lại bộ test này.

## Tiêu chí (phase file, mục 1-6)

| # | Tiêu chí | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | Mount `/api/v1/auth/*` trước body parser, không xung đột global prefix | PASS | `app.getHttpAdapter().getInstance().all('/api/v1/auth/*splat', toNodeHandler(auth))` gọi ngay sau `NestFactory.create`, trước `init()`; Nest vẫn để `bodyParser` mặc định. Test "body parser and global prefix coexist": sign-in raw 200, route JSON của Nest `/api/v1/session/login` parse body 200, `/api/auth/...` (sai prefix) 404 |
| 2 | Email+mật khẩu, admin plugin, adapter Prisma 7.10, schema qua migrate | PASS | CLI `auth generate --adapter prisma` -> chép model vào `prisma/schema.prisma` -> `prisma migrate dev --create-only` -> áp dụng. `prisma migrate status`: "Database schema is up to date". Xem ghi chú migrate bên dưới |
| 3 | Guard đọc cookie, nạp User từ DB mỗi request, `req.user {id, role}` | PASS | Test: đổi role trong DB OPERATOR->ADMIN->OPERATOR, `/admin/ping` đổi 403->200->403 mà không đăng nhập lại. Login/logout/hết hạn/ban/sai mật khẩu đều có test (bảng dưới) |
| 4 | Chạy sau proxy cùng origin, cookie đúng | PASS (mô phỏng) | nginx không cài trên máy -> proxy Node tự viết (`test/proxy-same-origin.e2e-spec.ts`): thêm client IP vào XFF như Traefik, chuyển XFF nguyên trạng như `docker/admin-api-proxy.conf`, đặt `X-Forwarded-Proto: https`, `Host` = host công khai. Cookie qua proxy: `Secure; HttpOnly; SameSite=Lax`, không có `Domain` (host-only), request kế tiếp dùng cookie -> `/me` đúng. Chưa kiểm với nginx/Traefik thật (spike D) |
| 5 | Endpoint tự mở của Better Auth | PASS (sau khi thêm allowlist) | Chi tiết bên dưới |
| 6 | Bọc sau controller Nest | KHẢ THI, có điều kiện | Mục "Bọc controller" |

### Chi tiết mục 3 và 5 (mỗi dòng = 1 test xanh)

| Hạng mục | Kết quả | Bằng chứng |
|---|---|---|
| Login thành công | PASS | `/me` -> `{id, role}` |
| Logout | PASS | sau `POST /sign-out`, `/me` 401 |
| Phiên hết hạn | PASS | set `session.expiresAt` về quá khứ -> 401 |
| User bị ban | PASS | `ban-user`: phiên cũ 401, login lại 403 `BANNED_USER`; unban đăng nhập lại 200; ban thẳng trong DB trên phiên còn sống -> guard trả 403 |
| Sai mật khẩu nhiều lần | PASS | 4 lần cùng IP: `[401,401,401,429]`; nhập đúng vẫn 429 trên IP đó (có header `X-Retry-After`); IP khác 200 |
| Sign-up tắt | PASS | `POST /sign-up/email`, `/sign-up/anything`, `/sign-up` -> 404; 7 biến thể (`/`, `//`, `/SIGN-UP/`, `%65mail`, `/./`, `/../`, query) -> 404; số user không đổi |
| Admin plugin | PASS | ẩn danh 401, OPERATOR 403 (kể cả `set-role` tự nâng quyền, role không đổi), ADMIN 200 |
| Impersonation tắt | PASS | `impersonate-user`, `stop-impersonating`, `remove-user` với phiên ADMIN -> 404 (Express allowlist). Lớp 2: bỏ allowlist, `disabledPaths` của BA vẫn 404. Lớp 3: gọi `auth.api.impersonateUser/removeUser` -> 403 (role ADMIN tự định nghĩa không có quyền `impersonate`/`delete`) |
| Rate limit trên handler đã mount | PASS | 429 như trên; lưu bằng `storage: 'database'` (bảng `rateLimit`), đếm theo `req.ip` của Express (`trust proxy` = 1) |
| Đếm IP thật, không tin XFF client gửi | PASS | gửi `X-Forwarded-For: 10.9.8.N, <ip thật>` đổi N mỗi lần: `[401,401,401,429,429]`; client khác dùng cùng prefix giả vẫn đăng nhập được (200). Kiểm đột biến: bỏ đoạn ghi đè XFF -> test rớt (`expected 429 to be 200`) |
| Mật khẩu tạm | PASS | admin `set-user-password` -> phiên cũ của user chết -> user login bằng mật khẩu tạm -> `/me` 403 `PASSWORD_CHANGE_REQUIRED` -> `change-password` -> cờ về false, login mới dùng được, mật khẩu tạm bị từ chối. Cổng cũng chặn route raw của ADMIN bị gắn cờ (`/admin/list-users` 403) |
| `admin/create-user` thay sign-up | PASS | user tạo ra có `mustChangePassword = true`, role `RESULTS_OPERATOR`; role bịa (`SUPERUSER`) bị từ chối (>= 400) |
| Thu hồi toàn bộ phiên | PASS | `admin/revoke-user-sessions`: cả 2 phiên của user đích 401, phiên user khác vẫn 200 |
| Cookie flags | PASS | `__Secure-better-auth.session_token=<redacted>; Max-Age=28800; Path=/; HttpOnly; Secure; SameSite=Lax` (`cookie-sample.txt`) |
| Lỗi đăng nhập không lộ email | PASS | email không tồn tại và sai mật khẩu: cùng 401, cùng body `{"message":"Invalid email or password","code":"INVALID_EMAIL_OR_PASSWORD"}`; thời gian trung bình 98 ms vs 97 ms (n=3, chỉ tham khảo) |
| CSRF | PASS | POST có cookie + `Origin` lạ -> 403; POST không cookie mang `Sec-Fetch-Site: cross-site` -> 403 |

### Hash mật khẩu

Mặc định: **scrypt** (`node:crypto`), định dạng `salt(32 hex):key(128 hex)`, N=16384, r=16, p=1, dkLen=64, salt ngẫu nhiên 16 byte, chuẩn hóa NFKC (nguồn: `@better-auth/utils@0.5.1/dist/password.node.mjs`; test xác nhận regex `^[0-9a-f]{32}:[0-9a-f]{128}$` trên dữ liệu thật).
Nhận định: hash có salt, memory-hard, hiện chấp nhận được; nhưng tham số thấp hơn mức OWASP ưu tiên (scrypt N=2^17, r=8, p=1) và `verify` so sánh chuỗi bằng `===` (không constant-time; rủi ro thực tế thấp vì salt riêng). Có thể thay qua `emailAndPassword.password.{hash, verify}` (kiểu có trong `@better-auth/core`, chưa chạy thử). Tôi đánh PASS cho "hash an toàn mặc định" nhưng khuyến nghị cân nhắc nâng tham số hoặc dùng argon2 qua hook này ở phase 03.

## Phát hiện bảo mật (quan trọng cho phase 03)

1. **Walk router Express vô dụng để liệt kê**: Better Auth chỉ hiện ra dưới dạng 1 route wildcard `/api/v1/auth/*splat` (test khẳng định). Danh sách phải lấy từ `auth.api` (45 endpoint, bên dưới).
2. **`disabledPaths` chỉ khớp chính xác**: không có wildcard, không phủ được path có tham số. Kết quả quét handler đứng một mình: `GET/POST /callback/:id` vẫn trả 302 khi chưa đăng nhập. Hậu quả: cần allowlist default-deny ở Express (`src/auth/raw-allowlist.ts`, khớp chính xác `req.path`), `disabledPaths` chỉ là lớp 2.
3. **Rate limit lấy IP chỉ từ header `X-Forwarded-For`, không dùng `trust proxy` của Express**. Nếu XFF có >1 giá trị và không cấu hình `trustedProxies` -> không xác định IP -> tất cả cùng rơi vào **một bucket chung** `no-trusted-ip` (mã nguồn `rate-limiter/index.mjs`, `ip.mjs`). Hệ quả: kẻ tấn công gửi `X-Forwarded-For` giả qua Traefik (nối thêm IP thật -> 2 giá trị) làm khóa đăng nhập của tất cả mọi người. Cách xử lý đã kiểm: middleware ghi đè `x-forwarded-for = req.ip` trước handler (dùng đúng cấu hình `TRUST_PROXY_HOPS` của phase 01).
4. **Origin/CSRF bị tắt ngầm khi `NODE_ENV=test`** (`skipOriginCheck: ... isTest() ? true : false`). Test của spike lần đầu thấy 200 thay vì 403 và còn đổi được mật khẩu bằng Origin lạ. Đã đặt tường minh `advanced.disableOriginCheck: false` và `disableCSRFCheck: false`. Phase 03 e2e (vitest đặt NODE_ENV=test) phải giữ hai cờ này.
5. **Rate limit chỉ nằm ở handler (`onRequest`)**: gọi `auth.api.*` từ controller Nest KHÔNG bị đếm (test: 6 lần sai liên tiếp qua wrapper đều 401, không có 429); cũng không qua `disabledPaths` và kiểm Origin. Dùng wrapper thì phải tự thêm throttle.
6. Rate limit mặc định chỉ theo `IP + path`, không có khóa theo tài khoản. 3 lần/10 giây/IP cho `/sign-in/email` (mặc định BA): nhiều người cùng IP giải đấu (NAT) có thể chặn nhau; 429 áp cả cho đăng nhập đúng. Cần chỉnh ngưỡng theo thực tế (cấu hình qua env, không fix cứng).
7. `GET /get-session` và `POST /sign-out` trả 200 khi chưa đăng nhập (bình thường, nằm trong allowlist).

## Danh sách route Better Auth (45 endpoint, lấy từ `auth.api`, `route-inventory.json`)

`GET /account-info`; admin: `POST ban-user, create-user, has-permission, impersonate-user, list-user-sessions, remove-user, revoke-user-session, revoke-user-sessions, set-role, set-user-password, stop-impersonating, unban-user, update-user`, `GET get-user, list-users` (tiền tố `/admin/`); `GET+POST /callback/:id`; `POST /change-email`; `POST /change-password`; `POST /delete-user`; `GET /delete-user/callback`; `GET /error`; `POST /get-access-token`; `GET+POST /get-session`; `POST /link-social`; `GET /list-accounts`; `GET /list-sessions`; `GET /ok`; `POST /refresh-token`; `POST /request-password-reset`; `POST /reset-password`; `GET /reset-password/:token`; `POST /revoke-other-sessions`; `POST /revoke-session`; `POST /revoke-sessions`; `POST /send-verification-email`; `POST /sign-in/email`; `POST /sign-in/social`; `POST /sign-out`; `POST /sign-up/email`; `POST /unlink-account`; `POST /update-session`; `POST /update-user`; `GET /verify-email`; `POST /verify-password`.

### Allowlist chưa đăng nhập (dùng cho e2e phase 03)

Raw handler (tiền tố `/api/v1/auth`): `POST /sign-in/email`, `POST /sign-out`, `GET /get-session`.
Nest: `GET /api/v1/health`, `POST /api/v1/session/login` (chỉ khi dùng wrapper).
Mọi thứ khác phải KHÔNG trả 2xx/3xx khi chưa có phiên. Test "layer B" quét toàn bộ 45 endpoint x method với body đủ trường (để validation không che): chỉ 2 kết quả 2xx (`GET /get-session`, `POST /sign-out`), còn lại 401/404/400/405; số user trong DB không đổi.

Cần đăng nhập (raw, sau allowlist Express): `/change-password`, `/admin/{create-user, list-users, get-user, set-role, set-user-password, ban-user, unban-user, list-user-sessions, revoke-user-session, revoke-user-sessions, update-user}`; admin plugin ép ADMIN. Bị chặn 404 hẳn: toàn bộ phần còn lại (sign-up, social, reset/verify email, delete/remove user, impersonate, link/unlink, token, ok, error, v.v.).

## Bọc controller Nest (bước 6)

Khả thi. `src/wrapped-session.controller.ts`: `POST /api/v1/session/login | logout | change-password` gọi `auth.api.signInEmail/signOut/changePassword({asResponse:true})` rồi chuyển tiếp `Set-Cookie`. `GET /api/v1/me` đã là route Nest. Test: với raw handler đóng hoàn toàn (`rawAllowlist: []`, mọi path raw 404) vẫn login/me/đổi mật khẩu/logout được, cookie đúng cờ. Cái giá: mất rate limit + kiểm Origin + `disabledPaths` (phát hiện 5) -> phải thêm throttle riêng (vd `@nestjs/throttler` theo IP + email) và kiểm Origin. Các thao tác admin (create-user, set-role, ban...) cũng phải bọc từng cái nếu muốn đóng hẳn raw handler.
Khuyến nghị: giữ raw handler với allowlist (rate limit DB + CSRF có sẵn, đã test), bọc controller chỉ khi frontend cần API ổn định/đặt tên riêng.

## Migrate (bước 2)

- Model sinh từ CLI, chỉnh khi chép: `role` thành enum `UserRole { ADMIN, RESULTS_OPERATOR }` default `RESULTS_OPERATOR`; `banned`, `mustChangePassword` NOT NULL default false; thêm trường `mustChangePassword` (additionalField, `input:false`). Better Auth ghi chuỗi vào enum được; `setRole`/create-user với role ngoài enum bị từ chối.
- SQL (`prisma/migrations/20261112031554_init_better_auth/migration.sql`, 100 dòng): enum + 5 bảng (`user, session, account, verification, rateLimit`) + index/FK; không có tham chiếu `public.`.
- Sai sót quy trình: lệnh `migrate dev --create-only` chạy lần 2 đã áp dụng migration vừa tạo (Prisma áp migration chờ trước khi tạo cái mới) và sinh thêm 1 migration rỗng (đã xóa, chưa từng áp dụng). Tức SQL được áp dụng trước khi tôi đọc; đã đọc lại sau đó, chỉ chạm schema `spike_auth`. Migrate dev cũng tự tạo/xóa 1 database shadow tạm trên server 5433.

## Ghi chú cho phase 03

1. Mount raw handler trước `init()`, giữ `bodyParser` mặc định của Nest; path literal `/api/v1/auth/*splat` (Express 5), không phụ thuộc global prefix.
2. Allowlist default-deny ở Express theo `req.path` chính xác (`raw-allowlist.ts`) + `disabledPaths` + role ADMIN không có quyền impersonate/delete (3 lớp).
3. Ghi đè `X-Forwarded-For` bằng `req.ip` (dựa `TRUST_PROXY_HOPS`) trước handler; đừng tin cấu hình IP mặc định của BA. Spike D phải xác nhận Traefik có nối/ghi đè XFF như giả định.
4. Đặt tường minh `disableOriginCheck:false`, `disableCSRFCheck:false`, `useSecureCookies:true`, `rateLimit.enabled:true`, `storage:'database'` (nhiều replica api không dùng bộ nhớ riêng); ngưỡng rate limit đưa ra cấu hình (env/setting), không fix cứng 3/10s.
5. Guard: `auth.api.getSession` rồi nạp lại `User` từ DB (role, banned, banExpires, mustChangePassword); chặn `mustChangePassword` ở cả guard Nest và hook `before` của BA (raw route).
6. Hook `after` của BA: `set-user-password` và `create-user` -> đặt cờ + xóa phiên; `change-password` -> bỏ cờ. Thêm audit log cho các thao tác admin (chưa làm trong spike).
7. Chưa kiểm/để phase 03: đổi tham số hash hoặc argon2; xóa bảng `rateLimit`/`session` hết hạn định kỳ (BA chỉ dọn rate limit lúc ghi); giữ `cookieCache` tắt (đã tắt, guard nạp DB mỗi request); thời hạn phiên spike 8 giờ (cấu hình); `prisma generate` + pin phiên bản chắc chắn.
8. Dự phòng Passport local + `UserSession` không cần dùng.

## Chạy lại

```
cd spikes/better-auth-nest
pnpm install --ignore-workspace
# .env (không commit): DATABASE_URL="...localhost:5433/kamito_tt_dev?schema=spike_auth"
#   BETTER_AUTH_SECRET=<ngẫu nhiên 32 byte hex>, BETTER_AUTH_URL=https://admin.spike.test, TRUST_PROXY_HOPS=1
pnpm exec prisma generate
pnpm exec prisma migrate status        # đã áp dụng; DB mới: prisma migrate deploy
pnpm exec tsc --noEmit
pnpm exec vitest run                   # 32 test, ~14 giây
```
File sinh khi test: `route-inventory.json`, `route-probe.json`, `route-layer-a*.json`, `cookie-sample.txt`, `login-error-sample.json`, `login-timing.json`. `src/generated/` và `.env` đã gitignore trong spike. Test tự xóa user đã tạo (bảng `rateLimit` giữ lại).

## Dọn dẹp (CHƯA chạy)

```sql
DROP SCHEMA spike_auth CASCADE;
```
Sau đó xóa thư mục `spikes/better-auth-nest/` nếu không cần giữ. Không có server nào còn chạy.

## Câu hỏi còn mở

- Traefik thật có nối hay ghi đè `X-Forwarded-For`? (spike D) - quyết định `TRUST_PROXY_HOPS`.
- Có muốn nâng hash (argon2/scrypt mạnh hơn) ngay phase 03 không?
- Ngưỡng rate limit đăng nhập phù hợp cho giải đấu (nhiều người chung IP)?
- Tính năng quên mật khẩu đã bị tắt (không có email); mật khẩu chỉ do admin đặt. Xác nhận đúng ý nghiệp vụ.

**Status:** DONE_WITH_CONCERNS
**Summary:** Better Auth đạt Spike C (32/32 test, schema qua `prisma migrate`, allowlist đã ghi); nên dùng, không cần fallback Passport.
**Concerns/Blockers:** 6 mặc định không an toàn phải vá (allowlist Express, ghi đè XFF, origin check tắt khi NODE_ENV=test, `auth.api` bỏ qua rate limit, bucket IP chung, 1.7.21 mới phát hành <1 ngày). Proxy chỉ mô phỏng bằng Node, chưa thử nginx/Traefik thật. Migration đầu được áp dụng trước khi review SQL (đã review sau, sạch).
