# Báo cáo phase A7 - tab "Bốc thăm" (2026-11-25)

## Đã làm (chỉ admin + 2 file test client; không đổi API/shared/schema)
- `draws-tab.tsx`: bỏ side menu và tab loại draw. Dùng `SubEventPills` + `useSubEventParam` (chấm trạng thái: Badge + `aria-label` "Bốc thăm: ..."), các khu xếp chồng (Vòng bảng, Vòng loại, Vòng loại trực tiếp / Nhánh chính), nút neo nhỏ khi có > 1 khu.
- `draw-panel.tsx`: mỗi khu là `<section data-draw-kind>` gồm tiêu đề, Tag trạng thái / Đã khóa, dòng tóm tắt, `DrawProcessSteps`, Alert vàng "Bản xem trước chưa công bố", lưới/nhánh, thanh hành động. Khu chưa bốc: trạng thái trống; nhánh chính của thể thức vòng bảng khi vòng bảng chưa CÔNG BỐ (kể cả đang nháp) chỉ hiện lý do, không có nút. (Trước đây chỉ kiểm "chưa có draw GROUP", nên nút bấm được rồi mới dính 409.)
- Mới: `draw-process-steps.tsx` (4 bước suy từ draw; < 576 px thu thành một dòng "Bước 3/4: Xem trước" vì Steps tràn ngang 70 px), `draw-sticky-actions.tsx` (sticky trong luồng, không `fixed`), `group-member-list.tsx`, `same-club-groups.ts` (thuần; chuẩn hoá trim/hoa thường/bỏ dấu bằng `stripDiacritics`; CLB rỗng bỏ qua; cặp đôi tính theo từng entry), `test/same-club-groups.test.mjs` (4 test).
- `group-tables-view.tsx` / `group-card.tsx`: lưới 4/2/1 cột khi nháp (thẻ liệt kê hạt giống `[n]`, tên, CLB); đã công bố giữ bảng BXH + Rút khỏi bảng + Tính lại BXH + Phá hòa, lưới 2/1 cột. Viền vàng + Tag "Trùng CLB".
- `draw-action-bar.tsx`: "Bốc lại" -> "Bốc thăm lại"; hộp xác nhận công bố nêu hậu quả (VĐV/khán giả thấy; muốn bốc lại phải bỏ công bố; trận đầu bắt đầu thì khóa; vòng bảng: nhánh trực tiếp chỉ bốc được sau khi công bố vòng bảng).
- `draw-labels.ts` (+`OVERALL_BADGE_STATUS`, `drawSectionTitle`), `draw-summary-text.ts` (+`drawViewSummaryText` cho draw đã có; bỏ "0 VĐV" khi nhánh toàn ô GROUP_PLACE).
- `apps/client/tests/admin-full-flow/draws.ts`: selector theo `[data-draw-kind]`, pill radio thay heading/tab, dialog công bố nhận theo nội dung mới. CHƯA chạy được E2E này.
- `apps/client/tests/unit/admin-group-withdrawal.test.ts`: thêm `draft: false, flaggedIds: new Set()` theo yêu cầu điều phối.
- `AdminBracketView` giữ nguyên (không chỉnh nhãn cột).

## Kiểm tra (chạy thật)
- admin: `pnpm typecheck` sạch; `pnpm lint` sạch; `pnpm test` 81/81; `pnpm build` OK (chỉ cảnh báo chunk > 500 kB có sẵn).
- client: `pnpm typecheck` sạch; `pnpm test` 30 file / 143 test pass.
- api: không sửa file nào nên không chạy tsc/test api.
- Trình duyệt (Playwright, 1 context đăng nhập, API :3000 thật, không stub), ảnh ở `scratchpad\a7\` (s1..s11):
  - Khu nhánh chính khi vòng bảng chưa bốc: có lý do "Công bố vòng bảng trước...", 0 nút "Bốc thăm".
  - Bốc nhóm 6 VĐV (4 người cùng CLB viết khác hoa/dấu/khoảng trắng) qua wizard: Alert "Lưu ý: Bảng A có 2 VĐV cùng CLB (CLB Sao Vàng); Bảng B ..." và 6 Tag "Trùng CLB" (2 tag đầu thẻ + 4 dòng), steps ở bước 3, nút "Công bố" trong khung nhìn 900 px (y=855, sticky).
  - Công bố vòng bảng qua hộp xác nhận: tiêu đề "Công bố vòng bảng A7 check nhóm?", API publish OK, bảng chuyển BXH, progress được gọi lại 1 lần (làm mới tiến độ chạy theo overview). Nhánh chính bốc được sau đó (wizard 2 bước), đổi chỗ hai ô bán kết `POST /swap` 200, công bố nhánh chính OK, menu "…" có "Bỏ công bố".
  - Overflow ngang 0 ở 1280 và 390 (sau sửa steps); console không warning/error.

## Dữ liệu đã tạo (tên chứa "A7 check", DB dev qua API :3000)
- Hạng mục `1b2c905f-2e23-40ba-ada3-dd7424e75bd7` ("A7 check category", mã A7C).
- Nội dung `7e2b01f9-a4da-49b5-9d49-54d87132c156` ("A7 check nhóm", MS-A7C, GROUP_KNOCKOUT) trong giải DEBTS e2e284a0-....
- 6 VĐV "A7 check Vận động viên 1..6" (id trong `scratchpad\a7\a7-manifest.json`) + 6 entry.
- 2 draw (GROUP, MAIN, cả hai đã công bố) + 2 nhóm, 6 trận vòng bảng, 3 trận nhánh.

## Giới hạn, nói thẳng
- "Đổi chỗ" ở cảnh báo cùng CLB: KHÔNG có. Swap API chỉ làm việc trên `BracketPosition` (nhánh), vòng bảng lưu thành viên ở `GroupMember` nên không có swap. Spec yêu cầu "đổi chỗ xong -> mất cảnh báo" không đạt được mà không thêm API. Em để nút "Bốc thăm lại" trong Alert thay thế; mất cảnh báo chỉ sau khi bốc lại. Hàm `findSameClubGroups` đã có test "đổi chỗ thì hết trùng" ở mức dữ liệu.
- Chưa kiểm trên trình duyệt: thanh sticky ở 390 khi draw đang NHÁP (ảnh 390 chỉ khi đã công bố); stacked 3 khu (có vòng loại) vì không dựng dữ liệu QUALIFYING; "Bỏ công bố" bấm thật; E2E admin-full-flow chưa chạy.
- Draw đã công bố nên không xoá được dữ liệu thử.
- `sub-event-side-menu.tsx` giờ không còn nơi dùng (không xoá vì ngoài danh sách file); `side-menu-layout.tsx` còn dùng bởi schedule-tab.
- Hai lần login Playwright timeout thoáng qua (dev server bận), chạy lại thì qua.
- Không commit.

## Câu hỏi mở
- Có làm API swap thành viên giữa các bảng (draft) để "Đổi chỗ" thật như Figma không (phase riêng, có test)? Tách VĐV cùng CLB khi sinh bảng (Q7) vẫn để phase thuật toán.
- Xoá `sub-event-side-menu.tsx` (dead code)?

**Status:** DONE_WITH_CONCERNS
**Summary:** Tab Bốc thăm đã chuyển sang pills + khu xếp chồng + steps + cảnh báo cùng CLB + thanh dính + xác nhận công bố nêu hậu quả; admin và client typecheck/test/build xanh, đã kiểm trên trình duyệt thật.
**Concerns:** Không có "Đổi chỗ" thật cho vòng bảng (thiếu API); sticky 390 lúc nháp, khu vòng loại và E2E chưa kiểm.
