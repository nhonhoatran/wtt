# Phase A10 — Quy tắc điểm xếp hạng (admin)

Ngày: 2026-11-25. Spec: [phase-A10](../261125-0951-figma-ui-redesign-admin-client/phase-A10-admin-ranking-points-rules.md). Không đổi API/DB/schema.

## Đã làm
- Header trang, card bảng điểm kèm toolbar Đơn/Đôi, lỗi tại ô ("Nhập số điểm nguyên, từ 0 trở lên"), ô đã sửa nền vàng + "trước: n", thanh chưa lưu dính đáy ("N thay đổi chưa lưu · M ô cần sửa", Lưu khoá khi còn lỗi), nút "Huỷ thay đổi" có xác nhận.
- Card thời hạn hiệu lực theo từng BXH (phân trang server, link "Sửa" tới `/ranking-lists/:id/edit`).
- Màu Tag cột lấy `colorHex` hạng giải từ catalog `event-types`. Hạng giải đã ẩn còn quy tắc vẫn hiện cột, Tag ghi "(đã ẩn)".
- Giữ: chép cột, modal lưu có ngày hiệu lực, guard rời trang. Không có "Khôi phục mặc định", "Thêm vòng đấu" (Q12).
- Nhãn hàng bỏ mã kỹ thuật; `aria-label` ô giữ mã để selector E2E cũ chạy.

## File
- Sửa: `apps/admin/src/pages/ranking/ranking-rules-{matrix-page,grid,cell,state}.ts(x)`, `use-ranking-rules-matrix.ts`, `apps/admin/test/ranking-rules-state.test.mjs`, `apps/client/tests/admin-full-flow/rankings.ts` (nút "Lưu" → "Lưu thay đổi").
- Tạo: `ranking-rules-toolbar.tsx`, `ranking-rules-unsaved-bar.tsx`, `ranking-validity-card.tsx`, `ranking-rules-cell.module.css`.

## Kiểm
- Admin typecheck, lint sạch; test 56/56; build đạt (cảnh báo chunk có từ trước).
- Trình duyệt (Vite 5173 + API DB test), 1280/390: tràn 0; `-5` báo lỗi và khoá Lưu; `1.5` làm tròn 2; 3 ô sửa → "3 thay đổi chưa lưu"; đổi Đơn→Đôi khi đang sửa hiện guard; Huỷ có xác nhận; console chỉ 401 trước đăng nhập. Không lưu quy tắc nào vào DB test.

## Chưa kiểm / câu hỏi
- DB test chưa có quy tắc Đơn/nhánh chính và BXH Đơn: chưa thấy "trước: 320" với số thật và dòng "Sửa" của card thời hạn.
- Spec ghi Segmented "Vòng chính/Vòng loại"; giữ lựa chọn hiện có gồm cả "Vòng bảng" vì API có `GROUP`.
- Chưa chạy lại suite E2E admin-full-flow sau khi đổi selector.
