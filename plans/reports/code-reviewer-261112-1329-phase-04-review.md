# Review phase 04 — master data, giải, sub-event, upload ảnh

Ngày: 2026-11-12. Phạm vi: toàn bộ thay đổi chưa commit (`git status`). Chỉ đọc, không sửa code.

## Đã kiểm

- `pnpm typecheck` (7 package): pass.
- `pnpm lint`: pass (7/7).
- `vitest` `packages/shared` (50 test) + `apps/worker` (18 test): pass.
- e2e API: **không chạy** (cần DB/Redis). Các nhận định runtime bên dưới ghi rõ khi chưa kiểm chứng.

## Điểm tổng: 7.5/10

Nền tảng chắc: upload đi qua API có trần cứng 2 lớp (Content-Length + đếm byte khi stream), ghi file tạm rồi rename, key được whitelist, route public chỉ nhận đúng mẫu `<purpose>/<yyyy>/<uuid>-<w>.webp`, `incoming/` không bao giờ phục vụ, sharp có `limitInputPixels`, SVG/AVIF bị chặn ngay cả khi env lỡ mở. RBAC phủ 100% route `/admin` (test coverage tự quét). Mọi mutation đều audit trong cùng transaction. Không có Critical. Các lỗi chính nằm ở chỗ trạng thái kẹt, ràng buộc DB còn thiếu và một số giới hạn lệch nhau giữa các tầng.

## Critical

Không có.

## High

### H1. Giới hạn JSON body 100 KB của Express thấp hơn giới hạn `infoBody` (chưa chạy thử)
- `apps/api/src/bootstrap-app.ts` không gọi `useBodyParser`/không đặt `limit`. Nest dùng `body-parser` mặc định `100kb`.
- `apps/api/src/modules/events/event-dtos.ts:9` cho `MAX_INFO_BODY = 100_000` ký tự, cho cả `infoBody` và `infoBodyEn`.
- Tình huống: nội dung tiếng Việt có dấu (2–3 byte/ký tự) cộng HTML, tổng 2 field khoảng 60–70k ký tự là đã vượt 100 KB. Request bị `body-parser` chặn trước khi tới Nest, nên filter không bắt được. Admin nhận 413 HTML (không phải JSON `error`), form chỉ hiện "Payload Too Large" chung chung và người dùng mất phần đang soạn.
- Sửa: `app.useBodyParser('json', { limit: '<tính từ MAX_INFO_BODY>' })` trong `createApiApp`, hoặc hạ `MAX_INFO_BODY` theo byte. Thêm e2e gửi body gần mức trần.

### H2. Ảnh có thể kẹt `PROCESSING` mãi, không có gì dọn
- `apps/worker/src/media-worker.ts:51-57`: chỉ chuyển sang FAILED khi event `failed` báo đã hết lượt thử (`attemptsMade >= attempts`).
- `apps/worker/src/processors/media-intent-cleanup-processor.ts:11`: job dọn chỉ quét `AWAITING_UPLOAD`.
- `apps/api/src/modules/media/media.service.ts:100-105` + `media-queue.ts:23`: `jobId` cố định `media-<id>`, `removeOnComplete: { count: 1000 }`.
- Tình huống:
  1. `queue.add` timeout sau khi Redis đã ghi job → API trả lại trạng thái `AWAITING_UPLOAD` → worker chạy job, thấy chưa phải PROCESSING nên trả `skipped` (job vẫn nằm trong danh sách completed) → người dùng bấm complete lần nữa → `add` trùng jobId nên BullMQ bỏ qua → ảnh kẹt PROCESSING.
  2. Worker crash, job vượt `maxStalledCount` → `failed` nhưng `attemptsMade` chưa đủ → không chạy `failProcessing`.
  3. Redis mất key (flush/failover).
- Hậu quả: UI poll 30 giây rồi hiện "Kiểm tra lại" mãi; file `incoming/` không bao giờ bị xóa.
- Sửa: job dọn quét thêm các dòng `PROCESSING` có `updatedAt` cũ hơn N phút (đặt N trên `/settings`), enqueue lại với jobId mới hoặc chuyển FAILED + xóa incoming. Ở nhánh revert thì `queue.remove(jobId)`. Quyết định "hết lượt" nên làm ngay trong processor (`job.attemptsMade + 1 >= opts.attempts`) thay vì dựa vào event.

