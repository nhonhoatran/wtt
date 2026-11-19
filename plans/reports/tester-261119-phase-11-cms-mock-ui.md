# Phase 11 — kiểm tra giao diện CMS với API mẫu

Ngày kiểm: 2026-11-19. Kết quả cuối: **14/14 lượt trang đạt**, 7 nhóm tương tác đạt ở cả 1440 và 390, không có `pageerror` hoặc tràn ngang trong lượt kiểm cuối.

## Môi trường và giới hạn

- Chạy bản Next production đã build ở `127.0.0.1:39312`, nối HTTP API fixture ở `127.0.0.1:39311`. Playwright Chromium chạy riêng, không dùng chung browser với kiểm tra admin.
- Fixture nằm trong bộ nhớ: 7 tin, 3 video, 1 trang tĩnh, 1 giải, 1 nhà tài trợ và 1 bảng xếp hạng mẫu. Ảnh SVG minh họa do script tạm cung cấp.
- `DATABASE_URL` và `REDIS_URL` rỗng riêng trong tiến trình kiểm tra. Không kết nối PostgreSQL/Redis, không seed/migrate, không sửa `.env` đang dùng. Hai tiến trình được đóng sau kiểm tra.
- Lượt kiểm này xác nhận SSR, CSS và tương tác trình duyệt với dữ liệu mẫu. Không thay thế **16 ca API integration cần DB và 18 ca Playwright DB E2E chưa chạy**. Chưa xác nhận worker hẹn giờ, hạn mức Redis nhiều replica, migration, IP qua Traefik/CDN hoặc staging.
- API fixture nhận liên hệ trong bộ nhớ. HTTP 429 được kiểm ở proxy Next thật với bộ đếm fallback tại một tiến trình; lưu DB và hộp thư Nest thật chưa được kiểm ở lượt này.

## Trang và ảnh sau sửa

Mỗi route trả HTTP 200, tiêu đề đúng và `document.documentElement.scrollWidth <= innerWidth`.

| Trang | 1440 | 390 |
|---|---|---|
| Trang chủ `/vi` | [Ảnh](./screenshots-261119-phase-11-public-mock/home-1440.png) | [Ảnh](./screenshots-261119-phase-11-public-mock/home-390.png) |
| Danh sách tin `/vi/news` | [Ảnh](./screenshots-261119-phase-11-public-mock/news-list-1440.png) | [Ảnh](./screenshots-261119-phase-11-public-mock/news-list-390.png) |
| Bài tin `/vi/news/ban-tin-1` | [Ảnh](./screenshots-261119-phase-11-public-mock/article-1440.png) | [Ảnh](./screenshots-261119-phase-11-public-mock/article-390.png) |
| Danh sách video `/vi/videos` | [Ảnh](./screenshots-261119-phase-11-public-mock/videos-list-1440.png) | [Ảnh](./screenshots-261119-phase-11-public-mock/videos-list-390.png) |
| Video `/vi/videos/video-1` | [Ảnh](./screenshots-261119-phase-11-public-mock/video-1440.png) | [Ảnh](./screenshots-261119-phase-11-public-mock/video-390.png) |
| Trang tĩnh `/vi/pages/gioi-thieu` | [Ảnh](./screenshots-261119-phase-11-public-mock/static-page-1440.png) | [Ảnh](./screenshots-261119-phase-11-public-mock/static-page-390.png) |
| Liên hệ `/vi/contact` | [Ảnh](./screenshots-261119-phase-11-public-mock/contact-1440.png) | [Ảnh](./screenshots-261119-phase-11-public-mock/contact-390.png) |

Đã mở ảnh bằng công cụ xem ảnh để kiểm trực quan: danh sách tin và trang chủ ở hai viewport; bài tin, video, trang tĩnh và trạng thái lỗi liên hệ. Kết luận không chỉ dựa trên số đo DOM.

## Tương tác đạt

- Chọn chuyên mục, submit form GET và nhận 3 thẻ đúng từ API fixture; dữ liệu được lọc phía server.
- Video không có iframe trước click. Sau click có iframe YouTube với `sandbox="allow-scripts allow-same-origin allow-presentation"` và `referrerpolicy="strict-origin-when-cross-origin"`. Tài liệu provider được intercept riêng để không phụ thuộc mạng YouTube.
- Liên hệ: 3 lần gửi đầu thành công; lần thứ 4 từ cùng IP mẫu trả HTTP 429, `Cache-Control: no-store`, `Retry-After > 0`.
- Khi HTTP 429, lỗi hiện trong form và nút gửi hoạt động lại. Đổi IP mẫu rồi gửi lại thành công. [Lỗi 1440](./screenshots-261119-phase-11-public-mock/contact-rate-limit-1440.png), [lỗi 390](./screenshots-261119-phase-11-public-mock/contact-rate-limit-390.png), [thành công 1440](./screenshots-261119-phase-11-public-mock/contact-success-1440.png), [thành công 390](./screenshots-261119-phase-11-public-mock/contact-success-390.png).
- Tắt `news/videos` trong cấu hình fixture làm hai khối biến mất ở trang chủ; không ghi AppSetting vào DB.
- Đo tỷ lệ ảnh tin 16:9, chiều cao ô lọc tối thiểu 40px theo component chung; grid tin trang chủ là CSS grid; hero không có bullet; mỗi thẻ video chỉ còn một ảnh.

## Lỗi phát hiện và đã sửa

1. Ảnh tin có thuộc tính HTML `height=720` nhưng CSS chưa ghi đè nên thẻ bị kéo dài: thêm `height: auto` tại media CMS. [Trước](./screenshots-261119-phase-11-public-mock/news-list-1440-before.png) / [sau](./screenshots-261119-phase-11-public-mock/news-list-1440.png).
2. Trang chủ tham chiếu `grid` từ CSS module đã tách, đồng thời hero chưa reset list: dùng đúng module grid và bỏ margin/padding/bullet mặc định. [Trước](./screenshots-261119-phase-11-public-mock/home-390-before.png) / [sau](./screenshots-261119-phase-11-public-mock/home-390.png).
3. Bộ lọc tin trỏ tới các class không còn tồn tại: tái dùng `FilterForm` có sẵn của site.
4. Thẻ video dựng cả thumbnail và facade: dùng một facade có nút phát, tiêu đề liên kết nằm phía dưới.

## Kiểm tra mã sau sửa

- `pnpm --filter @kamito/client typecheck`: đạt.
- `pnpm --filter @kamito/client lint`: đạt.
- `pnpm --filter @kamito/client build`: đạt, Next.js 16.4.5.
- `pnpm --filter @kamito/client test`: **50/50**, 12 file đạt.
- [Kết quả máy đọc được](./screenshots-261119-phase-11-public-mock/verification.json): route, viewport, trạng thái HTTP và nhóm tương tác; không lưu credential hoặc request body. Runtime log thô giữ ngoài repo.

Ảnh fixture dùng HTTP loopback có cảnh báo CSP report-only cho ảnh khác origin; cảnh báo này không phải kiểm chứng cấu hình media/CSP trên staging.
