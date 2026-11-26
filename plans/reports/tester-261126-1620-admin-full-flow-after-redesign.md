# Admin full-flow E2E sau redesign Figma — 2026-11-26

Đóng backlog L4 và ô "E2E admin-full-flow sau redesign" của A8, A9, A10, C11. Suite: `apps/client/playwright.admin-full-flow.config.ts`, một spec tám bước, project `desktop` 1440×900 và `mobile` 390×844.

## Kết luận

- Lượt 1–10 (bản dựng trước khi sửa API): desktop đạt 8/8 một lượt, mobile đạt 8/8 hai lượt.
- Sáu lượt rớt vì bốn nguyên nhân riêng: một do test (đã sửa), ba do môi trường hoặc lỗi API có sẵn (ghi nợ E1–E3, bổ sung T2).
- Lượt 11–12 (helper cuối, API đã sửa E1): desktop đạt 8/8 và mobile đạt 8/8, chạy liền nhau. Đóng E1 và E3.
- Mã sản phẩm đổi một chỗ: thứ tự đọc Redis trong `ranking-enqueue.service.ts` (E1), kèm test hồi quy. Phần còn lại là helper test.

## Môi trường

| Mục | Giá trị |
|---|---|
| DB | `localhost:5433/kamito_tt_phase12_test` (runner tự đổi tên DB; `.env` gốc trỏ `kamito_tt_dev`, không đụng) |
| Redis | cục bộ, prefix `kamito-tt:test:full-ui:<uuid>` theo từng lượt |
| Cổng | API dist 3371, admin `vite preview` 3372, `next start` 3373 |
| Bản admin | `dist/assets/index-DsgUM6wi.js` cho mọi lượt tính kết quả |
| Bản API | Lượt 1–10: dist trước khi sửa E1. Lượt 11–12: dist dựng lại sau khi sửa (`pnpm --filter @kamito/api build` exit 0) |
| Lệnh | `REAL_TEST_DB_LEASE=full-ui node test-results/261120-full-ui-runner.mjs <desktop\|mobile> --run` |
| `.env` | hash không đổi ở mọi lượt (`envUnchanged: true`) |

Trước khi chạy đã dọn tiếp lượt `desktop-69832926…` ngày 2026-11-25 bị ngắt giữa bước dọn: 0 dòng sót, 206 khóa Redis.

## Các lượt

Thư mục kết quả: `test-results/261120-full-ui-<mã lượt>/`. Giờ theo máy (UTC+7).

| # | Lượt | Giờ | Kết quả | Dừng ở | Nguyên nhân |
|---|---|---|---|---|---|
| 1 | `desktop-d3e4e4aa…` | 15:21 | Rớt | Bước 4 | Helper gõ lý do sửa tỷ số khi hộp thoại còn chuyển focus (đã sửa) |
| 2 | `desktop-b454234d…` | 15:25 | **Đạt 8/8** | — | 8,7 phút; 60 lần làm mới, chậm nhất 1380 ms |
| 3 | `mobile-994680a1…` | 15:35 | Rớt | Bước 4 | Worker Vitest thoát mã `3221226505` (`0xC0000409`); trang công khai ngừng làm mới |
| 4 | `mobile-3260a794…` | 15:41 | Rớt | Bước 1 | Bấm option "Tạo VĐV mới" bị phần tử khác chắn |
| 5 | `mobile-bf717639…` | 15:46 | Rớt | Bước 1 | Như lượt 4; có bản thử sửa sản phẩm, đã hoàn lại |
| 6 | `mobile-b2fc2803…` | 15:50 | Đạt 8/8 | — | Có mã đo tạm; không tính làm bằng chứng chính |
| 7 | `mobile-a3ea6eee…` | 15:56 | **Đạt 8/8** | — | 4,3 phút; 60 lần làm mới, chậm nhất 796 ms; helper cuối |
| 8 | `desktop-8f77c133…` | 16:01 | Rớt | Bước 4 | `ERR_CONNECTION_REFUSED` tới `localhost:3373` sau 13 trận xác nhận |
| 9 | `desktop-ba432f0c…` | 16:04 | Rớt | Bước 2 | Admin báo "Không kết nối được máy chủ" (API 3371) |
| 10 | `desktop-90974b9e…` | 16:07 | Rớt | Bước 7 | Tác vụ snapshot `completed` nhưng không có `snapshotId`; ba server sống tới cuối |
| 11 | `desktop-c6d3eeff…` | 16:55 | **Đạt 8/8** | — | 7,6 phút; 60 lần làm mới, chậm nhất 851 ms; helper cuối, API đã sửa E1 |
| 12 | `mobile-26a6fdfe…` | 17:04 | **Đạt 8/8** | — | 5,1 phút; 60 lần làm mới, chậm nhất 913 ms; helper cuối, API đã sửa E1 |

