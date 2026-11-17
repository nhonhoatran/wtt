# Phase 09 — checklist giao diện admin (ui-consistency:finding-patterns)

Snapshot đọc ngày 2026-11-16 trong bound `apps/admin/src` (1 ứng dụng; thư viện: `@kamito/ui-tokens`, `@kamito/shared`). Theme: `antdTheme` (`@kamito/ui-tokens/antd-theme`) qua `ConfigProvider` ở `app.tsx` — không đếm lại; không có `DESIGN.md`. Kích thước: nhiều trang mới + 2 vùng sửa trong hub → đủ phase. Code thắng khi lệch với snapshot này.
Cách đếm: `grep -rlE -- "<tên>" .` trên toàn `apps/admin/src`; mỗi search chạy trên tham chiếu trước. Dùng nguyên, không đếm lại, các dòng phase 04–07 đã mang: khoảng cách/màu qua `theme.useToken()` / `Flex gap` / preset `Tag`, không hex, không literal khoảng cách; độ rộng cố định = hằng số UPPER_CASE; `message.error(error instanceof ApiError ? error.message : '…')`; `message.success('Đã …')`; `showWarnings(message, warningsOf(response))` sau ghi; `Modal destroyOnHidden cancelText="Hủy"`; tải `Skeleton active` / lỗi `Result status="error" … Thử lại`; ô trống `'—'`.

Số đếm dùng ở dưới (một search mỗi vị trí, 2026-11-16):
- `ListFilterBar` 15 file; `useListPageSize(` 17; `syncWithLocation: true` 8 (gồm `catalog-table.tsx` → 7 catalog).
- `useConfirmAction(|ConfirmActionButton` 14; `useStepUp(` 3 (định nghĩa, `player-merge-modal`, `use-match-actions`).
- `<Modal` 15; `width={640}` 9 (mọi hộp thoại có đặt width); `<Descriptions` 3; `<Statistic` 1.
- `useQuery(` 28; `keepPreviousData` 7; `Result status="error"` 11; `DISPLAY_DATE_FORMAT` 7.
- `Tag gold|color="gold"` 2 (`settings-field` "Đã chỉnh", `results-match-columns`); mũi tên lên/xuống `ArrowUp/DownOutlined|CaretUpOutlined` 1 (`sortable-list-field`, nút sắp xếp — không phải biến động hạng).
- `useCan(` 9; `useCatalogAccess` khóa cứng resource `tournaments` (`catalog-access.ts:5`), `CatalogRowActions` gọi nó không tham số.

## A. Bảng xếp hạng (`resources/ranking-lists/{ranking-list-list,ranking-list-form}.tsx`) — kind *catalog list + form*, tham chiếu `resources/tiers/*` (plan nêu tên, mức 3); 7 member / 7 ứng viên trong `catalog-routes.tsx`

