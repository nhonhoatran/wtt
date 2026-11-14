# Code Review — Phase 08 batch 2: public pages (apps/client)

Ngày: 2026-11-14 · Phạm vi: trang public Next.js 16 (App Router, server components) trong `apps/client/src` — `app/[locale]/**` (trừ ranking), `components/{common,events,matches,groups,players,layout}`, `lib/{public-data,event-page,api-client,cache-policy,format-date-time}.ts`, `proxy.ts`, `i18n/*`. Có đối chiếu contract `packages/shared/src/public-event-contract.ts`, `public-bracket-contract.ts` và phía API `apps/api/src/modules/public-events`, `public-competition`, `public-scope/public-query-params.ts`.

## Kiểm chứng đã chạy
- `npx tsc --noEmit` (apps/client): exit 0.
- `npx eslint src/app/[locale] src/components src/lib src/i18n src/proxy.ts`: exit 0, không cảnh báo.
- So khóa `vi.json` với `en.json`: khớp 100% (không thiếu, không dư).
- Mọi file trong phạm vi < 200 dòng (lớn nhất `matches/[matchNo]/page.tsx` 105 dòng).
- Mã nguồn Next 16.4.3 đã cài: `patch-fetch.js:397-405` (force-cache + revalidate>0 không xung đột), `file-system-cache.js:473-475` (fetch cache ghi xuống `.next/cache/fetch-cache`, chỉ phần memory có LRU).

## Đánh giá chung
Chắc tay. Đường đi 404 vs empty-state nhất quán, tham số URL được kiểm tra trước khi ghép vào path API, query string dựng bằng `URLSearchParams` (không bơm được ký tự vào path), `cache()` dedupe metadata + page đúng chỗ, policy `none` chỉ bật khi có `q`. HTML của tab info được API sanitize lại khi đọc (đã xác nhận). Các vấn đề còn lại tập trung ở: số lượng cache key không giới hạn, vài góc cạnh UX khi dữ liệu lệch mặc định, và tiêu chí "không fix cứng".

---

## High

### H1. Số cache key fetch không giới hạn → cache trên đĩa phình ra theo query string tuỳ ý
- `lib/public-data.ts:24-32` `toQuery` chuyển nguyên giá trị người dùng gõ (chỉ trim) vào URL fetch; mỗi URL là một key trong Data Cache.
- Các trang có bộ lọc dùng `force-cache` khi không có `q`:
  - `app/[locale]/events/page.tsx:37` (`tier`, `type`, `year`, `status`, `page`)
  - `app/[locale]/events/calendar/page.tsx:23` (`year`, `tier`)
  - `app/[locale]/events/[slug]/matches/page.tsx:41` (`sub`, `date`, `page`)
  - `app/[locale]/events/[slug]/players/[subEventCode]/page.tsx:29` (`stage`, `page`)
- API bỏ qua giá trị sai (`public-query-params.ts`: `parsePublicCode`, `parsePublicPage`...) nên trả 200 hợp lệ → Next lưu lại. `?sub=x1`, `?sub=x2`, `?page=abc1`... mỗi biến thể là một file trong `.next/cache/fetch-cache` (Next 16.4.3 `file-system-cache.js:473-475`), không có eviction trên đĩa. Bot/crawler hoặc kẻ phá có thể làm đầy đĩa container và ép API gọi lại liên tục (mỗi biến thể là một cache miss).
- Đề xuất (chuẩn hoá trước khi fetch, chỉ cache URL chuẩn):
  - `matches`: giữ `sub` chỉ khi nằm trong `event.subEvents[].code`; `date` chỉ khi nằm trong `daysBetween(start,end)`; `page` chỉ khi là số nguyên dương.
  - `events`/`calendar`: `status` theo khóa `PUBLIC_EVENT_STATUSES`, `year` theo `/^\d{4}$/`, `tier`/`type` qua `isUrlPart`; `page` số nguyên.
  - `players`: `stage` theo khóa `PUBLIC_ENTRY_STAGES`, `page` số nguyên.
  - Giá trị không hợp lệ → bỏ khỏi query (hoặc `redirect` về URL chuẩn), hoặc fetch với policy `none`.
  ```ts
  const page = /^[1-9]\d{0,4}$/.test(one(query.page)) ? one(query.page) : undefined;
  const sub = event.subEvents.some((s) => s.code === one(query.sub)) ? one(query.sub) : undefined;
  ```
  `tier`/`type` vẫn là chuỗi tự do (chỉ giới hạn charset/độ dài) — chấp nhận được, hoặc so với `list.filters` rồi redirect canonical.

