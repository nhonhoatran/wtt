# Phase 12 — Hoàn thiện tiếng Anh, SEO, hardening, ra mắt

## Context Links

- [Brainstorm §7 tiêu chí thành công, §10 câu hỏi mở](../reports/brainstorm-261111-1512-kamito-table-tennis-tournament-platform.md)
- [Site tham chiếu §1, §7 (không SEO, không sitemap — điểm cần làm tốt hơn)](../reports/researcher-261111-1450-worldtabletennis-site-feature-and-layout-analysis.md)
- [Admin + hạ tầng: ISR nhiều instance, D.2 Dokploy](../reports/researcher-261111-1450-admin-ui-kit-and-infra-queue-storage-realtime.md)
- [Phase 01 — quy trình phát hành](./phase-01-foundation-monorepo-compose-dokploy-design-tokens.md), [Phase 02 — Spike D (rollback), Spike E (sitemap lúc chạy)](./phase-02-spikes-refine-antd-better-auth-dokploy-nextjs-revalidation.md)
- [Red team đã phân xử: nhóm 5, 6, 7, 10, 15](./reports/red-team-261111-1614-adjudicated-findings.md)

## Overview

<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Priority: P1. Status: pending. Tuần 17 (≈4,5 ngày công, gồm ui-consistency ≈0,5 ngày); tuần 18–19 là dự phòng trước ra mắt. **Không thuộc danh sách cắt** và không bị cắt trước CMS.
- Phủ đủ từ điển en, rà trường song ngữ, SEO hoàn chỉnh (sitemap sinh lúc chạy, robots, JSON-LD, canonical, hreflang, OG), hardening (header bảo mật, CSP enforce, audit phụ thuộc, rà quyền), hiệu năng, smoke test tải nhẹ, e2e toàn luồng, runbook ra mắt + diễn tập rollback, tài liệu `docs/`.
- Dời giai đoạn sau: công cụ tìm bản ghi thiếu bản tiếng Anh, tải thử 50 req/s.

## Key Insights

- Fallback vi đã có từ phase 08; việc còn lại là đủ từ điển UI và rà trường công khai.
- Trang `/en/...` có nội dung đang fallback vi → vẫn index được, nhưng đặt `hreflang` đúng; không tạo trang trùng lặp nội dung mà không có canonical.
- Client chạy 1 instance (cache theo instance — caveat ISR); muốn scale ngang cần cache handler dùng chung → giai đoạn sau.
<!-- Red Team: Deploy/migrate/staging/sao lưu — 2026-11-11 -->
- Staging, quy trình phát hành và diễn tập khôi phục sao lưu đã có từ phase 01–02 và pilot; phase này chỉ diễn tập lại trên bản ra mắt.

<!-- Phase 03 sync — 2026-11-12 -->
- Phase 03 đã có e2e auth/RBAC trong `apps/api/test/` (13 file, gồm `express-router-allowlist`, `permission-coverage`, `session-lifecycle`, `bull-board-access`). Phase 12 chạy lại trên Postgres + Redis thật làm nền cho mục tích hợp. Trạng thái chạy: xem phase 03.

## Requirements

