# UI verify — phase 08 đợt 2 (site công khai)

Checker: agent riêng (không phải người viết), chỉ đọc. Checklist: `phase-08-...md` mục "Mẫu giao diện site công khai" (12 dòng). Tham chiếu: `draws/[subEventCode]/page.tsx` + `components/bracket/*` (bản HEAD + bản đã sửa trong đợt này).
Bound: checklist ghi họ chỉ có tham chiếu → không có quy ước đếm; so với tham chiếu + checklist (level 1/3). Quyết định đã chấp nhận (EventShell, scroll-region, filter-form, sub-event-chooser, tier-badge, pill-nav, 3 token xám, no-JS UI) không báo lại.
Theme có hiệu lực: mọi `var(--…)` đang dùng đều có trong `tokens.ts` qua `build-css-variables.ts` (kebab-case). Không còn literal màu nào (grep `#hex|rgb(` trên `components/` + `app/[locale]/`: 0 kết quả; màu tier là `colorHex` admin cấu hình, inline).

## Theo trang (chỉ dòng KHÁC; dòng không nêu = pass)

### Trang chủ `app/[locale]/page.tsx`
- Bậc heading — khác: `h1` ẩn (`visually-hidden`) với chữ `t.events.title` ("Giải đấu") `page.tsx:22`; mọi trang khác có `h1` hiển thị `.page-title` hoặc hero. Chữ h1 là tên trang danh sách, không phải trang chủ.
- Link "Xem tất cả giải" `page.tsx:38-40` — `<Link>` trần: không class, màu link mặc định trình duyệt, không focus-visible riêng; các link chữ khác dùng `--color-data` 600 + outline `--color-data` (`event-overview.module.css:72-80`, `match-detail.module.css:96-104`).

### Header / layout (`layout.tsx`, `components/layout/*`)
- Khung: pass (header/footer chỉ ở layout).
- Main nav `main-nav.tsx:11,14` — link không có `aria-current="page"` cho mục đang mở; mọi nav khác (PillNav) đánh dấu `aria-current`.
- Locale switcher `site-chrome.module.css:138-143` — padding 4px 8px, chữ 12px → vùng bấm ~22–24px cao (ước lượng, chưa render); pill/pagination ~32–36px. Báo theo họ, checklist không nêu chuẩn.
- Dải kết quả: LIVE nền `--color-data-deep` (`results-strip.module.css:54`) — hợp lý vì dải đã nền `--color-data`; xem mục LIVE chung.

### Danh sách giải `events/page.tsx`
- Bậc heading — khác: `h1` → `h3` thẻ giải (`event-card.tsx:34`), thiếu `h2`. Trang chủ/lịch có `h2` (mục/tháng) giữa h1 và thẻ.
- Dòng đếm kết quả dùng `.eyebrow` (`page.tsx:78`) — vai "eyebrow" (tên giải trên h1) đặt ở vị trí khác cho vai khác; margin 0 0 4px → khoảng cách tới lưới thẻ chỉ 4px. Trùng cách làm với `players/[subEventCode]/page.tsx:64`.

### Lịch giải `events/calendar/page.tsx` — không khác.

