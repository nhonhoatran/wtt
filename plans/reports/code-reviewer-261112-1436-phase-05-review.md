# Code review phase 05: VĐV, cặp, đăng ký, import/export Excel, gộp VĐV

Ngày: 2026-11-12. Phạm vi: toàn bộ thay đổi chưa commit trên `main` (API, worker, db domain, shared, admin UI, migrations). Không sửa code. Đã đọc code, chưa chạy lại typecheck/test; tester báo pass (`tester-261112-1436-phase-05-test-run.md`).

## Tóm tắt

Code gọn, file nào cũng dưới 200 dòng, theo đúng hợp đồng đã chốt. Mấy chỗ làm tốt: kiểm zip bomb bằng số byte giải nén thật cộng với đối chiếu số entry trong central directory, kiểm SHA-256 lúc commit, payload job chỉ có id, mọi queue có `QUEUE_PREFIX`, `@RequireStepUp` gắn trên route gộp, override chỉ cho ADMIN ở cả API lẫn import, audit đi qua `maskPii`, header `Content-Disposition` đã làm sạch, unique index chặn trùng hạt giống.

Có 3 lỗi High: (1) commit import kiểm trùng và kiểm sức chứa **trước** khi khóa nội dung, (2) nút "Thử lại" trên UI không bao giờ hiện, (3) gộp VĐV không chặn được việc ghi entry chạy song song.

**Điểm: 7/10.** Merge được sau khi sửa H1–H3, M1, M2 và M4.

---

## Critical

Không có.

## High

### H1. Commit import kiểm trùng, kiểm sức chứa, kiểm hạt giống trước khi giữ khóa `lockSubEvent`
- `apps/worker/src/import/commit-row.ts:126-138` đọc `existingEntry`, `playersAlreadyEntered`, `confirmedEntryCount` và chỗ giữ hạt giống. Tới `commit-row.ts:140-143` mới gọi `lockSubEvent`.
- API thì khóa trước rồi mới kiểm (`apps/api/src/modules/entries/entries.service.ts:27`). Advisory lock theo event (`import-commit-processor.ts:88`) chỉ tuần tự hóa các lần import với nhau, không chặn được API.
- Kịch bản: người vận hành thêm tay VĐV X vào nội dung S. Ngay lúc đó dòng đầu tiên của S trong lô import cũng có X (cặp khác). Import kiểm `playersAlreadyEntered` khi entry của API chưa commit, nên kết quả rỗng. API commit xong, import mới lấy khóa rồi ghi. Kết quả: X nằm trong 2 entry của cùng nội dung, hoặc vượt `maxEntries`. Nếu đụng hạt giống thì dính P2002, rollback cả lô 200 dòng, job FAILED với lỗi chung chung (xem M4).
- Cách sửa: ngay đầu mỗi transaction lô, lấy tập `subEventId` của các dòng, sắp xếp rồi `lockSubEvent` lần lượt, sau đó mới kiểm. Sắp xếp để tránh deadlock với gộp VĐV sau khi sửa H3.

### H2. Nút "Thử lại" sau khi commit đứt giữa chừng không bao giờ hiện
- `apps/admin/src/resources/imports/import-detail-page.tsx:45`: `retry = status === 'FAILED' && job.committedRows > 0`.
- `committedRows` chỉ được cập nhật trong `finish()` (`apps/worker/src/processors/import-commit-processor.ts:137-147`) và `refreshCounters` (`import-rows.service.ts`, chỉ chạy lúc VALIDATED). Vòng lặp lô (`import-commit-processor.ts:80-107`) và `failImportJob` (`apps/worker/src/import/import-job-state.ts:7-13`) không đụng tới nó. Lúc validate đặt `committedRows = 0`.
- Kịch bản: commit được 3 lô rồi worker bị ngắt hoặc DB chập chờn. Job thành FAILED, `committedRows` vẫn là 0, UI ẩn nút "Thử lại". API vẫn cho thử lại vì nó đếm dòng thật, nhưng người dùng không có cách bấm. Tiêu chí thành công "Thử lại chỉ chạy các dòng chưa COMMITTED" vì vậy gãy ở UI.
- Cách sửa: UI dùng `job.countsByStatus.COMMITTED` (`get()` đã trả về). Thêm nữa, mỗi lô cập nhật `committedRows` trong cùng transaction lô.

