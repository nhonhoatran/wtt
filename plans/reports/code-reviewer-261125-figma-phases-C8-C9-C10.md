# Review phase C8, C9, C10 + vòng sửa 3 — 2026-11-25

Baseline HEAD `b35dfd3`, review thay đổi chưa commit trong `apps/client` (C8 chi tiết trận + bảng trận desktop, C9 hồ sơ VĐV, C10 BXH) và kiểm lại M1–M4 của `fullstack-developer-261125-review-fixes-round-3.md`. Không lặp lại phát hiện của các review `code-reviewer-261125-*.md` trước đó.

## Đã chạy (thật)
- Root `pnpm typecheck`: 14/14 task OK (exit 0). Root `pnpm lint`: 9/9 task OK (exit 0).
- `apps/client` `pnpm test`: 34 file / 178 test pass. `pnpm test:print`: 2 file / 9 test pass.
- `apps/admin` `pnpm test`: 98 pass, 0 fail. `packages/shared` `pnpm test`: 25 file / 121 test pass.
- vi.json / en.json: so khóa bằng script, không thiếu khóa bên nào; không có chuỗi tiếng Việt lọt vào en (trừ `nav.switchTo` = "Tiếng Việt", cố ý).
- KHÔNG chạy: test API, root `pnpm test`, e2e Playwright, build, lệnh chạm DB.

## Tổng quan
Code gọn, file nguồn đều < 200 dòng, server-side giữ nguyên (lọc/phân trang qua `searchParams`, `<details>` chạy không cần JS), dữ liệu công khai không thêm trường. Riêng tư đạt: `toPublicPlayer` chỉ trả slug/tên/CLB/ảnh, profile chỉ có `age` khi `showAge`, không có ngày/năm sinh. Góc nhìn VĐV (`player-match-perspective.ts`) đúng cho cả hai bên và cho đôi (so slug công khai, cùng định dạng với `publicPlayerSlug` của API; kết quả chỉ lấy theo `player.id` canonical). Bản desktop/mobile trùng nhau đều ẩn bằng `display:none`, nên cây a11y không bị lặp. Không có lỗi High. Lỗi chính là **e2e sẽ gãy** vì bản trùng desktop/mobile và vì bỏ `<table>` ở BXH.

## High
Không có.

## Medium

M1. E2E gãy vì strict mode của Playwright khi một link có ở cả bản thẻ lẫn bản bảng (C8, C9). Locator của Playwright đếm cả phần tử bị ẩn; `expect(locator).toBeVisible()` khớp 2 phần tử thì báo "strict mode violation", ở cả project desktop lẫn mobile.
- `apps/client/tests/e2e/match-filter-debts.spec.ts:8,28,40`: `#content a[href=".../matches/N"]`. Tab Trận giờ render `MatchCard` (`match-card.tsx:38`) và `MatchTable` (`match-table.tsx:86-92`), cùng href nên khớp 2 phần tử. Cả 3 test trong file sẽ rớt.
- `apps/client/tests/e2e/rankings-and-players.spec.ts:79`: `results.locator('a[href$="/matches/${playedMatchNo}"]')`. Hồ sơ VĐV có link tỉ số trong bảng (`player-results-table.tsx:67`) và link đầu thẻ `MatchCard` (`player-results-list.tsx:20`), nên cũng khớp 2.
- Sửa: lọc `:visible` (`a[href=...]:visible`), hoặc gắn `data-*` cho từng bản rồi scope theo nó. Báo cáo C8 ghi "e2e vẫn khớp" là chưa đúng.

M2. E2E BXH chưa theo kịp cấu trúc `<ol>/<details>` (C10).
- `rankings-and-players.spec.ts:21`: `details.getByRole('cell', { name: '2.700' })`. Fixture (`apps/api/test/playwright/ranking-browser-fixture.ts:74-76`) có đúng 1 khoản điểm bằng tổng, nên ô điểm của khoản (`points-breakdown-panel.tsx:133`) và ô "Tổng điểm" ở `tfoot` (`:142`) cùng tên "2.700". Kết quả là strict violation.
- `rankings-and-players.spec.ts:88`: `page.getByRole('row', { name: privateName })` trên `/rankings/<code>`. Trang này hết `<tr>`: summary không phải row, còn bảng trong `<details>` đang đóng thì bị ẩn khỏi cây a11y. Locator rỗng nên test timeout.
- Sửa: dùng `getByRole('listitem').filter({ hasText: privateName })` như test đầu; còn ô điểm thì scope vào `tbody` hoặc dùng `.first()`. Báo cáo C10 ghi "E2E đã sửa theo `<ol>/<details>`" là mới sửa một phần.

