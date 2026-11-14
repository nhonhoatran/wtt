# Review phase 07 — nửa "scheduling" (sessions, xếp lịch, conflict, export, revalidate)

Ngày: 2026-11-14 · Phạm vi: code chưa commit (git diff + untracked) · Chế độ: read-only

## Phạm vi

- Prisma: `sessions.prisma`, thay đổi `draws-and-matches.prisma`, `tournament-catalog.prisma`, `tournament-event.prisma`, migration `20261114064027_add_sessions_and_match_scheduling`
- `packages/shared/src/tournament-settings.ts` (`schedule.minRestMinutes`, `schedule.sessionMatchCap`)
- `apps/api/src/modules/sessions/**`, `scheduling/**`, `exports/**` (schedule/results), `revalidation/admin-revalidation.controller.ts`, `cache-tags.ts` (schedule/session/event.refresh), `matches/match-query.service.ts`, `match-result-view.ts`, `app.module.ts`
- Test: `test/scheduling.e2e-spec.ts`, `test/scheduling-outputs.e2e-spec.ts`, `test/support/scheduling-fixtures.ts`

## Đã kiểm chứng

- `npx tsc -p tsconfig.json --noEmit` (apps/api): pass.
- `npx vitest run src/modules/scheduling src/modules/sessions test/scheduling.e2e-spec.ts test/scheduling-outputs.e2e-spec.ts`: 4 file, 26/26 pass (Postgres local `localhost:5433/kamito_tt_dev` + Redis).
- `prisma migrate status`: up to date. `prisma migrate diff --from-config-datasource --to-schema prisma/schema`: "empty migration", tức SQL migration khớp schema.
- Có cảnh báo `DeprecationWarning: Calling client.query() when the client is already executing a query` (pg 8.23.1). Stack trace dẫn vào bên trong Prisma 7.10 (`interpretNode` → `Array.map`), không chỉ ra được dòng code của diff này.

## Đánh giá chung

Code gọn, file đều dưới 200 dòng. Thứ tự khóa giữa các thao tác xếp lịch đúng: khóa các dòng session theo id đã sort, rồi tới trận, rồi trận đang chiếm ô; kiểm lại `sessionId` sau khi khóa. `scheduleVersion` tách hẳn khỏi `Match.version`. Thuật toán conflict thuần (pure), có unit test. Giờ được tính từ giờ ngay tại sân (wall clock) theo múi giờ của giải, có tính tới DST. Test chạy trên DB thật, không mock.

Lỗ hổng chính nằm ở **trận "ẩn" vẫn còn giữ chỗ trong session**: trận bị hủy kết quả (voided), trận walkover, trận của nhánh đã gỡ công bố. Ngoài ra còn thiếu tag revalidate, có nguy cơ deadlock khi tính lại giờ đụng lúc nhập kết quả, và tính lại giờ đang update từng dòng một.

**Điểm: 7/10 · Critical: 0 · High: 2 · Medium: 6 · Low: 7**

## High

### H1. Trận voided / nhánh bị gỡ công bố kẹt luôn trong session: không gỡ xếp được, session không xóa được, bàn không bỏ ra được
- `apps/api/src/modules/scheduling/scheduling.service.ts:89-92`: chặn `isVoided`, `draw.status !== 'PUBLISHED'`, `WALKOVER` **trước cả** nhánh `sessionId: null`, nên bỏ xếp cũng bị 409.
- `apps/api/src/modules/draws/group-withdrawal.service.ts:67` + `packages/competition-engine/src/group-withdrawal-plan.ts:29-31`: rút VĐV với VOID_ALL_RESULTS sẽ void **mọi** trận của entry, gồm cả trận SCHEDULED đã xếp. Không ai xóa `sessionId/tableId/orderInSession` của các trận này.
- Lưới (`match-query.service.ts` base where có `isVoided: false, draw.status PUBLISHED`) không hiện các trận này. Nhưng chúng vẫn:
  - được đếm trong `sessions.service.ts:141` (SESSION_HAS_MATCHES) và `:164` (SESSION_TABLE_IN_USE). Kết quả: session/bàn **không bao giờ** xóa hay bỏ được, người dùng cũng không thấy trận nào để gỡ;
  - chiếm thời lượng trong `session-timeline.ts:12-16` (không lọc), nên lịch có "khoảng trống ma";
  - bị `lockOccupant` (`scheduling.service.ts:118`) tìm ra là trận đang chiếm ô. Ô trên lưới trông trống nhưng trả 409 "Ô đã có trận khác"; hoặc tệ hơn là **swap** trận voided / trận nhánh DRAFT sang ô cũ (dòng 123 chỉ kiểm `status`, không kiểm void/draw);
  - được tính vào trần `sessionMatchCap` (`:107`) và vào `_max.orderInSession` (`:109`).
