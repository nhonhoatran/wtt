# Phase A8 — Tab "Lịch thi đấu": toolbar ngày/buổi, tiến độ, cảnh báo và màu nội dung

## Context links
- Gap: [research/admin-figma-gap.md](./research/admin-figma-gap.md) mục "1-30"
- Figma: `figma/admin/1-30.png` (cuối, 1440 px), `1-23…1-29.png` (kéo/thả, tooltip trùng)
- Code: `apps/admin/src/pages/event-hub/schedule-tab.tsx` (166 dòng), `session-toolbar.tsx`, `session-grid.tsx`, `session-grid-cell.tsx` (155), `unscheduled-panel.tsx` (139), `schedule-actions.tsx`, `schedule-keyboard-drag.ts`, `schedule-dnd-accessibility.ts`, `schedule-types.ts`; `docs/scheduling.md:31-32,137,147-149`
- Quyết định: Q8 đã triển khai; Q9 đã chốt, triển khai riêng ở H trong plan trả nợ 2026-11-27.

## Overview
- Ưu tiên: P2. Effort: ~4h (+2h màu Q8). Trạng thái: completed (2026-11-27). Phụ thuộc: A4 (progress).
- Đổi giao diện; giữ nguyên mô hình ô (bàn × lượt), lưu ngay mỗi lần thả, kéo chuột + bàn phím.

## Key insights
- Không làm "Mỗi khung 40 phút" / cột "Khung" cố định: giờ mỗi trận do server tính theo thời lượng thể thức từng trận và trạng thái thực (`docs/scheduling.md:147-149`); khung cố định sẽ hiện giờ sai và là giá trị nghiệp vụ chôn cứng. Cột trái giữ "Lượt", giờ dự kiến hiện trong từng ô (đã có, `session-grid-cell.tsx:43`).
- Không làm nút "Lưu lịch": mỗi lần thả lưu ngay với khoá `scheduleVersion` (`docs/scheduling.md:137`); gom lưu gây mất việc khi đóng tab hoặc hai người cùng xếp. Thay bằng chữ nhỏ "Thay đổi được lưu ngay".
- "Đã xếp X/Y trận": lấy `matches.scheduled/total` từ endpoint tiến độ (A4) — cấp giải, vì trận chưa xếp không thuộc buổi nào nên "của buổi này" không có mẫu số.
- Tổng cảnh báo trùng của buổi = đếm `conflicts[]` trên dữ liệu lưới đã tải (một buổi, đã trả trọn session theo `filter[sessionId]`) → UI-only. Bấm banner → focus ô cảnh báo đầu tiên.
- "Sân chính": không có dữ liệu → dùng `displayName` bàn.
- Màu nội dung: `Discipline` không có cột màu. Quy ước dự án: màu theo loại là dữ liệu DB (`docs/code-standards.md` mục Frontend). Nếu Q8 = có → migration thêm `colorHex String?` + ô `ColorHexField` (đã có, dùng cho hạng giải) ở form nội dung chuẩn; nếu không → ô trận dùng viền trung tính + Tag mã nội dung, không chú giải màu.
- `schedule-tab.tsx` 166 dòng → tách header buổi ra file mới trước khi thêm.

