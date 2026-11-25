# Báo cáo: "Đổi chỗ" cho vòng bảng NHÁP (2026-11-25)

## API (không đổi schema, không migration)
- `POST /admin/draws/:id/swap-group-members` body `{ entryA, entryB, expectedVersion }`; quyền `tournaments:update` (giống swap nhánh), audit `draw.swapGroupMembers` (before/after: entry, group, slot).
- Dịch vụ mới `group-member-swap.service.ts` (70 dòng): một transaction, `loadDrawLocked` (khóa + kiểm version) -> 409 `DRAW_NOT_DRAFT` / `DRAW_STRUCTURE_LOCKED`; 422 `KIND_NOT_ALLOWED` (không phải GROUP), `INVALID_PARAMS` (cùng một VĐV), `ENTRY_NOT_IN_DRAW` (VĐV không thuộc vòng bảng này).
- Đổi chỗ = hai entry đổi `groupId` + `slot` cho nhau (khác bảng hoặc cùng bảng), `GroupStanding` đi theo, các trận vòng bảng đã sinh được hoán `side1/side2EntryId` (tăng `version` trận). Số trận không đổi. Tăng version draw.
- File sửa: `draw-dtos.ts` (+`swapGroupMembersBody`), `admin-draws.controller.ts`, `draws.module.ts`.
- Test mới `apps/api/test/draw-group-member-swap.e2e-spec.ts` (5 case): khác bảng (slot, standing, 6 trận/bảng, mỗi VĐV 3 trận, audit 1), cùng bảng + đổi lại về nguyên trạng, VĐV ngoài draw 422 / cùng VĐV 422 / version cũ 409, RESULTS_OPERATOR 403, draw đã công bố 409.

## Admin
- `group-member-list.tsx`: mỗi thành viên có nút "Đổi chỗ" (aria-label nêu tên; `aria-pressed`); thẻ đang chọn có nền + viền đậm, nút đổi nhãn "Đang chọn", các thẻ khác "Đổi với VĐV này".
- `group-tables-view.tsx`: giữ trạng thái chọn xuyên các bảng, Esc huỷ (có thông báo `role="status"` "Đang chọn X ... nhấn Esc để hủy"), gọi API, toast "Đã đổi chỗ hai VĐV", refetch, trả focus về nút của VĐV vừa đổi (thẻ chuyển bảng nên bị remount). Chỉ bật khi draft + quyền update + chưa khóa.
- `group-card.tsx` chuyển props. `member-swap-pick.ts` (logic chọn thuần) + `test/member-swap-pick.test.mjs` (3 test).
- `draw-panel.tsx`: cảnh báo cùng CLB thêm câu `Bấm "Đổi chỗ" ở VĐV để tách, hoặc bốc thăm lại.` cạnh nút "Bốc thăm lại" (chỉ khi có quyền và chưa khóa); cảnh báo tự cập nhật vì tính lại từ dữ liệu sau refetch.
- Không sửa `same-club-groups.ts` (không cần).
- Xoá `sub-event-side-menu.tsx` (grep toàn apps: chỉ chính nó tham chiếu).
- Lỗi đã gặp và sửa: nút đổi `type` link/primary làm antd remount nút -> mất focus bàn phím; cố định `type="default"`.

## Kiểm tra (chạy thật)
- admin: `pnpm typecheck` sạch; `pnpm lint` sạch; `pnpm test` 96/96 (gồm 3 test mới); `pnpm build` OK (cảnh báo chunk > 500 kB có sẵn).
- api: `tsc --noEmit` sạch. Wrapper test DB (log đầu `localhost:5433/kamito_tt_phase12_test`), từng file: `draw-group-member-swap.e2e-spec.ts` 5/5; `draws.e2e-spec.ts` 18/18; `permission-coverage.e2e-spec.ts` 4/4 (route mới tự được kiểm có `@RequirePermission`).
- Trình duyệt (Playwright, :5173, proxy `/api/v1/**` sang API riêng :3060 qua wrapper, prefix `kamito-tt:test:a7b-261125`), ảnh + script ở `scratchpad\a7b\`:
  - Draw GROUP 2 bảng x 4 (8 VĐV, CLB trùng). Trước: "Bảng A có 2 VĐV cùng CLB (CLB Sao Vàng A7b)".
  - Chuột: chọn VDV 1 (Bảng A, trùng) -> nút đổi nhãn, thấy hint -> bấm VDV 8 (Bảng B): `A:#5,#7,#1,#2 | B:#8,#3,#6,#4` -> `A:#5,#7,#8,#2 | B:#1,#3,#6,#4`; cảnh báo chuyển sang "Bảng B có 2 VĐV cùng CLB" (cập nhật đúng).
  - Bàn phím: Enter chọn, Esc huỷ (hint biến mất, 0 `aria-pressed`), Enter + Tab (tới nút VĐV kế) + Enter đổi `#5,#7` thành `#7,#5` trong cùng bảng, focus nằm lại nút VĐV vừa đổi.
  - Overflow ngang ở 390 px = 0. Console chỉ có 401 lúc chưa đăng nhập (trang login).
- Chưa kiểm: nhiều người sửa cùng lúc từ UI (API có test 409 version); lịch đã xếp trận nháp (xem Giới hạn).

## Dữ liệu đã tạo (DB `kamito_tt_phase12_test`, giải DEBTS e2e284a0...) và đã xoá hết
- Hạng mục "A7b check category" (A7B); nội dung "A7b check" (MS, GROUP_KNOCKOUT); 8 VĐV "A7b check VDV 1..8" + 8 competitor + 8 entry; 3 draw GROUP (3 lần chạy script, đều xoá qua API `DELETE /draws/:id` 200); 1 nội dung XD "A7b check" tạo nhầm (xoá qua API); 22 audit log liên quan.
- Xoá sạch: API không có DELETE entry/player nên dọn bằng script Prisma giới hạn theo id trong manifest (qua wrapper, chặn nếu DB khác test): `{"draws":0,"entries":8,"competitors":8,"players":8,"subEvents":1,"categories":1,"audits":22}`.
- API riêng PID 31460 đã dừng; :3000 và :5173 không đụng.

## Giới hạn
- Hoán entry trong trận đã xếp lịch (session/bàn) không kiểm lại xung đột lịch của VĐV; draft thường chưa xếp lịch.
- Tách VĐV cùng CLB tự động khi sinh bảng (Q7) vẫn là phase thuật toán riêng.
- Không commit. Tên VĐV dài trong thẻ hẹp chưa kiểm ở nhiều độ rộng khác.

**Status:** DONE
**Summary:** API swap thành viên vòng bảng nháp (atomic, audit, hoán trận đã sinh) + UI "Đổi chỗ" bằng chuột/bàn phím + cảnh báo cùng CLB có hướng dẫn; xoá `sub-event-side-menu.tsx`. Typecheck/lint/test/build admin, tsc + 3 e2e API, và kiểm trình duyệt đều xanh.
**Concerns:** Không có chặn; xem mục Giới hạn.
