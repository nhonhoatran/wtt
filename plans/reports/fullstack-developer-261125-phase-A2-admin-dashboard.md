# Báo cáo phase A2 — Tổng quan (dashboard) + editor /settings (2026-11-25)

## Đã làm
**API** (`apps/api/src/modules/dashboard/`, đăng ký ở `app.module.ts`)
- `GET /admin/dashboard/summary` (`tournaments.list`): liveEvents, pendingToday, overdueToday, finishedToday, activePlayers, `recentActivityLimit` (thêm so với spec để UI biết khi nào ẩn khối hoạt động mà không cần quyền settings), `events[]` (giới hạn `dashboard.liveEventLimit`).
- `GET /admin/dashboard/pending-matches` (`matches.list`): trận mở hôm nay, sắp `scheduledAt asc, matchNo asc`, phân trang server (page size mặc định lấy từ `list.defaultPageSize`).
- `dashboard-today-window.ts` (hàm thuần): ứng viên ONGOING + lọc theo `lifecycleFromDates`/`todayInTimezone` từng múi giờ; where "hôm nay" gom theo ngày địa phương. Trận tính: draw PUBLISHED, không voided, không BYE.
- Truy vấn: 1 truy vấn sự kiện + 1 transaction 4 phép tổng hợp (groupBy status hôm nay, count quá giờ, groupBy eventId+status cho tiến độ, `$queryRaw` đếm VĐV distinct qua UNION). Tổng 5 truy vấn, spec ghi ≤4 — lệch 1 (đếm quá giờ tách riêng).
- Tiến độ `matches{total,official}` dùng cùng quy tắc với event hub (bỏ BYE/WALKOVER/voided).

**Shared**: `dashboard-settings.ts` (`dashboard.liveEventLimit` 5 [1–20], `dashboard.recentActivityLimit` 6 [0–20]), nhóm "Tổng quan"; 3 editor kind mới `bilingual-text`, `nav-items`, `social-links` (+ `optional` cho `text`); `SITE_NAV_LABELS`, `SITE_SOCIAL_LABELS`. Zod schema vẫn là nguồn sự thật (không đổi schema, chỉ đổi `editor`). `site.name`, `site.tagline`, `site.nav.items`, `site.socialLinks` không còn dùng JSON thô.

**Admin**
- `pages/dashboard/`: `dashboard-page`, `live-events-card`, `pending-matches-table`, `quick-actions-card`, `recent-activity-card`, `dashboard-types`, `pending-match-status` (+ test). `role-home-page.tsx`: RESULTS_OPERATOR vẫn vào Nhập tỷ số; có `tournaments.list` thì vào dashboard; còn lại giữ lưới lối tắt cũ.
- Nhãn audit: ~65 mã hành động (event/subEvent/draw/match/entry/import/ranking/player/session/catalog/content) + nhãn đối tượng.
- `/settings`: `bilingual-text-setting-editor`, `nav-items-setting-editor` (thêm/bỏ/đổi thứ tự bằng nút mũi tên, nhãn VI/EN tùy chọn), `social-links-setting-editor`, `structured-setting-validation` (+ test). Thông báo nói rõ sai gì/sửa sao, ví dụ "Liên kết 1 (Facebook): đường dẫn phải bắt đầu bằng https://...".
- **Sửa lỗi sẵn có (phát hiện khi test trình duyệt)**: nhóm "Hiển thị site công khai" không lưu được vì `site.registrationUrl` (mặc định rỗng) bị rule `required` của editor text chặn → thêm `optional: true` cho editor đó.
- Bỏ `addonBefore` (antd cảnh báo deprecated) ở editor 2 ngôn ngữ.