### H3. Gộp VĐV không tuần tự hóa với các lần ghi entry (API và import)
- `apps/api/src/modules/players/player-merge.service.ts:23-45` chỉ lấy advisory lock theo id 2 VĐV. Phía ghi entry đọc player mà không khóa (`entry-eligibility.service.ts:38-52`, `commit-row.ts:113`, `player-lookup.ts:26-33`), và không ai lấy khóa nội dung của các nội dung bị ảnh hưởng.
- Kịch bản a: đang gộp B vào A thì có người thêm B vào nội dung S. `loadPlayers` thấy `mergedIntoId` còn null. `moveSingles` đã xóa competitor của B, nhưng `findOrCreateCompetitor` lại upsert ra competitor mới cho B. Kết quả: entry gắn vào hồ sơ đã gộp và đã bị ẩn.
- Kịch bản b: `analyseMerge` thấy A chưa có trong S. Một tx khác thêm cặp (A, Y) vào S và commit. Merge chuyển cặp (B, X) của S thành (A, X). Kết quả: A nằm trong 2 cặp của cùng nội dung, vượt qua cả quy tắc 1 VĐV 1 entry. Với nội dung đơn thì merge dính P2002 trên `(subEventId, competitorId)` và trả 500 không có thông báo.
- Cách sửa: trong tx gộp, `SELECT ... FOR UPDATE` 2 hàng `Player`, sắp theo id. Tiếp theo khóa mọi `SubEvent` có entry của A hoặc B (sắp xếp), rồi mới chạy `analyseMerge`. Phía ghi entry đọc player bằng `FOR SHARE` (hoặc `FOR UPDATE`) trong `loadPlayers` và trong commit-row, để chờ merge commit xong rồi mới thấy `mergedIntoId`.

## Medium

### M1. P2002 nào cũng bị báo thành "Hạt giống đã có"
- `apps/api/src/modules/entries/entry-errors.ts:10-14` không xem `error.meta.target`. P2002 từ upsert `Pair`/`Competitor` khi 2 nội dung cùng tạo một cặp mới (`packages/db/src/domain/competitors.ts:27-50`), hay từ `(subEventId, competitorId)`, đều ra 409 `SEED_TAKEN`. Thông báo sai, và có thể hiện đỏ ở ô hạt giống trong khi người dùng không hề nhập hạt giống.
- Cách sửa: chỉ map khi target có `seed`. Các P2002 khác trả 409 `RETRY_CONFLICT` "Dữ liệu vừa thay đổi, thử lại", hoặc tự thử lại tx 1 lần.

### M2. Import cập nhật entry có sẵn: ghi đè dữ liệu và không audit từng entry
- `apps/worker/src/import/commit-row.ts:168-174`: khi trùng entry CONFIRMED (`UPDATE_ENTRY`), ô hạt giống hay ghi chú để trống sẽ xóa luôn `seed`/`notes` đang có. `eligibilityOverrideReason` cũng bị đặt null, mất lý do override ADMIN đã nhập tay. Entry WITHDRAWN được import bật lại CONFIRMED.
- Cả phần này không có audit before/after cho từng entry. Chỉ có 1 audit tổng ở `import-commit-processor.ts:137-147`. Spec yêu cầu "Audit mọi lần sửa seed, stage, quotaType, status".
- Cách sửa: lúc update chỉ ghi các trường file có giá trị (hoặc ghi rõ quy ước "trống = giữ nguyên"), giữ nguyên `eligibilityOverrideReason` khi lần này không có issue, và ghi `entry.update` / `entry.create` kèm before/after vào `AuditLog` trong cùng tx lô (dùng `createMany` cho cả lô).

### M3. Hai VĐV mới trùng tên nằm ở 2 lô khác nhau: dòng sau báo lỗi oan
- `commit-row.ts:61-71`: dòng `CREATE_PLAYER` không tìm thấy `newPlayerKey` trong `createdByKey` thì chạy khớp lại. Index của lô sau (`player-lookup.ts:26-33`) đã có VĐV mà lô trước vừa tạo. Cùng tên nhưng khác năm sinh thì key khác, `matchPlayer` trả `NEEDS_CONFIRM`, dòng bị đánh lỗi "đã có VĐV trùng tên được thêm sau khi kiểm tra".
- Kịch bản: file có "Nguyễn Văn An 2008" ở dòng 10 và "Nguyễn Văn An 2010" ở dòng 250. Validate báo cả 2 là VALID, nhưng commit làm dòng 250 thành ERROR. Nếu 2 dòng này cùng một lô thì lại không lỗi, nên kết quả phụ thuộc vào cách chia lô.
- Cách sửa: khi khớp lại, bỏ khỏi `sameName` các id nằm trong `createdByKey.values()`, tức VĐV do chính lượt import này tạo.

