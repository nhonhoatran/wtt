---
title: "Web giải đấu bóng bàn Kamito"
description: "Nền tảng quản lý và công bố giải bóng bàn Kamito: admin tạo giải, bốc thăm, xếp lịch, nhập tỷ số, xếp hạng tích điểm; site công khai song ngữ render server-side."
status: in-progress
priority: P1
effort: 20w
branch: n/a
tags: [feature, frontend, backend, database, api, infra]
blockedBy: []
blocks: []
created: 2026-11-11
---

# Web giải đấu bóng bàn Kamito

## Overview

- Một ban tổ chức, nhiều giải; đơn + đôi; loại trực tiếp hoặc vòng bảng → loại trực tiếp; tỷ số nhập theo ván; xếp hạng tích điểm có hạn; client vi/en, admin tiếng Việt.
- Stack: pnpm + Turborepo; `apps/client` Next.js; `apps/admin` Refine 5 + antd 5; `apps/api` NestJS + Prisma 7.10.x; `apps/worker` BullMQ; PostgreSQL/Redis/S3 có sẵn; deploy docker-compose trên Dokploy (staging + production).
- Lịch: 19 tuần làm việc (95 ngày công) + 1 tuần Tết. Phạm vi 80 ngày công + dự phòng 15. **Ngày bắt đầu: chờ xác nhận.**

## Phases

Phase 04, 05 (2026-11-12) và 06 (2026-11-13) đã làm trọn, không tách lát cắt; chưa deploy staging. Phase 06 làm trước khi G1a/G1b được BTC trả lời (sai lệch so với cổng, xem phase 06). Phase 07 hoàn thành phạm vi (2026-11-14, chưa deploy staging; còn đo staging và deploy). Phase 04–07 đã có verifying UI (phase 04, 06, 07 xác nhận 2026-11-14). Phase 05 còn mở: file Excel thật, staging và pilot.

<!-- Debt fixes sync — 2026-11-14 -->
- Đã đóng (commit `c449c75`..`608d948`, kiểm trong code): tag `match-*` và `player-*` khi công bố, gỡ, rút/đổi entry sau công bố; `place-qualifiers` và `place-group-qualifiers` trên MAIN đã công bố gửi tag (`draw.placeQualifiers`); L6 import (kiểm draw trong transaction từng lô, phase 05); L8 thể thức theo vòng (`pickMatchFormat`); L11 path con của `CLIENT_INTERNAL_URL`; L13 picker giải tìm kiếm phía server; L12 quyết định giữ fix cứng cho hằng độ tin cậy nội bộ (có comment lý do); engine: ván dở cuối của RETIRED/DISQUALIFIED không tính là ván thắng trong BXH; e2e RETIRED có ván dở và Redis tắt → `PUBLIC_REFRESH_DELAYED`.
- Còn mở: đo và deploy staging; G1b; file Excel thật; mục thiết kế (màu focus, chữ "session", nhảy 76 px khi mở hộp thoại, cảm biến bàn phím cho kéo thả); e2e Q → BYE → R2 khi reopen (hiện chỉ unit).
 Phase 08 đã xong lát cắt bước 1–3 (2026-11-13), đợt 1–3 (2026-11-14) và triển khai lịch session/bàn + bản in lịch (2026-11-15, working tree). Typecheck/lint client đạt; API tích hợp 24 test/3 spec đạt; Playwright lịch 5 đạt/1 bỏ qua có chủ đích (PDF mobile). M1/M2 chưa đạt vì thiếu staging. Sync phase 04–07: 2026-11-14; phase 08: 2026-11-15. Rà toàn bộ phase: chỉ phase 08 có công việc hoàn thành trong lần bổ sung này, không đổi trạng thái phase khác.

