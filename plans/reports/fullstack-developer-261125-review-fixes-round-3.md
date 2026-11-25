# Sửa phát hiện review vòng 3 (A7/A8/A9/C6/C7/A2) — 2026-11-25

Nguồn: `plans/reports/code-reviewer-261125-figma-phases-A7-A8-A9-C6-C7.md`. Không commit, không migration, không đụng `apps/client` ngoài `tests/admin-full-flow/**`.

## Đã sửa

| Mã | Thay đổi |
|---|---|
| M1 | `apps/client/tests/admin-full-flow/schedule-and-withdraw.ts:21`: selector đổi sang `getByText(/^Trận chưa xếp lịch/)`. Rà các file admin-full-flow còn lại: đối chiếu 66 chuỗi chính xác + các regex/mẫu với nguồn `apps/admin/src`, chỉ "Điểm từng ván" không có ở admin vì là bảng của trang công khai (đúng). `draws.ts`, `results.ts` đã được cập nhật từ trước. Không có selector nào khác bị gãy. |
| M2 | Helper mới `apps/admin/src/pages/event-hub/table-display-name.ts` (`tableDisplayName`, `matchTableLabel`): dùng `displayName` nguyên văn, chỉ khi rỗng mới "Bàn {code}". API trả `tableName = displayName ?? code` nên `matchTableLabel` coi `tableName === tableCode` là chưa có tên và thêm "Bàn". Dùng ở `match-when-text.ts`, `results-match-columns.tsx` (dòng tóm tắt điện thoại) và `pending-matches-table.tsx` (bỏ `tableText` ở `pending-match-status.ts`). Cột "Bàn" của bảng kết quả giữ nguyên. Test mới `apps/admin/test/table-display-name.test.mjs`; test cũ `pending-match-status.test.mjs` bỏ phần `tableText`. |
| M3 | `draws-tab.tsx`: `overview.isError` thì hiện `Result` lỗi + nút "Thử lại", không render `DrawPanel`, ẩn luôn hàng nút "đi tới phần". |
| M4 | `docs/auth-and-rbac.md`: nguồn thêm `public-site-display-settings.ts`, `dashboard-settings.ts`; thêm 7 key (`dashboard.liveEventLimit`, `dashboard.recentActivityLimit`, `site.name`, `site.nav.items`, `site.socialLinks`, `site.tagline`, `site.registrationUrl`); bảng các kiểu editor (`bilingual-text`, `nav-items`, `social-links`, `text.optional`, `json`...). `docs/draws-and-groups.md`: dòng API + mục "Đổi chỗ thành viên vòng bảng (nháp)" (quyền, body, hành vi trận đã sinh, mã lỗi). `docs/system-architecture.md`: dòng module `dashboard` (2 endpoint, quyền `tournaments.list` / `matches.list`). |
| L1 | `group-card.tsx`: `theme.useToken().token.colorWarning` thay `var(--ant-color-warning)`. |
| L2 | `match-score-drawer.tsx`: đóng drawer (X, Esc, mask) khi có tỷ số chưa lưu hỏi "Bỏ tỷ số đang nhập?" (nút "Bỏ và đóng"), dùng chung hàm `guarded` với Trận trước/sau. |
| L3 | `encodeURIComponent` cho `/admin/events/${chosen}` (`use-results-event.ts`) và `/admin/matches/${matchId}` (`match-score-drawer.tsx`). |
| L4 | Xem mục Tagline. |
| L7 | Banner trùng giờ ghi "... trong buổi này" (`schedule-status-bar.tsx`). |
| L9 | `draw-panel.tsx`: câu "Kiểm tra rồi bấm Công bố..." chỉ hiện khi có quyền cập nhật và nhánh chưa khóa. |
| L11 | Bỏ `sessionOptionLabel` không dùng (`schedule-types.ts`); sửa `roundFormatBody =z.object(` trong `apps/api/.../draw-dtos.ts`. |

### Tagline
- `packages/shared/src/public-site-display-settings.ts`: `taglineSchema` thêm `.refine` — khác `null` thì `vi` và `en` (sau trim) đều không rỗng; thông báo bằng tiếng Việt.
- Editor `bilingual-text-setting-editor.tsx`: nullable và cả hai ô chỉ có khoảng trắng thì gửi `null` (hết trường hợp lưu `{'' ,''}`).
- Test shared mới trong `public-site-display-settings.test.ts` (một ngôn ngữ, cả hai rỗng, khoảng trắng, hợp lệ có trim).
- E2E `apps/api/test/public-site.e2e-spec.ts` (mục display settings): PUT đủ hai ngôn ngữ 200 và hiện ở `/public/site`; `{vi, en:''}` và `{vi:'  ', en}` đều 422, giá trị cũ giữ nguyên.

