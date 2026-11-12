# 2026-11-12 — Phase 04: dữ liệu gốc giải đấu, cấu hình động, upload ảnh

**Date**: 2026-11-12 14:34
**Severity**: Medium
**Component**: apps/api (catalogs, events, sub-events, venues, media, app-settings), apps/worker (media processors), apps/admin (catalog, event hub, settings), packages/shared, packages/db
**Status**: Blocked (code xong, chưa deploy staging; chờ cổng ra phase 01)

## What Happened

Làm trọn phase 04 trong một đợt, không tách lát cắt như plan ban đầu. Phạm vi: 6 danh mục cấu hình, địa điểm + bàn, giải, nội dung thi đấu (có tạo hàng loạt), sanitizer rich text, `/settings` cho 8 key nghiệp vụ, upload ảnh qua API. Commit `b426de8..4cfca94`.

## The Brutal Truth

Test xanh không có nghĩa là chạy được. Dev `.env` không khai báo `STORAGE_DRIVER`, nên app âm thầm rơi về `s3`. Test chạy driver `local` nên không bắt được. Chỉ khi chạy app thật mới lộ ra. Vite proxy và nginx cũng thiếu `/api/v1/media`. Mệt, vì mỗi lớp lỗi chỉ lộ khi có người bấm thử. Và tới giờ mọi thứ mới chứng minh được trên máy dev, chưa có staging.

## Technical Details

- Gate: typecheck 10/10, lint 7/7, build 7/7. Test: api 185/185, shared 52, worker 20, ui-tokens 3.
- Migration: `add_tournament_master_data`, `add_media_assets`, `add_single_default_partial_indexes` (SQL viết tay). `prisma migrate diff` sau đó rỗng.
- Review 7.5/10, 0 Critical, 2 High đã sửa:
  - H1: body parser mặc định 100 KB thấp hơn `MAX_INFO_BODY = 100_000` ký tự tiếng Việt. Request bị 413 HTML, form mất nội dung đang soạn. Sửa: `apps/api/src/common/http/json-body-limit.ts`.
  - H2: media kẹt `PROCESSING` khi job vượt stalled hoặc Redis mất key. `jobId` cố định `media-{id}` nên enqueue lại bị BullMQ bỏ qua. Sửa: job dọn timeout cho nhánh `PROCESSING`.
- Smoke trình duyệt: tạo giải + 5 nội dung trong 4 click.
- Native crash: `exit 3221226505` (0xC0000409) ở `must-change-password.e2e-spec.ts`, 1/3 lần chạy full api. Chưa tái hiện, nghi `sharp` (chưa xác minh). Để lại 2 user `@test.kamito.local` trong DB dev.
- Số trong `tester-261112-1329` (169 test api) là snapshot trước khi sửa. Dùng số 185 ở trên.

## What We Tried

- Presigned POST với `content-length-range` (thiết kế a): bỏ, vì chưa kiểm được MinIO trên máy. Chọn thiết kế b: API stream, chặn trần 2 lớp (Content-Length và đếm byte khi stream).
- Partial unique index cho `isDefault`: Prisma không biểu diễn được `WHERE`, nên viết SQL tay và kiểm bằng `migrate diff`.
- `ticketUrl` sai: spec ghi 400, code trả 422 theo quy ước `parseBody`. Đã chọn 422, spec chưa sửa.

## Root Cause Analysis

- `STORAGE_DRIVER` có default là `s3` trong code, và default này fail-open: thiếu biến là rơi về driver ngoài máy.
- Giới hạn kích thước nằm ở 4 nơi (nginx `client_max_body_size 10m` viết cứng, body parser, DTO, setting) và không đồng bộ.
- Trạng thái trung gian `PROCESSING` không có sweeper. Hệ thống chỉ dựa vào event `failed` của BullMQ.

## Lessons Learned

- Config thiếu phải fail-closed: boot lỗi rõ ràng, không rơi về default nguy hiểm.
- Mỗi giới hạn kích thước chỉ có một nguồn sự thật, rồi sinh ra các tầng còn lại.
- Trạng thái trung gian luôn cần timeout và job dọn ngay từ đầu.
- Trước khi khẳng định trạng thái repo, chạy lệnh kiểm tra. Trong phiên này có một khẳng định "repo đã có git remote" chưa được kiểm; `git remote -v` cho kết quả rỗng.

## Next Steps

1. Deploy staging + migrate (plan bước 13): chờ cổng phase 01, chủ repo quyết.
2. Test driver `s3` với MinIO thật: `content-length-range`, `HeadObject`, xóa `incoming/`. Owner: backend, làm trước staging.
3. Kiểm `sharp` trên image Alpine; chạy lặp full api 5–10 lần để đo tỉ lệ native crash.
4. Dọn 2 user test trong `kamito_tt_dev` khi chủ repo xác nhận.
5. Đăng ký tag revalidate cho mutation giải, sub-event, AppSetting: phase 07 (`cache-tags.ts`).
6. Review Low còn mở (L1–L14, trừ đã sửa): chủ repo chọn mục nào làm trước.

**Câu hỏi còn mở:** `ticketUrl` chuẩn là 400 (spec) hay 422 (code)? Bucket S3 production public toàn bộ hay chỉ `public/`?
