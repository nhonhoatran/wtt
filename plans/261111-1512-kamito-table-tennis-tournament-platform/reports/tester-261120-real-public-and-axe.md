# Public E2E và axe với dịch vụ thật — 2026-11-20

## Môi trường và quyền thực thi

- Chỉ target đã được chấp thuận: **`localhost:5433/kamito_tt_phase12_test`**, PostgreSQL/Redis local thật. Root chuẩn bị 18 migration/seed danh mục trước lượt này; tác vụ browser không migrate hoặc sửa root `.env`.
- Thực thi tuần tự theo lease DB sau khi suite API của agent khác đã teardown; **workers 1, retries 0**. API production `dist/main.js` cổng **3313**, Next production đã build cổng **3314**, desktop **1440×900**, mobile **390×844**.
- Runner tạm và artifact mới tại `apps/client/test-results/261120-real-public-and-axe/` (Git ignored). Credentials lấy từ cấu hình đang hoạt động vào process; chỉ đổi tên DB sang test target đã duyệt, không ghi URL chứa mật khẩu vào file.
- Trước start, runner từ chối listener cũ ở hai cổng. Sau readiness đối chiếu cổng với đúng PID vừa spawn và identity gồm executable/command line/creation time. Khi dừng chỉ nhận PID có identity khớp, tránh kill PID tái sử dụng.

## Cleanup cuối sau khi nhả lease Lighthouse/k6

Đã backup current world, probe publish, log API/client và metadata PID vào `apps/client/test-results/261120-real-public-and-axe/cleanup-20261120-final-01/` trước khi chạy cleanup. Kiểm đọc chỉ dùng các ID thuộc retained world, không quét/xóa dữ liệu không xác định chủ từ lượt native crash cũ.

| Bản ghi theo ID đã biết | Trước | Sau |
|---|---:|---:|
| Event / sub-event / player | 3 / 6 / 73 | 0 / 0 / 0 |
| Draw / entry | 6 / 72 | 0 / 0 |
| Ranking list / snapshot / points | 2 / 4 / 0 | 0 / 0 / 0 |
| Group scoring rule / venue | 1 / 1 | 0 / 0 |
| Tier / event type riêng của ranking fixture | 1 / 1 | 0 / 0 |

Seed cleanup **1/1 đạt**, rồi kiểm đọc lại các ID trên đều bằng 0. Chỉ dừng API **10388** và client **23360** sau khi đối chiếu identity; cổng **3313/3314 không còn listener**. File world đang hoạt động được xóa sau assertion cleanup, metadata server được chuyển sang file retired; các bản backup giữ nguyên. Không dừng PostgreSQL/Redis dùng chung và không xóa queue không xác định chủ.

Root `.env` SHA256 sau cleanup khớp bản ghi đầu lượt `test-results/261120-real-env-hash-before.txt`: `a77d3711a901e6a9690bc6e301cb40248eef0bd8e8ea8bb4324bd4d1a7e1c931`. Artifact: `exact-fixtures-before.json`, `exact-fixtures-after.json`, `cleanup.log`, `before-hashes.json`, `outcome.json` trong thư mục cleanup nêu trên.

## Sau sửa metadata — `metadata-after` (source cuối)

Lượt Lighthouse đầu của root phát hiện mô tả SEO thiếu trên home/event/draw. Đã tái hiện riêng trước sửa: **7/12 unit metadata thất bại** và **2/2 browser regression thất bại** trên production build trước đó; home/event/draw có `description = null` ở cả vi/en, trong khi ranking đã có mô tả.

Sửa tối thiểu:

- Home lấy `home.metaDescription` từ dictionary JSON vi/en. Event dùng summary ngôn ngữ đang xem nếu có nội dung; EN trống thì lấy VI. Nếu cả hai null/rỗng/chỉ khoảng trắng, dùng template `event.metaDescription` từ cùng dictionary với tiêu đề trang/tên giải. Chỉ `trim()` để xác định trống, giữ nguyên từng ký tự của summary hợp lệ đã nhập.
- Không thêm schema/setting mới; không gán cùng mô tả dự phòng cho mọi route và không đổi `pickLocalized` toàn site. Giữ title/canonical/hreflang và đồng nhất description chuẩn/Open Graph/Twitter qua helper hiện có.
- Source: `apps/client/src/lib/page-metadata.ts`, `apps/client/src/app/[locale]/page.tsx`, `apps/client/src/i18n/{vi,en}.json`. Regression: `tests/unit/page-metadata.test.ts` và `tests/e2e/site-chrome-and-seo.spec.ts` trong client.

