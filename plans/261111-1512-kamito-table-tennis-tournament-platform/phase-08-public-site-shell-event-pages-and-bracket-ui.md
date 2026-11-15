# Phase 08 — Site công khai: khung, i18n, trang giải, nhánh đấu, bảng đấu, trận, bản in

## Context Links

- [Site tham chiếu §2 IA, §3.2–3.6 trang giải/trận, §6 layout, §6.3 mobile, §7 điểm yếu cần tránh](../reports/researcher-261111-1450-worldtabletennis-site-feature-and-layout-analysis.md) + ảnh `../reports/wtt-screenshots/02, 03, 04, 05, 07, 09, 16, 17`
- [Brand §3, §7 token](../reports/researcher-261111-1450-midomax-kamito-brand-identity-analysis.md)
- [Phase 02 — Spike E (revalidate, `proxy.ts`, sitemap lúc chạy)](./phase-02-spikes-refine-antd-better-auth-dokploy-nextjs-revalidation.md)
- [Red team đã phân xử: nhóm 1, 5, 6, 10, 14, 15](./reports/red-team-261111-1614-adjudicated-findings.md)
- Phase trước: [phase-07](./phase-07-scheduling-sessions-tables-and-result-entry.md)

## Overview

<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Priority: P1. Status: in progress (lát cắt bước 1–3 xong 2026-11-13; đợt 1–3 xong 2026-11-14; lịch session/bàn + bản in lịch triển khai 2026-11-15; kiểm local đạt; còn bước 4 + M1/M2 staging; chưa deploy staging). ≈9 ngày công (ước lại từ 6 ngày; gồm ui-consistency ≈0,5 ngày), làm 2 đợt:
  - **Lát cắt (tuần 6, ≈4 ngày):** khung client tối thiểu (layout, wordmark, tiếng Việt), API public nhánh đấu theo slug/mã + predicate phạm vi công khai + serializer whitelist, 1 trang nhánh đấu (CSS grid tự làm), route `/api/revalidate`, deploy staging + kiểm luồng lát cắt. → **Mốc M1 cuối tuần 6.**
  - **Phần còn lại (tuần 12–13, ≈5 ngày):** i18n vi/en đầy đủ, danh sách + lịch giải, trang giải đủ tab, trang trận, dải kết quả, metadata + sitemap sinh lúc chạy, stylesheet in (nhánh, lịch theo session/bàn), CSP report-only, rate limit công khai, e2e.
- Toàn bộ Server Components + `searchParams`, slug, metadata, làm mới theo tag. Chỉ học cấu trúc/bố cục; không dùng ảnh, chữ, logo, dữ liệu của site tham chiếu.

## Key Insights

**Nguồn hiện tại sau hoàn tất nợ code (2026-11-15):** `plans/reports/tester-261115-phase08-remaining-debts.md` cùng các báo cáo timezone, tên công khai và runtime dùng chung. Bản debt audit và các khối sync lát cắt/đợt 1–3 bên dưới là lịch sử tại thời điểm ghi. Nợ code timezone/DST, tìm/sort tên công khai, ngày dài, cache/rate nhiều replica đã xử lý và kiểm local. Còn staging/M1/M2 và xác nhận header/hạ tầng thật; không tự coi kiểm local là deploy staging.

Kiểm chứng cuối đợt rà: unit client 20/20; Playwright toàn bộ 45 đạt/7 bỏ qua theo viewport/0 lỗi, typecheck/lint src/tests đạt; HTTP rate limit thật đạt. Báo cáo `plans/reports/tester-261115-phase08-review-debts.md`. Kết quả này thay cho giới hạn chưa chạy lại full suite trong báo cáo lịch trước đó, không thay thế staging.

Lượt hoàn tất sau đó: client unit 41/41, full Playwright 51 đạt/7 bỏ qua; 6 ca ngày/trạng thái chạy lại trên Next production với JavaScript bật đạt; build/typecheck/lint đạt. Migration `20261115032757_add_player_public_name_key` đã áp dụng DB dev local (16/16), staging chưa. Hai Next production local kiểm cache/tag và rate chung đạt, API settings không còn RAM riêng. Chưa đóng M1/M2.

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
- `cache-tags.ts` đã có từ lát cắt phase 07 (2026-11-13); phase này bổ sung tag public và route `/api/revalidate` phía client.

