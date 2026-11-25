---
phase: C3
title: "Khung site: header, menu theo setting, ticker kết quả, footer"
status: pending
priority: P1
effort: 5h
depends_on: [C1, C2]
---

# Phase C3 — Khung site: header, menu theo setting, ticker, footer

## Context links
- Gap: [research/client-figma-gap.md](./research/client-figma-gap.md) mục 1-28 (ticker, header, footer), "Phát hiện xuyên suốt" 3–5
- Câu hỏi: [client-open-questions.md](./client-open-questions.md) Q1 (đăng ký), Q2 (tìm kiếm), Q3 (Trận đấu), Q5 (tài trợ), Q11 (logo)
- Figma: `figma/client/1-28.png` (header chốt), `1-14.png` (footer chốt), `1-37.png` (mobile)

## Overview
- Ưu tiên: P1. Mọi trang dùng khung này.
- Header đen một hàng: wordmark, menu lấy từ setting `site.nav.items`, ô VI | EN, nút "Đăng ký thi đấu" (chỉ khi setting có URL), icon tìm kiếm (chỉ khi Q2 chốt phương án B). Ticker kết quả dạng thẻ cuộn ngang. Footer đen: giới thiệu, MXH, nhóm link, dải tài trợ (giữ vị trí hiện tại cho tới Q5), ©.

## Key insights
- `main-nav.tsx:20-37` cứng 7 mục; Figma 6 mục (thêm "Trận đấu" chưa có route) → setting C2, mặc định không có "Trận đấu", "Lịch", "Liên hệ" (Liên hệ chuyển xuống footer, Lịch có link từ trang danh sách giải ở C5).
- Ticker hiện là `<details open>` (`results-strip.tsx:15`) mỗi mục có link hồ sơ + link trận → 10 trận ≈ 30 điểm dừng Tab. Thẻ mới: một link (tới trang trận), tên VĐV là chữ thường → bớt điểm dừng, không lồng link.
- Không chạy chữ tự động (WCAG 2.2.2); không nút ‹ › (cần JS) — cuộn ngang native + `scroll-snap`.
- Thứ tự DOM: skip link → header → ticker. Figma desktop đặt ticker trên header; kế hoạch đặt **dưới** header ở mọi màn hình (đúng mobile 1-37, thứ tự đọc = thứ tự nhìn, bàn phím vào menu trước).
- Header dùng `getSiteConfig()` đã cache (`lib/public-data.ts:83`, tag `settings`); API lỗi → nav mặc định từ registry, footer bỏ phần setting.
- Footer mobile Figma dùng accordion → thay bằng lưới 2 cột không ẩn link (ít thao tác, không JS).

## Requirements
- Chức năng: menu theo setting (thứ tự, ẩn/hiện, nhãn tùy chọn vi/en); mục hiện tại `aria-current` như cũ; menu mobile `<details>` không JS; VI | EN hiện cả hai, ngôn ngữ hiện tại không phải link; nút đăng ký chỉ khi `registrationUrl` khác rỗng; ticker ẩn khi setting tắt hoặc rỗng (như cũ); footer ẩn phần không có dữ liệu.
- Phi chức năng: axe 0 vi phạm; vùng chạm ≥ 44px; không tràn ngang 390px; mọi chuỗi mới có vi + en; file < 200 dòng (tách `site-chrome.module.css` 155 dòng thành `header.module.css`, `footer.module.css`).

## Architecture
```
layout.tsx ──getSiteConfig()──> SiteHeader(props: navItems, registrationUrl, siteName)
                                 ├─ MainNav (client: usePathname để aria-current) ← items đã resolve label/href ở server
                                 ├─ LocaleSwitcher (client)
                                 └─ ResultsStrip (server, getResultsStrip)
           ──getFooter() + getSiteConfig()──> SiteFooter (tagline, socialLinks, nhóm trang tĩnh, cột "Khám phá" từ navItems, tài trợ)
lib/nav-items.ts: key → { href, label(dict, override), isCurrent(pathname) }  (thuần, có unit test)
```

## Related code files
Sửa:
- `apps/client/src/app/[locale]/layout.tsx`
- `apps/client/src/components/layout/site-header.tsx`, `main-nav.tsx`, `locale-switcher.tsx`, `results-strip.tsx`, `results-strip.module.css`, `site-footer.tsx`, `site-chrome.module.css` (thu gọn)
- `apps/client/src/components/content/sponsor-strip.tsx`, `content-layout.module.css` (kiểu dải tài trợ Figma)
- `apps/client/src/i18n/vi.json`, `en.json` (`nav.*` mới, `strip.*`, `footer.*`, `social.*`)
- `apps/client/tests/e2e/site-chrome-and-seo.spec.ts` (test nav dòng 67), `tests/e2e/support/content-settings.ts` (đặt setting nav/MXH trong fixture)