<!-- Phase 09 sync — 2026-11-16 -->
Phase 09: gói 1–4 backend commit (`b59fffb`..`07f2500`, reflog 2026-11-14); gói 5 admin UI xong 2026-11-16, chưa commit. Kiểm: API 571/571, ranking-engine coverage 100 % / 98.09 %, browser 7 flow PASS. Sai lệch G2: làm với dữ liệu mẫu từ 2026-11-13. Còn mở: G2, deploy staging (chặn bởi phase 01), admin chưa có unit test. Chi tiết: `phase-09-ranking-rules-points-ledger-and-snapshots.md`. Không đổi trạng thái phase khác.

<!-- Full-plan sync — 2026-11-17 -->
Phase 10 hoàn tất code, kiểm thử và verifying local: bốn route SSR, tìm/lọc/phân trang phía server, breakdown native, hồ sơ opaque/private 404/slug cũ và gộp 301, điểm theo vòng, link hồ sơ toàn site, cache/metadata/sitemap. Kỳ mới dùng eventId nội bộ trong JSON snapshot để kiểm đúng giải khi slug đổi hoặc tái sử dụng; không migration hoặc sửa kỳ đã công bố. Legacy thiếu id che nhãn/link, giữ nguyên điểm/vòng/ngày. Ngân sách 80 KiB đo body HTTP gzip: mẫu 50 × 20 khoản giữ đủ 1.000 khoản, 377.129 byte JSON / 9.307 byte gzip; JSON thô vượt ngưỡng, chưa bảo đảm mọi lịch sử.

[QA phase 10](../reports/tester-261117-phase-10-public-rankings-players.md): API tích hợp 111/111 ở 15 file, API unit 16/16, client 45/45, shared 101/101, ranking-engine 36/36, worker 39/39; Playwright sau F4 24/24, hồi quy trước F4 40/40. Publish admin thật → BullMQ → SSR đã có cache đổi trong 644 ms local. Build API/worker/client đạt, Next đã vá 16.4.5; [review](../reports/code-reviewer-261117-phase-10-public-rankings-players.md) 9,5/10, không còn Critical/P1/P2 mở trong phạm vi review. Chưa deploy/đo staging.

Ảnh chụp lịch sử ngày 2026-11-17 sau khi rà đủ 12 phase cấp trên cùng: **117/154 checkbox (76,0 %), 37 còn mở**; tỷ lệ theo checkbox, không theo ngày công hay cổng nghiệm thu. Backfill phase 05 (301 và whitelist đã kiểm), 12 mẫu UI phase 08 theo verifier và nguồn hiện tại, verifying phase 09; tách verifying khỏi staging ở phase 09/10. Phase 10 đạt 8/9, giữ `in-progress` do staging; các cổng G1/G2, M1/M2, pilot và phần phase 11/12 chưa đạt vẫn mở. [Báo cáo sweep và việc còn mở](../reports/pm-261117-phase-10-sync.md).

<!-- Phase 11 implementation sync — 2026-11-19 -->
Phase 11 đã có code local cho CMS (tin/video/trang tĩnh/tài trợ/liên hệ), API admin/public, hàng đợi hẹn giờ + sweep, job dọn liên hệ, trang công khai, trang chủ, footer và JSON-LD `NewsArticle`/`VideoObject`. Editor có bố cục responsive, tab vi/en, lưu nháp/đăng ngay/hẹn giờ và dán ảnh qua upload-intent; chỉ chèn ảnh `READY` có URL HTTPS, local cần `MEDIA_PUBLIC_BASE_URL` HTTPS. Tab tài trợ có kéo thả bằng chuột/bàn phím; endpoint reorder xử lý phân trang và ghi audit atomic. Mutation CMS ghi audit metadata trong cùng transaction, trả cảnh báo queue/cache sau commit. Đã đối chiếu/tái dùng mẫu code và kiểm giao diện 1440/390 bằng ứng dụng thật với API mock; không có skill `ui-consistency` hiện hành.

