# Kiểm thử các khoản nợ review phase 08

Ngày: 2026-11-15. Phạm vi: rate limit, CSP, điều hướng/ngôn ngữ/SEO và hồi quy site công khai.

## Kết quả cuối

| Lệnh | Kết quả |
|---|---|
| `pnpm --filter @kamito/client test` | 20/20 unit test đạt, 4 file; gồm 18 ca rate limit/proxy/CSP và 2 ca URL/cache |
| `pnpm --filter @kamito/client exec playwright test` | 45 đạt, 7 bỏ qua theo viewport, không lỗi |
| `pnpm --filter @kamito/client typecheck` | Đạt |
| `pnpm --filter @kamito/client lint` | Đạt |
| `pnpm --filter @kamito/client exec eslint tests/unit tests/e2e vitest.config.ts` | Đạt |

Log trình duyệt cuối: `apps/client/test-results/phase08-debt-regression-final.log` (thời gian chạy khoảng 1,5 phút). Bảy ca bỏ qua là các bản chạy trùng không phù hợp viewport: kiểm HTTP và navigation chỉ desktop; kiểm 390 px chỉ mobile; PDF chỉ desktop.

## Bằng chứng về rate limit

Trước sửa, unit test tái hiện hai lỗi thật: IPv6 có nhóm thêm số 0 tạo key khác địa chỉ viết gọn; IPv4-mapped IPv6 không cùng key với IPv4 và gộp các IPv4 vào một nhóm. Sau sửa, cả hai ca đạt, cùng ca IPv6 có zone (`fe80::1%eth0` / `fe80::2%1`).

Unit test còn kiểm tra:

- Cửa sổ đếm, làm tròn `Retry-After`, reset sau hết hạn, bucket tìm kiếm thấp hơn bucket trang và IP độc lập.
- Trần bộ nhớ tính theo IP: hai IP đầu đều có bucket tìm kiếm được thực thi, IP mới vượt trần đi qua theo quy tắc fail-open.
- Một request cấu hình duy nhất cho nhiều lượt truy cập đồng thời; refresh nền không chặn khách khi API treo; giữ hạn mức cũ khi refresh lỗi; chưa từng có cấu hình thì fail-open.
- Địa chỉ sai định dạng chuyển sang fallback; cảnh báo `unknown` một lần.
- Redirect locale không tính lượt, trang đích tính một lần; revalidate nội bộ giữ lớp chặn Host.

Test HTTP thực tế chạy qua **Next proxy thật** và cấu hình **API `/site` thật**, không mock và không sửa AppSetting trong DB. Ca này thực thi thành công trong khoảng 5,1 giây: gửi prefetch trước, gửi đủ số request tìm kiếm theo cấu hình hiện hành, request tiếp theo nhận `429`, `Retry-After` dương và `Cache-Control: no-store`; cùng IP vẫn mở trang không tìm kiếm; IP khác và prefetch vẫn đi qua.

Giới hạn: test local chủ động đặt header IP của reverse proxy. Việc Traefik trên staging thay thế header do khách gửi vẫn phải kiểm trên staging; kết quả này không chứng minh cấu hình biên production.

## CSP, SEO, ngôn ngữ và ảnh

- Unit kiểm Reporting API có `null`, `body: null`, `body: 'bad'` chỉ ghi log phần tử hợp lệ; trường log dài bị cắt; giới hạn số log; JSON sai được bỏ qua.
- Body có `Content-Length` quá lớn bị loại. Body stream UTF-8 vượt trần byte dù khai chiều dài nhỏ bị hủy; không parse/log phần vượt trần.
- HTTP POST mảng CSP sai cấu trúc vẫn trả 204.
- Calendar với năm sai hoặc năm lặp dùng canonical mặc định; năm hợp lệ khác mặc định giữ query trong canonical. Đạt trên hai cấu hình viewport.
- Menu phân biệt trang hiện tại (`page`) với vị trí trong mục giải (`location`), không đánh dấu nhầm tab lịch.
- Trang giải không tồn tại dưới `/en` hiển thị lỗi tiếng Anh và link về `/en`.
- Tiêu đề cột bảng tỷ số là `Bên thi đấu`.
- Test ảnh nhánh ghi vào `testInfo.outputPath`, không ghi đè ảnh track trong `plans/reports`.
- Hồi quy giữ nguyên kiểm lịch/in từ công việc trước. PDF stress dài vẫn có 3 trang; `pypdf` chuẩn hóa NFKD và bỏ khoảng trắng xác nhận tên giải/buổi/bàn/múi giờ trên từng trang.

## Lịch sử kiểm tra trung thực

Lần chạy trước cuối có 41 ca đạt, 7 bỏ qua, 2 lỗi do assertion bảng tỷ số vẫn mong nhãn cũ trong khi giao diện vừa đổi nhãn. Đã cập nhật assertion đúng yêu cầu rồi chạy lại toàn bộ: 45 đạt như bảng kết quả cuối. Không sửa dữ liệu ứng dụng để làm test đạt.

Vitest 5.0.5 được thêm dưới dạng devDependency của client, cùng phiên bản đã dùng trong API. Các mock chỉ dùng để cô lập phụ thuộc của unit test, không dùng cho các ca HTTP/Playwright. Không chạy migration, không ghi đè URL DB. Chưa kiểm staging.

## Kiểm tra Git cuối

`git diff --check` đạt; chỉ có thông báo chuyển CRLF sang LF, không có lỗi khoảng trắng. Không có ảnh/PDF track trong Git bị thay đổi. Kiểm tra các dòng thêm mới và file chưa track không phát hiện private key, provider token, mật khẩu nhúng trong URL kết nối hoặc xưng hô riêng tư. Đây là kiểm tra mẫu nhận diện cục bộ, không phải bằng chứng tuyệt đối không còn bí mật.

Không stage, commit hoặc push. File `apps/client/AGENTS.md` do Next dev sinh ra vẫn cần được loại khỏi thay đổi trước khi commit; người phụ trách chính xử lý.
