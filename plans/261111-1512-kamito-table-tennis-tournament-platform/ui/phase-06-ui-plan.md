---
topic: Phase 06 — giao diện admin tab "Bốc thăm" (wizard, nhánh, vòng bảng, thao tác sau công bố)
reference: apps/admin/src/pages/event-hub/entries-tab.tsx (tab); apps/admin/src/components/import-wizard.tsx (wizard); apps/admin/src/resources/players/player-merge-modal.tsx (hộp thoại)
written: 2026-11-13
---

# Phase 06 — kế hoạch giao diện admin (ui-consistency:planning)

Kết thúc kiểu 3: các task này gắn vào plan phase 06 đang chạy (bước 5 và 9 của `phase-06-draws-seeding-groups-and-bracket-generation.md`). Checklist đầy đủ (snapshot 2026-11-13, code thắng khi lệch): `ui/phase-06-ui-checklists.md`; mỗi task dưới đây mang sẵn các dòng của mình.
Trạng thái: chưa tick = `todo`, tick = `done`, `parked — <lý do>` giữ chưa tick. Mỗi task có 3 bước:
(1) đọc lại checklist trước khi viết, không viết theo trí nhớ; (2) báo sẵn sàng → bên giao task gửi cho checker của loại trang đó (một agent `ui-consistency:verifying` giữ cho mọi trang cùng loại, không phải agent viết, không phải agent đã hiệu chỉnh), sửa theo báo cáo; (3) ghi trạng thái vào plan này: `done` khi kiểm qua, hoặc `parked — <lý do>`.

Chung cho mọi task (giá trị): khoảng cách/màu qua `theme.useToken()` / `Flex gap` / preset `Tag`, không hex, không literal khoảng cách; độ rộng cố định = hằng số UPPER_CASE đặt tên; giá trị nghiệp vụ (số hạt giống, cỡ bảng, số đi tiếp) lấy từ API (`AppSetting draw.*`), không chôn trong UI; lỗi thao tác `message.error(error instanceof ApiError ? error.message : '…')`; thành công `message.success('Đã …')`; cảnh báo API qua `showWarnings`.

## Decided

Chốt 2026-11-13:
- Q1: API phase 06 bổ sung `GET /admin/events/:id/draws` (tóm tắt theo nội dung), `dryRun: true` cho replace/withdraw/unpublish, response bracket/groups có `status`, `locked`, `version`, `kind`; `preview` không tham số trả mặc định AppSetting.
- Q2: có — thêm prop tùy chọn hiện trạng thái draw cho `SubEventSideMenu` (Chưa bốc / Nháp / Đã công bố); tab Đăng ký giữ nguyên.
- Q3: đổi chỗ ngay ở click thứ 2 (A rồi B), có thông báo thành công.
- Q4: nhãn nút là "Bỏ công bố" (thống nhất với 3 chỗ đang có).
- Q5: không bắt nhập lại mật khẩu; lý do bắt buộc + audit là đủ.

## Tasks

- [ ] **0. Hiệu chỉnh checker (kind hub tab + modal).** `parked — agent ui-consistency:verifying không có trong phiên làm UI này; bên giao task chạy.` 2026-11-13: checker kind hub tab + modal đã kiểm task 2–6 nhưng chưa được hiệu chỉnh (theo skill, bên giao task chạy hiệu chỉnh, checker không tự chạy) — kết quả kiểm task 2–6 coi như chưa hiệu chỉnh cho tới khi task này xong. Bản sao `entries-tab.tsx` ngoài checkout (worktree tạm), viết khác một vai trò (vd: lỗi tải dùng `Alert` thay `Result … Thử lại`) + bản sao `player-merge-modal.tsx` với ô lý do không bắt buộc. Giao agent `ui-consistency:verifying` kèm mục A và D của checklist, chỉ nói "bản sao khác ở đâu đó". Người cài không kiểm. Không bắt được → dừng, ghi checker mù chỗ đó. Ghi kết quả tại đây.

- [ ] **1. API cho UI (không phải task giao diện — chặn task 5, 7).** `parked — waiting on Q1` (xem câu hỏi): cần (a) cách lấy draw của một nội dung + trạng thái draw cho menu (vd `GET /admin/events/:id/draws` tóm tắt, hoặc `GET /admin/sub-events/:id/draws`); (b) xem trước ảnh hưởng của replace/withdraw (vd `dryRun: true` trả danh sách ảnh hưởng, không ghi); (c) response bracket/groups có `status`, `locked`, `version`, `kind`; (d) `preview` không tham số trả mặc định từ AppSetting. Thuộc phần API của phase 06, chủ là người làm API.

