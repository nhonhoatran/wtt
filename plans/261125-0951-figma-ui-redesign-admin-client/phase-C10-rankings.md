---
phase: C10
title: "Bảng xếp hạng (desktop 1-3, mobile 1-31) và trang tổng quan"
status: pending
priority: P1
effort: 4h
depends_on: [C1, C2, C4]
---

# Phase C10 — Bảng xếp hạng

## Context links
- Gap: [research/client-figma-gap.md](./research/client-figma-gap.md) mục 1-3
- Câu hỏi: Q9 (trang "Cách tính điểm")
- Figma: `figma/client/1-3.png`, `1-31.png` (chốt), `1-30.png`
- Hiện có: `app/[locale]/rankings/page.tsx:1-56`, `rankings/[listCode]/page.tsx:1-68`, `components/rankings/*`
- `docs/public-site.md` mục "Xếp hạng và hồ sơ VĐV (phase 10)"

## Overview
- Ưu tiên: P1 (route `/rankings/<code>` có Lighthouse + axe gate).
- `/rankings/<code>`: breadcrumb, tiêu đề tên bảng, "Cập nhật ngày …", link "Cách tính điểm" (khi Q9 có trang), bộ chọn bảng, tìm + CLB (GET), "Hiển thị a–b trong N VĐV", danh sách xếp hạng mở rộng từng dòng, phân trang.
- `/rankings`: giữ route (sitemap, link cũ); restyle thành các khối top N navy như trang chủ.

## Key insights
- Figma mở rộng **cả hàng** để hiện điểm theo giải; `<details>` trong ô bảng (`ranking-table.tsx:27`) không trải được cả hàng. Chuyển danh sách đầy đủ sang `<ol>`: mỗi dòng một `<details>`; `<summary>` chứa hạng, biến động, avatar, tên, CLB, số giải, điểm (nhãn cột ẩn trực quan trong từng dòng); panel chứa bảng điểm + tổng + link hồ sơ. **Không đặt link trong `<summary>`** (axe `nested-interactive`). Hàng tiêu đề cột trực quan `aria-hidden` trên desktop. Không JS vẫn mở được (test hiện có `rankings-and-players.spec.ts:46`).
- Bảng gọn top N (trang chủ, tổng quan) giữ `<table>` với link tên trực tiếp (`RankingTable compact`).
- Bộ chọn bảng: Figma có 3 tab (Đơn nam/Đơn nữ/Đôi) nhưng dữ liệu có thể nhiều bảng theo nhóm tuổi (`list.category`) → tab theo bảng khi ≤ 5 bảng cùng loại, ngược lại tab theo loại (đơn/đôi) + `<select>` bảng trong form GET. Danh sách bảng lấy từ `getRankings()` (đã cache).
- "Sắp hết hạn": `expiresAt − hôm nay ≤ ranking.expiringSoonDays` (C2, 0 = tắt); không cứng số ngày.
- Hạng giải trong panel: giữ `eventTypeCode` hiện có; thành tích = `rankingStageLabel` (`points-breakdown-details.tsx:31`).
- Bỏ chọn "10 dòng/trang" (cỡ trang theo setting `public.listPageSize`; thêm biến thể = thêm cache key, YAGNI).
- Mobile 1-31 hiện 4 khoản + "Xem thêm 2 giải" → hiện đủ khoản (dữ liệu đã có trong HTML, không cần thêm bước).

## Requirements
- Chức năng: như Overview; dòng bị lọc giữ hạng gốc (như cũ); VĐV không có hồ sơ công khai → không có link hồ sơ trong panel; biến động: ▲/▼/– + số + "(trước: N)" khi có `previousRank`.
- Phi chức năng: Lighthouse `/vi/rankings/<code>` ≥ 85/90/95; axe 0; payload/HTML không phình bất thường (đo kích thước HTML trước/sau với 50 dòng).

