# Phase A7 — Tab "Bốc thăm": pill trạng thái, stepper quy trình, lưới bảng, cảnh báo cùng CLB, thanh hành động dính

## Context links
- Gap: [research/admin-figma-gap.md](./research/admin-figma-gap.md) mục "1-21"
- Figma: `figma/admin/1-21.png` (cuối), `1-16…1-20.png` (chọn hạt giống, chia bảng)
- Code: `apps/admin/src/pages/event-hub/draws-tab.tsx`, `draw-panel.tsx`, `draw-action-bar.tsx`, `draw-wizard.tsx`, `group-tables-view.tsx`, `group-card.tsx`, `admin-bracket-view.tsx`, `draw-summary-text.ts`, `draw-labels.ts`, `draw-types.ts:34-45` (EntryBrief có `club`); `docs/draws-and-groups.md:131`; API `draws/draw-params.service.ts:61`
- Câu hỏi mở: Q7 (tách VĐV cùng CLB khi sinh bảng)

## Overview
- Ưu tiên: P2. Effort: ~5h. Trạng thái: completed. Phụ thuộc: A4.
- Giữ nghiệp vụ bốc thăm hiện có (wizard, swap, thay/rút VĐV, công bố riêng từng loại draw); đổi bố cục theo Figma.

## Key insights
- Nhánh chính của thể thức vòng bảng chỉ sinh sau khi vòng bảng đã công bố (409 `GROUP_DRAW_NOT_PUBLISHED`) → không thể "xem trước cả hai rồi công bố một lần". Bố cục: xếp chồng khu "Vòng bảng" rồi "Vòng loại trực tiếp" (và "Vòng loại" nếu có) thay tab; khu chưa đủ điều kiện hiện trạng thái trống có lý do + nút.
- Stepper 4 bước là chỉ báo suy từ trạng thái draw của khu đang thao tác: chưa có draw → bước 1–2 (mở wizard); DRAFT → "Xem trước" (hiện tại); PUBLISHED → "Công bố" xong. Bước 1–2 vẫn trong wizard modal hiện có (đã test E2E, giữ logic `draw-wizard.tsx`).
- Cảnh báo cùng CLB: dữ liệu CLB có sẵn trong group view → hàm thuần `findSameClubGroups(groups)` (chuẩn hoá trim + không phân biệt hoa thường + bỏ dấu bằng `strip-diacritics` shared). Đây là tính trên dữ liệu một draw đã tải, không phải lọc danh sách. "Đổi chỗ" mở chế độ swap hiện có.
- Popconfirm công bố: giữ `ConfirmActionButton` (modal) — nội dung theo Figma: "VĐV và khán giả sẽ thấy bảng đấu trên trang giải. Sau khi công bố, muốn bốc thăm lại phải huỷ công bố trước."
- Pill nội dung có chấm màu theo `OVERALL_COLORS` + `aria-label` nêu trạng thái (không chỉ dựa màu).

## Requirements
- `SubEventPills` với chấm trạng thái; dòng tóm tắt phải: `drawSummaryText` (số VĐV · số bảng × cỡ · hạt giống · số đi tiếp).
- `DrawProcessSteps` (Steps 4 bước) cho khu đang chọn.
- Alert vàng "Bản xem trước chưa công bố" + (nếu có) "Lưu ý: N VĐV cùng CLB X ở chung Bảng Y · Đổi chỗ".
- Lưới thẻ bảng: 4 cột ≥ xl, 2 cột md, 1 cột xs; mỗi thẻ: tên bảng, số VĐV, hạt giống `[n]`, tên + CLB; viền + Tag "Trùng CLB" khi có.
- Nhánh: giữ `AdminBracketView` (đã có cột vòng); chỉ chỉnh khoảng cách/nhãn cột theo Figma.
- Thanh hành động dính đáy (sticky, nền trắng, viền trên) khi draw DRAFT: "Bốc thăm lại" · "Công bố" (primary). PUBLISHED: menu "…" (Bỏ công bố) như hiện tại. Không thêm nút "Quay lại" (không có bước trước thực sự; dùng pill/tab).

