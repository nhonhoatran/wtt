# Phase 09 — Quy tắc điểm, sổ điểm có hạn, chốt bảng xếp hạng theo kỳ

## Context Links

- [Brainstorm §4.3, §4.5 xếp hạng, §7 tiêu chí](../reports/brainstorm-261111-1512-kamito-table-tennis-tournament-platform.md)
- [Engine nhánh đấu A.4 rating: bảng điểm theo hạng giải; số 1000/400/125 chỉ từ Wikipedia, chưa đối chiếu ITTF](../reports/researcher-261111-1450-tournament-engine-bracket-libs-and-site-capture-tools.md)
- [Site tham chiếu §3.7 Rankings, §4 điểm có hạn, cập nhật theo kỳ](../reports/researcher-261111-1450-worldtabletennis-site-feature-and-layout-analysis.md)
- [Red team đã phân xử: nhóm 3, 5, 12](./reports/red-team-261111-1614-adjudicated-findings.md)
- Phase trước: [phase-08](./phase-08-public-site-shell-event-pages-and-bracket-ui.md) (dữ liệu từ [phase-07](./phase-07-scheduling-sessions-tables-and-result-entry.md))

## Overview

<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Priority: P1. Status: pending. Tuần 14–15 (≈7 ngày công, gồm ui-consistency ≈0,5 ngày).
- **Cổng G2 (cứng):** BTC trả lời quy chế điểm xếp hạng (hạng giải, điểm từng vòng, thời hạn điểm, chu kỳ chốt, walkover, cách tính hạt giống cặp đôi) trước khi bắt đầu phase này. Câu hỏi gửi từ tuần 1; chưa có trả lời tới đầu tuần 14 → làm phase 10/11 trước, dùng dự phòng.
- Bảng xếp hạng (đơn/đôi, theo giới/nhóm tuổi), quy tắc điểm hạng giải × vòng đạt được có ngày hiệu lực (admin sửa dạng ma trận), sổ điểm `RankingPointsEarned` có ngày hết hạn và **điểm đóng băng** khi giải kết thúc, dấu "bẩn" bền + job tính lại tuần tự theo nội dung, bản nháp → công bố snapshot kèm breakdown, gợi ý hạt giống theo BXH.

## Key Insights

- Tính lại **toàn bộ dòng AUTO của một nội dung** mỗi lần (xóa + ghi trong 1 transaction) → idempotent, tự đúng khi kết quả bị mở lại/sửa.
- Chỉ ghi điểm khi vị trí cuối của entry đã xác định (đã thua hoặc vô địch); entry còn đang đấu bỏ qua.
- Đôi — **đã chốt**: điểm đôi ghi cho **từng VĐV** của cặp trong bảng đôi (VĐV hay đổi người đánh cặp). Xếp hạng theo cặp để giai đoạn sau.
<!-- Red Team: Xếp hạng không tái lập được — 2026-11-11 -->
- **Đã chốt:** điểm của giải đã kết thúc đóng băng. Đổi quy tắc điểm chỉ áp cho giải kết thúc sau ngày hiệu lực của quy tắc mới; khi kết quả của giải cũ bị sửa, tính lại dùng phiên bản quy tắc có hiệu lực tại `endDate` của giải đó.
- Snapshot là bản ghi bất biến **kèm breakdown**; trang công khai đọc snapshot đã công bố (cả hạng lẫn chi tiết điểm), không đọc sổ điểm sống.
<!-- Red Team: Job ID cố định làm rơi lần tính lại xếp hạng — 2026-11-11 -->
- Job id cố định (`rank-se-{subEventId}`) làm debounce: theo reviewer, BullMQ bỏ qua `add` khi job cùng id còn tồn tại (kể cả đã xong nhưng được giữ) → lần chốt thứ hai bị rơi. Không dựa vào id cố định; ngữ nghĩa deduplication/debounce của BullMQ phải kiểm trên bản đã cài trước khi dùng.
- Dấu "bẩn" bền `SubEvent.rankingDirtyAt` ghi trong transaction chốt/mở lại → không mất việc tính lại kể cả khi Redis/enqueue lỗi. Đây không phải bảng outbox.

<!-- Phase 03 sync — 2026-11-12 -->
- Phase 03 đã có `@RequireStepUp()` + StepUpGuard (chưa gắn route). Cần gắn cho `publishSnapshot` và `POST/DELETE /admin/ranking-points`. Ma trận quyền: resource `rankings` chỉ ADMIN.

