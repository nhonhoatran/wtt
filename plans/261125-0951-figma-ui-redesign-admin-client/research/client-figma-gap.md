# Đối chiếu Figma ↔ site công khai (apps/client)

> Ngày 2026-11-25. Nguồn Figma: `figma/client/*.png` (ảnh phẳng, đọc bằng mắt; chữ/số trong Figma là mẫu). Frame cuối mỗi section là bản chốt; các frame trước (1-5..1-7, 1-21..1-23, 1-16..1-18, 1-26/27, 1-13, 1-10, 1-30, 1-33, 1-36) chỉ là biến thể bố cục, không thêm tính năng mới.
> Nguồn mã: đọc trực tiếp ngày 2026-11-25. Ảnh chụp site cũ (2026-11-17..19) không dùng làm bằng chứng.

## Quy ước cột "Loại gap"

| Mã | Nghĩa |
|---|---|
| UI | Chỉ sửa giao diện client, dữ liệu đã có trong payload hiện tại |
| API-đọc | Dữ liệu có sẵn qua endpoint công khai khác, client gọi thêm (không đổi API) |
| API-mở | Dữ liệu có trong DB nhưng whitelist công khai chưa trả → thêm trường vào contract/serializer (không migration) |
| KHÔNG-DỮ-LIỆU | DB không có dữ liệu/tính năng → ẩn phần tử, đưa vào `client-open-questions.md` |

Cờ rủi ro: **A11y** (axe 0 violation), **LH** (Lighthouse mobile 85/90/95), **SEO**, **Cache** (tag/TTL theo `docs/cache-revalidation.md`), **i18n** (chuỗi mới phải có vi + en), **UX** (Figma kém tiện dụng hơn), **Riêng tư**.

## Phát hiện xuyên suốt

1. **Màu đỏ thương hiệu không đạt AA cho chữ nhỏ.** `#EC1E24` (`packages/ui-tokens/src/tokens.ts:4`) trên nền trắng hoặc chữ trắng trên nền đỏ = 4,3954:1 (đã ghi ở `docs/public-site.md:342`, chỉ đạt chữ lớn). Figma dùng đỏ cho chữ nhỏ ("XEM TẤT CẢ →", eyebrow, "Chi tiết →") và pill trắng-trên-đỏ cỡ 10–13px ("ĐANG ĐẤU", "ĐĂNG KÝ THI ĐẤU", "HẠNG A") → axe `color-contrast` sẽ báo. Cần token mới cho chữ/nhãn nhỏ (mặc định đề xuất `#D71920` ≈ 5,19:1, chờ thiết kế xác nhận). **A11y**.
2. **Chữ xám nhạt trong Figma** ("Hôm qua", "(trước: 1)", "Hạt giống số 1") trông nhạt hơn `textSubtle #737373` (4,74:1). Không dùng màu nhạt hơn token này. **A11y**.
3. **Header/footer không thống nhất giữa các frame**: wordmark "KAMITO | TOURNAMENT" (1-28), "KAMITO TOURNAMENT" (1-8), "KAMITO SPORT" (1-14 footer); nút "Đăng ký thi đấu" chỉ có ở 1-28; ticker 3 kiểu khác nhau. Kế hoạch chọn một bản (1-28 cho header, 1-14 cho footer) và áp mọi trang. **UX** (nhất quán).
4. **Nav Figma bỏ "Lịch" và "Liên hệ", thêm "Trận đấu"** (`main-nav.tsx:20-37` hiện có 7 mục cứng trong code). Luật dự án: mục nav không cứng → setting. "Trận đấu" toàn site không có route/API (chỉ có tab trận theo giải) → câu hỏi mở Q3.
5. **Chuỗi cứng chưa qua dictionary**: `events/[slug]/page.tsx:100-101` ("Tin tức giải", "Video giải"), `site-footer.tsx:15,21,27` ("Thông tin", "Liên kết", "Nhà tài trợ"), wordmark `site-header.tsx:19` ("KAMITO"). Sửa khi chạm file. **i18n**.
6. **Setting chết `home.featuredEventId`** (`packages/shared/src/tournament-settings.ts:92-99`) không được API/client nào đọc (grep `featuredEventId` trong `apps/` = 0 kết quả). Hero Figma cần đúng setting này → API-mở.
7. **Tag cache** khi thêm trường: `subEvent.*` chỉ gửi `event-*`, `schedule-*`, `draw-*`, `groups-*` (`apps/api/src/modules/revalidation/cache-tags.ts:86-90`) → nếu thẻ giải có danh sách nội dung thì phải thêm `events` (trang chủ cũng dùng tag `events`, `lib/public-data.ts:110`). `venueTable.write` chỉ gửi `event-*`, `schedule-*` (`cache-tags.ts:169`) → nếu trận/nhánh hiện tên bàn phải thêm `draw-*`, `groups-*`, `match-*`, `results-strip`. **Cache**.
8. Trang không có trong Figma (tin, video, VĐV danh sách, liên hệ, trang tĩnh, lịch tháng, tab Thông tin/VĐV/Bảng đấu): chỉ hưởng token + shell mới, không thiết kế lại.

