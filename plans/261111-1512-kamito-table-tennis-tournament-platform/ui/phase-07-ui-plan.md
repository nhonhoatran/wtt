---
topic: Phase 07 (phần còn lại) — giao diện admin tab "Lịch & kết quả", session, lưới xếp lịch, in phiếu trận, mở rộng màn nhập tỷ số
reference: apps/admin/src/pages/event-hub/draws-tab.tsx (tab); apps/admin/src/resources/venues/venue-table-modals.tsx (form session); apps/admin/src/pages/event-hub/bracket-cell.tsx (ô 2-click); apps/admin/src/pages/results/results-entry-page.tsx (truy vấn trận); apps/admin/src/pages/results/match-score-drawer.tsx (drawer); apps/admin/src/pages/event-hub/draw-entry-action-modal.tsx (hộp thoại lý do / xem trước)
written: 2026-11-14
---

# Phase 07 (phần còn lại) — kế hoạch giao diện admin (ui-consistency:planning)

Kết thúc kiểu 3: các task gắn vào plan phase 07 đang chạy (bước 7, 8, 10, 11 của `phase-07-scheduling-sessions-tables-and-result-entry.md`). Checklist đầy đủ (snapshot 2026-11-14, code thắng khi lệch): `ui/phase-07-ui-checklists.md`; mỗi task dưới đây mang sẵn các dòng của mình.
Trạng thái: chưa tick = `todo`, tick = `done`, `parked — <lý do>` giữ chưa tick. Mỗi task có 3 bước:
(1) đọc lại checklist trước khi viết, không viết theo trí nhớ; (2) báo sẵn sàng → bên giao task gửi cho checker của loại trang đó (một agent `ui-consistency:verifying` giữ cho mọi trang cùng loại, không phải agent viết, không phải agent đã hiệu chỉnh), sửa theo báo cáo; (3) ghi trạng thái vào plan này: `done` khi kiểm qua, hoặc `parked — <lý do>`.

Chung cho mọi task (giá trị, nhắc lại trong từng task khi giao riêng): khoảng cách/màu qua `theme.useToken()` / `Flex gap` / preset `Tag`, không hex, không literal khoảng cách; độ rộng cố định = hằng số UPPER_CASE đặt tên; lỗi thao tác `message.error(error instanceof ApiError ? error.message : '…')`; thành công `message.success('Đã …')`; giá trị nghiệp vụ (nghỉ tối thiểu, thời lượng trận, page size) lấy từ API/AppSetting, không chôn trong UI. Backend do agent khác làm song song; hợp đồng = bảng "API (admin)" trong file phase.

## Decided

Đã chốt 2026-11-14 — mọi task `parked` vì Q1–Q4 được gỡ:
- Q1a: tạo `pages/event-hub/session-form-modal.tsx`.
- Q1b, Q1c: tách dùng chung — `components/sortable-list-field.tsx` (sửa `tiebreaker-list-field.tsx` dùng lại) và hook `useDebouncedValue` (sửa `results-entry-page.tsx` dùng lại). Chủ repo đồng ý.
- Q2 (hợp đồng API, backend phase 07 làm theo): (i) `GET /admin/events/:id/matches?filter[sessionId]=…` trả trọn session (không phân trang khi lọc theo session, có trần an toàn), mỗi trận kèm `conflicts[]`; (ii) bỏ xếp = `PATCH schedule` với `sessionId: null`; (iii) API tự tính `scheduledAt` từ giờ bắt đầu session + thứ tự (+ `MatchFormat.estimatedMinutes`); (iv) chỉ trận `SCHEDULED` được xếp/dời/bỏ xếp.
- Q3: hằng `MATCH_REASON_MIN_LENGTH` / `MATCH_REASON_MAX_LENGTH` trong `@kamito/shared`, như `DRAW_REASON_*`.
- Q4: nút "Làm mới trang công khai" theo quyền `tournaments.update`.
- Phạm vi: trang Nhập tỷ số mặc định session hiện tại + nhớ bàn đã chọn — **làm trong task 7** (spec "Màn admin" yêu cầu).

## Tasks