## Architecture
```
RankingPage(listCode, ?q, ?club, ?page)
  ├ getRankingList(code[, query])   tags ranking-<code>, rankings, players, events, settings (q → none)
  ├ getRankings()                    danh sách bảng cho bộ chọn (cache chung)
  └ getSiteConfig()                  expiringSoonDays (cache chung)
  render: RankingListSwitcher, FilterForm, RankingAccordionList → RankingRowSummary + PointsBreakdownPanel, PaginationLinks
RankingsOverview → RankingTable compact tone="navy" theo nhóm
```

## Related code files
Sửa:
- `apps/client/src/app/[locale]/rankings/[listCode]/page.tsx`
- `apps/client/src/app/[locale]/rankings/page.tsx`
- `apps/client/src/components/rankings/points-breakdown-details.tsx` (tách thành panel), `ranking-list-tabs.tsx`, `ranking-top-card.tsx`, `rank-movement.tsx`, `rankings.module.css`
- `apps/client/src/i18n/vi.json`, `en.json` (`rankings.*`)
- `apps/client/tests/e2e/rankings-and-players.spec.ts`

Tạo:
- `apps/client/src/components/rankings/ranking-accordion-list.tsx`
- `apps/client/src/components/rankings/ranking-row-summary.tsx`
- `apps/client/src/components/rankings/points-breakdown-panel.tsx`
- `apps/client/src/components/rankings/ranking-list-switcher.tsx`
- `apps/client/src/components/rankings/ranking-accordion.module.css`
- `apps/client/src/lib/expiring-soon.ts` + `tests/unit/expiring-soon.test.ts`

## Implementation steps
1. `expiring-soon.ts` (ngày theo `ranking`/settings timezone đã dùng cho tuổi; 0 = false) + test.
2. Panel điểm: bảng giải/hạng giải/thành tích/điểm/hết hạn + nhãn "Sắp hết hạn" (chữ + nền vàng nhạt đạt tương phản) + hàng tổng + link hồ sơ.
3. Danh sách accordion + summary; giữ `id` neo dòng để link phân trang/tìm kiếm không đổi.
4. Bộ chọn bảng theo quy tắc ở Key insights.
5. Trang tổng quan restyle; giữ `?kind`.
6. Cập nhật e2e: các assert về `<table>` của danh sách chuyển sang `<ol>`/`<details>`; giữ ca không JS, giữ hạng gốc khi lọc, 390 không tràn.
7. Lighthouse + axe; so kích thước HTML.

## Todo
- [ ] `expiring-soon` + test
- [ ] Panel điểm + tổng + link hồ sơ
- [ ] Danh sách accordion (không link trong summary)
- [ ] Bộ chọn bảng
- [ ] Tổng quan navy
- [ ] e2e/axe/Lighthouse

## Success criteria
- `rankings-and-players.spec.ts` đạt toàn bộ (gồm không JS, phân trang giữ filter, 390); `accessibility.spec.ts` route BXH 0 vi phạm (đặc biệt `nested-interactive`, `list`).
- Lighthouse `/vi/rankings/<fixture>` ≥ 85/90/95.
- Đặt `ranking.expiringSoonDays = 0` → không còn nhãn "Sắp hết hạn".

## Risk assessment
| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Mất ngữ nghĩa bảng khi đổi sang danh sách | Trung bình × Trung bình | Nhãn cột ẩn trong từng dòng; panel vẫn là `<table>`; kiểm screen reader thủ công 1 lượt |
| Nhiều bảng làm tab tràn | Trung bình × Thấp | Quy tắc tab/select theo số bảng |
| HTML lớn (50 dòng × 20 khoản) | Thấp × Trung bình | Như hiện tại (đã có đủ breakdown trong HTML); đo trước/sau |

## Security considerations
- Không đổi phạm vi dữ liệu; nhãn giải đã bị che vẫn che (`docs/public-site.md:189`).

## Next steps
- C11. Rollback: revert commit.
