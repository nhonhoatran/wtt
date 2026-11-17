# 2026-11-17 — Phase 10: xếp hạng và hồ sơ VĐV công khai

## Bối cảnh

Triển khai phase 10 trên dữ liệu snapshot, VĐV và giải đã có. Thay đổi nằm trong working tree; staging chưa có do cổng hạ tầng phase 01. Không đổi schema hay chạy migration.

## Thay đổi và quyết định

- Bốn trang SSR vi/en cho xếp hạng, bảng đầy đủ, VĐV và hồ sơ; lọc/sắp xếp/phân trang tại PostgreSQL, form GET và native `<details>`. Điểm đọc từ kỳ đã công bố, không từ ledger sống. Top N cấu hình qua `/settings`.
- Review phát hiện tên thật còn lộ trong slug dù label đã dùng alias. Chuyển URL chuẩn sang `p-<UUID>` cho toàn bộ link/serializer/canonical; giữ redirect 301 của slug cũ/gộp tới đích công khai. Tag revalidate gửi cả hai dạng định danh. Hồ sơ ẩn không có link/ảnh; metadata giữ `noindex`, chưa sitemap VĐV hoặc JSON-LD `Person`.
- CLB ghi tối đa 200 ký tự nhưng lọc từng cắt ở 100. Dùng `PLAYER_CLUB_MAX_LENGTH` chung cho DTO và query để CLB hợp lệ không mất kết quả.
- Snapshot breakdown cần giữ `eventId` nội bộ ổn định. Nếu chỉ tin slug, giải khác dùng lại slug có thể làm lộ nhãn của giải cũ đã ẩn. Nhãn/điểm giữ bất biến, link theo slug hiện tại của cùng id; snapshot cũ thiếu id che nhãn/link, vẫn giữ điểm/ngày. Không sửa kỳ đã công bố.
- Đo nhiều khoản điểm thay fixture một khoản: 50 VĐV × 20 khoản tạo JSON 377.129 byte, gzip 9.307 byte. Ngân sách 80 KiB áp cho bytes truyền HTTP sau nén; raw vượt mốc được ghi rõ. Gzip không cắt chi tiết; overview không tải phần không hiển thị.
- Next.js nâng 16.4.3 lên 16.4.5 theo [bản vá chính chủ](https://github.com/vercel/next.js/security/advisories/GHSA-mfr8-8qww-v76h), thay vì bỏ qua lỗi dừng build.

## Kiểm chứng

API tích hợp và hồi quy liên quan đạt 111 test duy nhất trên 15 file, API unit revalidation 16/16; ranking-engine 36/36, worker 39/39, client unit 45/45 và shared 101/101 trên 22 file. Playwright sau F4 đạt 24/24 trên desktop/mobile, không bỏ qua test. Typecheck/lint và build API/worker/client đạt. Thử công bố thật → BullMQ → HTML SSR đã làm nóng đạt 644 ms với 1 job hoàn tất. Chi tiết trong [báo cáo QA](../../plans/reports/tester-261117-phase-10-public-rankings-players.md); bằng chứng payload và công bố ở `apps/api/test-results/public-ranking-payload-budget.json`, `apps/api/test-results/public-ranking-publish-refresh.json`. Đây là kiểm thử local, chưa xác nhận staging.

## Ghi nhận

Che nhãn là chưa đủ nếu URL vẫn chứa tên thật. Phạm vi dữ liệu lịch sử cần định danh ổn định, vì slug có thể đổi hoặc dùng lại. Giới hạn payload phải nêu rõ raw hay wire và đo bằng fixture đủ dày, đồng thời giữ nguyên khả năng giải thích điểm.

## Việc tiếp theo

Kiểm công bố kỳ mới trên staging khi có hạ tầng và công bố kỳ mới để snapshot lịch sử có định danh giải ổn định. Tiếp tục chờ quy chế điểm G2 và đồng ý công khai hồ sơ; giữ các cờ hạn chế SEO cho tới khi có quyết định.