Functional
- Từ điển `en.json` đủ 100 % khóa của `vi.json` (test so khóa).
<!-- Red Team: Audit, phạm vi công khai, VĐV nhỏ tuổi, song ngữ — 2026-11-11 -->
- Rà song ngữ: mọi trường hiển thị công khai có `En` hoặc nằm trong danh sách trung tính ngôn ngữ (`pick-localized.ts`); nhãn ô chờ, trạng thái, mã vòng render qua từ điển.
<!-- Red Team: Revalidate Next.js chưa kiểm chứng — 2026-11-11 -->
- SEO: `sitemap.xml` **sinh lúc chạy** (index nếu > 1 file) gồm giải, tab giải, trận đã chốt, BXH, tin, video, trang tĩnh, cả 2 locale; URL VĐV chỉ khi câu hỏi đồng ý công khai đã được trả lời là được phép; `robots.txt` (chặn `/api`); JSON-LD `SportsEvent` (giải), `NewsArticle` (tin), `Person` (VĐV — cùng điều kiện như sitemap); canonical + `alternates.languages`; OG/Twitter card; trang 404/500 song ngữ.
<!-- Red Team: Kiểm soát bảo mật sớm — 2026-11-11 -->
- Hardening: header bảo mật (HSTS, CSP **enforce** sau khi báo cáo report-only từ phase 08 sạch, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`), `helmet` ở API, `pnpm audit` không còn lỗ hổng high/critical chưa xử lý, log không chứa dữ liệu cá nhân.
- Vận hành: diễn tập lại khôi phục sao lưu PostgreSQL + MinIO trên staging với bản ra mắt (bản đầu đã làm trước pilot); dọn file import, intent upload, liên hệ quá hạn chạy đúng (job phase 04, 05, 11).

Non-functional
- Lighthouse mobile (trang chủ, trang giải, nhánh, BXH): Performance ≥ 85, Accessibility ≥ 90, SEO ≥ 95.
<!-- Red Team: Lịch 20 tuần + lát cắt dọc + cắt phạm vi — 2026-11-11 -->
- Smoke test tải nhẹ (autocannon hoặc k6 — kiểm license trước) trang giải đang diễn ra trên staging: 5 req/s trong 2 phút, 0 lỗi 5xx, p95 ghi lại làm mốc.
- axe: 0 lỗi mức critical trên các trang chính.

## Architecture

Ma trận test toàn dự án (tổng hợp các phase)

| Tầng | Phạm vi | Công cụ | Dữ liệu |
|---|---|---|---|
| Unit | `competition-engine` (bracket, BYE, seeds, đổi chỗ sinh lại dẫn xuất, vòng loại `QF-n`, vòng tròn, BXH bảng với walkover/bỏ cuộc/rút lui, validate tỷ số, ảnh hưởng mở lại), `ranking-engine` (vòng đạt, điểm theo phiên bản quy tắc, snapshot, hạt giống cặp), `shared` (slug, chuẩn hóa tên, tuổi, quyền, predicate trận) | Vitest | hàm thuần, ca biên trong bảng test từng phase |
| Tích hợp API | mọi module admin/public: phân quyền, allowlist router Express, vòng đời phiên, phân trang/lọc/sort, phạm vi công khai + snapshot trường, ràng buộc, khóa + chốt đồng thời, mở lại/cưỡng chế, import, upload, `cache-tags` | Vitest/Jest + supertest | Postgres + Redis + MinIO cục bộ thật (`docker-compose.dev.yml`), DB `*_test` riêng, migrate deploy sau khi in host + tên DB |
| Worker | media, import, ranking (dấu bẩn, tuần tự hóa, job id), publishing, revalidate, các job dọn | test tích hợp với Redis thật | như trên |
| E2E | lát cắt (M1), luồng vận hành đầy đủ + trang công khai + bản in | Playwright (1440 + 390) | dữ liệu tự tạo bằng seed test, không lấy từ site tham chiếu |

- Không mock DB/queue để test qua; mock chỉ chấp nhận cho dịch vụ ngoài không kiểm soát (không có trong bản đầu).

<!-- Red Team: Sửa kết quả và toàn vẹn khi chốt đồng thời — 2026-11-11 -->
Luồng E2E chính (kịch bản tiêu chí thành công)
1. Đăng nhập `ADMIN` → tạo giải + 2 nội dung (MS knockout có vòng loại, WD vòng bảng) → import 40 + 12 đăng ký (có dòng "cần xác nhận").
2. Bốc thăm vòng loại + nhánh chính + vòng bảng → công bố → thay 1 VĐV chưa đấu bằng "Thay VĐV".
3. Tạo session, xếp lịch tay vài trận; in phiếu trận.
4. Đăng nhập `RESULTS_OPERATOR` → chốt toàn bộ trận (script UI lặp) → mỗi lần kiểm trang trận công khai đổi trong thời hạn đã chốt; sửa tỷ số 1 trận; thử mở lại → 403.
5. `ADMIN` mở lại 1 trận có trận kế chưa đấu (xem trước + nhập lại mật khẩu) → chốt lại; 1 VĐV rút khỏi bảng theo luật cấu hình.
6. Bốc suất vòng loại, đưa người đi tiếp từ bảng → chốt tới chung kết.
7. Kỳ chốt BXH → công bố → `/rankings/...` đúng thứ tự + breakdown theo quy tắc trên admin.
8. Đổi 1 ô quy tắc điểm với ngày hiệu lực hôm nay → giải vừa kết thúc trước đó giữ điểm; giải mới kết thúc sau đó dùng điểm mới (không sửa code).

<!-- Red Team: Deploy/migrate/staging/sao lưu — 2026-11-11 -->
Runbook ra mắt (ghi vào `docs/deployment-guide.md`)
1. Chốt domain client + admin; TLS qua Dokploy/Traefik.
2. Điền env trên Dokploy production cho từng service (đối chiếu `.env.example`; không chép từ dòng đã comment; secret riêng, khác staging; `QUEUE_PREFIX` = `kamito-tt:production`).
3. Phát hành theo quy trình phase 01: in host + tên DB prod, xác nhận → `pg_dump` → `migrate` (`MIGRATE_CONFIRM_TARGET` khớp) → đổi container.
4. Seed danh mục mặc định (in host + tên DB, xác nhận) → chỉnh trên admin theo quy chế thật của BTC.
5. Tạo `ADMIN` bằng CLI `create-admin`; tạo tài khoản nhân viên.
6. Smoke test: health 4 service, đăng nhập, mở 5 trang công khai, upload 1 ảnh, 1 job mỗi queue chạy xong (bull-board), `/api/revalidate` và `/api/v1/public` không truy cập được từ internet qua domain admin/client.
7. Diễn tập rollback trên staging theo Spike D: deploy bản trước, xác nhận chạy được trên schema mới (migration tương thích ngược); runbook `prisma migrate resolve` sẵn sàng.

## Related Code Files

Create
- `apps/client/src/app/robots.ts` (sitemap đã có từ phase 08; tách `sitemap/[id]` nếu cần index), `apps/client/src/lib/json-ld.ts`, `apps/client/src/app/[locale]/{not-found.tsx,error.tsx}`
- `apps/client/tests/i18n-keys.test.ts`, `apps/client/tests/e2e/full-tournament-flow.spec.ts`
- `apps/api/src/modules/public-sitemap/{public-sitemap.controller.ts,public-sitemap.query.ts}`
- `tests/load/event-page-smoke-test.js`
- `docs/{deployment-guide.md,system-architecture.md,code-standards.md,development-roadmap.md,project-changelog.md}` (giao `docs-manager` cập nhật/tạo)

Modify: `apps/client/src/i18n/en.json`, `apps/client/src/i18n/pick-localized.ts`, `apps/client/next.config.*` (CSP report-only → enforce, header bảo mật), `apps/client/src/app/sitemap.ts`, `apps/api/src/main.ts` (helmet), metadata ở các route.

## Implementation Steps

1. `ui-consistency:finding-patterns` → `ui-consistency:planning`: rà toàn bộ mẫu đã chốt, liệt kê chỗ lệch cần sửa (trang 404/500, trạng thái lỗi, empty state song ngữ).
2. Hoàn thiện `en.json` + test so khóa; rà trường song ngữ công khai.
3. Sitemap lúc chạy/robots/JSON-LD/canonical/hreflang/OG; kiểm bằng validator schema.org + `curl` trên container đã build (không cần API lúc build).
4. Header bảo mật; xem báo cáo CSP report-only → sửa vi phạm → chuyển enforce (cho phép iframe theo `VIDEO_EMBED_HOSTS`, ảnh từ nguồn ảnh của thiết kế upload); helmet; `pnpm audit` + xử lý.
5. Lighthouse, axe, smoke test tải nhẹ trên staging; sửa tới khi đạt ngưỡng.
6. Playwright luồng E2E chính.
7. Runbook + diễn tập rollback + diễn tập lại khôi phục sao lưu (ghi bằng chứng, thời gian).
8. Giao `docs-manager` cập nhật `docs/`; `code-reviewer` rà toàn bộ trước ra mắt.
9. `ui-consistency:verifying` toàn site (admin + public, 1440 + 390).

## Todo List

- [ ] ui-consistency: finding-patterns → planning (rà tổng)
- [ ] en.json đủ khóa + test; rà trường song ngữ công khai
- [ ] Sitemap lúc chạy, robots, JSON-LD, canonical, hreflang, OG, 404/500
- [ ] Header bảo mật, CSP enforce, helmet, audit phụ thuộc
- [ ] Lighthouse, axe, smoke test tải nhẹ đạt ngưỡng
- [ ] Playwright luồng E2E chính
- [ ] Runbook, diễn tập rollback, diễn tập lại khôi phục sao lưu
- [ ] docs/ cập nhật; code review tổng
- [ ] ui-consistency: verifying toàn site

## Success Criteria

- 5 tiêu chí thành công của brainstorm được chứng minh bằng luồng E2E chính + số đo: tạo giải hoàn chỉnh không đụng DB; công khai cập nhật ≤ 5 s (hoặc ≤ TTL nếu Spike E trượt); BXH đúng theo quy tắc admin; SSR + slug/meta/sitemap + dùng tốt ở 390 px; đổi quy tắc/thể thức/hạng giải không sửa code.
- Ngưỡng Lighthouse, axe đạt; smoke test 0 lỗi 5xx; `pnpm audit` không high/critical chưa xử lý; CSP enforce không chặn tài nguyên hợp lệ.
- Diễn tập rollback và khôi phục sao lưu thành công trên staging, có ghi thời gian.

## Risk Assessment

| Rủi ro | Khả năng × Tác động | Xử lý |
|---|---|---|
| CSP enforce chặn nhúng/ảnh | Trung bình × Thấp | Đã chạy report-only từ phase 08; sinh CSP từ env |
| Thiếu bản dịch nội dung lúc ra mắt | Cao × Thấp | Fallback vi; bổ sung dần |
| Trễ dồn về tuần cuối | Trung bình × Cao | Dự phòng tuần 18–19; áp danh sách cắt (phase 04–11) trước, không cắt hardening |

Rollback: theo runbook; migration tương thích ngược nên bản trước chạy được.

## Security Considerations

- CSP không `unsafe-inline` cho script (dùng nonce nếu Next.js cần); cookie admin `Secure`; API không có domain công khai.
- Rà quyền lần cuối: test phủ route + allowlist router Express (phase 03) xanh; không endpoint public nào trả trường riêng tư (test snapshot trường + phạm vi công khai).
- Secret chỉ trong env Dokploy; production dùng secret khác staging; xoay `AUTH_SECRET`, `REVALIDATE_SECRET`, `SSR_INTERNAL_SECRET` nếu từng lộ.

## Next Steps

- Giai đoạn sau: xem danh sách "Để giai đoạn sau" trong [plan.md](./plan.md#để-giai-đoạn-sau-ngoài-phạm-vi).

## Câu hỏi chưa giải quyết

Ký hiệu: **[G1a]**, **[G1b]**, **[G2]** = câu hỏi thuộc cổng cứng (xem plan.md).

1. Tài khoản GitHub, email commit, tên repo (cổng phase 01)?
2. PostgreSQL/Redis/MinIO có dùng chung với dự án khác không; ai giữ thông tin đăng nhập; cấp được role PG runtime (chỉ DML) + role migrate riêng, service account MinIO giới hạn 1 bucket không?
3. Redis có sẵn đặt `maxmemory-policy` gì, có dùng chung làm cache không (quyết định Redis riêng cho BullMQ)?
4. Dokploy/Traefik: RAM/CPU server; build trên server hay ở CI + registry; Traefik có chuyển IP thật tin cậy vào container không; có tự deploy khi push không; chạy được container profile `tools` từ thư mục compose không; có tôn trọng `depends_on: service_completed_successfully` không?
5. Tên miền cho site công khai và admin (staging + production); tên bucket MinIO, tên DB dự án; nơi lưu `pg_dump` do dự án kiểm soát?
6. Sao lưu PostgreSQL/MinIO hiện do ai vận hành, lịch, thời gian giữ, RPO chấp nhận được?
7. Ngày bắt đầu dự án và lịch nghỉ Tết chính thức (mùng 1 Tết Đinh Mùi 2027-02-06 theo nguồn reviewer dẫn, chưa kiểm chứng)?
8. Brand guideline + logo vector chính thức; mã đỏ chuẩn (`#EC1E24` hay `#E30925`); navy/vàng chanh có phải màu chính thức?
9. **[G1a]** BTC có dùng mẫu đặt hạt giống loại trực tiếp chuẩn (hạt giống 1–2 hai đầu nhánh, 3–4 bốc vào hai phần tư còn lại…) không?
10. **[G1b]** Quy tắc chia bảng (vd tránh cùng CLB cùng bảng); tiêu chí phá hòa vòng bảng; điểm thắng/thua/thua walkover/thua bỏ cuộc; cách tính ván cho walkover/bỏ cuộc; VĐV rút lui giữa bảng thì giữ hay hủy kết quả đã đấu?
11. **[G2]** Quy chế điểm xếp hạng thật: hạng giải nào, điểm từng vòng (gồm vòng loại, vòng bảng có phân biệt thứ hạng không), thời hạn điểm, chu kỳ chốt (tuần/tháng/sau mỗi giải)?
12. **[G2]** Thua walkover ở trận đầu có được điểm xếp hạng không?
13. **[G2]** Hạt giống cặp đôi tính theo tổng điểm hiện tại của 2 VĐV (plan đang chọn) hay cách khác?
14. Nhóm tuổi/trình độ thực tế; tuổi tính theo năm sinh hay theo ngày khai mạc?
15. Đồng ý công khai thông tin VĐV, nhất là VĐV nhỏ tuổi: hiển thị hồ sơ, tuổi/năm sinh, cho công cụ tìm kiếm index (quyết định `noindex`, JSON-LD `Person`, sitemap VĐV)?
16. Pilot tuần 8–9: dùng dữ liệu giải cũ nào, file có sẵn ở dạng gì, BTC tham gia được buổi nào?
17. Form liên hệ có cần gửi email thông báo cho BTC không (bản đầu chỉ có hộp thư admin)?
18. Điều khoản sử dụng của worldtabletennis.com chưa đọc được — giữ ở mức tham khảo cấu trúc/chức năng.
