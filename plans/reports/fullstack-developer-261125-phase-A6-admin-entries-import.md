# Báo cáo phase A6 — tab "Danh sách đăng ký" + nhập Excel trong tab (2026-11-25)

## Đã làm
Admin (`apps/admin/src`):
- `pages/event-hub/entry-columns.tsx` (mới): cột Hạt giống (sửa inline giữ nguyên) · VĐV/cặp · CLB · Điểm xếp hạng (`pointsAtEntry`) · Vòng (khi có vòng loại) · Trạng thái (+ Tag suất khác "Thường", "Ghi đè") · Ghi chú · Thao tác (Rút / Khôi phục).
- `entry-table.tsx`: nhận `toolbarActions` + `panel`; hàng lọc (tìm/Trạng thái/Suất) vẫn là filter server của `useTable`; Card "Danh sách hiện có · N VĐV/cặp"; bulk bar giữ.
- `entries-toolbar.tsx` (mới): Tải file mẫu · Xuất Excel · Nhập từ Excel · Thêm VĐV (2 nút sau theo `canCreate`).
- `entries-import-panel.tsx` (mới): Card có nút đóng, Steps 3 bước (Tải file lên / Kiểm tra dữ liệu / Xác nhận nhập); không job: Dragger; có job: `ImportJobPanel`. Job id nằm ở `?import=`.
- `entries-tab.tsx`: SubEventPills (số `confirmed`) thay side menu; form thêm VĐV dạng Card thu gọn (Esc đóng); mở cái này đóng cái kia; xong import -> invalidate danh sách + refetch đếm (stepper tự cập nhật vì `useEventProgress` nghe `entry-counts`).
- `components/import-wizard.tsx`: chỉ còn `ImportUploadStep` (callback `onJobCreated`), bỏ Modal.
- `resources/imports/`: `import-job-panel.tsx` (tách từ trang chi tiết, dùng chung), `use-import-job.ts`, `import-steps-bar.tsx`, `import-summary-chips.tsx` (tổng / hợp lệ / cần chọn VĐV / lỗi / đã nhập), `import-fix-hints.ts` (cột "Cách sửa" theo mẫu thông báo), `import-detail-page.tsx` dùng lại panel.
- `components/import-preview-table.tsx`: mỗi thông báo lỗi kèm "Cách sửa: ..." khi nhận ra mẫu.
- `pages/event-hub/add-entry-form.tsx`: nút gửi đổi thành "Thêm vào danh sách" (tránh trùng tên với nút bật form "Thêm VĐV").
- Test mới `test/import-fix-hints.test.mjs` (2 test).

API (nhỏ, không schema): `entries-query.service.ts` `searchWhere` tìm thêm theo mã VĐV và CLB (trước chỉ theo tên; placeholder cũ "tên hoặc mã" thực tế không tìm mã). E2E mới trong `apps/api/test/entries.e2e-spec.ts` (tìm theo CLB, theo mã).

E2E client: `apps/client/tests/admin-full-flow/events-and-imports.ts` đổi selector (Nhập từ Excel, upload ngay trên tab, URL `?import=`, bật form "Thêm VĐV", nút "Thêm vào danh sách"). Chưa chạy (cần stack đầy đủ).

## Khác Figma/spec, nói rõ
- Không làm nút "Sửa" ở cột Thao tác: không có form sửa đăng ký nào; hạt giống sửa inline, Rút/Khôi phục để nút trực tiếp (ít click hơn menu "…").
- Menu "…" bỏ: "Xuất Excel" và "Tải file mẫu" để nút phẳng.
- "Cách sửa" là ánh xạ phía admin theo regex trên thông báo tiếng Việt của worker (Q5 chưa chốt mã lỗi): thông báo worker đổi chữ thì hint mất (không vỡ). Chưa làm "tải danh sách lỗi".
- Không vẽ "Chờ xác nhận" (Q6 chưa chốt).
- Nút đóng panel khi đang upload không bị khóa.
- Docs (`docs/*`) còn nhắc "Import Excel" — không sửa (thuộc agent khác).

