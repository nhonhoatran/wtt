# 2026-11-15 — Hoàn tất nợ code phase 08

- Lọc giải bằng SQL theo timezone từng giải trước count/paginate; badge dùng cùng thời điểm. Hai đầu ngày DST được tính độc lập.
- Migration `20261115032757_add_player_public_name_key` thêm trigger/backfill/index cho tên công khai, đã áp dụng DB dev local (16/16); staging chưa. Tìm không dấu và sort đơn/cặp theo tên công khai trước chia trang, không dựa thứ tự tên pháp lý.
- Bỏ danh sách ngày tối đa 62; date input có min/max theo giải và validator server. Trạng thái tự chọn dừng ở nhóm có trận, giữ tab chọn rõ ràng. Home dùng status typed, contract chia theo sự kiện và thi đấu.
- Cache JSON/tag và rate limit dùng Redis chung; generation fence chặn ghi cũ sau invalidation. API settings đọc DB, không RAM riêng. Hai Next production local đã kiểm invalidation và hạn mức dùng chung; Redis lỗi có fallback được ghi rõ.
- Kiểm cuối: 51 Playwright đạt/7 bỏ qua; 6 ca mới chạy lại trên Next production với JavaScript bật đạt; client 41 unit và build/typecheck/lint đạt. Ảnh date input 390 px đã mở kiểm. Lượt focused dev có navigation lặp chưa xác định chắc nguyên nhân; không dùng kiểm tắt JavaScript để thay thế.
- Lượt cuối toàn bộ production dùng Next đã build + API `dist/main.js`, cặp port mới và `CI=1`: 51 đạt/7 bỏ qua, 31,3 giây. Hai lượt trước API source mất kết nối được ghi rõ trong báo cáo, không kết luận nguyên nhân thiếu bằng chứng.
- Còn cổng staging/M1/M2 và xác nhận hạ tầng thật; không đồng nhất local production processes với deploy production. Báo cáo `plans/reports/tester-261115-phase08-remaining-debts.md`.
