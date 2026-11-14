# Phase 07 — Xếp lịch theo ngày/session/bàn, nhập, chốt và sửa tỷ số

## Context Links

- [Site tham chiếu §3.4 Matches/Event Info (Provisional Schedule), §4 trạng thái trận, lịch theo session/bàn, matchConfig](../reports/researcher-261111-1450-worldtabletennis-site-feature-and-layout-analysis.md)
- [Brainstorm §2 tỷ số theo ván, §3 realtime chưa cần, §7 "cập nhật trong vài giây"](../reports/brainstorm-261111-1512-kamito-table-tennis-tournament-platform.md)
- [Phase 02 — Spike E (revalidate)](./phase-02-spikes-refine-antd-better-auth-dokploy-nextjs-revalidation.md)
- [Red team đã phân xử: nhóm 2, 3, 5, 6, 13, 15](./reports/red-team-261111-1614-adjudicated-findings.md)
- Phase trước: [phase-06](./phase-06-draws-seeding-groups-and-bracket-generation.md)

## Overview

<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Priority: P1. Status: Hoàn thành (chưa deploy staging). ≈9 ngày công (ước lại từ 6 ngày; gồm ui-consistency ≈0,5 ngày), làm 2 đợt:
  - **Lát cắt (tuần 5–6, ≈3,5 ngày):** validator tỷ số, `start` + `confirm` có `expectedVersion`, đẩy nhánh (gồm BYE), màn nhập tỷ số tối thiểu, module revalidation (enqueue + `cache-tags.ts` + processor) theo kết quả Spike E.
  - **Phần còn lại (tuần 11–12, ≈5,5 ngày):** session + xếp lịch tay trên lưới + cảnh báo trùng, `save-progress`, `un-start`, `amend-scores`, `reopen` có xem trước ảnh hưởng + đường cưỡng chế, tính lại BXH bảng dưới khóa, test đồng thời, nút "Làm mới trang công khai", in phiếu trận, export đồng bộ.