### M4. Job FAILED khi chưa commit được dòng nào thì kẹt luôn
- `apps/api/src/modules/imports/imports.service.ts:98-99` chỉ cho commit lại khi FAILED và đã có dòng COMMITTED. Upload và validate lại cũng không được (chỉ chạy từ `AWAITING_UPLOAD`).
- Các đường dẫn tới tình trạng này: (a) `assertNoLockedDraw` từ chối (`import-commit-processor.ts:27-34`), sau đó ADMIN muốn commit lại với lý do override nhưng bị `NOT_COMMITTABLE`. Luồng override draw trong spec vì vậy không dùng được (hook đang ngủ tới phase 06, nhưng hợp đồng đã sai từ giờ). (b) Lô 1 lỗi tạm thời: DB chập chờn, P2002 từ slug do `uniquePlayerSlug` đọc trước ghi sau (`packages/db/src/domain/player-identity.ts:20-32`, `commit-row.ts:157`) đụng với một lần tạo VĐV qua API, hoặc P2002 hạt giống ở H1. Người dùng phải tải file lên lại từ đầu, mất hết các quyết định NEEDS_CONFIRM đã chọn.
- Cách sửa: cho commit lại từ FAILED khi job đã validate xong (`fileSha256 != null`), kể cả khi chưa có dòng COMMITTED. Lỗi file (SHA lệch, file đã xóa) vẫn là lỗi cuối. Trong commit-row, bắt P2002 theo từng dòng bằng savepoint, hoặc thử lại cả lô 1 lần.

### M5. Danh sách thả xuống mã nội dung trong file mẫu bị cắt ở 255 ký tự, Excel chặn luôn mã hợp lệ
- `apps/api/src/modules/imports/import-template.service.ts:21,26,75`: `values.join(',').slice(0, 253)` với `showErrorMessage: true`. Giải có khoảng 30 nội dung, mã 8–9 ký tự, là đã vượt 255 ký tự. Các mã cuối danh sách biến mất (có thể còn bị cắt giữa chừng một mã), và Excel từ chối khi người dùng gõ đúng mã đó.
- Cách sửa: ghi danh sách mã vào một sheet ẩn và tham chiếu vùng ô (`'Mã'!$A$2:$A$N`). Hoặc khi vượt 255 ký tự thì bỏ validation cho cột đó.

### M6. Bộ nhớ worker khi đọc xlsx bằng DOM đầy đủ (chưa kiểm chứng)
- `apps/worker/src/import/xlsx-row-reader.ts:42` dùng `workbook.xlsx.load` (không stream) cho tới 50 MB XML giải nén, trong heap 384 MB (`.env.example`), mà process này còn chạy chung worker media (sharp). Mô hình ô của exceljs thường tốn gấp nhiều lần kích thước XML. Nếu OOM thì cả worker media chết theo, job validate thử lại và OOM tiếp.
- Cách sửa: đo thật với file 50 MB giải nén. Nếu vượt heap thì chuyển sang `ExcelJS.stream.xlsx.WorkbookReader` và dừng ngay khi vượt `maxRows`, hoặc hạ `IMPORT_MAX_UNZIPPED_BYTES` mặc định cho khớp heap.

## Low

