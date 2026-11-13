# Code review — phase 06 (draws, seeding, groups, bracket) — chưa commit

Ngày: 2026-11-13. Phạm vi: `git status` trên `main` (engine mới, schema/migration draws + groups, `draw-locks.ts`, `entry-guards.ts`, module API `draws/groups/matches`, filter lỗi, merge preview, UI event-hub draw-*). Chỉ review, không sửa code.

## Đã kiểm chứng
- `pnpm --filter @kamito/competition-engine test` → 18 file, 178 test pass.
- `pnpm --filter @kamito/shared test` → 83 pass.
- `tsc --noEmit` cho competition-engine, api, admin → sạch.
- E2E (`draws`, `draw-post-publish`, `group-standings-concurrency`, `draw-locks`) **chưa chạy** (cần DB) — không kết luận về chúng.
- Migration 2 file chỉ thêm bảng / cột nullable / FK, không DROP → tương thích ngược.
- Raw SQL đều là tagged template của Prisma (tham số hoá), không ghép chuỗi.
- `competition-engine/dist` đã bị `.gitignore` (`dist/`).
- Không có file mã nguồn > 200 dòng (lớn nhất là test 220 dòng).

## Đánh giá chung
Thiết kế chắc: engine thuần + RNG có hạt, dryRun chạy đúng code thật rồi rollback, thứ tự lock SubEvent → Draw → Group nhất quán (mọi đường ghi đều vào qua `lockSubEvent`), matchNo cấp dưới row lock, compareRatio xử lý mẫu số 0. Lỗ hổng chính nằm ở **vòng đời của entry giữa các draw**: có vài đường làm entry thành `WITHDRAWN` trong khi vẫn đứng trong nhánh mà không có walkover, và khi đó API khoá luôn đường gỡ (`ENTRY_ALREADY_WITHDRAWN`, `POSITION_ENTRY_WITHDRAWN`). Kiểu này test đơn vị pass hết nhưng ra giải thật sẽ kẹt.

Điểm: **7/10**

## Critical
Không có.

## High

### H1. Rút VĐV ở vòng loại sau khi đã thắng → kẹt trong nhánh chính, không có walkover
- `apps/api/src/modules/draws/knockout-walkover.ts:46`, `draw-post-publish.service.ts:78,84`, `draw-edit.service.ts:74-78`
- Tình huống: Q-winner X thắng chung kết section 1 (OFFICIAL). Admin rút X ở draw QUALIFYING → `withdrawFromKnockout` không còn trận chưa OFFICIAL → impacts `[]` → entry `WITHDRAWN`. Sau đó `placeQualifiers` xếp X vào MAIN (không kiểm tra WITHDRAWN, khác với nhánh group có `QUALIFIER_WITHDRAWN`). Lúc này rút X ở MAIN → 409 `ENTRY_ALREADY_WITHDRAWN`; thay X → 409 `POSITION_ENTRY_WITHDRAWN`. Trận R1 của X ở MAIN không bao giờ thành walkover, đối thủ kẹt luôn.
- Trường hợp X đã nằm trong MAIN trước khi rút ở QUALIFYING cũng kẹt y vậy (rút ở QUALIFYING là no-op cho MAIN).
- Cách sửa: (a) `placeQualifiers` từ chối winner WITHDRAWN (`QUALIFIER_WITHDRAWN` + entryIds, giống group); (b) withdraw ở QUALIFYING mà entry đã có vị trí trong MAIN → báo `ENTRY_IN_MAIN_DRAW` hoặc xử lý cascade luôn sang MAIN; (c) thay vì chặn hẳn bằng `ENTRY_ALREADY_WITHDRAWN`, cho phép withdraw "xử lý phần còn lại" khi entry WITHDRAWN mà còn trận chưa xong trong draw này.

