# Phase A2 — Trang "Tổng quan" (dashboard)

## Context links
- Gap: [research/admin-figma-gap.md](./research/admin-figma-gap.md) mục "1-57"
- Figma: `figma/admin/1-57.png` (cuối), `1-55.png`, `1-56.png`
- Code: `apps/admin/src/pages/role-home-page.tsx`, `apps/api/src/modules/events/event-lifecycle-filter.ts`, `apps/api/src/modules/matches/match-query.service.ts`, `apps/api/src/modules/audit-logs/admin-audit-logs.controller.ts`, `packages/shared/src/app-setting-definition.ts`, `packages/shared/src/app-setting-registry.ts`
- Câu hỏi mở: Q1 (chuông), Q11 (câu hoạt động có tên đối tượng)

## Overview
- Ưu tiên: P2. Effort: ~6h (API 3h, UI 3h). Trạng thái: completed. Phụ thuộc: A1.
- ADMIN vào "/" thấy: KPI hôm nay, giải đang diễn ra + tiến độ trận, bảng trận chờ kết quả hôm nay (phân trang server), thao tác nhanh, hoạt động gần đây. RESULTS_OPERATOR vẫn vào thẳng Nhập tỷ số.

## Key insights
- Không có endpoint liên giải cho trận; `GET /admin/events/:id/matches` theo từng giải. Cần module đọc mới `dashboard`.
- "Hôm nay" phải tính theo múi giờ của từng giải (giống `lifecycleFilter`, `event-lifecycle-filter.ts:22-33`): trận thuộc session có `date = todayInTimezone(event.timezone)`.
- Trạng thái hiển thị suy ra, không lưu: `LIVE` → "Đang đấu"; `SCHEDULED` và `scheduledAt < now` → "Chờ kết quả"; `SCHEDULED` tương lai → "Sắp đấu". Bỏ trận `BYE` (giống `NOT_BYE`, `match-query.service.ts:33`).
- "Cần xử lý" = số trận "Chờ kết quả" (quá giờ) > 0 — không ngưỡng cứng.
- Số giải ở card và số dòng hoạt động là tham số vận hành → setting mới; page size bảng trận dùng `list.defaultPageSize` sẵn có.
- Hoạt động: dùng `GET /admin/audit-logs?pageSize=N&sort=createdAt:desc`; chỉ gọi khi có quyền `audit-logs.list`. Hiện "người · hành động · giờ", không có tên đối tượng (Q11).

## Requirements
Chức năng
- `GET /admin/dashboard/summary` (quyền `tournaments.list`): `{ liveEvents: number, pendingToday: number, overdueToday: number, finishedToday: number, activePlayers: number, events: [{ id, name, eventType{name,colorHex,tier.colorHex}, startDate, endDate, venue{name,city}, matches{ total, official } }] }` — `events` giới hạn bởi setting `dashboard.liveEventLimit`, sắp theo `startDate asc`.
- `GET /admin/dashboard/pending-matches?page&pageSize` (quyền `matches.list`): trận hôm nay của giải ONGOING, `status in (SCHEDULED, LIVE)`, sắp `scheduledAt asc, matchNo asc`; mỗi dòng: `id, eventId, eventName, scheduledAt, timezone, table{code,displayName}, subEvent{code,name}, round{code,name}, side1/side2 {displayName, players[]}, status`. Phân trang bằng `prismaListQuery`.
- `activePlayers` = số VĐV khác nhau trong entry CONFIRMED của giải ONGOING (đếm qua competitor → player/pair players).
- Setting mới (nhóm "Tổng quan"): `dashboard.liveEventLimit` (mặc định 5, 1–20), `dashboard.recentActivityLimit` (mặc định 6, 0–20; 0 = ẩn khối).
- UI: `PageHeader` "Tổng quan" + "Thứ x, dd/mm/yyyy · Hôm nay có N giải đang diễn ra"; nút "Nhập kết quả" (→ `/results`), "Thêm giải" (→ `/events/create`, chỉ khi `tournaments.create`).
- 4 `StatCard`. Card giải: tên, Tag hạng giải, ngày, địa điểm, `Progress` official/total, nút "Vào giải" → `/events/:id`; link phụ "Lịch" → `/events/:id/schedule`, "Nhập Excel" → `/events/:id/entries`.
- Bảng trận: Giờ/Bàn · Giải (khi >1 giải) · Nội dung · Vòng · Hai bên · Trạng thái · nút "Nhập" → `/results?event=<id>&match=<id>` (deep link do A9 xử lý; trước A9 chỉ mở `/results`).
- Thao tác nhanh: chỉ các việc không cần chọn giải (Thêm giải, Nhập kết quả, Lịch sử import, Bảng xếp hạng), lọc theo quyền.
- Trạng thái rỗng có hướng dẫn ("Hôm nay chưa có trận nào" + link Lịch).

Phi chức năng
- Mỗi endpoint ≤ 4 truy vấn, dùng `count`/`groupBy`; không tải toàn bộ trận.
- Tự làm mới khi quay lại tab (react-query `refetchOnWindowFocus`), không polling.

## Architecture
```
DashboardPage
 ├─ useQuery(['dashboard-summary'])  → GET /admin/dashboard/summary
 │    ├─ DashboardStatRow (4 StatCard)
 │    └─ LiveEventsCard (list + Progress)
 ├─ PendingMatchesTable  → useTable / useQuery(page) → GET /admin/dashboard/pending-matches
 ├─ QuickActionsCard (menu permissions)
 └─ RecentActivityCard → GET /admin/audit-logs (khi có quyền)
API: DashboardModule
 ├─ AdminDashboardController (2 GET)
 ├─ DashboardSummaryService ── todayWindow(timezones) ── prisma count/groupBy
 └─ DashboardPendingMatchesService ── prismaListQuery(match, where = ongoing ∧ today ∧ open ∧ notBye)
```
Data flow: Event.timezone (distinct) → `todayInTimezone` → where OR theo từng múi giờ → count/list → JSON → card/bảng.

