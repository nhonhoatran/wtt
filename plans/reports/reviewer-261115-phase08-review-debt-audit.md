# Đối chiếu nợ review phase 08

Ngày: 2026-11-15. Đọc lại review lát cắt 2026-11-13 và review đợt 1, 2, 3 ngày 2026-11-14, sau đó đối chiếu mã nguồn hiện tại. Các mã H/M/L dưới đây thuộc từng báo cáo gốc, không dùng lẫn giữa các đợt.

**Bản ghi tại lượt rà đầu, đã được bổ sung sau đó.** Những nợ code trong bảng “Còn mở” bên dưới đã xử lý ở lượt hoàn tất tiếp theo: xem `reviewer-261115-phase08-remaining-debts.md` và `tester-261115-phase08-remaining-debts.md`. Nguồn hiện tại giữ riêng staging/M1/M2 và xác nhận hạ tầng thật; không dùng bảng lịch sử dưới đây để mở lại nợ code đã đóng.

## Đã có bằng chứng đóng trước đợt sửa này

| Nguồn / mục | Bằng chứng hiện tại |
|---|---|
| Lát cắt H1, M1–M4, L1–L7, L9–L10 | Báo cáo lát cắt đã ghi sửa; API trả `200 {data:null}`, serializer nguồn ô chờ có test `QUALIFIER`/`GROUP_PLACE`, tag dùng shared; helper fetch có timeout. |
| Lát cắt L8 — màu xám | `components/bracket/bracket.module.css` dùng `var(--color-text-subtle)`; `packages/ui-tokens/src/tokens.ts:14` cung cấp token. Ghi chú “chưa sửa” ở phần lịch sử phase 08 đã cũ. |
| Lát cắt — bỏ công bố/hủy giải | `events.service.ts:93` và `:97` gọi `change`; `refreshPublic` gửi mutation visibility. `cache-tags.ts:80` chứa events, event, schedule, draw/groups, results-strip và match tags. |
| Lát cắt — đưa nhất/nhì bảng vào MAIN | `draws/group-qualifier.service.ts` sau transaction, nếu MAIN đã công bố thì enqueue `draw.placeQualifiers` qua `loadPlacementTagContext`; không còn khoảng hở được nêu ở lát cắt. |
| Đợt 1 H1 — test phạm vi | `public-events.e2e-spec.ts:116` kiểm giải nháp/hủy qua detail/info/matches/groups/entries; các suite public riêng kiểm draw nháp, entry rút và tên riêng tư. |
| Đợt 1 H2 — trận voided | `PublicMatchCard.voided`, serializer `toPublicMatchCard`, UI nhãn kết quả hủy; suite public matches/groups kiểm cờ và BXH. |
| Đợt 1 M3 — slug calendar | `packages/shared/src/slugify-vietnamese.ts:20` cấm `calendar`. |
| Đợt 1 M5, M6 | `public-events-list.query.ts` sort UPCOMING tăng dần; `public-event-detail.query.ts:104` dùng `COUNT(DISTINCT p.id)`. |
| Đợt 1 M7 — settings tag | Loader events/matches/entries ở `lib/public-data.ts` có tag `settings`. |
| Đợt 1 L12 — tab info / sanitize | `public-event-detail.query.ts:94` xét nội dung sau sanitize, thêm lịch công khai; `info()` sanitize lại khi đọc. |
| Đợt 2 H1 — query cache tự do | `lib/public-query.ts` + các route dùng `oneOf`/kiểm page/year/date trước khi fetch; lịch mới cũng chuẩn hóa bằng lựa chọn từ API. Giới hạn page vẫn cho phép nhiều trang hợp lệ, không phải trần tổng dung lượng cache đĩa. |
| Đợt 2 M1, M2 | Trang players tự chọn stage duy nhất; tab info fallback bản tiếng Anh khi tiếng Việt trống. |
| Đợt 2 M3 | Trang matches đã fallback từ live rỗng sang completed khi URL không chọn state. Không phải thuật toán tự chọn cả ba state; trường hợp chỉ có lịch upcoming vẫn là hạn chế UX. |
| Đợt 2 M4, M5 | LocaleSwitcher giữ `useSearchParams`; tên site đọc `/site` qua `getSiteName`. Wordmark KAMITO vẫn là nhận diện thương hiệu tạm bằng chữ, có comment và plan. |
| Đợt 3 H1, H2, M1 | Matcher prefetch có `missing`; bộ đếm có trần AppSetting và gom IPv6; có một promise refresh cấu hình, stale value trả ngay. Đợt này đang tăng kiểm chứng và sửa góc cạnh IPv6. |
| Đợt 3 M3, M4, L1, L4, L5 | CSP đã đọc stream có trần byte; calendar không query có canonical không query; sitemap dùng DEFAULT_LOCALE và x-default; 429 no-store; comment CSP ghi rõ phase 12. Những góc cạnh payload/CSP/year được sửa thêm trong đợt hiện tại. |
| Đợt 3 L8 — ảnh test ghi đè | `site-chrome-and-seo.spec.ts:112` dùng `testInfo.outputPath`, không ghi đè ảnh trong plans. |
| Đợt 2 L2 — mã sub-event không thống nhất | Đợt sửa 2026-11-15 dùng chung `PUBLIC_URL_PART_PATTERN` ở `packages/shared/src/public-api.ts`; API `parsePublicCode` và client `isUrlPart` nhận đầu `_`/`-`, mã ghép 81 ký tự, tối đa kỹ thuật 128; vẫn loại dấu chấm, slash, phần trăm và delimiter URL. Shared 2 test, API 6 test tham số, client 2 test đường dẫn đều đạt. |
| Nav chính thiếu trạng thái hiện tại | `components/layout/main-nav.tsx` dùng `usePathname` trong client boundary nhỏ; đúng trang có `aria-current="page"`, trang con giải có `location`. Header và dải kết quả vẫn ở server; menu `<details>` giữ HTML thuần. |
| Nhãn LIVE trùng lặp | `components/common/live-badge.tsx` và CSS dùng chung cho nhánh, thẻ trận, trang trận, dải kết quả, lịch. Variant giữ đúng màu/padding cũ. Không gộp toàn bộ ô trận: payload BYE/quota của nhánh khác thẻ trận có liên kết, ván, ngữ cảnh; chi phí refactor cao hơn lợi ích. |
| Tương phản nút vé | `event-hero.module.css` hiện 20px/700; token trắng `#FFFFFF` và primary `#EC1E24` có tỷ lệ tính từ luminance sRGB là 4,3954:1. Đạt ngưỡng 3:1 cho chữ lớn; ghi nợ 4,4:1 như chữ thường đã cũ. |
| Đợt 2 L3 — not-found | `app/[locale]/not-found.tsx` đọc locale qua `useParams`, cùng mẫu `error.tsx`; nội dung và link về trang chủ theo locale. |
| Đợt 2 L4 — query mặc định | Draw thiếu query và `draw=main` vốn cùng gọi `getBracket(...,'main')`, không có cache trùng ở fetch. Players đã bỏ `stage=main` khỏi query trước cached fetch; canonical các URL mặc định vẫn không query. |
| Đợt 2 L5 — draw rỗng | `loadDraw` lọc `drawKinds.length > 0` trước `requireSubEvent`, trả 404 trước khi gọi API nếu nội dung không có draw công khai. |
| Đợt 2 L9 — nhãn cột bên | `match-score-table.tsx` dùng `t.sideColumn` riêng trong vi/en, không format chuỗi đánh số bằng n rỗng. |