## 1-28 Trang chủ desktop (và 1-37 mobile)

| Figma | Hiện có | Loại gap | Cờ |
|---|---|---|---|
| Ticker "Kết quả mới" dạng thẻ: nội dung·vòng, tên 2 bên, điểm từng ván, pill trạng thái, nút ‹ › | `results-strip.tsx:15-31`: `<details open>`, mã nội dung, tên, tổng ván; chỉ LIVE + OFFICIAL (`public-results-strip.query.ts:41-44`); bật/tắt + số trận bằng setting (`tournament-settings.ts:63-82`, mặc định tắt) | UI (ván có trong `games`); nút ‹ › bỏ, dùng cuộn ngang native | A11y: không auto-scroll (WCAG 2.2.2). Frame 1-28 có "SẮP ĐẤU 14:30" → API không trả trận SCHEDULED; giữ hành vi hiện tại (tên khối "Kết quả mới") |
| Header: wordmark, 6 mục nav, tìm kiếm, VI\|EN, nút "Đăng ký thi đấu" | `site-header.tsx:16-24`, `main-nav.tsx:20-37` (7 mục cứng), `locale-switcher.tsx:28` (chỉ hiện mã ngôn ngữ đích) | UI + setting nav; tìm kiếm = KHÔNG-DỮ-LIỆU (không có API tìm chung; `articles` không nhận `q`, `public-content.controller.ts:50-51`) → Q2; đăng ký = KHÔNG-DỮ-LIỆU → Q1 | i18n; A11y (VI\|EN hiện cả hai, mục hiện tại `aria-current`) |
| Hero tối: giải nổi bật, pill trạng thái, hạng, loại giải, ngày, địa điểm, chip nội dung, 2 CTA "Xem lịch & kết quả", "Xem nhánh đấu" | `page.tsx:41-44` (home): danh sách thẻ `featuredEvents` (giải `isFeatured`, `public-content.controller.ts:78-79`); thẻ không có nội dung/tab | API-mở: `heroEventSlug` (setting → `isFeatured` → giải gần nhất); API-đọc: `getEvent(slug)` cho chip nội dung + tab khả dụng (`PublicEventDetail`, `public-event-contract.ts:93-103`) | LH: ảnh banner là LCP → `fetchPriority="high"`, kích thước sẵn; A11y: chữ trắng trên ảnh cần lớp phủ đủ tối. CTA nhánh chỉ hiện khi `tabs.draws` |
| "Giải đấu sắp tới": 3 thẻ (ngày, hạng, trạng thái, tên, địa điểm, chip nội dung, "Hạn đăng ký", "Xem chi tiết") | `page.tsx:45-49`, `event-card.tsx:14-38` (ảnh banner, hạng, trạng thái, ngày, nơi) | UI; chip nội dung = API-mở (`PublicEventCard` không có `subEvents`, `public-event-contract.ts:31-44`); hạn đăng ký = KHÔNG-DỮ-LIỆU (Event không có cột, `tournament-event.prisma`) → Q4, ẩn | Cache (tag `events` cho `subEvent.*`). Thẻ bỏ ảnh banner theo Figma → nhẹ hơn (LH +) |
| "Tin mới nhất": 1 bài lớn + 3 bài dạng danh sách, nhãn chuyên mục, ngày, tóm tắt, tác giả | `page.tsx:50-53`: lưới `ArticleCard` từ `featuredArticles` | UI (đủ trường: `PublicArticleCard`, `public-content-contract.ts:4-16`) | Figma trộn mục "Video & Highlight" vào khối tin → giữ khối video riêng theo `home.sections.videos` (UX: một loại nội dung một khối) |
| Khối navy "Top vận động viên": tab Đơn nam/Đơn nữ/Đôi nam, bảng hạng/VĐV/CLB/điểm/biến động, "Xem BXH đầy đủ" | `page.tsx:58-63`: mỗi bảng một thẻ `<ol>`; `topRankings` có `movement`, `club`, `photo` (`public-ranking-contract.ts:5-37`) | UI; tab = link `?ranking=<code>` server-side (dữ liệu mọi bảng đã có trong payload) | "Hạt giống số 1" là dữ liệu mẫu vô nghĩa với BXH → hiện CLB. A11y: chữ xanh/đỏ biến động trên navy phải đạt 4.5:1; có chữ/biểu tượng ngoài màu |
| Dải tài trợ 6 ô | `page.tsx:64` + footer cũng hiện tài trợ site-wide (`site-footer.tsx:27`) | UI; vị trí hiển thị → Q5 | Trùng lặp trên trang chủ (hiện trạng) |
| Footer đen nhiều cột: blurb, MXH FB/YT/TT, 4 cột link, hàng pháp lý | `site-footer.tsx:10-33`: nhóm trang tĩnh theo `group`, tài trợ, © | UI + setting (`site.tagline`, `site.socialLinks` chưa có) → API-mở qua `/public/site` | i18n (nhãn MXH); mobile 1-37 dùng accordion → đổi thành lưới 2 cột không ẩn link (UX, không JS) |
| Mobile 1-37: "Trận hôm nay" của giải nổi bật | Không có | API-đọc: `getMatches(heroSlug, ?state=…)` (`lib/public-data.ts:56-61`, tag `schedule-<slug>`) | Hiện cả desktop để nhất quán; chỉ khi giải đang diễn ra |

