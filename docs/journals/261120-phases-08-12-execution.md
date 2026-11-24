# Phase 08–12 — Bổ sung phần kiểm được ở local

Ngày: 2026-11-20.

- Nhánh 64 khi in thực sự cắt tên: baseline Chromium ghi 64 ô bị ellipsis. Sửa cấu trúc chỉ dành cho in, chia nhánh con và giữ số trận; tám PDF A4/A3 có đủ tên, 63 trận duy nhất và ngữ cảnh từng trang. Không kéo thêm dữ liệu hoặc thay grid màn hình.
- Root bắt thêm khoảng trống trong fixture đầu: EventShell/Hero đầy đủ làm A4 tăng thành sáu trang. Đã tái hiện rồi sửa chỉ bản in nhiều tờ, giữ screen và nhánh nhỏ; chạy lại chín ca/tám PDF đạt năm trang. Client typecheck/lint/build và 72 unit sau sửa cuối đạt.
- Ma trận điểm đã có nhiều kiểm browser/API nhưng thiếu unit state. Tách hàm thuần và thêm 18 ca giúp kiểm điểm 0/ô trống, hoàn tác, sao chép và scope phiên bản; không đổi quy chế mẫu hay semantics preview chưa chốt.
- Giai đoạn đầu chỉ chuẩn bị publishing/sweep/retention, axe và runner Lighthouse; chưa chạy DB khi chưa được xác nhận target. Sau đó đã được cho phép dùng riêng `localhost:5433/kamito_tt_phase12_test`, đủ 18 migration/seed danh mục; các agent nhận lease tuần tự để tránh tranh chấp settings/world.
- Hồi quy nguồn chạy thật; client cần Redis và chỉ đạt sau bật riêng dịch vụ hiện có. Không sửa môi trường DB để làm xanh test.
- Audit mới phát hiện Effect high qua Prisma config; vá bằng override riêng 3.22.1. Audit cuối hết high/critical nhưng còn hai moderate, exit 1. Build/validate và API/client/admin/shared/worker test chạy lại sau frozen install đạt.
- API thật cuối đạt 132 ca duy nhất/21 spec, gồm 5 publishing/sweep/retention. Batch gộp native crash Windows được giữ riêng; chạy từng spec một process đạt, không giả dịch vụ để làm xanh. Hai JSON legacy generated từng bị ghi đè trước khi tách artifact directory; không có backup để tuyên bố khôi phục lịch sử, báo cáo nêu rõ giới hạn đó.
- Browser production sau sửa accessibility đạt 96 ca/8 skip có chủ đích, 0 lỗi/0 flaky. Axe baseline có serious thật ở tương phản Play và nhãn ARIA biến động thứ hạng; sửa bằng token existing/text visually-hidden, siết gate serious+critical rồi chạy lại 36 scan: mọi mức violation đều 0. Công bố BXH → BullMQ → SSR desktop 209 ms/mobile 218 ms.
- Lighthouse đầu tiên tiếp tục bắt lỗi thiếu mô tả SEO home/giải/nhánh (92 điểm SEO), không được bỏ qua dù axe sạch. Sửa description theo dictionary và fallback summary blank, giữ nguyên authored text/canonical. Unit client 83/83, metadata 12 ca; rebuild rồi focused browser metadata/axe 27 đạt/5 skip và 36 scan mọi mức 0. Full 96/8 là build trước metadata; không cộng trùng hoặc nói focused thay full suite/Lighthouse.
- Bổ sung lát cắt API thật tạo/công bố giải bốn entry rồi operator confirm; cache còn khoảng 30 giây nhưng hai trang SSR cập nhật trong 133 ms. Kiểm teardown phát hiện job ranking/metadata queue còn ngoài queue revalidate; sửa cleanup đúng UUID và kiểm không có worker khác. Rerun cuối đạt, record/response/queue key fixture đều 0; key auth rate-limit riêng UUID tự hết TTL, `.env` hash không đổi.
- Lighthouse r02 sau metadata đạt thật, giữ ngưỡng 85/90/95: home 100/100/100, event 99/100/100, draw/BXH 100/100/100; mọi runtimeError null, phiên bản 13.6.0 mobile/simulated. R01 fail và các baseline trước sửa giữ riêng. Tải nhẹ có packet riêng; không lấy self-check công cụ hoặc điểm local làm số đo staging.
- Smoke k6 local 600 request/iteration/check HTTP 200, 0 failed/5xx/drop; bốn threshold đạt, không hạ tiêu chí. Cấu hình 5 arrivals/s × 120 s nhưng raw aggregate rate 4,659093/s phải giữ đúng, không thay bằng 5/s; p95 14,125 ms, p99 30,986 ms. Dùng image có sẵn, không pull/cài, container riêng đã gỡ; chỉ đo cached HTML GET, không gọi là tải browser/staging.
- Sweep ban đầu trước DB là 134/163 checkbox, 29 mở. Kết quả dịch vụ thật không tự thay số checkbox; điều phối/PM cập nhật riêng theo cổng. G1/G2, M1/M2, full UI tám bước, consent, CSP enforce, staging và ra mắt vẫn mở.
- Sau các phép đo, retained fixture IDs được dọn về 0; stop đúng identity API/client, hai cổng trống, `.env` hash khớp đầu lượt, giữ PostgreSQL/Redis. Không đụng residue không rõ chủ từ native crash. PM sweep cuối và reviewer đếm lại 12 phase vẫn 134/163, 29 mở; bằng chứng QA local tăng lên nhưng không đánh tráo cổng staging.

Chi tiết: [PM sweep](../../plans/reports/pm-261120-phases-08-12-sync.md), [print64](../../plans/reports/tester-261120-phase08-print64-desktop1440.md), [ranking admin](../../plans/reports/tester-261120-phase09-admin-unit.md).

Bổ sung dịch vụ thật: [API](../../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261120-real-api.md), [public/axe](../../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261120-real-public-and-axe.md), [lát cắt local](../../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261120-local-vertical-slice.md), [review](../../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/code-reviewer-261120-real-services.md).

Đo sản phẩm sau sửa: [Lighthouse](../../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261120-real-lighthouse.md).

Đo tải riêng sau Lighthouse: [smoke local](../../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261120-real-smoke.md).

Trạng thái sau cùng: [PM dịch vụ thật](../../plans/reports/pm-261120-real-services-sync.md).
