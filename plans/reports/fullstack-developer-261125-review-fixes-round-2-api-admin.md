# Sửa review vòng 2 (API + admin) và 2 việc client phụ thuộc API (2026-11-25)

Nguồn: `code-reviewer-261125-figma-phases-A4-A5-A10-A11-C3-C4.md`. Không commit, không migration.

## Đã sửa

**M1 (A11) "kỳ trước" một định nghĩa.**
- `apps/api/src/modules/ranking-snapshots/ranking-snapshot-previous.ts`: `findPreviousSnapshot(client, {id, rankingListId})` = snapshot PUBLISHED mới nhất của BXH, loại chính bản đang xem, sắp `asOfDate desc, publishedAt desc` (cùng thứ tự worker). Bỏ điều kiện `asOfDate < ...`. Nhận cả `PrismaService` lẫn `Tx`.
- Dùng ở `ranking-snapshots-query.service.ts` (rows), `ranking-snapshot-summary.service.ts` (không đổi code, nhận helper mới), và `ranking-snapshot-publish.service.ts` (thay truy vấn inline; hành vi publish không đổi vì bản đang publish là DRAFT).
- Worker `apps/worker/src/ranking/load-snapshot-ledger.ts` KHÔNG sửa: package khác, truy vấn đã trùng điều kiện và thứ tự. Chưa gom chung code được giữa API và worker (hai Prisma client riêng); hai nơi giữ cùng thứ tự sắp xếp, có ghi chú ở helper.
- Không thêm chặn cùng ngày (chưa có chính sách).
- e2e mới (`test/ranking-admin-snapshots.e2e-spec.ts`): bản chốt xem chính nó -> `previous` null; bản tạm cùng ngày và bản tạm lùi ngày đều trỏ về bản đã chốt; `previousRank` khác null; số dòng `filter[changed]` khớp `summary.changed`.

**M2 (A4)** `event-progress-steps.ts`: "Lịch thi đấu" chỉ `finish` khi `draws.total > 0 && draws.subEventsDone === draws.total` và đã xếp hết trận; thiếu thì `process` kèm "x/y trận". Thêm test (5 nội dung, mới bốc thăm 1, 7/7 trận đã xếp -> process, "Còn 2 bước"). Chuỗi "cả 5 bước" nay dùng `steps.length`.

**M3 (A4/A5/A6)** `use-event-progress.ts` + file mới `event-progress-signals.ts` (`watchEventDataChanges`): chỉ xét query có `queryKey[1] === eventId`; bỏ lần tải đầu (và dữ liệu đã có trong cache lúc bắt đầu theo dõi); bỏ refetch trả dữ liệu y nguyên (focus cửa sổ, nhờ so tham chiếu structural sharing); gộp cụm thay đổi trong 150ms thành một lần invalidate. Bỏ `admin-draw-view` khỏi tín hiệu (key theo drawId, không lọc được theo giải; thay đổi bốc thăm đã đi qua `drawsOverview` + `onChanged`). 4 test mới `test/event-progress-signals.test.mjs`.
- Số lần gọi lại `/progress`, mô phỏng bằng QueryClient thật (mở tab = 3 query, 2 lần focus, 1 lần ghi đổi 1 query, 1 lần `onChanged` tường minh): trước 5, sau 2 (1 từ tín hiệu ghi + 1 từ `onChanged`). Đây là mô phỏng trong script tạm (đã xóa), chưa đo trên trình duyệt.

**Low**
- `ranking-board-actions.tsx`: "Lịch sử các kỳ" dùng `navigate` trong `onClick` (hết `<a><button>`); nút "Chốt bảng kỳ này" hiện loading và không bấm được khi `summary` chưa có; hộp xác nhận dùng số liệu summary thật (bỏ fallback 0). Nếu API summary lỗi hẳn, nút ở trạng thái loading (chưa có nút thử lại riêng).
- A6 panel không mở lại sau khi đóng giữa lúc upload: `components/import-wizard.tsx` bỏ qua `onJobCreated` và setState nếu bước upload đã unmount (job vẫn được tạo phía server, xem ở trang imports).
- A6 `?import=`: `entries-import-panel.tsx` so `job.eventId` với giải đang mở; lệch thì cảnh báo "Lượt import này thuộc giải khác, đã bỏ qua." và xóa param (`restartImport` bọc `useCallback` ở `entries-tab.tsx`).
- `import-fix-hints.ts`: thêm mẫu `Trùng với một dòng khác` (thông báo bước commit của worker) + test.
- `cache-tags.ts` 214 -> 169 dòng: interface context chuyển sang `cache-tag-contexts.ts` (75 dòng), re-export type giữ nguyên import cũ. Không đổi hành vi.

