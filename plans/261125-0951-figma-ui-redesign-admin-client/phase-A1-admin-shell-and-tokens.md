# Phase A1 — Shell admin + token (sider tối có icon, header trắng, breadcrumb, focus sáng)

## Context links
- Gap: [research/admin-figma-gap.md](./research/admin-figma-gap.md) mục "Shell"
- Figma: `figma/admin/1-57.png` (shell rõ nhất), `1-53.png`
- Code: `apps/admin/src/layout/admin-layout.tsx`, `apps/admin/src/layout/menu-groups.ts`, `packages/ui-tokens/src/antd-theme.ts`, `packages/ui-tokens/src/tokens.ts`, `apps/admin/src/pages/role-home-page.tsx`
- Câu hỏi mở: Q1 (chuông) trong [admin-open-questions.md](./admin-open-questions.md)

## Overview
- Ưu tiên: P1 (mọi phase sau dựa vào). Effort: ~4h. Trạng thái: completed.
- Dựng lại khung: sider đen có logo, icon từng mục, nhóm chính + nhóm đáy; header trắng có breadcrumb + avatar/tên/vai trò; component dùng chung `PageHeader`, `StatCard`.

## Key insights
- Tiền đề: commit đợt audit admin đang dở trong working tree (U1–U11) trước khi sửa `admin-layout.tsx`, `antd-theme.ts`.
- Focus navy `#0F285D` trên sider `#0A0A0A` ≈ 1.4:1 → không thấy. Token `live` `#E3F42A` (đã ghi "chỉ dùng trên nền navy/đen") ≈ 16:1 trên nền sider, ≈ 6.5:1 trên nền mục chọn `primaryStrong`.
- Mục chọn nền đỏ `primary` + chữ trắng ≈ 4.4:1 (< 4.5 AA). Dùng `primaryStrong` `#A31115` (≈ 7.9:1).
- Nhãn nhóm (chữ hoa 12 px) dùng `lineStrong` `#A3A3A3` (≈ 7.8:1); `textSubtle` chỉ ≈ 4.2:1.
- `antd-theme.ts` chỉ admin dùng (`apps/admin/src/app.tsx:1`) → đổi `headerBg` không ảnh hưởng client.
- Tên thương hiệu "KAMITO / Quản trị giải đấu" là nhận diện sản phẩm, không phải giá trị nghiệp vụ → được giữ trong code (đã như vậy ở `admin-layout.tsx:41-43`).

## Requirements
Chức năng
- Sider: logo (ô vuông `primary` chữ "K") + "KAMITO" + "Quản trị giải đấu"; mục "Tổng quan" đầu; nhóm GIẢI ĐẤU (Giải đấu, Hạng giải, Địa điểm & bàn, Nhập tỷ số), VẬN ĐỘNG VIÊN (Vận động viên, Cặp đôi, Lịch sử import), XẾP HẠNG (Bảng xếp hạng, Quy tắc điểm, Sổ điểm, Kỳ chốt), NỘI DUNG (Tin tức, Video, Trang tĩnh, Hộp thư liên hệ); nhóm đáy tách bằng đường kẻ: Nhà tài trợ, Cấu hình (submenu), Người dùng (submenu). Mọi mục có icon `@ant-design/icons`.
- Không xoá mục nào đang có. Lọc quyền giữ `visibleMenuGroups`.
- "Tổng quan" ẩn với vai trò có trang chủ là Nhập tỷ số (dùng chung một hàm `homeKind(role)` với `role-home-page.tsx`).
- Header trắng: nút mở menu (mobile) · breadcrumb · (chuông: KHÔNG làm tới khi chốt Q1) · avatar chữ tắt + tên + nhãn vai trò, dropdown Đổi mật khẩu / Đăng xuất.
- Breadcrumb: "Trang chủ / <nhóm hoặc mục> / <đuôi trang>". Trang chi tiết (hub giải, kỳ chốt…) đặt đuôi bằng hook `useBreadcrumbTail(label)`.
- `PageHeader`: back (tuỳ chọn) + tiêu đề + tag + dòng phụ + vùng nút bên phải; wrap trên mobile.
- `StatCard`: nhãn, giá trị, icon, chú thích/Tag phụ, trạng thái loading.

Phi chức năng
- Focus bàn phím trên sider luôn thấy rõ (≥ 3:1 so với nền kề).
- 390 px: drawer menu giữ hành vi U5 (đóng khi qua `lg`, `aria-label`).
- File < 200 dòng.

## Architecture
```
AdminLayout
 ├─ BreadcrumbProvider (context: tail label)
 ├─ AdminSider  ── ConfigProvider(theme = buildSiderTheme()) ── Menu(items from menu-groups + icons)
 └─ Layout
     ├─ AdminHeader ── AdminBreadcrumb(buildBreadcrumb(pathname, groups, tail)) + UserMenu
     └─ Content <Outlet/>
```
Data flow: `useGetIdentity` → role → `visibleMenuGroups(role)` + `homeKind(role)` → menu items. `pathname` + groups + tail → `buildBreadcrumb()` (hàm thuần) → `Breadcrumb items`.

