# Review lần 2 phase 05: kiểm lại các bản sửa sau review đầu

Ngày: 2026-11-12. Chỉ đọc, không sửa code. Phạm vi: các thay đổi chưa commit trên `main`, đối chiếu với `code-reviewer-261112-1436-phase-05-review.md` và 2 báo cáo sửa của fullstack-developer. Không chạy lại bộ test hay typecheck; kết quả test lấy từ báo cáo sửa. Riêng finding N1 có chạy script thử bằng `fflate` 0.8.3 đang cài trong `apps/worker`.

## Tóm tắt

Gần như mọi finding đã được sửa, và phần lớn có test chứng minh. Thứ tự khóa (SubEvent tăng dần rồi tới Player tăng dần) giống nhau ở cả 3 nơi ghi, không tìm ra deadlock. Phần ẩn PII đã đủ. Phát hiện 1 lỗi **High** mới: bước ghi lại zip trong bộ đọc xlsx stream làm lộ lỗ hổng zip bomb kiểu central directory chồng lấn, đã chạy thử và tái hiện được. Có thêm 2 lỗi **Medium** trong state machine của import.

**Điểm: 8/10.** Merge sau khi sửa N1 (khoảng 10 dòng). N2 và N3 sửa trước pilot cũng được.

## Bảng đối chiếu finding

| # | Kết quả | Bằng chứng trong code | Test |
|---|---|---|---|
| H1 khóa trước rồi mới kiểm khi commit import | Đã sửa | `apps/worker/src/import/commit-batch.ts:44-46` (advisory theo giải, `lockSubEventsInOrder`, `lockPlayersForShare`, nạp lại index). Các bước kiểm trong `commit-row.ts:94-107` chạy sau khi đã giữ khóa | `imports-worker.e2e-spec.ts:159` (chờ người đang ghi), `:181` (trùng hạt giống thành dòng ERROR) |
| H2 nút "Thử lại" | Đã sửa | `commit-batch.ts:58,62-69` cập nhật `committedRows` trong từng tx lô; UI `import-detail-page.tsx:46-47` | `imports-worker.e2e-spec.ts:223` |
| H3 gộp VĐV và ghi entry chạy song song | Đã sửa | `player-merge.service.ts:26-32` (khóa sub-event theo kế hoạch, khóa Player `FOR UPDATE`, đọc lại, lệch thì `MERGE_RETRY`); `entry-eligibility.service.ts:43-48` (`FOR SHARE`, `PLAYER_MERGED`) | `player-merge-concurrency.e2e-spec.ts:36` (12 vòng). Chưa có test cho trường hợp merge đụng commit import |
| M1 ánh xạ P2002 | Đã sửa | `entry-errors.ts:13-31` map theo tên index, P2002 khác ném lại | `entry-errors.test.ts` |
| M2 ô trống giữ giá trị cũ, audit | Đã sửa | `commit-entry-write.ts:50-64,94,101`; audit ghi trong tx lô (`commit-batch.ts:57`) | `imports-worker.e2e-spec.ts:139,151` |
| M3 trùng tên khác năm sinh ở lô khác | Đã sửa | `player-lookup.ts:18,33`, `commit-batch.ts:33-37` | `imports-worker.e2e-spec.ts:193` |
| M4 job FAILED bị kẹt | Đã sửa, kéo theo N3 | `imports.service.ts:104-107,120-136` | `imports.e2e-spec.ts:184,203` |
| M5 dropdown dài hơn 255 ký tự | Đã sửa | sheet ẩn `import-template.service.ts:85` | `imports.e2e-spec.ts:160` |
| M6 bộ nhớ khi đọc xlsx | Đã sửa, kéo theo N1 | `xlsx-row-reader.ts:41-48,52-58` | test file độc và test 1000 dòng (theo báo cáo sửa) |
| L1 `decide` khóa job | Đã sửa | `import-rows.service.ts:62-63`. UPDATE dạng CAS trong `commit()` sẽ chờ khóa hàng rồi đánh giá lại `WHERE status` | `imports.e2e-spec.ts:229` |
| L2 kiểm lại dòng NEEDS_CONFIRM sau khi chọn | Đã sửa | `import-rows.service.ts:78-82` | `imports.e2e-spec.ts:212` |
| L3 1 VĐV ở 2 cặp trong cùng file | Đã sửa | row-evaluator | `imports-worker.e2e-spec.ts:201` |
| L4 tham số gắn cứng, cleanup đua với PUT | Đã sửa | setting `uploadTtlHours`, `entry.maxBulkItems`; xóa file trước rồi mới đánh dấu (`import-file-cleanup-processor.ts:36-39`); `receiveFile` kiểm `fileDeletedAt` sau khi stream xong (`imports.service.ts:77-81`) | `imports-worker.e2e-spec.ts:303,315`, `entries.e2e-spec.ts:152` |
| L5 `IMPORT_RETENTION_DAYS` | Đã sửa | grep không còn chỗ nào dùng | n/a |
| L6 PII (đã chốt) | Đã sửa | `player-views.ts:12,23,43`. Các chỗ đã kiểm: list, detail, create/update (đều trả qua `get`/`toPlayerDetail` có role), lookup (`PLAYER_LOOKUP_SELECT` không có PII), export (`entries-export.service.ts:12`), sheet VĐV trong file mẫu (`import-template.service.ts:119`), pairs/entries (không select phone, email, birthDate), sort/search (`players.service.ts:14,29-31`, không có birthDate/phone/email). RESULTS_OPERATOR không có quyền `audit-logs`, `imports`, `entries` | `players.e2e-spec.ts:215` |
| L7 hạt giống của entry đã rút | Đã sửa | `entries.service.ts:91-95,103`; bulk withdraw cũng xóa seed (`entry-bulk-actions.service.ts:45`) | `entries.e2e-spec.ts:125,142` |
| L8 thông báo tuổi | Đã sửa | theo báo cáo sửa | `entry-eligibility.test.ts` |
| L9 phân trang cursor khi export | Đã sửa | | `imports.e2e-spec.ts:236` (1.100 entry) |
| L10 mã VĐV đã gộp | Đã sửa | `player-lookup.ts:38-42`, `commit-row.ts:30` | `imports-worker.e2e-spec.ts:214` |
| vitest pool `threads` | Đã áp dụng | `apps/api/vitest.config.ts` | n/a |

