# Project Changelog — Kamito

> Cập nhật: 2026-11-16. Mục mới nhất ở trên. Trạng thái commit ghi theo lịch sử git tại ngày cập nhật. Dòng "chưa commit" trong các mục cũ là trạng thái tại thời điểm mục đó được viết.
> Lộ trình và trạng thái phase: [development-roadmap.md](./development-roadmap.md).

## 2026-11-16 — Phase 09: màn admin xếp hạng (chưa commit)

Phần này nằm trong working tree, chưa commit. Lõi phase 09 (`packages/ranking-engine`, migration `20261113091254_add_ranking_lists_and_rules`, `20261113091336_add_ranking_ledger_and_snapshots`, API nền) đã có trong git từ `b59fffb`..`478ad88`. Mục này chỉ ghi phần admin và thay đổi API nhỏ thêm vào.

### Thêm
- **Nhóm menu Xếp hạng** (resource `rankings`, bốn màn):

| Màn | Đường dẫn | Nội dung |
|---|---|---|
| Bảng xếp hạng | `/ranking-lists` | Tạo, sửa, lọc, ẩn/hiện. Để trống thời hạn thì dùng `ranking.defaultValidityDays` |
| Quy tắc điểm | `/ranking-rules` | Ma trận điểm theo nội dung và vòng. Lưu thành phiên bản có ngày áp dụng. Xem phiên bản cũ ở chế độ chỉ đọc. Sao chép cột. Xem ảnh hưởng trước khi lưu. Chặn rời trang khi còn thay đổi chưa lưu |
| Sổ điểm | `/ranking-points` | Lọc theo bảng, VĐV, giải, nguồn, hiệu lực. Thêm và xóa điểm thủ công (cần step-up) |
| Kỳ chốt | `/ranking-snapshots`, `/ranking-snapshots/:id` | Tạo bản nháp, xem trước (bảng hạng, biến động, chi tiết điểm), tính lại, xóa nháp, công bố (cần step-up, không sửa được sau khi công bố) |

- **Tab Nội dung thi đấu:** cột và ô "Bảng xếp hạng" trong form sửa và tạo hàng loạt. Tự điền khi chỉ có đúng một bảng khớp giới tính và nhóm tuổi của nội dung.
- **Wizard bốc thăm, bước Hạt giống:** nút "Gợi ý theo BXH" mở modal xem trước hạt giống theo bảng đã công bố. Nút tắt khi nội dung chưa gắn bảng, và tắt ở vòng loại vì gợi ý chỉ áp cho nhánh chính.

### API
- Response thêm field, field cũ giữ nguyên:
  - Nội dung thi đấu: `rankingList: { id, code, name } | null`. `discipline` có thêm `competitorKind`, `genderRule`.
  - Bảng xếp hạng: `category: { id, code, name } | null`.
  - Sổ điểm: `subEvent: { id, code, name } | null` (dòng thủ công là `null`).
  - Kỳ chốt (list và detail): `publishedBy: { id, name } | null`. `publishedById` giữ nguyên. Người dùng đã bị xóa thì `null`.
- Audit danh mục: update ghi quan hệ ở cả `before` và `after` cùng dạng (ví dụ `before.tier = {id, code}` ở `eventType.update`, `category` ở `ranking.list.update`). `remove()` đọc `existing` với cùng `include`.
- "Hôm nay" của xếp hạng lấy từ `rankingToday()` (`apps/api/src/modules/ranking-jobs/ranking-today.ts`), theo `event.defaultTimezone`, không theo UTC của server. Dùng cho `asOf` mặc định của ma trận, ngày ghi nhận mặc định của điểm thủ công, lọc còn hạn của sổ điểm, và `asOfDate` mặc định khi dựng bản nháp.
- Hằng dùng chung trong `@kamito/shared` (`ranking-limits.ts`): `RANKING_REASON_MIN_LENGTH` (3), `RANKING_REASON_MAX_LENGTH` (500), `RANKING_NOTE_MAX_LENGTH` (500). API DTO và form admin cùng dùng.

### Quyết định
- Không tạo phiên bản quy tắc có ngày áp dụng trước hôm nay. Admin chặn ở ô ngày. API hiện chưa chặn (xem Còn mở).
- Không ghi nhận điểm thủ công hay chốt kỳ chốt với ngày tương lai. Admin chặn ở form điểm và hộp dựng bản nháp. API hiện chưa chặn.
- "Tính lại ngay" ở trang xem trước dựng lại bản nháp qua `POST /admin/ranking-snapshots/drafts`, không gọi `POST /admin/ranking/recompute`. Endpoint đó cần `subEventId` hoặc `eventTypeId`, còn chi tiết kỳ chốt chỉ trả số nội dung chưa tính lại, không trả id.
- Admin không dùng `useBlocker` vì app dùng `BrowserRouter`. Chặn rời trang nằm trong `ranking-rules-unsaved-guard.ts`. Nút Back của trình duyệt chưa chặn được.

### Kiểm chứng
- API unit và e2e: 91 file, 571/571 test, exit 0, trên DB dev local (`localhost:5433/kamito_tt_dev`). Chạy lại toàn bộ sau vòng sửa review và browser test (2026-11-16 17:3x): 91/91 file, 571/571 test, exit 0.
- `packages/ranking-engine`: 36/36 test. Statements, functions, lines 100%. Branches 98,09%.
- Typecheck và lint đạt: api, admin, worker, ranking-engine.
- Admin chưa có unit test. Màn mới kiểm bằng typecheck, lint và trình duyệt (7 luồng, không có lỗi runtime ở trang mới). Chưa thử gợi ý hạt giống ở wizard vòng loại trên trình duyệt.
- Sửa theo code review: H1 và M1–M5, M7, L9 đã có trong code; M6 mới sửa phía API và nút "Hiện hành" (phần còn lại xem Còn mở).
- Sửa theo browser test: B1 (Enter trong hộp lưu quy tắc không còn lưu luôn, bỏ `Form onFinish`), B4 (breakdown điểm thủ công ở kỳ chốt có nhãn "Điểm thủ công"), B6 (form điểm thủ công điền sẵn bảng đang lọc).
- Báo cáo: `plans/reports/tester-261116-phase-09-ui-and-api-changes.md`, `code-reviewer-261116-phase-09-ui.md`, `ui-browser-test-261116-phase-09-ranking.md`, `ui-verifier-261116-phase-09-pages.md`, `ui-verifier-261116-phase-09-calibration.md`.

### Còn mở
- **Ràng buộc ngày chỉ có ở admin:** API chưa kiểm `effectiveFrom`, `earnedAt`, `asOfDate`. Cần thêm kiểm ở API trước khi coi là quy tắc.
- **Múi giờ phía admin (review M6):** ngày mặc định của điểm thủ công và kỳ chốt, cùng tag "Hết hạn" ở sổ điểm, vẫn dùng `dayjs()` theo máy. Nút "Hiện hành" và chế độ sửa đã không còn dựa vào ngày máy.
- **Nhãn và hiển thị (phần lớn có từ trước):** toast Refine ra `ranking-lists.ranking-lists` (`apps/admin/src/i18n/vi.ts:43`, ảnh hưởng mọi danh mục); để trống "Thứ tự hiển thị" thì lưu `0` và bảng xếp đầu danh sách; ở 375px nút menu đè tiêu đề và link quay lại.
- **Kiểm thử:** admin chưa có unit test. Chưa có test cho user đã xóa trong `publishedBy` và cho nội dung bị xóa trong sổ điểm. `packages/ranking-engine` còn 2 nhánh chưa phủ (`src/stage-code-rows.ts:19`, `src/stage-reached.ts:19`). Lần chạy full đầu tiên bị dừng giữa chừng, nguyên nhân chưa rõ, lần chạy lại sạch.
- **Chờ:** G2 (BTC trả lời quy chế điểm) và deploy staging. Xem [development-roadmap](./development-roadmap.md).

## 2026-11-15 — Phase 08: hoàn tất nợ code còn lại (đã commit)

Commit triển khai: `a26f833` — `feat(public): complete schedules and resolve public site review debts`.

