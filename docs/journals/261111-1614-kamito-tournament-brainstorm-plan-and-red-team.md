---
type: journal
date: 2026-11-11
plan: plans/261111-1512-kamito-table-tennis-tournament-platform
tags: [brainstorm, planning, red-team, ui-mockup]
---

# Brainstorm, lập kế hoạch và red team cho web giải đấu bóng bàn Kamito

## Bối cảnh

- Dự án mới, thư mục trống, chưa có git.
- Yêu cầu: web giải đấu cho Kamito (thuộc Midomax), bố cục tham khảo worldtabletennis.com; Next.js client, React admin, NestJS API; PostgreSQL/Redis/MinIO có sẵn; deploy docker-compose trên Dokploy.

## Việc đã làm

- 4 nghiên cứu song song: site tham chiếu (trình duyệt thật), brand Midomax/Kamito, thư viện giải đấu + công cụ capture, admin kit + hạ tầng. Báo cáo ở `plans/reports/`.
- Brainstorm chốt phạm vi, ghi `plans/reports/brainstorm-261111-1512-kamito-table-tennis-tournament-platform.md`.
- Kế hoạch 12 phase tại `plans/261111-1512-kamito-table-tennis-tournament-platform/`.
- Red team 4 góc nhìn (bảo mật, sự cố, giả định, phạm vi): 40 phát hiện → 15 nhóm, nhận cả 15, bác 4 ý con. Bản phân xử ở `reports/` của plan; đã áp vào các phase (125 marker).
- Mockup Stitch: 10 màn client (`assets/designs/client/`), 9 màn admin (`assets/designs/admin/`), chỉ có PNG.

## Quyết định

| Chủ đề | Quyết định |
|---|---|
| Mô hình | Một ban tổ chức, bóng bàn, đơn + đôi; đồng đội để sau |
| Tỷ số / đăng ký | Nhập sau trận theo ván; admin nhập/import Excel |
| Xếp hạng | Có ngay bản đầu; điểm đôi cộng từng VĐV; điểm giải đã xong đóng băng |
| Hàng đợi / realtime | BullMQ; không Kafka, không Socket.IO, không outbox |
| Admin | Refine 5 + antd 5; 2 vai trò; mở ra internet |
| Engine nhánh đấu | Tự viết; bỏ `brackets-manager.js` (plan đã tự đặc tả mọi thuật toán khó) |
| Lịch | 20 tuần: 80 ngày công + 15 dự phòng + tuần Tết; lát cắt dọc cuối tuần 6; pilot BTC tuần 9 |

## Nhìn lại

- Kế hoạch bản đầu xếp kín 80/80 ngày công và để lần chạy trọn một giải tới tuần 9–10. Red team bắt được trước khi code; bài học: yêu cầu lát cắt dọc và ngân sách dự phòng ngay trong đề bài lập kế hoạch.
- Bản đầu thiếu đúng những thứ ngày thi đấu cần: sửa draw sau công bố, sửa tỷ số đã chốt, bản in, gộp hồ sơ VĐV. Thiết kế theo "đường thuận" che mất các ca vận hành.
- Nhiều "sự thật" về thư viện (dedupe job id của BullMQ, ngữ nghĩa `revalidateTag`, giới hạn presigned PUT, mặc định Better Auth) chưa kiểm trên bản sẽ cài → chuyển thành spike/test.
- Stitch MCP: lệnh sinh màn hình timeout phía client ~60 s nhưng màn vẫn được tạo; `list_screens` trả rỗng → mỗi project còn 17–35 màn trùng, cần xóa tay. Mockup vẽ trước red team nên chưa khớp plan đã sửa.
- Một researcher không ghi file báo cáo ở lượt đầu, phải nhắn lại.
- Hook ClaudeKit in đường dẫn reports bị lặp tiền tố (`d:\Project\wtt\D:\Project\wtt\plans\...`) sau khi đặt active plan; các agent sau đó được giao đường dẫn tường minh.
- MinIO community đã archive (2026-04-25): gọi qua S3 API, có kế hoạch đổi kho.

## Tiếp theo

1. Xác nhận ngày bắt đầu; gửi câu hỏi quy chế cho BTC (hạt giống, chia bảng, phá hòa, rút lui giữa bảng, quy chế điểm).
2. Thu thập: brand guideline + logo vector; thông tin hạ tầng (Redis `maxmemory-policy`, dùng chung hay riêng, khả năng truy cập MinIO qua HTTPS, quyền PostgreSQL); tên miền.
3. Chốt tài khoản GitHub, email commit, tên repo trước khi `git init`.
4. Bắt đầu phase 01–02 (nền móng + 4 spike).
5. Dọn màn trùng trong hai project Stitch; vẽ lại mockup cho các luồng mới (sửa draw, sửa tỷ số, bản in) khi cần.
