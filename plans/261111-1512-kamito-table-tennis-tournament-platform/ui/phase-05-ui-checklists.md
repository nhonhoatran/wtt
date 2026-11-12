# Phase 05 — checklist giao diện admin (ui-consistency:finding-patterns)

Đọc ngày 2026-11-12 trong bound `apps/admin/src` (1 ứng dụng, theme `antdTheme` của `@kamito/ui-tokens` qua `ConfigProvider` ở `app.tsx`; không có `DESIGN.md`).
Cách đếm: grep tên chính xác trên toàn `apps/admin/src` (lệnh: `grep -rl -- "<tên>" .`). Kích thước đã chốt: nhiều trang mới → chạy đủ phase.

Theme / giá trị: khoảng cách qua `theme.useToken()` (`token.margin` 11 lần, `marginXS/XXS/LG`, `padding*`) hoặc `Flex gap="small|middle"` (11 lần). Không literal khoảng cách; độ rộng control (280/180) là literal riêng của `list-filter-bar`, không chép. Màu trạng thái = preset màu `Tag` của antd (green/blue/orange/red), không hex.

## A. Trang danh sách (players, pairs, imports) — kind *list*, tham chiếu `resources/events/event-list.tsx` (mới nhất, được nêu trong yêu cầu); 10 member / 12 ứng viên (bỏ `catalog-routes.tsx`, `use-catalog-options.ts`)

- [ ] page holder — `List` của `@refinedev/antd`, `title` tiếng Việt, nút tạo ở `headerButtons` bọc `CanAccess`/`useCan` — 10 of 10
- [ ] filter row — `ListFilterBar` (search `q` + select), không tự viết — shared piece, 10 of 10
- [ ] bảng — `useTable({ syncWithLocation: true, pagination: { pageSize: useListPageSize() }, sorters.initial })` + `<Table {...tableProps} rowKey="id">` — 10 of 10 (`{...tableProps}` 11 file)
- [ ] cột sort — `sorter` + `defaultSortOrder={getDefaultSortOrder(field, sorters)}`; sort gửi `field:order` qua `data-provider.ts` — majority
- [ ] trạng thái — `Tag` preset màu, `Space size="small" wrap` khi nhiều tag (users, catalog statusColumn) — 2 shared/2 files
- [ ] thao tác dòng — `EditButton hideText size="small"` + `Dropdown` nút `MoreOutlined` `aria-label="Thao tác khác"` — 2 of 2 files có thao tác dòng
- [ ] giá trị trống — `'—'` — majority (venue, event, sub-event)
- [ ] không chép từ event-list: màu eventType, cột riêng của giải

## B. Form VĐV (create/edit) — kind *form page*, tham chiếu `resources/events/event-form-sections.tsx` (form duy nhất có nhóm trường, đúng yêu cầu nhóm); 9 member

- [ ] page holder — `Create`/`Edit` của refine, `saveButtonProps` (+ `children` chữ nút tạo), `deleteButtonProps={{ hidden: true }}` ở Edit — 9 of 9 (qua `CatalogCreatePage/EditPage` hoặc trực tiếp)
- [ ] form — `useForm` refine (422 `errors` tự gắn vào field), `layout="vertical"`, `maxWidth` hằng số đặt tên — 9 of 9
- [ ] nhóm trường — `Card title` xếp trong `Flex vertical gap={token.margin}` — event-form-sections (3 file có `Card title`)
- [ ] field — `Form.Item name label rules[{required,message}]`, gợi ý ở `extra` — 9 of 9
- [ ] công tắc — `Switch` + `valuePropName="checked"`, nhãn Hiện/Ẩn (`IsActiveField`) — shared piece
- [ ] tiêu đề sửa — `` `Sửa: ${name}` `` — users, venues, catalogs
- [ ] không chép: slug input, media upload (không có purpose `player-photo` trong `MEDIA_PURPOSES` → bỏ ô ảnh)

## C. Tab hub "Danh sách" — kind *hub tab*, tham chiếu `pages/event-hub/sub-events-tab.tsx`; 2 member (info, sub-events)

- [ ] nhận `HubTabContext` (event, canCreate/canUpdate…) — 2 of 2
- [ ] dữ liệu phụ — `useQuery` + `apiFetch`, loading `<Skeleton active />`, lỗi `<Result status="error" … extra={<Button>Thử lại</Button>}>` — 4 files Skeleton, 5 files "Thử lại"
- [ ] bảng con có phân trang server — `useTable({ resource: 'sub-events/<id>/entries', syncWithLocation: false, pagination: { pageSize } })` như `venue-tables-section.tsx`, `size="small"`
- [ ] nút chính — `Button type="primary" icon={<PlusOutlined />}`, nằm phải (`Flex justify="end"`) — sub-events-tab
- [ ] trống — `Empty description` kèm nút chính — sub-events-tab
- [ ] xác nhận hành động nguy hiểm — `ConfirmActionButton` / `useConfirmAction` (5 files) — shared piece, không tự `modal.confirm`
- [ ] lỗi thao tác — `message.error(error instanceof ApiError ? error.message : '…')` — 5 files
- [ ] thông báo thành công — `message.success('Đã …')`; cảnh báo API → `message.warning` (mới, chưa có tiền lệ)

## D. Hộp thoại (gộp VĐV, wizard import) — kind *modal*, tham chiếu `bulk-sub-event-modal.tsx`; 5 member

- [ ] `Modal` antd `destroyOnHidden`, `cancelText="Hủy"`, `okText` nói rõ hành động, `okButtonProps={{ loading, disabled }}` — 6 / 7 files
- [ ] lỗi trong hộp thoại — `Alert type="error" showIcon` đầu nội dung; field errors qua `form.setFields` — bulk + venue-table-modals
- [ ] nội dung — `Flex vertical gap={token.margin}`
- [ ] step-up — `useStepUp()` bọc lời gọi, không tự hỏi mật khẩu — shared piece
- [ ] chỉ báo tiến độ wizard — `Steps` antd (chưa có tiền lệ — mới, theo yêu cầu UX "luồng nhiều bước có chỉ báo tiến độ")

- Lý do ghi đè (thêm đăng ký, commit import) là ô nhập ngay tại chỗ, không phải hộp thoại — như yêu cầu ("link mở ô nhập lý do nhỏ"), sửa lại dòng checklist sau lần kiểm 1.

## Câu hỏi / đề xuất
- Không có câu hỏi chặn. `Steps`, `message.warning`, ô `InputNumber` sửa trực tiếp trên bảng là mẫu mới (không có tiền lệ) — báo cáo là mới.