## 1-8 Chi tiết giải (Tổng quan)

| Figma | Hiện có | Loại gap | Cờ |
|---|---|---|---|
| Ticker theo bàn "BÀN 1 N.H.Phúc 2-1…" | Strip không có bàn | API-mở: `table` trên `PublicMatchCard` (`public-competition-contract.ts:12-27`; DB có `Match.tableId`, `draws-and-matches.prisma:143-144`) | Cache (`venueTable.write`) |
| "← Tất cả giải đấu", hero tối viền bo, hạng, loại giải, pill trạng thái, tên, ngày, địa điểm, thống kê (VĐV, nội dung, bàn, ngày x/y), CTA "Xem trận hôm nay" | `event-hero.tsx:10-34`: banner, hạng·trạng thái, tên, ngày·nơi, presentedBy, summary, nút vé; thống kê nằm ở thân trang (`page.tsx:60-78`) | UI (VĐV `stats.players`, nội dung `subEvents.length`, ngày x/y tính từ ngày + múi giờ); số bàn = API-mở hoặc bỏ (đề xuất bỏ, YAGNI); CTA → `/matches?date=<hôm nay>` (bộ lọc ngày đã có) | Giữ `summary` và nút vé (dữ liệu thật, Figma thiếu). SEO: giữ JSON-LD (`page.tsx:42`) |
| Tab gạch chân: Tổng quan/Trận đấu/Nhánh đấu/Bảng đấu/Danh sách VĐV/Thông tin | `event-shell.tsx:10,23` `PillNav`, tab ẩn khi rỗng | UI (biến thể "tabs" của `PillNav`) | Giữ quy tắc ẩn tab rỗng |
| Bảng "Trận đang đấu & sắp đấu": giờ·bàn, nội dung·vòng, VĐV + CLB, tỉ số + ván, trạng thái; "Xem tất cả trận đấu" | Không có ở tổng quan | API-đọc `getMatches` (state live rồi upcoming) + API-mở `table` | Tiêu đề "Ca chiều (14:00–18:30)" bỏ (cần lịch session; UX vẫn đủ nhờ giờ từng trận) |
| Thẻ nội dung: tên, số VĐV/cặp, thể thức, "Đang ở: Tứ kết", "Xem nhánh/bảng đấu" | `page.tsx:80-98`: tên + link + số entry | UI (thể thức từ `format` + `drawKinds`); "VĐV" vs "cặp" = API-mở `competitorKind` (DB `Discipline.competitorKind`); "Đang ở" = API-mở phức tạp → hoãn | i18n |
| Tin về giải (2 thẻ) | `page.tsx:100` (chuỗi cứng) | UI | i18n |
| Sidebar "Thông tin nhanh": thời gian (số ngày), địa điểm đầy đủ, hạng giải, quy chuẩn & thể thức, Ban tổ chức, Tổng trọng tài | Không có sidebar | UI (thời gian, hạng); địa chỉ = API-mở (`Venue.address`, `mapUrl` có trong DB, `tournament-catalog.prisma:140-153`); thể thức = API-mở (`SubEvent.matchFormat`) → hoãn, không cần ở sidebar; BTC/Trọng tài = KHÔNG-DỮ-LIỆU → Q6, ẩn | Riêng tư: không suy "trọng tài" từ `officialById` (id người chốt kết quả, nội bộ) |
| Sidebar "Lịch theo ngày": ngày, nhãn Xong/Hôm nay/Ngày mai, mô tả vòng | Không có | API-mở: danh sách session theo ngày (`EventSession` có tên/ngày; schedule API trả nhưng kèm toàn bộ trận) | Cache: `session.*` đã gửi `event-*` (`docs/cache-revalidation.md:87`) |
| Sidebar "Nhà tài trợ" + "Liên hệ tài trợ giải đấu →" | `page.tsx:102` strip tài trợ giải | UI; link → `/contact` | Hạng tài trợ → Q5 |
| Footer gọn (khác 1-28) | — | Dùng một footer chung | UX |