- Fix (chọn 1 hoặc kết hợp):
  1. Cho phép bỏ xếp (`sessionId: null`) với mọi trận không LIVE/OFFICIAL: chuyển check void/draw/WALKOVER xuống sau nhánh unschedule.
  2. Khi void trận (group-withdrawal) và khi gỡ công bố hoặc dựng lại nhánh (`draw-persistence.service.ts:26 clearStructure`): xóa luôn slot lịch, khóa session, rồi `recomputeSessionTimes`.
  3. `recomputeSessionTimes`, `lockOccupant`, phần đếm cap và `_max` đều lọc `isVoided: false` (và `draw.status PUBLISHED` cho occupant).

### H2. Tính lại giờ update tuần tự từng dòng, `session.update` chạy với timeout mặc định 5 s
- `apps/api/src/modules/scheduling/session-timeline.ts:20-30`: mỗi trận đổi giờ là 1 `tx.match.update` round-trip. Đổi `startTime` session (hay gặp ngày thi đấu: "session trễ 30 phút") làm đổi giờ **toàn bộ** trận, tức tới `sessionMatchCap` (mặc định 500, tối đa 2000) lệnh UPDATE nối nhau.
- `apps/api/src/modules/sessions/sessions.service.ts:83`: `$transaction(async ...)` không truyền `timeout` nên dùng mặc định 5000 ms của Prisma. Gặp DB ở xa hoặc đang tải thì sẽ dính P2028, ra 500, admin không đổi giờ session được. (Chưa đo; đây là suy luận từ số round-trip.)
- Fix: một câu SQL duy nhất `UPDATE "Match" m SET "scheduledAt" = v.t FROM (VALUES ...) v(id, t) WHERE m.id = v.id AND m."scheduledAt" IS DISTINCT FROM v.t RETURNING m."matchNo"`. Có thể tính luôn bằng window function `SUM(minutes) OVER (PARTITION BY "tableId" ORDER BY "orderInSession")`. Đồng thời đặt `timeout` cho transaction của `sessions.update` giống `scheduling.service.ts:55`.

## Medium

### M1. Tag revalidate thiếu trang nhánh và trang bảng, dù các trang này đang hiện giờ trận
- `public-bracket.serializer.ts:76` và `public-match.serializer.ts:16,44` (dùng ở `public-groups.query.ts:59`) đều trả `scheduledAt`. Client fetch trang nhánh với tag `draw-{slug}-{code}` và trang bảng với `groups-{slug}-{code}` (`apps/client/src/lib/public-data.ts:50,54`).
- `cache-tags.ts` `scheduleTags` chỉ có `event`, `schedule`, `match-N`. Hệ quả: đổi lịch hoặc đổi giờ session thì trang nhánh/bảng hiện giờ cũ cho tới khi TTL `MATCHDAY_REVALIDATE_SECONDS` hết hạn.
- Fix: `ScheduleTagContext` thêm `subEventCodes` (lấy từ các trận trong `matchNos`) và sinh thêm `t.draw(slug, code)` + `t.groups(slug, code)`. Áp dụng cho cả `session.update`.

