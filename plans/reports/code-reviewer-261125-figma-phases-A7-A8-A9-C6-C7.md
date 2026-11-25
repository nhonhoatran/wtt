# Review phase A7 (+ swap vòng bảng), A8, A9, C6, C7, A2 — 2026-11-25

Baseline HEAD `b35dfd3`, review thay đổi chưa commit. Không lặp lại các phát hiện ở `code-reviewer-261125-*.md` trước đó. C8 (chi tiết trận / tab Trận / match-card phần C8) nằm ngoài phạm vi.

## Đã chạy (thật)
- Root `pnpm typecheck`: 14/14 task OK (exit 0).
- Root `pnpm lint`: 9/9 task OK (exit 0).
- `apps/admin` `pnpm test` (node --test): pass hết, 0 fail.
- `apps/client` `pnpm test`: 31 file / 156 test pass. `pnpm test:print`: 2 file / 9 test pass.
- KHÔNG chạy: test API, root `pnpm test`, e2e Playwright, bất kỳ lệnh nào chạm DB.
- vi.json / en.json: so khóa bằng script — không thiếu khóa bên nào, không có chuỗi rỗng.

## Tổng quan
Chất lượng nhìn chung tốt: API swap đúng thứ tự khóa (SubEvent → Draw), có version, audit, quyền; UI giữ server-side; dữ liệu công khai không thêm trường mới, không dữ liệu giả; bracket có chữ ẩn "Người thắng:", pill có chữ, `?round` lọc chặt. Không có lỗi High. Các lỗi dưới đây chủ yếu là hiển thị sai, e2e sẽ gãy, và docs lệch.

## High
Không có.

## Medium

M1. E2E admin-full-flow sẽ gãy ở tab Lịch — `apps/client/tests/admin-full-flow/schedule-and-withdraw.ts:21` tìm `getByText('Trận chưa xếp', { exact: true })`, nhưng tiêu đề card đã đổi thành `Trận chưa xếp lịch (N)` (`apps/admin/src/pages/event-hub/unscheduled-panel.tsx:98`). Kịch bản: chạy `test:e2e` admin-full-flow → locator `unscheduled` rỗng → `match.innerText()` timeout. Báo cáo A8 ghi "selector còn nguyên" là chưa đúng. Sửa: đổi selector sang regex `/^Trận chưa xếp lịch/`.

M2. Nhãn bàn bị lặp chữ "Bàn" ở admin — `apps/admin/src/pages/dashboard/pending-match-status.ts:37` (`Bàn ${displayName ?? code}`) và `apps/admin/src/pages/results/match-when-text.ts:36` (`Bàn ${tableName ?? tableCode}`). `displayName` đã là nhãn đầy đủ (lưới lịch dùng nguyên `displayName`, `schedule-types.ts:49`; test API có `displayName: 'Bàn 1'`, `apps/api/test/venues.e2e-spec.ts:93`). Kịch bản: venue có bàn `displayName = "Bàn 1"` → bảng Tổng quan và đầu drawer nhập tỷ số hiện "Bàn Bàn 1"; bàn "Sân chính" thành "Bàn Sân chính". Sửa: `displayName ?? \`Bàn ${code}\`` (giống client `bracket-match-cell.tsx:147`, `match-card.tsx`), gom vào một helper dùng chung.

M3. Tab Bốc thăm hiện trạng thái "Chưa bốc" + nút "Bốc thăm" khi tải overview lỗi — `apps/admin/src/pages/event-hub/draws-tab.tsx:54,85-88`: khi `overview.isError`, `draws = []` nên mọi `DrawPanel` rơi vào nhánh `!ref` (`draw-panel.tsx:54-69`). Kịch bản: API `/admin/events/:id/draws` lỗi tạm → người dùng thấy cảnh báo vàng nhưng bên dưới vẫn là "Chưa bốc thăm" với nút chính "Bốc thăm" cho nội dung đã có draw; bấm vào mở wizard và chỉ bị chặn ở API (409) hoặc tệ hơn là sinh lại. Sửa: khi `overview.isError` thì không render panel (chỉ Alert + Thử lại).

