# Sync kế hoạch sau phase 04 (Kamito)

Ngày: 2026-11-12. Phạm vi: cập nhật tài liệu plan, không đụng code, chưa commit.

## Đã làm

| File | Thay đổi |
|---|---|
| `plans/261111-.../phase-04-tournament-master-data-config-and-media-upload.md` | Status → Hoàn thành (chưa deploy staging). Todo tick 9/11 kèm đường dẫn bằng chứng; 2 mục chưa tick có lý do. "Chưa thống nhất" → đã chốt. Dòng Requirements về env có chú thích sync. Thêm mục "Kết quả thực hiện" (kiểm chứng, quyết định, sai lệch, việc còn mở). |
| `plans/261111-.../plan.md` | Bảng phase 4 → "Hoàn thành (chưa deploy staging; làm trọn 2026-11-12)". Ghi chú: phase 04 không tách lát cắt; 05–08 vẫn 2 đợt. Chuỗi phụ thuộc: bỏ "4" khỏi đợt lát cắt và đợt 2. |
| phase-05 | Thêm "Phase 04 sync": helper upload thực tế, không có `presigned-upload.service.ts`; prefix `private/imports/` cần chốt; điểm nối `cache-tags`. |
| phase-06 | Thêm "Phase 04 sync": `MatchFormat`/`GroupScoringRule` có sẵn, `withdrawalPolicy` để trống, `tiebreak-criteria.ts`, partial unique index, `draw.*` chưa vào registry. |
| phase-07 | Thêm "Phase 04 sync": hook `events.service.ts:15`, sub-event và AppSetting chưa có hook, mẫu `EVENT_PUBLISHED`, lifecycle đa múi giờ. |
| phase-08 | Thêm "Phase 04 sync": sanitizer có sẵn và đang chạy khi lưu; chưa quyết cách sanitize khi render; `infoBodyEn`; `featuredEventId` chưa kiểm công bố; L7 editor vs allowlist. |

Không đánh dấu done cho bất kỳ mục nào của phase 05–08.

Sai khác so với yêu cầu: tên report theo quy ước hook là `project-manager-261112-1415-*`, nhưng yêu cầu chỉ định `1347`. Dùng tên theo yêu cầu. Breakdown nằm ở `plans/261111-.../reports/`, không phải `plans/reports/`; đã dẫn đúng đường dẫn.

## Đối chiếu bằng chứng trong code (2026-11-12)

- H1 đã xử lý: `apps/api/src/common/http/json-body-limit.ts` (body parser theo `MAX_INFO_BODY`).
- H2 đã xử lý: `apps/worker/src/processors/media-intent-cleanup-processor.ts` (quét PROCESSING quá `media.processingTimeoutMinutes`).
- M1 đã xử lý: `apps/api/src/modules/events/events-query.service.ts` (`distinctTimezones`).
- M2 đã xử lý: migration `20261112070130_add_single_default_partial_indexes`.
- M3 đã xử lý: `apps/api/src/common/crud/ready-media.ts`, dùng ở tiers, event-types, events.
- M4 đã xử lý: page size lấy từ `useListPageSize` (setting).
- M5 đã xử lý: `docker/admin-entrypoint.sh` ghi `client_max_body_size` từ env.
- M6 còn một phần: xem Việc còn mở 6.
- Event bị sanitize khi lưu: `apps/api/src/modules/events/event-write-data.ts:14-15`.
- Xóa sub-event của giải đã công bố: `apps/api/src/modules/sub-events/sub-events.service.ts:125` (409 `EVENT_PUBLISHED`).
- `@RequireStepUp` không gắn route nào: grep `apps/api/src` chỉ thấy định nghĩa và test.
- `cache-tags.ts` chưa tồn tại; hook ở `apps/api/src/modules/events/events.service.ts:15`.
- `S3_INCOMING_BUCKET` có trong `docs/deployment-guide.md`.

Chưa xác minh: L12, L14 (không có trong danh sách bỏ qua, chưa kiểm trong code); trạng thái hai user `@test.kamito.local` trong DB dev sau các lần chạy sau đó.

## Thay đổi phạm vi và quyết định (log)

| Chuyện | Trước | Sau | Tác động |
|---|---|---|---|
| Thiết kế upload | (a) presigned hoặc (b) chờ phase 01 | (b) stream qua API, `STORAGE_DRIVER` local/s3 | Không có presigned; phase 05 phải tái dùng helper thực tế |
| Tham số vận hành | env (phase 04 bản cũ) | `/settings`, env làm trần | Mở rộng registry; còn M6 |
| Làm phase 04 | Lát cắt tuần 4 + phần còn lại tuần 7–8 | Làm trọn một đợt | Phase 05–08 vẫn 2 đợt; chưa có số ngày công thực tế, không ước lượng lịch |
| `ticketUrl` sai | 400 (spec) | 422 theo field (quy ước) | Sai lệch so với spec, đã ghi |
| Tag revalidate (bước 12) | phase 04 | phase 07 | Mutation giải đã có hook; sub-event và AppSetting chưa có hook |
| Slug giải đã công bố | "sửa được" | Khóa khi đã công bố | Giữ link công khai |
| Bucket production public | Chưa rõ | `incoming/` private là tùy chọn qua `S3_INCOMING_BUCKET` | Không bắt buộc, cần chủ repo xác nhận cấu hình thật |

