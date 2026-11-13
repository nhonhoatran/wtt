# 2026-11-13 — Phase 06: bốc thăm, hạt giống, vòng bảng, sinh nhánh

**Date**: 2026-11-13 11:43
**Severity**: High
**Component**: packages/competition-engine (mới), packages/db (draw-locks, entry-guards), apps/api (draws, groups, matches), apps/admin (tab Bốc thăm), packages/shared
**Status**: Ongoing (code xong, chưa commit; chờ BTC trả lời G1a/G1b)

## What Happened

Làm trọn phase 06 trong một đợt, không tách lát cắt như kế hoạch. Plan ghi phải chờ BTC chốt G1b rồi mới làm phần bảng. Chủ repo chọn làm hết trước. Phạm vi: engine thuần, 2 migration (`draws_rounds_matches_games`, `groups_and_standings`), API `/admin/draws|groups|matches`, tab Bốc thăm trên admin, 4 setting trong nhóm `draw`.

Tách engine thành package riêng `@kamito/competition-engine` (hàm thuần, RNG có hạt) để test không cần DB.

## The Brutal Truth

Làm xong rồi mới thấy mình đang vay nợ. Luật hạt giống, phá hòa, rút lui giữa bảng đều là giả định chưa có BTC xác nhận (phase 12, câu 19–23). Nếu BTC trả lời khác, phải sửa engine và test, không chỉ đổi config. Test xanh 601/601 nhưng chưa ai bấm thử màn admin trên trình duyệt, nên phần UI chưa biết có dùng được không.

## Technical Details

- Engine: 180 test pass, coverage dòng 99.57 % (`plans/reports/tester-261113-phase-06-full-suite.md`).
- Gate trước review: typecheck, lint, build pass. `prisma migrate status`: 11/11 áp dụng trên DB dev.
- Review (`plans/reports/code-reviewer-261113-phase-06-draws.md`): 7/10, 0 Critical, 4 High.
- Setting số: `setting-value-editors.tsx:23` dùng `precision={0}` cho mọi setting số. Hệ quả: `draw.defaultSeedPercent` thành số nguyên 5–50 %, engine chia 100 (`draw-preview.ts:11`). Plan ghi `defaultSeedRatio` 0.25 nên lệch tên và kiểu.

## What We Tried

- Review H1–H3 (rút VĐV vòng loại đã thắng hoặc đã vào MAIN, công bố nháp có VĐV đã rút, BXH vẫn đánh dấu `qualified`): cùng một gốc. Entry WITHDRAWN vẫn nằm trong nhánh, và cả đường rút lẫn đường thay đều bị khóa (`ENTRY_ALREADY_WITHDRAWN`, `POSITION_ENTRY_WITHDRAWN`). Sửa bằng cascade walkover sang MAIN (`draw-post-publish.service.ts:84,97`), chặn stale entry khi publish (`DRAW_STALE_ENTRIES`), calculator bỏ người đã rút khi cấp suất.
- H4: `NOT: { resultType: 'BYE' }` loại mất trận LIVE có `resultType` NULL, nên `ROUND_STARTED` không chặn đổi thể thức. Sửa thành `OR [null, not BYE]` (`round-format.service.ts:33`).
- Regression: `apps/api/test/draw-review-guards.e2e-spec.ts` (5 ca) và `draw-withdrawn-entries.e2e-spec.ts` (6 ca). Em chưa đọc từng ca để xác nhận ca LIVE + NULL có trong đó.

## Root Cause Analysis

- Engine và test đơn vị pass hết vì chúng không mô phỏng vòng đời: VĐV rút ở draw này, còn dính ở draw khác.
- Cột nullable với `NOT` là bẫy quen. Codebase đã có hai cách viết đúng, nhưng viết lại từng chỗ thay vì dùng một helper chung.
- Chạy review sau khi test xanh mới lộ ra 4 High. Nếu review đi trước, số lần sửa đã ít hơn.

## Lessons Learned

- Đừng làm trọn phase khi gate nghiệp vụ còn mở. Nếu bắt buộc, ghi rõ giả định trong code và trong doc để sau đổi được.
- Mỗi luật vòng đời (rút, thay, publish, unpublish) cần một e2e nhiều bước, không chỉ unit.
- Cột nullable: dùng helper dùng chung (`locksDrawStructure`), đừng viết `NOT` tay.
- Đồng bộ kiểu setting với plan trước khi đặt tên.

## Next Steps

1. BTC trả lời G1a/G1b (phase 12, câu 19–23). Nếu khác giả định thì sửa engine + test. Owner: chủ repo. Trước khi phase 07 bắt đầu.
2. Chạy lại full suite sau sửa review và lưu report mới. Hiện mới có số 307/307 (api) và 180 (engine) ghi trong phase file, chưa có report tester riêng. Owner: chưa phân công.
3. Mở màn admin tab Bốc thăm trên trình duyệt. Checker ui-consistency đang parked, chưa calibrate. Owner: chưa phân công.
4. Nợ mở: L4 (shuffle entry cùng seed null bằng RNG), L6 (lock import đọc ngoài tx), `rankingDirtyAt` chưa set khi rút khỏi nhánh (phase 09), bundle admin > 500 kB.
5. Crash native `0xC0000409` của vitest xuất hiện lại trong lần chạy API, chạy lại thì pass. Cùng mã đã ghi ở phase 04–05, chưa điều tra.

## Status

**Status:** Ongoing
- Code: xong, chưa commit, chưa deploy staging (chờ cổng phase 01).
- Test: 601/601 trước sửa review. Sau sửa review chưa có report tester riêng.
- Gate: G1a/G1b chưa được BTC trả lời.

**Summary:** Phase 06 làm trọn trước khi BTC chốt luật bốc thăm và bảng. Review 7/10 bắt 4 High, đã sửa kèm test hồi quy, nhưng UI chưa được chạy thử trên trình duyệt. Quyết định tiếp theo thuộc về BTC và chủ repo.
