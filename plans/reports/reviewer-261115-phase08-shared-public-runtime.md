# Review và kiểm chứng runtime công khai dùng chung

Ngày: 2026-11-15. Phạm vi: `api-client.ts`, `public-response-cache.ts`, `public-redis.ts`, `public-shared-rate-limit.ts`, `public-rate-limit.ts`, route revalidate, matcher proxy và thay đổi bỏ cache settings theo tiến trình API.

## Kết luận review

Không phát hiện lỗi chặn phát hành trong phạm vi đã đọc và kiểm chứng. JSON public dùng Redis chung thay vì cache fetch bền riêng từng Next; `fetch` upstream đặt `no-store`. Lua đọc/ghi cache và phiên bản tag chạy nguyên tử. Mã generation chặn phản hồi đang tải trước invalidation ghi trở lại cache sau invalidation; phiên bản tag không hết TTL nên việc rút ngắn TTL cấu hình không làm sống lại dữ liệu cũ.

Bộ đếm trang/tìm kiếm dùng Lua nguyên tử và thời gian Redis, chia sẻ giữa replica; trần IP và ngày hết hạn được xét cùng thao tác. Khi Redis lỗi, cache đọc bỏ qua và rate limit chuyển fallback cục bộ có giới hạn bộ nhớ. Fallback không bảo đảm hạn mức toàn cụm khi Redis mất kết nối; đó là giới hạn vận hành được ghi rõ, không phải kết quả kiểm chứng failover toàn cụm.

`AppSettingsService.get()` đọc DB thay vì RAM có TTL riêng, tránh một API replica trả lại setting cũ rồi tái cache phản hồi sau invalidation. Matcher không loại mọi URL chứa dấu chấm; vẫn loại những đường dẫn tài nguyên cụ thể. Lớp Host/secret của revalidate được giữ.

## Kiểm chứng hai tiến trình Next production

`pnpm --filter @kamito/client build` đạt: compile production, TypeScript và thu thập trang. Sau đó chạy hai tiến trình `next start` độc lập trên **3101/3102**, cùng API thật trên **3200**, PostgreSQL/Redis local thật. Script tạm nằm trong `apps/client/test-results/multi-instance-smoke.mjs`, không track Git.

Fixture tạo bằng seed hiện có rồi cleanup; chỉ đổi tên event vừa seed. Không sửa settings chung và không ghi đè URL DB. Client dùng namespace Redis riêng cho phép dọn đúng các key của smoke; API đọc cấu hình `.env` bình thường.

Các kiểm tra đều đạt:

1. Hai replica cùng hiển thị tên event ban đầu. Đổi tên trực tiếp trong DB, cả hai vẫn trả tên cũ đã cache trước invalidation — chứng minh bài kiểm tra thực sự đi qua cache.
2. POST revalidate vào **chỉ replica 3101**, rồi cả **3101 và 3102** trả tên mới ngay lượt đọc kế tiếp.
3. Đọc hạn mức thật từ `/site` (**60** lượt tìm kiếm), gửi luân phiên giữa hai tiến trình cùng một IP. Sau tổng 60 lượt, cả hai trả **429**, `Retry-After` dương, `Cache-Control: no-store`.
4. Đường dẫn probe có dấu chấm vẫn chịu hạn mức, không né matcher.
5. Cùng lúc đó prefetch và một IP khác vẫn nhận phản hồi 404 bình thường từ probe không tồn tại.

Kết quả máy đọc: `apps/client/test-results/multi-instance/result.json`. Seed/cleanup đều đạt; ba tiến trình con đã dừng, key Redis của namespace smoke đã xóa. Không có artifact test được track trong repo.

## Kiểm tra bổ sung và giới hạn

`pnpm --filter @kamito/client test`: **35/35 đạt, 7 file**, gồm kiểm Redis thật cho cache chia sẻ và bộ đếm. Build production đạt như trên.

Smoke chủ động gửi header IP khi kết nối Next local, không chứng minh Traefik/CDN production đã cấu hình header tin cậy đúng. Chưa deploy hoặc đo staging; bài kiểm tra là hai tiến trình production trên máy local. Không thử giết Redis trong smoke này. Việc đó không làm giảm bằng chứng về invalidation và hạn mức đang chia sẻ khi Redis hoạt động.