### A9 follow-up: seed ở khối đối đầu
- API không cần sửa: `ENTRY_BRIEF_SELECT` / `toEntryBrief` (`apps/api/src/modules/matches/match-view.ts`) đã trả `seed`, và `toMatchResultItem` / `toMatchDetail` dùng lại — nhận định "API không trả seed" trong báo cáo A9 không đúng với code hiện tại. Không thêm trường nào.
- E2E mới trong `apps/api/test/match-results.e2e-spec.ts`: "returns the entry seed on each side of a listed match and of its detail" — so `seed` ở danh sách và chi tiết với `Entry.seed` trong DB (có ít nhất một bên có seed).
- UI: `EntryBrief.seed?` (`match-types.ts`), `match-versus-panel.tsx` hiện " [seed]" sau tên khi seed có giá trị. Chưa xem trực quan được vì dữ liệu thử trên DB không có trận có VĐV seed trong danh sách mở.

## Để lại (không sửa)
- L5 (số truy vấn dashboard, `round.name`): đã khai ở A2, không sai kết quả.
- L6 (`?round` dùng chung các section): thuộc `apps/client`, đang do phase C9 sửa; cần quyết định có tách param từng section hay không.
- L8 (swap vòng bảng không cảnh báo xung đột lịch tại chỗ): đã ghi vào docs; cần thiết kế UI riêng.
- L10 (tải trang kế hai lần trong drawer): tối ưu, không sửa lúc này.
- L11 phần client: `bracket-derivations.ts:126` `isSettled =(`, `bracket-print.test.ts` 208 dòng, trùng khóa `bracket.tableCode`/`schedule.tableCode` — nằm trong `apps/client`, cấm đụng.

## Kiểm chứng (đã chạy thật)
- Root `pnpm typecheck`: 14/14 task OK. Root `pnpm lint`: 9/9 task OK.
- `packages/shared` `pnpm test`: 25 file / 121 test pass.
- `apps/admin` `pnpm test`: 98 test pass, 0 fail.
- API test qua wrapper (dòng đầu log xác nhận `localhost:5433/kamito_tt_phase12_test`), từng file một: `public-site.e2e-spec.ts` 9/9 pass; `match-results.e2e-spec.ts` 11/11 pass (gồm test seed mới); `draw-group-member-swap.e2e-spec.ts` 5/5 pass. Dist của `@kamito/shared` được turbo dựng lại trong lúc `pnpm typecheck` (mtime 12:38) nên API test thấy schema mới (test 422 tagline pass).
- Trình duyệt (Playwright, admin Vite :5173 đang chạy sẵn, API :3000 dùng chung, không khởi động/dừng tiến trình nào), script `scratchpad/fix3/check.mjs`:
  - M2: bàn `displayName "Bàn 1"` hiện "Bàn 1 · ..."; `tableName = code` hiện "Bàn T1 · ..."; "Sân chính" hiện nguyên văn. Không còn "Bàn Bàn".
  - L2: nhập "11" vào ván 1 rồi Esc: hộp "Bỏ tỷ số đang nhập?" hiện (ảnh `scratchpad/fix3/drawer-close-confirm.png`), drawer vẫn mở; bấm "Bỏ và đóng" thì đóng; drawer sạch đóng ngay không hỏi.
  - M3: chặn route `/admin/events/*/draws`: hiện "Không tải được trạng thái bốc thăm" + 1 nút "Thử lại", 0 nút "Bốc thăm", 0 chữ "Chưa bốc thăm" (ảnh `scratchpad/fix3/draws-error.png`).
- Thay đổi API chỉ có test và khoảng trắng nên không cần chạy API riêng cổng ≥ 3070.

## Không chạy được
- `pnpm build` / `vite build` của admin và `pnpm build` của shared chạy tay: hook chặn lệnh chứa chữ "build". Typecheck `tsc --noEmit` của admin nằm trong `pnpm typecheck` (OK) nên lỗi kiểu đã được phủ; chưa kiểm bundling Vite. Dist shared được dựng gián tiếp qua turbo.
- E2E Playwright admin-full-flow (M1): chưa chạy, chỉ sửa selector và đối chiếu tĩnh.
- Không chạy toàn bộ test API, chỉ 3 file nói trên.
- `matchInfoLine` (`match-when-text.ts`) không có unit test riêng vì import không có đuôi `.ts` nên `node --test` không nạp được; đã test helper `matchTableLabel` và kiểm bằng trình duyệt.

## Câu hỏi mở
- `?round` riêng cho từng section nhánh (L6): chờ quyết định.

**Status:** DONE_WITH_CONCERNS
**Summary:** Sửa M1-M4, L1-L4, L7, L9, L11 (phần admin/api), tagline hai ngôn ngữ ở zod, seed ở khối đối đầu (API đã có sẵn nên chỉ thêm e2e và UI). Typecheck, lint, test shared/admin, 3 file API qua wrapper và kiểm trình duyệt đều xanh.
**Concerns:** Không chạy được build (hook chặn) và e2e admin-full-flow; [seed] chưa thấy trực quan; L5, L6, L8, L10 và phần client của L11 để lại.
