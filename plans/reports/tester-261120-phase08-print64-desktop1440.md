# Phase 08 — Bản in nhánh 64 và khung kiểm desktop 1440

Ngày: 2026-11-20. Phạm vi: component nhánh đấu, CSS in, cấu hình viewport và kiểm component không phụ thuộc API/DB. Không nghiệm thu staging/M1/M2 trong tác vụ này.

## Kết quả

- Tái hiện trước sửa: bộ Chromium với `BracketBoard`, CSS và font Archivo thật ghi **64 ô tên bị cắt ngang** trong từng mẫu đơn/đôi, vi/en, A4/A3. Test baseline rớt đúng ở `expected 64 to be 0`, exit 1. Không dùng giả lập component hoặc thay CSS nguồn bằng mẫu tự dựng.
- Rà tiếp phát hiện fixture tiêu đề đơn giản chưa đủ: khi dùng **EventShell/EventHero thật** có hạng giải/ngày/địa điểm/đơn vị đồng hành/tóm tắt/vé cùng hai chooser và `h2` tiêu đề, cả bốn bản A4 ra **6 trang**, với phần đầu chiếm một trang riêng; A3 vẫn năm trang. Lượt này rớt `expected 6 to be 5`. Đã sửa hẹp để bản in chia nhánh ẩn hero/tiêu đề dư; từng tờ vẫn mang ngữ cảnh đầy đủ. Màn hình và bản in nhánh nhỏ không bị ẩn.
- Sau sửa: **9/9 test, 0 lỗi**, gồm 8 ca chia trang và 1 ca browser thực thi tám tổ hợp PDF. Mỗi tổ hợp màn hình 1440/390 giữ đủ 63 trận duy nhất, không tràn ngang. Mỗi tổ hợp in giữ đủ 63 trận, không cắt ngang tên, không hiện bản nhánh màn hình/chrome.
- Mỗi PDF có **5 trang ngang**: bốn phần nhánh 16 suất và một phần bán kết/chung kết. Khối lớn nhất đo được 610 px cho đơn, 642 px cho đôi, nhỏ hơn chiều cao nội dung A4 718 px. Ngưỡng và số trang chỉ áp dụng fixture kiểm đã nêu.
- Kiểm độc lập bằng `pypdf`: **8/8 PDF đạt**, đúng khổ A4/A3 (sai số làm tròn dưới 2 pt), đủ toàn bộ 63 số trận đúng một lần, đủ 64 tên đơn hoặc 128 tên đôi, ngữ cảnh giải trên mọi trang.
- Đã render và mở ảnh từ PDF thật: A4 đôi vi trang 1/4/5 và A3 đôi en trang 1. Tên xuống dòng đủ, còn đường nối, không có trang đầu chỉ mang tiêu đề.
- TypeScript toàn client và ESLint các file thay đổi đạt, exit 0. Các lỗi callback `test.skip` hai tham số phát hiện ở lượt giữa đã sửa; lượt cuối đạt.
- Sau marker EventHero/tiêu đề và fixture EventShell cuối, tester độc lập chạy lại client typecheck/lint/build đều exit 0, unit **72/72 đạt**; log `test-results/261120-phase0812-late-client-{typecheck,lint,build,unit}.log`. [QA tổng](../261111-1512-kamito-table-tennis-tournament-platform/reports/tester-261120-local-checks.md).

## Thay đổi