## Rủi ro (cập nhật)

Mở thêm:
- Native crash 0xC0000409 (1/3 lần chạy full api), chưa tái hiện. Khả năng × tác động: thấp × trung bình. Xử lý: lặp 5–10 lần; cô lập fork.
- Driver `s3` chưa test với MinIO thật. Trung bình × cao (production). Xử lý: test tích hợp trước deploy staging.
- Sanitizer cho phép `img`/`table`, editor không tạo được (L7). Thấp × trung bình. Xử lý: phase 11.
- Không có `@RequireStepUp` trên thao tác nhạy cảm (settings, gộp VĐV). Trung bình × trung bình. Xử lý: chờ chủ repo quyết.
- Render công khai sanitize lại ở đâu chưa chốt (phase 08). Trung bình × cao (XSS). Xử lý: chốt trước phase 08.
- Prefix import (`private/imports/`) lệch `incoming/`. Thấp × thấp. Xử lý: chốt trước phase 05.

Đóng:
- Partial unique index cho mục mặc định (review M2 / F5): đã có migration.
- Tranh luận 400 vs 422 cho `ticketUrl`: đã chốt 422.
- Settings vs env: đã chốt.
- Thiết kế upload chưa chọn (điều kiện cổng phase 01): đã chọn (b).

Điều kiện cổng ra phase 01 (staging, Redis `noeviction`, thiết kế upload, chủ sao lưu và RPO): thiết kế upload đã đạt. Ba điều kiện còn lại chưa có bằng chứng trong phiên này.

## Chặn tiến độ

- Deploy staging (phase 03 bước 13, phase 04 bước 13). Chặn bởi cổng phase 01 chưa đạt. Chủ: chủ repo và chủ hạ tầng. Đường mở: staging chạy, Redis riêng `noeviction`, chủ sao lưu và RPO đã có, rồi deploy + migrate `migrate deploy` sau khi in host và tên DB và xin xác nhận. Bị ghi nhận chặn từ phase 03 (mục "Việc còn mở" 1), chưa có bằng chứng staging đã được dựng.

## Việc tiếp theo (chủ sở hữu, định nghĩa xong)

1. Main agent: hoàn thành toàn bộ plan, không dừng ở phase 04. Các việc còn mở phải xong hoặc có quyết định ghi vào plan: deploy staging, tag revalidate (phase 07), review Low/M6, `@RequireStepUp`, test MinIO, native crash. Xong = mỗi việc có trạng thái trong plan và bằng chứng (test hoặc đường dẫn file). Plan chưa hoàn thành khi còn bất kỳ việc nào không có trạng thái.
2. Chủ repo: quyết 4 điểm chờ (xem câu hỏi). Xong = ghi quyết định vào phase tương ứng.
3. Main agent: test MinIO cho đường `s3` (phase 04, mục 3). Xong = test chạy xanh trên MinIO cục bộ, `content-length-range`/HeadObject được kiểm.
4. Main agent: lặp api suite 5–10 lần để đo tỉ lệ crash. Xong = có số liệu; nếu có crash thì cô lập file gây lỗi.
5. Main agent: chốt cách sanitize khi render trước phase 08. Xong = ghi vào phase 08 kèm đường dẫn.
6. Main agent: chốt prefix import trước phase 05. Xong = ghi vào phase 05.

## Concerns / Blockers

- Deploy staging bị chặn bởi cổng phase 01 (xem trên).
- Tài liệu không ghi số ngày công thực tế của phase 04, nên không đánh giá được lệch lịch.

## Câu hỏi chưa giải quyết

1. Có chấp nhận tiếp tục phát triển khi phase 01 chưa qua cổng ra, hay dừng tới khi có staging? (phase 03 đã hỏi, chưa trả lời)
2. Có gắn `@RequireStepUp` ngay cho `PUT/DELETE /admin/settings/:key` và `POST /admin/users/:id/reset-password` không?
3. Dọn 2 user `@test.kamito.local` còn trong DB dev không?
4. M6: giữ hay chuyển lên `/settings` các hằng số `MAX_BULK_ITEMS`, `MAX_ENTRIES`, số bàn tối đa mỗi lần (100), WebP quality (82), attempts/backoff queue media?
5. Production: bucket S3 có public-read cả bucket không? Nếu có thì bắt buộc đặt `S3_INCOMING_BUCKET`?
6. Render công khai sanitize ở Next.js bằng lib chung trong `packages/shared`, hay API trả HTML đã sanitize?
7. Prefix của file import (phase 05): `private/imports/` hay dùng `incoming/`?

**Status:** DONE_WITH_CONCERNS

**Summary:** Đã đồng bộ phase 04 (Hoàn thành, chưa deploy staging; Todo, Kết quả thực hiện), plan.md (bảng, chuỗi phụ thuộc), và thêm ghi chú sync cho phase 05–08 với đường dẫn code đã kiểm. Không commit. Đã đối chiếu các mục review H1, H2, M1–M5 trong code.

**Concerns/Blockers:** deploy staging bị chặn bởi cổng phase 01; driver s3 chưa test với MinIO; native crash chưa tái hiện; L7 và `@RequireStepUp` còn mở; tên report theo yêu cầu (1347) khác quy ước hook (1415). Trạng thái hai user test trong DB dev chưa xác minh.
