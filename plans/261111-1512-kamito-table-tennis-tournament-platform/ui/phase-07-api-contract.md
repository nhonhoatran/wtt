# Phase 07 (phần còn lại) — hợp đồng API cho màn admin

Tổng hợp từ code đã commit 2026-11-14 (`f3c78ce`, `4fb7505`, `07f2500`). Nguồn sự thật là code; file này chỉ để màn admin dùng nhanh.

Chung: lỗi dạng `{ error: { code, message, fields?, dependants?, currentVersion?, preview? } }`. Mutation có thể trả `warnings: ['PUBLIC_REFRESH_DELAYED' | 'RANKING_RECOMPUTE_DELAYED' ...]` → hiện qua `apps/admin/src/api/write-warnings.ts`. Deadlock/tranh chấp → 409 `CONCURRENT_UPDATE_RETRY` (thông báo "thử lại").

## Session — `/admin/events/:eventId/sessions`

- Quyền: list `tournaments.list`; create/update/delete `tournaments.create|update|delete`.
- `GET` → `{data: Session[], total, page, pageSize}`.
- `POST` (201) `{date:'YYYY-MM-DD', code, name?, nameEn?, startTime:'HH:mm', endTime?:'HH:mm'|null, venueId?, tableIds: uuid[]}` — `venueId` mặc định địa điểm của giải; `code` viết hoa, duy nhất trong giải; giờ là giờ treo tường theo múi giờ giải; thứ tự `tableIds` = thứ tự cột.
- `PATCH /:id` một phần các trường trên; `DELETE /:id` → `{data:{id}}`.
- Session: `{id, eventId, venueId, date, code, name, nameEn, startTime, endTime, startsAt, tables:[{tableId, code, displayName, order}], matchCount}`.
- Lỗi: 409 `SESSION_CODE_EXISTS`; 422 theo field (ngày ngoài giải, giờ kết thúc ≤ bắt đầu, bàn không thuộc địa điểm/không hoạt động, trùng bàn); 409 `SESSION_HAS_MATCHES` (`dependants.matches`); 409 `SESSION_TABLE_IN_USE`.

## Xếp lịch — `PATCH /admin/matches/:id/schedule`

- Quyền `tournaments.update` (RESULTS_OPERATOR 403).
- Body `{sessionId: uuid|null, tableId?, orderInSession?: int≥1, expectedScheduleVersion, expectedOccupantId?: uuid|null}`. `sessionId:null` = bỏ xếp. Bỏ `orderInSession` = thêm cuối bàn. API tự tính `scheduledAt`.
- Chỉ trận `SCHEDULED` được xếp/dời; bỏ xếp được mọi trận không LIVE/OFFICIAL.
- Thả vào ô đã có trận (trận đang có ô) → **đổi chỗ**; trả `swappedMatchId`.
- Trả `{data: Match + {conflicts, sessionId, sessionCode, tableId, tableCode, tableName, orderInSession, scheduledAt, scheduleVersion}, swappedMatchId, warnings?}`.
- Lỗi: 409 `SCHEDULE_VERSION_CONFLICT` (`currentVersion`), 409 `MATCH_NOT_SCHEDULABLE`, 409 `SCHEDULE_SLOT_OCCUPIED` (từ panel vào ô có người, hoặc `expectedOccupantId` lệch), 409 `SESSION_FULL`, 422 `TABLE_NOT_IN_SESSION`, 422 thứ tự vượt `schedule.sessionMatchCap`.
- Conflict: `{kind:'PLAYER_OVERLAP', withMatchId, withMatchNo, playerId, playerName, gapMinutes}` (âm = chồng giờ; dương nhưng < nghỉ tối thiểu = sát giờ) | `{kind:'TABLE_OVERLAP', withMatchId, withMatchNo, tableId}`. Chỉ là cảnh báo.

## Danh sách trận — `GET /admin/events/:id/matches`