- [ ] route + resource — thêm vào `CATALOGS` không được vì `guarded` khóa `tournaments`; route riêng trong `pages/ranking/ranking-routes.tsx` bọc `RequireAccess resource="rankings"`, resource Refine `ranking-lists` (`/admin/ranking-lists` khớp data provider 1:1) — cơ chế: `catalog-routes.tsx` (shared), quyền: ma trận `rankings` chỉ ADMIN
- [ ] quyền — `useCatalogAccess(permission = 'tournaments')` nhận tham số; `CatalogRowActions`/`actionsColumn` nhận prop `permission` truyền xuống; mặc định giữ hành vi cũ — shared piece 7 catalog, mở rộng thay vì chép
- [ ] danh sách — `List title="Bảng xếp hạng"` + `CreateButton` "Thêm bảng xếp hạng" khi `canCreate`; `ListFilterBar` (search "Tìm theo mã hoặc tên", select Đơn/Đôi, select trạng thái `ACTIVE_FILTER_OPTIONS`); `useCatalogTable` + `sortColumn` (Thứ tự, Mã, Tên), cột Loại (Đơn/Đôi), Giới, Nhóm tuổi (`'—'`), Thời hạn "365 ngày", `statusColumn`, `actionsColumn` — tham chiếu tier-list; shared piece 7 of 7
- [ ] form — `CatalogCreatePage`/`CatalogEditPage` (`saveText="Tạo bảng xếp hạng"`); field: Mã (extra "Ví dụ: MS."), Tên, Tên tiếng Anh, Loại `Radio.Group` Đơn/Đôi (khóa khi sửa nếu API báo đang dùng — chỉ khi API có), Giới `Select`, Nhóm tuổi `useCatalogSelect('categories')` allowClear, Thời hạn điểm `InputNumber min={1}` + `addonAfter="ngày"`, để trống = mặc định setting `ranking.defaultValidityDays` (extra nói rõ, không chôn 365), "Phân biệt hạng trong vòng bảng" `Switch`, Thứ tự, `IsActiveField` — tham chiếu tier-form; `useCatalogSelect` 6+ file
- [ ] đổi thời hạn khi sửa — `extra` "Đổi thời hạn sẽ tính lại ngày hết hạn của điểm trong bảng này." + `showWarnings` sau lưu — như yêu cầu (spec trigger `validityDays`)
- [ ] nhãn Đơn/Đôi, giới — import nhãn có sẵn của `disciplines` nếu có (`COMPETITOR_KIND`/`GENDER_RULE` labels), không viết bản thứ hai — một tên cho một thứ
- [ ] không chép từ tiers: `ColorHexField`, `MediaUploadField`, ô màu trong cột tên

## B. Quy tắc điểm (`pages/ranking/ranking-rules-matrix-page.tsx`, `ranking-rules-grid.tsx`, `ranking-rules-save-modal.tsx`, `use-ranking-rules-matrix.ts`) — kind *trang tự gọi API*, tham chiếu `pages/settings-page.tsx` (sửa nhiều giá trị rồi lưu, "Đã chỉnh"; phase 04 dòng C); lưới: cơ chế `session-grid.tsx` (Table lưới hai chiều duy nhất)

- [ ] khung — `Typography.Title level={3} style={{ margin: 0 }}` "Quy tắc điểm"; `Flex vertical gap="middle"` — 2 of 2 trang không dùng khung Refine
- [ ] bộ chọn — `Radio.Group optionType="button"` Đơn/Đôi và Nhánh chính/Vòng loại/Vòng bảng; "Xem phiên bản" `Select` các ngày `versions` (mặc định hôm nay = hiện hành); giữ ở URL (`?kind=&draw=&asOf=`) — Radio.Button 2 file; ít lựa chọn → 1 click
- [ ] tải / lỗi — `useQuery` + `keepPreviousData`; `Skeleton active`; `Result status="error" … Thử lại` — 11 file
- [ ] lưới — `Table size="small" bordered pagination={false} rowKey="stageCode" scroll={{ x: 'max-content' }}`; hàng = `stageCodes` (nhãn vòng tiếng Việt kèm mã: "Vô địch (W)"), cột = hạng giải (`eventTypes`, tên + tier); độ rộng cột hằng số `RULE_COLUMN_WIDTH` — cơ chế `session-grid` (Table bordered, dữ liệu nhỏ cố định, không phân trang server — ngoại lệ có lý do)
- [ ] ô — `InputNumber min={0} precision={0} variant="borderless" style={{ width: '100%' }}` + `aria-label="<vòng> – <hạng giải>"`; ô chưa có quy tắc hiện trống (placeholder "—"); ô đã sửa nền `token.colorWarningBg` — ô nhập sửa tại chỗ: `entry-seed-cell` (cơ chế), màu "đã chỉnh": `settings-field` (Tag gold → nền ô cùng tông warning, token)
- [ ] chế độ xem phiên bản cũ (`asOf` < hôm nay) — lưới chỉ đọc, `Alert type="info" showIcon` "Đang xem quy tắc hiệu lực ngày dd/mm/yyyy" + nút "Về hiện hành" — vị trí mới
- [ ] thanh lưu — `Flex justify="space-between"`: trái "N ô đã sửa" `Typography.Text type="secondary"` + "Bỏ thay đổi"; phải "Sao chép cột từ…" (`Dropdown`: chọn cột nguồn → cột đích, chỉ điền vào state, không lưu) + `Button type="primary"` "Lưu" (tắt khi 0 ô sửa) — như spec; rời trang khi còn ô sửa: cảnh báo (`useBlocker` của react-router + `beforeunload`) — đã duyệt 2026-11-16 (Refine `warnWhenUnsavedChanges` chỉ phủ `useForm`)
- [ ] hộp thoại lưu — `Modal width={640} title="Lưu phiên bản quy tắc" okText="Lưu phiên bản"`; `DatePicker format={DISPLAY_DATE_FORMAT}` mặc định hôm nay; câu `Alert type="info"` từ `GET /admin/ranking-rules/impact`: "Áp cho giải kết thúc từ dd/mm/yyyy; N giải đang diễn ra sẽ tính lại; giải đã kết thúc giữ nguyên"; ghi chú tùy chọn `Input.TextArea rows={2} maxLength={500}` — family modal 9 of 9 width 640; DatePicker `DISPLAY_DATE_FORMAT` 7 file
- [ ] xong — `message.success('Đã lưu phiên bản quy tắc')` + `showWarnings`, refetch, xóa state sửa; lỗi field 422 `cells.N.points` → `Alert type="error"` trong modal — family
- [ ] không chép từ settings-page: `Card` theo nhóm, `SettingField`, "Khôi phục mặc định"

