# Phase 05 — giao diện admin (VĐV, cặp đôi, đăng ký, import)

Ngày 2026-11-12. Phạm vi: chỉ `apps/admin/src`. Build theo hợp đồng API trong brief; API chưa chạy ở `localhost:3000` lúc kiểm (curl → 000) nên **chưa chạy tay trên trình duyệt**.

## Kết quả kiểm
- `pnpm --filter @kamito/admin typecheck` — pass
- `pnpm --filter @kamito/admin lint` — pass
- `pnpm --filter @kamito/admin build` — pass (cảnh báo chunk > 500 kB có từ trước)
- `pnpm --filter @kamito/admin test` — 4/4 pass (test có sẵn, không thêm test mới)

## Màn hình
| Màn | Route | File chính |
|---|---|---|
| Danh sách VĐV (lọc tên/mã, giới tính, CLB, trạng thái; sort mã/tên/năm sinh) + "Gộp VĐV" | `/players` | `resources/players/player-list.tsx`, `player-merge-modal.tsx` |
| Thêm / sửa VĐV (3 nhóm: Thông tin chính, Liên hệ (riêng tư), Hồ sơ công khai); hồ sơ đã gộp → banner + chỉ xem | `/players/create`, `/players/:id/edit` | `player-form.tsx`, `player-create.tsx`, `player-edit.tsx` |
| Cặp đôi (chỉ xem) | `/pairs` | `resources/pairs/pair-list.tsx` |
| Lịch sử import (lọc giải, trạng thái) | `/imports` | `resources/imports/import-list.tsx` |
| Chi tiết import = bước 3 wizard | `/imports/:id` | `import-detail-page.tsx`, `import-commit-bar.tsx`, `components/import-preview-table.tsx`, `components/import-row-decision-select.tsx` |
| Hub giải → tab "Danh sách" | `/events/:id/entries?subEvent=<id>` | `pages/event-hub/entries-tab.tsx`, `sub-event-side-menu.tsx`, `add-entry-form.tsx`, `add-entry-feedback.tsx`, `use-add-entry.ts`, `entry-table.tsx`, `entry-seed-cell.tsx`, `entry-bulk-bar.tsx`, `entry-labels.ts` |
| Wizard import (bước 1–2) | modal trong tab | `components/import-wizard.tsx`, `api/upload-import-file.ts` |

Dùng chung mới: `components/player-lookup-select.tsx`, `api/api-url.ts` (base URL cho link tải mẫu / xuất Excel / PUT file; `main.tsx` gọi `setApiUrlBase` cạnh `setApiBase` vì không được sửa `http-client.ts`).
Sửa: `app.tsx` (resource + route), `layout/menu-groups.ts` (nhóm Vận động viên: Danh sách VĐV, Cặp đôi, Lịch sử import), `event-hub-page.tsx` (tab `entries` "Danh sách" sau "Nội dung thi đấu"), `main.tsx`.

## Luồng người vận hành (đếm thao tác)
- **Thêm VĐV đơn**: vào tab → ô tìm đã focus → gõ tên/mã → Enter (chọn gợi ý đầu) → Enter (thêm). 0 click, 2 phím Enter; ô tìm giữ focus cho người kế.
- **Không thấy VĐV**: gõ tên → chọn "+ Tạo VĐV mới với tên …" → nội dung Nam/Nữ: tạo + thêm luôn (1 lựa chọn); Hỗn hợp/Mở: thêm 1 click chọn Nam/Nữ.
- **Thêm cặp**: ô 1 chọn → focus tự sang ô 2 → chọn → Enter "Thêm cặp". 0 click.
- **Không hợp lệ**: lý do hiện ngay dưới ô (đỏ); ADMIN + mọi lỗi ghi đè được → "Vẫn thêm (cần lý do)" → gõ lý do → Enter. +1 click.
- **Sửa hạt giống**: click ô → gõ số → Tab sang dòng kế (lưu khi rời ô / Enter); trùng → ô đỏ + thông báo dưới ô.
- **Rút hàng loạt**: tick dòng → "Rút" → xác nhận. Đổi vòng / đổi suất: tick → 1 click (không cần xác nhận, đổi lại được).
- **Rút / khôi phục 1 dòng**: "Rút" → xác nhận; dòng rút hiện mờ, nút "Khôi phục" 1 click.
- **Import**: "Import Excel" → (tùy chọn "Tải file mẫu") → "Đã có file, tiếp tục" → kéo file → tự chuyển sang `/imports/:id` (thanh tiến độ upload, tự cập nhật 2 s khi đang kiểm/nhập) → chọn VĐV cho dòng "Cần xác nhận" ngay trong bảng → "Nhập N dòng" → xác nhận. 4 click + 1 kéo file + mỗi dòng cần xác nhận 1 lựa chọn.
- **Gộp VĐV** (ADMIN): dòng VĐV giữ lại → "…" → "Gộp VĐV" → tìm hồ sơ trùng → xem số đăng ký/cặp/trận + xung đột → nhập lý do → "Gộp VĐV" → (nếu cần) nhập lại mật khẩu. 3 click + gõ.