Kiểm tra cục bộ ngày 2026-11-19: Prisma validate; typecheck/lint/build shared, DB, API, worker, admin và client đạt; bản sửa nhãn CMS admin cuối cũng đã qua typecheck/lint/build. `pnpm install --frozen-lockfile` đã sửa symlink Better Auth. Các suite đạt **383/383 ca**: API `src` **177/177**, shared **101/101**, worker **44/44**, client **50/50**, admin **11/11** (Windows 6: image policy 3 + trạng thái TipTap thật 3; WSL entrypoint 5).

[QA public mock](../reports/tester-261119-phase-11-cms-mock-ui.md): Next production thật, 7 route × 1440/390 = **14/14 lượt đạt**, 7 nhóm tương tác ở cả hai viewport, không `pageerror`/tràn ngang ở lượt cuối và đã xem ảnh. [QA admin mock](../reports/tester-261119-phase-11-admin-mock-ui.md): ứng dụng Vite thật, **8/8 ca browser + 4/4 kiểm payload/form đạt**, đã xem editor 1440/390. Admin chuyển sang data router + `useBlocker`; đã kiểm hủy/xác nhận native Back/Forward và menu, giữ nháp, lưu không báo nhầm, ID route cũ, body vi/en, ba form sửa, bộ chọn giải và clipboard HTTPS/READY. Đã sửa lỗi TipTap làm rỗng body khi đổi editability, defaults ghi đè dữ liệu Refine, filter `isActive` không hợp hợp đồng và bốn lỗi giao diện public. [Review](../reports/code-reviewer-261119-phase-11-cms.md) không còn Critical/P1/P2 trong phạm vi mã đã rà.

**Giới hạn còn mở:** 16 ca API tích hợp và 18 ca Playwright DB E2E đã bổ sung/typecheck/liệt kê, **chưa thực thi**. Migration SQL được tạo và rà soát offline; target in ra là `localhost:5433/kamito_tt_dev`, đang chờ xác nhận trước khi áp dụng. PostgreSQL chưa bị truy vấn/seed/migrate trong các lượt browser mock. Kết quả mock không xác nhận DB–Redis/BullMQ–storage thật hoặc staging; Phase 11 giữ `in-progress` theo cổng phase 01.

Rà lại đủ 12 phase cấp trên cùng ngày 2026-11-19: **127/158 checkbox (80,4 %), 31 còn mở**. Đếm các checkbox gạch đầu dòng trong 12 file phase, gồm checklist mẫu UI phase 08; Implementation Steps mô tả tiến độ, không đếm lặp. Checklist phase 11 làm rõ structured metadata và tách các gate DB, guard, trực quan, staging; guard và trực quan đã đóng với bằng chứng mock nêu trên. Các phase khác giữ nguyên checkbox vì chưa có bằng chứng mới để đóng cổng. Kết quả local/mock và số ca đã viết không thay cho nghiệm thu DB, E2E dịch vụ thật, staging hoặc BTC.

<!-- Phase 12 verified implementation sync — 2026-11-19 -->
Snapshot phase 11 **127/158** ở trên được giữ nguyên như lịch sử trước đợt kiểm DB thật. Rà đủ 12 file phase sau phase 12: **134/163 checkbox (82,2 %), 29 còn mở**. Chỉ thay đổi checklist phase 12, tách mã nguồn đã kiểm khỏi gate phát hành; các checkbox phase 01–11 giữ nguyên. Các mục phase 11 về toàn bộ DB/CMS matrix vẫn mở vì chỉ chạy targeted scope trên DB `_test`, không migrate dev/staging.

Phase 12 đã bổ sung ba trường tiếng Anh CMS và nhãn chuyên mục động, sitemap runtime chia index/chunk theo URL/byte, Twitter/JSON-LD, Helmet/header và log allowlist kể cả Better Auth/Prisma/worker. Kiểm cuối theo từng suite: API src **182**, shared **104**, worker **44**, client **72**, admin **11** đạt; typecheck/lint/build liên quan đạt. API tích hợp thật **32 ca duy nhất/7 file** và ba suite Playwright public production local **55 đạt/5 bỏ qua viewport/0 lỗi**, không retry. Publish admin → BullMQ → SSR cache đổi trong **212 ms** local. Đủ **18 migration chỉ áp dụng trên `localhost:5433/kamito_tt_phase12_test`**; không áp dụng hai migration mới vào dev/staging, root `.env` không được sửa bởi lệnh test. Probe SQL lỗi chỉ đọc có negative control xác nhận log mặc định không rò sentinel. Audit còn 2 moderate, 0 high/critical.