## C. Sổ điểm (`pages/ranking/ranking-points-page.tsx`, `manual-points-form.tsx`) — kind *list* (Refine `List` + `useTable`), tham chiếu `resources/audit-logs/audit-log-list.tsx` (list chỉ đọc có lọc nhiều chiều + `useSelect` tìm phía server)

- [ ] khung — `List title="Sổ điểm"`, `headerButtons` "Thêm điểm thủ công" (`useCan rankings create`) — phase 04 dòng A
- [ ] lọc — `ListFilterBar`: Bảng xếp hạng (select từ `ranking-lists`), VĐV (select `showSearch` + `onSearch` qua `useSelect` resource `players`), Giải (select `showSearch` resource `events`), Nguồn (Tự động/Thủ công), Còn hạn (Còn hạn/Hết hạn) — shared piece 15 file; cách tìm phía server: audit-log-list (`useSelect` + `onSearch`)
- [ ] bảng — `useTable({ resource: 'ranking-points', syncWithLocation: true, pagination: { pageSize: useListPageSize() }, sorters initial earnedAt desc })`; cột: VĐV, Bảng, Giải + nội dung (`'—'` cho thủ công), Vòng (mã), Điểm, Nguồn `Tag` (Tự động mặc định / Thủ công `blue`), Ngày tính, Hết hạn (hết hạn → `Typography.Text type="secondary"` + `Tag` "Hết hạn"), Lý do — 8 file `syncWithLocation: true`
- [ ] xóa dòng thủ công — cột thao tác chỉ ở dòng MANUAL: `ConfirmActionButton danger size="small"` "Xóa", có lý do bắt buộc → mở hộp thoại lý do (như C form) thay vì confirm trống; gọi qua `useStepUp()` — shared piece 14 / 3 file
- [ ] form thủ công — `Modal width={640} title="Thêm điểm thủ công" okText="Thêm điểm"`; `Form layout="vertical"`: Bảng XH (Select), VĐV (`PlayerLookupSelect`), Điểm (`InputNumber` cho phép âm khi là điều chỉnh — theo DTO), Ngày tính (`DatePicker`, mặc định hôm nay), Hết hạn (để trống = ngày tính + thời hạn bảng; extra nói rõ), Lý do `Input.TextArea required extra="Ghi vào nhật ký thao tác."`; gửi qua `useStepUp()`; lỗi field `form.setFields` — tham chiếu `player-merge-modal` (lý do + step-up), `PlayerLookupSelect` shared
- [ ] không chép từ audit-log-list: `expandable` JSON trước/sau

