# Phase 08 — Review cache, rate limit và settings nhiều instance

Ngày: 2026-11-15. Phạm vi: `apps/client/src/lib/{public-redis,public-response-cache,public-shared-rate-limit,api-client,public-rate-limit}.ts`, route revalidate và `AppSettingsService`.

## Kết quả review

Đạt sau sửa, **9,5/10**, không còn phát hiện critical/high/medium trong mã nguồn đã đọc. Kết quả chỉ xác nhận phạm vi local được kiểm; không thay thế staging, edge Traefik hoặc load test.

- Fetch API dùng `cache: no-store` và timeout mỗi request; JSON response được giữ trong Redis theo TTL. Không phụ thuộc stale revalidation bỏ signal của Next. API lỗi không được ghi vào cache.
- Hai instance đọc chung tag version; revalidate đổi version vĩnh viễn. Giữ version không hết hạn để không làm sống lại response cũ khi cấu hình TTL bị giảm. Các key version phát sinh theo tag thực thể của luồng invalidation nội bộ, không theo chuỗi query tự do từ khách.
- Epoch chung chặn response đang fetch trước invalidation ghi lại cache sau invalidation. Entry đã lưu của tag khác vẫn dùng được; invalidation không xóa cả cache.
- Revalidate Redis lỗi trả 503 để worker thử lại, không báo thành công khi chưa vô hiệu cache chung. Đọc Redis lỗi bỏ cache và đọc upstream. Rate limiter Redis lỗi dùng fallback local; không hứa giới hạn toàn cụm khi Redis mất kết nối.
- Lua rate limiter tăng page/search counter nguyên tử qua các connection, dùng đồng hồ Redis để tránh lệch giờ các replica. Prune registry trước khi kiểm admission cap. Các chốt số lượt/tracked visitors vẫn lấy từ setting.
- API settings không giữ bản RAM riêng từng instance; đọc DB sau commit thấy cấu hình mới ngay. Đổi này làm tăng query settings, nên cần đo tải thực trước production.

## Phát hiện đã sửa trong review

1. Gắn error listener Redis mỗi lần gọi helper gây tích lũy listener: đã chuyển vào nhánh tạo connection một lần.
2. Tag version hết hạn theo TTL hiện tại có thể làm sống lại entry tồn tại lâu hơn từ policy cũ: đã chuyển sang version không TTL.
3. Registry đọc trạng thái admission trước khi prune có thể cho visitor đã hết hạn vượt cap: đã đổi thứ tự và có test registry thực.
4. Score registry lấy giờ app còn counter TTL dùng Redis có thể lệch giữa replica: Lua đã dùng Redis `TIME`.

## Kiểm chứng độc lập

- `pnpm --filter @kamito/client test public-response-cache.test.ts public-shared-rate-limit.test.ts`: **2 file / 7 ca đạt** với Redis thật, prefix UUID riêng và cleanup đúng prefix.
- Cache: hai connection độc lập chia sẻ JSON/null; invalidation ở connection thứ hai làm connection thứ nhất hết hit; tag khác còn hit; late writer bị chặn; fetch mới được ghi; response TTL hết hạn; tag version không TTL.
- Rate: tám request đồng thời qua hai connection chỉ ba request được nhận theo cấu hình test; bucket search thấp hơn nhưng page vẫn đếm chung; visitor mới fail-open khi chạm cap; registry đã hết hạn không làm vượt cap.
- `pnpm --filter @kamito/api test settings-replica-consistency.e2e-spec.ts`: **1/1 đạt**, hai service instance đọc/ghi/reset cùng DB; test lưu và khôi phục nguyên hàng setting ban đầu trong finally, không thay env URL DB.
- Client typecheck và ESLint hai file integration Redis: đạt. API typecheck đã chạy sau thêm suite settings: đạt.

Lượt TTL test đầu dùng timestamp tuyệt đối từ đồng hồ Node không làm key hết hạn theo mong đợi vì giờ Redis khác; đổi sang `PEXPIRE` tương đối, đợi 10 ms và kiểm lại đạt. Đây cũng là lý do bài toán rate registry phải dùng đồng hồ Redis.

Review privacy thay đổi tên công khai: `normalizedPublicName` chỉ dùng tìm/sắp xếp phía server; `publicEntryPageSql` cắt trang trước hydrate, serializer vẫn whitelist. Migration trigger đồng bộ mọi INSERT/UPDATE và backfill; không dùng `prisma db push`. Bằng chứng kiểm thử migration/tên do suite và báo cáo của tác vụ tên công khai cung cấp riêng.

Hai connection Redis độc lập và hai service API không tương đương kiểm hai process Next thật. Kết quả smoke hai process và build/test tổng hợp được báo riêng ở lượt điều phối, không suy ra từ các ca ở trên.
