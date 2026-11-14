# UI verify — phase 06 (admin: tab Bốc thăm, wizard, nhánh, vòng bảng, hộp thoại)

Checker: agent riêng (không viết trang nào), chỉ đọc, không render. Checklist: `ui/phase-06-ui-checklists.md` mục A–E + `ui/phase-06-ui-plan.md`. Bound: `apps/admin/src`. Đọc lúc 15:06–15:14 (2026-11-14). Đây là vòng kiểm lại trên code hiện tại; vòng 2026-11-13 đã qua task 2–6.
File đổi trong lúc kiểm (agent khác): `draw-entry-action-modal.tsx` lúc 15:09:34. Chỉ đổi cách tính `taken` (chỉ tính khi thao tác trên ô nhánh, `:39-40`), không đổi giao diện. Đã đọc lại.

## Hiệu chỉnh
- Task 0 phase 06 (đang `parked`) nay được phủ bởi hiệu chỉnh task 0 phase 07, cùng work, cùng kind (chi tiết: `ui-verifier-261114-phase-07.md`).
- Bản sao `draws-tab.tsx` cài lỗi tải bằng `Alert`, kiểm theo mục A phase 06: bắt được (high).
- Bản sao `draw-entry-action-modal.tsx` cài ô lý do không bắt buộc, kiểm theo mục D: bắt được (high).
- Kết quả kiểm task 2–6 của vòng 2026-11-13 nay coi là đã hiệu chỉnh cho kind hub tab + modal.
- **Chưa hiệu chỉnh**: nhánh đấu C (`admin-bracket-view`, `bracket-cell`) và vòng bảng E (`group-*`) — không có tham chiếu cùng loại.

## Theo trang (chỉ dòng KHÁC; dòng không nêu = pass)

### A. `draws-tab.tsx`, `draw-panel.tsx`, `draw-action-bar.tsx`, `sub-event-side-menu.tsx` — không khác
(Hàng tiêu đề dùng `Space`, "Bốc lại" mở wizard rồi xác nhận ở bước cuối: đã chấp nhận vòng 2026-11-13, không báo lại.)

### B. `draw-wizard.tsx`, `draw-params-step.tsx`, `draw-seeds-step.tsx`
- Độ rộng cột literal (thấp): `Table.Column title="Hạt giống" width={120}` (`draw-seeds-step.tsx:50`). Dòng "độ rộng cố định = hằng số UPPER_CASE".
  - Trong bound, cột bảng có width đều viết literal (4 chỗ: thêm `group-card.tsx:68`, `import-preview-table.tsx:89`, `results-entry-page.tsx:138`), nên với cột bảng họ chưa có quy ước hằng số.
  - Báo theo dòng checklist, không theo họ.
- Ghi chú: `groupSize` nay `min={MIN_GROUP_SIZE}` (`draw-params-step.tsx:55`). Ghi chú của vòng 2026-11-13 đã đóng.

### C. `admin-bracket-view.tsx`, `bracket-cell.tsx`, `round-format-select.tsx` (chưa hiệu chỉnh) — không khác
- Viền ô trận viết `1px solid ${token.colorBorder}` (`admin-bracket-view.tsx:73`). Trong bound không có quy ước cho độ dày viền: 2 file dùng `token.lineWidth`/`lineType`, 2 file viết `1px solid`. Không báo là lệch.

### D. `draw-entry-action-modal.tsx`, `manual-tiebreak-modal.tsx` — không khác
- Mỹ quan (thấp): dòng trống kép `draw-entry-action-modal.tsx:14-15`.

### E. `group-tables-view.tsx`, `group-card.tsx`, `group-schedule.tsx` (chưa hiệu chỉnh)
- Độ rộng cột literal (thấp): `title="Hạng" width={56}` (`group-card.tsx:68`). Như mục B.
- Mỹ quan (thấp): con của `<Flex vertical>` không thụt lề (`group-card.tsx:53-83`).

## Cả bộ (so cùng nhau)
- 4 view chính đều tải/lỗi bằng `Skeleton` / `Result … Thử lại`: tab, panel, wizard (bước), nhánh/bảng.
- 3 hộp thoại phase 06 đều `width={640}` + `destroyOnHidden` + "Lý do" bắt buộc cùng chữ.
- Ô chọn 2-click: `bracket-cell.tsx` và (phase 07) `session-grid-cell.tsx` / `unscheduled-panel.tsx` cùng `Button type="text" block aria-pressed` + `colorPrimaryBg`/`colorPrimary`.
- 409: draws qua `useDrawCall` (toast + tải lại); phase 07 lịch cũng toast + tải lại; nhập tỷ số dùng `MatchProblemAlert` (theo checklist F phase 07).

## Đúng, nhưng không thuộc task này
- (Do agent hiệu chỉnh nêu, trên code thật ngoài chỗ cài) drawer nhập tỷ số ghi "Tải lại" ở lỗi tải — xem báo cáo phase 07.

## Chưa kiểm được
- Không render: cuộn ngang nhánh nhiều vòng, cỡ card bảng (480) trên màn hẹp, vùng bấm ô VĐV `size="small"`, focus, tương phản `colorPrimaryBg` khi chọn.
- Không chạy typecheck/lint.

Chi phí (ước lượng): 17 file phase 06 so; khoảng 20 file mở + 4 lệnh tìm riêng cho phase này (phần hiệu chỉnh tính ở báo cáo phase 07).

Status: DONE