- `apps/client/src/components/bracket/print-bracket-pages.ts`: chỉ chia dữ liệu trình bày bản in, giữ nguyên đối tượng trận, số trận và nhãn nguồn; nhánh không đều được giữ nguyên để không làm mất dữ liệu. Hằng tám trận mở đầu/tờ là ràng buộc bố cục giấy, không phải giá trị nghiệp vụ.
- `bracket-board.tsx`: giữ grid màn hình, thêm cấu trúc chỉ hiện khi in cho nhánh lớn; lặp tên giải/nội dung/loại nhánh/phần nhánh theo vi/en. Không thêm request API hoặc thay dữ liệu giải.
- `bracket.module.css`: in tên đầy đủ xuống dòng, chia trang giữa các phần nhánh; đặt named page lên `main` chứa nhánh để tránh trang tiêu đề riêng. CSS toàn màn hình giữ ellipsis hiện có.
- `components/events/event-hero.tsx` và route `draws/[subEventCode]/page.tsx`: thêm marker `data-event-hero`/`data-bracket-title`; CSS chỉ ẩn hai marker khi in nhánh có nhiều tờ, không đổi hiển thị màn hình hoặc bản in nhánh nhỏ. Bộ browser kiểm hero/tiêu đề vẫn hiện trên screen và khi in nhánh tám suất.
- `apps/client/playwright.config.ts`: desktop chuyển từ 1280×800 sang **1440×900**, giữ tên project `desktop`; mobile vẫn 390×844.
- Guard desktop tại `content-home.spec.ts`, `rate-limit.spec.ts`, `site-chrome-and-seo.spec.ts` dùng `isMobile`/tên project, không còn phụ thuộc số 1280 làm bỏ qua ca desktop ngoài ý muốn.
- `apps/client/tests/offline/`: kiểm chia trang 2–256 suất, browser/PDF, trình đọc PDF độc lập và hướng dẫn chạy. Bộ này dùng `vitest.bracket-print.config.ts`, không tự chen browser nặng vào unit suite mặc định.

## Lệnh đã chạy đạt

Từ `apps/client`:

```powershell
pnpm exec vitest run --config vitest.bracket-print.config.ts --reporter=json --outputFile=test-results/bracket-print/final-vitest.json
pnpm exec tsc --noEmit --incremental false
pnpm exec eslint src/components/bracket tests/offline tests/e2e/site-chrome-and-seo.spec.ts tests/e2e/content-home.spec.ts tests/e2e/rate-limit.spec.ts playwright.config.ts vitest.bracket-print.config.ts
uv run --with pypdf --with pymupdf python tests/offline/audit-bracket-pdf.py --render
```

Node/Chromium chạy bằng quyền ngoài sandbox sau khi runtime trong sandbox bị chặn. Không chạy query/seed/migrate PostgreSQL, không sửa `.env`, không commit/push.

## Bằng chứng tại máy

Thư mục Git bỏ qua `apps/client/test-results/bracket-print/`:

- `baseline-vitest.json`, `baseline-metrics.json`, `baseline-doubles-vi-A4.pdf`: trước sửa cắt tên.
- `event-shell-baseline-vitest.json`, `event-shell-baseline-metrics.json`, `event-shell-baseline-doubles-vi-A4.pdf`: tái hiện sáu trang với EventShell/Hero đầy đủ trước bản sửa cuối.
- `final-vitest.json`, `metrics.json`: kết quả browser/hàm chia trang cuối.
- `pdf-audit.json`: đối chiếu độc lập PDF.
- `singles|doubles` × `vi|en` × `A4|A3` `.pdf`: tám bản in cuối.
- `doubles-vi-A4-page-1.png`, `doubles-vi-A4-page-4.png`, `doubles-vi-A4-page-5.png`, `doubles-en-A3-page-1.png`: trang PDF đã mở xem.

## Giới hạn

- Chưa chạy bộ public Playwright dựa trên PostgreSQL/API thật trong tác vụ này. Đổi cấu hình desktop và guard đã qua typecheck/lint; không gọi đó là hồi quy DB E2E đã đạt.
- Kiểm browser dùng EventShell/EventHero/BracketBoard server và CSS thật, font build thật; CSS module được đổi tên class và giải cú pháp `:global(...)` để áp dụng trong trang offline. Chưa thay thế kiểm tích hợp Next/container trên dữ liệu phát hành.
- 64 suất với tên đơn/đôi dài đã được kiểm browser/PDF; nhánh 2–256 chỉ được kiểm tính toàn vẹn chia trang. Tên bất thường dài hơn fixture, nhánh dữ liệu không đều và máy in thật cần kiểm thêm theo dữ liệu vận hành.
- M1/M2, header Traefik/CDN, Lighthouse staging và luồng tạo→công bố→chốt trận→SSR vẫn mở. Trong tree hiện tại không có file `vertical-slice.spec.ts`; cần cập nhật mô tả kế hoạch để không suy ra đã đủ test luồng đó từ tên file cũ.
