# Phase 06 — Bốc thăm, hạt giống, BYE, vòng bảng, sinh nhánh đấu, thao tác sau công bố

## Context Links

- [Site tham chiếu §3.4 Draws/Groups, §4 thông số nhánh, mã vòng, vòng bảng](../reports/researcher-261111-1450-worldtabletennis-site-feature-and-layout-analysis.md)
- [Engine nhánh đấu A.1, A.5 (tham khảo thuật toán; không dùng thư viện)](../reports/researcher-261111-1450-tournament-engine-bracket-libs-and-site-capture-tools.md)
- [Red team đã phân xử: nhóm 1, 2, 5, 12, 13, 15](./reports/red-team-261111-1614-adjudicated-findings.md)
- Phase trước: [phase-05](./phase-05-players-pairs-entries-and-excel-import.md)

## Overview

<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Priority: P1. Status: pending. ≈10 ngày công (gồm ui-consistency ≈0,5 ngày), làm 2 đợt:
  - **Lát cắt (tuần 4–5, ≈4 ngày):** engine loại trực tiếp (kích thước nhánh, hạt giống, BYE, sinh trận), model draw/round/match/game, sinh → đổi chỗ → công bố 1 draw `MAIN`, màn admin tối thiểu.
  - **Phần còn lại (tuần 10–11, ≈6 ngày):** vòng loại, vòng bảng (chia bảng, vòng tròn, BXH bảng với luật walkover/bỏ cuộc/rút lui), bảng → nhánh, thao tác sau công bố, khóa mức Draw/Group, tính lại BXH, phá hòa thủ công, ghi đè thể thức theo vòng.
<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- **Cổng G1 (cứng):** (a) BTC xác nhận mẫu đặt hạt giống loại trực tiếp trước khi lát cắt bốc thăm (hạn cuối tuần 3) — chưa có thì lát cắt chỉ chạy trên dữ liệu thử, không dùng cho giải thật; (b) BTC trả lời về chia bảng, tiêu chí phá hòa, xử lý rút lui giữa bảng trước khi bắt đầu phần còn lại (tuần 10). Câu hỏi gửi từ tuần 1.
- Logic thuần **tự viết** trong `packages/competition-engine`; bảng domain là nguồn dữ liệu duy nhất.

## Key Insights

- Thông số tham chiếu: 51 VĐV → nhánh 64, 16 hạt giống, 13 BYE. BYE gán cho hạt giống cao trước; không có cặp BYE–BYE.
- Trận BYE tự xử lý lúc sinh (`OFFICIAL`, `resultType=BYE`), người được BYE vào thẳng vòng sau; không hiện trong lịch.
- Mọi bốc thăm ngẫu nhiên dùng RNG có hạt (`Draw.randomSeed` lưu DB) → tái lập được để đối chiếu khi có khiếu nại.
<!-- Red Team: Sửa draw sau công bố — 2026-11-11 -->
- Trận BYE đã `OFFICIAL` ngay lúc sinh → quy tắc khóa cũ ("trận đầu tiên OFFICIAL") khóa nhánh ngay khi tạo. Quy tắc mới: cấu trúc khóa khi có **trận không-BYE đầu tiên** `LIVE` hoặc `OFFICIAL` (tính từ dữ liệu, không lưu trạng thái riêng).
- Một predicate dùng chung "trận đã đấu thật" (`resultType != BYE`) cho mọi thống kê/danh sách (phase 08, 09, 10).
<!-- Red Team: Sửa kết quả và toàn vẹn khi chốt đồng thời — 2026-11-11 -->
- BXH bảng là dữ liệu tổng hợp nhiều trận → hai lần chốt cùng bảng đồng thời có thể ghi đè nhau. Khóa ở mức `Draw`/`Group` (`SELECT … FOR UPDATE`) trước khi đọc trạng thái tổng hợp; tính BXH luôn từ đầu (idempotent).
- Engine tự viết thay vì thư viện: nhu cầu chỉ gồm loại trực tiếp (hạt giống, BYE, vòng loại dừng ở k suất), vòng tròn, bảng → nhánh; giữ một bộ bảng domain, không có lớp trung gian.