### M2. Deadlock giữa việc tính lại giờ và việc nhập kết quả, ra 500
- Bên lịch: khóa Session → Match(moved) → occupant → UPDATE các trận trong session theo thứ tự `tableId, orderInSession` (`session-timeline.ts:14,26`). `sessions.update` cũng UPDATE cả session.
- Bên kết quả (`match-lock.ts:14-24` + bracket-advance): khóa Draw → Match X FOR UPDATE → UPDATE trận kế Y.
- Ví dụ: đổi giờ session (hoặc kéo trận làm X đổi giờ) đúng lúc trọng tài chốt X. Bên lịch đã update Y rồi chờ X, bên kết quả giữ X rồi chờ Y. Postgres phát hiện 40P01 và hủy một bên. Repo không xử lý `P2034/40P01` ở đâu cả (đã grep `apps/api/src`), nên client nhận 500.
- Dữ liệu không hỏng (rollback), nhưng ngày thi đấu sẽ gặp lỗi khó hiểu.
- Fix: retry transaction 1–2 lần khi gặp 40P01/P2034, hoặc map ra 409 "Vui lòng thử lại". Có thể giảm khả năng va chạm bằng cách không retime trận LIVE/OFFICIAL (xem L1).

### M3. Conflict tính trên toàn giải cho mỗi lần list và mỗi lần PATCH
- `match-query.service.ts` (listForEvent): `items.some(m => m.sessionId)` là gọi `ScheduleConflictService.forEvent(eventId)`. Hàm này nạp **mọi** trận đã xếp của giải, kèm side → competitor → player/pair → 2 player và 3 lớp matchFormat. Mỗi lần gọi là một bộ query nặng, dù không phải N+1.
- Trang Nhập tỷ số dùng cùng endpoint này (lọc session, có thể tự refresh), không cần conflict, nhưng vẫn phải trả chi phí đó. Danh sách có phân trang (không lọc session) cũng tính cho cả giải chỉ để phục vụ 1 trang dữ liệu.
- Fix: chỉ tính khi lọc theo `sessionId`, hoặc thêm `include=conflicts`. Giới hạn cửa sổ thời gian theo `[minScheduledAt - maxDuration - minRest, maxEnd + minRest]` của các trận trong trang. Nên thêm index `@@index([eventId, scheduledAt])` (cũng có lợi cho `public-matches.query.ts:62` lọc theo ngày).

### M4. Swap theo ô, không theo trận người dùng thấy, nên có thể đổi chỗ với trận "lạ"
- `scheduling.service.ts:117-125`: occupant được đọc lại dưới khóa, và cứ trận nào đang nằm ở ô lúc đó là bị swap. Chỉ trận được kéo mới có kiểm `expectedScheduleVersion`.
- Ví dụ: admin A đang nhìn ô T1#3 có trận Z. Admin B vừa đưa W vào T1#3. A kéo Y vào ô đó thì W bị đá sang ô cũ của Y mà không ai hay.
- Fix: body thêm `expectedOccupantId` (null = ô trống). Không khớp thì trả 409 `SCHEDULE_SLOT_OCCUPIED` "Ô vừa được thay đổi".

### M5. Đổi múi giờ của giải không quy đổi lại các session
- `event-dtos.ts:49` cho phép `timezone` trong `updateEventBody`. `events.service.ts` không xử lý session.
- `EventSession.startTime` là instant UTC (`sessions.prisma` comment "read together with event timezone"). Đổi tz thì HH:mm hiển thị bị lệch (vd 08:00 thành 07:00), `date` (DATE) có thể không còn khớp ngày local của `startTime`, export `instantToHhmm` cũng lệch theo.
- Fix: khi đổi `timezone` mà giải đã có session thì hoặc chặn (409 kèm số session), hoặc trong cùng transaction quy đổi lại `startTime/endTime` của từng session theo wall clock cũ (`instantToHhmm(old tz)` → `zonedTimeToInstant(new tz)`) rồi `recomputeSessionTimes`.

