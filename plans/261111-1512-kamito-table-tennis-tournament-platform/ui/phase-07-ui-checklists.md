# Phase 07 — checklist giao diện admin, phần còn lại (ui-consistency:finding-patterns)

Snapshot đọc ngày 2026-11-14 trong bound `apps/admin/src` (1 ứng dụng; thư viện dùng: `@kamito/ui-tokens`, `@kamito/shared`, `@kamito/competition-engine`). Theme: `antdTheme` của `@kamito/ui-tokens/antd-theme` qua `ConfigProvider` ở `app.tsx` — không đếm lại (phase 05/06 đã mang); không có `DESIGN.md`. Kích thước đã chốt: trang mới → đủ phase. Code thắng khi lệch với snapshot này.
Cách đếm: `grep -rlE -- "<tên>" .` trên toàn `apps/admin/src`; mỗi search chạy trên tham chiếu trước. Dùng nguyên, không đếm lại, các dòng phase 05/06 đã mang: khoảng cách/màu qua `theme.useToken()` / `Flex gap` / preset `Tag`, không hex, không literal khoảng cách; độ rộng cố định = hằng số UPPER_CASE; `message.error(error instanceof ApiError ? error.message : '…')`; `message.success('Đã …')`; `Modal destroyOnHidden cancelText="Hủy"`; tải `Skeleton active` / lỗi `Result status="error" … Thử lại`.

Số đếm dùng ở dưới (một search mỗi vị trí):
- `HUB_TABS` render 4 tab: info, sub-events, entries, draws (`event-hub-page.tsx`).
- `useConfirmAction(|ConfirmActionButton` 11 file; `modal.confirm(` trực tiếp 3 file (shared piece + `match-score-drawer.tsx` + `user-row-actions.tsx`).
- `<Modal` 12 file; `width={640}` 6 file (mọi hộp thoại có đặt width).
- `useStepUp(` 2 file (định nghĩa + `player-merge-modal.tsx`).
- `<Drawer` 1 file (`match-score-drawer.tsx`); `statusCode === 409` 2 file (`confirm-action-button.tsx`, `use-match-actions.ts`).
- `DownloadOutlined` 2 file, `apiUrl(` 3 file (`entries-tab.tsx` là nút tải duy nhất trong hub).
- `draggable|onDragStart|onDrop|dnd-kit|react-dnd` 1 file (`tiebreaker-list-field.tsx`, `@dnd-kit/core` 6.3.1 + `@dnd-kit/sortable` 10.0.0 đã có trong `apps/admin/package.json`).
- `window.print|@media print|print\.css` 0 file; không có file `.css` nào trong `apps/admin/src`.
- `DatePicker|TimePicker` 3 file (chỉ `DatePicker`; `TimePicker` 0); `DISPLAY_DATE_FORMAT` (`resources/events/event-labels.ts:41`) 4 file (định nghĩa + event-form-sections, player-form, pair-list); `Input.Search` 2 file (list-filter-bar, results-entry-page); `'HH:mm DD/MM/YYYY'` literal 3 file.
- `Radio.Button|optionType="button"` 2 file; `<Select` 19 file; `Tooltip` 6 file; `message.warning` 2 file; `Segmented`, `Popover` 0 file.

## A. Tab hub "Lịch & kết quả" (`schedule-tab.tsx`, sửa `event-hub-page.tsx`) — kind *hub tab* (file `*-tab.tsx` trong `pages/event-hub`, render qua `HUB_TABS`), tham chiếu `draws-tab.tsx` (mới nhất, commit 9aa23f5 2026-11-13); 4 member / 5 ứng viên (bỏ `event-hub-page.tsx` — dispatcher)

