# Development Roadmap — Kamito

> Cập nhật: 2026-11-13. Nguồn: `plans/261111-1512-kamito-table-tennis-tournament-platform/plan.md` và các file phase.
> Lịch sử thay đổi: [project-changelog.md](./project-changelog.md).

## Trạng thái phase

| Phase | Nội dung | Trạng thái (2026-11-13) | Ghi chú |
|---|---|---|---|
| 01 | Nền móng: monorepo, compose, Dokploy, design token | Code xong, cổng ra chưa đạt | Plan: không sang phase 03 cho tới khi đủ 4 điều kiện: staging chạy; Redis riêng `noeviction`; chọn thiết kế upload (đã chọn (b), 2026-11-12); chủ sở hữu sao lưu và RPO |
| 02 | Spike: Refine, Better Auth, Dokploy, revalidate Next.js | B, C, E đạt cục bộ. D chờ staging | Kết quả trong `plans/reports/spike-*` |
| 03 | Đăng nhập admin, RBAC, người dùng, khung admin | Code xong. Chờ deploy staging | Test API 87/87 (gồm e2e) tại thời điểm phase 03. Xem [giới hạn đã biết](./auth-and-rbac.md#giới-hạn-đã-biết) |
| 04 | Dữ liệu gốc giải đấu, cấu hình, upload ảnh | Xong (code, chưa commit). Chờ deploy staging | 3 migration, seed danh mục, upload ảnh qua API. Tester và review 13:29 không có lỗi Critical. Còn nợ ghi ở [Việc kế tiếp](#việc-kế-tiếp). Chi tiết: [changelog](./project-changelog.md#2026-11-12--phase-04-dữ-liệu-gốc-giải-đấu-cấu-hình-upload-ảnh-chưa-commit) |
| 05 | VĐV, cặp đôi, đăng ký, import/export Excel, gộp VĐV | Xong (code, chưa commit). Chưa deploy staging | Test API 254/254 ở ba lần chạy đầy đủ sau khi thêm test, một lần crash native trong sáu lần (xem [việc còn mở](./deployment-guide.md#việc-còn-mở) mục 16). Sau sửa N1 đến N3: API 257/257 (một lần chạy đầy đủ), mỗi sửa có test riêng. Chưa làm: tag cache cho VĐV và đăng ký (phase 07), 301 (phase 10). Chi tiết: [changelog](./project-changelog.md#2026-11-12--phase-05-vđv-đăng-ký-import-excel-chưa-commit) |
| 06 | Bốc thăm, hạt giống, vòng bảng, sinh nhánh | Xong (code, chưa commit). Chưa deploy staging | Gate G1a và G1b chưa được BTC xác nhận. Chi tiết: [draws-and-groups](./draws-and-groups.md). Changelog: [phase 06](./project-changelog.md#2026-11-13--phase-06-bốc-thăm-hạt-giống-vòng-bảng-sinh-nhánh-chưa-commit) |
| 07 | Xếp lịch, bàn thi đấu, nhập tỷ số | Lát cắt xong (đã commit). Phần còn lại chưa làm | Đã có: validator tỷ số, bắt đầu và chốt trận có `expectedVersion`, đẩy nhánh, BXH bảng tính lại, revalidate cho trận và công bố nhánh, màn `/results`. Chưa có: lịch, bàn, sửa và mở lại tỷ số, route `/api/revalidate` của client. Chi tiết: [match-results](./match-results.md), [changelog](./project-changelog.md#2026-11-13--phase-07-lát-cắt-nhập-tỷ-số-và-revalidate-cache-chưa-commit) |
| 08 | Site công khai: khung, trang giải, nhánh đấu | Pending | |
| 09 | Quy tắc điểm, sổ điểm, snapshot xếp hạng | Pending | Chờ G2 |
| 10 | Trang xếp hạng, danh sách và hồ sơ VĐV | Pending | |
| 11 | CMS: tin, video, nhà tài trợ, trang tĩnh, liên hệ | Pending | |
| 12 | Tiếng Anh, SEO, hardening, ra mắt | Pending | |

## Mốc và cổng (theo plan)

| Mốc / cổng | Hạn (tuần) | Điều kiện |
|---|---|---|
| Cổng ra phase 01 | cuối tuần 2 | Staging chạy; Redis riêng `noeviction`; thiết kế upload (đã chốt); chủ sở hữu sao lưu và RPO |
| G1a (cứng) | cuối tuần 3 | BTC xác nhận mẫu hạt giống loại trực tiếp |
| M1: lát cắt dọc | cuối tuần 6 | Trên staging: 1 giải, 1 nội dung loại trực tiếp, nhập tay, bốc thăm, nhập tỷ số, 1 trang nhánh công khai |
| Diễn tập khôi phục sao lưu | trước tuần 9 | Trước lần nạp dữ liệu thật đầu tiên |
| Pilot BTC | tuần 9 | Nạp giải cũ, bốc thăm, nhập tỷ số, xem trang công khai |
| G1b (cứng) | trước tuần 10 | BTC trả lời chia bảng, phá hòa, rút lui giữa bảng |
| M2: lõi giải đấu đủ | cuối tuần 13 | Phase 04–08 xong trên staging |
| G2 (cứng) | trước tuần 14 | BTC trả lời quy chế điểm |
| Ra mắt | cuối tuần 19 (mục tiêu) | |

## Việc kế tiếp

1. **Chủ repo quyết định** (không tự làm):
   - Cổng phase 01: staging, Redis riêng, chủ sở hữu sao lưu và RPO còn mở.
   - Lỗi URL và slug trùng: giữ 422 (theo quy ước của code và tài liệu) hay đổi thành 400 theo spec gốc (báo cáo tester F2).
   - Route `/api/revalidate` ở client: giữ ở phase 08, hay làm ngay trong lát cắt phase 07. Giữ ở phase 08 thì job revalidate nhận 404 tới khi đó (không sai dữ liệu, chỉ có job failed). Làm sớm thì thêm route nhỏ ở client, kiểm secret và chặn truy cập từ domain công khai (theo Spike E, phase 02).
2. **Commit phase 04, 05, 06 và lát cắt phase 07** khi chủ repo yêu cầu. Lát cắt phase 07 đã có review sau sửa: `plans/reports/code-review-and-test-261113-phase-07-slice.md`. Trước đó chạy lại tester và code-reviewer trên code hiện tại, vì code đã đổi sau báo cáo 13:29 (phase 04) và sau báo cáo 14:36 (phase 05). Phase 06: báo cáo review là bản trước khi sửa, chưa có review sau sửa.
3. **Deploy staging** (phase 04 bước 13, phase 05 bước 11):
   - Migrate 9 migration: 5 của phase 01 đến 04, 4 của phase 05 (xem [system-architecture](./system-architecture.md#dữ-liệu)). Chạy `seed:config`. Chạy `pnpm db:print-target` trước khi migrate và xác nhận host và tên DB.
   - Thử `create-admin` trong container api (chưa kiểm chứng).
   - Kiểm sharp trên image Alpine, và upload một ảnh thật với `STORAGE_DRIVER=s3`.
   - Phase 05: upload một file import thật (lưu từ Excel), kiểm tra, nhập, thử gộp VĐV trên staging.
   - Phase 07 (lát cắt): worker cần `CLIENT_INTERNAL_URL` và `REVALIDATE_SECRET`. Compose đã khai cho worker. Thử chốt một trận trên staging và xem job trong bull-board (queue `revalidate`).
4. **Nợ kỹ thuật phase 04** (theo báo cáo tester và review 13:29, chưa đối chiếu lại hết):
   - Test api crash native trong một lần chạy đầy đủ (F1). Chưa tìm được nguyên nhân.
   - Test crash làm sót user test trong DB dev (F3). Cần dọn.
   - Mặc định duy nhất: advisory lock lấy sau khi đọc dữ liệu cũ, chưa đối chiếu lại phần lock (M2). Partial unique index đã có (migration `20261112070130`).
   - Giá trị viết cứng còn lại, theo luật `/settings` (M6, còn một phần).
   - Các mục L của review chưa đối chiếu.
5. **Phase 05, nợ còn lại** (theo đối chiếu code ngày 2026-11-12):
   - Nginx admin giới hạn 2m cho route upload import (xem mục 3).
   - `cache-tags.ts` đã có cho trận và công bố nhánh (phase 07, lát cắt). Tag cho đăng ký và VĐV còn thiếu, thuộc phase 07 đợt 2.
   - Chuyển hướng 301 slug VĐV đã gộp. Thuộc phase 10.
   - Chưa thử file xlsx do Excel thật tạo.
   - Phase 06: gate G1a và G1b chưa được BTC xác nhận. Quyết định chờ chủ giải: người thắng vòng loại đã rút có dùng lucky loser không (hiện tự walkover). Chi tiết: [draws-and-groups](./draws-and-groups.md#chưa-làm).
