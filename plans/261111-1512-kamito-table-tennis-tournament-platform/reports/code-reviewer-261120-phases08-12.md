# Review thay đổi phase 08–12 — 2026-11-20

## Phạm vi và tính độc lập

- Reviewer phase 09–10 đọc độc lập publishing integration/safety helper của phase 11, bản in nhánh đấu của phase 08, công cụ axe/Lighthouse cùng dependency/lockfile do điều phối thêm.
- Code ranking state do reviewer này viết được **root review độc lập**, và agent phase 11–12 chạy kiểm lại; không dùng tự review làm bằng chứng độc lập. Root xác nhận extraction giữ semantics zero/null/copy/scope/baseline ngày hiệu lực; chưa kiểm React lifecycle/browser.
- Không commit, stage hoặc push; không query/seed/migrate DB trong hoạt động review. Self-check Lighthouse dùng HTTP fixture tạm trong bộ nhớ, không dùng API dự án.

## Kết quả review và xử lý finding

| Mức | Finding | Kết luận |
|---|---|---|
| P2 — đã sửa | Bản đầu `withRetentionSetting.setDays` dùng blind upsert: external edit giữa hai lần đổi ngày có thể bị lần đổi tiếp theo ghi đè, rồi restore làm mất giá trị external. | Đã đổi mọi lần ghi sang compare-and-swap theo `updatedAt/value/updatedById`; row absent dùng create-only. Đọc lại sau conditional update trong cùng transaction giữ row lock (`apps/api/test/support/publishing-test-safety.ts:24,39–46`). Reviewer đọc delta và đóng finding. Đường cạnh tranh chưa được thực thi DB. |
| P2 — đã sửa | Bản kiểm print ban đầu ghi số trận vào metrics nhưng không assert; selector sai/không render print vẫn có thể pass vì `clipped=0`. | Bản cuối assert exact IDs 1–63 ở screen và print, 5 sheet, 5 PDF pages, chiều cao, chrome/visibility (`apps/client/tests/offline/bracket-print.test.ts:142–191`). Không còn finding ở delta này. |
| Kiểm chứng bổ sung — đã đóng | Rule `:global(main)` mới cần được transform khi CSS nguồn được chèn vào bài offline. | Helper bản cuối strip `:global(...)` trước khi map class (`bracket-print.test.ts:21`). Production vẫn dùng CSS modules bình thường. |
| P2 — đã sửa | Env ngưỡng Lighthouse rỗng/whitespace đi qua `Number('')` thành 0, có thể âm thầm bỏ ngưỡng mặc định thay vì lỗi/default. | Root đã trim rồi dùng fallback mặc định cho blank; explicit `"0"` giữ nguyên (`apps/client/tests/performance/lighthouse-audit.mjs:23–24`). Reviewer đọc delta và thực thi block parser thật bằng VM trong bộ nhớ: 8/8 ca absent/blank/whitespace/zero/numeric/invalid/negative/over-limit đạt. Không HTTP/DB trong lượt kiểm parser. |
| P2 — đã sửa, phát hiện muộn | Fixture in ban đầu chỉ có main/h1, thiếu EventShell/Hero thực tế nên bỏ sót một trang A4 chứa phần giới thiệu. | Fixture cuối dùng EventShell/Hero/CSS thật, tier/date/venue/presentedBy/summary/ticket, các chooser/nav/h2. Baseline A4 bốn mẫu đều 6 trang. CSS scoped `main:has(.printOnly)` chỉ ẩn hero và tiêu đề nhánh dư khi in nhánh chia nhiều tờ; mỗi tờ đã lặp ngữ cảnh. Thêm kiểm nhánh nhỏ 8 suất vẫn giữ hero/h2, và screen luôn giữ hero/h2. Đã đối chiếu delta, final 9/9 và PDF audit 8/8; không còn finding trong delta. |

Không còn finding Critical/P1/P2 mở trong các bản thay đổi đã review, gồm delta EventHero phát hiện muộn. Typecheck/lint/build client sau delta cuối đã đạt, unit client 72/72 đạt; phần print được chốt trong phạm vi offline đã nêu. Kết luận này không phải audit toàn bộ dự án hoặc chứng nhận phát hành.

## Bằng chứng bản in