## Lựa chọn thiết kế
- Bước 3 wizard là trang `/imports/:id`, không nằm trong modal: kiểm tra chạy nền vài chục giây, trang giữ được khi tải lại / rời đi, và Lịch sử import link thẳng tới. Bước 1–2 là modal có `Steps`; trang chi tiết hiện lại cùng `Steps` (bước 3).
- Ô lý do ghi đè đặt tại chỗ (không modal), đúng brief.
- Upload file dùng `XMLHttpRequest` thay `fetch` để có % tiến độ thật; cùng origin nên cookie vẫn đi kèm.
- Lựa chọn nội dung giữ ở `?subEvent=`; số trên menu = số đăng ký đang tham gia (`x/max` nếu có tối đa, màu cảnh báo khi đủ).
- Nhãn Suất lấy thẳng `QUOTA_EXPORT_LABELS` của `@kamito/shared` (Thường / Đặc cách / Vòng loại) để màn hình và file Excel cùng chữ.
- Đã theo cập nhật hợp đồng của API agent: gộp 409 `MERGE_CONFLICT` đọc danh sách xung đột ở `ApiError.issues`; không phụ thuộc mã 201; dòng đã rút không hiện hạt giống.

## Lệch so với brief
- **Ô ảnh VĐV bỏ**: `MEDIA_PURPOSES` (`packages/shared/src/media/media-contract.ts:1`) không có `player-photo`. Cần thêm purpose ở shared + API rồi mới gắn `MediaUploadField`.
- Lọc "Giải" ở Lịch sử import viết hook nhỏ riêng vì `useCatalogSelect` luôn gửi `filter[isActive]=true` (events không có).
- `RequireAccess` cho `/players/:id/edit` dùng action `read`: RESULTS_OPERATOR xem được, form tự khóa khi không có quyền `update`.

## ui-consistency
- Checklist: `plans/261111-1512-kamito-table-tennis-tournament-platform/ui/phase-05-ui-checklists.md`; plan: `ui/phase-05-ui-plan.md`.
- Hiệu chỉnh: bản sao 1 file của `event-list.tsx` trong thư mục tạm (`mktemp -d`), cài 1 lệch (cột Công bố thành `span` màu hex + margin literal). Checker hiệu chỉnh **bắt được**. Chỉ chứng minh lệch thấy được trong 1 file (component/literal); chưa thử lệch về cỡ chữ, cuộn, câu chữ; chỉ hiệu chỉnh cho kind *list*, các kind form/hub tab/modal chưa có plant riêng.
- Verifying do 1 checker riêng (không phải tác giả), 2 vòng:
  - Vòng 1: lệch chính đã sửa — nhánh lỗi thiếu `ApiError` (3 chỗ), trạng thái trống hiện nút thêm khi không có quyền + chữ khác tab Nội dung, lỗi tải số đăng ký bị nuốt, 3 cách gọi "ngừng hoạt động", sorter viết khác family, 2 kiểu Switch trên 1 form, `<b>` thay `Typography.Text strong`, meta.label, debounce 250≠300, wizard đóng được khi đang upload. Dòng checklist "lý do ghi đè = modal" sai so với yêu cầu → sửa checklist (ô nhập tại chỗ).
  - Vòng 2: 13/14 sửa giữ đúng; việc đổi "Từ vòng loại" lệch với file Excel → đã quay về nhãn của shared (sau vòng 2, chưa kiểm lại vòng 3 theo quy tắc tối đa 2 vòng).
  - Còn mở theo checker: chữ "Vòng loại" vừa là Vòng vừa là Suất (xem câu hỏi 3); filter "Ngừng hoạt động" có thể trả cả VĐV đã gộp (chưa kiểm API).
  - Chưa đánh giá (không render): kích thước/tràn, thứ tự focus và luồng phím Tab/Enter thực tế, tương phản các cặp màu mới (`colorWarningBg`, `colorTextTertiary`, `colorPrimaryBg`).

## Câu hỏi mở
1. Thêm purpose `player-photo` cho ảnh VĐV ở phase này hay phase 10?
2. `LOOKUP_LIMIT` (10), debounce 300 ms, chu kỳ poll 2 s, giới hạn lý do 500 ký tự đang là hằng số trong code — đưa lên `/settings` không? (checker nêu theo luật cấu hình động; đây là tham số giao diện nhỏ.)
3. "Vòng loại" vừa là giá trị Vòng (QUALIFYING) vừa là giá trị Suất (QUALIFIER) — trên bảng có 2 cột cạnh nhau cùng chữ. Muốn đổi nhãn suất (vd "Từ vòng loại") thì phải đổi ở `packages/shared/src/import-columns.ts` (header + `QUOTA_EXPORT_LABELS`, parser vẫn nhận "vong loai") — ngoài phạm vi admin.
4. `filter[isActive]=false` của /admin/players có gồm VĐV đã gộp không? (nhãn lọc hiện là "Ngừng hoạt động").