## Kiểm tra (chạy thật)
- admin: `pnpm typecheck` sạch, `pnpm lint` sạch, `pnpm test` 65/65, `pnpm build` OK (lần cuối sau mọi sửa).
- api: `pnpm exec tsc --noEmit` sạch; wrapper `vitest run test/entries.e2e-spec.ts`: 20/20 (dòng đầu `localhost:5433/kamito_tt_phase12_test`). Không chạy file test khác.
- Trình duyệt (`scratchpad/check-a6-entries-import.mjs`, `check-a6-close.mjs`; ảnh `scratchpad/a6/`), 1280 + 390, 1 context đăng nhập, API mới chạy ở :3020 + worker (:3021, queue prefix `kamito-tt:test:a6-261125`) trên TEST DB; Playwright route chuyển `/api/v1/**` sang :3020 (PUT file dùng `route.continue`). Đã dừng đúng 2 PID đó (32604, 5552); không đụng :3000/:5173.
  - Tab: tiêu đề "Danh sách hiện có · 4 VĐV", cột đúng spec; tìm gửi `?q=A5+check` (server). Form thêm: mở -> focus ô tìm; Esc đóng.
  - Nhập: nút "Nhập từ Excel" -> kéo file (file dựng từ mẫu thật: 3 dòng hợp lệ, 2 dòng lỗi) -> URL `?import=<id>` không rời tab -> reload giữa chừng vẫn đúng job -> chips "5 dòng / 3 hợp lệ / 2 lỗi" + Alert vàng "Có 2 dòng lỗi" + tab Lỗi có "Cách sửa" -> "Nhập 3 dòng" -> hộp xác nhận "2 dòng lỗi ... sẽ bị bỏ qua" -> "Đã nhập 3 dòng." 
  - Sau commit: số đăng ký 4 -> 7, tiêu đề Card "· 7 VĐV", pill "MS Đơn nam 7", gọi lại `/progress` 1 lần; "Đóng" xoá `?import=` và panel.
  - `/imports/<id>` vẫn chạy (hiện "Đã nhập 3 dòng.").
  - Overflow ngang 0 ở 1280 và 390 (tab và panel). Console error/warning: không có.
- Số thao tác nhập: Nhập từ Excel -> kéo file -> Nhập N dòng -> Xác nhận = 4.

## Dữ liệu để lại trên TEST DB (event `e2e284a0-a7e8-4261-977a-64ce6e228f8a`)
- Import job `8f7bc633-6009-494d-8a18-c3c37435965b` (DONE; file `a6-import-979123.xlsx`; 5 dòng, 2 dòng lỗi không nhập).
- 3 VĐV mới + 3 đăng ký MS: tên `A6 check 979123 1..3`, CLB `A6 CLB 979123` (mã KMT01891..01893).
- Các lần chạy script lỗi trước đó (upload bị route làm rỗng, trả 422 EMPTY_UPLOAD) có thể để lại 2 lượt import trạng thái AWAITING_UPLOAD (không có file, không có VĐV). Chưa liệt kê id.
- Các e2e API tự dọn theo fixture riêng.
- Dữ liệu "A5 check" cũ giữ nguyên.

## Câu hỏi mở
- Có muốn dọn dữ liệu "A6 check" trên TEST DB không?
- Có muốn đưa mã lỗi từ worker (Q5) để thay regex?

**Status:** DONE_WITH_CONCERNS
**Summary:** Tab Danh sách đăng ký theo Figma 1-14: pills, toolbar, form thêm thu gọn, nhập Excel 3 bước ngay trong tab (`?import=` sống qua reload), "Cách sửa" cho dòng lỗi; `/imports/:id` dùng chung panel. Admin typecheck/lint/test/build xanh, API tsc + entries e2e 20/20, trình duyệt 1280/390 sạch.
**Concerns:** E2E client đã sửa selector nhưng chưa chạy; "Cách sửa" dựa regex trên thông báo worker; thêm thay đổi API nhỏ (tìm theo mã/CLB); để lại dữ liệu test "A6 check" và có thể 2 import AWAITING_UPLOAD mồ côi.
