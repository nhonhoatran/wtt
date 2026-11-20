# Smoke test tải trang giải

Kịch bản `event-page-smoke-test.js` dùng k6 chạy GET trang tổng quan giải, mặc định **5 request/giây trong 120 giây** theo phase 12. Đây là công cụ kiểm thử riêng; không được nhúng vào ứng dụng. Đã kiểm nguồn giấy phép k6 ngày 2026-11-19: [AGPL-3.0](https://github.com/grafana/k6/blob/master/LICENSE.md).

## Chuẩn bị và chạy

- Có staging được cấp phép kiểm thử và một giải công khai đang diễn ra. Không dùng dữ liệu cá nhân thật trong báo cáo.
- Cài k6 theo [tài liệu chính thức](https://grafana.com/docs/k6/latest/set-up/install-k6/). Repo không tự tải hoặc chạy binary.
- Chạy qua domain client để đo cả SSR và proxy. Đối chiếu giới hạn IP trong admin trước khi chạy; test trả 429 sẽ thất bại và không được tính là đạt.
- Đặt URL đầy đủ của trang tổng quan giải. Script từ chối URL thiếu locale, query, fragment hoặc thông tin đăng nhập.

```powershell
$env:EVENT_PAGE_URL = 'https://staging.example.test/vi/events/slug-giai-thu'
k6 run --quiet tests/load/event-page-smoke-test.js | Set-Content -Encoding utf8 plans/reports/event-page-smoke-result.json
$LASTEXITCODE
```

Domain trên chỉ là ví dụ, phải thay bằng staging đã xác nhận. Script không có target mặc định. Mỗi lượt chạy xuất JSON chứa URL, thông số và toàn bộ metrics; lưu exit code cùng báo cáo. Xem `metrics.http_req_duration.values["p(95)"]` để ghi mốc p95 (ms).

| Biến môi trường | Mặc định | Ý nghĩa |
|---|---:|---|
| `SMOKE_RPS` | `5` | Số request mỗi giây |
| `SMOKE_DURATION_SECONDS` | `120` | Thời gian cấp tải |
| `SMOKE_PREALLOCATED_VUS` | `10` | Số người dùng ảo khởi tạo sẵn |
| `SMOKE_MAX_VUS` | `50` | Trần người dùng ảo để duy trì nhịp tải |
| `SMOKE_REQUEST_TIMEOUT` | `10s` | Hạn chờ từng request |

Các số trên là cấu hình mặc định, không phải giới hạn nghiệp vụ. Không có ngưỡng p95 tự đặt: phase 12 yêu cầu ghi mốc, không đặt tiêu chí p95. Test chỉ đạt khi không có 5xx, request thất bại, status khác 200 hoặc iteration bị bỏ vì thiếu VU. Không tự theo redirect để tránh đo nhầm trang đăng nhập/404. [Executor constant-arrival-rate](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/) giữ nhịp cấp request độc lập với thời gian đáp ứng.

## Trạng thái nghiệm thu

Đã kiểm cú pháp bằng Node và chạy `k6 inspect` bằng image `grafana/k6:2.4.0` ngày 2026-11-19; engine đọc đúng 5 request/giây, 2 phút và các threshold. Lệnh inspect chỉ đọc kịch bản, không phát request tới target.

Chưa chạy trên staging: cổng hạ tầng phase 01 còn mở. Việc có script hoặc kiểm tra tại local không thay thế kết quả staging, Lighthouse, axe, rollback hoặc khôi phục sao lưu.
