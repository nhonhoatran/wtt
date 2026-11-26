# Kiểm chứng nợ A8: kéo bàn phím và lưới sáu bàn

Ngày: 2026-11-25. Phạm vi: L1 và L2 trong `open-debts-backlog.md`. Không sửa mã sản phẩm, schema hoặc cấu hình đang hoạt động.

## Kết quả

L1 và L2 đã có bằng chứng trình duyệt thật trên Windows. Chromium và WebKit đạt ở lượt thứ hai; Firefox đạt trong lượt chạy riêng sau đó. Không gọi đây là một lượt toàn bộ ba engine đạt ngay từ đầu.

| Engine | Phiên bản | Space → Space / Tab / Esc | Mũi tên phải → Space | Bỏ xếp | Trang / vùng cuộn lưới ở 1280 px |
|---|---|---|---|---|---|
| Chromium | 156.0.8078.4 | Mỗi ca 0 PATCH, `aria-pressed=false` sau nhấc và sau kết thúc | Đúng 1 PATCH, HTTP 200 | HTTP 200 | 1280/1280 px; 715/715 px |
| Firefox | 157.0 | Mỗi ca 0 PATCH, `aria-pressed=false` sau nhấc và sau kết thúc | Đúng 1 PATCH, HTTP 200 | HTTP 200 | 1280/1280 px; 715/715 px |
| WebKit | 27.2 | Mỗi ca 0 PATCH, `aria-pressed=false` sau nhấc và sau kết thúc | Đúng 1 PATCH, HTTP 200 | HTTP 200 | 1280/1280 px; 715/715 px |

Các số đo lần lượt là `document.scrollWidth/window.innerWidth` và `scrollWidth/clientWidth` của vùng `.ant-table-content`. Lưới có sáu bàn thật từ DB: hai bàn fixture và bốn bàn bổ sung tạm; cột Lượt 64 px, mỗi cột bàn 108,5 px. Đo khi lưới tạm chưa có trận, chụp thêm sau khi thả một trận vào lưới.

PATCH được kiểm chính xác `matchId`, `sessionId`, `tableId` của T1, `orderInSession=1`, `expectedScheduleVersion=0`, `expectedOccupantId=null`. Lần bỏ xếp dùng phiên bản 1; truy vấn API sau đó xác nhận trận lại nằm trong danh sách chưa xếp. Live region đọc “trận số 2 đang ở bàn T1, thứ tự 1.” và thông báo hủy/thả ngoài lưới bằng tiếng Việt.

Lượt đạt của từng engine không có lỗi JavaScript, cảnh báo console hoặc request thất bại được ghi nhận.

## Môi trường và cách chạy

- DB duy nhất: `localhost:5433/kamito_tt_phase12_test`. Dùng credentials từ cấu hình đang hoạt động, chỉ thay tên DB trong biến tiến trình; không sửa `.env`, không migrate hoặc seed danh mục.
- Chờ public QA kết thúc rồi nhận bàn giao độc quyền fixture từ runner C11 `261125-c11-public-07f833ec-9bb3-4401-8e02-abcb6df3b3fe`. Không chạy đồng thời với fixture khác.
- API bản dựng cổng 3421; client production cổng 3422; admin từ `apps/admin/dist` ở cổng 3423. Admin dùng máy chủ tạm phục vụ file có thật, proxy `/api/v1` tới API và trả `/config.json` trong bộ nhớ; không sửa `dist/config.json`.
- SHA-256 của `admin/dist/index.html`: `d2523458a00ef1a41c13deebb812565e4a02101f3aa803a9d8a91af44636951b`. Bundle được tải: `index-DsgUM6wi.js` và `index-BvUY-mAY.css`.
- AuthTestKit tạo tài khoản ADMIN riêng, cấp session thật. Các lượt đạt truyền session qua request header trong harness để dùng HTTP local; không giả phản hồi API. Đây là kiểm kéo thả và bố cục, không phải kiểm luồng đăng nhập hoặc chính sách secure cookie của Safari.
- Playwright điều khiển headless Chromium/Firefox/WebKit; WebKit trên Windows không thay kiểm Safari trên máy Apple.

