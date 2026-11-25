# Báo cáo phase C6 — Chi tiết giải (shell + tổng quan)

Ngày: 2026-11-25. Phạm vi: `apps/client/**`. Chưa commit.

## Kết quả
- Status: DONE_WITH_CONCERNS (xem mục Lưu ý).
- Shell có 2 kiểu hero: đầy đủ ở Tổng quan, gọn ở các tab con. Tab dạng gạch chân (`PillNav variant="tabs"`).
- Hero đầy đủ: link "Tất cả giải đấu", `TierBadge filled`, loại giải, `StatusPill`, h1, ngày + địa điểm (link bản đồ nếu có `mapUrl`, báo mở tab mới), tài trợ bởi, summary, số liệu (VĐV, nội dung, ngày thi đấu x/y chỉ khi ONGOING; số 0 thì ẩn), CTA "Xem trận hôm nay" (ONGOING + có tab trận) và nút vé. Giữ `data-event-hero`.
- Tổng quan 2 cột (>= 1024px), mobile xếp 1 cột, sidebar nằm sau cột chính:
  - Chính: nhà vô địch (khi có), trận đang/sắp đấu, thẻ nội dung (tên, N VĐV / N cặp theo `competitorKind`, thể thức + "có vòng loại", link nhánh/bảng/danh sách), tin, video.
  - Sidebar: thông tin nhanh (thời gian + số ngày, địa điểm + địa chỉ + bản đồ, hạng giải), lịch theo ngày (Xong/Hôm nay/Ngày mai, link sang `/matches?date=`), tài trợ + "Liên hệ tài trợ" -> `/contact`.
  - Khối không có dữ liệu thì ẩn (tài trợ, tin, video, trận, lịch ngày). Không hiển thị Ban tổ chức/Tổng trọng tài (Q6).
- Trận đang/sắp đấu: `getMatches(slug, '?state=live|upcoming')` song song với `getEventContent` + `getHomeContent` (lấy `itemsPerSection` làm giới hạn, fallback `contentSettings` default) — cùng cache key với tab Trận. Giải COMPLETED không gọi các lệnh này.
- `MatchCard` (dùng chung): thêm nhãn bàn (A2) cạnh giờ/LIVE, không fork.
- Chuỗi cứng cũ (tin/video giải) và khối stats cũ chuyển vào dictionary vi + en (`event.hero/overview/quickInfo/days/sponsors/backToEvents`). Bỏ khóa không còn dùng (`overview.stats`, `playedMatches`, `entries`).
- Helper `lib/event-day-progress.ts` (số ngày, ngày x/y, nhãn hôm nay/ngày mai; so sánh ngày theo UTC nên không lệch DST) + unit test.

## Files
Sửa: `src/app/[locale]/events/[slug]/page.tsx`, `components/events/event-shell.tsx`, `event-hero.tsx`, `event-hero.module.css`, `event-overview.module.css`, `components/matches/match-card.tsx` + `.module.css`, `i18n/vi.json`, `i18n/en.json`, `tests/e2e/event-pages.spec.ts`.
Tạo: `components/events/event-hero-compact.tsx`, `event-hero-parts.tsx`, `event-hero-stats.tsx` + `.module.css`, `event-live-matches.tsx`, `sub-event-cards.tsx`, `event-quick-info.tsx`, `event-days-schedule.tsx`, `event-sponsors-card.tsx`, `event-sidebar.module.css`, `lib/event-day-progress.ts`, `tests/unit/event-day-progress.test.ts`.

## Kiểm chứng thực
- `pnpm lint`: sạch (`eslint src`, exit 0).
- `pnpm build`: biên dịch thành công, `/[locale]/events/[slug]` vẫn dynamic (ƒ).
- `pnpm typecheck`: 1 lỗi, không thuộc C6: `tests/unit/admin-group-withdrawal.test.ts(20,56)` thiếu prop `draft, flaggedIds` của `GroupCardProps` (admin đang sửa `group-card.tsx` ở phase A7/A8 song song). Không có lỗi ở file client của C6.
- `pnpm test`: 29/30 file đạt, 139/143 test đạt; 4 test rớt đều trong `admin-group-withdrawal.test.ts` (cùng nguyên nhân trên). `event-day-progress.test.ts` đạt.
- `pnpm test:print`: 2 file, 9/9 đạt.
- Trình duyệt (Next :3350 trên TEST DB, Playwright + axe) ở 1440 và 390, vi và en:
  - `/vi/events/entries-3f305b` (UPCOMING, có draws/lịch): status 200, overflow 0px, axe 0 vi phạm; hiện trận, 4 thẻ nội dung, thông tin nhanh, lịch ngày; không có tài trợ/tin/video (ẩn đúng).
  - `/vi|en/events/entries-dc9ac4` (ONGOING): axe 0, overflow 0; hiện "101/201 ngày thi đấu" + CTA "Xem trận hôm nay".
  - `/vi/events/rank-ad596c2d` (có nhà vô địch): axe 0, overflow 0.
  - `/vi/events/entries-3f305b/matches`, `/vi/events/entries-dc9ac4/draws/MS` (hero gọn): axe 0, overflow 0.
  - Focus: tab phím qua link "Tất cả giải đấu" (outline 3px), các tab (2px) và link khác đều có outline `solid`.
  - Ảnh: `scratchpad\c6\*.png`.
- Server :3350 do em chạy đã dừng (chỉ PID 26456). API :3000 và admin :5173 không đụng.

## Lưu ý / chưa làm
- Chưa chạy Playwright e2e (`test:e2e`, `accessibility`, `site-chrome-and-seo`) vì global-setup dựng world qua API/DB dùng chung; chỉ sửa `event-pages.spec.ts` (stats mới, hero gọn, heading mới) — chưa chạy được.
- Chưa chạy Lighthouse; chưa kiểm giải COMPLETED thật (DB test không có giải đã kết thúc; mã chỉ bỏ gọi trận và CTA khi COMPLETED).
- Lệch Figma có chủ ý: `MatchCard` giữ dạng thẻ ở mọi cỡ (chưa làm hàng lưới kiểu bảng + hàng tiêu đề aria-hidden ở desktop), tab Trận không đổi bố cục; không có khối tên "Ban tổ chức/Tổng trọng tài" (Q6); chưa có link "Tất cả tin" ở khối tin giải (news chưa lọc theo giải).
- `event-hero.module.css` còn 229 dòng (> 200) dù đã tách phần stats ra file riêng.
- Định dạng ngày ngắn cũ trong `formatDateRange` (vd "01-05 – 02/05/2099" ở vi) là hành vi có sẵn, không đổi trong C6.
- `tests/admin-full-flow/draws.ts` và các file admin đang bị sửa bởi phase khác; C6 không đụng.

## Câu hỏi còn mở
- Có cần làm bản thẻ trận dạng hàng-bảng ở desktop (như Figma 1-8) không, hay giữ thẻ thống nhất?

**Status:** DONE_WITH_CONCERNS
**Summary:** Shell 2 hero, tab gạch chân, tổng quan 2 cột và sidebar hoàn tất; lint/build/test:print đạt, axe 0 và không tràn ngang ở 1440/390.
**Concerns/Blockers:** typecheck/test rớt 1 file của admin (không thuộc C6); chưa chạy e2e, Lighthouse, và chưa kiểm giải COMPLETED thật.