- [x] **2. Tab "Bốc thăm" — `draws-tab.tsx` + sửa `event-hub-page.tsx`**, theo `entries-tab.tsx`. `parked — waiting on Q2 (chỉ dòng trạng thái trong menu); phần còn lại làm được`.
  Kiểm 2026-11-13 (checker): qua sau khi sửa — Empty "Thêm nội dung" theo `canCreate` + icon như entries-tab; Tag "Nháp" về màu mặc định (trước là `gold`, lệch với tag "Nháp" trong tab con); nút tắt có Tooltip bọc `<span>` như sub-events-tab, thêm lý do "đã khóa"; nhãn "Đưa người đi tiếp vào nhánh chính". Lệch có lý do: nút thao tác nằm ở hàng trạng thái của từng tab con (mỗi loại bốc thăm một bộ nút), không ở hàng tiêu đề; "Bốc lại" mở wizard, xác nhận thay nháp ở bước cuối.
  Trạng thái 2026-11-13: code xong (draws-tab.tsx, draw-panel.tsx, draw-action-bar.tsx, sub-event-side-menu.tsx slot Q2); chờ checker kind hub tab. Tag trạng thái chung ở tiêu đề, tag trạng thái từng loại bốc thăm nằm trong từng tab con. Nút "Đưa người đi tiếp"/"Bốc suất vòng loại" bật theo dữ liệu draw có sẵn (hợp đồng chưa có cờ đủ điều kiện), lỗi API hiện qua message.
  Checklist (tab hub, 3 member / 4 ứng viên, bound `apps/admin/src`):
  - [x] đăng ký tab — `{ key: 'draws', label: 'Bốc thăm' }` vào `HUB_TABS` sau `entries`, nhận `HubTabContext` — 3 of 3
  - [x] khung — `Flex gap="middle" align="start"`; trái `width: SIDE_MENU_WIDTH, flex: 'none'` + `SubEventSideMenu`; phải `Flex vertical gap="middle" flex:1 minWidth:0`; `?subEvent=` — tham chiếu; shared piece `SubEventSideMenu`
  - [x] tiêu đề — `Typography.Title level={4} margin 0` + `Tag` mã + `Tag` trạng thái draw (Nháp mặc định / Đã công bố `green` / Đã khóa `blue`), nút bên phải cùng hàng — tham chiếu; màu: preset Tag
  - [x] tải/lỗi — `Skeleton active`; `Result status="error" … Thử lại`; lỗi phụ `Alert type="warning" showIcon action Thử lại` — 2 of 2 tab có tải
  - [x] trống — `Empty description="Chưa bốc thăm"` + `Button type="primary"` "Bốc thăm" (chỉ khi `canUpdate`) — 2 of 2
  - [x] thanh nháp — "Bốc lại" + "Công bố" (primary) qua `useConfirmAction`/`ConfirmActionButton`; nội dung xác nhận công bố đúng chữ spec — shared piece, 5 file
  - [x] menu "…" đã công bố — `Dropdown` + `Button icon={<MoreOutlined />} aria-label="Thao tác khác"`; "Bỏ công bố" chỉ khi chưa khóa, mở hộp thoại lý do (task 6) — vị trí mới; lân cận 3 file thao tác dòng
  - [x] vòng loại / bảng → nhánh chính — nút chỉ bật khi API báo đủ điều kiện, `Tooltip` lý do khi tắt — như `sub-events-tab`
  - [x] tab con — `Tabs size="small"` ("Bảng đấu" / "Vòng loại" / "Nhánh chính") — 1 file (`import-preview-table`)
  - [x] 409 phiên bản — `message.error` + tải lại draw — mới
  Không chép từ entries-tab: Import/Xuất Excel, `AddEntryForm`, `EntryTable`, cảnh báo đếm đăng ký.
  Dùng: `SubEventSideMenu`, `SIDE_MENU_WIDTH`, `SUB_EVENT_QUERY_PARAM`, `subEventsKey`, `subEventTitle`, `useConfirmAction`, `apiFetch`/`ApiError`.

