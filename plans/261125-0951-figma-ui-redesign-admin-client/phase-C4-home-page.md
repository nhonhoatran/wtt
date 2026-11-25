---
phase: C4
title: "Trang chủ theo Figma (desktop 1-28, mobile 1-37)"
status: pending
priority: P1
effort: 4h
depends_on: [C1, C2, C3]
---

# Phase C4 — Trang chủ

## Context links
- Gap: [research/client-figma-gap.md](./research/client-figma-gap.md) mục 1-28
- Câu hỏi: Q4 (hạn đăng ký), Q5 (tài trợ)
- Figma: `figma/client/1-28.png`, `1-37.png`
- Hiện có: `apps/client/src/app/[locale]/page.tsx:1-67`

## Overview
- Ưu tiên: P1 (route có Lighthouse gate).
- Thứ tự khối: hero giải nổi bật → trận hôm nay (chỉ khi giải hero đang diễn ra) → giải sắp tới → tin mới nhất → video (theo setting) → top VĐV (navy, tab theo bảng) → tài trợ. Mỗi khối vẫn bật/tắt bằng `home.sections`; số mục theo `home.itemsPerSection`.

## Key insights
- Hero cần chip nội dung + tab khả dụng → `getEvent(heroEventSlug)` (A6 + endpoint có sẵn, tag `event-<slug>`, policy `matchday`). Thêm 1 lời gọi API đã cache.
- "Trận hôm nay" = `getMatches(slug, ?state=live)` rồi `?state=upcoming` — **cùng chuỗi query** với tab Trận để dùng chung cache key; hiển thị tối đa `home.itemsPerSection` mục (cắt khi render ở server, không lọc phía trình duyệt).
- Tab "Top VĐV" = link `?ranking=<code>#home-rankings`; dữ liệu mọi bảng đã có trong `topRankings`; code được kiểm với danh sách trong payload, sai → bảng đầu. Canonical vẫn `/` (`pageMetadata(locale, '')`).
- Thẻ giải bỏ ảnh banner (Figma) → nhẹ hơn; hero là ảnh LCP duy nhất.
- Hiện trang chủ có cả khối tài trợ và footer tài trợ (trùng). Giữ nguyên cho tới Q5.

## Requirements
- Chức năng: như Overview; CTA hero "Xem lịch & kết quả" → `/events/:slug/matches`, "Xem nhánh đấu" chỉ khi `tabs.draws`; thẻ giải: khoảng ngày, `TierBadge filled`, `StatusPill`, tên, địa điểm, chip nội dung (A1), "Xem chi tiết"; tin: 1 bài nổi bật lớn + danh sách còn lại; top VĐV: hạng, avatar, tên (link hồ sơ khi có slug), CLB, điểm, biến động (▲▼ + số + chữ ẩn cho screen reader).
- Không hiện: hạn đăng ký (Q4), "Hạt giống số N" (mẫu vô nghĩa với BXH).
- Phi chức năng: Lighthouse `/vi` mobile ≥ 85/90/95; axe 0; một `<h1>` (tên giải hero, nếu không có hero thì `h1` ẩn tên site như cũ); i18n đủ.

## Architecture
```
HomePage(searchParams.ranking)
 ├ getHomeContent()            tags: home, articles, videos, sponsors, events, rankings, settings
 ├ getEvent(heroEventSlug)     tags: event-<slug>, players          (nếu có)
 ├ getMatches(slug, ?state=…)  tags: schedule-<slug>, players, settings (nếu lifecycle = ONGOING)
 └ render: HomeHero, HomeTodayMatches, HomeUpcomingEvents, HomeNews, HomeVideos, HomeTopRankings, SponsorStrip
```

## Related code files
Sửa:
- `apps/client/src/app/[locale]/page.tsx` (chỉ ghép khối, < 80 dòng)
- `apps/client/src/components/events/event-card.tsx`, `event-card.module.css` (biến thể thẻ Figma, bỏ ảnh)
- `apps/client/src/components/content/article-card.tsx`, `content.module.css` (biến thể lớn + dòng)
- `apps/client/src/components/rankings/ranking-table.tsx`, `rankings.module.css` (biến thể `tone="navy"` cho bảng gọn)
- `apps/client/src/components/content/content-layout.module.css`
- `apps/client/src/i18n/vi.json`, `en.json` (`home.*`)
- `apps/client/tests/e2e/content-home.spec.ts`

