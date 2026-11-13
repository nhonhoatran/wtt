# Phase 06 — checklist giao diện admin (ui-consistency:finding-patterns)

Snapshot đọc ngày 2026-11-13 trong bound `apps/admin/src` (1 ứng dụng mount hub giải; thư viện dùng: `@kamito/ui-tokens`, `@kamito/shared`). Theme: `antdTheme` của `@kamito/ui-tokens/antd-theme` qua `ConfigProvider` ở `app.tsx:51`; không có `DESIGN.md`. Kích thước đã chốt: nhiều trang mới → đủ phase.
Cách đếm: grep tên chính xác trên toàn `apps/admin/src` (`grep -rl -- "<tên>" .`); mỗi search chạy trên tham chiếu trước. Không đếm lại các dòng phase 05 đã mang (theme/khoảng cách, `message.error(ApiError…)`, `message.success('Đã …')`, `Modal destroyOnHidden cancelText="Hủy"`) — dùng nguyên.

Theme / giá trị (từ phase 05, kiểm lại `tokens.ts`, `antd-theme.ts`): khoảng cách qua `theme.useToken()` hoặc `Flex gap="small|middle"`; màu qua token antd (`colorPrimary`, `colorBorder`, `colorWarningBg`, `colorTextTertiary`…) hoặc preset màu `Tag`; không hex, không literal khoảng cách. Độ rộng cố định = hằng số đặt tên UPPER_CASE trong file (`SIDE_MENU_WIDTH`, `SEED_INPUT_WIDTH`, `BADGE_OVERFLOW`, `LOOKUP_DEBOUNCE_MS`); độ rộng hộp thoại `width={640}` — 3 of 3 file hộp thoại có width (bulk-sub-event, player-merge, import-wizard), literal.
Giá trị nghiệp vụ (số hạt giống mặc định, cỡ bảng, số đi tiếp) đến từ API (`AppSetting draw.*`), UI không chôn số mặc định. Ngoại lệ có lý do: lựa chọn `advancePerGroup ∈ {1, 2}` là ràng buộc của engine (spec dòng 58), UI lấy danh sách từ API nếu có, không thì hằng số đặt tên kèm comment lý do.

## A. Tab hub "Bốc thăm" (`draws-tab.tsx`, sửa `event-hub-page.tsx`) — kind *hub tab* (file `*-tab.tsx` trong `pages/event-hub`, render qua `HUB_TABS`), tham chiếu `entries-tab.tsx` (mới nhất, 2026-11-12, dùng menu dọc); 3 member / 4 ứng viên (bỏ `event-hub-page.tsx` — dispatcher)