Chưa hoàn tất: toàn site UI, validator/container/dữ liệu SEO phát hành, CSP enforce/nonce, Lighthouse/axe/load thật, E2E giải 8 bước, staging/Dokploy/forwarded headers, backup/RPO, rollback/restore và các quyết định BTC/consent. [PM sweep](./reports/pm-261119-phase-12-sync.md), [API](./reports/tester-261119-phase-12-real-api.md), [browser](./reports/tester-261119-2234-phase-12-bilingual-public-e2e.md), [review](./reports/code-reviewer-261119-phase-12-hardening.md).

<!-- Full-plan sweep — 2026-11-20 -->
Rà lại đủ **12 file phase**: giữ **134/163 checkbox (82,2 %), 29 mở**, không thêm checkbox hoàn tất từ công cụ mới. Phase 08 sửa/kiểm print64 và desktop 1440; phase 09 bổ sung 18 unit state ma trận (admin 29 ca duy nhất, ranking-engine 36); phase 10 không đổi feature, còn staging. Phase 11 mở rộng suite publishing thành năm ca nhưng mới kiểm type/liệt kê; phase 12 chuẩn bị axe bốn ca và runner Lighthouse, chưa đo sản phẩm. Hồi quy API `src` 182, worker 44, shared 104, client 72 đạt sau khi bật riêng Redis. Không query/migrate/seed PostgreSQL hoặc chỉnh `.env` trong lượt này; cổng target DB, G1/G2, M1/M2, pilot, staging và ra mắt giữ mở. [PM sweep](../reports/pm-261120-phases-08-12-sync.md), [print64](../reports/tester-261120-phase08-print64-desktop1440.md), [ranking admin](../reports/tester-261120-phase09-admin-unit.md).

Hardening bổ sung: override `@prisma/config>effect` 3.22.1; audit cuối **0 high/critical, 2 moderate** (exit 1 vì moderate). Frozen install, Prisma validate/generate/DB build và build/typecheck client/API/worker đã kiểm đạt theo [QA](./reports/tester-261120-local-checks.md), [review](./reports/code-reviewer-261120-phases08-12.md). API 182/client 72/admin 29/shared 104/worker 44 đều có lượt chạy lại sau phục hồi dependency, không cộng trùng các lượt.

| Phase | Checkbox đã xong/tổng | Còn mở chính |
|---|---|---|
| 01 | 10/15 | Đồng bộ quyết định repo, preflight, sao lưu/RPO, Dokploy/staging, bằng chứng CI GitHub; hiện có remote origin |
| 02 | 3/5 | Spike D staging; dọn spike/schema chờ duyệt |
| 03 | 12/13 | Deploy + migrate staging |
| 04 | 11/12 | Deploy + migrate staging |
| 05 | 14/16 | Staging; file Excel thật/pilot |
| 06 | 11/13 | G1b; staging; G1a và nợ UI vẫn ghi ở phase |
| 07 | 12/14 | Đo và deploy staging; E2E Q → BYE → R2 và nợ UI vẫn mở |
| 08 | 27/28 | Staging → M1/M2 |
| 09 | 9/11 | G2; staging |
| 10 | 8/9 | Deploy/đo staging |
| 11 | 10/13 | Migration dev/staging; hoàn tất toàn bộ ma trận CMS với dịch vụ thật; staging |
| 12 | 8/14 | UI toàn site; SEO validator/container; CSP enforce; Lighthouse/axe/load staging; staging rollback/restore |