Tạo:
- `apps/client/src/components/home/home-hero.tsx` + `.module.css`
- `apps/client/src/components/home/home-today-matches.tsx`
- `apps/client/src/components/home/home-news.tsx`
- `apps/client/src/components/home/home-top-rankings.tsx`
- `apps/client/src/components/events/sub-event-chips.tsx` (dùng lại ở C5, C6)
- `apps/client/src/lib/home-ranking-param.ts` (chọn bảng từ `?ranking`, có unit test `tests/unit/home-ranking-param.test.ts`)

## Implementation steps
1. `page.tsx`: nhận `searchParams`; `Promise.all` cho home + site name; sau đó hero event và trận (song song).
2. `HomeHero`: `<img>` banner (`fetchPriority="high"`, `width/height`, `alt=""` vì trang trí), lớp phủ ink ≥ 70% để chữ trắng đạt 4.5:1; pill trạng thái, hạng, loại giải, `<h1>` tên, ngày, địa điểm, chip nội dung, 2 CTA. Không banner → nền ink.
3. `HomeTodayMatches`: dùng `MatchCard` (C6 sẽ restyle chung); tiêu đề "Trận hôm nay" + "Tất cả" → tab trận.
4. Thẻ giải: `SubEventChips` (tối đa hiển thị theo chiều rộng, phần dư "+N"); CTA theo trạng thái (đang diễn ra → tab trận; khác → tổng quan).
5. `HomeNews`: bài đầu lớn (ảnh `loading="lazy"`), còn lại dạng dòng; nhãn chuyên mục đọc như trang tin (setting `news.categoryLabelsEn`).
6. `HomeTopRankings`: `PillNav variant="tabs"` với href `?ranking=<code>#home-rankings`; bảng `RankingTable compact tone="navy"`; "Xem bảng xếp hạng đầy đủ" → `/rankings/<code>`.
7. Bỏ chuỗi cứng (nếu còn); cập nhật `content-home.spec.ts` (selector khối, bật/tắt khối vẫn đúng).
8. Chạy kiểm + Lighthouse `/vi`, `/en`.

## Todo
- [ ] Ghép khối `page.tsx`
- [ ] Hero + CTA theo tab khả dụng
- [ ] Trận hôm nay (chỉ khi ongoing)
- [ ] Thẻ giải + chip nội dung
- [ ] Tin nổi bật + danh sách
- [ ] Top VĐV navy + tab link
- [ ] Test trang chủ, axe, Lighthouse

## Success criteria
- `content-home.spec.ts`, `accessibility.spec.ts` (route `/vi`, `/en`, hai viewport), `site-chrome-and-seo.spec.ts` (mobile 390 không tràn) đạt.
- Lighthouse mobile `/vi`: Performance ≥ 85, Accessibility ≥ 90, SEO ≥ 95 (`node tests/performance/lighthouse-audit.mjs <url>`); ghi số thực vào báo cáo phase.
- Tắt từng khối trong `home.sections` → khối biến mất; `?ranking=bad` → bảng đầu, HTTP 200, canonical không có query.
- Không còn dữ liệu mẫu Figma (grep "Hạt giống" trong `components/home` = 0).

## Risk assessment
| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Hero ảnh lớn làm LCP chậm | Trung bình × Cao | Biến thể ảnh sẵn từ media worker; `fetchPriority`; đo Lighthouse |
| Thêm 2 lời gọi API làm chậm SSR | Thấp × Trung bình | Đều đã cache Redis; chạy song song |
| Chữ trắng trên ảnh sáng | Trung bình × Trung bình | Lớp phủ cố định, không phụ thuộc ảnh |
| Giải hero không đang diễn ra → khối trận rỗng | Cao × Thấp | Ẩn khối khi không ONGOING hoặc không có trận |

## Security considerations
- `ranking` chỉ nhận code có trong payload; không đưa vào API.

## Next steps
- C5 dùng lại `SubEventChips`, `StatusPill`. Rollback: revert commit (API A1/A6 vẫn tương thích).