M3. Sidebar trận mượn setting trang chủ và kéo cả payload `/home`. `apps/client/src/lib/load-match-context.ts:116,128` gọi `getHomeContent()` chỉ để đọc `itemsPerSection`.
- Hiệu năng: mỗi lần cache trang trận hết hạn, API chạy lại toàn bộ `/home`, gồm 3 setting + 6 truy vấn (sự kiện ×2, bài viết, video, nhà tài trợ, BXH; `public-content.controller.ts:73-86`), chỉ để lấy 1 con số.
- Ý nghĩa: setting `home.itemsPerSection` có nhãn "Mục mỗi khối trang chủ" (`content-settings.ts:47-49`). Admin đặt 2 cho trang chủ gọn thì sidebar "Trận khác trong bảng A" cũng chỉ còn 2 trận, mà trên `/settings` không có gì báo trước hiệu ứng này.
- Sửa: thêm setting riêng (ví dụ `display.matchSidebarItems`, mặc định 4) trả qua `/site` display. Layout đã gọi `getSiteConfig` nên không tốn thêm lời gọi API nào.

## Low

L1. Bảng kết quả desktop ở hồ sơ VĐV không hiện đồng đội ở nội dung đôi (`player-results-table.tsx:65` chỉ hiện `p.opponent`). Bản thẻ mobile thì hiện đủ hai bên, nên cùng một trận mà desktop thiếu thông tin. Gợi ý: thêm dòng phụ "cùng X" khi `ownSide` có hơn 1 VĐV.

L2. Ô hạng ở hero chỉ có `dt` = tên bảng, `dd` = số (`player-hero-stats.tsx:112`). Screen reader đọc "Đơn nam 5", không có chữ "hạng". Gợi ý: `dt` dạng "Hạng {list}", hoặc thêm chữ ẩn.

L3. Tab loại ở BXH (> 5 bảng) đặt `aria-current="page"` cho link trỏ tới bảng đầu tiên của loại (`ranking-list-switcher.tsx:93-95`), dù trang đang xem là bảng khác. Nên dùng `aria-current="true"` cho tab nhóm, chỉ link đúng URL mới mang `page`. Nhánh này chưa được kiểm bằng dữ liệu (báo cáo C10).

L4. Trang trận lặp nội dung: bàn, ca và giờ hiện cả ở `MatchMetaRow` lẫn sidebar "Thông tin trận" (`match-sidebar.tsx:105-107`). Ngoài ra `neighbours` bị lọc `matchNo` hai lần (`page.tsx:54` và `match-sidebar.tsx:113`).

L5. Khóa i18n không còn ai dùng: `match.notPlayed` (mới thêm ở C8) và `rankings.noExpiry`. Grep `src` và `tests` đều 0 kết quả.

L6. DRY: nhãn bàn `displayName ?? format(tableCode)` nay lặp ở 6 chỗ: `match-card.tsx:31`, `match-table.tsx:60`, `match-meta-row.tsx:16`, `bracket-match-cell.tsx:82`, `session-table-schedule.tsx:35`, `info/page.tsx:51`. `tableLabel` đã export ở `match-meta-row.tsx` nhưng `match-table`/`match-card` không dùng. Map `PILL` trạng thái → biến thể pill lặp ở 3 file (`matches/[matchNo]/page.tsx:26`, `match-table.tsx:14`, `bracket-match-cell.tsx:16`).

L7. Nút "Xem trên bảng xếp hạng" (`player-hero.tsx:94`) trỏ `/rankings/<code>` không kèm `?q=`. VĐV hạng 87 sẽ phải tự tìm lại tên. Gợi ý: thêm `?q=<tên>`, vì bộ lọc server đã có sẵn.

## Kiểm lại vòng sửa 3

| Mã | Kết quả |
|---|---|
| M1 | Đã sửa. `schedule-and-withdraw.ts:21` dùng `getByText(/^Trận chưa xếp lịch/)`, khớp `unscheduled-panel.tsx:98`. |
| M2 | Đã sửa. `table-display-name.ts` dùng ở dashboard, drawer, cột mobile; grep `Bàn ${` trong `apps/admin/src` chỉ còn chính helper. Riêng trường hợp hiếm `displayName === code` ("T1") thì drawer hiện "Bàn T1", dashboard hiện "T1" (`matchTableLabel` coi trùng code là chưa đặt tên). Chấp nhận được. |
| M3 | Đã sửa. `draws-tab.tsx`: `isError` thì hiện `Result` + "Thử lại", không render `DrawPanel`, ẩn hàng "Đi tới phần". |
| M4 | Đã sửa. `auth-and-rbac.md:183,231-232,236,245`, `draws-and-groups.md:82,99-113`, `system-architecture.md:523` khớp code (`admin-draws.controller.ts:75`, `group-member-swap.service.ts:25`, `public-site-display-settings.ts:46-50`). |
| L6 (`?round` dùng chung) | **Vẫn còn**: `bracket-board.tsx:41,49` không đổi; nhánh nhiều section vẫn dùng chung một param. |
| L11 phần client | **Vẫn còn cả 3**: `bracket-derivations.ts:126` `isSettled =(`; `tests/offline/bracket-print.test.ts` 208 dòng; khóa trùng `bracket.tableCode` (`vi.json:52`) và `schedule.tableCode` (`vi.json:469`). Logic nhãn bàn nay còn lan rộng hơn (L6 ở trên). |

