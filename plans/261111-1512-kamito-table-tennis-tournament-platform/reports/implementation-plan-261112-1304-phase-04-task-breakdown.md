# Phase 04 — Kế hoạch thực thi (làm trọn phase, không tách lát cắt)

Đã chốt 2026-11-12: làm hết phase 04 một lần; migrate + seed lên DB local `localhost:5433/kamito_tt_dev`; múi giờ mặc định là setting `event.defaultTimezone` trên `/settings`.

## Quyết định kèm theo

| Chuyện | Chốt | Lý do |
|---|---|---|
| Tham số vận hành env hay `/settings` | `/settings`, env làm trần | Ràng buộc cứng trong plan.md + quy định ngày 2026-11-12. Thay mục "Cài đặt hiển thị" và dòng "Tham số kỹ thuật" trong bảng fix cứng của phase 04 |
| `media.maxImageBytes` | setting, trần = `UPLOAD_MAX_IMAGE_BYTES` | Giới hạn upload là tham số vận hành |
| `UPLOAD_ALLOWED_IMAGE_TYPES`, `MEDIA_IMAGE_VARIANT_WIDTHS` | giữ env | Danh sách loại là chốt an toàn (mở rộng sai = lỗ bảo mật); bề rộng biến thể gắn với `srcset` site công khai, đổi theo bản deploy |
| Thiết kế upload | (b) stream qua API, trần cứng; nơi lưu chọn bằng env `STORAGE_DRIVER`: `local` (dev, thư mục `UPLOAD_LOCAL_DIR`, mặc định `apps/api/uploads/`) hoặc `s3` (production: MinIO/RustFS theo `S3_*`) | Chốt 2026-11-12. Dev không cần S3; cùng một luồng API cho mọi môi trường. Driver `local` phục vụ ảnh `public/` qua API (`MEDIA_PUBLIC_BASE_URL`), không bao giờ phục vụ `incoming/` |
| Sanitizer | `sanitize-html` (server, không cần DOM) | Allowlist thẻ/thuộc tính, chặn scheme ngoài `https:`/`mailto:` |
| Ô soạn rich text | TipTap (core MIT) | Thư viện có sẵn, xuất HTML; server vẫn sanitize |
| Sắp tiêu chí phá hòa | `@dnd-kit/sortable` + nút lên/xuống (bàn phím) | Kéo thả theo plan, vẫn dùng được không cần chuột |
| Cột `*MediaId` | FK tới `MediaAsset` `onDelete: SetNull` | Tạo cùng đợt migration |
| `cache-tags.ts` | chưa có (phase 07 tạo) | Bước 12 dời sang phase 07; service ghi chú điểm nối |

## Đợt 1 — nền chung (controller tự làm, tuần tự)

1. `packages/shared`: `slugify-vietnamese.ts`, `lifecycle-from-dates.ts`, `tiebreak-criteria.ts`, `https-url.ts` (+ test); registry setting thêm editor `text`/`select`/`boolean`/`event` và key `event.defaultTimezone`, `venue.tablePrefix`, `header.resultsStrip.enabled`, `home.featuredEventId`, `media.maxImageBytes`.
2. Schema `tournament.prisma`, `media.prisma`; migration `add_tournament_master_data`, `add_media_assets` (`--create-only` → đọc SQL → `migrate deploy`).
3. Seed `packages/db/prisma/seed/seed-config-defaults.ts` (idempotent theo `code`/`name`, xác nhận target).
4. `apps/api/src/common/crud/prisma-list-query.ts` + test.

## Đợt 2 — API (3 agent song song, tách file)

| Agent | Sở hữu | Việc |
|---|---|---|
| api-catalog | `modules/{tiers,event-types,categories,disciplines,match-formats,group-scoring-rules,venues}/`, `common/crud/delete-guard.ts` | CRUD, 409 + số bản ghi phụ thuộc, 1 bản `isDefault`, bàn bulk |
| api-events | `modules/{events,sub-events}/`, `common/html/` | CRUD giải, slug, publish/cancel, lọc vòng đời/năm; sub-event đơn + bulk; sanitizer + test XSS |
| api-media | `modules/media/`, `modules/storage/upload-*`, `apps/worker/src/processors/` | upload-intent, nhận nội dung, complete, poll; worker sharp; job dọn intent |

Mỗi agent viết e2e của mình; `app.module.ts` controller sửa sau khi gộp.

## Đợt 3 — Admin UI (tuần tự)

0. `ui-consistency:finding-patterns` → checklist (mẫu phase 03 + hub có tab, modal hàng loạt, ô upload có trạng thái).
1. admin-a: `components/{media-upload-field,confirm-action-button,slug-input,rich-text-field}.tsx`, resource catalog, địa điểm & bàn, editor mới ở `/settings`, menu.
2. admin-b: danh sách giải, form tạo, hub (Thông tin | Nội dung thi đấu), modal tạo hàng loạt.
3. `ui-consistency:verifying`.

## Đợt 4 — kiểm & chốt

tester (typecheck, lint, unit, e2e) → code-reviewer → project-manager sync plan → docs-manager → hỏi commit → journal.