## Architecture
```
DrawsTab
 ├─ SubEventPills(renderStatus)
 ├─ summary line
 └─ for kind in kindsOf(subEvent): DrawSection(kind)
       ├─ DrawProcessSteps(state)
       ├─ SameClubAlert(findSameClubGroups(data.groups))
       ├─ GroupTablesView (grid) | AdminBracketView
       └─ DrawStickyActions (DrawActionBar)
```

## Related code files
Sửa
- `apps/admin/src/pages/event-hub/draws-tab.tsx` (pills, xếp chồng khu)
- `apps/admin/src/pages/event-hub/draw-panel.tsx` (steps, alert, sticky bar)
- `apps/admin/src/pages/event-hub/draw-action-bar.tsx` (bố cục, chữ xác nhận)
- `apps/admin/src/pages/event-hub/group-tables-view.tsx`, `group-card.tsx` (lưới, cờ trùng CLB)
- `apps/client/tests/admin-full-flow/draws.ts` (selector tab loại draw `getByRole('tab', { name: labels[kind] })` → heading khu)
Tạo
- `apps/admin/src/pages/event-hub/draw-process-steps.tsx`
- `apps/admin/src/pages/event-hub/same-club-groups.ts` (thuần) + `apps/admin/test/same-club-groups.test.mjs`
- `apps/admin/src/pages/event-hub/draw-sticky-actions.tsx`

## Implementation steps
1. `same-club-groups.ts` + test (CLB rỗng bỏ qua; cặp đôi: mỗi VĐV một CLB; khác hoa/thường/dấu).
2. `draw-process-steps.tsx` (input: `DrawRef | undefined`).
3. `group-card.tsx`/`group-tables-view.tsx`: lưới responsive + cờ.
4. `draw-sticky-actions.tsx` bọc `DrawActionBar`.
5. `draw-panel.tsx` ghép; `draws-tab.tsx` chuyển tab loại draw thành các khu xếp chồng + pills.
6. Cập nhật E2E `draws.ts`; typecheck/lint/build.

## Todo
- [x] same-club-groups + test
- [x] process steps
- [x] group grid + cờ
- [x] sticky actions
- [x] ghép panel/tab
- [x] E2E selector
- [x] build xanh


## Đồng bộ trạng thái 2026-11-25

Nguồn: [báo cáo triển khai](../reports/fullstack-developer-261125-phase-A7-admin-draws.md).

Đổi chỗ thành viên bảng nháp đã bổ sung sau báo cáo A7: xem `fullstack-developer-261125-draft-group-swap.md`. Checklist E2E ở đây chỉ yêu cầu cập nhật selector; lượt chạy admin-full-flow theo dõi riêng tại C11.

## Success criteria
- Vòng bảng + nhánh chính: thấy cả hai khu trên một trang; khu nhánh chính trước khi công bố vòng bảng hiện lý do, không có nút bốc thăm bấm được.
- Dữ liệu thử có 2 VĐV cùng CLB chung bảng → Alert + Tag hiện; đổi chỗ xong → mất cảnh báo.
- Swap, thay VĐV, rút khỏi bảng, công bố, bỏ công bố vẫn chạy (E2E draws).
- 390 px: thanh dính không che nội dung cuối (padding đáy bằng chiều cao thanh).

## Risk assessment
| Rủi ro | K × T | Giảm thiểu |
|---|---|---|
| Bỏ tab làm trang dài khi có vòng loại + vòng bảng + chính | TB × Thấp | Mỗi khu có tiêu đề + mục lục neo nhỏ ở đầu |
| Sticky bar che nút trong nhánh | TB × TB | padding-bottom + `position: sticky` trong vùng nội dung, không `fixed` |
| Hiểu nhầm cảnh báo CLB là luật chặn | Thấp × Thấp | Chữ "Lưu ý", không chặn công bố |
Rollback: revert; không đổi API.

## Security considerations
- Không thêm route; quyền `tournaments.update` cho thao tác như cũ.

## Next steps
- Q7: nếu BTC muốn tự tách CLB khi sinh bảng → thay đổi thuật toán `draws/*` (phase riêng, có test thuật toán).