<!-- Phase 06 sync — 2026-11-13 -->
- Predicate dùng chung đã có: `packages/shared/src/match-predicates.ts` (`isRealMatch`, `isPlayedMatch`), có test. Mọi số liệu và danh sách công khai dùng hai hàm này.
- Nhánh công khai chỉ đọc draw `PUBLISHED`. Phase 06 chưa có route công khai nào, nên DRAFT không lộ ra (review phase 06 xác nhận: `plans/reports/code-reviewer-261113-phase-06-draws.md`).
- Mã vòng (`Round.code`, gồm `QF-n` cho vòng loại) và nhãn ô chờ có cấu trúc (`{type: WINNER_OF | QUALIFIER | GROUP_PLACE, ...}`) đã lưu sẵn; render qua từ điển vi/en.

<!-- Phase 08 slice sync — 2026-11-13 -->
- Đã làm (lát cắt bước 1–3): khung client (wordmark, footer, skip link, `error.tsx`, `not-found`), `lib/{api-client,cache-policy,server-env,format-date-time}.ts`, `vi.json`/`en.json` (nhãn nhánh + ô chờ), `get-dictionary.ts`, `pick-localized.ts`, `render-bracket-labels.ts`; API `GET /public/events/:slug/draws/:subEventCode?kind=main|qualifying` (2 query) + `public-scope.ts` + serializer whitelist + test snapshot trường; trang nhánh CSS grid; `app/api/revalidate/route.ts`; `proxy.ts`.
- Quyết định:
  - API public trả `200 {data: null}` thay vì 404 khi giải/draw không có hoặc chưa công bố. Lý do: Next chỉ cache response 200 (chủ repo xác nhận 2026-11-13). Test phạm vi kiểm `data: null`, không kiểm 404.
  - Phạm vi bản lát cắt: giải `PUBLISHED` và không hủy; draw `PUBLISHED`. Chưa lọc entry: VĐV rút vẫn hiện trong nhánh như lịch sử walkover.
  - Tên site lấy từ AppSetting `site.name`; hiện dùng giá trị mặc định của registry tới khi có API settings công khai.
  - Bỏ công bố / thay VĐV / rút VĐV trên draw đã công bố gửi tag `draw.unpublish`, `draw.postPublishEdit` (`cache-tags.ts`).
  - Route `/api/revalidate`: `revalidateTag(tag, {expire: 0})`; chặn 3 lớp (Host nội bộ, secret, `proxy.ts`); số tag tối đa `REVALIDATE_MAX_TAGS`.
  - Header nội bộ đổi sang `x-internal-secret`; log redaction dùng hằng `SSR_SECRET_HEADER` (smoke phát hiện log in nguyên secret, đã sửa).
  - Hằng dùng chung trong `@kamito/shared`: `API_GLOBAL_PREFIX`, `PUBLIC_API_SEGMENT`, `SSR_SECRET_HEADER`, `REVALIDATE_SECRET_HEADER`, `REVALIDATE_MAX_TAGS`. API không đọc `API_BASE_PATH` (chỉ admin dùng).
  - Env mới: `REVALIDATE_ALLOWED_HOSTS` (phải khớp host của `CLIENT_INTERNAL_URL`), `API_FETCH_TIMEOUT_MS`.
  - Lệch file list: chưa có `public-scope.module.ts` và module `public-events` (YAGNI, chưa cần). `modules/public-competition/` gồm `public-bracket.query.ts`, `public-bracket.serializer.ts`, `public-competition.module.ts`.
- Kiểm chứng: shared 86/86; API 47 file 330/330 (exit 0); worker 34/34; client typecheck/lint/build sạch; `public-bracket.e2e-spec.ts` 8/8; smoke local (nhánh MS, URL sai → 404, revalidate theo host/secret, cache, 390 px `scrollWidth` 375). Ảnh: `plans/reports/screenshots-261113-phase-08-slice/`. Chưa có Playwright.
- Review (code-reviewer 7/10): đã sửa H1, M1–M4, L1–L7, L9, L10. Còn L8 (màu xám fix cứng trong `bracket.module.css`), làm cùng `ui-consistency` phần còn lại. Báo cáo: `plans/reports/code-review-and-test-261113-phase-08-slice.md`.
- Câu hỏi chưa giải quyết:
  1. Bỏ công bố / hủy giải chưa gửi tag; chờ phase 07 (tag `events`, `event-{slug}`). Tạm dựa vào `200 {data: null}` + TTL.
  2. `group-qualifier.service` sửa draw MAIN đã công bố: chưa kiểm có gửi tag không.
  3. Nhiều replica client: cache theo instance, cần cache handler dùng chung trước khi scale.
  4. `API_FETCH_TIMEOUT_MS` là tham số vận hành đang để env; theo quy tắc `/settings` phải chuyển sang setting hoặc nêu lý do. Chủ repo quyết.
  5. Rule Traefik theo path và `passHostHeader` chưa kiểm trên staging.
  6. Cách render `infoBody` công khai (sanitize lại ở Next hay API trả HTML đã sanitize) vẫn chưa chốt (phase 04).
  7. Bước 4 (Playwright + staging, M1) chưa làm.

