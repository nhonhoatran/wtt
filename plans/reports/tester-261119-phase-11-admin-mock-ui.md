# Kiểm thử giao diện quản trị Phase 11 bằng API giả lập

Ngày kiểm tra: 2026-11-19. Chạy ứng dụng Vite quản trị thật với Chromium, chặn toàn bộ `/api/v1/**` và trả fixture trong browser harness. Không chạy truy vấn, migration hoặc seed cơ sở dữ liệu.

## Kết quả

- Bộ kiểm tra browser cuối: **8/8 đạt**; bổ sung kiểm tra payload lưu và trạng thái form: **4/4 đạt**.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`: đạt. Build còn cảnh báo bundle lớn hơn 500 kB.
- `node --test test/rich-text-image-policy.test.mjs test/rich-text-editor-state.test.mjs`: **6/6 đạt**. Test dùng `Editor` TipTap thật để chứng minh đổi trạng thái nhập mặc định phát sự kiện ghi nội dung, còn helper im lặng giữ nguyên document Việt/Anh và không ghi vào form.

## Những hành vi đã xác minh

1. **Điều hướng:** native browser Back và Forward đều mở xác nhận khi bài chưa lưu; hủy giữ nguyên URL và tiêu đề; chấp nhận chuyển trang. Liên kết menu có cùng hành vi. Lưu thành công về danh sách không xuất hiện xác nhận thừa. Router dùng `createBrowserRouter` và `useBlocker`, không thêm `popstate` giả.
2. **Tương thích route cũ:** article edit, player edit, event show lấy đúng ID và hiện đúng dữ liệu fixture. Ranking matrix vẫn mount, sửa điểm thành 42 rồi Back/hủy giữ nguyên; Back/chấp nhận trở về event. Wrapper parser bỏ riêng tham số `*` và khôi phục ID từ route tài nguyên.
3. **Nội dung bài viết trước/sau sửa:** baseline ghi nhận form đã nhận HTML Việt/Anh nhưng `setEditable` phát `onUpdate` với document rỗng, khiến nội dung bị xóa. Sau khi dùng `setRichTextEditable` với `emitUpdate=false`, hai tab đều hiện đúng nội dung; payload PATCH khi lưu vẫn chứa đủ `body` và `bodyEn` ban đầu.
4. **Nạp dữ liệu sửa trước/sau:** baseline cả ba form video, trang tĩnh và nhà tài trợ đều thất bại: tiêu đề/tên trống, nhà tài trợ có thứ tự 0 thay vì 7. Sau khi gộp defaults với `formProps.initialValues`, các form hiện đúng tên/tiêu đề, trạng thái đã đăng hoặc đã ẩn, thứ tự 7, nhóm chân trang và hai nội dung trang tĩnh.
5. **Chọn giải:** video và nhà tài trợ hiện tên giải đã chọn. Mock từ chối `filter[isActive]`; kiểm tra request xác nhận bộ chọn CMS dùng truy vấn sự kiện hợp lệ, không gửi bộ lọc này. Tìm kiếm và kích thước trang đi qua API; bản ghi đã chọn ngoài trang kết quả được lấy riêng theo ID.
6. **Dán ảnh:** file clipboard đi qua config → intent (`article-body`, MIME và kích thước) → PUT → complete → chờ READY. Trong lúc xử lý, lưu nháp/đăng ngay bị khóa, chưa có ảnh trong document. READY với URL HTTPS cấu hình sẵn mới chèn ảnh và mở lại thao tác. URL cuối dạng tương đối báo lỗi `MEDIA_PUBLIC_BASE_URL`, không chèn ảnh và không tự đoán origin.

## Ảnh giao diện đã xem

- [Article editor 1440 px](screenshots-261119-phase-11-admin-mock/article-editor-1440.png): bố cục hai cột, nội dung Việt đã nạp.
- [Article editor 390 px](screenshots-261119-phase-11-admin-mock/article-editor-390.png): các phần xếp dọc, không tràn ngang document.

Đã bổ sung nhãn CMS tương ứng các khóa `titles.list/create/edit/show` mà Refine sử dụng. Browser xác nhận nút hiển thị “Danh sách bài viết”, không lộ khóa dịch. Tab English trên màn hình hẹp nằm trong vùng cuộn tab của Ant Design.

## Tái chạy và giới hạn

Harness tạm nằm trong thư mục được ignore: `apps/admin/test-results/phase11-unsaved-navigation.browser.mjs`. Từ `apps/admin`, chạy:

```powershell
node --test test-results/phase11-unsaved-navigation.browser.mjs
node --test test/rich-text-image-policy.test.mjs test/rich-text-editor-state.test.mjs
pnpm typecheck
pnpm lint
pnpm build
```

Bằng chứng trước sửa: `test-results/phase11-body-load-baseline.txt`, `test-results/phase11-edit-hydration-baseline.txt`. Sau sửa: `test-results/phase11-admin-browser-final.txt`, `test-results/phase11-admin-edit-final.txt`.

Đây là kiểm tra mã giao diện thật với API giả lập; không thay thế kiểm tra API/worker/storage thật hoặc dữ liệu đã migration. Không xác nhận upload ảnh thật qua storage/CDN, sanitizer phía server hay lịch xuất bản chạy nền trong vòng này. Console còn cảnh báo phát triển Refine về form chưa gắn khi Skeleton đang hiển thị và lời nhắc truyền ID tường minh; không có `pageerror` trong các ca đạt. Harness tạm dùng Playwright đã cài trong workspace, không thêm dependency hoặc liên kết test giữa ứng dụng vào mã được phát hành.