## Thay đổi trực tiếp trong phần API của đợt này

Đợt 3 L7: `apps/api/test/public-site.e2e-spec.ts` không còn yêu cầu DB không có cấu hình ghi đè. Suite lưu đúng năm key `/site` đọc, reset bằng `AppSettingsService` để xóa cache trong instance, rồi khôi phục các hàng gốc bằng transaction ở `afterAll`, kể cả khi setup hoặc assertion lỗi. Giữ cả `updatedAt` và `updatedById`; không đụng key khác. `site.name` không có editor admin nên reset qua service, không gọi endpoint DELETE cho key này.

- `pnpm --filter @kamito/api test public-site.e2e-spec.ts`: 7/7 đạt.
- `pnpm --filter @kamito/api typecheck`: đạt sau sửa narrowing của snapshot trong closure transaction.
- `pnpm --filter @kamito/api exec eslint test/public-site.e2e-spec.ts`: đạt.
- Lượt đầu dùng DELETE admin cho `site.name` trả 404; đã đổi sang service và chạy lại. Không che giấu lượt lỗi này.
- Không truyền hoặc thay `DATABASE_URL`; không thay schema/migration. Test không chạy đồng thời với suite thay đổi năm key trên.

## Còn mở — cần theo dõi riêng, không coi phase 08 hoàn thành toàn bộ

