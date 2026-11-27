# Development Roadmap — Kamito

> Cập nhật: 2026-11-20. Nguồn: `plans/261111-1512-kamito-table-tennis-tournament-platform/plan.md` và đủ 12 file phase, đối chiếu code và báo cáo kiểm thử. Các số liệu gắn ngày trước là snapshot lịch sử.
> Lịch sử thay đổi: [project-changelog.md](./project-changelog.md).

> Bổ sung 2026-11-27: API ngày xếp hạng/đồng hồ nghiệp vụ admin, E2 mobile import, E4 tracker, màu nội dung, `/search`, runner và scheduler H/L5 đã kiểm theo phạm vi; desktop/mobile mới đều đủ 8 bước/60 refresh, cleanup sạch. Debt plan 7/9, redesign 158/160; E/F rộng và C11 ảnh/review cuối còn mở. Default hồ sơ mới ẩn có API61/worker46/browser22; mobile trên default mới, desktop trước đó. G1/G2 cơ chế/consent quy trình đã duyệt, còn bảng điểm thật và bằng chứng từng VĐV; S1/S2/T2/staging vẫn mở. [Plan](../plans/261127-debt-closure/plan.md), [full flow](../plans/reports/tester-261127-admin-full-flow-continuation.md).

## Trạng thái phase

