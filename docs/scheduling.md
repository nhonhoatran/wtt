# Xếp lịch thi đấu (phase 07, đợt 2)

> Cập nhật: 2026-11-15 · Trạng thái: phase 07 đã commit (`4c7124b`, `a356255`, `f3c78ce`, `07f2500`, `856cac9`), chưa deploy staging. Phase 08 đã bổ sung lịch công khai (`GET /public/events/:slug/schedule`) và bản in lịch trong working tree; API tích hợp 24 test/3 spec đạt; Playwright lịch 5 đạt/1 bỏ qua có chủ đích (PDF mobile).
> Nguồn đối chiếu: `apps/api/src/modules/{sessions,scheduling,exports}/`, `apps/api/src/modules/matches/match-query.service.ts`, `packages/db/prisma/schema/sessions.prisma`, `packages/shared/src/tournament-settings.ts`, `apps/admin/src/pages/event-hub/` (tab "Lịch & kết quả").
> Hợp đồng API theo màn admin: [plans/261111-1512-kamito-table-tennis-tournament-platform/ui/phase-07-api-contract.md](../plans/261111-1512-kamito-table-tennis-tournament-platform/ui/phase-07-api-contract.md). Tài liệu này là bản mô tả hành vi thực tế; khi hai bên lệch thì code thắng.
> Nhập và mở lại tỷ số: [match-results](./match-results.md). Revalidate cache: [cache-revalidation](./cache-revalidation.md).

