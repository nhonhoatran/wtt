# Development Roadmap — Kamito

> Cập nhật: 2026-11-12. Nguồn: `plans/261111-1512-kamito-table-tennis-tournament-platform/plan.md` và các file phase.
> Lịch sử thay đổi: [project-changelog.md](./project-changelog.md).

## Trạng thái phase

| Phase | Nội dung | Trạng thái (2026-11-12) | Ghi chú |
|---|---|---|---|
| 01 | Nền móng: monorepo, compose, Dokploy, design token | Code xong, cổng ra chưa đạt | Plan: không sang phase 03 cho tới khi đủ 4 điều kiện: staging chạy; Redis riêng `noeviction`; chọn thiết kế upload; chủ sở hữu sao lưu và RPO |
| 02 | Spike: Refine, Better Auth, Dokploy, revalidate Next.js | B, C, E đạt cục bộ. D chờ staging | Kết quả trong `plans/reports/spike-*` |
| 03 | Đăng nhập admin, RBAC, người dùng, khung admin | Code xong (chưa commit). Chờ deploy staging | Test API 87/87 (gồm e2e). Phase 01 chưa qua cổng ra — cần chủ repo chốt. Xem [giới hạn đã biết](./auth-and-rbac.md#giới-hạn-đã-biết) |
| 04 | Dữ liệu gốc giải đấu, cấu hình, upload ảnh | Pending | |
| 05 | VĐV, cặp đôi, đăng ký, import Excel | Pending | |
| 06 | Bốc thăm, hạt giống, vòng bảng, sinh nhánh | Pending | Chờ G1a, G1b |
| 07 | Xếp lịch, bàn thi đấu, nhập tỷ số | Pending | |
| 08 | Site công khai: khung, trang giải, nhánh đấu | Pending | |
| 09 | Quy tắc điểm, sổ điểm, snapshot xếp hạng | Pending | Chờ G2 |
| 10 | Trang xếp hạng, danh sách và hồ sơ VĐV | Pending | |
| 11 | CMS: tin, video, nhà tài trợ, trang tĩnh, liên hệ | Pending | |
| 12 | Tiếng Anh, SEO, hardening, ra mắt | Pending | |

## Mốc và cổng (theo plan)

| Mốc / cổng | Hạn (tuần) | Điều kiện |
|---|---|---|
| Cổng ra phase 01 | cuối tuần 2 | Staging chạy; Redis riêng `noeviction`; thiết kế upload; chủ sở hữu sao lưu và RPO |
| G1a (cứng) | cuối tuần 3 | BTC xác nhận mẫu hạt giống loại trực tiếp |
| M1: lát cắt dọc | cuối tuần 6 | Trên staging: 1 giải, 1 nội dung loại trực tiếp, nhập tay, bốc thăm, nhập tỷ số, 1 trang nhánh công khai |
| Diễn tập khôi phục sao lưu | trước tuần 9 | Trước lần nạp dữ liệu thật đầu tiên |
| Pilot BTC | tuần 9 | Nạp giải cũ, bốc thăm, nhập tỷ số, xem trang công khai |
| G1b (cứng) | trước tuần 10 | BTC trả lời chia bảng, phá hòa, rút lui giữa bảng |
| M2: lõi giải đấu đủ | cuối tuần 13 | Phase 04–08 xong trên staging |
| G2 (cứng) | trước tuần 14 | BTC trả lời quy chế điểm |
| Ra mắt | cuối tuần 19 (mục tiêu) | |

## Việc kế tiếp cho phase 03

1. Chốt cổng phase 01 (staging, Redis riêng, thiết kế upload, chủ sao lưu) trước khi deploy phase 03.
2. Xử lý các mục review còn mở ưu tiên cao: phần còn lại của M3 (burst đăng nhập song song), L2 (đổi mật khẩu không nguyên tử), L7 (lỗi `lastLoginAt` làm sign-in 500).
3. Commit phase 03 (theo quy tắc commit tiếng Anh, conventional commit).
4. Deploy và migrate staging. Thử `create-admin` trong container api.
5. Chốt lại trạng thái trong plan file (hiện vẫn `Pending`).
