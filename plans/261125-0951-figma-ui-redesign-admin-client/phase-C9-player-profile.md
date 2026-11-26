---
phase: C9
title: "Hồ sơ vận động viên (1-19)"
status: completed
priority: P2
effort: 3h
depends_on: [C1, C2, C6]
---

# Phase C9 — Hồ sơ VĐV

## Context links
- Gap: [research/client-figma-gap.md](./research/client-figma-gap.md) mục 1-19
- Câu hỏi: Q7 (cầm vợt, lối đánh), Q8 (trận sắp tới, thành tích theo giải, thành tích nổi bật)
- Figma: `figma/client/1-19.png` (chốt), `1-16..1-18.png`
- Hiện có: `app/[locale]/players/[slug]/page.tsx:1-69`, `components/players/player-hero.tsx`, `player-results-list.tsx`, `player-current-ranks.tsx`
- Riêng tư: `docs/public-site.md:190-191`

## Overview
- Ưu tiên: P2.
- Hero tối: ảnh/avatar, "VĐV · <bảng chính>", tên, CLB, các fact có dữ liệu (tay thuận, tuổi khi `showAge`), ô thống kê (hạng, điểm của bảng đầu tiên; thắng–thua A7), nút "Xem trên bảng xếp hạng". Thân: "Kết quả gần đây" dạng bảng (phân trang server như cũ), "Hạng hiện tại" các bảng, "Giải đã tham dự".

## Key insights
- **Năm sinh không hiện** dù Figma có: serializer chủ ý không trả ngày/năm sinh; chỉ tuổi khi `player.showAge` bật. Đây là luật riêng tư, ưu tiên hơn Figma.
- Thắng–thua (A7) tính trên đúng tập trận của mục Kết quả → số khớp với bảng; không gắn "mùa 2027" vì chưa có định nghĩa mùa.
- Bảng kết quả: xác định bên của VĐV bằng so `slug` của người chơi trong `side1/side2` với slug hồ sơ (cùng dạng `p-<UUID>`). Cột Thắng/Thua có chữ, không chỉ màu.
- Bỏ "Phong độ 10 trận" (lặp bảng kết quả). "Trận sắp tới", thành tích theo giải, "Thành tích nổi bật" hoãn (Q8; trận sắp tới cần thêm tag `player-*` cho `schedule.update`).
- "Xem trên BXH": link `/rankings/<code>?q=<tên>` sẽ tắt cache + vào bucket search → dùng link bảng không query (`/rankings/<code>`) kèm hạng đã hiện trong hero.
- `noindex`, metadata, redirect 301 giữ nguyên (`page.tsx:22-45`).

## Requirements
- Chức năng: như Overview; hồ sơ không ảnh → `InitialsAvatar`; không có hạng → ô thống kê chỉ hiện thắng–thua; không có kết quả → empty state hiện có.
- Phi chức năng: axe 0; 390: bảng kết quả trong `ScrollRegion` hoặc xếp thẻ; Lighthouse không bắt buộc (không nằm trong 4 route gate) nhưng chạy tham khảo.

## Architecture
```
PlayerPage
  ├ getPlayerProfile(slug)  tags player-<slug>, players, rankings, events, settings (+ record A7)
  └ getPlayerResults(slug, ?page)  tags player-<slug>, players, events, settings (matchday)
  render: PlayerHero(stats), PlayerResultsTable, PlayerCurrentRanks, PlayerEventsTable
```

## Related code files
Sửa:
- `apps/client/src/app/[locale]/players/[slug]/page.tsx`
- `apps/client/src/components/players/player-hero.tsx`, `players.module.css`
- `apps/client/src/components/players/player-results-list.tsx` (dùng bảng mới)
- `apps/client/src/components/players/player-current-ranks.tsx`
- `apps/client/src/i18n/vi.json`, `en.json` (`players.profile.*`)
- `apps/client/tests/e2e/rankings-and-players.spec.ts`

Tạo:
- `apps/client/src/components/players/player-hero-stats.tsx`
- `apps/client/src/components/players/player-results-table.tsx`
- `apps/client/src/components/players/player-results.module.css` (giữ `players.module.css` < 200 dòng)
- `apps/client/src/lib/player-match-perspective.ts` (bên của VĐV, đối thủ, thắng/thua) + `tests/unit/player-match-perspective.test.ts`

## Implementation steps
1. `player-match-perspective.ts` + test (đơn, đôi, VĐV ở side2, walkover).
2. Hero + stats; nút BXH khi có `ranks[0]`.
3. Bảng kết quả: ngày (múi giờ giải), giải · vòng (link giải), đối thủ, tỉ số + điểm từng ván, Thắng/Thua, link trận; phân trang giữ `#results`.
4. Giải đã tham dự: bảng tên + ngày (dữ liệu hiện có).
5. Cập nhật e2e (hồ sơ ẩn 404, redirect, noindex, empty state vẫn đạt).

## Todo
- [x] Hàm góc nhìn VĐV + test
- [x] Hero + thống kê
- [x] Bảng kết quả
- [x] Bảng giải đã tham dự
- [x] e2e + axe hồ sơ


## Đồng bộ trạng thái 2026-11-25

Nguồn: [báo cáo triển khai](../reports/fullstack-developer-261125-phase-C9-player-profile.md). Kiểm tích hợp sau các phase: [báo cáo C11](../reports/fullstack-developer-261125-phase-C11-client-gates.md).

Playwright/axe tích hợp đã đạt ở C11. Build production cuối được theo dõi tại C11; các nhánh dữ liệu chưa thấy trên trình duyệt vẫn giữ giới hạn của báo cáo triển khai.

## Success criteria
- `rankings-and-players.spec.ts` (hồ sơ ẩn 404, 301, noindex, empty state, 390) và `accessibility.spec.ts` route hồ sơ đạt.
- HTML hồ sơ không chứa năm/ngày sinh (test hiện có về tên thật vẫn đạt; thêm assert không có chuỗi "Năm sinh"/"Born").
- Số thắng + thua = tổng mục kết quả không void (kiểm trên fixture).

## Risk assessment
| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Xác định sai bên khi VĐV có slug cũ | Thấp × Trung bình | So theo slug chuẩn trả về từ API; test |
| Người xem mong đợi năm sinh như Figma | Trung bình × Thấp | Luật riêng tư; ghi trong gap |

## Security considerations
- Không thêm trường cá nhân; dữ liệu hồ sơ ẩn vẫn 404.

## Next steps
- C10. Rollback: revert commit.