- [ ] đăng ký tab — thêm `{ key: 'draws', label: 'Bốc thăm', render }` vào `HUB_TABS` sau `entries`; nhận `HubTabContext` — 3 of 3 tab qua `HUB_TABS` (comment trong file dự kiến "bốc thăm")
- [ ] khung — `Flex gap="middle" align="start"`: trái `div style={{ width: SIDE_MENU_WIDTH, flex: 'none' }}` + `SubEventSideMenu`, phải `Flex vertical gap="middle" style={{ flex: 1, minWidth: 0 }}`; chọn nội dung giữ ở `?subEvent=` (`SUB_EVENT_QUERY_PARAM`) — tham chiếu (entries-tab là tab duy nhất có menu; shared piece `SubEventSideMenu` 1 file dùng)
- [ ] tiêu đề nội dung — `Typography.Title level={4} style={{ margin: 0 }}` + `Tag` mã nội dung, cùng hàng với nút bên phải (`Flex justify="space-between" wrap gap="small"`); thêm `Tag` trạng thái draw (Nháp = mặc định, Đã công bố = `green`, Đã khóa = `blue`) — tiêu đề: tham chiếu (1 tab có); màu tag: preset như `ENTRY_STATUS`/`PUBLISH_LABELS` (phase 05 dòng A "trạng thái")
- [ ] tải / lỗi — `<Skeleton active />`; lỗi `<Result status="error" title="Không tải được …" extra={<Button>Thử lại</Button>}>`; lỗi phụ (đếm, trạng thái menu) `Alert type="warning" showIcon action={<Button size="small">Thử lại</Button>}` — 2 of 2 tab có tải dữ liệu (info không tải)
- [ ] trống (chưa có draw) — `Empty description="Chưa bốc thăm"` kèm `Button type="primary"` "Bốc thăm" mở wizard; không quyền (`!canUpdate`) → chỉ Empty — 2 of 2 tab có danh sách (entries, sub-events)
- [ ] thanh thao tác nháp — "Bốc lại" (`useConfirmAction`, nội dung: nháp hiện tại bị thay, có ghi nhật ký) + "Công bố" `type="primary"` (`useConfirmAction`, content đúng chữ spec: "Nhánh đấu hiện công khai; khi trận đầu tiên bắt đầu sẽ khóa cấu trúc") — shared piece `ConfirmActionButton`/`useConfirmAction`, 5 file (phase 05); như mẫu `event-hub-actions.tsx`
- [ ] menu "…" sau công bố — `Dropdown` + `Button icon={<MoreOutlined />} aria-label="Thao tác khác"`, mục "Bỏ công bố" chỉ hiện khi chưa khóa — vị trí chưa member nào có; vị trí lân cận: thao tác dòng 3 file (catalog-row-actions, player-list, user-row-actions); mục mở modal lý do (D), không tự `modal.confirm` như user-row-actions
- [ ] vòng loại / vòng bảng → nhánh chính — nút "Bốc suất vòng loại vào nhánh chính" / "Đưa người đi tiếp vào nhánh chính" chỉ bật khi API báo đủ điều kiện, `Tooltip` nói lý do khi tắt — như `sub-events-tab` (Tooltip trên nút bị tắt, 1 file)
- [ ] tab con (thể thức có vòng bảng / vòng loại) — `Tabs size="small"` ("Bảng đấu", "Vòng loại", "Nhánh chính") — 1 file (`import-preview-table`); không lồng `Tabs` mặc định
- [ ] xung đột phiên bản (409 do `expectedVersion`) — `message.error(ApiError.message)` + tải lại draw — mới, chưa có tiền lệ 409 ngoài `IN_USE`
- [ ] không chép từ entries-tab: nút Import/Xuất Excel, `AddEntryForm`, `EntryTable`, cảnh báo đếm đăng ký

## B. Wizard bốc thăm (`draw-wizard.tsx`, `draw-params-step.tsx`, `draw-seeds-step.tsx`) — kind *modal* (wizard), tham chiếu `components/import-wizard.tsx` (wizard duy nhất; family wizard có 1 member → cách riêng của tham chiếu, không phải quy ước); khung hộp thoại theo family modal của phase 05

- [ ] khung — `Modal` `width={640}` `destroyOnHidden` `footer={null}` (nút nằm trong từng bước), `afterClose` reset bước; khóa đóng khi đang ghi (`closable/maskClosable/keyboard={!saving}`) — tham chiếu import-wizard; 640: 3 of 3 hộp thoại
- [ ] chỉ báo tiến độ — `Steps size="small" current items={[Thông số, Hạt giống, Bốc thăm]}` đầu nội dung — tham chiếu (1 file)
- [ ] nội dung — `Flex vertical gap={token.margin}`; lỗi `Alert type="error" showIcon` đầu bước — phase 05 dòng D
- [ ] bước 1 form — `Form layout="vertical"`, `Form.Item name label` + `InputNumber min precision={0}` (số hạt giống, số suất vòng loại, số bảng / cỡ bảng), `Radio.Group` cho số đi tiếp; `initialValues` = mặc định API trả (không literal) — field: majority các form (InputNumber 11 file); Radio: `sub-event-format-fields`
- [ ] tóm tắt sống — `Alert type="info" showIcon` một dòng "51 VĐV → nhánh 64 · 13 BYE · 16 hạt giống", icon `<Spin size="small" />` khi đang tính; gọi `POST …/draws/preview` sau khi dừng gõ (hằng số `…_DEBOUNCE_MS` như `player-lookup-select`); phân cách " · " như `entry-table` — Alert info + Spin: `import-detail-page` (cơ chế); vị trí mới
- [ ] bước 2 hạt giống — bảng `useTable({ resource: entriesResource(id), syncWithLocation: false, pagination: { pageSize: useListPageSize() }, filters.permanent status=CONFIRMED, sorters.initial seed asc })`, `size="small"`; ô seed = `EntrySeedCell` (lưu khi blur/Enter, Tab sang dòng kế) — shared piece trong area (1 file dùng), không viết ô thứ hai
- [ ] "Gợi ý theo BXH" — `Button` mặc định, qua `useConfirmAction` (ghi đè seed hiện có), xong refetch + `showWarnings` — shared piece
- [ ] nút điều hướng — `Flex justify="space-between"`: "Quay lại" (mặc định) trái, "Tiếp tục" / "Bốc thăm" `type="primary"` phải; bước 3 nút "Bốc thăm" `loading` khi ghi, xong đóng modal + tab hiện nhánh nháp + `message.success('Đã bốc thăm …')` — tham chiếu (import-wizard có "Quay lại" + nút chính)
- [ ] ghi đè nháp cũ — nếu đã có nháp cùng kind: nút bước 3 qua `useConfirmAction` ("Nháp cũ sẽ bị thay") — shared piece
- [ ] không chép từ import-wizard: Upload.Dragger, Progress, link tải mẫu, chuyển trang `/imports/:id` (bốc thăm là ghi đồng bộ, không job nền)

