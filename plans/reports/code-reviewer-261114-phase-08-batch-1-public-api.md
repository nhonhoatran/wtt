# Code review — Phase 08 đợt 1: API đọc công khai + chuyển hướng locale (2026-11-14)

## Phạm vi
- API: `public-scope/*`, `public-events/*` (mới), `public-competition/{controller,module,match serializer,matches,groups,entries,results-strip}`, `admin-settings.controller.ts`, `cache-tags.ts` (dòng `settings.update`), `media-dtos.ts`/`media.service.ts`, `app.module.ts` (PublicEventsModule).
- Shared/UI: `public-event-contract.ts`, `tournament-settings.ts` (2 setting mới), `index.ts`, `tokens.ts`.
- Client: `proxy.ts`, `i18n/negotiate-locale.ts`, `i18n/pick-localized.ts`, `next.config.ts`.
- Bỏ qua các file ranking-* (phase 09).

## Kiểm chứng đã chạy
- `apps/api`: `tsc -p tsconfig.json --noEmit` sạch; `vitest run src/modules/public-scope src/modules/public-competition` 2 file / 7 test pass.
- `apps/client`: `tsc --noEmit` sạch.
- Chưa chạy: e2e (cần DB), `permission-coverage.e2e-spec.ts`, lint.

## Đánh giá chung
Thiết kế chắc tay: một predicate `publicScope` cho mọi endpoint (event PUBLISHED + không hủy, draw PUBLISHED, loại BYE kể cả `resultType` NULL), serializer whitelist, không select SĐT/email/ngày sinh, tham số query lỗi thì bỏ qua (giữ cache), `infoBody` sanitize lại khi đọc, `ticketUrl` đã ép https lúc lưu (`event-dtos.ts:51`), tìm theo tên pháp lý bị chặn khi có `publicDisplayName` (`public-matches.query.ts:29-34`), page size + giới hạn dải kết quả lấy từ AppSetting. Không thấy lỗi chặn merge; còn vài lỗ về tính nhất quán dữ liệu và thiếu test phạm vi.

## Critical
Không có.

## High
1. **Thiếu test phạm vi cho 7 endpoint mới.** Plan bước 7 yêu cầu "test phạm vi từng endpoint + test snapshot trường; kiểm số query". Hiện chỉ có `public-query-params.test.ts` và `public-bracket.e2e-spec.ts` (endpoint cũ). Chưa có test chứng minh: event DRAFT/hủy → `{data:null}` ở `events/:slug`, `info`, `matches`, `groups`, `entries`; draw DRAFT không lộ qua `matches`/`detail.champions`/`tabs`; entry WITHDRAWN không có trong `entries`; tìm theo tên pháp lý không ra VĐV có `publicDisplayName`. Đây là ranh giới rò dữ liệu, nên có e2e trước khi đóng đợt.
2. **Trận bị hủy kết quả (`isVoided`) hiện như trận thường.** `publicScope.match` không lọc `isVoided`, `PublicMatchCard` không có cờ voided (`public-match.serializer.ts:30-49`). Bảng xếp hạng bảng loại các trận này (theo `isPlayedMatch`), nhưng danh sách trận trong bảng (`public-groups.query.ts:57-61`), tab Trận đấu và dải kết quả vẫn hiện tỉ số như có giá trị → người xem thấy tỉ số không khớp bảng điểm. Đề xuất: thêm `isVoided: boolean` vào card (đơn giản nhất), hoặc loại khỏi danh sách nếu nghiệp vụ muốn ẩn.

## Medium
3. **Event slug `calendar` không bao giờ mở được** qua `GET events/:slug` (route `events/calendar` thắng, `public-events.controller.ts:24-32`) và không có danh sách slug cấm (grep `reserved|calendar` trong `events/*`, `shared` không ra). Nên chặn slug `calendar` ở validate slug của admin.
4. **Lọc trạng thái giải dùng múi giờ mặc định, badge dùng múi giờ của giải.** `listWhere` tính `today` theo `defaultTimezone` (`public-events-list.query.ts:102`), còn `toPublicEventCard` tính lifecycle theo `e.timezone` (`public-event.serializer.ts:45`). Giải ở múi giờ khác, quanh nửa đêm, có thể nằm trong lọc "Đang diễn ra" nhưng badge hiện "Sắp diễn ra". Ít gặp nếu chỉ có giải VN; nên ghi rõ giả định hoặc lọc với biên ±1 ngày rồi lọc lại theo từng giải như `results-strip`.
5. **Lọc "Sắp diễn ra" vẫn sort `startDate desc`** (`public-events-list.query.ts:50`): giải xa nhất lên đầu, giải sắp tới nhất bị đẩy xuống trang cuối. Nên `asc` khi `status=UPCOMING`.
6. **Đếm VĐV ở chi tiết giải tải hết entry CONFIRMED** (`public-event-detail.query.ts:62-65`) rồi dựng `Set` trong JS. Không phải N+1 và có giới hạn theo quy mô giải, nhưng nên làm `COUNT(DISTINCT)` bằng `$queryRaw` (union playerId / playerAId / playerBId) để payload DB không tăng theo số entry.
7. **Đổi `public.listPageSize` không làm mới trang danh sách.** `settings.update` chỉ phát tag `settings` (`cache-tags.ts`), trong khi trang giải/trận/VĐV theo plan gắn tag `events`/`event-{slug}` → page size mới chỉ áp sau TTL; cùng lúc `page` hiện tại của người xem có thể trỏ sai. Hoặc gắn thêm tag `settings` cho các trang có phân trang, hoặc ghi chú chấp nhận TTL. Ngoài ra mọi key setting (kể cả auth) đều bắn tag `settings` — vô hại nhưng thừa.
8. **Chưa có rate limit cho trang có `q`** (plan dòng 187). Tìm kiếm `contains` (ILIKE `%..%`) trên `normalizedName`/`publicDisplayName` qua 3 nhánh join, trang có `q` không cache → mỗi request đều chạm DB. API được che bởi `SsrInternalGuard` nên tải đi qua Next; cần làm rate limit ở Traefik/`proxy.ts` trước khi lên staging.