- [x] **3. Wizard — `draw-wizard.tsx`, `draw-params-step.tsx`, `draw-seeds-step.tsx`**, theo `components/import-wizard.tsx`.
  Kiểm 2026-11-13 (checker): qua. "Gợi ý theo BXH" tắt + Tooltip theo hợp đồng (suggest-seeds `available: false` tới phase 09) thay cho dòng `useConfirmAction`. Ghi chú: `groupSize` có `min={1}` trong khi API đòi tối thiểu 2 (lỗi hiện qua Alert xem trước).
  Trạng thái 2026-11-13: code xong (draw-wizard.tsx, draw-params-step.tsx, draw-seeds-step.tsx, use-draw-preview.ts); chờ checker kind modal. "Gợi ý theo BXH" để nút tắt + Tooltip "Có khi có bảng xếp hạng" (hợp đồng: available=false tới phase 09), chưa nối `suggest-seeds`.
  Checklist (modal/wizard; family wizard 1 member → cách riêng của tham chiếu):
  - [x] khung — `Modal width={640} destroyOnHidden footer={null}`, `afterClose` reset, khóa đóng khi đang ghi — tham chiếu; 640: 3 of 3 hộp thoại
  - [x] tiến độ — `Steps size="small"` [Thông số, Hạt giống, Bốc thăm] — tham chiếu
  - [x] nội dung — `Flex vertical gap={token.margin}`; lỗi `Alert type="error" showIcon` đầu bước — family modal
  - [x] bước 1 — `Form layout="vertical"`, `InputNumber min precision={0}`, `Radio.Group` số đi tiếp; `initialValues` = mặc định API — majority form (InputNumber 11 file)
  - [x] tóm tắt sống — `Alert type="info" showIcon` (icon `Spin size="small"` khi tính), gọi `preview` sau khi dừng gõ (hằng số `…_DEBOUNCE_MS`), phân cách " · " — cơ chế: `import-detail-page`
  - [x] bước 2 — `useTable` entries `CONFIRMED` (filter permanent) sort seed asc, `size="small"`, `useListPageSize()`; ô seed = `EntrySeedCell` — shared piece
  - [x] "Gợi ý theo BXH" — qua `useConfirmAction`, xong refetch + `showWarnings` — shared piece
  - [x] điều hướng — "Quay lại" trái / "Tiếp tục"·"Bốc thăm" primary phải; ghi xong đóng + `message.success` + tab hiện nháp — tham chiếu
  - [x] ghi đè nháp cũ — xác nhận qua `useConfirmAction` — shared piece
  Không chép từ import-wizard: Upload.Dragger, Progress, link tải mẫu, chuyển trang `/imports/:id`.

- [x] **4. Nhánh đấu admin — `admin-bracket-view.tsx`** (component mới, tên + chỗ do yêu cầu nêu; không có tham chiếu). `parked — waiting on Q3 (chỉ cách đổi chỗ); phần còn lại làm được`.
  Kiểm 2026-11-13 (checker): qua sau khi sửa — thêm `message.success('Đã đổi chỗ hai VĐV')` sau swap (Q3); aria-label chọn thể thức dùng tên vòng. Lệch được chấp nhận: ô BYE / suất vòng loại ở vòng 1 bấm được trong nháp (hợp đồng swap chỉ chặn BYE_VS_BYE, QUALIFIER_VS_BYE, khác section).
  Trạng thái 2026-11-13: code xong (admin-bracket-view.tsx, bracket-cell.tsx, bracket-layout.ts, round-format-select.tsx); chờ checker. Lệch checklist: ô BYE ở nháp vẫn bấm được (hợp đồng swap cho phép đổi BYE, chỉ chặn BYE_VS_BYE).
  Checklist:
  - [x] khung cuộn ngang, mỗi vòng một cột, tiêu đề cột `Typography.Text strong` — vị trí mới; cùng cách dựng cột với nhánh công khai phase 08
  - [x] trận — viền `token.colorBorder`, bo `token.borderRadius`, số trận `type="secondary"`
  - [x] ô VĐV — `Button type="text" block`, đang chọn `aria-pressed` + `colorPrimaryBg`/`colorPrimary`; BYE / ô chờ chữ secondary, không bấm — phần tử mang nghĩa (mức cuối của thứ tự)
  - [x] nháp — bấm A rồi B → swap với `expectedVersion` (theo Q3), Esc bỏ chọn, một dòng gợi ý secondary
  - [x] đã công bố — bấm ô VĐV → hộp thoại task 6; ô đã đấu không bấm
  - [x] độ rộng — hằng số đặt tên (`BRACKET_COLUMN_WIDTH`…)
  - [x] dữ liệu — một `useQuery` `GET /admin/draws/:id/bracket`, không gọi theo trận
  Không có: kéo-thả, zoom, in.

