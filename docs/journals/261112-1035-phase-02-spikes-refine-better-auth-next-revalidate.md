# 2026-11-12 — Phase 02: spike B, C, E (cục bộ)

## Đã làm
- Spike B (Refine 5 + `@refinedev/antd` 6.0.3 + antd 5.29.3): đạt, 18/18 kiểm tra Playwright. Giữ Refine, không cần ProComponents.
- Spike C (Better Auth 1.7.21 trên NestJS 12): đạt có điều kiện, 32/32 test e2e. Giữ Better Auth, không cần Passport. Schema qua `prisma migrate` trong Postgres schema `spike_auth`.
- Spike E (Next 16.4.3 standalone): `revalidateTag(tag, { expire: 0 })` cho HTML mới ngay request đầu; `'max'` thì không.
- Kết quả ghi vào phase 02; Key Insights phase 01, 03, 07, 08, 10 đã cập nhật.

## Vướng và cách gỡ
- Better Auth có mặc định không an toàn: `disabledPaths` không phủ path có tham số; rate limit đọc thẳng `X-Forwarded-For` (XFF nhiều giá trị dồn chung bucket → khóa đăng nhập toàn bộ); Origin/CSRF tự tắt khi `NODE_ENV=test`; gọi `auth.api.*` từ controller bỏ qua rate limit. Phải vá ở phase 03.
- Duyệt router Express không thấy endpoint nào của Better Auth (chỉ 1 wildcard) → danh sách lấy từ `auth.api`.
- `migrate dev --create-only` lần 2 tự áp migration trước khi review SQL. Review sau thấy sạch. Bài học: kiểm `migrate status` trước khi chạy lại `--create-only`.
- Next: trạng thái hết hạn tag không qua được restart, fetch cache nằm trên đĩa → trả HTML cũ. Xóa `.next/cache` lúc client start.
- antd trong Vite: `antd/locale/vi_VN` không áp locale, phải dùng `antd/es/locale/vi_VN`.
- S3 local (RustFS) không trả CORS → trình duyệt không PUT thẳng được; spike đi qua proxy cùng origin.

## Còn mở
- Spike D chưa chạy (chờ staging Dokploy); rule Traefik chặn `/api/revalidate`; XFF qua nginx/Traefik thật.
- Xóa `spikes/` + schema `spike_refine`, `spike_auth`: chờ chủ repo duyệt.
- Chọn bản Better Auth (1.7.21 mới < 1 ngày), tham số hash, ngưỡng rate limit đăng nhập.