### H2. Publish bản nháp có entry đã rút / thiếu entry mới, không cảnh báo gì
- `apps/api/src/modules/draws/draw-publish.service.ts:17-30`; `entries.service.ts` `guardWithdraw` chỉ đẩy warning cho DRAFT.
- Tình huống: sinh DRAFT → ở tab Đăng ký rút entry E (chỉ có warning "cần bốc lại") → bấm Công bố → nhánh PUBLISHED có E. Từ đó E không rút được (`ENTRY_ALREADY_WITHDRAWN`), không thay được (`POSITION_ENTRY_WITHDRAWN`), giống H1. Ngược lại, entry CONFIRMED thêm vào sau khi sinh nháp cũng bị bỏ ra ngoài mà không ai biết.
- Cách sửa: trong tx publish, so tập entry của positions/group members với tập `CONFIRMED` hiện tại (đúng stage); nếu có entry WITHDRAWN → 409 `DRAW_STALE_ENTRIES {entryIds}`, nếu thiếu entry → 409 hoặc yêu cầu xác nhận. UI map mã này thành "Bốc lại trước khi công bố".

### H3. Bảng xếp hạng vẫn cho VĐV đã rút "qualified" → `placeGroupQualifiers` kẹt cứng
- `packages/competition-engine/src/group-standings-calculator.ts:121`, `apps/api/src/modules/draws/group-qualifier.service.ts` (check `QUALIFIER_WITHDRAWN`)
- Tình huống: policy `KEEP_PLAYED_RESULTS`, bảng 4 người đi 2. W thắng 2 trận rồi rút (trận còn lại thua WO) → W vẫn 4–5 điểm, hạng 2, `qualified = true`. `place-group-qualifiers` → 409 `QUALIFIER_WITHDRAWN`. Phá hoà tay chỉ áp cho khối đang hoà → không có đường nào để đẩy người hạng 3 lên. Giải đứng.
- Cách sửa: truyền `withdrawnEntryIds` vào calculator; entry đã rút vẫn giữ hạng (để hiển thị) nhưng `qualified = false` và suất được dồn cho người kế tiếp (tính `qualified` theo thứ tự trong `ordered`, bỏ qua người đã rút). Thêm unit test.

### H4. Kiểm tra `ROUND_STARTED` có thể bỏ lọt trận LIVE (filter `NOT` trên cột nullable)
- `apps/api/src/modules/draws/round-format.service.ts:33` — `NOT: { resultType: 'BYE' }`.
- Trận LIVE thường có `resultType = NULL`. Theo ngữ nghĩa SQL, `NOT ("resultType" = 'BYE')` với NULL cho ra UNKNOWN nên dòng đó bị loại → `started = 0` → vẫn đổi được thể thức của vòng đang đánh. **Chưa kiểm chứng** Prisma 7 sinh SQL ra sao (không tìm được doc xác nhận); ngay trong codebase, `draw-read.service.ts` (eventSummary) và `player-merge-preview.ts` đều viết rõ `OR: [{resultType: null}, {resultType: {not: 'BYE'}}]`, còn `isStructureLocked` dùng `IS DISTINCT FROM`. Hiện chưa có e2e nào cho `ROUND_STARTED`.
- Cách sửa: đổi sang `OR: [{ resultType: null }, { resultType: { not: 'BYE' } }]` (hoặc dùng chung `locksDrawStructure`) và thêm e2e: trận LIVE, `resultType` null → 409.

## Medium

### M1. Đổi stage / bulk setStage cho entry đang nằm trong draw đã công bố mà không có chốt chặn
- `apps/api/src/modules/entries/entries.service.ts:86`, `entry-bulk-actions.service.ts:46`
- Chỉ withdraw đi qua `guardWithdraw`. Đổi entry đang ở MAIN đã PUBLISHED sang QUALIFYING thì nhánh vẫn giữ entry đó, nhưng `replaceEntry` / chọn người thay lại lọc theo stage → dữ liệu lệch nhau. Sửa: dùng `entriesInLockedDraw` cho đổi stage (cả đơn lẫn bulk), `locked` → 409 `ENTRY_IN_PUBLISHED_DRAW`.

### M2. Sinh lại bản nháp khi không gửi `expectedVersion` thì ghi đè nháp của người khác, không báo gì
- `apps/api/src/modules/draws/draw-generation.service.ts:47`; UI `draw-wizard.tsx:87` chỉ gửi version khi lúc mở wizard đã có `existing`.
- Hai admin cùng mở wizard lúc chưa có nháp → người thứ 2 xoá luôn nháp (kèm phần swap tay) của người thứ 1. Hợp đồng API ghi "mọi thao tác ghi nhận expectedVersion". Sửa: có `previous` mà body thiếu `expectedVersion` → 409 `DRAW_VERSION_CONFLICT {currentVersion}`; wizard đã có sẵn nhánh xử lý mã này.