<!-- ui-consistency finding-patterns + planning — 2026-11-14 -->
## Mẫu giao diện site công khai (ui-consistency, đọc 2026-11-14)

Phạm vi lịch sử đã chốt 2026-11-14: làm phần không bị chặn; tab Thông tin chỉ có `infoBody` (API sanitize lại khi trả); tại thời điểm đó lịch theo session/bàn + bản in lịch chờ phần còn lại phase 07; bước 4/M1 chờ staging. Chạy 3 đợt: (1) i18n + API public + test; (2) khung + danh sách/lịch giải + trang giải/tab + trang trận; (3) in nhánh, SEO/sitemap, rate limit + CSP, Playwright. Cập nhật 2026-11-15: lịch theo session/bàn và bản in lịch đã triển khai, xem sync bên dưới.

Trang công khai so với "trang nội dung site công khai" — tham chiếu `apps/client/src/app/[locale]/events/[slug]/draws/[subEventCode]/page.tsx`, 1 thành viên / 4 ứng viên (`page.tsx` trang chủ tạm, `not-found`, `error` bị loại: không có nội dung dữ liệu). Họ chỉ có tham chiếu → chưa có quy ước nào; mọi dòng dưới đây là quyết định từ tham chiếu (level 3) hoặc từ plan (level 1), không phải đếm.

Theme: `packages/ui-tokens/src/tokens.ts` → biến CSS `--color-*`, `--radius-*`, `--space-section-*`, `--layout-*`. Không có `DESIGN.md`, không có thang cỡ chữ/khoảng cách trong theme. Đã chốt thêm 3 token: `textMuted #404040`, `textSubtle #737373` (brand §7), `lineStrong #A3A3A3` — thay mọi `#525252`/`#737373`/`#a3a3a3` viết tay (sửa luôn L8).

Checklist dùng chung cho mọi trang mới:
- [ ] Khung trang — `<main id="content" className="container">` như tham chiếu; header/footer từ `[locale]/layout.tsx`, không trang nào tự vẽ.
- [ ] Đầu trang giải — eyebrow (tên giải, 14/600, `--color-text-muted`) + `h1` (24 → 32 từ 768px, 800) như tham chiếu; trên trang giải phần này chuyển vào `events/[slug]/layout.tsx` (hero + tab), các tab không tự viết lại.
- [ ] Bậc heading — `h1` một lần/trang; khối trong trang dùng `h2` (16/700 như `.sectionTitle`), tiêu đề cột/thẻ `h3`.
- [ ] Nav dạng viên (tab, chọn nội dung, chọn vòng, trạng thái trận) — `<nav aria-label>` + `<Link aria-current="page">`, kiểu `.kind` của tham chiếu (viên bo `--radius-pill`, chọn = nền `--color-data` chữ `--color-surface`), cuộn ngang trong khung; tách thành `components/common/pill-nav` (plan đã nêu `tab-scroller.tsx`).
- [ ] Bảng số liệu (BXH, bảng điểm ván) — `<table>` thật, hàng đầu nền `--color-data` chữ `--color-surface` như `.roundTitle`; số `tabular-nums`; khung cuộn ngang riêng (`overflow-x:auto`, `tabIndex=0`, `role=region`) như `.scroller`.
- [ ] Ô/thẻ — viền 1px `--color-border`, bo `--radius-button` (ô trận) / `--radius-card` (thẻ giải), nền `--color-surface`.
- [ ] Nhãn LIVE — nền `--color-data`, chữ `--color-live`, bo `--radius-pill` (`.live`), không đặt `--color-live` trên nền sáng.
- [ ] Chữ phụ (giờ, CLB, ghi chú) — `--color-text-muted` / `--color-text-subtle`; không literal xám.
- [ ] Lọc — `<form method="get">` thật, nút submit, không JS; phân trang = link thật (`?page=`).
- [ ] Rỗng — `<p>` câu từ từ điển (như `t.bracket.empty`); không dữ liệu/không công bố → `notFound()`.
- [ ] Chữ hiển thị qua `getDictionary` + `pickLocalized`; giờ qua `format-date-time.ts` theo `event.timezone`.
- [ ] Không chép từ tham chiếu: chữ tiêu đề, `--cell-w/--cell-h` của nhánh, gợi ý cuộn `.hint`, `#525252` viết tay.