- [ ] đăng ký tab — `{ key: 'schedule', label: 'Lịch & kết quả', render }` vào `HUB_TABS` sau `draws`, nhận `HubTabContext` — 4 of 4 tab qua `HUB_TABS`
- [ ] khung — `Flex gap="middle" align="start"`: trái `div style={{ width: SIDE_MENU_WIDTH, flex: 'none' }}` chứa panel "Trận chưa xếp" (D), phải `Flex vertical gap="middle" style={{ flex: 1, minWidth: 0 }}` chứa lưới (C) — 2 of 2 tab có panel trái (entries, draws); dùng lại hằng `SIDE_MENU_WIDTH`
- [ ] chọn ngày → session — giữ ở URL (`?day=`, `?session=`, hằng số đặt tên cạnh `SUB_EVENT_QUERY_PARAM`) — 2 of 2 tab có lựa chọn giữ ở search params; mặc định: hôm nay nếu `event.lifecycle === 'ONGOING'` và có session hôm nay, không thì ngày session đầu tiên — như yêu cầu; control: `Radio.Group optionType="button"` cho ngày (`dayjs(date).format(DISPLAY_DATE_FORMAT)`) và cho session (`S01 · 08:00–12:00`) — Radio.Button 2 file; ít lựa chọn, đổi thường xuyên → 1 click, không mở Select
- [ ] thao tác session — cạnh chọn session: `Button icon={<PlusOutlined />}` "Thêm session", "Sửa", "Xóa" (`ConfirmActionButton danger`) chỉ khi `canUpdate`, mở hộp thoại B — shared piece xác nhận 11 file
- [ ] hàng tiêu đề — `Flex justify="space-between" align="center" wrap gap="small"`: trái tên session (`Typography.Title level={4} style={{ margin: 0 }}` + `Tag` mã), phải `Space wrap` các nút — tham chiếu entries-tab (hàng tiêu đề có nút, 1 file); title level 4 như 2 of 2 tab có tiêu đề nội dung
- [ ] "In phiếu trận" — `Button icon={<PrinterOutlined />}` mở trang F ở tab mới (`target="_blank"`) với `sessionId` (+ `tableId` nếu đang chọn cột bàn) — vị trí mới
- [ ] "Làm mới trang công khai" — `Button`, `loading` khi gọi `POST /admin/events/:id/revalidate`, không xác nhận (idempotent, như "Tính lại BXH" phase 06); xong `message.success('Đã gửi yêu cầu làm mới trang công khai')`, có `PUBLIC_REFRESH_DELAYED` → `message.warning` — cơ chế cảnh báo: `match-score-drawer.tsx` (message.warning 2 file)
- [ ] "Xuất Excel" — `Dropdown` + `Button icon={<DownloadOutlined />}` "Xuất Excel", 2 mục "Lịch thi đấu" / "Kết quả" là link `href={apiUrl('/admin/exports/schedule?…eventId')}` / `…/results?…` — cơ chế tải: entries-tab (`Button href={apiUrl(…)}`, 1 file); gộp vào một menu vì hàng đã có 3 nút (vị trí mới)
- [ ] tải / lỗi / trống — `Skeleton active`; `Result status="error" … Thử lại`; lỗi phụ `Alert type="warning" showIcon action={<Button size="small">Thử lại</Button>}`; chưa có session → `Empty description="Chưa có session"` + `Button type="primary"` "Thêm session" (chỉ `canUpdate`) — 3 of 3 tab có tải dữ liệu (sub-events, entries, draws)
- [ ] 409 lịch (`expectedScheduleVersion`) — `message.error(ApiError.message)` + tải lại lưới và panel — cơ chế `use-draw-call.ts` (cách xử lý 409 duy nhất trong hub tab, 1 file); không chép mã lỗi draw
- [ ] không chép từ draws-tab: `SubEventSideMenu` (panel lọc theo nội dung/vòng bằng Select, như yêu cầu), `Tabs size="small"` theo loại draw, `drawsOverviewKey`

## B. Hộp thoại session (`session-form-modal.tsx` — tên chưa có trong spec, xem câu hỏi Q1a) — kind *modal* (form của tài nguyên con), tham chiếu `resources/venues/venue-table-modals.tsx` (`TableFormModal`); family modal 12 file