<!-- Phase 03 sync — 2026-11-12 -->
- Phase 03 đã có: `AppSettingsService` và khung `/settings` (key `draw.*` thêm vào registry khi làm phase này); resource `tournaments` trong ma trận quyền (RESULTS_OPERATOR chỉ đọc); `@RequireStepUp()` nếu thao tác sau công bố cần nhập lại mật khẩu (chưa gắn route nào).

<!-- Phase 04 sync — 2026-11-12 -->
- Phase 04 đã có model `MatchFormat` và `GroupScoringRule` (`packages/db/prisma/schema/tournament-catalog.prisma`); `withdrawalPolicy` để trống (API trả `withdrawalPolicyMissing`), seed không tự chọn (`packages/db/prisma/seed/seed-config-defaults.ts`).
- Bộ tiêu chí phá hòa đã có: `packages/shared/src/tiebreak-criteria.ts`. Dùng lại, không tạo danh sách mới.
- "Đúng một mục mặc định" có partial unique index (`MatchFormat_single_default`, `GroupScoringRule_single_default`, migration `add_single_default_partial_indexes`); helper dùng chung `apps/api/src/common/crud/default-flag.ts`.
- `draw.defaultGroupSize`, `draw.defaultAdvancePerGroup` chưa có trong `packages/shared/src/tournament-settings.ts`; thêm khi làm phase này.
- Đăng ký `cache-tags.ts` đợi phase 07.

## Requirements

Functional
- Mỗi nội dung: tối đa 1 draw `QUALIFYING` (nếu `hasQualifying`), 1 `GROUP` (nếu `GROUP_KNOCKOUT`), 1 `MAIN`.
- Xem trước thông số trước khi bốc: số đăng ký, kích thước nhánh, số BYE, số hạt giống, số suất vòng loại/số bảng.
- Hạt giống: lấy từ `Entry.seed`; nút "Gợi ý theo BXH" (có tác dụng sau phase 09); mặc định số hạt giống = AppSetting `draw.defaultSeedRatio` × kích thước nhánh (mặc định ví dụ 1/4), sửa được.
<!-- Red Team: Xếp hạng không tái lập được — 2026-11-11 -->
- Vòng loại: k phân nhánh độc lập (`section` 1..k, mã vòng đếm ngược từ trận cuối section: `QF-1`, `QF-2`… để phase 09 tính điểm như nhau dù section lệch kích thước), người thắng mỗi phân nhánh là 1 suất; nhánh chính có k ô `Q1..Qk` (không đặt đối diện BYE); khi vòng loại xong → "Bốc suất vòng loại vào nhánh chính" (1 click).
<!-- Red Team: Sửa draw sau công bố — 2026-11-11 -->
- Vòng bảng: số bảng hoặc cỡ bảng (mặc định AppSetting `draw.defaultGroupSize` = 4), số người đi tiếp mỗi bảng ∈ {1, 2} (`draw.defaultAdvancePerGroup` = 2); giá trị khác cần đặc tả vị trí — để giai đoạn sau; xếp theo nhóm hạt giống; lịch vòng tròn; BXH bảng theo `GroupScoringRule`.
- Bảng → nhánh: nhất bảng là hạt giống theo thứ tự bảng; nhì bảng ở nửa nhánh đối diện với nhất cùng bảng.
- Thể thức trận ghi đè theo vòng (`Round.matchFormatId`), mặc định từ nội dung.
- Nháp: đổi chỗ 2 vị trí (sinh lại trạng thái dẫn xuất: BYE tự đẩy vòng 2, nhãn ô chờ), bốc lại; Công bố.
<!-- Red Team: Sửa draw sau công bố — 2026-11-11 -->
- Sau công bố (mỗi thao tác bắt buộc lý do + audit, chỉ `ADMIN`):
  - `unpublish`: về `DRAFT` khi chưa có trận không-BYE nào `LIVE`/`OFFICIAL`.
  - `replace-entry`: thay entry tại một vị trí khi trận vòng 1 của vị trí đó chưa đấu (nếu vị trí có BYE và đã được đẩy lên vòng sau → thay luôn ở trận kế, khi trận kế chưa đấu).
  - `withdraw-from-draw`: loại trực tiếp → trận hiện tại của entry thành `WALKOVER` cho đối thủ (đối thủ chưa biết → walkover khi đối thủ được đẩy vào); vòng bảng → theo `GroupScoringRule.withdrawalPolicy` (`KEEP_PLAYED_RESULTS`: trận còn lại thua walkover; `VOID_ALL_RESULTS`: mọi trận bảng của entry bị loại khỏi BXH; chưa chọn → chặn kèm thông báo). Entry → `WITHDRAWN`.