<!-- Phase 05 sync — 2026-11-12 -->
- Entry đã có `rankingAtEntry Int?`, `pointsAtEntry Int?` (migration `add_entries`), còn trống. Cặp: `pointsAtEntry` = tổng 2 VĐV, `rankingAtEntry` = null.
- Gộp VĐV (`apps/api/src/modules/players/player-merge.service.ts`) hiện chỉ trỏ lại Competitor/Pair/Entry. Phase này thêm: trỏ lại dòng sổ điểm về VĐV đích, đánh dấu `rankingDirtyAt` cho nội dung bị ảnh hưởng. Trường `rankingDirtyAt` chưa có trong schema — thêm trong migration của phase này.
- `POST /admin/players/merge` đã có `@RequireStepUp()` (`admin-players.controller.ts:45`); không cần gắn lại.

## Requirements

Functional
<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- RankingList: mã, tên vi/en, loại `SINGLES/DOUBLES`, giới (`GenderRule`), nhóm tuổi (tùy chọn), thời hạn điểm (ngày; mặc định từ AppSetting `ranking.defaultValidityDays`, ví dụ 365), phân biệt mã vòng bảng theo thứ hạng trong bảng (bật/tắt), bật/tắt. (Số kết quả tốt nhất được tính dời giai đoạn sau: tính tất cả kết quả còn hạn.)
- Nội dung thi đấu gắn vào 1 bảng xếp hạng (`SubEvent.rankingListId`, trống = không tính điểm).
<!-- Red Team: Xếp hạng không tái lập được — 2026-11-11 -->
- Quy tắc điểm: (hạng giải × loại `SINGLES/DOUBLES` × loại draw × mã vòng đạt được × ngày hiệu lực) → điểm. Ma trận sửa tại chỗ, lưu thành **phiên bản mới** với ngày hiệu lực (mặc định hôm nay); sao chép cột từ hạng giải khác. Mặc định ví dụ khi seed: vô địch hạng cao 1000, hạng trung 400, hạng thấp 125 (chỉ là dữ liệu mẫu).
- Mã vòng: nhánh chính `W, F, SF, QF, R16…`; vòng loại đếm ngược từ trận cuối section `QF-1, QF-2…` (không theo số vòng); vòng bảng `GROUP` hoặc `GROUP-{hạng trong bảng}` khi bảng xếp hạng bật phân biệt.
- Điểm thủ công (`MANUAL`) có lý do: nhập điểm lịch sử, điều chỉnh; cần nhập lại mật khẩu.
- Cờ AppSetting `ranking.awardPointsOnWalkoverLoss` (mặc định false).
- Kỳ chốt: tạo bản nháp cho 1 hoặc tất cả bảng (ngày tính mặc định hôm nay) → xem trước kèm biến động + "N nội dung chưa tính lại" → công bố (nhập lại mật khẩu). Dựng lại bản nháp cùng ngày luôn chạy.
- Gợi ý hạt giống (phase 06) và điền `rankingAtEntry/pointsAtEntry` từ snapshot công bố mới nhất. Cặp đôi: hạt giống theo **tổng điểm hiện tại của 2 VĐV** trong bảng đôi tương ứng (VĐV chưa có hạng tính 0); `pointsAtEntry` lưu tổng, `rankingAtEntry` để trống (cần BTC xác nhận — câu hỏi mở).
<!-- Red Team: Job ID cố định làm rơi lần tính lại xếp hạng — 2026-11-11 -->
- Trigger tính lại (đặt `rankingDirtyAt` + enqueue): chốt, mở lại, cưỡng chế (phase 07); rút khỏi nhánh (phase 06); đổi trạng thái Entry (phase 05); đổi `endDate`, `eventTypeId`, hủy/bỏ hủy giải (phase 04); đổi `rankingListId` của nội dung; đổi `validityDays` (tính lại `expiresAt`); gộp VĐV (phase 05); quy tắc mới có hiệu lực ≤ `endDate` của giải chưa kết thúc.

Non-functional
- Tính lại 1 nội dung 128 entry < 2 s; dựng snapshot 5.000 VĐV < 10 s.
- Mọi công bố snapshot, đổi quy tắc, điểm thủ công ghi `AuditLog`.

## Architecture

<!-- Red Team: Xếp hạng không tái lập được — 2026-11-11 -->
Model (migrations `add_ranking_lists_and_rules`, `add_ranking_ledger_and_snapshots`)

