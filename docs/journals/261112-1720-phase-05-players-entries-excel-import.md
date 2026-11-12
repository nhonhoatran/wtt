# 2026-11-12 — Phase 05: VĐV, cặp đấu, entries, import Excel

**Date**: 2026-11-12 17:20
**Severity**: High
**Component**: apps/api (players, pairs, entries, merge, imports, exports), apps/worker (import validate/commit/cleanup), apps/admin (players, pairs, imports, entries tab), packages/shared, packages/db, nginx admin
**Status**: Blocked (code xong, chưa push, chưa lên staging; chờ cổng phase 01)

## What Happened

Làm trọn phase 05 trong một đợt, không tách lát cắt như kế hoạch gốc. Phạm vi: VĐV, cặp đôi, entries (seed/stage/quota), merge VĐV, import Excel qua worker (validate → chọn VĐV → commit → cleanup), export entries, màn hình admin. Tám commit `9d10ac3..676d1eb` trên `main`, chưa push.

Lead viết schema, migration (4 file, CHECK viết tay) và helper shared/db trước, rồi ba agent chạy song song theo file ownership nghiêm ngặt: API core, import/export + worker, admin UI. Lệch contract nhỏ: `MERGE_CONFLICT` nằm trong `error.issues`, một endpoint trả 200 thay vì 201.

## The Brutal Truth

Review vòng 1 chấm 7/10, vòng 2 chấm 8/10. Vòng 2 bắt được một lỗi do chính bước sửa vòng 1 gây ra: chuyển sang đọc Excel streaming làm guard zip-bomb và reader parse zip theo hai cách khác nhau. Một file 12 KB bung ra gần 200 MB. Test xanh suốt vì không có test nào dùng file độc hại kiểu này.

Crash native `0xC0000409` của vitest trên Windows xuất hiện khoảng 1/6 lần chạy full API. Chưa tìm ra nguyên nhân. Đổi fork sang thread không hết.

## Technical Details

- Gate (lead báo cáo, chưa thấy trong file report nào): API 257/257, shared 80, worker 30, admin 5/5, typecheck + lint 14/14.
- Tester run 2 (`plans/reports/tester-261112-1436-phase-05-test-run-2.md`) ghi 254 pass và `Exit status 3221226505`.
- `P2010` khi gọi advisory lock qua `$queryRaw` (hàm trả `void`) với Prisma adapter-pg. Sửa bằng `$executeRaw`.
- Prisma 7 + adapter-pg không có `meta.target` trong `P2002`. Tên index nằm ở `meta.driverAdapterError.cause.constraint.index`.
- exceljs streaming bỏ qua zip entry nằm sau worksheet. Giải pháp: ghi lại zip vào file tạm, đưa worksheet xuống cuối.
- Đọc bằng DOM của exceljs: 85% heap 384 MB với file 50 MB giải nén. Streaming: 18–50%.
- Nginx admin `client_max_body_size 2m` chặn upload import lớn hơn 2 MB. Đã thêm location riêng theo `IMPORT_MAX_FILE_BYTES`.

## Root Cause Analysis

- Commit import kiểm trạng thái trước khi lấy lock, chạy đua với ghi entry đồng thời. Hai thứ tự khóa khác nhau tồn tại song song.
- `committedRows` không bao giờ được cập nhật, nên nút "Thử lại" không bao giờ hiện. Job `FAILED` bị kẹt, không có đường đi tiếp.
- Giới hạn kích thước nằm ở nhiều nơi (nginx, API, worker) và không đồng bộ.

## Lessons Learned

- Mọi đường ghi cùng bảng phải dùng chung một thứ tự khóa (SubEvent → Player). Ghi thành quy ước trong `code-standards.md`.
- Test parser file phải có file độc hại thật (zip overlap, tỉ lệ nén bất thường), không chỉ file đúng định dạng.
- Guard kích thước phải nằm trong chính parser đang dùng.
- File Excel viết tay không chứng minh được tương thích với Excel. Cần file do Excel lưu.

## Next Steps

1. Import thử một file do Excel lưu (nhỏ, dữ liệu giả, đặt trong `apps/api/test/fixtures/`). Owner: chưa phân công. Làm trước pilot.
2. Điều tra crash `0xC0000409`: chạy full API lặp 10 lần, ghi file cuối trước crash. Owner: chưa phân công.
3. Push và deploy staging khi cổng phase 01 mở. Quyết định: chủ repo.
4. Còn mở theo plan: draw hook stub đến phase 06, cache tag chờ phase 07, redirect 301 cho slug đã merge làm ở phase 10.
5. Race `Competitor_playerId_key` khi tạo đồng thời trả P2002 thành 500, chưa xử lý.

**Câu hỏi còn mở:** nguyên nhân crash `0xC0000409` (có liên quan `sharp` hay pool thread không)? File Excel thật có đọc đúng như file viết tay không?

## Status

**Status:** Blocked
- Code: xong, 8 commit `9d10ac3..676d1eb` trên `main`, chưa push.
- Test: crash native chưa giải thích. Lần chạy gần nhất ghi 257/257 (lead báo cáo), file report gần nhất ghi 254 + 1 crash.
- Deploy: chưa lên staging, phụ thuộc phase 01. M1/pilot đang bị ảnh hưởng.