Lệnh launcher từ root, sau khi nhận quyền fixture:

```powershell
$env:REAL_TEST_DB_LEASE = 'a8-public-handoff'
node apps/api/test-results/261125-a8-gates/launch.mjs '<public-ready.json>'
```

Launcher chạy Vitest với config riêng trong thư mục bị Git bỏ qua. Lượt cuối đặt thêm `A8_ENGINES=firefox`, đạt 1/1 test, exit 0; Chromium/WebKit dùng bằng chứng đạt ở lượt trước, không cộng số test Vitest thành số ca sản phẩm.

## Các lượt thất bại được giữ lại

1. **Lượt đầu:** harness đếm cả hàng đo ẩn của AntD thành 14 header thay vì 7 ở Chromium; số đo thực tế đã là 715/715 px. Firefox timeout điều hướng trước khi hiện UI. WebKit không gửi secure cookie đã chèn trên HTTP localhost nên chuyển về đăng nhập 401. Chưa có PATCH lịch; dữ liệu tạm dọn về 0.
2. **Lượt hai:** sửa harness đếm `thead`, dùng `DOMContentLoaded` và session header. Chromium/WebKit đạt; Firefox vẫn chưa hiện UI trong thời hạn. Không có lỗi JavaScript được ghi nhận ở Firefox. Dữ liệu tạm dọn về 0.
3. **Lượt Firefox riêng:** thêm log request/response; không sửa mã sản phẩm. Cùng bundle admin đạt đầy đủ ca kéo bàn phím và bố cục. Nguyên nhân hai lần Firefox chưa hiện UI vẫn chưa xác định; giữ như giới hạn độ ổn định của môi trường/harness, không tuyên bố đã sửa lỗi sản phẩm.

Raw JSON và ảnh của các lượt đầu ở `apps/api/test-results/261125-a8-gates/attempt-01/` và `attempt-02/`. Bằng chứng Firefox cuối ở `apps/api/test-results/261125-a8-gates/firefox.json`, `firefox-six-tables-1280.png`, `firefox-keyboard-drop.png`. Chromium/WebKit đạt cũng còn trong `attempt-02/{chromium,webkit}.json` và các ảnh tương ứng.

## Dọn dẹp và giới hạn

- Mỗi lượt lưu rồi phục hồi chính xác snapshot của trận, gồm các trường lịch, `scheduleVersion` và `updatedAt`; `originalScheduleRestored=true`.
- Mỗi lượt xóa session tạm, bốn bàn bổ sung, tài khoản ADMIN và audit thuộc tài khoản đó. `cleanup.json` xác nhận `sessions=0`, `tables=0`, `users=0`.
- `launcher-result.json` lượt cuối xác nhận `.env` giữ nguyên và exit 0. Máy chủ admin 3423 đã đóng; quyền fixture trả lại runner C11 để dọn world và namespace Redis riêng.
- Hạ tầng đã khởi động lại đúng container có sẵn bằng `docker compose --env-file .env -f docker-compose.dev.yml start postgres redis`; ID và volume giữ nguyên. PostgreSQL/Redis healthy, TCP Windows 5433/6380 thông, `pg_isready` nhận kết nối, Redis `PONG` và `maxmemory-policy=noeviction`. Không khởi động S3 vì bài kiểm dùng storage local.
- Ở sáu bàn tại 1280 px, thẻ đã xếp xuống dòng tên khá hẹp và tăng chiều cao; ảnh Firefox ghi rõ điều này. Gate không cuộn ngang đạt; chưa thay đổi thiết kế thẻ trong lượt kiểm.
- Q8 màu theo nội dung và Q9 tự động xếp lịch vẫn là quyết định/phạm vi riêng. Báo cáo này không đóng các mục đó hoặc thay kết quả full admin workflow.

## Câu hỏi chưa giải quyết

Không có câu hỏi bắt buộc để đóng L1/L2. Theo dõi việc Firefox thỉnh thoảng chưa hiện UI khi khởi động harness; nếu tái hiện, dùng log request/response đã bổ sung để phân biệt tải bundle, mạng và khởi động trình duyệt.