Kết quả sau sửa:

| Kiểm tra | Kết quả |
|---|---|
| Toàn bộ client unit | **83/83 đạt**, gồm 12 ca metadata (11 ca mới) |
| Client typecheck, scoped ESLint, production build | **Exit 0** |
| Browser `site-chrome-and-seo` + accessibility | **32 phát hiện, 27 đạt, 5 skip có chủ đích, 0 lỗi/flaky**, 35,531 giây |
| Description regression | 4 core route × vi/en × desktop/mobile; root/OG/Twitter đồng nhất, home/ranking đúng dictionary, event/draw có tên giải |
| Axe source cuối | **36 scan**, mỗi nhóm project/locale có 9; **critical/serious/moderate/minor/unknown đều 0** |

Lệnh lọc chọn toàn bộ file `site-chrome-and-seo` ngoài bốn ca accessibility, nên bao gồm cả locale, security headers, layout mobile và print. Năm skip gồm nav desktop trên mobile, ba kiểm mobile trên desktop và print trên mobile. Đây là lượt riêng trên build metadata mới; **không diễn giải 96 ca của `full-03` là đã chạy lại trên build này và không cộng ca trùng thành coverage mới**.

Trước restart đã backup world/PID. Sau build/restart có xác minh ownership, cấu hình focused bỏ cả globalSetup/globalTeardown để không tạo hoặc ghi đè world. SHA256 file world trước/sau cùng là `9838643DCBB252F9991431DCFB3EF9287CACB57C10A87C8FC63C166E7098EAC7`. API PID **10388**, client PID **23360** là stack sau metadata; đã bàn giao root đo Lighthouse r02/k6, rồi cleanup sau khi nhả lease như phần trên.

Artifact giữ riêng: `metadata-before/{unit.log,browser.log,results.json,artifacts/}` cho regression thất bại; `metadata-after/{unit-final.log,typecheck.log,lint-final.log,client-build.log,browser.log,results.json,axe-summary-extracted.json,skipped-reasons.json,html/}` cho kết quả sau sửa. Kết quả Lighthouse do root quản lý, không suy luận từ browser SEO test.

## Sau sửa accessibility — `full-03` (trước sửa metadata)

**104 ca phát hiện, 96 đạt, 8 bỏ qua có chủ đích, 0 lỗi, 0 flaky**, **97,812 giây**; process Playwright exit 0. Chạy lại toàn bộ 10 spec sau khi build client và khởi động lại stack đúng ownership, không chỉ lọc bốn ca axe. Tám skip giữ nguyên lý do viewport/chạy một lần như baseline bên dưới.

**36 scan axe đều không có violation** trong các rule/tag đã chạy; gate hiện hành chặn cả critical và serious, không tắt rule hoặc bỏ node:

| Project | Locale | Scan | Critical | Serious | Moderate | Minor | Unknown |
|---|---|---:|---:|---:|---:|---:|---:|
| Desktop | vi | 9 | 0 | 0 | 0 | 0 | 0 |
| Desktop | en | 9 | 0 | 0 | 0 | 0 | 0 |
| Mobile | vi | 9 | 0 | 0 | 0 | 0 | 0 |
| Mobile | en | 9 | 0 | 0 | 0 | 0 | 0 |

