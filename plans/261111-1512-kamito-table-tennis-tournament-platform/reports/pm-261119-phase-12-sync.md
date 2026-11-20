# Đồng bộ kế hoạch phase 12 — 2026-11-19

## Kết quả

Đã rà đủ 12 file phase, đọc toàn bộ checkbox mở và đối chiếu báo cáo/mã nguồn phase 12. Tổng **134/163 checkbox (82,2 %), 29 còn mở**. Đây là tiến độ checklist, không phải tỷ lệ sẵn sàng phát hành. Giữ snapshot **127/158** của phase 11 và **117/154** ngày 2026-11-17 trong `plan.md` như lịch sử.

| Phase | Đạt/tổng | Còn mở |
|---|---:|---|
| 01 | 10/15 | Đồng bộ quyết định repo, preflight, backup/RPO, Dokploy/staging, GitHub CI |
| 02 | 3/5 | Spike D staging; dọn spike/schema sau xác nhận |
| 03 | 12/13 | Deploy/migrate staging |
| 04 | 11/12 | Deploy/migrate staging |
| 05 | 14/16 | Staging và file Excel thật/pilot |
| 06 | 11/13 | G1b và staging; G1a vẫn là quyết định chưa xác nhận |
| 07 | 12/14 | Đo và deploy staging; nợ Q → BYE → R2/UI ghi ở phase |
| 08 | 27/28 | Staging → M1/M2 |
| 09 | 9/11 | G2 và staging |
| 10 | 8/9 | Deploy/đo staging |
| 11 | 10/13 | Migration dev/staging, toàn bộ ma trận CMS/vận hành, staging |
| 12 | 7/14 | UI toàn site, SEO validator/container, CSP enforce, Lighthouse/axe/load, full 8-step UI E2E, rollback/restore staging |
| Tổng | **134/163** | **29** |

Đếm các dòng `^\s*-\s+\[(x| )\]` trong đúng 12 file `phase-*.md`, gồm checklist mẫu UI phase 08; không đếm lại Implementation Steps. Chỉ đổi trạng thái checkbox ở phase 12. Phase 01/11 chỉ cập nhật wording sự thật mới, không đóng checkbox: remote `origin` đã có; targeted DB test thật đã chạy, nhưng không đồng nghĩa migrate dev/staging hoặc toàn bộ CMS đã đạt.

## Phạm vi đã xác minh

- Song ngữ: đủ key vi/en; ba trường category/duration/footer group từ DB đến admin/API/SSR; setting động nhãn chuyên mục, lọc key stale/prototype, tóm tắt chỉ tiếng Anh.
- SEO mã nguồn: sitemap runtime chia index/chunk đúng URL/byte sau XML escape, scope công khai, hai locale, metadata Twitter/JSON-LD và header. VĐV vẫn không vào sitemap/`Person` khi chưa chốt consent.
- Hardening local: Helmet trước raw auth/bull-board, media CORP, HTTP/error/Better Auth/worker log allowlist, Prisma mặc định `log: []`. Probe SQL lỗi chỉ đọc có negative control PASS. CSP vẫn report-only; audit còn 2 moderate, 0 high/critical.
- Kiểm nguồn cuối theo từng suite: API 182/32 file, shared 104/23 file, worker 44/8 file, client 72/19 file, admin 11/11 PASS. Typecheck/lint/build liên quan PASS; worker production build cuối PASS. Không cộng với snapshot cũ hoặc các lượt lặp.
- API thật 32 ca duy nhất/7 file PASS; public Playwright production local 55 PASS/5 bỏ qua viewport/0 lỗi/0 flaky, không retry. Admin publish → BullMQ → SSR cache refresh 212 ms local. PostgreSQL/Redis thật, storage local, iframe YouTube provider fixture.
- Migration 18 chỉ áp dụng DB riêng `localhost:5433/kamito_tt_phase12_test`; không áp dụng hai migration mới vào dev/staging. Process-only overrides, root `.env` không được lệnh test sửa; không có baseline hash để tuyên bố byte-identical.

## Cổng giữ mở

Không có bằng chứng để đóng toàn site UI 1440/390, SEO validator/container/dữ liệu phát hành, CSP enforce/nonce, Lighthouse/axe/load thật, UI vận hành giải đầy đủ 8 bước, staging/Dokploy/Traefik, backup owner/RPO, rollback/restore hoặc G1/G2/M1/M2/pilot/consent. Kịch bản k6 đã chuẩn bị/inspect nhưng chưa phát request staging. Hai ảnh public được mở trực quan không thay cho verifying toàn site/admin.

## Đồng bộ tài liệu và môi trường

Đã cập nhật facts hiện hành trong deployment guide, public site, architecture, standards, roadmap, changelog và kế hoạch; journal viết riêng trong `docs/journals/`. Không commit/push/deploy. Quy trình test được ghi trong deployment guide, không phụ thuộc riêng runner bị gitignore: local `_test` URL process-only, exact `MIGRATE_CONFIRM_TARGET`, `APP_ENV=test`, queue test, migrate deploy rồi seed; fixture API/Playwright dùng DB theo lượt.

API/client test server đã dừng, read-back cổng 3313/3314 không còn listener. Đã dừng đúng helper WSL sleep hữu hạn của tester; không stop/remove container hoặc xóa volume/DB. Kiểm cuối container Kamito PostgreSQL/Redis `Exited (0)` sau vòng đời WSL, dữ liệu/volume được giữ. Không tác động container dự án khác.

## Bằng chứng

- [API thật, các lỗi lịch sử và probe Prisma](./tester-261119-phase-12-real-api.md).
- [Client cuối và public Playwright thật](./tester-261119-2234-phase-12-bilingual-public-e2e.md).
- [Review hardening](./code-reviewer-261119-phase-12-hardening.md).
- [Phase 12](../phase-12-english-seo-hardening-and-launch.md), [plan tổng](../plan.md).