- Sửa timezone/DST bằng SQL phía server trước phân trang; chuẩn hóa tên công khai và sort đơn/cặp theo tên hiển thị. Migration `20261115032757_add_player_public_name_key` đã review/áp dụng DB dev local, 16/16 migration; staging chưa.
- Bộ lọc ngày dùng input có min/max, bỏ giới hạn 62 ngày; trạng thái trận tự chọn nhóm có dữ liệu. Home typed status và tách contract sự kiện/thi đấu, giữ tương thích import.
- Cache JSON/tag và rate limit Redis chung, generation fence; API settings đọc DB, không còn RAM riêng. Hai Next production local đã kiểm invalidation và hạn mức dùng chung.
- Kiểm local cuối: 41 unit client; full Playwright 51 đạt/7 bỏ qua; 6 ca mới chạy production JavaScript bật đạt; build/typecheck/lint đạt, API tổng hợp 50 ca/8 file đạt. Ghi rõ lượt focused dev từng navigation lặp, chưa khẳng định nguyên nhân; không thay thế bằng test tắt JavaScript.
- Còn staging/M1/M2 và preflight/header trust trên hạ tầng thật. Báo cáo `plans/reports/tester-261115-phase08-remaining-debts.md` và các báo cáo chuyên phần liên kết trong đó.

## 2026-11-15 — Phase 08: rà ghi nợ review cũ (chưa commit; trạng thái tại lượt rà trước)

- Đối chiếu review lát cắt và đợt 1–3 với code hiện tại. Nguồn mới: `plans/reports/reviewer-261115-phase08-review-debt-audit.md`; giữ các báo cáo cũ làm lịch sử.
- Sửa chuẩn hóa IP, bộ đếm theo IP, redirect locale, payload CSP sai kiểu; cô lập settings trong test. Nav có trạng thái hiện tại, 404 theo locale, badge LIVE dùng chung, canonical năm lịch và nhãn cột điểm đúng; bỏ query stage mặc định khỏi cached fetch.
- Không gộp toàn bộ ô nhánh/thẻ trận; giữ select GET, timeout env bootstrap và hằng bảo vệ có lý do. Đối chiếu tương phản nút vé đạt cho cỡ chữ lớn hiện tại.
- Còn mở: timezone/DST, tìm/sort tên công khai, bộ lọc tối đa 62 ngày, staging/edge và nhiều replica. Kết quả kiểm chứng cuối nằm trong báo cáo; không tuyên bố đã đóng mọi ghi nợ.
- Kiểm chứng cuối: unit client 20/20; toàn bộ Playwright 45 đạt/7 bỏ qua theo viewport/0 lỗi, có rate limit HTTP thật; client build/typecheck/lint src/tests/config đạt. Validator mã URL shared 2 ca và API parser 6 ca đạt. Báo cáo `plans/reports/tester-261115-phase08-review-debts.md`.

## 2026-11-15 — Phase 08: lịch công khai theo session/bàn và bản in lịch (đã commit `a26f833`)

- Thêm `GET /public/events/:slug/schedule?session&table`, hợp đồng `PublicSchedule` dùng chung. Chỉ hiển thị trận thuộc giải và draw công khai; bỏ BYE và ô không có trận công khai. Bộ lọc dùng mã session/bàn, không dùng ID nội bộ.
- Tab Thông tin có lịch SSR vi/en, form GET, giờ theo múi giờ giải, tên VĐV/CLB, trạng thái/kết quả và liên kết trang trận. Tab vẫn có lịch khi không có rich text.
- Bản in dùng lịch đang lọc: mỗi session/bàn mở trang dọc riêng, lặp ngữ cảnh trong đầu bảng khi dài, xuống dòng tên VĐV. Nút in chỉ mở hộp thoại trình duyệt.
- Cache lịch gắn tag `schedule-<slug>` và `event-<slug>`; không đổi schema/migration.
- Kiểm chứng: typecheck và lint client đạt; API typecheck đạt. API tích hợp đạt: 24 ca hồi quy, 18 ca lịch/cache và 11 ca sau cập nhật mutation map; Playwright lịch 5 đạt/1 bỏ qua PDF mobile; client build/typecheck/lint đạt. Lỗi kết nối local ban đầu đã xử lý bằng cách bật dịch vụ dev. Chưa deploy staging, M1/M2 còn mở. Chi tiết và cập nhật kiểm chứng tiếp theo: [public-site](./public-site.md).
- Review 9,5/10, không còn critical/high/medium sau sửa tag đổi tên bàn và địa điểm riêng session. PDF thường 1 trang, lịch dài 3 trang đều giữ ngữ cảnh. Lượt toàn bộ có 2 lỗi locator mới, đã sửa và chạy lại riêng lịch đạt; chưa báo toàn bộ suite xanh sau sửa. Báo cáo: `plans/reports/{reviewer,tester}-261115-phase08-public-schedule.md`.

## 2026-11-14 — Đóng ghi nợ review (c449c75..608d948)

Commit trong ngày, từ `c449c75` đến `608d948` (6 commit): `c449c75`, `a7bc837`, `c966728`, `a80dfb2`, `865ff1e`, `608d948`.

### Sửa
- **Tag revalidate cho nhánh** (`a80dfb2`): `draw.publish`, `draw.unpublish`, `draw.postPublishEdit` gửi thêm tag `match-*` của trận trong nhánh. Rút và thay entry sau công bố gửi thêm tag `player-*` của VĐV cũ và mới. `place-qualifiers` và `place-group-qualifiers` trên nhánh MAIN đã công bố gửi `draw.placeQualifiers` (trước đó nhãn coverage ghi `none`, sai với code).
- **Thể thức thống nhất** (`a80dfb2`): `pickMatchFormat` là nguồn duy nhất cho `confirm`, thời lượng xếp lịch và BXH bảng (L8). Engine `scoreMatch` nhận thể thức theo từng trận.
- **Kiểm draw khi import** (`c966728`): `assertNoLockedDraw` chạy lại trong transaction của từng lô, dưới khóa SubEvent (L6 phase 05 và 06). Draw công bố giữa hai lô thì lô sau bị từ chối, lô trước vẫn giữ.
- **URL revalidate** (`c966728`): `revalidateUrl()` giữ path con của `CLIENT_INTERNAL_URL` (L11).
- **BXH bảng, ván dở cuối** (`c449c75`): ván dở cuối của `RETIRED` và `DISQUALIFIED` không tính là ván thắng, khớp `validateMatchScore`.
- **Picker giải tìm kiếm phía server** (`608d948`): ô tìm giải gửi `q` lên API thay vì lấy 100 giải rồi lọc ở client (L13). Dùng chung hook debounce `SEARCH_DEBOUNCE_MS`.

### Giữ cứng có chủ đích
- L12: timeout enqueue, số lần thử và backoff của revalidate được định nghĩa một lần trong `packages/shared/src/revalidate-job-options.ts` (`a7bc837`). `MATCH_WRITE_TIMEOUT_MS`, `SCHEDULE_TX_TIMEOUT_MS` và `SEARCH_DEBOUNCE_MS` giữ cứng, có comment ghi lý do: đây là hằng độ tin cậy nội bộ, không phải tham số nghiệp vụ hay vận hành, nên không đưa lên `/settings`.

### Kiểm thử (`865ff1e`)
- E2e mới: RETIRED có ván dở và Redis tắt trả 200 kèm `PUBLIC_REFRESH_DELAYED` (`match-retired-format-and-redis-down.e2e-spec.ts`); draw công bố giữa lúc import (`imports-worker.e2e-spec.ts`); tag khi công bố, thay và rút entry (`draw-publish-edit-tags.e2e-spec.ts`).
- Các spec đọc hàng đợi revalidate dùng `apps/api/test/support/revalidate-queue-probe.ts`: chỉ đọc 300 job mới nhất của mỗi trạng thái, và xóa job do chính spec tạo.
- Số liệu chạy đầy đủ (đã dừng dev worker): API e2e 67/67 file, 420 test; API unit 125; engine 230; worker 39; shared 97; typecheck + lint 18/18. Một lần crash native `0xC0000409` trên Windows làm rớt một chunk vitest, đã chạy lại chunk đó.
- E2e phải chạy khi đã dừng dev worker, vì worker dev sẽ lấy job import của test.

### Chưa làm và còn mở
- Deploy staging và đo; G1b; file xlsx do Excel thật lưu; mục thiết kế UI (màu focus, chữ "session", nhảy 76 px khi mở hộp thoại, cảm biến bàn phím cho kéo thả); e2e chuỗi Q → BYE → R2 khi reopen (hiện chỉ unit).
- `CHECK_DEBOUNCE_MS` (400 ms, ô kiểm slug, `apps/admin/src/components/slug-input.tsx`): giữ cố định, có comment lý do (chi tiết cảm giác gõ của một ô nhập, không phải tham số nghiệp vụ/vận hành).

## 2026-11-14 — Phase 07 đợt 2: lịch, session, sửa và mở lại tỷ số, revalidate mọi route ghi (đã commit)

Commit trong ngày, từ `4cdfa23` đến `00eb3e3` (16 commit): `4cdfa23`, `dba2f2f`, `fc73052`, `6a91d27`, `2244f18`, `4c7124b`, `3e068d8`, `a356255`, `f3c78ce`, `4fb7505`, `07f2500`, `3853154`, `8173f28`, `856cac9`, `d0b8e8a`, `00eb3e3`.

