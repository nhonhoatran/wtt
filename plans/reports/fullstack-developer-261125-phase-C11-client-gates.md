# Báo cáo phase C11 — Rà mobile, cổng kiểm client, tài liệu

Ngày: 2026-11-25. Phạm vi: `apps/client/**` và 5 file `docs/`. Không commit, không đụng API/admin/`.env`/DB ngoài global setup của e2e.

## Việc đã làm

1. **Thẻ "Vòng sau" (Figma 1-34, mobile)**: có dữ liệu thật nên đã làm. `components/bracket/bracket-next-round-card.tsx` (mới): link `?round=N+1` với nhãn "Vòng sau: Bán kết · 15/03" (tên vòng kế + ngày sớm nhất của vòng đó, bỏ ngày khi chưa có giờ), chỉ hiện ≤ 640 px, ẩn ở vòng cuối và khi in. Gắn trong `bracket-board.tsx`, CSS trong `bracket-nav.module.css` (165 dòng), khóa `bracket.nextRound` vi + en. Không đổi API, canonical, cache.
2. **Mở rộng test**
   - `accessibility.spec.ts`: 11 -> 18 route/locale (thêm `/events`, tab trận, nhánh `?round=2`, bảng đấu MD, trang trận đã đấu, trang trận bảng, `/rankings`).
   - `site-chrome-and-seo.spec.ts`: danh sách 390 px từ 3 -> 10 route (thêm tab trận, nhánh `?round=2`, bảng đấu, trận, `/rankings`, bảng xếp hạng, hồ sơ VĐV; chờ `fonts.ready`); ca mới canonical không chứa `round`/`ranking` (nhánh `?round=2`, `?round=2&ranking=…`, trang chủ `?ranking=…`; `ranking` là tham số của trang chủ, không phải của trang bảng xếp hạng).
   - `event-pages.spec.ts`: ca `?round` kiểm thẻ "Vòng sau" (có ở vòng 2, không có ở vòng cuối); hai ca nhánh chạy theo viewport (điện thoại mở `?round=3`, vì mobile chỉ hiện một vòng; trước đây hai ca này chưa từng chạy ở 390 sau C7).
3. **Lỗi sản phẩm tìm thấy bằng e2e, đã sửa trong code**
   - `event-hero-compact.tsx`: huy hiệu hạng giải nằm trong `<h1>` làm tên `<h1>` thành "Hệ thống giải KamitoEntries …" (dính chữ, sai mô tả SEO test). Đưa huy hiệu ra ngoài `<h1>` (`event-hero.module.css` thêm `.compactName`).
   - `ranking-row-summary.tsx`: điểm xếp hạng bọc lại `<strong>` (+ `.points strong` trong `ranking-accordion.module.css`). `apps/api/test/playwright/ranking-publish.seed.ts` đọc HTML công khai và kỳ vọng `<strong>137</strong>`; C10 bỏ thẻ này nên ca "publication refreshes … worker" rớt. Sửa phía client để không phải sửa seed API.
4. **Tài liệu**: `project-changelog.md` (mục "2026-11-25 — Redesign theo Figma, đợt 2" gồm A2, A7–A9, đổi chỗ bảng nháp, C6–C10, review vòng 3–4, setting mới, 4 commit, dòng C11); `public-site.md` (tham số `ranking`, `round`/`round<nhánh>`, bảng "Lệch Figma có lý do", kết quả kiểm, hàng trạng thái); `cache-revalidation.md` (`swap-group-members` không gửi tag, tham số xem không vào cache, `subEvent.*`/`venueTable.write`); `deployment-guide.md` (kết quả 2026-11-25, ghi chú Next dev); `development-roadmap.md` (đoạn tóm tắt redesign).

## Kết quả kiểm (số thật)

Chạy qua wrapper test-DB (`localhost:5433/kamito_tt_phase12_test`), API 3413, client 3414, Next dev + API từ mã nguồn, `--workers=1 --retries=0`.

| Lượt | Kết quả |
|---|---|
| Lượt 1 (trước sửa) | 101 đạt, 21 bỏ qua, **12 lỗi** (6 ca × 2 project, xem dưới) |
| **Lượt cuối, toàn bộ 2 project** | **113 đạt, 21 bỏ qua theo viewport, 0 lỗi, 0 flaky** (desktop 54 đạt/13 bỏ qua; mobile 59 đạt/8 bỏ qua) |
| Axe (đếm riêng, JSON reporter) | 4 test × 18 route = 72 lượt, **0 vi phạm ở mọi mức** (kể cả moderate/minor) |
| `pnpm typecheck` / `lint` (client) | sạch / sạch |
| `pnpm test` (client) | 36 file, 188/188 |
| `pnpm test:print` | 2 file, 9/9 |
| Root `pnpm typecheck` / `pnpm lint` | 14/14 / 9/9 tác vụ thành công |

