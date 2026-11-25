# Code review: open debts admin (T1, U2–U10)

Ngày: 2026-11-25 · Phạm vi: working tree chưa commit (50 file sửa + 5 file mới) · Chế độ: chỉ đọc, không sửa code.

## Phạm vi
- turbo.json, packages/ui-tokens (antd-theme + test), apps/admin (layout, settings, schedule keyboard drag, crud-page/back-link/form-instance-host, 30+ list/edit page), apps/client/tests/admin-full-flow.
- Mọi file đã đụng < 200 dòng (lớn nhất: entry-table.tsx 184, match-sheets-print-page.tsx 168, schedule-tab.tsx 166, settings-page.tsx 163). Đạt luật kích thước file.
- Không chạy lại typecheck/lint/test (đã xác minh theo đề bài).

## Tổng quan
Thay đổi gọn, đúng hướng: hook gọi trước mọi early return (settings-page, admin-layout, schedule-tab), thứ tự spread prop trong wrapper CRUD đúng (mặc định trước, `{...props}` sau nên caller vẫn ghi đè được), hai caller cũ của `useUnsavedGuard` giữ nguyên hành vi (`allowSamePath` mặc định false nên blocker trả về đúng `when`). Có 2 lỗi mức High và vài lỗi Medium cần sửa trước khi chốt.

## High

### H1. T1 chưa đủ: `turbo run test` gọi thẳng vẫn rớt vì thiếu `APP_ENV`, `NODE_ENV`
- turbo.json:15-21 không có `APP_ENV`, `NODE_ENV`. CI đặt cả hai (.github/workflows/ci.yml:86-87).
- `APP_ENV` là bắt buộc, không có default (packages/shared/src/env-validation.ts:3, apps/api/src/common/config/env-schema.ts:10); `QUEUE_PREFIX` phải bằng `kamito-tt:<APP_ENV>` (env-schema.ts:42-43). apps/api/test/support/publishing-test-safety.ts:14 ném lỗi nếu `APP_ENV !== 'test'`.
- `NODE_ENV` thiếu thì mặc định `'production'` (env-schema.ts:9), test sẽ chạy theo hành vi production. Danh sách built-in passthrough của turbo có `TZ`, `CI`, `NODE_OPTIONS` nhưng không có `NODE_ENV` (crates/turborepo-env/src/lib.rs trên GitHub vercel/turborepo).
- Còn thiếu thêm (ít rủi ro hơn): `API_PORT`, `PAGINATION_MAX_PAGE_SIZE`, `QUERY_MAX_LENGTH`, `REDIS_EVICTION_CHECK_OVERRIDE`, `VIDEO_EMBED_HOSTS`, `API_FETCH_TIMEOUT_MS`, `LIGHTHOUSE_OUTPUT_DIR`.
- Sửa: thêm `"NODE_ENV", "APP_ENV"` cùng các biến trên. Cách bền hơn: một test so tập key của env-schema với `passThroughEnv` để danh sách không bị lệch nữa.
- Chưa kiểm chứng: chưa chạy `turbo run test` ở strict mode (cần DB/Redis). Docs turbo chỉ ghi wildcard cho `env`, nhưng source task-hash đưa `pass_through_env` qua `wildcard_cache`, nên `S3_*` gần như chắc là chạy được.

### H2. U2: focus ring navy gần như vô hình trên nền tối (menu sider, header)
- packages/ui-tokens/src/antd-theme.ts:29 đặt `colorPrimaryBorder` = `#0F285D` cho toàn cục. antd vẽ focus-visible của Menu bằng `genFocusOutline` = `lineWidthFocus solid colorPrimaryBorder` (antd/es/menu/style/theme.js:60, antd/es/style/index.js:109).
- Menu `theme="dark"` nằm trên `ink #0A0A0A` (apps/admin/src/layout/admin-layout.tsx:47, :72, :78). Các nút trên Header cũng nằm trên ink (admin-layout.tsx:87 nút "Mở menu", nút dropdown user). Độ tương phản navy/ink khoảng 1.4:1, dưới mức 3:1 của WCAG 1.4.11. Người dùng bàn phím sẽ không thấy mình đang đứng ở mục menu nào.
- Lần kiểm tra trên trình duyệt chỉ ghi "focus colour", coi bộ mới thử trên ô nhập nền sáng.
- Sửa: giữ navy cho nền sáng, còn vùng tối thì ghi đè cục bộ, ví dụ `components.Menu: { colorPrimaryBorder: <màu sáng> }` (antd 5 cho ghi đè alias token theo từng component), hoặc bọc Header/Sider bằng `ConfigProvider theme={{ token: { colorPrimaryBorder: ... } }}`.
- Tác dụng phụ nhỏ khác của cùng token (Low): nền `:active` của Button `color="primary" variant="filled|text"` (button/style/index.js:272, :278; hiện admin chưa dùng). `primaryShadow` của nút primary lấy `controlOutline` nên đổi sang ánh navy (button/style/token.js:35). Slider track/handle (chưa dùng). Viền dashed khi hover range trong DatePicker panel (date-picker/style/panel.js:583).

