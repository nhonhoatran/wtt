# Nợ còn mở — cập nhật 2026-11-25

Danh sách việc dời lại sau lượt CI + audit admin ngày 2026-11-24. Làm xong mục nào thì gạch và ghi commit/bằng chứng.

Lượt 2026-11-25 (chưa commit) xử lý mọi mục làm được ở local, kiểm trên trình duyệt với `localhost:5433/kamito_tt_phase12_test` (dữ liệu thử gắn tag, dọn sau khi kiểm). Còn mở: S1, S2, T2, D1, D2. Code review: [code-reviewer-261125-open-debts-admin.md](../reports/code-reviewer-261125-open-debts-admin.md).

Nguồn: [audit UI 1440/390](./reports/ui-audit-261124-admin-1440-390.md), [code review](./reports/code-reviewer-261124-ci-and-admin-mobile.md), [phase 07](./phase-07-scheduling-sessions-tables-and-result-entry.md) mục "Việc còn mở".

## Chặn staging (chờ bên ngoài)

| # | Việc | Chờ ai | Ghi chú |
|---|---|---|---|
| S1 | Trả lời checklist hạ tầng | Chủ hạ tầng | [infra-preflight-checklist-261124.md](./reports/infra-preflight-checklist-261124.md) |
| S2 | Câu hỏi G1/G2/consent | BTC | Phase 12, mục "Câu hỏi chưa giải quyết" |

## Admin UI

| # | Mức | Việc | Vị trí | Ghi chú |
|---|---|---|---|---|
| ~~U1~~ | Trung bình | ~~Kiểm kéo thả nhà tài trợ trên trình duyệt~~ | `sponsors-tab.tsx` | Đạt 2026-11-25 với 4 nhà tài trợ thử: kéo chuột giữ trục dọc (`translate3d(0, 159px)`, mép trái hàng = mép bảng 264 px), thứ tự lưu đúng; bàn phím Space → ↑ → Space đổi chỗ, vùng thông báo đọc tiếng Việt |
| ~~U2~~ | Trung bình | ~~Màu focus theo thương hiệu~~ | `packages/ui-tokens/src/antd-theme.ts` | Xong 2026-11-25: focus dùng xanh navy `#0F285D` (không dùng đỏ thương hiệu để khỏi lẫn với lỗi). Ô nhập viền navy + bóng 2 px; nút outline `solid 2px rgb(15, 40, 93)`. Test `build-css-variables.test.ts` |
| ~~U3~~ | Thấp | ~~Cảm biến bàn phím cho kéo thả lịch~~ | `schedule-keyboard-drag.ts`, `schedule-tab.tsx` | Xong 2026-11-25: Space nhấc trận, mũi tên nhảy tới ô gần nhất theo hướng, Space/Enter thả, Esc hủy; Enter giữ nghĩa chọn-rồi-đặt cũ. Test `apps/admin/test/schedule-keyboard-drag.test.mjs` 6/6 |
| ~~U4~~ | Thấp | ~~Trang Cài đặt: nhắc khi còn thay đổi chưa lưu~~ | `settings-page.tsx`, `ranking-rules-unsaved-guard.ts` | Xong 2026-11-25: tab có chấm cam, cạnh nút Lưu có dòng "Có thay đổi chưa lưu"; đổi tab không hỏi (state giữ nguyên); rời trang hỏi "Ở lại / Bỏ thay đổi" (1 hộp thoại). Thẻ trong tab bỏ tiêu đề trùng tên tab |
| ~~U5~~ | Thấp | ~~Drawer menu tự mở lại; thiếu tên~~ | `admin-layout.tsx` | Xong 2026-11-25: đóng khi qua breakpoint lg (0 drawer mở sau resize), `aria-label="Menu quản trị"` |
| ~~U6~~ | Thấp | ~~Nút tạo và kiểu quay lại chưa thống nhất~~ | `components/crud-page.tsx`, `components/back-link.tsx` | Xong 2026-11-25: trang tạo/sửa có link "← <tên danh sách>" về đúng danh sách (thay nút mũi tên quay lại lịch sử trình duyệt); nút tạo có icon + và chữ "Thêm …" ("Tạo giải" → "Thêm giải", "Viết bài" → "Thêm bài viết"); 4 trang riêng dùng `BackLink` |
| ~~U7~~ | Thấp | ~~Cảnh báo `ColorPicker disabledAlpha`~~ | `color-hex-field.tsx` | Xong 2026-11-25: antd coi giá trị rỗng là màu trong suốt; chỉ khoá alpha khi có giá trị |
| ~~U8~~ | Thấp | ~~Cảnh báo Refine `useForm` edit thiếu `id`~~ | 6 file trang sửa | Xong 2026-11-25: truyền `id` từ `useParams()` |
| ~~U9~~ | Thấp | ~~Cảnh báo antd "useForm not connected"~~ | `components/form-instance-host.tsx` | Xong 2026-11-25. Hai nguồn, kiểm bằng stack: (1) `useTable` của Refine gọi `getFieldsValue` trên search form không gắn `<Form>`; (2) `useForm` của Refine gọi `resetFields` khi trang sửa nội dung còn hiện Skeleton. Gắn form vào `<Form component={false}>` (không render DOM) |
| ~~U10~~ | Thấp | ~~Cảnh báo "There may be circular references"~~ | `session-form-modal.tsx:66` | Xong 2026-11-25. Không do dayjs: chỉ xuất hiện khi giải có địa điểm có bàn. `setFieldValue` của rc-field-form gán mảng lỗi mới, còn field chưa đụng dùng chung một mảng rỗng, nên `isEqual` của rc-util báo vòng lặp giả. Đổi sang `setFieldsValue`; bàn vẫn tự điền đủ |
| ~~U11~~ | Thấp | ~~Nhảy 76 px khi mở hộp thoại~~ | — | Đóng 2026-11-25: vị trí nút trước/sau mở modal giữ nguyên (756, 412), body 1440 px |

