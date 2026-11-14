# Phase 08 batch 3: API e2e (site, sitemap) + Playwright cho public site

## A. API e2e
- File mới `apps/api/test/public-site.e2e-spec.ts` (97 dòng, 8 test): field-path snapshot `/public/site` và `/public/sitemap` (`sortedPaths`), giá trị mặc định (site.name + 3 `public.rateLimit.*`; assert thêm không có override trong DB), đổi `maxRequests` qua `PUT /admin/settings` rồi `DELETE` về mặc định, sitemap có event PUBLISHED, không có DRAFT / cancelled, đổi publishStatus phản ánh ngay, `updatedAt` là ISO, thiếu/sai secret -> 403 `SSR_ONLY` (cả 2 route).
- `permission-coverage.e2e-spec.ts`: không phải sửa (prefix `(public/` đã nằm trong allowlist, 2 route mới tự được tính). Pass.
- Kết quả: `vitest run test/public-site test/public-events test/permission-coverage` = 3 file / 20 test pass. Toàn bộ `pnpm --filter @kamito/api test` = **67 file / 436 test pass**. `tsc` api sạch, eslint các file mới sạch.

## B. Playwright (`apps/client`)
- `@playwright/test` pin **1.64.1** (publish 2026-10-14; 1.65.0 mới 9 ngày nên bỏ). Cài chromium only. Script `test:e2e`. `.gitignore` thêm `test-results/`, `playwright-report/`.
- Cấu hình: `apps/client/playwright.config.ts` (nạp root `.env` bằng `process.loadEnvFile`, ép `API_FETCH_TIMEOUT_MS=5000`, projects `desktop` 1280 và `mobile` 390 `isMobile`, locale `vi-VN`, 2 worker, `reuseExistingServer` khi không CI).
- webServer API: chạy `node --env-file-if-exists=../../.env --import @swc-node/register/esm-register src/main.ts` (KHÔNG `--watch` như script `dev`, vì restart giữa run sẽ rớt request). Health đúng là `/api/v1/health/live` (`/api/v1/health` không tồn tại). Client: `next dev --port 3001`, health `/api/health`.
- Dữ liệu: `apps/api/test/playwright/public-world.seed.ts` (dùng `setupPublicWorld`, ghi JSON `apps/client/test-results/e2e-world.json`, không chứa SSR secret) và `public-world.cleanup.seed.ts` (đọc JSON, `cleanupPublicWorld`, xóa file). Chạy bằng `apps/api/vitest.playwright.config.ts` (include riêng, nên `vitest run` thường không đụng). globalSetup: dọn world cũ nếu còn, seed, POST `/api/revalidate` (tag events/settings/results-strip, để sitemap/list không dính cache 300s của run trước), warm-up các route (tránh race compile của `next dev`). globalTeardown: cleanup.
- Specs (`tests/e2e/event-pages.spec.ts`, `site-chrome-and-seo.spec.ts`): đủ mục 1-10. 17 test/project; 34 chạy + 4 skip theo thiết kế (print chỉ desktop, scrollWidth 390 chỉ mobile).
  - Mục 11 (rate limit): **bỏ**. Min `maxRequests` = 30, proxy cache setting 30s trong bộ nhớ, và limiter theo IP sẽ chặn luôn các test sau cùng IP; không an toàn nếu không có endpoint reset. Chưa kiểm chứng được qua e2e.
  - Test lộ tên pháp lý: fetch HTML thô (gồm RSC payload) của 10 URL vi/en, đảm bảo không chứa `Hidden <tag>` / `Hidden En <tag>`, và có `Shown <tag>`.
- Screenshot print: `plans/reports/screenshots-261114-phase-08-batch-3/draws-ms-print.png`.
- Typecheck client (đã thêm `tests`, `playwright.config.ts` vào tsconfig) và `eslint src` sạch.

## Độ ổn định
- Run đầu: 4 fail do selector của em (header `Bên `, `rowheader`), đã sửa. Sau đó 34 pass x 2 lần liên tiếp.
- Một run (sau khi sửa seed) báo 4 fail trong 2.9 phút, em chỉ lấy dòng tóm tắt nên không có chi tiết; nghi `next dev` compile lạnh + máy tải (API suite chạy kề bên). Đã thêm warm-up. Sau warm-up: 3 run 34 pass (1.3 phút) + 1 run không chạy được vì webServer thoát code 1 khi khởi động ngay sau run trước (nghi cổng chưa nhả). Chưa có log chứng minh nguyên nhân: chạy back-to-back nên đợi vài giây.

## Dọn dẹp
- `Event` trong DB: 5 trước, 5 sau (4 event `entries-*` DRAFT là của ngày 11-12/11-13, không phải của lần chạy này). Port 3000 không còn listen sau run. Cổng 3001 do `svchost` (PID 5040) giữ, có từ trước, không phải tiến trình em mở.
- Còn trong DB từ ngày 11-13 (không phải của em): 102 player `Draw %`/`Hidden %`, 26 user `@test.kamito.local`. Chưa dọn vì ngoài phạm vi.

## App bug / lưu ý
- Không thấy bug app. Lưu ý cấu hình: root `.env` thiếu `API_FETCH_TIMEOUT_MS` và `REVALIDATE_ALLOWED_HOSTS` (env client bắt buộc, `required()` ném lỗi); config Playwright tự truyền `localhost:3001` cho cả hai.
- `pnpm add -D` của playwright làm `pnpm-lock.yaml` có thêm phần `ranking-engine` vốn là thay đổi chưa commit của session khác; khi commit lock cần tách.
- `npx playwright install chromium` tự xóa `chromium-1200` / `chromium_headless_shell-1200` cũ trong `%LOCALAPPDATA%\ms-playwright` (browser mồ côi của bản Playwright khác); có thể ảnh hưởng tool dùng bản cũ.
- Không đụng ranking, không commit, không sửa `.env`. `apps/api/tsconfig.json` chỉ thêm `vitest.playwright.config.ts` vào include.

Files: `d:\Project\wtt\apps\api\test\public-site.e2e-spec.ts`, `d:\Project\wtt\apps\api\test\playwright\*.seed.ts`, `d:\Project\wtt\apps\api\vitest.playwright.config.ts`, `d:\Project\wtt\apps\client\playwright.config.ts`, `d:\Project\wtt\apps\client\tests\e2e\**`, `d:\Project\wtt\apps\client\package.json`, `d:\Project\wtt\apps\client\tsconfig.json`, `d:\Project\wtt\.gitignore`.

**Status:** DONE_WITH_CONCERNS
**Summary:** API e2e mới pass, toàn bộ API suite 436/436; Playwright 34 pass + 4 skip có chủ đích trên desktop+mobile, nhiều run liên tiếp xanh, DB sạch.
**Concerns:** (1) mục 11 rate limit không test; (2) có 1 run 4 fail và 1 run webServer không khởi động chưa có log gốc, nghi compile lạnh / cổng chưa nhả; (3) lockfile lẫn thay đổi ranking của session khác; (4) playwright install xóa chromium-1200 cũ.
