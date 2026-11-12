# Phase 10 — Trang xếp hạng, danh sách VĐV, hồ sơ VĐV

## Context Links

- [Site tham chiếu §3.7 Rankings, §3.8 danh sách + hồ sơ VĐV; ảnh `10, 11, 12, 13`](../reports/researcher-261111-1450-worldtabletennis-site-feature-and-layout-analysis.md)
- [Phase 09 — snapshot kèm breakdown, sổ điểm](./phase-09-ranking-rules-points-ledger-and-snapshots.md)
- [Phase 08 — mẫu UI công khai, predicate phạm vi công khai](./phase-08-public-site-shell-event-pages-and-bracket-ui.md)
- [Red team đã phân xử: nhóm 1, 5, 6, 12, 14, 15](./reports/red-team-261111-1614-adjudicated-findings.md)

## Overview

<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Priority: P1. Status: pending. Tuần 15–16 (≈3,5 ngày công, gồm ui-consistency ≈0,5 ngày).
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
- Model `Player` đã có: `isPublicProfile` (mặc định true), `noindex` (mặc định true), `publicDisplayName`, `photoMediaId`, `bio`/`bioEn` (text thuần), `birthDate`/`birthYear`, `mergedIntoId`, `mergedAt`. Chưa có route công khai nào.
- 301 slug VĐV đã gộp sang hồ sơ đích: làm ở phase này (`mergedIntoId` đã lưu). Chưa có test.
- Ảnh hồ sơ: media purpose `player-photo` đã thêm (`packages/shared/src/media/media-contract.ts`).
- Tuổi hiển thị: setting `player.showAge` (mặc định tắt, `packages/shared/src/player-settings.ts`). Tính từ `birthDate`; không có thì dùng `birthYear`.
- Serializer công khai không trả `phone`, `email`, `birthDate`: test ở phase 08.

## Requirements

Functional
- `/rankings`: các bảng đang bật (tab theo đơn/đôi, nhóm theo giới/nhóm tuổi), mỗi bảng top N (AppSetting `ranking.overviewTopN`, mặc định ví dụ 10) + "Xem tất cả"; "Cập nhật ngày dd/mm/yyyy".
- `/rankings/[listCode]`: `?page&q&club`; cột hạng (mũi tên + số bậc), VĐV (ảnh, tên hiển thị, CLB), điểm, số kết quả tính; mở rộng → giải, hạng giải, vòng đạt, điểm, hết hạn (từ breakdown snapshot).
- `/players`: `?q&gender&club&page&sort`; cột tên, CLB, giới, hạng đơn/đôi hiện tại.
<!-- Red Team: Sửa draw sau công bố — 2026-11-11 -->
- `/players/[slug]`: hero (ảnh, tên hiển thị, CLB, tay thuận nếu có, tuổi nếu `player.showAge`), hạng hiện tại mỗi bảng, lịch sử kết quả (phân trang, chỉ trận đã đấu thật — không BYE), giải đã dự; tiểu sử vi/en. `isPublicProfile = false` → 404 (tên vẫn hiện ở nhánh/BXH, không có link). VĐV đã gộp → 301 sang hồ sơ đích.
- Tab Thông tin của giải: bảng "Điểm xếp hạng theo vòng" lấy từ phiên bản `RankingPointsRule` có hiệu lực tại `endDate` của giải (chỉ khi có nội dung gắn bảng xếp hạng).
- Link tên VĐV ở nhánh/trận/danh sách (phase 08) → hồ sơ (khi hồ sơ công khai).
<!-- Red Team: Tô-pô mạng, IP thật, rate limit, health — 2026-11-11 -->
- Tìm kiếm: `q` giới hạn độ dài (≤ 100 ký tự); trang có `q` không cache; rate limit ở biên (Traefik/Next, phase 08).

Non-functional
- `/rankings/[listCode]` trang 50 dòng: 1 query snapshot rows (đã có breakdown); payload ≤ 80 KB.
- Hồ sơ VĐV ≤ 3 query.

## Architecture

API public (qua predicate phạm vi công khai của phase 08)

| Path | Tham số / ghi chú |
|---|---|
| `GET /public/rankings` | danh sách bảng đang bật + top N của snapshot công bố mới nhất |
| `GET /public/rankings/:listCode` | `page, pageSize ≤ 100, q, club` → rows + `asOfDate` + breakdown của các dòng trong trang (từ snapshot) |
| `GET /public/players` | `q, gender, club, page, sort=name|rank` — chỉ `isActive`, `isPublicProfile`, chưa gộp |
| `GET /public/players/:slug` | hồ sơ + hạng hiện tại; slug của VĐV đã gộp → `{ redirectTo }` |
| `GET /public/players/:slug/results` | `page` — trận `OFFICIAL` không BYE, gần nhất trước, chỉ trong giải/draw công khai |
| `GET /public/events/:slug/ranking-points` | bảng điểm theo vòng của hạng giải (phiên bản tại `endDate`) |

- Serializer VĐV: không trả SĐT, email, ngày sinh; tuổi chỉ khi cờ bật; tên = `publicDisplayName ?? fullName` (bản en: `fullNameEn`). Test snapshot toàn bộ tên trường.

<!-- Red Team: Revalidate Next.js chưa kiểm chứng — 2026-11-11 -->
Route client (`apps/client/src/app/[locale]/`)

| Route | Tag |
|---|---|
| `rankings/page.tsx` | `rankings` |
| `rankings/[listCode]/page.tsx` | `ranking-{listCode}` (có `q` → không cache) |
| `players/page.tsx` | `players` (có `q` → không cache) |
| `players/[slug]/page.tsx` | `player-{slug}`, `rankings` |

