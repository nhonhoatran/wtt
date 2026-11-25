# Phase A6 — Tab "Danh sách đăng ký" + nhập Excel ngay trong tab

## Context links
- Gap: [research/admin-figma-gap.md](./research/admin-figma-gap.md) mục "1-14"
- Figma: `figma/admin/1-14.png` (cuối; khối trên cùng bị lặp do ghép frame — bỏ qua), `1-10…1-13.png` (các bước nhập)
- Code: `apps/admin/src/pages/event-hub/entries-tab.tsx`, `entry-table.tsx` (184 dòng — sát trần), `add-entry-form.tsx`, `entry-labels.ts`, `apps/admin/src/components/import-wizard.tsx`, `import-preview-table.tsx`, `apps/admin/src/resources/imports/import-detail-page.tsx`, `import-commit-bar.tsx`
- Câu hỏi mở: Q5 ("Cách sửa" + tải danh sách lỗi), Q6 (trạng thái "Chờ xác nhận")

## Overview
- Ưu tiên: P2. Effort: ~5h. Trạng thái: done (2026-11-25). Phụ thuộc: A4 (`SubEventPills`).
- Pill nội dung thay side menu; hàng công cụ gọn; "Thêm VĐV" mở form thu gọn; nhập Excel hiển thị cả 3 bước trong tab (không rời trang).

## Key insights
- Bước 3 hiện nằm ở `/imports/:id` để sống qua reload khi worker đang kiểm (`import-wizard.tsx:22`). Giữ được điều đó trong tab bằng `?import=<jobId>`: tab đọc param → render `ImportJobPanel` (tách từ `import-detail-page.tsx`), trang `/imports/:id` dùng lại cùng panel → DRY.
- Import vẫn cấp giải (một file cho mọi nội dung) — nhanh hơn Figma (mỗi nội dung một file). Tiêu đề panel: "Nhập danh sách từ Excel · <tên giải>".
- Bỏ checkbox "Bỏ qua dòng lỗi": commit đã luôn bỏ dòng lỗi và hộp xác nhận nói rõ (`import-commit-bar.tsx:22,53`) → checkbox chỉ thêm 1 click.
- Stepper 3 bước Figma: Tải file (gộp "Tải mẫu" + upload) → Kiểm tra dữ liệu → Xác nhận/Đã nhập. "Tải file mẫu" thành nút trên hàng công cụ (luôn thấy), nên bước 1 chỉ còn kéo-thả file.
- Chip tổng hợp lấy từ `countsByStatus` của job (đã có): hợp lệ / lỗi / cần xác nhận VĐV. Figma "trùng VĐV đã có" ≈ `NEEDS_CONFIRM`.
- Trạng thái entry chỉ 2 giá trị (CONFIRMED/WITHDRAWN) → bảng hiện "Đang tham gia/Đã rút" (nhãn hiện có), không vẽ "Chờ xác nhận" cho tới khi chốt Q6.
- `entry-table.tsx` đã 184 dòng → tách cột ra `entry-columns.tsx` trước khi sửa.
- E2E dùng nút `/Import Excel$/`, `'Đã có file, tiếp tục'`, `/Thêm VĐV$/` (`apps/client/tests/admin-full-flow/events-and-imports.ts`) → cập nhật selector cùng phase.

## Requirements
- Thanh `SubEventPills` (nhãn + số `confirmed`), giữ `?subEvent=`.
- Hàng công cụ: tìm VĐV/CLB + lọc trạng thái (đưa từ `EntryTable` lên, vẫn là filter server của `useTable`) · "Tải file mẫu" · "Thêm VĐV" (toggle form `AddEntryForm` dạng Card thu gọn; Esc đóng) · "Nhập từ Excel" · menu "…" có "Xuất Excel".
- Panel nhập (Card có nút đóng ×, đặt trên bảng): Steps 3 bước; bước 1 Dragger + tiến độ upload; khi có job → `?import=<id>` và panel hiện trạng thái job (đang kiểm → spinner + polling như hiện tại), chip đếm, Alert vàng "Có N dòng lỗi…", bảng xem trước (component sẵn có), thanh dưới: "Quay lại"/"Tải file khác" · "Nhập N dòng" (ConfirmActionButton sẵn có). Xong → Alert thành công + invalidate danh sách + đếm; đóng panel xoá param.
- Bảng entry: Hạt giống · VĐV (+ cặp) · CLB · Điểm xếp hạng (`pointsAtEntry`) · Trạng thái · Thao tác (Sửa, "…": Rút/Khôi phục). Giữ chỉnh seed inline + bulk bar hiện có.
- Card tiêu đề "Danh sách hiện có · N VĐV/cặp".

