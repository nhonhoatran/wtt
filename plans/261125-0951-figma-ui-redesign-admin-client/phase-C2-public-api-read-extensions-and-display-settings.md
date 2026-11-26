---
phase: C2
title: "Mở rộng API đọc công khai, setting hiển thị và tag cache"
status: completed
priority: P1
effort: 6h
depends_on: []
cross_half: "Không chạy song song với A2 (A2 sửa packages/shared/src/app-setting-registry.ts, app-setting-definition.ts). Chạy trước hoặc sau A2; nếu A2 thêm nhóm setting mới, C2 vẫn dùng nhóm `display` có sẵn."
---

# Phase C2 — Mở rộng API đọc công khai, setting hiển thị và tag cache

## Context links
- Gap: [research/client-figma-gap.md](./research/client-figma-gap.md) (các dòng loại **API-mở**), "Phát hiện xuyên suốt" 4, 6, 7
- `docs/public-site.md` mục "API công khai", "Quy tắc phạm vi và trả về" (serializer whitelist + snapshot)
- `docs/cache-revalidation.md` mục "Mutation và tag"
- `docs/code-standards.md` mục "Settings hay env", "Route ghi admin mới phải đăng ký tag"

## Overview
- Ưu tiên: P1. Chạy song song được với C1 (không chung file).
- Một phase gom **mọi** thay đổi API + contract + setting để các phase giao diện sau chỉ đụng `apps/client`. Không migration: mọi trường đã có trong DB.
- Nếu vượt một phiên: tách mục A7–A8 thành C2b (chạy trước C8/C9).

## Key insights
- `PublicEventDetail extends PublicEventCard` (`packages/shared/src/public-event-contract.ts:93`) và đã có `subEvents: PublicSubEventSummary[]` → thẻ dùng `subEvents: PublicCoded[]`, chi tiết thu hẹp sang kiểu con (TS cho phép).
- `SubEvent.name` nullable → dùng helper `subEventNames` đã có (`public-match.serializer.ts:4,35`).
- `home.featuredEventId` đã có setting nhưng không ai đọc (`tournament-settings.ts:92-99`).
- Tag: `subEvent.*` thiếu `events` (`revalidation/cache-tags.ts:86-90`); `venueTable.write` chỉ có `event-*`, `schedule-*` (`cache-tags.ts:169`; context chỉ có slug, `venues/venue-tables.service.ts:69-75`).
- Setting có `editor` tự hiện trên `/settings` admin qua `listEditableAppSettings` (`apps/api/src/modules/settings/app-settings.service.ts:35`). Editor `json` chưa thân thiện → báo nửa admin để làm editor riêng (ngoài phạm vi client).

## Requirements
Trường API mới (đều whitelist, có snapshot):

| Mã | Contract | Nguồn DB | Dùng ở | Tag bổ sung |
|---|---|---|---|---|
| A1 | `PublicEventCard.subEvents: PublicCoded[]` (theo `order`, `code`) | `SubEvent` + `Discipline` | C4, C5 | `subEvent.*` + `events` |
| A2 | `PublicMatchCard.table`, `PublicBracketMatch.table`: `{ code, displayName } \| null` | `Match.tableId` → `VenueTable` | C3, C6, C7, C8 | `venueTable.write` + `draw-*`, `groups-*`, `match-*` các trận trên bàn, `results-strip` |
| A3 | `PublicSubEventSummary.competitorKind: 'SINGLES' \| 'DOUBLES'` | `Discipline.competitorKind` | C6 | đã có (`discipline.write`) |
| A4 | `PublicEventDetail.venue` thêm `address`, `mapUrl` (chỉ https) | `Venue` | C6 | đã có (`venue.write`) |
| A5 | `PublicEventDetail.days: { date; sessions: { code; name; nameEn }[] }[]` — chỉ session có trận công khai | `EventSession` + `publicScope.match` | C6 | đã có (`session.*` gửi `event-*`) |
| A6 | `PublicHome.heroEventSlug: string \| null` — setting `home.featuredEventId` (giải công khai) → giải `isFeatured` đầu tiên → giải sắp/đang diễn ra đầu tiên; `null` khi `sections.hero` tắt | `AppSetting`, `Event` | C4 | đã có (`home` đọc `settings`, `events`) |
| A7 | `PublicPlayerProfile.record: { wins; losses }` — đúng tập trận của `players/:slug/results` | `Match` | C9 | đã có (`match.*` gửi `player-*`) |
| A8 | `PublicMatchDetail.session: { code; name; nameEn } \| null` | `Match.sessionId` | C8 | đã có (`schedule.update`, `session.*` gửi `match-*`) |