## Medium

### M1. U4: chỉ báo "chưa lưu" và guard có thể kẹt sau khi lưu thành công
- settings-page.tsx:120 so giá trị form với `item.value` của lần refetch bằng `JSON.stringify` (:22). Server lại chuẩn hóa giá trị trước khi lưu:
  - `.trim()` trong schema (packages/shared/src/player-settings.ts:12, :31; tournament-settings.ts:39; content-settings.ts:28, :34), sau khi parse ở controller (apps/api/src/modules/settings/admin-settings.controller.ts:33-36).
  - Cột `Json` của Prisma trên Postgres là jsonb, nên thứ tự key object bị sắp lại. `z.object` cũng xuất key theo thứ tự schema (ví dụ `home.sections`).
- Hậu quả: gõ `"ABC "` hoặc sửa JSON object với thứ tự key khác, bấm Lưu và nhận "Đã lưu", nhưng badge vẫn còn và rời trang vẫn bị chặn mãi.
- Sửa: (a) so sánh deep-equal không phụ thuộc thứ tự key; (b) sau khi PUT thành công thì `form.setFieldsValue({ [key]: response.data.value })`, vì API trả về giá trị đã parse (controller.ts:36).
- Phụ (Low): JsonSettingEditor gõ JSON sai thì không gọi `onChange` (setting-value-editors.tsx:71-82), nên form không dirty và guard không cảnh báo dù textarea đã bị sửa.

### M2. U3: kéo bằng bàn phím có thể ghi lịch ngoài ý muốn (closestCenter + Tab)
- schedule-keyboard-drag.ts:46: khi không có pointer thì `closestCenter` luôn trả về droppable gần nhất, kể cả lúc vừa nhấc chưa bấm mũi tên nào. Ô "Trống" là droppable enabled (session-grid-cell.tsx:136), còn panel "Chưa xếp" không phải droppable (unscheduled-panel.tsx:18 chỉ có useDraggable).
- Kịch bản lỗi: focus vào một trận ở panel, nhấn Space để nhấc. Sau đó nhấn Space lần nữa, hoặc nhấn Tab vì đổi ý (Tab nằm trong `end`, schedule-keyboard-drag.ts:13). Trận sẽ bị xếp vào ô trống gần nhất và gọi API (schedule-tab.tsx:77-82, use-schedule-board.ts:65-76). Screen reader cũng thông báo "đang ở trên ô X" ngay lúc nhấc.
- Sửa: dùng `rectIntersection` thay `closestCenter` cho nhánh keyboard. Coordinate getter đã căn tâm overlay vào tâm ô nên sau mỗi lần bấm mũi tên luôn giao nhau, còn lúc mới nhấc ở panel thì không giao ô nào. Thêm vào đó, chuyển `Tab` sang `cancel` thay vì `end`.
- Test hiện có (schedule-keyboard-drag.test.mjs, test cuối) đang chốt hành vi closestCenter. Sửa xong cần cập nhật test này.

### M3. U3 chưa được thử trên trình duyệt; Space trên `<Button>` cần thử Firefox/Safari
- Danh sách kiểm tra trên trình duyệt ghi "sponsor drag mouse+keyboard", tức là chỉ sortable sponsor. Lưới lịch (schedule grid) mới có unit test.
- Activator là antd `Button` (session-grid-cell.tsx:89-109, unscheduled-panel.tsx:21-39). Space kích hoạt click ở keyup. dnd-kit chỉ `preventDefault` ở keydown (core.esm.js:1364 khi nhấc, :1323 khi thả). Chromium thì không click. Còn Firefox/Safari có click khi keyup sau một keydown đã bị chặn hay không thì chưa kiểm chứng. Nếu có, mỗi lần nhấc/thả bằng Space sẽ bật thêm `board.setPicked` (chế độ chọn rồi đặt).
- Nên thử tay: nhấc, mũi tên, thả, Esc, Tab trên Chrome và Firefox, cả với lưới dài phải cuộn (KeyboardSensor tự cuộn, core.esm.js:1229-1304).

