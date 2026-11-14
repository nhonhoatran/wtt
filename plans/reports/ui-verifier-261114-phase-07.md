# UI verify — phase 07 (admin: lịch & kết quả, session, lưới, in phiếu, nhập tỷ số)

Checker: agent riêng (không viết trang nào), chỉ đọc, không render. Checklist: `ui/phase-07-ui-checklists.md` mục A–H (snapshot 2026-11-14) + `ui/phase-07-ui-plan.md`. Bound: `apps/admin/src`. Đọc lúc 15:06–15:15 (2026-11-14).
File đổi trong lúc kiểm (agent khác): `unscheduled-panel.tsx` (15:11:03), `use-venue-tables.ts` (15:10:41), `results-entry-page.tsx` (15:11:03) — đã đọc lại; chỉ đổi tham số sort (`matchNo` → `matchNo:asc`, `order` → `order:asc`), không đổi giao diện.

## Hiệu chỉnh (task 0)

- Cách làm: worktree tạm (`git worktree add --detach`) trong thư mục mới tạo bằng `mktemp -d` dưới scratchpad, chép `apps/admin/src` + `packages/shared/src` bản đang làm vào, cài 3 khác biệt. Một agent riêng (không cài, không phải checker này) kiểm 3 bản sao, chỉ được nói "có thể khác ở đâu đó", cấm mở bản gốc và cấm chạy git. Worktree đã xoá (`git worktree remove` + `prune`).
- Bản cài và kết quả:

| Bản sao | Khác biệt cài | Checklist đưa cho checker | Bắt được? |
|---|---|---|---|
| `draws-tab.tsx` (hub tab) | lỗi tải dùng `Alert` không nút, thay `Result … Thử lại` | phase 06 mục A | Có — high, nêu đúng dòng "tải / lỗi", 4/4 tab cùng loại |
| `draw-entry-action-modal.tsx` (modal) | ô lý do bỏ `required`, nhãn "(không bắt buộc)", nút OK cho gửi lý do rỗng | phase 06 mục D | Có — high, cả nhãn lẫn điều kiện nút OK |
| `match-score-drawer.tsx` (drawer) | 409 chỉ `message.error`, bỏ `MatchProblemAlert` (mất "Tải lại") | phase 07 mục F | Có — high, nêu đúng dòng "409" |

- Lệch với plan: plan ghi giao mục A, G, F; checker hiệu chỉnh nhận phase 06 A/D cho hai bản sao phase 06 (A, G phase 07 mô tả trang khác — schedule tab, sửa tỷ số — nên đối chiếu bản sao draws-tab với chúng chỉ ra nhiễu). Cùng kind, cùng skill.
- Plant thử được: component ở vai trò lỗi tải, trường bắt buộc + điều kiện nút, cơ chế hiện lỗi. **Không plant nào thử**: khoảng cách/literal, kiểu chữ, chữ người dùng đọc, khung (holder), accessibility.
- **Chưa hiệu chỉnh** (không có tham chiếu cùng loại): lưới C (`session-grid*`), panel D (`unscheduled-panel`), trang in E (`match-sheets-print-page` + `print.css`). Hộp thoại B/G/H tính theo kind modal đã hiệu chỉnh.

## Theo trang (chỉ dòng KHÁC; dòng không nêu = pass)

