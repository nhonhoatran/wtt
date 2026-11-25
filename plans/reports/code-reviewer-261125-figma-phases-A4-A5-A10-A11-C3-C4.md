# Review phase A4, A5, A6, A10, A11, C3, C4 + follow-up site.name + review-fix M1–M4 (2026-11-25)

Phạm vi: file nêu trong báo cáo dev của từng phase (A6 được thêm vào giữa chừng theo yêu cầu điều phối). Ngoài phạm vi: C5 (danh sách/lịch giải ở client). Chỉ review tĩnh, không sửa code. Không lặp lại phát hiện của `code-reviewer-261125-figma-phases-A1-A3-C1-C2.md`.

## Kiểm chứng đã chạy
- Root `pnpm typecheck`: 14/14 task đạt (exit 0). Root `pnpm lint`: 9/9 đạt (exit 0).
- Unit theo package: admin `node --test` 65/65; client `vitest run` 28 file / 131 test; shared 24 file / 116 test; ui-tokens 8/8. Tất cả exit 0.
- KHÔNG chạy: API unit/e2e, root `pnpm test`, Playwright (đều cần DB). Vì vậy `permission-coverage.e2e-spec.ts` (assertion mới cho `site.name`) chỉ được đọc, chưa chạy.

## Tổng quan
Chất lượng tốt. RBAC trên 2 endpoint mới đúng. Step-up cho chốt BXH có ở API. Ticker không tự chạy, mỗi thẻ đúng 1 link. Lọc, tìm, phân trang đều làm ở server. vi/en đủ key (so 2 file: không lệch key). M1–M4 đã sửa thật. Không có lỗi chặn merge. Có 1 lỗi Medium đáng sửa trước khi dùng thật: hai định nghĩa "kỳ trước" khác nhau ở bảng xếp hạng.

## High
Không có.

## Medium

**M1. A11: "kỳ trước" ở API summary/rows khác "kỳ trước" mà worker và publish dùng.**
- `apps/api/src/modules/ranking-snapshots/ranking-snapshot-previous.ts:15` lấy snapshot PUBLISHED mới nhất có `asOfDate < asOf của bản này`.
- Worker tính `previousRank`/`movement` theo snapshot PUBLISHED mới nhất, không ràng buộc ngày (`apps/worker/src/ranking/load-snapshot-ledger.ts:49-53`). Publish cũng vậy (`ranking-snapshot-publish.service.ts:70-74`). Schema không cấm 2 snapshot cùng `asOfDate`.
- Tình huống lỗi:
  - (a) Sáng 25/11 chốt BXH. Chiều phát hiện sai, tạo bản tạm tính mới (mặc định `asOfDate` = hôm nay, "Tính lại ngay" cũng giữ `asOfDate`). Cột "So với kỳ trước", KPI đổi hạng và VĐV mới được tính so với bản sáng 25/11. Còn "Điểm kỳ trước", "Chênh lệch", "Điểm hết hạn trong kỳ" và phụ đề "Kỳ trước chốt ngày …" lại lấy một kỳ cũ hơn. Hai cột cạnh nhau mâu thuẫn ngay trước thao tác chốt không hoàn tác.
  - (b) Bản tạm tính lùi ngày (`asOfDate` sớm hơn bản đã chốt mới nhất): API trả `previous = null` hoặc một kỳ cũ hơn. Kết quả: mọi so sánh hiện "—", switch bị khoá, hộp xác nhận ghi "Đây là kỳ đầu tiên…", trong khi worker đã tính `movement`.
- Hướng sửa: dùng đúng một định nghĩa. Cách gọn nhất là để `findPreviousSnapshot` dùng cùng truy vấn với worker/publish, tức PUBLISHED mới nhất (với bản PUBLISHED thì loại chính nó và chỉ lấy `publishedAt < publishedAt` của nó). Cách bền hơn là worker lưu `previousSnapshotId` lên snapshot lúc dựng, API đọc lại trường đó. Nên thêm e2e cho ca cùng ngày.

**M2. A4: bước "Lịch thi đấu" báo "Đã xong" khi mới bốc thăm một phần.**
- `apps/admin/src/pages/event-hub/event-progress-steps.ts:43-44`: `finish` khi `matches.scheduled === matches.total`. Nhưng trận chỉ tồn tại sau khi bốc thăm.
- Tình huống: giải có 5 nội dung, mới bốc thăm MS và đã xếp hết trận MS. Stepper hiện "Bốc thăm: Đang làm 1/5" mà "Lịch thi đấu: Đã xong", và "Còn 1 bước chưa xong" (khi danh sách đủ).
- Hướng sửa: chỉ `finish` khi thêm điều kiện `draws.subEventsDone === draws.total`. Nếu chưa đủ thì hiện `process` kèm "x/y trận".