Mọi lượt đều dọn xong dữ liệu (`left` toàn 0). Lượt 3 phải dọn riêng, xem mục "Dọn sau khi worker thoát".

## Nguyên nhân và cách xử lý

### 1. Helper đua thời điểm (đã sửa, chỉ mã test)

| File | Lỗi | Sửa |
|---|---|---|
| `ui.ts` `pickOption` (bàn phím) | Dò option bằng mũi tên khi danh sách tải từ API chưa về | Chờ option đầu tiên hiện rồi mới dò; đi theo `aria-activedescendant` vì rc-select chỉ render một cửa sổ option |
| `results.ts` `amendResult` | `fill` chạy hai pha; `GameScoreInputs` tự focus ô điểm đầu sau 80 ms nên chữ rơi vào ô điểm, `digitsOnly` xóa mất, nút lưu không bật | Chờ ô điểm đầu được focus rồi mới gõ |
| `results.ts` `fillWin` | Cùng cơ chế focus ở drawer | Gõ lại tới khi hai ô giữ đúng giá trị; mỗi lần gõ giới hạn 2 giây |
| `ui.ts` `pickOption` (con trỏ) | Trên điện thoại dropdown rộng hơn màn hình làm trang co giãn lúc trượt ra; bấm giữa chừng thì trượt | Chờ hết lớp chuyển động `ant-slide-up-appear/enter` rồi mới bấm |

Số đo của mục cuối (lượt 6, màn 390 px): dropdown `[x=12, rộng=667]`, `innerWidth` và `scrollWidth` của trang đều 679.

Review độc lập: [code-reviewer-261126-1540-admin-full-flow-helper-races.md](./code-reviewer-261126-1540-admin-full-flow-helper-races.md), không có lỗi chặn. Đã sửa theo M1 (comment sai nguyên nhân) và L3 (giới hạn thời gian gõ). M2: `rankings.ts` cần `<strong>` trong `ranking-row-summary.tsx` và `.points strong` trong `ranking-accordion.module.css`, hai file này chưa commit; phải đi cùng một commit với helper.

### 2. Worker thoát `0xC0000409` (T2)

`workers.log` lượt 3: `Command failed with exit code 3221226505`. Runner không tạo `worker-stop.json`, tức worker đã thoát trước khi được báo dừng. Trước đó 11 trận xác nhận làm mới dưới 1,1 giây. Cùng mã lỗi với T2.

### 3. Server mất kết nối giữa lượt (chưa rõ nguyên nhân)

Lượt 8 và 9. Log server không có dòng lỗi; runner lúc đó chưa ghi mã thoát. Sau đó đã thêm một dòng ghi mã thoát vào `261120-full-ui-runtime-support.mjs` (file cục bộ, không nằm trong git); lượt 10 không tái hiện. Lúc đo sau lượt 9, bộ nhớ commit của máy còn trống 4,7/47,4 GB. Chưa chứng minh được liên quan.

### 4. API trả `completed` kèm kết quả rỗng (E1, lỗi sản phẩm có sẵn, đã sửa)

