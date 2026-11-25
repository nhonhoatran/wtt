# Báo cáo phase C3 — khung site: header, ticker, footer (2026-11-25)

## Đã làm
- `lib/nav-items.ts` (thuần, có test): bảng route theo `key`, nhãn = override theo locale ?? dictionary, `navCurrent` giữ logic `aria-current` cũ (page/location, calendar tách khỏi events).
- `lib/site-display.ts`: `getSiteChromeDisplay()` đọc `/public/site` `display` (cache tag `settings`); API lỗi thì dùng mặc định registry (nav mặc định, không MXH/tagline/đăng ký).
- Header: wordmark chữ (Q11), `MainNav` nhận items đã resolve (inline + `<details>` mobile), `VI | EN` (ngôn ngữ hiện tại là `<span aria-current>`, ngôn ngữ kia là link, vẫn lưu cookie + giữ query), nút "Đăng ký thi đấu" chỉ khi `registrationUrl` có giá trị (Q1; desktop ở thanh, mobile trong menu), không icon tìm kiếm (Q2). Vùng chạm >= 44px.
- Ticker: thứ tự DOM skip link -> header -> ticker (dưới header mọi màn hình). Thẻ cuộn ngang native + scroll-snap, không tự chạy, không nút ‹ ›. Mỗi thẻ đúng 1 link tới trận (`aria-label` đầy đủ), tên VĐV là chữ thường; có nội dung · vòng/bảng · bàn, điểm từng ván, tổng ván, `StatusPill`. Link "Tất cả trận đấu" chỉ khi mọi thẻ cùng một giải. Ẩn khi rỗng/API lỗi (như cũ). Bỏ `<details>`.
- Footer đen: wordmark, `tagline`, MXH (nhãn FB/YT/TT… + `aria-label` từ dictionary, mở tab mới), cột "Khám phá" từ nav setting (+ Liên hệ nếu nav không có), nhóm trang tĩnh như cũ, dải tài trợ giữ vị trí (Q5), (c) năm + tên site. Mobile: lưới 2 cột không ẩn link. Bỏ chuỗi cứng, fetch footer lỗi không làm sập trang.
- CSS: `site-chrome.module.css` (xóa) tách thành `header.module.css` (198 dòng), `footer.module.css`, `results-strip.module.css`; xóa rule footer thừa ở `content-layout.module.css`.
- i18n vi + en: `nav.register/opensInNewTab`, `footer.*`, `social.*`, `strip.*`; bỏ `nav.switchToCode`, `strip.toggle` (không còn dùng).
- Gộp góp ý reviewer: (1) fixture `content-localization.test.ts` đã có `display` + `getDictionary`; (2) `InitialsAvatar` ảnh `alt=""` (trang trí, tên luôn hiển thị bên cạnh); (3) `.btn-primary/.btn-outline:focus-visible` ring 3px `--color-data`; nút đăng ký trên nền đen dùng ring `--color-live` (`.header .register`).
- Sửa axe `label-content-name-mismatch` do chính phase này gây ra: link ngôn ngữ nay `aria-label="EN, English"` (chứa chữ hiển thị; test e2e tìm `name: 'English'` vẫn khớp).

## Test e2e (chỉ sửa, chưa chạy)
- `site-chrome-and-seo.spec.ts`: test nav đặt `site.nav.items` qua fixture (events, calendar, rankings đổi nhãn "BXH"), kiểm `aria-current`, nhãn override, "Liên hệ" vắng. Dùng `content-fixture`.
- `support/content-settings.ts`: tách `withAppSetting` dùng chung, thêm `withSiteNavItems` (giữ `withHomeSections`).
- Chưa chạy Playwright e2e đầy đủ (cần dựng world vào DB; cấm theo luật). Nghĩa là test nav mới chưa được chứng minh chạy.

## Kiểm chứng (chạy thật, apps/client)
- `pnpm typecheck`: sạch. `pnpm lint`: sạch.
- `pnpm test`: 25 file / 119 test đạt (mới: `nav-items` 9 ca, `site-chrome` 6 ca: ticker 1 link/thẻ, ẩn khi rỗng/lỗi, nút đăng ký ẩn/hiện, footer tagline+MXH+explore, footer lỗi fetch).
- `pnpm build`: đạt (chạy lại sau lần sửa CSS cuối).
- Trình duyệt: Next production (`next start`, cổng 3314, env truyền dòng lệnh, `API_INTERNAL_URL=http://localhost:3000`), Playwright chromium + `@axe-core/playwright`, script `...\scratchpad\c3\shell-check.mjs`:
  - 10 route (`/vi`, `/en`, events, calendar, rankings, players, news, videos, contact, 404) x 1440 và 390: axe 0 vi phạm mọi mức (kể cả khi mở menu mobile), `scrollWidth - clientWidth = 0` mọi route, không link/summary trong header/footer cao < 32px.
  - Tab qua khung: mọi điểm dừng có outline 2px (vàng live trên nền đen, navy trên nền trắng); thứ tự skip link -> wordmark -> menu -> ngôn ngữ -> nội dung.
  - Ảnh: `_vi-1440.png`, `_vi-390.png`, `_vi_events_no-such-event-1440/390.png`, `menu-open-390.png`, `focus-1440/390.png` trong `...\scratchpad\c3\`. Đã mở xem `_vi-1440.png` và `menu-open-390.png`: header đen một hàng, footer đen đúng cấu trúc Figma.
- Đã dừng tiến trình Next cổng 3314 (kiểm tra `netstat`: 0 listener).

## Chưa thấy được trên trình duyệt (không có dữ liệu, không làm giả)
- Ticker (setting tắt/không có trận LIVE/OFFICIAL), nút đăng ký, tagline, MXH (setting mặc định rỗng), trang giải (DB test không có giải công khai, chỉ thấy trang 404). Các khối này chỉ được kiểm bằng unit test render HTML; chưa có ảnh chụp thật. Cần dữ liệu thật hoặc chạy e2e có seed để chụp.
- Đổi `site.nav.items` rồi header đổi sau revalidate `settings`: chưa kiểm tay (không sửa DB).

## Lệch/ghi chú
- Không làm trang `/search` (Q2 chưa chốt); nav mặc định không có "Trận đấu" (Q3, theo phase).
- Ảnh chụp chưa lưu vào `plans/.../reports/` như phase yêu cầu (chỉ ở scratchpad, theo chỉ dẫn).
- Docs `docs/public-site.md` chưa cập nhật (docs impact minor: khung site mới, setting display).
- Wordmark vẫn `KAMITO` cứng trong code (Q11, chờ file logo).

**Status:** DONE_WITH_CONCERNS
**Summary:** Header/menu theo setting, ticker thẻ, footer xong; typecheck/lint/test/build đạt, axe 0 vi phạm 10 route x 2 viewport.
**Concerns:** Ticker/đăng ký/MXH/trang giải chưa thấy trên trình duyệt (thiếu dữ liệu); e2e Playwright chưa chạy.
