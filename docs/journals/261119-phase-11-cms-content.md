# 2026-11-19 — Phase 11: CMS nội dung và phát hành

## Bối cảnh

Triển khai lát cắt CMS phase 11 trên working tree. Migration được tạo và đối chiếu offline với schema; chưa áp dụng lên DB. Staging vẫn chờ blocker hạ tầng phase 01.

## Thay đổi và quyết định

- Thêm sáu model CMS, API CRUD có phân quyền, API đọc công khai, AppSetting cho chuyên mục, phân trang tin, retention liên hệ, giới hạn biểu mẫu, khối trang chủ và số mục mỗi khối.
- Trình soạn tin dùng TipTap, hai cột và tab vi/en, lưu nháp thủ công, xác nhận đăng ngay, menu lịch đăng và xác nhận khi rời trang đang sửa/tải ảnh. Ảnh clipboard đi qua upload intent và xử lý media; chỉ chèn URL HTTPS khi `READY`. Local cần `MEDIA_PUBLIC_BASE_URL` HTTPS công khai. Nội dung được sanitize khi ghi và khi render.
- Video chỉ nhận URL HTTPS từ host hỗ trợ; trang công khai tải iframe sau thao tác phát, có `sandbox` và `referrerpolicy`.
- Thêm hàng đợi hẹn giờ và sweep cho bài viết, cùng job dọn thư liên hệ. Chỉ bài viết hỗ trợ trạng thái hẹn giờ; video và trang tĩnh dùng trạng thái đăng ngay hoặc bản nháp. Sweep mặc định mẫu một phút, đọc lại setting sau mỗi lượt để đổi lịch mà không restart. Retry bài đã công bố vẫn phát invalidation; sweep luôn gửi `articles`/`home` kể cả không có dòng mới.
- Bổ sung giao diện admin cho bài viết, video, trang tĩnh, hộp thư và nhà tài trợ; thêm tab tài trợ trong hub giải. Bổ sung các route công khai vi/en, trang chủ, footer, sitemap, nội dung liên quan giải và JSON-LD cho bài viết/video.
- Review phát hiện trang chủ có thể bị giải cũ chiếm giới hạn trước khi lọc. Tách truy vấn giải nổi bật và giải đang diễn ra/sắp tới; lọc theo ngày địa phương của từng giải trước giới hạn.
- Đóng race phát hành bằng cập nhật có điều kiện theo trạng thái và thời điểm đã đọc. Giới hạn gửi liên hệ dùng Lua để tăng bộ đếm và đặt TTL nguyên tử.
- Sắp thứ tự tài trợ theo phạm vi giải/site-wide bằng `POST /admin/sponsors/reorder`; thứ tự và audit metadata cùng transaction, cảnh báo enqueue trả sau commit. Next proxy giới hạn POST liên hệ và trả HTTP 429; UI hiện lỗi trong form và cho gửi lại.
- Kiểm UI với API mẫu phát hiện và sửa chiều cao ảnh tin, grid/hero trang chủ, class bộ lọc tin và thumbnail video lặp.
- Admin chuyển sang data router và `useBlocker` để giữ xác nhận khi Back/Forward hoặc dùng menu; parser Refine giữ đúng ID tài nguyên trên route CMS và route cũ.
- Browser mock phát hiện TipTap mặc định phát `onUpdate` khi đổi editability, ghi document rỗng đè HTML vừa nạp. Helper gọi `setEditable(editable, false)` ngăn ghi ngoài ý muốn; ba kiểm tra hồi quy dùng TipTap thật giữ nguyên nội dung vi/en. Form video/trang tĩnh/tài trợ gộp dữ liệu Refine sau defaults để giữ giá trị đã lưu. Ô chọn giải dùng tìm kiếm/phân trang phía API, không gửi filter `isActive` không hỗ trợ.

## Kiểm chứng

`pnpm install --frozen-lockfile` hoàn tất. Sáu package shared, DB, API, worker, admin và client đều typecheck/lint/build đạt; Prisma validate đạt. Tổng 383 kiểm tra mã nguồn/script đạt: API `src` 177/177, worker 44/44, shared 101/101, client 50/50, admin 11/11 (3 image policy + 3 hồi quy TipTap trên Windows; 5 WSL entrypoint). Các lượt browser mock bên dưới được tính riêng.

Next production nối HTTP API mẫu: 7 route × 2 viewport (1440/390), 14/14 lượt trang và 7 nhóm tương tác mỗi viewport đạt, không có `pageerror` hoặc tràn ngang. Đã mở ảnh kiểm trực quan. Lọc chuyên mục chạy phía server; iframe chỉ có sau click với `sandbox`/`referrerpolicy`; liên hệ ba lần đầu thành công, lần thứ tư cùng IP trả 429 và lỗi trong form, đổi IP mẫu gửi lại thành công; bật/tắt khối trang chủ bằng fixture đạt. Xem [báo cáo UI mẫu](../../plans/reports/tester-261119-phase-11-cms-mock-ui.md).

Ứng dụng admin thật với API/media mẫu: 8/8 ca browser đạt, không có `pageerror`; kiểm thêm payload lưu/nạp form 4/4 đạt. Đã kiểm hủy/chấp nhận native Back/Forward/menu, không cảnh báo thừa sau lưu, nạp đúng bài vi/en và ID player/event/ranking, giữ đủ giá trị ba form sửa video/trang tĩnh/tài trợ, chọn giải theo hợp đồng API. Clipboard đi đủ intent → PUT → complete → `READY`; lưu/đăng bị khóa khi xử lý, chỉ chèn HTTPS và từ chối URL tương đối. Xem [báo cáo admin mẫu](../../plans/reports/tester-261119-phase-11-admin-mock-ui.md).

Kiểm UI mẫu không kết nối PostgreSQL/Redis và không thay thế E2E với DB/API/storage thật. 16 ca API E2E và 18 ca Playwright dùng DB đã viết, chưa chạy vì chưa xác nhận target DB. Migration vẫn chỉ được rà offline, chưa áp dụng; staging chưa triển khai. Redis phục vụ kiểm thử local được khởi động tạm thời rồi dừng, khôi phục trạng thái ban đầu.

## Việc tiếp theo

Xác nhận host/tên DB trước khi áp migration; chạy 16 ca API E2E và 18 ca Playwright dùng DB thật, gồm hẹn giờ, liên hệ và cấu hình trang chủ. Kiểm luồng media với storage/CDN thật và staging sau khi hạ tầng sẵn sàng.
