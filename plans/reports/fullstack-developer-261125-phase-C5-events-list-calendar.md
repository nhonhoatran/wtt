# Báo cáo phase C5 — danh sách giải và lịch tháng (2026-11-25)

## Đã làm (apps/client)
- `/events`: `EventsPageHeader` (breadcrumb, h1, mô tả, chip "N giải [trong năm Y]", link "Xem theo lịch tháng"); `FilterForm` kiểu Figma (nhãn trên ô, nền xám, vẫn giữ ô tìm `q` + loại giải + hạng + năm); `EventStatusPills` (link GET, giữ q/tier/type/year, bỏ page, `aria-current`); nhóm theo tháng trên mục của trang hiện tại; `PaginationLinks` thêm dòng "Hiển thị a–b trong N kết quả".
- Trạng thái chọn bằng pill, không còn select trùng; submit form vẫn giữ `status` qua `keep`; "Xóa lọc" về `/events` (prop mới `clearHref`, `extraActive`).
- Giá trị form/pill/chip lấy từ query đã qua `toQuery` (tier/year/status rác bị bỏ, không phản chiếu lại).
- `/events/calendar`: dùng cùng header + `EventMonthList` + `EventListRow`; link "Xem danh sách" (giữ năm).
- Hàng giải `EventListRow`: khối ngày navy (`formatDateBlock`, vắt tháng/năm ghi cả hai đầu), `TierBadge filled`, tên loại giải, tên là link chính, địa điểm, `SubEventChips`, "N nội dung", `StatusPill`, CTA (ONGOING -> `/matches` "Xem lịch & kết quả"; khác -> trang giải "Xem chi tiết", `aria-describedby` trỏ tên giải). Không hiện Thưởng / Hạn đăng ký / số VĐV.
- `EventCard` (trang chủ): bỏ nhánh có banner không còn ai dùng và prop `compact`; xóa css thừa.
- Mới: `lib/group-events-by-month.ts`, `lib/format-date-block.ts`, `components/events/{event-list-row,event-month-list,event-status-pills,events-page-header}` (+css).
- i18n vi + en: `events.*` (description, breadcrumb, count, countInYear, viewCalendar, subEventCount, scheduleCta, detailsCta), `calendar.description/viewList`, `common.showingRange`.
- Test: `group-events-by-month` (4), `format-date-block` (5), `events-list-controls` (4: dòng phạm vi, pill giữ filter, aria-current); e2e `event-pages.spec.ts` thêm kiểm h2 tháng, pill "Tất cả", không có "Thưởng"/"Hạn đăng ký"; `accessibility.spec.ts` thêm `/events?q=` và `/events/calendar`.

## Kiểm chứng (chạy thật)
- apps/client: `pnpm typecheck` sạch; `pnpm lint` sạch; `pnpm test` 29 file / 135 test đạt; `pnpm build` đạt.
- Trình duyệt (`next start` cổng 3314, API thật :3000 test DB; script `scratchpad\c5\check.mjs`), 1440 và 390, vi + en: `/events`, `?status=completed`, `?q=zzzznomatch` (trạng thái rỗng), `?tier=bogus&page=abc&status=x`, `/events/calendar`:
  - HTTP 200 mọi route; axe 0 vi phạm; `scrollWidth - clientWidth = 0`; Tab 30 lần: 0 điểm dừng không có indicator (cả 2 viewport).
  - `?status=completed` -> `hiddenInputs: status=completed`, pill đang chọn "Đã kết thúc"; filter rác -> về `/vi/events` sạch.
  - JS tắt (`javaScriptEnabled:false`): bấm pill -> `/vi/events?year=2026&status=completed`; submit lọc -> `?status=completed&q=&tier=RT-ad596c2d&type=&year=2026` (giữ trạng thái); "Xóa lọc" -> `/vi/events`.
  - Ảnh: `scratchpad\c5\_vi_events-1440.png`, `_vi_events-390.png`, `_en_events_calendar-390.png` và các route còn lại. Đã mở xem: bố cục theo Figma 1-14 (khối ngày navy, tên đậm, chip, cột phải trạng thái + CTA); mobile xếp dọc, khối ngày thành thanh ngang.
- Ticker (xem dưới): ảnh `scratchpad\c5\ticker-vi-1440.png`, `ticker-vi-390.png`, `ticker-en-1440.png`, `ticker-en-390.png`.
- Đã dừng Next 3314/3316 và proxy 3315 (chỉ PID của em); `netstat` 0 listener ở 3314/3315/3316; API :3000 và admin :5173 vẫn LISTENING.

