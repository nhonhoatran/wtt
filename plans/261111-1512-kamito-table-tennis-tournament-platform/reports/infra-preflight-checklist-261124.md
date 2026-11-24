# Checklist hạ tầng để dựng staging — 2026-11-24

Gửi chủ hạ tầng. Trả lời đủ các mục dưới đây thì có thể dựng staging, deploy và migrate. Nguồn yêu cầu: phase 01 bước 15–16 (`../phase-01-foundation-monorepo-compose-dokploy-design-tokens.md`), `docs/deployment-guide.md`.

Đã sẵn ở phía code: image `api` (kèm target `migrate`), `worker`, `client`, `admin`; `docker-compose.yml` cho Dokploy; healthcheck live/ready; chốt từ chối migrate sai DB (`MIGRATE_CONFIRM_TARGET`).

## 1. Dokploy và tên miền

- [ ] URL Dokploy + tài khoản có quyền tạo **2 project**: `staging`, `production`.
- [ ] Tên miền (hoặc subdomain tạm) cho staging: site công khai, admin, API. Ví dụ: `staging.<domain>`, `admin.staging.<domain>`.
- [ ] TLS do Traefik/Dokploy cấp tự động (Let's Encrypt) hay chứng chỉ riêng?
- [ ] Traefik có chuyển **IP thật** của người xem vào container không (`X-Forwarded-For` / `X-Real-IP`), qua mấy lớp proxy (`TRUST_PROXY_HOPS`)?

## 2. PostgreSQL

- [ ] Server dùng chung với dự án khác hay riêng? Phiên bản (dự án test trên 17).
- [ ] Tên DB cho staging và production (không tự tạo trên server dùng chung khi chưa xác nhận).
- [ ] 2 role: **migrate** (được DDL) và **runtime** (chỉ DML) — cấp được không?
- [ ] Có pgbouncer không? SSL bắt buộc không? Giới hạn số kết nối?

## 3. Redis (hàng đợi BullMQ + cache)

- [ ] Phiên bản; `maxmemory-policy` có phải `noeviction` không?
- [ ] Nếu Redis dùng chung làm cache (policy khác `noeviction`) → cần **Redis riêng** cho dự án. Đây là điều kiện cổng ra phase 01.

## 4. Lưu file (MinIO / S3)

- [ ] Endpoint, bucket cho staging và production; service account chỉ được truy cập 1 bucket.
- [ ] Trình duyệt người dùng có truy cập được MinIO qua HTTPS không? Ai đặt được bucket policy/CORS?
- [ ] Chọn một trong hai cách upload ảnh:
  - **(a)** trình duyệt upload thẳng lên MinIO bằng URL ký, ảnh phục vụ từ `S3_PUBLIC_BASE_URL` (nhanh, cần MinIO public HTTPS + CORS).
  - **(b)** upload qua API, ảnh phục vụ qua site/proxy có cache (không cần mở MinIO ra ngoài, tốn băng thông server hơn).

## 5. Sao lưu và khôi phục (bắt buộc trước khi nạp dữ liệu thật)

- [ ] Ai sở hữu sao lưu PostgreSQL và MinIO; lịch chạy; giữ bao lâu.
- [ ] **RPO** chấp nhận được (mất tối đa bao nhiêu phút/giờ dữ liệu).
- [ ] Nơi lưu bản `pg_dump` mà dự án kiểm soát được.
- [ ] Ngày diễn tập khôi phục trên staging (trước pilot với BTC).

## 6. Bí mật cho từng môi trường

Không gửi qua chat; nhập thẳng vào env của project Dokploy: `AUTH_SECRET`, `REVALIDATE_SECRET`, `SSR_INTERNAL_SECRET`, `IP_HASH_SALT`, chuỗi kết nối DB/Redis/S3. Danh sách đầy đủ: `.env.example`.

## Sau khi có trả lời

1. Preflight chỉ đọc (in host + tên DB/bucket, xin xác nhận trước khi kết nối).
2. Tạo 2 project Dokploy, deploy staging, `migrate deploy` + `seed:config`, tạo ADMIN bằng CLI.
3. Đo các cổng còn mở: M1/M2, Spike D (rollback), CSP enforce, Lighthouse/tải trên staging, diễn tập khôi phục.
