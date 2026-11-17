# 2026-11-16 — Phase 09: màn admin xếp hạng làm lại từ đầu, chưa commit

**Date**: 2026-11-16 17:40
**Severity**: High
**Component**: apps/admin (resource `rankings`, `pages/ranking/`, `pages/event-hub/`), apps/api (catalog-crud audit, ranking-lists, ranking-points, ranking-snapshots, `ranking-jobs/ranking-today.ts`), packages/shared (`ranking-limits.ts`)
**Status**: Ongoing (chưa commit theo quyết định; chưa deploy staging)

## What Happened

Phần admin Xếp hạng (bốn màn: Bảng xếp hạng, Quy tắc điểm, Sổ điểm, Kỳ chốt) cùng vài thay đổi API nhỏ đã làm xong trong working tree. Trước đó một phiên khác làm dở phần này trong cùng checkout, chưa commit, và phần đó bị mất. Phần này được dựng lại từ đầu bằng 3 agent chạy song song, mỗi agent sở hữu tập file rời nhau. Kèm theo là một checklist nhất quán UI và một checker đã được calibrate bằng plant lỗi.

Thay đổi API: thêm field `rankingList`, `category`, `subEvent`, `publishedBy` (field cũ giữ nguyên). Audit `catalog-crud.ts` ghi quan hệ ở cả `before` lẫn `after` theo cùng một `include`. `rankingToday()` lấy ngày theo `event.defaultTimezone` thay vì UTC. Ba hằng `RANKING_*` đưa vào `@kamito/shared`.

## The Brutal Truth

Mất công làm lại gần như từ con số không. Phần làm dở của phiên trước chỉ nằm trong working tree của một checkout dùng chung, không commit, không nhánh tạm, nên khi bị xóa thì không còn gì để khôi phục. Lần sau việc chưa commit phải được đẩy lên nhánh WIP ngay trong ngày.

Phần khó nhất vẫn là câu xác nhận khi lưu quy tắc điểm. Review bắt được một lỗi high (H1): chọn ngày áp dụng trong quá khứ thì câu xác nhận nói "giải đã kết thúc giữ nguyên", nhưng API thực tế tính lại cả giải đã kết thúc. Đây là kiểu lỗi mà unit test không bắt, vì nó nằm ở chỗ UI nói một đằng, backend làm một nẻo.

Trạng thái "xong" còn nhiều chỗ chưa chắc: admin chưa có unit test nào, và ràng buộc ngày mới chỉ có ở UI.

## Technical Details

- Code review: 7.5/10. H1 và M1–M5, M7 đã sửa. M6 (lệch múi giờ) mới sửa phía API.
- Browser test: 7 flow PASS. B1 (Enter trong ô ngày lưu luôn quy tắc), B4, B6 đã sửa. B2, B3, B5 là lỗi có sẵn từ trước phase 09.
- Kiểm chứng sau sửa cuối: API 91 file, 571/571 test, exit 0 (387s), trên DB dev `localhost:5433/kamito_tt_dev`. `packages/ranking-engine` 36/36. Typecheck và lint đạt.
- Lần chạy full đầu tiên sau sửa ra exit 0, nhưng output bị cắt bằng `tail` nên mất dòng tổng kết (warning `pg`/`MaxListeners` in sau tổng kết). Chạy lại, lọc dòng `Test Files|Tests` thì có số 571/571.

## What We Tried

- Dựng lại bằng 3 agent song song theo ownership file.
- Calibrate checker bằng plant lỗi trước khi tin kết quả verifier.
- Browser test thật với backend thật, không chỉ mock.
- Đổi `useBlocker` sang guard tự viết (xem Lessons).

## Root Cause Analysis

- Nguyên nhân mất việc: làm dở và giữ trong working tree, không có commit hay nhánh tạm.
- Nguyên nhân lỗi H1: ràng buộc ngày chỉ kiểm ở UI, không có ở API. Hai phía không cùng hiểu "hiệu lực từ ngày X".
- Nguyên nhân lệch múi giờ: admin dùng `dayjs()` theo máy, API dùng UTC. Cả hai đều không đọc `event.defaultTimezone`.

## Lessons Learned

- Việc chưa commit trong checkout dùng chung rất mong manh. Commit hoặc đẩy nhánh WIP sớm.
- App dùng `BrowserRouter`, nên không có `useBlocker`. Guard tự viết chỉ bọc `navigator.push/go` và `beforeunload`. Nút Back của trình duyệt vẫn làm mất thay đổi chưa lưu. Đây là giới hạn đã biết, không phải đã giải quyết.
- `suggest-seeds` với `apply:false` vẫn ghi DB (`rankingAtEntry`, `pointsAtEntry`, audit row). Tên "preview" gây hiểu nhầm.
- `sed -i` trong Git Bash làm mất CRLF. Dùng Edit hoặc Write cho file Windows.
- Validator của docs bị treo, phải dừng tay. Đừng chờ mù, đặt timeout.
- Ràng buộc nghiệp vụ về ngày phải nằm ở API. UI chỉ là lớp hiển thị.

## Next Steps

1. Thêm kiểm ngày ở API cho `effectiveFrom`, `earnedAt`, `asOfDate` (không cho ngày quá khứ không chủ đích, không cho ngày tương lai ở điểm thủ công và kỳ chốt). Owner: chủ repo quyết, dev làm. Trước khi coi quy tắc là xong.
2. Chuyển ngày "hôm nay" phía admin sang múi giờ của event. Ba chỗ: ngày mặc định điểm thủ công, ngày mặc định kỳ chốt, tag "Hết hạn" ở sổ điểm. Owner: dev admin.
3. Dọn dữ liệu test trên `localhost:5433/kamito_tt_dev`: tài khoản `ui-test-admin@example.com`, bảng `UITEST1`, kỳ chốt đã công bố. Owner: chủ repo xác nhận trước khi xóa.
4. Quyết định: có commit phase 09 không, và commit theo mấy phần. Owner: chủ repo.
5. Chờ G2 (BTC trả lời quy chế điểm). Chờ deploy staging, đang bị chặn bởi gate của phase 01.
6. Quyết định `suggest-seeds` có tách preview không ghi DB hay không. Owner: chủ repo.

## Status

- Code: chưa commit, working tree có sẵn các thay đổi phase 09.
- Test: API và engine xanh theo số liệu trên. Admin chỉ có typecheck, lint, browser test.
- Mở: G2, staging, ràng buộc ngày ở API, múi giờ admin, admin chưa có unit test, dữ liệu test local.

**Status:** Ongoing