- Hai probe admin publish → BullMQ worker riêng → SSR đã làm nóng đều đạt: desktop **209 ms** (`full-03/ranking-publish-refresh-47936.json`), mobile **218 ms** (`full-03/ranking-publish-refresh-39308.json`), so với giới hạn kiểm 10.000 ms. Đây là từng phép đo local, không suy ra phân vị hay tải đồng thời.
- Đã mở trực tiếp **tám ảnh** home/event/draw/rankings ở desktop và mobile. Nút phát nền đỏ đậm có chữ trắng rõ; glyph tăng hạng còn hiển thị; bộ lọc, hàng bảng, phân trang và tiêu đề nằm trong khung. Nhánh và thanh tab mobile cuộn trong vùng riêng theo thiết kế; ảnh không phải đánh giá toàn bộ trạng thái tương tác hoặc visual diff tự động. Ảnh dùng dữ liệu fixture, không có ảnh truyền thông production.
- Typecheck, lint phạm vi và 72 unit đã đạt trước rebuild; `pnpm --filter @kamito/client build` của lượt này exit 0. Review độc lập xác nhận hai sửa đổi UI giữ đủ nhãn null/0/tăng/giảm, dùng đúng convention `visually-hidden`/`aria-hidden` và token màu sẵn có.
- Trước tạo world mới, đã sao lưu world/PID/probe 198 ms/logs của `full-02` vào các file `full-02/retained-*`; cleanup **đúng world cũ** đạt 1/1. Sau đó stop stack cũ theo identity, xác nhận hai cổng trống, build → start → full suite. Không ghi đè baseline hoặc làm mất danh sách ID cũ.
- World mới ở `public-world-261120-real.json`. API PID **5268**, client PID **40192** được xác minh ownership khi start `full-03`; sau đó đã dừng đúng identity để build metadata. World được giữ nguyên cho stack metadata nêu trên.

Artifact sau sửa: `full-03/results.json`, `console.log`, `client-build.log`, `start.log`, `cleanup-full-02.log`, `axe-summary-extracted.json`, `skipped-reasons.json`, `html/`. Tám ảnh nằm trong `full-03/artifacts/accessibility-public-acces-a92de-l-or-serious-axe-violations-{desktop,mobile}/accessibility-{0,1,2,3}.png`; thứ tự lần lượt home, event, draw, rankings.

Các rule incomplete vẫn được lưu nguyên trong raw attachment, gồm `link-in-text-block` ở profile; kết quả trên không phải chứng nhận WCAG cho toàn site.

## Lượt trước sửa accessibility — `full-02`

**104 ca phát hiện, 96 đạt, 8 bỏ qua có chủ đích, 0 lỗi, 0 flaky**, 103.076 ms. Toàn bộ 10 spec hiện hành: event, lịch/in, bộ lọc ngày, locale/SEO/header/rate limit, bảng xếp hạng/hồ sơ, CMS tin/video/trang tĩnh, cấu hình trang chủ, form liên hệ và axe.

- CMS contact chạy Server Action thật, đối chiếu hộp thư admin qua đăng nhập thật, IP hash, honeypot và 429; CMS home tắt/bật section rồi kiểm trang nội dung vẫn mở.
- Chốt kỳ xếp hạng qua admin → BullMQ worker riêng → SSR đã làm nóng đạt ở cả hai project. Artifact của lần mobile cuối trong lượt này ghi **198 ms**, dưới giới hạn kiểm 10 giây; không áp số này cho staging hoặc cả hai lần đo.
- Không mock DB hoặc queue. Spec video chỉ stub **tài liệu iframe YouTube bên ngoài** sau click để không phụ thuộc uptime nhà cung cấp; trang Next, dữ liệu CMS/API và tương tác vẫn thật. Axe không click phát video và không stub API.

Tám skip: mobile không chạy lại cấu hình home và rate-limit độc lập viewport; PDF lịch và print nhánh chỉ desktop; nav desktop chỉ desktop; ba kiểm khung 390 chỉ mobile. Danh sách annotation đầy đủ: `full-02/skipped-reasons.json`.

## Axe trước sửa: không có critical nhưng còn serious

36 scan = 9 route (home, giải, nhánh, BXH, profile, tin, video, trang tĩnh, liên hệ) × vi/en × desktop/mobile. Đếm theo **rule occurrence trên từng route**, không phải số node:

| Project | Locale | Scan | Critical | Serious | Moderate | Minor |
|---|---|---:|---:|---:|---:|---:|
| Desktop | vi | 9 | 0 | 4 | 0 | 0 |
| Desktop | en | 9 | 0 | 4 | 0 | 0 |
| Mobile | vi | 9 | 0 | 4 | 0 | 0 |
| Mobile | en | 9 | 0 | 4 | 0 | 0 |

Hai nguyên nhân đã xác định bằng axe và source:

