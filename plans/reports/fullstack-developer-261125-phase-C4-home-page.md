# Báo cáo phase C4 — trang chủ (2026-11-25)

## Đã làm (apps/client)
- `app/[locale]/page.tsx` (80 dòng): nhận `searchParams`; `getHomeContent` + site name song song; hero = `getEvent(heroEventSlug)` (lỗi thì bỏ hero, h1 ẩn tên site như cũ); "Trận đang đấu và sắp đấu" chỉ khi giải hero ONGOING + có tab trận, gọi `getMatches(slug, '?state=live')` rồi `'?state=upcoming'` (cùng chuỗi query với tab Trận), cắt ở server.
- Thứ tự khối: hero -> trận -> giải sắp tới -> tin -> video -> top VĐV (navy) -> tài trợ. Khối không có dữ liệu thì không render (trước đây hiện câu "chưa có"). `home.sections` vẫn bật/tắt từng khối.
- Mới: `components/home/` `home-hero`, `home-today-matches`, `home-news` (1 bài lớn + dòng), `home-top-rankings` (tab = link `?ranking=<code>#home-rankings`, bảng hạng/VĐV/CLB/điểm/biến động, chữ ẩn cho screen reader, CLB chuyển xuống dưới tên ở < 600px), `home-sections.module.css`; `events/sub-event-chips`; `lib/home-ranking-param.ts` + test 3 ca.
- Sửa: `EventCard` thêm `compact` (không banner, TierBadge filled, StatusPill, chip nội dung, "Xem chi tiết"; mặc định giữ nguyên cho trang danh sách/lịch); xóa rule `homeHero/rankings/rankingCard` thừa trong `content-layout.module.css`; i18n vi + en thêm `home.heroSchedule/heroDraws/heroDetails/matchesNow/allMatches/cardDetails/rankingsTabs/rankingsMovement/rankingsFull`; `content-home.spec.ts` thêm kiểm `?ranking=bad` -> 200 + canonical không có query.
- Hero: `<img alt="" fetchPriority="high">` với width/height, ảnh phủ 30% trên nền ink; không banner thì nền ink. CTA "Xem nhánh đấu" chỉ khi `tabs.draws`; "Xem lịch & kết quả" -> tab trận (không có tab trận thì -> trang giải).
- Không hiện: hạn đăng ký (Q4), "Hạt giống số N". `grep "Hạt giống" components/home` = 0.

## Kiểm chứng (chạy thật, apps/client)
- `pnpm typecheck`: sạch. `pnpm lint`: sạch.
- `pnpm test`: 26 file / 122 test đạt (thêm `home-ranking-param`, 3 ca).
- `pnpm build`: đạt.
- Trình duyệt: `next start` cổng 3314 (env truyền dòng lệnh, `API_INTERNAL_URL=http://localhost:3000`, test DB), Playwright + axe, script `...\scratchpad\c4\home-check.mjs`; `/vi`, `/en`, `/vi?ranking=bad`, `/vi?ranking=RD-ad596c2d` x 1440 và 390:
  - HTTP 200 mọi route; axe 0 vi phạm; `scrollWidth - clientWidth = 0`; một `<h1>` (tên giải hero "Entries dc9ac4"); canonical `http://localhost:3314/vi` (không query) kể cả khi `?ranking=bad`.
  - Khối có mặt: hero, trận, giải sắp tới, top VĐV. Khối vắng do DB không có dữ liệu: tin, video, tài trợ (đúng yêu cầu ẩn). `?ranking=bad` rơi về bảng đầu của payload.
  - Tab 22 lần: mọi điểm dừng có outline (0 điểm dừng không outline) ở cả 2 viewport.
  - Ảnh: `scratchpad\c4\real_vi-1440.png`, `real_vi-390.png`, `real_en-*.png`. Đã mở xem 1440 và 390: bố cục theo Figma 1-28/1-37 (hero tối, thẻ giải, khối navy, footer đen); mobile không tràn.
- Đã dừng Next (3314) và proxy (3315): `netstat` 0 listener.

## Chưa làm được / khai thật
- **Ticker kết quả chưa chụp được bằng dữ liệu thật.** Setting `header.resultsStrip.enabled` mặc định tắt trong DB test (API `/results/strip` trả `{"data":null}`), và không được sửa DB. Đã viết `scratchpad\c4\strip-proxy.mjs` (chuyển tiếp nguyên API thật, riêng `/results/strip` dựng từ 4 trận đã xong thật của `entries-3f305b`). Giữa phiên API cổng 3000 tắt (`curl` -> 000, không còn listener; không phải do em) nên chưa chạy được; luật cấm em tự khởi động API. Cần: bật lại API (test DB), rồi chạy proxy (`SECRET=<SSR secret> node strip-proxy.mjs`), Next với `API_INTERNAL_URL=http://localhost:3315`, và `BASE=http://localhost:3314 TAG=strip node home-check.mjs`. Cho tới đó ticker mới chỉ được kiểm bằng unit test (C3).
- Lighthouse `/vi`, `/en` chưa đo (cần Chrome + `lighthouse-audit.mjs`; ưu tiên dành cho kiểm ticker không thành). Playwright e2e (`content-home`, `accessibility`, `site-chrome-and-seo`) chưa chạy (cần seed vào DB, bị cấm).
- Chưa thấy trên trình duyệt: hero có ảnh banner (DB test không có banner), bài tin lớn, video, tài trợ, bảng top VĐV có ảnh/biến động giảm.

## Lệch so với phase file
- `HomeTopRankings` tự dựng bảng navy thay vì thêm `tone="navy"` cho `RankingTable` (khác cột: CLB riêng, biến động, không có chi tiết điểm); tab cũng tự dựng vì `PillNav tabs` chỉ đúng trên nền sáng.
- Chip nội dung hiện hết, xuống dòng; chưa cắt "+N".
- Số trận ở "Trận đang đấu và sắp đấu" lấy mặc định registry `contentSettings.homeItemsPerSection` (4), vì `/public/home` không trả giá trị `home.itemsPerSection` -> sửa setting trên `/settings` sẽ không đổi khối này. Các khối khác đã được API cắt theo setting.
- Nhãn khối đặt "Trận đang đấu và sắp đấu" (đúng dữ liệu live + upcoming) thay vì "Trận hôm nay".
- Docs `docs/public-site.md` chưa cập nhật (docs impact minor).

**Status:** DONE_WITH_CONCERNS
**Summary:** Trang chủ theo Figma xong; typecheck/lint/test (122)/build đạt; trình duyệt 2 viewport axe 0, không tràn, focus thấy rõ.
**Concerns:** Ticker chưa chụp với dữ liệu thật (setting tắt + API 3000 tắt giữa phiên); chưa đo Lighthouse; e2e chưa chạy; `home.itemsPerSection` chưa đi tới client (cần API thêm trường vào `PublicHome` nếu muốn khối trận theo setting).