12 lỗi lượt 1 và cách xử lý:
- 6 ca (2 project): sitemap trả 500 `Cannot find module './sitemap.ts'` từ Next dev (content-pages footer, rankings sitemap, SEO sitemap). Chạy riêng ca sitemap đạt, lượt đầy đủ sau cùng mã không tái hiện. **Nguyên nhân chưa xác định** (nghi ngờ `.next/dev` dùng chung với Next dev của người khác ở cổng 3001); không sửa gì cho nhóm này. Đây là rủi ro flaky môi trường, ghi trong deployment guide.
- 2 ca (2 project): mô tả SEO của trang nhánh ≠ `<h1>`: lỗi sản phẩm mục 3 (đã sửa).
- 2 ca (2 project): test seed ranking-publish: lỗi sản phẩm mục 3 (đã sửa).
- 2 ca mobile: hai ca nhánh giả định thấy mọi vòng: test chưa cập nhật sau C7 (đã sửa test, vẫn giữ nguyên ý nghĩa kiểm).

Quan sát: chạy riêng `accessibility.spec.ts` với **chỉ** `--reporter=json` thất bại 2/2 lần ở route đầu (`/vi`: "Execution context was destroyed"); với `list`, `list,json` và cấu hình mặc định đều đạt (4 lần). Không tái hiện được ở cấu hình dùng thật, chưa tìm ra nguyên nhân (trang chủ không có điều hướng phía client; nghi Next dev tải lại đầy đủ lúc biên dịch lạnh). Ghi để lead biết nếu thấy lại.

## Chưa làm / không chạy

- `playwright.admin-full-flow.config.ts`: **không chạy**. Config chỉ chạy qua runner gốc (`test-results/261120-full-ui-runner.mjs`): cần `REAL_TEST_DB_LEASE=full-ui`, bản dựng API/admin (`dist`), Next production, worker UUID và cổng cố định 3371–3373 (kiểm cứng trong `tests/admin-full-flow/world.ts`; cổng 3415/3416 sẽ bị guard từ chối). Hook chặn bản dựng nên để lead chạy cùng cổng kiểm cuối.
- Lighthouse, build production: dành cho lead.
- Ảnh chụp 1440/390 từng route: bỏ qua (không rẻ trong lượt này; axe + không tràn ngang đã kiểm bằng test).
- Báo cáo `tester-*` ở thư mục plan không tạo (spec ghi do tester viết).

## Rà chất lượng

- Chuỗi tiếng Việt cứng trong `src/components`, `src/app` (ngoài dictionary): còn 4 chỗ **có từ trước, không thuộc redesign** (phase 11): `app/[locale]/contact/actions.ts:20,52` (thông báo form theo `locale === 'vi'`), `app/[locale]/news/[slug]/page.tsx:55`, `app/[locale]/videos/[slug]/page.tsx:61` (nhãn bằng `locale === 'vi' ? … : …`), `components/content/article-card.tsx:11`. Không sửa vì ngoài phạm vi phase và chạm form liên hệ/CMS; đề xuất đưa vào dictionary ở một phase riêng. Mã mới của C11 không thêm chuỗi cứng.
- Hex thô trong component: chỉ `contact-form.module.css:13` (`var(--color-danger, #b42318)` có biến trước) và `video-embed.module.css:9` (`#fff`), cả hai có từ trước; mã mới không thêm.
- File mã mới/đã sửa > 200 dòng: không có (lớn nhất `bracket-nav.module.css` 165 dòng; `vi.json`/`en.json` 511 dòng, có từ trước).
- Kiểm xưng hô riêng tư trên 5 file docs đã sửa: không có.

## Files

Sửa: `apps/client/src/components/bracket/{bracket-board.tsx,bracket-nav.module.css}`, `src/components/events/{event-hero-compact.tsx,event-hero.module.css}`, `src/components/rankings/{ranking-row-summary.tsx,ranking-accordion.module.css}`, `src/i18n/{vi,en}.json`, `tests/e2e/{accessibility,event-pages,site-chrome-and-seo}.spec.ts`, `docs/{project-changelog,public-site,cache-revalidation,deployment-guide,development-roadmap}.md`.
Tạo: `apps/client/src/components/bracket/bracket-next-round-card.tsx`, báo cáo này.
Cổng 3413/3414: không còn listener (đã kiểm `netstat`); không đụng :3000, :3001, :5173.

## Câu hỏi còn mở

- Có muốn chuyển 4 chuỗi cứng phase 11 vào dictionary không (phase riêng)?
- Nguyên nhân sitemap 500 trên Next dev dùng chung `.next/dev` và lỗi axe với `--reporter=json` riêng: cần theo dõi nếu lặp lại ở lượt của lead.

**Status:** DONE_WITH_CONCERNS
**Summary:** Thẻ "Vòng sau" mobile đã làm bằng dữ liệu thật; test mở rộng; full Playwright 2 project 113 đạt/21 bỏ qua theo viewport/0 lỗi/0 flaky ở lượt cuối; axe 72 lượt 0 vi phạm; docs cập nhật. Tìm và sửa 2 lỗi sản phẩm (tên `<h1>` hero gọn, `<strong>` điểm xếp hạng).
**Concerns/Blockers:** admin-full-flow chưa chạy (cần runner gốc + bản dựng + cổng 3371–3373); Lighthouse/build production chưa đo; một lượt đầu có sitemap 500 trên Next dev chưa rõ nguyên nhân (không tái hiện); 4 chuỗi cứng phase 11 còn lại.