## Medium

### M1. Lọc vòng đời dùng múi giờ mặc định, còn tag hiển thị dùng múi giờ của từng giải
- `apps/api/src/modules/events/events-query.service.ts:158-166` tính `today` theo `event.defaultTimezone`.
- `apps/api/src/modules/events/event-view.ts:64` tính theo `row.timezone`.
- Tình huống: setting đặt `Asia/Ho_Chi_Minh`, có giải ở `Europe/Berlin` bắt đầu ngày 2026-11-13. Lúc 01:00 giờ VN ngày 13 (19:00 ngày 12 ở Berlin), lọc "Đang diễn ra" trả về giải này nhưng tag lại hiện "Sắp diễn ra". Lọc và hiển thị lệch nhau quanh nửa đêm, đổi setting cũng làm kết quả lọc đổi theo.
- Sửa: lấy các `timezone` khác nhau (`distinct`, thường chỉ 1–3 giá trị), dựng `OR` theo từng múi: `{ timezone: tz, ...lifecycleWhere(todayInTimezone(tz)) }`.

### M2. "Đúng một mục mặc định" chỉ dựa vào advisory lock, chưa có ràng buộc DB
- `apps/api/src/common/crud/default-flag.ts:186`: lock lấy trong `prepare`, trong khi `existing` đã đọc trước khi lock (`catalog-crud.ts:109-111`), nên quyết định dựa trên dữ liệu có thể đã cũ.
- `catalog-crud.ts:123-135`: `remove` không lấy lock. `assertDeletable` (IS_DEFAULT) đọc `existing` mà không khóa.
- Tình huống: A bấm "Đặt X làm mặc định", cùng lúc B xóa X (lúc B đọc thì X chưa phải mặc định). A bỏ mặc định của Y rồi đặt X, B xóa X → không còn mục mặc định nào → tạo sub-event báo "Chưa có thể thức trận mặc định". Seed hoặc SQL tay cũng có thể tạo ra 2 mục mặc định.
- Sửa: tạo migration mới (chỉ thêm, không sửa migration cũ) `CREATE UNIQUE INDEX "MatchFormat_single_default" ON "MatchFormat"("isDefault") WHERE "isDefault";`, làm tương tự cho `GroupScoringRule`. Lấy cùng advisory lock trong `remove` và đọc lại `existing` sau khi lock.

### M3. Ảnh của catalog không bắt buộc READY, không kiểm purpose
- `apps/api/src/common/crud/catalog-crud.ts:48-52` (`assertMediaExist`) chỉ `count({ id })`. Được dùng ở `tiers.service.ts:35` và `event-types.service.ts`.
- Giải thì kiểm `status === 'READY'` (`events/event-reference-checks.ts:35-36`).
- Tình huống: gọi PATCH thẳng API với `logoMediaId` đang `AWAITING_UPLOAD`/`FAILED`, hoặc dùng ảnh `event-banner` làm logo → site công khai hiện ảnh vỡ hoặc ảnh sai tỉ lệ.
- Sửa: dùng chung một hàm kiểm `status: 'READY'` và `purpose` khớp field cho cả catalog lẫn giải.

### M4. Dropdown catalog cố định 100 dòng
- `apps/admin/src/resources/events/use-catalog-options.ts:222`: `CATALOG_PAGE_SIZE = 100`.
- Tình huống 1: địa điểm hoặc hạng giải vượt 100 dòng → các dòng sau biến mất khỏi Select mà không báo gì.
- Tình huống 2: `PAGINATION_MAX_PAGE_SIZE` < 100 → mọi request 400 → mọi dropdown (hạng giải, địa điểm, nội dung) đều rỗng, không tạo được giải.
- Sửa: dùng `useSelect` có `onSearch` phía server (như `EventSettingEditor` đã làm), ít nhất là cho venues và event-types. Hoặc lấy `maxPageSize` từ `/auth/me`.

