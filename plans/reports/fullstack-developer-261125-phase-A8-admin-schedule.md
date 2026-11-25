# Phase A8 — Tab "Lịch thi đấu" (admin)

Ngày: 2026-11-25. Trạng thái: DONE_WITH_CONCERNS (xem mục Hạn chế).

## Đã làm
- Toolbar: Segmented ngày ("T6 01/05", `dayPillLabel`) + Segmented buổi ("Tên buổi HH:mm–HH:mm", `sessionRangeLabel`), menu "…" (Thêm / Sửa / Xóa buổi, xóa qua `useConfirmAction`), bên phải giữ `ScheduleActions`. Hai Segmented cuộn ngang trong chính nó để không làm rộng trang ở 390 px.
- Thanh trạng thái: "Đã xếp X/Y trận" + Progress mỏng (cấp giải, từ endpoint tiến độ A4, dùng lại cache của hub), "Thay đổi được lưu ngay", Alert "Có N trận trùng giờ cần sửa" (N đếm trên dữ liệu lưới của buổi) kèm nút "Đến ô đầu tiên" focus vào ô cảnh báo đầu.
- Ô trận: dòng 1 `#số · mã nội dung · vòng/bảng` (chữ nhỏ), hai tên đậm (xuống dòng, không cắt), giờ dự kiến; tay nắm kéo là icon trang trí; ô trống "Thả trận vào đây" nét đứt; ô trùng viền `colorError` + nền lỗi + ghi chú có tooltip (giữ `conflictText`). Tag trạng thái chỉ hiện khi khác SCHEDULED.
- Lưới: cột "Lượt", bỏ `max-content` và cột 240 px; cột tối thiểu 104 px (tính ra 6 bàn = 688 ≤ 715 px khả dụng ở 1280 với panel bên cạnh). Giữ id droppable/draggable, "Xếp vào đây", "Bỏ xếp trận #n".
- Panel: "Trận chưa xếp lịch (N)", thẻ viền theo Figma, chú thích "Kéo trận vào ô trống trong lưới." (không ghi "kéo ra ngoài để bỏ xếp" vì `use-schedule-board.ts` không có hành vi đó; bỏ xếp = nút X).
- Không làm (theo spec/gap): "Mỗi khung 40 phút", cột "Khung", "Lưu lịch", "Tự động xếp" (Q9), "Sân chính".
- Q8 (màu theo nội dung): theo bảng câu hỏi mở là mặc định (a) không màu, dùng Tag mã; không có chốt (b) nên KHÔNG làm migration/`colorHex`. Nếu muốn (b) cần quyết riêng (migration).

## M3 (review nợ 261125, kéo bàn phím chưa thử trên trình duyệt)
Chrome (Chromium qua Playwright), sự kiện demo 21d171f2, trận #2 từ panel vào buổi "A8 check":
- Space nhấc: `aria-pressed` vẫn false (không phát sinh click kích hoạt chế độ chọn).
- Nhấc rồi Space ngay: 0 PATCH. Nhấc rồi Tab: 0 PATCH. Nhấc rồi Esc: 0 PATCH. (M2 đã sửa từ trước: `rectIntersection`, Tab = cancel.)
- Nhấc, ArrowRight, Space: 1 PATCH đúng `sessionId/tableId/orderInSession=1`, `expectedScheduleVersion`; live region đọc "trận số 2 đang ở bàn T1, thứ tự 1."; focus ring solid 2px.
- Firefox/WebKit: CHƯA thử được (không có Firefox; WebKit cài sẵn lệch phiên bản Playwright). Mục "Space click khi keyup trên Firefox/Safari" vẫn mở.

## File
Sửa: `apps/admin/src/pages/event-hub/{schedule-tab,session-toolbar,session-grid,session-grid-cell,unscheduled-panel,schedule-types,use-event-progress}.tsx|ts` (`use-event-progress.ts`: tách `eventProgressQuery` để status bar đọc chung, hook cũ giữ nguyên hành vi).
Tạo: `schedule-status-bar.tsx`, `session-header-menu.tsx`, `schedule-conflict-count.ts`, `use-session-grid-matches.ts`, `apps/admin/test/schedule-conflict-count.test.mjs`.
Không đụng: API, schema, `.env`, file draw*/client.

## Kiểm chứng (thật)
- `apps/admin`: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` exit 0; test 77 pass / 0 fail (gồm `schedule-keyboard-drag` và `schedule-conflict-count`).
- API không sửa nên không chạy tsc/vitest.
- Trình duyệt (Chromium, đăng nhập 1 context), 1280 và 390: không tràn ngang trang (`scrollWidth == clientWidth`), console chỉ có 1 lỗi 401 trước khi đăng nhập (trang login), không warning. Banner trùng hiện "Có 1 trận trùng giờ cần sửa", bấm nút focus đúng ô ("Bàn trùng giờ với trận #14"). Ảnh: `scratchpad\a8\{view,six,kbd-chromium-*,banner-focus}.png`.
- E2E `schedule-and-withdraw.ts` chưa chạy; selector `Thêm buổi thi đấu` (trạng thái chưa có buổi, giữ nguyên), `Xếp vào đây`, `Bỏ xếp trận #n` còn nguyên.

## Dữ liệu đã tạo / tác động
- Tạo qua API trong sự kiện demo 21d171f2 các buổi tạm "A8 check" (mã A8C…/A8SIX), đã xóa hết (HTTP 200); lần tạo đầu bị 403 (thiếu Origin) nên không tạo gì.
- Trận #2 của sự kiện demo được xếp rồi bỏ xếp (scheduleVersion tăng), trạng thái cuối: chưa xếp như ban đầu.

## Hạn chế / câu hỏi
- Chưa kiểm 6 bàn thật ở 1280 (venue demo chỉ có 2 bàn; chỉ tính toán).
- Tên cột bàn dùng `displayName`/`code` (không có "Sân chính").
- aria-label cho tay nắm: activator là cả nút trận (tên truy cập lấy từ nội dung, đầy đủ hơn nhãn "Kéo"), icon để `aria-hidden`.

**Status:** DONE_WITH_CONCERNS
**Summary:** Tab lịch redesign xong (toolbar, status bar, ô, panel), kéo bàn phím vẫn chạy và đã thử trên Chromium; verify admin xanh.
**Concerns:** Firefox/WebKit chưa thử; Q8 không làm (cần chốt migration); 6 bàn thật chưa kiểm.
