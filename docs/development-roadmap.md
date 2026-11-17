# Development Roadmap — Kamito

> Cập nhật: 2026-11-16. Nguồn: `plans/261111-1512-kamito-table-tennis-tournament-platform/plan.md` và các file phase, đối chiếu với lịch sử git (`git log`) và code.
> Lịch sử thay đổi: [project-changelog.md](./project-changelog.md).

## Trạng thái phase

| Phase | Nội dung | Trạng thái (2026-11-15) | Ghi chú |
|---|---|---|---|
| 01 | Nền móng: monorepo, compose, Dokploy, design token | Code xong, cổng ra chưa đạt | Plan: không sang phase 03 cho tới khi đủ 4 điều kiện: staging chạy; Redis riêng `noeviction`; chọn thiết kế upload (đã chọn (b), 2026-11-12); chủ sở hữu sao lưu và RPO |
| 02 | Spike: Refine, Better Auth, Dokploy, revalidate Next.js | B, C, E đạt cục bộ. D chờ staging | Kết quả trong `plans/reports/spike-*` |
| 03 | Đăng nhập admin, RBAC, người dùng, khung admin | Code xong, đã commit. Chờ deploy staging | Test API 87/87 (gồm e2e) tại thời điểm phase 03. Xem [giới hạn đã biết](./auth-and-rbac.md#giới-hạn-đã-biết) |
| 04 | Dữ liệu gốc giải đấu, cấu hình, upload ảnh | Xong, đã commit (`3539792`..`01ab716`, 2026-11-12). Chờ deploy staging | 3 migration, seed danh mục, upload ảnh qua API. Tester và review 13:29 không có lỗi Critical. Còn nợ ghi ở [Việc kế tiếp](#việc-kế-tiếp). Chi tiết: [changelog](./project-changelog.md#2026-11-12--phase-04-dữ-liệu-gốc-giải-đấu-cấu-hình-upload-ảnh-đã-commit) |
| 05 | VĐV, cặp đôi, đăng ký, import/export Excel, gộp VĐV | Xong, đã commit (`9d10ac3`..`e17dd87`, 2026-11-12). Chưa deploy staging | Test API 254/254 ở ba lần chạy đầy đủ sau khi thêm test, một lần crash native trong sáu lần (xem [việc còn mở](./deployment-guide.md#việc-còn-mở) mục 16). Sau sửa N1 đến N3: API 257/257 (một lần chạy đầy đủ). Tag cho đăng ký và VĐV đã có từ phase 07 đợt 2. Chưa làm: 301 (phase 10). Chi tiết: [changelog](./project-changelog.md#2026-11-12--phase-05-vđv-đăng-ký-import-excel-đã-commit) |
| 06 | Bốc thăm, hạt giống, vòng bảng, sinh nhánh | Xong, đã commit (`2a44de1`..`919a014`, 2026-11-13). Chưa deploy staging | Gate G1a và G1b chưa được BTC xác nhận. Chi tiết: [draws-and-groups](./draws-and-groups.md). Changelog: [phase 06](./project-changelog.md#2026-11-13--phase-06-bốc-thăm-hạt-giống-vòng-bảng-sinh-nhánh-đã-commit) |
| 07 | Xếp lịch, session, bàn, nhập và sửa tỷ số | Đợt 1 (nhập và chốt tỷ số, revalidate) đã commit (`4d64837`..`baf28a1`, 2026-11-13). Đợt 2 (lịch, sửa và mở lại tỷ số, revalidate mọi route ghi) đã commit (`4c7124b`..`3853154`, 2026-11-14). Chưa deploy staging | Lịch công khai và bản in lịch đã triển khai ở phase 08 (2026-11-15, đã commit `a26f833`). Còn mở: chuỗi Q → BYE → R2 khi reopen (chỉ unit), các mục UI trong báo cáo `ui-verifier-261114-phase-07`. Ghi nợ tag, thể thức, L11, L12, L13 và e2e RETIRED đã đóng 2026-11-14 ([changelog](./project-changelog.md#2026-11-14--đóng-ghi-nợ-review-c449c75608d948)). Chi tiết: [scheduling](./scheduling.md), [match-results](./match-results.md), [changelog](./project-changelog.md#2026-11-14--phase-07-đợt-2-lịch-session-sửa-và-mở-lại-tỷ-số-revalidate-mọi-route-ghi-đã-commit) |
| 08 | Site công khai: khung, i18n, trang giải, nhánh đấu, bảng đấu, trận, bản in | Đợt 1 đến 3 đã commit (`88777db`, `998f3f1`..`57be6b9`, 2026-11-13 và 11-14). Chưa lên staging | Bổ sung 2026-11-15 (đã commit `a26f833`): lịch theo session/bàn và bản in lịch. Typecheck/lint client đạt; API tích hợp 24 test/3 spec đạt; Playwright lịch 5 đạt/1 bỏ qua có chủ đích (PDF mobile). Còn mốc M1/M2. Đã có: 13 endpoint public (gồm `schedule`), i18n vi/en, khung và header, danh sách và lịch giải, trang giải 6 tab, trang trận, nhánh và bảng đấu, bản in nhánh, metadata, sitemap, robots, rate limit công khai, CSP report-only, Playwright cuối 51 đạt/7 bỏ qua, xem báo cáo hoàn tất nợ code. Chi tiết: [public-site](./public-site.md), [changelog](./project-changelog.md#2026-11-14--phase-08-site-công-khai-đợt-1-đến-3-đã-commit) |
| 09 | Quy tắc điểm, sổ điểm, snapshot xếp hạng, màn admin xếp hạng | Code xong ở local. Lõi (`packages/ranking-engine`, migration, API) đã commit (`b59fffb`..`478ad88`). Màn admin và thay đổi API nhỏ chưa commit (2026-11-16). Chưa deploy staging | Staging chờ cổng phase 01. Chờ G2 (BTC trả lời quy chế điểm), nên số điểm hiện là dữ liệu mẫu để thử. Test API 571/571 (chạy lại sau vòng sửa review). Chưa có unit test cho admin. Chi tiết và việc còn mở: [changelog](./project-changelog.md#2026-11-16--phase-09-màn-admin-xếp-hạng-chưa-commit) |
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
   - `@RequireStepUp` cho `PUT /admin/settings/:key` và `reset-password`: giữ hay gắn (xem [auth-and-rbac](./auth-and-rbac.md#giới-hạn-đã-biết)).
2. **Trước khi deploy staging:** chạy lại tester và code-reviewer trên code hiện tại. Code phase 04 đã đổi sau báo cáo 13:29, phase 05 sau 14:36, và phase 07 đợt 2 chỉ có báo cáo review trước khi sửa (14:14). Báo cáo phase 06 là bản trước khi sửa, chưa có review sau sửa. Trong lần cập nhật này chưa chạy lại test. Phase 09 (2026-11-16): API 571/571 chạy lại sau vòng sửa review; màn admin chỉ kiểm bằng typecheck, lint và trình duyệt.
3. **Deploy staging** (phase 04 bước 13, phase 05 bước 11, phase 07 bước mới):
   - Migrate 16 migration có trong repo, theo thứ tự tên: 1 (phase 01), 1 (phase 03), 3 (phase 04), 4 (phase 05), 2 (phase 06), 2 (phase 09, ranking), 2 (phase 07, lịch), 1 (phase 08, tên VĐV công khai). Xem [system-architecture](./system-architecture.md#dữ-liệu). Chạy `seed:config`. Chạy `pnpm db:print-target` trước khi migrate và xác nhận host và tên DB.
   - Thử `create-admin` trong container api (chưa kiểm chứng).
   - Kiểm sharp trên image Alpine, và upload một ảnh thật với `STORAGE_DRIVER=s3`.
   - Phase 05: upload một file import thật (lưu từ Excel), kiểm tra, nhập, thử gộp VĐV trên staging.
   - Phase 07: worker cần `CLIENT_INTERNAL_URL` và `REVALIDATE_SECRET`. Compose đã khai cho worker. Thử chốt một trận, mở lại một trận (cần step-up), xếp lịch và đổi chỗ hai trận, đổi giờ session, in phiếu trận, xuất xlsx lịch và kết quả, xem job trong bull-board (queue `revalidate`).
   - Phase 08: client cần đủ biến runtime (danh sách trong [deployment-guide](./deployment-guide.md#biến-môi-trường-theo-service)), gồm `REVALIDATE_ALLOWED_HOSTS` (phải khớp `CLIENT_INTERNAL_URL` của worker). Thử trên staging: mở một nhánh đã công bố, chốt một trận, bỏ công bố, rồi xem trang công khai đổi. Chạy Playwright với stack dev trước khi deploy (xem [Playwright e2e](./deployment-guide.md#playwright-e2e-client)). Mốc M1 cần thêm bước này trên staging.
   - Phase 09: trên staging thử tạo bảng xếp hạng, đổi quy tắc điểm (thành phiên bản mới), thêm và xóa điểm thủ công (cần step-up), dựng và công bố một kỳ chốt (cần step-up), gắn bảng vào nội dung và xem gợi ý hạt giống. Chạy `pnpm db:print-target` trước khi migrate, như các phase khác.
4. **Nợ kỹ thuật phase 04** (theo báo cáo tester và review 13:29, chưa đối chiếu lại hết):
   - Test api crash native trong một lần chạy đầy đủ (F1). Chưa tìm được nguyên nhân.
   - Test crash làm sót user test trong DB dev (F3). Cần dọn.
   - Mặc định duy nhất: advisory lock lấy sau khi đọc dữ liệu cũ, chưa đối chiếu lại phần lock (M2). Partial unique index đã có (migration `20261112070130`).
   - Giá trị viết cứng còn lại, theo luật `/settings` (M6, còn một phần).
   - Các mục L của review chưa đối chiếu.
5. **Phase 05 và 06, nợ còn lại** (theo đối chiếu code):
   - Nginx admin giới hạn 2m cho route upload import (xem [deployment-guide](./deployment-guide.md#giới-hạn-import-excel)).
   - Chuyển hướng 301 slug VĐV đã gộp. Thuộc phase 10.
   - Chưa thử file xlsx do Excel thật tạo.
   - Phase 06: gate G1a và G1b chưa được BTC xác nhận. Quyết định chờ chủ giải: người thắng vòng loại đã rút có dùng lucky loser không (hiện tự walkover). Chi tiết: [draws-and-groups](./draws-and-groups.md#chưa-làm).
6. **Phase 07, nợ còn lại** (chi tiết: [scheduling](./scheduling.md#chưa-làm-và-việc-còn-mở), [match-results](./match-results.md#chưa-làm-và-việc-còn-mở)):
   - Chuỗi Q → BYE → R2 khi reopen: chỉ có unit, chưa có e2e.
   - Lịch công khai và bản in lịch đã triển khai ở phase 08 ngày 2026-11-15; API tích hợp 24 test/3 spec đạt; Playwright lịch 5 đạt/1 bỏ qua có chủ đích (PDF mobile).
   - Mục UI từ `ui-verifier-261114-phase-07`: nhãn session thiếu ngày ở màn nhập tỷ số, panel chưa xếp báo "đã xếp hết" khi đang lọc, kéo thả chưa có bàn phím, trang in chưa có nút thử lại.
   - Chưa render trên trình duyệt với API thật: cỡ lưới, khổ A4, focus, tương phản.
   - Thiếu e2e: swap giữa hai session, export trên 1.000 dòng (chốt đồng thời, cascade walkover, ván dở của `RETIRED` và Redis tắt đã có e2e từ 2026-11-14).
7. **Phase 08, nợ còn lại** (chi tiết và nguồn: [public-site](./public-site.md#việc-còn-mở)):
   - Nguồn đối chiếu hiện tại: [review debt audit 2026-11-15](../plans/reports/reviewer-261115-phase08-review-debt-audit.md). Báo cáo đợt 1–3 là lịch sử, không giữ các mục đã sửa như nợ đang mở.
   - Mốc M1: deploy staging và kiểm trên staging. Playwright đã có 2 spec (`event-pages`, `site-chrome-and-seo`) nhưng chưa ghi số liệu chạy.
   - Lịch theo session và bàn, bản in lịch đã triển khai ngày 2026-11-15. API tích hợp và Playwright `schedule.spec.ts` local đã đạt; còn kiểm staging.
   - Bỏ công bố giải, hủy giải, sửa entry hay VĐV đã có tag. Xếp suất vòng loại và nhất/nhì bảng đã có tag từ 2026-11-14 (xem [cache-revalidation](./cache-revalidation.md#mutation-và-tag)).
   - HTML dùng API sanitize lại khi trả; timeout giữ env vì bootstrap, không còn chờ chốt cho hai mục này.
   - Traefik: quy tắc chặn `/api/revalidate` và `forwardedHeaders` chưa kiểm. Rate limit công khai phụ thuộc vào đây.
   - Cache/hạn mức nhiều replica đã dùng Redis chung; hai Next production local đạt kiểm invalidation và hạn mức chung. API settings đọc DB không giữ cache RAM riêng.
   - Nợ code timezone/DST, tìm/sort tên công khai và giới hạn 62 ngày đã sửa, kiểm ở server trước phân trang. Migration `20261115032757_add_player_public_name_key` đã áp dụng DB dev local (16/16), cần áp dụng staging theo cổng hạ tầng. Kiểm local cuối: 41 unit client, 51 Playwright đạt/7 bỏ qua; chưa coi local là hoàn tất M1/M2.
8. **Phase 09, nợ còn lại** (chi tiết: [changelog 2026-11-16](./project-changelog.md#2026-11-16--phase-09-màn-admin-xếp-hạng-chưa-commit)):
   - Commit phần admin và thay đổi API nhỏ (hiện chưa commit).
   - Đưa ràng buộc ngày vào API: không hồi tố quy tắc, không ghi nhận điểm hay chốt kỳ chốt với ngày tương lai. Hiện chỉ admin chặn.
   - Múi giờ phía admin: ngày mặc định và tag "Hết hạn" còn dùng ngày của máy (xem [code-standards](./code-standards.md#xếp-hạng-phase-09)).
   - Admin chưa có unit test (API đã chạy lại toàn bộ sau vòng sửa: 571/571).