M4. Docs lệch với code (không có lỗi runtime, nhưng tài liệu là nguồn tra quyền/setting):
- `docs/auth-and-rbac.md:183-215`: bảng key setting thiếu `dashboard.liveEventLimit` (5, 1–20, giải) và `dashboard.recentActivityLimit` (6, 0–20, dòng); danh sách nguồn chưa có `dashboard-settings.ts`; không nhắc editor mới (`bilingual-text`, `nav-items`, `social-links`, `text.optional`) và việc `site.name` hết là JSON thô.
- Không có tài liệu cho `GET /admin/dashboard/summary` (`tournaments.list`) và `GET /admin/dashboard/pending-matches` (`matches.list`).
- `docs/draws-and-groups.md:81` chỉ có `POST /draws/:id/swap`; thiếu `POST /draws/:id/swap-group-members` (quyền, body, mã lỗi `KIND_NOT_ALLOWED` / `ENTRY_NOT_IN_DRAW` / `INVALID_PARAMS`, hành vi hoán trận đã sinh).

## Low

L1. Viền vàng "Trùng CLB" không hiện — `apps/admin/src/pages/event-hub/group-card.tsx:65` dùng `var(--ant-color-warning)`, nhưng antd là 5.29.3 (`apps/admin/package.json:31`) và theme không bật `cssVar` (grep `cssVar` trong `packages/ui-tokens` và `apps/admin/src`: 0 kết quả) → biến CSS không tồn tại, viền giữ màu mặc định. Tag "Trùng CLB" vẫn có nên không mất thông tin. Sửa: `theme.useToken().token.colorWarning`.

L2. Đóng drawer nhập tỷ số làm mất tỷ số đang nhập không hỏi — `apps/admin/src/pages/results/match-score-drawer.tsx:77` (`onClose={onClose}`), trong khi Trận trước/sau đã hỏi (`:51-60`). Có sẵn từ trước, nhưng giờ hành vi không nhất quán; Esc của Drawer cũng đóng luôn. Sửa: dùng chung `dirty.current` cho `onClose`.

L3. Tham số URL đưa thẳng vào đường dẫn API — `apps/admin/src/pages/results/use-results-event.ts` (`/admin/events/${chosen}`, `chosen` nay lấy từ `?event=`) và `match-score-drawer.tsx` (`/admin/matches/${matchId}` từ `?match=`). Không `encodeURIComponent`. Kịch bản: link `/results?event=../users` khiến trình duyệt của người bấm gọi GET một endpoint admin khác (chỉ GET, cùng phiên, kết quả chỉ hiện cho chính họ) → rủi ro thấp, nhưng nên encode như hub (`use-event-progress.ts:25`).

L4. Tagline: editor chặn "chỉ một ngôn ngữ" nhưng zod cho phép — `apps/admin/src/pages/settings-editors/structured-setting-validation.ts:28-29` vs `packages/shared/src/public-site-display-settings.ts` (`taglineSchema` cho `vi`/`en` rỗng). Nếu đây là quy tắc nghiệp vụ thì nên đặt trong zod (nguồn sự thật), không chỉ ở UI. Thêm: nhập toàn khoảng trắng ở cả hai ô của editor nullable → validator cho qua (trim rỗng), giá trị gửi lên là `{vi:' ', en:' '}` (không phải `null`) → zod trim thành `{vi:'', en:''}` được lưu, footer có thể render đoạn rỗng (`bilingual-text-setting-editor.tsx:18` chỉ so chuỗi chưa trim).

L5. Dashboard summary: 2 lần đọc setting + 1 truy vấn sự kiện + transaction 4 phép = vượt "≤ 4 truy vấn" của spec (đã khai trong báo cáo A2). Không lỗi đúng/sai; `pending-matches` không trả `round.name` như spec dòng 24 (UI dùng `roundTitle(code)` nên không thiếu hiển thị).

