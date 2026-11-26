# Phase A9 — Nhập kết quả trận: bố cục Figma trong drawer, Trận trước/sau, deep link, tab "Kết quả" trong hub

## Context links
- Gap: [research/admin-figma-gap.md](./research/admin-figma-gap.md) mục "1-34"
- Figma: `figma/admin/1-34.png` (cuối), `1-32.png`, `1-33.png`
- Code: `apps/admin/src/pages/results/results-entry-page.tsx` (169), `match-score-drawer.tsx` (198 — sát trần), `game-score-inputs.tsx`, `score-draft.ts`, `match-action-bar.tsx`, `match-abandon-modal.tsx`, `use-results-event.ts`, `match-slot-order.ts`; `apps/admin/src/pages/event-hub/event-hub-page.tsx`
- Câu hỏi mở: Q10 (ghi chú trận)

## Overview
- Ưu tiên: P2. Effort: ~5h. Trạng thái: in-progress. Phụ thuộc: A4 (tab), A2 (deep link từ dashboard — không chặn).
- Giữ luồng danh sách + drawer + tự mở trận kế tiếp cùng bàn (nhanh cho trọng tài bàn). Áp bố cục Figma vào drawer; thêm điều hướng Trận trước/sau; tab "Kết quả" trong hub dùng chung màn.

## Key insights
- Trang riêng của Figma bắt người nhập quay lại danh sách sau mỗi trận; drawer + `openNext` (`results-entry-page.tsx:72-82`) đã bỏ bước đó → giữ drawer, nới rộng (setting? không — chiều rộng là bố cục, không phải nghiệp vụ; dùng breakpoint: 720 px ≥ lg, full màn < md).
- Tỉ số ván tổng + người thắng tính từ `score-draft.ts` (đã có lỗi theo ván). Thông điệp lỗi phải nêu ván + quy tắc + ví dụ lấy từ thể thức trận (`pointsPerGame`, `winBy`), không chôn "11"/"2".
- "Kết thúc trận" Figma = select; hiện bỏ cuộc/xử thua đi qua `match-abandon-modal.tsx` có xác nhận riêng (thay đổi lớn, cần lý do) → giữ modal, đặt nút "Trận không đấu đủ…" cạnh select-ngắn; không biến hành động nguy hiểm thành một ô select dễ bấm nhầm.
- "Ghi chú": `Match` không có cột → không vẽ tới khi chốt Q10.
- "Xác nhận kết quả" disabled khi còn lỗi + dòng lý do dưới nút ("Sửa ván 4 để xác nhận") → UI.
- Deep link: `/results?event=<id>&match=<id>` → chọn giải (bỏ qua localStorage) và mở drawer; dashboard (A2) dùng.
- Tab hub "Kết quả": tách `ResultsWorkspace({ fixedEventId? })` khỏi `ResultsEntryPage`; trang `/results` = selector giải + workspace; tab = workspace với giải cố định. Key tab `results` (mới).

## Requirements
- Drawer header: "Trận #n" + Tag nội dung + Tag vòng; dòng "Bàn · HH:mm, thứ dd/mm/yyyy · Thắng x/y ván · Ván p điểm, cách biệt w" (dựng từ dữ liệu).
- Khối đối đầu: tên, `[seed]`, CLB hai bên; giữa: tỉ số ván lớn "2 – 1" + "Tự động tính theo các ván hợp lệ".
- Lưới ván: hàng = hai bên, cột = Ván 1..bestOf + "Ván thắng"; ô lỗi viền đỏ; danh sách lỗi dưới lưới (role="alert").
- Ô "Người thắng: <tên | chưa xác định>" + giải thích.
- Footer dính: chú thích "Sau khi xác nhận, kết quả hiện trên trang giải và người thắng được đưa vào vòng sau"; "Lưu nháp" (save-progress) · "Xác nhận kết quả" (primary; disabled + lý do).
- Đầu drawer: "Trận i/N chờ kết quả" + "‹ Trận trước" / "Trận sau ›" (theo thứ tự danh sách đang lọc; qua trang thì gọi trang kế).
- Trận OFFICIAL: giữ `match-official-result.tsx`, Sửa tỷ số/Mở lại như cũ (quyền).
- Deep link + tab hub.

## Architecture
```
ResultsEntryPage (/results)            EventHub tab "results"
   └─ EventPicker + ResultsWorkspace      └─ ResultsWorkspace(fixedEventId)
ResultsWorkspace
 ├─ filters (sub-event, session, table, status, search) → GET /admin/events/:id/matches (server page)
 ├─ Table rows
 └─ MatchScoreDrawer(matchId, nav{prev,next,index,total})
      ├─ MatchDrawerHeader / MatchVersusPanel
      ├─ GameScoreGrid (game-score-inputs restyled)
      ├─ MatchWinnerBox
      └─ MatchDrawerFooter (MatchActionBar)
```