- Tag chính xác, không wildcard. Revalidate: công bố snapshot → `rankings`, `ranking-{listCode}`; sửa/gộp VĐV ở admin → `player-{slug}`, `players`; chốt trận → `player-{slug}` của các VĐV liên quan (bổ sung vào `cache-tags.ts` phase 07).
- Metadata: title "Bảng xếp hạng {tên} — cập nhật {ngày}", hồ sơ VĐV dùng ảnh làm OG; `noindex` → `robots: noindex`. Không xuất JSON-LD `Person`, không đưa VĐV vào sitemap cho tới khi câu hỏi đồng ý công khai được trả lời (cờ trong code, phase 12 bật nếu được phép).

## Related Code Files

Create
- `apps/api/src/modules/public-rankings/{public-rankings.module.ts,public-rankings.controller.ts,public-rankings.query.ts}`, `apps/api/src/modules/public-players/{public-players.module.ts,public-players.controller.ts,public-players.query.ts,public-player.serializer.ts}`
- `apps/client/src/components/rankings/{ranking-table.tsx,rank-movement.tsx,points-breakdown-details.tsx,ranking-list-tabs.tsx,ranking-top-card.tsx}`, `apps/client/src/components/players/{player-table.tsx,player-hero.tsx,player-results-list.tsx,player-current-ranks.tsx}`
- Route files như bảng trên
- `apps/client/src/components/events/ranking-points-by-round-table.tsx`
- Test: `apps/api/test/{public-rankings.e2e-spec.ts,public-players.e2e-spec.ts}`, `apps/client/tests/e2e/rankings-and-players.spec.ts`

Modify: `apps/client/src/app/[locale]/events/[slug]/info/page.tsx` (bảng điểm theo vòng), `apps/client/src/components/bracket/bracket-match-cell.tsx`, `match-card.tsx` (link hồ sơ), `site-header.tsx`/`main-nav.tsx` (menu Xếp hạng, VĐV), `apps/api/src/modules/revalidation/cache-tags.ts`, `apps/client/src/app/sitemap.ts` (bảng xếp hạng; VĐV chỉ khi được phép).

## Implementation Steps

1. `ui-consistency:finding-patterns` → `ui-consistency:planning`: tái dùng bảng số liệu nền navy, phân trang, thanh lọc GET từ phase 08; thêm mẫu "dòng mở rộng `<details>`", "hero VĐV".
2. API public rankings/players (đọc snapshot + breakdown; predicate phạm vi công khai; predicate trận đã đấu) + serializer + test phạm vi + snapshot trường.
3. Trang `/rankings`, `/rankings/[listCode]`, `/players`, `/players/[slug]` (cờ hồ sơ công khai, 301 VĐV đã gộp).
4. Bảng điểm theo vòng trong tab Thông tin; link VĐV toàn site.
5. Tag revalidate mới; metadata; sitemap (bảng xếp hạng).
6. Playwright e2e: tìm VĐV trên BXH, mở rộng chi tiết điểm (tắt JS vẫn mở được), hồ sơ hiện đúng hạng, hồ sơ không công khai → 404.
7. `ui-consistency:verifying` (1440 + 390); deploy staging.

## Todo List

- [ ] ui-consistency: finding-patterns → planning
- [ ] API public rankings (breakdown từ snapshot) + players + serializer + test
- [ ] Trang tổng quan + bảng đầy đủ + chi tiết điểm
- [ ] Danh sách VĐV + hồ sơ (isPublicProfile, noindex, 301 khi gộp)
- [ ] Bảng điểm theo vòng ở tab Thông tin; link hồ sơ
- [ ] Tag revalidate, metadata, sitemap (không VĐV)
- [ ] Playwright e2e
- [ ] ui-consistency: verifying; deploy staging

## Success Criteria

- Công bố kỳ mới trên admin → `/rankings/...` hiện ngày + thứ tự mới trong ≤ 10 s (hoặc ≤ TTL nếu Spike E trượt).
- Sửa kết quả sau khi công bố (sổ điểm sống đổi) → chi tiết điểm trên trang công khai vẫn khớp snapshot đã công bố cho tới kỳ sau.
- Tìm "nguyen van" (không dấu) ra "Nguyễn Văn …" ở BXH và danh sách VĐV.
- 390 px: bảng xếp hạng không tràn ngang trang (cột phụ ẩn, bảng cuộn trong khung).
- Hồ sơ VĐV không có trận nào → empty state, không lỗi; lịch sử kết quả không có trận BYE.
- Hồ sơ có `noindex` → thẻ `robots` noindex; sitemap không chứa URL VĐV; không có JSON-LD `Person`.

## Risk Assessment

| Rủi ro | Khả năng × Tác động | Xử lý |
|---|---|---|
| Tìm không dấu chậm khi dữ liệu lớn | Thấp × Thấp | Index `normalizedName` (phase 05); sau này `pg_trgm` nếu cần |
| Lộ thông tin VĐV nhỏ tuổi | Trung bình × Cao | `noindex` mặc định, `isPublicProfile`, tên hiển thị thay thế; câu hỏi đồng ý |
| Breakdown snapshot làm payload lớn | Thấp × Thấp | Chỉ trả breakdown của dòng trong trang |

Rollback: chỉ thêm route/module; revert về phase 09.

## Security Considerations

- Serializer whitelist; ảnh VĐV qua URL công khai của biến thể đã mã hóa lại; không lộ key file private.
- Rate limit trang tìm kiếm ở biên (phase 08); `q` giới hạn độ dài.

## Next Steps

- Phase 11 thêm tin liên quan vào trang giải.