- [x] **5. Vòng bảng — `group-tables-view.tsx`**. `parked — waiting on task 1 (c)`.
  Kiểm 2026-11-13 (checker): qua, không lệch.
  Trạng thái 2026-11-13: code xong (group-tables-view.tsx, group-card.tsx, group-schedule.tsx); chờ checker. Đã mở khóa vì response groups có trong hợp đồng.
  Checklist:
  - [x] mỗi bảng `Card size="small" title`, lưới `Flex wrap gap="middle"` — `Card title` 3 file
  - [x] BXH `Table size="small" pagination={false}` (dữ liệu nhỏ cố định — ngoại lệ server-side có lý do), hàng đi tiếp `Tag green` "Đi tiếp"
  - [x] cờ "Cần phá hòa thủ công" — `Alert type="warning" showIcon action={<Button size="small" type="primary">Phá hòa</Button>}` — Alert warning 4 file, dạng `action` như entries-tab
  - [x] "Tính lại BXH" — `Button` mặc định, `loading`, `message.success`, không xác nhận (idempotent)
  - [x] lịch vòng tròn — `#số · A – B` theo lượt, "Nghỉ", trống `'—'`
  Không có: nhập kết quả (phase 07).

- [x] **6. Hộp thoại — `draw-entry-action-modal.tsx` (Thay VĐV / Rút khỏi nhánh / Bỏ công bố), `manual-tiebreak-modal.tsx`**, theo `player-merge-modal.tsx`. `parked — waiting on Q1 (xem trước ảnh hưởng); hộp thoại phá hòa làm được`.
  Kiểm 2026-11-13 (checker): qua sau khi sửa — ô lý do báo "Lý do tối thiểu 3 ký tự" tại field (API đòi 3–500 ký tự, trước đó nút OK chỉ tắt mà không nói vì sao); Select VĐV thay thế có aria-label. Xem trước gửi `dryRun: true` không kèm lý do — khớp API (`draw-dtos.ts` cho phép thiếu lý do khi dryRun), file hợp đồng còn ghi lý do bắt buộc cả khi dryRun.
  Trạng thái 2026-11-13: code xong (draw-entry-action-modal.tsx, manual-tiebreak-modal.tsx, draw-impact-text.ts, use-replacement-entries.ts); chờ checker. Dòng step-up: không áp dụng (Q5 chốt không nhập lại mật khẩu). Xem trước ảnh hưởng dựa trên `dryRun` đợt 2 — chưa chạy được với API thật.
  Checklist (modal, family 5+ member):
  - [x] khung — `Modal width={640} destroyOnHidden cancelText="Hủy"`, `okText` nói hành động, `okButtonProps={{ danger, loading, disabled: !preview || !reason.trim() }}`, `afterClose` reset — tham chiếu + family
  - [x] chọn thao tác — `Radio.Group` Thay VĐV / Rút khỏi nhánh (mặc định Thay); Thay → `Select showSearch` đăng ký CONFIRMED chưa vào nhánh; mở từ "…" chỉ còn lý do
  - [x] xem trước — `useQuery`, `Skeleton active paragraph={{ rows: 2 }}`, dòng ảnh hưởng trong `Alert type="warning" showIcon`, lỗi `Alert type="error"` — tham chiếu
  - [x] lý do — `Form.Item label="Lý do" required extra="Ghi vào nhật ký thao tác."` + `Input.TextArea rows={2} maxLength={500}` — tham chiếu
  - [x] lỗi ghi — `Alert type="error"` đầu nội dung, không đóng — tham chiếu
  - [x] phá hòa — danh sách người hòa, mỗi dòng `InputNumber` thứ hạng, validate tại field (không trùng, trong khoảng) — `PATCH manual-ranks`
  - [x] step-up — chỉ khi route có `@RequireStepUp`, bọc `useStepUp()` — shared piece
  Không chép từ merge modal: `PlayerLookupSelect`, `Descriptions` đếm, chữ "Không hoàn tác được".

- [ ] **7. Đóng plan** — khi mọi task done/parked: báo những gì dưới `## Decided` kèm kết quả.