<!-- Red Team: Luật vòng bảng cho walkover/bỏ cuộc/rút lui — 2026-11-11 -->
- BXH bảng áp luật trận không đấu hết: walkover/bỏ cuộc tính ván/điểm theo `unfinishedMatchScoring` (+ `awardedGamePoints`), điểm trận theo `pointsWalkoverLoss` / `pointsUnfinishedLoss`; tỷ lệ ván/điểm xử lý mẫu bằng 0.
<!-- Red Team: Audit, phạm vi công khai, VĐV nhỏ tuổi, song ngữ — 2026-11-11 -->
- Audit mọi lần sinh draw, **kể cả bản nháp bị bỏ** (randomSeed + tham số), đổi chỗ, công bố, các thao tác sau công bố, phá hòa thủ công, ghi đè thể thức.
- Nhãn ô chờ của trận lưu dạng tham chiếu có cấu trúc (`{type: WINNER_OF, matchNo}`, `{type: QUALIFIER, index}`, `{type: GROUP_PLACE, group, place}`), render qua từ điển vi/en.

Non-functional
- Sinh nhánh 128 trong < 1 s; toàn bộ thao tác ghi trong 1 transaction, khóa `Draw` trước.

## Architecture

<!-- Red Team: Sửa draw sau công bố — 2026-11-11 -->
Model (migration `add_draws_rounds_matches_games`, `add_groups_and_standings`)

```prisma
enum DrawKind { QUALIFYING MAIN GROUP }
enum DrawStatus { DRAFT PUBLISHED }              // structure lock is derived, see isStructureLocked
model Draw { id String @id @default(uuid()); subEventId String; kind DrawKind; status DrawStatus @default(DRAFT)
  size Int?; seedCount Int @default(0); qualifierCount Int?; groupCount Int?; advancePerGroup Int?
  matchFormatId String?; randomSeed String; publishedAt DateTime?; startDate DateTime? @db.Date; version Int @default(0)
  positions BracketPosition[]; rounds Round[]; groups Group[]; @@unique([subEventId, kind]) }
enum PositionSource { ENTRY BYE QUALIFIER GROUP_PLACE }
model BracketPosition { id String @id @default(uuid()); drawId String; section Int @default(1); position Int
  source PositionSource; entryId String?; sourceRef Json? /* {type, index | group, place} */; @@unique([drawId, section, position]) }
model Round { id String @id @default(uuid()); drawId String; section Int @default(1); groupId String?
  scopeKey String /* "S1".."Sk" for knockout sections, "G-A" for groups; never null */; number Int
  code String /* R64,R32,R16,QF,SF,F | QF-1, QF-2 (counted back from section final) | GR1.. */
  matchFormatId String?; @@unique([drawId, scopeKey, number]) }
model Group { id String @id @default(uuid()); drawId String; code String /* A */; order Int; version Int @default(0)
  members GroupMember[]; standings GroupStanding[]; @@unique([drawId, code]) }
model GroupMember { groupId String; entryId String; slot Int; @@id([groupId, entryId]) }
model EventMatchCounter { eventId String @id; lastMatchNo Int @default(0) }   // matchNo allocated under row lock
enum MatchStatus { SCHEDULED LIVE OFFICIAL }
enum ResultType { NORMAL WALKOVER RETIRED DISQUALIFIED BYE }
model Match { id String @id @default(uuid()); eventId String; subEventId String; drawId String; roundId String
  groupId String?; section Int @default(1); orderInRound Int; matchNo Int /* per event, public URL */
  side1EntryId String?; side2EntryId String?; side1Source Json?; side2Source Json?   // structured placeholder refs
  nextMatchId String?; nextMatchSide Int?
  status MatchStatus @default(SCHEDULED); resultType ResultType?; winnerSide Int?; games1 Int?; games2 Int?
  isVoided Boolean @default(false)                   // excluded from group standings (withdrawal VOID_ALL_RESULTS)
  sessionId String?; tableId String?; scheduledAt DateTime?; orderInSession Int?; scheduleVersion Int @default(0)   // phase 07
  startedAt DateTime?; officialAt DateTime?; officialById String?; version Int @default(0)
  games Game[]; @@unique([eventId, matchNo]); @@index([drawId, roundId]); @@index([eventId, status]) }
model Game { id String @id @default(uuid()); matchId String; number Int; score1 Int; score2 Int; @@unique([matchId, number]) }
model GroupStanding { groupId String; entryId String; played Int; won Int; lost Int; matchPoints Int
  gamesFor Int; gamesAgainst Int; pointsFor Int; pointsAgainst Int; rank Int?; qualified Boolean @default(false)
  needsManualTiebreak Boolean @default(false); manualRank Int?; @@id([groupId, entryId]) }
```