## Related code files
Sửa
- `packages/ui-tokens/src/antd-theme.ts` — `Layout.headerBg = surface`, header height/padding; `Menu` dark: `darkItemSelectedBg = primaryStrong`, `darkGroupTitleColor = lineStrong`, `itemBorderRadius = radius.card`; export `buildSiderTheme(source)` (token `colorPrimaryBorder = live`, `lineWidthFocus` giữ 2).
- `packages/ui-tokens/src/build-css-variables.test.ts` — thêm assert cho `buildSiderTheme` và `headerBg`.
- `apps/admin/src/layout/admin-layout.tsx` — chỉ còn ghép Sider/Header/Content.
- `apps/admin/src/layout/menu-groups.ts` — thêm `icon: ComponentType`, `placement: 'main' | 'bottom'`, dời "Hạng giải" sang GIẢI ĐẤU, "Nhập tỷ số" giữ ở GIẢI ĐẤU; đổi nhãn "Danh sách giải" → "Giải đấu", "Danh sách VĐV" → "Vận động viên"; thêm `homeKind(role)`.
- `apps/admin/src/pages/role-home-page.tsx` — dùng `homeKind` (chưa đổi nội dung dashboard; A2 làm).
- `apps/client/tests/admin-full-flow/ui.ts` — chỉ sửa nếu selector menu bị đổi tên (hiện E2E đi bằng URL, kiểm lại).

Tạo
- `apps/admin/src/layout/admin-sider.tsx`
- `apps/admin/src/layout/admin-header.tsx`
- `apps/admin/src/layout/admin-breadcrumb.tsx` (+ `BreadcrumbProvider`, `useBreadcrumbTail`)
- `apps/admin/src/layout/build-breadcrumb.ts` (thuần)
- `apps/admin/src/components/page-header.tsx`
- `apps/admin/src/components/stat-card.tsx`
- `apps/admin/test/build-breadcrumb.test.mjs`

## Implementation steps
1. Xác nhận đợt audit đã commit (`git status` sạch ở các file trên).
2. `antd-theme.ts`: sửa token header/menu; thêm `buildSiderTheme`. Cập nhật test ui-tokens; chạy `pnpm --filter @kamito/ui-tokens test`.
3. `menu-groups.ts`: thêm icon + placement + `homeKind`; giữ `visibleMenuGroups` API cũ.
4. Viết `build-breadcrumb.ts` (input: pathname, groups, tail → `{title, path?}[]`); test node.
5. Tạo `admin-sider.tsx` (brand + 2 Menu: main, bottom; submenu cho Cấu hình/Người dùng; `openKeys` tự mở theo mục chọn), bọc `ConfigProvider theme={buildSiderTheme()}`.
6. Tạo `admin-header.tsx` (hamburger khi compact, breadcrumb, avatar `Avatar` chữ tắt từ `user.name`, tên + `ROLE_LABELS`).
7. `admin-breadcrumb.tsx`: context + hook đặt đuôi (cleanup khi unmount).
8. Viết lại `admin-layout.tsx` ghép các phần; giữ logic drawer U5.
9. `page-header.tsx`, `stat-card.tsx` (chưa dùng ở trang nào trong phase này ngoài kiểm thử thủ công; A2+ dùng).
10. `pnpm --filter @kamito/admin typecheck lint test build`.
11. Kiểm tay 1440 / 390 với ADMIN và RESULTS_OPERATOR; Tab qua menu thấy vòng vàng.

## Todo
- [x] Commit đợt audit trước
- [x] Theme header/menu + `buildSiderTheme` + test
- [x] menu-groups (icon, placement, homeKind)
- [x] build-breadcrumb + test
- [x] admin-sider / admin-header / admin-breadcrumb
- [x] admin-layout gọn lại
- [x] PageHeader, StatCard
- [x] typecheck/lint/test/build xanh
- [x] Kiểm 1280/390, 2 vai trò, focus bàn phím (viewport thực tế trong báo cáo)


## Đồng bộ trạng thái 2026-11-25

Nguồn: [báo cáo triển khai](../reports/fullstack-developer-261125-phase-A1-admin-shell.md).

Đợt audit trước đã có commit `64c8b69`, báo cáo `10e3431`. Focus sider tối đã kiểm trên trình duyệt trong báo cáo A1; không mở lại nợ focus cũ.

## Success criteria
- Mọi route cũ vẫn tới được từ menu (đếm: số mục menu ADMIN trước = sau).
- RESULTS_OPERATOR: không thấy "Tổng quan", thấy đúng nhóm như trước (so với A2 audit 2026-11-25).
- Focus trên mục sider: outline màu `#E3F42A`, đo contrast ≥ 3:1 với nền kề.
- Header nền trắng; breadcrumb đúng trên `/events`, `/events/:id/entries`, `/ranking-snapshots/:id`, `/settings`.
- 390 px: không tràn ngang, drawer mở/đóng đúng.
- `pnpm --filter @kamito/admin build` và test ui-tokens xanh.

## Risk assessment
| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Đổi token Menu làm lệch các Menu khác (dropdown, tabs) | Thấp × TB | Token chỉ ở nhánh `dark*`; sider bọc ConfigProvider riêng |
| Breadcrumb sai cho route lồng (`/events/:id/:tab`) | TB × Thấp | Hàm thuần + test bảng route |
| Xung đột merge với đợt audit chưa commit | Cao × Cao | Bước 1 bắt buộc |
Rollback: revert commit phase (chỉ đụng layout + theme + 2 component mới chưa ai dùng).

## Security considerations
- Không đổi quyền; menu vẫn lọc bằng `can()`; route vẫn có `RequireAccess`.
- Không đưa thông tin nhạy cảm vào breadcrumb (chỉ tên giải/kỳ).

## Next steps
- A2 dùng `PageHeader`, `StatCard`; A4 dùng `useBreadcrumbTail` cho tên giải; A11 đổi đích mục "Bảng xếp hạng".
- Chuông: chờ Q1.