```prisma
model RankingList { id String @id @default(uuid()); code String @unique; name String; nameEn String?
  competitorKind CompetitorKind; genderRule GenderRule; categoryId String?
  validityDays Int; groupStageByRank Boolean @default(false); order Int @default(0); isActive Boolean @default(true) }
model RankingPointsRule { id String @id @default(uuid()); eventTypeId String; competitorKind CompetitorKind
  drawKind DrawKind; stageCode String /* W, F, SF, QF, R16.., QF-1, QF-2.., GROUP, GROUP-2.. */; points Int
  effectiveFrom DateTime @db.Date; createdById String; createdAt DateTime @default(now())
  @@unique([eventTypeId, competitorKind, drawKind, stageCode, effectiveFrom]) }
enum PointsSource { AUTO MANUAL }
model RankingPointsEarned { id String @id @default(uuid()); rankingListId String; playerId String
  source PointsSource; subEventId String?; eventId String?; entryId String?; stageCode String?
  points Int /* frozen value applied */; ruleEffectiveFrom DateTime? @db.Date
  earnedAt DateTime @db.Date; expiresAt DateTime @db.Date; reason String?; createdById String?
  createdAt DateTime @default(now())
  @@index([rankingListId, playerId]); @@index([subEventId]); @@index([rankingListId, expiresAt]) }
enum SnapshotStatus { DRAFT PUBLISHED }
model RankingSnapshot { id String @id @default(uuid()); rankingListId String; asOfDate DateTime @db.Date
  status SnapshotStatus @default(DRAFT); publishedAt DateTime?; publishedById String?; note String?
  rows RankingSnapshotRow[]; @@index([rankingListId, status, asOfDate]) }
model RankingSnapshotRow { snapshotId String; playerId String; rank Int; previousRank Int?; movement Int?
  points Int; resultsCounted Int
  breakdown Json /* [{ledgerId, eventSlug, eventName, eventNameEn, eventTypeCode, stageCode, points, earnedAt, expiresAt}] */
  @@id([snapshotId, playerId]); @@index([snapshotId, rank]) }
// SubEvent: + rankingListId String?, rankingDirtyAt DateTime?
```

- Unique một phần (`subEventId, playerId, rankingListId` khi `source = AUTO`) viết tay trong migration `--create-only`.
- Trigger DB (viết tay trong migration) chặn `UPDATE`/`DELETE` trên `RankingSnapshotRow` của snapshot `PUBLISHED`, và chặn đổi `RankingSnapshot.status` từ `PUBLISHED`; service cũng kiểm + test.
- Các cột mới đều nullable/có default (migration tương thích ngược).

Thuật toán (`packages/ranking-engine`)

```
stageReached(entry, matches, list):            // pure; uses isPlayedMatch from packages/shared
  main = matches in MAIN draw
  if main not empty:
    last = last OFFICIAL match of entry in MAIN (by round number)
    if last is final and entry won → "W"
    if entry lost last → round code of last ("F", "SF", "QF", "R16", ...)
    else → undetermined (still playing)
  else if entry in GROUP draw and group complete and not qualified →
    list.groupStageByRank ? "GROUP-" + rank : "GROUP"
  else if entry in QUALIFYING and lost → section-relative code of the lost round ("QF-1", "QF-2", ...)
  BYE-only advance is not a played match; first real match lost decides the stage
  walkover loss in first real match and !awardPointsOnWalkoverLoss → stage = null (0 points)

ruleFor(eventTypeId, kind, drawKind, stage, event.endDate):
  rule with the greatest effectiveFrom ≤ event.endDate

recomputeSubEvent(subEventId):                  // job ranking:recompute-sub-event
  tx:
    pg_advisory_xact_lock(hash("ranking", subEventId))       // serialize per sub-event
    t0 = se.rankingDirtyAt; se = subEvent + event(eventTypeId, endDate, isCancelled) + rankingList (reload from DB)
    delete RankingPointsEarned where subEventId = se.id and source = AUTO
    if se.rankingListId is not null and not cancelled:
      for entry in confirmed entries:
        stage = stageReached(entry); if null → continue
        r = ruleFor(...); pts = r?.points ?? 0; if pts == 0 → continue
        for player in players(entry.competitor):  // 1 for singles, 2 for doubles
          insert {list, player, AUTO, se, entry, stage, pts, ruleEffectiveFrom = r.effectiveFrom,
                  earnedAt = event.endDate, expiresAt = event.endDate + list.validityDays}
    clear rankingDirtyAt only if it still equals t0 (a newer change keeps it dirty)

buildSnapshot(listId, asOf):                    // job ranking:build-snapshot → DRAFT
  dirty = sub-events of listId with rankingDirtyAt not null → recompute each first (same lock); still dirty → fail with list
  rows = ledger where list = listId and earnedAt <= asOf and expiresAt > asOf
  per player: total = sum of all valid rows; counted = n; breakdown = those rows (copied)
  order by total desc, then counted asc, then player.fullName (display only)
  rank: competition ranking (equal total → same rank: 1, 2, 2, 4)
  prev = latest PUBLISHED snapshot of listId
  previousRank = prev.rank(player) or null; movement = previousRank - rank (null if new)
  replace existing DRAFT of same (listId, asOf); insert rows

publishSnapshot(snapshotId): step-up; status PUBLISHED, publishedAt; audit; revalidate ["rankings", "ranking-{listCode}"] + player tags
```

