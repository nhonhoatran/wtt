# Báo cáo phase C2 — API đọc công khai, setting hiển thị, tag cache

Ngày: 2026-11-25. Trạng thái: hoàn thành đủ A1–A8 (không cần tách C2b). Không migration, không đụng schema.

## Đã làm
- Setting mới (nhóm `display`, sửa trên `/settings`): `site.nav.items`, `site.socialLinks`, `site.tagline`, `site.registrationUrl` (file `packages/shared/src/public-site-display-settings.ts`); `ranking.expiringSoonDays` (nhóm `ranking`, 0–365, mặc định 30). URL chỉ https, key menu không trùng, platform trong danh sách cố định.
- `/public/site` trả thêm `display`.
- A1 `PublicEventCard.subEvents` (select lồng, một query phụ); A2 `table` trên thẻ trận và trận nhánh; A3 `competitorKind`; A4 `venue.address`, `venue.mapUrl` (chỉ https, ngược lại `null`); A5 `days`; A6 `PublicHome.heroEventSlug`; A7 `PublicPlayerProfile.record`; A8 `PublicMatchDetail.session`.
- Tag: `subEvent.*` thêm `events`; `venueTable.write` đổi context sang danh sách trận trên bàn, sinh `event/schedule/draw/groups/match` và `results-strip`.
- A7 dùng chung điều kiện với danh sách kết quả (`public-player-results-where.ts`), không nhân bản.

## Quyết định cần biết
- `table.displayName` và `session.name/nameEn` nullable (DB cho phép null); contract ghi đúng như vậy.
- `heroEventSlug`: setting ghim (giải công khai) -> giải nổi bật còn diễn ra đầu tiên -> giải còn diễn ra đầu tiên -> `null`; `null` khi `sections.hero` tắt.
- Fixture test của client (3 file) phải thêm trường mới (`table`, `days`, `competitorKind`, `venue.address/mapUrl`) vì typecheck client bắt buộc; chỉ sửa test, không sửa UI.
- Admin editor `json` cho `site.nav.items` / `site.socialLinks` / `site.tagline` chưa thân thiện: cần nửa admin làm editor riêng.
- Chưa cập nhật `docs/public-site.md`, `docs/cache-revalidation.md` (ngoài phạm vi sở hữu): docs impact minor.

## Kiểm chứng (chạy thật)
- `pnpm typecheck`: 14/14 task đạt. `pnpm lint`: 9/9 đạt.
- `@kamito/shared` test: 24 file, 116 test đạt.
- API unit (`vitest run src`, qua wrapper DB test): 35 file, 193 test đạt.
- API e2e trên `kamito_tt_phase12_test` qua wrapper, từng file: public-site 9, public-events 9, public-bracket 8, public-matches 9, public-results-strip 5, public-groups-entries 9, public-players 15, public-schedule 8, public-event-timezones 1, public-match-dst 3, public-player-names 6, public-ranking-payload 1, public-rankings 16, public-refresh-wiring 7, public-sitemap 3, venues 7, settings-replica-consistency 1, cms-resources 6, catalog-revalidation 5: tất cả đạt. Không gặp crash 0xC0000409.
- Client: 3 file test đã sửa fixture (json-ld, page-metadata, bracket-print offline) typecheck đạt; json-ld + page-metadata chạy 13 test đạt. Chưa chạy `client build` / `admin build` (tránh va chạm tiến trình dev đang chạy và nửa admin).
- `git status packages/db`: sạch, không migration.

## Sự cố trong phiên (khai thật)
Lần chạy đầu, `pnpm --filter @kamito/api test` chạy cả e2e với `DATABASE_URL` đọc từ `.env` (DB `kamito_tt_dev` tại localhost:5433), không qua wrapper. Chạy khoảng 3 phút rồi đã dừng; các spec tự tạo/dọn fixture nên có thể còn sót dữ liệu test trong `kamito_tt_dev`. Cần chủ repo xác nhận có dọn không. Từ đó mọi lệnh test API đều đi qua wrapper (xác nhận trong log: `target localhost:5433/kamito_tt_phase12_test`).

## File thay đổi
shared: `public-site-display-settings.ts` (+ test), `ranking-settings.ts`, `app-setting-registry.ts`, `index.ts`, `public-site-contract.ts`, `public-event-contract.ts`, `public-competition-contract.ts`, `public-bracket-contract.ts`, `public-content-contract.ts`, `public-ranking-contract.ts`.
api src: `public-site.query.ts`, `public-event.serializer.ts`, `public-event-detail.query.ts`, `public-match.serializer.ts`, `public-bracket.query.ts`, `public-bracket.serializer.ts`, `public-matches.query.ts`, `public-player-profile.query.ts`, `public-player-results.query.ts`, `public-player-results-where.ts` (mới), `public-content.controller.ts`, `public-home-hero.ts` (+ test, mới), `cache-tags.ts`, `venue-tables.service.ts`, `catalog-display-tags.test.ts` (mới), `revalidation-enqueue.service.test.ts`.
api test: `public-site`, `public-events`, `public-bracket`, `public-players`, `public-schedule` e2e, `support/public-api-kit.ts`.
client (chỉ fixture test): `tests/unit/json-ld.test.ts`, `tests/unit/page-metadata.test.ts`, `tests/offline/bracket-print.test.ts`.

## Câu hỏi còn mở
- Có dọn dữ liệu test còn sót trong `kamito_tt_dev` không?
- `public-content.controller.ts` đã 202 dòng (vượt 200 nhẹ, file sẵn lớn); nên tách trong phase khác?
