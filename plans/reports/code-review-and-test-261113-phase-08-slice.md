# Review + test — lát cắt phase 08 (2026-11-13)

Phạm vi: API nhánh đấu công khai, trang nhánh đấu client, route `/api/revalidate` + `proxy.ts`. Không gồm phần còn lại phase 08.

## Test

| Bước | Kết quả |
|---|---|
| shared | 86/86 |
| API toàn bộ (lần 1, tester) | 46 file, 327/327 |
| API toàn bộ (chạy lại một mình) | 46 file, 327/327 |
| worker | 34/34 |
| client typecheck / lint / build | sạch |
| `public-bracket.e2e-spec.ts` sau sửa review | 8/8 |
| `draws.e2e-spec.ts` sau sửa test chập chờn | 6/6 lượt xanh |
| API toàn bộ, bản cuối (sau mọi sửa review) | 47 file, 330/330, exit 0 |
| worker sau sửa (header/giới hạn tag dùng chung) | 34/34 |

- Một lượt chạy chồng (script seed vô tình gộp `include`, chạy cả bộ song song với tester) ra 4 test rớt. Không ghi lại tên test. Hai lượt chạy riêng sau đó đều xanh, nên kết luận là do hai lượt giẫm DB/Redis của nhau.
- Phát hiện test chập chờn có từ phase 06: `draws.e2e-spec.ts` (đặt suất vòng loại) tính kết quả mong đợi bằng `${randomSeed}:qualifiers`, trong khi service dùng `placementSeed` ngẫu nhiên riêng (`draw-edit.service.ts:78`). Với 2 suất thì đúng 50%. Đã sửa: test đọc `placementSeed` từ audit.

## Smoke local (DB `localhost:5433/kamito_tt_dev`, dữ liệu thử đã dọn)

- Trang `/vi/.../draws/MS`: tên, seed, BYE, LIVE, "Thắng trận #n", giờ theo múi giờ giải. `/en`: tên tiếng Anh, "Winner of match n".
- URL sai, `..`, `?draw=bad` → 404. API không có secret → 403.
- `/api/revalidate`: host nội bộ + secret 200; host công khai 404; giả `X-Forwarded-Host` 404; sai secret 403; tag sai 400.
- Cache: đổi DB mà chưa revalidate thì vẫn bản cũ; gọi revalidate xong thì request đầu thấy bản mới.
- 390 px: `scrollWidth` 375, header 56 px, chỉ khung nhánh cuộn ngang. Ảnh: `screenshots-261113-phase-08-slice/`.
- Phát hiện khi smoke: log request của API in nguyên văn secret SSR. Đã sửa: đổi header sang `x-internal-secret` (tên phase 01 đã chừa trong danh sách che log). Đường che log lấy từ hằng `SSR_SECRET_HEADER` dùng chung. Đã kiểm log ra `***`.

## Review (code-reviewer, 7/10) — trạng thái

| Mục | Nội dung | Trạng thái |
|---|---|---|
| H1 | Next chỉ cache response 200. API trả 404 nên trang đã gỡ (draw bỏ công bố, giải hủy) vẫn hiện mãi. Bỏ công bố draw không gửi tag | Đã sửa cả 2 lớp: API public trả `200 {data:null}`; bỏ công bố/thay VĐV/rút VĐV trên draw đã công bố gửi tag `draw.unpublish` / `draw.postPublishEdit`. Test: công bố → thấy, bỏ công bố → ẩn + tag đúng |
| M1 | Tên site fix cứng trong từ điển, lệch AppSetting `site.name` | Đã sửa: header/footer dùng `appSettingRegistry.siteName` (giá trị mặc định cho tới khi có API settings công khai) |
| M2 | `/api/v1/public` fix cứng ở client | Đã sửa: `API_GLOBAL_PREFIX` + `PUBLIC_API_SEGMENT` ở `@kamito/shared`, API và client cùng dùng. Ghi chú: API không đọc env `API_BASE_PATH` (chỉ admin dùng), nên env không phải nguồn đúng |
| M3 | Fetch không timeout, không có `error.tsx` | Đã sửa: env `API_FETCH_TIMEOUT_MS`, `app/[locale]/error.tsx`; `cache()` của React để metadata + page vẫn 1 lượt gọi (signal tắt memoization của fetch) |
| M4 | slug rác không cache được | Hết, nhờ H1 (200 + null được cache) |
| L1 | `kind` có thể là mảng | Đã sửa: kiểm `typeof === 'string'`, có test |
| L2 | Kiểm Host chỉ là lớp phụ | Đã ghi rõ trong comment; giữ cả proxy + route có chủ ý (phòng thủ nhiều lớp theo Spike E) |
| L3 | `REVALIDATE_ALLOWED_HOSTS` phải khớp `CLIENT_INTERNAL_URL` | Đã ghi chú trong compose |
| L4, L5 | Header revalidate lặp literal; giới hạn tag chỉ ở client | Đã đưa `REVALIDATE_SECRET_HEADER`, `REVALIDATE_MAX_TAGS` vào shared; worker coi vượt giới hạn là lỗi vĩnh viễn |
| L6 | Test whitelist không phủ QUALIFIER/GROUP_PLACE | Đã thêm unit test `toPublicSource` |
| L7 | `availableKinds.sort()` dựa thứ tự chữ cái | Đã sửa: theo thứ tự `PUBLIC_DRAW_KINDS` |
| L8 | Màu xám fix cứng trong `bracket.module.css` | Chưa sửa: token chưa có màu chữ phụ; làm khi `ui-consistency` cho site công khai (phần còn lại) |
| L9 | MAIN có 2 URL | Đã sửa: link MAIN không kèm query |
| L10 | Đếm tag trùng | Đã sửa |

## Câu hỏi chưa giải quyết

- Bỏ công bố/hủy giải (event) chưa gửi tag: chờ phần còn lại phase 07 (đăng ký tag `events`, `event-{slug}`). Lớp `200 + null` đảm bảo trang tự ẩn sau TTL.
- `group-qualifier.service` (đưa người đi tiếp từ bảng vào nhánh chính) có sửa draw MAIN đã công bố mà không gửi tag hay không: chưa kiểm.
- Nhiều instance client: cache Next nằm riêng từng instance, nên cần cache handler dùng chung trước khi scale (đã nằm trong "để giai đoạn sau" của plan).
- Playwright `vertical-slice.spec.ts` + deploy staging (bước 4, mốc M1): chưa làm. Repo chưa có Playwright; staging chưa có.
