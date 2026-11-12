# Phase 08 — Site công khai: khung, i18n, trang giải, nhánh đấu, bảng đấu, trận, bản in

## Context Links

- [Site tham chiếu §2 IA, §3.2–3.6 trang giải/trận, §6 layout, §6.3 mobile, §7 điểm yếu cần tránh](../reports/researcher-261111-1450-worldtabletennis-site-feature-and-layout-analysis.md) + ảnh `../reports/wtt-screenshots/02, 03, 04, 05, 07, 09, 16, 17`
- [Brand §3, §7 token](../reports/researcher-261111-1450-midomax-kamito-brand-identity-analysis.md)
- [Phase 02 — Spike E (revalidate, `proxy.ts`, sitemap lúc chạy)](./phase-02-spikes-refine-antd-better-auth-dokploy-nextjs-revalidation.md)
- [Red team đã phân xử: nhóm 1, 5, 6, 10, 14, 15](./reports/red-team-261111-1614-adjudicated-findings.md)
- Phase trước: [phase-07](./phase-07-scheduling-sessions-tables-and-result-entry.md)

## Overview

<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Priority: P1. Status: pending. ≈9 ngày công (ước lại từ 6 ngày; gồm ui-consistency ≈0,5 ngày), làm 2 đợt:
  - **Lát cắt (tuần 6, ≈4 ngày):** khung client tối thiểu (layout, wordmark, tiếng Việt), API public nhánh đấu theo slug/mã + predicate phạm vi công khai + serializer whitelist, 1 trang nhánh đấu (CSS grid tự làm), route `/api/revalidate`, deploy staging + kiểm luồng lát cắt. → **Mốc M1 cuối tuần 6.**
  - **Phần còn lại (tuần 12–13, ≈5 ngày):** i18n vi/en đầy đủ, danh sách + lịch giải, trang giải đủ tab, trang trận, dải kết quả, metadata + sitemap sinh lúc chạy, stylesheet in (nhánh, lịch theo session/bàn), CSP report-only, rate limit công khai, e2e.
- Toàn bộ Server Components + `searchParams`, slug, metadata, làm mới theo tag. Chỉ học cấu trúc/bố cục; không dùng ảnh, chữ, logo, dữ liệu của site tham chiếu.

## Key Insights

- Tránh điểm yếu site tham chiếu: tải cả 1,7 MB danh sách giải rồi lọc ở client; 1 request/VĐV; không SSR/SEO; header mobile ~206 px.
- Tab là route con (không phải query) → mỗi tab có URL, metadata, cache tag riêng; tab tự ẩn khi không có dữ liệu (không có vòng bảng → không có tab Bảng đấu).
- Nhánh đấu mobile: khung cuộn ngang, cột vòng giữ kích thước (giống tham chiếu) — render HTML ở server, không cần JS để xem.
- i18n — **quyết định của plan**: tự làm gọn (2 file từ điển JSON + helper `t()`), không thêm thư viện; route `/vi/...`, `/en/...`; `/` chuyển hướng theo cookie → `Accept-Language` → mặc định `vi`. Dữ liệu: `xxxEn ?? xxx`.
<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- UI nhánh đấu tự làm bằng CSS grid (không thử thư viện): nhu cầu hiển thị đơn giản, cần SSR thuần + nhãn tùy ý + bản in.
<!-- Red Team: Revalidate Next.js chưa kiểm chứng — 2026-11-11 -->
- Tên file chuyển hướng locale (`middleware.ts` hay `proxy.ts`), API vô hiệu tag và cách làm `sitemap` sinh lúc chạy theo kết luận Spike E trên bản Next.js đã ghim. Build Docker không gọi được API → sitemap không được sinh lúc build.
<!-- Red Team: Tô-pô mạng, IP thật, rate limit, health — 2026-11-11 -->
- API chỉ thấy IP container → rate limit công khai đặt ở Traefik hoặc Next, không ở API.
<!-- Spike E results — 2026-11-12 -->
- Đã chốt: `revalidateTag(tag, { expire: 0 })` trong `app/api/revalidate/route.ts`; tên file chuyển hướng locale là `proxy.ts` (`middleware.*` còn chạy nhưng cảnh báo; có cả hai → build lỗi).
- Chặn `/api/revalidate` trên domain công khai bằng 3 lớp: rule Traefik theo path (chờ staging); kiểm `Host` nội bộ + secret; luật trong `proxy.ts`. Đã kiểm cục bộ: Host công khai → 404, sai secret → 403, giả `X-Forwarded-Host` → 404.
- Sitemap: `app/sitemap.ts` + `dynamic = 'force-dynamic'` (build Docker không gọi được API nên không sinh lúc build).
- Chưa kiểm: rule Traefik/`passHostHeader` thật; nhiều replica client.