- Phía trận = `Entry` → `Competitor` → VĐV/cặp (đội sau này không đổi bảng `Match`).
- `Round.scopeKey` không null → unique thật sự (Postgres không ràng buộc cột `NULL` trong unique).
- `isStructureLocked(drawId)` = tồn tại trận của draw có `status IN (LIVE, OFFICIAL)` và `resultType IS DISTINCT FROM 'BYE'`.
- `matchNo` cấp bằng `UPDATE "EventMatchCounter" SET last_match_no = last_match_no + n ... RETURNING` trong cùng transaction (khóa dòng mức event).
- Predicate dùng chung trong `packages/shared/src/match-predicates.ts`: `isRealMatch(m) = m.resultType !== 'BYE'`, `isPlayedMatch(m) = m.status === 'OFFICIAL' && isRealMatch(m) && !m.isVoided`.

Thuật toán (pseudocode, `packages/competition-engine`)

```
bracketSize(n) = nextPowerOfTwo(max(n, 2))

seedPositions(S, seedCount):            // ends of sections, standard pattern (confirmed by organiser at gate G1a)
  pos[1] = 1; pos[2] = S
  for tier k = 2, 4, 8, ... while placed < seedCount:
    candidates = section boundary positions for 2k sections not used yet   // e.g. S/2, S/2+1 for k=2
    assign seeds (k+1 .. 2k) to candidates in random order (seeded RNG)
  return map seed → position

generateKnockout(entries, S, seedCount, qualifierSlots, rng):
  seeds = entries with seed ≤ seedCount sorted by seed
  place seeds via seedPositions
  byes = S - entries.length - qualifierSlots
  give byes to opponents of seeds 1..min(byes, seedCount) (position paired in R1)
  remaining byes: spread across sections alternately top/bottom half, never BYE vs BYE
  qualifierSlots Q1..Qk: random among free positions whose R1 opponent is not a BYE
  others: random among free positions
  rounds: log2(S); codes from size (… R16, QF, SF, F)
  matches: R1 pairs (1,2),(3,4)…; nextMatch = floor(order/2), side = order odd ? 1 : 2
  matches with a BYE side → OFFICIAL/BYE, winner advanced immediately

deriveMatches(positions):              // used after every DRAFT swap/replace: rebuild BYE results + placeholders
  rebuild R1 sides from positions; reset later rounds; re-run BYE auto-advance; recompute side sources

generateQualifying(entries, k, rng):
  sections = k; distribute qualifying seeds 1..k one per section, rest random, sizes differ ≤ 1
  each section = generateKnockout(sectionEntries, bracketSize(len), seedCount=1 or 0)
  round codes per section counted back from the section final: QF-1 (deciding round), QF-2, ...
  winner of section i = qualifier i

allocateGroups(entries, G, rng):
  sort by seed asc then pointsAtEntry desc (unseeded last)
  pot 1 = first G → groups A..G in order; next pots: random group assignment per pot
roundRobin(members): circle method; group of 4 order: 1-4, 2-3, 1-3, 2-4, 1-2, 3-4

groupToKnockout(groups, advance ∈ {1, 2}):
  K = G * advance; S = bracketSize(K)
  winners as seeds in group order → seedPositions(S, G)
  runner-up of group X → random free position in the half opposite to winner of X
  BYEs as in generateKnockout
```