## Thứ tự khóa và deadlock

- Cả 3 nơi ghi đều theo cùng một thứ tự. Entries API: `lockSubEvent(S)` rồi `lockPlayersForShare` (`entries.service.ts:27,32`, `:79,105`). Commit import: advisory theo giải, sub-event tăng dần, rồi player tăng dần (`commit-batch.ts:44-46`). Gộp VĐV: sub-event tăng dần, rồi player `FOR UPDATE` tăng dần. Không chỗ nào khóa Player trước rồi mới khóa SubEvent. Bulk và các lệnh PATCH không khôi phục entry thì không khóa Player, và cũng không cần.
- Không tìm ra vòng chờ. Một tx ghi entry đang giữ S ngoài kế hoạch gộp và chờ Player sẽ chạy xong trước. Sau đó lần đọc lại `affectedSubEventIds` phát hiện S và trả `MERGE_RETRY`. `FOR SHARE` giữa các tx ghi với nhau tương thích. Advisory lock chỉ dùng giữa các lần import.
- Race còn sót (Low): `lockAndLoadPlayers` chỉ khóa những VĐV có trong index tạm. Nếu một VĐV trùng tên được tạo ngay trong khoảng giữa 2 lần nạp index (`commit-batch.ts:34-37`), rồi bị gộp ngay sau đó, import có thể liên kết vào hồ sơ vừa gộp. Khả năng xảy ra gần như bằng 0, không cần chặn merge vì chuyện này.

## Lỗi mới do các bản sửa