---

## Medium

### M1. Danh sách VĐV: sub-event chỉ có entry vòng loại → trang trống, không có đường tới danh sách vòng loại
- `players/[subEventCode]/page.tsx:27-29,58`: sub-event lọt vào `withEntries` vì `entryCount > 0` (API đếm mọi stage — `public-event-detail.query.ts:48,73`), nhưng không có `?stage` thì API mặc định `MAIN` (`public-entries.query.ts:30`). Nếu `stages = ['QUALIFYING']`: list MAIN rỗng, `stages.length === 1` nên PillNav ẩn → người xem chỉ thấy "chưa có VĐV", không bấm được sang vòng loại. Link từ trang tổng quan (`events/[slug]/page.tsx:26`) và `redirectToFirstSubEvent('players')` cũng dẫn vào đúng ngõ cụt này.
- Đề xuất: cùng logic như trang draw (`draws/[subEventCode]/page.tsx:22-23`) — khi URL không có `stage` và `list.stages` không chứa `list.stage` nhưng có phần tử khác, `redirect` sang `?stage=qualifying`; hoặc hiện PillNav khi `!list.stages.includes(list.stage)`.

### M2. Tab Info hiện ra nhưng bấm vào 404 khi chỉ có nội dung tiếng Anh và đang xem tiếng Việt
- API bật `tabs.info` nếu `infoBody` HOẶC `infoBodyEn` còn nội dung sau sanitize (`public-event-detail.query.ts:92`).
- Client `info/page.tsx:22-23` dùng `pickLocalizedOrNull('vi', null, en)` → `null` → `notFound()`. Kết quả: tab hiện trên `/vi/...` nhưng là link chết.
- Đề xuất: fallback ngược khi bản tiếng Việt trống (`html = pickLocalizedOrNull(...) ?? info.infoBodyEn`), hoặc API tính `tabs.info` theo từng locale. Chọn một, giữ nhất quán với quy ước trong `i18n/pick-localized.ts:3-8`.

### M3. Trang trận đấu mặc định tab "Đang diễn ra" trong suốt thời gian giải → thường xuyên trống
- `matches/page.tsx:27-28`: `lifecycle === 'ONGOING'` → `state = 'live'`. Ngoài giờ thi đấu (đêm, giữa phiên) không có trận LIVE → khách vào thấy "không có trận đang diễn ra", phải bấm thêm để xem kết quả/lịch. Trái với nguyên tắc "ít bước nhất" trong rule UI.
- Đề xuất: API `matches` trả kèm số đếm theo state (một `groupBy` nhỏ), client chọn state mặc định đầu tiên có dữ liệu theo thứ tự live → upcoming → completed; hoặc khi `live` rỗng và URL không chỉ định `state` thì redirect sang `upcoming`/`completed`.

### M4. Đổi ngôn ngữ làm mất query string (bộ lọc, trang, loại draw)
- `components/layout/locale-switcher.tsx:13-15` chỉ dựng từ `usePathname()`. Ví dụ `/vi/events/x/draws/MS?draw=qualifying` → `/en/events/x/draws/MS` (về draw chính); `/vi/events?tier=A&page=3` → `/en/events`.
- Đề xuất: thêm `useSearchParams()` (bọc `<Suspense>` ở chỗ render switcher để không ép cả layout sang client rendering) và nối `?${search}`.

