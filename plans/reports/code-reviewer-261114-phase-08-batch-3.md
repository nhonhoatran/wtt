# Code review — phase 08 batch 3 (rate limit, settings, SEO, CSP, print, Playwright)

Ngày: 2026-11-14 · Chỉ review, không sửa file.

## Phạm vi
- Rate limit: `apps/client/src/lib/public-rate-limit.ts`, `apps/client/src/proxy.ts`
- Settings: `packages/shared/src/{public-site-settings,app-setting-definition,app-setting-registry,index,public-event-contract}.ts`
- API: `apps/api/src/modules/public-events/{public-site.query,public-events.controller,public-events.module}.ts`, `apps/api/test/public-site.e2e-spec.ts`
- SEO: `lib/page-metadata.ts`, `lib/site-name.ts`, `app/sitemap.ts`, `app/robots.ts`, `app/[locale]/layout.tsx`, mọi `generateMetadata` dưới `app/[locale]/**`
- CSP: `next.config.ts`, `app/api/csp-report/route.ts`
- Print: `global.css`, `bracket.module.css`, `event-hero.module.css`
- Playwright: `apps/client/playwright.config.ts`, `apps/client/tests/e2e/**`, `apps/api/test/playwright/**`, `apps/api/vitest.playwright.config.ts`

## Kiểm tra build
| Lệnh | Kết quả |
|---|---|
| `apps/client: npx tsc --noEmit` (gồm `tests`, `playwright.config.ts`) | exit 0 |
| `apps/client: npx eslint src` | exit 0, không lỗi |
| `apps/api: npx tsc --noEmit` | exit 0 |

Không chạy Playwright / e2e (không DB, không server theo yêu cầu).

## Tổng quan
Chất lượng tốt: fail-open đúng, whitelist field trong `/site`, guard SSR secret có test 403, slug được lọc bằng `URL_PART` trước khi gọi API, seed không ghi SSR secret ra đĩa, env loader đúng luật. Điểm yếu tập trung ở rate limit (không có test): đếm cả prefetch, không chặn trùng fetch cấu hình, Map không giới hạn.

## Critical
Không có.

## High

