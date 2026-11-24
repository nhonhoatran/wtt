# Phase 10 — Trang xếp hạng, danh sách VĐV, hồ sơ VĐV

## Context Links

- [Site tham chiếu §3.7 Rankings, §3.8 danh sách + hồ sơ VĐV; ảnh `10, 11, 12, 13`](../reports/researcher-261111-1450-worldtabletennis-site-feature-and-layout-analysis.md)
- [Phase 09 — snapshot kèm breakdown, sổ điểm](./phase-09-ranking-rules-points-ledger-and-snapshots.md)
- [Phase 08 — mẫu UI công khai, predicate phạm vi công khai](./phase-08-public-site-shell-event-pages-and-bracket-ui.md)
- [Red team đã phân xử: nhóm 1, 5, 6, 12, 14, 15](./reports/red-team-261111-1614-adjudicated-findings.md)
- [QA cuối 2026-11-17 — API, snapshot, Playwright, payload và publish thật](../reports/tester-261117-phase-10-public-rankings-players.md)
- [Review sau F1–F4 — 9,5/10, không còn Critical/P1/P2 mở](../reports/code-reviewer-261117-phase-10-public-rankings-players.md)

## Overview

<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Priority: P1. Status: in-progress. Code, kiểm thử và verifying local hoàn tất 2026-11-17; deploy staging còn chờ cổng phase 01. Tuần 15–16 (≈3,5 ngày công, gồm ui-consistency ≈0,5 ngày).
- Trang tổng quan xếp hạng (top N mỗi bảng), trang đầy đủ từng bảng (phân trang, tìm, lọc CLB, biến động hạng, chi tiết điểm mở rộng không cần JS), danh sách VĐV (tìm/lọc/phân trang server), hồ sơ VĐV (thông tin, hạng hiện tại, lịch sử kết quả, giải đã dự), bảng điểm theo vòng trong tab Thông tin của giải.
- Thống kê mùa của VĐV (thắng–thua trong năm) dời sang giai đoạn sau.

## Key Insights

<!-- Red Team: Xếp hạng không tái lập được — 2026-11-11 -->
- Đọc **snapshot đã công bố** (bất biến) cho cả hạng và chi tiết điểm (`breakdown` lưu trong snapshot) → trang công khai tái lập được, không lệch khi sổ điểm sống thay đổi; cache dài, chỉ revalidate khi công bố kỳ mới.
- Chi tiết điểm hiển thị bằng `<details>` từ breakdown của các dòng trong trang (không gọi API mỗi dòng như site tham chiếu).
- Hồ sơ VĐV tổng hợp từ dữ liệu có sẵn (trận, đăng ký, snapshot) — không có trường thống kê nhập tay.
<!-- Red Team: Audit, phạm vi công khai, VĐV nhỏ tuổi, song ngữ — 2026-11-11 -->
- Đồng ý công khai thông tin VĐV (nhất là VĐV nhỏ tuổi) chưa có câu trả lời → tôn trọng `isPublicProfile`, `noindex`, `publicDisplayName`; tắt JSON-LD `Person` và sitemap VĐV cho tới khi có trả lời.
<!-- Spike E results — 2026-11-12 -->
- Revalidate bảng xếp hạng dùng `revalidateTag(tag, { expire: 0 })` như phase 07; tag khai báo trước khi fetch. Cache dài vẫn giữ trần TTL (phòng mất lệnh revalidate).
- Sitemap bảng xếp hạng: `dynamic = 'force-dynamic'` như phase 08. Client restart → entrypoint đã xóa `.next/cache` (phase 01).

<!-- Phase 03 sync — 2026-11-12 -->
- Phase 03 không cung cấp thành phần công khai. Phân trang công khai (`pageSize ≤ 100`) là tham số riêng, không dùng `list.defaultPageSize`.