<!-- Red Team: Luật vòng bảng cho walkover/bỏ cuộc/rút lui — 2026-11-11 -->
BXH bảng (`group-standings-calculator.ts`, hàm thuần, luôn tính từ đầu)

```
matches = OFFICIAL, not voided matches of the group
per match: NORMAL → games/points as played
  WALKOVER / RETIRED / DISQUALIFIED → by rule.unfinishedMatchScoring:
    COUNT_PLAYED_ONLY: count only games actually played (walkover = 0 games)
    AWARD_REMAINING_TO_WINNER: winner gets remaining games up to need, each worth awardedGamePoints
  match points: winner pointsWin; loser pointsLoss | pointsWalkoverLoss (WALKOVER) | pointsUnfinishedLoss (RETIRED/DISQUALIFIED)
sort by matchPoints desc
resolve(tieSet, criteria):
  for criterion in rule.tiebreakers:      // e.g. H2H_MATCH_POINTS, H2H_GAMES_RATIO, H2H_POINTS_RATIO, GAMES_RATIO, POINTS_RATIO
    ratios compared by cross-multiplication (a/b vs c/d → a*d vs c*b); b = 0 and d = 0 → equal; only b = 0 → larger
    split tieSet by criterion value (head-to-head variants use only matches among tieSet)
    if split: resolve each sub-set again from the first criterion; return
  mark needsManualTiebreak (admin picks order = draw of lots)
qualified = rank ≤ advancePerGroup once all non-voided group matches are OFFICIAL
```

<!-- Red Team: Sửa kết quả và toàn vẹn khi chốt đồng thời — 2026-11-11 -->
Khóa và tính lại
- Mọi thao tác ghi lên draw/group (sinh, đổi chỗ, công bố, thao tác sau công bố, phá hòa, chốt trận ở phase 07) mở transaction bằng `SELECT … FROM "Draw" WHERE id = $1 FOR UPDATE`, rồi `Group` liên quan, rồi `Match`; thứ tự khóa cố định để tránh deadlock.
- `group-standings.service.recompute(groupId)`: đọc trận dưới khóa → calculator → thay toàn bộ `GroupStanding` của bảng (giữ `manualRank` nếu tập hòa không đổi) → `Group.version + 1`.

API (admin)

<!-- Red Team: Sửa draw sau công bố — 2026-11-11 -->
| Method | Path | Ghi chú |
|---|---|---|
| POST | `/admin/sub-events/:id/draws/preview {kind, seedCount?, qualifierCount?, groupCount?, groupSize?, advancePerGroup?}` | Chỉ tính, không ghi |
| POST | `/admin/sub-events/:id/draws` | Sinh `DRAFT` (ghi đè draft cũ cùng kind, có xác nhận ở UI; draft cũ được audit) |
| GET | `/admin/draws/:id/bracket`, `/admin/draws/:id/groups` | Một query có join, không N+1 |
| POST | `/admin/draws/:id/swap {positionA, positionB, expectedVersion}` | Chỉ `DRAFT`; sinh lại trạng thái dẫn xuất |
| POST | `/admin/draws/:id/publish` | → `PUBLISHED`, revalidate |
| POST | `/admin/draws/:id/unpublish {reason}` | Khi chưa khóa cấu trúc |
| POST | `/admin/draws/:id/replace-entry {positionId, newEntryId, reason, expectedVersion}` | Vị trí chưa đấu |
| POST | `/admin/draws/:id/withdraw-entry {entryId, reason, expectedVersion}` | Walkover / theo `withdrawalPolicy` |
| DELETE | `/admin/draws/:id` | Chỉ `DRAFT` |
| POST | `/admin/draws/:id/place-qualifiers` | Khi đủ k suất; RNG có hạt |
| POST | `/admin/draws/:id/place-group-qualifiers` | Khi mọi bảng xong, không còn tie thủ công |
| PATCH | `/admin/groups/:id/manual-ranks {entryId: rank}` | Phá hòa thủ công, audit |
| POST | `/admin/groups/:id/recompute` | Tính lại BXH bảng (idempotent) |
| PATCH | `/admin/rounds/:id {matchFormatId}` | Ghi đè thể thức theo vòng |
| POST | `/admin/sub-events/:id/entries/suggest-seeds` | Theo BXH (phase 09 nối dữ liệu) |