1. **`color-contrast`** tại nhãn phát video trên home/video: trắng trên `#EC1E24`, chữ 13,33 px đậm, tỷ lệ **4,39:1**, dưới 4,5:1 cho cỡ chữ đó. Source `components/content/video-embed.module.css`.
2. **`aria-prohibited-attr`** tại `RankMovement`: `aria-label` gắn vào `span` không có role phù hợp, trong BXH và hồ sơ (24 và 2 node ở fixture desktop vi). Source `components/rankings/rank-movement.tsx`.

Suite trước chỉ chặn critical, nên 96 pass không có nghĩa không còn serious. Bản sửa hẹp đã dùng token `--color-primary-strong` cho nút phát; nhãn biến động chuyển sang text `visually-hidden` cạnh glyph `aria-hidden`, theo convention đang có. Gate axe được tăng thành **0 critical và 0 serious**, không tắt rule hay loại node. Kết quả `full-03` ở trên xác minh bằng production build mới; baseline này được giữ nguyên bằng chứng.

## Lỗi runner trước khi có kết quả sản phẩm

1. Start đầu đã sẵn sàng và xác minh đúng PID, sau đó Node cảnh báo unsettled top-level await vì child được `unref`; runner exit 1 nhưng hai server vẫn sống. Đã đọc lại listener/identity trước tiếp tục và bỏ await không giữ event loop. Không coi exit 1 này là start command hoàn toàn thành công.
2. `full-01` dừng trước global setup vì `defineConfig(base, { webServer: [] })` còn giữ server base và báo cổng bận. Đã đổi sang spread một object để bỏ webServer base. Không lấy lượt này làm test sản phẩm, giữ `full-01/console.log`.
3. Bài test SEO mới lần đầu không nạp được JSON dictionary qua import ESM không có import attribute. Đã chuyển đọc JSON bằng `node:fs`, giữ `metadata-before/browser-runner-import.log`; sau đó mới chạy ra baseline browser thất bại thật nêu trên.
4. Typecheck của regression mới từng bắt tier fixture nhận `null` thay vì màu bắt buộc và mảng selector chưa khai tuple. Đã sửa dữ liệu/type của test rồi chạy lại typecheck thành công; giữ `metadata-after/typecheck-initial-{fixture,selector}.log` riêng.

Next ghi warning `next start` với `output: standalone`; các lượt này là production build chạy local theo runner hiện có, **không phải kiểm standalone container phát hành**.

## Artifact

Gốc: `apps/client/test-results/261120-real-public-and-axe/`:

- `full-02/results.json`, `console.log`, `html/`: kết quả browser trước sửa.
- `full-02/axe-summary-extracted.json`: 36 scan, mức độ, route, node và failure summary; raw axe JSON còn nằm trong attachment base64 của `results.json` và HTML report.
- `full-02/skipped-reasons.json`: tám skip có annotation.
- `full-02/artifacts/accessibility-*/accessibility-{0,1,2,3}.png`: bốn trang core × hai viewport trước sửa.
- `cleanup-20261120-final-01/public-world-261120-real.json`: backup mô tả world mới của `full-03`, sau đó giữ nguyên qua build metadata/Lighthouse/k6; file world hoạt động đã xóa sau cleanup. World cũ của `full-02` đã cleanup trước đó, metadata backup vẫn ở `full-02/retained-public-world-261120-real.json`.
- `cleanup-20261120-final-01/servers.json`, `api.*.log`, `client.*.log`: backup PID/ownership và log stack riêng trước khi dừng; metadata hoạt động đã được retire.

## Giới hạn hiện hành

- Kết quả trên là local thật, không đóng staging/M1/M2, CSP enforce, load/backup/rollback, consent hoặc full E2E vận hành giải tám bước.
- Chỉ chín loại route × vi/en × hai viewport được scan; không khẳng định toàn bộ site/admin không còn vi phạm. Các rule incomplete được giữ trong raw kết quả để cần thì kiểm thủ công.
- Public world và hai server tạm đã cleanup sau khi mọi tác vụ nhả lease. Không khẳng định DB test hoàn toàn trống: chỉ đối chiếu/xóa các ID được retained world ghi nhận; dữ liệu không xác định chủ không thuộc phạm vi này.