### M3. Phá hoà tay / recompute vẫn chạy sau khi các bảng đã xếp vào nhánh chính
- `apps/api/src/modules/groups/group-admin.service.ts:34,62`
- `GroupWithdrawalService` có chặn `GROUPS_ALREADY_PLACED`, nhưng `setManualRanks` thì không chặn, cũng không kiểm tra draw PUBLISHED. Đổi hạng sau khi đã điền MAIN → BXH bảng khác với người thật đang đứng trong nhánh chính. Sửa: dùng chung guard "MAIN không còn ô GROUP_PLACE" → 409 `GROUPS_ALREADY_PLACED`.

### M4. `randomSeed` lộ cho RESULTS_OPERATOR, và vị trí qualifier đoán trước được
- `draw-view.ts` (`toDrawSummary`), `admin-draws.controller.ts` (GET bracket/groups chỉ cần `tournaments.read`), `draw-edit.service.ts:77`.
- Phạm vi review yêu cầu randomSeed chỉ ADMIN xem được. Hơn nữa `createRng(\`${randomSeed}:qualifiers\`)` cố định ngay từ lúc sinh nháp → ai biết seed là tính trước được winner section i rơi vào ô Q nào của MAIN. Sửa: bỏ `randomSeed` khỏi response cho role không có `tournaments.update` (hoặc chỉ trả trong audit); lúc `placeQualifiers` sinh entropy mới và lưu vào audit để vẫn tái lập được.

### M5. Bỏ công bố khi còn walkover treo → swap ở nháp giữ nguyên `resultType/winnerSide` WALKOVER
- `draw-post-publish.service.ts:43` (unpublish chỉ chặn khi `isStructureLocked`; walkover treo đang SCHEDULED nên không bị khoá); `draw-derived-sync.ts` chế độ `full` chỉ reset BYE.
- Rút A (walkover treo) → bỏ công bố → swap A với B → trận ở vị trí mới vẫn mang `WALKOVER winnerSide=x` của trận cũ → công bố lại thì người thắng bị sai. Sửa: unpublish chặn khi còn trận `resultType IS NOT NULL` ngoài BYE, hoặc chế độ `full` reset mọi trận SCHEDULED không phải BYE về `resultType/winnerSide = null`.

## Low
- L1. `draw-params.service.ts:143` — `?? 1`: số suất vòng loại mặc định đang fix cứng. Repo có luật mọi giá trị nghiệp vụ phải cấu hình được, nên chuyển thành setting `draw.defaultQualifierCount` trên `/settings`. `MIN_GROUP_SIZE = 3`, `MAX_GROUPS = 26`, advance 1|2 là giới hạn cấu trúc của engine thì chấp nhận được, nhưng nên ghi lý do (setting `defaultGroupSize` có `min: 3` đang lặp lại hằng số này).
- L2. `draw-params.service.ts:114` — MAIN đi từ bảng: `seedCount` hiển thị/lưu bị chặn ở `size/2` (vd 3 bảng × 1 đi tiếp → size 4, lưu 2), trong khi engine xếp đủ 3 nhất bảng vào ô hạt giống. Chỉ lệch ở dữ liệu hiển thị/audit.
- L3. `draws-and-matches.prisma:86` — comment ghi "gapless per event" là sai: sinh lại nháp xoá trận nhưng counter không lùi → matchNo bị hở. Sửa comment, hoặc chấp nhận hở số (nên chấp nhận).
- L4. `group-allocation.ts` `byStrength` — entry cùng seed null + cùng điểm sẽ giữ thứ tự id từ DB (`orderBy id`) → ai vào pot nào là theo UUID chứ không theo RNG. Nên shuffle bằng rng trước khi sort ổn định.
- L5. `group-qualifier.service.ts` — mỗi bảng chạy `compute` 1 lần (mỗi lần 1–2 query, tối đa 26 bảng) trong tx 30s. Chấp nhận được, ghi nhận thôi.
- L6. `import-commit-processor.ts:22-29` — `assertNoLockedDraw` đọc ngoài tx (TOCTOU). Có `override` thì vẫn import vào nội dung đã công bố, mà import UPDATE_ENTRY có thể đổi stage/status của entry đang trong nhánh. Nên kiểm tra lại trong `commitBatch` sau khi lock SubEvent.
- L7. Publish chưa revalidate cache công khai (đã có comment ghi nợ). Spec ghi "→ PUBLISHED, revalidate"; cần nhớ làm khi có module public.
- L8. Comment: đa số giải thích "vì sao", viết tiếng Anh, đạt. Docstring của `knockout-walkover.ts` dài 8 dòng nhưng mô tả hợp đồng cho phase 07 nên đáng giữ. `draw-locks.ts` ghi "lock order is SubEvent, Draw, Group" là đúng.
- L9. `draw-entry-action-modal.tsx` `MIN_REASON_LENGTH = 3` lặp lại giá trị server (`draw-dtos.ts`). Nên đưa vào `@kamito/shared` để hai bên không lệch nhau.