- Đã đọc `apps/client/src/components/bracket/{print-bracket-pages.ts,bracket-board.tsx,bracket-round-column.tsx,bracket-match-cell.tsx,bracket.module.css}`. Phần chia trang là cấu hình hình học in, có comment giải thích giới hạn 8 trận mở đầu; không sửa quy tắc giải hoặc số trận.
- Bảo toàn số trận/mã và thứ tự nhánh con; dữ liệu irregular giữ nguyên thay vì bị cắt mất trận (`print-bracket-pages.ts:7–21`). Screen tiếp tục render đủ nhánh gốc; chỉ bản in có bản chia trang.
- Đọc `test-results/bracket-print/final-vitest.json`: **9/9** ca đạt. Reviewer không tự chạy lại toàn bộ lượt này; đây là artifact của agent triển khai, được đối chiếu với source và metrics.
- Đọc metrics của **8 PDF** (đơn/đôi × vi/en × A4/A3): mỗi PDF **5 trang, 63 trận, 0 tên bị clip theo đo DOM**; chiều cao sheet tối đa đơn **610 px**, đôi **642 px**, trong ngân sách A4 **718 px**. Screen 1440/390 không tràn toàn trang, đủ 63 IDs; bản print ẩn trên screen.
- Đọc `pdf-audit.json`: mỗi file có 63 mã trận duy nhất, không thiếu tên, có ngữ cảnh từng trang. Đã tự mở raster PDF `doubles-vi-A4-page-1.png` và `doubles-vi-A4-page-5.png`: thấy tên đôi, dây nối, mã trận và tiêu đề; trang đầu không chỉ có tiêu đề trắng. Không coi kiểm offline này là nghiệm thu toàn site hoặc staging.
- Sau gap EventHero, đọc lại `event-shell-baseline-metrics.json`: A4 **6/6/6/6 trang** trước sửa; đọc lại `final-vitest.json`: **9 đạt / 0 lỗi**; đọc lại PDF audit cuối: tám PDF đều **5 trang / 63 trận / ngữ cảnh mọi trang / 0 tên thiếu**. Đã mở lại raster A4 đôi vi trang 1 sau delta: bắt đầu ngay bằng ngữ cảnh nhánh và bảng đấu, đủ tên/đường nối, không dư tờ giới thiệu. Source marker ở `event-hero.tsx:11`, h2 route DrawPage và rule `bracket.module.css:175–178`; screen và nhánh nhỏ giữ hành vi cũ theo kiểm browser.
- QA sau delta cuối đã xác nhận client typecheck/lint/build exit 0 và **19 file / 72 unit đạt**. Reviewer đọc `test-results/261120-phase0812-late-client-build.log` và `*-late-client-unit.log`; kết quả kiểm tĩnh cùng exit code được điều phối xác nhận. Không còn mục pending đối với bản in local trong báo cáo review này.

## Bằng chứng publishing và công cụ audit

- Publishing guard được gọi trước setup có side effect. Global sweep/cleanup có khóa bảng, kiểm không đụng row ngoài fixture; revalidate queue dùng namespace fixture riêng rồi chỉ dọn queue riêng. Chưa chạy bộ tích hợp PostgreSQL/Redis vì target test còn chờ xác nhận.
- Reviewer gọi trực tiếp hàm `assertPublishingTestTarget` bằng Node, không mở DB: **1 target local confirmed `_test` được chấp nhận; 7 input sai bị chặn** (missing URL, remote, dev DB, protocol khác, confirmation lệch, production env, production queue).
- Axe spec kiểm 9 route × vi/en và các project desktop/mobile, lưu full results và summary; tiêu chí chỉ **0 critical violations** theo plan (`accessibility.spec.ts:8–37`). Chưa chạy sản phẩm thật, không suy kết quả accessibility từ typecheck/list test.
- Reviewer chạy `node test-results/lighthouse-review-selfcheck.mjs` tại `apps/client`: tạo HTTP fixture tạm ở cổng tự cấp và gọi runner thật. Chromium launch bằng `CHROME_PATH` hoạt động; Lighthouse **13.6.0**, exit 0, có HTML/JSON/summary tại `test-results/lighthouse-review-selfcheck/`.
- Lượt self-check override ba ngưỡng về 0 để chỉ kiểm đường chạy/report; số đo trang fixture **không phải điểm hiệu năng/SEO/accessibility của sản phẩm**, không dùng để đóng cổng phase 12.
- Lệnh self-check đầu dùng `node -e` bị PowerShell bỏ dấu nháy trong source; chạy lại bằng file tạm ignored đạt. Không ghi nhận lượt lỗi đầu như thành công.

## Git và bí mật

- `git diff --check` đạt tại thời điểm review; cảnh báo CRLF của file hook là cảnh báo chuẩn hóa line ending, không có whitespace error.
- Thay đổi source đang thuộc ba luồng đã chia; dependency mới của client nằm trong `devDependencies`, phiên bản ghim và có integrity trong lockfile. Lockfile còn thay đổi optional peer resolution của Next/Vitest do dependency graph mới; không tự nâng phiên bản package gốc của các app trong diff đã đọc.
- Rà added lines của tracked diff và untracked text bằng mẫu AWS access key/private key/credential-bearing DB URLs: **0 kết quả**. Đây là rà mẫu giới hạn, không phải chứng minh không tồn tại bí mật bằng mọi hình thức. Không đọc/in `.env` hoặc nội dung tài liệu `.docx` ngoài phạm vi.
- Tài liệu `.docx` untracked ban đầu tiếp tục nằm ngoài phạm vi; các ảnh/PDF/self-check artifacts ở thư mục `test-results` ignored.
- Kết quả typecheck/lint và listing độc lập do tester phase 11–12 quản lý tại `tester-261120-independent-checks.md`; đọc bản cuối để phân biệt kiểm tĩnh và thực thi fixture.

