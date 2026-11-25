# Review phase A1, A3, C1, C2 (Figma redesign) — 2026-11-25

Chỉ review, không sửa code. Phạm vi: file trong 4 báo cáo developer. Bỏ qua A4 (`pages/event-hub/*`, `event-progress*`, `api/public-site-url.ts`) và C3 (shell/header/footer/ticker client).

## Kiểm chứng đã chạy
- `pnpm typecheck` (root): 14/14 đạt. `pnpm lint` (root): 9/9 đạt.
- `packages/ui-tokens` test 8/8; `packages/shared` test 116/116; `apps/admin` test 56/56 (gồm test A4).
- `apps/client` test: 112/113 — 1 rớt `tests/unit/content-localization.test.ts` (`TypeError: Cannot read properties of undefined (reading 'navItems')` tại `src/components/layout/site-footer.tsx:21`). File footer + test đó đang do C3 sửa; nguyên nhân là fixture site config chưa có `display` (C2 làm trường này bắt buộc). C3 cần cập nhật fixture trước khi xong.
- Không chạy test API/e2e, không đụng DB.

## Tổng quan
Chất lượng tốt. Serializer công khai đều whitelist (`select` tường minh, `toPublicTable` chỉ `code/displayName`, `mapUrl` lọc `isHttpsUrl`, không lộ id trọng tài/VĐV riêng tư). Route `lifecycle-counts` khai báo trước `:id`, có `@RequirePermission('tournaments','list')`. Lọc/đếm làm phía server, dùng chung `listSpec()` nên số đếm khớp list. Setting mới có schema zod, min/max, https-only, đi qua `settings.update` có audit. Không có lỗi mức High.

## High
Không có.

## Medium

**M1. Đổi tên/mã buổi không làm mới trang trận (A8 `PublicMatchDetail.session`).**
`apps/api/src/modules/sessions/sessions.service.ts:131` gửi `retimed` (chỉ các trận đổi giờ, `scheduling/session-timeline.ts:38`) vào `scheduleTags`. Sửa `name`/`nameEn`/`code` mà không đổi giờ → `retimed = []` → không có tag `match-*`.
Tình huống: admin đổi buổi "Sáng 1" thành "Vòng loại sáng" → trang `/events/x/matches/12` vẫn hiện tên cũ tới khi hết TTL. Phase C2 (bảng A8) giả định "`session.*` gửi `match-*`", giả định này chỉ đúng khi đổi giờ.
Sửa: khi `code/name/nameEn` thay đổi, gửi matchNo của mọi trận trong buổi (`match.findMany({ where: { sessionId: id }, select: { matchNo: true } })`) hợp với `retimed`.

**M2. `venueTable.write` thiếu tag trang kết quả VĐV.**
`PUBLIC_MATCH_CARD_SELECT` nay có `table` (`public-competition/public-match.serializer.ts:17`) và được dùng ở `public-players/public-player-results.query.ts` (fetch tag `player-*`, `players`, `events`, `settings` — `apps/client/src/lib/public-data.ts:110`). `venueTableTags` (`revalidation/cache-tags.ts:109-118`) không phát tag nào trong số đó.
Tình huống: đổi `displayName` bàn "Bàn 1" → "Bàn A" → trang kết quả VĐV vẫn hiện "Bàn 1".
Sửa: trong `venue-tables.service.ts:72` lấy thêm slug VĐV của 2 bên trận rồi thêm `t.player(slug)` (không dùng `t.players()` vì tag đó gắn trên gần như mọi fetch).

**M3. Docs cache chưa cập nhật.**
`docs/cache-revalidation.md:91` (`subEvent.*` thiếu `events`) và `:147` (`venueTable.write` nay có `draw-*`, `groups-*`, `match-*`, `results-strip`) lệch code. `docs/public-site.md` chưa có trường mới. Báo cáo C2 tự ghi "docs impact minor" nhưng chưa ai nhận.

**M4. Tên thương hiệu fix cứng trong sider admin.**
`apps/admin/src/layout/admin-sider.tsx:13-15` (`BRAND_NAME = 'KAMITO'`, `BRAND_TAGLINE`) trong khi đã có setting `appSettingRegistry.siteName` (đọc ở `public-site.query.ts`). Đổi tên site trên `/settings` thì sider không đổi theo. Đề xuất: đọc `siteName` (hoặc thêm setting tagline admin); chữ "K" lấy ký tự đầu của tên.