- [ ] **0. Hiệu chỉnh checker (kind hub tab, modal, drawer).** Bản sao `draws-tab.tsx` ngoài checkout (worktree tạm) viết khác một vai trò (vd lỗi tải dùng `Alert` thay `Result … Thử lại`); bản sao `draw-entry-action-modal.tsx` với ô lý do không bắt buộc; bản sao `match-score-drawer.tsx` với 409 chỉ `message.error` (mất nút "Tải lại"). Giao agent `ui-consistency:verifying` kèm mục A, G, F của checklist, chỉ nói "bản sao khác ở đâu đó". Người cài không kiểm. Không bắt được → dừng, ghi checker mù chỗ đó. Lưới (C), panel (D), trang in (E) không có tham chiếu cùng loại → không plant được; ghi là chưa hiệu chỉnh.

- [x] **1. Tách component dùng chung.** done phần sortable (`components/sortable-list-field.tsx`, tiebreaker dùng lại) + hook `components/use-debounced-value.ts`; đổi `results-entry-page.tsx` sang hook thuộc agent kết quả.
  - Q1b: `components/sortable-list-field.tsx` từ `resources/group-scoring-rules/tiebreaker-list-field.tsx` (`@dnd-kit/sortable`, kéo + nút mũi tên); sửa tiebreaker-list-field dùng lại nó. Không đồng ý → task 3 tự viết danh sách kéo theo đúng cách của tiebreaker-list-field.
  - Q1c: `useDebouncedValue(value, ms)` từ `useDebounced` riêng trong `pages/results/results-entry-page.tsx`; results-entry-page và task 5 dùng. Không đồng ý → task 5 chép cách của results-entry-page.
  Làm trước task 3 và 5.

- [x] **2. Tab "Lịch & kết quả" — `schedule-tab.tsx` + sửa `event-hub-page.tsx`**, theo `pages/event-hub/draws-tab.tsx`. Làm được ngay phần khung; lưới/panel ở task 4, 5.
  Checklist (hub tab, 4 member / 5 ứng viên, bound `apps/admin/src`, snapshot 2026-11-14):
  - [ ] đăng ký tab — `{ key: 'schedule', label: 'Lịch & kết quả' }` sau `draws`, nhận `HubTabContext` — 4 of 4
  - [ ] khung — `Flex gap="middle" align="start"`; trái `width: SIDE_MENU_WIDTH, flex: 'none'` (panel task 5); phải `Flex vertical gap="middle" flex:1 minWidth:0` (lưới task 4) — 2 of 2 tab có panel trái
  - [ ] ngày → session — giữ `?day=`/`?session=` (hằng đặt tên cạnh `SUB_EVENT_QUERY_PARAM`); mặc định hôm nay nếu giải `ONGOING` và có session hôm nay, không thì ngày đầu; `Radio.Group optionType="button"` cho ngày (`DISPLAY_DATE_FORMAT`) và session (`S01 · 08:00–12:00`) — 2 of 2 tab giữ lựa chọn ở URL; Radio.Button 2 file
  - [ ] thao tác session — "Thêm session" (`PlusOutlined`), "Sửa", "Xóa" (`ConfirmActionButton danger`) chỉ khi `canUpdate`, mở hộp thoại task 3 — shared piece 11 file
  - [ ] hàng tiêu đề — `Flex justify="space-between" align="center" wrap gap="small"`: `Typography.Title level={4} margin 0` + `Tag` mã session; phải `Space wrap` nút — như entries-tab
  - [ ] "In phiếu trận" — `PrinterOutlined`, mở trang task 6 ở tab mới với `sessionId` (+ `tableId`) — vị trí mới
  - [ ] "Làm mới trang công khai" — `POST /admin/events/:id/revalidate`, `loading`, không xác nhận, `message.success('Đã gửi yêu cầu làm mới trang công khai')`, `PUBLIC_REFRESH_DELAYED` → `message.warning` — cơ chế từ match-score-drawer; quyền: **Q4**
  - [ ] "Xuất Excel" — `Dropdown` + `Button icon={<DownloadOutlined />}`, mục "Lịch thi đấu" / "Kết quả" là link `apiUrl('/admin/exports/schedule|results?eventId=…')` — cơ chế: entries-tab (`href={apiUrl(…)}`)
  - [ ] tải / lỗi / trống — `Skeleton active`; `Result status="error" … Thử lại`; lỗi phụ `Alert type="warning" showIcon action Thử lại`; chưa có session → `Empty description="Chưa có session"` + primary "Thêm session" khi `canUpdate` — 3 of 3 tab có tải
  - [ ] 409 lịch — `message.error` + tải lại lưới và panel — cơ chế `use-draw-call.ts`
  Không chép từ draws-tab: `SubEventSideMenu`, `Tabs` theo loại draw, `drawsOverviewKey`.
  Dùng: `SIDE_MENU_WIDTH`, `DISPLAY_DATE_FORMAT`, `ConfirmActionButton`, `apiUrl`, `apiFetch`/`ApiError`, `PUBLIC_REFRESH_DELAYED`.