L6. `?round` dùng chung cho mọi section của nhánh — `bracket-board.tsx:41,49`: nhánh nhiều section (`many`) mà mỗi section có chip riêng cùng một param; bấm chip ở section 1 đổi luôn vòng của section 2 (nếu có số vòng đó). Hiếm gặp; chấp nhận được nếu ghi chú.

L7. Banner trùng giờ chỉ đếm trên dữ liệu lưới của buổi đang xem; khi lưới bị `truncated` thì có thể đếm thiếu (`schedule-status-bar.tsx:22-23`). Ghi rõ "trong buổi này" trong nhãn là đủ.

L8. Swap vòng bảng: trận nháp đã xếp lịch được hoán VĐV mà không báo trước xung đột lịch (`group-member-swap.service.ts:45-55`). Xung đột tính lúc đọc (`scheduling/schedule-conflict.service.ts`) nên sẽ hiện ở tab Lịch sau đó — không hỏng dữ liệu, chỉ thiếu cảnh báo tại chỗ.

L9. Alert nháp hiện "Kiểm tra rồi bấm Công bố…" cả cho người không có quyền cập nhật (`draw-panel.tsx:105`).

L10. Điều hướng sang trang kế trong drawer tải trang hai lần: `list.fetchPage` ngoài cache rồi `setPage` làm query chạy lại (`results-workspace.tsx:46-51`). Có thể dùng `queryClient.fetchQuery` với cùng key.

L11. Dọn nhỏ:
- `sessionOptionLabel` (`schedule-types.ts:54`) không còn nơi dùng sau khi đổi toolbar.
- `apps/api/src/modules/draws/draw-dtos.ts`: `roundFormatBody =z.object(` (thiếu khoảng trắng); `apps/client/src/lib/bracket-derivations.ts:126` `isSettled =(`.
- Trùng khóa `bracket.tableCode` và `schedule.tableCode` ("Bàn {code}") và trùng logic nhãn bàn ở `match-card.tsx` / `bracket-match-cell.tsx:147`.
- `apps/client/tests/offline/bracket-print.test.ts` 208 dòng (> 200, file test).

## Kiểm tra theo trọng tâm