<!-- Phase 03 sync — 2026-11-12 -->
- Phase 03 không cung cấp thành phần công khai. Phân trang công khai dùng tham số riêng (`pageSize` ≤ 24 ở `/public/events`), không dùng `list.defaultPageSize` (chỉ áp cho admin).

<!-- Phase 04 sync — 2026-11-12 -->
- Sanitizer đã có ở API: `apps/api/src/common/html/sanitize-rich-html.ts` (`sanitizeRichHtml`, `sanitizeRichHtmlOrNull`). `infoBody`/`infoBodyEn` đã sanitize khi lưu (`apps/api/src/modules/events/event-write-data.ts:14-15`). Chưa quyết: render công khai gọi lại sanitizer ở Next.js (cần chuyển lib sang `packages/shared`) hay API trả HTML đã sanitize. Chốt trước khi làm.
- Song ngữ: `infoBodyEn` đã có (`apps/api/src/modules/events/event-dtos.ts:58`). Quy ước public đọc `xxxEn ?? xxx` là của plan, chưa có code public.
- `home.featuredEventId` (AppSetting) chưa kiểm giải đã công bố (L9 chưa làm): public phải bỏ qua giải DRAFT, hoặc sửa ở phase này.
- Allowlist sanitizer cho phép `img`/`table` mà editor (`apps/admin/src/components/rich-text-field.tsx`) không tạo được (L7). Quyết định khi làm trang tin/tĩnh (phase 11).
- `cache-tags.ts` đợi phase 07.

## Requirements

