# Báo cáo phase A1 — shell admin + token (2026-11-25)

## Đã làm
- `packages/ui-tokens/src/antd-theme.ts`: header trắng (`surface`), cao 56; Menu dark `darkItemSelectedBg = primaryStrong`, `darkGroupTitleColor = lineStrong`, `itemBorderRadius = radius.card`; thêm `buildSiderTheme()` (focus = `live` #E3F42A, bề rộng 2). Test thêm trong `build-css-variables.test.ts`.
- `menu-groups.ts`: thêm `icon`, `placement` (main/bottom), `homeKind(role)`, `SHELL_LABELS`; "Hạng giải" dời sang GIẢI ĐẤU; đổi nhãn "Danh sách giải" -> "Giải đấu", "Danh sách VĐV" -> "Vận động viên". Giữ `visibleMenuGroups`, `ROLE_LABELS`, không xoá mục nào.
- `build-breadcrumb.ts` (hàm thuần, `findMenuEntry` chọn path dài nhất, bỏ qua mục external) + `test/build-breadcrumb.test.mjs` (8 test).
- `admin-sider.tsx` (logo K + KAMITO, "Tổng quan", nhóm chữ hoa, nhóm đáy có đường kẻ, submenu Cấu hình/Người dùng tự mở theo mục đang chọn, bọc `ConfigProvider(buildSiderTheme())`), `admin-header.tsx` (hamburger khi compact, breadcrumb, avatar chữ tắt + tên + vai trò, dropdown Đổi mật khẩu/Đăng xuất), `admin-breadcrumb.tsx` (`BreadcrumbProvider`, `useBreadcrumbTail`).
- `admin-layout.tsx` gọn lại; giữ drawer `aria-label="Menu quản trị"`, đóng khi qua `lg`.
- `role-home-page.tsx` dùng `homeKind`.
- `components/page-header.tsx`, `components/stat-card.tsx` (chưa trang nào dùng, A2+ dùng).
- Không vẽ chuông (Q1).

## Kiểm tra (chạy thật)
- ui-tokens: `pnpm build` OK, `pnpm test` 6/6 pass, `pnpm typecheck` sạch. (`pnpm build` cần chạy vì admin import từ dist của ui-tokens; dist đã gitignore.)
- admin: `pnpm typecheck` sạch, `pnpm lint` sạch, `pnpm test` 45/45 pass (gồm 8 test breadcrumb), `pnpm build` OK (chỉ cảnh báo chunk > 500 kB đã có sẵn).
- Trình duyệt (script `scratchpad/check-a1-shell.mjs`, `check-a1-focus.mjs`; ảnh ở `scratchpad/a1/`), DB test kamito_tt_phase12_test:
  - 1280, ADMIN: breadcrumb `/` = Trang chủ / Tổng quan; `/events` = Trang chủ / Giải đấu; `/settings` = Trang chủ / Cấu hình / Cài đặt hệ thống; `/ranking-snapshots` = Trang chủ / Xếp hạng / Kỳ chốt. Overflow ngang 0 ở mọi route đã đo.
  - Số mục menu ADMIN: 17 mục khi submenu đóng + 9 trong 2 submenu = 26 mục (+ "Tổng quan"); trang chủ cũ liệt kê 24 thẻ cho mục cũ, khớp với 26 - Tổng quan - 1 external (Hàng đợi).
  - Focus bàn phím: Tab vào menu = outline `solid 2px rgb(227,244,42)` trên `ul`; mũi tên xuống = cùng outline trên `li` từng mục (xem `focus-menu-arrow.png`). #E3F42A trên #0A0A0A ≈ 16:1.
  - 390: overflow 0 ở `/`, `/events`, `/settings`; drawer có `aria-label="Menu quản trị"`; sau khi nới 1280 rồi thu 390 drawer không tự mở lại (0 drawer mở).
  - RESULTS_OPERATOR: vào `/`, breadcrumb Trang chủ / Nhập tỷ số, không có "Tổng quan"; menu = GIẢI ĐẤU (Giải đấu, Hạng giải, Địa điểm & bàn, Nhập tỷ số), VẬN ĐỘNG VIÊN (3 mục), Cấu hình (submenu) — cùng tập mục `can()` cho phép như trước.
  - Console: chỉ 2 lỗi `401 Unauthorized` ở bước kiểm tra phiên trước khi đăng nhập (có từ trước, không phải do shell); không có warning, không pageerror.

## Lưu ý / chưa làm
- Chưa có trang nào gọi `useBreadcrumbTail`, nên `/events/:id/entries` hiện chỉ hiện "Trang chủ / Giải đấu" (liên kết về danh sách), chưa có tên giải; trang hub/kỳ chốt thuộc phase sau (A4...) và nằm ngoài danh sách file của A1.
- `app.tsx` còn `meta.label` "Danh sách giải"/"Danh sách VĐV" (dùng cho `ResourceBackLink`, tiêu đề list `event-list.tsx`, `player-list.tsx`, back link hub) — lệch nhãn với menu mới "Giải đấu"/"Vận động viên"; file ngoài phạm vi A1.
- Bước 1 của phase (commit đợt audit) không làm theo yêu cầu: không commit; xây tiếp trên working tree. Không chạy migration, không đụng DB khác.
- `apps/client/tests/admin-full-flow/ui.ts`: không sửa; grep không thấy selector theo nhãn menu cũ.
- Màu logo/đường kẻ/kích thước brand trong `admin-sider.tsx` lấy từ `tokens` + hằng cục bộ; tên thương hiệu giữ trong code theo phase file.

## Câu hỏi mở
- Đồng bộ nhãn "Danh sách giải"/"Danh sách VĐV" ở `app.tsx` + 2 trang list trong phase nào?