## Đã soát, ổn
- Lock / deadlock: mọi đường ghi (generate, swap, publish/delete, post-publish, round format, group admin, group qualifier, entries, bulk, merge) đều lấy `SubEvent FOR UPDATE` trước → tuần tự hoá theo nội dung. Counter `EventMatchCounter` lấy sau cùng, không tạo vòng chờ. `lockGroups` lock theo `ORDER BY id`.
- dryRun: `DryRunAbort` ném ra bên trong `$transaction` → rollback cả audit lẫn settle walkover; không có side effect ngoài tx (AuditService ghi qua tx). Version conflict và validation vẫn trả lỗi thật.
- Walkover treo: dây chuyền settle (R1 → R2 → …) đúng trong các tình huống rút nhiều người ở hai nhánh hội tụ; `fill` gọi settle sau vòng lặp nên không ghi đè.
- BYE: không có BYE gặp BYE, không có qualifier gặp BYE (lúc sinh và lúc swap), nhì bảng nằm nửa đối diện nhất bảng, và số ô mỗi nửa nhánh khớp chính xác.
- Tiebreak: `compareRatio` không chia, mẫu số 0 xử lý đúng; trận bị void / BYE bị loại khỏi BXH và khỏi điều kiện `complete`. `manualRank` chỉ giữ khi khối hoà còn y nguyên.
- RBAC: ghi chỉ ADMIN (`create/update/publish/delete`), RESULTS_OPERATOR chỉ `list/read`. Phase này chưa có endpoint công khai nên DRAFT không lộ ra ngoài.
- Đọc dữ liệu: bracket/groups dùng vài query có join (`listForDraw`), không bị N+1.
- Filter lỗi chỉ cho qua các key chi tiết nằm trong whitelist (`DETAIL_KEYS`), không lộ stack trace.
- Merge preview có đếm trận và loại trừ BYE đúng cách (xử lý NULL đúng).

## Việc nên làm (theo thứ tự)
1. H1 + H2 + H3: khép vòng đời entry WITHDRAWN (chặn lúc publish / placeQualifiers, calculator bỏ qua người đã rút khi tính suất đi tiếp, cho xử lý phần còn lại sau khi rút). Thêm e2e cho cả 3 tình huống.
2. H4: sửa filter `NOT` cho cột nullable, thêm e2e trận LIVE.
3. M1–M3: thêm guard (đổi stage, generate bắt buộc version khi đã có nháp, phá hoà tay sau khi đã xếp vào MAIN).
4. M4–M5, sau đó các mục Low.

## Câu hỏi còn mở
- Chính sách khi qualifier đã thắng vòng loại rồi rút: tự động walkover ở MAIN, hay lấy người thua chung kết section vào thay (lucky loser)? Cần chủ giải chốt.
- `randomSeed` có cần ẩn với RESULTS_OPERATOR không, vì hợp đồng API đang để nó trong `DrawSummary` cho mọi người đọc?
- Vị trí hạt giống 3/4 (đặt ở `size/2`, `size/2+1`) vẫn đang chờ gate G1a. Engine đã làm theo đúng comment, chỉ chưa có người xác nhận quy định.
