---
phase: C6
title: "Chi tiết giải: hero, tab, tổng quan 2 cột, thẻ trận dùng chung"
status: completed
priority: P1
effort: 5h
depends_on: [C1, C2, C3, C5]
---

# Phase C6 — Chi tiết giải

## Context links
- Gap: [research/client-figma-gap.md](./research/client-figma-gap.md) mục 1-8
- Câu hỏi: Q6 (Ban tổ chức, Tổng trọng tài), Q5 (tài trợ)
- Figma: `figma/client/1-8.png` (chốt), `1-5..1-7.png` (biến thể)
- Hiện có: `components/events/event-shell.tsx:1-28`, `event-hero.tsx:1-36`, `app/[locale]/events/[slug]/page.tsx:1-105`, `components/matches/match-card.tsx`

## Overview
- Ưu tiên: P1 (route trang giải có Lighthouse + axe gate, trang nóng ngày thi đấu).
- `EventShell` có hai kiểu hero: **đầy đủ** ở Tổng quan (stats + CTA "Xem trận hôm nay"), **gọn** ở các tab con (theo 1-24). Tab dạng gạch chân. Tổng quan 2 cột: chính (trận đang/sắp đấu, nội dung thi đấu, tin, video) + sidebar (thông tin nhanh, lịch theo ngày, tài trợ). `MatchCard` restyle một lần, dùng ở Tổng quan, tab Trận, tab Bảng, hồ sơ VĐV, trang chủ.

## Key insights
- Tab ẩn khi rỗng giữ nguyên (`event-shell.tsx:18`).
- Trận đang/sắp đấu: `getMatches(slug, ?state=live)` và `?state=upcoming` — cùng chuỗi query với tab Trận (chung cache key `schedule-<slug>`, policy `matchday`).
- Stats: VĐV (`stats.players`), nội dung (`subEvents.length`), ngày thi đấu "x/y" (tính từ `startDate`, `endDate`, hôm nay theo `timezone`; chỉ hiện khi ONGOING). Không hiện "số bàn" (YAGNI).
- "Xem trận hôm nay" → `/matches?date=<hôm nay theo múi giờ giải>` (bộ lọc ngày đã có, server bỏ ngày ngoài biên).
- Bảng desktop Figma vs thẻ mobile: **một** `MatchCard` (article) — desktop ≥ 1024px xếp thành hàng lưới giống bảng, có hàng tiêu đề trực quan `aria-hidden`; mỗi thẻ có nhãn đọc được cho screen reader. Tránh hai markup.
- Sidebar mobile: đặt sau khối trận (trận là thứ người xem ngày thi đấu cần nhất).
- Không hiện "Ban tổ chức", "Tổng trọng tài" (Q6). Giữ `summary`, `presentedBy`, nút vé (dữ liệu thật).
- `page.tsx` tổng quan đang 105 dòng + chuỗi cứng dòng 100–101 → tách component, chuỗi vào dictionary.

## Requirements
- Hero đầy đủ: "← Tất cả giải đấu", `TierBadge filled`, loại giải, `StatusPill`, `<h1>`, ngày, địa điểm (link bản đồ nếu `mapUrl`), summary, stats, CTA (hôm nay khi ONGOING; vé khi có `ticketUrl`).
- Hero gọn: hạng + tên (`<h1>` vẫn là tên giải để giữ cấu trúc heading hiện tại) + ngày + địa điểm.
- Thẻ nội dung: tên, "N VĐV"/"N cặp" theo `competitorKind` (A3), thể thức (từ `format` + có vòng loại), link "Xem nhánh/bảng/danh sách" theo `subHref` hiện có (`page.tsx:37-38`).
- Sidebar: thông tin nhanh (thời gian + số ngày, địa điểm + địa chỉ A4, hạng giải); lịch theo ngày (A5) với nhãn Xong/Hôm nay/Ngày mai; tài trợ giải + "Liên hệ tài trợ" → `/contact`.
- `MatchCard`: giờ · bàn (A2), nội dung · vòng, 2 bên + CLB, tổng ván + điểm từng ván, `StatusPill`, link trận; trận void giữ cờ.
- Phi chức năng: Lighthouse trang giải ≥ 85/90/95; axe 0; in nhánh/lịch không đổi.

## Architecture
```
EventShell(active, variant = active === 'overview' ? 'full' : 'compact')
  ├ EventHero (full) | EventHeroCompact
  └ PillNav variant="tabs"
Overview page
  ├ getEvent (đã có trong loadEventPage), getEventContent, getMatches×2 (song song)
  ├ main: EventLiveMatches → MatchCard[] ; SubEventCards ; tin ; video
  └ aside: EventQuickInfo ; EventDaysSchedule ; tài trợ
```