- [x] **3. Hộp thoại session — `session-form-modal.tsx`**, theo `resources/venues/venue-table-modals.tsx` (`TableFormModal`). `parked — waiting on Q1a (tên/chỗ file), Q1b (danh sách bàn có thứ tự)`.
  Checklist (modal, family 12 file `<Modal`):
  - [ ] khung — `Modal title={session ? \`Sửa session ${code}\` : 'Thêm session'} okText="Lưu" cancelText="Hủy" onOk={form.submit} confirmLoading destroyOnHidden width={640}` — tham chiếu; 640: 6 of 6 có width
  - [ ] form — `Form layout="vertical"`, `Form.Item name label rules[{required,message}]`, gợi ý ở `extra`
  - [ ] ngày — `DatePicker format={DISPLAY_DATE_FORMAT}`, mặc định ngày đang chọn ở tab — 2 of 2 ô ngày đơn
  - [ ] mã / tên — `Input` mã `extra="Ví dụ: S01."`; tên tùy chọn — tham chiếu
  - [ ] giờ — `TimePicker format={TIME_FORMAT}` (hằng `'HH:mm'` đặt tên cạnh `DISPLAY_DATE_FORMAT`); kết thúc > bắt đầu validate tại field — vị trí mới (TimePicker 0 file)
  - [ ] địa điểm — `Select`, mặc định địa điểm của giải
  - [ ] bàn + thứ tự — danh sách kéo + nút mũi tên + bàn phím (Q1b), mặc định mọi bàn đang hiện theo `order` của bàn — cơ chế `tiebreaker-list-field.tsx`
  - [ ] lỗi lưu — `ApiError.errors` → `form.setFields`, còn lại `message.error` — tham chiếu (`useSubmit`)
  - [ ] xong — `message.success('Đã thêm session' | 'Đã lưu session')`, đóng, tab nạp lại
  Không chép: `BulkTablesModal`, tiền tố mã, `InputNumber` thứ tự.

- [x] **4. Lưới xếp lịch — `session-grid.tsx`** (tên do spec nêu; không có tham chiếu cùng loại). `parked — waiting on Q2 (dữ liệu trọn session + cảnh báo theo trận, bỏ xếp, scheduledAt, trận nào được dời)`.
  Checklist:
  - [ ] phần tử — `Table size="small" bordered pagination={false}`, cột = bàn theo thứ tự (`displayName ?? code`), hàng = thứ tự 1…(max+1), cột đầu "#"; `scroll={{ x: 'max-content' }}`, cột rộng hằng `GRID_COLUMN_WIDTH`; không phân trang (dữ liệu một session nhỏ, cố định — ngoại lệ có lý do)
  - [ ] dữ liệu — một `useQuery` `GET /admin/events/:id/matches?filter[sessionId]=…` cho cả session (Q2)
  - [ ] ô có trận — `#matchNo`, `Tag` mã nội dung, `roundTitle`, `sideName` hai bên, `Tag` `MATCH_STATUS_LABELS/COLORS` — import `pages/results/match-types.ts`, `event-hub/draw-labels.ts`
  - [ ] ô bấm được — `Button type="text" block size="small" aria-pressed`, đang chọn `token.colorPrimaryBg` / `token.colorPrimary` — như `bracket-cell.tsx`
  - [ ] gán 2 click — trận ở panel → ô trống → `PATCH /admin/matches/:id/schedule` + `expectedScheduleVersion`; trận trong ô → ô trống = dời; Esc bỏ chọn; một dòng gợi ý secondary; `message.success` — như yêu cầu + phase 06 Q3
  - [ ] kéo — `@dnd-kit/core` `useDraggable` / `useDroppable` (ô trống), `PointerSensor` + `KeyboardSensor` — thư viện đã có
  - [ ] cảnh báo trùng — viền + `WarningOutlined` màu `token.colorWarning`, `Tooltip` liệt kê; sau PATCH có cảnh báo → `message.warning`
  - [ ] trận LIVE/OFFICIAL — chữ thường, không bấm/kéo (Q2 iv)
  Không có: tự xếp, zoom, đổi chỗ hai trận một lần.

