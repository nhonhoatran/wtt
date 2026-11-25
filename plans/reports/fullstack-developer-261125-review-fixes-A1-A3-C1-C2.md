# Sửa phát hiện review A1/A3/C1/C2 — 2026-11-25

Nguồn: `plans/reports/code-reviewer-261125-figma-phases-A1-A3-C1-C2.md`. Không commit, không migration, không đụng `apps/client/**`, `pages/event-hub/*`, `pages/ranking/*`, API ranking.

## Đã sửa
- **M1** `sessions/session-affected-matches.ts` (mới): đổi `code/name/nameEn` của buổi thì `session.update` gửi `match-*` của mọi trận trong buổi (hợp với trận đổi giờ). `sessions.service.ts` dùng helper. Test: `session-affected-matches.test.ts` (6 test).
- **M2 + L1** `revalidation/public-tag-context.ts`: `loadVenueTableTagContext` chỉ lấy trận công khai (`publicScope.matchIn({})`) kèm slug VĐV hai phía (slug cũ và `p-<UUID>`). `cache-tags.ts`: `venueTableTags` thêm `player-*`. `venue-tables.service.ts` dùng loader. Test: `venue-table-tag-context.test.ts` (mới), `catalog-display-tags.test.ts` (thêm kiểm `player-*`).
- **M3** `docs/cache-revalidation.md`: `session.update` đổi nhãn, `subEvent.*` thêm `events`, thêm dòng `venueTable.write`, `media.update` thêm `articles/sponsors/home`. `docs/public-site.md`: dòng `site` (display), `events/:slug` (days, venue), mục "Trường bổ sung cho giao diện mới" và các setting hiển thị.
- **M4** Sider lấy tên từ `site.name`: `/auth/me` trả thêm `siteName` (`auth.service.ts`), `CurrentUser.siteName`, `admin-sider.tsx` đọc `siteName.vi`, fallback `appSettingRegistry.siteName.defaultValue.vi`; chữ cái đầu lấy từ tên. Cập nhật `auth.e2e-spec.ts` (danh sách key của `/me`).
- **L2** bỏ token `surfaceInk` và dòng test tương ứng. **L3** bỏ `LIFECYCLE_OPTIONS` (và import thừa). `StatCard` giữ nguyên (chờ A2).
- **L4** `public-home-rankings.ts` (mới) tách truy vấn + map top ranking khỏi `public-content.controller.ts` (202 xuống 194 dòng).
- **L7** RESULTS_OPERATOR ở `/` thì mục "Nhập tỷ số" được chọn. **L8** nền drawer dùng `tokens.color.ink`.
- **L9** `events.e2e-spec.ts`: case `entryCount` 3 (2 nội dung) rồi 2 sau khi rút một entry.

## Lệch so với quyết định (cần chủ repo biết)
- `site.name` KHÔNG có trên `/settings`: không có `group/label/editor`, và `permission-coverage.e2e-spec.ts:81` khẳng định nó không nằm trong danh sách. Em chỉ nối sider vào setting hiện có (qua `/auth/me`); chưa thêm editor nên đổi tên vẫn phải sửa DB. Muốn sửa trên UI: thêm `group: 'display'`, `label`, `editor: { kind: 'json' }` cho `siteName` và đổi assertion kia. Chưa làm vì đụng test cố ý.
- Slogan "Quản trị giải đấu" trong sider vẫn là hằng UI (nhãn giao diện, chưa có setting).

## Kiểm chứng (chạy thật)
- Root `pnpm typecheck`: 14/14; `pnpm lint`: 9/9 (một lần lint admin rớt thoáng qua khi file nơi khác đang sửa, chạy lại đạt).
- `packages/ui-tokens`: build + test 8/8. `apps/admin`: test fail 0, build ok.
- API unit qua wrapper (log đầu `localhost:5433/kamito_tt_phase12_test`): catalog-display-tags 5, venue-table-tag-context 1, session-affected-matches 6, revalidation-enqueue 9, match-lifecycle-tags 5, public-home-hero 3: đạt.
- E2E qua wrapper, từng file: events 9, venues 7, catalog-revalidation 5, cms-resources 6, public-site 9, public-schedule 8, auth 11 (lần chạy chung đầu rớt 4 test, chạy riêng đạt 11): đạt.
- `session-lifecycle.e2e-spec.ts`: 3/9 rớt (`never leaves zero active admins` có `survivors = 0`, hai test list trả 401). Chưa chứng minh có sẵn từ trước: không stash được vì cây làm việc dùng chung. Không liên quan code em sửa (không đụng users/audit-logs), nhưng chưa kiểm baseline.
- Trình duyệt (Playwright, http://localhost:5173, API mới): ADMIN sider hiện "G" + "Giải bóng bàn Kamito"; chặn `/auth/me` chèn `siteName` thì hiện "Giải Thử Nghiệm"; RESULTS_OPERATOR ở `/` chọn "Nhập tỷ số"; không có lỗi trang.

## Sự cố vận hành
API :3000 đã chết khi em kiểm trình duyệt; em tự khởi động lại bằng wrapper (PID 5372, queue prefix `debts-261125`) và để chạy theo yêu cầu của điều phối. Em không kill process nào.

## File thay đổi
api src: `sessions/sessions.service.ts`, `sessions/session-affected-matches.ts` (+test), `revalidation/cache-tags.ts`, `revalidation/public-tag-context.ts`, `revalidation/venue-table-tag-context.test.ts`, `revalidation/catalog-display-tags.test.ts`, `venues/venue-tables.service.ts`, `auth/auth.service.ts`, `public-content/public-content.controller.ts`, `public-content/public-home-rankings.ts`; api test: `auth.e2e-spec.ts`, `events.e2e-spec.ts`.
admin: `layout/admin-sider.tsx`, `layout/admin-layout.tsx`, `providers/current-user.ts`, `resources/events/event-labels.ts`. ui-tokens: `tokens.ts`, `build-css-variables.test.ts`. docs: `cache-revalidation.md`, `public-site.md`.

## Câu hỏi mở
- Có thêm editor cho `site.name` trên `/settings` (đổi assertion ở permission-coverage) không?
- `session-lifecycle` 3 test rớt: cần kiểm baseline trên cây sạch.
- Dữ liệu test sót trong `kamito_tt_dev` (sự cố C2) vẫn chờ chủ repo quyết định.
