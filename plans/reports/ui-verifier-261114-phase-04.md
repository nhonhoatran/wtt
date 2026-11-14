# UI verify — phase 04 (admin: danh mục, địa điểm & bàn, danh sách/tạo giải, hub Thông tin + Nội dung thi đấu, cài đặt, upload ảnh)

Checker: agent riêng (không viết trang nào), chỉ đọc, không render. Đọc lúc 15:12–15:15 (2026-11-14). Bound: `apps/admin/src`.
- Trước đây không có file checklist riêng. Đã chạy `ui-consistency:finding-patterns` (nhánh "code đã viết") và lưu kết quả ở `ui/phase-04-ui-checklists.md`.
- **Checklist này viết sau khi trang đã có và chưa ai duyệt.** Các dòng đếm trên chính các trang đang kiểm cộng các trang phase 03/05, nên chỉ bắt được trang lệch khỏi số đông, không bắt được lỗi chung của cả nhóm.
- Nguồn quyết định trước đó: mục "Checklist giao diện admin" trong `reports/implementation-plan-261112-1304-phase-04-task-breakdown.md` (2026-11-12).

## Hiệu chỉnh
- Kind *list* và *form* (Refine `List` / `Create` / `Edit`) **chưa hiệu chỉnh**: không plant nào thử hai kind này.
- Hub tab + modal được phủ bởi hiệu chỉnh phase 07 (3/3 plant bắt được, xem `ui-verifier-261114-phase-07.md`).

## Theo trang (chỉ dòng KHÁC; dòng không nêu = pass)

### A. Danh sách (`tier`, `event-type`, `category`, `discipline`, `match-format`, `group-scoring-rule`, `venue`, `event` `*-list.tsx`)
- Lọc theo nhóm giải (thấp): `event-type-list.tsx:13-18` lấy danh sách nhóm giải bằng Refine `useSelect` (có cả nhóm đã ẩn). Với ô **lọc** thì hiện cả mục ẩn là hợp lý — báo để biết. Xem dòng B bên dưới.
- Còn lại: 8 trang đều pass `ListFilterBar`, `useCatalogTable`/`useListPageSize`, `statusColumn`, `CatalogRowActions` (xác nhận + 409 → "Ẩn thay vì xóa"), ô trống `'—'`.
- Danh sách giải không có cột thao tác: thao tác nằm ở hub, đúng spec.

### B. Form (`catalog-form-pages.tsx` + 7 form catalog/địa điểm, `event-create.tsx`, `event-form-sections.tsx`, `event-intro-section.tsx`)
- Chọn nhóm giải không qua shared piece (trung bình):
  - `event-type-form.tsx:22-28` dùng Refine `useSelect` cho "Nhóm giải". 6 file khác dùng `useCatalogSelect`; piece này lọc `filter[isActive]=true` (`use-catalog-options.ts`, `listUrl`) và được làm mới khi danh mục đổi.
  - Hệ quả theo code UI: chọn được nhóm giải đã ẩn cho hạng giải mới, trái câu `IsActiveField` "Tắt để ẩn khỏi danh sách chọn".
  - Chưa kiểm API `/admin/tiers` có tự lọc mặc định không.
- Chữ nút tạo (thấp): `category-form.tsx:59` `saveText="Tạo mới"`. 6 of 7 form catalog viết "Tạo <danh từ>": "Tạo nhóm giải", "Tạo hạng giải", "Tạo nội dung", "Tạo thể thức", "Tạo luật", "Tạo địa điểm".
- Gợi ý ảnh (thấp):
  - `MediaUploadField` vẽ gợi ý bằng `<span style={{ color: token.colorTextSecondary }}>` (`media-upload-field.tsx:164`). Chữ phụ trong bound viết `Typography.Text type="secondary"` (17 file).
  - Form giải truyền gợi ý qua prop `hint` (`event-form-sections.tsx:110`), không qua `Form.Item extra` như mọi gợi ý field khác.
- Múi giờ dựng hai lần (thấp, chép mã): `timezoneOptions` (`event-form-sections.tsx:23-27`) và `TimezoneSettingEditor` (`setting-value-editors.tsx:30-33`). Bản trong form giữ được múi giờ lạ đang lưu; bản trong cài đặt thì không.
- Giới hạn số chôn trong UI (thấp, luật "cấu hình động"; chưa kiểm có khớp DTO API không):
  - `match-format-form.tsx:31-40` (ván 1–9, điểm 5–50, cách biệt 1–5, phút 5–240);
  - `category-form.tsx:42-45` (tuổi 0–120);
  - `group-scoring-rule-form.tsx:47-63` (0–100, 0–50);
  - `venue-table-modals.tsx:73,103-110` (60, 1–100, 8, 9999).

