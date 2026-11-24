# Nợ còn mở — cập nhật 2026-11-24

Danh sách việc dời lại sau lượt CI + audit admin ngày 2026-11-24. Làm xong mục nào thì gạch và ghi commit/bằng chứng.

Nguồn: [audit UI 1440/390](./reports/ui-audit-261124-admin-1440-390.md), [code review](./reports/code-reviewer-261124-ci-and-admin-mobile.md), [phase 07](./phase-07-scheduling-sessions-tables-and-result-entry.md) mục "Việc còn mở".

## Chặn staging (chờ bên ngoài)

| # | Việc | Chờ ai | Ghi chú |
|---|---|---|---|
| S1 | Trả lời checklist hạ tầng | Chủ hạ tầng | [infra-preflight-checklist-261124.md](./reports/infra-preflight-checklist-261124.md) |
| S2 | Câu hỏi G1/G2/consent | BTC | Phase 12, mục "Câu hỏi chưa giải quyết" |

## Admin UI

| # | Mức | Việc | Vị trí | Ghi chú |
|---|---|---|---|---|
| U1 | Trung bình | Kiểm kéo thả nhà tài trợ trên trình duyệt (trục dọc, không bị khung bảng che) | `apps/admin/src/pages/event-hub/sponsors-tab.tsx` (`keepInsideRows`) | DB dev chưa có nhà tài trợ; cần dữ liệu thử |
| U2 | Trung bình | Màu focus theo thương hiệu | theme admin | Nợ phase 07 |
| U3 | Thấp | Cảm biến bàn phím cho kéo thả lịch | `schedule-tab.tsx` (chỉ có `PointerSensor`) | Thao tác 2 click vẫn dùng được bằng bàn phím |
| U4 | Thấp | Trang Cài đặt: nhắc khi đổi tab mà còn thay đổi chưa lưu | `apps/admin/src/pages/settings-page.tsx` | Tab giữ state, nhưng không có dấu hiệu |
| U5 | Thấp | Drawer menu: tự mở lại sau khi đổi desktop → mobile; chưa có tên cho trình đọc màn hình | `apps/admin/src/layout/admin-layout.tsx` | Từ code review |
| U6 | Thấp | Nút tạo (Tạo/Thêm, icon) và kiểu quay lại (link "←" / breadcrumb) chưa thống nhất | `resources/*/…-list.tsx`, `pages/event-hub/*` | Audit L4 |
| U7 | Thấp | Cảnh báo `ColorPicker disabledAlpha` (6 lượt) | `apps/admin/src/resources/catalog-common/color-hex-field.tsx:14` | Audit L1 |
| U8 | Thấp | Cảnh báo Refine `useForm` edit thiếu `id` (22 lượt, 11 trang sửa) | `apps/admin/src/resources/catalog-common/catalog-form-pages.tsx` | Audit L2 |
| U9 | Thấp | Cảnh báo antd "useForm not connected" (46 lượt) | nghi `useTable` của `@refinedev/antd` | Audit L3; nguyên nhân chưa kiểm chứng |
| U10 | Thấp | Cảnh báo "There may be circular references" khi mở modal thêm buổi thi đấu | nghi `session-form-modal.tsx:50-51, 123` (giá trị dayjs) | Audit L7; chưa kiểm chứng |
| U11 | Thấp | Nhảy 76 px khi mở hộp thoại | — | Nợ phase 07; audit 2026-11-24 không thấy lại, cần xác nhận rồi đóng |

## Chưa audit

| # | Việc | Lý do |
|---|---|---|
| A1 | Trang sửa bài viết, video, trang tĩnh, nhà tài trợ; chi tiết hộp thư liên hệ | DB dev không có bản ghi |
| A2 | Toàn bộ admin dưới vai trò `RESULTS_OPERATOR` | Chưa có tài khoản thử |
| A3 | Trang hàng đợi bull-board (`/api/v1/admin/queues`) | Nằm ngoài SPA |

## CI / test

| # | Việc | Ghi chú |
|---|---|---|
| T1 | Khai `passThroughEnv` cho task `test` trong `turbo.json` | Hiện chỉ script `pnpm test` gốc có `--env-mode=loose`; gọi `turbo run test` trực tiếp vẫn bị lọc env |
| T2 | Vitest API trên Windows thỉnh thoảng crash native `0xC0000409` | Chỉ ở máy local; chạy lại từng shard thì đạt. GitHub Actions (Linux) không gặp |

## Dọn dẹp chờ xác nhận

| # | Việc | Ghi chú |
|---|---|---|
| D1 | Tắt hoặc xoá tài khoản `ui-audit@kamito.local` trên `localhost:5433/kamito_tt_dev` | Cách làm ở cuối báo cáo audit; cần xác nhận của chủ repo |
| D2 | Dữ liệu thử tiền tố "QA " và tài khoản admin thử trong DB dev | Nợ phase 07, chờ xác nhận trước khi xoá |
