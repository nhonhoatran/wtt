---
phase: C7
title: "Nhánh đấu (1-24, mobile 1-34) và bảng đấu"
status: in-progress
priority: P1
effort: 5h
depends_on: [C1, C2, C6]
---

# Phase C7 — Nhánh đấu và bảng đấu

## Context links
- Gap: [research/client-figma-gap.md](./research/client-figma-gap.md) mục 1-24
- Figma: `figma/client/1-24.png` (chốt), `1-21..1-23.png`, `1-34.png` (mobile)
- Hiện có: `app/[locale]/events/[slug]/draws/[subEventCode]/page.tsx:1-67`, `components/bracket/*` (`bracket.module.css` 219 dòng — vượt 200), `components/groups/group-standings.tsx`
- In: `docs/public-site.md` mục "In ấn", `apps/client/tests/offline/README.md`

## Overview
- Ưu tiên: P1 (route có Lighthouse + axe gate; in PDF có test).
- Ô trận mới: hạt giống, tên, CLB, điểm từng ván, tổng ván, "Bàn · giờ" (A2), `StatusPill`, link "Chi tiết" tới trang trận. Tiêu đề vòng có ngày. Cột "Vô địch". Chú thích trạng thái. Link sang tab Bảng đấu khi nội dung có vòng bảng.
- Mobile (≤ 640px): chip vòng; mỗi lần hiện một vòng; mỗi ô có "Thắng → <trận kế>".

## Key insights
- Ô nhánh hiện **không có link** tới trang trận (`bracket-match-cell.tsx:41-57`) → thêm link cho trận không BYE.
- Chọn vòng mobile bằng `?round=N` server-side: dữ liệu nhánh không đổi (cùng `getBracket`, cùng cache), chỉ đặt `data-selected` cho cột; CSS ≤ 640px ẩn cột khác. Desktop và in luôn hiện đủ. Không JS, không nhân đôi DOM. Mặc định = vòng đầu tiên còn trận chưa OFFICIAL, hết thì vòng cuối. `round` không vào canonical (metadata giữ `?draw=` như cũ, `draws/.../page.tsx:33-34`).
- Suy dữ liệu (thuần, unit test, dùng lại ở C8): ngày vòng = min `scheduledAt` theo múi giờ giải; trận kế = trận ở vòng sau có `side?Source = { WINNER_OF: matchNo }`; nhà vô địch = người thắng trận vòng cuối (một section).
- Figma đặt vòng bảng dưới nhánh → giữ tab Bảng đấu riêng (không lặp dữ liệu, tag `groups-*` riêng), chỉ thêm link; restyle bảng xếp hạng bảng theo Figma (đầu navy, vạch đánh dấu suất đi tiếp + chú thích chữ).
- Ô "Tìm VĐV trong nhánh": hoãn (YAGNI; desktop có tìm của trình duyệt).
- Ô cao hơn → số tờ in có thể đổi; `print-bracket-pages.ts` chia theo số vòng nên cần kiểm lại PDF.

## Requirements
- Chức năng: như Overview; nhánh chỉ có một vòng/section vẫn đúng; BYE không link, hiện "Miễn đấu"; placeholder "Thắng Tứ kết 3" từ `sideSourceLabel` như cũ.
- Phi chức năng: axe 0 (link trong ô có `aria-label` "Trận N: A – B"); không tràn ngang 390 (cuộn nằm trong `ScrollRegion` desktop); `test:print` đạt; `bracket.module.css` tách < 200 dòng.

## Architecture
```
DrawPage(params, searchParams.draw, searchParams.round)
  └ getBracket(slug, code, kind)            tags draw-<slug>-<code> (đã có)
      └ lib/bracket-derivations.ts: roundDates, nextMatchByNo, champion, defaultRound
          └ BracketBoard(selectedRound)
               ├ BracketRoundChips (mobile; link ?draw=…&round=N, aria-current)
               ├ BracketLegend
               ├ BracketRoundColumn(date, data-selected) → BracketMatchCell(link, table, games, next)
               └ BracketChampion
GroupsPage → GroupStandings (restyle) + MatchCard (C6)
```