## C. Nhánh đấu admin (`admin-bracket-view.tsx`) — component chưa có instance nào trong bound (grep `bracket` trên `apps/*/src` + `packages`: 0 file UI); tên + chỗ đặt do yêu cầu nêu (mức 1). Không có gì để đếm → "điều thứ tự không quyết": viết bằng phần tử mang nghĩa của vai trò, giá trị qua theme

- [ ] khung cuộn — vùng `overflow-x: auto` bọc lưới; mỗi vòng một cột (CSS grid / `Flex`), tiêu đề cột = tên vòng (`Typography.Text strong`) — vị trí mới; cách dựng cột giống thiết kế nhánh công khai phase 08 (CSS grid mỗi cột một vòng) để hai nơi đọc cùng cấu trúc dữ liệu
- [ ] trận — khung viền `token.colorBorder`, bo `token.borderRadius`, số trận `#12` `Typography.Text type="secondary"`; khoảng cách qua token
- [ ] ô VĐV — `Button type="text" block` (phần tử button), tên + seed `[1]`; ô đang chọn: `aria-pressed`, nền `token.colorPrimaryBg` viền `token.colorPrimary`; BYE / ô chờ ("Thắng #5", "Q1"): chữ `type="secondary"`; ở vòng 1 của nháp vẫn bấm để đổi chỗ được (API chỉ chặn BYE–BYE, Q–BYE, khác section — sửa 2026-11-13), các vòng sau không bấm — phần tử mang nghĩa (mức cuối); màu: token theme
- [ ] chế độ nháp — bấm A (đánh dấu) rồi bấm B → `POST swap` với `expectedVersion`, xong `message.success('Đã đổi chỗ …')`; Esc / bấm lại A bỏ chọn; gợi ý một dòng `Typography.Text type="secondary"` trên lưới — như spec (2 click; xem câu hỏi Q3)
- [ ] chế độ đã công bố — bấm ô VĐV → modal D (Thay VĐV / Rút khỏi nhánh); đã khóa: ô đã đấu không bấm được
- [ ] độ rộng ô / cột — hằng số đặt tên (`BRACKET_COLUMN_WIDTH`…), không literal rải rác — quy ước hằng số UPPER_CASE (4 file event-hub/components)
- [ ] dữ liệu — một lần `GET /admin/draws/:id/bracket` (`useQuery`), không gọi theo từng trận; giữ nguyên dữ liệu server, không tự tính lại cây ở client ngoài việc xếp cột
- [ ] không có: kéo-thả, zoom, in (YAGNI; in thuộc phase 08)

## D. Hộp thoại thao tác (`draw-entry-action-modal.tsx`, `manual-tiebreak-modal.tsx`) — kind *modal*, tham chiếu `resources/players/player-merge-modal.tsx` (hộp thoại duy nhất có xem trước ảnh hưởng + lý do bắt buộc); family modal 5+ member (phase 05)