**Client follow-up A (hasPublicMatches).**
- Shared: `PublicEventCard.hasPublicMatches: boolean` (`public-event-contract.ts`).
- API: `PUBLIC_EVENT_CARD_SELECT` thêm `_count.matches` lọc bằng `publicScope.matchOfEvent` (mới, cùng quy tắc `publicScope.match`: draw PUBLISHED, không BYE); serializer trả `hasPublicMatches`. Áp dụng cho list, calendar, home, detail.
- Cache: `draw.publish` và `draw.unpublish` thêm tag `events` (cờ đổi khi nhánh công bố/hủy); `docs/cache-revalidation.md` cập nhật hai dòng.
- e2e: `public-events` (CARD_KEYS có `hasPublicMatches`; giải có trận = true, giải mới tạo không trận = false); `draw-publish-edit-tags` kiểm có tag `events`.
- Client: nút "Xem lịch & kết quả" nằm ở `components/events/event-list-row.tsx`, KHÔNG phải `event-card.tsx` (card trang chủ không có nút này). Đã sửa `event-list-row.tsx` (ngoài danh sách file được phép): giải ONGOING mà `hasPublicMatches=false` thì link về trang giải với nhãn "Xem chi tiết". `event-card.tsx` không đổi. Fixture test cập nhật: `tests/offline/bracket-print.test.ts`, `tests/unit/json-ld.test.ts`, `tests/unit/page-metadata.test.ts`.

**Client follow-up B (itemsPerSection).** `PublicHome.itemsPerSection` (shared) = setting `home.itemsPerSection`; `public-content.controller.ts` trả `itemLimit`; `app/[locale]/page.tsx` dùng `home?.itemsPerSection ?? default` thay cho default registry. e2e `cms-resources`: đặt setting = 3 -> `/public/home` trả 3. `home-today-matches.tsx` không cần đổi.

## Kiểm chứng (kết quả thật)
- Root `pnpm typecheck`: 14/14 đạt. Root `pnpm lint`: 9/9 đạt.
- `packages/shared`: build ok; test 24 file / 116 test đạt.
- `apps/admin`: `pnpm test` 71/71 đạt (có 5 test mới); `pnpm build` ok.
- `apps/client`: test 29 file / 135 test đạt; `pnpm build` ok.
- API (qua `with-test-db.mjs`, log đầu `localhost:5433/kamito_tt_phase12_test`, từng file một): unit `catalog-display-tags`, `match-lifecycle-tags`, `ranking-publish-tags`, `venue-table-tag-context`, `public-home-events.query`, `public-home-hero` đạt. e2e đạt: `ranking-admin-snapshots` 5/5, `public-events` 9/9, `cms-resources` 6/6, `public-site` 9/9, `event-progress` 4/4, `entries` 20/20, `permission-coverage` 4/4, `draw-publish-edit-tags` 4/4, `cache-tags-coverage` 4/4, `public-rankings` 16/16, `public-sitemap` 3/3.
- Lần chạy đầu `ranking-admin-snapshots` rớt do assertion sai của em (đòi `changed=0` trong khi dữ liệu test đã đổi người thắng); đã sửa assertion, chạy lại đạt.
- KHÔNG chạy: Playwright / kiểm trên trình duyệt (A4, A6, A11 UI chưa xem thực tế), `pnpm test` gốc.

## Câu hỏi mở
- Có cho phép 2 snapshot PUBLISHED cùng `asOfDate` không? (chưa chặn). Nếu cho phép, `publishedAt` quyết định "mới nhất".
- Xem lại một bản đã chốt cũ: "kỳ trước" nay là bản PUBLISHED mới nhất khác chính nó (có thể là bản MỚI hơn nó), đúng quy tắc đã chốt nhưng cột "So với kỳ trước" của bản cũ đã lưu có thể khác. Cân nhắc lưu `previousSnapshotId` khi dựng bản nháp.
- Cho `event-list-row.tsx` (ngoài danh sách file) sửa như trên có được không, hay cần giao agent khác?

**Status:** DONE_WITH_CONCERNS
**Summary:** M1-M3, toàn bộ Low, tách `cache-tags.ts`, follow-up A (`hasPublicMatches`) và B (`itemsPerSection`) đã làm; typecheck, lint, test và build xanh, e2e API liên quan đạt trên DB test.
**Concerns:** Sửa thêm `event-list-row.tsx` (nơi nút CTA thực sự nằm); worker không đổi code nên "một định nghĩa" là hai bản cài đặt cùng thứ tự; chưa kiểm UI trên trình duyệt; số lần gọi progress là mô phỏng.

## Files changed
API: `apps/api/src/modules/ranking-snapshots/{ranking-snapshot-previous,ranking-snapshot-publish.service,ranking-snapshots-query.service}.ts`, `apps/api/src/modules/revalidation/{cache-tags,cache-tag-contexts}.ts`, `apps/api/src/modules/public-scope/public-scope.ts`, `apps/api/src/modules/public-events/public-event.serializer.ts`, `apps/api/src/modules/public-content/public-content.controller.ts`, tests `apps/api/test/{ranking-admin-snapshots,public-events,cms-resources,draw-publish-edit-tags}.e2e-spec.ts`.
Shared: `packages/shared/src/{public-event-contract,public-content-contract}.ts`.
Admin: `src/pages/event-hub/{event-progress-steps,use-event-progress,event-progress-signals,entries-tab,entries-import-panel}.ts(x)`, `src/pages/ranking/ranking-board-actions.tsx`, `src/components/import-wizard.tsx`, `src/resources/imports/import-fix-hints.ts`, tests `test/{event-progress-steps,event-progress-signals,import-fix-hints}.test.mjs`.
Client: `src/components/events/event-list-row.tsx`, `src/app/[locale]/page.tsx`, tests `tests/{offline/bracket-print,unit/json-ld,unit/page-metadata}.test.ts`.
Docs: `docs/cache-revalidation.md`.