Functional
- Danh sách giải: lọc nhóm giải, hạng giải, năm, trạng thái (sắp/đang/đã); tìm theo tên; phân trang số (link thật, SEO được). Lịch giải: nhóm theo tháng, lọc năm + nhóm giải.
- Trang giải: hero (banner, hạng giải + màu, ngày, địa điểm, link vé nếu bật), các tab:
  - Tổng quan: nhà vô địch từng nội dung (khi có), số VĐV, số trận đã đấu (không tính BYE), nội dung thi đấu, nhà tài trợ (phase 11 bổ sung).
  - Trận đấu: tab con Đang đấu / Đã xong / Sắp tới (trận BYE không hiện); lọc nội dung, ngày, tìm VĐV; phân trang server.
  - Nhánh đấu: chọn nội dung + vòng loại/nhánh chính (route con theo mã nội dung); BYE, (WC), (Q), hạt giống, tỷ số ván, giờ/bàn.
  - Bảng đấu: BXH mỗi bảng (#, VĐV/cặp, thắng–thua, điểm, Q) + danh sách trận bảng.
  - Danh sách VĐV: theo nội dung + vòng; hạt giống, CLB.
  - Thông tin: lịch dự kiến theo ngày/session/bàn, nội dung `infoBody` (đã sanitize, phase 04) (phase 10 thêm bảng điểm xếp hạng theo vòng).
- Trang trận: 2 bên, tỷ số ván lớn, bảng điểm ván, nội dung–vòng, bàn, giờ, trạng thái; link về nhánh.
- Dải kết quả trên header: kết quả mới/đang đấu của giải đang diễn ra; bật bằng AppSetting `header.resultsStrip.enabled`.
<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Bản in (stylesheet `@media print`): nhánh đấu (vừa khổ A4/A3 ngang, chia trang theo nửa nhánh khi lớn), lịch theo session/bàn.
<!-- Red Team: Audit, phạm vi công khai, VĐV nhỏ tuổi, song ngữ — 2026-11-11 -->
- Nhãn ô chờ (`side1Source`) render qua từ điển: "Thắng trận #12" / "Winner of match 12", "Q3", "Nhất bảng A" / "Group A winner". Tên cặp dẫn xuất lúc đọc từ 2 VĐV (`publicDisplayName ?? fullName`, bản en dùng `fullNameEn`).
- Rà mọi trường hiển thị công khai: có cột `En` hoặc được tuyên bố trung tính ngôn ngữ (mã, số, tên riêng) — ghi danh sách trong `pick-localized.ts`.

Non-functional
- Mobile 390 px: không tràn ngang trang; header (nav + dải kết quả) ≤ 112 px, dải kết quả thu gọn được; tab cuộn ngang.
- Mỗi trang ≤ 3 request API ở server (không N+1); payload danh sách ≤ 50 KB/trang.
- Trang không có dữ liệu en → hiện bản vi, không lỗi.

## Architecture

<!-- Red Team: Revalidate Next.js chưa kiểm chứng — 2026-11-11 -->
Route (`apps/client/src/app/[locale]/`)

| Route | Nguồn dữ liệu (API public) | Tag |
|---|---|---|
| `events/page.tsx` `?q&tier&type&year&status&page` | `GET /public/events` | `events` (có `q` → không cache) |
| `events/calendar/page.tsx` `?year&tier` | `GET /public/events/calendar` | `events` |
| `events/[slug]/page.tsx` (Tổng quan) | `GET /public/events/:slug` | `event-{slug}` |
| `events/[slug]/matches/page.tsx` `?state=live|completed|upcoming&sub&date&q&page` | `GET /public/events/:slug/matches` | `schedule-{slug}` |
| `events/[slug]/matches/[matchNo]/page.tsx` | `GET /public/events/:slug/matches/:matchNo` | `match-{slug}-{matchNo}` |
| `events/[slug]/draws/[subEventCode]/page.tsx` `?draw=main|qualifying` | `GET /public/events/:slug/draws/:subEventCode?kind=` | `draw-{slug}-{subEventCode}` |
| `events/[slug]/groups/[subEventCode]/page.tsx` | `GET /public/events/:slug/groups/:subEventCode` | `groups-{slug}-{subEventCode}` |
| `events/[slug]/players/[subEventCode]/page.tsx` `?stage&page` | `GET /public/events/:slug/entries/:subEventCode` | `event-{slug}` |
| `events/[slug]/info/page.tsx` | `GET /public/events/:slug/schedule` | `schedule-{slug}` |

- Tag chính xác, không wildcard; danh sách tag và mutation tương ứng nằm ở `cache-tags.ts` (phase 07). Tag dựng từ tham số URL nên khai báo được trước khi có response.
- Thời hạn cache: trang của giải đang diễn ra (theo ngày) dùng TTL ngắn đồng nhất `MATCHDAY_REVALIDATE_SECONDS`; còn lại `PUBLIC_REVALIDATE_SECONDS`. Trang có `q` (tìm kiếm) không cache.
- `generateMetadata` mọi trang: title, description, canonical, `alternates.languages` vi/en, Open Graph (banner giải).
- `sitemap` sinh **lúc chạy** (cách cấu hình theo Spike E), bản đầu gồm giải + trang giải; phase 10, 11, 12 bổ sung.
- Khung chung `components/layout/`: `site-header.tsx` (logo Kamito từ file brand chính thức khi có; tạm chữ "KAMITO" theo token), `results-strip.tsx` (server, `GET /public/results/strip?limit` — giới hạn từ AppSetting `header.resultsStrip.limit`), `main-nav.tsx` (mobile: nút menu mở panel; phần tương tác nhỏ là client component duy nhất), `site-footer.tsx`, `locale-switcher.tsx` (giữ nguyên đường dẫn khi đổi ngôn ngữ).
- `app/api/revalidate/route.ts`: kiểm `REVALIDATE_SECRET` (so khớp thời gian hằng) + tag theo mẫu cho phép + chặn khi không đến từ mạng nội bộ (theo Spike E).

<!-- Red Team: Audit, phạm vi công khai, VĐV nhỏ tuổi, song ngữ — 2026-11-11 -->
API public (`/api/v1/public/*`, chỉ đọc, `@Public()`, serializer whitelist)

| Path | Tham số / ghi chú |
|---|---|
| `GET /public/events` | `q (≤ 100 ký tự), tierCode, eventTypeCode, year, status, page, pageSize ≤ 24, sort=startDate:desc`; trả thẻ gọn |
| `GET /public/events/calendar` | `year, tierCode` → nhóm theo tháng |
| `GET /public/events/:slug` | giải + nội dung + tab khả dụng + nhà vô địch + số trận đã đấu |
| `GET /public/events/:slug/matches` | `state, subEventCode, date, q, page` — 1 query join entries/competitors/games; loại trận BYE |
| `GET /public/events/:slug/matches/:matchNo` | chi tiết trận (không trả trận BYE) |
| `GET /public/events/:slug/draws/:subEventCode` | `kind` → rounds → matches → 2 bên (tên hiển thị, CLB, seed, nhãn WC/Q/BYE, nguồn ô chờ dạng cấu trúc) → ván |
| `GET /public/events/:slug/groups/:subEventCode` | bảng + BXH + trận |
| `GET /public/events/:slug/entries/:subEventCode` | `stage, page` — không trả SĐT/email/ngày sinh |
| `GET /public/events/:slug/schedule` | session → bàn → trận |
| `GET /public/results/strip` | trận `LIVE` + `OFFICIAL` gần nhất (không BYE) của giải đang diễn ra |

- **Một predicate phạm vi công khai dùng chung** (`public-scope.ts`): giải `PUBLISHED` và không hủy; draw `PUBLISHED`; entry `CONFIRMED`; trận thuộc draw đã công bố. Mọi query public đi qua predicate; test cho **từng endpoint** (giải nháp, giải hủy, draw nháp, entry rút → 404/không xuất hiện).
- Tra cứu theo slug/mã dưới giải, không nhận id thô từ URL công khai.
- Test whitelist: snapshot **toàn bộ tên trường** serialize của mỗi endpoint; thêm trường mới phải sửa snapshot có chủ ý.
<!-- Red Team: Sửa draw sau công bố — 2026-11-11 -->
- Predicate "trận đã đấu thật" (`match-predicates.ts`, phase 06) cho mọi số liệu/danh sách.
- API public chỉ nhận request mang `SSR_INTERNAL_SECRET` (client gọi qua `API_INTERNAL_URL`); không rate limit ở API.

<!-- Red Team: Tô-pô mạng, IP thật, rate limit, health — 2026-11-11 -->
<!-- Red Team: Kiểm soát bảo mật sớm — 2026-11-11 -->
Biên công khai
- Rate limit theo IP thật ở Traefik (middleware rate limit qua label Dokploy, nếu được) hoặc ở `proxy.ts`/`middleware.ts` của Next (bộ đếm trong bộ nhớ, đủ cho 1 instance). Chặt hơn cho trang có `q`.
- CSP dạng **report-only** từ phase này (header `Content-Security-Policy-Report-Only`, gửi báo cáo về route nội bộ ghi log có giới hạn); enforce ở phase 12.

UI nhánh đấu
- Component tự viết: CSS grid mỗi cột một vòng, đường nối bằng pseudo-element, `components/bracket/{bracket-board.tsx,bracket-round-column.tsx,bracket-match-cell.tsx}`; stylesheet in riêng `bracket-print.css`.
- Ô trận: 2 dòng (tên, CLB, seed trong ngoặc, số ván thắng), nhãn `LIVE` màu `color.live` trên nền `color.data`, giờ + bàn khi chưa đấu, link trang trận.

## Related Code Files

Create
- `apps/client/src/i18n/{vi.json,en.json,get-dictionary.ts,locale-config.ts,pick-localized.ts,render-side-source.ts}`, `apps/client/src/proxy.ts` hoặc `middleware.ts` (theo Spike E: chuyển hướng locale + rate limit)
- `apps/client/src/lib/{api-client.ts,public-cache-tags.ts,cache-policy.ts,format-date-time.ts}`
- `apps/client/src/app/api/{revalidate/route.ts,csp-report/route.ts}`, `apps/client/src/app/sitemap.ts`
- `apps/client/src/components/layout/{site-header.tsx,results-strip.tsx,main-nav.tsx,mobile-menu-toggle.tsx,site-footer.tsx,locale-switcher.tsx}`
- `apps/client/src/components/events/{event-card.tsx,event-filters.tsx,event-hero.tsx,event-tabs.tsx,calendar-month-group.tsx}`, `apps/client/src/components/matches/{match-card.tsx,match-score-table.tsx,match-filters.tsx}`, `apps/client/src/components/bracket/*`, `apps/client/src/components/groups/group-standings-table.tsx`, `apps/client/src/components/schedule/session-table-schedule.tsx`, `apps/client/src/components/common/{pagination-links.tsx,empty-state.tsx,tab-scroller.tsx}`, `apps/client/src/styles/{bracket-print.css,schedule-print.css}`
- Route files như bảng trên + `apps/client/src/app/[locale]/events/[slug]/layout.tsx` (hero + tab dùng chung), `not-found.tsx`
- `apps/api/src/modules/public-scope/{public-scope.module.ts,public-scope.ts}`, `apps/api/src/modules/public-events/{public-events.module.ts,public-events.controller.ts,public-events.query.ts,public-event.serializer.ts}`, `apps/api/src/modules/public-competition/{public-competition.controller.ts,public-bracket.query.ts,public-matches.query.ts,public-entry.serializer.ts}`, `apps/api/src/common/guards/ssr-internal.guard.ts`
- Test: `apps/api/test/{public-events.e2e-spec.ts,public-scope.e2e-spec.ts,public-serializer-fields.e2e-spec.ts}`, `apps/client/tests/e2e/{vertical-slice.spec.ts,event-pages.spec.ts}` (Playwright)

Modify: `apps/client/src/app/[locale]/layout.tsx`, `apps/client/src/app/[locale]/page.tsx` (trang chủ tạm: giải nổi bật + giải sắp tới; phase 11 hoàn thiện), `apps/client/next.config.*` (CSP report-only).

## Implementation Steps

Lát cắt (tuần 6)
1. Khung client tối thiểu (layout, wordmark, `vi.json` khung), `api-client.ts` + `cache-policy.ts`.
2. `public-scope.ts` + API nhánh đấu theo slug/mã + serializer whitelist + test phạm vi công khai cho endpoint này.
3. Trang nhánh đấu (CSS grid) + route `/api/revalidate` theo Spike E.
4. Deploy + migrate staging theo quy trình phase 01; Playwright `vertical-slice.spec.ts`: đăng nhập admin → tạo giải + 1 nội dung loại trực tiếp → thêm entry tay → bốc thăm → công bố → chốt 1 trận → trang nhánh công khai đổi. **Mốc M1.**

Phần còn lại (tuần 12–13)
5. `ui-consistency:finding-patterns` → `ui-consistency:planning` cho **site công khai** (lần đầu đầy đủ): chốt mẫu thẻ giải, thẻ trận, bảng số liệu nền navy, tab cuộn ngang, thanh lọc dạng form GET, phân trang, empty state, hero, bản in; theo token phase 01.
6. i18n đầy đủ: từ điển vi/en, chuyển hướng locale, `pickLocalized`, render nguồn ô chờ, locale switcher; rà trường công khai thiếu `En`.
7. API public còn lại + serializer whitelist + test phạm vi từng endpoint + test snapshot trường; kiểm số query (log Prisma) không N+1.
8. Khung layout + dải kết quả (đọc cờ AppSetting); danh sách + lịch giải (form GET, không JS lọc; `q` giới hạn độ dài, không cache).
9. Layout trang giải + 6 tab + trang trận; bảng đấu.
10. Stylesheet in nhánh + lịch theo session/bàn.
11. Metadata, canonical, hreflang, OG; sitemap sinh lúc chạy (giải + trang giải).
12. Rate limit công khai (Traefik hoặc Next) + CSP report-only.
13. Playwright e2e: lọc giải, mở trang giải, xem nhánh ở 390 px (không tràn ngang trang), chốt 1 trận ở admin → trang trận đổi trong thời hạn đã chốt, in nhánh (snapshot PDF).
14. `ui-consistency:verifying` (desktop 1440 + mobile 390); deploy staging. **Mốc M2 cuối tuần 13** (lõi giải đấu đủ trên staging).

## Todo List

- [ ] (Lát cắt) Khung client + api-client + cache-policy
- [ ] (Lát cắt) public-scope + API nhánh theo slug + serializer + test
- [ ] (Lát cắt) Trang nhánh CSS grid + route revalidate
- [ ] (Lát cắt) Deploy staging + Playwright lát cắt → M1
- [ ] ui-consistency: finding-patterns → planning (site công khai)
- [ ] i18n vi/en + chuyển hướng locale + fallback vi + nhãn ô chờ qua từ điển
- [ ] API public events/matches/draws/groups/entries/schedule/strip + test phạm vi từng endpoint + snapshot trường
- [ ] Khung header/dải kết quả/nav/footer
- [ ] Danh sách giải + lịch giải
- [ ] Trang giải 6 tab + trang trận
- [ ] Bản in nhánh + lịch theo session/bàn
- [ ] Metadata/canonical/hreflang/OG + sitemap lúc chạy
- [ ] Rate limit công khai + CSP report-only
- [ ] Playwright e2e
- [ ] ui-consistency: verifying → M2

## Success Criteria

- M1 (cuối tuần 6): `vertical-slice.spec.ts` xanh trên staging.
- Mọi trang trên render HTML đủ nội dung khi tắt JS (kiểm `curl`).
- Lọc/phân trang thay đổi URL, kết quả từ server; không request API nào từ trình duyệt cho danh sách.
- 390 px: `document.documentElement.scrollWidth == 390`; header ≤ 112 px; nhánh 64 cuộn ngang trong khung.
- Bản in nhánh 64 ra A4/A3 ngang đọc được, không cắt chữ; lịch in theo session/bàn.
- Đổi cờ `header.resultsStrip.enabled` trên admin → dải kết quả hiện/ẩn sau revalidate `settings`.
- Trang `/en/...` của giải không có `nameEn` hiển thị tên tiếng Việt, không lỗi; nhãn ô chờ hiện tiếng Anh.
- Test phạm vi công khai: giải nháp/hủy, draw nháp, entry rút không xuất hiện ở bất kỳ endpoint public nào; test snapshot trường xanh.
- `https://<client>/api/revalidate` từ internet → bị chặn; vượt ngưỡng rate limit → 429 ở biên (Traefik/Next).
- Lighthouse mobile (trang giải): Performance ≥ 85, SEO ≥ 95 (đo ở staging).

## Risk Assessment

| Rủi ro | Khả năng × Tác động | Xử lý |
|---|---|---|
| API cache Next.js khác giả định | Trung bình × Trung bình | Spike E đã chốt; gói trong `api-client.ts` + `cache-policy.ts` để đổi một chỗ |
| Nhánh 128 nặng DOM trên mobile | Thấp × Trung bình | Chỉ render 1 draw/trang; vòng loại tách route |
| Lát cắt không kịp M1 | Trung bình × Cao | Lát cắt chỉ 1 nội dung loại trực tiếp; dùng dự phòng tuần 9/13, không đẩy lùi pilot |
| Rate limit trong bộ nhớ Next không đủ khi nhiều instance | Thấp × Thấp | Bản đầu 1 instance; ưu tiên Traefik |
| Logo chính thức chưa có | Cao × Thấp | Wordmark chữ theo token, thay file khi có |

Rollback: chỉ thêm route/module; revert client/api về phase 07; dữ liệu không đổi.

## Security Considerations

- API public: chỉ GET, chỉ dữ liệu qua predicate phạm vi công khai; serializer whitelist (test bắt buộc); chỉ nhận request SSR nội bộ.
- HTML thô từ DB chỉ có `infoBody` đã sanitize khi lưu và khi render (sanitizer phase 04).
- CSP report-only từ phase này; header bảo mật đầy đủ + enforce ở phase 12.

## Next Steps

- Sau M1: phase 04 (phần còn lại) → 05 → pilot BTC (tuần 9). Phase 10 thêm bảng điểm theo vòng vào tab Thông tin, link VĐV → hồ sơ; phase 11 thêm nhà tài trợ, tin/video liên quan.
