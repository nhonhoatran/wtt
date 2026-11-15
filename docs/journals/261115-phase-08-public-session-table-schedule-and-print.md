# 2026-11-15 — Lịch công khai theo session/bàn và bản in

## Thay đổi

- Phase 07 đã có session và xếp lịch; gỡ ghi chú phụ thuộc đã cũ ở phase 08.
- Bổ sung `PublicScheduleQuery`, hợp đồng `PublicSchedule`, lọc bằng mã session/bàn phía server. Phạm vi công khai và serializer trận được dùng lại; không đổi schema.
- Tab Thông tin render lịch vi/en theo múi giờ giải, kể cả khi không có rich text. Lịch gắn tag lịch và tag giải để tên địa điểm/entry cũng được làm mới.
- Bản in theo bộ lọc hiện tại, mỗi session/bàn mở trang mới; đầu bảng lặp ngữ cảnh, tên VĐV được xuống dòng.

## Kiểm chứng và giới hạn

- `pnpm --filter @kamito/client typecheck` và `lint` đạt; API typecheck đạt theo tác vụ API.
- API tích hợp đạt: 24 ca hồi quy, 18 ca lịch/cache, 11 ca sau cập nhật mutation map. Playwright lịch 5 đạt/1 bỏ qua PDF mobile; client build/typecheck/lint đạt. Lỗi kết nối ban đầu đã hết sau khi bật dịch vụ dev. Không chạy migration hoặc đổi DATABASE_URL.
- Chưa deploy, chưa đạt M1/M2. Rà toàn bộ phase để đồng bộ trạng thái: chỉ phase 08 thay đổi trong phạm vi lần này; không tự đóng nợ khác.
- PDF thường 1 trang, lịch dài 3 trang có ngữ cảnh lặp đầy đủ; kiểm 390/1280 px đạt. Lượt toàn bộ có 2 lỗi locator mới, đã sửa và chạy lại riêng lịch đạt; chưa chạy lại toàn bộ suite sau sửa. Review 9,5/10 sau sửa thiếu tag tên bàn/địa điểm riêng session. Báo cáo trong `plans/reports/{reviewer,tester}-261115-phase08-public-schedule.md`.

## Bài học

Ghi chú phụ thuộc trong plan cần đối chiếu với code trước khi giữ trạng thái chờ. Khi dùng cùng tab cho lịch và nội dung giải, điều kiện hiện tab phải xét cả lịch; bản in cần tách nội dung không liên quan và giữ ngữ cảnh trên từng trang dài.
