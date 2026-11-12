# Phase 05 — kế hoạch giao diện admin (ui-consistency:planning)

Checklist: `ui/phase-05-ui-checklists.md` (mục A–D). Hình dạng trang lấy từ spec phase 05 ("Màn admin", "Luồng thêm đăng ký") + brief của lead (đã chốt, coi là đồng ý).
Mỗi task: (1) đọc lại checklist trước khi viết; (2) báo sẵn sàng → một checker riêng (ui-consistency:verifying) kiểm, sửa theo báo cáo; (3) ghi trạng thái `done` / `parked — <lý do>`.

| # | Task | Checklist | Tham chiếu | Không chép | Trạng thái |
|---|---|---|---|---|---|
| 0 | Hiệu chỉnh checker: bản nháp event-list có 1 vai trò viết khác (ngoài repo) | A | event-list.tsx | — | done |
| 1 | Shared mới: `api/api-base-url.ts` (base URL cho link tải/PUT thô), `components/player-lookup-select.tsx` | C, D | list-filter-bar (Select + onSearch) | — | done |
| 2 | Danh sách VĐV + Gộp VĐV (modal, step-up) | A, D | event-list, user-row-actions | màu eventType | done |
| 3 | Tạo/Sửa VĐV (3 Card nhóm; bản đã gộp chỉ đọc + Alert) | B | event-form-sections, user-edit | slug, media upload | done |
| 4 | Cặp đôi (list chỉ đọc) | A | event-list | — | done |
| 5 | Lịch sử import + trang chi tiết import (bước 3) | A, C | event-list, venue-tables-section | — | done |
| 6 | Wizard import (Modal + Steps; bước 3 chuyển sang /imports/:id) | D | bulk-sub-event-modal | — | done |
| 7 | Tab hub "Danh sách": menu nội dung, form thêm, bảng, thanh hàng loạt | C | sub-events-tab, venue-tables-section | cột của sub-events | done |

## Decided
- Ô ảnh VĐV bỏ: `MEDIA_PURPOSES` không có `player-photo` (packages/shared/src/media/media-contract.ts).
- Bước 3 của wizard = trang `/imports/:id` (giữ được khi tải lại trang, có lịch sử link tới, job chạy nền vài chục giây).