Task trang (đợt 2–3; mỗi task: đọc lại checklist trước khi viết → báo xong cho người điều phối gửi agent `ui-consistency:verifying` không phải người viết → báo `done` hoặc `parked — <lý do>`):

| # | Trang / mảnh | Trạng thái |
|---|---|---|
| 0 | Hiệu chỉnh verifying trên bản nháp tham chiếu (ngoài repo) | done |
| 1 | Token theme + `pill-nav` dùng chung + thay xám viết tay | done |
| 2 | Header (nav, locale switcher, menu mobile) + dải kết quả | done |
| 3 | Danh sách giải + lịch giải | done |
| 4 | Khung trang giải (`EventShell`: hero + tab) + Tổng quan | done |
| 5 | Tab Trận đấu + trang trận | done |
| 6 | Tab Nhánh (đưa trang nhánh vào khung giải) | done |
| 7 | Tab Bảng đấu + Danh sách VĐV + Thông tin (`infoBody`) + trang chủ | done |
| 8 | Bản in nhánh | done |
| Bổ sung 2026-11-15 | Lịch theo session/bàn + bản in lịch | Đã triển khai trên dữ liệu phase 07; kiểm chứng bổ sung xem sync cuối phần Todo |

<!-- Phase 08 batch 1 sync — 2026-11-14 -->
## Đợt 1 (2026-11-14): API public + i18n nền — xong

- API: module `public-events` (`events`, `events/calendar`, `events/:slug`, `events/:slug/info`) + `public-competition` thêm `matches`, `matches/:matchNo`, `groups/:subEventCode`, `entries/:subEventCode`, `results/strip`. Mọi query qua `publicScope` (thêm `entry`, `match`, `matchIn`); tham số URL sai → bỏ qua (`public-query-params.ts`).
- Quyết định: trận hủy kết quả (`isVoided`) hiện kèm cờ `voided` ở tab trận/bảng đấu, không vào dải kết quả; tìm VĐV có `publicDisplayName` chỉ theo tên hiển thị; `infoBody` sanitize lại ở API; slug `calendar` bị chặn (`RESERVED_SLUGS`); lọc "sắp diễn ra" xếp gần nhất trước.
- Setting mới: `header.resultsStrip.limit` (10), `public.listPageSize` (24). Đổi setting → tag `settings`. Theme thêm `lineStrong`, `textMuted`, `textSubtle`.
- Client: `proxy.ts` chuyển hướng locale (cookie `locale` → `Accept-Language` → `vi`), bỏ redirect `/` trong `next.config.ts`.
- Kiểm chứng: e2e mới `public-events`, `public-matches`, `public-groups-entries`, `public-results-strip` + `public-bracket` + `permission-coverage` 44/44; toàn API 66 file 429/429; shared 90/90; worker 34/34; client typecheck/lint/build sạch. DB test: stack docker `kamito-tt-dev` trong WSL2 (`localhost:5433/kamito_tt_dev`).
- Review: `plans/reports/code-reviewer-261114-phase-08-batch-1-public-api.md` (8/10). Còn mở: rate limit trang có `q` (đợt 3); trang danh sách cần gắn thêm tag `settings` (đợt 2); lọc trạng thái theo múi giờ mặc định còn nhãn theo múi giờ giải (lệch quanh nửa đêm, chấp nhận).

## Đợt 2 (2026-11-14): khung site + trang giải — xong