- [ ] khung — `Modal open title={session ? \`Sửa session ${code}\` : 'Thêm session'} okText="Lưu" cancelText="Hủy" onOk={() => form.submit()} confirmLoading destroyOnHidden width={640}` — tham chiếu; 640: 6 of 6 hộp thoại có width (form dài hơn venue-table)
- [ ] form — `Form layout="vertical"`, `Form.Item name label rules[{ required, message }]`, gợi ý ở `extra` — majority form (phase 05 dòng B)
- [ ] ngày — `DatePicker format={DISPLAY_DATE_FORMAT}`, mặc định = ngày đang chọn ở tab — 2 of 2 ô ngày đơn dùng hằng này (event-form-sections, player-form; `list-filter-bar` là RangePicker, không tính)
- [ ] mã / tên — `Input` mã với `extra="Ví dụ: S01."` (như "Ví dụ: T01." của mã bàn); tên tùy chọn — tham chiếu
- [ ] giờ bắt đầu / kết thúc — `TimePicker format={TIME_FORMAT}` với `TIME_FORMAT = 'HH:mm'` là hằng số đặt tên (cạnh `DISPLAY_DATE_FORMAT`), `minuteStep` không chôn số — vị trí chưa member nào có (TimePicker 0 file); validate giờ kết thúc > bắt đầu tại field (`dependencies`)
- [ ] địa điểm — `Select` địa điểm, mặc định địa điểm của giải — Select 19 file
- [ ] bàn dùng + thứ tự — danh sách có thứ tự (kéo + nút mũi tên, bàn phím) như `tiebreaker-list-field.tsx` (`@dnd-kit/sortable`, 1 file); mặc định mọi bàn đang hiện của địa điểm theo `order` của bàn — **chờ Q1b** (tách thành component dùng chung hay chép)
- [ ] lỗi lưu — lỗi field từ `ApiError.errors` qua `form.setFields`, còn lại `message.error` — tham chiếu (`useSubmit` trong venue-table-modals)
- [ ] xóa session — ở tab (A), `ConfirmActionButton danger`; 409 (session còn trận) hiện thông báo của API — shared piece 11 file
- [ ] không chép từ venue-table-modals: `BulkTablesModal`, tiền tố mã, `InputNumber` thứ tự

## C. Lưới xếp lịch (`session-grid.tsx`) — component tên + chỗ do spec nêu (mức 1); chưa có lưới nào trong bound → vị trí chưa member nào có: phần tử mang nghĩa của vai trò, giá trị qua theme

- [ ] phần tử — `Table size="small" bordered pagination={false} rowKey`, cột = bàn của session theo thứ tự (`displayName ?? code`), hàng = thứ tự 1…(max+1), cột đầu "#" thứ tự; cuộn ngang `scroll={{ x: 'max-content' }}`, độ rộng cột = hằng `GRID_COLUMN_WIDTH` — `Table` là phần tử `<table>` (vai trò lưới hai chiều); dữ liệu một session nhỏ, cố định → không phân trang server (ngoại lệ có lý do, như BXH bảng phase 06)
- [ ] dữ liệu — một `useQuery` `GET /admin/events/:id/matches?filter[sessionId]=…` cho cả session — **chờ Q2** (trả trọn session trong một lần + cảnh báo trùng theo trận)
- [ ] ô có trận — `#matchNo`, `Tag` mã nội dung, vòng (`roundTitle`), hai bên (`sideName`), `Tag` trạng thái (`MATCH_STATUS_LABELS/COLORS`) — import từ `pages/results/match-types.ts`, không viết nhãn thứ hai (results đã import chéo `event-hub/draw-labels`)
- [ ] ô bấm được — `Button type="text" block size="small" aria-pressed`, đang chọn nền `token.colorPrimaryBg` viền `token.colorPrimary` — cơ chế + giá trị: `bracket-cell.tsx` (1 file, bộ chọn 2-click duy nhất)
- [ ] gán 2 click — bấm trận ở panel D (đánh dấu) → bấm ô trống → `PATCH /admin/matches/:id/schedule` với `expectedScheduleVersion`; bấm trận trong ô rồi ô trống = dời; Esc / bấm lại bỏ chọn; một dòng gợi ý `Typography.Text type="secondary"` trên lưới — như yêu cầu; thực hiện ngay ở click 2 + `message.success` như phase 06 Q3
- [ ] kéo đổi ô — `@dnd-kit/core` `useDraggable` (trận ở panel và ô) + `useDroppable` (ô trống), `PointerSensor` + `KeyboardSensor` như `tiebreaker-list-field.tsx` — thư viện đã có (1 file), không thêm thư viện; bàn phím đi bằng 2-click
- [ ] cảnh báo trùng trên ô — viền `token.colorWarning`, icon `WarningOutlined` màu `token.colorWarning`, `Tooltip` liệt kê ("Nguyễn A có trận #31 cách 10 phút", "Bàn T03 trùng giờ") — Tooltip 6 file; sau PATCH có cảnh báo → thêm `message.warning` một dòng
- [ ] trận không dời được (LIVE/OFFICIAL) — hiển thị chữ thường, không bấm, không kéo — **chờ Q2 (iv)**
- [ ] không có: tự xếp lịch, zoom, đổi chỗ hai trận một lần (API là PATCH một trận)