## Low
9. `zonedDayRange` lấy offset ở 12:00 **UTC** (không phải 12:00 giờ địa phương như comment `public-query-params.ts:64`) và cộng cứng 24h → ngày đổi giờ DST lệch 1h. Không ảnh hưởng `Asia/Ho_Chi_Minh`; sửa comment hoặc tính lại `lt` bằng `zonedDayRange(nextDay)`.
10. Tìm theo `publicDisplayName` phân biệt dấu (`contains` + insensitive), tìm tên pháp lý thì bỏ dấu qua `normalizedName` → gõ "nguyen" không ra VĐV dùng tên hiển thị "Nguyễn ...". Nhất quán UX, không phải lỗi bảo mật.
11. `entries` sort theo `competitor.displayName` (`public-entries.query.ts:38`) — nếu tên này dựng từ tên pháp lý thì thứ tự hiển thị trông lộn xộn với VĐV có `publicDisplayName` (và gián tiếp lộ thứ tự tên pháp lý). Chưa kiểm cách dựng `displayName`.
12. `tabs.info` xét `infoBody` thô (`public-event-detail.query.ts:95`) còn `info()` xét sau sanitize → HTML chỉ toàn thẻ bị gỡ thì tab hiện nhưng trang trả `null`. Hiếm.
13. Settings cache trong RAM 10 s chỉ xóa trên instance nhận request (`app-settings.service.ts`) — scale nhiều instance API thì revalidate `settings` có thể render lại với giá trị cũ rồi cache tới TTL.
14. `parsePublicYear` cứng 2000–2100: nếu nhập dữ liệu giải lịch sử trước 2000 thì không lọc được. `PUBLIC_SEARCH_MAX_LENGTH=100`, `PAGE_MAX=10000`, `CARD_IMAGE_MIN_WIDTH=640`, biên ±1/2 ngày của dải kết quả là chốt kỹ thuật — chấp nhận để cứng.

## proxy.ts
- Không thấy open redirect: đích luôn là `/{locale}` + pathname cùng origin (`proxy.ts:17`); `//evil.com`, `/\evil` thành `/vi//evil.com` (path, không đổi host).
- Không lặp redirect: đích luôn bắt đầu bằng locale hợp lệ → nhánh `isLocale(first)`. `/VI/...` → `/vi/VI/...` → 404 (chấp nhận).
- Có `Vary: Cookie, Accept-Language` trên 307, không gắn `Cache-Control` → CDN không cache theo mặc định. Tốt.
- Tường `/api/revalidate` còn nguyên: 2 matcher riêng, kiểm `Host` nội bộ trước mọi nhánh khác (`proxy.ts:11-13`); lớp secret vẫn ở route.
- Matcher bỏ qua mọi path có dấu chấm ở bất kỳ đoạn nào → slug/path không locale có dấu chấm sẽ 404 thay vì redirect. Slug hiện là kebab nên không ảnh hưởng.
- `negotiateLocale`: q lỗi/0 bị lọc, `*` bị bỏ, cookie sai bị bỏ qua. Đúng.

## Đếm query (ước lượng từ code, chưa đo log Prisma)
- `events`: settings(cache) + count + page + 3 filter = 4 query song song. `calendar`: 1 + 3. `events/:slug`: 1 + 4 song song. `info`: 1. `matches`: 1 + 2. `groups`: 2. `entries`: 1 + groupBy + 2. `results/strip`: 1 + 2. Không N+1. Plan bước 7 yêu cầu đo bằng log Prisma — chưa làm.

## Đề xuất ưu tiên
1. Viết e2e phạm vi công khai cho 7 endpoint (mục 1) — chặn đóng đợt.
2. Quyết định cách hiện trận `isVoided` (mục 2).
3. Chặn slug `calendar`; sort `asc` cho lọc sắp diễn ra (mục 3, 5).
4. Rate limit trang có `q` trước staging (mục 8).
5. Còn lại xử lý khi tiện.

## Câu hỏi mở
- Trận voided: hiện kèm nhãn hay ẩn hẳn khỏi trang công khai?
- `competitor.displayName` dựng từ `publicDisplayName` hay tên pháp lý?
- Đổi page size có cần làm mới trang ngay, hay chấp nhận TTL?

**Điểm: 8/10**