## 1-11 Chi tiết trận

| Figma | Hiện có | Loại gap | Cờ |
|---|---|---|---|
| Breadcrumb "← Nhánh đấu Đơn nam", giải·nội dung·vòng, trạng thái | `matches/[matchNo]/page.tsx:42-44,58-63` | UI | — |
| Bảng điểm lớn 2 bên: ảnh, hạt giống, tên, CLB, "Hạng 8 · 1.540 điểm", tổng ván | `page.tsx:65-83` (hạt giống, tên, CLB, tổng ván) | UI (avatar chữ cái đầu); ảnh VĐV = API-mở (`PublicPlayerName` không có ảnh, `public-bracket-contract.ts:12`) → hoãn; hạng/điểm = API-mở → hoãn | Riêng tư: hồ sơ ẩn không có ảnh |
| Hàng meta: bàn, ca, ngày giờ, thời lượng, trọng tài | `page.tsx:50-54,92-101` (giờ dự kiến, bắt đầu, chốt) | UI (thời lượng = `officialAt − startedAt`); bàn = API-mở `table`; ca = API-mở `session` trên chi tiết; trọng tài = KHÔNG-DỮ-LIỆU → ẩn | — |
| "Điểm từng ván" | `match-score-table.tsx:1-46` | UI | Giữ `<table>` + caption |
| "Diễn biến trận đấu" (thẻ từng ván + người thắng) | — | Bỏ: lặp lại bảng điểm từng ván | UX |
| "Tóm tắt: X thắng 3–1, vào Bán kết gặp Y" | — | UI: câu sinh từ dữ liệu bằng template i18n; trận kế tiếp suy từ nhánh | i18n |
| "Đường đến trận này" mỗi bên | — | API-đọc: `getBracket` (đã cache, tag `draw-*`) → lần ngược nguồn `WINNER_OF`; trận bảng dùng `getGroups` | Trận vòng loại/bảng phức tạp hơn → chỉ hiện khi suy được |
| Sidebar "Thông tin trận", "Trận tiếp theo", "Trận khác cùng vòng", chú thích trạng thái | — | UI + API-đọc (`getBracket`) | Chú thích trạng thái bỏ (nhãn đã tự giải thích, UX) |