| Nguồn / mục | Bằng chứng, ảnh hưởng, hướng xử lý |
|---|---|
| Đợt 1 M4 — múi giờ lọc | `public-events-list.query.ts.listWhere` dùng `today()` theo múi giờ mặc định; card dùng timezone của giải. Có thể lọc và badge lệch quanh nửa đêm cho giải khác múi giờ. Cần lọc SQL theo timezone từng giải trước count/paginate; không tải toàn bộ về client để sửa. |
| Đợt 1 L9 — DST | `public-query-params.ts.zonedDayRange` lấy một offset và cộng 24 giờ. Ngày DST có thể lệch một giờ; tính hai mốc đầu ngày độc lập. Comment hiện đã khai rõ hạn chế. |
| Đợt 1 L10 — tìm tên hiển thị không dấu | `public-matches.query.ts.playerNamed` dùng contains insensitive cho publicDisplayName, khác nhánh normalizedName của tên thường. Cần cột chuẩn hóa publicDisplayName/migration hoặc giải pháp query đã đo hiệu năng. |
| Đợt 1 L11 — thứ tự theo tên pháp lý | `public-entries.query.ts:38` sort competitor.displayName; `packages/db/src/domain/competitors.ts:56` đồng bộ từ player.fullName. Tên trả về đã ẩn nhưng thứ tự vẫn theo tên cũ. Cần sort theo tên hiển thị công khai ở server, giữ phân trang chính xác. |
| Đợt 1 L13 — settings nhiều replica API | `app-settings.service.ts:10` cache 10 giây chỉ invalidated ở instance ghi. Cần invalidation chung trước scale; hiện vẫn giới hạn một instance trong kiến trúc. |
| Đợt 2 L1 — danh sách ngày tối đa 62 | Đã đặt tên `MAX_RENDERED_FILTER_DAYS` và comment rõ đây là chốt bảo vệ kích thước HTML, không phải quy định thời lượng giải. Hạn chế UX vẫn còn: giải dài hơn không chọn được ngày sau đó. Nên chuyển sang date input có min/max hoặc cấu hình thời lượng giải; không coi việc đặt tên hằng là sửa hết giới hạn này. |
| Đợt 2 L6 — trạng thái home literal | Trang chủ vẫn dựng query trạng thái bằng chuỗi thay vì helper/contract typed. Rủi ro lệch contract thấp; không phải lỗi hành vi hiện tại. |
| Đợt 2 L8 — comment | Một số comment mô tả tên hàm còn dài. Chỉ dọn khi sửa đúng vùng liên quan; không dịch/xóa hàng loạt tạo nhiễu diff. |
| Đợt 3 L6 — độ dài contract | public-event-contract.ts còn tập trung nhiều kiểu; ngưỡng 200 dòng là tiêu chí tổ chức mã, không phải lỗi runtime. Có thể tách contract theo tính năng. |
| Đợt 3 M2 — IP thật / Traefik | Code chỉ xác thực cú pháp IP, không tự chứng minh nguồn header. Cần kiểm forwardedHeaders/trustedIPs/CDN ở staging; giả header trực tiếp vào Next không phải bằng chứng edge an toàn. |
| Đợt 3 L3 — path chứa dấu chấm | Matcher vẫn bỏ qua mọi path có dấu chấm, kể cả path 404. Tác động thấp vì URL_PART chặn fetch API; cần ghi là chấp nhận có lý do hoặc thu hẹp matcher. |
| Lát cắt / đợt 2 L7 — nhiều instance / fetch nền | Next cache theo instance; cần cache handler chung trước scale. Next tự bỏ signal ở stale revalidation là giới hạn framework đã ghi nhận; timeout đọc ban đầu không chứng minh lượt nền có timeout. |

