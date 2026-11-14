# Phase 04 — checklist giao diện admin (ui-consistency:finding-patterns, viết sau khi trang đã có)

Snapshot đọc ngày 2026-11-14 trong bound `apps/admin/src` (1 ứng dụng). Theme: `antdTheme` của `@kamito/ui-tokens/antd-theme` qua `ConfigProvider` ở `app.tsx`; không có `DESIGN.md`. Code thắng khi lệch với snapshot này.
Checklist này viết **sau** khi trang phase 04 đã có, để kiểm (nhánh "code đã viết, chưa có checklist" của `ui-consistency:verifying`). Chưa ai duyệt. Nguồn quyết định trước đó: mục "Checklist giao diện admin" trong `reports/implementation-plan-261112-1304-phase-04-task-breakdown.md` (đọc 2026-11-12, trước khi viết trang) — các dòng ở đó được giữ khi còn đúng, đánh dấu "(11-12)".
Cách đếm: `grep -rlE -- "<tên>"` trên các member nêu ở đầu mỗi mục; mỗi search chạy trên tham chiếu trước. Dùng nguyên, không đếm lại, các dòng giá trị phase 05/06 đã mang: khoảng cách/màu qua `theme.useToken()` / `Flex gap` / preset `Tag`, không hex, không literal khoảng cách; độ rộng cố định = hằng số UPPER_CASE; `message.error(error instanceof ApiError ? error.message : '…')`; `message.success('Đã …')`; `Modal destroyOnHidden cancelText="Hủy"`; tải `Skeleton active` / lỗi `Result status="error" … Thử lại`.

## A. Trang danh sách (`resources/*/*-list.tsx`) — kind *list* (Refine `List` + `Table`), tham chiếu `resources/users/user-list.tsx` (11-12, mức 3); 13 member / 13 ứng viên

- [ ] khung — `List title` tiếng Việt; nút tạo ở `headerButtons` = `CreateButton` "Thêm …"/"Tạo …", chỉ hiện khi có quyền — 10 of 10 list có nút tạo (3 list không tạo: audit-log, import, pair); cách ẩn theo quyền: `canCreate ?` 7 file (qua `useCatalogAccess`) / `CanAccess` 2 file — không có quy ước, cả hai ra cùng kết quả cho người dùng
- [ ] hàng lọc — `ListFilterBar` (search + select) ngay trên bảng — shared piece, 13 of 13
- [ ] bảng — `Table {...tableProps} rowKey="id"`, sort/lọc/phân trang ở server, `syncWithLocation: true` — 13 of 13 (6 file trực tiếp + 7 catalog qua `useCatalogTable`)
- [ ] số dòng mỗi trang — `useListPageSize()` — shared piece, 12 of 13 (`user-list` đọc thẳng `me?.listDefaultPageSize` — lệch phase 03, không chép)
- [ ] trạng thái ẩn/hiện — `statusColumn`: `Tag green` "Đang hiện" / `Tag` không màu "Đã ẩn" / `Tag blue` "Mặc định" — shared piece trong `catalog-common/catalog-table.tsx`, 7 file
- [ ] thao tác dòng — `EditButton hideText size="small"` + `Dropdown` nút `MoreOutlined aria-label="Thao tác khác"` — 3 of 3 list có thao tác dòng (`CatalogRowActions` cho 7 catalog, `user-row-actions`, `player-list`)
- [ ] xác nhận ẩn / xóa / đặt mặc định — `useConfirmAction` / `ConfirmActionButton`; xóa bị 409 `IN_USE` → hộp thoại số bản ghi phụ thuộc + "Ẩn thay vì xóa" (`onHide`) — shared piece (11 file) + as asked (phase 04 bước 11)
- [ ] ô trống — `'—'` — 7 of 7 list có cột có thể trống
- [ ] không chép từ users: `TempPasswordModal`, `me?.listDefaultPageSize`, nhãn vai trò (11-12)

## B. Form tạo/sửa (catalog, địa điểm, giải) — kind *form* (Refine `Create`/`Edit` + `useForm`), tham chiếu `resources/users/user-create.tsx` (11-12, mức 3); member: 7 catalog qua `CatalogCreatePage`/`CatalogEditPage` + `event-create` + `users` 2 + `player-create/edit`