**M3. A4/A5/A6: progress bị gọi lại nhiều lần, không lọc theo giải.**
- `apps/admin/src/pages/event-hub/use-event-progress.ts:32-36`: mỗi lần một query thuộc `WRITE_SIGNAL_KEYS` tải xong là invalidate progress. Không xét `queryKey[1] === eventId`, không phân biệt lần tải đầu với lần làm mới sau ghi.
- Hệ quả:
  - Mở tab Nội dung thi đấu gây 3 query, kéo theo 3 lần invalidate (báo cáo A5 ghi "4 lần gọi").
  - Mỗi lần focus cửa sổ (react-query mặc định refetch khi focus), progress bị gọi dồn.
  - Sau mỗi lần ghi ở A5, `refresh()` đã gọi `onChanged()` (refetch progress) mà subscription còn invalidate thêm.
  - Mỗi lần gọi progress tốn 6 truy vấn DB.
- Hướng sửa: lọc `event.query.queryKey[1] === eventId` và `event.query.state.dataUpdateCount > 1` (bỏ lần tải đầu), hoặc bỏ subscription và gọi invalidate progress ngay trong các handler ghi.

## Low
- **A11** `ranking-board-actions.tsx:92`: `<Link><Button>` lồng phần tử tương tác, tức `<a><button>` (axe `nested-interactive`). Nên dùng `navigate` trong `onClick` hoặc `<Button href>`.
- **A11** `ranking-board-actions.tsx:64-66`: bấm "Chốt bảng kỳ này" khi summary còn đang tải thì hộp xác nhận ghi "0 VĐV đổi hạng" hoặc "kỳ đầu tiên". Nên khoá nút khi `summary` chưa có.
- **A6** `entries-tab.tsx:36,105` + `components/import-wizard.tsx:33`: đóng panel lúc đang upload thì upload vẫn chạy. Xong, `onJobCreated` ghi lại `?import=` và panel tự mở lại. Báo cáo dev đã nêu. Nên khoá nút đóng khi đang upload, hoặc bỏ qua `onJobCreated` sau khi đã đóng.
- **A6** `?import=` không đối chiếu `job.eventId` với giải đang mở. Một URL sửa tay sẽ hiện và cho commit job của giải khác dưới tên giải này (dữ liệu vẫn vào đúng giải của job). Nên hiện cảnh báo hoặc 404 khi `job.eventId !== event.id`.
- **A6** `resources/imports/import-fix-hints.ts:15`: đã đối chiếu với thông báo thật của worker. Các mẫu ở bước kiểm tra đều khớp. Thông báo ở bước commit `"Trùng với một dòng khác trong file…"` (`apps/worker/src/import/commit-row.ts:95`) không khớp `/Trùng với dòng/`. Regex dựa vào câu chữ, đổi chữ là mất gợi ý mà test không báo. Nên chuyển sang mã lỗi (Q5), hoặc thêm test dựng thông báo từ hằng dùng chung với worker.
- **A6**: import xong chỉ refetch đếm và danh sách của tab, không gọi `onChanged` của hub. Vì vậy cache `events` list (số đăng ký ở danh sách giải) chưa được invalidate cho tới lần tải sau.
- **A4** `event-progress-steps.ts:67`: chuỗi "cả 5 bước" viết cứng. Thêm bước (A9) là sai, nên dùng `steps.length`.
- **A4** `event-progress-stepper.tsx:28`: `aria-label` trên `div` của Card không có `role`, nên trình đọc màn hình bỏ qua. Nên thêm `role="region"`. `event-hub-actions.tsx:67`: tooltip bọc nút disabled trong `span` không focus được, người dùng bàn phím không thấy lý do (đã có `aria-label`, ảnh hưởng nhỏ).
- **A4** `use-event-progress.ts`: `retry: false` và stepper trả `null` khi lỗi. Lỗi progress làm stepper biến mất lặng lẽ, không có nút thử lại.
- **A4** `api/public-site-url.ts:4`: locale `vi` viết cứng. Nên lấy từ runtime config (`PUBLIC_SITE_DEFAULT_LOCALE`), hoặc bỏ segment để site tự điều hướng theo cookie/Accept-Language.
- **A10** `ranking-rules-state.ts:53`: client không chặn trần, trong khi API có `MAX_POINTS = 1_000_000` (`ranking-rule-dtos.ts:12`). Nhập quá trần thì chỉ biết lỗi lúc lưu. `ranking-rules-matrix-page.tsx:40` ép kiểu `as unknown as` khi đọc `colorHex`, nên khai kiểu `CatalogRow` cho event-types.
- **A10** `ranking-validity-card.tsx:12-17`: không lọc `isActive`, nên BXH đã ẩn vẫn hiện. Có thể là chủ ý, cần xác nhận.
- **C3**: `site.name` giờ sửa được trên `/settings`, nhưng wordmark vẫn là `KAMITO` cứng (`site-header.tsx:24`, `site-footer.tsx:29`, Q11). Đổi tên site thì chữ hiển thị và `aria-label` lệch nhau (WCAG 2.5.3 label-in-name nếu tên mới không chứa "Kamito").
- **C3** `footer-social-links.tsx:19`: schema cho phép trùng `platform` (tối đa 8 mục, chỉ có 5 nền tảng), dẫn tới trùng React key. Nên thêm `refine` không trùng như `navItems`, hoặc dùng key theo index.
- **Follow-up site.name**: editor `json` bắt người dùng gõ `{"vi":"…","en":"…"}`, không thân thiện (luật UI). Sider admin chỉ đổi tên sau khi `/auth/me` tải lại. `docs/public-site.md:158` chưa nhắc `site.name` thuộc nhóm `display`.
- **C4**: báo cáo dev ghi "`EventCard` thêm `compact`", nhưng code hiện tại không có prop `compact`. Card bỏ banner cho mọi nơi gọi, và hiện chỉ trang chủ dùng (C5 chuyển danh sách sang `EventListRow`). Không lỗi, chỉ là báo cáo lệch code. Tên truy cập của link thẻ dài (hạng giải, trạng thái, ngày, tên, nơi, toàn bộ chip, "Xem chi tiết"), nên cân nhắc `aria-labelledby` trỏ vào tên giải.