### M5. Trần upload lệch giữa nginx, env và setting
- `docker/admin-api-proxy.conf`: `client_max_body_size 10m` viết cứng.
- Setting `media.maxImageMegabytes` cho tối đa 50 (`packages/shared/src/tournament-settings.ts`), env ceiling không có giới hạn trên.
- Tình huống: đặt `UPLOAD_MAX_IMAGE_BYTES=20971520` và setting 20 MB → intent OK, nhưng PUT bị nginx trả 413 HTML → UI hiện "Không tải được ảnh lên".
- Sửa: sinh giá trị nginx từ env lúc container khởi động (entrypoint đã có sẵn cơ chế ghi config), hoặc validate `UPLOAD_MAX_IMAGE_BYTES <= 10 MiB` và ghi rõ trong `.env.example`.

### M6. Tham số vận hành / giá trị nghiệp vụ đang viết cứng hoặc để ở env (theo luật `/settings`)

| Chỗ | Giá trị | Khuyến nghị |
|---|---|---|
| `apps/api/src/common/config/env-schema.ts` `MEDIA_INTENT_TTL_MINUTES` | 15 | Chuyển lên `/settings` (vd `media.intentTtlMinutes`), env làm trần |
| `apps/api/src/modules/media/media-queue.ts:24-27` | attempts 3, backoff 5000 ms, removeOnFail 7 ngày, removeOnComplete 1000 | `attempts`/`backoff` để setting hoặc env (đọc lúc enqueue). Phần retention có thể giữ hằng số, nhưng phải ghi lý do |
| `apps/worker/src/processors/media-image-processor.ts:8-9` | `MAX_INPUT_PIXELS = 40e6`, `WEBP_QUALITY = 82` | Chất lượng WebP để setting. Số pixel tối đa là chốt an toàn → env làm trần |
| `apps/worker/src/media-worker.ts` `MEDIA_CLEANUP_INTERVAL_MINUTES` | 15 | Giữ env được (scheduler upsert lúc boot), nhưng ghi lý do |
| `MEDIA_WORKER_CONCURRENCY` | 2 | Giữ env (tài nguyên máy, đọc lúc boot) — hợp lệ |
| `apps/worker/src/processors/media-intent-cleanup-processor.ts:5` | `BATCH_SIZE = 200` | Chấp nhận được (nội bộ), ghi lý do |
| `apps/api/src/modules/sub-events/sub-event-dtos.ts:3,5` | `MAX_BULK_ITEMS = 50`, `MAX_ENTRIES = 10_000` | Số lần tạo hàng loạt tối đa → setting. `MAX_ENTRIES` → setting hoặc ghi lý do |
| `apps/api/src/modules/venues/venue-dtos.ts:158` | tối đa 100 bàn / lần | Setting (`venue.bulkMaxTables`) |
| `apps/api/src/modules/events/event-dtos.ts:9` | `MAX_INFO_BODY = 100_000` | Gắn với H1. Ít nhất phải đồng bộ với limit của body parser |
| `apps/admin/src/components/media-upload-field.tsx:29` | `ACCEPT = 'image/jpeg,image/png,image/webp'` | Trùng với env `UPLOAD_ALLOWED_IMAGE_TYPES` → API nên trả danh sách này (vd qua `/auth/me` hoặc một endpoint config) |
| `media-upload-field.tsx:30-31` | poll 2 s / timeout 30 s | Tham số UI, chấp nhận được |
| `apps/admin/src/resources/events/use-catalog-options.ts:222` | 100 | Xem M4 |
| `apps/admin/src/resources/events/event-labels.ts:38-41` | +2 ngày, lùi 5 năm / tới 1 năm | `+2 ngày` là mặc định nghiệp vụ (plan ghi "ngày kết thúc = bắt đầu + 2") → nên là setting `event.defaultExtraDays`. Khoảng năm lọc: nên lấy min/max năm thật từ API |
| `docker/admin-api-proxy.conf` | `client_max_body_size 10m` | Xem M5 |

## Low

