# Sửa review vòng 4 (C8-C9-C10) và các điểm còn hở của C10

Ngày: 2026-11-25. Phạm vi: `apps/client`, `packages/shared`, `packages/ui-tokens`, `apps/api` (serializer + e2e), `docs`. Không migration, không commit.

## Đã sửa

| Mã | Việc đã làm |
|---|---|
| M1 | Locator e2e dùng `:visible` (cả hai bản bảng/thẻ vẫn còn trong markup): `match-filter-debts.spec.ts` (3 chỗ), `rankings-and-players.spec.ts` (link tỉ số ở hồ sơ VĐV). Rà các spec khác: nhóm/lịch chỉ render một bản nên không cần. |
| M2 | `rankings-and-players.spec.ts`: ô điểm khoản scope vào `tbody`, tổng kiểm riêng ở `tfoot`; test VĐV riêng tư dùng `list > listitem` thay cho `row`. |
| M3 | Ba setting mới đi qua khối `display` của `/public/site` (registry, nhãn, editor trên `/settings`, test shared, e2e public-site, docs): `public.matchRelatedLimit` (nhóm `display`, 1–12, mặc định 4); `ranking.pointsGuidePageSlug` (nhóm `ranking`, trống = ẩn, API trả `null`); múi giờ dùng lại `event.defaultTimezone` (đã có, chỉ sửa nhãn/mô tả cho đúng nghĩa, API trả `display.timezone`). Không tạo setting múi giờ thứ hai. |
| M3 client | `load-match-context.ts` bỏ `getHomeContent()`, đọc `matchRelatedLimit` từ `getSiteConfig()` (layout đã gọi sẵn). BXH: link "Cách tính điểm" ở `RankingPageHeader` chỉ hiện khi slug có và trang CMS đã công bố (`getStaticPage`); "hôm nay" của nhãn sắp hết hạn tính theo `display.timezone` qua `todayIn()` (múi giờ lỗi thì rơi về UTC). |
| Token | `warningSurface` `#FEF3C7`, `warningText` `#78350F` thêm vào `packages/ui-tokens` (thành `--color-warning-surface/-text`); `.soon` dùng biến. Test token: biến CSS + tương phản >= 4.5:1 (thực tế ~8:1). |
| L1 | Bảng kết quả VĐV hiện dòng "Đồng đội: …" (có link) ở nội dung đôi; `playerPerspective` trả thêm `partner`. |
| L2 | Ô hạng ở hero: `dt` = "Hạng {bảng}" (khóa `players.profile.rankIn`). |
| L3 | `PillNav` có `group?` -> `aria-current="true"`; tab Đơn/Đôi dùng nó, chỉ link bảng đúng URL mang `page`. |
| L4 | Sidebar bỏ bàn/ca/giờ dự kiến (đã có ở `MatchMetaRow`; giữ giờ bắt đầu/kết thúc), bỏ lọc `matchNo` lần hai (page lọc một lần, ghi chú ở prop). |
| L5 | Xóa khóa `match.notPlayed`, `rankings.noExpiry`, và `match.scheduledAt` (hết người dùng sau L4), cả vi và en. |
| L6 (round 4) | Helper `tableName()` + `MATCH_STATUS_PILL` trong `src/lib/match-display.ts`; thay ở 6 chỗ nhãn bàn và 3 chỗ map pill. Gỡ `tableLabel` cũ khỏi `match-meta-row`. |
| L7 | Link "Xem trên bảng xếp hạng" kèm `?q=<tên>` (cắt theo `PUBLIC_SEARCH_MAX_LENGTH`). Kiểm: URL trả "1 kết quả". |
| A7-A9 L6 | `?round` theo từng section: một section vẫn `?round=N`; nhiều section dùng `round<section>`, link chip giữ nguyên `draw` và vòng của section khác. `BracketBoard` nhận `query` + `roundHref(key, round)`. |
| A7-A9 L11 (client) | `isSettled = (`; `bracket-print.test.ts` 208 -> 181 dòng (tách `offline-css.ts`). |

## Cố ý chưa làm
- Khóa trùng `bracket.tableCode` / `schedule.tableCode` (vi.json:52, 469): `BracketMatchCell` chỉ nhận lát `t.bracket`; gộp phải đổi props 4 file bracket cho một chuỗi 2 từ. Logic đã dùng chung `tableName()`, còn lại chỉ là trùng chuỗi dịch.

