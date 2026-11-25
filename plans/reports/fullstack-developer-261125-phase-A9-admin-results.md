# Phase A9 — Nhập kết quả trận (admin)

Trạng thái: DONE_WITH_CONCERNS (xem mục Lưu ý). Không đổi API, không migration, không commit.

## Đã làm
- Tách `ResultsWorkspace` (bộ lọc server-side + bảng + drawer) khỏi `ResultsEntryPage`; trang `/results` = chọn giải + workspace. Trang chủ RESULTS_OPERATOR vẫn render `ResultsEntryPage` (role-home-page, không sửa).
- Deep link `/results?event=<id>&match=<id>`: `?event=` thắng localStorage; `?match=` mở drawer; mở/đóng trận cập nhật `?match=` (replace). Trận không thuộc giải đang chọn: báo "Trận này không thuộc giải đang chọn" và đóng drawer.
- Drawer rộng `min(720px, 100vw)`: header (Trận #n, tag trạng thái/nội dung/vòng, dòng "Bàn · HH:mm, Thứ x dd/mm/yyyy · Thắng x/y ván · Ván p điểm, cách w" dựng từ thể thức), khối đối đầu (tên, CLB, tỉ số ván "2 – 1"), lưới ván (hàng = 2 bên, cột = Ván 1..bestOf + "Ván thắng"), ô "Người thắng", footer dính.
- Điều hướng "Trận i/N chờ kết quả" + Trận trước/Trận sau (theo danh sách đang lọc; hết trang thì gọi trang kế). Có tỷ số đang nhập dở thì hỏi trước khi chuyển.
- Bàn phím: mở drawer focus ô đầu; Enter ở ô bên 1 sang bên 2; Enter ở ô bên 2 nhảy ván kế, hoặc mở hộp xác nhận nếu kết quả đã hợp lệ; Enter trong hộp xác nhận = xác nhận. Tab đi theo thứ tự ván (DOM theo ván, CSS grid đặt vị trí).
- Lỗi ván hiện khi rời ván (đã nhập đủ 2 ô) hoặc khi Enter; nêu ván + quy tắc + ví dụ dựng từ `pointsPerGame`/`winBy` (không chôn số). Nút xác nhận disabled kèm dòng lý do ("Sửa ván 1 để xác nhận", "Nhập đủ điểm hai bên ở ván 2…", "Chưa bên nào thắng đủ 3 ván; nhập tiếp ván 2").
- Nhãn: "Xác nhận kết quả" (hộp xác nhận "Xác nhận kết quả?" nêu bên thắng, tỷ số, các ván, hệ quả), "Lưu nháp" (save-progress, chỉ khi LIVE), "Trận không đấu đủ…" (mở `match-abandon-modal` có sẵn, không biến thành select). Giữ Sửa tỷ số / Mở lại / Hủy bắt đầu như cũ (quyền không đổi).
- Tab hub "Kết quả" (`results`, 6 tab, stepper giữ 5 bước — spec không yêu cầu bước thứ 6), không có ô chọn giải; ẩn nếu thiếu `matches.list`. RESULTS_OPERATOR thấy tab và menu rút gọn như cũ.
- Tự mở trận kế cùng bàn sau khi xác nhận giữ nguyên (`openNext`), đã kiểm trên trình duyệt: sau xác nhận #3 drawer sang #5, focus ô đầu.

## File
Sửa: `apps/admin/src/pages/results/{results-entry-page,match-score-drawer,game-score-inputs,match-action-bar,score-draft,use-results-event,amend-scores-modal}.ts(x)`, `apps/admin/src/pages/event-hub/event-hub-page.tsx` (+ import, tab, lọc quyền; xoá dòng comment cũ "Later phases…"), `apps/client/tests/admin-full-flow/results.ts` (3 selector: "Xác nhận kết quả", "Xác nhận kết quả?", "Xác nhận").
Tạo: `results/{results-workspace,use-results-list,results-filters,match-drawer-body,match-drawer-header,match-versus-panel,match-winner-box,match-when-text,match-navigation}.ts(x)`, `event-hub/results-tab.tsx`, `test/match-navigation.test.mjs`, `test/score-draft-messages.test.mjs`.
Lệch spec: logic điều hướng đặt tên `match-navigation.ts` (hàm thuần, không phải hook) thay vì `use-match-navigation.ts`.
Không đụng `use-match-actions.ts`, API, packages/shared, app.tsx, menu-groups.

## Kiểm chứng (đã chạy)
- apps/admin: `pnpm typecheck` sạch; `pnpm lint` sạch; `pnpm test` 96 pass / 0 fail (thêm 7 test: điều hướng đầu/cuối/qua trang, thông điệp lỗi + lý do disabled); `pnpm build` OK (chỉ cảnh báo chunk > 500 kB có sẵn).
- API không sửa nên không chạy tsc/test API. E2E `admin-full-flow` KHÔNG chạy (chỉ sửa selector, chưa kiểm).
- Trình duyệt (Playwright, vite :5173, API :3000 dùng chung) ADMIN 1280 + 390, RESULTS_OPERATOR 1280 + 390: không overflow ngang (scrollWidth - innerWidth = 0), không control ngoài khung; console không warning/error do A9 (có 404 `/admin/dashboard/summary` và `pending-matches` ở trang chủ admin do API :3000 chưa có endpoint của phase A2 — không thuộc A9). Operator thấy nút Xác nhận/Bắt đầu/Trận không đấu đủ, tab Kết quả, menu rút gọn; trang chủ operator mở được drawer.
- Luồng thật (ADMIN): nhập 11–10 → lỗi có quy tắc/ví dụ + disabled + lý do; sửa → 3–0 → Enter → hộp xác nhận → xác nhận → 200 → drawer tự sang trận kế. Chuyển trận khi đang nhập dở → hộp hỏi. Lưu nháp (LIVE), Hủy bắt đầu, Mở lại (có step-up mật khẩu). Deep link sai giải: 1 thông báo, drawer đóng (đã sửa lỗi lặp thông báo vô hạn tìm ra khi kiểm).
- Ảnh: `scratchpad\a9\*.png` (1-12).

## Dữ liệu đã đổi trên DB test (event "Entries 3f305b", id 21d171f2-21f6-4e83-85ec-8e6d6ea3fb9c)
Trận #2 (385a042b…) và #3 (bc7a8bf1…, MS Tứ kết): SCHEDULED → OFFICIAL → Mở lại (LIVE) → Hủy bắt đầu (SCHEDULED, ván bị xoá); #3 từng có thêm một lần bắt đầu + lưu nháp ván 1 rồi hủy bắt đầu. Trạng thái cuối cả hai: SCHEDULED, không có ván, giống ban đầu; chỉ khác `version` (#2: 0→3, #3: 0→6). Trận #5/#6 (bán kết) nhận rồi bị gỡ người thắng khi mở lại (cuối cùng #5 = Draw 1 vs trống, #6 = trống vs Draw 2, như ban đầu). Audit log có các bản ghi tương ứng (lý do "A9 check restore after verification"). Không tạo/ sửa dòng nào khác; không dùng event DEBTS (A7 đang dùng).

## Lưu ý / chưa làm
- Seed `[seed]` trong khối đối đầu: `match-view` của API không trả seed → không hiển thị (cần API; không làm trong phase này).
- "Ghi chú" trận: không vẽ (chờ Q10).
- Chuyển trận qua trang (`kind: 'page'`) mới có test đơn vị, chưa thử trên trình duyệt vì giải thử chỉ có 1 trang.
- Lưu nháp khi ván đã đủ quyết định trận bị API từ chối 422 (hiện hộp lỗi sẵn có); chưa chặn trước ở UI.
- Chưa tick todo trong phase file/plan.md (plan.md dùng chung với phase song song).

**Status:** DONE_WITH_CONCERNS
**Summary:** A9 xong phía admin, build/lint/test xanh, kiểm tay trên 2 vai trò và 2 độ rộng; dữ liệu thử đã khôi phục về SCHEDULED.
**Concerns:** E2E admin-full-flow chưa chạy sau khi đổi nhãn nút; seed không hiển thị vì API không có; điều hướng qua trang chưa thử trên UI.