## Chưa audit

| # | Việc | Lý do |
|---|---|---|
| ~~A1~~ | ~~Trang sửa bài viết, video, trang tĩnh, nhà tài trợ; chi tiết hộp thư liên hệ~~ | Đạt 2026-11-25 ở 1440/390: tràn 0, lỗi 0. Drawer liên hệ 560 px ở 1440, toàn màn hình ở 390; cột tin nhắn ellipsis + `useTableScroll` |
| ~~A2~~ | ~~Admin dưới vai trò `RESULTS_OPERATOR`~~ | Đạt 2026-11-25: trang chủ là "Nhập tỷ số"; vào được kết quả, giải, lịch, VĐV (không có nút tạo); bị chặn ở điểm xếp hạng, cài đặt, người dùng, bài viết; hàng đợi trả 403 |
| ~~A3~~ | ~~Trang hàng đợi bull-board~~ | Đạt 2026-11-25: ADMIN thấy "Bull Dashboard" (200) với danh sách queue; chưa đăng nhập 401; operator 403 |

## CI / test

| # | Việc | Ghi chú |
|---|---|---|
| ~~T1~~ | ~~Khai `passThroughEnv` cho task `test`~~ | Xong 2026-11-25: dry-run của turbo liệt kê `DATABASE_URL` trong passthrough. Script gốc vẫn giữ `--env-mode=loose` |
| T2 | Vitest API trên Windows thỉnh thoảng crash native `0xC0000409` | Chỉ ở máy local; chạy lại từng shard thì đạt. GitHub Actions (Linux) không gặp. `apps/api/vitest.config.ts` đã dùng `pool: 'threads'` để giảm crash nhưng vẫn còn; lỗi ở runtime native, chưa có cách sửa trong code dự án — giữ mở để theo dõi |

## Dọn dẹp chờ xác nhận

| # | Việc | Ghi chú |
|---|---|---|
| D1 | Tắt hoặc xoá tài khoản `ui-audit@kamito.local` trên `localhost:5433/kamito_tt_dev` | Cách làm ở cuối báo cáo audit; cần xác nhận của chủ repo |
| D2 | Dữ liệu thử tiền tố "QA " và tài khoản admin thử trong DB dev | Nợ phase 07. Đã liệt kê 2026-11-25 (chỉ SELECT): 57 user gần như toàn tài khoản E2E/thử, 1 giải + 1 địa điểm + 16 VĐV tiền tố "QA", 23 giải đều là dữ liệu thử. Chờ xác nhận trước khi xoá |