## Kiểm M1–M4 (review-fix)
- M1 đã sửa: `sessions/session-affected-matches.ts` + `sessions.service.ts`. Đổi nhãn buổi thì gửi `match-*` của mọi trận trong buổi.
- M2 đã sửa: `loadVenueTableTagContext` chỉ lấy trận công khai, gửi `event/schedule/draw/groups/match/player-*` và `results-strip`. Tag được khử trùng ở `revalidation-enqueue.service.ts:26`.
- M3 đã sửa: `docs/cache-revalidation.md:87,91,95,96` khớp code.
- M4 đã sửa: `/auth/me` trả `siteName`, sider đọc `siteName.vi` có fallback. Follow-up thêm `group/label/editor` cho `site.name` và đổi assertion `permission-coverage.e2e-spec.ts:81` (chưa chạy e2e).

## Mục đã kiểm, không thấy vấn đề
- RBAC: `GET admin/events/:id/progress` dùng `tournaments.read`, khác số segment với `:id` nên không đụng route. `GET admin/ranking-snapshots/:id/summary` dùng `rankings.read`. `publish` có `@RequireStepUp()`, và UI xác nhận trước rồi mới tới step-up.
- Dữ liệu công khai: C3/C4 không thêm trường public mới, chỉ dùng `display`, `/home`, `/events/:slug`, `/matches`. `socialLinks` và `registrationUrl` qua `httpsUrlSchema`. Setting display đi qua `settings.update`, làm mới tag `settings`, và client `getSiteConfig` gắn tag `settings`.
- Ticker: không có `animation`, cuộn ngang native kèm scroll-snap. Mỗi thẻ 1 `Link` có `aria-label`, tên VĐV là chữ thường. Có `:focus-visible` ở header, footer, strip.
- Server-side: tìm theo CLB/mã (entries, ranking rows), `filter[changed]`, phân trang `useTable` đều làm ở server. `pointsIn` dùng PK `(snapshotId, playerId)`.
- File > 200 dòng: `cache-tags.ts` 196 → 214 (M2 làm vượt, nên tách bảng tag theo nhóm). Ba file e2e cũng vượt (`entries` 316, `public-players` 275, `events` 212), nhưng là file test.
- Mục đã biết, đồng ý giữ: `/public/home` chưa trả `home.itemsPerSection`; cột Thể thức của A5 chưa có tham số bảng.

## Việc nên làm (theo thứ tự)
1. Sửa M1: thống nhất định nghĩa "kỳ trước" và thêm e2e cho ca cùng ngày và ca lùi ngày.
2. Sửa M2: thêm điều kiện bốc thăm xong cho bước Lịch.
3. Sửa M3: lọc subscription theo `eventId` và bỏ lần tải đầu.
4. Sửa các mục Low về a11y (`<a><button>`, khoá nút chốt khi chưa có summary) và về import (panel tự mở lại, đối chiếu `eventId`).
5. Tách `cache-tags.ts` cho dưới 200 dòng.

## Câu hỏi mở
- Có cho phép 2 snapshot PUBLISHED cùng `asOfDate` cho một BXH không? Nếu không, nên chặn ở API thay vì chỉ sửa định nghĩa "kỳ trước".
- Card thời hạn hiệu lực có nên ẩn BXH đã tắt không?
- `PUBLIC_SITE_URL` + locale: site công khai có cần locale mặc định cấu hình được không?

**Status:** DONE_WITH_CONCERNS
**Summary:** Typecheck, lint và unit (admin, client, shared, ui-tokens) đều xanh. Không có High. Có 3 Medium: định nghĩa "kỳ trước" lệch giữa API A11 và worker/publish; bước Lịch báo xong sớm; progress bị gọi lại thừa. M1–M4 của lượt trước đã sửa thật.
**Concerns:** API e2e (gồm assertion `site.name` mới) và Playwright chưa chạy vì cấm đụng DB. M1 cần quyết định có cho phép chốt 2 kỳ cùng ngày không.