## Kiểm tra theo trọng tâm

| Trọng tâm | Kết quả |
|---|---|
| Whitelist / riêng tư | Đạt. Không có trường mới; HTML hồ sơ không có ngày/năm sinh; slug chỉ có khi hồ sơ công khai (`public-bracket.serializer.ts:52`). |
| Góc nhìn VĐV (đơn/đôi, side1/side2) | Đạt. Tỉ số, điểm từng ván và thắng/thua đều đảo đúng; `record` dùng cùng tập trận với danh sách (`public-player-results-where.ts`). |
| Bảng ngữ nghĩa | Đạt: `caption` ẩn, `th scope=col/row`, `tfoot` tổng. Xem M2 về hệ quả cho e2e. |
| Bản trùng desktop/mobile | Cây a11y không lặp (`display:none`), nhưng e2e strict mode gãy (M1). |
| `<details>` | Đạt: summary không chứa link, chevron `aria-hidden`, chữ ẩn "Điểm theo từng giải"; header cột `aria-hidden`; CLB chỉ hiện một bản theo breakpoint. |
| Server-side | Đạt: `q`/`club`/`page` qua `toQuery` + `oneOf(catalog.clubs)`; phân trang giữ filter; hồ sơ giữ `#results`. |
| Cache / tag | Trang trận dùng chung `getBracket`/`getGroups` (cùng URL, cùng tag `draw`/`groups`) với trang nhánh/bảng; API revalidate `draw`/`groups`/`match` cùng nhau (`revalidation/cache-tags.ts:30-34`). Xem M3 về `/home`. |
| Metadata / JSON-LD | Không đổi: trang trận giữ title, hồ sơ giữ `noindex`/canonical, BXH thêm ngày cập nhật vào title. |
| vi + en | Đủ (script so khóa). Có khóa thừa (L5). |
| Giá trị cứng | Ngưỡng "sắp hết hạn" lấy từ setting. `maxTabs = 5` của bộ chọn bảng là ngưỡng bố cục, không phải giá trị nghiệp vụ. Sidebar trận mượn setting trang chủ (M3). |
| File < 200 dòng / code chết | Đạt (nguồn lớn nhất 160 dòng). Component đã xóa (`points-breakdown-details`, `ranking-list-tabs`, `sub-event-side-menu`) không còn import ở đâu (grep toàn repo: 0). |

## Việc nên làm (theo thứ tự)
1. M1 + M2: sửa 6 locator e2e (`match-filter-debts.spec.ts:8,28,40`; `rankings-and-players.spec.ts:21,79,88`), rồi chạy e2e thật.
2. M3: setting riêng cho số trận ở sidebar, trả qua `/site`; bỏ `getHomeContent` khỏi trang trận.
3. L1–L3 (sửa nhỏ, có ích cho người dùng), sau đó L5, L6.

## Câu hỏi mở
- M3: có cần cho chỉnh riêng số trận ở sidebar trang trận trên `/settings`, hay chấp nhận dùng chung "Mục mỗi khối trang chủ" (khi đó nên ghi vào mô tả setting)?
- L6 (`?round` từng section): vẫn chờ quyết định từ vòng trước.

**Status:** DONE_WITH_CONCERNS
**Summary:** Không có lỗi High. Có 3 Medium: 6 locator e2e sẽ rớt (bản trùng thẻ/bảng gây strict mode; BXH hết `<tr>`; ô điểm trùng tổng), và sidebar trận kéo cả `/home` để đọc một setting của trang chủ. Có 7 Low. M1–M4 vòng 3 đã sửa thật; L6 và phần client của L11 vẫn còn. Typecheck, lint, test client/print/admin/shared đều xanh.
**Concerns:** Chưa chạy e2e, build, API test (theo yêu cầu); các lỗi e2e ở M1/M2 rút ra từ phân tích tĩnh locator + fixture, chưa chạy thật.