Setting mới (nhóm `display`, sửa trên `/settings`, giá trị dưới đây chỉ là mặc định):

| Key | Schema | Mặc định | Ý nghĩa |
|---|---|---|---|
| `site.nav.items` | mảng `{ key: enum(news, videos, players, events, calendar, rankings, contact); labelVi?; labelEn? }`, 1–10 phần tử, không trùng `key` | `news, videos, players, events, rankings` (thứ tự Figma) | Mục menu header; nhãn trống → dictionary |
| `site.socialLinks` | mảng `{ platform: enum(facebook, youtube, tiktok, instagram, zalo); url: https }`, ≤ 8 | `[]` | Icon MXH footer; rỗng → ẩn |
| `site.tagline` | `{ vi; en } \| null` (≤ 300 ký tự) | `null` | Đoạn giới thiệu footer |
| `site.registrationUrl` | https hoặc chuỗi rỗng | `''` | Nút "Đăng ký thi đấu"; rỗng → ẩn (chờ Q1) |
| `ranking.expiringSoonDays` | số 0–365 | `30` | Nhãn "Sắp hết hạn"; 0 = tắt |

`PublicSiteConfig` (`public-site-contract.ts:2-6`) thêm `display: { navItems; socialLinks; tagline; registrationUrl; rankingExpiringSoonDays }`.

Phi chức năng: không migration; không trả trường riêng tư; truy vấn thêm phải gộp (không N+1); payload `/rankings` giữ ngân sách gzip (`docs/public-site.md:193`, không đụng).

## Architecture
```
Admin /settings ──PATCH──> AppSetting ──settings.update──> tag `settings`
                                         │
GET /public/site ──> PublicSiteQuery.site() ──> { siteName, rateLimit, contactRateLimit, display }
                                                  └─ client getSiteConfig() (đã dùng cho proxy + site name)
Serializer whitelist: event card/detail, match card, bracket match, player profile, home
Mutation ──> CACHE_TAGS[...] ──> queue revalidate ──> client /api/revalidate
```
`venueTable.write`: đổi context sang `{ matches: { eventSlug, subEventCode, matchNo, isGroup }[] }` lấy trong `updateRefreshed` (một query `findMany` các trận có `tableId`), sinh `event-*`, `schedule-*`, `draw-*`/`groups-*`, `match-*`, `results-strip`.

## Related code files
Sửa (shared):
- `packages/shared/src/public-event-contract.ts`, `public-competition-contract.ts`, `public-bracket-contract.ts`, `public-content-contract.ts`, `public-ranking-contract.ts`, `public-site-contract.ts`
- `packages/shared/src/app-setting-registry.ts` (đăng ký file setting mới), `ranking-settings.ts`
Tạo (shared): `packages/shared/src/public-site-display-settings.ts`, `packages/shared/src/public-site-display-settings.test.ts`

Sửa (api):
- `apps/api/src/modules/public-events/public-event.serializer.ts`, `public-event-detail.query.ts`, `public-events-list.query.ts`, `public-home-events.query.ts`, `public-site.query.ts`
- `apps/api/src/modules/public-competition/public-match.serializer.ts`, `public-bracket.query.ts`, `public-bracket.serializer.ts`, `public-matches.query.ts` (detail)
- `apps/api/src/modules/public-players/public-player-profile.query.ts`, `public-player.serializer.ts`
- `apps/api/src/modules/public-content/public-content.controller.ts` (home, A6)
- `apps/api/src/modules/revalidation/cache-tags.ts`, `route-tag-coverage.ts` (nếu cần), `venues/venue-tables.service.ts`
- Test: `apps/api/test/public-events.e2e-spec.ts`, `public-bracket.e2e-spec.ts`, `public-matches.e2e-spec.ts`, `public-results-strip.e2e-spec.ts`, `public-players.e2e-spec.ts`, `public-site.e2e-spec.ts`, `apps/api/src/modules/revalidation/*.test.ts`, `public-events/public-home-events.query.test.ts`

Không sửa client trong phase này (client chỉ cập nhật type, compile vẫn đạt vì trường mới là bổ sung).