## Chờ chốt

- Deploy staging (bước 13): chưa có staging từ phase 01 → ngoài phạm vi lần này.

## Checklist giao diện admin (ui-consistency:finding-patterns, đọc 2026-11-12)

Bound: `apps/admin/src`. Theme: `packages/ui-tokens/src/antd-theme.ts` qua `ConfigProvider` ở `app.tsx`; không có `DESIGN.md`. Snapshot — code thắng nếu lệch.

### A. Trang danh sách (catalog, địa điểm, danh sách giải) — kind *list* (Refine `List` + `Table`), từ `resources/users/user-list.tsx`, 2 member / 2 candidate (`user-list`, `audit-log-list`)

- [ ] khung trang — `List` của `@refinedev/antd`, `title` tiếng Việt, nút tạo qua `headerButtons={<CreateButton>…</CreateButton>}` — 2/2 (nút tạo 1/1 nơi có tạo)
- [ ] hàng lọc — `ListFilterBar` (`search` + `select` + `dateRange`), đặt ngay trên bảng — shared piece, 2/2
- [ ] bảng — `Table {...tableProps} rowKey="id"`, cột sort bằng `sorter` + `getDefaultSortOrder`, filter/sort/phân trang ở server qua `useTable({ syncWithLocation: true })` — 2/2
- [ ] số dòng mỗi trang — hook `useListPageSize()` — shared piece (`audit-log-list` dùng; `user-list` đọc thẳng `me?.listDefaultPageSize` là lệch, không chép)
- [ ] trạng thái dạng chữ — `Tag` màu preset antd: hoạt động `green`, ẩn/khóa `Tag` không màu, chờ/cảnh báo `orange`, đã chỉnh `gold` — majority, 3 file
- [ ] thao tác dòng — `EditButton hideText size="small"` + `Dropdown` nút `MoreOutlined` có `aria-label="Thao tác khác"` — 1/1 (`user-row-actions`)
- [ ] hành động cần xác nhận (ẩn, xóa, công bố, hủy) — `App.useApp().modal.confirm` với `okText` động từ, `cancelText: 'Hủy'`, `okButtonProps.danger` khi phá hủy; lỗi `ApiError.message` → `message.error`; xong → `useInvalidate` — 1/1; gom vào `components/confirm-action-button.tsx` (plan đã nêu tên + chỗ)
- [ ] xóa bị 409 `IN_USE` — trong cùng modal báo số bản ghi phụ thuộc + nút "Ẩn" (`isActive=false`) — as asked (phase 04 bước 11)
- [ ] không chép từ users: `TempPasswordModal`, `me?.listDefaultPageSize`, nhãn vai trò

### B. Form tạo/sửa (catalog, giải, địa điểm) — kind *form*, từ `resources/users/user-create.tsx`, 2 member / 2 candidate

- [ ] khung — `Create` / `Edit` của Refine + `useForm` (`redirect` hợp lý), nút lưu qua `saveButtonProps` (đổi chữ bằng `children` khi cần) — 2/2
- [ ] form — `Form {...formProps} layout="vertical"`, lỗi field qua `rules` antd + lỗi 422 `fields` từ API (Refine map `errors`) — 2/2
- [ ] bề rộng form — `style={{ maxWidth: 480 }}` viết tay 2/2; form giải 3 nhóm rộng hơn → dùng cùng cách, một hằng số tên rõ ràng (không có token bề rộng trong theme)
- [ ] gợi ý dưới field — `extra` của `Form.Item` — 2/2
- [ ] nhóm field (form giải 3 nhóm) — chưa member nào có; dùng `Card` có `title` như `settings-page` (1/1) — level 7, mới ở đây
- [ ] khoảng cách — `theme.useToken()` (`token.margin`…) — 3 file; không viết số px tay ngoài bề rộng form

### C. Trang tự gọi API (hub giải, cài đặt) — từ `pages/settings-page.tsx`, 1 member

- [ ] tải — `useQuery` + `apiFetch`; đang tải `Skeleton active`; lỗi `Result status="error"` + nút "Thử lại" — 1/1 (chỉ reference, chưa phải convention)
- [ ] tiêu đề trang — `Typography.Title level={3}` khi không dùng khung Refine — 1/1
- [ ] setting editor mới (`text`, `boolean`, `timezone`, `event`) — mở rộng `pages/settings-field.tsx`, giữ `Tag gold "Đã chỉnh"` + "Khôi phục mặc định" + dòng "Mặc định: …" — shared piece

### D. Piece mới (plan đã nêu tên và chỗ, không cần hỏi)

- `components/{media-upload-field,slug-input,confirm-action-button,rich-text-field}.tsx`; `pages/event-hub/*` (antd `Tabs`, tab theo URL), `bulk-sub-event-modal.tsx` (antd `Modal` + `Checkbox`). Chưa có member → không convention; trạng thái upload dùng `Tag`/`Progress` theo màu preset ở mục A.

Chi phí: mở 14 file dự án, 6 lần tìm; đọc `finding-patterns/SKILL.md`, `words.md`, `checklist.md`, `values/SKILL.md`. Không đo accessibility (không được yêu cầu).
