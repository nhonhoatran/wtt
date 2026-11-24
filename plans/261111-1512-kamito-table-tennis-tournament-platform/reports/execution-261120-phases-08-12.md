# Rà soát và thực thi tiếp phase 08–12 — 2026-11-20

## Phạm vi đã đối chiếu

Đọc đủ năm phase, checklist và mã hiện hành trước khi chia việc. Thực hiện các phần local đủ điều kiện theo ủy quyền; giữ các cổng staging, quy chế BTC và đồng ý công khai hồ sơ ở trạng thái mở.

| Phase | Kết luận ban đầu | Gói thực thi |
|---|---|---|
| 08 | Checklist code đã đóng; M1/M2 còn staging. Chưa có bằng chứng PDF nhánh 64; desktop Playwright đang 1280 thay vì 1440 | Kiểm component/CSS thật với nhánh 64 và tên dài; sửa bản in nếu tái hiện lỗi; desktop 1440 |
| 09 | G2 và staging còn mở; thiếu unit regression cho state ma trận điểm admin | Tách helper state thuần, kiểm sửa/hoàn tác/copy ô điểm 0 và đổi phạm vi; giữ nguyên giao diện/API |
| 10 | Chỉ còn deploy/đo lại cache trên staging | Hồi quy liên quan; không xây lại tính năng đã hoàn tất |
| 11 | Local CMS có sẵn; publishing sweep/retention chưa đủ kiểm thật | Bổ sung kiểm tích hợp sweep, retry và retention động; chạy CMS/home/contact thật nếu DB test được xác nhận |
| 12 | Staging/CSP enforce/đo tải/rollback/full workflow còn mở | Bổ sung axe/Playwright và runner Lighthouse để đo local có thể tái chạy; hồi quy và đối chiếu cổng; không lấy local thay nghiệm thu staging |

## Phân công và thứ tự

1. `phase08`: sửa bracket, bài kiểm print64, viewport Playwright; bổ sung marker đầu trang giải để kiểm và sửa phân trang in trong EventShell thật.
2. `phase0910`: chỉ sửa helper/hook/modal ma trận điểm và bài unit tương ứng.
3. `phase1112`: chỉ sửa bài kiểm publishing/retention cùng support cần thiết; chưa truy cập DB khi chưa xác nhận.
4. Điều phối: kiểm môi trường, xếp lịch DB độc quyền, rà thay đổi chéo, giao kiểm thử/review độc lập rồi đồng bộ toàn plan và docs.
5. Điều phối sở hữu thêm công cụ kiểm accessibility/hiệu năng client, dependency/lockfile tương ứng. Registry xác nhận `@axe-core/playwright@4.14.0` (MPL-2.0), `lighthouse@13.6.0` (Apache-2.0); phiên bản được ghim để tái lập.

## Ràng buộc môi trường đã kiểm

- `git status --short` đầu lượt: chỉ có một tài liệu `.docx` chưa track trong `docs/`; không thuộc phạm vi thay đổi.
- `node scripts/print-db-target.mjs`: `localhost:5433/kamito_tt_dev`, mật khẩu được ẩn.
- Trạng thái ban đầu theo `docker compose -f /mnt/d/Project/wtt/docker-compose.dev.yml ps -a`: PostgreSQL/Redis/S3 hiện có đang dừng. Sau đó chỉ bật lại Redis bằng compose để chạy kiểm cache; không thay volume. PostgreSQL vẫn chưa được bật/query/migrate/seed trong lượt này.
- Node/pnpm có sẵn ngoài sandbox; dùng yêu cầu nâng quyền khi sandbox chặn, không kết luận máy thiếu runtime.
- Đang chờ xác nhận riêng target `localhost:5433/kamito_tt_phase12_test` trước khi chạy kiểm có ghi DB. Không sửa root `.env`.

## Kết quả

| Phase | Đã thực hiện | Chưa thể đóng |
|---|---|---|
| 08 | Đã sửa tên bị ellipsis và trang đầu dư khi dùng EventShell thật; nhánh 64 chia năm tờ, đủ 63 trận. Chín test đạt; tám PDF A4/A3 đơn/đôi vi/en đủ tên/ngữ cảnh, không cắt chữ. Kiểm screen 1440/390 và nhánh nhỏ tám suất đạt | Deploy staging, M1/M2 và vertical slice admin tạo → công bố → chốt → SSR |
| 09 | Tách state thuần; thêm 18 ca regression, nằm trong 29 ca admin đạt, module mới coverage 100% | G2; staging; lifecycle React/browser và wizard hạt giống vòng loại chưa được thay bằng unit |
| 10 | Đối chiếu xác nhận code/checklist local đã hoàn tất theo bằng chứng cũ, giữ nguyên tính năng | Deploy và đo cache trên staging |
| 11 | Mở rộng suite publishing thành năm ca; thêm sweep cứu delayed job, retry/revalidation, retention động và guard DB/CAS. Typecheck/lint/list đạt | Chưa thực thi năm ca DB; ma trận CMS/home/contact/storage/staging chưa đủ |
| 12 | Bổ sung bốn ca axe (36 lượt trang), runner Lighthouse có ngưỡng cấu hình; kiểm launch/report bằng HTTP fixture riêng. Vá high Effect bằng override hẹp `@prisma/config>effect: 3.22.1` | Axe/Lighthouse sản phẩm chưa đo; CSP enforce, SEO validator/container/staging, E2E tám bước và rollback/restore vẫn mở |

Kiểm cuối sau `pnpm install --frozen-lockfile`: API `src` 182/182, client 72/72 với Redis thật, admin 29/29, shared 104/104, worker 44/44 đạt. Prisma validate, DB generate/build, API/worker typecheck/build đạt. Source client cuối sau bản sửa EventHero/draw route đã được tester độc lập chạy lại TypeScript, ESLint, production build và 72/72 unit: tất cả đạt. Không cộng 18 unit state lần nữa vào 29 admin.

Audit cuối **0 high/critical, 2 moderate** (`uuid`, `minimatch`); audit exit 1 vì moderate, không gọi là sạch hoàn toàn. Reviewer xác nhận graph và package Effect được nạp đều 3.22.1. Cài lại dependencies từng bị chặn bởi symlink Linux trong virtual store; đã lưu target, chỉ gỡ symlink trỏ vào kho package nội bộ rồi frozen install Windows thành công, không xóa thư mục package hoặc dữ liệu ứng dụng.

Tổng kế hoạch vẫn **134/163 checkbox (82,2%), 29 mở** sau sweep đủ 12 phase. Không thêm checkbox để tăng tỷ lệ; các gói trên tăng kiểm chứng hoặc sửa nợ của nội dung local đã đánh dấu.

Nguồn:
- [QA tổng](tester-261120-local-checks.md)
- [QA print64](../../reports/tester-261120-phase08-print64-desktop1440.md)
- [QA ranking admin](../../reports/tester-261120-phase09-admin-unit.md)
- [QA publishing](tester-261120-phase11-publishing.md)
- [Review độc lập](code-reviewer-261120-phases08-12.md)
- [Sweep toàn kế hoạch](../../reports/pm-261120-phases-08-12-sync.md)
