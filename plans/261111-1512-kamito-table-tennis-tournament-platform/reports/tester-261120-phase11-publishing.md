# Phase 11 — Bổ sung kiểm thử publishing và retention

- Ngày: 2026-11-20.
- Phạm vi: `apps/api/test/publishing.e2e-spec.ts` và `test/support/publishing-test-safety.ts`.
- Trạng thái hiện tại: mã kiểm thử đã bổ sung; kiểm tĩnh và liệt kê ca đạt. Chưa chạy fixture PostgreSQL/Redis trong gói công việc này.

## Ma trận kiểm thử

| Ca | Trạng thái |
|---|---|
| Delayed job chỉ chứa ID, đổi lịch thay job và hủy lịch bỏ job cũ | Đã có, chờ chạy lại |
| Processor thật đăng bài tới hạn; bài dời lịch tương lai tiếp tục ẩn | Đã có, chờ chạy lại |
| Xóa delayed job rồi sweep phục hồi; draft và bài tương lai giữ nguyên | Bổ sung, chờ chạy |
| Retry bài đã đăng giữ `publishedAt`, thêm job revalidation mới | Bổ sung, chờ chạy |
| Retention đọc setting thay đổi 7 → 2 ngày; lần lượt chỉ xóa thư quá hạn | Bổ sung, chờ chạy |

Các mốc thời gian và số ngày là dữ liệu kiểm thử. Processor tiếp tục đọc cấu hình từ `contentSettings`, không sửa giá trị nghiệp vụ trong source.

## Cô lập và dọn dữ liệu

- Guard chạy trước `CmsTestKit.start()` vì setup đã tạo người dùng/ghi Redis. Bắt buộc PostgreSQL loopback, tên DB kết thúc `_test`, `MIGRATE_CONFIRM_TARGET` khớp, `APP_ENV=test`, `QUEUE_PREFIX=kamito-tt:test`.
- Queue revalidation có prefix ngẫu nhiên theo fixture, không có consumer; teardown chỉ drain queue riêng rồi đóng kết nối. Job publishing API tạo được theo dõi bởi `CmsTestKit` và xóa theo ID.
- Sweep khóa bảng `Article` trong transaction, từ chối chạy nếu có bài hẹn giờ ngoài fixture; tránh sửa nhầm dữ liệu đang được bộ kiểm khác dùng.
- Retention khóa bảng liên hệ và setting; xác nhận setting chưa đổi trước khi gọi processor. Từ chối xóa nếu có thư ngoài fixture nằm trong cửa sổ có thể bị tác động.
- Mỗi lần thay setting dùng compare-and-swap theo `updatedAt`, giá trị và `updatedById`, rồi đọc lại dưới row lock trong cùng transaction. Snapshot chưa có row chỉ được create, không upsert ghi đè row xuất hiện sau đó. Khôi phục trong `finally` cũng kiểm phiên bản, không ghi đè thay đổi bên ngoài.
- Không đổi schema, migration, dependency, source ứng dụng hoặc cấu hình `.env`.

## Lệnh kiểm chứng

Chạy tại root repo, Node có sẵn tại `C:\nvm4w\nodejs` được thêm vào PATH của process. Không chạy DB/queue fixture trong các lệnh sau.

| Lệnh | Kết quả |
|---|---|
| `pnpm --filter @kamito/api typecheck` | PASS, mã thoát 0 |
| `pnpm --filter @kamito/api exec eslint test/publishing.e2e-spec.ts test/support/publishing-test-safety.ts` | PASS, mã thoát 0 |
| `pnpm --filter @kamito/api exec vitest list test/publishing.e2e-spec.ts` | PASS, liệt kê đủ 5 ca; không chạy `beforeAll` |
| `git diff --check -- apps/api/test/publishing.e2e-spec.ts` | PASS |
| Rà chuỗi xưng hô riêng tư trong hai file test | Không có kết quả |

Lượt đầu trong sandbox không tìm thấy `pnpm`; chạy lại ngoài sandbox bằng Node/pnpm đã cài. ESLint từng báo `no-unsafe-finally` trong helper; đã chuyển logic khôi phục sang hàm riêng và chạy lại đạt. Không coi các lượt lỗi là thành công.

Review độc lập phát hiện setDays ban đầu còn blind upsert, có thể ghi đè thay đổi bên ngoài giữa hai lần đổi retention. Đã sửa thành compare-and-swap mọi lần ghi, chạy lại API typecheck/ESLint đạt; reviewer phase 09–10 đọc delta và xác nhận không còn finding trong bản sửa này. Chưa có thực thi DB để chứng minh đường cạnh tranh.

## Giới hạn

- Chưa có kết quả thực thi 5 ca tích hợp mới/cũ trong báo cáo này. Cần root điều phối target test đã xác nhận và tránh chạy đồng thời các fixture thay đổi AppSetting.
- Test gọi processor thật với PostgreSQL/Redis thật khi thực thi; không giả lập DB hoặc queue để đạt kiểm tra. Chưa chứng minh scheduler/worker process tự chạy theo thời gian, MinIO/S3, staging hoặc toàn bộ luồng vận hành giải 8 bước.
- Không đánh dấu phase 11/12 hoàn tất từ các kiểm tra tĩnh này.