## D. Panel "Trận chưa xếp" (`unscheduled-panel.tsx`) — component do spec nêu; tham chiếu cơ chế truy vấn `pages/results/results-entry-page.tsx` (cùng endpoint, cùng kiểu `MatchListItem`, 1 file)

- [ ] khung — `Card size="small" title="Trận chưa xếp"` + số trận ở `extra` — `Card title` 10 file
- [ ] bộ lọc — `Select allowClear placeholder="Tất cả nội dung"` (`subEventTitle`), `Select allowClear placeholder="Tất cả vòng"` (`roundTitle`), `Input.Search allowClear placeholder="Tên VĐV hoặc số trận"`, xếp dọc `Flex vertical gap="small"`, rộng 100% panel — như results-entry-page (chữ placeholder); không literal độ rộng
- [ ] dữ liệu — `useQuery` + `placeholderData: keepPreviousData`, `filter[unscheduled]=true`, `filter[subEventId]`, `filter[roundId]`, `q`, `page`, `pageSize = useListPageSize()`; `Pagination size="small" simple` dưới danh sách — như results-entry-page (lọc + phân trang ở server)
- [ ] gõ tìm — trễ bằng hằng `…_DEBOUNCE_MS` — **chờ Q1c** (tách `useDebounced` đang nằm riêng trong results-entry-page)
- [ ] mỗi trận — `Button type="text" block aria-pressed` (đánh dấu cho 2-click, kéo được), chữ `#12 · MS · Vòng 1/32` + hai bên `sideName` — như ô C (`bracket-cell.tsx`)
- [ ] trống — `Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Đã xếp hết trận"` — Empty mọi tab có danh sách
- [ ] lỗi — `Alert type="warning" showIcon action Thử lại` trong card — lỗi phụ như A
- [ ] không chép từ results-entry-page: bộ lọc trạng thái, `Table` + cột, tô "Trận kế tiếp", literal `minWidth: 260/200`, `width: 150/260`, `SEARCH_DEBOUNCE_MS`/`FALLBACK_PAGE_SIZE` riêng

## E. Trang in phiếu trận (`match-sheets-print-page.tsx`, `styles/print.css`) — tên + chỗ do spec nêu; 0 file in trong bound → vị trí chưa member nào có

