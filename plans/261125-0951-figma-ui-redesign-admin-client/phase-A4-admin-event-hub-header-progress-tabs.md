# Phase A4 — Hub giải: header, "Tiến độ chuẩn bị", thanh tab, pill nội dung dùng chung

## Context links
- Gap: [research/admin-figma-gap.md](./research/admin-figma-gap.md) mục "1-8"
- Figma: `figma/admin/1-8.png` (header + stepper), `1-21.png` / `1-30.png` (header khi đã công bố: "Xem trang giải" + "…")
- Code: `apps/admin/src/pages/event-hub/event-hub-page.tsx`, `event-hub-actions.tsx`, `hub-tab-context.ts`, `sub-event-side-menu.tsx`, `apps/admin/src/runtime-config.ts`, `apps/admin/src/main.tsx`; API `entries-query.service.ts:58-69` (entry-counts), `draws/draw-read.service.ts:70-97` (draws overview), `matches/match-query.service.ts`
- Câu hỏi mở: Q2 (xem trước giải nháp)

## Overview
- Ưu tiên: P1 (A5–A9 dùng). Effort: ~5h. Trạng thái: done (API route + UI; kiểm trình duyệt có stub progress). Phụ thuộc: A1.
- Header mới, stepper tiến độ 5 bước (bấm để sang tab), đổi nhãn tab, component `SubEventPills` thay side menu ở các tab sau.

## Key insights
- Công bố giải không có điều kiện (`events.service.ts:89-91`) và thường làm sớm → stepper chỉ báo, không chặn. Chữ: "Còn N bước chưa xong", không phải "trước khi công bố".
- Một endpoint `GET /admin/events/:id/progress` (count/groupBy) gọn hơn ghép 4 request ở client và định nghĩa "xong" nằm một chỗ, test được.
- Định nghĩa bước (hàm thuần trong shared để API + test dùng chung):
  - Thông tin: luôn "xong" khi giải tồn tại (trường bắt buộc đã validate lúc tạo).
  - Nội dung: xong khi `subEvents ≥ 1`.
  - Danh sách: xong khi mọi nội dung có `confirmed ≥ 2`; đang làm khi tổng > 0.
  - Bốc thăm: `published/total` nội dung (một nội dung "xong" khi mọi draw bắt buộc — GROUP nếu vòng bảng, QUALIFYING nếu có vòng loại, MAIN — đã PUBLISHED); đang làm khi có draw bất kỳ.
  - Lịch: `scheduled/total` trận không BYE, chưa WALKOVER; xong khi không còn trận SCHEDULED chưa xếp và total > 0.
- Ngưỡng "≥ 2 entry" là ràng buộc kỹ thuật tối thiểu để bốc thăm (không phải chính sách) → giữ trong code, ghi lý do trong comment.
- Giữ key tab trong URL (`info`, `sub-events`, `entries`, `draws`, `schedule`, `sponsors`) và `?subEvent=` — E2E dùng (`apps/client/tests/admin-full-flow/draws.ts:15`, `events-and-imports.ts:63`).
- Giữ tab "Tài trợ" (Figma bỏ sót). Tab "Kết quả" do A9 thêm.
- `PUBLIC_SITE_URL` đã nạp ở `runtime-config.ts` nhưng chưa có setter → thêm `public-site-url.ts` giống `setApiBase`.

## Requirements
Chức năng
- API `GET /admin/events/:id/progress` (quyền `tournaments.read`) → `{ subEvents, entries: { confirmed }, draws: { subEventsDone, subEventsStarted, total }, matches: { total, scheduled, official } }`.
- Header: nút ← (về `/events`, có `aria-label`) · tên giải · Tag hạng giải (`colorHex`) · Tag "Nháp"/"Đã công bố" · Tag vòng đời khi Đang diễn ra/Đã hủy; dòng phụ "dd/mm – dd/mm/yyyy · Địa điểm · N nội dung · M lượt đăng ký".
- Nút phải: "Xem trang giải" (mở `PUBLIC_SITE_URL/vi/events/<slug>` tab mới; chỉ bật khi PUBLISHED, nháp thì disabled + tooltip "Công bố để xem trên trang công khai" tới khi chốt Q2) · "Sửa thông tin" (→ tab info, ẩn khi đang ở tab info) · nút chính: "Công bố giải" khi nháp / không có khi đã công bố · menu "…": Bỏ công bố, Hủy giải/Bỏ hủy (giữ hộp xác nhận hiện có).
- Stepper (antd `Steps` type navigation, responsive vertical < md): 5 bước, mỗi bước có trạng thái + chú thích (“Đã xong”, “Đang làm · 3/5 nội dung”, “Chưa bắt đầu”), bấm → `navigate(/events/:id/<tab>)`. Có thể thu gọn khi mọi bước xong.
- Tabs: Thông tin · Nội dung thi đấu · Danh sách đăng ký · Bốc thăm · Lịch thi đấu · Tài trợ (quyền) — đổi nhãn, giữ key.
- `SubEventPills`: Segmented ngang cuộn được trên mobile, nhãn `subEventTitle` + số đếm hoặc chấm trạng thái (prop render), đồng bộ `?subEvent=`; dùng ở A6, A7.
- Mọi ghi trong tab (`onChanged`) invalidate key tiến độ.
- `useBreadcrumbTail(event.name)`.

