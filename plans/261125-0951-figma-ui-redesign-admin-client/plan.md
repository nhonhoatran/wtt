---
title: Làm lại giao diện admin + site công khai theo Figma
status: in-progress
created: 2026-11-25
---

# Làm lại giao diện theo Figma (admin + client)

Nguồn: 2 file Figma "Kamito Tournament – Admin/Client" (sửa lần cuối 2026-11-12). File chỉ chứa ảnh chụp mockup (không có layer), nên màu/chữ/khoảng cách đọc bằng mắt; số liệu trong ảnh là dữ liệu mẫu. Ảnh đã xuất: [figma/admin](./figma/admin/index.tsv), [figma/client](./figma/client/index.tsv) — frame cuối mỗi section là bản chốt.

Phân tích: [admin gap](./research/admin-figma-gap.md) · [client gap](./research/client-figma-gap.md). Câu hỏi chờ chốt: [admin Q1–Q12](./admin-open-questions.md) · [client Q1–Q11](./client-open-questions.md). Trong lúc chờ, các phase làm theo cột "trong lúc chờ" (ẩn phần chưa có dữ liệu, không hiện dữ liệu giả).

## Nguyên tắc
- Dữ liệu thật từ API; giá trị nghiệp vụ là setting/DB có mặc định. List/lọc/phân trang ở server.
- Lệch Figma khi Figma kém dễ dùng hoặc trái quy tắc nghiệp vụ — lý do ghi trong phase.
- Không `prisma db push`; plan hiện không cần migration (trừ khi chốt admin Q8).
- Kiểm trình duyệt trên DB test `localhost:5433/kamito_tt_phase12_test`.

## Phase

| Phase | Nội dung | Ước lượng | Phụ thuộc | Trạng thái |
|---|---|---|---|---|
| [A1](./phase-A1-admin-shell-and-tokens.md) | Shell admin + token | 4h | — | Xong — [báo cáo](../reports/fullstack-developer-261125-phase-A1-admin-shell.md) |
| [A2](./phase-A2-admin-dashboard-overview.md) | Tổng quan | 6h | A1, sau C2 (chung `app-setting-registry.ts`) | Xong (commit 4a23d31–1ca5582) — [báo cáo](../reports/fullstack-developer-261125-phase-A2-admin-dashboard.md) |
| [A3](./phase-A3-admin-events-list.md) | Danh sách giải + thống nhất nhãn "Giải đấu"/"Vận động viên" | 4h | A1 | Xong (số đếm thật đã kiểm với API mới) — [báo cáo](../reports/fullstack-developer-261125-phase-A3-admin-events-list.md) |
| [A4](./phase-A4-admin-event-hub-header-progress-tabs.md) | Header hub + tiến độ + tab | 5h | A1 | Xong — [báo cáo](../reports/fullstack-developer-261125-phase-A4-admin-event-hub.md) |
| [A5](./phase-A5-admin-sub-events-tab.md) | Tab nội dung thi đấu | 3h | A4 | Xong — [báo cáo](../reports/fullstack-developer-261125-phase-A5-admin-sub-events.md) |
| [A6](./phase-A6-admin-entries-and-excel-import.md) | Đăng ký + nhập Excel | 5h | A4 | Xong — [báo cáo](../reports/fullstack-developer-261125-phase-A6-admin-entries-import.md) |
| [A7](./phase-A7-admin-draw-preview-and-publish.md) | Bốc thăm | 5h | A4 | Xong (commit 4a23d31–1ca5582) — [báo cáo](../reports/fullstack-developer-261125-phase-A7-admin-draws.md); "Đổi chỗ" bảng nháp xong — [báo cáo](../reports/fullstack-developer-261125-draft-group-swap.md) |
| [A8](./phase-A8-admin-schedule-grid.md) | Lịch thi đấu | 4h | A4 | Xong (commit 4a23d31–1ca5582) — [báo cáo](../reports/fullstack-developer-261125-phase-A8-admin-schedule.md) |
| [A9](./phase-A9-admin-match-result-entry.md) | Nhập kết quả | 5h | A4 | Xong (commit 4a23d31–1ca5582) — [báo cáo](../reports/fullstack-developer-261125-phase-A9-admin-results.md) |
| [A10](./phase-A10-admin-ranking-points-rules.md) | Quy tắc điểm | 3h | A1 | Xong — [báo cáo](../reports/fullstack-developer-261125-phase-A10-ranking-rules.md) |
| [A11](./phase-A11-admin-ranking-board.md) | Bảng xếp hạng | 6h | A1, A10 | Xong — [báo cáo](../reports/fullstack-developer-261125-phase-A11-ranking-board.md) |
| [C1](./phase-C1-design-tokens-and-ui-primitives.md) | Token + primitive client | — | sau A1 (chung `packages/ui-tokens`) | Xong — [báo cáo](../reports/fullstack-developer-261125-phase-C1-client-tokens.md) |
| [C2](./phase-C2-public-api-read-extensions-and-display-settings.md) | API đọc + setting hiển thị + cache tag | — | — | Xong — [báo cáo](../reports/fullstack-developer-261125-phase-C2-public-api.md) |
| [C3](./phase-C3-site-shell-header-ticker-footer.md) | Header, ticker, footer | — | C1, C2 | Xong — [báo cáo](../reports/fullstack-developer-261125-phase-C3-site-shell.md) |
| [C4](./phase-C4-home-page.md) … [C10](./phase-C10-rankings.md) | Trang chủ → BXH (tuần tự, chung `vi.json`/`en.json`) | — | C3 | C4 xong — [báo cáo](../reports/fullstack-developer-261125-phase-C4-home-page.md); C5 xong — [báo cáo](../reports/fullstack-developer-261125-phase-C5-events-list-calendar.md); C6 xong — [báo cáo](../reports/fullstack-developer-261125-phase-C6-event-detail.md); C7 xong — [báo cáo](../reports/fullstack-developer-261125-phase-C7-bracket-groups.md); C8 xong — [báo cáo](../reports/fullstack-developer-261125-phase-C8-match-detail.md); C9 xong — [báo cáo](../reports/fullstack-developer-261125-phase-C9-player-profile.md); C10 xong — [báo cáo](../reports/fullstack-developer-261125-phase-C10-rankings.md) |
| [C11](./phase-C11-mobile-regression-gates-and-docs.md) | Mobile, axe/Lighthouse, docs (kèm thẻ "Vòng sau" mobile theo Figma 1-34) | — | C4–C10 | Đang kiểm cuối — [tester](./reports/tester-261125-client-figma-regression.md); build, public/axe và Lighthouse đạt; admin-full-flow đạt 2026-11-26 ([báo cáo](../reports/tester-261126-1620-admin-full-flow-after-redesign.md)); còn kiểm đủ ảnh-PDF/review cuối |