## Implementation steps
1. Setting: tạo `public-site-display-settings.ts` (zod, `defineAppSetting`, nhóm `display`, editor `json`/`text`/`number`), URL dùng `https-url.ts`; đăng ký trong registry; test schema (từ chối `http:`, `javascript:`, key trùng, platform lạ).
2. `PublicSiteQuery.site()` đọc 5 setting song song, trả `display`; cập nhật contract + snapshot `public-site.e2e-spec.ts`.
3. A1: thêm `subEvents` vào `PUBLIC_EVENT_CARD_SELECT` (select tối thiểu, `orderBy`), map qua `subEventNames`; detail giữ kiểu summary. Snapshot list/calendar/home/detail.
4. A2: thêm `table: { select: { code, displayName } }` vào `PUBLIC_MATCH_CARD_SELECT` và select nhánh; serializer trả `null` khi chưa xếp bàn. Snapshot matches/groups/strip/bracket/player results/schedule.
5. A3–A5 trong `public-event-detail.query.ts`: `competitorKind` từ discipline; venue thêm `address`, `mapUrl`; `days` = session có trận thuộc `publicScope.match`, nhóm theo ngày (đã là ngày theo múi giờ giải), sắp ngày tăng.
6. A6 trong home: đọc `featuredEventId`, kiểm giải qua `publicScope.events`, fallback như bảng; test cho 3 nhánh fallback + setting trỏ giải nháp/hủy → fallback.
7. A7: đếm thắng/thua bằng cùng `where` của `public-player-results.query.ts` (tách hàm where dùng chung, không nhân bản điều kiện).
8. A8: thêm `session` vào select chi tiết trận.
9. Tag: `subEventTags` thêm `t.events()`; `venueTable.write` đổi context + test (`match-lifecycle-tags.test.ts` kiểu tương tự); chạy test coverage route-tag.
10. Chạy `pnpm --filter @kamito/shared test`, `pnpm --filter @kamito/api typecheck lint test`, e2e API công khai trên DB `_test` (theo `docs/deployment-guide.md#playwright-e2e-client`; không `prisma db push`, không migration mới).
11. `pnpm --filter @kamito/client typecheck build` để chắc client vẫn compile.

## Todo
- [x] Setting hiển thị + test schema
- [x] `/public/site` trả `display`
- [x] A1 thẻ giải có nội dung
- [x] A2 bàn trên trận/nhánh
- [x] A3–A5 chi tiết giải
- [x] A6 giải hero trang chủ
- [x] A7 thắng–thua hồ sơ
- [x] A8 session chi tiết trận
- [x] Tag `subEvent.*`, `venueTable.write` + test
- [x] Snapshot whitelist cập nhật có chủ đích; API e2e công khai đạt


## Đồng bộ trạng thái 2026-11-25

Nguồn: [báo cáo triển khai](../reports/fullstack-developer-261125-phase-C2-public-api.md).

## Success criteria
- API e2e công khai (15 spec `apps/api/test/public-*.e2e-spec.ts`) đạt; snapshot chỉ thêm đúng các trường trong bảng.
- Unit revalidation đạt; test chứng minh đổi tên bàn sinh `draw-*`/`match-*`/`results-strip`, sửa nội dung sinh `events`.
- `pnpm --filter @kamito/client typecheck build` và `pnpm --filter @kamito/admin build` đạt.
- Không có file migration mới (`git status packages/db/prisma/migrations` sạch).

## Risk assessment
| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| N+1 khi thêm `subEvents` vào danh sách 24 giải | Trung bình × Trung bình | Prisma nested select (một query phụ); đo bằng log query trong test |
| Snapshot đổi ngoài ý muốn làm lộ trường | Thấp × Cao | Review diff snapshot; serializer whitelist từng trường |
| Đổi context `venueTable.write` làm hỏng luồng sửa bàn admin | Thấp × Trung bình | Giữ chữ ký `updateRefreshed`; test admin venue hiện có |
| Va chạm file với nửa admin (`app-setting-registry.ts`, `cache-tags.ts`) | Trung bình × Trung bình | Phase này sở hữu các file đó; nửa admin chờ hoặc rebase sau |
| `heroEventSlug` trỏ giải đã kết thúc | Thấp × Thấp | Là lựa chọn chủ động của admin; hero vẫn hiện trạng thái "Đã kết thúc" |

## Security considerations
- URL setting chỉ `https:` (MXH, đăng ký, `mapUrl`); render với `rel="noopener noreferrer"` ở client.
- Không trả `officialById`, ngày/năm sinh, SĐT; A7 chỉ đếm trận trong phạm vi công khai.
- Endpoint vẫn sau `SsrInternalGuard`; không thêm route mới.

## Next steps
- Mở khóa C3 (setting/site), C4 (A1, A6), C5 (A1), C6 (A2–A5), C7 (A2), C8 (A2, A8), C9 (A7), C10 (`expiringSoonDays`).
- Báo nửa admin: cần editor thân thiện cho `site.nav.items`, `site.socialLinks` (thay json).
- Rollback: revert commit; trường mới là bổ sung nên client cũ vẫn chạy với API mới và ngược lại (client mới dùng `?? []`/`?? null` cho đến khi deploy cùng lúc).
