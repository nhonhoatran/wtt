# Kiểm tra nhất quán UI — trang admin phase 03

Ngày: 2026-11-12. Checklist: mục "Mẫu UI admin dùng chung (checklist ui-consistency)" trong `phase-03-admin-auth-rbac-users-and-admin-shell.md`. Theme: `packages/ui-tokens/src/antd-theme.ts`.

## Cách kiểm
- Agent kiểm riêng (không phải agent viết code), đọc code, không render.
- Hiệu chuẩn trước: bản copy trang Nhật ký cài 1 sai khác (`marginTop: 18` viết tay) → agent hiệu chuẩn bắt được. Chỉ chứng minh check thấy giá trị/khoảng cách viết tay; chữ, cỡ chữ, cuộn chưa được plant thử.
- Agent kiểm thật là agent mới; kiểm 3 vòng (ban đầu + 2 vòng sau khi sửa).

## Trang đã kiểm (13 file)
Danh sách: `user-list`, `audit-log-list`, `user-row-actions`. Form: `user-create`, `user-edit`, `settings-page`, `settings-field`. Đăng nhập: `login-page`, `change-password-page`. Khung: `admin-layout`, `menu-groups`, `role-home-page`. Linh kiện: `list-filter-bar`, `temp-password-modal`, `step-up-modal`, `require-access`.

## Sai khác đã sửa
| Chỗ | Vấn đề | Sửa |
|---|---|---|
| `list-filter-bar` | "Xóa lọc" không xóa chữ trong ô tìm; sửa lần 1 làm mất focus khi Enter | `SearchInput` controlled, đồng bộ theo filter, reset khi Xóa lọc |
| `settings-page` | Nút lưu không có loading; lỗi 422 chỉ toast; lưu dở dang không làm mới cache; form remount làm mất giá trị đang gõ | loading, gắn lỗi vào field, invalidate trong `finally`, bỏ remount, reset field sau "Khôi phục mặc định" |
| `settings-page` | Nhãn "Lưu thay đổi" khác "Lưu" của form khác | đổi thành "Lưu" |
| `change-password-page` | Lỗi chung hiện toast, login hiện Alert; card 440 vs 400; 2 Alert cùng lúc | Alert inline, `maxWidth: 400`, ẩn cảnh báo mật khẩu tạm khi có lỗi, footer `type="secondary"` |
| `admin-layout` | Màu đọc thẳng `tokens.color.surface` | `token.colorTextLightSolid` qua `theme.useToken()` |

## Giữ có chủ đích
- `/settings`: mỗi nhóm một Card (lưu riêng từng nhóm), tiêu đề tự viết (không phải resource Refine), `maxWidth: 640`.
- Nhật ký: không có ô tìm `q` (API không hỗ trợ — đã ghi vào checklist); giờ có giây; id thô khi thiếu tên.
- Độ rộng `240`/`280`/`180`/`480`: antd không có token độ rộng.

## Chưa kiểm được
- Mọi thứ cần render: kích thước thật, tràn, Sider thu gọn dưới `lg`, focus, modal.
- Bên trong Refine `List/Create/Edit` (cấp heading, breadcrumb) và `reset.css` — hook chặn đọc `node_modules`.
- Tương phản ngoài Tag header; checklist không nêu chuẩn accessibility.

## Đề xuất bổ sung checklist
Thêm dòng cho: định dạng thời gian, độ rộng card/form, tiêu đề trang không dùng Refine, cách hiện lỗi không thuộc field.

Chi phí ước tính: ~29 file mở, ~10 lệnh/tìm kiếm (3 vòng kiểm) + 10 file cho hiệu chuẩn.