### M5. Tên site lấy giá trị mặc định cứng thay vì AppSetting đã lưu
- `app/[locale]/layout.tsx:31-32` dùng `appSettingRegistry.siteName.defaultValue[locale]`; `site-header.tsx:19` còn chữ "KAMITO" cứng làm wordmark. Admin sửa `siteName` trên `/settings` sẽ không có tác dụng ở site public. Comment ghi rõ là tạm chờ endpoint public settings — cần có task theo dõi, đừng để trôi.

---

## Low

- **L1. Giới hạn 62 ngày cứng** `lib/format-date-time.ts:43` (`days.length < 62`): giải dài hơn sẽ thiếu ngày trong bộ lọc. Đây là chốt an toàn, không phải giá trị nghiệp vụ, nhưng nên đặt hằng số có tên hoặc đọc từ setting giới hạn thời lượng giải nếu có.
- **L2. Mã sub-event vs giới hạn parse của API**: `codeField` cho phép mã bắt đầu bằng `_`/`-` và mã ghép `DISC-CAT` dài tới 81 ký tự (`catalog-fields.ts:3-9`, `sub-event-format.ts:50-51`). Client `URL_PART` bắt ký tự đầu là chữ/số (`public-data.ts:18`) → sub-event như vậy bị 404 dù vẫn được link ra; API `parsePublicCode` tối đa 64 ký tự (`public-query-params.ts:24`) → lọc `?sub=` với mã dài hơn bị bỏ qua âm thầm. Nên thống nhất một regex dùng chung ở `@kamito/shared`.
- **L3. Trang not-found luôn tiếng Việt** (`app/[locale]/not-found.tsx:5-7`), kể cả dưới `/en` (khi đó `<html lang="en">` mà nội dung tiếng Việt). Có thể đổi sang client component đọc `useParams()` như `error.tsx`.
- **L4. URL trùng lặp**: `?draw=main` và `?stage=main` cho cùng nội dung với URL không tham số → hai cache key + hai URL cho SEO. Gộp vào việc chuẩn hoá ở H1 (bỏ tham số khi bằng giá trị mặc định).
- **L5. Trang draw gọi API cho sub-event không có draw**: `draws/[subEventCode]/page.tsx:21` dùng toàn bộ `event.subEvents`; nên lọc `drawKinds.length > 0` như trang groups/players để 404 ngay không tốn một lượt gọi API.
- **L6. Home dùng chuỗi `'?status=ongoing'` / `'?status=upcoming'`** (`app/[locale]/page.tsx:14`) thay vì khóa từ `PUBLIC_EVENT_STATUSES` — lệch contract sẽ không bị tsc bắt.
- **L7. Revalidate nền không có timeout**: Next bỏ `signal` khi revalidate stale (`patch-fetch.js:659-680`), nên `API_FETCH_TIMEOUT_MS` không áp cho lượt làm mới nền. Chỉ để biết, không cần sửa.
- **L8. Comment thừa** (luật "comment ít thôi"): `event-card.tsx:10`, `side-name.ts:5`, `match-score-table.tsx:8`, `event-hero.tsx:8`, `event-page.ts:16` diễn giải lại điều tên hàm đã nói. Các comment nói "vì sao" (`public-data.ts:17,34`, `api-client.ts:10-13`, `event-card.tsx:19`, `format-date-time.ts:17`) thì nên giữ.
- **L9.** `match-score-table.tsx:21` `format(t.side, { n: '' })` sinh nhãn ẩn "Side " có khoảng trắng thừa; nên dùng một khóa i18n riêng cho cột tên.

---