- **L1. File mồ côi trong storage.** PUT tới muộn (sau complete hoặc sau khi job dọn đã chạy) vẫn rename vào `incoming/` → không ai xóa (`media-upload-stream.ts:52`, `media-intent-cleanup-processor.ts:17-22`). Variant của ảnh bị thay hoặc ảnh không ai dùng cũng không có GC. Gợi ý: job dọn quét thêm `incoming/` cũ hơn TTL, và dọn asset không còn được tham chiếu.
- **L2. Ảnh hỏng làm job retry 3 lần.** Lỗi decode ở `encodeVariants` (`media-image-processor.ts:101-111`) bị xem là lỗi tạm thời và thử lại 3 lần với backoff. Nên bọc lỗi sharp thành `UnrecoverableError` → FAILED `NOT_AN_IMAGE` ngay lần đầu.
- **L3. Audit của `complete()` nằm ngoài transaction và chạy sau enqueue** (`media.service.ts:106`). Nếu insert audit lỗi thì API trả 500 trong khi job vẫn chạy. Lúc đó client gọi lại sẽ nhận 409 `NOT_AWAITING_UPLOAD` dù ảnh vẫn đang được xử lý.
- **L4. Env cho phép `image/avif`/`image/heic` nhưng worker luôn báo `NOT_AN_IMAGE`** (sharp trả `format: 'heif'`, `media-image-processor.ts:54`). Nên validate env `UPLOAD_ALLOWED_IMAGE_TYPES` theo một danh sách các loại worker xử lý được.
- **L5. `MediaUploadField`.** Khi poll ra FAILED mà field đã có ảnh cũ, phase chuyển `failed` nên ảnh cũ bị ẩn dù `value` vẫn giữ id cũ (`media-upload-field.tsx:110-114,164`). Ngoài ra `url` không reset khi `value` đổi từ bên ngoài (form reset).
- **L6. Modal tạo hàng loạt không chặn trước khi vượt 50 mục** (số nội dung × số hạng mục). Người dùng chỉ biết sau khi bấm và nhận 422 (`bulk-sub-event-modal.tsx:32-40,85`). Nên hiện số đếm và disable nút khi vượt.
- **L7. `RichTextField` (StarterKit) không có extension image/table**, trong khi sanitizer cho phép `img`/`table`. Nội dung có bảng/ảnh tạo qua API sẽ bị editor xóa im lặng ở lần lưu sau. Nên thu hẹp allowlist cho khớp editor, hoặc thêm extension.
- **L8. FK race → 500.** Sub-event/giải kiểm tham chiếu ngoài transaction. Nếu bản ghi bị xóa xen giữa thì gặp `P2003` không được map, trả 500 (`sub-events.service.ts:69-93`, `events.service.ts:27-41`). Nên map P2003 → 422 field error.
- **L9. `home.featuredEventId`** chỉ kiểm định dạng uuid. Có thể trỏ tới giải nháp hoặc giải đã xóa (`tournament-settings.ts:121-129`). Nên kiểm tồn tại khi PUT setting, và site công khai phải bỏ qua giải chưa công bố.
- **L10. Route `GET /media/public/*` không giới hạn tần suất.** Khi `MEDIA_PUBLIC_BASE_URL` rỗng mà driver là `s3`, mỗi request đọc toàn bộ object vào RAM (`media-public-files.controller.ts:25`). Production nên bắt buộc có `MEDIA_PUBLIC_BASE_URL` (CDN/bucket) khi `APP_ENV=production`.
- **L11. `docker-compose.yml`:** `STORAGE_DRIVER=local` không chạy được (API và worker không chung volume, `UPLOAD_LOCAL_DIR` không được truyền). Nên chặn `local` khi `APP_ENV=production`, hoặc thêm volume dùng chung.
- **L12. Cache `catalog-rows` có `staleTime` 60 s** nhưng không bị invalidate sau khi sửa/ẩn/xóa catalog (`catalog-row-actions.tsx:25`). Form giải có thể còn hiện mục vừa ẩn trong tối đa 1 phút.
- **L13. Xóa địa điểm cascade xóa luôn mọi bàn** (`tournament-catalog.prisma:153`), nhưng hộp xác nhận không nói số bàn sẽ mất.
- **L14. File trên 200 dòng:** `apps/api/test/catalogs.e2e-spec.ts` (269). Migration (275) được miễn.

## Checklist bảo mật đã rà (đạt)

