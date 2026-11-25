# Phase A5 — Tab "Nội dung thi đấu"

## Context links
- Gap: [research/admin-figma-gap.md](./research/admin-figma-gap.md) mục "1-8"
- Figma: `figma/admin/1-8.png` (cuối), `1-3…1-7.png` (biến thể căn bảng/cột)
- Code: `apps/admin/src/pages/event-hub/sub-events-tab.tsx`, `sub-event-labels.ts`, `draw-labels.ts` (`overallDrawState`), `entry-labels.ts`; API `sub-events/sub-event-items.ts:18-24`, `entries/entries-query.service.ts:58-69`

## Overview
- Ưu tiên: P3. Effort: ~3h. Trạng thái: pending. Phụ thuộc: A4.
- Bảng nội dung theo Figma: Nội dung · Thể thức (+ mô tả) · Thể thức trận (+ "N ván, ván X điểm, cách biệt Y") · Số VĐV/cặp · Hạt giống · Bốc thăm (Tag) · Thao tác.

## Key insights
- Số entry và trạng thái bốc thăm đã có endpoint (`entry-counts`, `events/:id/draws`) và cùng query key với tab Danh sách/Bốc thăm → cache dùng chung, không thêm request mới cho UI.
- Thiếu: số hạt giống (`seed != null`, CONFIRMED) → thêm `seeded` vào `entry-counts`; thông số thể thức trận → thêm `bestOf, pointsPerGame, winBy` vào `SUB_EVENT_INCLUDE.matchFormat`.
- Mô tả "8 bảng × 4 VĐV, 2 VĐV mỗi bảng đi tiếp" chỉ có sau khi bốc thăm (tham số ở Draw) → hiện khi có draw (dùng `drawSummaryText` nếu overview đủ dữ liệu), nếu không chỉ hiện tên thể thức.
- Đơn vị "VĐV"/"cặp" theo `discipline.competitorKind` (dữ liệu), không chôn danh sách nội dung.
- Giữ các cột quản trị hiện có nhưng gom: Mã, Luật vòng bảng, BXH, Tối đa chuyển vào dòng phụ/tooltip hoặc cột ẩn được — không mất thông tin.

## Requirements
- Card "N nội dung thi đấu" + nút "Thêm nội dung" (outline theo Figma; là hành động chính duy nhất của tab nên giữ `type="primary"` khi bảng rỗng).
- Cột Bốc thăm: Tag từ `OVERALL_LABELS/OVERALL_COLORS` (đã có); bấm Tag → tab Bốc thăm `?subEvent=`.
- Cột Số VĐV: `confirmed` (+ "/ maxEntries" khi có); bấm → tab Danh sách `?subEvent=`.
- Thao tác: Sửa / Xoá giữ nguyên quy tắc (xoá bị khoá khi đã công bố, tooltip hiện có).
- Ghi chú cuối bảng (Typography secondary).

## Architecture
```
SubEventsTab
 ├─ useQuery(subEventsKey)        (có sẵn)
 ├─ useQuery(entryCountsKey)      (có sẵn, thêm seeded)
 ├─ useQuery(drawsOverviewKey)    (có sẵn)
 └─ Table(columns = subEventColumns(counts, overview))
```

## Related code files
Sửa
- `apps/api/src/modules/sub-events/sub-event-items.ts` (include matchFormat thêm 3 trường)
- `apps/api/src/modules/entries/entries-query.service.ts` (`seeded`)
- `apps/api/test/sub-events.e2e-spec.ts`, `apps/api/test/entries.e2e-spec.ts` (assert trường mới)
- `apps/admin/src/pages/event-hub/sub-events-tab.tsx`
- `apps/admin/src/pages/event-hub/sub-event-labels.ts` (type + `matchFormatSummary()`)
- `apps/admin/src/pages/event-hub/entry-labels.ts` (`EntryCount.seeded`)
Tạo
- `apps/admin/src/pages/event-hub/sub-event-columns.tsx`

## Implementation steps
1. API: include + `seeded` (`groupBy` thêm điều kiện `seed: { not: null }` hoặc truy vấn đếm riêng); e2e.
2. Admin types + `matchFormatSummary()` (chuỗi dựng từ số, không hard-code "11 điểm").
3. `sub-event-columns.tsx`; `sub-events-tab.tsx` ghép.
4. typecheck/lint/build.

## Todo
- [ ] API include + seeded + e2e
- [ ] types + summary
- [ ] columns + tab
- [ ] build/test xanh

## Success criteria
- Không thêm request mạng mới khi mở tab (so network trước/sau: vẫn 3 GET).
- Số hạt giống khớp số dòng có seed trong tab Danh sách.

## Risk assessment
| Rủi ro | K × T | Giảm thiểu |
|---|---|---|
| Đổi shape `entry-counts` làm side menu cũ lỗi | Thấp × Thấp | Chỉ thêm trường |
| Bảng rộng trên mobile | TB × Thấp | `useTableScroll`, cột phụ gộp dòng |
Rollback: revert; trường API mới là bổ sung.

## Security considerations
- Không thêm route; quyền giữ nguyên.

## Next steps
- A6, A7.