## D. Kỳ chốt (`pages/ranking/ranking-snapshots-page.tsx`, `snapshot-preview-page.tsx`, `snapshot-movement-cell.tsx`) — danh sách: kind *list* (tham chiếu `resources/imports/import-list.tsx`: danh sách job có trạng thái + trang chi tiết); xem trước: kind *trang chi tiết tự gọi API*, tham chiếu `resources/imports/import-detail-page.tsx` (job nền, trạng thái, nút hành động chính)

- [ ] danh sách — `List title="Kỳ chốt"`, header `Button type="primary"` "Tạo bản nháp" (mở modal: bảng = "Tất cả bảng" hoặc chọn nhiều, ngày tính `DatePicker` mặc định hôm nay); `ListFilterBar` (bảng, trạng thái Nháp/Đã công bố); bảng: Bảng XH, Ngày tính, Trạng thái `Tag` (Nháp mặc định / Đã công bố `green` — như `PUBLISH_LABELS`), số VĐV, "N nội dung chưa tính lại" (`Tag orange` khi > 0), Công bố lúc/bởi; bấm dòng → trang xem trước — tham chiếu import-list
- [ ] sau "Tạo bản nháp" — nhận job id(s), `message.success('Đã gửi yêu cầu tạo bản nháp')`, theo dõi `GET /admin/ranking/jobs/:id` (`refetchInterval` khi chưa xong) → refetch danh sách; job lỗi (còn nội dung bẩn) → `Alert type="error"` liệt kê nội dung — cơ chế theo dõi job: import-detail-page (`refetchInterval`)
- [ ] trang xem trước — link `ArrowLeftOutlined` "Kỳ chốt"; `Typography.Title level={3}` "<Bảng> · dd/mm/yyyy" + `Tag` trạng thái; `Descriptions size="small" bordered` (số VĐV, số nội dung chưa tính lại, công bố lúc/bởi) — Title 3 + link về: hub giải (phase 04 C)
- [ ] cảnh báo bẩn — `Alert type="warning" showIcon message="N nội dung chưa tính lại" action={<Button size="small">Tính lại ngay</Button>}` → `POST /admin/ranking/recompute` rồi gợi ý dựng lại nháp — Alert warning + action: phase 06 E
- [ ] bảng hạng — `useTable({ resource: \`ranking-snapshots/${id}/rows\`, syncWithLocation: true, pagination: { pageSize: useListPageSize() }, sorters initial rank asc })`; `ListFilterBar` search "Tìm theo tên VĐV"; cột Hạng, Biến động (`SnapshotMovementCell`: `ArrowUpOutlined` `token.colorSuccess` "+3", `ArrowDownOutlined` `token.colorError` "−2", `—` không đổi, `Tag` "Mới" khi null), VĐV, Điểm, Số kết quả; `expandable` breakdown (giải, vòng, điểm, ngày tính → hết hạn) `Table size="small" pagination={false}` — server-side như mọi list; breakdown nhỏ cố định trong dòng
- [ ] công bố — nháp: `Button type="primary"` "Công bố" qua `useConfirmAction` ("Công bố BXH <bảng> ngày …? Trang công khai sẽ hiện bảng này; không sửa được sau khi công bố.") → gọi trong `useStepUp()`; tắt + `Tooltip` khi còn nội dung bẩn; "Xóa bản nháp" `ConfirmActionButton danger` — shared piece 14 / 3 file; luồng 3 bước như spec (tạo nháp → xem → công bố + mật khẩu)
- [ ] đã công bố — không có nút ghi; chữ "Đã công bố lúc … bởi …" — bất biến (trigger DB)
- [ ] không chép từ import-detail-page: `Upload`, `Statistic` theo lỗi dòng, nút "Commit"

## E. Hub giải — nội dung thi đấu (`sub-event-edit-modal.tsx`, `bulk-sub-event-modal.tsx`, `sub-events-tab.tsx`, `sub-event-labels.ts`, mới `sub-event-ranking-field.tsx`) — vùng sửa trong trang có sẵn; tham chiếu chính nó + `sub-event-format-fields.tsx` (field chọn danh mục có mặc định)