Module Nest: `draws` (`draw-generation.service.ts`, `draw-persistence.service.ts`, `draw-publish.service.ts`, `draw-post-publish.service.ts`, `draw-lock.ts`), `groups` (`group-standings.service.ts`), `matches` (khung + `match-number-allocator.ts`; phase 07 mở rộng).

Màn admin — hub giải → tab **Bốc thăm** (menu dọc chọn nội dung)
1. Nội dung chưa có draw → nút "Bốc thăm" (1) → wizard 3 bước có chỉ báo tiến độ:
   - Bước 1 Thông số: đã điền sẵn từ nội dung + AppSetting; dòng tóm tắt sống "51 VĐV → nhánh 64 · 13 BYE · 16 hạt giống" cập nhật khi sửa.
   - Bước 2 Hạt giống: danh sách đăng ký `CONFIRMED` sắp theo seed; sửa seed tại chỗ; "Gợi ý theo BXH".
   - Bước 3 → "Bốc thăm" (2) → hiển thị nhánh nháp.
2. Nháp: click vị trí A rồi vị trí B → "Đổi chỗ" (2 click); "Bốc lại" (xác nhận).
3. "Công bố" (xác nhận: "Nhánh đấu hiện công khai; khi trận đầu tiên bắt đầu sẽ khóa cấu trúc") → xong. Tổng ≈ 5 click cho một nội dung.
<!-- Red Team: Sửa draw sau công bố — 2026-11-11 -->
4. Sau công bố: menu "…" trên nhánh → "Hủy công bố" (chỉ hiện khi chưa khóa); click một ô VĐV → "Thay VĐV" / "Rút khỏi nhánh" → modal có xem trước ảnh hưởng ("Trận #12 thành walkover cho Trần B") + ô lý do bắt buộc.
- Vòng bảng: tương tự, bước 3 hiển thị các bảng + lịch vòng tròn; tab con "Bảng đấu" hiển thị BXH, cờ "Cần phá hòa thủ công" nổi bật kèm nút xử lý, nút "Tính lại BXH".

## Related Code Files

Create
- `packages/competition-engine/src/{types.ts,bracket-size.ts,round-codes.ts,seeded-random.ts,seed-positions.ts,knockout-generator.ts,bye-allocation.ts,derive-matches.ts,qualifying-generator.ts,group-allocation.ts,round-robin-generator.ts,group-to-knockout-placement.ts,group-standings-calculator.ts,tiebreak-resolvers.ts,ratio-compare.ts,index.ts}`
- Test cùng tên `*.test.ts` cho từng file trên
- `packages/shared/src/match-predicates.ts` + test
- `packages/db/prisma/schema.prisma` + 2 migrations
- `apps/api/src/modules/draws/{draws.module.ts,admin-draws.controller.ts,draw-generation.service.ts,draw-persistence.service.ts,draw-publish.service.ts,draw-post-publish.service.ts,draw-lock.ts,dto/*.ts}`
- `apps/api/src/modules/groups/{groups.module.ts,admin-groups.controller.ts,group-standings.service.ts}`
- `apps/api/src/modules/matches/{matches.module.ts,match-query.service.ts,match-number-allocator.ts}`
- `apps/admin/src/pages/event-hub/{draws-tab.tsx,draw-wizard.tsx,draw-params-step.tsx,draw-seeds-step.tsx,admin-bracket-view.tsx,group-tables-view.tsx,manual-tiebreak-modal.tsx,draw-entry-action-modal.tsx}`
- Test: `apps/api/test/{draws.e2e-spec.ts,draw-post-publish.e2e-spec.ts,group-standings-concurrency.e2e-spec.ts}`