- [ ] route — trong lớp kiểm đăng nhập nhưng ngoài `AdminLayout` (như `/change-password`, 1 route), `/events/:id/print/match-sheets?sessionId&tableId`, bọc `RequireAccess resource="tournaments" action="read"` — như route hub; ngoài layout để giấy không có menu
- [ ] thanh màn hình (ẩn khi in, class `no-print`) — link `ArrowLeftOutlined` về tab A (như link "Danh sách giải" của hub), `Typography.Title level={3}` "Phiếu trận — S01 · dd/MM/YYYY", `Select allowClear placeholder="Tất cả bàn"`, `Button type="primary" icon={<PrinterOutlined />}` "In" gọi `window.print()` — title level 3 như trang hub
- [ ] tải / lỗi / trống — `Skeleton active` / `Result status="error" … Thử lại` / `Empty description="Session chưa có trận"` — như A
- [ ] phiếu — HTML ngữ nghĩa, không dùng component antd trong vùng in: `<section className="match-sheet">`, `<h2>` "Trận #12 · MS – Vòng 1/32", `<dl>` bàn + giờ, `<table>` hàng = Ván 1…`bestOf`, cột = tên hai bên, ô trống để ghi điểm, dòng "Chữ ký trọng tài" — như yêu cầu (tên 2 bên, nội dung–vòng, bàn, giờ, ô điểm từng ván, chữ ký); số ô = `bestOf` từ thể thức trận, không chôn số
- [ ] stylesheet — `styles/print.css` import ở trang; `@media print { .no-print { display: none } }`, mỗi phiếu `break-inside: avoid`; kích thước giấy/ô (mm, pt) là custom property đặt tên ở đầu file (`--sheet-…`), mực đen trên nền trắng — không có theme cho giấy, literal → tên (luật hằng số)
- [ ] số phiếu mỗi trang — đề xuất 2 phiếu / A4 dọc (nửa A4 mỗi phiếu) — vị trí không có tiền lệ; đề xuất, đi cùng plan
- [ ] dữ liệu — một `useQuery` `GET /admin/events/:id/match-sheets?sessionId&tableId`

## F. Màn nhập tỷ số — mở rộng drawer (`match-score-drawer.tsx`, `use-match-actions.ts`) — trang đang có được sửa; tham chiếu chính nó (`<Drawer` 1 file, commit d32ad96)

- [ ] hàng nút (trận chưa chốt) — giữ `Space wrap`; thứ tự: "Chốt kết quả" (primary), "Bắt đầu" (SCHEDULED), "Lưu tạm" (LIVE), "Hủy bắt đầu" (LIVE), "Không đến / Bỏ cuộc" — như yêu cầu; quyền: Bắt đầu / Hủy bắt đầu / Lưu tạm theo `useCan matches update` (`canStart` có sẵn), còn lại `matches.confirm` — ma trận phase 03
- [ ] gọi API — mọi thao tác mới (`un-start`, `save-progress`, `amend-scores`, `reopen`) đi qua `useMatchActions` (mở rộng union action), kèm `expectedVersion`, lỗi vào `problem` — shared piece trong area (1 file), không viết fetch thứ hai
- [ ] "Lưu tạm" — gửi `analysis.entered`, tắt khi chưa có ván nào, không xác nhận (đảo được), `message.success('Đã lưu tạm')` — như yêu cầu
- [ ] "Hủy bắt đầu" — `useConfirmAction` ("Hủy bắt đầu trận?", content "Các ván đã lưu tạm sẽ bị xóa.", `okText="Hủy bắt đầu"`, `danger`) — shared piece 11 file; xác nhận "Chốt kết quả" đang gọi `modal.confirm` trực tiếp → chuyển sang `useConfirmAction` khi sửa file này (shared piece, mức 4: 10 file dùng shared, 2 file tự gọi)
- [ ] trận đã chốt — dưới `OfficialResult`: "Sửa tỷ số" (`useCan matches amend`) mở G, "Mở lại" (`useCan matches reopen`) mở H; không quyền → không hiện — như `canStart`/`canConfirm` (2 lần `useCan` trong drawer)
- [ ] 409 — `ProblemAlert` loại `conflict`: chữ `MATCH_CONFLICT_TEXT` ("Trận vừa được cập nhật bởi người khác") + nút "Tải lại" — shared piece trong area (`use-match-actions.ts`, `statusCode === 409` 2 file)
- [ ] cảnh báo `PUBLIC_REFRESH_DELAYED` sau mọi thao tác ghi → `message.warning('Đã lưu. Trang công khai sẽ cập nhật chậm hơn')` — như "Chốt" trong drawer
- [ ] không chép (lệch trong lát cắt, để refactor sau): literal khoảng cách/độ rộng trong `game-score-inputs.tsx` (`paddingLeft: 64`, `marginLeft: 64`, `width: 88/56/16`, `opacity: 0.45`) và `results-entry-page.tsx` (`minWidth: 260/200`, `width: 150/260`) — phần còn lại của bound dùng token / hằng số đặt tên

