# 2026-11-14 — Chốt phase 04–07: revalidate, lịch thi đấu, nhập/sửa tỷ số, và nợ kỹ thuật

**Date**: 2026-11-14 17:20
**Severity**: High
**Component**: apps/api (revalidation, sessions, match-schedule, match-results, exports), apps/worker, apps/admin (schedule, results, catalog), packages/competition-engine, packages/shared, docs/plans
**Status**: Ongoing (24 commit trên main, `478ad88..6e340f9`; chưa deploy staging, chưa có số đo staging)

## What Happened

Làm nốt mọi hạng mục còn làm được của phase 04–07, chia 3 cụm rồi gom nợ:

- **Cụm A, revalidate phase 04/05** (`4cdfa23..2244f18`): cache công khai cho catalog, media, bảng xếp hạng.
- **Cụm B, backend phase 07** (`4c7124b..07f2500`): sessions, xếp lịch thủ công có kiểm tra xung đột, phiếu thi đấu, export; un-start, save-progress, amend, reopen có impact preview. Coverage test tag cache: 92 route, 0 chưa map.
- **Cụm C, admin UI phase 07** (`8173f28..00eb3e3`): tab lịch thi đấu, bảng lưới, panel chưa xếp, in phiếu; màn nhập tỷ số đầy đủ.
- **Gom nợ** (`c449c75..6e340f9`).

## The Brutal Truth

Review vòng đầu bắt được lỗi dữ liệu mức cao, và đó là lỗi nghiêm trọng nhất. Guard "nhóm đã xếp chỗ" cấp draw bị hổng sau một lần reopen một phần. Walkover cũ còn sót sau reopen. Trận đã hủy (voided) bị kẹt trong session. Tính giờ từng dòng một, có lúc chạy quá thời gian cho phép.

Browser QA trên backend thật bắt được 7 lỗi UI mà typecheck và mock đều không thấy. Trang bốc thăm nhóm crash, và code này đã commit từ phase 06. Sort không có chiều làm API trả 400. Nút "Tải lại" trong thông báo xung đột có thể ghi đè điểm của người khác. Modal step-up bị drawer che.

Điểm bực nhất: orchestrator báo `draw.publish` đã đủ tag `match-*`. Agent đồng bộ plan đọc lại code và thấy chưa. Báo "đóng" mà chưa kiểm trong code là sai.

## Technical Details

- Engine: `scoreMatch` tính ván cuối chưa kết thúc của trận RETIRED là một ván thắng. Sửa ở `c449c75`.
- Prisma `P2034` (write conflict/deadlock) ánh xạ về 409: `apps/api/src/common/filters/http-exception.filter.ts:38-42`.
- Revalidate queue có hơn 10k job chưa xử lý. Test quét toàn queue bị timeout. Sửa bằng helper chỉ đọc job gần đây (`865ff1e`).
- Test e2e chạy đồng thời với dev worker: worker ăn mất job import của test. Regex mã VĐV giả định độ dài cố định.
- Vitest trên Windows crash `0xC0000409`, mất output của cả chunk.
- Số liệu do chủ phiên báo cáo, chưa tự chạy lại trong lần viết này: API e2e 67 file / 420 test, API unit 125, engine 230, worker 39, shared 97, typecheck + lint 18/18.

## What We Tried

- Review độc lập, sửa lỗi high, chạy lại test.
- Browser QA với backend thật, không chỉ mock.
- Chạy e2e với dev stack đã tắt, để worker dev không tranh job của test.

## Root Cause Analysis

- (Suy đoán của người viết, chưa kiểm chứng riêng) Test ít khi đi qua tổ hợp thao tác như reopen, walkover và void. Các lỗi high nằm đúng ở tổ hợp đó.
- Code phase 06 đã commit nhưng chưa được QA trên trình duyệt. Lỗi crash trang bốc thăm nhóm lộ ra khi phase 07 chạm vào.
- Trạng thái "đã đóng" được báo mà chưa đối chiếu với code.

## Lessons Learned

- QA trên trình duyệt với backend thật đáng tiền. Nó bắt lỗi mà typecheck bỏ sót.
- Trước khi ghi "đã đóng", đọc code. Mỗi mục nợ phải có commit và dòng kiểm chứng.
- Chạy e2e với dev stack đã tắt, và không dùng chung DB với dữ liệu thử.
- Quyết định đã chốt: đổi chỗ khi thả vào ô đang có người (swap); trận đã đấu giữ giờ thật; walkover và trận hủy chiếm 0 phút và nhả slot; đổi múi giờ giữ nguyên giờ treo tường; `expectedBlockingIds` chặn force reopen; khóa theo thứ tự SubEvent trước; hằng số độ tin cậy nội bộ để cố định, kèm comment "vì sao", không đưa lên `/settings`.

## Next Steps

1. Staging deploy và đo hiệu năng. Bị chặn bởi hạ tầng phase 01. Owner: chủ repo.
2. Chờ đáp án BTC cho G1b. Owner: chủ repo.
3. Thử một file Excel import thật. Owner: chưa phân công.
4. Chốt các mục thiết kế: màu focus, cách gọi "session", nhảy 76 px của dialog, sensor kéo thả bằng bàn phím. Owner: chưa phân công.
5. E2e cho luồng Q → BYE → R2 reopen. Owner: chưa phân công.
6. Dọn dữ liệu test local: dữ liệu có tiền tố "QA " và tài khoản admin test trong DB dev. Owner: chủ repo.

## Status

- Code: đã commit local trên main, chưa push, chưa deploy.
- Test: số liệu theo báo cáo của chủ phiên, chưa chạy lại trong bản ghi này.
- Mở: staging, G1b, file Excel thật, các mục thiết kế, e2e Q → BYE → R2.

**Status:** Ongoing