- Trang: trang chủ (đang/sắp diễn ra), danh sách giải, lịch giải, trang giải 6 tab (Tổng quan, Trận đấu, Nhánh, Bảng đấu, VĐV, Thông tin), trang trận; header (nav, chọn ngôn ngữ, menu `<details>`), dải kết quả.
- Lệch plan: `events/[slug]/layout.tsx` thay bằng component `EventShell` (layout không biết tab đang mở nếu không có JS client). Trang trận đứng ngoài `EventShell` (1 lần gọi API) — chờ chủ repo xác nhận.
- Mảnh dùng chung mới: `common/{pill-nav,filter-form,pagination-links,empty-state,scroll-region}`, `events/{sub-event-chooser,tier-badge,event-shell,event-hero}`, `groups/group-standings`, `players/entry-table`, `lib/public-query.ts`.
- Cache: giá trị query chỉ tới fetch có cache khi hợp lệ (`toQuery` + luật từng khóa; mã hạng/nhóm/năm lấy từ danh sách không lọc) — chặn bot tạo vô hạn mục cache.
- Hành vi mặc định: tab Trận của giải đang diễn ra mở "đang đấu", rỗng thì mở "đã xong"; nội dung chỉ có vòng loại mở thẳng vòng loại (nhánh + VĐV); tab Thông tin thiếu bản ngôn ngữ thì hiện bản còn lại; đổi ngôn ngữ giữ query.
- Kiểm chứng: client typecheck/lint/build sạch; chạy thử local `/vi`, `/vi/events`, `/en/events/calendar` (kể cả tham số bậy) trả 200. Chưa render trang giải có dữ liệu (DB dev chưa có giải công bố) → Playwright đợt 3.
- Review: `plans/reports/code-reviewer-261114-phase-08-batch-2-public-pages.md` (8/10), `plans/reports/ui-verifier-261114-phase-08-batch-2.md` (2 vòng).
- Còn mở: tên site + chữ wordmark đang lấy mặc định cứng (cần endpoint public settings); API chưa revalidate khi sửa event/entry/sub-event (tag `events` chưa phát); tương phản nút Mua vé ~4.4:1; tab Trận chọn nội dung bằng `<select>` khác các tab khác (viên); chưa có component chung cho nhãn LIVE/ô trận; nav chính chưa có `aria-current`.

## Đợt 3 (2026-11-14): in, SEO, rate limit, CSP, Playwright — xong

- In:
  - `@media print` chung: ẩn header/nav/form/footer; giữ màu nền (`print-color-adjust`).
  - Nhánh in ngang (`@page bracket`); cột 150px vừa 6 vòng A4; mỗi phần nhánh sang tờ mới; hero in nền trắng.
  - Chưa làm: chia nửa nhánh khi lớn (nhánh 128 = 8 vòng tràn A4; vừa A3 hoặc co theo trình duyệt).
- SEO:
  - `lib/page-metadata.ts`: canonical, hreflang vi/en/x-default, OG kèm banner giải.
  - Query nằm trong canonical chỉ khi chọn nội dung (`?draw=qualifying`, `?stage=`, `?year=`).
  - `metadataBase` lấy từ `PUBLIC_SITE_URL`.
  - `app/sitemap.ts` (force-dynamic, gọi API `GET /public/sitemap`) + `app/robots.ts`.
- Tên site: lấy từ AppSetting `site.name` qua `GET /public/site` (`lib/site-name.ts`). Wordmark "KAMITO" chờ file logo.
- Rate limit:
  - `proxy.ts` + `lib/public-rate-limit.ts`: cửa sổ cố định theo IP, bộ đếm trong bộ nhớ (1 instance).
  - IPv6 gom theo /64; bỏ qua request prefetch (matcher `missing`); 429 + `Retry-After` + `no-store`.
  - IP lấy từ `X-Real-Ip`; không có thì mục cuối `X-Forwarded-For`.
  - Ngưỡng là AppSetting nhóm mới `publicAccess` trên `/settings`: `public.rateLimit.windowSeconds` (60), `maxRequests` (600), `searchMaxRequests` (60), `maxTrackedIps` (100000).
  - Đọc qua `/public/site`, giữ một TTL matchday, làm mới nền; lỗi API thì cho qua.
