# Review độc lập — lượt kiểm dịch vụ thật ngày 2026-11-20

## Phạm vi và phân vai

- Reviewer phase 09–10 đọc độc lập hai bản sửa accessibility của phase 08 và gate axe do điều phối triển khai. Không sửa source của tác giả khác, không query DB khi agent khác giữ lease.
- Probe `apps/api/test/playwright/vertical-slice-refresh.seed.ts` do agent phase 09–10 viết. Điều phối và reviewer phase 11–12 đã đọc chéo bản gốc; phần này không được tự nhận là review độc lập của chính tác giả. Reviewer phase 11–12 cũng đã đọc độc lập delta cleanup/timeout và artifact chốt.
- Kiểm source không thay cho browser/axe/Lighthouse trên build cuối. Mỗi packet đã đối chiếu được ghi riêng bên dưới; lượt trước sửa được giữ thành bằng chứng lịch sử.

## Kết quả review source accessibility

**Không có finding Critical/P1/P2 trong ba delta được giao.**

| Source | Đối chiếu và kết luận |
|---|---|
| `apps/client/src/components/content/video-embed.module.css:9` | Nút Play giữ chữ trắng, đổi nền sang token có sẵn `--color-primary-strong`; không đổi kích thước/vị trí hay trình tự tương tác. Token production tại `packages/ui-tokens/src/tokens.ts:5` là `#A31115`. Tự tính bằng Node từ ba kênh sRGB cho tỷ lệ trắng/nền **7,930:1**; đây là kiểm màu thuần, không thay cho axe trên computed style thật. |
| `apps/client/src/components/content/video-embed-facade.tsx:25` | Nút native vẫn có accessible name theo nhãn locale và tên video; cơ chế chỉ tải iframe sau click giữ nguyên. |
| `apps/client/src/components/rankings/rank-movement.tsx:5–9` | Giữ logic null/0/tăng/giảm và nhãn vi/en hiện có. Glyph trực quan có `aria-hidden="true"`; text có ý nghĩa chuyển sang span `visually-hidden`, bỏ `aria-label` trên generic span. Nội dung không còn phụ thuộc nhãn ARIA bị cấm trên generic role. |
| `apps/client/src/app/[locale]/global.css:67–75` | Dùng lớp ẩn trực quan sẵn có: phần tử 1 px, clip, không `display:none`/`visibility:hidden`; nhãn vẫn nằm trong accessibility tree. Không thêm CSS hoặc thay layout. |
| `apps/client/tests/e2e/accessibility.spec.ts:27,36–37` | Gate nay chặn cả `critical` và `serious`, vẫn giữ JSON toàn bộ violations và incomplete rule IDs. Chạy chín route × vi/en × desktop/mobile; đây không phải chứng nhận toàn bộ WCAG hoặc kiểm thủ công screen reader. |

## Probe API → BullMQ → SSR và an toàn cleanup

Review chéo bản gốc của điều phối/phase 11–12 xác nhận guard target, UUID queue, cache key theo source, warm cache hai lượt và PTTL lớn hơn cửa sổ đo, request operator thật và production revalidation processor. Không gọi refresh thủ công để làm đạt.

Runtime của tác giả phát hiện và sửa hai điểm trong đúng file probe:

1. `AbortSignal.timeout` nhận số nguyên: source `apps/api/test/playwright/vertical-slice-refresh.seed.ts:47` làm tròn xuống thời gian còn lại sau khi Node self-check tái hiện `ERR_OUT_OF_RANGE` với `4999.25`.
2. `afterAll` dọn mọi `QueueName` trong chính UUID prefix, kiểm `getWorkers()` rỗng trước `obliterate` (`:92–109`). `confirm` tạo thêm job ranking, nên chỉ xóa revalidate chưa đủ; không dùng global SCAN+DEL để dọn queue. Ba response cache key riêng fixture vẫn được xóa theo key đã ghi nhận.

Lượt đầu chức năng đạt nhưng còn 10 BullMQ key UUID, không dùng làm bằng chứng cleanup sạch. Lượt chốt `261120-real-vertical-slice-20261120051744375` đạt 1/1, refresh **133 ms**, cache trước confirm 29.978/29.947 ms, completed revalidation job +1. Kiểm đọc hẹp sau teardown: event/player/ba response key/BullMQ UUID key đều 0; hai key login-IP riêng UUID tự hết TTL rồi kiểm cuối còn 0. `.env` hash trước/sau khớp. Chi tiết lệnh và artifact trong [báo cáo probe](./tester-261120-local-vertical-slice.md).