## Rà bổ sung bản vá dependency Effect

- Audit đầu có **1 high / 2 moderate / 0 critical** ở `test-results/261120-phase0812-audit.json`. High là `effect@3.20.0`, GHSA-7589-6fvf-x4pw; reviewer đã đối chiếu advisory GitHub chính chủ ngày 2026-11-20: bản bị ảnh hưởng `<=3.22.0`, bản vá `3.22.1`. Không dùng audit 0 high của ngày trước thay kết quả hiện tại.
- Thay đổi hẹp: `pnpm-workspace.yaml:6` thêm override `@prisma/config>effect: 3.22.1`; không nâng phiên bản Prisma trực tiếp. Project lock và `node_modules/.pnpm/lock.yaml` đều resolve Effect 3.22.1, có integrity cho package mới.
- Reviewer tự chạy `pnpm audit --json` sau lock update: **0 high / 0 critical / 2 moderate**, **exit 1** vì vẫn còn moderate (`uuid`, `minimatch`). Raw JSON lưu ở `test-results/261120-phase0812-audit-review-final.json`; không mô tả exit này là audit hoàn toàn sạch.
- Lượt `pnpm why effect` đầu trùng lúc root đang reinstall vẫn cho snapshot 3.20.0. Rerun sau install hoàn tất cho **Effect 3.22.1, Found 1 version**, đường dẫn qua `@prisma/config@7.10.1` → Prisma 7.10.1. Reviewer cũng đọc junction `node_modules/.pnpm/@prisma+config@7.10.1_magicast@0.5.5/node_modules/effect` và `package.json` đích: target Effect 3.22.1, version 3.22.1. Package manifest upstream còn ghi 3.20.0 là expected vì override nằm ở workspace, không chỉnh manifest vendor.
- Phần repair bảy link trước cài xử lý symlink dependency không tương thích Windows do lần cài WSL trước. Reviewer đọc script và backup `test-results/261120-auth-symlinks-before.json`: allowlist bảy link, xác nhận `is_symlink`, target trong dependency store và backup trước `unlink`; không xóa target package source. Bản backup và script repair đều ignored, không phải source phát hành. Các bước link repair tiếp theo do root điều phối chưa được reviewer này kiểm từng symlink.
- Packet QA cuối sau frozen install đã xác nhận: **Prisma validate; DB build (Prisma Client generate 7.10.1 + TypeScript); API/worker typecheck và build; client production build đều đạt**. Hồi quy cuối API 182, worker 44, shared 104, client 72 và admin 29 ca đạt. Reviewer đọc báo cáo tester `tester-261120-local-checks.md` và raw log validate/DB build/client build; không tự nhận đã chạy lại các lệnh của tester. Đóng gate tương thích local cho override; không truy cập DB và không suy thành đã nghiệm thu runtime production.
- Reviewer còn chạy Node ESM import năm entrypoint Better Auth đúng source API dùng: `better-auth`, `better-auth/adapters/prisma`, `better-auth/api`, `better-auth/crypto`, `better-auth/node`; **5 module / 9 function exports đạt**. Không gọi `betterAuth`, `prismaAdapter` hoặc tạo ứng dụng/kết nối DB. Lượt này kiểm actual import graph sau junction repair, không thay auth E2E.
- Snapshot Git cuối của reviewer: **23 tracked modified / 0 staged / 21 untracked** (bao gồm `.docx` có sẵn từ đầu); không có file `.env`/credential/key đổi, không diff schema/migration. Rà lại added diff và untracked text: **0 credential-pattern hits**. Các con số này là snapshot trước khi điều phối chốt các báo cáo cuối, không phải lệnh commit.

## Giới hạn và việc tiếp theo

- Parser ngưỡng Lighthouse đã được đọc delta và kiểm 8 ca bằng code thật. Lượt Chrome/report self-check kiểm bản trước delta parser; delta chỉ đổi xử lý env rỗng và đã được kiểm riêng.
- Không đóng G1/G2, staging, M1/M2, consent hồ sơ, CSP enforce, luồng giải 8 bước, rollback/restore hoặc đo tải từ các kiểm local/offline.
- Publishing/sweep/retention, axe và Lighthouse trên site cần chạy với target đã xác nhận; không dùng self-check hoặc fixture mock làm bằng chứng tích hợp thật.