| Phase | Name | Tuần | Ngày công | Status |
|-------|------|------|-----------|--------|
| 1 | [Nền móng: monorepo, compose, Dokploy, staging, design token](./phase-01-foundation-monorepo-compose-dokploy-design-tokens.md) | 1–2 | 6 | In progress (code xong; chờ hạ tầng; chưa qua cổng ra) |
| 2 | [Spike: Refine + antd 5, Better Auth, phát hành Dokploy, revalidate Next.js](./phase-02-spikes-refine-antd-better-auth-dokploy-nextjs-revalidation.md) | 1–2 | 3,5 | In progress (B/C/E đạt; D chờ staging) |
| 3 | [Đăng nhập admin, RBAC, người dùng, khung admin](./phase-03-admin-auth-rbac-users-and-admin-shell.md) | 2–3 | 5,5 | Hoàn thành (chưa deploy staging) |
| 4 | [Dữ liệu gốc giải đấu + cấu hình + upload ảnh + sanitizer](./phase-04-tournament-master-data-config-and-media-upload.md) | 4 · 7–8 | 2 + 6 | Hoàn thành (chưa deploy staging; làm trọn 2026-11-12; verifying UI xong 2026-11-14; còn: deploy staging) |
| 5 | [VĐV, cặp đôi, đăng ký, import Excel, gộp VĐV](./phase-05-players-pairs-entries-and-excel-import.md) | 4 · 8–9 | 1,5 + 6,5 | Hoàn thành (chưa deploy staging; còn mở: file Excel thật, staging + pilot) |
| 6 | [Bốc thăm, hạt giống, vòng bảng, sinh nhánh, thao tác sau công bố](./phase-06-draws-seeding-groups-and-bracket-generation.md) | 4–5 · 10–11 | 4 + 6 | Hoàn thành (chưa deploy staging; G1a/G1b chưa xác nhận; màn admin browser-tested 2026-11-14; còn mở: deploy staging, nhánh đấu và vòng bảng chưa hiệu chỉnh UI) |
| 7 | [Xếp lịch session/bàn, nhập, chốt, sửa tỷ số](./phase-07-scheduling-sessions-tables-and-result-entry.md) | 5–6 · 11–12 | 3,5 + 5,5 | Hoàn thành (chưa deploy staging; xong 2026-11-14; còn: đo staging, deploy staging, Q → BYE → R2 khi reopen (e2e), mục thiết kế UI) |
| 8 | [Site công khai: khung, trang giải, nhánh đấu, trận, bản in](./phase-08-public-site-shell-event-pages-and-bracket-ui.md) | 6 · 12–13 | 4 + 5 | In progress (đợt 1–3 xong 2026-11-14, Playwright 34 pass tại thời điểm đó; lịch session/bàn + bản in lịch triển khai 2026-11-15; API tích hợp 24 test/3 spec đạt; Playwright lịch 5 đạt/1 bỏ qua có chủ đích (PDF mobile); còn staging → M1/M2 chưa đạt) |
| 9 | [Quy tắc điểm, sổ điểm, chốt bảng xếp hạng](./phase-09-ranking-rules-points-ledger-and-snapshots.md) | 14–15 | 7 | In progress (gói 1–4 commit; gói 5 UI xong 2026-11-16, chưa commit; chờ G2 và staging) |
| 10 | [Trang xếp hạng, danh sách và hồ sơ VĐV](./phase-10-public-rankings-players-list-and-profiles.md) | 15–16 | 3,5 | In progress (code/test/verifying local xong 2026-11-17; 8/9 checkbox; chờ deploy và đo staging) |
| 11 | [CMS: tin, video, nhà tài trợ, trang tĩnh, liên hệ, trang chủ](./phase-11-cms-news-videos-sponsors-static-pages-contact.md) | 16–17 | 5 | In progress (10/13; code/test và UI mock; targeted API/public browser DB test thật đã đạt; còn migrate dev/staging, toàn bộ ma trận CMS và staging) |
| 12 | [Tiếng Anh, SEO, hardening, ra mắt](./phase-12-english-seo-hardening-and-launch.md) | 17 | 4,5 | In progress (8/14; E2E 8 bước local đạt desktop + mobile 2026-11-24; gate phát hành còn mở) |
| — | Pilot với BTC trên dữ liệu một giải cũ (staging) | 9 | 1 | Pending (chặn: chưa có staging, xem Phụ thuộc) |
| | **Phạm vi** | | **80** | |
| | **Dự phòng**: tuần 9 (1,5) · tuần 13 (3,5) · tuần 18–19 (10) | | **15** | |