## Ticker kết quả
- Bật `header.resultsStrip.enabled` qua admin API (đăng nhập UI admin) rồi gọi `GET /public/results/strip`: trả `{"data":{"items":[]}}`. Lý do thật: ticker chỉ lấy trận của giải **đang diễn ra hôm nay** (`public-results-strip.query.ts:31-38`); giải duy nhất đang diễn ra ("Entries dc9ac4", 17/08/2026–05/03/2027) chưa có trận OFFICIAL/LIVE. Giải có kết quả (`entries-3f305b`) ở 2099 nên bị lọc. Không sửa dữ liệu nên API không cho dữ liệu thật.
- Cách chụp: proxy C4 (`c4\strip-proxy.mjs`) chuyển tiếp API thật, riêng `/results/strip` dựng từ 4 trận đã xong thật của `entries-3f305b` (`?state=completed`); Next thứ hai cổng 3316 trỏ vào proxy. Vậy dữ liệu trận là thật, chỉ bước chọn giải "đang diễn ra" bị bỏ qua. Khai rõ để không nhầm là API tự trả.
- Kết quả hiển thị: 4 thẻ (MD · Bảng A, MD · Bảng A · Bàn T1, WS · Bán kết · Bàn T1) có pill "Có kết quả", người thắng nổi bật, điểm từng ván ở thẻ bán kết, link "Tất cả trận đấu"; 390 cuộn ngang trong dải, không tràn trang (overflow 0).
- **Setting đã khôi phục**: trước = `value:false, isDefault:true, updatedAt:null`; bật bằng PUT, trả lại bằng `DELETE /admin/settings/header.resultsStrip.enabled` (reset về mặc định); đọc lại: `{"value":false,"isDefault":true}` và probe cuối `updatedAt:null`. Không đổi dữ liệu nào khác.
- **Phát hiện a11y (axe, ticker bật)**: 1 vi phạm `label-content-name-mismatch` (WCAG 2.5.3) trên `ResultsStripItem` (mọi trang khi bật ticker, cả vi/en/1440/390): `aria-label` ("Trận #7, ..., tỉ số 2-1, LIVE") không chứa chữ nhìn thấy ("MD · Bảng A", "Có kết quả"...). Là code C3 (`results-strip-item.tsx:31`) và test khóa nhãn `site-chrome.test.ts:35`; em không sửa trong C5.

## Lệch / khai thật
- Nhóm tháng làm trên mục của trang hiện tại, không có "· N giải" (đúng spec). API trả thứ tự `2099-05` trước `2026-08` (thứ tự API, giữ nguyên).
- CTA ONGOING trỏ `/matches` theo spec; thẻ không có `tabs.matches` nên giải đang diễn ra mà chưa có trận sẽ ra 404 (`matches/page.tsx:34`). Chưa gặp trong DB test: giải ONGOING duy nhất của test DB mở `/events/entries-dc9ac4/matches` chưa kiểm (không nằm trong script).
- Phân trang chưa thấy trên trình duyệt (DB chỉ 3 giải, 1 trang); dòng phạm vi được kiểm bằng unit test render.
- Chưa chạy Playwright e2e (cần seed vào DB, bị cấm) nên `event-pages`, `site-chrome-and-seo`, `accessibility` mới chỉ được sửa, chưa chạy. Lighthouse chưa đo.
- English "Events: {n}" / "Categories: {n}" để tránh lỗi số ít/số nhiều ("1 events").
- Sửa `FilterForm`/`PaginationLinks` ảnh hưởng mọi trang dùng chung (tin, video, VĐV, xếp hạng, trận): nền xám của form và dòng phạm vi xuất hiện ở đó; chưa chụp lại các trang đó.
- Docs `docs/public-site.md` chưa cập nhật (ngoài ownership; docs impact minor).

## Files
- Sửa: `apps/client/src/app/[locale]/events/page.tsx`, `events/calendar/page.tsx`, `src/app/[locale]/page.tsx` (bỏ `compact`), `components/common/{filter-form.tsx,filter-form.module.css,pagination-links.tsx,pagination-links.module.css}`, `components/events/{event-card.tsx,event-card.module.css}`, `i18n/{vi,en}.json`, `tests/e2e/{event-pages,accessibility}.spec.ts`.
- Tạo: `components/events/{event-list-row,event-month-list,event-status-pills,events-page-header}.tsx` (+ 3 `.module.css`), `lib/{group-events-by-month,format-date-block}.ts`, `tests/unit/{group-events-by-month,format-date-block,events-list-controls}.test.ts`.
- Các file khác trong `git status apps/client` là thay đổi của C1–C4, không thuộc phase này.

**Status:** DONE_WITH_CONCERNS
**Summary:** Danh sách giải + lịch tháng theo Figma 1-14 xong; typecheck/lint/test (135)/build đạt; 1440 + 390 axe 0, không tràn, focus rõ, hoạt động khi tắt JS. Ticker đã chụp 1440 + 390 và setting đã khôi phục.
**Concerns:** (1) Ticker chỉ chụp được qua proxy dựng từ trận thật vì API thật trả rỗng (không có giải đang diễn ra có kết quả). (2) Ticker bật thì axe báo `label-content-name-mismatch` ở `results-strip-item.tsx` (C3), cần sửa riêng. (3) CTA giải ONGOING có thể 404 nếu chưa có trận (thẻ không có `tabs`); cân nhắc thêm `tabs.matches` vào `PublicEventCard` (API). (4) e2e chưa chạy.