## 1-14 Danh sách giải

| Figma | Hiện có | Loại gap | Cờ |
|---|---|---|---|
| Breadcrumb, tiêu đề, mô tả, chip "12 giải trong năm 2027" | `events/page.tsx:63,88` (tiêu đề, số kết quả) | UI | i18n |
| Bộ lọc: Năm, Hạng giải, Trạng thái (select) + pill trạng thái + "Xóa bộ lọc" | `page.tsx:64-87` FilterForm GET: q, tier, type, year, status | UI: pill trạng thái là link GET; giữ ô tìm `q` và lọc loại giải (dữ liệu thật, Figma thiếu) | Trùng: select "Trạng thái" + pill → chỉ dùng pill (UX) |
| Nhóm theo tháng "Tháng 3/2027 · 2 giải" | Lưới thẻ không nhóm; lịch tháng riêng ở `/events/calendar` | UI: nhóm các mục của trang hiện tại theo tháng | Số "· 2 giải" sai khi tháng bị cắt giữa 2 trang → bỏ số (UX) |
| Hàng giải: khối ngày navy, hạng, loại giải, tên, địa điểm, chip nội dung, "128 VĐV · 5 nội dung", "Thưởng", "Hạn đăng ký", pill trạng thái, CTA theo trạng thái | `event-card.tsx` | UI; chip nội dung = API-mở; số VĐV trên thẻ = API-mở → hoãn (hiện số nội dung); thưởng, hạn đăng ký = KHÔNG-DỮ-LIỆU → Q4, ẩn | Cache (`events` cho `subEvent.*`) |
| "Hiển thị 1–5 trong 12 giải" + phân trang Trước/1/2/3/Sau | `pagination-links.tsx:22-34` | UI | Giữ link thật, `rel`, `aria-current` |

## 1-24 Nhánh đấu (và 1-34 mobile)