## Related code files
Sửa
- `apps/admin/src/pages/results/results-entry-page.tsx` (chỉ còn picker + workspace + đọc `?event=&match=`)
- `apps/admin/src/pages/results/match-score-drawer.tsx` (tách thân)
- `apps/admin/src/pages/results/game-score-inputs.tsx` (lưới)
- `apps/admin/src/pages/results/match-action-bar.tsx` (footer, lý do disabled)
- `apps/admin/src/pages/results/score-draft.ts` (thông điệp lỗi có ví dụ từ thể thức)
- `apps/admin/src/pages/results/use-results-event.ts` (ưu tiên `?event=`)
- `apps/admin/src/pages/event-hub/event-hub-page.tsx` (thêm tab "Kết quả")
- `apps/client/tests/admin-full-flow/results.ts` (selector nếu đổi: 'Lưu nháp', 'Xác nhận', 'Lưu tỷ số'…)
Tạo
- `apps/admin/src/pages/results/results-workspace.tsx`
- `apps/admin/src/pages/results/match-drawer-header.tsx`
- `apps/admin/src/pages/results/match-versus-panel.tsx`
- `apps/admin/src/pages/results/match-winner-box.tsx`
- `apps/admin/src/pages/results/use-match-navigation.ts` (thuần phần tính prev/next) + `apps/admin/test/match-navigation.test.mjs`
- `apps/admin/src/pages/event-hub/results-tab.tsx`

## Implementation steps
1. Tách `ResultsWorkspace` (không đổi hành vi) → `/results` chạy như cũ.
2. `use-results-event.ts`: đọc `?event=`; `ResultsWorkspace` đọc `?match=` mở drawer.
3. `use-match-navigation.ts` + test (đầu/cuối danh sách, sang trang).
4. Tách drawer thành header/versus/grid/winner/footer; giữ toàn bộ logic `use-match-actions.ts`.
5. Thông điệp lỗi `score-draft.ts` dựng từ thể thức.
6. `results-tab.tsx` + thêm vào `HUB_TABS`.
7. Cập nhật E2E results; chạy luồng nhập 1 trận BO5 có lỗi ván → sửa → xác nhận → tự mở trận kế cùng bàn.
8. typecheck/lint/test/build.

## Todo
- [x] ResultsWorkspace
- [x] deep link
- [x] navigation + test
- [x] drawer tách + restyle
- [x] lỗi có ví dụ
- [x] tab hub
- [x] Build và unit test đạt
- [x] E2E admin-full-flow sau redesign (kiểm cùng C11) — đạt 2026-11-26: desktop 8/8 một lượt, mobile 8/8 hai lượt; [báo cáo](../reports/tester-261126-1620-admin-full-flow-after-redesign.md)


## Đồng bộ trạng thái 2026-11-25

Nguồn: [báo cáo triển khai](../reports/fullstack-developer-261125-phase-A9-admin-results.md).

Các bước triển khai, build và kiểm tay đã có bằng chứng; E2E admin-full-flow sau redesign đạt ngày 2026-11-26 sau khi sửa helper `amendResult`/`fillWin` cho khớp với việc lưới điểm tự focus ô đầu sau 80 ms.

## Success criteria
- Nhập kết quả 1 trận: mở trận → nhập ván → Xác nhận → drawer tự sang trận kế (≤ 1 thao tác chuyển trận, như hiện tại).
- Lỗi ván hiện ngay khi rời ô, nêu ván + quy tắc + ví dụ đúng theo thể thức của trận.
- `/results?event=X&match=Y` mở đúng drawer; tab hub "Kết quả" không có ô chọn giải.
- RESULTS_OPERATOR: trang chủ vẫn là màn này; thấy tab "Kết quả" trong hub (quyền `matches.list`).

## Risk assessment
| Rủi ro | K × T | Giảm thiểu |
|---|---|---|
| Tách drawer làm lệch logic start/confirm/amend/reopen | TB × Cao | Không đụng `use-match-actions.ts`; E2E results |
| `?match=` của giải khác giải đang chọn | Thấp × TB | `event` trong URL thắng; nếu match không thuộc giải → thông báo, đóng drawer |
| Drawer rộng che danh sách trên 1280 | TB × Thấp | 720 px; danh sách vẫn thấy cột trái |
Rollback: revert; không đổi API.

## Security considerations
- Quyền giữ nguyên (`matches.*`; reopen chỉ ADMIN). Deep link không bỏ qua kiểm quyền — API vẫn kiểm.

## Next steps
- Q10 ghi chú trận.