## Lượt tiếp theo với dịch vụ thật — 2026-11-20

- Target riêng `localhost:5433/kamito_tt_phase12_test` đã được xác nhận; 18 migrations up to date, seed cấu hình test đạt. Không migrate/query/seed DB dev hoặc staging. Hash `.env` không đổi ở các lượt API/probe. [API thật](./reports/tester-261120-real-api.md): **21 spec / 132 ca duy nhất đạt**; một native crash Windows và hai JSON generated cũ bị ghi đè trước sửa đường dẫn được giữ rõ trong báo cáo, không gọi các lượt lỗi là đạt.
- Public production `full-03` sau sửa hai lỗi accessibility: **96 đạt / 8 skip / 0 lỗi / 0 flaky**, **36 axe scan không violation**; công bố BXH qua API admin → BullMQ → SSR đã nóng đạt **209 ms desktop / 218 ms mobile**. Đây là các suite public, không phải full tournament admin-browser workflow. [Báo cáo](./reports/tester-261120-real-public-and-axe.md).
- Probe dọc API tạo giải/nội dung/4 đăng ký/draw/công bố → RESULTS_OPERATOR chốt → BullMQ → SSR đổi trong **133 ms**, baseline TTL **29.978/29.947 ms**; hậu kiểm dữ liệu/key riêng đều 0. Không đổi kết quả này thành M1 staging hoặc luồng UI tám bước.
- Lighthouse `r01` không đạt SEO92 do thiếu description (ranking crash native). Metadata đã sửa với **83 unit** và focused browser SEO/chrome + axe **27 đạt / 5 skip**, 36 axe scan mới 0 violation; không coi full-03 96/8 là rerun trên metadata build hoặc cộng các lượt lặp. Baseline lỗi được giữ riêng với audit `r02` tiếp theo.
- [Lighthouse `r02` local](./reports/tester-261120-real-lighthouse.md) đạt **4/4** ngưỡng P85/A90/SEO95: P home100/event99/draw100/ranking100, A100/S100 cả bốn trang. [Smoke local](./reports/tester-261120-real-smoke.md) cấu hình 5 arrival/s × 120 s chạy riêng sau audit: thực **600 request/iteration, 600 check HTTP 200, 0 failed/5xx/drop**, bốn threshold đạt, exit 0; p95 **14,125 ms**, raw aggregate rate 4,659093/s giữ riêng. Hash `.env` không đổi. Sweep đủ 12 phase hiện giữ **134/163 (82,2 %), 29 mở**, không thêm/tách checkbox để tăng tỷ lệ. G1/G2, M1/M2, pilot, consent, hạ tầng/staging, CSP enforce, full 8-step UI E2E và rollback/restore giữ mở. [PM lượt dịch vụ thật](../reports/pm-261120-real-services-sync.md).

## E2E tám bước — 2026-11-24

- Luồng quản trị giải đủ tám bước qua UI thật (ADMIN + RESULTS_OPERATOR, worker thật, target `localhost:5433/kamito_tt_phase12_test`) **đạt desktop 1440 và mobile 390 trên cùng build cuối**, cleanup về 0, `.env` không đổi. Phase 12 thành 8/14; toàn plan **135/163 checkbox (82,8 %), 28 mở**.
- Sửa ba lỗi admin tìm ra khi chạy: trùng React key sinh form "Thêm VĐV" thừa; 29 bảng thiếu cuộn ngang làm tràn trang 390 px; side panel 260 px chiếm chỗ ở tab Danh sách/Bốc thăm/Lịch (thêm `side-menu-layout.tsx`).
- Ba lượt mất listener server local không rõ nguyên nhân được giữ riêng trong [báo cáo](./reports/tester-261120-full-ui-flow.md). Không thay staging, M1/M2, G1/G2, BTC.