<!-- Phase 05 sync — 2026-11-12 -->
- Model `Player` đã có: `isPublicProfile` (mặc định true), `noindex` (mặc định true), `publicDisplayName`, `photoMediaId`, `bio`/`bioEn` (text thuần), `birthDate`/`birthYear`, `mergedIntoId`, `mergedAt`. Tại thời điểm sync phase 05 chưa có route công khai; đã bổ sung ở phase 10.
- 301 slug VĐV đã gộp sang hồ sơ đích: hoàn tất và kiểm thử 2026-11-17; chỉ tới đích active/public, đích ẩn trả 404.
- Ảnh hồ sơ: media purpose `player-photo` đã thêm (`packages/shared/src/media/media-contract.ts`).
- Tuổi hiển thị: setting `player.showAge` (mặc định tắt, `packages/shared/src/player-settings.ts`). Tính từ `birthDate`; không có thì dùng `birthYear`.
- Serializer công khai không trả `phone`, `email`, `birthDate`: test ở phase 08.

<!-- Phase 10 implementation sync — 2026-11-17 -->
## Kết quả triển khai và kiểm chứng local

- Đã có đủ bốn route SSR, lọc/sắp xếp/phân trang phía server; breakdown bằng `<details>` mở khi tắt JavaScript. Tái dùng `FilterForm`, `PaginationLinks`, `PillNav`, `ScrollRegion`, bảng navy và token hiện có. [Tám ảnh 1440/390 px](../reports/screenshots-261117-phase-10/) và Playwright xác nhận không tràn ngang toàn trang.
- Whitelist công khai dùng alias cho cả vi/en; URL hồ sơ là `p-<UUID>` từ helper dùng chung, không xuất slug chứa tên thật. `p-` là namespace kỹ thuật của route. Slug cũ và chuỗi gộp còn tra được; GET/HEAD thường trả 301 giữ query. RSC prefetch bỏ qua proxy dùng fallback `permanentRedirect` 308 của Next. Hồ sơ private/inactive hoặc đích gộp private không mở được.
- Kỳ mới thêm `eventId` ổn định vào JSON breakdown nội bộ từ id đã có trong ledger; không đổi schema, không migration, không sửa kỳ đã công bố. Phạm vi công khai kiểm theo id, link lấy slug hiện tại của đúng giải; điểm/vòng/ngày/nhãn vẫn từ snapshot. Kỳ cũ thiếu id che nhãn/link/mã hạng giải, giữ đủ điểm/vòng/ngày tới khi có kỳ mới. Test tái sử dụng slug giải đã đạt.
- Bảng điểm theo vòng dùng rule có hiệu lực tại `Event.endDate`; link hồ sơ nối cả nhánh, trận, bảng, danh sách đăng ký, vô địch, lịch và dải kết quả. Cache bao phủ sửa tên/alias/ảnh, entry, import, draw, trận, rule và publish; invalidation gồm cả slug cũ và opaque.
- API tích hợp **111/111** ở **15 file** riêng biệt; API unit revalidation **16/16**; ranking-engine **36/36**; worker **39/39**; client **45/45**; shared **101/101**. Playwright hồi quy trước F4 **40/40** (gồm 18 ca trang giải); chạy lại phase 10 sau F4 **24/24**, không bỏ qua. Không cộng ca chạy lặp vào tổng.
- Publish thật từ admin có step-up → BullMQ revalidation worker → SSR đã có cache đổi kỳ/điểm trong **644 ms**, 1 job hoàn tất (`apps/api/test-results/public-ranking-publish-refresh.json`). Đây là số đo local, chưa thay phép đo staging.
- Typecheck/lint trong phạm vi thay đổi và build cuối API/worker/client đạt. Next đã vá **16.4.3 → 16.4.5** sau lỗi chặn build theo [GHSA-mfr8-8qww-v76h](https://github.com/vercel/next.js/security/advisories/GHSA-mfr8-8qww-v76h). Review cuối **9,5/10**, không còn Critical/P1/P2 mở trong phạm vi review. Deploy staging chưa thực hiện.

## Requirements

Functional
- `/rankings`: các bảng đang bật (tab theo đơn/đôi, nhóm theo giới/nhóm tuổi), mỗi bảng top N (AppSetting `ranking.overviewTopN`, mặc định ví dụ 10) + "Xem tất cả"; "Cập nhật ngày dd/mm/yyyy".
- `/rankings/[listCode]`: `?page&q&club`; cột hạng (mũi tên + số bậc), VĐV (ảnh, tên hiển thị, CLB), điểm, số kết quả tính; mở rộng → giải, hạng giải, vòng đạt, điểm, hết hạn (từ breakdown snapshot).
- `/players`: `?q&gender&club&page&sort`; cột tên, CLB, giới, hạng đơn/đôi hiện tại.
<!-- Red Team: Sửa draw sau công bố — 2026-11-11 -->
- `/players/[slug]`: hero (ảnh, tên hiển thị, CLB, tay thuận nếu có, tuổi nếu `player.showAge`), hạng hiện tại mỗi bảng, lịch sử kết quả (phân trang, chỉ trận `OFFICIAL`, không void/BYE, trong giải/draw công khai), giải đã dự; tiểu sử vi/en. `isPublicProfile = false` → 404 (tên vẫn hiện ở nhánh/BXH, không có link). Slug chứa tên thật hoặc VĐV đã gộp → 301 sang opaque URL của hồ sơ đích còn công khai; lưu ý RSC prefetch 308 ở phần kết quả.
- Tab Thông tin của giải: bảng "Điểm xếp hạng theo vòng" lấy từ phiên bản `RankingPointsRule` có hiệu lực tại `endDate` của giải (chỉ khi có nội dung gắn bảng xếp hạng).
- Link tên VĐV ở nhánh/trận/danh sách (phase 08) → hồ sơ (khi hồ sơ công khai).
<!-- Red Team: Tô-pô mạng, IP thật, rate limit, health — 2026-11-11 -->
- Tìm kiếm: `q` giới hạn độ dài (≤ 100 ký tự); trang có `q` không cache; rate limit ở biên (Traefik/Next, phase 08).

Non-functional
- `/rankings/[listCode]` trang 50 dòng: 1 query snapshot rows (đã có breakdown), thêm truy vấn kiểm phạm vi giải theo lô; tránh query từng dòng. Ngân sách **80 KiB (81.920 byte) đo body HTTP gzip**, không phải JSON thô. Fixture 50 dòng × 20 khoản = 1.000 khoản đo **377.129 byte JSON / 9.307 byte gzip**; `rawBudgetMet=false`, `gzipBudgetMet=true`. Giải nén bằng dữ liệu identity, giữ đủ mọi khoản điểm. Chưa bảo đảm trần 80 KiB cho mọi lịch sử không giới hạn.
- Truy vấn hồ sơ (thông tin + hạng + giải đã dự) ≤ 3 SQL reads; lịch sử kết quả có endpoint phân trang riêng.

## Architecture

API public (qua predicate phạm vi công khai của phase 08)

| Path | Tham số / ghi chú |
|---|---|
| `GET /public/rankings` | danh sách bảng đang bật + top N của snapshot công bố mới nhất |
| `GET /public/rankings/:listCode` | `page, pageSize ≤ 100, q, club` → rows + `asOfDate` + breakdown của các dòng trong trang (từ snapshot) |
| `GET /public/players` | `q, gender, club, page, sort=name|rank` — chỉ `isActive`, `isPublicProfile`, chưa gộp |
| `GET /public/players/:slug` | opaque hoặc slug cũ → hồ sơ + hạng hiện tại; slug cũ/gộp → `{ redirectTo }` nếu đích còn công khai |
| `GET /public/players/:slug/results` | `page` — trận `OFFICIAL` không BYE, gần nhất trước, chỉ trong giải/draw công khai |
| `GET /public/events/:slug/ranking-points` | bảng điểm theo vòng của hạng giải (phiên bản tại `endDate`) |

- Serializer VĐV: không trả SĐT, email, ngày sinh/năm sinh hoặc id nội bộ; tuổi chỉ khi cờ bật. Có `publicDisplayName` thì che cả `fullName` và `fullNameEn`; URL dùng `p-<UUID>`, không dùng slug tên thật. Test whitelist và đổi alias hai lần trên các bề mặt công khai.
- Mọi controller public dùng guard SSR nội bộ. Không tìm thấy/không có quyền → HTTP 200 `{ data: null }` ở API để cache cập nhật được; route Next gọi `notFound()` trả 404 công khai.
- Snapshot `eventId` chỉ dùng nội bộ để chống cấp quyền nhầm khi slug giải được tái sử dụng; serializer không đưa id ra JSON công khai. Snapshot legacy thiếu id không được nâng cấp tại chỗ.

<!-- Red Team: Revalidate Next.js chưa kiểm chứng — 2026-11-11 -->
Route client (`apps/client/src/app/[locale]/`)

| Route | Tag |
|---|---|
| `rankings/page.tsx` | `rankings`, `players`, `events`, `settings` |
| `rankings/[listCode]/page.tsx` | `ranking-{listCode}`, `rankings`, `players`, `events`, `settings` (có `q` → không cache) |
| `players/page.tsx` | `players`, `rankings`, `settings` (có `q` → không cache) |
| `players/[slug]/page.tsx` | `player-{slug}`, `players`, `rankings`, `events`, `settings`; kết quả dùng `player-{slug}`, `players`, `events`, `settings` |

- Tag chính xác, không wildcard. Publish snapshot → `rankings`, `ranking-{listCode}`, `players`, `player-{slug}` của các VĐV đổi; giữ nguyên cách đếm `changedPlayers`. Sửa/gộp VĐV, entry/import/draw/trận gửi tag hồ sơ liên quan cho cả slug cũ và opaque. Rule cập nhật làm mới tab Thông tin; ảnh/category làm mới players/rankings. Tham chiếu `cache-tags.ts` và `lib/public-data.ts`.
- Metadata: title "Bảng xếp hạng {tên} — cập nhật {ngày}", hồ sơ VĐV dùng ảnh làm OG; `noindex` → `robots: noindex`. Không xuất JSON-LD `Person`, không đưa VĐV vào sitemap cho tới khi câu hỏi đồng ý công khai được trả lời (cờ trong code, phase 12 bật nếu được phép).

## Related Code Files

Create
- `apps/api/src/modules/public-rankings/{public-rankings.module.ts,public-rankings.controller.ts,public-rankings.query.ts,public-ranking.serializer.ts,public-event-ranking-points.query.ts}`
- `apps/api/src/modules/public-players/{public-players.module.ts,public-players.controller.ts,public-players.query.ts,public-player.serializer.ts,public-player-profile.query.ts,public-player-ranks.query.ts,public-player-results.query.ts}`
- `apps/client/src/components/rankings/{ranking-table.tsx,rank-movement.tsx,points-breakdown-details.tsx,ranking-list-tabs.tsx,ranking-top-card.tsx}`, `apps/client/src/components/players/{player-table.tsx,player-hero.tsx,player-results-list.tsx,player-current-ranks.tsx}`
- Route files như bảng trên
- `apps/client/src/components/events/ranking-points-by-round-table.tsx`
- `packages/shared/src/public-player-slug.ts`, `apps/api/src/common/http/public-json-response.ts`
- Test: `apps/api/test/{public-rankings.e2e-spec.ts,public-players.e2e-spec.ts,public-ranking-payload.e2e-spec.ts}`, `apps/client/tests/e2e/rankings-and-players.spec.ts`

Modify: `apps/client/src/app/[locale]/events/[slug]/info/page.tsx` (bảng điểm theo vòng), `apps/client/src/components/bracket/bracket-match-cell.tsx`, `match-card.tsx` (link hồ sơ), `site-header.tsx`/`main-nav.tsx` (menu Xếp hạng, VĐV), `apps/api/src/modules/revalidation/cache-tags.ts`, `apps/client/src/app/sitemap.ts` (bảng xếp hạng; VĐV chỉ khi được phép).

Bổ sung thực tế: `apps/client/src/lib/{public-data.ts,api-client.ts}`, `proxy.ts`, serializer public và các mảnh hiển thị VĐV toàn site; `packages/ranking-engine/src/{types.ts,snapshot-builder.ts}`, `apps/worker/src/ranking/load-snapshot-ledger.ts`; `apps/client/package.json` và lockfile cho bản vá Next. Không tạo migration ở phase này.

## Implementation Steps

1. `ui-consistency:finding-patterns` → `ui-consistency:planning`: tái dùng bảng số liệu nền navy, phân trang, thanh lọc GET từ phase 08; thêm mẫu "dòng mở rộng `<details>`", "hero VĐV".
2. API public rankings/players (đọc snapshot + breakdown; predicate phạm vi công khai; predicate trận đã đấu) + serializer + test phạm vi + snapshot trường.
3. Trang `/rankings`, `/rankings/[listCode]`, `/players`, `/players/[slug]` (cờ hồ sơ công khai, 301 VĐV đã gộp).
4. Bảng điểm theo vòng trong tab Thông tin; link VĐV toàn site.
5. Tag revalidate mới; metadata; sitemap (bảng xếp hạng).
6. Playwright e2e: tìm VĐV trên BXH, mở rộng chi tiết điểm (tắt JS vẫn mở được), hồ sơ hiện đúng hạng, hồ sơ không công khai → 404.
7. `ui-consistency:verifying` (1440 + 390), review và build local.
8. Deploy staging khi hạ tầng phase 01 sẵn sàng; đo lại cache/revalidation trên môi trường triển khai.

## Todo List

- [x] ui-consistency: finding-patterns → planning — tái dùng mẫu phase 08; thêm native details và hero VĐV
- [x] API public rankings (breakdown từ snapshot) + players + serializer + test — gồm F1–F4, whitelist và snapshot bất biến
- [x] Trang tổng quan + bảng đầy đủ + chi tiết điểm — SSR; tìm/lọc/phân trang phía server
- [x] Danh sách VĐV + hồ sơ (isPublicProfile, noindex, 301 khi gộp) — opaque URL; private 404; alias che tên thật vi/en
- [x] Bảng điểm theo vòng ở tab Thông tin; link hồ sơ — rule tại endDate; nối các bề mặt VĐV toàn site
- [x] Tag revalidate, metadata, sitemap (không VĐV) — publish thật qua BullMQ làm mới SSR đã có cache trong 644 ms local
- [x] Playwright e2e — sau F4 24/24, không bỏ qua; hồi quy trước F4 40/40
- [x] ui-consistency: verifying — tám ảnh 1440/390 px, không tràn ngang toàn trang; QA/review đạt 2026-11-17
- [ ] Deploy staging — chờ cổng phase 01; đo lại revalidation trên staging

## Lượt dịch vụ thật tiếp theo — 2026-11-20

- Hồi quy API thật của lượt mới có `public-rankings` **16**, `public-players` **14**, payload **1** ca đạt; nằm trong **132 ca / 21 spec duy nhất** của lượt phase 08–12. Guard PostgreSQL test riêng, process env và hash `.env` trước/sau đều đạt. [Báo cáo](./reports/tester-261120-real-api.md).
- Payload xác nhận lại **50 dòng × 20 khoản = 1.000 breakdown**, **377.129 byte JSON thô / 9.303 byte gzip**, ngân sách 81.920 byte tính trên wire gzip. Giữ đủ khoản, không suy mẫu này thành mọi lịch sử. Hai bài ghi payload/EXPLAIN dùng `API_TEST_ARTIFACT_DIR`; báo cáo khai rõ hai JSON generated cũ đã bị ghi đè ở lượt đầu trước khi sửa đường dẫn, không tuyên bố đã khôi phục lịch sử.
- Hồi quy public production browser `full-03` đạt **96 / 8 skip / 0 lỗi / 0 flaky** ở 10 spec, có BXH/hồ sơ. Chốt kỳ qua API admin thật → worker BullMQ riêng → SSR có cache đổi trong **209 ms desktop / 218 ms mobile**; không cộng hai phép đo hoặc tổng browser này thành số ca riêng phase 10. [Báo cáo](./reports/tester-261120-real-public-and-axe.md).
- Không có feature hoặc migration mới ở phase 10. Deploy và đo revalidation trên staging vẫn mở; probe chốt trận 133 ms ở phase 08 không được đổi thành số đo công bố BXH hoặc nghiệm thu staging.

## Success Criteria

- Công bố kỳ mới trên admin → `/rankings/...` hiện ngày + thứ tự mới trong ≤ 10 s (hoặc ≤ TTL nếu Spike E trượt).
- Sửa kết quả sau khi công bố (sổ điểm sống đổi) → chi tiết điểm trên trang công khai vẫn khớp snapshot đã công bố cho tới kỳ sau.
- Tìm "nguyen van" (không dấu) ra "Nguyễn Văn …" ở BXH và danh sách VĐV.
- 390 px: bảng xếp hạng không tràn ngang trang (cột phụ ẩn, bảng cuộn trong khung).
- Hồ sơ VĐV không có trận nào → empty state, không lỗi; lịch sử kết quả không có trận BYE.
- Hồ sơ có `noindex` → thẻ `robots` noindex; sitemap không chứa URL VĐV; không có JSON-LD `Person`.

Kết quả local: các tiêu chí trên đã có kiểm thử trong báo cáo QA; publish đo 644 ms. Chưa xác nhận tiêu chí thời gian trên staging hoặc vận hành nhiều replica tại staging.

## Risk Assessment

| Rủi ro | Khả năng × Tác động | Xử lý |
|---|---|---|
| Tìm không dấu chậm khi dữ liệu lớn | Thấp × Thấp | Index `normalizedName` (phase 05); sau này `pg_trgm` nếu cần |
| Lộ thông tin VĐV nhỏ tuổi | Trung bình × Cao | `noindex` mặc định, `isPublicProfile`, tên hiển thị thay thế; câu hỏi đồng ý |
| Breakdown snapshot làm payload lớn | Trung bình × Thấp | Chỉ lấy dòng trong trang; gzip bất đồng bộ giữ đủ breakdown. Fixture 1.000 khoản: 9.307 byte gzip; JSON thô 377.129 byte vượt 80 KiB, chưa bảo đảm mọi lịch sử |
| Slug giải được tái sử dụng cấp quyền nhầm | Thấp × Cao | Kiểm theo eventId ổn định nội bộ; legacy thiếu id che nhãn/link, không sửa snapshot công bố |

Rollback: revert phần feature API/client/shared/worker tương ứng; không sửa snapshot đã công bố. Phase này không có migration. Giữ bản vá bảo mật Next 16.4.5 khi rollback feature.

## Security Considerations

- Serializer whitelist; ảnh VĐV qua URL công khai của biến thể đã mã hóa lại; không lộ key file private.
- Rate limit trang tìm kiếm ở biên (phase 08); `q` giới hạn độ dài.

## Next Steps

- Phase 11 thêm tin liên quan vào trang giải.
- Hoàn tất hạ tầng phase 01 rồi deploy và đo staging; G1/G2 và đồng ý công khai vẫn theo các cổng/câu hỏi hiện có.