### A. `schedule-tab.tsx`, `schedule-actions.tsx`, sửa `event-hub-page.tsx`
- Thao tác session tách hai chỗ (thấp): "Thêm session" cạnh chọn ngày/session (`schedule-tab.tsx:100`), còn "Sửa"/"Xóa" nằm ở hàng tiêu đề (`:113-123`). Dòng A "thao tác session — cạnh chọn session".
- Ngày mặc định theo giờ trình duyệt (thấp): `defaultDay` dùng `dayjs()` (`schedule-tab.tsx:25-28`). Lưới hiện giờ theo `event.timezone` (`timeInZone`), trang Nhập tỷ số chọn session hiện tại theo mốc tuyệt đối (`use-results-schedule-filter.ts:30-33`). Hai cách hiểu "hôm nay/hiện tại" cho cùng giải; lệch khi máy admin khác múi giờ giải.
- "In phiếu trận" không bao giờ kèm `tableId` (thấp): `schedule-actions.tsx:43-47`. Dòng A "(+ `tableId` nếu đang chọn cột bàn)". Tab không có chọn cột bàn nên chưa có gì để truyền; trang in có Select bàn bù lại.
- Chữ cảnh báo (thấp): "Làm mới trang công khai" hiện `message.success('Đã gửi yêu cầu…')` rồi `showWarnings` (`schedule-actions.tsx:25-27`). Cơ chế khớp family (10+ file success + `showWarnings`). Nhưng nhãn `PUBLIC_REFRESH_DELAYED` là "Đã lưu. Trang công khai sẽ cập nhật chậm hơn" (`api/write-warnings.ts:7`), trong khi thao tác này không lưu gì.

### B. `session-form-modal.tsx`, `components/sortable-list-field.tsx`
- Không khác checklist. `sortable-list-field.tsx` là bản tách đúng của `tiebreaker-list-field.tsx` HEAD (so `git show HEAD:`): cùng token, nhãn aria, cảm biến bàn phím.
- Ghi chú (thấp): sửa một session có bàn nay đã ẩn → `tableOptions` chỉ lấy bàn đang hiện (`session-form-modal.tsx:44-45`), nên dòng bàn đó hiện id thô (`labelOf` trả `item`, `sortable-list-field.tsx:73`). Suy từ code, chưa thử.

### C. `session-grid.tsx`, `session-grid-cell.tsx`, `use-schedule-board.ts` (chưa hiệu chỉnh)
- Mời thao tác chắc chắn lỗi (trung bình):
  - Khi đang chọn một trận **từ panel**, ô đã có trận vẫn nhận bấm/thả (`session-grid-cell.tsx:73-76`, `use-schedule-board.ts:65-77`).
  - Dòng gợi ý lúc đó ghi "bấm vào ô có trận để đổi chỗ" (`session-grid.tsx:47-49`).
  - Hợp đồng API: từ panel vào ô có người → 409 `SCHEDULE_SLOT_OCCUPIED` (`ui/phase-07-api-contract.md:21,23`). Người dùng sẽ thấy lỗi + tải lại.
- **Sửa checklist** (không phải lệch của trang): dòng C "không có: đổi chỗ hai trận một lần" đã cũ. Hợp đồng API cho đổi chỗ khi trận đã có ô (`swappedMatchId`, `expectedOccupantId`), và code làm đúng như vậy.
- Tooltip cảnh báo trùng gắn vào `Typography.Text` không focus được (thấp, a11y): `session-grid-cell.tsx:111-115`. Bàn phím không mở được danh sách cảnh báo; chữ "N cảnh báo trùng lịch" vẫn thấy.
- Kéo chỉ có `PointerSensor` (thấp): `schedule-tab.tsx:37`. Dòng C ghi "`PointerSensor` + `KeyboardSensor`". Bàn phím vẫn làm được bằng 2-click (ô và mục panel là `Button`), nên không mất chức năng; lệch với chữ của checklist.
- Báo "bị cắt bớt" hai cách (thấp): lưới dùng `Alert type="warning"` (`session-grid.tsx:42-44`), trang in dùng `Typography.Text type="warning"` (`match-sheets-print-page.tsx:154`).

### D. `unscheduled-panel.tsx` (chưa hiệu chỉnh)
- Chữ trống sai khi đang lọc (trung bình): `Empty description="Đã xếp hết trận"` (`unscheduled-panel.tsx:121`) hiện cả khi lọc nội dung/vòng/tìm tên không ra kết quả. Trang Nhập tỷ số dùng "Không có trận nào" (`results-entry-page.tsx:128`).

