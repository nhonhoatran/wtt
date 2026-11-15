# 2026-11-15 — Rà ghi nợ review phase 08

- Đọc lại review lát cắt và ba đợt cũ, đối chiếu code; phân biệt mục đã sửa, quyết định giữ có lý do và việc còn mở. Nguồn theo dõi: `plans/reports/reviewer-261115-phase08-review-debt-audit.md`.
- Sửa góc cạnh IP/rate limit, đếm sau redirect locale, tiếp nhận payload CSP sai kiểu; cô lập settings trong API test và đưa ảnh kiểm thử vào artifact.
- Nav có trạng thái hiện tại, nhãn LIVE dùng chung 5 vị trí, 404 theo locale, canonical lịch theo năm chuẩn hóa, nhãn cột điểm riêng và cache query mặc định gọn hơn. Không refactor toàn bộ ô trận vì dữ liệu và bố cục khác nhau.
- Giữ timeout ở env vì bootstrap API/settings; giữ select GET cho danh sách nội dung động. Tương phản nút vé 4,3954:1 đạt cho chữ lớn 20px/700. Chốt 62 ngày được đặt tên rõ nhưng hạn chế chọn ngày giải dài vẫn còn.
- Kiểm chứng cuối: unit client 20/20; toàn bộ Playwright 45 đạt/7 bỏ qua theo viewport/0 lỗi; typecheck/lint src/tests đạt; rate limit HTTP thật đạt. Báo cáo `plans/reports/tester-261115-phase08-review-debts.md`. Không migration, deploy hoặc commit.
- Còn mở: staging/edge thật, scale cache, lọc timezone/DST, tìm và sắp theo tên công khai, bộ lọc ngày dài. Không coi việc sửa nhỏ là hoàn thành toàn bộ phase 08.