- [x] **5. Panel "Trận chưa xếp" — `unscheduled-panel.tsx`**, cơ chế truy vấn theo `pages/results/results-entry-page.tsx`. `parked — waiting on Q1c (debounce); phần còn lại làm được`.
  Checklist:
  - [ ] khung — `Card size="small" title="Trận chưa xếp"`, số trận ở `extra`
  - [ ] bộ lọc — `Select allowClear placeholder="Tất cả nội dung"`, `Select allowClear placeholder="Tất cả vòng"`, `Input.Search allowClear placeholder="Tên VĐV hoặc số trận"`, `Flex vertical gap="small"`, rộng 100%
  - [ ] dữ liệu — `useQuery` + `keepPreviousData`, `filter[unscheduled]=true` + `subEventId` + `roundId` + `q` + `page`, `pageSize = useListPageSize()`; `Pagination size="small" simple` — lọc/phân trang ở server
  - [ ] gõ tìm — trễ bằng hằng `…_DEBOUNCE_MS` (Q1c)
  - [ ] mỗi trận — `Button type="text" block aria-pressed`, kéo được, `#12 · MS · Vòng 1/32` + hai bên — như ô lưới task 4
  - [ ] trống — `Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Đã xếp hết trận"`
  - [ ] lỗi — `Alert type="warning" showIcon action Thử lại`
  Không chép từ results-entry-page: lọc trạng thái, `Table` + cột, tô "Trận kế tiếp", `minWidth: 260/200`, `width: 150/260`, `FALLBACK_PAGE_SIZE`.

- [x] **6. Trang in phiếu trận — `match-sheets-print-page.tsx` + `styles/print.css` + route trong `app.tsx`** (tên do spec nêu; không có tiền lệ in).
  Checklist:
  - [ ] route — trong lớp kiểm đăng nhập, ngoài `AdminLayout` (như `/change-password`), `/events/:id/print/match-sheets?sessionId&tableId`, `RequireAccess resource="tournaments" action="read"`
  - [ ] thanh màn hình (class `no-print`) — link `ArrowLeftOutlined` về tab, `Typography.Title level={3}` "Phiếu trận — S01 · dd/MM/YYYY", `Select allowClear placeholder="Tất cả bàn"`, `Button type="primary" icon={<PrinterOutlined />}` "In" → `window.print()`
  - [ ] tải / lỗi / trống — `Skeleton active` / `Result status="error" … Thử lại` / `Empty description="Session chưa có trận"`
  - [ ] phiếu — HTML ngữ nghĩa, không component antd trong vùng in: `section.match-sheet`, `h2` "Trận #12 · MS – Vòng 1/32", `dl` bàn + giờ, `table` hàng = Ván 1…`bestOf`, cột = tên hai bên, ô trống; dòng "Chữ ký trọng tài" — như yêu cầu
  - [ ] stylesheet — `@media print { .no-print { display: none } }`, phiếu `break-inside: avoid`; kích thước mm/pt là custom property đặt tên đầu file; mực đen nền trắng
  - [ ] 2 phiếu / A4 dọc — đề xuất (không có tiền lệ), theo plan's yes
  - [ ] dữ liệu — một `useQuery` `GET /admin/events/:id/match-sheets?sessionId&tableId`

- [ ] **7. Mở rộng drawer — `match-score-drawer.tsx`, `use-match-actions.ts`**, tham chiếu chính nó. Trạng thái: viết xong 2026-11-14, typecheck + lint đạt; chưa bấm thử trên trình duyệt (không có tài khoản seed được ghi trong docs), chờ checker.
  Checklist:
  - [ ] hàng nút — `Space wrap`: "Chốt kết quả" (primary), "Bắt đầu" (SCHEDULED), "Lưu tạm" (LIVE), "Hủy bắt đầu" (LIVE), "Không đến / Bỏ cuộc"; Bắt đầu/Hủy/Lưu tạm theo `canStart` (`matches.update`), còn lại `matches.confirm`
  - [ ] gọi API — `un-start`, `save-progress`, `amend-scores`, `reopen` qua `useMatchActions` (mở rộng union), kèm `expectedVersion`, lỗi vào `problem`
  - [ ] "Lưu tạm" — gửi `analysis.entered`, tắt khi chưa có ván, không xác nhận, `message.success('Đã lưu tạm')`
  - [ ] "Hủy bắt đầu" — `useConfirmAction` ("Hủy bắt đầu trận?", "Các ván đã lưu tạm sẽ bị xóa.", `okText="Hủy bắt đầu"`, `danger`); đồng thời chuyển xác nhận "Chốt kết quả" từ `modal.confirm` sang `useConfirmAction` — shared piece 11 file
  - [ ] trận đã chốt — "Sửa tỷ số" (`useCan matches amend`) → task 8; "Mở lại" (`useCan matches reopen`) → task 9; không quyền → ẩn
  - [ ] 409 — `ProblemAlert` conflict: `MATCH_CONFLICT_TEXT` + "Tải lại"
  - [ ] `PUBLIC_REFRESH_DELAYED` → `message.warning('Đã lưu. Trang công khai sẽ cập nhật chậm hơn')`
  Không chép / không sửa trong task này: literal trong `game-score-inputs.tsx` (`paddingLeft/marginLeft: 64`, `width: 88/56/16`, `opacity: 0.45`) và `results-entry-page.tsx` — lệch có sẵn của lát cắt, ghi để refactor.
  - [x] trang Nhập tỷ số: mặc định giải đang diễn ra + session hiện tại; bộ lọc bàn nhớ lựa chọn lần trước (localStorage, bọc try/catch) — spec "Màn admin", đã chốt 2026-11-14