## Related code files
Tạo (API)
- `apps/api/src/modules/dashboard/dashboard.module.ts`
- `apps/api/src/modules/dashboard/admin-dashboard.controller.ts`
- `apps/api/src/modules/dashboard/dashboard-today-window.ts` (thuần: timezones + now → where)
- `apps/api/src/modules/dashboard/dashboard-summary.service.ts`
- `apps/api/src/modules/dashboard/dashboard-pending-matches.service.ts`
- `apps/api/src/modules/dashboard/dashboard-today-window.test.ts`
- `apps/api/test/admin-dashboard.e2e-spec.ts`
Sửa (API/shared)
- `apps/api/src/app.module.ts` (đăng ký module)
- `packages/shared/src/dashboard-settings.ts` (tạo), `packages/shared/src/app-setting-registry.ts`, `packages/shared/src/app-setting-definition.ts` (`APP_SETTING_GROUPS` thêm nhóm), `packages/shared/src/index.ts`
- `docs/auth-and-rbac.md` (bảng setting) — cập nhật ở bước docs
Tạo (admin)
- `apps/admin/src/pages/dashboard/dashboard-page.tsx`
- `apps/admin/src/pages/dashboard/dashboard-types.ts`
- `apps/admin/src/pages/dashboard/live-events-card.tsx`
- `apps/admin/src/pages/dashboard/pending-matches-table.tsx`
- `apps/admin/src/pages/dashboard/quick-actions-card.tsx`
- `apps/admin/src/pages/dashboard/recent-activity-card.tsx`
- `apps/admin/src/pages/dashboard/pending-match-status.ts` (thuần) + `apps/admin/test/pending-match-status.test.mjs`
Sửa (admin)
- `apps/admin/src/pages/role-home-page.tsx` (ADMIN → `DashboardPage`)
- `apps/admin/src/resources/audit-logs/audit-log-labels.ts` (thêm nhãn `event.*`, `draw.*`, `match.*`, `entry.*`, `import.*`, `ranking.*`, `schedule.update`, `player.*`)

## Implementation steps
1. Shared: định nghĩa 2 setting bằng `defineNumberSetting`, thêm nhóm, đăng ký registry; `pnpm --filter @kamito/shared test`.
2. `dashboard-today-window.ts` + unit test (2 múi giờ, quanh nửa đêm).
3. Summary service: đếm ONGOING (dùng lại `lifecycleFilter`), count trận theo trạng thái trong cửa sổ hôm nay, groupBy `eventId` cho tiến độ, đếm VĐV distinct (`$queryRaw` có tham số hoặc 2 truy vấn `findMany distinct`).
4. Pending service: `prismaListQuery` với where cố định, include tối thiểu (dùng lại `MATCH_VIEW_INCLUDE` nếu đủ).
5. Controller + module + `app.module.ts`; e2e: quyền (ADMIN 200, OPERATOR 200 với pending/403 nếu thiếu quyền summary theo ma trận), số đếm đúng trên dữ liệu seed, phân trang.
6. Admin: types + `pending-match-status.ts` + test.
7. Các card/bảng; `DashboardPage` ghép; `role-home-page.tsx` chuyển ADMIN sang dashboard.
8. Bổ sung nhãn audit.
9. `pnpm --filter @kamito/api test` (dừng dev worker trước), admin typecheck/lint/test/build.

## Todo
- [x] Setting + nhóm "Tổng quan"
- [x] today-window + test
- [x] summary service
- [x] pending-matches service
- [x] controller/module/e2e
- [x] UI 5 khối + status helper + test
- [x] nhãn audit
- [x] build/test xanh


## Đồng bộ trạng thái 2026-11-25

Nguồn: [báo cáo triển khai](../reports/fullstack-developer-261125-phase-A2-admin-dashboard.md).

## Success criteria
- Với dữ liệu seed có 1 giải ONGOING hôm nay: KPI khớp truy vấn SQL kiểm tay (ghi số vào báo cáo).
- Bảng trận đổi trang gọi API với `page` mới (thấy trong network), không tải hết.
- Đổi `dashboard.liveEventLimit` trên `/settings` → số card đổi sau reload, không deploy.
- OPERATOR vào "/" vẫn là Nhập tỷ số; ADMIN thấy dashboard; không quyền audit thì không gọi `/admin/audit-logs`.

## Risk assessment
| Rủi ro | K × T | Giảm thiểu |
|---|---|---|
| Sai "hôm nay" do múi giờ | TB × Cao | Hàm thuần + test quanh nửa đêm; dùng `todayInTimezone` sẵn có |
| Đếm VĐV distinct chậm khi dữ liệu lớn | Thấp × TB | Chỉ trong giải ONGOING; index có sẵn `entry.subEventId`; đo `EXPLAIN` trên DB dev |
| Nhãn audit thiếu → hiện mã thô | Cao × Thấp | Fallback mã thô đã có; liệt kê đủ mã từ grep |
Rollback: gỡ import module ở `app.module.ts` + trả `role-home-page.tsx`; setting thừa vô hại.

## Security considerations
- `@RequirePermission` trên cả 2 route; không trả email/IP. Audit log vẫn đi qua endpoint có quyền riêng.
- Không route ghi mới → không cần tag revalidate.

## Next steps
- A9 xử lý `?event=&match=`. Q1/Q11 chốt rồi mới làm chuông/câu hoạt động chi tiết.