| Figma | Hiện có | Loại gap | Cờ |
|---|---|---|---|
| Hero gọn 1 dòng (hạng, tên, ngày, địa điểm) trên các tab con | `event-shell.tsx:21` luôn dùng hero lớn | UI: biến thể hero gọn cho mọi tab trừ Tổng quan | In nhánh: hero đang ẩn khi in nhiều tờ (`docs/public-site.md:312`) → chạy lại `test:print` |
| Chọn nội dung (tab), Vòng loại/Nhánh chính | `draws/[subEventCode]/page.tsx:43-63` (`PillNav`) | UI | Mobile: select nội dung trong form GET (giống Figma 1-34) hoặc giữ pill cuộn ngang → giữ pill (không cần nút submit) |
| Chú thích "Người thắng · Đang đấu · Sắp đấu" | — | UI | Không chỉ dựa màu (A11y) |
| Ô "Tìm VĐV trong nhánh" | — | Hoãn (Ctrl+F đủ trên desktop; mobile theo vòng → cần server highlight) | YAGNI |
| Tiêu đề vòng có ngày "Tứ kết · 14/03" | `bracket-round-column.tsx` (tên vòng) | UI: ngày = min `scheduledAt` của vòng theo múi giờ giải | — |
| Ô trận: hạt giống, tên, CLB, điểm từng ván, tổng, bàn·giờ, pill trạng thái, "Chi tiết →" | `bracket-match-cell.tsx:22-57` (hạt giống, tên, quota, tổng; CLB chỉ ở `title`); **không có link tới trang trận** | UI (CLB, ván, link, pill); bàn = API-mở trên `PublicBracketMatch` (`public-bracket-contract.ts:33`) | In: ô cao hơn → kiểm lại chia trang PDF (`print-bracket-pages.ts`) |
| Cột "Vô địch" | — | UI: người thắng trận chung kết | — |
| Vòng bảng ngay dưới nhánh | Tab "Bảng đấu" riêng (`groups/[subEventCode]`) | Giữ tab riêng (không lặp dữ liệu), thêm link "Xem vòng bảng" trên nhánh khi `hasGroups`; restyle bảng xếp hạng bảng theo Figma | UX, Cache (tách tag) |
| Mobile 1-34: chip vòng (Vòng 1/8, Tứ kết…), một vòng mỗi màn, "Thắng → Bán kết 1" | `bracket-board.tsx:23,32-38` cuộn ngang | UI: `?round=N` server-side chỉ đổi cột hiển thị trên ≤640px (desktop vẫn đủ vòng, không gọi API khác); "Thắng →" suy từ nguồn `WINNER_OF` | `round` không vào cache key/canonical |

## 1-19 Hồ sơ VĐV

| Figma | Hiện có | Loại gap | Cờ |
|---|---|---|---|
| Hero tối: ảnh, "VĐV · Đơn nam", tên, CLB · tỉnh, năm sinh, tay thuận, kiểu cầm vợt, lối đánh | `player-hero.tsx:9-19` (CLB, giới tính, tay thuận, tuổi nếu `showAge`) | UI; năm sinh **không hiện** (serializer chủ ý không trả, `docs/public-site.md:190`); cầm vợt/lối đánh = KHÔNG-DỮ-LIỆU → Q7, ẩn | **Riêng tư** |
| Thống kê: hạng, điểm, "38–6 Thắng–thua 2027", "Xem trên BXH" | `player-current-ranks.tsx` (mọi bảng) | UI (hạng/điểm bảng chính = phần tử đầu `ranks`); thắng–thua = API-mở (đếm trận OFFICIAL công khai) | Theo mùa → không chốt định nghĩa mùa; hiện tổng toàn thời gian |
| "Kết quả gần đây" dạng bảng: ngày, giải·vòng, đối thủ, tỉ số + ván, Thắng/Thua | `player-results-list.tsx` (thẻ `MatchCard`, phân trang `?page`) | UI | Thắng/Thua cần chữ, không chỉ màu |
| Thẻ "Trận sắp tới" | — | API-mở + cần thêm tag `player-*` cho `schedule.update` → hoãn (Q8) | Cache |
| "Giải đã tham dự": hạng giải, nội dung, thành tích, điểm | `page.tsx:59-66` (tên + ngày) | API-mở → hoãn (Q8) | — |
| "Phong độ 10 trận", "Thành tích nổi bật" | — | Bỏ "Phong độ" (lặp bảng kết quả); "Thành tích nổi bật" hoãn (Q8) | UX |

## 1-3 Bảng xếp hạng desktop (và 1-31 mobile)