| Trọng tâm | Kết quả |
|---|---|
| Swap API: transaction, version, quyền, audit | Đạt. `loadDrawLocked` (SubEvent → Draw, `FOR UPDATE`, so version) trong một `$transaction`; `@RequirePermission('tournaments','update')`; audit `draw.swapGroupMembers` trong cùng tx; nhãn audit có (`audit-log-labels.ts:33`). |
| Swap: trận đã sinh + BXH | Đạt. `Match.groupId` giữ nguyên, VĐV đổi `groupId/slot` và nhận lại lịch của nhau → mỗi bảng vẫn đúng cặp; `GroupStanding` (draft toàn 0) đi theo; không có unique `(groupId, slot)` nên đổi slot không đụng ràng buộc. Ghi trận nháp bị chặn ở `match-lock.ts:18` (cần PUBLISHED) nên không có race với nhập kết quả. |
| Xác nhận công bố / bỏ công bố | Đạt. Hộp công bố nêu hậu quả; bỏ công bố vẫn qua `DrawEntryActionModal` có sẵn. |
| Lịch: kéo bàn phím, xung đột | Giữ nguyên id draggable/droppable và sensor; ô lỗi có `tabIndex` + `data-schedule-conflict` nên "Đến ô đầu tiên" focus được. Xem L7, M1. |
| Nhập kết quả theo thể thức | Đạt. `validateMatchScore` + gợi ý dựng từ `pointsPerGame/winBy`; nút xác nhận disabled kèm lý do; `submit` chặn lại theo `canConfirm/canEnter/outcome.valid`. |
| OFFICIAL / Mở lại / RESULTS_OPERATOR | Không đổi `use-match-actions.ts`; quyền vẫn qua `useCan`; tab hub "Kết quả" lọc theo `matches.list`. |
| Làm mới tiến độ | Draw/lịch: qua `WRITE_SIGNAL_ROOTS` (`use-event-progress.ts:14-20`). Kết quả không nằm trong signal, nhưng tiến độ hub không hiển thị `official` nên không lệch. |
| Deep link "Nhập" của A2 vs A9 | Khớp: `resultsLink` → `/results?event=&match=` (encode), A9 đọc `?event=` trước localStorage và mở `?match=`; trận khác giải → cảnh báo + đóng. Nếu trận không nằm ở trang đầu của bộ lọc thì drawer vẫn mở nhưng không có thanh Trận i/N (chấp nhận). |
| Dashboard: "hôm nay" theo múi giờ, loại BYE/voided/nháp | Đạt. `pickOngoing` theo `todayInTimezone` từng giải; `session.date` = ngày địa phương; `DASHBOARD_MATCH_BASE` loại voided, BYE, draw chưa PUBLISHED; `$queryRaw` dùng `Prisma.join` (có tham số). |
| Dashboard RBAC | Summary `tournaments.list`, pending `matches.list`; UI chỉ gọi audit-logs khi có `audit-logs.list` và limit > 0. |
| Settings: zod là nguồn sự thật, dirty/leave-guard | Zod không đổi (chỉ đổi `editor`); dirty so `JSON.stringify(stable())`, editor nav xóa khóa nhãn rỗng nên không "bẩn giả". Xem L4. |
| Trang công khai: whitelist, cache, không dữ liệu giả | Đạt. Không thêm trường API; tổng quan gọi `getMatches(slug,'?state=live|upcoming',false)` cùng key với tab Trận; `mapUrl` chỉ https (lọc ở API); khối rỗng bị ẩn. |
| Bracket a11y | Đạt: chữ ẩn "Người thắng:", "Hạt giống", pill có chữ, link "Chi tiết" có `aria-label` đầy đủ; bảng đấu giữ `caption/scope`, "Đi tiếp" có chữ ẩn. |
| `?round` | `parseRoundParam` chỉ nhận `^[1-9]\d{0,3}$`, mảng/sai → vòng mặc định; `pickRound` kiểm vòng có trong section. Xem L6. |
| In | `@media print` ép hiện mọi cột, ẩn chip/legend; `test:print` 9/9. |
| File < 200 dòng | Đạt với code (lớn nhất 171 dòng `session-grid-cell.tsx`); ngoại lệ là json i18n và 1 file test (L11). |

## Việc nên làm (theo thứ tự)
1. M1: sửa selector e2e `Trận chưa xếp lịch`.
2. M2: helper nhãn bàn dùng chung (`displayName ?? "Bàn {code}"`) cho dashboard + drawer.
3. M3: không render panel draw khi overview lỗi.
4. M4: cập nhật `docs/auth-and-rbac.md`, `docs/draws-and-groups.md`, thêm mục API dashboard (giao docs-manager).
5. L1, L2, L3 (sửa nhỏ, rẻ).
6. Còn lại để dọn khi tiện.

## Câu hỏi mở
- Tagline "phải đủ hai ngôn ngữ" có phải quy tắc nghiệp vụ không? Nếu có thì nên chuyển vào `taglineSchema` (zod).
- Nhánh nhiều section: có cần `?round` riêng từng section không, hay chấp nhận dùng chung?

**Status:** DONE_WITH_CONCERNS
**Summary:** Không có lỗi High; 4 Medium (e2e lịch sẽ gãy do đổi tiêu đề, "Bàn Bàn 1" ở dashboard/drawer, panel bốc thăm hiện nút "Bốc thăm" khi overview lỗi, docs lệch) và 11 Low. Typecheck/lint gốc, test admin, test + test:print client đều xanh.
**Concerns:** Chưa chạy e2e/API test (theo yêu cầu); M1 chắc chắn làm gãy admin-full-flow khi chạy.