## Kiểm tra (chạy thật)
- Root `pnpm typecheck`: 14/14 ok. Root `pnpm lint`: 9/9 ok.
- `packages/shared`: build ok, test 25 file / 120 pass (file mới `setting-editors.test.ts`).
- `apps/admin`: typecheck, lint ok; `node --test` 96 pass / 0 fail (mới: `pending-match-status`, `structured-setting-validation`); `pnpm build` ok.
- API (qua wrapper, DB `localhost:5433/kamito_tt_phase12_test`, từng file): `src/modules/dashboard/dashboard-today-window.test.ts` 5/5; `test/admin-dashboard.e2e-spec.ts` 6/6 (số đếm, tiến độ, giới hạn setting, sắp xếp, phân trang, 400 tham số sai, 401, OPERATOR 200); `test/permission-coverage.e2e-spec.ts` 4/4 (sửa kỳ vọng `site.name` -> `bilingual-text`); `media-settings-and-queue` 4/4; `public-site` 9/9. Không có role thiếu cả `tournaments.list` để test 403 của summary (ma trận hiện chỉ 2 role đều có).
- KPI đối chiếu SQL tay (`scratchpad\a2\sql-check.mjs`, cùng dữ liệu seed tạm): SQL `pending 9, overdue 3, finished 1, live 2, players 17`; dashboard hiển thị 2 / 9 (Cần xử lý: 3 trận quá giờ) / 1 / 17. Khớp.
- Trình duyệt (API riêng cổng 3051 + route Playwright, ảnh ở `scratchpad\a2\`): ADMIN 1280 và 390, overflow ngang 0, 9 dòng bảng, 2 thẻ giải; trạng thái Chờ kết quả/Đang đấu/Sắp đấu đúng. Đổi `list.defaultPageSize=5`: trang 1 = 5 dòng, trang 2 = 4 dòng, network thấy `pending-matches?page=2&pageSize=5`. `dashboard.liveEventLimit=1` -> 1 thẻ; `recentActivityLimit=0` -> ẩn khối và không gọi `/admin/audit-logs`. OPERATOR vào `/` thấy Nhập tỷ số, không có "Tổng quan", không gọi API dashboard.
- Settings: sửa nav (đổi chỗ/bỏ/thêm), link `http://` bị chặn với thông báo rõ, tagline chỉ một ngôn ngữ bị chặn, lưu -> `dirtyAfterSave: 0`, reload hiển thị đúng giá trị đã lưu, rời trang khi còn sửa dở vẫn bị chặn (modal xác nhận). Đã khôi phục toàn bộ setting (so sánh trước/sau: bằng nhau). Console: chỉ có 401 từ bước kiểm tra phiên trước đăng nhập (đã có từ trước); không warning.
- Dọn dẹp: dữ liệu seed tạm đã xóa (SQL sau dọn: pending 0), file spec tạm đã xóa, API cổng 3051 đã dừng đúng PID; không đụng :3000 / :5173.

## Lưu ý / chưa làm
- `docs/auth-and-rbac.md` (bảng setting) chưa cập nhật, nên giao `docs-manager`.
- Nút "Nhập" mở `/results?event=&match=`; deep link do A9 xử lý, trước đó chỉ mở `/results`.
- `Select` của antd gắn `aria-label` lên cả wrapper và input (nhiễu a11y nhỏ, chỉ ảnh hưởng selector test).
- Import chéo: `pending-matches-table.tsx` dùng `roundTitle` từ `event-hub/draw-labels.ts` (file A7 đang sửa; chỉ import, không đổi).
- Không migration, không đụng `.env`, chưa commit.

## Files
Mới: `apps/api/src/modules/dashboard/*` (5 file + test), `apps/api/test/admin-dashboard.e2e-spec.ts`, `packages/shared/src/dashboard-settings.ts`, `packages/shared/src/setting-editors.test.ts`, `apps/admin/src/pages/dashboard/*` (7 file), `apps/admin/src/pages/settings-editors/{bilingual-text,nav-items,social-links}-setting-editor.tsx`, `.../structured-setting-validation.ts`, `apps/admin/test/{pending-match-status,structured-setting-validation}.test.mjs`.
Sửa: `apps/api/src/app.module.ts`, `apps/api/test/permission-coverage.e2e-spec.ts`, `packages/shared/src/{app-setting-definition,app-setting-registry,public-site-display-settings,index}.ts`, `apps/admin/src/pages/{role-home-page,settings-field}.tsx`, `apps/admin/src/resources/audit-logs/audit-log-labels.ts`.

**Status:** DONE_WITH_CONCERNS
**Summary:** Dashboard A2 (2 endpoint, UI 5 khối, setting, nhãn audit) và 3 editor /settings hoàn tất, test và duyệt trình duyệt đạt.
**Concerns:** summary dùng 5 truy vấn (spec ≤4); docs chưa cập nhật; đã sửa thêm lỗi chặn lưu nhóm "Hiển thị site công khai" (registrationUrl rỗng).