## Low

- **L1.** `venue-tables.service.ts:72-75`: `match.findMany({ where: { tableId } })` không giới hạn — bàn dùng nhiều năm sinh tag cho mọi trận lịch sử, kể cả giải nháp. Có dedupe và chia job 200 tag nên không hỏng, nhưng nên thêm `...publicScope.matchIn({})` để chỉ lấy trận công khai.
- **L2.** `packages/ui-tokens/src/tokens.ts:12`: `surfaceInk: '#0A0A0A'` lặp literal của `ink` và chưa nơi nào dùng (chỉ test). Bỏ hoặc trỏ về `ink` để không lệch khi đổi màu.
- **L3.** Code chết: `LIFECYCLE_OPTIONS` (`apps/admin/src/resources/events/event-labels.ts:48`) hết dùng sau khi list chuyển sang tab; `StatCard` chưa dùng (đã ghi chờ A2).
- **L4.** `public-content.controller.ts` 202 dòng (> 200). Tách `home()` sang query riêng kiểu `public-home-hero.ts`.
- **L5.** `apps/client/src/components/common/initials-avatar.tsx:11`: ảnh có `alt={name}` trong khi comment nói tên đã hiện bên cạnh (nhánh chữ tắt thì `aria-hidden`) → screen reader đọc tên 2 lần. Dùng `alt=""` cho nhất quán.
- **L6.** `global.css`: `.btn-primary`/`.btn-outline` chỉ có focus ring nhờ `a:focus-visible`; nếu dùng cho `<button>` sẽ rơi về ring mặc định trình duyệt. Thêm `:focus-visible` cho 2 class.
- **L7.** `admin-sider.tsx:53`: RESULTS_OPERATOR ở `/` (trang nhập tỷ số) không có mục menu nào được chọn; nên chọn key `/results` khi `homeKind === 'results'` và `pathname === '/'`.
- **L8.** `admin-layout.tsx:38`: nền drawer dùng `token.colorTextBase` (token màu chữ) — đúng giá trị ink nhưng sai ngữ nghĩa; dùng `tokens.color.ink`.
- **L9.** `entryCount` chỉ có e2e cho giá trị 0 (báo cáo A3 đã khai); nên có case > 0 gồm entry không CONFIRMED để chắc bộ lọc status.

## Đã kiểm, không có vấn đề
- Route: `GET admin/events/lifecycle-counts` (controller `:28`) trước `:id`; `filter[lifecycle]` bị chặn ở `EVENT_COUNT_RULES`; year/publishStatus sai → 400 qua `listSpec`.
- Đếm: 1 transaction 5 count, base where = list; `entryCount` 2 query (subEvent + groupBy) chỉ cho trang hiện tại, có index `Entry(subEventId, status)`.
- Public: `subEvents` trên card (select lồng, Prisma gom IN, không N+1); detail ghi đè `venue`/`subEvents` sau spread nên đúng shape; `heroEventSlug` kiểm `publicScope.events` (nháp/hủy → fallback); `record` dùng chung where với danh sách kết quả.
- Tag: home fetch có `events`+`settings`; `/site` có `settings`; discipline/category đổi → `events`; `venue.write` → `event-*`.
- Token/a11y: chọn menu `#A31115`/trắng ≈ 8:1; focus sider `#E3F42A` trên `#0A0A0A` ≈ 16:1, trên mục chọn đỏ ≈ 6:1; group title `#A3A3A3` trên ink ≈ 8:1; `primaryText`/trắng ≈ 5.2:1, `success`/trắng ≈ 5:1 (có test).
- Menu RESULTS_OPERATOR: vẫn lọc bằng `can()` qua `visibleMenuGroups`; "Hạng giải" chuyển nhóm nhưng cùng resource `tournaments` nên tập mục không đổi.

## Câu hỏi mở
- M2: chấp nhận thêm query lấy slug VĐV khi sửa bàn, hay chấp nhận trang kết quả VĐV cũ tới TTL?
- M4: tên thương hiệu admin có cần theo `siteName` không, hay phase file cố ý giữ cố định?
- Dữ liệu test sót trong `kamito_tt_dev` (sự cố C2) — vẫn chờ chủ repo quyết định dọn.