### Thêm
- **Lịch thi đấu** (`4c7124b`, `f3c78ce`, `856cac9`): model `EventSession` và `EventSessionTable`, cột lịch của `Match` (`sessionId`, `tableId`, `orderInSession`, `scheduledAt`, `scheduleVersion`). Migration `20261114064027_add_sessions_and_match_scheduling`, `20261114071907_add_match_schedule_indexes`. API: CRUD session, `PATCH /admin/matches/:id/schedule`, `GET /admin/events/:eventId/match-sheets`, `GET /admin/exports/schedule` và `GET /admin/exports/results` (xlsx). Chi tiết: [scheduling](./scheduling.md).
- **Sửa và mở lại tỷ số** (`3853154`, `4fb7505`, `3e068d8`): `un-start`, `save-progress`, `amend-scores`, `reopen-preview`, `reopen` (có step-up; `force` chỉ ADMIN và cần `expectedBlockingIds`). Hàm thuần `computeReopenImpact` và `validateProgressGames` trong `@kamito/competition-engine`. Audit: `match.unStart`, `match.saveProgress`, `match.amend`, `match.reopen`, `match.forceReopen`, `match.resetByReopen`. Chi tiết: [match-results](./match-results.md).
- **Revalidate cho mọi route ghi** (`4cdfa23`, `dba2f2f`, `fc73052`, `07f2500`, `2244f18`): `ROUTE_TAG_RULES` (`route-tag-coverage.ts`) có 93 dòng, mỗi route ghi `/admin` một dòng. Test `cache-tags-coverage.e2e-spec.ts` kiểm. Import worker gửi tag sau commit. `POST /admin/events/:id/revalidate` cho nút "Làm mới trang công khai". Job chia lô 200 tag. Chi tiết: [cache-revalidation](./cache-revalidation.md).
- **Cảnh báo ghi ở admin** (`6a91d27`): `apps/admin/src/api/write-warnings.ts` (`showWarnings`, `warningsOf`).
- **Shared** (`a356255`, `4cdfa23`): `MATCH_REASON_MIN_LENGTH` (3), `MATCH_REASON_MAX_LENGTH` (500); setting `schedule.minRestMinutes` (20) và `schedule.sessionMatchCap` (500); `revalidateTagsJob`, `revalidateTagsJobs`, `REVALIDATE_ENQUEUE_TIMEOUT_MS`, `withTimeout`, `entryChangeTags`.
- **Admin** (`856cac9`, `3853154`): tab "Lịch & kết quả" (session, lưới xếp lịch bằng hai cú bấm hoặc kéo thả, panel trận chưa xếp), trang in phiếu trận `/events/:id/print/match-sheets`. Màn nhập tỷ số có nút "Hủy bắt đầu", "Lưu tạm", modal sửa tỷ số và modal xem trước mở lại, nhớ lựa chọn session, bàn và trạng thái. Dùng chung: `components/sortable-list-field.tsx`, `components/use-debounced-value.ts`.
- **Lỗi tranh chấp** (`4fb7505`): Prisma `P2034`, Postgres `40P01` và `40001` đổi thành 409 `CONCURRENT_UPDATE_RETRY` trong filter lỗi chung.

### Thay đổi
- Filter lỗi giữ thêm hai khóa chi tiết: `preview`, `dirtySubEvents` (`DETAIL_KEYS`).
- Mở lại trận bảng gỡ mọi suất của bảng đó khỏi nhánh chính. Đây là chủ ý, và xem trước nêu rõ điều này.
- Khóa "đã xếp vào nhánh" theo từng bảng (`isGroupPlaced`, `groups-placed-guard.ts`): mở lại một bảng không mở khóa các bảng khác.
- Ô nhánh đã có VĐV giữ `sourceRef` (`draw-position-io.ts`), để nhãn suất vòng loại hoặc bảng gốc vẫn hiện.
- `AuthGate` của admin: chỉ 401 mới đăng xuất, lỗi khác hiện nút "Thử lại" (`8173f28`).
- Danh sách tiêu chí xếp hạng dùng chung `SortableListField` (`856cac9`).
- Sửa theo lần kiểm: nhóm bốc thăm không còn crash khi bốc (`8173f28`), session giữ lại khi server lỗi, step-up hiện trên dialog; căn lại nhãn và form danh mục (`d0b8e8a`).

### Breaking và lưu ý cấu hình
- Không có biến môi trường mới. Không có breaking change với phase 06.
- Migration chỉ thêm bảng, cột và index.
- Route mở lại tỷ số cần nhập lại mật khẩu trong `auth.stepUp.ttlMinutes` (mặc định 5 phút).
- Mọi route ghi `/admin` mới phải có dòng trong `ROUTE_TAG_RULES`, nếu không test e2e rớt.