- Phạm vi xếp lịch: chỉ xếp tay trên lưới, đủ cho quy mô giải hiện tại; các mục dời xem "Để giai đoạn sau" trong [plan.md](./plan.md#để-giai-đoạn-sau-ngoài-phạm-vi).

## Key Insights

- Không chấm từng điểm: chỉ lưu tỷ số từng ván. `LIVE` chỉ là nhãn "đang đấu" + các ván đã lưu tạm.
- Mọi hiệu ứng phụ sau chốt (đẩy nhánh, BXH bảng, dấu `rankingDirtyAt`) chạy đồng bộ trong transaction của API → nhất quán; chỉ việc ngoài DB (revalidate, tính điểm xếp hạng) đi qua BullMQ có retry. Không bảng outbox; dấu `SubEvent.rankingDirtyAt` (phase 09) là trạng thái bền thay cho outbox.
<!-- Red Team: Sửa kết quả và toàn vẹn khi chốt đồng thời — 2026-11-11 -->
- Sửa kết quả có 3 mức tách bạch: sửa tỷ số không đổi người thắng (an toàn, luôn cho phép) / mở lại (đổi người thắng, lan qua các ô sau chưa đấu) / cưỡng chế (khi trận sau đã đấu, chỉ `ADMIN`).
- `Match.version` cho khóa lạc quan mọi mutation trận; lịch dùng `Match.scheduleVersion` riêng → sửa lịch không làm hỏng tỷ số đang nhập và ngược lại.
<!-- Red Team: Revalidate Next.js chưa kiểm chứng — 2026-11-11 -->
- Ngữ nghĩa revalidate theo tag (hết hạn ngay hay stale-while-revalidate) phụ thuộc bản Next.js → dùng đúng kết luận của Spike E; không suy đoán.
<!-- Red Team: Job ID cố định làm rơi lần tính lại xếp hạng — 2026-11-11 -->
- Job id cố định làm debounce có thể làm BullMQ bỏ qua job mới khi job cũ cùng id còn được giữ lại (theo reviewer; kiểm trên bản cài) → job revalidate dùng id duy nhất; revalidate là thao tác idempotent nên chạy trùng vô hại.
<!-- Spike E results — 2026-11-12 -->
- Client dùng `revalidateTag(tag, { expire: 0 })` trong route handler (Next 16.4.3 đã ghim). Không dùng `'max'` (request đầu vẫn HTML cũ), không dùng dạng 1 tham số (deprecated). Đo cục bộ: request đầu sau revalidate có HTML mới.
- Tag dựng từ id/mã trong URL (vd `match-{id}`), khai báo trước khi fetch. Trang công khai fetch với tag + `next.revalidate: MATCHDAY_REVALIDATE_SECONDS` làm trần TTL, phòng khi lệnh revalidate bị mất. Revalidate chỉ là tăng tốc.
- Worker gọi `POST {CLIENT_INTERNAL_URL}/api/revalidate` (header secret, body `{ tags: [...] }`); lô nhiều tag, kiểm độ dài ≤ 256.
- Chưa kiểm: nhiều replica client (cache theo instance, lệnh chỉ trúng 1 instance); `'use cache'`/`cacheTag`; hành vi trên Docker thật.

<!-- Phase 03 sync — 2026-11-12 -->
- Phase 03 đã có sẵn: idle timeout (mặc định ví dụ 60 phút, chỉnh `auth.session.idleMinutes` trên `/settings`) áp cho máy bàn điều hành; `@RequireStepUp()` + StepUpGuard + `step-up-modal.tsx` + `POST /api/v1/auth/step-up` (trả hạn nhập lại mật khẩu, `auth.stepUp.ttlMinutes`).
- Ma trận quyền hiện có: `start`, `un-start`, `save-progress` đi qua `matches.update` (không có action riêng); `confirm`, `amend` là `matches.confirm`, `matches.amend` (RESULTS_OPERATOR có); `reopen`, `force-reopen` là `matches.reopen` (chỉ ADMIN).
- Trang chủ RESULTS_OPERATOR hiện là khung `role-home-page.tsx`; màn nhập tỷ số làm ở phase này.

<!-- Phase 04 sync — 2026-11-12 -->
- `cache-tags.ts` chưa có. Hook đã đặt sẵn ở `apps/api/src/modules/events/events.service.ts:15` (create/update/publish/cancel/delete giải). Sub-event (`apps/api/src/modules/sub-events/sub-events.service.ts`) và AppSetting (`apps/api/src/modules/settings/`) chưa có hook; thêm khi làm.

<!-- Phase 05 sync — 2026-11-12 -->
- Cần ánh xạ trong `cache-tags.ts`: entry (tạo, sửa, rút, hàng loạt — `apps/api/src/modules/entries/`), VĐV (tạo, sửa; đổi tên làm mới `displayName` của Competitor), cặp (tạo ngầm cùng entry), gộp VĐV (`players/player-merge.service.ts`).
- Import commit chạy trong worker (`apps/worker/src/processors/import-commit-processor.ts`) và ghi entry/VĐV → phải enqueue revalidate từ worker, không chỉ từ API. Chưa có cơ chế này.
- Route chỉ ghi bảng import (tạo job, validate, sửa dòng) → `NO_PUBLIC_EFFECT` trong test phủ.

<!-- Phase 06 sync — 2026-11-13 -->
- Walkover treo (`apps/api/src/modules/draws/knockout-walkover.ts`): `settleDeferredWalkover(tx, matchId)` phải được gọi sau mọi thao tác đưa VĐV vào ô trận, kể cả khi đẩy người thắng lên vòng sau. `settlePendingWalkovers(tx, drawId)` đã dùng khi công bố.
- Marker walkover treo = `resultType = WALKOVER` + `status = SCHEDULED` + `winnerSide` trỏ tới ô đang trống. Trận như vậy không tính là đã đấu và không nhận kết quả nhập.
- Khóa bảng: `GroupStandingsService.lockForWrite(tx, groupId)` rồi `recompute(tx, groupId)` trong cùng transaction (`apps/api/src/modules/groups/group-standings.service.ts`). Chốt trận vòng bảng dùng đúng cặp này. Test đồng thời đã có: `apps/api/test/group-standings-concurrency.e2e-spec.ts`.
- `matchNo` do `allocateMatchNumbers` (`packages/db/src/domain/draw-locks.ts`) cấp, không cấp số khác.
- Đã có trong schema `Match`: `sessionId`, `scheduleVersion` (`packages/db/prisma/schema/draws-and-matches.prisma`). Bảng `sessions` vẫn cần migration phase này.
- `cache-tags.ts` vẫn chưa có. Publish và thao tác sau công bố chưa revalidate (ghi nợ: `apps/api/src/modules/draws/draw-publish.service.ts:18`). Khi tạo `cache-tags.ts`, đăng ký mutation draw/trận/bảng và việc revalidate khi công bố.
- Revalidate tag cho VĐV đã gộp: cả hồ sơ A và B.
- Mẫu chặn thao tác khi đã công bố có sẵn: `EVENT_PUBLISHED` 409 ở `sub-events.service.ts:125`. Dùng cùng mẫu cho sửa/xóa sau công bố.
- Lọc vòng đời theo múi giờ từng giải: `apps/api/src/modules/events/event-lifecycle-filter.ts`, `packages/shared/src/lifecycle-from-dates.ts`.

<!-- Phase 07 slice sync — 2026-11-13 -->
- Đã xong (lát cắt): validator tỷ số; `start` + `confirm` có `expectedVersion`, khóa Draw → Group → Match, đẩy nhánh + BYE, BXH bảng tính lại trong transaction, audit; module revalidation (`cache-tags.ts` cho `match.start`, `match.confirm`, `draw.publish`; job id duy nhất; lỗi enqueue → 200 + `PUBLIC_REFRESH_DELAYED`); worker `revalidate-processor.ts`; màn "Nhập tỷ số" tối thiểu; trang chủ RESULTS_OPERATOR.
- Kiểm: typecheck, lint, build pass. Test: api 320/320 (e2e trên Postgres local), competition-engine 209/209, shared 86/86, worker 34/34, admin 5/5. Sau sửa review: `match-results.e2e-spec.ts` 11/11, revalidation unit 3/3.
- Chưa kiểm: màn nhập tỷ số chưa test trên trình duyệt, chưa thử 1024 px; chưa chạy `ui-consistency:finding-patterns` / `verifying`; chưa deploy staging.
- Ghi nợ:
  - ~~Client chưa có route `/api/revalidate` (phase 08).~~ **Đã đóng 2026-11-13:** route có ở phase 08 (`app/api/revalidate/route.ts`).
  - Thao tác draw sau công bố: **unpublish, replaceEntry, withdrawEntry đã đóng 2026-11-13** (tag `draw.unpublish`, `draw.postPublishEdit`). ~~Còn mở: place/group qualifiers; `draw.publish` chưa có tag `match-*`; rút/đổi entry sau công bố chỉ gửi tag draw.~~ **Đã đóng 2026-11-14:** `draw.publish` và các thao tác sau công bố có tag `match-*` (`draws/draw-tag-context.ts`); rút/đổi entry gửi thêm `player-*` của VĐV cũ và mới (`draws/draw-post-publish.service.ts`); `place-qualifiers` và `place-group-qualifiers` trên MAIN đã công bố gửi `draw.placeQualifiers` (`draws/draw-edit.service.ts`, `draws/group-qualifier.service.ts`).
  - ~~Tag còn thiếu: entry, VĐV, gộp VĐV, sub-event, AppSetting (chờ phase 04/05); `match.start` chưa có tag VĐV; VĐV thua walkover trong cascade chưa có tag.~~ **Đã đóng 2026-11-14:** tag entry/VĐV/gộp/sub-event/AppSetting (`cache-tags.ts:154-181`); `match.start` có tag VĐV (`matchWithPlayerTags`); VĐV thua walkover trong cascade có tag ở đường chốt trận (`bracket-advance.ts:10, 47`). Đường rút/đổi entry sau công bố: xem dòng draw ở trên.
  - ~~Chưa có test phủ `cache-tags` (`cache-tags-coverage.e2e-spec.ts`).~~ **Đã đóng 2026-11-14:** file có (`apps/api/test/cache-tags-coverage.e2e-spec.ts`); báo cáo phiên: 92 route ghi admin, 0 chưa ánh xạ (chưa chạy lại khi sync).
  - ~~Thể thức: `confirm` lấy `round ?? draw ?? subEvent`, còn `GroupStandingsService.compute` bỏ qua round (L8).~~ **Đã đóng 2026-11-14:** một hàm `pickMatchFormat` (`apps/api/src/modules/draws/round-format-view.ts`) dùng cho `confirm`, thời lượng xếp lịch và BXH bảng (`groups/group-standings.service.ts`). Engine `scoreMatch` nhận thể thức theo từng trận.
  - ~~`settleDeferredWalkover` không tăng `version` trận được điền (L10, từ phase 06).~~ **Đã đóng 2026-11-14:** `apps/api/src/modules/draws/knockout-walkover.ts:32` tăng `version`.
  - ~~`new URL('/api/revalidate', base)` bỏ path con của `CLIENT_INTERNAL_URL` (L11).~~ **Đã đóng 2026-11-14:** `revalidateUrl()` giữ path con (`apps/worker/src/processors/revalidate-processor.ts:11`, test `revalidate-processor.test.ts`).
  - ~~Hằng vận hành đang fix cứng (L12).~~ **Quyết định 2026-11-14: giữ fix cứng**, có comment nêu lý do trong code. Đây là hằng số độ tin cậy nội bộ, không phải tham số nghiệp vụ hay vận hành: timeout enqueue 2 s, 5 lần thử và backoff 2 s (`packages/shared/src/revalidate-job-options.ts`); `MATCH_WRITE_TIMEOUT_MS` 30 s (`match-results/match-write-runner.ts:12`); `SCHEDULE_TX_TIMEOUT_MS` 30 s (`scheduling/schedule-tx.ts:5`); `SEARCH_DEBOUNCE_MS` 300 ms (`apps/admin/src/components/use-debounced-value.ts:4`). `CHECK_DEBOUNCE_MS` 400 ms của ô kiểm slug cũng giữ cố định, có comment lý do (2026-11-14).
  - ~~Picker giải lấy tối đa 100 giải rồi lọc phía client, trái luật lọc phía server (L13).~~ **Đã đóng 2026-11-14:** tìm kiếm gửi `q` lên API, kích thước trang theo `useListPageSize` (`apps/admin/src/pages/results/use-results-event.ts`).
  - ~~E2e còn thiếu: chốt đồng thời 2 trận cùng bảng; cascade walkover khi đẩy nhánh; RESULTS_OPERATOR bị 403 khi reopen~~ **Đã đóng 2026-11-14:** chốt đồng thời (`match-concurrency.e2e-spec.ts:51, 76`); cascade walkover (`draw-post-publish.e2e-spec.ts:180`, `match-reopen-qualifier-and-walkover.e2e-spec.ts:148`); 403 khi reopen (`match-reopen.e2e-spec.ts:66`). ~~RETIRED có ván dở~~ **Đã đóng 2026-11-14:** `apps/api/test/match-retired-format-and-redis-down.e2e-spec.ts` (RETIRED kèm ván dở; đội thắng thiếu ván vẫn xác nhận được theo thể thức vòng). Còn mở: chuỗi Q → BYE → R2 khi reopen (theo báo cáo phiên vẫn chỉ có unit).
  - ~~Lỗi có sẵn, không do lát cắt: `apps/api/test/draws.e2e-spec.ts:325` đậu/rớt ngẫu nhiên~~ **Đã sửa 2026-11-13:** test đọc `placementSeed` từ audit thay vì đoán (`draw-edit.service.ts:78`); 6/6 lượt xanh.
- ~~Câu hỏi mở: route `/api/revalidate` giữ ở phase 08 hay kéo vào lát cắt?~~ **Đã chốt 2026-11-13:** làm trong lát cắt phase 08.

<!-- Phase 07 sync — 2026-11-14 -->
- Đã xong (backend `4c7124b`..`07f2500`, UI `8173f28`..`00eb3e3`; xem `git log 478ad88..HEAD`):
  - Migration `20261114064027_add_sessions_and_match_scheduling`, `20261114071907_add_match_schedule_indexes` (áp dụng DB dev local; chưa staging).
  - Sessions CRUD; xếp lịch tay có `scheduleVersion`, hoán đổi, cảnh báo trùng (setting `schedule.minRestMinutes`), trần số trận mỗi session (`schedule.sessionMatchCap`), tính lại giờ theo múi giờ giải.
  - `save-progress`, `un-start`, `amend-scores`, `reopen` (xem trước, cưỡng chế, step-up, `expectedBlockingIds`); khóa theo bảng; P2034/40P01 → 409 `CONCURRENT_UPDATE_RETRY` (`apps/api/src/common/filters/http-exception.filter.ts`).
  - Tính lại BXH bảng dưới khóa; test đồng thời `apps/api/test/match-concurrency.e2e-spec.ts` (5 ca).
  - In phiếu trận: `apps/admin/src/pages/event-hub/match-sheets-print-page.tsx`. Export lịch/kết quả xlsx đồng bộ: `apps/api/src/modules/exports/`.
  - Revalidate: `POST /admin/events/:id/revalidate` (nút "Làm mới trang công khai" ở `apps/admin/src/pages/event-hub/schedule-actions.tsx`); `cache-tags.ts` phủ mutation lịch, trận, draw, bảng; test phủ `apps/api/test/cache-tags-coverage.e2e-spec.ts`.
- UI: tab lịch, session modal, lưới, panel trận chưa xếp, trang in, màn nhập tỷ số (start, un-start, save-progress, amend, reopen). Mặc định session và bộ lọc bàn/trạng thái nhớ lựa chọn trước. Browser QA 1440 và 1024 px (theo báo cáo phiên): 7 lỗi đã sửa, gồm crash trang bốc thăm bảng (code phase 06) và modal step-up bị che.
- Verifying: `plans/reports/ui-verifier-261114-phase-07.md` (calibration bắt 3/3 lỗi cài sẵn; lưới C, panel D, trang in E chưa hiệu chỉnh). Plan và checklist: `ui/phase-07-ui-plan.md`, `ui/phase-07-ui-checklists.md`, `ui/phase-07-api-contract.md`.
- Review: `plans/reports/reviewer-261114-phase07-scheduling.md` (H1, H2, M1, M2, M3). Fix thấy trong code: H2 `SCHEDULE_TX_TIMEOUT_MS` (`scheduling/schedule-tx.ts:5`), M1 `scheduleTags` có tag draw/groups, M2 mã 40P01/P2034. Báo cáo "result-lifecycle review" (H1–H3, M1–M3) không có file trong `plans/reports/`, chưa đối chiếu được.
- Dữ liệu thử: DB dev local có bản ghi tiền tố "QA " và một tài khoản admin thử. Không phải staging; chưa dọn.

## Requirements

Functional
- Session: CRUD theo giải (ngày, mã `S01`, tên, giờ bắt đầu/kết thúc, địa điểm, danh sách bàn dùng).
- Xếp lịch tay: gán trận vào session + bàn + thứ tự; đổi tên bàn hiển thị theo session (vd "Sân chính") nếu cần (`VenueTable.displayName`).
- Cảnh báo trùng: 1 VĐV (kể cả qua cặp đôi) có 2 trận chồng giờ (thời lượng = `MatchFormat.estimatedMinutes`, nghỉ tối thiểu = AppSetting `schedule.minRestMinutes`, mặc định ví dụ 20); 1 bàn 2 trận cùng giờ.
<!-- Red Team: Luật vòng bảng cho walkover/bỏ cuộc/rút lui — 2026-11-11 -->
- Nhập tỷ số: theo ván, validate theo thể thức; "Bắt đầu" → `LIVE`; "Lưu tạm" khi đang đấu; "Chốt kết quả" → `OFFICIAL`; bỏ cuộc / không đến (walkover) / truất quyền (bỏ cuộc: người thắng có thể ít ván hơn số ván cần).
<!-- Red Team: Sửa kết quả và toàn vẹn khi chốt đồng thời — 2026-11-11 -->
- `un-start`: `LIVE` → `SCHEDULED` (bấm nhầm "Bắt đầu"); ván đã lưu tạm bị xóa, lưu vào audit.
- `amend-scores`: sửa tỷ số ván của trận `OFFICIAL` mà **không đổi người thắng**; bắt buộc lý do; trận bảng → tính lại BXH bảng; nếu làm đổi thứ hạng của bảng đã đưa người vào nhánh → từ chối, hướng sang `reopen`.
- `reopen`: server tính **xem trước ảnh hưởng** — chuỗi ô phía sau sẽ bị gỡ (gồm ô Q của nhánh chính và vị trí bảng → nhánh), ô nào đã đấu (chặn). Không bị chặn → mở lại: gỡ người thắng khỏi các ô sau chưa đấu, trận về `LIVE`, tính lại BXH bảng. Bị chặn → chỉ `ADMIN` dùng **cưỡng chế**: các trận sau đã đấu về `SCHEDULED` (kết quả cũ lưu trong audit), rồi mở lại. `reopen` và cưỡng chế cần nhập lại mật khẩu.
- Mọi mutation trận yêu cầu `expectedVersion` + điều kiện trạng thái: `start` (SCHEDULED, đủ 2 bên), `un-start`/`save-progress` (LIVE), `confirm` (SCHEDULED/LIVE, đủ 2 bên), `amend-scores`/`reopen` (OFFICIAL, không phải BYE).
<!-- Red Team: Revalidate Next.js chưa kiểm chứng — 2026-11-11 -->
- Nút "Làm mới trang công khai" trong hub giải (vô hiệu mọi tag của giải).
<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- In phiếu trận theo session/bàn (stylesheet in: tên 2 bên, nội dung–vòng, bàn, giờ, ô ghi điểm từng ván, chữ ký trọng tài).
- Export lịch + kết quả theo giải ra xlsx, stream đồng bộ (không qua queue).
<!-- Red Team: Audit, phạm vi công khai, VĐV nhỏ tuổi, song ngữ — 2026-11-11 -->
- Audit: đổi lịch, start, un-start, save-progress, confirm, amend, reopen, cưỡng chế.

Non-functional
- Chốt kết quả → trang công khai của trận/nhánh cập nhật ≤ 5 s nếu Spike E đạt; trượt → ≤ `MATCHDAY_REVALIDATE_SECONDS` (đo ở staging).
- Màn nhập tỷ số dùng được trên tablet ngang 1024 px, thao tác bằng bàn phím.

## Architecture

Model (migration `add_sessions_and_match_scheduling`)

```prisma
model EventSession { id String @id @default(uuid()); eventId String; venueId String?; date DateTime @db.Date
  code String /* S01 */; name String?; nameEn String?; startTime DateTime; endTime DateTime?
  tables EventSessionTable[]; @@unique([eventId, code]) }
model EventSessionTable { sessionId String; tableId String; order Int; @@id([sessionId, tableId]) }
// Match.sessionId / tableId / scheduledAt / orderInSession / scheduleVersion already added in phase 06
```

Validate tỷ số (`packages/competition-engine/src/match-score-validator.ts`)

```
gameValid(a, b, f): hi = max(a,b); lo = min(a,b)
  (hi == f.pointsPerGame && lo <= f.pointsPerGame - f.winBy) || (hi > f.pointsPerGame && hi - lo == f.winBy)
matchValid(games, f, resultType):
  need = ceil(f.bestOf / 2); count wins per side, stop when one side reaches need
  NORMAL: every game valid, no game after decided, winner reached need
  RETIRED / DISQUALIFIED: completed games valid, last game may be partial, winner side given explicitly (may have < need games)
  WALKOVER: no games required, winner side given
```

<!-- Red Team: Sửa kết quả và toàn vẹn khi chốt đồng thời — 2026-11-11 -->
Chốt và sửa kết quả (`match-result.service.ts`, `match-reopen.service.ts`)

```
confirmResult(matchId, games, resultType, winnerSide?, expectedVersion, actor):
  tx:
    lock Draw (FOR UPDATE) → lock Group if group match → m = select match for update
    if m.version != expectedVersion or status not in (SCHEDULED, LIVE) → 409 "Trận đã được cập nhật, tải lại"
    validate with format = round.matchFormatId ?? draw.matchFormatId ?? subEvent.matchFormatId
    replace games; set winnerSide, games1/games2, status OFFICIAL, officialAt, officialById, version+1
    if m.nextMatchId: put winner entry into next.side{nextMatchSide}; if other side BYE → auto resolve, repeat
    if draw QUALIFYING and match is section final: mark qualifier; if all k known → flag "sẵn sàng bốc suất"
    if group match: group-standings.recompute(groupId) under the held lock
    set SubEvent.rankingDirtyAt = now (phase 09 adds the column)
    audit log (before/after + request context)
  after commit: enqueue revalidate {tags from cache-tags map}; enqueue ranking recompute (phase 09)
    enqueue failure → respond 200 with warnings ["PUBLIC_REFRESH_DELAYED"], never 500

amendScores(matchId, games, reason, expectedVersion): same locks; winner must stay the same;
  group match → recompute; if group already placed into knockout and ranks change → 409 "Dùng Mở lại"

previewReopen(matchId):                     // pure read, also re-run under lock inside reopen
  walk forward: next matches occupied by this winner, qualifier slot Qi in MAIN, group → knockout positions
  each affected cell: SCHEDULED → "sẽ gỡ"; LIVE/OFFICIAL → "chặn"
  return { affected[], blocking[] }

reopenResult(matchId, reason, expectedVersion, force, actor):   // step-up required
  tx: lock affected draws in fixed order (QUALIFYING → GROUP → MAIN) → previewReopen
    blocking not empty and !force → 409 with preview
    force (ADMIN only): blocking matches → SCHEDULED, games removed (kept in audit), cascade
    clear advanced sides; match → LIVE (games kept for editing); version+1; recompute group standings
    set rankingDirtyAt; audit with reason + preview
  after commit: revalidate + ranking recompute as above

unStart(matchId, expectedVersion): LIVE → SCHEDULED, delete saved games (audit), version+1
```

<!-- Red Team: Revalidate Next.js chưa kiểm chứng — 2026-11-11 -->
<!-- Red Team: Job ID cố định làm rơi lần tính lại xếp hạng — 2026-11-11 -->
Revalidate (queue `revalidate`, tiền tố `QUEUE_PREFIX`)
- Job `revalidate-tags {tags[]}`, id duy nhất mỗi lần enqueue (`reval-{uuid}`), `removeOnComplete` giữ ít, attempts 5, backoff exponential 2 s. Không dùng id cố định làm debounce; muốn gộp thì dùng tùy chọn deduplication/debounce của BullMQ **sau khi** kiểm ngữ nghĩa trên bản đã cài.
- Worker `POST {CLIENT_INTERNAL_URL}/api/revalidate` header `x-revalidate-secret`; route client vô hiệu tag bằng API mà Spike E đã xác nhận (dạng hết hạn ngay). Route không lộ ra domain công khai (rule Traefik theo path hoặc kiểm `Host` nội bộ, theo Spike E).
- `apps/api/src/modules/revalidation/cache-tags.ts`: **một bảng** ánh xạ mọi mutation admin → danh sách tag chính xác (không wildcard). Test khẳng định mọi route ghi của admin có mặt trong bảng hoặc được đánh dấu `NO_PUBLIC_EFFECT`. Hook revalidate cho: chốt/sửa/mở lại/start/un-start, đổi lịch, phá hòa thủ công, rút entry/rút khỏi nhánh, sửa/hủy/công bố giải, sửa nội dung, AppSetting, sửa/gộp VĐV.
- Tag dựng từ định danh có trong URL công khai (khai báo được trước khi có response; chốt ở Spike E): `events`, `event-{eventSlug}`, `schedule-{eventSlug}`, `draw-{eventSlug}-{subEventCode}`, `groups-{eventSlug}-{subEventCode}`, `match-{eventSlug}-{matchNo}`, `results-strip`, `players`, `player-{playerSlug}`, `rankings`, `ranking-{listCode}`, `settings`. Đổi slug → vô hiệu cả tag cũ và mới.
- Trang ngày thi đấu (giải đang diễn ra theo ngày) dùng TTL ngắn đồng nhất `MATCHDAY_REVALIDATE_SECONDS`, thay cho quy tắc "trang có trận live".

API (admin)

| Method | Path | Ghi chú |
|---|---|---|
| CRUD | `/admin/events/:id/sessions` | |
| GET | `/admin/events/:id/matches?filter[sessionId]&filter[tableId]&filter[status]&filter[subEventId]&filter[roundId]&filter[unscheduled]&q&page&sort` | `q` theo tên VĐV, mã trận |
| PATCH | `/admin/matches/:id/schedule {sessionId, tableId, scheduledAt, orderInSession, expectedScheduleVersion}` | trả cảnh báo trùng; không đụng `version` |
| POST | `/admin/matches/:id/start`, `/un-start`, `/save-progress {games}`, `/confirm {games, resultType, winnerSide?}` — đều kèm `expectedVersion` | quyền `matches.confirm` |
| POST | `/admin/matches/:id/amend-scores {games, reason, expectedVersion}` | quyền `matches.amend` |
| GET | `/admin/matches/:id/reopen-preview` | |
| POST | `/admin/matches/:id/reopen {reason, expectedVersion, force?}` | quyền `matches.reopen`, step-up; `force` chỉ `ADMIN` |
| POST | `/admin/events/:id/revalidate` | "Làm mới trang công khai" |
| GET | `/admin/exports/schedule?eventId`, `/admin/exports/results?eventId` | stream xlsx |
| GET | `/admin/events/:id/match-sheets?sessionId&tableId` | dữ liệu trang in phiếu trận |

Module Nest: `sessions`, `scheduling` (`schedule-conflict.service.ts`), `match-results` (`match-result.service.ts`, `match-amend.service.ts`, `match-reopen.service.ts`, `bracket-advance.service.ts`), `revalidation` (`revalidation-enqueue.service.ts`, `cache-tags.ts`). Worker: `revalidate-processor.ts`.

Màn admin
- Hub giải → tab **Lịch & kết quả**: chọn ngày (mặc định hôm nay nếu giải đang diễn ra) → chọn session → lưới cột = bàn, hàng = thứ tự; panel trái "Trận chưa xếp" lọc theo nội dung/vòng. Gán: click trận ở panel → click ô trống (2 click); kéo đổi ô. Cảnh báo trùng hiện ngay trên ô. Nút "In phiếu trận" (theo session/bàn), "Làm mới trang công khai".
- **Nhập tỷ số** (menu Giải đấu, và trang chủ của `RESULTS_OPERATOR`): mặc định giải đang diễn ra + session hiện tại; bộ lọc bàn nhớ lựa chọn lần trước (bàn điều hành thường giữ 1–2 bàn). Danh sách trận theo bàn/thứ tự, trận kế tiếp nổi bật.
  - Click trận (1) → drawer: tên 2 bên, thể thức "5 ván · 11 điểm · cách 2"; số ô ván = `bestOf`; gõ điểm, Tab qua ô kế; ván sai hiện đỏ ngay ("Ván 3: 11–10 chưa đủ cách 2 điểm"); người thắng tự suy ra; các ô ván thừa tự mờ.
  - "Chốt kết quả" (2) → xác nhận tóm tắt "Nguyễn A thắng 3–1 (11–7, 9–11, 11–5, 11–8)" → Enter (3). Toast thành công + trận kế trên cùng bàn tự mở sẵn. Có cảnh báo `PUBLIC_REFRESH_DELAYED` → toast vàng "Đã chốt. Trang công khai sẽ cập nhật chậm hơn".
  - Nút phụ: "Bắt đầu" (đặt LIVE), "Hủy bắt đầu", "Lưu tạm", "Không đến / Bỏ cuộc" (chọn bên thắng, xác nhận).
  - Trận đã chốt: "Sửa tỷ số" (giữ người thắng, ô lý do) và "Mở lại" (modal xem trước: "Sẽ gỡ Nguyễn A khỏi trận #34 (chưa đấu)"; có ô bị chặn → `ADMIN` thấy nút đỏ "Cưỡng chế mở lại" + danh sách trận sẽ bị xóa kết quả).
  - 409 phiên bản → thông báo "Trận vừa được cập nhật bởi người khác" + nút "Tải lại".

## Related Code Files

Create
- `packages/competition-engine/src/{match-score-validator.ts,reopen-impact.ts}` + test
- `packages/db/prisma/schema.prisma` + migration `add_sessions_and_match_scheduling`
- `apps/api/src/modules/sessions/*`, `apps/api/src/modules/scheduling/{scheduling.module.ts,admin-scheduling.controller.ts,schedule-conflict.service.ts}`, `apps/api/src/modules/match-results/{match-results.module.ts,admin-match-results.controller.ts,match-result.service.ts,match-amend.service.ts,bracket-advance.service.ts,match-reopen.service.ts}`, `apps/api/src/modules/revalidation/{revalidation.module.ts,revalidation-enqueue.service.ts,cache-tags.ts,admin-revalidation.controller.ts}`, `apps/api/src/modules/exports/{schedule-export.service.ts,results-export.service.ts}`
- `apps/worker/src/processors/revalidate-processor.ts`
- `apps/admin/src/pages/event-hub/{schedule-tab.tsx,session-grid.tsx,unscheduled-panel.tsx,match-sheets-print-page.tsx}`, `apps/admin/src/pages/results/{results-entry-page.tsx,match-score-drawer.tsx,game-score-inputs.tsx,amend-scores-modal.tsx,reopen-preview-modal.tsx}`, `apps/admin/src/styles/print.css`
- Test: `apps/api/test/{match-results.e2e-spec.ts,match-reopen.e2e-spec.ts,match-concurrency.e2e-spec.ts,scheduling.e2e-spec.ts,cache-tags-coverage.e2e-spec.ts}`

Modify: `apps/api/src/modules/matches/match-query.service.ts`, `apps/api/src/modules/groups/group-standings.service.ts`, `event-hub-page.tsx`, `menu-groups.ts`, `role-home-page.tsx`. (Route client `/api/revalidate` thuộc phase 08.)

## Implementation Steps

Lát cắt (tuần 5–6)
1. Validator + test (ván thường, deuce, sai cách biệt, ván thừa, walkover/retired có ít ván hơn).
2. `start` + `confirm` + `bracket-advance` (gồm BYE) + khóa Draw + `expectedVersion` + audit; test tích hợp R1 → R2, BYE.
3. Module revalidation: enqueue (id duy nhất), `cache-tags.ts` cho các mutation của lát cắt, processor; lỗi enqueue → 200 + cảnh báo.
4. Màn nhập tỷ số tối thiểu (drawer, chốt, 409).

Phần còn lại (tuần 11–12)
5. `ui-consistency:finding-patterns` → `ui-consistency:planning`: thêm mẫu "lưới xếp lịch", "drawer nhập liệu nhanh bằng bàn phím", "modal xem trước ảnh hưởng"; tái dùng toast/xác nhận.
6. Migration → áp dụng DB cục bộ (in host + tên DB).
7. Sessions + xếp lịch tay (`scheduleVersion`) + conflict check + audit đổi lịch.
8. `save-progress`, `un-start`, `amend-scores`, `reopen-impact` (hàm thuần + test), `reopen` + cưỡng chế + step-up; tính lại BXH bảng trong transaction; cờ suất vòng loại.
9. Test đồng thời: hai request chốt **hai trận khác nhau cùng bảng** cùng lúc → BXH cuối phản ánh cả hai; hai request cùng `expectedVersion` → 1 thành công, 1 nhận 409; sửa lịch trong lúc đang lưu tạm tỷ số → không mất tỷ số.
10. Hoàn thiện `cache-tags.ts` + test phủ; nút "Làm mới trang công khai"; đo thời gian chốt → HTML mới trên staging.
11. In phiếu trận (stylesheet in); export lịch/kết quả stream.
12. `ui-consistency:verifying` (kèm thử trên viewport 1024 px); deploy + migrate staging.

## Todo List

- [x] (Lát cắt) match-score-validator + test
- [x] (Lát cắt) start/confirm + đẩy nhánh + BYE + khóa Draw + expectedVersion + audit
- [x] (Lát cắt) Revalidation: enqueue id duy nhất, cache-tags, processor, lỗi enqueue → cảnh báo (phía API/worker; route client `/api/revalidate` đã có từ phase 08, 2026-11-13)
- [x] (Lát cắt) Màn nhập tỷ số tối thiểu (còn mở: test trình duyệt + 1024 px)
- [x] ui-consistency: finding-patterns → planning — `ui/phase-07-ui-plan.md`, `ui/phase-07-ui-checklists.md`
- [x] Migration sessions + scheduling — `20261114064027_add_sessions_and_match_scheduling`, `20261114071907_add_match_schedule_indexes` (DB dev local)
- [x] Sessions, xếp lịch tay (scheduleVersion), cảnh báo trùng, audit lịch — `apps/api/src/modules/{sessions,scheduling}/`
- [x] save-progress, un-start, amend-scores, reopen + xem trước + cưỡng chế + step-up — `apps/api/src/modules/match-results/`
- [x] Tính lại BXH bảng dưới khóa; test đồng thời — `apps/api/test/match-concurrency.e2e-spec.ts` (5 ca)
- [x] cache-tags: phủ route + test phủ; nút "Làm mới trang công khai". Hai khoảng hở tag ở ghi nợ (`draw.publish` thiếu `match-*`; rút/đổi entry thiếu tag VĐV) **đã đóng 2026-11-14**
- [ ] Đo staging: chốt → trang công khai đổi trong ≤ 5 s (chờ cổng phase 01)
- [x] In phiếu trận; export stream — `match-sheets-print-page.tsx`, `apps/api/src/modules/exports/`
- [x] ui-consistency: verifying — `plans/reports/ui-verifier-261114-phase-07.md` (DONE_WITH_CONCERNS; lưới, panel, trang in chưa hiệu chỉnh)
- [ ] Deploy staging + migrate (chờ cổng phase 01)

## Success Criteria

- Nhập + chốt 1 trận: 3 click + gõ điểm; trận kế tự mở.
<!-- Red Team: Sửa kết quả và toàn vẹn khi chốt đồng thời — 2026-11-11 -->
- Test tích hợp: chốt R1 đẩy đúng slot R2; trận BYE tự qua; bảng xong → `qualified` đúng; mở lại khi trận kế chưa đấu → người thắng bị gỡ khỏi trận kế; mở lại khi trận kế đã đấu → 409 kèm xem trước; cưỡng chế (ADMIN + step-up) → trận kế về `SCHEDULED`, audit có kết quả cũ.
- Mở lại trận cuối section vòng loại sau khi đã bốc suất (trận nhánh chính chưa đấu) → ô Q được gỡ đúng.
- Sửa tỷ số không đổi người thắng → BXH bảng tính lại; thử đổi người thắng qua `amend-scores` → 400.
- Hai request chốt hai trận khác nhau cùng bảng cùng lúc → `GroupStanding` đúng cả hai kết quả.
- Mọi mutation thiếu/sai `expectedVersion` hoặc sai trạng thái → 409.
- Test phủ `cache-tags`: 0 route ghi admin thiếu ánh xạ.
- Redis tắt lúc chốt → API trả 200 kèm cảnh báo; trang công khai đúng sau ≤ TTL.
- Staging: chốt → trang trận công khai đổi trong ≤ 5 s (Spike E đạt) hoặc ≤ `MATCHDAY_REVALIDATE_SECONDS` (Spike E trượt).

## Risk Assessment

| Rủi ro | Khả năng × Tác động | Xử lý |
|---|---|---|
| Nhập sai rồi chốt | Cao × Trung bình | Xác nhận tóm tắt; sửa tỷ số / mở lại có xem trước; audit |
| Chốt đồng thời cùng bảng | Trung bình × Cao | Khóa Draw/Group + tính lại từ đầu + test |
| Cưỡng chế xóa nhầm kết quả trận sau | Thấp × Cao | Chỉ ADMIN + step-up + xem trước + audit lưu kết quả cũ |
| Revalidate lỗi mạng / Redis lỗi | Trung bình × Thấp | Retry 5 lần; TTL ngắn ngày thi đấu; nút làm mới tay |
| Client chạy nhiều instance → cache không đồng bộ | Trung bình × Trung bình | Bản đầu chạy 1 instance client; nhiều instance cần cache handler dùng chung (giai đoạn sau) |

Rollback: migration thêm bảng; revert app; kết quả đã chốt nằm trong bảng của phase 06, không mất.

## Security Considerations

- `RESULTS_OPERATOR`: start, un-start, save-progress, confirm, amend-scores; không reopen, không cưỡng chế, không xếp lịch.
- `reopen`/cưỡng chế cần step-up; idle timeout áp cho máy bàn điều hành (phase 03).
- Route `/api/revalidate` của client: so khớp `REVALIDATE_SECRET` thời gian hằng, chỉ nhận tag theo mẫu cho phép, không truy cập được từ domain công khai.

## Next Steps

- Lát cắt phase 08 (trang nhánh công khai + route revalidate) đã làm 2026-11-13; còn Playwright + deploy staging (bước 4 phase 08, M1). Phase 08 hiển thị lịch, kết quả, nhánh, bảng; phase 09 thêm `rankingDirtyAt` và job tính điểm vào `confirm`/`reopen`.

## Kết quả thực hiện (2026-11-14)

**Trạng thái:** Hoàn thành (chưa deploy staging). Còn mở: đo staging, deploy + migrate staging, Q → BYE → R2 khi reopen (chỉ unit), và các mục UI bên dưới (xem sync 2026-11-13, 2026-11-14 và Debt fixes sync 2026-11-14).

<!-- Debt fixes sync — 2026-11-14 -->
- Đóng: tag `match-*` khi công bố draw; tag VĐV khi rút/đổi entry; `draw.placeQualifiers`; L8 (thể thức theo vòng, `pickMatchFormat`); L11 (path con của `CLIENT_INTERNAL_URL`); L13 (picker giải tìm kiếm phía server); RETIRED có ván dở (e2e); Redis tắt → 200 kèm `PUBLIC_REFRESH_DELAYED` (e2e).
- L12: giữ fix cứng cho bốn nhóm hằng nội bộ, có comment lý do. `CHECK_DEBOUNCE_MS` (ô kiểm slug) cũng giữ cố định, có comment lý do.
- Hạ tầng test: e2e phải chạy khi đã dừng dev worker (worker dev tiêu thụ job import của test). Assertion về job revalidate dùng `apps/api/test/support/revalidate-queue-probe.ts` (chỉ đọc 300 job mới nhất mỗi trạng thái, tự xóa job của chính test).
- Còn mở (không đổi): đo và deploy staging; Q → BYE → R2 khi reopen (e2e); mục UI: focus đỏ thương hiệu, chữ "session" tiếng Anh, nhảy 76 px khi mở hộp thoại, kéo thả chưa có cảm biến bàn phím.

**Cách làm:** làm trọn phần còn lại trong 2 cụm commit (backend, UI), không tách lát cắt.

**Kiểm chứng** (số liệu báo cáo phiên 2026-11-14, KHÔNG chạy lại khi sync):
- API e2e 65 file / 413 test; API unit 125; engine 227; shared 97; worker 34; typecheck + lint 18/18.
- Chạy lại sau debt fixes (2026-11-14, dev worker đã dừng): API e2e 67/67 file, 420 test; API unit 125; engine 230; worker 39; shared 97; typecheck + lint 18/18. Một chunk vitest có thể rớt do crash native `0xC0000409` trên Windows; chạy lại chunk đó.
- Migration áp dụng DB dev local. Chưa có staging.
- Browser QA 1440 và 1024 px: 7 lỗi đã sửa (theo báo cáo phiên; không có file báo cáo trong `plans/reports/`).
- Verifying UI: `plans/reports/ui-verifier-261114-phase-07.md`; lưới, panel và trang in chưa hiệu chỉnh.

**Tiêu chí thành công** (đối chiếu test có tên trong repo):

| Tiêu chí | Trạng thái | Bằng chứng |
|---|---|---|
| Hai request chốt hai trận khác nhau cùng bảng → BXH đúng cả hai | Đạt | `apps/api/test/match-concurrency.e2e-spec.ts:51` |
| Cùng `expectedVersion` → 1 thành công, 1 nhận 409 | Đạt | `match-concurrency.e2e-spec.ts:96, 110` |
| Sửa lịch lúc đang lưu tỷ số không mất tỷ số | Đạt | `match-concurrency.e2e-spec.ts:122` |
| Cưỡng chế mở lại: audit giữ kết quả cũ | Đạt | `apps/api/test/match-reopen.e2e-spec.ts:150` |
| RESULTS_OPERATOR không mở lại được | Đạt | `apps/api/test/match-reopen.e2e-spec.ts:66` |
| Test phủ `cache-tags`: 0 route ghi thiếu ánh xạ | Đạt theo báo cáo phiên; file test có | `apps/api/test/cache-tags-coverage.e2e-spec.ts` (chưa chạy lại khi sync) |
| Redis tắt lúc chốt → 200 kèm `PUBLIC_REFRESH_DELAYED` | Đạt (sync 2026-11-14) | `apps/api/test/match-retired-format-and-redis-down.e2e-spec.ts:88`; mã ở `apps/api/src/modules/revalidation/revalidation-enqueue.service.ts` |
| Staging: chốt → trang công khai đổi ≤ 5 s | Chưa đo | chờ cổng phase 01 |

**Sai lệch so với plan:**
- ~~Trạng thái "Hoàn thành" trong khi ghi nợ L8, L11, L12, L13 vẫn mở.~~ L8, L11, L13 đã đóng và L12 đã có quyết định (2026-11-14). Trạng thái không đổi.
- ~~Ghi nợ "`draw.publish` chưa có tag `match-*`" chưa đóng.~~ Đã đóng 2026-11-14 và kiểm trong code (xem mục ghi nợ).

**Việc còn mở:**
1. Deploy + migrate staging; đo chốt → HTML mới ≤ 5 s (chờ cổng phase 01).
2. Ghi nợ còn mở: chuỗi Q → BYE → R2 khi reopen chưa có e2e (chỉ unit).
3. Lỗi thiết kế từ QA, chưa sửa (theo báo cáo phiên): focus đỏ thương hiệu; chữ "session" tiếng Anh; nhảy 76 px khi mở hộp thoại; kéo thả chưa có cảm biến bàn phím (thao tác 2 click vẫn chạy).
4. Dữ liệu thử trong DB dev local (tiền tố "QA " và một tài khoản admin thử) chưa dọn; cần xác nhận của chủ repo trước khi xóa.
5. Verifying UI còn thiếu: lưới (`session-grid*`), panel (`unscheduled-panel`), trang in (`match-sheets-print-page` + `print.css`).
