# Site công khai — Kamito (phase 08, 10–12)

> Cập nhật: 2026-11-19 · Phase 11–12 đã có CMS, bổ sung tiếng Anh, SEO và hardening trong working tree. API tích hợp và ba suite Playwright công khai đã đạt với PostgreSQL/Redis thật trên DB local riêng `kamito_tt_phase12_test`; 18 migration chỉ được áp dụng vào DB test trong đợt này. DB dev, staging, M1/M2 và hạ tầng phát hành vẫn chưa được nghiệm thu. Kết quả theo đợt ở [changelog](./project-changelog.md).
> Bổ sung phase 12: metadata Twitter, JSON-LD `SportsEvent` và header bảo mật đã có trong mã nguồn. CSP vẫn là report-only; chưa có báo cáo vi phạm staging để nghiệm thu chuyển sang enforce.
> Nguồn đối chiếu: `apps/client/src/app/[locale]/`, `apps/client/src/lib/`, `apps/client/src/proxy.ts`, `apps/client/next.config.ts`, `apps/api/src/modules/{public-events,public-competition,public-rankings,public-players,public-content}/`, `apps/client/tests/e2e/`.
> Kiến trúc chung xem [system-architecture.md](./system-architecture.md#site-công-khai-phase-08). Biến môi trường và chạy Playwright xem [deployment-guide.md](./deployment-guide.md#playwright-e2e-client). Kế hoạch: `plans/261111-1512-kamito-table-tennis-tournament-platform/phase-08-public-site-shell-event-pages-and-bracket-ui.md`.

## Contents
- [Tổng quan](#tổng-quan)
- [Trạng thái](#trạng-thái)
- [Route](#route)
- [API công khai](#api-công-khai)
- [Nội dung công khai (phase 11)](#nội-dung-công-khai-phase-11)
- [Xếp hạng và hồ sơ VĐV (phase 10)](#xếp-hạng-và-hồ-sơ-vđv-phase-10)
- [Dữ liệu và cache](#dữ-liệu-và-cache)
- [Proxy: locale, chặn revalidate, rate limit](#proxy-locale-chặn-revalidate-rate-limit)
- [SEO: metadata, sitemap, robots](#seo-metadata-sitemap-robots)
- [In ấn](#in-ấn)
- [Content-Security-Policy](#content-security-policy)
- [Việc còn mở](#việc-còn-mở)

## Tổng quan

Site công khai gồm danh sách và lịch giải, trang giải (6 tab), trận, nhánh và bảng đấu, bảng xếp hạng, danh sách và hồ sơ VĐV, tin, video, trang tĩnh và form liên hệ. Toàn bộ trang là Server Component trong Next.js (App Router), render HTML ở server. Dữ liệu đọc qua API `/api/v1/public/*` bằng secret nội bộ; trình duyệt không gọi API trực tiếp.

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
| Trang chủ (giải nổi bật, đang và sắp diễn ra) | 2 và phase 11 | Đã thay bản tạm bằng các khối CMS, xếp hạng và tài trợ có cấu hình |
| Bản in nhánh (`@media print`, `@page bracket`) | 3 | Xong |
| Metadata, canonical, hreflang, OG, sitemap, robots | 3; bổ sung phase 12 | Đã triển khai; Twitter card và JSON-LD `SportsEvent` bổ sung trong phase 12. Phạm vi sitemap và các mục còn mở xem mục SEO |
| Rate limit công khai, CSP report-only | 3 + bổ sung | Redis atomic dùng chung; bộ đếm cục bộ dự phòng khi Redis lỗi |
| Playwright e2e | 3 + bổ sung | Lượt cuối 51 đạt/7 bỏ qua theo viewport; xem báo cáo hoàn tất nợ còn lại |
| Lịch theo session/bàn, bản in lịch | Bổ sung 2026-11-15 | Đã triển khai trên dữ liệu phase 07. API tích hợp 24 test/3 spec đạt; Playwright lịch 5 đạt/1 bỏ qua có chủ đích (PDF mobile) ([scheduling](./scheduling.md)) |
| Bảng xếp hạng, danh sách và hồ sơ VĐV | Phase 10, 2026-11-17 | Đã triển khai SSR, lọc/phân trang ở server, chi tiết điểm native `<details>`, URL hồ sơ không chứa tên thật |
| Điểm xếp hạng theo vòng ở tab Thông tin | Phase 10, 2026-11-17 | Lấy phiên bản quy tắc có hiệu lực tại ngày kết thúc giải, chỉ cho nội dung gắn bảng đang bật |
| Tin, video, trang tĩnh, liên hệ, tài trợ và các khối trang chủ | Phase 11, 2026-11-19 | Đã triển khai mã nguồn và kiểm local; chưa áp migration hoặc triển khai staging |
| Kiểm thử Phase 11 | 2026-11-19 | 383 kiểm tra mã nguồn/script đạt: API `src` 177, worker 44, shared 101, client 50, admin 11; E2E dùng DB thật chưa chạy |
| UI công khai Phase 11 với API mẫu | 2026-11-19 | 7 route × 2 viewport (1440/390): 14/14 lượt trang và các tương tác đạt, không có `pageerror`; đã mở ảnh kiểm trực quan ([báo cáo](../plans/reports/tester-261119-phase-11-cms-mock-ui.md)) |
| UI admin Phase 11 với API/media mẫu | 2026-11-19 | 8/8 ca browser đạt; kiểm thêm payload lưu/nạp form 4/4 đạt, không có `pageerror` ([báo cáo](../plans/reports/tester-261119-phase-11-admin-mock-ui.md)) |
| Mốc M1 (deploy staging, Playwright trên staging) | — | Chưa làm |

## Route

Thư mục `apps/client/src/app/[locale]/`. Mọi route nhận `[locale]` là `vi` hoặc `en`.

| Route | Tham số query | Hàm dữ liệu (`lib/public-data.ts`) | Ghi chú |
|---|---|---|---|
| `/` | — | `getHomeContent`, `getSiteName` | Các khối bật/tắt bằng setting; top xếp hạng nằm trong payload trang chủ |
| `/events` | `q`, `tier`, `type`, `year`, `status`, `page` | `getEventList` | `q` có → không cache |
| `/events/calendar` | `year`, `tier` | `getEventCalendar` | Nhóm theo tháng |
| `/events/:slug` | — | `getEvent` | Tab Tổng quan |
| `/events/:slug/info` | `session`, `table` (mã công khai) | `getEventInfo`, `getSchedule`, `getEventRankingPoints` | Lịch và điểm theo vòng; vẫn mở khi chỉ có bảng điểm |
| `/events/:slug/matches` | `state` (live, completed, upcoming), `sub`, `date`, `q`, `page` | `getMatches` | `q` có → không cache |
| `/events/:slug/matches/:matchNo` | — | `getMatch` | Trang trận |
| Dải kết quả (header, mọi trang) | — | `getResultsStrip` | `GET /results/strip` |
| `/events/:slug/draws/:subEventCode` | `draw` (`main`, `qualifying`) | `getBracket` | Gọi API với `kind=` |
| `/events/:slug/draws` | — | — | Chỉ chuyển hướng tới nội dung đầu tiên có nhánh |
| `/events/:slug/groups/:subEventCode` | — | `getGroups` | Bảng đấu |
| `/events/:slug/groups` | — | — | Chỉ chuyển hướng |
| `/events/:slug/players/:subEventCode` | `stage`, `page` | `getEntries` | Danh sách VĐV |
| `/events/:slug/players` | — | — | Chỉ chuyển hướng |
| `/rankings` | `kind` (`singles`, `doubles`) | `getRankings` | Top N theo bảng đang bật, N lấy từ setting |
| `/rankings/:listCode` | `q`, `club`, `page` | `getRankingList` | Kỳ đã công bố mới nhất, giữ hạng gốc khi lọc; `q` có → không cache |
| `/players` | `q`, `gender`, `club`, `page`, `sort=name|rank` | `getPlayerList` | Chỉ hồ sơ đang hoạt động, công khai và chưa gộp; `q` có → không cache |
| `/players/:slug` | `page` (kết quả) | `getPlayerProfile`, `getPlayerResults` | URL chuẩn `p-<UUID>`; slug cũ/đã gộp chuyển 301 tới hồ sơ đích công khai |
| `/news` | `category`, `page` | `getArticles` | Lọc và phân trang SSR; khi lọc chuyên mục thì không cache |
| `/news/:slug` | — | `getArticle` | Nội dung rich text đã sanitize |
| `/videos` | `page` | `getVideos` | Phân trang SSR |
| `/videos/:slug` | — | `getVideo` | Iframe chỉ tải sau khi người dùng bấm phát |
| `/pages/:slug` | — | `getStaticPage` | Trang tĩnh đã công bố |
| `/contact` | — | Server Action → API | Next proxy trả HTTP 429 khi vượt hạn mức theo IP; API kiểm tra bổ sung |
| `not-found.tsx`, `error.tsx` | — | — | Trang lỗi theo locale |

Quy tắc chung:
- Tham số URL đi qua `toQuery` (`lib/public-query.ts`) trước khi gọi API. Giá trị không hợp lệ bị bỏ, không gửi đi. Nhờ vậy URL rác không tạo ra mục cache mới.
- Slug và mã nội dung qua `PUBLIC_URL_PART_PATTERN` (1–128 ký tự chữ, số, `_`, `-`). Sai thì 404 trước khi gọi API.
- Slug `calendar` là slug dành riêng (API chặn tạo giải có slug này).
- Trang không có dữ liệu hoặc chưa công bố thì `notFound()`.
- Tab Trận tự chọn trạng thái có dữ liệu: giải đang diễn ra thử live → upcoming → completed, dừng ngay khi có trận; URL chọn state rõ ràng được giữ kể cả rỗng. Bộ lọc ngày là date input có min/max theo giải, server bỏ ngày sai/lặp/ngoài biên trước khi tạo cached query; không còn giới hạn 62 ngày. Nội dung chỉ có vòng loại thì mở thẳng vòng loại.

## API công khai

Tiền tố `/api/v1/public`. Các API đọc nội dung dùng `GET`, `@Public()`, kiểm secret bằng `SsrInternalGuard`; gửi form liên hệ dùng `POST` với cùng guard. Controller nằm trong các module `public-events`, `public-competition`, `public-rankings`, `public-players`, `public-content`.

| Đường dẫn | Ghi chú |
|---|---|
| `events` | Danh sách thẻ gọn. Cỡ trang lấy từ `public.listPageSize` (mặc định 24, admin đổi được). Giải sắp tới xếp ngày tăng; các danh sách khác ngày giảm |
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
| `sitemap` | Dữ liệu slug/ngày sửa của giải, tin, video và trang tĩnh đã công bố; tab/nội dung giải khả dụng và trận `OFFICIAL` chưa void thuộc phạm vi công khai. Client dựng URL sitemap từ payload này |
| `rankings` | Bảng đang bật và top N của kỳ `PUBLISHED` mới nhất; overview không tải breakdown |
| `rankings/:listCode` | `page`, `pageSize` (trần kỹ thuật 100), `q`, `club`; trả đủ breakdown của các dòng trong trang |
| `players` | `q`, `gender`, `club`, `page`, `sort=name|rank`; tìm, sắp xếp trước phân trang ở PostgreSQL |
| `players/:slug` | Hồ sơ và hạng hiện tại; slug cũ/đã gộp trả `{redirectTo}` là slug chuẩn |
| `players/:slug/results` | `page`; chỉ trận `OFFICIAL`, không BYE, không void, trong giải và draw công khai |
| `events/:slug/ranking-points` | Quy tắc điểm theo vòng có `effectiveFrom <= endDate`, chọn phiên bản mới nhất cho từng ô |
| `articles`, `articles/:slug` | Lọc chuyên mục, phân trang server; chỉ trả bài `PUBLISHED` đã tới giờ đăng |
| `videos`, `videos/:slug` | Phân trang server; dữ liệu video dùng provider và mã nhúng đã kiểm tra phía API |
| `pages/:slug`, `footer`, `sponsors`, `home`, `events/:slug/content` | Trang tĩnh, footer, tài trợ, khối trang chủ và tin/video/tài trợ liên quan giải |
| `contact` (POST) | Honeypot, validation, rate limit theo IP đã xác minh; lưu hash IP có salt, không lưu IP thô |

Quy tắc phạm vi và trả về:
- Các query giải và thi đấu đi qua predicate dùng chung `publicScope` (`modules/public-scope/public-scope.ts`): giải `PUBLISHED` và không hủy, draw `PUBLISHED`, entry `CONFIRMED`, trận thuộc draw đã công bố. CMS dùng trạng thái công bố và thời điểm đăng riêng.
- Số liệu và danh sách trận dùng `isRealMatch`, `isPlayedMatch` (`packages/shared/src/match-predicates.ts`).
- Không công khai: 200 `{data: null}` (giải nháp/hủy, slug lạ, draw chưa công bố, hồ sơ ẩn). `publicGet` lưu cả kết quả null trong cache chung; trang Next chuyển thành HTTP 404, nên trạng thái gỡ nội dung thay được bản đã cache.
- Serializer là whitelist. Test snapshot toàn bộ tên trường của mỗi endpoint. Thêm trường phải sửa snapshot có chủ đích.
- Tra cứu theo slug và mã công khai. VĐV dùng namespace `p-<UUID>` được kiểm bởi helper dùng chung; không xuất `Player.slug` có thể chứa tên thật.
- Tham số URL sai ở API được bỏ qua (`public-query-params.ts`), không trả 400.
- Trận hủy kết quả (`isVoided`) có cờ `voided` ở tab trận và bảng đấu, không vào dải kết quả.
- Tìm VĐV theo `normalizedPublicName`, tương ứng `publicDisplayName ?? fullName`. Khi có tên thay thế, tên thật và tên thật tiếng Anh không xuất hiện trong dữ liệu hoặc khóa tìm kiếm công khai.

## Nội dung công khai (phase 11)

- Danh sách tin và video phân trang ở API; chuyên mục tin và số tin mỗi trang lấy từ `/settings`. HTML bài viết/trang tĩnh được sanitize khi ghi và sanitize lần nữa khi hiển thị.
- Màn soạn tin admin chia hai cột, có tab Tiếng Việt/English và cảnh báo bản dịch thiếu. Bản nháp lưu thủ công; `Đăng ngay` có xác nhận; menu cạnh nút mở lịch đăng. Rời trang khi có thay đổi hoặc ảnh đang tải phải xác nhận.
- Ảnh dán từ clipboard đi qua upload intent → tải tệp → xác nhận hoàn tất → xử lý ảnh. Editor chỉ chèn URL HTTPS sau khi media ở trạng thái `READY`; HTML dán không nhập ảnh từ bên ngoài hoặc `data:` URL. Môi trường local cần `MEDIA_PUBLIC_BASE_URL` là URL HTTPS công khai để chèn ảnh vào rich text; URL tương đối hoặc HTTP bị từ chối.
- Bài viết và trang tĩnh có trường vi/en; giao diện chọn bản tiếng Anh khi có, nếu thiếu thì dùng tiếng Việt. Trang footer và nhà tài trợ site-wide lấy nội dung đã công bố/đang bật.
- Phase 12 thêm `Article.categoryEn`, `Video.durationTextEn` và `StaticPage.footerGroupEn` xuyên suốt schema, admin, DTO, public whitelist và SSR. Nhãn bộ lọc chuyên mục lấy từ setting động `news.categoryLabelsEn`; chỉ xuất nhãn chuỗi của mã chuyên mục đang cấu hình, kiểm own-property để không đọc giá trị kế thừa như `__proto__`/`constructor`. Mã chuyên mục dùng để lọc không đổi; tóm tắt chỉ có tiếng Anh vẫn hiển thị ở locale `en`.
- Video chỉ nhận URL HTTPS từ nhà cung cấp được parser cho phép. Thẻ xem trước tải ảnh thu nhỏ trước; iframe YouTube privacy-enhanced hoặc Facebook chỉ được tạo sau thao tác phát, có `sandbox` và `referrerpolicy`.
- Trang chủ có thứ tự khối cố định. `home.sections` bật/tắt khối; `home.itemsPerSection` điều chỉnh số mục. Dải giải lọc giải đã kết thúc và sắp các giải còn diễn ra theo múi giờ riêng của giải.
- Form liên hệ dùng Next Server Action rồi gọi API nội bộ. Next proxy áp dụng `contact.rateWindowSeconds`/`contact.rateMaxRequests` cho POST tới route liên hệ và trả HTTP 429 kèm `Retry-After` khi vượt hạn mức. API kiểm tra IP đã xác minh và hạn mức bổ sung; DB chỉ lưu hash có salt. Worker dọn thư theo `contact.retentionDays`.
- Tab tài trợ của giải gửi `POST /admin/sponsors/reorder` theo phạm vi giải hoặc site-wide. Đổi thứ tự và audit metadata nằm trong cùng transaction; cảnh báo làm mới cache được trả sau commit, không làm mất thứ tự đã lưu.

Kiểm giao diện công khai ngày 2026-11-19 chạy Next production với HTTP API mẫu, không kết nối PostgreSQL/Redis: 7 route ở 1440 và 390 px đều trả HTTP 200, không tràn ngang và không có `pageerror`. Đã kiểm lọc chuyên mục phía server; iframe chỉ xuất hiện sau click với `sandbox`/`referrerpolicy`; cấu hình mẫu bật/tắt khối trang chủ. Với hạn mức mẫu 3 lượt, liên hệ gửi ba lần đầu thành công, lần thứ tư cùng IP trả HTTP 429 và lỗi trong form; đổi IP mẫu gửi lại thành công. Đã mở ảnh kiểm trực quan và sửa tỷ lệ ảnh, grid trang chủ, bộ lọc tin và thumbnail video lặp.

Admin chạy ứng dụng thật với API/media mẫu: 8/8 ca browser đạt, gồm xác nhận hủy/chấp nhận Back/Forward/menu, giữ nội dung vi/en và không cảnh báo thừa sau lưu, lấy đúng ID ở route cũ, nạp đủ form sửa video/trang tĩnh/tài trợ, chọn giải không gửi filter `isActive` ngoài hợp đồng. Dán ảnh đã kiểm đủ intent → PUT → complete → `READY`: khóa lưu/đăng khi đang xử lý, chỉ chèn HTTPS và từ chối URL tương đối. Kiểm thêm payload lưu/nạp form 4/4 đạt; xem [báo cáo admin với API mẫu](../plans/reports/tester-261119-phase-11-admin-mock-ui.md).

Sáu package shared, DB, API, worker, admin và client đều typecheck/lint/build đạt. Admin có 6 kiểm tra Windows (3 image policy, 3 hồi quy TipTap thật) và 5 kiểm tra WSL entrypoint, nằm trong tổng 383 kiểm tra mã nguồn/script ở trên. Các lượt browser dùng dữ liệu mẫu được tính riêng.

Các lượt mock ở trên là bằng chứng lịch sử về giao diện. Đợt phase 12 tiếp theo đã chạy API tích hợp thật **32 ca duy nhất/7 file** và ba suite Playwright công khai thật **55 đạt/5 bỏ qua có chủ đích theo viewport/0 lỗi** với Next production, API dist, PostgreSQL/Redis local và storage local. Chỉ iframe nhà cung cấp YouTube được thay bằng fixture. Đã kiểm nhãn tiếng Anh, canonical/hreflang, Twitter/JSON-LD, sitemap, header và CSP report-only. Không suy kết quả này thành toàn bộ ma trận CMS, worker hẹn giờ, storage/CDN S3 thật, nhiều replica, IP qua Traefik/CDN hoặc staging. Xem [API thật](../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261119-phase-12-real-api.md), [Playwright thật](../plans/261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261119-2234-phase-12-bilingual-public-e2e.md) và [UI mock lịch sử](../plans/reports/tester-261119-phase-11-cms-mock-ui.md).

## Xếp hạng và hồ sơ VĐV (phase 10)

- **Kỳ công bố là nguồn điểm:** hạng, biến động, số kết quả tính và breakdown lấy từ `RankingSnapshotRow` của kỳ `PUBLISHED` mới nhất theo `asOfDate`, rồi `publishedAt`. Sửa sổ điểm sống không đổi dữ liệu của kỳ đang công khai. Bảng bị tắt không hiện.
- **Top N là cấu hình:** `ranking.overviewTopN` trong `/settings`, mặc định mẫu 10, cho phép 1–100. Danh sách dùng `public.listPageSize`, tách biệt cỡ trang quản trị. `<details>` chứa đủ điểm trong HTML nên mở được khi tắt JavaScript; không fetch mỗi dòng.
- **Giữ phạm vi:** breakdown nội bộ mới lưu thêm `eventId` ổn định để kiểm đúng giải nguồn; tên và điểm vẫn là giá trị đã chốt, link dùng slug công khai hiện tại của chính id đó. Giải ẩn/hủy hoặc snapshot cũ thiếu `eventId` thì che tên, URL, mã hạng giải; điểm và ngày vẫn hiện. Không dùng slug cũ để cấp quyền vì slug có thể được giải khác dùng lại. Không trả `eventId`, `ledgerId`, ghi chú nội bộ hay entity thô; không sửa snapshot đã công bố, cần kỳ mới để có đủ nhãn cho dữ liệu cũ.
- **Riêng tư hồ sơ:** serializer whitelist không trả SĐT, email, ngày/năm sinh hoặc `Player.slug`. Link công khai là `p-<UUID>` từ `publicPlayerSlug()`. Hồ sơ ẩn, ngừng hoạt động hoặc đã gộp vẫn có thể hiện tên trên bảng/nhánh nhưng không có link hay ảnh hồ sơ. Slug cũ và chuỗi gộp chuyển 301 tới định danh chuẩn khi đích còn công khai; đích ẩn trả 404.
- **Thông tin tổng hợp:** hồ sơ đọc thông tin + setting, hạng hiện tại và giải đã đăng ký bằng 3 truy vấn SQL; lịch sử kết quả là endpoint phân trang riêng. `sort=rank` của danh sách dùng hạng tốt nhất trong các kỳ mới nhất của bảng đang bật, chưa có hạng ở cuối. Tuổi chỉ hiện khi `player.showAge` bật, tính từ ngày sinh, thiếu thì dùng năm sinh, theo múi giờ cấu hình.
- **Bảng điểm giải:** tab Thông tin dùng quy tắc mới nhất cho mỗi `(competitorKind, drawKind, stageCode)` có hiệu lực tại `endDate`; chỉ nội dung gắn bảng đang bật mới hiện. Tab vẫn có khi chưa có rich text hoặc lịch.
- **Ngân sách truyền tải:** mốc 80 KiB là số byte body HTTP đã gzip, không phải JSON thô. `sendPublicJson` dùng gzip của Node cho `/rankings` và `/rankings/:listCode` khi client chấp nhận; SSR gửi `Accept-Encoding: gzip`. Kiểm HTTP thật 50 dòng × 20 khoản = 1.000 khoản giữ đầy đủ: JSON 377.129 byte, gzip 9.307 byte. JSON thô vượt mốc 80 KiB; không cắt điểm để đạt mốc. Bằng chứng: `apps/api/test-results/public-ranking-payload-budget.json`, suite `public-ranking-payload.e2e-spec.ts`.

## Dữ liệu và cache

Luồng:

```
Trình duyệt ──> proxy.ts (locale, rate limit, chặn /api/revalidate)
             ──> trang Server Component (SSR)
                   └─ publicGet()  (lib/api-client.ts, chỉ server)
                        header x-internal-secret, Redis response cache + tag versions
                   ──> api: /api/v1/public/* (API_INTERNAL_URL)
```

`publicGet()` là điểm đọc API công khai. Nó dùng Redis response cache với tag và TTL theo `policy`; request upstream đặt `cache: 'no-store'` và timeout trực tiếp, không còn stale revalidation do Next bỏ signal. Server Action liên hệ là luồng ghi riêng, không cache:

| `policy` | TTL | Dùng cho |
|---|---|---|
| `standard` | `PUBLIC_REVALIDATE_SECONDS` | Danh sách, lịch, thông tin, VĐV, site; loader bảng xếp hạng trong sitemap vẫn dùng cache riêng |
| `matchday` | `MATCHDAY_REVALIDATE_SECONDS` | Trang giải đang đấu: trang giải, trận, nhánh, bảng, dải kết quả; lịch theo session/bàn |
| `none` | không cache | Trang có `q` (tìm kiếm tự do) |

TTL chỉ là dự phòng. Làm mới chính là revalidate theo tag khi có thay đổi (xem [system-architecture](./cache-revalidation.md)).

Tag (`packages/shared/src/public-cache-tags.ts`, không dùng wildcard):

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
| `players`, `player-<slug>` | Danh sách VĐV, hồ sơ, tên/link trên nhánh và trận | `player.*`, `ranking.publish`; trận/nhánh/entry gửi tag hồ sơ liên quan. Import cũng gửi khi có VĐV mới |
| `rankings`, `ranking-<code>` | Tổng quan, từng bảng, hạng hiện tại trong danh sách/hồ sơ, sitemap bảng | Công bố kỳ, đổi bảng, sửa/gộp VĐV; đổi ảnh/nhóm tuổi cũng làm mới |
| `articles`, `article-<slug>`, `videos`, `video-<slug>`, `pages`, `page-<slug>`, `sponsors`, `home` | CMS, trang chủ, footer và nội dung liên quan giải | `content.write`; worker đăng bài gửi lại tag tin và trang chủ |

Bảng này tóm tắt. Mutation đầy đủ và route không gửi tag: [cache-revalidation](./cache-revalidation.md#mutation-và-tag). Thay đổi nào chưa có tag thì chỉ hiện trên trang sau khi cache hết TTL. Tính đến 2026-11-14, xếp suất vòng loại và nhất, nhì bảng đã có tag.

Cache JSON dùng chung Redis (`public-response-cache.ts`), khóa có `QUEUE_PREFIX`. Lua kiểm phiên bản tag và generation nguyên tử để phản hồi tải trước invalidation không ghi dữ liệu cũ trở lại. Redis lỗi thì đọc thẳng API; route invalidation trả 503 để worker thử lại. Hai tiến trình Next production local đã kiểm cùng cache và invalidation; không suy ra đã deploy production.

Lịch đọc `getSchedule(slug, query)` có cả tag `schedule-<slug>` và `event-<slug>`: thay lịch/kết quả, tên địa điểm hoặc thông tin entry đều làm mới dữ liệu. Đổi tên/mã bàn gửi lại tag lịch + giải; đổi tên địa điểm chỉ dùng riêng cho session cũng tìm đúng giải để vô hiệu cache. Danh sách mã lọc chỉ gồm session/bàn có trận công khai; query cache chỉ giữ các mã thuộc danh sách này.

Bảng xếp hạng và hồ sơ dùng thêm các tag chung `players`, `rankings`, `events`, `settings` phù hợp với dữ liệu: gỡ giải làm mới phần breakdown, ẩn VĐV gỡ link/ảnh, sửa setting làm mới tuổi và top N. Loader tag của trận, nhánh, entry, import và công bố kỳ gửi cả slug cũ lẫn `p-<UUID>`. `rankingRules.write` sau khi lưu ma trận gửi `events` và tag các giải bị ảnh hưởng để tab Thông tin đổi ngay, không chờ TTL.

## Proxy: locale, chặn revalidate, rate limit

File `apps/client/src/proxy.ts`. Thứ tự xử lý:

1. Path `/api/revalidate`: nếu `Host` không nằm trong `REVALIDATE_ALLOWED_HOSTS` thì trả 404. Đây là lớp thứ hai, lớp chính là quy tắc Traefik (chưa kiểm trên staging).
2. Locale: nếu thiếu `vi` hoặc `en` thì chuyển 307 theo cookie `locale`, header `Accept-Language`, mặc định `vi`.
3. Rate limit trang theo IP; bỏ qua route framework/API và request prefetch theo matcher trong code.
4. Route hồ sơ đọc kết quả tra cứu an toàn; khi API trả `redirectTo`, proxy gửi 301, `Cache-Control: private, no-store`, giữ locale và query. RSC navigation có fallback `permanentRedirect` của Next (308).

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
| `pageMetadata()` | `lib/page-metadata.ts` | Title, description, canonical, `alternates.languages` gồm `vi`, `en`, `x-default`, Open Graph và Twitter `summary_large_image` |
| `eventPageMetadata()` | `lib/page-metadata.ts` | Như trên, cho trang thuộc giải (dùng banner giải làm ảnh OG) |
| `metadataBase` | `app/[locale]/layout.tsx` | Lấy từ `PUBLIC_SITE_URL` |
| `app/sitemap.xml/route.ts`, `app/sitemap/[id]/route.ts` | Route | `dynamic = 'force-dynamic'`. Dữ liệu giải/tab/trận, tin, video và trang tĩnh từ `GET /public/sitemap`, bảng đang bật từ `GET /public/rankings`. Root trả URL set hoặc index khi cần chia file; không chứa URL hồ sơ VĐV |
| `app/robots.ts` | Route | `dynamic = 'force-dynamic'`. Cho phép `/`, chặn `/api` và `/api/`, trỏ tới `sitemap.xml` |
| JSON-LD | `lib/json-ld.ts`, trang giải/tin/video | Trang tổng quan giải dùng `SportsEvent`; trang tin có `NewsArticle`, trang video có `VideoObject`. Không sinh `Person` cho hồ sơ VĐV |

Sitemap xuất riêng URL `vi` và `en` cho mỗi nội dung, cùng alternate `vi`, `en`, `x-default`. Phạm vi gồm các trang tổng quan tĩnh, giải và tab khả dụng (`info`, `matches`, nhánh chính/vòng loại, bảng, danh sách đăng ký theo nội dung), trận `OFFICIAL` công khai chưa void/không BYE, tin, video, trang tĩnh CMS và bảng xếp hạng đang bật. Không sinh route tab chỉ để chuyển hướng. API kiểm trạng thái công bố và trả khả năng hiển thị từng tab; `getSitemap` đọc với `policy: 'none'`, không giữ cache JSON/Redis giữa các request. Dữ liệu bảng xếp hạng vẫn dùng loader/cache riêng.

`lib/sitemap-xml.ts` sắp xếp URL ổn định, escape XML và chia theo hai giới hạn giao thức: tối đa 50.000 URL và 50 MiB XML UTF-8 chưa nén trong mỗi file, gồm cả wrapper/alternate. `/sitemap.xml` giữ nguyên URL đã khai trong robots: một file thì trả `urlset`, nhiều file thì trả `sitemapindex` trỏ tới `/sitemap/0.xml`, `/sitemap/1.xml`… Cả URL set lẫn index đều kiểm giới hạn; không cắt bỏ URL âm thầm. Response XML có `Cache-Control: no-store`. Chunk không tồn tại hoặc ID sai dạng nhận 404, không bị proxy chuyển sang locale hay tính vào hạn mức trang. Đây là giới hạn kỹ thuật của định dạng, không phải giá trị nghiệp vụ cấu hình trên admin.

`SportsEvent` lấy tên/tóm tắt theo locale, ngày bắt đầu/kết thúc từ dữ liệu giải, URL canonical theo `PUBLIC_SITE_URL`, banner, địa điểm và thành phố khi có. `pageMetadata()` chuyển cùng title/description/ảnh sang Twitter; trang video thay ảnh OG/Twitter bằng thumbnail công khai. Các script JSON-LD dùng component `StructuredData` để escape ký tự `<` trước khi nhúng vào HTML.

Quy ước: mọi trang hiển thị nội dung gọi `pageMetadata` hoặc `eventPageMetadata`. Trang chỉ chuyển hướng (`draws`, `groups`, `players` ở cấp giải) và `not-found` được miễn.

Tên site (`getSiteName`, `lib/site-name.ts`): lấy từ `GET /public/site`. Nếu API lỗi thì dùng default của `appSettingRegistry.siteName`. Logo chính thức chưa có, header dùng wordmark chữ theo token.

Metadata bảng có tên và ngày kỳ chốt. Hồ sơ lấy ảnh công khai làm OG, `noindex` quyết định `robots.index`; chưa xuất JSON-LD `Person` và chưa đưa VĐV vào sitemap cho tới khi chốt đồng ý công khai. Next.js đã ghim 16.4.5 trong phase 10; đây là bản vá được [advisory chính chủ GHSA-mfr8-8qww-v76h](https://github.com/vercel/next.js/security/advisories/GHSA-mfr8-8qww-v76h) chỉ định.

## In ấn

| Phạm vi | Vị trí | Nội dung |
|---|---|---|
| Toàn site | `app/[locale]/global.css`, `@media print` | Ẩn header, footer, nav, form. Giữ màu nền (`print-color-adjust: exact`) để bảng navy và điểm vẫn đọc được. `@page` lề 10 mm |
| Nhánh đấu | `components/bracket/bracket.module.css`, `@page bracket` | Khổ ngang (landscape) |
| Lịch theo session/bàn | `components/schedule/session-table-schedule.module.css`, `@page schedule` | Khổ dọc; mỗi session/bàn bắt đầu trang mới. `thead` lặp tên giải, session, bàn, múi giờ khi bảng dài; tên VĐV xuống dòng. In lịch đang lọc, ẩn rich text và hero khi có lịch |

Nút `PrintScheduleButton` chỉ gọi `window.print()`; lịch và bộ lọc hoạt động bằng HTML server khi tắt JavaScript. Có thể dùng lệnh In của trình duyệt. Tên session/địa điểm có fallback vi/en; giờ hiển thị theo múi giờ của giải.

Kiểm chứng 2026-11-15: API tích hợp hồi quy 24 ca đạt; lịch/cache 18 ca đạt; sau cập nhật mutation map 11 ca đạt. Client build/typecheck/lint đạt. Playwright lịch với DB/API thật: 5 đạt/1 bỏ qua (PDF chỉ chạy desktop), kiểm SSR không JavaScript, form GET, vi/en, lịch rỗng, múi giờ, phạm vi riêng tư, 390/1280 px. PDF lịch thường 1 trang; lịch dài 3 trang đều lặp ngữ cảnh giải/buổi/bàn/múi giờ. Lượt toàn bộ trước sửa locator có 37 đạt/5 bỏ qua/2 lỗi mới; đã sửa locator và kiểm lại riêng lịch đạt, chưa chạy lại toàn bộ suite sau sửa. Báo cáo: [kiểm thử](../plans/reports/tester-261115-phase08-public-schedule.md), [review](../plans/reports/reviewer-261115-phase08-public-schedule.md) (9,5/10, không còn critical/high/medium).

## Content-Security-Policy

- Header `Content-Security-Policy-Report-Only` được đặt trong `apps/client/next.config.ts`. CSP chưa chặn tài nguyên, chỉ báo cáo. Chính sách vẫn có `script-src 'self' 'unsafe-inline'` và `style-src 'self' 'unsafe-inline'`; chưa có nonce cho script Next.js.
- Các nguồn hiện được khai: ảnh từ `'self'`, `data:` và HTTPS; iframe từ `https://www.youtube-nocookie.com` và `https://www.facebook.com`; `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. Danh sách iframe của CSP hiện là cấu hình trong mã, chưa sinh từ `VIDEO_EMBED_HOSTS`.
- Báo cáo gửi về `POST /api/csp-report` (`app/api/csp-report/route.ts`): tối đa 8 KB mỗi báo cáo, tối đa 30 bản ghi log mỗi phút. Log chỉ giữ origin hoặc dấu loại scheme và directive trong allowlist; bỏ credentials, path, query và nội dung thô của báo cáo.
- Phase 12 đã thêm header cho mọi path qua `next.config.ts`: `Strict-Transport-Security: max-age=31536000`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`. Chưa bật `includeSubDomains` hoặc preload vì phạm vi TLS của các subdomain chưa được xác nhận.
- API giữ CORP `same-origin` mặc định của Helmet cho response thông thường; riêng ảnh đã tái mã hóa ở `/api/v1/media/public/*` xuất `Cross-Origin-Resource-Policy: cross-origin` để client khác origin vẫn nhúng được ảnh công khai. Route này tiếp tục chặn `incoming/`, giới hạn dạng đường dẫn và giữ `nosniff`.
- Chuyển CSP sang enforce còn mở: bổ sung nonce hoặc cơ chế tương đương cho script Next.js, đối chiếu nguồn media/video hợp lệ, chạy trình duyệt trên bản build và rà báo cáo vi phạm staging sạch rồi mới đổi header. Header `frame-ancestors` trong CSP report-only không có tác dụng chặn; `X-Frame-Options: DENY` là header chặn nhúng đang được xuất riêng.

## Việc còn mở

Nguồn hiện tại sau rà ngày 2026-11-15: [đối chiếu nợ review](../plans/reports/reviewer-261115-phase08-review-debt-audit.md). Các báo cáo đợt 1–3 là lịch sử; chỉ mục còn mở trong bản đối chiếu mới được dùng để theo dõi. Những mục đã sửa hoặc quyết định giữ có lý do không tiếp tục ghi như lỗi chưa xử lý.

| Việc | Nguồn | Hướng xử lý |
|---|---|---|
| Kiểm lịch trên staging | Phase 08 mục 10, bổ sung 2026-11-15 | API tích hợp và Playwright lịch local đã đạt; tiếp tục kiểm trên staging |
| Mốc M1: deploy staging, chạy Playwright trên staging | Phase 08 bước 4 | Chờ staging (phase 01 và 02) |
| Traefik: quy tắc chặn `/api/revalidate` theo path và `forwardedHeaders` | Phase 08 Spike E | Kiểm trên staging. Rate limit và IP phụ thuộc vào đây |
| Áp migration CMS trên đích dev/staging và hoàn tất toàn bộ ma trận CMS | Phase 11 | 18 migration chỉ áp dụng trên DB local `_test`; API tích hợp và ba suite public thực tế đã đạt trong phạm vi nêu trên. Chưa áp dụng dev/staging hoặc nghiệm thu toàn bộ CMS |
| Xác minh luồng CMS vận hành và storage thật; deploy staging | Phase 11 | Browser mock admin 8/8, công khai 14/14 và public E2E local thật đã đạt; còn ma trận quản trị/hẹn giờ, S3/CDN và staging |
| Nghiệm thu SEO runtime trên dữ liệu phát hành | Phase 12 | Chia file/index, giới hạn URL/byte và browser với API thật local đã đạt; còn validator, container và dữ liệu phát hành trên staging. Hồ sơ VĐV vẫn bị loại trong khi chưa chốt đồng ý công khai |
| CSP enforce, nguồn iframe/media động | Phase 12 | Chưa có nonce và chưa rà báo cáo staging; giữ report-only tới khi kiểm được tài nguyên hợp lệ |
| Lighthouse, axe, tải nhẹ và E2E toàn luồng trên staging | Phase 12 | Chưa nghiệm thu. Mục tiêu mobile: Performance ≥ 85, Accessibility ≥ 90, SEO ≥ 95; axe không có critical; tải 5 req/s trong 2 phút không có 5xx và ghi p95 |

Đã sửa/đối chiếu: nav có `aria-current`; `LiveBadge` dùng chung ở 5 vị trí; 404 theo locale; canonical năm lịch chuẩn hóa; query `stage=main` dùng chung cache mặc định; nội dung không có draw bị chặn trước fetch. Nút vé hiện 20px/700, màu trắng/primary có tỷ lệ 4,3954:1, đạt ngưỡng chữ lớn 3:1.

Giữ có lý do: API sanitize HTML trước khi trả; `API_FETCH_TIMEOUT_MS` là cấu hình bootstrap ở env để giới hạn chính request đọc API/settings; `<select>` trong form GET phù hợp danh sách nội dung động; ô nhánh và thẻ trận dùng payload khác nhau nên không gộp toàn bộ. CSP report-only được giữ trong khi thiếu bằng chứng staging và đường nonce cho script. Wordmark KAMITO là nhận diện tạm theo plan.

Kiểm chứng đợt rà ghi nợ 2026-11-15: unit client 20/20; Playwright toàn bộ 45 đạt/7 bỏ qua theo viewport/0 lỗi, gồm nav, canonical năm, 404 tiếng Anh và nhãn cột điểm. Typecheck và lint src/tests đạt; test rate limit qua HTTP thật đạt. PDF lịch dài 3 trang giữ ngữ cảnh từng trang. Báo cáo: [tester](../plans/reports/tester-261115-phase08-review-debts.md). Lượt này thay cho giới hạn “chưa chạy lại toàn bộ suite” của lượt lịch trước đó.

Lượt hoàn tất sau đó đã đóng nợ timezone/DST, tìm/sort tên công khai, giới hạn ngày, trạng thái tự chọn, contract dài và cache nhiều replica. Migration `20261115032757_add_player_public_name_key` đã áp dụng DB dev local (16/16); staging chưa áp dụng. Bằng chứng: [timezone/DST](../plans/reports/reviewer-261115-phase08-timezone-and-dst.md), [tên công khai](../plans/reports/tester-261115-phase08-public-player-names.md), [runtime hai replica](../plans/reports/reviewer-261115-phase08-shared-public-runtime.md), [kiểm cuối](../plans/reports/tester-261115-phase08-remaining-debts.md). Kết quả cuối 51 đạt/7 bỏ qua thay cho số 45 của lượt rà trước.

Kiểm cuối chạy toàn bộ trên Next production và API đã build, port cô lập, JavaScript bật: 51 đạt/7 bỏ qua, 31,3 giây, không retry. Ảnh date input mobile đã mở kiểm. Lượt dev từng navigation lặp và lượt API source mất kết nối được ghi trong báo cáo; không quy kết nguyên nhân khi chưa có bằng chứng.

## Liên quan

- [system-architecture.md](./system-architecture.md): thành phần, luồng mạng, revalidate, route `/api/revalidate` của client.
- [deployment-guide.md](./deployment-guide.md): biến môi trường client, Traefik, Playwright.
- [code-standards.md](./code-standards.md#frontend): quy ước frontend và kiểm thử.
- [match-results.md](./match-results.md): nguồn dữ liệu trận và tag revalidate.
- [development-roadmap.md](./development-roadmap.md), [project-changelog.md](./project-changelog.md): trạng thái và lịch sử.