## Ngoài phạm vi client (phát hiện khi đối chiếu, chỉ để biết)
- **API không revalidate khi sửa event/entry/sub-event**: `events.service.ts:17` còn comment "Phase 07 hook", và `CACHE_TAGS` (`revalidation/cache-tags.ts`) không phát tag `events` ở đâu cả. Hệ quả cho site public: danh sách/lịch giải, trang tổng quan, info, danh sách VĐV (tag `event-<slug>`) chỉ cập nhật khi hết TTL; **gỡ public một giải vẫn còn hiện tới hết `PUBLIC_REVALIDATE_SECONDS`**. Cần task riêng ở phía API.
- TTL (`PUBLIC_REVALIDATE_SECONDS`, `MATCHDAY_REVALIDATE_SECONDS`, `API_FETCH_TIMEOUT_MS`) đang nằm ở env (`lib/server-env.ts:19-21`). Theo rule cấu hình động, đây là tham số vận hành nên lên `/settings`; tuy nhiên `revalidate` phải biết trước khi fetch, nên env làm sàn/trần là chấp nhận được — cần ghi rõ lý do trong docs.

## Xác nhận đạt (theo checklist)
- **404 vs empty-state**: slug/locale/code/matchNo sai → `notFound()` trước khi gọi API (`event-page.ts:10,18`, `matches/[matchNo]/page.tsx:22`); API `data:null` → 404; danh sách rỗng → `EmptyState`. Index tab không có nội dung → 404, có → redirect sub-event đầu tiên (`event-page.ts:24-33`).
- **Draw mặc định**: `drawKinds[0]` (thứ tự MAIN → QUALIFYING, `public-event-detail.query.ts:14,70`) khớp `availableKinds` (`public-bracket.serializer.ts:6,97`), nên khi chỉ có vòng loại được publish thì trang mở thẳng vòng loại, và pill đầu tiên trỏ về URL không tham số là đúng. `?draw` mảng/không hợp lệ → 404.
- **Phân trang giữ bộ lọc**: events (`events/page.tsx:41-47`), matches (`matches/page.tsx:45-50,94` giữ `state`+`sub`+`date`+`q`), players (`stageHref`). Đổi bộ lọc về trang 1 (không mang `page`).
- **Injection**: path chỉ ghép slug/code/matchNo đã qua `isUrlPart`/regex hoặc lấy từ API; `kind` kiểm `Object.hasOwn(PUBLIC_DRAW_KINDS, ...)`; query qua `URLSearchParams`. Proxy redirect giữ cùng origin (`//evil.com` thành `/vi//evil.com`).
- **dangerouslySetInnerHTML** (`info/page.tsx:28`): API sanitize lại khi đọc (`public-event-detail.query.ts:112-120`) bằng allowlist `sanitize-rich-html.ts` (chỉ `https`/`mailto`, không protocol-relative, `img` chỉ `https`, ép `rel=noopener noreferrer nofollow` cho `_blank`). An toàn. `ticketUrl` được validate `optionalHttpsUrlSchema` (`event-dtos.ts:51`).
- **Cache**: `cache()` bọc mọi loader, metadata + page dùng chung một lượt gọi; `none` → `no-store` chỉ khi có `q`; tag đúng theo `publicCacheTags`; ResultsStrip lỗi thì ẩn, không làm sập layout.
- **A11y**: skip link → `#content` có trên mọi `<main>`; `aria-current` cho tab/pill/trang; bảng có `caption` + `scope`; vùng cuộn ngang focus được; `:focus-visible` có style; form lọc là GET thuần, chạy được khi không có JS.

## Câu hỏi còn mở
1. Deploy có cấu hình `cacheHandler` riêng (Redis...) hay dùng file-system mặc định? Nếu dùng handler có giới hạn/eviction thì H1 giảm còn Medium (nhưng vẫn có cache miss tăng tải API).
2. Trên site tiếng Việt, khi chỉ có bản tiếng Anh thì muốn hiện bản tiếng Anh hay ẩn tab Info? (M2)
3. Endpoint public settings (cho `siteName`) được lên lịch ở phase nào? (M5)

**Status:** DONE_WITH_CONCERNS
**Summary:** tsc + eslint sạch, contract client↔API khớp, không thấy lỗ bảo mật; 1 High (cache key không giới hạn), 5 Medium (ngõ cụt danh sách vòng loại, tab Info 404, mặc định tab live, đổi ngôn ngữ mất query, siteName cứng).
**Score:** 8/10
