# Bốc thăm, hạt giống, vòng bảng (phase 06)

> Cập nhật quyết định: 2026-11-27 · Code phase 06 đã commit, chưa deploy staging. Người dùng đã duyệt G1a/G1b trong phiên: giữ mẫu seed/pot hiện tại, không tránh CLB, `KEEP_PLAYED_RESULTS`; default seed mới được triển khai/kiểm riêng, không ghi đè rule cũ. [Bản quyết định](../plans/261127-debt-closure/btc-consent-decisions.md).
> Nguồn đối chiếu: `packages/competition-engine/src/`, `apps/api/src/modules/{draws,groups,matches}/`, `packages/db/prisma/schema/{draws-and-matches,groups-and-standings}.prisma`, `packages/db/src/domain/draw-locks.ts`, `packages/shared/src/tournament-settings.ts`.
> Tổng quan kiến trúc: [system-architecture](./system-architecture.md). Quy ước code: [code-standards](./code-standards.md#bốc-thăm-và-vòng-bảng-phase-06).

## Contents
- [Phạm vi](#phạm-vi)
- [Engine: `@kamito/competition-engine`](#engine-kamitocompetition-engine)
- [Mô hình dữ liệu](#mô-hình-dữ-liệu)
- [API](#api)
- [Xem trước và thao tác sau công bố (dryRun)](#xem-trước-và-thao-tác-sau-công-bố-dryrun)
- [Vòng loại và nhánh chính](#vòng-loại-và-nhánh-chính)
- [Vòng bảng](#vòng-bảng)
- [Walkover treo](#walkover-treo)
- [Khóa và đồng thời](#khóa-và-đồng-thời)
- [Mã lỗi](#mã-lỗi)
- [Chưa làm](#chưa-làm)

## Phạm vi

Một nội dung (`SubEvent`) có tối đa một nhánh mỗi loại (`MAIN`, `QUALIFYING`, `GROUP`). Phase 06 làm:
- Sinh nhánh loại trực tiếp, vòng loại (nhiều nhánh con), vòng bảng (lịch vòng tròn).
- Xếp hạt giống, BYE, đổi chỗ (swap) khi còn là nháp.
- Công bố. Sau công bố: bỏ công bố, thay VĐV, rút VĐV, phá hòa tay, xếp suất vòng loại và nhất/nhì bảng vào nhánh chính.

Nhập, chốt, sửa và mở lại tỷ số: xem [match-results](./match-results.md). Lịch thi đấu: xem [scheduling](./scheduling.md). Chưa có (phase sau): bảng xếp hạng và điểm đầy đủ (phase 09). `POST /sub-events/:id/entries/suggest-seeds` trả `{available: false, suggestions: []}` tới phase 09.

## Engine: `@kamito/competition-engine`

Nguồn: `packages/competition-engine/src/index.ts` (export mọi module).

- **Hàm thuần.** Nhận dữ liệu, trả kết quả. Không import Prisma, Nest hay I/O. Phụ thuộc duy nhất là `@kamito/shared` (`TiebreakCriterion`, `isPlayedMatch`). Không dùng `Math.random` hay đồng hồ hệ thống.
- **RNG có hạt.** `createRng(seed)` (`seeded-random.ts`) băm chuỗi bằng cyrb128 rồi sinh số bằng sfc32. Cùng seed cho cùng kết quả trên mọi runtime. Mỗi nhánh lưu `randomSeed` (32 ký tự hex từ `randomBytes(16)`). Bốc lại = sinh seed mới.
- **Lỗi nghiệp vụ.** Engine ném `DrawParamsError(code)`. API đổi thành 422 giữ nguyên `code` (`runEngine` trong `draw-errors.ts`).
- **Giới hạn cấu trúc.** `MIN_GROUP_SIZE = 3`, `MAX_GROUPS = 26` (`group-allocation.ts`). Advance mỗi bảng chỉ 1 hoặc 2 (schema validate ở `draw-dtos.ts`).

| Nhóm | File chính | Việc làm |
|---|---|---|
| Kích thước và BYE | `bracket-size.ts`, `bye-allocation.ts` | Kích thước nhánh (lũy thừa 2), số vòng, vị trí BYE |
| Hạt giống | `seed-positions.ts` | Vị trí hạt giống trong nhánh |
| Loại trực tiếp | `knockout-generator.ts`, `derive-matches.ts`, `round-codes.ts` | Sinh trận, liên kết trận kế tiếp, mã vòng (R64…F, QF-1/QF-2) |
| Vòng loại | `qualifying-generator.ts`, `fill-placeholder-positions.ts` | Nhiều nhánh con, điền ô `QUALIFIER` và `GROUP_PLACE` |
| Vòng bảng | `group-allocation.ts`, `round-robin-generator.ts` | Chia bảng theo pot, lịch vòng tròn |
| Điểm và BXH | `group-match-scoring.ts`, `group-standings-calculator.ts`, `tiebreak-resolvers.ts`, `ratio-compare.ts` | Tính điểm, phá hòa theo tiêu chí, so tỷ lệ không chia |
| Bảng sang nhánh | `group-to-knockout-placement.ts` | Xếp nhất/nhì bảng vào nhánh chính |
| Rút lui giữa bảng | `group-withdrawal-plan.ts` | Kế hoạch theo `KEEP_PLAYED_RESULTS` hoặc `VOID_ALL_RESULTS` |
| Xem trước | `draw-preview.ts` | Số ô, số BYE, số VĐV mỗi nửa nhánh |

Kiểm thử: 18 file, 178 test, độ phủ dòng 99.57% (`plans/reports/tester-261113-phase-06-full-suite.md`).

## Mô hình dữ liệu

Nguồn: `draws-and-matches.prisma`, `groups-and-standings.prisma`. Migration: `20261113030544_add_draws_rounds_matches_games`, `20261113030600_add_groups_and_standings`. Cả hai chỉ thêm bảng, cột nullable và FK.

| Model | Vai trò | Ràng buộc chính |
|---|---|---|
| `Draw` | Một nhánh của nội dung | unique `(subEventId, kind)`. `status` DRAFT/PUBLISHED. `version` tăng mỗi lần ghi. `randomSeed`, `size`, `seedCount`, `qualifierCount`, `groupCount`, `advancePerGroup`. Không lưu cờ khóa |
| `BracketPosition` | Một ô trong nhánh | unique `(drawId, section, position)`. `source`: ENTRY, BYE, QUALIFIER, GROUP_PLACE. `sourceRef` (JSON) cho ô chưa biết VĐV |
| `Round` | Một vòng | unique `(drawId, scopeKey, number)`. `scopeKey` là `S1..Sk` (nhánh loại trực tiếp) hoặc `G-<mã bảng>` (vòng bảng). `matchFormatId` có thể ghi đè theo vòng |
| `Match` | Một trận | unique `(eventId, matchNo)`. `side1/2EntryId`, `side1/2Source` (JSON: `WINNER_OF`, `QUALIFIER`, `GROUP_PLACE`), `nextMatchId`/`nextMatchSide`. `status` SCHEDULED/LIVE/OFFICIAL, `resultType`, `winnerSide`, `isVoided`, `version`. Các cột lịch (`sessionId`, `tableId`, `scheduledAt`…) để trống tới phase 07 |
| `Game` | Ván trong trận | unique `(matchId, number)`. Có trong schema, phase 06 chưa ghi |
| `EventMatchCounter` | Bộ đếm `matchNo` theo giải | `allocateMatchNumbers` upsert dưới khóa dòng. Bộ đếm không lùi khi sinh lại nháp, nên số trận có thể hở. Đây là chủ ý |
| `Group` | Một bảng | unique `(drawId, code)`. `version` để khóa lạc quan khi nhập hạng tay |
| `GroupMember` | VĐV trong bảng | PK `(groupId, entryId)`, `slot` |
| `GroupStanding` | Dòng BXH | PK `(groupId, entryId)`. Tính lại toàn bộ khi recompute, không sửa tăng dần. `rank`, `qualified`, `needsManualTiebreak`, `manualRank` |

**Khóa cấu trúc (derived).** `isStructureLocked(tx, drawId)` trả true khi có trận `LIVE` hoặc `OFFICIAL` không phải BYE. Không lưu cột. Khi bị khóa: không sinh lại, không swap, không bỏ công bố (`DRAW_STRUCTURE_LOCKED`).

## API

Base `/api/v1/admin`. Quyền theo `PERMISSION_MATRIX` (`packages/shared/src/permissions.ts`): `tournaments` với `list`/`read` cho RESULTS_OPERATOR, và `create`/`update`/`publish`/`delete` cho ADMIN. Thành công `{data: ...}`, lỗi `{error: {code, message, ...}}`.

| Method và đường dẫn | Quyền | Ghi chú |
|---|---|---|
| `GET /events/:eventId/draws` | `tournaments.list` | Tóm tắt nhánh theo nội dung |
| `POST /sub-events/:id/draws/preview` | `tournaments.create` | Xem trước, không ghi |
| `POST /sub-events/:id/draws` | `tournaments.create` | Sinh nháp (201). Có nháp cùng loại thì bắt buộc `expectedVersion` |
| `GET /draws/:id/bracket` | `tournaments.read` | Ô, vòng, trận. `randomSeed` chỉ trả khi caller có `tournaments.update` |
| `GET /draws/:id/groups` | `tournaments.read` | Bảng, thành viên, BXH, trận. Cùng quy tắc `randomSeed` |
| `POST /draws/:id/swap` | `tournaments.update` | Đổi chỗ hai ô cùng nhánh con, chỉ khi nháp |
| `POST /draws/:id/swap-group-members` | `tournaments.update` | Đổi chỗ hai VĐV của vòng bảng nháp (xem mục dưới) |
| `POST /draws/:id/publish` | `tournaments.publish` | Kiểm VĐV còn hiệu lực, hoàn tất walkover treo |
| `DELETE /draws/:id?expectedVersion=N` | `tournaments.delete` | Chỉ nháp |
| `POST /draws/:id/place-qualifiers` | `tournaments.update` | Xếp suất vòng loại vào MAIN |
| `POST /draws/:id/place-group-qualifiers` | `tournaments.update` | Xếp nhất/nhì bảng vào MAIN (ô `GROUP_PLACE`) |
| `POST /draws/:id/unpublish` | `tournaments.update` | Về nháp. Hỗ trợ `dryRun` |
| `POST /draws/:id/replace-entry` | `tournaments.update` | Thay VĐV ở một ô. Chỉ nhánh đã công bố. Hỗ trợ `dryRun` |
| `POST /draws/:id/withdraw-entry` | `tournaments.update` | Rút VĐV khỏi nhánh. Hỗ trợ `dryRun` |
| `PATCH /rounds/:id` | `tournaments.update` | Đổi thể thức của vòng (`matchFormatId` hoặc `null`) |
| `PATCH /groups/:id/manual-ranks` | `tournaments.update` | Nhập hạng tay cho khối hòa. Body `{ranks, reason, expectedVersion}` |
| `POST /groups/:id/recompute` | `tournaments.update` | Tính lại BXH bảng. Idempotent, không cần version |
| `POST /sub-events/:id/entries/suggest-seeds` | `tournaments.create` | Trả rỗng tới phase 09 |

Đổi stage của VĐV đang nằm trong nhánh đã công bố (`PATCH /entries/:id`, bulk `setStage`) bị chặn bằng 409 `ENTRY_IN_PUBLISHED_DRAW`.

## Đổi chỗ thành viên vòng bảng (nháp)

`POST /admin/draws/:id/swap-group-members`, quyền `tournaments.update`. Nguồn: `apps/api/src/modules/draws/group-member-swap.service.ts`.

- Body: `{ entryA, entryB, expectedVersion }` (`entryA`, `entryB` là UUID của entry; `expectedVersion` là version nhánh hiện tại). Thành công trả `{ data: <tóm tắt nhánh> }` với version đã tăng.
- Hai VĐV đổi nhóm và ô (`slot`) cho nhau, có thể khác bảng hoặc cùng một bảng. BXH khởi tạo (`GroupStanding`) đi theo VĐV.
- Trận vòng bảng đã sinh được hoán VĐV theo: `Match.groupId` giữ nguyên, hai phía của các trận có hai VĐV này được đổi chỗ, mỗi trận tăng `version`. Trận đã xếp lịch giữ nguyên lịch nên sẽ mang lịch của VĐV mới. Xung đột lịch (nếu có) chỉ hiện khi đọc ở tab Lịch, không cảnh báo ngay lúc đổi.
- Chạy trong một transaction: khóa SubEvent rồi Draw, so `expectedVersion`, ghi audit `draw.swapGroupMembers` (có trước và sau của cả hai VĐV).

| Mã lỗi | HTTP | Khi nào |
|---|---|---|
| `DRAW_VERSION_CONFLICT` | 409 | `expectedVersion` đã cũ |
| `DRAW_NOT_DRAFT` | 409 | Nhánh đã công bố |
| `DRAW_STRUCTURE_LOCKED` | 409 | Đã có trận bắt đầu |
| `KIND_NOT_ALLOWED` | 422 | Nhánh không phải vòng bảng |
| `INVALID_PARAMS` | 422 | `entryA` trùng `entryB` |
| `ENTRY_NOT_IN_DRAW` | 422 | Một trong hai VĐV không thuộc vòng bảng này |

## Xem trước và thao tác sau công bố (dryRun)

Áp dụng cho `unpublish`, `replace-entry`, `withdraw-entry`. Nguồn: `apps/api/src/modules/draws/draw-impact.ts` (`executeOperation`).

- **Cùng một đoạn code.** Dry run chạy đúng luồng thật trong transaction, rồi ném `DryRunAbort` để rollback. Audit và walkover đã settle cũng bị rollback. Xem trước không thể lệch với thao tác thật.
- **Kết quả dry run.** HTTP 200 với `{allowed: true, impacts}`. Nếu bị chặn nghiệp vụ (409/422 có `code`) thì `{allowed: false, blockedCode, impacts: []}`. Riêng `DRAW_VERSION_CONFLICT` và `VALIDATION_FAILED` vẫn trả lỗi thật.
- **Chạy thật.** Trả `{draw, impacts}`. Mỗi lần ghi một bản audit cùng transaction.
- **Lý do.** Bắt buộc khi chạy thật, 3–500 ký tự sau khi trim (`packages/shared/src/draw-limits.ts`). Dry run không bắt buộc, để admin xem trước rồi mới nhập lý do.

`impacts[]` có `type`:

| `type` | Ý nghĩa | Trường đi kèm |
|---|---|---|
| `WALKOVER` | Trận thành walkover cho đối thủ | `matchId`, `matchNo`, `roundCode`, `beneficiary` |
| `VOID_MATCH` | Trận bảng bị loại khỏi BXH (rút lui, policy `VOID_ALL_RESULTS`) | `matchNo`, `groupCode` |
| `REPLACE_SIDE` | Thay VĐV ở một phía trận | `matchNo`, `removed`, `added` |
| `STANDINGS_RECOMPUTE` | BXH bảng được tính lại | `groupCode` |
| `UNPUBLISH` | Nhánh về nháp | — |

Entry trong `impacts` được chuyển thành `EntryBrief` (`hydrateImpacts`). UI tự dựng câu tiếng Việt từ `type`.

## Vòng loại và nhánh chính

- Nhánh `QUALIFYING` gồm nhiều nhánh con (section). Mỗi nhánh con cho ra `qualifierCount` suất.
- `place-qualifiers` chỉ chạy khi mọi section đã có trận chung kết `OFFICIAL` (409 `QUALIFYING_NOT_FINISHED {pendingSections}`).
- Thứ tự ô được điền bằng RNG có seed mới (`placementSeed`, ghi audit). Không dùng `randomSeed` của nhánh, để ai biết seed cũng không đoán trước được ô.
- Người thắng vòng loại đã rút vẫn được xếp vào ô. Trận đầu của họ ở MAIN thành walkover cho đối thủ ngay. Không có lucky loser (xem [Chưa làm](#chưa-làm)).
- Rút VĐV ở `QUALIFYING` mà VĐV đã nằm trong MAIN đã công bố: walkover ở MAIN được xử lý trong cùng transaction (`cascadeToMain`), impacts gộp chung.

## Vòng bảng

- **Chia bảng.** Số bảng lấy từ `groupCount`, hoặc từ `groupSize` (mặc định `draw.defaultGroupSize`). Pot xếp theo hạt giống rồi điểm (`byStrength`). Pot đầu giữ thứ tự, các pot sau xáo trộn bằng RNG.
- **Lịch.** Vòng tròn trong mỗi bảng. Vòng mã `GR1…`, `scopeKey = G-<mã bảng>`.
- **BXH.** `GroupStandingsService` tính lại toàn bộ từ trận của bảng. Trận bị `isVoided` và trận BYE không tính. Phá hòa theo tiêu chí của `GroupScoringRule`. So tỷ lệ bằng `compareRatio` (không chia, mẫu số 0 được xử lý).
- **Hòa không tự phá được.** Đặt `needsManualTiebreak`. Admin nhập hạng tay bằng `PATCH /groups/:id/manual-ranks`. Hạng phải phủ đúng khối hòa, mỗi VĐV một hạng, liên tiếp từ hạng cao nhất của khối (422 `INVALID_MANUAL_RANKS`).
- **Sang nhánh chính.** Sinh MAIN bằng `POST /sub-events/:id/draws {kind: MAIN}` sau khi nhánh GROUP đã công bố (409 `GROUP_DRAW_NOT_PUBLISHED` nếu chưa). Nhì bảng được đặt vào nửa nhánh đối diện với nhất cùng bảng, để hai người cùng bảng không gặp nhau trước chung kết (`group-to-knockout-placement.ts`). Khi mọi bảng đã đấu xong và không còn hòa, gọi `place-group-qualifiers`.
- **Rút lui giữa bảng.** Theo `GroupScoringRule.withdrawalPolicy`:

| Policy | Trận đã chốt `OFFICIAL` | Mọi trận chưa `OFFICIAL` (kể cả `LIVE`) |
|---|---|---|
| `KEEP_PLAYED_RESULTS` | Giữ nguyên | Thành walkover cho đối thủ |
| `VOID_ALL_RESULTS` | Mọi trận bảng của VĐV bị `isVoided` | Không đấu |

  G1 chốt `KEEP_PLAYED_RESULTS` ngày 2026-11-27: trận đang dở cho **đối thủ của người rút** thắng walkover, không xét ai đang dẫn. Rule cũ chưa chọn policy vẫn trả 409 `WITHDRAWAL_POLICY_MISSING`; seed idempotent không cập nhật row đã có. VĐV rút vẫn giữ hạng hiển thị, `qualified = false`; suất đi tiếp dồn cho người kế tiếp. Không tự backfill rule/giải cũ.
- **Sau khi đã xếp vào MAIN** (có ô `GROUP_PLACE`): không recompute, không nhập hạng tay (409 `GROUPS_ALREADY_PLACED`).

## Walkover treo

Trận có `resultType = WALKOVER`, `status = SCHEDULED`, và `winnerSide` trỏ vào phía còn trống là **walkover treo** (`knockout-walkover.ts`).

- VĐV rút vẫn đứng ở phía của mình. Người thắng là ai được đẩy vào phía trống.
- Khi đối thủ được đẩy vào, `settleDeferredWalkover` chuyển trận sang `OFFICIAL` (có `officialAt`), đẩy người thắng lên trận kế, và lặp lại nếu trận kế cũng treo.
- Walkover treo chưa tính là đã đấu. `publish` hoàn tất các walkover còn treo (`settlePendingWalkovers`).
- Bỏ công bố rồi đổi chỗ: walkover treo đi theo VĐV đã rút, không ở lại ô cũ (`draw-derived-sync.ts`).
- **Phase 07.** `advanceWinner` (chốt tỷ số) gọi `settleDeferredWalkover` khi đẩy người thắng vào trận kế. Trận treo không nhận kết quả nhập tay (409 `MATCH_NOT_READY`). Đoạn code mới nào đưa VĐV vào một phía trận cũng phải gọi hàm này.

## Khóa và đồng thời

Thứ tự khóa cố định, mọi đường ghi phải đi theo:

| Thứ tự | Khóa | Ai lấy |
|---|---|---|
| 1 | Advisory lock theo import (phase 05) | Commit import |
| 2 | Dòng `SubEvent`, `FOR UPDATE` | Mọi thao tác ghi draw (`loadDrawLocked`, `generate`), ghi entry, bulk, merge |
| 3 | Dòng `Draw`, `FOR UPDATE` (`lockDraw`) | Mọi thao tác ghi nhánh. `loadDrawLocked` kiểm `expectedVersion` sau khi khóa |
| 4 | Dòng `Group` theo `id` tăng dần (`lockGroups`) | Thao tác bảng, rút lui bảng, phá hòa, recompute |
| 5 | Dòng `Player` (phase 05) | Entry và merge. Draw không lấy khóa Player |
| 6 | `EventMatchCounter` (upsert, khóa dòng) | Cấp `matchNo`. Lấy sau cùng, không tạo vòng chờ |

- **Phase 06 không khóa dòng `Match`.** Trận chỉ được ghi trong lúc đang giữ khóa `Draw` (hoặc `Group` với trận bảng). Phase 07 khóa `Match` sau `Group`, xem [match-results](./match-results.md#khóa-và-đồng-thời).
- Rút VĐV ở QUALIFYING có thể khóa thêm nhánh MAIN (`cascadeToMain`). Lấy sau khóa SubEvent và Draw của nhánh gốc, nên không tạo chu trình.
- Lỗi xung đột phiên bản: 409 `DRAW_VERSION_CONFLICT` kèm `currentVersion` (xem [code-standards](./code-standards.md#bốc-thăm-và-vòng-bảng-phase-06)).

## Mã lỗi

Lỗi 409 mang thêm khóa chi tiết (whitelist trong `common/filters/http-exception.filter.ts`): `currentVersion`, `pendingSections`, `pendingGroups`, `groups`, `entryIds`, `withdrawnEntryIds`, `missingEntryIds`.

| Mã | HTTP | Khi nào |
|---|---|---|
| `DRAW_VERSION_CONFLICT` | 409 | `expectedVersion` lệch hoặc thiếu khi đã có nháp. Có `currentVersion` |
| `DRAW_ALREADY_PUBLISHED` | 409 | Sinh lại, xóa hoặc sửa nhánh đã công bố |
| `DRAW_NOT_DRAFT` | 409 | Thao tác chỉ dành cho nháp (swap, xóa) |
| `DRAW_NOT_PUBLISHED` | 409 | Thao tác chỉ dành cho nhánh đã công bố |
| `DRAW_STRUCTURE_LOCKED` | 409 | Có trận LIVE hoặc OFFICIAL không phải BYE |
| `DRAW_EMPTY` | 409 | Công bố nhánh chưa có cấu trúc |
| `DRAW_STALE_ENTRIES` | 409 | Danh sách VĐV đã đổi so với lúc bốc. Có `withdrawnEntryIds`, `missingEntryIds`. UI: "Bốc lại trước khi công bố" |
| `QUALIFIER_COUNT_MISMATCH` | 409 | Số suất vòng loại không khớp nhánh vòng loại |
| `QUALIFYING_NOT_FINISHED` | 409 | Còn section chưa xong. Có `pendingSections` |
| `QUALIFYING_DRAW_MISSING` | 409 | Chưa có nhánh vòng loại |
| `NO_QUALIFIER_SLOTS` | 409 | MAIN không còn ô suất vòng loại |
| `GROUP_DRAW_NOT_PUBLISHED` | 409 | Sinh MAIN khi nhánh bảng chưa công bố |
| `GROUPS_NOT_FINISHED` | 409 | Còn bảng chưa đấu xong. Có `pendingGroups` |
| `MANUAL_TIEBREAK_PENDING` | 409 | Còn bảng hòa cần nhập hạng tay. Có `groups` |
| `GROUPS_ALREADY_PLACED` | 409 | Bảng đã xếp vào MAIN, không đổi được |
| `GROUP_VERSION_CONFLICT` | 409 | `Group.version` lệch khi nhập hạng tay. Có `currentVersion` |
| `WITHDRAWAL_POLICY_MISSING` | 409 | Bảng chưa chọn cách xử lý khi rút lui |
| `ROUND_STARTED` | 409 | Vòng có trận LIVE hoặc OFFICIAL không phải BYE |
| `POSITION_ALREADY_PLAYED` | 409 | Thay VĐV ở ô đã đấu |
| `POSITION_ENTRY_WITHDRAWN` | 409 | VĐV tại ô đã rút (đi qua walkover) |
| `ENTRY_ALREADY_WITHDRAWN` | 409 | Rút lần nữa khi không còn việc để xử lý |
| `ENTRY_IN_PUBLISHED_DRAW` | 409 | Đổi stage VĐV đang nằm trong nhánh đã công bố |
| `ADVANCEMENT_CONFLICT` | 409 | Trận kế đã có VĐV khác ở vị trí đó |
| `MATCH_IN_PROGRESS` | 409 | Rút VĐV khi trận của họ đang LIVE |
| `DEPENDENT_DRAW_EXISTS` | 409 | Bỏ công bố bảng khi đã có MAIN từ bảng đó |
| `KIND_NOT_ALLOWED` | 422 | Thao tác không áp dụng cho loại nhánh này |
| `CROSS_SECTION_SWAP` | 422 | Đổi chỗ khác nhánh con |
| `BYE_VS_BYE`, `QUALIFIER_VS_BYE` | 422 | Đổi chỗ làm BYE gặp BYE, hoặc suất vòng loại gặp BYE |
| `ENTRY_NOT_ELIGIBLE` | 422 | VĐV thay thế không đủ điều kiện (chưa CONFIRMED, khác nội dung, đã có trong nhánh) |
| `ENTRY_NOT_IN_DRAW` | 422 | Rút VĐV không nằm trong nhánh |
| `INVALID_MANUAL_RANKS` | 422 | Hạng tay không phủ đúng khối hòa |
| `NOT_ENOUGH_ENTRIES`, `INVALID_SEED`, `INVALID_SIZE`… | 422 | Mã từ engine, giữ nguyên khi trả về |

## Chưa làm

| Hạng mục | Phase | Ghi chú |
|---|---|---|
| Lịch thi đấu, sửa và mở lại tỷ số | Đã làm (phase 07, đợt 2) | Lịch: [scheduling](./scheduling.md). Sửa và mở lại: [match-results](./match-results.md#mở-lại-trận) |
| Lucky loser khi người thắng vòng loại đã rút | Đã chọn 2026-11-27: không bổ sung | Giữ walkover ở MAIN |
| Quy tắc đặt hạt giống | G1a đã duyệt trong phiên 2026-11-27 | Hạt 1/2 hai đầu; 3/4 bốc vào `S/2` hoặc `S/2+1`; các tầng sau vào biên phân đoạn; mỗi nhánh vòng loại nhận một seed tốt nhất (`seed-positions.ts`) |
| Chia bảng, phá hòa, rút lui giữa bảng | G1b đã duyệt trong phiên 2026-11-27 | Giữ pot, điểm/tiêu chí hiện tại, hạng tay tuyệt đối; KEEP cho rút giữa bảng, không tránh CLB; đối chiếu rule cũ khi rollout, không tự ghi đè |
| Gợi ý hạt giống từ bảng xếp hạng | 09 | `suggest-seeds` trả rỗng |
| Revalidate sau xếp suất vòng loại và nhất/nhì bảng vào nhánh MAIN đã công bố | Đã làm (2026-11-14) | Hai route gửi `draw.placeQualifiers` khi nhánh đã công bố. Xem [cache-revalidation](./cache-revalidation.md#mutation-và-tag) |