Giới hạn parse năm 2000–2100 và các chốt an toàn search/page là ràng buộc kỹ thuật đã được review chấp nhận, không tự nâng thành hoàn thành yêu cầu hỗ trợ năm ngoài biên.

Quyết định sau rà: giữ `API_FETCH_TIMEOUT_MS` ở env vì cần trước khi có thể gọi API/settings và phải giới hạn được chính request đọc settings; giữ `<select>` nội dung trong form GET vì danh sách thay đổi theo giải, không coi khác pill là lỗi; wordmark KAMITO là nhận diện tạm đã ghi trong plan. Hằng CSP 8 KB/30 log/phút là chốt bảo vệ report-only có comment mốc phase 12; không phải giá trị nghiệp vụ.

Chưa xác nhận staging, nhiều replica hoặc edge thật trong báo cáo này. Điểm review cuối của các sửa mới phải dựa trên diff cuối và kết quả kiểm thử bổ sung; không dùng điểm đó để xóa các follow-up còn mở trong bảng trên.

Kiểm chứng frontend cuối từ `plans/reports/tester-261115-phase08-review-debts.md`: unit 20/20, Playwright toàn bộ 45 đạt/7 bỏ qua theo viewport/0 lỗi; typecheck/lint src/tests đạt. Nav, canonical mặc định/lỗi/lặp/năm khác, 404 tiếng Anh và nhãn cột điểm đã kiểm trên trình duyệt. Test HTTP rate limit thật đạt. Lượt này thay cho giới hạn chưa chạy lại toàn bộ suite của báo cáo lịch trước đó; không thay thế kiểm staging.

## Review cuối phần sửa local mới

- Phạm vi chấm điểm: bộ đếm IP, proxy, parser CSP, nav/badge và các chỉnh sửa URL/filter/nhãn đã phối hợp trong đợt 2026-11-15; không chấm lại các tính năng lớn còn mở phía trên.
- Điểm: **9,5/10 — đạt sau sửa**, không còn phát hiện critical/high/medium mới trong diff đã đọc. Vẫn giữ riêng các nợ lịch sử và cổng staging.
- Đã phát hiện và sửa thêm IPv6 có hextet padding/IPv4-mapped; IPv6 có scope như `fe80::1%eth0` được Node chấp nhận nhưng URL parser từ chối. Bản cuối tách scope trước chuẩn hóa, có regression test. Bộ đếm chứa một entry mỗi visitor, bao gồm cả page và search bucket; cap là AppSetting hiện có.
- CSP loại payload `[null]`/body sai kiểu, từ chối Content-Length quá lớn, vẫn đo byte của stream thật và hủy khi vượt trần. Không dựa vào Content-Length để cho phép payload.
- Nav dùng `aria-current=page` cho URL đúng và `location` cho mục giải cha. Bộ lọc vẫn GET/SSR; client component mới không tải/lọc dữ liệu thi đấu trong browser.
- `pnpm --filter @kamito/client test`: **4 file / 20 ca đạt**, gồm IP canonicalization, cửa sổ/throttling/search, memory cap, promise refresh/fail-open, redirect/429, CSP byte/shape/log cap, URL catalog/traversal.
- `pnpm --filter @kamito/shared build`, shared `public-api.test.ts` 2 ca, API `public-query-params.test.ts` 6 ca; API typecheck, targeted eslint và client lint/typecheck: đạt.
- Kiểm thử trình duyệt và build cuối do lượt tester tổng hợp; không suy ra đạt từ unit test. Header IP qua Next trực tiếp chưa thay cho kiểm chứng cấu hình Traefik thật.