Reviewer phase 11–12 đọc source `:47,93–120` và raw probe/cleanup cuối, xác nhận **không có Critical/P1/P2**, mọi số record/key nêu trên là 0 và `envUnchanged=true`. Reviewer này cũng đọc chéo hai bản sửa accessibility, xác nhận cùng kết luận source ở trên. Sau review source, packet full-03 đã được đối chiếu trực tiếp và xác nhận axe 36 scan không violation như mục browser bên dưới. DB lease đã release trước khi client rebuild cho vòng accessibility tiếp theo. Kết quả không thay cho toàn bộ luồng tám bước giao diện/staging M1.

## Đối chiếu API và git chỉ đọc

- Reviewer tự đọc `test-results/261120-real-api-manifest.json`, mở từng JSON Vitest được manifest chọn và đếm assertion: **21 spec, 132 passed, không status khác passed**; khớp tổng của tester. Không cộng hai spec chạy lại hoặc lượt native crash dở.
- Snapshot git trước khi chốt docs: 30 tracked file thay đổi, 27 untracked, 0 staged; `git diff --check` exit 0. Quét 56 text file thay đổi bằng mẫu private key/API secret/DSN chứa credentials không có match; đây là quét mẫu giới hạn, không phải chứng nhận toàn repo không có secret.
- Không có `.env`, schema/migration Prisma hoặc `.gitignore` trong tập thay đổi. File đầu vào `docs/Mô tả tính năng QL Thể thao.docx` vẫn untracked, 40.335 byte; không mở/sửa/stage. Không commit hoặc push. Những số file trên là snapshot, có thể tăng khi docs/PM hoàn tất.

## Đối chiếu browser và Lighthouse sản phẩm

Reviewer tự đọc `apps/client/test-results/261120-real-public-and-axe/full-03/results.json`: **96 expected, 8 skipped, 0 unexpected, 0 flaky**, tổng 104, thời gian 97.811,757 ms. Đọc `axe-summary-extracted.json` xác nhận bốn nhóm desktop/mobile × vi/en, mỗi nhóm chín scan và mọi mức `critical/serious/moderate/minor/unknown` đều 0. Kết quả này là sau build hai bản sửa accessibility; baseline serious trước sửa vẫn giữ riêng. Phạm vi chỉ chín route, incomplete rules còn lưu, không chứng nhận WCAG đầy đủ.

Lighthouse sản phẩm lượt **r01 chưa đạt**. Reviewer mở trực tiếp ba LHR JSON tại `apps/client/test-results/261120-real-lighthouse/r01/`: home **99/100/92**, event **100/100/92**, draw **98/100/92** theo thứ tự Performance/Accessibility/SEO; sole failing SEO audit là `meta-description`. Summary cho route BXH ghi native exit **3221226505**, không có LHR để đánh giá. Không coi điểm thiếu là đạt hoặc dùng self-check thay báo cáo này. Source ở thời điểm r01 bỏ description khi falsy, home truyền `{}`, event chỉ lấy summary nullable; root cause đã được sửa và delta được reviewer đọc độc lập ở phần dưới. Artifact r01 giữ nguyên làm baseline.

Review hẹp diagnostic của điều phối trong `apps/client/tests/performance/lighthouse-audit.mjs:46–52`: thay chuỗi `??` bằng `||` sau `.trim()` để stderr/stdout rỗng không che thông báo; fallback nêu exit/signal, summary thêm message/signal. Vẫn đánh dấu failed rồi continue trên nonzero; không đổi threshold, Chrome options hoặc cách tính điểm. Không có Critical/P1/P2. Reviewer tự chạy `node --check` và `--help`, đều exit 0; không launch browser/HTTP trong các lệnh này.

Phương án metadata đã review trước write: thêm description home và template event tại dictionary vi/en; home truyền copy locale; event chọn authored summary nonblank, EN blank fallback VI, cả hai blank mới dùng title/name. Không thay generic `pageMetadata` hoặc `pickLocalized` toàn site, không schema/setting mới. Regression phủ null/empty/whitespace × vi/en, thứ tự ưu tiên/giữ authored summary, browser bốn core route × hai locale, root/OG/Twitter thống nhất; canonical/hreflang và title home giữ nguyên. Phương án không có finding chặn; delta source và kết quả unit độc lập được ghi ngay dưới.

Delta source đã review độc lập và **không có Critical/P1/P2**:

- `apps/client/src/lib/page-metadata.ts:49–55`: giữ page title và canonical; `.trim()` chỉ quyết định blank, giá trị authored nonblank truyền nguyên chuỗi, fallback dùng template locale với title tab/tên giải. Không sửa generic helper hoặc hàm localization chung.
- `apps/client/src/app/[locale]/page.tsx:22`, `i18n/{vi,en}.json:82,121`: home chỉ truyền description; title tiếp tục lấy layout, template và copy nằm trong dictionary vi/en, không thêm schema/setting mới.
- `apps/client/tests/unit/page-metadata.test.ts:35–58`: sáu blank case, ba fallback EN→VI, hai preserve authored và một generic metadata. Reviewer tự chạy `pnpm --filter @kamito/client exec vitest run tests/unit/page-metadata.test.ts`: **12/12 PASS, exit 0**, 250 ms, không API/DB/HTTP.
- `apps/client/tests/e2e/site-chrome-and-seo.spec.ts:37–54`: regression bốn core route × vi/en, mô tả nonblank, standard/OG/Twitter đồng nhất, so đúng copy home/BXH và event name trong fixture summary trống. Kết quả runtime sau build được xác nhận bằng packet focused dưới đây.

Reviewer đã tự mở `metadata-after/results.json` và `axe-summary-extracted.json` trong cùng gốc public artifact: **32 ca liệt kê, 27 expected, 5 skipped, 0 unexpected/flaky**, 35.530,639 ms. Hai ca description regression trên desktop/mobile đạt cho bốn core route × vi/en; 36 axe scan tiếp tục có mọi mức violation bằng 0. Đây là lượt chọn toàn bộ `site-chrome-and-seo` và axe trên build metadata cuối; **không** ghi là đã chạy lại đủ 10 spec/full-03 sau thay đổi metadata. Tác giả xác nhận full client unit 83/83, typecheck/lint/build exit 0 và retained-world hash khớp; reviewer độc lập trực tiếp chạy metadata unit 12/12 và đọc JSON focused, không tự nhận đã chạy lại cả 83 unit/build.

### Lighthouse r02 — đạt sau sửa metadata

Reviewer tự mở `apps/client/test-results/261120-real-lighthouse/r02/summary.json` và đủ bốn `*.report.json`, không chỉ dựa thông báo của runner:

| Trang | Performance | Accessibility | SEO | Meta description |
|---|---:|---:|---:|---:|
| `/vi` | 100 | 100 | 100 | score 1 |
| `/vi/events/entries-135d5a` | 99 | 100 | 100 | score 1 |
| `/vi/events/entries-135d5a/draws/MS` | 100 | 100 | 100 | score 1 |
| `/vi/rankings/RL-d6a46c4d` | 100 | 100 | 100 | score 1 |

Lighthouse **13.6.0**, `formFactor=mobile`, `throttlingMethod=simulate`; bốn report có `runtimeError=null`, summary `passed=true` với ngưỡng giữ **85/90/95**. Fetch time từ **2026-11-20T05:46:19Z** tới **05:46:56Z**, production local `localhost:3314`, exit 0 theo packet điều phối. R01 fail và native crash vẫn giữ nguyên, không bị ghi đè hoặc coi là đạt. Đây là kết quả bốn URL fixture trên build local sau metadata; không chứng minh standalone container, đường TLS/Traefik hoặc hiệu năng dữ liệu staging.

[Báo cáo Lighthouse riêng](./tester-261120-real-lighthouse.md) giữ lệnh, emulation và giới hạn bốn route VI; reviewer đã đọc bản báo cáo này và đối chiếu số với bốn LHR nêu trên.

## Đối chiếu smoke local

Reviewer tự đọc `test-results/261120-real-k6-20261120055042249/{summary.json,execution.json,preflight.json,stdout.log}` và source `tests/load/event-page-smoke-test.js:21–51`:

| Chỉ số | Đối chiếu raw |
|---|---|
| Target | Trang giải retained world qua WSL gateway tới local Next cổng 3314; health 200 trước run |
| Scenario | `constant-arrival-rate`, cấu hình 5 arrivals/s trong 120 s |
| HTTP request / iteration | 600 / 600 |
| Check HTTP 200 | 600 pass, 0 fail |
| Request failed / 5xx / dropped | Rate 0 / count 0 / count 0 |
| Thresholds | Đủ bốn threshold `ok=true`; không thêm hoặc hạ ngưỡng latency |
| Raw aggregate rate | **4,659093235332041/s**, không thay bằng cấu hình 5/s |
| Duration p95 / p99 / max | **14,12492825 / 30,98645496 / 79,963821 ms** |
| Process | Code 0, signal null; wrapper **131.997 ms**; `envUnchanged=true` |

