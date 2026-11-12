# Phase 05 — sửa finding review phần import / worker

Ghi lại từ báo cáo của agent sửa (agent không ghi file). Ngày 2026-11-12.

| Finding | Thay đổi | Test |
|---|---|---|
| H1 khóa trước kiểm sau | `apps/worker/src/import/commit-batch.ts`: advisory lock theo giải → `lockSubEventsInOrder` → `lockPlayersForShare` → nạp lại VĐV; kiểm trùng/sức chứa/hạt giống trong `commit-row.ts` sau khóa; trùng hạt giống → dòng ERROR | `imports-worker.e2e-spec.ts`: chờ người ghi giữ khóa; hạt giống bị lấy sau validate |
| H2 `committedRows` | `refreshJobCounters` cập nhật bộ đếm trong mỗi tx lô; UI dùng `countsByStatus.COMMITTED` | commit bị ngắt → `committedRows` = 200 |
| M2 ô trống giữ giá trị cũ + audit | `commit-entry-write.ts` chỉ ghi trường file có giá trị (`stageGiven`, `quotaTypeGiven`); audit `entry.update`/`entry.create` cùng tx, reason `import <jobId>` | 3 test trong `imports-worker.e2e-spec.ts` |
| M3 cùng tên khác năm sinh khác lô | `loadPlayerIndex` loại VĐV do chính job tạo | test với `commitBatchSize: 1` |
| M4 job FAILED kẹt | commit từ FAILED khi đã validate; `POST /admin/imports/:id/validate` (kiểm lại, cấm nếu đã có dòng COMMITTED); 409 `FILE_DELETED`, `UPLOAD_EXPIRED`; UI nút "Thử lại" + "Kiểm tra lại" | 2 test trong `imports.e2e-spec.ts` |
| M5 dropdown > 255 ký tự | sheet ẩn "Mã nội dung", tham chiếu vùng ô | template với 45+ nội dung |
| M6 bộ nhớ | Đo (heap 384 MB): DOM load 328 MB heap (85%) với file 50 MB giải nén → chuyển `stream.xlsx.WorkbookReader`: 70 MB (18%); file shared-string độc nhất 61 MB: 191 MB (50%) | test file độc + 1000 dòng |
| Low | setting `import.uploadTtlHours` (24); cleanup xóa file trước rồi đánh dấu; `decide` khóa job `FOR UPDATE`; dòng NEEDS_CONFIRM kiểm lại sau khi chọn; 1 VĐV ở 2 cặp cùng nội dung trong file; mã VĐV đã gộp → "dùng mã Y"; export phân trang cursor (1.100 entry); bỏ `IMPORT_RETENTION_DAYS` | các test tương ứng |

Kết quả: worker 30/30, shared 80/80, 2 file e2e import 27/27; typecheck + lint worker/api/admin sạch.

Rủi ro:
- Bộ đọc stream của exceljs làm rơi entry zip nằm sau worksheet → agent ghi lại zip (worksheet để cuối, không nén) ra file tạm. "Sheet đầu" = worksheet đầu tiên trong zip. **Chỉ mới test với file do exceljs tạo; chưa thử file lưu từ Excel thật** — thử trước pilot.
- P2002 do trùng slug VĐV khi tạo đồng thời vẫn làm hỏng cả lô → job FAILED, thử lại được.

Câu hỏi chưa giải quyết:
1. Import có nên khôi phục entry WITHDRAWN thành CONFIRMED? Hiện có, kèm audit.
2. Có cần savepoint theo dòng cho P2002 slug không?
