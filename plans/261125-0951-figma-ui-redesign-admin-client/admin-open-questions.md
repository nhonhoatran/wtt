# Admin — câu hỏi cần chốt trước khi làm phần liên quan

Phần trong Figma mà hệ thống chưa có dữ liệu/tính năng, hoặc Figma xung đột quy tắc nghiệp vụ. Mỗi mục: phương án · khuyến nghị · làm gì trong lúc chờ. Không mục nào chặn phase A1–A11 — các phase đã viết theo nhánh "trong lúc chờ".

| # | Việc | Phương án | Khuyến nghị | Trong lúc chờ |
|---|---|---|---|---|
| Q1 | Chuông thông báo ở header | (a) Bỏ hẳn. (b) Chuông = lối tắt "việc cần xử lý" tính từ dữ liệu có sẵn (trận quá giờ chưa có kết quả, import cần xác nhận, BXH có nội dung chưa tính lại), không lưu trạng thái đã đọc. (c) Hệ thống thông báo đầy đủ (bảng mới, đã đọc/chưa đọc, đẩy realtime) | (b) — đủ giá trị, không cần schema; (c) tốn công và cần định nghĩa ai nhận gì | Không vẽ chuông (A1). Dashboard (A2) đã có KPI "Cần xử lý" |
| Q2 | "Xem trước trang giải" khi giải còn nháp | (a) Chỉ "Xem trang giải" khi đã công bố. (b) Link preview có token ký hạn ngắn, site công khai render bản nháp `noindex` | (a) cho bản này; (b) là tính năng client + API riêng, đụng cache công khai | Nút disabled + tooltip khi nháp (A4) |
| Q3 | Tab trạng thái ở danh sách giải: Figma trộn "Nháp / Đã công bố / Đang diễn ra / Đã kết thúc" | (a) Tab theo vòng đời + lọc công bố riêng. (b) Đúng Figma (số đếm chồng nhau, giải đang diễn ra cũng là đã công bố) | (a) — các tab loại trừ nhau, tổng khớp "Tất cả"; thêm "Đã hủy" | Làm (a) ở A3; đổi được sau vì chỉ là UI |
| Q4 | "Xuất Excel" danh sách giải và bảng xếp hạng | (a) Không làm. (b) Thêm export theo mẫu module `exports` hiện có (entries/schedule/results), tôn trọng lọc đang áp | (b) cho BXH (BTC hay gửi file); danh sách giải ít nhu cầu → (a) | Ẩn nút (A3, A11) |
| Q5 | Cột "Cách sửa" + "Tải danh sách lỗi" khi nhập Excel | (a) Giữ thông điệp hiện tại (đã nói lỗi gì). (b) Worker trả mã lỗi; admin map mã → câu "cách sửa"; export dòng lỗi ra .xlsx để sửa rồi tải lại | (b) phần mã lỗi + "cách sửa" (giảm vòng sửa-tải lại); export dòng lỗi làm sau nếu BTC cần | Hiện thông điệp hiện có trong panel mới (A6) |
| Q6 | Trạng thái đăng ký "Chờ xác nhận" | (a) Không có — chỉ Đang tham gia / Đã rút. (b) Thêm giá trị enum `PENDING` (migration) + quy tắc: không vào bốc thăm, không tính chỉ tiêu, ai duyệt | Cần BTC cho biết quy trình đăng ký thực tế; nếu đăng ký đều qua BTC nhập tay thì (a) | Hiện 2 trạng thái hiện có (A6) |
| Q7 | Tránh VĐV cùng CLB chung bảng khi sinh bảng | (a) Chỉ cảnh báo + đổi chỗ tay. (b) Thuật toán chia bảng tự tách CLB (ràng buộc mềm), CLB đang là text tự do nên cần chuẩn hoá | (a) ngay; (b) nếu luật giải yêu cầu — cần xác nhận luật và cách viết tên CLB | Cảnh báo + Tag "Trùng CLB" (A7) |
| Q8 | Màu theo nội dung (viền ô lịch + chú giải) | (a) Không màu, dùng Tag mã nội dung. (b) Cột `Discipline.colorHex` nullable (migration), sửa ở danh mục Nội dung chuẩn, fallback trung tính | **Đã chốt (b), 2026-11-27** | Đã triển khai/kiểm G; giữ mã/tên và viền cảnh báo, migration chỉ áp DB test. [Báo cáo](../reports/tester-261127-import-colors-runner.md) |
| Q9 | "Tự động xếp" lịch | (a) Không làm. (b) Xếp tham lam theo thứ tự vòng, tránh trùng VĐV, giờ nghỉ tối thiểu (setting) — chạy ở server, trả bản đề xuất để duyệt rồi mới ghi | **Đã chốt (b), 2026-11-27** | Đang thực hiện workstream H trong [plan trả nợ](../261127-debt-closure/plan.md); chưa đánh dấu nghiệm thu |
| Q10 | "Ghi chú" trên phiếu nhập kết quả | (a) Không. (b) Cột `Match.resultNote` nullable + audit; hiện ở đâu (chỉ nội bộ hay công khai) | Hỏi BTC có cần ghi sự cố trận không; nếu cần → (b), chỉ nội bộ | Không vẽ ô ghi chú (A9) |
| Q11 | "Hoạt động gần đây" dạng câu có tên đối tượng | (a) "Người · hành động · giờ" từ audit log hiện có. (b) Làm giàu ở API: tra tên giải/trận/nội dung theo `entityId` khi đọc | (a) đủ dùng; (b) khi BTC thấy thiếu | (a) ở A2 |
| Q12 | "Khôi phục mặc định" quy tắc điểm | (a) Không làm. (b) Định nghĩa bộ mặc định (lưu ở setting JSON) + nút áp bộ đó thành phiên bản mới có ngày hiệu lực | Cần BTC định nghĩa "mặc định" là bảng nào; nếu không có thì (a) | Không có nút (A10) |

## Đã tự quyết theo hướng dễ dùng hơn Figma (không cần chốt, ghi để review)
- Giữ đủ mục menu (Nhập tỷ số, Lịch sử import, Sổ điểm, Kỳ chốt, Hộp thư liên hệ, tab Tài trợ) — Figma bỏ sót, xoá là mất chức năng.
- Lịch: không khung giờ cố định, không nút "Lưu lịch" (giờ do thời lượng thể thức quyết định; lưu ngay an toàn hơn).
- Nhập kết quả: giữ drawer + tự mở trận kế tiếp cùng bàn thay vì trang riêng.
- Import Excel: giữ một file cho cả giải; bỏ checkbox "bỏ qua dòng lỗi" (commit vốn đã bỏ qua và hộp xác nhận nói rõ).
- Bốc thăm vòng bảng + nhánh chính: hai lần công bố (ràng buộc `GROUP_DRAW_NOT_PUBLISHED`).
- Quy tắc điểm: không "Thêm vòng đấu"; thời hạn hiệu lực hiện theo từng BXH.
- Stepper tiến độ chỉ là chỉ báo, không chặn công bố giải.
- Mục menu đang chọn dùng đỏ đậm `primaryStrong` (đỏ thương hiệu + chữ trắng chưa đạt 4.5:1).

## Đã chốt thêm (2026-11-25)
- Một bảng xếp hạng được phép chốt nhiều kỳ trong cùng một ngày; API không chặn. "Kỳ trước" thống nhất là bản đã chốt mới nhất khác bản đang xem (khớp worker và bước chốt).
- Tên site (`site.name`) sửa được trên `/settings`; sider admin và wordmark site công khai đọc từ setting này.