## Related code files
Sửa:
- `apps/client/src/app/[locale]/events/[slug]/draws/[subEventCode]/page.tsx`
- `apps/client/src/components/bracket/bracket-board.tsx`, `bracket-round-column.tsx`, `bracket-match-cell.tsx`, `bracket.module.css` (tách)
- `apps/client/src/app/[locale]/events/[slug]/groups/[subEventCode]/page.tsx`
- `apps/client/src/components/groups/group-standings.tsx`, `group-standings.module.css`
- `apps/client/src/i18n/vi.json`, `en.json` (`bracket.*`, `groups.*`)
- `apps/client/tests/e2e/event-pages.spec.ts` (draws/groups), `site-chrome-and-seo.spec.ts` (in)
- `apps/client/tests/offline/bracket-print.test.ts` (nếu selector/ô đổi)

Tạo:
- `apps/client/src/lib/bracket-derivations.ts`, `apps/client/tests/unit/bracket-derivations.test.ts`
- `apps/client/src/components/bracket/bracket-round-chips.tsx`, `bracket-legend.tsx`, `bracket-champion.tsx`
- `apps/client/src/components/bracket/bracket-cell.module.css`, `bracket-mobile.module.css`

## Implementation steps
1. `bracket-derivations.ts` + test (nhánh 8, 64; vòng loại; section > 1; trận chưa xếp giờ; BYE).
2. Trang nhánh: đọc `round` (số nguyên trong tập vòng của section đầu; sai → mặc định), truyền xuống.
3. Ô trận: CLB hiện chữ (không chỉ `title`), điểm từng ván (`games`), bàn·giờ, pill, link; tên VĐV vẫn link hồ sơ nên link trận đặt ở dòng chân ô ("Chi tiết") để không lồng link.
4. Cột vòng: tiêu đề "Tứ kết · 14/03"; cột "Vô địch" cuối hàng.
5. Mobile CSS: ≤ 640px cột rộng 100%, ẩn cột không `data-selected`; chip vòng hiện "Vòng · ngày"; dòng tóm tắt "N trận · M đã có kết quả".
6. `@media print`: luôn hiện mọi cột, ẩn chip/legend/link chi tiết.
7. Link "Xem vòng bảng" khi `subEvent.hasGroups`; restyle `GroupStandings` (giữ `<table>`, `caption`, `scope`).
8. Chạy `test:print`, e2e, axe, Lighthouse; mở ảnh PDF và ảnh 390.

## Todo
- [x] Hàm suy dữ liệu + test
- [x] Ô trận mới + link
- [x] Ngày vòng + cột vô địch + chú thích
- [x] Chọn vòng mobile `?round`
- [x] CSS in giữ nguyên hành vi
- [x] Bảng đấu restyle + link
- [x] Tách CSS < 200 dòng
- [x] Test in, e2e và axe đạt (báo cáo C11)
- [x] Lighthouse production (lượt cuối C11: nhánh 100/100/100)
- [ ] Mở kiểm đầy đủ ảnh/PDF theo C11


## Đồng bộ trạng thái 2026-11-25

Nguồn: [báo cáo triển khai](../reports/fullstack-developer-261125-phase-C7-bracket-groups.md). Kiểm tích hợp sau các phase: [báo cáo C11](../reports/fullstack-developer-261125-phase-C11-client-gates.md).

Playwright/axe và test in đã đạt ở C11; Lighthouse production cuối nhánh 100/100/100, `runtimeError=null`. Đã lưu ảnh và đối chiếu một số ảnh chính; vẫn giữ mục mở kiểm đầy đủ ảnh/PDF.

## Success criteria
- `pnpm --filter @kamito/client test:print` đạt (8 PDF, đủ trận/tên, ngữ cảnh mỗi trang); ảnh PDF đã mở kiểm.
- `event-pages.spec.ts` (draws, groups, 404 draw nháp, redirect index), `site-chrome-and-seo.spec.ts` (in nhánh, 390), `accessibility.spec.ts` route nhánh đạt.
- Lighthouse `/vi/events/<fixture>/draws/MS` ≥ 85/90/95.
- Mobile 390: `?round=2` chỉ hiện vòng 2; không JS vẫn đổi vòng; desktop không bị ảnh hưởng bởi `round`.

## Risk assessment
| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Ô cao làm nhánh 64/128 dài, DOM nặng (LH) | Trung bình × Trung bình | Không nhân đôi markup; điểm từng ván chỉ khi có; đo Lighthouse |
| In PDF tăng số tờ | Trung bình × Trung bình | Kiểu in riêng gọn (ẩn ván/link), chạy `test:print` |
| `round` tạo URL trùng nội dung | Thấp × Thấp | Canonical bỏ `round` |

## Security considerations
- `round` chỉ nhận số trong tập vòng của payload; không đưa vào API.

## Next steps
- C8 dùng `bracket-derivations.ts`. Rollback: revert commit.