<!-- Red Team: Job ID cố định làm rơi lần tính lại xếp hạng — 2026-11-11 -->
Queue `ranking` (tiền tố `QUEUE_PREFIX`)
- `recompute-sub-event {subEventId}`: id duy nhất mỗi lần enqueue + `removeOnComplete`; hoặc tùy chọn deduplication/debounce của BullMQ **nếu** test trên bản cài xác nhận lần chốt thứ hai không bị rơi. Tuần tự hóa bằng advisory lock trong processor (không dựa vào id). attempts 5, backoff exponential 5 s.
- `build-snapshot {listId, asOf}`: id duy nhất mỗi lần bấm; attempts 3.
- Lưới an toàn: job lặp (env, mặc định ví dụ 10 phút) quét `SubEvent` có `rankingDirtyAt` cũ hơn N phút → enqueue lại.
- Payload chỉ chứa id; processor nạp lại từ DB.

API (admin)

| Method | Path |
|---|---|
| CRUD | `/admin/ranking-lists` |
| GET | `/admin/ranking-rules?filter[competitorKind]&filter[drawKind]&filter[asOf]` → ma trận phiên bản hiệu lực; `PUT /admin/ranking-rules/matrix {effectiveFrom, cells:[{eventTypeId, stageCode, points}]}` (1 lần lưu = 1 phiên bản) |
| GET | `/admin/ranking-points?filter[rankingListId]&filter[playerId]&filter[eventId]&filter[source]&filter[active]&page&sort` |
| POST/DELETE | `/admin/ranking-points` (chỉ `MANUAL`, bắt buộc `reason`, step-up; xóa có audit) |
| POST | `/admin/ranking-snapshots/drafts {listIds | all, asOfDate}` → job; `GET /admin/ranking-snapshots?filter[listId]&filter[status]` (kèm số nội dung chưa tính lại) |
| GET | `/admin/ranking-snapshots/:id/rows?page&q&sort=rank:asc` |
| POST | `/admin/ranking-snapshots/:id/publish` (step-up); `DELETE` (chỉ DRAFT) |
| POST | `/admin/ranking/recompute {subEventId | eventTypeId}` (thủ công, ADMIN) |

Module Nest: `ranking-lists`, `ranking-rules`, `ranking-points`, `ranking-snapshots`, `ranking-jobs` (enqueue + `ranking-dirty-marker.ts` dùng chung cho mọi trigger). Worker: `ranking-recompute-processor.ts`, `ranking-snapshot-processor.ts`, `ranking-dirty-sweep-processor.ts`.

Màn admin — nhóm **Xếp hạng**: Bảng xếp hạng, Quy tắc điểm, Sổ điểm, Kỳ chốt.
- Quy tắc điểm: chọn Đơn/Đôi + Nhánh chính/Vòng loại/Vòng bảng → lưới (hàng = vòng W, F, SF…; cột = hạng giải); gõ trực tiếp, ô đổi màu khi sửa, "Lưu" 1 lần → chọn ngày hiệu lực (mặc định hôm nay) + xác nhận: "Áp cho giải kết thúc từ dd/mm/yyyy; N giải đang diễn ra sẽ tính lại; giải đã kết thúc giữ nguyên". "Sao chép cột từ…" để điền nhanh; xem phiên bản trước theo ngày.
- Kỳ chốt: "Tạo bản nháp cho tất cả bảng" (1) → trạng thái job → mở bản nháp: bảng hạng, mũi tên ↑↓ + số bậc, lọc tên, cảnh báo "N nội dung chưa tính lại" (nút "Tính lại ngay") → "Công bố" (2) + nhập lại mật khẩu (3).
- Sổ điểm: lọc theo bảng/VĐV/giải/còn hạn; "Thêm điểm thủ công" (form có lý do bắt buộc).
- Nội dung thi đấu (phase 04, sửa): thêm chọn "Bảng xếp hạng"; mặc định gợi ý bảng khớp loại + giới + nhóm tuổi.

