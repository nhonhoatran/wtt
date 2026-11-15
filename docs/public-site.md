# Site công khai — Kamito (phase 08)

> Cập nhật: 2026-11-15 · Trạng thái: đã triển khai lịch/bản in và xử lý nợ code trong working tree, gồm timezone/DST, tên công khai, bộ lọc ngày dài và runtime Redis dùng chung. Kiểm cuối local: Playwright 51 đạt/7 bỏ qua, unit client 41 đạt; chưa deploy staging, M1/M2 và xác nhận hạ tầng thật vẫn mở.
> Nguồn đối chiếu: `apps/client/src/app/[locale]/`, `apps/client/src/lib/`, `apps/client/src/proxy.ts`, `apps/client/next.config.ts`, `apps/api/src/modules/public-events/`, `apps/api/src/modules/public-competition/`, `apps/client/tests/e2e/`.
> Kiến trúc chung xem [system-architecture.md](./system-architecture.md#site-công-khai-phase-08). Biến môi trường và chạy Playwright xem [deployment-guide.md](./deployment-guide.md#playwright-e2e-client). Kế hoạch: `plans/261111-1512-kamito-table-tennis-tournament-platform/phase-08-public-site-shell-event-pages-and-bracket-ui.md`.

## Contents
- [Tổng quan](#tổng-quan)
- [Trạng thái](#trạng-thái)
- [Route](#route)
- [API công khai](#api-công-khai)
- [Dữ liệu và cache](#dữ-liệu-và-cache)
- [Proxy: locale, chặn revalidate, rate limit](#proxy-locale-chặn-revalidate-rate-limit)
- [SEO: metadata, sitemap, robots](#seo-metadata-sitemap-robots)
- [In ấn](#in-ấn)
- [Content-Security-Policy](#content-security-policy)
- [Việc còn mở](#việc-còn-mở)

## Tổng quan

Site công khai là phần người xem thấy: danh sách và lịch giải, trang giải (6 tab), trang trận, nhánh đấu, bảng đấu, danh sách VĐV, thông tin giải. Toàn bộ trang là Server Component trong Next.js (App Router), render HTML ở server. Dữ liệu chỉ đọc qua API `/api/v1/public/*` bằng secret nội bộ. Trình duyệt không gọi API.

Nguyên tắc:
- Lọc, tìm kiếm, phân trang đều do server xử lý. Lọc là `<form method="get">`, phân trang là link thật. Không tải toàn bộ danh sách về trình duyệt.
- Tab là route con (`/events/:slug/draws/...`), không phải query. Mỗi tab có URL, metadata và tag cache riêng.
- Tab không có dữ liệu thì ẩn (không có vòng bảng thì không có tab Bảng đấu).
- Hai ngôn ngữ `vi` (mặc định) và `en`. Dữ liệu dùng `xxxEn ?? xxx`, thiếu bản en thì hiện bản vi.

## Trạng thái

| Hạng mục | Đợt | Trạng thái |
|---|---|---|
| API public: events, calendar, event, info, matches, match, groups, entries, results/strip; draws; site, sitemap; schedule | 1, 3, bổ sung 2026-11-15 | Đã triển khai; API lịch dùng whitelist `PublicSchedule`, phạm vi công khai và bộ lọc phía server |
| i18n vi/en, chuyển hướng locale, `proxy.ts` | 1 | Xong |
| Header, footer, dải kết quả, locale switcher | 2 | Xong |
| Danh sách giải, lịch giải (theo tháng) | 2 | Xong |
| Trang giải: `EventShell` (hero + tab) và 6 tab | 2 | Xong. Tab Thông tin hiện lịch session/bàn và `infoBody` khi có; lịch vẫn hiện khi không có rich text |
| Trang trận | 2 | Xong. Đứng ngoài `EventShell` |
| Trang chủ (đang và sắp diễn ra) | 2 | Xong, là bản tạm (phase 11 hoàn thiện) |
| Bản in nhánh (`@media print`, `@page bracket`) | 3 | Xong |
| Metadata, canonical, hreflang, OG, sitemap, robots | 3 | Xong |
| Rate limit công khai, CSP report-only | 3 + bổ sung | Redis atomic dùng chung; bộ đếm cục bộ dự phòng khi Redis lỗi |
| Playwright e2e | 3 + bổ sung | Lượt cuối 51 đạt/7 bỏ qua theo viewport; xem báo cáo hoàn tất nợ còn lại |
| Lịch theo session/bàn, bản in lịch | Bổ sung 2026-11-15 | Đã triển khai trên dữ liệu phase 07. API tích hợp 24 test/3 spec đạt; Playwright lịch 5 đạt/1 bỏ qua có chủ đích (PDF mobile) ([scheduling](./scheduling.md)) |
| Mốc M1 (deploy staging, Playwright trên staging) | — | Chưa làm |

## Route

Thư mục `apps/client/src/app/[locale]/`. Mọi route nhận `[locale]` là `vi` hoặc `en`.

| Route | Tham số query | Hàm dữ liệu (`lib/public-data.ts`) | Ghi chú |
|---|---|---|---|
| `/` | — | `getEventList` (đang và sắp diễn ra), `getSiteName` | Trang chủ tạm |
| `/events` | `q`, `tier`, `type`, `year`, `status`, `page` | `getEventList` | `q` có → không cache |
| `/events/calendar` | `year`, `tier` | `getEventCalendar` | Nhóm theo tháng |
| `/events/:slug` | — | `getEvent` | Tab Tổng quan |
| `/events/:slug/info` | `session`, `table` (mã công khai) | `getEventInfo`, `getSchedule` | Form GET, lọc lịch phía server |
| `/events/:slug/matches` | `state` (live, completed, upcoming), `sub`, `date`, `q`, `page` | `getMatches` | `q` có → không cache |
| `/events/:slug/matches/:matchNo` | — | `getMatch` | Trang trận |
| Dải kết quả (header, mọi trang) | — | `getResultsStrip` | `GET /results/strip` |
| `/events/:slug/draws/:subEventCode` | `draw` (`main`, `qualifying`) | `getBracket` | Gọi API với `kind=` |
| `/events/:slug/draws` | — | — | Chỉ chuyển hướng tới nội dung đầu tiên có nhánh |
| `/events/:slug/groups/:subEventCode` | — | `getGroups` | Bảng đấu |
| `/events/:slug/groups` | — | — | Chỉ chuyển hướng |
| `/events/:slug/players/:subEventCode` | `stage`, `page` | `getEntries` | Danh sách VĐV |
| `/events/:slug/players` | — | — | Chỉ chuyển hướng |
| `not-found.tsx`, `error.tsx` | — | — | Trang lỗi theo locale |

Quy tắc chung:
- Tham số URL đi qua `toQuery` (`lib/public-query.ts`) trước khi gọi API. Giá trị không hợp lệ bị bỏ, không gửi đi. Nhờ vậy URL rác không tạo ra mục cache mới.
- Slug và mã nội dung phải khớp `^[A-Za-z0-9][A-Za-z0-9_-]*$`. Sai thì 404 trước khi gọi API.
- Slug `calendar` là slug dành riêng (API chặn tạo giải có slug này).
- Trang không có dữ liệu hoặc chưa công bố thì `notFound()`.
- Tab Trận tự chọn trạng thái có dữ liệu: giải đang diễn ra thử live → upcoming → completed, dừng ngay khi có trận; URL chọn state rõ ràng được giữ kể cả rỗng. Bộ lọc ngày là date input có min/max theo giải, server bỏ ngày sai/lặp/ngoài biên trước khi tạo cached query; không còn giới hạn 62 ngày. Nội dung chỉ có vòng loại thì mở thẳng vòng loại.

## API công khai

Tiền tố `/api/v1/public`. Chỉ `GET`, `@Public()`, kiểm secret bằng `SsrInternalGuard`. Nguồn: `apps/api/src/modules/public-events/public-events.controller.ts`, `apps/api/src/modules/public-competition/public-competition.controller.ts`.

| Đường dẫn | Ghi chú |
|---|---|
| `events` | Danh sách thẻ gọn. `pageSize` tối đa 24 (setting `public.listPageSize`). Sắp xếp `startDate:desc` |
| `events/calendar` | Nhóm theo tháng |
| `events/:slug` | Giải, nội dung, tab khả dụng, nhà vô địch, số trận đã đấu |
| `events/:slug/info` | `infoBody` đã sanitize lại khi trả |
| `events/:slug/schedule` | `session`, `table`; session → bàn → trận. Chỉ trả ô đủ session + bàn + giờ, trận công khai, không BYE; mã lạ hợp lệ cho danh sách rỗng |
| `events/:slug/matches` | Lọc `state`, `sub`, `date`, `q`. Không trả trận BYE |
| `events/:slug/matches/:matchNo` | Chi tiết trận |
| `events/:slug/draws/:subEventCode` | `kind=main` (mặc định) hoặc `qualifying` |
| `events/:slug/groups/:subEventCode` | Bảng, BXH, trận bảng |
| `events/:slug/entries/:subEventCode` | `stage`, `page`. Không trả SĐT, email, ngày sinh |
| `results/strip` | Trận `LIVE` và `OFFICIAL` gần nhất của giải đang diễn ra |
| `site` | Tên site (`site.name`) và cấu hình rate limit |
| `sitemap` | Danh sách URL giải và trang giải cho sitemap |

Quy tắc phạm vi và trả về:
- Mọi query đi qua một predicate dùng chung `publicScope` (`modules/public-scope/public-scope.ts`): giải `PUBLISHED` và không hủy, draw `PUBLISHED`, entry `CONFIRMED`, trận thuộc draw đã công bố.
- Số liệu và danh sách trận dùng `isRealMatch`, `isPlayedMatch` (`packages/shared/src/match-predicates.ts`).
- Không công khai: 200 `{data: null}` (giải nháp, giải hủy, slug lạ, draw chưa công bố). Lý do không dùng 404: Next chỉ cache response 200 (xem [system-architecture](./system-architecture.md#site-công-khai-phase-08)).
- Serializer là whitelist. Test snapshot toàn bộ tên trường của mỗi endpoint. Thêm trường phải sửa snapshot có chủ đích.
- Tra cứu theo slug và mã, không nhận id thô từ URL công khai.
- Tham số URL sai ở API được bỏ qua (`public-query-params.ts`), không trả 400.
- Trận hủy kết quả (`isVoided`) có cờ `voided` ở tab trận và bảng đấu, không vào dải kết quả.
- Tìm VĐV chỉ theo tên hiển thị (`publicDisplayName`), không theo tên thật.

## Dữ liệu và cache

Luồng:

```
Trình duyệt ──> proxy.ts (locale, rate limit, chặn /api/revalidate)
             ──> trang Server Component (SSR)
                   └─ publicGet()  (lib/api-client.ts, chỉ server)
                        header x-internal-secret, Redis response cache + tag versions
                   ──> api: /api/v1/public/* (API_INTERNAL_URL)
```

`publicGet()` là điểm duy nhất gọi API công khai. Nó dùng Redis response cache với tag và TTL theo `policy`; request upstream đặt `cache: 'no-store'` và timeout trực tiếp, không còn stale revalidation do Next bỏ signal:

| `policy` | TTL | Dùng cho |
|---|---|---|
| `standard` | `PUBLIC_REVALIDATE_SECONDS` | Danh sách, lịch, thông tin, VĐV, sitemap, site |
| `matchday` | `MATCHDAY_REVALIDATE_SECONDS` | Trang giải đang đấu: trang giải, trận, nhánh, bảng, dải kết quả; lịch theo session/bàn |
| `none` | không cache | Trang có `q` (tìm kiếm tự do) |

TTL chỉ là dự phòng. Làm mới chính là revalidate theo tag khi có thay đổi (xem [system-architecture](./cache-revalidation.md)).

Tag (`packages/shared/src/public-cache-tags.ts`, không dùng wildcard):

| Tag | Trang dùng | Mutation gửi tag (api) |
|---|---|---|
| Tag | Trang dùng | Mutation gửi tag (api) |
|---|---|---|
| `events` | Danh sách giải, lịch giải, sitemap | `event.*`, và đổi thông tin hiển thị trên thẻ giải: `tier.write`, `eventType.write`, `venue.write`, `media.update`, `discipline.write`, `category.write` |
| `settings` | Danh sách, dải kết quả, VĐV, site | `settings.update` |
| `event-<slug>` | Tổng quan, thông tin, VĐV | Hầu hết mutation có ngữ cảnh giải: `event.*`, `subEvent.*`, nhánh, trận, lịch, đăng ký |
| `schedule-<slug>` | Danh sách trận, lịch | Trận, lịch (`schedule.update`, `session.*`), nhánh, giải |
| `draw-<slug>-<code>` | Nhánh | Trận, nhánh, lịch, đăng ký của nội dung |
| `groups-<slug>-<code>` | Bảng đấu | Trận bảng, nhánh có bảng, `group.standings`, đăng ký |
| `match-<slug>-<matchNo>` | Trang trận | Trận, lịch (trận có giờ đổi), `event.refresh` |
| `results-strip` | Dải kết quả | `match.confirm`, `match.amend`, `match.reopen`, `event.publish`, `event.unpublish`, `event.cancel`, `event.uncancel`, `event.refresh` |
| `players`, `player-<slug>` | Danh sách VĐV, hồ sơ VĐV | `player.*`, `ranking.publish`. Import (worker) cũng gửi khi có VĐV mới |

Bảng này tóm tắt. Mutation đầy đủ và route không gửi tag: [cache-revalidation](./cache-revalidation.md#mutation-và-tag). Thay đổi nào chưa có tag thì chỉ hiện trên trang sau khi cache hết TTL. Tính đến 2026-11-14, xếp suất vòng loại và nhất, nhì bảng đã có tag.

Cache JSON dùng chung Redis (`public-response-cache.ts`), khóa có `QUEUE_PREFIX`. Lua kiểm phiên bản tag và generation nguyên tử để phản hồi tải trước invalidation không ghi dữ liệu cũ trở lại. Redis lỗi thì đọc thẳng API; route invalidation trả 503 để worker thử lại. Hai tiến trình Next production local đã kiểm cùng cache và invalidation; không suy ra đã deploy production.

Lịch đọc `getSchedule(slug, query)` có cả tag `schedule-<slug>` và `event-<slug>`: thay lịch/kết quả, tên địa điểm hoặc thông tin entry đều làm mới dữ liệu. Đổi tên/mã bàn gửi lại tag lịch + giải; đổi tên địa điểm chỉ dùng riêng cho session cũng tìm đúng giải để vô hiệu cache. Danh sách mã lọc chỉ gồm session/bàn có trận công khai; query cache chỉ giữ các mã thuộc danh sách này.

## Proxy: locale, chặn revalidate, rate limit

File `apps/client/src/proxy.ts`. Thứ tự xử lý:

1. Path `/api/revalidate`: nếu `Host` không nằm trong `REVALIDATE_ALLOWED_HOSTS` thì trả 404. Đây là lớp thứ hai, lớp chính là quy tắc Traefik (chưa kiểm trên staging).
2. Rate limit (chỉ với trang, không áp cho `/api/*`, `/_next/*`, file có đuôi, và request prefetch của Next).
3. Locale: nếu path đã có `vi` hoặc `en` thì qua. Nếu không thì chuyển hướng 307 theo thứ tự: cookie `locale`, header `Accept-Language`, mặc định `vi`.

### Rate limit

Cơ chế (`apps/client/src/lib/public-rate-limit.ts`):

| Mục | Quy định |
|---|---|
| Bộ đếm | Cửa sổ cố định, Lua atomic trong Redis dùng chung; fallback RAM cục bộ khi Redis lỗi |
| Khóa | IP. IPv6 gom theo `/64` (một người dùng không đếm thành nhiều IP) |
| IP thật | Header `X-Real-Ip`; nếu không có thì phần tử cuối của `X-Forwarded-For` |
| Hai bucket | `page` (mọi trang) và `search` (thêm khi có `q`) |
| Vượt ngưỡng | 429, header `Retry-After` (giây), `Cache-Control: no-store` |
| Bộ nhớ | Trần `maxTrackedIps` dùng chung; fallback cục bộ cũng có trần. Khi Redis lỗi fallback không bảo đảm tổng hạn mức toàn cụm |
| Cấu hình | Lấy từ `GET /public/site`, giữ trong bộ nhớ một chu kỳ `MATCHDAY_REVALIDATE_SECONDS` |

Thông số nằm ở `/settings`, nhóm **Truy cập site công khai** (`packages/shared/src/public-site-settings.ts`):

| Key | Mặc định | Khoảng hợp lệ |
|---|---|---|
| `public.rateLimit.windowSeconds` | 60 | 10 đến 3600 |
| `public.rateLimit.maxRequests` | 600 | 30 đến 100 000 |
| `public.rateLimit.searchMaxRequests` | 60 | 5 đến 10 000 |
| `public.rateLimit.maxTrackedIps` | 100 000 | 1 000 đến 1 000 000 |

Lưu ý:
- Client đọc IP từ header do Traefik đặt. Nếu Traefik tin `X-Forwarded-For` do client gửi (`forwardedHeaders` trusted) thì client giả được IP. Chưa kiểm trên staging.
- Khi có CDN phía trước, phải kiểm lại chuỗi header.

## SEO: metadata, sitemap, robots

| Thành phần | Vị trí | Nội dung |
|---|---|---|
| `pageMetadata()` | `lib/page-metadata.ts` | Title, description, canonical, `alternates.languages` gồm `vi`, `en`, `x-default`, Open Graph |
| `eventPageMetadata()` | `lib/page-metadata.ts` | Như trên, cho trang thuộc giải (dùng banner giải làm ảnh OG) |
| `metadataBase` | `app/[locale]/layout.tsx` | Lấy từ `PUBLIC_SITE_URL` |
| `app/sitemap.ts` | Route | `dynamic = 'force-dynamic'`. Dữ liệu từ `GET /public/sitemap`. Sinh lúc chạy, không lúc build (Docker build không gọi được API) |
| `app/robots.ts` | Route | `dynamic = 'force-dynamic'`. Cho phép `/`, chặn `/api/`, trỏ tới `sitemap.xml` |

Quy ước: mọi trang hiển thị nội dung gọi `pageMetadata` hoặc `eventPageMetadata`. Trang chỉ chuyển hướng (`draws`, `groups`, `players` ở cấp giải) và `not-found` được miễn.

Tên site (`getSiteName`, `lib/site-name.ts`): lấy từ `GET /public/site`. Nếu API lỗi thì dùng default của `appSettingRegistry.siteName`. Logo chính thức chưa có, header dùng wordmark chữ theo token.

## In ấn

| Phạm vi | Vị trí | Nội dung |
|---|---|---|
| Toàn site | `app/[locale]/global.css`, `@media print` | Ẩn header, footer, nav, form. Giữ màu nền (`print-color-adjust: exact`) để bảng navy và điểm vẫn đọc được. `@page` lề 10 mm |
| Nhánh đấu | `components/bracket/bracket.module.css`, `@page bracket` | Khổ ngang (landscape) |
| Lịch theo session/bàn | `components/schedule/session-table-schedule.module.css`, `@page schedule` | Khổ dọc; mỗi session/bàn bắt đầu trang mới. `thead` lặp tên giải, session, bàn, múi giờ khi bảng dài; tên VĐV xuống dòng. In lịch đang lọc, ẩn rich text và hero khi có lịch |

Nút `PrintScheduleButton` chỉ gọi `window.print()`; lịch và bộ lọc hoạt động bằng HTML server khi tắt JavaScript. Có thể dùng lệnh In của trình duyệt. Tên session/địa điểm có fallback vi/en; giờ hiển thị theo múi giờ của giải.

Kiểm chứng 2026-11-15: API tích hợp hồi quy 24 ca đạt; lịch/cache 18 ca đạt; sau cập nhật mutation map 11 ca đạt. Client build/typecheck/lint đạt. Playwright lịch với DB/API thật: 5 đạt/1 bỏ qua (PDF chỉ chạy desktop), kiểm SSR không JavaScript, form GET, vi/en, lịch rỗng, múi giờ, phạm vi riêng tư, 390/1280 px. PDF lịch thường 1 trang; lịch dài 3 trang đều lặp ngữ cảnh giải/buổi/bàn/múi giờ. Lượt toàn bộ trước sửa locator có 37 đạt/5 bỏ qua/2 lỗi mới; đã sửa locator và kiểm lại riêng lịch đạt, chưa chạy lại toàn bộ suite sau sửa. Báo cáo: [kiểm thử](../plans/reports/tester-261115-phase08-public-schedule.md), [review](../plans/reports/reviewer-261115-phase08-public-schedule.md) (9,5/10, không còn critical/high/medium).

## Content-Security-Policy

- Header `Content-Security-Policy-Report-Only` được đặt trong `apps/client/next.config.ts`. Chưa chặn gì, chỉ báo cáo.
- Báo cáo gửi về `POST /api/csp-report` (`app/api/csp-report/route.ts`): tối đa 8 KB mỗi báo cáo, tối đa 30 bản ghi log mỗi phút. Nội dung được cắt ngắn trước khi ghi log.
- Chuyển sang enforce ở phase 12.

## Việc còn mở

Nguồn hiện tại sau rà ngày 2026-11-15: [đối chiếu nợ review](../plans/reports/reviewer-261115-phase08-review-debt-audit.md). Các báo cáo đợt 1–3 là lịch sử; chỉ mục còn mở trong bản đối chiếu mới được dùng để theo dõi. Những mục đã sửa hoặc quyết định giữ có lý do không tiếp tục ghi như lỗi chưa xử lý.

| Việc | Nguồn | Hướng xử lý |
|---|---|---|
| Kiểm lịch trên staging | Phase 08 mục 10, bổ sung 2026-11-15 | API tích hợp và Playwright lịch local đã đạt; tiếp tục kiểm trên staging |
| Mốc M1: deploy staging, chạy Playwright trên staging | Phase 08 bước 4 | Chờ staging (phase 01 và 02) |
| Traefik: quy tắc chặn `/api/revalidate` theo path và `forwardedHeaders` | Phase 08 Spike E | Kiểm trên staging. Rate limit và IP phụ thuộc vào đây |
| Trang chủ tạm; giải nổi bật và tin, video, nhà tài trợ | Phase 08 và 11 | Phase 11 |
| Bảng xếp hạng theo vòng trong tab Thông tin | Phase 10 | Phase 10 |

Đã sửa/đối chiếu: nav có `aria-current`; `LiveBadge` dùng chung ở 5 vị trí; 404 theo locale; canonical năm lịch chuẩn hóa; query `stage=main` dùng chung cache mặc định; nội dung không có draw bị chặn trước fetch. Nút vé hiện 20px/700, màu trắng/primary có tỷ lệ 4,3954:1, đạt ngưỡng chữ lớn 3:1.

Giữ có lý do: API sanitize HTML trước khi trả; `API_FETCH_TIMEOUT_MS` là cấu hình bootstrap ở env để giới hạn chính request đọc API/settings; `<select>` trong form GET phù hợp danh sách nội dung động; ô nhánh và thẻ trận dùng payload khác nhau nên không gộp toàn bộ. Hằng CSP là chốt kỹ thuật report-only, phase 12 rà lại khi enforce. Wordmark KAMITO là nhận diện tạm theo plan.

Kiểm chứng đợt rà ghi nợ 2026-11-15: unit client 20/20; Playwright toàn bộ 45 đạt/7 bỏ qua theo viewport/0 lỗi, gồm nav, canonical năm, 404 tiếng Anh và nhãn cột điểm. Typecheck và lint src/tests đạt; test rate limit qua HTTP thật đạt. PDF lịch dài 3 trang giữ ngữ cảnh từng trang. Báo cáo: [tester](../plans/reports/tester-261115-phase08-review-debts.md). Lượt này thay cho giới hạn “chưa chạy lại toàn bộ suite” của lượt lịch trước đó.

Lượt hoàn tất sau đó đã đóng nợ timezone/DST, tìm/sort tên công khai, giới hạn ngày, trạng thái tự chọn, contract dài và cache nhiều replica. Migration `20261115032757_add_player_public_name_key` đã áp dụng DB dev local (16/16); staging chưa áp dụng. Bằng chứng: [timezone/DST](../plans/reports/reviewer-261115-phase08-timezone-and-dst.md), [tên công khai](../plans/reports/tester-261115-phase08-public-player-names.md), [runtime hai replica](../plans/reports/reviewer-261115-phase08-shared-public-runtime.md), [kiểm cuối](../plans/reports/tester-261115-phase08-remaining-debts.md). Kết quả cuối 51 đạt/7 bỏ qua thay cho số 45 của lượt rà trước.

Kiểm cuối chạy toàn bộ trên Next production và API đã build, port cô lập, JavaScript bật: 51 đạt/7 bỏ qua, 31,3 giây, không retry. Ảnh date input mobile đã mở kiểm. Lượt dev từng navigation lặp và lượt API source mất kết nối được ghi trong báo cáo; không quy kết nguyên nhân khi chưa có bằng chứng.

## Liên quan

- [system-architecture.md](./system-architecture.md): thành phần, luồng mạng, revalidate, route `/api/revalidate` của client.
- [deployment-guide.md](./deployment-guide.md): biến môi trường client, Traefik, Playwright.
- [code-standards.md](./code-standards.md#frontend): quy ước frontend và kiểm thử.
- [match-results.md](./match-results.md): nguồn dữ liệu trận và tag revalidate.
- [development-roadmap.md](./development-roadmap.md), [project-changelog.md](./project-changelog.md): trạng thái và lịch sử.