### Tổng quan `events/[slug]/page.tsx` (+ `EventShell`, `EventHero`)
- Đầu trang giải — khác: `h1` hero viết tay `.title` (`event-hero.module.css:42-47,87-89`) trùng bộ 24→32/800/1.2 của `.page-title` (`global.css:33-38,55-58`), margin 8 thay vì 16. Dòng hạng giải hero (`event-hero.tsx:18-21`, css `.tier/.dot` 25-40) viết lại `TierBadge` thay vì dùng `components/events/tier-badge.tsx` (cùng 12/600/uppercase/0.04em, dot 10px).
- Nút "Mua vé" `event-hero.module.css:61-71` — chữ `--color-surface` trên `--color-primary` (#FFF/#EC1E24) ≈ 4.4:1, chữ 14/600 (không phải chữ lớn); cặp này họ chưa dùng ở đâu (primary chỉ là dấu chấm wordmark trên ink). Checklist không nêu ngưỡng → báo cặp mới + tỉ lệ.
- Thẻ vô địch nền navy (`event-overview.module.css:11-19`) — mẫu thẻ mới (checklist chỉ có thẻ nền `--color-surface`); không sai, mới ở đây.

### Tab Trận đấu `matches/page.tsx`
- Chọn nội dung (sub-event) — khác: ở đây là `<select name="sub">` trong FilterForm (`page.tsx:61-68`); 3 tab Nhánh/Bảng/VĐV dùng `SubEventChooser` (viên). Có lý do (có "Tất cả" + kết hợp ngày/q), nhưng người dùng gặp 2 cách chọn cùng một thứ — chủ repo xác nhận.
- Chữ: tab trạng thái "Sắp tới"/"Đã xong" (`vi.json matches.states`) vs trạng thái trận "Chưa đấu"/"Đã kết thúc" (`match.status`) — cùng khái niệm 2 tên; EN "Completed" vs "Final".

### Trang trận `matches/[matchNo]/page.tsx`
- Đầu trang giải — khác: trang duy nhất dưới `events/[slug]` KHÔNG qua `EventShell` (không hero, không thanh tab), tự viết eyebrow + `h1.page-title` kiểu tham chiếu cũ (`page.tsx:52-58`). Lý do ghi ở `page.tsx:19` (1 lần gọi API). Hệ quả: từ trang trận không về được các tab khác ngoài link eyebrow + link "Xem nhánh/bảng".
- Eyebrow là `<Link>` (`page.tsx:54`) — không có rule `.eyebrow a` → màu link mặc định trình duyệt đè `--color-text-muted`, không focus-visible riêng.
- LIVE `match-detail.module.css:16-22` padding 2px 8px; 3 chỗ còn lại 0 6px.

### Tab Nhánh `draws/[subEventCode]/page.tsx` (tham chiếu, đã sửa trong đợt)
- Bậc heading — khác: trang thêm `h2.section-title` (`page.tsx:48`); khi nhánh có nhiều section, `BracketBoard` vẫn render `h2.sectionTitle` (`bracket-board.tsx:25`) → section nhánh cùng cấp với tiêu đề tab, round `h3`. Trước đợt này (h1 ở trang) thì đúng; giờ section phải xuống `h3`, round `h4`.
- Hai kiểu cho cùng `h2` 16/700: `.section-title` (margin 32 0 12, `global.css:40-44`) và `bracket.module.css:5-9` `.sectionTitle` (margin 0 0 8).
- Rỗng: `bracket-board.tsx:16` `<p>{t.empty}</p>` trần, không dùng `EmptyState` (các tab khác dùng) — lệch có từ tham chiếu, nhưng file này đã sửa trong đợt.
- Nhãn trùng: nav loại nhánh `aria-label=t.bracket.title` và ScrollRegion một section `label=t.title` cùng "Nhánh đấu" (có từ tham chiếu).

### Tab Bảng đấu `groups/[subEventCode]/page.tsx` — không khác (h2 → h3 bảng `.section-title` → h4 ẩn; bảng dùng chung `match-score-table.module.css`).

### Tab VĐV `players/[subEventCode]/page.tsx`
- Đếm VĐV dùng `.eyebrow` sau PillNav (`page.tsx:64`) — như mục Danh sách giải.

### Tab Thông tin `info/page.tsx`
- Link trong `infoBody` (`event-info.module.css:13-16`) không có focus-visible; bảng trong nội dung (`:23-34`) kiểu riêng (viền mọi ô, không đầu navy) — là nội dung soạn thảo, không phải bảng số liệu; báo để chủ repo biết, không coi là lệch.

## Lệch xuyên trang
1. **Focus** — có outline 2px (`--color-data` trên nền sáng, `--color-live` trên nền tối): pill, filter, event-card, match-card, overview link, back link, scroll-region, header, strip, ticket. **Thiếu**: `pagination-links.module.css:9-18` (`.link`), link "Xem tất cả giải" trang chủ, eyebrow link trang trận, link trong `infoBody`.
2. **LIVE** viết 4 lần, không mảnh dùng chung: `bracket.module.css:114`, `match-card.module.css:80`, `results-strip.module.css:52`, `match-detail.module.css:16`; nền data ×2 / data-deep ×2 (đúng theo nền cha), padding 0 6px ×3 / 2px 8px ×1.
3. **Ô trận 2 bản CSS**: `match-card.module.css` chép lại `.side/.name/.winner/.placeholder/.mark` của `bracket.module.css` với cỡ khác cho cùng vai — đầu ô 11px (bracket `.cellHead`) vs 12px (`match-card .head`), dấu hạt giống 11px vs 12px, padding hàng 3px 8px vs 6px 12px.
4. **Chữ CLB** cùng vai 3 cỡ: 13px (`event-overview :83`, `group-standings :8`, `match-detail :52`) vs 12px (`match-card :70`).
5. **Bảng**: 3 bảng số liệu dùng chung `matches/match-score-table.module.css` (đúng mẫu: thead navy, tabular-nums, ScrollRegion) — nhưng file dùng chung nằm trong `matches/` và được `groups/`, `players/` import chéo thư mục.
6. **Hover thẻ link**: event-card đổi màu tên (`--color-primary-strong`), match-card đổi nền (`--color-surface-alt`).
7. **Dấu nối điểm**: điểm ván `11-7` gạch ngang (`match-card.tsx:55`) vs số ván/thắng-thua `3–1` gạch ngang dài (`results-strip.tsx:28`, `group-standings.tsx:34-35`).
8. **EN**: `event.subEventChooser` = "Events" trùng nhãn nav chính "Events" (danh sách giải).
9. **Khoảng cách ngoài bội 4** (theme không có thang spacing → chỉ để tham khảo; tham chiếu tự có 2/3/6/14/26px): mới trong file mới — `match-score-table.module.css:20` `padding:10px 12px` (thead 8px; gần nhất 8/12), `match-card.module.css:47` `6px 12px`, gap 6px ở `tier-badge:4`, `event-hero:28`, `match-card:46`, `results-strip:38`; `match-detail.module.css:17` `2px 8px`. Cỡ chữ mới ngoài bộ tham chiếu (11/13/14/16/24/32): 12, 18, 22, 40 — không có thang để so.

## Không thuộc loại trang
`not-found.tsx`, `error.tsx` (checklist loại; `h1` không class, nút trần), `draws|groups|players/page.tsx` (chỉ redirect).

## Chưa kiểm được
- Không render: cỡ thật, tràn ngang ở 390px, menu `<details>` mobile, chiều cao vùng bấm, độ tương phản chữ trắng trên hero có banner `opacity .25`.
- `tokens.css` bản build (`dist/`) bị hook chặn đọc; suy từ `build-css-variables.ts` + `tokens.ts`.
- Không chạy typecheck/build.

Chi phí: 1 checker, 13 route + ~40 component/CSS, ~62 file đã mở, ~9 lệnh tìm/đọc (ước lượng).

Status: DONE_WITH_CONCERNS

## Round 2 (2026-11-14, kiểm lại sau sửa — chỉ đọc)

Pass:
- Focus — `global.css:37-40` `a:focus-visible` (2px `--color-data`, offset 2px) phủ pagination, link "Xem tất cả giải", eyebrow link trang trận, link `infoBody`. Rule riêng trên nền tối (`.navList a:focus-visible`, `.item:focus-visible`, `.ticket:focus-visible` → `--color-live`) có độ ưu tiên cao hơn nên vẫn giữ.
- Trang chủ — `h1` ẩn = tên site (`page.tsx:23`); link dùng `.text-link` (`page.tsx:40`, `global.css:42-45`) cùng bộ `--color-data`/600 như `.back`.
- Danh sách giải — `h1` → `h2.result-count` (`events/page.tsx:87`) → `h3` thẻ: hết nhảy bậc; đếm hết mượn `.eyebrow`, khoảng cách tới lưới 12px. VĐV `p.result-count` (`players/[subEventCode]/page.tsx:70`).
- Eyebrow link trang trận — `.eyebrow a { color: inherit }` (`global.css:33-35`).
- Hero — `h1.page-title` (`event-hero.tsx:22`). Dòng hạng giải giữ riêng: chấp nhận lý do (TierBadge chữ ink, không đọc được trên navy).
- Nhánh — section `h3.section-title` (`bracket-board.tsx:26`), round `h4`/`h3` theo `heading` (`bracket-round-column.tsx`); `.sectionTitle` đã bỏ; rỗng dùng `EmptyState` (`bracket-board.tsx:17`).
- LIVE trang trận — padding 0 6px (`match-detail.module.css:17`), khớp 3 chỗ còn lại.

Còn mở:
- Sót rule chết: `event-hero.module.css` trong `@media (min-width:768px)` vẫn còn `.title { font-size: 32px; }` dù class `.title` đã bỏ khỏi `event-hero.tsx` — vô hại, nên xoá.
- Nút "Mua vé": "chữ `--color-surface` trên `--color-primary` (#FFF/#EC1E24) ≈ 4.4:1, chữ 14/600 (không phải chữ lớn); cặp này họ chưa dùng ở đâu" — chưa sửa (`event-hero.module.css` `.ticket`), không nằm trong danh sách để chủ repo quyết.
- Nhỏ, không thuộc danh sách hoãn: "Chữ CLB cùng vai 3 cỡ: 13px … vs 12px (`match-card :70`)"; "Dấu nối điểm: `11-7` … vs `3–1`"; locale switcher "vùng bấm ~22–24px cao (ước lượng, chưa render)".

Không báo lại (chủ repo quyết): select vs pill ở tab Trận, trang trận ngoài EventShell, LIVE/ô trận dùng chung, `aria-current` nav chính, thang spacing, chữ nhãn, chỗ đặt stylesheet bảng, hover.
Các thay đổi hành vi mới (mặc định tab Trận, tab VĐV mở vòng loại, Thông tin fallback ngôn ngữ, locale giữ query) không thuộc mục đã báo → không kiểm ở vòng này.
Chưa kiểm được: như vòng 1 (không render). Chi phí vòng 2: ~9 file mở, 2 lệnh đọc/tìm.

Status: DONE_WITH_CONCERNS

## Toàn bộ (đợt 3)

Checker: agent riêng (không phải người viết), chỉ đọc, không render. So cả bộ trang công khai cùng lúc theo checklist "Mẫu giao diện site công khai" + tham chiếu (họ chỉ có tham chiếu → không có quy ước đếm; số đếm dưới đây đếm trong `app/[locale]/**` + `components/**`, chỉ để mô tả). Mục đã để chủ repo quyết ở vòng 2 không báo lại.

Kết quả: 11 trang có nội dung (trang chủ, danh sách, lịch, 6 tab giải, trang trận; `not-found`/`error`/3 trang redirect không thuộc loại). Khớp nhau: khung `main#content.container` (EventShell bọc `div.container`), `h1` một lần/trang, rỗng đều qua `EmptyState` (7 chỗ), 3 bảng số liệu cùng `match-score-table.module.css` + `ScrollRegion`, focus link phủ bởi `global.css:37-40`. Rule chết `.title` trong hero đã xoá (pass).

### Bản in (mới đợt 3)
1. **Lề trái hero lệch nội dung khi in** — `global.css:97-100` đưa `.container` về `padding:0`, nhưng hero giữ `padding: 24px/40px var(--layout-gutter-*)` (`event-hero.module.css:18-23,76-80`; khối print `:83-93` không đụng `.inner`). Ảnh `draws-ms-print.png`: chữ hero bắt đầu x≈40, tiêu đề nhánh + ô trận x=0. Trang trận (không hero) không bị.
2. **Hero là mặt navy duy nhất có luật in** — hero bỏ nền, chữ `--color-ink` (`event-hero.module.css:84-87`); các mặt navy còn lại vẫn in chữ trắng/vàng trên `--color-data`: `.roundTitle` (`bracket.module.css:37-46`), đầu bảng (`match-score-table.module.css:9-16`), bảng tỷ số trang trận `.board` + `.winner .games` `--color-live` (`match-detail.module.css:1-6,69-71`), thẻ vô địch (`event-overview.module.css:11-19`), nhãn LIVE (4 chỗ). Cùng một bản in trộn "nền tối bỏ" và "nền tối giữ". Nếu trình duyệt in không kèm nền (tuỳ chọn "Background graphics" tắt) thì chữ trắng/vàng ở các chỗ trên mất mặt nền — chưa kiểm (ảnh có sẵn chụp với nền bật).
3. **Chữ đầu ô lớn hơn chữ tên khi in** — print hạ `.cell` xuống 10px (`bracket.module.css:170-173`) nhưng `.cellHead` 11px (`:105`) và `.mark` 11px (`:143`) viết px tuyệt đối nên giữ 11px → "Trận #n" và hạt giống to hơn tên VĐV trên giấy (màn hình: 11 < 13, đúng thứ bậc). Thấy được trong ảnh.
4. **Mất ngữ cảnh lựa chọn khi in** — `global.css:89-95` ẩn mọi `nav`/`form`; lựa chọn chỉ nằm trong viên/form thì bản in không còn:
   - Nhánh: loại nhánh (chính/vòng loại) chỉ ở PillNav (`draws/[subEventCode]/page.tsx:53-62`); `h2` chỉ ghi "Nhánh đấu · <nội dung>" (`:50-52`) → bản in vòng loại và nhánh chính cùng tiêu đề.
   - VĐV: vòng chỉ ở PillNav (`players/[subEventCode]/page.tsx:66-71`); caption bảng có vòng nhưng `visually-hidden` (`entry-table.tsx:12`).
   - Trận đấu: trạng thái + lọc chỉ ở PillNav/FilterForm, `h2` ẩn (`matches/page.tsx:67-87`).
   - Bảng đấu: không bị (lựa chọn duy nhất là nội dung, đã nằm trong `h2`).
5. **Khổ ngang áp cho mọi trang** — `@page { size: landscape }` ở `global.css:84-87` nên danh sách giải, trang trận, Thông tin cũng in ngang; plan chỉ nêu nhánh (A4/A3 ngang) + lịch. Cần xác nhận có chủ ý.
6. **6 vòng chưa vừa A4 ngang theo số** — comment `bracket.module.css:152` "up to 6 rounds fit": 6×160 + 5×20 = 1060px; vùng in A4 ngang lề 10mm = 277mm ≈ 1047px (A3 ≈ 1512px vừa). Trình duyệt có thể tự thu nhỏ — chưa render. Plan còn "chia trang theo nửa nhánh khi lớn": code chỉ ngắt trang theo section (`:165-168`) — báo để biết, không phải lệch giao diện.

### Nút Mua vé (mới đợt 3)
- Cặp `--color-surface`/`--color-primary` = 4.40:1, chữ nay 20px/700 (`event-hero.module.css:62-63`) → chữ lớn (≥18.66px đậm), đạt mốc 3:1 cho chữ lớn. Hover `--color-primary-strong` 7.93:1. Mục vòng 2 coi như đóng.
- Cỡ 20px là cỡ mới trên site (đang có 11/12/13/14/16/18/22/24/32/40); mọi nút/điều khiển khác 14px (submit `filter-form.module.css:58`, phân trang `pagination-links.module.css:17`, viên `pill-nav.module.css:14`). Nút Mua vé giờ là chữ nút lớn nhất, lớn hơn cả tên thẻ giải 18px. Không có thang để so — báo là mới, không coi là sai.

### Xuyên trang (chưa báo ở vòng 1–2)
7. **`h2` của tab: hiện 4 / ẩn 2** — Tổng quan, Nhánh, Bảng đấu, VĐV có `h2.section-title` hiện; Trận đấu (`matches/page.tsx:67`) và Thông tin (`info/page.tsx:28`) dùng `h2.visually-hidden`. Thông tin hợp lý (nội dung tự có tiêu đề); Trận đấu là tab dữ liệu duy nhất không có tiêu đề thấy được (liên quan mục 4 khi in).
8. **Vòng focus skip link trên nền header tối** — `.skipLink:focus` (`site-chrome.module.css:6-14`) không có rule focus riêng → nhận `a:focus-visible` outline `--color-data` (`global.css:37-40`), mà link nằm `top:8px` đè lên header `--color-ink`: navy trên ink ≈ 1.4:1. Mọi mục khác trên header dùng outline `--color-live` (`site-chrome.module.css:99-105`). Nền link là surface trắng nên vẫn thấy link; chỉ vòng focus gần như không thấy.
9. Viền focus dải kết quả `outline-offset: -2px` (`results-strip.module.css:20`) vs `2px` ở mọi chỗ khác — có lý do (dải cuộn ngang, offset dương bị cắt), báo để biết.

### Không thuộc loại trang
`not-found.tsx`, `error.tsx`, `draws|groups|players/page.tsx` (redirect), `robots.ts`, `sitemap.ts`, `app/api/**`.

### Chưa kiểm được
- Không render: in thật (A4/A3, có/không nền, trình duyệt có thu nhỏ hay không), chiều cao nút Mua vé so với submit 40px, ô nhánh khi in (`.side` `min-height:26px` ×2 + đầu ô so với `--cell-h:56px`), màu tier `colorHex` (admin cấu hình) trên giấy trắng.
- Ảnh in chụp trước khi thêm luật in hero → mục 1 suy từ ảnh + CSS hiện tại; mục 2–3 từ CSS.
- `tokens.css` bản build không đọc; suy từ `tokens.ts`.

Chi phí đợt 3: 11 trang so cùng lúc, ~28 file mở, 9 lệnh đọc/tìm + 2 lệnh tính tương phản. Tổng 3 vòng (ước lượng): ~99 file mở, ~22 lệnh.

Status: DONE_WITH_CONCERNS