### H1. Prefetch của `<Link>` bị đếm vào hạn mức — khán giả tại sân dễ dính 429
- `apps/client/src/proxy.ts:37` matcher không có `missing` cho prefetch; `proxy.ts:15` đếm mọi request khớp matcher.
- Docs Next 16.4.3 (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:474`): proxy KHÔNG thấy header `next-router-prefetch`/`rsc` trong `request.headers` (bị strip) → không lọc được trong code, chỉ lọc được bằng matcher `missing` (ví dụ tại `proxy.md:668-679`).
- 13 file dùng `next/link`, không chỗ nào `prefetch={false}`. Bản production prefetch mọi link trong viewport → 1 lượt xem trang bracket/groups/matches = 1 + N request bị đếm. Cả sân chung 1 IP NAT, mặc định 600/phút (`public-site-settings.ts:24`) có thể cạn chỉ với vài chục người.
- Sửa: thêm `missing: [{ type: 'header', key: 'next-router-prefetch' }, { type: 'header', key: 'purpose', value: 'prefetch' }]` cho matcher trang (giữ riêng entry `/api/revalidate` không có `missing`). Điều hướng RSC thật (click) vẫn được đếm — đúng ý.

### H2. Map `hits` không giới hạn kích thước; IPv6 xoay địa chỉ vừa né limit vừa làm phình RAM
- `public-rate-limit.ts:8,30-34,44-49`: mỗi IP mới = 1-2 entry; sweep chỉ xoá entry hết hạn, mỗi 60 s. `windowSeconds` cho phép tới 3600 (`public-site-settings.ts:14`) → entry sống tới 1 giờ.
- Một client IPv6 có cả /64 → mỗi request một địa chỉ mới → không bao giờ vượt ngưỡng, và Map lớn dần không trần (ước ~150-200 B/entry).
- Sửa: (1) gom IPv6 theo /64 khi làm key; (2) trần kích thước Map — vượt trần thì xoá các entry cũ nhất (Map giữ thứ tự chèn) hoặc fail-open có log. Trần đó là tham số vận hành → nên là AppSetting `publicAccess` (hoặc ghi rõ lý do nếu để hằng).

## Medium

### M1. `currentLimits` không chặn fetch trùng (thundering herd + treo request khi API chậm)
- `public-rate-limit.ts:13-18`: khi hết TTL, mọi request đồng thời đều thấy `now >= expiresAt` và mỗi cái tự gọi `/site` (`policy: 'none'` → `no-store`). Khi API chậm/chết, mọi request tới trong khoảng `API_FETCH_TIMEOUT_MS` đều chờ hết timeout rồi mới fail-open.
- Sửa: memo luôn promise đang bay:
```ts
let inflight: Promise<Limits | null> | null = null;
async function currentLimits(now: number) {
  if (now < limits.expiresAt) return limits.value;
  inflight ??= publicGet<PublicSiteConfig>('/site', { tags: [], policy: 'none' }).catch(() => null)
    .then((c) => { limits = { value: c?.rateLimit ?? limits.value, expiresAt: Date.now() + ttlMs() }; return limits.value; })
    .finally(() => { inflight = null; });
  return inflight;
}
```
  Cân nhắc thêm: khi đã có giá trị cũ thì trả giá trị cũ ngay, refresh nền (stale-while-revalidate) — proxy không bao giờ phải chờ API.

### M2. Tin `X-Real-Ip` phụ thuộc cấu hình Traefik chưa kiểm
- `public-rate-limit.ts:24-29`. Đã đối chiếu source Traefik (`pkg/middlewares/forwardedheaders/forwarded_header.go`): mặc định (không `insecure`, không `trustedIPs`) Traefik xoá `X-Real-Ip`/`X-Forwarded-For` client gửi và tự set `X-Real-Ip` = remote addr → an toàn. Nhưng `docs/deployment-guide.md:198` và `docs/system-architecture.md:94` vẫn ghi "Chưa kiểm". Nếu entrypoint bật `forwardedHeaders.insecure` hoặc `trustedIPs` rộng, hoặc có CDN phía trước → client tự đặt `X-Real-Ip` để né limit (và làm phình Map, xem H2), hoặc mọi người dùng chung IP của CDN → 429 hàng loạt.
- Fallback `'unknown'` (`:28`) gom mọi request không có header vào chung 1 bucket. Chưa kiểm chứng proxy Next 16 có thấy `x-forwarded-for` do `base-server.js:601` gán (`??= socket.remoteAddress`) hay không — phỏng đoán: chạy `next start` trực tiếp không qua Traefik có thể rơi vào bucket chung.
- Sửa: chốt cấu hình Traefik ở Spike D trước khi lên prod; ghi log cảnh báo (1 lần) khi gặp `'unknown'`.

### M3. `/api/csp-report` đọc toàn bộ body trước khi kiểm kích thước
- `apps/client/src/app/api/csp-report/route.ts:27`: `request.text()` buffer hết body rồi mới so `MAX_BODY_BYTES` (`:28`, lại so số ký tự chứ không phải byte). Route handler App Router không có giới hạn body mặc định (chỉ Server Actions có `bodySizeLimit`) — phỏng đoán theo hiểu biết, chưa kiểm trong source. Endpoint công khai, nằm ngoài matcher của proxy (`proxy.ts:37` loại `api/`) → không bị rate limit.
- Sửa: từ chối sớm theo `content-length`, và đọc stream có trần (dừng khi vượt 8 KB).

### M4. Canonical lịch và sitemap mâu thuẫn
- `app/[locale]/events/calendar/page.tsx:34` canonical luôn là `/events/calendar?year=<năm>`; `app/sitemap.ts:18` lại đưa `/events/calendar` (không query) vào sitemap → sitemap chứa URL không canonical. Chọn một: canonical không query cho năm mặc định (chỉ thêm `?year=` khi người dùng chọn năm khác năm mặc định), hoặc sitemap dùng URL có `?year=`.

## Low
- L1. `app/sitemap.ts:12` hard-code `/vi` thay vì `DEFAULT_LOCALE`; sitemap không có `x-default` trong alternates (trang thì có, `page-metadata.ts:26`).
- L2. Redirect locale bị đếm 2 lần: `/` đếm ở `proxy.ts:15` rồi `/vi` đếm tiếp. Có thể chuyển bước rate limit xuống sau nhánh redirect.
- L3. Path có dấu chấm né rate limit (`proxy.ts:37` `.*\\..*`). Tác động thấp vì `URL_PART` (`lib/public-data.ts:20`) chặn trước khi gọi API → chỉ render 404. Có thể thu hẹp thành danh sách đuôi tĩnh cụ thể.
- L4. Response 429 (`proxy.ts:17`) nên thêm `Cache-Control: no-store`.
- L5. `csp-report/route.ts:4-5` (`MAX_BODY_BYTES`, `MAX_LOGS_PER_MINUTE`) là hằng vận hành; comment có nêu lý do ("fixed guards"), chấp nhận được cho giai đoạn report-only nhưng nên ghi rõ "bỏ khi phase 12 enforce" hoặc đưa vào `/settings`. Tương tự sweep 60 s (`public-rate-limit.ts:33`) — nội bộ, chấp nhận.
- L6. `packages/shared/src/public-event-contract.ts` 203 dòng (> 200).
- L7. `public-site.e2e-spec.ts:46-48` assert "không có override" sẽ fail trên DB dev đã chỉnh `/settings` — có message giải thích, chấp nhận, nhưng dễ gây đỏ giả.
- L8. Test print (`site-chrome-and-seo.spec.ts:91`) ghi screenshot vào `plans/reports/screenshots-...` mỗi lần chạy → file rác trong repo nếu không gitignore.

## Kiểm tra theo từng mảng (không có lỗi)
- **SEO**: `metadataBase` từ `PUBLIC_SITE_URL` (`layout.tsx`), title template `%s · siteName`, hreflang vi/en + `x-default`. Query trong canonical đúng ý: draws chỉ thêm `?draw=qualifying` khi bracket là QUALIFYING (`draws/[subEventCode]/page.tsx:33`) — trường hợp chỉ có vòng loại thì URL không query cũng trỏ canonical về `?draw=qualifying`, nhất quán; players `?stage=` chỉ khi khác MAIN (`players/[subEventCode]/page.tsx:43`); filter/phân trang/tìm kiếm không vào canonical. Trang index draws/groups/players chỉ redirect, không cần metadata.
- **Settings/API**: `/site` chỉ trả field whitelist (có test `sortedPaths`); `/sitemap` dùng `publicScope.events` (test loại draft + cancelled); cả hai sau `SsrInternalGuard` (test 403 với secret sai/thiếu/thêm ký tự). `SettingsModule` là `@Global` nên inject `AppSettingsService` không cần import module. Đổi setting → revalidate tag `settings` (`admin-settings.controller.ts`).
- **Print**: ẩn header/footer/nav/form, bỏ overflow của `[role=region]`, bracket thu nhỏ cột + mỗi section sang trang mới. Không có `<header>/<nav>` nào trong nội dung chính bị ẩn nhầm (đã grep components).
- **Playwright**: `process.loadEnvFile` của Node bỏ qua dòng `#` và không ghi đè biến đã có — đã chạy thử với file tạm (Node v24.15.0: dòng `# FOO=...` không được nạp, biến preset giữ nguyên). Seed + cleanup idempotent (cleanup chạy trước nếu còn world cũ), user test bị xoá trong `AuthTestKit.close`. Assert thật (status, canonical, CSP header, không lộ legal name trên 10 trang).
- Comment: tiếng Anh, ngắn, chủ yếu giải thích "vì sao".

## Recommended actions
1. H1 — matcher `missing` cho prefetch.
2. H2 — gom IPv6 /64 + trần kích thước Map.
3. M1 — memo promise đang bay (hoặc stale-while-revalidate).
4. M3 — giới hạn body csp-report trước khi đọc.
5. M2 — chốt cấu hình Traefik (Spike D) trước prod.
6. Thêm unit test cho `public-rate-limit.ts` (`clientIp`, cửa sổ, bucket search, fail-open) — logic thuần, test được không cần server.
7. M4, L1-L8 khi tiện.

## Câu hỏi chưa giải đáp
- Traefik prod có `forwardedHeaders.insecure`/`trustedIPs` không; có CDN phía trước không?
- Proxy Next 16 có thấy `x-forwarded-for` do `base-server` gán khi chạy không qua reverse proxy không (chưa kiểm chứng)?
- Screenshot print trong `plans/reports/` có chủ ý commit không?

**Status:** DONE_WITH_CONCERNS
**Summary:** Build/lint sạch; SEO, settings, CSP, print, Playwright ổn. Rate limit cần sửa trước matchday: prefetch bị đếm, Map không trần, fetch cấu hình không chặn trùng.
**Score:** 7.5/10