## Related Code Files

Create
- `packages/ranking-engine/src/{stage-reached.ts,rule-for-date.ts,points-for-entry.ts,snapshot-builder.ts,competition-rank.ts,pair-seed-points.ts,index.ts}` + `*.test.ts`
- `packages/db/prisma/schema.prisma` + 2 migrations (gồm trigger bất biến snapshot); `packages/db/prisma/seed/seed-ranking-defaults.ts` (bảng + quy tắc ví dụ)
- `apps/api/src/modules/{ranking-lists,ranking-rules,ranking-points,ranking-snapshots,ranking-jobs}/*`
- `apps/worker/src/processors/{ranking-recompute-processor.ts,ranking-snapshot-processor.ts,ranking-dirty-sweep-processor.ts}`
- `apps/admin/src/resources/ranking-lists/*`, `apps/admin/src/pages/ranking/{ranking-rules-matrix-page.tsx,ranking-points-page.tsx,manual-points-form.tsx,ranking-snapshots-page.tsx,snapshot-preview-page.tsx}`
- Test: `apps/api/test/{ranking.e2e-spec.ts,ranking-recompute-race.e2e-spec.ts,ranking-snapshot-immutability.e2e-spec.ts}`

Modify: `apps/api/src/modules/match-results/{match-result.service.ts,match-reopen.service.ts}` (đặt `rankingDirtyAt` + enqueue), `apps/api/src/modules/draws/draw-post-publish.service.ts` (rút khỏi nhánh), `apps/api/src/modules/entries/*` (đổi trạng thái), `apps/api/src/modules/events/*` (đổi `endDate`/`eventTypeId`/hủy), `apps/api/src/modules/sub-events/*` (rankingListId), `apps/api/src/modules/players/player-merge.service.ts` (trỏ lại sổ điểm + đánh dấu bẩn), `apps/api/src/modules/draws/...suggest-seeds` (đọc snapshot, cộng điểm cặp), `apps/admin/src/pages/event-hub/sub-events-tab.tsx`, `draw-seeds-step.tsx`.

## Implementation Steps

1. Kiểm cổng G2 (câu trả lời BTC đã có, ghi vào file này).
2. `ui-consistency:finding-patterns` → `ui-consistency:planning`: thêm mẫu "lưới sửa tại chỗ", "xem trước rồi công bố".
3. `packages/ranking-engine` + test trước (bảng dưới).
4. Migrations (`--create-only` cho unique một phần + trigger bất biến) → áp dụng DB cục bộ (in host + tên DB).
5. Kiểm ngữ nghĩa job id/deduplication trên bản BullMQ đã cài bằng test (thêm 2 job cách nhau khi job đầu đã xong và còn được giữ) → chọn id duy nhất hoặc tùy chọn dedupe; ghi kết quả vào file này.
6. Modules + API + queue `ranking` + `ranking-dirty-marker`; nối mọi trigger đã liệt kê; job quét lưới an toàn.
7. Seed ví dụ (sau xác nhận target).
8. Màn admin 4 mục + chọn bảng ở nội dung + gợi ý hạt giống (đơn và cặp).
9. `ui-consistency:verifying`; deploy + migrate staging.

Ma trận test