- [ ] khung — `Create`/`Edit` của Refine, nút lưu qua `saveButtonProps` (chữ "Tạo <danh từ>" khi tạo; "Lưu nháp" cho giải theo spec) — shared piece `catalog-form-pages.tsx` (7 resource); chữ nút tạo: 6 of 7 catalog viết "Tạo <danh từ>"
- [ ] form — `Form layout="vertical"`, `rules [{ required, message }]`, lỗi 422 `fields` vào field; gợi ý ở `extra` — majority (11-12, 2/2 → nay mọi form trong bound)
- [ ] bề rộng form — hằng số đặt tên (`FORM_MAX_WIDTH` 560, `EVENT_FORM_MAX_WIDTH` 720, `PLAYER_FORM_MAX_WIDTH`) — 3 hằng / 2 file users literal 480; giá trị: không có quy ước (4 giá trị khác nhau)
- [ ] chọn mục danh mục (Select) — `useCatalogSelect` (lọc `isActive=true`, làm mới khi danh mục đổi) — shared piece, 6 file; Refine `useSelect` trực tiếp 3 file
- [ ] ẩn/hiện — `IsActiveField` (Switch "Hiện"/"Ẩn" + extra chuẩn) — shared piece, 7 file
- [ ] ảnh — `MediaUploadField` trong `Form.Item` (trạng thái bằng `Tag` + `Progress`, lỗi `Alert type="error"`, "Kiểm tra lại") — shared piece, 3 file (tier, event-type, event form)
- [ ] nhóm field form giải — `Card title` ("Thông tin chung", "Thời gian & địa điểm", "Hiển thị", "Giới thiệu") xếp `Flex vertical gap={token.margin}` — như `settings-page` (11-12, mức 7)
- [ ] slug — `SlugInput` (tự sinh theo tên, kiểm trùng sau `CHECK_DEBOUNCE_MS`, gợi ý "Dùng …") — shared piece do plan nêu tên

## C. Trang tự gọi API (hub giải, cài đặt) — tham chiếu `pages/settings-page.tsx` (11-12); member: `event-hub-page`, `settings-page`, `event-create` (dữ liệu mặc định)

- [ ] tải / lỗi — `useQuery` + `apiFetch`; `Skeleton active`; `Result status="error"` + "Thử lại" — 3 of 3
- [ ] tiêu đề — `Typography.Title level={3} style={{ margin: 0 }}` — 2 of 2 trang không dùng khung Refine
- [ ] hub — link `ArrowLeftOutlined` "Danh sách giải", tag vòng đời + công bố, nút thao tác `ConfirmActionButton`, `Tabs` theo URL `/events/:id/:tab` — tham chiếu (11-12 mục D)
- [ ] tab có bảng nhỏ (nội dung thi đấu) — `Table pagination={false}` (dữ liệu nhỏ, ngoại lệ có lý do), thao tác dòng là nút chữ "Sửa" + `ConfirmActionButton` "Xóa" `size="small"` — vùng bảng-trong-tab: 2 of 2 (`sub-events-tab`, `venue-tables-section`)
- [ ] cài đặt — `SettingField`: `Tag gold "Đã chỉnh"`, dòng "Mặc định: …", "Khôi phục mặc định"; editor bề rộng hằng số — shared piece

## D. Hộp thoại (`bulk-sub-event-modal`, `sub-event-edit-modal`, `venue-table-modals`) — kind *modal*, family modal (phase 05 dòng D)

- [ ] khung — `Modal title okText="<động từ>" cancelText="Hủy" destroyOnHidden`, `width={640}` khi đặt width — family
- [ ] trường — `Form layout="vertical"` + `Form.Item label` (nhãn gắn với ô) — majority
- [ ] lỗi — lỗi field vào `form.setFields`, còn lại `message.error` hoặc `Alert type="error"` đầu nội dung — family

## Chữ người dùng đọc (cả phase)
- [ ] một tên cho một thứ: "Luật vòng bảng" (menu, tên danh sách), "Thể thức trận", "Nội dung thi đấu" vs "Nội dung chuẩn" — menu `layout/menu-groups.ts` là nguồn

Bỏ ra (không có quy ước hoặc giống nhau mọi trang): khoảng cách trang (`Flex gap` middle/large), thứ tự cột.
Chi phí: ~45 file dự án mở, ~10 lệnh tìm; đọc `finding-patterns/SKILL.md`, `words.md`, `checklist.md` (không gọi `conventions`/`values`: bound, theme và dòng giá trị mang lại từ checklist phase 05/06).
