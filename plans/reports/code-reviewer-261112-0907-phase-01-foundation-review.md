# Code review — Phase 01 foundation (2026-11-12)

Phạm vi: toàn bộ file tạo mới ở phase 01 (monorepo, packages, 4 app, docker, compose, CI). Reviewer chạy thử image đã build trong WSL Docker bằng env giả, không đụng DB, không đọc `.env`.

## Kết quả + xử lý

| # | Mức | Vấn đề | Xử lý |
|---|---|---|---|
| C1 | Critical | Admin chết lúc start: nginx user không ghi được `/usr/share/nginx/html/config.json` | Đã sửa: ghi `/tmp/admin-config/config.json`, nginx `alias`; smoke 200 |
| H1 | High | nginx resolve `api` 1 lần lúc start → `[emerg] host not found`, IP cũ sau khi api tạo lại | Đã sửa: `resolver 127.0.0.11` + `proxy_pass $api_upstream` |
| H2 | High | `REDIS_EVICTION_CHECK_OVERRIDE` bỏ qua cả policy đọc được mà sai | Đã sửa: override chỉ khi không đọc được policy; thêm test |
| H3 | High | Đụng tên DNS `api` trên `dokploy-network` dùng chung | Hoãn: kiểm ở Spike D (alias riêng hoặc Isolated Deployment) |
| M1 | Medium | `add_header` ở location làm mất security header cấp server | Đã sửa: snippet `admin-security-headers.conf` include từng location |
| M2 | Medium | Redis không tới được → worker/api treo vô hạn | Đã sửa: `probeRedisEvictionPolicy` (connection riêng, fail-fast); worker thoát mã 1 sau ~6 s; api tắt offline queue + chờ ready có hạn |
| M3 | Medium | Secret placeholder `.env.example` qua validate | Đã sửa: từ chối giá trị bắt đầu `replace-with`/`change-me` |
| M4 | Medium | `MIGRATE_CONFIRM_TARGET` không xét port | Đã sửa: khóa `host:port/database` |
| M5 | Medium | Danh sách khóa che PII hẹp | Đã sửa: khớp chuỗi con (phone, email, birth, dob, address, cccd, idnumber, apikey, authorization, cookie, password, token, secret) |
| M6 | Medium | CI không build image | Đã sửa: job `docker-images` build 5 target + smoke admin + migrate sai target |
| M7 | Medium | Comment XFF sai thực tế; luồng client→api chưa có quy ước | Sửa comment; còn lại kiểm ở Spike D (Traefik có ghi đè XFF không) |
| L1 | Low | Mọi lỗi DB bị nuốt thành "tất cả migration chờ" | Đã sửa: `to_regclass` kiểm bảng, lỗi kết nối nổi lên |
| L2 | Low | Verdict `fatal` báo `degraded` ở `/ready` | Đã sửa: `fatal` → `down` |
| L3 | Low | `maskPii` không xử lý BigInt/Decimal/Buffer | Để sau: chưa có model dùng kiểu này |
| L4 | Low | Prefix không ép namespace `kamito-tt:` | Đã sửa: bắt buộc `kamito-tt:<APP_ENV>[:...]` |
| L5 | Low | entrypoint không escape newline | Để sau: 3 khóa là URL/đường dẫn |
| L6 | Low | Thiếu `APP_ENV` báo "Invalid option" thay vì "missing" | Chấp nhận: vẫn có tên biến |
| L7 | Low | `COPY . .` trước `pnpm install` → không cache layer | Để sau: tối ưu ở Spike D nếu build trên Dokploy chậm |
| L8 | Low | `client_max_body_size 10m` cố định | Để sau: phase 04 (upload) |
| L9 | Low | Redact log chỉ 1 cấp; query string vào log | Để sau: phase 03 (token đặt lại mật khẩu) |
| L10 | Low | Turbo cache task test | Đã sửa: `test.cache=false` |
| L11 | Low | Boot lỗi chỉ in message | Đã sửa: in cả error |

## Đã kiểm chứng tốt
Thiếu env → tên biến, không lộ giá trị; migrate sai target exit 3; container non-root (1000/101); `pnpm deploy --legacy` mang `prisma/migrations`; client standalone `/api/health` 200; nginx 404 cho `/api/v1/public/*`, `/api/v1/health/ready`; whitelist sort/filter; request-id được lọc.

## Câu hỏi còn mở
1. Traefik Dokploy có tin `forwardedHeaders` (đứng sau Cloudflare?) → ảnh hưởng `TRUST_PROXY_HOPS`.
2. Staging và prod có chung host Postgres không (đã xử lý bằng khóa có port, vẫn cần biết).
3. nginx với `%2F` trong path trên domain admin — thêm case vào smoke khi có route public có tham số.
4. Worker chưa có env S3/`CLIENT_INTERNAL_URL`/`REVALIDATE_SECRET`: hoãn có chủ ý tới phase có processor.