## Mốc và cổng

Hoàn tất nợ code phase 08 ngày 2026-11-15: `plans/reports/tester-261115-phase08-remaining-debts.md` và báo cáo chuyên phần thay cho các mục “chưa làm” lịch sử. Timezone/DST, tìm/sort tên công khai, ngày dài và runtime Redis nhiều replica đã triển khai/kiểm local. M1/M2/staging và preflight hạ tầng thật chưa hoàn thành. Không đổi trạng thái phase khác.

Kiểm local cuối đợt rà: unit client 20/20, toàn bộ Playwright 45 đạt/7 bỏ qua theo viewport/0 lỗi; client build/typecheck/lint đạt. Báo cáo `plans/reports/tester-261115-phase08-review-debts.md`; không dùng kết quả local để đóng cổng staging.

Lượt hoàn tất tiếp theo: client 41 unit, Playwright 51 đạt/7 bỏ qua, 6 ca mới chạy Next production local với JavaScript bật đạt; API tổng hợp 8 file/50 ca đạt. Migration tên công khai `20261115032757_add_player_public_name_key` đã áp dụng local dev (16/16), chưa staging. Hai Next production local chia sẻ invalidation/hạn mức đạt; không phải triển khai production.

| Mốc / cổng | Hạn | Điều kiện |
|---|---|---|
| Gửi câu hỏi quy chế cho BTC | tuần 1 | Câu hỏi G1a, G1b, G2 ở cuối phase 12 |
| Cổng ra phase 01 | cuối tuần 2 | Staging chạy; Redis riêng `noeviction`; thiết kế upload; chủ sở hữu sao lưu + RPO. Phase 03 đã code trước cổng (sai lệch, xem phase 03) |
| **G1a** (cứng) | cuối tuần 3 | BTC xác nhận mẫu hạt giống loại trực tiếp; chưa có → lát cắt chỉ chạy dữ liệu thử. **2026-11-13: chưa xác nhận** — phase 06 dùng mẫu chuẩn, chỉ dùng dữ liệu thử đến khi BTC xác nhận |
| **M1 — lát cắt dọc** | cuối tuần 6 | Trên staging: 1 giải, 1 nội dung loại trực tiếp, entry nhập tay, bốc thăm, nhập tỷ số, 1 trang nhánh công khai |
| Diễn tập khôi phục sao lưu | trước tuần 9 | Trước lần nạp dữ liệu thật đầu tiên |
| **Pilot BTC** | tuần 9 | Nạp giải cũ bằng import, bốc thăm, nhập tỷ số, xem trang công khai; thu phản hồi |
| **G1b** (cứng) | trước tuần 10 | BTC trả lời chia bảng, phá hòa, rút lui giữa bảng → mới làm phần còn lại phase 06. **2026-11-13: chưa trả lời** — phần còn lại phase 06 đã làm theo mặc định, 5 cách hiểu chờ xác nhận (phase 12, câu 19–23) |
| M2 — lõi giải đấu đủ | cuối tuần 13 | Phase 04–08 xong trên staging |
| **G2** (cứng) | trước tuần 14 | BTC trả lời quy chế điểm → mới làm phase 09 |
| Ra mắt | cuối tuần 19 (mục tiêu) | Sớm hơn nếu không dùng hết dự phòng |

## Phụ thuộc