Tạo:
- `apps/client/src/lib/nav-items.ts`, `apps/client/tests/unit/nav-items.test.ts`
- `apps/client/src/components/layout/header.module.css`, `footer.module.css`
- `apps/client/src/components/layout/footer-social-links.tsx` (icon SVG inline + nhãn ẩn cho screen reader)
- `apps/client/src/components/layout/results-strip-item.tsx`
- Chỉ khi Q2 chốt B: `apps/client/src/app/[locale]/search/page.tsx` (GET `q`, gọi song song `getEventList` + `getPlayerList`, `policy none`, `robots: noindex`)

## Implementation steps
1. `nav-items.ts`: bảng route cố định theo `key` (đây là cấu trúc route, không phải giá trị nghiệp vụ); nhãn = override theo locale ?? dictionary; `isCurrent` giữ logic `page`/`location` hiện có (`main-nav.tsx:19-36`). Unit test các key + override + pathname con.
2. `layout.tsx` đọc `getSiteConfig()` (đã có cache React, cùng lời gọi với `getSiteName`), truyền `display` xuống header/footer.
3. `MainNav` nhận `items` đã resolve; giữ hai bản inline/`<details>`; `summary` có nhãn "Menu" từ dictionary.
4. `LocaleSwitcher`: hiển thị `VI | EN`; mã hiện tại là `<span aria-current="true">`; mã kia là link như cũ (giữ cookie, query).
5. Nút đăng ký: `<a class="btn-primary" href rel="noopener noreferrer" target="_blank">` + chữ báo mở tab mới (ẩn trực quan); dùng `primaryText` nền để đạt AA.
6. Ticker: nhãn khối, danh sách `<ul>` thẻ: nội dung · vòng, bàn (A2), tên 2 bên (chữ), điểm từng ván, tổng ván, `StatusPill`; cả thẻ là link trận với `aria-label` đầy đủ. Link "Tất cả trận đấu" chỉ khi mọi mục cùng một giải → tab trận của giải đó.
7. Footer: wordmark + `tagline` + MXH; cột nhóm trang tĩnh (như cũ) + cột "Khám phá" từ `navItems`; dải tài trợ restyle; © năm + tên site. Thay chuỗi cứng `site-footer.tsx:15,21,27` bằng dictionary.
8. (Q2 = B) trang `/search`: form GET, hai khối kết quả (giải, VĐV) dùng component có sẵn, link "xem tất cả" sang `/events?q=`, `/players?q=`; proxy tự áp bucket `search` khi có `q`.
9. Cập nhật fixture setting e2e và test nav; chạy kiểm.

## Todo
- [ ] `nav-items.ts` + unit test
- [ ] Header + menu mobile + VI | EN + nút đăng ký ẩn mặc định
- [ ] Ticker thẻ mới
- [ ] Footer + MXH + bỏ chuỗi cứng
- [ ] Tách CSS < 200 dòng
- [ ] (tùy Q2) `/search`
- [ ] Sửa test nav, fixture setting; chạy bộ kiểm

## Success criteria
- `pnpm --filter @kamito/client typecheck lint test build` đạt (gồm `i18n-keys.test.ts`).
- Playwright (desktop 1440 + mobile 390, production local theo `docs/deployment-guide.md#playwright-e2e-client`): `site-chrome-and-seo.spec.ts`, `accessibility.spec.ts` (36 scan, 0 vi phạm mọi mức), `content-home.spec.ts` đạt.
- Đổi `site.nav.items` trên `/settings` → header đổi sau revalidate tag `settings` (kiểm tay hoặc thêm ca e2e).
- Ảnh chụp 1440/390 trang chủ và trang giải lưu `plans/261125-0951-figma-ui-redesign-admin-client/reports/`, đã mở kiểm.

## Risk assessment
| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Admin đặt nav rỗng/lỗi → mất menu | Thấp × Cao | Schema `min(1)`; giá trị lỗi → default (`resolveAppSetting`) |
| Bỏ "Lịch"/"Liên hệ" khỏi menu làm người dùng cũ khó tìm | Trung bình × Thấp | Liên hệ ở footer; Lịch có link từ `/events`; admin bật lại qua setting |
| `/public/site` lỗi làm header trống | Thấp × Trung bình | Fallback default registry như `site-name.ts` |
| Hydration lệch do `usePathname` | Thấp × Thấp | Giữ mẫu client component hiện có |

## Security considerations
- URL MXH/đăng ký đã kiểm https ở API; client chỉ render, thêm `rel="noopener noreferrer"`.
- Trang `/search` (nếu làm): `q` qua `toQuery` + `PUBLIC_SEARCH_MAX_LENGTH`, không cache, chịu rate limit bucket `search`.

## Next steps
- C4–C10 dựa trên khung này. Rollback: revert commit; setting mới vô hại khi client cũ không đọc.