| Phase | Nội dung | Trạng thái (2026-11-20) | Ghi chú |
|---|---|---|---|
| 01 | Nền móng: monorepo, compose, Dokploy, design token | Code xong, cổng ra chưa đạt | Plan: không sang phase 03 cho tới khi đủ 4 điều kiện: staging chạy; Redis riêng `noeviction`; chọn thiết kế upload (đã chọn (b), 2026-11-12); chủ sở hữu sao lưu và RPO |
| 02 | Spike: Refine, Better Auth, Dokploy, revalidate Next.js | B, C, E đạt cục bộ. D chờ staging | Kết quả trong `plans/reports/spike-*` |
| 03 | Đăng nhập admin, RBAC, người dùng, khung admin | Code xong, đã commit. Chờ deploy staging | Test API 87/87 (gồm e2e) tại thời điểm phase 03. Xem [giới hạn đã biết](./auth-and-rbac.md#giới-hạn-đã-biết) |
| 04 | Dữ liệu gốc giải đấu, cấu hình, upload ảnh | Xong, đã commit (`3539792`..`01ab716`, 2026-11-12). Chờ deploy staging | 3 migration, seed danh mục, upload ảnh qua API. Tester và review 13:29 không có lỗi Critical. Còn nợ ghi ở [Việc kế tiếp](#việc-kế-tiếp). Chi tiết: [changelog](./project-changelog.md#2026-11-12--phase-04-dữ-liệu-gốc-giải-đấu-cấu-hình-upload-ảnh-đã-commit) |
| 05 | VĐV, cặp đôi, đăng ký, import/export Excel, gộp VĐV | Xong, đã commit (`9d10ac3`..`e17dd87`, 2026-11-12). Chưa deploy staging | Test API 254/254 ở ba lần chạy đầy đủ sau khi thêm test, một lần crash native trong sáu lần (xem [việc còn mở](./deployment-guide.md#việc-còn-mở) mục 16). Sau sửa N1 đến N3: API 257/257 (một lần chạy đầy đủ). Tag cho đăng ký và VĐV có từ phase 07 đợt 2; redirect 301 đã bổ sung ở phase 10. Chi tiết: [changelog](./project-changelog.md#2026-11-12--phase-05-vđv-đăng-ký-import-excel-đã-commit) |
| 06 | Bốc thăm, hạt giống, vòng bảng, sinh nhánh | Xong, đã commit (`2a44de1`..`919a014`, 2026-11-13). Chưa deploy staging | G1a/G1b được người dùng duyệt ngày 2026-11-27: giữ seed/pot, không tránh CLB, KEEP khi rút giữa bảng; default/rollout kiểm riêng, không ghi đè rule cũ. [Quyết định](../plans/261127-debt-closure/btc-consent-decisions.md), [draws-and-groups](./draws-and-groups.md). Changelog: [phase 06](./project-changelog.md#2026-11-13--phase-06-bốc-thăm-hạt-giống-vòng-bảng-sinh-nhánh-đã-commit) |
| 07 | Xếp lịch, session, bàn, nhập và sửa tỷ số | Đợt 1 (nhập và chốt tỷ số, revalidate) đã commit (`4d64837`..`baf28a1`, 2026-11-13). Đợt 2 (lịch, sửa và mở lại tỷ số, revalidate mọi route ghi) đã commit (`4c7124b`..`3853154`, 2026-11-14). Chưa deploy staging | Lịch công khai và bản in lịch đã triển khai ở phase 08 (2026-11-15, đã commit `a26f833`). Còn mở: chuỗi Q → BYE → R2 khi reopen (chỉ unit). Các mục UI trong báo cáo `ui-verifier-261114-phase-07` đã đóng, đối chiếu code 2026-11-26 ([scheduling](./scheduling.md#chưa-làm-và-việc-còn-mở)). Ghi nợ tag, thể thức, L11, L12, L13 và e2e RETIRED đã đóng 2026-11-14 ([changelog](./project-changelog.md#2026-11-14--đóng-ghi-nợ-review-c449c75608d948)). Chi tiết: [scheduling](./scheduling.md), [match-results](./match-results.md), [changelog](./project-changelog.md#2026-11-14--phase-07-đợt-2-lịch-session-sửa-và-mở-lại-tỷ-số-revalidate-mọi-route-ghi-đã-commit) |
| 08 | Site công khai: khung, i18n, trang giải, nhánh đấu, bảng đấu, trận, bản in | Đợt 1 đến 3 đã commit (`88777db`, `998f3f1`..`57be6b9`, 2026-11-13 và 11-14). Chưa lên staging | Bổ sung 2026-11-15 (đã commit `a26f833`): lịch theo session/bàn và bản in lịch. Typecheck/lint client đạt; API tích hợp 24 test/3 spec đạt; Playwright lịch 5 đạt/1 bỏ qua có chủ đích (PDF mobile). Còn mốc M1/M2. Đã có: 13 endpoint public (gồm `schedule`), i18n vi/en, khung và header, danh sách và lịch giải, trang giải 6 tab, trang trận, nhánh và bảng đấu, bản in nhánh, metadata, sitemap, robots, rate limit công khai, CSP report-only, Playwright 51/7 là snapshot 2026-11-15; lượt 2026-11-20 đạt 96/8 và axe 36 scan không violation, xem báo cáo hoàn tất nợ code. Chi tiết: [public-site](./public-site.md), [changelog](./project-changelog.md#2026-11-14--phase-08-site-công-khai-đợt-1-đến-3-đã-commit) |
| 09 | Quy tắc điểm, sổ điểm, snapshot xếp hạng, màn admin xếp hạng | Code xong, đã commit. Lõi (`packages/ranking-engine`, migration, API): `b59fffb`..`478ad88`. Màn admin và thay đổi API nhỏ: `723c30b`, `a5d0128` (2026-11-17). Chưa deploy staging | G2 và cổng phase 01 vẫn mở, điểm hiện là dữ liệu mẫu. API 571/571 là snapshot 2026-11-16. Bổ sung 2026-11-20: 18 unit state ma trận, admin 29 ca duy nhất, ranking-engine 36 ca đạt; chưa kiểm hook/browser bằng unit state. [Báo cáo](../plans/reports/tester-261120-phase09-admin-unit.md) |
| 10 | Trang xếp hạng, danh sách và hồ sơ VĐV | Mã nguồn đã triển khai và kiểm chứng ở local, đã commit (`92fe3c9`, 2026-11-17). Chưa deploy staging | SSR bảng và hồ sơ; điểm từ kỳ công bố; chi tiết native không cần JS; URL VĐV `p-<UUID>`, slug cũ/đã gộp 301; quyền riêng tư/noindex; bảng điểm giải. Không có migration. Snapshot 2026-11-17: 111 API test trên 15 file, 24 browser test sau sửa review đạt; build API/worker/client đạt. Xem [changelog](./project-changelog.md#2026-11-17--phase-10-xếp-hạng-và-hồ-sơ-vđv-công-khai-chưa-commit) |
| 11 | CMS: tin, video, nhà tài trợ, trang tĩnh, liên hệ | In progress, 10/13 | Ngày 2026-11-20, publishing/sweep/retention 5 ca thật đạt; CMS/quyền/public thuộc bộ 132 API/21 spec và public browser thật. Hai migration mới chưa áp dụng DB dev/staging; còn toàn bộ ma trận admin, scheduler process, storage/S3 và staging |
| 12 | Tiếng Anh, SEO, hardening, ra mắt | In progress, 8/14 | Ngày 2026-11-24: E2E tám bước qua UI thật đạt desktop + mobile trên cùng build cuối; sửa trùng React key và tràn ngang admin 390 px. Ngày 2026-11-20: full public 96/8 skip trước metadata; build cuối focused SEO/axe 27/5 skip, client unit 83/83, axe 36 scan không violation. API thật 132/21 spec; lát cắt SSR 133 ms. Lighthouse bốn route P99–100/A100/S100; smoke 600 HTTP 200/0 failed. Còn validator/container dữ liệu phát hành, CSP enforce, full UI giải 8 bước, staging, rollback/restore |

Rà đủ 12 phase ngày 2026-11-19: **134/163 checkbox (82,2 %), 29 còn mở**; tính theo checklist, không theo ngày công hoặc độ sẵn sàng phát hành. Phase 12 tách rõ công việc mã nguồn đã kiểm và gate phát hành chưa đạt. Không đổi checkbox phase 01–11; G1/G2, M1/M2, pilot và cổng hạ tầng vẫn mở. Xem [PM sync](../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/pm-261119-phase-12-sync.md).

Sweep đầu ngày **2026-11-20**, trước cấp quyền DB test riêng, giữ **134/163, 29 mở**. Phase 08 sửa in nhánh 64, 9 test/tám PDF; phase 09 bổ sung 18 unit state ma trận. Hồi quy API unit 182, shared 104, worker 44, client 72 đạt; giai đoạn đầu này không query PostgreSQL. Đây là snapshot của [PM sweep ban đầu](../plans/reports/pm-261120-phases-08-12-sync.md), không phải phép đếm lại sau toàn bộ lượt dịch vụ thật.

Sau khi target `localhost:5433/kamito_tt_phase12_test` được xác nhận, API thật **132 ca/21 spec**, public production browser **96 đạt/8 skip/0 lỗi**, axe **36 scan không có violation** và lát cắt ADMIN API → operator confirm → BullMQ → SSR **133 ms** đã đạt. Giữ 18 migration hiện có, không áp migration/seed vào DB dev; hash `.env` không đổi. Lượt browser chốt còn xác nhận công bố BXH qua worker/cache desktop 209 ms, mobile 218 ms. Lighthouse và smoke đã đo riêng, kết quả ở các đoạn dưới. Không suy các kết quả local này thành toàn bộ luồng tám bước UI hoặc staging M1/M2. [API](../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261120-real-api.md), [public/axe](../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261120-real-public-and-axe.md), [lát cắt](../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261120-local-vertical-slice.md).

Lighthouse r01 tìm được thiếu mô tả SEO ở home/giải/nhánh (SEO 92) và một native crash riêng route BXH. Đã sửa metadata tối thiểu, unit client tăng thành **83/83**; build mới focused SEO/chrome/axe **27 đạt/5 skip**, hai case regression mô tả bốn core × vi/en × hai viewport đạt, 36 axe scan mọi mức 0. Full **96/8** phía trên là build trước metadata, không cộng hai lượt thành số ca duy nhất. Focused pass được ghi riêng với phép đo Lighthouse r02 bên dưới; staging/ra mắt vẫn chờ cổng riêng.

Đo lại Lighthouse **r02** trên build metadata cuối đạt, không hạ ngưỡng 85/90/95: home **100/100/100**, event **99/100/100**, draw và BXH **100/100/100** theo thứ tự Performance/Accessibility/SEO; Lighthouse 13.6.0 mobile/simulated, exit 0 và không runtimeError. [Đối chiếu raw](../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/code-reviewer-261120-real-services.md). Kết quả local trên fixture không thay staging/Dokploy/Traefik, full UI tám bước hoặc rollback/restore.

Lệnh và artifact đo cuối: [Lighthouse local](../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261120-real-lighthouse.md).

Smoke local trên trang giải có cache cũng đạt: cấu hình 5 arrivals/s × 120 s, **600 request/iteration**, 600 check HTTP 200 và 0 failed/5xx/dropped. Raw aggregate rate **4,659093/s**; p95 **14,125 ms**, p99 **30,986 ms**. Bốn threshold pass, exit 0, không thêm ngưỡng latency vào tiêu chí gốc. Đây không phải tải browser assets hoặc staging; [báo cáo smoke](../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261120-real-smoke.md).

Sweep cuối sau dịch vụ thật giữ **134/163 checkbox, 29 mở**, phase 08 **27/28**, phase 09 **9/11**, phase 10 **8/9**, phase 11 **10/13**, phase 12 **7/14**; không ô nào đổi trạng thái từ bằng chứng local. Reviewer đếm lại đủ 12 file phase khớp PM. Retained fixture IDs đã dọn về 0, API/client tạm dừng và hai cổng trống; PostgreSQL/Redis giữ nguyên. [PM sync dịch vụ thật](../plans/reports/pm-261120-real-services-sync.md).

Sweep 2026-11-24: **135/163 checkbox (82,8 %), 28 mở**; chỉ phase 12 đổi (8/14, đóng ô E2E tám bước local). Staging, M1/M2, G1/G2, BTC giữ mở.

Redesign theo Figma (2026-11-25, [plan](../plans/261125-0951-figma-ui-redesign-admin-client/plan.md)): admin A1–A11 và client C1–C11 đã triển khai (commit `4a23d31`, `66cc931`, `1ca5582`, `136b10b` cho đợt 2). Build production đạt; full public/CSP enforce 119/15, axe 72 lượt không vi phạm. Lighthouse r01 bắt thiếu mô tả trang trận (SEO 92); đã bổ sung mô tả theo locale, regression 16/16 và focused production 56/12 đạt, Lighthouse cuối bốn route bắt buộc 100/100/100, hai route tham khảo 99/100/100. Full 119/15 và unit 188 thuộc build trước sửa metadata, không cộng với focused. A8 kéo bàn phím ba engine và lưới 6 bàn đã đạt. Admin-full-flow sau redesign đạt ngày 2026-11-26 (desktop 8/8 hai lượt, mobile 8/8 ba lượt; [báo cáo](../plans/reports/tester-261126-1620-admin-full-flow-after-redesign.md)); sáu lượt rớt vì nguyên nhân ngoài redesign đã ghi thành nợ E1–E3 và T2, trong đó E1 (API trạng thái tác vụ xếp hạng) đã sửa và E3 đã đóng cùng ngày, còn E2, E4 và T2 trong [backlog](../plans/261111-1512-kamito-table-tennis-tournament-platform/open-debts-backlog.md). Còn mở kiểm đủ ảnh/PDF, review diff cuối và theo dõi tiến trình thoát đột ngột trên Windows. C11 giữ đang làm. Câu hỏi sản phẩm và staging vẫn mở; không đổi checkbox các phase 01–12. Chi tiết: [changelog](./project-changelog.md), [tester C11](../plans/261125-0951-figma-ui-redesign-admin-client/reports/tester-261125-client-figma-regression.md), [A8](../plans/reports/tester-261125-a8-browser-gates.md).

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
   - Migrate 18 migration hiện có theo thứ tự tên: 16 migration tới phase 10, `20261119090000_add_content_cms` và `20261119151407_add_content_english_fields`. Migration cuối chỉ thêm ba cột TEXT nullable. Xem [system-architecture](./system-architecture.md#dữ-liệu). Đợt 2026-11-19 chỉ migrate đủ 18 trên `localhost:5433/kamito_tt_phase12_test`, không áp dụng hai migration mới vào dev/staging. In target, xác nhận host/tên DB và sao lưu trước migrate; sau đó chạy `seed:config`.
   - Thử `create-admin` trong container api (chưa kiểm chứng).
   - Kiểm sharp trên image Alpine, và upload một ảnh thật với `STORAGE_DRIVER=s3`.
   - Phase 05: upload một file import thật (lưu từ Excel), kiểm tra, nhập, thử gộp VĐV trên staging.
   - Phase 07: worker cần `CLIENT_INTERNAL_URL` và `REVALIDATE_SECRET`. Compose đã khai cho worker. Thử chốt một trận, mở lại một trận (cần step-up), xếp lịch và đổi chỗ hai trận, đổi giờ session, in phiếu trận, xuất xlsx lịch và kết quả, xem job trong bull-board (queue `revalidate`).
   - Phase 08: client cần đủ biến runtime (danh sách trong [deployment-guide](./deployment-guide.md#biến-môi-trường-theo-service)), gồm `REVALIDATE_ALLOWED_HOSTS` (phải khớp `CLIENT_INTERNAL_URL` của worker). Thử trên staging: mở một nhánh đã công bố, chốt một trận, bỏ công bố, rồi xem trang công khai đổi. Chạy Playwright với stack dev trước khi deploy (xem [Playwright e2e](./deployment-guide.md#playwright-e2e-client)). Mốc M1 cần thêm bước này trên staging.
   - Phase 09: trên staging thử tạo bảng xếp hạng, đổi quy tắc điểm (thành phiên bản mới), thêm và xóa điểm thủ công (cần step-up), dựng và công bố một kỳ chốt (cần step-up), gắn bảng vào nội dung và xem gợi ý hạt giống. Chạy `pnpm db:print-target` trước khi migrate, như các phase khác.
4. **Nợ kỹ thuật phase 04** (theo báo cáo tester và review 13:29, chưa đối chiếu lại hết):
   - Test api crash native trong một lần chạy đầy đủ (F1). Chưa tìm được nguyên nhân; theo dõi ở [backlog T2](../plans/261111-1512-kamito-table-tennis-tournament-platform/open-debts-backlog.md#ci--test).
   - Test crash làm sót user test trong DB dev (F3). Đã liệt kê 2026-11-25, chờ xác nhận trước khi xoá ([backlog D2](../plans/261111-1512-kamito-table-tennis-tournament-platform/open-debts-backlog.md#dọn-dẹp-chờ-xác-nhận)).
   - Mặc định duy nhất: advisory lock lấy sau khi đọc dữ liệu cũ, chưa đối chiếu lại phần lock (M2). Partial unique index đã có (migration `20261112070130`).
   - Giá trị viết cứng còn lại, theo luật `/settings` (M6, còn một phần).
   - Các mục L của review chưa đối chiếu.
5. **Phase 05 và 06, nợ còn lại** (theo đối chiếu code):
   - Nginx admin giới hạn 2m cho route upload import (xem [deployment-guide](./deployment-guide.md#giới-hạn-import-excel)).
   - Chuyển hướng slug VĐV cũ/đã gộp đã triển khai ở phase 10; còn kiểm lại trên staging.
   - Chưa thử file xlsx do Excel thật tạo.
   - Phase 06: G1a/G1b đã duyệt trong phiên 2026-11-27; giữ walkover MAIN khi người thắng vòng loại rút, không lucky loser. Còn đối chiếu rule cũ khi rollout; G2 vẫn thiếu bảng điểm thật, consent từng người vẫn cần BTC giữ/đối chiếu bằng chứng ngoài ứng dụng. [Quyết định](../plans/261127-debt-closure/btc-consent-decisions.md), [draws-and-groups](./draws-and-groups.md#chưa-làm).
6. **Phase 07, nợ còn lại** (chi tiết: [scheduling](./scheduling.md#chưa-làm-và-việc-còn-mở), [match-results](./match-results.md#chưa-làm-và-việc-còn-mở)):
   - Chuỗi Q → BYE → R2 khi reopen: chỉ có unit, chưa có e2e.
   - Lịch công khai và bản in lịch đã triển khai ở phase 08 ngày 2026-11-15; API tích hợp 24 test/3 spec đạt; Playwright lịch 5 đạt/1 bỏ qua có chủ đích (PDF mobile).
   - Mục UI từ `ui-verifier-261114-phase-07` (nhãn session thiếu ngày, panel chưa xếp báo "đã xếp hết" khi đang lọc, kéo thả chưa có bàn phím, tooltip cảnh báo trùng, trang in thiếu nút thử lại): đã đóng, đối chiếu code 2026-11-26. Bằng chứng từng mục ở [scheduling](./scheduling.md#chưa-làm-và-việc-còn-mở).
   - Chưa render trên trình duyệt với API thật: cỡ lưới, khổ A4, focus, tương phản.
   - Thiếu e2e: swap giữa hai session, export trên 1.000 dòng (chốt đồng thời, cascade walkover, ván dở của `RETIRED` và Redis tắt đã có e2e từ 2026-11-14).
7. **Phase 08, nợ còn lại** (chi tiết và nguồn: [public-site](./public-site.md#việc-còn-mở)):
   - Nguồn đối chiếu hiện tại: [review debt audit 2026-11-15](../plans/reports/reviewer-261115-phase08-review-debt-audit.md). Báo cáo đợt 1–3 là lịch sử, không giữ các mục đã sửa như nợ đang mở.
   - Mốc M1 vẫn còn deploy/kiểm staging. Lát cắt local `vertical-slice-refresh.seed.ts` đã chứng minh ADMIN tạo giải/bốn entry/sinh và công bố nhánh → operator chốt → BullMQ processor thật → SSR đã cache trong 133 ms. Đây là API-driven standalone, chưa có `vertical-slice.spec.ts` thao tác toàn bộ admin UI và không thay nghiệm thu staging M1.
   - Lịch theo session và bàn, bản in lịch đã triển khai ngày 2026-11-15. API tích hợp và Playwright `schedule.spec.ts` local đã đạt; còn kiểm staging.
   - Bỏ công bố giải, hủy giải, sửa entry hay VĐV đã có tag. Xếp suất vòng loại và nhất/nhì bảng đã có tag từ 2026-11-14 (xem [cache-revalidation](./cache-revalidation.md#mutation-và-tag)).
   - HTML dùng API sanitize lại khi trả; timeout giữ env vì bootstrap, không còn chờ chốt cho hai mục này.
   - Traefik: quy tắc chặn `/api/revalidate` và `forwardedHeaders` chưa kiểm. Rate limit công khai phụ thuộc vào đây.
   - Cache/hạn mức nhiều replica đã dùng Redis chung; hai Next production local đạt kiểm invalidation và hạn mức chung. API settings đọc DB không giữ cache RAM riêng.
   - Nợ code timezone/DST, tìm/sort tên công khai và giới hạn 62 ngày đã sửa, kiểm ở server trước phân trang. Migration `20261115032757_add_player_public_name_key` đã áp dụng DB dev local (16/16), cần áp dụng staging theo cổng hạ tầng. Kiểm local cuối: 41 unit client, 51 Playwright đạt/7 bỏ qua; chưa coi local là hoàn tất M1/M2.
8. **Phase 09, nợ còn lại** (chi tiết: [changelog 2026-11-16](./project-changelog.md#2026-11-16--phase-09-màn-admin-xếp-hạng-chưa-commit)):
   - Đã sửa 2026-11-27: API chặn quy tắc hồi tố, điểm/kỳ chốt ở tương lai và kiểm lại bản nháp cũ khi công bố; hồi quy gồm mốc nửa đêm/DST. [Plan hiện tại](../plans/261127-debt-closure/plan.md).
   - Đã sửa 2026-11-27: admin lấy ngày mặc định, giới hạn và nhãn "Hết hạn" từ context API theo `event.defaultTimezone`; ngày chỉ có lịch giữ nguyên khi hiển thị. [Quy ước](./code-standards.md#xếp-hạng-phase-09).
   - Unit state ma trận đã bổ sung 2026-11-20: 18 ca, admin tổng 29 ca duy nhất đạt; lifecycle React hook/browser/API chưa được bộ unit state này xác nhận. API 571/571 là kết quả lịch sử 2026-11-16.
9. **Phase 10, việc vận hành còn mở:**
   - Chờ hạ tầng phase 01 để deploy staging; kiểm công bố kỳ mới và tag revalidation trong môi trường thật.
   - Xác nhận đồng ý công khai hồ sơ, nhất là VĐV nhỏ tuổi; giữ mặc định `noindex`, không JSON-LD `Person` và không sitemap VĐV.
   - Snapshot cũ thiếu `eventId` vẫn giữ điểm/ngày nhưng che nhãn/link giải nguồn. Tạo và công bố kỳ mới khi cần đầy đủ nhãn; không sửa dữ liệu kỳ đã công bố.
   - Thống kê thắng–thua theo mùa ngoài phạm vi phase 10; quy chế điểm G2 vẫn chờ BTC.

## Hướng mở rộng sau phạm vi hiện tại

> Ghi nhận 2026-11-25. Chưa lập plan, chưa ước lượng công, chưa xếp thứ tự ưu tiên. Nguồn: đối chiếu `docs/Mô tả tính năng QL Thể thao.docx` với code tại ngày ghi nhận. Phép đối chiếu dò theo schema Prisma, danh sách module và grep, chưa đọc từng service.

**Hướng đi:** giữ lõi giải đấu đang có (bốc thăm, xếp lịch, tỷ số, xếp hạng) và đắp thêm lớp tài khoản người chơi, đăng ký, thanh toán lên trên. Không viết lại lõi. Riêng chat nội bộ của giải: tìm giải pháp có sẵn tự host được để tích hợp, không tự code.

### Khoảng trống so với file mô tả

| Nhóm | File mô tả yêu cầu | Code tại 2026-11-25 |
|---|---|---|
| Tài khoản người chơi | Một tài khoản nhiều vai trò (VĐV, BTC, trọng tài, host, chủ CLB); hồ sơ, khu vực, bộ môn yêu thích | Chỉ có `ADMIN` và `RESULTS_OPERATOR` (`packages/db/prisma/schema/auth.prisma`); người chơi không có tài khoản |
| Đăng ký giải | VĐV tự đăng ký bằng form động, BTC duyệt hoặc từ chối | Entry do admin nhập hoặc import Excel; `EntryStatus` chỉ có `CONFIRMED`, `WITHDRAWN`; nút đăng ký ngoài site là link ngoài |
| Thanh toán | Chuyển khoản thủ công, upload biên lai, BTC xác nhận, tự hủy slot quá hạn, đánh dấu chờ hoàn tiền | Chưa có bảng nào |
| Check-in | Mỗi VĐV một mã QR cho một giải, quét hợp lệ một lần | Chưa có |
| Duyệt giải | BTC tạo giải → chờ admin duyệt → active hoặc denied | `PublishStatus` chỉ có `DRAFT`, `PUBLISHED` |
| Trọng tài | Mời trọng tài, phân trọng tài và sân cho từng trận, trọng tài sân xác nhận điểm, trọng tài trưởng sửa điểm khi khiếu nại | Chưa có vai trò trọng tài; sửa và mở lại tỷ số đã có cho `ADMIN` và `RESULTS_OPERATOR` |
| Thể thức | Nhất-nhì-ba mỗi bảng hoặc thành tích tốt nhất; tranh hạng Ba; Max Point; đồng đội MLP | `advancePerGroup` chỉ nhận 1 hoặc 2 (`packages/competition-engine/src/draw-preview.ts`); grep không thấy tranh hạng Ba và Max Point; đồng đội chưa có (ghi chú "TEAM is added later" trong `players-and-entries.prisma`) |
| Nhiều bộ môn | Lọc và gợi ý theo bộ môn | Schema không có khái niệm bộ môn thể thao; `Discipline` là nội dung thi đấu (đơn, đôi, giới tính) |
| Trận giao hữu | Host tạo trận, duyệt VĐV, thu phí, nhập kết quả | Chưa có |
| Câu lạc bộ | Hội viên, trận nội bộ, phiếu thu, sổ quỹ, rút quỹ, dashboard | Chưa có; `club` hiện chỉ là thông tin của VĐV |
| Chat | Mỗi giải một nhóm chat tự tạo, khóa quyền chat, chat 1-1 với BTC | Chưa có; tích hợp giải pháp có sẵn |
| Báo cáo | Doanh thu, giao dịch, tăng trưởng CLB, export | Dashboard hiện chỉ có giải đang diễn ra, trận chờ xử lý và hoạt động gần đây |
| Nền tảng | App Flutter, admin Thymeleaf | Next.js, Refine, NestJS; chưa có app di động |

### Chưa quyết

- Phạm vi và thứ tự làm: nhóm nào làm trước, nhóm nào bỏ.
- Có làm app Flutter hay giữ web hiện tại cho người chơi.
- Mở rộng sang bộ môn khác hay giữ riêng bóng bàn.
- Ứng viên cho chat: chưa khảo sát.