- [ ] field — `Form.Item name="rankingListId" label="Bảng xếp hạng" extra="Để trống thì nội dung không tính điểm xếp hạng."` + `Select allowClear` các bảng đang hiện cùng loại đơn/đôi với nội dung (`ranking-lists?filter[isActive]=true&filter[competitorKind]=`) — cơ chế `useCatalogSelect` (6+ file), field component riêng như `SubEventFormatFields`
- [ ] gợi ý mặc định — khi tạo (bulk) và khi mở sửa mà ô trống: chọn sẵn bảng khớp loại + giới + nhóm tuổi (đúng 1 bảng khớp → điền; nhiều/không → để trống); không ghi đè lựa chọn có sẵn — như `fill()` của `sub-event-format-fields`
- [ ] bulk — một ô "Bảng xếp hạng" chung chỉ khi mọi dòng cùng loại đơn/đôi; khác loại → ẩn ô, `Typography.Text type="secondary"` "Chọn bảng xếp hạng riêng cho từng nội dung sau khi tạo" — vì API `defaults.rankingListId` áp cho mọi dòng và kiểm cùng loại
- [ ] tab — cột/nhãn "Bảng XH" hiện `rankingList.name` hoặc `'—'` — API cần trả `rankingList { id, code, name }` trong `SUB_EVENT_INCLUDE` (**thiếu, sửa API**)
- [ ] không đụng: thể thức, thể thức trận, vòng loại

## F. Wizard bốc thăm — bước hạt giống (`draw-seeds-step.tsx`, mới `draw-seed-suggestion-modal.tsx`) — phase 06 dòng B "Gợi ý theo BXH" (mang lại); modal theo family modal, tham chiếu `draw-entry-action-modal.tsx` (xem trước rồi áp dụng)

- [ ] nút — `Button` mặc định "Gợi ý theo BXH" bật khi nội dung có bảng XH; tắt + `Tooltip` "Nội dung chưa gắn bảng xếp hạng" / "Bảng chưa có kỳ chốt công bố" theo `available:false` — Tooltip trên nút tắt (phase 06 A)
- [ ] xem trước — mở `Modal width={640} title="Gợi ý hạt giống theo BXH" okText="Áp dụng"`; `POST …/entries/suggest-seeds {apply:false}`; đầu modal `Typography.Text type="secondary"` "Theo BXH <mã> công bố ngày dd/mm/yyyy · N hạt giống"; `Table size="small" pagination={false}` (đăng ký một nội dung, nhỏ) cột Hạt giống gợi ý, VĐV, Hạng (`'—'` cặp/chưa hạng), Điểm — tham chiếu draw-entry-action-modal (xem trước), Table nhỏ cố định
- [ ] áp dụng — `useConfirmAction` "Ghi đè hạt giống hiện có?" → `apply:true` → `message.success('Đã áp dụng N hạt giống')`, refetch bảng seed, đóng modal; 409 đã công bố → `Alert type="error"` — shared piece 14 file (phase 06 B)
- [ ] không chép: `Radio.Group` thao tác, `dryRun`

## Chữ người dùng đọc (cả phase)

- [ ] một tên cho một thứ — menu nhóm "Xếp hạng": "Bảng xếp hạng", "Quy tắc điểm", "Sổ điểm", "Kỳ chốt" (`layout/menu-groups.ts` là nguồn, resource `rankings`); "hạng giải" = `event-types` (menu "Hạng giải"); vòng: Vô địch, Chung kết, Bán kết, Tứ kết, Vòng 1/16… dùng nhãn vòng có sẵn (`draw-labels`) nếu có, không viết bản thứ hai
- [ ] chữ mới cần người đọc lại: câu hộp thoại lưu quy tắc, câu xác nhận công bố, extra của thời hạn/bảng XH

Bỏ ra (không có quy ước hoặc giống nhau mọi trang): thứ tự cột, khoảng cách trang.
Chi phí: ~25 file dự án mở (admin + API ranking/sub-events), ~22 lệnh tìm; đọc `finding-patterns/SKILL.md`, `words.md`, `checklist.md`; không gọi `conventions`/`values` (bound, theme, dòng giá trị mang lại từ checklist phase 04–07).