| Ca | Kỳ vọng |
|---|---|
| Vô địch, á quân, thua SF, thua R32 sau BYE ở R64 | W, F, SF, R32 |
| Thua ở vòng loại: section 8 và section 6 VĐV (lệch kích thước) | cùng vòng quyết định → cùng mã `QF-1`; vòng trước → `QF-2` |
| Qua vòng loại rồi thua R32 nhánh chính | R32 (nhánh chính) |
| Vòng bảng không đi tiếp, `groupStageByRank` tắt/bật | `GROUP` / `GROUP-3` |
| Thua walkover trận đầu, cờ false/true | 0 điểm / điểm theo vòng |
| Đôi | 2 dòng sổ điểm, mỗi VĐV 1 dòng |
| Mở lại kết quả rồi chốt khác | sổ điểm khớp kết quả mới, không dòng thừa |
| Chốt 2 kết quả cùng nội dung cách nhau 10 s | sổ điểm phản ánh cả hai (không job nào bị rơi) |
| Redis tắt lúc chốt, bật lại | job quét thấy `rankingDirtyAt` → sổ điểm đúng |
| Đổi quy tắc hiệu lực hôm nay | giải đã kết thúc giữ điểm cũ; giải kết thúc sau hôm nay dùng điểm mới |
| Sửa kết quả của giải đã kết thúc sau khi quy tắc đổi | tính lại theo phiên bản quy tắc tại `endDate` |
| Điểm hết hạn trước `asOf` | không tính |
| Bằng điểm | cùng hạng, hạng kế bỏ số (1, 2, 2, 4) |
| Snapshot thứ 2 | `previousRank`, `movement` đúng; VĐV mới → null |
| Dựng lại bản nháp cùng ngày | chạy, thay bản nháp cũ |
| Bản nháp khi còn nội dung bẩn | tính lại trước; không được → báo danh sách |
| UPDATE/DELETE dòng snapshot đã công bố | DB từ chối |
| Hạt giống cặp: A có 300, B chưa có hạng | `pointsAtEntry` = 300, `rankingAtEntry` = null |
| Gộp VĐV B vào A | dòng sổ điểm của B chuyển sang A; nội dung liên quan được tính lại |

## Todo List

- [ ] Cổng G2: câu trả lời BTC về quy chế điểm
- [ ] ui-consistency: finding-patterns → planning
- [ ] ranking-engine + test ma trận (gồm `QF-n`, `GROUP-n`, quy tắc theo ngày hiệu lực)
- [ ] Migrations ranking lists/rules, ledger/snapshots + trigger bất biến
- [ ] Kiểm ngữ nghĩa job id/dedupe trên bản BullMQ đã cài
- [ ] API + queue ranking + `rankingDirtyAt` + mọi trigger + job quét
- [ ] Seed ví dụ
- [ ] Màn Bảng XH, Quy tắc điểm (ma trận có phiên bản), Sổ điểm, Kỳ chốt
- [ ] Gợi ý hạt giống (đơn + cặp) + rankingAtEntry/pointsAtEntry
- [ ] ui-consistency: verifying; deploy staging

## Success Criteria

- Ma trận test xanh; coverage `packages/ranking-engine` ≥ 90 %.
- Tích hợp end-to-end (DB + Redis thật): giải 16 VĐV chốt hết → sổ điểm đúng theo quy tắc → bản nháp → công bố → `GET /public/rankings/...` (phase 10) trả đúng thứ tự và breakdown lấy từ snapshot.
- Đổi quy tắc, thời hạn trên admin → giải kết thúc sau ngày hiệu lực đổi theo, giải đã kết thúc giữ nguyên; không sửa code.
- Không có nội dung nào giữ `rankingDirtyAt` quá chu kỳ quét + thời gian job ở staging.

## Risk Assessment

| Rủi ro | Khả năng × Tác động | Xử lý |
|---|---|---|
| Quy chế điểm Kamito khác mô hình hạng giải × vòng | Trung bình × Cao | Cổng G2; điểm thủ công |
| Job tính lại bị rơi hoặc chạy chồng | Trung bình × Cao | Dấu bẩn bền + advisory lock + compare-and-clear + job quét |
| Đổi quy tắc tính lại khối lượng lớn | Thấp × Thấp | Chỉ giải chưa kết thúc; job theo từng nội dung, concurrency thấp |
| Snapshot đã công bố bị sửa | Thấp × Cao | Trigger DB + test |

Rollback: bảng/cột mới; tắt enqueue bằng revert; snapshot đã công bố giữ nguyên.

## Security Considerations

- Chỉ `ADMIN` sửa quy tắc, điểm thủ công, công bố; điểm thủ công + công bố cần nhập lại mật khẩu.
- Điểm thủ công + công bố + đổi quy tắc: audit có người, lý do, trước/sau.

## Next Steps

- Phase 10: trang xếp hạng + hồ sơ VĐV đọc snapshot (kèm breakdown).