`http_req_failed.values` ghi `passes:0, fails:600, rate:0` là Rate của boolean failed, không phải 600 phản hồi lỗi; check status 200 có đủ 600 pass. Image có sẵn `grafana/k6:2.4.0`, `--pull=never`, mount script read-only và `--rm`; tester đã kiểm container riêng không còn. Reviewer đọc artifact và [báo cáo smoke](./tester-261120-real-smoke.md), không tự chạy thêm HTTP/container trong lease của tester. Source bỏ response body và một iteration chỉ GET HTML trang giải có cache; không được gọi đây là đo assets/hydration, tải browser hoặc staging.

## Kết luận và giới hạn

- Không có Critical/P1/P2 còn mở trong các delta source được giao review độc lập: hai sửa accessibility, metadata và LH diagnostic; delta probe do reviewer khác đọc chéo. Các baseline không đạt vẫn được giữ nguyên.
- API 132/21 spec, browser full-03 trước metadata 96/8, focused build cuối 27/5, axe 36 scan, Lighthouse bốn route và smoke 600 request là các phép kiểm riêng; không cộng chúng thành tổng test duy nhất hoặc tuyên bố chạy lại full browser sau metadata.
- G1/G2, consent, CSP enforce, full UI giải tám bước, M1/M2 staging/Dokploy/Traefik, dữ liệu phát hành và rollback/restore chưa được các kết quả local này đóng. Cleanup world/server thuộc agent sở hữu được báo cáo riêng; báo cáo này chỉ xác nhận trực tiếp cleanup probe của tác giả và artifact liên quan.
- Snapshot git scope/secrets, cleanup và đối chiếu PM cuối được ghi dưới đây; không commit/push hoặc đổi checkbox.

## Đối chiếu cleanup, PM và scope bàn giao

Reviewer đọc trực tiếp `cleanup-20261120-final-01/{exact-fixtures-before.json,exact-fixtures-after.json,outcome.json}` trong gốc public artifact. Exact owned fixture trước dọn có 3 events, 6 subevents, 73 players, 6 draws, 72 entries, 2 ranking lists, 4 snapshots và mỗi loại một rule/venue/private tier/private event type; sau dọn **tất cả count bằng 0** (rankingPoints cũng 0). Outcome ghi dừng đúng PID API 10388/client 23360, listeners rỗng, `portsEmpty=true`, world file removed, server metadata retired và `envUnchanged=true`. Đây là đối chiếu artifact của agent sở hữu, không tự query DB hoặc stop process lại. PostgreSQL/Redis giữ nguyên; không khẳng định residue không rõ chủ từ native crash đã sạch.

Đếm lại trực tiếp đủ 12 `phase-*.md`: **134/163, 29 mở**, khớp [PM cuối](../../reports/pm-261120-real-services-sync.md). Phase 08 **27/28**, 09 **9/11**, 10 **8/9**, 11 **10/13**, 12 **7/14**; không đổi checkbox vì QA local. Kiểm link file tương đối của tám file plan/phase/PM/smoke: **94 link, 0 thiếu**. Không sửa các file PM/plan do agent khác sở hữu.

Snapshot git chỉ đọc lúc **2026-11-20T06:12:27Z** trên `main`: **36 tracked modified, 30 untracked, 0 staged**; `git diff --check` exit 0. Quét **65 text file thay đổi** bằng mẫu private key/API secret/DSN có credentials: 0 match; chuỗi xưng hô riêng tư: 0 match. `.env` hash hiện tại khớp baseline trước probe; env/schema/migration/.gitignore không có trong tập diff. File docx đầu vào vẫn untracked, 40.335 byte, không mở/sửa/stage. Raw scope tại `test-results/261120-real-final-review-scope.json`. Đây là quét mẫu giới hạn trong tập thay đổi, không chứng nhận toàn repo không có secret.

Docs validator đã chạy exit 0, link nội bộ hợp lệ; còn cảnh báo heuristic code reference/config key toàn docs, không xem warning count như đã xác minh mọi reference. Tài liệu bàn giao phân biệt rõ snapshot cũ, full browser trước metadata, focused sau metadata và giới hạn local/staging.
