# Phase 08 — Lọc trạng thái giải theo múi giờ và ngày DST

Ngày: 2026-11-15. Đóng nợ đợt 1 M4 và L9 của review API công khai.

## Thay đổi

- `apps/api/src/modules/public-events/public-event-list-filter.ts`: SQL tham số hóa tính ngày hiện tại theo timezone từng giải. Predicate công khai lấy giá trị từ `publicScope.events`; search/tier/type/year/status đều được áp trước `COUNT`, `LIMIT`, `OFFSET`.
- `public-events-list.query.ts`: lấy tổng và ID của đúng một trang từ SQL, chỉ hydrate các card đã cắt trang qua whitelist Prisma. Không tải toàn bộ giải về JavaScript để lọc. Một thời điểm được chụp đầu request và truyền vào `toPublicEventCard`, tránh badge và filter lệch khi qua nửa đêm. Calendar cũng dùng một thời điểm cho các card trong cùng response.
- SQL xử lý cả timezone IANA và offset cố định mà Intl chấp nhận (`+05:30`, `+0530`, `-08`). PostgreSQL hiểu dấu của timezone offset dạng text khác Intl; nhánh offset được chuyển thành phút và cộng vào UTC thay vì gọi thẳng `AT TIME ZONE` với chuỗi đó.
- `public-query-params.ts.zonedDayRange`: tìm độc lập đầu ngày đã chọn và đầu ngày kế bằng ngày địa phương qua Intl. Không cộng 24 giờ vào một timestamp địa phương. Biên tìm ±48 giờ là giới hạn kỹ thuật lớn hơn mọi UTC offset IANA, không phải cấu hình nghiệp vụ.

## Kiểm chứng

- `pnpm --filter @kamito/api test src/modules/public-scope/public-query-params.test.ts public-event-timezones.e2e-spec.ts public-events.e2e-spec.ts`: **3 file / 21 ca đạt**.
- `pnpm --filter @kamito/api test public-match-dst.e2e-spec.ts public-event-timezones.e2e-spec.ts src/modules/public-scope/public-query-params.test.ts`: **3 file / 14 ca đạt**.
- `pnpm --filter @kamito/api typecheck`: đạt.
- ESLint các query/serializer/helper và hai suite mới: đạt.
- `git diff --check` trong phạm vi: đạt.

Unit test có ngày New York 23/25 giờ, Sao Paulo bỏ giờ nửa đêm, Apia bỏ cả ngày và offset `+05:30`. Test API thật kiểm bảy timezone tại cùng thời điểm; page size giả lập trong riêng instance test bằng 2 để kiểm count, số phần tử từng trang, trang hết dữ liệu, không trùng và badge cùng trạng thái. Không thay setting trong DB. Suite trận riêng kiểm thời điểm 23:30 địa phương được lấy còn nửa đêm kế bị loại trên cả ngày DST xuân và thu.

## Review

Điểm: **9,5/10**, không phát hiện critical/high/medium trong phạm vi timezone/DST sau kiểm thử. Các mảnh SQL động chỉ ghép `Prisma.sql` cố định; giá trị người dùng, timestamp, LIMIT/OFFSET đều là tham số bind. Query hydrate tiếp tục lọc event công khai; ID chỉ dùng nội bộ, không thêm vào serializer.

Không thay schema hoặc migration cho phần này. Các migration tên công khai thuộc tác vụ riêng, không phải yêu cầu của timezone. Chưa đo staging hoặc load test. Raw count và page vẫn là các truy vấn riêng như luồng trước; không đưa ra bảo đảm snapshot transaction đối với thay đổi giải đồng thời.