## Requirements
- Toolbar: Segmented ngày "T4 11/11" (thứ theo `dayjs` locale vi) · Segmented buổi "Tên buổi HH:mm–HH:mm" · nhóm quản lý buổi (Thêm/Sửa/Xoá) chuyển vào menu "…" cạnh buổi để hàng gọn · bên phải: In phiếu trận, Xuất Excel, Làm mới trang công khai (giữ `ScheduleActions`).
- Dòng trạng thái: "Đã xếp X/Y trận" + `Progress` mảnh · Alert nhỏ "Có N trận trùng giờ cần sửa" (khi N>0) · chữ "Thay đổi được lưu ngay".
- Ô trận: dòng 1 "Nội dung · Vòng/Bảng" (chữ nhỏ), dòng 2 tên hai bên rút gọn, giờ dự kiến; tay nắm kéo (icon) có `aria-label`; ô trống "Thả trận vào đây" + icon; ô cảnh báo viền `colorError` + icon có tooltip (giữ nội dung `conflictText`).
- Panel "Trận chưa xếp lịch (N)": giữ lọc nội dung/vòng/tìm + phân trang server; thẻ theo Figma; chú thích cuối "Kéo trận vào ô trống. Kéo ra ngoài lưới để bỏ xếp." chỉ khi hành vi đó thật sự có (kiểm `use-schedule-board.ts`; nếu không có thì không ghi).
- (Q8 = có) viền trái ô + chú giải màu lấy `discipline.colorHex`, fallback `lineStrong`.

## Architecture
```
ScheduleTab
 ├─ SessionToolbar (Segmented day/session + "…" session menu) + ScheduleActions
 ├─ ScheduleStatusBar(progress from useEventProgress, conflictCount from grid data)
 ├─ SideMenuLayout
 │    ├─ SessionGrid → GridSlot (restyled)
 │    └─ UnscheduledPanel (restyled)
 └─ DndContext (unchanged sensors, keyboard drag, announcements)
```
Q8 = có: `Discipline.colorHex` → API include `subEvent.discipline.colorHex` trong `MATCH_VIEW_INCLUDE` → ô + chú giải.

## Related code files
Sửa
- `apps/admin/src/pages/event-hub/schedule-tab.tsx`
- `apps/admin/src/pages/event-hub/session-toolbar.tsx`
- `apps/admin/src/pages/event-hub/session-grid.tsx`
- `apps/admin/src/pages/event-hub/session-grid-cell.tsx`
- `apps/admin/src/pages/event-hub/unscheduled-panel.tsx`
- `apps/admin/src/pages/event-hub/schedule-types.ts` (`dayPillLabel`, `sessionRangeLabel`)
Tạo
- `apps/admin/src/pages/event-hub/schedule-status-bar.tsx`
- `apps/admin/src/pages/event-hub/session-header-menu.tsx`
- `apps/admin/src/pages/event-hub/schedule-conflict-count.ts` (thuần) + `apps/admin/test/schedule-conflict-count.test.mjs`
Chỉ khi Q8 = có
- `packages/db/prisma/schema/tournament-catalog.prisma` (`Discipline.colorHex String?`) + migration `prisma migrate dev --name add_discipline_color` (không `db push`)
- `apps/api/src/modules/disciplines/*` (DTO nhận `colorHex`, validate hex như event-types)
- `apps/api/src/modules/matches/match-view.ts` (include màu)
- `apps/admin/src/resources/disciplines/discipline-form.tsx`, `discipline-list.tsx` (ô màu)
- `apps/admin/src/pages/event-hub/schedule-color-legend.tsx` (tạo)

## Implementation steps
1. Tách `session-header-menu.tsx` + helpers nhãn; không đổi hành vi.
2. `schedule-conflict-count.ts` + test.
3. `schedule-status-bar.tsx` (progress từ A4 hook; banner trùng).
4. Restyle `session-grid-cell.tsx`, `session-grid.tsx` (cột "Lượt"), `unscheduled-panel.tsx`.
5. Kiểm lại kéo bằng bàn phím (Space nhấc, mũi tên, Space thả, Esc) và screen reader announcements — test `schedule-keyboard-drag.test.mjs` phải xanh.
6. (Q8 = có) migration `--create-only` → xem SQL → `migrate deploy` trên DB dev (in target bằng `pnpm db:print-target`, xác nhận trước) → `prisma generate` → DTO/view/form → legend.
7. typecheck/lint/test/build; E2E `schedule-and-withdraw.ts` (selector `Thêm buổi thi đấu`, `Xếp vào đây`, `Bỏ xếp trận #` phải còn).