Phi chức năng
- Progress endpoint ≤ 5 truy vấn đếm; không đọc danh sách trận.

## Architecture
```
EventHubPage
 ├─ useQuery(event)            (có sẵn)
 ├─ useEventProgress(id)       → GET /admin/events/:id/progress
 ├─ EventHubHeader(event, progress, actions)
 ├─ EventProgressStepper(steps = eventProgressSteps(progress))
 └─ Tabs(HUB_TABS) → tab(context{..., refreshProgress})
API: EventProgressService ── count subEvent / groupBy entry / draws per subEvent / match counts
shared: eventProgressSteps(progress) → [{key, tab, status, caption}]  (thuần, test)
```

## Related code files
Tạo
- `packages/shared/src/event-progress.ts` (+ `event-progress.test.ts`), export ở `packages/shared/src/index.ts`
- `apps/api/src/modules/events/event-progress.service.ts`
- `apps/api/test/event-progress.e2e-spec.ts`
- `apps/admin/src/api/public-site-url.ts`
- `apps/admin/src/pages/event-hub/event-hub-header.tsx`
- `apps/admin/src/pages/event-hub/event-progress-stepper.tsx`
- `apps/admin/src/pages/event-hub/use-event-progress.ts`
- `apps/admin/src/pages/event-hub/sub-event-pills.tsx`
Sửa
- `apps/api/src/modules/events/admin-events.controller.ts` (route `:id/progress`), `events.module.ts`
- `apps/admin/src/main.tsx` (set public site URL)
- `apps/admin/src/pages/event-hub/event-hub-page.tsx`
- `apps/admin/src/pages/event-hub/event-hub-actions.tsx` (nút chính + menu "…")
- `apps/admin/src/pages/event-hub/hub-tab-context.ts` (`onChanged` gọi cả refresh progress)

## Implementation steps
1. Shared `event-progress.ts` (types + `eventProgressSteps`) + test các trạng thái biên.
2. API service + route + e2e (giải rỗng; có nội dung chưa entry; bốc 1/2; xếp lịch một phần).
3. `public-site-url.ts` + `main.tsx`.
4. Header + actions (giữ `ConfirmActionButton` cho từng hành động).
5. Stepper + hook; `onChanged` refetch cả event và progress.
6. `SubEventPills` (chưa thay tab nào; A6/A7 thay).
7. Đổi nhãn tab; breadcrumb tail.
8. typecheck/lint/build; chạy E2E admin-full-flow nếu stack local sẵn (theo `docs/code-standards.md` mục Kiểm thử).

## Todo
- [x] shared event-progress + test
- [x] progress service/route/e2e
- [x] public-site-url
- [x] header + actions "…"
- [x] stepper
- [x] SubEventPills
- [x] nhãn tab + breadcrumb
- [x] build/test xanh

## Success criteria
- Bốc thăm/xếp lịch xong trong tab → stepper đổi trạng thái không cần reload.
- Bấm bước "Lịch thi đấu" → URL `/events/:id/schedule`.
- Giải nháp: "Xem trang giải" disabled có tooltip; đã công bố: mở đúng URL công khai.
- E2E admin-full-flow vẫn qua (selector theo URL).

## Risk assessment
| Rủi ro | K × T | Giảm thiểu |
|---|---|---|
| Định nghĩa "xong" khác kỳ vọng BTC | TB × Thấp | Chỉ là chỉ báo; định nghĩa một chỗ (shared), dễ chỉnh |
| `PUBLIC_SITE_URL` rỗng ở local | Cao × Thấp | Rỗng → ẩn nút |
| Stepper chiếm chỗ màn hình nhỏ | TB × Thấp | Dọc/thu gọn < md |
Rollback: revert; endpoint mới độc lập.

## Security considerations
- Route đọc, quyền `tournaments.read` (OPERATOR có read) — không lộ dữ liệu mới ngoài số đếm.
- Link công khai mở với `rel="noopener"`.

## Next steps
- A5 (bảng nội dung), A6/A7 dùng `SubEventPills`, A9 thêm tab "Kết quả". Q2 cho xem trước giải nháp.
