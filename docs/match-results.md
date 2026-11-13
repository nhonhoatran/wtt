# Nhập và chốt tỷ số (phase 07, lát cắt)

> Cập nhật: 2026-11-13 · Trạng thái: lát cắt xong (commit 4d64837..1c4d4fb), chưa deploy staging. Phần còn lại của phase 07 (lịch, bàn, sửa và mở lại tỷ số) chưa làm.
> Nguồn đối chiếu: `apps/api/src/modules/match-results/`, `apps/api/src/modules/matches/`, `apps/api/src/modules/revalidation/`, `packages/competition-engine/src/match-score-validator.ts`, `packages/shared/src/public-cache-tags.ts`, `apps/admin/src/pages/results/`.
> Kiến trúc chung (khóa, queue, revalidate): [system-architecture](./system-architecture.md#nhập-tỷ-số-và-revalidate-phase-07). Nhánh và walkover: [draws-and-groups](./draws-and-groups.md).

## Contents
- [Phạm vi](#phạm-vi)
- [API](#api)
- [Vòng đời trận](#vòng-đời-trận)
- [Kiểm tỷ số](#kiểm-tỷ-số)
- [Khóa và đồng thời](#khóa-và-đồng-thời)
- [Revalidate cache công khai](#revalidate-cache-công-khai)
- [Màn hình nhập tỷ số](#màn-hình-nhập-tỷ-số)
- [Mã lỗi](#mã-lỗi)
- [Chưa làm](#chưa-làm)

## Phạm vi

Lát cắt phase 07 làm:
- Bắt đầu trận (`SCHEDULED` → `LIVE`) và chốt kết quả (→ `OFFICIAL`) cho trận đã đủ hai bên.
- Bốn loại kết quả: `NORMAL`, `WALKOVER` (không đến), `RETIRED` (bỏ cuộc giữa trận), `DISQUALIFIED` (truất quyền).
- Đẩy người thắng vào trận kế (loại trực tiếp), tính lại bảng xếp hạng bảng (vòng bảng).
- Revalidate tag cache công khai sau khi bắt đầu trận, chốt trận và công bố nhánh.
- Không có migration mới. Dùng cột `Match` và bảng `Game` có sẵn từ phase 06.

Chưa có: lịch thi đấu, session, bàn, lưu tiến độ ván dở, hủy bắt đầu, sửa tỷ số đã chốt, mở lại. Xem [Chưa làm](#chưa-làm).

## API

Base `/api/v1/admin`. Thành công `{data: ...}`. Lỗi `{error: {code, message, ...}}`. Quyền theo `PERMISSION_MATRIX` (`packages/shared/src/permissions.ts`). RESULTS_OPERATOR có `matches.list`, `read`, `update`, `confirm`.

| Method và đường dẫn | Quyền | Body | Ghi chú |
|---|---|---|---|
| `GET /events/:eventId/matches` | `matches.list` | — | Trận để nhập tỷ số. Chỉ nhánh đã công bố; không gồm BYE và trận bảng đã hủy (`isVoided`). Trả `{data, total, page, pageSize}` |
| `GET /matches/:id` | `matches.read` | — | Chi tiết: ván, `format` (thể thức đang áp dụng), `version` |
| `POST /matches/:id/start` | `matches.update` | `{expectedVersion}` | `SCHEDULED` → `LIVE`, ghi `startedAt` |
| `POST /matches/:id/confirm` | `matches.confirm` | `{expectedVersion, resultType, winnerSide?, games[]}` | Chốt kết quả: `SCHEDULED` hoặc `LIVE` → `OFFICIAL` |

Chi tiết:
- Query của list: `page`, `pageSize`, `sort` (chỉ `matchNo`), `filter[status]` (`OPEN` = SCHEDULED và LIVE, hoặc danh sách CSV của `SCHEDULED`, `LIVE`, `OFFICIAL`), `filter[subEventId]`, `filter[roundId]`, `q`. `q` là số trận (`12` hoặc `#12`) hoặc tên VĐV.
- `start` và `confirm` trả `{data: <chi tiết trận>}`. Thêm `warnings: ["PUBLIC_REFRESH_DELAYED"]` khi không đưa được job revalidate vào queue.
- `winnerSide` là `1` hoặc `2` (1 = `side1`). `games` tối đa 15 ván, mỗi điểm là số nguyên 0 đến 999.
- Body sai schema trả 422 `VALIDATION_FAILED` kèm `fields`.
- Route `reopen`, `amend`, `un-start`, `save-progress` chưa có trong controller.

Nguồn: `apps/api/src/modules/matches/admin-matches.controller.ts` (list, detail), `apps/api/src/modules/match-results/admin-match-results.controller.ts` (start, confirm).

## Vòng đời trận

```
SCHEDULED ──start──> LIVE ──confirm──> OFFICIAL
SCHEDULED ─────────────confirm──────> OFFICIAL
```

Trận không nhập được (409):

| Trường hợp | Mã |
|---|---|
| Trận BYE | `MATCH_STATE_INVALID` |
| Trận đã hủy (`isVoided`, VĐV rút khỏi bảng) | `MATCH_STATE_INVALID` |
| Đã `OFFICIAL` | `MATCH_STATE_INVALID` |
| `start` khi trận không ở `SCHEDULED` | `MATCH_STATE_INVALID` |
| Thiếu một bên | `MATCH_NOT_READY` |
| Walkover treo, chờ đối thủ ([draws-and-groups](./draws-and-groups.md#walkover-treo)) | `MATCH_NOT_READY` |

Thứ tự ghi của `confirm`, trong một transaction:
1. Khóa trận và kiểm `expectedVersion` ([Khóa và đồng thời](#khóa-và-đồng-thời)).
2. Kiểm trạng thái, rồi kiểm tỷ số với thể thức `round.matchFormat ?? draw.matchFormat ?? subEvent.matchFormat`.
3. Xóa ván cũ, ghi ván mới, cập nhật trận: `resultType`, `winnerSide`, `games1`, `games2`, `status = OFFICIAL`, `officialAt`, `officialById`, `version + 1`. `startedAt` giữ nguyên; nếu chưa có thì gán thời điểm chốt.
4. Trận loại trực tiếp: đẩy người thắng vào trận kế (`advanceWinner`, `bracket-advance.ts`). Nếu trận kế đang treo, `settleDeferredWalkover` chạy và có thể lan tiếp. Ô trận kế đã có VĐV khác → 409 `ADVANCEMENT_CONFLICT`.
5. Trận vòng bảng: tính lại bảng xếp hạng (`GroupStandingsService.recompute`, tăng `Group.version`).
6. Ghi audit `match.confirm` (trước và sau).
7. Sau commit: đọc lại chi tiết trận và enqueue revalidate.

`start` làm theo thứ tự: khóa trận, kiểm `SCHEDULED` và đủ điều kiện, đặt `LIVE`, `startedAt`, `version + 1`, ghi audit `match.start`, enqueue revalidate.

## Kiểm tỷ số

Hàm thuần `validateMatchScore` (`packages/competition-engine/src/match-score-validator.ts`). Server gọi khi chốt. Admin dùng cùng hàm (`score-draft.ts`, `match-abandon-modal.tsx`) để báo lỗi trước khi gửi. Server vẫn kiểm lại và là nguồn chính.

Thể thức gồm `bestOf`, `pointsPerGame`, `winBy`. Ván kết thúc khi một bên đạt `pointsPerGame` và hơn đối thủ ít nhất `winBy`. Nếu tỷ số đã vượt điểm kết thúc (ví dụ 12–10 với `winBy` 2), phải hơn đúng `winBy`. Thắng trận khi đủ `ceil(bestOf / 2)` ván.

| Loại | Ván | Bên thắng |
|---|---|---|
| `NORMAL` | Mọi ván phải hoàn chỉnh. Không có ván sau khi đã đủ ván thắng | Lấy từ tỷ số. `winnerSide` gửi lên mà khác tỷ số → `WINNER_MISMATCH` |
| `WALKOVER` | Không được có ván (`WALKOVER_HAS_GAMES`) | Bắt buộc `winnerSide` |
| `RETIRED` | Ván cuối được dở (chưa đủ điểm). Không được vượt điểm kết thúc | Bắt buộc `winnerSide` |
| `DISQUALIFIED` | Như `RETIRED` | Bắt buộc `winnerSide` |

Với `RETIRED` và `DISQUALIFIED`, nếu các ván đã đủ để kết thúc trận thì phải chọn `NORMAL` (`MATCH_ALREADY_DECIDED`).

Mã trong `issues[].code` (422 `SCORE_INVALID`): `GAME_SCORE_INVALID`, `GAME_NOT_FINISHED`, `GAME_MARGIN`, `GAME_OVERRUN`, `GAME_AFTER_DECIDED`, `MATCH_NOT_DECIDED`, `WINNER_MISMATCH`, `WINNER_REQUIRED`, `MATCH_ALREADY_DECIDED`, `WALKOVER_HAS_GAMES`, `TOO_MANY_GAMES`.

## Khóa và đồng thời

Trận dùng cùng thứ tự khóa với nhánh (phase 06). Mọi đường ghi đi theo thứ tự này:

| Thứ tự | Khóa | Khi nào |
|---|---|---|
| 1 | Dòng `SubEvent` (`FOR UPDATE`) | Mọi trận |
| 2 | Dòng `Draw` (`FOR UPDATE`), kiểm `status = PUBLISHED` | Mọi trận |
| 3 | Dòng `Group` của nhánh, theo `id` tăng dần (`lockGroups`) | Trận bảng. Khóa mọi bảng của nhánh, không chỉ bảng của trận |
| 4 | Dòng `Match` (`FOR UPDATE`), rồi kiểm `expectedVersion` trên dòng vừa khóa | Mọi trận |

Luồng nhập tỷ số không khóa `Player`. Đọc tên VĐV để tạo tag cache là đọc thường.

Hai người cùng chốt một trận với cùng `expectedVersion`: người vào sau nhận 409 `MATCH_VERSION_CONFLICT` kèm `currentVersion`. Có e2e cho trường hợp này (`apps/api/test/match-results.e2e-spec.ts`).

Chưa có test cho hai trận cùng bảng chốt đồng thời (ghi nợ).

## Revalidate cache công khai

Tag được tạo bằng `publicCacheTags` (`packages/shared/src/public-cache-tags.ts`). Mỗi mutation đăng ký tag tại `apps/api/src/modules/revalidation/cache-tags.ts`:

| Mutation | Tag |
|---|---|
| `match.start` | `event-<eventSlug>`, `schedule-<eventSlug>`, `draw-<eventSlug>-<subEventCode>`, `match-<eventSlug>-<matchNo>`; thêm `groups-<eventSlug>-<subEventCode>` nếu là trận bảng |
| `match.confirm` | Như `match.start`, cộng `results-strip` và `player-<playerSlug>` cho mọi VĐV của hai phía (cả hai người của cặp). Cộng `match-<eventSlug>-<n>` cho các trận được đẩy tiếp |
| `draw.publish` | `event-<eventSlug>`, `schedule-<eventSlug>`, `draw-<eventSlug>-<subEventCode>`; thêm `groups-...` nếu là nhánh bảng |

Quy tắc tag: bắt đầu bằng chữ thường, chỉ gồm `A-Z a-z 0-9 _ . -`, tối đa 256 ký tự (`isValidCacheTag`). Tag sai bị bỏ khi enqueue, các tag còn lại vẫn gửi.

Luồng:

```
API (sau commit) ──> queue `revalidate`, job `revalidate-tags` {tags}, jobId duy nhất
Worker           ──> POST {CLIENT_INTERNAL_URL}/api/revalidate
                     header x-revalidate-secret, body {"tags": [...]}, timeout REVALIDATE_TIMEOUT_MS
Client           ──> route /api/revalidate: CHƯA CÓ (phase 08)
```

Quy tắc:
- Enqueue chạy sau commit, không nằm trong transaction. Lỗi enqueue (Redis lỗi, quá 2 giây) không làm hỏng thao tác đã commit. API trả kèm `warnings: ["PUBLIC_REFRESH_DELAYED"]`.
- Mỗi lần enqueue có `jobId` riêng (`reval-<uuid>`). Không dùng id cố định, vì BullMQ có thể bỏ job mới khi job cũ cùng id còn được giữ. Revalidate là thao tác idempotent nên chạy trùng vô hại.
- Job thử tối đa 5 lần, backoff mũ, khởi đầu 2 giây. Giữ 100 job hoàn thành và 500 job lỗi.
- Worker: payload sai hoặc tên job lạ thì lỗi ngay, không retry. Non-2xx, lỗi mạng hoặc timeout thì retry.
- URL gọi là `new URL('/api/revalidate', CLIENT_INTERNAL_URL)`. Path con trong `CLIENT_INTERNAL_URL` bị bỏ, nên chỉ dùng origin, ví dụ `http://client:3000`.
- Client chưa có trang đọc dữ liệu giải, nên hiện chưa có trang công khai nào bị ảnh hưởng. Khi route chưa có, job nhận lỗi và retry; sau 5 lần thì job failed.

Chưa revalidate: entry, VĐV, gộp VĐV, sub-event, cấu hình; các thao tác nhánh sau công bố (xếp suất vòng loại, xếp nhất/nhì bảng, bỏ công bố, thay và rút VĐV). `draw.publish` chưa có tag `match-*`.

## Màn hình nhập tỷ số

- Route `/results` trong admin, cần quyền `matches.list`. Mục menu "Nhập tỷ số" nằm trong nhóm Giải đấu. Sau đăng nhập, RESULTS_OPERATOR vào thẳng màn này.
- Chọn giải: nhớ lựa chọn lần trước (localStorage), mặc định là giải đang diễn ra. Danh sách giải lấy tối đa 100 giải rồi lọc ở client (ghi nợ).
- Danh sách trận: phân trang, lọc trạng thái và nội dung, tìm theo số trận hoặc tên. Phân trang và lọc chạy ở server.
- Mở trận: drawer nhập tỷ số theo ván. Nút "Bắt đầu" gọi `start`. Nút "Chốt kết quả" gọi `confirm` sau hộp xác nhận.
- Nút "Không đến / Bỏ cuộc" mở modal chọn `WALKOVER`, `RETIRED` hoặc `DISQUALIFIED`. Modal đóng khi gửi; lỗi hiện ở drawer.

Nguồn: `apps/admin/src/pages/results/` (`results-entry-page.tsx`, `match-score-drawer.tsx`, `match-abandon-modal.tsx`, `use-results-event.ts`).

## Mã lỗi

| Code | HTTP | Khi nào |
|---|---|---|
| `VALIDATION_FAILED` | 422 | Body sai schema; `fields` theo tên trường |
| `MATCH_NOT_FOUND` | 404 | Không có trận |
| `DRAW_NOT_PUBLISHED` | 409 | Nhánh chưa công bố |
| `MATCH_VERSION_CONFLICT` | 409 | `expectedVersion` cũ; kèm `currentVersion` |
| `MATCH_STATE_INVALID` | 409 | Sai trạng thái: BYE, trận đã hủy, đã OFFICIAL, `start` khi không SCHEDULED |
| `MATCH_NOT_READY` | 409 | Thiếu một bên, hoặc walkover treo |
| `SCORE_INVALID` | 422 | Tỷ số không hợp lệ; `issues` liệt kê từng lỗi |
| `ADVANCEMENT_CONFLICT` | 409 | Ô trận kế đã có VĐV khác |

Nguồn: `match-result-errors.ts`, `draw-errors.ts` (`notPublished`, `conflict`), `parse-body.ts`.

## Chưa làm

| Hạng mục | Phase | Ghi chú |
|---|---|---|
| Lịch thi đấu, session, bàn, xếp lịch tay | 07 (đợt 2) | Chưa có endpoint và cột lịch dùng |
| Lưu tiến độ ván dở (`save-progress`), hủy bắt đầu (`un-start`) | 07 (đợt 2) | Chưa có endpoint |
| Sửa tỷ số đã chốt (`amend`), mở lại (`reopen`), cưỡng chế | 07 (đợt 2) | Quyền có trong ma trận (`reopen` chỉ ADMIN). Chưa có endpoint |
| Route `/api/revalidate` của client | 08 | Chủ repo chọn giữ ở phase 08 hay kéo lên lát cắt |
| Tag cho entry, VĐV, gộp VĐV, nhánh sau công bố; test phủ `cache-tags` | 07 (đợt 2) | Xem [Revalidate cache công khai](#revalidate-cache-công-khai) |
| Chốt đồng thời hai trận cùng bảng; cascade walkover khi đẩy nhánh; ván dở của RETIRED | 07 (đợt 2) | Thiếu e2e |
| Thể thức: `confirm` lấy `round ?? draw ?? subEvent`, còn `GroupStandingsService.compute` bỏ qua `round` | 07 | Ghi nợ L8 |
| `settleDeferredWalkover` không tăng `version` của trận được điền | 07 | Ghi nợ L10, có từ phase 06 |
| Hằng vận hành viết cứng: timeout enqueue 2 giây, 5 lần thử, backoff 2 giây, page size 100 | 07 | Theo luật `/settings`: chuyển thành setting hoặc nêu lý do giữ cứng (L12) |
| Picker giải lấy 100 giải rồi lọc ở client | 07 | Ghi nợ L13. Danh sách trận đã lọc ở server |
| Màn nhập tỷ số chưa thử trên trình duyệt, chưa thử ở 1024 px | — | Ghi nợ từ báo cáo review |