### N1 (High). Zip bomb lọt qua bằng central directory chồng lấn ở `worksheetsLast`
- `apps/worker/src/import/xlsx-zip-guard.ts:28-54` giải nén theo **local header** (stream) và chỉ đối chiếu *số lượng* entry với central directory. Trong khi đó `xlsx-row-reader.ts:42` (`unzipSync`) giải nén theo **central directory**. Một file có N entry trong CD cùng trỏ về offset của một local file lớn sẽ qua được guard, nhưng `unzipSync` lại giải nén file lớn đó N lần.
- Đã tái hiện bằng `fflate` 0.8.3: file **12 KB** với 20 entry. Guard đếm được 20 entry, giải nén 10 MB nên cho qua. `unzipSync` thì ra **200 MB**. Đẩy N lên 1000 và mỗi entry khoảng 49 MB (vẫn dưới trần 50 MB), worker sẽ cần cỡ 49 GB bộ nhớ ngoài và chết vì OOM. Worker media chạy chung process nên chết theo. Job validate có 2 lần thử nên dính 2 lần.
- Người tải file lên là ADMIN, nhưng file thường do CLB gửi tới, nên vẫn là đầu vào không tin cậy. (Trước khi sửa, exceljs/JSZip có lẽ cũng đọc theo CD; chưa kiểm chứng.)
- Cách sửa (đã chạy thử, chặn được): `unzipSync(bytes, { filter: (f) => { total += f.originalSize; if (total > maxUnzippedBytes) throw new ImportFailure('File giải nén quá lớn'); return true; } })`. fflate cấp bộ đệm theo `originalSize` khai trong CD. Đã thử khai thấp thì dữ liệu bị cắt, không phình. Vì vậy cộng dồn `originalSize` là chặn được. Truyền `maxUnzippedBytes` vào `readEntryRows`. Nên thêm 1 test e2e với file CD chồng lấn.

### N2 (Medium). Worker chỉ dựa vào `status`, không đối chiếu `attemptNo`, nên 2 lần chạy commit trùng nhau có thể ghi đè dòng
- `import-commit-processor.ts:52` chỉ kiểm `status === 'COMMITTING'`. Payload chỉ có `importJobId`. `attemptNo` chỉ nằm trong `jobId` của BullMQ, worker không đọc.
- `imports.service.ts:142`: `enqueueOrRevert` trả status về **không điều kiện** (`where: { id }`). Kịch bản: `queue.add` báo lỗi timeout nhưng thực ra đã ghi vào Redis. Status bị trả về VALIDATED/FAILED trong khi job vẫn nằm trong hàng đợi. Người dùng bấm commit lần nữa thì có 2 job cùng thấy COMMITTING. Khi `IMPORT_WORKER_CONCURRENCY > 1`, hoặc khi job bị coi là stalled vì event loop bận, 2 lần chạy diễn ra song song.
- Hậu quả: danh sách dòng của lô được đọc **ngoài** tx (`import-commit-processor.ts:81`). Lần chạy thứ 2 chờ advisory lock rồi xử lý lại các dòng lần 1 vừa COMMITTED, với `createdByKey` cũ. Lúc khớp lại, VĐV mới do lần 1 tạo bị coi là trùng tên, dòng COMMITTED bị ghi đè thành ERROR (`commit-batch.ts:50-55`) dù entry đã có thật. Có thể còn tạo VĐV trùng.
- Cách sửa: trong `commitBatch`, ngay sau advisory lock, đọc lại các dòng của lô kèm điều kiện status committable và bỏ dòng đã COMMITTED. Đưa `attemptNo` vào payload, worker bỏ qua job nếu `job.attemptNo` khác. Phần revert dùng `updateMany({ where: { id, status: COMMITTING|VALIDATING, attemptNo } })`.

### N3 (Medium). Kiểm tra lại thất bại nhưng vẫn commit được bản preview cũ
- `revalidate` (`imports.service.ts:127-130`) không xóa `fileSha256` và các dòng cũ. Nếu lần validate mới thất bại vì `ImportFailure` (vượt `maxRows` sau khi đổi setting, header sai, file đã đổi...), `validateImport` bỏ ra trước tx (`import-validate-processor.ts:77-80`). Các dòng và hash của lần validate trước vẫn còn nguyên.
- Kết quả: job ở trạng thái FAILED, `commit()` vẫn cho chạy lại (`imports.service.ts:104`) và UI vẫn hiện nút "Thử lại" (`import-detail-page.tsx:47`, vì `totalRows !== null`). Bấm vào là nhập bản preview cũ, bỏ qua kết quả của lần kiểm tra mới nhất. Phần kiểm hợp lệ, trùng và sức chứa có chạy lại lúc commit, nhưng `maxRows` và những gì người vận hành vừa sửa thì không.
- Cách sửa: trong CAS của `revalidate`, đặt `fileSha256: null` (có thể xóa luôn các dòng). Như vậy chỉ commit lại được sau một lần validate thành công.

## Bộ đọc xlsx stream: các mục được yêu cầu kiểm