## Kiểm chứng (đã chạy thật)
- Root `pnpm typecheck`: 14/14 OK. Root `pnpm lint`: 9/9 OK (lần đầu lint bắt `format` thừa ở `info/page.tsx`, đã xóa).
- `packages/shared` test: 25 file / 123 pass. `packages/ui-tokens` test: 10 pass.
- `apps/client` `pnpm test`: 36 file / 188 pass (thêm `match-display`, `player-and-ranking-markup`, `todayIn`, `roundParamKey`, `partner`). `pnpm test:print`: 2 file / 9 pass. `apps/admin` test: 98 pass, 0 fail.
- API e2e `test/public-site.e2e-spec.ts` qua wrapper (dòng đầu: `target localhost:5433/kamito_tt_phase12_test`): 9/9 pass, gồm 3 trường mới (mặc định, đổi qua `/settings`, 422 cho slug `a/b`, giới hạn 13, múi giờ sai, reset về `null`).
- Trình duyệt (API riêng :3080, Next dev :3395, test DB; 1440 và 390; axe wcag2a/aa/21aa/22aa):
  - Chưa đặt setting: `/vi/rankings/RL-ad596c2d` không có link "Cách tính điểm"; trang trận `entries-3f305b/matches/13` liệt kê 2 trận bên cạnh (mặc định 4).
  - Đặt slug trang CMS đã công bố + `matchRelatedLimit=1`: link `/vi/pages/fix4-cach-tinh-diem` (và `/en/…`) hiện ở cả hai bảng (đơn, đôi); sidebar còn 1 trận; không còn dòng bàn/ca/giờ dự kiến.
  - Slug trỏ trang không tồn tại: link ẩn.
  - Hồ sơ VĐV hạng 1: `dt` = "Hạng Xếp hạng đôi ad596c2d", link BXH có `?q=`; chỉ 1 link trận hiển thị mỗi viewport (xác nhận `:visible` khớp 1 phần tử).
  - Tất cả: axe 0 vi phạm, tràn ngang 0, 1 h1, status 200.
- Đã dọn: xóa setting/trang tạm khỏi test DB (`teardown` trả `settings: []`, `pages: []`); dừng đúng PID 3395 và 3080 do mình chạy; :3000 và :5173 vẫn chạy.

## Chưa kiểm được
- Hàng "Đồng đội" trên trình duyệt: test DB không có trận đôi nào có cặp VĐV công khai; chỉ kiểm bằng test render (`player-and-ranking-markup.test.ts`).
- Nhãn "Sắp hết hạn" hiển thị thật: dữ liệu hết hạn năm 2100, ngưỡng tối đa 365 ngày; chỉ có unit test + token.
- Chip `round<section>` của nhánh nhiều section: không có dữ liệu nhiều section; chỉ có test `roundParamKey`.
- E2E Playwright: không chạy theo yêu cầu (C11); các locator sửa theo phân tích markup và xác nhận `:visible` ở trình duyệt.
- `pnpm build` không chạy. Typecheck gốc tự build `shared` và `ui-tokens` (turbo `^build`) nên `tokens.css` trong `packages/ui-tokens` đã có biến mới.

## File đã sửa
- shared: `ranking-settings.ts`, `public-site-display-settings.ts` (+ test), `public-site-contract.ts`, `tournament-settings.ts`.
- ui-tokens: `tokens.ts`, `build-css-variables.test.ts`.
- api: `src/modules/public-events/public-site.query.ts`, `test/public-site.e2e-spec.ts`.
- client src: `lib/load-match-context.ts`, `lib/expiring-soon.ts`, `lib/match-display.ts` (mới), `lib/player-match-perspective.ts`, `lib/bracket-derivations.ts`, `app/[locale]/rankings/[listCode]/page.tsx`, `app/[locale]/events/[slug]/{info/page.tsx,matches/[matchNo]/page.tsx,draws/[subEventCode]/page.tsx}`, `components/rankings/{ranking-page-header.tsx,ranking-list-switcher.tsx,rankings.module.css,ranking-accordion.module.css}`, `components/common/pill-nav.tsx`, `components/players/{player-hero.tsx,player-hero-stats.tsx,player-results-table.tsx}`, `components/matches/{match-card,match-table,match-meta-row,match-sidebar}.tsx`, `components/bracket/{bracket-board,bracket-match-cell}.tsx`, `components/schedule/session-table-schedule.tsx`, `i18n/{vi,en}.json`.
- client tests: `e2e/{match-filter-debts,rankings-and-players}.spec.ts`, `unit/{expiring-soon,bracket-derivations,player-match-perspective}.test.ts`, mới `unit/{match-display,player-and-ranking-markup}.test.ts`, `offline/bracket-print.test.ts`, mới `offline/offline-css.ts`.
- docs: `public-site.md`, `auth-and-rbac.md`, `project-changelog.md`.
- Script tạm: `scratchpad\fix4\` (`check.mjs`, `db-state.mjs`, `step*.py`).

## Câu hỏi mở
- Nhãn setting `event.defaultTimezone` đổi từ "Múi giờ mặc định của giải mới" thành "Múi giờ mặc định" vì nay còn là múi giờ site công khai: chủ repo xác nhận có muốn tách thành setting riêng không.

**Status:** DONE_WITH_CONCERNS
**Summary:** Đã sửa M1-M3, các điểm hở C10 (link "Cách tính điểm", múi giờ, token màu), L1-L7, L6 `?round` và phần client của L11; typecheck, lint, test shared/ui-tokens/client/print/admin, e2e API public-site đều xanh, trình duyệt 1440/390 axe 0.
**Concerns:** E2E Playwright chưa chạy (chờ C11); hàng "Đồng đội", nhãn "Sắp hết hạn" và chip nhiều section chưa thấy được trên dữ liệu thật vì test DB không có dữ liệu tương ứng; khóa i18n `bracket.tableCode`/`schedule.tableCode` vẫn trùng.