### C. Hub (`event-hub-page.tsx`, `event-hub-actions.tsx`, `event-info-tab.tsx`, `sub-events-tab.tsx`), cài đặt (`settings-page.tsx`, `settings-field.tsx`, `settings-editors/*`)
- Không khác checklist.
- Bảng trong tab/card (`sub-events-tab`, `venue-tables-section`) dùng nút chữ "Sửa" + `ConfirmActionButton` "Xóa". Đây là họ vùng riêng (2 of 2), khác trang danh sách Refine, nên không coi là lệch.
- Bật/tắt bàn không báo kết quả (thấp): Switch "Hiển thị" ở bảng bàn (`venue-tables-section.tsx:28-35`) lưu xong không có `message.success`. Ẩn/hiện ở danh mục báo "Đã ẩn …" / "Đã hiện lại …" (`catalog-row-actions.tsx:34`).

### D. Hộp thoại (`bulk-sub-event-modal.tsx`, `sub-event-edit-modal.tsx`, `venue-table-modals.tsx`)
- Nhãn không gắn với ô (thấp, a11y): `bulk-sub-event-modal.tsx:98,111` đặt "Chọn nội dung" và "Nhóm tuổi / trình độ" bằng `Typography.Text strong` bên ngoài `Form.Item`. `Checkbox.Group` và `Select multiple` không có `label`/`aria-label`. Mọi trường khác trong family dùng `Form.Item label`; các Select lọc có `aria-label`.
- Literal độ rộng (thấp): `gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))'` (`bulk-sub-event-modal.tsx:107`). Dòng "độ rộng cố định = hằng số".

### Chữ người dùng đọc (xuyên trang)
- Một thứ ba tên (thấp):
  - "Luật vòng bảng" (menu `layout/menu-groups.ts:53`, tiêu đề danh sách);
  - "Luật tính điểm vòng bảng" (`sub-event-format-fields.tsx:43`);
  - "Luật tính điểm bảng" (cột `sub-events-tab.tsx:54`).
- Thể thức của nội dung (thấp): nhãn form "Thể thức thi đấu" (`sub-event-format-fields.tsx:27`), cột bảng "Thể thức" (`sub-events-tab.tsx:52`). Cột đứng ngay cạnh "Thể thức trận", dễ lẫn.
- "Nội dung" hai nghĩa (thấp): nút ở danh mục Nội dung chuẩn là "Thêm nội dung" / "Tạo nội dung" (`discipline-list.tsx:23`, `discipline-form.tsx:54`), trùng chữ "Thêm nội dung" của tab Nội dung thi đấu (`sub-events-tab.tsx:37`) — hai thứ khác nhau.
- Thành phố (thấp): "Thành phố" (`event-intro-section.tsx:19`) và "Tỉnh / thành phố" (`venue-form.tsx:28`, `venue-list.tsx:26`).
- Gợi ý https (thấp): "Bắt đầu bằng https://" (`event-form-sections.tsx:115`) và "Chỉ nhận liên kết bắt đầu bằng https://" (`venue-form.tsx:31`).

## Đúng, nhưng không thuộc task này (phase 03)
- `settings-page.tsx:111` `maxWidth: 640` viết literal.
- `user-list.tsx` đọc `me?.listDefaultPageSize`, không dùng `useListPageSize()`.
- Form users `maxWidth: 480` literal.

## Cả bộ
- 8 danh sách phase 04: khớp nhau.
- 7 form catalog: cùng khung shared. Lệch duy nhất về cơ chế là `event-type-form` (`useSelect`); lệch duy nhất về chữ là `category-form`.
- 3 hộp thoại: `bulk-sub-event` là cái duy nhất có nhãn ngoài `Form.Item`.

## Chưa kiểm được
- Không render: `ColorPicker` / swatch màu tier, ảnh xem trước (`maxHeight: controlHeight*3`), `RichTextField`, bề rộng form 560/720 trên màn hẹp, vùng bấm, tương phản Tag màu `colorHex` do admin chọn.
- Không thử upload thật (poll 2 s / 30 s).
- Không kiểm API (mặc định lọc `isActive`, giới hạn DTO).
- Không chạy typecheck/lint.

Chi phí (ước lượng): 30 file phase 04 so; khoảng 45 file mở, khoảng 12 lệnh tìm/đọc. Gồm cả bước `finding-patterns`: đọc `SKILL.md`, `words.md`, `checklist.md`; không gọi `conventions`/`values` vì bound, theme và dòng giá trị lấy từ checklist phase 05/06.

Status: DONE_WITH_CONCERNS