Ước lượng client tổng khoảng 44h (chi tiết trong từng phase).

## Đồng bộ tiến độ 2026-11-25

- Đã rà toàn bộ 22 phase theo báo cáo triển khai và các lượt sửa review. Checklist hiện có **151 mục đạt / 9 mục còn mở**; các mục tùy chọn chờ quyết định (`/search`, màu theo nội dung) được giữ riêng, không đánh dấu hoàn tất.
- “Xong” trong bảng phase mô tả phần triển khai. A8/A9/A10 còn E2E admin-full-flow; C7 còn mở kiểm đủ ảnh/PDF. Các phase này giữ `in-progress`; C4/C6/C10 đã có Lighthouse production đạt và chuyển `completed`.
- C11: lượt production/CSP enforce có 119 đạt/15 bỏ qua theo điều kiện môi trường/viewport/0 lỗi/0 flaky, axe 72 lượt không vi phạm; build gốc 9/9 task đạt. Unit client 188 và kiểm in 9 đạt; root typecheck/lint 14/9 task đạt. Sau lỗi Lighthouse r01 thiếu mô tả trang trận, regression 16/16 và focused build cuối 56/12 đạt; Lighthouse cuối bốn route bắt buộc 100/100/100, hai route tham khảo 99/100/100. Full 119/15 và unit 188 thuộc build trước sửa metadata, không cộng với focused. Admin-full-flow/kiểm đủ ảnh-PDF/review cuối chưa hoàn tất; giữ C11 đang làm.
- Các giới hạn dữ liệu chưa xuất hiện trên trình duyệt trong báo cáo triển khai vẫn được giữ; không suy ra đã kiểm từ kết quả unit.

## Đồng bộ tiến độ 2026-11-26

- Admin-full-flow sau redesign: desktop đạt 8/8 một lượt, mobile đạt 8/8 hai lượt trên `localhost:5433/kamito_tt_phase12_test`. Đã đánh dấu ô E2E của A8, A9, A10 và C11; checklist còn **155 mục đạt / 5 mục mở** (C11: đối chiếu ảnh với Figma, review diff cuối; C7: mở kiểm đủ ảnh/PDF; hai mục tùy chọn `/search` và màu theo nội dung).
- Lượt desktop đạt đầu tiên chạy trước hai chỉnh nhỏ cuối của helper; ba lượt desktop chạy lại rớt vì server mất kết nối và một lỗi API có sẵn (E1). Sau khi sửa E1, desktop 8/8 và mobile 8/8 trên helper cuối; E1 và E3 đóng, còn E2 và E4 ở [backlog](../261111-1512-kamito-table-tennis-tournament-platform/open-debts-backlog.md).
- A8, A9, A10 không còn việc mở ngoài Q8 tùy chọn của A8. C11 và C7 giữ `in-progress`.

## File dùng chung — chạy tuần tự
- `packages/ui-tokens` (`build-css-variables.test.ts`): A1 → C1.
- `packages/shared/src/app-setting-registry.ts`: C2 → A2.
- Setting dạng danh sách mới (menu, mạng xã hội) cần trình sửa thân thiện trên `/settings` admin — làm kèm A2 hoặc phase bổ sung.

## Việc còn mở từ code review 2026-11-25
- A8: E2E tích hợp sau redesign đạt 2026-11-26, [backlog L4](../261111-1512-kamito-table-tennis-tournament-platform/open-debts-backlog.md) đã đóng. L1/L2 đã đóng theo [báo cáo ba engine/lưới 6 bàn](../reports/tester-261125-a8-browser-gates.md).
- Focus sáng trên sider tối đã kiểm đạt ở [báo cáo A1](../reports/fullstack-developer-261125-phase-A1-admin-shell.md); kéo bàn phím trên Chromium đã kiểm đạt ở [báo cáo A8](../reports/fullstack-developer-261125-phase-A8-admin-schedule.md).
