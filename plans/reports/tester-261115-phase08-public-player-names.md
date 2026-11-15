# Tên công khai: tìm kiếm và thứ tự phân trang

Ngày: 2026-11-15.

## Thay đổi và migration

`Player.normalizedPublicName` lưu khóa tìm kiếm của tên thực sự hiển thị: `publicDisplayName ?? fullName`. Trigger PostgreSQL cập nhật khóa cho insert/update, bao phủ admin, import, merge và thao tác bảo trì. Tên thật vẫn có `normalizedName` riêng cho nghiệp vụ nội bộ; serializer public không xuất khóa mới.

Migration `20261115032757_add_player_public_name_key` được tạo bằng `prisma migrate dev --create-only`, review SQL rồi áp dụng bằng `prisma migrate deploy`. Đích công cụ tự đọc từ `.env`: `localhost:5433/kamito_tt_dev`. Không ghi đè URL, không dùng `db push`. SQL thêm cột, hàm chuẩn hóa bằng PostgreSQL tích hợp, trigger, backfill và index; không cài extension. `prisma migrate status` xác nhận 16 migration, schema cập nhật đầy đủ. Chưa áp dụng staging.

Tìm trận dùng khóa public đã chuẩn hóa nên truy vấn không dấu, có dấu và Unicode tổ hợp tìm cùng kết quả. Khi có tên hiển thị, tên thật không tham gia tìm kiếm.

Danh sách đăng ký lấy ID trang bằng SQL tham số hóa: seed trước, tên công khai đã chuẩn hóa của người đơn hoặc hai thành viên cặp, ID làm khóa phụ ổn định; PostgreSQL sort rồi mới `LIMIT/OFFSET`. Truy vấn tiếp theo chỉ nạp whitelist của trang ID đó; không nạp toàn bộ danh sách để sort trong ứng dụng. Thứ tự cặp giữ đúng playerA/playerB như serializer.

## Bằng chứng kiểm tra

- `pnpm --filter @kamito/db build`: generate Prisma + TypeScript đạt.
- `pnpm --filter @kamito/api typecheck`: đạt.
- ESLint các query và test mới: đạt.
- `public-player-names.e2e-spec.ts`, `public-matches.e2e-spec.ts`, `public-groups-entries.e2e-spec.ts`: **24/24 đạt, 3 file**, DB thật.
- Sau bổ sung xuất hiện vật query plan, chạy lại test mới: **6/6 đạt**.

Sáu ca mới kiểm:

1. SQL chuẩn hóa tương đương helper JS trên tiếng Việt NFC/NFD, Đ/đ, NBSP, BOM, tab/newline, khoảng trắng Unicode và Hangul; không có player hiện hữu lệch khóa sau backfill.
2. Tìm alias có dấu/không dấu/Unicode tổ hợp trên cả đơn và cặp thực; tên thật bị ẩn không tìm được và không xuất hiện trong phản hồi.
3. Trigger giữ alias khi tên thật đổi, cập nhật khi alias đổi/xóa và không cho thao tác ghi trực tiếp làm giả khóa.
4. Đơn: seed trước, tên công khai trước khi chia trang, khóa phụ ổn định khi trùng tên, không rớt/trùng trang.
5. Cặp: cùng quy tắc sort/pagination, lấy tên của hai thành viên thực thay vì `Competitor.displayName` chứa tên thật.
6. `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` xác nhận node đầu là `Limit`, trả đúng 2 ID với fixture 8 entry.

Lần đo query plan: planning **1,364 ms**, execution **0,313 ms**, 51 shared buffer hits. Đây là phép đo fixture nhỏ, không phải benchmark tải production. Hiện vật đầy đủ: `apps/api/test-results/public-entry-page-explain.json` (Git bỏ qua).

Log có cảnh báo deprecation từ driver `pg` về truy vấn đồng thời trên cùng client; không có test lỗi. Không thay cấu hình setting chung khi test phân trang: chỉ cô lập page size qua dependency của app test.
