# Phase A3 — Danh sách giải (tab trạng thái có số đếm, chip lọc, cột theo Figma)

## Context links
- Gap: [research/admin-figma-gap.md](./research/admin-figma-gap.md) mục "1-53"
- Figma: `figma/admin/1-53.png`
- Code: `apps/admin/src/resources/events/event-list.tsx`, `event-labels.ts`, `apps/admin/src/components/list-filter-bar.tsx`, `apps/api/src/modules/events/events-query.service.ts`, `event-lifecycle-filter.ts`, `event-view.ts`, `admin-events.controller.ts`
- Câu hỏi mở: Q4 (xuất Excel danh sách giải)

## Overview
- Ưu tiên: P2. Effort: ~4h. Trạng thái: pending. Phụ thuộc: A1 (PageHeader).
- Thêm tab vòng đời có số đếm, dòng phụ số đăng ký, chip "Đang lọc" + "Đặt lại", cột Thao tác "Xem | Sửa".

## Key insights
- Tab Figma trộn 2 trục (công bố vs vòng đời) → số đếm không loại trừ nhau. Chọn tab = vòng đời: Tất cả · Sắp diễn ra · Đang diễn ra · Đã kết thúc · Đã hủy (nhãn từ `EVENT_LIFECYCLE_LABELS` shared). Công bố giữ là ô lọc; dòng nháp có Tag "Nháp".
- Tab chỉ là cách đặt `filter[lifecycle]` (đã có, `events-query.service.ts:25`) → vẫn server-side, sync URL.
- Số đếm cần endpoint đếm theo từng vòng đời với các lọc còn lại (q, year, eventTypeId, publishStatus).
- Số đăng ký mỗi giải: Prisma `_count` có điều kiện trên `subEvents.entries` không gộp được qua 2 cấp → 1 truy vấn phụ `entry.groupBy` theo `subEventId` cho các giải trong trang rồi cộng theo giải (chỉ ≤ pageSize giải).
- Nút tạo giữ "Thêm giải" (quy ước U6), không đổi thành "Tạo giải đấu".
- Không đặt mặc định lọc năm (Figma "Năm: 2027" là trạng thái mẫu) — mặc định ẩn bớt dữ liệu gây nhầm.

## Requirements
Chức năng
- `GET /admin/events/lifecycle-counts?q&filter[year]&filter[eventTypeId]&filter[publishStatus]` → `{ data: { ALL, UPCOMING, ONGOING, COMPLETED, CANCELLED } }`; quyền `tournaments.list`. Route khai báo trước `:id`.
- List trả thêm `entryCount` (entry CONFIRMED) mỗi giải.
- UI: `PageHeader` "Giải đấu" + mô tả "Quản lý tất cả giải"; nút "Thêm giải" (quyền create).
- Card lọc: tìm, Năm, Hạng giải, Công bố; nút "Đặt lại" (xoá mọi lọc, giữ sort); dòng "Đang lọc:" các chip có ×.
- Tabs trên bảng với `(n)`; đổi tab → `setFilters` lifecycle, về trang 1.
- Cột: Tên giải (link) + dòng phụ "n lượt đăng ký" · Hạng giải (Tag `colorHex`) · Thời gian · Địa điểm (tên + thành phố) · Nội dung (số) · Trạng thái (Tag vòng đời + Tag "Nháp" khi DRAFT) · Thao tác ("Xem" → `/events/:id`, "Sửa" → `/events/:id/info`, chỉ khi `tournaments.update`).
- Nút "Xuất Excel" chỉ làm khi Q4 chốt có.

Phi chức năng
- 1 request list + 1 request counts mỗi lần đổi lọc; counts không phụ thuộc tab/page/sort.
- `ListFilterBar` mở rộng tương thích ngược (props mới tuỳ chọn) — các danh sách khác không đổi hành vi.

## Architecture
```
EventList
 ├─ PageHeader
 ├─ Card: ListFilterBar(fields, showActiveChips, onReset)
 ├─ EventLifecycleTabs(counts ← useQuery(['event-lifecycle-counts', otherFilters]))
 └─ Table (useTable server mode, columns from eventListColumns())
API: list() → page rows → entryCountsByEvent(ids) → merge
     lifecycleCounts(filters) → 5 × prisma.event.count(where = base ∧ lifecycleWhere)  (hoặc 1 base + 4 count)
```

## Related code files
Sửa
- `apps/api/src/modules/events/events-query.service.ts` (gọi helper đếm, gắn `entryCount`)
- `apps/api/src/modules/events/admin-events.controller.ts` (route `lifecycle-counts`)
- `apps/api/test/events.e2e-spec.ts` (case đếm + entryCount)
- `apps/admin/src/resources/events/event-list.tsx`
- `apps/admin/src/resources/events/event-labels.ts` (`entryCount`, nhãn tab)
- `apps/admin/src/components/list-filter-bar.tsx` (chip + Đặt lại, tuỳ chọn)
Tạo
- `apps/api/src/modules/events/event-list-counts.ts` (đếm vòng đời + entry theo giải)
- `apps/admin/src/resources/events/event-list-columns.tsx`
- `apps/admin/src/resources/events/event-lifecycle-tabs.tsx`
- `apps/admin/src/components/active-filter-chips.tsx` (thuần hiển thị, dùng chung)

## Implementation steps
1. API helper `event-list-counts.ts`: tái dùng `buildListWhere`/search fields của list để base where giống hệt; `lifecycleFilter` cho từng giá trị.
2. Route + e2e (lọc năm + q ảnh hưởng counts; tab không ảnh hưởng).
3. `entryCount`: `entry.groupBy({ by: ['subEventId'], where: { status: 'CONFIRMED', subEvent: { eventId: { in: ids } } } })` + map subEvent→event (lấy từ 1 `subEvent.findMany` select id,eventId).
4. Admin: `active-filter-chips.tsx`, mở rộng `ListFilterBar` (prop `showActiveChips`, `onReset`).
5. Tabs + columns + ghép `event-list.tsx`.
6. typecheck/lint/build; api e2e events.

## Todo
- [ ] event-list-counts + route + e2e
- [ ] entryCount trong list
- [ ] chip + Đặt lại (tương thích ngược)
- [ ] tabs + columns
- [ ] build/test xanh

## Success criteria
- Tổng các tab vòng đời (trừ "Tất cả") = "Tất cả" với cùng lọc (do vòng đời loại trừ nhau) — kiểm bằng e2e.
- Đổi tab: URL có `filters[...]`, reload giữ tab.
- Các list khác dùng `ListFilterBar` (players, venues…) không đổi giao diện (so ảnh trước/sau 1 trang).

## Risk assessment
| Rủi ro | K × T | Giảm thiểu |
|---|---|---|
| Base where của counts lệch list | TB × TB | Dùng chung hàm dựng where, e2e so tổng |
| Sửa `list-filter-bar.tsx` ảnh hưởng ~15 list | TB × TB | Prop tuỳ chọn, mặc định tắt |
| Route `lifecycle-counts` bị `:id` nuốt | Thấp × Cao | Khai báo trước `@Get(':id')`, e2e |
Rollback: revert; endpoint mới không ai khác gọi.

## Security considerations
- Cùng quyền `tournaments.list`; validate query qua `parsePaginationQuery` rules như list.

## Next steps
- Q4 xuất Excel. A4 dùng `entryCount`/tiến độ ở header hub.