Trước khi sửa, `jobStatus` lấy job (kèm `returnvalue`) rồi mới đọc trạng thái bằng lệnh Redis khác. Job xong giữa hai lần đọc thì trả `state: completed`, `result: null`. Admin coi là xong với `snapshotId: null` (`snapshot-jobs-tracker.tsx:59`) nên không mở được bản nháp vừa tạo. Test bắt được ở `rankings.ts:52`.

Sửa (`ranking-enqueue.service.ts:73-74`): đọc trạng thái bằng `getJobState` trước, đọc job sau. BullMQ ghi trạng thái kết thúc và `returnvalue` trong cùng một lệnh Redis, nên job xong giữa hai lần đọc giờ trả "chưa xong, đã có kết quả" và admin hỏi lại ở nhịp sau. Kiểm chứng:

- Test hồi quy `apps/api/src/modules/ranking-jobs/ranking-enqueue.service.test.ts` (unit, không kết nối DB hay Redis): exit 1 trước khi sửa, exit 0 sau khi sửa.
- `pnpm --filter @kamito/api typecheck`, eslint thư mục `ranking-jobs`, `pnpm --filter @kamito/api build`: exit 0.
- Review độc lập: không có lỗi chặn. Chỉ ra một điểm có sẵn ngoài phạm vi, ghi nợ E4: admin coi 404 là xong mà không có `snapshotId` (`snapshot-jobs-tracker.tsx:50-59`).
- Lượt 11 và 12 qua bước 7 và 8; mỗi lượt ghi ba snapshot trong `run.json`.

Thân phản hồi lấy từ trace lượt 10 (`GET /api/v1/admin/ranking/jobs/rank-snap-56bcacf6…`):

```json
{"data":{"id":"rank-snap-56bcacf6-d2e5-48c6-baef-6b2cdcd2e216","name":"build-snapshot","state":"completed","attemptsMade":0,"failedReason":null,"result":null}}
```

`attemptsMade: 0` đi cùng `state: completed` cho thấy phần dữ liệu job được đọc trước khi worker xử lý, còn trạng thái được đọc sau. Job liền kề trong cùng lượt trả đúng: `attemptsMade: 1`, `result.snapshotId` có giá trị.

## Dọn sau khi worker thoát

Bước dọn của runner yêu cầu `full-ui-worker-stopped.json` khi đã có `worker-ready.json`. Worker thoát đột ngột nên không ghi được file này. Đã kiểm PID worker 31992 không còn và không có `worker-stop.json`, rồi chạy lại riêng `full-ui-cleanup.seed.ts` không truyền `E2E_FULL_UI_WORKER_READY_FILE`. Kiểm tra thứ hai của bước dọn (Redis không còn worker nào trong prefix) vẫn chạy và đạt. Kết quả: 0 dòng sót, 198 khóa Redis, `.env` không đổi. Ghi chú nằm trong `result.json` của lượt.

## Chưa kiểm

- Chưa mở đối chiếu toàn bộ ảnh/PDF của C11 và C7; chưa review diff cuối.
- Ảnh từng bước và `match-sheets.pdf` của các lượt đạt đã lưu nhưng chưa mở xem từng ảnh.
- Nguyên nhân server mất kết nối ở lượt 8 và 9; chưa tái hiện ở lượt 10–12.
- E1 đua thời điểm thật trên Redis chỉ kiểm bằng test unit mô phỏng thứ tự đọc và hai lượt E2E đạt; không có test tái hiện với Redis thật.
- Bộ test đầy đủ của API chưa chạy lại sau khi sửa E1; chỉ chạy file test mới, typecheck, lint và build.

## Câu hỏi còn mở

1. E2: trên điện thoại, dropdown chọn VĐV nên rộng tối đa bằng màn hình và xuống dòng, hay đổi sang kiểu chọn khác?
2. E4: có sửa luôn đường 404 của bảng theo dõi tác vụ không?
3. Có cần runner tự dọn khi worker thoát đột ngột (kiểm PID thay cho file đánh dấu) không?
