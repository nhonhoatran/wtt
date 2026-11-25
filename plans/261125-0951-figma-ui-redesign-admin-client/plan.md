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
| [A2](./phase-A2-admin-dashboard-overview.md) | Tổng quan | 6h | A1, sau C2 (chung `app-setting-registry.ts`) | Xong (chưa commit) — [báo cáo](../reports/fullstack-developer-261125-phase-A2-admin-dashboard.md) |
| [A3](./phase-A3-admin-events-list.md) | Danh sách giải + thống nhất nhãn "Giải đấu"/"Vận động viên" | 4h | A1 | Xong (số đếm thật đã kiểm với API mới) — [báo cáo](../reports/fullstack-developer-261125-phase-A3-admin-events-list.md) |
| [A4](./phase-A4-admin-event-hub-header-progress-tabs.md) | Header hub + tiến độ + tab | 5h | A1 | Xong — [báo cáo](../reports/fullstack-developer-261125-phase-A4-admin-event-hub.md) |
| [A5](./phase-A5-admin-sub-events-tab.md) | Tab nội dung thi đấu | 3h | A4 | Xong — [báo cáo](../reports/fullstack-developer-261125-phase-A5-admin-sub-events.md) |
| [A6](./phase-A6-admin-entries-and-excel-import.md) | Đăng ký + nhập Excel | 5h | A4 | Xong — [báo cáo](../reports/fullstack-developer-261125-phase-A6-admin-entries-import.md) |
| [A7](./phase-A7-admin-draw-preview-and-publish.md) | Bốc thăm | 5h | A4 | Xong (chưa commit) — [báo cáo](../reports/fullstack-developer-261125-phase-A7-admin-draws.md); "Đổi chỗ" bảng nháp xong — [báo cáo](../reports/fullstack-developer-261125-draft-group-swap.md) |
| [A8](./phase-A8-admin-schedule-grid.md) | Lịch thi đấu | 4h | A4 | Xong (chưa commit) — [báo cáo](../reports/fullstack-developer-261125-phase-A8-admin-schedule.md) |
| [A9](./phase-A9-admin-match-result-entry.md) | Nhập kết quả | 5h | A4 | Xong (chưa commit) — [báo cáo](../reports/fullstack-developer-261125-phase-A9-admin-results.md) |
| [A10](./phase-A10-admin-ranking-points-rules.md) | Quy tắc điểm | 3h | A1 | Xong — [báo cáo](../reports/fullstack-developer-261125-phase-A10-ranking-rules.md) |
| [A11](./phase-A11-admin-ranking-board.md) | Bảng xếp hạng | 6h | A1, A10 | Xong — [báo cáo](../reports/fullstack-developer-261125-phase-A11-ranking-board.md) |
| [C1](./phase-C1-design-tokens-and-ui-primitives.md) | Token + primitive client | — | sau A1 (chung `packages/ui-tokens`) | Xong — [báo cáo](../reports/fullstack-developer-261125-phase-C1-client-tokens.md) |
| [C2](./phase-C2-public-api-read-extensions-and-display-settings.md) | API đọc + setting hiển thị + cache tag | — | — | Xong — [báo cáo](../reports/fullstack-developer-261125-phase-C2-public-api.md) |
| [C3](./phase-C3-site-shell-header-ticker-footer.md) | Header, ticker, footer | — | C1, C2 | Xong — [báo cáo](../reports/fullstack-developer-261125-phase-C3-site-shell.md) |
| [C4](./phase-C4-home-page.md) … [C10](./phase-C10-rankings.md) | Trang chủ → BXH (tuần tự, chung `vi.json`/`en.json`) | — | C3 | C4 xong — [báo cáo](../reports/fullstack-developer-261125-phase-C4-home-page.md); C5 xong — [báo cáo](../reports/fullstack-developer-261125-phase-C5-events-list-calendar.md); C6 xong — [báo cáo](../reports/fullstack-developer-261125-phase-C6-event-detail.md); C7 xong — [báo cáo](../reports/fullstack-developer-261125-phase-C7-bracket-groups.md); C8 xong — [báo cáo](../reports/fullstack-developer-261125-phase-C8-match-detail.md); C9 xong — [báo cáo](../reports/fullstack-developer-261125-phase-C9-player-profile.md); C10 xong — [báo cáo](../reports/fullstack-developer-261125-phase-C10-rankings.md) |
| [C11](./phase-C11-mobile-regression-gates-and-docs.md) | Mobile, axe/Lighthouse, docs (kèm thẻ "Vòng sau" mobile theo Figma 1-34) | — | C4–C10 | Chờ |

Ước lượng client tổng khoảng 44h (chi tiết trong từng phase).

## File dùng chung — chạy tuần tự
- `packages/ui-tokens` (`build-css-variables.test.ts`): A1 → C1.
- `packages/shared/src/app-setting-registry.ts`: C2 → A2.
- Setting dạng danh sách mới (menu, mạng xã hội) cần trình sửa thân thiện trên `/settings` admin — làm kèm A2 hoặc phase bổ sung.

## Việc còn mở từ code review 2026-11-25
- Focus sáng trên sider tối → A1. Kiểm kéo lịch bằng bàn phím trên trình duyệt → A8.
