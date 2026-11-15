# Rà ghi nợ review phase 08

Ngày: 2026-11-15. Phạm vi: các báo cáo review lát cắt và đợt 1–3; giữ nguyên thay đổi lịch công khai đang có.

## Kế hoạch đã đối chiếu

1. Đối chiếu từng ghi nợ với code hiện tại, phân biệt trạng thái lịch sử và việc còn mở.
2. Bổ sung test rate limit cho logic đếm và HTTP thật; ghi kết quả trước/sau cho lỗi được xác nhận.
3. Sửa nhỏ trong phạm vi: chuẩn hóa địa chỉ IP, đếm trang sau redirect locale, tiếp nhận báo cáo CSP lỗi định dạng, trạng thái nav và canonical lịch khi query không hợp lệ; cô lập settings trong test và chuyển ảnh kiểm thử sang thư mục artifact.
4. Chạy typecheck, lint, build, API liên quan và Playwright; cập nhật ma trận ghi nợ và tài liệu theo bằng chứng.

## Chẩn đoán ban đầu

- `public-rate-limit.ts` ghép nguyên hextet IPv6 nên dạng có/không có số 0 đầu tạo bucket khác nhau; Map hiện tính bucket thay vì số IP như nhãn setting.
- `proxy.ts` gọi bộ đếm trước redirect locale nên một lần mở URL chưa có locale bị tính cả redirect và trang đích.
- `csp-report/route.ts` đã chặn stream 8 KB, nhưng `reportsOf` chưa loại phần tử null/sai kiểu trong mảng JSON.
- Những thay đổi cache từ phase 07 và lịch công khai đã có code/test; ghi chú lịch sử chưa phản ánh đầy đủ.

## Ranh giới

- Không deploy staging, không thay schema hoặc migration, không đổi URL DB.
- Những ghi nợ nghiệp vụ/dữ liệu cần thay đổi rộng được ghi riêng cùng bằng chứng, không tự đánh dấu hoàn thành.
- Không ghi đè hay commit các thay đổi đang có; kiểm thử dùng dịch vụ sẵn trong WSL2 và cấu hình đang hoạt động của project.