- Chuỗi (1 người): 1 ∥ 2 → 3 → 4 (xong) → lát cắt (5 → 6 → 7 → 8) → M1 → 5 → pilot → [G1b] 6 → 7 → 8 → M2 → [G2] 9 → 10 → 11 → 12. Spike E quyết định revalidate ở 7, 8, 10.
- Phase 03 code trước khi cổng phase 01 đạt: chờ chủ repo chốt tiếp tục hay dừng deploy (xem phase 03).
- **Blocker (rà lại 2026-11-19, chưa gỡ):** phase 02–11 chưa deploy staging vì cổng phase 01 chưa đạt; code/verifying local không thay nghiệm thu staging (preflight PG/Redis/MinIO/Traefik + sao lưu chờ chủ hạ tầng). Hệ quả: M1 (cuối tuần 6) và pilot (tuần 9) đang có rủi ro trễ. Đường mở: chủ hạ tầng trả lời preflight → 2 project Dokploy → deploy hello → migrate staging (phase 01 todo). Owner: chủ hạ tầng + chủ repo. Phase 05 còn thêm: thử file Excel thật trước pilot. Phase 11 chưa áp dụng migration local vì còn chờ xác nhận target DB.
- Điều kiện ngoài: tên repo trước lần push đầu (tài khoản/email đã chốt trong phase 01 ngày 2026-11-12); chủ hạ tầng trả lời preflight; tên miền; brand + logo vector; BTC trả lời G1a/G1b/G2; ngày bắt đầu + lịch Tết.

## Ràng buộc cứng (áp dụng mọi phase)

- Schema chỉ đổi qua `prisma migrate dev` hoặc `--create-only` → review SQL → `migrate deploy`. Không bao giờ `prisma db push`.
- Migration tương thích ngược; bước phá hủy lùi sang bản sau. Không lấy giá trị từ dòng `.env` đã comment; lệnh đụng DB in host + tên DB và xin xác nhận.
- Giá trị nghiệp vụ là cấu hình động; tham số vận hành chỉnh trên `/settings` (bảng `AppSetting`, khung có từ phase 03); env chỉ cho secret, kết nối, thứ cần lúc boot và trần/sàn an toàn. Danh sách cố ý fix cứng: phase 04.
- `QUEUE_PREFIX` bắt buộc cho mọi queue và khóa Redis; payload job chỉ chứa id.
- Lọc/sắp xếp/phân trang ở server. RBAC enforce ở NestJS guard (deny-by-default); admin chỉ ẩn/hiện UI.
- Comment ít, tiếng Anh; commit tiếng Anh conventional, không nhắc AI; file < 200 dòng, kebab-case. Site tham chiếu chỉ học cấu trúc, không dùng asset/chữ/dữ liệu.

## Ngoài phạm vi và cắt

- Để giai đoạn sau: thi đấu đồng đội; chấm từng điểm; VĐV tự đăng ký; nối Kamito Member; tài khoản người hâm mộ; tìm kiếm toàn cục; xem trực tiếp; kho tài liệu; tiền thưởng theo vòng; xếp hạng theo cặp; cache handler dùng chung; vai trò mới khi có người thật cần.
- Cắt khi trễ (theo thứ tự): video; hẹn giờ đăng tin; trang tĩnh; lịch dạng tháng; dải kết quả header; `/players`; export lịch/kết quả; export đăng ký; sao chép cột ma trận; tạo nhanh N bàn. Không cắt: sanitizer/XSS, auth hardening, hardening ra mắt.
- Dời từ red team: tự xếp lịch; trạng thái Entry PENDING/WAITLIST; import PLAYERS riêng; export qua queue; sao chép giải; bestResultsCount; thống kê mùa VĐV; link xem trước có token; tự lưu nháp; CRUD video/liên hệ; sắp khối trang chủ; vai trò tài trợ dạng danh mục; gắn tin/video với VĐV; số người đi tiếp > 2.
- Red team 2026-11-11: 15 finding, nhận 15 ([chi tiết](./reports/red-team-261111-1614-adjudicated-findings.md)). Câu hỏi chưa giải quyết: cuối [phase 12](./phase-12-english-seo-hardening-and-launch.md#câu-hỏi-chưa-giải-quyết) và "Việc còn mở" trong [phase 03](./phase-03-admin-auth-rbac-users-and-admin-shell.md).
