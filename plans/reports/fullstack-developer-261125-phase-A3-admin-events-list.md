# Báo cáo phase A3 — danh sách giải (2026-11-25)

## Đã làm
API (`apps/api/src/modules/events/`, không đụng file C2 đang sửa; không schema/migration):
- `event-list-counts.ts` (mới): `confirmedEntryCounts` (subEvent.findMany + entry.groupBy, chỉ cho giải trong trang) và `lifecycleCounts` (1 transaction: ALL + 4 count trên cùng base where của list).
- `events-query.service.ts`: tách `listSpec()` dùng chung cho list và counts; list trả thêm `entryCount` (entry CONFIRMED); thêm `lifecycleCounts(query)`; `EVENT_COUNT_RULES` (filter: eventTypeId, year, publishStatus; không cho `filter[lifecycle]`).
- `admin-events.controller.ts`: `GET admin/events/lifecycle-counts` (quyền `tournaments.list`), khai báo trước `:id`.
- `test/events.e2e-spec.ts`: thêm 1 case (tổng 4 vòng đời = ALL, lọc year/publishStatus, khớp `total` của list, 400 khi gửi lifecycle/year sai, operator đọc được, `entryCount` có mặt).

Admin (`apps/admin/src/`):
- `components/active-filter-chips.tsx` (mới, thuần hiển thị); `list-filter-bar.tsx`: prop tuỳ chọn `showActiveChips` (chip "Đang lọc:" có ×, nút "Đặt lại"); mặc định tắt nên các list khác giữ nguyên ("Xóa lọc"). Không thêm prop `onReset` (YAGNI, Đặt lại = xoá mọi lọc, giữ sort).
- `resources/events/`: `event-list.tsx` viết lại (PageHeader "Giải đấu" + mô tả, nút "Thêm giải", Card lọc: tìm / Năm / Hạng giải / Công bố), `event-lifecycle-tabs.tsx`, `event-list-columns.tsx`, `use-event-lifecycle-counts.ts`, `event-labels.ts` (`entryCount`, `LifecycleCounts`, `LIFECYCLE_ALL_LABEL`).
- Cột: Tên giải (link) + "n lượt đăng ký" · Hạng giải · Thời gian · Địa điểm (tên + thành phố) · Nội dung · Trạng thái (Tag vòng đời + "Bản nháp") · Thao tác (Xem | Sửa → `/events/:id/info`, Sửa chỉ khi `tournaments.update`).
- Q3: tab vòng đời + ô lọc Công bố riêng. Q4: không có nút "Xuất Excel".
- Nhãn đồng bộ menu: `app.tsx` (events -> "Giải đấu", players -> "Vận động viên"), `pages/event-hub/event-hub-page.tsx` (back link), `player-list.tsx` (tiêu đề). Create/edit back link lấy từ `meta.label` nên tự đổi theo. Chỉ nhãn.

## Kiểm tra (chạy thật)
- admin: `pnpm typecheck` sạch; `pnpm lint` sạch; `pnpm test` 45/45 pass; `pnpm build` OK (chỉ cảnh báo chunk > 500 kB có sẵn).
- api: `tsc --noEmit` sạch; eslint trên `src/modules/events` + spec sạch; vitest `src/modules/events` 3/3.
- api e2e (wrapper test-DB, `X_ENV_APP_ENV=test`, DB `localhost:5433/kamito_tt_phase12_test`): `test/events.e2e-spec.ts` 8/8 pass (gồm case mới). Lần đầu rớt do case mới dùng chung `tag` với case cũ -> đã đổi sang tiền tố riêng.
- Trình duyệt (`scratchpad/check-a3-events.mjs`, ảnh `scratchpad/a3/`), ADMIN:
  - 1280: 7 cột đúng thứ tự; tab `Tất cả (1) / Sắp diễn ra (1) / Đang diễn ra (0) / Đã kết thúc (0) / Đã hủy (0)`; bấm tab -> URL có `filters[0][field]=lifecycle...UPCOMING`, request list có `filter[lifecycle]=UPCOMING`, reload giữ tab; chọn Công bố = Bản nháp -> chip "Đang lọc: Công bố: Bản nháp"; "Đặt lại" xoá chip + lifecycle, URL còn sorters. Link: tên/Xem -> `/events/:id`, Sửa -> `/events/:id/info`. Overflow ngang 0.
  - 390: overflow 0, bảng cuộn ngang trong card, tab có nút "…".
  - Console: chỉ 1 lỗi 401 lúc kiểm tra phiên trước đăng nhập (có sẵn); không warning/pageerror.

## Lưu ý / hạn chế (nói thẳng)
- API :3000 chạy bản cũ, chưa restart: trong trình duyệt `lifecycle-counts` thật chưa tồn tại (sẽ bị route `:id` nuốt) và list chưa trả `entryCount`. Để kiểm UI em chặn request `lifecycle-counts` bằng Playwright route, trả số tính từ 5 request list thật (`total`). Số đếm ở bước này KHÔNG phải kết quả của endpoint mới; endpoint mới được kiểm bằng e2e. Dòng "n lượt đăng ký" chưa thấy trên trình duyệt (cần restart API); e2e chỉ kiểm `entryCount = 0`, chưa có case entry > 0 (cần dựng sub-event + entry, chưa làm).
- DB test chỉ có 1 giải nên chưa quan sát phân trang nhiều trang với tab.
- Không commit, không đụng thay đổi khác trong working tree. Chưa cập nhật checklist trong `phase-A3-*.md`.

## Câu hỏi mở
- Restart API test để xác nhận số đếm + `entryCount` trên trình duyệt?
- Có cần thêm case e2e entry > 0 cho `entryCount`?

**Status:** DONE_WITH_CONCERNS
**Summary:** A3 xong cả API (lifecycle-counts, entryCount) lẫn UI (tab đếm, chip, cột, nhãn); typecheck/lint/test/build xanh, e2e events 8/8.
**Concerns:** API đang chạy chưa nạp code mới nên số đếm/entryCount trên trình duyệt chưa kiểm bằng endpoint thật; `entryCount > 0` chưa có test.