| Figma | Hiện có | Loại gap | Cờ |
|---|---|---|---|
| Tiêu đề, "Cập nhật ngày…", "Cách tính điểm →" | `rankings/[listCode]/page.tsx:51-53` | UI; "Cách tính điểm" → trang tĩnh CMS cấu hình (Q9), ẩn khi chưa có | — |
| Tab bảng Đơn nam/Đơn nữ/Đôi | `ranking-list-tabs.tsx:8-12` (tab theo SINGLES/DOUBLES ở trang tổng quan) | UI: tab theo bảng đang bật trên trang bảng | Nhiều bảng (nhóm tuổi `list.category`) → tab tràn; dùng tab giới tính/loại + select nhóm khi > 1 (UX) |
| Ô tìm "VĐV hoặc CLB", select CLB, "Hiển thị 1–10 trong 186" | `page.tsx:54-58` FilterForm GET q + club | UI | `q` → policy `none` (giữ) |
| Bảng: hạng, thay đổi + "(trước: N)", avatar chữ, tên, CLB, số giải, điểm, mở rộng | `ranking-table.tsx` + `<details>` trong ô điểm (`ranking-table.tsx:27`) | UI (`previousRank`, `resultsCounted` có sẵn) | A11y: Figma mở rộng toàn hàng → không làm được với `<details>` trong ô bảng; chuyển sang danh sách `<ol>` mỗi dòng một `<details>`, link hồ sơ nằm trong panel (tránh `nested-interactive`) |
| Panel: giải, hạng giải, thành tích, điểm, hết hạn, nhãn "Sắp hết hạn", tổng điểm, "Xem hồ sơ" | `points-breakdown-details.tsx:13-38` (giải, mã loại giải, vòng, điểm, hết hạn) | UI; "Sắp hết hạn" cần ngưỡng → setting mới (API-mở qua `/public/site`); hạng giải dùng `eventTypeCode` hiện có | Không cứng số ngày |
| "Hiển thị 10 dòng/trang" | Cỡ trang từ setting `public.listPageSize` | Bỏ (YAGNI; nhiều cache key) | — |
| Mobile 1-31: thẻ dòng, panel "Xem thêm 2 giải" | — | UI (cùng markup `<ol>`) | Hiện đủ khoản điểm, không cắt "xem thêm" (dữ liệu đã có trong HTML) |
| Trang `/rankings` tổng quan | `rankings/page.tsx:25-55` (top N theo nhóm) | UI: restyle như khối navy trang chủ; giữ route (sitemap, link cũ) | SEO |

## Kiểm thử hiện có bị ảnh hưởng

| Suite | Đường dẫn | Ghi chú |
|---|---|---|
| Axe | `apps/client/tests/e2e/accessibility.spec.ts:8-18` | 9 route × vi/en; **chưa có** trang trận, danh sách giải, `/rankings`, tab trận → thêm |
| Lighthouse | `apps/client/tests/performance/lighthouse-audit.mjs` | URL truyền tay; mốc 4 route (`docs/public-site.md:71-76`) |
| Nav/SEO/mobile 390/in | `tests/e2e/site-chrome-and-seo.spec.ts:67,124-139,141-150` | Nav đổi mục → sửa test 67 |
| Trang giải/nhánh/bảng/trận | `tests/e2e/event-pages.spec.ts` | Selector thẻ/ô nhánh đổi |
| BXH/hồ sơ | `tests/e2e/rankings-and-players.spec.ts:8-62,156` | `<details>` không JS vẫn phải chạy |
| Trang chủ CMS | `tests/e2e/content-home.spec.ts:9` | Bật/tắt khối |
| In nhánh PDF | `pnpm --filter @kamito/client test:print` | Ô nhánh đổi kích thước |
| Khóa i18n | `tests/i18n-keys.test.ts` | vi/en cùng khóa |
| Snapshot whitelist API | `apps/api` test serializer (`docs/public-site.md:159`) | Mỗi trường mới sửa snapshot có chủ đích |