- [ ] khung — `Modal width={640} destroyOnHidden cancelText="Hủy" okText` nói rõ hành động ("Thay VĐV", "Rút khỏi nhánh", "Bỏ công bố", "Lưu thứ hạng"), `okButtonProps={{ danger (rút / hủy công bố), loading, disabled: !preview || !reason.trim() }}`, `afterClose` reset — tham chiếu + family (phase 05 dòng D)
- [ ] chọn thao tác (ô VĐV) — `Radio.Group` "Thay VĐV" / "Rút khỏi nhánh" đầu hộp thoại, mặc định "Thay VĐV"; "Thay VĐV" → chọn đăng ký `CONFIRMED` chưa vào nhánh bằng `Select showSearch` (không dùng `PlayerLookupSelect`: nó tra VĐV toàn hệ thống, ở đây chỉ chọn trong đăng ký của nội dung) — vị trí mới; Radio như `sub-event-format-fields`; mở từ menu "…" thì hộp thoại chỉ có lý do (hủy công bố)
- [ ] xem trước ảnh hưởng — `useQuery` theo lựa chọn, `Skeleton active paragraph={{ rows: 2 }}` khi tải, danh sách dòng "Trận #12 thành walkover cho Trần B" trong `Alert type="warning" showIcon`; lỗi xem trước `Alert type="error"` — tham chiếu (merge preview); **chặn: chưa có API xem trước (Q1)**
- [ ] lý do — `Form layout="vertical"` + `Form.Item label="Lý do" required extra="Ghi vào nhật ký thao tác."` + `Input.TextArea rows={2} maxLength={500}` — tham chiếu (merge modal); `import-commit-bar` viết dạng ô một dòng (inline), không dùng ở đây vì đã trong hộp thoại
- [ ] lỗi ghi — `Alert type="error" showIcon` đầu nội dung, không đóng hộp thoại — tham chiếu
- [ ] phá hòa thủ công — liệt kê VĐV đang hòa (tên + chỉ số), mỗi dòng `InputNumber` thứ hạng (min/max theo số người hòa, không trùng), validate tại field — InputNumber như `entry-seed-cell`; gửi `PATCH manual-ranks`
- [ ] step-up — không gắn trừ khi API đặt `@RequireStepUp` trên route; nếu có thì bọc `useStepUp()` — shared piece (2 file)
- [ ] không chép từ merge modal: `PlayerLookupSelect` theo giới tính, `Descriptions` đếm đăng ký/cặp/trận, chữ cảnh báo "Không hoàn tác được"

## E. Vòng bảng (`group-tables-view.tsx`) — kind *hub tab* (vùng nội dung tab con), không có tham chiếu cùng loại (BXH bảng chưa có ở đâu); bảng con theo `venue-tables-section`/`entry-table` (phase 05 dòng C)

- [ ] mỗi bảng — `Card size="small" title="Bảng A"` xếp lưới `Flex wrap gap="middle"`; trong card: BXH + lịch vòng tròn — `Card title` 3 file (phase 05 dòng B)
- [ ] BXH — `Table size="small" pagination={false} rowKey`, cột: hạng, VĐV, trận, thắng-thua, ván, điểm; dữ liệu nhỏ, cố định trong bảng (≤ cỡ bảng) → không phân trang server (ngoại lệ có lý do); hàng đi tiếp tô `Tag color="green"` "Đi tiếp" — Table size small 2+ file
- [ ] cờ "Cần phá hòa thủ công" — `Alert type="warning" showIcon message action={<Button size="small" type="primary">Phá hòa</Button>}` trên đầu bảng có cờ, mở modal D — Alert warning 4 file; dạng `action` như `entries-tab`
- [ ] "Tính lại BXH" — `Button` mặc định trên card, `loading` khi chạy, `message.success('Đã tính lại BXH bảng A')` — idempotent nên không xác nhận
- [ ] lịch vòng tròn — danh sách trận `#số · A – B` theo lượt, lượt nghỉ ghi "Nghỉ" — `Typography.Text`, giá trị trống `'—'` (phase 05 dòng A)
- [ ] không có: nhập kết quả trận (phase 07)
