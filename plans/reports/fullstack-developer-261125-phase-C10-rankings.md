# Báo cáo phase C10 — Bảng xếp hạng công khai

Ngày: 2026-11-25. Phạm vi: `apps/client/**` (trừ `tests/admin-full-flow`). Chưa commit.

## Kết quả
- `/rankings/<code>`: breadcrumb (Trang chủ / Xếp hạng / tên bảng), h1 in hoa, "Cập nhật ngày …", bộ chọn bảng, `FilterForm` GET (tìm + CLB) giữ nguyên, h2 đếm kết quả, danh sách `<ol>` mỗi dòng một `<details>`, phân trang giữ filter.
- Summary (không có link bên trong): hạng, biến động (▲/▼/– + số + "(trước: N)", chữ ẩn cho screen reader), avatar, tên, CLB, số giải, điểm, chevron. Panel: tiêu đề "Điểm theo từng giải – tên", link "Xem hồ sơ vận động viên" (chỉ khi có `slug`), bảng giải / hạng giải / thành tích / điểm / hết hạn, nhãn "Sắp hết hạn", hàng "Tổng điểm". Mobile: bảng còn 2 cột, dòng phụ "hạng · thành tích · hết hạn …", đủ mọi khoản (không "Xem thêm").
- "Sắp hết hạn": `lib/expiring-soon.ts`, ngưỡng từ `config.display.rankingExpiringSoonDays` (có sẵn trong `/site`, mặc định registry khi API lỗi); 0 = tắt; chỉ khi chưa hết hạn.
- Bộ chọn bảng: <= 5 bảng → tab theo bảng; > 5 → tab theo Đơn/Đôi + dãy link các bảng cùng loại.
- `/rankings` giữ route, `?kind`; thẻ top N có đầu navy, tab dạng gạch chân; biến động dùng chung `RankMovement` (trang VĐV cũng nhận kiểu mới, nay có "(trước: N)" khi truyền `previousRank`).
- Chuỗi mới vi + en (`rankings.previousRank/change/tournaments/expiringSoon/total/breakdownTitle/viewProfile/listsNav/kindsNav/expiresOn`); test parity i18n đạt.
- Link "Xem trên BXH" từ hồ sơ VĐV (C9) trỏ `/rankings/<code>` không query: vẫn đúng.

## Files
Sửa: `app/[locale]/rankings/page.tsx`, `rankings/[listCode]/page.tsx`, `components/rankings/{rank-movement,ranking-table,ranking-top-card}.tsx`, `rankings.module.css`, `i18n/vi.json`, `en.json`, `tests/e2e/rankings-and-players.spec.ts`.
Tạo: `components/rankings/{ranking-accordion-list,ranking-row-summary,points-breakdown-panel,ranking-list-switcher,ranking-page-header}.tsx`, `ranking-accordion.module.css`, `lib/expiring-soon.ts`, `tests/unit/expiring-soon.test.ts`.
Xóa: `points-breakdown-details.tsx`, `ranking-list-tabs.tsx` (thay bằng panel / PillNav). File lớn nhất 100 dòng (css), 70 dòng (tsx).

## Kiểm chứng thực (apps/client)
- `pnpm typecheck`: sạch. `pnpm lint`: sạch.
- `pnpm test`: 34 file, 178/178 đạt (gồm 7 ca `expiring-soon`).
- `pnpm test:print`: 2 file, 9/9 đạt.
- Trình duyệt (`next dev -p 3390`, TEST DB, API :3000), `RD-ad596c2d` + `/vi/rankings` + `/en/rankings`, 1440 và 390: status 200, axe (wcag2a/aa/21aa/22aa) 0 (cả khi mở dòng), overflow 0, 1 h1.
- Focus: Tab qua 10 (1440) / 13 (390) phần tử trong main, đều outline >= 2px; Enter trên summary mở dòng; `?q=` giữ trong ô tìm; không JS vẫn mở được `<details>`.
- HTML 43.316 byte (1 dòng); không có `<a>` trong `<summary>`; trang en không lẫn chuỗi vi.
- Lỗi tương phản axe lúc đầu (`(trước: N)` màu subtle trên nền dòng mở) đã sửa sang `--color-text-muted`.
- Ảnh: `scratchpad\c10\*.png`. Server :3390 đã dừng (chỉ PID 20836); :3000, :5173 vẫn chạy.

## Chưa làm / lệch spec
- `pnpm build`, e2e Playwright (cần world seed riêng), Lighthouse: chưa chạy. E2E đã sửa theo `<ol>/<details>` nhưng chưa chạy được.
- "Cách tính điểm" (Q9): ẩn, vì `/site` chưa có setting slug trang CMS. Cần API/shared thêm nếu muốn hiện (ngoài phạm vi, không tự đổi).
- "Kỳ xếp hạng tháng 3/2027" ở Figma: không hiển thị (không có dữ liệu).
- Không có `<select>` bảng: dùng dãy link (server-side, không JS) cho trường hợp > 5 bảng; nhánh này chưa kiểm bằng dữ liệu (test DB chỉ 3 bảng).
- Nhãn "Sắp hết hạn" chưa thấy trên dữ liệu test (hạn 2100); chỉ kiểm bằng unit test. Ngày "hôm nay" lấy theo UTC (không có timezone công khai cho BXH).
- Màu nền vàng nhạt/chữ nâu của nhãn "Sắp hết hạn" là hex trực tiếp (chưa có token); tương phản ~8:1.
- Không có cỡ trang "10 dòng/trang" (theo spec); không tô đỏ hạng 1-3 (chỉ dòng đang mở) vì lọc/phân trang làm "top 3" sai.
- Không có id neo dòng (bản cũ không có).

**Status:** DONE_WITH_CONCERNS
**Summary:** Danh sách xếp hạng dạng accordion theo Figma 1-3/1-31, tổng quan navy, nhãn sắp hết hạn theo setting; typecheck, lint, test 178, test:print 9 đạt; axe 0, không tràn, focus thấy ở 1440/390.
**Concerns/Blockers:** build, e2e, Lighthouse chưa chạy; "Cách tính điểm" ẩn do thiếu setting phía API (NEEDS_CONTEXT nếu muốn hiện: cần `/site` trả slug trang CMS).