- [ ] **8. Hộp thoại "Sửa tỷ số" — `amend-scores-modal.tsx`**, theo `pages/event-hub/draw-entry-action-modal.tsx`. Hằng `MATCH_REASON_*` đã có. Trạng thái: viết xong 2026-11-14, typecheck + lint đạt; chưa bấm thử trên trình duyệt (không có tài khoản seed được ghi trong docs), chờ checker.
  Checklist (modal):
  - [ ] khung — `Modal width={640} destroyOnHidden cancelText="Hủy" okText="Lưu tỷ số"`, `okButtonProps={{ loading, disabled: !valid || winnerChanged || reasonTooShort }}`, `afterClose` reset — 6 of 6
  - [ ] nội dung — `Flex vertical gap={token.margin}`; lỗi `Alert type="error" showIcon` đầu nội dung, 409 kèm `action` "Tải lại"
  - [ ] ô điểm — `GameScoreInputs` + `analyzeDraft`, điền sẵn `draftFromDetail`
  - [ ] giữ người thắng — khác `detail.winnerSide` → `Typography.Text type="danger" role="alert"` "Sửa tỷ số không được đổi người thắng — dùng Mở lại", OK tắt
  - [ ] lý do — `Form.Item label="Lý do" required extra="Ghi vào nhật ký thao tác."`, lỗi ngắn qua `validateStatus/help`, `Input.TextArea rows={2} maxLength` (Q3)
  - [ ] xong — đóng, `message.success('Đã sửa tỷ số')`; 409 "Dùng Mở lại" hiện chữ API
  Không chép: `Radio.Group`, `Select` VĐV thay thế, `dryRun`.

- [ ] **9. Hộp thoại "Mở lại" — `reopen-preview-modal.tsx`**, theo `pages/event-hub/draw-entry-action-modal.tsx`. Hằng `MATCH_REASON_*` đã có. Trạng thái: viết xong 2026-11-14, typecheck + lint đạt; chưa bấm thử trên trình duyệt (không có tài khoản seed được ghi trong docs), chờ checker.
  Checklist (modal):
  - [ ] khung — `Modal width={640} destroyOnHidden cancelText="Hủy" okText="Mở lại"`, OK tắt khi có ô bị chặn hoặc lý do chưa đủ
  - [ ] xem trước — `useQuery GET /admin/matches/:id/reopen-preview` (`retry: false, gcTime: 0`), `Skeleton active paragraph={{ rows: 2 }}`; sẽ gỡ → `Alert type="warning"`; không ảnh hưởng → `Alert type="info"`; lỗi → `Alert type="error"`
  - [ ] ô bị chặn — `Alert type="error"` liệt kê; có `matches.reopen` → `Button danger type="primary"` "Cưỡng chế mở lại" ở footer cạnh Hủy + Mở lại (`force: true`)
  - [ ] step-up — lời gọi bọc `useStepUp()`
  - [ ] lý do — như task 8
  - [ ] xong — trận về LIVE, drawer nạp lại, `message.success('Đã mở lại trận')`; 409 → nạp lại xem trước + Alert lỗi
  Không chép: `dryRun` qua POST, `Radio.Group`, `Select`.

- [ ] **10. Đóng plan** — khi mọi task done/parked: báo những gì dưới `## Decided` kèm kết quả.
