---
phase: C5
title: "Danh sách giải (1-14) và lịch tháng dùng chung hàng giải"
status: pending
priority: P2
effort: 3h
depends_on: [C1, C2, C3, C4]
---

# Phase C5 — Danh sách giải và lịch tháng

## Context links
- Gap: [research/client-figma-gap.md](./research/client-figma-gap.md) mục 1-14
- Câu hỏi: Q4 (hạn đăng ký, tiền thưởng)
- Figma: `figma/client/1-14.png`
- Hiện có: `apps/client/src/app/[locale]/events/page.tsx:1-103`, `events/calendar/page.tsx`, `components/common/filter-form.tsx`, `pagination-links.tsx`

## Overview
- Ưu tiên: P2.
- Trang `/events`: breadcrumb, tiêu đề + mô tả, chip tổng số; bộ lọc GET (tìm, hạng, loại giải, năm) + pill trạng thái (link); danh sách hàng giải nhóm theo tháng; "Hiển thị a–b trong N giải" + phân trang. `/events/calendar` dùng cùng component hàng giải.

## Key insights
- Lọc/phân trang đã ở server (`events/page.tsx:38-49`, `toQuery`); giữ nguyên luồng, chỉ đổi trình bày.
- Pill trạng thái thay select "Trạng thái" (Figma có cả hai → trùng). Pill là link giữ các filter khác, bỏ `page`.
- Nhóm theo tháng làm trên mục của **trang hiện tại** (API đã sắp theo ngày, `docs/public-site.md:131`). Không hiện số "· N giải" vì tháng có thể bị cắt giữa hai trang (sẽ sai).
- Giữ ô tìm `q` và lọc loại giải dù Figma không có (tính năng thật, đã có test `event-pages.spec.ts:6`).
- Không hiện "Thưởng", "Hạn đăng ký" (không có dữ liệu, Q4). Không hiện số VĐV (chưa có trên thẻ; hoãn) → hiện số nội dung từ A1.

## Requirements
- Chức năng: hàng giải gồm khối ngày (ngày–ngày, tháng/năm theo locale), `TierBadge filled`, tên loại giải, tên, địa điểm, `SubEventChips`, "N nội dung", `StatusPill`, CTA theo trạng thái (đang diễn ra → "Xem lịch & kết quả" tới tab trận; khác → "Xem chi tiết"). Cả hàng không là một link lớn (tránh link lồng); tên giải là link chính.
- Phi chức năng: hoạt động khi tắt JS; mobile 390: hàng xếp dọc, khối ngày thu nhỏ; axe 0.

## Architecture
```
EventsPage(searchParams) ─toQuery─> getEventList (tags events, settings; q → policy none)
   └ groupEventsByMonth(items, locale) ─> [{ monthKey, label, items }]
       └ EventListRow × n
CalendarPage ─getEventCalendar─> months[] ─> EventListRow × n (cùng component)
```

## Related code files
Sửa:
- `apps/client/src/app/[locale]/events/page.tsx`
- `apps/client/src/app/[locale]/events/calendar/page.tsx`
- `apps/client/src/components/common/filter-form.tsx`, `filter-form.module.css` (kiểu Figma; nhãn trên ô)
- `apps/client/src/components/common/pagination-links.tsx`, `.module.css` (dòng "Hiển thị a–b trong N")
- `apps/client/src/i18n/vi.json`, `en.json` (`events.*`, `common.showingRange`)
- `apps/client/tests/e2e/event-pages.spec.ts` (selector danh sách)

Tạo:
- `apps/client/src/components/events/event-list-row.tsx` + `.module.css`
- `apps/client/src/components/events/event-status-pills.tsx`
- `apps/client/src/lib/group-events-by-month.ts`, `apps/client/tests/unit/group-events-by-month.test.ts`

## Implementation steps
1. `group-events-by-month.ts`: key `YYYY-MM` từ `startDate` (chuỗi ngày theo lịch của giải, không đổi múi giờ); nhãn tháng bằng `Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })`. Test: giải vắt qua 2 tháng nằm ở tháng bắt đầu; thứ tự giữ như API.
2. `EventStatusPills`: "Tất cả" + 3 trạng thái từ `PUBLIC_EVENT_STATUSES`; href giữ `q`, `tier`, `type`, `year`; `aria-current` cho mục đang chọn.
3. `FilterForm` trên trang: bỏ field `status`, thêm `keep={{ status }}` khi có để submit filter khác không mất trạng thái.
4. `EventListRow`: như Requirements; khối ngày navy dùng `data` token.
5. Tiêu đề trang + chip tổng ("N giải" theo filter hiện tại, không gắn chữ "năm 2027" cứng: dùng năm đang lọc nếu có).
6. `PaginationLinks`: thêm dòng phạm vi; giữ link thật.
7. Lịch tháng: thay thẻ bằng `EventListRow`; link "Xem theo lịch tháng" ↔ "Xem danh sách" giữa hai trang.
8. Cập nhật test, chạy kiểm.

## Todo
- [ ] `group-events-by-month` + test
- [ ] Pill trạng thái + filter giữ trạng thái
- [ ] `EventListRow`
- [ ] Phạm vi phân trang
- [ ] Lịch tháng dùng hàng mới
- [ ] Test + axe route danh sách

## Success criteria
- `event-pages.spec.ts` (danh sách: filter rác vẫn render), `site-chrome-and-seo.spec.ts` (calendar canonical năm, mobile 390) đạt; thêm `/events` vào danh sách axe ở C11 (hoặc ngay phase này).
- JS tắt: đổi trạng thái/phân trang hoạt động (kiểm bằng context `javaScriptEnabled: false`).
- Không có chuỗi "Thưởng"/"Hạn đăng ký" trong UI.

## Risk assessment
| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Nhãn tháng sai múi giờ | Thấp × Trung bình | Dùng chuỗi `YYYY-MM-DD` của API, tạo `Date` UTC chỉ để format |
| Người dùng tìm theo trạng thái bằng select quen thuộc | Thấp × Thấp | Pill nhìn thấy ngay, ít bước hơn |

## Security considerations
- Không thêm tham số mới; mọi tham số vẫn qua `toQuery`.

## Next steps
- C6. Rollback: revert commit.