- CSP report-only: header trong `next.config.ts`; `app/api/csp-report/route.ts` đọc tối đa 8 KB, log tối đa 30 dòng/phút (hằng cố định; lý do: chốt tạm tới phase 12 enforce).
- UI: nút Mua vé 20px/700 (chữ lớn) để đạt 3:1 trên `--color-primary`.
- Đã chốt 2026-11-14: trang trận đứng ngoài `EventShell`; tab Trận chọn nội dung bằng ô thả xuống; nút vé tăng cỡ chữ.
- Kiểm chứng:
  - API: `public-site.e2e-spec.ts` 8 test; toàn API 67 file 436/436 (trước khi thêm `maxTrackedIps`); sau đó chạy lại public-site/public-events/permission-coverage 20/20.
  - Shared 90/90.
  - Playwright (`@playwright/test` 1.64.1, chromium) `apps/client/tests/e2e/`: 34 passed + 4 skipped có chủ đích; desktop 1280 + mobile 390; dữ liệu dựng bằng `setupPublicWorld` qua `apps/api/test/playwright/*` (`vitest.playwright.config.ts`), dọn sạch sau chạy.
  - Ảnh in: `plans/reports/screenshots-261114-phase-08-batch-3/`.
- Review: `plans/reports/code-reviewer-261114-phase-08-batch-3.md` (7.5/10). Đã sửa: H1 prefetch, H2 giới hạn bộ nhớ + IPv6 /64, M1 làm mới nền, M3 đọc body có giới hạn, M4 canonical lịch, sitemap x-default, 429 no-store, tách `public-site-contract.ts`.
- UI: `plans/reports/ui-verifier-261114-phase-08-batch-2.md` mục "Toàn bộ (đợt 3)". Đã sửa: in (lề hero, cỡ chữ ô, tiêu đề ghi rõ vòng/trạng thái khi in, chỉ nhánh in ngang), focus skip link.
- Còn mở:
  - Rate limit chưa có e2e.
  - Kiểm Traefik `forwardedHeaders`/CDN trên staging.
  - API chưa phát tag `events`/`event-{slug}` khi sửa giải/entry/sub-event (chờ phase 07).
  - `.env` cục bộ thiếu `API_FETCH_TIMEOUT_MS`, `REVALIDATE_ALLOWED_HOSTS`.
  - Test mặc định của `/public/site` rớt nếu DB dev có ghi đè `/settings`.
  - `pnpm-lock.yaml` lẫn thay đổi ranking của phiên khác: tách khi commit.
  - Nav chính chưa `aria-current`; chưa có component chung cho nhãn LIVE/ô trận.

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
| `events/[slug]/info/page.tsx` `?session&table` | `GET /public/events/:slug/info` + `GET /public/events/:slug/schedule` | `event-{slug}` + `schedule-{slug}` |

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
| `GET /public/events/:slug/schedule` | `session`, `table` (mã công khai); session → bàn → trận; filters chỉ có ô công khai |
| `GET /public/results/strip` | trận `LIVE` + `OFFICIAL` gần nhất (không BYE) của giải đang diễn ra |

- **Một predicate phạm vi công khai dùng chung** (`public-scope.ts`): giải `PUBLISHED` và không hủy; draw `PUBLISHED`; entry `CONFIRMED`; trận thuộc draw đã công bố. Mọi query public đi qua predicate; test cho **từng endpoint** (giải nháp, giải hủy, draw nháp, entry rút → `200 {data: null}` hoặc không xuất hiện; xem sync 2026-11-13).
- Tra cứu theo slug/mã dưới giải, không nhận id thô từ URL công khai.
- Test whitelist: snapshot **toàn bộ tên trường** serialize của mỗi endpoint; thêm trường mới phải sửa snapshot có chủ ý.
<!-- Red Team: Sửa draw sau công bố — 2026-11-11 -->
- Predicate "trận đã đấu thật" (`match-predicates.ts`, phase 06) cho mọi số liệu/danh sách.
- API public chỉ nhận request mang `SSR_INTERNAL_SECRET` (client gọi qua `API_INTERNAL_URL`); không rate limit ở API.

<!-- Red Team: Tô-pô mạng, IP thật, rate limit, health — 2026-11-11 -->
<!-- Red Team: Kiểm soát bảo mật sớm — 2026-11-11 -->
Biên công khai
- Rate limit theo IP ở `proxy.ts` dùng Redis atomic giữa replica, fallback RAM khi Redis lỗi; chặt hơn cho trang có `q`. Header IP tin cậy vẫn cần kiểm Traefik/CDN trên staging.
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