## G. Hộp thoại "Sửa tỷ số" (`amend-scores-modal.tsx`) — kind *modal*, tham chiếu `pages/event-hub/draw-entry-action-modal.tsx` (hộp thoại mới nhất có lý do bắt buộc, 2026-11-13)

- [ ] khung — `Modal width={640} destroyOnHidden cancelText="Hủy" okText="Lưu tỷ số"`, `okButtonProps={{ loading, disabled: !valid || winnerChanged || reasonTooShort }}`, `afterClose` reset — tham chiếu; 640: 6 of 6
- [ ] nội dung — `Flex vertical gap={token.margin}`; lỗi `Alert type="error" showIcon` đầu nội dung (409 thêm `action` "Tải lại") — family modal (phase 05 dòng D)
- [ ] ô điểm — `GameScoreInputs` + `analyzeDraft`, điền sẵn `draftFromDetail` — shared piece trong area (1 file), không viết lưới ô thứ hai
- [ ] giữ người thắng — nếu người thắng suy ra khác `detail.winnerSide`: chữ đỏ `Typography.Text type="danger" role="alert"` "Sửa tỷ số không được đổi người thắng — dùng Mở lại", OK tắt — cách báo lỗi ván của `game-score-inputs.tsx`
- [ ] lý do — `Form.Item label="Lý do" required extra="Ghi vào nhật ký thao tác."`, lỗi ngắn tại field qua `validateStatus/help`, `Input.TextArea rows={2} maxLength` — tham chiếu; hằng độ dài **chờ Q3**
- [ ] xong — đóng, drawer nhận detail mới, `message.success('Đã sửa tỷ số')`; 409 "Dùng Mở lại" (bảng đã đưa người vào nhánh) hiện chữ của API trong Alert
- [ ] không chép từ draw-entry-action-modal: `Radio.Group` thao tác, `Select` VĐV thay thế, `dryRun`

## H. Hộp thoại "Mở lại" (`reopen-preview-modal.tsx`) — kind *modal*, tham chiếu `pages/event-hub/draw-entry-action-modal.tsx` (hộp thoại xem trước ảnh hưởng duy nhất cùng `player-merge-modal.tsx`)

- [ ] khung — `Modal width={640} destroyOnHidden cancelText="Hủy" okText="Mở lại"`, OK tắt khi có ô bị chặn hoặc lý do chưa đủ — tham chiếu
- [ ] xem trước — `useQuery GET /admin/matches/:id/reopen-preview` (`retry: false, gcTime: 0`), `Skeleton active paragraph={{ rows: 2 }}`; ô sẽ gỡ trong `Alert type="warning" showIcon` ("Sẽ gỡ Nguyễn A khỏi trận #34 (chưa đấu)"); không ảnh hưởng → `Alert type="info"`; lỗi `Alert type="error"` — tham chiếu
- [ ] ô bị chặn — `Alert type="error" showIcon` liệt kê "Trận #40 đã đấu — kết quả sẽ bị xóa"; người có `matches.reopen` (ADMIN) thấy thêm `Button danger type="primary"` "Cưỡng chế mở lại" ở footer (render `footer` giữ Hủy + Mở lại) — vị trí mới; `force` chỉ ADMIN = cùng quyền `matches.reopen` (ma trận `packages/shared/src/permissions.ts:43`)
- [ ] step-up — lời gọi `reopen` bọc `useStepUp()`, không tự hỏi mật khẩu — shared piece (1 nơi dùng: `player-merge-modal.tsx`)
- [ ] lý do — như G (`Form.Item label="Lý do" required extra="Ghi vào nhật ký thao tác."`) — tham chiếu
- [ ] xong — trận về LIVE, drawer nạp lại ô điểm từ ván cũ, `message.success('Đã mở lại trận')`; 409 kèm xem trước mới → nạp lại xem trước + Alert lỗi
- [ ] không chép từ draw-entry-action-modal: `dryRun` qua POST (ở đây là GET preview riêng), `Radio.Group`, `Select`