## Contents
- [Khái niệm](#khái-niệm)
- [Mô hình dữ liệu](#mô-hình-dữ-liệu)
- [API](#api)
- [Quy tắc xếp lịch](#quy-tắc-xếp-lịch)
- [Tính giờ trận](#tính-giờ-trận)
- [Xung đột (cảnh báo)](#xung-đột-cảnh-báo)
- [Múi giờ](#múi-giờ)
- [Khóa và đồng thời](#khóa-và-đồng-thời)
- [Giải phóng ô lịch](#giải-phóng-ô-lịch)
- [Phiếu trận và xuất file](#phiếu-trận-và-xuất-file)
- [Revalidate](#revalidate)
- [Cài đặt](#cài-đặt)
- [Mã lỗi](#mã-lỗi)
- [Màn hình admin](#màn-hình-admin)
- [Chưa làm và việc còn mở](#chưa-làm-và-việc-còn-mở)

## Khái niệm

| Thuật ngữ | Nghĩa |
|---|---|
| Session | Một buổi thi đấu của giải: ngày, giờ bắt đầu, giờ kết thúc (tùy chọn), địa điểm và danh sách bàn. Mã (`code`) duy nhất trong giải, ví dụ `S01` |
| Bàn (table) | Bàn vật lý của địa điểm (`VenueTable`). Một session gồm nhiều bàn, mỗi bàn có thứ tự cột (`order`) |
| Ô (slot) | Cặp (session, bàn, thứ tự trong session). Mỗi trận chiếm tối đa một ô |
| Xếp lịch | Gán trận vào ô. Server tự tính `scheduledAt` từ giờ bắt đầu session và thời lượng các trận trước đó trên cùng bàn |

Xếp mới yêu cầu nhánh đã công bố, trận không bị hủy (`isVoided`), không phải bye hoặc walkover. Code không yêu cầu trận đã đủ hai bên, nên trận vòng sau vẫn xếp trước được (`scheduling.service.ts`).

## Mô hình dữ liệu

Nguồn: `packages/db/prisma/schema/sessions.prisma`, `draws-and-matches.prisma`. Migration: `20261114064027_add_sessions_and_match_scheduling` (bảng và cột), `20261114071907_add_match_schedule_indexes` (index).

| Model | Khóa và ràng buộc | Ghi chú |
|---|---|---|
| `EventSession` | `(eventId, code)` unique. Index `(eventId, date)`, `venueId` | `date` kiểu DATE. `startTime`, `endTime` là instant UTC, chỉ có ý nghĩa giờ trong múi giờ của giải. `venueId` → Restrict. Xóa giải thì xóa session (Cascade) |
| `EventSessionTable` | Khóa `(sessionId, tableId)`. Index `tableId` | `order` là thứ tự cột của bàn trong lưới. `tableId` → Restrict |
| `Match` (cột lịch) | Index `(sessionId, tableId, orderInSession)`, `tableId`, `(eventId, scheduledAt)` | `sessionId` → Restrict, `tableId` → Restrict. `orderInSession`, `scheduledAt` nullable. `scheduleVersion` Int, mặc định 0, tách khỏi `version` của kết quả |

Trận chưa xếp: `sessionId`, `tableId`, `orderInSession`, `scheduledAt` đều `NULL`.

## API

Base `/api/v1/admin`. Thành công `{data: ...}`, lỗi `{error: {code, message, fields?, dependants?, currentVersion?}}`. Quyền theo `PERMISSION_MATRIX`.

### Session

| Method và đường dẫn | Quyền | Ghi chú |
|---|---|---|
| `GET /events/:eventId/sessions` | `tournaments.list` | Trả `{data, total, page, pageSize}` |
| `POST /events/:eventId/sessions` | `tournaments.create` | 201. Body: `date` (`YYYY-MM-DD`), `code`, `name?`, `nameEn?`, `startTime` (`HH:mm`), `endTime?`, `venueId?`, `tableIds` (uuid, theo thứ tự cột) |
| `PATCH /events/:eventId/sessions/:id` | `tournaments.update` | Một phần các trường trên. Đổi giờ thì tính lại giờ các trận của session |
| `DELETE /events/:eventId/sessions/:id` | `tournaments.delete` | Trả `{data: {id}}`. Chặn khi còn trận đã xếp (`SESSION_HAS_MATCHES`) |

Quy tắc khi lưu session (`sessions.service.ts`, `session-dtos.ts`):
- `venueId` mặc định là địa điểm của giải. Không có địa điểm thì không chọn được bàn.
- Ngày phải nằm trong khoảng `startDate`–`endDate` của giải.
- `endTime`, nếu có, phải sau `startTime`.
- Bàn phải thuộc địa điểm của session, đang hoạt động, không trùng nhau.
- Bỏ bàn đang có trận đã xếp → 409 `SESSION_TABLE_IN_USE` (kèm `dependants.matches`).
- `code` viết hoa, tối đa 16 ký tự, chỉ gồm chữ, số và dấu gạch ngang. Trùng → 409 `SESSION_CODE_EXISTS` kèm `fields.code`.

Session trả về: `{id, eventId, venueId, date, code, name, nameEn, startTime, endTime, startsAt, tables: [{tableId, code, displayName, order}], matchCount}`.

### Xếp lịch một trận

| Method và đường dẫn | Quyền | Ghi chú |
|---|---|---|
| `PATCH /admin/matches/:id/schedule` | `tournaments.update` | `RESULTS_OPERATOR` nhận 403. Nhập tỷ số không đổi được lịch |

Body:

```json
{
  "sessionId": "uuid | null",
  "tableId": "uuid (bắt buộc khi sessionId khác null)",
  "orderInSession": 3,
  "expectedScheduleVersion": 7,
  "expectedOccupantId": "uuid | null"
}
```

- `sessionId: null`: bỏ xếp. Xóa ô, `scheduledAt` về `NULL`.
- Bỏ `orderInSession`: thêm cuối bàn.
- `expectedOccupantId`: trận mà người gửi thấy đang ở ô đích (`null` = ô trống). Nếu lúc ghi ô đích có trận khác → 409 `SCHEDULE_SLOT_OCCUPIED`. Dùng để không đá trận của người khác khi hai người cùng xếp.

Response: `{data: <chi tiết trận> + {conflicts, sessionId, sessionCode, tableId, tableCode, tableName, orderInSession, scheduledAt, scheduleVersion}, swappedMatchId, warnings?}`.

### Danh sách trận của giải

`GET /admin/events/:eventId/matches` (quyền `matches.list`, cùng endpoint với màn nhập tỷ số).

| Tham số | Ý nghĩa |
|---|---|
| `filter[sessionId]` | Trả trọn session: không phân trang, sắp theo `orderInSession` rồi `matchNo`, mỗi trận có `conflicts[]`. Có `truncated` khi vượt `schedule.sessionMatchCap` |
| `filter[tableId]` | Lọc theo bàn |
| `filter[unscheduled]` | `true` = chưa xếp, `false` = đã xếp |
| `filter[status]`, `filter[subEventId]`, `filter[roundId]` | Như màn nhập tỷ số |
| `q` | Tên VĐV hoặc `#matchNo` |
| `sort` | `scheduledAt`, `orderInSession`, `matchNo` (danh sách phân trang) |
| `include=conflicts` | Có `conflicts[]` khi không lọc session. Tính trên toàn giải nên tốn hơn |

Nguồn: `matches/match-query.service.ts`, `matches/admin-matches.controller.ts`.

### Phiếu trận và xuất file

| Method và đường dẫn | Quyền | Ghi chú |
|---|---|---|
| `GET /admin/events/:eventId/match-sheets?sessionId&tableId` | `matches.list` | Phiếu của các trận đã xếp, sắp theo ngày và giờ session, thứ tự cột, rồi thứ tự trong session. `truncated` khi vượt cap |
| `GET /admin/exports/schedule?eventId` | `tournaments.list` | Stream xlsx, file `lich-thi-dau-<slug>.xlsx`, sheet "Lịch thi đấu" |
| `GET /admin/exports/results?eventId` | `tournaments.list` | Stream xlsx, file `ket-qua-<slug>.xlsx`, sheet "Kết quả" |

Hai file xuất đọc theo trang 1.000 dòng bằng cursor, nên bộ nhớ không tăng theo số trận. Nguồn: `exports/schedule-export.service.ts`, `exports/results-export.service.ts`, `exports/match-export-support.ts`.

### Làm mới trang công khai

`POST /admin/events/:id/revalidate` (quyền `tournaments.update`) gửi mọi tag công khai của giải. Dùng khi nghi cache lệch. Xem [Revalidate](#revalidate).

## Quy tắc xếp lịch

Xếp, dời và bỏ xếp đều đi qua `SchedulingService.schedule` (`scheduling.service.ts`).

1. Chỉ trận `SCHEDULED` được xếp, dời hoặc bỏ xếp. Trận `LIVE` và `OFFICIAL` không đổi được ô (`MATCH_NOT_SCHEDULABLE`).
2. Xếp mới (không phải bỏ xếp) yêu cầu nhánh `PUBLISHED`, trận không `isVoided`, không phải `BYE`, không phải `WALKOVER`. Vi phạm → `MATCH_NOT_SCHEDULABLE`.
3. Bàn phải thuộc session (`TABLE_NOT_IN_SESSION`). Session phải thuộc đúng giải (`SESSION_NOT_FOUND`).
4. Ô đích đã có trận:
   - Nếu trận đang xếp đã có ô và trận ở ô đích đang `SCHEDULED` → **đổi chỗ**. Trận ở ô đích được chuyển sang ô cũ của trận đang kéo. Response có `swappedMatchId`.
   - Nếu trận đang xếp chưa có ô → 409 `SCHEDULE_SLOT_OCCUPIED`.
   - Nếu trận ở ô đích đã `LIVE` hoặc `OFFICIAL` → 409 `SCHEDULE_SLOT_OCCUPIED`.
5. Thứ tự vượt `schedule.sessionMatchCap` → 422 (`fields.orderInSession`). Session đã đủ số trận cap và trận đang xếp chưa thuộc session đó → 409 `SESSION_FULL`. Đổi chỗ không bị chặn bởi cap, vì số trận không đổi.
6. `scheduleVersion` là khóa lạc quan của lịch. Lệch `expectedScheduleVersion` (hoặc trận đã đổi session từ lúc đọc) → 409 `SCHEDULE_VERSION_CONFLICT` kèm `currentVersion`.
7. Mỗi thao tác tăng `scheduleVersion` của trận được đổi và của trận bị đổi chỗ, ghi audit `match.schedule` (hai dòng khi đổi chỗ).

Lịch không tự đẩy trận sang session khác. Người xếp chọn session và bàn.

## Tính giờ trận

Hàm `recomputeSessionTimes` (`scheduling/session-timeline.ts`) tính `scheduledAt` của mọi trận chưa hủy trong session, bằng một câu UPDATE theo tập giá trị:

- Mỗi bàn là một hàng đợi bắt đầu từ `startTime` của session.
- Thời lượng một trận = `estimatedMinutes` của thể thức đang áp dụng. Thứ tự ưu tiên thể thức: vòng (`round`), nhánh (`draw`), nội dung (`subEvent`) (`match-duration.ts`).
- Trận `WALKOVER` và `BYE` có thời lượng 0.
- Trận `SCHEDULED` nhận giờ theo con trỏ của bàn. Trận `LIVE` và `OFFICIAL` giữ `scheduledAt` thực tế, nhưng vẫn chiếm chỗ trong dãy: con trỏ đi tiếp từ `max(con trỏ, scheduledAt + thời lượng)`.
- Hàm trả về số trận có giờ đổi, dùng để gửi tag.

Hệ quả: một trận bị bỏ xếp hoặc chuyển đi làm các trận sau trên cùng bàn đẩy giờ lên. Trận đã đấu không bị đổi giờ.

## Xung đột (cảnh báo)

Hàm thuần `computeScheduleConflicts` (`scheduling/schedule-conflict.ts`). Chỉ là cảnh báo, không chặn xếp lịch.

| `kind` | Điều kiện | Trường chính |
|---|---|---|
| `PLAYER_OVERLAP` | Hai trận có cùng VĐV (kể cả qua cặp đôi) và khoảng cách nhỏ hơn `schedule.minRestMinutes` | `withMatchId`, `withMatchNo`, `playerId`, `playerName`, `gapMinutes` (âm = chồng giờ, dương = sát giờ) |
| `TABLE_OVERLAP` | Hai trận cùng bàn và chồng giờ thật | `withMatchId`, `withMatchNo`, `tableId` |

Đôi khi cùng VĐV vẫn phải đá hai trận sát nhau (ví dụ giải nhỏ). Vì vậy admin tự quyết định, hệ thống chỉ hiện cảnh báo.

## Múi giờ

- `EventSession.startTime` và `endTime` lưu instant UTC, đọc theo múi giờ của giải (`session-time.ts`, `session-timezone.ts`).
- Admin nhập và xem theo giờ treo tường (HH:mm) của giải. Quy đổi có tính DST (test múi giờ New York và Asia/Ho_Chi_Minh có trong `sessions/session-time.test.ts`).
- Khi đổi `timezone` của giải (`PATCH /admin/events/:id`) mà giải đã có session, `reconvertSessionsTimezone` chạy trong cùng transaction: giữ nguyên giờ treo tường (08:00 vẫn là 08:00 ở múi giờ mới), quy đổi lại instant, rồi tính lại giờ các trận.
- Điều này áp dụng cho mọi nơi ghi lịch: giờ hiển thị luôn đúng múi giờ hiện hành của giải.

## Khóa và đồng thời

Thứ tự khóa chung của mọi thao tác lịch, và cũng khớp với thao tác nhập kết quả và sửa nhánh (`scheduling/schedule-locks.ts`):

| Thứ tự | Khóa | Ghi chú |
|---|---|---|
| 1 | Dòng `SubEvent` có trận trong các session bị tác động, theo `id` tăng dần | Thao tác nhập kết quả luôn bắt đầu bằng khóa `SubEvent` |
| 2 | Dòng `Draw` của trận đang xếp | `lockDraw` |
| 3 | Dòng `EventSession` theo `id` tăng dần, `FOR UPDATE` | `lockSessionsInOrder` |
| 4 | Dòng `Match` của trận đang xếp, rồi của trận ở ô đích | `FOR UPDATE` |

- Sau khi khóa, hệ thống tính lại tập `SubEvent`. Nếu tập đã lớn lên (một trận mới vào session từ lúc đọc), trả 409 `CONCURRENT_UPDATE_RETRY`. Người dùng thử lại.
- Transaction xếp lịch và sửa session dùng `SCHEDULE_TX_TIMEOUT_MS` = 30 giây, vì phải khóa nhiều dòng và tính lại giờ cả session. Timeout mặc định 5 giây của Prisma không đủ trong ngày thi đấu.
- Lỗi tranh chấp của Postgres (`40P01` deadlock, `40001` serialization) và Prisma `P2034` được filter chung đổi thành 409 `CONCURRENT_UPDATE_RETRY` (xem [code-standards](./code-standards.md#quy-ước-api)).
- `scheduleVersion` và `Match.version` là hai khóa tách nhau. Nhập tỷ số không làm lệch khóa lịch, và ngược lại.

## Giải phóng ô lịch

Trận không còn đấu được thì bỏ ô và tính lại giờ session (`scheduling/release-schedule-slots.ts`). Ba đường gọi:

| Thao tác | Trận được giải phóng | Nơi gọi |
|---|---|---|
| Rút VĐV làm trận bị hủy (void) | Các trận `voidedMatchIds` của nhánh | `group-withdrawal.service.ts` |
| Bỏ công bố nhánh (`unpublish`) | Mọi trận của nhánh | `draw-post-publish.service.ts` |
| Xóa cấu trúc nhánh khi sinh lại (`clearStructure`) | Mọi trận của nhánh | `draw-persistence.service.ts` |

Trận bị giải phóng có `sessionId`, `tableId`, `orderInSession`, `scheduledAt` về `NULL` và `scheduleVersion + 1`. Đổi múi giờ không giải phóng ô, chỉ quy đổi lại giờ.

## Phiếu trận và xuất file

Phiếu trận dùng cho in cho trọng tài và bàn. Dữ liệu lấy từ `GET /admin/events/:eventId/match-sheets`:

- Mỗi phiếu: `matchId`, `matchNo`, mã session và ngày, mã và tên bàn, `orderInSession`, `scheduledAt`, mã và tên nội dung, mã vòng, mã bảng, thể thức (`bestOf`, `pointsPerGame`, `winBy`), tên và câu lạc bộ hai bên.
- Thứ tự in: ngày và giờ session, thứ tự cột của session (không phải thứ tự cột của địa điểm), thứ tự trong session.
- Trang in ở admin: `/events/:id/print/match-sheets` (quyền `tournaments.read`), CSS riêng `match-sheets-print.module.css`, chỉ áp dụng cho trang này.

## Revalidate

Mọi thao tác lịch gửi tag sau commit, qua `CACHE_TAGS` (`revalidation/cache-tags.ts`):

| Mutation | Thời điểm | Tag |
|---|---|---|
| `schedule.update` | Xếp, dời, bỏ xếp, đổi chỗ | Giải, lịch của giải, nhánh và bảng của các nội dung bị tác động, trận bị tác động |
| `session.create`, `session.update`, `session.delete` | Lưu session | Như trên, theo các trận bị tính lại giờ |
| `event.refresh` | Nút "Làm mới trang công khai" | Mọi tag của giải |

Tag bị tác động được lấy từ `loadScheduleTagContext`, gồm mã nội dung và số trận có giờ hoặc ô đổi. Lỗi gửi tag không làm hỏng thao tác đã commit (xem [cache-revalidation](./cache-revalidation.md)).

## Cài đặt

Nhóm `event`, sửa được ở `/settings` (`tournament-settings.ts`):

| Key | Mặc định | Khoảng | Ý nghĩa |
|---|---|---|---|
| `schedule.minRestMinutes` | 20 phút | 0–240 | Khoảng nghỉ tối thiểu giữa hai trận của một VĐV. Ngắn hơn thì có cảnh báo `PLAYER_OVERLAP`. Chỉ cảnh báo |
| `schedule.sessionMatchCap` | 500 trận | 50–2000 | Số trận tối đa một session. Vượt thì từ chối xếp thêm (`SESSION_FULL`, hoặc 422 nếu vượt thứ tự). Cũng là trần số trận tải trọn session và phiếu trận |

Hằng số trong code: `MAX_TABLES` = 200 bàn mỗi session (trần kỹ thuật của DTO). Trần `orderInSession` trong DTO là 1.000.000 (kiểu cột). Cap thực tế lấy từ setting.

## Mã lỗi

| Code | HTTP | Khi nào |
|---|---|---|
| `SESSION_NOT_FOUND` | 404 | Session không có trong giải |
| `MATCH_NOT_FOUND` | 404 | Trận không tồn tại |
| `SESSION_CODE_EXISTS` | 409 | Mã session trùng trong giải (`fields.code`) |
| `SESSION_HAS_MATCHES` | 409 | Xóa session còn trận đã xếp (`dependants.matches`) |
| `SESSION_TABLE_IN_USE` | 409 | Bỏ bàn đang có trận đã xếp (`dependants.matches`) |
| `SCHEDULE_VERSION_CONFLICT` | 409 | `expectedScheduleVersion` cũ (`currentVersion`) |
| `MATCH_NOT_SCHEDULABLE` | 409 | Trận không `SCHEDULED`, không có nhánh công bố, void, BYE, walkover |
| `SCHEDULE_SLOT_OCCUPIED` | 409 | Ô đích có trận không đổi chỗ được, hoặc `expectedOccupantId` lệch |
| `SESSION_FULL` | 409 | Session đã đủ `schedule.sessionMatchCap` |
| `CONCURRENT_UPDATE_RETRY` | 409 | Tranh chấp khóa (deadlock, serialization) hoặc tập `SubEvent` đổi lúc khóa |
| `TABLE_NOT_IN_SESSION` | 422 | Bàn không thuộc session (`fields.tableId`) |
| `VALIDATION_FAILED` | 422 | Sai schema hoặc sai quy tắc session (ngày ngoài giải, giờ kết thúc không sau giờ bắt đầu, bàn không thuộc địa điểm, bàn ngừng hoạt động, trùng bàn). Lỗi nằm ở `fields` |

## Màn hình admin

Tab **Lịch & kết quả** trong hub giải (`pages/event-hub/schedule-tab.tsx`). Ngày và session được giữ trong query `?day=` và `?session=`.

- **Session**: nút thêm, sửa, xóa ở hàng tiêu đề. Form `session-form-modal.tsx` dùng `SortableListField` để sắp thứ tự bàn.
- **Lưới** (`session-grid.tsx`, `session-grid-cell.tsx`): một cột cho mỗi bàn, mỗi ô là một thứ tự. Trận có nút bỏ xếp và cảnh báo trùng lịch. Bấm trận rồi bấm ô trống là xếp (hai cú bấm). Có thể kéo thả bằng chuột (`@dnd-kit`, `PointerSensor`). Đổi chỗ: bấm hoặc kéo trận vào ô đã có trận.
- **Panel chưa xếp** (`unscheduled-panel.tsx`): danh sách trận chưa xếp, có lọc nội dung, vòng và tìm tên. Bấm một trận từ panel rồi bấm ô trống để xếp.
- **Báo cắt bớt**: khi session vượt cap, lưới hiện cảnh báo, không tải đủ.
- **In phiếu trận** và **xuất lịch, kết quả** nằm trên thanh công cụ của tab. Nút "Làm mới trang công khai" gọi `POST /admin/events/:id/revalidate`.

Thông báo cảnh báo `warnings` được hiện qua `apps/admin/src/api/write-warnings.ts` (xem [code-standards](./code-standards.md#cảnh-báo-ghi-warnings)).

## Chưa làm và việc còn mở

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Kiểm tích hợp lịch công khai theo session/bàn | Đã triển khai và kiểm local (2026-11-15) | Endpoint `GET /public/events/:slug/schedule?session&table`, trang `/:locale/events/:slug/info`, bản in theo lịch đang lọc. Chỉ dùng mã công khai, không nhận ID nội bộ. Xem [public-site](./public-site.md#in-ấn) |
| Nhãn session ở màn nhập tỷ số thiếu ngày | Đã sửa (đối chiếu code 2026-11-26) | Bộ lọc dùng `sessionDatedLabel` (`apps/admin/src/pages/results/results-filters.tsx:31`). Nguồn: `ui-verifier-261114-phase-07`, mục F |
| Panel chưa xếp: thông báo khi lọc không ra kết quả | Đã sửa (đối chiếu code 2026-11-26) | Đang lọc hiện "Không có trận nào", không lọc mới hiện "Đã xếp hết trận" (`unscheduled-panel.tsx:132`). Mục D |
| Kéo thả chỉ có `PointerSensor` | Đã sửa 2026-11-25 | Space nhấc, mũi tên chuyển ô, Space/Enter thả, Esc hủy (`schedule-keyboard-drag.ts`); đã kiểm trên Chromium, Firefox, WebKit ([báo cáo](../plans/reports/tester-261125-a8-browser-gates.md)). Mục C |
| Tooltip cảnh báo trùng không focus được | Đã sửa (đối chiếu code 2026-11-26) | Dòng cảnh báo có `tabIndex={0}`, `role="note"` và `aria-label` đầy đủ (`session-grid-cell.tsx:131`). Mục C |
| Trang in: lỗi tải session không có nút thử lại | Đã sửa (đối chiếu code 2026-11-26) | Cả lỗi tải phiếu và lỗi tải danh sách buổi đều có nút "Thử lại" (`match-sheets-print-page.tsx:125`, `:161`). Mục E |
| Chưa render: cỡ lưới thật, khổ A4, focus, tương phản | Chưa kiểm | `ui-verifier-261114-phase-07` chỉ đọc code, không chạy trình duyệt |

Nguồn báo cáo: `plans/reports/reviewer-261114-phase07-scheduling.md` (review trước các sửa, đã đối chiếu lại một phần trong code ngày 2026-11-14), `plans/reports/ui-verifier-261114-phase-07.md`.

## Liên quan

- [match-results](./match-results.md): nhập, chốt, sửa và mở lại tỷ số. Trận đã đấu không đổi lịch.
- [cache-revalidation](./cache-revalidation.md): tag và route cần đăng ký.
- [draws-and-groups](./draws-and-groups.md): nhánh, walkover, rút VĐV (nguồn của giải phóng ô).
- [system-architecture](./system-architecture.md#thứ-tự-khóa): thứ tự khóa chung của toàn hệ thống.