## Todo
- [x] tách session header menu
- [x] conflict count + test
- [x] status bar
- [x] restyle grid/cell/panel
- [x] Kiểm keyboard drag + live region trên Chromium
- [x] Kiểm keyboard drag trên Firefox/WebKit (backlog L1)
- [x] Kiểm lưới 6 bàn thật ở 1280 px (backlog L2)
- [x] Q8 được chốt 2026-11-27: migration nullable + API/form/viền/chú giải; API thật 5/5, DTO 6/6, browser 390/1440 đạt 2/2 ([báo cáo](../reports/tester-261127-import-colors-runner.md))
- [x] Build và unit test đạt
- [x] E2E admin-full-flow sau redesign (backlog L4, kiểm cùng C11) — đạt 2026-11-26: desktop 8/8 một lượt, mobile 8/8 hai lượt; [báo cáo](../reports/tester-261126-1620-admin-full-flow-after-redesign.md)


## Đồng bộ trạng thái 2026-11-25

Nguồn: [báo cáo triển khai](../reports/fullstack-developer-261125-phase-A8-admin-schedule.md).

Đã kiểm kéo bàn phím và live region trên Chromium. Lượt tiếp nối [A8 browser gates](../reports/tester-261125-a8-browser-gates.md) xác nhận Chromium/Firefox/WebKit: hủy 0 PATCH, thả đúng 1 PATCH 200; lưới 6 bàn thật ở 1280 px không cuộn ngang. L1/L2 đã đóng; còn E2E tích hợp L4. Q8 màu theo nội dung là tùy chọn đang chờ quyết định, chưa tạo migration.

## Đồng bộ trạng thái 2026-11-27

Q8 đã triển khai G, migration chỉ áp DB test riêng sau xác nhận target. L3 đóng; Q9 đã được chốt và đang triển khai H trong [plan trả nợ](../261127-debt-closure/plan.md). Không coi browser component với HTTP mock là full-flow mới.

H/L5 hoàn tất sau [review backend](../reports/code-review-261127-auto-schedule-backend.md), integration/engine/classifier 21/21 và UI preview/cancel/apply trên desktop `55081e38…`/mobile `d6121820…`: mỗi lượt đủ 8 bước/60 phép kiểm làm mới, giữ lịch thủ công, cleanup sạch. Modal còn có bốn ca cancel/session/stale 409 ở 390/1440. [Báo cáo root](../reports/tester-261127-admin-full-flow-continuation.md). Giữ phạm vi checklist A8 redesign cũ; H được đóng riêng trong plan trả nợ, không đóng các gate tổng/ảnh-review C11.

## Success criteria
- Thả trận: request PATCH ngay, không có nút lưu; reload thấy đúng.
- Bàn phím: xếp 1 trận chỉ bằng phím thành công (như U3).
- Banner trùng hiện đúng số ô có `conflicts` trong buổi.
- 1280 px: 6 bàn hiển thị không cuộn ngang khi panel bên cạnh (như Figma 1440); 390 px: panel xếp dưới, cuộn trong.

## Risk assessment
| Rủi ro | K × T | Giảm thiểu |
|---|---|---|
| Restyle làm hỏng vùng thả dnd-kit (id droppable) | TB × Cao | Không đổi id/data; chạy test keyboard + E2E |
| Đổi nút buổi vào menu "…" làm E2E `Thêm buổi thi đấu` hỏng | TB × Thấp | Nút "Thêm buổi" vẫn hiện khi chưa có buổi; cập nhật selector nếu cần |
| (Q8) migration trên DB sai | Thấp × Cao | `db:print-target` + xác nhận, `--create-only` trước |
Rollback: UI revert; migration cột nullable — rollback bằng migration drop cột (không xoá tay).

## Security considerations
- Không thêm route ghi; (Q8) `colorHex` validate regex hex như `event-types`, ghi audit theo `CatalogCrudService`.

## Next steps
- Q9 tự động xếp (phase riêng nếu có).