### M6. Walkover đã chốt vẫn chiếm thời lượng, không gỡ được
- Rút VĐV theo kiểu walkover (`group-withdrawal-plan.ts:35`) hay walkover KO làm trận thành WALKOVER. Trận vẫn ở trong session, `session-timeline.ts` vẫn cộng `estimatedMinutes`, còn PATCH bỏ xếp bị chặn (`scheduling.service.ts:89-90`).
- Kết quả: giờ của các trận sau trên cùng bàn bị đẩy trễ vô cớ.
- Fix: trong timeline cho trận `resultType IN (WALKOVER, BYE)` hoặc `isVoided` có thời lượng 0. Hoặc cho phép bỏ xếp trận WALKOVER.

## Low

- **L1** `session-timeline.ts`: retime cả trận LIVE/OFFICIAL, làm giờ "dự kiến" của trận đã đấu bị đổi khi chèn trận lên trước hay đổi giờ session. Trận đã đấu hiện trên results strip / trang trận với giờ mới. Nên giữ nguyên `scheduledAt` của trận LIVE/OFFICIAL và cho con trỏ đi tiếp từ `max(cursor, scheduledAt + duration)`.
- **L2** `scheduling-dtos.ts:3` `MAX_ORDER = 1000` lệch với `schedule.sessionMatchCap` max 2000 (`tournament-settings.ts`). Đường tự nối cuối (`scheduling.service.ts:110`) không bị chặn bởi 1000, nhưng kéo thả tay tới ô > 1000 thì bị 422. Nên bỏ trần cứng hoặc lấy theo cap.
- **L3** `scheduling.service.ts:106-107`: swap từ session khác vào session đã đầy bị `SESSION_FULL`, dù số trận không đổi. Nên bỏ qua check cap khi có occupant.
- **L4** `scheduling.service.ts:84,90`: đọc `draw.status` mà không khóa Draw. Có thể race với unpublish (unpublish khóa Draw). Hậu quả nhẹ vì trận nhánh DRAFT chỉ "ẩn" (rơi vào H1).
- **L5** `scheduling.service.ts:138` `Promise.all(... recomputeSessionTimes(tx, id))` chạy song song trên cùng một connection của transaction. pg@9 sẽ bỏ kiểu này (xem DeprecationWarning ở trên), và thứ tự ghi không xác định. Nên chạy tuần tự `for ... of`.
- **L6** Export (`match-export-support.ts`, `xlsx-stream.ts`):
  - Nếu lỗi trước byte đầu, `abortDownload` ném lỗi nhưng header `Content-Type: xlsx` + `Content-Disposition` đã set, nên body JSON lỗi bị tải về thành file .xlsx hỏng. Cần `res.removeHeader(...)` trước khi throw. Pattern cũ từ entries export, giờ nhân lên thêm 2 chỗ.
  - Vòng lặp không kiểm `res.destroyed`, client hủy tải thì vẫn query hết.
  - Mỗi trang query riêng lẻ, không cùng snapshot, nên đổi lịch giữa chừng có thể làm trùng hoặc sót dòng.
  - Chưa có test nào vượt qua `PAGE = 1000` để kiểm cursor với `orderBy [scheduledAt, matchNo]` (chưa kiểm chứng trên Prisma 7 query compiler).
- **L7** Index/guard nhỏ:
  - `Match.tableId` có FK nhưng không có index đứng đầu bằng `tableId`, nên xóa VenueTable phải seq scan Match.
  - `venues.service.ts:43` usage chỉ đếm `events`. Venue có session thì vẫn ra 409 chung `IN_USE` nhờ `rethrowForeignKeyAsInUse`, nhưng thiếu `dependants.sessions`.
  - `match-sheets.service.ts:32` sắp bàn theo `VenueTable.order`, không theo `EventSessionTable.order` (thứ tự cột của lưới), nên thứ tự in phiếu khác thứ tự trên lưới.
  - `event.refresh` (`eventVisibilityTags`) không có tag `player-*`.

## Kiểm theo checklist

