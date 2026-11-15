# Hoàn tất nợ code còn lại phase 08

Ngày: 2026-11-15. Yêu cầu: xử lý các nợ thật trong bản đối chiếu review, giữ riêng cổng hạ tầng staging.

1. Lọc trạng thái giải theo timezone từng giải trong SQL trước count/pagination; dùng một thời điểm cho lọc và badge. Tính hai biên ngày DST độc lập.
2. Chuẩn hóa tên công khai trong DB, backfill bằng migration đã review, cập nhật khi tên đổi; tìm kiếm và sắp xếp/phân trang theo tên công khai ở server.
3. Đổi bộ lọc ngày sang date input có biên giải; xử lý lịch dài hơn 62 ngày, fallback trạng thái trận có dữ liệu, dùng hợp đồng typed và tách file contract quá dài.
4. Đọc settings từ DB, không giữ RAM riêng từng API replica. Chuyển cache response API công khai sang Redis dùng chung (giữ TTL/tag), bỏ cache fetch riêng của Next; Redis lỗi thì đọc API trực tiếp, invalidation lỗi trả 503 để worker thử lại. Chặn ghi cache từ request bắt đầu trước invalidation bằng generation fence. Bộ đếm rate limit dùng Redis atomic, fallback bộ đếm cục bộ khi Redis lỗi.
5. Kiểm thử DB/Redis thật, client unit/browser, build/typecheck/lint; review diff và đồng bộ trạng thái. Các chốt kỹ thuật có lý do, không thêm giá trị nghiệp vụ cố định.

Không dùng db push hoặc ghi đè DATABASE_URL. Migration create-only được đọc SQL trước deploy lên DB local cấu hình hiện hành. Staging chỉ triển khai khi có target và cổng preflight thật; không suy ra đạt từ môi trường local.