- [x] (Lát cắt) Khung client + api-client + cache-policy
- [x] (Lát cắt) public-scope + API nhánh theo slug + serializer + test
- [x] (Lát cắt) Trang nhánh CSS grid + route revalidate
- [ ] (Lát cắt) Deploy staging + Playwright lát cắt → M1 (Playwright đã có (đợt 3); còn staging)
- [x] ui-consistency: finding-patterns → planning (site công khai) (2026-11-14)
- [x] i18n vi/en + chuyển hướng locale + fallback vi + nhãn ô chờ qua từ điển (2026-11-14)
- [x] API public events/matches/draws/groups/entries/strip + test phạm vi từng endpoint + snapshot trường (2026-11-14); API `schedule` và test bổ sung 2026-11-15, API tích hợp 24 test/3 spec đã đạt; Playwright lịch 5 đạt/1 bỏ qua có chủ đích (PDF mobile)
- [x] Khung header/dải kết quả/nav/footer (2026-11-14)
- [x] Danh sách giải + lịch giải (2026-11-14)
- [x] Trang giải 6 tab + trang trận (2026-11-14)
- [x] Bản in nhánh + lịch theo session/bàn (nhánh xong 2026-11-14; API lịch, form GET, SSR vi/en và bản in lịch triển khai 2026-11-15; API tích hợp 24 test/3 spec đạt; Playwright lịch 5 đạt/1 bỏ qua có chủ đích (PDF mobile))
- [x] Kiểm tích hợp lịch với PostgreSQL/Redis/API thật (2026-11-15): API đạt; Playwright lịch 5 đạt/1 bỏ qua PDF mobile. Kiểm staging vẫn thuộc bước 4 và M1/M2 chưa hoàn thành
- [x] Metadata/canonical/hreflang/OG + sitemap lúc chạy (2026-11-14)
- [x] Rate limit công khai + CSP report-only (2026-11-14)
- [x] Playwright e2e (2026-11-14)
- [x] ui-consistency: verifying → M2 (2026-11-14: verifying 2 vòng mỗi trang + kiểm cả bộ; M2 còn chờ staging)

## Success Criteria

<!-- Schedule follow-up sync — 2026-11-15 -->
- Bổ sung: `PublicScheduleQuery`, hợp đồng `PublicSchedule`, tab Thông tin vẫn mở khi có lịch mà không có rich text; lọc bằng mã session/bàn ở server. Client dùng tag lịch + tag giải để thay lịch, địa điểm hoặc entry đều làm mới.
- Bản in: `components/schedule/session-table-schedule.module.css`, khổ dọc, mỗi buổi/bàn bắt đầu trang mới, `thead` lặp ngữ cảnh giải/buổi/bàn/múi giờ, tên VĐV được xuống dòng. Không thay đổi schema hay migration.
- Đã chạy: typecheck và lint client đạt. API typecheck đạt (theo tác vụ API). API tích hợp đạt: 24 ca hồi quy, 18 ca lịch/cache, 11 ca sau cập nhật mutation map. Playwright lịch 5 đạt/1 bỏ qua PDF mobile; client build/typecheck/lint đạt. Lỗi kết nối local ban đầu đã xử lý bằng cách bật dịch vụ dev. Chưa đạt M1/M2.
- PDF kiểm thật: lịch thường 1 trang; lịch dài 3 trang, mỗi trang có ngữ cảnh giải/buổi/bàn/múi giờ. Playwright kiểm SSR, GET, vi/en, lịch rỗng, múi giờ, dữ liệu riêng tư và khung 390/1280 px. Lượt toàn bộ trước sửa locator có 37 đạt/5 bỏ qua/2 lỗi mới; đã sửa locator và chạy lại riêng lịch đạt, không báo toàn bộ suite xanh sau sửa. Báo cáo: `plans/reports/tester-261115-phase08-public-schedule.md`, `plans/reports/reviewer-261115-phase08-public-schedule.md` (9,5/10, không còn critical/high/medium).

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

- Sau hoàn tất nợ code 2026-11-15: triển khai và kiểm staging khi cổng hạ tầng đạt, gồm migration tên công khai mới. Giữ API sanitize, timeout env bootstrap, select GET và tách ô nhánh/thẻ trận theo lý do trong báo cáo. Không coi các khối ghi nợ lịch sử là việc còn mở.

- Sau M1: phase 04 (phần còn lại) → 05 → pilot BTC (tuần 9). Phase 10 thêm bảng điểm theo vòng vào tab Thông tin, link VĐV → hồ sơ; phase 11 thêm nhà tài trợ, tin/video liên quan.