### E. `match-sheets-print-page.tsx`, `styles/print.css` (chưa hiệu chỉnh)
- Lỗi tải danh sách session không báo (thấp): khi query `sessions` lỗi (`match-sheets-print-page.tsx:93-96,103-105`), tiêu đề rơi về "Phiếu trận", Select bàn rỗng, không có "Thử lại".
- Literal lẫn giữa hằng đặt tên (thấp): `padding: 0 1mm` (`print.css:72`). Khoảng đệm màn hình `--sheet-screen-padding: 24px` (`print.css:9`) là px cho màn hình, không qua token.
- Stylesheet toàn cục (thấp, chưa render): `print.css` import ở trang (`match-sheets-print-page.tsx:8`) là CSS global của Vite. Sau khi đã mở trang in, `@page A4 portrait`, `.no-print` và `:root --sheet-*` còn hiệu lực cho các trang admin khác khi in trong cùng phiên.

### F. `match-score-drawer.tsx`, `match-action-bar.tsx`, `use-match-actions.ts`, `match-problem-alert.tsx`, `match-official-result.tsx`; `results-entry-page.tsx`, `use-results-schedule-filter.ts`
- Drawer: không khác mục F. Đã kiểm thứ tự nút, quyền, `useConfirmAction` cho Chốt + Hủy bắt đầu, 409 `MatchProblemAlert` + "Tải lại", `showWarnings`.
- Literal độ rộng mới (thấp–trung bình): hai Select mới "Session" / "Bàn" viết `minWidth: 200` / `minWidth: 140` (`results-entry-page.tsx:103,112`). Dòng F ghi literal của trang này là "lệch có sẵn, không chép"; ở đây lại thêm literal mới theo cùng kiểu.
- Nhãn session thiếu ngày (trung bình, dễ dùng): Select "Session" ở trang Nhập tỷ số liệt kê session **mọi ngày** với nhãn `S01 · 08:00–12:00` (`sessionOptionLabel`, `schedule-types.ts:55`). Giải nhiều ngày thì người dùng không phân biệt được. Tab lịch không bị vì đã chọn ngày riêng.
- Code (thấp, không phải giao diện): `startsAt` không có trong `SessionRecord`, được ép kiểu (`use-results-schedule-filter.ts:27-33`). API có trả (`apps/api/src/modules/sessions/session-view.ts:23`).

### G. `amend-scores-modal.tsx` / H. `reopen-preview-modal.tsx`
- Không khác checklist.
- `afterClose` không dùng, nhưng modal được mount có điều kiện nên state tự reset — tương đương.
- "Cưỡng chế mở lại" có thêm một xác nhận (`useConfirmAction`) — hợp với thao tác phá hủy, không coi là lệch.

## Đúng, nhưng không thuộc task này
- Drawer lỗi tải: nút "Tải lại" (`match-score-drawer.tsx:43`), trong khi 9 `Result status="error"` khác đều ghi "Thử lại". Đã có ở HEAD.

## Cả bộ (so cùng nhau)
- 5 tab hub: lỗi tải đều là `Result … Thử lại`; tải đều `Skeleton`.
- Hàng tiêu đề: entries + schedule dùng `Flex justify="space-between"`; draws dùng `Space` (đã chấp nhận ở phase 06).
- Panel trái: rộng `SIDE_MENU_WIDTH` ở cả 3 tab có panel.
- 5 hộp thoại phase 07: đều `width={640}` + `destroyOnHidden` + `cancelText="Hủy"`.
- Lý do bắt buộc: 3 hộp thoại cùng nhãn "Lý do", cùng extra, cùng cách báo "tối thiểu N ký tự".

## Chưa kiểm được
- Không render. Chưa thấy cỡ thật của lưới (cột 240 + panel 260), tràn ngang, khổ in A4 thật (2 phiếu/trang, `overflow: hidden` có cắt chữ không), vùng bấm, focus, tương phản.
- Chưa bấm thử luồng kéo-thả / 2-click với API thật.
- Không chạy typecheck/lint.
- Accessibility không đo theo chuẩn (checklist không nêu); chỉ báo theo họ.

Chi phí (ước lượng, gồm agent hiệu chỉnh): 3 bản sao + 22 trang/khối phase 07 so; khoảng 95 file mở (checker ~73, agent hiệu chỉnh ~22), khoảng 45 lệnh tìm/đọc (checker ~36, agent ~9).

Status: DONE_WITH_CONCERNS
