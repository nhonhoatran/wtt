---
topic: Phase 09 gói 5 — giao diện admin Xếp hạng (bảng XH, quy tắc điểm, sổ điểm, kỳ chốt) + chọn bảng ở nội dung + gợi ý hạt giống
reference: apps/admin/src/resources/tiers/* (catalog); apps/admin/src/pages/settings-page.tsx + pages/event-hub/session-grid.tsx (ma trận); apps/admin/src/resources/audit-logs/audit-log-list.tsx (sổ điểm); apps/admin/src/resources/imports/{import-list,import-detail-page}.tsx (kỳ chốt); apps/admin/src/pages/event-hub/{sub-event-format-fields,draw-entry-action-modal}.tsx (hub)
written: 2026-11-16
---

# Phase 09 gói 5 — kế hoạch giao diện admin (ui-consistency:planning)

Kết thúc kiểu 3: các task gắn vào plan phase 09 đang chạy (gói 5 của `reports/implementation-plan-261113-1540-phase-09-task-breakdown.md`). Checklist đầy đủ (snapshot 2026-11-16, code thắng khi lệch): `ui/phase-09-ui-checklists.md`. Khi giao task cho agent, **dán nguyên văn mục checklist của task vào brief** (agent không nhận phần mở đầu này).
Trạng thái: chưa tick = `todo`, tick = `done`, `parked — <lý do>` giữ chưa tick. Mỗi task có 3 bước:
(1) đọc lại checklist trước khi viết, không viết theo trí nhớ; (2) báo sẵn sàng → bên giao task gửi cho checker của loại trang đó (một agent `ui-consistency:verifying` giữ cho mọi trang cùng loại, không phải agent viết, không phải agent đã hiệu chỉnh), sửa theo báo cáo; (3) ghi trạng thái vào plan này: `done` khi kiểm qua, hoặc `parked — <lý do>`.

Chung cho mọi task (nhắc lại trong từng brief): khoảng cách/màu qua `theme.useToken()` / `Flex gap` / preset `Tag`, không hex, không literal khoảng cách; độ rộng cố định = hằng số UPPER_CASE; `message.error(error instanceof ApiError ? error.message : '…')`; `message.success('Đã …')`; `showWarnings(message, warningsOf(response))`; giá trị nghiệp vụ (điểm, thời hạn, số hạt giống, page size) từ API/AppSetting; lọc/sort/phân trang ở server; file < 200 dòng; comment ít, tiếng Anh.

## Decided

- Ngày hiệu lực quy tắc điểm không lùi về quá khứ: tối thiểu là hôm nay theo múi giờ app (spec: giải đã kết thúc giữ nguyên). Ngày quá khứ trên lịch bị tắt.
- Ngày "tính đến" của kỳ chốt và ngày gắn điểm thủ công không được ở tương lai (UI).
- "Hôm nay" của bảng xếp hạng lấy từ AppSetting `event.defaultTimezone` (API).
- Sửa nội dung thi đấu: không tự điền bảng XH; chỉ hiện gợi ý kèm nút "Dùng". Tạo nhiều nội dung (bulk): tự điền khi mọi dòng khớp đúng 1 bảng; không ghi đè lựa chọn có sẵn.
- Ô "Sao chép cột từ…" dùng Popover (cần chọn cột nguồn và đích), không dùng Dropdown.
- Chặn rời trang khi còn ô chưa lưu: wrapper bọc `navigator` tự viết, hỏi bằng `modal.confirm`. Lý do: app dùng `BrowserRouter` nên không có `useBlocker`. Giới hạn đã biết: nút Back của trình duyệt không bị chặn. Lệch checklist mục B.
- "Tính lại ngay" trên trang xem trước dựng lại bản nháp (`POST /admin/ranking-snapshots/drafts`), không gọi `POST /admin/ranking/recompute`. Lý do: endpoint recompute cần `subEventId` hoặc `eventTypeId`, còn chi tiết kỳ chốt chỉ trả số nội dung chưa tính lại. Lệch checklist mục D.
- Dùng chung mở rộng, không đổi hành vi: `useCatalogAccess(permission = 'tournaments')`; `CatalogCreatePage`/`CatalogEditPage` nhận `onSaved`; `useCatalogRows` nhận thêm filter. Giá trị mặc định giữ nguyên cho 7 catalog. `RankingListEdit` dùng `CatalogEditPage`.
- Ô chọn bảng XH tải toàn bộ bảng và tìm phía client. Ngoại lệ có chủ đích vì catalog nhỏ; lệch quy tắc "lọc ở server", ghi nhận (`reports/fullstack-developer-261116-phase-09-ui-agent-3.md`).
- Chữ mới cần người đọc lại: "Bảng chưa có kỳ chốt công bố", "Ghi đè", "Không xem trước được gợi ý", "Không áp dụng được, thử lại", "Bảng XH", "Chưa tính lại", "Hiệu lực", câu hộp lưu quy tắc, câu xác nhận công bố, extra của thời hạn và bảng XH, nhãn vòng ("Vô địch (W)", "Vòng loại – vòng cuối").

## Tasks

- [x] **0. Hiệu chỉnh checker.** done 2026-11-16 — bắt đủ 3/3 plant (thiếu `ListFilterBar`, `syncWithLocation: false`, lý do không bắt buộc ở cả `required` lẫn `okButtonProps`); báo cáo `reports/ui-verifier-261116-phase-09-calibration.md`. Chưa kiểm: render (focus, tab, tràn, tương phản). Ghi nhận thêm: `reopen-preview-modal` dùng `footer` riêng (okButtonProps 2/3 modal). Bản sao ngoài checkout (scratchpad): `tier-list.tsx` bỏ `ListFilterBar` (kind catalog list); `audit-log-list.tsx` với `syncWithLocation: false` (kind list); `player-merge-modal.tsx` với ô lý do không bắt buộc (kind modal). Giao agent `ui-consistency:verifying` kèm mục A, C của checklist, chỉ nói "bản sao khác ở đâu đó". Người cài không kiểm. Không bắt được → dừng, ghi checker mù chỗ đó. Ma trận (B), trang xem trước kỳ chốt (D) không có tham chiếu cùng loại → không plant được; ghi là chưa hiệu chỉnh.
- [x] **1. Mở rộng shared piece quyền catalog** — `useCatalogAccess(permission = 'tournaments')`, `CatalogRowActions` + `actionsColumn` nhận `permission`; mặc định giữ hành vi 7 catalog. Làm trước task 2. (Agent 1)
- [x] **2. Bảng xếp hạng** — `resources/ranking-lists/{ranking-list-list,ranking-list-form}.tsx` theo `resources/tiers/*`, checklist mục A. (Agent 1)
- [x] **3. Khung nhóm Xếp hạng** — `pages/ranking/ranking-routes.tsx` (route + `RequireAccess resource="rankings"`), `pages/ranking/ranking-labels.ts`, sửa `layout/menu-groups.ts` (4 mục nhóm `rankings`), `app.tsx` (resource Refine + chỉ gắn routes), checklist mục "Chữ người dùng đọc". (Agent 1)
- [x] **4. Sổ điểm** — `pages/ranking/{ranking-points-page,manual-points-form,ranking-points-delete-modal}.tsx` theo `audit-log-list.tsx`, checklist mục C. (Agent 1)
- [x] **5. Quy tắc điểm** — `pages/ranking/{ranking-rules-matrix-page,ranking-rules-grid,ranking-rules-save-modal,use-ranking-rules-matrix,ranking-stage-labels}.ts(x)` theo `settings-page.tsx` + `session-grid.tsx`, checklist mục B. (Agent 2)
- [x] **6. Kỳ chốt** — `pages/ranking/{ranking-snapshots-page,snapshot-draft-modal,snapshot-preview-page,snapshot-movement-cell,snapshot-breakdown-table}.tsx` theo `import-list.tsx` + `import-detail-page.tsx`, checklist mục D. (Agent 2)
- [x] **7. Nội dung thi đấu — chọn bảng XH** — mới `pages/event-hub/sub-event-ranking-field.tsx`; sửa `sub-event-edit-modal.tsx`, `bulk-sub-event-modal.tsx`, `sub-events-tab.tsx`, `sub-event-labels.ts`; API `sub-events/sub-event-items.ts` (`SUB_EVENT_INCLUDE` thêm `rankingList`), checklist mục E. (Agent 3)
- [x] **8. Gợi ý hạt giống** — mới `pages/event-hub/draw-seed-suggestion-modal.tsx`; sửa `draw-seeds-step.tsx`, checklist mục F. (Agent 3)
- [x] **9. Kiểm** — checker theo loại (catalog/list/modal/trang tự gọi API) trên file task 1–8; chạy thử trình duyệt luồng Kỳ chốt 3 bước + lưu ma trận.
- [x] **Đóng plan** — mọi task done/parked; báo `## Decided` cùng kết quả.

Tên export cố định để agent 1 viết route trước khi agent 2 xong: `RankingRulesMatrixPage` (`ranking-rules-matrix-page.tsx`), `RankingSnapshotsPage` (`ranking-snapshots-page.tsx`), `SnapshotPreviewPage` (`snapshot-preview-page.tsx`); route `/ranking-rules`, `/ranking-snapshots`, `/ranking-snapshots/:id`, `/ranking-points`, `/ranking-lists`.

## Đóng plan (2026-11-16)

- Task 0–9 xong; không task nào `parked`. Bằng chứng: checker calibration `reports/ui-verifier-261116-phase-09-calibration.md` (bắt 3/3 plant); verifier `reports/ui-verifier-261116-phase-09-pages.md` (lỗi đã sửa); code review `reports/code-reviewer-261116-phase-09-ui.md` (7.5/10, H1 + M1–M7 đã sửa); browser `reports/ui-browser-test-261116-phase-09-ranking.md` (7 flow PASS; B1, B4, B6 đã sửa).
- Chưa commit: toàn bộ `apps/admin` và thay đổi API ngày 2026-11-16 (xem `git status`).
- Nợ (không chặn): admin chưa có unit test, chỉ typecheck + lint + browser test. Nợ có sẵn ngoài phase 09: B2 toast i18n (`i18n/vi.ts`), B3 thứ tự hiển thị mặc định 0, B5 nút menu đè tiêu đề ở 375px.
- Câu hỏi mở:
  1. `suggest-seeds` với `apply:false` đang ghi DB (`rankingAtEntry/pointsAtEntry` + audit). Giữ hay tách thành preview không ghi?
  2. Chấp nhận các chữ mới (liệt kê ở `## Decided`) hay đổi?
  3. Chấp nhận ngoại lệ tìm client-side ở ô chọn bảng XH?
