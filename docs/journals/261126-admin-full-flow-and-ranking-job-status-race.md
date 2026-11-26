# Admin-full-flow sau redesign và lỗi đua thời điểm ở API trạng thái tác vụ xếp hạng

Ngày: 2026-11-26. Phạm vi: chạy E2E `admin-full-flow` sau redesign Figma, sửa helper test, sửa một lỗi API có sẵn, đồng bộ sổ nợ. Không triển khai ra ngoài máy local.

## Bối cảnh và thay đổi

- Đóng backlog L4 và ô E2E của A8, A9, A10, C11 trong [plan redesign](../../plans/261125-0951-figma-ui-redesign-admin-client/plan.md). Runner `test-results/261120-full-ui-runner.mjs`, DB `localhost:5433/kamito_tt_phase12_test`, cổng 3371–3373, bản dựng production.
- Helper `apps/client/tests/admin-full-flow` (`ui.ts`, `results.ts`): chờ option tải xong và dropdown trượt xong rồi mới chọn; chờ ô điểm đầu nhận focus rồi mới gõ.
- API: `RankingEnqueueService.jobStatus` đọc trạng thái (`getJobState`) trước, đọc job sau (`ranking-enqueue.service.ts:73-74`). Thêm `ranking-enqueue.service.test.ts`.

## Kết quả đã kiểm chứng

- 12 lượt, 5 lượt đạt 8/8: desktop `b454234d`, `c6d3eeff`; mobile `b2fc2803` (có mã đo tạm), `a3ea6eee`, `26a6fdfe`. Hai lượt cuối chạy trên helper cuối và API đã sửa. Mọi lượt dọn xong, `.env` không đổi.
- Test hồi quy mới: exit 1 trước khi sửa, exit 0 sau khi sửa. API typecheck, lint thư mục `ranking-jobs`, build: exit 0.
- Hai lượt review độc lập (helper và API): không có lỗi chặn.
- Chi tiết từng lượt: [báo cáo tester](../../plans/reports/tester-261126-1620-admin-full-flow-after-redesign.md).

## Bài học

- Lần sửa đầu cho lỗi bấm trượt trên mobile là đoán sai: đổi độ rộng popup trong mã sản phẩm mà chưa đo. Sau khi đo (dropdown 667 px trên màn 390 px, trang bị nới thành 679 px) mới thấy lỗi nằm ở thời điểm bấm của test; bản thử sản phẩm đã hoàn lại. Đo trước, sửa sau.
- `attemptsMade: 0` đi cùng `state: completed` trong trace là dấu hiệu hai lần đọc Redis không cùng thời điểm. Với BullMQ, đọc trạng thái trước rồi mới đọc dữ liệu job thì kết quả lệch chỉ còn theo hướng an toàn (chưa xong nhưng đã có kết quả).
- Khi worker Vitest thoát đột ngột (`0xC0000409`), bước dọn của runner từ chối chạy vì thiếu file đánh dấu. Phải kiểm PID worker không còn rồi mới dọn riêng.

## Giới hạn và việc tiếp theo

- Hai lần server mất kết nối giữa lượt chưa rõ nguyên nhân, chưa tái hiện. Runner cục bộ đã ghi thêm mã thoát của tiến trình.
- Bộ test đầy đủ của API chưa chạy lại sau khi sửa. Lỗi đua thời điểm chỉ được kiểm bằng test unit mô phỏng thứ tự đọc và hai lượt E2E đạt.
- Còn mở trong [sổ nợ](../../plans/261111-1512-kamito-table-tennis-tournament-platform/open-debts-backlog.md): E2 (dropdown rộng hơn màn hình điện thoại), E4 (admin coi 404 là xong mà không có `snapshotId`), T2. C11 còn đối chiếu ảnh/PDF và review diff cuối.
- Chưa stage, commit hoặc push.