## Architecture
```
EntriesTab
 ├─ SubEventPills(counts)
 ├─ EntriesToolbar(search/status → EntryTable filters, template link, add toggle, import toggle, export)
 ├─ [AddEntryForm (collapsible)]
 ├─ [ImportPanel] ── no job: ImportUploadStep ; job: ImportJobPanel(jobId)  ← ?import=
 └─ EntryTable(columns from entry-columns)
/imports/:id → ImportDetailPage → ImportJobPanel(jobId)   (cùng component)
```
Data flow: file → POST /admin/imports → PUT file → POST uploaded → set `?import=id` → GET /admin/imports/:id (poll) → rows (server paginate) → commit → invalidate entries + entry-counts + progress.

## Related code files
Sửa
- `apps/admin/src/pages/event-hub/entries-tab.tsx`
- `apps/admin/src/pages/event-hub/entry-table.tsx` (bỏ ListFilterBar riêng, nhận filters từ toolbar; tách cột)
- `apps/admin/src/components/import-wizard.tsx` (chỉ còn bước upload, export `ImportUploadStep`; bỏ Modal)
- `apps/admin/src/resources/imports/import-detail-page.tsx` (dùng `ImportJobPanel`)
- `apps/client/tests/admin-full-flow/events-and-imports.ts` (selector mới)
Tạo
- `apps/admin/src/pages/event-hub/entries-toolbar.tsx`
- `apps/admin/src/pages/event-hub/entry-columns.tsx`
- `apps/admin/src/pages/event-hub/entries-import-panel.tsx`
- `apps/admin/src/resources/imports/import-job-panel.tsx`
- `apps/admin/src/resources/imports/import-summary-chips.tsx`

## Implementation steps
1. Tách `entry-columns.tsx` khỏi `entry-table.tsx` (không đổi hành vi) — build xanh.
2. Tách `import-job-panel.tsx` khỏi `import-detail-page.tsx` (không đổi hành vi) — kiểm `/imports/:id`.
3. `import-wizard.tsx` → `ImportUploadStep` (gọi callback `onJobCreated(id)` thay vì navigate).
4. `entries-import-panel.tsx` (Steps + upload/job), `import-summary-chips.tsx`.
5. `entries-toolbar.tsx`; chuyển filter search/status từ `EntryTable` lên (giữ `useTable` server).
6. `entries-tab.tsx`: pills + toolbar + panel + table; xử lý `?import=`.
7. Cập nhật E2E selector; chạy E2E nếu stack local sẵn.
8. typecheck/lint/build.

## Todo
- [x] tách entry-columns
- [x] tách import-job-panel
- [x] ImportUploadStep
- [x] entries-import-panel + chips
- [x] entries-toolbar
- [x] ghép entries-tab + `?import=`
- [x] E2E selector
- [x] build xanh

## Success criteria
- Nhập 1 file từ đầu tới cuối không rời tab: đếm thao tác = chọn "Nhập từ Excel" → kéo file → (chờ kiểm) → "Nhập N dòng" → Xác nhận (4 thao tác; hiện tại 6 gồm chuyển trang + quay lại).
- Reload giữa lúc worker kiểm: panel hiện lại đúng job.
- `/imports/:id` vẫn chạy như cũ.
- Tìm/lọc entry vẫn gửi query server (network có `q=`/`filters`).

## Risk assessment
| Rủi ro | K × T | Giảm thiểu |
|---|---|---|
| Tách file làm hỏng seed inline / bulk bar | TB × TB | Bước 1–2 tách không đổi hành vi, build + thử tay trước khi đổi UI |
| Hai panel (thêm + nhập) mở cùng lúc rối | TB × Thấp | Mở cái này đóng cái kia |
| Polling job chạy nền khi đóng panel | Thấp × Thấp | Unmount → react-query dừng |
Rollback: revert phase; `/imports/:id` giữ đường cũ nên dữ liệu không ảnh hưởng.

## Security considerations
- Upload giữ nguyên luồng hiện có (giới hạn kích thước từ setting, kiểm ở API/worker).
- Nút "Nhập từ Excel"/"Thêm VĐV" theo `tournaments.create`; override theo `tournaments.manage` như cũ.

## Next steps
- Q5 (mã lỗi + "Cách sửa", export dòng lỗi), Q6 (Chờ xác nhận).