## Related code files
Sửa:
- `apps/client/src/components/events/event-shell.tsx`, `event-hero.tsx`, `event-hero.module.css`, `event-overview.module.css`
- `apps/client/src/app/[locale]/events/[slug]/page.tsx`
- `apps/client/src/app/[locale]/events/[slug]/matches/page.tsx` (bố cục mới của danh sách thẻ)
- `apps/client/src/components/matches/match-card.tsx`, `match-card.module.css`
- `apps/client/src/lib/format-date-time.ts` (helper ngày thi đấu thứ x/y nếu chưa có)
- `apps/client/src/i18n/vi.json`, `en.json` (`event.overview.*`, `event.quickInfo.*`, `event.days.*`)
- `apps/client/tests/e2e/event-pages.spec.ts`, `match-filter-debts.spec.ts`, `schedule.spec.ts` (selector)

Tạo:
- `apps/client/src/components/events/event-hero-compact.tsx`
- `apps/client/src/components/events/event-hero-stats.tsx`
- `apps/client/src/components/events/event-live-matches.tsx`
- `apps/client/src/components/events/sub-event-cards.tsx`
- `apps/client/src/components/events/event-quick-info.tsx`
- `apps/client/src/components/events/event-days-schedule.tsx`
- `apps/client/src/components/events/event-sidebar.module.css`
- `apps/client/tests/unit/event-day-progress.test.ts` (ngày x/y, nhãn hôm nay/ngày mai qua DST/múi giờ)

## Implementation steps
1. `EventShell`: thêm `variant`; tab dùng `PillNav variant="tabs"`.
2. Hero đầy đủ/gọn; giữ `data-event-hero` (in nhánh dựa vào nó, `docs/public-site.md:312`).
3. Helper ngày: dùng `todayInTimezone` của `@kamito/shared`; unit test.
4. `MatchCard` restyle + bàn; hàng tiêu đề trực quan ở `EventLiveMatches` và tab Trận (`aria-hidden`).
5. Tổng quan: tách component, `Promise.all` cho content + 2 danh sách trận; ẩn khối khi rỗng; giữ JSON-LD và khối nhà vô địch (dữ liệu thật, đặt đầu khi COMPLETED).
6. Sidebar 3 thẻ; địa chỉ + link bản đồ (`target="_blank"`, báo mở tab mới).
7. Thay chuỗi cứng `page.tsx:100-101`.
8. Cập nhật test, chạy kiểm, chụp 1440/390.

## Todo
- [x] Shell 2 kiểu hero + tab gạch chân
- [x] Helper ngày thi đấu + test
- [x] `MatchCard` mới (dùng chung)
- [x] Tổng quan 2 cột + sidebar
- [x] Chuỗi cứng → dictionary
- [x] E2E, axe và test in đạt (báo cáo C11)
- [x] Lighthouse production (lượt cuối C11: 100/100/100)


## Đồng bộ trạng thái 2026-11-25

Nguồn: [báo cáo triển khai](../reports/fullstack-developer-261125-phase-C6-event-detail.md). Kiểm tích hợp sau các phase: [báo cáo C11](../reports/fullstack-developer-261125-phase-C11-client-gates.md).

Lỗi typecheck/unit do props admin được sửa ở A7; báo cáo sửa review vòng 4 và C11 xác nhận các bộ kiểm đã đạt. Lighthouse production cuối C11: trang giải 100/100/100, `runtimeError=null`.

## Success criteria
- `event-pages.spec.ts`, `match-filter-debts.spec.ts`, `schedule.spec.ts`, `accessibility.spec.ts`, `site-chrome-and-seo.spec.ts` (in nhánh, mobile 390) đạt, desktop + mobile.
- `pnpm --filter @kamito/client test:print` đạt (8 PDF, đủ 63 trận/64 tên mỗi bản như mốc `docs/public-site.md:310`).
- Lighthouse `/vi/events/<fixture>` ≥ 85/90/95.
- Giải COMPLETED: không có CTA "hôm nay", không có khối trận rỗng.

## Risk assessment
| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Restyle `MatchCard` phá trang bảng/hồ sơ | Trung bình × Trung bình | Chạy toàn bộ `event-pages` + `rankings-and-players`; ảnh chụp |
| Hero gọn làm vỡ chia trang in nhánh | Trung bình × Trung bình | `test:print` + e2e in |
| Thêm 2 lời gọi trận làm chậm trang giải ngày thi đấu | Thấp × Trung bình | Chung cache key với tab Trận, `matchday` TTL; song song |

## Security considerations
- `mapUrl` chỉ https (C2); render `rel="noopener noreferrer"`.

## Next steps
- C7 dùng shell gọn. Rollback: revert commit.
