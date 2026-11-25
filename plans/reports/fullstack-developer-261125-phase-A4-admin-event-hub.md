# Báo cáo phase A4 — hub giải: header, tiến độ chuẩn bị, tab (2026-11-25)

## Đã làm
API (`apps/api/src/modules/events/`, không đụng packages/shared, không schema/migration):
- `event-progress.ts` (hàm thuần: draw bắt buộc = MAIN + GROUP nếu GROUP_KNOCKOUT + QUALIFYING nếu hasQualifying; ngưỡng `MIN_ENTRIES_FOR_DRAW = 2` là mức tối thiểu kỹ thuật để bốc thăm), `event-progress.service.ts` (subEvent+draws 1 truy vấn, entry.groupBy, 3 count trận trong 1 transaction; trận tính = không BYE/WALKOVER, không voided), `event-progress.test.ts`.
- `admin-events.controller.ts`: `GET admin/events/:id/progress` (quyền `tournaments.read`), đặt trước `:id`; `events.module.ts` đăng ký service.
- Response: `{ subEvents, entries:{confirmed, subEventsReady}, draws:{subEventsDone, subEventsStarted, total}, matches:{total, scheduled, official} }`. Thêm `subEventsReady` so với spec để "Danh sách xong" tính được ở server.
- `test/event-progress.e2e-spec.ts`: 4 case.

Admin (`apps/admin/src/`):
- Định nghĩa bước đặt tại admin (không dùng shared vì C2 đang giữ): `pages/event-hub/event-progress-steps.ts` + `test/event-progress-steps.test.mjs` (6 test).
- `event-hub-header.tsx` (PageHeader: tag hạng giải, Nháp/Đã công bố, vòng đời trừ Sắp diễn ra; dòng phụ ngày · địa điểm · N nội dung · M lượt đăng ký), `event-hub-actions.tsx` viết lại (Xem trang giải, Sửa thông tin ẩn ở tab info, nút chính "Công bố giải", menu "…" gồm Bỏ công bố / Hủy giải / Bỏ hủy giải, giữ hộp xác nhận), `event-progress-stepper.tsx` (bấm bước sang tab, dọc < md, thu gọn/mở rộng, tự thu gọn khi xong cả 5), `use-event-progress.ts`, `sub-event-pills.tsx` (+ `useSubEventParam`, chưa tab nào dùng — A6/A7), `api/public-site-url.ts` + `main.tsx`.
- `event-hub-page.tsx`: nhãn tab "Danh sách đăng ký", "Lịch thi đấu" (key URL giữ nguyên), `useBreadcrumbTail(event.name)`, `onChanged` refetch cả progress.
- Q2: "Xem trang giải" disabled + tooltip khi nháp; ẩn khi `PUBLIC_SITE_URL` rỗng; link `rel="noopener noreferrer"`, locale `vi` là hằng cục bộ trong `public-site-url.ts`.
- Làm mới progress: hook theo dõi query cache, khi các query của tab (draws, draw view, entry-counts, schedule, sessions, sub-events) tải lại thành công thì invalidate progress. Không sửa các tab.

## Kiểm tra (chạy thật)
- admin: `pnpm typecheck` sạch, `pnpm lint` sạch, `pnpm test` 51/51, `pnpm build` OK (chỉ cảnh báo chunk > 500 kB có sẵn).
- api: `tsc --noEmit` sạch; eslint `src/modules/events` + e2e spec sạch.
- api unit (qua wrapper, dòng log đầu `localhost:5433/kamito_tt_phase12_test`): 2 file, 6/6 pass.
- api e2e (wrapper, `X_ENV_APP_ENV=test`): `test/event-progress.e2e-spec.ts` 4/4 pass (giải rỗng; 12 entry/2 nội dung/2 draw đã công bố nhưng chưa xong vì có vòng loại; bật/tắt hasQualifying, xếp 1 trận, 1 OFFICIAL; loại BYE/WALKOVER khỏi tổng = 8; operator đọc được, 404, 401).
- Trình duyệt (`scratchpad/check-a4-hub.mjs`, ảnh `scratchpad/a4/`), 1280 và 390: overflow ngang 0 mọi lần đo; console không có warning/error sau đăng nhập (1 lỗi 401 trước đăng nhập, có sẵn).
  - Breadcrumb: Trang chủ / Giải đấu / tên giải. Tab: Thông tin · Nội dung thi đấu · Danh sách đăng ký · Bốc thăm · Lịch thi đấu · Tài trợ.
  - Nháp: "Xem trang giải" disabled, tooltip "Công bố giải để xem trên trang công khai"; nút "Công bố giải" là nút chính; "Sửa thông tin" ẩn ở tab info.
  - Bấm bước "Lịch thi đấu" -> URL `/events/<id>/schedule`, tab Lịch thi đấu active.
  - Mở lại trang tab bốc thăm: số lần gọi progress 1 -> 3, tức query của tab tải xong thì progress được làm mới.

## Nói thẳng về giới hạn
- STUB: API :3000 chạy code cũ, em không restart. Trong trình duyệt, `GET /admin/events/:id/progress` bị chặn bằng Playwright route. Payload "real-derived" tính từ các endpoint thật (sub-events, entry-counts, draws, matches), nhưng KHÔNG phải kết quả của endpoint mới; endpoint mới chỉ được kiểm bằng e2e. Event seed chỉ có 0 nội dung nên đó mới toàn "Chưa bắt đầu".
- Các ảnh "partial", "done", "published" dùng payload và `publishStatus` GIẢ LẬP (synthetic), ghi rõ trong script. `/config.json` cũng được route để có `PUBLIC_SITE_URL`. Link công khai kiểm được là `http://localhost:3001/vi/events/debts-38763896`, `target=_blank`, `rel=noopener noreferrer`, nhưng chỉ thấy khi giả lập PUBLISHED.
- Chưa kiểm trên trình duyệt: stepper tự đổi sau một lần bốc thăm/xếp lịch thật (cần API mới + dữ liệu); mới chứng minh cơ chế làm mới qua tải lại tab. Chưa chạy E2E admin-full-flow.
- Vi phạm quy tắc: em chạy `pnpm exec vitest run src/modules/events` ở apps/api không qua wrapper, lúc chạy lệnh e2e đầu tiên chưa có quy tắc, ngay sau khi viết `event-progress.ts` (giờ 03:32). Lệnh nạp `.env` gốc qua `vitest.config.ts:8`. Hai file test chỉ import hàm thuần, không Prisma, nên không thấy dấu hiệu chạm DB dev (kết luận từ đọc import, chưa đo kết nối). Đã chạy lại 2 file đó qua wrapper, pass. Lần e2e đúng wrapper, nhưng em cắt đuôi log nên chưa xác nhận dòng đầu của lần đó; lần chạy lại đã xác nhận.
- Không commit; các file thay đổi khác của C2 và A3 không động tới.
- Đã đánh dấu todo trong `phase-A4-*.md`.

## Câu hỏi mở
- Restart API test để kiểm progress thật trên trình duyệt?
- Có cần tab Kết quả vào stepper (A9) hay giữ 5 bước?

**Status:** DONE_WITH_CONCERNS
**Summary:** A4 xong: endpoint progress + e2e, header/stepper/menu "…"/tab/SubEventPills, breadcrumb tail; typecheck/lint/test/build xanh.
**Concerns:** Trình duyệt dùng stub cho progress và payload giả lập cho các trạng thái partial/done/published. Có một lần chạy vitest ở apps/api không qua wrapper (chi tiết ở trên).