- **Thứ tự worksheet để cuối:** đúng. Những entry không khớp `xl/worksheets/sheetN.xml` (gồm `sharedStrings`, `workbook.xml`, `_rels`) được đặt trước, nên `sharedStrings: 'cache'` có dữ liệu trước khi gặp sheet.
- **"Sheet đầu":** là `sheet1.xml` theo số trong tên part, không theo thứ tự tab trong `workbook.xml`. File mẫu đặt sheet đăng ký đầu tiên (`import-template.service.ts:62`), nên đúng với file mẫu. Nếu người dùng kéo đổi thứ tự tab trong Excel, kiểm tiêu đề sẽ báo lỗi rõ ràng chứ không âm thầm đọc sai dữ liệu. Chưa thử với file lưu từ Excel thật (rủi ro đã ghi trong báo cáo sửa).
- **Xóa file tạm:** `finally rm(dir, { recursive, force })` chạy trên mọi đường thoát bình thường. Process chết vì OOM hoặc kill thì `kamito-import-*` nằm lại `/tmp` (Low: thêm bước dọn khi khởi động). Ném lỗi giữa `for await` (header sai, quá `maxRows`) có thể để stream đọc file chưa đóng. Trên Linux không sao; trên Windows `rm` có thể gặp EBUSY, và lỗi đó sẽ đè lên `ImportFailure`. Chưa kiểm chứng.
- **An toàn đường dẫn:** `mkdtemp` sinh tên ngẫu nhiên, tên file cố định, không có dữ liệu người dùng trong đường dẫn. Ổn.
- **Bộ nhớ:** heap đo được 70 MB là hợp lý. Nhưng `unzipSync` cộng `zipSync` giữ khoảng 2–3 lần kích thước giải nén trong ArrayBuffer (bộ nhớ ngoài, không tính vào `--max-old-space-size`). Với trần 50 MB thì RSS tăng tạm cỡ 100–150 MB, chấp nhận được, miễn là sửa N1. Lời gọi đồng bộ chặn event loop dưới 1 giây, không đủ làm mất lock BullMQ.
- Phần vá `Object.defineProperty(reader, 'model')` đụng vào nội bộ exceljs. Chấp nhận được vì exceljs đã ghim đúng `4.4.0` trong `apps/worker/package.json:18`.

## State machine của import (revalidate, commit từ FAILED)

- Commit 2 lần đồng thời từ API: không được. CAS `updateMany where status = job.status` (`imports.service.ts:109-113`) chỉ cho 1 request thắng. Cách duy nhất để có 2 lần chạy là N2.
- Revalidate xóa dòng trong lúc commit đang chờ hoặc đang chạy: không được với luồng bình thường. Commit chuyển sang COMMITTING trước khi đưa vào hàng đợi, còn revalidate chỉ nhận FAILED/VALIDATED. Kiểm dòng COMMITTED nằm ngoài tx, nhưng lúc đó job đang FAILED/VALIDATED nên không có worker nào đang ghi. Ngoại lệ vẫn là N2 (status bị trả về không điều kiện trong lúc job còn trong hàng đợi hoặc đang chạy).
- `decide` và commit được tuần tự hóa bằng khóa hàng `ImportJob` (L1).

## Đề xuất (theo thứ tự)
1. N1: cộng dồn `originalSize` trong `filter` của `unzipSync`, thêm test file CD chồng lấn.
2. N2: đọc lại dòng trong tx lô sau advisory lock; đưa `attemptNo` vào payload; revert có điều kiện.
3. N3: `revalidate` đặt `fileSha256 = null`.
4. Nên có: test commit import đụng merge; thử với file lưu từ Excel thật trước pilot.

## Câu hỏi còn mở
1. Import có khôi phục entry WITHDRAWN thành CONFIRMED không? Hiện code có làm, kèm audit (`commit-entry-write.ts:56`), và kèm kiểm trùng/sức chứa (`commit-row.ts:96-101`). Cần chủ repo xác nhận.
2. P2002 do trùng slug khi tạo VĐV đồng thời vẫn làm hỏng cả lô. Hiện đã thử lại được từ FAILED. Có cần savepoint theo từng dòng không?

**Status:** DONE_WITH_CONCERNS
**Summary:** 19/19 finding cũ đã sửa, đa số có test; thứ tự khóa nhất quán, không có deadlock; PII đã ẩn đủ. Điểm 8/10, merge sau khi sửa N1.
**Concerns/Blockers:** N1 High (zip bomb qua central directory chồng lấn, đã tái hiện 12 KB thành 200 MB); N2, N3 Medium trong state machine import. Chưa chạy lại test; chưa thử file Excel thật.
