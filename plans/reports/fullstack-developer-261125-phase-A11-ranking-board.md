# Báo cáo phase A11 — Trang "Bảng xếp hạng" (/rankings)

Ngày: 2026-11-25. Trạng thái: DONE_WITH_CONCERNS (xem mục Lưu ý).

## Đã làm
API (không đổi schema):
- `GET /admin/ranking-snapshots/:id/summary` (`rankings.read`) -> `{ rows, changed, newcomers, expiredPoints, previous }`. Kỳ trước = snapshot PUBLISHED mới nhất cùng BXH có `asOfDate` nhỏ hơn. Điểm hết hạn = tổng ledger có `expiresAt` trong (asOf kỳ trước, asOf kỳ này]. Không có kỳ trước: `newcomers=0`, `expiredPoints=0`, `previous=null`.
- `GET .../:id/rows`: thêm `player.club`, `previousPoints` mỗi dòng (1 truy vấn `in` theo trang), `q` khớp thêm CLB, `filter[changed]=true` (movement khác 0, cộng VĐV mới nếu có kỳ trước; giá trị khác true/false -> 400).
- File mới: `ranking-snapshot-previous.ts`, `ranking-snapshot-summary.service.ts`.

Admin:
- `/rankings` (`?list=`): pill BXH (Select có tìm nếu hơn 6), tag Tạm tính/Đã chốt, phụ đề kỳ, 4 KPI, ô tìm (debounce, server) + Switch "Chỉ hiện VĐV có thay đổi" + "Đặt lại", bảng server-side có expand "chi tiết điểm".
- "Chốt bảng kỳ này": hộp xác nhận nêu số VĐV, số đổi hạng/mới, hệ quả không hoàn tác -> nhập lại mật khẩu (step-up) -> công bố. Khoá khi còn nội dung chưa tính lại; có "Tính lại ngay". Xử lý `RANKING_SNAPSHOT_STALE`.
- Chưa có bản nháp (hoặc bản hiện hành đã chốt): nút "Tạo bản tạm tính" mở modal đã chọn sẵn BXH.
- "Xuất Excel" ẩn (Q4). "Lịch sử các kỳ" = link `/ranking-snapshots` đã lọc theo BXH.
- Menu: "Bảng xếp hạng" -> `/rankings`; danh mục BXH đổi nhãn "Danh mục BXH", chuyển sang nhóm Cấu hình.

## Files
Tạo (API): `apps/api/src/modules/ranking-snapshots/ranking-snapshot-previous.ts`, `ranking-snapshot-summary.service.ts`.
Sửa (API): `ranking-snapshots-query.service.ts`, `admin-ranking-snapshots.controller.ts`, `ranking-snapshots.module.ts`, `apps/api/test/ranking-admin-snapshots.e2e-spec.ts`.
Tạo (admin): `apps/admin/src/pages/ranking/` `ranking-board-page.tsx`, `ranking-board-actions.tsx`, `ranking-board-stats.tsx`, `ranking-board-table.tsx`, `ranking-board-labels.ts`, `use-current-snapshot.ts`; `apps/admin/test/ranking-board-labels.test.mjs`.
Sửa (admin): `ranking-routes.tsx`, `snapshot-movement-cell.tsx` (dòng "kỳ trước: hạng x", chế độ không so sánh được), `snapshot-draft-modal.tsx` (prop `defaultListIds`), `apps/admin/src/layout/menu-groups.ts` (chỉ 2 dòng menu).

## Kiểm chứng
- API e2e (bọc, DB `localhost:5433/kamito_tt_phase12_test`): `ranking-admin-snapshots.e2e-spec.ts` 4/4 pass. Thêm ca: summary có/không kỳ trước, expiredPoints (biên asOf kỳ trước bị loại), changed filter + giá trị sai, q theo CLB, previousPoints.
- `tsc --noEmit` apps/api: 1 lỗi có sẵn, không thuộc A11 (`playerSlugs` ở `venue-tables.service.ts` / `catalog-display-tags.test.ts`, thay đổi của phase khác).
- Admin `pnpm typecheck && pnpm lint && pnpm test && pnpm build`: exit 0, 65/65 test pass (7 mới), build xong.
- Trình duyệt (Vite 5173 + API 3000 sau khi API khởi động lại có code mới, không còn stub dữ liệu): BXH nháp có kỳ trước: KPI, cột CLB/điểm kỳ trước/chênh lệch (+7200), toggle -> request `filter[changed]=true`, tìm không có kết quả hiện Empty, Đặt lại, expand breakdown, sort; BXH chỉ có bản đã chốt: tag Đã chốt, KPI so sánh "—", switch khoá, nút "Tạo bản tạm tính" mở modal đã chọn BXH; "Lịch sử các kỳ" lọc đúng BXH. 1280 và 390: không tràn ngang. Ảnh: `scratchpad\a11\*.png`.
- Chốt bảng: chỉ stub endpoint `publish` (trả 403 STEP_UP_REQUIRED) để xem hộp xác nhận + hộp mật khẩu; không công bố/xóa gì trong DB test. Lỗi console duy nhất là dòng 403 do stub này.

## Lưu ý
- Lần chạy đầu API cũ: `/auth/me` thiếu `siteName` làm sider (A1) crash; đã stub `me` tạm thời, sau khi API khởi động lại thì không cần nữa.
- Chưa chạy đường công bố thật (đã có e2e cho publish hiện hữu).
- Danh sách CLB trong cột chỉ có 53/90 VĐV test có CLB; còn lại hiện "—".
- Không kill tiến trình nào.