- **L1** `apps/api/src/modules/imports/import-rows.service.ts:52-55`: `decide` kiểm `VALIDATED` ở ngoài tx, không khóa `ImportJob`. Commit có thể đã chuyển sang COMMITTING trong lúc quyết định vẫn được ghi. Sửa: trong tx dùng `SELECT status FROM "ImportJob" ... FOR UPDATE`, và `commit()` cũng khóa hàng đó.
- **L2** `apps/worker/src/import/row-evaluator.ts:61`: dòng NEEDS_CONFIRM không qua kiểm hợp lệ, trùng lặp, hạt giống. Sau khi chọn thì `decide` đặt luôn VALID (`import-rows.service.ts:73`). Số "Hợp lệ" trên preview vì vậy cao hơn thực tế. Commit vẫn chặn đúng.
- **L3** `row-evaluator.ts:106-111`: validate không phát hiện một VĐV nằm trong 2 cặp khác nhau của cùng nội dung ngay trong file. Chỉ so với DB. Commit có chặn.
- **L4** Tham số vận hành đang gắn cứng: hạn tải file bị bỏ dở 1 ngày (`apps/worker/src/processors/import-file-cleanup-processor.ts:5,23-24`) và `MAX_BULK_ENTRIES = 200` (`apps/api/src/modules/entries/entry-dtos.ts:4`). Nên đưa lên `/settings`. Ngoài ra, cleanup xóa file trong khi PUT vẫn đang chạy thì file ghi xong sau đó sẽ mồ côi, vì `fileDeletedAt` đã được đặt.
- **L5** `apps/api/src/common/config/env-schema.ts:37`: `IMPORT_RETENTION_DAYS` vẫn bắt buộc dù hợp đồng ghi là không còn dùng. Bỏ biến này khỏi env là API không khởi động được.
- **L6** Phạm vi PII: RESULTS_OPERATOR có `players.read`/`list`, nên xem được `phone`/`email` ở trang chi tiết (`apps/api/src/modules/players/player-views.ts:39-40`) và `birthDate` ở danh sách (`player-views.ts:19`). Cần chủ repo xác nhận đây có phải chủ ý không. Nếu không thì chỉ trả cho ADMIN (hoặc thêm action riêng).
- **L7** `apps/api/src/modules/entries/entries.service.ts:91`: vẫn sửa được hạt giống của entry WITHDRAWN, entry đã rút vẫn chiếm số hạt giống. Nên chặn hoặc đặt null.
- **L8** `packages/shared/src/entry-eligibility.ts:70-71`: với `EVENT_START_DATE`, VĐV chỉ có năm sinh thì thực tế đang tính theo năm sinh, nhưng thông báo vẫn ghi "tính theo ngày khai mạc".
- **L9** `apps/api/src/modules/exports/entries-export.service.ts:41-43`: phân trang bằng cursor theo `id` nhưng `orderBy` lại theo trường của quan hệ `subEvent`. Chưa kiểm chứng Prisma có ra đúng thứ tự, đủ dòng khi vượt 1000 entry hay không; test hiện tại chỉ có vài dòng. Nên lặp theo từng nội dung, trong mỗi nội dung sắp theo `id`.
- **L10** `apps/worker/src/import/player-lookup.ts:26-33`: mã của VĐV đã gộp hiện báo "Không có VĐV mã X". Nên báo "X đã gộp vào Y" để người vận hành sửa file nhanh.
- Xuất xlsx: exceljs ghi chuỗi bắt đầu bằng `= + - @` thành ô chuỗi, không phải công thức, nên rủi ro formula injection thấp. Không bắt buộc sửa.

## Hiệu năng / index
- Tìm theo `normalizedName contains` (players, pairs, entries) là `LIKE '%x%'`, không dùng được btree. Với vài nghìn VĐV thì ổn. Khi lớn hơn nên cân nhắc index `pg_trgm`.
- Không thấy N+1 nào đáng kể. `countEntriesByPlayer` chỉ 1 query cho mỗi trang. Index cho `Entry.competitorId`, `Pair.playerBId`, `ImportRow(importJobId,status)` đều đủ.

## Đã kiểm, không có vấn đề
Phân quyền: các route mới đều có `@RequirePermission`, gộp VĐV dùng `players.manage` (chỉ ADMIN) cộng step-up, import kiểm người tạo hoặc ADMIN. Upload: có trần setting kẹp bởi env, Content-Type, Content-Length và đếm byte thật, khóa file do server sinh trong `private/imports/`. Kiểm tiêu đề cột, trần số dòng. Kiểm hợp lệ: giới tính, MIXED, tuổi theo 2 cách, VĐV chỉ có năm sinh. Matcher không bao giờ sửa danh tính VĐV. Chặn xóa nội dung đã có đăng ký. Bảng admin phân trang và lọc ở server, polling dừng khi job không còn bận. Mọi file dưới 200 dòng.

## Câu hỏi còn mở
1. RESULTS_OPERATOR có được xem phone/email/ngày sinh của VĐV không? (L6)
2. Khi import trùng entry có sẵn, ô trống nghĩa là "xóa giá trị" hay "giữ nguyên"? (M2)

**Status:** DONE_WITH_CONCERNS
**Summary:** Review xong phase 05. Không có Critical. Có 3 High (thứ tự khóa khi commit import, UI ẩn nút "Thử lại", race khi gộp VĐV) và 6 Medium. Điểm 7/10, merge được sau khi sửa H1–H3, M1, M2, M4.
**Concerns/Blockers:** M6 (bộ nhớ worker) và L9 (cursor export) chưa kiểm chứng bằng chạy thật.