### Chưa xong
- Lịch công khai (`GET /public/events/:slug/schedule`) và bản in lịch cho khách: thuộc phase 08.
- `place-qualifiers` và `place-group-qualifiers` không gửi tag. Nhãn coverage ghi "draft only", nhưng code cho chạy trên nhánh MAIN đã công bố. Xem [cache-revalidation](./cache-revalidation.md#khe-hở-đã-biết).
- Các mục giao diện trong `plans/reports/ui-verifier-261114-phase-07.md`: nhãn session thiếu ngày, panel chưa xếp báo "đã xếp hết" khi đang lọc, kéo thả chưa có bàn phím, trang in chưa có nút thử lại.
- Chưa chạy trình duyệt với API thật (cỡ lưới, A4, focus, tương phản).
- Chưa deploy staging.

### Sửa theo review
- Review lịch `plans/reports/reviewer-261114-phase07-scheduling.md` (14:14, viết trước các sửa): 7/10, 0 Critical, 2 High, 6 Medium, 7 Low. Đối chiếu code lúc viết mục này, các mục H1, H2, M1 đến M6 đã có trong code: bỏ xếp không bị chặn bởi trạng thái nhánh, giải phóng ô khi void, bỏ công bố và dựng lại; tính lại giờ bằng một câu UPDATE, timeout 30 giây; tag `draw-*` và `groups-*` khi đổi lịch; `40P01` đổi thành 409; `expectedOccupantId`; quy đổi session khi đổi múi giờ. Chưa có báo cáo review sau sửa.

### Kiểm chứng
- Lần cập nhật docs này chưa chạy lại test. Số liệu test lấy từ báo cáo `plans/reports/reviewer-261114-phase07-scheduling.md` (chạy trước sửa): `tsc` pass; 26/26 test lịch trên Postgres local.
- Báo cáo UI `plans/reports/ui-verifier-261114-phase-07.md` đọc code, không chạy trình duyệt.
- Tài liệu: đối chiếu từng route, DTO, mã lỗi, quyền và setting với code (nguồn ghi trong từng doc). Link nội bộ của các doc đã sửa được kiểm bằng script.

---

## 2026-11-14 — Phase 08: site công khai, đợt 1 đến 3 (đã commit)

### Thêm
- API public: `events`, `events/calendar`, `events/:slug`, `events/:slug/info`, `events/:slug/matches`, `events/:slug/matches/:matchNo`, `events/:slug/groups/:subEventCode`, `events/:slug/entries/:subEventCode`, `results/strip`, `site`, `sitemap`. Module `public-events` và `public-competition`. Chi tiết: [public-site](./public-site.md#api-công-khai).
- Client: danh sách giải, lịch giải, trang giải 6 tab (`EventShell`), trang trận, trang chủ tạm, header, footer, dải kết quả, chọn ngôn ngữ, `proxy.ts` (chuyển hướng locale, chặn `/api/revalidate` theo Host, rate limit).
- Client: `lib/public-query.ts`, `lib/page-metadata.ts`, `lib/public-data.ts`, `lib/public-rate-limit.ts`, `lib/site-name.ts`, `app/sitemap.ts`, `app/robots.ts`, `app/api/csp-report/route.ts`.
- In: `@media print` toàn site; `@page bracket` (khổ ngang) cho nhánh đấu.
- Setting mới: `header.resultsStrip.limit` (10), `public.listPageSize` (24), nhóm "Truy cập site công khai" với `public.rateLimit.windowSeconds` (60), `maxRequests` (600), `searchMaxRequests` (60), `maxTrackedIps` (100 000).
- CSP `Content-Security-Policy-Report-Only` (`apps/client/next.config.ts`), báo cáo gửi về `/api/csp-report` (tối đa 8 KB mỗi báo cáo, 30 log mỗi phút).
- Playwright: `apps/client/playwright.config.ts`, `tests/e2e/` (`event-pages.spec.ts`, `site-chrome-and-seo.spec.ts`, global setup và teardown), seed `apps/api/test/playwright/` dùng `setupPublicWorld`.

### Thay đổi
- Tên site lấy từ `GET /public/site`, fallback về default của registry khi API lỗi. Trước đó chỉ dùng default.
- Rate limit công khai đặt ở `proxy.ts` của client (bộ đếm trong bộ nhớ, một instance). API không có rate limit công khai.
- Sitemap và robots sinh lúc chạy (`force-dynamic`), không lúc build.
- Cache công khai: query lạ không đi vào URL gọi API có cache. Trang có `q` dùng policy `none`.
- Theme thêm `lineStrong`, `textMuted`, `textSubtle`. Màu xám viết tay trong `components/bracket`, `components/events`, `components/common` đã thay bằng token.
- Chuyển hướng `/` theo locale nằm ở `proxy.ts`. Đã bỏ redirect `/` trong `next.config.ts`.
- Tài liệu: `system-architecture.md` rút phần site công khai, chi tiết chuyển sang `public-site.md`.

### Chưa xong
- Lịch theo session và bàn, bản in lịch: chờ `EventSession` của phase 07.
- Mốc M1 (deploy staging) và M2 chưa đạt.
- Tag `events` chưa được mutation nào gửi. Bỏ công bố giải, hủy giải, sửa entry hoặc VĐV chưa có tag riêng. `group-qualifier.service` chưa kiểm có gửi tag khi sửa nhánh MAIN đã công bố.
- Rate limit và cache theo instance. Cần cache handler dùng chung và bộ đếm dùng chung trước khi scale.
- Traefik: `forwardedHeaders` và quy tắc chặn `/api/revalidate` chưa kiểm trên staging.
- Chưa chốt: render `infoBody` công khai (API đã sanitize lại khi trả; client chưa sanitize).
- `API_FETCH_TIMEOUT_MS` còn ở env, chưa ở `/settings`.
- Nav chính chưa có `aria-current`. Tab Trận chọn nội dung bằng `<select>`. Nút "Mua vé" tương phản khoảng 4,4:1 (ghi nhận đợt 2, chưa đo lại).

### Kiểm chứng
- Đợt 1 (số liệu từ phase file): e2e mới `public-events`, `public-matches`, `public-groups-entries`, `public-results-strip`, cộng `public-bracket` và `permission-coverage` 44/44; toàn API 66 file 429/429; shared 90/90; worker 34/34; client typecheck, lint, build sạch. Review 8/10: `plans/reports/code-reviewer-261114-phase-08-batch-1-public-api.md`.
- Đợt 2: client typecheck, lint, build sạch. Chạy local `/vi`, `/vi/events`, `/en/events/calendar` (kể cả tham số lạ) trả 200. Review 8/10: `plans/reports/code-reviewer-261114-phase-08-batch-2-public-pages.md`. Giao diện 2 vòng: `plans/reports/ui-verifier-261114-phase-08-batch-2.md`.
- Đợt 3: API `public-site.e2e-spec.ts` 8 test; toàn API 67 file 436/436 (trước khi thêm `maxTrackedIps`; sau đó `public-site`, `public-events`, `permission-coverage` chạy lại 20/20); shared 90/90; Playwright 34 passed + 4 skipped có chủ đích (desktop 1280 + mobile 390); client typecheck, lint, build sạch. Review 7.5/10: `plans/reports/code-reviewer-261114-phase-08-batch-3.md`; Playwright: `plans/reports/tester-261114-phase-08-batch-3-playwright.md`.

---

## 2026-11-13 — Phase 08 lát cắt: site công khai và trang nhánh đấu (đã commit)

### Thêm
- API công khai `GET /api/v1/public/events/:slug/draws/:subEventCode?kind=main|qualifying`. Module `public-competition`, guard `SsrInternalGuard` (header `x-internal-secret`), `publicScope` (`modules/public-scope/`), serializer whitelist `toPublicBracket`. Chi tiết: [system-architecture](./system-architecture.md#site-công-khai-phase-08).
- `@kamito/shared`: `public-api.ts` (`API_GLOBAL_PREFIX`, `PUBLIC_API_SEGMENT`, `SSR_SECRET_HEADER`, `REVALIDATE_SECRET_HEADER`, `REVALIDATE_MAX_TAGS`), `public-bracket-contract.ts` (`PUBLIC_DRAW_KINDS`, kiểu `PublicBracket`).
- Client: trang `/[locale]/events/[slug]/draws/[subEventCode]` (vi, en), `lib/`, `i18n/` (`vi.json`, `en.json`), `components/bracket/`, `components/layout/`, `error.tsx`, `not-found.tsx`, `proxy.ts`.
- Client: route `POST /api/revalidate` (kiểm Host, secret, body, gọi `revalidateTag` với `expire: 0`). Route này là phần còn thiếu của phase 07.
- Env mới cho client: `REVALIDATE_ALLOWED_HOSTS`, `API_FETCH_TIMEOUT_MS`. Đã khai trong compose và `.env.example`.
- Tag mới trong `CACHE_TAGS`: `draw.unpublish`, `draw.postPublishEdit` (dùng `drawTags`, ngữ cảnh lấy qua `loadDrawTagContext`, dùng chung với `draw.publish`).

### Thay đổi
- API công khai trả `200 {data: null}` cho nội dung không công khai, thay vì 404. Lý do: Next chỉ cache response 200.
- Client gọi API bằng header `x-internal-secret` (hằng `SSR_SECRET_HEADER`). Worker gọi client bằng `x-revalidate-secret` (hằng `REVALIDATE_SECRET_HEADER`, trước là chuỗi lặp lại).
- `API_GLOBAL_PREFIX` chuyển sang `@kamito/shared`. `bootstrap-app.ts` chỉ re-export.
- Worker: payload vượt `REVALIDATE_MAX_TAGS` (200) là lỗi vĩnh viễn, không retry.
- Tên site trên header và footer lấy từ `appSettingRegistry` (giá trị mặc định), không còn từ điển cứng.

### Sửa theo review
Review `plans/reports/code-review-and-test-261113-phase-08-slice.md` (7/10, không có Critical). Đã sửa:

| Mục | Vấn đề | Cách sửa |
|---|---|---|
| H1 | Next không cache 404, nên trang đã gỡ vẫn hiện. Bỏ công bố không gửi tag | API trả 200 `{data: null}`. Bỏ công bố, thay VĐV, rút VĐV gửi tag. Có test |
| M1 | Tên site cứng, lệch AppSetting `site.name` | Lấy từ `appSettingRegistry` |
| M2 | `/api/v1/public` cứng ở client | `API_GLOBAL_PREFIX` và `PUBLIC_API_SEGMENT` dùng chung |
| M3 | Fetch không timeout, không có `error.tsx` | `API_FETCH_TIMEOUT_MS`, `error.tsx`, `cache()` của React cho metadata và trang |
| M4 | Slug rác không cache được | Hết nhờ H1 |
| L1 | `kind` có thể là mảng | Kiểm `typeof === 'string'`, có test |
| L4, L5 | Header và giới hạn tag lặp ở nhiều nơi | Đưa vào shared, worker coi vượt giới hạn là lỗi vĩnh viễn |
| L6 | Test whitelist không phủ QUALIFIER, GROUP_PLACE | Thêm unit test `toPublicSource` |
| L7 | `availableKinds.sort()` dựa thứ tự chữ cái | Theo thứ tự `PUBLIC_DRAW_KINDS` |
| L9 | Link MAIN có hai URL | Link MAIN không kèm query |
| L10 | Đếm tag trùng | Đã sửa |

Ghi chú, chưa đổi code: L2 (kiểm Host chỉ là lớp phụ, ghi rõ trong comment), L3 (`REVALIDATE_ALLOWED_HOSTS` phải khớp `CLIENT_INTERNAL_URL`, ghi trong compose). L8 (màu xám cứng trong `bracket.module.css`) chưa sửa: token chưa có màu chữ phụ, làm cùng đợt `ui-consistency` của site công khai.

### Sửa trong lúc smoke local
- Secret SSR lọt vào log: log request API in nguyên văn secret. Header SSR trong working tree có tên không nằm trong `LOG_REDACT_PATHS`. Sửa: header đặt là `x-internal-secret` (tên đã có trong danh sách che từ phase 01), đường che lấy từ `SSR_SECRET_HEADER`. Sau sửa, log hiện `***`. Lỗi chỉ có trong working tree, chưa commit.
- Test chập chờn `draws.e2e-spec.ts` (đặt suất vòng loại, có từ phase 06): test tính kết quả mong đợi bằng `${randomSeed}:qualifiers`, còn service dùng `placementSeed` ngẫu nhiên riêng (`draw-edit.service.ts:78`). Với 2 suất thì đúng 50%. Sửa: test đọc `placementSeed` từ audit. Mục này ghi "chưa sửa" trong changelog phase 07, nay đã sửa.

### Chưa xong
- Playwright `vertical-slice.spec.ts` chưa có (repo chưa có Playwright). Deploy staging chưa làm, nên mốc M1 chưa đạt.
- Chưa có trang giải, lịch, bảng xếp hạng, VĐV hay tin công khai.
- Bỏ công bố hoặc hủy giải (cấp event) chưa gửi tag. Xếp suất vòng loại và nhất/nhì bảng chưa gửi tag. Chưa kiểm `group-qualifier.service` có sửa nhánh MAIN đã công bố mà không gửi tag hay không.
- Cache Next nằm riêng từng instance client. Cần cache handler dùng chung trước khi scale.
- `API_BASE_PATH` trong `.env.example` không được API đọc (chỉ admin dùng).

### Kiểm chứng
- Số liệu lấy từ báo cáo `plans/reports/code-review-and-test-261113-phase-08-slice.md` (tester và code-reviewer chạy). Agent tài liệu không chạy lại test.
- Bản cuối: shared 86/86; API 330/330 (47 file, exit 0); `public-bracket.e2e-spec.ts` 8/8; `draws.e2e-spec.ts` 6/6 lượt xanh sau sửa; worker 34/34; client typecheck, lint, build sạch.
- Một lượt chạy chồng (script seed vô tình gộp `include`, chạy song song với tester) rớt 4 test, không ghi tên test. Hai lượt chạy riêng sau đó đều xanh, nên theo báo cáo đây là do hai lượt giẫm DB và Redis của nhau.
- Smoke local trên DB dev cục bộ (`localhost:5433`, dữ liệu thử đã dọn): trang nhánh MS và `/en` đúng nội dung; URL sai, `..`, `?draw=bad` → 404; API thiếu secret → 403; `/api/revalidate` đúng và sai theo bảng ở [system-architecture](./system-architecture.md#route-apirevalidate-ở-client-phase-08); cache: đổi DB chưa revalidate thì còn bản cũ, sau revalidate thì bản mới.
- Trình duyệt ở 390 px: `scrollWidth` 375, chỉ khung nhánh cuộn ngang. Ảnh: `plans/reports/screenshots-261113-phase-08-slice/`.

---

## 2026-11-13 — Phase 07 lát cắt: nhập tỷ số và revalidate cache (đã commit)

### Thêm
- `@kamito/competition-engine`: `validateMatchScore`, `checkGame`, `gamesToWin` (`match-score-validator.ts`). Hàm thuần, có test.
- `@kamito/shared`: `publicCacheTags`, `isValidCacheTag`, `CACHE_TAG_MAX_LENGTH`, `REVALIDATE_TAGS_JOB` (`public-cache-tags.ts`). Thêm `QueueName.Revalidate`.
- API `/api/v1/admin`: `GET /events/:eventId/matches`, `GET /matches/:id`, `POST /matches/:id/start`, `POST /matches/:id/confirm`. Chi tiết: [match-results](./match-results.md#api).
- Module `match-results` (chốt trận, khóa `Match`, đẩy người thắng vào nhánh) và module `revalidation` (`RevalidationEnqueueService` dạng global, `cache-tags.ts`).
- Worker: queue `revalidate`, `revalidate-worker.ts`, `processors/revalidate-processor.ts`. Biến mới: `CLIENT_INTERNAL_URL` và `REVALIDATE_SECRET` (bắt buộc), `REVALIDATE_TIMEOUT_MS` (mặc định 5000), `REVALIDATE_WORKER_CONCURRENCY` (mặc định 2). Compose khai hai biến bắt buộc cho worker.
- Admin: trang **Nhập tỷ số** `/results` (mục menu, quyền `matches.list`). RESULTS_OPERATOR vào thẳng trang này. Drawer nhập ván, modal "Không đến / Bỏ cuộc".
- `POST /draws/:id/publish` đưa tag `draw.publish` vào queue sau commit, có thể trả `warnings`.
- Không có migration mới. Dùng cột `Match` và bảng `Game` có từ phase 06.

### Thay đổi
- Trận chuyển sang `OFFICIAL` không còn chỉ do BYE hoặc walkover: chốt kết quả nhập tay cũng được (phase 06 ghi khác).
- Trận BYE và trận đã hủy (`isVoided`) không nhập được (409 `MATCH_STATE_INVALID`). Walkover treo chờ đối thủ không nhập được (409 `MATCH_NOT_READY`).

### Sửa theo review
Review `plans/reports/code-review-and-test-261113-phase-07-slice.md` (7,5/10, không có Critical). Đã sửa:

| Mục | Vấn đề | Cách sửa |
|---|---|---|
| H2 | Trận vòng bảng đã `isVoided` vẫn bắt đầu và chốt được | Chặn trong `assertReady` và `isReadyForResult`, bỏ khỏi danh sách nhập. Có e2e |
| M3 | Comment `cache-tags.ts` nhắc test phủ chưa có | Sửa comment; test phủ để lại cho phần còn lại của phase 07 |
| M4 | Drawer mất tỷ số đang gõ sau "Bắt đầu" | Key drawer theo `match.id`, không theo `version` |
| M5 | Lỗi từ modal "Không đến / Bỏ cuộc" bị che | Đóng modal khi gửi, lỗi hiện ở drawer. Modal mount lại nên state được reset (L14) |
| M6 | Một tag sai làm rớt cả lô | Lọc từng tag, vẫn gửi phần còn lại, trả `PUBLIC_REFRESH_DELAYED` |
| L7 | `winBy = 1` nhận tỷ số 22–21 | Chặn. Có test |

Chưa sửa (ghi nợ):
- H1: route `/api/revalidate` của client chưa có. Chờ chủ repo quyết định giữ phase 08 hay kéo lên.
- Thao tác nhánh sau công bố (xếp suất vòng loại, nhất và nhì bảng, bỏ công bố, thay và rút VĐV) chưa revalidate.
- L8: `confirm` lấy thể thức theo `round ?? draw ?? subEvent`, còn `GroupStandingsService.compute` bỏ qua `round`.
- L10: `settleDeferredWalkover` không tăng `version` của trận được điền (có từ phase 06).
- L11: `new URL('/api/revalidate', ...)` bỏ path con của `CLIENT_INTERNAL_URL`.
- L12: hằng vận hành viết cứng (timeout enqueue 2 giây, 5 lần thử, backoff 2 giây, page size 100). Theo luật `/settings`, cần chuyển thành setting hoặc nêu lý do.
- L13: picker giải lấy 100 giải rồi lọc ở client.
- L15: thiếu tag cho `match.start` (VĐV), cho VĐV thua walkover trong cascade, và `draw.publish` không có tag `match-*`. Chưa có test phủ `cache-tags`.
- Thiếu e2e: chốt đồng thời hai trận cùng bảng, cascade walkover khi đẩy nhánh, RETIRED có ván dở.

### Chưa xong
- Lịch thi đấu, session, bàn; lưu tiến độ ván dở (`save-progress`); hủy bắt đầu (`un-start`); sửa, mở lại và cưỡng chế tỷ số. Các mục này chưa có endpoint.
- Đã commit. Chưa deploy staging.
- Màn nhập tỷ số chưa thử trên trình duyệt, chưa thử ở 1024 px. Chưa chạy `ui-consistency:finding-patterns` và `verifying`.

### Kiểm chứng
- Số liệu lấy từ báo cáo tester trong `plans/reports/code-review-and-test-261113-phase-07-slice.md`, agent tài liệu không chạy lại test: typecheck, lint, build pass (chunk admin trên 500 kB chỉ là cảnh báo). ui-tokens 3/3, shared 86/86, competition-engine 209/209, api 320/320 (e2e trên Postgres local), admin 5/5, scripts 4/4.
- Worker: lần đầu rớt 2 test `media-worker.test.ts` (fixture thiếu hai biến mới), đã sửa fixture, 34/34.
- Sau sửa review: `match-results.e2e-spec.ts` 11/11, revalidation unit 3/3.
- Lỗi có sẵn, không do lát cắt: `apps/api/test/draws.e2e-spec.ts:325` đậu rớt ngẫu nhiên (test đoán hạt giống, còn service dùng `randomBytes`, `draw-edit.service.ts:78`). Chưa sửa.

---

## 2026-11-13 — Phase 06: bốc thăm, hạt giống, vòng bảng, sinh nhánh (đã commit)

### Thêm
- Package `@kamito/competition-engine`: hàm thuần, RNG có hạt. Sinh loại trực tiếp, vòng loại, vòng bảng (chia pot, lịch vòng tròn), BXH và phá hòa, xếp nhất/nhì bảng vào nhánh chính, kế hoạch rút lui. Chi tiết: [draws-and-groups](./draws-and-groups.md#engine-kamitocompetition-engine).
- Migration: `20261113030544_add_draws_rounds_matches_games` (`Draw`, `BracketPosition`, `Round`, `Match`, `Game`, `EventMatchCounter`), `20261113030600_add_groups_and_standings` (`Group`, `GroupMember`, `GroupStanding`). Chỉ thêm bảng, cột nullable và FK.
- API `/api/v1/admin`: xem trước và sinh nháp, bracket và groups, swap, publish, xóa nháp, xếp vòng loại và bảng vào MAIN, unpublish, thay và rút VĐV (có `dryRun`), sửa thể thức vòng, nhập hạng tay và tính lại BXH bảng. `suggest-seeds` trả rỗng tới phase 09. Bảng API: [draws-and-groups](./draws-and-groups.md#api).
- Admin: tab **Bốc thăm** trong hub giải (wizard sinh nhánh, bảng sơ đồ, vòng bảng, modal thao tác sau công bố có xem trước).
- Bốn setting trong nhóm `draw` trên `/settings`: `draw.defaultSeedPercent` (25 %), `draw.defaultGroupSize` (4), `draw.defaultAdvancePerGroup` (2), `draw.defaultQualifierCount` (4).
- `@kamito/shared`: `DRAW_REASON_MIN_LENGTH` (3), `DRAW_REASON_MAX_LENGTH` (500) cho lý do thao tác sau công bố.
- Chặn đổi stage hoặc rút VĐV đang nằm trong nhánh đã công bố (409 `ENTRY_IN_PUBLISHED_DRAW`), cả đơn lẻ và hàng loạt.
- Chặn import khi nội dung đã có bốc thăm (`subEventsWithLockedDraw`). Import có `override` vẫn chạy.
- Gộp VĐV: xem trước đếm số trận (trước đây trả 0).

### Thay đổi
- Mã 409 phiên bản: `DRAW_VERSION_CONFLICT` kèm `currentVersion`. Filter lỗi giữ các khóa chi tiết trong whitelist `DETAIL_KEYS`.
- `matchNo` theo giải không lùi khi sinh lại nháp, nên có khoảng trống. Đây là chủ ý.
- Trận chỉ chuyển `OFFICIAL` do BYE hoặc walkover. Nhập tỷ số là phase 07.
- Số suất vòng loại mặc định lấy từ setting `draw.defaultQualifierCount`, không còn hằng số `1` trong code.
- Không có breaking change với phase 05. Migration chỉ thêm.

### Sửa theo review
Review `plans/reports/code-reviewer-261113-phase-06-draws.md` (7/10 trước khi sửa, không có Critical). Các mục đã sửa, đối chiếu lại trong code:

| Mục | Vấn đề | Cách sửa |
|---|---|---|
| H1 | Rút VĐV vòng loại sau khi đã thắng hoặc đã vào MAIN làm đối thủ kẹt | Rút ở QUALIFYING cascade walkover sang MAIN trong cùng transaction (`cascadeToMain`). Người thắng đã rút vẫn được xếp, trận đầu thành walkover |
| H2 | Công bố nháp có VĐV đã rút hoặc thiếu VĐV mới | `assertNoStaleEntries`: 409 `DRAW_STALE_ENTRIES` kèm `withdrawnEntryIds`, `missingEntryIds` |
| H3 | BXH vẫn đánh dấu `qualified` cho VĐV đã rút | Calculator bỏ qua VĐV đã rút khi gán suất đi tiếp. Suất dồn người kế tiếp |
| H4 | `ROUND_STARTED` bỏ lọt trận LIVE có `resultType` NULL | Điều kiện đổi thành `OR [resultType null, resultType not BYE]` |
| M1 | Đổi stage VĐV đã nằm trong nhánh công bố | `guardStageChange` cho cả đơn lẻ và `setStage` hàng loạt |
| M2 | Sinh lại nháp không gửi `expectedVersion` thì ghi đè nháp của người khác | Thiếu version khi đã có nháp → 409 `DRAW_VERSION_CONFLICT` |
| M3 | Nhập hạng tay sau khi bảng đã xếp vào MAIN | `assertGroupsNotPlaced` → 409 `GROUPS_ALREADY_PLACED` |
| M4 | `randomSeed` lộ cho role chỉ đọc | `randomSeed` chỉ trả khi caller có `tournaments.update` (`canSeeSeed`) |
| M5 | Walkover treo còn sót sau bỏ công bố và đổi chỗ | Đồng bộ lại nhánh reset walkover chưa `OFFICIAL`, walkover treo theo đúng VĐV đã rút (`draw-derived-sync.ts`) |
| L1 | Số suất vòng loại mặc định bị cứng | Chuyển thành setting `draw.defaultQualifierCount` |
| L3 | Comment `matchNo` ghi "liên tục" là sai | Sửa comment theo hành vi thật (bộ đếm không lùi) |
| L9 | Giới hạn độ dài lý do lặp ở UI và server | Dùng chung `@kamito/shared` |

Chưa sửa hoặc chưa đối chiếu lại trong lần ghi tài liệu này:
- L2: `seedCount` hiển thị với nhánh MAIN lấy từ bảng bị chặn ở `size/2`. Chỉ lệch dữ liệu hiển thị và audit. Chưa đối chiếu lại.
- L4: `byStrength` chưa xáo trộn thứ tự VĐV cùng seed NULL và cùng điểm. Thứ tự đang theo id từ DB, không theo RNG. Mở.
- L6: `assertNoLockedDraw` của import đọc ngoài transaction commit (TOCTOU). Mở.
- L5, L7: chấp nhận và ghi nợ (chi phí đọc theo bảng; chưa có cache công khai để revalidate).

### Chưa xong
- Đã commit. Chưa deploy staging. Chưa chạy migration phase 06 trên staging.
- Gate G1a (vị trí hạt giống) và G1b (chia bảng, phá hòa, rút lui giữa bảng) chưa được BTC xác nhận.
- Mở, cần chủ giải chốt: khi người thắng vòng loại đã rút, hiện tự walkover ở MAIN. Có dùng lucky loser (người thua chung kết section thay vào) hay không.

### Kiểm chứng
- Tester `plans/reports/tester-261113-phase-06-full-suite.md`: `typecheck`, `lint`, `build` đều pass. `prisma migrate status` báo khớp (11 migration). `pnpm test`: 601/601 pass (engine 178, api 298). Bốn spec phase 06 (41 test) pass khi chạy riêng. Độ phủ dòng engine 99.57%.
- Cảnh báo không chặn: chunk `@kamito/admin` trên 500 kB. Một lần `imports-worker.e2e-spec.ts` không tái hiện được lỗi (chạy một lần, không có bằng chứng flake).

---

## 2026-11-12 — Phase 05: VĐV, đăng ký, import Excel (đã commit)

### Thêm
- Bốn migration: `20261112074412_add_players_pairs_competitors` (`Player`, `Pair`, `Competitor`, sequence `player_code_seq`, CHECK), `20261112074503_add_entries` (`Entry`), `20261112074532_add_import_jobs` (`ImportJob`, `ImportRow`), `20261112074553_add_player_merge` (`Player.mergedAt`, gộp VĐV).
- VĐV: `/api/v1/admin/players` (list, lookup, get, create, update). Mã VĐV = tiền tố + số từ sequence. Slug có hậu tố khi trùng.
- Cặp đôi: `/api/v1/admin/pairs` (chỉ đọc). Cặp được tạo khi đăng ký đôi.
- Đăng ký: `/api/v1/admin/sub-events/:id/entries` (thêm đơn, đôi), `PATCH /api/v1/admin/entries/:id`, `POST /api/v1/admin/entries/bulk` (rút, đổi vòng, đổi suất), `GET /api/v1/admin/events/:eventId/entry-counts`. Kiểm đăng ký (giới, tuổi theo hai cách, cặp nam nữ, sức chứa) trả 422 `ENTRY_INELIGIBLE` kèm `issues`. Ghi đè bằng lý do (ADMIN).
- Import Excel: `/api/v1/admin/imports` (tạo, tải file, xác nhận tải, kiểm tra, nhập, xem dòng, quyết định dòng `NEEDS_CONFIRM`), `GET /api/v1/admin/imports/template`. Queue `import` với hai job `validate-import` và `commit-import`, dọn file định kỳ.
- Export: `GET /api/v1/admin/exports/entries` (xlsx, stream đồng bộ).
- Gộp VĐV: `GET /api/v1/admin/players/merge/preview` và `POST /api/v1/admin/players/merge` (lý do 5 đến 500 ký tự).
- Thư viện: `exceljs` 4.4.0 (đọc và ghi xlsx) và `fflate` 0.8.3 (giải nén thử, dựng lại zip tạm). Kiểm giấy phép và bảo trì trước khi thêm, xem [code-standards](./code-standards.md#thư-viện-mới).
- Sáu setting mới trên `/settings` (nhóm players): `player.codePrefix`, `player.codeDigits`, `player.defaultCountryCode`, `player.showAge`, `entry.maxBulkItems`, `category.ageCalculation`. Bốn setting import: `import.maxFileMegabytes`, `import.maxRows`, `import.retentionDays`, `import.uploadTtlHours`.
- Admin: menu Vận động viên (Danh sách VĐV, Cặp đôi, Lịch sử import). Hub giải có tab **Danh sách** (menu dọc chọn nội dung, bảng đăng ký, thêm nhanh, hàng loạt). Modal gộp VĐV. Wizard import ba bước với chỉ báo tiến độ.
- Helper dùng chung: `@kamito/db` (`src/domain/`) và `@kamito/shared` (`normalizePersonName`, `stripDiacritics`, `ageOnEvent`, `checkEntryEligibility`, `ENTRY_IMPORT_COLUMNS`).

### Thay đổi
- Đăng ký chuyển sang `Competitor`. Entry không trỏ thẳng vào Player hay Pair.
- Thứ tự khóa cố định: advisory lock, `SubEvent` theo id, `Player` theo id. Áp dụng cho ghi entry, commit import và gộp VĐV.
- Import hai bước: validate ghi kết quả xem trước (dòng `VALID`, `ERROR`, `NEEDS_CONFIRM`). Commit đọc lại dữ liệu và khớp lại dưới khóa. Dòng `COMMITTED` không nhập lại. Lượt `FAILED` có dữ liệu được "Thử lại".
- Đổi lại file (revalidate) xóa `fileSha256`, nên lượt lỗi không thể nhập bản xem trước cũ.
- Worker commit kiểm `attemptNo` trong payload. Job cũ bị bỏ qua.
- Admin: `players.update` là quyền xem SĐT, email, ngày sinh. `RESULTS_OPERATOR` không thấy các trường này.

### Bảo mật
- **Zip bomb:** kiểm chữ ký zip, giải nén thử theo khối và đếm byte thật (`assertSafeXlsx`). Trần `IMPORT_MAX_UNZIPPED_BYTES` (chỉ env). Sau review 2, `worksheetsLast` cộng dồn kích thước khai báo của mọi entry trong central directory, nên entry chồng lấn không lọt qua (N1).
- **Ẩn PII theo vai trò:** SĐT, email, ngày sinh chỉ trả khi có `players.update`. Dòng import và export không chứa các trường này.
- **Step-up khi gộp VĐV:** `POST /admin/players/merge` có `@RequireStepUp()`. Gộp cần `players.manage`. Mọi lần gộp ghi audit `player.merge` kèm lý do.
- **Giới hạn file:** dung lượng (`import.maxFileMegabytes` kẹp theo env), số dòng (`import.maxRows`), trần giải nén, bộ nhớ worker (`WORKER_MAX_OLD_SPACE_MB`, `WORKER_MEM_LIMIT`). File tạm xóa trong `finally`.
- **Lưu giữ:** file xóa sau `import.retentionDays`. Lượt chưa tải file hết hạn sau `import.uploadTtlHours`.

### Sửa theo review
- Review đầu (H1 đến H3, M1 đến M6, L1 đến L10): đã sửa, review 2 xác nhận.
- Review 2 (N1, N2, N3): đã có trong code, đọc code ngày 2026-11-12. N1 zip bomb qua central directory chồng lấn. N2 `attemptNo` cũ có thể chạy song song. N3 "Thử lại" nhập bản xem trước cũ sau khi kiểm lại bị lỗi.

### Breaking và lưu ý cấu hình
- Bốn biến `IMPORT_MAX_FILE_BYTES`, `IMPORT_MAX_UNZIPPED_BYTES`, `IMPORT_MAX_ROWS` là bắt buộc khi boot (api và worker). Compose dùng `:?`. Thiếu thì dừng.
- `IMPORT_RETENTION_DAYS` đã bỏ. Dùng setting `import.retentionDays`.
- Compose thêm: `IMPORT_WORKER_CONCURRENCY` (1), `IMPORT_CLEANUP_INTERVAL_MINUTES` (60), `WORKER_MAX_OLD_SPACE_MB` (384), `WORKER_MEM_LIMIT` (512m).
- Nginx admin giới hạn `2m` cho route upload import. File trên 2 MB bị 413. Chưa sửa (xem [deployment-guide](./deployment-guide.md#giới-hạn-import-excel)).
- Migration chỉ thêm bảng, cột và index. Chưa áp dụng lên staging.

### Kiểm chứng
- Báo cáo tester `plans/reports/tester-261112-1436-phase-05-test-run-2.md` (chạy trên code trước các sửa N1 đến N3, báo cáo ghi prod code không đổi): build `db` và `shared` OK. Test shared 80, worker 30, admin 4/4, admin build OK. API 254/254 ở 3 lần chạy đầy đủ, một lần crash native `0xC0000409` (1/6). Turbo typecheck và lint 14/14.
- Review 2 (`plans/reports/code-reviewer-261112-1436-phase-05-review-2.md`): điểm 8/10, kèm N1 đến N3.
- Sau sửa N1–N3: worker 30/30; 2 file e2e import 31/31 (có test riêng cho từng sửa, gỡ sửa thì test rớt); API đầy đủ 37 file 257/257 (một lần chạy). Nginx admin có location riêng cho upload import theo `IMPORT_MAX_FILE_BYTES`; admin test 5/5.

### Chưa xong
- Đã commit. Chưa deploy staging. Chưa chạy migration phase 05 trên staging.
- Chưa có `cache-tags.ts` (phase 07). Hook chặn rút và import khi draw đã công bố còn trả rỗng (phase 06). Số trận trong xem trước gộp còn 0 (phase 06 và 07). Chuyển hướng 301 (phase 10).
- Chưa thử file xlsx do Excel thật tạo.
- Crash native `0xC0000409` trong test API chưa rõ nguyên nhân.
- Các việc tiếp theo: xem [development-roadmap](./development-roadmap.md).

## 2026-11-12 — Phase 04: dữ liệu gốc giải đấu, cấu hình, upload ảnh (đã commit)

### Thêm
- Ba migration: `20261112061544_add_tournament_master_data` (8 danh mục, `Event`, `SubEvent`, `Venue`, `VenueTable`), `20261112061630_add_media_assets` (`MediaAsset`), `20261112070130_add_single_default_partial_indexes` (partial unique index cho `MatchFormat` và `GroupScoringRule`). Chỉ thêm bảng và index.
- Danh mục CRUD: nhóm giải, hạng giải, nội dung chuẩn, nhóm tuổi/trình độ, thể thức trận, luật vòng bảng, địa điểm (kèm bàn, tạo nhanh nhiều bàn). Xóa khi đang dùng trả 409 `IN_USE` kèm số phụ thuộc. Ẩn bằng `isActive`.
- Giải: `/api/v1/admin/events` gồm CRUD, slug (gợi ý khi trùng), publish, unpublish, cancel, uncancel, lọc theo lifecycle, năm, loại giải, trạng thái công bố. Lifecycle suy ra từ ngày, không lưu cột.
- Nội dung thi đấu: `/api/v1/admin/events/:eventId/sub-events` gồm CRUD và tạo hàng loạt tối đa 50 mục.
- Ảnh: `/api/v1/admin/media` (intent, nội dung, complete, GET, PATCH alt text) và `/api/v1/media/public/*`. Worker xử lý queue `media` (sharp, WebP) và job dọn định kỳ. Chi tiết: [system-architecture](./system-architecture.md#upload-ảnh-phase-04).
- Rich text: sanitizer `sanitize-html` với allowlist cho `infoBody`/`infoBodyEn`. URL: `httpsUrlSchema` cho `mapUrl` và `ticketUrl`.
- Tám setting mới trên `/settings`: `event.defaultTimezone`, `event.defaultDurationDays`, `venue.tablePrefix`, `header.resultsStrip.enabled`, `home.featuredEventId`, `media.maxImageMegabytes`, `media.intentTtlMinutes`, `media.processingTimeoutMinutes`.
- Quyền `media` (chỉ ADMIN). Quyền `tournaments` cho danh mục, địa điểm và giải.
- Seed danh mục mặc định: `pnpm --filter @kamito/db seed:config`, idempotent.
- `@kamito/shared`: `slugify-vietnamese`, `lifecycle-from-dates`, `tiebreak-criteria`, `https-url` (có test).
- Nền dùng chung cho api: `common/crud/prisma-list-query.ts`, `catalog-crud.ts`, `delete-guard.ts`.
- Admin: menu Giải đấu và Cấu hình (danh mục), hub giải với tab **Thông tin** và **Nội dung thi đấu**, ô tải ảnh, ô rich text (TipTap), ô slug, hộp xác nhận hành động nguy hiểm.

### Thay đổi
- Worker: từ "chưa có processor" sang media worker dùng BullMQ (queue `media`). Worker vẫn chưa kiểm migration lúc boot.
- Admin nginx: route `/api/v1/admin/media/<id>/content` có `client_max_body_size` lấy từ `UPLOAD_MAX_IMAGE_BYTES`. Route `/api/v1/media/*` được proxy tới api. Body JSON thường giới hạn `2m`.
- Container admin yêu cầu `UPLOAD_MAX_IMAGE_BYTES`. Thiếu thì thoát khi start.
- Body JSON của api giới hạn theo `MAX_INFO_BODY` (`json-body-limit.ts`), thay vì 100 kB mặc định của Express.
- `S3_*` bắt buộc khi `STORAGE_DRIVER=s3` (mặc định). `STORAGE_DRIVER=local` dùng cho dev. `S3_INCOMING_BUCKET` là tùy chọn cho ảnh gốc.

### Breaking và lưu ý cấu hình
- `MEDIA_INTENT_TTL_MINUTES` đã bỏ. Thay bằng setting `media.intentTtlMinutes` (mặc định 15 phút).
- `S3_PRESIGN_ENDPOINT` và `S3_PUBLIC_BASE_URL` không còn được code dùng. Vẫn còn trong env schema, compose và `.env.example`.
- Slug trùng trả 422 `SLUG_TAKEN` (không phải 409), kèm `suggestion`. URL không phải https trả 422 `VALIDATION_FAILED`. Tài liệu theo quy ước 422 cho dữ liệu sai. Báo cáo tester F2 ghi spec gốc là 400; đây là quyết định cần chủ repo xác nhận.
- Migration không xóa hay đổi cột cũ. Chưa áp dụng lên staging.

### Kiểm chứng
- Theo báo cáo tester 13:29 (`plans/reports/tester-261112-1329-phase-04-test-report.md`): typecheck 10/10, lint 7/7, build 7/7. `prisma migrate status` trên DB dev: up to date. Drift check: rỗng. Unit: shared 50, worker 18, ui-tokens 3, admin 2. API: 169/169 ở hai lần chạy, một lần crash native (F1).
- Code đã đổi sau báo cáo 13:29 (nhánh sửa lỗi review). Cần chạy lại kiểm tra trước khi commit.
- Review 13:29 (`plans/reports/code-reviewer-261112-1329-phase-04-review.md`), điểm 7.5/10, không có mục Critical. Đối chiếu lại trong code (`plans/reports/project-manager-261112-1347-phase-04-sync.md`): H1, H2, M1 đến M5 đã có bằng chứng trong code. M6 còn một phần. Mục L chưa đối chiếu.

### Chưa xong
- Đã commit. Chưa deploy staging.
- Chưa kiểm sharp trên image Alpine. Chưa thử `STORAGE_DRIVER=s3` với bucket thật.
- Chưa có `cache-tags.ts` (phase 07).
- Các việc tiếp theo: xem [development-roadmap](./development-roadmap.md).

## 2026-11-12 — Phase 03: đăng nhập admin, RBAC, users, /settings, nhật ký, khung admin (đã commit)

### Thêm
- Đăng nhập bằng email và mật khẩu qua Better Auth 1.7.21. Đăng ký tắt. Không dùng plugin admin. Raw handler chỉ nhận `POST /sign-in/email` và `POST /sign-out` (`apps/api/src/modules/auth/auth-raw-handler.ts`).
- Bốn guard toàn cục, deny-by-default: session, mật khẩu tạm, quyền, step-up. Decorator `@Public`, `@RequireSession`, `@RequirePermission`, `@AllowPendingPasswordChange`, `@RequireStepUp`.
- Ma trận quyền `packages/shared/src/permissions.ts`, dùng chung cho api và admin UI. Vai trò `ADMIN`, `RESULTS_OPERATOR`.
- Chống dò mật khẩu: giới hạn theo IP, khóa tạm theo tài khoản (thời gian khóa nhân đôi), cân thời gian phản hồi. Ngưỡng nằm ở `/settings`.
- Mật khẩu tạm có hạn. Đổi mật khẩu có khóa và audit. Step-up (nhập lại mật khẩu).
- API `/api/v1/admin/users`: list, get, create, update, reset-password, revoke-sessions. Có ràng buộc ADMIN cuối và không tự khóa, tự hạ quyền chính mình.
- API `/api/v1/admin/audit-logs`: chỉ đọc, lọc theo actor, entity, action, khoảng thời gian.
- API `/api/v1/admin/settings`: GET, PUT, DELETE. 11 key sửa được, lưu bảng `AppSetting`.
- bull-board tại `/api/v1/admin/queues`, chỉ ADMIN, guard theo phiên, quyền, và Origin.
- CLI `pnpm --filter @kamito/api create-admin`: tạo hoặc khôi phục ADMIN đầu tiên.
- Migration `20261112042429_add_users_and_auth_sessions`: bảng `User`, `Session`, `Account`, `Verification`, enum `UserRole`.
- Admin (`apps/admin`): đăng nhập, đổi mật khẩu, danh sách và form người dùng, nhật ký thao tác, `/settings`, menu theo quyền, modal step-up, modal mật khẩu tạm.

### Thay đổi
- `pageSize` mặc định lấy từ setting `list.defaultPageSize` (20, khoảng 5–100). Admin đọc giá trị này từ `/auth/me`, không còn fix cứng 20.
- `page` tối đa 10 000.

### Đã sửa theo review phase 03 (2026-11-12)
- Đổi mật khẩu có khóa và audit khi sai (H1).
- Polling bull-board không làm mới phiên (M1).
- Cân thời gian phản hồi khi tài khoản bị khóa, vô hiệu, hoặc mật khẩu tạm hết hạn (M2).
- Phân trang lấy từ `/settings` (M4).
- Chặn `\` trong redirect sau đăng nhập (L6).

### Breaking và lưu ý cấu hình
- `PAGINATION_DEFAULT_PAGE_SIZE` đã bỏ khỏi `env-schema.ts`. Nếu Dokploy có khai biến này thì nó bị bỏ qua. Page size mặc định đổi ở `/settings`.
- `PAGINATION_MAX_PAGE_SIZE` và `QUERY_MAX_LENGTH` vẫn là env, đã có trong `docker-compose.yml` với mặc định 100.

### Chưa xong
- Chưa deploy staging, chưa chạy migration `20261112042429` trên staging.
- Kiểm chứng 2026-11-12: turbo typecheck/lint/build 18/18; test API 18 file / 87 (gồm 13 file e2e trên Postgres + Redis dev local), shared 20, worker 4, ui-tokens 3.
- Còn mở các mục review (M3 một phần, L2–L5, L7–L10, `@RequireStepUp` chưa gắn route). Danh sách và trạng thái: [auth-and-rbac.md](./auth-and-rbac.md#giới-hạn-đã-biết).

## 2026-11-12 — Phase 02: spike Refine, Better Auth, Next revalidate

Commits: `412ec4e`, `730b35b`, `ecfdb2f`.

- Spike B (Refine + antd), C (Better Auth + Nest), E (Next.js revalidate) đạt ở môi trường cục bộ. Spike D (phát hành Dokploy) chờ staging.
- Kết quả ghi trong `plans/reports/spike-{b,c,e}-261112-1007-*.md`.
- `730b35b`: chuyển thiết lập auth vận hành sang trang `/settings` và ghi lại quyết định auth.
- `ecfdb2f`: thêm prototype spike cho Refine, Better Auth và Next revalidate.

## 2026-11-12 — Phase 01: khung monorepo, compose, health, audit

Commits: `f030184`, `c572b16`, `ec4d782`.

- Khung monorepo pnpm + Turborepo: `apps/api`, `apps/worker`, `apps/client`, `apps/admin`, packages `db`, `shared`, `ui-tokens`, `config`.
- Docker: 4 Dockerfile, `docker-compose.yml` cho staging và production, `docker-compose.dev.yml` cho dev.
- Health endpoint (`live`, `ready`) cho api, health cho worker, client và admin.
- Migration `20261112015704_init_app_settings_audit_log`: bảng `AppSetting`, `AuditLog`.
- Chưa dựng staging trên Dokploy. Cổng ra phase 01 chưa đạt theo plan.