Modify: `event-hub-page.tsx` (tab), `app.module.ts`, `apps/api/src/modules/revalidation/cache-tags.ts`.

## Implementation Steps

Lát cắt (tuần 4–5)
1. `types.ts`, `bracket-size`, `round-codes`, `seeded-random`, `seed-positions`, `bye-allocation`, `knockout-generator`, `derive-matches` — viết test trước cho phần loại trực tiếp của ma trận dưới, rồi code tới khi xanh.
2. Migration `add_draws_rounds_matches_games` → áp dụng DB cục bộ (in host + tên DB).
3. Services sinh/lưu/công bố draw `MAIN` + `match-number-allocator` + khóa `Draw` + audit sinh/đổi chỗ/công bố; `match-predicates`.
4. Màn admin tối thiểu: wizard, nhánh nháp, đổi chỗ, công bố.

Phần còn lại (tuần 10–11, sau cổng G1b)
5. `ui-consistency:finding-patterns` → `ui-consistency:planning`: mẫu wizard (từ phase 05), mẫu "nhánh đấu trong admin" dùng lại cấu trúc dữ liệu với UI công khai.
6. Engine: vòng loại (mã vòng đếm ngược từ trận cuối section), chia bảng, vòng tròn, BXH bảng với luật trận không đấu hết + mẫu 0, bảng → nhánh (`advancePerGroup ∈ {1, 2}`); test trước.
7. Migration `add_groups_and_standings`; group standings service (khóa + tính từ đầu) + endpoint recompute.
8. Thao tác sau công bố: unpublish, replace-entry, withdraw-entry (knockout walkover, bảng theo policy) + audit + revalidate; phá hòa thủ công; ghi đè thể thức theo vòng.
9. Màn admin đầy đủ: vòng loại, bảng đấu, phá hòa, thao tác sau công bố có xem trước ảnh hưởng.
10. Đăng ký mutation vào `cache-tags.ts`; `ui-consistency:verifying`; deploy + migrate staging.

Ma trận test engine

| Ca | Kỳ vọng |
|---|---|
| n = 2, 3, 5, 8, 17, 51, 64, 100, 128 | kích thước đúng; số BYE = S − n; không BYE–BYE |
| 51/64/16 hạt giống | hạt giống 1–2 khác nửa; 3–4 khác phần tư; 1–8 không gặp nhau trước QF; 13 BYE cho hạt giống 1–13 |
| cùng `randomSeed` | kết quả giống hệt; khác seed → khác |
| đổi chỗ trong nháp vị trí có BYE | BYE tự đẩy vòng 2 được tính lại; nhãn ô chờ đúng |
| vòng loại 40 VĐV, k = 8 / k = 6 | 8 / 6 phân nhánh, chênh cỡ ≤ 1, hạt giống vòng loại mỗi nhánh 1; section lệch kích thước vẫn có `QF-1` là trận cuối |
| ô Q trong nhánh chính | không ô Q nào đối diện BYE |
| vòng tròn 3, 4, 5 | mỗi cặp đúng 1 lần; n lẻ có lượt nghỉ |
| BXH: hòa 2 người, hòa vòng 3 người, hòa không phá được | thứ tự đúng theo thứ tự tiêu chí; trường hợp cuối → `needsManualTiebreak` |
| BXH: walkover, bỏ cuộc giữa trận, cả hai cách `unfinishedMatchScoring` | ván/điểm/điểm trận đúng luật |
| BXH: VĐV thua 0 ván (mẫu tỷ lệ = 0) | không chia cho 0, thứ tự xác định |
| rút lui giữa bảng: `KEEP_PLAYED_RESULTS` / `VOID_ALL_RESULTS` / chưa chọn | trận còn lại walkover / trận bị loại khỏi BXH / bị chặn |
| đổi thứ tự tiêu chí trong `GroupScoringRule` | thứ hạng đổi theo, không sửa code |
| bảng → nhánh 4×2 | nhì không gặp nhất cùng bảng trước chung kết nửa nhánh |

