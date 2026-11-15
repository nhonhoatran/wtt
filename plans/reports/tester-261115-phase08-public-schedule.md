# Kiểm thử lịch công khai theo buổi/bàn và bản in

Ngày: 2026-11-15. Phạm vi: phần lịch và bản in còn lại của phase 08.

## Kết quả

- `pnpm --filter @kamito/client exec playwright test schedule.spec.ts`: **5 đạt, 1 bỏ qua**. Ca PDF chỉ chạy trên desktop; mobile kiểm tra SSR, lọc, ngôn ngữ và kích thước trang.
- Lần chạy toàn bộ `pnpm --filter @kamito/client exec playwright test`: **37 đạt, 5 bỏ qua, 2 lỗi locator trong test mới**. Test dùng `getByLabel(..., exact: true)` với label bọc select nên không tìm được ô chọn. Đã đổi sang role `combobox` và chạy lại toàn bộ test lịch: 5 đạt như trên. Không chạy lại toàn bộ bộ kiểm thử sau thay đổi locator; các test cũ đều đạt trong lần chạy toàn bộ.
- `pnpm --filter @kamito/client build`: đạt, gồm compile production, TypeScript, thu thập trang.
- `pnpm --filter @kamito/client typecheck`, `pnpm --filter @kamito/client lint`: đạt.
- ESLint hai file seed/cleanup Playwright của API: đạt.

## Những hành vi đã kiểm tra

- HTML trả từ server có buổi sáng/chiều, tên hiển thị công khai của VĐV và giờ theo múi giờ giải. Không chứa tên thật bị ẩn.
- Lọc `session=S02&table=T1` bằng form GET; chuyển tiếng Anh giữ bộ lọc; cặp buổi/bàn không có trận hiển thị trạng thái rỗng.
- Trang ở 390 px và 1280 px không tràn ngang toàn trang. Bảng có vùng cuộn riêng. Đã mở và kiểm tra ảnh mobile thực tế.
- Nút in gọi `window.print`. Bản in ẩn header/footer/bộ lọc, giữ giải/buổi/bàn.
- PDF A4 thông thường có 1 trang. Kiểm tra thêm bảng dài bằng cách nhân bản 40 dòng với tên dài trên DOM thật, dùng stylesheet in thật: PDF có 3 trang. Đây là kiểm tra phân trang CSS với dữ liệu tăng cường trong trình duyệt, không phải 40 trận được seed vào DB.
- Dùng `pypdf` đọc từng trang, chuẩn hóa NFKD và bỏ dấu/khoảng trắng do bộ trích xuất font chèn vào: cả 3 trang đều có tên giải (`Entries`), buổi (`Buoi sang`), bàn (`Ban T1`) và múi giờ (`Asia/Ho_Chi_Minh`). Đã mở ảnh bản in và kiểm tra bố cục.

## Hiện vật

Trong `apps/client/test-results/artifacts/` (không track Git):

- `schedule-schedule-prints-t-d4e07--context-and-no-site-chrome-desktop/schedule.pdf`
- `schedule-schedule-prints-t-d4e07--context-and-no-site-chrome-desktop/schedule-long-table.pdf`
- `schedule-schedule-prints-t-d4e07--context-and-no-site-chrome-desktop/schedule-print.png`
- `schedule-schedule-renders--65597-ames-and-the-event-timezone-mobile/schedule-screen.png`
- `schedule-schedule-renders--65597-ames-and-the-event-timezone-desktop/schedule-screen.png`

Log: `apps/client/test-results/schedule-focused.log`, `apps/client/test-results/schedule-regression.log`.

## Môi trường và giới hạn

Lần chạy đầu bị chặn trước seed vì PostgreSQL/Redis local chưa chạy. Đã khởi động các dịch vụ có sẵn bằng Docker Compose qua WSL Ubuntu, giữ nguyên volume; chạy lại trên DB/API thật với cấu hình `.env` hiện hành. Không ghi đè `DATABASE_URL`, không migrate. Seed và cleanup của Playwright đều đạt. Ảnh nhánh cũ do test hồi quy sinh lại đã được khôi phục về nội dung trước task.

Chưa deploy hoặc đo trên staging. Các cảnh báo CSP report-only về `eval` thuộc Next dev có xuất hiện trong log; không chặn tương tác hoặc kết quả test.