- **Đồng thời:** Lịch với lịch, và session.update với lịch, được serialize nhờ khóa dòng EventSession. Test "same scheduleVersion → 200 + 409" là test thật. Lịch với kết quả: xem M2.
- **Hợp đồng Q2:** (i) lọc theo session trả trọn session, có `truncated` và `conflicts[]`: OK. (ii) bỏ xếp bằng `sessionId: null`: OK. (iii) server tự tính `scheduledAt`: OK. (iv) chỉ SCHEDULED: OK, nhưng gây ra H1/M6.
- **Quyền:** PATCH schedule dùng `tournaments.update` (RESULTS_OPERATOR bị 403, có test). Session CRUD dùng `tournaments.*`. Match-sheets dùng `matches.list`. Export dùng `tournaments.list`. Revalidate dùng `tournaments.update` (đúng Q4). Kiểm IDOR: session phải thuộc giải của trận, bàn phải thuộc session, `update/remove` lọc theo `eventId`. OK.
- **Migration và FK:** `Match.sessionId` RESTRICT. EventSession CASCADE theo Event. EventSessionTable CASCADE theo session, RESTRICT theo bàn. Xóa Event chỉ được khi `subEvents: none` (`events.service.ts:104`), lúc đó không còn Match, nên không bị RESTRICT chặn khi cascade. Không drift (đã kiểm `migrate diff`).
- **Cấu hình động:** `minRestMinutes` và `sessionMatchCap` đều nằm trong AppSetting, có min/max. Hằng `MAX_TABLES` có ghi lý do. `MAX_ORDER` chưa có lý do (L2). Timeout 30 s theo convention của repo.
- **Comment:** tiếng Anh, ít, đúng luật.

## Chất lượng test

- Điểm tốt: dùng Postgres + Redis thật. Có kiểm audit, kiểm 403 cho operator, kiểm tz `Asia/Ho_Chi_Minh` → UTC, unit test tz cho New_York, kiểm conflict qua cặp đôi và conflict trùng bàn giữa 2 session chồng giờ, kiểm tag đã enqueue trong BullMQ.
- `scheduling.e2e-spec.ts:118` tên test "recomputes the times of the column it left" nhưng **không assert cột bị rời**: không có trận nào nằm sau `b` ở cột cũ. Cần thêm trường hợp bỏ xếp hoặc dời trận đầu cột, rồi kiểm các trận sau dồn lên.
- Còn thiếu:
  - swap giữa 2 session khác nhau;
  - `SESSION_FULL`;
  - đổi `date` của session;
  - trận voided hoặc WALKOVER nằm trong session (H1/M6);
  - session.update chạy đồng thời với PATCH schedule (bỏ bàn đúng lúc đang xếp vào bàn đó);
  - export nhiều hơn 1000 dòng.
- `scheduling.e2e-spec.ts:176` reset lịch bằng `prisma.updateMany` (không qua API). Chấp nhận được cho bước setup.
- Các `it` phụ thuộc trạng thái của test trước (chạy tuần tự), nên khó chạy riêng từng test.
- Chưa có test bao phủ route cho `cache-tags` (spec: "mọi route ghi có trong bảng hoặc `NO_PUBLIC_EFFECT`"). Code đang ghi "later part of phase 07".

## Việc nên làm (theo thứ tự)

1. H1 + M6: cho bỏ xếp trận không LIVE/OFFICIAL; xóa slot khi void, unpublish hoặc dựng lại nhánh; lọc trận voided khỏi timeline/occupant/cap.
2. H2: tính lại giờ bằng 1 câu UPDATE và đặt timeout cho `sessions.update`.
3. M1: thêm tag `draw-*` / `groups-*` vào `scheduleTags`.
4. M2: retry hoặc map lỗi 40P01/P2034.
5. M4: thêm `expectedOccupantId`.
6. M3: chỉ tính conflict khi cần và giới hạn theo cửa sổ thời gian.
7. M5: chặn hoặc quy đổi session khi đổi tz.
8. Bổ sung test như mục trên.

## Câu hỏi chưa chốt

- Trận đã đấu có nên giữ nguyên `scheduledAt` (giờ dự kiến lịch sử) khi lịch thay đổi không? (L1)
- Trận WALKOVER / voided nằm trong session: tự động gỡ slot, hay giữ lại và cho thời lượng 0?
- Đổi múi giờ của giải: chặn hay tự quy đổi session?