- Lọc: `filter[sessionId]`, `filter[tableId]`, `filter[unscheduled]=true|false`, `filter[status]`, `filter[subEventId]`, `filter[roundId]`, `q` (tên VĐV hoặc `#matchNo`); sort `scheduledAt`, `orderInSession`, `matchNo`; `page`, `pageSize`.
- Có `filter[sessionId]` → trả trọn session, không phân trang, sort `orderInSession` rồi `matchNo`, có `truncated`, `total`, và mỗi trận có `conflicts[]`. Không lọc session → không có `conflicts` trừ khi `include=conflicts`.

## Phiếu trận — `GET /admin/events/:id/match-sheets?sessionId&tableId`

- Quyền `matches.list`. → `{data:{event:{id,name,nameEn,timezone}, sheets:[{matchId, matchNo, sessionCode, sessionDate, tableCode, tableName, orderInSession, scheduledAt, subEventCode, subEventName, roundCode, groupCode, bestOf, pointsPerGame, winBy, side1:{name,club}, side2:{name,club}}], truncated}}`.

## Làm mới trang công khai — `POST /admin/events/:id/revalidate`

- Quyền `tournaments.update`. → `{data:{id}, warnings?}`.

## Export — `GET /admin/exports/schedule?eventId`, `/admin/exports/results?eventId`

- Quyền `tournaments.list`. Tải xlsx (link trực tiếp như export entry).

## Vòng đời kết quả — `/admin/matches/:id/...`

Mọi mutation cần `expectedVersion`; trả `{data: MatchDetail, warnings?}`.

| Route | Quyền | Body | Ghi chú |
|---|---|---|---|
| `POST start` | `matches.update` | `{expectedVersion}` | SCHEDULED → LIVE |
| `POST un-start` | `matches.update` | `{expectedVersion}` | LIVE → SCHEDULED, xóa ván đã lưu |
| `POST save-progress` | `matches.update` | `{expectedVersion, games:[{score1,score2}]}` | LIVE; ván cuối được dở |
| `POST confirm` | `matches.confirm` | như lát cắt | |
| `POST amend-scores` | `matches.amend` | `{expectedVersion, games, reason}` | OFFICIAL; lý do `MATCH_REASON_MIN_LENGTH`..`MAX` (`@kamito/shared`) |
| `GET reopen-preview` | `matches.reopen` | — | `{data:{affected: Cell[], blocking: Cell[]}}` |
| `POST reopen` | `matches.reopen` + step-up | `{expectedVersion, reason, force?, expectedBlockingIds?}` | `expectedBlockingIds` bắt buộc khi `force`; trả thêm `impact` |

- Cell: `{matchId, matchNo, side, entryId, entryName, status, effect: 'CLEAR_SIDE'|'REVERT_AUTO'|'RESET_RESULT', via: 'ADVANCE'|'SEAT'}`. `RESET_RESULT` = ô bị chặn (trận đã đấu).
- Lỗi: 409 `MATCH_VERSION_CONFLICT` (`currentVersion`), 409 `MATCH_STATE_INVALID`, 422 `SCORE_INVALID` (`issues[]`), 400 `MATCH_WINNER_CHANGED` (hướng sang Mở lại), 409 `AMEND_CHANGES_PLACED_RANKS` (hướng sang Mở lại), 409 `REOPEN_BLOCKED` (`error.preview`), 409 `REOPEN_IMPACT_CHANGED` (`error.preview` mới), 403 `STEP_UP_REQUIRED`.
- Mở lại trận bảng gỡ mọi suất của bảng đó khỏi nhánh chính (cố ý, an toàn) — preview phải nói rõ.

## Lưu ý hiển thị

- Ô nhánh đã có VĐV (`source = ENTRY`) giờ vẫn giữ `sourceRef` (nhãn Q/bảng gốc). Màn admin bỏ qua `sourceRef` khi `source = ENTRY`.
