# Client, bản in C7 và lỗi theo dõi job — 2026-11-27

## Kết quả

| Phép kiểm | Kết quả | Phạm vi |
|---|---|---|
| Client `pnpm --filter @kamito/client test` | 191/191, 36 file, exit 0 | Lượt cuối có Redis local `localhost:6380`; UUID namespace do từng test tạo |
| `pnpm --filter @kamito/client test:print` | 9/9, 2 file, exit 0 | Component React/CSS thật, Chromium, không API/DB |
| Audit PDF bằng pypdf | 8/8 PDF, 40 trang, exit 0 | A4/A3 ngang, vi/en, đơn/đôi; 63 trận duy nhất mỗi PDF, đủ 64/128 tên và ngữ cảnh trên mọi trang |
| Job-state Node tests | 7/7, exit 0 | Thành công, thất bại, 404, 500/503, mạng lỗi, thiếu kết quả, batch hỗn hợp và thử lại |
| Browser hồi quy theo dõi job | 9/9, exit 0 | App admin React thật qua Vite; HTTP được mock, không phải E2E với DB/worker |
| Đối chứng âm browser | 2/2 rớt đúng lỗi cũ, exit 1 | Vite phục vụ ba component từ HEAD qua transform trong bộ nhớ; không ghi đè thay đổi đang làm |
| Admin typecheck và eslint phần job | Exit 0 | Không thay thế cổng toàn repo sau khi ghép các tính năng tiếp theo |

Lượt client đầu thiếu `REDIS_URL`: 184 ca đạt và hai suite dừng ở setup (7 ca không chạy). Đã chạy lại toàn bộ với Redis, đủ 191 ca đạt; không cộng hai lượt.

## Theo dõi job dựng bản nháp

- Kết quả được phân biệt `succeeded`, `failed`, `unavailable`. Chỉ kết quả completed có `snapshotId` của đúng job mới là thành công.
- Trang BXH chỉ xóa tracker khi cả batch thành công. Lỗi worker và lỗi gọi API giữ thông báo trên màn hình sau khi refetch snapshot.
- 404 không còn được suy ra là thành công. Giao diện cho kiểm tra lại cùng job và mở lịch sử kỳ chốt, không tự tạo job thứ hai hoặc chọn bản nháp mới nhất không liên quan.
- Preview chỉ đổi sang `snapshotId` được trả về khi thành công; kết quả chưa rõ không refetch id cũ có thể đã bị thay thế. Tracker vẫn được giữ nếu trang chi tiết không tải được.
- Browser kiểm cả 500, 503, network error, 404, completed thiếu result, lỗi worker, retry thành công không thêm POST và điều hướng đúng snapshot. Đối chứng HEAD rớt vì thông báo lỗi/404 không tồn tại sau callback.
- Ảnh mobile 390 đã mở kiểm: hành động ở dưới mô tả, chữ có đủ chiều rộng. Bản thử đầu dùng `Alert.action` ép mô tả quá hẹp; đã sửa và chạy lại đủ bộ.

Artefact mới nhất: `test-results/snapshot-jobs-e6c76741-cc7e-4f0c-b74b-95450e11537c/404-mobile.png`. Log đối chứng: `test-results/snapshot-jobs-83e4b130-ea40-4190-87b0-951fbfb1b184/baseline.log`.

## Kiểm PDF và ảnh C7

Đã render cả 40 trang thành PNG và mở đủ tám mosaic (mỗi mosaic chứa năm trang), thêm trang đầu `doubles-vi-A4` ở cỡ lớn để kiểm tên có hạt giống bị xuống dòng. Không thấy chữ bị cắt, chồng nhau, mất dấu tiếng Việt, trang tiêu đề rỗng hoặc mất ngữ cảnh. Trang cuối có phần bán kết/chung kết ngắn nên còn khoảng trắng, đúng cách chia nhánh hiện có.

Artefact tại `apps/client/test-results/bracket-print/`: tám PDF, `*-page-N.png`, tám `*-mosaic.png`, ảnh màn hình/in, `metrics.json` và `pdf-audit.json`. Kiểm máy xác nhận không ellipsis/tràn ngang khi in; kích thước giấy đúng trong sai số Chromium hiện có; không mất hoặc lặp trận.

Đã mở ảnh màn hình đơn/đôi tiếng Việt 1440/390 và ảnh public `draws-1440.png`/`draws-390.png` trong báo cáo redesign, đối chiếu Figma `1-24.png`/`1-34.png`. Cấu trúc cột navy, liên kết tiến vòng, chọn vòng mobile và thẻ vòng sau có mặt ở ảnh route. Khác biệt do fixture chưa xếp giờ/BYE hoặc không có CLB không được coi là thiếu dữ liệu sản phẩm. Tab bảng đấu riêng và hoãn ô tìm trong nhánh là quyết định đã ghi ở C7. Đây là đối chiếu ảnh route đã lưu từ lượt trước, không phải capture lại toàn site sau tính năng `/search` mới.

Hai lỗi công cụ QA đã sửa:

1. Audit tên PDF giữ newline để dò số trận, rồi dùng cùng chuỗi để tìm tên đầy đủ; tên đôi có hạt giống xuống dòng làm báo thiếu giả `1A/1B/2A/2B`. Đã chuẩn hóa whitespace riêng cho tên, giữ nguyên kiểm số trận. PDF gốc hiển thị đủ tên; không sửa sản phẩm để né phép kiểm.
2. Harness offline thiếu CSS của `TierBadge`, làm nhãn hạng giải kế thừa font 28px. Thêm assertion nhận đúng 12px cho thấy rớt trước sửa; nạp CSS module thật rồi toàn bộ test in đạt. Không đổi CSS sản phẩm.

## Giới hạn

- Không seed/query/migrate PostgreSQL trong các phép kiểm này.
- Browser job là HTTP mock; không chứng minh queue/worker/API thật hoặc độ trễ revalidation.
- C7 đã có kiểm toàn bộ PDF hiện tại; C11 vẫn cần ảnh mới và review cuối sau khi ghép các tính năng được bổ sung trong lượt này.
- Không dùng kết quả local thay nghiệm thu staging hoặc đóng lỗi native Windows chưa tái hiện.
