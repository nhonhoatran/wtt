# Nhập, chốt, sửa và mở lại tỷ số (phase 07)

> Cập nhật: 2026-11-14 · Trạng thái: đã commit (`4d64837`, `315d31a`, `d32ad96`, `3e068d8`, `a356255`, `4fb7505`, `07f2500`, `3853154`, `8173f28`, `d0b8e8a`), chưa deploy staging. Lịch và session: [scheduling](./scheduling.md).
> Nguồn đối chiếu: `apps/api/src/modules/match-results/`, `apps/api/src/modules/matches/`, `packages/competition-engine/src/{match-score-validator,reopen-impact}.ts`, `packages/shared/src/match-limits.ts`, `packages/shared/src/permissions.ts`, `apps/admin/src/pages/results/`.
> Kiến trúc chung: [system-architecture](./system-architecture.md#nhập-lịch-và-revalidate-phase-07). Nhánh và walkover: [draws-and-groups](./draws-and-groups.md). Tag cache: [cache-revalidation](./cache-revalidation.md).
> Hợp đồng API theo màn admin (tóm tắt): [phase-07-api-contract](../plans/261111-1512-kamito-table-tennis-tournament-platform/ui/phase-07-api-contract.md).

## Contents
- [Phạm vi](#phạm-vi)
- [Vòng đời trận](#vòng-đời-trận)
- [API](#api)
- [Kiểm tỷ số](#kiểm-tỷ-số)
- [Bắt đầu, hủy bắt đầu, lưu tạm](#bắt-đầu-hủy-bắt-đầu-lưu-tạm)
- [Chốt kết quả](#chốt-kết-quả)
- [Sửa tỷ số đã chốt](#sửa-tỷ-số-đã-chốt)
- [Mở lại trận](#mở-lại-trận)
- [Khóa và đồng thời](#khóa-và-đồng-thời)
- [Revalidate cache công khai](#revalidate-cache-công-khai)
- [Màn hình nhập tỷ số](#màn-hình-nhập-tỷ-số)
- [Mã lỗi](#mã-lỗi)
- [Chưa làm và việc còn mở](#chưa-làm-và-việc-còn-mở)

## Phạm vi

Đã có:
- Bắt đầu (`start`), hủy bắt đầu (`un-start`), lưu tiến độ ván đang đấu (`save-progress`), chốt (`confirm`).
- Sửa tỷ số đã chốt mà không đổi người thắng (`amend-scores`).
- Mở lại trận đã chốt (`reopen-preview`, `reopen`), có xem trước ảnh hưởng và bước xác nhận mật khẩu (step-up). Cưỡng chế mở lại chỉ ADMIN.
- Bốn loại kết quả: `NORMAL`, `WALKOVER` (không đến), `RETIRED` (bỏ cuộc giữa trận), `DISQUALIFIED` (truất quyền).
- Đẩy người thắng vào trận kế (loại trực tiếp), tính lại bảng xếp hạng bảng (vòng bảng).

Không có migration riêng cho phần này. Dùng cột `Match` và bảng `Game`.

## Vòng đời trận

```
SCHEDULED ──start──────────────────────────> LIVE
LIVE ──un-start──> SCHEDULED                  (xóa ván đã lưu)
LIVE ──save-progress──> LIVE                  (ghi lại ván, ván cuối có thể dở)
SCHEDULED | LIVE ──confirm──────────────────> OFFICIAL
OFFICIAL ──amend-scores──> OFFICIAL           (sửa tỷ số, giữ người thắng)
OFFICIAL ──reopen──> LIVE                     (xóa kết quả; trận kế và suất vòng loại liên quan được gỡ)
```

Trận không nhập được (409 `MATCH_STATE_INVALID` hoặc `MATCH_NOT_READY`):

| Trường hợp | Mã |
|---|---|
| Trận BYE | `MATCH_STATE_INVALID` |
| Trận đã hủy (`isVoided`, VĐV rút khỏi bảng) | `MATCH_STATE_INVALID` |
| `start` khi không ở `SCHEDULED`; `un-start`, `save-progress` khi không ở `LIVE` | `MATCH_STATE_INVALID` |
| `confirm` khi đã `OFFICIAL` | `MATCH_STATE_INVALID` |
| `amend-scores` khi không ở `OFFICIAL` | `MATCH_STATE_INVALID` |
| `reopen` khi trận không `OFFICIAL`, là BYE, đã hủy, hoặc là walkover do hệ thống tự xử | `MATCH_STATE_INVALID` |
| Thiếu một bên | `MATCH_NOT_READY` |
| Walkover treo, chờ đối thủ ([draws-and-groups](./draws-and-groups.md#walkover-treo)) | `MATCH_NOT_READY` |

## API

Base `/api/v1/admin/matches`. Thành công `{data: <chi tiết trận>, warnings?}`. Lỗi `{error: {code, message, fields?, issues?, currentVersion?, preview?}}`. Mọi mutation cần `expectedVersion` (số nguyên không âm, lấy từ `version` của chi tiết trận).

| Method và đường dẫn | Quyền | Body | Ghi chú |
|---|---|---|---|
| `GET /events/:eventId/matches` | `matches.list` | — | Danh sách trận để nhập tỷ số. Chỉ nhánh đã công bố, không gồm BYE và trận bảng đã hủy. Lọc session và bàn: xem [scheduling](./scheduling.md#danh-sách-trận-của-giải) |
| `GET /matches/:id` | `matches.read` | — | Chi tiết: ván, `format` (thể thức đang áp dụng), `version`, `scheduleVersion` |
| `POST /matches/:id/start` | `matches.update` | `{expectedVersion}` | `SCHEDULED` → `LIVE` |
| `POST /matches/:id/un-start` | `matches.update` | `{expectedVersion}` | `LIVE` → `SCHEDULED`, xóa ván đã lưu |
| `POST /matches/:id/save-progress` | `matches.update` | `{expectedVersion, games: [{score1, score2}]}` | Ghi lại ván của trận `LIVE`. Ván cuối được dở |
| `POST /matches/:id/confirm` | `matches.confirm` | `{expectedVersion, resultType, winnerSide?, games[]}` | `SCHEDULED` hoặc `LIVE` → `OFFICIAL` |
| `POST /matches/:id/amend-scores` | `matches.amend` | `{expectedVersion, games, reason}` | Sửa tỷ số trận `OFFICIAL`, không đổi người thắng |
| `GET /matches/:id/reopen-preview` | `matches.reopen` | — | Xem trước ảnh hưởng. Chỉ đọc |
| `POST /matches/:id/reopen` | `matches.reopen` + step-up | `{expectedVersion, reason, force?, expectedBlockingIds?}` | Mở lại trận `OFFICIAL` |

Chi tiết body:
- `resultType`: `NORMAL`, `WALKOVER`, `RETIRED`, `DISQUALIFIED`. `winnerSide`: `1` hoặc `2` (1 = `side1`), bắt buộc với các loại không `NORMAL`.
- `games`: tối đa 15 ván, mỗi điểm là số nguyên 0 đến 999.
- `reason` (`amend-scores`, `reopen`): từ `MATCH_REASON_MIN_LENGTH` (3) đến `MATCH_REASON_MAX_LENGTH` (500) ký tự, cắt khoảng trắng hai đầu. Hằng số trong `@kamito/shared`. Sai → 422 `VALIDATION_FAILED` kèm `fields.reason`.
- `force: true` bắt buộc đi kèm `expectedBlockingIds` (danh sách id trận bị chặn đã xem trước, tối đa 200). Thiếu → 422 `VALIDATION_FAILED`.

Quyền theo `PERMISSION_MATRIX` (`packages/shared/src/permissions.ts`):

| Quyền | ADMIN | RESULTS_OPERATOR |
|---|---|---|
| `matches.list`, `read`, `update`, `confirm`, `amend` | có | có |
| `matches.reopen` (xem trước, mở lại, cưỡng chế) | có | không |

Route `reopen` có `@RequireStepUp()`: người dùng phải nhập lại mật khẩu trong `auth.stepUp.ttlMinutes` (mặc định 5 phút). Xem [auth-and-rbac](./auth-and-rbac.md#mật-khẩu-tạm-đổi-mật-khẩu-step-up).

Nguồn: `matches/admin-matches.controller.ts` (list, detail), `match-results/admin-match-results.controller.ts` (các route ghi).

## Kiểm tỷ số

Hàm thuần `validateMatchScore` (`packages/competition-engine/src/match-score-validator.ts`). Server gọi khi chốt và sửa, là nguồn chính. Admin dùng cùng logic để báo lỗi trước khi gửi.

Thể thức gồm `bestOf`, `pointsPerGame`, `winBy`. Thể thức đang áp dụng lấy theo `round.matchFormat ?? draw.matchFormat ?? subEvent.matchFormat`, qua một hàm duy nhất `pickMatchFormat` (`apps/api/src/modules/draws/round-format-view.ts`). Hàm này dùng chung cho chốt, thời lượng xếp lịch và BXH bảng. Ván kết thúc khi một bên đạt `pointsPerGame` và hơn đối thủ ít nhất `winBy`. Nếu tỷ số đã vượt điểm kết thúc (ví dụ 12–10 với `winBy` 2), phải hơn đúng `winBy`. Thắng trận khi đủ `ceil(bestOf / 2)` ván.

| Loại | Ván | Bên thắng |
|---|---|---|
| `NORMAL` | Mọi ván phải hoàn chỉnh. Không có ván sau khi đã đủ ván thắng | Lấy từ tỷ số. `winnerSide` gửi lên mà khác tỷ số → `WINNER_MISMATCH` |
| `WALKOVER` | Không được có ván (`WALKOVER_HAS_GAMES`) | Bắt buộc `winnerSide` |
| `RETIRED` | Ván cuối được dở (chưa đủ điểm). Không được vượt điểm kết thúc | Bắt buộc `winnerSide` |
| `DISQUALIFIED` | Như `RETIRED` | Bắt buộc `winnerSide` |

Với `RETIRED` và `DISQUALIFIED`, nếu các ván đã đủ để kết thúc trận thì phải chọn `NORMAL` (`MATCH_ALREADY_DECIDED`).

Trong BXH bảng, ván dở cuối của `RETIRED` và `DISQUALIFIED` không được tính là ván thắng, khớp với `validateMatchScore` (`packages/competition-engine/src/group-match-scoring.ts`, sửa 2026-11-14, commit `c449c75`). Test: `group-match-scoring.test.ts`.

Lưu tiến độ (`save-progress`) dùng `validateProgressGames`: kiểm từng ván như trên, cho phép ván cuối chưa kết thúc, và không cho ván vượt quá số ván đã đủ để quyết định.

Mã trong `issues[].code` (422 `SCORE_INVALID`): `GAME_SCORE_INVALID`, `GAME_NOT_FINISHED`, `GAME_MARGIN`, `GAME_OVERRUN`, `GAME_AFTER_DECIDED`, `MATCH_NOT_DECIDED`, `WINNER_MISMATCH`, `WINNER_REQUIRED`, `MATCH_ALREADY_DECIDED`, `WALKOVER_HAS_GAMES`, `TOO_MANY_GAMES`.

## Bắt đầu, hủy bắt đầu, lưu tạm

- **`start`** (`match-result.service.ts`): khóa trận, kiểm `SCHEDULED` và đủ điều kiện (hai bên có mặt, không walkover treo), đặt `LIVE`, ghi `startedAt`, tăng `version`, ghi audit `match.start`.
- **`un-start`** (`match-progress.service.ts`): dùng để hoàn tác khi bấm nhầm. Xóa mọi ván đã lưu, đặt `SCHEDULED`, xóa `startedAt`, tăng `version`, ghi audit `match.unStart` với ván cũ trong `before`.
- **`save-progress`**: thay toàn bộ ván của trận `LIVE` bằng danh sách gửi lên, tăng `version`, ghi audit `match.saveProgress` (ván cũ và mới). Dùng để không mất tỷ số đang nhập khi tải lại trang.

Ba thao tác này không đổi kết quả và không đẩy người thắng. Chúng gửi tag cache của trận, không gửi `results-strip`.

## Chốt kết quả

`POST /matches/:id/confirm`, trong một transaction:
1. Khóa trận và kiểm `expectedVersion` ([Khóa và đồng thời](#khóa-và-đồng-thời)).
2. Kiểm trạng thái và điều kiện (`assertReady`), rồi `validateMatchScore` với thể thức đang áp dụng.
3. Xóa ván cũ, ghi ván mới. Cập nhật trận: `resultType`, `winnerSide`, `games1`, `games2`, `status = OFFICIAL`, `officialAt`, `officialById`, `version + 1`. `startedAt` giữ nguyên. Nếu chưa có thì gán thời điểm chốt.
4. Trận loại trực tiếp: đẩy người thắng vào trận kế (`advanceWinner`, `bracket-advance.ts`). Nếu trận kế đang treo, `settleDeferredWalkover` chạy và có thể lan tiếp. Ô trận kế đã có VĐV khác → 409 `ADVANCEMENT_CONFLICT`.
5. Trận vòng bảng: tính lại bảng xếp hạng (`GroupStandingsService.recompute`, tăng `Group.version`).
6. Ghi audit `match.confirm` (trước và sau).
7. Sau commit: đọc lại chi tiết trận và gửi tag cache.

## Sửa tỷ số đã chốt

`POST /matches/:id/amend-scores` (`match-amend.service.ts`), chỉ với trận `OFFICIAL`:
- Dùng để sửa lỗi nhập tỷ số ván, không để đổi người thắng. Kết quả mới phải có cùng `winnerSide` như trước. Khác → 400 `MATCH_WINNER_CHANGED`, hướng dẫn dùng "Mở lại".
- Tỷ số mới phải qua `validateMatchScore` với cùng `resultType`.
- Xóa ván cũ, ghi ván mới, cập nhật `games1`, `games2`, `version + 1`.
- Trận bảng: tính lại bảng xếp hạng. Nếu thứ hạng của bảng đã được xếp vào nhánh chính đổi thì trả 409 `AMEND_CHANGES_PLACED_RANKS`. Khi đó phải mở lại trận.
- Ghi audit `match.amend` kèm lý do.

## Mở lại trận

Mở lại là thao tác nặng nhất của phase 07. Nó xóa kết quả của trận và gỡ những chỗ mà người thắng đã được đưa tới. Chỉ ADMIN dùng được.

### Ảnh hưởng

Hàm thuần `computeReopenImpact` (`packages/competition-engine/src/reopen-impact.ts`) đi từ trận sắp mở lại, theo từng bước, và liệt kê mọi nơi người thắng đang nằm:

| Hiệu ứng (`effect`) | Nghĩa | Chặn mở lại thường |
|---|---|---|
| `CLEAR_SIDE` | Trận kế chưa đấu. Chỉ VĐV rời khỏi ô | Không |
| `REVERT_AUTO` | Trận kế là BYE hoặc walkover do hệ thống tự xử. VĐV rời ô, và người thắng mà họ đã đưa đi cũng rời theo | Không |
| `RESET_RESULT` | Trận kế đã đấu (`LIVE` hoặc `OFFICIAL`). Phải có quyết định của ADMIN | Có: chặn. Cưỡng chế thì xóa kết quả của trận đó |

Vị trí (`via`):
- `ADVANCE`: người thắng nằm ở trận kế.
- `SEAT`: người thắng nằm ở suất vòng loại hoặc vị trí bảng đã được điền vào nhánh chính khác.

Với trận bảng, mở lại gỡ **mọi** suất của bảng đó khỏi nhánh chính. Đây là chủ ý: thứ hạng bảng đã đổi nên các suất cũ không còn đúng. Preview phải nêu rõ điều này.

### Quy trình

1. **Xem trước** (`GET reopen-preview`): chỉ đọc. Trả `{affected: Cell[], blocking: Cell[]}`. Mỗi ô: `matchId`, `matchNo`, `side`, `entryId`, `entryName`, `status`, `effect`, `via`.
2. **Mở lại** (`POST reopen`), với step-up:
   - Khóa mọi nhánh của nội dung rồi mới khóa trận (xem [Khóa và đồng thời](#khóa-và-đồng-thời)). Kiểm `expectedVersion`.
   - Tính lại ảnh hưởng dưới khóa. Nếu có ô bị chặn mà không có `force` → 409 `REOPEN_BLOCKED` kèm `preview` mới.
   - Nếu có `force`: danh sách trận bị chặn đã xem trước (`expectedBlockingIds`) phải khớp đúng danh sách hiện tại. Lệch → 409 `REOPEN_IMPACT_CHANGED` kèm `preview` mới. Người xem phải xác nhận lại.
   - `force` từ người không phải ADMIN → 403 `FORCE_REOPEN_ADMIN_ONLY`. Lớp này dự phòng: `RESULTS_OPERATOR` không có quyền `matches.reopen` nên bị chặn trước đó bởi guard quyền.
   - Áp dụng các ô (`reopen-apply.ts`): mọi ô bỏ VĐV khỏi ô và trả ô về nguồn đang chờ (trận nguồn `WINNER_OF`, hoặc suất vòng loại và vị trí bảng). Ô `REVERT_AUTO` của walkover tự động chuyển về `SCHEDULED`. Ô `RESET_RESULT` (chỉ khi `force`) xóa ván và kết quả, xóa cả `startedAt`, và đưa trận về `SCHEDULED`.
   - Trận được mở lại: `status = LIVE`, xóa `resultType`, `winnerSide`, `games1`, `games2`, `officialAt`, `officialById`, tăng `version`. Trận vẫn giữ `startedAt`.
   - Trận bảng: tính lại bảng xếp hạng.
   - Ghi audit: `match.reopen` (hoặc `match.forceReopen` khi có cưỡng chế) cho trận gốc, kèm `preview` và danh sách ô đã reset. Mỗi trận bị reset ghi thêm `match.resetByReopen`.
   - Sau commit: gửi tag cho trận gốc và các trận bị chạm tới.

Response: `{data: <chi tiết trận>, impact: <preview đã áp dụng>, warnings?}`.

### Ghi chú

- Không mở lại được trận walkover do hệ thống tự xử (không có `officialById`). Kết quả đó đi theo việc VĐV rút, xem [draws-and-groups](./draws-and-groups.md#walkover-treo).
- Sau mở lại, trận ở `LIVE` chứ không ở `SCHEDULED`. Người xếp phải chốt hoặc `un-start` nếu cần.
- Trận được mở lại giữ nguyên `startedAt` và ô lịch. Trận bị reset do cưỡng chế mất `startedAt` nhưng giữ ô lịch. Lịch chỉ đổi khi người xếp thao tác (xem [scheduling](./scheduling.md)).

## Khóa và đồng thời

Thứ tự khóa của mọi thao tác trận (`match-lock.ts`), khớp với lịch và sửa nhánh:

| Thứ tự | Khóa | Khi nào |
|---|---|---|
| 1 | Dòng `SubEvent` (`FOR UPDATE`) | Mọi trận |
| 2 | Dòng `Draw` (`FOR UPDATE`), kiểm `status = PUBLISHED` | Mọi trận |
| 3 | Dòng `Group` của nhánh, theo `id` tăng dần | Trận bảng. Khóa mọi bảng của nhánh |
| 4 | Dòng `Match` (`FOR UPDATE`), rồi kiểm `expectedVersion` trên dòng vừa khóa | Mọi trận |

Riêng `reopen` (`loadMatchLockedAcrossDraws`): khóa **mọi nhánh** của nội dung theo thứ tự `QUALIFYING`, `GROUP`, `MAIN`, rồi mới khóa trận. Nhánh bảng khóa thêm các bảng của nó. Lý do: mở lại có thể chạm suất ở nhánh khác.

Luồng nhập tỷ số không khóa `Player`. Đọc tên VĐV để tạo tag là đọc thường.

- `MATCH_WRITE_TIMEOUT_MS` = 30 giây cho transaction nhập tỷ số, vì phải khóa nhiều dòng.
- Hai người cùng chốt một trận với cùng `expectedVersion`: người vào sau nhận 409 `MATCH_VERSION_CONFLICT` kèm `currentVersion`. Có e2e cho trường hợp này (`apps/api/test/match-concurrency.e2e-spec.ts`).
- Tranh chấp khóa (Postgres `40P01`, `40001`, Prisma `P2034`) → 409 `CONCURRENT_UPDATE_RETRY`, thông báo "thử lại".
- `scheduleVersion` của lịch tách riêng, không bị nhập tỷ số làm lệch.

## Revalidate cache công khai

Tag do `CACHE_TAGS` (`apps/api/src/modules/revalidation/cache-tags.ts`) dựng từ ngữ cảnh của trận. Toàn bộ bảng mutation và route: [cache-revalidation](./cache-revalidation.md).

| Mutation | Tag |
|---|---|
| `match.start`, `match.unStart`, `match.saveProgress` | `event-<slug>`, `schedule-<slug>`, `draw-<slug>-<code>`, `match-<slug>-<n>` của trận và các trận bị chạm tới, `groups-<slug>-<code>` nếu là trận bảng, `player-<slug>` của VĐV hai phía |
| `match.confirm`, `match.amend`, `match.reopen` | Như trên, cộng `results-strip`. `match.reopen` gồm mọi trận bị chạm tới (trận kế được reset) |

Quy tắc:
- Enqueue chạy sau commit, không nằm trong transaction. Lỗi enqueue (Redis lỗi, quá 2 giây) không làm hỏng thao tác đã commit. API trả kèm `warnings: ["PUBLIC_REFRESH_DELAYED"]`.
- Tag sai bị bỏ, các tag còn lại vẫn gửi, kèm `PUBLIC_REFRESH_DELAYED`.
- Mutation có ảnh hưởng tới điểm xếp hạng đánh dấu ranking cần tính lại (`MatchWriteRunner`), đây là việc của phase 09.

## Màn hình nhập tỷ số

Route `/results` trong admin, cần quyền `matches.list`. Mục menu "Nhập tỷ số" nằm trong nhóm Giải đấu. Sau đăng nhập, `RESULTS_OPERATOR` vào thẳng màn này.

- **Chọn giải**: nhớ lựa chọn lần trước (localStorage), mặc định là giải đang diễn ra. Ô tìm giải gửi `q` lên API để lọc phía server, nên không còn giới hạn 100 giải (sửa 2026-11-14, ghi nợ L13 đã đóng).
- **Session và bàn**: session mặc định là session hiện tại của giải đang diễn ra, cho tới khi người dùng chọn hoặc xóa lựa chọn (`use-results-schedule-filter.ts`). Bàn được nhớ theo giải (`kamito.admin.results.tableId.<eventId>`). Lọc trạng thái được nhớ chung (`kamito.admin.results.status`, mặc định `OPEN`).
- **Danh sách trận**: phân trang, lọc trạng thái, session, bàn và nội dung, tìm theo số trận hoặc tên. Phân trang và lọc chạy ở server.
- **Drawer nhập ván** (`match-score-drawer.tsx`): nút "Bắt đầu", "Hủy bắt đầu" (`un-start`), "Lưu tạm" (`save-progress`), "Chốt kết quả" (`confirm`, sau hộp xác nhận). Khi 409, lỗi hiện trong drawer kèm nút "Tải lại".
- **Sửa tỷ số** (`amend-scores-modal.tsx`): chỉ hiện cho trận đã chốt. Lý do bắt buộc.
- **Mở lại** (`reopen-preview-modal.tsx`): hiện xem trước các ô bị ảnh hưởng và ô bị chặn. Chỉ ADMIN. Cưỡng chế có thêm bước xác nhận. Step-up hiện trên dialog.
- **Không đến / Bỏ cuộc** (`match-abandon-modal.tsx`): chọn `WALKOVER`, `RETIRED` hoặc `DISQUALIFIED`. Modal đóng khi gửi, lỗi hiện ở drawer.

Nguồn: `apps/admin/src/pages/results/` (`results-entry-page.tsx`, `match-score-drawer.tsx`, `match-action-bar.tsx`, `use-match-actions.ts`, `use-results-schedule-filter.ts`, `use-stored-status-filter.ts`).

## Mã lỗi

| Code | HTTP | Khi nào |
|---|---|---|
| `VALIDATION_FAILED` | 422 | Body sai schema, `reason` ngoài khoảng, thiếu `expectedBlockingIds` khi `force`. `fields` theo tên trường |
| `MATCH_NOT_FOUND` | 404 | Không có trận |
| `DRAW_NOT_PUBLISHED` | 409 | Nhánh chưa công bố |
| `MATCH_VERSION_CONFLICT` | 409 | `expectedVersion` cũ, kèm `currentVersion` |
| `MATCH_STATE_INVALID` | 409 | Sai trạng thái (xem [bảng ở đầu](#vòng-đời-trận)) |
| `MATCH_NOT_READY` | 409 | Thiếu một bên, hoặc walkover treo |
| `SCORE_INVALID` | 422 | Tỷ số không hợp lệ, `issues` liệt kê từng lỗi |
| `MATCH_WINNER_CHANGED` | 400 | Sửa tỷ số làm đổi người thắng. Dùng "Mở lại" |
| `AMEND_CHANGES_PLACED_RANKS` | 409 | Sửa tỷ số làm đổi thứ hạng đã đưa vào nhánh. Dùng "Mở lại" |
| `REOPEN_BLOCKED` | 409 | Có trận phía sau đã đấu, không có `force`. Kèm `preview` |
| `REOPEN_IMPACT_CHANGED` | 409 | Danh sách ô bị chặn đổi từ lúc xem trước. Kèm `preview` mới |
| `FORCE_REOPEN_ADMIN_ONLY` | 403 | `force` từ người không phải ADMIN (lớp dự phòng) |
| `STEP_UP_REQUIRED` | 403 | `reopen` khi chưa nhập lại mật khẩu trong thời hạn |
| `FORBIDDEN` | 403 | Thiếu quyền, ví dụ `RESULTS_OPERATOR` gọi `reopen` |
| `ADVANCEMENT_CONFLICT` | 409 | Ô trận kế đã có VĐV khác |
| `CONCURRENT_UPDATE_RETRY` | 409 | Tranh chấp khóa (deadlock, serialization) |

Nguồn: `match-result-errors.ts`, `match-result-dtos.ts`, `scheduling-errors.ts`, `draw-errors.ts`.

Filter lỗi chỉ giữ các khóa chi tiết trong whitelist `DETAIL_KEYS` (`common/filters/http-exception.filter.ts`): `currentVersion`, `preview`, và các khóa khác của nhánh. `preview` là khóa mới của phase 07.

## Chưa làm và việc còn mở

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Lịch thi đấu, session, bàn | Đã làm | Xem [scheduling](./scheduling.md) |
| Hằng vận hành viết cứng: timeout enqueue 2 giây, 5 lần thử, backoff 2 giây, `MATCH_WRITE_TIMEOUT_MS` 30 giây, `SEARCH_DEBOUNCE_MS` 300 ms | Giữ cứng có chủ đích | Hằng độ tin cậy nội bộ, không phải tham số nghiệp vụ hay vận hành. Có comment lý do trong code (quyết định 2026-11-14) |
| `settleDeferredWalkover` không tăng `version` của trận được điền | Đã sửa | Sửa tại `apps/api/src/modules/draws/knockout-walkover.ts:32` (ghi nợ phase 06 L10) |
| Màn nhập tỷ số chưa chạy thử trên trình duyệt với API thật ở 1024 px | Chưa kiểm | Báo cáo `ui-verifier-261114-phase-07` chỉ đọc code |
| Mở lại trận bảng gỡ mọi suất của bảng khỏi nhánh chính | Cố ý | Preview phải nêu rõ. Chưa có thao tác gán lại từng suất riêng |

Nguồn: `plans/reports/code-review-and-test-261113-phase-07-slice.md`, `plans/reports/ui-verifier-261114-phase-07.md`.

## Liên quan

- [scheduling](./scheduling.md): session, xếp lịch, phiếu trận, xuất file.
- [draws-and-groups](./draws-and-groups.md): nhánh, walkover, bảng, suất vòng loại.
- [cache-revalidation](./cache-revalidation.md): tag và route.
- [auth-and-rbac](./auth-and-rbac.md#ma-trận-quyền): quyền `matches.*`, step-up.