## Low
- L1. U10 session-form-modal.tsx:65: comment nói "a seeded default is not a user edit" là sai. `setFieldsValue` với source `external` vẫn đặt `touched = true`, `dirty = true` (rc-field-form/es/Field.js:140-146). Hành vi vẫn đúng, chỉ cần sửa comment để giữ lý do "circular references" thôi.
- L2. U7 color-hex-field.tsx:14, :17: khi giá trị rỗng, alpha được bật. Nếu thao tác đầu tiên là kéo thanh alpha, antd tạo màu có `a < 1` (antd/es/color-picker/components/PanelPicker/index.js:93-103), `toHexString()` ra `#RRGGBBAA`, server từ chối (apps/api/src/common/crud/catalog-fields.ts:26) và warning `disabledAlpha` quay lại. Docstring "always yields #RRGGBB" không còn đúng. Sửa: `color.toHexString().slice(0, 7).toUpperCase()`.
- L3. U6: Refine `Edit` vẫn hiện `ListButton` mặc định ở header (@refinedev/antd/src/components/crud/edit/index.tsx:130), nên trang sửa có hai lối về cùng một danh sách (back link và nút "Danh sách"). Cân nhắc truyền `headerButtons={({ defaultButtons }) => ...}` hoặc `headerButtons={() => null}` trong wrapper `Edit`.
- L4. U6: apps/admin/src/i18n/vi.ts:23 `'articles.titles.create': 'Viết bài'` lệch với "Thêm bài viết" (article-editor.tsx:90), có thể lộ ra qua tiêu đề tab hoặc breadcrumb mặc định.
- L5. `useUnsavedGuard` nằm ở `pages/ranking/ranking-rules-unsaved-guard.ts` nhưng giờ có 3 caller khác domain (settings, content, ranking). Nên chuyển sang `components/` hoặc `hooks/` với tên trung tính.
- L6. DRY: `<><FormInstanceHost form={form} /><Skeleton active /></>` lặp 4 lần (article-editor.tsx:81, content-forms.tsx:18 và :37, sponsor-form.tsx:21). Có thể gom thành một component loading nhỏ.
- L7. `withAlpha` (antd-theme.ts:7-10) chỉ đúng với `#RRGGBB`. Token đổi sang dạng 3 hoặc 8 ký tự sẽ ra `NaN` mà không báo lỗi.
- L8. Thông tin thêm: `docs/Mô tả tính năng QL Thể thao.docx` đang untracked, không thuộc đợt sửa này. Cẩn thận khi `git add -A`.

## Đã kiểm, không thấy vấn đề
- Wrapper CRUD: `goBack={false}` đi vào `PageHeader backIcon` (pageHeader/index.tsx:20-21), nên ẩn được mũi tên. `breadcrumb` của prop thắng breadcrumb toàn cục (create/index.tsx:53-56). Không caller nào tự truyền `breadcrumb`/`goBack`. Mọi resource có `list` dạng chuỗi và có `meta.label` (app.tsx:48-60, ranking-routes.tsx:31-33, catalog-routes.tsx:39-42).
- U8: mọi route edit dùng tên param `:id` (app.tsx:103-130, ranking-routes.tsx:22, catalog-routes.tsx:56). Trang create truyền `id: undefined`.
- U9: tất cả 26 lời gọi `useTable`/`useCatalogTable` đều gắn `searchFormProps.form`. Không nơi nào vừa có host vừa có `<Form>` thật cùng instance cùng lúc. Host không đăng ký field nào nên lúc unmount không làm mất store.
- U4 guard: `useBlocker` nhận hàm inline nên đăng ký lại mỗi lần render. Vô hại. ranking-rules-matrix-page.tsx:27 và article-editor.tsx:34 giữ nguyên hành vi.
- U5: effect đóng drawer đặt trước early return. `aria-label` trên Drawer.
- E2E: `.ant-drawer-open` hợp lý vì menu Drawer dùng `destroyOnHidden`.

## Việc nên làm (theo thứ tự)
1. H1: bổ sung `APP_ENV`, `NODE_ENV` cùng các biến còn thiếu vào `passThroughEnv`.
2. H2: ghi đè `colorPrimaryBorder` cho Menu dark và Header bằng màu sáng, rồi kiểm focus bàn phím trên sider/header.
3. M1: so sánh không phụ thuộc thứ tự key, đồng bộ form theo giá trị server trả về sau khi lưu.
4. M2: dùng `rectIntersection` cho keyboard và chuyển `Tab` sang cancel, cập nhật test.
5. M3: thử tay kéo bằng bàn phím trên lưới lịch (Chrome + Firefox).
6. Các mục Low khi tiện.

## Câu hỏi còn mở
- Có cần `turbo run test` gọi trực tiếp chạy được trên CI không, hay chỉ để dev chạy tay? Câu trả lời quyết định nên duy trì danh sách tay hay sinh tự động từ env-schema.
- Màu focus trên nền tối nên lấy từ token nào (có sẵn token sáng tương ứng với `data` không)?