- Upload: kiểm Content-Type khớp loại đã khai, 413 khi Content-Length vượt trần và khi stream vượt trần (đóng kết nối sau khi gửi response), PUT/complete chỉ người tạo được gọi (`findOwned`), intent hết hạn bị từ chối, file rỗng → 422, phần ghi dở bị xóa.
- Path traversal: `assertSafeKey` + `resolvePath` bám `rootDir + sep`, route public dùng regex chặt → không thể đọc được `incoming/`.
- Sharp: kiểm metadata trước (đọc header), `limitInputPixels` khi decode, re-encode bỏ EXIF/ICC, chỉ xuất webp.
- Sanitizer: allowlist thẻ, không có `style`/`class`/`on*`, href chỉ `https:`/`mailto:`, img chỉ `https:`, `target=_blank` luôn kèm `rel=noopener noreferrer nofollow`, không cho URL protocol-relative.
- `isHttpsUrl`: chặn ký tự điều khiển/khoảng trắng, userinfo, scheme khác `https:`.
- RBAC: mọi route `/admin` mới đều có `@RequirePermission` (test coverage tự quét), RESULTS_OPERATOR chỉ có `tournaments` list/read, không có quyền `media`. CSRF: middleware `TrustedOrigin` áp cho `admin/*path`, gồm cả PUT content.
- Audit: create/update/delete/publish/cancel/bulk của catalog, giải, sub-event, bàn, media (create/complete/update) đều ghi trong transaction (trừ L3).
- Không thấy secret trong code. `.env.example` chỉ có giá trị dev. `apps/api/uploads/` đã nằm trong `.gitignore`.
- Migration: 2 migration mới chỉ `CREATE`, không có DROP/ALTER trên bảng cũ.

## Đúng spec / điểm tốt

- Slug: kiểm trước + bắt P2002 → 422 kèm `suggestion`, nên race giữa 2 request vẫn an toàn.
- Tạo sub-event hàng loạt: kiểm trùng trước + một transaction duy nhất + map P2002 → được hết hoặc không được gì.
- Xóa giải: một câu `deleteMany` có điều kiện (DRAFT, chưa có sub-event) → không bị TOCTOU. Xóa catalog: đếm phụ thuộc + map P2003 → 409 `IN_USE` kèm `dependants`.
- Ngày tháng: `@db.Date` ↔ `YYYY-MM-DD` ở UTC midnight, `isRealDateOnly` round-trip, form gửi `format('YYYY-MM-DD')` → không lệch ngày theo múi giờ của trình duyệt.
- BullMQ: dùng `QUEUE_PREFIX` ở cả API lẫn worker, jobId có định danh, cleanup chạy bằng `upsertJobScheduler` (idempotent).
- Admin: danh sách giải dùng `useTable({ syncWithLocation })` (lọc/sắp/phân trang ở server), có gate quyền bằng `useCan`/`CanAccess`, xử lý 409 IN_USE → đề xuất "Ẩn thay vì xóa", loading/error dùng `Skeleton`/`Result` + "Thử lại".

## Việc nên làm (theo thứ tự)

1. H1: đặt limit cho body parser khớp `MAX_INFO_BODY`, thêm e2e.
2. H2: sweeper cho `PROCESSING` + sửa nhánh revert enqueue.
3. M2: migration partial unique index cho `isDefault` + lock trong `remove`.
4. M1: lọc vòng đời theo múi giờ của từng giải.
5. M3, M4, M5.
6. M6: chuyển `MEDIA_INTENT_TTL_MINUTES`, số mục tạo hàng loạt tối đa, số bàn tạo hàng loạt tối đa, chất lượng WebP, "+2 ngày" lên `/settings`. Cái nào giữ env thì ghi lý do.

## Câu hỏi còn mở

- Production: bucket S3 có policy public-read **chỉ** cho prefix `public/` không? Nếu public cả bucket thì `incoming/` (file thô, chưa xử lý) đọc được qua `MEDIA_PUBLIC_BASE_URL`.
- Có cần khóa đổi slug sau khi giải đã công bố (link công khai bị gãy) không? Spec chỉ ghi "sửa được, unique".
- Giải đã công bố có được phép sửa/xóa sub-event không, hay đợi phase 05?