## Todo List

- [ ] (Lát cắt) Engine loại trực tiếp + test (kích thước, hạt giống, BYE, đổi chỗ sinh lại dẫn xuất)
- [ ] (Lát cắt) Migration draws/rounds/matches/games; cấp `matchNo` theo khóa mức event
- [ ] (Lát cắt) Sinh/lưu/công bố draw MAIN + khóa Draw + audit; predicate trận đã đấu
- [ ] (Lát cắt) Màn admin tối thiểu: wizard, nháp, đổi chỗ, công bố
- [ ] Cổng G1b: câu trả lời BTC về chia bảng, phá hòa, rút lui giữa bảng
- [ ] ui-consistency: finding-patterns → planning
- [ ] Engine vòng loại, vòng bảng, BXH (walkover/bỏ cuộc/rút lui, mẫu 0), bảng → nhánh + test
- [ ] Migration groups/standings; recompute idempotent dưới khóa
- [ ] Unpublish, replace-entry, withdraw-entry + audit + revalidate
- [ ] API admin draws/groups/rounds đầy đủ
- [ ] Màn admin đầy đủ + xem trước ảnh hưởng
- [ ] ui-consistency: verifying; deploy staging

## Success Criteria

- Toàn bộ ma trận test engine xanh; coverage `packages/competition-engine` ≥ 90 % dòng.
<!-- Red Team: Sửa draw sau công bố — 2026-11-11 -->
- Tích hợp: sinh nhánh có BYE → công bố → **chưa khóa** (BYE không tính); bắt đầu 1 trận không-BYE (phase 07 hoặc cập nhật trực tiếp trong test) → swap/unpublish bị từ chối 409, replace-entry ở vị trí chưa đấu vẫn được.
- Withdraw-entry ở knockout → trận hiện tại `WALKOVER`, đối thủ được đẩy vòng sau; ở bảng → BXH tính lại đúng theo policy.
- Hai request ghi cùng draw với cùng `expectedVersion` → 1 thành công, 1 nhận 409; `Round` trùng `(drawId, scopeKey, number)` → DB từ chối.
- Mọi lần sinh draw (kể cả nháp bị bỏ) có dòng `AuditLog` chứa `randomSeed` + tham số.
- Bốc thăm một nội dung 51 VĐV ≈ 5 click; tóm tắt thông số hiển thị trước khi ghi.

## Risk Assessment

| Rủi ro | Khả năng × Tác động | Xử lý |
|---|---|---|
| Quy tắc đặt hạt giống/chia bảng của Kamito khác chuẩn | Trung bình × Trung bình | Cổng G1; đổi chỗ thủ công trong nháp |
| Engine tự viết thiếu ca biên | Trung bình × Cao | Ma trận test viết trước; coverage ≥ 90 %; dự phòng tuần 13 |
| Sai sót phát hiện sau công bố | Trung bình × Cao | Unpublish / replace / withdraw có audit |
| Chốt đồng thời cùng bảng ghi đè BXH | Trung bình × Cao | Khóa Draw/Group + tính từ đầu + test đồng thời |
| Sửa kết quả sau khi bảng đã đưa người vào nhánh | Thấp × Cao | Reopen có xem trước + đường cưỡng chế (phase 07) |

Rollback: bảng mới; revert app; draw nháp xóa được, không ảnh hưởng dữ liệu đăng ký.

## Security Considerations

- Chỉ `ADMIN` sinh/đổi/công bố/thao tác sau công bố; `randomSeed` chỉ admin xem (lộ trước có thể đoán kết quả bốc lại).
- Draw `DRAFT` không bao giờ trả qua API public (predicate phạm vi công khai, phase 08).

## Next Steps

- Lát cắt tiếp tục ở phase 07 (nhập/chốt tỷ số, đẩy nhánh). Phase 08 hiển thị nhánh công khai; phase 09 dùng mã vòng (gồm `QF-n`) và `GroupStanding.rank`.
